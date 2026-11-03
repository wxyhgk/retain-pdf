var zn = (e) => {
  throw TypeError(e);
};
var On = (e, t, n) => t.has(e) || zn("Cannot " + n);
var ot = (e, t, n) => (On(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Fn = (e, t, n) => t.has(e) ? zn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), $n = (e, t, n, r) => (On(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsx as g, jsxs as x, Fragment as _t } from "react/jsx-runtime";
import { useMemo as Q, useState as N, useEffect as $, useCallback as F, useRef as M, useLayoutEffect as Fe, useSyncExternalStore as Lt, memo as cn, createContext as un, useContext as dn, forwardRef as To, useImperativeHandle as fn, useId as kr, Suspense as Eo, lazy as ko } from "react";
import { getReaderAdapters as se, requireAdapter as Xe, renderReaderBoardSlot as Mo } from "./adapters.js";
import { resolveReaderDownloadName as Ao, resolveReaderDownloadUrls as No, READER_PROGRESS_COPY as Ie, trimString as Rt, READER_DOWNLOAD_ACTIONS as _o, disabledReason as Lo } from "./runtime/state.js";
import "@retainpdf/api/conversations";
import { r as Co, b as Do } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as qt, isFinishedJobStatus as mn } from "@retainpdf/domain/job";
import { c as xo, n as zo, f as Ft, j as jn, a as Oo, b as Fo, h as Mr, p as hn, d as $o, k as Bn, i as jo } from "./reader-regions-CP3ZMHPc.js";
import { fetchDocumentReading as Bo } from "@retainpdf/api/documents";
import { isReaderTransportError as Uo, createReaderTransportError as Ho } from "./contracts.js";
import { toast as Gt, Toaster as Wo } from "sonner";
import { NotebookPen as Vo, X as pn, Radio as Jo, FileText as Ar, Columns2 as Nr, Languages as _r, FileCode2 as qo, Sparkles as Go, Keyboard as Ko, Download as Zo, ChevronDown as Yo, ListTree as Xo, Search as Qo } from "lucide-react";
import { Button as Le, Input as ea } from "@retainpdf/ui";
import { pdfjs as ta, Page as na, Document as ra } from "react-pdf";
import { e as oa, m as aa, a as sa } from "./markdown-math-XkF5urpn.js";
const ia = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, la = "", ca = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ua = (e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, wu = (...e) => {
  var n;
  return (((n = se()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Te = () => Xe("defaultReaderDataPort"), Un = () => Xe("defaultReaderPageConfigPort"), Pu = {
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
}, da = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.liveTranslation) ?? null;
}, fa = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.notesQuote) ?? null;
}, ma = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.notesPanel) ?? null;
}, ha = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.readingPosition) ?? null;
}, pa = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.hostAi) ?? null;
}, ga = () => {
  var e;
  return ((e = se()) == null ? void 0 : e.hostNavigation) ?? null;
}, ut = () => {
  var t;
  const e = se();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ct = () => {
  const e = se();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Xe("fetchDocumentByJobId")(...n),
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
}, ba = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ya = () => {
  var e, t;
  return ((t = (e = se()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, va = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Sa = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Ao(...e);
}, wa = (...e) => {
  var t, n;
  return ((n = (t = se()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? No(...e);
}, Pa = (...e) => Xe("downloadProtectedResource")(...e), Ra = (...e) => Xe("failDownloadToast")(...e), Ru = (e, t) => Xe("resolveMarkdownAssetUrl")(e, t), Hn = "/api/v1";
function Ia() {
  const e = () => {
    var r;
    return Co(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
  return $(() => {
    var l, i, c, u;
    const r = () => n(e()), o = (i = (l = globalThis.history) == null ? void 0 : l.pushState) == null ? void 0 : i.bind(globalThis.history), a = (u = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const d = (m) => function(...h) {
          const b = m.apply(this, h);
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
function Ta() {
  const e = Ia(), t = Q(() => va(Lr), [e]), n = Q(() => ya(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Ea(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: l
  } = e, [i, c] = N({
    documentId: "",
    jobId: ""
  }), [u, d] = N({
    documentId: "",
    jobId: ""
  }), m = i.documentId === t ? i.jobId : "", h = u.documentId === t ? u.jobId : "", b = n || m, [f, v] = N({
    jobId: "",
    documentId: ""
  }), y = f.jobId === b ? f.documentId : "", w = t || y, P = !!t && !b, [p, S] = N(null), k = (p == null ? void 0 : p.sessionIdentity) === r && p.documentId === w ? p : null, A = P || !!k, z = F((C) => {
    const I = `${C.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      v({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${C.revision || ""}`.trim() || `${Date.now()}`;
    S({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), l();
  }, []);
  $(() => {
    S((C) => C && C.sessionIdentity !== r ? null : C);
  }, [r]);
  const D = F((C) => {
    switch (C.type) {
      case "resolved-document-job":
        c({ documentId: C.documentId, jobId: C.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        d({ documentId: C.documentId, jobId: C.jobId });
        break;
      case "resolved-job-document":
        v((I) => I.jobId === C.jobId && I.documentId === C.documentId ? I : { jobId: C.jobId, documentId: C.documentId });
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
    setResolvedDocumentJob: c,
    missingDocumentJob: u,
    setMissingDocumentJob: d,
    documentJobId: m,
    rejectedDocumentJobId: h,
    sessionJobId: b,
    resolvedJobDocument: f,
    setResolvedJobDocument: v,
    jobDocumentId: y,
    documentId: w,
    sourceOnly: P,
    committedDocumentSource: p,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: k,
    sourceViewOnly: A,
    refreshCommittedDocument: z,
    applyIdentityEvent: D
  };
}
function Wn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function ka(e) {
  var r, o, a, s;
  if (!e || typeof e != "object") return "";
  const t = e, n = [
    t.document_id,
    t.documentId,
    (r = t.document) == null ? void 0 : r.document_id,
    (o = t.book_summary) == null ? void 0 : o.document_id,
    (s = (a = t.request_payload) == null ? void 0 : a.source) == null ? void 0 : s.document_id
  ];
  for (const l of n) {
    const i = `${l || ""}`.trim();
    if (i) return i;
  }
  return "";
}
function Vn(e, t) {
  return ua(qt(e, t));
}
function Ma(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Aa(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ma(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Kt({
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
      Lr.messageTargetOrigin()
    );
  } catch {
  }
}
function It(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Kt({ percent: t, text: n, stage: r });
}
function Na(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [l, i] = N(null), [c, u] = N(null), [d, m] = N(""), [h, b] = N(0), f = d === n ? l : null, v = d === n ? c : null, y = Wn(f), w = mn(y), P = F(() => {
    b((D) => D + 1);
  }, []), p = F((D) => {
    i(D.jobPayload), u(D.manifestPayload), m(D.sessionIdentity);
  }, []), S = F((D) => {
    i(null), u(null), m(D);
  }, []), k = M(""), A = M(""), z = F(async () => {
    const D = o.current;
    if (!D || k.current === D) return;
    const C = Ct().loadJobPayload;
    if (typeof C != "function") return;
    const I = a.current.value;
    k.current = D;
    try {
      const T = await C(D);
      if (s.current || a.current.value !== I || o.current !== D || !T || typeof T != "object")
        return;
      const R = Wn(T);
      i(T), m(r.current), R === "succeeded" && A.current !== D && (A.current = D, b((E) => E + 1));
    } catch {
    } finally {
      k.current === D && (k.current = "");
    }
  }, []);
  return $(() => {
    A.current = "";
  }, [n]), $(() => {
    if (!t || w || !f) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && z();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [w, z, f, t]), {
    jobPayload: l,
    setJobPayload: i,
    manifestPayload: c,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: m,
    scopedJobPayload: f,
    scopedManifestPayload: v,
    jobStatus: y,
    jobTerminal: w,
    jobRefreshRevision: h,
    refreshJobArtifacts: P,
    refreshJobStatus: z,
    publishPayload: p,
    clearPayload: S
  };
}
function Zt(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function _a(e, t) {
  e(t), Zt(t);
}
function La(e) {
  const [t, n] = N(e ? "source" : "compare"), r = F((a) => {
    e && a !== "source" || (n(a), Zt(a));
  }, [e]), o = F((a) => {
    _a(n, a);
  }, []);
  return $(() => (e && document.documentElement.classList.add("reader-source-only"), Zt(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Jn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ca(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Jn(n.active_job_id),
    activeVersionId: Jn(n.active_version_id)
  };
}
function Da(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function xa(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function za(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Oa = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Fa(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Oa.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
function $a(e) {
  return e ? { data: e.data.slice() } : null;
}
const ja = 2, be = /* @__PURE__ */ new Map();
function Yt(e, t) {
  be.delete(e), be.set(e, t);
}
function Ba(e) {
  if (be.size < ja) return;
  const t = be.keys().next().value;
  t && be.delete(t);
}
async function Ua(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Cr(e, t = ut().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (be.has(r)) {
    const l = be.get(r);
    return Yt(r, l), l;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const l = new Error(`读取 PDF 失败 (${o.status})`);
    l.status = o.status;
    const i = await Ua(o);
    throw i && (l.reason = i), l;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return be.has(r) ? Yt(r, s) : (Ba(), be.set(r, s)), s;
}
const Ha = { file: null, loading: !1, error: "" }, Wa = { file: null, loading: !0, error: "" };
function Va(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if ($(() => {
    if (t || !n) return;
    const s = be.get(n);
    if (s) {
      Yt(n, s);
      return;
    }
    const l = new AbortController();
    return Cr(n, void 0, { signal: l.signal }).then((i) => {
      l.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      l.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => l.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ha;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = be.get(n);
  return a ? { file: a, loading: !1, error: "" } : Wa;
}
function Ja(e) {
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
async function Xt(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  It(s, r, n, "download");
  const l = await Cr(t, ut().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (It(s, o, n, "download"), l);
}
async function qa(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  It(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, l = null;
  return t && a.push(
    Xt({
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
    Xt({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: o
    }).then((u) => {
      l = u;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !l ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: l };
}
function Ga(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ka({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Bo,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Ga(o.href, t, a)), !0);
}
const yt = {
  regions: null,
  metadata: null
};
function Za(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: o,
    rejectedDocumentJobId: a,
    sourceOnly: s,
    locationKey: l,
    sessionIdentity: i,
    committedSource: c,
    applyIdentityEvent: u,
    publishPayload: d,
    clearPayload: m,
    switchSessionMode: h,
    jobRefreshRevision: b,
    sessionEpochRef: f,
    closingRef: v,
    activeLoadAbortRef: y
  } = e, [w, P] = N(""), [p, S] = N(""), [k, A] = N(null), [z, D] = N(null), [C, I] = N(!1), [T, R] = N(""), [E, O] = N([]), [U, J] = N(!1), [G, j] = N(() => ({
    source: null,
    translated: null
  })), [Y, _] = N(
    yt
  ), [V, ee] = N({
    loading: !0,
    percent: 4,
    text: Ie.boot,
    stage: "progress",
    failed: !1
  });
  return $(() => {
    const ae = new AbortController(), H = f.current.value, B = Ja({
      sessionEpochRef: f,
      closingRef: v,
      abort: ae,
      sessionEpoch: H
    });
    y.current = ae;
    const te = Ct();
    if (v.current)
      return ae.abort(), () => {
        y.current === ae && (y.current = null);
      };
    let ye = !1;
    function pe(oe, de) {
      B.markFailed(), J(!0), ee({
        loading: !1,
        percent: 100,
        text: oe,
        stage: "failed",
        failed: !0
      }), Kt({ percent: 100, text: de, stage: "failed" });
    }
    function Qe() {
      I(!0), ye || J(!0), ee({
        loading: !1,
        percent: 100,
        text: Ie.ready,
        stage: "ready",
        failed: !1
      }), Kt({ percent: 100, text: Ie.ready, stage: "ready" });
    }
    function zt() {
      return c != null && c.documentId ? Vn(
        c.documentId,
        c.revision
      ) : ia() ? la : te.resolveResourceUrl(qt(r));
    }
    async function Ue() {
      var le;
      let oe = { activeJobId: "", activeVersionId: "" };
      try {
        const ce = await ((le = te.fetchDocument) == null ? void 0 : le.call(te, r));
        ce && (oe = Ca(ce));
      } catch {
      }
      const de = Da({
        link: oe,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (de.kind === "follow-active-job") {
        if (B.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: de.jobId
        }), de.activeVersionId ? (c || u({
          type: "committed-source",
          documentId: r,
          revision: de.activeVersionId,
          sessionIdentity: i
        }), h("source")) : h("compare");
        return;
      }
      if (de.kind === "open-committed-source") {
        if (B.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: de.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const he = zt();
      if (B.isInactive()) return;
      P(he), S(""), R(""), m(i);
      const ie = await Xt({
        url: he,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: B,
        setBoot: ee
      });
      if (!B.isInactive()) {
        if (!ie) {
          pe("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        A(ie), Qe();
      }
    }
    async function et() {
      var K;
      const oe = !c, de = !!(oe && te.loadSessionSnapshot && te.loadReaderOptionalArtifacts), he = de ? te.loadReaderOptionalArtifacts(t) : null, ie = await ((K = te.loadSessionSnapshot) == null ? void 0 : K.call(te, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: oe && !de
      })), le = ie ? {
        jobPayload: ie.sourcePayload,
        manifestPayload: ie.manifestPayload,
        readerMetadata: ie.readerMetadata,
        regionsPayload: ie.regions,
        readerErrors: ie.readerErrors
      } : await te.loadReaderPayload(t, {
        includeOptionalArtifacts: oe
      });
      if (B.isInactive()) return;
      let ce = null;
      if (n && !r)
        if (ie && ie.linkedDocument !== void 0)
          ce = ie.linkedDocument;
        else {
          try {
            ce = await te.fetchDocumentByJobId(Hn, t);
          } catch {
          }
          if (B.isInactive()) return;
        }
      const He = ka(le.jobPayload) || `${(ce == null ? void 0 : ce.document_id) || ""}`.trim();
      He && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: He
      });
      const Re = xa({
        payloadDocumentId: He,
        linkedActiveJobId: `${(ce == null ? void 0 : ce.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ce == null ? void 0 : ce.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (Re.kind === "restore-committed-source") {
        if (B.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Re.documentId,
          revision: Re.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const Me = te.resolveReaderSourcePdf(le.manifestPayload), tt = te.resolveReaderTranslatedPdfUrl(le.jobPayload, le.manifestPayload), Ot = typeof Me == "string" ? Me : te.resolveReaderArtifactUrl(Me), bt = r || He, nt = c != null && c.documentId ? Vn(
        c.documentId,
        c.revision
      ) : Ot || (bt ? te.resolveResourceUrl(qt(bt)) : ""), rt = c ? "" : tt || "";
      P(nt || ""), S(rt), R(Aa(le.jobPayload, t)), d({
        jobPayload: le.jobPayload || null,
        manifestPayload: le.manifestPayload || null,
        sessionIdentity: i
      });
      const L = () => qa({
        sourceFinal: nt || "",
        translatedFinal: rt,
        fence: B,
        setBoot: ee
      }), q = !!(nt || rt), W = he && q ? L() : null;
      W == null || W.catch(() => {
      });
      const Z = (X) => {
        B.isInactive() || (O(c ? [] : xo(X.regionsPayload)), j(c ? { source: null, translated: null } : zo(X.readerMetadata)), _(c ? yt : X.readerErrors ?? yt), J(!0));
      };
      if (he ? (ye = !0, he.then(Z)) : Z(le), !q) {
        pe(Ie.failed, Ie.failed);
        return;
      }
      const re = await (W ?? L());
      if (re.status !== "inactive") {
        if (re.status === "incomplete") {
          pe("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        A(re.sourceBytes), D(re.translatedBytes), Qe();
      }
    }
    async function Pe() {
      I(!1), A(null), D(null), O([]), J(!1), j({ source: null, translated: null }), _(yt), It(ee, 8, Ie.metadata, "metadata");
      try {
        if (s) {
          await Ue();
          return;
        }
        if (!t) {
          pe(Ie.failed, Ie.failed);
          return;
        }
        await et();
      } catch (oe) {
        if (B.isClosedOrStale() || (oe == null ? void 0 : oe.name) === "AbortError") return;
        B.markFailed();
        const de = Number(oe == null ? void 0 : oe.status), he = `${(oe == null ? void 0 : oe.reason) || ""}`, ie = Fa({ status: de, reason: he, sessionJobId: t });
        if (ie && (await Ka({
          apiPrefix: Hn,
          documentId: ie,
          expiredJobId: t
        }) || B.isClosedOrStale()))
          return;
        if (za({
          status: de,
          reason: he,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const le = oe instanceof Error ? oe.message : Ie.failed;
        pe(le, le);
      }
    }
    return Pe(), () => {
      ae.abort(), y.current === ae && (y.current = null);
    };
  }, [t, r, o, a, s, l, c, b, n, i, u, d, m, h]), {
    sourceUrl: w,
    translatedUrl: p,
    sourceFile: k,
    translatedFile: z,
    assetsReady: C,
    title: T,
    regions: E,
    regionsSettled: U,
    readerMetadata: G,
    readerErrors: Y,
    boot: V
  };
}
function Ya() {
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ta(), s = M({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const l = M(a), i = M(""), c = M(""), u = M(() => {
  }), d = F(() => u.current(), []), m = Ea({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: l,
    documentIdRef: i,
    sessionJobIdRef: c,
    switchToSourceMode: d
  }), {
    sessionJobId: h,
    documentId: b,
    sourceOnly: f,
    sourceViewOnly: v
  } = m, { mode: y, setMode: w, switchSessionMode: P } = La(v);
  u.current = () => {
    P("source");
  }, l.current = a, i.current = b, c.current = h;
  const p = Na({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: l,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: k,
    jobStatus: A,
    jobTerminal: z,
    jobRefreshRevision: D,
    refreshJobArtifacts: C,
    refreshJobStatus: I
  } = p, T = Za({
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
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), R = F(() => {
    var O;
    e.current = !0, (O = t.current) == null || O.abort();
  }, []), E = Q(
    () => ({
      fetchProtected: Ct().fetchProtected,
      jobId: h,
      jobPayload: S,
      manifestPayload: k,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: v
    }),
    [h, S, k, T.sourceUrl, T.translatedUrl, v]
  );
  return {
    jobId: h,
    jobStatus: A,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: z,
    documentId: b,
    sessionIdentity: a,
    sourceOnly: f,
    mode: y,
    setMode: w,
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
    download: E,
    refreshJobArtifacts: C,
    refreshJobStatus: I,
    refreshCommittedDocument: m.refreshCommittedDocument,
    prepareClose: R
  };
}
const Xa = 160, Qa = 8, es = 0;
function ts() {
  const e = M(null), [t, n] = N(null), [r, o] = N(es), a = F((s) => {
    e.current = s, n(s);
  }, []);
  return $(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const l = (c) => {
      !Number.isFinite(c) || c < Xa || o((u) => Math.abs(u - c) < Qa ? u : c);
    }, i = new ResizeObserver((c) => {
      var u, d;
      l(((d = (u = c[0]) == null ? void 0 : u.contentRect) == null ? void 0 : d.width) ?? s.clientWidth);
    });
    return i.observe(s), l(s.clientWidth), () => i.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function ns(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: o, hasTranslated: a } = e, s = r && o, l = r && a && !n, i = t === "source" || t === "compare", c = !n && (t === "translated" || t === "compare");
  return {
    mountSource: s,
    mountTranslated: l,
    showSource: i,
    showTranslated: c,
    compareMode: t === "compare" && i && c && s && l,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
const $t = { source: 0, translated: 0 };
function rs(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: l,
    translatedFile: i
  } = e, c = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = M(c);
  u.current = c;
  const [d, m] = N(() => ({
    identity: c,
    pages: $t
  })), [h, b] = N(() => ({ identity: c, tick: 0 })), f = d.identity === c ? d.pages : $t, v = h.identity === c ? h.tick : 0, y = ns({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!l || !!a,
    hasTranslated: !!i
  }), { primaryPane: w } = y, P = F((I, T) => {
    u.current === c && m((R) => {
      const E = R.identity === c ? R.pages : $t;
      return E[T] === I && R.identity === c ? R : {
        identity: c,
        pages: { ...E, [T]: I }
      };
    });
  }, [c]), p = M(null), S = F(() => {
    p.current && clearTimeout(p.current);
    const I = c;
    p.current = setTimeout(() => {
      p.current = null, u.current === I && b((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  $(() => (p.current && (clearTimeout(p.current), p.current = null), m((I) => I.identity === c && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: c, pages: { source: 0, translated: 0 } }), b((I) => I.identity === c && I.tick === 0 ? I : { identity: c, tick: 0 }), () => {
    p.current && (clearTimeout(p.current), p.current = null);
  }), [c]);
  const k = Q(
    () => Math.max(f.source, f.translated),
    [f]
  ), A = w === "translated" ? f.translated : f.source || f.translated, z = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, C = `${c}-${v}-${z}-${n}-${f.source}-${f.translated}-${D}`;
  return {
    ...y,
    numPagesByPane: f,
    hudNumPages: k,
    primaryNumPages: A,
    metricsTick: v,
    onNumPages: P,
    onMetrics: S,
    rowSyncRevision: C
  };
}
const Ze = "data-reader-page", dt = "data-reader-pane", gn = "data-natural-height", os = "reader-react-root", as = "reader-react-grid", ss = "reader-react-scroll-shell", is = "reader-react-pdf-pane", Dr = "reader-react-pdf-page", Tt = "reader-react-pdf-page-placeholder", bn = "reader-react-pdf-page-slot";
function Et(e, t) {
  const n = e != null ? `[${Ze}="${e}"]` : `[${Ze}]`;
  return t ? `${n}[${dt}="${t}"]` : n;
}
function ls() {
  return `.${bn}[${Ze}]`;
}
function yn(e) {
  return Number(e.getAttribute(Ze));
}
const xr = 0.25, kt = 1, cs = 0.05, gt = 0.5, us = 16, ds = 8, fs = 720;
function De() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function zr(e) {
  return Number.isFinite(e) && e < fs;
}
function Je(e, t = Number.POSITIVE_INFINITY) {
  return zr(t) && (e === "source" || e === "translated") ? kt : gt;
}
function Dt(e) {
  return Number.isFinite(e) ? Math.min(kt, Math.max(xr, e)) : gt;
}
function ft(e, t) {
  const n = Dt(Number(e) + t * cs);
  return Math.round(n * 100) / 100;
}
function ms(e) {
  return Math.round(Dt(e) * 100);
}
function hs(e) {
  const n = (Number(e) || 0) - us - ds;
  return Math.max(160, Math.floor(n));
}
function ps(e, t = gt) {
  const n = Dt(t);
  return hs((Number(e) || 0) * n);
}
function gs(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${dt}]`)
  ).map((s) => ({
    pane: s,
    cx: s.scrollLeft + s.clientWidth / 2,
    hadOverflow: s.scrollWidth > s.clientWidth + 1
  })), a = () => {
    e.scrollLeft = Math.max(0, n * t - e.clientWidth / 2), e.scrollTop = Math.max(0, r * t - e.clientHeight / 2);
    for (const { pane: s, cx: l, hadOverflow: i } of o) {
      const c = Math.max(0, s.scrollWidth - s.clientWidth);
      if (c <= 0) {
        s.scrollLeft = 0;
        continue;
      }
      i ? s.scrollLeft = Math.min(
        c,
        Math.max(0, l * t - s.clientWidth / 2)
      ) : s.scrollLeft = c / 2;
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(a);
  });
}
const bs = 8;
function ys(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < bs ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const vs = 200, Or = [
  "markdown"
], Fr = [
  "terminal"
], Ss = [
  ...Or,
  ...Fr
];
function $r(e) {
  return Ss.includes(e);
}
const ws = "retainpdf:reader:view:v1:", qn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Ps = /* @__PURE__ */ new Set([
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
function Qt(e) {
  return `${e || ""}`.trim();
}
function Rs({
  documentId: e,
  jobId: t
}) {
  const n = Qt(e);
  if (n) return `document:${n}`;
  const r = Qt(t);
  return r ? `job:${r}` : "";
}
function Br(e) {
  const t = Qt(e);
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
  if (!(!qn.has(t) || !qn.has(n) || t === n))
    return { left: t, right: n };
}
function Es(e) {
  return e === null ? null : $r(e) ? e : void 0;
}
function ks(e) {
  return Ps.has(e) ? e : void 0;
}
function Ur(e) {
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
function Ms(e, t, n = "") {
  var m;
  const [r, o] = N(() => {
    var h;
    return ((h = we(n)) == null ? void 0 : h.zoom) ?? Je(e, De());
  }), a = M(r), s = M(n);
  a.current = r;
  const l = M(1), i = M(((m = we(n)) == null ? void 0 : m.zoom) !== void 0);
  $(() => {
    var f;
    if (s.current === n) return;
    s.current = n;
    const h = (f = we(n)) == null ? void 0 : f.zoom;
    i.current = h !== void 0;
    const b = h ?? Je(e, De());
    l.current = 1, a.current = b, o(b);
  }, [e, n]), $(() => {
    if (i.current) return;
    const h = Je(e, De()), b = a.current;
    Math.abs(h - b) < 5e-4 || (l.current = 1, a.current = h, o(h));
  }, [e]);
  const c = F((h) => {
    const b = Dt(h), f = a.current;
    Math.abs(b - f) < 5e-4 || (l.current = b / (f || 1), i.current = !0, xt(s.current, { zoom: b }), o(b));
  }, []), u = F((h) => {
    c(ft(a.current, h));
  }, [c]), d = F((h) => {
    c(Je(h));
  }, [c]);
  return Fe(() => {
    const h = l.current;
    Math.abs(h - 1) < 1e-3 || (l.current = 1, gs(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: u, resetZoom: d };
}
function As(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: F((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const vn = 48;
function Hr(e, t = vn) {
  return e.getBoundingClientRect().top + t;
}
function Wr(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const i of e) {
    const c = i.getBoundingClientRect();
    c.height < 8 || c.width < 8 || c.top <= t + 1 && c.top >= r && (n = i, r = c.top);
  }
  if (!n && (n = e.find((c) => {
    const u = c.getBoundingClientRect();
    return u.height >= 8 && u.width >= 8;
  }) ?? null, n)) {
    const c = [...e].reverse().find((u) => {
      const d = u.getBoundingClientRect();
      return d.height >= 8 && d.width >= 8;
    });
    c && c.getBoundingClientRect().bottom < t && (n = c);
  }
  if (!n)
    return null;
  const o = yn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, l = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: l };
}
function jt(e, t, n = vn) {
  if (!e)
    return null;
  const r = Et(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Hr(e, n), l = Wr(o, s);
  return l ? { page: l.page, fraction: l.fraction } : null;
}
function Sn(e, t, n = "auto", r, o = vn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let l = null;
  if (r && (l = e.querySelector(Et(a, r))), l || (l = e.querySelector(Et(a))), !l)
    return !1;
  const i = e.getBoundingClientRect(), c = l.getBoundingClientRect();
  if (i.height <= 0 || c.height < 8 && l.offsetHeight < 8)
    return !1;
  const u = c.height > 0 ? c.height : l.offsetHeight, d = e.scrollTop + (c.top - i.top), m = Math.max(0, d + s * u - o);
  return n === "auto" ? e.scrollTop = m : e.scrollTo({ top: m, behavior: n }), !0;
}
function Ns(e, t, n = "smooth", r) {
  return Sn(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function en(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const l = [], i = () => {
    var u;
    if (a) return;
    Sn(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (u = n == null ? void 0 : n.onDone) == null || u.call(n));
  };
  for (const c of o)
    c <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(i);
    }) : l.push(setTimeout(i, c));
  return () => {
    a = !0;
    for (const c of l)
      clearTimeout(c);
  };
}
function _s(e, t, n) {
  return en(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Mt(e, t) {
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
function Ls(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
  return $(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const l = e.current;
    if (!l)
      return;
    let i = !1, c = null, u = 0;
    const d = Et(void 0, o), m = () => {
      if (i) return;
      const f = Array.from(l.querySelectorAll(d));
      if (!f.length)
        return;
      const v = Hr(l), y = Wr(f, v);
      y && s(y.page);
    }, h = () => {
      i || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, m();
      }));
    }, b = () => {
      if (i) return;
      if (!Array.from(l.querySelectorAll(d)).length) {
        c = setTimeout(b, 120);
        return;
      }
      m(), l.addEventListener("scroll", h, { passive: !0 });
    };
    return b(), () => {
      i = !0, c && clearTimeout(c), u && cancelAnimationFrame(u), l.removeEventListener("scroll", h);
    };
  }, [e, t, n, r, o]), a;
}
const Cs = `canvas, .react-pdf__Page, .${Dr}, .${Tt}`, Gn = /* @__PURE__ */ new WeakMap();
function Ds(e) {
  const t = Number(e.getAttribute(gn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Gn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Cs), Gn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function xs(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function zs(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(ls()).forEach((r) => {
    const o = yn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Ds(r);
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
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = M(o), l = M(r);
  return l.current = r, Fe(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, c = 0, u = !1, d = !1;
    const m = () => {
      var S;
      if (i) return;
      const P = e.current;
      if (!P) return;
      const p = zs(P);
      xs(s.current, p) || (s.current = p, a(p)), u && !d && (d = !0, (S = l.current) == null || S.call(l));
    }, h = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(m);
      });
    };
    h();
    const b = window.setTimeout(h, 100), f = window.setTimeout(() => {
      u = !0, h();
    }, 300), v = window.setTimeout(h, 700), y = e.current;
    let w = null;
    return y && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => h()), w.observe(y)), () => {
      i = !0, cancelAnimationFrame(c), window.clearTimeout(b), window.clearTimeout(f), window.clearTimeout(v), w == null || w.disconnect();
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
]), Ws = 180, Kn = [0, 48, 140, 320, 700, 1200];
function Vs(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, l = M(
    ((T = we(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), i = M(null), c = M(!1), u = M(r), d = M(null), m = M(null), h = M(null), b = M(null), f = M(a), v = M(""), y = M(n);
  y.current = n;
  const w = F(() => {
    var R;
    (R = d.current) == null || R.call(d), d.current = null, m.current != null && (clearTimeout(m.current), m.current = null);
  }, []), P = F(() => {
    !c.current && i.current == null || (w(), h.current != null && (clearTimeout(h.current), h.current = null), i.current = null, c.current = !1);
  }, [w]), p = F((R = !1) => {
    b.current != null && (clearTimeout(b.current), b.current = null);
    const E = () => {
      b.current = null, xt(f.current, {
        anchor: ge(l.current)
      });
    };
    R ? E() : b.current = setTimeout(E, Ws);
  }, []), S = F((R) => {
    l.current = ge(R), i.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, c.current = !1;
    }, Us);
  }, []);
  $(() => {
    if (!o)
      return;
    let R = !1, E = null, O = null, U = null;
    const J = () => {
      if (R) return;
      const G = e.current;
      if (!G) {
        U = setTimeout(J, 50);
        return;
      }
      E = G, O = () => {
        if (c.current)
          return;
        const j = jt(E, y.current);
        j && (l.current = j, p());
      }, E.addEventListener("scroll", O, { passive: !0 }), c.current || O();
    };
    return J(), () => {
      R = !0, U != null && clearTimeout(U), E && O && E.removeEventListener("scroll", O);
    };
  }, [o, r, n, e, p]), $(() => {
    if (!o) return;
    const R = e.current;
    if (!R) return;
    const E = (O) => {
      O.metaKey || O.ctrlKey || O.altKey || Hs.has(O.key) && P();
    };
    return R.addEventListener("wheel", P, { passive: !0 }), R.addEventListener("touchmove", P, { passive: !0 }), window.addEventListener("keydown", E), () => {
      R.removeEventListener("wheel", P), R.removeEventListener("touchmove", P), window.removeEventListener("keydown", E);
    };
  }, [o, e, P]), Fe(() => {
    var E;
    if (f.current === a) return;
    p(!0), w(), h.current != null && (clearTimeout(h.current), h.current = null), f.current = a, v.current = "";
    const R = (E = we(a)) == null ? void 0 : E.anchor;
    l.current = R ? ge(R) : { page: 1, fraction: 0 }, i.current = null, c.current = !!a, u.current = r;
  }, [a, r, p, w]), $(() => {
    var E;
    if (!o || !s || !a || v.current === a) return;
    v.current = a;
    const R = ge(
      ((E = we(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
    );
    return l.current = R, i.current = R, c.current = !0, w(), d.current = en(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: y.current,
        delaysMs: Kn,
        onDone: () => S(R)
      }
    ), m.current = setTimeout(() => {
      m.current = null, S(R);
    }, Math.max(...Kn) + 160), () => w();
  }, [o, s, a, e, S, w]), $(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      c.current = !1, i.current = null, w();
      return;
    }
    const R = i.current ? ge(i.current) : ge(l.current);
    return c.current = !0, i.current = R, l.current = R, w(), d.current = en(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Fs,
        onDone: () => S(R)
      }
    ), m.current = setTimeout(() => {
      m.current = null, S(R);
    }, $s), () => {
      w();
    };
  }, [r, o, n, e, S, w]), $(() => () => {
    w(), h.current != null && (clearTimeout(h.current), h.current = null), p(!0);
  }, [w, p]);
  const k = F(() => {
    const R = jt(
      e.current,
      y.current
    );
    return ge(R || l.current);
  }, [e]), A = F(() => {
    c.current = !0;
    const R = jt(
      e.current,
      y.current
    ), E = ge(R ?? l.current);
    return l.current = E, i.current = E, p(), E;
  }, [e, p]), z = F((R, E, O) => {
    const U = O || y.current, J = Mt(R, E || 1), G = { page: J, fraction: 0 };
    l.current = G, c.current = !0, i.current = G, p(), w(), Ns(e.current, J, "smooth", U), d.current = _s(
      () => e.current,
      J,
      {
        behavior: "auto",
        pane: U,
        delaysMs: js,
        onDone: () => S(G)
      }
    ), m.current = setTimeout(() => {
      m.current = null, S(G);
    }, Bs);
  }, [e, S, w, p]), D = F(() => ge(l.current), []), C = F(() => c.current, []), I = F(() => {
    if (!c.current || !i.current)
      return;
    const R = ge(i.current);
    Sn(
      e.current,
      R,
      "auto",
      y.current
    );
  }, [e]);
  return {
    lockFromShell: k,
    beginModeSwitch: A,
    goToPage: z,
    getAnchor: D,
    isRestoring: C,
    repinIfRestoring: I
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
function Vr(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const qs = [0, 80, 200, 400, 800], Gs = 120, Ks = 400;
function Zs(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: l, jobId: i, documentId: c, regionsSettled: u = !0 } = e, d = M(a);
  d.current = a;
  const m = M(s);
  m.current = s;
  const h = M(l);
  h.current = l;
  const b = M(n);
  b.current = n, $(() => {
    var p, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const f = ba(), v = Js(f, m.current);
    if (v == null && (f != null && f.blockId) && !u) return;
    const y = Vr(f, v, { jobId: i, documentId: c });
    if (t.current === y)
      return;
    if (v == null) {
      t.current = y, (p = b.current) == null || p.call(b);
      return;
    }
    t.current = y, f && ((S = h.current) == null || S.call(h, f, v));
    const w = [];
    let P = 0;
    for (const k of qs)
      P = Math.max(P, k), w.push(
        setTimeout(() => {
          d.current(v);
        }, k)
      );
    return w.push(
      setTimeout(() => {
        var k;
        (k = b.current) == null || k.call(b);
      }, P + Gs)
    ), () => {
      for (const k of w) clearTimeout(k);
    };
  }, [r, o, i, c, t, u]);
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
    jobId: l,
    documentId: i,
    applyReaderSearch: c
  } = e, u = M(a);
  u.current = a;
  const d = M(c);
  d.current = c;
  const m = M(0);
  $(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || m.current === o) return;
    const h = setTimeout(() => {
      var y;
      const b = ((y = globalThis.location) == null ? void 0 : y.search) || "", f = Do(b, o, u.current);
      if (m.current = o, f === null) return;
      const v = `${new URLSearchParams(f).get("block_id") || ""}`.trim();
      t.current = Vr(
        { blockId: v },
        o,
        { jobId: l, documentId: i }
      ), (d.current || Ys)(f);
    }, s);
    return () => clearTimeout(h);
  }, [
    n,
    r,
    o,
    s,
    l,
    i,
    t
  ]);
}
function Qs(e) {
  const t = M(""), [n, r] = N(!1), o = F(() => r(!0), []), a = {
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
const at = {
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
function ti(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Jr(r, t, n);
  if (o === "retry") return e;
  if (o === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const a = new Map(n.items.map((i) => [i.item_id, i])), s = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const i of t.changed_item_ids)
    a.has(i) && s.set(i, t.seq);
  const l = new Map(e.pagesByPage);
  return l.set(t.page_idx, {
    attempt: n.attempt,
    generation: n.generation,
    pageHash: n.page_hash,
    itemsById: a,
    changedAtSeqById: s,
    lastEventSeq: t.seq
  }), {
    ...e,
    pagesByPage: l,
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
const Yn = [250, 500, 1e3, 2e3, 4e3], Bt = [80, 160, 320, 640, 1e3, 1500], Xn = [250, 500, 1e3, 2e3, 4e3, 5e3];
function tn(e, t) {
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
  return Uo(e) ? `${e.code || ""}`.trim() : "";
}
function vt(e, t) {
  const n = wn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ri(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Jr(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = Ho(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (i) {
      if ((i == null ? void 0 : i.name) === "AbortError") throw i;
      a = i;
      const c = wn(i);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw i;
    }
    const l = Bt[Math.min(s, Bt.length - 1)];
    if (await tn(l, r), s >= Bt.length + 2) throw a;
  }
}
function oi({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(at), s = M(o), l = M("");
  s.current = o;
  const i = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), u = mn(c) ? c : "";
  return $(() => {
    if (!n || !i) {
      l.current = "", s.current = at, a(at);
      return;
    }
    const d = r === void 0 ? da() : r, m = l.current === i;
    if (l.current = i, !d) {
      const P = {
        ...m ? s.current : at,
        connection: u ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = P, a(P);
      return;
    }
    const h = new AbortController();
    let b = !1;
    const f = {
      ...m ? s.current : at,
      connection: u ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = f, a(f);
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
          b = !0, v((S) => ({
            ...S,
            layoutByPage: ei(p),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError") return;
          const S = wn(p);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            v((A) => ({
              ...A,
              connection: u ? "terminal" : "unavailable",
              jobStatus: c,
              error: vt(p, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            v((A) => ({
              ...A,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          v((A) => ({
            ...A,
            connection: "connecting",
            jobStatus: c,
            error: vt(p, "正在等待 OCR 版面数据")
          })), await tn(Yn[Math.min(P, Yn.length - 1)], h.signal).catch(() => {
          }), P += 1;
        }
    };
    return (async () => {
      if (await y(), !b || h.signal.aborted) return;
      let P = 0;
      for (; !h.signal.aborted; ) {
        u || v((p) => ({
          ...p,
          connection: p.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
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
                S = await ri(
                  i,
                  p,
                  s.current,
                  h.signal,
                  d
                );
              } catch (k) {
                if ((k == null ? void 0 : k.name) === "AbortError" || h.signal.aborted) throw k;
                v((A) => ({
                  ...A,
                  lastSeq: Math.max(A.lastSeq, p.seq),
                  error: vt(k, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              v((k) => {
                const A = ti(k, p, S);
                return u ? {
                  ...A,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...A,
                  jobStatus: c
                };
              }), P = 0;
            }
          });
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError" || h.signal.aborted) return;
          v((S) => ({
            ...S,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: c,
            error: vt(p, "实时译文连接已中断，正在重连")
          }));
        }
        if (h.signal.aborted) return;
        if (u) {
          v((p) => ({
            ...p,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await tn(Xn[Math.min(P, Xn.length - 1)], h.signal).catch(() => {
        }), P += 1;
      }
    })(), () => h.abort();
  }, [n, r, i, u]), o;
}
function ai(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, l = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    l && i > 0 && o.set(l, i);
  }
  return o;
}
function si(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return $(() => {
    r((l) => l.size ? /* @__PURE__ */ new Map() : l);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ct().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((l) => {
      !s && l && r(ai(l));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const ii = 2e3;
function li(e) {
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
const ci = /* @__PURE__ */ new Set(["book", "translate"]);
function qr(e) {
  return !!(e.jobId && e.sourceUrl && ci.has(e.workflow));
}
function ui(e) {
  return !!(qr(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function di() {
  const e = Ya(), t = qr({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = ui({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !mn(o) && (r.current.running = !0);
  const a = oi({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: l, shellWidth: i, bindShell: c } = ts(), u = si(e.jobId, !e.sourceOnly), d = Rs({
    documentId: e.documentId,
    jobId: e.jobId
  }), m = `${d}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: b } = Ms(e.mode, s, d), f = rs(
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
    repinIfRestoring: w
  } = Vs(s, {
    primaryPane: f.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: d,
    restoreReady: f.primaryNumPages > 0
  });
  $(() => {
    w();
  }, [i, w]);
  const P = Os(
    s,
    f.compareMode,
    f.rowSyncRevision,
    w
  ), p = Ls(
    s,
    f.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${f.metricsTick}`,
    f.primaryPane
  ), S = F((j, Y) => {
    var V, ee;
    const _ = Math.max(
      Number(f.hudNumPages) || 0,
      Number(f.primaryNumPages) || 0,
      Number((V = f.numPagesByPane) == null ? void 0 : V.source) || 0,
      Number((ee = f.numPagesByPane) == null ? void 0 : ee.translated) || 0
    );
    y(j, _, Y);
  }, [y, f.hudNumPages, f.primaryNumPages, f.numPagesByPane]), [k, A] = N(null), z = M(null), D = F((j) => {
    z.current && clearTimeout(z.current), A(j), j && (z.current = setTimeout(() => A(null), ii));
  }, []);
  $(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const C = F((j) => {
    const Y = Ft(e.regions, j);
    return Y ? jn(Y, f.primaryPane).page : null;
  }, [e.regions, f.primaryPane]), I = F((j, Y) => {
    const _ = Y || f.primaryPane, V = typeof j == "object" && j ? `${j.block_id || ""}`.trim() : "", ee = typeof j == "object" && j ? `${j.image_url || ""}`.trim() : "", ae = typeof j == "object" && j ? j.page_idx != null ? Number(j.page_idx) + 1 : j.page != null ? Number(j.page) : null : typeof j == "number" ? j + 1 : null, H = Oo(e.regions, ee, ae) || Ft(e.regions, V) || (typeof j == "object" ? Fo(e.regions, j) : null);
    let B = H ? jn(H, _).page : null;
    B == null && (B = li(j)), !(B == null || B < 1) && (D(H), S(B, _));
  }, [D, S, f.primaryPane, e.regions]);
  Qs({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: f.hudNumPages || 0,
    currentPage: p,
    goToPage: S,
    resolveBlockPage: C,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (j) => {
      D(Ft(e.regions, j.blockId));
    }
  });
  const T = !e.boot.loading && !e.boot.failed && e.assetsReady, R = Number(f.hudNumPages) || 0;
  $(() => {
    var j;
    T && ((j = ha()) == null || j.report(p >= 1 ? p - 1 : null, R >= 1 ? R : null));
  }, [T, p, R]), $(() => {
    const j = ga();
    if (!(!j || !T || !e.jobId))
      return j.subscribe(({ jobId: Y, pageIdx: _, blockId: V }) => Y !== e.jobId ? !1 : (I({ ..._ != null ? { page_idx: _ } : {}, ...V ? { block_id: V } : {} }), !0));
  }, [T, e.jobId, I]);
  const { setModeKeepingPage: E } = As({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  $(() => {
    D(null);
  }, [m, D]);
  const O = !e.boot.loading && !e.boot.failed, U = Q(() => ({ bindShell: c, shellEl: l, shellWidth: i, shellRef: s }), [c, l, i, s]), J = Q(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), G = Q(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: b,
    shell: U,
    panes: f,
    sessionFiles: J,
    rowHeights: P,
    goToPage: S,
    activeRegion: k,
    jumpToAnchor: I,
    setModeKeepingPage: E,
    download: e.download,
    showHud: O,
    viewStateKey: d,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, U, f, J, P, S, k, I, E, O, h, b, d, a, n, u]);
  return Q(() => ({
    ...G,
    currentPage: p
  }), [G, p]);
}
const fi = [
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
], mi = [
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
function hi(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of fi)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function pi(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const gi = ".reader-notes-panel";
function bi(e) {
  return e instanceof Element ? !!e.closest(gi) : !1;
}
function yi(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: l,
    goToPage: i,
    enabled: c = !0
  } = e;
  $(() => {
    if (!c)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || pi(d.target) || bi(d.target))
        return;
      const m = d.key, h = hi(m);
      if (h) {
        if (h.mode) {
          if (n && h.mode !== "source")
            return;
          d.preventDefault(), r(h.mode);
          return;
        }
        if (!(h.requiresPages && l <= 0))
          switch (d.preventDefault(), h.action) {
            case "zoom-in":
              a(ft(o, 1));
              return;
            case "zoom-out":
              a(ft(o, -1));
              return;
            case "zoom-reset":
              a(Je(t, De()));
              return;
            case "next-page":
              i(Mt(s + 1, l));
              return;
            case "prev-page":
              i(Mt(s - 1, l));
              return;
            case "first-page":
              i(1);
              return;
            case "last-page":
              i(l);
              return;
          }
      }
    };
    return window.addEventListener("keydown", u), () => window.removeEventListener("keydown", u);
  }, [
    c,
    t,
    n,
    r,
    o,
    a,
    s,
    l,
    i
  ]);
}
const vi = "retainpdf:soft-reader-close";
function Gr(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed") || ""}`.trim();
  } catch {
    return "";
  }
}
function Si(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed_pane") || ""}`.trim();
  } catch {
    return "";
  }
}
function wi() {
  const e = new URL("./index.html", window.location.href), t = Gr();
  return t && e.searchParams.set("embed", t), e.href;
}
function Pi() {
  if (typeof window > "u" || window.self === window.top || Gr()) return !1;
  try {
    return window.parent.postMessage(
      { type: vi },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ri(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Ii() {
  if (!(typeof window > "u") && !Pi()) {
    if (Ri(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(wi());
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
  return /* @__PURE__ */ g("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ti({ onBeforeClose: e } = {}) {
  return Si() === "beside" ? null : /* @__PURE__ */ x(Kr, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Ii();
  }, children: [
    /* @__PURE__ */ g(pn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ g("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Ei = { available: !1, open: !1, title: null }, ki = () => () => {
}, Mi = () => Ei;
function Ai() {
  const e = ma(), t = (e == null ? void 0 : e.getState) ?? Mi, n = Lt((e == null ? void 0 : e.subscribe) ?? ki, t, t);
  if (!e || !n.available) return null;
  const r = n.open ? `收起笔记${n.title ? `：${n.title}` : ""}` : "打开这本书的笔记";
  return /* @__PURE__ */ g(Kr, { className: "reader-notes-toggle", label: r, pressed: n.open, onClick: e.toggle, children: /* @__PURE__ */ g(Vo, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }) });
}
let Qn = !1;
function Ni() {
  if (Qn)
    return;
  const e = ut().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (ta.GlobalWorkerOptions.workerSrc = e, Qn = !0);
}
const _i = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Li(e, t, n) {
  return e.flatMap((r) => {
    if (!_i.has(Mr(r.region))) return [];
    const o = hn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function er(e, t, n) {
  let r = null, o = Number.POSITIVE_INFINITY;
  for (const a of e) {
    const { rect: s } = a;
    if (t < s.left || t > s.left + s.width || n < s.top || n > s.top + s.height)
      continue;
    const l = s.width * s.height;
    l < o && (r = a, o = l);
  }
  return r;
}
async function Ci(e) {
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
const Di = "reader-text-hover-copy", xi = "reader-text-hover-id", Zr = "reader-text-hover-tools", zi = "reader-text-hover-quote";
function Oi(e) {
  const { region: t } = e.highlight, n = `${t.translated.text || ""}`.trim();
  return {
    itemId: e.itemId,
    pageIdx: Math.max(0, t.source.page - 1),
    sourceText: `${t.source.text || ""}`,
    translatedText: n ? t.translated.text : null
  };
}
function Ut({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ g(
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
const Yr = 26, At = 190;
function Xr(e, t = At) {
  return e.height < Yr * 2 || e.width < t;
}
const Fi = 72;
function $i({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = N("idle"), [a, s] = N("idle"), [l, i] = N("idle"), c = M([]), u = (e == null ? void 0 : e.itemId) || "";
  if ($(() => {
    o("idle"), s("idle"), i("idle");
    const P = c.current;
    return () => {
      P.forEach((p) => window.clearTimeout(p)), c.current = [];
    };
  }, [u]), !e) return null;
  const d = $o(e.highlight.region, t), m = Mr(e.highlight.region), h = (P, p) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const k = await Ci(P);
    p(k ? "copied" : "failed"), c.current.push(window.setTimeout(() => p("idle"), 1200));
  }, b = m === "formula" ? "复制 LaTeX" : "复制", f = fa(), v = !!(f != null && f.available()), y = (P) => {
    P.preventDefault(), P.stopPropagation();
    const p = !!(f != null && f.send(Oi(e)));
    i(p ? "copied" : "failed"), c.current.push(window.setTimeout(() => i("idle"), 1200));
  }, w = Xr(e.rect, v ? At + Fi : At);
  return /* @__PURE__ */ g("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ g(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": m,
      style: e.rect,
      children: /* @__PURE__ */ x(
        "div",
        {
          className: Zr,
          "data-placement": w ? "outside" : "inside",
          children: [
            /* @__PURE__ */ g(
              Ut,
              {
                className: xi,
                state: a,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: h(e.itemId, s),
                children: a === "copied" ? "已复制编号" : e.itemId
              }
            ),
            t === "translated" && n > 0 ? /* @__PURE__ */ x("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            d ? /* @__PURE__ */ g(
              Ut,
              {
                className: Di,
                state: r,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: h(d, o),
                children: r === "copied" ? "已复制" : r === "failed" ? "复制失败" : b
              }
            ) : null,
            v ? /* @__PURE__ */ g(
              Ut,
              {
                className: zi,
                state: l,
                label: "把这一段摘到笔记",
                title: "摘到笔记：原文和译文一起放进打开的笔记",
                onClick: y,
                children: l === "copied" ? "已摘" : l === "failed" ? "没摘上" : "摘到笔记"
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function ji(e, t) {
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
function Bi(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const l = hn(
      ji(e, a),
      n,
      r
    );
    l && o.push({
      itemId: a.item_id,
      translatedText: s.translated_text,
      status: s.status,
      kind: a.kind,
      sourceText: a.source_text,
      typography: a.typography,
      rect: l,
      changedAtSeq: t.changedAtSeqById.get(a.item_id) || 0,
      changedNow: t.changedAtSeqById.get(a.item_id) === t.lastEventSeq
    });
  }
  return o;
}
const Ui = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Hi = 256, st = /* @__PURE__ */ new Map();
function Wi(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Vi(e) {
  const t = `${e || ""}`, { text: n, slots: r } = oa(t, { bareLatex: !0 }), o = Wi(n), a = aa(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = st.get(t);
  if (!s && (s = sa(o, r), st.set(t, s), st.size > Hi)) {
    const l = st.keys().next().value;
    l !== void 0 && st.delete(l);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Ht(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ee(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Ji(e, t) {
  const n = e.typography, r = Ee(t) || 1, o = Ee(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), l = Ht(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, l * r)), c = Ee(n == null ? void 0 : n.fit_min_font_size_pt), u = Ee(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (c || 5.5) * r), m = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), h = o ? o * r : i, b = Ee(n == null ? void 0 : n.leading_em), f = [
    Ee(n == null ? void 0 : n.padding_top_pt) || 0,
    Ee(n == null ? void 0 : n.padding_right_pt) || 0,
    Ee(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ee(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((v) => v * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Ui,
    fontSizePx: Math.max(d, Math.min(m, h)),
    minFontSizePx: d,
    maxFontSizePx: m,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: b ? 1 + b : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Ht(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Ht(e.kind) ? "center" : "justify",
    padding: f,
    exact: !!o
  };
}
function qi(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), l = (d) => {
    const m = s.get(d);
    if (m !== void 0) return m;
    const { width: h, height: b } = e(d), f = h <= t + 0.5 && b <= n + 0.5;
    return s.set(d, f), f;
  };
  let i = o, c = a, u = Math.min(r.requestedFontSizePx, c);
  if (l(u)) {
    if (!r.exact) {
      i = u;
      for (let d = 0; d < 6 && c > i; d += 1) {
        const m = (i + c) / 2;
        l(m) ? (u = m, i = m) : c = m;
      }
    }
  } else {
    c = u, u = i;
    for (let d = 0; d < 8 && c > i; d += 1) {
      const m = (i + c) / 2;
      l(m) ? (u = m, i = m) : c = m;
    }
  }
  return Math.max(o, u);
}
const Gi = 512, it = /* @__PURE__ */ new Map();
let nn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  nn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  nn += 1;
}));
function Ki(e, t, n, r) {
  return [
    nn,
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
function Zi({ item: e, pageScale: t }) {
  const n = M(null), r = Q(
    () => Vi(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = Q(
    () => Ji(e, t),
    [e, t]
  );
  $(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((m) => {
      d && a(m);
    }), () => {
      d = !1;
    };
  }, [r]), Fe(() => {
    const d = n.current;
    if (!d) return;
    const [m, h, b, f] = s.padding, v = Math.max(1, e.rect.width - f - h), y = Math.max(1, e.rect.height - m - b), w = Ki(o, v, y, s);
    let P = it.get(w);
    if (P === void 0 && (P = qi(
      (p) => (d.style.fontSize = `${p}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      v,
      y,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), it.set(w, P), it.size > Gi)) {
      const p = it.keys().next().value;
      p !== void 0 && it.delete(p);
    }
    d.style.fontSize = `${P.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [l, i, c, u] = s.padding;
  return /* @__PURE__ */ g(
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": s.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${l}px ${i}px ${c}px ${u}px`
      },
      children: /* @__PURE__ */ g(
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
function Yi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = Q(
    () => Bi(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ g(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ g(
        Zi,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Xi = cn(Yi), Qr = un(null), eo = un(null);
function Qi({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ g(Qr.Provider, { value: e, children: /* @__PURE__ */ g(eo.Provider, { value: t, children: n }) });
}
function $e() {
  return dn(Qr);
}
function to() {
  return dn(eo);
}
const no = 1.414;
function el({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  syncedMinHeight: a = 0,
  onMetrics: s,
  cachedAspect: l,
  onAspectChange: i,
  sentinelRef: c,
  regionHighlight: u = null,
  regionTargets: d = [],
  hoveredRegionId: m,
  onHoverRegion: h,
  liveTranslationLayout: b,
  liveTranslationPage: f,
  showLiveTranslation: v = r === "source"
}) {
  var Y;
  const y = (Y = $e()) == null ? void 0 : Y.revisedBlocks, w = M(l ?? no), [P, p] = N(w.current);
  $(() => {
    l != null && Math.abs(l - w.current) >= 1e-3 && (w.current = l, p(l));
  }, [l]);
  const S = M(c);
  S.current = c;
  const k = M((_) => {
    var V;
    (V = S.current) == null || V.call(S, _);
  }).current, A = Math.max(120, Math.floor(t * P)), z = Math.max(A, Math.ceil(a || 0)), D = hn(u, t, A), C = Q(
    () => Li(d, t, A),
    [A, d, t]
  ), [I, T] = N(null), R = typeof h == "function", E = R ? m ?? null : I, O = (_) => {
    R ? _ !== (m ?? null) && (h == null || h(_)) : T((V) => V === _ ? V : _);
  }, U = Q(
    () => C.find((_) => _.itemId === E) || null,
    [E, C]
  ), J = (_) => {
    var te, ye;
    if (_.pointerType === "touch") return;
    if (_.buttons !== 0) {
      O(null);
      return;
    }
    if ((ye = (te = _.target) == null ? void 0 : te.closest) != null && ye.call(te, `.${Zr}`)) return;
    const V = _.currentTarget.getBoundingClientRect(), ee = _.clientX - V.left, ae = _.clientY - V.top, H = U == null ? void 0 : U.rect;
    if (H && Xr(H) && ee >= H.left - 4 && ee <= H.left + At && ae >= H.top - Yr && ae <= H.top) return;
    const B = er(C, ee, ae);
    O((B == null ? void 0 : B.itemId) || null);
  }, G = (_) => {
    if (_.pointerType === "mouse") return;
    const V = _.currentTarget.getBoundingClientRect(), ee = er(
      C,
      _.clientX - V.left,
      _.clientY - V.top
    );
    O((ee == null ? void 0 : ee.itemId) || null);
  }, j = (_) => {
    !Number.isFinite(_) || _ <= 0 || Math.abs(w.current - _) < 1e-3 || (w.current = _, p(_), i == null || i(e, _));
  };
  return /* @__PURE__ */ x(
    "div",
    {
      ref: k,
      [Ze]: e,
      [dt]: r,
      [gn]: A,
      className: bn,
      onPointerMoveCapture: J,
      onPointerDown: G,
      onPointerLeave: (_) => {
        _.pointerType === "mouse" && O(null);
      },
      style: {
        width: t,
        height: z,
        minHeight: z
      },
      children: [
        o ? /* @__PURE__ */ g(
          na,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: !0,
            renderAnnotationLayer: !1,
            className: Dr,
            loading: /* @__PURE__ */ g(
              "div",
              {
                className: Tt,
                style: { width: t, height: A }
              }
            ),
            onLoadSuccess: (_) => {
              try {
                const V = _.getViewport({ scale: 1 });
                if (V.width > 0) {
                  const ee = V.height / V.width;
                  j(ee);
                }
              } catch {
              }
              s == null || s();
            },
            onRenderSuccess: () => {
              s == null || s();
            }
          }
        ) : /* @__PURE__ */ g(
          "div",
          {
            className: Tt,
            style: { width: t, height: A },
            "aria-hidden": !0
          }
        ),
        D ? /* @__PURE__ */ g(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: D,
            "aria-hidden": "true"
          }
        ) : null,
        o && v ? /* @__PURE__ */ g(
          Xi,
          {
            layoutPage: b,
            pageState: f,
            width: t,
            height: A
          }
        ) : null,
        o && r === "translated" && (y != null && y.size) ? /* @__PURE__ */ g("div", { className: "reader-revised-markers", "aria-hidden": "true", children: C.filter((_) => y.has(_.itemId)).map((_) => /* @__PURE__ */ g(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": _.itemId,
            style: { left: _.rect.left, top: _.rect.top, height: _.rect.height }
          },
          _.itemId
        )) }) : null,
        /* @__PURE__ */ g(
          $i,
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
const tl = cn(el), Wt = 5, nl = "120% 0px", rl = 120;
let tr = 1;
const nr = /* @__PURE__ */ new WeakMap();
function ol(e) {
  if (!e) return 0;
  const t = nr.get(e);
  if (t) return t;
  const n = tr;
  return tr += 1, nr.set(e, n), n;
}
function al() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const sl = To(
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: o = 1,
    visible: a = !0,
    emptyLabel: s = "暂无 PDF",
    scrollRoot: l = null,
    pageWidthOverride: i = null,
    rowHeights: c,
    onMetrics: u,
    onLoadSuccess: d,
    onLoadError: m,
    onNumPagesChange: h,
    activeRegion: b = null,
    regions: f = [],
    readerMetadata: v = null,
    hoveredRegionId: y = null,
    onHoverRegion: w,
    liveTranslation: P,
    showLiveTranslation: p = t === "source",
    liveTranslationPendingLabel: S = "",
    paneAction: k
  }, A) {
    Ni();
    const { file: z, loading: D, error: C } = Va(n, r), I = `${n}\0${ol(z)}`, T = M(I);
    T.current = I;
    const R = Q(
      () => $a(z),
      [z, n]
    ), [E, O] = N(0), [U, J] = N(""), [G, j] = N(null), [Y, _] = N(480), V = M(null), ee = M(0), ae = Q(() => al(), []), H = Q(() => ({
      cMapUrl: ut().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: ut().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    fn(A, () => G, [G]), $(() => {
      const L = (K) => {
        ee.current = K, _(K);
      }, q = (K) => {
        const X = ys(K, ee.current);
        if (X !== "ignore") {
          if (V.current && clearTimeout(V.current), X === "immediate") {
            L(K);
            return;
          }
          V.current = setTimeout(() => L(K), vs);
        }
      }, W = !!(i && i >= 80);
      q(W ? i : (l == null ? void 0 : l.clientWidth) || 0);
      const re = !W && l && typeof ResizeObserver < "u" ? new ResizeObserver((K) => {
        var X, ue;
        q(((ue = (X = K[0]) == null ? void 0 : X.contentRect) == null ? void 0 : ue.width) ?? l.clientWidth);
      }) : null;
      return re && l && re.observe(l), () => {
        re == null || re.disconnect(), V.current && clearTimeout(V.current);
      };
    }, [i, l, a]);
    const B = Q(
      () => ps(Y, o),
      [Y, o]
    ), [te, ye] = N(() => /* @__PURE__ */ new Map()), [pe, Qe] = N(() => /* @__PURE__ */ new Set()), [zt, Ue] = N(() => /* @__PURE__ */ new Set()), et = M(/* @__PURE__ */ new Map()), Pe = M(null), oe = M(/* @__PURE__ */ new Map()), de = F((L, q) => {
      ye((W) => {
        if (W.get(L) === q) return W;
        const Z = new Map(W);
        return Z.set(L, q), Z;
      });
    }, []), he = F((L, q) => {
      const W = et.current, Z = W.get(L);
      if (Z && Pe.current)
        try {
          Pe.current.unobserve(Z);
        } catch {
        }
      if (q) {
        if (W.set(L, q), Pe.current)
          try {
            Pe.current.observe(q);
          } catch {
          }
      } else
        W.delete(L);
    }, []), ie = M(/* @__PURE__ */ new Map()), le = F((L) => {
      const q = ie.current;
      let W = q.get(L);
      return W || (W = (Z) => he(L, Z), q.set(L, W)), W;
    }, [he]);
    $(() => {
      if (typeof IntersectionObserver > "u") return;
      const L = oe.current, q = new IntersectionObserver(
        (W) => {
          const Z = [], re = [];
          for (const K of W) {
            const X = K.target, ue = yn(X);
            Number.isFinite(ue) && (K.isIntersecting ? Z : re).push(ue);
          }
          if ((Z.length || re.length) && Qe((K) => {
            let X = null;
            for (const ue of Z)
              K.has(ue) || (X = X || new Set(K), X.add(ue));
            for (const ue of re)
              K.has(ue) && (X = X || new Set(K), X.delete(ue));
            return X || K;
          }), Z.length) {
            for (const K of Z) {
              const X = L.get(K);
              X && (clearTimeout(X), L.delete(K));
            }
            Ue((K) => {
              let X = null;
              for (const ue of Z)
                K.has(ue) || (X = X || new Set(K), X.add(ue));
              return X || K;
            });
          }
          for (const K of re)
            L.has(K) || L.set(K, setTimeout(() => {
              L.delete(K), Ue((X) => {
                if (!X.has(K)) return X;
                const ue = new Set(X);
                return ue.delete(K), ue;
              });
            }, rl));
        },
        { root: l, rootMargin: nl, threshold: 0 }
      );
      Pe.current = q;
      for (const W of et.current.values())
        try {
          q.observe(W);
        } catch {
        }
      return () => {
        q.disconnect(), Pe.current === q && (Pe.current = null);
        for (const W of L.values()) clearTimeout(W);
        L.clear();
      };
    }, [l]), Fe(() => {
      O(0), J(""), Qe(/* @__PURE__ */ new Set()), Ue(/* @__PURE__ */ new Set()), ye(/* @__PURE__ */ new Map()), et.current.clear();
      const L = oe.current;
      for (const q of L.values()) clearTimeout(q);
      L.clear(), h == null || h(0, t);
    }, [I, h, t]);
    const ce = F(
      ({ numPages: L }) => {
        T.current === I && (O(L), J(""), h == null || h(L, t), d == null || d({ numPages: L, pane: t }));
      },
      [I, d, h, t]
    ), He = F(
      (L) => {
        if (T.current !== I) return;
        const q = (L == null ? void 0 : L.message) || "PDF 解析失败";
        J(q), O(0), h == null || h(0, t), m == null || m(L, t);
      },
      [I, m, h, t]
    ), Re = Q(
      () => E > 0 ? Array.from({ length: E }, (L, q) => q + 1) : [],
      [E]
    );
    $(() => {
      typeof IntersectionObserver < "u" || Ue(new Set(Re));
    }, [Re]);
    const Me = Q(
      () => Bn(b, v, t),
      [b, v, t]
    ), tt = Q(() => {
      const L = /* @__PURE__ */ new Map();
      for (const q of f) {
        const W = Bn(q, v, t);
        if (!W) continue;
        const Z = L.get(W.box.page) || [];
        Z.push(W), L.set(W.box.page, Z);
      }
      return L;
    }, [t, v, f]), Ot = Q(() => {
      const L = /* @__PURE__ */ new Set();
      if (!y) return L;
      for (const [q, W] of tt)
        W.some((Z) => Z.itemId === y) && L.add(q);
      return L;
    }, [y, tt]), bt = Q(() => {
      if (E === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!l && typeof IntersectionObserver < "u")) return new Set(Re);
      if (pe.size === 0) {
        const W = Math.min(E, Wt * 2 + 1);
        return new Set(Array.from({ length: W }, (Z, re) => re + 1));
      }
      const q = /* @__PURE__ */ new Set();
      for (const W of pe)
        for (let Z = -Wt; Z <= Wt; Z++) {
          const re = W + Z;
          re >= 1 && re <= E && q.add(re);
        }
      return q;
    }, [E, Re, l, a, pe]), nt = !n || !!C || !!U, rt = n && (C || U) || s;
    return /* @__PURE__ */ x(
      "section",
      {
        ref: j,
        className: `reader-panel ${is}${a ? "" : " is-hidden"}`,
        [dt]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (P == null ? void 0 : P.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          k ? /* @__PURE__ */ g("div", { className: "reader-react-pdf-pane-action", children: k }) : null,
          S ? /* @__PURE__ */ x("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ g("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ g("span", { children: S })
          ] }) : null,
          nt && !D ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: rt }) : null,
          D ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          R && !C ? /* @__PURE__ */ g("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ g(
            ra,
            {
              file: R,
              loading: null,
              error: null,
              options: H,
              onLoadSuccess: ce,
              onLoadError: He,
              className: "reader-react-pdf-document",
              children: Re.map((L) => {
                if (bt.has(L))
                  return /* @__PURE__ */ g(
                    tl,
                    {
                      pane: t,
                      pageNumber: L,
                      width: B,
                      devicePixelRatio: ae,
                      active: zt.has(L),
                      syncedMinHeight: (c == null ? void 0 : c.get(L)) || 0,
                      onMetrics: u,
                      cachedAspect: te.get(L),
                      onAspectChange: de,
                      sentinelRef: le(L),
                      regionHighlight: (Me == null ? void 0 : Me.box.page) === L ? Me : null,
                      regionTargets: tt.get(L),
                      hoveredRegionId: y && Ot.has(L) ? y : null,
                      onHoverRegion: w,
                      liveTranslationLayout: P == null ? void 0 : P.layoutByPage.get(L - 1),
                      liveTranslationPage: P == null ? void 0 : P.pagesByPage.get(L - 1),
                      showLiveTranslation: p
                    },
                    `${t}-${L}`
                  );
                const W = te.get(L) ?? no, Z = Math.max(120, Math.floor(B * W)), re = Math.max(Z, Math.ceil((c == null ? void 0 : c.get(L)) || 0));
                return /* @__PURE__ */ g(
                  "div",
                  {
                    ref: le(L),
                    [Ze]: L,
                    [dt]: t,
                    [gn]: Z,
                    className: bn,
                    style: {
                      width: B,
                      height: re,
                      minHeight: re
                    },
                    children: /* @__PURE__ */ g(
                      "div",
                      {
                        className: Tt,
                        style: { width: B, height: Z },
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
), rr = cn(sl), il = () => () => {
}, or = () => null;
function ll({
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
function cl(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function ul(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function dl(e) {
  const t = $e(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", l = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), m = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? gt, b = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, f = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), v = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, y = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, P = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", p = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", S = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, A = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), z = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), D = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), C = e.regions ?? (t == null ? void 0 : t.regions) ?? [], I = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [R, E] = N(null), O = Lt(
    T ? T.subscribe : il,
    T ? () => T.get().itemId : or,
    T ? () => T.get().itemId : or
  ), U = T ? O : R, J = F((_) => {
    T ? T.set(_, "pdf") : E(_);
  }, [T]), G = ll({
    mode: s,
    compareMode: l,
    showSource: i,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: u
  }), Y = Number.isFinite(b) && b > 0 ? cl(
    b,
    n || r,
    typeof document > "u" ? b * 2 : document.documentElement.clientWidth
  ) : null;
  return /* @__PURE__ */ g(
    "div",
    {
      ref: d,
      className: ss,
      "data-reader-region-count": C.length,
      "data-reader-structured-region-count": C.filter(jo).length,
      "data-reader-metadata-ready": I ? "true" : "false",
      children: /* @__PURE__ */ x(
        "main",
        {
          className: `${as} reader-mode-${G.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            v ? /* @__PURE__ */ g(
              rr,
              {
                pane: "source",
                url: P,
                preloadedFile: S,
                userZoom: h,
                visible: G.showSource,
                scrollRoot: m,
                pageWidthOverride: Y,
                rowHeights: G.compareMode ? f : void 0,
                onMetrics: A,
                emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: z,
                activeRegion: D,
                regions: C,
                readerMetadata: I,
                hoveredRegionId: U,
                onHoverRegion: J,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? ul(o) : "",
                paneAction: u ? /* @__PURE__ */ x(_t, { children: [
                  e.sourcePaneAction,
                  /* @__PURE__ */ g(
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
            y ? /* @__PURE__ */ g(
              rr,
              {
                pane: "translated",
                url: p,
                preloadedFile: k,
                userZoom: h,
                visible: G.showTranslated,
                scrollRoot: m,
                pageWidthOverride: Y,
                rowHeights: G.compareMode ? f : void 0,
                onMetrics: A,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: z,
                activeRegion: D,
                regions: C,
                readerMetadata: I,
                hoveredRegionId: U,
                onHoverRegion: J,
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
const fl = [
  { id: "source", label: "原文", Icon: Ar },
  { id: "compare", label: "对照", Icon: Nr },
  { id: "translated", label: "译文", Icon: _r }
];
function ml(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function hl(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function pl(e) {
  const t = $e(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? ml(a.state) : "";
  return /* @__PURE__ */ x("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ x(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || l,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ g(Jo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: l })
        ]
      }
    ) : null,
    /* @__PURE__ */ g("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: fl.map(({ id: i, label: c, Icon: u }) => {
      const d = n === i, m = hl({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ x(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${d ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": d,
          "aria-label": c,
          title: m ? `${c} 需要文档任务` : c,
          disabled: m,
          onClick: () => o(i),
          children: [
            /* @__PURE__ */ g(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ g("span", { className: "reader-workspace-tab-label", children: c })
          ]
        },
        i
      );
    }) })
  ] });
}
const gl = {
  markdown: { label: "Markdown", short: "MD", Icon: qo, needsJob: !0 }
}, bl = Or.map(
  (e) => ({ id: e, ...gl[e] })
), yl = {
  // 这个面板叫「AI」而不是「终端」：它是阅读页里**唯一**的 AI 入口。
  //
  // 原来一篇文档有三扇 AI 的门 —— AI 问答面板（自带一套 chunking + retrieval +
  // LLM 的 Rust 栈）、这个终端（agent 进程）、阅读地图（渲染 agent 产物）——
  // 三者互不知道对方存在，两套 LLM 栈零共用代码。15 本书上的用量是
  // 4 / 17 / 1，留用得最多且能力是超集的那个。
  //
  // id 仍是 terminal：改 id 会让所有存着的面板恢复记录失效。
  terminal: {
    label: "AI",
    short: "AI",
    Icon: Go,
    adapterKey: "renderReaderTerminal",
    slot: "terminal",
    ariaLabel: "AI（agent 终端）",
    keepMounted: !0
  }
}, ro = Fr.map(
  (e) => ({ id: e, ...yl[e] })
);
function vl(e) {
  return [
    ...bl.map(({ id: t, label: n, short: r, Icon: o, needsJob: a }) => ({
      id: t,
      label: n,
      short: r,
      Icon: o,
      needsJob: a
    })),
    ...ro.filter((t) => e(t.adapterKey)).map(({ id: t, label: n, short: r, Icon: o }) => ({
      id: t,
      label: n,
      short: r,
      Icon: o,
      needsJob: !1
    }))
  ];
}
function Sl() {
  const e = se();
  return vl((t) => typeof (e == null ? void 0 : e[t]) == "function");
}
function wl(e) {
  const t = $e(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), l = Sl();
  return n ? /* @__PURE__ */ x("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ g("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: l.map(({ id: i, label: c, Icon: u, needsJob: d }) => {
      const m = n === i, h = d && o, b = r == null ? void 0 : r[i];
      return /* @__PURE__ */ x(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": m,
          className: `reader-assistant-dock-tab${m ? " is-active" : ""}`,
          title: h ? `${c} 需打开任务阅读` : c,
          disabled: h,
          onClick: () => a(i),
          children: [
            /* @__PURE__ */ g(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
            /* @__PURE__ */ g("span", { className: "reader-assistant-dock-tab-label", children: c }),
            b ? /* @__PURE__ */ g("span", { className: "reader-assistant-dock-badge", children: b }) : null
          ]
        },
        i
      );
    }) }),
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ g(pn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ g("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: l.map(({ id: i, label: c, short: u, Icon: d, needsJob: m }) => {
    const h = m && o, b = r == null ? void 0 : r[i];
    return /* @__PURE__ */ x(
      "button",
      {
        type: "button",
        className: "reader-assistant-rail-button",
        "aria-label": `打开${c}`,
        title: h ? `${c} 需打开任务阅读` : c,
        disabled: h,
        onClick: () => a(i),
        children: [
          /* @__PURE__ */ g(d, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { children: u }),
          b ? /* @__PURE__ */ g("span", { className: "reader-assistant-dock-badge", children: b }) : null
        ]
      },
      i
    );
  }) });
}
function Pl(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Rl(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Il(e) {
  return e / 100 * window.innerHeight;
}
function Tl(e) {
  return e / 100 * window.innerWidth;
}
function El(e) {
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
  const [o, a] = El(n);
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
      r = Rl(t, o);
      break;
    }
    case "em": {
      r = Pl(t, o);
      break;
    }
    case "vh": {
      r = Il(o);
      break;
    }
    case "vw": {
      r = Tl(o);
      break;
    }
  }
  return r;
}
function me(e) {
  return parseFloat(e.toFixed(3));
}
function Ye({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function rn(e) {
  const { panels: t } = e, n = Ye({ group: e });
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
    let l;
    if (a.defaultSize !== void 0) {
      const u = lt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      l = me(u / n * 100);
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
    let c = 100;
    if (a.maxSize !== void 0) {
      const u = lt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = me(u / n * 100);
    }
    return {
      groupResizeBehavior: a.groupResizeBehavior,
      collapsedSize: s,
      collapsible: a.collapsible === !0,
      defaultSize: l,
      disabled: a.disabled,
      minSize: i,
      maxSize: c,
      panelId: r.id
    };
  });
}
function ne(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function on(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? kl : Ml
  );
}
function kl(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Ml(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function oo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function ao(e, t) {
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
function Al({
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
    const { x: l, y: i } = ao(r, s), c = e === "horizontal" ? l : i;
    c < a && (a = c, o = s);
  }
  return ne(o, "No rect found"), o;
}
let St;
function Nl() {
  return St === void 0 && (typeof matchMedia == "function" ? St = !!matchMedia("(pointer:coarse)").matches : St = !1), St;
}
function so(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = on(
    n,
    Array.from(t.children).filter(oo).map((b) => ({ element: b }))
  ).map(({ element: b }) => b), s = [];
  let l = !1, i = !1, c = -1, u = -1, d = 0, m, h = [];
  {
    let b = -1;
    for (const f of a)
      f.hasAttribute("data-panel") && (b++, f.hasAttribute("data-disabled") || (d++, c === -1 && (c = b), u = b));
  }
  if (d > 1) {
    let b = -1;
    for (const f of a)
      if (f.hasAttribute("data-panel")) {
        b++;
        const v = r.find(
          (y) => y.element === f
        );
        if (v) {
          if (m) {
            const y = m.element.getBoundingClientRect(), w = f.getBoundingClientRect();
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
                  const k = h[0], A = Al({
                    orientation: n,
                    rects: [y, w],
                    targetRect: k.element.getBoundingClientRect()
                  });
                  P = [
                    k,
                    A === y ? S : p
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
              const k = Nl() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < k) {
                const z = k - S.width;
                S = new DOMRect(
                  S.x - z / 2,
                  S.y,
                  S.width + z,
                  S.height
                );
              }
              if (S.height < k) {
                const z = k - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - z / 2,
                  S.width,
                  S.height + z
                );
              }
              const A = b <= c || b > u;
              !l && !A && s.push({
                group: e,
                groupSize: Ye({ group: e }),
                panels: [m, v],
                separator: "width" in p ? void 0 : p,
                rect: S
              }), l = !1;
            }
          }
          i = !1, m = v, h = [];
        }
      } else if (f.hasAttribute("data-separator")) {
        f.ariaDisabled !== null && (l = !0);
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
class io {
  constructor() {
    Fn(this, Ae, {});
  }
  addListener(t, n) {
    const r = ot(this, Ae)[t];
    return r === void 0 ? ot(this, Ae)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = ot(this, Ae)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let o = !1, a = null;
        const s = Array.from(r);
        for (let l = 0; l < s.length; l++) {
          const i = s[l];
          try {
            i.call(null, n);
          } catch (c) {
            a === null && (o = !0, a = c);
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
    const r = ot(this, Ae)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ae = new WeakMap();
let Ge = {
  cursorFlags: 0,
  state: "inactive"
};
const Pn = new io();
function xe() {
  return Ge;
}
function _l(e) {
  return Pn.addListener("change", e);
}
function Ll(e) {
  const t = Ge, n = { ...Ge };
  n.cursorFlags = e, Ge = n, Pn.emit("change", {
    prev: t,
    next: n
  });
}
function Ke(e) {
  const t = Ge;
  Ge = e, Pn.emit("change", {
    prev: t,
    next: e
  });
}
const Cl = (e) => e, Vt = () => {
}, lo = 1, co = 2, uo = 4, fo = 8, ar = 3, sr = 12;
let wt;
function ir() {
  return wt === void 0 && (wt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (wt = !0)), wt;
}
function Dl({
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
        if (e && ir()) {
          const a = (e & lo) !== 0, s = (e & co) !== 0, l = (e & uo) !== 0, i = (e & fo) !== 0;
          if (a)
            return l ? "se-resize" : i ? "ne-resize" : "e-resize";
          if (s)
            return l ? "sw-resize" : i ? "nw-resize" : "w-resize";
          if (l)
            return "s-resize";
          if (i)
            return "n-resize";
        }
        break;
      }
    }
    return ir() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
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
  const r = xe();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Dl({
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
const mo = new io();
function xl(e) {
  Se = new Map(Se), Se.delete(e);
}
function cr(e, t) {
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
function je() {
  return Se;
}
function In(e, t) {
  return mo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function ke(e, t, n) {
  const r = Se.get(e);
  Se = new Map(Se), Se.set(e, t), mo.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function ho(e) {
  const t = xe();
  let n = !1;
  switch (t.state) {
    case "active":
      Ke({
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
function ur(e) {
  e.defaultPrevented || ho(e.currentTarget);
}
function zl(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = ao(n, a.rect);
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
function Ol(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Fl(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: mr(e),
    b: mr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ne(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: fr(dr(n.a)),
    b: fr(dr(n.b))
  };
  if (o.a === o.b) {
    const a = r.childNodes, s = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let l = a.length;
    for (; l--; ) {
      const i = a[l];
      if (i === s.a) return 1;
      if (i === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
const $l = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function jl(e) {
  const t = getComputedStyle(po(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Bl(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || jl(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || $l.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function dr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ne(n, "Missing node"), Bl(n)) return n;
  }
  return null;
}
function fr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function mr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = po(e);
  return t;
}
function po(e) {
  const { parentNode: t } = e;
  return Ol(t) ? t.host : t;
}
function Ul(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Hl({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!oo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Fl(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Ul(r.getBoundingClientRect(), t))
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
    const a = so(o), s = zl(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Hl({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Wl(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function fe(e, t, n = 0) {
  return Math.abs(me(e) - me(t)) <= n;
}
function ve(e, t) {
  return fe(e, t) ? 0 : e > t ? 1 : -1;
}
function qe({
  overrideDisabledPanels: e,
  panelConstraints: t,
  prevSize: n,
  size: r
}) {
  const {
    collapsedSize: o = 0,
    collapsible: a,
    disabled: s,
    maxSize: l = 100,
    minSize: i = 0
  } = t;
  if (s && !e)
    return n;
  if (ve(r, i) < 0)
    if (a) {
      const c = (o + i) / 2;
      ve(r, c) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(l, r), r = me(r), r;
}
function mt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (fe(e, 0))
    return t;
  const s = a === "imperative-api", l = Object.values(t), i = Object.values(o), c = [...l], [u, d] = r;
  ne(u != null, "Invalid first pivot index"), ne(d != null, "Invalid second pivot index");
  let m = 0;
  switch (a) {
    case "keyboard": {
      {
        const f = e < 0 ? d : u, v = n[f];
        ne(
          v,
          `Panel constraints not found for index ${f}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: w,
          minSize: P = 0
        } = v;
        if (w) {
          const p = l[f];
          if (ne(
            p != null,
            `Previous layout not found for panel index ${f}`
          ), fe(p, y)) {
            const S = P - p;
            ve(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const f = e < 0 ? u : d, v = n[f];
        ne(
          v,
          `No panel constraints found for index ${f}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: w,
          minSize: P = 0
        } = v;
        if (w) {
          const p = l[f];
          if (ne(
            p != null,
            `Previous layout not found for panel index ${f}`
          ), fe(p, P)) {
            const S = p - y;
            ve(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const f = e < 0 ? d : u, v = n[f];
      ne(
        v,
        `Panel constraints not found for index ${f}`
      );
      const y = l[f], { collapsible: w, collapsedSize: P, minSize: p } = v;
      if (w && ve(y, p) < 0)
        if (e > 0) {
          const S = p - P, k = S / 2, A = y + e;
          ve(A, p) < 0 && (e = ve(e, k) <= 0 ? 0 : S);
        } else {
          const S = p - P, k = 100 - S / 2, A = y - e;
          ve(A, p) < 0 && (e = ve(100 + e, k) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const f = e < 0 ? 1 : -1;
    let v = e < 0 ? d : u, y = 0;
    for (; ; ) {
      const P = l[v];
      ne(
        P != null,
        `Previous layout not found for panel index ${v}`
      );
      const p = qe({
        overrideDisabledPanels: s,
        panelConstraints: n[v],
        prevSize: P,
        size: 100
      }) - P;
      if (y += p, v += f, v < 0 || v >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(y));
    e = e < 0 ? 0 - w : w;
  }
  {
    let f = e < 0 ? u : d;
    for (; f >= 0 && f < n.length; ) {
      const v = Math.abs(e) - Math.abs(m), y = l[f];
      ne(
        y != null,
        `Previous layout not found for panel index ${f}`
      );
      const w = y - v, P = qe({
        overrideDisabledPanels: s,
        panelConstraints: n[f],
        prevSize: y,
        size: w
      });
      if (!fe(y, P) && (m += y - P, c[f] = P, m.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? f-- : f++;
    }
  }
  if (Wl(i, c))
    return o;
  {
    const f = e < 0 ? d : u, v = l[f];
    ne(
      v != null,
      `Previous layout not found for panel index ${f}`
    );
    const y = v + m, w = qe({
      overrideDisabledPanels: s,
      panelConstraints: n[f],
      prevSize: v,
      size: y
    });
    if (c[f] = w, !fe(w, y)) {
      let P = y - w, p = e < 0 ? d : u;
      for (; p >= 0 && p < n.length; ) {
        const S = c[p];
        ne(
          S != null,
          `Previous layout not found for panel index ${p}`
        );
        const k = S + P, A = qe({
          overrideDisabledPanels: s,
          panelConstraints: n[p],
          prevSize: S,
          size: k
        });
        if (fe(S, A) || (P -= A - S, c[p] = A), fe(P, 0))
          break;
        e > 0 ? p-- : p++;
      }
    }
  }
  const h = Object.values(c).reduce(
    (f, v) => v + f,
    0
  );
  if (!fe(h, 100, 0.1))
    return o;
  const b = Object.keys(o);
  return c.reduce((f, v, y) => (f[b[y]] = v, f), {});
}
function ze(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || ve(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Oe({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], o = r.reduce(
    (l, i) => l + i,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((l) => `${l}%`).join(", ")}`
    );
  if (!fe(o, 100) && r.length > 0)
    for (let l = 0; l < t.length; l++) {
      const i = r[l];
      ne(i != null, `No layout data found for index ${l}`);
      const c = 100 / o * i;
      r[l] = c;
    }
  let a = 0;
  for (let l = 0; l < t.length; l++) {
    const i = n[l];
    ne(i != null, `No layout data found for index ${l}`);
    const c = r[l];
    ne(c != null, `No layout data found for index ${l}`);
    const u = qe({
      overrideDisabledPanels: !0,
      panelConstraints: t[l],
      prevSize: i,
      size: c
    });
    c != u && (a += c - u, r[l] = u);
  }
  if (!fe(a, 0))
    for (let l = 0; l < t.length; l++) {
      const i = r[l];
      ne(i != null, `No layout data found for index ${l}`);
      const c = i + a, u = qe({
        overrideDisabledPanels: !0,
        panelConstraints: t[l],
        prevSize: i,
        size: c
      });
      if (i !== u && (a -= u - i, r[l] = u, fe(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((l, i, c) => (l[s[c]] = i, l), {});
}
function go({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = je();
    for (const [
      c,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: d,
        layout: m,
        groupSize: h,
        separatorToPanels: b
      }
    ] of i)
      if (c.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: d,
          group: c,
          groupSize: h,
          layout: m,
          separatorToPanels: b
        };
    throw Error(`Group ${e} not found`);
  }, r = () => {
    const i = n().derivedPanelConstraints.find(
      (c) => c.panelId === t
    );
    if (i !== void 0)
      return i;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, o = () => {
    const i = n().group.panels.find((c) => c.id === t);
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
    panels: c,
    prevLayout: u,
    derivedPanelConstraints: d
  }) => {
    const m = a(), h = c.findIndex((v) => v.id === t), b = h === 0, f = h === c.length - 1;
    if (f && i < m && (b || c.slice(0, h).every((v, y) => {
      const w = d[y];
      return (w == null ? void 0 : w.collapsible) && fe(w.collapsedSize, u[w.panelId]);
    }))) {
      const v = c.slice(0, h).reduce((y, w) => y + u[w.id], 0);
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
  }, l = (i) => {
    const c = a();
    if (i === c)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      group: m,
      groupSize: h,
      layout: b,
      separatorToPanels: f
    } = n(), v = s({
      nextSize: i,
      panels: m.panels,
      prevLayout: b,
      derivedPanelConstraints: d
    }), y = Oe({
      layout: v,
      panelConstraints: d
    });
    ze(b, y) || ke(m, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: h,
      layout: y,
      separatorToPanels: f
    });
  };
  return {
    collapse: () => {
      const { collapsible: i, collapsedSize: c } = r(), { mutableValues: u } = o(), d = a();
      i && d !== c && (u.expandToSize = d, l(c));
    },
    expand: () => {
      const { collapsible: i, collapsedSize: c, minSize: u } = r(), { mutableValues: d } = o(), m = a();
      if (i && m === c) {
        let h = d.expandToSize ?? u;
        h === 0 && (h = 1), l(h);
      }
    },
    getSize: () => {
      const { group: i } = n(), c = a(), { element: u } = o(), d = i.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: c,
        inPixels: d
      };
    },
    isCollapsed: () => {
      const { collapsible: i, collapsedSize: c } = r(), u = a();
      return i && fe(c, u);
    },
    resize: (i) => {
      const { group: c } = n(), { element: u } = o(), d = Ye({ group: c }), m = lt({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), h = me(m / d * 100);
      l(h);
    }
  };
}
function hr(e) {
  if (e.defaultPrevented)
    return;
  const t = je();
  Tn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = go({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Pt(e) {
  const t = je();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function bo({
  groupId: e
}) {
  const t = () => {
    const n = je();
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
        layout: l,
        separatorToPanels: i
      } = t(), c = Oe({
        layout: n,
        panelConstraints: o
      });
      return r ? l : (ze(l, c) || ke(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: i
      }), c);
    }
  };
}
function _e(e, t) {
  const n = Pt(e), r = Ne(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ne(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ne(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), l = bo({ groupId: n.id }).getLayout(), i = mt({
    delta: t,
    initialLayout: l,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: l,
    trigger: "keyboard"
  }), c = Oe({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  ze(l, c) || ke(
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
function pr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Pt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && _e(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && _e(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && _e(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && _e(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), _e(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Pt(t), o = Ne(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: l } = o, i = r.separators.find(
          (m) => m.element === t
        );
        ne(i, "Matching separator not found");
        const c = l.get(i);
        ne(c, "Matching panels not found");
        const u = c[0], d = a.find(
          (m) => m.panelId === u.id
        );
        if (ne(d, "Panel metadata not found"), d.collapsible) {
          const m = s[u.id], h = d.collapsedSize === m ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          _e(t, h - m);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Pt(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        ne(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), _e(t, -100);
        break;
      }
    }
}
function gr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = je(), n = Tn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Ke({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function yo({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: o,
  pointerDownAtPoint: a,
  prevCursorFlags: s
}) {
  let l = 0;
  n.forEach((c) => {
    const { group: u, groupSize: d } = c, { orientation: m, panels: h } = u, { disableCursor: b } = u.mutableState;
    let f = 0;
    a ? m === "horizontal" ? f = (t.clientX - a.x) / d * 100 : f = (t.clientY - a.y) / d * 100 : m === "horizontal" ? f = t.clientX < 0 ? -100 : 100 : f = t.clientY < 0 ? -100 : 100;
    const v = r.get(u), y = o.get(u);
    if (!v || !y)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: P,
      groupSize: p,
      layout: S,
      separatorToPanels: k
    } = y;
    if (P && S && k) {
      const A = mt({
        delta: f,
        initialLayout: v,
        panelConstraints: P,
        pivotIndices: c.panels.map((z) => h.indexOf(z)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (ze(A, S)) {
        if (f !== 0 && !b)
          switch (m) {
            case "horizontal": {
              l |= f < 0 ? lo : co;
              break;
            }
            case "vertical": {
              l |= f < 0 ? uo : fo;
              break;
            }
          }
      } else
        ke(c.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: P,
          groupSize: p,
          layout: A,
          separatorToPanels: k
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & ar : i |= l & ar, t.movementY === 0 ? i |= s & sr : i |= l & sr, Ll(i), Rn(e);
}
function br(e) {
  const t = je(), n = xe();
  switch (n.state) {
    case "active":
      yo({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function yr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = xe(), n = je();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Ke({
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
      yo({
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
      a.length === 0 ? t.state !== "inactive" && Ke({
        cursorFlags: 0,
        state: "inactive"
      }) : Ke({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Rn(e.currentTarget);
      break;
    }
  }
}
function vr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (xe().state) {
      case "hover":
        Ke({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Sr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || ho(e.currentTarget) && e.preventDefault();
}
function wr(e) {
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
function Vl(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = Ye({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, l = {
    asPercentage: me(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = l, r.onResize(l, r.id, s);
}
function Jl(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function ql({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const l = /* @__PURE__ */ new Map(), i = [];
  for (const d of e.panels) {
    const m = r[d.id] ?? 0;
    switch (d.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const h = m / 100 * n, b = me(
          h / t * 100
        );
        l.set(d.id, b), o += b;
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
  const c = 100 - o, u = { ...r };
  if (l.forEach((d, m) => {
    u[m] = d;
  }), a > 0)
    for (const d of i) {
      const m = r[d] ?? 0;
      u[d] = me(
        m / a * c
      );
    }
  else {
    const d = me(
      c / i.length
    );
    for (const m of i)
      u[m] = d;
  }
  return u;
}
function Gl(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const We = /* @__PURE__ */ new Map();
function Kl(e) {
  let t = !0;
  ne(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((b) => {
    for (const f of b) {
      const { borderBoxSize: v, target: y } = f;
      if (y === e.element) {
        if (t) {
          const w = Ye({ group: e });
          if (w === 0)
            return;
          const P = Ne(e.id);
          if (!P)
            return;
          const p = rn(e), S = P.defaultLayoutDeferred ? wr(p) : P.layout, k = ql({
            group: e,
            nextGroupSize: w,
            prevGroupSize: P.groupSize,
            prevLayout: S
          }), A = Oe({
            layout: k,
            panelConstraints: p
          });
          if (!P.defaultLayoutDeferred && ze(P.layout, A) && Jl(
            P.derivedPanelConstraints,
            p
          ) && P.groupSize === w)
            return;
          ke(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: p,
            groupSize: w,
            layout: A,
            separatorToPanels: P.separatorToPanels
          });
        }
      } else
        Vl(e, y, v);
    }
  });
  a.observe(e.element), e.panels.forEach((b) => {
    ne(
      !r.has(b.id),
      `Panel ids must be unique; id "${b.id}" was used more than once`
    ), r.add(b.id), b.onResize && a.observe(b.element);
  });
  const s = Ye({ group: e }), l = rn(e), i = e.panels.map(({ id: b }) => b).join(",");
  let c = e.mutableState.defaultLayout;
  c && (Gl(e.panels, c) || (c = void 0));
  const u = e.mutableState.layouts[i] ?? c ?? wr(l), d = Oe({
    layout: u,
    panelConstraints: l
  }), m = e.element.ownerDocument;
  We.set(
    m,
    (We.get(m) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return so(e).forEach((b) => {
    b.separator && h.set(b.separator, b.panels);
  }), ke(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: l,
    groupSize: s,
    layout: d,
    separatorToPanels: h
  }), e.separators.forEach((b) => {
    ne(
      !o.has(b.id),
      `Separator ids must be unique; id "${b.id}" was used more than once`
    ), o.add(b.id), b.element.addEventListener("keydown", pr);
  }), We.get(m) === 1 && (m.addEventListener("contextmenu", ur, !0), m.addEventListener("dblclick", hr, !0), m.addEventListener("pointerdown", gr, !0), m.addEventListener("pointerleave", br), m.addEventListener("pointermove", yr), m.addEventListener("pointerout", vr), m.addEventListener("pointerup", Sr, !0)), function() {
    t = !1, We.set(
      m,
      Math.max(0, (We.get(m) ?? 0) - 1)
    ), xl(e), e.separators.forEach((b) => {
      b.element.removeEventListener("keydown", pr);
    }), We.get(m) || (m.removeEventListener(
      "contextmenu",
      ur,
      !0
    ), m.removeEventListener(
      "dblclick",
      hr,
      !0
    ), m.removeEventListener(
      "pointerdown",
      gr,
      !0
    ), m.removeEventListener("pointerleave", br), m.removeEventListener("pointermove", yr), m.removeEventListener("pointerout", vr), m.removeEventListener("pointerup", Sr, !0)), a.disconnect();
  };
}
function Zl() {
  const [e, t] = N({}), n = F(() => t({}), []);
  return [e, n];
}
function En(e) {
  const t = kr();
  return `${e ?? t}`;
}
const Be = typeof window < "u" ? Fe : $;
function ct(e) {
  const t = M(e);
  return Be(() => {
    t.current = e;
  }, [e]), F(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function kn(...e) {
  return ct((t) => {
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
  const t = M({ ...e });
  return Be(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const vo = un(null);
function Yl(e, t) {
  const n = M({
    getLayout: () => ({}),
    setLayout: Cl
  });
  fn(t, () => n.current, []), Be(() => {
    Object.assign(
      n.current,
      bo({ groupId: e })
    );
  });
}
function So({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: o,
  elementRef: a,
  groupRef: s,
  id: l,
  onLayoutChange: i,
  onLayoutChanged: c,
  orientation: u = "horizontal",
  resizeTargetMinimumSize: d = {
    coarse: 20,
    fine: 10
  },
  style: m,
  ...h
}) {
  const b = M({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), f = ct((I) => {
    ze(b.current.onLayoutChange, I) || (b.current.onLayoutChange = I, i == null || i(I));
  }), v = ct(
    (I, T) => {
      ze(b.current.onLayoutChanged, I) || (b.current.onLayoutChanged = I, c == null || c(I, { isUserInteraction: T }));
    }
  ), y = En(l), w = M(null), [P, p] = Zl(), S = M({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), k = kn(w, a);
  Yl(y, s);
  const A = ct(
    (I, T) => {
      const R = xe(), E = cr(I), O = Ne(I);
      if (O) {
        let U = !1;
        switch (R.state) {
          case "active": {
            U = R.hitRegions.some(
              (J) => J.group === E
            );
            break;
          }
        }
        return {
          flexGrow: O.layout[T] ?? 1,
          pointerEvents: U ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), z = Mn({
    defaultLayout: n,
    disableCursor: r
  }), D = Q(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: A,
      id: y,
      orientation: u,
      registerPanel: (I) => {
        const T = S.current;
        return T.panels = on(u, [
          ...T.panels,
          I
        ]), p(), () => {
          T.panels = T.panels.filter(
            (R) => R !== I
          ), p();
        };
      },
      registerSeparator: (I) => {
        const T = S.current;
        return T.separators = on(u, [
          ...T.separators,
          I
        ]), p(), () => {
          T.separators = T.separators.filter(
            (R) => R !== I
          ), p();
        };
      },
      updatePanelProps: (I, { disabled: T }) => {
        const R = S.current.panels.find(
          (U) => U.id === I
        );
        R && (R.panelConstraints.disabled = T);
        const E = cr(y), O = Ne(y);
        E && O && ke(E, {
          ...O,
          derivedPanelConstraints: rn(E)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: R
      }) => {
        const E = S.current.separators.find(
          (O) => O.id === I
        );
        E && (E.disabled = T, E.disableDoubleClick = R);
      }
    }),
    [A, y, p, u, z]
  ), C = M(null);
  return Be(() => {
    const I = w.current;
    if (I === null)
      return;
    const T = S.current;
    let R;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === T.panels.length) {
      R = {};
      for (const Y of T.panels) {
        const _ = z.defaultLayout[Y.id];
        _ !== void 0 && (R[Y.id] = _);
      }
    }
    const E = {
      disabled: !!o,
      element: I,
      id: y,
      mutableState: {
        defaultLayout: R,
        disableCursor: !!z.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    C.current = E;
    const O = Kl(E), { defaultLayoutDeferred: U, derivedPanelConstraints: J, layout: G } = Ne(E.id, !0);
    !U && J.length > 0 && (f(G), v(G, !1));
    const j = In(y, (Y) => {
      const { defaultLayoutDeferred: _, derivedPanelConstraints: V, layout: ee } = Y.next;
      if (_ || V.length === 0)
        return;
      const ae = E.panels.map(({ id: B }) => B).join(",");
      E.mutableState.layouts[ae] = ee, V.forEach((B) => {
        if (B.collapsible) {
          const { layout: te } = Y.prev ?? {};
          if (te) {
            const ye = fe(
              B.collapsedSize,
              ee[B.panelId]
            ), pe = fe(
              B.collapsedSize,
              te[B.panelId]
            );
            ye && !pe && (E.mutableState.expandedPanelSizes[B.panelId] = te[B.panelId]);
          }
        }
      });
      const H = xe().state !== "active";
      f(ee), H && v(ee, Y.isUserInteraction);
    });
    return () => {
      C.current = null, O(), j();
    };
  }, [
    o,
    y,
    v,
    f,
    u,
    P,
    z
  ]), $(() => {
    const I = C.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ g(vo.Provider, { value: D, children: /* @__PURE__ */ g(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": y,
      id: y,
      ref: k,
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
So.displayName = "Group";
function An() {
  const e = dn(vo);
  return ne(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Xl(e, t) {
  const { id: n } = An(), r = M({
    collapse: Vt,
    expand: Vt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Vt
  });
  fn(t, () => r.current, []), Be(() => {
    Object.assign(
      r.current,
      go({ groupId: n, panelId: e })
    );
  });
}
function an({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: r = !1,
  defaultSize: o,
  disabled: a,
  elementRef: s,
  groupResizeBehavior: l = "preserve-relative-size",
  id: i,
  maxSize: c = "100%",
  minSize: u = "0%",
  onResize: d,
  panelRef: m,
  style: h,
  ...b
}) {
  const f = !!i, v = En(i), y = Mn({
    disabled: a
  }), w = M(null), P = kn(w, s), {
    getPanelStyles: p,
    id: S,
    orientation: k,
    registerPanel: A,
    updatePanelProps: z
  } = An(), D = d !== null, C = ct(
    (E, O, U) => {
      d == null || d(E, i, U);
    }
  );
  Be(() => {
    const E = w.current;
    if (E !== null) {
      const O = {
        element: E,
        id: v,
        idIsStable: f,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? C : void 0,
        panelConstraints: {
          groupResizeBehavior: l,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: y.disabled,
          maxSize: c,
          minSize: u
        }
      };
      return A(O);
    }
  }, [
    l,
    n,
    r,
    o,
    D,
    v,
    f,
    c,
    u,
    C,
    A,
    y
  ]), $(() => {
    z(v, { disabled: a });
  }, [a, v, z]), Xl(v, m);
  const I = () => {
    const E = p(S, v);
    if (E)
      return JSON.stringify(E);
  }, T = Lt(
    (E) => In(S, E),
    I,
    I
  );
  let R;
  return T ? R = JSON.parse(T) : o !== void 0 ? R = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : R = { flexGrow: 1 }, /* @__PURE__ */ g(
    "div",
    {
      ...b,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": v,
      id: v,
      ref: P,
      style: {
        ...Ql,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...R
      },
      children: /* @__PURE__ */ g(
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
            touchAction: k === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
an.displayName = "Panel";
const Ql = {
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
function ec({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let o, a;
  const s = e[n], l = t.find(
    (i) => i.panelId === n
  );
  if (l) {
    const i = l.maxSize, c = l.collapsible ? l.collapsedSize : l.minSize, u = [r, r + 1];
    a = Oe({
      layout: mt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Oe({
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
function wo({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...l
}) {
  const i = En(a), c = Mn({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = N({}), [m, h] = N("inactive"), [b, f] = N(!1), v = M(null), y = kn(v, o), {
    disableCursor: w,
    id: P,
    orientation: p,
    registerSeparator: S,
    updateSeparatorProps: k
  } = An(), A = p === "horizontal" ? "vertical" : "horizontal";
  Be(() => {
    const C = v.current;
    if (C !== null) {
      const I = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: C,
        id: i
      }, T = S(I), R = _l(
        (O) => {
          h(
            O.next.state !== "inactive" && O.next.hitRegions.some(
              (U) => U.separator === I
            ) ? O.next.state : "inactive"
          );
        }
      ), E = In(
        P,
        (O) => {
          const { derivedPanelConstraints: U, layout: J, separatorToPanels: G } = O.next, j = G.get(I);
          if (j) {
            const Y = j[0], _ = j.indexOf(Y);
            d(
              ec({
                layout: J,
                panelConstraints: U,
                panelId: Y.id,
                panelIndex: _
              })
            );
          }
        }
      );
      return () => {
        R(), E(), T();
      };
    }
  }, [P, i, S, c]), $(() => {
    k(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, k]);
  let z;
  n && !w && (z = "not-allowed");
  let D;
  if (n)
    D = "disabled";
  else
    switch (m) {
      case "active": {
        D = "active";
        break;
      }
      default:
        b ? D = "focus" : D = m;
    }
  return /* @__PURE__ */ g(
    "div",
    {
      ...l,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": A,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": D,
      "data-testid": i,
      id: i,
      onBlur: () => f(!1),
      onFocus: () => f(!0),
      ref: y,
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
wo.displayName = "Separator";
const Nn = 30, _n = 65, ht = 50, tc = 100 - _n, nc = 100 - Nn;
function rc(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(_n, Math.max(Nn, t)) : ht;
}
function Ln(e) {
  return 100 - e;
}
function Ve(e) {
  return `${e}%`;
}
const Cn = "reader-document", pt = "reader-assistant", Po = "retainpdf.reader.ai-split-layout.v1", oc = {
  [Cn]: Ln(ht),
  [pt]: ht
};
function Dn(e) {
  const t = rc(e == null ? void 0 : e[pt]);
  return {
    [Cn]: Ln(t),
    [pt]: t
  };
}
function ac() {
  try {
    const e = JSON.parse(localStorage.getItem(Po) || "null");
    return Dn(e);
  } catch {
    return oc;
  }
}
function sc(e) {
  try {
    localStorage.setItem(Po, JSON.stringify(Dn(e)));
  } catch {
  }
}
function Jt(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Dn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[pt]}vw`
  );
}
function ic() {
  const e = M(null), [t] = N(ac);
  Fe(() => {
    const o = e.current;
    return Jt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = F((o) => {
    Jt(e.current, o);
  }, []), r = F((o, a) => {
    Jt(e.current, o), a.isUserInteraction && sc(o);
  }, []);
  return /* @__PURE__ */ x(
    So,
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
        /* @__PURE__ */ g(
          an,
          {
            id: Cn,
            defaultSize: Ve(Ln(ht)),
            minSize: Ve(tc),
            maxSize: Ve(nc)
          }
        ),
        /* @__PURE__ */ g(
          wo,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ g("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ g(
          an,
          {
            id: pt,
            defaultSize: Ve(ht),
            minSize: Ve(Nn),
            maxSize: Ve(_n)
          }
        )
      ]
    }
  );
}
function lc({
  id: e,
  open: t,
  ariaLabel: n,
  className: r = "",
  keepMounted: o = !1,
  onClose: a,
  toolbar: s,
  children: l
}) {
  return $(() => {
    if (!t) return;
    const i = (c) => {
      var d;
      if (c.key !== "Escape") return;
      const u = c.target;
      (d = u == null ? void 0 : u.closest) != null && d.call(u, "textarea, input, select, [contenteditable='true']") || (c.preventDefault(), a());
    };
    return window.addEventListener("keydown", i), () => window.removeEventListener("keydown", i);
  }, [t, a]), !t && !o ? null : /* @__PURE__ */ x(
    "aside",
    {
      id: e,
      className: `reader-notes-panel reader-notes-panel--workspace${s ? " has-panel-toolbar" : ""} ${r}`.trim(),
      "aria-label": n,
      role: "dialog",
      "aria-modal": "false",
      "data-hidden": t ? void 0 : "",
      inert: t ? void 0 : !0,
      "aria-hidden": t ? void 0 : !0,
      children: [
        s ? /* @__PURE__ */ g("div", { className: "reader-notes-panel-toolbar", children: s }) : null,
        /* @__PURE__ */ g("div", { className: "reader-notes-panel-body", children: l })
      ]
    }
  );
}
function cc({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = N(!1);
  if ($(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ x("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ x("span", { className: "reader-error-notice-text", children: [
      o.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    /* @__PURE__ */ g(
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
function uc({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ g(cc, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ x(_t, { children: [
    e ? /* @__PURE__ */ g("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ x("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ g("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ g("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ g(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ g("div", { className: "reader-react-error", role: "alert", children: n }) : null
  ] });
}
function dc(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function fc() {
  const [e, t] = N(!1), n = kr(), r = M(null);
  return $(() => {
    if (!e) return;
    const o = (s) => {
      const l = r.current;
      l && s.target instanceof Node && !l.contains(s.target) && t(!1);
    }, a = (s) => {
      s.key === "Escape" && (s.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", o), window.addEventListener("keydown", a), () => {
      document.removeEventListener("mousedown", o), window.removeEventListener("keydown", a);
    };
  }, [e]), $(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || dc(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ x("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ g(Ko, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ x(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ x("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ g("strong", { children: "快捷键" }),
            /* @__PURE__ */ g(
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
          /* @__PURE__ */ g("div", { className: "reader-react-shortcuts-body", children: mi.map((o) => /* @__PURE__ */ x("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ g("h3", { children: o.title }),
            /* @__PURE__ */ g("ul", { children: o.items.map((a) => /* @__PURE__ */ x("li", { children: [
              /* @__PURE__ */ g("kbd", { children: a.keys }),
              /* @__PURE__ */ g("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ g("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const mc = ["source", "sideBySide", "translated"], hc = { source: "", translated: "", sideBySide: "" };
function pc(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Rt(e.sourceUrl), n = Rt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return wa({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function gc(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = Q(
    () => e ? pc(e) : hc,
    [e]
  ), o = Q(
    () => mc.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = F(async (s) => {
    if (!e) return;
    const l = Rt(r[s]);
    if (!(!l || t.has(s)))
      try {
        const i = e.jobId ? Sa(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Pa(
          e.fetchProtected,
          l,
          i,
          i,
          null,
          (c) => n((u) => {
            const d = new Set(u);
            return c ? d.add(s) : d.delete(s), d;
          })
        );
      } catch (i) {
        const c = i instanceof Error ? i.message : "下载失败";
        Ra(c), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const bc = {
  source: Ar,
  sideBySide: Nr,
  translated: _r
}, yc = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function vc(e) {
  const t = $e(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = gc(n), l = M(null);
  return $(() => {
    const i = () => {
      var d;
      (d = l.current) != null && d.open && (l.current.open = !1);
    }, c = (d) => {
      l.current && !l.current.contains(d.target) && i();
    }, u = (d) => {
      d.key === "Escape" && i();
    };
    return document.addEventListener("pointerdown", c), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", c), document.removeEventListener("keydown", u);
    };
  }, []), /* @__PURE__ */ x("details", { ref: l, className: "reader-download-actions", children: [
    /* @__PURE__ */ x("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ g(Zo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ g(Yo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const c = _o[i], u = Rt(r[i]), d = a.has(i), m = !!u && !d, h = m ? "" : Lo(i, r), b = bc[i];
      return /* @__PURE__ */ x(
        "button",
        {
          type: "button",
          id: `reader-download-${i}`,
          className: `reader-download-action${d ? " is-busy" : ""}`,
          disabled: !m,
          "aria-label": m ? `下载${c.label}` : h,
          onClick: () => {
            l.current && (l.current.open = !1), s(i);
          },
          children: [
            /* @__PURE__ */ g(b, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ x("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ x("span", { className: "reader-download-action-label", children: [
                yc[i],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ g("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
const Sc = "retainpdf:reader:bookmarks:v1:", wc = 200;
function xn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ro(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Sc}${t}` : "";
}
function Pc(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Nt(e, t = xn()) {
  const n = Ro(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Pc(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function sn(e, t, n) {
  const r = Ro(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, wc);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Rc(e, t, n = "", { storage: r = xn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Nt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((l) => l.page === s) ? sn(e, a.filter((l) => l.page !== s), r) : sn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Ic(e, t, n = xn()) {
  return sn(e, Nt(e, n).filter((r) => r.page !== t), n);
}
function Tc(e, t) {
  var r, o, a, s;
  let n = null;
  for (const l of e || []) {
    if (`${(l == null ? void 0 : l.regionType) || ""}` != "heading") continue;
    const i = Number(((r = l.source) == null ? void 0 : r.page) ?? ((o = l.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(i) || i > t) continue;
    const c = `${((a = l.translated) == null ? void 0 : a.text) || l.markdown || ((s = l.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!c) continue;
    const u = Number(l.readingOrder) || 0;
    (!n || i > n.page || i === n.page && u >= n.order) && (n = { page: i, order: u, text: c });
  }
  return n ? n.text.slice(0, 60) : "";
}
function Ec({ filled: e }) {
  return /* @__PURE__ */ g("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ g("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function kc({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => Nt(e)), [l, i] = N(!1), c = M(null);
  if ($(() => {
    s(Nt(e)), i(!1);
  }, [e]), $(() => {
    if (!l) return;
    const m = (b) => {
      c.current && !c.current.contains(b.target) && i(!1);
    }, h = (b) => {
      b.key === "Escape" && i(!1);
    };
    return document.addEventListener("pointerdown", m), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", m), document.removeEventListener("keydown", h);
    };
  }, [l]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), d = a.some((m) => m.page === u);
  return /* @__PURE__ */ x("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: c, children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Rc(e, u, Tc(r, u))),
        children: /* @__PURE__ */ g(Ec, { filled: d })
      }
    ),
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": l,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        disabled: !a.length,
        onClick: () => i((m) => !m),
        children: a.length
      }
    ),
    l && a.length ? /* @__PURE__ */ g("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ g("ol", { className: "reader-bookmark-list", children: a.map((m) => /* @__PURE__ */ x("li", { className: m.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ x(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(m.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ x("span", { className: "reader-bookmark-page", children: [
              "第 ",
              m.page,
              " 页"
            ] }),
            m.label ? /* @__PURE__ */ g("span", { className: "reader-bookmark-label", children: m.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ g(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${m.page} 页的书签`,
          onClick: () => s(Ic(e, m.page)),
          children: "×"
        }
      )
    ] }, m.page)) }) }) : null
  ] });
}
function Mc(e) {
  const t = $e(), n = to(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? gt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), l = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = ms(a), d = a > xr + 1e-3, m = a < kt - 1e-3, h = Je(r, De()), b = h >= kt ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [f, v] = N(!1), [y, w] = N(`${l}`);
  $(() => {
    f || w(`${Math.min(Math.max(l, 1), Math.max(i, 1))}`);
  }, [l, i, f]);
  const P = () => {
    if (v(!1), !c || i <= 0)
      return;
    const p = Number(`${y}`.trim());
    c(Mt(p, i));
  };
  return /* @__PURE__ */ x("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "页码", children: f ? /* @__PURE__ */ x(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (p) => {
          p.preventDefault(), P();
        },
        children: [
          /* @__PURE__ */ g(
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
                p.key === "Escape" && (p.preventDefault(), v(!1), w(`${l}`));
              }
            }
          ),
          /* @__PURE__ */ x("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            i || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": i > 0 ? `跳转页码，当前第 ${l} 页，共 ${i} 页` : "页码",
        title: i > 0 ? "点击输入页码跳转" : void 0,
        disabled: !c || i <= 0,
        onClick: () => {
          !c || i <= 0 || (w(`${l}`), v(!0));
        },
        children: i > 0 ? `${Math.min(l, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ g(
      kc,
      {
        scope: e.bookmarkScope,
        currentPage: l,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    /* @__PURE__ */ x("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ g(
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
      /* @__PURE__ */ x(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${b}`,
          title: b,
          onClick: () => s(h),
          children: [
            u,
            "%"
          ]
        }
      ),
      /* @__PURE__ */ g(
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
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ g(fc, {}) })
  ] });
}
function Pr(e) {
  var t, n;
  return $r(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Ac(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Pr(we(e))
  }));
  $(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Pr(we(e))
    });
  }, [e]), $(() => {
    t.scope === e && xt(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = F((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Nc = () => () => {
}, _c = () => !1;
function Lc() {
  const e = pa(), t = (e == null ? void 0 : e.available) ?? _c, n = Lt((e == null ? void 0 : e.subscribe) ?? Nc, t, t), r = F(() => !!(e != null && e.available() && e.ask()), [e]);
  return { available: n, ask: r };
}
const ln = "download-toast";
function Cc({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ x("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ x("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ g("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ g("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ g("div", { className: "download-toast-track", children: /* @__PURE__ */ g("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ g("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Dc(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Gt.dismiss(ln);
    return;
  }
  Gt.custom(
    () => /* @__PURE__ */ g(Cc, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: ln, duration: 1 / 0 }
  );
}
function xc() {
  const e = F((t) => {
    t && (t.setState = Dc, t.hide = () => Gt.dismiss(ln));
  }, []);
  return /* @__PURE__ */ x(_t, { children: [
    /* @__PURE__ */ g(Wo, { position: "bottom-right" }),
    /* @__PURE__ */ g("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function zc(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : zr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Oc(e, t) {
  return t === null || e !== t;
}
function Io(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
function Fc(e, t) {
  const n = e === t;
  return { open: n, mounted: Io(n) };
}
function $c({
  panel: e,
  active: t,
  context: n
}) {
  var i;
  const r = t === e.id, o = Io(r);
  if (!(e.keepMounted ? o : r)) return null;
  const s = se(), l = (i = s == null ? void 0 : s[e.adapterKey]) == null ? void 0 : i.call(s, { ...n, open: r });
  return l == null ? null : /* @__PURE__ */ g(
    lc,
    {
      id: `reader-${e.id}-panel`,
      open: r,
      ariaLabel: e.ariaLabel,
      keepMounted: e.keepMounted,
      className: "is-pane-right",
      onClose: n.onClose,
      children: l
    }
  );
}
const Rr = { itemId: null, origin: null };
function jc() {
  let e = Rr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Rr : { itemId: n, origin: r };
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
const Ce = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Bc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Uc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Hc = {
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
}, Ir = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Wc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Ir(o ?? a ?? "", Bc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Ir(o ?? a ?? "", Uc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Hc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Vc(e) {
  return Ce(e.translatedBlockText) || Ce(e.translated.text) || Ce(e.source.text);
}
const Jc = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function qc(e) {
  const t = [];
  for (const n of e) {
    if (!Jc(n)) continue;
    const r = Wc(Vc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Gc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Kc = 24, Zc = 60;
function Tr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Kc), o = Math.min(e.length, n + t.length + Zc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Yc(e, t, n = 200) {
  const r = Ce(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const l = Ce(a.translatedBlockText) || Ce(a.translated.text), i = l ? Tr(l, r) : null, c = i ?? Tr(Ce(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
const Xc = [];
function Qc({ open: e, onToggle: t }) {
  return /* @__PURE__ */ x("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ x(Le, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ g(Xo, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ x(Le, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ g(Qo, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { children: "搜索" })
    ] })
  ] });
}
function eu({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r
}) {
  var h, b;
  const o = ((h = $e()) == null ? void 0 : h.regions) ?? Xc, a = ((b = to()) == null ? void 0 : b.currentPage) ?? 1, s = Q(() => qc(o), [o]), l = Gc(s, a), [i, c] = N(""), u = Q(() => Yc(o, i), [o, i]), d = M(null), m = M(null);
  return $(() => {
    var f, v, y;
    e === "search" ? (f = d.current) == null || f.focus() : (y = (v = m.current) == null ? void 0 : v.querySelector('[aria-current="location"]')) == null || y.scrollIntoView({ block: "center" });
  }, [e]), /* @__PURE__ */ x("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ x("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ x("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ g(Le, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ g(Le, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ g(Le, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ g(pn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? s.length ? /* @__PURE__ */ g("ol", { ref: m, className: "reader-finder-list", children: s.map((f, v) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ x(
      Le,
      {
        className: "reader-finder-entry",
        "data-level": f.level,
        "aria-current": v === l ? "location" : void 0,
        onClick: () => r(f.itemId),
        children: [
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-text", children: f.text }),
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: f.page })
        ]
      }
    ) }, f.itemId)) }) : /* @__PURE__ */ g("p", { className: "reader-finder-empty", children: o.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ x(_t, { children: [
      /* @__PURE__ */ x("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ g(
          ea,
          {
            ref: d,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: i,
            onChange: (f) => c(f.target.value),
            onKeyDown: (f) => {
              f.key === "Enter" && u[0] && r(u[0].itemId), f.stopPropagation();
            }
          }
        ),
        i.trim() ? /* @__PURE__ */ g("p", { className: "reader-finder-count", children: u.length >= 200 ? "200 处以上，只列前 200 处" : `${u.length} 处` }) : null
      ] }),
      /* @__PURE__ */ g("ol", { className: "reader-finder-list", children: u.map((f) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ x(Le, { className: "reader-finder-entry is-hit", onClick: () => r(f.itemId), children: [
        /* @__PURE__ */ x("span", { className: "reader-finder-entry-text", children: [
          f.snippet.slice(0, f.at),
          /* @__PURE__ */ g("mark", { children: f.snippet.slice(f.at, f.at + f.length) }),
          f.snippet.slice(f.at + f.length)
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: f.page })
      ] }) }, f.itemId)) })
    ] })
  ] });
}
const tu = ko(() => import("./ReaderMarkdownPanel-BOMAFTX-.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function nu(e) {
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
function ru(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
const Er = "terminal";
function ou() {
  const e = di(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Ac(e.viewStateKey), s = a.panel, l = a.setPanel, [i, c] = N(null), [u, d] = N(null), [m, h] = N(!1), b = M(null), f = M(null), v = s !== null, y = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, w = nu({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: y,
    liveTranslationVisible: m,
    assistantOpen: v,
    assistantPdfPane: i
  }), P = F(() => d(null), []), p = u ? Mo({ jobId: o.jobId, name: u, onClose: P }) : null, S = ni({
    hasOverlayContent: y,
    connection: e.liveTranslation.connection,
    showSource: w.showSource,
    liveTranslationVisible: m,
    assistantOpen: v
  }), k = w.sourceViewOnly, A = w.visibleMode;
  $(() => {
    d(null), h(!1);
  }, [e.viewStateKey]), $(() => {
    e.session.jobTerminal && h(!1);
  }, [e.session.jobTerminal]), $(() => {
    c(null);
  }, [a.scope]), $(() => {
    if (!(t.loading || t.failed)) {
      if (b.current !== e.viewStateKey) {
        b.current = e.viewStateKey;
        const H = we(e.viewStateKey), B = zc({
          savedMode: H == null ? void 0 : H.mode,
          sourceViewOnly: k,
          viewportWidth: De()
        });
        f.current = B.auto ? B.mode : null, B.mode && B.mode !== e.mode && e.setModeKeepingPage(B.mode);
        return;
      }
      Oc(e.mode, f.current) && (f.current = null, xt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, k]);
  const z = s || (e.mode === "compare" ? "compare" : "reading"), D = Fc(s, "markdown");
  yi({
    mode: A,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const C = F(() => {
    l(null), c(null);
  }, []), I = F((H) => {
    c(null);
    const B = ru(H, e.liveTranslationAvailable);
    B !== null && h(B), e.setModeKeepingPage(H);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), T = Q(() => S.sourcePaneToggle ? /* @__PURE__ */ g(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${m ? " is-active" : ""}`,
      onClick: () => h((H) => !H),
      "aria-pressed": m,
      title: m ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [S.sourcePaneToggle, m]), R = Lc();
  $(() => {
    R.available && s === Er && l(null);
  }, [R.available, s]);
  const E = F((H) => {
    H === Er && R.ask() || (l(H), c(null));
  }, [R.ask]), O = Q(() => ({
    // **只认 jobId**，不拿 documentId 兜底（契约见 adapters.ts：「用 jobId，换文档
    // 就换终端」）。原来是 `session.jobId || session.documentId || "reader"`，于是
    // 没有任务的阅读页（书架卡片在没有 job_id 时跳 `reader.html?document_id=…`）会
    // 拿一个 document id 当 job id 用，四处同时静默失败：
    //
    //   - fx 侧 resolve_job_workspace 找不到 data/jobs/<documentId> → 退回私有目录，
    //     终端开起来了但 books/ 是空的，无报错
    //   - 产物条每 4 秒打 /api/v1/jobs/<documentId>/board → 404 → 静默跳过
    //   - 左边那块 renderReaderBoard 看 !jobId → 静默返回 null
    //
    // 空字符串在这里是有意义的信号：renderReaderTerminal 会改画一段说明，
    // 而不是一个开得起来却什么都做不了的空壳。
    sessionKey: o.jobId,
    // 以前「点块 → 浮条 → 问 AI」会把选区预填进终端；浮条整个删了（只留悬停复制），
    // 阅读器这边没有要预填的了。宿主的注入能力保留，接口不动。
    pendingInput: null,
    onOpenBoard: d,
    onClose: C
  }), [C, o.documentId, o.jobId]), [U] = N(jc), [J, G] = N(null), j = F((H) => G((B) => B === H ? null : H), []), Y = F((H) => {
    e.jumpToAnchor({ block_id: H }), De() < 900 && G(null);
  }, [e.jumpToAnchor]), _ = F((H) => e.jumpToAnchor({ block_id: H }), [e.jumpToAnchor]), V = Q(() => ({
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
    jumpToBlock: _,
    revisedBlocks: e.revisedBlocks,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: k,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: E, close: C }
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
    _,
    e.revisedBlocks,
    e.sourceOnly,
    k,
    e.download,
    e.goToPage,
    E,
    C
  ]), ee = Q(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), ae = [
    os,
    `is-workspace-${z}`,
    v ? "is-assistant-open" : "",
    J ? "is-finder-open" : "",
    w.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ g(Qi, { value: V, hud: ee, children: /* @__PURE__ */ x("div", { className: ae, "data-reader-engine": "react-pdf", "data-reader-workspace": z, children: [
    /* @__PURE__ */ g(uc, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ g(Qc, { open: J, onToggle: j }),
    J ? /* @__PURE__ */ g(
      eu,
      {
        tab: J,
        onTab: G,
        onClose: () => G(null),
        onJump: Y
      }
    ) : null,
    /* @__PURE__ */ x("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ g(Ai, {}),
      /* @__PURE__ */ g(vc, {}),
      /* @__PURE__ */ g(Ti, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ g(
      pl,
      {
        mode: A,
        documentReady: !!o.jobId,
        sourceViewOnly: k,
        onModeChange: I,
        liveTranslation: S.topBarPill ? {
          visible: m,
          state: e.liveTranslation,
          onToggle: () => h((H) => !H)
        } : null
      }
    ),
    /* @__PURE__ */ g(wl, { active: s }),
    v ? /* @__PURE__ */ g(ic, {}) : null,
    /* @__PURE__ */ g(dl, { paneComposition: w, markdownSplit: D.open, assistantSplit: v, liveTranslation: e.liveTranslation, sourcePaneAction: T }),
    p,
    e.showHud ? /* @__PURE__ */ g(
      Mc,
      {
        mode: A,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ x(Eo, { fallback: null, children: [
      ro.map((H) => /* @__PURE__ */ g(
        $c,
        {
          panel: H,
          active: s,
          context: O
        },
        H.id
      )),
      D.mounted ? /* @__PURE__ */ g(tu, { open: D.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: C }) : null
    ] }),
    /* @__PURE__ */ g(xc, {})
  ] }) });
}
function Iu() {
  return /* @__PURE__ */ g(ou, {});
}
export {
  Iu as R,
  ou as a,
  lc as b,
  Pu as d,
  wu as f,
  Ru as r,
  $e as u
};
//# sourceMappingURL=ReaderApp-B-a35nad.js.map
