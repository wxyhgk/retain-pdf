var Dn = (e) => {
  throw TypeError(e);
};
var Cn = (e, t, n) => t.has(e) || Dn("Cannot " + n);
var et = (e, t, n) => (Cn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), zn = (e, t, n) => t.has(e) ? Dn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), xn = (e, t, n, r) => (Cn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsx as v, jsxs as j, Fragment as on } from "react/jsx-runtime";
import { useMemo as K, useState as D, useEffect as $, useCallback as F, useRef as k, useLayoutEffect as ze, useSyncExternalStore as an, memo as sn, createContext as cn, useContext as ln, forwardRef as vo, useImperativeHandle as un, useId as wr, Suspense as So, lazy as wo } from "react";
import { getReaderAdapters as me, requireAdapter as Ze, renderReaderBoardSlot as Po } from "./adapters.js";
import { resolveReaderDownloadName as Ro, resolveReaderDownloadUrls as Io, READER_PROGRESS_COPY as we, trimString as wt, READER_DOWNLOAD_ACTIONS as Eo, disabledReason as To } from "./runtime/state.js";
import "@retainpdf/api/conversations";
import { r as Mo, b as ko } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Ht, isFinishedJobStatus as dn } from "@retainpdf/domain/job";
import { c as Ao, n as _o, f as Ct, j as On, a as No, b as Lo, h as Pr, p as fn, d as Do, k as Fn, i as Co } from "./reader-regions-CP3ZMHPc.js";
import { fetchDocumentReading as zo } from "@retainpdf/api/documents";
import { isReaderTransportError as xo, createReaderTransportError as Oo } from "./contracts.js";
import { toast as Wt, Toaster as Fo } from "sonner";
import { NotebookPen as $o, X as Rr, Radio as jo, FileText as Ir, Columns2 as Er, Languages as Tr, FileCode2 as Bo, Sparkles as Uo, Keyboard as Ho, Download as Wo, ChevronDown as Vo } from "lucide-react";
import { pdfjs as Jo, Page as qo, Document as Go } from "react-pdf";
import { e as Ko, m as Zo, a as Yo } from "./markdown-math-XkF5urpn.js";
const Xo = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Qo = "", ea = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ta = (e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Vl = (...e) => {
  var n;
  return (((n = me()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Pe = () => Ze("defaultReaderDataPort"), $n = () => Ze("defaultReaderPageConfigPort"), Jl = {
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
}, Mr = {
  messageTargetOrigin: () => $n().messageTargetOrigin(),
  readerJobId: () => $n().readerJobId()
}, na = () => {
  var e;
  return ((e = me()) == null ? void 0 : e.liveTranslation) ?? null;
}, ra = () => {
  var e;
  return ((e = me()) == null ? void 0 : e.notesQuote) ?? null;
}, oa = () => {
  var e;
  return ((e = me()) == null ? void 0 : e.notesPanel) ?? null;
}, st = () => {
  var t;
  const e = me();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, At = () => {
  const e = me();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Ze("fetchDocumentByJobId")(...n),
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
}, aa = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, sa = () => {
  var e, t;
  return ((t = (e = me()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ia = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ca = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Ro(...e);
}, la = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Io(...e);
}, ua = (...e) => Ze("downloadProtectedResource")(...e), da = (...e) => Ze("failDownloadToast")(...e), ql = (e, t) => Ze("resolveMarkdownAssetUrl")(e, t), jn = "/api/v1";
function fa() {
  const e = () => {
    var r;
    return Mo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = D(e);
  return $(() => {
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
function ma() {
  const e = fa(), t = K(() => ia(Mr), [e]), n = K(() => sa(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function ha(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: c
  } = e, [i, l] = D({
    documentId: "",
    jobId: ""
  }), [u, d] = D({
    documentId: "",
    jobId: ""
  }), f = i.documentId === t ? i.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || f, [h, S] = D({
    jobId: "",
    documentId: ""
  }), b = h.jobId === g ? h.documentId : "", w = t || b, P = !!t && !g, [p, y] = D(null), _ = (p == null ? void 0 : p.sessionIdentity) === r && p.documentId === w ? p : null, M = P || !!_, z = F((L) => {
    const R = `${L.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      S({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const E = `${L.revision || ""}`.trim() || `${Date.now()}`;
    y({
      documentId: R,
      revision: E,
      sessionIdentity: o.current
    }), c();
  }, []);
  $(() => {
    y((L) => L && L.sessionIdentity !== r ? null : L);
  }, [r]);
  const C = F((L) => {
    switch (L.type) {
      case "resolved-document-job":
        l({ documentId: L.documentId, jobId: L.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        d({ documentId: L.documentId, jobId: L.jobId });
        break;
      case "resolved-job-document":
        S((R) => R.jobId === L.jobId && R.documentId === L.documentId ? R : { jobId: L.jobId, documentId: L.documentId });
        break;
      case "committed-source":
        y({
          documentId: L.documentId,
          revision: L.revision,
          sessionIdentity: L.sessionIdentity
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
    setResolvedJobDocument: S,
    jobDocumentId: b,
    documentId: w,
    sourceOnly: P,
    committedDocumentSource: p,
    setCommittedDocumentSource: y,
    activeCommittedDocumentSource: _,
    sourceViewOnly: M,
    refreshCommittedDocument: z,
    applyIdentityEvent: C
  };
}
function Bn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function pa(e) {
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
function Un(e, t) {
  return ta(Ht(e, t));
}
function ga(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function ba(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !ga(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Vt({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ea.progress,
        stage: n,
        percent: e,
        text: t
      },
      Mr.messageTargetOrigin()
    );
  } catch {
  }
}
function Pt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Vt({ percent: t, text: n, stage: r });
}
function ya(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = D(null), [l, u] = D(null), [d, f] = D(""), [m, g] = D(0), h = d === n ? c : null, S = d === n ? l : null, b = Bn(h), w = dn(b), P = F(() => {
    g((C) => C + 1);
  }, []), p = F((C) => {
    i(C.jobPayload), u(C.manifestPayload), f(C.sessionIdentity);
  }, []), y = F((C) => {
    i(null), u(null), f(C);
  }, []), _ = k(""), M = k(""), z = F(async () => {
    const C = o.current;
    if (!C || _.current === C) return;
    const L = At().loadJobPayload;
    if (typeof L != "function") return;
    const R = a.current.value;
    _.current = C;
    try {
      const E = await L(C);
      if (s.current || a.current.value !== R || o.current !== C || !E || typeof E != "object")
        return;
      const I = Bn(E);
      i(E), f(r.current), I === "succeeded" && M.current !== C && (M.current = C, g((T) => T + 1));
    } catch {
    } finally {
      _.current === C && (_.current = "");
    }
  }, []);
  return $(() => {
    M.current = "";
  }, [n]), $(() => {
    if (!t || w || !h) return;
    const C = window.setInterval(() => {
      document.visibilityState !== "hidden" && z();
    }, 1e3);
    return () => window.clearInterval(C);
  }, [w, z, h, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: f,
    scopedJobPayload: h,
    scopedManifestPayload: S,
    jobStatus: b,
    jobTerminal: w,
    jobRefreshRevision: m,
    refreshJobArtifacts: P,
    refreshJobStatus: z,
    publishPayload: p,
    clearPayload: y
  };
}
function Jt(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function va(e, t) {
  e(t), Jt(t);
}
function Sa(e) {
  const [t, n] = D(e ? "source" : "compare"), r = F((a) => {
    e && a !== "source" || (n(a), Jt(a));
  }, [e]), o = F((a) => {
    va(n, a);
  }, []);
  return $(() => (e && document.documentElement.classList.add("reader-source-only"), Jt(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Hn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function wa(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Hn(n.active_job_id),
    activeVersionId: Hn(n.active_version_id)
  };
}
function Pa(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ra(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ia(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ea = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ta(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ea.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
function Ma(e) {
  return e ? { data: e.data.slice() } : null;
}
const ka = 2, ge = /* @__PURE__ */ new Map();
function qt(e, t) {
  ge.delete(e), ge.set(e, t);
}
function Aa(e) {
  if (ge.size < ka) return;
  const t = ge.keys().next().value;
  t && ge.delete(t);
}
async function _a(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function kr(e, t = st().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ge.has(r)) {
    const c = ge.get(r);
    return qt(r, c), c;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const c = new Error(`读取 PDF 失败 (${o.status})`);
    c.status = o.status;
    const i = await _a(o);
    throw i && (c.reason = i), c;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return ge.has(r) ? qt(r, s) : (Aa(), ge.set(r, s)), s;
}
const Na = { file: null, loading: !1, error: "" }, La = { file: null, loading: !0, error: "" };
function Da(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = D(null);
  if ($(() => {
    if (t || !n) return;
    const s = ge.get(n);
    if (s) {
      qt(n, s);
      return;
    }
    const c = new AbortController();
    return kr(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Na;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = ge.get(n);
  return a ? { file: a, loading: !1, error: "" } : La;
}
function Ca(e) {
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
async function Gt(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Pt(s, r, n, "download");
  const c = await kr(t, st().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Pt(s, o, n, "download"), c);
}
async function za(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Pt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, c = null;
  return t && a.push(
    Gt({
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
    Gt({
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
function xa(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Oa({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = zo,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(xa(o.href, t, a)), !0);
}
const gt = {
  regions: null,
  metadata: null
};
function Fa(e) {
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
    closingRef: S,
    activeLoadAbortRef: b
  } = e, [w, P] = D(""), [p, y] = D(""), [_, M] = D(null), [z, C] = D(null), [L, R] = D(!1), [E, I] = D(""), [T, x] = D([]), [U, O] = D(() => ({
    source: null,
    translated: null
  })), [V, ne] = D(
    gt
  ), [B, A] = D({
    loading: !0,
    percent: 4,
    text: we.boot,
    stage: "progress",
    failed: !1
  });
  return $(() => {
    const J = new AbortController(), re = h.current.value, Z = Ca({
      sessionEpochRef: h,
      closingRef: S,
      abort: J,
      sessionEpoch: re
    });
    b.current = J;
    const X = At();
    if (S.current)
      return J.abort(), () => {
        b.current === J && (b.current = null);
      };
    function te(ee, ae) {
      Z.markFailed(), A({
        loading: !1,
        percent: 100,
        text: ee,
        stage: "failed",
        failed: !0
      }), Vt({ percent: 100, text: ae, stage: "failed" });
    }
    function he() {
      R(!0), A({
        loading: !1,
        percent: 100,
        text: we.ready,
        stage: "ready",
        failed: !1
      }), Vt({ percent: 100, text: we.ready, stage: "ready" });
    }
    function Se() {
      return l != null && l.documentId ? Un(
        l.documentId,
        l.revision
      ) : Xo() ? Qo : X.resolveResourceUrl(Ht(r));
    }
    async function Me() {
      var ue;
      let ee = { activeJobId: "", activeVersionId: "" };
      try {
        const ie = await ((ue = X.fetchDocument) == null ? void 0 : ue.call(X, r));
        ie && (ee = wa(ie));
      } catch {
      }
      const ae = Pa({
        link: ee,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (ae.kind === "follow-active-job") {
        if (Z.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: ae.jobId
        }), ae.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: ae.activeVersionId,
          sessionIdentity: i
        }), m("source")) : m("compare");
        return;
      }
      if (ae.kind === "open-committed-source") {
        if (Z.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: ae.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const ce = Se();
      if (Z.isInactive()) return;
      P(ce), y(""), I(""), f(i);
      const se = await Gt({
        url: ce,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: Z,
        setBoot: A
      });
      if (!Z.isInactive()) {
        if (!se) {
          te("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        M(se), he();
      }
    }
    async function mt() {
      var H;
      const ee = !l, ae = !!(ee && X.loadSessionSnapshot && X.loadReaderOptionalArtifacts), ce = ae ? X.loadReaderOptionalArtifacts(t) : null, se = await ((H = X.loadSessionSnapshot) == null ? void 0 : H.call(X, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ee && !ae
      })), ue = se ? {
        jobPayload: se.sourcePayload,
        manifestPayload: se.manifestPayload,
        readerMetadata: se.readerMetadata,
        regionsPayload: se.regions,
        readerErrors: se.readerErrors
      } : await X.loadReaderPayload(t, {
        includeOptionalArtifacts: ee
      });
      if (Z.isInactive()) return;
      let ie = null;
      if (n && !r)
        if (se && se.linkedDocument !== void 0)
          ie = se.linkedDocument;
        else {
          try {
            ie = await X.fetchDocumentByJobId(jn, t);
          } catch {
          }
          if (Z.isInactive()) return;
        }
      const Fe = pa(ue.jobPayload) || `${(ie == null ? void 0 : ie.document_id) || ""}`.trim();
      Fe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Fe
      });
      const $e = Ra({
        payloadDocumentId: Fe,
        linkedActiveJobId: `${(ie == null ? void 0 : ie.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ie == null ? void 0 : ie.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if ($e.kind === "restore-committed-source") {
        if (Z.isInactive()) return;
        u({
          type: "committed-source",
          documentId: $e.documentId,
          revision: $e.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const Xe = X.resolveReaderSourcePdf(ue.manifestPayload), Dt = X.resolveReaderTranslatedPdfUrl(ue.jobPayload, ue.manifestPayload), ke = typeof Xe == "string" ? Xe : X.resolveReaderArtifactUrl(Xe), Ae = r || Fe, _e = l != null && l.documentId ? Un(
        l.documentId,
        l.revision
      ) : ke || (Ae ? X.resolveResourceUrl(Ht(Ae)) : ""), Qe = l ? "" : Dt || "";
      P(_e || ""), y(Qe), I(ba(ue.jobPayload, t)), d({
        jobPayload: ue.jobPayload || null,
        manifestPayload: ue.manifestPayload || null,
        sessionIdentity: i
      });
      const ht = () => za({
        sourceFinal: _e || "",
        translatedFinal: Qe,
        fence: Z,
        setBoot: A
      }), pt = !!(_e || Qe), je = ce && pt ? ht() : null;
      je == null || je.catch(() => {
      });
      const N = ce ? await ce : ue;
      if (Z.isInactive()) return;
      if (x(l ? [] : Ao(N.regionsPayload)), O(l ? { source: null, translated: null } : _o(N.readerMetadata)), ne(l ? gt : N.readerErrors ?? gt), !pt) {
        te(we.failed, we.failed);
        return;
      }
      const W = await (je ?? ht());
      if (W.status !== "inactive") {
        if (W.status === "incomplete") {
          te("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        M(W.sourceBytes), C(W.translatedBytes), he();
      }
    }
    async function Lt() {
      R(!1), M(null), C(null), x([]), O({ source: null, translated: null }), ne(gt), Pt(A, 8, we.metadata, "metadata");
      try {
        if (s) {
          await Me();
          return;
        }
        if (!t) {
          te(we.failed, we.failed);
          return;
        }
        await mt();
      } catch (ee) {
        if (Z.isClosedOrStale() || (ee == null ? void 0 : ee.name) === "AbortError") return;
        Z.markFailed();
        const ae = Number(ee == null ? void 0 : ee.status), ce = `${(ee == null ? void 0 : ee.reason) || ""}`, se = Ta({ status: ae, reason: ce, sessionJobId: t });
        if (se && (await Oa({
          apiPrefix: jn,
          documentId: se,
          expiredJobId: t
        }) || Z.isClosedOrStale()))
          return;
        if (Ia({
          status: ae,
          reason: ce,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const ue = ee instanceof Error ? ee.message : we.failed;
        te(ue, ue);
      }
    }
    return Lt(), () => {
      J.abort(), b.current === J && (b.current = null);
    };
  }, [t, r, o, a, s, c, l, g, n, i, u, d, f, m]), {
    sourceUrl: w,
    translatedUrl: p,
    sourceFile: _,
    translatedFile: z,
    assetsReady: L,
    title: E,
    regions: T,
    readerMetadata: U,
    readerErrors: V,
    boot: B
  };
}
function $a() {
  const e = k(!1), t = k(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = ma(), s = k({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = k(a), i = k(""), l = k(""), u = k(() => {
  }), d = F(() => u.current(), []), f = ha({
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
    sourceViewOnly: S
  } = f, { mode: b, setMode: w, switchSessionMode: P } = Sa(S);
  u.current = () => {
    P("source");
  }, c.current = a, i.current = g, l.current = m;
  const p = ya({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: y,
    scopedManifestPayload: _,
    jobStatus: M,
    jobTerminal: z,
    jobRefreshRevision: C,
    refreshJobArtifacts: L,
    refreshJobStatus: R
  } = p, E = Fa({
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
    switchSessionMode: P,
    jobRefreshRevision: C,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), I = F(() => {
    var x;
    e.current = !0, (x = t.current) == null || x.abort();
  }, []), T = K(
    () => ({
      fetchProtected: At().fetchProtected,
      jobId: m,
      jobPayload: y,
      manifestPayload: _,
      sourceUrl: E.sourceUrl,
      translatedUrl: E.translatedUrl,
      sourceOnly: S
    }),
    [m, y, _, E.sourceUrl, E.translatedUrl, S]
  );
  return {
    jobId: m,
    jobStatus: M,
    workflow: `${(y == null ? void 0 : y.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: z,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: b,
    setMode: w,
    sourceUrl: E.sourceUrl,
    translatedUrl: E.translatedUrl,
    sourceFile: E.sourceFile,
    translatedFile: E.translatedFile,
    assetsReady: E.assetsReady,
    boot: E.boot,
    title: E.title,
    regions: E.regions,
    readerMetadata: E.readerMetadata,
    readerErrors: E.readerErrors,
    download: T,
    refreshJobArtifacts: L,
    refreshJobStatus: R,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: I
  };
}
const ja = 160, Ba = 8, Ua = 0;
function Ha() {
  const e = k(null), [t, n] = D(null), [r, o] = D(Ua), a = F((s) => {
    e.current = s, n(s);
  }, []);
  return $(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < ja || o((u) => Math.abs(u - l) < Ba ? u : l);
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
function Wa(e) {
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
const zt = { source: 0, translated: 0 };
function Va(e, t) {
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
  const [d, f] = D(() => ({
    identity: l,
    pages: zt
  })), [m, g] = D(() => ({ identity: l, tick: 0 })), h = d.identity === l ? d.pages : zt, S = m.identity === l ? m.tick : 0, b = Wa({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: w } = b, P = F((R, E) => {
    u.current === l && f((I) => {
      const T = I.identity === l ? I.pages : zt;
      return T[E] === R && I.identity === l ? I : {
        identity: l,
        pages: { ...T, [E]: R }
      };
    });
  }, [l]), p = k(null), y = F(() => {
    p.current && clearTimeout(p.current);
    const R = l;
    p.current = setTimeout(() => {
      p.current = null, u.current === R && g((E) => ({
        identity: R,
        tick: E.identity === R ? E.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  $(() => (p.current && (clearTimeout(p.current), p.current = null), f((R) => R.identity === l && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: l, pages: { source: 0, translated: 0 } }), g((R) => R.identity === l && R.tick === 0 ? R : { identity: l, tick: 0 }), () => {
    p.current && (clearTimeout(p.current), p.current = null);
  }), [l]);
  const _ = K(
    () => Math.max(h.source, h.translated),
    [h]
  ), M = w === "translated" ? h.translated : h.source || h.translated, z = t == null ? void 0 : t.userZoom, C = t == null ? void 0 : t.shellWidth, L = `${l}-${S}-${z}-${n}-${h.source}-${h.translated}-${C}`;
  return {
    ...b,
    numPagesByPane: h,
    hudNumPages: _,
    primaryNumPages: M,
    metricsTick: S,
    onNumPages: P,
    onMetrics: y,
    rowSyncRevision: L
  };
}
const Ge = "data-reader-page", it = "data-reader-pane", mn = "data-natural-height", Ja = "reader-react-root", qa = "reader-react-grid", Ga = "reader-react-scroll-shell", Ka = "reader-react-pdf-pane", Ar = "reader-react-pdf-page", Rt = "reader-react-pdf-page-placeholder", hn = "reader-react-pdf-page-slot";
function It(e, t) {
  const n = e != null ? `[${Ge}="${e}"]` : `[${Ge}]`;
  return t ? `${n}[${it}="${t}"]` : n;
}
function Za() {
  return `.${hn}[${Ge}]`;
}
function pn(e) {
  return Number(e.getAttribute(Ge));
}
const _r = 0.25, Et = 1, Ya = 0.05, ft = 0.5, Xa = 16, Qa = 8, es = 720;
function Ve() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Nr(e) {
  return Number.isFinite(e) && e < es;
}
function He(e, t = Number.POSITIVE_INFINITY) {
  return Nr(t) && (e === "source" || e === "translated") ? Et : ft;
}
function _t(e) {
  return Number.isFinite(e) ? Math.min(Et, Math.max(_r, e)) : ft;
}
function ct(e, t) {
  const n = _t(Number(e) + t * Ya);
  return Math.round(n * 100) / 100;
}
function ts(e) {
  return Math.round(_t(e) * 100);
}
function ns(e) {
  const n = (Number(e) || 0) - Xa - Qa;
  return Math.max(160, Math.floor(n));
}
function rs(e, t = ft) {
  const n = _t(t);
  return ns((Number(e) || 0) * n);
}
function os(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${it}]`)
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
const as = 8;
function ss(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < as ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const is = 200, Lr = [
  "markdown"
], Dr = [
  "terminal"
], cs = [
  ...Lr,
  ...Dr
];
function Cr(e) {
  return cs.includes(e);
}
const ls = "retainpdf:reader:view:v1:", Wn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), us = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function zr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Kt(e) {
  return `${e || ""}`.trim();
}
function ds({
  documentId: e,
  jobId: t
}) {
  const n = Kt(e);
  if (n) return `document:${n}`;
  const r = Kt(t);
  return r ? `job:${r}` : "";
}
function xr(e) {
  const t = Kt(e);
  return t ? `${ls}${t}` : "";
}
function fs(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ms(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Wn.has(t) || !Wn.has(n) || t === n))
    return { left: t, right: n };
}
function hs(e) {
  return e === null ? null : Cr(e) ? e : void 0;
}
function ps(e) {
  return us.has(e) ? e : void 0;
}
function Or(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = fs(t.anchor), r = Number(t.zoom), o = ps(t.mode), a = ms(t.splitLayout), s = hs(t.assistantPanel);
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
function ve(e, t = zr()) {
  const n = xr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Or(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Nt(e, t, n = zr()) {
  const r = xr(e);
  if (!r || !n) return null;
  const o = ve(e, n), a = Or({
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
function gs(e, t, n = "") {
  var f;
  const [r, o] = D(() => {
    var m;
    return ((m = ve(n)) == null ? void 0 : m.zoom) ?? He(e, Ve());
  }), a = k(r), s = k(n);
  a.current = r;
  const c = k(1), i = k(((f = ve(n)) == null ? void 0 : f.zoom) !== void 0);
  $(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = ve(n)) == null ? void 0 : h.zoom;
    i.current = m !== void 0;
    const g = m ?? He(e, Ve());
    c.current = 1, a.current = g, o(g);
  }, [e, n]), $(() => {
    if (i.current) return;
    const m = He(e, Ve()), g = a.current;
    Math.abs(m - g) < 5e-4 || (c.current = 1, a.current = m, o(m));
  }, [e]);
  const l = F((m) => {
    const g = _t(m), h = a.current;
    Math.abs(g - h) < 5e-4 || (c.current = g / (h || 1), i.current = !0, Nt(s.current, { zoom: g }), o(g));
  }, []), u = F((m) => {
    l(ct(a.current, m));
  }, [l]), d = F((m) => {
    l(He(m));
  }, [l]);
  return ze(() => {
    const m = c.current;
    Math.abs(m - 1) < 1e-3 || (c.current = 1, os(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function bs(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = k(t), a = k(n), s = k(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: F((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const gn = 48;
function Fr(e, t = gn) {
  return e.getBoundingClientRect().top + t;
}
function $r(e, t) {
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
  const o = pn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function xt(e, t, n = gn) {
  if (!e)
    return null;
  const r = It(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Fr(e, n), c = $r(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function bn(e, t, n = "auto", r, o = gn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(It(a, r))), c || (c = e.querySelector(It(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), f = Math.max(0, d + s * u - o);
  return n === "auto" ? e.scrollTop = f : e.scrollTo({ top: f, behavior: n }), !0;
}
function ys(e, t, n = "smooth", r) {
  return bn(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Zt(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const c = [], i = () => {
    var u;
    if (a) return;
    bn(
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
function vs(e, t, n) {
  return Zt(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Tt(e, t) {
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
function Ss(e, t, n = !0, r = "", o) {
  const [a, s] = D(1);
  return $(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, u = 0;
    const d = It(void 0, o), f = () => {
      if (i) return;
      const h = Array.from(c.querySelectorAll(d));
      if (!h.length)
        return;
      const S = Fr(c), b = $r(h, S);
      b && s(b.page);
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
const ws = `canvas, .react-pdf__Page, .${Ar}, .${Rt}`, Vn = /* @__PURE__ */ new WeakMap();
function Ps(e) {
  const t = Number(e.getAttribute(mn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Vn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(ws), Vn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Rs(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Is(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Za()).forEach((r) => {
    const o = pn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Ps(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Es(e, t, n = "", r) {
  const [o, a] = D(() => /* @__PURE__ */ new Map()), s = k(o), c = k(r);
  return c.current = r, ze(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
    const f = () => {
      var y;
      if (i) return;
      const P = e.current;
      if (!P) return;
      const p = Is(P);
      Rs(s.current, p) || (s.current = p, a(p)), u && !d && (d = !0, (y = c.current) == null || y.call(c));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), S = window.setTimeout(m, 700), b = e.current;
    let w = null;
    return b && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => m()), w.observe(b)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(S), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const Ts = [0, 48, 140, 320, 560], Ms = 700, ks = [80, 200, 400], As = 500, _s = 50, Ns = /* @__PURE__ */ new Set([
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
]), Ls = 180, Jn = [0, 48, 140, 320, 700, 1200];
function Ds(e, t) {
  var E;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = k(
    ((E = ve(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
  ), i = k(null), l = k(!1), u = k(r), d = k(null), f = k(null), m = k(null), g = k(null), h = k(a), S = k(""), b = k(n);
  b.current = n;
  const w = F(() => {
    var I;
    (I = d.current) == null || I.call(d), d.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), P = F(() => {
    !l.current && i.current == null || (w(), m.current != null && (clearTimeout(m.current), m.current = null), i.current = null, l.current = !1);
  }, [w]), p = F((I = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const T = () => {
      g.current = null, Nt(h.current, {
        anchor: pe(c.current)
      });
    };
    I ? T() : g.current = setTimeout(T, Ls);
  }, []), y = F((I) => {
    c.current = pe(I), i.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, _s);
  }, []);
  $(() => {
    if (!o)
      return;
    let I = !1, T = null, x = null, U = null;
    const O = () => {
      if (I) return;
      const V = e.current;
      if (!V) {
        U = setTimeout(O, 50);
        return;
      }
      T = V, x = () => {
        if (l.current)
          return;
        const ne = xt(T, b.current);
        ne && (c.current = ne, p());
      }, T.addEventListener("scroll", x, { passive: !0 }), l.current || x();
    };
    return O(), () => {
      I = !0, U != null && clearTimeout(U), T && x && T.removeEventListener("scroll", x);
    };
  }, [o, r, n, e, p]), $(() => {
    if (!o) return;
    const I = e.current;
    if (!I) return;
    const T = (x) => {
      x.metaKey || x.ctrlKey || x.altKey || Ns.has(x.key) && P();
    };
    return I.addEventListener("wheel", P, { passive: !0 }), I.addEventListener("touchmove", P, { passive: !0 }), window.addEventListener("keydown", T), () => {
      I.removeEventListener("wheel", P), I.removeEventListener("touchmove", P), window.removeEventListener("keydown", T);
    };
  }, [o, e, P]), ze(() => {
    var T;
    if (h.current === a) return;
    p(!0), w(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, S.current = "";
    const I = (T = ve(a)) == null ? void 0 : T.anchor;
    c.current = I ? pe(I) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, p, w]), $(() => {
    var T;
    if (!o || !s || !a || S.current === a) return;
    S.current = a;
    const I = pe(
      ((T = ve(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = I, i.current = I, l.current = !0, w(), d.current = Zt(
      () => e.current,
      I,
      {
        behavior: "auto",
        pane: b.current,
        delaysMs: Jn,
        onDone: () => y(I)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(I);
    }, Math.max(...Jn) + 160), () => w();
  }, [o, s, a, e, y, w]), $(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, w();
      return;
    }
    const I = i.current ? pe(i.current) : pe(c.current);
    return l.current = !0, i.current = I, c.current = I, w(), d.current = Zt(
      () => e.current,
      I,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ts,
        onDone: () => y(I)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(I);
    }, Ms), () => {
      w();
    };
  }, [r, o, n, e, y, w]), $(() => () => {
    w(), m.current != null && (clearTimeout(m.current), m.current = null), p(!0);
  }, [w, p]);
  const _ = F(() => {
    const I = xt(
      e.current,
      b.current
    );
    return pe(I || c.current);
  }, [e]), M = F(() => {
    l.current = !0;
    const I = xt(
      e.current,
      b.current
    ), T = pe(I ?? c.current);
    return c.current = T, i.current = T, p(), T;
  }, [e, p]), z = F((I, T, x) => {
    const U = x || b.current, O = Tt(I, T || 1), V = { page: O, fraction: 0 };
    c.current = V, l.current = !0, i.current = V, p(), w(), ys(e.current, O, "smooth", U), d.current = vs(
      () => e.current,
      O,
      {
        behavior: "auto",
        pane: U,
        delaysMs: ks,
        onDone: () => y(V)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(V);
    }, As);
  }, [e, y, w, p]), C = F(() => pe(c.current), []), L = F(() => l.current, []), R = F(() => {
    if (!l.current || !i.current)
      return;
    const I = pe(i.current);
    bn(
      e.current,
      I,
      "auto",
      b.current
    );
  }, [e]);
  return {
    lockFromShell: _,
    beginModeSwitch: M,
    goToPage: z,
    getAnchor: C,
    isRestoring: L,
    repinIfRestoring: R
  };
}
function Cs(e, t) {
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
function jr(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const zs = [0, 80, 200, 400, 800], xs = 120, Os = 400;
function Fs(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l } = e, u = k(a);
  u.current = a;
  const d = k(s);
  d.current = s;
  const f = k(c);
  f.current = c;
  const m = k(n);
  m.current = n, $(() => {
    var P, p;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const g = aa(), h = Cs(g, d.current), S = jr(g, h, { jobId: i, documentId: l });
    if (t.current === S)
      return;
    if (h == null) {
      t.current = S, (P = m.current) == null || P.call(m);
      return;
    }
    t.current = S, g && ((p = f.current) == null || p.call(f, g, h));
    const b = [];
    let w = 0;
    for (const y of zs)
      w = Math.max(w, y), b.push(
        setTimeout(() => {
          u.current(h);
        }, y)
      );
    return b.push(
      setTimeout(() => {
        var y;
        (y = m.current) == null || y.call(m);
      }, w + xs)
    ), () => {
      for (const y of b) clearTimeout(y);
    };
  }, [r, o, i, l, t]);
}
function $s(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function js(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Os,
    jobId: c,
    documentId: i,
    applyReaderSearch: l
  } = e, u = k(a);
  u.current = a;
  const d = k(l);
  d.current = l;
  const f = k(0);
  $(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const m = setTimeout(() => {
      var b;
      const g = ((b = globalThis.location) == null ? void 0 : b.search) || "", h = ko(g, o, u.current);
      if (f.current = o, h === null) return;
      const S = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = jr(
        { blockId: S },
        o,
        { jobId: c, documentId: i }
      ), (d.current || $s)(h);
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
function Bs(e) {
  const t = k(""), [n, r] = D(!1), o = F(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId
  };
  Fs(a, t, o), js(e, t, n);
}
const tt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Us(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function qn(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Br(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = qn(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = qn(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Hs(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Br(r, t, n);
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
function Ws(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const Gn = [250, 500, 1e3, 2e3, 4e3], Ot = [80, 160, 320, 640, 1e3, 1500], Kn = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Yt(e, t) {
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
function yn(e) {
  return xo(e) ? `${e.code || ""}`.trim() : "";
}
function bt(e, t) {
  const n = yn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Vs(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Br(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = Oo(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (i) {
      if ((i == null ? void 0 : i.name) === "AbortError") throw i;
      a = i;
      const l = yn(i);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw i;
    }
    const c = Ot[Math.min(s, Ot.length - 1)];
    if (await Yt(c, r), s >= Ot.length + 2) throw a;
  }
}
function Js({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = D(tt), s = k(o), c = k("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = dn(l) ? l : "";
  return $(() => {
    if (!n || !i) {
      c.current = "", s.current = tt, a(tt);
      return;
    }
    const d = r === void 0 ? na() : r, f = c.current === i;
    if (c.current = i, !d) {
      const P = {
        ...f ? s.current : tt,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = P, a(P);
      return;
    }
    const m = new AbortController();
    let g = !1;
    const h = {
      ...f ? s.current : tt,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const S = (P) => {
      m.signal.aborted || a((p) => {
        const y = P(p);
        return s.current = y, y;
      });
    }, b = async () => {
      let P = 0;
      for (; !m.signal.aborted; )
        try {
          const p = await d.fetchLayout(i, { signal: m.signal });
          g = !0, S((y) => ({
            ...y,
            layoutByPage: Us(p),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError") return;
          const y = yn(p);
          if (!(y === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !y)) {
            S((M) => ({
              ...M,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: bt(p, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            S((M) => ({
              ...M,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          S((M) => ({
            ...M,
            connection: "connecting",
            jobStatus: l,
            error: bt(p, "正在等待 OCR 版面数据")
          })), await Yt(Gn[Math.min(P, Gn.length - 1)], m.signal).catch(() => {
          }), P += 1;
        }
    };
    return (async () => {
      if (await b(), !g || m.signal.aborted) return;
      let P = 0;
      for (; !m.signal.aborted; ) {
        u || S((p) => ({
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
              let y;
              try {
                y = await Vs(
                  i,
                  p,
                  s.current,
                  m.signal,
                  d
                );
              } catch (_) {
                if ((_ == null ? void 0 : _.name) === "AbortError" || m.signal.aborted) throw _;
                S((M) => ({
                  ...M,
                  lastSeq: Math.max(M.lastSeq, p.seq),
                  error: bt(_, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              S((_) => {
                const M = Hs(_, p, y);
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
          if ((p == null ? void 0 : p.name) === "AbortError" || m.signal.aborted) return;
          S((y) => ({
            ...y,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: bt(p, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          S((p) => ({
            ...p,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Yt(Kn[Math.min(P, Kn.length - 1)], m.signal).catch(() => {
        }), P += 1;
      }
    })(), () => m.abort();
  }, [n, r, i, u]), o;
}
function qs(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, c = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    c && i > 0 && o.set(c, i);
  }
  return o;
}
function Gs(e, t = !0) {
  const [n, r] = D(() => /* @__PURE__ */ new Map());
  return $(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = At().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((c) => {
      !s && c && r(qs(c));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Ks = 2e3;
function Zs(e) {
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
const Ys = /* @__PURE__ */ new Set(["book", "translate"]);
function Ur(e) {
  return !!(e.jobId && e.sourceUrl && Ys.has(e.workflow));
}
function Xs(e) {
  return !!(Ur(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Qs() {
  const e = $a(), t = Ur({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Xs({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = k({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !dn(o) && (r.current.running = !0);
  const a = Js({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = Ha(), u = Gs(e.jobId, !e.sourceOnly), d = ds({
    documentId: e.documentId,
    jobId: e.jobId
  }), f = `${d}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = gs(e.mode, s, d), h = Va(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: m, shellWidth: i, identityKey: f }
  ), {
    beginModeSwitch: S,
    goToPage: b,
    repinIfRestoring: w
  } = Ds(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: d,
    restoreReady: h.primaryNumPages > 0
  });
  $(() => {
    w();
  }, [i, w]);
  const P = Es(
    s,
    h.compareMode,
    h.rowSyncRevision,
    w
  ), p = Ss(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), y = F((O, V) => {
    var B, A;
    const ne = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((B = h.numPagesByPane) == null ? void 0 : B.source) || 0,
      Number((A = h.numPagesByPane) == null ? void 0 : A.translated) || 0
    );
    b(O, ne, V);
  }, [b, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [_, M] = D(null), z = k(null), C = F((O) => {
    z.current && clearTimeout(z.current), M(O), O && (z.current = setTimeout(() => M(null), Ks));
  }, []);
  $(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const L = F((O) => {
    const V = Ct(e.regions, O);
    return V ? On(V, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), R = F((O, V) => {
    const ne = V || h.primaryPane, B = typeof O == "object" && O ? `${O.block_id || ""}`.trim() : "", A = typeof O == "object" && O ? `${O.image_url || ""}`.trim() : "", J = typeof O == "object" && O ? O.page_idx != null ? Number(O.page_idx) + 1 : O.page != null ? Number(O.page) : null : typeof O == "number" ? O + 1 : null, re = No(e.regions, A, J) || Ct(e.regions, B) || (typeof O == "object" ? Lo(e.regions, O) : null);
    let Z = re ? On(re, ne).page : null;
    Z == null && (Z = Zs(O)), !(Z == null || Z < 1) && (C(re), y(Z, ne));
  }, [C, y, h.primaryPane, e.regions]);
  Bs({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: p,
    goToPage: y,
    resolveBlockPage: L,
    jobId: e.jobId,
    documentId: e.documentId,
    onAnchorApplied: (O) => {
      C(Ct(e.regions, O.blockId));
    }
  });
  const { setModeKeepingPage: E } = bs({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: S
  });
  $(() => {
    C(null);
  }, [f, C]);
  const I = !e.boot.loading && !e.boot.failed, T = K(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), x = K(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), U = K(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: T,
    panes: h,
    sessionFiles: x,
    rowHeights: P,
    goToPage: y,
    activeRegion: _,
    jumpToAnchor: R,
    setModeKeepingPage: E,
    download: e.download,
    showHud: I,
    viewStateKey: d,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, T, h, x, P, y, _, R, E, I, m, g, d, a, n, u]);
  return K(() => ({
    ...U,
    currentPage: p
  }), [U, p]);
}
const ei = [
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
], ti = [
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
      { actions: ["mode-source"], keys: "1", desc: "源文件" },
      { actions: ["mode-compare"], keys: "2", desc: "对照" },
      { actions: ["mode-translated"], keys: "3", desc: "翻译文件" }
    ]
  }
];
function ni(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of ei)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function ri(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const oi = ".reader-notes-panel";
function ai(e) {
  return e instanceof Element ? !!e.closest(oi) : !1;
}
function si(e) {
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
  $(() => {
    if (!l)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || ri(d.target) || ai(d.target))
        return;
      const f = d.key, m = ni(f);
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
              a(ct(o, 1));
              return;
            case "zoom-out":
              a(ct(o, -1));
              return;
            case "zoom-reset":
              a(He(t, Ve()));
              return;
            case "next-page":
              i(Tt(s + 1, c));
              return;
            case "prev-page":
              i(Tt(s - 1, c));
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
const ii = "retainpdf:soft-reader-close";
function Hr(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed") || ""}`.trim();
  } catch {
    return "";
  }
}
function ci() {
  const e = new URL("./index.html", window.location.href), t = Hr();
  return t && e.searchParams.set("embed", t), e.href;
}
function li() {
  if (typeof window > "u" || window.self === window.top || Hr()) return !1;
  try {
    return window.parent.postMessage(
      { type: ii },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function ui(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function di() {
  if (!(typeof window > "u") && !li()) {
    if (ui(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(ci());
  }
}
function Wr({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ v("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function fi({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ j(Wr, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), di();
  }, children: [
    /* @__PURE__ */ v(Rr, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ v("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const mi = { available: !1, open: !1, title: null }, hi = () => () => {
}, pi = () => mi;
function gi() {
  const e = oa(), t = (e == null ? void 0 : e.getState) ?? pi, n = an((e == null ? void 0 : e.subscribe) ?? hi, t, t);
  if (!e || !n.available) return null;
  const r = n.open ? `收起笔记${n.title ? `：${n.title}` : ""}` : "打开这本书的笔记";
  return /* @__PURE__ */ v(Wr, { className: "reader-notes-toggle", label: r, pressed: n.open, onClick: e.toggle, children: /* @__PURE__ */ v($o, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }) });
}
let Zn = !1;
function bi() {
  if (Zn)
    return;
  const e = st().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Jo.GlobalWorkerOptions.workerSrc = e, Zn = !0);
}
const yi = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function vi(e, t, n) {
  return e.flatMap((r) => {
    if (!yi.has(Pr(r.region))) return [];
    const o = fn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Yn(e, t, n) {
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
async function Si(e) {
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
const wi = "reader-text-hover-copy", Pi = "reader-text-hover-id", Vr = "reader-text-hover-tools", Ri = "reader-text-hover-quote";
function Ii(e) {
  const { region: t } = e.highlight, n = `${t.translated.text || ""}`.trim();
  return {
    itemId: e.itemId,
    pageIdx: Math.max(0, t.source.page - 1),
    sourceText: `${t.source.text || ""}`,
    translatedText: n ? t.translated.text : null
  };
}
function Ft({
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
const Jr = 26, Mt = 190;
function qr(e, t = Mt) {
  return e.height < Jr * 2 || e.width < t;
}
const Ei = 72;
function Ti({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = D("idle"), [a, s] = D("idle"), [c, i] = D("idle"), l = k([]), u = (e == null ? void 0 : e.itemId) || "";
  if ($(() => {
    o("idle"), s("idle"), i("idle");
    const P = l.current;
    return () => {
      P.forEach((p) => window.clearTimeout(p)), l.current = [];
    };
  }, [u]), !e) return null;
  const d = Do(e.highlight.region, t), f = Pr(e.highlight.region), m = (P, p) => async (y) => {
    y.preventDefault(), y.stopPropagation();
    const _ = await Si(P);
    p(_ ? "copied" : "failed"), l.current.push(window.setTimeout(() => p("idle"), 1200));
  }, g = f === "formula" ? "复制 LaTeX" : "复制", h = ra(), S = !!(h != null && h.available()), b = (P) => {
    P.preventDefault(), P.stopPropagation();
    const p = !!(h != null && h.send(Ii(e)));
    i(p ? "copied" : "failed"), l.current.push(window.setTimeout(() => i("idle"), 1200));
  }, w = qr(e.rect, S ? Mt + Ei : Mt);
  return /* @__PURE__ */ v("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ v(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": f,
      style: e.rect,
      children: /* @__PURE__ */ j(
        "div",
        {
          className: Vr,
          "data-placement": w ? "outside" : "inside",
          children: [
            /* @__PURE__ */ v(
              Ft,
              {
                className: Pi,
                state: a,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: m(e.itemId, s),
                children: a === "copied" ? "已复制编号" : e.itemId
              }
            ),
            t === "translated" && n > 0 ? /* @__PURE__ */ j("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            d ? /* @__PURE__ */ v(
              Ft,
              {
                className: wi,
                state: r,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: m(d, o),
                children: r === "copied" ? "已复制" : r === "failed" ? "复制失败" : g
              }
            ) : null,
            S ? /* @__PURE__ */ v(
              Ft,
              {
                className: Ri,
                state: c,
                label: "把这一段摘到笔记",
                title: "摘到笔记：原文和译文一起放进打开的笔记",
                onClick: b,
                children: c === "copied" ? "已摘" : c === "failed" ? "没摘上" : "摘到笔记"
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Mi(e, t) {
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
function ki(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = fn(
      Mi(e, a),
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
const Ai = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', _i = 256, nt = /* @__PURE__ */ new Map();
function Ni(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Li(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ko(t, { bareLatex: !0 }), o = Ni(n), a = Zo(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = nt.get(t);
  if (!s && (s = Yo(o, r), nt.set(t, s), nt.size > _i)) {
    const c = nt.keys().next().value;
    c !== void 0 && nt.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function $t(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Re(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Di(e, t) {
  const n = e.typography, r = Re(t) || 1, o = Re(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = $t(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Re(n == null ? void 0 : n.fit_min_font_size_pt), u = Re(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), m = o ? o * r : i, g = Re(n == null ? void 0 : n.leading_em), h = [
    Re(n == null ? void 0 : n.padding_top_pt) || 0,
    Re(n == null ? void 0 : n.padding_right_pt) || 0,
    Re(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Re(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((S) => S * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Ai,
    fontSizePx: Math.max(d, Math.min(f, m)),
    minFontSizePx: d,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || ($t(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : $t(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Ci(e, t, n, r) {
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
const zi = 512, rt = /* @__PURE__ */ new Map();
let Xt = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Xt += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Xt += 1;
}));
function xi(e, t, n, r) {
  return [
    Xt,
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
function Oi({ item: e, pageScale: t }) {
  const n = k(null), r = K(
    () => Li(e.translatedText),
    [e.translatedText]
  ), [o, a] = D(r.fallbackHtml), s = K(
    () => Di(e, t),
    [e, t]
  );
  $(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      d && a(f);
    }), () => {
      d = !1;
    };
  }, [r]), ze(() => {
    const d = n.current;
    if (!d) return;
    const [f, m, g, h] = s.padding, S = Math.max(1, e.rect.width - h - m), b = Math.max(1, e.rect.height - f - g), w = xi(o, S, b, s);
    let P = rt.get(w);
    if (P === void 0 && (P = Ci(
      (p) => (d.style.fontSize = `${p}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      S,
      b,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), rt.set(w, P), rt.size > zi)) {
      const p = rt.keys().next().value;
      p !== void 0 && rt.delete(p);
    }
    d.style.fontSize = `${P.toFixed(2)}px`;
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
function Fi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = K(
    () => ki(e, t, n, r),
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
        Oi,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const $i = sn(Fi), Gr = cn(null), Kr = cn(null);
function ji({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ v(Gr.Provider, { value: e, children: /* @__PURE__ */ v(Kr.Provider, { value: t, children: n }) });
}
function Ye() {
  return ln(Gr);
}
function Bi() {
  return ln(Kr);
}
const Zr = 1.414;
function Ui({
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
  showLiveTranslation: S = r === "source"
}) {
  var B;
  const b = (B = Ye()) == null ? void 0 : B.revisedBlocks, w = k(c ?? Zr), [P, p] = D(w.current);
  $(() => {
    c != null && Math.abs(c - w.current) >= 1e-3 && (w.current = c, p(c));
  }, [c]);
  const y = k(l);
  y.current = l;
  const _ = k((A) => {
    var J;
    (J = y.current) == null || J.call(y, A);
  }).current, M = Math.max(120, Math.floor(t * P)), z = Math.max(M, Math.ceil(a || 0)), C = fn(u, t, M), L = K(
    () => vi(d, t, M),
    [M, d, t]
  ), [R, E] = D(null), I = typeof m == "function", T = I ? f ?? null : R, x = (A) => {
    I ? A !== (f ?? null) && (m == null || m(A)) : E((J) => J === A ? J : A);
  }, U = K(
    () => L.find((A) => A.itemId === T) || null,
    [T, L]
  ), O = (A) => {
    var he, Se;
    if (A.pointerType === "touch") return;
    if (A.buttons !== 0) {
      x(null);
      return;
    }
    if ((Se = (he = A.target) == null ? void 0 : he.closest) != null && Se.call(he, `.${Vr}`)) return;
    const J = A.currentTarget.getBoundingClientRect(), re = A.clientX - J.left, Z = A.clientY - J.top, X = U == null ? void 0 : U.rect;
    if (X && qr(X) && re >= X.left - 4 && re <= X.left + Mt && Z >= X.top - Jr && Z <= X.top) return;
    const te = Yn(L, re, Z);
    x((te == null ? void 0 : te.itemId) || null);
  }, V = (A) => {
    if (A.pointerType === "mouse") return;
    const J = A.currentTarget.getBoundingClientRect(), re = Yn(
      L,
      A.clientX - J.left,
      A.clientY - J.top
    );
    x((re == null ? void 0 : re.itemId) || null);
  }, ne = (A) => {
    !Number.isFinite(A) || A <= 0 || Math.abs(w.current - A) < 1e-3 || (w.current = A, p(A), i == null || i(e, A));
  };
  return /* @__PURE__ */ j(
    "div",
    {
      ref: _,
      [Ge]: e,
      [it]: r,
      [mn]: M,
      className: hn,
      onPointerMoveCapture: O,
      onPointerDown: V,
      onPointerLeave: (A) => {
        A.pointerType === "mouse" && x(null);
      },
      style: {
        width: t,
        height: z,
        minHeight: z
      },
      children: [
        o ? /* @__PURE__ */ v(
          qo,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: !0,
            renderAnnotationLayer: !1,
            className: Ar,
            loading: /* @__PURE__ */ v(
              "div",
              {
                className: Rt,
                style: { width: t, height: M }
              }
            ),
            onLoadSuccess: (A) => {
              try {
                const J = A.getViewport({ scale: 1 });
                if (J.width > 0) {
                  const re = J.height / J.width;
                  ne(re);
                }
              } catch {
              }
              s == null || s();
            },
            onRenderSuccess: () => {
              s == null || s();
            }
          }
        ) : /* @__PURE__ */ v(
          "div",
          {
            className: Rt,
            style: { width: t, height: M },
            "aria-hidden": !0
          }
        ),
        C ? /* @__PURE__ */ v(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: C,
            "aria-hidden": "true"
          }
        ) : null,
        o && S ? /* @__PURE__ */ v(
          $i,
          {
            layoutPage: g,
            pageState: h,
            width: t,
            height: M
          }
        ) : null,
        o && r === "translated" && (b != null && b.size) ? /* @__PURE__ */ v("div", { className: "reader-revised-markers", "aria-hidden": "true", children: L.filter((A) => b.has(A.itemId)).map((A) => /* @__PURE__ */ v(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": A.itemId,
            style: { left: A.rect.left, top: A.rect.top, height: A.rect.height }
          },
          A.itemId
        )) }) : null,
        /* @__PURE__ */ v(
          Ti,
          {
            target: o ? U : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: U && (b == null ? void 0 : b.get(U.itemId)) || 0
          }
        )
      ]
    }
  );
}
const Hi = sn(Ui), jt = 5, Wi = "120% 0px", Vi = 120;
let Xn = 1;
const Qn = /* @__PURE__ */ new WeakMap();
function Ji(e) {
  if (!e) return 0;
  const t = Qn.get(e);
  if (t) return t;
  const n = Xn;
  return Xn += 1, Qn.set(e, n), n;
}
function qi() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Gi = vo(
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
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: w,
    liveTranslation: P,
    showLiveTranslation: p = t === "source",
    liveTranslationPendingLabel: y = "",
    paneAction: _
  }, M) {
    bi();
    const { file: z, loading: C, error: L } = Da(n, r), R = `${n}\0${Ji(z)}`, E = k(R);
    E.current = R;
    const I = K(
      () => Ma(z),
      [z, n]
    ), [T, x] = D(0), [U, O] = D(""), [V, ne] = D(null), [B, A] = D(480), J = k(null), re = k(0), Z = K(() => qi(), []), X = K(() => ({
      cMapUrl: st().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: st().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    un(M, () => V, [V]), $(() => {
      const N = (q) => {
        re.current = q, A(q);
      }, W = (q) => {
        const Q = ss(q, re.current);
        if (Q !== "ignore") {
          if (J.current && clearTimeout(J.current), Q === "immediate") {
            N(q);
            return;
          }
          J.current = setTimeout(() => N(q), is);
        }
      }, H = !!(i && i >= 80);
      W(H ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const oe = !H && c && typeof ResizeObserver < "u" ? new ResizeObserver((q) => {
        var Q, le;
        W(((le = (Q = q[0]) == null ? void 0 : Q.contentRect) == null ? void 0 : le.width) ?? c.clientWidth);
      }) : null;
      return oe && c && oe.observe(c), () => {
        oe == null || oe.disconnect(), J.current && clearTimeout(J.current);
      };
    }, [i, c, a]);
    const te = K(
      () => rs(B, o),
      [B, o]
    ), [he, Se] = D(() => /* @__PURE__ */ new Map()), [Me, mt] = D(() => /* @__PURE__ */ new Set()), [Lt, ee] = D(() => /* @__PURE__ */ new Set()), ae = k(/* @__PURE__ */ new Map()), ce = k(null), se = k(/* @__PURE__ */ new Map()), ue = F((N, W) => {
      Se((H) => {
        if (H.get(N) === W) return H;
        const G = new Map(H);
        return G.set(N, W), G;
      });
    }, []), ie = F((N, W) => {
      const H = ae.current, G = H.get(N);
      if (G && ce.current)
        try {
          ce.current.unobserve(G);
        } catch {
        }
      if (W) {
        if (H.set(N, W), ce.current)
          try {
            ce.current.observe(W);
          } catch {
          }
      } else
        H.delete(N);
    }, []), Fe = k(/* @__PURE__ */ new Map()), $e = F((N) => {
      const W = Fe.current;
      let H = W.get(N);
      return H || (H = (G) => ie(N, G), W.set(N, H)), H;
    }, [ie]);
    $(() => {
      if (typeof IntersectionObserver > "u") return;
      const N = se.current, W = new IntersectionObserver(
        (H) => {
          const G = [], oe = [];
          for (const q of H) {
            const Q = q.target, le = pn(Q);
            Number.isFinite(le) && (q.isIntersecting ? G : oe).push(le);
          }
          if ((G.length || oe.length) && mt((q) => {
            let Q = null;
            for (const le of G)
              q.has(le) || (Q = Q || new Set(q), Q.add(le));
            for (const le of oe)
              q.has(le) && (Q = Q || new Set(q), Q.delete(le));
            return Q || q;
          }), G.length) {
            for (const q of G) {
              const Q = N.get(q);
              Q && (clearTimeout(Q), N.delete(q));
            }
            ee((q) => {
              let Q = null;
              for (const le of G)
                q.has(le) || (Q = Q || new Set(q), Q.add(le));
              return Q || q;
            });
          }
          for (const q of oe)
            N.has(q) || N.set(q, setTimeout(() => {
              N.delete(q), ee((Q) => {
                if (!Q.has(q)) return Q;
                const le = new Set(Q);
                return le.delete(q), le;
              });
            }, Vi));
        },
        { root: c, rootMargin: Wi, threshold: 0 }
      );
      ce.current = W;
      for (const H of ae.current.values())
        try {
          W.observe(H);
        } catch {
        }
      return () => {
        W.disconnect(), ce.current === W && (ce.current = null);
        for (const H of N.values()) clearTimeout(H);
        N.clear();
      };
    }, [c]), ze(() => {
      x(0), O(""), mt(/* @__PURE__ */ new Set()), ee(/* @__PURE__ */ new Set()), Se(/* @__PURE__ */ new Map()), ae.current.clear();
      const N = se.current;
      for (const W of N.values()) clearTimeout(W);
      N.clear(), m == null || m(0, t);
    }, [R, m, t]);
    const Xe = F(
      ({ numPages: N }) => {
        E.current === R && (x(N), O(""), m == null || m(N, t), d == null || d({ numPages: N, pane: t }));
      },
      [R, d, m, t]
    ), Dt = F(
      (N) => {
        if (E.current !== R) return;
        const W = (N == null ? void 0 : N.message) || "PDF 解析失败";
        O(W), x(0), m == null || m(0, t), f == null || f(N, t);
      },
      [R, f, m, t]
    ), ke = K(
      () => T > 0 ? Array.from({ length: T }, (N, W) => W + 1) : [],
      [T]
    );
    $(() => {
      typeof IntersectionObserver < "u" || ee(new Set(ke));
    }, [ke]);
    const Ae = K(
      () => Fn(g, S, t),
      [g, S, t]
    ), _e = K(() => {
      const N = /* @__PURE__ */ new Map();
      for (const W of h) {
        const H = Fn(W, S, t);
        if (!H) continue;
        const G = N.get(H.box.page) || [];
        G.push(H), N.set(H.box.page, G);
      }
      return N;
    }, [t, S, h]), Qe = K(() => {
      const N = /* @__PURE__ */ new Set();
      if (!b) return N;
      for (const [W, H] of _e)
        H.some((G) => G.itemId === b) && N.add(W);
      return N;
    }, [b, _e]), ht = K(() => {
      if (T === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(ke);
      if (Me.size === 0) {
        const H = Math.min(T, jt * 2 + 1);
        return new Set(Array.from({ length: H }, (G, oe) => oe + 1));
      }
      const W = /* @__PURE__ */ new Set();
      for (const H of Me)
        for (let G = -jt; G <= jt; G++) {
          const oe = H + G;
          oe >= 1 && oe <= T && W.add(oe);
        }
      return W;
    }, [T, ke, c, a, Me]), pt = !n || !!L || !!U, je = n && (L || U) || s;
    return /* @__PURE__ */ j(
      "section",
      {
        ref: ne,
        className: `reader-panel ${Ka}${a ? "" : " is-hidden"}`,
        [it]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (P == null ? void 0 : P.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          _ ? /* @__PURE__ */ v("div", { className: "reader-react-pdf-pane-action", children: _ }) : null,
          y ? /* @__PURE__ */ j("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ v("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ v("span", { children: y })
          ] }) : null,
          pt && !C ? /* @__PURE__ */ v("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: je }) : null,
          C ? /* @__PURE__ */ v("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          I && !L ? /* @__PURE__ */ v("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ v(
            Go,
            {
              file: I,
              loading: null,
              error: null,
              options: X,
              onLoadSuccess: Xe,
              onLoadError: Dt,
              className: "reader-react-pdf-document",
              children: ke.map((N) => {
                if (ht.has(N))
                  return /* @__PURE__ */ v(
                    Hi,
                    {
                      pane: t,
                      pageNumber: N,
                      width: te,
                      devicePixelRatio: Z,
                      active: Lt.has(N),
                      syncedMinHeight: (l == null ? void 0 : l.get(N)) || 0,
                      onMetrics: u,
                      cachedAspect: he.get(N),
                      onAspectChange: ue,
                      sentinelRef: $e(N),
                      regionHighlight: (Ae == null ? void 0 : Ae.box.page) === N ? Ae : null,
                      regionTargets: _e.get(N),
                      hoveredRegionId: b && Qe.has(N) ? b : null,
                      onHoverRegion: w,
                      liveTranslationLayout: P == null ? void 0 : P.layoutByPage.get(N - 1),
                      liveTranslationPage: P == null ? void 0 : P.pagesByPage.get(N - 1),
                      showLiveTranslation: p
                    },
                    `${t}-${N}`
                  );
                const H = he.get(N) ?? Zr, G = Math.max(120, Math.floor(te * H)), oe = Math.max(G, Math.ceil((l == null ? void 0 : l.get(N)) || 0));
                return /* @__PURE__ */ v(
                  "div",
                  {
                    ref: $e(N),
                    [Ge]: N,
                    [it]: t,
                    [mn]: G,
                    className: hn,
                    style: {
                      width: te,
                      height: oe,
                      minHeight: oe
                    },
                    children: /* @__PURE__ */ v(
                      "div",
                      {
                        className: Rt,
                        style: { width: te, height: G },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${N}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), er = sn(Gi), Ki = () => () => {
}, tr = () => null;
function Zi({
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
function Yi(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Xi(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Qi(e) {
  const t = Ye(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? ft, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), S = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, b = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, P = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", p = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", y = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, _ = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, M = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), z = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), C = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), L = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), E = (t == null ? void 0 : t.regionHover) ?? null, [I, T] = D(null), x = an(
    E ? E.subscribe : Ki,
    E ? () => E.get().itemId : tr,
    E ? () => E.get().itemId : tr
  ), U = E ? x : I, O = F((A) => {
    E ? E.set(A, "pdf") : T(A);
  }, [E]), V = Zi({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), B = Number.isFinite(g) && g > 0 ? Yi(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return /* @__PURE__ */ v(
    "div",
    {
      ref: d,
      className: Ga,
      "data-reader-region-count": L.length,
      "data-reader-structured-region-count": L.filter(Co).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ j(
        "main",
        {
          className: `${qa} reader-mode-${V.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            S ? /* @__PURE__ */ v(
              er,
              {
                pane: "source",
                url: P,
                preloadedFile: y,
                userZoom: m,
                visible: V.showSource,
                scrollRoot: f,
                pageWidthOverride: B,
                rowHeights: V.compareMode ? h : void 0,
                onMetrics: M,
                emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: z,
                activeRegion: C,
                regions: L,
                readerMetadata: R,
                hoveredRegionId: U,
                onHoverRegion: O,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? Xi(o) : "",
                paneAction: u ? /* @__PURE__ */ j(on, { children: [
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
              er,
              {
                pane: "translated",
                url: p,
                preloadedFile: _,
                userZoom: m,
                visible: V.showTranslated,
                scrollRoot: f,
                pageWidthOverride: B,
                rowHeights: V.compareMode ? h : void 0,
                onMetrics: M,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: z,
                activeRegion: C,
                regions: L,
                readerMetadata: R,
                hoveredRegionId: U,
                onHoverRegion: O,
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
const ec = [
  { id: "source", label: "源文件", Icon: Ir },
  { id: "compare", label: "对照", Icon: Er },
  { id: "translated", label: "翻译文件", Icon: Tr }
];
function tc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function nc(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function rc(e) {
  const t = Ye(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? tc(a.state) : "";
  return /* @__PURE__ */ j("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ j(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ v(jo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ v("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ v("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: ec.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, f = nc({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ j(
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
const oc = {
  markdown: { label: "Markdown", short: "MD", Icon: Bo, needsJob: !0 }
}, ac = Lr.map(
  (e) => ({ id: e, ...oc[e] })
), sc = {
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
    Icon: Uo,
    adapterKey: "renderReaderTerminal",
    slot: "terminal",
    ariaLabel: "AI（agent 终端）",
    keepMounted: !0
  }
}, Yr = Dr.map(
  (e) => ({ id: e, ...sc[e] })
);
function ic(e) {
  return [
    ...ac.map(({ id: t, label: n, short: r, Icon: o, needsJob: a }) => ({
      id: t,
      label: n,
      short: r,
      Icon: o,
      needsJob: a
    })),
    ...Yr.filter((t) => e(t.adapterKey)).map(({ id: t, label: n, short: r, Icon: o }) => ({
      id: t,
      label: n,
      short: r,
      Icon: o,
      needsJob: !1
    }))
  ];
}
function cc() {
  const e = me();
  return ic((t) => typeof (e == null ? void 0 : e[t]) == "function");
}
function lc(e) {
  const t = Ye(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = cc();
  return n ? /* @__PURE__ */ j("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ v("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: c.map(({ id: i, label: l, Icon: u, needsJob: d }) => {
      const f = n === i, m = d && o, g = r == null ? void 0 : r[i];
      return /* @__PURE__ */ j(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": f,
          className: `reader-assistant-dock-tab${f ? " is-active" : ""}`,
          title: m ? `${l} 需打开任务阅读` : l,
          disabled: m,
          onClick: () => a(i),
          children: [
            /* @__PURE__ */ v(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
            /* @__PURE__ */ v("span", { className: "reader-assistant-dock-tab-label", children: l }),
            g ? /* @__PURE__ */ v("span", { className: "reader-assistant-dock-badge", children: g }) : null
          ]
        },
        i
      );
    }) }),
    /* @__PURE__ */ v(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ v(Rr, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ v("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: c.map(({ id: i, label: l, short: u, Icon: d, needsJob: f }) => {
    const m = f && o, g = r == null ? void 0 : r[i];
    return /* @__PURE__ */ j(
      "button",
      {
        type: "button",
        className: "reader-assistant-rail-button",
        "aria-label": `打开${l}`,
        title: m ? `${l} 需打开任务阅读` : l,
        disabled: m,
        onClick: () => a(i),
        children: [
          /* @__PURE__ */ v(d, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
          /* @__PURE__ */ v("span", { children: u }),
          g ? /* @__PURE__ */ v("span", { className: "reader-assistant-dock-badge", children: g }) : null
        ]
      },
      i
    );
  }) });
}
function uc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function dc(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function fc(e) {
  return e / 100 * window.innerHeight;
}
function mc(e) {
  return e / 100 * window.innerWidth;
}
function hc(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function ot({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = hc(n);
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
      r = dc(t, o);
      break;
    }
    case "em": {
      r = uc(t, o);
      break;
    }
    case "vh": {
      r = fc(o);
      break;
    }
    case "vw": {
      r = mc(o);
      break;
    }
  }
  return r;
}
function fe(e) {
  return parseFloat(e.toFixed(3));
}
function Ke({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Qt(e) {
  const { panels: t } = e, n = Ke({ group: e });
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
      const u = ot({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = fe(u / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const u = ot({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = fe(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = ot({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = fe(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = ot({
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
function Y(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function en(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? pc : gc
  );
}
function pc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function gc(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Xr(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Qr(e, t) {
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
function bc({
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
    const { x: c, y: i } = Qr(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return Y(o, "No rect found"), o;
}
let yt;
function yc() {
  return yt === void 0 && (typeof matchMedia == "function" ? yt = !!matchMedia("(pointer:coarse)").matches : yt = !1), yt;
}
function eo(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = en(
    n,
    Array.from(t.children).filter(Xr).map((g) => ({ element: g }))
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
        const S = r.find(
          (b) => b.element === h
        );
        if (S) {
          if (f) {
            const b = f.element.getBoundingClientRect(), w = h.getBoundingClientRect();
            let P;
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
              ), y = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (m.length) {
                case 0: {
                  P = [
                    p,
                    y
                  ];
                  break;
                }
                case 1: {
                  const _ = m[0], M = bc({
                    orientation: n,
                    rects: [b, w],
                    targetRect: _.element.getBoundingClientRect()
                  });
                  P = [
                    _,
                    M === b ? y : p
                  ];
                  break;
                }
                default: {
                  P = m;
                  break;
                }
              }
            } else
              m.length ? P = m : P = [
                n === "horizontal" ? new DOMRect(
                  b.right,
                  w.top,
                  w.left - b.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  b.bottom,
                  w.width,
                  w.top - b.bottom
                )
              ];
            for (const p of P) {
              let y = "width" in p ? p : p.element.getBoundingClientRect();
              const _ = yc() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (y.width < _) {
                const z = _ - y.width;
                y = new DOMRect(
                  y.x - z / 2,
                  y.y,
                  y.width + z,
                  y.height
                );
              }
              if (y.height < _) {
                const z = _ - y.height;
                y = new DOMRect(
                  y.x,
                  y.y - z / 2,
                  y.width,
                  y.height + z
                );
              }
              const M = g <= l || g > u;
              !c && !M && s.push({
                group: e,
                groupSize: Ke({ group: e }),
                panels: [f, S],
                separator: "width" in p ? void 0 : p,
                rect: y
              }), c = !1;
            }
          }
          i = !1, f = S, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (c = !0);
        const S = o.find(
          (b) => b.element === h
        );
        S ? m.push(S) : (f = void 0, m = []);
      } else
        i = !0;
  }
  return s;
}
var Ee;
class to {
  constructor() {
    zn(this, Ee, {});
  }
  addListener(t, n) {
    const r = et(this, Ee)[t];
    return r === void 0 ? et(this, Ee)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = et(this, Ee)[t];
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
    xn(this, Ee, {});
  }
  removeListener(t, n) {
    const r = et(this, Ee)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ee = new WeakMap();
let Je = {
  cursorFlags: 0,
  state: "inactive"
};
const vn = new to();
function Le() {
  return Je;
}
function vc(e) {
  return vn.addListener("change", e);
}
function Sc(e) {
  const t = Je, n = { ...Je };
  n.cursorFlags = e, Je = n, vn.emit("change", {
    prev: t,
    next: n
  });
}
function qe(e) {
  const t = Je;
  Je = e, vn.emit("change", {
    prev: t,
    next: e
  });
}
const wc = (e) => e, Bt = () => {
}, no = 1, ro = 2, oo = 4, ao = 8, nr = 3, rr = 12;
let vt;
function or() {
  return vt === void 0 && (vt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (vt = !0)), vt;
}
function Pc({
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
        if (e && or()) {
          const a = (e & no) !== 0, s = (e & ro) !== 0, c = (e & oo) !== 0, i = (e & ao) !== 0;
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
    return or() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const ar = /* @__PURE__ */ new WeakMap();
function Sn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = ar.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Le();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Pc({
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
  ar.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let ye = /* @__PURE__ */ new Map();
const so = new to();
function Rc(e) {
  ye = new Map(ye), ye.delete(e);
}
function sr(e, t) {
  for (const [n] of ye)
    if (n.id === e)
      return n;
}
function Te(e, t) {
  for (const [n, r] of ye)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function xe() {
  return ye;
}
function wn(e, t) {
  return so.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ie(e, t, n) {
  const r = ye.get(e);
  ye = new Map(ye), ye.set(e, t), so.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function io(e) {
  const t = Le();
  let n = !1;
  switch (t.state) {
    case "active":
      qe({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Sn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Te(r.group.id, !0);
        Ie(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function ir(e) {
  e.defaultPrevented || io(e.currentTarget);
}
function Ic(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Qr(n, a.rect);
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
function Ec(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Tc(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: ur(e),
    b: ur(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  Y(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: lr(cr(n.a)),
    b: lr(cr(n.b))
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
const Mc = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function kc(e) {
  const t = getComputedStyle(co(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Ac(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || kc(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Mc.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function cr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (Y(n, "Missing node"), Ac(n)) return n;
  }
  return null;
}
function lr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function ur(e) {
  const t = [];
  for (; e; )
    t.push(e), e = co(e);
  return t;
}
function co(e) {
  const { parentNode: t } = e;
  return Ec(t) ? t.host : t;
}
function _c(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Nc({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Xr(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Tc(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (_c(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Pn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = eo(o), s = Ic(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Nc({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Lc(e, t) {
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
function be(e, t) {
  return de(e, t) ? 0 : e > t ? 1 : -1;
}
function We({
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
  return r = Math.min(c, r), r = fe(r), r;
}
function lt({
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
  Y(u != null, "Invalid first pivot index"), Y(d != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? d : u, S = n[h];
        Y(
          S,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: b = 0,
          collapsible: w,
          minSize: P = 0
        } = S;
        if (w) {
          const p = c[h];
          if (Y(
            p != null,
            `Previous layout not found for panel index ${h}`
          ), de(p, b)) {
            const y = P - p;
            be(y, Math.abs(e)) > 0 && (e = e < 0 ? 0 - y : y);
          }
        }
      }
      {
        const h = e < 0 ? u : d, S = n[h];
        Y(
          S,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: b = 0,
          collapsible: w,
          minSize: P = 0
        } = S;
        if (w) {
          const p = c[h];
          if (Y(
            p != null,
            `Previous layout not found for panel index ${h}`
          ), de(p, P)) {
            const y = p - b;
            be(y, Math.abs(e)) > 0 && (e = e < 0 ? 0 - y : y);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? d : u, S = n[h];
      Y(
        S,
        `Panel constraints not found for index ${h}`
      );
      const b = c[h], { collapsible: w, collapsedSize: P, minSize: p } = S;
      if (w && be(b, p) < 0)
        if (e > 0) {
          const y = p - P, _ = y / 2, M = b + e;
          be(M, p) < 0 && (e = be(e, _) <= 0 ? 0 : y);
        } else {
          const y = p - P, _ = 100 - y / 2, M = b - e;
          be(M, p) < 0 && (e = be(100 + e, _) > 0 ? 0 : -y);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let S = e < 0 ? d : u, b = 0;
    for (; ; ) {
      const P = c[S];
      Y(
        P != null,
        `Previous layout not found for panel index ${S}`
      );
      const p = We({
        overrideDisabledPanels: s,
        panelConstraints: n[S],
        prevSize: P,
        size: 100
      }) - P;
      if (b += p, S += h, S < 0 || S >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(b));
    e = e < 0 ? 0 - w : w;
  }
  {
    let h = e < 0 ? u : d;
    for (; h >= 0 && h < n.length; ) {
      const S = Math.abs(e) - Math.abs(f), b = c[h];
      Y(
        b != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = b - S, P = We({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: b,
        size: w
      });
      if (!de(b, P) && (f += b - P, l[h] = P, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Lc(i, l))
    return o;
  {
    const h = e < 0 ? d : u, S = c[h];
    Y(
      S != null,
      `Previous layout not found for panel index ${h}`
    );
    const b = S + f, w = We({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: S,
      size: b
    });
    if (l[h] = w, !de(w, b)) {
      let P = b - w, p = e < 0 ? d : u;
      for (; p >= 0 && p < n.length; ) {
        const y = l[p];
        Y(
          y != null,
          `Previous layout not found for panel index ${p}`
        );
        const _ = y + P, M = We({
          overrideDisabledPanels: s,
          panelConstraints: n[p],
          prevSize: y,
          size: _
        });
        if (de(y, M) || (P -= M - y, l[p] = M), de(P, 0))
          break;
        e > 0 ? p-- : p++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, S) => S + h,
    0
  );
  if (!de(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, S, b) => (h[g[b]] = S, h), {});
}
function De(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || be(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Ce({
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
    const u = We({
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
      Y(i != null, `No layout data found for index ${c}`);
      const l = i + a, u = We({
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
function lo({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = xe();
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
    const f = a(), m = l.findIndex((S) => S.id === t), g = m === 0, h = m === l.length - 1;
    if (h && i < f && (g || l.slice(0, m).every((S, b) => {
      const w = d[b];
      return (w == null ? void 0 : w.collapsible) && de(w.collapsedSize, u[w.panelId]);
    }))) {
      const S = l.slice(0, m).reduce((b, w) => b + u[w.id], 0);
      return {
        ...u,
        [t]: fe(100 - S)
      };
    }
    return lt({
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
    } = n(), S = s({
      nextSize: i,
      panels: f.panels,
      prevLayout: g,
      derivedPanelConstraints: d
    }), b = Ce({
      layout: S,
      panelConstraints: d
    });
    De(g, b) || Ie(f, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: m,
      layout: b,
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
      return i && de(l, u);
    },
    resize: (i) => {
      const { group: l } = n(), { element: u } = o(), d = Ke({ group: l }), f = ot({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), m = fe(f / d * 100);
      c(m);
    }
  };
}
function dr(e) {
  if (e.defaultPrevented)
    return;
  const t = xe();
  Pn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = lo({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function St(e) {
  const t = xe();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function uo({
  groupId: e
}) {
  const t = () => {
    const n = xe();
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
      } = t(), l = Ce({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (De(c, l) || Ie(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function Ne(e, t) {
  const n = St(e), r = Te(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  Y(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  Y(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = uo({ groupId: n.id }).getLayout(), i = lt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = Ce({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  De(c, l) || Ie(
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
function fr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = St(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && Ne(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Ne(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Ne(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Ne(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Ne(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = St(t), o = Te(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (f) => f.element === t
        );
        Y(i, "Matching separator not found");
        const l = c.get(i);
        Y(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (f) => f.panelId === u.id
        );
        if (Y(d, "Panel metadata not found"), d.collapsible) {
          const f = s[u.id], m = d.collapsedSize === f ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          Ne(t, m - f);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = St(t).separators.map(
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
        e.preventDefault(), Ne(t, -100);
        break;
      }
    }
}
function mr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = xe(), n = Pn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), qe({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function fo({
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
    const S = r.get(u), b = o.get(u);
    if (!S || !b)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: P,
      groupSize: p,
      layout: y,
      separatorToPanels: _
    } = b;
    if (P && y && _) {
      const M = lt({
        delta: h,
        initialLayout: S,
        panelConstraints: P,
        pivotIndices: l.panels.map((z) => m.indexOf(z)),
        prevLayout: y,
        trigger: "mouse-or-touch"
      });
      if (De(M, y)) {
        if (h !== 0 && !g)
          switch (f) {
            case "horizontal": {
              c |= h < 0 ? no : ro;
              break;
            }
            case "vertical": {
              c |= h < 0 ? oo : ao;
              break;
            }
          }
      } else
        Ie(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: P,
          groupSize: p,
          layout: M,
          separatorToPanels: _
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & nr : i |= c & nr, t.movementY === 0 ? i |= s & rr : i |= c & rr, Sc(i), Sn(e);
}
function hr(e) {
  const t = xe(), n = Le();
  switch (n.state) {
    case "active":
      fo({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function pr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = Le(), n = xe();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        qe({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Te(a.group.id, !0);
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
      fo({
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
      const a = Pn(e, n);
      a.length === 0 ? t.state !== "inactive" && qe({
        cursorFlags: 0,
        state: "inactive"
      }) : qe({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Sn(e.currentTarget);
      break;
    }
  }
}
function gr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Le().state) {
      case "hover":
        qe({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function br(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || io(e.currentTarget) && e.preventDefault();
}
function yr(e) {
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
function Dc(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = Ke({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, c = {
    asPercentage: fe(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = c, r.onResize(c, r.id, s);
}
function Cc(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function zc({
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
        const m = f / 100 * n, g = fe(
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
function xc(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Be = /* @__PURE__ */ new Map();
function Oc(e) {
  let t = !0;
  Y(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: S, target: b } = h;
      if (b === e.element) {
        if (t) {
          const w = Ke({ group: e });
          if (w === 0)
            return;
          const P = Te(e.id);
          if (!P)
            return;
          const p = Qt(e), y = P.defaultLayoutDeferred ? yr(p) : P.layout, _ = zc({
            group: e,
            nextGroupSize: w,
            prevGroupSize: P.groupSize,
            prevLayout: y
          }), M = Ce({
            layout: _,
            panelConstraints: p
          });
          if (!P.defaultLayoutDeferred && De(P.layout, M) && Cc(
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
        Dc(e, b, S);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    Y(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Ke({ group: e }), c = Qt(e), i = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (xc(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? yr(c), d = Ce({
    layout: u,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Be.set(
    f,
    (Be.get(f) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return eo(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Ie(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    Y(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", fr);
  }), Be.get(f) === 1 && (f.addEventListener("contextmenu", ir, !0), f.addEventListener("dblclick", dr, !0), f.addEventListener("pointerdown", mr, !0), f.addEventListener("pointerleave", hr), f.addEventListener("pointermove", pr), f.addEventListener("pointerout", gr), f.addEventListener("pointerup", br, !0)), function() {
    t = !1, Be.set(
      f,
      Math.max(0, (Be.get(f) ?? 0) - 1)
    ), Rc(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", fr);
    }), Be.get(f) || (f.removeEventListener(
      "contextmenu",
      ir,
      !0
    ), f.removeEventListener(
      "dblclick",
      dr,
      !0
    ), f.removeEventListener(
      "pointerdown",
      mr,
      !0
    ), f.removeEventListener("pointerleave", hr), f.removeEventListener("pointermove", pr), f.removeEventListener("pointerout", gr), f.removeEventListener("pointerup", br, !0)), a.disconnect();
  };
}
function Fc() {
  const [e, t] = D({}), n = F(() => t({}), []);
  return [e, n];
}
function Rn(e) {
  const t = wr();
  return `${e ?? t}`;
}
const Oe = typeof window < "u" ? ze : $;
function at(e) {
  const t = k(e);
  return Oe(() => {
    t.current = e;
  }, [e]), F(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function In(...e) {
  return at((t) => {
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
function En(e) {
  const t = k({ ...e });
  return Oe(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const mo = cn(null);
function $c(e, t) {
  const n = k({
    getLayout: () => ({}),
    setLayout: wc
  });
  un(t, () => n.current, []), Oe(() => {
    Object.assign(
      n.current,
      uo({ groupId: e })
    );
  });
}
function ho({
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
  const g = k({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = at((R) => {
    De(g.current.onLayoutChange, R) || (g.current.onLayoutChange = R, i == null || i(R));
  }), S = at(
    (R, E) => {
      De(g.current.onLayoutChanged, R) || (g.current.onLayoutChanged = R, l == null || l(R, { isUserInteraction: E }));
    }
  ), b = Rn(c), w = k(null), [P, p] = Fc(), y = k({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), _ = In(w, a);
  $c(b, s);
  const M = at(
    (R, E) => {
      const I = Le(), T = sr(R), x = Te(R);
      if (x) {
        let U = !1;
        switch (I.state) {
          case "active": {
            U = I.hitRegions.some(
              (O) => O.group === T
            );
            break;
          }
        }
        return {
          flexGrow: x.layout[E] ?? 1,
          pointerEvents: U ? "none" : void 0
        };
      }
      if (n != null && n[E])
        return {
          flexGrow: n == null ? void 0 : n[E]
        };
    }
  ), z = En({
    defaultLayout: n,
    disableCursor: r
  }), C = K(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: M,
      id: b,
      orientation: u,
      registerPanel: (R) => {
        const E = y.current;
        return E.panels = en(u, [
          ...E.panels,
          R
        ]), p(), () => {
          E.panels = E.panels.filter(
            (I) => I !== R
          ), p();
        };
      },
      registerSeparator: (R) => {
        const E = y.current;
        return E.separators = en(u, [
          ...E.separators,
          R
        ]), p(), () => {
          E.separators = E.separators.filter(
            (I) => I !== R
          ), p();
        };
      },
      updatePanelProps: (R, { disabled: E }) => {
        const I = y.current.panels.find(
          (U) => U.id === R
        );
        I && (I.panelConstraints.disabled = E);
        const T = sr(b), x = Te(b);
        T && x && Ie(T, {
          ...x,
          derivedPanelConstraints: Qt(T)
        });
      },
      updateSeparatorProps: (R, {
        disabled: E,
        disableDoubleClick: I
      }) => {
        const T = y.current.separators.find(
          (x) => x.id === R
        );
        T && (T.disabled = E, T.disableDoubleClick = I);
      }
    }),
    [M, b, p, u, z]
  ), L = k(null);
  return Oe(() => {
    const R = w.current;
    if (R === null)
      return;
    const E = y.current;
    let I;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === E.panels.length) {
      I = {};
      for (const B of E.panels) {
        const A = z.defaultLayout[B.id];
        A !== void 0 && (I[B.id] = A);
      }
    }
    const T = {
      disabled: !!o,
      element: R,
      id: b,
      mutableState: {
        defaultLayout: I,
        disableCursor: !!z.disableCursor,
        expandedPanelSizes: y.current.lastExpandedPanelSizes,
        layouts: y.current.layouts
      },
      orientation: u,
      panels: E.panels,
      resizeTargetMinimumSize: E.resizeTargetMinimumSize,
      separators: E.separators
    };
    L.current = T;
    const x = Oc(T), { defaultLayoutDeferred: U, derivedPanelConstraints: O, layout: V } = Te(T.id, !0);
    !U && O.length > 0 && (h(V), S(V, !1));
    const ne = wn(b, (B) => {
      const { defaultLayoutDeferred: A, derivedPanelConstraints: J, layout: re } = B.next;
      if (A || J.length === 0)
        return;
      const Z = T.panels.map(({ id: te }) => te).join(",");
      T.mutableState.layouts[Z] = re, J.forEach((te) => {
        if (te.collapsible) {
          const { layout: he } = B.prev ?? {};
          if (he) {
            const Se = de(
              te.collapsedSize,
              re[te.panelId]
            ), Me = de(
              te.collapsedSize,
              he[te.panelId]
            );
            Se && !Me && (T.mutableState.expandedPanelSizes[te.panelId] = he[te.panelId]);
          }
        }
      });
      const X = Le().state !== "active";
      h(re), X && S(re, B.isUserInteraction);
    });
    return () => {
      L.current = null, x(), ne();
    };
  }, [
    o,
    b,
    S,
    h,
    u,
    P,
    z
  ]), $(() => {
    const R = L.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ v(mo.Provider, { value: C, children: /* @__PURE__ */ v(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": b,
      id: b,
      ref: _,
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
ho.displayName = "Group";
function Tn() {
  const e = ln(mo);
  return Y(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function jc(e, t) {
  const { id: n } = Tn(), r = k({
    collapse: Bt,
    expand: Bt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Bt
  });
  un(t, () => r.current, []), Oe(() => {
    Object.assign(
      r.current,
      lo({ groupId: n, panelId: e })
    );
  });
}
function tn({
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
  const h = !!i, S = Rn(i), b = En({
    disabled: a
  }), w = k(null), P = In(w, s), {
    getPanelStyles: p,
    id: y,
    orientation: _,
    registerPanel: M,
    updatePanelProps: z
  } = Tn(), C = d !== null, L = at(
    (T, x, U) => {
      d == null || d(T, i, U);
    }
  );
  Oe(() => {
    const T = w.current;
    if (T !== null) {
      const x = {
        element: T,
        id: S,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: C ? L : void 0,
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
      return M(x);
    }
  }, [
    c,
    n,
    r,
    o,
    C,
    S,
    h,
    l,
    u,
    L,
    M,
    b
  ]), $(() => {
    z(S, { disabled: a });
  }, [a, S, z]), jc(S, f);
  const R = () => {
    const T = p(y, S);
    if (T)
      return JSON.stringify(T);
  }, E = an(
    (T) => wn(y, T),
    R,
    R
  );
  let I;
  return E ? I = JSON.parse(E) : o !== void 0 ? I = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : I = { flexGrow: 1 }, /* @__PURE__ */ v(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": S,
      id: S,
      ref: P,
      style: {
        ...Bc,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...I
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
            ...m,
            // Inform the browser that the library is handling touch events for this element
            // but still allow users to scroll content within panels in the non-resizing direction
            // NOTE This is not an inherited style
            // See github.com/bvaughn/react-resizable-panels/issues/662
            touchAction: _ === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
tn.displayName = "Panel";
const Bc = {
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
function Uc({
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
    a = Ce({
      layout: lt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Ce({
      layout: lt({
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
function po({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...c
}) {
  const i = Rn(a), l = En({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = D({}), [f, m] = D("inactive"), [g, h] = D(!1), S = k(null), b = In(S, o), {
    disableCursor: w,
    id: P,
    orientation: p,
    registerSeparator: y,
    updateSeparatorProps: _
  } = Tn(), M = p === "horizontal" ? "vertical" : "horizontal";
  Oe(() => {
    const L = S.current;
    if (L !== null) {
      const R = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: L,
        id: i
      }, E = y(R), I = vc(
        (x) => {
          m(
            x.next.state !== "inactive" && x.next.hitRegions.some(
              (U) => U.separator === R
            ) ? x.next.state : "inactive"
          );
        }
      ), T = wn(
        P,
        (x) => {
          const { derivedPanelConstraints: U, layout: O, separatorToPanels: V } = x.next, ne = V.get(R);
          if (ne) {
            const B = ne[0], A = ne.indexOf(B);
            d(
              Uc({
                layout: O,
                panelConstraints: U,
                panelId: B.id,
                panelIndex: A
              })
            );
          }
        }
      );
      return () => {
        I(), T(), E();
      };
    }
  }, [P, i, y, l]), $(() => {
    _(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, _]);
  let z;
  n && !w && (z = "not-allowed");
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
      "aria-orientation": M,
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
      ref: b,
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
po.displayName = "Separator";
const Mn = 30, kn = 65, ut = 50, Hc = 100 - kn, Wc = 100 - Mn;
function Vc(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(kn, Math.max(Mn, t)) : ut;
}
function An(e) {
  return 100 - e;
}
function Ue(e) {
  return `${e}%`;
}
const _n = "reader-document", dt = "reader-assistant", go = "retainpdf.reader.ai-split-layout.v1", Jc = {
  [_n]: An(ut),
  [dt]: ut
};
function Nn(e) {
  const t = Vc(e == null ? void 0 : e[dt]);
  return {
    [_n]: An(t),
    [dt]: t
  };
}
function qc() {
  try {
    const e = JSON.parse(localStorage.getItem(go) || "null");
    return Nn(e);
  } catch {
    return Jc;
  }
}
function Gc(e) {
  try {
    localStorage.setItem(go, JSON.stringify(Nn(e)));
  } catch {
  }
}
function Ut(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Nn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[dt]}vw`
  );
}
function Kc() {
  const e = k(null), [t] = D(qc);
  ze(() => {
    const o = e.current;
    return Ut(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = F((o) => {
    Ut(e.current, o);
  }, []), r = F((o, a) => {
    Ut(e.current, o), a.isUserInteraction && Gc(o);
  }, []);
  return /* @__PURE__ */ j(
    ho,
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
          tn,
          {
            id: _n,
            defaultSize: Ue(An(ut)),
            minSize: Ue(Hc),
            maxSize: Ue(Wc)
          }
        ),
        /* @__PURE__ */ v(
          po,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ v("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ v(
          tn,
          {
            id: dt,
            defaultSize: Ue(ut),
            minSize: Ue(Mn),
            maxSize: Ue(kn)
          }
        )
      ]
    }
  );
}
function Zc({
  id: e,
  open: t,
  ariaLabel: n,
  className: r = "",
  keepMounted: o = !1,
  onClose: a,
  toolbar: s,
  children: c
}) {
  return $(() => {
    if (!t) return;
    const i = (l) => {
      var d;
      if (l.key !== "Escape") return;
      const u = l.target;
      (d = u == null ? void 0 : u.closest) != null && d.call(u, "textarea, input, select, [contenteditable='true']") || (l.preventDefault(), a());
    };
    return window.addEventListener("keydown", i), () => window.removeEventListener("keydown", i);
  }, [t, a]), !t && !o ? null : /* @__PURE__ */ j(
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
        s ? /* @__PURE__ */ v("div", { className: "reader-notes-panel-toolbar", children: s }) : null,
        /* @__PURE__ */ v("div", { className: "reader-notes-panel-body", children: c })
      ]
    }
  );
}
function Yc({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = D(!1);
  if ($(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ j("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ j("span", { className: "reader-error-notice-text", children: [
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
function Xc({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ v(Yc, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ j(on, { children: [
    e ? /* @__PURE__ */ v("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ j("div", { className: "reader-boot-loading-card", children: [
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
function Qc(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function el() {
  const [e, t] = D(!1), n = wr(), r = k(null);
  return $(() => {
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
  }, [e]), $(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Qc(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ j("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ v(Ho, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ j(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ j("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ v("div", { className: "reader-react-shortcuts-body", children: ti.map((o) => /* @__PURE__ */ j("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ v("h3", { children: o.title }),
            /* @__PURE__ */ v("ul", { children: o.items.map((a) => /* @__PURE__ */ j("li", { children: [
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
const tl = ["source", "sideBySide", "translated"], nl = { source: "", translated: "", sideBySide: "" };
function rl(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = wt(e.sourceUrl), n = wt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return la({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function ol(e) {
  const [t, n] = D(() => /* @__PURE__ */ new Set()), r = K(
    () => e ? rl(e) : nl,
    [e]
  ), o = K(
    () => tl.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = F(async (s) => {
    if (!e) return;
    const c = wt(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? ca(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ua(
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
        da(l), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const al = {
  source: Ir,
  sideBySide: Er,
  translated: Tr
}, sl = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function il(e) {
  const t = Ye(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = ol(n), c = k(null);
  return $(() => {
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
  }, []), /* @__PURE__ */ j("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ j("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ v(Wo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ v("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ v(Vo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ v("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = Eo[i], u = wt(r[i]), d = a.has(i), f = !!u && !d, m = f ? "" : To(i, r), g = al[i];
      return /* @__PURE__ */ j(
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
            /* @__PURE__ */ v(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ j("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ j("span", { className: "reader-download-action-label", children: [
                sl[i],
                " PDF"
              ] }),
              m ? /* @__PURE__ */ v("span", { className: "reader-download-action-reason", children: m }) : null
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
const cl = "retainpdf:reader:bookmarks:v1:", ll = 200;
function Ln() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function bo(e) {
  const t = `${e || ""}`.trim();
  return t ? `${cl}${t}` : "";
}
function ul(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function kt(e, t = Ln()) {
  const n = bo(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = ul(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function nn(e, t, n) {
  const r = bo(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, ll);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function dl(e, t, n = "", { storage: r = Ln(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = kt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? nn(e, a.filter((c) => c.page !== s), r) : nn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function fl(e, t, n = Ln()) {
  return nn(e, kt(e, n).filter((r) => r.page !== t), n);
}
function ml(e, t) {
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
function hl({ filled: e }) {
  return /* @__PURE__ */ v("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ v("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function pl({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = D(() => kt(e)), [c, i] = D(!1), l = k(null);
  if ($(() => {
    s(kt(e)), i(!1);
  }, [e]), $(() => {
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
  return /* @__PURE__ */ j("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ v(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(dl(e, u, ml(r, u))),
        children: /* @__PURE__ */ v(hl, { filled: d })
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
    c && a.length ? /* @__PURE__ */ v("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ v("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ j("li", { className: f.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ j(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ j("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(fl(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function gl(e) {
  const t = Ye(), n = Bi(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? ft, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = ts(a), d = a > _r + 1e-3, f = a < Et - 1e-3, m = He(r, Ve()), g = m >= Et ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [h, S] = D(!1), [b, w] = D(`${c}`);
  $(() => {
    h || w(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, h]);
  const P = () => {
    if (S(!1), !l || i <= 0)
      return;
    const p = Number(`${b}`.trim());
    l(Tt(p, i));
  };
  return /* @__PURE__ */ j("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ v("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ v("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ j(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (p) => {
          p.preventDefault(), P();
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
              onChange: (p) => w(p.target.value.replace(/[^\d]/g, "")),
              onBlur: P,
              onKeyDown: (p) => {
                p.key === "Escape" && (p.preventDefault(), S(!1), w(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ j("span", { className: "reader-react-hud-page-suffix", children: [
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
          !l || i <= 0 || (w(`${c}`), S(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ v(
      pl,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ j("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ v(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !d,
          onClick: () => s(ct(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ j(
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
      /* @__PURE__ */ v(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !f,
          onClick: () => s(ct(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ v("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ v(el, {}) })
  ] });
}
function vr(e) {
  var t, n;
  return Cr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function bl(e) {
  const [t, n] = D(() => ({
    scope: e,
    panel: vr(ve(e))
  }));
  $(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: vr(ve(e))
    });
  }, [e]), $(() => {
    t.scope === e && Nt(t.scope, {
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
const rn = "download-toast";
function yl({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ j("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ j("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ v("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ v("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ v("div", { className: "download-toast-track", children: /* @__PURE__ */ v("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ v("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function vl(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Wt.dismiss(rn);
    return;
  }
  Wt.custom(
    () => /* @__PURE__ */ v(yl, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: rn, duration: 1 / 0 }
  );
}
function Sl() {
  const e = F((t) => {
    t && (t.setState = vl, t.hide = () => Wt.dismiss(rn));
  }, []);
  return /* @__PURE__ */ j(on, { children: [
    /* @__PURE__ */ v(Fo, { position: "bottom-right" }),
    /* @__PURE__ */ v("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function wl(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Nr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Pl(e, t) {
  return t === null || e !== t;
}
function yo(e) {
  const t = k(!1);
  return e && (t.current = !0), t.current;
}
function Rl(e, t) {
  const n = e === t;
  return { open: n, mounted: yo(n) };
}
function Il({
  panel: e,
  active: t,
  context: n
}) {
  var i;
  const r = t === e.id, o = yo(r);
  if (!(e.keepMounted ? o : r)) return null;
  const s = me(), c = (i = s == null ? void 0 : s[e.adapterKey]) == null ? void 0 : i.call(s, { ...n, open: r });
  return c == null ? null : /* @__PURE__ */ v(
    Zc,
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
const Sr = { itemId: null, origin: null };
function El() {
  let e = Sr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Sr : { itemId: n, origin: r };
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
const Tl = wo(() => import("./ReaderMarkdownPanel-BJg2Nogb.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Ml(e) {
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
function kl(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Al() {
  const e = Qs(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = bl(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = D(null), [u, d] = D(null), [f, m] = D(!1), g = k(null), h = k(null), S = s !== null, b = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, w = Ml({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: b,
    liveTranslationVisible: f,
    assistantOpen: S,
    assistantPdfPane: i
  }), P = F(() => d(null), []), p = u ? Po({ jobId: o.jobId, name: u, onClose: P }) : null, y = Ws({
    hasOverlayContent: b,
    connection: e.liveTranslation.connection,
    showSource: w.showSource,
    liveTranslationVisible: f,
    assistantOpen: S
  }), _ = w.sourceViewOnly, M = w.visibleMode;
  $(() => {
    d(null), m(!1);
  }, [e.viewStateKey]), $(() => {
    e.session.jobTerminal && m(!1);
  }, [e.session.jobTerminal]), $(() => {
    l(null);
  }, [a.scope]), $(() => {
    if (!(t.loading || t.failed)) {
      if (g.current !== e.viewStateKey) {
        g.current = e.viewStateKey;
        const B = ve(e.viewStateKey), A = wl({
          savedMode: B == null ? void 0 : B.mode,
          sourceViewOnly: _,
          viewportWidth: Ve()
        });
        h.current = A.auto ? A.mode : null, A.mode && A.mode !== e.mode && e.setModeKeepingPage(A.mode);
        return;
      }
      Pl(e.mode, h.current) && (h.current = null, Nt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, _]);
  const z = s || (e.mode === "compare" ? "compare" : "reading"), C = Rl(s, "markdown");
  si({
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
  const L = F(() => {
    c(null), l(null);
  }, []), R = F((B) => {
    l(null);
    const A = kl(B, e.liveTranslationAvailable);
    A !== null && m(A), e.setModeKeepingPage(B);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), E = K(() => y.sourcePaneToggle ? /* @__PURE__ */ v(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${f ? " is-active" : ""}`,
      onClick: () => m((B) => !B),
      "aria-pressed": f,
      title: f ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [y.sourcePaneToggle, f]), I = F((B) => {
    c(B), l(null);
  }, []), T = K(() => ({
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
    onClose: L
  }), [L, o.documentId, o.jobId]), [x] = D(El), U = F((B) => e.jumpToAnchor({ block_id: B }), [e.jumpToAnchor]), O = K(() => ({
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
    regionHover: x,
    jumpToBlock: U,
    revisedBlocks: e.revisedBlocks,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: _,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: I, close: L }
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
    x,
    U,
    e.revisedBlocks,
    e.sourceOnly,
    _,
    e.download,
    e.goToPage,
    I,
    L
  ]), V = K(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), ne = [
    Ja,
    `is-workspace-${z}`,
    S ? "is-assistant-open" : "",
    w.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ v(ji, { value: O, hud: V, children: /* @__PURE__ */ j("div", { className: ne, "data-reader-engine": "react-pdf", "data-reader-workspace": z, children: [
    /* @__PURE__ */ v(Xc, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ j("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ v(gi, {}),
      /* @__PURE__ */ v(il, {}),
      /* @__PURE__ */ v(fi, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ v(
      rc,
      {
        mode: M,
        documentReady: !!o.jobId,
        sourceViewOnly: _,
        onModeChange: R,
        liveTranslation: y.topBarPill ? {
          visible: f,
          state: e.liveTranslation,
          onToggle: () => m((B) => !B)
        } : null
      }
    ),
    /* @__PURE__ */ v(lc, { active: s }),
    S ? /* @__PURE__ */ v(Kc, {}) : null,
    /* @__PURE__ */ v(Qi, { paneComposition: w, markdownSplit: C.open, assistantSplit: S, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
    p,
    e.showHud ? /* @__PURE__ */ v(
      gl,
      {
        mode: M,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ j(So, { fallback: null, children: [
      Yr.map((B) => /* @__PURE__ */ v(
        Il,
        {
          panel: B,
          active: s,
          context: T
        },
        B.id
      )),
      C.mounted ? /* @__PURE__ */ v(Tl, { open: C.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: L }) : null
    ] }),
    /* @__PURE__ */ v(Sl, {})
  ] }) });
}
function Gl() {
  return /* @__PURE__ */ v(Al, {});
}
export {
  Gl as R,
  Al as a,
  Zc as b,
  Jl as d,
  Vl as f,
  ql as r,
  Ye as u
};
//# sourceMappingURL=ReaderApp-htG1KeXZ.js.map
