var jn = (e) => {
  throw TypeError(e);
};
var Bn = (e, t, n) => t.has(e) || jn("Cannot " + n);
var lt = (e, t, n) => (Bn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Un = (e, t, n) => t.has(e) ? jn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Hn = (e, t, n, r) => (Bn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsx as y, jsxs as F, Fragment as zt } from "react/jsx-runtime";
import { useMemo as K, useState as _, useEffect as O, useCallback as $, useRef as A, useLayoutEffect as Ne, useSyncExternalStore as ot, memo as mn, createContext as hn, useContext as pn, forwardRef as No, useImperativeHandle as gn, useId as Lr, Suspense as _o, lazy as Lo } from "react";
import { getReaderAdapters as se, requireAdapter as at } from "./adapters.js";
import { resolveReaderDownloadName as Co, resolveReaderDownloadUrls as Do, READER_PROGRESS_COPY as Ee, trimString as pt, READER_DOWNLOAD_ACTIONS as Cr, disabledReason as zo } from "./runtime/state.js";
import { r as xo, b as Oo } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Zt, isFinishedJobStatus as bn } from "@retainpdf/domain/job";
import { c as Fo, n as $o, f as jt, j as Wn, a as jo, b as Bo, h as Dr, p as yn, d as Uo, k as Vn, i as Ho } from "./reader-regions-CP3ZMHPc.js";
import { fetchDocumentReading as Wo } from "@retainpdf/api/documents";
import { isReaderTransportError as Vo, createReaderTransportError as Jo } from "./contracts.js";
import { toast as Yt, Toaster as qo } from "sonner";
import { NotebookPen as Go, X as vn, Radio as Ko, FileText as zr, Columns2 as xr, Languages as Or, FileCode2 as Zo, Sparkles as Yo, Keyboard as Xo, Download as Qo, ChevronDown as ea, ListTree as ta, Search as na } from "lucide-react";
import { Button as Fe, Input as ra } from "@retainpdf/ui";
import { pdfjs as oa, Page as aa, Document as sa } from "react-pdf";
import { extractMarkdownMath as ia, materializeMarkdownMathFallbackHtml as ca, materializeMarkdownMathHtml as la } from "./runtime/content.js";
const ua = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, da = "", fa = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ma = (e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, _u = (...e) => {
  var n;
  return (((n = se()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, ke = () => at("defaultReaderDataPort"), Jn = () => at("defaultReaderPageConfigPort"), Lu = {
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
}, Fr = {
  messageTargetOrigin: () => Jn().messageTargetOrigin(),
  readerJobId: () => Jn().readerJobId()
}, ha = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.liveTranslation) ?? null;
}, pa = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.notesQuote) ?? null;
}, ga = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.notesPanel) ?? null;
}, ba = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.readingPosition) ?? null;
}, ya = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.hostAi) ?? null;
}, va = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.hostNavigation) ?? null;
}, Sa = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.quotedBlocks) ?? null;
}, Xt = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.hostChrome) ?? null;
}, gt = () => {
  var t;
  const e = se();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, xt = () => {
  const e = se();
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
}, wa = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Pa = () => {
  var e, t;
  return ((t = (e = se()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Ra = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Ia = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Co(...e);
}, Ta = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Do(...e);
}, Ea = (...e) => at("downloadProtectedResource")(...e), ka = (...e) => at("failDownloadToast")(...e), Cu = (e, t) => at("resolveMarkdownAssetUrl")(e, t), qn = "/api/v1";
function Ma() {
  const e = () => {
    var r;
    return xo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = _(e);
  return O(() => {
    var c, i, l, u;
    const r = () => n(e()), o = (i = (c = globalThis.history) == null ? void 0 : c.pushState) == null ? void 0 : i.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const d = (f) => function(...m) {
          const b = f.apply(this, m);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), b;
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
function Aa() {
  const e = Ma(), t = K(() => Ra(Fr), [e]), n = K(() => Pa(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Na(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: c
  } = e, [i, l] = _({
    documentId: "",
    jobId: ""
  }), [u, d] = _({
    documentId: "",
    jobId: ""
  }), f = i.documentId === t ? i.jobId : "", m = u.documentId === t ? u.jobId : "", b = n || f, [h, g] = _({
    jobId: "",
    documentId: ""
  }), v = h.jobId === b ? h.documentId : "", R = t || v, w = !!t && !b, [p, S] = _(null), k = (p == null ? void 0 : p.sessionIdentity) === r && p.documentId === R ? p : null, N = w || !!k, B = $((D) => {
    const I = `${D.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      g({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${D.revision || ""}`.trim() || `${Date.now()}`;
    S({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), c();
  }, []);
  O(() => {
    S((D) => D && D.sessionIdentity !== r ? null : D);
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
        g((I) => I.jobId === D.jobId && I.documentId === D.documentId ? I : { jobId: D.jobId, documentId: D.documentId });
        break;
      case "committed-source":
        S({
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
    rejectedDocumentJobId: m,
    sessionJobId: b,
    resolvedJobDocument: h,
    setResolvedJobDocument: g,
    jobDocumentId: v,
    documentId: R,
    sourceOnly: w,
    committedDocumentSource: p,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: k,
    sourceViewOnly: N,
    refreshCommittedDocument: B,
    applyIdentityEvent: C
  };
}
function Gn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function _a(e) {
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
function Kn(e, t) {
  return ma(Zt(e, t));
}
function La(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ca(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !La(a, t))
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
        type: fa.progress,
        stage: n,
        percent: e,
        text: t
      },
      Fr.messageTargetOrigin()
    );
  } catch {
  }
}
function At(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Qt({ percent: t, text: n, stage: r });
}
function Da(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = _(null), [l, u] = _(null), [d, f] = _(""), [m, b] = _(0), h = d === n ? c : null, g = d === n ? l : null, v = Gn(h), R = bn(v), w = $(() => {
    b((C) => C + 1);
  }, []), p = $((C) => {
    i(C.jobPayload), u(C.manifestPayload), f(C.sessionIdentity);
  }, []), S = $((C) => {
    i(null), u(null), f(C);
  }, []), k = A(""), N = A(""), B = $(async () => {
    const C = o.current;
    if (!C || k.current === C) return;
    const D = xt().loadJobPayload;
    if (typeof D != "function") return;
    const I = a.current.value;
    k.current = C;
    try {
      const T = await D(C);
      if (s.current || a.current.value !== I || o.current !== C || !T || typeof T != "object")
        return;
      const E = Gn(T);
      i(T), f(r.current), E === "succeeded" && N.current !== C && (N.current = C, b((M) => M + 1));
    } catch {
    } finally {
      k.current === C && (k.current = "");
    }
  }, []);
  return O(() => {
    N.current = "";
  }, [n]), O(() => {
    if (!t || R || !h) return;
    const C = window.setInterval(() => {
      document.visibilityState !== "hidden" && B();
    }, 1e3);
    return () => window.clearInterval(C);
  }, [R, B, h, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: f,
    scopedJobPayload: h,
    scopedManifestPayload: g,
    jobStatus: v,
    jobTerminal: R,
    jobRefreshRevision: m,
    refreshJobArtifacts: w,
    refreshJobStatus: B,
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
function za(e, t) {
  e(t), en(t);
}
function xa(e) {
  const [t, n] = _(e ? "source" : "compare"), r = $((a) => {
    e && a !== "source" || (n(a), en(a));
  }, [e]), o = $((a) => {
    za(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), en(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Zn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Oa(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Zn(n.active_job_id),
    activeVersionId: Zn(n.active_version_id)
  };
}
function Fa(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function $a(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function ja(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ba = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ua(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ba.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
function Ha(e) {
  return e ? { data: e.data.slice() } : null;
}
const Wa = 2, Se = /* @__PURE__ */ new Map();
function tn(e, t) {
  Se.delete(e), Se.set(e, t);
}
function Va(e) {
  if (Se.size < Wa) return;
  const t = Se.keys().next().value;
  t && Se.delete(t);
}
async function Ja(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function $r(e, t = gt().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Se.has(r)) {
    const c = Se.get(r);
    return tn(r, c), c;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const c = new Error(`读取 PDF 失败 (${o.status})`);
    c.status = o.status;
    const i = await Ja(o);
    throw i && (c.reason = i), c;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return Se.has(r) ? tn(r, s) : (Va(), Se.set(r, s)), s;
}
const qa = { file: null, loading: !1, error: "" }, Ga = { file: null, loading: !0, error: "" };
function Ka(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if (O(() => {
    if (t || !n) return;
    const s = Se.get(n);
    if (s) {
      tn(n, s);
      return;
    }
    const c = new AbortController();
    return $r(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return qa;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Se.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ga;
}
function Za(e) {
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
  At(s, r, n, "download");
  const c = await $r(t, gt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (At(s, o, n, "download"), c);
}
async function Ya(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  At(o, 25, "正在下载 PDF…", "download");
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
function Xa(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Qa({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Wo,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Xa(o.href, t, a)), !0);
}
const Rt = {
  regions: null,
  metadata: null
};
function es(e) {
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
    switchSessionMode: m,
    jobRefreshRevision: b,
    sessionEpochRef: h,
    closingRef: g,
    activeLoadAbortRef: v
  } = e, [R, w] = _(""), [p, S] = _(""), [k, N] = _(null), [B, C] = _(null), [D, I] = _(!1), [T, E] = _(""), [M, j] = _([]), [U, W] = _(!1), [V, Q] = _(() => ({
    source: null,
    translated: null
  })), [z, Y] = _(
    Rt
  ), [ne, ee] = _({
    loading: !0,
    percent: 4,
    text: Ee.boot,
    stage: "progress",
    failed: !1
  });
  return O(() => {
    const oe = new AbortController(), pe = h.current.value, P = Za({
      sessionEpochRef: h,
      closingRef: g,
      abort: oe,
      sessionEpoch: pe
    });
    v.current = oe;
    const x = xt();
    if (g.current)
      return oe.abort(), () => {
        v.current === oe && (v.current = null);
      };
    let ae = !1;
    function me(re, de) {
      P.markFailed(), W(!0), ee({
        loading: !1,
        percent: 100,
        text: re,
        stage: "failed",
        failed: !0
      }), Qt({ percent: 100, text: de, stage: "failed" });
    }
    function ge() {
      I(!0), ae || W(!0), ee({
        loading: !1,
        percent: 100,
        text: Ee.ready,
        stage: "ready",
        failed: !1
      }), Qt({ percent: 100, text: Ee.ready, stage: "ready" });
    }
    function xe() {
      return l != null && l.documentId ? Kn(
        l.documentId,
        l.revision
      ) : ua() ? da : x.resolveResourceUrl(Zt(r));
    }
    async function ye() {
      var ce;
      let re = { activeJobId: "", activeVersionId: "" };
      try {
        const le = await ((ce = x.fetchDocument) == null ? void 0 : ce.call(x, r));
        le && (re = Oa(le));
      } catch {
      }
      const de = Fa({
        link: re,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (de.kind === "follow-active-job") {
        if (P.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: de.jobId
        }), de.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: de.activeVersionId,
          sessionIdentity: i
        }), m("source")) : m("compare");
        return;
      }
      if (de.kind === "open-committed-source") {
        if (P.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: de.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const be = xe();
      if (P.isInactive()) return;
      w(be), S(""), E(""), f(i);
      const ie = await nn({
        url: be,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: P,
        setBoot: ee
      });
      if (!P.isInactive()) {
        if (!ie) {
          me("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        N(ie), ge();
      }
    }
    async function _e() {
      var q;
      const re = !l, de = !!(re && x.loadSessionSnapshot && x.loadReaderOptionalArtifacts), be = de ? x.loadReaderOptionalArtifacts(t) : null, ie = await ((q = x.loadSessionSnapshot) == null ? void 0 : q.call(x, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: re && !de
      })), ce = ie ? {
        jobPayload: ie.sourcePayload,
        manifestPayload: ie.manifestPayload,
        readerMetadata: ie.readerMetadata,
        regionsPayload: ie.regions,
        readerErrors: ie.readerErrors
      } : await x.loadReaderPayload(t, {
        includeOptionalArtifacts: re
      });
      if (P.isInactive()) return;
      let le = null;
      if (n && !r)
        if (ie && ie.linkedDocument !== void 0)
          le = ie.linkedDocument;
        else {
          try {
            le = await x.fetchDocumentByJobId(qn, t);
          } catch {
          }
          if (P.isInactive()) return;
        }
      const qe = _a(ce.jobPayload) || `${(le == null ? void 0 : le.document_id) || ""}`.trim();
      qe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: qe
      });
      const Te = $a({
        payloadDocumentId: qe,
        linkedActiveJobId: `${(le == null ? void 0 : le.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(le == null ? void 0 : le.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Te.kind === "restore-committed-source") {
        if (P.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Te.documentId,
          revision: Te.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const Le = x.resolveReaderSourcePdf(ce.manifestPayload), st = x.resolveReaderTranslatedPdfUrl(ce.jobPayload, ce.manifestPayload), $t = typeof Le == "string" ? Le : x.resolveReaderArtifactUrl(Le), Pt = r || qe, it = l != null && l.documentId ? Kn(
        l.documentId,
        l.revision
      ) : $t || (Pt ? x.resolveResourceUrl(Zt(Pt)) : ""), ct = l ? "" : st || "";
      w(it || ""), S(ct), E(Ca(ce.jobPayload, t)), d({
        jobPayload: ce.jobPayload || null,
        manifestPayload: ce.manifestPayload || null,
        sessionIdentity: i
      });
      const L = () => Ya({
        sourceFinal: it || "",
        translatedFinal: ct,
        fence: P,
        setBoot: ee
      }), J = !!(it || ct), H = be && J ? L() : null;
      H == null || H.catch(() => {
      });
      const G = (Z) => {
        P.isInactive() || (j(l ? [] : Fo(Z.regionsPayload)), Q(l ? { source: null, translated: null } : $o(Z.readerMetadata)), Y(l ? Rt : Z.readerErrors ?? Rt), W(!0));
      };
      if (be ? (ae = !0, be.then(G)) : G(ce), !J) {
        me(Ee.failed, Ee.failed);
        return;
      }
      const te = await (H ?? L());
      if (te.status !== "inactive") {
        if (te.status === "incomplete") {
          me("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        N(te.sourceBytes), C(te.translatedBytes), ge();
      }
    }
    async function Ie() {
      I(!1), N(null), C(null), j([]), W(!1), Q({ source: null, translated: null }), Y(Rt), At(ee, 8, Ee.metadata, "metadata");
      try {
        if (s) {
          await ye();
          return;
        }
        if (!t) {
          me(Ee.failed, Ee.failed);
          return;
        }
        await _e();
      } catch (re) {
        if (P.isClosedOrStale() || (re == null ? void 0 : re.name) === "AbortError") return;
        P.markFailed();
        const de = Number(re == null ? void 0 : re.status), be = `${(re == null ? void 0 : re.reason) || ""}`, ie = Ua({ status: de, reason: be, sessionJobId: t });
        if (ie && (await Qa({
          apiPrefix: qn,
          documentId: ie,
          expiredJobId: t
        }) || P.isClosedOrStale()))
          return;
        if (ja({
          status: de,
          reason: be,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const ce = re instanceof Error ? re.message : Ee.failed;
        me(ce, ce);
      }
    }
    return Ie(), () => {
      oe.abort(), v.current === oe && (v.current = null);
    };
  }, [t, r, o, a, s, c, l, b, n, i, u, d, f, m]), {
    sourceUrl: R,
    translatedUrl: p,
    sourceFile: k,
    translatedFile: B,
    assetsReady: D,
    title: T,
    regions: M,
    regionsSettled: U,
    readerMetadata: V,
    readerErrors: z,
    boot: ne
  };
}
function ts() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Aa(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = A(a), i = A(""), l = A(""), u = A(() => {
  }), d = $(() => u.current(), []), f = Na({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: c,
    documentIdRef: i,
    sessionJobIdRef: l,
    switchToSourceMode: d
  }), {
    sessionJobId: m,
    documentId: b,
    sourceOnly: h,
    sourceViewOnly: g
  } = f, { mode: v, setMode: R, switchSessionMode: w } = xa(g);
  u.current = () => {
    w("source");
  }, c.current = a, i.current = b, l.current = m;
  const p = Da({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: k,
    jobStatus: N,
    jobTerminal: B,
    jobRefreshRevision: C,
    refreshJobArtifacts: D,
    refreshJobStatus: I
  } = p, T = es({
    sessionJobId: m,
    jobId: r,
    routeDocumentId: o,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: a,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: p.publishPayload,
    clearPayload: p.clearPayload,
    switchSessionMode: w,
    jobRefreshRevision: C,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = $(() => {
    var j;
    e.current = !0, (j = t.current) == null || j.abort();
  }, []), M = K(
    () => ({
      fetchProtected: xt().fetchProtected,
      jobId: m,
      jobPayload: S,
      manifestPayload: k,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: g
    }),
    [m, S, k, T.sourceUrl, T.translatedUrl, g]
  );
  return {
    jobId: m,
    jobStatus: N,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: B,
    documentId: b,
    sessionIdentity: a,
    sourceOnly: h,
    mode: v,
    setMode: R,
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
    download: M,
    refreshJobArtifacts: D,
    refreshJobStatus: I,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: E
  };
}
const ns = 160, rs = 8, os = 0;
function as() {
  const e = A(null), [t, n] = _(null), [r, o] = _(os), a = $((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < ns || o((u) => Math.abs(u - l) < rs ? u : l);
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
function ss(e) {
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
const Bt = { source: 0, translated: 0 };
function is(e, t) {
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
  const [d, f] = _(() => ({
    identity: l,
    pages: Bt
  })), [m, b] = _(() => ({ identity: l, tick: 0 })), h = d.identity === l ? d.pages : Bt, g = m.identity === l ? m.tick : 0, v = ss({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: R } = v, w = $((I, T) => {
    u.current === l && f((E) => {
      const M = E.identity === l ? E.pages : Bt;
      return M[T] === I && E.identity === l ? E : {
        identity: l,
        pages: { ...M, [T]: I }
      };
    });
  }, [l]), p = A(null), S = $(() => {
    p.current && clearTimeout(p.current);
    const I = l;
    p.current = setTimeout(() => {
      p.current = null, u.current === I && b((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  O(() => (p.current && (clearTimeout(p.current), p.current = null), f((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), b((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    p.current && (clearTimeout(p.current), p.current = null);
  }), [l]);
  const k = K(
    () => Math.max(h.source, h.translated),
    [h]
  ), N = R === "translated" ? h.translated : h.source || h.translated, B = t == null ? void 0 : t.userZoom, C = t == null ? void 0 : t.shellWidth, D = `${l}-${g}-${B}-${n}-${h.source}-${h.translated}-${C}`;
  return {
    ...v,
    numPagesByPane: h,
    hudNumPages: k,
    primaryNumPages: N,
    metricsTick: g,
    onNumPages: w,
    onMetrics: S,
    rowSyncRevision: D
  };
}
const Be = "data-reader-page", et = "data-reader-pane", Sn = "data-natural-height", cs = "reader-react-root", ls = "reader-react-grid", us = "reader-react-scroll-shell", ds = "reader-react-pdf-pane", jr = "reader-react-pdf-page", Nt = "reader-react-pdf-page-placeholder", wn = "reader-react-pdf-page-slot";
function _t(e, t) {
  const n = e != null ? `[${Be}="${e}"]` : `[${Be}]`;
  return t ? `${n}[${et}="${t}"]` : n;
}
function fs() {
  return `.${wn}[${Be}]`;
}
function Pn(e) {
  return Number(e.getAttribute(Be));
}
const Br = 0.25, tt = 1, ms = 0.05, wt = 0.5, hs = 16, ps = 8, gs = 720;
function je() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Ur(e) {
  return Number.isFinite(e) && e < gs;
}
function Ze(e, t = Number.POSITIVE_INFINITY) {
  return Ur(t) && (e === "source" || e === "translated") ? tt : wt;
}
function Ot(e) {
  return Number.isFinite(e) ? Math.min(tt, Math.max(Br, e)) : wt;
}
function nt(e, t) {
  const n = Ot(Number(e) + t * ms);
  return Math.round(n * 100) / 100;
}
function Hr(e) {
  return Math.round(Ot(e) * 100);
}
function bs(e) {
  const n = (Number(e) || 0) - hs - ps;
  return Math.max(160, Math.floor(n));
}
function ys(e, t = wt) {
  const n = Ot(t);
  return bs((Number(e) || 0) * n);
}
function vs(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${et}]`)
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
const Ss = 8;
function ws(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Ss ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Wr = 200, Vr = [
  "markdown"
], Ps = Vr;
function Jr(e) {
  return Ps.includes(e);
}
const Rs = "retainpdf:reader:view:v1:", Yn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Is = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function qr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function rn(e) {
  return `${e || ""}`.trim();
}
function Ts({
  documentId: e,
  jobId: t
}) {
  const n = rn(e);
  if (n) return `document:${n}`;
  const r = rn(t);
  return r ? `job:${r}` : "";
}
function Gr(e) {
  const t = rn(e);
  return t ? `${Rs}${t}` : "";
}
function Es(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ks(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Yn.has(t) || !Yn.has(n) || t === n))
    return { left: t, right: n };
}
function Ms(e) {
  return e === null ? null : Jr(e) ? e : void 0;
}
function As(e) {
  return Is.has(e) ? e : void 0;
}
function Kr(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Es(t.anchor), r = Number(t.zoom), o = As(t.mode), a = ks(t.splitLayout), s = Ms(t.assistantPanel);
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
function Re(e, t = qr()) {
  const n = Gr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Kr(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Ft(e, t, n = qr()) {
  const r = Gr(e);
  if (!r || !n) return null;
  const o = Re(e, n), a = Kr({
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
function Ns(e, t, n = "") {
  var f;
  const [r, o] = _(() => {
    var m;
    return ((m = Re(n)) == null ? void 0 : m.zoom) ?? Ze(e, je());
  }), a = A(r), s = A(n);
  a.current = r;
  const c = A(1), i = A(((f = Re(n)) == null ? void 0 : f.zoom) !== void 0);
  O(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Re(n)) == null ? void 0 : h.zoom;
    i.current = m !== void 0;
    const b = m ?? Ze(e, je());
    c.current = 1, a.current = b, o(b);
  }, [e, n]), O(() => {
    if (i.current) return;
    const m = Ze(e, je()), b = a.current;
    Math.abs(m - b) < 5e-4 || (c.current = 1, a.current = m, o(m));
  }, [e]);
  const l = $((m) => {
    const b = Ot(m), h = a.current;
    Math.abs(b - h) < 5e-4 || (c.current = b / (h || 1), i.current = !0, Ft(s.current, { zoom: b }), o(b));
  }, []), u = $((m) => {
    l(nt(a.current, m));
  }, [l]), d = $((m) => {
    l(Ze(m));
  }, [l]);
  return Ne(() => {
    const m = c.current;
    Math.abs(m - 1) < 1e-3 || (c.current = 1, vs(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function _s(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: $((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const Rn = 48;
function Zr(e, t = Rn) {
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
  const o = Pn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function kt(e, t, n = Rn) {
  if (!e)
    return null;
  const r = _t(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Zr(e, n), c = Yr(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function bt(e, t, n = "auto", r, o = Rn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(_t(a, r))), c || (c = e.querySelector(_t(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), f = Math.max(0, d + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - f) >= 1 && (e.scrollTop = f) : e.scrollTo({ top: f, behavior: n }), !0;
}
function Ls(e, t, n = "smooth", r) {
  return bt(
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
    bt(
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
function Cs(e, t, n) {
  return on(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Lt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function ve(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Ds(e, t, n = !0, r = "", o) {
  const [a, s] = _(1);
  return O(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, u = 0;
    const d = _t(void 0, o), f = () => {
      if (i) return;
      const h = Array.from(c.querySelectorAll(d));
      if (!h.length)
        return;
      const g = Zr(c), v = Yr(h, g);
      v && s(v.page);
    }, m = () => {
      i || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, f();
      }));
    }, b = () => {
      if (i) return;
      if (!Array.from(c.querySelectorAll(d)).length) {
        l = setTimeout(b, 120);
        return;
      }
      f(), c.addEventListener("scroll", m, { passive: !0 });
    };
    return b(), () => {
      i = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), c.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const zs = `canvas, .react-pdf__Page, .${jr}, .${Nt}`, Xn = /* @__PURE__ */ new WeakMap();
function xs(e) {
  const t = Number(e.getAttribute(Sn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Xn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(zs), Xn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Os(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Fs(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(fs()).forEach((r) => {
    const o = Pn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = xs(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function $s(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = A(o), c = A(r);
  return c.current = r, Ne(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
    const f = () => {
      var S;
      if (i) return;
      const w = e.current;
      if (!w) return;
      const p = Fs(w);
      Os(s.current, p) || (s.current = p, a(p)), u && !d && (d = !0, (S = c.current) == null || S.call(c));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    m();
    const b = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), g = window.setTimeout(m, 700), v = e.current;
    let R = null;
    return v && typeof ResizeObserver < "u" && (R = new ResizeObserver(() => m()), R.observe(v)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(b), window.clearTimeout(h), window.clearTimeout(g), R == null || R.disconnect();
    };
  }, [e, t, n]), o;
}
const js = [0, 48, 140, 320, 560], Bs = 700, Us = [80, 200, 400], Hs = 500, Ws = 50, Vs = /* @__PURE__ */ new Set([
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
]), Js = 180, Qn = [0, 48, 140, 320, 700, 1200];
function qs(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = A(
    ((T = Re(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), i = A(null), l = A(!1), u = A(r), d = A(null), f = A(null), m = A(null), b = A(null), h = A(a), g = A(""), v = A(n);
  v.current = n;
  const R = $(() => {
    var E;
    (E = d.current) == null || E.call(d), d.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), w = $(() => {
    !l.current && i.current == null || (R(), m.current != null && (clearTimeout(m.current), m.current = null), i.current = null, l.current = !1);
  }, [R]), p = $((E = !1) => {
    b.current != null && (clearTimeout(b.current), b.current = null);
    const M = () => {
      b.current = null, Ft(h.current, {
        anchor: ve(c.current)
      });
    };
    E ? M() : b.current = setTimeout(M, Js);
  }, []), S = $((E) => {
    c.current = ve(E), i.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Ws);
  }, []);
  O(() => {
    if (!o)
      return;
    let E = !1, M = null, j = null, U = null;
    const W = () => {
      if (E) return;
      const V = e.current;
      if (!V) {
        U = setTimeout(W, 50);
        return;
      }
      M = V, j = () => {
        if (l.current)
          return;
        const Q = kt(M, v.current);
        Q && (c.current = Q, p());
      }, M.addEventListener("scroll", j, { passive: !0 }), l.current || j();
    };
    return W(), () => {
      E = !0, U != null && clearTimeout(U), M && j && M.removeEventListener("scroll", j);
    };
  }, [o, r, n, e, p]), O(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const M = (j) => {
      j.metaKey || j.ctrlKey || j.altKey || Vs.has(j.key) && w();
    };
    return E.addEventListener("wheel", w, { passive: !0 }), E.addEventListener("touchmove", w, { passive: !0 }), window.addEventListener("keydown", M), () => {
      E.removeEventListener("wheel", w), E.removeEventListener("touchmove", w), window.removeEventListener("keydown", M);
    };
  }, [o, e, w]), Ne(() => {
    var M;
    if (h.current === a) return;
    p(!0), R(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, g.current = "";
    const E = (M = Re(a)) == null ? void 0 : M.anchor;
    c.current = E ? ve(E) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, p, R]), O(() => {
    var M;
    if (!o || !s || !a || g.current === a) return;
    g.current = a;
    const E = ve(
      ((M = Re(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = E, i.current = E, l.current = !0, R(), d.current = on(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: v.current,
        delaysMs: Qn,
        onDone: () => S(E)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(E);
    }, Math.max(...Qn) + 160), () => R();
  }, [o, s, a, e, S, R]), O(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, R();
      return;
    }
    const E = i.current ? ve(i.current) : ve(c.current);
    return l.current = !0, i.current = E, c.current = E, R(), d.current = on(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: js,
        onDone: () => S(E)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(E);
    }, Bs), () => {
      R();
    };
  }, [r, o, n, e, S, R]), O(() => () => {
    R(), m.current != null && (clearTimeout(m.current), m.current = null), p(!0);
  }, [R, p]);
  const k = $(() => {
    const E = kt(
      e.current,
      v.current
    );
    return ve(E || c.current);
  }, [e]), N = $(() => {
    l.current = !0;
    const E = kt(
      e.current,
      v.current
    ), M = ve(E ?? c.current);
    return c.current = M, i.current = M, p(), M;
  }, [e, p]), B = $((E, M, j) => {
    const U = j || v.current, W = Lt(E, M || 1), V = { page: W, fraction: 0 };
    c.current = V, l.current = !0, i.current = V, p(), R(), Ls(e.current, W, "smooth", U), d.current = Cs(
      () => e.current,
      W,
      {
        behavior: "auto",
        pane: U,
        delaysMs: Us,
        onDone: () => S(V)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(V);
    }, Hs);
  }, [e, S, R, p]), C = $(() => ve(c.current), []), D = $(() => l.current, []), I = $(() => {
    if (!l.current || !i.current)
      return;
    const E = ve(i.current);
    bt(
      e.current,
      E,
      "auto",
      v.current
    );
  }, [e]);
  return {
    lockFromShell: k,
    beginModeSwitch: N,
    goToPage: B,
    getAnchor: C,
    isRestoring: D,
    repinIfRestoring: I
  };
}
function Gs(e, t) {
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
const Ks = [0, 80, 200, 400, 800], Zs = 120, Ys = 400;
function Xs(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l, regionsSettled: u = !0 } = e, d = A(a);
  d.current = a;
  const f = A(s);
  f.current = s;
  const m = A(c);
  m.current = c;
  const b = A(n);
  b.current = n, O(() => {
    var p, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = wa(), g = Gs(h, f.current);
    if (g == null && (h != null && h.blockId) && !u) return;
    const v = Xr(h, g, { jobId: i, documentId: l });
    if (t.current === v)
      return;
    if (g == null) {
      t.current = v, (p = b.current) == null || p.call(b);
      return;
    }
    t.current = v, h && ((S = m.current) == null || S.call(m, h, g));
    const R = [];
    let w = 0;
    for (const k of Ks)
      w = Math.max(w, k), R.push(
        setTimeout(() => {
          d.current(g);
        }, k)
      );
    return R.push(
      setTimeout(() => {
        var k;
        (k = b.current) == null || k.call(b);
      }, w + Zs)
    ), () => {
      for (const k of R) clearTimeout(k);
    };
  }, [r, o, i, l, t, u]);
}
function Qs(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function ei(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Ys,
    jobId: c,
    documentId: i,
    applyReaderSearch: l
  } = e, u = A(a);
  u.current = a;
  const d = A(l);
  d.current = l;
  const f = A(0);
  O(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const m = setTimeout(() => {
      var v;
      const b = ((v = globalThis.location) == null ? void 0 : v.search) || "", h = Oo(b, o, u.current);
      if (f.current = o, h === null) return;
      const g = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Xr(
        { blockId: g },
        o,
        { jobId: c, documentId: i }
      ), (d.current || Qs)(h);
    }, s);
    return () => clearTimeout(m);
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
function ti(e) {
  const t = A(""), [n, r] = _(!1), o = $(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Xs(a, t, o), ei(e, t, n);
}
const ut = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function ni(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function er(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Qr(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = er(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = er(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function ri(e, t, n) {
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
function oi(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const tr = [250, 500, 1e3, 2e3, 4e3], Ut = [80, 160, 320, 640, 1e3, 1500], nr = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
function In(e) {
  return Vo(e) ? `${e.code || ""}`.trim() : "";
}
function It(e, t) {
  const n = In(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ai(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Qr(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = Jo(
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
    const c = Ut[Math.min(s, Ut.length - 1)];
    if (await an(c, r), s >= Ut.length + 2) throw a;
  }
}
function si({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _(ut), s = A(o), c = A("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = bn(l) ? l : "";
  return O(() => {
    if (!n || !i) {
      c.current = "", s.current = ut, a(ut);
      return;
    }
    const d = r === void 0 ? ha() : r, f = c.current === i;
    if (c.current = i, !d) {
      const w = {
        ...f ? s.current : ut,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = w, a(w);
      return;
    }
    const m = new AbortController();
    let b = !1;
    const h = {
      ...f ? s.current : ut,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const g = (w) => {
      m.signal.aborted || a((p) => {
        const S = w(p);
        return s.current = S, S;
      });
    }, v = async () => {
      let w = 0;
      for (; !m.signal.aborted; )
        try {
          const p = await d.fetchLayout(i, { signal: m.signal });
          b = !0, g((S) => ({
            ...S,
            layoutByPage: ni(p),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError") return;
          const S = In(p);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            g((N) => ({
              ...N,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: It(p, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            g((N) => ({
              ...N,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          g((N) => ({
            ...N,
            connection: "connecting",
            jobStatus: l,
            error: It(p, "正在等待 OCR 版面数据")
          })), await an(tr[Math.min(w, tr.length - 1)], m.signal).catch(() => {
          }), w += 1;
        }
    };
    return (async () => {
      if (await v(), !b || m.signal.aborted) return;
      let w = 0;
      for (; !m.signal.aborted; ) {
        u || g((p) => ({
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
            signal: m.signal,
            onEvent: async (p) => {
              if (p.seq <= s.current.lastSeq) return;
              let S;
              try {
                S = await ai(
                  i,
                  p,
                  s.current,
                  m.signal,
                  d
                );
              } catch (k) {
                if ((k == null ? void 0 : k.name) === "AbortError" || m.signal.aborted) throw k;
                g((N) => ({
                  ...N,
                  lastSeq: Math.max(N.lastSeq, p.seq),
                  error: It(k, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              g((k) => {
                const N = ri(k, p, S);
                return u ? {
                  ...N,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...N,
                  jobStatus: l
                };
              }), w = 0;
            }
          });
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError" || m.signal.aborted) return;
          g((S) => ({
            ...S,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: It(p, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          g((p) => ({
            ...p,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await an(nr[Math.min(w, nr.length - 1)], m.signal).catch(() => {
        }), w += 1;
      }
    })(), () => m.abort();
  }, [n, r, i, u]), o;
}
function ii(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, c = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    c && i > 0 && o.set(c, i);
  }
  return o;
}
function ci(e, t = !0) {
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = xt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((c) => {
      !s && c && r(ii(c));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const li = /* @__PURE__ */ new Set(), ui = () => () => {
}, di = () => li;
function fi() {
  const e = Sa(), t = (e == null ? void 0 : e.get) ?? di;
  return ot((e == null ? void 0 : e.subscribe) ?? ui, t, t);
}
const mi = 4500;
function hi(e) {
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
const pi = /* @__PURE__ */ new Set(["book", "translate"]);
function eo(e) {
  return !!(e.jobId && e.sourceUrl && pi.has(e.workflow));
}
function gi(e) {
  return !!(eo(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function bi() {
  const e = ts(), t = eo({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = gi({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !bn(o) && (r.current.running = !0);
  const a = si({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = as(), u = ci(e.jobId, !e.sourceOnly), d = fi(), f = Ts({
    documentId: e.documentId,
    jobId: e.jobId
  }), m = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: b, onZoomChange: h } = Ns(e.mode, s, f), g = is(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: b, shellWidth: i, identityKey: m }
  ), {
    beginModeSwitch: v,
    goToPage: R,
    repinIfRestoring: w
  } = qs(s, {
    primaryPane: g.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: g.primaryNumPages > 0
  });
  O(() => {
    w();
  }, [i, w]);
  const p = $s(
    s,
    g.compareMode,
    g.rowSyncRevision,
    w
  ), S = Ds(
    s,
    g.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${b}-${g.metricsTick}`,
    g.primaryPane
  ), k = $((z, Y) => {
    var ee, oe;
    const ne = Math.max(
      Number(g.hudNumPages) || 0,
      Number(g.primaryNumPages) || 0,
      Number((ee = g.numPagesByPane) == null ? void 0 : ee.source) || 0,
      Number((oe = g.numPagesByPane) == null ? void 0 : oe.translated) || 0
    );
    R(z, ne, Y);
  }, [R, g.hudNumPages, g.primaryNumPages, g.numPagesByPane]), [N, B] = _(null), C = A(null), D = $((z) => {
    C.current && clearTimeout(C.current), B(z), z && (C.current = setTimeout(() => B(null), mi));
  }, []);
  O(() => () => {
    C.current && clearTimeout(C.current);
  }, []);
  const I = $((z) => {
    const Y = jt(e.regions, z);
    return Y ? Wn(Y, g.primaryPane).page : null;
  }, [e.regions, g.primaryPane]), T = $((z, Y) => {
    const ne = Y || g.primaryPane, ee = typeof z == "object" && z ? `${z.block_id || ""}`.trim() : "", oe = typeof z == "object" && z ? `${z.image_url || ""}`.trim() : "", pe = typeof z == "object" && z ? z.page_idx != null ? Number(z.page_idx) + 1 : z.page != null ? Number(z.page) : null : typeof z == "number" ? z + 1 : null, P = jo(e.regions, oe, pe) || jt(e.regions, ee) || (typeof z == "object" ? Bo(e.regions, z) : null);
    let x = P ? Wn(P, ne).page : null;
    x == null && (x = hi(z)), !(x == null || x < 1) && (D(P), k(x, ne));
  }, [D, k, g.primaryPane, e.regions]);
  ti({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: g.hudNumPages || 0,
    currentPage: S,
    goToPage: k,
    resolveBlockPage: I,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (z) => {
      D(jt(e.regions, z.blockId));
    }
  });
  const E = !e.boot.loading && !e.boot.failed && e.assetsReady, M = Number(g.hudNumPages) || 0;
  O(() => {
    var z;
    E && ((z = ba()) == null || z.report(S >= 1 ? S - 1 : null, M >= 1 ? M : null));
  }, [E, S, M]), O(() => {
    const z = va();
    if (!(!z || !E || !e.jobId))
      return z.subscribe(({ jobId: Y, pageIdx: ne, blockId: ee }) => Y !== e.jobId ? !1 : (T({ ...ne != null ? { page_idx: ne } : {}, ...ee ? { block_id: ee } : {} }), !0));
  }, [E, e.jobId, T]);
  const { setModeKeepingPage: j } = _s({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  O(() => {
    D(null);
  }, [m, D]);
  const U = !e.boot.loading && !e.boot.failed, W = K(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), V = K(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), Q = K(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: b,
    onZoomChange: h,
    shell: W,
    panes: g,
    sessionFiles: V,
    rowHeights: p,
    goToPage: k,
    activeRegion: N,
    jumpToAnchor: T,
    setModeKeepingPage: j,
    download: e.download,
    showHud: U,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u,
    quotedBlocks: d
  }), [e, W, g, V, p, k, N, T, j, U, b, h, f, a, n, u, d]);
  return K(() => ({
    ...Q,
    currentPage: S
  }), [Q, S]);
}
const yi = [
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
], vi = [
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
function Si(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of yi)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function wi(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Pi = ".reader-notes-panel";
function Ri(e) {
  return e instanceof Element ? !!e.closest(Pi) : !1;
}
function Ii(e) {
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
  O(() => {
    if (!l)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || wi(d.target) || Ri(d.target))
        return;
      const f = d.key, m = Si(f);
      if (m) {
        if (m.mode) {
          if (n && m.mode !== "source")
            return;
          d.preventDefault(), r(m.mode);
          return;
        }
        if (!(m.requiresPages && c <= 0))
          switch (d.preventDefault(), m.action) {
            case "zoom-in":
              a(nt(o, 1));
              return;
            case "zoom-out":
              a(nt(o, -1));
              return;
            case "zoom-reset":
              a(Ze(t, je()));
              return;
            case "next-page":
              i(Lt(s + 1, c));
              return;
            case "prev-page":
              i(Lt(s - 1, c));
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
const Ti = "retainpdf:soft-reader-close";
function Tn(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed") || ""}`.trim();
  } catch {
    return "";
  }
}
function Ei(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed_pane") || ""}`.trim();
  } catch {
    return "";
  }
}
function ki() {
  const e = new URL("./index.html", window.location.href), t = Tn();
  return t && e.searchParams.set("embed", t), e.href;
}
function Mi() {
  if (typeof window > "u" || window.self === window.top || Tn()) return !1;
  try {
    return window.parent.postMessage(
      { type: Ti },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ai(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Ni() {
  if (!(typeof window > "u") && !Mi()) {
    if (Ai(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(ki());
  }
}
function to({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ y("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function _i({ onBeforeClose: e } = {}) {
  return Ei() === "beside" ? null : /* @__PURE__ */ F(to, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Ni();
  }, children: [
    /* @__PURE__ */ y(vn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ y("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Li = { available: !1, open: !1, title: null }, Ci = () => () => {
}, Di = () => Li;
function zi() {
  const e = ga(), t = (e == null ? void 0 : e.getState) ?? Di, n = ot((e == null ? void 0 : e.subscribe) ?? Ci, t, t);
  if (!e || !n.available) return null;
  const r = n.open ? `收起摘录${n.title ? `（摘到《${n.title}》）` : ""}` : "摘录";
  return /* @__PURE__ */ y(to, { className: "reader-notes-toggle", label: r, pressed: n.open, onClick: e.toggle, children: /* @__PURE__ */ y(Go, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }) });
}
let rr = !1;
function xi() {
  if (rr)
    return;
  const e = gt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (oa.GlobalWorkerOptions.workerSrc = e, rr = !0);
}
const Oi = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Fi(e, t, n) {
  return e.flatMap((r) => {
    if (!Oi.has(Dr(r.region))) return [];
    const o = yn(r, t, n);
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
async function $i(e) {
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
const ji = "reader-text-hover-copy", Bi = "reader-text-hover-id", no = "reader-text-hover-tools", Ui = "reader-text-hover-quote";
function Hi(e) {
  const { region: t } = e.highlight, n = `${t.translated.text || ""}`.trim();
  return {
    itemId: e.itemId,
    pageIdx: Math.max(0, t.source.page - 1),
    sourceText: `${t.source.text || ""}`,
    translatedText: n ? t.translated.text : null
  };
}
function Ht({
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
const ro = 26, Ct = 190;
function oo(e, t = Ct) {
  return e.height < ro * 2 || e.width < t;
}
const Wi = 72;
function Vi({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = _("idle"), [a, s] = _("idle"), [c, i] = _("idle"), l = A([]), u = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    o("idle"), s("idle"), i("idle");
    const w = l.current;
    return () => {
      w.forEach((p) => window.clearTimeout(p)), l.current = [];
    };
  }, [u]), !e) return null;
  const d = Uo(e.highlight.region, t), f = Dr(e.highlight.region), m = (w, p) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const k = await $i(w);
    p(k ? "copied" : "failed"), l.current.push(window.setTimeout(() => p("idle"), 1200));
  }, b = f === "formula" ? "复制 LaTeX" : "复制", h = pa(), g = !!(h != null && h.available()), v = (w) => {
    w.preventDefault(), w.stopPropagation();
    const p = !!(h != null && h.send(Hi(e)));
    i(p ? "copied" : "failed"), l.current.push(window.setTimeout(() => i("idle"), 1200));
  }, R = oo(e.rect, g ? Ct + Wi : Ct);
  return /* @__PURE__ */ y("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ y(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": f,
      style: e.rect,
      children: /* @__PURE__ */ F(
        "div",
        {
          className: no,
          "data-placement": R ? "outside" : "inside",
          children: [
            Tn() === "studio" ? null : /* @__PURE__ */ y(
              Ht,
              {
                className: Bi,
                state: a,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: m(e.itemId, s),
                children: a === "copied" ? "已复制编号" : e.itemId
              }
            ),
            t === "translated" && n > 0 ? /* @__PURE__ */ F("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            d ? /* @__PURE__ */ y(
              Ht,
              {
                className: ji,
                state: r,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: m(d, o),
                children: r === "copied" ? "已复制" : r === "failed" ? "复制失败" : b
              }
            ) : null,
            g ? /* @__PURE__ */ y(
              Ht,
              {
                className: Ui,
                state: c,
                label: "把这一段摘到笔记",
                title: "摘到笔记：这一段的译文（没翻译的放原文）放进正在写的笔记",
                onClick: v,
                children: c === "copied" ? "已摘" : c === "failed" ? "没摘上" : "摘到笔记"
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Ji(e, t) {
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
function qi(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = yn(
      Ji(e, a),
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
const Gi = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Ki = 256, dt = /* @__PURE__ */ new Map();
function Zi(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Yi(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ia(t, { bareLatex: !0 }), o = Zi(n), a = ca(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = dt.get(t);
  if (!s && (s = la(o, r), dt.set(t, s), dt.size > Ki)) {
    const c = dt.keys().next().value;
    c !== void 0 && dt.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Wt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Me(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Xi(e, t) {
  const n = e.typography, r = Me(t) || 1, o = Me(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Wt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Me(n == null ? void 0 : n.fit_min_font_size_pt), u = Me(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), m = o ? o * r : i, b = Me(n == null ? void 0 : n.leading_em), h = [
    Me(n == null ? void 0 : n.padding_top_pt) || 0,
    Me(n == null ? void 0 : n.padding_right_pt) || 0,
    Me(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Me(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((g) => g * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Gi,
    fontSizePx: Math.max(d, Math.min(f, m)),
    minFontSizePx: d,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: b ? 1 + b : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Wt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Wt(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Qi(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), c = (d) => {
    const f = s.get(d);
    if (f !== void 0) return f;
    const { width: m, height: b } = e(d), h = m <= t + 0.5 && b <= n + 0.5;
    return s.set(d, h), h;
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
const ec = 512, ft = /* @__PURE__ */ new Map();
let sn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  sn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  sn += 1;
}));
function tc(e, t, n, r) {
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
function nc({ item: e, pageScale: t }) {
  const n = A(null), r = K(
    () => Yi(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = K(
    () => Xi(e, t),
    [e, t]
  );
  O(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      d && a(f);
    }), () => {
      d = !1;
    };
  }, [r]), Ne(() => {
    const d = n.current;
    if (!d) return;
    const [f, m, b, h] = s.padding, g = Math.max(1, e.rect.width - h - m), v = Math.max(1, e.rect.height - f - b), R = tc(o, g, v, s);
    let w = ft.get(R);
    if (w === void 0 && (w = Qi(
      (p) => (d.style.fontSize = `${p}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      g,
      v,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), ft.set(R, w), ft.size > ec)) {
      const p = ft.keys().next().value;
      p !== void 0 && ft.delete(p);
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
function rc({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = K(
    () => qi(e, t, n, r),
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
        nc,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const oc = mn(rc), ao = hn(null), so = hn(null);
function ac({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ y(ao.Provider, { value: e, children: /* @__PURE__ */ y(so.Provider, { value: t, children: n }) });
}
function ze() {
  return pn(ao);
}
function io() {
  return pn(so);
}
const co = 1.414;
function sc({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  syncedMinHeight: a = 0,
  onMetrics: s,
  cachedAspect: c,
  onAspectChange: i,
  sentinelRef: l,
  regionHighlight: u = null,
  regionTargets: d = [],
  hoveredRegionId: f,
  onHoverRegion: m,
  liveTranslationLayout: b,
  liveTranslationPage: h,
  showLiveTranslation: g = r === "source"
}) {
  var oe, pe;
  const v = (oe = ze()) == null ? void 0 : oe.revisedBlocks, R = (pe = ze()) == null ? void 0 : pe.quotedBlocks, w = A(c ?? co), [p, S] = _(w.current);
  O(() => {
    c != null && Math.abs(c - w.current) >= 1e-3 && (w.current = c, S(c));
  }, [c]);
  const k = A(l);
  k.current = l;
  const N = A(null), B = A((P) => {
    var x;
    N.current = P, (x = k.current) == null || x.call(k, P);
  }).current, C = A(null), D = A(`${t}@${n}`);
  Ne(() => {
    const P = `${t}@${n}`;
    D.current !== P && (D.current = P, o && cc(N.current, C.current));
  }, [o, n, t]), O(() => {
    o || Vt(C.current);
  }, [o]), O(() => () => Vt(C.current), []);
  const I = Math.max(120, Math.floor(t * p)), T = Math.max(I, Math.ceil(a || 0)), E = yn(u, t, I), M = K(
    () => Fi(d, t, I),
    [I, d, t]
  ), [j, U] = _(null), W = typeof m == "function", V = W ? f ?? null : j, Q = (P) => {
    W ? P !== (f ?? null) && (m == null || m(P)) : U((x) => x === P ? x : P);
  }, z = K(
    () => M.find((P) => P.itemId === V) || null,
    [V, M]
  ), Y = (P) => {
    var ye, _e;
    if (P.pointerType === "touch") return;
    if (P.buttons !== 0) {
      Q(null);
      return;
    }
    if ((_e = (ye = P.target) == null ? void 0 : ye.closest) != null && _e.call(ye, `.${no}`)) return;
    const x = P.currentTarget.getBoundingClientRect(), ae = P.clientX - x.left, me = P.clientY - x.top, ge = z == null ? void 0 : z.rect;
    if (ge && oo(ge) && ae >= ge.left - 4 && ae <= ge.left + Ct && me >= ge.top - ro && me <= ge.top) return;
    const xe = or(M, ae, me);
    Q((xe == null ? void 0 : xe.itemId) || null);
  }, ne = (P) => {
    if (P.pointerType === "mouse") return;
    const x = P.currentTarget.getBoundingClientRect(), ae = or(
      M,
      P.clientX - x.left,
      P.clientY - x.top
    );
    Q((ae == null ? void 0 : ae.itemId) || null);
  }, ee = (P) => {
    !Number.isFinite(P) || P <= 0 || Math.abs(w.current - P) < 1e-3 || (w.current = P, S(P), i == null || i(e, P));
  };
  return /* @__PURE__ */ F(
    "div",
    {
      ref: B,
      [Be]: e,
      [et]: r,
      [Sn]: I,
      className: wn,
      onPointerMoveCapture: Y,
      onPointerDown: ne,
      onPointerLeave: (P) => {
        P.pointerType === "mouse" && Q(null);
      },
      style: {
        width: t,
        height: T,
        minHeight: T
      },
      children: [
        o ? /* @__PURE__ */ y(
          aa,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: !0,
            renderAnnotationLayer: !1,
            className: jr,
            loading: /* @__PURE__ */ y(
              "div",
              {
                className: Nt,
                style: { width: t, height: I }
              }
            ),
            onLoadSuccess: (P) => {
              try {
                const x = P.getViewport({ scale: 1 });
                if (x.width > 0) {
                  const ae = x.height / x.width;
                  ee(ae);
                }
              } catch {
              }
              s == null || s();
            },
            onRenderSuccess: () => {
              Vt(C.current), s == null || s();
            }
          }
        ) : /* @__PURE__ */ y(
          "div",
          {
            className: Nt,
            style: { width: t, height: I },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ y("div", { ref: C, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        E ? /* @__PURE__ */ y(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: E,
            "aria-hidden": "true"
          }
        ) : null,
        o && g ? /* @__PURE__ */ y(
          oc,
          {
            layoutPage: b,
            pageState: h,
            width: t,
            height: I
          }
        ) : null,
        o && (R != null && R.size) ? /* @__PURE__ */ y("div", { className: "reader-quoted-markers", "aria-hidden": "true", children: M.filter((P) => R.has(P.itemId)).map((P) => /* @__PURE__ */ y(
          "span",
          {
            className: "reader-quoted-marker",
            "data-reader-quoted-id": P.itemId,
            title: "摘过",
            style: { left: P.rect.left, top: P.rect.top, height: P.rect.height }
          },
          P.itemId
        )) }) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ y("div", { className: "reader-revised-markers", "aria-hidden": "true", children: M.filter((P) => v.has(P.itemId)).map((P) => /* @__PURE__ */ y(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": P.itemId,
            style: { left: P.rect.left, top: P.rect.top, height: P.rect.height }
          },
          P.itemId
        )) }) : null,
        /* @__PURE__ */ y(
          Vi,
          {
            target: o ? z : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: z && (v == null ? void 0 : v.get(z.itemId)) || 0
          }
        )
      ]
    }
  );
}
const ic = mn(sc);
function cc(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Vt(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Jt = 5, lc = "120% 0px", uc = 120;
let ar = 1;
const sr = /* @__PURE__ */ new WeakMap();
function dc(e) {
  if (!e) return 0;
  const t = sr.get(e);
  if (t) return t;
  const n = ar;
  return ar += 1, sr.set(e, n), n;
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
    onNumPagesChange: m,
    activeRegion: b = null,
    regions: h = [],
    readerMetadata: g = null,
    hoveredRegionId: v = null,
    onHoverRegion: R,
    liveTranslation: w,
    showLiveTranslation: p = t === "source",
    liveTranslationPendingLabel: S = "",
    paneAction: k
  }, N) {
    xi();
    const { file: B, loading: C, error: D } = Ka(n, r), I = `${n}\0${dc(B)}`, T = A(I);
    T.current = I;
    const E = K(
      () => Ha(B),
      [B, n]
    ), [M, j] = _(0), [U, W] = _(""), [V, Q] = _(null), [z, Y] = _(480), ne = A(null), ee = A(0), oe = K(() => fc(), []), pe = K(() => ({
      cMapUrl: gt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: gt().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    gn(N, () => V, [V]), O(() => {
      const L = (q) => {
        ee.current = q, Y(q);
      }, J = (q) => {
        const Z = ws(q, ee.current);
        if (Z !== "ignore") {
          if (ne.current && clearTimeout(ne.current), Z === "immediate") {
            L(q);
            return;
          }
          ne.current = setTimeout(() => L(q), Wr);
        }
      }, H = !!(i && i >= 80);
      J(H ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const te = !H && c && typeof ResizeObserver < "u" ? new ResizeObserver((q) => {
        var Z, ue;
        J(((ue = (Z = q[0]) == null ? void 0 : Z.contentRect) == null ? void 0 : ue.width) ?? c.clientWidth);
      }) : null;
      return te && c && te.observe(c), () => {
        te == null || te.disconnect(), ne.current && clearTimeout(ne.current);
      };
    }, [i, c, a]);
    const P = K(
      () => ys(z, o),
      [z, o]
    ), [x, ae] = _(() => /* @__PURE__ */ new Map()), [me, ge] = _(() => /* @__PURE__ */ new Set()), [xe, ye] = _(() => /* @__PURE__ */ new Set()), _e = A(/* @__PURE__ */ new Map()), Ie = A(null), re = A(/* @__PURE__ */ new Map()), de = $((L, J) => {
      ae((H) => {
        if (H.get(L) === J) return H;
        const G = new Map(H);
        return G.set(L, J), G;
      });
    }, []), be = $((L, J) => {
      const H = _e.current, G = H.get(L);
      if (G && Ie.current)
        try {
          Ie.current.unobserve(G);
        } catch {
        }
      if (J) {
        if (H.set(L, J), Ie.current)
          try {
            Ie.current.observe(J);
          } catch {
          }
      } else
        H.delete(L);
    }, []), ie = A(/* @__PURE__ */ new Map()), ce = $((L) => {
      const J = ie.current;
      let H = J.get(L);
      return H || (H = (G) => be(L, G), J.set(L, H)), H;
    }, [be]);
    O(() => {
      if (typeof IntersectionObserver > "u") return;
      const L = re.current, J = new IntersectionObserver(
        (H) => {
          const G = [], te = [];
          for (const q of H) {
            const Z = q.target, ue = Pn(Z);
            Number.isFinite(ue) && (q.isIntersecting ? G : te).push(ue);
          }
          if ((G.length || te.length) && ge((q) => {
            let Z = null;
            for (const ue of G)
              q.has(ue) || (Z = Z || new Set(q), Z.add(ue));
            for (const ue of te)
              q.has(ue) && (Z = Z || new Set(q), Z.delete(ue));
            return Z || q;
          }), G.length) {
            for (const q of G) {
              const Z = L.get(q);
              Z && (clearTimeout(Z), L.delete(q));
            }
            ye((q) => {
              let Z = null;
              for (const ue of G)
                q.has(ue) || (Z = Z || new Set(q), Z.add(ue));
              return Z || q;
            });
          }
          for (const q of te)
            L.has(q) || L.set(q, setTimeout(() => {
              L.delete(q), ye((Z) => {
                if (!Z.has(q)) return Z;
                const ue = new Set(Z);
                return ue.delete(q), ue;
              });
            }, uc));
        },
        { root: c, rootMargin: lc, threshold: 0 }
      );
      Ie.current = J;
      for (const H of _e.current.values())
        try {
          J.observe(H);
        } catch {
        }
      return () => {
        J.disconnect(), Ie.current === J && (Ie.current = null);
        for (const H of L.values()) clearTimeout(H);
        L.clear();
      };
    }, [c]), Ne(() => {
      j(0), W(""), ge(/* @__PURE__ */ new Set()), ye(/* @__PURE__ */ new Set()), ae(/* @__PURE__ */ new Map()), _e.current.clear();
      const L = re.current;
      for (const J of L.values()) clearTimeout(J);
      L.clear(), m == null || m(0, t);
    }, [I, m, t]);
    const le = $(
      ({ numPages: L }) => {
        T.current === I && (j(L), W(""), m == null || m(L, t), d == null || d({ numPages: L, pane: t }));
      },
      [I, d, m, t]
    ), qe = $(
      (L) => {
        if (T.current !== I) return;
        const J = (L == null ? void 0 : L.message) || "PDF 解析失败";
        W(J), j(0), m == null || m(0, t), f == null || f(L, t);
      },
      [I, f, m, t]
    ), Te = K(
      () => M > 0 ? Array.from({ length: M }, (L, J) => J + 1) : [],
      [M]
    );
    O(() => {
      typeof IntersectionObserver < "u" || ye(new Set(Te));
    }, [Te]);
    const Le = K(
      () => Vn(b, g, t),
      [b, g, t]
    ), st = K(() => {
      const L = /* @__PURE__ */ new Map();
      for (const J of h) {
        const H = Vn(J, g, t);
        if (!H) continue;
        const G = L.get(H.box.page) || [];
        G.push(H), L.set(H.box.page, G);
      }
      return L;
    }, [t, g, h]), $t = K(() => {
      const L = /* @__PURE__ */ new Set();
      if (!v) return L;
      for (const [J, H] of st)
        H.some((G) => G.itemId === v) && L.add(J);
      return L;
    }, [v, st]), Pt = K(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(Te);
      if (me.size === 0) {
        const H = Math.min(M, Jt * 2 + 1);
        return new Set(Array.from({ length: H }, (G, te) => te + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const H of me)
        for (let G = -Jt; G <= Jt; G++) {
          const te = H + G;
          te >= 1 && te <= M && J.add(te);
        }
      return J;
    }, [M, Te, c, a, me]), it = !n || !!D || !!U, ct = n && (D || U) || s;
    return /* @__PURE__ */ F(
      "section",
      {
        ref: Q,
        className: `reader-panel ${ds}${a ? "" : " is-hidden"}`,
        [et]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (w == null ? void 0 : w.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          k ? /* @__PURE__ */ y("div", { className: "reader-react-pdf-pane-action", children: k }) : null,
          S ? /* @__PURE__ */ F("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ y("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ y("span", { children: S })
          ] }) : null,
          it && !C ? /* @__PURE__ */ y("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ct }) : null,
          C ? /* @__PURE__ */ y("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          E && !D ? /* @__PURE__ */ y("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ y(
            sa,
            {
              file: E,
              loading: null,
              error: null,
              options: pe,
              onLoadSuccess: le,
              onLoadError: qe,
              className: "reader-react-pdf-document",
              children: Te.map((L) => {
                if (Pt.has(L))
                  return /* @__PURE__ */ y(
                    ic,
                    {
                      pane: t,
                      pageNumber: L,
                      width: P,
                      devicePixelRatio: oe,
                      active: xe.has(L),
                      syncedMinHeight: (l == null ? void 0 : l.get(L)) || 0,
                      onMetrics: u,
                      cachedAspect: x.get(L),
                      onAspectChange: de,
                      sentinelRef: ce(L),
                      regionHighlight: (Le == null ? void 0 : Le.box.page) === L ? Le : null,
                      regionTargets: st.get(L),
                      hoveredRegionId: v && $t.has(L) ? v : null,
                      onHoverRegion: R,
                      liveTranslationLayout: w == null ? void 0 : w.layoutByPage.get(L - 1),
                      liveTranslationPage: w == null ? void 0 : w.pagesByPage.get(L - 1),
                      showLiveTranslation: p
                    },
                    `${t}-${L}`
                  );
                const H = x.get(L) ?? co, G = Math.max(120, Math.floor(P * H)), te = Math.max(G, Math.ceil((l == null ? void 0 : l.get(L)) || 0));
                return /* @__PURE__ */ y(
                  "div",
                  {
                    ref: ce(L),
                    [Be]: L,
                    [et]: t,
                    [Sn]: G,
                    className: wn,
                    style: {
                      width: P,
                      height: te,
                      minHeight: te
                    },
                    children: /* @__PURE__ */ y(
                      "div",
                      {
                        className: Nt,
                        style: { width: P, height: G },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${L}`
                );
              })
            },
            I
          ) }) : null
        ]
      }
    );
  }
), ir = mn(mc), hc = 2e3, pc = 6, gc = 500, cr = "reader-react-resizing";
function bc(e, t) {
  const n = A(null), r = A(null);
  Ne(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const p = yc(e), S = kt(e, p);
      if (!S) return;
      s = { pane: p, progress: S, started: performance.now() };
    }
    const { pane: c, progress: i, started: l } = s;
    let u = 0, d = null, f = e.scrollHeight, m = f, b = 0, h = l;
    const g = /* @__PURE__ */ new WeakMap(), v = typeof ResizeObserver > "u" ? null : new ResizeObserver((p) => {
      let S = !1;
      for (const k of p) {
        const N = Math.round(k.contentRect.height);
        g.has(k.target) && g.get(k.target) !== N && (S = !0), g.set(k.target, N);
      }
      S && bt(e, i, "auto", c);
    }), R = () => {
      var p;
      d && clearTimeout(d), cancelAnimationFrame(u), v == null || v.disconnect(), e.classList.remove(cr);
      for (const S of lr) e.removeEventListener(S, R);
      ((p = r.current) == null ? void 0 : p.stop) === R && (r.current = null);
    }, w = () => {
      bt(e, i, "auto", c);
      const p = e.scrollHeight;
      b = p === m ? b + 1 : 0, m = p;
      const S = performance.now() - h;
      b >= pc && (p !== f || S > gc) || S > hc ? R() : u = requestAnimationFrame(w);
    };
    for (const p of lr) e.addEventListener(p, R, { passive: !0 });
    for (const p of Array.from(e.children)) v == null || v.observe(p);
    e.classList.add(cr), r.current = { ...s, stop: R }, d = setTimeout(() => {
      d = null, h = performance.now(), f = e.scrollHeight, m = f, b = 0, u = requestAnimationFrame(w);
    }, Wr);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function yc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Be}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(et) || null;
  }
  return null;
}
const lr = ["wheel", "touchstart", "keydown", "pointerdown"], vc = () => () => {
}, ur = () => null;
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
function Pc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Rc(e) {
  const t = ze(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? wt, b = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), g = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, v = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, R = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, w = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", p = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", S = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, N = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), B = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), C = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), D = e.regions ?? (t == null ? void 0 : t.regions) ?? [], I = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [E, M] = _(null), j = ot(
    T ? T.subscribe : vc,
    T ? () => T.get().itemId : ur,
    T ? () => T.get().itemId : ur
  ), U = T ? j : E, W = $((Y) => {
    T ? T.set(Y, "pdf") : M(Y);
  }, [T]), V = Sc({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), z = Number.isFinite(b) && b > 0 ? wc(
    b,
    n || r,
    typeof document > "u" ? b * 2 : document.documentElement.clientWidth
  ) : null;
  return bc(f, z), /* @__PURE__ */ y(
    "div",
    {
      ref: d,
      className: us,
      "data-reader-region-count": D.length,
      "data-reader-structured-region-count": D.filter(Ho).length,
      "data-reader-metadata-ready": I ? "true" : "false",
      children: /* @__PURE__ */ F(
        "main",
        {
          className: `${ls} reader-mode-${V.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            g ? /* @__PURE__ */ y(
              ir,
              {
                pane: "source",
                url: w,
                preloadedFile: S,
                userZoom: m,
                visible: V.showSource,
                scrollRoot: f,
                pageWidthOverride: z,
                rowHeights: V.compareMode ? h : void 0,
                onMetrics: N,
                emptyLabel: R ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: B,
                activeRegion: C,
                regions: D,
                readerMetadata: I,
                hoveredRegionId: U,
                onHoverRegion: W,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? Pc(o) : "",
                paneAction: u ? /* @__PURE__ */ F(zt, { children: [
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
            v ? /* @__PURE__ */ y(
              ir,
              {
                pane: "translated",
                url: p,
                preloadedFile: k,
                userZoom: m,
                visible: V.showTranslated,
                scrollRoot: f,
                pageWidthOverride: z,
                rowHeights: V.compareMode ? h : void 0,
                onMetrics: N,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: B,
                activeRegion: C,
                regions: D,
                readerMetadata: I,
                hoveredRegionId: U,
                onHoverRegion: W,
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
  { id: "source", label: "原文", Icon: zr },
  { id: "compare", label: "对照", Icon: xr },
  { id: "translated", label: "译文", Icon: Or }
];
function Tc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Ec(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function kc(e) {
  const t = ze(), {
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
          /* @__PURE__ */ y(Ko, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ y("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ y("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Ic.map(({ id: i, label: l, Icon: u }) => {
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
            /* @__PURE__ */ y(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ y("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        i
      );
    }) })
  ] });
}
const Mc = () => () => {
}, Ac = () => !1;
function Nc() {
  const e = ya(), t = (e == null ? void 0 : e.available) ?? Ac, n = ot((e == null ? void 0 : e.subscribe) ?? Mc, t, t), r = $(() => !!(e != null && e.available() && e.ask()), [e]);
  return { available: n, ask: r };
}
const _c = {
  markdown: { label: "Markdown", short: "MD", Icon: Zo, needsJob: !0 }
}, Lc = Vr.map(
  (e) => ({ id: e, ..._c[e] })
);
function Cc() {
  return Lc.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Dc(e) {
  const t = ze(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = Nc(), i = [
    ...Cc().map(({ id: l, label: u, short: d, Icon: f, needsJob: m }) => ({
      key: l,
      label: u,
      short: d,
      Icon: f,
      disabled: m && o,
      selected: n === l,
      badge: r == null ? void 0 : r[l],
      onClick: () => a(l)
    })),
    ...c.available ? [{ key: "host-ai", label: "AI", short: "AI", Icon: Yo, disabled: !1, selected: !1, onClick: () => void c.ask() }] : []
  ];
  return n ? /* @__PURE__ */ F("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ y("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: u, Icon: d, disabled: f, selected: m, badge: b, onClick: h }) => /* @__PURE__ */ F(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": m,
        className: `reader-assistant-dock-tab${m ? " is-active" : ""}`,
        title: f ? `${u} 需打开任务阅读` : u,
        disabled: f,
        onClick: h,
        children: [
          /* @__PURE__ */ y(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ y("span", { className: "reader-assistant-dock-tab-label", children: u }),
          b ? /* @__PURE__ */ y("span", { className: "reader-assistant-dock-badge", children: b }) : null
        ]
      },
      l
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
  ] }) : /* @__PURE__ */ y("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: i.map(({ key: l, label: u, short: d, Icon: f, disabled: m, badge: b, onClick: h }) => /* @__PURE__ */ F(
    "button",
    {
      type: "button",
      className: "reader-assistant-rail-button",
      "aria-label": `打开${u}`,
      title: m ? `${u} 需打开任务阅读` : u,
      disabled: m,
      onClick: h,
      children: [
        /* @__PURE__ */ y(f, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
        /* @__PURE__ */ y("span", { children: d }),
        b ? /* @__PURE__ */ y("span", { className: "reader-assistant-dock-badge", children: b }) : null
      ]
    },
    l
  )) });
}
function zc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function xc(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Oc(e) {
  return e / 100 * window.innerHeight;
}
function Fc(e) {
  return e / 100 * window.innerWidth;
}
function $c(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function mt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = $c(n);
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
      r = xc(t, o);
      break;
    }
    case "em": {
      r = zc(t, o);
      break;
    }
    case "vh": {
      r = Oc(o);
      break;
    }
    case "vw": {
      r = Fc(o);
      break;
    }
  }
  return r;
}
function he(e) {
  return parseFloat(e.toFixed(3));
}
function rt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function cn(e) {
  const { panels: t } = e, n = rt({ group: e });
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
      const u = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = he(u / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const u = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = he(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = he(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = mt({
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
function X(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function ln(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? jc : Bc
  );
}
function jc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Bc(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function lo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function uo(e, t) {
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
function Uc({
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
    const { x: c, y: i } = uo(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return X(o, "No rect found"), o;
}
let Tt;
function Hc() {
  return Tt === void 0 && (typeof matchMedia == "function" ? Tt = !!matchMedia("(pointer:coarse)").matches : Tt = !1), Tt;
}
function fo(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = ln(
    n,
    Array.from(t.children).filter(lo).map((b) => ({ element: b }))
  ).map(({ element: b }) => b), s = [];
  let c = !1, i = !1, l = -1, u = -1, d = 0, f, m = [];
  {
    let b = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (b++, h.hasAttribute("data-disabled") || (d++, l === -1 && (l = b), u = b));
  }
  if (d > 1) {
    let b = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        b++;
        const g = r.find(
          (v) => v.element === h
        );
        if (g) {
          if (f) {
            const v = f.element.getBoundingClientRect(), R = h.getBoundingClientRect();
            let w;
            if (i) {
              const p = n === "horizontal" ? new DOMRect(
                v.right,
                v.top,
                0,
                v.height
              ) : new DOMRect(
                v.left,
                v.bottom,
                v.width,
                0
              ), S = n === "horizontal" ? new DOMRect(R.left, R.top, 0, R.height) : new DOMRect(R.left, R.top, R.width, 0);
              switch (m.length) {
                case 0: {
                  w = [
                    p,
                    S
                  ];
                  break;
                }
                case 1: {
                  const k = m[0], N = Uc({
                    orientation: n,
                    rects: [v, R],
                    targetRect: k.element.getBoundingClientRect()
                  });
                  w = [
                    k,
                    N === v ? S : p
                  ];
                  break;
                }
                default: {
                  w = m;
                  break;
                }
              }
            } else
              m.length ? w = m : w = [
                n === "horizontal" ? new DOMRect(
                  v.right,
                  R.top,
                  R.left - v.right,
                  R.height
                ) : new DOMRect(
                  R.left,
                  v.bottom,
                  R.width,
                  R.top - v.bottom
                )
              ];
            for (const p of w) {
              let S = "width" in p ? p : p.element.getBoundingClientRect();
              const k = Hc() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < k) {
                const B = k - S.width;
                S = new DOMRect(
                  S.x - B / 2,
                  S.y,
                  S.width + B,
                  S.height
                );
              }
              if (S.height < k) {
                const B = k - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - B / 2,
                  S.width,
                  S.height + B
                );
              }
              const N = b <= l || b > u;
              !c && !N && s.push({
                group: e,
                groupSize: rt({ group: e }),
                panels: [f, g],
                separator: "width" in p ? void 0 : p,
                rect: S
              }), c = !1;
            }
          }
          i = !1, f = g, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (c = !0);
        const g = o.find(
          (v) => v.element === h
        );
        g ? m.push(g) : (f = void 0, m = []);
      } else
        i = !0;
  }
  return s;
}
var Ce;
class mo {
  constructor() {
    Un(this, Ce, {});
  }
  addListener(t, n) {
    const r = lt(this, Ce)[t];
    return r === void 0 ? lt(this, Ce)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = lt(this, Ce)[t];
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
    Hn(this, Ce, {});
  }
  removeListener(t, n) {
    const r = lt(this, Ce)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ce = new WeakMap();
let Xe = {
  cursorFlags: 0,
  state: "inactive"
};
const En = new mo();
function Ue() {
  return Xe;
}
function Wc(e) {
  return En.addListener("change", e);
}
function Vc(e) {
  const t = Xe, n = { ...Xe };
  n.cursorFlags = e, Xe = n, En.emit("change", {
    prev: t,
    next: n
  });
}
function Qe(e) {
  const t = Xe;
  Xe = e, En.emit("change", {
    prev: t,
    next: e
  });
}
const Jc = (e) => e, qt = () => {
}, ho = 1, po = 2, go = 4, bo = 8, dr = 3, fr = 12;
let Et;
function mr() {
  return Et === void 0 && (Et = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Et = !0)), Et;
}
function qc({
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
          const a = (e & ho) !== 0, s = (e & po) !== 0, c = (e & go) !== 0, i = (e & bo) !== 0;
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
function kn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = hr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Ue();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = qc({
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
let Pe = /* @__PURE__ */ new Map();
const yo = new mo();
function Gc(e) {
  Pe = new Map(Pe), Pe.delete(e);
}
function pr(e, t) {
  for (const [n] of Pe)
    if (n.id === e)
      return n;
}
function De(e, t) {
  for (const [n, r] of Pe)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function Ve() {
  return Pe;
}
function Mn(e, t) {
  return yo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ae(e, t, n) {
  const r = Pe.get(e);
  Pe = new Map(Pe), Pe.set(e, t), yo.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function vo(e) {
  const t = Ue();
  let n = !1;
  switch (t.state) {
    case "active":
      Qe({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (kn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = De(r.group.id, !0);
        Ae(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function gr(e) {
  e.defaultPrevented || vo(e.currentTarget);
}
function Kc(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = uo(n, a.rect);
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
function Zc(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Yc(e, t) {
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
const Xc = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Qc(e) {
  const t = getComputedStyle(So(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function el(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Qc(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Xc.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function br(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (X(n, "Missing node"), el(n)) return n;
  }
  return null;
}
function yr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function vr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = So(e);
  return t;
}
function So(e) {
  const { parentNode: t } = e;
  return Zc(t) ? t.host : t;
}
function tl(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function nl({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!lo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Yc(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (tl(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function An(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = fo(o), s = Kc(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && nl({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function rl(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function fe(e, t, n = 0) {
  return Math.abs(he(e) - he(t)) <= n;
}
function we(e, t) {
  return fe(e, t) ? 0 : e > t ? 1 : -1;
}
function Ye({
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
  if (we(r, i) < 0)
    if (a) {
      const l = (o + i) / 2;
      we(r, l) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(c, r), r = he(r), r;
}
function yt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (fe(e, 0))
    return t;
  const s = a === "imperative-api", c = Object.values(t), i = Object.values(o), l = [...c], [u, d] = r;
  X(u != null, "Invalid first pivot index"), X(d != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? d : u, g = n[h];
        X(
          g,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: R,
          minSize: w = 0
        } = g;
        if (R) {
          const p = c[h];
          if (X(
            p != null,
            `Previous layout not found for panel index ${h}`
          ), fe(p, v)) {
            const S = w - p;
            we(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const h = e < 0 ? u : d, g = n[h];
        X(
          g,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: R,
          minSize: w = 0
        } = g;
        if (R) {
          const p = c[h];
          if (X(
            p != null,
            `Previous layout not found for panel index ${h}`
          ), fe(p, w)) {
            const S = p - v;
            we(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? d : u, g = n[h];
      X(
        g,
        `Panel constraints not found for index ${h}`
      );
      const v = c[h], { collapsible: R, collapsedSize: w, minSize: p } = g;
      if (R && we(v, p) < 0)
        if (e > 0) {
          const S = p - w, k = S / 2, N = v + e;
          we(N, p) < 0 && (e = we(e, k) <= 0 ? 0 : S);
        } else {
          const S = p - w, k = 100 - S / 2, N = v - e;
          we(N, p) < 0 && (e = we(100 + e, k) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let g = e < 0 ? d : u, v = 0;
    for (; ; ) {
      const w = c[g];
      X(
        w != null,
        `Previous layout not found for panel index ${g}`
      );
      const p = Ye({
        overrideDisabledPanels: s,
        panelConstraints: n[g],
        prevSize: w,
        size: 100
      }) - w;
      if (v += p, g += h, g < 0 || g >= n.length)
        break;
    }
    const R = Math.min(Math.abs(e), Math.abs(v));
    e = e < 0 ? 0 - R : R;
  }
  {
    let h = e < 0 ? u : d;
    for (; h >= 0 && h < n.length; ) {
      const g = Math.abs(e) - Math.abs(f), v = c[h];
      X(
        v != null,
        `Previous layout not found for panel index ${h}`
      );
      const R = v - g, w = Ye({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: v,
        size: R
      });
      if (!fe(v, w) && (f += v - w, l[h] = w, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (rl(i, l))
    return o;
  {
    const h = e < 0 ? d : u, g = c[h];
    X(
      g != null,
      `Previous layout not found for panel index ${h}`
    );
    const v = g + f, R = Ye({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: g,
      size: v
    });
    if (l[h] = R, !fe(R, v)) {
      let w = v - R, p = e < 0 ? d : u;
      for (; p >= 0 && p < n.length; ) {
        const S = l[p];
        X(
          S != null,
          `Previous layout not found for panel index ${p}`
        );
        const k = S + w, N = Ye({
          overrideDisabledPanels: s,
          panelConstraints: n[p],
          prevSize: S,
          size: k
        });
        if (fe(S, N) || (w -= N - S, l[p] = N), fe(w, 0))
          break;
        e > 0 ? p-- : p++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, g) => g + h,
    0
  );
  if (!fe(m, 100, 0.1))
    return o;
  const b = Object.keys(o);
  return l.reduce((h, g, v) => (h[b[v]] = g, h), {});
}
function He(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || we(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function We({
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
  if (!fe(o, 100) && r.length > 0)
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
    const u = Ye({
      overrideDisabledPanels: !0,
      panelConstraints: t[c],
      prevSize: i,
      size: l
    });
    l != u && (a += l - u, r[c] = u);
  }
  if (!fe(a, 0))
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      X(i != null, `No layout data found for index ${c}`);
      const l = i + a, u = Ye({
        overrideDisabledPanels: !0,
        panelConstraints: t[c],
        prevSize: i,
        size: l
      });
      if (i !== u && (a -= u - i, r[c] = u, fe(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((c, i, l) => (c[s[l]] = i, c), {});
}
function wo({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = Ve();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: d,
        layout: f,
        groupSize: m,
        separatorToPanels: b
      }
    ] of i)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: d,
          group: l,
          groupSize: m,
          layout: f,
          separatorToPanels: b
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
    const f = a(), m = l.findIndex((g) => g.id === t), b = m === 0, h = m === l.length - 1;
    if (h && i < f && (b || l.slice(0, m).every((g, v) => {
      const R = d[v];
      return (R == null ? void 0 : R.collapsible) && fe(R.collapsedSize, u[R.panelId]);
    }))) {
      const g = l.slice(0, m).reduce((v, R) => v + u[R.id], 0);
      return {
        ...u,
        [t]: he(100 - g)
      };
    }
    return yt({
      delta: h ? f - i : i - f,
      initialLayout: u,
      panelConstraints: d,
      pivotIndices: h ? [m - 1, m] : [m, m + 1],
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
      groupSize: m,
      layout: b,
      separatorToPanels: h
    } = n(), g = s({
      nextSize: i,
      panels: f.panels,
      prevLayout: b,
      derivedPanelConstraints: d
    }), v = We({
      layout: g,
      panelConstraints: d
    });
    He(b, v) || Ae(f, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: m,
      layout: v,
      separatorToPanels: h
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
        let m = d.expandToSize ?? u;
        m === 0 && (m = 1), c(m);
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
      return i && fe(l, u);
    },
    resize: (i) => {
      const { group: l } = n(), { element: u } = o(), d = rt({ group: l }), f = mt({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), m = he(f / d * 100);
      c(m);
    }
  };
}
function Sr(e) {
  if (e.defaultPrevented)
    return;
  const t = Ve();
  An(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = wo({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Mt(e) {
  const t = Ve();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Po({
  groupId: e
}) {
  const t = () => {
    const n = Ve();
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
      } = t(), l = We({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (He(c, l) || Ae(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function Oe(e, t) {
  const n = Mt(e), r = De(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  X(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  X(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = Po({ groupId: n.id }).getLayout(), i = yt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = We({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  He(c, l) || Ae(
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
  const t = e.currentTarget, n = Mt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && Oe(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Oe(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Oe(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Oe(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Oe(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Mt(t), o = De(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (f) => f.element === t
        );
        X(i, "Matching separator not found");
        const l = c.get(i);
        X(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (f) => f.panelId === u.id
        );
        if (X(d, "Panel metadata not found"), d.collapsible) {
          const f = s[u.id], m = d.collapsedSize === f ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          Oe(t, m - f);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Mt(t).separators.map(
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
        e.preventDefault(), Oe(t, -100);
        break;
      }
    }
}
function Pr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = Ve(), n = An(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Qe({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Ro({
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
    const { group: u, groupSize: d } = l, { orientation: f, panels: m } = u, { disableCursor: b } = u.mutableState;
    let h = 0;
    a ? f === "horizontal" ? h = (t.clientX - a.x) / d * 100 : h = (t.clientY - a.y) / d * 100 : f === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const g = r.get(u), v = o.get(u);
    if (!g || !v)
      return;
    const {
      defaultLayoutDeferred: R,
      derivedPanelConstraints: w,
      groupSize: p,
      layout: S,
      separatorToPanels: k
    } = v;
    if (w && S && k) {
      const N = yt({
        delta: h,
        initialLayout: g,
        panelConstraints: w,
        pivotIndices: l.panels.map((B) => m.indexOf(B)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (He(N, S)) {
        if (h !== 0 && !b)
          switch (f) {
            case "horizontal": {
              c |= h < 0 ? ho : po;
              break;
            }
            case "vertical": {
              c |= h < 0 ? go : bo;
              break;
            }
          }
      } else
        Ae(l.group, {
          defaultLayoutDeferred: R,
          derivedPanelConstraints: w,
          groupSize: p,
          layout: N,
          separatorToPanels: k
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & dr : i |= c & dr, t.movementY === 0 ? i |= s & fr : i |= c & fr, Vc(i), kn(e);
}
function Rr(e) {
  const t = Ve(), n = Ue();
  switch (n.state) {
    case "active":
      Ro({
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
  const t = Ue(), n = Ve();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Qe({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = De(a.group.id, !0);
          Ae(a.group, s, {
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
      Ro({
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
      const a = An(e, n);
      a.length === 0 ? t.state !== "inactive" && Qe({
        cursorFlags: 0,
        state: "inactive"
      }) : Qe({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), kn(e.currentTarget);
      break;
    }
  }
}
function Tr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Ue().state) {
      case "hover":
        Qe({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Er(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || vo(e.currentTarget) && e.preventDefault();
}
function kr(e) {
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
function ol(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = rt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, c = {
    asPercentage: he(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = c, r.onResize(c, r.id, s);
}
function al(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function sl({
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
        const m = f / 100 * n, b = he(
          m / t * 100
        );
        c.set(d.id, b), o += b;
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
function il(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Ge = /* @__PURE__ */ new Map();
function cl(e) {
  let t = !0;
  X(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((b) => {
    for (const h of b) {
      const { borderBoxSize: g, target: v } = h;
      if (v === e.element) {
        if (t) {
          const R = rt({ group: e });
          if (R === 0)
            return;
          const w = De(e.id);
          if (!w)
            return;
          const p = cn(e), S = w.defaultLayoutDeferred ? kr(p) : w.layout, k = sl({
            group: e,
            nextGroupSize: R,
            prevGroupSize: w.groupSize,
            prevLayout: S
          }), N = We({
            layout: k,
            panelConstraints: p
          });
          if (!w.defaultLayoutDeferred && He(w.layout, N) && al(
            w.derivedPanelConstraints,
            p
          ) && w.groupSize === R)
            return;
          Ae(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: p,
            groupSize: R,
            layout: N,
            separatorToPanels: w.separatorToPanels
          });
        }
      } else
        ol(e, v, g);
    }
  });
  a.observe(e.element), e.panels.forEach((b) => {
    X(
      !r.has(b.id),
      `Panel ids must be unique; id "${b.id}" was used more than once`
    ), r.add(b.id), b.onResize && a.observe(b.element);
  });
  const s = rt({ group: e }), c = cn(e), i = e.panels.map(({ id: b }) => b).join(",");
  let l = e.mutableState.defaultLayout;
  l && (il(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? kr(c), d = We({
    layout: u,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Ge.set(
    f,
    (Ge.get(f) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return fo(e).forEach((b) => {
    b.separator && m.set(b.separator, b.panels);
  }), Ae(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: m
  }), e.separators.forEach((b) => {
    X(
      !o.has(b.id),
      `Separator ids must be unique; id "${b.id}" was used more than once`
    ), o.add(b.id), b.element.addEventListener("keydown", wr);
  }), Ge.get(f) === 1 && (f.addEventListener("contextmenu", gr, !0), f.addEventListener("dblclick", Sr, !0), f.addEventListener("pointerdown", Pr, !0), f.addEventListener("pointerleave", Rr), f.addEventListener("pointermove", Ir), f.addEventListener("pointerout", Tr), f.addEventListener("pointerup", Er, !0)), function() {
    t = !1, Ge.set(
      f,
      Math.max(0, (Ge.get(f) ?? 0) - 1)
    ), Gc(e), e.separators.forEach((b) => {
      b.element.removeEventListener("keydown", wr);
    }), Ge.get(f) || (f.removeEventListener(
      "contextmenu",
      gr,
      !0
    ), f.removeEventListener(
      "dblclick",
      Sr,
      !0
    ), f.removeEventListener(
      "pointerdown",
      Pr,
      !0
    ), f.removeEventListener("pointerleave", Rr), f.removeEventListener("pointermove", Ir), f.removeEventListener("pointerout", Tr), f.removeEventListener("pointerup", Er, !0)), a.disconnect();
  };
}
function ll() {
  const [e, t] = _({}), n = $(() => t({}), []);
  return [e, n];
}
function Nn(e) {
  const t = Lr();
  return `${e ?? t}`;
}
const Je = typeof window < "u" ? Ne : O;
function ht(e) {
  const t = A(e);
  return Je(() => {
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
  return ht((t) => {
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
function Ln(e) {
  const t = A({ ...e });
  return Je(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Io = hn(null);
function ul(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: Jc
  });
  gn(t, () => n.current, []), Je(() => {
    Object.assign(
      n.current,
      Po({ groupId: e })
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
  style: f,
  ...m
}) {
  const b = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = ht((I) => {
    He(b.current.onLayoutChange, I) || (b.current.onLayoutChange = I, i == null || i(I));
  }), g = ht(
    (I, T) => {
      He(b.current.onLayoutChanged, I) || (b.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), v = Nn(c), R = A(null), [w, p] = ll(), S = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), k = _n(R, a);
  ul(v, s);
  const N = ht(
    (I, T) => {
      const E = Ue(), M = pr(I), j = De(I);
      if (j) {
        let U = !1;
        switch (E.state) {
          case "active": {
            U = E.hitRegions.some(
              (W) => W.group === M
            );
            break;
          }
        }
        return {
          flexGrow: j.layout[T] ?? 1,
          pointerEvents: U ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), B = Ln({
    defaultLayout: n,
    disableCursor: r
  }), C = K(
    () => ({
      get disableCursor() {
        return !!B.disableCursor;
      },
      getPanelStyles: N,
      id: v,
      orientation: u,
      registerPanel: (I) => {
        const T = S.current;
        return T.panels = ln(u, [
          ...T.panels,
          I
        ]), p(), () => {
          T.panels = T.panels.filter(
            (E) => E !== I
          ), p();
        };
      },
      registerSeparator: (I) => {
        const T = S.current;
        return T.separators = ln(u, [
          ...T.separators,
          I
        ]), p(), () => {
          T.separators = T.separators.filter(
            (E) => E !== I
          ), p();
        };
      },
      updatePanelProps: (I, { disabled: T }) => {
        const E = S.current.panels.find(
          (U) => U.id === I
        );
        E && (E.panelConstraints.disabled = T);
        const M = pr(v), j = De(v);
        M && j && Ae(M, {
          ...j,
          derivedPanelConstraints: cn(M)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: E
      }) => {
        const M = S.current.separators.find(
          (j) => j.id === I
        );
        M && (M.disabled = T, M.disableDoubleClick = E);
      }
    }),
    [N, v, p, u, B]
  ), D = A(null);
  return Je(() => {
    const I = R.current;
    if (I === null)
      return;
    const T = S.current;
    let E;
    if (B.defaultLayout !== void 0 && Object.keys(B.defaultLayout).length === T.panels.length) {
      E = {};
      for (const z of T.panels) {
        const Y = B.defaultLayout[z.id];
        Y !== void 0 && (E[z.id] = Y);
      }
    }
    const M = {
      disabled: !!o,
      element: I,
      id: v,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!B.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    D.current = M;
    const j = cl(M), { defaultLayoutDeferred: U, derivedPanelConstraints: W, layout: V } = De(M.id, !0);
    !U && W.length > 0 && (h(V), g(V, !1));
    const Q = Mn(v, (z) => {
      const { defaultLayoutDeferred: Y, derivedPanelConstraints: ne, layout: ee } = z.next;
      if (Y || ne.length === 0)
        return;
      const oe = M.panels.map(({ id: P }) => P).join(",");
      M.mutableState.layouts[oe] = ee, ne.forEach((P) => {
        if (P.collapsible) {
          const { layout: x } = z.prev ?? {};
          if (x) {
            const ae = fe(
              P.collapsedSize,
              ee[P.panelId]
            ), me = fe(
              P.collapsedSize,
              x[P.panelId]
            );
            ae && !me && (M.mutableState.expandedPanelSizes[P.panelId] = x[P.panelId]);
          }
        }
      });
      const pe = Ue().state !== "active";
      h(ee), pe && g(ee, z.isUserInteraction);
    });
    return () => {
      D.current = null, j(), Q();
    };
  }, [
    o,
    v,
    g,
    h,
    u,
    w,
    B
  ]), O(() => {
    const I = D.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ y(Io.Provider, { value: C, children: /* @__PURE__ */ y(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": v,
      id: v,
      ref: k,
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
To.displayName = "Group";
function Cn() {
  const e = pn(Io);
  return X(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function dl(e, t) {
  const { id: n } = Cn(), r = A({
    collapse: qt,
    expand: qt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: qt
  });
  gn(t, () => r.current, []), Je(() => {
    Object.assign(
      r.current,
      wo({ groupId: n, panelId: e })
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
  style: m,
  ...b
}) {
  const h = !!i, g = Nn(i), v = Ln({
    disabled: a
  }), R = A(null), w = _n(R, s), {
    getPanelStyles: p,
    id: S,
    orientation: k,
    registerPanel: N,
    updatePanelProps: B
  } = Cn(), C = d !== null, D = ht(
    (M, j, U) => {
      d == null || d(M, i, U);
    }
  );
  Je(() => {
    const M = R.current;
    if (M !== null) {
      const j = {
        element: M,
        id: g,
        idIsStable: h,
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
          disabled: v.disabled,
          maxSize: l,
          minSize: u
        }
      };
      return N(j);
    }
  }, [
    c,
    n,
    r,
    o,
    C,
    g,
    h,
    l,
    u,
    D,
    N,
    v
  ]), O(() => {
    B(g, { disabled: a });
  }, [a, g, B]), dl(g, f);
  const I = () => {
    const M = p(S, g);
    if (M)
      return JSON.stringify(M);
  }, T = ot(
    (M) => Mn(S, M),
    I,
    I
  );
  let E;
  return T ? E = JSON.parse(T) : o !== void 0 ? E = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : E = { flexGrow: 1 }, /* @__PURE__ */ y(
    "div",
    {
      ...b,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": g,
      id: g,
      ref: w,
      style: {
        ...fl,
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
            ...m,
            // Inform the browser that the library is handling touch events for this element
            // but still allow users to scroll content within panels in the non-resizing direction
            // NOTE This is not an inherited style
            // See github.com/bvaughn/react-resizable-panels/issues/662
            touchAction: k === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
un.displayName = "Panel";
const fl = {
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
function ml({
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
    a = We({
      layout: yt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = We({
      layout: yt({
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
function Eo({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...c
}) {
  const i = Nn(a), l = Ln({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = _({}), [f, m] = _("inactive"), [b, h] = _(!1), g = A(null), v = _n(g, o), {
    disableCursor: R,
    id: w,
    orientation: p,
    registerSeparator: S,
    updateSeparatorProps: k
  } = Cn(), N = p === "horizontal" ? "vertical" : "horizontal";
  Je(() => {
    const D = g.current;
    if (D !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: D,
        id: i
      }, T = S(I), E = Wc(
        (j) => {
          m(
            j.next.state !== "inactive" && j.next.hitRegions.some(
              (U) => U.separator === I
            ) ? j.next.state : "inactive"
          );
        }
      ), M = Mn(
        w,
        (j) => {
          const { derivedPanelConstraints: U, layout: W, separatorToPanels: V } = j.next, Q = V.get(I);
          if (Q) {
            const z = Q[0], Y = Q.indexOf(z);
            d(
              ml({
                layout: W,
                panelConstraints: U,
                panelId: z.id,
                panelIndex: Y
              })
            );
          }
        }
      );
      return () => {
        E(), M(), T();
      };
    }
  }, [w, i, S, l]), O(() => {
    k(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, k]);
  let B;
  n && !R && (B = "not-allowed");
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
        b ? C = "focus" : C = f;
    }
  return /* @__PURE__ */ y(
    "div",
    {
      ...c,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": N,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": C,
      "data-testid": i,
      id: i,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: v,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: B,
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
Eo.displayName = "Separator";
const Dn = 30, zn = 65, vt = 50, hl = 100 - zn, pl = 100 - Dn;
function gl(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(zn, Math.max(Dn, t)) : vt;
}
function xn(e) {
  return 100 - e;
}
function Ke(e) {
  return `${e}%`;
}
const On = "reader-document", St = "reader-assistant", ko = "retainpdf.reader.ai-split-layout.v1", bl = {
  [On]: xn(vt),
  [St]: vt
};
function Fn(e) {
  const t = gl(e == null ? void 0 : e[St]);
  return {
    [On]: xn(t),
    [St]: t
  };
}
function yl() {
  try {
    const e = JSON.parse(localStorage.getItem(ko) || "null");
    return Fn(e);
  } catch {
    return bl;
  }
}
function vl(e) {
  try {
    localStorage.setItem(ko, JSON.stringify(Fn(e)));
  } catch {
  }
}
function Gt(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Fn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[St]}vw`
  );
}
function Sl() {
  const e = A(null), [t] = _(yl);
  Ne(() => {
    const o = e.current;
    return Gt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = $((o) => {
    Gt(e.current, o);
  }, []), r = $((o, a) => {
    Gt(e.current, o), a.isUserInteraction && vl(o);
  }, []);
  return /* @__PURE__ */ F(
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
            id: On,
            defaultSize: Ke(xn(vt)),
            minSize: Ke(hl),
            maxSize: Ke(pl)
          }
        ),
        /* @__PURE__ */ y(
          Eo,
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
            id: St,
            defaultSize: Ke(vt),
            minSize: Ke(Dn),
            maxSize: Ke(zn)
          }
        )
      ]
    }
  );
}
function wl({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = _(!1);
  if (O(() => {
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
function Pl({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ y(wl, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ F(zt, { children: [
    e ? /* @__PURE__ */ y("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ F("div", { className: "reader-boot-loading-card", children: [
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
function Rl(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Il() {
  const [e, t] = _(!1), n = Lr(), r = A(null);
  return O(() => {
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
  }, [e]), O(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Rl(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ F("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ y(Xo, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ y("div", { className: "reader-react-shortcuts-body", children: vi.map((o) => /* @__PURE__ */ F("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ y("h3", { children: o.title }),
            /* @__PURE__ */ y("ul", { children: o.items.map((a) => /* @__PURE__ */ F("li", { children: [
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
const Tl = ["source", "sideBySide", "translated"], El = { source: "", translated: "", sideBySide: "" };
function kl(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = pt(e.sourceUrl), n = pt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Ta({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Mo(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = K(
    () => e ? kl(e) : El,
    [e]
  ), o = K(
    () => Tl.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = $(async (s) => {
    if (!e) return;
    const c = pt(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? Ia(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Ea(
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
        ka(l), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Ml = {
  source: zr,
  sideBySide: xr,
  translated: Or
}, Al = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Nl(e) {
  const t = ze(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Mo(n), c = A(null);
  return O(() => {
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
      /* @__PURE__ */ y(Qo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ y(ea, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ y("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = Cr[i], u = pt(r[i]), d = a.has(i), f = !!u && !d, m = f ? "" : zo(i, r), b = Ml[i];
      return /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          id: `reader-download-${i}`,
          className: `reader-download-action${d ? " is-busy" : ""}`,
          disabled: !f,
          "aria-label": f ? `下载${l.label}` : m,
          onClick: () => {
            c.current && (c.current.open = !1), s(i);
          },
          children: [
            /* @__PURE__ */ y(b, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ F("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ F("span", { className: "reader-download-action-label", children: [
                Al[i],
                " PDF"
              ] }),
              m ? /* @__PURE__ */ y("span", { className: "reader-download-action-reason", children: m }) : null
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
const _l = "retainpdf:reader:bookmarks:v1:", Ll = 200;
function $n() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ao(e) {
  const t = `${e || ""}`.trim();
  return t ? `${_l}${t}` : "";
}
function Cl(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Dt(e, t = $n()) {
  const n = Ao(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Cl(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function dn(e, t, n) {
  const r = Ao(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Ll);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Dl(e, t, n = "", { storage: r = $n(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Dt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? dn(e, a.filter((c) => c.page !== s), r) : dn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function zl(e, t, n = $n()) {
  return dn(e, Dt(e, n).filter((r) => r.page !== t), n);
}
function xl(e, t) {
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
function Ol({ filled: e }) {
  return /* @__PURE__ */ y("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ y("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Fl({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = _(() => Dt(e)), [c, i] = _(!1), l = A(null);
  if (O(() => {
    s(Dt(e)), i(!1);
  }, [e]), O(() => {
    if (!c) return;
    const f = (b) => {
      l.current && !l.current.contains(b.target) && i(!1);
    }, m = (b) => {
      b.key === "Escape" && i(!1);
    };
    return document.addEventListener("pointerdown", f), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", f), document.removeEventListener("keydown", m);
    };
  }, [c]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), d = a.some((f) => f.page === u);
  return /* @__PURE__ */ F("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Dl(e, u, xl(r, u))),
        children: /* @__PURE__ */ y(Ol, { filled: d })
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
        onClick: () => i((f) => !f),
        children: a.length
      }
    ),
    c && a.length ? /* @__PURE__ */ y("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ y("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ F("li", { className: f.page === u ? "is-current" : "", children: [
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
            f.label ? /* @__PURE__ */ y("span", { className: "reader-bookmark-label", children: f.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ y(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${f.page} 页的书签`,
          onClick: () => s(zl(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function $l(e) {
  const t = ze(), n = io(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? wt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Hr(a), d = a > Br + 1e-3, f = a < tt - 1e-3, m = Ze(r, je()), b = m >= tt ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [h, g] = _(!1), [v, R] = _(`${c}`);
  O(() => {
    h || R(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, h]);
  const w = () => {
    if (g(!1), !l || i <= 0)
      return;
    const p = Number(`${v}`.trim());
    l(Lt(p, i));
  };
  return /* @__PURE__ */ F("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ y("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ y("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ F(
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
              value: v,
              autoFocus: !0,
              onChange: (p) => R(p.target.value.replace(/[^\d]/g, "")),
              onBlur: w,
              onKeyDown: (p) => {
                p.key === "Escape" && (p.preventDefault(), g(!1), R(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ F("span", { className: "reader-react-hud-page-suffix", children: [
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
          !l || i <= 0 || (R(`${c}`), g(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ y(
      Fl,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ F("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ y(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !d,
          onClick: () => s(nt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${b}`,
          title: b,
          onClick: () => s(m),
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
          disabled: !f,
          onClick: () => s(nt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ y("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ y(Il, {}) })
  ] });
}
function Mr(e) {
  var t, n;
  return Jr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function jl(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: Mr(Re(e))
  }));
  O(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Mr(Re(e))
    });
  }, [e]), O(() => {
    t.scope === e && Ft(t.scope, {
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
function Bl({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ F("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ F("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ y("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ y("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ y("div", { className: "download-toast-track", children: /* @__PURE__ */ y("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ y("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Ul(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Yt.dismiss(fn);
    return;
  }
  Yt.custom(
    () => /* @__PURE__ */ y(Bl, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: fn, duration: 1 / 0 }
  );
}
function Hl() {
  const e = $((t) => {
    t && (t.setState = Ul, t.hide = () => Yt.dismiss(fn));
  }, []);
  return /* @__PURE__ */ F(zt, { children: [
    /* @__PURE__ */ y(qo, { position: "bottom-right" }),
    /* @__PURE__ */ y("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Wl = () => () => {
}, Vl = () => !1;
function Jl() {
  const e = Xt(), t = (e == null ? void 0 : e.active) ?? Vl;
  return ot((e == null ? void 0 : e.subscribe) ?? Wl, t, t);
}
function ql(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Ur(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Gl(e, t) {
  return t === null || e !== t;
}
function Kl(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function Zl(e, t) {
  const n = e === t;
  return { open: n, mounted: Kl(n) };
}
const Ar = { itemId: null, origin: null };
function Yl() {
  let e = Ar;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Ar : { itemId: n, origin: r };
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
const $e = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Xl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Ql = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, eu = {
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
}, Nr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function tu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Nr(o ?? a ?? "", Xl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Nr(o ?? a ?? "", Ql)).replace(/\\([a-zA-Z]+)/gu, (r, o) => eu[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function nu(e) {
  return $e(e.translatedBlockText) || $e(e.translated.text) || $e(e.source.text);
}
const ru = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function ou(e) {
  const t = [];
  for (const n of e) {
    if (!ru(n)) continue;
    const r = tu(nu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function au(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const su = 24, iu = 60;
function _r(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - su), o = Math.min(e.length, n + t.length + iu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function cu(e, t, n = 200) {
  const r = $e(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const c = $e(a.translatedBlockText) || $e(a.translated.text), i = c ? _r(c, r) : null, l = i ?? _r($e(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
const lu = [];
function uu({ open: e, onToggle: t }) {
  return /* @__PURE__ */ F("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ F(Fe, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ y(ta, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ F(Fe, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ y(na, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { children: "搜索" })
    ] })
  ] });
}
function du({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r
}) {
  var m, b;
  const o = ((m = ze()) == null ? void 0 : m.regions) ?? lu, a = ((b = io()) == null ? void 0 : b.currentPage) ?? 1, s = K(() => ou(o), [o]), c = au(s, a), [i, l] = _(""), u = K(() => cu(o, i), [o, i]), d = A(null), f = A(null);
  return O(() => {
    var h, g, v;
    e === "search" ? (h = d.current) == null || h.focus() : (v = (g = f.current) == null ? void 0 : g.querySelector('[aria-current="location"]')) == null || v.scrollIntoView({ block: "center" });
  }, [e]), /* @__PURE__ */ F("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ F("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ F("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ y(Fe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ y(Fe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ y(Fe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ y(vn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? s.length ? /* @__PURE__ */ y("ol", { ref: f, className: "reader-finder-list", children: s.map((h, g) => /* @__PURE__ */ y("li", { children: /* @__PURE__ */ F(
      Fe,
      {
        className: "reader-finder-entry",
        "data-level": h.level,
        "aria-current": g === c ? "location" : void 0,
        onClick: () => r(h.itemId),
        children: [
          /* @__PURE__ */ y("span", { className: "reader-finder-entry-text", children: h.text }),
          /* @__PURE__ */ y("span", { className: "reader-finder-entry-page", children: h.page })
        ]
      }
    ) }, h.itemId)) }) : /* @__PURE__ */ y("p", { className: "reader-finder-empty", children: o.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ F(zt, { children: [
      /* @__PURE__ */ F("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ y(
          ra,
          {
            ref: d,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: i,
            onChange: (h) => l(h.target.value),
            onKeyDown: (h) => {
              h.key === "Enter" && u[0] && r(u[0].itemId), h.stopPropagation();
            }
          }
        ),
        i.trim() ? /* @__PURE__ */ y("p", { className: "reader-finder-count", children: u.length >= 200 ? "200 处以上，只列前 200 处" : `${u.length} 处` }) : null
      ] }),
      /* @__PURE__ */ y("ol", { className: "reader-finder-list", children: u.map((h) => /* @__PURE__ */ y("li", { children: /* @__PURE__ */ F(Fe, { className: "reader-finder-entry is-hit", onClick: () => r(h.itemId), children: [
        /* @__PURE__ */ F("span", { className: "reader-finder-entry-text", children: [
          h.snippet.slice(0, h.at),
          /* @__PURE__ */ y("mark", { children: h.snippet.slice(h.at, h.at + h.length) }),
          h.snippet.slice(h.at + h.length)
        ] }),
        /* @__PURE__ */ y("span", { className: "reader-finder-entry-page", children: h.page })
      ] }) }, h.itemId)) })
    ] })
  ] });
}
const fu = Lo(() => import("./ReaderMarkdownPanel-DSUaUCp-.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Kt = { source: "source", sideBySide: "compare", translated: "translated" };
function mu(e) {
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
function hu(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function pu() {
  const e = bi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = jl(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = _(null), [u, d] = _(!1), f = A(null), m = A(null), b = s !== null, h = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = mu({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: h,
    liveTranslationVisible: u,
    assistantOpen: b,
    assistantPdfPane: i
  }), v = oi({
    hasOverlayContent: h,
    connection: e.liveTranslation.connection,
    showSource: g.showSource,
    liveTranslationVisible: u,
    assistantOpen: b
  }), R = g.sourceViewOnly, w = g.visibleMode;
  O(() => {
    d(!1);
  }, [e.viewStateKey]), O(() => {
    e.session.jobTerminal && d(!1);
  }, [e.session.jobTerminal]), O(() => {
    l(null);
  }, [a.scope]), O(() => {
    if (!(t.loading || t.failed)) {
      if (f.current !== e.viewStateKey) {
        f.current = e.viewStateKey;
        const P = Re(e.viewStateKey), x = ql({
          savedMode: P == null ? void 0 : P.mode,
          sourceViewOnly: R,
          viewportWidth: je()
        });
        m.current = x.auto ? x.mode : null, x.mode && x.mode !== e.mode && e.setModeKeepingPage(x.mode);
        return;
      }
      Gl(e.mode, m.current) && (m.current = null, Ft(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, R]);
  const p = s || (e.mode === "compare" ? "compare" : "reading"), S = Zl(s, "markdown");
  Ii({
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
  const k = $(() => {
    c(null), l(null);
  }, []), N = $((P) => {
    l(null);
    const x = hu(P, e.liveTranslationAvailable);
    x !== null && d(x), e.setModeKeepingPage(P);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), B = K(() => v.sourcePaneToggle ? /* @__PURE__ */ y(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${u ? " is-active" : ""}`,
      onClick: () => d((P) => !P),
      "aria-pressed": u,
      title: u ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [v.sourcePaneToggle, u]), C = $((P) => {
    c(P), l(null);
  }, []), [D] = _(Yl), [I, T] = _(null), E = $((P) => T((x) => x === P ? null : P), []), M = $((P) => {
    e.jumpToAnchor({ block_id: P }), je() < 900 && T(null);
  }, [e.jumpToAnchor]), j = $((P) => e.jumpToAnchor({ block_id: P }), [e.jumpToAnchor]), U = Jl(), W = Mo(e.download), V = w === "compare" ? tt / 2 : tt, Q = A(!0);
  O(() => {
    U && Q.current && Math.abs(e.userZoom - V) > 1e-3 && e.onZoomChange(V);
  }, [U, V, e.userZoom, e.onZoomChange]);
  const z = K(
    () => W.downloadItems.filter((P) => pt(W.urls[P])).map((P) => ({ key: `download-${Kt[P]}`, label: `下载${Cr[P].label}` })),
    [W.downloadItems, W.urls]
  ), Y = K(() => ({
    ready: !t.loading && !t.failed,
    pageIdx: e.currentPage >= 1 ? e.currentPage - 1 : null,
    pageCount: n.hudNumPages >= 1 ? n.hudNumPages : null,
    modes: R ? ["source"] : ["source", "compare", "translated"],
    mode: w ?? null,
    panels: ["outline", "search"],
    panel: I,
    zoom: { percent: Hr(e.userZoom), fit: Math.abs(e.userZoom - V) < 1e-3 },
    actions: z
  }), [t.loading, t.failed, e.currentPage, n.hudNumPages, R, w, I, e.userZoom, V, z]);
  O(() => {
    var P;
    U && ((P = Xt()) == null || P.report(Y));
  }, [U, Y]);
  const ne = A(() => {
  });
  ne.current = (P) => {
    if (P.command === "mode")
      (!R || P.mode === "source") && N(P.mode);
    else if (P.command === "page")
      e.goToPage(P.pageIdx + 1);
    else if (P.command === "panel")
      T(P.panel);
    else if (P.command === "zoom")
      Q.current = P.zoom === "fit", e.onZoomChange(P.zoom === "fit" ? V : nt(e.userZoom, P.zoom === "in" ? 1 : -1));
    else if (P.command === "action") {
      const x = Object.keys(Kt).find((ae) => `download-${Kt[ae]}` === P.key);
      x && W.handleDownload(x);
    }
  }, O(() => {
    const P = Xt();
    if (!(!U || !P))
      return P.onCommand((x) => ne.current(x));
  }, [U]);
  const ee = K(() => ({
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
    regionHover: D,
    jumpToBlock: j,
    revisedBlocks: e.revisedBlocks,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: R,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: C, close: k }
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
    D,
    j,
    e.revisedBlocks,
    e.sourceOnly,
    R,
    e.download,
    e.goToPage,
    C,
    k
  ]), oe = K(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), pe = [
    cs,
    `is-workspace-${p}`,
    b ? "is-assistant-open" : "",
    I ? "is-finder-open" : "",
    U ? "is-host-chrome" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ y(ac, { value: ee, hud: oe, children: /* @__PURE__ */ F("div", { className: pe, "data-reader-engine": "react-pdf", "data-reader-workspace": p, children: [
    /* @__PURE__ */ y(Pl, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    U ? null : /* @__PURE__ */ y(uu, { open: I, onToggle: E }),
    I ? /* @__PURE__ */ y(
      du,
      {
        tab: I,
        onTab: T,
        onClose: () => T(null),
        onJump: M
      }
    ) : null,
    U ? null : /* @__PURE__ */ F("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ y(zi, {}),
      /* @__PURE__ */ y(Nl, {}),
      /* @__PURE__ */ y(_i, { onBeforeClose: o.prepareClose })
    ] }),
    U ? null : /* @__PURE__ */ y(
      kc,
      {
        mode: w,
        documentReady: !!o.jobId,
        sourceViewOnly: R,
        onModeChange: N,
        liveTranslation: v.topBarPill ? {
          visible: u,
          state: e.liveTranslation,
          onToggle: () => d((P) => !P)
        } : null
      }
    ),
    U ? null : /* @__PURE__ */ y(Dc, { active: s }),
    b ? /* @__PURE__ */ y(Sl, {}) : null,
    /* @__PURE__ */ y(Rc, { paneComposition: g, markdownSplit: S.open, assistantSplit: b, liveTranslation: e.liveTranslation, sourcePaneAction: B }),
    e.showHud && !U ? /* @__PURE__ */ y(
      $l,
      {
        mode: w,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ y(_o, { fallback: null, children: S.mounted ? /* @__PURE__ */ y(fu, { open: S.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: k }) : null }),
    /* @__PURE__ */ y(Hl, {})
  ] }) });
}
function Du() {
  return /* @__PURE__ */ y(pu, {});
}
export {
  Du as R,
  pu as a,
  Lu as d,
  _u as f,
  Cu as r,
  ze as u
};
//# sourceMappingURL=ReaderApp-9Zmx1a3L.js.map
