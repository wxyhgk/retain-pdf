var Rs = Object.defineProperty;
var Ar = (e) => {
  throw TypeError(e);
};
var Ps = (e, t, n) => t in e ? Rs(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var xr = (e, t, n) => Ps(e, typeof t != "symbol" ? t + "" : t, n), Lr = (e, t, n) => t.has(e) || Ar("Cannot " + n);
var xt = (e, t, n) => (Lr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Dr = (e, t, n) => t.has(e) ? Ar("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Cr = (e, t, n, r) => (Lr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as D, jsx as p, Fragment as $e } from "react/jsx-runtime";
import { useMemo as K, useState as _, useEffect as $, useCallback as A, useRef as N, useLayoutEffect as Le, memo as Yt, createContext as Zt, useContext as dt, Fragment as vn, forwardRef as Ms, useImperativeHandle as or, useSyncExternalStore as wn, Component as _s, Suspense as Xo, lazy as Yo, useId as Zo } from "react";
import { requireAdapter as Nt, getReaderAdapters as He } from "./adapters.js";
import { resolveReaderDownloadName as Ns, resolveReaderDownloadUrls as As, READER_PROGRESS_COPY as Xe, trimString as un, READER_DOWNLOAD_ACTIONS as xs, disabledReason as Ls } from "./runtime/state.js";
import { r as Ds, b as Cs } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as On, isFinishedJobStatus as Wt } from "@retainpdf/domain/job";
import { n as Qo, d as $s, f as En, k as $r, b as Os, c as zs, j as Ue, p as gt, g as Fs, l as Pt, i as Bs } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as js } from "@retainpdf/api/documents";
import { isReaderTransportError as Hs, createReaderTransportError as Us } from "./contracts.js";
import { toast as zn, Toaster as Ks } from "sonner";
import { ChevronLeft as ea, PenLine as dn, ZoomIn as Ws, Check as ta, X as At, Copy as Vs, ChevronUp as qs, ChevronDown as fn, History as Js, LoaderCircle as Gs, Pin as na, LogOut as Xs, FileText as ra, Columns2 as oa, Languages as aa, Radio as Ys, ArrowDownToLine as Zs, CheckCircle2 as Qs, ImagePlus as ei, MessageCircle as ti, Scan as ni, GitCompareArrows as ri, Highlighter as oi, Eraser as ai, Undo2 as si, Trash2 as ii, BookText as ci, ChevronRight as sa, Minus as ia, Plus as ca, ArrowLeft as li, CircleHelp as ui, Download as di, Bookmark as fi, Star as mi, Contrast as hi, Search as la, PinOff as pi } from "lucide-react";
import { Button as se, Textarea as gi, IconButton as ut, Input as ar } from "@retainpdf/ui";
import { createPortal as bi } from "react-dom";
import { pdfjs as ua, Page as yi, Document as vi } from "react-pdf";
import { e as wi, m as Si, a as Ii } from "./markdown-math-XkF5urpn.js";
const Ti = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ki = "", Ei = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Ri = (e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Ug = (...e) => {
  var n;
  return (((n = He()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Kg = () => {
  var e, t;
  return ((t = (e = He()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ye = () => Nt("defaultReaderDataPort"), Or = () => Nt("defaultReaderPageConfigPort"), Wg = {
  get apiPrefix() {
    return Ye().apiPrefix;
  },
  fetchProtected: (...e) => Ye().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ye().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ye().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ye().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ye().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ye().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ye().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ye().liveTranslation;
  }
}, da = {
  messageTargetOrigin: () => Or().messageTargetOrigin(),
  readerJobId: () => Or().readerJobId()
}, Pi = () => {
  var e;
  return ((e = He()) == null ? void 0 : e.liveTranslation) ?? null;
}, Vt = () => {
  var t;
  const e = He();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, nt = () => {
  const e = He();
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
}, Mi = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, _i = () => {
  var e, t;
  return ((t = (e = He()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Ni = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Ai = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Ns(...e);
}, xi = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? As(...e);
}, Li = (...e) => Nt("downloadProtectedResource")(...e), Di = (...e) => Nt("failDownloadToast")(...e), Vg = (e, t) => Nt("resolveMarkdownAssetUrl")(e, t), zr = "/api/v1";
function Ci() {
  const e = () => {
    var r;
    return Ds(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = _(e);
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
function $i() {
  const e = Ci(), t = K(() => Ni(da), [e]), n = K(() => _i(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Oi(e) {
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
  }), I = h.jobId === g ? h.documentId : "", w = t || I, b = !!t && !g, [S, v] = _(null), P = (S == null ? void 0 : S.sessionIdentity) === r && S.documentId === w ? S : null, x = b || !!P, R = A((M) => {
    const T = `${M.documentId || ""}`.trim();
    if (!T || a.current && a.current !== T) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: T
      });
    else if (!a.current)
      return;
    const k = `${M.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: T,
      revision: k,
      sessionIdentity: o.current
    }), i();
  }, []);
  $(() => {
    v((M) => M && M.sessionIdentity !== r ? null : M);
  }, [r]);
  const O = A((M) => {
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
        y((T) => T.jobId === M.jobId && T.documentId === M.documentId ? T : { jobId: M.jobId, documentId: M.documentId });
        break;
      case "committed-source":
        v({
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
    jobDocumentId: I,
    documentId: w,
    sourceOnly: b,
    committedDocumentSource: S,
    setCommittedDocumentSource: v,
    activeCommittedDocumentSource: P,
    sourceViewOnly: x,
    refreshCommittedDocument: R,
    applyIdentityEvent: O
  };
}
function Fr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function zi(e) {
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
function Br(e, t) {
  return Ri(On(e, t));
}
function Fi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Bi(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !Fi(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Fn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Ei.progress,
        stage: n,
        percent: e,
        text: t
      },
      da.messageTargetOrigin()
    );
  } catch {
  }
}
function mn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Fn({ percent: t, text: n, stage: r });
}
function ji(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = _(null), [l, u] = _(null), [f, d] = _(""), [m, g] = _(0), h = f === n ? i : null, y = f === n ? l : null, I = Fr(h), w = Wt(I), b = A(() => {
    g((O) => O + 1);
  }, []), S = A((O) => {
    c(O.jobPayload), u(O.manifestPayload), d(O.sessionIdentity);
  }, []), v = A((O) => {
    c(null), u(null), d(O);
  }, []), P = N(""), x = N(""), R = A(async () => {
    const O = o.current;
    if (!O || P.current === O) return;
    const M = nt().loadJobPayload;
    if (typeof M != "function") return;
    const T = a.current.value;
    P.current = O;
    try {
      const k = await M(O);
      if (s.current || a.current.value !== T || o.current !== O || !k || typeof k != "object")
        return;
      const E = Fr(k);
      c(k), d(r.current), !Wt(E) && x.current === O && (x.current = ""), E === "succeeded" && x.current !== O && (x.current = O, g((L) => L + 1));
    } catch {
    } finally {
      P.current === O && (P.current = "");
    }
  }, []);
  return $(() => {
    x.current = "";
  }, [n]), $(() => {
    if (!t || w || !h) return;
    const O = window.setInterval(() => {
      document.visibilityState !== "hidden" && R();
    }, 1e3);
    return () => window.clearInterval(O);
  }, [w, R, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: I,
    jobTerminal: w,
    jobRefreshRevision: m,
    refreshJobArtifacts: b,
    refreshJobStatus: R,
    publishPayload: S,
    clearPayload: v
  };
}
function Bn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Hi(e, t) {
  e(t), Bn(t);
}
function Ui(e) {
  const [t, n] = _(e ? "source" : "compare"), r = A((a) => {
    e && a !== "source" || (n(a), Bn(a));
  }, [e]), o = A((a) => {
    Hi(n, a);
  }, []);
  return $(() => (e && document.documentElement.classList.add("reader-source-only"), Bn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function jr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ki(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: jr(n.active_job_id),
    activeVersionId: jr(n.active_version_id)
  };
}
function Wi(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Vi(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function qi(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ji = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Gi(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ji.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Xi = 48 * 1024 * 1024;
function Yi(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Zi = 2, je = /* @__PURE__ */ new Map();
function jn(e, t) {
  je.delete(e), je.set(e, t);
}
function Hr(e) {
  if (je.size < Zi) return;
  const t = je.keys().next().value;
  t && je.delete(t);
}
async function Qi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function fa(e, t = Vt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, I, w;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (je.has(r)) {
    const b = je.get(r);
    return jn(r, b), b;
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
    const S = await Qi(s);
    throw S && (b.reason = S), b;
  }
  const i = ec(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Hr(), je.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (w = (I = n.signal) == null ? void 0 : I.removeEventListener) == null || w.call(I, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return je.has(r) ? jn(r, l) : (Hr(), je.set(r, l)), l;
}
function ec(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Xi ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const tc = { file: null, loading: !1, error: "" }, nc = { file: null, loading: !0, error: "" };
function rc(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if ($(() => {
    if (t || !n) return;
    const s = je.get(n);
    if (s) {
      jn(n, s);
      return;
    }
    const i = new AbortController();
    return fa(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return tc;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = je.get(n);
  return a ? { file: a, loading: !1, error: "" } : nc;
}
function oc(e) {
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
async function Hn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  mn(s, r, n, "download");
  const i = await fa(t, Vt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (mn(s, o, n, "download"), i);
}
async function ac(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  mn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Hn({
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
    Hn({
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
function sc(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function ic({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = js,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(sc(o.href, t, a)), !0);
}
const tn = {
  regions: null,
  metadata: null
};
function cc(e) {
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
  } = e, [w, b] = _(""), [S, v] = _(""), [P, x] = _(null), [R, O] = _(null), [M, T] = _(!1), [k, E] = _(""), [L, C] = _([]), [W, H] = _(!1), [J, ie] = _(() => ({
    source: null,
    translated: null
  })), [G, ce] = _(
    tn
  ), [Te, Z] = _({
    loading: !0,
    percent: 4,
    text: Xe.boot,
    stage: "progress",
    failed: !1
  });
  return $(() => {
    const me = new AbortController(), Me = h.current.value, re = oc({
      sessionEpochRef: h,
      closingRef: y,
      abort: me,
      sessionEpoch: Me
    });
    I.current = me;
    const fe = nt();
    if (y.current)
      return me.abort(), () => {
        I.current === me && (I.current = null);
      };
    let F = !1;
    function U(ae, Q) {
      re.markFailed(), H(!0), Z({
        loading: !1,
        percent: 100,
        text: ae,
        stage: "failed",
        failed: !0
      }), Fn({ percent: 100, text: Q, stage: "failed" });
    }
    function X() {
      T(!0), F || H(!0), Z({
        loading: !1,
        percent: 100,
        text: Xe.ready,
        stage: "ready",
        failed: !1
      }), Fn({ percent: 100, text: Xe.ready, stage: "ready" });
    }
    function le() {
      return l != null && l.documentId ? Br(
        l.documentId,
        l.revision
      ) : Ti() ? ki : fe.resolveResourceUrl(On(r));
    }
    async function ne() {
      var te;
      let ae = { activeJobId: "", activeVersionId: "" };
      try {
        const he = await ((te = fe.fetchDocument) == null ? void 0 : te.call(fe, r));
        he && (ae = Ki(he));
      } catch {
      }
      const Q = Wi({
        link: ae,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (Q.kind === "follow-active-job") {
        if (re.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: Q.jobId
        }), Q.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: Q.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (Q.kind === "open-committed-source") {
        if (re.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: Q.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ge = le();
      if (re.isInactive()) return;
      b(ge), v(""), E(""), d(c);
      const B = await Hn({
        url: ge,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: re,
        setBoot: Z
      });
      if (!re.isInactive()) {
        if (!B) {
          U("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        x(B), X();
      }
    }
    async function oe() {
      var pe;
      const ae = !l, Q = !!(ae && fe.loadSessionSnapshot && fe.loadReaderOptionalArtifacts), ge = Q ? fe.loadReaderOptionalArtifacts(t) : null, B = await ((pe = fe.loadSessionSnapshot) == null ? void 0 : pe.call(fe, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ae && !Q
      })), te = B ? {
        jobPayload: B.sourcePayload,
        manifestPayload: B.manifestPayload,
        readerMetadata: B.readerMetadata,
        regionsPayload: B.regions,
        readerErrors: B.readerErrors
      } : await fe.loadReaderPayload(t, {
        includeOptionalArtifacts: ae
      });
      if (re.isInactive()) return;
      let he = null;
      if (n && !r)
        if (B && B.linkedDocument !== void 0)
          he = B.linkedDocument;
        else {
          try {
            he = await fe.fetchDocumentByJobId(zr, t);
          } catch {
          }
          if (re.isInactive()) return;
        }
      const Oe = zi(te.jobPayload) || `${(he == null ? void 0 : he.document_id) || ""}`.trim();
      Oe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Oe
      });
      const De = Vi({
        payloadDocumentId: Oe,
        linkedActiveJobId: `${(he == null ? void 0 : he.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(he == null ? void 0 : he.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (De.kind === "restore-committed-source") {
        if (re.isInactive()) return;
        u({
          type: "committed-source",
          documentId: De.documentId,
          revision: De.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const _e = fe.resolveReaderSourcePdf(te.manifestPayload), Fe = fe.resolveReaderTranslatedPdfUrl(te.jobPayload, te.manifestPayload), ze = typeof _e == "string" ? _e : fe.resolveReaderArtifactUrl(_e), Ae = r || Oe, Ke = l != null && l.documentId ? Br(
        l.documentId,
        l.revision
      ) : ze || (Ae ? fe.resolveResourceUrl(On(Ae)) : ""), Ce = l ? "" : Fe || "";
      b(Ke || ""), v(Ce), E(Bi(te.jobPayload, t)), f({
        jobPayload: te.jobPayload || null,
        manifestPayload: te.manifestPayload || null,
        sessionIdentity: c
      });
      const Be = () => ac({
        sourceFinal: Ke || "",
        translatedFinal: Ce,
        fence: re,
        setBoot: Z
      }), j = !!(Ke || Ce), V = ge && j ? Be() : null;
      V == null || V.catch(() => {
      });
      const de = (z) => {
        re.isInactive() || (C(l ? [] : Qo(z.regionsPayload)), ie(l ? { source: null, translated: null } : $s(z.readerMetadata)), ce(l ? tn : z.readerErrors ?? tn), H(!0));
      };
      if (ge ? (F = !0, ge.then(de)) : de(te), !j) {
        U(Xe.failed, Xe.failed);
        return;
      }
      const we = await (V ?? Be());
      if (we.status !== "inactive") {
        if (we.status === "incomplete") {
          U("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        x(we.sourceBytes), O(we.translatedBytes), X();
      }
    }
    async function Ie() {
      T(!1), x(null), O(null), C([]), H(!1), ie({ source: null, translated: null }), ce(tn), mn(Z, 8, Xe.metadata, "metadata");
      try {
        if (s) {
          await ne();
          return;
        }
        if (!t) {
          U(Xe.failed, Xe.failed);
          return;
        }
        await oe();
      } catch (ae) {
        if (re.isClosedOrStale() || (ae == null ? void 0 : ae.name) === "AbortError") return;
        re.markFailed();
        const Q = Number(ae == null ? void 0 : ae.status), ge = `${(ae == null ? void 0 : ae.reason) || ""}`, B = Gi({ status: Q, reason: ge, sessionJobId: t });
        if (B && (await ic({
          apiPrefix: zr,
          documentId: B,
          expiredJobId: t
        }) || re.isClosedOrStale()))
          return;
        if (qi({
          status: Q,
          reason: ge,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const te = ae instanceof Error ? ae.message : Xe.failed;
        U(te, te);
      }
    }
    return Ie(), () => {
      me.abort(), I.current === me && (I.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: w,
    translatedUrl: S,
    sourceFile: P,
    translatedFile: R,
    assetsReady: M,
    title: k,
    regions: L,
    regionsSettled: W,
    readerMetadata: J,
    readerErrors: G,
    boot: Te
  };
}
function lc() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = $i(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), c = N(""), l = N(""), u = N(() => {
  }), f = A(() => u.current(), []), d = Oi({
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
  } = d, { mode: I, setMode: w, switchSessionMode: b } = Ui(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const S = ji({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: v,
    scopedManifestPayload: P,
    jobStatus: x,
    jobTerminal: R,
    jobRefreshRevision: O,
    refreshJobArtifacts: M,
    refreshJobStatus: T
  } = S, k = cc({
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
    publishPayload: S.publishPayload,
    clearPayload: S.clearPayload,
    switchSessionMode: b,
    jobRefreshRevision: O,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = A(() => {
    var C;
    e.current = !0, (C = t.current) == null || C.abort();
  }, []), L = K(
    () => ({
      fetchProtected: nt().fetchProtected,
      jobId: m,
      jobPayload: v,
      manifestPayload: P,
      sourceUrl: k.sourceUrl,
      translatedUrl: k.translatedUrl,
      sourceOnly: y
    }),
    [m, v, P, k.sourceUrl, k.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: x,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: R,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: I,
    setMode: w,
    sourceUrl: k.sourceUrl,
    translatedUrl: k.translatedUrl,
    sourceFile: k.sourceFile,
    translatedFile: k.translatedFile,
    assetsReady: k.assetsReady,
    boot: k.boot,
    title: k.title,
    regions: k.regions,
    regionsSettled: k.regionsSettled,
    readerMetadata: k.readerMetadata,
    readerErrors: k.readerErrors,
    download: L,
    refreshJobArtifacts: M,
    refreshJobStatus: T,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: E
  };
}
const uc = 160, dc = 8, fc = 0;
function mc() {
  const e = N(null), [t, n] = _(null), [r, o] = _(fc), a = A((s) => {
    e.current = s, n(s);
  }, []);
  return $(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < uc || o((u) => Math.abs(u - l) < dc ? u : l);
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
function hc(e) {
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
const Rn = { source: 0, translated: 0 };
function pc(e, t) {
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
  const [f, d] = _(() => ({
    identity: l,
    pages: Rn
  })), [m, g] = _(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : Rn, y = m.identity === l ? m.tick : 0, I = hc({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: w } = I, b = A((T, k) => {
    u.current === l && d((E) => {
      const L = E.identity === l ? E.pages : Rn;
      return L[k] === T && E.identity === l ? E : {
        identity: l,
        pages: { ...L, [k]: T }
      };
    });
  }, [l]), S = N(null), v = A(() => {
    S.current && clearTimeout(S.current);
    const T = l;
    S.current = setTimeout(() => {
      S.current = null, u.current === T && g((k) => ({
        identity: T,
        tick: k.identity === T ? k.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  $(() => (S.current && (clearTimeout(S.current), S.current = null), d((T) => T.identity === l && T.pages.source === 0 && T.pages.translated === 0 ? T : { identity: l, pages: { source: 0, translated: 0 } }), g((T) => T.identity === l && T.tick === 0 ? T : { identity: l, tick: 0 }), () => {
    S.current && (clearTimeout(S.current), S.current = null);
  }), [l]);
  const P = K(
    () => Math.max(h.source, h.translated),
    [h]
  ), x = w === "translated" ? h.translated : h.source || h.translated, R = t == null ? void 0 : t.userZoom, O = t == null ? void 0 : t.shellWidth, M = `${l}-${y}-${R}-${n}-${h.source}-${h.translated}-${O}`;
  return {
    ...I,
    numPagesByPane: h,
    hudNumPages: P,
    primaryNumPages: x,
    metricsTick: y,
    onNumPages: b,
    onMetrics: v,
    rowSyncRevision: M
  };
}
const Pe = "data-reader-page", ke = "data-reader-pane", sr = "data-natural-height", gc = "reader-react-root", ma = "reader-react-grid", ha = "reader-react-scroll-shell", Sn = "reader-react-pdf-pane", pa = "reader-react-pdf-page", hn = "reader-react-pdf-page-placeholder", ir = "reader-react-pdf-page-slot";
function pn(e, t) {
  const n = e != null ? `[${Pe}="${e}"]` : `[${Pe}]`;
  return t ? `${n}[${ke}="${t}"]` : n;
}
function cr() {
  return `.${ir}[${Pe}]`;
}
function gn(e) {
  return Number(e.getAttribute(Pe));
}
const ga = 0.25, bn = 1, bc = 0.05, Qt = 0.5, yc = 16, vc = 8, ba = yc + vc, wc = 720;
function kt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ya(e) {
  return Number.isFinite(e) && e < wc;
}
function It(e, t = Number.POSITIVE_INFINITY) {
  return ya(t) && (e === "source" || e === "translated") ? bn : Qt;
}
function et(e) {
  return Number.isFinite(e) ? Math.min(bn, Math.max(ga, e)) : Qt;
}
function qt(e, t) {
  const n = et(Number(e) + t * bc);
  return Math.round(n * 100) / 100;
}
function Sc(e) {
  return Math.round(et(e) * 100);
}
function va(e) {
  const n = (Number(e) || 0) - ba;
  return Math.max(160, Math.floor(n));
}
function Ic(e, t = Qt) {
  const n = et(t);
  return va((Number(e) || 0) * n);
}
function Tc(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${ke}]`)
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
const kc = 8;
function Ec(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < kc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const wa = 200, Rc = [
  "markdown"
], Pc = Rc;
function Sa(e) {
  return Pc.includes(e);
}
const Mc = "retainpdf:reader:view:v1:", Ur = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), _c = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Ia() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Un(e) {
  return `${e || ""}`.trim();
}
function Nc({
  documentId: e,
  jobId: t
}) {
  const n = Un(e);
  if (n) return `document:${n}`;
  const r = Un(t);
  return r ? `job:${r}` : "";
}
function Ta(e) {
  const t = Un(e);
  return t ? `${Mc}${t}` : "";
}
function Ac(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function xc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Ur.has(t) || !Ur.has(n) || t === n))
    return { left: t, right: n };
}
function Lc(e) {
  return e === null ? null : Sa(e) ? e : void 0;
}
function Dc(e) {
  return _c.has(e) ? e : void 0;
}
function ka(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Ac(t.anchor), r = Number(t.zoom), o = Dc(t.mode), a = xc(t.splitLayout), s = Lc(t.assistantPanel);
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
function Je(e, t = Ia()) {
  const n = Ta(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ka(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function In(e, t, n = Ia()) {
  const r = Ta(e);
  if (!r || !n) return null;
  const o = Je(e, n), a = ka({
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
function Cc(e, t, n = "") {
  var d;
  const [r, o] = _(() => {
    var m;
    return ((m = Je(n)) == null ? void 0 : m.zoom) ?? It(e, kt());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), c = N(((d = Je(n)) == null ? void 0 : d.zoom) !== void 0);
  $(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Je(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? It(e, kt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), $(() => {
    if (c.current) return;
    const m = It(e, kt()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = A((m, g) => {
    const h = et(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, In(s.current, { zoom: h }), o(h));
  }, []), u = A((m) => {
    l(qt(a.current, m));
  }, [l]), f = A((m) => {
    l(It(m));
  }, [l]);
  return Le(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Tc(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const $c = 160, Oc = 3e-3, Kr = 50, zc = 16, Fc = 800;
function Bc(e, t = 0) {
  const n = t === 1 ? zc : t === 2 ? Fc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Kr, Math.min(Kr, r));
  return Math.exp(-o * Oc);
}
function jc(e, t, n = 0) {
  return et(e * Bc(t, n));
}
function Hc(e) {
  return Math.round(et(e) * 100) / 100;
}
function Uc(e, t, n) {
  const r = et(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return et(t) / r;
  const a = (o + ba) / r;
  return va(a * et(t)) / o;
}
function Kc(e) {
  return Array.from(e.querySelectorAll(cr()));
}
function Wc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Vc(e, t, n) {
  let r = null;
  for (const s of Kc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = Wc(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Pe) || "",
    pane: o.getAttribute(ke) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function qc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Ea(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${cr()}[${Pe}="${t.page}"][${ke}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (qc(n, e).scrollLeft += a);
}
function Jc(e, t, n, r) {
  const o = e.querySelector(`.${ma}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function Lt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Gc = 600, Xc = 1e3;
function Yc(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Ea(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Xc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Zc(e, t, n) {
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
      const f = Hc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Lt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Lt(d.grid));
      }, Gc), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, Lt(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: Vc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = jc(f.target, u.deltaY, u.deltaMode);
      const d = Uc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Jc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, $c);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Lt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Le(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Lt(c.grid), !(!e || !c.anchor) && (Ea(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Yc(e, c.anchor)));
  }, [t, e]);
}
function Qc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: A((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const lr = 56;
function Ra(e, t = lr) {
  return e.getBoundingClientRect().top + t;
}
function Pa(e, t) {
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
  const o = gn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Ht(e, t, n = lr) {
  if (!e)
    return null;
  const r = pn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Ra(e, n), i = Pa(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Mt(e, t, n = "auto", r, o = lr) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(pn(a, r))), i || (i = e.querySelector(pn(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function el(e, t, n = "smooth", r) {
  return Mt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Kn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var u;
    if (a) return;
    Mt(
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
function tl(e, t, n) {
  return Kn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function yn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function We(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function nl(e, t, n = !0, r = "", o) {
  const [a, s] = _(1);
  return $(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, u = 0;
    const f = pn(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = Ra(i), I = Pa(h, y);
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
const rl = `canvas, .react-pdf__Page, .${pa}, .${hn}`, Wr = /* @__PURE__ */ new WeakMap();
function ol(e) {
  const t = Number(e.getAttribute(sr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Wr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(rl), Wr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function al(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function sl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(cr()).forEach((r) => {
    const o = gn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = ol(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function il(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, Le(() => {
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
      const S = sl(b);
      al(s.current, S) || (s.current = S, a(S)), u && !f && (f = !0, (v = i.current) == null || v.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), y = window.setTimeout(m, 700), I = e.current;
    let w = null;
    return I && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => m()), w.observe(I)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const cl = [0, 48, 140, 320, 560], ll = 700, ul = [80, 200, 400], dl = 500, fl = 50, ml = /* @__PURE__ */ new Set([
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
]), hl = 180, Vr = [0, 48, 140, 320, 700, 1200];
function pl(e, t) {
  var k;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((k = Je(a)) == null ? void 0 : k.anchor) || { page: 1, fraction: 0 }
  ), c = N(null), l = N(!1), u = N(r), f = N(null), d = N(null), m = N(null), g = N(null), h = N(a), y = N(""), I = N(n);
  I.current = n;
  const w = A(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = A(() => {
    !l.current && c.current == null || (w(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [w]), S = A((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const L = () => {
      g.current = null, In(h.current, {
        anchor: We(i.current)
      });
    };
    E ? L() : g.current = setTimeout(L, hl);
  }, []), v = A((E) => {
    i.current = We(E), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, fl);
  }, []);
  $(() => {
    if (!o)
      return;
    let E = !1, L = null, C = null, W = null;
    const H = () => {
      if (E) return;
      const J = e.current;
      if (!J) {
        W = setTimeout(H, 50);
        return;
      }
      L = J, C = () => {
        if (l.current)
          return;
        const ie = Ht(L, I.current);
        ie && (i.current = ie, S());
      }, L.addEventListener("scroll", C, { passive: !0 }), l.current || C();
    };
    return H(), () => {
      E = !0, W != null && clearTimeout(W), L && C && L.removeEventListener("scroll", C);
    };
  }, [o, r, n, e, S]), $(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const L = (C) => {
      C.metaKey || C.ctrlKey || C.altKey || ml.has(C.key) && b();
    };
    return E.addEventListener("wheel", b, { passive: !0 }), E.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", L), () => {
      E.removeEventListener("wheel", b), E.removeEventListener("touchmove", b), window.removeEventListener("keydown", L);
    };
  }, [o, e, b]), Le(() => {
    var L;
    if (h.current === a) return;
    S(!0), w(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const E = (L = Je(a)) == null ? void 0 : L.anchor;
    i.current = E ? We(E) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, S, w]), $(() => {
    var L;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const E = We(
      ((L = Je(a)) == null ? void 0 : L.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, c.current = E, l.current = !0, w(), f.current = Kn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: I.current,
        delaysMs: Vr,
        onDone: () => v(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(E);
    }, Math.max(...Vr) + 160), () => w();
  }, [o, s, a, e, v, w]), $(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, w();
      return;
    }
    const E = c.current ? We(c.current) : We(i.current);
    return l.current = !0, c.current = E, i.current = E, w(), f.current = Kn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: cl,
        onDone: () => v(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(E);
    }, ll), () => {
      w();
    };
  }, [r, o, n, e, v, w]), $(() => () => {
    w(), m.current != null && (clearTimeout(m.current), m.current = null), S(!0);
  }, [w, S]);
  const P = A(() => {
    const E = Ht(
      e.current,
      I.current
    );
    return We(E || i.current);
  }, [e]), x = A(() => {
    l.current = !0;
    const E = Ht(
      e.current,
      I.current
    ), L = We(E ?? i.current);
    return i.current = L, c.current = L, S(), L;
  }, [e, S]), R = A((E, L, C) => {
    const W = C || I.current, H = yn(E, L || 1), J = { page: H, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, S(), w(), el(e.current, H, "smooth", W), f.current = tl(
      () => e.current,
      H,
      {
        behavior: "auto",
        pane: W,
        delaysMs: ul,
        onDone: () => v(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(J);
    }, dl);
  }, [e, v, w, S]), O = A(() => We(i.current), []), M = A(() => l.current, []), T = A(() => {
    if (!l.current || !c.current)
      return;
    const E = We(c.current);
    Mt(
      e.current,
      E,
      "auto",
      I.current
    );
  }, [e]);
  return {
    lockFromShell: P,
    beginModeSwitch: x,
    goToPage: R,
    getAnchor: O,
    isRestoring: M,
    repinIfRestoring: T
  };
}
function gl(e, t) {
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
function Ma(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const bl = [0, 80, 200, 400, 800], yl = 120, vl = 400;
function wl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = N(a);
  f.current = a;
  const d = N(s);
  d.current = s;
  const m = N(i);
  m.current = i;
  const g = N(n);
  g.current = n, $(() => {
    var S, v;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Mi(), y = gl(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const I = Ma(h, y, { jobId: c, documentId: l });
    if (t.current === I)
      return;
    if (y == null) {
      t.current = I, (S = g.current) == null || S.call(g);
      return;
    }
    t.current = I, h && ((v = m.current) == null || v.call(m, h, y));
    const w = [];
    let b = 0;
    for (const P of bl)
      b = Math.max(b, P), w.push(
        setTimeout(() => {
          f.current(y);
        }, P)
      );
    return w.push(
      setTimeout(() => {
        var P;
        (P = g.current) == null || P.call(g);
      }, b + yl)
    ), () => {
      for (const P of w) clearTimeout(P);
    };
  }, [r, o, c, l, t, u]);
}
function Sl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Il(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = vl,
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
      var I;
      const g = ((I = globalThis.location) == null ? void 0 : I.search) || "", h = Cs(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Ma(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || Sl)(h);
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
function Tl(e) {
  const t = N(""), [n, r] = _(!1), o = A(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  wl(a, t, o), Il(e, t, n);
}
const Dt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function kl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function qr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function _a(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = qr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = qr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function El(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = _a(r, t, n);
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
function Rl(e) {
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
function Pl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function Ml(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function _l(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Nl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Jr = [250, 500, 1e3, 2e3, 4e3], Pn = [80, 160, 320, 640, 1e3, 1500], Gr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Wn(e, t) {
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
function ur(e) {
  return Hs(e) ? `${e.code || ""}`.trim() : "";
}
function nn(e, t) {
  const n = ur(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Al(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (_a(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Us(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = ur(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Pn[Math.min(s, Pn.length - 1)];
    if (await Wn(i, r), s >= Pn.length + 2) throw a;
  }
}
function xl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _(Dt), s = N(o), i = N("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Wt(l) ? l : "";
  return $(() => {
    if (!n || !c) {
      i.current = "", s.current = Dt, a(Dt);
      return;
    }
    const f = r === void 0 ? Pi() : r, d = i.current === c;
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
      m.signal.aborted || a((S) => {
        const v = b(S);
        return s.current = v, v;
      });
    }, I = async () => {
      let b = 0;
      for (; !m.signal.aborted; )
        try {
          const S = await f.fetchLayout(c, { signal: m.signal });
          g = !0, y((v) => ({
            ...v,
            layoutByPage: kl(S),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (S) {
          if ((S == null ? void 0 : S.name) === "AbortError") return;
          const v = ur(S);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            y((x) => ({
              ...x,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: nn(S, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((x) => ({
              ...x,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((x) => ({
            ...x,
            connection: "connecting",
            jobStatus: l,
            error: nn(S, "正在等待 OCR 版面数据")
          })), await Wn(Jr[Math.min(b, Jr.length - 1)], m.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await I(), !g || m.signal.aborted) return;
      let b = 0;
      for (; !m.signal.aborted; ) {
        u || y((S) => ({
          ...S,
          connection: S.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: S.error
        }));
        try {
          await f.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (S) => {
              if (S.seq <= s.current.lastSeq) return;
              let v;
              try {
                v = await Al(
                  c,
                  S,
                  s.current,
                  m.signal,
                  f
                );
              } catch (P) {
                if ((P == null ? void 0 : P.name) === "AbortError" || m.signal.aborted) throw P;
                y((x) => ({
                  ...x,
                  lastSeq: Math.max(x.lastSeq, S.seq),
                  error: nn(P, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((P) => {
                const x = El(P, S, v);
                return u ? {
                  ...x,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...x,
                  jobStatus: l
                };
              }), b = 0;
            }
          });
        } catch (S) {
          if ((S == null ? void 0 : S.name) === "AbortError" || m.signal.aborted) return;
          y((v) => ({
            ...v,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: nn(S, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          y((S) => ({
            ...S,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Wn(Gr[Math.min(b, Gr.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function Ll(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Dl(e, t = !0) {
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return $(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = nt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Ll(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Cl = 4500;
function $l(e) {
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
const Ol = /* @__PURE__ */ new Set(["book", "translate"]);
function Na(e) {
  return !!(e.jobId && e.sourceUrl && Ol.has(e.workflow));
}
function zl(e) {
  return !!(Na(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Fl() {
  const e = lc(), t = Na({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = zl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Wt(o) && (r.current.running = !0);
  const a = xl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = mc(), u = Dl(e.jobId, !e.sourceOnly), f = Nc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = Cc(e.mode, s, f);
  Zc(i, m, g);
  const h = pc(
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
    repinIfRestoring: w
  } = pl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  $(() => {
    w();
  }, [c, w]);
  const b = il(
    s,
    h.compareMode,
    h.rowSyncRevision,
    w
  ), S = nl(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), v = A((H, J) => {
    var G, ce;
    const ie = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((G = h.numPagesByPane) == null ? void 0 : G.source) || 0,
      Number((ce = h.numPagesByPane) == null ? void 0 : ce.translated) || 0
    );
    I(H, ie, J);
  }, [I, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [P, x] = _(null), R = N(null), O = A((H) => {
    R.current && clearTimeout(R.current), x(H), H && (R.current = setTimeout(() => x(null), Cl));
  }, []);
  $(() => () => {
    R.current && clearTimeout(R.current);
  }, []);
  const M = A((H) => {
    const J = En(e.regions, H);
    return J ? $r(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), T = A((H, J) => {
    const ie = J || h.primaryPane, G = typeof H == "object" && H ? `${H.block_id || ""}`.trim() : "", ce = typeof H == "object" && H ? `${H.image_url || ""}`.trim() : "", Te = typeof H == "object" && H ? H.page_idx != null ? Number(H.page_idx) + 1 : H.page != null ? Number(H.page) : null : typeof H == "number" ? H + 1 : null, Z = Os(e.regions, ce, Te) || En(e.regions, G) || (typeof H == "object" ? zs(e.regions, H) : null);
    let me = Z ? $r(Z, ie).page : null;
    me == null && (me = $l(H)), !(me == null || me < 1) && (O(Z), v(me, ie));
  }, [O, v, h.primaryPane, e.regions]);
  Tl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: S,
    goToPage: v,
    resolveBlockPage: M,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (H) => {
      O(En(e.regions, H.blockId));
    }
  });
  const { setModeKeepingPage: k } = Qc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  $(() => {
    O(null);
  }, [d, O]);
  const E = !e.boot.loading && !e.boot.failed, L = K(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), C = K(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), W = K(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: L,
    panes: h,
    sessionFiles: C,
    rowHeights: b,
    goToPage: v,
    activeRegion: P,
    jumpToAnchor: T,
    setModeKeepingPage: k,
    download: e.download,
    showHud: E,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, L, h, C, b, v, P, T, k, E, m, g, f, a, n, u]);
  return K(() => ({
    ...W,
    currentPage: S
  }), [W, S]);
}
const Bl = [
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
], jl = [
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
function Hl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Bl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Ul(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Kl = ".reader-notes-panel";
function Wl(e) {
  return e instanceof Element ? !!e.closest(Kl) : !1;
}
function Vl(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Ul(d.target) || Wl(d.target))
        return;
      const m = d.key, g = Hl(m);
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
              a(qt(o, 1));
              return;
            case "zoom-out":
              a(qt(o, -1));
              return;
            case "zoom-reset":
              a(It(t, kt()));
              return;
            case "next-page":
              c(yn(s + 1, i));
              return;
            case "prev-page":
              c(yn(s - 1, i));
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
const Re = { size: 16, strokeWidth: 1.75 }, Xr = { size: 12, strokeWidth: 1.75 }, ql = "retainpdf:soft-reader-close";
function Jl() {
  return new URL("./index.html", window.location.href).href;
}
function Gl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: ql },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Xl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Yl() {
  if (!(typeof window > "u") && !Gl()) {
    if (Xl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Jl());
  }
}
function Zl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ql({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ D(Zl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Yl();
  }, children: [
    /* @__PURE__ */ p(ea, { className: "reader-close-home-icon", ...Re, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const eu = 3e3, tu = 8;
async function nu(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function ru(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function ou(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = eu;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = ru(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < tu && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await nu(e, i);
  })), a;
}
function Aa(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function au(e, t) {
  let n = null;
  for (const r of Aa(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let Yr = !1;
function su() {
  if (Yr)
    return;
  const e = Vt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (ua.GlobalWorkerOptions.workerSrc = e, Yr = !0);
}
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), iu = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, cu = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, lu = {
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
}, Zr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function uu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Zr(o ?? a ?? "", iu)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Zr(o ?? a ?? "", cu)).replace(/\\([a-zA-Z]+)/gu, (r, o) => lu[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function du(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const fu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function mu(e) {
  const t = [];
  for (const n of e) {
    if (!fu(n)) continue;
    const r = uu(du(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const hu = 24, pu = 60;
function Qr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - hu), o = Math.min(e.length, n + t.length + pu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function gu(e, t, n = 200) {
  const r = st(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = st(a.translatedBlockText) || st(a.translated.text), c = i ? Qr(i, r) : null, l = c ?? Qr(st(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function rn(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function zt(e, t) {
  const n = st(t).toLowerCase();
  if (!n || !e) return rn(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${rn(e.slice(a, s))}<mark class="reader-find-mark">${rn(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + rn(e.slice(a));
}
function bu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const yu = /^data-[a-z0-9-]+$/;
function eo(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function vu(e, t, n = "") {
  if (!t.length) return zt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += zt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => yu.test(c)).map(([c, l]) => ` ${c}="${eo(l)}"`).join("");
    o += `<mark class="${eo(s.className)}"${i}>${zt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + zt(e.slice(a), n);
}
function Se(e) {
  return typeof e == "string" ? e : "";
}
function wu(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Su(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Iu(e) {
  return {
    source: Se(e == null ? void 0 : e.source_text) || Se(e == null ? void 0 : e.unit_source_text),
    translated: Se(e == null ? void 0 : e.protected_translated_text) || Se(e == null ? void 0 : e.translated_text)
  };
}
const Tu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function xa(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function ku(e) {
  const t = xa(e).sort((r, o) => Se(r.ts).localeCompare(Se(o.ts)));
  return t.length ? [
    { text: Se(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: Se(r.new_text),
      label: Tu[Se(r.source)] || Se(r.source) || "修订",
      ts: Se(r.ts),
      reason: Se(r.reason)
    }))
  ].reverse() : [];
}
function Eu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Ru(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return Se(r.finished_at) || Se(n.finished_at) || "";
}
function Pu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = xa(e).sort((a, s) => Se(a.ts).localeCompare(Se(s.ts)));
  for (const a of o) {
    const s = new Date(Se(a.ts)).getTime(), i = Se(a.reader_item_id) || Se(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, Se(a.new_text));
  }
  return n;
}
const Mu = {
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
function _u(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = Mu[Se(n.kind)] || Se(n.kind) || "问题", o = Se(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Nu = /* @__PURE__ */ new Set(["text", "formula"]);
function dr(e) {
  return Nu.has(e);
}
function La(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || dr(Ue(n));
}
function Au(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !dr(Ue(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const xu = 300, Lu = 72;
function Du(e, t) {
  if (e.width >= xu && e.height >= Lu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Cu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function $u(e, t, n) {
  return e.flatMap((r) => {
    if (!Cu.has(Ue(r.region))) return [];
    const o = gt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function to(e, t, n) {
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
async function Ou(e) {
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
const zu = "reader-text-hover-copy", Fu = "reader-text-hover-edit", Bu = "reader-text-hover-zoom", ju = "reader-text-hover-id";
function Hu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Da = "reader-text-hover-tools";
function on({
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
const Uu = 26, Ku = 220;
function Wu(e, t = Ku) {
  return e.height < Uu * 2 || e.width < t;
}
function Vu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? ta : e === "failed" ? At : Vs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function qu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = _("idle"), [u, f] = _("idle"), [d] = _(() => Hu()), m = N([]), g = (e == null ? void 0 : e.itemId) || "";
  if ($(() => {
    l("idle"), f("idle");
    const v = m.current;
    return () => {
      v.forEach((P) => window.clearTimeout(P)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = Fs(e.highlight.region, t), y = Ue(e.highlight.region), I = (v, P) => async (x) => {
    x.preventDefault(), x.stopPropagation();
    const R = await Ou(v);
    P(R ? "copied" : "failed"), m.current.push(window.setTimeout(() => P("idle"), 1200));
  }, w = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, S = s || (Wu(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ D(
        "div",
        {
          className: Da,
          "data-placement": S,
          style: S === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              on,
              {
                className: ju,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: I(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && dr(y) ? /* @__PURE__ */ p(
              on,
              {
                className: Fu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(dn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              on,
              {
                className: zu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : w,
                onClick: I(h, l),
                children: /* @__PURE__ */ p(Vu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              on,
              {
                className: Bu,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Ws, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Ju(e, t) {
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
function Gu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = gt(
      Ju(e, a),
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
const Xu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Yu = 256, Ct = /* @__PURE__ */ new Map();
function Zu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Ca(e) {
  const t = `${e || ""}`, { text: n, slots: r } = wi(t, { bareLatex: !0 }), o = Zu(n), a = Si(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Ct.get(t);
  if (!s && (s = Ii(o, r), Ct.set(t, s), Ct.size > Yu)) {
    const i = Ct.keys().next().value;
    i !== void 0 && Ct.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Mn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ze(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Qu(e, t) {
  const n = e.typography, r = Ze(t) || 1, o = Ze(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Mn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ze(n == null ? void 0 : n.fit_min_font_size_pt), u = Ze(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Ze(n == null ? void 0 : n.leading_em), h = [
    Ze(n == null ? void 0 : n.padding_top_pt) || 0,
    Ze(n == null ? void 0 : n.padding_right_pt) || 0,
    Ze(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ze(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Xu,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Mn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Mn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function ed(e, t, n, r) {
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
const td = 512, $t = /* @__PURE__ */ new Map();
let Vn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Vn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Vn += 1;
}));
function nd(e, t, n, r) {
  return [
    Vn,
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
function $a({ item: e, pageScale: t }) {
  const n = N(null), r = K(
    () => Ca(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = K(
    () => Qu(e, t),
    [e, t]
  );
  $(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Le(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), I = Math.max(1, e.rect.height - d - g), w = nd(o, y, I, s);
    let b = $t.get(w);
    if (b === void 0 && (b = ed(
      (S) => (f.style.fontSize = `${S}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      I,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), $t.set(w, b), $t.size > td)) {
      const S = $t.keys().next().value;
      S !== void 0 && $t.delete(S);
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
function rd({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = K(
    () => Gu(e, t, n, r),
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
        $a,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const od = Yt(rd);
function ad({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ D("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        $a,
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
const sd = Yt(ad), Oa = 24, ot = Oa * 2 + 4, Qe = 24, id = 4, cd = 6, ft = (e) => e.left + e.width, ct = (e) => e.top + e.height;
function Ft(e, t) {
  const n = Math.min(ft(e), ft(t)) - Math.max(e.left, t.left), r = Math.min(ct(e), ct(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const no = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ft(t) && r >= t.top && r <= ct(t);
}, ld = (e) => e.height > 40 && e.height > e.width * 2.5;
function ud(e, t, n) {
  if (!t.length || e.height < Qe || e.width < n + 8) return null;
  const r = Math.max(...t.map(ct)), o = ft(e) - 4 - n;
  for (const a of [r, ct(e) - 2]) {
    const s = Math.max(e.top, a - Qe), i = { left: o, top: s, width: n, height: Qe };
    if (!t.some((c) => Ft(i, c) > 0)) return s - e.top;
  }
  return null;
}
function dd(e, t) {
  const n = [], r = (a) => {
    const s = Oa + id, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ft(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Qe - 3, width: ot, height: Qe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: ct(e), width: ot, height: Qe + 3 } }), r(!0);
  const o = ud(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ft(e) - 4 - ot, top: e.top + o, width: ot, height: Qe } }), n;
}
function fd(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((w) => w.width > 0 && w.height > 0 && !ld(w)), i = s.filter((w) => no(w, t)), c = s.filter((w) => !no(w, t)), l = n.filter((w) => w !== t && Ft(w, t) < t.width * t.height * 0.5), u = dd(t, i).filter(({ box: w, overhang: b }) => {
    const S = b ? cd : 0;
    return w.left >= -S && ft(w) <= r + S && w.top >= 0 && ct(w) <= o;
  }), f = ({ placement: w, tailTop: b }) => b === void 0 ? { placement: w } : { placement: w, tailTop: b }, d = ({ box: w }) => !c.some((b) => Ft(w, b) > 0), m = u.filter((w) => w.placement !== "tail"), g = m.find((w) => d(w) && !l.some((b) => Ft(w.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((w) => w.placement === "tail" && d(w));
  if (h) return f(h);
  let y = null, I = Number.POSITIVE_INFINITY;
  for (const w of u) {
    const b = c.reduce((S, v) => S + Ft(w.box, v), 0);
    b < I && (y = w, I = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function md(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Qe - 3 : ct(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Qe + 3;
}
const _n = (e) => e.left + e.width, Nn = (e) => e.top + e.height;
function hd(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > _n(e) || f < e.top || f > Nn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, _n(l)), i = Math.max(i, Nn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(_n(e) + r, s + n) - c.left, c.height = Math.min(Nn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function pd(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function gd(e, t, n, r) {
  const [o, a] = _(null);
  return Le(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? pd(s) : [], c = Ue(t.highlight.region) === "figure", l = i.length && !c ? hd(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...fd({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function bd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = _(null), [i, c] = _(!1), [l, u] = _([]), [f, d] = _(""), [m, g] = _(""), [h, y] = _(!1), [I, w] = _(null), [b, S] = _([]), v = r.drafts, P = r.generation, x = A(async (T, k) => {
    if (e)
      try {
        u(ku(await e.fetchRevisions(T, k)));
      } catch {
        u([]);
      }
  }, [e]);
  $(() => {
    if (s(null), u([]), w(null), S([]), g(""), !e || !t || !n) return;
    let T = !1;
    return c(!0), e.loadItem(t, n).then((k) => {
      if (T) return;
      const E = k == null ? void 0 : k.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const L = `${(k == null ? void 0 : k.item_id) || n}`, { source: C, translated: W } = Iu(E);
      s({ readerItemId: n, itemId: L, source: C, current: W }), d(v.get(n) ?? W);
    }).catch((k) => {
      T || w({ tone: "error", message: (k == null ? void 0 : k.message) || "读取这段译文失败。" });
    }).finally(() => {
      T || c(!1);
    }), x(t, n), () => {
      T = !0;
    };
  }, [e, t, n, x]);
  const R = A((T) => {
    d(T), n && v.set(n, T);
  }, [n, v]), O = A(async (T, k) => {
    if (!e || !a || h) return !1;
    const E = T ?? f;
    if (!E.trim()) return !1;
    y(!0), w(null), S([]);
    try {
      const L = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (k ?? m).trim() || "在阅读页手动修改",
        ...P.current != null ? { expected_generation: P.current } : {}
      }), C = Number(L == null ? void 0 : L.generation);
      return Number.isFinite(C) && (P.current = C), v.delete(a.readerItemId), s({ ...a, current: E }), d(E), g(""), (L == null ? void 0 : L.changed) === !1 ? w({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), w({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), x(t, a.readerItemId), !0;
    } catch (L) {
      const C = L;
      return (C == null ? void 0 : C.reason) === "generation_mismatch" && (P.current = null), w({ tone: "error", message: (C == null ? void 0 : C.message) || "保存失败，请稍后再试。" }), S(_u(C == null ? void 0 : C.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, x, v, P]), M = A(() => {
    n && v.delete(n);
  }, [n, v]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: R,
    reason: m,
    setReason: g,
    saving: h,
    status: I,
    issues: b,
    save: O,
    discardDraft: M
  };
}
const za = "reader-inline-edit";
function yd({ text: e }) {
  const [t, n] = _("");
  return $(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Ca(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ D("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function vd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var M;
  const s = e.itemId, i = bd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = _(!1), [u, f] = _(!1), d = N(null), m = Du(e.rect, t), g = K(() => Au(o), [o]), h = g.indexOf(s), { loaded: y } = i, I = i.saving || i.loading, w = n.blockedReason, b = !y || i.draft === y.current, { close: S, select: v } = n, P = A((T) => {
    const k = g[h + T];
    k && (v(k), a == null || a(k));
  }, [g, h, v, a]), x = A(() => {
    i.discardDraft(), S();
  }, [i, S]), R = A(async (T, k) => {
    await i.save(T, k) && S();
  }, [i, S]);
  $(() => {
    const T = (k) => {
      !k.altKey || k.key !== "ArrowUp" && k.key !== "ArrowDown" || (k.preventDefault(), P(k.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", T), () => window.removeEventListener("keydown", T);
  }, [P]), Le(() => {
    const T = d.current;
    if (!T) return;
    T.style.height = "auto";
    const k = m.mode === "inline" ? m.minHeight : 0;
    T.style.height = `${Math.max(k, T.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const O = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ D($e, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ D(
      "div",
      {
        className: `${za} is-${m.mode}`,
        style: O,
        role: "group",
        "aria-label": `改第 ${((M = n.target) == null ? void 0 : M.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (T) => T.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            se,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((T) => !T),
              children: y.source
            }
          ) : null,
          w ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: w }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            gi,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: I || !!w,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (T) => i.setDraft(T.target.value),
              onKeyDown: (T) => {
                T.key === "Enter" && (T.metaKey || T.ctrlKey) ? (T.preventDefault(), b || R()) : T.key === "Escape" && (T.preventDefault(), x());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(yd, { text: i.draft }) : null,
          /* @__PURE__ */ D("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => P(-1), children: /* @__PURE__ */ p(qs, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => P(1), children: /* @__PURE__ */ p(fn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              ar,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: I || !!w || !y,
                onChange: (T) => i.setReason(T.target.value),
                onKeyDown: (T) => {
                  T.key === "Enter" ? (T.preventDefault(), b || R()) : T.key === "Escape" && (T.preventDefault(), x());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ D(
              se,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((T) => !T),
                children: [
                  /* @__PURE__ */ p(Js, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(se, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: x, children: "取消" }),
            /* @__PURE__ */ p(
              se,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: I || !!w || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  R();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((T) => /* @__PURE__ */ p("li", { children: T }, T)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((T, k) => {
            const E = T.text === y.current, L = [Eu(T.ts), T.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ D("li", { "data-block-edit-history": T.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ D("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ D("span", { children: [
                  L,
                  E ? "（现在用的）" : "",
                  T.reason ? ` · ${T.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  se,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: I || !!w,
                    onClick: () => {
                      R(T.text, `回到「${L.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: T.text })
            ] }, `${T.ts}:${k}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Fa = Zt(null), Ba = Zt(null);
function wd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Fa.Provider, { value: e, children: /* @__PURE__ */ p(Ba.Provider, { value: t, children: n }) });
}
function Ge() {
  return dt(Fa);
}
function fr() {
  return dt(Ba);
}
const ja = 1.414;
function Sd({
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
  liveTranslationMissing: w = !1
}) {
  var Q, ge;
  const b = Ge(), S = b == null ? void 0 : b.revisedBlocks, v = b == null ? void 0 : b.blockEdit, P = v == null ? void 0 : v.pendingEdits, x = b == null ? void 0 : b.editBlock, R = (b == null ? void 0 : b.findTerm) || "", O = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", M = b == null ? void 0 : b.textMarks, T = K(
    () => M ? ({ str: B }) => vu(B, M(B), R) : R ? ({ str: B }) => zt(B, R) : void 0,
    [R, M]
  ), k = N(c ?? ja), [E, L] = _(k.current);
  $(() => {
    c != null && Math.abs(c - k.current) >= 1e-3 && (k.current = c, L(c));
  }, [c]);
  const C = N(u);
  C.current = u;
  const W = N(null), H = N((B) => {
    var te;
    W.current = B, (te = C.current) == null || te.call(C, B);
  }).current, J = N(null), ie = N(`${t}@${n}`);
  Le(() => {
    const B = `${t}@${n}`;
    ie.current !== B && (ie.current = B, o && Td(W.current, J.current));
  }, [o, n, t]), $(() => {
    o || An(J.current);
  }, [o]), $(() => () => An(J.current), []);
  const G = Math.max(120, Math.floor(t * E)), ce = Math.max(G, Math.ceil(s || 0)), Te = gt(f, t, G), Z = K(
    () => $u(d, t, G),
    [G, d, t]
  ), [me, Me] = _(null), re = typeof g == "function", fe = re ? m ?? null : me, F = (B) => {
    re ? B !== (m ?? null) && (g == null || g(B)) : Me((te) => te === B ? te : B);
  }, U = K(
    () => Z.find((B) => B.itemId === fe) || null,
    [fe, Z]
  ), X = r === "translated" && ((Q = v == null ? void 0 : v.target) == null ? void 0 : Q.itemId) || "", le = K(
    () => X && Z.find((B) => B.itemId === X) || null,
    [X, Z]
  ), ne = gd(W, o ? U : null, Z, t), oe = (B) => {
    var _e, Fe, ze, Ae;
    if (B.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      F(null);
      return;
    }
    if (B.buttons !== 0) {
      F(null);
      return;
    }
    if ((Fe = (_e = B.target) == null ? void 0 : _e.closest) != null && Fe.call(_e, `.${Da}`) || (Ae = (ze = B.target) == null ? void 0 : ze.closest) != null && Ae.call(ze, `.${za}`)) return;
    const te = B.currentTarget.getBoundingClientRect(), he = B.clientX - te.left, Oe = B.clientY - te.top;
    if (md(ne, he, Oe)) return;
    const De = to(Z, he, Oe);
    F((De == null ? void 0 : De.itemId) || null);
  }, Ie = (B) => {
    if (B.pointerType === "mouse") return;
    const te = B.currentTarget.getBoundingClientRect(), he = to(
      Z,
      B.clientX - te.left,
      B.clientY - te.top
    );
    F((he == null ? void 0 : he.itemId) || null);
  }, ae = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(k.current - B) < 1e-3 || (k.current = B, L(B), l == null || l(e, B));
  };
  return /* @__PURE__ */ D(
    "div",
    {
      ref: H,
      [Pe]: e,
      [ke]: r,
      [sr]: G,
      className: ir,
      onPointerMoveCapture: oe,
      onPointerDown: Ie,
      onDoubleClick: (B) => {
        const te = b == null ? void 0 : b.zoomBlock;
        !te || b != null && b.pointerTaken || !U || Ue(U.highlight.region) === "figure" && (B.preventDefault(), te(U.itemId));
      },
      onPointerLeave: (B) => {
        B.pointerType === "mouse" && F(null);
      },
      style: {
        width: t,
        height: ce,
        minHeight: ce
      },
      children: [
        o ? /* @__PURE__ */ p(
          yi,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: T,
            renderAnnotationLayer: !1,
            className: pa,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: hn,
                style: { width: t, height: G }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const te = B.getViewport({ scale: 1 });
                if (te.width > 0) {
                  const he = te.height / te.width;
                  ae(he);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              An(J.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: hn,
            style: { width: t, height: G },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        Te ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: Te,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && I ? /* @__PURE__ */ p(
          od,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: G
          }
        ) : null,
        o && I && w ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ p(sd, { targets: Z, edits: P, width: t, excludeId: le == null ? void 0 : le.itemId }) : null,
        o && le && v ? /* @__PURE__ */ p(
          vd,
          {
            target: le,
            page: { width: t, height: G },
            edit: v,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (S != null && S.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: Z.filter((B) => S.has(B.itemId)).map((B) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": B.itemId,
            style: { left: B.rect.left, top: B.rect.top, height: B.rect.height }
          },
          B.itemId
        )) }) : null,
        (ge = b == null ? void 0 : b.pageLayers) == null ? void 0 : ge.map((B) => /* @__PURE__ */ p(vn, { children: B.render({ page: e, width: t, height: G, pane: O, active: o }) }, B.id)),
        /* @__PURE__ */ p(
          qu,
          {
            target: o && !(b != null && b.pointerTaken) && (U == null ? void 0 : U.itemId) !== (le == null ? void 0 : le.itemId) ? U : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: U && (S == null ? void 0 : S.get(U.itemId)) || 0,
            onEdit: x,
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
const Id = Yt(Sd);
function Td(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function An(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const kd = 2 * 1024 * 1024;
function Ed(e) {
  const t = new ua.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const xn = 5, Rd = "120% 0px", Pd = 120, Md = "25% 0px";
let ro = 1;
const oo = /* @__PURE__ */ new WeakMap();
function _d(e) {
  if (!e) return 0;
  const t = oo.get(e);
  if (t) return t;
  const n = ro;
  return ro += 1, oo.set(e, n), n;
}
function Nd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Ad = Ms(
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
    readerMetadata: w = null,
    hoveredRegionId: b = null,
    onHoverRegion: S,
    liveTranslation: v,
    showLiveTranslation: P = t === "source",
    liveTranslationPendingLabel: x = "",
    paneAction: R
  }, O) {
    su();
    const { file: M, loading: T, error: k } = rc(n, r), E = `${n}\0${_d(M)}`, L = N(E);
    L.current = E;
    const C = K(() => {
      const z = Yi(M);
      return z ? "ranged" in z ? { range: Ed(z.ranged) } : z : null;
    }, [M, n]), [W, H] = _(0), [J, ie] = _(""), [G, ce] = _(null), [Te, Z] = _(480), me = N(null), Me = N(0), re = K(() => Nd(), []), fe = K(() => ({
      cMapUrl: Vt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Vt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: kd,
      disableAutoFetch: !0
    }), []);
    or(O, () => G, [G]), $(() => {
      const z = (Y) => {
        Me.current = Y, Z(Y);
      }, q = (Y) => {
        const ye = Ec(Y, Me.current);
        if (ye !== "ignore") {
          if (me.current && clearTimeout(me.current), ye === "immediate") {
            z(Y);
            return;
          }
          me.current = setTimeout(() => z(Y), wa);
        }
      }, ee = !!(c && c >= 80);
      q(ee ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ve = !ee && i && typeof ResizeObserver < "u" ? new ResizeObserver((Y) => {
        var ye, Ee;
        q(((Ee = (ye = Y[0]) == null ? void 0 : ye.contentRect) == null ? void 0 : Ee.width) ?? i.clientWidth);
      }) : null;
      return ve && i && ve.observe(i), () => {
        ve == null || ve.disconnect(), me.current && clearTimeout(me.current);
      };
    }, [c, i, a]);
    const F = K(
      () => Ic(Te, o),
      [Te, o]
    ), [U, X] = _(() => /* @__PURE__ */ new Map()), [le, ne] = _(() => /* @__PURE__ */ new Set()), [oe, Ie] = _(() => /* @__PURE__ */ new Set()), ae = N(/* @__PURE__ */ new Map()), Q = N(null), ge = N(null), [B, te] = _(() => /* @__PURE__ */ new Set()), he = N(/* @__PURE__ */ new Map()), Oe = A((z, q) => {
      X((ee) => {
        if (ee.get(z) === q) return ee;
        const ue = new Map(ee);
        return ue.set(z, q), ue;
      });
    }, []), De = A((z, q) => {
      const ee = ae.current, ue = ee.get(z), ve = [Q.current, ge.current];
      if (ue)
        for (const Y of ve)
          try {
            Y == null || Y.unobserve(ue);
          } catch {
          }
      if (q) {
        ee.set(z, q);
        for (const Y of ve)
          try {
            Y == null || Y.observe(q);
          } catch {
          }
      } else
        ee.delete(z);
    }, []), _e = N(/* @__PURE__ */ new Map()), Fe = A((z) => {
      const q = _e.current;
      let ee = q.get(z);
      return ee || (ee = (ue) => De(z, ue), q.set(z, ee)), ee;
    }, [De]);
    $(() => {
      if (typeof IntersectionObserver > "u") return;
      const z = he.current, q = new IntersectionObserver(
        (ee) => {
          const ue = [], ve = [];
          for (const Y of ee) {
            const ye = Y.target, Ee = gn(ye);
            Number.isFinite(Ee) && (Y.isIntersecting ? ue : ve).push(Ee);
          }
          if ((ue.length || ve.length) && ne((Y) => {
            let ye = null;
            for (const Ee of ue)
              Y.has(Ee) || (ye = ye || new Set(Y), ye.add(Ee));
            for (const Ee of ve)
              Y.has(Ee) && (ye = ye || new Set(Y), ye.delete(Ee));
            return ye || Y;
          }), ue.length) {
            for (const Y of ue) {
              const ye = z.get(Y);
              ye && (clearTimeout(ye), z.delete(Y));
            }
            Ie((Y) => {
              let ye = null;
              for (const Ee of ue)
                Y.has(Ee) || (ye = ye || new Set(Y), ye.add(Ee));
              return ye || Y;
            });
          }
          for (const Y of ve)
            z.has(Y) || z.set(Y, setTimeout(() => {
              z.delete(Y), Ie((ye) => {
                if (!ye.has(Y)) return ye;
                const Ee = new Set(ye);
                return Ee.delete(Y), Ee;
              });
            }, Pd));
        },
        { root: i, rootMargin: Rd, threshold: 0 }
      );
      Q.current = q;
      for (const ee of ae.current.values())
        try {
          q.observe(ee);
        } catch {
        }
      return () => {
        q.disconnect(), Q.current === q && (Q.current = null);
        for (const ee of z.values()) clearTimeout(ee);
        z.clear();
      };
    }, [i]), $(() => {
      if (typeof IntersectionObserver > "u") return;
      const z = new IntersectionObserver(
        (q) => {
          te((ee) => {
            let ue = null;
            for (const ve of q) {
              const Y = gn(ve.target);
              !Number.isFinite(Y) || ve.isIntersecting === ee.has(Y) || (ue = ue || new Set(ee), ve.isIntersecting ? ue.add(Y) : ue.delete(Y));
            }
            return ue || ee;
          });
        },
        { root: i, rootMargin: Md, threshold: 0 }
      );
      ge.current = z;
      for (const q of ae.current.values())
        try {
          z.observe(q);
        } catch {
        }
      return () => {
        z.disconnect(), ge.current === z && (ge.current = null);
      };
    }, [i]);
    const ze = !!i && typeof IntersectionObserver < "u";
    Le(() => {
      H(0), ie(""), ne(/* @__PURE__ */ new Set()), Ie(/* @__PURE__ */ new Set()), X(/* @__PURE__ */ new Map()), ae.current.clear();
      const z = he.current;
      for (const q of z.values()) clearTimeout(q);
      z.clear(), h == null || h(0, t);
    }, [E, h, t]);
    const Ae = A(
      (z) => {
        if (L.current !== E) return;
        const q = z.numPages;
        H(q), ie(""), h == null || h(q, t), f == null || f({ numPages: q, pane: t }), m && typeof z.getPage == "function" && m(z, t), d && typeof z.getOutline == "function" && ou(z).then((ee) => {
          L.current === E && d(ee, t);
        }, () => {
        });
      },
      [E, f, d, m, h, t]
    ), Ke = A(
      (z) => {
        if (L.current !== E) return;
        const q = (z == null ? void 0 : z.message) || "PDF 解析失败";
        ie(q), H(0), h == null || h(0, t), g == null || g(z, t);
      },
      [E, g, h, t]
    ), Ce = K(
      () => W > 0 ? Array.from({ length: W }, (z, q) => q + 1) : [],
      [W]
    );
    $(() => {
      typeof IntersectionObserver < "u" || Ie(new Set(Ce));
    }, [Ce]);
    const Be = K(
      () => Pt(y, w, t),
      [y, w, t]
    ), j = K(() => {
      const z = /* @__PURE__ */ new Map();
      for (const q of I) {
        const ee = Pt(q, w, t);
        if (!ee) continue;
        const ue = z.get(ee.box.page) || [];
        ue.push(ee), z.set(ee.box.page, ue);
      }
      return z;
    }, [t, w, I]), V = K(() => {
      const z = /* @__PURE__ */ new Set();
      if (!b) return z;
      for (const [q, ee] of j)
        ee.some((ue) => ue.itemId === b) && z.add(q);
      return z;
    }, [b, j]), de = K(() => {
      if (W === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Ce);
      if (le.size === 0) {
        const ee = Math.min(W, xn * 2 + 1);
        return new Set(Array.from({ length: ee }, (ue, ve) => ve + 1));
      }
      const q = /* @__PURE__ */ new Set();
      for (const ee of le)
        for (let ue = -xn; ue <= xn; ue++) {
          const ve = ee + ue;
          ve >= 1 && ve <= W && q.add(ve);
        }
      return q;
    }, [W, Ce, i, a, le]), we = !n || !!k || !!J, pe = n && (k || J) || s;
    return /* @__PURE__ */ D(
      "section",
      {
        ref: ce,
        className: `reader-panel ${Sn}${a ? "" : " is-hidden"}`,
        [ke]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (v == null ? void 0 : v.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          R ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: R }) : null,
          x ? /* @__PURE__ */ D("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: x })
          ] }) : null,
          we && !T ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: pe }) : null,
          T ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          C && !k ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            vi,
            {
              file: C,
              loading: null,
              error: null,
              options: fe,
              onLoadSuccess: Ae,
              onLoadError: Ke,
              className: "reader-react-pdf-document",
              children: Ce.map((z) => {
                if (de.has(z))
                  return /* @__PURE__ */ p(
                    Id,
                    {
                      pane: t,
                      pageNumber: z,
                      width: F,
                      devicePixelRatio: re,
                      active: oe.has(z),
                      textLayer: !ze || B.has(z),
                      syncedMinHeight: (l == null ? void 0 : l.get(z)) || 0,
                      onMetrics: u,
                      cachedAspect: U.get(z),
                      onAspectChange: Oe,
                      sentinelRef: Fe(z),
                      regionHighlight: (Be == null ? void 0 : Be.box.page) === z ? Be : null,
                      regionTargets: j.get(z),
                      hoveredRegionId: b && V.has(z) ? b : null,
                      onHoverRegion: S,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(z - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(z - 1),
                      showLiveTranslation: P,
                      liveTranslationMissing: Ml(v, z - 1)
                    },
                    `${t}-${z}`
                  );
                const ee = U.get(z) ?? ja, ue = Math.max(120, Math.floor(F * ee)), ve = Math.max(ue, Math.ceil((l == null ? void 0 : l.get(z)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Fe(z),
                    [Pe]: z,
                    [ke]: t,
                    [sr]: ue,
                    className: `${ir} is-placeholder`,
                    style: {
                      width: F,
                      height: ve,
                      minHeight: ve
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: hn,
                        style: { width: F, height: ue },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${z}`
                );
              })
            },
            E
          ) }) : null
        ]
      }
    );
  }
), ao = Yt(Ad), xd = 2e3, Ld = 6, Dd = 500, so = "reader-react-resizing";
function Cd(e, t) {
  const n = N(null), r = N(null);
  Le(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const S = $d(e), v = Ht(e, S);
      if (!v) return;
      s = { pane: S, progress: v, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), I = typeof ResizeObserver > "u" ? null : new ResizeObserver((S) => {
      let v = !1;
      for (const P of S) {
        const x = Math.round(P.contentRect.height);
        y.has(P.target) && y.get(P.target) !== x && (v = !0), y.set(P.target, x);
      }
      v && Mt(e, c, "auto", i);
    }), w = () => {
      var S;
      f && clearTimeout(f), cancelAnimationFrame(u), I == null || I.disconnect(), e.classList.remove(so);
      for (const v of io) e.removeEventListener(v, w);
      ((S = r.current) == null ? void 0 : S.stop) === w && (r.current = null);
    }, b = () => {
      Mt(e, c, "auto", i);
      const S = e.scrollHeight;
      g = S === m ? g + 1 : 0, m = S;
      const v = performance.now() - h;
      g >= Ld && (S !== d || v > Dd) || v > xd ? w() : u = requestAnimationFrame(b);
    };
    for (const S of io) e.addEventListener(S, w, { passive: !0 });
    for (const S of Array.from(e.children)) I == null || I.observe(S);
    e.classList.add(so), r.current = { ...s, stop: w }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, wa);
  }, [e, t]), $(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function $d(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Pe}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ke) || null;
  }
  return null;
}
const io = ["wheel", "touchstart", "keydown", "pointerdown"];
function Od(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function zd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(Sn)) && ((n = e.hasAttribute) != null && n.call(e, ke)));
}
function Fd(e, t) {
  $(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!zd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${Sn}[${ke}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = Od(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Bd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function jd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const co = 12;
function mr(e) {
  return Array.from(e.querySelectorAll(`.${Sn}[${ke}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Hd(e) {
  const t = e.getBoundingClientRect();
  return mr(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(ke) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function Ud(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Kd(e, t) {
  return e ? mr(e).find((n) => n.getAttribute(ke) === t) ?? null : null;
}
function Wd({ shellEl: e }) {
  const [t, n] = _([]), r = N(0), o = A(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Hd(e);
      n((i) => Ud(i, s) ? i : s);
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
        for (const f of mr(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Vd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Vd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - co * 2), r = Bd(e, n), o = N(null);
  if (!r) return null;
  const a = (d) => {
    const m = Kd(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + jd(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + co, width: n },
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
function Ha(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function qd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Jd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ D("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Ha(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(ta, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Gs, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ D("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ D(
        se,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(na, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ D(
        se,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Xs, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function lo({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = qd(t), a = [e === "compare" ? "对比" : "正在读", r, Ha(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ D("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Gd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = _({ source: null, translated: null });
  return Le(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${ke}="${l}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${ke}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ D("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(lo, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(lo, { role: "reading", ...n }) }) : null
  ] });
}
const Xd = () => () => {
}, uo = () => null;
function Yd({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Zd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Qd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function ef(e) {
  const t = Ge(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Qt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, I = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, S = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", v = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, x = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, R = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), M = t == null ? void 0 : t.onPdfOutline, T = t == null ? void 0 : t.onPdfDocument, k = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], L = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), C = (t == null ? void 0 : t.regionHover) ?? null, [W, H] = _(null), J = wn(
    C ? C.subscribe : Xd,
    C ? () => C.get().itemId : uo,
    C ? () => C.get().itemId : uo
  ), ie = C ? J : W, G = A((me) => {
    C ? C.set(me, "pdf") : H(me);
  }, [C]), ce = Yd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), Z = Number.isFinite(g) && g > 0 ? Zd(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !ce.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Cd(d, Z), Fd(d, ce.compareMode), /* @__PURE__ */ D(
    "div",
    {
      ref: f,
      className: ha,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(Bs).length,
      "data-reader-metadata-ready": L ? "true" : "false",
      children: [
        /* @__PURE__ */ D(
          "main",
          {
            className: `${ma} reader-mode-${ce.mode}`,
            "data-reader-mode": ce.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                ao,
                {
                  pane: "source",
                  url: S,
                  preloadedFile: P,
                  userZoom: m,
                  visible: ce.showSource,
                  scrollRoot: d,
                  pageWidthOverride: Z,
                  rowHeights: ce.compareMode ? h : void 0,
                  onMetrics: R,
                  emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: O,
                  onOutline: b ? void 0 : M,
                  onDocument: b ? void 0 : T,
                  activeRegion: k,
                  regions: (b == null ? void 0 : b.regions) ?? E,
                  readerMetadata: L,
                  hoveredRegionId: ie,
                  onHoverRegion: G,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Qd(o) : "",
                  paneAction: u && ce.showTranslated ? /* @__PURE__ */ D($e, { children: [
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
                ao,
                {
                  pane: "translated",
                  url: v,
                  preloadedFile: x,
                  userZoom: m,
                  visible: ce.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: Z,
                  rowHeights: ce.compareMode ? h : void 0,
                  onMetrics: R,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: O,
                  onOutline: M,
                  onDocument: T,
                  activeRegion: k,
                  regions: E,
                  readerMetadata: L,
                  hoveredRegionId: ie,
                  onHoverRegion: G,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Wd, { shellEl: d }),
        b ? /* @__PURE__ */ p(Gd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const tf = 72, an = 1500, nf = 2e3, rf = 1200;
function of(e, t) {
  return e - t < tf;
}
function af(e) {
  try {
    return e.matches(":focus-visible");
  } catch {
    return !1;
  }
}
function sf(e, t) {
  const [n, r] = _(!0), o = N(null), a = N(!1), s = N(!1), i = A(() => {
    o.current !== null && (window.clearTimeout(o.current), o.current = null);
  }, []), c = A((u) => {
    i(), o.current = window.setTimeout(() => {
      o.current = null, s.current || r(!1);
    }, u);
  }, [i]);
  $(() => {
    var S;
    const u = (S = e.current) == null ? void 0 : S.parentElement;
    if (!u) return;
    let f = u.getBoundingClientRect().top;
    const d = () => {
      f = u.getBoundingClientRect().top;
    }, m = (v) => {
      v.pointerType !== "touch" && (of(v.clientY, f) ? a.current || (a.current = !0, i(), r(!0)) : a.current && (a.current = !1, c(an)));
    }, g = () => {
      a.current && (a.current = !1, c(an));
    }, h = (v) => {
      s.current = v.target instanceof Element && af(v.target), s.current && (i(), r(!0));
    }, y = (v) => {
      var R;
      const P = v.relatedTarget;
      if (P instanceof Node && ((R = e.current) != null && R.contains(P))) return;
      const x = s.current;
      s.current = !1, x && !a.current && c(an);
    }, I = () => {
      a.current || (r(!0), c(an));
    }, w = () => {
      s.current = !1;
    }, b = e.current;
    return c(nf), b == null || b.addEventListener("focusin", h), b == null || b.addEventListener("focusout", y), b == null || b.addEventListener("pointerdown", w), u.addEventListener("scroll", I, { capture: !0, passive: !0 }), u.addEventListener("pointerenter", d), u.addEventListener("pointermove", m, { passive: !0 }), u.addEventListener("pointerleave", g), window.addEventListener("resize", d), () => {
      i(), b == null || b.removeEventListener("focusin", h), b == null || b.removeEventListener("focusout", y), b == null || b.removeEventListener("pointerdown", w), u.removeEventListener("scroll", I, { capture: !0 }), u.removeEventListener("pointerenter", d), u.removeEventListener("pointermove", m), u.removeEventListener("pointerleave", g), window.removeEventListener("resize", d);
    };
  }, [e, i, c]);
  const l = N(t);
  return $(() => {
    l.current !== t && (l.current = t, !a.current && (r(!0), c(rf)));
  }, [t, c]), n;
}
const cf = [
  { id: "source", label: "原文", Icon: ra },
  { id: "compare", label: "对照", Icon: oa },
  { id: "translated", label: "译文", Icon: aa }
];
function lf(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function uf(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function df(e) {
  const t = Ge(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? lf(a.state) : "", l = N(null), u = sf(l, n);
  return (
    // 浮在书页区顶上（2026-11-28 用户：「顶部的 bar 不要保留了，用悬浮的方式……更有沉浸感」）：
    // 这一层本身透明、不接点击，只有左上的胶囊和正中的页签接；左右两段同宽，页签在书页区正中。
    // 读的时候藏着，鼠标到书页区顶上才出来（use-topbar-reveal.ts；不藏的几种在 chrome.css）。
    /* @__PURE__ */ D("header", { className: "reader-workspace-bar", ref: l, "data-revealed": u ? "true" : "false", children: [
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
      e.start ? /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }) : null,
      /* @__PURE__ */ D("div", { className: "reader-workspace-center", children: [
        /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: cf.map(({ id: f, label: d, Icon: m }) => {
          const g = n === f, h = uf({
            id: f,
            documentReady: r,
            sourceViewOnly: i,
            liveTranslationAvailable: !!a
          });
          return /* @__PURE__ */ D(vn, { children: [
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
        a ? /* @__PURE__ */ D("div", { className: "reader-live-strip", children: [
          /* @__PURE__ */ D(
            "button",
            {
              type: "button",
              className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
              "aria-pressed": a.visible,
              "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
              title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
              onClick: a.onToggle,
              children: [
                /* @__PURE__ */ p(Ys, { ...Re, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
              ]
            }
          ),
          a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ D(
            se,
            {
              className: "reader-live-translation-toggle reader-live-jump",
              "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
              title: `跳到最新译好的第 ${a.latestPage} 页`,
              onClick: a.onJumpToLatest,
              children: [
                /* @__PURE__ */ p(Zs, { ...Re, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
              ]
            }
          ) : null
        ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ D(
          se,
          {
            className: "reader-live-translation-toggle is-done",
            title: "翻译完成，左右对照看最终译文",
            onClick: s.onOpenCompare,
            children: [
              /* @__PURE__ */ p(Qs, { ...Re, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
            ]
          }
        ) }) : null
      ] }),
      /* @__PURE__ */ p("span", { className: "reader-workspace-end", "aria-hidden": "true" })
    ] })
  );
}
const Ua = [];
function ff() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = Ua;
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
function mf(e, t) {
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
function hf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function pf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function gf(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function bf(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function yf(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function vf(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function wf(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const Tn = Zt(null), Ka = Zt(null);
function Sf({ api: e, store: t, children: n }) {
  const r = K(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(Tn.Provider, { value: r, children: n });
}
function en() {
  const e = dt(Tn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const If = () => () => {
}, fo = () => Ua;
function Tf(e) {
  return wn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Wa() {
  var t;
  const e = (t = dt(Tn)) == null ? void 0 : t.store;
  return wn((e == null ? void 0 : e.subscribe) ?? If, (e == null ? void 0 : e.getSnapshot) ?? fo, (e == null ? void 0 : e.getSnapshot) ?? fo);
}
function kn(e) {
  var a;
  const t = (a = dt(Tn)) == null ? void 0 : a.store, n = dt(Ka);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  $(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), $(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class kf extends _s {
  constructor() {
    super(...arguments);
    xr(this, "state", { failed: !1 });
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
const Ef = Yt(function({ extensions: t }) {
  return /* @__PURE__ */ p($e, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(kf, { id: n, children: /* @__PURE__ */ p(Rf, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function Rf({ id: e, title: t, children: n }) {
  const r = K(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(Ka.Provider, { value: r, children: n });
}
function Pf({
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
const mo = 6e3;
function Va(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function qa(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > mo && (s *= mo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function Ja({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = N(null), [i, c] = _({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return $(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = qa(n, m, r, g), y = s.current, I = y == null ? void 0 : y.getContext("2d");
        if (!y || !I) return;
        y.width = h.canvasWidth, y.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const w = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), b = d.render({ canvasContext: I, viewport: w });
        f = b, await b.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && c((m) => ({ status: "error", cssHeight: m.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, l]), /* @__PURE__ */ D(
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
const Mf = 1600, hr = { left: 0, top: 0, width: 1, height: 1 };
function Ga(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function _f(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function Nf(e, t, n = hr, r = Mf) {
  const o = await e.getPage(t), a = qa(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, Ga(s);
}
async function Af(e, t = hr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), Ga(s);
}
function xf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const Lf = 4e3;
function Df(e, t, n) {
  if (e.length) {
    const o = au(e, n), a = o ? Aa(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function ho(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Pe}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, Lf), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function Cf(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Pt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = gt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function $f({
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
  const l = e.getAttribute(ke) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? Cf(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: Df(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
function Of(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Pe}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Pe)) || 0, i = (o.closest(`[${ke}]`) ?? o).getAttribute(ke) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function zf({ onDone: e, onCancel: t }) {
  const [n, r] = _(null), o = N(null), a = N(null);
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
      return Of(c, l);
    } finally {
      u && (u.style.pointerEvents = "");
    }
  }, i = n ? { left: Math.min(n.from.x, n.to.x), top: Math.min(n.from.y, n.to.y), width: Math.abs(n.to.x - n.from.x), height: Math.abs(n.to.y - n.from.y) } : null;
  return /* @__PURE__ */ D(
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
        const f = _f(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const po = 5e4, Ff = 2e4;
function Ln(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function qg(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Bf(e, t = null) {
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
function jf(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Hf(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function Jg(e, t) {
  var r;
  const n = Hf(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Gg(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function Uf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Kf(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Kf(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Wf(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Uf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: jf(o.selection, n),
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
function Vf(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Ln(e.question.text, po), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Ln(e.answer.text, po),
      thought: e.answer.thought ? Ln(e.answer.thought, Ff) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function qf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Jf(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Gf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Xf(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Yf = 50, Xa = 2, Dn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Zf() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function go(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Qf({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = _(!1), [i, c] = _(Dn), [l, u] = _(!1), [f, d] = _(""), [m, g] = _("idle"), [h, y] = _(null), [I, w] = _([]), b = A((F) => {
    y(F), w([]);
  }, []), S = A((F) => w((U) => [...U, F].slice(-Xa)), []), [v, P] = _(() => /* @__PURE__ */ new Map()), x = N(/* @__PURE__ */ new Set()), R = N(/* @__PURE__ */ new Map()), O = (F) => {
    if (!F) return null;
    const U = R.current.get(F);
    return U || (M.current.records.some((X) => X.message_id === F) ? F : null);
  }, M = N(i);
  M.current = i;
  const T = N(t);
  T.current = t;
  const k = N(0), E = A(async (F, U, X, le = []) => {
    if (!r) return;
    const ne = await r.messages(F.conversation_id, { limit: Yf, ...X ? { beforeSeq: X } : {} }), oe = [...ne.messages, ...le];
    k.current += 1, c({
      conversation: F,
      main: U ?? F,
      records: oe,
      compactions: ne.compactions || [],
      hasMore: ne.has_more,
      key: `${F.conversation_id}:${k.current}`,
      initial: Wf(oe, ne.compactions || [], T.current.documentId)
    });
  }, [r]), L = A(async () => {
    s(!0);
    const F = M.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) === "main" && F.status !== "archived")) {
      u(!0), d("");
      try {
        const U = await r.main(T.current.documentId || void 0);
        await E(U, U);
      } catch (U) {
        d(U instanceof Error ? U.message : String(U));
      } finally {
        u(!1);
      }
    }
  }, [r, E]), C = A((F) => {
    b(F), L();
  }, [L]), W = N(t.documentId);
  $(() => {
    W.current !== t.documentId && (W.current = t.documentId, M.current = Dn, c(Dn), b(null), P(/* @__PURE__ */ new Map()), R.current.clear(), a && L());
  }, [t.documentId, a, L]);
  const H = A(async () => {
    const F = M.current, U = F.records[0];
    if (!(!F.conversation || !U || !F.hasMore)) {
      u(!0);
      try {
        await E(F.conversation, F.main, U.seq, F.records);
      } finally {
        u(!1);
      }
    }
  }, [E]), J = A(async (F) => {
    const X = M.current.conversation;
    if (!r || !X) return;
    for (const Q of F.memoryIds) x.current.add(Q);
    let le = F.memoryIds;
    if (!le.length && o && F.startedAt) {
      const Q = Jf(
        await o.list({ source_conversation_id: X.conversation_id, created_after: qf(F.startedAt) }).catch(() => []),
        x.current
      );
      for (const B of Q) x.current.add(B.id);
      le = Q.map((B) => B.id);
      const ge = F.answerId;
      Q.length && ge && P((B) => new Map(B).set(ge, Q));
    }
    const ne = Vf({ ...F, memoryIds: le }, T.current.documentId, Zf(), O(F.editedFrom));
    let oe;
    try {
      oe = await r.append(X.conversation_id, ne);
    } catch (Q) {
      if (X.kind !== "side" || !/ask_conversation_not_open/.test(go(Q))) throw Q;
      await r.reopen(X.conversation_id), oe = await r.append(X.conversation_id, ne);
    }
    const [Ie, ae] = oe.messages;
    F.questionId && Ie && R.current.set(F.questionId, Ie.message_id), F.answerId && ae && R.current.set(F.answerId, ae.message_id), c((Q) => {
      var ge;
      return ((ge = Q.conversation) == null ? void 0 : ge.conversation_id) === X.conversation_id ? { ...Q, conversation: oe.conversation, records: [...Q.records, ...oe.messages] } : Q;
    }), n == null || n(oe.messages), oe.compaction_due && X.kind === "main" && r.compact(X.conversation_id).catch(() => {
    });
  }, [r, o, n]), ie = A(async (F) => {
    const U = M.current.conversation, X = O(F);
    if (!r || !U || !X) return null;
    try {
      await r.supersede(U.conversation_id, X);
    } catch (oe) {
      if (!/ask_message_superseded/.test(go(oe))) throw oe;
    }
    const le = M.current.records.find((oe) => oe.message_id === X), ne = M.current.records.findIndex((oe) => oe.message_id === X);
    return c((oe) => ({ ...oe, records: oe.records.map((Ie, ae) => ae >= ne && ne >= 0 && !Ie.superseded_at ? { ...Ie, superseded_at: "now" } : Ie) })), (le == null ? void 0 : le.selection) ?? null;
  }, [r]), G = A((F) => {
    J(F).catch((U) => d(`这一轮没存上：${U instanceof Error ? U.message : String(U)}`));
  }, [J]), ce = A(async (F) => {
    var le;
    const U = M.current, X = U.main;
    if (!(!r || !X || ((le = U.conversation) == null ? void 0 : le.kind) !== "main")) {
      d("");
      try {
        const ne = Gf(U.records, F), oe = await r.fork({
          parent_id: X.conversation_id,
          ...ne ? { forked_from_message_id: ne } : {},
          title: Xf(F.text),
          ...T.current.documentId ? { document_id: T.current.documentId } : {}
        });
        await E(oe, X);
      } catch (ne) {
        d(`开不了副对话：${ne instanceof Error ? ne.message : String(ne)}`);
      }
    }
  }, [r, E]), Te = A(async (F) => {
    const U = M.current.main;
    if (r)
      try {
        await E(await r.get(F), U);
      } catch (X) {
        d(`打不开副对话：${X instanceof Error ? X.message : String(X)}`);
      }
  }, [r, E]), Z = A(async () => {
    const F = M.current.main;
    F && await E(F, F).catch(() => {
    });
  }, [E]), me = A(async () => {
    const F = M.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) !== "side")) {
      g("busy");
      try {
        await r.close(F.conversation_id), g("idle"), await Z();
      } catch {
        g("failed");
      }
    }
  }, [r, Z]), Me = A(async () => r != null && r.archived ? r.archived(T.current.documentId) : [], [r]), re = A(async (F) => {
    d(""), b(null);
    try {
      await E(F, M.current.main);
    } catch (U) {
      d(`打不开这个对话：${U instanceof Error ? U.message : String(U)}`);
    }
  }, [E, b]), fe = A(async () => {
    const F = M.current.main;
    if (!r || !F) return;
    await r.archive(F.conversation_id);
    const U = await r.main(T.current.documentId || void 0);
    await E(U, U);
  }, [r, E]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: f,
    pending: h,
    setPending: b,
    extras: I,
    addExtra: S,
    closingSide: m,
    notices: v,
    persistent: !!r,
    openMain: L,
    ask: C,
    close: A(() => s(!1), []),
    loadEarlier: H,
    onTurn: G,
    rewrite: ie,
    fork: ce,
    openSide: Te,
    backToMain: Z,
    closeSide: me,
    archiveMain: fe,
    listArchived: Me,
    viewArchived: re,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function bo(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Bf({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function em({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = _([]), s = N(0), i = N(r);
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
      (h) => d(h.map((y) => bo(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = A((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => bo(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = A((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const tm = Yo(() => import("./ReaderAskPanel-CaNHS6mS.js"));
function nm({
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
  var Be;
  const w = K(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), b = A((j, V, de) => {
    const we = j ? o.find((q) => q.itemId === j) : null, pe = we ? Pt(we, a, V) : null, z = pe && pe.box.page === de ? gt(pe, 1, 1) : null;
    return z ? { x: z.left, y: z.top } : null;
  }, [o, a]), S = em({ port: e, documentId: t, resetKey: c, pointOf: b }), v = Qf({ port: e, book: w, onAppended: S.addRecords }), [P, x] = _(null), R = A(
    (j, V, de, we) => $f({
      pageElement: (j == null ? void 0 : j.closest(`[${Pe}]`)) ?? null,
      clientX: V,
      clientY: de,
      itemId: i(),
      selection: we,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), O = A(() => {
    var V;
    const j = ho(((V = globalThis.getSelection) == null ? void 0 : V.call(globalThis)) ?? null);
    return !j.text || !j.element || !j.rect ? null : R(j.element, j.rect.left + j.rect.width / 2, j.rect.top + j.rect.height / 2, j.text);
  }, [R]), M = A((j) => {
    x(null), v.ask(j);
  }, [v.ask]);
  $(() => {
    if (!e) return;
    const j = (V) => {
      var pe;
      if (V.key !== "?" || V.metaKey || V.ctrlKey || V.altKey || V.defaultPrevented) return;
      const de = V.target;
      if ((pe = de == null ? void 0 : de.closest) != null && pe.call(de, "input, textarea, select, [contenteditable='true']")) return;
      const we = O();
      we && (V.preventDefault(), V.stopImmediatePropagation(), M(we));
    };
    return window.addEventListener("keydown", j, !0), () => window.removeEventListener("keydown", j, !0);
  }, [e, O, M]);
  const T = N(/* @__PURE__ */ new Set()), k = ((Be = v.pending) == null ? void 0 : Be.selection) || "";
  $(() => {
    k && T.current.add(k);
  }, [k]);
  const E = v.visible && !P, L = v.setPending, [C, W] = _(null), H = !!v.pending;
  $(() => {
    H || W(null);
  }, [H]);
  const J = N(v.pending);
  J.current = v.pending, $(() => {
    if (!E) return;
    let j = null;
    const V = () => {
      j && clearTimeout(j), j = setTimeout(() => {
        const de = O();
        !de || T.current.has(de.selection) || (J.current ? W(de) : L(de));
      }, 250);
    };
    return document.addEventListener("selectionchange", V), () => {
      j && clearTimeout(j), document.removeEventListener("selectionchange", V);
    };
  }, [E, O, L]);
  const ie = v.addExtra, G = v.extras.length, ce = K(() => {
    if (!C) return null;
    const j = () => {
      T.current.add(C.selection), W(null);
    };
    return {
      label: `第 ${C.page} 页 · ${[...C.selection].length} 字`,
      replace: () => {
        j(), L(C);
      },
      ...G < Xa ? { add: () => {
        j(), ie(C);
      } } : {},
      dismiss: j
    };
  }, [C, G, L, ie]), Te = N(m);
  Te.current = m;
  const Z = A(async ({ page: j, pane: V, region: de, canvas: we }) => {
    const pe = Te.current[V];
    let z;
    if (pe)
      z = await Nf(pe, j, de);
    else {
      const q = we ?? document.querySelector(`[${ke}="${V}"] [${Pe}="${j}"] canvas`);
      if (!q) throw new Error(`第 ${j} 页还没画出来，翻到那一页再试`);
      z = await Af(q, de);
    }
    return new File([z], xf(j, de), { type: "image/png" });
  }, []), [me, Me] = _(null), re = N(v.pending);
  re.current = v.pending;
  const fe = K(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(ei, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const j = re.current, V = (j == null ? void 0 : j.pane) || (h === "translated" ? "translated" : "source");
      return Z({ page: (j == null ? void 0 : j.page) || g() || 1, pane: V, region: hr });
    }
  }], [Z, g, h]), [F, U] = _(!1), [X, le] = _(""), ne = A(async (j) => {
    U(!1), le("");
    try {
      const V = await Z(j), de = R(j.point.target, j.point.x, j.point.y, "");
      Me((we) => ({ id: ((we == null ? void 0 : we.id) || 0) + 1, files: [V] })), de ? M({ ...de, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (V) {
      le(V instanceof Error ? V.message : String(V));
    }
  }, [Z, R, M]), oe = A(() => U(!1), []), Ie = A(() => {
    le(""), U((j) => !j);
  }, []), ae = A(async (j) => {
    if (j.threadId && (e != null && e.threads) && t) {
      try {
        const V = await e.threads.get(t, j.threadId);
        x({ anchor: V.anchor || j.anchor, messages: V.messages || [], mark: j });
      } catch {
        x({ anchor: j.anchor, messages: [], mark: j });
      }
      return;
    }
    x(null), v.openMain();
  }, [e, t, v.openMain]), Q = A((j) => {
    var we;
    if (!e) return [];
    const V = ho(((we = globalThis.getSelection) == null ? void 0 : we.call(globalThis)) ?? null), de = R(j.target, j.clientX, j.clientY, V.element ? V.text : "");
    return de ? [{
      key: "ask",
      label: de.selection ? "问这段" : "在这里提问",
      hint: de.selection ? "?" : void 0,
      onSelect: () => M(de)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        le(""), U(!0);
      }
    }] : [];
  }, [e, R, M]), ge = P ? {
    anchor: P.anchor,
    messages: P.messages,
    onClose: () => x(null),
    onDelete: e != null && e.threads && P.mark.threadId ? () => {
      e.threads.remove(t, P.mark.threadId).catch(() => {
      }), S.removeMark(P.mark.key), x(null);
    } : void 0
  } : null, B = K(() => f ? (j, V) => {
    f(j, V ?? void 0), requestAnimationFrame(() => d(j, "translated"));
  } : null, [f, d]), te = A((j) => La(o, j), [o]), [he, Oe] = _(0), De = A(({ mode: j, width: V }) => {
    Oe(j === "dock" ? Math.round(V) : 0);
  }, []), _e = !v.persistent || !!v.view.conversation || !!v.error, Fe = e && (v.visible && _e || P) ? /* @__PURE__ */ p(Xo, { fallback: null, children: /* @__PURE__ */ p(
    tm,
    {
      port: e,
      jobId: n,
      book: w,
      ask: v,
      legacy: ge,
      onShowSelection: ({ page: j, pane: V }) => l(j, V),
      onJumpToPage: (j) => l(j),
      pageCount: u,
      onLayout: De,
      dockTaken: y !== null,
      dockHost: I,
      onEditBlock: B,
      canEditBlock: te,
      attachTools: fe,
      attachRequest: me,
      contextOffer: ce
    }
  ) }) : null, ze = F || X ? /* @__PURE__ */ D($e, { children: [
    F ? /* @__PURE__ */ p(zf, { onDone: (j) => void ne(j), onCancel: oe }) : null,
    X ? /* @__PURE__ */ D("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => le(""), children: [
      "截图没成：",
      X
    ] }) : null
  ] }) : null, Ae = v.visible && _e || !!P, Ke = v.close, Ce = A(() => {
    if (Ae) {
      x(null), Ke();
      return;
    }
    v.openMain();
  }, [Ae, Ke, v.openMain]);
  return { marks: S.marks, onMark: ae, menuItems: Q, panel: Fe, overlay: ze, cropping: F, toggleCrop: Ie, open: v.openMain, toggle: Ce, showing: Ae, reserveRight: Ae ? he : 0, enabled: !!e };
}
const rm = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function om() {
  const e = en(), t = K(() => {
    try {
      return nt().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = nm({
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
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: f, showing: d, reserveRight: m } = n, g = K(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: ti,
      pressed: d,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: ni,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: h, height: y }) => /* @__PURE__ */ p(Pf, { marks: r, page: h, height: y, onOpen: o }) : void 0,
    shortcuts: rm,
    reserveRight: m,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, m, c, l]);
  return kn(g), /* @__PURE__ */ D($e, { children: [
    s,
    i
  ] });
}
const am = { id: "ask", title: "提问", Component: om };
function qn() {
  try {
    return nt().translationVersions ?? null;
  } catch {
    return null;
  }
}
function sm(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function im(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function cm(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function lm({ documentId: e, jobId: t }) {
  const [n, r] = _([]), [o, a] = _(null);
  $(() => {
    r([]);
    const i = qn();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = im(n, t, o);
  return K(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function um({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = _(null), [s, i] = _(""), [c, l] = _(""), u = N(0);
  $(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = A((g) => {
    const h = qn(), y = n.find((w) => w.versionId === g);
    if (!h || !y || !e) return;
    const I = ++u.current;
    i(g), l(""), (async () => {
      const w = nt(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const S = await w.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), v = w.resolveReaderTranslatedPdfUrl(S.jobPayload, S.manifestPayload);
      if (!v) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: v, regions: sm(Qo(S.regionsPayload)) };
    })().then((w) => {
      I === u.current && a(w);
    }).catch((w) => {
      I === u.current && l((w == null ? void 0 : w.message) || "这一份打不开。");
    }).finally(() => {
      I === u.current && i("");
    });
  }, [e, n]), d = A(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), m = A(async () => {
    var y, I;
    const g = qn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (w) {
      l((w == null ? void 0 : w.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((I = globalThis.history) == null || I.replaceState(globalThis.history.state, "", cm(h, o.jobId))), a(null);
  }, [o, e]);
  return K(() => ({
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
function dm(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: ri,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(Jd, { compare: e, onDone: t })
  } : null;
}
function fm(e) {
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
function mm() {
  var i;
  const e = en(), t = um({
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
  const s = K(() => {
    const c = dm(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: fm(t) };
  }, [t]);
  return kn(s), null;
}
const hm = { id: "compare", title: "对比版本", Component: mm }, Ya = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], yo = { pen: 35e-4, highlighter: 0.018 }, vo = 0.015, Jn = "retainpdf.reader.ink.v1:";
function wo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Jn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function pm(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Jn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Jn + e);
    } catch {
    }
}
function gm(e, t, n, r, o, a) {
  const s = vo * vo;
  return e.filter((i) => Za(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Za(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function bm(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function ym(e) {
  const [t, n] = _(null), [r, o] = _(Ya[0].key), [a, s] = _(() => wo(e)), i = N(a), c = N([]);
  $(() => {
    const h = wo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = A((h) => {
    i.current = h, s(h), pm(e, h);
  }, [e]), u = A((h) => {
    const y = i.current, I = h(y);
    I !== y && (c.current = [...c.current.slice(-49), y], l(I));
  }, [l]), f = A((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = A((h) => {
    h.length && u((y) => y.filter((I) => !h.includes(I.id)));
  }, [u]), m = A((h) => {
    u((y) => y.some((I) => I.page === h) ? y.filter((I) => I.page !== h) : y);
  }, [u]), g = A(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return K(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const vm = [
  { tool: "pen", label: "画笔", Icon: dn },
  { tool: "highlighter", label: "荧光笔", Icon: oi },
  { tool: "eraser", label: "橡皮", Icon: ai }
];
function wm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Sm({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ D($e, { children: [
    vm.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    Ya.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(se, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(si, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      se,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(ii, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ p(At, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function So({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Sm, { ink: e, page: t, onPick: n }) });
}
function Im(e) {
  const t = N(e);
  t.current = e, $(() => {
    const n = (r) => {
      if (wm(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const Tm = "reader-ink-layer";
function km(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Io({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: km(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Em({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = _(null), i = N(!1), c = o.strokes.filter((h) => Za(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(gm(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s([[y, I]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s((w) => w ? bm(w, y, I) : [[y, I]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: yo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ D(
    "svg",
    {
      className: Tm,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(Io, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Io, { stroke: { tool: o.tool, color: o.color, width: yo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const Rm = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function Pm(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: dn,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ D("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
        /* @__PURE__ */ p(dn, { ...Re }),
        /* @__PURE__ */ p("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` } })
      ] }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p(So, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(So, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(Em, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: Rm
  };
}
function Mm() {
  const e = en(), t = ym(e.resetKey);
  Im(t);
  const n = K(() => Pm(t), [t]);
  return kn(n), null;
}
const _m = { id: "ink", title: "画笔", Component: Mm };
function Nm(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
const Am = Yo(() => import("./ReaderMarkdownPanel-ldG-Y79M.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Qa = { id: "markdown", label: "Markdown", short: "MD", Icon: ci, needsJob: !0 };
function xm() {
  const e = en(), t = e.activePanel === Qa.id;
  if (!Nm(t)) return null;
  const r = /* @__PURE__ */ p(Xo, { fallback: null, children: /* @__PURE__ */ p(Am, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? bi(r, e.panelHost) : r;
}
const Lm = {
  id: "markdown",
  title: "Markdown",
  Component: xm,
  panels: [Qa]
}, es = "reader-xref", Gn = "data-xref", Bt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Dm = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Bt})`), Cm = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Xn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function $m(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Om(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function zm(e, t, n) {
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
function Fm(e, t, n) {
  return (e.find((o) => Ue(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Bm(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ue(r), s = Om(r);
    if (a === "formula") {
      for (const g of s.matchAll(Cm)) {
        const h = Xn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Dm.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = $m(i[1]), u = Xn(i[2]), f = zm(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Fm(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const jm = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Bt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Bt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Bt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Bt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Hm(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of jm) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Xn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function Um(e, t) {
  return Hm(e, t).map((n) => ({ start: n.start, end: n.end, className: es, attrs: { [Gn]: n.key } }));
}
const Km = { figure: "图", table: "表", equation: "式" };
function To(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Km[e.kind]} ${e.label}`;
}
const ko = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Wm(e, t, n) {
  const r = Pt(e, t, n), o = r ? gt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Va({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Vm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = Pt(u, t, n), d = f ? gt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Va({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function qm(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function Jm(e, t) {
  const n = (o) => {
    const a = Ue(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Gm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var O;
  const i = t.find((M) => M.itemId === e) ?? null, c = K(() => i ? Jm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = _(rt.indexOf(1)), d = rt[u], m = N(null), [g, h] = _(0);
  Le(() => {
    const M = m.current;
    if (!M) return;
    const T = () => h(M.clientWidth);
    T();
    const k = typeof ResizeObserver == "function" ? new ResizeObserver(T) : null;
    return k == null || k.observe(M), () => k == null ? void 0 : k.disconnect();
  }, []);
  const y = A((M) => {
    const T = c[l + M];
    T && a(T.itemId);
  }, [c, l, a]);
  $(() => {
    const M = (T) => {
      if (T.key === "Escape")
        T.preventDefault(), s();
      else if (T.key === "ArrowLeft")
        T.preventDefault(), y(-1);
      else if (T.key === "ArrowRight")
        T.preventDefault(), y(1);
      else if (T.key === "+" || T.key === "=")
        T.preventDefault(), f((k) => Math.min(rt.length - 1, k + 1));
      else if (T.key === "-" || T.key === "_")
        T.preventDefault(), f((k) => Math.max(0, k - 1));
      else if (T.key === "0")
        T.preventDefault(), f(rt.indexOf(1));
      else
        return;
      T.stopPropagation();
    };
    return window.addEventListener("keydown", M, !0), () => window.removeEventListener("keydown", M, !0);
  }, [s, y]), $(() => {
    const M = m.current;
    if (!M) return;
    const T = (k) => {
      !k.ctrlKey && !k.metaKey || (k.preventDefault(), f((E) => Math.max(0, Math.min(rt.length - 1, E + (k.deltaY < 0 ? 1 : -1)))));
    };
    return M.addEventListener("wheel", T, { passive: !1 }), () => M.removeEventListener("wheel", T);
  }, []);
  const I = N(null);
  if (!i) return null;
  const w = Ue(i), b = o.map((M) => ({ pane: M, pdf: r[M] ?? null, where: Wm(i, n, M) })).filter((M) => !!(M.pdf && M.where)), S = 16, v = typeof window > "u" ? 800 : window.innerHeight, P = Math.min(880, v * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), x = b.length ? qm(Math.max(120, (g - S * (b.length - 1) - 32) / b.length), P, b.map((M) => M.where.aspect)) : 0, R = ((O = b[0]) == null ? void 0 : O.where.page) ?? i.source.page;
  return /* @__PURE__ */ D("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${ko[w] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ D("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ D("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ D("span", { className: "reader-zoom-title", children: [
          ko[w] ?? "这一块",
          " · 第 ",
          R,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ D("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(ea, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(sa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((M) => Math.max(0, M - 1)), children: /* @__PURE__ */ p(ia, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ D(se, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(rt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => f((M) => Math.min(rt.length - 1, M + 1)), children: /* @__PURE__ */ p(ca, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(At, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (M) => {
            const T = m.current;
            !T || M.button !== 0 || (I.current = { x: M.clientX, y: M.clientY, left: T.scrollLeft, top: T.scrollTop }, T.setPointerCapture(M.pointerId));
          },
          onPointerMove: (M) => {
            const T = m.current, k = I.current;
            !T || !k || (T.scrollLeft = k.left - (M.clientX - k.x), T.scrollTop = k.top - (M.clientY - k.y));
          },
          onPointerUp: () => {
            I.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: S }, children: b.map(({ pane: M, pdf: T, where: k }) => /* @__PURE__ */ D("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: M === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Ja,
              {
                className: "reader-zoom-canvas",
                pdf: T,
                page: k.page,
                region: k.fraction,
                cssWidth: x * d,
                label: `${M === "source" ? "原文" : "译文"}第 ${k.page} 页`
              }
            )
          ] }, M)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Xm = 380, Ym = 320, vt = 8;
function Zm(e, t, n) {
  const r = Math.max(vt, Math.min(e.left, n.width - t.width - vt)), o = e.bottom + vt, a = o + t.height <= n.height - vt ? o : Math.max(vt, e.top - vt - t.height);
  return { left: r, top: a };
}
function Qm({
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
    const m = r[d], g = m ? Vm(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Xm, Ym / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = Zm(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ D("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ D("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: To(e.target) }),
      /* @__PURE__ */ D("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Ja, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: To(e.target) })
  ] });
}
const eh = 250;
function th(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function nh(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function rh(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function oh({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = _(null), [s, i] = _({ back: [], forward: [] }), c = N(s);
  c.current = s;
  const l = N(null), u = N({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = A(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Ht(m, g);
  }, []);
  $(() => {
    if (!e) return;
    const m = (b) => {
      var S, v;
      return (v = (S = b.target) == null ? void 0 : S.closest) == null ? void 0 : v.call(S, `.${es}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var x;
      const S = m(b);
      if (!S) return;
      const v = u.current.index.get(S.getAttribute(Gn) || "");
      if (!v) return;
      const P = ((x = S.closest("[data-reader-pane]")) == null ? void 0 : x.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const R = S.getBoundingClientRect();
        a({ target: v, pane: P, anchor: { left: R.left, top: R.top, right: R.right, bottom: R.bottom } });
      }, eh);
    }, y = (b) => {
      const S = m(b);
      !S || S.contains(b.relatedTarget) || (g(), a(null));
    }, I = (b) => {
      var R, O;
      const S = m(b);
      if (!S || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((R = window.getSelection) == null ? void 0 : R.call(window)) || ""}`.trim()) return;
      const v = u.current.index.get(S.getAttribute(Gn) || "");
      if (!v) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const P = ((O = S.closest("[data-reader-pane]")) == null ? void 0 : O.getAttribute("data-reader-pane")) || u.current.primaryPane, x = f();
      x && i((M) => th(M, x)), u.current.follow(v, P);
    }, w = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", I, !0), e.addEventListener("scroll", w, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", I, !0), e.removeEventListener("scroll", w);
    };
  }, [e, f]);
  const d = A((m) => {
    const g = f();
    if (!g) return !1;
    const h = nh(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: I } = u.current;
    return Mt(y, h.to, "auto", I) ? (i(h.history), !0) : !1;
  }, [f]);
  return $(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || rh(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [d]), {
    preview: o,
    closePreview: A(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: A(() => d("back"), [d])
  };
}
const ah = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function sh() {
  const e = en(), t = K(() => Bm(e.regions), [e.regions]), { jumpToBlock: n } = e, r = A((s, i) => n(s.itemId, i), [n]), o = oh({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = K(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => Um(s, t) : void 0,
    shortcuts: ah
  }), [t]);
  return kn(a), /* @__PURE__ */ D($e, { children: [
    o.preview ? /* @__PURE__ */ p(Qm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ D(se, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(li, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const ih = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: sh }, pr = [_m, Lm, hm, ih, am];
function gr(e = pr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function ch(e) {
  const t = Ge(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p($e, { children: (e.tabs ?? gr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
function lh(e) {
  const t = Ge(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = gr().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
    key: c,
    label: l,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ D("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: d, badge: m, onClick: g }) => /* @__PURE__ */ D(
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
        children: /* @__PURE__ */ p(At, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function uh(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function dh(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function fh(e) {
  return e / 100 * window.innerHeight;
}
function mh(e) {
  return e / 100 * window.innerWidth;
}
function hh(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function jt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = hh(n);
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
      r = dh(t, o);
      break;
    }
    case "em": {
      r = uh(t, o);
      break;
    }
    case "vh": {
      r = fh(o);
      break;
    }
    case "vw": {
      r = mh(o);
      break;
    }
  }
  return r;
}
function xe(e) {
  return parseFloat(e.toFixed(3));
}
function _t({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Yn(e) {
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
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = xe(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = xe(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = xe(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = xe(u / n * 100);
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
function Zn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? ph : gh
  );
}
function ph(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function gh(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function ts(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function ns(e, t) {
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
function bh({
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
    const { x: i, y: c } = ns(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return be(o, "No rect found"), o;
}
let sn;
function yh() {
  return sn === void 0 && (typeof matchMedia == "function" ? sn = !!matchMedia("(pointer:coarse)").matches : sn = !1), sn;
}
function rs(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Zn(
    n,
    Array.from(t.children).filter(ts).map((g) => ({ element: g }))
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
            const I = d.element.getBoundingClientRect(), w = h.getBoundingClientRect();
            let b;
            if (c) {
              const S = n === "horizontal" ? new DOMRect(
                I.right,
                I.top,
                0,
                I.height
              ) : new DOMRect(
                I.left,
                I.bottom,
                I.width,
                0
              ), v = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (m.length) {
                case 0: {
                  b = [
                    S,
                    v
                  ];
                  break;
                }
                case 1: {
                  const P = m[0], x = bh({
                    orientation: n,
                    rects: [I, w],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  b = [
                    P,
                    x === I ? v : S
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
                  w.top,
                  w.left - I.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  I.bottom,
                  w.width,
                  w.top - I.bottom
                )
              ];
            for (const S of b) {
              let v = "width" in S ? S : S.element.getBoundingClientRect();
              const P = yh() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (v.width < P) {
                const R = P - v.width;
                v = new DOMRect(
                  v.x - R / 2,
                  v.y,
                  v.width + R,
                  v.height
                );
              }
              if (v.height < P) {
                const R = P - v.height;
                v = new DOMRect(
                  v.x,
                  v.y - R / 2,
                  v.width,
                  v.height + R
                );
              }
              const x = g <= l || g > u;
              !i && !x && s.push({
                group: e,
                groupSize: _t({ group: e }),
                panels: [d, y],
                separator: "width" in S ? void 0 : S,
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
var at;
class os {
  constructor() {
    Dr(this, at, {});
  }
  addListener(t, n) {
    const r = xt(this, at)[t];
    return r === void 0 ? xt(this, at)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = xt(this, at)[t];
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
    Cr(this, at, {});
  }
  removeListener(t, n) {
    const r = xt(this, at)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
at = new WeakMap();
let Et = {
  cursorFlags: 0,
  state: "inactive"
};
const br = new os();
function mt() {
  return Et;
}
function vh(e) {
  return br.addListener("change", e);
}
function wh(e) {
  const t = Et, n = { ...Et };
  n.cursorFlags = e, Et = n, br.emit("change", {
    prev: t,
    next: n
  });
}
function Rt(e) {
  const t = Et;
  Et = e, br.emit("change", {
    prev: t,
    next: e
  });
}
const Sh = (e) => e, Cn = () => {
}, as = 1, ss = 2, is = 4, cs = 8, Eo = 3, Ro = 12;
let cn;
function Po() {
  return cn === void 0 && (cn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (cn = !0)), cn;
}
function Ih({
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
        if (e && Po()) {
          const a = (e & as) !== 0, s = (e & ss) !== 0, i = (e & is) !== 0, c = (e & cs) !== 0;
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
    return Po() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Mo = /* @__PURE__ */ new WeakMap();
function yr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Mo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = mt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Ih({
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
  Mo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let qe = /* @__PURE__ */ new Map();
const ls = new os();
function Th(e) {
  qe = new Map(qe), qe.delete(e);
}
function _o(e, t) {
  for (const [n] of qe)
    if (n.id === e)
      return n;
}
function it(e, t) {
  for (const [n, r] of qe)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function bt() {
  return qe;
}
function vr(e, t) {
  return ls.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function tt(e, t, n) {
  const r = qe.get(e);
  qe = new Map(qe), qe.set(e, t), ls.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function us(e) {
  const t = mt();
  let n = !1;
  switch (t.state) {
    case "active":
      Rt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (yr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = it(r.group.id, !0);
        tt(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function No(e) {
  e.defaultPrevented || us(e.currentTarget);
}
function kh(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = ns(n, a.rect);
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
function Eh(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Rh(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Lo(e),
    b: Lo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  be(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: xo(Ao(n.a)),
    b: xo(Ao(n.b))
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
const Ph = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Mh(e) {
  const t = getComputedStyle(ds(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function _h(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Mh(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Ph.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Ao(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (be(n, "Missing node"), _h(n)) return n;
  }
  return null;
}
function xo(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Lo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ds(e);
  return t;
}
function ds(e) {
  const { parentNode: t } = e;
  return Eh(t) ? t.host : t;
}
function Nh(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Ah({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!ts(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Rh(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Nh(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function wr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = rs(o), s = kh(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Ah({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function xh(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Ne(e, t, n = 0) {
  return Math.abs(xe(e) - xe(t)) <= n;
}
function Ve(e, t) {
  return Ne(e, t) ? 0 : e > t ? 1 : -1;
}
function Tt({
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
  if (Ve(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Ve(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = xe(r), r;
}
function Jt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Ne(e, 0))
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
          collapsedSize: I = 0,
          collapsible: w,
          minSize: b = 0
        } = y;
        if (w) {
          const S = i[h];
          if (be(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), Ne(S, I)) {
            const v = b - S;
            Ve(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
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
          collapsedSize: I = 0,
          collapsible: w,
          minSize: b = 0
        } = y;
        if (w) {
          const S = i[h];
          if (be(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), Ne(S, b)) {
            const v = S - I;
            Ve(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
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
      const I = i[h], { collapsible: w, collapsedSize: b, minSize: S } = y;
      if (w && Ve(I, S) < 0)
        if (e > 0) {
          const v = S - b, P = v / 2, x = I + e;
          Ve(x, S) < 0 && (e = Ve(e, P) <= 0 ? 0 : v);
        } else {
          const v = S - b, P = 100 - v / 2, x = I - e;
          Ve(x, S) < 0 && (e = Ve(100 + e, P) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, I = 0;
    for (; ; ) {
      const b = i[y];
      be(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const S = Tt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (I += S, y += h, y < 0 || y >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(I));
    e = e < 0 ? 0 - w : w;
  }
  {
    let h = e < 0 ? u : f;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), I = i[h];
      be(
        I != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = I - y, b = Tt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: I,
        size: w
      });
      if (!Ne(I, b) && (d += I - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (xh(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    be(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const I = y + d, w = Tt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: I
    });
    if (l[h] = w, !Ne(w, I)) {
      let b = I - w, S = e < 0 ? f : u;
      for (; S >= 0 && S < n.length; ) {
        const v = l[S];
        be(
          v != null,
          `Previous layout not found for panel index ${S}`
        );
        const P = v + b, x = Tt({
          overrideDisabledPanels: s,
          panelConstraints: n[S],
          prevSize: v,
          size: P
        });
        if (Ne(v, x) || (b -= x - v, l[S] = x), Ne(b, 0))
          break;
        e > 0 ? S-- : S++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!Ne(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, I) => (h[g[I]] = y, h), {});
}
function ht(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ve(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function pt({
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
  if (!Ne(o, 100) && r.length > 0)
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
    const u = Tt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!Ne(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      be(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = Tt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Ne(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function fs({
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
      const w = f[I];
      return (w == null ? void 0 : w.collapsible) && Ne(w.collapsedSize, u[w.panelId]);
    }))) {
      const y = l.slice(0, m).reduce((I, w) => I + u[w.id], 0);
      return {
        ...u,
        [t]: xe(100 - y)
      };
    }
    return Jt({
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
    }), I = pt({
      layout: y,
      panelConstraints: f
    });
    ht(g, I) || tt(d, {
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
      return c && Ne(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = _t({ group: l }), d = jt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = xe(d / f * 100);
      i(m);
    }
  };
}
function Do(e) {
  if (e.defaultPrevented)
    return;
  const t = bt();
  wr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = fs({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function ln(e) {
  const t = bt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function ms({
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
      } = t(), l = pt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (ht(i, l) || tt(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function lt(e, t) {
  const n = ln(e), r = it(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  be(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  be(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = ms({ groupId: n.id }).getLayout(), c = Jt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = pt({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  ht(i, l) || tt(
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
function Co(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = ln(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && lt(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && lt(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && lt(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && lt(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), lt(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = ln(t), o = it(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
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
          lt(t, m - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = ln(t).separators.map(
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
        e.preventDefault(), lt(t, -100);
        break;
      }
    }
}
function $o(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = bt(), n = wr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Rt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function hs({
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
      defaultLayoutDeferred: w,
      derivedPanelConstraints: b,
      groupSize: S,
      layout: v,
      separatorToPanels: P
    } = I;
    if (b && v && P) {
      const x = Jt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((R) => m.indexOf(R)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (ht(x, v)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? as : ss;
              break;
            }
            case "vertical": {
              i |= h < 0 ? is : cs;
              break;
            }
          }
      } else
        tt(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: b,
          groupSize: S,
          layout: x,
          separatorToPanels: P
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & Eo : c |= i & Eo, t.movementY === 0 ? c |= s & Ro : c |= i & Ro, wh(c), yr(e);
}
function Oo(e) {
  const t = bt(), n = mt();
  switch (n.state) {
    case "active":
      hs({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function zo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = mt(), n = bt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Rt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = it(a.group.id, !0);
          tt(a.group, s, {
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
      hs({
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
      const a = wr(e, n);
      a.length === 0 ? t.state !== "inactive" && Rt({
        cursorFlags: 0,
        state: "inactive"
      }) : Rt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), yr(e.currentTarget);
      break;
    }
  }
}
function Fo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (mt().state) {
      case "hover":
        Rt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Bo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || us(e.currentTarget) && e.preventDefault();
}
function jo(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = xe(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = xe((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Lh(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = _t({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: xe(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Dh(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Ch({
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
        const m = d / 100 * n, g = xe(
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
      u[f] = xe(
        d / a * l
      );
    }
  else {
    const f = xe(
      l / c.length
    );
    for (const d of c)
      u[d] = f;
  }
  return u;
}
function $h(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const wt = /* @__PURE__ */ new Map();
function Oh(e) {
  let t = !0;
  be(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: I } = h;
      if (I === e.element) {
        if (t) {
          const w = _t({ group: e });
          if (w === 0)
            return;
          const b = it(e.id);
          if (!b)
            return;
          const S = Yn(e), v = b.defaultLayoutDeferred ? jo(S) : b.layout, P = Ch({
            group: e,
            nextGroupSize: w,
            prevGroupSize: b.groupSize,
            prevLayout: v
          }), x = pt({
            layout: P,
            panelConstraints: S
          });
          if (!b.defaultLayoutDeferred && ht(b.layout, x) && Dh(
            b.derivedPanelConstraints,
            S
          ) && b.groupSize === w)
            return;
          tt(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: S,
            groupSize: w,
            layout: x,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        Lh(e, I, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    be(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = _t({ group: e }), i = Yn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && ($h(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? jo(i), f = pt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  wt.set(
    d,
    (wt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return rs(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), tt(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    be(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Co);
  }), wt.get(d) === 1 && (d.addEventListener("contextmenu", No, !0), d.addEventListener("dblclick", Do, !0), d.addEventListener("pointerdown", $o, !0), d.addEventListener("pointerleave", Oo), d.addEventListener("pointermove", zo), d.addEventListener("pointerout", Fo), d.addEventListener("pointerup", Bo, !0)), function() {
    t = !1, wt.set(
      d,
      Math.max(0, (wt.get(d) ?? 0) - 1)
    ), Th(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Co);
    }), wt.get(d) || (d.removeEventListener(
      "contextmenu",
      No,
      !0
    ), d.removeEventListener(
      "dblclick",
      Do,
      !0
    ), d.removeEventListener(
      "pointerdown",
      $o,
      !0
    ), d.removeEventListener("pointerleave", Oo), d.removeEventListener("pointermove", zo), d.removeEventListener("pointerout", Fo), d.removeEventListener("pointerup", Bo, !0)), a.disconnect();
  };
}
function zh() {
  const [e, t] = _({}), n = A(() => t({}), []);
  return [e, n];
}
function Sr(e) {
  const t = Zo();
  return `${e ?? t}`;
}
const yt = typeof window < "u" ? Le : $;
function Ut(e) {
  const t = N(e);
  return yt(() => {
    t.current = e;
  }, [e]), A(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Ir(...e) {
  return Ut((t) => {
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
function Tr(e) {
  const t = N({ ...e });
  return yt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ps = Zt(null);
function Fh(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: Sh
  });
  or(t, () => n.current, []), yt(() => {
    Object.assign(
      n.current,
      ms({ groupId: e })
    );
  });
}
function gs({
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
  }), h = Ut((T) => {
    ht(g.current.onLayoutChange, T) || (g.current.onLayoutChange = T, c == null || c(T));
  }), y = Ut(
    (T, k) => {
      ht(g.current.onLayoutChanged, T) || (g.current.onLayoutChanged = T, l == null || l(T, { isUserInteraction: k }));
    }
  ), I = Sr(i), w = N(null), [b, S] = zh(), v = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), P = Ir(w, a);
  Fh(I, s);
  const x = Ut(
    (T, k) => {
      const E = mt(), L = _o(T), C = it(T);
      if (C) {
        let W = !1;
        switch (E.state) {
          case "active": {
            W = E.hitRegions.some(
              (H) => H.group === L
            );
            break;
          }
        }
        return {
          flexGrow: C.layout[k] ?? 1,
          pointerEvents: W ? "none" : void 0
        };
      }
      if (n != null && n[k])
        return {
          flexGrow: n == null ? void 0 : n[k]
        };
    }
  ), R = Tr({
    defaultLayout: n,
    disableCursor: r
  }), O = K(
    () => ({
      get disableCursor() {
        return !!R.disableCursor;
      },
      getPanelStyles: x,
      id: I,
      orientation: u,
      registerPanel: (T) => {
        const k = v.current;
        return k.panels = Zn(u, [
          ...k.panels,
          T
        ]), S(), () => {
          k.panels = k.panels.filter(
            (E) => E !== T
          ), S();
        };
      },
      registerSeparator: (T) => {
        const k = v.current;
        return k.separators = Zn(u, [
          ...k.separators,
          T
        ]), S(), () => {
          k.separators = k.separators.filter(
            (E) => E !== T
          ), S();
        };
      },
      updatePanelProps: (T, { disabled: k }) => {
        const E = v.current.panels.find(
          (W) => W.id === T
        );
        E && (E.panelConstraints.disabled = k);
        const L = _o(I), C = it(I);
        L && C && tt(L, {
          ...C,
          derivedPanelConstraints: Yn(L)
        });
      },
      updateSeparatorProps: (T, {
        disabled: k,
        disableDoubleClick: E
      }) => {
        const L = v.current.separators.find(
          (C) => C.id === T
        );
        L && (L.disabled = k, L.disableDoubleClick = E);
      }
    }),
    [x, I, S, u, R]
  ), M = N(null);
  return yt(() => {
    const T = w.current;
    if (T === null)
      return;
    const k = v.current;
    let E;
    if (R.defaultLayout !== void 0 && Object.keys(R.defaultLayout).length === k.panels.length) {
      E = {};
      for (const G of k.panels) {
        const ce = R.defaultLayout[G.id];
        ce !== void 0 && (E[G.id] = ce);
      }
    }
    const L = {
      disabled: !!o,
      element: T,
      id: I,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!R.disableCursor,
        expandedPanelSizes: v.current.lastExpandedPanelSizes,
        layouts: v.current.layouts
      },
      orientation: u,
      panels: k.panels,
      resizeTargetMinimumSize: k.resizeTargetMinimumSize,
      separators: k.separators
    };
    M.current = L;
    const C = Oh(L), { defaultLayoutDeferred: W, derivedPanelConstraints: H, layout: J } = it(L.id, !0);
    !W && H.length > 0 && (h(J), y(J, !1));
    const ie = vr(I, (G) => {
      const { defaultLayoutDeferred: ce, derivedPanelConstraints: Te, layout: Z } = G.next;
      if (ce || Te.length === 0)
        return;
      const me = L.panels.map(({ id: re }) => re).join(",");
      L.mutableState.layouts[me] = Z, Te.forEach((re) => {
        if (re.collapsible) {
          const { layout: fe } = G.prev ?? {};
          if (fe) {
            const F = Ne(
              re.collapsedSize,
              Z[re.panelId]
            ), U = Ne(
              re.collapsedSize,
              fe[re.panelId]
            );
            F && !U && (L.mutableState.expandedPanelSizes[re.panelId] = fe[re.panelId]);
          }
        }
      });
      const Me = mt().state !== "active";
      h(Z), Me && y(Z, G.isUserInteraction);
    });
    return () => {
      M.current = null, C(), ie();
    };
  }, [
    o,
    I,
    y,
    h,
    u,
    b,
    R
  ]), $(() => {
    const T = M.current;
    T && (T.mutableState.defaultLayout = n, T.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ps.Provider, { value: O, children: /* @__PURE__ */ p(
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
gs.displayName = "Group";
function kr() {
  const e = dt(ps);
  return be(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Bh(e, t) {
  const { id: n } = kr(), r = N({
    collapse: Cn,
    expand: Cn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Cn
  });
  or(t, () => r.current, []), yt(() => {
    Object.assign(
      r.current,
      fs({ groupId: n, panelId: e })
    );
  });
}
function Qn({
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
  const h = !!c, y = Sr(c), I = Tr({
    disabled: a
  }), w = N(null), b = Ir(w, s), {
    getPanelStyles: S,
    id: v,
    orientation: P,
    registerPanel: x,
    updatePanelProps: R
  } = kr(), O = f !== null, M = Ut(
    (L, C, W) => {
      f == null || f(L, c, W);
    }
  );
  yt(() => {
    const L = w.current;
    if (L !== null) {
      const C = {
        element: L,
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
          disabled: I.disabled,
          maxSize: l,
          minSize: u
        }
      };
      return x(C);
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
    x,
    I
  ]), $(() => {
    R(y, { disabled: a });
  }, [a, y, R]), Bh(y, d);
  const T = () => {
    const L = S(v, y);
    if (L)
      return JSON.stringify(L);
  }, k = wn(
    (L) => vr(v, L),
    T,
    T
  );
  let E;
  return k ? E = JSON.parse(k) : o !== void 0 ? E = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : E = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...jh,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...E
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
Qn.displayName = "Panel";
const jh = {
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
function Hh({
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
    a = pt({
      layout: Jt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = pt({
      layout: Jt({
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
function bs({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = Sr(a), l = Tr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = _({}), [d, m] = _("inactive"), [g, h] = _(!1), y = N(null), I = Ir(y, o), {
    disableCursor: w,
    id: b,
    orientation: S,
    registerSeparator: v,
    updateSeparatorProps: P
  } = kr(), x = S === "horizontal" ? "vertical" : "horizontal";
  yt(() => {
    const M = y.current;
    if (M !== null) {
      const T = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: M,
        id: c
      }, k = v(T), E = vh(
        (C) => {
          m(
            C.next.state !== "inactive" && C.next.hitRegions.some(
              (W) => W.separator === T
            ) ? C.next.state : "inactive"
          );
        }
      ), L = vr(
        b,
        (C) => {
          const { derivedPanelConstraints: W, layout: H, separatorToPanels: J } = C.next, ie = J.get(T);
          if (ie) {
            const G = ie[0], ce = ie.indexOf(G);
            f(
              Hh({
                layout: H,
                panelConstraints: W,
                panelId: G.id,
                panelIndex: ce
              })
            );
          }
        }
      );
      return () => {
        E(), L(), k();
      };
    }
  }, [b, c, v, l]), $(() => {
    P(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, P]);
  let R;
  n && !w && (R = "not-allowed");
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
      "aria-orientation": x,
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
      ref: I,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: R,
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
bs.displayName = "Separator";
const Er = 30, Rr = 65, Gt = 50, Uh = 100 - Rr, Kh = 100 - Er;
function Wh(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Rr, Math.max(Er, t)) : Gt;
}
function Pr(e) {
  return 100 - e;
}
function St(e) {
  return `${e}%`;
}
const Mr = "reader-document", Xt = "reader-assistant", ys = "retainpdf.reader.ai-split-layout.v1", Vh = {
  [Mr]: Pr(Gt),
  [Xt]: Gt
};
function _r(e) {
  const t = Wh(e == null ? void 0 : e[Xt]);
  return {
    [Mr]: Pr(t),
    [Xt]: t
  };
}
function qh() {
  try {
    const e = JSON.parse(localStorage.getItem(ys) || "null");
    return _r(e);
  } catch {
    return Vh;
  }
}
function Jh(e) {
  try {
    localStorage.setItem(ys, JSON.stringify(_r(e)));
  } catch {
  }
}
function $n(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = _r(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Xt]}vw`
  );
}
function Gh() {
  const e = N(null), [t] = _(qh);
  Le(() => {
    const o = e.current;
    return $n(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = A((o) => {
    $n(e.current, o);
  }, []), r = A((o, a) => {
    $n(e.current, o), a.isUserInteraction && Jh(o);
  }, []);
  return /* @__PURE__ */ D(
    gs,
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
          Qn,
          {
            id: Mr,
            defaultSize: St(Pr(Gt)),
            minSize: St(Uh),
            maxSize: St(Kh)
          }
        ),
        /* @__PURE__ */ p(
          bs,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Qn,
          {
            id: Xt,
            defaultSize: St(Gt),
            minSize: St(Er),
            maxSize: St(Rr)
          }
        )
      ]
    }
  );
}
function Xh({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = _(!1);
  if ($(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ D("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ D("span", { className: "reader-error-notice-text", children: [
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
function Yh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Xh, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ D($e, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ D("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ D("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(se, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Zh(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Qh() {
  const [e, t] = _(!1), n = Zo(), r = N(null), o = Wa(), a = K(() => [...jl, ...wf(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Zh(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ D("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ p(ui, { ...Re, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ D(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ D("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ D("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: s.title }),
            /* @__PURE__ */ p("ul", { children: s.items.map((i) => /* @__PURE__ */ D("li", { children: [
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
const ep = ["source", "sideBySide", "translated"], tp = { source: "", translated: "", sideBySide: "" };
function np(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = un(e.sourceUrl), n = un(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return xi({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function rp(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = K(
    () => e ? np(e) : tp,
    [e]
  ), o = K(
    () => ep.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = A(async (s) => {
    if (!e) return;
    const i = un(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Ai(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Li(
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
        Di(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const op = {
  source: ra,
  sideBySide: oa,
  translated: aa
}, ap = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function sp(e) {
  const t = Ge(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = rp(n), i = N(null);
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
  }, []), /* @__PURE__ */ D("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ D("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(di, { ...Re, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = xs[c], u = un(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : Ls(c, r), g = op[c];
      return /* @__PURE__ */ D(
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
            /* @__PURE__ */ D("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ D("span", { className: "reader-download-action-label", children: [
                ap[c],
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
const ip = "retainpdf:reader:bookmarks:v1:", cp = 200;
function Nr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function vs(e) {
  const t = `${e || ""}`.trim();
  return t ? `${ip}${t}` : "";
}
function lp(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Kt(e, t = Nr()) {
  const n = vs(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = lp(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const er = /* @__PURE__ */ new Set();
function up(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return er.add(n), () => {
    er.delete(n);
  };
}
function tr(e, t, n) {
  const r = vs(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, cp);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...er]) a(e);
  return o;
}
function dp(e, t, n = "", { storage: r = Nr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Kt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? tr(e, a.filter((i) => i.page !== s), r) : tr(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function fp(e, t, n = Nr()) {
  return tr(e, Kt(e, n).filter((r) => r.page !== t), n);
}
function mp(e, t) {
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
function ws(e, t) {
  const [n, r] = _(() => Kt(e));
  $(() => (r(Kt(e)), up(e, () => r(Kt(e)))), [e]);
  const o = A((s) => {
    r(dp(e, s, mp(t, s)));
  }, [e, t]), a = A((s) => r(fp(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
function hp({ filled: e }) {
  return /* @__PURE__ */ p(fi, { ...Re, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function pp({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = ws(e, r);
  if (!e || n <= 0) return null;
  const s = Math.min(Math.max(t, 1), n), i = o.some((c) => c.page === s);
  return /* @__PURE__ */ D("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-mark${i ? " is-marked" : ""}`,
        "aria-pressed": i,
        "aria-label": i ? `取消第 ${s} 页的书签` : `给第 ${s} 页加书签`,
        title: i ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）",
        onClick: () => a(s),
        children: /* @__PURE__ */ p(hp, { filled: i })
      }
    ),
    /* @__PURE__ */ p(gp, {})
  ] });
}
function gp() {
  const [e, t] = _(!1), n = N(null);
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
  }, [e]), /* @__PURE__ */ D("span", { className: "reader-favorites", ref: n, children: [
    /* @__PURE__ */ p(
      se,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": e,
        "aria-haspopup": "dialog",
        "aria-label": "收藏",
        title: "收藏（还在做）",
        onClick: () => t((r) => !r),
        children: /* @__PURE__ */ p(mi, { ...Re, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ D("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ p("strong", { children: "收藏" }),
      /* @__PURE__ */ p("p", { children: "还在做：以后可以把喜欢的段落、整页收在这里，按书分好，随时翻回来。现在先用「书签」记页。" })
    ] }) : null
  ] });
}
function bp(e) {
  const t = Ge(), n = fr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Qt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Sc(a), f = a > ga + 1e-3, d = a < bn - 1e-3, m = It(r, kt()), g = m >= bn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, y] = _(!1), [I, w] = _(`${i}`);
  $(() => {
    h || w(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const S = Number(`${I}`.trim());
    l(yn(S, c));
  };
  return /* @__PURE__ */ D("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ D("div", { className: "reader-bottombar-start", children: [
      e.startSlot,
      e.bookmarkScope ? /* @__PURE__ */ p(
        pp,
        {
          scope: e.bookmarkScope,
          currentPage: i,
          numPages: c,
          regions: t == null ? void 0 : t.regions
        }
      ) : null,
      e.leftSlot
    ] }),
    /* @__PURE__ */ D("div", { className: "reader-bottombar-center", children: [
      o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ D(
        "form",
        {
          className: "reader-react-hud-page-form",
          onSubmit: (S) => {
            S.preventDefault(), b();
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
                onChange: (S) => w(S.target.value.replace(/[^\d]/g, "")),
                onBlur: b,
                onKeyDown: (S) => {
                  S.key === "Escape" && (S.preventDefault(), y(!1), w(`${i}`));
                }
              }
            ),
            /* @__PURE__ */ D("span", { className: "reader-react-hud-page-suffix", children: [
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
          children: /* @__PURE__ */ p(hi, { ...Re, "aria-hidden": !0 })
        }
      ) }) : null,
      /* @__PURE__ */ D("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
        /* @__PURE__ */ p(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "缩小",
            disabled: !f,
            onClick: () => s(qt(a, -1)),
            children: /* @__PURE__ */ p(ia, { ...Re, "aria-hidden": !0 })
          }
        ),
        /* @__PURE__ */ D(
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
            onClick: () => s(qt(a, 1)),
            children: /* @__PURE__ */ p(ca, { ...Re, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ D("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Qh, {}) })
    ] })
  ] });
}
function Ho(e) {
  var t, n;
  return Sa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function yp(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: Ho(Je(e))
  }));
  $(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Ho(Je(e))
    });
  }, [e]), $(() => {
    t.scope === e && In(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = A((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const nr = "download-toast";
function vp({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ D("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ D("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function wp(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    zn.dismiss(nr);
    return;
  }
  zn.custom(
    () => /* @__PURE__ */ p(vp, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: nr, duration: 1 / 0 }
  );
}
function Sp() {
  const e = A((t) => {
    t && (t.setState = wp, t.hide = () => zn.dismiss(nr));
  }, []);
  return /* @__PURE__ */ D($e, { children: [
    /* @__PURE__ */ p(Ks, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Uo = { itemId: null, origin: null };
function Ip() {
  let e = Uo;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Uo : { itemId: n, origin: r };
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
const Ko = ["ask"];
function Tp(e) {
  const t = (n) => {
    const r = Ko.indexOf(n.id);
    return r < 0 ? Ko.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function rr({
  place: e,
  active: t = null,
  extensions: n = pr
}) {
  const r = e === "side" ? Tp(n) : n, [o, a] = _(null), s = Wa(), i = (d) => {
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
    const m = i(d.id), g = e === "side" ? gr([d]) : [];
    return !m.length && !g.length ? null : /* @__PURE__ */ D(vn, { children: [
      m.map((h) => {
        const y = `${d.id}:${h.key}`, I = h.Icon;
        return /* @__PURE__ */ D("span", { className: "reader-bar-tool-group", "data-has-dropdown": h.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ p(
            se,
            {
              className: e === "compare" ? "reader-bar-tool reader-bar-tool-compare" : "reader-bar-tool",
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
              children: e === "compare" ? /* @__PURE__ */ p(fn, { ...Xr, "aria-hidden": !0 }) : h.mark ?? /* @__PURE__ */ p(I, { ...Re, "aria-hidden": !0 })
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
              children: /* @__PURE__ */ p(fn, { ...Xr, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(ch, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ D("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "side" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const Wo = { search: "搜索", bookmarks: "书签", issues: "待改" }, kp = [];
function Ep({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ D("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ D(se, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(la, { ...Re, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function Rp({
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
  var x;
  const d = ((x = Ge()) == null ? void 0 : x.regions) ?? kp, m = K(() => gu(d, s), [d, s]), [g, h] = _(-1);
  $(() => h(-1), [s]);
  const y = N(null), I = N(null), w = N(n);
  w.current = n, $(() => {
    if (c) return;
    const R = (M) => {
      var k, E;
      const T = M.target;
      !T || (k = I.current) != null && k.contains(T) || (E = T.closest) != null && E.call(T, ".reader-finder-toggles, [data-finder-toggle]") || w.current();
    }, O = (M) => {
      M.key === "Escape" && w.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", O), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", O);
    };
  }, [c]);
  const b = N(null);
  $(() => {
    var R;
    e === "search" && ((R = y.current) == null || R.focus());
  }, [e, i]), $(() => {
    var R, O, M;
    e === "search" && g >= 0 && ((M = (O = (R = b.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null ? void 0 : O.scrollIntoView) == null || M.call(O, { block: "nearest" }));
  }, [e, g]);
  const S = (R) => {
    const O = m[R];
    O && (h(R), r(O.itemId));
  }, v = ["search", ...l ? ["bookmarks"] : [], ...u ? ["issues"] : []], P = v.includes(e) ? e : "search";
  return /* @__PURE__ */ D("aside", { ref: I, className: "reader-finder", "data-finder-tab": P, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${Wo[P]}`, children: [
    /* @__PURE__ */ D("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: v.map((R) => /* @__PURE__ */ D(se, { className: "reader-finder-tab", role: "tab", "aria-selected": P === R, onClick: () => t(R), children: [
        Wo[R],
        R === "issues" && f ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, R)) }),
      /* @__PURE__ */ p(se, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(At, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    P === "bookmarks" ? l : P === "issues" ? u : null,
    P !== "search" ? null : /* @__PURE__ */ D($e, { children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          ar,
          {
            ref: y,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "搜原文或译文（⌘F）",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (R) => a(R.target.value),
            onKeyDown: (R) => {
              R.key === "Enter" ? (R.preventDefault(), S(bu(g, m.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), c ? R.currentTarget.blur() : n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: m.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${m.length >= 200 ? "200+ 处，只列前 200 处" : `${m.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { ref: b, className: "reader-finder-list", children: m.map((R, O) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(se, { className: "reader-finder-entry is-hit", "aria-current": O === g ? "true" : void 0, onClick: () => S(O), children: [
        /* @__PURE__ */ D("span", { className: "reader-finder-entry-text", children: [
          R.snippet.slice(0, R.at),
          /* @__PURE__ */ p("mark", { children: R.snippet.slice(R.at, R.at + R.length) }),
          R.snippet.slice(R.at + R.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
      ] }) }, R.itemId)) })
    ] })
  ] });
}
function Ss(e, t = []) {
  for (const n of e)
    t.push(n), Ss(n.children, t);
  return t;
}
const Pp = 24, Ot = 28, Vo = 15;
function Is(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function Mp(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: Ss(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function _p(e, t) {
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
function Np(e, t) {
  const n = Is(e) > Pp, r = Math.max(1, Math.ceil(e.length / Ot)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= Ot) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(Ot / 2)), o.length - Ot);
  return o.slice(s, s + Ot);
}
function Ap(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const xp = [];
function qo({ bookmarks: e, onJumpPage: t, onJumpBlock: n, pinned: r = !1, docked: o = !1, onPinChange: a }) {
  var M, T;
  const s = ((M = Ge()) == null ? void 0 : M.regions) ?? xp, i = ((T = fr()) == null ? void 0 : T.currentPage) ?? 1, c = K(() => Mp(e, mu(s)), [e, s]), l = K(() => _p(c, i), [c, i]), u = K(() => Np(c, l), [c, l]), f = Is(c), [d, m] = _(""), g = K(() => Ap(c, d), [c, d]), [h, y] = _(() => /* @__PURE__ */ new Set()), I = N(null), w = N(!1), b = () => {
    l.chapterId && !h.has(l.chapterId) && y((k) => new Set(k).add(l.chapterId)), w.current = !0;
  };
  if ($(() => {
    (r || o) && b();
  }, [r, o]), Le(() => {
    var k, E, L;
    w.current && (w.current = !1, (L = (E = (k = I.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null ? void 0 : E.scrollIntoView) == null || L.call(E, { block: "center" }));
  }), !c.length) return null;
  const S = (k) => y((E) => {
    const L = new Set(E);
    return L.has(k) ? L.delete(k) : L.add(k), L;
  }), v = (k, E) => {
    y((L) => L.has(E) ? L : new Set(L).add(E)), k.itemId ? n(k.itemId) : k.page !== null && t(k.page);
  }, P = !!d.trim(), x = (k, E) => /* @__PURE__ */ D(
    se,
    {
      className: "reader-toc-entry",
      "data-depth": Math.min(k.depth, 3),
      "aria-current": k.id === l.nodeId ? "location" : void 0,
      disabled: !k.itemId && k.page === null,
      title: k.page === null ? "这条书签没有指到页" : `${k.title}（第 ${k.page} 页）`,
      onClick: () => v(k, E),
      children: [
        /* @__PURE__ */ p("span", { className: "reader-toc-title", children: k.title }),
        k.page !== null ? /* @__PURE__ */ D("span", { className: "reader-toc-page", children: [
          "p.",
          k.page
        ] }) : null
      ]
    }
  ), R = r ? "取消固定" : "固定在左边", O = /* @__PURE__ */ D($e, { children: [
    /* @__PURE__ */ D("div", { className: "reader-toc-head", children: [
      /* @__PURE__ */ p("span", { className: "reader-toc-head-title", children: "目录" }),
      /* @__PURE__ */ p(se, { className: "reader-toc-pin", "aria-label": R, title: R, "aria-pressed": r, onClick: () => a == null ? void 0 : a(!r), children: r ? /* @__PURE__ */ p(pi, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(na, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) })
    ] }),
    f > Vo ? /* @__PURE__ */ D("div", { className: "reader-toc-filter", children: [
      /* @__PURE__ */ p(la, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ p(
        ar,
        {
          size: "sm",
          className: "reader-toc-filter-input",
          value: d,
          placeholder: "过滤章节标题或节号…",
          "aria-label": "过滤目录",
          onChange: (k) => m(k.target.value),
          onKeyDown: (k) => {
            k.stopPropagation(), k.key === "Escape" && (d ? m("") : (k.currentTarget.blur(), r && !o && (a == null || a(!1))));
          }
        }
      ),
      d ? /* @__PURE__ */ p(se, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => m(""), children: /* @__PURE__ */ p(At, { size: 12, "aria-hidden": !0 }) }) : null
    ] }) : null,
    /* @__PURE__ */ p("div", { className: "reader-toc-list", ref: I, children: g.length ? g.map((k) => {
      const E = P || h.has(k.id);
      return /* @__PURE__ */ D("div", { className: "reader-toc-chapter", children: [
        /* @__PURE__ */ D("div", { className: "reader-toc-chapter-row", children: [
          k.children.length ? /* @__PURE__ */ p(
            se,
            {
              className: "reader-toc-caret",
              "aria-expanded": E,
              "aria-label": `${E ? "收起" : "展开"}「${k.title}」`,
              onClick: () => S(k.id),
              children: E ? /* @__PURE__ */ p(fn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(sa, { size: 12, "aria-hidden": !0 })
            }
          ) : /* @__PURE__ */ p("span", { className: "reader-toc-caret-space" }),
          x(k, k.id)
        ] }),
        E ? k.children.map((L) => /* @__PURE__ */ p("div", { children: x(L, k.id) }, L.id)) : null
      ] }, k.id);
    }) : /* @__PURE__ */ p("p", { className: "reader-toc-empty", children: "没有匹配的章节" }) })
  ] });
  return o ? /* @__PURE__ */ p("nav", { className: "reader-toc-dock", "aria-label": "目录", children: O }) : /* @__PURE__ */ D(
    "nav",
    {
      className: "reader-toc-minimap",
      "aria-label": "目录",
      "data-pinned": r ? "true" : void 0,
      onPointerEnter: r ? void 0 : b,
      onKeyDown: (k) => {
        r && k.key === "Escape" && (a == null || a(!1));
      },
      onFocus: (k) => {
        !r && !k.currentTarget.contains(k.relatedTarget) && b();
      },
      children: [
        /* @__PURE__ */ p("div", { className: "reader-toc-bars", tabIndex: 0, "aria-label": `目录，${f} 条（移上去或按 Tab 展开）`, children: u.map((k) => /* @__PURE__ */ p("span", { className: "reader-toc-bar", "data-kind": k.kind, "data-state": k.state || void 0, "aria-hidden": !0 }, k.id)) }),
        /* @__PURE__ */ p("div", { className: "reader-toc-card", "data-compact": f <= Vo ? "true" : void 0, children: O })
      ]
    }
  );
}
function Lp({ active: e }) {
  return /* @__PURE__ */ D("div", { className: "reader-side-rail", role: "toolbar", "aria-orientation": "vertical", "aria-label": "面板和下载", children: [
    /* @__PURE__ */ p(rr, { place: "side", active: e }),
    /* @__PURE__ */ p("span", { className: "reader-side-rail-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(sp, {})
  ] });
}
function Dp(e) {
  const [t, n] = _([]);
  return $(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = nt().loadIssues;
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
function Cp(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const $p = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Op = ["failed", "content", "layout"];
function zp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Fp(e, t, n) {
  const r = Dp(e), [o, a] = _(-1);
  $(() => a(-1), [r]);
  const s = A((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = N({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, $(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || zp(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = Cp(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function Bp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function jp(e) {
  var r;
  if (e.shiftKey || Bp(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${ha}`))) return null;
  const n = Number((r = t.closest(`[${Pe}]`)) == null ? void 0 : r.getAttribute(Pe)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Hp({
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
  return /* @__PURE__ */ D("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ D(
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
    r.map((c) => /* @__PURE__ */ p(vn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function Up({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ D("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
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
const Ts = "retainpdf:reader:doc-theme:v1", Jo = "data-reader-doc";
function ks() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Kp(e = ks()) {
  try {
    return (e == null ? void 0 : e.getItem(Ts)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Wp(e, t = ks()) {
  try {
    t == null || t.setItem(Ts, e);
  } catch {
  }
}
function Go(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Jo, "dark") : t.removeAttribute(Jo));
}
function Vp() {
  const [e, t] = _(() => Kp());
  $(() => {
    Go(e);
  }, [e]), $(() => () => Go("light"), []);
  const n = A(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Wp(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function qp({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = ws(e, t);
  return a.length ? /* @__PURE__ */ p("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ D("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ D(
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
function Jp({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ D("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    Op.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ D("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ D("h4", { children: [
          $p[o],
          /* @__PURE__ */ p("span", { children: a.length })
        ] }),
        /* @__PURE__ */ p("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(se, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
          /* @__PURE__ */ p("span", { className: "reader-issues-title", children: s.title }),
          /* @__PURE__ */ D("span", { className: "reader-issues-page", children: [
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
function Gp({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: f } = e, d = Ge(), m = fr(), g = (m == null ? void 0 : m.currentPage) ?? 1, h = n.issues.length;
  return /* @__PURE__ */ p($e, { children: r ? /* @__PURE__ */ p(
    Rp,
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
        qp,
        {
          scope: t,
          regions: d == null ? void 0 : d.regions,
          currentPage: g,
          numPages: (m == null ? void 0 : m.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: h ? /* @__PURE__ */ p(Jp, { nav: n }) : void 0,
      issueCount: h
    }
  ) : null });
}
function Xp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p($e, { children: n ? /* @__PURE__ */ p(
    Gm,
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
function Yp(e) {
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
const Zp = 720;
function Qp(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Zp;
}
function eg(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function tg(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = _(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Yp({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = Rl({
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
    f.current !== e.viewStateKey && _l({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function ng(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = Pl(e.liveTranslation), i = A(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = _(null);
  $(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && Nl({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), f = K(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
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
function rg() {
  const [e] = _(ff), t = Tf(e), n = yf(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function og(e, t, n) {
  const r = N(e);
  $(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function ag(e, t, {
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
  const y = A(() => h.current, []), I = K(() => ({
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
  ]), { contributionStore: w, contributions: b, reserveRight: S } = t, v = K(() => hf(b), [b]), P = K(() => vf(b), [b]), x = K(() => bf(b), [b]), R = K(() => pf(b), [b]), O = gf(b);
  return { readerApi: I, contributionStore: w, contributions: b, pageLayers: v, compareVersion: P, textMarks: x, menuSections: R, pointerTakenId: O, reserveRight: S };
}
function sg() {
  try {
    return nt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const ig = "这本书正在处理（翻译或排版），处理完才能改。", cg = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function lg({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = sg(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = wu(s), l = !t || Wt(t), u = Ru(n), [f, d] = _(""), [m, g] = _(null), [h, y] = _(() => /* @__PURE__ */ new Map()), [I, w] = _(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, S] = _(() => /* @__PURE__ */ new Map()), [v, P] = _({ phase: "idle" }), x = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  $(() => {
    g(null), x.drafts.clear(), x.generation.current = null, S(/* @__PURE__ */ new Map()), P({ phase: "idle" });
  }, [s]), $(() => {
    if (d(""), !i || c || !a) return;
    let C = !1;
    return a.resolveOwnerJobId(s).then((W) => {
      C || d(`${W || s}`.trim() || s);
    }).catch(() => {
      C || d(s);
    }), () => {
      C = !0;
    };
  }, [i, c, a, s]), $(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let C = !1;
    return a.fetchRevisions(f).then((W) => {
      C || y(Pu(W, u));
    }).catch(() => {
    }), () => {
      C = !0;
    };
  }, [a, f, u, l]);
  const R = v.phase === "running" && v.seenActive;
  $(() => {
    if (v.phase === "running") {
      if (!l) {
        R || P({ phase: "running", seenActive: !0 });
        return;
      }
      R && P(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [v.phase, R, l, t]);
  const O = K(() => {
    const C = new Map(h);
    if (I.renderedAt === u)
      for (const [W, H] of I.edits) C.set(W, H);
    return C;
  }, [h, I, u]), M = A((C) => {
    const W = `${C || ""}`.trim();
    W && g({ itemId: W, page: Su(W) });
  }, []), T = A(() => g(null), []), k = A((C, W) => {
    w((H) => {
      const J = new Map(H.renderedAt === u ? H.edits : []);
      return J.set(C, W), { renderedAt: u, edits: J };
    }), S((H) => new Map(H).set(C, (H.get(C) || 0) + 1));
  }, [u]), E = A(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      P({ phase: "submitting" });
      try {
        await a.rerender(s), P({ phase: "running", seenActive: !1 }), await o();
      } catch (C) {
        P({ phase: "failed", message: (C == null ? void 0 : C.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), L = c ? cg : !l || v.phase === "running" || v.phase === "submitting" ? ig : "";
  return K(() => ({
    available: i,
    blockedReason: L,
    port: a,
    ownerJobId: f,
    target: m,
    select: M,
    close: T,
    memory: x,
    pendingEdits: O,
    savedCounts: b,
    markSaved: k,
    rerender: v,
    startRerender: E
  }), [i, L, a, f, m, M, T, x, O, b, k, v, E]);
}
function ug(e, t) {
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
function dg(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = lg({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = A((d, m) => {
    La(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  ug(a.available ? u : null, n);
  const f = K(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const fg = "reader-finder-input";
function mg(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function hg(e, t = typeof window > "u" ? null : window) {
  $(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!mg(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(fg) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const Es = "retainpdf.reader.sidebar.v1", pg = ["search", "bookmarks", "issues"], gg = 900;
function bg() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(Es)) || "{}");
    return { tab: pg.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function yg(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(Es, JSON.stringify(e));
  } catch {
  }
}
function vg() {
  const e = `(min-width: ${gg}px)`, [t, n] = _(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
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
function wg(e) {
  const [t] = _(bg), [n, r] = _(null), [o, a] = _(t.tab), i = vg(), c = A((v) => {
    r(v), v && a(v);
  }, []);
  $(() => {
    yg({ tab: n || o });
  }, [n, o]);
  const l = A(() => r((v) => v ? null : o), [o]), u = A((v) => {
    r((P) => P === v ? null : v), a(v);
  }, []), [f, d] = _(""), [m, g] = _("");
  $(() => {
    const v = f.replace(/\s+/gu, " ").trim(), P = window.setTimeout(() => g(v), v ? 150 : 0);
    return () => window.clearTimeout(P);
  }, [f]);
  const [h, y] = _(0), I = A(() => {
    c("search"), y((v) => v + 1);
  }, [c]);
  hg(I);
  const w = A(() => {
    i || r(null);
  }, [i]), b = A((v) => {
    e.jumpToAnchor({ block_id: v }), w();
  }, [e.jumpToAnchor, w]), S = A((v) => {
    e.goToPage(v), w();
  }, [e.goToPage, w]);
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
    jumpToPageFromFinder: S
  };
}
function Sg(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ya(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Ig(e, t) {
  return t === null || e !== t;
}
function Tg(e, t) {
  const { boot: n } = e, r = N(null), o = N(null);
  $(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Je(e.viewStateKey), s = Sg({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: kt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      Ig(e.mode, o.current) && (o.current = null, In(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const kg = [];
function Eg(e) {
  const { sessionFiles: t } = e, [n, r] = _({}), o = N({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = A((y, I) => {
    r((w) => ({ ...w, [I]: { url: o.current[I], nodes: y } }));
  }, []), s = K(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const I = n.translated;
    return I && I.url === t.translatedUrl && I.nodes.length ? I.nodes : kg;
  }, [n, t.sourceUrl, t.translatedUrl]), i = N({}), [c, l] = _(0), u = A((y, I) => {
    i.current[I] = { url: o.current[I], pdf: y }, l((w) => w + 1);
  }, []), [f, d] = _(null), m = A((y) => d(y), []), g = A(() => d(null), []);
  $(() => d(null), [e.viewStateKey]);
  const h = K(() => {
    const y = (I, w) => {
      const b = i.current[I];
      return b && b.url === w ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
function Rg() {
  const e = Fl(), { boot: t, panes: n, session: r } = e, o = yp(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = rg(), { reserveRight: l } = c, u = i || l > 0, f = wg(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, [h, y] = _(!1), I = h && f.pinned, w = A(() => {
    s(null);
  }, []);
  og(l, a, w);
  const { liveTranslationVisible: b, setLiveTranslationVisible: S, paneComposition: v, liveToggles: P, sourceViewOnly: x, visiblePdfMode: R } = tg(
    e,
    i,
    Qp(e.shell.shellWidth, u || g || I)
  );
  Tg(e, x);
  const O = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: M, toggleDocDark: T } = Vp();
  Vl({
    toggleDocDark: T,
    mode: R,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const { latestLivePage: k, jumpToLatestLivePage: E, offerCompletion: L, setCompletionDismissedKey: C, sourcePaneAction: W } = ng(e, {
    liveTranslationVisible: b,
    setLiveTranslationVisible: S,
    liveToggles: P,
    sourceViewOnly: x,
    visiblePdfMode: R
  }), H = A((pe) => {
    const z = eg(pe, e.liveTranslationAvailable);
    z !== null && S(z), e.setModeKeepingPage(pe);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), J = A((pe) => {
    s(pe);
  }, []), [ie] = _(Ip), G = A((pe) => e.jumpToAnchor({ block_id: pe }), [e.jumpToAnchor]), ce = Fp(e.sourceOnly ? "" : r.jobId, e.currentPage, G), [Te, Z] = _(null), me = A((pe, z) => e.jumpToAnchor({ block_id: pe }, z), [e.jumpToAnchor]), { bookmarks: Me, onPdfOutline: re, onPdfDocument: fe, zoomItem: F, setZoomItem: U, zoomBlock: X, closeZoom: le, zoomDocuments: ne } = Eg(e), { blockEdit: oe, editBlock: Ie, revisedBlocks: ae } = dg(e, R, ie), [Q, ge] = _(null), B = A(() => ge(null), []), te = lm({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: he,
    contributionStore: Oe,
    contributions: De,
    pageLayers: _e,
    compareVersion: Fe,
    textMarks: ze,
    menuSections: Ae,
    pointerTakenId: Ke
  } = ag(e, c, {
    translationVersions: te,
    bookmarks: Me,
    regionHover: ie,
    assistantPanel: a,
    closeAssistant: w,
    visiblePdfMode: R,
    changeWorkspace: H,
    jumpToBlockIn: me,
    zoomDocuments: ne,
    editBlock: oe.available && !oe.blockedReason ? Ie : null,
    panelHost: Te
  }), Ce = !!Ke, [Be, j] = _([]), V = K(() => ({
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
    regionHover: ie,
    jumpToBlock: G,
    revisedBlocks: ae,
    onPdfOutline: re,
    onPdfDocument: fe,
    zoomBlock: X,
    textMarks: ze,
    pageLayers: _e,
    editBlock: oe.available ? Ie : void 0,
    blockEdit: oe,
    editShowsSource: R !== "compare",
    findTerm: d === "search" ? m : "",
    compareVersion: Fe,
    pointerTaken: Ce,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: x,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: J, close: w },
    docDark: M,
    toggleDocDark: T
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
    ie,
    G,
    ae,
    re,
    fe,
    X,
    ze,
    _e,
    oe,
    Ie,
    R,
    d,
    m,
    Fe,
    Ce,
    e.sourceOnly,
    x,
    e.download,
    e.goToPage,
    J,
    w,
    M,
    T
  ]), de = K(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), we = [
    gc,
    `is-workspace-${O}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    I ? "is-toc-docked" : "",
    v.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Sf, { api: he, store: Oe, children: /* @__PURE__ */ p(wd, { value: V, hud: de, children: /* @__PURE__ */ D(
    "div",
    {
      className: we,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": O,
      "data-pointer-taken": Ke || void 0,
      onContextMenu: (pe) => {
        const z = jp(pe);
        if (!z) return;
        const q = mf(De, { target: pe.target, clientX: pe.clientX, clientY: pe.clientY, page: z.page });
        !q.length && !Ae.length || (pe.preventDefault(), j(q), ge(z));
      },
      children: [
        /* @__PURE__ */ D("div", { className: "reader-workspace", children: [
          I ? /* @__PURE__ */ p(qo, { bookmarks: Me, onJumpPage: e.goToPage, onJumpBlock: G, pinned: !0, docked: !0, onPinChange: y }) : null,
          /* @__PURE__ */ p(Gp, { state: f, bookmarkScope: e.viewStateKey, issues: ce }),
          /* @__PURE__ */ D("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(
              df,
              {
                mode: R,
                documentReady: !!r.jobId,
                sourceViewOnly: x,
                onModeChange: H,
                compareExtra: /* @__PURE__ */ p(rr, { place: "compare" }),
                liveTranslation: P.topBarPill ? {
                  visible: b,
                  state: e.liveTranslation,
                  onToggle: () => S((pe) => !pe),
                  latestPage: b ? k : null,
                  currentPage: e.currentPage,
                  onJumpToLatest: E
                } : null,
                completion: L ? {
                  onOpenCompare: () => {
                    C(e.viewStateKey), H("compare");
                  }
                } : null,
                start: /* @__PURE__ */ p(Ql, { onBeforeClose: r.prepareClose })
              }
            ),
            I ? null : /* @__PURE__ */ p(qo, { bookmarks: Me, onJumpPage: e.goToPage, onJumpBlock: G, pinned: h, onPinChange: y }),
            /* @__PURE__ */ p(Lp, { active: a }),
            /* @__PURE__ */ p(ef, { paneComposition: v, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: W }),
            /* @__PURE__ */ p(Yh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts })
          ] }),
          /* @__PURE__ */ D(
            "aside",
            {
              className: "reader-dock",
              hidden: !u,
              "data-dock": i ? "panel" : l ? "extension" : void 0,
              style: !i && l ? { "--reader-dock-width": `${l}px` } : void 0,
              "aria-label": "阅读辅助面板",
              children: [
                /* @__PURE__ */ p(lh, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: Z })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p(Gh, {}) : null,
        /* @__PURE__ */ p(
          bp,
          {
            mode: R,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            startSlot: /* @__PURE__ */ p(Ep, { open: d, onToggle: f.toggleSidebar, issueCount: ce.issues.length }),
            leftSlot: /* @__PURE__ */ p(Up, { edit: oe }),
            toolsSlot: /* @__PURE__ */ p(rr, { place: "bottom" })
          }
        ),
        /* @__PURE__ */ p(
          Xp,
          {
            session: r,
            zoomDocuments: ne,
            zoomItem: F,
            setZoomItem: U,
            closeZoom: le,
            visiblePdfMode: R
          }
        ),
        /* @__PURE__ */ p(Hp, { menu: Q, onClose: B, actions: Be, sections: Ae }),
        /* @__PURE__ */ p(Ef, { extensions: pr }),
        /* @__PURE__ */ p(Sp, {})
      ]
    }
  ) }) });
}
function Xg() {
  return /* @__PURE__ */ p(Rg, {});
}
export {
  Xg as R,
  Rg as a,
  qg as b,
  Jg as c,
  Bf as d,
  Hf as e,
  Wg as f,
  Vg as g,
  Ug as h,
  Kg as r,
  Gg as s,
  Ge as u
};
//# sourceMappingURL=ReaderApp-DSzeJv4f.js.map
