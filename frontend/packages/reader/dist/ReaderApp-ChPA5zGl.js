var xn = (e) => {
  throw TypeError(e);
};
var On = (e, t, n) => t.has(e) || xn("Cannot " + n);
var at = (e, t, n) => (On(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Fn = (e, t, n) => t.has(e) ? xn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), $n = (e, t, n, r) => (On(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsx as b, jsxs as O, Fragment as Lt } from "react/jsx-runtime";
import { useMemo as X, useState as _, useEffect as j, useCallback as $, useRef as k, useLayoutEffect as _e, useSyncExternalStore as Ct, memo as un, createContext as dn, useContext as fn, forwardRef as Ro, useImperativeHandle as mn, useId as kr, Suspense as Io, lazy as To } from "react";
import { getReaderAdapters as fe, requireAdapter as Qe } from "./adapters.js";
import { resolveReaderDownloadName as Eo, resolveReaderDownloadUrls as ko, READER_PROGRESS_COPY as Ie, trimString as It, READER_DOWNLOAD_ACTIONS as Mo, disabledReason as Ao } from "./runtime/state.js";
import { r as No, b as _o } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Gt, isFinishedJobStatus as hn } from "@retainpdf/domain/job";
import { c as Lo, n as Co, f as jt, j as jn, a as Do, b as zo, h as Mr, p as pn, d as xo, k as Bn, i as Oo } from "./reader-regions-CP3ZMHPc.js";
import { fetchDocumentReading as Fo } from "@retainpdf/api/documents";
import { isReaderTransportError as $o, createReaderTransportError as jo } from "./contracts.js";
import { toast as Kt, Toaster as Bo } from "sonner";
import { NotebookPen as Uo, X as gn, Radio as Ho, FileText as Ar, Columns2 as Nr, Languages as _r, FileCode2 as Wo, Sparkles as Vo, Keyboard as Jo, Download as qo, ChevronDown as Go, ListTree as Ko, Search as Zo } from "lucide-react";
import { Button as Ce, Input as Yo } from "@retainpdf/ui";
import { pdfjs as Xo, Page as Qo, Document as ea } from "react-pdf";
import { extractMarkdownMath as ta, materializeMarkdownMathFallbackHtml as na, materializeMarkdownMathHtml as ra } from "./runtime/content.js";
const oa = (...e) => {
  var t, n;
  return ((n = (t = fe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, aa = "", sa = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ia = (e) => {
  var t, n;
  return ((n = (t = fe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, bu = (...e) => {
  var n;
  return (((n = fe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Te = () => Qe("defaultReaderDataPort"), Un = () => Qe("defaultReaderPageConfigPort"), yu = {
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
}, Lr = {
  messageTargetOrigin: () => Un().messageTargetOrigin(),
  readerJobId: () => Un().readerJobId()
}, ca = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.liveTranslation) ?? null;
}, la = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.notesQuote) ?? null;
}, ua = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.notesPanel) ?? null;
}, da = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.readingPosition) ?? null;
}, fa = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.hostAi) ?? null;
}, ma = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.hostNavigation) ?? null;
}, dt = () => {
  var t;
  const e = fe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Dt = () => {
  const e = fe();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Qe("fetchDocumentByJobId")(...n),
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
  return ((n = (t = fe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, pa = () => {
  var e, t;
  return ((t = (e = fe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ga = (...e) => {
  var t, n;
  return ((n = (t = fe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ba = (...e) => {
  var t, n;
  return ((n = (t = fe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Eo(...e);
}, ya = (...e) => {
  var t, n;
  return ((n = (t = fe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ko(...e);
}, va = (...e) => Qe("downloadProtectedResource")(...e), Sa = (...e) => Qe("failDownloadToast")(...e), vu = (e, t) => Qe("resolveMarkdownAssetUrl")(e, t), Hn = "/api/v1";
function wa() {
  const e = () => {
    var r;
    return No(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = _(e);
  return j(() => {
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
function Pa() {
  const e = wa(), t = X(() => ga(Lr), [e]), n = X(() => pa(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Ra(e) {
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
  }), m = i.documentId === t ? i.jobId : "", h = u.documentId === t ? u.jobId : "", g = n || m, [f, v] = _({
    jobId: "",
    documentId: ""
  }), y = f.jobId === g ? f.documentId : "", S = t || y, P = !!t && !g, [p, w] = _(null), M = (p == null ? void 0 : p.sessionIdentity) === r && p.documentId === S ? p : null, A = P || !!M, F = $((D) => {
    const R = `${D.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      v({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const I = `${D.revision || ""}`.trim() || `${Date.now()}`;
    w({
      documentId: R,
      revision: I,
      sessionIdentity: o.current
    }), c();
  }, []);
  j(() => {
    w((D) => D && D.sessionIdentity !== r ? null : D);
  }, [r]);
  const z = $((D) => {
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
        v((R) => R.jobId === D.jobId && R.documentId === D.documentId ? R : { jobId: D.jobId, documentId: D.documentId });
        break;
      case "committed-source":
        w({
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
    documentJobId: m,
    rejectedDocumentJobId: h,
    sessionJobId: g,
    resolvedJobDocument: f,
    setResolvedJobDocument: v,
    jobDocumentId: y,
    documentId: S,
    sourceOnly: P,
    committedDocumentSource: p,
    setCommittedDocumentSource: w,
    activeCommittedDocumentSource: M,
    sourceViewOnly: A,
    refreshCommittedDocument: F,
    applyIdentityEvent: z
  };
}
function Wn(e) {
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
function Vn(e, t) {
  return ia(Gt(e, t));
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
function Zt({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: sa.progress,
        stage: n,
        percent: e,
        text: t
      },
      Lr.messageTargetOrigin()
    );
  } catch {
  }
}
function Tt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Zt({ percent: t, text: n, stage: r });
}
function ka(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = _(null), [l, u] = _(null), [d, m] = _(""), [h, g] = _(0), f = d === n ? c : null, v = d === n ? l : null, y = Wn(f), S = hn(y), P = $(() => {
    g((z) => z + 1);
  }, []), p = $((z) => {
    i(z.jobPayload), u(z.manifestPayload), m(z.sessionIdentity);
  }, []), w = $((z) => {
    i(null), u(null), m(z);
  }, []), M = k(""), A = k(""), F = $(async () => {
    const z = o.current;
    if (!z || M.current === z) return;
    const D = Dt().loadJobPayload;
    if (typeof D != "function") return;
    const R = a.current.value;
    M.current = z;
    try {
      const I = await D(z);
      if (s.current || a.current.value !== R || o.current !== z || !I || typeof I != "object")
        return;
      const T = Wn(I);
      i(I), m(r.current), T === "succeeded" && A.current !== z && (A.current = z, g((E) => E + 1));
    } catch {
    } finally {
      M.current === z && (M.current = "");
    }
  }, []);
  return j(() => {
    A.current = "";
  }, [n]), j(() => {
    if (!t || S || !f) return;
    const z = window.setInterval(() => {
      document.visibilityState !== "hidden" && F();
    }, 1e3);
    return () => window.clearInterval(z);
  }, [S, F, f, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: m,
    scopedJobPayload: f,
    scopedManifestPayload: v,
    jobStatus: y,
    jobTerminal: S,
    jobRefreshRevision: h,
    refreshJobArtifacts: P,
    refreshJobStatus: F,
    publishPayload: p,
    clearPayload: w
  };
}
function Yt(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ma(e, t) {
  e(t), Yt(t);
}
function Aa(e) {
  const [t, n] = _(e ? "source" : "compare"), r = $((a) => {
    e && a !== "source" || (n(a), Yt(a));
  }, [e]), o = $((a) => {
    Ma(n, a);
  }, []);
  return j(() => (e && document.documentElement.classList.add("reader-source-only"), Yt(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Jn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Na(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Jn(n.active_job_id),
    activeVersionId: Jn(n.active_version_id)
  };
}
function _a(e) {
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
function xa(e) {
  return e ? { data: e.data.slice() } : null;
}
const Oa = 2, be = /* @__PURE__ */ new Map();
function Xt(e, t) {
  be.delete(e), be.set(e, t);
}
function Fa(e) {
  if (be.size < Oa) return;
  const t = be.keys().next().value;
  t && be.delete(t);
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
async function Cr(e, t = dt().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (be.has(r)) {
    const c = be.get(r);
    return Xt(r, c), c;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const c = new Error(`读取 PDF 失败 (${o.status})`);
    c.status = o.status;
    const i = await $a(o);
    throw i && (c.reason = i), c;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return be.has(r) ? Xt(r, s) : (Fa(), be.set(r, s)), s;
}
const ja = { file: null, loading: !1, error: "" }, Ba = { file: null, loading: !0, error: "" };
function Ua(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if (j(() => {
    if (t || !n) return;
    const s = be.get(n);
    if (s) {
      Xt(n, s);
      return;
    }
    const c = new AbortController();
    return Cr(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return ja;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = be.get(n);
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
async function Qt(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Tt(s, r, n, "download");
  const c = await Cr(t, dt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Tt(s, o, n, "download"), c);
}
async function Wa(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Tt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, c = null;
  return t && a.push(
    Qt({
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
    Qt({
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
  fetchReading: r = Fo,
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
const yt = {
  regions: null,
  metadata: null
};
function qa(e) {
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
    activeLoadAbortRef: y
  } = e, [S, P] = _(""), [p, w] = _(""), [M, A] = _(null), [F, z] = _(null), [D, R] = _(!1), [I, T] = _(""), [E, x] = _([]), [U, K] = _(!1), [Y, N] = _(() => ({
    source: null,
    translated: null
  })), [B, C] = _(
    yt
  ), [V, Q] = _({
    loading: !0,
    percent: 4,
    text: Ie.boot,
    stage: "progress",
    failed: !1
  });
  return j(() => {
    const ce = new AbortController(), le = f.current.value, H = Ha({
      sessionEpochRef: f,
      closingRef: v,
      abort: ce,
      sessionEpoch: le
    });
    y.current = ce;
    const ee = Dt();
    if (v.current)
      return ce.abort(), () => {
        y.current === ce && (y.current = null);
      };
    let ye = !1;
    function pe(re, ue) {
      H.markFailed(), K(!0), Q({
        loading: !1,
        percent: 100,
        text: re,
        stage: "failed",
        failed: !0
      }), Zt({ percent: 100, text: ue, stage: "failed" });
    }
    function et() {
      R(!0), ye || K(!0), Q({
        loading: !1,
        percent: 100,
        text: Ie.ready,
        stage: "ready",
        failed: !1
      }), Zt({ percent: 100, text: Ie.ready, stage: "ready" });
    }
    function Ft() {
      return l != null && l.documentId ? Vn(
        l.documentId,
        l.revision
      ) : oa() ? aa : ee.resolveResourceUrl(Gt(r));
    }
    async function He() {
      var ae;
      let re = { activeJobId: "", activeVersionId: "" };
      try {
        const se = await ((ae = ee.fetchDocument) == null ? void 0 : ae.call(ee, r));
        se && (re = Na(se));
      } catch {
      }
      const ue = _a({
        link: re,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (ue.kind === "follow-active-job") {
        if (H.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: ue.jobId
        }), ue.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: ue.activeVersionId,
          sessionIdentity: i
        }), h("source")) : h("compare");
        return;
      }
      if (ue.kind === "open-committed-source") {
        if (H.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: ue.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const he = Ft();
      if (H.isInactive()) return;
      P(he), w(""), T(""), m(i);
      const oe = await Qt({
        url: he,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: H,
        setBoot: Q
      });
      if (!H.isInactive()) {
        if (!oe) {
          pe("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        A(oe), et();
      }
    }
    async function tt() {
      var q;
      const re = !l, ue = !!(re && ee.loadSessionSnapshot && ee.loadReaderOptionalArtifacts), he = ue ? ee.loadReaderOptionalArtifacts(t) : null, oe = await ((q = ee.loadSessionSnapshot) == null ? void 0 : q.call(ee, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: re && !ue
      })), ae = oe ? {
        jobPayload: oe.sourcePayload,
        manifestPayload: oe.manifestPayload,
        readerMetadata: oe.readerMetadata,
        regionsPayload: oe.regions,
        readerErrors: oe.readerErrors
      } : await ee.loadReaderPayload(t, {
        includeOptionalArtifacts: re
      });
      if (H.isInactive()) return;
      let se = null;
      if (n && !r)
        if (oe && oe.linkedDocument !== void 0)
          se = oe.linkedDocument;
        else {
          try {
            se = await ee.fetchDocumentByJobId(Hn, t);
          } catch {
          }
          if (H.isInactive()) return;
        }
      const We = Ia(ae.jobPayload) || `${(se == null ? void 0 : se.document_id) || ""}`.trim();
      We && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: We
      });
      const Re = La({
        payloadDocumentId: We,
        linkedActiveJobId: `${(se == null ? void 0 : se.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(se == null ? void 0 : se.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Re.kind === "restore-committed-source") {
        if (H.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Re.documentId,
          revision: Re.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const Me = ee.resolveReaderSourcePdf(ae.manifestPayload), nt = ee.resolveReaderTranslatedPdfUrl(ae.jobPayload, ae.manifestPayload), $t = typeof Me == "string" ? Me : ee.resolveReaderArtifactUrl(Me), bt = r || We, rt = l != null && l.documentId ? Vn(
        l.documentId,
        l.revision
      ) : $t || (bt ? ee.resolveResourceUrl(Gt(bt)) : ""), ot = l ? "" : nt || "";
      P(rt || ""), w(ot), T(Ea(ae.jobPayload, t)), d({
        jobPayload: ae.jobPayload || null,
        manifestPayload: ae.manifestPayload || null,
        sessionIdentity: i
      });
      const L = () => Wa({
        sourceFinal: rt || "",
        translatedFinal: ot,
        fence: H,
        setBoot: Q
      }), J = !!(rt || ot), W = he && J ? L() : null;
      W == null || W.catch(() => {
      });
      const G = (Z) => {
        H.isInactive() || (x(l ? [] : Lo(Z.regionsPayload)), N(l ? { source: null, translated: null } : Co(Z.readerMetadata)), C(l ? yt : Z.readerErrors ?? yt), K(!0));
      };
      if (he ? (ye = !0, he.then(G)) : G(ae), !J) {
        pe(Ie.failed, Ie.failed);
        return;
      }
      const ne = await (W ?? L());
      if (ne.status !== "inactive") {
        if (ne.status === "incomplete") {
          pe("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        A(ne.sourceBytes), z(ne.translatedBytes), et();
      }
    }
    async function Pe() {
      R(!1), A(null), z(null), x([]), K(!1), N({ source: null, translated: null }), C(yt), Tt(Q, 8, Ie.metadata, "metadata");
      try {
        if (s) {
          await He();
          return;
        }
        if (!t) {
          pe(Ie.failed, Ie.failed);
          return;
        }
        await tt();
      } catch (re) {
        if (H.isClosedOrStale() || (re == null ? void 0 : re.name) === "AbortError") return;
        H.markFailed();
        const ue = Number(re == null ? void 0 : re.status), he = `${(re == null ? void 0 : re.reason) || ""}`, oe = za({ status: ue, reason: he, sessionJobId: t });
        if (oe && (await Ja({
          apiPrefix: Hn,
          documentId: oe,
          expiredJobId: t
        }) || H.isClosedOrStale()))
          return;
        if (Ca({
          status: ue,
          reason: he,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const ae = re instanceof Error ? re.message : Ie.failed;
        pe(ae, ae);
      }
    }
    return Pe(), () => {
      ce.abort(), y.current === ce && (y.current = null);
    };
  }, [t, r, o, a, s, c, l, g, n, i, u, d, m, h]), {
    sourceUrl: S,
    translatedUrl: p,
    sourceFile: M,
    translatedFile: F,
    assetsReady: D,
    title: I,
    regions: E,
    regionsSettled: U,
    readerMetadata: Y,
    readerErrors: B,
    boot: V
  };
}
function Ga() {
  const e = k(!1), t = k(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Pa(), s = k({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = k(a), i = k(""), l = k(""), u = k(() => {
  }), d = $(() => u.current(), []), m = Ra({
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
  } = m, { mode: y, setMode: S, switchSessionMode: P } = Aa(v);
  u.current = () => {
    P("source");
  }, c.current = a, i.current = g, l.current = h;
  const p = ka({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: w,
    scopedManifestPayload: M,
    jobStatus: A,
    jobTerminal: F,
    jobRefreshRevision: z,
    refreshJobArtifacts: D,
    refreshJobStatus: R
  } = p, I = qa({
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
    switchSessionMode: P,
    jobRefreshRevision: z,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = $(() => {
    var x;
    e.current = !0, (x = t.current) == null || x.abort();
  }, []), E = X(
    () => ({
      fetchProtected: Dt().fetchProtected,
      jobId: h,
      jobPayload: w,
      manifestPayload: M,
      sourceUrl: I.sourceUrl,
      translatedUrl: I.translatedUrl,
      sourceOnly: v
    }),
    [h, w, M, I.sourceUrl, I.translatedUrl, v]
  );
  return {
    jobId: h,
    jobStatus: A,
    workflow: `${(w == null ? void 0 : w.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: F,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: f,
    mode: y,
    setMode: S,
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
    download: E,
    refreshJobArtifacts: D,
    refreshJobStatus: R,
    refreshCommittedDocument: m.refreshCommittedDocument,
    prepareClose: T
  };
}
const Ka = 160, Za = 8, Ya = 0;
function Xa() {
  const e = k(null), [t, n] = _(null), [r, o] = _(Ya), a = $((s) => {
    e.current = s, n(s);
  }, []);
  return j(() => {
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
const Bt = { source: 0, translated: 0 };
function es(e, t) {
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
  const [d, m] = _(() => ({
    identity: l,
    pages: Bt
  })), [h, g] = _(() => ({ identity: l, tick: 0 })), f = d.identity === l ? d.pages : Bt, v = h.identity === l ? h.tick : 0, y = Qa({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: S } = y, P = $((R, I) => {
    u.current === l && m((T) => {
      const E = T.identity === l ? T.pages : Bt;
      return E[I] === R && T.identity === l ? T : {
        identity: l,
        pages: { ...E, [I]: R }
      };
    });
  }, [l]), p = k(null), w = $(() => {
    p.current && clearTimeout(p.current);
    const R = l;
    p.current = setTimeout(() => {
      p.current = null, u.current === R && g((I) => ({
        identity: R,
        tick: I.identity === R ? I.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  j(() => (p.current && (clearTimeout(p.current), p.current = null), m((R) => R.identity === l && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: l, pages: { source: 0, translated: 0 } }), g((R) => R.identity === l && R.tick === 0 ? R : { identity: l, tick: 0 }), () => {
    p.current && (clearTimeout(p.current), p.current = null);
  }), [l]);
  const M = X(
    () => Math.max(f.source, f.translated),
    [f]
  ), A = S === "translated" ? f.translated : f.source || f.translated, F = t == null ? void 0 : t.userZoom, z = t == null ? void 0 : t.shellWidth, D = `${l}-${v}-${F}-${n}-${f.source}-${f.translated}-${z}`;
  return {
    ...y,
    numPagesByPane: f,
    hudNumPages: M,
    primaryNumPages: A,
    metricsTick: v,
    onNumPages: P,
    onMetrics: w,
    rowSyncRevision: D
  };
}
const xe = "data-reader-page", Ye = "data-reader-pane", bn = "data-natural-height", ts = "reader-react-root", ns = "reader-react-grid", rs = "reader-react-scroll-shell", os = "reader-react-pdf-pane", Dr = "reader-react-pdf-page", Et = "reader-react-pdf-page-placeholder", yn = "reader-react-pdf-page-slot";
function kt(e, t) {
  const n = e != null ? `[${xe}="${e}"]` : `[${xe}]`;
  return t ? `${n}[${Ye}="${t}"]` : n;
}
function as() {
  return `.${yn}[${xe}]`;
}
function vn(e) {
  return Number(e.getAttribute(xe));
}
const zr = 0.25, Mt = 1, ss = 0.05, gt = 0.5, is = 16, cs = 8, ls = 720;
function ze() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function xr(e) {
  return Number.isFinite(e) && e < ls;
}
function qe(e, t = Number.POSITIVE_INFINITY) {
  return xr(t) && (e === "source" || e === "translated") ? Mt : gt;
}
function zt(e) {
  return Number.isFinite(e) ? Math.min(Mt, Math.max(zr, e)) : gt;
}
function ft(e, t) {
  const n = zt(Number(e) + t * ss);
  return Math.round(n * 100) / 100;
}
function us(e) {
  return Math.round(zt(e) * 100);
}
function ds(e) {
  const n = (Number(e) || 0) - is - cs;
  return Math.max(160, Math.floor(n));
}
function fs(e, t = gt) {
  const n = zt(t);
  return ds((Number(e) || 0) * n);
}
function ms(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Ye}]`)
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
const Or = 200, Fr = [
  "markdown"
], gs = Fr;
function $r(e) {
  return gs.includes(e);
}
const bs = "retainpdf:reader:view:v1:", qn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), ys = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function jr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function en(e) {
  return `${e || ""}`.trim();
}
function vs({
  documentId: e,
  jobId: t
}) {
  const n = en(e);
  if (n) return `document:${n}`;
  const r = en(t);
  return r ? `job:${r}` : "";
}
function Br(e) {
  const t = en(e);
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
  if (!(!qn.has(t) || !qn.has(n) || t === n))
    return { left: t, right: n };
}
function Ps(e) {
  return e === null ? null : $r(e) ? e : void 0;
}
function Rs(e) {
  return ys.has(e) ? e : void 0;
}
function Ur(e) {
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
function we(e, t = jr()) {
  const n = Br(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Ur(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function xt(e, t, n = jr()) {
  const r = Br(e);
  if (!r || !n) return null;
  const o = we(e, n), a = Ur({
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
  const [r, o] = _(() => {
    var h;
    return ((h = we(n)) == null ? void 0 : h.zoom) ?? qe(e, ze());
  }), a = k(r), s = k(n);
  a.current = r;
  const c = k(1), i = k(((m = we(n)) == null ? void 0 : m.zoom) !== void 0);
  j(() => {
    var f;
    if (s.current === n) return;
    s.current = n;
    const h = (f = we(n)) == null ? void 0 : f.zoom;
    i.current = h !== void 0;
    const g = h ?? qe(e, ze());
    c.current = 1, a.current = g, o(g);
  }, [e, n]), j(() => {
    if (i.current) return;
    const h = qe(e, ze()), g = a.current;
    Math.abs(h - g) < 5e-4 || (c.current = 1, a.current = h, o(h));
  }, [e]);
  const l = $((h) => {
    const g = zt(h), f = a.current;
    Math.abs(g - f) < 5e-4 || (c.current = g / (f || 1), i.current = !0, xt(s.current, { zoom: g }), o(g));
  }, []), u = $((h) => {
    l(ft(a.current, h));
  }, [l]), d = $((h) => {
    l(qe(h));
  }, [l]);
  return _e(() => {
    const h = c.current;
    Math.abs(h - 1) < 1e-3 || (c.current = 1, ms(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function Ts(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = k(t), a = k(n), s = k(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: $((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const Sn = 48;
function Hr(e, t = Sn) {
  return e.getBoundingClientRect().top + t;
}
function Wr(e, t) {
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
  const o = vn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function Pt(e, t, n = Sn) {
  if (!e)
    return null;
  const r = kt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Hr(e, n), c = Wr(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function Ot(e, t, n = "auto", r, o = Sn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(kt(a, r))), c || (c = e.querySelector(kt(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), m = Math.max(0, d + s * u - o);
  return n === "auto" ? e.scrollTop = m : e.scrollTo({ top: m, behavior: n }), !0;
}
function Es(e, t, n = "smooth", r) {
  return Ot(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function tn(e, t, n) {
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
function ks(e, t, n) {
  return tn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function At(e, t) {
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
function Ms(e, t, n = !0, r = "", o) {
  const [a, s] = _(1);
  return j(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, u = 0;
    const d = kt(void 0, o), m = () => {
      if (i) return;
      const f = Array.from(c.querySelectorAll(d));
      if (!f.length)
        return;
      const v = Hr(c), y = Wr(f, v);
      y && s(y.page);
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
const As = `canvas, .react-pdf__Page, .${Dr}, .${Et}`, Gn = /* @__PURE__ */ new WeakMap();
function Ns(e) {
  const t = Number(e.getAttribute(bn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Gn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(As), Gn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function _s(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Ls(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(as()).forEach((r) => {
    const o = vn(r);
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
function Cs(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = k(o), c = k(r);
  return c.current = r, _e(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
    const m = () => {
      var w;
      if (i) return;
      const P = e.current;
      if (!P) return;
      const p = Ls(P);
      _s(s.current, p) || (s.current = p, a(p)), u && !d && (d = !0, (w = c.current) == null || w.call(c));
    }, h = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(m);
      });
    };
    h();
    const g = window.setTimeout(h, 100), f = window.setTimeout(() => {
      u = !0, h();
    }, 300), v = window.setTimeout(h, 700), y = e.current;
    let S = null;
    return y && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => h()), S.observe(y)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(f), window.clearTimeout(v), S == null || S.disconnect();
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
]), js = 180, Kn = [0, 48, 140, 320, 700, 1200];
function Bs(e, t) {
  var I;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = k(
    ((I = we(a)) == null ? void 0 : I.anchor) || { page: 1, fraction: 0 }
  ), i = k(null), l = k(!1), u = k(r), d = k(null), m = k(null), h = k(null), g = k(null), f = k(a), v = k(""), y = k(n);
  y.current = n;
  const S = $(() => {
    var T;
    (T = d.current) == null || T.call(d), d.current = null, m.current != null && (clearTimeout(m.current), m.current = null);
  }, []), P = $(() => {
    !l.current && i.current == null || (S(), h.current != null && (clearTimeout(h.current), h.current = null), i.current = null, l.current = !1);
  }, [S]), p = $((T = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const E = () => {
      g.current = null, xt(f.current, {
        anchor: ge(c.current)
      });
    };
    T ? E() : g.current = setTimeout(E, js);
  }, []), w = $((T) => {
    c.current = ge(T), i.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, l.current = !1;
    }, Fs);
  }, []);
  j(() => {
    if (!o)
      return;
    let T = !1, E = null, x = null, U = null;
    const K = () => {
      if (T) return;
      const Y = e.current;
      if (!Y) {
        U = setTimeout(K, 50);
        return;
      }
      E = Y, x = () => {
        if (l.current)
          return;
        const N = Pt(E, y.current);
        N && (c.current = N, p());
      }, E.addEventListener("scroll", x, { passive: !0 }), l.current || x();
    };
    return K(), () => {
      T = !0, U != null && clearTimeout(U), E && x && E.removeEventListener("scroll", x);
    };
  }, [o, r, n, e, p]), j(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const E = (x) => {
      x.metaKey || x.ctrlKey || x.altKey || $s.has(x.key) && P();
    };
    return T.addEventListener("wheel", P, { passive: !0 }), T.addEventListener("touchmove", P, { passive: !0 }), window.addEventListener("keydown", E), () => {
      T.removeEventListener("wheel", P), T.removeEventListener("touchmove", P), window.removeEventListener("keydown", E);
    };
  }, [o, e, P]), _e(() => {
    var E;
    if (f.current === a) return;
    p(!0), S(), h.current != null && (clearTimeout(h.current), h.current = null), f.current = a, v.current = "";
    const T = (E = we(a)) == null ? void 0 : E.anchor;
    c.current = T ? ge(T) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, p, S]), j(() => {
    var E;
    if (!o || !s || !a || v.current === a) return;
    v.current = a;
    const T = ge(
      ((E = we(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = T, i.current = T, l.current = !0, S(), d.current = tn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: y.current,
        delaysMs: Kn,
        onDone: () => w(T)
      }
    ), m.current = setTimeout(() => {
      m.current = null, w(T);
    }, Math.max(...Kn) + 160), () => S();
  }, [o, s, a, e, w, S]), j(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, S();
      return;
    }
    const T = i.current ? ge(i.current) : ge(c.current);
    return l.current = !0, i.current = T, c.current = T, S(), d.current = tn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ds,
        onDone: () => w(T)
      }
    ), m.current = setTimeout(() => {
      m.current = null, w(T);
    }, zs), () => {
      S();
    };
  }, [r, o, n, e, w, S]), j(() => () => {
    S(), h.current != null && (clearTimeout(h.current), h.current = null), p(!0);
  }, [S, p]);
  const M = $(() => {
    const T = Pt(
      e.current,
      y.current
    );
    return ge(T || c.current);
  }, [e]), A = $(() => {
    l.current = !0;
    const T = Pt(
      e.current,
      y.current
    ), E = ge(T ?? c.current);
    return c.current = E, i.current = E, p(), E;
  }, [e, p]), F = $((T, E, x) => {
    const U = x || y.current, K = At(T, E || 1), Y = { page: K, fraction: 0 };
    c.current = Y, l.current = !0, i.current = Y, p(), S(), Es(e.current, K, "smooth", U), d.current = ks(
      () => e.current,
      K,
      {
        behavior: "auto",
        pane: U,
        delaysMs: xs,
        onDone: () => w(Y)
      }
    ), m.current = setTimeout(() => {
      m.current = null, w(Y);
    }, Os);
  }, [e, w, S, p]), z = $(() => ge(c.current), []), D = $(() => l.current, []), R = $(() => {
    if (!l.current || !i.current)
      return;
    const T = ge(i.current);
    Ot(
      e.current,
      T,
      "auto",
      y.current
    );
  }, [e]);
  return {
    lockFromShell: M,
    beginModeSwitch: A,
    goToPage: F,
    getAnchor: z,
    isRestoring: D,
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
function Vr(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Hs = [0, 80, 200, 400, 800], Ws = 120, Vs = 400;
function Js(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l, regionsSettled: u = !0 } = e, d = k(a);
  d.current = a;
  const m = k(s);
  m.current = s;
  const h = k(c);
  h.current = c;
  const g = k(n);
  g.current = n, j(() => {
    var p, w;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const f = ha(), v = Us(f, m.current);
    if (v == null && (f != null && f.blockId) && !u) return;
    const y = Vr(f, v, { jobId: i, documentId: l });
    if (t.current === y)
      return;
    if (v == null) {
      t.current = y, (p = g.current) == null || p.call(g);
      return;
    }
    t.current = y, f && ((w = h.current) == null || w.call(h, f, v));
    const S = [];
    let P = 0;
    for (const M of Hs)
      P = Math.max(P, M), S.push(
        setTimeout(() => {
          d.current(v);
        }, M)
      );
    return S.push(
      setTimeout(() => {
        var M;
        (M = g.current) == null || M.call(g);
      }, P + Ws)
    ), () => {
      for (const M of S) clearTimeout(M);
    };
  }, [r, o, i, l, t, u]);
}
function qs(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Gs(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Vs,
    jobId: c,
    documentId: i,
    applyReaderSearch: l
  } = e, u = k(a);
  u.current = a;
  const d = k(l);
  d.current = l;
  const m = k(0);
  j(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || m.current === o) return;
    const h = setTimeout(() => {
      var y;
      const g = ((y = globalThis.location) == null ? void 0 : y.search) || "", f = _o(g, o, u.current);
      if (m.current = o, f === null) return;
      const v = `${new URLSearchParams(f).get("block_id") || ""}`.trim();
      t.current = Vr(
        { blockId: v },
        o,
        { jobId: c, documentId: i }
      ), (d.current || qs)(f);
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
  const t = k(""), [n, r] = _(!1), o = $(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Js(a, t, o), Gs(e, t, n);
}
const st = {
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
function Zn(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Jr(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Zn(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Zn(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Ys(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Jr(r, t, n);
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
const Yn = [250, 500, 1e3, 2e3, 4e3], Ut = [80, 160, 320, 640, 1e3, 1500], Xn = [250, 500, 1e3, 2e3, 4e3, 5e3];
function nn(e, t) {
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
function wn(e) {
  return $o(e) ? `${e.code || ""}`.trim() : "";
}
function vt(e, t) {
  const n = wn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Qs(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Jr(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = jo(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (i) {
      if ((i == null ? void 0 : i.name) === "AbortError") throw i;
      a = i;
      const l = wn(i);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw i;
    }
    const c = Ut[Math.min(s, Ut.length - 1)];
    if (await nn(c, r), s >= Ut.length + 2) throw a;
  }
}
function ei({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _(st), s = k(o), c = k("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = hn(l) ? l : "";
  return j(() => {
    if (!n || !i) {
      c.current = "", s.current = st, a(st);
      return;
    }
    const d = r === void 0 ? ca() : r, m = c.current === i;
    if (c.current = i, !d) {
      const P = {
        ...m ? s.current : st,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = P, a(P);
      return;
    }
    const h = new AbortController();
    let g = !1;
    const f = {
      ...m ? s.current : st,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = f, a(f);
    const v = (P) => {
      h.signal.aborted || a((p) => {
        const w = P(p);
        return s.current = w, w;
      });
    }, y = async () => {
      let P = 0;
      for (; !h.signal.aborted; )
        try {
          const p = await d.fetchLayout(i, { signal: h.signal });
          g = !0, v((w) => ({
            ...w,
            layoutByPage: Zs(p),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError") return;
          const w = wn(p);
          if (!(w === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !w)) {
            v((A) => ({
              ...A,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: vt(p, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            v((A) => ({
              ...A,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          v((A) => ({
            ...A,
            connection: "connecting",
            jobStatus: l,
            error: vt(p, "正在等待 OCR 版面数据")
          })), await nn(Yn[Math.min(P, Yn.length - 1)], h.signal).catch(() => {
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
              let w;
              try {
                w = await Qs(
                  i,
                  p,
                  s.current,
                  h.signal,
                  d
                );
              } catch (M) {
                if ((M == null ? void 0 : M.name) === "AbortError" || h.signal.aborted) throw M;
                v((A) => ({
                  ...A,
                  lastSeq: Math.max(A.lastSeq, p.seq),
                  error: vt(M, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              v((M) => {
                const A = Ys(M, p, w);
                return u ? {
                  ...A,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...A,
                  jobStatus: l
                };
              }), P = 0;
            }
          });
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError" || h.signal.aborted) return;
          v((w) => ({
            ...w,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: vt(p, "实时译文连接已中断，正在重连")
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
        await nn(Xn[Math.min(P, Xn.length - 1)], h.signal).catch(() => {
        }), P += 1;
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
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return j(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Dt().fetchRevisionGroups;
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
const ri = 2e3;
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
function qr(e) {
  return !!(e.jobId && e.sourceUrl && ai.has(e.workflow));
}
function si(e) {
  return !!(qr(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function ii() {
  const e = Ga(), t = qr({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = si({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = k({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !hn(o) && (r.current.running = !0);
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
    goToPage: y,
    repinIfRestoring: S
  } = Bs(s, {
    primaryPane: f.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: d,
    restoreReady: f.primaryNumPages > 0
  });
  j(() => {
    S();
  }, [i, S]);
  const P = Cs(
    s,
    f.compareMode,
    f.rowSyncRevision,
    S
  ), p = Ms(
    s,
    f.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${f.metricsTick}`,
    f.primaryPane
  ), w = $((N, B) => {
    var V, Q;
    const C = Math.max(
      Number(f.hudNumPages) || 0,
      Number(f.primaryNumPages) || 0,
      Number((V = f.numPagesByPane) == null ? void 0 : V.source) || 0,
      Number((Q = f.numPagesByPane) == null ? void 0 : Q.translated) || 0
    );
    y(N, C, B);
  }, [y, f.hudNumPages, f.primaryNumPages, f.numPagesByPane]), [M, A] = _(null), F = k(null), z = $((N) => {
    F.current && clearTimeout(F.current), A(N), N && (F.current = setTimeout(() => A(null), ri));
  }, []);
  j(() => () => {
    F.current && clearTimeout(F.current);
  }, []);
  const D = $((N) => {
    const B = jt(e.regions, N);
    return B ? jn(B, f.primaryPane).page : null;
  }, [e.regions, f.primaryPane]), R = $((N, B) => {
    const C = B || f.primaryPane, V = typeof N == "object" && N ? `${N.block_id || ""}`.trim() : "", Q = typeof N == "object" && N ? `${N.image_url || ""}`.trim() : "", ce = typeof N == "object" && N ? N.page_idx != null ? Number(N.page_idx) + 1 : N.page != null ? Number(N.page) : null : typeof N == "number" ? N + 1 : null, le = Do(e.regions, Q, ce) || jt(e.regions, V) || (typeof N == "object" ? zo(e.regions, N) : null);
    let H = le ? jn(le, C).page : null;
    H == null && (H = oi(N)), !(H == null || H < 1) && (z(le), w(H, C));
  }, [z, w, f.primaryPane, e.regions]);
  Ks({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: f.hudNumPages || 0,
    currentPage: p,
    goToPage: w,
    resolveBlockPage: D,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (N) => {
      z(jt(e.regions, N.blockId));
    }
  });
  const I = !e.boot.loading && !e.boot.failed && e.assetsReady, T = Number(f.hudNumPages) || 0;
  j(() => {
    var N;
    I && ((N = da()) == null || N.report(p >= 1 ? p - 1 : null, T >= 1 ? T : null));
  }, [I, p, T]), j(() => {
    const N = ma();
    if (!(!N || !I || !e.jobId))
      return N.subscribe(({ jobId: B, pageIdx: C, blockId: V }) => B !== e.jobId ? !1 : (R({ ...C != null ? { page_idx: C } : {}, ...V ? { block_id: V } : {} }), !0));
  }, [I, e.jobId, R]);
  const { setModeKeepingPage: E } = Ts({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  j(() => {
    z(null);
  }, [m, z]);
  const x = !e.boot.loading && !e.boot.failed, U = X(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), K = X(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), Y = X(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: g,
    shell: U,
    panes: f,
    sessionFiles: K,
    rowHeights: P,
    goToPage: w,
    activeRegion: M,
    jumpToAnchor: R,
    setModeKeepingPage: E,
    download: e.download,
    showHud: x,
    viewStateKey: d,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, U, f, K, P, w, M, R, E, x, h, g, d, a, n, u]);
  return X(() => ({
    ...Y,
    currentPage: p
  }), [Y, p]);
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
  j(() => {
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
              a(ft(o, 1));
              return;
            case "zoom-out":
              a(ft(o, -1));
              return;
            case "zoom-reset":
              a(qe(t, ze()));
              return;
            case "next-page":
              i(At(s + 1, c));
              return;
            case "prev-page":
              i(At(s - 1, c));
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
function Gr(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed") || ""}`.trim();
  } catch {
    return "";
  }
}
function gi(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed_pane") || ""}`.trim();
  } catch {
    return "";
  }
}
function bi() {
  const e = new URL("./index.html", window.location.href), t = Gr();
  return t && e.searchParams.set("embed", t), e.href;
}
function yi() {
  if (typeof window > "u" || window.self === window.top || Gr()) return !1;
  try {
    return window.parent.postMessage(
      { type: pi },
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
function Kr({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ b("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function wi({ onBeforeClose: e } = {}) {
  return gi() === "beside" ? null : /* @__PURE__ */ O(Kr, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Si();
  }, children: [
    /* @__PURE__ */ b(gn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ b("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Pi = { available: !1, open: !1, title: null }, Ri = () => () => {
}, Ii = () => Pi;
function Ti() {
  const e = ua(), t = (e == null ? void 0 : e.getState) ?? Ii, n = Ct((e == null ? void 0 : e.subscribe) ?? Ri, t, t);
  if (!e || !n.available) return null;
  const r = n.open ? `收起笔记${n.title ? `：${n.title}` : ""}` : "打开这本书的笔记";
  return /* @__PURE__ */ b(Kr, { className: "reader-notes-toggle", label: r, pressed: n.open, onClick: e.toggle, children: /* @__PURE__ */ b(Uo, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }) });
}
let Qn = !1;
function Ei() {
  if (Qn)
    return;
  const e = dt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Xo.GlobalWorkerOptions.workerSrc = e, Qn = !0);
}
const ki = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Mi(e, t, n) {
  return e.flatMap((r) => {
    if (!ki.has(Mr(r.region))) return [];
    const o = pn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function er(e, t, n) {
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
async function Ai(e) {
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
const Ni = "reader-text-hover-copy", _i = "reader-text-hover-id", Zr = "reader-text-hover-tools", Li = "reader-text-hover-quote";
function Ci(e) {
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
const Yr = 26, Nt = 190;
function Xr(e, t = Nt) {
  return e.height < Yr * 2 || e.width < t;
}
const Di = 72;
function zi({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = _("idle"), [a, s] = _("idle"), [c, i] = _("idle"), l = k([]), u = (e == null ? void 0 : e.itemId) || "";
  if (j(() => {
    o("idle"), s("idle"), i("idle");
    const P = l.current;
    return () => {
      P.forEach((p) => window.clearTimeout(p)), l.current = [];
    };
  }, [u]), !e) return null;
  const d = xo(e.highlight.region, t), m = Mr(e.highlight.region), h = (P, p) => async (w) => {
    w.preventDefault(), w.stopPropagation();
    const M = await Ai(P);
    p(M ? "copied" : "failed"), l.current.push(window.setTimeout(() => p("idle"), 1200));
  }, g = m === "formula" ? "复制 LaTeX" : "复制", f = la(), v = !!(f != null && f.available()), y = (P) => {
    P.preventDefault(), P.stopPropagation();
    const p = !!(f != null && f.send(Ci(e)));
    i(p ? "copied" : "failed"), l.current.push(window.setTimeout(() => i("idle"), 1200));
  }, S = Xr(e.rect, v ? Nt + Di : Nt);
  return /* @__PURE__ */ b("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ b(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": m,
      style: e.rect,
      children: /* @__PURE__ */ O(
        "div",
        {
          className: Zr,
          "data-placement": S ? "outside" : "inside",
          children: [
            /* @__PURE__ */ b(
              Ht,
              {
                className: _i,
                state: a,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: h(e.itemId, s),
                children: a === "copied" ? "已复制编号" : e.itemId
              }
            ),
            t === "translated" && n > 0 ? /* @__PURE__ */ O("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            d ? /* @__PURE__ */ b(
              Ht,
              {
                className: Ni,
                state: r,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: h(d, o),
                children: r === "copied" ? "已复制" : r === "failed" ? "复制失败" : g
              }
            ) : null,
            v ? /* @__PURE__ */ b(
              Ht,
              {
                className: Li,
                state: c,
                label: "把这一段摘到笔记",
                title: "摘到笔记：原文和译文一起放进打开的笔记",
                onClick: y,
                children: c === "copied" ? "已摘" : c === "failed" ? "没摘上" : "摘到笔记"
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function xi(e, t) {
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
function Oi(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = pn(
      xi(e, a),
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
const Fi = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', $i = 256, it = /* @__PURE__ */ new Map();
function ji(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Bi(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ta(t, { bareLatex: !0 }), o = ji(n), a = na(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = it.get(t);
  if (!s && (s = ra(o, r), it.set(t, s), it.size > $i)) {
    const c = it.keys().next().value;
    c !== void 0 && it.delete(c);
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
function Ui(e, t) {
  const n = e.typography, r = Ee(t) || 1, o = Ee(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Wt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Ee(n == null ? void 0 : n.fit_min_font_size_pt), u = Ee(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), m = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), h = o ? o * r : i, g = Ee(n == null ? void 0 : n.leading_em), f = [
    Ee(n == null ? void 0 : n.padding_top_pt) || 0,
    Ee(n == null ? void 0 : n.padding_right_pt) || 0,
    Ee(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ee(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((v) => v * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Fi,
    fontSizePx: Math.max(d, Math.min(m, h)),
    minFontSizePx: d,
    maxFontSizePx: m,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Wt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Wt(e.kind) ? "center" : "justify",
    padding: f,
    exact: !!o
  };
}
function Hi(e, t, n, r) {
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
const Wi = 512, ct = /* @__PURE__ */ new Map();
let rn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  rn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  rn += 1;
}));
function Vi(e, t, n, r) {
  return [
    rn,
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
function Ji({ item: e, pageScale: t }) {
  const n = k(null), r = X(
    () => Bi(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = X(
    () => Ui(e, t),
    [e, t]
  );
  j(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((m) => {
      d && a(m);
    }), () => {
      d = !1;
    };
  }, [r]), _e(() => {
    const d = n.current;
    if (!d) return;
    const [m, h, g, f] = s.padding, v = Math.max(1, e.rect.width - f - h), y = Math.max(1, e.rect.height - m - g), S = Vi(o, v, y, s);
    let P = ct.get(S);
    if (P === void 0 && (P = Hi(
      (p) => (d.style.fontSize = `${p}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      v,
      y,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), ct.set(S, P), ct.size > Wi)) {
      const p = ct.keys().next().value;
      p !== void 0 && ct.delete(p);
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
function qi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = X(
    () => Oi(e, t, n, r),
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
        Ji,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Gi = un(qi), Qr = dn(null), eo = dn(null);
function Ki({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ b(Qr.Provider, { value: e, children: /* @__PURE__ */ b(eo.Provider, { value: t, children: n }) });
}
function je() {
  return fn(Qr);
}
function to() {
  return fn(eo);
}
const no = 1.414;
function Zi({
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
  hoveredRegionId: m,
  onHoverRegion: h,
  liveTranslationLayout: g,
  liveTranslationPage: f,
  showLiveTranslation: v = r === "source"
}) {
  var B;
  const y = (B = je()) == null ? void 0 : B.revisedBlocks, S = k(c ?? no), [P, p] = _(S.current);
  j(() => {
    c != null && Math.abs(c - S.current) >= 1e-3 && (S.current = c, p(c));
  }, [c]);
  const w = k(l);
  w.current = l;
  const M = k((C) => {
    var V;
    (V = w.current) == null || V.call(w, C);
  }).current, A = Math.max(120, Math.floor(t * P)), F = Math.max(A, Math.ceil(a || 0)), z = pn(u, t, A), D = X(
    () => Mi(d, t, A),
    [A, d, t]
  ), [R, I] = _(null), T = typeof h == "function", E = T ? m ?? null : R, x = (C) => {
    T ? C !== (m ?? null) && (h == null || h(C)) : I((V) => V === C ? V : C);
  }, U = X(
    () => D.find((C) => C.itemId === E) || null,
    [E, D]
  ), K = (C) => {
    var ee, ye;
    if (C.pointerType === "touch") return;
    if (C.buttons !== 0) {
      x(null);
      return;
    }
    if ((ye = (ee = C.target) == null ? void 0 : ee.closest) != null && ye.call(ee, `.${Zr}`)) return;
    const V = C.currentTarget.getBoundingClientRect(), Q = C.clientX - V.left, ce = C.clientY - V.top, le = U == null ? void 0 : U.rect;
    if (le && Xr(le) && Q >= le.left - 4 && Q <= le.left + Nt && ce >= le.top - Yr && ce <= le.top) return;
    const H = er(D, Q, ce);
    x((H == null ? void 0 : H.itemId) || null);
  }, Y = (C) => {
    if (C.pointerType === "mouse") return;
    const V = C.currentTarget.getBoundingClientRect(), Q = er(
      D,
      C.clientX - V.left,
      C.clientY - V.top
    );
    x((Q == null ? void 0 : Q.itemId) || null);
  }, N = (C) => {
    !Number.isFinite(C) || C <= 0 || Math.abs(S.current - C) < 1e-3 || (S.current = C, p(C), i == null || i(e, C));
  };
  return /* @__PURE__ */ O(
    "div",
    {
      ref: M,
      [xe]: e,
      [Ye]: r,
      [bn]: A,
      className: yn,
      onPointerMoveCapture: K,
      onPointerDown: Y,
      onPointerLeave: (C) => {
        C.pointerType === "mouse" && x(null);
      },
      style: {
        width: t,
        height: F,
        minHeight: F
      },
      children: [
        o ? /* @__PURE__ */ b(
          Qo,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: !0,
            renderAnnotationLayer: !1,
            className: Dr,
            loading: /* @__PURE__ */ b(
              "div",
              {
                className: Et,
                style: { width: t, height: A }
              }
            ),
            onLoadSuccess: (C) => {
              try {
                const V = C.getViewport({ scale: 1 });
                if (V.width > 0) {
                  const Q = V.height / V.width;
                  N(Q);
                }
              } catch {
              }
              s == null || s();
            },
            onRenderSuccess: () => {
              s == null || s();
            }
          }
        ) : /* @__PURE__ */ b(
          "div",
          {
            className: Et,
            style: { width: t, height: A },
            "aria-hidden": !0
          }
        ),
        z ? /* @__PURE__ */ b(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: z,
            "aria-hidden": "true"
          }
        ) : null,
        o && v ? /* @__PURE__ */ b(
          Gi,
          {
            layoutPage: g,
            pageState: f,
            width: t,
            height: A
          }
        ) : null,
        o && r === "translated" && (y != null && y.size) ? /* @__PURE__ */ b("div", { className: "reader-revised-markers", "aria-hidden": "true", children: D.filter((C) => y.has(C.itemId)).map((C) => /* @__PURE__ */ b(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": C.itemId,
            style: { left: C.rect.left, top: C.rect.top, height: C.rect.height }
          },
          C.itemId
        )) }) : null,
        /* @__PURE__ */ b(
          zi,
          {
            target: o ? U : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: U && (y == null ? void 0 : y.get(U.itemId)) || 0
          }
        )
      ]
    }
  );
}
const Yi = un(Zi), Vt = 5, Xi = "120% 0px", Qi = 120;
let tr = 1;
const nr = /* @__PURE__ */ new WeakMap();
function ec(e) {
  if (!e) return 0;
  const t = nr.get(e);
  if (t) return t;
  const n = tr;
  return tr += 1, nr.set(e, n), n;
}
function tc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const nc = Ro(
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
    hoveredRegionId: y = null,
    onHoverRegion: S,
    liveTranslation: P,
    showLiveTranslation: p = t === "source",
    liveTranslationPendingLabel: w = "",
    paneAction: M
  }, A) {
    Ei();
    const { file: F, loading: z, error: D } = Ua(n, r), R = `${n}\0${ec(F)}`, I = k(R);
    I.current = R;
    const T = X(
      () => xa(F),
      [F, n]
    ), [E, x] = _(0), [U, K] = _(""), [Y, N] = _(null), [B, C] = _(480), V = k(null), Q = k(0), ce = X(() => tc(), []), le = X(() => ({
      cMapUrl: dt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: dt().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    mn(A, () => Y, [Y]), j(() => {
      const L = (q) => {
        Q.current = q, C(q);
      }, J = (q) => {
        const Z = ps(q, Q.current);
        if (Z !== "ignore") {
          if (V.current && clearTimeout(V.current), Z === "immediate") {
            L(q);
            return;
          }
          V.current = setTimeout(() => L(q), Or);
        }
      }, W = !!(i && i >= 80);
      J(W ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const ne = !W && c && typeof ResizeObserver < "u" ? new ResizeObserver((q) => {
        var Z, ie;
        J(((ie = (Z = q[0]) == null ? void 0 : Z.contentRect) == null ? void 0 : ie.width) ?? c.clientWidth);
      }) : null;
      return ne && c && ne.observe(c), () => {
        ne == null || ne.disconnect(), V.current && clearTimeout(V.current);
      };
    }, [i, c, a]);
    const H = X(
      () => fs(B, o),
      [B, o]
    ), [ee, ye] = _(() => /* @__PURE__ */ new Map()), [pe, et] = _(() => /* @__PURE__ */ new Set()), [Ft, He] = _(() => /* @__PURE__ */ new Set()), tt = k(/* @__PURE__ */ new Map()), Pe = k(null), re = k(/* @__PURE__ */ new Map()), ue = $((L, J) => {
      ye((W) => {
        if (W.get(L) === J) return W;
        const G = new Map(W);
        return G.set(L, J), G;
      });
    }, []), he = $((L, J) => {
      const W = tt.current, G = W.get(L);
      if (G && Pe.current)
        try {
          Pe.current.unobserve(G);
        } catch {
        }
      if (J) {
        if (W.set(L, J), Pe.current)
          try {
            Pe.current.observe(J);
          } catch {
          }
      } else
        W.delete(L);
    }, []), oe = k(/* @__PURE__ */ new Map()), ae = $((L) => {
      const J = oe.current;
      let W = J.get(L);
      return W || (W = (G) => he(L, G), J.set(L, W)), W;
    }, [he]);
    j(() => {
      if (typeof IntersectionObserver > "u") return;
      const L = re.current, J = new IntersectionObserver(
        (W) => {
          const G = [], ne = [];
          for (const q of W) {
            const Z = q.target, ie = vn(Z);
            Number.isFinite(ie) && (q.isIntersecting ? G : ne).push(ie);
          }
          if ((G.length || ne.length) && et((q) => {
            let Z = null;
            for (const ie of G)
              q.has(ie) || (Z = Z || new Set(q), Z.add(ie));
            for (const ie of ne)
              q.has(ie) && (Z = Z || new Set(q), Z.delete(ie));
            return Z || q;
          }), G.length) {
            for (const q of G) {
              const Z = L.get(q);
              Z && (clearTimeout(Z), L.delete(q));
            }
            He((q) => {
              let Z = null;
              for (const ie of G)
                q.has(ie) || (Z = Z || new Set(q), Z.add(ie));
              return Z || q;
            });
          }
          for (const q of ne)
            L.has(q) || L.set(q, setTimeout(() => {
              L.delete(q), He((Z) => {
                if (!Z.has(q)) return Z;
                const ie = new Set(Z);
                return ie.delete(q), ie;
              });
            }, Qi));
        },
        { root: c, rootMargin: Xi, threshold: 0 }
      );
      Pe.current = J;
      for (const W of tt.current.values())
        try {
          J.observe(W);
        } catch {
        }
      return () => {
        J.disconnect(), Pe.current === J && (Pe.current = null);
        for (const W of L.values()) clearTimeout(W);
        L.clear();
      };
    }, [c]), _e(() => {
      x(0), K(""), et(/* @__PURE__ */ new Set()), He(/* @__PURE__ */ new Set()), ye(/* @__PURE__ */ new Map()), tt.current.clear();
      const L = re.current;
      for (const J of L.values()) clearTimeout(J);
      L.clear(), h == null || h(0, t);
    }, [R, h, t]);
    const se = $(
      ({ numPages: L }) => {
        I.current === R && (x(L), K(""), h == null || h(L, t), d == null || d({ numPages: L, pane: t }));
      },
      [R, d, h, t]
    ), We = $(
      (L) => {
        if (I.current !== R) return;
        const J = (L == null ? void 0 : L.message) || "PDF 解析失败";
        K(J), x(0), h == null || h(0, t), m == null || m(L, t);
      },
      [R, m, h, t]
    ), Re = X(
      () => E > 0 ? Array.from({ length: E }, (L, J) => J + 1) : [],
      [E]
    );
    j(() => {
      typeof IntersectionObserver < "u" || He(new Set(Re));
    }, [Re]);
    const Me = X(
      () => Bn(g, v, t),
      [g, v, t]
    ), nt = X(() => {
      const L = /* @__PURE__ */ new Map();
      for (const J of f) {
        const W = Bn(J, v, t);
        if (!W) continue;
        const G = L.get(W.box.page) || [];
        G.push(W), L.set(W.box.page, G);
      }
      return L;
    }, [t, v, f]), $t = X(() => {
      const L = /* @__PURE__ */ new Set();
      if (!y) return L;
      for (const [J, W] of nt)
        W.some((G) => G.itemId === y) && L.add(J);
      return L;
    }, [y, nt]), bt = X(() => {
      if (E === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(Re);
      if (pe.size === 0) {
        const W = Math.min(E, Vt * 2 + 1);
        return new Set(Array.from({ length: W }, (G, ne) => ne + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const W of pe)
        for (let G = -Vt; G <= Vt; G++) {
          const ne = W + G;
          ne >= 1 && ne <= E && J.add(ne);
        }
      return J;
    }, [E, Re, c, a, pe]), rt = !n || !!D || !!U, ot = n && (D || U) || s;
    return /* @__PURE__ */ O(
      "section",
      {
        ref: N,
        className: `reader-panel ${os}${a ? "" : " is-hidden"}`,
        [Ye]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (P == null ? void 0 : P.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          M ? /* @__PURE__ */ b("div", { className: "reader-react-pdf-pane-action", children: M }) : null,
          w ? /* @__PURE__ */ O("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ b("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ b("span", { children: w })
          ] }) : null,
          rt && !z ? /* @__PURE__ */ b("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ot }) : null,
          z ? /* @__PURE__ */ b("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !D ? /* @__PURE__ */ b("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ b(
            ea,
            {
              file: T,
              loading: null,
              error: null,
              options: le,
              onLoadSuccess: se,
              onLoadError: We,
              className: "reader-react-pdf-document",
              children: Re.map((L) => {
                if (bt.has(L))
                  return /* @__PURE__ */ b(
                    Yi,
                    {
                      pane: t,
                      pageNumber: L,
                      width: H,
                      devicePixelRatio: ce,
                      active: Ft.has(L),
                      syncedMinHeight: (l == null ? void 0 : l.get(L)) || 0,
                      onMetrics: u,
                      cachedAspect: ee.get(L),
                      onAspectChange: ue,
                      sentinelRef: ae(L),
                      regionHighlight: (Me == null ? void 0 : Me.box.page) === L ? Me : null,
                      regionTargets: nt.get(L),
                      hoveredRegionId: y && $t.has(L) ? y : null,
                      onHoverRegion: S,
                      liveTranslationLayout: P == null ? void 0 : P.layoutByPage.get(L - 1),
                      liveTranslationPage: P == null ? void 0 : P.pagesByPage.get(L - 1),
                      showLiveTranslation: p
                    },
                    `${t}-${L}`
                  );
                const W = ee.get(L) ?? no, G = Math.max(120, Math.floor(H * W)), ne = Math.max(G, Math.ceil((l == null ? void 0 : l.get(L)) || 0));
                return /* @__PURE__ */ b(
                  "div",
                  {
                    ref: ae(L),
                    [xe]: L,
                    [Ye]: t,
                    [bn]: G,
                    className: yn,
                    style: {
                      width: H,
                      height: ne,
                      minHeight: ne
                    },
                    children: /* @__PURE__ */ b(
                      "div",
                      {
                        className: Et,
                        style: { width: H, height: G },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${L}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), rr = un(nc), rc = 2e3, oc = 6;
function ac(e, t) {
  const n = k(null), r = k(null);
  _e(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, startHeight: a.startHeight, started: a.started } : null;
    if (!s) {
      const S = sc(e), P = Pt(e, S);
      if (!P) return;
      s = { pane: S, progress: P, startHeight: e.scrollHeight, started: performance.now() };
    }
    const { pane: c, progress: i, startHeight: l, started: u } = s;
    let d = 0, m = null, h = l, g = 0, f = u;
    const v = () => {
      var S;
      m && clearTimeout(m), cancelAnimationFrame(d);
      for (const P of or) e.removeEventListener(P, v);
      ((S = r.current) == null ? void 0 : S.stop) === v && (r.current = null);
    }, y = () => {
      Ot(e, i, "auto", c);
      const S = e.scrollHeight;
      g = S === h ? g + 1 : 0, h = S, S !== l && g >= oc || performance.now() - f > rc ? v() : d = requestAnimationFrame(y);
    };
    for (const S of or) e.addEventListener(S, v, { passive: !0 });
    r.current = { ...s, stop: v }, m = setTimeout(() => {
      m = null, f = performance.now(), d = requestAnimationFrame(y);
    }, Or);
  }, [e, t]), j(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function sc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${xe}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ye) || null;
  }
  return null;
}
const or = ["wheel", "touchstart", "keydown", "pointerdown"], ic = () => () => {
}, ar = () => null;
function cc({
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
function lc(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function uc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function dc(e) {
  const t = je(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), m = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? gt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, f = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), v = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, y = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, P = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", p = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", w = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, M = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, A = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), F = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), z = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), D = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), I = (t == null ? void 0 : t.regionHover) ?? null, [T, E] = _(null), x = Ct(
    I ? I.subscribe : ic,
    I ? () => I.get().itemId : ar,
    I ? () => I.get().itemId : ar
  ), U = I ? x : T, K = $((C) => {
    I ? I.set(C, "pdf") : E(C);
  }, [I]), Y = cc({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), B = Number.isFinite(g) && g > 0 ? lc(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return ac(m, B), /* @__PURE__ */ b(
    "div",
    {
      ref: d,
      className: rs,
      "data-reader-region-count": D.length,
      "data-reader-structured-region-count": D.filter(Oo).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ O(
        "main",
        {
          className: `${ns} reader-mode-${Y.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            v ? /* @__PURE__ */ b(
              rr,
              {
                pane: "source",
                url: P,
                preloadedFile: w,
                userZoom: h,
                visible: Y.showSource,
                scrollRoot: m,
                pageWidthOverride: B,
                rowHeights: Y.compareMode ? f : void 0,
                onMetrics: A,
                emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: F,
                activeRegion: z,
                regions: D,
                readerMetadata: R,
                hoveredRegionId: U,
                onHoverRegion: K,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? uc(o) : "",
                paneAction: u ? /* @__PURE__ */ O(Lt, { children: [
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
              rr,
              {
                pane: "translated",
                url: p,
                preloadedFile: M,
                userZoom: h,
                visible: Y.showTranslated,
                scrollRoot: m,
                pageWidthOverride: B,
                rowHeights: Y.compareMode ? f : void 0,
                onMetrics: A,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: F,
                activeRegion: z,
                regions: D,
                readerMetadata: R,
                hoveredRegionId: U,
                onHoverRegion: K,
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
const fc = [
  { id: "source", label: "原文", Icon: Ar },
  { id: "compare", label: "对照", Icon: Nr },
  { id: "translated", label: "译文", Icon: _r }
];
function mc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function hc(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function pc(e) {
  const t = je(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? mc(a.state) : "";
  return /* @__PURE__ */ O("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ O(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ b(Ho, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ b("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ b("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: fc.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, m = hc({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ O(
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
            /* @__PURE__ */ b(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ b("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        i
      );
    }) })
  ] });
}
const gc = () => () => {
}, bc = () => !1;
function yc() {
  const e = fa(), t = (e == null ? void 0 : e.available) ?? bc, n = Ct((e == null ? void 0 : e.subscribe) ?? gc, t, t), r = $(() => !!(e != null && e.available() && e.ask()), [e]);
  return { available: n, ask: r };
}
const vc = {
  markdown: { label: "Markdown", short: "MD", Icon: Wo, needsJob: !0 }
}, Sc = Fr.map(
  (e) => ({ id: e, ...vc[e] })
);
function wc() {
  return Sc.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Pc(e) {
  const t = je(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = yc(), i = [
    ...wc().map(({ id: l, label: u, short: d, Icon: m, needsJob: h }) => ({
      key: l,
      label: u,
      short: d,
      Icon: m,
      disabled: h && o,
      selected: n === l,
      badge: r == null ? void 0 : r[l],
      onClick: () => a(l)
    })),
    ...c.available ? [{ key: "host-ai", label: "AI", short: "AI", Icon: Vo, disabled: !1, selected: !1, onClick: () => void c.ask() }] : []
  ];
  return n ? /* @__PURE__ */ O("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ b("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: u, Icon: d, disabled: m, selected: h, badge: g, onClick: f }) => /* @__PURE__ */ O(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": h,
        className: `reader-assistant-dock-tab${h ? " is-active" : ""}`,
        title: m ? `${u} 需打开任务阅读` : u,
        disabled: m,
        onClick: f,
        children: [
          /* @__PURE__ */ b(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ b("span", { className: "reader-assistant-dock-tab-label", children: u }),
          g ? /* @__PURE__ */ b("span", { className: "reader-assistant-dock-badge", children: g }) : null
        ]
      },
      l
    )) }),
    /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ b(gn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ b("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: i.map(({ key: l, label: u, short: d, Icon: m, disabled: h, badge: g, onClick: f }) => /* @__PURE__ */ O(
    "button",
    {
      type: "button",
      className: "reader-assistant-rail-button",
      "aria-label": `打开${u}`,
      title: h ? `${u} 需打开任务阅读` : u,
      disabled: h,
      onClick: f,
      children: [
        /* @__PURE__ */ b(m, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
        /* @__PURE__ */ b("span", { children: d }),
        g ? /* @__PURE__ */ b("span", { className: "reader-assistant-dock-badge", children: g }) : null
      ]
    },
    l
  )) });
}
function Rc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Ic(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Tc(e) {
  return e / 100 * window.innerHeight;
}
function Ec(e) {
  return e / 100 * window.innerWidth;
}
function kc(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function lt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = kc(n);
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
      r = Ic(t, o);
      break;
    }
    case "em": {
      r = Rc(t, o);
      break;
    }
    case "vh": {
      r = Tc(o);
      break;
    }
    case "vw": {
      r = Ec(o);
      break;
    }
  }
  return r;
}
function me(e) {
  return parseFloat(e.toFixed(3));
}
function Xe({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function on(e) {
  const { panels: t } = e, n = Xe({ group: e });
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
      const u = lt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = me(u / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const u = lt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = me(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = lt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = me(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = lt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = me(u / n * 100);
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
function te(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function an(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Mc : Ac
  );
}
function Mc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Ac(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function ro(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function oo(e, t) {
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
function Nc({
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
    const { x: c, y: i } = oo(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return te(o, "No rect found"), o;
}
let St;
function _c() {
  return St === void 0 && (typeof matchMedia == "function" ? St = !!matchMedia("(pointer:coarse)").matches : St = !1), St;
}
function ao(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = an(
    n,
    Array.from(t.children).filter(ro).map((g) => ({ element: g }))
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
          (y) => y.element === f
        );
        if (v) {
          if (m) {
            const y = m.element.getBoundingClientRect(), S = f.getBoundingClientRect();
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
              ), w = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (h.length) {
                case 0: {
                  P = [
                    p,
                    w
                  ];
                  break;
                }
                case 1: {
                  const M = h[0], A = Nc({
                    orientation: n,
                    rects: [y, S],
                    targetRect: M.element.getBoundingClientRect()
                  });
                  P = [
                    M,
                    A === y ? w : p
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
                  S.top,
                  S.left - y.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  y.bottom,
                  S.width,
                  S.top - y.bottom
                )
              ];
            for (const p of P) {
              let w = "width" in p ? p : p.element.getBoundingClientRect();
              const M = _c() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (w.width < M) {
                const F = M - w.width;
                w = new DOMRect(
                  w.x - F / 2,
                  w.y,
                  w.width + F,
                  w.height
                );
              }
              if (w.height < M) {
                const F = M - w.height;
                w = new DOMRect(
                  w.x,
                  w.y - F / 2,
                  w.width,
                  w.height + F
                );
              }
              const A = g <= l || g > u;
              !c && !A && s.push({
                group: e,
                groupSize: Xe({ group: e }),
                panels: [m, v],
                separator: "width" in p ? void 0 : p,
                rect: w
              }), c = !1;
            }
          }
          i = !1, m = v, h = [];
        }
      } else if (f.hasAttribute("data-separator")) {
        f.ariaDisabled !== null && (c = !0);
        const v = o.find(
          (y) => y.element === f
        );
        v ? h.push(v) : (m = void 0, h = []);
      } else
        i = !0;
  }
  return s;
}
var Ae;
class so {
  constructor() {
    Fn(this, Ae, {});
  }
  addListener(t, n) {
    const r = at(this, Ae)[t];
    return r === void 0 ? at(this, Ae)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = at(this, Ae)[t];
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
    $n(this, Ae, {});
  }
  removeListener(t, n) {
    const r = at(this, Ae)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ae = new WeakMap();
let Ke = {
  cursorFlags: 0,
  state: "inactive"
};
const Pn = new so();
function Oe() {
  return Ke;
}
function Lc(e) {
  return Pn.addListener("change", e);
}
function Cc(e) {
  const t = Ke, n = { ...Ke };
  n.cursorFlags = e, Ke = n, Pn.emit("change", {
    prev: t,
    next: n
  });
}
function Ze(e) {
  const t = Ke;
  Ke = e, Pn.emit("change", {
    prev: t,
    next: e
  });
}
const Dc = (e) => e, Jt = () => {
}, io = 1, co = 2, lo = 4, uo = 8, sr = 3, ir = 12;
let wt;
function cr() {
  return wt === void 0 && (wt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (wt = !0)), wt;
}
function zc({
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
        if (e && cr()) {
          const a = (e & io) !== 0, s = (e & co) !== 0, c = (e & lo) !== 0, i = (e & uo) !== 0;
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
    return cr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const lr = /* @__PURE__ */ new WeakMap();
function Rn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = lr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Oe();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = zc({
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
  lr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Se = /* @__PURE__ */ new Map();
const fo = new so();
function xc(e) {
  Se = new Map(Se), Se.delete(e);
}
function ur(e, t) {
  for (const [n] of Se)
    if (n.id === e)
      return n;
}
function Ne(e, t) {
  for (const [n, r] of Se)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function Be() {
  return Se;
}
function In(e, t) {
  return fo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function ke(e, t, n) {
  const r = Se.get(e);
  Se = new Map(Se), Se.set(e, t), fo.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function mo(e) {
  const t = Oe();
  let n = !1;
  switch (t.state) {
    case "active":
      Ze({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Rn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Ne(r.group.id, !0);
        ke(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function dr(e) {
  e.defaultPrevented || mo(e.currentTarget);
}
function Oc(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = oo(n, a.rect);
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
function Fc(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function $c(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: hr(e),
    b: hr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  te(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: mr(fr(n.a)),
    b: mr(fr(n.b))
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
const jc = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Bc(e) {
  const t = getComputedStyle(ho(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Uc(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Bc(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || jc.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function fr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (te(n, "Missing node"), Uc(n)) return n;
  }
  return null;
}
function mr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function hr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ho(e);
  return t;
}
function ho(e) {
  const { parentNode: t } = e;
  return Fc(t) ? t.host : t;
}
function Hc(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Wc({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!ro(n) || n.contains(e) || e.contains(n))
    return !0;
  if ($c(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Hc(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Tn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = ao(o), s = Oc(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Wc({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Vc(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function de(e, t, n = 0) {
  return Math.abs(me(e) - me(t)) <= n;
}
function ve(e, t) {
  return de(e, t) ? 0 : e > t ? 1 : -1;
}
function Ge({
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
  return r = Math.min(c, r), r = me(r), r;
}
function mt({
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
  te(u != null, "Invalid first pivot index"), te(d != null, "Invalid second pivot index");
  let m = 0;
  switch (a) {
    case "keyboard": {
      {
        const f = e < 0 ? d : u, v = n[f];
        te(
          v,
          `Panel constraints not found for index ${f}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: S,
          minSize: P = 0
        } = v;
        if (S) {
          const p = c[f];
          if (te(
            p != null,
            `Previous layout not found for panel index ${f}`
          ), de(p, y)) {
            const w = P - p;
            ve(w, Math.abs(e)) > 0 && (e = e < 0 ? 0 - w : w);
          }
        }
      }
      {
        const f = e < 0 ? u : d, v = n[f];
        te(
          v,
          `No panel constraints found for index ${f}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: S,
          minSize: P = 0
        } = v;
        if (S) {
          const p = c[f];
          if (te(
            p != null,
            `Previous layout not found for panel index ${f}`
          ), de(p, P)) {
            const w = p - y;
            ve(w, Math.abs(e)) > 0 && (e = e < 0 ? 0 - w : w);
          }
        }
      }
      break;
    }
    default: {
      const f = e < 0 ? d : u, v = n[f];
      te(
        v,
        `Panel constraints not found for index ${f}`
      );
      const y = c[f], { collapsible: S, collapsedSize: P, minSize: p } = v;
      if (S && ve(y, p) < 0)
        if (e > 0) {
          const w = p - P, M = w / 2, A = y + e;
          ve(A, p) < 0 && (e = ve(e, M) <= 0 ? 0 : w);
        } else {
          const w = p - P, M = 100 - w / 2, A = y - e;
          ve(A, p) < 0 && (e = ve(100 + e, M) > 0 ? 0 : -w);
        }
      break;
    }
  }
  {
    const f = e < 0 ? 1 : -1;
    let v = e < 0 ? d : u, y = 0;
    for (; ; ) {
      const P = c[v];
      te(
        P != null,
        `Previous layout not found for panel index ${v}`
      );
      const p = Ge({
        overrideDisabledPanels: s,
        panelConstraints: n[v],
        prevSize: P,
        size: 100
      }) - P;
      if (y += p, v += f, v < 0 || v >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(y));
    e = e < 0 ? 0 - S : S;
  }
  {
    let f = e < 0 ? u : d;
    for (; f >= 0 && f < n.length; ) {
      const v = Math.abs(e) - Math.abs(m), y = c[f];
      te(
        y != null,
        `Previous layout not found for panel index ${f}`
      );
      const S = y - v, P = Ge({
        overrideDisabledPanels: s,
        panelConstraints: n[f],
        prevSize: y,
        size: S
      });
      if (!de(y, P) && (m += y - P, l[f] = P, m.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? f-- : f++;
    }
  }
  if (Vc(i, l))
    return o;
  {
    const f = e < 0 ? d : u, v = c[f];
    te(
      v != null,
      `Previous layout not found for panel index ${f}`
    );
    const y = v + m, S = Ge({
      overrideDisabledPanels: s,
      panelConstraints: n[f],
      prevSize: v,
      size: y
    });
    if (l[f] = S, !de(S, y)) {
      let P = y - S, p = e < 0 ? d : u;
      for (; p >= 0 && p < n.length; ) {
        const w = l[p];
        te(
          w != null,
          `Previous layout not found for panel index ${p}`
        );
        const M = w + P, A = Ge({
          overrideDisabledPanels: s,
          panelConstraints: n[p],
          prevSize: w,
          size: M
        });
        if (de(w, A) || (P -= A - w, l[p] = A), de(P, 0))
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
  return l.reduce((f, v, y) => (f[g[y]] = v, f), {});
}
function Fe(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || ve(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function $e({
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
      te(i != null, `No layout data found for index ${c}`);
      const l = 100 / o * i;
      r[c] = l;
    }
  let a = 0;
  for (let c = 0; c < t.length; c++) {
    const i = n[c];
    te(i != null, `No layout data found for index ${c}`);
    const l = r[c];
    te(l != null, `No layout data found for index ${c}`);
    const u = Ge({
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
      te(i != null, `No layout data found for index ${c}`);
      const l = i + a, u = Ge({
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
function po({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = Be();
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
    if (f && i < m && (g || l.slice(0, h).every((v, y) => {
      const S = d[y];
      return (S == null ? void 0 : S.collapsible) && de(S.collapsedSize, u[S.panelId]);
    }))) {
      const v = l.slice(0, h).reduce((y, S) => y + u[S.id], 0);
      return {
        ...u,
        [t]: me(100 - v)
      };
    }
    return mt({
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
    }), y = $e({
      layout: v,
      panelConstraints: d
    });
    Fe(g, y) || ke(m, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: h,
      layout: y,
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
      const { group: l } = n(), { element: u } = o(), d = Xe({ group: l }), m = lt({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), h = me(m / d * 100);
      c(h);
    }
  };
}
function pr(e) {
  if (e.defaultPrevented)
    return;
  const t = Be();
  Tn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = po({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Rt(e) {
  const t = Be();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function go({
  groupId: e
}) {
  const t = () => {
    const n = Be();
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
      } = t(), l = $e({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (Fe(c, l) || ke(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function Le(e, t) {
  const n = Rt(e), r = Ne(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  te(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  te(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = go({ groupId: n.id }).getLayout(), i = mt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = $e({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  Fe(c, l) || ke(
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
function gr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Rt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && Le(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Le(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Le(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Le(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Le(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Rt(t), o = Ne(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (m) => m.element === t
        );
        te(i, "Matching separator not found");
        const l = c.get(i);
        te(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (m) => m.panelId === u.id
        );
        if (te(d, "Panel metadata not found"), d.collapsible) {
          const m = s[u.id], h = d.collapsedSize === m ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          Le(t, h - m);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Rt(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        te(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), Le(t, -100);
        break;
      }
    }
}
function br(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = Be(), n = Tn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Ze({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function bo({
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
    const v = r.get(u), y = o.get(u);
    if (!v || !y)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: P,
      groupSize: p,
      layout: w,
      separatorToPanels: M
    } = y;
    if (P && w && M) {
      const A = mt({
        delta: f,
        initialLayout: v,
        panelConstraints: P,
        pivotIndices: l.panels.map((F) => h.indexOf(F)),
        prevLayout: w,
        trigger: "mouse-or-touch"
      });
      if (Fe(A, w)) {
        if (f !== 0 && !g)
          switch (m) {
            case "horizontal": {
              c |= f < 0 ? io : co;
              break;
            }
            case "vertical": {
              c |= f < 0 ? lo : uo;
              break;
            }
          }
      } else
        ke(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: P,
          groupSize: p,
          layout: A,
          separatorToPanels: M
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & sr : i |= c & sr, t.movementY === 0 ? i |= s & ir : i |= c & ir, Cc(i), Rn(e);
}
function yr(e) {
  const t = Be(), n = Oe();
  switch (n.state) {
    case "active":
      bo({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function vr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = Oe(), n = Be();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Ze({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Ne(a.group.id, !0);
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
      bo({
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
      const a = Tn(e, n);
      a.length === 0 ? t.state !== "inactive" && Ze({
        cursorFlags: 0,
        state: "inactive"
      }) : Ze({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Rn(e.currentTarget);
      break;
    }
  }
}
function Sr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Oe().state) {
      case "hover":
        Ze({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function wr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || mo(e.currentTarget) && e.preventDefault();
}
function Pr(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = me(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = me((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Jc(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = Xe({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, c = {
    asPercentage: me(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = c, r.onResize(c, r.id, s);
}
function qc(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Gc({
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
        const h = m / 100 * n, g = me(
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
      u[d] = me(
        m / a * l
      );
    }
  else {
    const d = me(
      l / i.length
    );
    for (const m of i)
      u[m] = d;
  }
  return u;
}
function Kc(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Ve = /* @__PURE__ */ new Map();
function Zc(e) {
  let t = !0;
  te(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const f of g) {
      const { borderBoxSize: v, target: y } = f;
      if (y === e.element) {
        if (t) {
          const S = Xe({ group: e });
          if (S === 0)
            return;
          const P = Ne(e.id);
          if (!P)
            return;
          const p = on(e), w = P.defaultLayoutDeferred ? Pr(p) : P.layout, M = Gc({
            group: e,
            nextGroupSize: S,
            prevGroupSize: P.groupSize,
            prevLayout: w
          }), A = $e({
            layout: M,
            panelConstraints: p
          });
          if (!P.defaultLayoutDeferred && Fe(P.layout, A) && qc(
            P.derivedPanelConstraints,
            p
          ) && P.groupSize === S)
            return;
          ke(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: p,
            groupSize: S,
            layout: A,
            separatorToPanels: P.separatorToPanels
          });
        }
      } else
        Jc(e, y, v);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    te(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Xe({ group: e }), c = on(e), i = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Kc(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? Pr(c), d = $e({
    layout: u,
    panelConstraints: c
  }), m = e.element.ownerDocument;
  Ve.set(
    m,
    (Ve.get(m) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return ao(e).forEach((g) => {
    g.separator && h.set(g.separator, g.panels);
  }), ke(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: h
  }), e.separators.forEach((g) => {
    te(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", gr);
  }), Ve.get(m) === 1 && (m.addEventListener("contextmenu", dr, !0), m.addEventListener("dblclick", pr, !0), m.addEventListener("pointerdown", br, !0), m.addEventListener("pointerleave", yr), m.addEventListener("pointermove", vr), m.addEventListener("pointerout", Sr), m.addEventListener("pointerup", wr, !0)), function() {
    t = !1, Ve.set(
      m,
      Math.max(0, (Ve.get(m) ?? 0) - 1)
    ), xc(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", gr);
    }), Ve.get(m) || (m.removeEventListener(
      "contextmenu",
      dr,
      !0
    ), m.removeEventListener(
      "dblclick",
      pr,
      !0
    ), m.removeEventListener(
      "pointerdown",
      br,
      !0
    ), m.removeEventListener("pointerleave", yr), m.removeEventListener("pointermove", vr), m.removeEventListener("pointerout", Sr), m.removeEventListener("pointerup", wr, !0)), a.disconnect();
  };
}
function Yc() {
  const [e, t] = _({}), n = $(() => t({}), []);
  return [e, n];
}
function En(e) {
  const t = kr();
  return `${e ?? t}`;
}
const Ue = typeof window < "u" ? _e : j;
function ut(e) {
  const t = k(e);
  return Ue(() => {
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
  return ut((t) => {
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
function Mn(e) {
  const t = k({ ...e });
  return Ue(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const yo = dn(null);
function Xc(e, t) {
  const n = k({
    getLayout: () => ({}),
    setLayout: Dc
  });
  mn(t, () => n.current, []), Ue(() => {
    Object.assign(
      n.current,
      go({ groupId: e })
    );
  });
}
function vo({
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
  const g = k({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), f = ut((R) => {
    Fe(g.current.onLayoutChange, R) || (g.current.onLayoutChange = R, i == null || i(R));
  }), v = ut(
    (R, I) => {
      Fe(g.current.onLayoutChanged, R) || (g.current.onLayoutChanged = R, l == null || l(R, { isUserInteraction: I }));
    }
  ), y = En(c), S = k(null), [P, p] = Yc(), w = k({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), M = kn(S, a);
  Xc(y, s);
  const A = ut(
    (R, I) => {
      const T = Oe(), E = ur(R), x = Ne(R);
      if (x) {
        let U = !1;
        switch (T.state) {
          case "active": {
            U = T.hitRegions.some(
              (K) => K.group === E
            );
            break;
          }
        }
        return {
          flexGrow: x.layout[I] ?? 1,
          pointerEvents: U ? "none" : void 0
        };
      }
      if (n != null && n[I])
        return {
          flexGrow: n == null ? void 0 : n[I]
        };
    }
  ), F = Mn({
    defaultLayout: n,
    disableCursor: r
  }), z = X(
    () => ({
      get disableCursor() {
        return !!F.disableCursor;
      },
      getPanelStyles: A,
      id: y,
      orientation: u,
      registerPanel: (R) => {
        const I = w.current;
        return I.panels = an(u, [
          ...I.panels,
          R
        ]), p(), () => {
          I.panels = I.panels.filter(
            (T) => T !== R
          ), p();
        };
      },
      registerSeparator: (R) => {
        const I = w.current;
        return I.separators = an(u, [
          ...I.separators,
          R
        ]), p(), () => {
          I.separators = I.separators.filter(
            (T) => T !== R
          ), p();
        };
      },
      updatePanelProps: (R, { disabled: I }) => {
        const T = w.current.panels.find(
          (U) => U.id === R
        );
        T && (T.panelConstraints.disabled = I);
        const E = ur(y), x = Ne(y);
        E && x && ke(E, {
          ...x,
          derivedPanelConstraints: on(E)
        });
      },
      updateSeparatorProps: (R, {
        disabled: I,
        disableDoubleClick: T
      }) => {
        const E = w.current.separators.find(
          (x) => x.id === R
        );
        E && (E.disabled = I, E.disableDoubleClick = T);
      }
    }),
    [A, y, p, u, F]
  ), D = k(null);
  return Ue(() => {
    const R = S.current;
    if (R === null)
      return;
    const I = w.current;
    let T;
    if (F.defaultLayout !== void 0 && Object.keys(F.defaultLayout).length === I.panels.length) {
      T = {};
      for (const B of I.panels) {
        const C = F.defaultLayout[B.id];
        C !== void 0 && (T[B.id] = C);
      }
    }
    const E = {
      disabled: !!o,
      element: R,
      id: y,
      mutableState: {
        defaultLayout: T,
        disableCursor: !!F.disableCursor,
        expandedPanelSizes: w.current.lastExpandedPanelSizes,
        layouts: w.current.layouts
      },
      orientation: u,
      panels: I.panels,
      resizeTargetMinimumSize: I.resizeTargetMinimumSize,
      separators: I.separators
    };
    D.current = E;
    const x = Zc(E), { defaultLayoutDeferred: U, derivedPanelConstraints: K, layout: Y } = Ne(E.id, !0);
    !U && K.length > 0 && (f(Y), v(Y, !1));
    const N = In(y, (B) => {
      const { defaultLayoutDeferred: C, derivedPanelConstraints: V, layout: Q } = B.next;
      if (C || V.length === 0)
        return;
      const ce = E.panels.map(({ id: H }) => H).join(",");
      E.mutableState.layouts[ce] = Q, V.forEach((H) => {
        if (H.collapsible) {
          const { layout: ee } = B.prev ?? {};
          if (ee) {
            const ye = de(
              H.collapsedSize,
              Q[H.panelId]
            ), pe = de(
              H.collapsedSize,
              ee[H.panelId]
            );
            ye && !pe && (E.mutableState.expandedPanelSizes[H.panelId] = ee[H.panelId]);
          }
        }
      });
      const le = Oe().state !== "active";
      f(Q), le && v(Q, B.isUserInteraction);
    });
    return () => {
      D.current = null, x(), N();
    };
  }, [
    o,
    y,
    v,
    f,
    u,
    P,
    F
  ]), j(() => {
    const R = D.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ b(yo.Provider, { value: z, children: /* @__PURE__ */ b(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": y,
      id: y,
      ref: M,
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
vo.displayName = "Group";
function An() {
  const e = fn(yo);
  return te(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Qc(e, t) {
  const { id: n } = An(), r = k({
    collapse: Jt,
    expand: Jt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Jt
  });
  mn(t, () => r.current, []), Ue(() => {
    Object.assign(
      r.current,
      po({ groupId: n, panelId: e })
    );
  });
}
function sn({
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
  const f = !!i, v = En(i), y = Mn({
    disabled: a
  }), S = k(null), P = kn(S, s), {
    getPanelStyles: p,
    id: w,
    orientation: M,
    registerPanel: A,
    updatePanelProps: F
  } = An(), z = d !== null, D = ut(
    (E, x, U) => {
      d == null || d(E, i, U);
    }
  );
  Ue(() => {
    const E = S.current;
    if (E !== null) {
      const x = {
        element: E,
        id: v,
        idIsStable: f,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: z ? D : void 0,
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
      return A(x);
    }
  }, [
    c,
    n,
    r,
    o,
    z,
    v,
    f,
    l,
    u,
    D,
    A,
    y
  ]), j(() => {
    F(v, { disabled: a });
  }, [a, v, F]), Qc(v, m);
  const R = () => {
    const E = p(w, v);
    if (E)
      return JSON.stringify(E);
  }, I = Ct(
    (E) => In(w, E),
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
        ...el,
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
            touchAction: M === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
sn.displayName = "Panel";
const el = {
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
function tl({
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
    a = $e({
      layout: mt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = $e({
      layout: mt({
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
function So({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...c
}) {
  const i = En(a), l = Mn({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = _({}), [m, h] = _("inactive"), [g, f] = _(!1), v = k(null), y = kn(v, o), {
    disableCursor: S,
    id: P,
    orientation: p,
    registerSeparator: w,
    updateSeparatorProps: M
  } = An(), A = p === "horizontal" ? "vertical" : "horizontal";
  Ue(() => {
    const D = v.current;
    if (D !== null) {
      const R = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: D,
        id: i
      }, I = w(R), T = Lc(
        (x) => {
          h(
            x.next.state !== "inactive" && x.next.hitRegions.some(
              (U) => U.separator === R
            ) ? x.next.state : "inactive"
          );
        }
      ), E = In(
        P,
        (x) => {
          const { derivedPanelConstraints: U, layout: K, separatorToPanels: Y } = x.next, N = Y.get(R);
          if (N) {
            const B = N[0], C = N.indexOf(B);
            d(
              tl({
                layout: K,
                panelConstraints: U,
                panelId: B.id,
                panelIndex: C
              })
            );
          }
        }
      );
      return () => {
        T(), E(), I();
      };
    }
  }, [P, i, w, l]), j(() => {
    M(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, M]);
  let F;
  n && !S && (F = "not-allowed");
  let z;
  if (n)
    z = "disabled";
  else
    switch (m) {
      case "active": {
        z = "active";
        break;
      }
      default:
        g ? z = "focus" : z = m;
    }
  return /* @__PURE__ */ b(
    "div",
    {
      ...c,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": A,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": z,
      "data-testid": i,
      id: i,
      onBlur: () => f(!1),
      onFocus: () => f(!0),
      ref: y,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: F,
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
So.displayName = "Separator";
const Nn = 30, _n = 65, ht = 50, nl = 100 - _n, rl = 100 - Nn;
function ol(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(_n, Math.max(Nn, t)) : ht;
}
function Ln(e) {
  return 100 - e;
}
function Je(e) {
  return `${e}%`;
}
const Cn = "reader-document", pt = "reader-assistant", wo = "retainpdf.reader.ai-split-layout.v1", al = {
  [Cn]: Ln(ht),
  [pt]: ht
};
function Dn(e) {
  const t = ol(e == null ? void 0 : e[pt]);
  return {
    [Cn]: Ln(t),
    [pt]: t
  };
}
function sl() {
  try {
    const e = JSON.parse(localStorage.getItem(wo) || "null");
    return Dn(e);
  } catch {
    return al;
  }
}
function il(e) {
  try {
    localStorage.setItem(wo, JSON.stringify(Dn(e)));
  } catch {
  }
}
function qt(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Dn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[pt]}vw`
  );
}
function cl() {
  const e = k(null), [t] = _(sl);
  _e(() => {
    const o = e.current;
    return qt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = $((o) => {
    qt(e.current, o);
  }, []), r = $((o, a) => {
    qt(e.current, o), a.isUserInteraction && il(o);
  }, []);
  return /* @__PURE__ */ O(
    vo,
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
          sn,
          {
            id: Cn,
            defaultSize: Je(Ln(ht)),
            minSize: Je(nl),
            maxSize: Je(rl)
          }
        ),
        /* @__PURE__ */ b(
          So,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ b("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ b(
          sn,
          {
            id: pt,
            defaultSize: Je(ht),
            minSize: Je(Nn),
            maxSize: Je(_n)
          }
        )
      ]
    }
  );
}
function ll({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = _(!1);
  if (j(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ O("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ O("span", { className: "reader-error-notice-text", children: [
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
function ul({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ b(ll, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ O(Lt, { children: [
    e ? /* @__PURE__ */ b("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ O("div", { className: "reader-boot-loading-card", children: [
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
function dl(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function fl() {
  const [e, t] = _(!1), n = kr(), r = k(null);
  return j(() => {
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
  }, [e]), j(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || dl(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ O("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ b(Jo, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ O(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ O("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ b("div", { className: "reader-react-shortcuts-body", children: li.map((o) => /* @__PURE__ */ O("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ b("h3", { children: o.title }),
            /* @__PURE__ */ b("ul", { children: o.items.map((a) => /* @__PURE__ */ O("li", { children: [
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
const ml = ["source", "sideBySide", "translated"], hl = { source: "", translated: "", sideBySide: "" };
function pl(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = It(e.sourceUrl), n = It(e.translatedUrl);
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
function gl(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = X(
    () => e ? pl(e) : hl,
    [e]
  ), o = X(
    () => ml.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = $(async (s) => {
    if (!e) return;
    const c = It(r[s]);
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
const bl = {
  source: Ar,
  sideBySide: Nr,
  translated: _r
}, yl = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function vl(e) {
  const t = je(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = gl(n), c = k(null);
  return j(() => {
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
  }, []), /* @__PURE__ */ O("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ O("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ b(qo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ b(Go, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ b("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = Mo[i], u = It(r[i]), d = a.has(i), m = !!u && !d, h = m ? "" : Ao(i, r), g = bl[i];
      return /* @__PURE__ */ O(
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
            /* @__PURE__ */ b(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ O("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ O("span", { className: "reader-download-action-label", children: [
                yl[i],
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
const Sl = "retainpdf:reader:bookmarks:v1:", wl = 200;
function zn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Po(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Sl}${t}` : "";
}
function Pl(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function _t(e, t = zn()) {
  const n = Po(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Pl(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function cn(e, t, n) {
  const r = Po(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, wl);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Rl(e, t, n = "", { storage: r = zn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = _t(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? cn(e, a.filter((c) => c.page !== s), r) : cn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Il(e, t, n = zn()) {
  return cn(e, _t(e, n).filter((r) => r.page !== t), n);
}
function Tl(e, t) {
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
function El({ filled: e }) {
  return /* @__PURE__ */ b("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ b("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function kl({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = _(() => _t(e)), [c, i] = _(!1), l = k(null);
  if (j(() => {
    s(_t(e)), i(!1);
  }, [e]), j(() => {
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
  return /* @__PURE__ */ O("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Rl(e, u, Tl(r, u))),
        children: /* @__PURE__ */ b(El, { filled: d })
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
        onClick: () => i((m) => !m),
        children: a.length
      }
    ),
    c && a.length ? /* @__PURE__ */ b("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ b("ol", { className: "reader-bookmark-list", children: a.map((m) => /* @__PURE__ */ O("li", { className: m.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ O(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(m.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ O("span", { className: "reader-bookmark-page", children: [
              "第 ",
              m.page,
              " 页"
            ] }),
            m.label ? /* @__PURE__ */ b("span", { className: "reader-bookmark-label", children: m.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ b(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${m.page} 页的书签`,
          onClick: () => s(Il(e, m.page)),
          children: "×"
        }
      )
    ] }, m.page)) }) }) : null
  ] });
}
function Ml(e) {
  const t = je(), n = to(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? gt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = us(a), d = a > zr + 1e-3, m = a < Mt - 1e-3, h = qe(r, ze()), g = h >= Mt ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [f, v] = _(!1), [y, S] = _(`${c}`);
  j(() => {
    f || S(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, f]);
  const P = () => {
    if (v(!1), !l || i <= 0)
      return;
    const p = Number(`${y}`.trim());
    l(At(p, i));
  };
  return /* @__PURE__ */ O("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ b("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ b("div", { className: "reader-react-hud-group", "aria-label": "页码", children: f ? /* @__PURE__ */ O(
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
              onChange: (p) => S(p.target.value.replace(/[^\d]/g, "")),
              onBlur: P,
              onKeyDown: (p) => {
                p.key === "Escape" && (p.preventDefault(), v(!1), S(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ O("span", { className: "reader-react-hud-page-suffix", children: [
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
          !l || i <= 0 || (S(`${c}`), v(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ b(
      kl,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ O("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ b(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !d,
          onClick: () => s(ft(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ O(
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
          disabled: !m,
          onClick: () => s(ft(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ b("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ b(fl, {}) })
  ] });
}
function Rr(e) {
  var t, n;
  return $r(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Al(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: Rr(we(e))
  }));
  j(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Rr(we(e))
    });
  }, [e]), j(() => {
    t.scope === e && xt(t.scope, {
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
const ln = "download-toast";
function Nl({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ O("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ O("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ b("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ b("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ b("div", { className: "download-toast-track", children: /* @__PURE__ */ b("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ b("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function _l(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Kt.dismiss(ln);
    return;
  }
  Kt.custom(
    () => /* @__PURE__ */ b(Nl, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: ln, duration: 1 / 0 }
  );
}
function Ll() {
  const e = $((t) => {
    t && (t.setState = _l, t.hide = () => Kt.dismiss(ln));
  }, []);
  return /* @__PURE__ */ O(Lt, { children: [
    /* @__PURE__ */ b(Bo, { position: "bottom-right" }),
    /* @__PURE__ */ b("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Cl(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : xr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Dl(e, t) {
  return t === null || e !== t;
}
function zl(e) {
  const t = k(!1);
  return e && (t.current = !0), t.current;
}
function xl(e, t) {
  const n = e === t;
  return { open: n, mounted: zl(n) };
}
const Ir = { itemId: null, origin: null };
function Ol() {
  let e = Ir;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Ir : { itemId: n, origin: r };
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
const De = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Fl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, $l = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, jl = {
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
}, Tr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Bl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Tr(o ?? a ?? "", Fl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Tr(o ?? a ?? "", $l)).replace(/\\([a-zA-Z]+)/gu, (r, o) => jl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Ul(e) {
  return De(e.translatedBlockText) || De(e.translated.text) || De(e.source.text);
}
const Hl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Wl(e) {
  const t = [];
  for (const n of e) {
    if (!Hl(n)) continue;
    const r = Bl(Ul(n)), o = Number(n.source.page);
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
const Jl = 24, ql = 60;
function Er(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Jl), o = Math.min(e.length, n + t.length + ql), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Gl(e, t, n = 200) {
  const r = De(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const c = De(a.translatedBlockText) || De(a.translated.text), i = c ? Er(c, r) : null, l = i ?? Er(De(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
const Kl = [];
function Zl({ open: e, onToggle: t }) {
  return /* @__PURE__ */ O("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ O(Ce, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ b(Ko, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ O(Ce, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ b(Zo, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { children: "搜索" })
    ] })
  ] });
}
function Yl({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r
}) {
  var h, g;
  const o = ((h = je()) == null ? void 0 : h.regions) ?? Kl, a = ((g = to()) == null ? void 0 : g.currentPage) ?? 1, s = X(() => Wl(o), [o]), c = Vl(s, a), [i, l] = _(""), u = X(() => Gl(o, i), [o, i]), d = k(null), m = k(null);
  return j(() => {
    var f, v, y;
    e === "search" ? (f = d.current) == null || f.focus() : (y = (v = m.current) == null ? void 0 : v.querySelector('[aria-current="location"]')) == null || y.scrollIntoView({ block: "center" });
  }, [e]), /* @__PURE__ */ O("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ O("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ O("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ b(Ce, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ b(Ce, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ b(Ce, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ b(gn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? s.length ? /* @__PURE__ */ b("ol", { ref: m, className: "reader-finder-list", children: s.map((f, v) => /* @__PURE__ */ b("li", { children: /* @__PURE__ */ O(
      Ce,
      {
        className: "reader-finder-entry",
        "data-level": f.level,
        "aria-current": v === c ? "location" : void 0,
        onClick: () => r(f.itemId),
        children: [
          /* @__PURE__ */ b("span", { className: "reader-finder-entry-text", children: f.text }),
          /* @__PURE__ */ b("span", { className: "reader-finder-entry-page", children: f.page })
        ]
      }
    ) }, f.itemId)) }) : /* @__PURE__ */ b("p", { className: "reader-finder-empty", children: o.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ O(Lt, { children: [
      /* @__PURE__ */ O("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ b(
          Yo,
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
        i.trim() ? /* @__PURE__ */ b("p", { className: "reader-finder-count", children: u.length >= 200 ? "200 处以上，只列前 200 处" : `${u.length} 处` }) : null
      ] }),
      /* @__PURE__ */ b("ol", { className: "reader-finder-list", children: u.map((f) => /* @__PURE__ */ b("li", { children: /* @__PURE__ */ O(Ce, { className: "reader-finder-entry is-hit", onClick: () => r(f.itemId), children: [
        /* @__PURE__ */ O("span", { className: "reader-finder-entry-text", children: [
          f.snippet.slice(0, f.at),
          /* @__PURE__ */ b("mark", { children: f.snippet.slice(f.at, f.at + f.length) }),
          f.snippet.slice(f.at + f.length)
        ] }),
        /* @__PURE__ */ b("span", { className: "reader-finder-entry-page", children: f.page })
      ] }) }, f.itemId)) })
    ] })
  ] });
}
const Xl = To(() => import("./ReaderMarkdownPanel-DSs4j201.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Ql(e) {
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
function eu(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function tu() {
  const e = ii(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Al(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = _(null), [u, d] = _(!1), m = k(null), h = k(null), g = s !== null, f = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, v = Ql({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: f,
    liveTranslationVisible: u,
    assistantOpen: g,
    assistantPdfPane: i
  }), y = Xs({
    hasOverlayContent: f,
    connection: e.liveTranslation.connection,
    showSource: v.showSource,
    liveTranslationVisible: u,
    assistantOpen: g
  }), S = v.sourceViewOnly, P = v.visibleMode;
  j(() => {
    d(!1);
  }, [e.viewStateKey]), j(() => {
    e.session.jobTerminal && d(!1);
  }, [e.session.jobTerminal]), j(() => {
    l(null);
  }, [a.scope]), j(() => {
    if (!(t.loading || t.failed)) {
      if (m.current !== e.viewStateKey) {
        m.current = e.viewStateKey;
        const N = we(e.viewStateKey), B = Cl({
          savedMode: N == null ? void 0 : N.mode,
          sourceViewOnly: S,
          viewportWidth: ze()
        });
        h.current = B.auto ? B.mode : null, B.mode && B.mode !== e.mode && e.setModeKeepingPage(B.mode);
        return;
      }
      Dl(e.mode, h.current) && (h.current = null, xt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, S]);
  const p = s || (e.mode === "compare" ? "compare" : "reading"), w = xl(s, "markdown");
  hi({
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
  const M = $(() => {
    c(null), l(null);
  }, []), A = $((N) => {
    l(null);
    const B = eu(N, e.liveTranslationAvailable);
    B !== null && d(B), e.setModeKeepingPage(N);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), F = X(() => y.sourcePaneToggle ? /* @__PURE__ */ b(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${u ? " is-active" : ""}`,
      onClick: () => d((N) => !N),
      "aria-pressed": u,
      title: u ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [y.sourcePaneToggle, u]), z = $((N) => {
    c(N), l(null);
  }, []), [D] = _(Ol), [R, I] = _(null), T = $((N) => I((B) => B === N ? null : N), []), E = $((N) => {
    e.jumpToAnchor({ block_id: N }), ze() < 900 && I(null);
  }, [e.jumpToAnchor]), x = $((N) => e.jumpToAnchor({ block_id: N }), [e.jumpToAnchor]), U = X(() => ({
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
    jumpToBlock: x,
    revisedBlocks: e.revisedBlocks,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: S,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: z, close: M }
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
    x,
    e.revisedBlocks,
    e.sourceOnly,
    S,
    e.download,
    e.goToPage,
    z,
    M
  ]), K = X(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Y = [
    ts,
    `is-workspace-${p}`,
    g ? "is-assistant-open" : "",
    R ? "is-finder-open" : "",
    v.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ b(Ki, { value: U, hud: K, children: /* @__PURE__ */ O("div", { className: Y, "data-reader-engine": "react-pdf", "data-reader-workspace": p, children: [
    /* @__PURE__ */ b(ul, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ b(Zl, { open: R, onToggle: T }),
    R ? /* @__PURE__ */ b(
      Yl,
      {
        tab: R,
        onTab: I,
        onClose: () => I(null),
        onJump: E
      }
    ) : null,
    /* @__PURE__ */ O("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ b(Ti, {}),
      /* @__PURE__ */ b(vl, {}),
      /* @__PURE__ */ b(wi, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ b(
      pc,
      {
        mode: P,
        documentReady: !!o.jobId,
        sourceViewOnly: S,
        onModeChange: A,
        liveTranslation: y.topBarPill ? {
          visible: u,
          state: e.liveTranslation,
          onToggle: () => d((N) => !N)
        } : null
      }
    ),
    /* @__PURE__ */ b(Pc, { active: s }),
    g ? /* @__PURE__ */ b(cl, {}) : null,
    /* @__PURE__ */ b(dc, { paneComposition: v, markdownSplit: w.open, assistantSplit: g, liveTranslation: e.liveTranslation, sourcePaneAction: F }),
    e.showHud ? /* @__PURE__ */ b(
      Ml,
      {
        mode: P,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ b(Io, { fallback: null, children: w.mounted ? /* @__PURE__ */ b(Xl, { open: w.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: M }) : null }),
    /* @__PURE__ */ b(Ll, {})
  ] }) });
}
function Su() {
  return /* @__PURE__ */ b(tu, {});
}
export {
  Su as R,
  tu as a,
  yu as d,
  bu as f,
  vu as r,
  je as u
};
//# sourceMappingURL=ReaderApp-ChPA5zGl.js.map
