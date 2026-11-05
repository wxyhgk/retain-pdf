var Fn = (e) => {
  throw TypeError(e);
};
var $n = (e, t, n) => t.has(e) || Fn("Cannot " + n);
var ct = (e, t, n) => ($n(e, t, "read from private field"), n ? n.call(e) : t.get(e)), jn = (e, t, n) => t.has(e) ? Fn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Bn = (e, t, n, r) => ($n(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsx as y, jsxs as $, Fragment as Ct } from "react/jsx-runtime";
import { useMemo as Y, useState as L, useEffect as F, useCallback as U, useRef as A, useLayoutEffect as Ce, useSyncExternalStore as nt, memo as fn, createContext as mn, useContext as hn, forwardRef as Mo, useImperativeHandle as pn, useId as Ar, Suspense as Ao, lazy as No } from "react";
import { getReaderAdapters as se, requireAdapter as rt } from "./adapters.js";
import { resolveReaderDownloadName as _o, resolveReaderDownloadUrls as Lo, READER_PROGRESS_COPY as Ie, trimString as ht, READER_DOWNLOAD_ACTIONS as Nr, disabledReason as Co } from "./runtime/state.js";
import { r as zo, b as Do } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Kt, isFinishedJobStatus as gn } from "@retainpdf/domain/job";
import { c as xo, n as Oo, f as jt, j as Un, a as Fo, b as $o, h as _r, p as bn, d as jo, k as Hn, i as Bo } from "./reader-regions-CP3ZMHPc.js";
import { fetchDocumentReading as Uo } from "@retainpdf/api/documents";
import { isReaderTransportError as Ho, createReaderTransportError as Wo } from "./contracts.js";
import { toast as Zt, Toaster as Vo } from "sonner";
import { NotebookPen as Jo, X as yn, Radio as qo, FileText as Lr, Columns2 as Cr, Languages as zr, FileCode2 as Go, Sparkles as Ko, Keyboard as Zo, Download as Yo, ChevronDown as Xo, ListTree as Qo, Search as ea } from "lucide-react";
import { Button as De, Input as ta } from "@retainpdf/ui";
import { pdfjs as na, Page as ra, Document as oa } from "react-pdf";
import { extractMarkdownMath as aa, materializeMarkdownMathFallbackHtml as sa, materializeMarkdownMathHtml as ia } from "./runtime/content.js";
const ca = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, la = "", ua = Object.freeze({
  progress: "retainpdf-reader-progress"
}), da = (e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, ku = (...e) => {
  var n;
  return (((n = se()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Te = () => rt("defaultReaderDataPort"), Wn = () => rt("defaultReaderPageConfigPort"), Mu = {
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
}, Dr = {
  messageTargetOrigin: () => Wn().messageTargetOrigin(),
  readerJobId: () => Wn().readerJobId()
}, fa = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.liveTranslation) ?? null;
}, ma = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.notesQuote) ?? null;
}, ha = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.notesPanel) ?? null;
}, pa = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.readingPosition) ?? null;
}, ga = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.hostAi) ?? null;
}, ba = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.hostNavigation) ?? null;
}, ya = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.quotedBlocks) ?? null;
}, Yt = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.hostChrome) ?? null;
}, pt = () => {
  var t;
  const e = se();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, zt = () => {
  const e = se();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => rt("fetchDocumentByJobId")(...n),
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
}, va = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Sa = () => {
  var e, t;
  return ((t = (e = se()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, wa = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Pa = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? _o(...e);
}, Ra = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Lo(...e);
}, Ia = (...e) => rt("downloadProtectedResource")(...e), Ta = (...e) => rt("failDownloadToast")(...e), Au = (e, t) => rt("resolveMarkdownAssetUrl")(e, t), Vn = "/api/v1";
function Ea() {
  const e = () => {
    var r;
    return zo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = L(e);
  return F(() => {
    var c, i, l, u;
    const r = () => n(e()), o = (i = (c = globalThis.history) == null ? void 0 : c.pushState) == null ? void 0 : i.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const d = (f) => function(...m) {
          const g = f.apply(this, m);
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
function ka() {
  const e = Ea(), t = Y(() => wa(Dr), [e]), n = Y(() => Sa(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Ma(e) {
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
  }), f = i.documentId === t ? i.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || f, [h, p] = L({
    jobId: "",
    documentId: ""
  }), v = h.jobId === g ? h.documentId : "", w = t || v, S = !!t && !g, [b, P] = L(null), k = (b == null ? void 0 : b.sessionIdentity) === r && b.documentId === w ? b : null, _ = S || !!k, x = U((z) => {
    const R = `${z.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      p({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const I = `${z.revision || ""}`.trim() || `${Date.now()}`;
    P({
      documentId: R,
      revision: I,
      sessionIdentity: o.current
    }), c();
  }, []);
  F(() => {
    P((z) => z && z.sessionIdentity !== r ? null : z);
  }, [r]);
  const D = U((z) => {
    switch (z.type) {
      case "resolved-document-job":
        l({ documentId: z.documentId, jobId: z.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        d({ documentId: z.documentId, jobId: z.jobId });
        break;
      case "resolved-job-document":
        p((R) => R.jobId === z.jobId && R.documentId === z.documentId ? R : { jobId: z.jobId, documentId: z.documentId });
        break;
      case "committed-source":
        P({
          documentId: z.documentId,
          revision: z.revision,
          sessionIdentity: z.sessionIdentity
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
    sessionJobId: g,
    resolvedJobDocument: h,
    setResolvedJobDocument: p,
    jobDocumentId: v,
    documentId: w,
    sourceOnly: S,
    committedDocumentSource: b,
    setCommittedDocumentSource: P,
    activeCommittedDocumentSource: k,
    sourceViewOnly: _,
    refreshCommittedDocument: x,
    applyIdentityEvent: D
  };
}
function Jn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Aa(e) {
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
  return da(Kt(e, t));
}
function Na(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function _a(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Na(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Xt({
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
      Dr.messageTargetOrigin()
    );
  } catch {
  }
}
function kt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Xt({ percent: t, text: n, stage: r });
}
function La(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = L(null), [l, u] = L(null), [d, f] = L(""), [m, g] = L(0), h = d === n ? c : null, p = d === n ? l : null, v = Jn(h), w = gn(v), S = U(() => {
    g((D) => D + 1);
  }, []), b = U((D) => {
    i(D.jobPayload), u(D.manifestPayload), f(D.sessionIdentity);
  }, []), P = U((D) => {
    i(null), u(null), f(D);
  }, []), k = A(""), _ = A(""), x = U(async () => {
    const D = o.current;
    if (!D || k.current === D) return;
    const z = zt().loadJobPayload;
    if (typeof z != "function") return;
    const R = a.current.value;
    k.current = D;
    try {
      const I = await z(D);
      if (s.current || a.current.value !== R || o.current !== D || !I || typeof I != "object")
        return;
      const T = Jn(I);
      i(I), f(r.current), T === "succeeded" && _.current !== D && (_.current = D, g((M) => M + 1));
    } catch {
    } finally {
      k.current === D && (k.current = "");
    }
  }, []);
  return F(() => {
    _.current = "";
  }, [n]), F(() => {
    if (!t || w || !h) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && x();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [w, x, h, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: f,
    scopedJobPayload: h,
    scopedManifestPayload: p,
    jobStatus: v,
    jobTerminal: w,
    jobRefreshRevision: m,
    refreshJobArtifacts: S,
    refreshJobStatus: x,
    publishPayload: b,
    clearPayload: P
  };
}
function Qt(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ca(e, t) {
  e(t), Qt(t);
}
function za(e) {
  const [t, n] = L(e ? "source" : "compare"), r = U((a) => {
    e && a !== "source" || (n(a), Qt(a));
  }, [e]), o = U((a) => {
    Ca(n, a);
  }, []);
  return F(() => (e && document.documentElement.classList.add("reader-source-only"), Qt(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Gn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Da(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Gn(n.active_job_id),
    activeVersionId: Gn(n.active_version_id)
  };
}
function xa(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Oa(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Fa(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const $a = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function ja(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = $a.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
function Ba(e) {
  return e ? { data: e.data.slice() } : null;
}
const Ua = 2, ye = /* @__PURE__ */ new Map();
function en(e, t) {
  ye.delete(e), ye.set(e, t);
}
function Ha(e) {
  if (ye.size < Ua) return;
  const t = ye.keys().next().value;
  t && ye.delete(t);
}
async function Wa(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function xr(e, t = pt().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ye.has(r)) {
    const c = ye.get(r);
    return en(r, c), c;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const c = new Error(`读取 PDF 失败 (${o.status})`);
    c.status = o.status;
    const i = await Wa(o);
    throw i && (c.reason = i), c;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return ye.has(r) ? en(r, s) : (Ha(), ye.set(r, s)), s;
}
const Va = { file: null, loading: !1, error: "" }, Ja = { file: null, loading: !0, error: "" };
function qa(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = L(null);
  if (F(() => {
    if (t || !n) return;
    const s = ye.get(n);
    if (s) {
      en(n, s);
      return;
    }
    const c = new AbortController();
    return xr(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Va;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = ye.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ja;
}
function Ga(e) {
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
async function tn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  kt(s, r, n, "download");
  const c = await xr(t, pt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (kt(s, o, n, "download"), c);
}
async function Ka(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  kt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, c = null;
  return t && a.push(
    tn({
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
    tn({
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
function Za(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ya({
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
  return a === n || !o ? !1 : (o.replace(Za(o.href, t, a)), !0);
}
const wt = {
  regions: null,
  metadata: null
};
function Xa(e) {
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
    jobRefreshRevision: g,
    sessionEpochRef: h,
    closingRef: p,
    activeLoadAbortRef: v
  } = e, [w, S] = L(""), [b, P] = L(""), [k, _] = L(null), [x, D] = L(null), [z, R] = L(!1), [I, T] = L(""), [M, j] = L([]), [H, W] = L(!1), [J, oe] = L(() => ({
    source: null,
    translated: null
  })), [O, Q] = L(
    wt
  ), [te, N] = L({
    loading: !0,
    percent: 4,
    text: Ie.boot,
    stage: "progress",
    failed: !1
  });
  return F(() => {
    const G = new AbortController(), ae = h.current.value, E = Ga({
      sessionEpochRef: h,
      closingRef: p,
      abort: G,
      sessionEpoch: ae
    });
    v.current = G;
    const B = zt();
    if (p.current)
      return G.abort(), () => {
        v.current === G && (v.current = null);
      };
    let pe = !1;
    function de(re, fe) {
      E.markFailed(), W(!0), N({
        loading: !1,
        percent: 100,
        text: re,
        stage: "failed",
        failed: !0
      }), Xt({ percent: 100, text: fe, stage: "failed" });
    }
    function Me() {
      R(!0), pe || W(!0), N({
        loading: !1,
        percent: 100,
        text: Ie.ready,
        stage: "ready",
        failed: !1
      }), Xt({ percent: 100, text: Ie.ready, stage: "ready" });
    }
    function Ft() {
      return l != null && l.documentId ? qn(
        l.documentId,
        l.revision
      ) : ca() ? la : B.resolveResourceUrl(Kt(r));
    }
    async function We() {
      var ce;
      let re = { activeJobId: "", activeVersionId: "" };
      try {
        const le = await ((ce = B.fetchDocument) == null ? void 0 : ce.call(B, r));
        le && (re = Da(le));
      } catch {
      }
      const fe = xa({
        link: re,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (fe.kind === "follow-active-job") {
        if (E.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: fe.jobId
        }), fe.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: fe.activeVersionId,
          sessionIdentity: i
        }), m("source")) : m("compare");
        return;
      }
      if (fe.kind === "open-committed-source") {
        if (E.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: fe.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const ge = Ft();
      if (E.isInactive()) return;
      S(ge), P(""), T(""), f(i);
      const ie = await tn({
        url: ge,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: E,
        setBoot: N
      });
      if (!E.isInactive()) {
        if (!ie) {
          de("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        _(ie), Me();
      }
    }
    async function ot() {
      var K;
      const re = !l, fe = !!(re && B.loadSessionSnapshot && B.loadReaderOptionalArtifacts), ge = fe ? B.loadReaderOptionalArtifacts(t) : null, ie = await ((K = B.loadSessionSnapshot) == null ? void 0 : K.call(B, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: re && !fe
      })), ce = ie ? {
        jobPayload: ie.sourcePayload,
        manifestPayload: ie.manifestPayload,
        readerMetadata: ie.readerMetadata,
        regionsPayload: ie.regions,
        readerErrors: ie.readerErrors
      } : await B.loadReaderPayload(t, {
        includeOptionalArtifacts: re
      });
      if (E.isInactive()) return;
      let le = null;
      if (n && !r)
        if (ie && ie.linkedDocument !== void 0)
          le = ie.linkedDocument;
        else {
          try {
            le = await B.fetchDocumentByJobId(Vn, t);
          } catch {
          }
          if (E.isInactive()) return;
        }
      const Ve = Aa(ce.jobPayload) || `${(le == null ? void 0 : le.document_id) || ""}`.trim();
      Ve && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ve
      });
      const Re = Oa({
        payloadDocumentId: Ve,
        linkedActiveJobId: `${(le == null ? void 0 : le.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(le == null ? void 0 : le.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Re.kind === "restore-committed-source") {
        if (E.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Re.documentId,
          revision: Re.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const Ae = B.resolveReaderSourcePdf(ce.manifestPayload), at = B.resolveReaderTranslatedPdfUrl(ce.jobPayload, ce.manifestPayload), $t = typeof Ae == "string" ? Ae : B.resolveReaderArtifactUrl(Ae), St = r || Ve, st = l != null && l.documentId ? qn(
        l.documentId,
        l.revision
      ) : $t || (St ? B.resolveResourceUrl(Kt(St)) : ""), it = l ? "" : at || "";
      S(st || ""), P(it), T(_a(ce.jobPayload, t)), d({
        jobPayload: ce.jobPayload || null,
        manifestPayload: ce.manifestPayload || null,
        sessionIdentity: i
      });
      const C = () => Ka({
        sourceFinal: st || "",
        translatedFinal: it,
        fence: E,
        setBoot: N
      }), q = !!(st || it), V = ge && q ? C() : null;
      V == null || V.catch(() => {
      });
      const Z = (X) => {
        E.isInactive() || (j(l ? [] : xo(X.regionsPayload)), oe(l ? { source: null, translated: null } : Oo(X.readerMetadata)), Q(l ? wt : X.readerErrors ?? wt), W(!0));
      };
      if (ge ? (pe = !0, ge.then(Z)) : Z(ce), !q) {
        de(Ie.failed, Ie.failed);
        return;
      }
      const ne = await (V ?? C());
      if (ne.status !== "inactive") {
        if (ne.status === "incomplete") {
          de("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        _(ne.sourceBytes), D(ne.translatedBytes), Me();
      }
    }
    async function Pe() {
      R(!1), _(null), D(null), j([]), W(!1), oe({ source: null, translated: null }), Q(wt), kt(N, 8, Ie.metadata, "metadata");
      try {
        if (s) {
          await We();
          return;
        }
        if (!t) {
          de(Ie.failed, Ie.failed);
          return;
        }
        await ot();
      } catch (re) {
        if (E.isClosedOrStale() || (re == null ? void 0 : re.name) === "AbortError") return;
        E.markFailed();
        const fe = Number(re == null ? void 0 : re.status), ge = `${(re == null ? void 0 : re.reason) || ""}`, ie = ja({ status: fe, reason: ge, sessionJobId: t });
        if (ie && (await Ya({
          apiPrefix: Vn,
          documentId: ie,
          expiredJobId: t
        }) || E.isClosedOrStale()))
          return;
        if (Fa({
          status: fe,
          reason: ge,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const ce = re instanceof Error ? re.message : Ie.failed;
        de(ce, ce);
      }
    }
    return Pe(), () => {
      G.abort(), v.current === G && (v.current = null);
    };
  }, [t, r, o, a, s, c, l, g, n, i, u, d, f, m]), {
    sourceUrl: w,
    translatedUrl: b,
    sourceFile: k,
    translatedFile: x,
    assetsReady: z,
    title: I,
    regions: M,
    regionsSettled: H,
    readerMetadata: J,
    readerErrors: O,
    boot: te
  };
}
function Qa() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = ka(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = A(a), i = A(""), l = A(""), u = A(() => {
  }), d = U(() => u.current(), []), f = Ma({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: c,
    documentIdRef: i,
    sessionJobIdRef: l,
    switchToSourceMode: d
  }), {
    sessionJobId: m,
    documentId: g,
    sourceOnly: h,
    sourceViewOnly: p
  } = f, { mode: v, setMode: w, switchSessionMode: S } = za(p);
  u.current = () => {
    S("source");
  }, c.current = a, i.current = g, l.current = m;
  const b = La({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: P,
    scopedManifestPayload: k,
    jobStatus: _,
    jobTerminal: x,
    jobRefreshRevision: D,
    refreshJobArtifacts: z,
    refreshJobStatus: R
  } = b, I = Xa({
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
    publishPayload: b.publishPayload,
    clearPayload: b.clearPayload,
    switchSessionMode: S,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = U(() => {
    var j;
    e.current = !0, (j = t.current) == null || j.abort();
  }, []), M = Y(
    () => ({
      fetchProtected: zt().fetchProtected,
      jobId: m,
      jobPayload: P,
      manifestPayload: k,
      sourceUrl: I.sourceUrl,
      translatedUrl: I.translatedUrl,
      sourceOnly: p
    }),
    [m, P, k, I.sourceUrl, I.translatedUrl, p]
  );
  return {
    jobId: m,
    jobStatus: _,
    workflow: `${(P == null ? void 0 : P.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: x,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: v,
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
    refreshJobArtifacts: z,
    refreshJobStatus: R,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: T
  };
}
const es = 160, ts = 8, ns = 0;
function rs() {
  const e = A(null), [t, n] = L(null), [r, o] = L(ns), a = U((s) => {
    e.current = s, n(s);
  }, []);
  return F(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < es || o((u) => Math.abs(u - l) < ts ? u : l);
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
function os(e) {
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
function as(e, t) {
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
  const [d, f] = L(() => ({
    identity: l,
    pages: Bt
  })), [m, g] = L(() => ({ identity: l, tick: 0 })), h = d.identity === l ? d.pages : Bt, p = m.identity === l ? m.tick : 0, v = os({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: w } = v, S = U((R, I) => {
    u.current === l && f((T) => {
      const M = T.identity === l ? T.pages : Bt;
      return M[I] === R && T.identity === l ? T : {
        identity: l,
        pages: { ...M, [I]: R }
      };
    });
  }, [l]), b = A(null), P = U(() => {
    b.current && clearTimeout(b.current);
    const R = l;
    b.current = setTimeout(() => {
      b.current = null, u.current === R && g((I) => ({
        identity: R,
        tick: I.identity === R ? I.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  F(() => (b.current && (clearTimeout(b.current), b.current = null), f((R) => R.identity === l && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: l, pages: { source: 0, translated: 0 } }), g((R) => R.identity === l && R.tick === 0 ? R : { identity: l, tick: 0 }), () => {
    b.current && (clearTimeout(b.current), b.current = null);
  }), [l]);
  const k = Y(
    () => Math.max(h.source, h.translated),
    [h]
  ), _ = w === "translated" ? h.translated : h.source || h.translated, x = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, z = `${l}-${p}-${x}-${n}-${h.source}-${h.translated}-${D}`;
  return {
    ...v,
    numPagesByPane: h,
    hudNumPages: k,
    primaryNumPages: _,
    metricsTick: p,
    onNumPages: S,
    onMetrics: P,
    rowSyncRevision: z
  };
}
const Fe = "data-reader-page", Xe = "data-reader-pane", vn = "data-natural-height", ss = "reader-react-root", is = "reader-react-grid", cs = "reader-react-scroll-shell", ls = "reader-react-pdf-pane", Or = "reader-react-pdf-page", Mt = "reader-react-pdf-page-placeholder", Sn = "reader-react-pdf-page-slot";
function At(e, t) {
  const n = e != null ? `[${Fe}="${e}"]` : `[${Fe}]`;
  return t ? `${n}[${Xe}="${t}"]` : n;
}
function us() {
  return `.${Sn}[${Fe}]`;
}
function wn(e) {
  return Number(e.getAttribute(Fe));
}
const Fr = 0.25, Qe = 1, ds = 0.05, vt = 0.5, fs = 16, ms = 8, hs = 720;
function Oe() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function $r(e) {
  return Number.isFinite(e) && e < hs;
}
function Ge(e, t = Number.POSITIVE_INFINITY) {
  return $r(t) && (e === "source" || e === "translated") ? Qe : vt;
}
function Dt(e) {
  return Number.isFinite(e) ? Math.min(Qe, Math.max(Fr, e)) : vt;
}
function et(e, t) {
  const n = Dt(Number(e) + t * ds);
  return Math.round(n * 100) / 100;
}
function jr(e) {
  return Math.round(Dt(e) * 100);
}
function ps(e) {
  const n = (Number(e) || 0) - fs - ms;
  return Math.max(160, Math.floor(n));
}
function gs(e, t = vt) {
  const n = Dt(t);
  return ps((Number(e) || 0) * n);
}
function bs(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Xe}]`)
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
const ys = 8;
function vs(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < ys ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Br = 200, Ur = [
  "markdown"
], Ss = Ur;
function Hr(e) {
  return Ss.includes(e);
}
const ws = "retainpdf:reader:view:v1:", Kn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Ps = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Wr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function nn(e) {
  return `${e || ""}`.trim();
}
function Rs({
  documentId: e,
  jobId: t
}) {
  const n = nn(e);
  if (n) return `document:${n}`;
  const r = nn(t);
  return r ? `job:${r}` : "";
}
function Vr(e) {
  const t = nn(e);
  return t ? `${ws}${t}` : "";
}
function Is(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Ts(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Kn.has(t) || !Kn.has(n) || t === n))
    return { left: t, right: n };
}
function Es(e) {
  return e === null ? null : Hr(e) ? e : void 0;
}
function ks(e) {
  return Ps.has(e) ? e : void 0;
}
function Jr(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Is(t.anchor), r = Number(t.zoom), o = ks(t.mode), a = Ts(t.splitLayout), s = Es(t.assistantPanel);
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
function we(e, t = Wr()) {
  const n = Vr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Jr(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function xt(e, t, n = Wr()) {
  const r = Vr(e);
  if (!r || !n) return null;
  const o = we(e, n), a = Jr({
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
function Ms(e, t, n = "") {
  var f;
  const [r, o] = L(() => {
    var m;
    return ((m = we(n)) == null ? void 0 : m.zoom) ?? Ge(e, Oe());
  }), a = A(r), s = A(n);
  a.current = r;
  const c = A(1), i = A(((f = we(n)) == null ? void 0 : f.zoom) !== void 0);
  F(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = we(n)) == null ? void 0 : h.zoom;
    i.current = m !== void 0;
    const g = m ?? Ge(e, Oe());
    c.current = 1, a.current = g, o(g);
  }, [e, n]), F(() => {
    if (i.current) return;
    const m = Ge(e, Oe()), g = a.current;
    Math.abs(m - g) < 5e-4 || (c.current = 1, a.current = m, o(m));
  }, [e]);
  const l = U((m) => {
    const g = Dt(m), h = a.current;
    Math.abs(g - h) < 5e-4 || (c.current = g / (h || 1), i.current = !0, xt(s.current, { zoom: g }), o(g));
  }, []), u = U((m) => {
    l(et(a.current, m));
  }, [l]), d = U((m) => {
    l(Ge(m));
  }, [l]);
  return Ce(() => {
    const m = c.current;
    Math.abs(m - 1) < 1e-3 || (c.current = 1, bs(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function As(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: U((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const Pn = 48;
function qr(e, t = Pn) {
  return e.getBoundingClientRect().top + t;
}
function Gr(e, t) {
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
  const o = wn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function Tt(e, t, n = Pn) {
  if (!e)
    return null;
  const r = At(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = qr(e, n), c = Gr(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function Ot(e, t, n = "auto", r, o = Pn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(At(a, r))), c || (c = e.querySelector(At(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), f = Math.max(0, d + s * u - o);
  return n === "auto" ? e.scrollTop = f : e.scrollTo({ top: f, behavior: n }), !0;
}
function Ns(e, t, n = "smooth", r) {
  return Ot(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function rn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const c = [], i = () => {
    var u;
    if (a) return;
    Ot(
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
function _s(e, t, n) {
  return rn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Nt(e, t) {
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
function Ls(e, t, n = !0, r = "", o) {
  const [a, s] = L(1);
  return F(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, u = 0;
    const d = At(void 0, o), f = () => {
      if (i) return;
      const h = Array.from(c.querySelectorAll(d));
      if (!h.length)
        return;
      const p = qr(c), v = Gr(h, p);
      v && s(v.page);
    }, m = () => {
      i || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, f();
      }));
    }, g = () => {
      if (i) return;
      if (!Array.from(c.querySelectorAll(d)).length) {
        l = setTimeout(g, 120);
        return;
      }
      f(), c.addEventListener("scroll", m, { passive: !0 });
    };
    return g(), () => {
      i = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), c.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const Cs = `canvas, .react-pdf__Page, .${Or}, .${Mt}`, Zn = /* @__PURE__ */ new WeakMap();
function zs(e) {
  const t = Number(e.getAttribute(vn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Zn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Cs), Zn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Ds(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function xs(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(us()).forEach((r) => {
    const o = wn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = zs(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Os(e, t, n = "", r) {
  const [o, a] = L(() => /* @__PURE__ */ new Map()), s = A(o), c = A(r);
  return c.current = r, Ce(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
    const f = () => {
      var P;
      if (i) return;
      const S = e.current;
      if (!S) return;
      const b = xs(S);
      Ds(s.current, b) || (s.current = b, a(b)), u && !d && (d = !0, (P = c.current) == null || P.call(c));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), p = window.setTimeout(m, 700), v = e.current;
    let w = null;
    return v && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => m()), w.observe(v)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(p), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const Fs = [0, 48, 140, 320, 560], $s = 700, js = [80, 200, 400], Bs = 500, Us = 50, Hs = /* @__PURE__ */ new Set([
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
]), Ws = 180, Yn = [0, 48, 140, 320, 700, 1200];
function Vs(e, t) {
  var I;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = A(
    ((I = we(a)) == null ? void 0 : I.anchor) || { page: 1, fraction: 0 }
  ), i = A(null), l = A(!1), u = A(r), d = A(null), f = A(null), m = A(null), g = A(null), h = A(a), p = A(""), v = A(n);
  v.current = n;
  const w = U(() => {
    var T;
    (T = d.current) == null || T.call(d), d.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), S = U(() => {
    !l.current && i.current == null || (w(), m.current != null && (clearTimeout(m.current), m.current = null), i.current = null, l.current = !1);
  }, [w]), b = U((T = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const M = () => {
      g.current = null, xt(h.current, {
        anchor: be(c.current)
      });
    };
    T ? M() : g.current = setTimeout(M, Ws);
  }, []), P = U((T) => {
    c.current = be(T), i.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Us);
  }, []);
  F(() => {
    if (!o)
      return;
    let T = !1, M = null, j = null, H = null;
    const W = () => {
      if (T) return;
      const J = e.current;
      if (!J) {
        H = setTimeout(W, 50);
        return;
      }
      M = J, j = () => {
        if (l.current)
          return;
        const oe = Tt(M, v.current);
        oe && (c.current = oe, b());
      }, M.addEventListener("scroll", j, { passive: !0 }), l.current || j();
    };
    return W(), () => {
      T = !0, H != null && clearTimeout(H), M && j && M.removeEventListener("scroll", j);
    };
  }, [o, r, n, e, b]), F(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const M = (j) => {
      j.metaKey || j.ctrlKey || j.altKey || Hs.has(j.key) && S();
    };
    return T.addEventListener("wheel", S, { passive: !0 }), T.addEventListener("touchmove", S, { passive: !0 }), window.addEventListener("keydown", M), () => {
      T.removeEventListener("wheel", S), T.removeEventListener("touchmove", S), window.removeEventListener("keydown", M);
    };
  }, [o, e, S]), Ce(() => {
    var M;
    if (h.current === a) return;
    b(!0), w(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, p.current = "";
    const T = (M = we(a)) == null ? void 0 : M.anchor;
    c.current = T ? be(T) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, b, w]), F(() => {
    var M;
    if (!o || !s || !a || p.current === a) return;
    p.current = a;
    const T = be(
      ((M = we(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = T, i.current = T, l.current = !0, w(), d.current = rn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: v.current,
        delaysMs: Yn,
        onDone: () => P(T)
      }
    ), f.current = setTimeout(() => {
      f.current = null, P(T);
    }, Math.max(...Yn) + 160), () => w();
  }, [o, s, a, e, P, w]), F(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, w();
      return;
    }
    const T = i.current ? be(i.current) : be(c.current);
    return l.current = !0, i.current = T, c.current = T, w(), d.current = rn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Fs,
        onDone: () => P(T)
      }
    ), f.current = setTimeout(() => {
      f.current = null, P(T);
    }, $s), () => {
      w();
    };
  }, [r, o, n, e, P, w]), F(() => () => {
    w(), m.current != null && (clearTimeout(m.current), m.current = null), b(!0);
  }, [w, b]);
  const k = U(() => {
    const T = Tt(
      e.current,
      v.current
    );
    return be(T || c.current);
  }, [e]), _ = U(() => {
    l.current = !0;
    const T = Tt(
      e.current,
      v.current
    ), M = be(T ?? c.current);
    return c.current = M, i.current = M, b(), M;
  }, [e, b]), x = U((T, M, j) => {
    const H = j || v.current, W = Nt(T, M || 1), J = { page: W, fraction: 0 };
    c.current = J, l.current = !0, i.current = J, b(), w(), Ns(e.current, W, "smooth", H), d.current = _s(
      () => e.current,
      W,
      {
        behavior: "auto",
        pane: H,
        delaysMs: js,
        onDone: () => P(J)
      }
    ), f.current = setTimeout(() => {
      f.current = null, P(J);
    }, Bs);
  }, [e, P, w, b]), D = U(() => be(c.current), []), z = U(() => l.current, []), R = U(() => {
    if (!l.current || !i.current)
      return;
    const T = be(i.current);
    Ot(
      e.current,
      T,
      "auto",
      v.current
    );
  }, [e]);
  return {
    lockFromShell: k,
    beginModeSwitch: _,
    goToPage: x,
    getAnchor: D,
    isRestoring: z,
    repinIfRestoring: R
  };
}
function Js(e, t) {
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
function Kr(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const qs = [0, 80, 200, 400, 800], Gs = 120, Ks = 400;
function Zs(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l, regionsSettled: u = !0 } = e, d = A(a);
  d.current = a;
  const f = A(s);
  f.current = s;
  const m = A(c);
  m.current = c;
  const g = A(n);
  g.current = n, F(() => {
    var b, P;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = va(), p = Js(h, f.current);
    if (p == null && (h != null && h.blockId) && !u) return;
    const v = Kr(h, p, { jobId: i, documentId: l });
    if (t.current === v)
      return;
    if (p == null) {
      t.current = v, (b = g.current) == null || b.call(g);
      return;
    }
    t.current = v, h && ((P = m.current) == null || P.call(m, h, p));
    const w = [];
    let S = 0;
    for (const k of qs)
      S = Math.max(S, k), w.push(
        setTimeout(() => {
          d.current(p);
        }, k)
      );
    return w.push(
      setTimeout(() => {
        var k;
        (k = g.current) == null || k.call(g);
      }, S + Gs)
    ), () => {
      for (const k of w) clearTimeout(k);
    };
  }, [r, o, i, l, t, u]);
}
function Ys(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Xs(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Ks,
    jobId: c,
    documentId: i,
    applyReaderSearch: l
  } = e, u = A(a);
  u.current = a;
  const d = A(l);
  d.current = l;
  const f = A(0);
  F(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const m = setTimeout(() => {
      var v;
      const g = ((v = globalThis.location) == null ? void 0 : v.search) || "", h = Do(g, o, u.current);
      if (f.current = o, h === null) return;
      const p = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Kr(
        { blockId: p },
        o,
        { jobId: c, documentId: i }
      ), (d.current || Ys)(h);
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
function Qs(e) {
  const t = A(""), [n, r] = L(!1), o = U(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Zs(a, t, o), Xs(e, t, n);
}
const lt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function ei(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Xn(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Zr(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Xn(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Xn(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function ti(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Zr(r, t, n);
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
function ni(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const Qn = [250, 500, 1e3, 2e3, 4e3], Ut = [80, 160, 320, 640, 1e3, 1500], er = [250, 500, 1e3, 2e3, 4e3, 5e3];
function on(e, t) {
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
function Pt(e, t) {
  const n = Rn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ri(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Zr(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
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
    const c = Ut[Math.min(s, Ut.length - 1)];
    if (await on(c, r), s >= Ut.length + 2) throw a;
  }
}
function oi({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = L(lt), s = A(o), c = A("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = gn(l) ? l : "";
  return F(() => {
    if (!n || !i) {
      c.current = "", s.current = lt, a(lt);
      return;
    }
    const d = r === void 0 ? fa() : r, f = c.current === i;
    if (c.current = i, !d) {
      const S = {
        ...f ? s.current : lt,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = S, a(S);
      return;
    }
    const m = new AbortController();
    let g = !1;
    const h = {
      ...f ? s.current : lt,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const p = (S) => {
      m.signal.aborted || a((b) => {
        const P = S(b);
        return s.current = P, P;
      });
    }, v = async () => {
      let S = 0;
      for (; !m.signal.aborted; )
        try {
          const b = await d.fetchLayout(i, { signal: m.signal });
          g = !0, p((P) => ({
            ...P,
            layoutByPage: ei(b),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError") return;
          const P = Rn(b);
          if (!(P === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !P)) {
            p((_) => ({
              ..._,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Pt(b, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            p((_) => ({
              ..._,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          p((_) => ({
            ..._,
            connection: "connecting",
            jobStatus: l,
            error: Pt(b, "正在等待 OCR 版面数据")
          })), await on(Qn[Math.min(S, Qn.length - 1)], m.signal).catch(() => {
          }), S += 1;
        }
    };
    return (async () => {
      if (await v(), !g || m.signal.aborted) return;
      let S = 0;
      for (; !m.signal.aborted; ) {
        u || p((b) => ({
          ...b,
          connection: b.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: b.error
        }));
        try {
          await d.streamEvents(i, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (b) => {
              if (b.seq <= s.current.lastSeq) return;
              let P;
              try {
                P = await ri(
                  i,
                  b,
                  s.current,
                  m.signal,
                  d
                );
              } catch (k) {
                if ((k == null ? void 0 : k.name) === "AbortError" || m.signal.aborted) throw k;
                p((_) => ({
                  ..._,
                  lastSeq: Math.max(_.lastSeq, b.seq),
                  error: Pt(k, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              p((k) => {
                const _ = ti(k, b, P);
                return u ? {
                  ..._,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ..._,
                  jobStatus: l
                };
              }), S = 0;
            }
          });
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError" || m.signal.aborted) return;
          p((P) => ({
            ...P,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: Pt(b, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          p((b) => ({
            ...b,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await on(er[Math.min(S, er.length - 1)], m.signal).catch(() => {
        }), S += 1;
      }
    })(), () => m.abort();
  }, [n, r, i, u]), o;
}
function ai(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, c = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    c && i > 0 && o.set(c, i);
  }
  return o;
}
function si(e, t = !0) {
  const [n, r] = L(() => /* @__PURE__ */ new Map());
  return F(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = zt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((c) => {
      !s && c && r(ai(c));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const ii = /* @__PURE__ */ new Set(), ci = () => () => {
}, li = () => ii;
function ui() {
  const e = ya(), t = (e == null ? void 0 : e.get) ?? li;
  return nt((e == null ? void 0 : e.subscribe) ?? ci, t, t);
}
const di = 2e3;
function fi(e) {
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
const mi = /* @__PURE__ */ new Set(["book", "translate"]);
function Yr(e) {
  return !!(e.jobId && e.sourceUrl && mi.has(e.workflow));
}
function hi(e) {
  return !!(Yr(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function pi() {
  const e = Qa(), t = Yr({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = hi({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !gn(o) && (r.current.running = !0);
  const a = oi({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = rs(), u = si(e.jobId, !e.sourceOnly), d = ui(), f = Rs({
    documentId: e.documentId,
    jobId: e.jobId
  }), m = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: g, onZoomChange: h } = Ms(e.mode, s, f), p = as(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: g, shellWidth: i, identityKey: m }
  ), {
    beginModeSwitch: v,
    goToPage: w,
    repinIfRestoring: S
  } = Vs(s, {
    primaryPane: p.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: p.primaryNumPages > 0
  });
  F(() => {
    S();
  }, [i, S]);
  const b = Os(
    s,
    p.compareMode,
    p.rowSyncRevision,
    S
  ), P = Ls(
    s,
    p.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${g}-${p.metricsTick}`,
    p.primaryPane
  ), k = U((O, Q) => {
    var N, G;
    const te = Math.max(
      Number(p.hudNumPages) || 0,
      Number(p.primaryNumPages) || 0,
      Number((N = p.numPagesByPane) == null ? void 0 : N.source) || 0,
      Number((G = p.numPagesByPane) == null ? void 0 : G.translated) || 0
    );
    w(O, te, Q);
  }, [w, p.hudNumPages, p.primaryNumPages, p.numPagesByPane]), [_, x] = L(null), D = A(null), z = U((O) => {
    D.current && clearTimeout(D.current), x(O), O && (D.current = setTimeout(() => x(null), di));
  }, []);
  F(() => () => {
    D.current && clearTimeout(D.current);
  }, []);
  const R = U((O) => {
    const Q = jt(e.regions, O);
    return Q ? Un(Q, p.primaryPane).page : null;
  }, [e.regions, p.primaryPane]), I = U((O, Q) => {
    const te = Q || p.primaryPane, N = typeof O == "object" && O ? `${O.block_id || ""}`.trim() : "", G = typeof O == "object" && O ? `${O.image_url || ""}`.trim() : "", ae = typeof O == "object" && O ? O.page_idx != null ? Number(O.page_idx) + 1 : O.page != null ? Number(O.page) : null : typeof O == "number" ? O + 1 : null, E = Fo(e.regions, G, ae) || jt(e.regions, N) || (typeof O == "object" ? $o(e.regions, O) : null);
    let B = E ? Un(E, te).page : null;
    B == null && (B = fi(O)), !(B == null || B < 1) && (z(E), k(B, te));
  }, [z, k, p.primaryPane, e.regions]);
  Qs({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: p.hudNumPages || 0,
    currentPage: P,
    goToPage: k,
    resolveBlockPage: R,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (O) => {
      z(jt(e.regions, O.blockId));
    }
  });
  const T = !e.boot.loading && !e.boot.failed && e.assetsReady, M = Number(p.hudNumPages) || 0;
  F(() => {
    var O;
    T && ((O = pa()) == null || O.report(P >= 1 ? P - 1 : null, M >= 1 ? M : null));
  }, [T, P, M]), F(() => {
    const O = ba();
    if (!(!O || !T || !e.jobId))
      return O.subscribe(({ jobId: Q, pageIdx: te, blockId: N }) => Q !== e.jobId ? !1 : (I({ ...te != null ? { page_idx: te } : {}, ...N ? { block_id: N } : {} }), !0));
  }, [T, e.jobId, I]);
  const { setModeKeepingPage: j } = As({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  F(() => {
    z(null);
  }, [m, z]);
  const H = !e.boot.loading && !e.boot.failed, W = Y(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), J = Y(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), oe = Y(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: g,
    onZoomChange: h,
    shell: W,
    panes: p,
    sessionFiles: J,
    rowHeights: b,
    goToPage: k,
    activeRegion: _,
    jumpToAnchor: I,
    setModeKeepingPage: j,
    download: e.download,
    showHud: H,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u,
    quotedBlocks: d
  }), [e, W, p, J, b, k, _, I, j, H, g, h, f, a, n, u, d]);
  return Y(() => ({
    ...oe,
    currentPage: P
  }), [oe, P]);
}
const gi = [
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
], bi = [
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
function yi(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of gi)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function vi(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Si = ".reader-notes-panel";
function wi(e) {
  return e instanceof Element ? !!e.closest(Si) : !1;
}
function Pi(e) {
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
  F(() => {
    if (!l)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || vi(d.target) || wi(d.target))
        return;
      const f = d.key, m = yi(f);
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
              a(et(o, 1));
              return;
            case "zoom-out":
              a(et(o, -1));
              return;
            case "zoom-reset":
              a(Ge(t, Oe()));
              return;
            case "next-page":
              i(Nt(s + 1, c));
              return;
            case "prev-page":
              i(Nt(s - 1, c));
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
const Ri = "retainpdf:soft-reader-close";
function Xr(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed") || ""}`.trim();
  } catch {
    return "";
  }
}
function Ii(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed_pane") || ""}`.trim();
  } catch {
    return "";
  }
}
function Ti() {
  const e = new URL("./index.html", window.location.href), t = Xr();
  return t && e.searchParams.set("embed", t), e.href;
}
function Ei() {
  if (typeof window > "u" || window.self === window.top || Xr()) return !1;
  try {
    return window.parent.postMessage(
      { type: Ri },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function ki(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Mi() {
  if (!(typeof window > "u") && !Ei()) {
    if (ki(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Ti());
  }
}
function Qr({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ y("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ai({ onBeforeClose: e } = {}) {
  return Ii() === "beside" ? null : /* @__PURE__ */ $(Qr, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Mi();
  }, children: [
    /* @__PURE__ */ y(yn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ y("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Ni = { available: !1, open: !1, title: null }, _i = () => () => {
}, Li = () => Ni;
function Ci() {
  const e = ha(), t = (e == null ? void 0 : e.getState) ?? Li, n = nt((e == null ? void 0 : e.subscribe) ?? _i, t, t);
  if (!e || !n.available) return null;
  const r = n.open ? `收起摘录${n.title ? `（摘到《${n.title}》）` : ""}` : "摘录";
  return /* @__PURE__ */ y(Qr, { className: "reader-notes-toggle", label: r, pressed: n.open, onClick: e.toggle, children: /* @__PURE__ */ y(Jo, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }) });
}
let tr = !1;
function zi() {
  if (tr)
    return;
  const e = pt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (na.GlobalWorkerOptions.workerSrc = e, tr = !0);
}
const Di = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function xi(e, t, n) {
  return e.flatMap((r) => {
    if (!Di.has(_r(r.region))) return [];
    const o = bn(r, t, n);
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
async function Oi(e) {
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
const Fi = "reader-text-hover-copy", $i = "reader-text-hover-id", eo = "reader-text-hover-tools", ji = "reader-text-hover-quote";
function Bi(e) {
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
const to = 26, _t = 190;
function no(e, t = _t) {
  return e.height < to * 2 || e.width < t;
}
const Ui = 72;
function Hi({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = L("idle"), [a, s] = L("idle"), [c, i] = L("idle"), l = A([]), u = (e == null ? void 0 : e.itemId) || "";
  if (F(() => {
    o("idle"), s("idle"), i("idle");
    const S = l.current;
    return () => {
      S.forEach((b) => window.clearTimeout(b)), l.current = [];
    };
  }, [u]), !e) return null;
  const d = jo(e.highlight.region, t), f = _r(e.highlight.region), m = (S, b) => async (P) => {
    P.preventDefault(), P.stopPropagation();
    const k = await Oi(S);
    b(k ? "copied" : "failed"), l.current.push(window.setTimeout(() => b("idle"), 1200));
  }, g = f === "formula" ? "复制 LaTeX" : "复制", h = ma(), p = !!(h != null && h.available()), v = (S) => {
    S.preventDefault(), S.stopPropagation();
    const b = !!(h != null && h.send(Bi(e)));
    i(b ? "copied" : "failed"), l.current.push(window.setTimeout(() => i("idle"), 1200));
  }, w = no(e.rect, p ? _t + Ui : _t);
  return /* @__PURE__ */ y("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ y(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": f,
      style: e.rect,
      children: /* @__PURE__ */ $(
        "div",
        {
          className: eo,
          "data-placement": w ? "outside" : "inside",
          children: [
            /* @__PURE__ */ y(
              Ht,
              {
                className: $i,
                state: a,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: m(e.itemId, s),
                children: a === "copied" ? "已复制编号" : e.itemId
              }
            ),
            t === "translated" && n > 0 ? /* @__PURE__ */ $("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            d ? /* @__PURE__ */ y(
              Ht,
              {
                className: Fi,
                state: r,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: m(d, o),
                children: r === "copied" ? "已复制" : r === "failed" ? "复制失败" : g
              }
            ) : null,
            p ? /* @__PURE__ */ y(
              Ht,
              {
                className: ji,
                state: c,
                label: "把这一段摘到笔记",
                title: "摘到笔记：原文和译文一起放进打开的笔记",
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
function Wi(e, t) {
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
function Vi(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = bn(
      Wi(e, a),
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
const Ji = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', qi = 256, ut = /* @__PURE__ */ new Map();
function Gi(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Ki(e) {
  const t = `${e || ""}`, { text: n, slots: r } = aa(t, { bareLatex: !0 }), o = Gi(n), a = sa(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = ut.get(t);
  if (!s && (s = ia(o, r), ut.set(t, s), ut.size > qi)) {
    const c = ut.keys().next().value;
    c !== void 0 && ut.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Wt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ee(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Zi(e, t) {
  const n = e.typography, r = Ee(t) || 1, o = Ee(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Wt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Ee(n == null ? void 0 : n.fit_min_font_size_pt), u = Ee(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), m = o ? o * r : i, g = Ee(n == null ? void 0 : n.leading_em), h = [
    Ee(n == null ? void 0 : n.padding_top_pt) || 0,
    Ee(n == null ? void 0 : n.padding_right_pt) || 0,
    Ee(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ee(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((p) => p * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Ji,
    fontSizePx: Math.max(d, Math.min(f, m)),
    minFontSizePx: d,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Wt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Wt(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Yi(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), c = (d) => {
    const f = s.get(d);
    if (f !== void 0) return f;
    const { width: m, height: g } = e(d), h = m <= t + 0.5 && g <= n + 0.5;
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
const Xi = 512, dt = /* @__PURE__ */ new Map();
let an = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  an += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  an += 1;
}));
function Qi(e, t, n, r) {
  return [
    an,
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
function ec({ item: e, pageScale: t }) {
  const n = A(null), r = Y(
    () => Ki(e.translatedText),
    [e.translatedText]
  ), [o, a] = L(r.fallbackHtml), s = Y(
    () => Zi(e, t),
    [e, t]
  );
  F(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      d && a(f);
    }), () => {
      d = !1;
    };
  }, [r]), Ce(() => {
    const d = n.current;
    if (!d) return;
    const [f, m, g, h] = s.padding, p = Math.max(1, e.rect.width - h - m), v = Math.max(1, e.rect.height - f - g), w = Qi(o, p, v, s);
    let S = dt.get(w);
    if (S === void 0 && (S = Yi(
      (b) => (d.style.fontSize = `${b}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      p,
      v,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), dt.set(w, S), dt.size > Xi)) {
      const b = dt.keys().next().value;
      b !== void 0 && dt.delete(b);
    }
    d.style.fontSize = `${S.toFixed(2)}px`;
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
function tc({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = Y(
    () => Vi(e, t, n, r),
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
        ec,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const nc = fn(tc), ro = mn(null), oo = mn(null);
function rc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ y(ro.Provider, { value: e, children: /* @__PURE__ */ y(oo.Provider, { value: t, children: n }) });
}
function Le() {
  return hn(ro);
}
function ao() {
  return hn(oo);
}
const so = 1.414;
function oc({
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
  liveTranslationLayout: g,
  liveTranslationPage: h,
  showLiveTranslation: p = r === "source"
}) {
  var Q, te;
  const v = (Q = Le()) == null ? void 0 : Q.revisedBlocks, w = (te = Le()) == null ? void 0 : te.quotedBlocks, S = A(c ?? so), [b, P] = L(S.current);
  F(() => {
    c != null && Math.abs(c - S.current) >= 1e-3 && (S.current = c, P(c));
  }, [c]);
  const k = A(l);
  k.current = l;
  const _ = A((N) => {
    var G;
    (G = k.current) == null || G.call(k, N);
  }).current, x = Math.max(120, Math.floor(t * b)), D = Math.max(x, Math.ceil(a || 0)), z = bn(u, t, x), R = Y(
    () => xi(d, t, x),
    [x, d, t]
  ), [I, T] = L(null), M = typeof m == "function", j = M ? f ?? null : I, H = (N) => {
    M ? N !== (f ?? null) && (m == null || m(N)) : T((G) => G === N ? G : N);
  }, W = Y(
    () => R.find((N) => N.itemId === j) || null,
    [j, R]
  ), J = (N) => {
    var de, Me;
    if (N.pointerType === "touch") return;
    if (N.buttons !== 0) {
      H(null);
      return;
    }
    if ((Me = (de = N.target) == null ? void 0 : de.closest) != null && Me.call(de, `.${eo}`)) return;
    const G = N.currentTarget.getBoundingClientRect(), ae = N.clientX - G.left, E = N.clientY - G.top, B = W == null ? void 0 : W.rect;
    if (B && no(B) && ae >= B.left - 4 && ae <= B.left + _t && E >= B.top - to && E <= B.top) return;
    const pe = nr(R, ae, E);
    H((pe == null ? void 0 : pe.itemId) || null);
  }, oe = (N) => {
    if (N.pointerType === "mouse") return;
    const G = N.currentTarget.getBoundingClientRect(), ae = nr(
      R,
      N.clientX - G.left,
      N.clientY - G.top
    );
    H((ae == null ? void 0 : ae.itemId) || null);
  }, O = (N) => {
    !Number.isFinite(N) || N <= 0 || Math.abs(S.current - N) < 1e-3 || (S.current = N, P(N), i == null || i(e, N));
  };
  return /* @__PURE__ */ $(
    "div",
    {
      ref: _,
      [Fe]: e,
      [Xe]: r,
      [vn]: x,
      className: Sn,
      onPointerMoveCapture: J,
      onPointerDown: oe,
      onPointerLeave: (N) => {
        N.pointerType === "mouse" && H(null);
      },
      style: {
        width: t,
        height: D,
        minHeight: D
      },
      children: [
        o ? /* @__PURE__ */ y(
          ra,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: !0,
            renderAnnotationLayer: !1,
            className: Or,
            loading: /* @__PURE__ */ y(
              "div",
              {
                className: Mt,
                style: { width: t, height: x }
              }
            ),
            onLoadSuccess: (N) => {
              try {
                const G = N.getViewport({ scale: 1 });
                if (G.width > 0) {
                  const ae = G.height / G.width;
                  O(ae);
                }
              } catch {
              }
              s == null || s();
            },
            onRenderSuccess: () => {
              s == null || s();
            }
          }
        ) : /* @__PURE__ */ y(
          "div",
          {
            className: Mt,
            style: { width: t, height: x },
            "aria-hidden": !0
          }
        ),
        z ? /* @__PURE__ */ y(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: z,
            "aria-hidden": "true"
          }
        ) : null,
        o && p ? /* @__PURE__ */ y(
          nc,
          {
            layoutPage: g,
            pageState: h,
            width: t,
            height: x
          }
        ) : null,
        o && (w != null && w.size) ? /* @__PURE__ */ y("div", { className: "reader-quoted-markers", "aria-hidden": "true", children: R.filter((N) => w.has(N.itemId)).map((N) => /* @__PURE__ */ y(
          "span",
          {
            className: "reader-quoted-marker",
            "data-reader-quoted-id": N.itemId,
            title: "摘过",
            style: { left: N.rect.left, top: N.rect.top, height: N.rect.height }
          },
          N.itemId
        )) }) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ y("div", { className: "reader-revised-markers", "aria-hidden": "true", children: R.filter((N) => v.has(N.itemId)).map((N) => /* @__PURE__ */ y(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": N.itemId,
            style: { left: N.rect.left, top: N.rect.top, height: N.rect.height }
          },
          N.itemId
        )) }) : null,
        /* @__PURE__ */ y(
          Hi,
          {
            target: o ? W : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: W && (v == null ? void 0 : v.get(W.itemId)) || 0
          }
        )
      ]
    }
  );
}
const ac = fn(oc), Vt = 5, sc = "120% 0px", ic = 120;
let rr = 1;
const or = /* @__PURE__ */ new WeakMap();
function cc(e) {
  if (!e) return 0;
  const t = or.get(e);
  if (t) return t;
  const n = rr;
  return rr += 1, or.set(e, n), n;
}
function lc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const uc = Mo(
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
    activeRegion: g = null,
    regions: h = [],
    readerMetadata: p = null,
    hoveredRegionId: v = null,
    onHoverRegion: w,
    liveTranslation: S,
    showLiveTranslation: b = t === "source",
    liveTranslationPendingLabel: P = "",
    paneAction: k
  }, _) {
    zi();
    const { file: x, loading: D, error: z } = qa(n, r), R = `${n}\0${cc(x)}`, I = A(R);
    I.current = R;
    const T = Y(
      () => Ba(x),
      [x, n]
    ), [M, j] = L(0), [H, W] = L(""), [J, oe] = L(null), [O, Q] = L(480), te = A(null), N = A(0), G = Y(() => lc(), []), ae = Y(() => ({
      cMapUrl: pt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: pt().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    pn(_, () => J, [J]), F(() => {
      const C = (K) => {
        N.current = K, Q(K);
      }, q = (K) => {
        const X = vs(K, N.current);
        if (X !== "ignore") {
          if (te.current && clearTimeout(te.current), X === "immediate") {
            C(K);
            return;
          }
          te.current = setTimeout(() => C(K), Br);
        }
      }, V = !!(i && i >= 80);
      q(V ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const ne = !V && c && typeof ResizeObserver < "u" ? new ResizeObserver((K) => {
        var X, ue;
        q(((ue = (X = K[0]) == null ? void 0 : X.contentRect) == null ? void 0 : ue.width) ?? c.clientWidth);
      }) : null;
      return ne && c && ne.observe(c), () => {
        ne == null || ne.disconnect(), te.current && clearTimeout(te.current);
      };
    }, [i, c, a]);
    const E = Y(
      () => gs(O, o),
      [O, o]
    ), [B, pe] = L(() => /* @__PURE__ */ new Map()), [de, Me] = L(() => /* @__PURE__ */ new Set()), [Ft, We] = L(() => /* @__PURE__ */ new Set()), ot = A(/* @__PURE__ */ new Map()), Pe = A(null), re = A(/* @__PURE__ */ new Map()), fe = U((C, q) => {
      pe((V) => {
        if (V.get(C) === q) return V;
        const Z = new Map(V);
        return Z.set(C, q), Z;
      });
    }, []), ge = U((C, q) => {
      const V = ot.current, Z = V.get(C);
      if (Z && Pe.current)
        try {
          Pe.current.unobserve(Z);
        } catch {
        }
      if (q) {
        if (V.set(C, q), Pe.current)
          try {
            Pe.current.observe(q);
          } catch {
          }
      } else
        V.delete(C);
    }, []), ie = A(/* @__PURE__ */ new Map()), ce = U((C) => {
      const q = ie.current;
      let V = q.get(C);
      return V || (V = (Z) => ge(C, Z), q.set(C, V)), V;
    }, [ge]);
    F(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = re.current, q = new IntersectionObserver(
        (V) => {
          const Z = [], ne = [];
          for (const K of V) {
            const X = K.target, ue = wn(X);
            Number.isFinite(ue) && (K.isIntersecting ? Z : ne).push(ue);
          }
          if ((Z.length || ne.length) && Me((K) => {
            let X = null;
            for (const ue of Z)
              K.has(ue) || (X = X || new Set(K), X.add(ue));
            for (const ue of ne)
              K.has(ue) && (X = X || new Set(K), X.delete(ue));
            return X || K;
          }), Z.length) {
            for (const K of Z) {
              const X = C.get(K);
              X && (clearTimeout(X), C.delete(K));
            }
            We((K) => {
              let X = null;
              for (const ue of Z)
                K.has(ue) || (X = X || new Set(K), X.add(ue));
              return X || K;
            });
          }
          for (const K of ne)
            C.has(K) || C.set(K, setTimeout(() => {
              C.delete(K), We((X) => {
                if (!X.has(K)) return X;
                const ue = new Set(X);
                return ue.delete(K), ue;
              });
            }, ic));
        },
        { root: c, rootMargin: sc, threshold: 0 }
      );
      Pe.current = q;
      for (const V of ot.current.values())
        try {
          q.observe(V);
        } catch {
        }
      return () => {
        q.disconnect(), Pe.current === q && (Pe.current = null);
        for (const V of C.values()) clearTimeout(V);
        C.clear();
      };
    }, [c]), Ce(() => {
      j(0), W(""), Me(/* @__PURE__ */ new Set()), We(/* @__PURE__ */ new Set()), pe(/* @__PURE__ */ new Map()), ot.current.clear();
      const C = re.current;
      for (const q of C.values()) clearTimeout(q);
      C.clear(), m == null || m(0, t);
    }, [R, m, t]);
    const le = U(
      ({ numPages: C }) => {
        I.current === R && (j(C), W(""), m == null || m(C, t), d == null || d({ numPages: C, pane: t }));
      },
      [R, d, m, t]
    ), Ve = U(
      (C) => {
        if (I.current !== R) return;
        const q = (C == null ? void 0 : C.message) || "PDF 解析失败";
        W(q), j(0), m == null || m(0, t), f == null || f(C, t);
      },
      [R, f, m, t]
    ), Re = Y(
      () => M > 0 ? Array.from({ length: M }, (C, q) => q + 1) : [],
      [M]
    );
    F(() => {
      typeof IntersectionObserver < "u" || We(new Set(Re));
    }, [Re]);
    const Ae = Y(
      () => Hn(g, p, t),
      [g, p, t]
    ), at = Y(() => {
      const C = /* @__PURE__ */ new Map();
      for (const q of h) {
        const V = Hn(q, p, t);
        if (!V) continue;
        const Z = C.get(V.box.page) || [];
        Z.push(V), C.set(V.box.page, Z);
      }
      return C;
    }, [t, p, h]), $t = Y(() => {
      const C = /* @__PURE__ */ new Set();
      if (!v) return C;
      for (const [q, V] of at)
        V.some((Z) => Z.itemId === v) && C.add(q);
      return C;
    }, [v, at]), St = Y(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(Re);
      if (de.size === 0) {
        const V = Math.min(M, Vt * 2 + 1);
        return new Set(Array.from({ length: V }, (Z, ne) => ne + 1));
      }
      const q = /* @__PURE__ */ new Set();
      for (const V of de)
        for (let Z = -Vt; Z <= Vt; Z++) {
          const ne = V + Z;
          ne >= 1 && ne <= M && q.add(ne);
        }
      return q;
    }, [M, Re, c, a, de]), st = !n || !!z || !!H, it = n && (z || H) || s;
    return /* @__PURE__ */ $(
      "section",
      {
        ref: oe,
        className: `reader-panel ${ls}${a ? "" : " is-hidden"}`,
        [Xe]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (S == null ? void 0 : S.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          k ? /* @__PURE__ */ y("div", { className: "reader-react-pdf-pane-action", children: k }) : null,
          P ? /* @__PURE__ */ $("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ y("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ y("span", { children: P })
          ] }) : null,
          st && !D ? /* @__PURE__ */ y("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: it }) : null,
          D ? /* @__PURE__ */ y("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !z ? /* @__PURE__ */ y("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ y(
            oa,
            {
              file: T,
              loading: null,
              error: null,
              options: ae,
              onLoadSuccess: le,
              onLoadError: Ve,
              className: "reader-react-pdf-document",
              children: Re.map((C) => {
                if (St.has(C))
                  return /* @__PURE__ */ y(
                    ac,
                    {
                      pane: t,
                      pageNumber: C,
                      width: E,
                      devicePixelRatio: G,
                      active: Ft.has(C),
                      syncedMinHeight: (l == null ? void 0 : l.get(C)) || 0,
                      onMetrics: u,
                      cachedAspect: B.get(C),
                      onAspectChange: fe,
                      sentinelRef: ce(C),
                      regionHighlight: (Ae == null ? void 0 : Ae.box.page) === C ? Ae : null,
                      regionTargets: at.get(C),
                      hoveredRegionId: v && $t.has(C) ? v : null,
                      onHoverRegion: w,
                      liveTranslationLayout: S == null ? void 0 : S.layoutByPage.get(C - 1),
                      liveTranslationPage: S == null ? void 0 : S.pagesByPage.get(C - 1),
                      showLiveTranslation: b
                    },
                    `${t}-${C}`
                  );
                const V = B.get(C) ?? so, Z = Math.max(120, Math.floor(E * V)), ne = Math.max(Z, Math.ceil((l == null ? void 0 : l.get(C)) || 0));
                return /* @__PURE__ */ y(
                  "div",
                  {
                    ref: ce(C),
                    [Fe]: C,
                    [Xe]: t,
                    [vn]: Z,
                    className: Sn,
                    style: {
                      width: E,
                      height: ne,
                      minHeight: ne
                    },
                    children: /* @__PURE__ */ y(
                      "div",
                      {
                        className: Mt,
                        style: { width: E, height: Z },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${C}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), ar = fn(uc), dc = 2e3, fc = 6;
function mc(e, t) {
  const n = A(null), r = A(null);
  Ce(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, startHeight: a.startHeight, started: a.started } : null;
    if (!s) {
      const w = hc(e), S = Tt(e, w);
      if (!S) return;
      s = { pane: w, progress: S, startHeight: e.scrollHeight, started: performance.now() };
    }
    const { pane: c, progress: i, startHeight: l, started: u } = s;
    let d = 0, f = null, m = l, g = 0, h = u;
    const p = () => {
      var w;
      f && clearTimeout(f), cancelAnimationFrame(d);
      for (const S of sr) e.removeEventListener(S, p);
      ((w = r.current) == null ? void 0 : w.stop) === p && (r.current = null);
    }, v = () => {
      Ot(e, i, "auto", c);
      const w = e.scrollHeight;
      g = w === m ? g + 1 : 0, m = w, w !== l && g >= fc || performance.now() - h > dc ? p() : d = requestAnimationFrame(v);
    };
    for (const w of sr) e.addEventListener(w, p, { passive: !0 });
    r.current = { ...s, stop: p }, f = setTimeout(() => {
      f = null, h = performance.now(), d = requestAnimationFrame(v);
    }, Br);
  }, [e, t]), F(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function hc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Fe}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Xe) || null;
  }
  return null;
}
const sr = ["wheel", "touchstart", "keydown", "pointerdown"], pc = () => () => {
}, ir = () => null;
function gc({
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
function bc(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function yc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function vc(e) {
  const t = Le(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? vt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), p = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, v = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, S = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", b = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, _ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), x = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), D = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), z = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), I = (t == null ? void 0 : t.regionHover) ?? null, [T, M] = L(null), j = nt(
    I ? I.subscribe : pc,
    I ? () => I.get().itemId : ir,
    I ? () => I.get().itemId : ir
  ), H = I ? j : T, W = U((Q) => {
    I ? I.set(Q, "pdf") : M(Q);
  }, [I]), J = gc({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), O = Number.isFinite(g) && g > 0 ? bc(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return mc(f, O), /* @__PURE__ */ y(
    "div",
    {
      ref: d,
      className: cs,
      "data-reader-region-count": z.length,
      "data-reader-structured-region-count": z.filter(Bo).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ $(
        "main",
        {
          className: `${is} reader-mode-${J.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            p ? /* @__PURE__ */ y(
              ar,
              {
                pane: "source",
                url: S,
                preloadedFile: P,
                userZoom: m,
                visible: J.showSource,
                scrollRoot: f,
                pageWidthOverride: O,
                rowHeights: J.compareMode ? h : void 0,
                onMetrics: _,
                emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: x,
                activeRegion: D,
                regions: z,
                readerMetadata: R,
                hoveredRegionId: H,
                onHoverRegion: W,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? yc(o) : "",
                paneAction: u ? /* @__PURE__ */ $(Ct, { children: [
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
              ar,
              {
                pane: "translated",
                url: b,
                preloadedFile: k,
                userZoom: m,
                visible: J.showTranslated,
                scrollRoot: f,
                pageWidthOverride: O,
                rowHeights: J.compareMode ? h : void 0,
                onMetrics: _,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: x,
                activeRegion: D,
                regions: z,
                readerMetadata: R,
                hoveredRegionId: H,
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
const Sc = [
  { id: "source", label: "原文", Icon: Lr },
  { id: "compare", label: "对照", Icon: Cr },
  { id: "translated", label: "译文", Icon: zr }
];
function wc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Pc(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Rc(e) {
  const t = Le(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? wc(a.state) : "";
  return /* @__PURE__ */ $("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ $(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ y(qo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ y("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ y("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Sc.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, f = Pc({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ $(
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
const Ic = () => () => {
}, Tc = () => !1;
function Ec() {
  const e = ga(), t = (e == null ? void 0 : e.available) ?? Tc, n = nt((e == null ? void 0 : e.subscribe) ?? Ic, t, t), r = U(() => !!(e != null && e.available() && e.ask()), [e]);
  return { available: n, ask: r };
}
const kc = {
  markdown: { label: "Markdown", short: "MD", Icon: Go, needsJob: !0 }
}, Mc = Ur.map(
  (e) => ({ id: e, ...kc[e] })
);
function Ac() {
  return Mc.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Nc(e) {
  const t = Le(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = Ec(), i = [
    ...Ac().map(({ id: l, label: u, short: d, Icon: f, needsJob: m }) => ({
      key: l,
      label: u,
      short: d,
      Icon: f,
      disabled: m && o,
      selected: n === l,
      badge: r == null ? void 0 : r[l],
      onClick: () => a(l)
    })),
    ...c.available ? [{ key: "host-ai", label: "AI", short: "AI", Icon: Ko, disabled: !1, selected: !1, onClick: () => void c.ask() }] : []
  ];
  return n ? /* @__PURE__ */ $("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ y("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: u, Icon: d, disabled: f, selected: m, badge: g, onClick: h }) => /* @__PURE__ */ $(
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
          g ? /* @__PURE__ */ y("span", { className: "reader-assistant-dock-badge", children: g }) : null
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
        children: /* @__PURE__ */ y(yn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ y("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: i.map(({ key: l, label: u, short: d, Icon: f, disabled: m, badge: g, onClick: h }) => /* @__PURE__ */ $(
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
        g ? /* @__PURE__ */ y("span", { className: "reader-assistant-dock-badge", children: g }) : null
      ]
    },
    l
  )) });
}
function _c(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Lc(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Cc(e) {
  return e / 100 * window.innerHeight;
}
function zc(e) {
  return e / 100 * window.innerWidth;
}
function Dc(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function ft({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Dc(n);
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
      r = Lc(t, o);
      break;
    }
    case "em": {
      r = _c(t, o);
      break;
    }
    case "vh": {
      r = Cc(o);
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
function tt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function sn(e) {
  const { panels: t } = e, n = tt({ group: e });
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
      const u = ft({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = he(u / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const u = ft({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = he(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = ft({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = he(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = ft({
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
function ee(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function cn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? xc : Oc
  );
}
function xc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Oc(e, t) {
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
function Fc({
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
  return ee(o, "No rect found"), o;
}
let Rt;
function $c() {
  return Rt === void 0 && (typeof matchMedia == "function" ? Rt = !!matchMedia("(pointer:coarse)").matches : Rt = !1), Rt;
}
function lo(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = cn(
    n,
    Array.from(t.children).filter(io).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let c = !1, i = !1, l = -1, u = -1, d = 0, f, m = [];
  {
    let g = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (g++, h.hasAttribute("data-disabled") || (d++, l === -1 && (l = g), u = g));
  }
  if (d > 1) {
    let g = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        g++;
        const p = r.find(
          (v) => v.element === h
        );
        if (p) {
          if (f) {
            const v = f.element.getBoundingClientRect(), w = h.getBoundingClientRect();
            let S;
            if (i) {
              const b = n === "horizontal" ? new DOMRect(
                v.right,
                v.top,
                0,
                v.height
              ) : new DOMRect(
                v.left,
                v.bottom,
                v.width,
                0
              ), P = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (m.length) {
                case 0: {
                  S = [
                    b,
                    P
                  ];
                  break;
                }
                case 1: {
                  const k = m[0], _ = Fc({
                    orientation: n,
                    rects: [v, w],
                    targetRect: k.element.getBoundingClientRect()
                  });
                  S = [
                    k,
                    _ === v ? P : b
                  ];
                  break;
                }
                default: {
                  S = m;
                  break;
                }
              }
            } else
              m.length ? S = m : S = [
                n === "horizontal" ? new DOMRect(
                  v.right,
                  w.top,
                  w.left - v.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  v.bottom,
                  w.width,
                  w.top - v.bottom
                )
              ];
            for (const b of S) {
              let P = "width" in b ? b : b.element.getBoundingClientRect();
              const k = $c() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (P.width < k) {
                const x = k - P.width;
                P = new DOMRect(
                  P.x - x / 2,
                  P.y,
                  P.width + x,
                  P.height
                );
              }
              if (P.height < k) {
                const x = k - P.height;
                P = new DOMRect(
                  P.x,
                  P.y - x / 2,
                  P.width,
                  P.height + x
                );
              }
              const _ = g <= l || g > u;
              !c && !_ && s.push({
                group: e,
                groupSize: tt({ group: e }),
                panels: [f, p],
                separator: "width" in b ? void 0 : b,
                rect: P
              }), c = !1;
            }
          }
          i = !1, f = p, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (c = !0);
        const p = o.find(
          (v) => v.element === h
        );
        p ? m.push(p) : (f = void 0, m = []);
      } else
        i = !0;
  }
  return s;
}
var Ne;
class uo {
  constructor() {
    jn(this, Ne, {});
  }
  addListener(t, n) {
    const r = ct(this, Ne)[t];
    return r === void 0 ? ct(this, Ne)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = ct(this, Ne)[t];
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
    Bn(this, Ne, {});
  }
  removeListener(t, n) {
    const r = ct(this, Ne)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ne = new WeakMap();
let Ze = {
  cursorFlags: 0,
  state: "inactive"
};
const In = new uo();
function $e() {
  return Ze;
}
function jc(e) {
  return In.addListener("change", e);
}
function Bc(e) {
  const t = Ze, n = { ...Ze };
  n.cursorFlags = e, Ze = n, In.emit("change", {
    prev: t,
    next: n
  });
}
function Ye(e) {
  const t = Ze;
  Ze = e, In.emit("change", {
    prev: t,
    next: e
  });
}
const Uc = (e) => e, Jt = () => {
}, fo = 1, mo = 2, ho = 4, po = 8, cr = 3, lr = 12;
let It;
function ur() {
  return It === void 0 && (It = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (It = !0)), It;
}
function Hc({
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
        if (e && ur()) {
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
    return ur() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const dr = /* @__PURE__ */ new WeakMap();
function Tn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = dr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = $e();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Hc({
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
  dr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Se = /* @__PURE__ */ new Map();
const go = new uo();
function Wc(e) {
  Se = new Map(Se), Se.delete(e);
}
function fr(e, t) {
  for (const [n] of Se)
    if (n.id === e)
      return n;
}
function _e(e, t) {
  for (const [n, r] of Se)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function Ue() {
  return Se;
}
function En(e, t) {
  return go.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function ke(e, t, n) {
  const r = Se.get(e);
  Se = new Map(Se), Se.set(e, t), go.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function bo(e) {
  const t = $e();
  let n = !1;
  switch (t.state) {
    case "active":
      Ye({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Tn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = _e(r.group.id, !0);
        ke(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function mr(e) {
  e.defaultPrevented || bo(e.currentTarget);
}
function Vc(e, t, n) {
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
function Jc(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function qc(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: gr(e),
    b: gr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ee(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: pr(hr(n.a)),
    b: pr(hr(n.b))
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
const Gc = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Kc(e) {
  const t = getComputedStyle(yo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Zc(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Kc(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Gc.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function hr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ee(n, "Missing node"), Zc(n)) return n;
  }
  return null;
}
function pr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function gr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = yo(e);
  return t;
}
function yo(e) {
  const { parentNode: t } = e;
  return Jc(t) ? t.host : t;
}
function Yc(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Xc({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!io(n) || n.contains(e) || e.contains(n))
    return !0;
  if (qc(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Yc(r.getBoundingClientRect(), t))
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
    const a = lo(o), s = Vc(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Xc({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Qc(e, t) {
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
function ve(e, t) {
  return me(e, t) ? 0 : e > t ? 1 : -1;
}
function Ke({
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
  ee(u != null, "Invalid first pivot index"), ee(d != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? d : u, p = n[h];
        ee(
          p,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: w,
          minSize: S = 0
        } = p;
        if (w) {
          const b = c[h];
          if (ee(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), me(b, v)) {
            const P = S - b;
            ve(P, Math.abs(e)) > 0 && (e = e < 0 ? 0 - P : P);
          }
        }
      }
      {
        const h = e < 0 ? u : d, p = n[h];
        ee(
          p,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: w,
          minSize: S = 0
        } = p;
        if (w) {
          const b = c[h];
          if (ee(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), me(b, S)) {
            const P = b - v;
            ve(P, Math.abs(e)) > 0 && (e = e < 0 ? 0 - P : P);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? d : u, p = n[h];
      ee(
        p,
        `Panel constraints not found for index ${h}`
      );
      const v = c[h], { collapsible: w, collapsedSize: S, minSize: b } = p;
      if (w && ve(v, b) < 0)
        if (e > 0) {
          const P = b - S, k = P / 2, _ = v + e;
          ve(_, b) < 0 && (e = ve(e, k) <= 0 ? 0 : P);
        } else {
          const P = b - S, k = 100 - P / 2, _ = v - e;
          ve(_, b) < 0 && (e = ve(100 + e, k) > 0 ? 0 : -P);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let p = e < 0 ? d : u, v = 0;
    for (; ; ) {
      const S = c[p];
      ee(
        S != null,
        `Previous layout not found for panel index ${p}`
      );
      const b = Ke({
        overrideDisabledPanels: s,
        panelConstraints: n[p],
        prevSize: S,
        size: 100
      }) - S;
      if (v += b, p += h, p < 0 || p >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(v));
    e = e < 0 ? 0 - w : w;
  }
  {
    let h = e < 0 ? u : d;
    for (; h >= 0 && h < n.length; ) {
      const p = Math.abs(e) - Math.abs(f), v = c[h];
      ee(
        v != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = v - p, S = Ke({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: v,
        size: w
      });
      if (!me(v, S) && (f += v - S, l[h] = S, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Qc(i, l))
    return o;
  {
    const h = e < 0 ? d : u, p = c[h];
    ee(
      p != null,
      `Previous layout not found for panel index ${h}`
    );
    const v = p + f, w = Ke({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: p,
      size: v
    });
    if (l[h] = w, !me(w, v)) {
      let S = v - w, b = e < 0 ? d : u;
      for (; b >= 0 && b < n.length; ) {
        const P = l[b];
        ee(
          P != null,
          `Previous layout not found for panel index ${b}`
        );
        const k = P + S, _ = Ke({
          overrideDisabledPanels: s,
          panelConstraints: n[b],
          prevSize: P,
          size: k
        });
        if (me(P, _) || (S -= _ - P, l[b] = _), me(S, 0))
          break;
        e > 0 ? b-- : b++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, p) => p + h,
    0
  );
  if (!me(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, p, v) => (h[g[v]] = p, h), {});
}
function je(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || ve(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Be({
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
      ee(i != null, `No layout data found for index ${c}`);
      const l = 100 / o * i;
      r[c] = l;
    }
  let a = 0;
  for (let c = 0; c < t.length; c++) {
    const i = n[c];
    ee(i != null, `No layout data found for index ${c}`);
    const l = r[c];
    ee(l != null, `No layout data found for index ${c}`);
    const u = Ke({
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
      ee(i != null, `No layout data found for index ${c}`);
      const l = i + a, u = Ke({
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
function vo({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = Ue();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: d,
        layout: f,
        groupSize: m,
        separatorToPanels: g
      }
    ] of i)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: d,
          group: l,
          groupSize: m,
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
    const f = a(), m = l.findIndex((p) => p.id === t), g = m === 0, h = m === l.length - 1;
    if (h && i < f && (g || l.slice(0, m).every((p, v) => {
      const w = d[v];
      return (w == null ? void 0 : w.collapsible) && me(w.collapsedSize, u[w.panelId]);
    }))) {
      const p = l.slice(0, m).reduce((v, w) => v + u[w.id], 0);
      return {
        ...u,
        [t]: he(100 - p)
      };
    }
    return gt({
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
      layout: g,
      separatorToPanels: h
    } = n(), p = s({
      nextSize: i,
      panels: f.panels,
      prevLayout: g,
      derivedPanelConstraints: d
    }), v = Be({
      layout: p,
      panelConstraints: d
    });
    je(g, v) || ke(f, {
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
      return i && me(l, u);
    },
    resize: (i) => {
      const { group: l } = n(), { element: u } = o(), d = tt({ group: l }), f = ft({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), m = he(f / d * 100);
      c(m);
    }
  };
}
function br(e) {
  if (e.defaultPrevented)
    return;
  const t = Ue();
  kn(e, t).forEach((n) => {
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
function Et(e) {
  const t = Ue();
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
    const n = Ue();
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
      } = t(), l = Be({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (je(c, l) || ke(a, {
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
  const n = Et(e), r = _e(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ee(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ee(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = So({ groupId: n.id }).getLayout(), i = gt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = Be({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  je(c, l) || ke(
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
function yr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Et(t);
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
        const r = Et(t), o = _e(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (f) => f.element === t
        );
        ee(i, "Matching separator not found");
        const l = c.get(i);
        ee(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (f) => f.panelId === u.id
        );
        if (ee(d, "Panel metadata not found"), d.collapsible) {
          const f = s[u.id], m = d.collapsedSize === f ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          ze(t, m - f);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Et(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        ee(o !== null, "Index not found");
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
function vr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = Ue(), n = kn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Ye({
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
    const { group: u, groupSize: d } = l, { orientation: f, panels: m } = u, { disableCursor: g } = u.mutableState;
    let h = 0;
    a ? f === "horizontal" ? h = (t.clientX - a.x) / d * 100 : h = (t.clientY - a.y) / d * 100 : f === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const p = r.get(u), v = o.get(u);
    if (!p || !v)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: S,
      groupSize: b,
      layout: P,
      separatorToPanels: k
    } = v;
    if (S && P && k) {
      const _ = gt({
        delta: h,
        initialLayout: p,
        panelConstraints: S,
        pivotIndices: l.panels.map((x) => m.indexOf(x)),
        prevLayout: P,
        trigger: "mouse-or-touch"
      });
      if (je(_, P)) {
        if (h !== 0 && !g)
          switch (f) {
            case "horizontal": {
              c |= h < 0 ? fo : mo;
              break;
            }
            case "vertical": {
              c |= h < 0 ? ho : po;
              break;
            }
          }
      } else
        ke(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: S,
          groupSize: b,
          layout: _,
          separatorToPanels: k
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & cr : i |= c & cr, t.movementY === 0 ? i |= s & lr : i |= c & lr, Bc(i), Tn(e);
}
function Sr(e) {
  const t = Ue(), n = $e();
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
function wr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = $e(), n = Ue();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Ye({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = _e(a.group.id, !0);
          ke(a.group, s, {
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
      const a = kn(e, n);
      a.length === 0 ? t.state !== "inactive" && Ye({
        cursorFlags: 0,
        state: "inactive"
      }) : Ye({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Tn(e.currentTarget);
      break;
    }
  }
}
function Pr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch ($e().state) {
      case "hover":
        Ye({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Rr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || bo(e.currentTarget) && e.preventDefault();
}
function Ir(e) {
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
function el(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = tt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, c = {
    asPercentage: he(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = c, r.onResize(c, r.id, s);
}
function tl(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function nl({
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
        const m = f / 100 * n, g = he(
          m / t * 100
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
function rl(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Je = /* @__PURE__ */ new Map();
function ol(e) {
  let t = !0;
  ee(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: p, target: v } = h;
      if (v === e.element) {
        if (t) {
          const w = tt({ group: e });
          if (w === 0)
            return;
          const S = _e(e.id);
          if (!S)
            return;
          const b = sn(e), P = S.defaultLayoutDeferred ? Ir(b) : S.layout, k = nl({
            group: e,
            nextGroupSize: w,
            prevGroupSize: S.groupSize,
            prevLayout: P
          }), _ = Be({
            layout: k,
            panelConstraints: b
          });
          if (!S.defaultLayoutDeferred && je(S.layout, _) && tl(
            S.derivedPanelConstraints,
            b
          ) && S.groupSize === w)
            return;
          ke(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: b,
            groupSize: w,
            layout: _,
            separatorToPanels: S.separatorToPanels
          });
        }
      } else
        el(e, v, p);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    ee(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = tt({ group: e }), c = sn(e), i = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (rl(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? Ir(c), d = Be({
    layout: u,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Je.set(
    f,
    (Je.get(f) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return lo(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), ke(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    ee(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", yr);
  }), Je.get(f) === 1 && (f.addEventListener("contextmenu", mr, !0), f.addEventListener("dblclick", br, !0), f.addEventListener("pointerdown", vr, !0), f.addEventListener("pointerleave", Sr), f.addEventListener("pointermove", wr), f.addEventListener("pointerout", Pr), f.addEventListener("pointerup", Rr, !0)), function() {
    t = !1, Je.set(
      f,
      Math.max(0, (Je.get(f) ?? 0) - 1)
    ), Wc(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", yr);
    }), Je.get(f) || (f.removeEventListener(
      "contextmenu",
      mr,
      !0
    ), f.removeEventListener(
      "dblclick",
      br,
      !0
    ), f.removeEventListener(
      "pointerdown",
      vr,
      !0
    ), f.removeEventListener("pointerleave", Sr), f.removeEventListener("pointermove", wr), f.removeEventListener("pointerout", Pr), f.removeEventListener("pointerup", Rr, !0)), a.disconnect();
  };
}
function al() {
  const [e, t] = L({}), n = U(() => t({}), []);
  return [e, n];
}
function Mn(e) {
  const t = Ar();
  return `${e ?? t}`;
}
const He = typeof window < "u" ? Ce : F;
function mt(e) {
  const t = A(e);
  return He(() => {
    t.current = e;
  }, [e]), U(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function An(...e) {
  return mt((t) => {
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
  const t = A({ ...e });
  return He(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Po = mn(null);
function sl(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: Uc
  });
  pn(t, () => n.current, []), He(() => {
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
  ...m
}) {
  const g = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = mt((R) => {
    je(g.current.onLayoutChange, R) || (g.current.onLayoutChange = R, i == null || i(R));
  }), p = mt(
    (R, I) => {
      je(g.current.onLayoutChanged, R) || (g.current.onLayoutChanged = R, l == null || l(R, { isUserInteraction: I }));
    }
  ), v = Mn(c), w = A(null), [S, b] = al(), P = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), k = An(w, a);
  sl(v, s);
  const _ = mt(
    (R, I) => {
      const T = $e(), M = fr(R), j = _e(R);
      if (j) {
        let H = !1;
        switch (T.state) {
          case "active": {
            H = T.hitRegions.some(
              (W) => W.group === M
            );
            break;
          }
        }
        return {
          flexGrow: j.layout[I] ?? 1,
          pointerEvents: H ? "none" : void 0
        };
      }
      if (n != null && n[I])
        return {
          flexGrow: n == null ? void 0 : n[I]
        };
    }
  ), x = Nn({
    defaultLayout: n,
    disableCursor: r
  }), D = Y(
    () => ({
      get disableCursor() {
        return !!x.disableCursor;
      },
      getPanelStyles: _,
      id: v,
      orientation: u,
      registerPanel: (R) => {
        const I = P.current;
        return I.panels = cn(u, [
          ...I.panels,
          R
        ]), b(), () => {
          I.panels = I.panels.filter(
            (T) => T !== R
          ), b();
        };
      },
      registerSeparator: (R) => {
        const I = P.current;
        return I.separators = cn(u, [
          ...I.separators,
          R
        ]), b(), () => {
          I.separators = I.separators.filter(
            (T) => T !== R
          ), b();
        };
      },
      updatePanelProps: (R, { disabled: I }) => {
        const T = P.current.panels.find(
          (H) => H.id === R
        );
        T && (T.panelConstraints.disabled = I);
        const M = fr(v), j = _e(v);
        M && j && ke(M, {
          ...j,
          derivedPanelConstraints: sn(M)
        });
      },
      updateSeparatorProps: (R, {
        disabled: I,
        disableDoubleClick: T
      }) => {
        const M = P.current.separators.find(
          (j) => j.id === R
        );
        M && (M.disabled = I, M.disableDoubleClick = T);
      }
    }),
    [_, v, b, u, x]
  ), z = A(null);
  return He(() => {
    const R = w.current;
    if (R === null)
      return;
    const I = P.current;
    let T;
    if (x.defaultLayout !== void 0 && Object.keys(x.defaultLayout).length === I.panels.length) {
      T = {};
      for (const O of I.panels) {
        const Q = x.defaultLayout[O.id];
        Q !== void 0 && (T[O.id] = Q);
      }
    }
    const M = {
      disabled: !!o,
      element: R,
      id: v,
      mutableState: {
        defaultLayout: T,
        disableCursor: !!x.disableCursor,
        expandedPanelSizes: P.current.lastExpandedPanelSizes,
        layouts: P.current.layouts
      },
      orientation: u,
      panels: I.panels,
      resizeTargetMinimumSize: I.resizeTargetMinimumSize,
      separators: I.separators
    };
    z.current = M;
    const j = ol(M), { defaultLayoutDeferred: H, derivedPanelConstraints: W, layout: J } = _e(M.id, !0);
    !H && W.length > 0 && (h(J), p(J, !1));
    const oe = En(v, (O) => {
      const { defaultLayoutDeferred: Q, derivedPanelConstraints: te, layout: N } = O.next;
      if (Q || te.length === 0)
        return;
      const G = M.panels.map(({ id: E }) => E).join(",");
      M.mutableState.layouts[G] = N, te.forEach((E) => {
        if (E.collapsible) {
          const { layout: B } = O.prev ?? {};
          if (B) {
            const pe = me(
              E.collapsedSize,
              N[E.panelId]
            ), de = me(
              E.collapsedSize,
              B[E.panelId]
            );
            pe && !de && (M.mutableState.expandedPanelSizes[E.panelId] = B[E.panelId]);
          }
        }
      });
      const ae = $e().state !== "active";
      h(N), ae && p(N, O.isUserInteraction);
    });
    return () => {
      z.current = null, j(), oe();
    };
  }, [
    o,
    v,
    p,
    h,
    u,
    S,
    x
  ]), F(() => {
    const R = z.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ y(Po.Provider, { value: D, children: /* @__PURE__ */ y(
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
Ro.displayName = "Group";
function _n() {
  const e = hn(Po);
  return ee(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function il(e, t) {
  const { id: n } = _n(), r = A({
    collapse: Jt,
    expand: Jt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Jt
  });
  pn(t, () => r.current, []), He(() => {
    Object.assign(
      r.current,
      vo({ groupId: n, panelId: e })
    );
  });
}
function ln({
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
  ...g
}) {
  const h = !!i, p = Mn(i), v = Nn({
    disabled: a
  }), w = A(null), S = An(w, s), {
    getPanelStyles: b,
    id: P,
    orientation: k,
    registerPanel: _,
    updatePanelProps: x
  } = _n(), D = d !== null, z = mt(
    (M, j, H) => {
      d == null || d(M, i, H);
    }
  );
  He(() => {
    const M = w.current;
    if (M !== null) {
      const j = {
        element: M,
        id: p,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? z : void 0,
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
      return _(j);
    }
  }, [
    c,
    n,
    r,
    o,
    D,
    p,
    h,
    l,
    u,
    z,
    _,
    v
  ]), F(() => {
    x(p, { disabled: a });
  }, [a, p, x]), il(p, f);
  const R = () => {
    const M = b(P, p);
    if (M)
      return JSON.stringify(M);
  }, I = nt(
    (M) => En(P, M),
    R,
    R
  );
  let T;
  return I ? T = JSON.parse(I) : o !== void 0 ? T = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : T = { flexGrow: 1 }, /* @__PURE__ */ y(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": p,
      id: p,
      ref: S,
      style: {
        ...cl,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...T
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
ln.displayName = "Panel";
const cl = {
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
function ll({
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
    a = Be({
      layout: gt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Be({
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
  const i = Mn(a), l = Nn({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = L({}), [f, m] = L("inactive"), [g, h] = L(!1), p = A(null), v = An(p, o), {
    disableCursor: w,
    id: S,
    orientation: b,
    registerSeparator: P,
    updateSeparatorProps: k
  } = _n(), _ = b === "horizontal" ? "vertical" : "horizontal";
  He(() => {
    const z = p.current;
    if (z !== null) {
      const R = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: z,
        id: i
      }, I = P(R), T = jc(
        (j) => {
          m(
            j.next.state !== "inactive" && j.next.hitRegions.some(
              (H) => H.separator === R
            ) ? j.next.state : "inactive"
          );
        }
      ), M = En(
        S,
        (j) => {
          const { derivedPanelConstraints: H, layout: W, separatorToPanels: J } = j.next, oe = J.get(R);
          if (oe) {
            const O = oe[0], Q = oe.indexOf(O);
            d(
              ll({
                layout: W,
                panelConstraints: H,
                panelId: O.id,
                panelIndex: Q
              })
            );
          }
        }
      );
      return () => {
        T(), M(), I();
      };
    }
  }, [S, i, P, l]), F(() => {
    k(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, k]);
  let x;
  n && !w && (x = "not-allowed");
  let D;
  if (n)
    D = "disabled";
  else
    switch (f) {
      case "active": {
        D = "active";
        break;
      }
      default:
        g ? D = "focus" : D = f;
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
      "data-separator": D,
      "data-testid": i,
      id: i,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: v,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: x,
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
const Ln = 30, Cn = 65, bt = 50, ul = 100 - Cn, dl = 100 - Ln;
function fl(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Cn, Math.max(Ln, t)) : bt;
}
function zn(e) {
  return 100 - e;
}
function qe(e) {
  return `${e}%`;
}
const Dn = "reader-document", yt = "reader-assistant", To = "retainpdf.reader.ai-split-layout.v1", ml = {
  [Dn]: zn(bt),
  [yt]: bt
};
function xn(e) {
  const t = fl(e == null ? void 0 : e[yt]);
  return {
    [Dn]: zn(t),
    [yt]: t
  };
}
function hl() {
  try {
    const e = JSON.parse(localStorage.getItem(To) || "null");
    return xn(e);
  } catch {
    return ml;
  }
}
function pl(e) {
  try {
    localStorage.setItem(To, JSON.stringify(xn(e)));
  } catch {
  }
}
function qt(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = xn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[yt]}vw`
  );
}
function gl() {
  const e = A(null), [t] = L(hl);
  Ce(() => {
    const o = e.current;
    return qt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = U((o) => {
    qt(e.current, o);
  }, []), r = U((o, a) => {
    qt(e.current, o), a.isUserInteraction && pl(o);
  }, []);
  return /* @__PURE__ */ $(
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
        /* @__PURE__ */ y(
          ln,
          {
            id: Dn,
            defaultSize: qe(zn(bt)),
            minSize: qe(ul),
            maxSize: qe(dl)
          }
        ),
        /* @__PURE__ */ y(
          Io,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ y("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ y(
          ln,
          {
            id: yt,
            defaultSize: qe(bt),
            minSize: qe(Ln),
            maxSize: qe(Cn)
          }
        )
      ]
    }
  );
}
function bl({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = L(!1);
  if (F(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ $("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ $("span", { className: "reader-error-notice-text", children: [
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
function yl({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ y(bl, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ $(Ct, { children: [
    e ? /* @__PURE__ */ y("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ $("div", { className: "reader-boot-loading-card", children: [
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
function vl(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Sl() {
  const [e, t] = L(!1), n = Ar(), r = A(null);
  return F(() => {
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
  }, [e]), F(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || vl(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ $("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ y(Zo, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ $(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ $("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ y("div", { className: "reader-react-shortcuts-body", children: bi.map((o) => /* @__PURE__ */ $("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ y("h3", { children: o.title }),
            /* @__PURE__ */ y("ul", { children: o.items.map((a) => /* @__PURE__ */ $("li", { children: [
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
const wl = ["source", "sideBySide", "translated"], Pl = { source: "", translated: "", sideBySide: "" };
function Rl(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = ht(e.sourceUrl), n = ht(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Ra({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Eo(e) {
  const [t, n] = L(() => /* @__PURE__ */ new Set()), r = Y(
    () => e ? Rl(e) : Pl,
    [e]
  ), o = Y(
    () => wl.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = U(async (s) => {
    if (!e) return;
    const c = ht(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? Pa(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Ia(
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
        Ta(l), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Il = {
  source: Lr,
  sideBySide: Cr,
  translated: zr
}, Tl = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function El(e) {
  const t = Le(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Eo(n), c = A(null);
  return F(() => {
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
  }, []), /* @__PURE__ */ $("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ $("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ y(Yo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ y(Xo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ y("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = Nr[i], u = ht(r[i]), d = a.has(i), f = !!u && !d, m = f ? "" : Co(i, r), g = Il[i];
      return /* @__PURE__ */ $(
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
            /* @__PURE__ */ y(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ $("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ $("span", { className: "reader-download-action-label", children: [
                Tl[i],
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
const kl = "retainpdf:reader:bookmarks:v1:", Ml = 200;
function On() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ko(e) {
  const t = `${e || ""}`.trim();
  return t ? `${kl}${t}` : "";
}
function Al(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Lt(e, t = On()) {
  const n = ko(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Al(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function un(e, t, n) {
  const r = ko(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Ml);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Nl(e, t, n = "", { storage: r = On(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Lt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? un(e, a.filter((c) => c.page !== s), r) : un(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function _l(e, t, n = On()) {
  return un(e, Lt(e, n).filter((r) => r.page !== t), n);
}
function Ll(e, t) {
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
function Cl({ filled: e }) {
  return /* @__PURE__ */ y("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ y("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function zl({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = L(() => Lt(e)), [c, i] = L(!1), l = A(null);
  if (F(() => {
    s(Lt(e)), i(!1);
  }, [e]), F(() => {
    if (!c) return;
    const f = (g) => {
      l.current && !l.current.contains(g.target) && i(!1);
    }, m = (g) => {
      g.key === "Escape" && i(!1);
    };
    return document.addEventListener("pointerdown", f), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", f), document.removeEventListener("keydown", m);
    };
  }, [c]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), d = a.some((f) => f.page === u);
  return /* @__PURE__ */ $("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Nl(e, u, Ll(r, u))),
        children: /* @__PURE__ */ y(Cl, { filled: d })
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
    c && a.length ? /* @__PURE__ */ y("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ y("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ $("li", { className: f.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ $(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ $("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(_l(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function Dl(e) {
  const t = Le(), n = ao(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? vt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = jr(a), d = a > Fr + 1e-3, f = a < Qe - 1e-3, m = Ge(r, Oe()), g = m >= Qe ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [h, p] = L(!1), [v, w] = L(`${c}`);
  F(() => {
    h || w(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, h]);
  const S = () => {
    if (p(!1), !l || i <= 0)
      return;
    const b = Number(`${v}`.trim());
    l(Nt(b, i));
  };
  return /* @__PURE__ */ $("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ y("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ y("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ $(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (b) => {
          b.preventDefault(), S();
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
              onChange: (b) => w(b.target.value.replace(/[^\d]/g, "")),
              onBlur: S,
              onKeyDown: (b) => {
                b.key === "Escape" && (b.preventDefault(), p(!1), w(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ $("span", { className: "reader-react-hud-page-suffix", children: [
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
          !l || i <= 0 || (w(`${c}`), p(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ y(
      zl,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ $("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ y(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !d,
          onClick: () => s(et(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ $(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${g}`,
          title: g,
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
          onClick: () => s(et(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ y("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ y(Sl, {}) })
  ] });
}
function Tr(e) {
  var t, n;
  return Hr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function xl(e) {
  const [t, n] = L(() => ({
    scope: e,
    panel: Tr(we(e))
  }));
  F(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Tr(we(e))
    });
  }, [e]), F(() => {
    t.scope === e && xt(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = U((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const dn = "download-toast";
function Ol({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ $("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ $("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ y("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ y("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ y("div", { className: "download-toast-track", children: /* @__PURE__ */ y("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ y("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Fl(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Zt.dismiss(dn);
    return;
  }
  Zt.custom(
    () => /* @__PURE__ */ y(Ol, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: dn, duration: 1 / 0 }
  );
}
function $l() {
  const e = U((t) => {
    t && (t.setState = Fl, t.hide = () => Zt.dismiss(dn));
  }, []);
  return /* @__PURE__ */ $(Ct, { children: [
    /* @__PURE__ */ y(Vo, { position: "bottom-right" }),
    /* @__PURE__ */ y("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const jl = () => () => {
}, Bl = () => !1;
function Ul() {
  const e = Yt(), t = (e == null ? void 0 : e.active) ?? Bl;
  return nt((e == null ? void 0 : e.subscribe) ?? jl, t, t);
}
function Hl(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : $r(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Wl(e, t) {
  return t === null || e !== t;
}
function Vl(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function Jl(e, t) {
  const n = e === t;
  return { open: n, mounted: Vl(n) };
}
const Er = { itemId: null, origin: null };
function ql() {
  let e = Er;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Er : { itemId: n, origin: r };
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
const xe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Gl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Kl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Zl = {
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
}, kr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Yl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => kr(o ?? a ?? "", Gl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => kr(o ?? a ?? "", Kl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Zl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Xl(e) {
  return xe(e.translatedBlockText) || xe(e.translated.text) || xe(e.source.text);
}
const Ql = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function eu(e) {
  const t = [];
  for (const n of e) {
    if (!Ql(n)) continue;
    const r = Yl(Xl(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function tu(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const nu = 24, ru = 60;
function Mr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - nu), o = Math.min(e.length, n + t.length + ru), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function ou(e, t, n = 200) {
  const r = xe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const c = xe(a.translatedBlockText) || xe(a.translated.text), i = c ? Mr(c, r) : null, l = i ?? Mr(xe(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
const au = [];
function su({ open: e, onToggle: t }) {
  return /* @__PURE__ */ $("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ $(De, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ y(Qo, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ $(De, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ y(ea, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { children: "搜索" })
    ] })
  ] });
}
function iu({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r
}) {
  var m, g;
  const o = ((m = Le()) == null ? void 0 : m.regions) ?? au, a = ((g = ao()) == null ? void 0 : g.currentPage) ?? 1, s = Y(() => eu(o), [o]), c = tu(s, a), [i, l] = L(""), u = Y(() => ou(o, i), [o, i]), d = A(null), f = A(null);
  return F(() => {
    var h, p, v;
    e === "search" ? (h = d.current) == null || h.focus() : (v = (p = f.current) == null ? void 0 : p.querySelector('[aria-current="location"]')) == null || v.scrollIntoView({ block: "center" });
  }, [e]), /* @__PURE__ */ $("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ $("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ $("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ y(De, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ y(De, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ y(De, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ y(yn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? s.length ? /* @__PURE__ */ y("ol", { ref: f, className: "reader-finder-list", children: s.map((h, p) => /* @__PURE__ */ y("li", { children: /* @__PURE__ */ $(
      De,
      {
        className: "reader-finder-entry",
        "data-level": h.level,
        "aria-current": p === c ? "location" : void 0,
        onClick: () => r(h.itemId),
        children: [
          /* @__PURE__ */ y("span", { className: "reader-finder-entry-text", children: h.text }),
          /* @__PURE__ */ y("span", { className: "reader-finder-entry-page", children: h.page })
        ]
      }
    ) }, h.itemId)) }) : /* @__PURE__ */ y("p", { className: "reader-finder-empty", children: o.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ $(Ct, { children: [
      /* @__PURE__ */ $("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ y(
          ta,
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
      /* @__PURE__ */ y("ol", { className: "reader-finder-list", children: u.map((h) => /* @__PURE__ */ y("li", { children: /* @__PURE__ */ $(De, { className: "reader-finder-entry is-hit", onClick: () => r(h.itemId), children: [
        /* @__PURE__ */ $("span", { className: "reader-finder-entry-text", children: [
          h.snippet.slice(0, h.at),
          /* @__PURE__ */ y("mark", { children: h.snippet.slice(h.at, h.at + h.length) }),
          h.snippet.slice(h.at + h.length)
        ] }),
        /* @__PURE__ */ y("span", { className: "reader-finder-entry-page", children: h.page })
      ] }) }, h.itemId)) })
    ] })
  ] });
}
const cu = No(() => import("./ReaderMarkdownPanel-x1lnwa1r.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Gt = { source: "source", sideBySide: "compare", translated: "translated" };
function lu(e) {
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
function uu(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function du() {
  const e = pi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = xl(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = L(null), [u, d] = L(!1), f = A(null), m = A(null), g = s !== null, h = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, p = lu({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: h,
    liveTranslationVisible: u,
    assistantOpen: g,
    assistantPdfPane: i
  }), v = ni({
    hasOverlayContent: h,
    connection: e.liveTranslation.connection,
    showSource: p.showSource,
    liveTranslationVisible: u,
    assistantOpen: g
  }), w = p.sourceViewOnly, S = p.visibleMode;
  F(() => {
    d(!1);
  }, [e.viewStateKey]), F(() => {
    e.session.jobTerminal && d(!1);
  }, [e.session.jobTerminal]), F(() => {
    l(null);
  }, [a.scope]), F(() => {
    if (!(t.loading || t.failed)) {
      if (f.current !== e.viewStateKey) {
        f.current = e.viewStateKey;
        const E = we(e.viewStateKey), B = Hl({
          savedMode: E == null ? void 0 : E.mode,
          sourceViewOnly: w,
          viewportWidth: Oe()
        });
        m.current = B.auto ? B.mode : null, B.mode && B.mode !== e.mode && e.setModeKeepingPage(B.mode);
        return;
      }
      Wl(e.mode, m.current) && (m.current = null, xt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, w]);
  const b = s || (e.mode === "compare" ? "compare" : "reading"), P = Jl(s, "markdown");
  Pi({
    mode: S,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const k = U(() => {
    c(null), l(null);
  }, []), _ = U((E) => {
    l(null);
    const B = uu(E, e.liveTranslationAvailable);
    B !== null && d(B), e.setModeKeepingPage(E);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), x = Y(() => v.sourcePaneToggle ? /* @__PURE__ */ y(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${u ? " is-active" : ""}`,
      onClick: () => d((E) => !E),
      "aria-pressed": u,
      title: u ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [v.sourcePaneToggle, u]), D = U((E) => {
    c(E), l(null);
  }, []), [z] = L(ql), [R, I] = L(null), T = U((E) => I((B) => B === E ? null : E), []), M = U((E) => {
    e.jumpToAnchor({ block_id: E }), Oe() < 900 && I(null);
  }, [e.jumpToAnchor]), j = U((E) => e.jumpToAnchor({ block_id: E }), [e.jumpToAnchor]), H = Ul(), W = Eo(e.download), J = S === "compare" ? Qe / 2 : Qe, oe = A(!0);
  F(() => {
    H && oe.current && Math.abs(e.userZoom - J) > 1e-3 && e.onZoomChange(J);
  }, [H, J, e.userZoom, e.onZoomChange]);
  const O = Y(
    () => W.downloadItems.filter((E) => ht(W.urls[E])).map((E) => ({ key: `download-${Gt[E]}`, label: `下载${Nr[E].label}` })),
    [W.downloadItems, W.urls]
  ), Q = Y(() => ({
    ready: !t.loading && !t.failed,
    pageIdx: e.currentPage >= 1 ? e.currentPage - 1 : null,
    pageCount: n.hudNumPages >= 1 ? n.hudNumPages : null,
    modes: w ? ["source"] : ["source", "compare", "translated"],
    mode: S ?? null,
    panels: ["outline", "search"],
    panel: R,
    zoom: { percent: jr(e.userZoom), fit: Math.abs(e.userZoom - J) < 1e-3 },
    actions: O
  }), [t.loading, t.failed, e.currentPage, n.hudNumPages, w, S, R, e.userZoom, J, O]);
  F(() => {
    var E;
    H && ((E = Yt()) == null || E.report(Q));
  }, [H, Q]);
  const te = A(() => {
  });
  te.current = (E) => {
    if (E.command === "mode")
      (!w || E.mode === "source") && _(E.mode);
    else if (E.command === "page")
      e.goToPage(E.pageIdx + 1);
    else if (E.command === "panel")
      I(E.panel);
    else if (E.command === "zoom")
      oe.current = E.zoom === "fit", e.onZoomChange(E.zoom === "fit" ? J : et(e.userZoom, E.zoom === "in" ? 1 : -1));
    else if (E.command === "action") {
      const B = Object.keys(Gt).find((pe) => `download-${Gt[pe]}` === E.key);
      B && W.handleDownload(B);
    }
  }, F(() => {
    const E = Yt();
    if (!(!H || !E))
      return E.onCommand((B) => te.current(B));
  }, [H]);
  const N = Y(() => ({
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
    regionHover: z,
    jumpToBlock: j,
    revisedBlocks: e.revisedBlocks,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: w,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: D, close: k }
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
    z,
    j,
    e.revisedBlocks,
    e.sourceOnly,
    w,
    e.download,
    e.goToPage,
    D,
    k
  ]), G = Y(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), ae = [
    ss,
    `is-workspace-${b}`,
    g ? "is-assistant-open" : "",
    R ? "is-finder-open" : "",
    H ? "is-host-chrome" : "",
    p.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ y(rc, { value: N, hud: G, children: /* @__PURE__ */ $("div", { className: ae, "data-reader-engine": "react-pdf", "data-reader-workspace": b, children: [
    /* @__PURE__ */ y(yl, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    H ? null : /* @__PURE__ */ y(su, { open: R, onToggle: T }),
    R ? /* @__PURE__ */ y(
      iu,
      {
        tab: R,
        onTab: I,
        onClose: () => I(null),
        onJump: M
      }
    ) : null,
    H ? null : /* @__PURE__ */ $("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ y(Ci, {}),
      /* @__PURE__ */ y(El, {}),
      /* @__PURE__ */ y(Ai, { onBeforeClose: o.prepareClose })
    ] }),
    H ? null : /* @__PURE__ */ y(
      Rc,
      {
        mode: S,
        documentReady: !!o.jobId,
        sourceViewOnly: w,
        onModeChange: _,
        liveTranslation: v.topBarPill ? {
          visible: u,
          state: e.liveTranslation,
          onToggle: () => d((E) => !E)
        } : null
      }
    ),
    H ? null : /* @__PURE__ */ y(Nc, { active: s }),
    g ? /* @__PURE__ */ y(gl, {}) : null,
    /* @__PURE__ */ y(vc, { paneComposition: p, markdownSplit: P.open, assistantSplit: g, liveTranslation: e.liveTranslation, sourcePaneAction: x }),
    e.showHud && !H ? /* @__PURE__ */ y(
      Dl,
      {
        mode: S,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ y(Ao, { fallback: null, children: P.mounted ? /* @__PURE__ */ y(cu, { open: P.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: k }) : null }),
    /* @__PURE__ */ y($l, {})
  ] }) });
}
function Nu() {
  return /* @__PURE__ */ y(du, {});
}
export {
  Nu as R,
  du as a,
  Mu as d,
  ku as f,
  Au as r,
  Le as u
};
//# sourceMappingURL=ReaderApp-BbIviw4T.js.map
