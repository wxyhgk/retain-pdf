var zn = (e) => {
  throw TypeError(e);
};
var On = (e, t, n) => t.has(e) || zn("Cannot " + n);
var nt = (e, t, n) => (On(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Fn = (e, t, n) => t.has(e) ? zn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), $n = (e, t, n, r) => (On(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsx as g, jsxs as x, Fragment as _t } from "react/jsx-runtime";
import { useMemo as Z, useState as L, useEffect as j, useCallback as $, useRef as k, useLayoutEffect as Fe, useSyncExternalStore as Lt, memo as ln, createContext as un, useContext as dn, forwardRef as To, useImperativeHandle as fn, useId as kr, Suspense as Eo, lazy as ko } from "react";
import { getReaderAdapters as ce, requireAdapter as Qe, renderReaderBoardSlot as Mo } from "./adapters.js";
import { resolveReaderDownloadName as Ao, resolveReaderDownloadUrls as No, READER_PROGRESS_COPY as we, trimString as Rt, READER_DOWNLOAD_ACTIONS as _o, disabledReason as Lo } from "./runtime/state.js";
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
  return ((n = (t = ce()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ca = "", la = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ua = (e) => {
  var t, n;
  return ((n = (t = ce()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, wu = (...e) => {
  var n;
  return (((n = ce()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Pe = () => Qe("defaultReaderDataPort"), Un = () => Qe("defaultReaderPageConfigPort"), Pu = {
  get apiPrefix() {
    return Pe().apiPrefix;
  },
  fetchProtected: (...e) => Pe().fetchProtected(...e),
  loadMarkdownPayload: (e) => Pe().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Pe().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Pe().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Pe().loadJobPayload(e),
  loadReaderPayload: (e, t) => Pe().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Pe().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Pe().liveTranslation;
  }
}, Lr = {
  messageTargetOrigin: () => Un().messageTargetOrigin(),
  readerJobId: () => Un().readerJobId()
}, da = () => {
  var e;
  return ((e = ce()) == null ? void 0 : e.liveTranslation) ?? null;
}, fa = () => {
  var e;
  return ((e = ce()) == null ? void 0 : e.notesQuote) ?? null;
}, ma = () => {
  var e;
  return ((e = ce()) == null ? void 0 : e.notesPanel) ?? null;
}, ha = () => {
  var e;
  return ((e = ce()) == null ? void 0 : e.readingPosition) ?? null;
}, pa = () => {
  var e;
  return ((e = ce()) == null ? void 0 : e.hostAi) ?? null;
}, ga = () => {
  var e;
  return ((e = ce()) == null ? void 0 : e.hostNavigation) ?? null;
}, ct = () => {
  var t;
  const e = ce();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ct = () => {
  const e = ce();
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
}, ba = (...e) => {
  var t, n;
  return ((n = (t = ce()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ya = () => {
  var e, t;
  return ((t = (e = ce()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, va = (...e) => {
  var t, n;
  return ((n = (t = ce()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Sa = (...e) => {
  var t, n;
  return ((n = (t = ce()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Ao(...e);
}, wa = (...e) => {
  var t, n;
  return ((n = (t = ce()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? No(...e);
}, Pa = (...e) => Qe("downloadProtectedResource")(...e), Ra = (...e) => Qe("failDownloadToast")(...e), Ru = (e, t) => Qe("resolveMarkdownAssetUrl")(e, t), Hn = "/api/v1";
function Ia() {
  const e = () => {
    var r;
    return Co(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = L(e);
  return j(() => {
    var c, i, l, u;
    const r = () => n(e()), o = (i = (c = globalThis.history) == null ? void 0 : c.pushState) == null ? void 0 : i.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const d = (f) => function(...h) {
          const b = f.apply(this, h);
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
  const e = Ia(), t = Z(() => va(Lr), [e]), n = Z(() => ya(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
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
    switchToSourceMode: c
  } = e, [i, l] = L({
    documentId: "",
    jobId: ""
  }), [u, d] = L({
    documentId: "",
    jobId: ""
  }), f = i.documentId === t ? i.jobId : "", h = u.documentId === t ? u.jobId : "", b = n || f, [m, v] = L({
    jobId: "",
    documentId: ""
  }), y = m.jobId === b ? m.documentId : "", w = t || y, P = !!t && !b, [p, S] = L(null), A = (p == null ? void 0 : p.sessionIdentity) === r && p.documentId === w ? p : null, M = P || !!A, O = $((C) => {
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
    }), c();
  }, []);
  j(() => {
    S((C) => C && C.sessionIdentity !== r ? null : C);
  }, [r]);
  const D = $((C) => {
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
    setResolvedDocumentJob: l,
    missingDocumentJob: u,
    setMissingDocumentJob: d,
    documentJobId: f,
    rejectedDocumentJobId: h,
    sessionJobId: b,
    resolvedJobDocument: m,
    setResolvedJobDocument: v,
    jobDocumentId: y,
    documentId: w,
    sourceOnly: P,
    committedDocumentSource: p,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: A,
    sourceViewOnly: M,
    refreshCommittedDocument: O,
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
  for (const c of n) {
    const i = `${c || ""}`.trim();
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
        type: la.progress,
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
  } = e, [c, i] = L(null), [l, u] = L(null), [d, f] = L(""), [h, b] = L(0), m = d === n ? c : null, v = d === n ? l : null, y = Wn(m), w = mn(y), P = $(() => {
    b((D) => D + 1);
  }, []), p = $((D) => {
    i(D.jobPayload), u(D.manifestPayload), f(D.sessionIdentity);
  }, []), S = $((D) => {
    i(null), u(null), f(D);
  }, []), A = k(""), M = k(""), O = $(async () => {
    const D = o.current;
    if (!D || A.current === D) return;
    const C = Ct().loadJobPayload;
    if (typeof C != "function") return;
    const I = a.current.value;
    A.current = D;
    try {
      const T = await C(D);
      if (s.current || a.current.value !== I || o.current !== D || !T || typeof T != "object")
        return;
      const R = Wn(T);
      i(T), f(r.current), R === "succeeded" && M.current !== D && (M.current = D, b((E) => E + 1));
    } catch {
    } finally {
      A.current === D && (A.current = "");
    }
  }, []);
  return j(() => {
    M.current = "";
  }, [n]), j(() => {
    if (!t || w || !m) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval(D);
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
  const [t, n] = L(e ? "source" : "compare"), r = $((a) => {
    e && a !== "source" || (n(a), Zt(a));
  }, [e]), o = $((a) => {
    _a(n, a);
  }, []);
  return j(() => (e && document.documentElement.classList.add("reader-source-only"), Zt(t), () => {
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
const ja = 2, ge = /* @__PURE__ */ new Map();
function Yt(e, t) {
  ge.delete(e), ge.set(e, t);
}
function Ba(e) {
  if (ge.size < ja) return;
  const t = ge.keys().next().value;
  t && ge.delete(t);
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
async function Cr(e, t = ct().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ge.has(r)) {
    const c = ge.get(r);
    return Yt(r, c), c;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const c = new Error(`读取 PDF 失败 (${o.status})`);
    c.status = o.status;
    const i = await Ua(o);
    throw i && (c.reason = i), c;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return ge.has(r) ? Yt(r, s) : (Ba(), ge.set(r, s)), s;
}
const Ha = { file: null, loading: !1, error: "" }, Wa = { file: null, loading: !0, error: "" };
function Va(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = L(null);
  if (j(() => {
    if (t || !n) return;
    const s = ge.get(n);
    if (s) {
      Yt(n, s);
      return;
    }
    const c = new AbortController();
    return Cr(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ha;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = ge.get(n);
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
  const c = await Cr(t, ct().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (It(s, o, n, "download"), c);
}
async function qa(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  It(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, c = null;
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
      c = u;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !c ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: c };
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
    locationKey: c,
    sessionIdentity: i,
    committedSource: l,
    applyIdentityEvent: u,
    publishPayload: d,
    clearPayload: f,
    switchSessionMode: h,
    jobRefreshRevision: b,
    sessionEpochRef: m,
    closingRef: v,
    activeLoadAbortRef: y
  } = e, [w, P] = L(""), [p, S] = L(""), [A, M] = L(null), [O, D] = L(null), [C, I] = L(!1), [T, R] = L(""), [E, F] = L([]), [W, G] = L(() => ({
    source: null,
    translated: null
  })), [q, B] = L(
    yt
  ), [K, N] = L({
    loading: !0,
    percent: 4,
    text: we.boot,
    stage: "progress",
    failed: !1
  });
  return j(() => {
    const U = new AbortController(), te = m.current.value, ne = Ja({
      sessionEpochRef: m,
      closingRef: v,
      abort: U,
      sessionEpoch: te
    });
    y.current = U;
    const z = Ct();
    if (v.current)
      return U.abort(), () => {
        y.current === U && (y.current = null);
      };
    function H(re, ae) {
      ne.markFailed(), N({
        loading: !1,
        percent: 100,
        text: re,
        stage: "failed",
        failed: !0
      }), Kt({ percent: 100, text: ae, stage: "failed" });
    }
    function he() {
      I(!0), N({
        loading: !1,
        percent: 100,
        text: we.ready,
        stage: "ready",
        failed: !1
      }), Kt({ percent: 100, text: we.ready, stage: "ready" });
    }
    function Se() {
      return l != null && l.documentId ? Vn(
        l.documentId,
        l.revision
      ) : ia() ? ca : z.resolveResourceUrl(qt(r));
    }
    async function ke() {
      var de;
      let re = { activeJobId: "", activeVersionId: "" };
      try {
        const ie = await ((de = z.fetchDocument) == null ? void 0 : de.call(z, r));
        ie && (re = Ca(ie));
      } catch {
      }
      const ae = Da({
        link: re,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (ae.kind === "follow-active-job") {
        if (ne.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: ae.jobId
        }), ae.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: ae.activeVersionId,
          sessionIdentity: i
        }), h("source")) : h("compare");
        return;
      }
      if (ae.kind === "open-committed-source") {
        if (ne.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: ae.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const le = Se();
      if (ne.isInactive()) return;
      P(le), S(""), R(""), f(i);
      const se = await Xt({
        url: le,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ne,
        setBoot: N
      });
      if (!ne.isInactive()) {
        if (!se) {
          H("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        M(se), he();
      }
    }
    async function pt() {
      var V;
      const re = !l, ae = !!(re && z.loadSessionSnapshot && z.loadReaderOptionalArtifacts), le = ae ? z.loadReaderOptionalArtifacts(t) : null, se = await ((V = z.loadSessionSnapshot) == null ? void 0 : V.call(z, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: re && !ae
      })), de = se ? {
        jobPayload: se.sourcePayload,
        manifestPayload: se.manifestPayload,
        readerMetadata: se.readerMetadata,
        regionsPayload: se.regions,
        readerErrors: se.readerErrors
      } : await z.loadReaderPayload(t, {
        includeOptionalArtifacts: re
      });
      if (ne.isInactive()) return;
      let ie = null;
      if (n && !r)
        if (se && se.linkedDocument !== void 0)
          ie = se.linkedDocument;
        else {
          try {
            ie = await z.fetchDocumentByJobId(Hn, t);
          } catch {
          }
          if (ne.isInactive()) return;
        }
      const Ue = ka(de.jobPayload) || `${(ie == null ? void 0 : ie.document_id) || ""}`.trim();
      Ue && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ue
      });
      const He = xa({
        payloadDocumentId: Ue,
        linkedActiveJobId: `${(ie == null ? void 0 : ie.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ie == null ? void 0 : ie.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (He.kind === "restore-committed-source") {
        if (ne.isInactive()) return;
        u({
          type: "committed-source",
          documentId: He.documentId,
          revision: He.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const et = z.resolveReaderSourcePdf(de.manifestPayload), Ot = z.resolveReaderTranslatedPdfUrl(de.jobPayload, de.manifestPayload), Me = typeof et == "string" ? et : z.resolveReaderArtifactUrl(et), Ae = r || Ue, Ne = l != null && l.documentId ? Vn(
        l.documentId,
        l.revision
      ) : Me || (Ae ? z.resolveResourceUrl(qt(Ae)) : ""), tt = l ? "" : Ot || "";
      P(Ne || ""), S(tt), R(Aa(de.jobPayload, t)), d({
        jobPayload: de.jobPayload || null,
        manifestPayload: de.manifestPayload || null,
        sessionIdentity: i
      });
      const gt = () => qa({
        sourceFinal: Ne || "",
        translatedFinal: tt,
        fence: ne,
        setBoot: N
      }), bt = !!(Ne || tt), We = le && bt ? gt() : null;
      We == null || We.catch(() => {
      });
      const _ = le ? await le : de;
      if (ne.isInactive()) return;
      if (F(l ? [] : xo(_.regionsPayload)), G(l ? { source: null, translated: null } : zo(_.readerMetadata)), B(l ? yt : _.readerErrors ?? yt), !bt) {
        H(we.failed, we.failed);
        return;
      }
      const J = await (We ?? gt());
      if (J.status !== "inactive") {
        if (J.status === "incomplete") {
          H("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        M(J.sourceBytes), D(J.translatedBytes), he();
      }
    }
    async function zt() {
      I(!1), M(null), D(null), F([]), G({ source: null, translated: null }), B(yt), It(N, 8, we.metadata, "metadata");
      try {
        if (s) {
          await ke();
          return;
        }
        if (!t) {
          H(we.failed, we.failed);
          return;
        }
        await pt();
      } catch (re) {
        if (ne.isClosedOrStale() || (re == null ? void 0 : re.name) === "AbortError") return;
        ne.markFailed();
        const ae = Number(re == null ? void 0 : re.status), le = `${(re == null ? void 0 : re.reason) || ""}`, se = Fa({ status: ae, reason: le, sessionJobId: t });
        if (se && (await Ka({
          apiPrefix: Hn,
          documentId: se,
          expiredJobId: t
        }) || ne.isClosedOrStale()))
          return;
        if (za({
          status: ae,
          reason: le,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const de = re instanceof Error ? re.message : we.failed;
        H(de, de);
      }
    }
    return zt(), () => {
      U.abort(), y.current === U && (y.current = null);
    };
  }, [t, r, o, a, s, c, l, b, n, i, u, d, f, h]), {
    sourceUrl: w,
    translatedUrl: p,
    sourceFile: A,
    translatedFile: O,
    assetsReady: C,
    title: T,
    regions: E,
    readerMetadata: W,
    readerErrors: q,
    boot: K
  };
}
function Ya() {
  const e = k(!1), t = k(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ta(), s = k({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = k(a), i = k(""), l = k(""), u = k(() => {
  }), d = $(() => u.current(), []), f = Ea({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: c,
    documentIdRef: i,
    sessionJobIdRef: l,
    switchToSourceMode: d
  }), {
    sessionJobId: h,
    documentId: b,
    sourceOnly: m,
    sourceViewOnly: v
  } = f, { mode: y, setMode: w, switchSessionMode: P } = La(v);
  u.current = () => {
    P("source");
  }, c.current = a, i.current = b, l.current = h;
  const p = Na({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: A,
    jobStatus: M,
    jobTerminal: O,
    jobRefreshRevision: D,
    refreshJobArtifacts: C,
    refreshJobStatus: I
  } = p, T = Za({
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
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), R = $(() => {
    var F;
    e.current = !0, (F = t.current) == null || F.abort();
  }, []), E = Z(
    () => ({
      fetchProtected: Ct().fetchProtected,
      jobId: h,
      jobPayload: S,
      manifestPayload: A,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: v
    }),
    [h, S, A, T.sourceUrl, T.translatedUrl, v]
  );
  return {
    jobId: h,
    jobStatus: M,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: b,
    sessionIdentity: a,
    sourceOnly: m,
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
    readerMetadata: T.readerMetadata,
    readerErrors: T.readerErrors,
    download: E,
    refreshJobArtifacts: C,
    refreshJobStatus: I,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: R
  };
}
const Xa = 160, Qa = 8, es = 0;
function ts() {
  const e = k(null), [t, n] = L(null), [r, o] = L(es), a = $((s) => {
    e.current = s, n(s);
  }, []);
  return j(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < Xa || o((u) => Math.abs(u - l) < Qa ? u : l);
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
function ns(e) {
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
const $t = { source: 0, translated: 0 };
function rs(e, t) {
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
    pages: $t
  })), [h, b] = L(() => ({ identity: l, tick: 0 })), m = d.identity === l ? d.pages : $t, v = h.identity === l ? h.tick : 0, y = ns({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: w } = y, P = $((I, T) => {
    u.current === l && f((R) => {
      const E = R.identity === l ? R.pages : $t;
      return E[T] === I && R.identity === l ? R : {
        identity: l,
        pages: { ...E, [T]: I }
      };
    });
  }, [l]), p = k(null), S = $(() => {
    p.current && clearTimeout(p.current);
    const I = l;
    p.current = setTimeout(() => {
      p.current = null, u.current === I && b((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  j(() => (p.current && (clearTimeout(p.current), p.current = null), f((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), b((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    p.current && (clearTimeout(p.current), p.current = null);
  }), [l]);
  const A = Z(
    () => Math.max(m.source, m.translated),
    [m]
  ), M = w === "translated" ? m.translated : m.source || m.translated, O = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, C = `${l}-${v}-${O}-${n}-${m.source}-${m.translated}-${D}`;
  return {
    ...y,
    numPagesByPane: m,
    hudNumPages: A,
    primaryNumPages: M,
    metricsTick: v,
    onNumPages: P,
    onMetrics: S,
    rowSyncRevision: C
  };
}
const Ye = "data-reader-page", lt = "data-reader-pane", gn = "data-natural-height", os = "reader-react-root", as = "reader-react-grid", ss = "reader-react-scroll-shell", is = "reader-react-pdf-pane", Dr = "reader-react-pdf-page", Tt = "reader-react-pdf-page-placeholder", bn = "reader-react-pdf-page-slot";
function Et(e, t) {
  const n = e != null ? `[${Ye}="${e}"]` : `[${Ye}]`;
  return t ? `${n}[${lt}="${t}"]` : n;
}
function cs() {
  return `.${bn}[${Ye}]`;
}
function yn(e) {
  return Number(e.getAttribute(Ye));
}
const xr = 0.25, kt = 1, ls = 0.05, ht = 0.5, us = 16, ds = 8, fs = 720;
function De() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function zr(e) {
  return Number.isFinite(e) && e < fs;
}
function qe(e, t = Number.POSITIVE_INFINITY) {
  return zr(t) && (e === "source" || e === "translated") ? kt : ht;
}
function Dt(e) {
  return Number.isFinite(e) ? Math.min(kt, Math.max(xr, e)) : ht;
}
function ut(e, t) {
  const n = Dt(Number(e) + t * ls);
  return Math.round(n * 100) / 100;
}
function ms(e) {
  return Math.round(Dt(e) * 100);
}
function hs(e) {
  const n = (Number(e) || 0) - us - ds;
  return Math.max(160, Math.floor(n));
}
function ps(e, t = ht) {
  const n = Dt(t);
  return hs((Number(e) || 0) * n);
}
function gs(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${lt}]`)
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
function ve(e, t = jr()) {
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
  const o = ve(e, n), a = Ur({
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
    var h;
    return ((h = ve(n)) == null ? void 0 : h.zoom) ?? qe(e, De());
  }), a = k(r), s = k(n);
  a.current = r;
  const c = k(1), i = k(((f = ve(n)) == null ? void 0 : f.zoom) !== void 0);
  j(() => {
    var m;
    if (s.current === n) return;
    s.current = n;
    const h = (m = ve(n)) == null ? void 0 : m.zoom;
    i.current = h !== void 0;
    const b = h ?? qe(e, De());
    c.current = 1, a.current = b, o(b);
  }, [e, n]), j(() => {
    if (i.current) return;
    const h = qe(e, De()), b = a.current;
    Math.abs(h - b) < 5e-4 || (c.current = 1, a.current = h, o(h));
  }, [e]);
  const l = $((h) => {
    const b = Dt(h), m = a.current;
    Math.abs(b - m) < 5e-4 || (c.current = b / (m || 1), i.current = !0, xt(s.current, { zoom: b }), o(b));
  }, []), u = $((h) => {
    l(ut(a.current, h));
  }, [l]), d = $((h) => {
    l(qe(h));
  }, [l]);
  return Fe(() => {
    const h = c.current;
    Math.abs(h - 1) < 1e-3 || (c.current = 1, gs(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function As(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = k(t), a = k(n), s = k(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: $((i) => {
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
  const o = yn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function jt(e, t, n = vn) {
  if (!e)
    return null;
  const r = Et(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Hr(e, n), c = Wr(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function Sn(e, t, n = "auto", r, o = vn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(Et(a, r))), c || (c = e.querySelector(Et(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), f = Math.max(0, d + s * u - o);
  return n === "auto" ? e.scrollTop = f : e.scrollTo({ top: f, behavior: n }), !0;
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
  const c = [], i = () => {
    var u;
    if (a) return;
    Sn(
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
function pe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Ls(e, t, n = !0, r = "", o) {
  const [a, s] = L(1);
  return j(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, u = 0;
    const d = Et(void 0, o), f = () => {
      if (i) return;
      const m = Array.from(c.querySelectorAll(d));
      if (!m.length)
        return;
      const v = Hr(c), y = Wr(m, v);
      y && s(y.page);
    }, h = () => {
      i || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, f();
      }));
    }, b = () => {
      if (i) return;
      if (!Array.from(c.querySelectorAll(d)).length) {
        l = setTimeout(b, 120);
        return;
      }
      f(), c.addEventListener("scroll", h, { passive: !0 });
    };
    return b(), () => {
      i = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), c.removeEventListener("scroll", h);
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
  e.querySelectorAll(cs()).forEach((r) => {
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
  const [o, a] = L(() => /* @__PURE__ */ new Map()), s = k(o), c = k(r);
  return c.current = r, Fe(() => {
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
      const p = zs(P);
      xs(s.current, p) || (s.current = p, a(p)), u && !d && (d = !0, (S = c.current) == null || S.call(c));
    }, h = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    h();
    const b = window.setTimeout(h, 100), m = window.setTimeout(() => {
      u = !0, h();
    }, 300), v = window.setTimeout(h, 700), y = e.current;
    let w = null;
    return y && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => h()), w.observe(y)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(b), window.clearTimeout(m), window.clearTimeout(v), w == null || w.disconnect();
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
  } = t, c = k(
    ((T = ve(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), i = k(null), l = k(!1), u = k(r), d = k(null), f = k(null), h = k(null), b = k(null), m = k(a), v = k(""), y = k(n);
  y.current = n;
  const w = $(() => {
    var R;
    (R = d.current) == null || R.call(d), d.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), P = $(() => {
    !l.current && i.current == null || (w(), h.current != null && (clearTimeout(h.current), h.current = null), i.current = null, l.current = !1);
  }, [w]), p = $((R = !1) => {
    b.current != null && (clearTimeout(b.current), b.current = null);
    const E = () => {
      b.current = null, xt(m.current, {
        anchor: pe(c.current)
      });
    };
    R ? E() : b.current = setTimeout(E, Ws);
  }, []), S = $((R) => {
    c.current = pe(R), i.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, l.current = !1;
    }, Us);
  }, []);
  j(() => {
    if (!o)
      return;
    let R = !1, E = null, F = null, W = null;
    const G = () => {
      if (R) return;
      const q = e.current;
      if (!q) {
        W = setTimeout(G, 50);
        return;
      }
      E = q, F = () => {
        if (l.current)
          return;
        const B = jt(E, y.current);
        B && (c.current = B, p());
      }, E.addEventListener("scroll", F, { passive: !0 }), l.current || F();
    };
    return G(), () => {
      R = !0, W != null && clearTimeout(W), E && F && E.removeEventListener("scroll", F);
    };
  }, [o, r, n, e, p]), j(() => {
    if (!o) return;
    const R = e.current;
    if (!R) return;
    const E = (F) => {
      F.metaKey || F.ctrlKey || F.altKey || Hs.has(F.key) && P();
    };
    return R.addEventListener("wheel", P, { passive: !0 }), R.addEventListener("touchmove", P, { passive: !0 }), window.addEventListener("keydown", E), () => {
      R.removeEventListener("wheel", P), R.removeEventListener("touchmove", P), window.removeEventListener("keydown", E);
    };
  }, [o, e, P]), Fe(() => {
    var E;
    if (m.current === a) return;
    p(!0), w(), h.current != null && (clearTimeout(h.current), h.current = null), m.current = a, v.current = "";
    const R = (E = ve(a)) == null ? void 0 : E.anchor;
    c.current = R ? pe(R) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, p, w]), j(() => {
    var E;
    if (!o || !s || !a || v.current === a) return;
    v.current = a;
    const R = pe(
      ((E = ve(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = R, i.current = R, l.current = !0, w(), d.current = en(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: y.current,
        delaysMs: Kn,
        onDone: () => S(R)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(R);
    }, Math.max(...Kn) + 160), () => w();
  }, [o, s, a, e, S, w]), j(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, w();
      return;
    }
    const R = i.current ? pe(i.current) : pe(c.current);
    return l.current = !0, i.current = R, c.current = R, w(), d.current = en(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Fs,
        onDone: () => S(R)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(R);
    }, $s), () => {
      w();
    };
  }, [r, o, n, e, S, w]), j(() => () => {
    w(), h.current != null && (clearTimeout(h.current), h.current = null), p(!0);
  }, [w, p]);
  const A = $(() => {
    const R = jt(
      e.current,
      y.current
    );
    return pe(R || c.current);
  }, [e]), M = $(() => {
    l.current = !0;
    const R = jt(
      e.current,
      y.current
    ), E = pe(R ?? c.current);
    return c.current = E, i.current = E, p(), E;
  }, [e, p]), O = $((R, E, F) => {
    const W = F || y.current, G = Mt(R, E || 1), q = { page: G, fraction: 0 };
    c.current = q, l.current = !0, i.current = q, p(), w(), Ns(e.current, G, "smooth", W), d.current = _s(
      () => e.current,
      G,
      {
        behavior: "auto",
        pane: W,
        delaysMs: js,
        onDone: () => S(q)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(q);
    }, Bs);
  }, [e, S, w, p]), D = $(() => pe(c.current), []), C = $(() => l.current, []), I = $(() => {
    if (!l.current || !i.current)
      return;
    const R = pe(i.current);
    Sn(
      e.current,
      R,
      "auto",
      y.current
    );
  }, [e]);
  return {
    lockFromShell: A,
    beginModeSwitch: M,
    goToPage: O,
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
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l } = e, u = k(a);
  u.current = a;
  const d = k(s);
  d.current = s;
  const f = k(c);
  f.current = c;
  const h = k(n);
  h.current = n, j(() => {
    var P, p;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const b = ba(), m = Js(b, d.current), v = Vr(b, m, { jobId: i, documentId: l });
    if (t.current === v)
      return;
    if (m == null) {
      t.current = v, (P = h.current) == null || P.call(h);
      return;
    }
    t.current = v, b && ((p = f.current) == null || p.call(f, b, m));
    const y = [];
    let w = 0;
    for (const S of qs)
      w = Math.max(w, S), y.push(
        setTimeout(() => {
          u.current(m);
        }, S)
      );
    return y.push(
      setTimeout(() => {
        var S;
        (S = h.current) == null || S.call(h);
      }, w + Gs)
    ), () => {
      for (const S of y) clearTimeout(S);
    };
  }, [r, o, i, l, t]);
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
  } = e, u = k(a);
  u.current = a;
  const d = k(l);
  d.current = l;
  const f = k(0);
  j(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const h = setTimeout(() => {
      var y;
      const b = ((y = globalThis.location) == null ? void 0 : y.search) || "", m = Do(b, o, u.current);
      if (f.current = o, m === null) return;
      const v = `${new URLSearchParams(m).get("block_id") || ""}`.trim();
      t.current = Vr(
        { blockId: v },
        o,
        { jobId: c, documentId: i }
      ), (d.current || Ys)(m);
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
function Qs(e) {
  const t = k(""), [n, r] = L(!1), o = $(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId
  };
  Zs(a, t, o), Xs(e, t, n);
}
const rt = {
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
      const l = wn(i);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw i;
    }
    const c = Bt[Math.min(s, Bt.length - 1)];
    if (await tn(c, r), s >= Bt.length + 2) throw a;
  }
}
function oi({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = L(rt), s = k(o), c = k("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = mn(l) ? l : "";
  return j(() => {
    if (!n || !i) {
      c.current = "", s.current = rt, a(rt);
      return;
    }
    const d = r === void 0 ? da() : r, f = c.current === i;
    if (c.current = i, !d) {
      const P = {
        ...f ? s.current : rt,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = P, a(P);
      return;
    }
    const h = new AbortController();
    let b = !1;
    const m = {
      ...f ? s.current : rt,
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
          b = !0, v((S) => ({
            ...S,
            layoutByPage: ei(p),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError") return;
          const S = wn(p);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            v((M) => ({
              ...M,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: vt(p, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            v((M) => ({
              ...M,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          v((M) => ({
            ...M,
            connection: "connecting",
            jobStatus: l,
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
                S = await ri(
                  i,
                  p,
                  s.current,
                  h.signal,
                  d
                );
              } catch (A) {
                if ((A == null ? void 0 : A.name) === "AbortError" || h.signal.aborted) throw A;
                v((M) => ({
                  ...M,
                  lastSeq: Math.max(M.lastSeq, p.seq),
                  error: vt(A, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              v((A) => {
                const M = ti(A, p, S);
                return u ? {
                  ...M,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...M,
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
        await tn(Xn[Math.min(P, Xn.length - 1)], h.signal).catch(() => {
        }), P += 1;
      }
    })(), () => h.abort();
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
  return j(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ct().fetchRevisionGroups;
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
const ii = 2e3;
function ci(e) {
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
const li = /* @__PURE__ */ new Set(["book", "translate"]);
function qr(e) {
  return !!(e.jobId && e.sourceUrl && li.has(e.workflow));
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
  }), r = k({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !mn(o) && (r.current.running = !0);
  const a = oi({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = ts(), u = si(e.jobId, !e.sourceOnly), d = Rs({
    documentId: e.documentId,
    jobId: e.jobId
  }), f = `${d}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: b } = Ms(e.mode, s, d), m = rs(
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
  } = Vs(s, {
    primaryPane: m.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: d,
    restoreReady: m.primaryNumPages > 0
  });
  j(() => {
    w();
  }, [i, w]);
  const P = Os(
    s,
    m.compareMode,
    m.rowSyncRevision,
    w
  ), p = Ls(
    s,
    m.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${m.metricsTick}`,
    m.primaryPane
  ), S = $((B, K) => {
    var U, te;
    const N = Math.max(
      Number(m.hudNumPages) || 0,
      Number(m.primaryNumPages) || 0,
      Number((U = m.numPagesByPane) == null ? void 0 : U.source) || 0,
      Number((te = m.numPagesByPane) == null ? void 0 : te.translated) || 0
    );
    y(B, N, K);
  }, [y, m.hudNumPages, m.primaryNumPages, m.numPagesByPane]), [A, M] = L(null), O = k(null), D = $((B) => {
    O.current && clearTimeout(O.current), M(B), B && (O.current = setTimeout(() => M(null), ii));
  }, []);
  j(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const C = $((B) => {
    const K = Ft(e.regions, B);
    return K ? jn(K, m.primaryPane).page : null;
  }, [e.regions, m.primaryPane]), I = $((B, K) => {
    const N = K || m.primaryPane, U = typeof B == "object" && B ? `${B.block_id || ""}`.trim() : "", te = typeof B == "object" && B ? `${B.image_url || ""}`.trim() : "", ne = typeof B == "object" && B ? B.page_idx != null ? Number(B.page_idx) + 1 : B.page != null ? Number(B.page) : null : typeof B == "number" ? B + 1 : null, z = Oo(e.regions, te, ne) || Ft(e.regions, U) || (typeof B == "object" ? Fo(e.regions, B) : null);
    let H = z ? jn(z, N).page : null;
    H == null && (H = ci(B)), !(H == null || H < 1) && (D(z), S(H, N));
  }, [D, S, m.primaryPane, e.regions]);
  Qs({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: m.hudNumPages || 0,
    currentPage: p,
    goToPage: S,
    resolveBlockPage: C,
    jobId: e.jobId,
    documentId: e.documentId,
    onAnchorApplied: (B) => {
      D(Ft(e.regions, B.blockId));
    }
  });
  const T = !e.boot.loading && !e.boot.failed && e.assetsReady, R = Number(m.hudNumPages) || 0;
  j(() => {
    var B;
    T && ((B = ha()) == null || B.report(p >= 1 ? p - 1 : null, R >= 1 ? R : null));
  }, [T, p, R]), j(() => {
    const B = ga();
    if (!(!B || !T || !e.jobId))
      return B.subscribe(({ jobId: K, pageIdx: N, blockId: U }) => K !== e.jobId ? !1 : (I({ ...N != null ? { page_idx: N } : {}, ...U ? { block_id: U } : {} }), !0));
  }, [T, e.jobId, I]);
  const { setModeKeepingPage: E } = As({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  j(() => {
    D(null);
  }, [f, D]);
  const F = !e.boot.loading && !e.boot.failed, W = Z(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), G = Z(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), q = Z(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: b,
    shell: W,
    panes: m,
    sessionFiles: G,
    rowHeights: P,
    goToPage: S,
    activeRegion: A,
    jumpToAnchor: I,
    setModeKeepingPage: E,
    download: e.download,
    showHud: F,
    viewStateKey: d,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, W, m, G, P, S, A, I, E, F, h, b, d, a, n, u]);
  return Z(() => ({
    ...q,
    currentPage: p
  }), [q, p]);
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
    numPages: c,
    goToPage: i,
    enabled: l = !0
  } = e;
  j(() => {
    if (!l)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || pi(d.target) || bi(d.target))
        return;
      const f = d.key, h = hi(f);
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
              a(ut(o, 1));
              return;
            case "zoom-out":
              a(ut(o, -1));
              return;
            case "zoom-reset":
              a(qe(t, De()));
              return;
            case "next-page":
              i(Mt(s + 1, c));
              return;
            case "prev-page":
              i(Mt(s - 1, c));
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
  const e = ct().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
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
    const c = s.width * s.height;
    c < o && (r = a, o = c);
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
  const [r, o] = L("idle"), [a, s] = L("idle"), [c, i] = L("idle"), l = k([]), u = (e == null ? void 0 : e.itemId) || "";
  if (j(() => {
    o("idle"), s("idle"), i("idle");
    const P = l.current;
    return () => {
      P.forEach((p) => window.clearTimeout(p)), l.current = [];
    };
  }, [u]), !e) return null;
  const d = $o(e.highlight.region, t), f = Mr(e.highlight.region), h = (P, p) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const A = await Ci(P);
    p(A ? "copied" : "failed"), l.current.push(window.setTimeout(() => p("idle"), 1200));
  }, b = f === "formula" ? "复制 LaTeX" : "复制", m = fa(), v = !!(m != null && m.available()), y = (P) => {
    P.preventDefault(), P.stopPropagation();
    const p = !!(m != null && m.send(Oi(e)));
    i(p ? "copied" : "failed"), l.current.push(window.setTimeout(() => i("idle"), 1200));
  }, w = Xr(e.rect, v ? At + Fi : At);
  return /* @__PURE__ */ g("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ g(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": f,
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
    const c = hn(
      ji(e, a),
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
const Ui = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Hi = 256, ot = /* @__PURE__ */ new Map();
function Wi(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Vi(e) {
  const t = `${e || ""}`, { text: n, slots: r } = oa(t, { bareLatex: !0 }), o = Wi(n), a = aa(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = ot.get(t);
  if (!s && (s = sa(o, r), ot.set(t, s), ot.size > Hi)) {
    const c = ot.keys().next().value;
    c !== void 0 && ot.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Ht(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Re(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Ji(e, t) {
  const n = e.typography, r = Re(t) || 1, o = Re(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Ht(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Re(n == null ? void 0 : n.fit_min_font_size_pt), u = Re(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), h = o ? o * r : i, b = Re(n == null ? void 0 : n.leading_em), m = [
    Re(n == null ? void 0 : n.padding_top_pt) || 0,
    Re(n == null ? void 0 : n.padding_right_pt) || 0,
    Re(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Re(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((v) => v * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Ui,
    fontSizePx: Math.max(d, Math.min(f, h)),
    minFontSizePx: d,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: b ? 1 + b : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Ht(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Ht(e.kind) ? "center" : "justify",
    padding: m,
    exact: !!o
  };
}
function qi(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), c = (d) => {
    const f = s.get(d);
    if (f !== void 0) return f;
    const { width: h, height: b } = e(d), m = h <= t + 0.5 && b <= n + 0.5;
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
const Gi = 512, at = /* @__PURE__ */ new Map();
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
  const n = k(null), r = Z(
    () => Vi(e.translatedText),
    [e.translatedText]
  ), [o, a] = L(r.fallbackHtml), s = Z(
    () => Ji(e, t),
    [e, t]
  );
  j(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      d && a(f);
    }), () => {
      d = !1;
    };
  }, [r]), Fe(() => {
    const d = n.current;
    if (!d) return;
    const [f, h, b, m] = s.padding, v = Math.max(1, e.rect.width - m - h), y = Math.max(1, e.rect.height - f - b), w = Ki(o, v, y, s);
    let P = at.get(w);
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
    ), at.set(w, P), at.size > Gi)) {
      const p = at.keys().next().value;
      p !== void 0 && at.delete(p);
    }
    d.style.fontSize = `${P.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [c, i, l, u] = s.padding;
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
        padding: `${c}px ${i}px ${l}px ${u}px`
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
  const o = Z(
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
const Xi = ln(Yi), Qr = un(null), eo = un(null);
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
function ec({
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
  onHoverRegion: h,
  liveTranslationLayout: b,
  liveTranslationPage: m,
  showLiveTranslation: v = r === "source"
}) {
  var K;
  const y = (K = $e()) == null ? void 0 : K.revisedBlocks, w = k(c ?? no), [P, p] = L(w.current);
  j(() => {
    c != null && Math.abs(c - w.current) >= 1e-3 && (w.current = c, p(c));
  }, [c]);
  const S = k(l);
  S.current = l;
  const A = k((N) => {
    var U;
    (U = S.current) == null || U.call(S, N);
  }).current, M = Math.max(120, Math.floor(t * P)), O = Math.max(M, Math.ceil(a || 0)), D = hn(u, t, M), C = Z(
    () => Li(d, t, M),
    [M, d, t]
  ), [I, T] = L(null), R = typeof h == "function", E = R ? f ?? null : I, F = (N) => {
    R ? N !== (f ?? null) && (h == null || h(N)) : T((U) => U === N ? U : N);
  }, W = Z(
    () => C.find((N) => N.itemId === E) || null,
    [E, C]
  ), G = (N) => {
    var he, Se;
    if (N.pointerType === "touch") return;
    if (N.buttons !== 0) {
      F(null);
      return;
    }
    if ((Se = (he = N.target) == null ? void 0 : he.closest) != null && Se.call(he, `.${Zr}`)) return;
    const U = N.currentTarget.getBoundingClientRect(), te = N.clientX - U.left, ne = N.clientY - U.top, z = W == null ? void 0 : W.rect;
    if (z && Xr(z) && te >= z.left - 4 && te <= z.left + At && ne >= z.top - Yr && ne <= z.top) return;
    const H = er(C, te, ne);
    F((H == null ? void 0 : H.itemId) || null);
  }, q = (N) => {
    if (N.pointerType === "mouse") return;
    const U = N.currentTarget.getBoundingClientRect(), te = er(
      C,
      N.clientX - U.left,
      N.clientY - U.top
    );
    F((te == null ? void 0 : te.itemId) || null);
  }, B = (N) => {
    !Number.isFinite(N) || N <= 0 || Math.abs(w.current - N) < 1e-3 || (w.current = N, p(N), i == null || i(e, N));
  };
  return /* @__PURE__ */ x(
    "div",
    {
      ref: A,
      [Ye]: e,
      [lt]: r,
      [gn]: M,
      className: bn,
      onPointerMoveCapture: G,
      onPointerDown: q,
      onPointerLeave: (N) => {
        N.pointerType === "mouse" && F(null);
      },
      style: {
        width: t,
        height: O,
        minHeight: O
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
                style: { width: t, height: M }
              }
            ),
            onLoadSuccess: (N) => {
              try {
                const U = N.getViewport({ scale: 1 });
                if (U.width > 0) {
                  const te = U.height / U.width;
                  B(te);
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
            style: { width: t, height: M },
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
            pageState: m,
            width: t,
            height: M
          }
        ) : null,
        o && r === "translated" && (y != null && y.size) ? /* @__PURE__ */ g("div", { className: "reader-revised-markers", "aria-hidden": "true", children: C.filter((N) => y.has(N.itemId)).map((N) => /* @__PURE__ */ g(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": N.itemId,
            style: { left: N.rect.left, top: N.rect.top, height: N.rect.height }
          },
          N.itemId
        )) }) : null,
        /* @__PURE__ */ g(
          $i,
          {
            target: o ? W : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: W && (y == null ? void 0 : y.get(W.itemId)) || 0
          }
        )
      ]
    }
  );
}
const tc = ln(ec), Wt = 5, nc = "120% 0px", rc = 120;
let tr = 1;
const nr = /* @__PURE__ */ new WeakMap();
function oc(e) {
  if (!e) return 0;
  const t = nr.get(e);
  if (t) return t;
  const n = tr;
  return tr += 1, nr.set(e, n), n;
}
function ac() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const sc = To(
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
    activeRegion: b = null,
    regions: m = [],
    readerMetadata: v = null,
    hoveredRegionId: y = null,
    onHoverRegion: w,
    liveTranslation: P,
    showLiveTranslation: p = t === "source",
    liveTranslationPendingLabel: S = "",
    paneAction: A
  }, M) {
    Ni();
    const { file: O, loading: D, error: C } = Va(n, r), I = `${n}\0${oc(O)}`, T = k(I);
    T.current = I;
    const R = Z(
      () => $a(O),
      [O, n]
    ), [E, F] = L(0), [W, G] = L(""), [q, B] = L(null), [K, N] = L(480), U = k(null), te = k(0), ne = Z(() => ac(), []), z = Z(() => ({
      cMapUrl: ct().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: ct().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    fn(M, () => q, [q]), j(() => {
      const _ = (Y) => {
        te.current = Y, N(Y);
      }, J = (Y) => {
        const ee = ys(Y, te.current);
        if (ee !== "ignore") {
          if (U.current && clearTimeout(U.current), ee === "immediate") {
            _(Y);
            return;
          }
          U.current = setTimeout(() => _(Y), vs);
        }
      }, V = !!(i && i >= 80);
      J(V ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const oe = !V && c && typeof ResizeObserver < "u" ? new ResizeObserver((Y) => {
        var ee, ue;
        J(((ue = (ee = Y[0]) == null ? void 0 : ee.contentRect) == null ? void 0 : ue.width) ?? c.clientWidth);
      }) : null;
      return oe && c && oe.observe(c), () => {
        oe == null || oe.disconnect(), U.current && clearTimeout(U.current);
      };
    }, [i, c, a]);
    const H = Z(
      () => ps(K, o),
      [K, o]
    ), [he, Se] = L(() => /* @__PURE__ */ new Map()), [ke, pt] = L(() => /* @__PURE__ */ new Set()), [zt, re] = L(() => /* @__PURE__ */ new Set()), ae = k(/* @__PURE__ */ new Map()), le = k(null), se = k(/* @__PURE__ */ new Map()), de = $((_, J) => {
      Se((V) => {
        if (V.get(_) === J) return V;
        const X = new Map(V);
        return X.set(_, J), X;
      });
    }, []), ie = $((_, J) => {
      const V = ae.current, X = V.get(_);
      if (X && le.current)
        try {
          le.current.unobserve(X);
        } catch {
        }
      if (J) {
        if (V.set(_, J), le.current)
          try {
            le.current.observe(J);
          } catch {
          }
      } else
        V.delete(_);
    }, []), Ue = k(/* @__PURE__ */ new Map()), He = $((_) => {
      const J = Ue.current;
      let V = J.get(_);
      return V || (V = (X) => ie(_, X), J.set(_, V)), V;
    }, [ie]);
    j(() => {
      if (typeof IntersectionObserver > "u") return;
      const _ = se.current, J = new IntersectionObserver(
        (V) => {
          const X = [], oe = [];
          for (const Y of V) {
            const ee = Y.target, ue = yn(ee);
            Number.isFinite(ue) && (Y.isIntersecting ? X : oe).push(ue);
          }
          if ((X.length || oe.length) && pt((Y) => {
            let ee = null;
            for (const ue of X)
              Y.has(ue) || (ee = ee || new Set(Y), ee.add(ue));
            for (const ue of oe)
              Y.has(ue) && (ee = ee || new Set(Y), ee.delete(ue));
            return ee || Y;
          }), X.length) {
            for (const Y of X) {
              const ee = _.get(Y);
              ee && (clearTimeout(ee), _.delete(Y));
            }
            re((Y) => {
              let ee = null;
              for (const ue of X)
                Y.has(ue) || (ee = ee || new Set(Y), ee.add(ue));
              return ee || Y;
            });
          }
          for (const Y of oe)
            _.has(Y) || _.set(Y, setTimeout(() => {
              _.delete(Y), re((ee) => {
                if (!ee.has(Y)) return ee;
                const ue = new Set(ee);
                return ue.delete(Y), ue;
              });
            }, rc));
        },
        { root: c, rootMargin: nc, threshold: 0 }
      );
      le.current = J;
      for (const V of ae.current.values())
        try {
          J.observe(V);
        } catch {
        }
      return () => {
        J.disconnect(), le.current === J && (le.current = null);
        for (const V of _.values()) clearTimeout(V);
        _.clear();
      };
    }, [c]), Fe(() => {
      F(0), G(""), pt(/* @__PURE__ */ new Set()), re(/* @__PURE__ */ new Set()), Se(/* @__PURE__ */ new Map()), ae.current.clear();
      const _ = se.current;
      for (const J of _.values()) clearTimeout(J);
      _.clear(), h == null || h(0, t);
    }, [I, h, t]);
    const et = $(
      ({ numPages: _ }) => {
        T.current === I && (F(_), G(""), h == null || h(_, t), d == null || d({ numPages: _, pane: t }));
      },
      [I, d, h, t]
    ), Ot = $(
      (_) => {
        if (T.current !== I) return;
        const J = (_ == null ? void 0 : _.message) || "PDF 解析失败";
        G(J), F(0), h == null || h(0, t), f == null || f(_, t);
      },
      [I, f, h, t]
    ), Me = Z(
      () => E > 0 ? Array.from({ length: E }, (_, J) => J + 1) : [],
      [E]
    );
    j(() => {
      typeof IntersectionObserver < "u" || re(new Set(Me));
    }, [Me]);
    const Ae = Z(
      () => Bn(b, v, t),
      [b, v, t]
    ), Ne = Z(() => {
      const _ = /* @__PURE__ */ new Map();
      for (const J of m) {
        const V = Bn(J, v, t);
        if (!V) continue;
        const X = _.get(V.box.page) || [];
        X.push(V), _.set(V.box.page, X);
      }
      return _;
    }, [t, v, m]), tt = Z(() => {
      const _ = /* @__PURE__ */ new Set();
      if (!y) return _;
      for (const [J, V] of Ne)
        V.some((X) => X.itemId === y) && _.add(J);
      return _;
    }, [y, Ne]), gt = Z(() => {
      if (E === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(Me);
      if (ke.size === 0) {
        const V = Math.min(E, Wt * 2 + 1);
        return new Set(Array.from({ length: V }, (X, oe) => oe + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const V of ke)
        for (let X = -Wt; X <= Wt; X++) {
          const oe = V + X;
          oe >= 1 && oe <= E && J.add(oe);
        }
      return J;
    }, [E, Me, c, a, ke]), bt = !n || !!C || !!W, We = n && (C || W) || s;
    return /* @__PURE__ */ x(
      "section",
      {
        ref: B,
        className: `reader-panel ${is}${a ? "" : " is-hidden"}`,
        [lt]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (P == null ? void 0 : P.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          A ? /* @__PURE__ */ g("div", { className: "reader-react-pdf-pane-action", children: A }) : null,
          S ? /* @__PURE__ */ x("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ g("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ g("span", { children: S })
          ] }) : null,
          bt && !D ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: We }) : null,
          D ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          R && !C ? /* @__PURE__ */ g("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ g(
            ra,
            {
              file: R,
              loading: null,
              error: null,
              options: z,
              onLoadSuccess: et,
              onLoadError: Ot,
              className: "reader-react-pdf-document",
              children: Me.map((_) => {
                if (gt.has(_))
                  return /* @__PURE__ */ g(
                    tc,
                    {
                      pane: t,
                      pageNumber: _,
                      width: H,
                      devicePixelRatio: ne,
                      active: zt.has(_),
                      syncedMinHeight: (l == null ? void 0 : l.get(_)) || 0,
                      onMetrics: u,
                      cachedAspect: he.get(_),
                      onAspectChange: de,
                      sentinelRef: He(_),
                      regionHighlight: (Ae == null ? void 0 : Ae.box.page) === _ ? Ae : null,
                      regionTargets: Ne.get(_),
                      hoveredRegionId: y && tt.has(_) ? y : null,
                      onHoverRegion: w,
                      liveTranslationLayout: P == null ? void 0 : P.layoutByPage.get(_ - 1),
                      liveTranslationPage: P == null ? void 0 : P.pagesByPage.get(_ - 1),
                      showLiveTranslation: p
                    },
                    `${t}-${_}`
                  );
                const V = he.get(_) ?? no, X = Math.max(120, Math.floor(H * V)), oe = Math.max(X, Math.ceil((l == null ? void 0 : l.get(_)) || 0));
                return /* @__PURE__ */ g(
                  "div",
                  {
                    ref: He(_),
                    [Ye]: _,
                    [lt]: t,
                    [gn]: X,
                    className: bn,
                    style: {
                      width: H,
                      height: oe,
                      minHeight: oe
                    },
                    children: /* @__PURE__ */ g(
                      "div",
                      {
                        className: Tt,
                        style: { width: H, height: X },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${_}`
                );
              })
            },
            I
          ) }) : null
        ]
      }
    );
  }
), rr = ln(sc), ic = () => () => {
}, or = () => null;
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
  const t = $e(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? ht, b = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, m = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), v = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, y = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, P = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", p = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", S = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, A = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, M = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), D = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), C = e.regions ?? (t == null ? void 0 : t.regions) ?? [], I = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [R, E] = L(null), F = Lt(
    T ? T.subscribe : ic,
    T ? () => T.get().itemId : or,
    T ? () => T.get().itemId : or
  ), W = T ? F : R, G = $((N) => {
    T ? T.set(N, "pdf") : E(N);
  }, [T]), q = cc({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), K = Number.isFinite(b) && b > 0 ? lc(
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
          className: `${as} reader-mode-${q.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            v ? /* @__PURE__ */ g(
              rr,
              {
                pane: "source",
                url: P,
                preloadedFile: S,
                userZoom: h,
                visible: q.showSource,
                scrollRoot: f,
                pageWidthOverride: K,
                rowHeights: q.compareMode ? m : void 0,
                onMetrics: M,
                emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: O,
                activeRegion: D,
                regions: C,
                readerMetadata: I,
                hoveredRegionId: W,
                onHoverRegion: G,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? uc(o) : "",
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
                preloadedFile: A,
                userZoom: h,
                visible: q.showTranslated,
                scrollRoot: f,
                pageWidthOverride: K,
                rowHeights: q.compareMode ? m : void 0,
                onMetrics: M,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: O,
                activeRegion: D,
                regions: C,
                readerMetadata: I,
                hoveredRegionId: W,
                onHoverRegion: G,
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
  const t = $e(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? mc(a.state) : "";
  return /* @__PURE__ */ x("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ x(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ g(Jo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ g("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: fc.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, f = hc({
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
          "aria-label": l,
          title: f ? `${l} 需要文档任务` : l,
          disabled: f,
          onClick: () => o(i),
          children: [
            /* @__PURE__ */ g(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ g("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        i
      );
    }) })
  ] });
}
const gc = {
  markdown: { label: "Markdown", short: "MD", Icon: qo, needsJob: !0 }
}, bc = Or.map(
  (e) => ({ id: e, ...gc[e] })
), yc = {
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
  (e) => ({ id: e, ...yc[e] })
);
function vc(e) {
  return [
    ...bc.map(({ id: t, label: n, short: r, Icon: o, needsJob: a }) => ({
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
function Sc() {
  const e = ce();
  return vc((t) => typeof (e == null ? void 0 : e[t]) == "function");
}
function wc(e) {
  const t = $e(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = Sc();
  return n ? /* @__PURE__ */ x("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ g("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: c.map(({ id: i, label: l, Icon: u, needsJob: d }) => {
      const f = n === i, h = d && o, b = r == null ? void 0 : r[i];
      return /* @__PURE__ */ x(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": f,
          className: `reader-assistant-dock-tab${f ? " is-active" : ""}`,
          title: h ? `${l} 需打开任务阅读` : l,
          disabled: h,
          onClick: () => a(i),
          children: [
            /* @__PURE__ */ g(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
            /* @__PURE__ */ g("span", { className: "reader-assistant-dock-tab-label", children: l }),
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
  ] }) : /* @__PURE__ */ g("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: c.map(({ id: i, label: l, short: u, Icon: d, needsJob: f }) => {
    const h = f && o, b = r == null ? void 0 : r[i];
    return /* @__PURE__ */ x(
      "button",
      {
        type: "button",
        className: "reader-assistant-rail-button",
        "aria-label": `打开${l}`,
        title: h ? `${l} 需打开任务阅读` : l,
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
function Pc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Rc(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Ic(e) {
  return e / 100 * window.innerHeight;
}
function Tc(e) {
  return e / 100 * window.innerWidth;
}
function Ec(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function st({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Ec(n);
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
      r = Rc(t, o);
      break;
    }
    case "em": {
      r = Pc(t, o);
      break;
    }
    case "vh": {
      r = Ic(o);
      break;
    }
    case "vw": {
      r = Tc(o);
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
function rn(e) {
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
      const u = st({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = me(u / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const u = st({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = me(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = st({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = me(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = st({
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
function Q(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function on(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? kc : Mc
  );
}
function kc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Mc(e, t) {
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
function Ac({
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
    const { x: c, y: i } = ao(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return Q(o, "No rect found"), o;
}
let St;
function Nc() {
  return St === void 0 && (typeof matchMedia == "function" ? St = !!matchMedia("(pointer:coarse)").matches : St = !1), St;
}
function so(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = on(
    n,
    Array.from(t.children).filter(oo).map((b) => ({ element: b }))
  ).map(({ element: b }) => b), s = [];
  let c = !1, i = !1, l = -1, u = -1, d = 0, f, h = [];
  {
    let b = -1;
    for (const m of a)
      m.hasAttribute("data-panel") && (b++, m.hasAttribute("data-disabled") || (d++, l === -1 && (l = b), u = b));
  }
  if (d > 1) {
    let b = -1;
    for (const m of a)
      if (m.hasAttribute("data-panel")) {
        b++;
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
                  const A = h[0], M = Ac({
                    orientation: n,
                    rects: [y, w],
                    targetRect: A.element.getBoundingClientRect()
                  });
                  P = [
                    A,
                    M === y ? S : p
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
              const A = Nc() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < A) {
                const O = A - S.width;
                S = new DOMRect(
                  S.x - O / 2,
                  S.y,
                  S.width + O,
                  S.height
                );
              }
              if (S.height < A) {
                const O = A - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - O / 2,
                  S.width,
                  S.height + O
                );
              }
              const M = b <= l || b > u;
              !c && !M && s.push({
                group: e,
                groupSize: Xe({ group: e }),
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
var Te;
class io {
  constructor() {
    Fn(this, Te, {});
  }
  addListener(t, n) {
    const r = nt(this, Te)[t];
    return r === void 0 ? nt(this, Te)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = nt(this, Te)[t];
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
    $n(this, Te, {});
  }
  removeListener(t, n) {
    const r = nt(this, Te)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Te = new WeakMap();
let Ke = {
  cursorFlags: 0,
  state: "inactive"
};
const Pn = new io();
function xe() {
  return Ke;
}
function _c(e) {
  return Pn.addListener("change", e);
}
function Lc(e) {
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
const Cc = (e) => e, Vt = () => {
}, co = 1, lo = 2, uo = 4, fo = 8, ar = 3, sr = 12;
let wt;
function ir() {
  return wt === void 0 && (wt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (wt = !0)), wt;
}
function Dc({
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
          const a = (e & co) !== 0, s = (e & lo) !== 0, c = (e & uo) !== 0, i = (e & fo) !== 0;
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
    return ir() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const cr = /* @__PURE__ */ new WeakMap();
function Rn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = cr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = xe();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Dc({
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
  cr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let ye = /* @__PURE__ */ new Map();
const mo = new io();
function xc(e) {
  ye = new Map(ye), ye.delete(e);
}
function lr(e, t) {
  for (const [n] of ye)
    if (n.id === e)
      return n;
}
function Ee(e, t) {
  for (const [n, r] of ye)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function je() {
  return ye;
}
function In(e, t) {
  return mo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ie(e, t, n) {
  const r = ye.get(e);
  ye = new Map(ye), ye.set(e, t), mo.emit("groupChange", {
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
      Ze({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Rn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Ee(r.group.id, !0);
        Ie(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function ur(e) {
  e.defaultPrevented || ho(e.currentTarget);
}
function zc(e, t, n) {
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
function Oc(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Fc(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: mr(e),
    b: mr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  Q(
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
    let c = a.length;
    for (; c--; ) {
      const i = a[c];
      if (i === s.a) return 1;
      if (i === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
const $c = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function jc(e) {
  const t = getComputedStyle(po(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Bc(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || jc(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || $c.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function dr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (Q(n, "Missing node"), Bc(n)) return n;
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
  return Oc(t) ? t.host : t;
}
function Uc(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Hc({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!oo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Fc(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Uc(r.getBoundingClientRect(), t))
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
    const a = so(o), s = zc(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Hc({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Wc(e, t) {
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
function be(e, t) {
  return fe(e, t) ? 0 : e > t ? 1 : -1;
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
  if (be(r, i) < 0)
    if (a) {
      const l = (o + i) / 2;
      be(r, l) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(c, r), r = me(r), r;
}
function dt({
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
  Q(u != null, "Invalid first pivot index"), Q(d != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const m = e < 0 ? d : u, v = n[m];
        Q(
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
          if (Q(
            p != null,
            `Previous layout not found for panel index ${m}`
          ), fe(p, y)) {
            const S = P - p;
            be(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const m = e < 0 ? u : d, v = n[m];
        Q(
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
          if (Q(
            p != null,
            `Previous layout not found for panel index ${m}`
          ), fe(p, P)) {
            const S = p - y;
            be(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const m = e < 0 ? d : u, v = n[m];
      Q(
        v,
        `Panel constraints not found for index ${m}`
      );
      const y = c[m], { collapsible: w, collapsedSize: P, minSize: p } = v;
      if (w && be(y, p) < 0)
        if (e > 0) {
          const S = p - P, A = S / 2, M = y + e;
          be(M, p) < 0 && (e = be(e, A) <= 0 ? 0 : S);
        } else {
          const S = p - P, A = 100 - S / 2, M = y - e;
          be(M, p) < 0 && (e = be(100 + e, A) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const m = e < 0 ? 1 : -1;
    let v = e < 0 ? d : u, y = 0;
    for (; ; ) {
      const P = c[v];
      Q(
        P != null,
        `Previous layout not found for panel index ${v}`
      );
      const p = Ge({
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
      Q(
        y != null,
        `Previous layout not found for panel index ${m}`
      );
      const w = y - v, P = Ge({
        overrideDisabledPanels: s,
        panelConstraints: n[m],
        prevSize: y,
        size: w
      });
      if (!fe(y, P) && (f += y - P, l[m] = P, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? m-- : m++;
    }
  }
  if (Wc(i, l))
    return o;
  {
    const m = e < 0 ? d : u, v = c[m];
    Q(
      v != null,
      `Previous layout not found for panel index ${m}`
    );
    const y = v + f, w = Ge({
      overrideDisabledPanels: s,
      panelConstraints: n[m],
      prevSize: v,
      size: y
    });
    if (l[m] = w, !fe(w, y)) {
      let P = y - w, p = e < 0 ? d : u;
      for (; p >= 0 && p < n.length; ) {
        const S = l[p];
        Q(
          S != null,
          `Previous layout not found for panel index ${p}`
        );
        const A = S + P, M = Ge({
          overrideDisabledPanels: s,
          panelConstraints: n[p],
          prevSize: S,
          size: A
        });
        if (fe(S, M) || (P -= M - S, l[p] = M), fe(P, 0))
          break;
        e > 0 ? p-- : p++;
      }
    }
  }
  const h = Object.values(l).reduce(
    (m, v) => v + m,
    0
  );
  if (!fe(h, 100, 0.1))
    return o;
  const b = Object.keys(o);
  return l.reduce((m, v, y) => (m[b[y]] = v, m), {});
}
function ze(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || be(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Oe({
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
      Q(i != null, `No layout data found for index ${c}`);
      const l = 100 / o * i;
      r[c] = l;
    }
  let a = 0;
  for (let c = 0; c < t.length; c++) {
    const i = n[c];
    Q(i != null, `No layout data found for index ${c}`);
    const l = r[c];
    Q(l != null, `No layout data found for index ${c}`);
    const u = Ge({
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
      Q(i != null, `No layout data found for index ${c}`);
      const l = i + a, u = Ge({
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
function go({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = je();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: d,
        layout: f,
        groupSize: h,
        separatorToPanels: b
      }
    ] of i)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: d,
          group: l,
          groupSize: h,
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
    const f = a(), h = l.findIndex((v) => v.id === t), b = h === 0, m = h === l.length - 1;
    if (m && i < f && (b || l.slice(0, h).every((v, y) => {
      const w = d[y];
      return (w == null ? void 0 : w.collapsible) && fe(w.collapsedSize, u[w.panelId]);
    }))) {
      const v = l.slice(0, h).reduce((y, w) => y + u[w.id], 0);
      return {
        ...u,
        [t]: me(100 - v)
      };
    }
    return dt({
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
      layout: b,
      separatorToPanels: m
    } = n(), v = s({
      nextSize: i,
      panels: f.panels,
      prevLayout: b,
      derivedPanelConstraints: d
    }), y = Oe({
      layout: v,
      panelConstraints: d
    });
    ze(b, y) || Ie(f, {
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
      return i && fe(l, u);
    },
    resize: (i) => {
      const { group: l } = n(), { element: u } = o(), d = Xe({ group: l }), f = st({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), h = me(f / d * 100);
      c(h);
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
        layout: c,
        separatorToPanels: i
      } = t(), l = Oe({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (ze(c, l) || Ie(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function _e(e, t) {
  const n = Pt(e), r = Ee(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  Q(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  Q(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = bo({ groupId: n.id }).getLayout(), i = dt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = Oe({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  ze(c, l) || Ie(
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
        const r = Pt(t), o = Ee(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (f) => f.element === t
        );
        Q(i, "Matching separator not found");
        const l = c.get(i);
        Q(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (f) => f.panelId === u.id
        );
        if (Q(d, "Panel metadata not found"), d.collapsible) {
          const f = s[u.id], h = d.collapsedSize === f ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          _e(t, h - f);
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
        Q(o !== null, "Index not found");
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
  }), Ze({
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
  let c = 0;
  n.forEach((l) => {
    const { group: u, groupSize: d } = l, { orientation: f, panels: h } = u, { disableCursor: b } = u.mutableState;
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
      separatorToPanels: A
    } = y;
    if (P && S && A) {
      const M = dt({
        delta: m,
        initialLayout: v,
        panelConstraints: P,
        pivotIndices: l.panels.map((O) => h.indexOf(O)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (ze(M, S)) {
        if (m !== 0 && !b)
          switch (f) {
            case "horizontal": {
              c |= m < 0 ? co : lo;
              break;
            }
            case "vertical": {
              c |= m < 0 ? uo : fo;
              break;
            }
          }
      } else
        Ie(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: P,
          groupSize: p,
          layout: M,
          separatorToPanels: A
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & ar : i |= c & ar, t.movementY === 0 ? i |= s & sr : i |= c & sr, Lc(i), Rn(e);
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
        Ze({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Ee(a.group.id, !0);
          Ie(a.group, s, {
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
function vr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (xe().state) {
      case "hover":
        Ze({
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
function Vc(e, t, n) {
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
function Jc(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function qc({
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
        const h = f / 100 * n, b = me(
          h / t * 100
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
      u[d] = me(
        f / a * l
      );
    }
  else {
    const d = me(
      l / i.length
    );
    for (const f of i)
      u[f] = d;
  }
  return u;
}
function Gc(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Ve = /* @__PURE__ */ new Map();
function Kc(e) {
  let t = !0;
  Q(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((b) => {
    for (const m of b) {
      const { borderBoxSize: v, target: y } = m;
      if (y === e.element) {
        if (t) {
          const w = Xe({ group: e });
          if (w === 0)
            return;
          const P = Ee(e.id);
          if (!P)
            return;
          const p = rn(e), S = P.defaultLayoutDeferred ? wr(p) : P.layout, A = qc({
            group: e,
            nextGroupSize: w,
            prevGroupSize: P.groupSize,
            prevLayout: S
          }), M = Oe({
            layout: A,
            panelConstraints: p
          });
          if (!P.defaultLayoutDeferred && ze(P.layout, M) && Jc(
            P.derivedPanelConstraints,
            p
          ) && P.groupSize === w)
            return;
          Ie(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: p,
            groupSize: w,
            layout: M,
            separatorToPanels: P.separatorToPanels
          });
        }
      } else
        Vc(e, y, v);
    }
  });
  a.observe(e.element), e.panels.forEach((b) => {
    Q(
      !r.has(b.id),
      `Panel ids must be unique; id "${b.id}" was used more than once`
    ), r.add(b.id), b.onResize && a.observe(b.element);
  });
  const s = Xe({ group: e }), c = rn(e), i = e.panels.map(({ id: b }) => b).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Gc(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? wr(c), d = Oe({
    layout: u,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Ve.set(
    f,
    (Ve.get(f) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return so(e).forEach((b) => {
    b.separator && h.set(b.separator, b.panels);
  }), Ie(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: h
  }), e.separators.forEach((b) => {
    Q(
      !o.has(b.id),
      `Separator ids must be unique; id "${b.id}" was used more than once`
    ), o.add(b.id), b.element.addEventListener("keydown", pr);
  }), Ve.get(f) === 1 && (f.addEventListener("contextmenu", ur, !0), f.addEventListener("dblclick", hr, !0), f.addEventListener("pointerdown", gr, !0), f.addEventListener("pointerleave", br), f.addEventListener("pointermove", yr), f.addEventListener("pointerout", vr), f.addEventListener("pointerup", Sr, !0)), function() {
    t = !1, Ve.set(
      f,
      Math.max(0, (Ve.get(f) ?? 0) - 1)
    ), xc(e), e.separators.forEach((b) => {
      b.element.removeEventListener("keydown", pr);
    }), Ve.get(f) || (f.removeEventListener(
      "contextmenu",
      ur,
      !0
    ), f.removeEventListener(
      "dblclick",
      hr,
      !0
    ), f.removeEventListener(
      "pointerdown",
      gr,
      !0
    ), f.removeEventListener("pointerleave", br), f.removeEventListener("pointermove", yr), f.removeEventListener("pointerout", vr), f.removeEventListener("pointerup", Sr, !0)), a.disconnect();
  };
}
function Zc() {
  const [e, t] = L({}), n = $(() => t({}), []);
  return [e, n];
}
function En(e) {
  const t = kr();
  return `${e ?? t}`;
}
const Be = typeof window < "u" ? Fe : j;
function it(e) {
  const t = k(e);
  return Be(() => {
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
  return it((t) => {
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
  return Be(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const vo = un(null);
function Yc(e, t) {
  const n = k({
    getLayout: () => ({}),
    setLayout: Cc
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
  const b = k({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), m = it((I) => {
    ze(b.current.onLayoutChange, I) || (b.current.onLayoutChange = I, i == null || i(I));
  }), v = it(
    (I, T) => {
      ze(b.current.onLayoutChanged, I) || (b.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), y = En(c), w = k(null), [P, p] = Zc(), S = k({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), A = kn(w, a);
  Yc(y, s);
  const M = it(
    (I, T) => {
      const R = xe(), E = lr(I), F = Ee(I);
      if (F) {
        let W = !1;
        switch (R.state) {
          case "active": {
            W = R.hitRegions.some(
              (G) => G.group === E
            );
            break;
          }
        }
        return {
          flexGrow: F.layout[T] ?? 1,
          pointerEvents: W ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), O = Mn({
    defaultLayout: n,
    disableCursor: r
  }), D = Z(
    () => ({
      get disableCursor() {
        return !!O.disableCursor;
      },
      getPanelStyles: M,
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
          (W) => W.id === I
        );
        R && (R.panelConstraints.disabled = T);
        const E = lr(y), F = Ee(y);
        E && F && Ie(E, {
          ...F,
          derivedPanelConstraints: rn(E)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: R
      }) => {
        const E = S.current.separators.find(
          (F) => F.id === I
        );
        E && (E.disabled = T, E.disableDoubleClick = R);
      }
    }),
    [M, y, p, u, O]
  ), C = k(null);
  return Be(() => {
    const I = w.current;
    if (I === null)
      return;
    const T = S.current;
    let R;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === T.panels.length) {
      R = {};
      for (const K of T.panels) {
        const N = O.defaultLayout[K.id];
        N !== void 0 && (R[K.id] = N);
      }
    }
    const E = {
      disabled: !!o,
      element: I,
      id: y,
      mutableState: {
        defaultLayout: R,
        disableCursor: !!O.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    C.current = E;
    const F = Kc(E), { defaultLayoutDeferred: W, derivedPanelConstraints: G, layout: q } = Ee(E.id, !0);
    !W && G.length > 0 && (m(q), v(q, !1));
    const B = In(y, (K) => {
      const { defaultLayoutDeferred: N, derivedPanelConstraints: U, layout: te } = K.next;
      if (N || U.length === 0)
        return;
      const ne = E.panels.map(({ id: H }) => H).join(",");
      E.mutableState.layouts[ne] = te, U.forEach((H) => {
        if (H.collapsible) {
          const { layout: he } = K.prev ?? {};
          if (he) {
            const Se = fe(
              H.collapsedSize,
              te[H.panelId]
            ), ke = fe(
              H.collapsedSize,
              he[H.panelId]
            );
            Se && !ke && (E.mutableState.expandedPanelSizes[H.panelId] = he[H.panelId]);
          }
        }
      });
      const z = xe().state !== "active";
      m(te), z && v(te, K.isUserInteraction);
    });
    return () => {
      C.current = null, F(), B();
    };
  }, [
    o,
    y,
    v,
    m,
    u,
    P,
    O
  ]), j(() => {
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
      ref: A,
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
So.displayName = "Group";
function An() {
  const e = dn(vo);
  return Q(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Xc(e, t) {
  const { id: n } = An(), r = k({
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
  groupResizeBehavior: c = "preserve-relative-size",
  id: i,
  maxSize: l = "100%",
  minSize: u = "0%",
  onResize: d,
  panelRef: f,
  style: h,
  ...b
}) {
  const m = !!i, v = En(i), y = Mn({
    disabled: a
  }), w = k(null), P = kn(w, s), {
    getPanelStyles: p,
    id: S,
    orientation: A,
    registerPanel: M,
    updatePanelProps: O
  } = An(), D = d !== null, C = it(
    (E, F, W) => {
      d == null || d(E, i, W);
    }
  );
  Be(() => {
    const E = w.current;
    if (E !== null) {
      const F = {
        element: E,
        id: v,
        idIsStable: m,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? C : void 0,
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
      return M(F);
    }
  }, [
    c,
    n,
    r,
    o,
    D,
    v,
    m,
    l,
    u,
    C,
    M,
    y
  ]), j(() => {
    O(v, { disabled: a });
  }, [a, v, O]), Xc(v, f);
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
        ...Qc,
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
            touchAction: A === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
an.displayName = "Panel";
const Qc = {
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
function el({
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
    a = Oe({
      layout: dt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Oe({
      layout: dt({
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
  ...c
}) {
  const i = En(a), l = Mn({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = L({}), [f, h] = L("inactive"), [b, m] = L(!1), v = k(null), y = kn(v, o), {
    disableCursor: w,
    id: P,
    orientation: p,
    registerSeparator: S,
    updateSeparatorProps: A
  } = An(), M = p === "horizontal" ? "vertical" : "horizontal";
  Be(() => {
    const C = v.current;
    if (C !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: C,
        id: i
      }, T = S(I), R = _c(
        (F) => {
          h(
            F.next.state !== "inactive" && F.next.hitRegions.some(
              (W) => W.separator === I
            ) ? F.next.state : "inactive"
          );
        }
      ), E = In(
        P,
        (F) => {
          const { derivedPanelConstraints: W, layout: G, separatorToPanels: q } = F.next, B = q.get(I);
          if (B) {
            const K = B[0], N = B.indexOf(K);
            d(
              el({
                layout: G,
                panelConstraints: W,
                panelId: K.id,
                panelIndex: N
              })
            );
          }
        }
      );
      return () => {
        R(), E(), T();
      };
    }
  }, [P, i, S, l]), j(() => {
    A(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, A]);
  let O;
  n && !w && (O = "not-allowed");
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
        b ? D = "focus" : D = f;
    }
  return /* @__PURE__ */ g(
    "div",
    {
      ...c,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": M,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": D,
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
wo.displayName = "Separator";
const Nn = 30, _n = 65, ft = 50, tl = 100 - _n, nl = 100 - Nn;
function rl(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(_n, Math.max(Nn, t)) : ft;
}
function Ln(e) {
  return 100 - e;
}
function Je(e) {
  return `${e}%`;
}
const Cn = "reader-document", mt = "reader-assistant", Po = "retainpdf.reader.ai-split-layout.v1", ol = {
  [Cn]: Ln(ft),
  [mt]: ft
};
function Dn(e) {
  const t = rl(e == null ? void 0 : e[mt]);
  return {
    [Cn]: Ln(t),
    [mt]: t
  };
}
function al() {
  try {
    const e = JSON.parse(localStorage.getItem(Po) || "null");
    return Dn(e);
  } catch {
    return ol;
  }
}
function sl(e) {
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
    `${r[mt]}vw`
  );
}
function il() {
  const e = k(null), [t] = L(al);
  Fe(() => {
    const o = e.current;
    return Jt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = $((o) => {
    Jt(e.current, o);
  }, []), r = $((o, a) => {
    Jt(e.current, o), a.isUserInteraction && sl(o);
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
            defaultSize: Je(Ln(ft)),
            minSize: Je(tl),
            maxSize: Je(nl)
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
            id: mt,
            defaultSize: Je(ft),
            minSize: Je(Nn),
            maxSize: Je(_n)
          }
        )
      ]
    }
  );
}
function cl({
  id: e,
  open: t,
  ariaLabel: n,
  className: r = "",
  keepMounted: o = !1,
  onClose: a,
  toolbar: s,
  children: c
}) {
  return j(() => {
    if (!t) return;
    const i = (l) => {
      var d;
      if (l.key !== "Escape") return;
      const u = l.target;
      (d = u == null ? void 0 : u.closest) != null && d.call(u, "textarea, input, select, [contenteditable='true']") || (l.preventDefault(), a());
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
        /* @__PURE__ */ g("div", { className: "reader-notes-panel-body", children: c })
      ]
    }
  );
}
function ll({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = L(!1);
  if (j(() => {
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
function ul({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ g(ll, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ x(_t, { children: [
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
function dl(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function fl() {
  const [e, t] = L(!1), n = kr(), r = k(null);
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
const ml = ["source", "sideBySide", "translated"], hl = { source: "", translated: "", sideBySide: "" };
function pl(e) {
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
function gl(e) {
  const [t, n] = L(() => /* @__PURE__ */ new Set()), r = Z(
    () => e ? pl(e) : hl,
    [e]
  ), o = Z(
    () => ml.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = $(async (s) => {
    if (!e) return;
    const c = Rt(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? Sa(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Pa(
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
        Ra(l), n((u) => {
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
  const t = $e(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = gl(n), c = k(null);
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
  }, []), /* @__PURE__ */ x("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ x("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ g(Zo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ g(Yo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = _o[i], u = Rt(r[i]), d = a.has(i), f = !!u && !d, h = f ? "" : Lo(i, r), b = bl[i];
      return /* @__PURE__ */ x(
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
            /* @__PURE__ */ g(b, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ x("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ x("span", { className: "reader-download-action-label", children: [
                yl[i],
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
const Sl = "retainpdf:reader:bookmarks:v1:", wl = 200;
function xn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ro(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Sl}${t}` : "";
}
function Pl(e) {
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
      const s = Pl(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function sn(e, t, n) {
  const r = Ro(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, wl);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Rl(e, t, n = "", { storage: r = xn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Nt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? sn(e, a.filter((c) => c.page !== s), r) : sn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Il(e, t, n = xn()) {
  return sn(e, Nt(e, n).filter((r) => r.page !== t), n);
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
  return /* @__PURE__ */ g("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ g("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function kl({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = L(() => Nt(e)), [c, i] = L(!1), l = k(null);
  if (j(() => {
    s(Nt(e)), i(!1);
  }, [e]), j(() => {
    if (!c) return;
    const f = (b) => {
      l.current && !l.current.contains(b.target) && i(!1);
    }, h = (b) => {
      b.key === "Escape" && i(!1);
    };
    return document.addEventListener("pointerdown", f), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", f), document.removeEventListener("keydown", h);
    };
  }, [c]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), d = a.some((f) => f.page === u);
  return /* @__PURE__ */ x("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Rl(e, u, Tl(r, u))),
        children: /* @__PURE__ */ g(El, { filled: d })
      }
    ),
    /* @__PURE__ */ g(
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
    c && a.length ? /* @__PURE__ */ g("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ g("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ x("li", { className: f.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ x(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ x("span", { className: "reader-bookmark-page", children: [
              "第 ",
              f.page,
              " 页"
            ] }),
            f.label ? /* @__PURE__ */ g("span", { className: "reader-bookmark-label", children: f.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ g(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${f.page} 页的书签`,
          onClick: () => s(Il(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function Ml(e) {
  const t = $e(), n = to(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? ht, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = ms(a), d = a > xr + 1e-3, f = a < kt - 1e-3, h = qe(r, De()), b = h >= kt ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [m, v] = L(!1), [y, w] = L(`${c}`);
  j(() => {
    m || w(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, m]);
  const P = () => {
    if (v(!1), !l || i <= 0)
      return;
    const p = Number(`${y}`.trim());
    l(Mt(p, i));
  };
  return /* @__PURE__ */ x("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "页码", children: m ? /* @__PURE__ */ x(
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
                p.key === "Escape" && (p.preventDefault(), v(!1), w(`${c}`));
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
        "aria-label": i > 0 ? `跳转页码，当前第 ${c} 页，共 ${i} 页` : "页码",
        title: i > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || i <= 0,
        onClick: () => {
          !l || i <= 0 || (w(`${c}`), v(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ g(
      kl,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
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
          onClick: () => s(ut(a, -1)),
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
          disabled: !f,
          onClick: () => s(ut(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ g(fl, {}) })
  ] });
}
function Pr(e) {
  var t, n;
  return $r(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Al(e) {
  const [t, n] = L(() => ({
    scope: e,
    panel: Pr(ve(e))
  }));
  j(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Pr(ve(e))
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
const Nl = () => () => {
}, _l = () => !1;
function Ll() {
  const e = pa(), t = (e == null ? void 0 : e.available) ?? _l, n = Lt((e == null ? void 0 : e.subscribe) ?? Nl, t, t), r = $(() => !!(e != null && e.available() && e.ask()), [e]);
  return { available: n, ask: r };
}
const cn = "download-toast";
function Cl({
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
function Dl(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Gt.dismiss(cn);
    return;
  }
  Gt.custom(
    () => /* @__PURE__ */ g(Cl, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: cn, duration: 1 / 0 }
  );
}
function xl() {
  const e = $((t) => {
    t && (t.setState = Dl, t.hide = () => Gt.dismiss(cn));
  }, []);
  return /* @__PURE__ */ x(_t, { children: [
    /* @__PURE__ */ g(Wo, { position: "bottom-right" }),
    /* @__PURE__ */ g("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function zl(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : zr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Ol(e, t) {
  return t === null || e !== t;
}
function Io(e) {
  const t = k(!1);
  return e && (t.current = !0), t.current;
}
function Fl(e, t) {
  const n = e === t;
  return { open: n, mounted: Io(n) };
}
function $l({
  panel: e,
  active: t,
  context: n
}) {
  var i;
  const r = t === e.id, o = Io(r);
  if (!(e.keepMounted ? o : r)) return null;
  const s = ce(), c = (i = s == null ? void 0 : s[e.adapterKey]) == null ? void 0 : i.call(s, { ...n, open: r });
  return c == null ? null : /* @__PURE__ */ g(
    cl,
    {
      id: `reader-${e.id}-panel`,
      open: r,
      ariaLabel: e.ariaLabel,
      keepMounted: e.keepMounted,
      className: "is-pane-right",
      onClose: n.onClose,
      children: c
    }
  );
}
const Rr = { itemId: null, origin: null };
function jl() {
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
const Ce = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Bl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Ul = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Hl = {
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
function Wl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Ir(o ?? a ?? "", Bl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Ir(o ?? a ?? "", Ul)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Hl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Vl(e) {
  return Ce(e.translatedBlockText) || Ce(e.translated.text) || Ce(e.source.text);
}
const Jl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function ql(e) {
  const t = [];
  for (const n of e) {
    if (!Jl(n)) continue;
    const r = Wl(Vl(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Gl(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Kl = 24, Zl = 60;
function Tr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Kl), o = Math.min(e.length, n + t.length + Zl), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Yl(e, t, n = 200) {
  const r = Ce(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const c = Ce(a.translatedBlockText) || Ce(a.translated.text), i = c ? Tr(c, r) : null, l = i ?? Tr(Ce(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
const Xl = [];
function Ql({ open: e, onToggle: t }) {
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
  const o = ((h = $e()) == null ? void 0 : h.regions) ?? Xl, a = ((b = to()) == null ? void 0 : b.currentPage) ?? 1, s = Z(() => ql(o), [o]), c = Gl(s, a), [i, l] = L(""), u = Z(() => Yl(o, i), [o, i]), d = k(null), f = k(null);
  return j(() => {
    var m, v, y;
    e === "search" ? (m = d.current) == null || m.focus() : (y = (v = f.current) == null ? void 0 : v.querySelector('[aria-current="location"]')) == null || y.scrollIntoView({ block: "center" });
  }, [e]), /* @__PURE__ */ x("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ x("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ x("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ g(Le, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ g(Le, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ g(Le, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ g(pn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? s.length ? /* @__PURE__ */ g("ol", { ref: f, className: "reader-finder-list", children: s.map((m, v) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ x(
      Le,
      {
        className: "reader-finder-entry",
        "data-level": m.level,
        "aria-current": v === c ? "location" : void 0,
        onClick: () => r(m.itemId),
        children: [
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-text", children: m.text }),
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: m.page })
        ]
      }
    ) }, m.itemId)) }) : /* @__PURE__ */ g("p", { className: "reader-finder-empty", children: o.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ x(_t, { children: [
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
            onChange: (m) => l(m.target.value),
            onKeyDown: (m) => {
              m.key === "Enter" && u[0] && r(u[0].itemId), m.stopPropagation();
            }
          }
        ),
        i.trim() ? /* @__PURE__ */ g("p", { className: "reader-finder-count", children: u.length >= 200 ? "200 处以上，只列前 200 处" : `${u.length} 处` }) : null
      ] }),
      /* @__PURE__ */ g("ol", { className: "reader-finder-list", children: u.map((m) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ x(Le, { className: "reader-finder-entry is-hit", onClick: () => r(m.itemId), children: [
        /* @__PURE__ */ x("span", { className: "reader-finder-entry-text", children: [
          m.snippet.slice(0, m.at),
          /* @__PURE__ */ g("mark", { children: m.snippet.slice(m.at, m.at + m.length) }),
          m.snippet.slice(m.at + m.length)
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: m.page })
      ] }) }, m.itemId)) })
    ] })
  ] });
}
const tu = ko(() => import("./ReaderMarkdownPanel-CLk2oxWM.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
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
  const e = di(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Al(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = L(null), [u, d] = L(null), [f, h] = L(!1), b = k(null), m = k(null), v = s !== null, y = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, w = nu({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: y,
    liveTranslationVisible: f,
    assistantOpen: v,
    assistantPdfPane: i
  }), P = $(() => d(null), []), p = u ? Mo({ jobId: o.jobId, name: u, onClose: P }) : null, S = ni({
    hasOverlayContent: y,
    connection: e.liveTranslation.connection,
    showSource: w.showSource,
    liveTranslationVisible: f,
    assistantOpen: v
  }), A = w.sourceViewOnly, M = w.visibleMode;
  j(() => {
    d(null), h(!1);
  }, [e.viewStateKey]), j(() => {
    e.session.jobTerminal && h(!1);
  }, [e.session.jobTerminal]), j(() => {
    l(null);
  }, [a.scope]), j(() => {
    if (!(t.loading || t.failed)) {
      if (b.current !== e.viewStateKey) {
        b.current = e.viewStateKey;
        const z = ve(e.viewStateKey), H = zl({
          savedMode: z == null ? void 0 : z.mode,
          sourceViewOnly: A,
          viewportWidth: De()
        });
        m.current = H.auto ? H.mode : null, H.mode && H.mode !== e.mode && e.setModeKeepingPage(H.mode);
        return;
      }
      Ol(e.mode, m.current) && (m.current = null, xt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, A]);
  const O = s || (e.mode === "compare" ? "compare" : "reading"), D = Fl(s, "markdown");
  yi({
    mode: M,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const C = $(() => {
    c(null), l(null);
  }, []), I = $((z) => {
    l(null);
    const H = ru(z, e.liveTranslationAvailable);
    H !== null && h(H), e.setModeKeepingPage(z);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), T = Z(() => S.sourcePaneToggle ? /* @__PURE__ */ g(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${f ? " is-active" : ""}`,
      onClick: () => h((z) => !z),
      "aria-pressed": f,
      title: f ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [S.sourcePaneToggle, f]), R = Ll();
  j(() => {
    R.available && s === Er && c(null);
  }, [R.available, s]);
  const E = $((z) => {
    z === Er && R.ask() || (c(z), l(null));
  }, [R.ask]), F = Z(() => ({
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
  }), [C, o.documentId, o.jobId]), [W] = L(jl), [G, q] = L(null), B = $((z) => q((H) => H === z ? null : z), []), K = $((z) => {
    e.jumpToAnchor({ block_id: z }), De() < 900 && q(null);
  }, [e.jumpToAnchor]), N = $((z) => e.jumpToAnchor({ block_id: z }), [e.jumpToAnchor]), U = Z(() => ({
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
    regionHover: W,
    jumpToBlock: N,
    revisedBlocks: e.revisedBlocks,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: A,
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
    W,
    N,
    e.revisedBlocks,
    e.sourceOnly,
    A,
    e.download,
    e.goToPage,
    E,
    C
  ]), te = Z(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), ne = [
    os,
    `is-workspace-${O}`,
    v ? "is-assistant-open" : "",
    G ? "is-finder-open" : "",
    w.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ g(Qi, { value: U, hud: te, children: /* @__PURE__ */ x("div", { className: ne, "data-reader-engine": "react-pdf", "data-reader-workspace": O, children: [
    /* @__PURE__ */ g(ul, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ g(Ql, { open: G, onToggle: B }),
    G ? /* @__PURE__ */ g(
      eu,
      {
        tab: G,
        onTab: q,
        onClose: () => q(null),
        onJump: K
      }
    ) : null,
    /* @__PURE__ */ x("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ g(Ai, {}),
      /* @__PURE__ */ g(vl, {}),
      /* @__PURE__ */ g(Ti, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ g(
      pc,
      {
        mode: M,
        documentReady: !!o.jobId,
        sourceViewOnly: A,
        onModeChange: I,
        liveTranslation: S.topBarPill ? {
          visible: f,
          state: e.liveTranslation,
          onToggle: () => h((z) => !z)
        } : null
      }
    ),
    /* @__PURE__ */ g(wc, { active: s }),
    v ? /* @__PURE__ */ g(il, {}) : null,
    /* @__PURE__ */ g(dc, { paneComposition: w, markdownSplit: D.open, assistantSplit: v, liveTranslation: e.liveTranslation, sourcePaneAction: T }),
    p,
    e.showHud ? /* @__PURE__ */ g(
      Ml,
      {
        mode: M,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ x(Eo, { fallback: null, children: [
      ro.map((z) => /* @__PURE__ */ g(
        $l,
        {
          panel: z,
          active: s,
          context: F
        },
        z.id
      )),
      D.mounted ? /* @__PURE__ */ g(tu, { open: D.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: C }) : null
    ] }),
    /* @__PURE__ */ g(xl, {})
  ] }) });
}
function Iu() {
  return /* @__PURE__ */ g(ou, {});
}
export {
  Iu as R,
  ou as a,
  cl as b,
  Pu as d,
  wu as f,
  Ru as r,
  $e as u
};
//# sourceMappingURL=ReaderApp-CF94ywTB.js.map
