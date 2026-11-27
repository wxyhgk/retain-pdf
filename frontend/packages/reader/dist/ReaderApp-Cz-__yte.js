var ys = Object.defineProperty;
var Er = (e) => {
  throw TypeError(e);
};
var vs = (e, t, n) => t in e ? ys(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Rr = (e, t, n) => vs(e, typeof t != "symbol" ? t + "" : t, n), Mr = (e, t, n) => t.has(e) || Er("Cannot " + n);
var Nt = (e, t, n) => (Mr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), _r = (e, t, n) => t.has(e) ? Er("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Nr = (e, t, n, r) => (Mr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as Le } from "react/jsx-runtime";
import { useMemo as V, useState as E, useEffect as $, useCallback as R, useRef as N, useLayoutEffect as $e, memo as Jt, createContext as Gt, useContext as ut, Fragment as Yn, forwardRef as Wo, useImperativeHandle as Zn, useSyncExternalStore as hn, Component as ws, Suspense as Ko, lazy as Vo, useId as qo } from "react";
import { requireAdapter as _t, getReaderAdapters as je } from "./adapters.js";
import { resolveReaderDownloadName as Ss, resolveReaderDownloadUrls as ks, READER_PROGRESS_COPY as Je, trimString as sn, READER_DOWNLOAD_ACTIONS as Is, disabledReason as Ts } from "./runtime/state.js";
import { r as Ps, b as Es } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as xn, isFinishedJobStatus as Ut } from "@retainpdf/domain/job";
import { n as Jo, d as Rs, f as vn, k as xr, b as Ms, c as _s, j as Ue, p as pt, g as Ns, l as Et, i as xs } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as As } from "@retainpdf/api/documents";
import { isReaderTransportError as Ls, createReaderTransportError as Cs } from "./contracts.js";
import { toast as An, Toaster as Ds } from "sonner";
import { ChevronLeft as Go, PenLine as Qn, ZoomIn as $s, Check as Xo, X as Xt, Copy as Os, ChevronUp as zs, ChevronDown as er, History as Fs, LoaderCircle as Bs, Pin as Yo, LogOut as js, FileText as Zo, Columns2 as Qo, Languages as ea, Radio as Us, ArrowDownToLine as Hs, CheckCircle2 as Ws, ImagePlus as Ks, MessageCircleQuestion as Vs, Crop as qs, GitCompareArrows as Js, Highlighter as Gs, Eraser as Xs, Undo2 as Ys, Trash2 as Zs, ChevronRight as ta, Minus as Qs, Plus as ei, ArrowLeft as ti, Keyboard as ni, Download as ri, ListTree as oi, PinOff as ai } from "lucide-react";
import { Button as se, Textarea as si, IconButton as lt, Input as na } from "@retainpdf/ui";
import { createPortal as ii } from "react-dom";
import { pdfjs as ra, Page as ci, Document as li } from "react-pdf";
import { e as ui, m as di, a as fi } from "./markdown-math-XkF5urpn.js";
const mi = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, hi = "", pi = Object.freeze({
  progress: "retainpdf-reader-progress"
}), gi = (e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Tg = (...e) => {
  var n;
  return (((n = je()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Pg = () => {
  var e, t;
  return ((t = (e = je()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ge = () => _t("defaultReaderDataPort"), Ar = () => _t("defaultReaderPageConfigPort"), Eg = {
  get apiPrefix() {
    return Ge().apiPrefix;
  },
  fetchProtected: (...e) => Ge().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ge().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ge().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ge().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ge().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ge().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ge().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ge().liveTranslation;
  }
}, oa = {
  messageTargetOrigin: () => Ar().messageTargetOrigin(),
  readerJobId: () => Ar().readerJobId()
}, bi = () => {
  var e;
  return ((e = je()) == null ? void 0 : e.liveTranslation) ?? null;
}, Ht = () => {
  var t;
  const e = je();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, et = () => {
  const e = je();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => _t("fetchDocumentByJobId")(...n),
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
}, yi = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, vi = () => {
  var e, t;
  return ((t = (e = je()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, wi = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Si = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Ss(...e);
}, ki = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ks(...e);
}, Ii = (...e) => _t("downloadProtectedResource")(...e), Ti = (...e) => _t("failDownloadToast")(...e), Rg = (e, t) => _t("resolveMarkdownAssetUrl")(e, t), Lr = "/api/v1";
function Pi() {
  const e = () => {
    var r;
    return Ps(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = E(e);
  return $(() => {
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
function Ei() {
  const e = Pi(), t = V(() => wi(oa), [e]), n = V(() => vi(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Ri(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = E({
    documentId: "",
    jobId: ""
  }), [u, f] = E({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, y] = E({
    jobId: "",
    documentId: ""
  }), k = h.jobId === g ? h.documentId : "", w = t || k, b = !!t && !g, [v, S] = E(null), _ = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === w ? v : null, A = b || !!_, x = R((M) => {
    const I = `${M.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${M.revision || ""}`.trim() || `${Date.now()}`;
    S({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  $(() => {
    S((M) => M && M.sessionIdentity !== r ? null : M);
  }, [r]);
  const O = R((M) => {
    switch (M.type) {
      case "resolved-document-job":
        l({ documentId: M.documentId, jobId: M.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: M.documentId, jobId: M.jobId });
        break;
      case "resolved-job-document":
        y((I) => I.jobId === M.jobId && I.documentId === M.documentId ? I : { jobId: M.jobId, documentId: M.documentId });
        break;
      case "committed-source":
        S({
          documentId: M.documentId,
          revision: M.revision,
          sessionIdentity: M.sessionIdentity
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
    jobDocumentId: k,
    documentId: w,
    sourceOnly: b,
    committedDocumentSource: v,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: _,
    sourceViewOnly: A,
    refreshCommittedDocument: x,
    applyIdentityEvent: O
  };
}
function Cr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Mi(e) {
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
function Dr(e, t) {
  return gi(xn(e, t));
}
function _i(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ni(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !_i(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Ln({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: pi.progress,
        stage: n,
        percent: e,
        text: t
      },
      oa.messageTargetOrigin()
    );
  } catch {
  }
}
function cn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Ln({ percent: t, text: n, stage: r });
}
function xi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = E(null), [l, u] = E(null), [f, d] = E(""), [m, g] = E(0), h = f === n ? i : null, y = f === n ? l : null, k = Cr(h), w = Ut(k), b = R(() => {
    g((O) => O + 1);
  }, []), v = R((O) => {
    c(O.jobPayload), u(O.manifestPayload), d(O.sessionIdentity);
  }, []), S = R((O) => {
    c(null), u(null), d(O);
  }, []), _ = N(""), A = N(""), x = R(async () => {
    const O = o.current;
    if (!O || _.current === O) return;
    const M = et().loadJobPayload;
    if (typeof M != "function") return;
    const I = a.current.value;
    _.current = O;
    try {
      const T = await M(O);
      if (s.current || a.current.value !== I || o.current !== O || !T || typeof T != "object")
        return;
      const P = Cr(T);
      c(T), d(r.current), !Ut(P) && A.current === O && (A.current = ""), P === "succeeded" && A.current !== O && (A.current = O, g((C) => C + 1));
    } catch {
    } finally {
      _.current === O && (_.current = "");
    }
  }, []);
  return $(() => {
    A.current = "";
  }, [n]), $(() => {
    if (!t || w || !h) return;
    const O = window.setInterval(() => {
      document.visibilityState !== "hidden" && x();
    }, 1e3);
    return () => window.clearInterval(O);
  }, [w, x, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: k,
    jobTerminal: w,
    jobRefreshRevision: m,
    refreshJobArtifacts: b,
    refreshJobStatus: x,
    publishPayload: v,
    clearPayload: S
  };
}
function Cn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ai(e, t) {
  e(t), Cn(t);
}
function Li(e) {
  const [t, n] = E(e ? "source" : "compare"), r = R((a) => {
    e && a !== "source" || (n(a), Cn(a));
  }, [e]), o = R((a) => {
    Ai(n, a);
  }, []);
  return $(() => (e && document.documentElement.classList.add("reader-source-only"), Cn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function $r(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ci(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: $r(n.active_job_id),
    activeVersionId: $r(n.active_version_id)
  };
}
function Di(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function $i(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Oi(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const zi = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Fi(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = zi.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Bi = 48 * 1024 * 1024;
function ji(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ui = 2, Be = /* @__PURE__ */ new Map();
function Dn(e, t) {
  Be.delete(e), Be.set(e, t);
}
function Or(e) {
  if (Be.size < Ui) return;
  const t = Be.keys().next().value;
  t && Be.delete(t);
}
async function Hi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function aa(e, t = Ht().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, k, w;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Be.has(r)) {
    const b = Be.get(r);
    return Dn(r, b), b;
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
    const v = await Hi(s);
    throw v && (b.reason = v), b;
  }
  const i = Wi(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Or(), Be.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (w = (k = n.signal) == null ? void 0 : k.removeEventListener) == null || w.call(k, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Be.has(r) ? Dn(r, l) : (Or(), Be.set(r, l)), l;
}
function Wi(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Bi ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Ki = { file: null, loading: !1, error: "" }, Vi = { file: null, loading: !0, error: "" };
function qi(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = E(null);
  if ($(() => {
    if (t || !n) return;
    const s = Be.get(n);
    if (s) {
      Dn(n, s);
      return;
    }
    const i = new AbortController();
    return aa(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ki;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Be.get(n);
  return a ? { file: a, loading: !1, error: "" } : Vi;
}
function Ji(e) {
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
async function $n(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  cn(s, r, n, "download");
  const i = await aa(t, Ht().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (cn(s, o, n, "download"), i);
}
async function Gi(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  cn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    $n({
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
    $n({
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
function Xi(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Yi({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = As,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Xi(o.href, t, a)), !0);
}
const Qt = {
  regions: null,
  metadata: null
};
function Zi(e) {
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
    activeLoadAbortRef: k
  } = e, [w, b] = E(""), [v, S] = E(""), [_, A] = E(null), [x, O] = E(null), [M, I] = E(!1), [T, P] = E(""), [C, D] = E([]), [H, W] = E(!1), [Y, U] = E(() => ({
    source: null,
    translated: null
  })), [q, Z] = E(
    Qt
  ), [ge, ee] = E({
    loading: !0,
    percent: 4,
    text: Je.boot,
    stage: "progress",
    failed: !1
  });
  return $(() => {
    const ce = new AbortController(), Ne = h.current.value, le = Ji({
      sessionEpochRef: h,
      closingRef: y,
      abort: ce,
      sessionEpoch: Ne
    });
    k.current = ce;
    const de = et();
    if (y.current)
      return ce.abort(), () => {
        k.current === ce && (k.current = null);
      };
    let z = !1;
    function K(ie, te) {
      le.markFailed(), W(!0), ee({
        loading: !1,
        percent: 100,
        text: ie,
        stage: "failed",
        failed: !0
      }), Ln({ percent: 100, text: te, stage: "failed" });
    }
    function X() {
      I(!0), z || W(!0), ee({
        loading: !1,
        percent: 100,
        text: Je.ready,
        stage: "ready",
        failed: !1
      }), Ln({ percent: 100, text: Je.ready, stage: "ready" });
    }
    function fe() {
      return l != null && l.documentId ? Dr(
        l.documentId,
        l.revision
      ) : mi() ? hi : de.resolveResourceUrl(xn(r));
    }
    async function ae() {
      var re;
      let ie = { activeJobId: "", activeVersionId: "" };
      try {
        const he = await ((re = de.fetchDocument) == null ? void 0 : re.call(de, r));
        he && (ie = Ci(he));
      } catch {
      }
      const te = Di({
        link: ie,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (te.kind === "follow-active-job") {
        if (le.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: te.jobId
        }), te.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: te.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (te.kind === "open-committed-source") {
        if (le.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: te.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ye = fe();
      if (le.isInactive()) return;
      b(ye), S(""), P(""), d(c);
      const F = await $n({
        url: ye,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: le,
        setBoot: ee
      });
      if (!le.isInactive()) {
        if (!F) {
          K("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        A(F), X();
      }
    }
    async function me() {
      var Fe;
      const ie = !l, te = !!(ie && de.loadSessionSnapshot && de.loadReaderOptionalArtifacts), ye = te ? de.loadReaderOptionalArtifacts(t) : null, F = await ((Fe = de.loadSessionSnapshot) == null ? void 0 : Fe.call(de, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ie && !te
      })), re = F ? {
        jobPayload: F.sourcePayload,
        manifestPayload: F.manifestPayload,
        readerMetadata: F.readerMetadata,
        regionsPayload: F.regions,
        readerErrors: F.readerErrors
      } : await de.loadReaderPayload(t, {
        includeOptionalArtifacts: ie
      });
      if (le.isInactive()) return;
      let he = null;
      if (n && !r)
        if (F && F.linkedDocument !== void 0)
          he = F.linkedDocument;
        else {
          try {
            he = await de.fetchDocumentByJobId(Lr, t);
          } catch {
          }
          if (le.isInactive()) return;
        }
      const Ce = Mi(re.jobPayload) || `${(he == null ? void 0 : he.document_id) || ""}`.trim();
      Ce && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ce
      });
      const Re = $i({
        payloadDocumentId: Ce,
        linkedActiveJobId: `${(he == null ? void 0 : he.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(he == null ? void 0 : he.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Re.kind === "restore-committed-source") {
        if (le.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Re.documentId,
          revision: Re.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const xe = de.resolveReaderSourcePdf(re.manifestPayload), Oe = de.resolveReaderTranslatedPdfUrl(re.jobPayload, re.manifestPayload), Me = typeof xe == "string" ? xe : de.resolveReaderArtifactUrl(xe), ze = r || Ce, qe = l != null && l.documentId ? Dr(
        l.documentId,
        l.revision
      ) : Me || (ze ? de.resolveResourceUrl(xn(ze)) : ""), De = l ? "" : Oe || "";
      b(qe || ""), S(De), P(Ni(re.jobPayload, t)), f({
        jobPayload: re.jobPayload || null,
        manifestPayload: re.manifestPayload || null,
        sessionIdentity: c
      });
      const B = () => Gi({
        sourceFinal: qe || "",
        translatedFinal: De,
        fence: le,
        setBoot: ee
      }), G = !!(qe || De), J = ye && G ? B() : null;
      J == null || J.catch(() => {
      });
      const pe = (j) => {
        le.isInactive() || (D(l ? [] : Jo(j.regionsPayload)), U(l ? { source: null, translated: null } : Rs(j.readerMetadata)), Z(l ? Qt : j.readerErrors ?? Qt), W(!0));
      };
      if (ye ? (z = !0, ye.then(pe)) : pe(re), !G) {
        K(Je.failed, Je.failed);
        return;
      }
      const Ie = await (J ?? B());
      if (Ie.status !== "inactive") {
        if (Ie.status === "incomplete") {
          K("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        A(Ie.sourceBytes), O(Ie.translatedBytes), X();
      }
    }
    async function ke() {
      I(!1), A(null), O(null), D([]), W(!1), U({ source: null, translated: null }), Z(Qt), cn(ee, 8, Je.metadata, "metadata");
      try {
        if (s) {
          await ae();
          return;
        }
        if (!t) {
          K(Je.failed, Je.failed);
          return;
        }
        await me();
      } catch (ie) {
        if (le.isClosedOrStale() || (ie == null ? void 0 : ie.name) === "AbortError") return;
        le.markFailed();
        const te = Number(ie == null ? void 0 : ie.status), ye = `${(ie == null ? void 0 : ie.reason) || ""}`, F = Fi({ status: te, reason: ye, sessionJobId: t });
        if (F && (await Yi({
          apiPrefix: Lr,
          documentId: F,
          expiredJobId: t
        }) || le.isClosedOrStale()))
          return;
        if (Oi({
          status: te,
          reason: ye,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const re = ie instanceof Error ? ie.message : Je.failed;
        K(re, re);
      }
    }
    return ke(), () => {
      ce.abort(), k.current === ce && (k.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: w,
    translatedUrl: v,
    sourceFile: _,
    translatedFile: x,
    assetsReady: M,
    title: T,
    regions: C,
    regionsSettled: H,
    readerMetadata: Y,
    readerErrors: q,
    boot: ge
  };
}
function Qi() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ei(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), c = N(""), l = N(""), u = N(() => {
  }), f = R(() => u.current(), []), d = Ri({
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
  } = d, { mode: k, setMode: w, switchSessionMode: b } = Li(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const v = xi({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: _,
    jobStatus: A,
    jobTerminal: x,
    jobRefreshRevision: O,
    refreshJobArtifacts: M,
    refreshJobStatus: I
  } = v, T = Zi({
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
  }), P = R(() => {
    var D;
    e.current = !0, (D = t.current) == null || D.abort();
  }, []), C = V(
    () => ({
      fetchProtected: et().fetchProtected,
      jobId: m,
      jobPayload: S,
      manifestPayload: _,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: y
    }),
    [m, S, _, T.sourceUrl, T.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: A,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: x,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: k,
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
    download: C,
    refreshJobArtifacts: M,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: P
  };
}
const ec = 160, tc = 8, nc = 0;
function rc() {
  const e = N(null), [t, n] = E(null), [r, o] = E(nc), a = R((s) => {
    e.current = s, n(s);
  }, []);
  return $(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < ec || o((u) => Math.abs(u - l) < tc ? u : l);
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
function oc(e) {
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
const wn = { source: 0, translated: 0 };
function ac(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = N(l);
  u.current = l;
  const [f, d] = E(() => ({
    identity: l,
    pages: wn
  })), [m, g] = E(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : wn, y = m.identity === l ? m.tick : 0, k = oc({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: w } = k, b = R((I, T) => {
    u.current === l && d((P) => {
      const C = P.identity === l ? P.pages : wn;
      return C[T] === I && P.identity === l ? P : {
        identity: l,
        pages: { ...C, [T]: I }
      };
    });
  }, [l]), v = N(null), S = R(() => {
    v.current && clearTimeout(v.current);
    const I = l;
    v.current = setTimeout(() => {
      v.current = null, u.current === I && g((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  $(() => (v.current && (clearTimeout(v.current), v.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [l]);
  const _ = V(
    () => Math.max(h.source, h.translated),
    [h]
  ), A = w === "translated" ? h.translated : h.source || h.translated, x = t == null ? void 0 : t.userZoom, O = t == null ? void 0 : t.shellWidth, M = `${l}-${y}-${x}-${n}-${h.source}-${h.translated}-${O}`;
  return {
    ...k,
    numPagesByPane: h,
    hudNumPages: _,
    primaryNumPages: A,
    metricsTick: y,
    onNumPages: b,
    onMetrics: S,
    rowSyncRevision: M
  };
}
const Ee = "data-reader-page", Te = "data-reader-pane", tr = "data-natural-height", sc = "reader-react-root", sa = "reader-react-grid", ia = "reader-react-scroll-shell", pn = "reader-react-pdf-pane", ca = "reader-react-pdf-page", ln = "reader-react-pdf-page-placeholder", nr = "reader-react-pdf-page-slot";
function un(e, t) {
  const n = e != null ? `[${Ee}="${e}"]` : `[${Ee}]`;
  return t ? `${n}[${Te}="${t}"]` : n;
}
function rr() {
  return `.${nr}[${Ee}]`;
}
function dn(e) {
  return Number(e.getAttribute(Ee));
}
const la = 0.25, fn = 1, ic = 0.05, Yt = 0.5, cc = 16, lc = 8, ua = cc + lc, uc = 720;
function It() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function da(e) {
  return Number.isFinite(e) && e < uc;
}
function St(e, t = Number.POSITIVE_INFINITY) {
  return da(t) && (e === "source" || e === "translated") ? fn : Yt;
}
function Ze(e) {
  return Number.isFinite(e) ? Math.min(fn, Math.max(la, e)) : Yt;
}
function Wt(e, t) {
  const n = Ze(Number(e) + t * ic);
  return Math.round(n * 100) / 100;
}
function dc(e) {
  return Math.round(Ze(e) * 100);
}
function fa(e) {
  const n = (Number(e) || 0) - ua;
  return Math.max(160, Math.floor(n));
}
function fc(e, t = Yt) {
  const n = Ze(t);
  return fa((Number(e) || 0) * n);
}
function mc(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Te}]`)
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
const hc = 8;
function pc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < hc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const ma = 200, gc = [
  "markdown"
], bc = gc;
function ha(e) {
  return bc.includes(e);
}
const yc = "retainpdf:reader:view:v1:", zr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), vc = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function pa() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function On(e) {
  return `${e || ""}`.trim();
}
function wc({
  documentId: e,
  jobId: t
}) {
  const n = On(e);
  if (n) return `document:${n}`;
  const r = On(t);
  return r ? `job:${r}` : "";
}
function ga(e) {
  const t = On(e);
  return t ? `${yc}${t}` : "";
}
function Sc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function kc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!zr.has(t) || !zr.has(n) || t === n))
    return { left: t, right: n };
}
function Ic(e) {
  return e === null ? null : ha(e) ? e : void 0;
}
function Tc(e) {
  return vc.has(e) ? e : void 0;
}
function ba(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Sc(t.anchor), r = Number(t.zoom), o = Tc(t.mode), a = kc(t.splitLayout), s = Ic(t.assistantPanel);
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
function Ve(e, t = pa()) {
  const n = ga(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ba(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function gn(e, t, n = pa()) {
  const r = ga(e);
  if (!r || !n) return null;
  const o = Ve(e, n), a = ba({
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
function Pc(e, t, n = "") {
  var d;
  const [r, o] = E(() => {
    var m;
    return ((m = Ve(n)) == null ? void 0 : m.zoom) ?? St(e, It());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), c = N(((d = Ve(n)) == null ? void 0 : d.zoom) !== void 0);
  $(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Ve(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? St(e, It());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), $(() => {
    if (c.current) return;
    const m = St(e, It()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = R((m, g) => {
    const h = Ze(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, gn(s.current, { zoom: h }), o(h));
  }, []), u = R((m) => {
    l(Wt(a.current, m));
  }, [l]), f = R((m) => {
    l(St(m));
  }, [l]);
  return $e(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, mc(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const Ec = 160, Rc = 3e-3, Fr = 50, Mc = 16, _c = 800;
function Nc(e, t = 0) {
  const n = t === 1 ? Mc : t === 2 ? _c : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Fr, Math.min(Fr, r));
  return Math.exp(-o * Rc);
}
function xc(e, t, n = 0) {
  return Ze(e * Nc(t, n));
}
function Ac(e) {
  return Math.round(Ze(e) * 100) / 100;
}
function Lc(e, t, n) {
  const r = Ze(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ze(t) / r;
  const a = (o + ua) / r;
  return fa(a * Ze(t)) / o;
}
function Cc(e) {
  return Array.from(e.querySelectorAll(rr()));
}
function Dc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function $c(e, t, n) {
  let r = null;
  for (const s of Cc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = Dc(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Ee) || "",
    pane: o.getAttribute(Te) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Oc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ya(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${rr()}[${Ee}="${t.page}"][${Te}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Oc(n, e).scrollLeft += a);
}
function zc(e, t, n, r) {
  const o = e.querySelector(`.${sa}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function xt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Fc = 600, Bc = 1e3;
function jc(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ya(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Bc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Uc(e, t, n) {
  const r = N(t);
  r.current = t;
  const o = N(n);
  o.current = n;
  const a = N(null), s = N(null), i = N(null);
  $(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = Ac(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        xt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, xt(d.grid));
      }, Fc), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, xt(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: $c(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = xc(f.target, u.deltaY, u.deltaMode);
      const d = Lc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = zc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, Ec);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), xt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), $e(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), xt(c.grid), !(!e || !c.anchor) && (ya(e, c.anchor), (l = i.current) == null || l.call(i), i.current = jc(e, c.anchor)));
  }, [t, e]);
}
function Hc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: R((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const or = 48;
function va(e, t = or) {
  return e.getBoundingClientRect().top + t;
}
function wa(e, t) {
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
  const o = dn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Ft(e, t, n = or) {
  if (!e)
    return null;
  const r = un(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = va(e, n), i = wa(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Rt(e, t, n = "auto", r, o = or) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(un(a, r))), i || (i = e.querySelector(un(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function Wc(e, t, n = "smooth", r) {
  return Rt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function zn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var u;
    if (a) return;
    Rt(
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
function Kc(e, t, n) {
  return zn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function mn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function He(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Vc(e, t, n = !0, r = "", o) {
  const [a, s] = E(1);
  return $(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, u = 0;
    const f = un(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = va(i), k = wa(h, y);
      k && s(k.page);
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
const qc = `canvas, .react-pdf__Page, .${ca}, .${ln}`, Br = /* @__PURE__ */ new WeakMap();
function Jc(e) {
  const t = Number(e.getAttribute(tr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Br.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(qc), Br.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Gc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Xc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(rr()).forEach((r) => {
    const o = dn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Jc(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Yc(e, t, n = "", r) {
  const [o, a] = E(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, $e(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, f = !1;
    const d = () => {
      var S;
      if (c) return;
      const b = e.current;
      if (!b) return;
      const v = Xc(b);
      Gc(s.current, v) || (s.current = v, a(v)), u && !f && (f = !0, (S = i.current) == null || S.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), y = window.setTimeout(m, 700), k = e.current;
    let w = null;
    return k && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => m()), w.observe(k)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const Zc = [0, 48, 140, 320, 560], Qc = 700, el = [80, 200, 400], tl = 500, nl = 50, rl = /* @__PURE__ */ new Set([
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
]), ol = 180, jr = [0, 48, 140, 320, 700, 1200];
function al(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((T = Ve(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = N(null), l = N(!1), u = N(r), f = N(null), d = N(null), m = N(null), g = N(null), h = N(a), y = N(""), k = N(n);
  k.current = n;
  const w = R(() => {
    var P;
    (P = f.current) == null || P.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = R(() => {
    !l.current && c.current == null || (w(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [w]), v = R((P = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const C = () => {
      g.current = null, gn(h.current, {
        anchor: He(i.current)
      });
    };
    P ? C() : g.current = setTimeout(C, ol);
  }, []), S = R((P) => {
    i.current = He(P), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, nl);
  }, []);
  $(() => {
    if (!o)
      return;
    let P = !1, C = null, D = null, H = null;
    const W = () => {
      if (P) return;
      const Y = e.current;
      if (!Y) {
        H = setTimeout(W, 50);
        return;
      }
      C = Y, D = () => {
        if (l.current)
          return;
        const U = Ft(C, k.current);
        U && (i.current = U, v());
      }, C.addEventListener("scroll", D, { passive: !0 }), l.current || D();
    };
    return W(), () => {
      P = !0, H != null && clearTimeout(H), C && D && C.removeEventListener("scroll", D);
    };
  }, [o, r, n, e, v]), $(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const C = (D) => {
      D.metaKey || D.ctrlKey || D.altKey || rl.has(D.key) && b();
    };
    return P.addEventListener("wheel", b, { passive: !0 }), P.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", C), () => {
      P.removeEventListener("wheel", b), P.removeEventListener("touchmove", b), window.removeEventListener("keydown", C);
    };
  }, [o, e, b]), $e(() => {
    var C;
    if (h.current === a) return;
    v(!0), w(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const P = (C = Ve(a)) == null ? void 0 : C.anchor;
    i.current = P ? He(P) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, v, w]), $(() => {
    var C;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const P = He(
      ((C = Ve(a)) == null ? void 0 : C.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = P, c.current = P, l.current = !0, w(), f.current = zn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: k.current,
        delaysMs: jr,
        onDone: () => S(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, S(P);
    }, Math.max(...jr) + 160), () => w();
  }, [o, s, a, e, S, w]), $(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, w();
      return;
    }
    const P = c.current ? He(c.current) : He(i.current);
    return l.current = !0, c.current = P, i.current = P, w(), f.current = zn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Zc,
        onDone: () => S(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, S(P);
    }, Qc), () => {
      w();
    };
  }, [r, o, n, e, S, w]), $(() => () => {
    w(), m.current != null && (clearTimeout(m.current), m.current = null), v(!0);
  }, [w, v]);
  const _ = R(() => {
    const P = Ft(
      e.current,
      k.current
    );
    return He(P || i.current);
  }, [e]), A = R(() => {
    l.current = !0;
    const P = Ft(
      e.current,
      k.current
    ), C = He(P ?? i.current);
    return i.current = C, c.current = C, v(), C;
  }, [e, v]), x = R((P, C, D) => {
    const H = D || k.current, W = mn(P, C || 1), Y = { page: W, fraction: 0 };
    i.current = Y, l.current = !0, c.current = Y, v(), w(), Wc(e.current, W, "smooth", H), f.current = Kc(
      () => e.current,
      W,
      {
        behavior: "auto",
        pane: H,
        delaysMs: el,
        onDone: () => S(Y)
      }
    ), d.current = setTimeout(() => {
      d.current = null, S(Y);
    }, tl);
  }, [e, S, w, v]), O = R(() => He(i.current), []), M = R(() => l.current, []), I = R(() => {
    if (!l.current || !c.current)
      return;
    const P = He(c.current);
    Rt(
      e.current,
      P,
      "auto",
      k.current
    );
  }, [e]);
  return {
    lockFromShell: _,
    beginModeSwitch: A,
    goToPage: x,
    getAnchor: O,
    isRestoring: M,
    repinIfRestoring: I
  };
}
function sl(e, t) {
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
function Sa(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const il = [0, 80, 200, 400, 800], cl = 120, ll = 400;
function ul(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = N(a);
  f.current = a;
  const d = N(s);
  d.current = s;
  const m = N(i);
  m.current = i;
  const g = N(n);
  g.current = n, $(() => {
    var v, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = yi(), y = sl(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const k = Sa(h, y, { jobId: c, documentId: l });
    if (t.current === k)
      return;
    if (y == null) {
      t.current = k, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = k, h && ((S = m.current) == null || S.call(m, h, y));
    const w = [];
    let b = 0;
    for (const _ of il)
      b = Math.max(b, _), w.push(
        setTimeout(() => {
          f.current(y);
        }, _)
      );
    return w.push(
      setTimeout(() => {
        var _;
        (_ = g.current) == null || _.call(g);
      }, b + cl)
    ), () => {
      for (const _ of w) clearTimeout(_);
    };
  }, [r, o, c, l, t, u]);
}
function dl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function fl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = ll,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = N(a);
  u.current = a;
  const f = N(l);
  f.current = l;
  const d = N(0);
  $(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var k;
      const g = ((k = globalThis.location) == null ? void 0 : k.search) || "", h = Es(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Sa(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || dl)(h);
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
function ml(e) {
  const t = N(""), [n, r] = E(!1), o = R(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  ul(a, t, o), fl(e, t, n);
}
const At = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function hl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Ur(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function ka(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Ur(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Ur(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function pl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = ka(r, t, n);
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
function gl(e) {
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
function bl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function yl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function vl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function wl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Hr = [250, 500, 1e3, 2e3, 4e3], Sn = [80, 160, 320, 640, 1e3, 1500], Wr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Fn(e, t) {
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
function ar(e) {
  return Ls(e) ? `${e.code || ""}`.trim() : "";
}
function en(e, t) {
  const n = ar(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Sl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ka(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Cs(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = ar(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Sn[Math.min(s, Sn.length - 1)];
    if (await Fn(i, r), s >= Sn.length + 2) throw a;
  }
}
function kl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = E(At), s = N(o), i = N("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Ut(l) ? l : "";
  return $(() => {
    if (!n || !c) {
      i.current = "", s.current = At, a(At);
      return;
    }
    const f = r === void 0 ? bi() : r, d = i.current === c;
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
        const S = b(v);
        return s.current = S, S;
      });
    }, k = async () => {
      let b = 0;
      for (; !m.signal.aborted; )
        try {
          const v = await f.fetchLayout(c, { signal: m.signal });
          g = !0, y((S) => ({
            ...S,
            layoutByPage: hl(v),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const S = ar(v);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            y((A) => ({
              ...A,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: en(v, "实时译文暂不可用")
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
            error: en(v, "正在等待 OCR 版面数据")
          })), await Fn(Hr[Math.min(b, Hr.length - 1)], m.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await k(), !g || m.signal.aborted) return;
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
              let S;
              try {
                S = await Sl(
                  c,
                  v,
                  s.current,
                  m.signal,
                  f
                );
              } catch (_) {
                if ((_ == null ? void 0 : _.name) === "AbortError" || m.signal.aborted) throw _;
                y((A) => ({
                  ...A,
                  lastSeq: Math.max(A.lastSeq, v.seq),
                  error: en(_, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((_) => {
                const A = pl(_, v, S);
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
          y((S) => ({
            ...S,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: en(v, "实时译文连接已中断，正在重连")
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
        await Fn(Wr[Math.min(b, Wr.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function Il(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Tl(e, t = !0) {
  const [n, r] = E(() => /* @__PURE__ */ new Map());
  return $(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = et().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Il(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Pl = 4500;
function El(e) {
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
const Rl = /* @__PURE__ */ new Set(["book", "translate"]);
function Ia(e) {
  return !!(e.jobId && e.sourceUrl && Rl.has(e.workflow));
}
function Ml(e) {
  return !!(Ia(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function _l() {
  const e = Qi(), t = Ia({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Ml({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Ut(o) && (r.current.running = !0);
  const a = kl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = rc(), u = Tl(e.jobId, !e.sourceOnly), f = wc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = Pc(e.mode, s, f);
  Uc(i, m, g);
  const h = ac(
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
    goToPage: k,
    repinIfRestoring: w
  } = al(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  $(() => {
    w();
  }, [c, w]);
  const b = Yc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    w
  ), v = Vc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), S = R((W, Y) => {
    var q, Z;
    const U = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((q = h.numPagesByPane) == null ? void 0 : q.source) || 0,
      Number((Z = h.numPagesByPane) == null ? void 0 : Z.translated) || 0
    );
    k(W, U, Y);
  }, [k, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [_, A] = E(null), x = N(null), O = R((W) => {
    x.current && clearTimeout(x.current), A(W), W && (x.current = setTimeout(() => A(null), Pl));
  }, []);
  $(() => () => {
    x.current && clearTimeout(x.current);
  }, []);
  const M = R((W) => {
    const Y = vn(e.regions, W);
    return Y ? xr(Y, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = R((W, Y) => {
    const U = Y || h.primaryPane, q = typeof W == "object" && W ? `${W.block_id || ""}`.trim() : "", Z = typeof W == "object" && W ? `${W.image_url || ""}`.trim() : "", ge = typeof W == "object" && W ? W.page_idx != null ? Number(W.page_idx) + 1 : W.page != null ? Number(W.page) : null : typeof W == "number" ? W + 1 : null, ee = Ms(e.regions, Z, ge) || vn(e.regions, q) || (typeof W == "object" ? _s(e.regions, W) : null);
    let ce = ee ? xr(ee, U).page : null;
    ce == null && (ce = El(W)), !(ce == null || ce < 1) && (O(ee), S(ce, U));
  }, [O, S, h.primaryPane, e.regions]);
  ml({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: v,
    goToPage: S,
    resolveBlockPage: M,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (W) => {
      O(vn(e.regions, W.blockId));
    }
  });
  const { setModeKeepingPage: T } = Hc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  $(() => {
    O(null);
  }, [d, O]);
  const P = !e.boot.loading && !e.boot.failed, C = V(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), D = V(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), H = V(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: C,
    panes: h,
    sessionFiles: D,
    rowHeights: b,
    goToPage: S,
    activeRegion: _,
    jumpToAnchor: I,
    setModeKeepingPage: T,
    download: e.download,
    showHud: P,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, C, h, D, b, S, _, I, T, P, m, g, f, a, n, u]);
  return V(() => ({
    ...H,
    currentPage: v
  }), [H, v]);
}
const Nl = [
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
], xl = [
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
    // 画笔、提问这些扩展自己的快捷键由扩展登记（快捷键说明里排在这几组后面）。
    title: "右键",
    items: [
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
  }
];
function Al(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Nl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Ll(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Cl = ".reader-notes-panel";
function Dl(e) {
  return e instanceof Element ? !!e.closest(Cl) : !1;
}
function $l(e) {
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
  $(() => {
    if (!u)
      return;
    const f = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Ll(d.target) || Dl(d.target))
        return;
      const m = d.key, g = Al(m);
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
              a(Wt(o, 1));
              return;
            case "zoom-out":
              a(Wt(o, -1));
              return;
            case "zoom-reset":
              a(St(t, It()));
              return;
            case "next-page":
              c(mn(s + 1, i));
              return;
            case "prev-page":
              c(mn(s - 1, i));
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
const Ol = "retainpdf:soft-reader-close";
function zl() {
  return new URL("./index.html", window.location.href).href;
}
function Fl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Ol },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Bl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function jl() {
  if (!(typeof window > "u") && !Fl()) {
    if (Bl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(zl());
  }
}
function Ul({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Hl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L(Ul, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), jl();
  }, children: [
    /* @__PURE__ */ p(Go, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const Wl = 3e3, Kl = 8;
async function Vl(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function ql(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Jl(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Wl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = ql(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < Kl && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Vl(e, i);
  })), a;
}
function Ta(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Pa(e, t) {
  let n = null;
  for (const r of Ta(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function Kr(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Vr = !1;
function Gl() {
  if (Vr)
    return;
  const e = Ht().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (ra.GlobalWorkerOptions.workerSrc = e, Vr = !0);
}
const at = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Xl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Yl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Zl = {
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
}, qr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Ql(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => qr(o ?? a ?? "", Xl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => qr(o ?? a ?? "", Yl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Zl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function eu(e) {
  return at(e.translatedBlockText) || at(e.translated.text) || at(e.source.text);
}
const tu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function nu(e) {
  const t = [];
  for (const n of e) {
    if (!tu(n)) continue;
    const r = Ql(eu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function ru(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const ou = 24, au = 60;
function Jr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - ou), o = Math.min(e.length, n + t.length + au), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function su(e, t, n = 200) {
  const r = at(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = at(a.translatedBlockText) || at(a.translated.text), c = i ? Jr(i, r) : null, l = c ?? Jr(at(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function tn(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Dt(e, t) {
  const n = at(t).toLowerCase();
  if (!n || !e) return tn(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${tn(e.slice(a, s))}<mark class="reader-find-mark">${tn(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + tn(e.slice(a));
}
function iu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const cu = /^data-[a-z0-9-]+$/;
function Gr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function lu(e, t, n = "") {
  if (!t.length) return Dt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Dt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => cu.test(c)).map(([c, l]) => ` ${c}="${Gr(l)}"`).join("");
    o += `<mark class="${Gr(s.className)}"${i}>${Dt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Dt(e.slice(a), n);
}
function Se(e) {
  return typeof e == "string" ? e : "";
}
function uu(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function du(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function fu(e) {
  return {
    source: Se(e == null ? void 0 : e.source_text) || Se(e == null ? void 0 : e.unit_source_text),
    translated: Se(e == null ? void 0 : e.protected_translated_text) || Se(e == null ? void 0 : e.translated_text)
  };
}
const mu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Ea(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function hu(e) {
  const t = Ea(e).sort((r, o) => Se(r.ts).localeCompare(Se(o.ts)));
  return t.length ? [
    { text: Se(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: Se(r.new_text),
      label: mu[Se(r.source)] || Se(r.source) || "修订",
      ts: Se(r.ts),
      reason: Se(r.reason)
    }))
  ].reverse() : [];
}
function pu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function gu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return Se(r.finished_at) || Se(n.finished_at) || "";
}
function bu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Ea(e).sort((a, s) => Se(a.ts).localeCompare(Se(s.ts)));
  for (const a of o) {
    const s = new Date(Se(a.ts)).getTime(), i = Se(a.reader_item_id) || Se(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, Se(a.new_text));
  }
  return n;
}
const yu = {
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
function vu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = yu[Se(n.kind)] || Se(n.kind) || "问题", o = Se(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const wu = /* @__PURE__ */ new Set(["text", "formula"]);
function sr(e) {
  return wu.has(e);
}
function Ra(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || sr(Ue(n));
}
function Su(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !sr(Ue(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const ku = 300, Iu = 72;
function Tu(e, t) {
  if (e.width >= ku && e.height >= Iu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Pu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Eu(e, t, n) {
  return e.flatMap((r) => {
    if (!Pu.has(Ue(r.region))) return [];
    const o = pt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Xr(e, t, n) {
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
async function Ru(e) {
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
const Mu = "reader-text-hover-copy", _u = "reader-text-hover-edit", Nu = "reader-text-hover-zoom", xu = "reader-text-hover-id";
function Au(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Ma = "reader-text-hover-tools";
function nn({
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
const Lu = 26, Cu = 220;
function Du(e, t = Cu) {
  return e.height < Lu * 2 || e.width < t;
}
function $u({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Xo : e === "failed" ? Xt : Os, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Ou({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = E("idle"), [u, f] = E("idle"), [d] = E(() => Au()), m = N([]), g = (e == null ? void 0 : e.itemId) || "";
  if ($(() => {
    l("idle"), f("idle");
    const S = m.current;
    return () => {
      S.forEach((_) => window.clearTimeout(_)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = Ns(e.highlight.region, t), y = Ue(e.highlight.region), k = (S, _) => async (A) => {
    A.preventDefault(), A.stopPropagation();
    const x = await Ru(S);
    _(x ? "copied" : "failed"), m.current.push(window.setTimeout(() => _("idle"), 1200));
  }, w = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (Du(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ L(
        "div",
        {
          className: Ma,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              nn,
              {
                className: xu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: k(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && sr(y) ? /* @__PURE__ */ p(
              nn,
              {
                className: _u,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (S) => {
                  S.preventDefault(), S.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Qn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              nn,
              {
                className: Mu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : w,
                onClick: k(h, l),
                children: /* @__PURE__ */ p($u, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              nn,
              {
                className: Nu,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (S) => {
                  S.preventDefault(), S.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p($s, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function zu(e, t) {
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
function Fu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = pt(
      zu(e, a),
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
const Bu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', ju = 256, Lt = /* @__PURE__ */ new Map();
function Uu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function _a(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ui(t, { bareLatex: !0 }), o = Uu(n), a = di(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Lt.get(t);
  if (!s && (s = fi(o, r), Lt.set(t, s), Lt.size > ju)) {
    const i = Lt.keys().next().value;
    i !== void 0 && Lt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function kn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Xe(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Hu(e, t) {
  const n = e.typography, r = Xe(t) || 1, o = Xe(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = kn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Xe(n == null ? void 0 : n.fit_min_font_size_pt), u = Xe(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Xe(n == null ? void 0 : n.leading_em), h = [
    Xe(n == null ? void 0 : n.padding_top_pt) || 0,
    Xe(n == null ? void 0 : n.padding_right_pt) || 0,
    Xe(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Xe(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Bu,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (kn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : kn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Wu(e, t, n, r) {
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
const Ku = 512, Ct = /* @__PURE__ */ new Map();
let Bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Bn += 1;
}));
function Vu(e, t, n, r) {
  return [
    Bn,
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
function Na({ item: e, pageScale: t }) {
  const n = N(null), r = V(
    () => _a(e.translatedText),
    [e.translatedText]
  ), [o, a] = E(r.fallbackHtml), s = V(
    () => Hu(e, t),
    [e, t]
  );
  $(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), $e(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), k = Math.max(1, e.rect.height - d - g), w = Vu(o, y, k, s);
    let b = Ct.get(w);
    if (b === void 0 && (b = Wu(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      k,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ct.set(w, b), Ct.size > Ku)) {
      const v = Ct.keys().next().value;
      v !== void 0 && Ct.delete(v);
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
function qu({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = V(
    () => Fu(e, t, n, r),
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
        Na,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Ju = Jt(qu);
function Gu({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ L("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        Na,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Ue(a.highlight.region),
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
const Xu = Jt(Gu), xa = 24, rt = xa * 2 + 4, Ye = 24, Yu = 4, Zu = 6, dt = (e) => e.left + e.width, it = (e) => e.top + e.height;
function $t(e, t) {
  const n = Math.min(dt(e), dt(t)) - Math.max(e.left, t.left), r = Math.min(it(e), it(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Yr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= dt(t) && r >= t.top && r <= it(t);
}, Qu = (e) => e.height > 40 && e.height > e.width * 2.5;
function ed(e, t, n) {
  if (!t.length || e.height < Ye || e.width < n + 8) return null;
  const r = Math.max(...t.map(it)), o = dt(e) - 4 - n;
  for (const a of [r, it(e) - 2]) {
    const s = Math.max(e.top, a - Ye), i = { left: o, top: s, width: n, height: Ye };
    if (!t.some((c) => $t(i, c) > 0)) return s - e.top;
  }
  return null;
}
function td(e, t) {
  const n = [], r = (a) => {
    const s = xa + Yu, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: dt(e), top: i, width: s, height: rt } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: rt } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ye - 3, width: rt, height: Ye + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: it(e), width: rt, height: Ye + 3 } }), r(!0);
  const o = ed(e, t, rt);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: dt(e) - 4 - rt, top: e.top + o, width: rt, height: Ye } }), n;
}
function nd(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((w) => w.width > 0 && w.height > 0 && !Qu(w)), i = s.filter((w) => Yr(w, t)), c = s.filter((w) => !Yr(w, t)), l = n.filter((w) => w !== t && $t(w, t) < t.width * t.height * 0.5), u = td(t, i).filter(({ box: w, overhang: b }) => {
    const v = b ? Zu : 0;
    return w.left >= -v && dt(w) <= r + v && w.top >= 0 && it(w) <= o;
  }), f = ({ placement: w, tailTop: b }) => b === void 0 ? { placement: w } : { placement: w, tailTop: b }, d = ({ box: w }) => !c.some((b) => $t(w, b) > 0), m = u.filter((w) => w.placement !== "tail"), g = m.find((w) => d(w) && !l.some((b) => $t(w.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((w) => w.placement === "tail" && d(w));
  if (h) return f(h);
  let y = null, k = Number.POSITIVE_INFINITY;
  for (const w of u) {
    const b = c.reduce((v, S) => v + $t(w.box, S), 0);
    b < k && (y = w, k = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function rd(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ye - 3 : it(r);
  return t >= r.left - 4 && t <= r.left + rt + 4 && n >= a && n <= a + Ye + 3;
}
const In = (e) => e.left + e.width, Tn = (e) => e.top + e.height;
function od(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > In(e) || f < e.top || f > Tn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, In(l)), i = Math.max(i, Tn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(In(e) + r, s + n) - c.left, c.height = Math.min(Tn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function ad(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function sd(e, t, n, r) {
  const [o, a] = E(null);
  return $e(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? ad(s) : [], c = Ue(t.highlight.region) === "figure", l = i.length && !c ? od(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...nd({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function id({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = E(null), [i, c] = E(!1), [l, u] = E([]), [f, d] = E(""), [m, g] = E(""), [h, y] = E(!1), [k, w] = E(null), [b, v] = E([]), S = r.drafts, _ = r.generation, A = R(async (I, T) => {
    if (e)
      try {
        u(hu(await e.fetchRevisions(I, T)));
      } catch {
        u([]);
      }
  }, [e]);
  $(() => {
    if (s(null), u([]), w(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (I) return;
      const P = T == null ? void 0 : T.item;
      if (!P) throw new Error("找不到这一段的译文。");
      const C = `${(T == null ? void 0 : T.item_id) || n}`, { source: D, translated: H } = fu(P);
      s({ readerItemId: n, itemId: C, source: D, current: H }), d(S.get(n) ?? H);
    }).catch((T) => {
      I || w({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), A(t, n), () => {
      I = !0;
    };
  }, [e, t, n, A]);
  const x = R((I) => {
    d(I), n && S.set(n, I);
  }, [n, S]), O = R(async (I, T) => {
    if (!e || !a || h) return !1;
    const P = I ?? f;
    if (!P.trim()) return !1;
    y(!0), w(null), v([]);
    try {
      const C = await e.revise(t, a.itemId, {
        translated_text: P,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ..._.current != null ? { expected_generation: _.current } : {}
      }), D = Number(C == null ? void 0 : C.generation);
      return Number.isFinite(D) && (_.current = D), S.delete(a.readerItemId), s({ ...a, current: P }), d(P), g(""), (C == null ? void 0 : C.changed) === !1 ? w({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, P), w({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), A(t, a.readerItemId), !0;
    } catch (C) {
      const D = C;
      return (D == null ? void 0 : D.reason) === "generation_mismatch" && (_.current = null), w({ tone: "error", message: (D == null ? void 0 : D.message) || "保存失败，请稍后再试。" }), v(vu(D == null ? void 0 : D.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, A, S, _]), M = R(() => {
    n && S.delete(n);
  }, [n, S]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: x,
    reason: m,
    setReason: g,
    saving: h,
    status: k,
    issues: b,
    save: O,
    discardDraft: M
  };
}
const Aa = "reader-inline-edit";
function cd({ text: e }) {
  const [t, n] = E("");
  return $(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = _a(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ L("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function ld({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var M;
  const s = e.itemId, i = id({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = E(!1), [u, f] = E(!1), d = N(null), m = Tu(e.rect, t), g = V(() => Su(o), [o]), h = g.indexOf(s), { loaded: y } = i, k = i.saving || i.loading, w = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: S } = n, _ = R((I) => {
    const T = g[h + I];
    T && (S(T), a == null || a(T));
  }, [g, h, S, a]), A = R(() => {
    i.discardDraft(), v();
  }, [i, v]), x = R(async (I, T) => {
    await i.save(I, T) && v();
  }, [i, v]);
  $(() => {
    const I = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), _(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [_]), $e(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    I.style.height = `${Math.max(T, I.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const O = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ L(Le, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${Aa} is-${m.mode}`,
        style: O,
        role: "group",
        "aria-label": `改第 ${((M = n.target) == null ? void 0 : M.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            se,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((I) => !I),
              children: y.source
            }
          ) : null,
          w ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: w }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            si,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: k || !!w,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || x()) : I.key === "Escape" && (I.preventDefault(), A());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(cd, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(lt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => _(-1), children: /* @__PURE__ */ p(zs, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(lt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => _(1), children: /* @__PURE__ */ p(er, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              na,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: k || !!w || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || x()) : I.key === "Escape" && (I.preventDefault(), A());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ L(
              se,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p(Fs, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(se, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: A, children: "取消" }),
            /* @__PURE__ */ p(
              se,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: k || !!w || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  x();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, T) => {
            const P = I.text === y.current, C = [pu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": I.label, "data-current": P ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  C,
                  P ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                P ? null : /* @__PURE__ */ p(
                  se,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: k || !!w,
                    onClick: () => {
                      x(I.text, `回到「${C.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${T}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const La = Gt(null), Ca = Gt(null);
function ud({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(La.Provider, { value: e, children: /* @__PURE__ */ p(Ca.Provider, { value: t, children: n }) });
}
function tt() {
  return ut(La);
}
function ir() {
  return ut(Ca);
}
const Da = 1.414;
function dd({
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
  showLiveTranslation: k = r === "source",
  liveTranslationMissing: w = !1
}) {
  var te, ye;
  const b = tt(), v = b == null ? void 0 : b.revisedBlocks, S = b == null ? void 0 : b.blockEdit, _ = S == null ? void 0 : S.pendingEdits, A = b == null ? void 0 : b.editBlock, x = (b == null ? void 0 : b.findTerm) || "", O = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", M = b == null ? void 0 : b.textMarks, I = V(
    () => M ? ({ str: F }) => lu(F, M(F), x) : x ? ({ str: F }) => Dt(F, x) : void 0,
    [x, M]
  ), T = N(c ?? Da), [P, C] = E(T.current);
  $(() => {
    c != null && Math.abs(c - T.current) >= 1e-3 && (T.current = c, C(c));
  }, [c]);
  const D = N(u);
  D.current = u;
  const H = N(null), W = N((F) => {
    var re;
    H.current = F, (re = D.current) == null || re.call(D, F);
  }).current, Y = N(null), U = N(`${t}@${n}`);
  $e(() => {
    const F = `${t}@${n}`;
    U.current !== F && (U.current = F, o && md(H.current, Y.current));
  }, [o, n, t]), $(() => {
    o || Pn(Y.current);
  }, [o]), $(() => () => Pn(Y.current), []);
  const q = Math.max(120, Math.floor(t * P)), Z = Math.max(q, Math.ceil(s || 0)), ge = pt(f, t, q), ee = V(
    () => Eu(d, t, q),
    [q, d, t]
  ), [ce, Ne] = E(null), le = typeof g == "function", de = le ? m ?? null : ce, z = (F) => {
    le ? F !== (m ?? null) && (g == null || g(F)) : Ne((re) => re === F ? re : F);
  }, K = V(
    () => ee.find((F) => F.itemId === de) || null,
    [de, ee]
  ), X = r === "translated" && ((te = S == null ? void 0 : S.target) == null ? void 0 : te.itemId) || "", fe = V(
    () => X && ee.find((F) => F.itemId === X) || null,
    [X, ee]
  ), ae = sd(H, o ? K : null, ee, t), me = (F) => {
    var xe, Oe, Me, ze;
    if (F.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      z(null);
      return;
    }
    if (F.buttons !== 0) {
      z(null);
      return;
    }
    if ((Oe = (xe = F.target) == null ? void 0 : xe.closest) != null && Oe.call(xe, `.${Ma}`) || (ze = (Me = F.target) == null ? void 0 : Me.closest) != null && ze.call(Me, `.${Aa}`)) return;
    const re = F.currentTarget.getBoundingClientRect(), he = F.clientX - re.left, Ce = F.clientY - re.top;
    if (rd(ae, he, Ce)) return;
    const Re = Xr(ee, he, Ce);
    z((Re == null ? void 0 : Re.itemId) || null);
  }, ke = (F) => {
    if (F.pointerType === "mouse") return;
    const re = F.currentTarget.getBoundingClientRect(), he = Xr(
      ee,
      F.clientX - re.left,
      F.clientY - re.top
    );
    z((he == null ? void 0 : he.itemId) || null);
  }, ie = (F) => {
    !Number.isFinite(F) || F <= 0 || Math.abs(T.current - F) < 1e-3 || (T.current = F, C(F), l == null || l(e, F));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: W,
      [Ee]: e,
      [Te]: r,
      [tr]: q,
      className: nr,
      onPointerMoveCapture: me,
      onPointerDown: ke,
      onDoubleClick: (F) => {
        const re = b == null ? void 0 : b.zoomBlock;
        !re || b != null && b.pointerTaken || !K || Ue(K.highlight.region) === "figure" && (F.preventDefault(), re(K.itemId));
      },
      onPointerLeave: (F) => {
        F.pointerType === "mouse" && z(null);
      },
      style: {
        width: t,
        height: Z,
        minHeight: Z
      },
      children: [
        o ? /* @__PURE__ */ p(
          ci,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: I,
            renderAnnotationLayer: !1,
            className: ca,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: ln,
                style: { width: t, height: q }
              }
            ),
            onLoadSuccess: (F) => {
              try {
                const re = F.getViewport({ scale: 1 });
                if (re.width > 0) {
                  const he = re.height / re.width;
                  ie(he);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Pn(Y.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: ln,
            style: { width: t, height: q },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: Y, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        ge ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: ge,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && k ? /* @__PURE__ */ p(
          Ju,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: q
          }
        ) : null,
        o && k && w ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (_ != null && _.size) ? /* @__PURE__ */ p(Xu, { targets: ee, edits: _, width: t, excludeId: fe == null ? void 0 : fe.itemId }) : null,
        o && fe && S ? /* @__PURE__ */ p(
          ld,
          {
            target: fe,
            page: { width: t, height: q },
            edit: S,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: ee.filter((F) => v.has(F.itemId)).map((F) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": F.itemId,
            style: { left: F.rect.left, top: F.rect.top, height: F.rect.height }
          },
          F.itemId
        )) }) : null,
        (ye = b == null ? void 0 : b.pageLayers) == null ? void 0 : ye.map((F) => /* @__PURE__ */ p(Yn, { children: F.render({ page: e, width: t, height: q, pane: O, active: o }) }, F.id)),
        /* @__PURE__ */ p(
          Ou,
          {
            target: o && !(b != null && b.pointerTaken) && (K == null ? void 0 : K.itemId) !== (fe == null ? void 0 : fe.itemId) ? K : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: K && (v == null ? void 0 : v.get(K.itemId)) || 0,
            onEdit: A,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: ae == null ? void 0 : ae.rect,
            placement: ae == null ? void 0 : ae.placement,
            tailTop: ae == null ? void 0 : ae.tailTop
          }
        )
      ]
    }
  );
}
const fd = Jt(dd);
function md(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Pn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const hd = 2 * 1024 * 1024;
function pd(e) {
  const t = new ra.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const En = 5, gd = "120% 0px", bd = 120, yd = "25% 0px";
let Zr = 1;
const Qr = /* @__PURE__ */ new WeakMap();
function vd(e) {
  if (!e) return 0;
  const t = Qr.get(e);
  if (t) return t;
  const n = Zr;
  return Zr += 1, Qr.set(e, n), n;
}
function wd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Sd = Wo(
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
    regions: k = [],
    readerMetadata: w = null,
    hoveredRegionId: b = null,
    onHoverRegion: v,
    liveTranslation: S,
    showLiveTranslation: _ = t === "source",
    liveTranslationPendingLabel: A = "",
    paneAction: x
  }, O) {
    Gl();
    const { file: M, loading: I, error: T } = qi(n, r), P = `${n}\0${vd(M)}`, C = N(P);
    C.current = P;
    const D = V(() => {
      const j = ji(M);
      return j ? "ranged" in j ? { range: pd(j.ranged) } : j : null;
    }, [M, n]), [H, W] = E(0), [Y, U] = E(""), [q, Z] = E(null), [ge, ee] = E(480), ce = N(null), Ne = N(0), le = V(() => wd(), []), de = V(() => ({
      cMapUrl: Ht().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Ht().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: hd,
      disableAutoFetch: !0
    }), []);
    Zn(O, () => q, [q]), $(() => {
      const j = (Q) => {
        Ne.current = Q, ee(Q);
      }, oe = (Q) => {
        const ve = pc(Q, Ne.current);
        if (ve !== "ignore") {
          if (ce.current && clearTimeout(ce.current), ve === "immediate") {
            j(Q);
            return;
          }
          ce.current = setTimeout(() => j(Q), ma);
        }
      }, ne = !!(c && c >= 80);
      oe(ne ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const we = !ne && i && typeof ResizeObserver < "u" ? new ResizeObserver((Q) => {
        var ve, Pe;
        oe(((Pe = (ve = Q[0]) == null ? void 0 : ve.contentRect) == null ? void 0 : Pe.width) ?? i.clientWidth);
      }) : null;
      return we && i && we.observe(i), () => {
        we == null || we.disconnect(), ce.current && clearTimeout(ce.current);
      };
    }, [c, i, a]);
    const z = V(
      () => fc(ge, o),
      [ge, o]
    ), [K, X] = E(() => /* @__PURE__ */ new Map()), [fe, ae] = E(() => /* @__PURE__ */ new Set()), [me, ke] = E(() => /* @__PURE__ */ new Set()), ie = N(/* @__PURE__ */ new Map()), te = N(null), ye = N(null), [F, re] = E(() => /* @__PURE__ */ new Set()), he = N(/* @__PURE__ */ new Map()), Ce = R((j, oe) => {
      X((ne) => {
        if (ne.get(j) === oe) return ne;
        const ue = new Map(ne);
        return ue.set(j, oe), ue;
      });
    }, []), Re = R((j, oe) => {
      const ne = ie.current, ue = ne.get(j), we = [te.current, ye.current];
      if (ue)
        for (const Q of we)
          try {
            Q == null || Q.unobserve(ue);
          } catch {
          }
      if (oe) {
        ne.set(j, oe);
        for (const Q of we)
          try {
            Q == null || Q.observe(oe);
          } catch {
          }
      } else
        ne.delete(j);
    }, []), xe = N(/* @__PURE__ */ new Map()), Oe = R((j) => {
      const oe = xe.current;
      let ne = oe.get(j);
      return ne || (ne = (ue) => Re(j, ue), oe.set(j, ne)), ne;
    }, [Re]);
    $(() => {
      if (typeof IntersectionObserver > "u") return;
      const j = he.current, oe = new IntersectionObserver(
        (ne) => {
          const ue = [], we = [];
          for (const Q of ne) {
            const ve = Q.target, Pe = dn(ve);
            Number.isFinite(Pe) && (Q.isIntersecting ? ue : we).push(Pe);
          }
          if ((ue.length || we.length) && ae((Q) => {
            let ve = null;
            for (const Pe of ue)
              Q.has(Pe) || (ve = ve || new Set(Q), ve.add(Pe));
            for (const Pe of we)
              Q.has(Pe) && (ve = ve || new Set(Q), ve.delete(Pe));
            return ve || Q;
          }), ue.length) {
            for (const Q of ue) {
              const ve = j.get(Q);
              ve && (clearTimeout(ve), j.delete(Q));
            }
            ke((Q) => {
              let ve = null;
              for (const Pe of ue)
                Q.has(Pe) || (ve = ve || new Set(Q), ve.add(Pe));
              return ve || Q;
            });
          }
          for (const Q of we)
            j.has(Q) || j.set(Q, setTimeout(() => {
              j.delete(Q), ke((ve) => {
                if (!ve.has(Q)) return ve;
                const Pe = new Set(ve);
                return Pe.delete(Q), Pe;
              });
            }, bd));
        },
        { root: i, rootMargin: gd, threshold: 0 }
      );
      te.current = oe;
      for (const ne of ie.current.values())
        try {
          oe.observe(ne);
        } catch {
        }
      return () => {
        oe.disconnect(), te.current === oe && (te.current = null);
        for (const ne of j.values()) clearTimeout(ne);
        j.clear();
      };
    }, [i]), $(() => {
      if (typeof IntersectionObserver > "u") return;
      const j = new IntersectionObserver(
        (oe) => {
          re((ne) => {
            let ue = null;
            for (const we of oe) {
              const Q = dn(we.target);
              !Number.isFinite(Q) || we.isIntersecting === ne.has(Q) || (ue = ue || new Set(ne), we.isIntersecting ? ue.add(Q) : ue.delete(Q));
            }
            return ue || ne;
          });
        },
        { root: i, rootMargin: yd, threshold: 0 }
      );
      ye.current = j;
      for (const oe of ie.current.values())
        try {
          j.observe(oe);
        } catch {
        }
      return () => {
        j.disconnect(), ye.current === j && (ye.current = null);
      };
    }, [i]);
    const Me = !!i && typeof IntersectionObserver < "u";
    $e(() => {
      W(0), U(""), ae(/* @__PURE__ */ new Set()), ke(/* @__PURE__ */ new Set()), X(/* @__PURE__ */ new Map()), ie.current.clear();
      const j = he.current;
      for (const oe of j.values()) clearTimeout(oe);
      j.clear(), h == null || h(0, t);
    }, [P, h, t]);
    const ze = R(
      (j) => {
        if (C.current !== P) return;
        const oe = j.numPages;
        W(oe), U(""), h == null || h(oe, t), f == null || f({ numPages: oe, pane: t }), m && typeof j.getPage == "function" && m(j, t), d && typeof j.getOutline == "function" && Jl(j).then((ne) => {
          C.current === P && d(ne, t);
        }, () => {
        });
      },
      [P, f, d, m, h, t]
    ), qe = R(
      (j) => {
        if (C.current !== P) return;
        const oe = (j == null ? void 0 : j.message) || "PDF 解析失败";
        U(oe), W(0), h == null || h(0, t), g == null || g(j, t);
      },
      [P, g, h, t]
    ), De = V(
      () => H > 0 ? Array.from({ length: H }, (j, oe) => oe + 1) : [],
      [H]
    );
    $(() => {
      typeof IntersectionObserver < "u" || ke(new Set(De));
    }, [De]);
    const B = V(
      () => Et(y, w, t),
      [y, w, t]
    ), G = V(() => {
      const j = /* @__PURE__ */ new Map();
      for (const oe of k) {
        const ne = Et(oe, w, t);
        if (!ne) continue;
        const ue = j.get(ne.box.page) || [];
        ue.push(ne), j.set(ne.box.page, ue);
      }
      return j;
    }, [t, w, k]), J = V(() => {
      const j = /* @__PURE__ */ new Set();
      if (!b) return j;
      for (const [oe, ne] of G)
        ne.some((ue) => ue.itemId === b) && j.add(oe);
      return j;
    }, [b, G]), pe = V(() => {
      if (H === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(De);
      if (fe.size === 0) {
        const ne = Math.min(H, En * 2 + 1);
        return new Set(Array.from({ length: ne }, (ue, we) => we + 1));
      }
      const oe = /* @__PURE__ */ new Set();
      for (const ne of fe)
        for (let ue = -En; ue <= En; ue++) {
          const we = ne + ue;
          we >= 1 && we <= H && oe.add(we);
        }
      return oe;
    }, [H, De, i, a, fe]), Ie = !n || !!T || !!Y, Fe = n && (T || Y) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: Z,
        className: `reader-panel ${pn}${a ? "" : " is-hidden"}`,
        [Te]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (S == null ? void 0 : S.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          x ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: x }) : null,
          A ? /* @__PURE__ */ L("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: A })
          ] }) : null,
          Ie && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Fe }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          D && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            li,
            {
              file: D,
              loading: null,
              error: null,
              options: de,
              onLoadSuccess: ze,
              onLoadError: qe,
              className: "reader-react-pdf-document",
              children: De.map((j) => {
                if (pe.has(j))
                  return /* @__PURE__ */ p(
                    fd,
                    {
                      pane: t,
                      pageNumber: j,
                      width: z,
                      devicePixelRatio: le,
                      active: me.has(j),
                      textLayer: !Me || F.has(j),
                      syncedMinHeight: (l == null ? void 0 : l.get(j)) || 0,
                      onMetrics: u,
                      cachedAspect: K.get(j),
                      onAspectChange: Ce,
                      sentinelRef: Oe(j),
                      regionHighlight: (B == null ? void 0 : B.box.page) === j ? B : null,
                      regionTargets: G.get(j),
                      hoveredRegionId: b && J.has(j) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: S == null ? void 0 : S.layoutByPage.get(j - 1),
                      liveTranslationPage: S == null ? void 0 : S.pagesByPage.get(j - 1),
                      showLiveTranslation: _,
                      liveTranslationMissing: yl(S, j - 1)
                    },
                    `${t}-${j}`
                  );
                const ne = K.get(j) ?? Da, ue = Math.max(120, Math.floor(z * ne)), we = Math.max(ue, Math.ceil((l == null ? void 0 : l.get(j)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Oe(j),
                    [Ee]: j,
                    [Te]: t,
                    [tr]: ue,
                    className: `${nr} is-placeholder`,
                    style: {
                      width: z,
                      height: we,
                      minHeight: we
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: ln,
                        style: { width: z, height: ue },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${j}`
                );
              })
            },
            P
          ) }) : null
        ]
      }
    );
  }
), eo = Jt(Sd), kd = 2e3, Id = 6, Td = 500, to = "reader-react-resizing";
function Pd(e, t) {
  const n = N(null), r = N(null);
  $e(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = Ed(e), S = Ft(e, v);
      if (!S) return;
      s = { pane: v, progress: S, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), k = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let S = !1;
      for (const _ of v) {
        const A = Math.round(_.contentRect.height);
        y.has(_.target) && y.get(_.target) !== A && (S = !0), y.set(_.target, A);
      }
      S && Rt(e, c, "auto", i);
    }), w = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(u), k == null || k.disconnect(), e.classList.remove(to);
      for (const S of no) e.removeEventListener(S, w);
      ((v = r.current) == null ? void 0 : v.stop) === w && (r.current = null);
    }, b = () => {
      Rt(e, c, "auto", i);
      const v = e.scrollHeight;
      g = v === m ? g + 1 : 0, m = v;
      const S = performance.now() - h;
      g >= Id && (v !== d || S > Td) || S > kd ? w() : u = requestAnimationFrame(b);
    };
    for (const v of no) e.addEventListener(v, w, { passive: !0 });
    for (const v of Array.from(e.children)) k == null || k.observe(v);
    e.classList.add(to), r.current = { ...s, stop: w }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, ma);
  }, [e, t]), $(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Ed(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ee}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Te) || null;
  }
  return null;
}
const no = ["wheel", "touchstart", "keydown", "pointerdown"];
function Rd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Md(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(pn)) && ((n = e.hasAttribute) != null && n.call(e, Te)));
}
function _d(e, t) {
  $(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Md(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${pn}[${Te}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = Rd(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Nd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function xd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const ro = 12;
function cr(e) {
  return Array.from(e.querySelectorAll(`.${pn}[${Te}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Ad(e) {
  const t = e.getBoundingClientRect();
  return cr(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(Te) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function Ld(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Cd(e, t) {
  return e ? cr(e).find((n) => n.getAttribute(Te) === t) ?? null : null;
}
function Dd({ shellEl: e }) {
  const [t, n] = E([]), r = N(0), o = R(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Ad(e);
      n((i) => Ld(i, s) ? i : s);
    }));
  }, [e]);
  $(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, c = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of cr(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p($d, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function $d({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - ro * 2), r = Nd(e, n), o = N(null);
  if (!r) return null;
  const a = (d) => {
    const m = Cd(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + xd(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + ro, width: n },
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
function $a(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Od(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function zd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ L("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
        se,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: $a(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Xo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Bs, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ L("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ L(
        se,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Yo, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ L(
        se,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(js, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function oo({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Od(t), a = [e === "compare" ? "对比" : "正在读", r, $a(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Fd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = E({ source: null, translated: null });
  return $e(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${Te}="${l}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Te}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ L("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(oo, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(oo, { role: "reading", ...n }) }) : null
  ] });
}
const Bd = () => () => {
}, ao = () => null;
function jd({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Ud(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Hd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Wd(e) {
  const t = tt(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, k = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", S = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", _ = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, A = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, x = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), M = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), P = e.regions ?? (t == null ? void 0 : t.regions) ?? [], C = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), D = (t == null ? void 0 : t.regionHover) ?? null, [H, W] = E(null), Y = hn(
    D ? D.subscribe : Bd,
    D ? () => D.get().itemId : ao,
    D ? () => D.get().itemId : ao
  ), U = D ? Y : H, q = R((ce) => {
    D ? D.set(ce, "pdf") : W(ce);
  }, [D]), Z = jd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), ee = Number.isFinite(g) && g > 0 ? Ud(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !Z.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Pd(d, ee), _d(d, Z.compareMode), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: ia,
      "data-reader-region-count": P.length,
      "data-reader-structured-region-count": P.filter(xs).length,
      "data-reader-metadata-ready": C ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${sa} reader-mode-${Z.mode}`,
            "data-reader-mode": Z.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                eo,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: _,
                  userZoom: m,
                  visible: Z.showSource,
                  scrollRoot: d,
                  pageWidthOverride: ee,
                  rowHeights: Z.compareMode ? h : void 0,
                  onMetrics: x,
                  emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: O,
                  onOutline: b ? void 0 : M,
                  onDocument: b ? void 0 : I,
                  activeRegion: T,
                  regions: (b == null ? void 0 : b.regions) ?? P,
                  readerMetadata: C,
                  hoveredRegionId: U,
                  onHoverRegion: q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Hd(o) : "",
                  paneAction: u && Z.showTranslated ? /* @__PURE__ */ L(Le, { children: [
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
              k ? /* @__PURE__ */ p(
                eo,
                {
                  pane: "translated",
                  url: S,
                  preloadedFile: A,
                  userZoom: m,
                  visible: Z.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: ee,
                  rowHeights: Z.compareMode ? h : void 0,
                  onMetrics: x,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: O,
                  onOutline: M,
                  onDocument: I,
                  activeRegion: T,
                  regions: P,
                  readerMetadata: C,
                  hoveredRegionId: U,
                  onHoverRegion: q,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Dd, { shellEl: d }),
        b ? /* @__PURE__ */ p(Fd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Kd = [
  { id: "source", label: "原文", Icon: Zo },
  { id: "compare", label: "对照", Icon: Qo },
  { id: "translated", label: "译文", Icon: ea }
];
function Vd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function qd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Jd(e) {
  const t = tt(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Vd(a.state) : "";
  return /* @__PURE__ */ L("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }),
    /* @__PURE__ */ L("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Kd.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = qd({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ L(
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
      a ? /* @__PURE__ */ L("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ L(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ p(Us, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ L(
          se,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Hs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ L(
        se,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(Ws, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-end", children: e.end })
  ] });
}
const Oa = [];
function Gd() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = Oa;
  const r = () => {
    n = [...e].map(([o, a]) => ({ id: o, ...a }));
    for (const o of t) o();
  };
  return {
    set: (o, a, s) => {
      e.set(o, { title: a, contribution: s }), r();
    },
    remove: (o) => {
      e.delete(o) && r();
    },
    subscribe: (o) => (t.add(o), () => t.delete(o)),
    getSnapshot: () => n
  };
}
function Xd(e, t) {
  const n = [];
  for (const { id: r, contribution: o } of e)
    if (o.menuItems)
      try {
        for (const a of o.menuItems(t)) n.push({ ...a, key: `${r}:${a.key}` });
      } catch (a) {
        console.error(`[reader] 扩展 ${r} 的右键菜单出错`, a);
      }
  return n;
}
function Yd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function Zd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Qd(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function ef(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function tf(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function nf(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function rf(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const bn = Gt(null), za = Gt(null);
function of({ api: e, store: t, children: n }) {
  const r = V(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(bn.Provider, { value: r, children: n });
}
function Zt() {
  const e = ut(bn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const af = () => () => {
}, so = () => Oa;
function sf(e) {
  return hn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Fa() {
  var t;
  const e = (t = ut(bn)) == null ? void 0 : t.store;
  return hn((e == null ? void 0 : e.subscribe) ?? af, (e == null ? void 0 : e.getSnapshot) ?? so, (e == null ? void 0 : e.getSnapshot) ?? so);
}
function yn(e) {
  var a;
  const t = (a = ut(bn)) == null ? void 0 : a.store, n = ut(za);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  $(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), $(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class cf extends ws {
  constructor() {
    super(...arguments);
    Rr(this, "state", { failed: !1 });
  }
  static getDerivedStateFromError() {
    return { failed: !0 };
  }
  componentDidCatch(n, r) {
    console.error(`[reader] 扩展 ${this.props.id} 出错，已停用`, n, r.componentStack);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const lf = Jt(function({ extensions: t }) {
  return /* @__PURE__ */ p(Le, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(cf, { id: n, children: /* @__PURE__ */ p(uf, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function uf({ id: e, title: t, children: n }) {
  const r = V(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(za.Provider, { value: r, children: n });
}
function df({
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
      se,
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
const io = 6e3;
function Ba(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function ja(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > io && (s *= io / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function Ua({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = N(null), [i, c] = E({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return $(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = ja(n, m, r, g), y = s.current, k = y == null ? void 0 : y.getContext("2d");
        if (!y || !k) return;
        y.width = h.canvasWidth, y.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const w = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), b = d.render({ canvasContext: k, viewport: w });
        f = b, await b.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && c((m) => ({ status: "error", cssHeight: m.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, l]), /* @__PURE__ */ L(
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
const ff = 1600, lr = { left: 0, top: 0, width: 1, height: 1 };
function Ha(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function mf(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function hf(e, t, n = lr, r = ff) {
  const o = await e.getPage(t), a = ja(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, Ha(s);
}
async function pf(e, t = lr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), Ha(s);
}
function gf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const bf = 4e3;
function yf(e, t, n) {
  if (e.length) {
    const o = Pa(e, n), a = o ? Ta(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function co(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ee}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, bf), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function vf(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Et(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = pt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function wf({
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
  const c = Number(e.getAttribute(Ee)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(Te) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? vf(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: yf(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
function Sf(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Ee}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Ee)) || 0, i = (o.closest(`[${Te}]`) ?? o).getAttribute(Te) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function kf({ onDone: e, onCancel: t }) {
  const [n, r] = E(null), o = N(null), a = N(null);
  $(() => {
    const c = (l) => {
      l.key === "Escape" && (l.preventDefault(), l.stopImmediatePropagation(), t());
    };
    return window.addEventListener("keydown", c, !0), () => window.removeEventListener("keydown", c, !0);
  }, [t]);
  const s = (c, l) => {
    const u = a.current;
    u && (u.style.pointerEvents = "none");
    try {
      return Sf(c, l);
    } finally {
      u && (u.style.pointerEvents = "");
    }
  }, i = n ? { left: Math.min(n.from.x, n.to.x), top: Math.min(n.from.y, n.to.y), width: Math.abs(n.to.x - n.from.x), height: Math.abs(n.to.y - n.from.y) } : null;
  return /* @__PURE__ */ L(
    "div",
    {
      ref: a,
      className: "reader-ask-crop",
      role: "presentation",
      onContextMenu: (c) => {
        c.preventDefault(), t();
      },
      onPointerDown: (c) => {
        var u, f;
        if (c.button !== 0) return;
        const l = s(c.clientX, c.clientY);
        l && (o.current = l, (f = (u = c.currentTarget).setPointerCapture) == null || f.call(u, c.pointerId), r({ from: { x: c.clientX, y: c.clientY }, to: { x: c.clientX, y: c.clientY } }));
      },
      onPointerMove: (c) => {
        n && r({ from: n.from, to: { x: c.clientX, y: c.clientY } });
      },
      onPointerUp: (c) => {
        const l = o.current, u = n == null ? void 0 : n.from;
        if (o.current = null, r(null), !l || !u) return;
        const f = mf(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const lo = 5e4, If = 2e4;
function Rn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Mg(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Tf(e, t = null) {
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
function Pf(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Ef(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function _g(e, t) {
  var r;
  const n = Ef(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Ng(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function Rf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Mf(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Mf(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function _f(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Rf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: Pf(o.selection, n),
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
function Nf(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Rn(e.question.text, lo), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Rn(e.answer.text, lo),
      thought: e.answer.thought ? Rn(e.answer.thought, If) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function xf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Af(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Lf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Cf(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Df = 50, Wa = 2, Mn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function $f() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function uo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Of({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = E(!1), [i, c] = E(Mn), [l, u] = E(!1), [f, d] = E(""), [m, g] = E("idle"), [h, y] = E(null), [k, w] = E([]), b = R((z) => {
    y(z), w([]);
  }, []), v = R((z) => w((K) => [...K, z].slice(-Wa)), []), [S, _] = E(() => /* @__PURE__ */ new Map()), A = N(/* @__PURE__ */ new Set()), x = N(/* @__PURE__ */ new Map()), O = (z) => {
    if (!z) return null;
    const K = x.current.get(z);
    return K || (M.current.records.some((X) => X.message_id === z) ? z : null);
  }, M = N(i);
  M.current = i;
  const I = N(t);
  I.current = t;
  const T = N(0), P = R(async (z, K, X, fe = []) => {
    if (!r) return;
    const ae = await r.messages(z.conversation_id, { limit: Df, ...X ? { beforeSeq: X } : {} }), me = [...ae.messages, ...fe];
    T.current += 1, c({
      conversation: z,
      main: K ?? z,
      records: me,
      compactions: ae.compactions || [],
      hasMore: ae.has_more,
      key: `${z.conversation_id}:${T.current}`,
      initial: _f(me, ae.compactions || [], I.current.documentId)
    });
  }, [r]), C = R(async () => {
    s(!0);
    const z = M.current.conversation;
    if (!(!r || (z == null ? void 0 : z.kind) === "main" && z.status !== "archived")) {
      u(!0), d("");
      try {
        const K = await r.main(I.current.documentId || void 0);
        await P(K, K);
      } catch (K) {
        d(K instanceof Error ? K.message : String(K));
      } finally {
        u(!1);
      }
    }
  }, [r, P]), D = R((z) => {
    b(z), C();
  }, [C]), H = N(t.documentId);
  $(() => {
    H.current !== t.documentId && (H.current = t.documentId, M.current = Mn, c(Mn), b(null), _(/* @__PURE__ */ new Map()), x.current.clear(), a && C());
  }, [t.documentId, a, C]);
  const W = R(async () => {
    const z = M.current, K = z.records[0];
    if (!(!z.conversation || !K || !z.hasMore)) {
      u(!0);
      try {
        await P(z.conversation, z.main, K.seq, z.records);
      } finally {
        u(!1);
      }
    }
  }, [P]), Y = R(async (z) => {
    const X = M.current.conversation;
    if (!r || !X) return;
    for (const te of z.memoryIds) A.current.add(te);
    let fe = z.memoryIds;
    if (!fe.length && o && z.startedAt) {
      const te = Af(
        await o.list({ source_conversation_id: X.conversation_id, created_after: xf(z.startedAt) }).catch(() => []),
        A.current
      );
      for (const F of te) A.current.add(F.id);
      fe = te.map((F) => F.id);
      const ye = z.answerId;
      te.length && ye && _((F) => new Map(F).set(ye, te));
    }
    const ae = Nf({ ...z, memoryIds: fe }, I.current.documentId, $f(), O(z.editedFrom));
    let me;
    try {
      me = await r.append(X.conversation_id, ae);
    } catch (te) {
      if (X.kind !== "side" || !/ask_conversation_not_open/.test(uo(te))) throw te;
      await r.reopen(X.conversation_id), me = await r.append(X.conversation_id, ae);
    }
    const [ke, ie] = me.messages;
    z.questionId && ke && x.current.set(z.questionId, ke.message_id), z.answerId && ie && x.current.set(z.answerId, ie.message_id), c((te) => {
      var ye;
      return ((ye = te.conversation) == null ? void 0 : ye.conversation_id) === X.conversation_id ? { ...te, conversation: me.conversation, records: [...te.records, ...me.messages] } : te;
    }), n == null || n(me.messages), me.compaction_due && X.kind === "main" && r.compact(X.conversation_id).catch(() => {
    });
  }, [r, o, n]), U = R(async (z) => {
    const K = M.current.conversation, X = O(z);
    if (!r || !K || !X) return null;
    try {
      await r.supersede(K.conversation_id, X);
    } catch (me) {
      if (!/ask_message_superseded/.test(uo(me))) throw me;
    }
    const fe = M.current.records.find((me) => me.message_id === X), ae = M.current.records.findIndex((me) => me.message_id === X);
    return c((me) => ({ ...me, records: me.records.map((ke, ie) => ie >= ae && ae >= 0 && !ke.superseded_at ? { ...ke, superseded_at: "now" } : ke) })), (fe == null ? void 0 : fe.selection) ?? null;
  }, [r]), q = R((z) => {
    Y(z).catch((K) => d(`这一轮没存上：${K instanceof Error ? K.message : String(K)}`));
  }, [Y]), Z = R(async (z) => {
    var fe;
    const K = M.current, X = K.main;
    if (!(!r || !X || ((fe = K.conversation) == null ? void 0 : fe.kind) !== "main")) {
      d("");
      try {
        const ae = Lf(K.records, z), me = await r.fork({
          parent_id: X.conversation_id,
          ...ae ? { forked_from_message_id: ae } : {},
          title: Cf(z.text),
          ...I.current.documentId ? { document_id: I.current.documentId } : {}
        });
        await P(me, X);
      } catch (ae) {
        d(`开不了副对话：${ae instanceof Error ? ae.message : String(ae)}`);
      }
    }
  }, [r, P]), ge = R(async (z) => {
    const K = M.current.main;
    if (r)
      try {
        await P(await r.get(z), K);
      } catch (X) {
        d(`打不开副对话：${X instanceof Error ? X.message : String(X)}`);
      }
  }, [r, P]), ee = R(async () => {
    const z = M.current.main;
    z && await P(z, z).catch(() => {
    });
  }, [P]), ce = R(async () => {
    const z = M.current.conversation;
    if (!(!r || (z == null ? void 0 : z.kind) !== "side")) {
      g("busy");
      try {
        await r.close(z.conversation_id), g("idle"), await ee();
      } catch {
        g("failed");
      }
    }
  }, [r, ee]), Ne = R(async () => r != null && r.archived ? r.archived(I.current.documentId) : [], [r]), le = R(async (z) => {
    d(""), b(null);
    try {
      await P(z, M.current.main);
    } catch (K) {
      d(`打不开这个对话：${K instanceof Error ? K.message : String(K)}`);
    }
  }, [P, b]), de = R(async () => {
    const z = M.current.main;
    if (!r || !z) return;
    await r.archive(z.conversation_id);
    const K = await r.main(I.current.documentId || void 0);
    await P(K, K);
  }, [r, P]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: f,
    pending: h,
    setPending: b,
    extras: k,
    addExtra: v,
    closingSide: m,
    notices: S,
    persistent: !!r,
    openMain: C,
    ask: D,
    close: R(() => s(!1), []),
    loadEarlier: W,
    onTurn: q,
    rewrite: U,
    fork: Z,
    openSide: ge,
    backToMain: ee,
    closeSide: ce,
    archiveMain: de,
    listArchived: Ne,
    viewArchived: le,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function fo(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Tf({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function zf({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = E([]), s = N(0), i = N(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  $(() => {
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
      (h) => d(h.map((y) => fo(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = R((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => fo(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = R((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Ff = Vo(() => import("./ReaderAskPanel-xdxsmWgS.js"));
function Bf({
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
  pageCount: u,
  editBlock: f,
  jumpToBlock: d,
  pdfDocuments: m,
  currentPage: g,
  visibleMode: h,
  activePanel: y = null
}) {
  var De;
  const k = V(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), w = R((B, G, J) => {
    const pe = B ? o.find((j) => j.itemId === B) : null, Ie = pe ? Et(pe, a, G) : null, Fe = Ie && Ie.box.page === J ? pt(Ie, 1, 1) : null;
    return Fe ? { x: Fe.left, y: Fe.top } : null;
  }, [o, a]), b = zf({ port: e, documentId: t, resetKey: c, pointOf: w }), v = Of({ port: e, book: k, onAppended: b.addRecords }), [S, _] = E(null), A = R(
    (B, G, J, pe) => wf({
      pageElement: (B == null ? void 0 : B.closest(`[${Ee}]`)) ?? null,
      clientX: G,
      clientY: J,
      itemId: i(),
      selection: pe,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), x = R(() => {
    var G;
    const B = co(((G = globalThis.getSelection) == null ? void 0 : G.call(globalThis)) ?? null);
    return !B.text || !B.element || !B.rect ? null : A(B.element, B.rect.left + B.rect.width / 2, B.rect.top + B.rect.height / 2, B.text);
  }, [A]), O = R((B) => {
    _(null), v.ask(B);
  }, [v.ask]);
  $(() => {
    if (!e) return;
    const B = (G) => {
      var Ie;
      if (G.key !== "?" || G.metaKey || G.ctrlKey || G.altKey || G.defaultPrevented) return;
      const J = G.target;
      if ((Ie = J == null ? void 0 : J.closest) != null && Ie.call(J, "input, textarea, select, [contenteditable='true']")) return;
      const pe = x();
      pe && (G.preventDefault(), G.stopImmediatePropagation(), O(pe));
    };
    return window.addEventListener("keydown", B, !0), () => window.removeEventListener("keydown", B, !0);
  }, [e, x, O]);
  const M = N(/* @__PURE__ */ new Set()), I = ((De = v.pending) == null ? void 0 : De.selection) || "";
  $(() => {
    I && M.current.add(I);
  }, [I]);
  const T = v.visible && !S, P = v.setPending, [C, D] = E(null), H = !!v.pending;
  $(() => {
    H || D(null);
  }, [H]);
  const W = N(v.pending);
  W.current = v.pending, $(() => {
    if (!T) return;
    let B = null;
    const G = () => {
      B && clearTimeout(B), B = setTimeout(() => {
        const J = x();
        !J || M.current.has(J.selection) || (W.current ? D(J) : P(J));
      }, 250);
    };
    return document.addEventListener("selectionchange", G), () => {
      B && clearTimeout(B), document.removeEventListener("selectionchange", G);
    };
  }, [T, x, P]);
  const Y = v.addExtra, U = v.extras.length, q = V(() => {
    if (!C) return null;
    const B = () => {
      M.current.add(C.selection), D(null);
    };
    return {
      label: `第 ${C.page} 页 · ${[...C.selection].length} 字`,
      replace: () => {
        B(), P(C);
      },
      ...U < Wa ? { add: () => {
        B(), Y(C);
      } } : {},
      dismiss: B
    };
  }, [C, U, P, Y]), Z = N(m);
  Z.current = m;
  const ge = R(async ({ page: B, pane: G, region: J, canvas: pe }) => {
    const Ie = Z.current[G];
    let Fe;
    if (Ie)
      Fe = await hf(Ie, B, J);
    else {
      const j = pe ?? document.querySelector(`[${Te}="${G}"] [${Ee}="${B}"] canvas`);
      if (!j) throw new Error(`第 ${B} 页还没画出来，翻到那一页再试`);
      Fe = await pf(j, J);
    }
    return new File([Fe], gf(B, J), { type: "image/png" });
  }, []), [ee, ce] = E(null), Ne = N(v.pending);
  Ne.current = v.pending;
  const le = V(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(Ks, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const B = Ne.current, G = (B == null ? void 0 : B.pane) || (h === "translated" ? "translated" : "source");
      return ge({ page: (B == null ? void 0 : B.page) || g() || 1, pane: G, region: lr });
    }
  }], [ge, g, h]), [de, z] = E(!1), [K, X] = E(""), fe = R(async (B) => {
    z(!1), X("");
    try {
      const G = await ge(B), J = A(B.point.target, B.point.x, B.point.y, "");
      ce((pe) => ({ id: ((pe == null ? void 0 : pe.id) || 0) + 1, files: [G] })), J ? O({ ...J, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (G) {
      X(G instanceof Error ? G.message : String(G));
    }
  }, [ge, A, O]), ae = R(() => z(!1), []), me = R(() => {
    X(""), z((B) => !B);
  }, []), ke = R(async (B) => {
    if (B.threadId && (e != null && e.threads) && t) {
      try {
        const G = await e.threads.get(t, B.threadId);
        _({ anchor: G.anchor || B.anchor, messages: G.messages || [], mark: B });
      } catch {
        _({ anchor: B.anchor, messages: [], mark: B });
      }
      return;
    }
    _(null), v.openMain();
  }, [e, t, v.openMain]), ie = R((B) => {
    var pe;
    if (!e) return [];
    const G = co(((pe = globalThis.getSelection) == null ? void 0 : pe.call(globalThis)) ?? null), J = A(B.target, B.clientX, B.clientY, G.element ? G.text : "");
    return J ? [{
      key: "ask",
      label: J.selection ? "问这段" : "在这里提问",
      hint: J.selection ? "?" : void 0,
      onSelect: () => O(J)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        X(""), z(!0);
      }
    }] : [];
  }, [e, A, O]), te = S ? {
    anchor: S.anchor,
    messages: S.messages,
    onClose: () => _(null),
    onDelete: e != null && e.threads && S.mark.threadId ? () => {
      e.threads.remove(t, S.mark.threadId).catch(() => {
      }), b.removeMark(S.mark.key), _(null);
    } : void 0
  } : null, ye = V(() => f ? (B, G) => {
    f(B, G ?? void 0), requestAnimationFrame(() => d(B, "translated"));
  } : null, [f, d]), F = R((B) => Ra(o, B), [o]), [re, he] = E(0), Ce = R(({ mode: B, width: G }) => {
    const J = globalThis.innerWidth || 0;
    he(B === "dock" && J - G >= 480 ? Math.round(G) : 0);
  }, []), Re = !v.persistent || !!v.view.conversation || !!v.error, xe = e && (v.visible && Re || S) ? /* @__PURE__ */ p(Ko, { fallback: null, children: /* @__PURE__ */ p(
    Ff,
    {
      port: e,
      jobId: n,
      book: k,
      ask: v,
      legacy: te,
      onShowSelection: ({ page: B, pane: G }) => l(B, G),
      onJumpToPage: (B) => l(B),
      pageCount: u,
      onLayout: Ce,
      dockTaken: y !== null,
      onEditBlock: ye,
      canEditBlock: F,
      attachTools: le,
      attachRequest: ee,
      contextOffer: q
    }
  ) }) : null, Oe = de || K ? /* @__PURE__ */ L(Le, { children: [
    de ? /* @__PURE__ */ p(kf, { onDone: (B) => void fe(B), onCancel: ae }) : null,
    K ? /* @__PURE__ */ L("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => X(""), children: [
      "截图没成：",
      K
    ] }) : null
  ] }) : null, Me = v.visible && Re || !!S, ze = v.close, qe = R(() => {
    if (Me) {
      _(null), ze();
      return;
    }
    v.openMain();
  }, [Me, ze, v.openMain]);
  return { marks: b.marks, onMark: ke, menuItems: ie, panel: xe, overlay: Oe, cropping: de, toggleCrop: me, open: v.openMain, toggle: qe, showing: Me, reserveRight: Me ? re : 0, enabled: !!e };
}
const jf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Uf() {
  const e = Zt(), t = V(() => {
    try {
      return et().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Bf({
    port: t,
    documentId: e.documentId,
    jobId: e.jobId,
    versionId: e.versionId,
    regions: e.regions,
    metadata: e.metadata,
    bookmarks: e.bookmarks,
    hoveredItemId: e.hoveredItemId,
    resetKey: e.resetKey,
    goToPage: e.goToPage,
    pageCount: e.pageCount,
    editBlock: e.editBlock,
    jumpToBlock: e.jumpToBlock,
    pdfDocuments: e.pdfDocuments,
    currentPage: e.currentPage,
    visibleMode: e.visibleMode,
    activePanel: e.activePanel
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: f, showing: d, reserveRight: m } = n, g = V(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Vs,
      pressed: d,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: qs,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: h, height: y }) => /* @__PURE__ */ p(df, { marks: r, page: h, height: y, onOpen: o }) : void 0,
    shortcuts: jf,
    reserveRight: m,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, m, c, l]);
  return yn(g), /* @__PURE__ */ L(Le, { children: [
    s,
    i
  ] });
}
const Hf = { id: "ask", title: "提问", Component: Uf };
function jn() {
  try {
    return et().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Wf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Kf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Vf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function qf({ documentId: e, jobId: t }) {
  const [n, r] = E([]), [o, a] = E(null);
  $(() => {
    r([]);
    const i = jn();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = Kf(n, t, o);
  return V(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Jf({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = E(null), [s, i] = E(""), [c, l] = E(""), u = N(0);
  $(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = R((g) => {
    const h = jn(), y = n.find((w) => w.versionId === g);
    if (!h || !y || !e) return;
    const k = ++u.current;
    i(g), l(""), (async () => {
      const w = et(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const v = await w.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), S = w.resolveReaderTranslatedPdfUrl(v.jobPayload, v.manifestPayload);
      if (!S) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: S, regions: Wf(Jo(v.regionsPayload)) };
    })().then((w) => {
      k === u.current && a(w);
    }).catch((w) => {
      k === u.current && l((w == null ? void 0 : w.message) || "这一份打不开。");
    }).finally(() => {
      k === u.current && i("");
    });
  }, [e, n]), d = R(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), m = R(async () => {
    var y, k;
    const g = jn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (w) {
      l((w == null ? void 0 : w.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((k = globalThis.history) == null || k.replaceState(globalThis.history.state, "", Vf(h, o.jobId))), a(null);
  }, [o, e]);
  return V(() => ({
    available: n.length >= 2,
    versions: n,
    readingVersionId: r,
    compared: o,
    loading: s,
    error: c,
    choose: f,
    clear: d,
    adopt: m
  }), [n, r, o, s, c, f, d, m]);
}
function Gf(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Js,
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(zd, { compare: e, onDone: t })
  } : null;
}
function Xf(e) {
  const { compared: t, versions: n, readingVersionId: r } = e;
  if (!t) return null;
  const o = n.find((s) => s.versionId === t.versionId), a = n.find((s) => s.versionId === r);
  return {
    url: t.url,
    regions: t.regions,
    left: { name: t.name, createdAt: (o == null ? void 0 : o.createdAt) || "" },
    right: { name: (a == null ? void 0 : a.name) || "当前译文", createdAt: (a == null ? void 0 : a.createdAt) || "" }
  };
}
function Yf() {
  var i;
  const e = Zt(), t = Jf({
    documentId: e.documentId,
    jobId: e.jobId,
    versions: e.translationVersions,
    readingVersionId: e.versionId || ""
  }), { visibleMode: n, setWorkspace: r } = e, o = ((i = t.compared) == null ? void 0 : i.url) || "";
  $(() => {
    o && n !== "compare" && r("compare");
  }, [o]);
  const a = t.clear;
  $(() => {
    n !== "compare" && a();
  }, [n, a]);
  const s = V(() => {
    const c = Gf(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Xf(t) };
  }, [t]);
  return yn(s), null;
}
const Zf = { id: "compare", title: "对比版本", Component: Yf }, Ka = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], mo = { pen: 35e-4, highlighter: 0.018 }, ho = 0.015, Un = "retainpdf.reader.ink.v1:";
function po(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Un + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Qf(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Un + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Un + e);
    } catch {
    }
}
function em(e, t, n, r, o, a) {
  const s = ho * ho;
  return e.filter((i) => Va(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Va(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function tm(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function nm(e) {
  const [t, n] = E(null), [r, o] = E(Ka[0].key), [a, s] = E(() => po(e)), i = N(a), c = N([]);
  $(() => {
    const h = po(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = R((h) => {
    i.current = h, s(h), Qf(e, h);
  }, [e]), u = R((h) => {
    const y = i.current, k = h(y);
    k !== y && (c.current = [...c.current.slice(-49), y], l(k));
  }, [l]), f = R((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = R((h) => {
    h.length && u((y) => y.filter((k) => !h.includes(k.id)));
  }, [u]), m = R((h) => {
    u((y) => y.some((k) => k.page === h) ? y.filter((k) => k.page !== h) : y);
  }, [u]), g = R(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return V(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const rm = [
  { tool: "pen", label: "画笔", Icon: Qn },
  { tool: "highlighter", label: "荧光笔", Icon: Gs },
  { tool: "eraser", label: "橡皮", Icon: Xs }
];
function om(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function am({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L(Le, { children: [
    rm.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      se,
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
    Ka.map((o) => /* @__PURE__ */ p(
      se,
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
    /* @__PURE__ */ p(se, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Ys, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      se,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Zs, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      se,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(Xt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function go({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(am, { ink: e, page: t, onPick: n }) });
}
function sm(e) {
  const t = N(e);
  t.current = e, $(() => {
    const n = (r) => {
      if (om(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const im = "reader-ink-layer";
function cm(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function bo({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: cm(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function lm({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = E(null), i = N(!1), c = o.strokes.filter((h) => Va(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(em(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, k] = u(h);
    o.tool === "eraser" ? f(y, k) : s([[y, k]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, k] = u(h);
    o.tool === "eraser" ? f(y, k) : s((w) => w ? tm(w, y, k) : [[y, k]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: mo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: im,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(bo, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(bo, { stroke: { tool: o.tool, color: o.color, width: mo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const um = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function dm(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: Qn,
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p(go, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(go, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(lm, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: um
  };
}
function fm() {
  const e = Zt(), t = nm(e.resetKey);
  sm(t);
  const n = V(() => dm(t), [t]);
  return yn(n), null;
}
const mm = { id: "ink", title: "画笔", Component: fm }, hm = Wo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ L(
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
}), pm = hm;
function gm(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
const bm = Vo(() => import("./ReaderMarkdownPanel-BParx9N4.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), qa = { id: "markdown", label: "Markdown", short: "MD", Icon: pm, needsJob: !0 };
function ym() {
  const e = Zt(), t = e.activePanel === qa.id;
  if (!gm(t)) return null;
  const r = /* @__PURE__ */ p(Ko, { fallback: null, children: /* @__PURE__ */ p(bm, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? ii(r, e.panelHost) : r;
}
const vm = {
  id: "markdown",
  title: "Markdown",
  Component: ym,
  panels: [qa]
}, Ja = "reader-xref", Hn = "data-xref", Ot = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, wm = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Ot})`), Sm = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Wn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function km(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Im(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Tm(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Ue(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Pm(e, t, n) {
  return (e.find((o) => Ue(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Em(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ue(r), s = Im(r);
    if (a === "formula") {
      for (const g of s.matchAll(Sm)) {
        const h = Wn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = wm.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = km(i[1]), u = Wn(i[2]), f = Tm(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Pm(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Rm = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Ot})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Ot})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Ot})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Ot})\s*[）)]`, "g"), kind: () => "equation" }
];
function Mm(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Rm) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Wn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function _m(e, t) {
  return Mm(e, t).map((n) => ({ start: n.start, end: n.end, className: Ja, attrs: { [Hn]: n.key } }));
}
const Nm = { figure: "图", table: "表", equation: "式" };
function yo(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Nm[e.kind]} ${e.label}`;
}
const vo = { figure: "图", table: "表", formula: "公式", text: "文字" }, nt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function xm(e, t, n) {
  const r = Et(e, t, n), o = r ? pt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Ba({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Am(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = Et(u, t, n), d = f ? pt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Ba({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Lm(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function Cm(e, t) {
  const n = (o) => {
    const a = Ue(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Dm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var O;
  const i = t.find((M) => M.itemId === e) ?? null, c = V(() => i ? Cm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = E(nt.indexOf(1)), d = nt[u], m = N(null), [g, h] = E(0);
  $e(() => {
    const M = m.current;
    if (!M) return;
    const I = () => h(M.clientWidth);
    I();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return T == null || T.observe(M), () => T == null ? void 0 : T.disconnect();
  }, []);
  const y = R((M) => {
    const I = c[l + M];
    I && a(I.itemId);
  }, [c, l, a]);
  $(() => {
    const M = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), y(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), y(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), f((T) => Math.min(nt.length - 1, T + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), f((T) => Math.max(0, T - 1));
      else if (I.key === "0")
        I.preventDefault(), f(nt.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", M, !0), () => window.removeEventListener("keydown", M, !0);
  }, [s, y]), $(() => {
    const M = m.current;
    if (!M) return;
    const I = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), f((P) => Math.max(0, Math.min(nt.length - 1, P + (T.deltaY < 0 ? 1 : -1)))));
    };
    return M.addEventListener("wheel", I, { passive: !1 }), () => M.removeEventListener("wheel", I);
  }, []);
  const k = N(null);
  if (!i) return null;
  const w = Ue(i), b = o.map((M) => ({ pane: M, pdf: r[M] ?? null, where: xm(i, n, M) })).filter((M) => !!(M.pdf && M.where)), v = 16, S = typeof window > "u" ? 800 : window.innerHeight, _ = Math.min(880, S * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), A = b.length ? Lm(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), _, b.map((M) => M.where.aspect)) : 0, x = ((O = b[0]) == null ? void 0 : O.where.page) ?? i.source.page;
  return /* @__PURE__ */ L("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${vo[w] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ L("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ L("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ L("span", { className: "reader-zoom-title", children: [
          vo[w] ?? "这一块",
          " · 第 ",
          x,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ L("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Go, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(ta, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((M) => Math.max(0, M - 1)), children: /* @__PURE__ */ p(Qs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ L(se, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(nt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === nt.length - 1, onClick: () => f((M) => Math.min(nt.length - 1, M + 1)), children: /* @__PURE__ */ p(ei, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(Xt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (M) => {
            const I = m.current;
            !I || M.button !== 0 || (k.current = { x: M.clientX, y: M.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(M.pointerId));
          },
          onPointerMove: (M) => {
            const I = m.current, T = k.current;
            !I || !T || (I.scrollLeft = T.left - (M.clientX - T.x), I.scrollTop = T.top - (M.clientY - T.y));
          },
          onPointerUp: () => {
            k.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: M, pdf: I, where: T }) => /* @__PURE__ */ L("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: M === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Ua,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: T.page,
                region: T.fraction,
                cssWidth: A * d,
                label: `${M === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, M)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const $m = 380, Om = 320, yt = 8;
function zm(e, t, n) {
  const r = Math.max(yt, Math.min(e.left, n.width - t.width - yt)), o = e.bottom + yt, a = o + t.height <= n.height - yt ? o : Math.max(yt, e.top - yt - t.height);
  return { left: r, top: a };
}
function Fm({
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
    const m = r[d], g = m ? Am(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min($m, Om / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = zm(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ L("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ L("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: yo(e.target) }),
      /* @__PURE__ */ L("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Ua, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: yo(e.target) })
  ] });
}
const Bm = 250;
function jm(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Um(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Hm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Wm({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = E(null), [s, i] = E({ back: [], forward: [] }), c = N(s);
  c.current = s;
  const l = N(null), u = N({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = R(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Ft(m, g);
  }, []);
  $(() => {
    if (!e) return;
    const m = (b) => {
      var v, S;
      return (S = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : S.call(v, `.${Ja}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var A;
      const v = m(b);
      if (!v) return;
      const S = u.current.index.get(v.getAttribute(Hn) || "");
      if (!S) return;
      const _ = ((A = v.closest("[data-reader-pane]")) == null ? void 0 : A.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const x = v.getBoundingClientRect();
        a({ target: S, pane: _, anchor: { left: x.left, top: x.top, right: x.right, bottom: x.bottom } });
      }, Bm);
    }, y = (b) => {
      const v = m(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, k = (b) => {
      var x, O;
      const v = m(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((x = window.getSelection) == null ? void 0 : x.call(window)) || ""}`.trim()) return;
      const S = u.current.index.get(v.getAttribute(Hn) || "");
      if (!S) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const _ = ((O = v.closest("[data-reader-pane]")) == null ? void 0 : O.getAttribute("data-reader-pane")) || u.current.primaryPane, A = f();
      A && i((M) => jm(M, A)), u.current.follow(S, _);
    }, w = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", k, !0), e.addEventListener("scroll", w, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", k, !0), e.removeEventListener("scroll", w);
    };
  }, [e, f]);
  const d = R((m) => {
    const g = f();
    if (!g) return !1;
    const h = Um(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: k } = u.current;
    return Rt(y, h.to, "auto", k) ? (i(h.history), !0) : !1;
  }, [f]);
  return $(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Hm(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [d]), {
    preview: o,
    closePreview: R(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: R(() => d("back"), [d])
  };
}
const Km = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Vm() {
  const e = Zt(), t = V(() => Em(e.regions), [e.regions]), { jumpToBlock: n } = e, r = R((s, i) => n(s.itemId, i), [n]), o = Wm({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = V(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => _m(s, t) : void 0,
    shortcuts: Km
  }), [t]);
  return yn(a), /* @__PURE__ */ L(Le, { children: [
    o.preview ? /* @__PURE__ */ p(Fm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ L(se, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(ti, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const qm = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Vm }, ur = [mm, vm, Zf, qm, Hf];
function dr(e = ur) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Jm(e) {
  const t = tt(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Le, { children: (e.tabs ?? dr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, f = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ L(
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
function Gm(e) {
  const t = tt(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = dr().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
    key: c,
    label: l,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ L("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: d, badge: m, onClick: g }) => /* @__PURE__ */ L(
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
        children: /* @__PURE__ */ p(Xt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Xm(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Ym(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Zm(e) {
  return e / 100 * window.innerHeight;
}
function Qm(e) {
  return e / 100 * window.innerWidth;
}
function eh(e) {
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
  const [o, a] = eh(n);
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
      r = Ym(t, o);
      break;
    }
    case "em": {
      r = Xm(t, o);
      break;
    }
    case "vh": {
      r = Zm(o);
      break;
    }
    case "vw": {
      r = Qm(o);
      break;
    }
  }
  return r;
}
function Ae(e) {
  return parseFloat(e.toFixed(3));
}
function Mt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Kn(e) {
  const { panels: t } = e, n = Mt({ group: e });
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
      s = Ae(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ae(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ae(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = Ae(u / n * 100);
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
function be(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Vn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? th : nh
  );
}
function th(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function nh(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Ga(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Xa(e, t) {
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
function rh({
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
    const { x: i, y: c } = Xa(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return be(o, "No rect found"), o;
}
let rn;
function oh() {
  return rn === void 0 && (typeof matchMedia == "function" ? rn = !!matchMedia("(pointer:coarse)").matches : rn = !1), rn;
}
function Ya(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Vn(
    n,
    Array.from(t.children).filter(Ga).map((g) => ({ element: g }))
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
          (k) => k.element === h
        );
        if (y) {
          if (d) {
            const k = d.element.getBoundingClientRect(), w = h.getBoundingClientRect();
            let b;
            if (c) {
              const v = n === "horizontal" ? new DOMRect(
                k.right,
                k.top,
                0,
                k.height
              ) : new DOMRect(
                k.left,
                k.bottom,
                k.width,
                0
              ), S = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (m.length) {
                case 0: {
                  b = [
                    v,
                    S
                  ];
                  break;
                }
                case 1: {
                  const _ = m[0], A = rh({
                    orientation: n,
                    rects: [k, w],
                    targetRect: _.element.getBoundingClientRect()
                  });
                  b = [
                    _,
                    A === k ? S : v
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
                  k.right,
                  w.top,
                  w.left - k.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  k.bottom,
                  w.width,
                  w.top - k.bottom
                )
              ];
            for (const v of b) {
              let S = "width" in v ? v : v.element.getBoundingClientRect();
              const _ = oh() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < _) {
                const x = _ - S.width;
                S = new DOMRect(
                  S.x - x / 2,
                  S.y,
                  S.width + x,
                  S.height
                );
              }
              if (S.height < _) {
                const x = _ - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - x / 2,
                  S.width,
                  S.height + x
                );
              }
              const A = g <= l || g > u;
              !i && !A && s.push({
                group: e,
                groupSize: Mt({ group: e }),
                panels: [d, y],
                separator: "width" in v ? void 0 : v,
                rect: S
              }), i = !1;
            }
          }
          c = !1, d = y, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (k) => k.element === h
        );
        y ? m.push(y) : (d = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var ot;
class Za {
  constructor() {
    _r(this, ot, {});
  }
  addListener(t, n) {
    const r = Nt(this, ot)[t];
    return r === void 0 ? Nt(this, ot)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Nt(this, ot)[t];
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
    Nr(this, ot, {});
  }
  removeListener(t, n) {
    const r = Nt(this, ot)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
ot = new WeakMap();
let Tt = {
  cursorFlags: 0,
  state: "inactive"
};
const fr = new Za();
function ft() {
  return Tt;
}
function ah(e) {
  return fr.addListener("change", e);
}
function sh(e) {
  const t = Tt, n = { ...Tt };
  n.cursorFlags = e, Tt = n, fr.emit("change", {
    prev: t,
    next: n
  });
}
function Pt(e) {
  const t = Tt;
  Tt = e, fr.emit("change", {
    prev: t,
    next: e
  });
}
const ih = (e) => e, _n = () => {
}, Qa = 1, es = 2, ts = 4, ns = 8, wo = 3, So = 12;
let on;
function ko() {
  return on === void 0 && (on = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (on = !0)), on;
}
function ch({
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
        if (e && ko()) {
          const a = (e & Qa) !== 0, s = (e & es) !== 0, i = (e & ts) !== 0, c = (e & ns) !== 0;
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
    return ko() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Io = /* @__PURE__ */ new WeakMap();
function mr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Io.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = ft();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = ch({
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
  Io.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ke = /* @__PURE__ */ new Map();
const rs = new Za();
function lh(e) {
  Ke = new Map(Ke), Ke.delete(e);
}
function To(e, t) {
  for (const [n] of Ke)
    if (n.id === e)
      return n;
}
function st(e, t) {
  for (const [n, r] of Ke)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function gt() {
  return Ke;
}
function hr(e, t) {
  return rs.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Qe(e, t, n) {
  const r = Ke.get(e);
  Ke = new Map(Ke), Ke.set(e, t), rs.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function os(e) {
  const t = ft();
  let n = !1;
  switch (t.state) {
    case "active":
      Pt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (mr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = st(r.group.id, !0);
        Qe(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Po(e) {
  e.defaultPrevented || os(e.currentTarget);
}
function uh(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Xa(n, a.rect);
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
function dh(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function fh(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Mo(e),
    b: Mo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  be(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Ro(Eo(n.a)),
    b: Ro(Eo(n.b))
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
const mh = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function hh(e) {
  const t = getComputedStyle(as(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function ph(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || hh(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || mh.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Eo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (be(n, "Missing node"), ph(n)) return n;
  }
  return null;
}
function Ro(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Mo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = as(e);
  return t;
}
function as(e) {
  const { parentNode: t } = e;
  return dh(t) ? t.host : t;
}
function gh(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function bh({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Ga(n) || n.contains(e) || e.contains(n))
    return !0;
  if (fh(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (gh(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function pr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Ya(o), s = uh(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && bh({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function yh(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function _e(e, t, n = 0) {
  return Math.abs(Ae(e) - Ae(t)) <= n;
}
function We(e, t) {
  return _e(e, t) ? 0 : e > t ? 1 : -1;
}
function kt({
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
  if (We(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      We(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Ae(r), r;
}
function Kt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (_e(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  be(u != null, "Invalid first pivot index"), be(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, y = n[h];
        be(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: k = 0,
          collapsible: w,
          minSize: b = 0
        } = y;
        if (w) {
          const v = i[h];
          if (be(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), _e(v, k)) {
            const S = b - v;
            We(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const h = e < 0 ? u : f, y = n[h];
        be(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: k = 0,
          collapsible: w,
          minSize: b = 0
        } = y;
        if (w) {
          const v = i[h];
          if (be(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), _e(v, b)) {
            const S = v - k;
            We(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, y = n[h];
      be(
        y,
        `Panel constraints not found for index ${h}`
      );
      const k = i[h], { collapsible: w, collapsedSize: b, minSize: v } = y;
      if (w && We(k, v) < 0)
        if (e > 0) {
          const S = v - b, _ = S / 2, A = k + e;
          We(A, v) < 0 && (e = We(e, _) <= 0 ? 0 : S);
        } else {
          const S = v - b, _ = 100 - S / 2, A = k - e;
          We(A, v) < 0 && (e = We(100 + e, _) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, k = 0;
    for (; ; ) {
      const b = i[y];
      be(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const v = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (k += v, y += h, y < 0 || y >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(k));
    e = e < 0 ? 0 - w : w;
  }
  {
    let h = e < 0 ? u : f;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), k = i[h];
      be(
        k != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = k - y, b = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: k,
        size: w
      });
      if (!_e(k, b) && (d += k - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (yh(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    be(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const k = y + d, w = kt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: k
    });
    if (l[h] = w, !_e(w, k)) {
      let b = k - w, v = e < 0 ? f : u;
      for (; v >= 0 && v < n.length; ) {
        const S = l[v];
        be(
          S != null,
          `Previous layout not found for panel index ${v}`
        );
        const _ = S + b, A = kt({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: S,
          size: _
        });
        if (_e(S, A) || (b -= A - S, l[v] = A), _e(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!_e(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, k) => (h[g[k]] = y, h), {});
}
function mt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || We(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function ht({
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
  if (!_e(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      be(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    be(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    be(l != null, `No layout data found for index ${i}`);
    const u = kt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!_e(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      be(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = kt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, _e(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function ss({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = gt();
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
    if (h && c < d && (g || l.slice(0, m).every((y, k) => {
      const w = f[k];
      return (w == null ? void 0 : w.collapsible) && _e(w.collapsedSize, u[w.panelId]);
    }))) {
      const y = l.slice(0, m).reduce((k, w) => k + u[w.id], 0);
      return {
        ...u,
        [t]: Ae(100 - y)
      };
    }
    return Kt({
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
    }), k = ht({
      layout: y,
      panelConstraints: f
    });
    mt(g, k) || Qe(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: m,
      layout: k,
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
      return c && _e(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = Mt({ group: l }), d = zt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ae(d / f * 100);
      i(m);
    }
  };
}
function _o(e) {
  if (e.defaultPrevented)
    return;
  const t = gt();
  pr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = ss({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function an(e) {
  const t = gt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function is({
  groupId: e
}) {
  const t = () => {
    const n = gt();
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
      } = t(), l = ht({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (mt(i, l) || Qe(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function ct(e, t) {
  const n = an(e), r = st(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  be(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  be(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = is({ groupId: n.id }).getLayout(), c = Kt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = ht({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  mt(i, l) || Qe(
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
function No(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = an(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ct(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ct(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ct(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ct(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ct(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = an(t), o = st(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        be(c, "Matching separator not found");
        const l = i.get(c);
        be(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (be(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], m = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ct(t, m - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = an(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        be(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), ct(t, -100);
        break;
      }
    }
}
function xo(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = gt(), n = pr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Pt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function cs({
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
    const y = r.get(u), k = o.get(u);
    if (!y || !k)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: b,
      groupSize: v,
      layout: S,
      separatorToPanels: _
    } = k;
    if (b && S && _) {
      const A = Kt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((x) => m.indexOf(x)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (mt(A, S)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Qa : es;
              break;
            }
            case "vertical": {
              i |= h < 0 ? ts : ns;
              break;
            }
          }
      } else
        Qe(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: A,
          separatorToPanels: _
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & wo : c |= i & wo, t.movementY === 0 ? c |= s & So : c |= i & So, sh(c), mr(e);
}
function Ao(e) {
  const t = gt(), n = ft();
  switch (n.state) {
    case "active":
      cs({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Lo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = ft(), n = gt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Pt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = st(a.group.id, !0);
          Qe(a.group, s, {
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
      cs({
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
      const a = pr(e, n);
      a.length === 0 ? t.state !== "inactive" && Pt({
        cursorFlags: 0,
        state: "inactive"
      }) : Pt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), mr(e.currentTarget);
      break;
    }
  }
}
function Co(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (ft().state) {
      case "hover":
        Pt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Do(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || os(e.currentTarget) && e.preventDefault();
}
function $o(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Ae(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Ae((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function vh(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = Mt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Ae(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function wh(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Sh({
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
        const m = d / 100 * n, g = Ae(
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
      u[f] = Ae(
        d / a * l
      );
    }
  else {
    const f = Ae(
      l / c.length
    );
    for (const d of c)
      u[d] = f;
  }
  return u;
}
function kh(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const vt = /* @__PURE__ */ new Map();
function Ih(e) {
  let t = !0;
  be(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: k } = h;
      if (k === e.element) {
        if (t) {
          const w = Mt({ group: e });
          if (w === 0)
            return;
          const b = st(e.id);
          if (!b)
            return;
          const v = Kn(e), S = b.defaultLayoutDeferred ? $o(v) : b.layout, _ = Sh({
            group: e,
            nextGroupSize: w,
            prevGroupSize: b.groupSize,
            prevLayout: S
          }), A = ht({
            layout: _,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && mt(b.layout, A) && wh(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === w)
            return;
          Qe(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: w,
            layout: A,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        vh(e, k, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    be(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Mt({ group: e }), i = Kn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (kh(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? $o(i), f = ht({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  vt.set(
    d,
    (vt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Ya(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Qe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    be(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", No);
  }), vt.get(d) === 1 && (d.addEventListener("contextmenu", Po, !0), d.addEventListener("dblclick", _o, !0), d.addEventListener("pointerdown", xo, !0), d.addEventListener("pointerleave", Ao), d.addEventListener("pointermove", Lo), d.addEventListener("pointerout", Co), d.addEventListener("pointerup", Do, !0)), function() {
    t = !1, vt.set(
      d,
      Math.max(0, (vt.get(d) ?? 0) - 1)
    ), lh(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", No);
    }), vt.get(d) || (d.removeEventListener(
      "contextmenu",
      Po,
      !0
    ), d.removeEventListener(
      "dblclick",
      _o,
      !0
    ), d.removeEventListener(
      "pointerdown",
      xo,
      !0
    ), d.removeEventListener("pointerleave", Ao), d.removeEventListener("pointermove", Lo), d.removeEventListener("pointerout", Co), d.removeEventListener("pointerup", Do, !0)), a.disconnect();
  };
}
function Th() {
  const [e, t] = E({}), n = R(() => t({}), []);
  return [e, n];
}
function gr(e) {
  const t = qo();
  return `${e ?? t}`;
}
const bt = typeof window < "u" ? $e : $;
function Bt(e) {
  const t = N(e);
  return bt(() => {
    t.current = e;
  }, [e]), R(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function br(...e) {
  return Bt((t) => {
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
function yr(e) {
  const t = N({ ...e });
  return bt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ls = Gt(null);
function Ph(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: ih
  });
  Zn(t, () => n.current, []), bt(() => {
    Object.assign(
      n.current,
      is({ groupId: e })
    );
  });
}
function us({
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
  const g = N({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Bt((I) => {
    mt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), y = Bt(
    (I, T) => {
      mt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), k = gr(i), w = N(null), [b, v] = Th(), S = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), _ = br(w, a);
  Ph(k, s);
  const A = Bt(
    (I, T) => {
      const P = ft(), C = To(I), D = st(I);
      if (D) {
        let H = !1;
        switch (P.state) {
          case "active": {
            H = P.hitRegions.some(
              (W) => W.group === C
            );
            break;
          }
        }
        return {
          flexGrow: D.layout[T] ?? 1,
          pointerEvents: H ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), x = yr({
    defaultLayout: n,
    disableCursor: r
  }), O = V(
    () => ({
      get disableCursor() {
        return !!x.disableCursor;
      },
      getPanelStyles: A,
      id: k,
      orientation: u,
      registerPanel: (I) => {
        const T = S.current;
        return T.panels = Vn(u, [
          ...T.panels,
          I
        ]), v(), () => {
          T.panels = T.panels.filter(
            (P) => P !== I
          ), v();
        };
      },
      registerSeparator: (I) => {
        const T = S.current;
        return T.separators = Vn(u, [
          ...T.separators,
          I
        ]), v(), () => {
          T.separators = T.separators.filter(
            (P) => P !== I
          ), v();
        };
      },
      updatePanelProps: (I, { disabled: T }) => {
        const P = S.current.panels.find(
          (H) => H.id === I
        );
        P && (P.panelConstraints.disabled = T);
        const C = To(k), D = st(k);
        C && D && Qe(C, {
          ...D,
          derivedPanelConstraints: Kn(C)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: P
      }) => {
        const C = S.current.separators.find(
          (D) => D.id === I
        );
        C && (C.disabled = T, C.disableDoubleClick = P);
      }
    }),
    [A, k, v, u, x]
  ), M = N(null);
  return bt(() => {
    const I = w.current;
    if (I === null)
      return;
    const T = S.current;
    let P;
    if (x.defaultLayout !== void 0 && Object.keys(x.defaultLayout).length === T.panels.length) {
      P = {};
      for (const q of T.panels) {
        const Z = x.defaultLayout[q.id];
        Z !== void 0 && (P[q.id] = Z);
      }
    }
    const C = {
      disabled: !!o,
      element: I,
      id: k,
      mutableState: {
        defaultLayout: P,
        disableCursor: !!x.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    M.current = C;
    const D = Ih(C), { defaultLayoutDeferred: H, derivedPanelConstraints: W, layout: Y } = st(C.id, !0);
    !H && W.length > 0 && (h(Y), y(Y, !1));
    const U = hr(k, (q) => {
      const { defaultLayoutDeferred: Z, derivedPanelConstraints: ge, layout: ee } = q.next;
      if (Z || ge.length === 0)
        return;
      const ce = C.panels.map(({ id: le }) => le).join(",");
      C.mutableState.layouts[ce] = ee, ge.forEach((le) => {
        if (le.collapsible) {
          const { layout: de } = q.prev ?? {};
          if (de) {
            const z = _e(
              le.collapsedSize,
              ee[le.panelId]
            ), K = _e(
              le.collapsedSize,
              de[le.panelId]
            );
            z && !K && (C.mutableState.expandedPanelSizes[le.panelId] = de[le.panelId]);
          }
        }
      });
      const Ne = ft().state !== "active";
      h(ee), Ne && y(ee, q.isUserInteraction);
    });
    return () => {
      M.current = null, D(), U();
    };
  }, [
    o,
    k,
    y,
    h,
    u,
    b,
    x
  ]), $(() => {
    const I = M.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ls.Provider, { value: O, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": k,
      id: k,
      ref: _,
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
us.displayName = "Group";
function vr() {
  const e = ut(ls);
  return be(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Eh(e, t) {
  const { id: n } = vr(), r = N({
    collapse: _n,
    expand: _n,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: _n
  });
  Zn(t, () => r.current, []), bt(() => {
    Object.assign(
      r.current,
      ss({ groupId: n, panelId: e })
    );
  });
}
function qn({
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
  const h = !!c, y = gr(c), k = yr({
    disabled: a
  }), w = N(null), b = br(w, s), {
    getPanelStyles: v,
    id: S,
    orientation: _,
    registerPanel: A,
    updatePanelProps: x
  } = vr(), O = f !== null, M = Bt(
    (C, D, H) => {
      f == null || f(C, c, H);
    }
  );
  bt(() => {
    const C = w.current;
    if (C !== null) {
      const D = {
        element: C,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: O ? M : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: k.disabled,
          maxSize: l,
          minSize: u
        }
      };
      return A(D);
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
    M,
    A,
    k
  ]), $(() => {
    x(y, { disabled: a });
  }, [a, y, x]), Eh(y, d);
  const I = () => {
    const C = v(S, y);
    if (C)
      return JSON.stringify(C);
  }, T = hn(
    (C) => hr(S, C),
    I,
    I
  );
  let P;
  return T ? P = JSON.parse(T) : o !== void 0 ? P = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : P = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...Rh,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...P
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
            touchAction: _ === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
qn.displayName = "Panel";
const Rh = {
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
function Mh({
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
    a = ht({
      layout: Kt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = ht({
      layout: Kt({
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
function ds({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = gr(a), l = yr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = E({}), [d, m] = E("inactive"), [g, h] = E(!1), y = N(null), k = br(y, o), {
    disableCursor: w,
    id: b,
    orientation: v,
    registerSeparator: S,
    updateSeparatorProps: _
  } = vr(), A = v === "horizontal" ? "vertical" : "horizontal";
  bt(() => {
    const M = y.current;
    if (M !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: M,
        id: c
      }, T = S(I), P = ah(
        (D) => {
          m(
            D.next.state !== "inactive" && D.next.hitRegions.some(
              (H) => H.separator === I
            ) ? D.next.state : "inactive"
          );
        }
      ), C = hr(
        b,
        (D) => {
          const { derivedPanelConstraints: H, layout: W, separatorToPanels: Y } = D.next, U = Y.get(I);
          if (U) {
            const q = U[0], Z = U.indexOf(q);
            f(
              Mh({
                layout: W,
                panelConstraints: H,
                panelId: q.id,
                panelIndex: Z
              })
            );
          }
        }
      );
      return () => {
        P(), C(), T();
      };
    }
  }, [b, c, S, l]), $(() => {
    _(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, _]);
  let x;
  n && !w && (x = "not-allowed");
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
      ref: k,
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
ds.displayName = "Separator";
const wr = 30, Sr = 65, Vt = 50, _h = 100 - Sr, Nh = 100 - wr;
function xh(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Sr, Math.max(wr, t)) : Vt;
}
function kr(e) {
  return 100 - e;
}
function wt(e) {
  return `${e}%`;
}
const Ir = "reader-document", qt = "reader-assistant", fs = "retainpdf.reader.ai-split-layout.v1", Ah = {
  [Ir]: kr(Vt),
  [qt]: Vt
};
function Tr(e) {
  const t = xh(e == null ? void 0 : e[qt]);
  return {
    [Ir]: kr(t),
    [qt]: t
  };
}
function Lh() {
  try {
    const e = JSON.parse(localStorage.getItem(fs) || "null");
    return Tr(e);
  } catch {
    return Ah;
  }
}
function Ch(e) {
  try {
    localStorage.setItem(fs, JSON.stringify(Tr(e)));
  } catch {
  }
}
function Nn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Tr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[qt]}vw`
  );
}
function Dh() {
  const e = N(null), [t] = E(Lh);
  $e(() => {
    const o = e.current;
    return Nn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = R((o) => {
    Nn(e.current, o);
  }, []), r = R((o, a) => {
    Nn(e.current, o), a.isUserInteraction && Ch(o);
  }, []);
  return /* @__PURE__ */ L(
    us,
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
          qn,
          {
            id: Ir,
            defaultSize: wt(kr(Vt)),
            minSize: wt(_h),
            maxSize: wt(Nh)
          }
        ),
        /* @__PURE__ */ p(
          ds,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          qn,
          {
            id: qt,
            defaultSize: wt(Vt),
            minSize: wt(wr),
            maxSize: wt(Sr)
          }
        )
      ]
    }
  );
}
function $h({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = E(!1);
  if ($(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ L("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ L("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ p(se, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function Oh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p($h, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(Le, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ L("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ L("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(se, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function zh(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Fh() {
  const [e, t] = E(!1), n = qo(), r = N(null), o = Fa(), a = V(() => [...xl, ...rf(o)], [o]);
  return $(() => {
    if (!e) return;
    const s = (c) => {
      const l = r.current;
      l && c.target instanceof Node && !l.contains(c.target) && t(!1);
    }, i = (c) => {
      c.key === "Escape" && (c.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", s), window.addEventListener("keydown", i), () => {
      document.removeEventListener("mousedown", s), window.removeEventListener("keydown", i);
    };
  }, [e]), $(() => {
    const s = (i) => {
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || zh(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ L("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((s) => !s),
        children: /* @__PURE__ */ p(ni, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ L(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ L("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ L("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: s.title }),
            /* @__PURE__ */ p("ul", { children: s.items.map((i) => /* @__PURE__ */ L("li", { children: [
              /* @__PURE__ */ p("kbd", { children: i.keys }),
              /* @__PURE__ */ p("span", { children: i.desc })
            ] }, `${s.title}-${i.keys}`)) })
          ] }, s.title)) }),
          /* @__PURE__ */ p("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const Bh = ["source", "sideBySide", "translated"], jh = { source: "", translated: "", sideBySide: "" };
function Uh(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = sn(e.sourceUrl), n = sn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ki({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Hh(e) {
  const [t, n] = E(() => /* @__PURE__ */ new Set()), r = V(
    () => e ? Uh(e) : jh,
    [e]
  ), o = V(
    () => Bh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = R(async (s) => {
    if (!e) return;
    const i = sn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Si(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Ii(
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
        Ti(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Wh = {
  source: Zo,
  sideBySide: Qo,
  translated: ea
}, Kh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Vh(e) {
  const t = tt(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Hh(n), i = N(null);
  return $(() => {
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
  }, []), /* @__PURE__ */ L("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ L("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(ri, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(er, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = Is[c], u = sn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : Ts(c, r), g = Wh[c];
      return /* @__PURE__ */ L(
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
            /* @__PURE__ */ L("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ L("span", { className: "reader-download-action-label", children: [
                Kh[c],
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
const qh = "retainpdf:reader:bookmarks:v1:", Jh = 200;
function Pr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ms(e) {
  const t = `${e || ""}`.trim();
  return t ? `${qh}${t}` : "";
}
function Gh(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function jt(e, t = Pr()) {
  const n = ms(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Gh(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const Jn = /* @__PURE__ */ new Set();
function Xh(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return Jn.add(n), () => {
    Jn.delete(n);
  };
}
function Gn(e, t, n) {
  const r = ms(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Jh);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...Jn]) a(e);
  return o;
}
function Yh(e, t, n = "", { storage: r = Pr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = jt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Gn(e, a.filter((i) => i.page !== s), r) : Gn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Zh(e, t, n = Pr()) {
  return Gn(e, jt(e, n).filter((r) => r.page !== t), n);
}
function Qh(e, t) {
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
function hs(e, t) {
  const [n, r] = E(() => jt(e));
  $(() => (r(jt(e)), Xh(e, () => r(jt(e)))), [e]);
  const o = R((s) => {
    r(Yh(e, s, Qh(t, s)));
  }, [e, t]), a = R((s) => r(Zh(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
function ep({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function tp({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = hs(e, r);
  if (!e || n <= 0) return null;
  const s = Math.min(Math.max(t, 1), n), i = o.some((c) => c.page === s);
  return /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", children: /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-react-hud-btn reader-bookmark-toggle${i ? " is-marked" : ""}`,
      "aria-pressed": i,
      "aria-label": i ? `取消第 ${s} 页的书签` : `给第 ${s} 页加书签`,
      title: i ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）",
      onClick: () => a(s),
      children: /* @__PURE__ */ p(ep, { filled: i })
    }
  ) });
}
function np(e) {
  const t = tt(), n = ir(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = dc(a), f = a > la + 1e-3, d = a < fn - 1e-3, m = St(r, It()), g = m >= fn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, y] = E(!1), [k, w] = E(`${i}`);
  $(() => {
    h || w(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const v = Number(`${k}`.trim());
    l(mn(v, c));
  };
  return /* @__PURE__ */ L("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ L("div", { className: "reader-bottombar-start", children: [
      e.bookmarkScope ? /* @__PURE__ */ p(
        tp,
        {
          scope: e.bookmarkScope,
          currentPage: i,
          numPages: c,
          regions: t == null ? void 0 : t.regions
        }
      ) : null,
      e.leftSlot
    ] }),
    /* @__PURE__ */ L("div", { className: "reader-bottombar-center", children: [
      o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ L(
        "form",
        {
          className: "reader-react-hud-page-form",
          onSubmit: (v) => {
            v.preventDefault(), b();
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
                value: k,
                autoFocus: !0,
                onChange: (v) => w(v.target.value.replace(/[^\d]/g, "")),
                onBlur: b,
                onKeyDown: (v) => {
                  v.key === "Escape" && (v.preventDefault(), y(!1), w(`${i}`));
                }
              }
            ),
            /* @__PURE__ */ L("span", { className: "reader-react-hud-page-suffix", children: [
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
            !l || c <= 0 || (w(`${i}`), y(!0));
          },
          children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
        }
      ) }),
      e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
      t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
        se,
        {
          className: "reader-react-hud-btn reader-react-hud-doc-dark",
          "aria-pressed": t.docDark ? "true" : "false",
          "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
          title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
          onClick: t.toggleDocDark,
          children: /* @__PURE__ */ p(rp, {})
        }
      ) }) : null,
      /* @__PURE__ */ L("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
        /* @__PURE__ */ p(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "缩小",
            disabled: !f,
            onClick: () => s(Wt(a, -1)),
            children: "−"
          }
        ),
        /* @__PURE__ */ L(
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
            onClick: () => s(Wt(a, 1)),
            children: "+"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ L("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Fh, {}) })
    ] })
  ] });
}
function rp() {
  return /* @__PURE__ */ L("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function Oo(e) {
  var t, n;
  return ha(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function op(e) {
  const [t, n] = E(() => ({
    scope: e,
    panel: Oo(Ve(e))
  }));
  $(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Oo(Ve(e))
    });
  }, [e]), $(() => {
    t.scope === e && gn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = R((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Xn = "download-toast";
function ap({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ L("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ L("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function sp(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    An.dismiss(Xn);
    return;
  }
  An.custom(
    () => /* @__PURE__ */ p(ap, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Xn, duration: 1 / 0 }
  );
}
function ip() {
  const e = R((t) => {
    t && (t.setState = sp, t.hide = () => An.dismiss(Xn));
  }, []);
  return /* @__PURE__ */ L(Le, { children: [
    /* @__PURE__ */ p(Ds, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const zo = { itemId: null, origin: null };
function cp() {
  let e = zo;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? zo : { itemId: n, origin: r };
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
const Fo = ["ask"];
function lp(e) {
  const t = (n) => {
    const r = Fo.indexOf(n.id);
    return r < 0 ? Fo.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function Bo({
  place: e,
  active: t = null,
  extensions: n = ur
}) {
  const r = e === "top" ? lp(n) : n, [o, a] = E(null), s = Fa(), i = (d) => {
    var m;
    return (((m = s.find((g) => g.id === d)) == null ? void 0 : m.contribution.toolbarItems) ?? []).filter((g) => (g.place ?? "top") === e);
  }, c = () => a(null), l = (() => {
    if (!o) return null;
    for (const { id: d } of r)
      for (const m of i(d)) {
        if (`${d}:${m.key}:popup` === o && m.popup) return m.popup(c);
        if (`${d}:${m.key}:dropdown` === o && m.dropdown) return m.dropdown(c);
      }
    return null;
  })(), u = N(null);
  $(() => {
    if (!o) return;
    const d = (g) => {
      var h;
      (h = u.current) != null && h.contains(g.target) || c();
    }, m = (g) => {
      g.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", d, !0), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", d, !0), document.removeEventListener("keydown", m);
    };
  }, [o]);
  const f = r.map((d) => {
    const m = i(d.id), g = e === "top" ? dr([d]) : [];
    return !m.length && !g.length ? null : /* @__PURE__ */ L(Yn, { children: [
      m.map((h) => {
        const y = `${d.id}:${h.key}`, k = h.Icon;
        return /* @__PURE__ */ L("span", { className: "reader-bar-tool-group", "data-has-dropdown": h.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ L(
            se,
            {
              className: "reader-bar-tool",
              "aria-label": h.label,
              title: h.title || h.label,
              "aria-pressed": !!h.pressed || o === `${y}:popup`,
              "aria-expanded": h.popup ? o === `${y}:popup` : void 0,
              "data-bar-tool": h.key,
              onClick: () => {
                var w;
                if (h.popup) {
                  a((b) => b === `${y}:popup` ? null : `${y}:popup`);
                  return;
                }
                (w = h.onClick) == null || w.call(h), c();
              },
              children: [
                /* @__PURE__ */ p(k, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
                e === "top" ? /* @__PURE__ */ p("span", { className: "reader-bar-tool-label", children: h.label }) : null
              ]
            }
          ),
          h.dropdown ? /* @__PURE__ */ p(
            se,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${h.label}：选项`,
              title: `${h.label}的选项`,
              "aria-expanded": o === `${y}:dropdown`,
              "data-bar-tool-caret": h.key,
              onClick: () => a((w) => w === `${y}:dropdown` ? null : `${y}:dropdown`),
              children: /* @__PURE__ */ p(er, { size: 12, strokeWidth: 2.2, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(Jm, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ L("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "top" ? "面板和看法" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
function up({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = V(() => Pa(e, t), [e, t]), [o, a] = E(() => /* @__PURE__ */ new Set([...Kr(r), ...r ? [r] : []]));
  $(() => {
    a(/* @__PURE__ */ new Set([...Kr(r), ...r ? [r] : []]));
  }, [e]);
  const s = N(null);
  $(() => {
    var l, u;
    (u = (l = s.current) == null ? void 0 : l.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (l) => a((u) => {
    const f = new Set(u);
    return f.has(l) ? f.delete(l) : f.add(l), f;
  }), c = (l) => l.map((u) => {
    const f = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ L("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ L("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          se,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(ta, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ L(
          se,
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
const jo = { outline: "目录", search: "搜索", bookmarks: "书签", issues: "待处理" }, dp = [], fp = [];
function mp({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `目录、搜索、书签${n ? `、待处理 ${n} 处` : ""}（⌘F 搜索）`;
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ L(se, { className: "reader-finder-toggle", "aria-label": "左栏：目录、搜索、书签", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(oi, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-badge", "aria-label": `待处理 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function hp({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = fp,
  onJumpPage: l,
  pinned: u = !1,
  onPin: f,
  bookmarkPane: d,
  issuesPane: m,
  issueCount: g = 0
}) {
  var W, Y;
  const h = ((W = tt()) == null ? void 0 : W.regions) ?? dp, y = ((Y = ir()) == null ? void 0 : Y.currentPage) ?? 1, k = V(() => nu(h), [h]), w = c.length > 0 && !!l, [b, v] = E("bookmarks"), S = w && (b === "bookmarks" || !k.length), _ = ru(k, y), A = V(() => su(h, s), [h, s]), [x, O] = E(-1);
  $(() => O(-1), [s]);
  const M = N(null), I = N(null), T = N(n);
  T.current = n, $(() => {
    if (u) return;
    const U = (Z) => {
      var ee, ce;
      const ge = Z.target;
      !ge || (ee = I.current) != null && ee.contains(ge) || (ce = ge.closest) != null && ce.call(ge, ".reader-finder-toggles, [data-finder-toggle]") || T.current();
    }, q = (Z) => {
      Z.key === "Escape" && T.current();
    };
    return document.addEventListener("pointerdown", U, !0), document.addEventListener("keydown", q), () => {
      document.removeEventListener("pointerdown", U, !0), document.removeEventListener("keydown", q);
    };
  }, [u]);
  const P = N(null);
  $(() => {
    var U, q, Z;
    e === "search" ? (U = M.current) == null || U.focus() : (Z = (q = P.current) == null ? void 0 : q.querySelector('[aria-current="location"]')) == null || Z.scrollIntoView({ block: "center" });
  }, [e, i]), $(() => {
    var U, q;
    e === "search" && x >= 0 && ((q = (U = P.current) == null ? void 0 : U.querySelector('[aria-current="true"]')) == null || q.scrollIntoView({ block: "nearest" }));
  }, [e, x]);
  const C = (U) => {
    const q = A[U];
    q && (O(U), r(q.itemId));
  }, D = ["outline", "search", ...d ? ["bookmarks"] : [], ...m ? ["issues"] : []], H = D.includes(e) ? e : "outline";
  return /* @__PURE__ */ L("aside", { ref: I, className: "reader-finder", "data-finder-tab": H, "data-pinned": u ? "true" : void 0, "aria-label": `左栏：${jo[H]}`, children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: D.map((U) => /* @__PURE__ */ L(se, { className: "reader-finder-tab", role: "tab", "aria-selected": H === U, onClick: () => t(U), children: [
        jo[U],
        U === "issues" && g ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: g }) : null
      ] }, U)) }),
      f ? /* @__PURE__ */ p(
        se,
        {
          className: "reader-finder-close reader-finder-pin",
          "aria-pressed": u,
          "aria-label": u ? "不钉了，浮在书上" : "钉在左边",
          title: u ? "不钉了：浮在书上，点别处收起" : "钉在左边：书页往右让，一直开着",
          onClick: () => f(!u),
          children: u ? /* @__PURE__ */ p(ai, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }) : /* @__PURE__ */ p(Yo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(se, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(Xt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    H === "bookmarks" ? d : H === "issues" ? m : null,
    H === "outline" && w && k.length ? /* @__PURE__ */ L("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(se, { className: "reader-finder-switch-option", role: "radio", "aria-checked": S, onClick: () => v("bookmarks"), children: "按 PDF 目录" }),
      /* @__PURE__ */ p(se, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !S, onClick: () => v("headings"), children: "按标题" })
    ] }) : null,
    H === "outline" && S && l ? /* @__PURE__ */ p(up, { nodes: c, currentPage: y, onJumpPage: l }) : H === "outline" ? k.length ? /* @__PURE__ */ p("ol", { ref: P, className: "reader-finder-list", children: k.map((U, q) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
      se,
      {
        className: "reader-finder-entry",
        "data-level": U.level,
        "aria-current": q === _ ? "location" : void 0,
        onClick: () => r(U.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: U.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: U.page })
        ]
      }
    ) }, U.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: h.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : H !== "search" ? null : /* @__PURE__ */ L(Le, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          na,
          {
            ref: M,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (U) => a(U.target.value),
            onKeyDown: (U) => {
              U.key === "Enter" ? (U.preventDefault(), C(iu(x, A.length, U.shiftKey))) : U.key === "Escape" && (U.preventDefault(), u ? U.currentTarget.blur() : n()), U.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: A.length === 0 ? "没有找到" : `${x >= 0 ? `第 ${x + 1} / ` : ""}${A.length >= 200 ? "200+ 处，只列前 200 处" : `${A.length} 处`}${x < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: A.map((U, q) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(se, { className: "reader-finder-entry is-hit", "aria-current": q === x ? "true" : void 0, onClick: () => C(q), children: [
        /* @__PURE__ */ L("span", { className: "reader-finder-entry-text", children: [
          U.snippet.slice(0, U.at),
          /* @__PURE__ */ p("mark", { children: U.snippet.slice(U.at, U.at + U.length) }),
          U.snippet.slice(U.at + U.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: U.page })
      ] }) }, U.itemId)) })
    ] })
  ] });
}
function pp(e) {
  const [t, n] = E([]);
  return $(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = et().loadIssues;
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
function gp(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const bp = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, yp = ["failed", "content", "layout"];
function vp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function wp(e, t, n) {
  const r = pp(e), [o, a] = E(-1);
  $(() => a(-1), [r]);
  const s = R((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = N({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, $(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || vp(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = gp(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function Sp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function kp(e) {
  var r;
  if (e.shiftKey || Sp(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${ia}`))) return null;
  const n = Number((r = t.closest(`[${Ee}]`)) == null ? void 0 : r.getAttribute(Ee)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Ip({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = N(null);
  if ($(() => {
    if (!e) return;
    const c = (u) => {
      var f;
      (f = o.current) != null && f.contains(u.target) || t();
    }, l = (u) => {
      u.key === "Escape" && t();
    };
    return document.addEventListener("pointerdown", c, !0), document.addEventListener("keydown", l), () => {
      document.removeEventListener("pointerdown", c, !0), document.removeEventListener("keydown", l);
    };
  }, [e, t]), !e) return null;
  const a = 380, s = Math.max(8, Math.min(e.x, (globalThis.innerWidth || a) - a - 8)), i = Math.max(68, Math.min(e.y, (globalThis.innerHeight || 600) - 60 - (n.length ? 40 : 0)));
  return /* @__PURE__ */ L("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ L(
      se,
      {
        className: "reader-ink-menu-action",
        role: "menuitem",
        title: c.hint,
        onClick: () => {
          c.onSelect(), t();
        },
        children: [
          c.label,
          c.hint ? /* @__PURE__ */ p("kbd", { children: c.hint }) : null
        ]
      },
      c.key
    )) }) : null,
    r.map((c) => /* @__PURE__ */ p(Yn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function Tp({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ L("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      se,
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
const ps = "retainpdf:reader:doc-theme:v1", Uo = "data-reader-doc";
function gs() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Pp(e = gs()) {
  try {
    return (e == null ? void 0 : e.getItem(ps)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Ep(e, t = gs()) {
  try {
    t == null || t.setItem(ps, e);
  } catch {
  }
}
function Ho(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Uo, "dark") : t.removeAttribute(Uo));
}
function Rp() {
  const [e, t] = E(() => Pp());
  $(() => {
    Ho(e);
  }, [e]), $(() => () => Ho("light"), []);
  const n = R(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Ep(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function Mp({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = hs(e, t);
  return a.length ? /* @__PURE__ */ p("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ L("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ L(
      se,
      {
        className: "reader-finder-entry reader-bookmark-jump",
        "aria-current": i.page === n ? "location" : void 0,
        onClick: () => o(r > 0 ? Math.min(i.page, r) : i.page),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: i.label || `第 ${i.page} 页` }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: i.page })
        ]
      }
    ),
    /* @__PURE__ */ p(se, { className: "reader-bookmark-remove", "aria-label": `删除第 ${i.page} 页的书签`, title: "删除这个书签", onClick: () => s(i.page), children: "×" })
  ] }, i.page)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: "还没有书签。底栏的书签按钮给眼下这一页加一个。" });
}
function _p({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ L("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    yp.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ L("h4", { children: [
          bp[o],
          /* @__PURE__ */ p("span", { children: a.length })
        ] }),
        /* @__PURE__ */ p("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(se, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
          /* @__PURE__ */ p("span", { className: "reader-issues-title", children: s.title }),
          /* @__PURE__ */ L("span", { className: "reader-issues-page", children: [
            "第 ",
            s.page,
            " 页"
          ] }),
          s.detail ? /* @__PURE__ */ p("span", { className: "reader-issues-detail", children: s.detail }) : null
        ] }) }, `${s.kind}:${s.readerItemId}`)) })
      ] }, o) : null;
    })
  ] });
}
function Np({ state: e, bookmarks: t, bookmarkScope: n, issues: r }) {
  const { finder: o, setFinder: a, findQuery: s, setFindQuery: i, findTerm: c, findFocus: l, jumpFromFinder: u, jumpToPageFromFinder: f, pinned: d, setPinned: m, canPin: g } = e, h = tt(), y = ir(), k = (y == null ? void 0 : y.currentPage) ?? 1, w = r.issues.length;
  return /* @__PURE__ */ p(Le, { children: o ? /* @__PURE__ */ p(
    hp,
    {
      tab: o,
      onTab: a,
      onClose: () => a(null),
      onJump: u,
      bookmarks: t,
      onJumpPage: f,
      query: s,
      onQuery: i,
      term: c,
      focusSignal: l,
      pinned: d,
      onPin: g ? m : void 0,
      bookmarkPane: n ? /* @__PURE__ */ p(
        Mp,
        {
          scope: n,
          regions: h == null ? void 0 : h.regions,
          currentPage: k,
          numPages: (y == null ? void 0 : y.numPages) ?? 0,
          onJumpPage: f
        }
      ) : void 0,
      issuesPane: w ? /* @__PURE__ */ p(_p, { nav: r }) : void 0,
      issueCount: w
    }
  ) : null });
}
function xp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(Le, { children: n ? /* @__PURE__ */ p(
    Dm,
    {
      itemId: n,
      regions: e.regions,
      metadata: e.readerMetadata,
      documents: t,
      panes: a === "compare" ? ["source", "translated"] : a === "translated" ? ["translated"] : ["source"],
      onNavigate: r,
      onClose: o
    }
  ) : null });
}
function Ap(e) {
  const t = e.sourceOnly || !e.translatedUrl, n = !!(e.overlayContentAvailable && e.liveTranslationVisible && !e.assistantOpen), o = e.compareFits === !1 && e.mode === "compare" ? "source" : e.mode, a = !t && (o === "translated" || o === "compare");
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
const Lp = 720;
function Cp(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Lp;
}
function Dp(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function $p(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = E(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Ap({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = gl({
    hasOverlayContent: s,
    connection: e.liveTranslation.connection,
    showSource: i.showSource,
    liveTranslationVisible: o,
    assistantOpen: t
  }), l = i.sourceViewOnly, u = i.visibleMode;
  $(() => {
    a(!1);
  }, [e.viewStateKey]), $(() => {
    e.session.jobTerminal && a(!1);
  }, [e.session.jobTerminal]);
  const f = N(null);
  return $(() => {
    f.current !== e.viewStateKey && vl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function Op(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = bl(e.liveTranslation), i = R(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = E(null);
  $(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && wl({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), f = V(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
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
function zp() {
  const [e] = E(Gd), t = sf(e), n = tf(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function Fp(e, t, n) {
  const r = N(e);
  $(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function Bp(e, t, {
  translationVersions: n,
  bookmarks: r,
  regionHover: o,
  assistantPanel: a,
  closeAssistant: s,
  visiblePdfMode: i,
  changeWorkspace: c,
  jumpToBlockIn: l,
  zoomDocuments: u,
  editBlock: f,
  panelHost: d = null
}) {
  const { session: m, panes: g } = e, h = N(e.currentPage);
  h.current = e.currentPage;
  const y = R(() => h.current, []), k = V(() => ({
    documentId: m.documentId || "",
    jobId: m.jobId,
    versionId: n.readingVersionId || null,
    translationVersions: n.versions,
    regions: m.regions,
    metadata: m.readerMetadata,
    bookmarks: r,
    pageCount: g.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => o.get().itemId,
    goToPage: e.goToPage,
    sourceOnly: e.sourceOnly,
    activePanel: a,
    closePanel: s,
    panelHost: d,
    visibleMode: i,
    setWorkspace: c,
    jumpToBlock: l,
    shellEl: e.shell.shellEl,
    primaryPane: e.panes.primaryPane,
    pdfDocuments: u,
    editBlock: f,
    currentPage: y
  }), [
    m.documentId,
    m.jobId,
    n,
    m.regions,
    m.readerMetadata,
    r,
    g.hudNumPages,
    e.viewStateKey,
    o,
    e.goToPage,
    e.sourceOnly,
    a,
    s,
    i,
    c,
    l,
    e.shell.shellEl,
    e.panes.primaryPane,
    u,
    f,
    d
  ]), { contributionStore: w, contributions: b, reserveRight: v } = t, S = V(() => Yd(b), [b]), _ = V(() => nf(b), [b]), A = V(() => ef(b), [b]), x = V(() => Zd(b), [b]), O = Qd(b);
  return { readerApi: k, contributionStore: w, contributions: b, pageLayers: S, compareVersion: _, textMarks: A, menuSections: x, pointerTakenId: O, reserveRight: v };
}
function jp() {
  try {
    return et().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Up = "这本书正在处理（翻译或排版），处理完才能改。", Hp = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Wp({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = jp(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = uu(s), l = !t || Ut(t), u = gu(n), [f, d] = E(""), [m, g] = E(null), [h, y] = E(() => /* @__PURE__ */ new Map()), [k, w] = E(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = E(() => /* @__PURE__ */ new Map()), [S, _] = E({ phase: "idle" }), A = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  $(() => {
    g(null), A.drafts.clear(), A.generation.current = null, v(/* @__PURE__ */ new Map()), _({ phase: "idle" });
  }, [s]), $(() => {
    if (d(""), !i || c || !a) return;
    let D = !1;
    return a.resolveOwnerJobId(s).then((H) => {
      D || d(`${H || s}`.trim() || s);
    }).catch(() => {
      D || d(s);
    }), () => {
      D = !0;
    };
  }, [i, c, a, s]), $(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let D = !1;
    return a.fetchRevisions(f).then((H) => {
      D || y(bu(H, u));
    }).catch(() => {
    }), () => {
      D = !0;
    };
  }, [a, f, u, l]);
  const x = S.phase === "running" && S.seenActive;
  $(() => {
    if (S.phase === "running") {
      if (!l) {
        x || _({ phase: "running", seenActive: !0 });
        return;
      }
      x && _(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [S.phase, x, l, t]);
  const O = V(() => {
    const D = new Map(h);
    if (k.renderedAt === u)
      for (const [H, W] of k.edits) D.set(H, W);
    return D;
  }, [h, k, u]), M = R((D) => {
    const H = `${D || ""}`.trim();
    H && g({ itemId: H, page: du(H) });
  }, []), I = R(() => g(null), []), T = R((D, H) => {
    w((W) => {
      const Y = new Map(W.renderedAt === u ? W.edits : []);
      return Y.set(D, H), { renderedAt: u, edits: Y };
    }), v((W) => new Map(W).set(D, (W.get(D) || 0) + 1));
  }, [u]), P = R(async () => {
    if (!(!a || !s || S.phase === "submitting" || S.phase === "running")) {
      _({ phase: "submitting" });
      try {
        await a.rerender(s), _({ phase: "running", seenActive: !1 }), await o();
      } catch (D) {
        _({ phase: "failed", message: (D == null ? void 0 : D.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, S.phase, o]), C = c ? Hp : !l || S.phase === "running" || S.phase === "submitting" ? Up : "";
  return V(() => ({
    available: i,
    blockedReason: C,
    port: a,
    ownerJobId: f,
    target: m,
    select: M,
    close: I,
    memory: A,
    pendingEdits: O,
    savedCounts: b,
    markSaved: T,
    rerender: S,
    startRerender: P
  }), [i, C, a, f, m, M, I, A, O, b, T, S, P]);
}
function Kp(e, t) {
  $(() => {
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
function Vp(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Wp({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = R((d, m) => {
    Ra(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  Kp(a.available ? u : null, n);
  const f = V(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const qp = "reader-finder-input";
function Jp(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Gp(e, t = typeof window > "u" ? null : window) {
  $(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Jp(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(qp) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const bs = "retainpdf.reader.sidebar.v1", Xp = ["outline", "search", "bookmarks", "issues"], Yp = 900;
function Zp() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(bs)) || "{}"), n = Xp.includes(t == null ? void 0 : t.tab) ? t.tab : "outline";
    return { pinned: (t == null ? void 0 : t.pinned) === !0, open: (t == null ? void 0 : t.open) === !0, tab: n };
  } catch {
    return { pinned: !1, open: !1, tab: "outline" };
  }
}
function Qp(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(bs, JSON.stringify(e));
  } catch {
  }
}
function eg() {
  const e = `(min-width: ${Yp}px)`, [t, n] = E(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
  return $(() => {
    var a;
    if (typeof window > "u" || !window.matchMedia) return;
    const r = window.matchMedia(e), o = () => n(r.matches);
    return o(), (a = r.addEventListener) == null || a.call(r, "change", o), () => {
      var s;
      return (s = r.removeEventListener) == null ? void 0 : s.call(r, "change", o);
    };
  }, [e]), t;
}
function tg(e) {
  const [t] = E(Zp), [n, r] = E(t.pinned && t.open ? t.tab : null), [o, a] = E(t.tab), [s, i] = E(t.pinned), c = eg(), l = s && c, u = R((x) => {
    r(x), x && a(x);
  }, []);
  $(() => {
    Qp({ pinned: s, open: !!n, tab: n || o });
  }, [s, n, o]);
  const f = R(() => r((x) => x ? null : o), [o]), d = R((x) => {
    r((O) => O === x ? null : x), a(x);
  }, []), m = R((x) => i(x), []), [g, h] = E(""), [y, k] = E("");
  $(() => {
    const x = g.replace(/\s+/gu, " ").trim(), O = window.setTimeout(() => k(x), x ? 150 : 0);
    return () => window.clearTimeout(O);
  }, [g]);
  const [w, b] = E(0), v = R(() => {
    u("search"), b((x) => x + 1);
  }, [u]);
  Gp(v);
  const S = R(() => {
    l || (n === "outline" || n === "bookmarks" || !c) && r(null);
  }, [l, n, c]), _ = R((x) => {
    e.jumpToAnchor({ block_id: x }), S();
  }, [e.jumpToAnchor, S]), A = R((x) => {
    e.goToPage(x), S();
  }, [e.goToPage, S]);
  return {
    finder: n,
    setFinder: u,
    toggleFinder: d,
    toggleSidebar: f,
    pinned: l,
    pinnedChoice: s,
    setPinned: m,
    canPin: c,
    findQuery: g,
    setFindQuery: h,
    findTerm: y,
    findFocus: w,
    jumpFromFinder: _,
    jumpToPageFromFinder: A
  };
}
function ng(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : da(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function rg(e, t) {
  return t === null || e !== t;
}
function og(e, t) {
  const { boot: n } = e, r = N(null), o = N(null);
  $(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Ve(e.viewStateKey), s = ng({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: It()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      rg(e.mode, o.current) && (o.current = null, gn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const ag = [];
function sg(e) {
  const { sessionFiles: t } = e, [n, r] = E({}), o = N({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = R((y, k) => {
    r((w) => ({ ...w, [k]: { url: o.current[k], nodes: y } }));
  }, []), s = V(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const k = n.translated;
    return k && k.url === t.translatedUrl && k.nodes.length ? k.nodes : ag;
  }, [n, t.sourceUrl, t.translatedUrl]), i = N({}), [c, l] = E(0), u = R((y, k) => {
    i.current[k] = { url: o.current[k], pdf: y }, l((w) => w + 1);
  }, []), [f, d] = E(null), m = R((y) => d(y), []), g = R(() => d(null), []);
  $(() => d(null), [e.viewStateKey]);
  const h = V(() => {
    const y = (k, w) => {
      const b = i.current[k];
      return b && b.url === w ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
function ig() {
  const e = _l(), { boot: t, panes: n, session: r } = e, o = op(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = zp(), { reserveRight: l } = c, u = i || l > 0, f = tg(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, h = R(() => {
    s(null);
  }, []);
  Fp(l, a, h);
  const { liveTranslationVisible: y, setLiveTranslationVisible: k, paneComposition: w, liveToggles: b, sourceViewOnly: v, visiblePdfMode: S } = $p(
    e,
    i,
    Cp(e.shell.shellWidth, u || g)
  );
  og(e, v);
  const _ = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: A, toggleDocDark: x } = Rp();
  $l({
    toggleDocDark: x,
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
  const { latestLivePage: O, jumpToLatestLivePage: M, offerCompletion: I, setCompletionDismissedKey: T, sourcePaneAction: P } = Op(e, {
    liveTranslationVisible: y,
    setLiveTranslationVisible: k,
    liveToggles: b,
    sourceViewOnly: v,
    visiblePdfMode: S
  }), C = R((J) => {
    const pe = Dp(J, e.liveTranslationAvailable);
    pe !== null && k(pe), e.setModeKeepingPage(J);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), D = R((J) => {
    s(J);
  }, []), [H] = E(cp), W = R((J) => e.jumpToAnchor({ block_id: J }), [e.jumpToAnchor]), Y = wp(e.sourceOnly ? "" : r.jobId, e.currentPage, W), [U, q] = E(null), Z = R((J, pe) => e.jumpToAnchor({ block_id: J }, pe), [e.jumpToAnchor]), { bookmarks: ge, onPdfOutline: ee, onPdfDocument: ce, zoomItem: Ne, setZoomItem: le, zoomBlock: de, closeZoom: z, zoomDocuments: K } = sg(e), { blockEdit: X, editBlock: fe, revisedBlocks: ae } = Vp(e, S, H), [me, ke] = E(null), ie = R(() => ke(null), []), te = qf({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: ye,
    contributionStore: F,
    contributions: re,
    pageLayers: he,
    compareVersion: Ce,
    textMarks: Re,
    menuSections: xe,
    pointerTakenId: Oe
  } = Bp(e, c, {
    translationVersions: te,
    bookmarks: ge,
    regionHover: H,
    assistantPanel: a,
    closeAssistant: h,
    visiblePdfMode: S,
    changeWorkspace: C,
    jumpToBlockIn: Z,
    zoomDocuments: K,
    editBlock: X.available && !X.blockedReason ? fe : null,
    panelHost: U
  }), Me = !!Oe, [ze, qe] = E([]), De = V(() => ({
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
    regionHover: H,
    jumpToBlock: W,
    revisedBlocks: ae,
    onPdfOutline: ee,
    onPdfDocument: ce,
    zoomBlock: de,
    textMarks: Re,
    pageLayers: he,
    editBlock: X.available ? fe : void 0,
    blockEdit: X,
    editShowsSource: S !== "compare",
    findTerm: d === "search" ? m : "",
    compareVersion: Ce,
    pointerTaken: Me,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: v,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: D, close: h },
    docDark: A,
    toggleDocDark: x
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
    H,
    W,
    ae,
    ee,
    ce,
    de,
    Re,
    he,
    X,
    fe,
    S,
    d,
    m,
    Ce,
    Me,
    e.sourceOnly,
    v,
    e.download,
    e.goToPage,
    D,
    h,
    A,
    x
  ]), B = V(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), G = [
    sc,
    `is-workspace-${_}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    w.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(of, { api: ye, store: F, children: /* @__PURE__ */ p(ud, { value: De, hud: B, children: /* @__PURE__ */ L(
    "div",
    {
      className: G,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": _,
      "data-pointer-taken": Oe || void 0,
      onContextMenu: (J) => {
        const pe = kp(J);
        if (!pe) return;
        const Ie = Xd(re, { target: J.target, clientX: J.clientX, clientY: J.clientY, page: pe.page });
        !Ie.length && !xe.length || (J.preventDefault(), qe(Ie), ke(pe));
      },
      children: [
        /* @__PURE__ */ p(
          Jd,
          {
            mode: S,
            documentReady: !!r.jobId,
            sourceViewOnly: v,
            onModeChange: C,
            liveTranslation: b.topBarPill ? {
              visible: y,
              state: e.liveTranslation,
              onToggle: () => k((J) => !J),
              latestPage: y ? O : null,
              currentPage: e.currentPage,
              onJumpToLatest: M
            } : null,
            completion: I ? {
              onOpenCompare: () => {
                T(e.viewStateKey), C("compare");
              }
            } : null,
            start: /* @__PURE__ */ L(Le, { children: [
              /* @__PURE__ */ p(Hl, { onBeforeClose: r.prepareClose }),
              /* @__PURE__ */ p(mp, { open: d, onToggle: f.toggleSidebar, issueCount: Y.issues.length }),
              r.title ? /* @__PURE__ */ p("span", { className: "reader-workspace-title", title: r.title, children: r.title }) : null
            ] }),
            end: /* @__PURE__ */ L(Le, { children: [
              /* @__PURE__ */ p(Bo, { place: "top", active: a }),
              /* @__PURE__ */ p(Vh, {})
            ] })
          }
        ),
        /* @__PURE__ */ L("div", { className: "reader-workspace", children: [
          /* @__PURE__ */ p(Np, { state: f, bookmarks: ge, bookmarkScope: e.viewStateKey, issues: Y }),
          /* @__PURE__ */ L("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(Wd, { paneComposition: w, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: P }),
            /* @__PURE__ */ p(Oh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts })
          ] }),
          /* @__PURE__ */ L("aside", { className: "reader-dock", hidden: !i, "aria-label": "阅读辅助面板", children: [
            /* @__PURE__ */ p(Gm, { active: a }),
            /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: q })
          ] }),
          l ? /* @__PURE__ */ p("div", { className: "reader-dock-spacer", style: { width: l }, "aria-hidden": "true" }) : null
        ] }),
        i ? /* @__PURE__ */ p(Dh, {}) : null,
        /* @__PURE__ */ p(
          np,
          {
            mode: S,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            leftSlot: /* @__PURE__ */ p(Tp, { edit: X }),
            toolsSlot: /* @__PURE__ */ p(Bo, { place: "bottom" })
          }
        ),
        /* @__PURE__ */ p(
          xp,
          {
            session: r,
            zoomDocuments: K,
            zoomItem: Ne,
            setZoomItem: le,
            closeZoom: z,
            visiblePdfMode: S
          }
        ),
        /* @__PURE__ */ p(Ip, { menu: me, onClose: ie, actions: ze, sections: xe }),
        /* @__PURE__ */ p(lf, { extensions: ur }),
        /* @__PURE__ */ p(ip, {})
      ]
    }
  ) }) });
}
function xg() {
  return /* @__PURE__ */ p(ig, {});
}
export {
  xg as R,
  ig as a,
  Mg as b,
  _g as c,
  Tf as d,
  Ef as e,
  Eg as f,
  Rg as g,
  Tg as h,
  Pg as r,
  Ng as s,
  tt as u
};
//# sourceMappingURL=ReaderApp-Cz-__yte.js.map
