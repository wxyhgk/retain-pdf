var ws = Object.defineProperty;
var Er = (e) => {
  throw TypeError(e);
};
var Ss = (e, t, n) => t in e ? ws(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Rr = (e, t, n) => Ss(e, typeof t != "symbol" ? t + "" : t, n), Mr = (e, t, n) => t.has(e) || Er("Cannot " + n);
var _t = (e, t, n) => (Mr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Nr = (e, t, n) => t.has(e) ? Er("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), _r = (e, t, n, r) => (Mr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as A, jsx as p, Fragment as _e } from "react/jsx-runtime";
import { useMemo as q, useState as E, useEffect as $, useCallback as N, useRef as _, useLayoutEffect as De, memo as Jt, createContext as Gt, useContext as ut, Fragment as Yn, forwardRef as Wo, useImperativeHandle as Zn, useSyncExternalStore as hn, Component as ks, Suspense as Ko, lazy as Vo, useId as qo } from "react";
import { requireAdapter as Nt, getReaderAdapters as je } from "./adapters.js";
import { resolveReaderDownloadName as Is, resolveReaderDownloadUrls as Ts, READER_PROGRESS_COPY as Je, trimString as sn, READER_DOWNLOAD_ACTIONS as Ps, disabledReason as Es } from "./runtime/state.js";
import { r as Rs, b as Ms } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as xn, isFinishedJobStatus as Ht } from "@retainpdf/domain/job";
import { n as Jo, d as Ns, f as vn, k as xr, b as _s, c as xs, j as He, p as pt, g as As, l as Et, i as Ls } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as Cs } from "@retainpdf/api/documents";
import { isReaderTransportError as Ds, createReaderTransportError as $s } from "./contracts.js";
import { toast as An, Toaster as Os } from "sonner";
import { ChevronLeft as Go, PenLine as Qn, ZoomIn as zs, Check as Xo, X as Xt, Copy as Fs, ChevronUp as Bs, ChevronDown as er, History as js, LoaderCircle as Hs, Pin as Yo, LogOut as Us, FileText as Zo, Columns2 as Qo, Languages as ea, Radio as Ws, ArrowDownToLine as Ks, CheckCircle2 as Vs, ImagePlus as qs, MessageCircleQuestion as Js, Crop as Gs, GitCompareArrows as Xs, Highlighter as Ys, Eraser as Zs, Undo2 as Qs, Trash2 as ei, ChevronRight as ta, Minus as na, Plus as ra, ArrowLeft as ti, Keyboard as ni, Download as ri, Star as oi, ListTree as ai, PinOff as si } from "lucide-react";
import { Button as ae, Textarea as ii, IconButton as lt, Input as oa } from "@retainpdf/ui";
import { createPortal as ci } from "react-dom";
import { pdfjs as aa, Page as li, Document as ui } from "react-pdf";
import { e as di, m as fi, a as mi } from "./markdown-math-XkF5urpn.js";
const hi = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, pi = "", gi = Object.freeze({
  progress: "retainpdf-reader-progress"
}), bi = (e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Eg = (...e) => {
  var n;
  return (((n = je()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Rg = () => {
  var e, t;
  return ((t = (e = je()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ge = () => Nt("defaultReaderDataPort"), Ar = () => Nt("defaultReaderPageConfigPort"), Mg = {
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
}, sa = {
  messageTargetOrigin: () => Ar().messageTargetOrigin(),
  readerJobId: () => Ar().readerJobId()
}, yi = () => {
  var e;
  return ((e = je()) == null ? void 0 : e.liveTranslation) ?? null;
}, Ut = () => {
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
    fetchDocumentByJobId: (...n) => Nt("fetchDocumentByJobId")(...n),
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
}, vi = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, wi = () => {
  var e, t;
  return ((t = (e = je()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Si = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ki = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Is(...e);
}, Ii = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Ts(...e);
}, Ti = (...e) => Nt("downloadProtectedResource")(...e), Pi = (...e) => Nt("failDownloadToast")(...e), Ng = (e, t) => Nt("resolveMarkdownAssetUrl")(e, t), Lr = "/api/v1";
function Ei() {
  const e = () => {
    var r;
    return Rs(
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
function Ri() {
  const e = Ei(), t = q(() => Si(sa), [e]), n = q(() => wi(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Mi(e) {
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
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, b] = E({
    jobId: "",
    documentId: ""
  }), k = h.jobId === g ? h.documentId : "", S = t || k, y = !!t && !g, [w, v] = E(null), M = (w == null ? void 0 : w.sessionIdentity) === r && w.documentId === S ? w : null, L = y || !!M, x = N((R) => {
    const I = `${R.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      b({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${R.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  $(() => {
    v((R) => R && R.sessionIdentity !== r ? null : R);
  }, [r]);
  const z = N((R) => {
    switch (R.type) {
      case "resolved-document-job":
        l({ documentId: R.documentId, jobId: R.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: R.documentId, jobId: R.jobId });
        break;
      case "resolved-job-document":
        b((I) => I.jobId === R.jobId && I.documentId === R.documentId ? I : { jobId: R.jobId, documentId: R.documentId });
        break;
      case "committed-source":
        v({
          documentId: R.documentId,
          revision: R.revision,
          sessionIdentity: R.sessionIdentity
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
    setResolvedJobDocument: b,
    jobDocumentId: k,
    documentId: S,
    sourceOnly: y,
    committedDocumentSource: w,
    setCommittedDocumentSource: v,
    activeCommittedDocumentSource: M,
    sourceViewOnly: L,
    refreshCommittedDocument: x,
    applyIdentityEvent: z
  };
}
function Cr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Ni(e) {
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
  return bi(xn(e, t));
}
function _i(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function xi(e, t) {
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
        type: gi.progress,
        stage: n,
        percent: e,
        text: t
      },
      sa.messageTargetOrigin()
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
function Ai(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = E(null), [l, u] = E(null), [f, d] = E(""), [m, g] = E(0), h = f === n ? i : null, b = f === n ? l : null, k = Cr(h), S = Ht(k), y = N(() => {
    g((z) => z + 1);
  }, []), w = N((z) => {
    c(z.jobPayload), u(z.manifestPayload), d(z.sessionIdentity);
  }, []), v = N((z) => {
    c(null), u(null), d(z);
  }, []), M = _(""), L = _(""), x = N(async () => {
    const z = o.current;
    if (!z || M.current === z) return;
    const R = et().loadJobPayload;
    if (typeof R != "function") return;
    const I = a.current.value;
    M.current = z;
    try {
      const T = await R(z);
      if (s.current || a.current.value !== I || o.current !== z || !T || typeof T != "object")
        return;
      const P = Cr(T);
      c(T), d(r.current), !Ht(P) && L.current === z && (L.current = ""), P === "succeeded" && L.current !== z && (L.current = z, g((C) => C + 1));
    } catch {
    } finally {
      M.current === z && (M.current = "");
    }
  }, []);
  return $(() => {
    L.current = "";
  }, [n]), $(() => {
    if (!t || S || !h) return;
    const z = window.setInterval(() => {
      document.visibilityState !== "hidden" && x();
    }, 1e3);
    return () => window.clearInterval(z);
  }, [S, x, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: b,
    jobStatus: k,
    jobTerminal: S,
    jobRefreshRevision: m,
    refreshJobArtifacts: y,
    refreshJobStatus: x,
    publishPayload: w,
    clearPayload: v
  };
}
function Cn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Li(e, t) {
  e(t), Cn(t);
}
function Ci(e) {
  const [t, n] = E(e ? "source" : "compare"), r = N((a) => {
    e && a !== "source" || (n(a), Cn(a));
  }, [e]), o = N((a) => {
    Li(n, a);
  }, []);
  return $(() => (e && document.documentElement.classList.add("reader-source-only"), Cn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function $r(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Di(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: $r(n.active_job_id),
    activeVersionId: $r(n.active_version_id)
  };
}
function $i(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Oi(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function zi(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Fi = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Bi(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Fi.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const ji = 48 * 1024 * 1024;
function Hi(e) {
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
async function Wi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function ia(e, t = Ut().fetchProtected, n = {}) {
  var u, f, d, m, g, h, b, k, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Be.has(r)) {
    const y = Be.get(r);
    return Dn(r, y), y;
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
    const y = new Error(`读取 PDF 失败 (${s.status})`);
    y.status = s.status;
    const w = await Wi(s);
    throw w && (y.reason = w), y;
  }
  const i = Ki(r, s, t);
  if (i) {
    o.abort();
    const y = { ranged: i };
    return Or(), Be.set(r, y), y;
  }
  (b = (h = n.signal) == null ? void 0 : h.addEventListener) == null || b.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (k = n.signal) == null ? void 0 : k.removeEventListener) == null || S.call(k, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Be.has(r) ? Dn(r, l) : (Or(), Be.set(r, l)), l;
}
function Ki(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < ji ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Vi = { file: null, loading: !1, error: "" }, qi = { file: null, loading: !0, error: "" };
function Ji(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = E(null);
  if ($(() => {
    if (t || !n) return;
    const s = Be.get(n);
    if (s) {
      Dn(n, s);
      return;
    }
    const i = new AbortController();
    return ia(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Vi;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Be.get(n);
  return a ? { file: a, loading: !1, error: "" } : qi;
}
function Gi(e) {
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
  const i = await ia(t, Ut().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (cn(s, o, n, "download"), i);
}
async function Xi(e) {
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
function Yi(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Zi({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Cs,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Yi(o.href, t, a)), !0);
}
const Qt = {
  regions: null,
  metadata: null
};
function Qi(e) {
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
    closingRef: b,
    activeLoadAbortRef: k
  } = e, [S, y] = E(""), [w, v] = E(""), [M, L] = E(null), [x, z] = E(null), [R, I] = E(!1), [T, P] = E(""), [C, D] = E([]), [U, W] = E(!1), [X, H] = E(() => ({
    source: null,
    translated: null
  })), [J, ee] = E(
    Qt
  ), [ge, Y] = E({
    loading: !0,
    percent: 4,
    text: Je.boot,
    stage: "progress",
    failed: !1
  });
  return $(() => {
    const ue = new AbortController(), xe = h.current.value, ce = Gi({
      sessionEpochRef: h,
      closingRef: b,
      abort: ue,
      sessionEpoch: xe
    });
    k.current = ue;
    const fe = et();
    if (b.current)
      return ue.abort(), () => {
        k.current === ue && (k.current = null);
      };
    let F = !1;
    function K(le, te) {
      ce.markFailed(), W(!0), Y({
        loading: !1,
        percent: 100,
        text: le,
        stage: "failed",
        failed: !0
      }), Ln({ percent: 100, text: te, stage: "failed" });
    }
    function G() {
      I(!0), F || W(!0), Y({
        loading: !1,
        percent: 100,
        text: Je.ready,
        stage: "ready",
        failed: !1
      }), Ln({ percent: 100, text: Je.ready, stage: "ready" });
    }
    function ie() {
      return l != null && l.documentId ? Dr(
        l.documentId,
        l.revision
      ) : hi() ? pi : fe.resolveResourceUrl(xn(r));
    }
    async function se() {
      var oe;
      let le = { activeJobId: "", activeVersionId: "" };
      try {
        const he = await ((oe = fe.fetchDocument) == null ? void 0 : oe.call(fe, r));
        he && (le = Di(he));
      } catch {
      }
      const te = $i({
        link: le,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (te.kind === "follow-active-job") {
        if (ce.isInactive()) return;
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
        if (ce.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: te.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const be = ie();
      if (ce.isInactive()) return;
      y(be), v(""), P(""), d(c);
      const B = await $n({
        url: be,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ce,
        setBoot: Y
      });
      if (!ce.isInactive()) {
        if (!B) {
          K("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        L(B), G();
      }
    }
    async function me() {
      var Ce;
      const le = !l, te = !!(le && fe.loadSessionSnapshot && fe.loadReaderOptionalArtifacts), be = te ? fe.loadReaderOptionalArtifacts(t) : null, B = await ((Ce = fe.loadSessionSnapshot) == null ? void 0 : Ce.call(fe, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: le && !te
      })), oe = B ? {
        jobPayload: B.sourcePayload,
        manifestPayload: B.manifestPayload,
        readerMetadata: B.readerMetadata,
        regionsPayload: B.regions,
        readerErrors: B.readerErrors
      } : await fe.loadReaderPayload(t, {
        includeOptionalArtifacts: le
      });
      if (ce.isInactive()) return;
      let he = null;
      if (n && !r)
        if (B && B.linkedDocument !== void 0)
          he = B.linkedDocument;
        else {
          try {
            he = await fe.fetchDocumentByJobId(Lr, t);
          } catch {
          }
          if (ce.isInactive()) return;
        }
      const Ae = Ni(oe.jobPayload) || `${(he == null ? void 0 : he.document_id) || ""}`.trim();
      Ae && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ae
      });
      const Me = Oi({
        payloadDocumentId: Ae,
        linkedActiveJobId: `${(he == null ? void 0 : he.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(he == null ? void 0 : he.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Me.kind === "restore-committed-source") {
        if (ce.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Me.documentId,
          revision: Me.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Ee = fe.resolveReaderSourcePdf(oe.manifestPayload), ze = fe.resolveReaderTranslatedPdfUrl(oe.jobPayload, oe.manifestPayload), $e = typeof Ee == "string" ? Ee : fe.resolveReaderArtifactUrl(Ee), Le = r || Ae, We = l != null && l.documentId ? Dr(
        l.documentId,
        l.revision
      ) : $e || (Le ? fe.resolveResourceUrl(xn(Le)) : ""), Oe = l ? "" : ze || "";
      y(We || ""), v(Oe), P(xi(oe.jobPayload, t)), f({
        jobPayload: oe.jobPayload || null,
        manifestPayload: oe.manifestPayload || null,
        sessionIdentity: c
      });
      const Fe = () => Xi({
        sourceFinal: We || "",
        translatedFinal: Oe,
        fence: ce,
        setBoot: Y
      }), j = !!(We || Oe), V = be && j ? Fe() : null;
      V == null || V.catch(() => {
      });
      const ne = (O) => {
        ce.isInactive() || (D(l ? [] : Jo(O.regionsPayload)), H(l ? { source: null, translated: null } : Ns(O.readerMetadata)), ee(l ? Qt : O.readerErrors ?? Qt), W(!0));
      };
      if (be ? (F = !0, be.then(ne)) : ne(oe), !j) {
        K(Je.failed, Je.failed);
        return;
      }
      const ve = await (V ?? Fe());
      if (ve.status !== "inactive") {
        if (ve.status === "incomplete") {
          K("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        L(ve.sourceBytes), z(ve.translatedBytes), G();
      }
    }
    async function ke() {
      I(!1), L(null), z(null), D([]), W(!1), H({ source: null, translated: null }), ee(Qt), cn(Y, 8, Je.metadata, "metadata");
      try {
        if (s) {
          await se();
          return;
        }
        if (!t) {
          K(Je.failed, Je.failed);
          return;
        }
        await me();
      } catch (le) {
        if (ce.isClosedOrStale() || (le == null ? void 0 : le.name) === "AbortError") return;
        ce.markFailed();
        const te = Number(le == null ? void 0 : le.status), be = `${(le == null ? void 0 : le.reason) || ""}`, B = Bi({ status: te, reason: be, sessionJobId: t });
        if (B && (await Zi({
          apiPrefix: Lr,
          documentId: B,
          expiredJobId: t
        }) || ce.isClosedOrStale()))
          return;
        if (zi({
          status: te,
          reason: be,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const oe = le instanceof Error ? le.message : Je.failed;
        K(oe, oe);
      }
    }
    return ke(), () => {
      ue.abort(), k.current === ue && (k.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: w,
    sourceFile: M,
    translatedFile: x,
    assetsReady: R,
    title: T,
    regions: C,
    regionsSettled: U,
    readerMetadata: X,
    readerErrors: J,
    boot: ge
  };
}
function ec() {
  const e = _(!1), t = _(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ri(), s = _({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = _(a), c = _(""), l = _(""), u = _(() => {
  }), f = N(() => u.current(), []), d = Mi({
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
    sourceViewOnly: b
  } = d, { mode: k, setMode: S, switchSessionMode: y } = Ci(b);
  u.current = () => {
    y("source");
  }, i.current = a, c.current = g, l.current = m;
  const w = Ai({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: v,
    scopedManifestPayload: M,
    jobStatus: L,
    jobTerminal: x,
    jobRefreshRevision: z,
    refreshJobArtifacts: R,
    refreshJobStatus: I
  } = w, T = Qi({
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
    switchSessionMode: y,
    jobRefreshRevision: z,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), P = N(() => {
    var D;
    e.current = !0, (D = t.current) == null || D.abort();
  }, []), C = q(
    () => ({
      fetchProtected: et().fetchProtected,
      jobId: m,
      jobPayload: v,
      manifestPayload: M,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: b
    }),
    [m, v, M, T.sourceUrl, T.translatedUrl, b]
  );
  return {
    jobId: m,
    jobStatus: L,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: x,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: k,
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
    download: C,
    refreshJobArtifacts: R,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: P
  };
}
const tc = 160, nc = 8, rc = 0;
function oc() {
  const e = _(null), [t, n] = E(null), [r, o] = E(rc), a = N((s) => {
    e.current = s, n(s);
  }, []);
  return $(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < tc || o((u) => Math.abs(u - l) < nc ? u : l);
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
function ac(e) {
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
function sc(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = _(l);
  u.current = l;
  const [f, d] = E(() => ({
    identity: l,
    pages: wn
  })), [m, g] = E(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : wn, b = m.identity === l ? m.tick : 0, k = ac({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = k, y = N((I, T) => {
    u.current === l && d((P) => {
      const C = P.identity === l ? P.pages : wn;
      return C[T] === I && P.identity === l ? P : {
        identity: l,
        pages: { ...C, [T]: I }
      };
    });
  }, [l]), w = _(null), v = N(() => {
    w.current && clearTimeout(w.current);
    const I = l;
    w.current = setTimeout(() => {
      w.current = null, u.current === I && g((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  $(() => (w.current && (clearTimeout(w.current), w.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    w.current && (clearTimeout(w.current), w.current = null);
  }), [l]);
  const M = q(
    () => Math.max(h.source, h.translated),
    [h]
  ), L = S === "translated" ? h.translated : h.source || h.translated, x = t == null ? void 0 : t.userZoom, z = t == null ? void 0 : t.shellWidth, R = `${l}-${b}-${x}-${n}-${h.source}-${h.translated}-${z}`;
  return {
    ...k,
    numPagesByPane: h,
    hudNumPages: M,
    primaryNumPages: L,
    metricsTick: b,
    onNumPages: y,
    onMetrics: v,
    rowSyncRevision: R
  };
}
const Pe = "data-reader-page", Ie = "data-reader-pane", tr = "data-natural-height", ic = "reader-react-root", ca = "reader-react-grid", la = "reader-react-scroll-shell", pn = "reader-react-pdf-pane", ua = "reader-react-pdf-page", ln = "reader-react-pdf-page-placeholder", nr = "reader-react-pdf-page-slot";
function un(e, t) {
  const n = e != null ? `[${Pe}="${e}"]` : `[${Pe}]`;
  return t ? `${n}[${Ie}="${t}"]` : n;
}
function rr() {
  return `.${nr}[${Pe}]`;
}
function dn(e) {
  return Number(e.getAttribute(Pe));
}
const da = 0.25, fn = 1, cc = 0.05, Yt = 0.5, lc = 16, uc = 8, fa = lc + uc, dc = 720;
function It() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ma(e) {
  return Number.isFinite(e) && e < dc;
}
function St(e, t = Number.POSITIVE_INFINITY) {
  return ma(t) && (e === "source" || e === "translated") ? fn : Yt;
}
function Ze(e) {
  return Number.isFinite(e) ? Math.min(fn, Math.max(da, e)) : Yt;
}
function Wt(e, t) {
  const n = Ze(Number(e) + t * cc);
  return Math.round(n * 100) / 100;
}
function fc(e) {
  return Math.round(Ze(e) * 100);
}
function ha(e) {
  const n = (Number(e) || 0) - fa;
  return Math.max(160, Math.floor(n));
}
function mc(e, t = Yt) {
  const n = Ze(t);
  return ha((Number(e) || 0) * n);
}
function hc(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Ie}]`)
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
const pc = 8;
function gc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < pc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const pa = 200, bc = [
  "markdown"
], yc = bc;
function ga(e) {
  return yc.includes(e);
}
const vc = "retainpdf:reader:view:v1:", zr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), wc = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function ba() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function On(e) {
  return `${e || ""}`.trim();
}
function Sc({
  documentId: e,
  jobId: t
}) {
  const n = On(e);
  if (n) return `document:${n}`;
  const r = On(t);
  return r ? `job:${r}` : "";
}
function ya(e) {
  const t = On(e);
  return t ? `${vc}${t}` : "";
}
function kc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Ic(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!zr.has(t) || !zr.has(n) || t === n))
    return { left: t, right: n };
}
function Tc(e) {
  return e === null ? null : ga(e) ? e : void 0;
}
function Pc(e) {
  return wc.has(e) ? e : void 0;
}
function va(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = kc(t.anchor), r = Number(t.zoom), o = Pc(t.mode), a = Ic(t.splitLayout), s = Tc(t.assistantPanel);
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
function qe(e, t = ba()) {
  const n = ya(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? va(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function gn(e, t, n = ba()) {
  const r = ya(e);
  if (!r || !n) return null;
  const o = qe(e, n), a = va({
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
function Ec(e, t, n = "") {
  var d;
  const [r, o] = E(() => {
    var m;
    return ((m = qe(n)) == null ? void 0 : m.zoom) ?? St(e, It());
  }), a = _(r), s = _(n);
  a.current = r;
  const i = _(1), c = _(((d = qe(n)) == null ? void 0 : d.zoom) !== void 0);
  $(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = qe(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? St(e, It());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), $(() => {
    if (c.current) return;
    const m = St(e, It()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = N((m, g) => {
    const h = Ze(m), b = a.current;
    Math.abs(h - b) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (b || 1), a.current = h, c.current = !0, gn(s.current, { zoom: h }), o(h));
  }, []), u = N((m) => {
    l(Wt(a.current, m));
  }, [l]), f = N((m) => {
    l(St(m));
  }, [l]);
  return De(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, hc(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const Rc = 160, Mc = 3e-3, Fr = 50, Nc = 16, _c = 800;
function xc(e, t = 0) {
  const n = t === 1 ? Nc : t === 2 ? _c : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Fr, Math.min(Fr, r));
  return Math.exp(-o * Mc);
}
function Ac(e, t, n = 0) {
  return Ze(e * xc(t, n));
}
function Lc(e) {
  return Math.round(Ze(e) * 100) / 100;
}
function Cc(e, t, n) {
  const r = Ze(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ze(t) / r;
  const a = (o + fa) / r;
  return ha(a * Ze(t)) / o;
}
function Dc(e) {
  return Array.from(e.querySelectorAll(rr()));
}
function $c(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Oc(e, t, n) {
  let r = null;
  for (const s of Dc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = $c(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Pe) || "",
    pane: o.getAttribute(Ie) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function zc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function wa(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${rr()}[${Pe}="${t.page}"][${Ie}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (zc(n, e).scrollLeft += a);
}
function Fc(e, t, n, r) {
  const o = e.querySelector(`.${ca}`);
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
const Bc = 600, jc = 1e3;
function Hc(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || wa(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), jc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Uc(e, t, n) {
  const r = _(t);
  r.current = t;
  const o = _(n);
  o.current = n;
  const a = _(null), s = _(null), i = _(null);
  $(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = Lc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        xt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, xt(d.grid));
      }, Bc), s.current = d, o.current(f, { keepScroll: !1 });
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
          anchor: Oc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Ac(f.target, u.deltaY, u.deltaMode);
      const d = Cc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Fc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, Rc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), xt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), De(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), xt(c.grid), !(!e || !c.anchor) && (wa(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Hc(e, c.anchor)));
  }, [t, e]);
}
function Wc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = _(t), a = _(n), s = _(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: N((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const or = 48;
function Sa(e, t = or) {
  return e.getBoundingClientRect().top + t;
}
function ka(e, t) {
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
  const s = Sa(e, n), i = ka(o, s);
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
function Kc(e, t, n = "smooth", r) {
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
function Vc(e, t, n) {
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
function Ue(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function qc(e, t, n = !0, r = "", o) {
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
      const b = Sa(i), k = ka(h, b);
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
const Jc = `canvas, .react-pdf__Page, .${ua}, .${ln}`, Br = /* @__PURE__ */ new WeakMap();
function Gc(e) {
  const t = Number(e.getAttribute(tr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Br.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Jc), Br.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Xc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Yc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(rr()).forEach((r) => {
    const o = dn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Gc(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Zc(e, t, n = "", r) {
  const [o, a] = E(() => /* @__PURE__ */ new Map()), s = _(o), i = _(r);
  return i.current = r, De(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, f = !1;
    const d = () => {
      var v;
      if (c) return;
      const y = e.current;
      if (!y) return;
      const w = Yc(y);
      Xc(s.current, w) || (s.current = w, a(w)), u && !f && (f = !0, (v = i.current) == null || v.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), b = window.setTimeout(m, 700), k = e.current;
    let S = null;
    return k && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => m()), S.observe(k)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(b), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Qc = [0, 48, 140, 320, 560], el = 700, tl = [80, 200, 400], nl = 500, rl = 50, ol = /* @__PURE__ */ new Set([
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
]), al = 180, jr = [0, 48, 140, 320, 700, 1200];
function sl(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = _(
    ((T = qe(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = _(null), l = _(!1), u = _(r), f = _(null), d = _(null), m = _(null), g = _(null), h = _(a), b = _(""), k = _(n);
  k.current = n;
  const S = N(() => {
    var P;
    (P = f.current) == null || P.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), y = N(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), w = N((P = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const C = () => {
      g.current = null, gn(h.current, {
        anchor: Ue(i.current)
      });
    };
    P ? C() : g.current = setTimeout(C, al);
  }, []), v = N((P) => {
    i.current = Ue(P), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, rl);
  }, []);
  $(() => {
    if (!o)
      return;
    let P = !1, C = null, D = null, U = null;
    const W = () => {
      if (P) return;
      const X = e.current;
      if (!X) {
        U = setTimeout(W, 50);
        return;
      }
      C = X, D = () => {
        if (l.current)
          return;
        const H = Ft(C, k.current);
        H && (i.current = H, w());
      }, C.addEventListener("scroll", D, { passive: !0 }), l.current || D();
    };
    return W(), () => {
      P = !0, U != null && clearTimeout(U), C && D && C.removeEventListener("scroll", D);
    };
  }, [o, r, n, e, w]), $(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const C = (D) => {
      D.metaKey || D.ctrlKey || D.altKey || ol.has(D.key) && y();
    };
    return P.addEventListener("wheel", y, { passive: !0 }), P.addEventListener("touchmove", y, { passive: !0 }), window.addEventListener("keydown", C), () => {
      P.removeEventListener("wheel", y), P.removeEventListener("touchmove", y), window.removeEventListener("keydown", C);
    };
  }, [o, e, y]), De(() => {
    var C;
    if (h.current === a) return;
    w(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, b.current = "";
    const P = (C = qe(a)) == null ? void 0 : C.anchor;
    i.current = P ? Ue(P) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, w, S]), $(() => {
    var C;
    if (!o || !s || !a || b.current === a) return;
    b.current = a;
    const P = Ue(
      ((C = qe(a)) == null ? void 0 : C.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = P, c.current = P, l.current = !0, S(), f.current = zn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: k.current,
        delaysMs: jr,
        onDone: () => v(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(P);
    }, Math.max(...jr) + 160), () => S();
  }, [o, s, a, e, v, S]), $(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const P = c.current ? Ue(c.current) : Ue(i.current);
    return l.current = !0, c.current = P, i.current = P, S(), f.current = zn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Qc,
        onDone: () => v(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(P);
    }, el), () => {
      S();
    };
  }, [r, o, n, e, v, S]), $(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), w(!0);
  }, [S, w]);
  const M = N(() => {
    const P = Ft(
      e.current,
      k.current
    );
    return Ue(P || i.current);
  }, [e]), L = N(() => {
    l.current = !0;
    const P = Ft(
      e.current,
      k.current
    ), C = Ue(P ?? i.current);
    return i.current = C, c.current = C, w(), C;
  }, [e, w]), x = N((P, C, D) => {
    const U = D || k.current, W = mn(P, C || 1), X = { page: W, fraction: 0 };
    i.current = X, l.current = !0, c.current = X, w(), S(), Kc(e.current, W, "smooth", U), f.current = Vc(
      () => e.current,
      W,
      {
        behavior: "auto",
        pane: U,
        delaysMs: tl,
        onDone: () => v(X)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(X);
    }, nl);
  }, [e, v, S, w]), z = N(() => Ue(i.current), []), R = N(() => l.current, []), I = N(() => {
    if (!l.current || !c.current)
      return;
    const P = Ue(c.current);
    Rt(
      e.current,
      P,
      "auto",
      k.current
    );
  }, [e]);
  return {
    lockFromShell: M,
    beginModeSwitch: L,
    goToPage: x,
    getAnchor: z,
    isRestoring: R,
    repinIfRestoring: I
  };
}
function il(e, t) {
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
function Ia(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const cl = [0, 80, 200, 400, 800], ll = 120, ul = 400;
function dl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = _(a);
  f.current = a;
  const d = _(s);
  d.current = s;
  const m = _(i);
  m.current = i;
  const g = _(n);
  g.current = n, $(() => {
    var w, v;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = vi(), b = il(h, d.current);
    if (b == null && (h != null && h.blockId) && !u) return;
    const k = Ia(h, b, { jobId: c, documentId: l });
    if (t.current === k)
      return;
    if (b == null) {
      t.current = k, (w = g.current) == null || w.call(g);
      return;
    }
    t.current = k, h && ((v = m.current) == null || v.call(m, h, b));
    const S = [];
    let y = 0;
    for (const M of cl)
      y = Math.max(y, M), S.push(
        setTimeout(() => {
          f.current(b);
        }, M)
      );
    return S.push(
      setTimeout(() => {
        var M;
        (M = g.current) == null || M.call(g);
      }, y + ll)
    ), () => {
      for (const M of S) clearTimeout(M);
    };
  }, [r, o, c, l, t, u]);
}
function fl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function ml(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = ul,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = _(a);
  u.current = a;
  const f = _(l);
  f.current = l;
  const d = _(0);
  $(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var k;
      const g = ((k = globalThis.location) == null ? void 0 : k.search) || "", h = Ms(g, o, u.current);
      if (d.current = o, h === null) return;
      const b = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Ia(
        { blockId: b },
        o,
        { jobId: i, documentId: c }
      ), (f.current || fl)(h);
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
function hl(e) {
  const t = _(""), [n, r] = E(!1), o = N(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  dl(a, t, o), ml(e, t, n);
}
const At = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function pl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Hr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Ta(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Hr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Hr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function gl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Ta(r, t, n);
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
function bl(e) {
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
function yl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function vl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function wl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Sl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Ur = [250, 500, 1e3, 2e3, 4e3], Sn = [80, 160, 320, 640, 1e3, 1500], Wr = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
  return Ds(e) ? `${e.code || ""}`.trim() : "";
}
function en(e, t) {
  const n = ar(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function kl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Ta(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = $s(
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
function Il({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = E(At), s = _(o), i = _("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Ht(l) ? l : "";
  return $(() => {
    if (!n || !c) {
      i.current = "", s.current = At, a(At);
      return;
    }
    const f = r === void 0 ? yi() : r, d = i.current === c;
    if (i.current = c, !f) {
      const y = {
        ...d ? s.current : At,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = y, a(y);
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
    const b = (y) => {
      m.signal.aborted || a((w) => {
        const v = y(w);
        return s.current = v, v;
      });
    }, k = async () => {
      let y = 0;
      for (; !m.signal.aborted; )
        try {
          const w = await f.fetchLayout(c, { signal: m.signal });
          g = !0, b((v) => ({
            ...v,
            layoutByPage: pl(w),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (w) {
          if ((w == null ? void 0 : w.name) === "AbortError") return;
          const v = ar(w);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            b((L) => ({
              ...L,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: en(w, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            b((L) => ({
              ...L,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          b((L) => ({
            ...L,
            connection: "connecting",
            jobStatus: l,
            error: en(w, "正在等待 OCR 版面数据")
          })), await Fn(Ur[Math.min(y, Ur.length - 1)], m.signal).catch(() => {
          }), y += 1;
        }
    };
    return (async () => {
      if (await k(), !g || m.signal.aborted) return;
      let y = 0;
      for (; !m.signal.aborted; ) {
        u || b((w) => ({
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
                v = await kl(
                  c,
                  w,
                  s.current,
                  m.signal,
                  f
                );
              } catch (M) {
                if ((M == null ? void 0 : M.name) === "AbortError" || m.signal.aborted) throw M;
                b((L) => ({
                  ...L,
                  lastSeq: Math.max(L.lastSeq, w.seq),
                  error: en(M, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              b((M) => {
                const L = gl(M, w, v);
                return u ? {
                  ...L,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...L,
                  jobStatus: l
                };
              }), y = 0;
            }
          });
        } catch (w) {
          if ((w == null ? void 0 : w.name) === "AbortError" || m.signal.aborted) return;
          b((v) => ({
            ...v,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: en(w, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          b((w) => ({
            ...w,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Fn(Wr[Math.min(y, Wr.length - 1)], m.signal).catch(() => {
        }), y += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function Tl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Pl(e, t = !0) {
  const [n, r] = E(() => /* @__PURE__ */ new Map());
  return $(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = et().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Tl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const El = 4500;
function Rl(e) {
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
const Ml = /* @__PURE__ */ new Set(["book", "translate"]);
function Pa(e) {
  return !!(e.jobId && e.sourceUrl && Ml.has(e.workflow));
}
function Nl(e) {
  return !!(Pa(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function _l() {
  const e = ec(), t = Pa({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Nl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = _({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Ht(o) && (r.current.running = !0);
  const a = Il({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = oc(), u = Pl(e.jobId, !e.sourceOnly), f = Sc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = Ec(e.mode, s, f);
  Uc(i, m, g);
  const h = sc(
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
    beginModeSwitch: b,
    goToPage: k,
    repinIfRestoring: S
  } = sl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  $(() => {
    S();
  }, [c, S]);
  const y = Zc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), w = qc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), v = N((W, X) => {
    var J, ee;
    const H = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((J = h.numPagesByPane) == null ? void 0 : J.source) || 0,
      Number((ee = h.numPagesByPane) == null ? void 0 : ee.translated) || 0
    );
    k(W, H, X);
  }, [k, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [M, L] = E(null), x = _(null), z = N((W) => {
    x.current && clearTimeout(x.current), L(W), W && (x.current = setTimeout(() => L(null), El));
  }, []);
  $(() => () => {
    x.current && clearTimeout(x.current);
  }, []);
  const R = N((W) => {
    const X = vn(e.regions, W);
    return X ? xr(X, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = N((W, X) => {
    const H = X || h.primaryPane, J = typeof W == "object" && W ? `${W.block_id || ""}`.trim() : "", ee = typeof W == "object" && W ? `${W.image_url || ""}`.trim() : "", ge = typeof W == "object" && W ? W.page_idx != null ? Number(W.page_idx) + 1 : W.page != null ? Number(W.page) : null : typeof W == "number" ? W + 1 : null, Y = _s(e.regions, ee, ge) || vn(e.regions, J) || (typeof W == "object" ? xs(e.regions, W) : null);
    let ue = Y ? xr(Y, H).page : null;
    ue == null && (ue = Rl(W)), !(ue == null || ue < 1) && (z(Y), v(ue, H));
  }, [z, v, h.primaryPane, e.regions]);
  hl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: w,
    goToPage: v,
    resolveBlockPage: R,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (W) => {
      z(vn(e.regions, W.blockId));
    }
  });
  const { setModeKeepingPage: T } = Wc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: b
  });
  $(() => {
    z(null);
  }, [d, z]);
  const P = !e.boot.loading && !e.boot.failed, C = q(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), D = q(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), U = q(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: C,
    panes: h,
    sessionFiles: D,
    rowHeights: y,
    goToPage: v,
    activeRegion: M,
    jumpToAnchor: I,
    setModeKeepingPage: T,
    download: e.download,
    showHud: P,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, C, h, D, y, v, M, I, T, P, m, g, f, a, n, u]);
  return q(() => ({
    ...U,
    currentPage: w
  }), [U, w]);
}
const xl = [
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
], Al = [
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
function Ll(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of xl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Cl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Dl = ".reader-notes-panel";
function $l(e) {
  return e instanceof Element ? !!e.closest(Dl) : !1;
}
function Ol(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Cl(d.target) || $l(d.target))
        return;
      const m = d.key, g = Ll(m);
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
const zl = "retainpdf:soft-reader-close";
function Fl() {
  return new URL("./index.html", window.location.href).href;
}
function Bl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: zl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function jl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Hl() {
  if (!(typeof window > "u") && !Bl()) {
    if (jl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Fl());
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
function Wl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ A(Ul, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Hl();
  }, children: [
    /* @__PURE__ */ p(Go, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const Kl = 3e3, Vl = 8;
async function ql(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Jl(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Gl(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Kl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Jl(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < Vl && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await ql(e, i);
  })), a;
}
function Ea(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Ra(e, t) {
  let n = null;
  for (const r of Ea(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function Kr(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Vr = !1;
function Xl() {
  if (Vr)
    return;
  const e = Ut().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (aa.GlobalWorkerOptions.workerSrc = e, Vr = !0);
}
const at = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Yl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Zl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Ql = {
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
function eu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => qr(o ?? a ?? "", Yl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => qr(o ?? a ?? "", Zl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Ql[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function tu(e) {
  return at(e.translatedBlockText) || at(e.translated.text) || at(e.source.text);
}
const nu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function ru(e) {
  const t = [];
  for (const n of e) {
    if (!nu(n)) continue;
    const r = eu(tu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function ou(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const au = 24, su = 60;
function Jr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - au), o = Math.min(e.length, n + t.length + su), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function iu(e, t, n = 200) {
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
function cu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const lu = /^data-[a-z0-9-]+$/;
function Gr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function uu(e, t, n = "") {
  if (!t.length) return Dt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Dt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => lu.test(c)).map(([c, l]) => ` ${c}="${Gr(l)}"`).join("");
    o += `<mark class="${Gr(s.className)}"${i}>${Dt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Dt(e.slice(a), n);
}
function Se(e) {
  return typeof e == "string" ? e : "";
}
function du(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function fu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function mu(e) {
  return {
    source: Se(e == null ? void 0 : e.source_text) || Se(e == null ? void 0 : e.unit_source_text),
    translated: Se(e == null ? void 0 : e.protected_translated_text) || Se(e == null ? void 0 : e.translated_text)
  };
}
const hu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Ma(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function pu(e) {
  const t = Ma(e).sort((r, o) => Se(r.ts).localeCompare(Se(o.ts)));
  return t.length ? [
    { text: Se(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: Se(r.new_text),
      label: hu[Se(r.source)] || Se(r.source) || "修订",
      ts: Se(r.ts),
      reason: Se(r.reason)
    }))
  ].reverse() : [];
}
function gu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function bu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return Se(r.finished_at) || Se(n.finished_at) || "";
}
function yu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Ma(e).sort((a, s) => Se(a.ts).localeCompare(Se(s.ts)));
  for (const a of o) {
    const s = new Date(Se(a.ts)).getTime(), i = Se(a.reader_item_id) || Se(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, Se(a.new_text));
  }
  return n;
}
const vu = {
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
function wu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = vu[Se(n.kind)] || Se(n.kind) || "问题", o = Se(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Su = /* @__PURE__ */ new Set(["text", "formula"]);
function sr(e) {
  return Su.has(e);
}
function Na(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || sr(He(n));
}
function ku(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !sr(He(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Iu = 300, Tu = 72;
function Pu(e, t) {
  if (e.width >= Iu && e.height >= Tu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Eu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Ru(e, t, n) {
  return e.flatMap((r) => {
    if (!Eu.has(He(r.region))) return [];
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
async function Mu(e) {
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
const Nu = "reader-text-hover-copy", _u = "reader-text-hover-edit", xu = "reader-text-hover-zoom", Au = "reader-text-hover-id";
function Lu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const _a = "reader-text-hover-tools";
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
const Cu = 26, Du = 220;
function $u(e, t = Du) {
  return e.height < Cu * 2 || e.width < t;
}
function Ou({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Xo : e === "failed" ? Xt : Fs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function zu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = E("idle"), [u, f] = E("idle"), [d] = E(() => Lu()), m = _([]), g = (e == null ? void 0 : e.itemId) || "";
  if ($(() => {
    l("idle"), f("idle");
    const v = m.current;
    return () => {
      v.forEach((M) => window.clearTimeout(M)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = As(e.highlight.region, t), b = He(e.highlight.region), k = (v, M) => async (L) => {
    L.preventDefault(), L.stopPropagation();
    const x = await Mu(v);
    M(x ? "copied" : "failed"), m.current.push(window.setTimeout(() => M("idle"), 1200));
  }, S = b === "formula" ? "复制 LaTeX" : "复制", y = a || e.rect, w = s || ($u(y) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": b,
      style: y,
      children: /* @__PURE__ */ A(
        "div",
        {
          className: _a,
          "data-placement": w,
          style: w === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              nn,
              {
                className: Au,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: k(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && sr(b) ? /* @__PURE__ */ p(
              nn,
              {
                className: _u,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Qn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              nn,
              {
                className: Nu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: k(h, l),
                children: /* @__PURE__ */ p(Ou, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              nn,
              {
                className: xu,
                state: "idle",
                label: "放大看这一块",
                title: b === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(zs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Fu(e, t) {
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
function Bu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = pt(
      Fu(e, a),
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
const ju = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Hu = 256, Lt = /* @__PURE__ */ new Map();
function Uu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function xa(e) {
  const t = `${e || ""}`, { text: n, slots: r } = di(t, { bareLatex: !0 }), o = Uu(n), a = fi(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Lt.get(t);
  if (!s && (s = mi(o, r), Lt.set(t, s), Lt.size > Hu)) {
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
function Wu(e, t) {
  const n = e.typography, r = Xe(t) || 1, o = Xe(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = kn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Xe(n == null ? void 0 : n.fit_min_font_size_pt), u = Xe(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Xe(n == null ? void 0 : n.leading_em), h = [
    Xe(n == null ? void 0 : n.padding_top_pt) || 0,
    Xe(n == null ? void 0 : n.padding_right_pt) || 0,
    Xe(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Xe(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((b) => b * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || ju,
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
function Ku(e, t, n, r) {
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
const Vu = 512, Ct = /* @__PURE__ */ new Map();
let Bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Bn += 1;
}));
function qu(e, t, n, r) {
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
function Aa({ item: e, pageScale: t }) {
  const n = _(null), r = q(
    () => xa(e.translatedText),
    [e.translatedText]
  ), [o, a] = E(r.fallbackHtml), s = q(
    () => Wu(e, t),
    [e, t]
  );
  $(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), De(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, b = Math.max(1, e.rect.width - h - m), k = Math.max(1, e.rect.height - d - g), S = qu(o, b, k, s);
    let y = Ct.get(S);
    if (y === void 0 && (y = Ku(
      (w) => (f.style.fontSize = `${w}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      b,
      k,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ct.set(S, y), Ct.size > Vu)) {
      const w = Ct.keys().next().value;
      w !== void 0 && Ct.delete(w);
    }
    f.style.fontSize = `${y.toFixed(2)}px`;
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
function Ju({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = q(
    () => Bu(e, t, n, r),
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
        Aa,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Gu = Jt(Ju);
function Xu({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ A("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        Aa,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: He(a.highlight.region),
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
const Yu = Jt(Xu), La = 24, rt = La * 2 + 4, Ye = 24, Zu = 4, Qu = 6, dt = (e) => e.left + e.width, it = (e) => e.top + e.height;
function $t(e, t) {
  const n = Math.min(dt(e), dt(t)) - Math.max(e.left, t.left), r = Math.min(it(e), it(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Yr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= dt(t) && r >= t.top && r <= it(t);
}, ed = (e) => e.height > 40 && e.height > e.width * 2.5;
function td(e, t, n) {
  if (!t.length || e.height < Ye || e.width < n + 8) return null;
  const r = Math.max(...t.map(it)), o = dt(e) - 4 - n;
  for (const a of [r, it(e) - 2]) {
    const s = Math.max(e.top, a - Ye), i = { left: o, top: s, width: n, height: Ye };
    if (!t.some((c) => $t(i, c) > 0)) return s - e.top;
  }
  return null;
}
function nd(e, t) {
  const n = [], r = (a) => {
    const s = La + Zu, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: dt(e), top: i, width: s, height: rt } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: rt } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ye - 3, width: rt, height: Ye + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: it(e), width: rt, height: Ye + 3 } }), r(!0);
  const o = td(e, t, rt);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: dt(e) - 4 - rt, top: e.top + o, width: rt, height: Ye } }), n;
}
function rd(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !ed(S)), i = s.filter((S) => Yr(S, t)), c = s.filter((S) => !Yr(S, t)), l = n.filter((S) => S !== t && $t(S, t) < t.width * t.height * 0.5), u = nd(t, i).filter(({ box: S, overhang: y }) => {
    const w = y ? Qu : 0;
    return S.left >= -w && dt(S) <= r + w && S.top >= 0 && it(S) <= o;
  }), f = ({ placement: S, tailTop: y }) => y === void 0 ? { placement: S } : { placement: S, tailTop: y }, d = ({ box: S }) => !c.some((y) => $t(S, y) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((y) => $t(S.box, y) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let b = null, k = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const y = c.reduce((w, v) => w + $t(S.box, v), 0);
    y < k && (b = S, k = y);
  }
  return b ? f(b) : { placement: "outside" };
}
function od(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ye - 3 : it(r);
  return t >= r.left - 4 && t <= r.left + rt + 4 && n >= a && n <= a + Ye + 3;
}
const In = (e) => e.left + e.width, Tn = (e) => e.top + e.height;
function ad(e, t, n = 3, r = 6) {
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
function sd(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function id(e, t, n, r) {
  const [o, a] = E(null);
  return De(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? sd(s) : [], c = He(t.highlight.region) === "figure", l = i.length && !c ? ad(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...rd({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function cd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = E(null), [i, c] = E(!1), [l, u] = E([]), [f, d] = E(""), [m, g] = E(""), [h, b] = E(!1), [k, S] = E(null), [y, w] = E([]), v = r.drafts, M = r.generation, L = N(async (I, T) => {
    if (e)
      try {
        u(pu(await e.fetchRevisions(I, T)));
      } catch {
        u([]);
      }
  }, [e]);
  $(() => {
    if (s(null), u([]), S(null), w([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (I) return;
      const P = T == null ? void 0 : T.item;
      if (!P) throw new Error("找不到这一段的译文。");
      const C = `${(T == null ? void 0 : T.item_id) || n}`, { source: D, translated: U } = mu(P);
      s({ readerItemId: n, itemId: C, source: D, current: U }), d(v.get(n) ?? U);
    }).catch((T) => {
      I || S({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), L(t, n), () => {
      I = !0;
    };
  }, [e, t, n, L]);
  const x = N((I) => {
    d(I), n && v.set(n, I);
  }, [n, v]), z = N(async (I, T) => {
    if (!e || !a || h) return !1;
    const P = I ?? f;
    if (!P.trim()) return !1;
    b(!0), S(null), w([]);
    try {
      const C = await e.revise(t, a.itemId, {
        translated_text: P,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ...M.current != null ? { expected_generation: M.current } : {}
      }), D = Number(C == null ? void 0 : C.generation);
      return Number.isFinite(D) && (M.current = D), v.delete(a.readerItemId), s({ ...a, current: P }), d(P), g(""), (C == null ? void 0 : C.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, P), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), L(t, a.readerItemId), !0;
    } catch (C) {
      const D = C;
      return (D == null ? void 0 : D.reason) === "generation_mismatch" && (M.current = null), S({ tone: "error", message: (D == null ? void 0 : D.message) || "保存失败，请稍后再试。" }), w(wu(D == null ? void 0 : D.issues)), !1;
    } finally {
      b(!1);
    }
  }, [e, a, h, f, m, t, o, L, v, M]), R = N(() => {
    n && v.delete(n);
  }, [n, v]);
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
    issues: y,
    save: z,
    discardDraft: R
  };
}
const Ca = "reader-inline-edit";
function ld({ text: e }) {
  const [t, n] = E("");
  return $(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = xa(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ A("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function ud({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var R;
  const s = e.itemId, i = cd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = E(!1), [u, f] = E(!1), d = _(null), m = Pu(e.rect, t), g = q(() => ku(o), [o]), h = g.indexOf(s), { loaded: b } = i, k = i.saving || i.loading, S = n.blockedReason, y = !b || i.draft === b.current, { close: w, select: v } = n, M = N((I) => {
    const T = g[h + I];
    T && (v(T), a == null || a(T));
  }, [g, h, v, a]), L = N(() => {
    i.discardDraft(), w();
  }, [i, w]), x = N(async (I, T) => {
    await i.save(I, T) && w();
  }, [i, w]);
  $(() => {
    const I = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), M(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [M]), De(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    I.style.height = `${Math.max(T, I.scrollHeight + 2)}px`;
  }, [i.draft, b, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const z = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ A(_e, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ A(
      "div",
      {
        className: `${Ca} is-${m.mode}`,
        style: z,
        role: "group",
        "aria-label": `改第 ${((R = n.target) == null ? void 0 : R.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (b != null && b.source) ? /* @__PURE__ */ p(
            ae,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((I) => !I),
              children: b.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          b ? /* @__PURE__ */ p(
            ii,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: k || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), y || x()) : I.key === "Escape" && (I.preventDefault(), L());
              }
            }
          ) : null,
          b ? /* @__PURE__ */ p(ld, { text: i.draft }) : null,
          /* @__PURE__ */ A("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(lt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => M(-1), children: /* @__PURE__ */ p(Bs, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(lt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => M(1), children: /* @__PURE__ */ p(er, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              oa,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: k || !!S || !b,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), y || x()) : I.key === "Escape" && (I.preventDefault(), L());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ A(
              ae,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p(js, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(ae, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: L, children: "取消" }),
            /* @__PURE__ */ p(
              ae,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: k || !!S || y || !i.draft.trim(),
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
          u && b && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, T) => {
            const P = I.text === b.current, C = [gu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ A("li", { "data-block-edit-history": I.label, "data-current": P ? "true" : void 0, children: [
              /* @__PURE__ */ A("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ A("span", { children: [
                  C,
                  P ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                P ? null : /* @__PURE__ */ p(
                  ae,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: k || !!S,
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
const Da = Gt(null), $a = Gt(null);
function dd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Da.Provider, { value: e, children: /* @__PURE__ */ p($a.Provider, { value: t, children: n }) });
}
function tt() {
  return ut(Da);
}
function ir() {
  return ut($a);
}
const Oa = 1.414;
function fd({
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
  liveTranslationPage: b,
  showLiveTranslation: k = r === "source",
  liveTranslationMissing: S = !1
}) {
  var te, be;
  const y = tt(), w = y == null ? void 0 : y.revisedBlocks, v = y == null ? void 0 : y.blockEdit, M = v == null ? void 0 : v.pendingEdits, L = y == null ? void 0 : y.editBlock, x = (y == null ? void 0 : y.findTerm) || "", z = r === "translated" ? "translated" : y != null && y.compareVersion ? "compare" : "source", R = y == null ? void 0 : y.textMarks, I = q(
    () => R ? ({ str: B }) => uu(B, R(B), x) : x ? ({ str: B }) => Dt(B, x) : void 0,
    [x, R]
  ), T = _(c ?? Oa), [P, C] = E(T.current);
  $(() => {
    c != null && Math.abs(c - T.current) >= 1e-3 && (T.current = c, C(c));
  }, [c]);
  const D = _(u);
  D.current = u;
  const U = _(null), W = _((B) => {
    var oe;
    U.current = B, (oe = D.current) == null || oe.call(D, B);
  }).current, X = _(null), H = _(`${t}@${n}`);
  De(() => {
    const B = `${t}@${n}`;
    H.current !== B && (H.current = B, o && hd(U.current, X.current));
  }, [o, n, t]), $(() => {
    o || Pn(X.current);
  }, [o]), $(() => () => Pn(X.current), []);
  const J = Math.max(120, Math.floor(t * P)), ee = Math.max(J, Math.ceil(s || 0)), ge = pt(f, t, J), Y = q(
    () => Ru(d, t, J),
    [J, d, t]
  ), [ue, xe] = E(null), ce = typeof g == "function", fe = ce ? m ?? null : ue, F = (B) => {
    ce ? B !== (m ?? null) && (g == null || g(B)) : xe((oe) => oe === B ? oe : B);
  }, K = q(
    () => Y.find((B) => B.itemId === fe) || null,
    [fe, Y]
  ), G = r === "translated" && ((te = v == null ? void 0 : v.target) == null ? void 0 : te.itemId) || "", ie = q(
    () => G && Y.find((B) => B.itemId === G) || null,
    [G, Y]
  ), se = id(U, o ? K : null, Y, t), me = (B) => {
    var Ee, ze, $e, Le;
    if (B.pointerType === "touch") return;
    if (y != null && y.pointerTaken) {
      F(null);
      return;
    }
    if (B.buttons !== 0) {
      F(null);
      return;
    }
    if ((ze = (Ee = B.target) == null ? void 0 : Ee.closest) != null && ze.call(Ee, `.${_a}`) || (Le = ($e = B.target) == null ? void 0 : $e.closest) != null && Le.call($e, `.${Ca}`)) return;
    const oe = B.currentTarget.getBoundingClientRect(), he = B.clientX - oe.left, Ae = B.clientY - oe.top;
    if (od(se, he, Ae)) return;
    const Me = Xr(Y, he, Ae);
    F((Me == null ? void 0 : Me.itemId) || null);
  }, ke = (B) => {
    if (B.pointerType === "mouse") return;
    const oe = B.currentTarget.getBoundingClientRect(), he = Xr(
      Y,
      B.clientX - oe.left,
      B.clientY - oe.top
    );
    F((he == null ? void 0 : he.itemId) || null);
  }, le = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(T.current - B) < 1e-3 || (T.current = B, C(B), l == null || l(e, B));
  };
  return /* @__PURE__ */ A(
    "div",
    {
      ref: W,
      [Pe]: e,
      [Ie]: r,
      [tr]: J,
      className: nr,
      onPointerMoveCapture: me,
      onPointerDown: ke,
      onDoubleClick: (B) => {
        const oe = y == null ? void 0 : y.zoomBlock;
        !oe || y != null && y.pointerTaken || !K || He(K.highlight.region) === "figure" && (B.preventDefault(), oe(K.itemId));
      },
      onPointerLeave: (B) => {
        B.pointerType === "mouse" && F(null);
      },
      style: {
        width: t,
        height: ee,
        minHeight: ee
      },
      children: [
        o ? /* @__PURE__ */ p(
          li,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: I,
            renderAnnotationLayer: !1,
            className: ua,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: ln,
                style: { width: t, height: J }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const oe = B.getViewport({ scale: 1 });
                if (oe.width > 0) {
                  const he = oe.height / oe.width;
                  le(he);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Pn(X.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: ln,
            style: { width: t, height: J },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: X, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
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
          Gu,
          {
            layoutPage: h,
            pageState: b,
            width: t,
            height: J
          }
        ) : null,
        o && k && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (M != null && M.size) ? /* @__PURE__ */ p(Yu, { targets: Y, edits: M, width: t, excludeId: ie == null ? void 0 : ie.itemId }) : null,
        o && ie && v ? /* @__PURE__ */ p(
          ud,
          {
            target: ie,
            page: { width: t, height: J },
            edit: v,
            showSource: !!(y != null && y.editShowsSource),
            regions: y == null ? void 0 : y.regions,
            jumpToBlock: y == null ? void 0 : y.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (w != null && w.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: Y.filter((B) => w.has(B.itemId)).map((B) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": B.itemId,
            style: { left: B.rect.left, top: B.rect.top, height: B.rect.height }
          },
          B.itemId
        )) }) : null,
        (be = y == null ? void 0 : y.pageLayers) == null ? void 0 : be.map((B) => /* @__PURE__ */ p(Yn, { children: B.render({ page: e, width: t, height: J, pane: z, active: o }) }, B.id)),
        /* @__PURE__ */ p(
          zu,
          {
            target: o && !(y != null && y.pointerTaken) && (K == null ? void 0 : K.itemId) !== (ie == null ? void 0 : ie.itemId) ? K : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: K && (w == null ? void 0 : w.get(K.itemId)) || 0,
            onEdit: L,
            onZoom: y == null ? void 0 : y.zoomBlock,
            frameRect: se == null ? void 0 : se.rect,
            placement: se == null ? void 0 : se.placement,
            tailTop: se == null ? void 0 : se.tailTop
          }
        )
      ]
    }
  );
}
const md = Jt(fd);
function hd(e, t) {
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
const pd = 2 * 1024 * 1024;
function gd(e) {
  const t = new aa.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const En = 5, bd = "120% 0px", yd = 120, vd = "25% 0px";
let Zr = 1;
const Qr = /* @__PURE__ */ new WeakMap();
function wd(e) {
  if (!e) return 0;
  const t = Qr.get(e);
  if (t) return t;
  const n = Zr;
  return Zr += 1, Qr.set(e, n), n;
}
function Sd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const kd = Wo(
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
    activeRegion: b = null,
    regions: k = [],
    readerMetadata: S = null,
    hoveredRegionId: y = null,
    onHoverRegion: w,
    liveTranslation: v,
    showLiveTranslation: M = t === "source",
    liveTranslationPendingLabel: L = "",
    paneAction: x
  }, z) {
    Xl();
    const { file: R, loading: I, error: T } = Ji(n, r), P = `${n}\0${wd(R)}`, C = _(P);
    C.current = P;
    const D = q(() => {
      const O = Hi(R);
      return O ? "ranged" in O ? { range: gd(O.ranged) } : O : null;
    }, [R, n]), [U, W] = E(0), [X, H] = E(""), [J, ee] = E(null), [ge, Y] = E(480), ue = _(null), xe = _(0), ce = q(() => Sd(), []), fe = q(() => ({
      cMapUrl: Ut().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Ut().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: pd,
      disableAutoFetch: !0
    }), []);
    Zn(z, () => J, [J]), $(() => {
      const O = (Q) => {
        xe.current = Q, Y(Q);
      }, Z = (Q) => {
        const ye = gc(Q, xe.current);
        if (ye !== "ignore") {
          if (ue.current && clearTimeout(ue.current), ye === "immediate") {
            O(Q);
            return;
          }
          ue.current = setTimeout(() => O(Q), pa);
        }
      }, re = !!(c && c >= 80);
      Z(re ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const we = !re && i && typeof ResizeObserver < "u" ? new ResizeObserver((Q) => {
        var ye, Te;
        Z(((Te = (ye = Q[0]) == null ? void 0 : ye.contentRect) == null ? void 0 : Te.width) ?? i.clientWidth);
      }) : null;
      return we && i && we.observe(i), () => {
        we == null || we.disconnect(), ue.current && clearTimeout(ue.current);
      };
    }, [c, i, a]);
    const F = q(
      () => mc(ge, o),
      [ge, o]
    ), [K, G] = E(() => /* @__PURE__ */ new Map()), [ie, se] = E(() => /* @__PURE__ */ new Set()), [me, ke] = E(() => /* @__PURE__ */ new Set()), le = _(/* @__PURE__ */ new Map()), te = _(null), be = _(null), [B, oe] = E(() => /* @__PURE__ */ new Set()), he = _(/* @__PURE__ */ new Map()), Ae = N((O, Z) => {
      G((re) => {
        if (re.get(O) === Z) return re;
        const de = new Map(re);
        return de.set(O, Z), de;
      });
    }, []), Me = N((O, Z) => {
      const re = le.current, de = re.get(O), we = [te.current, be.current];
      if (de)
        for (const Q of we)
          try {
            Q == null || Q.unobserve(de);
          } catch {
          }
      if (Z) {
        re.set(O, Z);
        for (const Q of we)
          try {
            Q == null || Q.observe(Z);
          } catch {
          }
      } else
        re.delete(O);
    }, []), Ee = _(/* @__PURE__ */ new Map()), ze = N((O) => {
      const Z = Ee.current;
      let re = Z.get(O);
      return re || (re = (de) => Me(O, de), Z.set(O, re)), re;
    }, [Me]);
    $(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = he.current, Z = new IntersectionObserver(
        (re) => {
          const de = [], we = [];
          for (const Q of re) {
            const ye = Q.target, Te = dn(ye);
            Number.isFinite(Te) && (Q.isIntersecting ? de : we).push(Te);
          }
          if ((de.length || we.length) && se((Q) => {
            let ye = null;
            for (const Te of de)
              Q.has(Te) || (ye = ye || new Set(Q), ye.add(Te));
            for (const Te of we)
              Q.has(Te) && (ye = ye || new Set(Q), ye.delete(Te));
            return ye || Q;
          }), de.length) {
            for (const Q of de) {
              const ye = O.get(Q);
              ye && (clearTimeout(ye), O.delete(Q));
            }
            ke((Q) => {
              let ye = null;
              for (const Te of de)
                Q.has(Te) || (ye = ye || new Set(Q), ye.add(Te));
              return ye || Q;
            });
          }
          for (const Q of we)
            O.has(Q) || O.set(Q, setTimeout(() => {
              O.delete(Q), ke((ye) => {
                if (!ye.has(Q)) return ye;
                const Te = new Set(ye);
                return Te.delete(Q), Te;
              });
            }, yd));
        },
        { root: i, rootMargin: bd, threshold: 0 }
      );
      te.current = Z;
      for (const re of le.current.values())
        try {
          Z.observe(re);
        } catch {
        }
      return () => {
        Z.disconnect(), te.current === Z && (te.current = null);
        for (const re of O.values()) clearTimeout(re);
        O.clear();
      };
    }, [i]), $(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = new IntersectionObserver(
        (Z) => {
          oe((re) => {
            let de = null;
            for (const we of Z) {
              const Q = dn(we.target);
              !Number.isFinite(Q) || we.isIntersecting === re.has(Q) || (de = de || new Set(re), we.isIntersecting ? de.add(Q) : de.delete(Q));
            }
            return de || re;
          });
        },
        { root: i, rootMargin: vd, threshold: 0 }
      );
      be.current = O;
      for (const Z of le.current.values())
        try {
          O.observe(Z);
        } catch {
        }
      return () => {
        O.disconnect(), be.current === O && (be.current = null);
      };
    }, [i]);
    const $e = !!i && typeof IntersectionObserver < "u";
    De(() => {
      W(0), H(""), se(/* @__PURE__ */ new Set()), ke(/* @__PURE__ */ new Set()), G(/* @__PURE__ */ new Map()), le.current.clear();
      const O = he.current;
      for (const Z of O.values()) clearTimeout(Z);
      O.clear(), h == null || h(0, t);
    }, [P, h, t]);
    const Le = N(
      (O) => {
        if (C.current !== P) return;
        const Z = O.numPages;
        W(Z), H(""), h == null || h(Z, t), f == null || f({ numPages: Z, pane: t }), m && typeof O.getPage == "function" && m(O, t), d && typeof O.getOutline == "function" && Gl(O).then((re) => {
          C.current === P && d(re, t);
        }, () => {
        });
      },
      [P, f, d, m, h, t]
    ), We = N(
      (O) => {
        if (C.current !== P) return;
        const Z = (O == null ? void 0 : O.message) || "PDF 解析失败";
        H(Z), W(0), h == null || h(0, t), g == null || g(O, t);
      },
      [P, g, h, t]
    ), Oe = q(
      () => U > 0 ? Array.from({ length: U }, (O, Z) => Z + 1) : [],
      [U]
    );
    $(() => {
      typeof IntersectionObserver < "u" || ke(new Set(Oe));
    }, [Oe]);
    const Fe = q(
      () => Et(b, S, t),
      [b, S, t]
    ), j = q(() => {
      const O = /* @__PURE__ */ new Map();
      for (const Z of k) {
        const re = Et(Z, S, t);
        if (!re) continue;
        const de = O.get(re.box.page) || [];
        de.push(re), O.set(re.box.page, de);
      }
      return O;
    }, [t, S, k]), V = q(() => {
      const O = /* @__PURE__ */ new Set();
      if (!y) return O;
      for (const [Z, re] of j)
        re.some((de) => de.itemId === y) && O.add(Z);
      return O;
    }, [y, j]), ne = q(() => {
      if (U === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Oe);
      if (ie.size === 0) {
        const re = Math.min(U, En * 2 + 1);
        return new Set(Array.from({ length: re }, (de, we) => we + 1));
      }
      const Z = /* @__PURE__ */ new Set();
      for (const re of ie)
        for (let de = -En; de <= En; de++) {
          const we = re + de;
          we >= 1 && we <= U && Z.add(we);
        }
      return Z;
    }, [U, Oe, i, a, ie]), ve = !n || !!T || !!X, Ce = n && (T || X) || s;
    return /* @__PURE__ */ A(
      "section",
      {
        ref: ee,
        className: `reader-panel ${pn}${a ? "" : " is-hidden"}`,
        [Ie]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (v == null ? void 0 : v.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          x ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: x }) : null,
          L ? /* @__PURE__ */ A("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: L })
          ] }) : null,
          ve && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Ce }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          D && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            ui,
            {
              file: D,
              loading: null,
              error: null,
              options: fe,
              onLoadSuccess: Le,
              onLoadError: We,
              className: "reader-react-pdf-document",
              children: Oe.map((O) => {
                if (ne.has(O))
                  return /* @__PURE__ */ p(
                    md,
                    {
                      pane: t,
                      pageNumber: O,
                      width: F,
                      devicePixelRatio: ce,
                      active: me.has(O),
                      textLayer: !$e || B.has(O),
                      syncedMinHeight: (l == null ? void 0 : l.get(O)) || 0,
                      onMetrics: u,
                      cachedAspect: K.get(O),
                      onAspectChange: Ae,
                      sentinelRef: ze(O),
                      regionHighlight: (Fe == null ? void 0 : Fe.box.page) === O ? Fe : null,
                      regionTargets: j.get(O),
                      hoveredRegionId: y && V.has(O) ? y : null,
                      onHoverRegion: w,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(O - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(O - 1),
                      showLiveTranslation: M,
                      liveTranslationMissing: vl(v, O - 1)
                    },
                    `${t}-${O}`
                  );
                const re = K.get(O) ?? Oa, de = Math.max(120, Math.floor(F * re)), we = Math.max(de, Math.ceil((l == null ? void 0 : l.get(O)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: ze(O),
                    [Pe]: O,
                    [Ie]: t,
                    [tr]: de,
                    className: `${nr} is-placeholder`,
                    style: {
                      width: F,
                      height: we,
                      minHeight: we
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: ln,
                        style: { width: F, height: de },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${O}`
                );
              })
            },
            P
          ) }) : null
        ]
      }
    );
  }
), eo = Jt(kd), Id = 2e3, Td = 6, Pd = 500, to = "reader-react-resizing";
function Ed(e, t) {
  const n = _(null), r = _(null);
  De(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const w = Rd(e), v = Ft(e, w);
      if (!v) return;
      s = { pane: w, progress: v, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const b = /* @__PURE__ */ new WeakMap(), k = typeof ResizeObserver > "u" ? null : new ResizeObserver((w) => {
      let v = !1;
      for (const M of w) {
        const L = Math.round(M.contentRect.height);
        b.has(M.target) && b.get(M.target) !== L && (v = !0), b.set(M.target, L);
      }
      v && Rt(e, c, "auto", i);
    }), S = () => {
      var w;
      f && clearTimeout(f), cancelAnimationFrame(u), k == null || k.disconnect(), e.classList.remove(to);
      for (const v of no) e.removeEventListener(v, S);
      ((w = r.current) == null ? void 0 : w.stop) === S && (r.current = null);
    }, y = () => {
      Rt(e, c, "auto", i);
      const w = e.scrollHeight;
      g = w === m ? g + 1 : 0, m = w;
      const v = performance.now() - h;
      g >= Td && (w !== d || v > Pd) || v > Id ? S() : u = requestAnimationFrame(y);
    };
    for (const w of no) e.addEventListener(w, S, { passive: !0 });
    for (const w of Array.from(e.children)) k == null || k.observe(w);
    e.classList.add(to), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(y);
    }, pa);
  }, [e, t]), $(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Rd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Pe}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ie) || null;
  }
  return null;
}
const no = ["wheel", "touchstart", "keydown", "pointerdown"];
function Md(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Nd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(pn)) && ((n = e.hasAttribute) != null && n.call(e, Ie)));
}
function _d(e, t) {
  $(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Nd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${pn}[${Ie}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = Md(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function xd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Ad(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const ro = 12;
function cr(e) {
  return Array.from(e.querySelectorAll(`.${pn}[${Ie}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Ld(e) {
  const t = e.getBoundingClientRect();
  return cr(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(Ie) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function Cd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Dd(e, t) {
  return e ? cr(e).find((n) => n.getAttribute(Ie) === t) ?? null : null;
}
function $d({ shellEl: e }) {
  const [t, n] = E([]), r = _(0), o = N(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Ld(e);
      n((i) => Cd(i, s) ? i : s);
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Od, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Od({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - ro * 2), r = xd(e, n), o = _(null);
  if (!r) return null;
  const a = (d) => {
    const m = Dd(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + Ad(e, n, r.size, d.clientX - m.startX));
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
function za(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function zd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Fd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ A("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ A(
        ae,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: za(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Xo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Hs, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ A("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ A(
        ae,
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
      /* @__PURE__ */ A(
        ae,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Us, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function oo({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = zd(t), a = [e === "compare" ? "对比" : "正在读", r, za(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ A("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Bd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = E({ source: null, translated: null });
  return De(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${Ie}="${l}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Ie}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ A("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(oo, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(oo, { role: "reading", ...n }) }) : null
  ] });
}
const jd = () => () => {
}, ao = () => null;
function Hd({
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
function Wd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Kd(e) {
  const t = tt(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), b = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, k = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, y = (t == null ? void 0 : t.compareVersion) ?? null, w = (y == null ? void 0 : y.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", v = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", M = y ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, L = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, x = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), z = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), R = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), P = e.regions ?? (t == null ? void 0 : t.regions) ?? [], C = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), D = (t == null ? void 0 : t.regionHover) ?? null, [U, W] = E(null), X = hn(
    D ? D.subscribe : jd,
    D ? () => D.get().itemId : ao,
    D ? () => D.get().itemId : ao
  ), H = D ? X : U, J = N((ue) => {
    D ? D.set(ue, "pdf") : W(ue);
  }, [D]), ee = Hd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), Y = Number.isFinite(g) && g > 0 ? Ud(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !ee.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Ed(d, Y), _d(d, ee.compareMode), /* @__PURE__ */ A(
    "div",
    {
      ref: f,
      className: la,
      "data-reader-region-count": P.length,
      "data-reader-structured-region-count": P.filter(Ls).length,
      "data-reader-metadata-ready": C ? "true" : "false",
      children: [
        /* @__PURE__ */ A(
          "main",
          {
            className: `${ca} reader-mode-${ee.mode}`,
            "data-reader-mode": ee.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              b ? /* @__PURE__ */ p(
                eo,
                {
                  pane: "source",
                  url: w,
                  preloadedFile: M,
                  userZoom: m,
                  visible: ee.showSource,
                  scrollRoot: d,
                  pageWidthOverride: Y,
                  rowHeights: ee.compareMode ? h : void 0,
                  onMetrics: x,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: z,
                  onOutline: y ? void 0 : R,
                  onDocument: y ? void 0 : I,
                  activeRegion: T,
                  regions: (y == null ? void 0 : y.regions) ?? P,
                  readerMetadata: C,
                  hoveredRegionId: H,
                  onHoverRegion: J,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Wd(o) : "",
                  paneAction: u && ee.showTranslated ? /* @__PURE__ */ A(_e, { children: [
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
                y ? `compare:${y.url}` : "source"
              ) : null,
              k ? /* @__PURE__ */ p(
                eo,
                {
                  pane: "translated",
                  url: v,
                  preloadedFile: L,
                  userZoom: m,
                  visible: ee.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: Y,
                  rowHeights: ee.compareMode ? h : void 0,
                  onMetrics: x,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: z,
                  onOutline: R,
                  onDocument: I,
                  activeRegion: T,
                  regions: P,
                  readerMetadata: C,
                  hoveredRegionId: H,
                  onHoverRegion: J,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p($d, { shellEl: d }),
        y ? /* @__PURE__ */ p(Bd, { shellEl: d, left: y.left, right: y.right }) : null
      ]
    }
  );
}
const Vd = [
  { id: "source", label: "原文", Icon: Zo },
  { id: "compare", label: "对照", Icon: Qo },
  { id: "translated", label: "译文", Icon: ea }
];
function qd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Jd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Gd(e) {
  const t = tt(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? qd(a.state) : "";
  return /* @__PURE__ */ A("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }),
    /* @__PURE__ */ A("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Vd.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = Jd({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ A(
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
      a ? /* @__PURE__ */ A("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ A(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ p(Ws, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ A(
          ae,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Ks, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ A(
        ae,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(Vs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-end", children: e.end })
  ] });
}
const Fa = [];
function Xd() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = Fa;
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
function Yd(e, t) {
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
function Zd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function Qd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function ef(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function tf(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function nf(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function rf(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function of(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const bn = Gt(null), Ba = Gt(null);
function af({ api: e, store: t, children: n }) {
  const r = q(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(bn.Provider, { value: r, children: n });
}
function Zt() {
  const e = ut(bn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const sf = () => () => {
}, so = () => Fa;
function cf(e) {
  return hn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function ja() {
  var t;
  const e = (t = ut(bn)) == null ? void 0 : t.store;
  return hn((e == null ? void 0 : e.subscribe) ?? sf, (e == null ? void 0 : e.getSnapshot) ?? so, (e == null ? void 0 : e.getSnapshot) ?? so);
}
function yn(e) {
  var a;
  const t = (a = ut(bn)) == null ? void 0 : a.store, n = ut(Ba);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  $(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), $(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class lf extends ks {
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
const uf = Jt(function({ extensions: t }) {
  return /* @__PURE__ */ p(_e, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(lf, { id: n, children: /* @__PURE__ */ p(df, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function df({ id: e, title: t, children: n }) {
  const r = q(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(Ba.Provider, { value: r, children: n });
}
function ff({
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
      ae,
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
function Ha(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Ua(e, t, n, r) {
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
function Wa({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = _(null), [i, c] = E({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return $(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = Ua(n, m, r, g), b = s.current, k = b == null ? void 0 : b.getContext("2d");
        if (!b || !k) return;
        b.width = h.canvasWidth, b.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const S = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), y = d.render({ canvasContext: k, viewport: S });
        f = y, await y.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && c((m) => ({ status: "error", cssHeight: m.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, l]), /* @__PURE__ */ A(
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
const mf = 1600, lr = { left: 0, top: 0, width: 1, height: 1 };
function Ka(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function hf(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function pf(e, t, n = lr, r = mf) {
  const o = await e.getPage(t), a = Ua(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, Ka(s);
}
async function gf(e, t = lr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), Ka(s);
}
function bf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const yf = 4e3;
function vf(e, t, n) {
  if (e.length) {
    const o = Ra(e, n), a = o ? Ea(e).find((s) => s.id === o) : null;
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
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Pe}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, yf), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function wf(e, t, n, r, o) {
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
function Sf({
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
  const c = Number(e.getAttribute(Pe)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(Ie) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? wf(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: vf(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
function kf(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Pe}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Pe)) || 0, i = (o.closest(`[${Ie}]`) ?? o).getAttribute(Ie) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function If({ onDone: e, onCancel: t }) {
  const [n, r] = E(null), o = _(null), a = _(null);
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
      return kf(c, l);
    } finally {
      u && (u.style.pointerEvents = "");
    }
  }, i = n ? { left: Math.min(n.from.x, n.to.x), top: Math.min(n.from.y, n.to.y), width: Math.abs(n.to.x - n.from.x), height: Math.abs(n.to.y - n.from.y) } : null;
  return /* @__PURE__ */ A(
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
        const f = hf(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const lo = 5e4, Tf = 2e4;
function Rn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function _g(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Pf(e, t = null) {
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
function Ef(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Rf(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function xg(e, t) {
  var r;
  const n = Rf(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Ag(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function Mf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Nf(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Nf(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function _f(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Mf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: Ef(o.selection, n),
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
function xf(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Rn(e.question.text, lo), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Rn(e.answer.text, lo),
      thought: e.answer.thought ? Rn(e.answer.thought, Tf) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Af(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Lf(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Cf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Df(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const $f = 50, Va = 2, Mn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Of() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function uo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function zf({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = E(!1), [i, c] = E(Mn), [l, u] = E(!1), [f, d] = E(""), [m, g] = E("idle"), [h, b] = E(null), [k, S] = E([]), y = N((F) => {
    b(F), S([]);
  }, []), w = N((F) => S((K) => [...K, F].slice(-Va)), []), [v, M] = E(() => /* @__PURE__ */ new Map()), L = _(/* @__PURE__ */ new Set()), x = _(/* @__PURE__ */ new Map()), z = (F) => {
    if (!F) return null;
    const K = x.current.get(F);
    return K || (R.current.records.some((G) => G.message_id === F) ? F : null);
  }, R = _(i);
  R.current = i;
  const I = _(t);
  I.current = t;
  const T = _(0), P = N(async (F, K, G, ie = []) => {
    if (!r) return;
    const se = await r.messages(F.conversation_id, { limit: $f, ...G ? { beforeSeq: G } : {} }), me = [...se.messages, ...ie];
    T.current += 1, c({
      conversation: F,
      main: K ?? F,
      records: me,
      compactions: se.compactions || [],
      hasMore: se.has_more,
      key: `${F.conversation_id}:${T.current}`,
      initial: _f(me, se.compactions || [], I.current.documentId)
    });
  }, [r]), C = N(async () => {
    s(!0);
    const F = R.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) === "main" && F.status !== "archived")) {
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
  }, [r, P]), D = N((F) => {
    y(F), C();
  }, [C]), U = _(t.documentId);
  $(() => {
    U.current !== t.documentId && (U.current = t.documentId, R.current = Mn, c(Mn), y(null), M(/* @__PURE__ */ new Map()), x.current.clear(), a && C());
  }, [t.documentId, a, C]);
  const W = N(async () => {
    const F = R.current, K = F.records[0];
    if (!(!F.conversation || !K || !F.hasMore)) {
      u(!0);
      try {
        await P(F.conversation, F.main, K.seq, F.records);
      } finally {
        u(!1);
      }
    }
  }, [P]), X = N(async (F) => {
    const G = R.current.conversation;
    if (!r || !G) return;
    for (const te of F.memoryIds) L.current.add(te);
    let ie = F.memoryIds;
    if (!ie.length && o && F.startedAt) {
      const te = Lf(
        await o.list({ source_conversation_id: G.conversation_id, created_after: Af(F.startedAt) }).catch(() => []),
        L.current
      );
      for (const B of te) L.current.add(B.id);
      ie = te.map((B) => B.id);
      const be = F.answerId;
      te.length && be && M((B) => new Map(B).set(be, te));
    }
    const se = xf({ ...F, memoryIds: ie }, I.current.documentId, Of(), z(F.editedFrom));
    let me;
    try {
      me = await r.append(G.conversation_id, se);
    } catch (te) {
      if (G.kind !== "side" || !/ask_conversation_not_open/.test(uo(te))) throw te;
      await r.reopen(G.conversation_id), me = await r.append(G.conversation_id, se);
    }
    const [ke, le] = me.messages;
    F.questionId && ke && x.current.set(F.questionId, ke.message_id), F.answerId && le && x.current.set(F.answerId, le.message_id), c((te) => {
      var be;
      return ((be = te.conversation) == null ? void 0 : be.conversation_id) === G.conversation_id ? { ...te, conversation: me.conversation, records: [...te.records, ...me.messages] } : te;
    }), n == null || n(me.messages), me.compaction_due && G.kind === "main" && r.compact(G.conversation_id).catch(() => {
    });
  }, [r, o, n]), H = N(async (F) => {
    const K = R.current.conversation, G = z(F);
    if (!r || !K || !G) return null;
    try {
      await r.supersede(K.conversation_id, G);
    } catch (me) {
      if (!/ask_message_superseded/.test(uo(me))) throw me;
    }
    const ie = R.current.records.find((me) => me.message_id === G), se = R.current.records.findIndex((me) => me.message_id === G);
    return c((me) => ({ ...me, records: me.records.map((ke, le) => le >= se && se >= 0 && !ke.superseded_at ? { ...ke, superseded_at: "now" } : ke) })), (ie == null ? void 0 : ie.selection) ?? null;
  }, [r]), J = N((F) => {
    X(F).catch((K) => d(`这一轮没存上：${K instanceof Error ? K.message : String(K)}`));
  }, [X]), ee = N(async (F) => {
    var ie;
    const K = R.current, G = K.main;
    if (!(!r || !G || ((ie = K.conversation) == null ? void 0 : ie.kind) !== "main")) {
      d("");
      try {
        const se = Cf(K.records, F), me = await r.fork({
          parent_id: G.conversation_id,
          ...se ? { forked_from_message_id: se } : {},
          title: Df(F.text),
          ...I.current.documentId ? { document_id: I.current.documentId } : {}
        });
        await P(me, G);
      } catch (se) {
        d(`开不了副对话：${se instanceof Error ? se.message : String(se)}`);
      }
    }
  }, [r, P]), ge = N(async (F) => {
    const K = R.current.main;
    if (r)
      try {
        await P(await r.get(F), K);
      } catch (G) {
        d(`打不开副对话：${G instanceof Error ? G.message : String(G)}`);
      }
  }, [r, P]), Y = N(async () => {
    const F = R.current.main;
    F && await P(F, F).catch(() => {
    });
  }, [P]), ue = N(async () => {
    const F = R.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) !== "side")) {
      g("busy");
      try {
        await r.close(F.conversation_id), g("idle"), await Y();
      } catch {
        g("failed");
      }
    }
  }, [r, Y]), xe = N(async () => r != null && r.archived ? r.archived(I.current.documentId) : [], [r]), ce = N(async (F) => {
    d(""), y(null);
    try {
      await P(F, R.current.main);
    } catch (K) {
      d(`打不开这个对话：${K instanceof Error ? K.message : String(K)}`);
    }
  }, [P, y]), fe = N(async () => {
    const F = R.current.main;
    if (!r || !F) return;
    await r.archive(F.conversation_id);
    const K = await r.main(I.current.documentId || void 0);
    await P(K, K);
  }, [r, P]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: f,
    pending: h,
    setPending: y,
    extras: k,
    addExtra: w,
    closingSide: m,
    notices: v,
    persistent: !!r,
    openMain: C,
    ask: D,
    close: N(() => s(!1), []),
    loadEarlier: W,
    onTurn: J,
    rewrite: H,
    fork: ee,
    openSide: ge,
    backToMain: Y,
    closeSide: ue,
    archiveMain: fe,
    listArchived: xe,
    viewArchived: ce,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function fo(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Pf({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Ff({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = E([]), s = _(0), i = _(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  $(() => {
    var m, g;
    if (a([]), !e || !t) return;
    let f = !1;
    const d = (h) => {
      !f && h.length && a((b) => [...b, ...h]);
    };
    return (m = e.threads) == null || m.list(t).then(
      (h) => d(h.map((b) => ({ key: c(), anchor: b.anchor, threadId: b.threadId, title: b.title }))),
      () => {
      }
    ), (g = e.conversations) == null || g.bookMessages(t).then(
      (h) => d(h.map((b) => fo(b, c(), i.current)).filter((b) => !!b)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = N((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => fo(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = N((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Bf = Vo(() => import("./ReaderAskPanel-DLHaxzl3.js"));
function jf({
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
  activePanel: b = null,
  panelHost: k = null
}) {
  var Fe;
  const S = q(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), y = N((j, V, ne) => {
    const ve = j ? o.find((Z) => Z.itemId === j) : null, Ce = ve ? Et(ve, a, V) : null, O = Ce && Ce.box.page === ne ? pt(Ce, 1, 1) : null;
    return O ? { x: O.left, y: O.top } : null;
  }, [o, a]), w = Ff({ port: e, documentId: t, resetKey: c, pointOf: y }), v = zf({ port: e, book: S, onAppended: w.addRecords }), [M, L] = E(null), x = N(
    (j, V, ne, ve) => Sf({
      pageElement: (j == null ? void 0 : j.closest(`[${Pe}]`)) ?? null,
      clientX: V,
      clientY: ne,
      itemId: i(),
      selection: ve,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), z = N(() => {
    var V;
    const j = co(((V = globalThis.getSelection) == null ? void 0 : V.call(globalThis)) ?? null);
    return !j.text || !j.element || !j.rect ? null : x(j.element, j.rect.left + j.rect.width / 2, j.rect.top + j.rect.height / 2, j.text);
  }, [x]), R = N((j) => {
    L(null), v.ask(j);
  }, [v.ask]);
  $(() => {
    if (!e) return;
    const j = (V) => {
      var Ce;
      if (V.key !== "?" || V.metaKey || V.ctrlKey || V.altKey || V.defaultPrevented) return;
      const ne = V.target;
      if ((Ce = ne == null ? void 0 : ne.closest) != null && Ce.call(ne, "input, textarea, select, [contenteditable='true']")) return;
      const ve = z();
      ve && (V.preventDefault(), V.stopImmediatePropagation(), R(ve));
    };
    return window.addEventListener("keydown", j, !0), () => window.removeEventListener("keydown", j, !0);
  }, [e, z, R]);
  const I = _(/* @__PURE__ */ new Set()), T = ((Fe = v.pending) == null ? void 0 : Fe.selection) || "";
  $(() => {
    T && I.current.add(T);
  }, [T]);
  const P = v.visible && !M, C = v.setPending, [D, U] = E(null), W = !!v.pending;
  $(() => {
    W || U(null);
  }, [W]);
  const X = _(v.pending);
  X.current = v.pending, $(() => {
    if (!P) return;
    let j = null;
    const V = () => {
      j && clearTimeout(j), j = setTimeout(() => {
        const ne = z();
        !ne || I.current.has(ne.selection) || (X.current ? U(ne) : C(ne));
      }, 250);
    };
    return document.addEventListener("selectionchange", V), () => {
      j && clearTimeout(j), document.removeEventListener("selectionchange", V);
    };
  }, [P, z, C]);
  const H = v.addExtra, J = v.extras.length, ee = q(() => {
    if (!D) return null;
    const j = () => {
      I.current.add(D.selection), U(null);
    };
    return {
      label: `第 ${D.page} 页 · ${[...D.selection].length} 字`,
      replace: () => {
        j(), C(D);
      },
      ...J < Va ? { add: () => {
        j(), H(D);
      } } : {},
      dismiss: j
    };
  }, [D, J, C, H]), ge = _(m);
  ge.current = m;
  const Y = N(async ({ page: j, pane: V, region: ne, canvas: ve }) => {
    const Ce = ge.current[V];
    let O;
    if (Ce)
      O = await pf(Ce, j, ne);
    else {
      const Z = ve ?? document.querySelector(`[${Ie}="${V}"] [${Pe}="${j}"] canvas`);
      if (!Z) throw new Error(`第 ${j} 页还没画出来，翻到那一页再试`);
      O = await gf(Z, ne);
    }
    return new File([O], bf(j, ne), { type: "image/png" });
  }, []), [ue, xe] = E(null), ce = _(v.pending);
  ce.current = v.pending;
  const fe = q(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(qs, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const j = ce.current, V = (j == null ? void 0 : j.pane) || (h === "translated" ? "translated" : "source");
      return Y({ page: (j == null ? void 0 : j.page) || g() || 1, pane: V, region: lr });
    }
  }], [Y, g, h]), [F, K] = E(!1), [G, ie] = E(""), se = N(async (j) => {
    K(!1), ie("");
    try {
      const V = await Y(j), ne = x(j.point.target, j.point.x, j.point.y, "");
      xe((ve) => ({ id: ((ve == null ? void 0 : ve.id) || 0) + 1, files: [V] })), ne ? R({ ...ne, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (V) {
      ie(V instanceof Error ? V.message : String(V));
    }
  }, [Y, x, R]), me = N(() => K(!1), []), ke = N(() => {
    ie(""), K((j) => !j);
  }, []), le = N(async (j) => {
    if (j.threadId && (e != null && e.threads) && t) {
      try {
        const V = await e.threads.get(t, j.threadId);
        L({ anchor: V.anchor || j.anchor, messages: V.messages || [], mark: j });
      } catch {
        L({ anchor: j.anchor, messages: [], mark: j });
      }
      return;
    }
    L(null), v.openMain();
  }, [e, t, v.openMain]), te = N((j) => {
    var ve;
    if (!e) return [];
    const V = co(((ve = globalThis.getSelection) == null ? void 0 : ve.call(globalThis)) ?? null), ne = x(j.target, j.clientX, j.clientY, V.element ? V.text : "");
    return ne ? [{
      key: "ask",
      label: ne.selection ? "问这段" : "在这里提问",
      hint: ne.selection ? "?" : void 0,
      onSelect: () => R(ne)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        ie(""), K(!0);
      }
    }] : [];
  }, [e, x, R]), be = M ? {
    anchor: M.anchor,
    messages: M.messages,
    onClose: () => L(null),
    onDelete: e != null && e.threads && M.mark.threadId ? () => {
      e.threads.remove(t, M.mark.threadId).catch(() => {
      }), w.removeMark(M.mark.key), L(null);
    } : void 0
  } : null, B = q(() => f ? (j, V) => {
    f(j, V ?? void 0), requestAnimationFrame(() => d(j, "translated"));
  } : null, [f, d]), oe = N((j) => Na(o, j), [o]), [he, Ae] = E(0), Me = N(({ mode: j, width: V }) => {
    Ae(j === "dock" ? Math.round(V) : 0);
  }, []), Ee = !v.persistent || !!v.view.conversation || !!v.error, ze = e && (v.visible && Ee || M) ? /* @__PURE__ */ p(Ko, { fallback: null, children: /* @__PURE__ */ p(
    Bf,
    {
      port: e,
      jobId: n,
      book: S,
      ask: v,
      legacy: be,
      onShowSelection: ({ page: j, pane: V }) => l(j, V),
      onJumpToPage: (j) => l(j),
      pageCount: u,
      onLayout: Me,
      dockTaken: b !== null,
      dockHost: k,
      onEditBlock: B,
      canEditBlock: oe,
      attachTools: fe,
      attachRequest: ue,
      contextOffer: ee
    }
  ) }) : null, $e = F || G ? /* @__PURE__ */ A(_e, { children: [
    F ? /* @__PURE__ */ p(If, { onDone: (j) => void se(j), onCancel: me }) : null,
    G ? /* @__PURE__ */ A("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => ie(""), children: [
      "截图没成：",
      G
    ] }) : null
  ] }) : null, Le = v.visible && Ee || !!M, We = v.close, Oe = N(() => {
    if (Le) {
      L(null), We();
      return;
    }
    v.openMain();
  }, [Le, We, v.openMain]);
  return { marks: w.marks, onMark: le, menuItems: te, panel: ze, overlay: $e, cropping: F, toggleCrop: ke, open: v.openMain, toggle: Oe, showing: Le, reserveRight: Le ? he : 0, enabled: !!e };
}
const Hf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Uf() {
  const e = Zt(), t = q(() => {
    try {
      return et().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = jf({
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
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: f, showing: d, reserveRight: m } = n, g = q(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Js,
      pressed: d,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: Gs,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: h, height: b }) => /* @__PURE__ */ p(ff, { marks: r, page: h, height: b, onOpen: o }) : void 0,
    shortcuts: Hf,
    reserveRight: m,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, m, c, l]);
  return yn(g), /* @__PURE__ */ A(_e, { children: [
    s,
    i
  ] });
}
const Wf = { id: "ask", title: "提问", Component: Uf };
function jn() {
  try {
    return et().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Kf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Vf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function qf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Jf({ documentId: e, jobId: t }) {
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
  const s = Vf(n, t, o);
  return q(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Gf({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = E(null), [s, i] = E(""), [c, l] = E(""), u = _(0);
  $(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = N((g) => {
    const h = jn(), b = n.find((S) => S.versionId === g);
    if (!h || !b || !e) return;
    const k = ++u.current;
    i(g), l(""), (async () => {
      const S = et(), y = await h.resolveJob(e, g);
      if (!y) throw new Error("这一份还没有能读的译文。");
      const w = await S.loadReaderPayload(y, { includeOptionalArtifacts: !0 }), v = S.resolveReaderTranslatedPdfUrl(w.jobPayload, w.manifestPayload);
      if (!v) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: b.name, jobId: y, url: v, regions: Kf(Jo(w.regionsPayload)) };
    })().then((S) => {
      k === u.current && a(S);
    }).catch((S) => {
      k === u.current && l((S == null ? void 0 : S.message) || "这一份打不开。");
    }).finally(() => {
      k === u.current && i("");
    });
  }, [e, n]), d = N(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), m = N(async () => {
    var b, k;
    const g = jn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (S) {
      l((S == null ? void 0 : S.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (b = globalThis.location) == null ? void 0 : b.href;
    h && ((k = globalThis.history) == null || k.replaceState(globalThis.history.state, "", qf(h, o.jobId))), a(null);
  }, [o, e]);
  return q(() => ({
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
function Xf(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Xs,
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(Fd, { compare: e, onDone: t })
  } : null;
}
function Yf(e) {
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
function Zf() {
  var i;
  const e = Zt(), t = Gf({
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
  const s = q(() => {
    const c = Xf(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Yf(t) };
  }, [t]);
  return yn(s), null;
}
const Qf = { id: "compare", title: "对比版本", Component: Zf }, qa = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], mo = { pen: 35e-4, highlighter: 0.018 }, ho = 0.015, Hn = "retainpdf.reader.ink.v1:";
function po(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Hn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function em(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Hn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Hn + e);
    } catch {
    }
}
function tm(e, t, n, r, o, a) {
  const s = ho * ho;
  return e.filter((i) => Ja(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Ja(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function nm(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function rm(e) {
  const [t, n] = E(null), [r, o] = E(qa[0].key), [a, s] = E(() => po(e)), i = _(a), c = _([]);
  $(() => {
    const h = po(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = N((h) => {
    i.current = h, s(h), em(e, h);
  }, [e]), u = N((h) => {
    const b = i.current, k = h(b);
    k !== b && (c.current = [...c.current.slice(-49), b], l(k));
  }, [l]), f = N((h) => {
    h.points.length < 1 || u((b) => [...b, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = N((h) => {
    h.length && u((b) => b.filter((k) => !h.includes(k.id)));
  }, [u]), m = N((h) => {
    u((b) => b.some((k) => k.page === h) ? b.filter((k) => k.page !== h) : b);
  }, [u]), g = N(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return q(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const om = [
  { tool: "pen", label: "画笔", Icon: Qn },
  { tool: "highlighter", label: "荧光笔", Icon: Ys },
  { tool: "eraser", label: "橡皮", Icon: Zs }
];
function am(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function sm({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ A(_e, { children: [
    om.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      ae,
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
    qa.map((o) => /* @__PURE__ */ p(
      ae,
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
    /* @__PURE__ */ p(ae, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Qs, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      ae,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(ei, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      ae,
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
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(sm, { ink: e, page: t, onPick: n }) });
}
function im(e) {
  const t = _(e);
  t.current = e, $(() => {
    const n = (r) => {
      if (am(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const cm = "reader-ink-layer";
function lm(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function bo({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: lm(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function um({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = E(null), i = _(!1), c = o.strokes.filter((h) => Ja(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const b = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - b.left) / Math.max(1, b.width))),
      Math.min(1, Math.max(0, (h.clientY - b.top) / Math.max(1, b.height)))
    ];
  }, f = (h, b) => o.erase(tm(o.strokes, e, t, h, b, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [b, k] = u(h);
    o.tool === "eraser" ? f(b, k) : s([[b, k]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [b, k] = u(h);
    o.tool === "eraser" ? f(b, k) : s((S) => S ? nm(S, b, k) : [[b, k]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: mo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ A(
    "svg",
    {
      className: cm,
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
const dm = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function fm(e) {
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
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(um, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: dm
  };
}
function mm() {
  const e = Zt(), t = rm(e.resetKey);
  im(t);
  const n = q(() => fm(t), [t]);
  return yn(n), null;
}
const hm = { id: "ink", title: "画笔", Component: mm }, pm = Wo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ A(
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
}), gm = pm;
function bm(e) {
  const t = _(!1);
  return e && (t.current = !0), t.current;
}
const ym = Vo(() => import("./ReaderMarkdownPanel-Crsi0Cgs.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Ga = { id: "markdown", label: "Markdown", short: "MD", Icon: gm, needsJob: !0 };
function vm() {
  const e = Zt(), t = e.activePanel === Ga.id;
  if (!bm(t)) return null;
  const r = /* @__PURE__ */ p(Ko, { fallback: null, children: /* @__PURE__ */ p(ym, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? ci(r, e.panelHost) : r;
}
const wm = {
  id: "markdown",
  title: "Markdown",
  Component: vm,
  panels: [Ga]
}, Xa = "reader-xref", Un = "data-xref", Ot = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Sm = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Ot})`), km = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Wn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Im(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Tm(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Pm(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = He(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Em(e, t, n) {
  return (e.find((o) => He(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Rm(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = He(r), s = Tm(r);
    if (a === "formula") {
      for (const g of s.matchAll(km)) {
        const h = Wn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Sm.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = Im(i[1]), u = Wn(i[2]), f = Pm(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Em(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Mm = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Ot})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Ot})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Ot})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Ot})\s*[）)]`, "g"), kind: () => "equation" }
];
function Nm(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Mm) {
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
  return Nm(e, t).map((n) => ({ start: n.start, end: n.end, className: Xa, attrs: { [Un]: n.key } }));
}
const xm = { figure: "图", table: "表", equation: "式" };
function yo(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${xm[e.kind]} ${e.label}`;
}
const vo = { figure: "图", table: "表", formula: "公式", text: "文字" }, nt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Am(e, t, n) {
  const r = Et(e, t, n), o = r ? pt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Ha({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Lm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = Et(u, t, n), d = f ? pt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Ha({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Cm(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function Dm(e, t) {
  const n = (o) => {
    const a = He(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function $m({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var z;
  const i = t.find((R) => R.itemId === e) ?? null, c = q(() => i ? Dm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = E(nt.indexOf(1)), d = nt[u], m = _(null), [g, h] = E(0);
  De(() => {
    const R = m.current;
    if (!R) return;
    const I = () => h(R.clientWidth);
    I();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return T == null || T.observe(R), () => T == null ? void 0 : T.disconnect();
  }, []);
  const b = N((R) => {
    const I = c[l + R];
    I && a(I.itemId);
  }, [c, l, a]);
  $(() => {
    const R = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), b(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), b(1);
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
    return window.addEventListener("keydown", R, !0), () => window.removeEventListener("keydown", R, !0);
  }, [s, b]), $(() => {
    const R = m.current;
    if (!R) return;
    const I = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), f((P) => Math.max(0, Math.min(nt.length - 1, P + (T.deltaY < 0 ? 1 : -1)))));
    };
    return R.addEventListener("wheel", I, { passive: !1 }), () => R.removeEventListener("wheel", I);
  }, []);
  const k = _(null);
  if (!i) return null;
  const S = He(i), y = o.map((R) => ({ pane: R, pdf: r[R] ?? null, where: Am(i, n, R) })).filter((R) => !!(R.pdf && R.where)), w = 16, v = typeof window > "u" ? 800 : window.innerHeight, M = Math.min(880, v * 0.9) - 56 - 32 - (y.length > 1 ? 26 : 0), L = y.length ? Cm(Math.max(120, (g - w * (y.length - 1) - 32) / y.length), M, y.map((R) => R.where.aspect)) : 0, x = ((z = y[0]) == null ? void 0 : z.where.page) ?? i.source.page;
  return /* @__PURE__ */ A("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${vo[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ A("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ A("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ A("span", { className: "reader-zoom-title", children: [
          vo[S] ?? "这一块",
          " · 第 ",
          x,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ A("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => b(-1), children: /* @__PURE__ */ p(Go, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => b(1), children: /* @__PURE__ */ p(ta, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((R) => Math.max(0, R - 1)), children: /* @__PURE__ */ p(na, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ A(ae, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(nt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === nt.length - 1, onClick: () => f((R) => Math.min(nt.length - 1, R + 1)), children: /* @__PURE__ */ p(ra, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(Xt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (R) => {
            const I = m.current;
            !I || R.button !== 0 || (k.current = { x: R.clientX, y: R.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(R.pointerId));
          },
          onPointerMove: (R) => {
            const I = m.current, T = k.current;
            !I || !T || (I.scrollLeft = T.left - (R.clientX - T.x), I.scrollTop = T.top - (R.clientY - T.y));
          },
          onPointerUp: () => {
            k.current = null;
          },
          children: y.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: w }, children: y.map(({ pane: R, pdf: I, where: T }) => /* @__PURE__ */ A("figure", { className: "reader-zoom-column", children: [
            y.length > 1 ? /* @__PURE__ */ p("figcaption", { children: R === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Wa,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: T.page,
                region: T.fraction,
                cssWidth: L * d,
                label: `${R === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, R)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Om = 380, zm = 320, yt = 8;
function Fm(e, t, n) {
  const r = Math.max(yt, Math.min(e.left, n.width - t.width - yt)), o = e.bottom + yt, a = o + t.height <= n.height - yt ? o : Math.max(yt, e.top - yt - t.height);
  return { left: r, top: a };
}
function Bm({
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
    const m = r[d], g = m ? Lm(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Om, zm / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = Fm(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ A("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ A("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: yo(e.target) }),
      /* @__PURE__ */ A("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Wa, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: yo(e.target) })
  ] });
}
const jm = 250;
function Hm(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Um(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Wm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Km({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = E(null), [s, i] = E({ back: [], forward: [] }), c = _(s);
  c.current = s;
  const l = _(null), u = _({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = N(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Ft(m, g);
  }, []);
  $(() => {
    if (!e) return;
    const m = (y) => {
      var w, v;
      return (v = (w = y.target) == null ? void 0 : w.closest) == null ? void 0 : v.call(w, `.${Xa}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (y) => {
      var L;
      const w = m(y);
      if (!w) return;
      const v = u.current.index.get(w.getAttribute(Un) || "");
      if (!v) return;
      const M = ((L = w.closest("[data-reader-pane]")) == null ? void 0 : L.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const x = w.getBoundingClientRect();
        a({ target: v, pane: M, anchor: { left: x.left, top: x.top, right: x.right, bottom: x.bottom } });
      }, jm);
    }, b = (y) => {
      const w = m(y);
      !w || w.contains(y.relatedTarget) || (g(), a(null));
    }, k = (y) => {
      var x, z;
      const w = m(y);
      if (!w || y.button !== 0 || y.metaKey || y.ctrlKey || y.shiftKey || `${((x = window.getSelection) == null ? void 0 : x.call(window)) || ""}`.trim()) return;
      const v = u.current.index.get(w.getAttribute(Un) || "");
      if (!v) return;
      y.preventDefault(), y.stopPropagation(), g(), a(null);
      const M = ((z = w.closest("[data-reader-pane]")) == null ? void 0 : z.getAttribute("data-reader-pane")) || u.current.primaryPane, L = f();
      L && i((R) => Hm(R, L)), u.current.follow(v, M);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", b), e.addEventListener("click", k, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", b), e.removeEventListener("click", k, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = N((m) => {
    const g = f();
    if (!g) return !1;
    const h = Um(c.current, g, m);
    if (!h) return !1;
    const { shellEl: b, primaryPane: k } = u.current;
    return Rt(b, h.to, "auto", k) ? (i(h.history), !0) : !1;
  }, [f]);
  return $(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Wm(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [d]), {
    preview: o,
    closePreview: N(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: N(() => d("back"), [d])
  };
}
const Vm = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function qm() {
  const e = Zt(), t = q(() => Rm(e.regions), [e.regions]), { jumpToBlock: n } = e, r = N((s, i) => n(s.itemId, i), [n]), o = Km({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = q(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => _m(s, t) : void 0,
    shortcuts: Vm
  }), [t]);
  return yn(a), /* @__PURE__ */ A(_e, { children: [
    o.preview ? /* @__PURE__ */ p(Bm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ A(ae, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(ti, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const Jm = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: qm }, ur = [hm, wm, Qf, Jm, Wf];
function dr(e = ur) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Gm(e) {
  const t = tt(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(_e, { children: (e.tabs ?? dr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, f = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ A(
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
function Xm(e) {
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
  return n ? /* @__PURE__ */ A("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: d, badge: m, onClick: g }) => /* @__PURE__ */ A(
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
function Ym(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Zm(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Qm(e) {
  return e / 100 * window.innerHeight;
}
function eh(e) {
  return e / 100 * window.innerWidth;
}
function th(e) {
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
  const [o, a] = th(n);
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
      r = Zm(t, o);
      break;
    }
    case "em": {
      r = Ym(t, o);
      break;
    }
    case "vh": {
      r = Qm(o);
      break;
    }
    case "vw": {
      r = eh(o);
      break;
    }
  }
  return r;
}
function Ne(e) {
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
      s = Ne(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ne(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ne(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = zt({
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
function pe(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Vn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? nh : rh
  );
}
function nh(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function rh(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Ya(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Za(e, t) {
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
function oh({
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
    const { x: i, y: c } = Za(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return pe(o, "No rect found"), o;
}
let rn;
function ah() {
  return rn === void 0 && (typeof matchMedia == "function" ? rn = !!matchMedia("(pointer:coarse)").matches : rn = !1), rn;
}
function Qa(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Vn(
    n,
    Array.from(t.children).filter(Ya).map((g) => ({ element: g }))
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
        const b = r.find(
          (k) => k.element === h
        );
        if (b) {
          if (d) {
            const k = d.element.getBoundingClientRect(), S = h.getBoundingClientRect();
            let y;
            if (c) {
              const w = n === "horizontal" ? new DOMRect(
                k.right,
                k.top,
                0,
                k.height
              ) : new DOMRect(
                k.left,
                k.bottom,
                k.width,
                0
              ), v = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (m.length) {
                case 0: {
                  y = [
                    w,
                    v
                  ];
                  break;
                }
                case 1: {
                  const M = m[0], L = oh({
                    orientation: n,
                    rects: [k, S],
                    targetRect: M.element.getBoundingClientRect()
                  });
                  y = [
                    M,
                    L === k ? v : w
                  ];
                  break;
                }
                default: {
                  y = m;
                  break;
                }
              }
            } else
              m.length ? y = m : y = [
                n === "horizontal" ? new DOMRect(
                  k.right,
                  S.top,
                  S.left - k.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  k.bottom,
                  S.width,
                  S.top - k.bottom
                )
              ];
            for (const w of y) {
              let v = "width" in w ? w : w.element.getBoundingClientRect();
              const M = ah() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (v.width < M) {
                const x = M - v.width;
                v = new DOMRect(
                  v.x - x / 2,
                  v.y,
                  v.width + x,
                  v.height
                );
              }
              if (v.height < M) {
                const x = M - v.height;
                v = new DOMRect(
                  v.x,
                  v.y - x / 2,
                  v.width,
                  v.height + x
                );
              }
              const L = g <= l || g > u;
              !i && !L && s.push({
                group: e,
                groupSize: Mt({ group: e }),
                panels: [d, b],
                separator: "width" in w ? void 0 : w,
                rect: v
              }), i = !1;
            }
          }
          c = !1, d = b, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const b = o.find(
          (k) => k.element === h
        );
        b ? m.push(b) : (d = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var ot;
class es {
  constructor() {
    Nr(this, ot, {});
  }
  addListener(t, n) {
    const r = _t(this, ot)[t];
    return r === void 0 ? _t(this, ot)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = _t(this, ot)[t];
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
    _r(this, ot, {});
  }
  removeListener(t, n) {
    const r = _t(this, ot)[t];
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
const fr = new es();
function ft() {
  return Tt;
}
function sh(e) {
  return fr.addListener("change", e);
}
function ih(e) {
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
const ch = (e) => e, Nn = () => {
}, ts = 1, ns = 2, rs = 4, os = 8, wo = 3, So = 12;
let on;
function ko() {
  return on === void 0 && (on = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (on = !0)), on;
}
function lh({
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
          const a = (e & ts) !== 0, s = (e & ns) !== 0, i = (e & rs) !== 0, c = (e & os) !== 0;
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
      const o = lh({
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
let Ve = /* @__PURE__ */ new Map();
const as = new es();
function uh(e) {
  Ve = new Map(Ve), Ve.delete(e);
}
function To(e, t) {
  for (const [n] of Ve)
    if (n.id === e)
      return n;
}
function st(e, t) {
  for (const [n, r] of Ve)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function gt() {
  return Ve;
}
function hr(e, t) {
  return as.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Qe(e, t, n) {
  const r = Ve.get(e);
  Ve = new Map(Ve), Ve.set(e, t), as.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function ss(e) {
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
  e.defaultPrevented || ss(e.currentTarget);
}
function dh(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Za(n, a.rect);
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
function fh(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function mh(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Mo(e),
    b: Mo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  pe(
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
const hh = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function ph(e) {
  const t = getComputedStyle(is(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function gh(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || ph(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || hh.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Eo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (pe(n, "Missing node"), gh(n)) return n;
  }
  return null;
}
function Ro(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Mo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = is(e);
  return t;
}
function is(e) {
  const { parentNode: t } = e;
  return fh(t) ? t.host : t;
}
function bh(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function yh({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Ya(n) || n.contains(e) || e.contains(n))
    return !0;
  if (mh(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (bh(r.getBoundingClientRect(), t))
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
    const a = Qa(o), s = dh(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && yh({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function vh(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Re(e, t, n = 0) {
  return Math.abs(Ne(e) - Ne(t)) <= n;
}
function Ke(e, t) {
  return Re(e, t) ? 0 : e > t ? 1 : -1;
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
  if (Ke(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Ke(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Ne(r), r;
}
function Kt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Re(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  pe(u != null, "Invalid first pivot index"), pe(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, b = n[h];
        pe(
          b,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: k = 0,
          collapsible: S,
          minSize: y = 0
        } = b;
        if (S) {
          const w = i[h];
          if (pe(
            w != null,
            `Previous layout not found for panel index ${h}`
          ), Re(w, k)) {
            const v = y - w;
            Ke(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      {
        const h = e < 0 ? u : f, b = n[h];
        pe(
          b,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: k = 0,
          collapsible: S,
          minSize: y = 0
        } = b;
        if (S) {
          const w = i[h];
          if (pe(
            w != null,
            `Previous layout not found for panel index ${h}`
          ), Re(w, y)) {
            const v = w - k;
            Ke(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, b = n[h];
      pe(
        b,
        `Panel constraints not found for index ${h}`
      );
      const k = i[h], { collapsible: S, collapsedSize: y, minSize: w } = b;
      if (S && Ke(k, w) < 0)
        if (e > 0) {
          const v = w - y, M = v / 2, L = k + e;
          Ke(L, w) < 0 && (e = Ke(e, M) <= 0 ? 0 : v);
        } else {
          const v = w - y, M = 100 - v / 2, L = k - e;
          Ke(L, w) < 0 && (e = Ke(100 + e, M) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let b = e < 0 ? f : u, k = 0;
    for (; ; ) {
      const y = i[b];
      pe(
        y != null,
        `Previous layout not found for panel index ${b}`
      );
      const w = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[b],
        prevSize: y,
        size: 100
      }) - y;
      if (k += w, b += h, b < 0 || b >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(k));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? u : f;
    for (; h >= 0 && h < n.length; ) {
      const b = Math.abs(e) - Math.abs(d), k = i[h];
      pe(
        k != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = k - b, y = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: k,
        size: S
      });
      if (!Re(k, y) && (d += k - y, l[h] = y, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (vh(c, l))
    return o;
  {
    const h = e < 0 ? f : u, b = i[h];
    pe(
      b != null,
      `Previous layout not found for panel index ${h}`
    );
    const k = b + d, S = kt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: b,
      size: k
    });
    if (l[h] = S, !Re(S, k)) {
      let y = k - S, w = e < 0 ? f : u;
      for (; w >= 0 && w < n.length; ) {
        const v = l[w];
        pe(
          v != null,
          `Previous layout not found for panel index ${w}`
        );
        const M = v + y, L = kt({
          overrideDisabledPanels: s,
          panelConstraints: n[w],
          prevSize: v,
          size: M
        });
        if (Re(v, L) || (y -= L - v, l[w] = L), Re(y, 0))
          break;
        e > 0 ? w-- : w++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, b) => b + h,
    0
  );
  if (!Re(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, b, k) => (h[g[k]] = b, h), {});
}
function mt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ke(e[n], t[n]) !== 0)
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
  if (!Re(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      pe(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    pe(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    pe(l != null, `No layout data found for index ${i}`);
    const u = kt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!Re(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      pe(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = kt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Re(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function cs({
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
    const d = a(), m = l.findIndex((b) => b.id === t), g = m === 0, h = m === l.length - 1;
    if (h && c < d && (g || l.slice(0, m).every((b, k) => {
      const S = f[k];
      return (S == null ? void 0 : S.collapsible) && Re(S.collapsedSize, u[S.panelId]);
    }))) {
      const b = l.slice(0, m).reduce((k, S) => k + u[S.id], 0);
      return {
        ...u,
        [t]: Ne(100 - b)
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
    } = n(), b = s({
      nextSize: c,
      panels: d.panels,
      prevLayout: g,
      derivedPanelConstraints: f
    }), k = ht({
      layout: b,
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
      return c && Re(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = Mt({ group: l }), d = zt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ne(d / f * 100);
      i(m);
    }
  };
}
function No(e) {
  if (e.defaultPrevented)
    return;
  const t = gt();
  pr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = cs({
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
function ls({
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
  pe(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  pe(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = ls({ groupId: n.id }).getLayout(), c = Kt({
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
function _o(e) {
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
        pe(c, "Matching separator not found");
        const l = i.get(c);
        pe(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (pe(f, "Panel metadata not found"), f.collapsible) {
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
        pe(o !== null, "Index not found");
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
function us({
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
    const b = r.get(u), k = o.get(u);
    if (!b || !k)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: y,
      groupSize: w,
      layout: v,
      separatorToPanels: M
    } = k;
    if (y && v && M) {
      const L = Kt({
        delta: h,
        initialLayout: b,
        panelConstraints: y,
        pivotIndices: l.panels.map((x) => m.indexOf(x)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (mt(L, v)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? ts : ns;
              break;
            }
            case "vertical": {
              i |= h < 0 ? rs : os;
              break;
            }
          }
      } else
        Qe(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: y,
          groupSize: w,
          layout: L,
          separatorToPanels: M
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & wo : c |= i & wo, t.movementY === 0 ? c |= s & So : c |= i & So, ih(c), mr(e);
}
function Ao(e) {
  const t = gt(), n = ft();
  switch (n.state) {
    case "active":
      us({
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
      us({
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
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || ss(e.currentTarget) && e.preventDefault();
}
function $o(e) {
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
function wh(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = Mt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Ne(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Sh(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function kh({
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
function Ih(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const vt = /* @__PURE__ */ new Map();
function Th(e) {
  let t = !0;
  pe(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: b, target: k } = h;
      if (k === e.element) {
        if (t) {
          const S = Mt({ group: e });
          if (S === 0)
            return;
          const y = st(e.id);
          if (!y)
            return;
          const w = Kn(e), v = y.defaultLayoutDeferred ? $o(w) : y.layout, M = kh({
            group: e,
            nextGroupSize: S,
            prevGroupSize: y.groupSize,
            prevLayout: v
          }), L = ht({
            layout: M,
            panelConstraints: w
          });
          if (!y.defaultLayoutDeferred && mt(y.layout, L) && Sh(
            y.derivedPanelConstraints,
            w
          ) && y.groupSize === S)
            return;
          Qe(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: w,
            groupSize: S,
            layout: L,
            separatorToPanels: y.separatorToPanels
          });
        }
      } else
        wh(e, k, b);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    pe(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Mt({ group: e }), i = Kn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Ih(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? $o(i), f = ht({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  vt.set(
    d,
    (vt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Qa(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Qe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    pe(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", _o);
  }), vt.get(d) === 1 && (d.addEventListener("contextmenu", Po, !0), d.addEventListener("dblclick", No, !0), d.addEventListener("pointerdown", xo, !0), d.addEventListener("pointerleave", Ao), d.addEventListener("pointermove", Lo), d.addEventListener("pointerout", Co), d.addEventListener("pointerup", Do, !0)), function() {
    t = !1, vt.set(
      d,
      Math.max(0, (vt.get(d) ?? 0) - 1)
    ), uh(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", _o);
    }), vt.get(d) || (d.removeEventListener(
      "contextmenu",
      Po,
      !0
    ), d.removeEventListener(
      "dblclick",
      No,
      !0
    ), d.removeEventListener(
      "pointerdown",
      xo,
      !0
    ), d.removeEventListener("pointerleave", Ao), d.removeEventListener("pointermove", Lo), d.removeEventListener("pointerout", Co), d.removeEventListener("pointerup", Do, !0)), a.disconnect();
  };
}
function Ph() {
  const [e, t] = E({}), n = N(() => t({}), []);
  return [e, n];
}
function gr(e) {
  const t = qo();
  return `${e ?? t}`;
}
const bt = typeof window < "u" ? De : $;
function Bt(e) {
  const t = _(e);
  return bt(() => {
    t.current = e;
  }, [e]), N(
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
  const t = _({ ...e });
  return bt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ds = Gt(null);
function Eh(e, t) {
  const n = _({
    getLayout: () => ({}),
    setLayout: ch
  });
  Zn(t, () => n.current, []), bt(() => {
    Object.assign(
      n.current,
      ls({ groupId: e })
    );
  });
}
function fs({
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
  const g = _({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Bt((I) => {
    mt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), b = Bt(
    (I, T) => {
      mt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), k = gr(i), S = _(null), [y, w] = Ph(), v = _({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), M = br(S, a);
  Eh(k, s);
  const L = Bt(
    (I, T) => {
      const P = ft(), C = To(I), D = st(I);
      if (D) {
        let U = !1;
        switch (P.state) {
          case "active": {
            U = P.hitRegions.some(
              (W) => W.group === C
            );
            break;
          }
        }
        return {
          flexGrow: D.layout[T] ?? 1,
          pointerEvents: U ? "none" : void 0
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
  }), z = q(
    () => ({
      get disableCursor() {
        return !!x.disableCursor;
      },
      getPanelStyles: L,
      id: k,
      orientation: u,
      registerPanel: (I) => {
        const T = v.current;
        return T.panels = Vn(u, [
          ...T.panels,
          I
        ]), w(), () => {
          T.panels = T.panels.filter(
            (P) => P !== I
          ), w();
        };
      },
      registerSeparator: (I) => {
        const T = v.current;
        return T.separators = Vn(u, [
          ...T.separators,
          I
        ]), w(), () => {
          T.separators = T.separators.filter(
            (P) => P !== I
          ), w();
        };
      },
      updatePanelProps: (I, { disabled: T }) => {
        const P = v.current.panels.find(
          (U) => U.id === I
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
        const C = v.current.separators.find(
          (D) => D.id === I
        );
        C && (C.disabled = T, C.disableDoubleClick = P);
      }
    }),
    [L, k, w, u, x]
  ), R = _(null);
  return bt(() => {
    const I = S.current;
    if (I === null)
      return;
    const T = v.current;
    let P;
    if (x.defaultLayout !== void 0 && Object.keys(x.defaultLayout).length === T.panels.length) {
      P = {};
      for (const J of T.panels) {
        const ee = x.defaultLayout[J.id];
        ee !== void 0 && (P[J.id] = ee);
      }
    }
    const C = {
      disabled: !!o,
      element: I,
      id: k,
      mutableState: {
        defaultLayout: P,
        disableCursor: !!x.disableCursor,
        expandedPanelSizes: v.current.lastExpandedPanelSizes,
        layouts: v.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    R.current = C;
    const D = Th(C), { defaultLayoutDeferred: U, derivedPanelConstraints: W, layout: X } = st(C.id, !0);
    !U && W.length > 0 && (h(X), b(X, !1));
    const H = hr(k, (J) => {
      const { defaultLayoutDeferred: ee, derivedPanelConstraints: ge, layout: Y } = J.next;
      if (ee || ge.length === 0)
        return;
      const ue = C.panels.map(({ id: ce }) => ce).join(",");
      C.mutableState.layouts[ue] = Y, ge.forEach((ce) => {
        if (ce.collapsible) {
          const { layout: fe } = J.prev ?? {};
          if (fe) {
            const F = Re(
              ce.collapsedSize,
              Y[ce.panelId]
            ), K = Re(
              ce.collapsedSize,
              fe[ce.panelId]
            );
            F && !K && (C.mutableState.expandedPanelSizes[ce.panelId] = fe[ce.panelId]);
          }
        }
      });
      const xe = ft().state !== "active";
      h(Y), xe && b(Y, J.isUserInteraction);
    });
    return () => {
      R.current = null, D(), H();
    };
  }, [
    o,
    k,
    b,
    h,
    u,
    y,
    x
  ]), $(() => {
    const I = R.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ds.Provider, { value: z, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": k,
      id: k,
      ref: M,
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
fs.displayName = "Group";
function vr() {
  const e = ut(ds);
  return pe(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Rh(e, t) {
  const { id: n } = vr(), r = _({
    collapse: Nn,
    expand: Nn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Nn
  });
  Zn(t, () => r.current, []), bt(() => {
    Object.assign(
      r.current,
      cs({ groupId: n, panelId: e })
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
  const h = !!c, b = gr(c), k = yr({
    disabled: a
  }), S = _(null), y = br(S, s), {
    getPanelStyles: w,
    id: v,
    orientation: M,
    registerPanel: L,
    updatePanelProps: x
  } = vr(), z = f !== null, R = Bt(
    (C, D, U) => {
      f == null || f(C, c, U);
    }
  );
  bt(() => {
    const C = S.current;
    if (C !== null) {
      const D = {
        element: C,
        id: b,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: z ? R : void 0,
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
      return L(D);
    }
  }, [
    i,
    n,
    r,
    o,
    z,
    b,
    h,
    l,
    u,
    R,
    L,
    k
  ]), $(() => {
    x(b, { disabled: a });
  }, [a, b, x]), Rh(b, d);
  const I = () => {
    const C = w(v, b);
    if (C)
      return JSON.stringify(C);
  }, T = hn(
    (C) => hr(v, C),
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
      "data-testid": b,
      id: b,
      ref: y,
      style: {
        ...Mh,
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
            touchAction: M === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
qn.displayName = "Panel";
const Mh = {
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
function Nh({
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
function ms({
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
  }), [u, f] = E({}), [d, m] = E("inactive"), [g, h] = E(!1), b = _(null), k = br(b, o), {
    disableCursor: S,
    id: y,
    orientation: w,
    registerSeparator: v,
    updateSeparatorProps: M
  } = vr(), L = w === "horizontal" ? "vertical" : "horizontal";
  bt(() => {
    const R = b.current;
    if (R !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: R,
        id: c
      }, T = v(I), P = sh(
        (D) => {
          m(
            D.next.state !== "inactive" && D.next.hitRegions.some(
              (U) => U.separator === I
            ) ? D.next.state : "inactive"
          );
        }
      ), C = hr(
        y,
        (D) => {
          const { derivedPanelConstraints: U, layout: W, separatorToPanels: X } = D.next, H = X.get(I);
          if (H) {
            const J = H[0], ee = H.indexOf(J);
            f(
              Nh({
                layout: W,
                panelConstraints: U,
                panelId: J.id,
                panelIndex: ee
              })
            );
          }
        }
      );
      return () => {
        P(), C(), T();
      };
    }
  }, [y, c, v, l]), $(() => {
    M(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, M]);
  let x;
  n && !S && (x = "not-allowed");
  let z;
  if (n)
    z = "disabled";
  else
    switch (d) {
      case "active": {
        z = "active";
        break;
      }
      default:
        g ? z = "focus" : z = d;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": L,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": z,
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
ms.displayName = "Separator";
const wr = 30, Sr = 65, Vt = 50, _h = 100 - Sr, xh = 100 - wr;
function Ah(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Sr, Math.max(wr, t)) : Vt;
}
function kr(e) {
  return 100 - e;
}
function wt(e) {
  return `${e}%`;
}
const Ir = "reader-document", qt = "reader-assistant", hs = "retainpdf.reader.ai-split-layout.v1", Lh = {
  [Ir]: kr(Vt),
  [qt]: Vt
};
function Tr(e) {
  const t = Ah(e == null ? void 0 : e[qt]);
  return {
    [Ir]: kr(t),
    [qt]: t
  };
}
function Ch() {
  try {
    const e = JSON.parse(localStorage.getItem(hs) || "null");
    return Tr(e);
  } catch {
    return Lh;
  }
}
function Dh(e) {
  try {
    localStorage.setItem(hs, JSON.stringify(Tr(e)));
  } catch {
  }
}
function _n(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Tr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[qt]}vw`
  );
}
function $h() {
  const e = _(null), [t] = E(Ch);
  De(() => {
    const o = e.current;
    return _n(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = N((o) => {
    _n(e.current, o);
  }, []), r = N((o, a) => {
    _n(e.current, o), a.isUserInteraction && Dh(o);
  }, []);
  return /* @__PURE__ */ A(
    fs,
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
            maxSize: wt(xh)
          }
        ),
        /* @__PURE__ */ p(
          ms,
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
function Oh({
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
  return /* @__PURE__ */ A("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ A("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ p(ae, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function zh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Oh, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ A(_e, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ A("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ A("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(ae, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Fh(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Bh() {
  const [e, t] = E(!1), n = qo(), r = _(null), o = ja(), a = q(() => [...Al, ...of(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Fh(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ A("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ p(ni, { className: "reader-react-shortcuts-icon", size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ A(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ A("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ A("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: s.title }),
            /* @__PURE__ */ p("ul", { children: s.items.map((i) => /* @__PURE__ */ A("li", { children: [
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
const jh = ["source", "sideBySide", "translated"], Hh = { source: "", translated: "", sideBySide: "" };
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
  return Ii({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Wh(e) {
  const [t, n] = E(() => /* @__PURE__ */ new Set()), r = q(
    () => e ? Uh(e) : Hh,
    [e]
  ), o = q(
    () => jh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = N(async (s) => {
    if (!e) return;
    const i = sn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? ki(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Ti(
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
        Pi(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Kh = {
  source: Zo,
  sideBySide: Qo,
  translated: ea
}, Vh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function qh(e) {
  const t = tt(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Wh(n), i = _(null);
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
  }, []), /* @__PURE__ */ A("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ A("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(ri, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(er, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = Ps[c], u = sn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : Es(c, r), g = Kh[c];
      return /* @__PURE__ */ A(
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
            /* @__PURE__ */ A("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ A("span", { className: "reader-download-action-label", children: [
                Vh[c],
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
const Jh = "retainpdf:reader:bookmarks:v1:", Gh = 200;
function Pr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ps(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Jh}${t}` : "";
}
function Xh(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function jt(e, t = Pr()) {
  const n = ps(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Xh(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const Jn = /* @__PURE__ */ new Set();
function Yh(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return Jn.add(n), () => {
    Jn.delete(n);
  };
}
function Gn(e, t, n) {
  const r = ps(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Gh);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...Jn]) a(e);
  return o;
}
function Zh(e, t, n = "", { storage: r = Pr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = jt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Gn(e, a.filter((i) => i.page !== s), r) : Gn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Qh(e, t, n = Pr()) {
  return Gn(e, jt(e, n).filter((r) => r.page !== t), n);
}
function ep(e, t) {
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
function gs(e, t) {
  const [n, r] = E(() => jt(e));
  $(() => (r(jt(e)), Yh(e, () => r(jt(e)))), [e]);
  const o = N((s) => {
    r(Zh(e, s, ep(t, s)));
  }, [e, t]), a = N((s) => r(Qh(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
function tp({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "14", height: "14", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function np({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = gs(e, r);
  if (!e || n <= 0) return null;
  const s = Math.min(Math.max(t, 1), n), i = o.some((c) => c.page === s);
  return /* @__PURE__ */ A("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", children: [
    /* @__PURE__ */ A(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-mark${i ? " is-marked" : ""}`,
        "aria-pressed": i,
        "aria-label": i ? `取消第 ${s} 页的书签` : `给第 ${s} 页加书签`,
        title: i ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）",
        onClick: () => a(s),
        children: [
          /* @__PURE__ */ p(tp, { filled: i }),
          /* @__PURE__ */ p("span", { className: "reader-bottombar-label", children: i ? "已加书签" : "书签" })
        ]
      }
    ),
    /* @__PURE__ */ p(rp, {})
  ] });
}
function rp() {
  const [e, t] = E(!1), n = _(null);
  return $(() => {
    if (!e) return;
    const r = (a) => {
      var s;
      (s = n.current) != null && s.contains(a.target) || t(!1);
    }, o = (a) => {
      a.key === "Escape" && t(!1);
    };
    return document.addEventListener("pointerdown", r, !0), document.addEventListener("keydown", o), () => {
      document.removeEventListener("pointerdown", r, !0), document.removeEventListener("keydown", o);
    };
  }, [e]), /* @__PURE__ */ A("span", { className: "reader-favorites", ref: n, children: [
    /* @__PURE__ */ A(
      ae,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": e,
        "aria-haspopup": "dialog",
        title: "收藏（还在做）",
        onClick: () => t((r) => !r),
        children: [
          /* @__PURE__ */ p(oi, { size: 14, strokeWidth: 2, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-bottombar-label", children: "收藏" })
        ]
      }
    ),
    e ? /* @__PURE__ */ A("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ p("strong", { children: "收藏" }),
      /* @__PURE__ */ p("p", { children: "还在做：以后可以把喜欢的段落、整页收在这里，按书分好，随时翻回来。现在先用「书签」记页。" })
    ] }) : null
  ] });
}
function op(e) {
  const t = tt(), n = ir(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = fc(a), f = a > da + 1e-3, d = a < fn - 1e-3, m = St(r, It()), g = m >= fn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, b] = E(!1), [k, S] = E(`${i}`);
  $(() => {
    h || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const y = () => {
    if (b(!1), !l || c <= 0)
      return;
    const w = Number(`${k}`.trim());
    l(mn(w, c));
  };
  return /* @__PURE__ */ A("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ A("div", { className: "reader-bottombar-start", children: [
      e.bookmarkScope ? /* @__PURE__ */ p(
        np,
        {
          scope: e.bookmarkScope,
          currentPage: i,
          numPages: c,
          regions: t == null ? void 0 : t.regions
        }
      ) : null,
      e.leftSlot
    ] }),
    /* @__PURE__ */ A("div", { className: "reader-bottombar-center", children: [
      o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ A(
        "form",
        {
          className: "reader-react-hud-page-form",
          onSubmit: (w) => {
            w.preventDefault(), y();
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
                onChange: (w) => S(w.target.value.replace(/[^\d]/g, "")),
                onBlur: y,
                onKeyDown: (w) => {
                  w.key === "Escape" && (w.preventDefault(), b(!1), S(`${i}`));
                }
              }
            ),
            /* @__PURE__ */ A("span", { className: "reader-react-hud-page-suffix", children: [
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
            !l || c <= 0 || (S(`${i}`), b(!0));
          },
          children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
        }
      ) }),
      e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
      t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
        ae,
        {
          className: "reader-react-hud-btn reader-react-hud-doc-dark",
          "aria-pressed": t.docDark ? "true" : "false",
          "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
          title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
          onClick: t.toggleDocDark,
          children: /* @__PURE__ */ p(ap, {})
        }
      ) }) : null,
      /* @__PURE__ */ A("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
        /* @__PURE__ */ p(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "缩小",
            disabled: !f,
            onClick: () => s(Wt(a, -1)),
            children: /* @__PURE__ */ p(na, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ),
        /* @__PURE__ */ A(
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
            children: /* @__PURE__ */ p(ra, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ A("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Bh, {}) })
    ] })
  ] });
}
function ap() {
  return /* @__PURE__ */ A("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function Oo(e) {
  var t, n;
  return ga(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function sp(e) {
  const [t, n] = E(() => ({
    scope: e,
    panel: Oo(qe(e))
  }));
  $(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Oo(qe(e))
    });
  }, [e]), $(() => {
    t.scope === e && gn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = N((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Xn = "download-toast";
function ip({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ A("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ A("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function cp(e = {}) {
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
    () => /* @__PURE__ */ p(ip, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Xn, duration: 1 / 0 }
  );
}
function lp() {
  const e = N((t) => {
    t && (t.setState = cp, t.hide = () => An.dismiss(Xn));
  }, []);
  return /* @__PURE__ */ A(_e, { children: [
    /* @__PURE__ */ p(Os, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const zo = { itemId: null, origin: null };
function up() {
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
function dp(e) {
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
  const r = e === "top" ? dp(n) : n, [o, a] = E(null), s = ja(), i = (d) => {
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
  })(), u = _(null);
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
    return !m.length && !g.length ? null : /* @__PURE__ */ A(Yn, { children: [
      m.map((h) => {
        const b = `${d.id}:${h.key}`, k = h.Icon;
        return /* @__PURE__ */ A("span", { className: "reader-bar-tool-group", "data-has-dropdown": h.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ A(
            ae,
            {
              className: "reader-bar-tool",
              "aria-label": h.label,
              title: h.title || h.label,
              "aria-pressed": !!h.pressed || o === `${b}:popup`,
              "aria-expanded": h.popup ? o === `${b}:popup` : void 0,
              "data-bar-tool": h.key,
              onClick: () => {
                var S;
                if (h.popup) {
                  a((y) => y === `${b}:popup` ? null : `${b}:popup`);
                  return;
                }
                (S = h.onClick) == null || S.call(h), c();
              },
              children: [
                /* @__PURE__ */ p(k, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
                e === "top" ? /* @__PURE__ */ p("span", { className: "reader-bar-tool-label", children: h.label }) : null
              ]
            }
          ),
          h.dropdown ? /* @__PURE__ */ p(
            ae,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${h.label}：选项`,
              title: `${h.label}的选项`,
              "aria-expanded": o === `${b}:dropdown`,
              "data-bar-tool-caret": h.key,
              onClick: () => a((S) => S === `${b}:dropdown` ? null : `${b}:dropdown`),
              children: /* @__PURE__ */ p(er, { size: 12, strokeWidth: 2.2, "aria-hidden": !0 })
            }
          ) : null
        ] }, b);
      }),
      g.length ? /* @__PURE__ */ p(Gm, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ A("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "top" ? "面板和看法" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
function fp({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = q(() => Ra(e, t), [e, t]), [o, a] = E(() => /* @__PURE__ */ new Set([...Kr(r), ...r ? [r] : []]));
  $(() => {
    a(/* @__PURE__ */ new Set([...Kr(r), ...r ? [r] : []]));
  }, [e]);
  const s = _(null);
  $(() => {
    var l, u;
    (u = (l = s.current) == null ? void 0 : l.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (l) => a((u) => {
    const f = new Set(u);
    return f.has(l) ? f.delete(l) : f.add(l), f;
  }), c = (l) => l.map((u) => {
    const f = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ A("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ A("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          ae,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(ta, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ A(
          ae,
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
const jo = { outline: "目录", search: "搜索", bookmarks: "书签", issues: "待处理" }, mp = [], hp = [];
function pp({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `目录、搜索、书签${n ? `、待处理 ${n} 处` : ""}（⌘F 搜索）`;
  return /* @__PURE__ */ A("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ A(ae, { className: "reader-finder-toggle", "aria-label": "左栏：目录、搜索、书签", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(ai, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-badge", "aria-label": `待处理 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function gp({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = hp,
  onJumpPage: l,
  pinned: u = !1,
  onPin: f,
  bookmarkPane: d,
  issuesPane: m,
  issueCount: g = 0
}) {
  var W, X;
  const h = ((W = tt()) == null ? void 0 : W.regions) ?? mp, b = ((X = ir()) == null ? void 0 : X.currentPage) ?? 1, k = q(() => ru(h), [h]), S = c.length > 0 && !!l, [y, w] = E("bookmarks"), v = S && (y === "bookmarks" || !k.length), M = ou(k, b), L = q(() => iu(h, s), [h, s]), [x, z] = E(-1);
  $(() => z(-1), [s]);
  const R = _(null), I = _(null), T = _(n);
  T.current = n, $(() => {
    if (u) return;
    const H = (ee) => {
      var Y, ue;
      const ge = ee.target;
      !ge || (Y = I.current) != null && Y.contains(ge) || (ue = ge.closest) != null && ue.call(ge, ".reader-finder-toggles, [data-finder-toggle]") || T.current();
    }, J = (ee) => {
      ee.key === "Escape" && T.current();
    };
    return document.addEventListener("pointerdown", H, !0), document.addEventListener("keydown", J), () => {
      document.removeEventListener("pointerdown", H, !0), document.removeEventListener("keydown", J);
    };
  }, [u]);
  const P = _(null);
  $(() => {
    var H, J, ee;
    e === "search" ? (H = R.current) == null || H.focus() : (ee = (J = P.current) == null ? void 0 : J.querySelector('[aria-current="location"]')) == null || ee.scrollIntoView({ block: "center" });
  }, [e, i]), $(() => {
    var H, J;
    e === "search" && x >= 0 && ((J = (H = P.current) == null ? void 0 : H.querySelector('[aria-current="true"]')) == null || J.scrollIntoView({ block: "nearest" }));
  }, [e, x]);
  const C = (H) => {
    const J = L[H];
    J && (z(H), r(J.itemId));
  }, D = ["outline", "search", ...d ? ["bookmarks"] : [], ...m ? ["issues"] : []], U = D.includes(e) ? e : "outline";
  return /* @__PURE__ */ A("aside", { ref: I, className: "reader-finder", "data-finder-tab": U, "data-pinned": u ? "true" : void 0, "aria-label": `左栏：${jo[U]}`, children: [
    /* @__PURE__ */ A("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: D.map((H) => /* @__PURE__ */ A(ae, { className: "reader-finder-tab", role: "tab", "aria-selected": U === H, onClick: () => t(H), children: [
        jo[H],
        H === "issues" && g ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: g }) : null
      ] }, H)) }),
      f ? /* @__PURE__ */ p(
        ae,
        {
          className: "reader-finder-close reader-finder-pin",
          "aria-pressed": u,
          "aria-label": u ? "不钉了，浮在书上" : "钉在左边",
          title: u ? "不钉了：浮在书上，点别处收起" : "钉在左边：书页往右让，一直开着",
          onClick: () => f(!u),
          children: u ? /* @__PURE__ */ p(si, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }) : /* @__PURE__ */ p(Yo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(ae, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(Xt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    U === "bookmarks" ? d : U === "issues" ? m : null,
    U === "outline" && S && k.length ? /* @__PURE__ */ A("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(ae, { className: "reader-finder-switch-option", role: "radio", "aria-checked": v, onClick: () => w("bookmarks"), children: "按 PDF 目录" }),
      /* @__PURE__ */ p(ae, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !v, onClick: () => w("headings"), children: "按标题" })
    ] }) : null,
    U === "outline" && v && l ? /* @__PURE__ */ p(fp, { nodes: c, currentPage: b, onJumpPage: l }) : U === "outline" ? k.length ? /* @__PURE__ */ p("ol", { ref: P, className: "reader-finder-list", children: k.map((H, J) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ A(
      ae,
      {
        className: "reader-finder-entry",
        "data-level": H.level,
        "aria-current": J === M ? "location" : void 0,
        onClick: () => r(H.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: H.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: H.page })
        ]
      }
    ) }, H.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: h.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : U !== "search" ? null : /* @__PURE__ */ A(_e, { children: [
      /* @__PURE__ */ A("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          oa,
          {
            ref: R,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (H) => a(H.target.value),
            onKeyDown: (H) => {
              H.key === "Enter" ? (H.preventDefault(), C(cu(x, L.length, H.shiftKey))) : H.key === "Escape" && (H.preventDefault(), u ? H.currentTarget.blur() : n()), H.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: L.length === 0 ? "没有找到" : `${x >= 0 ? `第 ${x + 1} / ` : ""}${L.length >= 200 ? "200+ 处，只列前 200 处" : `${L.length} 处`}${x < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: L.map((H, J) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ A(ae, { className: "reader-finder-entry is-hit", "aria-current": J === x ? "true" : void 0, onClick: () => C(J), children: [
        /* @__PURE__ */ A("span", { className: "reader-finder-entry-text", children: [
          H.snippet.slice(0, H.at),
          /* @__PURE__ */ p("mark", { children: H.snippet.slice(H.at, H.at + H.length) }),
          H.snippet.slice(H.at + H.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: H.page })
      ] }) }, H.itemId)) })
    ] })
  ] });
}
function bp(e) {
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
function yp(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const vp = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, wp = ["failed", "content", "layout"];
function Sp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function kp(e, t, n) {
  const r = bp(e), [o, a] = E(-1);
  $(() => a(-1), [r]);
  const s = N((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = _({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, $(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || Sp(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = yp(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function Ip(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Tp(e) {
  var r;
  if (e.shiftKey || Ip(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${la}`))) return null;
  const n = Number((r = t.closest(`[${Pe}]`)) == null ? void 0 : r.getAttribute(Pe)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Pp({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = _(null);
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
  return /* @__PURE__ */ A("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ A(
      ae,
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
function Ep({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ A("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      ae,
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
const bs = "retainpdf:reader:doc-theme:v1", Ho = "data-reader-doc";
function ys() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Rp(e = ys()) {
  try {
    return (e == null ? void 0 : e.getItem(bs)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Mp(e, t = ys()) {
  try {
    t == null || t.setItem(bs, e);
  } catch {
  }
}
function Uo(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Ho, "dark") : t.removeAttribute(Ho));
}
function Np() {
  const [e, t] = E(() => Rp());
  $(() => {
    Uo(e);
  }, [e]), $(() => () => Uo("light"), []);
  const n = N(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Mp(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function _p({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = gs(e, t);
  return a.length ? /* @__PURE__ */ p("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ A("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ A(
      ae,
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
    /* @__PURE__ */ p(ae, { className: "reader-bookmark-remove", "aria-label": `删除第 ${i.page} 页的书签`, title: "删除这个书签", onClick: () => s(i.page), children: "×" })
  ] }, i.page)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: "还没有书签。底栏的书签按钮给眼下这一页加一个。" });
}
function xp({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ A("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    wp.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ A("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ A("h4", { children: [
          vp[o],
          /* @__PURE__ */ p("span", { children: a.length })
        ] }),
        /* @__PURE__ */ p("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ A(ae, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
          /* @__PURE__ */ p("span", { className: "reader-issues-title", children: s.title }),
          /* @__PURE__ */ A("span", { className: "reader-issues-page", children: [
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
function Ap({ state: e, bookmarks: t, bookmarkScope: n, issues: r }) {
  const { finder: o, setFinder: a, findQuery: s, setFindQuery: i, findTerm: c, findFocus: l, jumpFromFinder: u, jumpToPageFromFinder: f, pinned: d, setPinned: m, canPin: g } = e, h = tt(), b = ir(), k = (b == null ? void 0 : b.currentPage) ?? 1, S = r.issues.length;
  return /* @__PURE__ */ p(_e, { children: o ? /* @__PURE__ */ p(
    gp,
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
        _p,
        {
          scope: n,
          regions: h == null ? void 0 : h.regions,
          currentPage: k,
          numPages: (b == null ? void 0 : b.numPages) ?? 0,
          onJumpPage: f
        }
      ) : void 0,
      issuesPane: S ? /* @__PURE__ */ p(xp, { nav: r }) : void 0,
      issueCount: S
    }
  ) : null });
}
function Lp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(_e, { children: n ? /* @__PURE__ */ p(
    $m,
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
function Cp(e) {
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
const Dp = 720;
function $p(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Dp;
}
function Op(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function zp(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = E(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Cp({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = bl({
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
  const f = _(null);
  return $(() => {
    f.current !== e.viewStateKey && wl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function Fp(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = yl(e.liveTranslation), i = N(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = E(null);
  $(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && Sl({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), f = q(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
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
function Bp() {
  const [e] = E(Xd), t = cf(e), n = nf(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function jp(e, t, n) {
  const r = _(e);
  $(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function Hp(e, t, {
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
  const { session: m, panes: g } = e, h = _(e.currentPage);
  h.current = e.currentPage;
  const b = N(() => h.current, []), k = q(() => ({
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
    currentPage: b
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
  ]), { contributionStore: S, contributions: y, reserveRight: w } = t, v = q(() => Zd(y), [y]), M = q(() => rf(y), [y]), L = q(() => tf(y), [y]), x = q(() => Qd(y), [y]), z = ef(y);
  return { readerApi: k, contributionStore: S, contributions: y, pageLayers: v, compareVersion: M, textMarks: L, menuSections: x, pointerTakenId: z, reserveRight: w };
}
function Up() {
  try {
    return et().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Wp = "这本书正在处理（翻译或排版），处理完才能改。", Kp = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Vp({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Up(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = du(s), l = !t || Ht(t), u = bu(n), [f, d] = E(""), [m, g] = E(null), [h, b] = E(() => /* @__PURE__ */ new Map()), [k, S] = E(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [y, w] = E(() => /* @__PURE__ */ new Map()), [v, M] = E({ phase: "idle" }), L = _({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  $(() => {
    g(null), L.drafts.clear(), L.generation.current = null, w(/* @__PURE__ */ new Map()), M({ phase: "idle" });
  }, [s]), $(() => {
    if (d(""), !i || c || !a) return;
    let D = !1;
    return a.resolveOwnerJobId(s).then((U) => {
      D || d(`${U || s}`.trim() || s);
    }).catch(() => {
      D || d(s);
    }), () => {
      D = !0;
    };
  }, [i, c, a, s]), $(() => {
    if (b(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let D = !1;
    return a.fetchRevisions(f).then((U) => {
      D || b(yu(U, u));
    }).catch(() => {
    }), () => {
      D = !0;
    };
  }, [a, f, u, l]);
  const x = v.phase === "running" && v.seenActive;
  $(() => {
    if (v.phase === "running") {
      if (!l) {
        x || M({ phase: "running", seenActive: !0 });
        return;
      }
      x && M(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [v.phase, x, l, t]);
  const z = q(() => {
    const D = new Map(h);
    if (k.renderedAt === u)
      for (const [U, W] of k.edits) D.set(U, W);
    return D;
  }, [h, k, u]), R = N((D) => {
    const U = `${D || ""}`.trim();
    U && g({ itemId: U, page: fu(U) });
  }, []), I = N(() => g(null), []), T = N((D, U) => {
    S((W) => {
      const X = new Map(W.renderedAt === u ? W.edits : []);
      return X.set(D, U), { renderedAt: u, edits: X };
    }), w((W) => new Map(W).set(D, (W.get(D) || 0) + 1));
  }, [u]), P = N(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      M({ phase: "submitting" });
      try {
        await a.rerender(s), M({ phase: "running", seenActive: !1 }), await o();
      } catch (D) {
        M({ phase: "failed", message: (D == null ? void 0 : D.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), C = c ? Kp : !l || v.phase === "running" || v.phase === "submitting" ? Wp : "";
  return q(() => ({
    available: i,
    blockedReason: C,
    port: a,
    ownerJobId: f,
    target: m,
    select: R,
    close: I,
    memory: L,
    pendingEdits: z,
    savedCounts: y,
    markSaved: T,
    rerender: v,
    startRerender: P
  }), [i, C, a, f, m, R, I, L, z, y, T, v, P]);
}
function qp(e, t) {
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
function Jp(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Vp({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = N((d, m) => {
    Na(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  qp(a.available ? u : null, n);
  const f = q(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const Gp = "reader-finder-input";
function Xp(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Yp(e, t = typeof window > "u" ? null : window) {
  $(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Xp(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Gp) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const vs = "retainpdf.reader.sidebar.v1", Zp = ["outline", "search", "bookmarks", "issues"], Qp = 900;
function eg() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(vs)) || "{}"), n = Zp.includes(t == null ? void 0 : t.tab) ? t.tab : "outline";
    return { pinned: (t == null ? void 0 : t.pinned) === !0, open: (t == null ? void 0 : t.open) === !0, tab: n };
  } catch {
    return { pinned: !1, open: !1, tab: "outline" };
  }
}
function tg(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(vs, JSON.stringify(e));
  } catch {
  }
}
function ng() {
  const e = `(min-width: ${Qp}px)`, [t, n] = E(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
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
function rg(e) {
  const [t] = E(eg), [n, r] = E(null), [o, a] = E(t.tab), [s, i] = E(t.pinned), c = ng(), l = s && c, u = N((x) => {
    r(x), x && a(x);
  }, []);
  $(() => {
    tg({ pinned: s, open: !!n, tab: n || o });
  }, [s, n, o]);
  const f = N(() => r((x) => x ? null : o), [o]), d = N((x) => {
    r((z) => z === x ? null : x), a(x);
  }, []), m = N((x) => i(x), []), [g, h] = E(""), [b, k] = E("");
  $(() => {
    const x = g.replace(/\s+/gu, " ").trim(), z = window.setTimeout(() => k(x), x ? 150 : 0);
    return () => window.clearTimeout(z);
  }, [g]);
  const [S, y] = E(0), w = N(() => {
    u("search"), y((x) => x + 1);
  }, [u]);
  Yp(w);
  const v = N(() => {
    l || (n === "outline" || n === "bookmarks" || !c) && r(null);
  }, [l, n, c]), M = N((x) => {
    e.jumpToAnchor({ block_id: x }), v();
  }, [e.jumpToAnchor, v]), L = N((x) => {
    e.goToPage(x), v();
  }, [e.goToPage, v]);
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
    findTerm: b,
    findFocus: S,
    jumpFromFinder: M,
    jumpToPageFromFinder: L
  };
}
function og(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ma(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function ag(e, t) {
  return t === null || e !== t;
}
function sg(e, t) {
  const { boot: n } = e, r = _(null), o = _(null);
  $(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = qe(e.viewStateKey), s = og({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: It()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      ag(e.mode, o.current) && (o.current = null, gn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const ig = [];
function cg(e) {
  const { sessionFiles: t } = e, [n, r] = E({}), o = _({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = N((b, k) => {
    r((S) => ({ ...S, [k]: { url: o.current[k], nodes: b } }));
  }, []), s = q(() => {
    const b = n.source;
    if (b && b.url === t.sourceUrl && b.nodes.length) return b.nodes;
    const k = n.translated;
    return k && k.url === t.translatedUrl && k.nodes.length ? k.nodes : ig;
  }, [n, t.sourceUrl, t.translatedUrl]), i = _({}), [c, l] = E(0), u = N((b, k) => {
    i.current[k] = { url: o.current[k], pdf: b }, l((S) => S + 1);
  }, []), [f, d] = E(null), m = N((b) => d(b), []), g = N(() => d(null), []);
  $(() => d(null), [e.viewStateKey]);
  const h = q(() => {
    const b = (k, S) => {
      const y = i.current[k];
      return y && y.url === S ? y.pdf : null;
    };
    return { source: b("source", t.sourceUrl), translated: b("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
function lg() {
  const e = _l(), { boot: t, panes: n, session: r } = e, o = sp(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = Bp(), { reserveRight: l } = c, u = i || l > 0, f = rg(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, h = N(() => {
    s(null);
  }, []);
  jp(l, a, h);
  const { liveTranslationVisible: b, setLiveTranslationVisible: k, paneComposition: S, liveToggles: y, sourceViewOnly: w, visiblePdfMode: v } = zp(
    e,
    i,
    $p(e.shell.shellWidth, u || g)
  );
  sg(e, w);
  const M = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: L, toggleDocDark: x } = Np();
  Ol({
    toggleDocDark: x,
    mode: v,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const { latestLivePage: z, jumpToLatestLivePage: R, offerCompletion: I, setCompletionDismissedKey: T, sourcePaneAction: P } = Fp(e, {
    liveTranslationVisible: b,
    setLiveTranslationVisible: k,
    liveToggles: y,
    sourceViewOnly: w,
    visiblePdfMode: v
  }), C = N((V) => {
    const ne = Op(V, e.liveTranslationAvailable);
    ne !== null && k(ne), e.setModeKeepingPage(V);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), D = N((V) => {
    s(V);
  }, []), [U] = E(up), W = N((V) => e.jumpToAnchor({ block_id: V }), [e.jumpToAnchor]), X = kp(e.sourceOnly ? "" : r.jobId, e.currentPage, W), [H, J] = E(null), ee = N((V, ne) => e.jumpToAnchor({ block_id: V }, ne), [e.jumpToAnchor]), { bookmarks: ge, onPdfOutline: Y, onPdfDocument: ue, zoomItem: xe, setZoomItem: ce, zoomBlock: fe, closeZoom: F, zoomDocuments: K } = cg(e), { blockEdit: G, editBlock: ie, revisedBlocks: se } = Jp(e, v, U), [me, ke] = E(null), le = N(() => ke(null), []), te = Jf({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: be,
    contributionStore: B,
    contributions: oe,
    pageLayers: he,
    compareVersion: Ae,
    textMarks: Me,
    menuSections: Ee,
    pointerTakenId: ze
  } = Hp(e, c, {
    translationVersions: te,
    bookmarks: ge,
    regionHover: U,
    assistantPanel: a,
    closeAssistant: h,
    visiblePdfMode: v,
    changeWorkspace: C,
    jumpToBlockIn: ee,
    zoomDocuments: K,
    editBlock: G.available && !G.blockedReason ? ie : null,
    panelHost: H
  }), $e = !!ze, [Le, We] = E([]), Oe = q(() => ({
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
    regionHover: U,
    jumpToBlock: W,
    revisedBlocks: se,
    onPdfOutline: Y,
    onPdfDocument: ue,
    zoomBlock: fe,
    textMarks: Me,
    pageLayers: he,
    editBlock: G.available ? ie : void 0,
    blockEdit: G,
    editShowsSource: v !== "compare",
    findTerm: d === "search" ? m : "",
    compareVersion: Ae,
    pointerTaken: $e,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: w,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: D, close: h },
    docDark: L,
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
    U,
    W,
    se,
    Y,
    ue,
    fe,
    Me,
    he,
    G,
    ie,
    v,
    d,
    m,
    Ae,
    $e,
    e.sourceOnly,
    w,
    e.download,
    e.goToPage,
    D,
    h,
    L,
    x
  ]), Fe = q(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), j = [
    ic,
    `is-workspace-${M}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    S.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(af, { api: be, store: B, children: /* @__PURE__ */ p(dd, { value: Oe, hud: Fe, children: /* @__PURE__ */ A(
    "div",
    {
      className: j,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": M,
      "data-pointer-taken": ze || void 0,
      onContextMenu: (V) => {
        const ne = Tp(V);
        if (!ne) return;
        const ve = Yd(oe, { target: V.target, clientX: V.clientX, clientY: V.clientY, page: ne.page });
        !ve.length && !Ee.length || (V.preventDefault(), We(ve), ke(ne));
      },
      children: [
        /* @__PURE__ */ p(
          Gd,
          {
            mode: v,
            documentReady: !!r.jobId,
            sourceViewOnly: w,
            onModeChange: C,
            liveTranslation: y.topBarPill ? {
              visible: b,
              state: e.liveTranslation,
              onToggle: () => k((V) => !V),
              latestPage: b ? z : null,
              currentPage: e.currentPage,
              onJumpToLatest: R
            } : null,
            completion: I ? {
              onOpenCompare: () => {
                T(e.viewStateKey), C("compare");
              }
            } : null,
            start: /* @__PURE__ */ A(_e, { children: [
              /* @__PURE__ */ p(Wl, { onBeforeClose: r.prepareClose }),
              /* @__PURE__ */ p(pp, { open: d, onToggle: f.toggleSidebar, issueCount: X.issues.length }),
              r.title ? /* @__PURE__ */ p("span", { className: "reader-workspace-title", title: r.title, children: r.title }) : null
            ] }),
            end: /* @__PURE__ */ A(_e, { children: [
              /* @__PURE__ */ p(Bo, { place: "top", active: a }),
              /* @__PURE__ */ p(qh, {})
            ] })
          }
        ),
        /* @__PURE__ */ A("div", { className: "reader-workspace", children: [
          /* @__PURE__ */ p(Ap, { state: f, bookmarks: ge, bookmarkScope: e.viewStateKey, issues: X }),
          /* @__PURE__ */ A("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(Kd, { paneComposition: S, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: P }),
            /* @__PURE__ */ p(zh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts })
          ] }),
          /* @__PURE__ */ A(
            "aside",
            {
              className: "reader-dock",
              hidden: !u,
              "data-dock": i ? "panel" : l ? "extension" : void 0,
              style: !i && l ? { "--reader-dock-width": `${l}px` } : void 0,
              "aria-label": "阅读辅助面板",
              children: [
                /* @__PURE__ */ p(Xm, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: J })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p($h, {}) : null,
        /* @__PURE__ */ p(
          op,
          {
            mode: v,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            leftSlot: /* @__PURE__ */ p(Ep, { edit: G }),
            toolsSlot: /* @__PURE__ */ p(Bo, { place: "bottom" })
          }
        ),
        /* @__PURE__ */ p(
          Lp,
          {
            session: r,
            zoomDocuments: K,
            zoomItem: xe,
            setZoomItem: ce,
            closeZoom: F,
            visiblePdfMode: v
          }
        ),
        /* @__PURE__ */ p(Pp, { menu: me, onClose: le, actions: Le, sections: Ee }),
        /* @__PURE__ */ p(uf, { extensions: ur }),
        /* @__PURE__ */ p(lp, {})
      ]
    }
  ) }) });
}
function Lg() {
  return /* @__PURE__ */ p(lg, {});
}
export {
  Lg as R,
  lg as a,
  _g as b,
  xg as c,
  Pf as d,
  Rf as e,
  Mg as f,
  Ng as g,
  Eg as h,
  Rg as r,
  Ag as s,
  tt as u
};
//# sourceMappingURL=ReaderApp-CZI1aDev.js.map
