var Xs = Object.defineProperty;
var Br = (e) => {
  throw TypeError(e);
};
var Ys = (e, t, n) => t in e ? Xs(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var jr = (e, t, n) => Ys(e, typeof t != "symbol" ? t + "" : t, n), Hr = (e, t, n) => t.has(e) || Br("Cannot " + n);
var Lt = (e, t, n) => (Hr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Ur = (e, t, n) => t.has(e) ? Br("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Wr = (e, t, n, r) => (Hr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as C, jsx as p, Fragment as _e } from "react/jsx-runtime";
import { useMemo as W, useState as _, useEffect as O, useCallback as L, useRef as A, useLayoutEffect as Ae, memo as Zt, createContext as Qt, useContext as ut, Fragment as Tn, forwardRef as Zs, useImperativeHandle as lr, useSyncExternalStore as En, Component as Qs, Suspense as da, lazy as fa, useId as ma } from "react";
import { requireAdapter as At, getReaderAdapters as De } from "./adapters.js";
import { resolveReaderDownloadName as ei, resolveReaderDownloadUrls as ti, READER_PROGRESS_COPY as Ke, trimString as mn, READER_DOWNLOAD_ACTIONS as ni, disabledReason as ri } from "./runtime/state.js";
import { r as oi, b as ai } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Bn, isFinishedJobStatus as Vt } from "@retainpdf/domain/job";
import { n as ha, d as si, f as Mn, k as Kr, b as ii, c as ci, j as $e, p as pt, g as li, l as xt, i as ui } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as di } from "@retainpdf/api/documents";
import { isReaderTransportError as fi, createReaderTransportError as mi } from "./contracts.js";
import { toast as jn, Toaster as hi } from "sonner";
import { ChevronLeft as pa, PenLine as hn, ZoomIn as pi, Check as ur, X as gt, Copy as ga, ChevronUp as gi, ChevronDown as pn, History as bi, LoaderCircle as yi, Pin as ba, LogOut as vi, FileText as ya, Columns2 as va, Languages as wa, Radio as wi, ArrowDownToLine as Si, CheckCircle2 as Ii, ImagePlus as Ti, MessageCircle as Sa, Scan as Ei, GitCompareArrows as ki, Highlighter as Ri, Eraser as Pi, Undo2 as Mi, Trash2 as xi, BookText as Ni, ChevronRight as Ia, Minus as Ta, Plus as Ea, ArrowLeft as _i, CircleHelp as Ai, Download as Li, Bookmark as Ci, Star as ka, Contrast as Di, Search as Ra, PinOff as $i } from "lucide-react";
import { Button as Q, Textarea as Oi, IconButton as lt, Input as dr } from "@retainpdf/ui";
import { createPortal as zi } from "react-dom";
import { pdfjs as Pa, Page as Fi, Document as Bi } from "react-pdf";
import { e as ji, m as Hi, a as Ui } from "./markdown-math-XkF5urpn.js";
const Wi = (...e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ki = "", Vi = Object.freeze({
  progress: "retainpdf-reader-progress"
}), qi = (e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, _b = (...e) => {
  var n;
  return (((n = De()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Ab = () => {
  var e, t;
  return ((t = (e = De()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ve = () => At("defaultReaderDataPort"), Vr = () => At("defaultReaderPageConfigPort"), Lb = {
  get apiPrefix() {
    return Ve().apiPrefix;
  },
  fetchProtected: (...e) => Ve().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ve().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ve().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ve().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ve().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ve().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ve().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ve().liveTranslation;
  }
}, Ma = {
  messageTargetOrigin: () => Vr().messageTargetOrigin(),
  readerJobId: () => Vr().readerJobId()
}, Ji = () => {
  var e;
  return ((e = De()) == null ? void 0 : e.liveTranslation) ?? null;
}, qt = () => {
  var t;
  const e = De();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ye = () => {
  const e = De();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => At("fetchDocumentByJobId")(...n),
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
}, Gi = (...e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Xi = () => {
  var e, t;
  return ((t = (e = De()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Yi = (...e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Zi = (...e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ei(...e);
}, Qi = (...e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ti(...e);
}, ec = (...e) => At("downloadProtectedResource")(...e), tc = (...e) => At("failDownloadToast")(...e), Cb = (e, t) => At("resolveMarkdownAssetUrl")(e, t), qr = "/api/v1";
function nc() {
  const e = () => {
    var r;
    return oi(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = _(e);
  return O(() => {
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
function rc() {
  const e = nc(), t = W(() => Yi(Ma), [e]), n = W(() => Xi(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function oc(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = _({
    documentId: "",
    jobId: ""
  }), [u, f] = _({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, y] = _({
    jobId: "",
    documentId: ""
  }), I = h.jobId === g ? h.documentId : "", S = t || I, b = !!t && !g, [w, v] = _(null), P = (w == null ? void 0 : w.sessionIdentity) === r && w.documentId === S ? w : null, M = b || !!P, k = L((N) => {
    const E = `${N.documentId || ""}`.trim();
    if (!E || a.current && a.current !== E) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: E
      });
    else if (!a.current)
      return;
    const T = `${N.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: E,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  O(() => {
    v((N) => N && N.sessionIdentity !== r ? null : N);
  }, [r]);
  const $ = L((N) => {
    switch (N.type) {
      case "resolved-document-job":
        l({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "resolved-job-document":
        y((E) => E.jobId === N.jobId && E.documentId === N.documentId ? E : { jobId: N.jobId, documentId: N.documentId });
        break;
      case "committed-source":
        v({
          documentId: N.documentId,
          revision: N.revision,
          sessionIdentity: N.sessionIdentity
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
    jobDocumentId: I,
    documentId: S,
    sourceOnly: b,
    committedDocumentSource: w,
    setCommittedDocumentSource: v,
    activeCommittedDocumentSource: P,
    sourceViewOnly: M,
    refreshCommittedDocument: k,
    applyIdentityEvent: $
  };
}
function Jr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function ac(e) {
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
function Gr(e, t) {
  return qi(Bn(e, t));
}
function sc(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function ic(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !sc(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Hn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Vi.progress,
        stage: n,
        percent: e,
        text: t
      },
      Ma.messageTargetOrigin()
    );
  } catch {
  }
}
function gn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Hn({ percent: t, text: n, stage: r });
}
function cc(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = _(null), [l, u] = _(null), [f, d] = _(""), [m, g] = _(0), h = f === n ? i : null, y = f === n ? l : null, I = Jr(h), S = Vt(I), b = L(() => {
    g(($) => $ + 1);
  }, []), w = L(($) => {
    c($.jobPayload), u($.manifestPayload), d($.sessionIdentity);
  }, []), v = L(($) => {
    c(null), u(null), d($);
  }, []), P = A(""), M = A(""), k = L(async () => {
    const $ = o.current;
    if (!$ || P.current === $) return;
    const N = Ye().loadJobPayload;
    if (typeof N != "function") return;
    const E = a.current.value;
    P.current = $;
    try {
      const T = await N($);
      if (s.current || a.current.value !== E || o.current !== $ || !T || typeof T != "object")
        return;
      const R = Jr(T);
      c(T), d(r.current), !Vt(R) && M.current === $ && (M.current = ""), R === "succeeded" && M.current !== $ && (M.current = $, g((D) => D + 1));
    } catch {
    } finally {
      P.current === $ && (P.current = "");
    }
  }, []);
  return O(() => {
    M.current = "";
  }, [n]), O(() => {
    if (!t || S || !h) return;
    const $ = window.setInterval(() => {
      document.visibilityState !== "hidden" && k();
    }, 1e3);
    return () => window.clearInterval($);
  }, [S, k, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: I,
    jobTerminal: S,
    jobRefreshRevision: m,
    refreshJobArtifacts: b,
    refreshJobStatus: k,
    publishPayload: w,
    clearPayload: v
  };
}
function Un(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function lc(e, t) {
  e(t), Un(t);
}
function uc(e) {
  const [t, n] = _(e ? "source" : "compare"), r = L((a) => {
    e && a !== "source" || (n(a), Un(a));
  }, [e]), o = L((a) => {
    lc(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), Un(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Xr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function dc(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Xr(n.active_job_id),
    activeVersionId: Xr(n.active_version_id)
  };
}
function fc(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function mc(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function hc(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const pc = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function gc(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = pc.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const bc = 48 * 1024 * 1024;
function yc(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const vc = 2, Ce = /* @__PURE__ */ new Map();
function Wn(e, t) {
  Ce.delete(e), Ce.set(e, t);
}
function Yr(e) {
  if (Ce.size < vc) return;
  const t = Ce.keys().next().value;
  t && Ce.delete(t);
}
async function wc(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function xa(e, t = qt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, I, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Ce.has(r)) {
    const b = Ce.get(r);
    return Wn(r, b), b;
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
    const w = await wc(s);
    throw w && (b.reason = w), b;
  }
  const i = Sc(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Yr(), Ce.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (I = n.signal) == null ? void 0 : I.removeEventListener) == null || S.call(I, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Ce.has(r) ? Wn(r, l) : (Yr(), Ce.set(r, l)), l;
}
function Sc(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < bc ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Ic = { file: null, loading: !1, error: "" }, Tc = { file: null, loading: !0, error: "" };
function Ec(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if (O(() => {
    if (t || !n) return;
    const s = Ce.get(n);
    if (s) {
      Wn(n, s);
      return;
    }
    const i = new AbortController();
    return xa(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ic;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Ce.get(n);
  return a ? { file: a, loading: !1, error: "" } : Tc;
}
function kc(e) {
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
async function Kn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  gn(s, r, n, "download");
  const i = await xa(t, qt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (gn(s, o, n, "download"), i);
}
async function Rc(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  gn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Kn({
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
    Kn({
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
function Pc(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Mc({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = di,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Pc(o.href, t, a)), !0);
}
const rn = {
  regions: null,
  metadata: null
};
function xc(e) {
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
    activeLoadAbortRef: I
  } = e, [S, b] = _(""), [w, v] = _(""), [P, M] = _(null), [k, $] = _(null), [N, E] = _(!1), [T, R] = _(""), [D, z] = _([]), [K, H] = _(!1), [J, oe] = _(() => ({
    source: null,
    translated: null
  })), [q, se] = _(
    rn
  ), [Ee, re] = _({
    loading: !0,
    percent: 4,
    text: Ke.boot,
    stage: "progress",
    failed: !1
  });
  return O(() => {
    const ue = new AbortController(), Pe = h.current.value, ie = kc({
      sessionEpochRef: h,
      closingRef: y,
      abort: ue,
      sessionEpoch: Pe
    });
    I.current = ue;
    const le = Ye();
    if (y.current)
      return ue.abort(), () => {
        I.current === ue && (I.current = null);
      };
    let B = !1;
    function U(ee, Y) {
      ie.markFailed(), H(!0), re({
        loading: !1,
        percent: 100,
        text: ee,
        stage: "failed",
        failed: !0
      }), Hn({ percent: 100, text: Y, stage: "failed" });
    }
    function X() {
      E(!0), B || H(!0), re({
        loading: !1,
        percent: 100,
        text: Ke.ready,
        stage: "ready",
        failed: !1
      }), Hn({ percent: 100, text: Ke.ready, stage: "ready" });
    }
    function de() {
      return l != null && l.documentId ? Gr(
        l.documentId,
        l.revision
      ) : Wi() ? Ki : le.resolveResourceUrl(Bn(r));
    }
    async function ne() {
      var j;
      let ee = { activeJobId: "", activeVersionId: "" };
      try {
        const V = await ((j = le.fetchDocument) == null ? void 0 : j.call(le, r));
        V && (ee = dc(V));
      } catch {
      }
      const Y = fc({
        link: ee,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (Y.kind === "follow-active-job") {
        if (ie.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: Y.jobId
        }), Y.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: Y.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (Y.kind === "open-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: Y.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const fe = de();
      if (ie.isInactive()) return;
      b(fe), v(""), R(""), d(c);
      const x = await Kn({
        url: fe,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ie,
        setBoot: re
      });
      if (!ie.isInactive()) {
        if (!x) {
          U("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        M(x), X();
      }
    }
    async function ae() {
      var ye;
      const ee = !l, Y = !!(ee && le.loadSessionSnapshot && le.loadReaderOptionalArtifacts), fe = Y ? le.loadReaderOptionalArtifacts(t) : null, x = await ((ye = le.loadSessionSnapshot) == null ? void 0 : ye.call(le, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ee && !Y
      })), j = x ? {
        jobPayload: x.sourcePayload,
        manifestPayload: x.manifestPayload,
        readerMetadata: x.readerMetadata,
        regionsPayload: x.regions,
        readerErrors: x.readerErrors
      } : await le.loadReaderPayload(t, {
        includeOptionalArtifacts: ee
      });
      if (ie.isInactive()) return;
      let V = null;
      if (n && !r)
        if (x && x.linkedDocument !== void 0)
          V = x.linkedDocument;
        else {
          try {
            V = await le.fetchDocumentByJobId(qr, t);
          } catch {
          }
          if (ie.isInactive()) return;
        }
      const me = ac(j.jobPayload) || `${(V == null ? void 0 : V.document_id) || ""}`.trim();
      me && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: me
      });
      const be = mc({
        payloadDocumentId: me,
        linkedActiveJobId: `${(V == null ? void 0 : V.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(V == null ? void 0 : V.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (be.kind === "restore-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: be.documentId,
          revision: be.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Ie = le.resolveReaderSourcePdf(j.manifestPayload), xe = le.resolveReaderTranslatedPdfUrl(j.jobPayload, j.manifestPayload), Oe = typeof Ie == "string" ? Ie : le.resolveReaderArtifactUrl(Ie), Be = r || me, Ze = l != null && l.documentId ? Gr(
        l.documentId,
        l.revision
      ) : Oe || (Be ? le.resolveResourceUrl(Bn(Be)) : ""), Le = l ? "" : xe || "";
      b(Ze || ""), v(Le), R(ic(j.jobPayload, t)), f({
        jobPayload: j.jobPayload || null,
        manifestPayload: j.manifestPayload || null,
        sessionIdentity: c
      });
      const We = () => Rc({
        sourceFinal: Ze || "",
        translatedFinal: Le,
        fence: ie,
        setBoot: re
      }), Qe = !!(Ze || Le), et = fe && Qe ? We() : null;
      et == null || et.catch(() => {
      });
      const vt = (F) => {
        ie.isInactive() || (z(l ? [] : ha(F.regionsPayload)), oe(l ? { source: null, translated: null } : si(F.readerMetadata)), se(l ? rn : F.readerErrors ?? rn), H(!0));
      };
      if (fe ? (B = !0, fe.then(vt)) : vt(j), !Qe) {
        U(Ke.failed, Ke.failed);
        return;
      }
      const tt = await (et ?? We());
      if (tt.status !== "inactive") {
        if (tt.status === "incomplete") {
          U("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        M(tt.sourceBytes), $(tt.translatedBytes), X();
      }
    }
    async function Se() {
      E(!1), M(null), $(null), z([]), H(!1), oe({ source: null, translated: null }), se(rn), gn(re, 8, Ke.metadata, "metadata");
      try {
        if (s) {
          await ne();
          return;
        }
        if (!t) {
          U(Ke.failed, Ke.failed);
          return;
        }
        await ae();
      } catch (ee) {
        if (ie.isClosedOrStale() || (ee == null ? void 0 : ee.name) === "AbortError") return;
        ie.markFailed();
        const Y = Number(ee == null ? void 0 : ee.status), fe = `${(ee == null ? void 0 : ee.reason) || ""}`, x = gc({ status: Y, reason: fe, sessionJobId: t });
        if (x && (await Mc({
          apiPrefix: qr,
          documentId: x,
          expiredJobId: t
        }) || ie.isClosedOrStale()))
          return;
        if (hc({
          status: Y,
          reason: fe,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const j = ee instanceof Error ? ee.message : Ke.failed;
        U(j, j);
      }
    }
    return Se(), () => {
      ue.abort(), I.current === ue && (I.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: w,
    sourceFile: P,
    translatedFile: k,
    assetsReady: N,
    title: T,
    regions: D,
    regionsSettled: K,
    readerMetadata: J,
    readerErrors: q,
    boot: Ee
  };
}
function Nc() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = rc(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), c = A(""), l = A(""), u = A(() => {
  }), f = L(() => u.current(), []), d = oc({
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
  } = d, { mode: I, setMode: S, switchSessionMode: b } = uc(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const w = cc({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: v,
    scopedManifestPayload: P,
    jobStatus: M,
    jobTerminal: k,
    jobRefreshRevision: $,
    refreshJobArtifacts: N,
    refreshJobStatus: E
  } = w, T = xc({
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
    publishPayload: w.publishPayload,
    clearPayload: w.clearPayload,
    switchSessionMode: b,
    jobRefreshRevision: $,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), R = L(() => {
    var z;
    e.current = !0, (z = t.current) == null || z.abort();
  }, []), D = W(
    () => ({
      fetchProtected: Ye().fetchProtected,
      jobId: m,
      jobPayload: v,
      manifestPayload: P,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: y
    }),
    [m, v, P, T.sourceUrl, T.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: M,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: k,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: I,
    setMode: S,
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
    download: D,
    refreshJobArtifacts: N,
    refreshJobStatus: E,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: R
  };
}
const _c = 160, Ac = 8, Lc = 0;
function Cc() {
  const e = A(null), [t, n] = _(null), [r, o] = _(Lc), a = L((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < _c || o((u) => Math.abs(u - l) < Ac ? u : l);
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
function Dc(e) {
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
const xn = { source: 0, translated: 0 };
function $c(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = A(l);
  u.current = l;
  const [f, d] = _(() => ({
    identity: l,
    pages: xn
  })), [m, g] = _(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : xn, y = m.identity === l ? m.tick : 0, I = Dc({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = I, b = L((E, T) => {
    u.current === l && d((R) => {
      const D = R.identity === l ? R.pages : xn;
      return D[T] === E && R.identity === l ? R : {
        identity: l,
        pages: { ...D, [T]: E }
      };
    });
  }, [l]), w = A(null), v = L(() => {
    w.current && clearTimeout(w.current);
    const E = l;
    w.current = setTimeout(() => {
      w.current = null, u.current === E && g((T) => ({
        identity: E,
        tick: T.identity === E ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  O(() => (w.current && (clearTimeout(w.current), w.current = null), d((E) => E.identity === l && E.pages.source === 0 && E.pages.translated === 0 ? E : { identity: l, pages: { source: 0, translated: 0 } }), g((E) => E.identity === l && E.tick === 0 ? E : { identity: l, tick: 0 }), () => {
    w.current && (clearTimeout(w.current), w.current = null);
  }), [l]);
  const P = W(
    () => Math.max(h.source, h.translated),
    [h]
  ), M = S === "translated" ? h.translated : h.source || h.translated, k = t == null ? void 0 : t.userZoom, $ = t == null ? void 0 : t.shellWidth, N = `${l}-${y}-${k}-${n}-${h.source}-${h.translated}-${$}`;
  return {
    ...I,
    numPagesByPane: h,
    hudNumPages: P,
    primaryNumPages: M,
    metricsTick: y,
    onNumPages: b,
    onMetrics: v,
    rowSyncRevision: N
  };
}
const Te = "data-reader-page", we = "data-reader-pane", fr = "data-natural-height", Na = "reader-react-root", _a = "reader-react-grid", Aa = "reader-react-scroll-shell", en = "reader-react-pdf-pane", La = "reader-react-pdf-page", bn = "reader-react-pdf-page-placeholder", mr = "reader-react-pdf-page-slot";
function yn(e, t) {
  const n = e != null ? `[${Te}="${e}"]` : `[${Te}]`;
  return t ? `${n}[${we}="${t}"]` : n;
}
function hr() {
  return `.${mr}[${Te}]`;
}
function vn(e) {
  return Number(e.getAttribute(Te));
}
const Ca = 0.25, wn = 1, Oc = 0.05, tn = 0.5, zc = 16, Fc = 8, Da = zc + Fc, Bc = 720;
function kt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function $a(e) {
  return Number.isFinite(e) && e < Bc;
}
function Tt(e, t = Number.POSITIVE_INFINITY) {
  return $a(t) && (e === "source" || e === "translated") ? wn : tn;
}
function Ge(e) {
  return Number.isFinite(e) ? Math.min(wn, Math.max(Ca, e)) : tn;
}
function Jt(e, t) {
  const n = Ge(Number(e) + t * Oc);
  return Math.round(n * 100) / 100;
}
function jc(e) {
  return Math.round(Ge(e) * 100);
}
function Oa(e) {
  const n = (Number(e) || 0) - Da;
  return Math.max(160, Math.floor(n));
}
function Hc(e, t = tn) {
  const n = Ge(t);
  return Oa((Number(e) || 0) * n);
}
function Uc(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${we}]`)
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
const Wc = 8;
function Kc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Wc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const za = 200, Vc = [
  "markdown"
], qc = Vc;
function Fa(e) {
  return qc.includes(e);
}
const Jc = "retainpdf:reader:view:v1:", Zr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Gc = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Ba() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Vn(e) {
  return `${e || ""}`.trim();
}
function Xc({
  documentId: e,
  jobId: t
}) {
  const n = Vn(e);
  if (n) return `document:${n}`;
  const r = Vn(t);
  return r ? `job:${r}` : "";
}
function ja(e) {
  const t = Vn(e);
  return t ? `${Jc}${t}` : "";
}
function Yc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Zc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Zr.has(t) || !Zr.has(n) || t === n))
    return { left: t, right: n };
}
function Qc(e) {
  return e === null ? null : Fa(e) ? e : void 0;
}
function el(e) {
  return Gc.has(e) ? e : void 0;
}
function Ha(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Yc(t.anchor), r = Number(t.zoom), o = el(t.mode), a = Zc(t.splitLayout), s = Qc(t.assistantPanel);
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
function Ue(e, t = Ba()) {
  const n = ja(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Ha(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function kn(e, t, n = Ba()) {
  const r = ja(e);
  if (!r || !n) return null;
  const o = Ue(e, n), a = Ha({
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
function tl(e, t, n = "") {
  var d;
  const [r, o] = _(() => {
    var m;
    return ((m = Ue(n)) == null ? void 0 : m.zoom) ?? Tt(e, kt());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), c = A(((d = Ue(n)) == null ? void 0 : d.zoom) !== void 0);
  O(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Ue(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? Tt(e, kt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), O(() => {
    if (c.current) return;
    const m = Tt(e, kt()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = L((m, g) => {
    const h = Ge(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, kn(s.current, { zoom: h }), o(h));
  }, []), u = L((m) => {
    l(Jt(a.current, m));
  }, [l]), f = L((m) => {
    l(Tt(m));
  }, [l]);
  return Ae(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Uc(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const nl = 160, rl = 3e-3, Qr = 50, ol = 16, al = 800;
function sl(e, t = 0) {
  const n = t === 1 ? ol : t === 2 ? al : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Qr, Math.min(Qr, r));
  return Math.exp(-o * rl);
}
function il(e, t, n = 0) {
  return Ge(e * sl(t, n));
}
function cl(e) {
  return Math.round(Ge(e) * 100) / 100;
}
function ll(e, t, n) {
  const r = Ge(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ge(t) / r;
  const a = (o + Da) / r;
  return Oa(a * Ge(t)) / o;
}
function ul(e) {
  return Array.from(e.querySelectorAll(hr()));
}
function dl(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function fl(e, t, n) {
  let r = null;
  for (const s of ul(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = dl(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Te) || "",
    pane: o.getAttribute(we) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function ml(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Ua(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${hr()}[${Te}="${t.page}"][${we}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (ml(n, e).scrollLeft += a);
}
function hl(e, t, n, r) {
  const o = e.querySelector(`.${_a}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function Ct(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const pl = 600, gl = 1e3;
function bl(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Ua(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), gl);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function yl(e, t, n) {
  const r = A(t);
  r.current = t;
  const o = A(n);
  o.current = n;
  const a = A(null), s = A(null), i = A(null);
  O(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = cl(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Ct(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Ct(d.grid));
      }, pl), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, Ct(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: fl(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = il(f.target, u.deltaY, u.deltaMode);
      const d = ll(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = hl(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, nl);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Ct((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Ae(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Ct(c.grid), !(!e || !c.anchor) && (Ua(e, c.anchor), (l = i.current) == null || l.call(i), i.current = bl(e, c.anchor)));
  }, [t, e]);
}
function vl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: L((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const pr = 56;
function Wa(e, t = pr) {
  return e.getBoundingClientRect().top + t;
}
function Ka(e, t) {
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
  const o = vn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Ut(e, t, n = pr) {
  if (!e)
    return null;
  const r = yn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Wa(e, n), i = Ka(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Nt(e, t, n = "auto", r, o = pr) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(yn(a, r))), i || (i = e.querySelector(yn(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function wl(e, t, n = "smooth", r) {
  return Nt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function qn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var u;
    if (a) return;
    Nt(
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
function Sl(e, t, n) {
  return qn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Sn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function ze(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Il(e, t, n = !0, r = "", o) {
  const [a, s] = _(1);
  return O(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, u = 0;
    const f = yn(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = Wa(i), I = Ka(h, y);
      I && s(I.page);
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
const Tl = `canvas, .react-pdf__Page, .${La}, .${bn}`, eo = /* @__PURE__ */ new WeakMap();
function El(e) {
  const t = Number(e.getAttribute(fr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = eo.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Tl), eo.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function kl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Rl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(hr()).forEach((r) => {
    const o = vn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = El(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Pl(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Ae(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, f = !1;
    const d = () => {
      var v;
      if (c) return;
      const b = e.current;
      if (!b) return;
      const w = Rl(b);
      kl(s.current, w) || (s.current = w, a(w)), u && !f && (f = !0, (v = i.current) == null || v.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), y = window.setTimeout(m, 700), I = e.current;
    let S = null;
    return I && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => m()), S.observe(I)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Ml = [0, 48, 140, 320, 560], xl = 700, Nl = [80, 200, 400], _l = 500, Al = 50, Ll = /* @__PURE__ */ new Set([
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
]), Cl = 180, to = [0, 48, 140, 320, 700, 1200];
function Dl(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((T = Ue(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = A(null), l = A(!1), u = A(r), f = A(null), d = A(null), m = A(null), g = A(null), h = A(a), y = A(""), I = A(n);
  I.current = n;
  const S = L(() => {
    var R;
    (R = f.current) == null || R.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = L(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), w = L((R = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const D = () => {
      g.current = null, kn(h.current, {
        anchor: ze(i.current)
      });
    };
    R ? D() : g.current = setTimeout(D, Cl);
  }, []), v = L((R) => {
    i.current = ze(R), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Al);
  }, []);
  O(() => {
    if (!o)
      return;
    let R = !1, D = null, z = null, K = null;
    const H = () => {
      if (R) return;
      const J = e.current;
      if (!J) {
        K = setTimeout(H, 50);
        return;
      }
      D = J, z = () => {
        if (l.current)
          return;
        const oe = Ut(D, I.current);
        oe && (i.current = oe, w());
      }, D.addEventListener("scroll", z, { passive: !0 }), l.current || z();
    };
    return H(), () => {
      R = !0, K != null && clearTimeout(K), D && z && D.removeEventListener("scroll", z);
    };
  }, [o, r, n, e, w]), O(() => {
    if (!o) return;
    const R = e.current;
    if (!R) return;
    const D = (z) => {
      z.metaKey || z.ctrlKey || z.altKey || Ll.has(z.key) && b();
    };
    return R.addEventListener("wheel", b, { passive: !0 }), R.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", D), () => {
      R.removeEventListener("wheel", b), R.removeEventListener("touchmove", b), window.removeEventListener("keydown", D);
    };
  }, [o, e, b]), Ae(() => {
    var D;
    if (h.current === a) return;
    w(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const R = (D = Ue(a)) == null ? void 0 : D.anchor;
    i.current = R ? ze(R) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, w, S]), O(() => {
    var D;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const R = ze(
      ((D = Ue(a)) == null ? void 0 : D.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = R, c.current = R, l.current = !0, S(), f.current = qn(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: I.current,
        delaysMs: to,
        onDone: () => v(R)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(R);
    }, Math.max(...to) + 160), () => S();
  }, [o, s, a, e, v, S]), O(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const R = c.current ? ze(c.current) : ze(i.current);
    return l.current = !0, c.current = R, i.current = R, S(), f.current = qn(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ml,
        onDone: () => v(R)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(R);
    }, xl), () => {
      S();
    };
  }, [r, o, n, e, v, S]), O(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), w(!0);
  }, [S, w]);
  const P = L(() => {
    const R = Ut(
      e.current,
      I.current
    );
    return ze(R || i.current);
  }, [e]), M = L(() => {
    l.current = !0;
    const R = Ut(
      e.current,
      I.current
    ), D = ze(R ?? i.current);
    return i.current = D, c.current = D, w(), D;
  }, [e, w]), k = L((R, D, z) => {
    const K = z || I.current, H = Sn(R, D || 1), J = { page: H, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, w(), S(), wl(e.current, H, "smooth", K), f.current = Sl(
      () => e.current,
      H,
      {
        behavior: "auto",
        pane: K,
        delaysMs: Nl,
        onDone: () => v(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(J);
    }, _l);
  }, [e, v, S, w]), $ = L(() => ze(i.current), []), N = L(() => l.current, []), E = L(() => {
    if (!l.current || !c.current)
      return;
    const R = ze(c.current);
    Nt(
      e.current,
      R,
      "auto",
      I.current
    );
  }, [e]);
  return {
    lockFromShell: P,
    beginModeSwitch: M,
    goToPage: k,
    getAnchor: $,
    isRestoring: N,
    repinIfRestoring: E
  };
}
function $l(e, t) {
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
function Va(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Ol = [0, 80, 200, 400, 800], zl = 120, Fl = 400;
function Bl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = A(a);
  f.current = a;
  const d = A(s);
  d.current = s;
  const m = A(i);
  m.current = i;
  const g = A(n);
  g.current = n, O(() => {
    var w, v;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Gi(), y = $l(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const I = Va(h, y, { jobId: c, documentId: l });
    if (t.current === I)
      return;
    if (y == null) {
      t.current = I, (w = g.current) == null || w.call(g);
      return;
    }
    t.current = I, h && ((v = m.current) == null || v.call(m, h, y));
    const S = [];
    let b = 0;
    for (const P of Ol)
      b = Math.max(b, P), S.push(
        setTimeout(() => {
          f.current(y);
        }, P)
      );
    return S.push(
      setTimeout(() => {
        var P;
        (P = g.current) == null || P.call(g);
      }, b + zl)
    ), () => {
      for (const P of S) clearTimeout(P);
    };
  }, [r, o, c, l, t, u]);
}
function jl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Hl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Fl,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = A(a);
  u.current = a;
  const f = A(l);
  f.current = l;
  const d = A(0);
  O(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var I;
      const g = ((I = globalThis.location) == null ? void 0 : I.search) || "", h = ai(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Va(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || jl)(h);
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
function Ul(e) {
  const t = A(""), [n, r] = _(!1), o = L(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Bl(a, t, o), Hl(e, t, n);
}
const Dt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Wl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function no(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function qa(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = no(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = no(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Kl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = qa(r, t, n);
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
function Vl(e) {
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
function ql(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function Jl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function Gl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Xl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const ro = [250, 500, 1e3, 2e3, 4e3], Nn = [80, 160, 320, 640, 1e3, 1500], oo = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Jn(e, t) {
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
function gr(e) {
  return fi(e) ? `${e.code || ""}`.trim() : "";
}
function on(e, t) {
  const n = gr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Yl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (qa(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = mi(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = gr(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Nn[Math.min(s, Nn.length - 1)];
    if (await Jn(i, r), s >= Nn.length + 2) throw a;
  }
}
function Zl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _(Dt), s = A(o), i = A("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Vt(l) ? l : "";
  return O(() => {
    if (!n || !c) {
      i.current = "", s.current = Dt, a(Dt);
      return;
    }
    const f = r === void 0 ? Ji() : r, d = i.current === c;
    if (i.current = c, !f) {
      const b = {
        ...d ? s.current : Dt,
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
      ...d ? s.current : Dt,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const y = (b) => {
      m.signal.aborted || a((w) => {
        const v = b(w);
        return s.current = v, v;
      });
    }, I = async () => {
      let b = 0;
      for (; !m.signal.aborted; )
        try {
          const w = await f.fetchLayout(c, { signal: m.signal });
          g = !0, y((v) => ({
            ...v,
            layoutByPage: Wl(w),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (w) {
          if ((w == null ? void 0 : w.name) === "AbortError") return;
          const v = gr(w);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            y((M) => ({
              ...M,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: on(w, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((M) => ({
              ...M,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((M) => ({
            ...M,
            connection: "connecting",
            jobStatus: l,
            error: on(w, "正在等待 OCR 版面数据")
          })), await Jn(ro[Math.min(b, ro.length - 1)], m.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await I(), !g || m.signal.aborted) return;
      let b = 0;
      for (; !m.signal.aborted; ) {
        u || y((w) => ({
          ...w,
          connection: w.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: w.error
        }));
        try {
          await f.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (w) => {
              if (w.seq <= s.current.lastSeq) return;
              let v;
              try {
                v = await Yl(
                  c,
                  w,
                  s.current,
                  m.signal,
                  f
                );
              } catch (P) {
                if ((P == null ? void 0 : P.name) === "AbortError" || m.signal.aborted) throw P;
                y((M) => ({
                  ...M,
                  lastSeq: Math.max(M.lastSeq, w.seq),
                  error: on(P, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((P) => {
                const M = Kl(P, w, v);
                return u ? {
                  ...M,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...M,
                  jobStatus: l
                };
              }), b = 0;
            }
          });
        } catch (w) {
          if ((w == null ? void 0 : w.name) === "AbortError" || m.signal.aborted) return;
          y((v) => ({
            ...v,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: on(w, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          y((w) => ({
            ...w,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Jn(oo[Math.min(b, oo.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function Ql(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function eu(e, t = !0) {
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ye().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Ql(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const tu = 4500;
function nu(e) {
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
const ru = /* @__PURE__ */ new Set(["book", "translate"]);
function Ja(e) {
  return !!(e.jobId && e.sourceUrl && ru.has(e.workflow));
}
function ou(e) {
  return !!(Ja(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function au() {
  const e = Nc(), t = Ja({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = ou({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Vt(o) && (r.current.running = !0);
  const a = Zl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = Cc(), u = eu(e.jobId, !e.sourceOnly), f = Xc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = tl(e.mode, s, f);
  yl(i, m, g);
  const h = $c(
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
    goToPage: I,
    repinIfRestoring: S
  } = Dl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  O(() => {
    S();
  }, [c, S]);
  const b = Pl(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), w = Il(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), v = L((H, J) => {
    var q, se;
    const oe = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((q = h.numPagesByPane) == null ? void 0 : q.source) || 0,
      Number((se = h.numPagesByPane) == null ? void 0 : se.translated) || 0
    );
    I(H, oe, J);
  }, [I, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [P, M] = _(null), k = A(null), $ = L((H) => {
    k.current && clearTimeout(k.current), M(H), H && (k.current = setTimeout(() => M(null), tu));
  }, []);
  O(() => () => {
    k.current && clearTimeout(k.current);
  }, []);
  const N = L((H) => {
    const J = Mn(e.regions, H);
    return J ? Kr(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), E = L((H, J) => {
    const oe = J || h.primaryPane, q = typeof H == "object" && H ? `${H.block_id || ""}`.trim() : "", se = typeof H == "object" && H ? `${H.image_url || ""}`.trim() : "", Ee = typeof H == "object" && H ? H.page_idx != null ? Number(H.page_idx) + 1 : H.page != null ? Number(H.page) : null : typeof H == "number" ? H + 1 : null, re = ii(e.regions, se, Ee) || Mn(e.regions, q) || (typeof H == "object" ? ci(e.regions, H) : null);
    let ue = re ? Kr(re, oe).page : null;
    ue == null && (ue = nu(H)), !(ue == null || ue < 1) && ($(re), v(ue, oe));
  }, [$, v, h.primaryPane, e.regions]);
  Ul({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: w,
    goToPage: v,
    resolveBlockPage: N,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (H) => {
      $(Mn(e.regions, H.blockId));
    }
  });
  const { setModeKeepingPage: T } = vl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  O(() => {
    $(null);
  }, [d, $]);
  const R = !e.boot.loading && !e.boot.failed, D = W(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), z = W(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), K = W(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: D,
    panes: h,
    sessionFiles: z,
    rowHeights: b,
    goToPage: v,
    activeRegion: P,
    jumpToAnchor: E,
    setModeKeepingPage: T,
    download: e.download,
    showHud: R,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, D, h, z, b, v, P, E, T, R, m, g, f, a, n, u]);
  return W(() => ({
    ...K,
    currentPage: w
  }), [K, w]);
}
const su = [
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
], iu = [
  {
    title: "翻页",
    items: [
      { actions: ["next-page"], keys: "J · ↓ · PgDn", desc: "下一页" },
      { actions: ["prev-page"], keys: "K · ↑ · PgUp", desc: "上一页" },
      { actions: ["first-page", "last-page"], keys: "Home / End", desc: "首页 / 末页" },
      { actions: [], keys: "点底下的页码", desc: "输入页码跳转" }
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
      { actions: [], keys: "N / Shift+N", desc: "跳到下一处 / 上一处要看一眼的段落（左栏「待改」）" }
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
function cu(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of su)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function lu(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const uu = ".reader-notes-panel";
function du(e) {
  return e instanceof Element ? !!e.closest(uu) : !1;
}
function fu(e) {
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
  O(() => {
    if (!u)
      return;
    const f = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || lu(d.target) || du(d.target))
        return;
      const m = d.key, g = cu(m);
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
              a(Jt(o, 1));
              return;
            case "zoom-out":
              a(Jt(o, -1));
              return;
            case "zoom-reset":
              a(Tt(t, kt()));
              return;
            case "next-page":
              c(Sn(s + 1, i));
              return;
            case "prev-page":
              c(Sn(s - 1, i));
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
const Re = { size: 16, strokeWidth: 1.75 }, ao = { size: 12, strokeWidth: 1.75 }, mu = "retainpdf:soft-reader-close";
function hu() {
  return new URL("./index.html", window.location.href).href;
}
function pu() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: mu },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function gu(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function bu() {
  if (!(typeof window > "u") && !pu()) {
    if (gu(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(hu());
  }
}
function yu({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function vu({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ C(yu, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), bu();
  }, children: [
    /* @__PURE__ */ p(pa, { className: "reader-close-home-icon", ...Re, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const wu = 3e3, Su = 8;
async function Iu(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Tu(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Eu(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = wu;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Tu(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < Su && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Iu(e, i);
  })), a;
}
function Ga(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function ku(e, t) {
  let n = null;
  for (const r of Ga(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let so = !1;
function Ru() {
  if (so)
    return;
  const e = qt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Pa.GlobalWorkerOptions.workerSrc = e, so = !0);
}
const at = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Pu = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Mu = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, xu = {
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
}, io = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Nu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => io(o ?? a ?? "", Pu)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => io(o ?? a ?? "", Mu)).replace(/\\([a-zA-Z]+)/gu, (r, o) => xu[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function _u(e) {
  return at(e.translatedBlockText) || at(e.translated.text) || at(e.source.text);
}
const Au = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Lu(e) {
  const t = [];
  for (const n of e) {
    if (!Au(n)) continue;
    const r = Nu(_u(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const Cu = 24, Du = 60;
function co(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Cu), o = Math.min(e.length, n + t.length + Du), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function $u(e, t, n = 200) {
  const r = at(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = at(a.translatedBlockText) || at(a.translated.text), c = i ? co(i, r) : null, l = c ?? co(at(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function an(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Ft(e, t) {
  const n = at(t).toLowerCase();
  if (!n || !e) return an(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${an(e.slice(a, s))}<mark class="reader-find-mark">${an(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + an(e.slice(a));
}
function Ou(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const zu = /^data-[a-z0-9-]+$/;
function lo(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function Fu(e, t, n = "") {
  if (!t.length) return Ft(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Ft(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => zu.test(c)).map(([c, l]) => ` ${c}="${lo(l)}"`).join("");
    o += `<mark class="${lo(s.className)}"${i}>${Ft(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Ft(e.slice(a), n);
}
function ve(e) {
  return typeof e == "string" ? e : "";
}
function Bu(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function ju(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Hu(e) {
  return {
    source: ve(e == null ? void 0 : e.source_text) || ve(e == null ? void 0 : e.unit_source_text),
    translated: ve(e == null ? void 0 : e.protected_translated_text) || ve(e == null ? void 0 : e.translated_text)
  };
}
const Uu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Xa(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Wu(e) {
  const t = Xa(e).sort((r, o) => ve(r.ts).localeCompare(ve(o.ts)));
  return t.length ? [
    { text: ve(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ve(r.new_text),
      label: Uu[ve(r.source)] || ve(r.source) || "修订",
      ts: ve(r.ts),
      reason: ve(r.reason)
    }))
  ].reverse() : [];
}
function Ku(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Vu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ve(r.finished_at) || ve(n.finished_at) || "";
}
function qu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Xa(e).sort((a, s) => ve(a.ts).localeCompare(ve(s.ts)));
  for (const a of o) {
    const s = new Date(ve(a.ts)).getTime(), i = ve(a.reader_item_id) || ve(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ve(a.new_text));
  }
  return n;
}
const Ju = {
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
function Gu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = Ju[ve(n.kind)] || ve(n.kind) || "问题", o = ve(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Xu = /* @__PURE__ */ new Set(["text", "formula"]);
function br(e) {
  return Xu.has(e);
}
function Ya(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || br($e(n));
}
function Yu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !br($e(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Zu = 300, Qu = 72;
function ed(e, t) {
  if (e.width >= Zu && e.height >= Qu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const td = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function nd(e, t, n) {
  return e.flatMap((r) => {
    if (!td.has($e(r.region))) return [];
    const o = pt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function uo(e, t, n) {
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
async function rd(e) {
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
const od = "reader-text-hover-copy", ad = "reader-text-hover-edit", sd = "reader-text-hover-zoom", id = "reader-text-hover-id";
function cd(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Za = "reader-text-hover-tools";
function sn({
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
const ld = 26, ud = 220;
function dd(e, t = ud) {
  return e.height < ld * 2 || e.width < t;
}
function fd({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? ur : e === "failed" ? gt : ga, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function md({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = _("idle"), [u, f] = _("idle"), [d] = _(() => cd()), m = A([]), g = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    l("idle"), f("idle");
    const v = m.current;
    return () => {
      v.forEach((P) => window.clearTimeout(P)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = li(e.highlight.region, t), y = $e(e.highlight.region), I = (v, P) => async (M) => {
    M.preventDefault(), M.stopPropagation();
    const k = await rd(v);
    P(k ? "copied" : "failed"), m.current.push(window.setTimeout(() => P("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, w = s || (dd(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ C(
        "div",
        {
          className: Za,
          "data-placement": w,
          style: w === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              sn,
              {
                className: id,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: I(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && br(y) ? /* @__PURE__ */ p(
              sn,
              {
                className: ad,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(hn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              sn,
              {
                className: od,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: I(h, l),
                children: /* @__PURE__ */ p(fd, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              sn,
              {
                className: sd,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(pi, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function hd(e, t) {
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
function pd(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = pt(
      hd(e, a),
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
const gd = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', bd = 256, $t = /* @__PURE__ */ new Map();
function yd(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Qa(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ji(t, { bareLatex: !0 }), o = yd(n), a = Hi(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = $t.get(t);
  if (!s && (s = Ui(o, r), $t.set(t, s), $t.size > bd)) {
    const i = $t.keys().next().value;
    i !== void 0 && $t.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function _n(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function qe(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function vd(e, t) {
  const n = e.typography, r = qe(t) || 1, o = qe(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = _n(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = qe(n == null ? void 0 : n.fit_min_font_size_pt), u = qe(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = qe(n == null ? void 0 : n.leading_em), h = [
    qe(n == null ? void 0 : n.padding_top_pt) || 0,
    qe(n == null ? void 0 : n.padding_right_pt) || 0,
    qe(n == null ? void 0 : n.padding_bottom_pt) || 0,
    qe(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || gd,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (_n(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : _n(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function wd(e, t, n, r) {
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
const Sd = 512, Ot = /* @__PURE__ */ new Map();
let Gn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Gn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Gn += 1;
}));
function Id(e, t, n, r) {
  return [
    Gn,
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
function es({ item: e, pageScale: t }) {
  const n = A(null), r = W(
    () => Qa(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = W(
    () => vd(e, t),
    [e, t]
  );
  O(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Ae(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), I = Math.max(1, e.rect.height - d - g), S = Id(o, y, I, s);
    let b = Ot.get(S);
    if (b === void 0 && (b = wd(
      (w) => (f.style.fontSize = `${w}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      I,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ot.set(S, b), Ot.size > Sd)) {
      const w = Ot.keys().next().value;
      w !== void 0 && Ot.delete(w);
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
function Td({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = W(
    () => pd(e, t, n, r),
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
        es,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Ed = Zt(Td);
function kd({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ C("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        es,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: $e(a.highlight.region),
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
const Rd = Zt(kd), ts = 24, rt = ts * 2 + 4, Je = 24, Pd = 4, Md = 6, dt = (e) => e.left + e.width, it = (e) => e.top + e.height;
function Bt(e, t) {
  const n = Math.min(dt(e), dt(t)) - Math.max(e.left, t.left), r = Math.min(it(e), it(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const fo = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= dt(t) && r >= t.top && r <= it(t);
}, xd = (e) => e.height > 40 && e.height > e.width * 2.5;
function Nd(e, t, n) {
  if (!t.length || e.height < Je || e.width < n + 8) return null;
  const r = Math.max(...t.map(it)), o = dt(e) - 4 - n;
  for (const a of [r, it(e) - 2]) {
    const s = Math.max(e.top, a - Je), i = { left: o, top: s, width: n, height: Je };
    if (!t.some((c) => Bt(i, c) > 0)) return s - e.top;
  }
  return null;
}
function _d(e, t) {
  const n = [], r = (a) => {
    const s = ts + Pd, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: dt(e), top: i, width: s, height: rt } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: rt } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Je - 3, width: rt, height: Je + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: it(e), width: rt, height: Je + 3 } }), r(!0);
  const o = Nd(e, t, rt);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: dt(e) - 4 - rt, top: e.top + o, width: rt, height: Je } }), n;
}
function Ad(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !xd(S)), i = s.filter((S) => fo(S, t)), c = s.filter((S) => !fo(S, t)), l = n.filter((S) => S !== t && Bt(S, t) < t.width * t.height * 0.5), u = _d(t, i).filter(({ box: S, overhang: b }) => {
    const w = b ? Md : 0;
    return S.left >= -w && dt(S) <= r + w && S.top >= 0 && it(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !c.some((b) => Bt(S, b) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((b) => Bt(S.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let y = null, I = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((w, v) => w + Bt(S.box, v), 0);
    b < I && (y = S, I = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function Ld(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Je - 3 : it(r);
  return t >= r.left - 4 && t <= r.left + rt + 4 && n >= a && n <= a + Je + 3;
}
const An = (e) => e.left + e.width, Ln = (e) => e.top + e.height;
function Cd(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > An(e) || f < e.top || f > Ln(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, An(l)), i = Math.max(i, Ln(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(An(e) + r, s + n) - c.left, c.height = Math.min(Ln(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function Dd(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function $d(e, t, n, r) {
  const [o, a] = _(null);
  return Ae(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Dd(s) : [], c = $e(t.highlight.region) === "figure", l = i.length && !c ? Cd(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Ad({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function Od({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = _(null), [i, c] = _(!1), [l, u] = _([]), [f, d] = _(""), [m, g] = _(""), [h, y] = _(!1), [I, S] = _(null), [b, w] = _([]), v = r.drafts, P = r.generation, M = L(async (E, T) => {
    if (e)
      try {
        u(Wu(await e.fetchRevisions(E, T)));
      } catch {
        u([]);
      }
  }, [e]);
  O(() => {
    if (s(null), u([]), S(null), w([]), g(""), !e || !t || !n) return;
    let E = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (E) return;
      const R = T == null ? void 0 : T.item;
      if (!R) throw new Error("找不到这一段的译文。");
      const D = `${(T == null ? void 0 : T.item_id) || n}`, { source: z, translated: K } = Hu(R);
      s({ readerItemId: n, itemId: D, source: z, current: K }), d(v.get(n) ?? K);
    }).catch((T) => {
      E || S({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      E || c(!1);
    }), M(t, n), () => {
      E = !0;
    };
  }, [e, t, n, M]);
  const k = L((E) => {
    d(E), n && v.set(n, E);
  }, [n, v]), $ = L(async (E, T) => {
    if (!e || !a || h) return !1;
    const R = E ?? f;
    if (!R.trim()) return !1;
    y(!0), S(null), w([]);
    try {
      const D = await e.revise(t, a.itemId, {
        translated_text: R,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ...P.current != null ? { expected_generation: P.current } : {}
      }), z = Number(D == null ? void 0 : D.generation);
      return Number.isFinite(z) && (P.current = z), v.delete(a.readerItemId), s({ ...a, current: R }), d(R), g(""), (D == null ? void 0 : D.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, R), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), M(t, a.readerItemId), !0;
    } catch (D) {
      const z = D;
      return (z == null ? void 0 : z.reason) === "generation_mismatch" && (P.current = null), S({ tone: "error", message: (z == null ? void 0 : z.message) || "保存失败，请稍后再试。" }), w(Gu(z == null ? void 0 : z.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, M, v, P]), N = L(() => {
    n && v.delete(n);
  }, [n, v]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: k,
    reason: m,
    setReason: g,
    saving: h,
    status: I,
    issues: b,
    save: $,
    discardDraft: N
  };
}
const ns = "reader-inline-edit";
function zd({ text: e }) {
  const [t, n] = _("");
  return O(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Qa(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ C("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function Fd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var N;
  const s = e.itemId, i = Od({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = _(!1), [u, f] = _(!1), d = A(null), m = ed(e.rect, t), g = W(() => Yu(o), [o]), h = g.indexOf(s), { loaded: y } = i, I = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: w, select: v } = n, P = L((E) => {
    const T = g[h + E];
    T && (v(T), a == null || a(T));
  }, [g, h, v, a]), M = L(() => {
    i.discardDraft(), w();
  }, [i, w]), k = L(async (E, T) => {
    await i.save(E, T) && w();
  }, [i, w]);
  O(() => {
    const E = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), P(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", E), () => window.removeEventListener("keydown", E);
  }, [P]), Ae(() => {
    const E = d.current;
    if (!E) return;
    E.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    E.style.height = `${Math.max(T, E.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const $ = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ C(_e, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ C(
      "div",
      {
        className: `${ns} is-${m.mode}`,
        style: $,
        role: "group",
        "aria-label": `改第 ${((N = n.target) == null ? void 0 : N.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (E) => E.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            Q,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((E) => !E),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            Oi,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: I || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (E) => i.setDraft(E.target.value),
              onKeyDown: (E) => {
                E.key === "Enter" && (E.metaKey || E.ctrlKey) ? (E.preventDefault(), b || k()) : E.key === "Escape" && (E.preventDefault(), M());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(zd, { text: i.draft }) : null,
          /* @__PURE__ */ C("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(lt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => P(-1), children: /* @__PURE__ */ p(gi, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(lt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => P(1), children: /* @__PURE__ */ p(pn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              dr,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: I || !!S || !y,
                onChange: (E) => i.setReason(E.target.value),
                onKeyDown: (E) => {
                  E.key === "Enter" ? (E.preventDefault(), b || k()) : E.key === "Escape" && (E.preventDefault(), M());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ C(
              Q,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((E) => !E),
                children: [
                  /* @__PURE__ */ p(bi, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(Q, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: M, children: "取消" }),
            /* @__PURE__ */ p(
              Q,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: I || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  k();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((E) => /* @__PURE__ */ p("li", { children: E }, E)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((E, T) => {
            const R = E.text === y.current, D = [Ku(E.ts), E.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ C("li", { "data-block-edit-history": E.label, "data-current": R ? "true" : void 0, children: [
              /* @__PURE__ */ C("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ C("span", { children: [
                  D,
                  R ? "（现在用的）" : "",
                  E.reason ? ` · ${E.reason}` : ""
                ] }),
                R ? null : /* @__PURE__ */ p(
                  Q,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: I || !!S,
                    onClick: () => {
                      k(E.text, `回到「${D.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: E.text })
            ] }, `${E.ts}:${T}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const rs = Qt(null), os = Qt(null);
function Bd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(rs.Provider, { value: e, children: /* @__PURE__ */ p(os.Provider, { value: t, children: n }) });
}
function Fe() {
  return ut(rs);
}
function yr() {
  return ut(os);
}
const as = 1.414;
function jd({
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
  showLiveTranslation: I = r === "source",
  liveTranslationMissing: S = !1
}) {
  var Y, fe;
  const b = Fe(), w = b == null ? void 0 : b.revisedBlocks, v = b == null ? void 0 : b.blockEdit, P = v == null ? void 0 : v.pendingEdits, M = b == null ? void 0 : b.editBlock, k = (b == null ? void 0 : b.findTerm) || "", $ = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", N = b == null ? void 0 : b.textMarks, E = W(
    () => N ? ({ str: x }) => Fu(x, N(x), k) : k ? ({ str: x }) => Ft(x, k) : void 0,
    [k, N]
  ), T = A(c ?? as), [R, D] = _(T.current);
  O(() => {
    c != null && Math.abs(c - T.current) >= 1e-3 && (T.current = c, D(c));
  }, [c]);
  const z = A(u);
  z.current = u;
  const K = A(null), H = A((x) => {
    var j;
    K.current = x, (j = z.current) == null || j.call(z, x);
  }).current, J = A(null), oe = A(`${t}@${n}`);
  Ae(() => {
    const x = `${t}@${n}`;
    oe.current !== x && (oe.current = x, o && Ud(K.current, J.current));
  }, [o, n, t]), O(() => {
    o || Cn(J.current);
  }, [o]), O(() => () => Cn(J.current), []);
  const q = Math.max(120, Math.floor(t * R)), se = Math.max(q, Math.ceil(s || 0)), Ee = pt(f, t, q), re = W(
    () => nd(d, t, q),
    [q, d, t]
  ), [ue, Pe] = _(null), ie = typeof g == "function", le = ie ? m ?? null : ue, B = (x) => {
    ie ? x !== (m ?? null) && (g == null || g(x)) : Pe((j) => j === x ? j : x);
  }, U = W(
    () => re.find((x) => x.itemId === le) || null,
    [le, re]
  ), X = r === "translated" && ((Y = v == null ? void 0 : v.target) == null ? void 0 : Y.itemId) || "", de = W(
    () => X && re.find((x) => x.itemId === X) || null,
    [X, re]
  ), ne = $d(K, o ? U : null, re, t), ae = (x) => {
    var Ie, xe, Oe, Be;
    if (x.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      B(null);
      return;
    }
    if (x.buttons !== 0) {
      B(null);
      return;
    }
    if ((xe = (Ie = x.target) == null ? void 0 : Ie.closest) != null && xe.call(Ie, `.${Za}`) || (Be = (Oe = x.target) == null ? void 0 : Oe.closest) != null && Be.call(Oe, `.${ns}`)) return;
    const j = x.currentTarget.getBoundingClientRect(), V = x.clientX - j.left, me = x.clientY - j.top;
    if (Ld(ne, V, me)) return;
    const be = uo(re, V, me);
    B((be == null ? void 0 : be.itemId) || null);
  }, Se = (x) => {
    if (x.pointerType === "mouse") return;
    const j = x.currentTarget.getBoundingClientRect(), V = uo(
      re,
      x.clientX - j.left,
      x.clientY - j.top
    );
    B((V == null ? void 0 : V.itemId) || null);
  }, ee = (x) => {
    !Number.isFinite(x) || x <= 0 || Math.abs(T.current - x) < 1e-3 || (T.current = x, D(x), l == null || l(e, x));
  };
  return /* @__PURE__ */ C(
    "div",
    {
      ref: H,
      [Te]: e,
      [we]: r,
      [fr]: q,
      className: mr,
      onPointerMoveCapture: ae,
      onPointerDown: Se,
      onDoubleClick: (x) => {
        const j = b == null ? void 0 : b.zoomBlock;
        !j || b != null && b.pointerTaken || !U || $e(U.highlight.region) === "figure" && (x.preventDefault(), j(U.itemId));
      },
      onPointerLeave: (x) => {
        x.pointerType === "mouse" && B(null);
      },
      style: {
        width: t,
        height: se,
        minHeight: se
      },
      children: [
        o ? /* @__PURE__ */ p(
          Fi,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: E,
            renderAnnotationLayer: !1,
            className: La,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: bn,
                style: { width: t, height: q }
              }
            ),
            onLoadSuccess: (x) => {
              try {
                const j = x.getViewport({ scale: 1 });
                if (j.width > 0) {
                  const V = j.height / j.width;
                  ee(V);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Cn(J.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: bn,
            style: { width: t, height: q },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        Ee ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: Ee,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && I ? /* @__PURE__ */ p(
          Ed,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: q
          }
        ) : null,
        o && I && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ p(Rd, { targets: re, edits: P, width: t, excludeId: de == null ? void 0 : de.itemId }) : null,
        o && de && v ? /* @__PURE__ */ p(
          Fd,
          {
            target: de,
            page: { width: t, height: q },
            edit: v,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (w != null && w.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: re.filter((x) => w.has(x.itemId)).map((x) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": x.itemId,
            style: { left: x.rect.left, top: x.rect.top, height: x.rect.height }
          },
          x.itemId
        )) }) : null,
        (fe = b == null ? void 0 : b.pageLayers) == null ? void 0 : fe.map((x) => /* @__PURE__ */ p(Tn, { children: x.render({ page: e, width: t, height: q, pane: $, active: o }) }, x.id)),
        /* @__PURE__ */ p(
          md,
          {
            target: o && !(b != null && b.pointerTaken) && (U == null ? void 0 : U.itemId) !== (de == null ? void 0 : de.itemId) ? U : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: U && (w == null ? void 0 : w.get(U.itemId)) || 0,
            onEdit: M,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: ne == null ? void 0 : ne.rect,
            placement: ne == null ? void 0 : ne.placement,
            tailTop: ne == null ? void 0 : ne.tailTop
          }
        )
      ]
    }
  );
}
const Hd = Zt(jd);
function Ud(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Cn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Wd = 2 * 1024 * 1024;
function Kd(e) {
  const t = new Pa.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const Dn = 5, Vd = "120% 0px", qd = 120, Jd = "25% 0px";
let mo = 1;
const ho = /* @__PURE__ */ new WeakMap();
function Gd(e) {
  if (!e) return 0;
  const t = ho.get(e);
  if (t) return t;
  const n = mo;
  return mo += 1, ho.set(e, n), n;
}
function Xd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Yd = Zs(
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
    regions: I = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: w,
    liveTranslation: v,
    showLiveTranslation: P = t === "source",
    liveTranslationPendingLabel: M = "",
    paneAction: k
  }, $) {
    Ru();
    const { file: N, loading: E, error: T } = Ec(n, r), R = `${n}\0${Gd(N)}`, D = A(R);
    D.current = R;
    const z = W(() => {
      const F = yc(N);
      return F ? "ranged" in F ? { range: Kd(F.ranged) } : F : null;
    }, [N, n]), [K, H] = _(0), [J, oe] = _(""), [q, se] = _(null), [Ee, re] = _(480), ue = A(null), Pe = A(0), ie = W(() => Xd(), []), le = W(() => ({
      cMapUrl: qt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: qt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Wd,
      disableAutoFetch: !0
    }), []);
    lr($, () => q, [q]), O(() => {
      const F = (G) => {
        Pe.current = G, re(G);
      }, Z = (G) => {
        const pe = Kc(G, Pe.current);
        if (pe !== "ignore") {
          if (ue.current && clearTimeout(ue.current), pe === "immediate") {
            F(G);
            return;
          }
          ue.current = setTimeout(() => F(G), za);
        }
      }, te = !!(c && c >= 80);
      Z(te ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ge = !te && i && typeof ResizeObserver < "u" ? new ResizeObserver((G) => {
        var pe, ke;
        Z(((ke = (pe = G[0]) == null ? void 0 : pe.contentRect) == null ? void 0 : ke.width) ?? i.clientWidth);
      }) : null;
      return ge && i && ge.observe(i), () => {
        ge == null || ge.disconnect(), ue.current && clearTimeout(ue.current);
      };
    }, [c, i, a]);
    const B = W(
      () => Hc(Ee, o),
      [Ee, o]
    ), [U, X] = _(() => /* @__PURE__ */ new Map()), [de, ne] = _(() => /* @__PURE__ */ new Set()), [ae, Se] = _(() => /* @__PURE__ */ new Set()), ee = A(/* @__PURE__ */ new Map()), Y = A(null), fe = A(null), [x, j] = _(() => /* @__PURE__ */ new Set()), V = A(/* @__PURE__ */ new Map()), me = L((F, Z) => {
      X((te) => {
        if (te.get(F) === Z) return te;
        const ce = new Map(te);
        return ce.set(F, Z), ce;
      });
    }, []), be = L((F, Z) => {
      const te = ee.current, ce = te.get(F), ge = [Y.current, fe.current];
      if (ce)
        for (const G of ge)
          try {
            G == null || G.unobserve(ce);
          } catch {
          }
      if (Z) {
        te.set(F, Z);
        for (const G of ge)
          try {
            G == null || G.observe(Z);
          } catch {
          }
      } else
        te.delete(F);
    }, []), Ie = A(/* @__PURE__ */ new Map()), xe = L((F) => {
      const Z = Ie.current;
      let te = Z.get(F);
      return te || (te = (ce) => be(F, ce), Z.set(F, te)), te;
    }, [be]);
    O(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = V.current, Z = new IntersectionObserver(
        (te) => {
          const ce = [], ge = [];
          for (const G of te) {
            const pe = G.target, ke = vn(pe);
            Number.isFinite(ke) && (G.isIntersecting ? ce : ge).push(ke);
          }
          if ((ce.length || ge.length) && ne((G) => {
            let pe = null;
            for (const ke of ce)
              G.has(ke) || (pe = pe || new Set(G), pe.add(ke));
            for (const ke of ge)
              G.has(ke) && (pe = pe || new Set(G), pe.delete(ke));
            return pe || G;
          }), ce.length) {
            for (const G of ce) {
              const pe = F.get(G);
              pe && (clearTimeout(pe), F.delete(G));
            }
            Se((G) => {
              let pe = null;
              for (const ke of ce)
                G.has(ke) || (pe = pe || new Set(G), pe.add(ke));
              return pe || G;
            });
          }
          for (const G of ge)
            F.has(G) || F.set(G, setTimeout(() => {
              F.delete(G), Se((pe) => {
                if (!pe.has(G)) return pe;
                const ke = new Set(pe);
                return ke.delete(G), ke;
              });
            }, qd));
        },
        { root: i, rootMargin: Vd, threshold: 0 }
      );
      Y.current = Z;
      for (const te of ee.current.values())
        try {
          Z.observe(te);
        } catch {
        }
      return () => {
        Z.disconnect(), Y.current === Z && (Y.current = null);
        for (const te of F.values()) clearTimeout(te);
        F.clear();
      };
    }, [i]), O(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = new IntersectionObserver(
        (Z) => {
          j((te) => {
            let ce = null;
            for (const ge of Z) {
              const G = vn(ge.target);
              !Number.isFinite(G) || ge.isIntersecting === te.has(G) || (ce = ce || new Set(te), ge.isIntersecting ? ce.add(G) : ce.delete(G));
            }
            return ce || te;
          });
        },
        { root: i, rootMargin: Jd, threshold: 0 }
      );
      fe.current = F;
      for (const Z of ee.current.values())
        try {
          F.observe(Z);
        } catch {
        }
      return () => {
        F.disconnect(), fe.current === F && (fe.current = null);
      };
    }, [i]);
    const Oe = !!i && typeof IntersectionObserver < "u";
    Ae(() => {
      H(0), oe(""), ne(/* @__PURE__ */ new Set()), Se(/* @__PURE__ */ new Set()), X(/* @__PURE__ */ new Map()), ee.current.clear();
      const F = V.current;
      for (const Z of F.values()) clearTimeout(Z);
      F.clear(), h == null || h(0, t);
    }, [R, h, t]);
    const Be = L(
      (F) => {
        if (D.current !== R) return;
        const Z = F.numPages;
        H(Z), oe(""), h == null || h(Z, t), f == null || f({ numPages: Z, pane: t }), m && typeof F.getPage == "function" && m(F, t), d && typeof F.getOutline == "function" && Eu(F).then((te) => {
          D.current === R && d(te, t);
        }, () => {
        });
      },
      [R, f, d, m, h, t]
    ), Ze = L(
      (F) => {
        if (D.current !== R) return;
        const Z = (F == null ? void 0 : F.message) || "PDF 解析失败";
        oe(Z), H(0), h == null || h(0, t), g == null || g(F, t);
      },
      [R, g, h, t]
    ), Le = W(
      () => K > 0 ? Array.from({ length: K }, (F, Z) => Z + 1) : [],
      [K]
    );
    O(() => {
      typeof IntersectionObserver < "u" || Se(new Set(Le));
    }, [Le]);
    const We = W(
      () => xt(y, S, t),
      [y, S, t]
    ), Qe = W(() => {
      const F = /* @__PURE__ */ new Map();
      for (const Z of I) {
        const te = xt(Z, S, t);
        if (!te) continue;
        const ce = F.get(te.box.page) || [];
        ce.push(te), F.set(te.box.page, ce);
      }
      return F;
    }, [t, S, I]), et = W(() => {
      const F = /* @__PURE__ */ new Set();
      if (!b) return F;
      for (const [Z, te] of Qe)
        te.some((ce) => ce.itemId === b) && F.add(Z);
      return F;
    }, [b, Qe]), vt = W(() => {
      if (K === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Le);
      if (de.size === 0) {
        const te = Math.min(K, Dn * 2 + 1);
        return new Set(Array.from({ length: te }, (ce, ge) => ge + 1));
      }
      const Z = /* @__PURE__ */ new Set();
      for (const te of de)
        for (let ce = -Dn; ce <= Dn; ce++) {
          const ge = te + ce;
          ge >= 1 && ge <= K && Z.add(ge);
        }
      return Z;
    }, [K, Le, i, a, de]), tt = !n || !!T || !!J, ye = n && (T || J) || s;
    return /* @__PURE__ */ C(
      "section",
      {
        ref: se,
        className: `reader-panel ${en}${a ? "" : " is-hidden"}`,
        [we]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (v == null ? void 0 : v.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          k ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: k }) : null,
          M ? /* @__PURE__ */ C("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: M })
          ] }) : null,
          tt && !E ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ye }) : null,
          E ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          z && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Bi,
            {
              file: z,
              loading: null,
              error: null,
              options: le,
              onLoadSuccess: Be,
              onLoadError: Ze,
              className: "reader-react-pdf-document",
              children: Le.map((F) => {
                if (vt.has(F))
                  return /* @__PURE__ */ p(
                    Hd,
                    {
                      pane: t,
                      pageNumber: F,
                      width: B,
                      devicePixelRatio: ie,
                      active: ae.has(F),
                      textLayer: !Oe || x.has(F),
                      syncedMinHeight: (l == null ? void 0 : l.get(F)) || 0,
                      onMetrics: u,
                      cachedAspect: U.get(F),
                      onAspectChange: me,
                      sentinelRef: xe(F),
                      regionHighlight: (We == null ? void 0 : We.box.page) === F ? We : null,
                      regionTargets: Qe.get(F),
                      hoveredRegionId: b && et.has(F) ? b : null,
                      onHoverRegion: w,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(F - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(F - 1),
                      showLiveTranslation: P,
                      liveTranslationMissing: Jl(v, F - 1)
                    },
                    `${t}-${F}`
                  );
                const te = U.get(F) ?? as, ce = Math.max(120, Math.floor(B * te)), ge = Math.max(ce, Math.ceil((l == null ? void 0 : l.get(F)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: xe(F),
                    [Te]: F,
                    [we]: t,
                    [fr]: ce,
                    className: `${mr} is-placeholder`,
                    style: {
                      width: B,
                      height: ge,
                      minHeight: ge
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: bn,
                        style: { width: B, height: ce },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${F}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), po = Zt(Yd), Zd = 2e3, Qd = 6, ef = 500, go = "reader-react-resizing";
function tf(e, t) {
  const n = A(null), r = A(null);
  Ae(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const w = nf(e), v = Ut(e, w);
      if (!v) return;
      s = { pane: w, progress: v, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), I = typeof ResizeObserver > "u" ? null : new ResizeObserver((w) => {
      let v = !1;
      for (const P of w) {
        const M = Math.round(P.contentRect.height);
        y.has(P.target) && y.get(P.target) !== M && (v = !0), y.set(P.target, M);
      }
      v && Nt(e, c, "auto", i);
    }), S = () => {
      var w;
      f && clearTimeout(f), cancelAnimationFrame(u), I == null || I.disconnect(), e.classList.remove(go);
      for (const v of bo) e.removeEventListener(v, S);
      ((w = r.current) == null ? void 0 : w.stop) === S && (r.current = null);
    }, b = () => {
      Nt(e, c, "auto", i);
      const w = e.scrollHeight;
      g = w === m ? g + 1 : 0, m = w;
      const v = performance.now() - h;
      g >= Qd && (w !== d || v > ef) || v > Zd ? S() : u = requestAnimationFrame(b);
    };
    for (const w of bo) e.addEventListener(w, S, { passive: !0 });
    for (const w of Array.from(e.children)) I == null || I.observe(w);
    e.classList.add(go), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, za);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function nf(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Te}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(we) || null;
  }
  return null;
}
const bo = ["wheel", "touchstart", "keydown", "pointerdown"];
function rf(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function of(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(en)) && ((n = e.hasAttribute) != null && n.call(e, we)));
}
function af(e, t) {
  O(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!of(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${en}[${we}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = rf(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function sf(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function cf(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const yo = 12;
function vr(e) {
  return Array.from(e.querySelectorAll(`.${en}[${we}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function lf(e) {
  const t = e.getBoundingClientRect();
  return vr(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(we) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function uf(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function df(e, t) {
  return e ? vr(e).find((n) => n.getAttribute(we) === t) ?? null : null;
}
function ff({ shellEl: e }) {
  const [t, n] = _([]), r = A(0), o = L(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = lf(e);
      n((i) => uf(i, s) ? i : s);
    }));
  }, [e]);
  O(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, c = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of vr(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(mf, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function mf({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - yo * 2), r = sf(e, n), o = A(null);
  if (!r) return null;
  const a = (d) => {
    const m = df(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + cf(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + yo, width: n },
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
function ss(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function hf(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function pf({ compare: e, onDone: t }) {
  return /* @__PURE__ */ C("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(
        Q,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: ss(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(ur, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(yi, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ C("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ C(
        Q,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(ba, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ C(
        Q,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(vi, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function vo({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = hf(t), a = [e === "compare" ? "对比" : "正在读", r, ss(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ C("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function gf({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = _({ source: null, translated: null });
  return Ae(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${we}="${l}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${we}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ C("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(vo, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(vo, { role: "reading", ...n }) }) : null
  ] });
}
const bf = () => () => {
}, wo = () => null;
function yf({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function vf(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function wf(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Sf(e) {
  const t = Fe(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? tn, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, I = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, w = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", v = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, M = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, k = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), $ = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), N = t == null ? void 0 : t.onPdfOutline, E = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), R = e.regions ?? (t == null ? void 0 : t.regions) ?? [], D = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), z = (t == null ? void 0 : t.regionHover) ?? null, [K, H] = _(null), J = En(
    z ? z.subscribe : bf,
    z ? () => z.get().itemId : wo,
    z ? () => z.get().itemId : wo
  ), oe = z ? J : K, q = L((ue) => {
    z ? z.set(ue, "pdf") : H(ue);
  }, [z]), se = yf({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), re = Number.isFinite(g) && g > 0 ? vf(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !se.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return tf(d, re), af(d, se.compareMode), /* @__PURE__ */ C(
    "div",
    {
      ref: f,
      className: Aa,
      "data-reader-region-count": R.length,
      "data-reader-structured-region-count": R.filter(ui).length,
      "data-reader-metadata-ready": D ? "true" : "false",
      children: [
        /* @__PURE__ */ C(
          "main",
          {
            className: `${_a} reader-mode-${se.mode}`,
            "data-reader-mode": se.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                po,
                {
                  pane: "source",
                  url: w,
                  preloadedFile: P,
                  userZoom: m,
                  visible: se.showSource,
                  scrollRoot: d,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? h : void 0,
                  onMetrics: k,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: $,
                  onOutline: b ? void 0 : N,
                  onDocument: b ? void 0 : E,
                  activeRegion: T,
                  regions: (b == null ? void 0 : b.regions) ?? R,
                  readerMetadata: D,
                  hoveredRegionId: oe,
                  onHoverRegion: q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? wf(o) : "",
                  paneAction: u && se.showTranslated ? /* @__PURE__ */ C(_e, { children: [
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
              I ? /* @__PURE__ */ p(
                po,
                {
                  pane: "translated",
                  url: v,
                  preloadedFile: M,
                  userZoom: m,
                  visible: se.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? h : void 0,
                  onMetrics: k,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: $,
                  onOutline: N,
                  onDocument: E,
                  activeRegion: T,
                  regions: R,
                  readerMetadata: D,
                  hoveredRegionId: oe,
                  onHoverRegion: q,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(ff, { shellEl: d }),
        b ? /* @__PURE__ */ p(gf, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const If = 72, cn = 1500, Tf = 2e3, Ef = 1200;
function kf(e, t) {
  return e - t < If;
}
function Rf(e) {
  try {
    return e.matches(":focus-visible");
  } catch {
    return !1;
  }
}
function Pf(e, t) {
  const [n, r] = _(!0), o = A(null), a = A(!1), s = A(!1), i = L(() => {
    o.current !== null && (window.clearTimeout(o.current), o.current = null);
  }, []), c = L((u) => {
    i(), o.current = window.setTimeout(() => {
      o.current = null, s.current || r(!1);
    }, u);
  }, [i]);
  O(() => {
    var w;
    const u = (w = e.current) == null ? void 0 : w.parentElement;
    if (!u) return;
    let f = u.getBoundingClientRect().top;
    const d = () => {
      f = u.getBoundingClientRect().top;
    }, m = (v) => {
      v.pointerType !== "touch" && (kf(v.clientY, f) ? a.current || (a.current = !0, i(), r(!0)) : a.current && (a.current = !1, c(cn)));
    }, g = () => {
      a.current && (a.current = !1, c(cn));
    }, h = (v) => {
      s.current = v.target instanceof Element && Rf(v.target), s.current && (i(), r(!0));
    }, y = (v) => {
      var k;
      const P = v.relatedTarget;
      if (P instanceof Node && ((k = e.current) != null && k.contains(P))) return;
      const M = s.current;
      s.current = !1, M && !a.current && c(cn);
    }, I = () => {
      a.current || (r(!0), c(cn));
    }, S = () => {
      s.current = !1;
    }, b = e.current;
    return c(Tf), b == null || b.addEventListener("focusin", h), b == null || b.addEventListener("focusout", y), b == null || b.addEventListener("pointerdown", S), u.addEventListener("scroll", I, { capture: !0, passive: !0 }), u.addEventListener("pointerenter", d), u.addEventListener("pointermove", m, { passive: !0 }), u.addEventListener("pointerleave", g), window.addEventListener("resize", d), () => {
      i(), b == null || b.removeEventListener("focusin", h), b == null || b.removeEventListener("focusout", y), b == null || b.removeEventListener("pointerdown", S), u.removeEventListener("scroll", I, { capture: !0 }), u.removeEventListener("pointerenter", d), u.removeEventListener("pointermove", m), u.removeEventListener("pointerleave", g), window.removeEventListener("resize", d);
    };
  }, [e, i, c]);
  const l = A(t);
  return O(() => {
    l.current !== t && (l.current = t, !a.current && (r(!0), c(Ef)));
  }, [t, c]), n;
}
const Mf = [
  { id: "source", label: "原文", Icon: ya },
  { id: "compare", label: "对照", Icon: va },
  { id: "translated", label: "译文", Icon: wa }
];
function xf(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Nf(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function _f(e) {
  const t = Fe(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? xf(a.state) : "", l = A(null), u = Pf(l, n);
  return (
    // 浮在书页区顶上（2026-11-28 用户：「顶部的 bar 不要保留了，用悬浮的方式……更有沉浸感」）：
    // 这一层本身透明、不接点击，只有左上的胶囊和正中的页签接；左右两段同宽，页签在书页区正中。
    // 读的时候藏着，鼠标到书页区顶上才出来（use-topbar-reveal.ts；不藏的几种在 chrome.css）。
    /* @__PURE__ */ C("header", { className: "reader-workspace-bar", ref: l, "data-revealed": u ? "true" : "false", children: [
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
      e.start ? /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }) : null,
      /* @__PURE__ */ C("div", { className: "reader-workspace-center", children: [
        /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Mf.map(({ id: f, label: d, Icon: m }) => {
          const g = n === f, h = Nf({
            id: f,
            documentReady: r,
            sourceViewOnly: i,
            liveTranslationAvailable: !!a
          });
          return /* @__PURE__ */ C(Tn, { children: [
            /* @__PURE__ */ p(
              "button",
              {
                type: "button",
                className: `reader-workspace-tab${g ? " is-active" : ""}`,
                role: "tab",
                "aria-selected": g,
                "aria-label": d,
                title: h ? `${d} 需要文档任务` : d,
                disabled: h,
                onClick: () => o(f),
                children: /* @__PURE__ */ p(m, { ...Re, "aria-hidden": !0 })
              }
            ),
            f === "compare" ? e.compareExtra : null
          ] }, f);
        }) }),
        a ? /* @__PURE__ */ C("div", { className: "reader-live-strip", children: [
          /* @__PURE__ */ C(
            "button",
            {
              type: "button",
              className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
              "aria-pressed": a.visible,
              "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
              title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
              onClick: a.onToggle,
              children: [
                /* @__PURE__ */ p(wi, { ...Re, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
              ]
            }
          ),
          a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ C(
            Q,
            {
              className: "reader-live-translation-toggle reader-live-jump",
              "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
              title: `跳到最新译好的第 ${a.latestPage} 页`,
              onClick: a.onJumpToLatest,
              children: [
                /* @__PURE__ */ p(Si, { ...Re, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
              ]
            }
          ) : null
        ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ C(
          Q,
          {
            className: "reader-live-translation-toggle is-done",
            title: "翻译完成，左右对照看最终译文",
            onClick: s.onOpenCompare,
            children: [
              /* @__PURE__ */ p(Ii, { ...Re, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
            ]
          }
        ) }) : null
      ] }),
      /* @__PURE__ */ p("span", { className: "reader-workspace-end", "aria-hidden": "true" })
    ] })
  );
}
const is = [];
function Af() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = is;
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
function So(e, t) {
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
function Lf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function Cf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Df(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function $f(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function Of(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function zf(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function Ff(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const Rn = Qt(null), cs = Qt(null);
function Bf({ api: e, store: t, children: n }) {
  const r = W(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(Rn.Provider, { value: r, children: n });
}
function nn() {
  const e = ut(Rn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const jf = () => () => {
}, Io = () => is;
function Hf(e) {
  return En(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function ls() {
  var t;
  const e = (t = ut(Rn)) == null ? void 0 : t.store;
  return En((e == null ? void 0 : e.subscribe) ?? jf, (e == null ? void 0 : e.getSnapshot) ?? Io, (e == null ? void 0 : e.getSnapshot) ?? Io);
}
function Pn(e) {
  var a;
  const t = (a = ut(Rn)) == null ? void 0 : a.store, n = ut(cs);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  O(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), O(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class Uf extends Qs {
  constructor() {
    super(...arguments);
    jr(this, "state", { failed: !1 });
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
const Wf = Zt(function({ extensions: t }) {
  return /* @__PURE__ */ p(_e, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(Uf, { id: n, children: /* @__PURE__ */ p(Kf, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function Kf({ id: e, title: t, children: n }) {
  const r = W(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(cs.Provider, { value: r, children: n });
}
function Vf({
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
      Q,
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
const To = 6e3;
function us(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function ds(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > To && (s *= To / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function fs({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = A(null), [i, c] = _({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return O(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = ds(n, m, r, g), y = s.current, I = y == null ? void 0 : y.getContext("2d");
        if (!y || !I) return;
        y.width = h.canvasWidth, y.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const S = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), b = d.render({ canvasContext: I, viewport: S });
        f = b, await b.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && c((m) => ({ status: "error", cssHeight: m.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, l]), /* @__PURE__ */ C(
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
const qf = 1600, wr = { left: 0, top: 0, width: 1, height: 1 };
function ms(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function Jf(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function Gf(e, t, n = wr, r = qf) {
  const o = await e.getPage(t), a = ds(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, ms(s);
}
async function Xf(e, t = wr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), ms(s);
}
function Yf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const Zf = /[\u{1D400}-\u{1D7FF}ﬀ-ﬆ]/gu, Eo = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/u;
function hs(e) {
  let t = `${e || ""}`.replace(/\r\n?/g, `
`).replace(/­/g, "");
  return t.trim() ? (t = t.replace(Zf, (r) => r.normalize("NFKC")), t = t.normalize("NFC"), t.includes("̸") && (t = t.replace(/(\S)?̸[ \t]*(\S)/gu, (r, o, a) => `${o ? `${o} ` : ""}${a}̸`).normalize("NFC")), t.split(/\n[ \t]*\n+/).map((r) => Qf(r.split(`
`))).filter(Boolean).join(`
`).trim()) : "";
}
function Qf(e) {
  let t = "";
  for (const n of e) {
    const r = n.replace(/[ \t ]+/g, " ").trim();
    if (!r) continue;
    if (!t) {
      t = r;
      continue;
    }
    if (new RegExp("\\p{L}-$", "u").test(t) && new RegExp("^\\p{Ll}", "u").test(r)) {
      t = t.slice(0, -1) + r;
      continue;
    }
    if (new RegExp("\\p{L}-$", "u").test(t) && /^[\p{Lu}\p{N}]/u.test(r)) {
      t += r;
      continue;
    }
    const o = t.slice(-1), a = r.charAt(0);
    t += Eo.test(o) || Eo.test(a) ? r : ` ${r}`;
  }
  return t;
}
const em = /[\u{1D400}-\u{1D7FF}Ͱ-Ͽ℀-⅏←-⋿⨀-⫿⟀-⟯⦀-⧿⁰-₟̀-ͯ√±×÷]/u;
function ko(e) {
  return em.test(e);
}
function tm(e) {
  const t = `${e || ""}`;
  return t.trim() ? [...t.trim()].length > 6 ? !1 : !new RegExp("\\p{Ll}{3,}", "u").test(t) : !0;
}
function nm(e, t) {
  const n = e[t];
  if (!n) return null;
  const r = (i) => {
    const c = e[i];
    return !!c && c.line === n.line && (ko(c.text) || tm(c.text));
  };
  if (!r(t)) return null;
  let o = t, a = t;
  for (; r(o - 1); ) o -= 1;
  for (; r(a + 1); ) a += 1;
  let s = !1;
  for (let i = o; i <= a; i += 1) ko(e[i].text) && (s = !0);
  if (!s) return null;
  for (; o < a && !e[o].text.trim(); ) o += 1;
  for (; a > o && !e[a].text.trim(); ) a -= 1;
  return [o, a];
}
function rm(e) {
  const t = e.filter((a) => a.right - a.left > 0.5 && a.bottom - a.top > 0.5);
  if (!t.length) return [];
  const n = [...t].sort((a, s) => (a.top + a.bottom) / 2 - (s.top + s.bottom) / 2), r = [];
  for (const a of n) {
    const s = r.at(-1), i = s ? Ro(s) : null;
    i && om(i, a) >= 0.5 * Math.min(i.bottom - i.top, a.bottom - a.top) ? s.push(a) : r.push([a]);
  }
  const o = [];
  for (const a of r) {
    const s = Ro(a), i = s.bottom - s.top, c = [...a].sort((u, f) => u.left - f.left);
    let l = null;
    for (const u of c)
      l && u.left - l.right <= i * 2 ? l.right = Math.max(l.right, u.right) : (l && o.push(l), l = { left: u.left, top: s.top, right: u.right, bottom: s.bottom });
    l && o.push(l);
  }
  return o;
}
function Ro(e) {
  const t = Math.max(...e.map((r) => r.bottom - r.top)), n = e.filter((r) => r.bottom - r.top >= t * 0.75);
  return { top: Math.min(...n.map((r) => r.top)), bottom: Math.max(...n.map((r) => r.bottom)) };
}
function om(e, t) {
  return Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top);
}
const am = 4e3;
function sm(e, t, n) {
  if (e.length) {
    const o = ku(e, n), a = o ? Ga(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function Po(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Te}]`)) ?? null;
  return r ? { text: hs(`${e}`).slice(0, am), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function im(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = xt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = pt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function cm({
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
  const c = Number(e.getAttribute(Te)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(we) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? im(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: sm(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
function lm(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Te}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Te)) || 0, i = (o.closest(`[${we}]`) ?? o).getAttribute(we) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function um({ onDone: e, onCancel: t }) {
  const [n, r] = _(null), o = A(null), a = A(null);
  O(() => {
    const c = (l) => {
      l.key === "Escape" && (l.preventDefault(), l.stopImmediatePropagation(), t());
    };
    return window.addEventListener("keydown", c, !0), () => window.removeEventListener("keydown", c, !0);
  }, [t]);
  const s = (c, l) => {
    const u = a.current;
    u && (u.style.pointerEvents = "none");
    try {
      return lm(c, l);
    } finally {
      u && (u.style.pointerEvents = "");
    }
  }, i = n ? { left: Math.min(n.from.x, n.to.x), top: Math.min(n.from.y, n.to.y), width: Math.abs(n.to.x - n.from.x), height: Math.abs(n.to.y - n.from.y) } : null;
  return /* @__PURE__ */ C(
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
        const f = Jf(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const Mo = 5e4, dm = 2e4;
function $n(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Db(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function fm(e, t = null) {
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
function mm(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function hm(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function $b(e, t) {
  var r;
  const n = hm(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Ob(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function pm(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? gm(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function gm(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function bm(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = pm(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: mm(o.selection, n),
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
function ym(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: $n(e.question.text, Mo), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: $n(e.answer.text, Mo),
      thought: e.answer.thought ? $n(e.answer.thought, dm) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function vm(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function wm(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Sm(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Im(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Tm = 50, On = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Em() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function xo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function km({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = _(!1), [i, c] = _(On), [l, u] = _(!1), [f, d] = _(""), [m, g] = _("idle"), [h, y] = _(null), [I, S] = _([]), b = L((B) => {
    y(B), S([]);
  }, []), w = L((B) => S((U) => [...U, B].slice(-2)), []), [v, P] = _(() => /* @__PURE__ */ new Map()), M = A(/* @__PURE__ */ new Set()), k = A(/* @__PURE__ */ new Map()), $ = (B) => {
    if (!B) return null;
    const U = k.current.get(B);
    return U || (N.current.records.some((X) => X.message_id === B) ? B : null);
  }, N = A(i);
  N.current = i;
  const E = A(t);
  E.current = t;
  const T = A(0), R = L(async (B, U, X, de = []) => {
    if (!r) return;
    const ne = await r.messages(B.conversation_id, { limit: Tm, ...X ? { beforeSeq: X } : {} }), ae = [...ne.messages, ...de];
    T.current += 1, c({
      conversation: B,
      main: U ?? B,
      records: ae,
      compactions: ne.compactions || [],
      hasMore: ne.has_more,
      key: `${B.conversation_id}:${T.current}`,
      initial: bm(ae, ne.compactions || [], E.current.documentId)
    });
  }, [r]), D = L(async () => {
    s(!0);
    const B = N.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) === "main" && B.status !== "archived")) {
      u(!0), d("");
      try {
        const U = await r.main(E.current.documentId || void 0);
        await R(U, U);
      } catch (U) {
        d(U instanceof Error ? U.message : String(U));
      } finally {
        u(!1);
      }
    }
  }, [r, R]), z = L((B) => {
    b(B), D();
  }, [D]), K = A(t.documentId);
  O(() => {
    K.current !== t.documentId && (K.current = t.documentId, N.current = On, c(On), b(null), P(/* @__PURE__ */ new Map()), k.current.clear(), a && D());
  }, [t.documentId, a, D]);
  const H = L(async () => {
    const B = N.current, U = B.records[0];
    if (!(!B.conversation || !U || !B.hasMore)) {
      u(!0);
      try {
        await R(B.conversation, B.main, U.seq, B.records);
      } finally {
        u(!1);
      }
    }
  }, [R]), J = L(async (B) => {
    const X = N.current.conversation;
    if (!r || !X) return;
    for (const Y of B.memoryIds) M.current.add(Y);
    let de = B.memoryIds;
    if (!de.length && o && B.startedAt) {
      const Y = wm(
        await o.list({ source_conversation_id: X.conversation_id, created_after: vm(B.startedAt) }).catch(() => []),
        M.current
      );
      for (const x of Y) M.current.add(x.id);
      de = Y.map((x) => x.id);
      const fe = B.answerId;
      Y.length && fe && P((x) => new Map(x).set(fe, Y));
    }
    const ne = ym({ ...B, memoryIds: de }, E.current.documentId, Em(), $(B.editedFrom));
    let ae;
    try {
      ae = await r.append(X.conversation_id, ne);
    } catch (Y) {
      if (X.kind !== "side" || !/ask_conversation_not_open/.test(xo(Y))) throw Y;
      await r.reopen(X.conversation_id), ae = await r.append(X.conversation_id, ne);
    }
    const [Se, ee] = ae.messages;
    B.questionId && Se && k.current.set(B.questionId, Se.message_id), B.answerId && ee && k.current.set(B.answerId, ee.message_id), c((Y) => {
      var fe;
      return ((fe = Y.conversation) == null ? void 0 : fe.conversation_id) === X.conversation_id ? { ...Y, conversation: ae.conversation, records: [...Y.records, ...ae.messages] } : Y;
    }), n == null || n(ae.messages), ae.compaction_due && X.kind === "main" && r.compact(X.conversation_id).catch(() => {
    });
  }, [r, o, n]), oe = L(async (B) => {
    const U = N.current.conversation, X = $(B);
    if (!r || !U || !X) return null;
    try {
      await r.supersede(U.conversation_id, X);
    } catch (ae) {
      if (!/ask_message_superseded/.test(xo(ae))) throw ae;
    }
    const de = N.current.records.find((ae) => ae.message_id === X), ne = N.current.records.findIndex((ae) => ae.message_id === X);
    return c((ae) => ({ ...ae, records: ae.records.map((Se, ee) => ee >= ne && ne >= 0 && !Se.superseded_at ? { ...Se, superseded_at: "now" } : Se) })), (de == null ? void 0 : de.selection) ?? null;
  }, [r]), q = L((B) => {
    J(B).catch((U) => d(`这一轮没存上：${U instanceof Error ? U.message : String(U)}`));
  }, [J]), se = L(async (B) => {
    var de;
    const U = N.current, X = U.main;
    if (!(!r || !X || ((de = U.conversation) == null ? void 0 : de.kind) !== "main")) {
      d("");
      try {
        const ne = Sm(U.records, B), ae = await r.fork({
          parent_id: X.conversation_id,
          ...ne ? { forked_from_message_id: ne } : {},
          title: Im(B.text),
          ...E.current.documentId ? { document_id: E.current.documentId } : {}
        });
        await R(ae, X);
      } catch (ne) {
        d(`开不了副对话：${ne instanceof Error ? ne.message : String(ne)}`);
      }
    }
  }, [r, R]), Ee = L(async (B) => {
    const U = N.current.main;
    if (r)
      try {
        await R(await r.get(B), U);
      } catch (X) {
        d(`打不开副对话：${X instanceof Error ? X.message : String(X)}`);
      }
  }, [r, R]), re = L(async () => {
    const B = N.current.main;
    B && await R(B, B).catch(() => {
    });
  }, [R]), ue = L(async () => {
    const B = N.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) !== "side")) {
      g("busy");
      try {
        await r.close(B.conversation_id), g("idle"), await re();
      } catch {
        g("failed");
      }
    }
  }, [r, re]), Pe = L(async () => r != null && r.archived ? r.archived(E.current.documentId) : [], [r]), ie = L(async (B) => {
    d(""), b(null);
    try {
      await R(B, N.current.main);
    } catch (U) {
      d(`打不开这个对话：${U instanceof Error ? U.message : String(U)}`);
    }
  }, [R, b]), le = L(async () => {
    const B = N.current.main;
    if (!r || !B) return;
    await r.archive(B.conversation_id);
    const U = await r.main(E.current.documentId || void 0);
    await R(U, U);
  }, [r, R]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: f,
    pending: h,
    setPending: b,
    extras: I,
    addExtra: w,
    closingSide: m,
    notices: v,
    persistent: !!r,
    openMain: D,
    ask: z,
    close: L(() => s(!1), []),
    loadEarlier: H,
    onTurn: q,
    rewrite: oe,
    fork: se,
    openSide: Ee,
    backToMain: re,
    closeSide: ue,
    archiveMain: le,
    listArchived: Pe,
    viewArchived: ie,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function No(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = fm({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Rm({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = _([]), s = A(0), i = A(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  O(() => {
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
      (h) => d(h.map((y) => No(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = L((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => No(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = L((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Pm = fa(() => import("./ReaderAskPanel-CDK0lzDp.js"));
function Mm({
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
  activePanel: y = null,
  panelHost: I = null
}) {
  const S = W(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), b = L((x, j, V) => {
    const me = x ? o.find((xe) => xe.itemId === x) : null, be = me ? xt(me, a, j) : null, Ie = be && be.box.page === V ? pt(be, 1, 1) : null;
    return Ie ? { x: Ie.left, y: Ie.top } : null;
  }, [o, a]), w = Rm({ port: e, documentId: t, resetKey: c, pointOf: b }), v = km({ port: e, book: S, onAppended: w.addRecords }), [P, M] = _(null), k = L(
    (x, j, V, me) => cm({
      pageElement: (x == null ? void 0 : x.closest(`[${Te}]`)) ?? null,
      clientX: j,
      clientY: V,
      itemId: i(),
      selection: me,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), $ = L(() => {
    var j;
    const x = Po(((j = globalThis.getSelection) == null ? void 0 : j.call(globalThis)) ?? null);
    return !x.text || !x.element || !x.rect ? null : k(x.element, x.rect.left + x.rect.width / 2, x.rect.top + x.rect.height / 2, x.text);
  }, [k]), N = L((x) => {
    M(null), v.ask(x);
  }, [v.ask]);
  O(() => {
    if (!e) return;
    const x = (j) => {
      var be;
      if (j.key !== "?" || j.metaKey || j.ctrlKey || j.altKey || j.defaultPrevented) return;
      const V = j.target;
      if ((be = V == null ? void 0 : V.closest) != null && be.call(V, "input, textarea, select, [contenteditable='true']")) return;
      const me = $();
      me && (j.preventDefault(), j.stopImmediatePropagation(), N(me));
    };
    return window.addEventListener("keydown", x, !0), () => window.removeEventListener("keydown", x, !0);
  }, [e, $, N]);
  const E = A(m);
  E.current = m;
  const T = L(async ({ page: x, pane: j, region: V, canvas: me }) => {
    const be = E.current[j];
    let Ie;
    if (be)
      Ie = await Gf(be, x, V);
    else {
      const xe = me ?? document.querySelector(`[${we}="${j}"] [${Te}="${x}"] canvas`);
      if (!xe) throw new Error(`第 ${x} 页还没画出来，翻到那一页再试`);
      Ie = await Xf(xe, V);
    }
    return new File([Ie], Yf(x, V), { type: "image/png" });
  }, []), [R, D] = _(null), z = A(v.pending);
  z.current = v.pending;
  const K = W(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(Ti, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const x = z.current, j = (x == null ? void 0 : x.pane) || (h === "translated" ? "translated" : "source");
      return T({ page: (x == null ? void 0 : x.page) || g() || 1, pane: j, region: wr });
    }
  }], [T, g, h]), [H, J] = _(!1), [oe, q] = _(""), se = L(async (x) => {
    J(!1), q("");
    try {
      const j = await T(x), V = k(x.point.target, x.point.x, x.point.y, "");
      D((me) => ({ id: ((me == null ? void 0 : me.id) || 0) + 1, files: [j] })), V ? N({ ...V, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (j) {
      q(j instanceof Error ? j.message : String(j));
    }
  }, [T, k, N]), Ee = L(() => J(!1), []), re = L(() => {
    q(""), J((x) => !x);
  }, []), ue = L(async (x) => {
    if (x.threadId && (e != null && e.threads) && t) {
      try {
        const j = await e.threads.get(t, x.threadId);
        M({ anchor: j.anchor || x.anchor, messages: j.messages || [], mark: x });
      } catch {
        M({ anchor: x.anchor, messages: [], mark: x });
      }
      return;
    }
    M(null), v.openMain();
  }, [e, t, v.openMain]), Pe = L((x) => {
    var me;
    if (!e) return [];
    const j = Po(((me = globalThis.getSelection) == null ? void 0 : me.call(globalThis)) ?? null), V = k(x.target, x.clientX, x.clientY, j.element ? j.text : "");
    return V ? [{
      key: "ask",
      label: V.selection ? "问这段" : "在这里提问",
      hint: V.selection ? "?" : void 0,
      // 选着字时也出现在选字浮条上（「复制 · 收藏 · 提问」，ReaderSelectionLayer）。
      inSelectionBar: V.selection ? "提问" : void 0,
      onSelect: () => N(V)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        q(""), J(!0);
      }
    }] : [];
  }, [e, k, N]), ie = P ? {
    anchor: P.anchor,
    messages: P.messages,
    onClose: () => M(null),
    onDelete: e != null && e.threads && P.mark.threadId ? () => {
      e.threads.remove(t, P.mark.threadId).catch(() => {
      }), w.removeMark(P.mark.key), M(null);
    } : void 0
  } : null, le = W(() => f ? (x, j) => {
    f(x, j ?? void 0), requestAnimationFrame(() => d(x, "translated"));
  } : null, [f, d]), B = L((x) => Ya(o, x), [o]), [U, X] = _(0), de = L(({ mode: x, width: j }) => {
    X(x === "dock" ? Math.round(j) : 0);
  }, []), ne = !v.persistent || !!v.view.conversation || !!v.error, ae = e && (v.visible && ne || P) ? /* @__PURE__ */ p(da, { fallback: null, children: /* @__PURE__ */ p(
    Pm,
    {
      port: e,
      jobId: n,
      book: S,
      ask: v,
      legacy: ie,
      onShowSelection: ({ page: x, pane: j }) => l(x, j),
      onJumpToPage: (x) => l(x),
      pageCount: u,
      onLayout: de,
      dockTaken: y !== null,
      dockHost: I,
      onEditBlock: le,
      canEditBlock: B,
      attachTools: K,
      attachRequest: R
    }
  ) }) : null, Se = H || oe ? /* @__PURE__ */ C(_e, { children: [
    H ? /* @__PURE__ */ p(um, { onDone: (x) => void se(x), onCancel: Ee }) : null,
    oe ? /* @__PURE__ */ C("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => q(""), children: [
      "截图没成：",
      oe
    ] }) : null
  ] }) : null, ee = v.visible && ne || !!P, Y = v.close, fe = L(() => {
    if (ee) {
      M(null), Y();
      return;
    }
    v.openMain();
  }, [ee, Y, v.openMain]);
  return { marks: w.marks, onMark: ue, menuItems: Pe, panel: ae, overlay: Se, cropping: H, toggleCrop: re, open: v.openMain, toggle: fe, showing: ee, reserveRight: ee ? U : 0, enabled: !!e };
}
const xm = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Nm() {
  const e = nn(), t = W(() => {
    try {
      return Ye().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Mm({
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
    activePanel: e.activePanel,
    panelHost: e.panelHost
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: f, showing: d, reserveRight: m } = n, g = W(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Sa,
      pressed: d,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: Ei,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: h, height: y }) => /* @__PURE__ */ p(Vf, { marks: r, page: h, height: y, onOpen: o }) : void 0,
    shortcuts: xm,
    reserveRight: m,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, m, c, l]);
  return Pn(g), /* @__PURE__ */ C(_e, { children: [
    s,
    i
  ] });
}
const _m = { id: "ask", title: "提问", Component: Nm };
function Xn() {
  try {
    return Ye().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Am(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Lm(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Cm(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Dm({ documentId: e, jobId: t }) {
  const [n, r] = _([]), [o, a] = _(null);
  O(() => {
    r([]);
    const i = Xn();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = Lm(n, t, o);
  return W(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function $m({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = _(null), [s, i] = _(""), [c, l] = _(""), u = A(0);
  O(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = L((g) => {
    const h = Xn(), y = n.find((S) => S.versionId === g);
    if (!h || !y || !e) return;
    const I = ++u.current;
    i(g), l(""), (async () => {
      const S = Ye(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const w = await S.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), v = S.resolveReaderTranslatedPdfUrl(w.jobPayload, w.manifestPayload);
      if (!v) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: v, regions: Am(ha(w.regionsPayload)) };
    })().then((S) => {
      I === u.current && a(S);
    }).catch((S) => {
      I === u.current && l((S == null ? void 0 : S.message) || "这一份打不开。");
    }).finally(() => {
      I === u.current && i("");
    });
  }, [e, n]), d = L(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), m = L(async () => {
    var y, I;
    const g = Xn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (S) {
      l((S == null ? void 0 : S.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((I = globalThis.history) == null || I.replaceState(globalThis.history.state, "", Cm(h, o.jobId))), a(null);
  }, [o, e]);
  return W(() => ({
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
function Om(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: ki,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(pf, { compare: e, onDone: t })
  } : null;
}
function zm(e) {
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
function Fm() {
  var i;
  const e = nn(), t = $m({
    documentId: e.documentId,
    jobId: e.jobId,
    versions: e.translationVersions,
    readingVersionId: e.versionId || ""
  }), { visibleMode: n, setWorkspace: r } = e, o = ((i = t.compared) == null ? void 0 : i.url) || "";
  O(() => {
    o && n !== "compare" && r("compare");
  }, [o]);
  const a = t.clear;
  O(() => {
    n !== "compare" && a();
  }, [n, a]);
  const s = W(() => {
    const c = Om(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: zm(t) };
  }, [t]);
  return Pn(s), null;
}
const Bm = { id: "compare", title: "对比版本", Component: Fm }, ps = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], _o = { pen: 35e-4, highlighter: 0.018 }, Ao = 0.015, Yn = "retainpdf.reader.ink.v1:";
function Lo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Yn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function jm(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Yn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Yn + e);
    } catch {
    }
}
function Hm(e, t, n, r, o, a) {
  const s = Ao * Ao;
  return e.filter((i) => gs(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function gs(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Um(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Wm(e) {
  const [t, n] = _(null), [r, o] = _(ps[0].key), [a, s] = _(() => Lo(e)), i = A(a), c = A([]);
  O(() => {
    const h = Lo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = L((h) => {
    i.current = h, s(h), jm(e, h);
  }, [e]), u = L((h) => {
    const y = i.current, I = h(y);
    I !== y && (c.current = [...c.current.slice(-49), y], l(I));
  }, [l]), f = L((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = L((h) => {
    h.length && u((y) => y.filter((I) => !h.includes(I.id)));
  }, [u]), m = L((h) => {
    u((y) => y.some((I) => I.page === h) ? y.filter((I) => I.page !== h) : y);
  }, [u]), g = L(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return W(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const Km = [
  { tool: "pen", label: "画笔", Icon: hn },
  { tool: "highlighter", label: "荧光笔", Icon: Ri },
  { tool: "eraser", label: "橡皮", Icon: Pi }
];
function Vm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function qm({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ C(_e, { children: [
    Km.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      Q,
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
    ps.map((o) => /* @__PURE__ */ p(
      Q,
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
    /* @__PURE__ */ p(Q, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Mi, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      Q,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(xi, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      Q,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(gt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Co({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(qm, { ink: e, page: t, onPick: n }) });
}
function Jm(e) {
  const t = A(e);
  t.current = e, O(() => {
    const n = (r) => {
      if (Vm(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const Gm = "reader-ink-layer";
function Xm(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Do({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Xm(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Ym({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = _(null), i = A(!1), c = o.strokes.filter((h) => gs(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(Hm(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s([[y, I]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s((S) => S ? Um(S, y, I) : [[y, I]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: _o[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      className: Gm,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(Do, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Do, { stroke: { tool: o.tool, color: o.color, width: _o[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const Zm = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function Qm(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: hn,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ C("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
        /* @__PURE__ */ p(hn, { ...Re }),
        /* @__PURE__ */ p("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` } })
      ] }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p(Co, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(Co, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(Ym, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: Zm
  };
}
function eh() {
  const e = nn(), t = Wm(e.resetKey);
  Jm(t);
  const n = W(() => Qm(t), [t]);
  return Pn(n), null;
}
const th = { id: "ink", title: "画笔", Component: eh };
function nh(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
const rh = fa(() => import("./ReaderMarkdownPanel-D4_c1fQ-.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), bs = { id: "markdown", label: "Markdown", short: "MD", Icon: Ni, needsJob: !0 };
function oh() {
  const e = nn(), t = e.activePanel === bs.id;
  if (!nh(t)) return null;
  const r = /* @__PURE__ */ p(da, { fallback: null, children: /* @__PURE__ */ p(rh, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? zi(r, e.panelHost) : r;
}
const ah = {
  id: "markdown",
  title: "Markdown",
  Component: oh,
  panels: [bs]
}, ys = "reader-xref", Zn = "data-xref", jt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, sh = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${jt})`), ih = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Qn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function ch(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function lh(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function uh(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = $e(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function dh(e, t, n) {
  return (e.find((o) => $e(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function fh(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = $e(r), s = lh(r);
    if (a === "formula") {
      for (const g of s.matchAll(ih)) {
        const h = Qn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = sh.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = ch(i[1]), u = Qn(i[2]), f = uh(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: dh(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const mh = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${jt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${jt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${jt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${jt})\s*[）)]`, "g"), kind: () => "equation" }
];
function hh(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of mh) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Qn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function ph(e, t) {
  return hh(e, t).map((n) => ({ start: n.start, end: n.end, className: ys, attrs: { [Zn]: n.key } }));
}
const gh = { figure: "图", table: "表", equation: "式" };
function $o(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${gh[e.kind]} ${e.label}`;
}
const Oo = { figure: "图", table: "表", formula: "公式", text: "文字" }, nt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function bh(e, t, n) {
  const r = xt(e, t, n), o = r ? pt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = us({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function yh(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = xt(u, t, n), d = f ? pt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = us({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function vh(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function wh(e, t) {
  const n = (o) => {
    const a = $e(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Sh({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var $;
  const i = t.find((N) => N.itemId === e) ?? null, c = W(() => i ? wh(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = _(nt.indexOf(1)), d = nt[u], m = A(null), [g, h] = _(0);
  Ae(() => {
    const N = m.current;
    if (!N) return;
    const E = () => h(N.clientWidth);
    E();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(E) : null;
    return T == null || T.observe(N), () => T == null ? void 0 : T.disconnect();
  }, []);
  const y = L((N) => {
    const E = c[l + N];
    E && a(E.itemId);
  }, [c, l, a]);
  O(() => {
    const N = (E) => {
      if (E.key === "Escape")
        E.preventDefault(), s();
      else if (E.key === "ArrowLeft")
        E.preventDefault(), y(-1);
      else if (E.key === "ArrowRight")
        E.preventDefault(), y(1);
      else if (E.key === "+" || E.key === "=")
        E.preventDefault(), f((T) => Math.min(nt.length - 1, T + 1));
      else if (E.key === "-" || E.key === "_")
        E.preventDefault(), f((T) => Math.max(0, T - 1));
      else if (E.key === "0")
        E.preventDefault(), f(nt.indexOf(1));
      else
        return;
      E.stopPropagation();
    };
    return window.addEventListener("keydown", N, !0), () => window.removeEventListener("keydown", N, !0);
  }, [s, y]), O(() => {
    const N = m.current;
    if (!N) return;
    const E = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), f((R) => Math.max(0, Math.min(nt.length - 1, R + (T.deltaY < 0 ? 1 : -1)))));
    };
    return N.addEventListener("wheel", E, { passive: !1 }), () => N.removeEventListener("wheel", E);
  }, []);
  const I = A(null);
  if (!i) return null;
  const S = $e(i), b = o.map((N) => ({ pane: N, pdf: r[N] ?? null, where: bh(i, n, N) })).filter((N) => !!(N.pdf && N.where)), w = 16, v = typeof window > "u" ? 800 : window.innerHeight, P = Math.min(880, v * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), M = b.length ? vh(Math.max(120, (g - w * (b.length - 1) - 32) / b.length), P, b.map((N) => N.where.aspect)) : 0, k = (($ = b[0]) == null ? void 0 : $.where.page) ?? i.source.page;
  return /* @__PURE__ */ C("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${Oo[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ C("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ C("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ C("span", { className: "reader-zoom-title", children: [
          Oo[S] ?? "这一块",
          " · 第 ",
          k,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ C("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(pa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(Ia, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((N) => Math.max(0, N - 1)), children: /* @__PURE__ */ p(Ta, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ C(Q, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(nt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === nt.length - 1, onClick: () => f((N) => Math.min(nt.length - 1, N + 1)), children: /* @__PURE__ */ p(Ea, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(gt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (N) => {
            const E = m.current;
            !E || N.button !== 0 || (I.current = { x: N.clientX, y: N.clientY, left: E.scrollLeft, top: E.scrollTop }, E.setPointerCapture(N.pointerId));
          },
          onPointerMove: (N) => {
            const E = m.current, T = I.current;
            !E || !T || (E.scrollLeft = T.left - (N.clientX - T.x), E.scrollTop = T.top - (N.clientY - T.y));
          },
          onPointerUp: () => {
            I.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: w }, children: b.map(({ pane: N, pdf: E, where: T }) => /* @__PURE__ */ C("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: N === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              fs,
              {
                className: "reader-zoom-canvas",
                pdf: E,
                page: T.page,
                region: T.fraction,
                cssWidth: M * d,
                label: `${N === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, N)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Ih = 380, Th = 320, wt = 8;
function Eh(e, t, n) {
  const r = Math.max(wt, Math.min(e.left, n.width - t.width - wt)), o = e.bottom + wt, a = o + t.height <= n.height - wt ? o : Math.max(wt, e.top - wt - t.height);
  return { left: r, top: a };
}
function kh({
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
    const m = r[d], g = m ? yh(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Ih, Th / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = Eh(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ C("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ C("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: $o(e.target) }),
      /* @__PURE__ */ C("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(fs, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: $o(e.target) })
  ] });
}
const Rh = 250;
function Ph(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Mh(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function xh(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Nh({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = _(null), [s, i] = _({ back: [], forward: [] }), c = A(s);
  c.current = s;
  const l = A(null), u = A({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = L(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Ut(m, g);
  }, []);
  O(() => {
    if (!e) return;
    const m = (b) => {
      var w, v;
      return (v = (w = b.target) == null ? void 0 : w.closest) == null ? void 0 : v.call(w, `.${ys}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var M;
      const w = m(b);
      if (!w) return;
      const v = u.current.index.get(w.getAttribute(Zn) || "");
      if (!v) return;
      const P = ((M = w.closest("[data-reader-pane]")) == null ? void 0 : M.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const k = w.getBoundingClientRect();
        a({ target: v, pane: P, anchor: { left: k.left, top: k.top, right: k.right, bottom: k.bottom } });
      }, Rh);
    }, y = (b) => {
      const w = m(b);
      !w || w.contains(b.relatedTarget) || (g(), a(null));
    }, I = (b) => {
      var k, $;
      const w = m(b);
      if (!w || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((k = window.getSelection) == null ? void 0 : k.call(window)) || ""}`.trim()) return;
      const v = u.current.index.get(w.getAttribute(Zn) || "");
      if (!v) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const P = (($ = w.closest("[data-reader-pane]")) == null ? void 0 : $.getAttribute("data-reader-pane")) || u.current.primaryPane, M = f();
      M && i((N) => Ph(N, M)), u.current.follow(v, P);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", I, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", I, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = L((m) => {
    const g = f();
    if (!g) return !1;
    const h = Mh(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: I } = u.current;
    return Nt(y, h.to, "auto", I) ? (i(h.history), !0) : !1;
  }, [f]);
  return O(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || xh(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [d]), {
    preview: o,
    closePreview: L(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: L(() => d("back"), [d])
  };
}
const _h = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Ah() {
  const e = nn(), t = W(() => fh(e.regions), [e.regions]), { jumpToBlock: n } = e, r = L((s, i) => n(s.itemId, i), [n]), o = Nh({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = W(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => ph(s, t) : void 0,
    shortcuts: _h
  }), [t]);
  return Pn(a), /* @__PURE__ */ C(_e, { children: [
    o.preview ? /* @__PURE__ */ p(kh, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ C(Q, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(_i, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const Lh = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Ah }, Sr = [th, ah, Bm, Lh, _m];
function Ir(e = Sr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Ch(e) {
  const t = Fe(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(_e, { children: (e.tabs ?? Ir()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, f = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": d,
        "aria-pressed": u,
        title: f ? `${i} 需打开任务阅读` : i,
        disabled: f,
        onClick: () => u ? a() : o(s),
        children: /* @__PURE__ */ p(c, { className: "reader-close-home-icon", ...Re, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function Dh(e) {
  const t = Fe(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Ir().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
    key: c,
    label: l,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ C("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: d, badge: m, onClick: g }) => /* @__PURE__ */ C(
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
        children: /* @__PURE__ */ p(gt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function $h(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Oh(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function zh(e) {
  return e / 100 * window.innerHeight;
}
function Fh(e) {
  return e / 100 * window.innerWidth;
}
function Bh(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Ht({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Bh(n);
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
      r = Oh(t, o);
      break;
    }
    case "em": {
      r = $h(t, o);
      break;
    }
    case "vh": {
      r = zh(o);
      break;
    }
    case "vw": {
      r = Fh(o);
      break;
    }
  }
  return r;
}
function Ne(e) {
  return parseFloat(e.toFixed(3));
}
function _t({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function er(e) {
  const { panels: t } = e, n = _t({ group: e });
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
      const u = Ht({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Ne(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Ht({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ne(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Ht({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ne(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Ht({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = Ne(u / n * 100);
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
function he(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function tr(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? jh : Hh
  );
}
function jh(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Hh(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function vs(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function ws(e, t) {
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
function Uh({
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
    const { x: i, y: c } = ws(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return he(o, "No rect found"), o;
}
let ln;
function Wh() {
  return ln === void 0 && (typeof matchMedia == "function" ? ln = !!matchMedia("(pointer:coarse)").matches : ln = !1), ln;
}
function Ss(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = tr(
    n,
    Array.from(t.children).filter(vs).map((g) => ({ element: g }))
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
          (I) => I.element === h
        );
        if (y) {
          if (d) {
            const I = d.element.getBoundingClientRect(), S = h.getBoundingClientRect();
            let b;
            if (c) {
              const w = n === "horizontal" ? new DOMRect(
                I.right,
                I.top,
                0,
                I.height
              ) : new DOMRect(
                I.left,
                I.bottom,
                I.width,
                0
              ), v = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (m.length) {
                case 0: {
                  b = [
                    w,
                    v
                  ];
                  break;
                }
                case 1: {
                  const P = m[0], M = Uh({
                    orientation: n,
                    rects: [I, S],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  b = [
                    P,
                    M === I ? v : w
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
                  I.right,
                  S.top,
                  S.left - I.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  I.bottom,
                  S.width,
                  S.top - I.bottom
                )
              ];
            for (const w of b) {
              let v = "width" in w ? w : w.element.getBoundingClientRect();
              const P = Wh() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (v.width < P) {
                const k = P - v.width;
                v = new DOMRect(
                  v.x - k / 2,
                  v.y,
                  v.width + k,
                  v.height
                );
              }
              if (v.height < P) {
                const k = P - v.height;
                v = new DOMRect(
                  v.x,
                  v.y - k / 2,
                  v.width,
                  v.height + k
                );
              }
              const M = g <= l || g > u;
              !i && !M && s.push({
                group: e,
                groupSize: _t({ group: e }),
                panels: [d, y],
                separator: "width" in w ? void 0 : w,
                rect: v
              }), i = !1;
            }
          }
          c = !1, d = y, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (I) => I.element === h
        );
        y ? m.push(y) : (d = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var ot;
class Is {
  constructor() {
    Ur(this, ot, {});
  }
  addListener(t, n) {
    const r = Lt(this, ot)[t];
    return r === void 0 ? Lt(this, ot)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Lt(this, ot)[t];
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
    Wr(this, ot, {});
  }
  removeListener(t, n) {
    const r = Lt(this, ot)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
ot = new WeakMap();
let Rt = {
  cursorFlags: 0,
  state: "inactive"
};
const Tr = new Is();
function ft() {
  return Rt;
}
function Kh(e) {
  return Tr.addListener("change", e);
}
function Vh(e) {
  const t = Rt, n = { ...Rt };
  n.cursorFlags = e, Rt = n, Tr.emit("change", {
    prev: t,
    next: n
  });
}
function Pt(e) {
  const t = Rt;
  Rt = e, Tr.emit("change", {
    prev: t,
    next: e
  });
}
const qh = (e) => e, zn = () => {
}, Ts = 1, Es = 2, ks = 4, Rs = 8, zo = 3, Fo = 12;
let un;
function Bo() {
  return un === void 0 && (un = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (un = !0)), un;
}
function Jh({
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
        if (e && Bo()) {
          const a = (e & Ts) !== 0, s = (e & Es) !== 0, i = (e & ks) !== 0, c = (e & Rs) !== 0;
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
    return Bo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const jo = /* @__PURE__ */ new WeakMap();
function Er(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = jo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = ft();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Jh({
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
  jo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let He = /* @__PURE__ */ new Map();
const Ps = new Is();
function Gh(e) {
  He = new Map(He), He.delete(e);
}
function Ho(e, t) {
  for (const [n] of He)
    if (n.id === e)
      return n;
}
function st(e, t) {
  for (const [n, r] of He)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function bt() {
  return He;
}
function kr(e, t) {
  return Ps.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Xe(e, t, n) {
  const r = He.get(e);
  He = new Map(He), He.set(e, t), Ps.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Ms(e) {
  const t = ft();
  let n = !1;
  switch (t.state) {
    case "active":
      Pt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Er(e), n = !0, t.hitRegions.forEach((r) => {
        const o = st(r.group.id, !0);
        Xe(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Uo(e) {
  e.defaultPrevented || Ms(e.currentTarget);
}
function Xh(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = ws(n, a.rect);
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
function Yh(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Zh(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Vo(e),
    b: Vo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  he(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Ko(Wo(n.a)),
    b: Ko(Wo(n.b))
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
const Qh = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function ep(e) {
  const t = getComputedStyle(xs(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function tp(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || ep(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Qh.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Wo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (he(n, "Missing node"), tp(n)) return n;
  }
  return null;
}
function Ko(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Vo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = xs(e);
  return t;
}
function xs(e) {
  const { parentNode: t } = e;
  return Yh(t) ? t.host : t;
}
function np(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function rp({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!vs(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Zh(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (np(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Rr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Ss(o), s = Xh(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && rp({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function op(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Me(e, t, n = 0) {
  return Math.abs(Ne(e) - Ne(t)) <= n;
}
function je(e, t) {
  return Me(e, t) ? 0 : e > t ? 1 : -1;
}
function Et({
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
  if (je(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      je(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Ne(r), r;
}
function Gt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Me(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  he(u != null, "Invalid first pivot index"), he(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, y = n[h];
        he(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: I = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const w = i[h];
          if (he(
            w != null,
            `Previous layout not found for panel index ${h}`
          ), Me(w, I)) {
            const v = b - w;
            je(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      {
        const h = e < 0 ? u : f, y = n[h];
        he(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: I = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const w = i[h];
          if (he(
            w != null,
            `Previous layout not found for panel index ${h}`
          ), Me(w, b)) {
            const v = w - I;
            je(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, y = n[h];
      he(
        y,
        `Panel constraints not found for index ${h}`
      );
      const I = i[h], { collapsible: S, collapsedSize: b, minSize: w } = y;
      if (S && je(I, w) < 0)
        if (e > 0) {
          const v = w - b, P = v / 2, M = I + e;
          je(M, w) < 0 && (e = je(e, P) <= 0 ? 0 : v);
        } else {
          const v = w - b, P = 100 - v / 2, M = I - e;
          je(M, w) < 0 && (e = je(100 + e, P) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, I = 0;
    for (; ; ) {
      const b = i[y];
      he(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const w = Et({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (I += w, y += h, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(I));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? u : f;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), I = i[h];
      he(
        I != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = I - y, b = Et({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: I,
        size: S
      });
      if (!Me(I, b) && (d += I - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (op(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    he(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const I = y + d, S = Et({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: I
    });
    if (l[h] = S, !Me(S, I)) {
      let b = I - S, w = e < 0 ? f : u;
      for (; w >= 0 && w < n.length; ) {
        const v = l[w];
        he(
          v != null,
          `Previous layout not found for panel index ${w}`
        );
        const P = v + b, M = Et({
          overrideDisabledPanels: s,
          panelConstraints: n[w],
          prevSize: v,
          size: P
        });
        if (Me(v, M) || (b -= M - v, l[w] = M), Me(b, 0))
          break;
        e > 0 ? w-- : w++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!Me(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, I) => (h[g[I]] = y, h), {});
}
function mt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || je(e[n], t[n]) !== 0)
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
  if (!Me(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      he(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    he(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    he(l != null, `No layout data found for index ${i}`);
    const u = Et({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!Me(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      he(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = Et({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Me(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function Ns({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = bt();
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
    if (h && c < d && (g || l.slice(0, m).every((y, I) => {
      const S = f[I];
      return (S == null ? void 0 : S.collapsible) && Me(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = l.slice(0, m).reduce((I, S) => I + u[S.id], 0);
      return {
        ...u,
        [t]: Ne(100 - y)
      };
    }
    return Gt({
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
    }), I = ht({
      layout: y,
      panelConstraints: f
    });
    mt(g, I) || Xe(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: m,
      layout: I,
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
      return c && Me(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = _t({ group: l }), d = Ht({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ne(d / f * 100);
      i(m);
    }
  };
}
function qo(e) {
  if (e.defaultPrevented)
    return;
  const t = bt();
  Rr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Ns({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function dn(e) {
  const t = bt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function _s({
  groupId: e
}) {
  const t = () => {
    const n = bt();
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
      return r ? i : (mt(i, l) || Xe(a, {
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
  const n = dn(e), r = st(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  he(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  he(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = _s({ groupId: n.id }).getLayout(), c = Gt({
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
  mt(i, l) || Xe(
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
function Jo(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = dn(t);
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
        const r = dn(t), o = st(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        he(c, "Matching separator not found");
        const l = i.get(c);
        he(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (he(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], m = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ct(t, m - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = dn(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        he(o !== null, "Index not found");
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
function Go(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = bt(), n = Rr(e, t), r = /* @__PURE__ */ new Map();
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
function As({
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
    const y = r.get(u), I = o.get(u);
    if (!y || !I)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: b,
      groupSize: w,
      layout: v,
      separatorToPanels: P
    } = I;
    if (b && v && P) {
      const M = Gt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((k) => m.indexOf(k)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (mt(M, v)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Ts : Es;
              break;
            }
            case "vertical": {
              i |= h < 0 ? ks : Rs;
              break;
            }
          }
      } else
        Xe(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: w,
          layout: M,
          separatorToPanels: P
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & zo : c |= i & zo, t.movementY === 0 ? c |= s & Fo : c |= i & Fo, Vh(c), Er(e);
}
function Xo(e) {
  const t = bt(), n = ft();
  switch (n.state) {
    case "active":
      As({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Yo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = ft(), n = bt();
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
          Xe(a.group, s, {
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
      As({
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
      const a = Rr(e, n);
      a.length === 0 ? t.state !== "inactive" && Pt({
        cursorFlags: 0,
        state: "inactive"
      }) : Pt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Er(e.currentTarget);
      break;
    }
  }
}
function Zo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (ft().state) {
      case "hover":
        Pt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Qo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Ms(e.currentTarget) && e.preventDefault();
}
function ea(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Ne(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Ne((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function ap(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = _t({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Ne(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function sp(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function ip({
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
        const m = d / 100 * n, g = Ne(
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
      u[f] = Ne(
        d / a * l
      );
    }
  else {
    const f = Ne(
      l / c.length
    );
    for (const d of c)
      u[d] = f;
  }
  return u;
}
function cp(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const St = /* @__PURE__ */ new Map();
function lp(e) {
  let t = !0;
  he(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: I } = h;
      if (I === e.element) {
        if (t) {
          const S = _t({ group: e });
          if (S === 0)
            return;
          const b = st(e.id);
          if (!b)
            return;
          const w = er(e), v = b.defaultLayoutDeferred ? ea(w) : b.layout, P = ip({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: v
          }), M = ht({
            layout: P,
            panelConstraints: w
          });
          if (!b.defaultLayoutDeferred && mt(b.layout, M) && sp(
            b.derivedPanelConstraints,
            w
          ) && b.groupSize === S)
            return;
          Xe(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: w,
            groupSize: S,
            layout: M,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        ap(e, I, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    he(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = _t({ group: e }), i = er(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (cp(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? ea(i), f = ht({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  St.set(
    d,
    (St.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Ss(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Xe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    he(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Jo);
  }), St.get(d) === 1 && (d.addEventListener("contextmenu", Uo, !0), d.addEventListener("dblclick", qo, !0), d.addEventListener("pointerdown", Go, !0), d.addEventListener("pointerleave", Xo), d.addEventListener("pointermove", Yo), d.addEventListener("pointerout", Zo), d.addEventListener("pointerup", Qo, !0)), function() {
    t = !1, St.set(
      d,
      Math.max(0, (St.get(d) ?? 0) - 1)
    ), Gh(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Jo);
    }), St.get(d) || (d.removeEventListener(
      "contextmenu",
      Uo,
      !0
    ), d.removeEventListener(
      "dblclick",
      qo,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Go,
      !0
    ), d.removeEventListener("pointerleave", Xo), d.removeEventListener("pointermove", Yo), d.removeEventListener("pointerout", Zo), d.removeEventListener("pointerup", Qo, !0)), a.disconnect();
  };
}
function up() {
  const [e, t] = _({}), n = L(() => t({}), []);
  return [e, n];
}
function Pr(e) {
  const t = ma();
  return `${e ?? t}`;
}
const yt = typeof window < "u" ? Ae : O;
function Wt(e) {
  const t = A(e);
  return yt(() => {
    t.current = e;
  }, [e]), L(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Mr(...e) {
  return Wt((t) => {
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
function xr(e) {
  const t = A({ ...e });
  return yt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Ls = Qt(null);
function dp(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: qh
  });
  lr(t, () => n.current, []), yt(() => {
    Object.assign(
      n.current,
      _s({ groupId: e })
    );
  });
}
function Cs({
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
  const g = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Wt((E) => {
    mt(g.current.onLayoutChange, E) || (g.current.onLayoutChange = E, c == null || c(E));
  }), y = Wt(
    (E, T) => {
      mt(g.current.onLayoutChanged, E) || (g.current.onLayoutChanged = E, l == null || l(E, { isUserInteraction: T }));
    }
  ), I = Pr(i), S = A(null), [b, w] = up(), v = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), P = Mr(S, a);
  dp(I, s);
  const M = Wt(
    (E, T) => {
      const R = ft(), D = Ho(E), z = st(E);
      if (z) {
        let K = !1;
        switch (R.state) {
          case "active": {
            K = R.hitRegions.some(
              (H) => H.group === D
            );
            break;
          }
        }
        return {
          flexGrow: z.layout[T] ?? 1,
          pointerEvents: K ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), k = xr({
    defaultLayout: n,
    disableCursor: r
  }), $ = W(
    () => ({
      get disableCursor() {
        return !!k.disableCursor;
      },
      getPanelStyles: M,
      id: I,
      orientation: u,
      registerPanel: (E) => {
        const T = v.current;
        return T.panels = tr(u, [
          ...T.panels,
          E
        ]), w(), () => {
          T.panels = T.panels.filter(
            (R) => R !== E
          ), w();
        };
      },
      registerSeparator: (E) => {
        const T = v.current;
        return T.separators = tr(u, [
          ...T.separators,
          E
        ]), w(), () => {
          T.separators = T.separators.filter(
            (R) => R !== E
          ), w();
        };
      },
      updatePanelProps: (E, { disabled: T }) => {
        const R = v.current.panels.find(
          (K) => K.id === E
        );
        R && (R.panelConstraints.disabled = T);
        const D = Ho(I), z = st(I);
        D && z && Xe(D, {
          ...z,
          derivedPanelConstraints: er(D)
        });
      },
      updateSeparatorProps: (E, {
        disabled: T,
        disableDoubleClick: R
      }) => {
        const D = v.current.separators.find(
          (z) => z.id === E
        );
        D && (D.disabled = T, D.disableDoubleClick = R);
      }
    }),
    [M, I, w, u, k]
  ), N = A(null);
  return yt(() => {
    const E = S.current;
    if (E === null)
      return;
    const T = v.current;
    let R;
    if (k.defaultLayout !== void 0 && Object.keys(k.defaultLayout).length === T.panels.length) {
      R = {};
      for (const q of T.panels) {
        const se = k.defaultLayout[q.id];
        se !== void 0 && (R[q.id] = se);
      }
    }
    const D = {
      disabled: !!o,
      element: E,
      id: I,
      mutableState: {
        defaultLayout: R,
        disableCursor: !!k.disableCursor,
        expandedPanelSizes: v.current.lastExpandedPanelSizes,
        layouts: v.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    N.current = D;
    const z = lp(D), { defaultLayoutDeferred: K, derivedPanelConstraints: H, layout: J } = st(D.id, !0);
    !K && H.length > 0 && (h(J), y(J, !1));
    const oe = kr(I, (q) => {
      const { defaultLayoutDeferred: se, derivedPanelConstraints: Ee, layout: re } = q.next;
      if (se || Ee.length === 0)
        return;
      const ue = D.panels.map(({ id: ie }) => ie).join(",");
      D.mutableState.layouts[ue] = re, Ee.forEach((ie) => {
        if (ie.collapsible) {
          const { layout: le } = q.prev ?? {};
          if (le) {
            const B = Me(
              ie.collapsedSize,
              re[ie.panelId]
            ), U = Me(
              ie.collapsedSize,
              le[ie.panelId]
            );
            B && !U && (D.mutableState.expandedPanelSizes[ie.panelId] = le[ie.panelId]);
          }
        }
      });
      const Pe = ft().state !== "active";
      h(re), Pe && y(re, q.isUserInteraction);
    });
    return () => {
      N.current = null, z(), oe();
    };
  }, [
    o,
    I,
    y,
    h,
    u,
    b,
    k
  ]), O(() => {
    const E = N.current;
    E && (E.mutableState.defaultLayout = n, E.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Ls.Provider, { value: $, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": I,
      id: I,
      ref: P,
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
Cs.displayName = "Group";
function Nr() {
  const e = ut(Ls);
  return he(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function fp(e, t) {
  const { id: n } = Nr(), r = A({
    collapse: zn,
    expand: zn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: zn
  });
  lr(t, () => r.current, []), yt(() => {
    Object.assign(
      r.current,
      Ns({ groupId: n, panelId: e })
    );
  });
}
function nr({
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
  const h = !!c, y = Pr(c), I = xr({
    disabled: a
  }), S = A(null), b = Mr(S, s), {
    getPanelStyles: w,
    id: v,
    orientation: P,
    registerPanel: M,
    updatePanelProps: k
  } = Nr(), $ = f !== null, N = Wt(
    (D, z, K) => {
      f == null || f(D, c, K);
    }
  );
  yt(() => {
    const D = S.current;
    if (D !== null) {
      const z = {
        element: D,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: $ ? N : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: I.disabled,
          maxSize: l,
          minSize: u
        }
      };
      return M(z);
    }
  }, [
    i,
    n,
    r,
    o,
    $,
    y,
    h,
    l,
    u,
    N,
    M,
    I
  ]), O(() => {
    k(y, { disabled: a });
  }, [a, y, k]), fp(y, d);
  const E = () => {
    const D = w(v, y);
    if (D)
      return JSON.stringify(D);
  }, T = En(
    (D) => kr(v, D),
    E,
    E
  );
  let R;
  return T ? R = JSON.parse(T) : o !== void 0 ? R = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : R = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...mp,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...R
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
            touchAction: P === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
nr.displayName = "Panel";
const mp = {
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
function hp({
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
      layout: Gt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = ht({
      layout: Gt({
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
function Ds({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = Pr(a), l = xr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = _({}), [d, m] = _("inactive"), [g, h] = _(!1), y = A(null), I = Mr(y, o), {
    disableCursor: S,
    id: b,
    orientation: w,
    registerSeparator: v,
    updateSeparatorProps: P
  } = Nr(), M = w === "horizontal" ? "vertical" : "horizontal";
  yt(() => {
    const N = y.current;
    if (N !== null) {
      const E = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: N,
        id: c
      }, T = v(E), R = Kh(
        (z) => {
          m(
            z.next.state !== "inactive" && z.next.hitRegions.some(
              (K) => K.separator === E
            ) ? z.next.state : "inactive"
          );
        }
      ), D = kr(
        b,
        (z) => {
          const { derivedPanelConstraints: K, layout: H, separatorToPanels: J } = z.next, oe = J.get(E);
          if (oe) {
            const q = oe[0], se = oe.indexOf(q);
            f(
              hp({
                layout: H,
                panelConstraints: K,
                panelId: q.id,
                panelIndex: se
              })
            );
          }
        }
      );
      return () => {
        R(), D(), T();
      };
    }
  }, [b, c, v, l]), O(() => {
    P(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, P]);
  let k;
  n && !S && (k = "not-allowed");
  let $;
  if (n)
    $ = "disabled";
  else
    switch (d) {
      case "active": {
        $ = "active";
        break;
      }
      default:
        g ? $ = "focus" : $ = d;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": M,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": $,
      "data-testid": c,
      id: c,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: I,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: k,
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
Ds.displayName = "Separator";
const _r = 30, Ar = 65, Xt = 50, pp = 100 - Ar, gp = 100 - _r;
function bp(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Ar, Math.max(_r, t)) : Xt;
}
function Lr(e) {
  return 100 - e;
}
function It(e) {
  return `${e}%`;
}
const Cr = "reader-document", Yt = "reader-assistant", $s = "retainpdf.reader.ai-split-layout.v1", yp = {
  [Cr]: Lr(Xt),
  [Yt]: Xt
};
function Dr(e) {
  const t = bp(e == null ? void 0 : e[Yt]);
  return {
    [Cr]: Lr(t),
    [Yt]: t
  };
}
function vp() {
  try {
    const e = JSON.parse(localStorage.getItem($s) || "null");
    return Dr(e);
  } catch {
    return yp;
  }
}
function wp(e) {
  try {
    localStorage.setItem($s, JSON.stringify(Dr(e)));
  } catch {
  }
}
function Fn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Dr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Yt]}vw`
  );
}
function Sp() {
  const e = A(null), [t] = _(vp);
  Ae(() => {
    const o = e.current;
    return Fn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = L((o) => {
    Fn(e.current, o);
  }, []), r = L((o, a) => {
    Fn(e.current, o), a.isUserInteraction && wp(o);
  }, []);
  return /* @__PURE__ */ C(
    Cs,
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
          nr,
          {
            id: Cr,
            defaultSize: It(Lr(Xt)),
            minSize: It(pp),
            maxSize: It(gp)
          }
        ),
        /* @__PURE__ */ p(
          Ds,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          nr,
          {
            id: Yt,
            defaultSize: It(Xt),
            minSize: It(_r),
            maxSize: It(Ar)
          }
        )
      ]
    }
  );
}
function Ip({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = _(!1);
  if (O(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ C("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ C("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ p(Q, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function Tp({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Ip, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ C(_e, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ C("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ C("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(Q, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Ep(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function kp() {
  const [e, t] = _(!1), n = ma(), r = A(null), o = ls(), a = W(() => [...iu, ...Ff(o)], [o]);
  return O(() => {
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
  }, [e]), O(() => {
    const s = (i) => {
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Ep(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ C("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ p(Ai, { ...Re, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ C(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ C("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ C("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: s.title }),
            /* @__PURE__ */ p("ul", { children: s.items.map((i) => /* @__PURE__ */ C("li", { children: [
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
const Rp = ["source", "sideBySide", "translated"], Pp = { source: "", translated: "", sideBySide: "" };
function Mp(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = mn(e.sourceUrl), n = mn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Qi({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function xp(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = W(
    () => e ? Mp(e) : Pp,
    [e]
  ), o = W(
    () => Rp.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = L(async (s) => {
    if (!e) return;
    const i = mn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Zi(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ec(
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
        tc(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Np = {
  source: ya,
  sideBySide: va,
  translated: wa
}, _p = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Ap(e) {
  const t = Fe(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = xp(n), i = A(null);
  return O(() => {
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
  }, []), /* @__PURE__ */ C("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ C("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(Li, { ...Re, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = ni[c], u = mn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : ri(c, r), g = Np[c];
      return /* @__PURE__ */ C(
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
            /* @__PURE__ */ p(g, { ...Re, "aria-hidden": !0 }),
            /* @__PURE__ */ C("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ C("span", { className: "reader-download-action-label", children: [
                _p[c],
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
const Lp = "retainpdf:reader:bookmarks:v1:", Cp = 200;
function $r() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Os(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Lp}${t}` : "";
}
function Dp(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Kt(e, t = $r()) {
  const n = Os(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Dp(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const rr = /* @__PURE__ */ new Set();
function $p(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return rr.add(n), () => {
    rr.delete(n);
  };
}
function or(e, t, n) {
  const r = Os(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Cp);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...rr]) a(e);
  return o;
}
function Op(e, t, n = "", { storage: r = $r(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Kt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? or(e, a.filter((i) => i.page !== s), r) : or(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function zp(e, t, n = $r()) {
  return or(e, Kt(e, n).filter((r) => r.page !== t), n);
}
function Fp(e, t) {
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
function zs(e, t) {
  const [n, r] = _(() => Kt(e));
  O(() => (r(Kt(e)), $p(e, () => r(Kt(e)))), [e]);
  const o = L((s) => {
    r(Op(e, s, Fp(t, s)));
  }, [e, t]), a = L((s) => r(zp(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
const Bp = "retainpdf:reader:favorites:v1:", jp = 500, Or = 2e3;
function zr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Fs(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Bp}${t}` : "";
}
function Hp(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page)), r = `${t.text || ""}`.trim().slice(0, Or), o = `${t.id || ""}`.trim();
  return !o || !r || !Number.isFinite(n) || n < 1 ? null : { id: o, text: r, page: n, pane: t.pane === "translated" ? "translated" : "source", createdAt: `${t.createdAt || ""}` };
}
function Mt(e, t = zr()) {
  const n = Fs(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Set(), a = [];
    for (const s of Array.isArray(r) ? r : []) {
      const i = Hp(s);
      i && !o.has(i.id) && (o.add(i.id), a.push(i));
    }
    return a;
  } catch {
    return [];
  }
}
const ar = /* @__PURE__ */ new Set();
function Up(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return ar.add(n), () => {
    ar.delete(n);
  };
}
function Bs(e, t, n) {
  const r = Fs(e), o = t.slice(0, jp);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...ar]) a(e);
  return o;
}
function Fr(e, t, n) {
  const r = `${t || ""}`.trim().slice(0, Or);
  return e.find((o) => o.page === n && o.text === r) ?? null;
}
function js(e, t, { storage: n = zr(), now: r = () => (/* @__PURE__ */ new Date()).toISOString(), makeId: o = Kp } = {}) {
  const a = Mt(e, n), s = `${t.text || ""}`.trim().slice(0, Or), i = Math.floor(Number(t.page));
  return !s || !Number.isFinite(i) || i < 1 || Fr(a, s, i) ? a : Bs(e, [{ id: o(), text: s, page: i, pane: t.pane === "translated" ? "translated" : "source", createdAt: r() }, ...a], n);
}
function Wp(e, t, n = zr()) {
  return Bs(e, Mt(e, n).filter((r) => r.id !== t), n);
}
function Kp() {
  var e;
  try {
    if ((e = globalThis.crypto) != null && e.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function Hs(e) {
  const [t, n] = _(() => Mt(e));
  O(() => (n(Mt(e)), Up(e, () => n(Mt(e)))), [e]);
  const r = L(
    (a) => n(js(e, a)),
    [e]
  ), o = L((a) => n(Wp(e, a)), [e]);
  return { favorites: t, add: r, remove: o };
}
function Vp({ filled: e }) {
  return /* @__PURE__ */ p(Ci, { ...Re, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function qp({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = zs(e, r);
  if (!e || n <= 0) return null;
  const s = Math.min(Math.max(t, 1), n), i = o.some((c) => c.page === s);
  return /* @__PURE__ */ C("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-mark${i ? " is-marked" : ""}`,
        "aria-pressed": i,
        "aria-label": i ? `取消第 ${s} 页的书签` : `给第 ${s} 页加书签`,
        title: i ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）",
        onClick: () => a(s),
        children: /* @__PURE__ */ p(Vp, { filled: i })
      }
    ),
    /* @__PURE__ */ p(Jp, { scope: e })
  ] });
}
function Jp({ scope: e }) {
  var c;
  const [t, n] = _(!1), r = A(null), { favorites: o, remove: a } = Hs(e), s = (c = Fe()) == null ? void 0 : c.goToPage;
  O(() => {
    if (!t) return;
    const l = (f) => {
      var d;
      (d = r.current) != null && d.contains(f.target) || n(!1);
    }, u = (f) => {
      f.key === "Escape" && n(!1);
    };
    return document.addEventListener("pointerdown", l, !0), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", l, !0), document.removeEventListener("keydown", u);
    };
  }, [t]);
  const i = o.length;
  return /* @__PURE__ */ C("span", { className: "reader-favorites", ref: r, children: [
    /* @__PURE__ */ p(
      Q,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": t,
        "aria-haspopup": "dialog",
        "aria-label": i ? `收藏（${i} 段）` : "收藏",
        title: i ? `收藏的段落（${i} 段）` : "收藏：书页上选一段字，点浮条上的「收藏」",
        onClick: () => n((l) => !l),
        children: /* @__PURE__ */ p(ka, { ...Re, fill: i ? "currentColor" : "none", "aria-hidden": !0 })
      }
    ),
    t ? /* @__PURE__ */ C("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ C("strong", { children: [
        "收藏",
        i ? /* @__PURE__ */ p("span", { className: "reader-favorites-count", children: i }) : null
      ] }),
      i ? /* @__PURE__ */ p("ul", { className: "reader-favorites-list", children: o.map((l) => /* @__PURE__ */ C("li", { children: [
        /* @__PURE__ */ C(
          Q,
          {
            className: "reader-favorites-jump",
            title: `翻到第 ${l.page} 页`,
            onClick: () => {
              s == null || s(l.page, l.pane), n(!1);
            },
            children: [
              /* @__PURE__ */ p("span", { className: "reader-favorites-text", children: l.text }),
              /* @__PURE__ */ C("span", { className: "reader-favorites-page", children: [
                "p.",
                l.page,
                l.pane === "translated" ? " · 译文" : ""
              ] })
            ]
          }
        ),
        /* @__PURE__ */ p(
          Q,
          {
            className: "reader-favorites-remove",
            "aria-label": `删掉第 ${l.page} 页这段收藏`,
            title: "删掉",
            onClick: () => a(l.id),
            children: /* @__PURE__ */ p(gt, { size: 13, "aria-hidden": !0 })
          }
        )
      ] }, l.id)) }) : /* @__PURE__ */ p("p", { children: "还没有收藏。在书页上选一段字，点浮条上的「收藏」（或右键「收藏这段」），就收在这里，随时翻回来。" })
    ] }) : null
  ] });
}
function Gp(e) {
  const t = Fe(), n = yr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? tn, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = jc(a), f = a > Ca + 1e-3, d = a < wn - 1e-3, m = Tt(r, kt()), g = m >= wn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, y] = _(!1), [I, S] = _(`${i}`);
  O(() => {
    h || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const w = Number(`${I}`.trim());
    l(Sn(w, c));
  };
  return /* @__PURE__ */ C("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ C("div", { className: "reader-bottombar-start", children: [
      e.startSlot,
      e.bookmarkScope ? /* @__PURE__ */ p(
        qp,
        {
          scope: e.bookmarkScope,
          currentPage: i,
          numPages: c,
          regions: t == null ? void 0 : t.regions
        }
      ) : null,
      e.leftSlot
    ] }),
    /* @__PURE__ */ C("div", { className: "reader-bottombar-center", children: [
      o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ C(
        "form",
        {
          className: "reader-react-hud-page-form",
          onSubmit: (w) => {
            w.preventDefault(), b();
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
                value: I,
                autoFocus: !0,
                onChange: (w) => S(w.target.value.replace(/[^\d]/g, "")),
                onBlur: b,
                onKeyDown: (w) => {
                  w.key === "Escape" && (w.preventDefault(), y(!1), S(`${i}`));
                }
              }
            ),
            /* @__PURE__ */ C("span", { className: "reader-react-hud-page-suffix", children: [
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
            !l || c <= 0 || (S(`${i}`), y(!0));
          },
          children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
        }
      ) }),
      e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
      t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
        Q,
        {
          className: "reader-react-hud-btn reader-react-hud-doc-dark",
          "aria-pressed": t.docDark ? "true" : "false",
          "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
          title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
          onClick: t.toggleDocDark,
          children: /* @__PURE__ */ p(Di, { ...Re, "aria-hidden": !0 })
        }
      ) }) : null,
      /* @__PURE__ */ C("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
        /* @__PURE__ */ p(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "缩小",
            disabled: !f,
            onClick: () => s(Jt(a, -1)),
            children: /* @__PURE__ */ p(Ta, { ...Re, "aria-hidden": !0 })
          }
        ),
        /* @__PURE__ */ C(
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
            onClick: () => s(Jt(a, 1)),
            children: /* @__PURE__ */ p(Ea, { ...Re, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ C("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(kp, {}) })
    ] })
  ] });
}
function ta(e) {
  var t, n;
  return Fa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Xp(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: ta(Ue(e))
  }));
  O(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: ta(Ue(e))
    });
  }, [e]), O(() => {
    t.scope === e && kn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = L((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const sr = "download-toast";
function Yp({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ C("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ C("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Zp(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    jn.dismiss(sr);
    return;
  }
  jn.custom(
    () => /* @__PURE__ */ p(Yp, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: sr, duration: 1 / 0 }
  );
}
function Qp() {
  const e = L((t) => {
    t && (t.setState = Zp, t.hide = () => jn.dismiss(sr));
  }, []);
  return /* @__PURE__ */ C(_e, { children: [
    /* @__PURE__ */ p(hi, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const na = { itemId: null, origin: null };
function eg() {
  let e = na;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? na : { itemId: n, origin: r };
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
const ra = ["ask"];
function tg(e) {
  const t = (n) => {
    const r = ra.indexOf(n.id);
    return r < 0 ? ra.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function ir({
  place: e,
  active: t = null,
  extensions: n = Sr
}) {
  const r = e === "side" ? tg(n) : n, [o, a] = _(null), s = ls(), i = (d) => {
    var m;
    return (((m = s.find((g) => g.id === d)) == null ? void 0 : m.contribution.toolbarItems) ?? []).filter((g) => (g.place ?? "side") === e);
  }, c = () => a(null), l = (() => {
    if (!o) return null;
    for (const { id: d } of r)
      for (const m of i(d)) {
        if (`${d}:${m.key}:popup` === o && m.popup) return m.popup(c);
        if (`${d}:${m.key}:dropdown` === o && m.dropdown) return m.dropdown(c);
      }
    return null;
  })(), u = A(null);
  O(() => {
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
    const m = i(d.id), g = e === "side" ? Ir([d]) : [];
    return !m.length && !g.length ? null : /* @__PURE__ */ C(Tn, { children: [
      m.map((h) => {
        const y = `${d.id}:${h.key}`, I = h.Icon;
        return /* @__PURE__ */ C("span", { className: "reader-bar-tool-group", "data-has-dropdown": h.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ p(
            Q,
            {
              className: e === "compare" ? "reader-bar-tool reader-bar-tool-compare" : "reader-bar-tool",
              "aria-label": h.label,
              title: h.title || h.label,
              "aria-pressed": !!h.pressed || o === `${y}:popup`,
              "aria-expanded": h.popup ? o === `${y}:popup` : void 0,
              "data-bar-tool": h.key,
              onClick: () => {
                var S;
                if (h.popup) {
                  a((b) => b === `${y}:popup` ? null : `${y}:popup`);
                  return;
                }
                (S = h.onClick) == null || S.call(h), c();
              },
              children: e === "compare" ? /* @__PURE__ */ p(pn, { ...ao, "aria-hidden": !0 }) : h.mark ?? /* @__PURE__ */ p(I, { ...Re, "aria-hidden": !0 })
            }
          ),
          h.dropdown ? /* @__PURE__ */ p(
            Q,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${h.label}：选项`,
              title: `${h.label}的选项`,
              "aria-expanded": o === `${y}:dropdown`,
              "data-bar-tool-caret": h.key,
              onClick: () => a((S) => S === `${y}:dropdown` ? null : `${y}:dropdown`),
              children: /* @__PURE__ */ p(pn, { ...ao, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(Ch, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ C("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "side" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const oa = { search: "搜索", bookmarks: "书签", issues: "待改" }, ng = [];
function rg({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ C("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ C(Q, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(Ra, { ...Re, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function og({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  pinned: c = !1,
  bookmarkPane: l,
  issuesPane: u,
  issueCount: f = 0
}) {
  var M;
  const d = ((M = Fe()) == null ? void 0 : M.regions) ?? ng, m = W(() => $u(d, s), [d, s]), [g, h] = _(-1);
  O(() => h(-1), [s]);
  const y = A(null), I = A(null), S = A(n);
  S.current = n, O(() => {
    if (c) return;
    const k = (N) => {
      var T, R;
      const E = N.target;
      !E || (T = I.current) != null && T.contains(E) || (R = E.closest) != null && R.call(E, ".reader-finder-toggles, [data-finder-toggle]") || S.current();
    }, $ = (N) => {
      N.key === "Escape" && S.current();
    };
    return document.addEventListener("pointerdown", k, !0), document.addEventListener("keydown", $), () => {
      document.removeEventListener("pointerdown", k, !0), document.removeEventListener("keydown", $);
    };
  }, [c]);
  const b = A(null);
  O(() => {
    var k;
    e === "search" && ((k = y.current) == null || k.focus());
  }, [e, i]), O(() => {
    var k, $, N;
    e === "search" && g >= 0 && ((N = ($ = (k = b.current) == null ? void 0 : k.querySelector('[aria-current="true"]')) == null ? void 0 : $.scrollIntoView) == null || N.call($, { block: "nearest" }));
  }, [e, g]);
  const w = (k) => {
    const $ = m[k];
    $ && (h(k), r($.itemId));
  }, v = ["search", ...l ? ["bookmarks"] : [], ...u ? ["issues"] : []], P = v.includes(e) ? e : "search";
  return /* @__PURE__ */ C("aside", { ref: I, className: "reader-finder", "data-finder-tab": P, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${oa[P]}`, children: [
    /* @__PURE__ */ C("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: v.map((k) => /* @__PURE__ */ C(Q, { className: "reader-finder-tab", role: "tab", "aria-selected": P === k, onClick: () => t(k), children: [
        oa[k],
        k === "issues" && f ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, k)) }),
      /* @__PURE__ */ p(Q, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(gt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    P === "bookmarks" ? l : P === "issues" ? u : null,
    P !== "search" ? null : /* @__PURE__ */ C(_e, { children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          dr,
          {
            ref: y,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "搜原文或译文（⌘F）",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (k) => a(k.target.value),
            onKeyDown: (k) => {
              k.key === "Enter" ? (k.preventDefault(), w(Ou(g, m.length, k.shiftKey))) : k.key === "Escape" && (k.preventDefault(), c ? k.currentTarget.blur() : n()), k.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: m.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${m.length >= 200 ? "200+ 处，只列前 200 处" : `${m.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { ref: b, className: "reader-finder-list", children: m.map((k, $) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(Q, { className: "reader-finder-entry is-hit", "aria-current": $ === g ? "true" : void 0, onClick: () => w($), children: [
        /* @__PURE__ */ C("span", { className: "reader-finder-entry-text", children: [
          k.snippet.slice(0, k.at),
          /* @__PURE__ */ p("mark", { children: k.snippet.slice(k.at, k.at + k.length) }),
          k.snippet.slice(k.at + k.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: k.page })
      ] }) }, k.itemId)) })
    ] })
  ] });
}
function Us(e, t = []) {
  for (const n of e)
    t.push(n), Us(n.children, t);
  return t;
}
const ag = 24, zt = 28, aa = 15;
function Ws(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function sg(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: Us(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function ig(e, t) {
  let n = null, r = null, o = !1;
  for (const a of e) {
    const s = (i, c) => {
      if (i.page === null || i.page > t) return;
      const l = !c && o && (r == null ? void 0 : r.id) === a.id;
      (!r || i.page > (r.page ?? 0) || i.page === r.page && l) && (r = i, o = c, n = a.id);
    };
    s(a, !0);
    for (const i of a.children) s(i, !1);
  }
  return { chapterId: n, nodeId: (r == null ? void 0 : r.id) ?? null };
}
function cg(e, t) {
  const n = Ws(e) > ag, r = Math.max(1, Math.ceil(e.length / zt)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= zt) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(zt / 2)), o.length - zt);
  return o.slice(s, s + zt);
}
function lg(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const ug = [];
function sa({ bookmarks: e, onJumpPage: t, onJumpBlock: n, pinned: r = !1, docked: o = !1, onPinChange: a }) {
  var N, E;
  const s = ((N = Fe()) == null ? void 0 : N.regions) ?? ug, i = ((E = yr()) == null ? void 0 : E.currentPage) ?? 1, c = W(() => sg(e, Lu(s)), [e, s]), l = W(() => ig(c, i), [c, i]), u = W(() => cg(c, l), [c, l]), f = Ws(c), [d, m] = _(""), g = W(() => lg(c, d), [c, d]), [h, y] = _(() => /* @__PURE__ */ new Set()), I = A(null), S = A(!1), b = () => {
    l.chapterId && !h.has(l.chapterId) && y((T) => new Set(T).add(l.chapterId)), S.current = !0;
  };
  if (O(() => {
    (r || o) && b();
  }, [r, o]), Ae(() => {
    var T, R, D;
    S.current && (S.current = !1, (D = (R = (T = I.current) == null ? void 0 : T.querySelector('[aria-current="location"]')) == null ? void 0 : R.scrollIntoView) == null || D.call(R, { block: "center" }));
  }), !c.length) return null;
  const w = (T) => y((R) => {
    const D = new Set(R);
    return D.has(T) ? D.delete(T) : D.add(T), D;
  }), v = (T, R) => {
    y((D) => D.has(R) ? D : new Set(D).add(R)), T.itemId ? n(T.itemId) : T.page !== null && t(T.page);
  }, P = !!d.trim(), M = (T, R) => /* @__PURE__ */ C(
    Q,
    {
      className: "reader-toc-entry",
      "data-depth": Math.min(T.depth, 3),
      "aria-current": T.id === l.nodeId ? "location" : void 0,
      disabled: !T.itemId && T.page === null,
      title: T.page === null ? "这条书签没有指到页" : `${T.title}（第 ${T.page} 页）`,
      onClick: () => v(T, R),
      children: [
        /* @__PURE__ */ p("span", { className: "reader-toc-title", children: T.title }),
        T.page !== null ? /* @__PURE__ */ C("span", { className: "reader-toc-page", children: [
          "p.",
          T.page
        ] }) : null
      ]
    }
  ), k = r ? "取消固定" : "固定在左边", $ = /* @__PURE__ */ C(_e, { children: [
    /* @__PURE__ */ C("div", { className: "reader-toc-head", children: [
      /* @__PURE__ */ p("span", { className: "reader-toc-head-title", children: "目录" }),
      /* @__PURE__ */ p(Q, { className: "reader-toc-pin", "aria-label": k, title: k, "aria-pressed": r, onClick: () => a == null ? void 0 : a(!r), children: r ? /* @__PURE__ */ p($i, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(ba, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) })
    ] }),
    f > aa ? /* @__PURE__ */ C("div", { className: "reader-toc-filter", children: [
      /* @__PURE__ */ p(Ra, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ p(
        dr,
        {
          size: "sm",
          className: "reader-toc-filter-input",
          value: d,
          placeholder: "过滤章节标题或节号…",
          "aria-label": "过滤目录",
          onChange: (T) => m(T.target.value),
          onKeyDown: (T) => {
            T.stopPropagation(), T.key === "Escape" && (d ? m("") : (T.currentTarget.blur(), r && !o && (a == null || a(!1))));
          }
        }
      ),
      d ? /* @__PURE__ */ p(Q, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => m(""), children: /* @__PURE__ */ p(gt, { size: 12, "aria-hidden": !0 }) }) : null
    ] }) : null,
    /* @__PURE__ */ p("div", { className: "reader-toc-list", ref: I, children: g.length ? g.map((T) => {
      const R = P || h.has(T.id);
      return /* @__PURE__ */ C("div", { className: "reader-toc-chapter", children: [
        /* @__PURE__ */ C("div", { className: "reader-toc-chapter-row", children: [
          T.children.length ? /* @__PURE__ */ p(
            Q,
            {
              className: "reader-toc-caret",
              "aria-expanded": R,
              "aria-label": `${R ? "收起" : "展开"}「${T.title}」`,
              onClick: () => w(T.id),
              children: R ? /* @__PURE__ */ p(pn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(Ia, { size: 12, "aria-hidden": !0 })
            }
          ) : /* @__PURE__ */ p("span", { className: "reader-toc-caret-space" }),
          M(T, T.id)
        ] }),
        R ? T.children.map((D) => /* @__PURE__ */ p("div", { children: M(D, T.id) }, D.id)) : null
      ] }, T.id);
    }) : /* @__PURE__ */ p("p", { className: "reader-toc-empty", children: "没有匹配的章节" }) })
  ] });
  return o ? /* @__PURE__ */ p("nav", { className: "reader-toc-dock", "aria-label": "目录", children: $ }) : /* @__PURE__ */ C(
    "nav",
    {
      className: "reader-toc-minimap",
      "aria-label": "目录",
      "data-pinned": r ? "true" : void 0,
      onPointerEnter: r ? void 0 : b,
      onKeyDown: (T) => {
        r && T.key === "Escape" && (a == null || a(!1));
      },
      onFocus: (T) => {
        !r && !T.currentTarget.contains(T.relatedTarget) && b();
      },
      children: [
        /* @__PURE__ */ p("div", { className: "reader-toc-bars", tabIndex: 0, "aria-label": `目录，${f} 条（移上去或按 Tab 展开）`, children: u.map((T) => /* @__PURE__ */ p("span", { className: "reader-toc-bar", "data-kind": T.kind, "data-state": T.state || void 0, "aria-hidden": !0 }, T.id)) }),
        /* @__PURE__ */ p("div", { className: "reader-toc-card", "data-compact": f <= aa ? "true" : void 0, children: $ })
      ]
    }
  );
}
function dg({ active: e }) {
  return /* @__PURE__ */ C("div", { className: "reader-side-rail", role: "toolbar", "aria-orientation": "vertical", "aria-label": "面板和下载", children: [
    /* @__PURE__ */ p(ir, { place: "side", active: e }),
    /* @__PURE__ */ p("span", { className: "reader-side-rail-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(Ap, {})
  ] });
}
const In = ".textLayer", ia = 8, fg = 34, mg = 56;
function cr(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function fn(e = ((t) => (t = globalThis.getSelection) == null ? void 0 : t.call(globalThis))() ?? null) {
  var s, i;
  if (!e || e.isCollapsed || !e.rangeCount) return null;
  const n = e.getRangeAt(0), r = ((s = cr(n.startContainer)) == null ? void 0 : s.closest(In)) ?? ((i = cr(n.endContainer)) == null ? void 0 : i.closest(In));
  if (!r) return null;
  const o = hs(`${e}`);
  if (!o) return null;
  const a = r.closest(`[${Te}]`);
  return {
    text: o,
    page: Math.max(1, Number(a == null ? void 0 : a.getAttribute(Te)) || 1),
    pane: (a == null ? void 0 : a.getAttribute(we)) === "translated" ? "translated" : "source",
    layer: r
  };
}
async function Ks(e) {
  var t, n;
  try {
    if ((n = (t = globalThis.navigator) == null ? void 0 : t.clipboard) != null && n.writeText)
      return await globalThis.navigator.clipboard.writeText(e), !0;
  } catch {
  }
  try {
    return document.execCommand("copy");
  } catch {
    return !1;
  }
}
const Vs = typeof navigator < "u" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
function hg(e) {
  const t = fn();
  if (!t) return [];
  const n = [{ key: "copy", label: "复制", hint: Vs ? "⌘C" : "Ctrl+C", onSelect: () => {
    Ks(t.text);
  } }];
  if (e) {
    const r = Fr(Mt(e), t.text, t.page);
    n.push({
      key: "favorite",
      label: r ? "已收藏（在左下角「收藏」里）" : "收藏这段",
      onSelect: () => {
        js(e, t);
      }
    });
  }
  return n;
}
function pg(e) {
  return [...e.querySelectorAll("span")].filter((t) => !t.classList.contains("markedContent") && !t.querySelector("span"));
}
function gg(e) {
  let t = 0, n = null;
  return e.map((r) => {
    const o = r.getBoundingClientRect(), a = o.top + o.height / 2;
    return n && Math.abs(a - n.center) > Math.max(o.height, n.height) / 2 && (t += 1), n = { center: a, height: o.height || (n == null ? void 0 : n.height) || 0 }, { text: r.textContent || "", line: t };
  });
}
function bg(e) {
  const t = [], n = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  for (let r = n.nextNode(); r; r = n.nextNode()) t.push(r);
  return t;
}
function ca(e, t) {
  const n = cr(e), r = n == null ? void 0 : n.closest(In), o = n == null ? void 0 : n.closest("span");
  if (!r || !o) return null;
  const a = pg(r), s = a.indexOf(o);
  if (s < 0) return null;
  const i = Math.max(0, s - 60), c = a.slice(i, Math.min(a.length, s + 61)), l = nm(gg(c), s - i);
  if (!l) return null;
  const u = bg(c[t === "start" ? l[0] : l[1]]);
  return u.length ? t === "start" ? { node: u[0], offset: 0 } : { node: u[u.length - 1], offset: u[u.length - 1].length } : null;
}
function yg(e) {
  if (!e || e.isCollapsed || !e.rangeCount) return !1;
  const t = e.getRangeAt(0), n = ca(t.startContainer, "start"), r = ca(t.endContainer, "end");
  if (!n && !r) return !1;
  const o = t.cloneRange();
  return n && t.comparePoint(n.node, n.offset) <= 0 && o.setStart(n.node, n.offset), r && t.comparePoint(r.node, r.offset) >= 0 && o.setEnd(r.node, r.offset), o.compareBoundaryPoints(Range.START_TO_START, t) === 0 && o.compareBoundaryPoints(Range.END_TO_END, t) === 0 ? !1 : (e.removeAllRanges(), e.addRange(o), !0);
}
function vg(e) {
  var s;
  if (!e || e.isCollapsed || !e.rangeCount) return [];
  const t = e.getRangeAt(0), n = t.commonAncestorContainer, r = n.nodeType === 3 ? [n] : (() => {
    const i = [], c = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let l = c.nextNode(); l; l = c.nextNode()) t.intersectsNode(l) && i.push(l);
    return i;
  })(), o = [], a = /* @__PURE__ */ new Map();
  for (const i of r) {
    const c = (s = i.parentElement) == null ? void 0 : s.closest(In);
    if (!c) continue;
    const l = c.closest(`.${en}`) ?? c;
    let u = a.get(l);
    u || (u = l.getBoundingClientRect(), a.set(l, u));
    const f = document.createRange();
    if (f.selectNodeContents(i), i === t.startContainer && f.setStart(i, t.startOffset), i === t.endContainer && f.setEnd(i, t.endOffset), !!f.toString().trim())
      for (const d of f.getClientRects()) {
        const m = Math.max(d.left, u.left), g = Math.min(d.right, u.right);
        g - m > 0.5 && o.push({ left: m, top: d.top, right: g, bottom: d.bottom });
      }
  }
  return rm(o);
}
function wg({ scope: e, menuItemsAt: t }) {
  const n = A(null), r = A(!1), o = A(!1), a = A(0), s = A(t);
  s.current = t;
  const [i, c] = _(null), l = A(null), u = L(() => {
    var P;
    a.current = 0;
    const d = n.current;
    if (!d) return;
    const m = ((P = globalThis.getSelection) == null ? void 0 : P.call(globalThis)) ?? null, g = vg(m), h = d.getBoundingClientRect();
    for (; d.children.length > g.length; ) d.lastElementChild.remove();
    if (g.forEach((M, k) => {
      const $ = d.children[k] ?? d.appendChild(document.createElement("div"));
      $.className = "reader-selection-band", $.style.left = `${M.left - h.left}px`, $.style.top = `${M.top - h.top}px`, $.style.width = `${M.right - M.left}px`, $.style.height = `${M.bottom - M.top}px`;
    }), !r.current) return;
    const y = fn(m);
    if (!y || !g.length) {
      r.current = !1, c(null);
      return;
    }
    const I = g[0], S = g[g.length - 1], b = (Math.min(...g.map((M) => M.left)) + Math.max(...g.map((M) => M.right))) / 2 - h.left, w = I.top - h.top - ia - fg, v = w >= mg ? w : S.bottom - h.top + ia;
    c((M) => {
      var E;
      const k = M && M.text === y.text ? M.actions : s.current({
        target: y.layer,
        clientX: (I.left + I.right) / 2,
        clientY: (I.top + I.bottom) / 2,
        page: y.page
      }).filter((T) => T.inSelectionBar), $ = ((E = l.current) == null ? void 0 : E.offsetWidth) || 220, N = Math.min(Math.max(b, $ / 2 + 8), h.width - $ / 2 - 8);
      return M && M.text === y.text && Math.abs(M.left - N) < 0.5 && Math.abs(M.top - v) < 0.5 ? M : { left: N, top: v, text: y.text, page: y.page, pane: y.pane, actions: k };
    });
  }, []), f = L(() => {
    a.current || (a.current = requestAnimationFrame(u));
  }, [u]);
  return O(() => {
    const d = n.current, m = d == null ? void 0 : d.parentElement, g = d == null ? void 0 : d.closest(`.${Na}`);
    if (!d || !m) return;
    const h = () => {
      g && delete g.dataset.selectPane;
    }, y = (w) => {
      var M, k, $;
      const v = w.target;
      if (v && ((M = l.current) != null && M.contains(v))) return;
      r.current = !1, c(null);
      const P = ($ = (k = v == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `[${Te}][${we}]`)) == null ? void 0 : $.getAttribute(we);
      o.current = !!P && w.button === 0, g && P && w.button === 0 && (g.dataset.selectPane = P);
    }, I = (w) => {
      var M;
      h();
      const v = o.current;
      if (o.current = !1, w.button !== 0 || !v) return;
      const P = ((M = globalThis.getSelection) == null ? void 0 : M.call(globalThis)) ?? null;
      fn(P) && (yg(P), r.current = !0, f());
    }, S = (w) => {
      const v = fn();
      !v || !w.clipboardData || (w.clipboardData.setData("text/plain", v.text), w.preventDefault());
    }, b = (w) => {
      w.key === "Escape" && r.current && (r.current = !1, c(null));
    };
    return m.addEventListener("pointerdown", y, !0), window.addEventListener("pointerup", I), window.addEventListener("pointercancel", h), document.addEventListener("selectionchange", f), document.addEventListener("copy", S), document.addEventListener("keydown", b), m.addEventListener("scroll", f, { capture: !0, passive: !0 }), window.addEventListener("resize", f), () => {
      h(), a.current && cancelAnimationFrame(a.current), m.removeEventListener("pointerdown", y, !0), window.removeEventListener("pointerup", I), window.removeEventListener("pointercancel", h), document.removeEventListener("selectionchange", f), document.removeEventListener("copy", S), document.removeEventListener("keydown", b), m.removeEventListener("scroll", f, { capture: !0 }), window.removeEventListener("resize", f);
    };
  }, [f]), /* @__PURE__ */ C(_e, { children: [
    /* @__PURE__ */ p("div", { className: "reader-selection-paint", ref: n, "aria-hidden": "true" }),
    i ? /* @__PURE__ */ p(
      Sg,
      {
        ref: l,
        bar: i,
        scope: e,
        onDone: () => {
          r.current = !1, c(null);
        }
      }
    ) : null
  ] });
}
function Sg({ bar: e, scope: t, onDone: n, ref: r }) {
  const { favorites: o, add: a } = Hs(t), s = !!t && !!Fr(o, e.text, e.page), [i, c] = _(!1);
  return O(() => {
    if (!i) return;
    const l = setTimeout(() => c(!1), 1200);
    return () => clearTimeout(l);
  }, [i]), /* @__PURE__ */ C(
    "div",
    {
      ref: r,
      className: "reader-selection-bar",
      role: "toolbar",
      "aria-label": "选中的字",
      style: { left: e.left, top: e.top },
      onPointerDown: (l) => l.preventDefault(),
      children: [
        /* @__PURE__ */ C(
          Q,
          {
            className: "reader-selection-action",
            title: Vs ? "复制（⌘C）" : "复制（Ctrl+C）",
            onClick: () => {
              Ks(e.text).then((l) => c(l));
            },
            children: [
              i ? /* @__PURE__ */ p(ur, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(ga, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: i ? "已复制" : "复制" })
            ]
          }
        ),
        t ? /* @__PURE__ */ C(
          Q,
          {
            className: "reader-selection-action",
            "aria-pressed": s,
            title: s ? "已收藏，在左下角「收藏」（星）里" : "收藏这段，在左下角「收藏」（星）里翻回来",
            onClick: () => {
              s || a({ text: e.text, page: e.page, pane: e.pane });
            },
            children: [
              /* @__PURE__ */ p(ka, { size: 14, strokeWidth: 1.75, fill: s ? "currentColor" : "none", "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: s ? "已收藏" : "收藏" })
            ]
          }
        ) : null,
        e.actions.map((l) => /* @__PURE__ */ C(
          Q,
          {
            className: "reader-selection-action",
            title: l.hint ? `${l.label}（${l.hint}）` : l.label,
            onClick: () => {
              n(), l.onSelect();
            },
            children: [
              /* @__PURE__ */ p(Sa, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: l.inSelectionBar })
            ]
          },
          l.key
        ))
      ]
    }
  );
}
function Ig(e) {
  const [t, n] = _([]);
  return O(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Ye().loadIssues;
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
function Tg(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Eg = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, kg = ["failed", "content", "layout"];
function Rg(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Pg(e, t, n) {
  const r = Ig(e), [o, a] = _(-1);
  O(() => a(-1), [r]);
  const s = L((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = A({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, O(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || Rg(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = Tg(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function Mg(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function xg(e) {
  var r;
  if (e.shiftKey || Mg(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Aa}`))) return null;
  const n = Number((r = t.closest(`[${Te}]`)) == null ? void 0 : r.getAttribute(Te)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Ng({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = A(null);
  if (O(() => {
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
  return /* @__PURE__ */ C("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ C(
      Q,
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
    r.map((c) => /* @__PURE__ */ p(Tn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function _g({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ C("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      Q,
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
const qs = "retainpdf:reader:doc-theme:v1", la = "data-reader-doc";
function Js() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ag(e = Js()) {
  try {
    return (e == null ? void 0 : e.getItem(qs)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Lg(e, t = Js()) {
  try {
    t == null || t.setItem(qs, e);
  } catch {
  }
}
function ua(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(la, "dark") : t.removeAttribute(la));
}
function Cg() {
  const [e, t] = _(() => Ag());
  O(() => {
    ua(e);
  }, [e]), O(() => () => ua("light"), []);
  const n = L(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Lg(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function Dg({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = zs(e, t);
  return a.length ? /* @__PURE__ */ p("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ C("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ C(
      Q,
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
    /* @__PURE__ */ p(Q, { className: "reader-bookmark-remove", "aria-label": `删除第 ${i.page} 页的书签`, title: "删除这个书签", onClick: () => s(i.page), children: "×" })
  ] }, i.page)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: "还没有书签。左下角的书签按钮给眼下这一页加一个。" });
}
function $g({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ C("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    kg.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ C("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ C("h4", { children: [
          Eg[o],
          /* @__PURE__ */ p("span", { children: a.length })
        ] }),
        /* @__PURE__ */ p("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(Q, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
          /* @__PURE__ */ p("span", { className: "reader-issues-title", children: s.title }),
          /* @__PURE__ */ C("span", { className: "reader-issues-page", children: [
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
function Og({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: f } = e, d = Fe(), m = yr(), g = (m == null ? void 0 : m.currentPage) ?? 1, h = n.issues.length;
  return /* @__PURE__ */ p(_e, { children: r ? /* @__PURE__ */ p(
    og,
    {
      tab: r,
      onTab: o,
      onClose: () => o(null),
      onJump: l,
      query: a,
      onQuery: s,
      term: i,
      focusSignal: c,
      pinned: f,
      bookmarkPane: t ? /* @__PURE__ */ p(
        Dg,
        {
          scope: t,
          regions: d == null ? void 0 : d.regions,
          currentPage: g,
          numPages: (m == null ? void 0 : m.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: h ? /* @__PURE__ */ p($g, { nav: n }) : void 0,
      issueCount: h
    }
  ) : null });
}
function zg({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(_e, { children: n ? /* @__PURE__ */ p(
    Sh,
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
function Fg(e) {
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
const Bg = 720;
function jg(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Bg;
}
function Hg(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Ug(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = _(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Fg({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = Vl({
    hasOverlayContent: s,
    connection: e.liveTranslation.connection,
    showSource: i.showSource,
    liveTranslationVisible: o,
    assistantOpen: t
  }), l = i.sourceViewOnly, u = i.visibleMode;
  O(() => {
    a(!1);
  }, [e.viewStateKey]), O(() => {
    e.session.jobTerminal && a(!1);
  }, [e.session.jobTerminal]);
  const f = A(null);
  return O(() => {
    f.current !== e.viewStateKey && Gl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function Wg(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = ql(e.liveTranslation), i = L(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = _(null);
  O(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && Xl({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), f = W(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
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
function Kg() {
  const [e] = _(Af), t = Hf(e), n = Of(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function Vg(e, t, n) {
  const r = A(e);
  O(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function qg(e, t, {
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
  const { session: m, panes: g } = e, h = A(e.currentPage);
  h.current = e.currentPage;
  const y = L(() => h.current, []), I = W(() => ({
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
  ]), { contributionStore: S, contributions: b, reserveRight: w } = t, v = W(() => Lf(b), [b]), P = W(() => zf(b), [b]), M = W(() => $f(b), [b]), k = W(() => Cf(b), [b]), $ = Df(b);
  return { readerApi: I, contributionStore: S, contributions: b, pageLayers: v, compareVersion: P, textMarks: M, menuSections: k, pointerTakenId: $, reserveRight: w };
}
function Jg() {
  try {
    return Ye().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Gg = "这本书正在处理（翻译或排版），处理完才能改。", Xg = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Yg({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Jg(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = Bu(s), l = !t || Vt(t), u = Vu(n), [f, d] = _(""), [m, g] = _(null), [h, y] = _(() => /* @__PURE__ */ new Map()), [I, S] = _(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, w] = _(() => /* @__PURE__ */ new Map()), [v, P] = _({ phase: "idle" }), M = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  O(() => {
    g(null), M.drafts.clear(), M.generation.current = null, w(/* @__PURE__ */ new Map()), P({ phase: "idle" });
  }, [s]), O(() => {
    if (d(""), !i || c || !a) return;
    let z = !1;
    return a.resolveOwnerJobId(s).then((K) => {
      z || d(`${K || s}`.trim() || s);
    }).catch(() => {
      z || d(s);
    }), () => {
      z = !0;
    };
  }, [i, c, a, s]), O(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let z = !1;
    return a.fetchRevisions(f).then((K) => {
      z || y(qu(K, u));
    }).catch(() => {
    }), () => {
      z = !0;
    };
  }, [a, f, u, l]);
  const k = v.phase === "running" && v.seenActive;
  O(() => {
    if (v.phase === "running") {
      if (!l) {
        k || P({ phase: "running", seenActive: !0 });
        return;
      }
      k && P(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [v.phase, k, l, t]);
  const $ = W(() => {
    const z = new Map(h);
    if (I.renderedAt === u)
      for (const [K, H] of I.edits) z.set(K, H);
    return z;
  }, [h, I, u]), N = L((z) => {
    const K = `${z || ""}`.trim();
    K && g({ itemId: K, page: ju(K) });
  }, []), E = L(() => g(null), []), T = L((z, K) => {
    S((H) => {
      const J = new Map(H.renderedAt === u ? H.edits : []);
      return J.set(z, K), { renderedAt: u, edits: J };
    }), w((H) => new Map(H).set(z, (H.get(z) || 0) + 1));
  }, [u]), R = L(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      P({ phase: "submitting" });
      try {
        await a.rerender(s), P({ phase: "running", seenActive: !1 }), await o();
      } catch (z) {
        P({ phase: "failed", message: (z == null ? void 0 : z.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), D = c ? Xg : !l || v.phase === "running" || v.phase === "submitting" ? Gg : "";
  return W(() => ({
    available: i,
    blockedReason: D,
    port: a,
    ownerJobId: f,
    target: m,
    select: N,
    close: E,
    memory: M,
    pendingEdits: $,
    savedCounts: b,
    markSaved: T,
    rerender: v,
    startRerender: R
  }), [i, D, a, f, m, N, E, M, $, b, T, v, R]);
}
function Zg(e, t) {
  O(() => {
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
function Qg(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Yg({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = L((d, m) => {
    Ya(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  Zg(a.available ? u : null, n);
  const f = W(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const eb = "reader-finder-input";
function tb(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function nb(e, t = typeof window > "u" ? null : window) {
  O(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!tb(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(eb) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const Gs = "retainpdf.reader.sidebar.v1", rb = ["search", "bookmarks", "issues"], ob = 900;
function ab() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(Gs)) || "{}");
    return { tab: rb.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function sb(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(Gs, JSON.stringify(e));
  } catch {
  }
}
function ib() {
  const e = `(min-width: ${ob}px)`, [t, n] = _(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
  return O(() => {
    var a;
    if (typeof window > "u" || !window.matchMedia) return;
    const r = window.matchMedia(e), o = () => n(r.matches);
    return o(), (a = r.addEventListener) == null || a.call(r, "change", o), () => {
      var s;
      return (s = r.removeEventListener) == null ? void 0 : s.call(r, "change", o);
    };
  }, [e]), t;
}
function cb(e) {
  const [t] = _(ab), [n, r] = _(null), [o, a] = _(t.tab), i = ib(), c = L((v) => {
    r(v), v && a(v);
  }, []);
  O(() => {
    sb({ tab: n || o });
  }, [n, o]);
  const l = L(() => r((v) => v ? null : o), [o]), u = L((v) => {
    r((P) => P === v ? null : v), a(v);
  }, []), [f, d] = _(""), [m, g] = _("");
  O(() => {
    const v = f.replace(/\s+/gu, " ").trim(), P = window.setTimeout(() => g(v), v ? 150 : 0);
    return () => window.clearTimeout(P);
  }, [f]);
  const [h, y] = _(0), I = L(() => {
    c("search"), y((v) => v + 1);
  }, [c]);
  nb(I);
  const S = L(() => {
    i || r(null);
  }, [i]), b = L((v) => {
    e.jumpToAnchor({ block_id: v }), S();
  }, [e.jumpToAnchor, S]), w = L((v) => {
    e.goToPage(v), S();
  }, [e.goToPage, S]);
  return {
    finder: n,
    setFinder: c,
    toggleFinder: u,
    toggleSidebar: l,
    pinned: i,
    findQuery: f,
    setFindQuery: d,
    findTerm: m,
    findFocus: h,
    jumpFromFinder: b,
    jumpToPageFromFinder: w
  };
}
function lb(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : $a(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function ub(e, t) {
  return t === null || e !== t;
}
function db(e, t) {
  const { boot: n } = e, r = A(null), o = A(null);
  O(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Ue(e.viewStateKey), s = lb({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: kt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      ub(e.mode, o.current) && (o.current = null, kn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const fb = [];
function mb(e) {
  const { sessionFiles: t } = e, [n, r] = _({}), o = A({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = L((y, I) => {
    r((S) => ({ ...S, [I]: { url: o.current[I], nodes: y } }));
  }, []), s = W(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const I = n.translated;
    return I && I.url === t.translatedUrl && I.nodes.length ? I.nodes : fb;
  }, [n, t.sourceUrl, t.translatedUrl]), i = A({}), [c, l] = _(0), u = L((y, I) => {
    i.current[I] = { url: o.current[I], pdf: y }, l((S) => S + 1);
  }, []), [f, d] = _(null), m = L((y) => d(y), []), g = L(() => d(null), []);
  O(() => d(null), [e.viewStateKey]);
  const h = W(() => {
    const y = (I, S) => {
      const b = i.current[I];
      return b && b.url === S ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
function hb() {
  const e = au(), { boot: t, panes: n, session: r } = e, o = Xp(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = Kg(), { reserveRight: l } = c, u = i || l > 0, f = cb(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, [h, y] = _(!1), I = h && f.pinned, S = L(() => {
    s(null);
  }, []);
  Vg(l, a, S);
  const { liveTranslationVisible: b, setLiveTranslationVisible: w, paneComposition: v, liveToggles: P, sourceViewOnly: M, visiblePdfMode: k } = Ug(
    e,
    i,
    jg(e.shell.shellWidth, u || g || I)
  );
  db(e, M);
  const $ = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: N, toggleDocDark: E } = Cg();
  fu({
    toggleDocDark: E,
    mode: k,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const { latestLivePage: T, jumpToLatestLivePage: R, offerCompletion: D, setCompletionDismissedKey: z, sourcePaneAction: K } = Wg(e, {
    liveTranslationVisible: b,
    setLiveTranslationVisible: w,
    liveToggles: P,
    sourceViewOnly: M,
    visiblePdfMode: k
  }), H = L((ye) => {
    const F = Hg(ye, e.liveTranslationAvailable);
    F !== null && w(F), e.setModeKeepingPage(ye);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), J = L((ye) => {
    s(ye);
  }, []), [oe] = _(eg), q = L((ye) => e.jumpToAnchor({ block_id: ye }), [e.jumpToAnchor]), se = Pg(e.sourceOnly ? "" : r.jobId, e.currentPage, q), [Ee, re] = _(null), ue = L((ye, F) => e.jumpToAnchor({ block_id: ye }, F), [e.jumpToAnchor]), { bookmarks: Pe, onPdfOutline: ie, onPdfDocument: le, zoomItem: B, setZoomItem: U, zoomBlock: X, closeZoom: de, zoomDocuments: ne } = mb(e), { blockEdit: ae, editBlock: Se, revisedBlocks: ee } = Qg(e, k, oe), [Y, fe] = _(null), x = L(() => fe(null), []), j = Dm({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: V,
    contributionStore: me,
    contributions: be,
    pageLayers: Ie,
    compareVersion: xe,
    textMarks: Oe,
    menuSections: Be,
    pointerTakenId: Ze
  } = qg(e, c, {
    translationVersions: j,
    bookmarks: Pe,
    regionHover: oe,
    assistantPanel: a,
    closeAssistant: S,
    visiblePdfMode: k,
    changeWorkspace: H,
    jumpToBlockIn: ue,
    zoomDocuments: ne,
    editBlock: ae.available && !ae.blockedReason ? Se : null,
    panelHost: Ee
  }), Le = !!Ze, [We, Qe] = _([]), et = W(() => ({
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
    regionHover: oe,
    jumpToBlock: q,
    revisedBlocks: ee,
    onPdfOutline: ie,
    onPdfDocument: le,
    zoomBlock: X,
    textMarks: Oe,
    pageLayers: Ie,
    editBlock: ae.available ? Se : void 0,
    blockEdit: ae,
    editShowsSource: k !== "compare",
    findTerm: d === "search" ? m : "",
    compareVersion: xe,
    pointerTaken: Le,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: M,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: J, close: S },
    docDark: N,
    toggleDocDark: E
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
    oe,
    q,
    ee,
    ie,
    le,
    X,
    Oe,
    Ie,
    ae,
    Se,
    k,
    d,
    m,
    xe,
    Le,
    e.sourceOnly,
    M,
    e.download,
    e.goToPage,
    J,
    S,
    N,
    E
  ]), vt = W(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), tt = [
    Na,
    `is-workspace-${$}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    I ? "is-toc-docked" : "",
    v.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Bf, { api: V, store: me, children: /* @__PURE__ */ p(Bd, { value: et, hud: vt, children: /* @__PURE__ */ C(
    "div",
    {
      className: tt,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": $,
      "data-pointer-taken": Ze || void 0,
      onContextMenu: (ye) => {
        const F = xg(ye);
        if (!F) return;
        const Z = [
          ...hg(e.viewStateKey),
          ...So(be, { target: ye.target, clientX: ye.clientX, clientY: ye.clientY, page: F.page })
        ];
        !Z.length && !Be.length || (ye.preventDefault(), Qe(Z), fe(F));
      },
      children: [
        /* @__PURE__ */ C("div", { className: "reader-workspace", children: [
          I ? /* @__PURE__ */ p(sa, { bookmarks: Pe, onJumpPage: e.goToPage, onJumpBlock: q, pinned: !0, docked: !0, onPinChange: y }) : null,
          /* @__PURE__ */ p(Og, { state: f, bookmarkScope: e.viewStateKey, issues: se }),
          /* @__PURE__ */ C("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(
              _f,
              {
                mode: k,
                documentReady: !!r.jobId,
                sourceViewOnly: M,
                onModeChange: H,
                compareExtra: /* @__PURE__ */ p(ir, { place: "compare" }),
                liveTranslation: P.topBarPill ? {
                  visible: b,
                  state: e.liveTranslation,
                  onToggle: () => w((ye) => !ye),
                  latestPage: b ? T : null,
                  currentPage: e.currentPage,
                  onJumpToLatest: R
                } : null,
                completion: D ? {
                  onOpenCompare: () => {
                    z(e.viewStateKey), H("compare");
                  }
                } : null,
                start: /* @__PURE__ */ p(vu, { onBeforeClose: r.prepareClose })
              }
            ),
            I ? null : /* @__PURE__ */ p(sa, { bookmarks: Pe, onJumpPage: e.goToPage, onJumpBlock: q, pinned: h, onPinChange: y }),
            /* @__PURE__ */ p(dg, { active: a }),
            /* @__PURE__ */ p(wg, { scope: e.viewStateKey, menuItemsAt: (ye) => So(be, ye) }),
            /* @__PURE__ */ p(Sf, { paneComposition: v, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: K }),
            /* @__PURE__ */ p(Tp, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
            /* @__PURE__ */ p(
              Gp,
              {
                mode: k,
                modeControls: null,
                bookmarkScope: e.viewStateKey,
                startSlot: /* @__PURE__ */ p(rg, { open: d, onToggle: f.toggleSidebar, issueCount: se.issues.length }),
                leftSlot: /* @__PURE__ */ p(_g, { edit: ae }),
                toolsSlot: /* @__PURE__ */ p(ir, { place: "bottom" })
              }
            )
          ] }),
          /* @__PURE__ */ C(
            "aside",
            {
              className: "reader-dock",
              hidden: !u,
              "data-dock": i ? "panel" : l ? "extension" : void 0,
              style: !i && l ? { "--reader-dock-width": `${l}px` } : void 0,
              "aria-label": "阅读辅助面板",
              children: [
                /* @__PURE__ */ p(Dh, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: re })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p(Sp, {}) : null,
        /* @__PURE__ */ p(
          zg,
          {
            session: r,
            zoomDocuments: ne,
            zoomItem: B,
            setZoomItem: U,
            closeZoom: de,
            visiblePdfMode: k
          }
        ),
        /* @__PURE__ */ p(Ng, { menu: Y, onClose: x, actions: We, sections: Be }),
        /* @__PURE__ */ p(Wf, { extensions: Sr }),
        /* @__PURE__ */ p(Qp, {})
      ]
    }
  ) }) });
}
function zb() {
  return /* @__PURE__ */ p(hb, {});
}
export {
  zb as R,
  hb as a,
  Db as b,
  $b as c,
  fm as d,
  hm as e,
  Lb as f,
  Cb as g,
  _b as h,
  Ab as r,
  Ob as s,
  Fe as u
};
//# sourceMappingURL=ReaderApp-CKnOML8G.js.map
