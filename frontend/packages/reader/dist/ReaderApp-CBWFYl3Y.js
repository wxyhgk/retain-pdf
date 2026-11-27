var ps = Object.defineProperty;
var Er = (e) => {
  throw TypeError(e);
};
var gs = (e, t, n) => t in e ? ps(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Pr = (e, t, n) => gs(e, typeof t != "symbol" ? t + "" : t, n), Rr = (e, t, n) => t.has(e) || Er("Cannot " + n);
var At = (e, t, n) => (Rr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Mr = (e, t, n) => t.has(e) ? Er("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), _r = (e, t, n, r) => (Rr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as D, jsx as p, Fragment as Oe } from "react/jsx-runtime";
import { useMemo as V, useState as R, useEffect as $, useCallback as _, useRef as N, useLayoutEffect as Ce, memo as Gt, createContext as Xt, useContext as ut, Fragment as Yn, forwardRef as Bo, useImperativeHandle as Zn, useSyncExternalStore as hn, Component as bs, Suspense as jo, lazy as Ho, useId as Uo } from "react";
import { requireAdapter as Nt, getReaderAdapters as Fe } from "./adapters.js";
import { resolveReaderDownloadName as ys, resolveReaderDownloadUrls as vs, READER_PROGRESS_COPY as Je, trimString as sn, READER_DOWNLOAD_ACTIONS as ws, disabledReason as Ss } from "./runtime/state.js";
import { r as ks, b as Is } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as An, isFinishedJobStatus as Ut } from "@retainpdf/domain/job";
import { n as Wo, d as Ts, f as vn, k as Nr, b as Es, c as Ps, j as Be, p as pt, g as Rs, l as Rt, i as Ms } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as _s } from "@retainpdf/api/documents";
import { isReaderTransportError as Ns, createReaderTransportError as As } from "./contracts.js";
import { toast as xn, Toaster as xs } from "sonner";
import { X as gt, PenLine as Qn, ZoomIn as Ls, Check as Ko, Copy as Ds, ChevronUp as Cs, ChevronDown as Vo, History as $s, LoaderCircle as Os, Pin as qo, LogOut as zs, FileText as Jo, Columns2 as Go, Languages as Xo, Radio as Fs, ArrowDownToLine as Bs, CheckCircle2 as js, ImagePlus as Hs, MessageCircleQuestion as Us, GitCompareArrows as Ws, Highlighter as Ks, Eraser as Vs, Undo2 as qs, Trash2 as Js, ChevronLeft as Gs, ChevronRight as Yo, Minus as Xs, Plus as Ys, ArrowLeft as Zs, Keyboard as Qs, Download as ei, LayoutGrid as ti, ListTree as ni, PinOff as ri } from "lucide-react";
import { Button as se, Textarea as oi, IconButton as lt, Input as Zo } from "@retainpdf/ui";
import { pdfjs as Qo, Page as ai, Document as si } from "react-pdf";
import { e as ii, m as ci, a as li } from "./markdown-math-XkF5urpn.js";
const ui = (...e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, di = "", fi = Object.freeze({
  progress: "retainpdf-reader-progress"
}), mi = (e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Pg = (...e) => {
  var n;
  return (((n = Fe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Rg = () => {
  var e, t;
  return ((t = (e = Fe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
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
}, ea = {
  messageTargetOrigin: () => Ar().messageTargetOrigin(),
  readerJobId: () => Ar().readerJobId()
}, hi = () => {
  var e;
  return ((e = Fe()) == null ? void 0 : e.liveTranslation) ?? null;
}, Wt = () => {
  var t;
  const e = Fe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, et = () => {
  const e = Fe();
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
}, pi = (...e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, gi = () => {
  var e, t;
  return ((t = (e = Fe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, bi = (...e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, yi = (...e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ys(...e);
}, vi = (...e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? vs(...e);
}, wi = (...e) => Nt("downloadProtectedResource")(...e), Si = (...e) => Nt("failDownloadToast")(...e), _g = (e, t) => Nt("resolveMarkdownAssetUrl")(e, t), xr = "/api/v1";
function ki() {
  const e = () => {
    var r;
    return ks(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = R(e);
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
function Ii() {
  const e = ki(), t = V(() => bi(ea), [e]), n = V(() => gi(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Ti(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = R({
    documentId: "",
    jobId: ""
  }), [u, f] = R({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, b] = R({
    jobId: "",
    documentId: ""
  }), w = h.jobId === g ? h.documentId : "", S = t || w, y = !!t && !g, [v, k] = R(null), P = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, x = y || !!P, A = _((M) => {
    const I = `${M.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      b({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${M.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  $(() => {
    k((M) => M && M.sessionIdentity !== r ? null : M);
  }, [r]);
  const z = _((M) => {
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
        b((I) => I.jobId === M.jobId && I.documentId === M.documentId ? I : { jobId: M.jobId, documentId: M.documentId });
        break;
      case "committed-source":
        k({
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
    setResolvedJobDocument: b,
    jobDocumentId: w,
    documentId: S,
    sourceOnly: y,
    committedDocumentSource: v,
    setCommittedDocumentSource: k,
    activeCommittedDocumentSource: P,
    sourceViewOnly: x,
    refreshCommittedDocument: A,
    applyIdentityEvent: z
  };
}
function Lr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Ei(e) {
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
  return mi(An(e, t));
}
function Pi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ri(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Pi(a, t))
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
        type: fi.progress,
        stage: n,
        percent: e,
        text: t
      },
      ea.messageTargetOrigin()
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
function Mi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = R(null), [l, u] = R(null), [f, d] = R(""), [m, g] = R(0), h = f === n ? i : null, b = f === n ? l : null, w = Lr(h), S = Ut(w), y = _(() => {
    g((z) => z + 1);
  }, []), v = _((z) => {
    c(z.jobPayload), u(z.manifestPayload), d(z.sessionIdentity);
  }, []), k = _((z) => {
    c(null), u(null), d(z);
  }, []), P = N(""), x = N(""), A = _(async () => {
    const z = o.current;
    if (!z || P.current === z) return;
    const M = et().loadJobPayload;
    if (typeof M != "function") return;
    const I = a.current.value;
    P.current = z;
    try {
      const T = await M(z);
      if (s.current || a.current.value !== I || o.current !== z || !T || typeof T != "object")
        return;
      const E = Lr(T);
      c(T), d(r.current), !Ut(E) && x.current === z && (x.current = ""), E === "succeeded" && x.current !== z && (x.current = z, g((L) => L + 1));
    } catch {
    } finally {
      P.current === z && (P.current = "");
    }
  }, []);
  return $(() => {
    x.current = "";
  }, [n]), $(() => {
    if (!t || S || !h) return;
    const z = window.setInterval(() => {
      document.visibilityState !== "hidden" && A();
    }, 1e3);
    return () => window.clearInterval(z);
  }, [S, A, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: b,
    jobStatus: w,
    jobTerminal: S,
    jobRefreshRevision: m,
    refreshJobArtifacts: y,
    refreshJobStatus: A,
    publishPayload: v,
    clearPayload: k
  };
}
function Dn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function _i(e, t) {
  e(t), Dn(t);
}
function Ni(e) {
  const [t, n] = R(e ? "source" : "compare"), r = _((a) => {
    e && a !== "source" || (n(a), Dn(a));
  }, [e]), o = _((a) => {
    _i(n, a);
  }, []);
  return $(() => (e && document.documentElement.classList.add("reader-source-only"), Dn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Cr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ai(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Cr(n.active_job_id),
    activeVersionId: Cr(n.active_version_id)
  };
}
function xi(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Li(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Di(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ci = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function $i(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ci.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Oi = 48 * 1024 * 1024;
function zi(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Fi = 2, ze = /* @__PURE__ */ new Map();
function Cn(e, t) {
  ze.delete(e), ze.set(e, t);
}
function $r(e) {
  if (ze.size < Fi) return;
  const t = ze.keys().next().value;
  t && ze.delete(t);
}
async function Bi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function ta(e, t = Wt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, b, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ze.has(r)) {
    const y = ze.get(r);
    return Cn(r, y), y;
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
    const v = await Bi(s);
    throw v && (y.reason = v), y;
  }
  const i = ji(r, s, t);
  if (i) {
    o.abort();
    const y = { ranged: i };
    return $r(), ze.set(r, y), y;
  }
  (b = (h = n.signal) == null ? void 0 : h.addEventListener) == null || b.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return ze.has(r) ? Cn(r, l) : ($r(), ze.set(r, l)), l;
}
function ji(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Oi ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Hi = { file: null, loading: !1, error: "" }, Ui = { file: null, loading: !0, error: "" };
function Wi(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = R(null);
  if ($(() => {
    if (t || !n) return;
    const s = ze.get(n);
    if (s) {
      Cn(n, s);
      return;
    }
    const i = new AbortController();
    return ta(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Hi;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = ze.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ui;
}
function Ki(e) {
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
  const i = await ta(t, Wt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (cn(s, o, n, "download"), i);
}
async function Vi(e) {
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
function qi(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ji({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = _s,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(qi(o.href, t, a)), !0);
}
const Qt = {
  regions: null,
  metadata: null
};
function Gi(e) {
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
    activeLoadAbortRef: w
  } = e, [S, y] = R(""), [v, k] = R(""), [P, x] = R(null), [A, z] = R(null), [M, I] = R(!1), [T, E] = R(""), [L, C] = R([]), [U, W] = R(!1), [G, j] = R(() => ({
    source: null,
    translated: null
  })), [J, X] = R(
    Qt
  ), [pe, Q] = R({
    loading: !0,
    percent: 4,
    text: Je.boot,
    stage: "progress",
    failed: !1
  });
  return $(() => {
    const ue = new AbortController(), Re = h.current.value, ce = Ki({
      sessionEpochRef: h,
      closingRef: b,
      abort: ue,
      sessionEpoch: Re
    });
    w.current = ue;
    const oe = et();
    if (b.current)
      return ue.abort(), () => {
        w.current === ue && (w.current = null);
      };
    let F = !1;
    function K(le, ee) {
      ce.markFailed(), W(!0), Q({
        loading: !1,
        percent: 100,
        text: le,
        stage: "failed",
        failed: !0
      }), Ln({ percent: 100, text: ee, stage: "failed" });
    }
    function Y() {
      I(!0), F || W(!0), Q({
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
      ) : ui() ? di : oe.resolveResourceUrl(An(r));
    }
    async function ie() {
      var te;
      let le = { activeJobId: "", activeVersionId: "" };
      try {
        const he = await ((te = oe.fetchDocument) == null ? void 0 : te.call(oe, r));
        he && (le = Ai(he));
      } catch {
      }
      const ee = xi({
        link: le,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (ee.kind === "follow-active-job") {
        if (ce.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: ee.jobId
        }), ee.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: ee.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (ee.kind === "open-committed-source") {
        if (ce.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: ee.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ge = fe();
      if (ce.isInactive()) return;
      y(ge), k(""), E(""), d(c);
      const B = await $n({
        url: ge,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ce,
        setBoot: Q
      });
      if (!ce.isInactive()) {
        if (!B) {
          K("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        x(B), Y();
      }
    }
    async function me() {
      var qe;
      const le = !l, ee = !!(le && oe.loadSessionSnapshot && oe.loadReaderOptionalArtifacts), ge = ee ? oe.loadReaderOptionalArtifacts(t) : null, B = await ((qe = oe.loadSessionSnapshot) == null ? void 0 : qe.call(oe, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: le && !ee
      })), te = B ? {
        jobPayload: B.sourcePayload,
        manifestPayload: B.manifestPayload,
        readerMetadata: B.readerMetadata,
        regionsPayload: B.regions,
        readerErrors: B.readerErrors
      } : await oe.loadReaderPayload(t, {
        includeOptionalArtifacts: le
      });
      if (ce.isInactive()) return;
      let he = null;
      if (n && !r)
        if (B && B.linkedDocument !== void 0)
          he = B.linkedDocument;
        else {
          try {
            he = await oe.fetchDocumentByJobId(xr, t);
          } catch {
          }
          if (ce.isInactive()) return;
        }
      const Me = Ei(te.jobPayload) || `${(he == null ? void 0 : he.document_id) || ""}`.trim();
      Me && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Me
      });
      const _e = Li({
        payloadDocumentId: Me,
        linkedActiveJobId: `${(he == null ? void 0 : he.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(he == null ? void 0 : he.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (_e.kind === "restore-committed-source") {
        if (ce.isInactive()) return;
        u({
          type: "committed-source",
          documentId: _e.documentId,
          revision: _e.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Ae = oe.resolveReaderSourcePdf(te.manifestPayload), xe = oe.resolveReaderTranslatedPdfUrl(te.jobPayload, te.manifestPayload), $e = typeof Ae == "string" ? Ae : oe.resolveReaderArtifactUrl(Ae), je = r || Me, Ue = l != null && l.documentId ? Dr(
        l.documentId,
        l.revision
      ) : $e || (je ? oe.resolveResourceUrl(An(je)) : ""), O = l ? "" : xe || "";
      y(Ue || ""), k(O), E(Ri(te.jobPayload, t)), f({
        jobPayload: te.jobPayload || null,
        manifestPayload: te.manifestPayload || null,
        sessionIdentity: c
      });
      const q = () => Vi({
        sourceFinal: Ue || "",
        translatedFinal: O,
        fence: ce,
        setBoot: Q
      }), ae = !!(Ue || O), we = ge && ae ? q() : null;
      we == null || we.catch(() => {
      });
      const Le = (H) => {
        ce.isInactive() || (C(l ? [] : Wo(H.regionsPayload)), j(l ? { source: null, translated: null } : Ts(H.readerMetadata)), X(l ? Qt : H.readerErrors ?? Qt), W(!0));
      };
      if (ge ? (F = !0, ge.then(Le)) : Le(te), !ae) {
        K(Je.failed, Je.failed);
        return;
      }
      const De = await (we ?? q());
      if (De.status !== "inactive") {
        if (De.status === "incomplete") {
          K("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        x(De.sourceBytes), z(De.translatedBytes), Y();
      }
    }
    async function ke() {
      I(!1), x(null), z(null), C([]), W(!1), j({ source: null, translated: null }), X(Qt), cn(Q, 8, Je.metadata, "metadata");
      try {
        if (s) {
          await ie();
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
        const ee = Number(le == null ? void 0 : le.status), ge = `${(le == null ? void 0 : le.reason) || ""}`, B = $i({ status: ee, reason: ge, sessionJobId: t });
        if (B && (await Ji({
          apiPrefix: xr,
          documentId: B,
          expiredJobId: t
        }) || ce.isClosedOrStale()))
          return;
        if (Di({
          status: ee,
          reason: ge,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const te = le instanceof Error ? le.message : Je.failed;
        K(te, te);
      }
    }
    return ke(), () => {
      ue.abort(), w.current === ue && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: P,
    translatedFile: A,
    assetsReady: M,
    title: T,
    regions: L,
    regionsSettled: U,
    readerMetadata: G,
    readerErrors: J,
    boot: pe
  };
}
function Xi() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ii(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), c = N(""), l = N(""), u = N(() => {
  }), f = _(() => u.current(), []), d = Ti({
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
  } = d, { mode: w, setMode: S, switchSessionMode: y } = Ni(b);
  u.current = () => {
    y("source");
  }, i.current = a, c.current = g, l.current = m;
  const v = Mi({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: P,
    jobStatus: x,
    jobTerminal: A,
    jobRefreshRevision: z,
    refreshJobArtifacts: M,
    refreshJobStatus: I
  } = v, T = Gi({
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
    switchSessionMode: y,
    jobRefreshRevision: z,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = _(() => {
    var C;
    e.current = !0, (C = t.current) == null || C.abort();
  }, []), L = V(
    () => ({
      fetchProtected: et().fetchProtected,
      jobId: m,
      jobPayload: k,
      manifestPayload: P,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: b
    }),
    [m, k, P, T.sourceUrl, T.translatedUrl, b]
  );
  return {
    jobId: m,
    jobStatus: x,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: A,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
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
    download: L,
    refreshJobArtifacts: M,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: E
  };
}
const Yi = 160, Zi = 8, Qi = 0;
function ec() {
  const e = N(null), [t, n] = R(null), [r, o] = R(Qi), a = _((s) => {
    e.current = s, n(s);
  }, []);
  return $(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Yi || o((u) => Math.abs(u - l) < Zi ? u : l);
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
function tc(e) {
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
function nc(e, t) {
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
  const [f, d] = R(() => ({
    identity: l,
    pages: wn
  })), [m, g] = R(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : wn, b = m.identity === l ? m.tick : 0, w = tc({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = w, y = _((I, T) => {
    u.current === l && d((E) => {
      const L = E.identity === l ? E.pages : wn;
      return L[T] === I && E.identity === l ? E : {
        identity: l,
        pages: { ...L, [T]: I }
      };
    });
  }, [l]), v = N(null), k = _(() => {
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
  const P = V(
    () => Math.max(h.source, h.translated),
    [h]
  ), x = S === "translated" ? h.translated : h.source || h.translated, A = t == null ? void 0 : t.userZoom, z = t == null ? void 0 : t.shellWidth, M = `${l}-${b}-${A}-${n}-${h.source}-${h.translated}-${z}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: P,
    primaryNumPages: x,
    metricsTick: b,
    onNumPages: y,
    onMetrics: k,
    rowSyncRevision: M
  };
}
const Te = "data-reader-page", Ie = "data-reader-pane", er = "data-natural-height", rc = "reader-react-root", na = "reader-react-grid", ra = "reader-react-scroll-shell", pn = "reader-react-pdf-pane", oa = "reader-react-pdf-page", ln = "reader-react-pdf-page-placeholder", tr = "reader-react-pdf-page-slot";
function un(e, t) {
  const n = e != null ? `[${Te}="${e}"]` : `[${Te}]`;
  return t ? `${n}[${Ie}="${t}"]` : n;
}
function nr() {
  return `.${tr}[${Te}]`;
}
function dn(e) {
  return Number(e.getAttribute(Te));
}
const aa = 0.25, fn = 1, oc = 0.05, Yt = 0.5, ac = 16, sc = 8, sa = ac + sc, ic = 720;
function Tt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ia(e) {
  return Number.isFinite(e) && e < ic;
}
function kt(e, t = Number.POSITIVE_INFINITY) {
  return ia(t) && (e === "source" || e === "translated") ? fn : Yt;
}
function Ze(e) {
  return Number.isFinite(e) ? Math.min(fn, Math.max(aa, e)) : Yt;
}
function Kt(e, t) {
  const n = Ze(Number(e) + t * oc);
  return Math.round(n * 100) / 100;
}
function cc(e) {
  return Math.round(Ze(e) * 100);
}
function ca(e) {
  const n = (Number(e) || 0) - sa;
  return Math.max(160, Math.floor(n));
}
function lc(e, t = Yt) {
  const n = Ze(t);
  return ca((Number(e) || 0) * n);
}
function uc(e, t) {
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
const dc = 8;
function fc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < dc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const la = 200, mc = [
  "markdown"
], hc = mc;
function ua(e) {
  return hc.includes(e);
}
const pc = "retainpdf:reader:view:v1:", Or = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), gc = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function da() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function On(e) {
  return `${e || ""}`.trim();
}
function bc({
  documentId: e,
  jobId: t
}) {
  const n = On(e);
  if (n) return `document:${n}`;
  const r = On(t);
  return r ? `job:${r}` : "";
}
function fa(e) {
  const t = On(e);
  return t ? `${pc}${t}` : "";
}
function yc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function vc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Or.has(t) || !Or.has(n) || t === n))
    return { left: t, right: n };
}
function wc(e) {
  return e === null ? null : ua(e) ? e : void 0;
}
function Sc(e) {
  return gc.has(e) ? e : void 0;
}
function ma(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = yc(t.anchor), r = Number(t.zoom), o = Sc(t.mode), a = vc(t.splitLayout), s = wc(t.assistantPanel);
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
function Ve(e, t = da()) {
  const n = fa(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ma(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function gn(e, t, n = da()) {
  const r = fa(e);
  if (!r || !n) return null;
  const o = Ve(e, n), a = ma({
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
function kc(e, t, n = "") {
  var d;
  const [r, o] = R(() => {
    var m;
    return ((m = Ve(n)) == null ? void 0 : m.zoom) ?? kt(e, Tt());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), c = N(((d = Ve(n)) == null ? void 0 : d.zoom) !== void 0);
  $(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Ve(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? kt(e, Tt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), $(() => {
    if (c.current) return;
    const m = kt(e, Tt()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = _((m, g) => {
    const h = Ze(m), b = a.current;
    Math.abs(h - b) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (b || 1), a.current = h, c.current = !0, gn(s.current, { zoom: h }), o(h));
  }, []), u = _((m) => {
    l(Kt(a.current, m));
  }, [l]), f = _((m) => {
    l(kt(m));
  }, [l]);
  return Ce(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, uc(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const Ic = 160, Tc = 3e-3, zr = 50, Ec = 16, Pc = 800;
function Rc(e, t = 0) {
  const n = t === 1 ? Ec : t === 2 ? Pc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-zr, Math.min(zr, r));
  return Math.exp(-o * Tc);
}
function Mc(e, t, n = 0) {
  return Ze(e * Rc(t, n));
}
function _c(e) {
  return Math.round(Ze(e) * 100) / 100;
}
function Nc(e, t, n) {
  const r = Ze(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ze(t) / r;
  const a = (o + sa) / r;
  return ca(a * Ze(t)) / o;
}
function Ac(e) {
  return Array.from(e.querySelectorAll(nr()));
}
function xc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Lc(e, t, n) {
  let r = null;
  for (const s of Ac(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = xc(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Te) || "",
    pane: o.getAttribute(Ie) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Dc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ha(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${nr()}[${Te}="${t.page}"][${Ie}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Dc(n, e).scrollLeft += a);
}
function Cc(e, t, n, r) {
  const o = e.querySelector(`.${na}`);
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
const $c = 600, Oc = 1e3;
function zc(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ha(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Oc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Fc(e, t, n) {
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
      const f = _c(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        xt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, xt(d.grid));
      }, $c), s.current = d, o.current(f, { keepScroll: !1 });
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
          anchor: Lc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Mc(f.target, u.deltaY, u.deltaMode);
      const d = Nc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Cc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, Ic);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), xt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Ce(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), xt(c.grid), !(!e || !c.anchor) && (ha(e, c.anchor), (l = i.current) == null || l.call(i), i.current = zc(e, c.anchor)));
  }, [t, e]);
}
function Bc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: _((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const rr = 48;
function pa(e, t = rr) {
  return e.getBoundingClientRect().top + t;
}
function ga(e, t) {
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
function Bt(e, t, n = rr) {
  if (!e)
    return null;
  const r = un(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = pa(e, n), i = ga(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Mt(e, t, n = "auto", r, o = rr) {
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
function jc(e, t, n = "smooth", r) {
  return Mt(
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
function Hc(e, t, n) {
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
function Uc(e, t, n = !0, r = "", o) {
  const [a, s] = R(1);
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
      const b = pa(i), w = ga(h, b);
      w && s(w.page);
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
const Wc = `canvas, .react-pdf__Page, .${oa}, .${ln}`, Fr = /* @__PURE__ */ new WeakMap();
function Kc(e) {
  const t = Number(e.getAttribute(er));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Fr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Wc), Fr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Vc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function qc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(nr()).forEach((r) => {
    const o = dn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Kc(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Jc(e, t, n = "", r) {
  const [o, a] = R(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, Ce(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, f = !1;
    const d = () => {
      var k;
      if (c) return;
      const y = e.current;
      if (!y) return;
      const v = qc(y);
      Vc(s.current, v) || (s.current = v, a(v)), u && !f && (f = !0, (k = i.current) == null || k.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), b = window.setTimeout(m, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => m()), S.observe(w)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(b), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Gc = [0, 48, 140, 320, 560], Xc = 700, Yc = [80, 200, 400], Zc = 500, Qc = 50, el = /* @__PURE__ */ new Set([
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
]), tl = 180, Br = [0, 48, 140, 320, 700, 1200];
function nl(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((T = Ve(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = N(null), l = N(!1), u = N(r), f = N(null), d = N(null), m = N(null), g = N(null), h = N(a), b = N(""), w = N(n);
  w.current = n;
  const S = _(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), y = _(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), v = _((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const L = () => {
      g.current = null, gn(h.current, {
        anchor: He(i.current)
      });
    };
    E ? L() : g.current = setTimeout(L, tl);
  }, []), k = _((E) => {
    i.current = He(E), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Qc);
  }, []);
  $(() => {
    if (!o)
      return;
    let E = !1, L = null, C = null, U = null;
    const W = () => {
      if (E) return;
      const G = e.current;
      if (!G) {
        U = setTimeout(W, 50);
        return;
      }
      L = G, C = () => {
        if (l.current)
          return;
        const j = Bt(L, w.current);
        j && (i.current = j, v());
      }, L.addEventListener("scroll", C, { passive: !0 }), l.current || C();
    };
    return W(), () => {
      E = !0, U != null && clearTimeout(U), L && C && L.removeEventListener("scroll", C);
    };
  }, [o, r, n, e, v]), $(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const L = (C) => {
      C.metaKey || C.ctrlKey || C.altKey || el.has(C.key) && y();
    };
    return E.addEventListener("wheel", y, { passive: !0 }), E.addEventListener("touchmove", y, { passive: !0 }), window.addEventListener("keydown", L), () => {
      E.removeEventListener("wheel", y), E.removeEventListener("touchmove", y), window.removeEventListener("keydown", L);
    };
  }, [o, e, y]), Ce(() => {
    var L;
    if (h.current === a) return;
    v(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, b.current = "";
    const E = (L = Ve(a)) == null ? void 0 : L.anchor;
    i.current = E ? He(E) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, v, S]), $(() => {
    var L;
    if (!o || !s || !a || b.current === a) return;
    b.current = a;
    const E = He(
      ((L = Ve(a)) == null ? void 0 : L.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, c.current = E, l.current = !0, S(), f.current = zn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: Br,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Math.max(...Br) + 160), () => S();
  }, [o, s, a, e, k, S]), $(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const E = c.current ? He(c.current) : He(i.current);
    return l.current = !0, c.current = E, i.current = E, S(), f.current = zn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Gc,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Xc), () => {
      S();
    };
  }, [r, o, n, e, k, S]), $(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), v(!0);
  }, [S, v]);
  const P = _(() => {
    const E = Bt(
      e.current,
      w.current
    );
    return He(E || i.current);
  }, [e]), x = _(() => {
    l.current = !0;
    const E = Bt(
      e.current,
      w.current
    ), L = He(E ?? i.current);
    return i.current = L, c.current = L, v(), L;
  }, [e, v]), A = _((E, L, C) => {
    const U = C || w.current, W = mn(E, L || 1), G = { page: W, fraction: 0 };
    i.current = G, l.current = !0, c.current = G, v(), S(), jc(e.current, W, "smooth", U), f.current = Hc(
      () => e.current,
      W,
      {
        behavior: "auto",
        pane: U,
        delaysMs: Yc,
        onDone: () => k(G)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(G);
    }, Zc);
  }, [e, k, S, v]), z = _(() => He(i.current), []), M = _(() => l.current, []), I = _(() => {
    if (!l.current || !c.current)
      return;
    const E = He(c.current);
    Mt(
      e.current,
      E,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: P,
    beginModeSwitch: x,
    goToPage: A,
    getAnchor: z,
    isRestoring: M,
    repinIfRestoring: I
  };
}
function rl(e, t) {
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
function ba(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const ol = [0, 80, 200, 400, 800], al = 120, sl = 400;
function il(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = N(a);
  f.current = a;
  const d = N(s);
  d.current = s;
  const m = N(i);
  m.current = i;
  const g = N(n);
  g.current = n, $(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = pi(), b = rl(h, d.current);
    if (b == null && (h != null && h.blockId) && !u) return;
    const w = ba(h, b, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (b == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, h && ((k = m.current) == null || k.call(m, h, b));
    const S = [];
    let y = 0;
    for (const P of ol)
      y = Math.max(y, P), S.push(
        setTimeout(() => {
          f.current(b);
        }, P)
      );
    return S.push(
      setTimeout(() => {
        var P;
        (P = g.current) == null || P.call(g);
      }, y + al)
    ), () => {
      for (const P of S) clearTimeout(P);
    };
  }, [r, o, c, l, t, u]);
}
function cl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function ll(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = sl,
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
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = Is(g, o, u.current);
      if (d.current = o, h === null) return;
      const b = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = ba(
        { blockId: b },
        o,
        { jobId: i, documentId: c }
      ), (f.current || cl)(h);
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
function ul(e) {
  const t = N(""), [n, r] = R(!1), o = _(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  il(a, t, o), ll(e, t, n);
}
const Lt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function dl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function jr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function ya(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = jr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = jr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function fl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = ya(r, t, n);
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
function ml(e) {
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
function hl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function pl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function gl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function bl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Hr = [250, 500, 1e3, 2e3, 4e3], Sn = [80, 160, 320, 640, 1e3, 1500], Ur = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
function or(e) {
  return Ns(e) ? `${e.code || ""}`.trim() : "";
}
function en(e, t) {
  const n = or(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function yl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ya(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = As(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = or(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Sn[Math.min(s, Sn.length - 1)];
    if (await Fn(i, r), s >= Sn.length + 2) throw a;
  }
}
function vl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = R(Lt), s = N(o), i = N("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Ut(l) ? l : "";
  return $(() => {
    if (!n || !c) {
      i.current = "", s.current = Lt, a(Lt);
      return;
    }
    const f = r === void 0 ? hi() : r, d = i.current === c;
    if (i.current = c, !f) {
      const y = {
        ...d ? s.current : Lt,
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
      ...d ? s.current : Lt,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const b = (y) => {
      m.signal.aborted || a((v) => {
        const k = y(v);
        return s.current = k, k;
      });
    }, w = async () => {
      let y = 0;
      for (; !m.signal.aborted; )
        try {
          const v = await f.fetchLayout(c, { signal: m.signal });
          g = !0, b((k) => ({
            ...k,
            layoutByPage: dl(v),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = or(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            b((x) => ({
              ...x,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: en(v, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            b((x) => ({
              ...x,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          b((x) => ({
            ...x,
            connection: "connecting",
            jobStatus: l,
            error: en(v, "正在等待 OCR 版面数据")
          })), await Fn(Hr[Math.min(y, Hr.length - 1)], m.signal).catch(() => {
          }), y += 1;
        }
    };
    return (async () => {
      if (await w(), !g || m.signal.aborted) return;
      let y = 0;
      for (; !m.signal.aborted; ) {
        u || b((v) => ({
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
              let k;
              try {
                k = await yl(
                  c,
                  v,
                  s.current,
                  m.signal,
                  f
                );
              } catch (P) {
                if ((P == null ? void 0 : P.name) === "AbortError" || m.signal.aborted) throw P;
                b((x) => ({
                  ...x,
                  lastSeq: Math.max(x.lastSeq, v.seq),
                  error: en(P, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              b((P) => {
                const x = fl(P, v, k);
                return u ? {
                  ...x,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...x,
                  jobStatus: l
                };
              }), y = 0;
            }
          });
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError" || m.signal.aborted) return;
          b((k) => ({
            ...k,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: en(v, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          b((v) => ({
            ...v,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Fn(Ur[Math.min(y, Ur.length - 1)], m.signal).catch(() => {
        }), y += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function wl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Sl(e, t = !0) {
  const [n, r] = R(() => /* @__PURE__ */ new Map());
  return $(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = et().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(wl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const kl = 4500;
function Il(e) {
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
const Tl = /* @__PURE__ */ new Set(["book", "translate"]);
function va(e) {
  return !!(e.jobId && e.sourceUrl && Tl.has(e.workflow));
}
function El(e) {
  return !!(va(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Pl() {
  const e = Xi(), t = va({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = El({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Ut(o) && (r.current.running = !0);
  const a = vl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = ec(), u = Sl(e.jobId, !e.sourceOnly), f = bc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = kc(e.mode, s, f);
  Fc(i, m, g);
  const h = nc(
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
    goToPage: w,
    repinIfRestoring: S
  } = nl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  $(() => {
    S();
  }, [c, S]);
  const y = Jc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), v = Uc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), k = _((W, G) => {
    var J, X;
    const j = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((J = h.numPagesByPane) == null ? void 0 : J.source) || 0,
      Number((X = h.numPagesByPane) == null ? void 0 : X.translated) || 0
    );
    w(W, j, G);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [P, x] = R(null), A = N(null), z = _((W) => {
    A.current && clearTimeout(A.current), x(W), W && (A.current = setTimeout(() => x(null), kl));
  }, []);
  $(() => () => {
    A.current && clearTimeout(A.current);
  }, []);
  const M = _((W) => {
    const G = vn(e.regions, W);
    return G ? Nr(G, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = _((W, G) => {
    const j = G || h.primaryPane, J = typeof W == "object" && W ? `${W.block_id || ""}`.trim() : "", X = typeof W == "object" && W ? `${W.image_url || ""}`.trim() : "", pe = typeof W == "object" && W ? W.page_idx != null ? Number(W.page_idx) + 1 : W.page != null ? Number(W.page) : null : typeof W == "number" ? W + 1 : null, Q = Es(e.regions, X, pe) || vn(e.regions, J) || (typeof W == "object" ? Ps(e.regions, W) : null);
    let ue = Q ? Nr(Q, j).page : null;
    ue == null && (ue = Il(W)), !(ue == null || ue < 1) && (z(Q), k(ue, j));
  }, [z, k, h.primaryPane, e.regions]);
  ul({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: v,
    goToPage: k,
    resolveBlockPage: M,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (W) => {
      z(vn(e.regions, W.blockId));
    }
  });
  const { setModeKeepingPage: T } = Bc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: b
  });
  $(() => {
    z(null);
  }, [d, z]);
  const E = !e.boot.loading && !e.boot.failed, L = V(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), C = V(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), U = V(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: L,
    panes: h,
    sessionFiles: C,
    rowHeights: y,
    goToPage: k,
    activeRegion: P,
    jumpToAnchor: I,
    setModeKeepingPage: T,
    download: e.download,
    showHud: E,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, L, h, C, y, k, P, I, T, E, m, g, f, a, n, u]);
  return V(() => ({
    ...U,
    currentPage: v
  }), [U, v]);
}
const Rl = [
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
], Ml = [
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
function _l(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Rl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Nl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Al = ".reader-notes-panel";
function xl(e) {
  return e instanceof Element ? !!e.closest(Al) : !1;
}
function Ll(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Nl(d.target) || xl(d.target))
        return;
      const m = d.key, g = _l(m);
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
              a(Kt(o, 1));
              return;
            case "zoom-out":
              a(Kt(o, -1));
              return;
            case "zoom-reset":
              a(kt(t, Tt()));
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
const Dl = "retainpdf:soft-reader-close";
function Cl() {
  return new URL("./index.html", window.location.href).href;
}
function $l() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Dl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ol(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function zl() {
  if (!(typeof window > "u") && !$l()) {
    if (Ol(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Cl());
  }
}
function Fl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Bl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ D(Fl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), zl();
  }, children: [
    /* @__PURE__ */ p(gt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const jl = 3e3, Hl = 8;
async function Ul(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Wl(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Kl(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = jl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Wl(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < Hl && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Ul(e, i);
  })), a;
}
function wa(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Sa(e, t) {
  let n = null;
  for (const r of wa(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function Wr(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Kr = !1;
function Vl() {
  if (Kr)
    return;
  const e = Wt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Qo.GlobalWorkerOptions.workerSrc = e, Kr = !0);
}
const at = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), ql = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Jl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Gl = {
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
}, Vr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Xl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Vr(o ?? a ?? "", ql)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Vr(o ?? a ?? "", Jl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Gl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Yl(e) {
  return at(e.translatedBlockText) || at(e.translated.text) || at(e.source.text);
}
const Zl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Ql(e) {
  const t = [];
  for (const n of e) {
    if (!Zl(n)) continue;
    const r = Xl(Yl(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function eu(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const tu = 24, nu = 60;
function qr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - tu), o = Math.min(e.length, n + t.length + nu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function ru(e, t, n = 200) {
  const r = at(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = at(a.translatedBlockText) || at(a.translated.text), c = i ? qr(i, r) : null, l = c ?? qr(at(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function tn(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function $t(e, t) {
  const n = at(t).toLowerCase();
  if (!n || !e) return tn(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${tn(e.slice(a, s))}<mark class="reader-find-mark">${tn(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + tn(e.slice(a));
}
function ou(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const au = /^data-[a-z0-9-]+$/;
function Jr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function su(e, t, n = "") {
  if (!t.length) return $t(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += $t(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => au.test(c)).map(([c, l]) => ` ${c}="${Jr(l)}"`).join("");
    o += `<mark class="${Jr(s.className)}"${i}>${$t(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + $t(e.slice(a), n);
}
function Se(e) {
  return typeof e == "string" ? e : "";
}
function iu(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function cu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function lu(e) {
  return {
    source: Se(e == null ? void 0 : e.source_text) || Se(e == null ? void 0 : e.unit_source_text),
    translated: Se(e == null ? void 0 : e.protected_translated_text) || Se(e == null ? void 0 : e.translated_text)
  };
}
const uu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ka(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function du(e) {
  const t = ka(e).sort((r, o) => Se(r.ts).localeCompare(Se(o.ts)));
  return t.length ? [
    { text: Se(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: Se(r.new_text),
      label: uu[Se(r.source)] || Se(r.source) || "修订",
      ts: Se(r.ts),
      reason: Se(r.reason)
    }))
  ].reverse() : [];
}
function fu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function mu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return Se(r.finished_at) || Se(n.finished_at) || "";
}
function hu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ka(e).sort((a, s) => Se(a.ts).localeCompare(Se(s.ts)));
  for (const a of o) {
    const s = new Date(Se(a.ts)).getTime(), i = Se(a.reader_item_id) || Se(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, Se(a.new_text));
  }
  return n;
}
const pu = {
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
function gu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = pu[Se(n.kind)] || Se(n.kind) || "问题", o = Se(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const bu = /* @__PURE__ */ new Set(["text", "formula"]);
function ar(e) {
  return bu.has(e);
}
function Ia(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || ar(Be(n));
}
function yu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !ar(Be(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const vu = 300, wu = 72;
function Su(e, t) {
  if (e.width >= vu && e.height >= wu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const ku = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Iu(e, t, n) {
  return e.flatMap((r) => {
    if (!ku.has(Be(r.region))) return [];
    const o = pt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Gr(e, t, n) {
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
async function Tu(e) {
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
const Eu = "reader-text-hover-copy", Pu = "reader-text-hover-edit", Ru = "reader-text-hover-zoom", Mu = "reader-text-hover-id";
function _u(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Ta = "reader-text-hover-tools";
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
const Nu = 26, Au = 220;
function xu(e, t = Au) {
  return e.height < Nu * 2 || e.width < t;
}
function Lu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Ko : e === "failed" ? gt : Ds, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Du({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = R("idle"), [u, f] = R("idle"), [d] = R(() => _u()), m = N([]), g = (e == null ? void 0 : e.itemId) || "";
  if ($(() => {
    l("idle"), f("idle");
    const k = m.current;
    return () => {
      k.forEach((P) => window.clearTimeout(P)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = Rs(e.highlight.region, t), b = Be(e.highlight.region), w = (k, P) => async (x) => {
    x.preventDefault(), x.stopPropagation();
    const A = await Tu(k);
    P(A ? "copied" : "failed"), m.current.push(window.setTimeout(() => P("idle"), 1200));
  }, S = b === "formula" ? "复制 LaTeX" : "复制", y = a || e.rect, v = s || (xu(y) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": b,
      style: y,
      children: /* @__PURE__ */ D(
        "div",
        {
          className: Ta,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              nn,
              {
                className: Mu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && ar(b) ? /* @__PURE__ */ p(
              nn,
              {
                className: Pu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Qn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              nn,
              {
                className: Eu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: w(h, l),
                children: /* @__PURE__ */ p(Lu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              nn,
              {
                className: Ru,
                state: "idle",
                label: "放大看这一块",
                title: b === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Ls, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Cu(e, t) {
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
function $u(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = pt(
      Cu(e, a),
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
const Ou = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', zu = 256, Dt = /* @__PURE__ */ new Map();
function Fu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Ea(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ii(t, { bareLatex: !0 }), o = Fu(n), a = ci(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Dt.get(t);
  if (!s && (s = li(o, r), Dt.set(t, s), Dt.size > zu)) {
    const i = Dt.keys().next().value;
    i !== void 0 && Dt.delete(i);
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
function Bu(e, t) {
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
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Ou,
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
function ju(e, t, n, r) {
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
const Hu = 512, Ct = /* @__PURE__ */ new Map();
let Bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Bn += 1;
}));
function Uu(e, t, n, r) {
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
function Pa({ item: e, pageScale: t }) {
  const n = N(null), r = V(
    () => Ea(e.translatedText),
    [e.translatedText]
  ), [o, a] = R(r.fallbackHtml), s = V(
    () => Bu(e, t),
    [e, t]
  );
  $(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Ce(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, b = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - d - g), S = Uu(o, b, w, s);
    let y = Ct.get(S);
    if (y === void 0 && (y = ju(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      b,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ct.set(S, y), Ct.size > Hu)) {
      const v = Ct.keys().next().value;
      v !== void 0 && Ct.delete(v);
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
function Wu({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = V(
    () => $u(e, t, n, r),
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
        Pa,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Ku = Gt(Wu);
function Vu({
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
        Pa,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Be(a.highlight.region),
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
const qu = Gt(Vu), Ra = 24, rt = Ra * 2 + 4, Ye = 24, Ju = 4, Gu = 6, dt = (e) => e.left + e.width, it = (e) => e.top + e.height;
function Ot(e, t) {
  const n = Math.min(dt(e), dt(t)) - Math.max(e.left, t.left), r = Math.min(it(e), it(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Xr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= dt(t) && r >= t.top && r <= it(t);
}, Xu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Yu(e, t, n) {
  if (!t.length || e.height < Ye || e.width < n + 8) return null;
  const r = Math.max(...t.map(it)), o = dt(e) - 4 - n;
  for (const a of [r, it(e) - 2]) {
    const s = Math.max(e.top, a - Ye), i = { left: o, top: s, width: n, height: Ye };
    if (!t.some((c) => Ot(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Zu(e, t) {
  const n = [], r = (a) => {
    const s = Ra + Ju, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: dt(e), top: i, width: s, height: rt } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: rt } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ye - 3, width: rt, height: Ye + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: it(e), width: rt, height: Ye + 3 } }), r(!0);
  const o = Yu(e, t, rt);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: dt(e) - 4 - rt, top: e.top + o, width: rt, height: Ye } }), n;
}
function Qu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !Xu(S)), i = s.filter((S) => Xr(S, t)), c = s.filter((S) => !Xr(S, t)), l = n.filter((S) => S !== t && Ot(S, t) < t.width * t.height * 0.5), u = Zu(t, i).filter(({ box: S, overhang: y }) => {
    const v = y ? Gu : 0;
    return S.left >= -v && dt(S) <= r + v && S.top >= 0 && it(S) <= o;
  }), f = ({ placement: S, tailTop: y }) => y === void 0 ? { placement: S } : { placement: S, tailTop: y }, d = ({ box: S }) => !c.some((y) => Ot(S, y) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((y) => Ot(S.box, y) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let b = null, w = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const y = c.reduce((v, k) => v + Ot(S.box, k), 0);
    y < w && (b = S, w = y);
  }
  return b ? f(b) : { placement: "outside" };
}
function ed(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ye - 3 : it(r);
  return t >= r.left - 4 && t <= r.left + rt + 4 && n >= a && n <= a + Ye + 3;
}
const In = (e) => e.left + e.width, Tn = (e) => e.top + e.height;
function td(e, t, n = 3, r = 6) {
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
function nd(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function rd(e, t, n, r) {
  const [o, a] = R(null);
  return Ce(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? nd(s) : [], c = Be(t.highlight.region) === "figure", l = i.length && !c ? td(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Qu({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function od({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = R(null), [i, c] = R(!1), [l, u] = R([]), [f, d] = R(""), [m, g] = R(""), [h, b] = R(!1), [w, S] = R(null), [y, v] = R([]), k = r.drafts, P = r.generation, x = _(async (I, T) => {
    if (e)
      try {
        u(du(await e.fetchRevisions(I, T)));
      } catch {
        u([]);
      }
  }, [e]);
  $(() => {
    if (s(null), u([]), S(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (I) return;
      const E = T == null ? void 0 : T.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const L = `${(T == null ? void 0 : T.item_id) || n}`, { source: C, translated: U } = lu(E);
      s({ readerItemId: n, itemId: L, source: C, current: U }), d(k.get(n) ?? U);
    }).catch((T) => {
      I || S({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), x(t, n), () => {
      I = !0;
    };
  }, [e, t, n, x]);
  const A = _((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), z = _(async (I, T) => {
    if (!e || !a || h) return !1;
    const E = I ?? f;
    if (!E.trim()) return !1;
    b(!0), S(null), v([]);
    try {
      const L = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ...P.current != null ? { expected_generation: P.current } : {}
      }), C = Number(L == null ? void 0 : L.generation);
      return Number.isFinite(C) && (P.current = C), k.delete(a.readerItemId), s({ ...a, current: E }), d(E), g(""), (L == null ? void 0 : L.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), x(t, a.readerItemId), !0;
    } catch (L) {
      const C = L;
      return (C == null ? void 0 : C.reason) === "generation_mismatch" && (P.current = null), S({ tone: "error", message: (C == null ? void 0 : C.message) || "保存失败，请稍后再试。" }), v(gu(C == null ? void 0 : C.issues)), !1;
    } finally {
      b(!1);
    }
  }, [e, a, h, f, m, t, o, x, k, P]), M = _(() => {
    n && k.delete(n);
  }, [n, k]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: A,
    reason: m,
    setReason: g,
    saving: h,
    status: w,
    issues: y,
    save: z,
    discardDraft: M
  };
}
const Ma = "reader-inline-edit";
function ad({ text: e }) {
  const [t, n] = R("");
  return $(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Ea(e);
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
function sd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var M;
  const s = e.itemId, i = od({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = R(!1), [u, f] = R(!1), d = N(null), m = Su(e.rect, t), g = V(() => yu(o), [o]), h = g.indexOf(s), { loaded: b } = i, w = i.saving || i.loading, S = n.blockedReason, y = !b || i.draft === b.current, { close: v, select: k } = n, P = _((I) => {
    const T = g[h + I];
    T && (k(T), a == null || a(T));
  }, [g, h, k, a]), x = _(() => {
    i.discardDraft(), v();
  }, [i, v]), A = _(async (I, T) => {
    await i.save(I, T) && v();
  }, [i, v]);
  $(() => {
    const I = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), P(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [P]), Ce(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    I.style.height = `${Math.max(T, I.scrollHeight + 2)}px`;
  }, [i.draft, b, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const z = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ D(Oe, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ D(
      "div",
      {
        className: `${Ma} is-${m.mode}`,
        style: z,
        role: "group",
        "aria-label": `改第 ${((M = n.target) == null ? void 0 : M.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (b != null && b.source) ? /* @__PURE__ */ p(
            se,
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
            oi,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), y || A()) : I.key === "Escape" && (I.preventDefault(), x());
              }
            }
          ) : null,
          b ? /* @__PURE__ */ p(ad, { text: i.draft }) : null,
          /* @__PURE__ */ D("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(lt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => P(-1), children: /* @__PURE__ */ p(Cs, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(lt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => P(1), children: /* @__PURE__ */ p(Vo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              Zo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !b,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), y || A()) : I.key === "Escape" && (I.preventDefault(), x());
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
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p($s, { size: 13, "aria-hidden": !0 }),
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
                disabled: w || !!S || y || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  A();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          u && b && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, T) => {
            const E = I.text === b.current, L = [fu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ D("li", { "data-block-edit-history": I.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ D("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ D("span", { children: [
                  L,
                  E ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  se,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      A(I.text, `回到「${L.replace(" · ", " ")}」那一版`);
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
const _a = Xt(null), Na = Xt(null);
function id({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(_a.Provider, { value: e, children: /* @__PURE__ */ p(Na.Provider, { value: t, children: n }) });
}
function tt() {
  return ut(_a);
}
function sr() {
  return ut(Na);
}
const Aa = 1.414;
function cd({
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
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var ee, ge;
  const y = tt(), v = y == null ? void 0 : y.revisedBlocks, k = y == null ? void 0 : y.blockEdit, P = k == null ? void 0 : k.pendingEdits, x = y == null ? void 0 : y.editBlock, A = (y == null ? void 0 : y.findTerm) || "", z = r === "translated" ? "translated" : y != null && y.compareVersion ? "compare" : "source", M = y == null ? void 0 : y.textMarks, I = V(
    () => M ? ({ str: B }) => su(B, M(B), A) : A ? ({ str: B }) => $t(B, A) : void 0,
    [A, M]
  ), T = N(c ?? Aa), [E, L] = R(T.current);
  $(() => {
    c != null && Math.abs(c - T.current) >= 1e-3 && (T.current = c, L(c));
  }, [c]);
  const C = N(u);
  C.current = u;
  const U = N(null), W = N((B) => {
    var te;
    U.current = B, (te = C.current) == null || te.call(C, B);
  }).current, G = N(null), j = N(`${t}@${n}`);
  Ce(() => {
    const B = `${t}@${n}`;
    j.current !== B && (j.current = B, o && ud(U.current, G.current));
  }, [o, n, t]), $(() => {
    o || En(G.current);
  }, [o]), $(() => () => En(G.current), []);
  const J = Math.max(120, Math.floor(t * E)), X = Math.max(J, Math.ceil(s || 0)), pe = pt(f, t, J), Q = V(
    () => Iu(d, t, J),
    [J, d, t]
  ), [ue, Re] = R(null), ce = typeof g == "function", oe = ce ? m ?? null : ue, F = (B) => {
    ce ? B !== (m ?? null) && (g == null || g(B)) : Re((te) => te === B ? te : B);
  }, K = V(
    () => Q.find((B) => B.itemId === oe) || null,
    [oe, Q]
  ), Y = r === "translated" && ((ee = k == null ? void 0 : k.target) == null ? void 0 : ee.itemId) || "", fe = V(
    () => Y && Q.find((B) => B.itemId === Y) || null,
    [Y, Q]
  ), ie = rd(U, o ? K : null, Q, t), me = (B) => {
    var Ae, xe, $e, je;
    if (B.pointerType === "touch") return;
    if (y != null && y.pointerTaken) {
      F(null);
      return;
    }
    if (B.buttons !== 0) {
      F(null);
      return;
    }
    if ((xe = (Ae = B.target) == null ? void 0 : Ae.closest) != null && xe.call(Ae, `.${Ta}`) || (je = ($e = B.target) == null ? void 0 : $e.closest) != null && je.call($e, `.${Ma}`)) return;
    const te = B.currentTarget.getBoundingClientRect(), he = B.clientX - te.left, Me = B.clientY - te.top;
    if (ed(ie, he, Me)) return;
    const _e = Gr(Q, he, Me);
    F((_e == null ? void 0 : _e.itemId) || null);
  }, ke = (B) => {
    if (B.pointerType === "mouse") return;
    const te = B.currentTarget.getBoundingClientRect(), he = Gr(
      Q,
      B.clientX - te.left,
      B.clientY - te.top
    );
    F((he == null ? void 0 : he.itemId) || null);
  }, le = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(T.current - B) < 1e-3 || (T.current = B, L(B), l == null || l(e, B));
  };
  return /* @__PURE__ */ D(
    "div",
    {
      ref: W,
      [Te]: e,
      [Ie]: r,
      [er]: J,
      className: tr,
      onPointerMoveCapture: me,
      onPointerDown: ke,
      onDoubleClick: (B) => {
        const te = y == null ? void 0 : y.zoomBlock;
        !te || y != null && y.pointerTaken || !K || Be(K.highlight.region) === "figure" && (B.preventDefault(), te(K.itemId));
      },
      onPointerLeave: (B) => {
        B.pointerType === "mouse" && F(null);
      },
      style: {
        width: t,
        height: X,
        minHeight: X
      },
      children: [
        o ? /* @__PURE__ */ p(
          ai,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: I,
            renderAnnotationLayer: !1,
            className: oa,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: ln,
                style: { width: t, height: J }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const te = B.getViewport({ scale: 1 });
                if (te.width > 0) {
                  const he = te.height / te.width;
                  le(he);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              En(G.current), i == null || i();
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
        o ? /* @__PURE__ */ p("div", { ref: G, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        pe ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: pe,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Ku,
          {
            layoutPage: h,
            pageState: b,
            width: t,
            height: J
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ p(qu, { targets: Q, edits: P, width: t, excludeId: fe == null ? void 0 : fe.itemId }) : null,
        o && fe && k ? /* @__PURE__ */ p(
          sd,
          {
            target: fe,
            page: { width: t, height: J },
            edit: k,
            showSource: !!(y != null && y.editShowsSource),
            regions: y == null ? void 0 : y.regions,
            jumpToBlock: y == null ? void 0 : y.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: Q.filter((B) => v.has(B.itemId)).map((B) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": B.itemId,
            style: { left: B.rect.left, top: B.rect.top, height: B.rect.height }
          },
          B.itemId
        )) }) : null,
        (ge = y == null ? void 0 : y.pageLayers) == null ? void 0 : ge.map((B) => /* @__PURE__ */ p(Yn, { children: B.render({ page: e, width: t, height: J, pane: z, active: o }) }, B.id)),
        /* @__PURE__ */ p(
          Du,
          {
            target: o && !(y != null && y.pointerTaken) && (K == null ? void 0 : K.itemId) !== (fe == null ? void 0 : fe.itemId) ? K : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: K && (v == null ? void 0 : v.get(K.itemId)) || 0,
            onEdit: x,
            onZoom: y == null ? void 0 : y.zoomBlock,
            frameRect: ie == null ? void 0 : ie.rect,
            placement: ie == null ? void 0 : ie.placement,
            tailTop: ie == null ? void 0 : ie.tailTop
          }
        )
      ]
    }
  );
}
const ld = Gt(cd);
function ud(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function En(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const dd = 2 * 1024 * 1024;
function fd(e) {
  const t = new Qo.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const Pn = 5, md = "120% 0px", hd = 120, pd = "25% 0px";
let Yr = 1;
const Zr = /* @__PURE__ */ new WeakMap();
function gd(e) {
  if (!e) return 0;
  const t = Zr.get(e);
  if (t) return t;
  const n = Yr;
  return Yr += 1, Zr.set(e, n), n;
}
function bd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const yd = Bo(
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
    regions: w = [],
    readerMetadata: S = null,
    hoveredRegionId: y = null,
    onHoverRegion: v,
    liveTranslation: k,
    showLiveTranslation: P = t === "source",
    liveTranslationPendingLabel: x = "",
    paneAction: A
  }, z) {
    Vl();
    const { file: M, loading: I, error: T } = Wi(n, r), E = `${n}\0${gd(M)}`, L = N(E);
    L.current = E;
    const C = V(() => {
      const H = zi(M);
      return H ? "ranged" in H ? { range: fd(H.ranged) } : H : null;
    }, [M, n]), [U, W] = R(0), [G, j] = R(""), [J, X] = R(null), [pe, Q] = R(480), ue = N(null), Re = N(0), ce = V(() => bd(), []), oe = V(() => ({
      cMapUrl: Wt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Wt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: dd,
      disableAutoFetch: !0
    }), []);
    Zn(z, () => J, [J]), $(() => {
      const H = (Z) => {
        Re.current = Z, Q(Z);
      }, re = (Z) => {
        const ye = fc(Z, Re.current);
        if (ye !== "ignore") {
          if (ue.current && clearTimeout(ue.current), ye === "immediate") {
            H(Z);
            return;
          }
          ue.current = setTimeout(() => H(Z), la);
        }
      }, ne = !!(c && c >= 80);
      re(ne ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ve = !ne && i && typeof ResizeObserver < "u" ? new ResizeObserver((Z) => {
        var ye, Ee;
        re(((Ee = (ye = Z[0]) == null ? void 0 : ye.contentRect) == null ? void 0 : Ee.width) ?? i.clientWidth);
      }) : null;
      return ve && i && ve.observe(i), () => {
        ve == null || ve.disconnect(), ue.current && clearTimeout(ue.current);
      };
    }, [c, i, a]);
    const F = V(
      () => lc(pe, o),
      [pe, o]
    ), [K, Y] = R(() => /* @__PURE__ */ new Map()), [fe, ie] = R(() => /* @__PURE__ */ new Set()), [me, ke] = R(() => /* @__PURE__ */ new Set()), le = N(/* @__PURE__ */ new Map()), ee = N(null), ge = N(null), [B, te] = R(() => /* @__PURE__ */ new Set()), he = N(/* @__PURE__ */ new Map()), Me = _((H, re) => {
      Y((ne) => {
        if (ne.get(H) === re) return ne;
        const de = new Map(ne);
        return de.set(H, re), de;
      });
    }, []), _e = _((H, re) => {
      const ne = le.current, de = ne.get(H), ve = [ee.current, ge.current];
      if (de)
        for (const Z of ve)
          try {
            Z == null || Z.unobserve(de);
          } catch {
          }
      if (re) {
        ne.set(H, re);
        for (const Z of ve)
          try {
            Z == null || Z.observe(re);
          } catch {
          }
      } else
        ne.delete(H);
    }, []), Ae = N(/* @__PURE__ */ new Map()), xe = _((H) => {
      const re = Ae.current;
      let ne = re.get(H);
      return ne || (ne = (de) => _e(H, de), re.set(H, ne)), ne;
    }, [_e]);
    $(() => {
      if (typeof IntersectionObserver > "u") return;
      const H = he.current, re = new IntersectionObserver(
        (ne) => {
          const de = [], ve = [];
          for (const Z of ne) {
            const ye = Z.target, Ee = dn(ye);
            Number.isFinite(Ee) && (Z.isIntersecting ? de : ve).push(Ee);
          }
          if ((de.length || ve.length) && ie((Z) => {
            let ye = null;
            for (const Ee of de)
              Z.has(Ee) || (ye = ye || new Set(Z), ye.add(Ee));
            for (const Ee of ve)
              Z.has(Ee) && (ye = ye || new Set(Z), ye.delete(Ee));
            return ye || Z;
          }), de.length) {
            for (const Z of de) {
              const ye = H.get(Z);
              ye && (clearTimeout(ye), H.delete(Z));
            }
            ke((Z) => {
              let ye = null;
              for (const Ee of de)
                Z.has(Ee) || (ye = ye || new Set(Z), ye.add(Ee));
              return ye || Z;
            });
          }
          for (const Z of ve)
            H.has(Z) || H.set(Z, setTimeout(() => {
              H.delete(Z), ke((ye) => {
                if (!ye.has(Z)) return ye;
                const Ee = new Set(ye);
                return Ee.delete(Z), Ee;
              });
            }, hd));
        },
        { root: i, rootMargin: md, threshold: 0 }
      );
      ee.current = re;
      for (const ne of le.current.values())
        try {
          re.observe(ne);
        } catch {
        }
      return () => {
        re.disconnect(), ee.current === re && (ee.current = null);
        for (const ne of H.values()) clearTimeout(ne);
        H.clear();
      };
    }, [i]), $(() => {
      if (typeof IntersectionObserver > "u") return;
      const H = new IntersectionObserver(
        (re) => {
          te((ne) => {
            let de = null;
            for (const ve of re) {
              const Z = dn(ve.target);
              !Number.isFinite(Z) || ve.isIntersecting === ne.has(Z) || (de = de || new Set(ne), ve.isIntersecting ? de.add(Z) : de.delete(Z));
            }
            return de || ne;
          });
        },
        { root: i, rootMargin: pd, threshold: 0 }
      );
      ge.current = H;
      for (const re of le.current.values())
        try {
          H.observe(re);
        } catch {
        }
      return () => {
        H.disconnect(), ge.current === H && (ge.current = null);
      };
    }, [i]);
    const $e = !!i && typeof IntersectionObserver < "u";
    Ce(() => {
      W(0), j(""), ie(/* @__PURE__ */ new Set()), ke(/* @__PURE__ */ new Set()), Y(/* @__PURE__ */ new Map()), le.current.clear();
      const H = he.current;
      for (const re of H.values()) clearTimeout(re);
      H.clear(), h == null || h(0, t);
    }, [E, h, t]);
    const je = _(
      (H) => {
        if (L.current !== E) return;
        const re = H.numPages;
        W(re), j(""), h == null || h(re, t), f == null || f({ numPages: re, pane: t }), m && typeof H.getPage == "function" && m(H, t), d && typeof H.getOutline == "function" && Kl(H).then((ne) => {
          L.current === E && d(ne, t);
        }, () => {
        });
      },
      [E, f, d, m, h, t]
    ), Ue = _(
      (H) => {
        if (L.current !== E) return;
        const re = (H == null ? void 0 : H.message) || "PDF 解析失败";
        j(re), W(0), h == null || h(0, t), g == null || g(H, t);
      },
      [E, g, h, t]
    ), O = V(
      () => U > 0 ? Array.from({ length: U }, (H, re) => re + 1) : [],
      [U]
    );
    $(() => {
      typeof IntersectionObserver < "u" || ke(new Set(O));
    }, [O]);
    const q = V(
      () => Rt(b, S, t),
      [b, S, t]
    ), ae = V(() => {
      const H = /* @__PURE__ */ new Map();
      for (const re of w) {
        const ne = Rt(re, S, t);
        if (!ne) continue;
        const de = H.get(ne.box.page) || [];
        de.push(ne), H.set(ne.box.page, de);
      }
      return H;
    }, [t, S, w]), we = V(() => {
      const H = /* @__PURE__ */ new Set();
      if (!y) return H;
      for (const [re, ne] of ae)
        ne.some((de) => de.itemId === y) && H.add(re);
      return H;
    }, [y, ae]), Le = V(() => {
      if (U === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(O);
      if (fe.size === 0) {
        const ne = Math.min(U, Pn * 2 + 1);
        return new Set(Array.from({ length: ne }, (de, ve) => ve + 1));
      }
      const re = /* @__PURE__ */ new Set();
      for (const ne of fe)
        for (let de = -Pn; de <= Pn; de++) {
          const ve = ne + de;
          ve >= 1 && ve <= U && re.add(ve);
        }
      return re;
    }, [U, O, i, a, fe]), De = !n || !!T || !!G, qe = n && (T || G) || s;
    return /* @__PURE__ */ D(
      "section",
      {
        ref: X,
        className: `reader-panel ${pn}${a ? "" : " is-hidden"}`,
        [Ie]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          A ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: A }) : null,
          x ? /* @__PURE__ */ D("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: x })
          ] }) : null,
          De && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: qe }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          C && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            si,
            {
              file: C,
              loading: null,
              error: null,
              options: oe,
              onLoadSuccess: je,
              onLoadError: Ue,
              className: "reader-react-pdf-document",
              children: O.map((H) => {
                if (Le.has(H))
                  return /* @__PURE__ */ p(
                    ld,
                    {
                      pane: t,
                      pageNumber: H,
                      width: F,
                      devicePixelRatio: ce,
                      active: me.has(H),
                      textLayer: !$e || B.has(H),
                      syncedMinHeight: (l == null ? void 0 : l.get(H)) || 0,
                      onMetrics: u,
                      cachedAspect: K.get(H),
                      onAspectChange: Me,
                      sentinelRef: xe(H),
                      regionHighlight: (q == null ? void 0 : q.box.page) === H ? q : null,
                      regionTargets: ae.get(H),
                      hoveredRegionId: y && we.has(H) ? y : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(H - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(H - 1),
                      showLiveTranslation: P,
                      liveTranslationMissing: pl(k, H - 1)
                    },
                    `${t}-${H}`
                  );
                const ne = K.get(H) ?? Aa, de = Math.max(120, Math.floor(F * ne)), ve = Math.max(de, Math.ceil((l == null ? void 0 : l.get(H)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: xe(H),
                    [Te]: H,
                    [Ie]: t,
                    [er]: de,
                    className: `${tr} is-placeholder`,
                    style: {
                      width: F,
                      height: ve,
                      minHeight: ve
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
                  `${t}-${H}`
                );
              })
            },
            E
          ) }) : null
        ]
      }
    );
  }
), Qr = Gt(yd), vd = 2e3, wd = 6, Sd = 500, eo = "reader-react-resizing";
function kd(e, t) {
  const n = N(null), r = N(null);
  Ce(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = Id(e), k = Bt(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const b = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const P of v) {
        const x = Math.round(P.contentRect.height);
        b.has(P.target) && b.get(P.target) !== x && (k = !0), b.set(P.target, x);
      }
      k && Mt(e, c, "auto", i);
    }), S = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(eo);
      for (const k of to) e.removeEventListener(k, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, y = () => {
      Mt(e, c, "auto", i);
      const v = e.scrollHeight;
      g = v === m ? g + 1 : 0, m = v;
      const k = performance.now() - h;
      g >= wd && (v !== d || k > Sd) || k > vd ? S() : u = requestAnimationFrame(y);
    };
    for (const v of to) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(eo), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(y);
    }, la);
  }, [e, t]), $(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Id(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Te}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ie) || null;
  }
  return null;
}
const to = ["wheel", "touchstart", "keydown", "pointerdown"];
function Td(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Ed(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(pn)) && ((n = e.hasAttribute) != null && n.call(e, Ie)));
}
function Pd(e, t) {
  $(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Ed(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${pn}[${Ie}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = Td(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Rd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Md(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const no = 12;
function ir(e) {
  return Array.from(e.querySelectorAll(`.${pn}[${Ie}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function _d(e) {
  const t = e.getBoundingClientRect();
  return ir(e).map((n) => {
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
function Nd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Ad(e, t) {
  return e ? ir(e).find((n) => n.getAttribute(Ie) === t) ?? null : null;
}
function xd({ shellEl: e }) {
  const [t, n] = R([]), r = N(0), o = _(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = _d(e);
      n((i) => Nd(i, s) ? i : s);
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
        for (const f of ir(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Ld, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Ld({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - no * 2), r = Rd(e, n), o = N(null);
  if (!r) return null;
  const a = (d) => {
    const m = Ad(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + Md(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + no, width: n },
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
function xa(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Dd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Cd({ compare: e, onDone: t }) {
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: xa(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Ko, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Os, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
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
            /* @__PURE__ */ p(qo, { size: 13, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(zs, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function ro({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Dd(t), a = [e === "compare" ? "对比" : "正在读", r, xa(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ D("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function $d({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = R({ source: null, translated: null });
  return Ce(() => {
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
  }, [e]), /* @__PURE__ */ D("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(ro, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(ro, { role: "reading", ...n }) }) : null
  ] });
}
const Od = () => () => {
}, oo = () => null;
function zd({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Fd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Bd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function jd(e) {
  const t = tt(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), b = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, y = (t == null ? void 0 : t.compareVersion) ?? null, v = (y == null ? void 0 : y.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = y ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, x = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, A = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), z = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), M = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], L = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), C = (t == null ? void 0 : t.regionHover) ?? null, [U, W] = R(null), G = hn(
    C ? C.subscribe : Od,
    C ? () => C.get().itemId : oo,
    C ? () => C.get().itemId : oo
  ), j = C ? G : U, J = _((ue) => {
    C ? C.set(ue, "pdf") : W(ue);
  }, [C]), X = zd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), Q = Number.isFinite(g) && g > 0 ? Fd(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !X.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return kd(d, Q), Pd(d, X.compareMode), /* @__PURE__ */ D(
    "div",
    {
      ref: f,
      className: ra,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(Ms).length,
      "data-reader-metadata-ready": L ? "true" : "false",
      children: [
        /* @__PURE__ */ D(
          "main",
          {
            className: `${na} reader-mode-${X.mode}`,
            "data-reader-mode": X.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              b ? /* @__PURE__ */ p(
                Qr,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: P,
                  userZoom: m,
                  visible: X.showSource,
                  scrollRoot: d,
                  pageWidthOverride: Q,
                  rowHeights: X.compareMode ? h : void 0,
                  onMetrics: A,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: z,
                  onOutline: y ? void 0 : M,
                  onDocument: y ? void 0 : I,
                  activeRegion: T,
                  regions: (y == null ? void 0 : y.regions) ?? E,
                  readerMetadata: L,
                  hoveredRegionId: j,
                  onHoverRegion: J,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Bd(o) : "",
                  paneAction: u && X.showTranslated ? /* @__PURE__ */ D(Oe, { children: [
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
              w ? /* @__PURE__ */ p(
                Qr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: x,
                  userZoom: m,
                  visible: X.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: Q,
                  rowHeights: X.compareMode ? h : void 0,
                  onMetrics: A,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: z,
                  onOutline: M,
                  onDocument: I,
                  activeRegion: T,
                  regions: E,
                  readerMetadata: L,
                  hoveredRegionId: j,
                  onHoverRegion: J,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(xd, { shellEl: d }),
        y ? /* @__PURE__ */ p($d, { shellEl: d, left: y.left, right: y.right }) : null
      ]
    }
  );
}
const Hd = [
  { id: "source", label: "原文", Icon: Jo },
  { id: "compare", label: "对照", Icon: Go },
  { id: "translated", label: "译文", Icon: Xo }
];
function Ud(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Wd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Kd(e) {
  const t = tt(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Ud(a.state) : "";
  return /* @__PURE__ */ D("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ D("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Hd.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = Wd({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ D(
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
              /* @__PURE__ */ p(Fs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
              /* @__PURE__ */ p(Bs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(js, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const La = [];
function Vd() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = La;
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
function qd(e, t) {
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
function Jd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function Gd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Xd(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function Yd(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function Zd(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function Qd(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function ef(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const bn = Xt(null), Da = Xt(null);
function tf({ api: e, store: t, children: n }) {
  const r = V(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(bn.Provider, { value: r, children: n });
}
function Zt() {
  const e = ut(bn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const nf = () => () => {
}, ao = () => La;
function rf(e) {
  return hn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Ca() {
  var t;
  const e = (t = ut(bn)) == null ? void 0 : t.store;
  return hn((e == null ? void 0 : e.subscribe) ?? nf, (e == null ? void 0 : e.getSnapshot) ?? ao, (e == null ? void 0 : e.getSnapshot) ?? ao);
}
function yn(e) {
  var a;
  const t = (a = ut(bn)) == null ? void 0 : a.store, n = ut(Da);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  $(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), $(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class of extends bs {
  constructor() {
    super(...arguments);
    Pr(this, "state", { failed: !1 });
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
const af = Gt(function({ extensions: t }) {
  return /* @__PURE__ */ p(Oe, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(of, { id: n, children: /* @__PURE__ */ p(sf, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function sf({ id: e, title: t, children: n }) {
  const r = V(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(Da.Provider, { value: r, children: n });
}
function cf({
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
const so = 6e3;
function $a(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Oa(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > so && (s *= so / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function za({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = N(null), [i, c] = R({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return $(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = Oa(n, m, r, g), b = s.current, w = b == null ? void 0 : b.getContext("2d");
        if (!b || !w) return;
        b.width = h.canvasWidth, b.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const S = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), y = d.render({ canvasContext: w, viewport: S });
        f = y, await y.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
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
const lf = 1600, cr = { left: 0, top: 0, width: 1, height: 1 };
function Fa(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function uf(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function df(e, t, n = cr, r = lf) {
  const o = await e.getPage(t), a = Oa(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, Fa(s);
}
async function ff(e, t = cr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), Fa(s);
}
function mf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const hf = 4e3;
function pf(e, t, n) {
  if (e.length) {
    const o = Sa(e, n), a = o ? wa(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function io(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Te}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, hf), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function gf(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Rt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = pt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function bf({
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
  const l = e.getAttribute(Ie) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? gf(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: pf(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
function yf(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Te}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Te)) || 0, i = (o.closest(`[${Ie}]`) ?? o).getAttribute(Ie) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function vf({ onDone: e, onCancel: t }) {
  const [n, r] = R(null), o = N(null), a = N(null);
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
      return yf(c, l);
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
        const f = uf(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const co = 5e4, wf = 2e4;
function Rn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Ng(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Sf(e, t = null) {
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
function kf(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function If(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function Ag(e, t) {
  var r;
  const n = If(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function xg(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function Tf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Ef(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Ef(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Pf(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Tf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: kf(o.selection, n),
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
function Rf(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Rn(e.question.text, co), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Rn(e.answer.text, co),
      thought: e.answer.thought ? Rn(e.answer.thought, wf) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Mf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function _f(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Nf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Af(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const xf = 50, Ba = 2, Mn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Lf() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function lo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Df({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = R(!1), [i, c] = R(Mn), [l, u] = R(!1), [f, d] = R(""), [m, g] = R("idle"), [h, b] = R(null), [w, S] = R([]), y = _((F) => {
    b(F), S([]);
  }, []), v = _((F) => S((K) => [...K, F].slice(-Ba)), []), [k, P] = R(() => /* @__PURE__ */ new Map()), x = N(/* @__PURE__ */ new Set()), A = N(/* @__PURE__ */ new Map()), z = (F) => {
    if (!F) return null;
    const K = A.current.get(F);
    return K || (M.current.records.some((Y) => Y.message_id === F) ? F : null);
  }, M = N(i);
  M.current = i;
  const I = N(t);
  I.current = t;
  const T = N(0), E = _(async (F, K, Y, fe = []) => {
    if (!r) return;
    const ie = await r.messages(F.conversation_id, { limit: xf, ...Y ? { beforeSeq: Y } : {} }), me = [...ie.messages, ...fe];
    T.current += 1, c({
      conversation: F,
      main: K ?? F,
      records: me,
      compactions: ie.compactions || [],
      hasMore: ie.has_more,
      key: `${F.conversation_id}:${T.current}`,
      initial: Pf(me, ie.compactions || [], I.current.documentId)
    });
  }, [r]), L = _(async () => {
    s(!0);
    const F = M.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) === "main" && F.status !== "archived")) {
      u(!0), d("");
      try {
        const K = await r.main(I.current.documentId || void 0);
        await E(K, K);
      } catch (K) {
        d(K instanceof Error ? K.message : String(K));
      } finally {
        u(!1);
      }
    }
  }, [r, E]), C = _((F) => {
    y(F), L();
  }, [L]), U = N(t.documentId);
  $(() => {
    U.current !== t.documentId && (U.current = t.documentId, M.current = Mn, c(Mn), y(null), P(/* @__PURE__ */ new Map()), A.current.clear(), a && L());
  }, [t.documentId, a, L]);
  const W = _(async () => {
    const F = M.current, K = F.records[0];
    if (!(!F.conversation || !K || !F.hasMore)) {
      u(!0);
      try {
        await E(F.conversation, F.main, K.seq, F.records);
      } finally {
        u(!1);
      }
    }
  }, [E]), G = _(async (F) => {
    const Y = M.current.conversation;
    if (!r || !Y) return;
    for (const ee of F.memoryIds) x.current.add(ee);
    let fe = F.memoryIds;
    if (!fe.length && o && F.startedAt) {
      const ee = _f(
        await o.list({ source_conversation_id: Y.conversation_id, created_after: Mf(F.startedAt) }).catch(() => []),
        x.current
      );
      for (const B of ee) x.current.add(B.id);
      fe = ee.map((B) => B.id);
      const ge = F.answerId;
      ee.length && ge && P((B) => new Map(B).set(ge, ee));
    }
    const ie = Rf({ ...F, memoryIds: fe }, I.current.documentId, Lf(), z(F.editedFrom));
    let me;
    try {
      me = await r.append(Y.conversation_id, ie);
    } catch (ee) {
      if (Y.kind !== "side" || !/ask_conversation_not_open/.test(lo(ee))) throw ee;
      await r.reopen(Y.conversation_id), me = await r.append(Y.conversation_id, ie);
    }
    const [ke, le] = me.messages;
    F.questionId && ke && A.current.set(F.questionId, ke.message_id), F.answerId && le && A.current.set(F.answerId, le.message_id), c((ee) => {
      var ge;
      return ((ge = ee.conversation) == null ? void 0 : ge.conversation_id) === Y.conversation_id ? { ...ee, conversation: me.conversation, records: [...ee.records, ...me.messages] } : ee;
    }), n == null || n(me.messages), me.compaction_due && Y.kind === "main" && r.compact(Y.conversation_id).catch(() => {
    });
  }, [r, o, n]), j = _(async (F) => {
    const K = M.current.conversation, Y = z(F);
    if (!r || !K || !Y) return null;
    try {
      await r.supersede(K.conversation_id, Y);
    } catch (me) {
      if (!/ask_message_superseded/.test(lo(me))) throw me;
    }
    const fe = M.current.records.find((me) => me.message_id === Y), ie = M.current.records.findIndex((me) => me.message_id === Y);
    return c((me) => ({ ...me, records: me.records.map((ke, le) => le >= ie && ie >= 0 && !ke.superseded_at ? { ...ke, superseded_at: "now" } : ke) })), (fe == null ? void 0 : fe.selection) ?? null;
  }, [r]), J = _((F) => {
    G(F).catch((K) => d(`这一轮没存上：${K instanceof Error ? K.message : String(K)}`));
  }, [G]), X = _(async (F) => {
    var fe;
    const K = M.current, Y = K.main;
    if (!(!r || !Y || ((fe = K.conversation) == null ? void 0 : fe.kind) !== "main")) {
      d("");
      try {
        const ie = Nf(K.records, F), me = await r.fork({
          parent_id: Y.conversation_id,
          ...ie ? { forked_from_message_id: ie } : {},
          title: Af(F.text),
          ...I.current.documentId ? { document_id: I.current.documentId } : {}
        });
        await E(me, Y);
      } catch (ie) {
        d(`开不了副对话：${ie instanceof Error ? ie.message : String(ie)}`);
      }
    }
  }, [r, E]), pe = _(async (F) => {
    const K = M.current.main;
    if (r)
      try {
        await E(await r.get(F), K);
      } catch (Y) {
        d(`打不开副对话：${Y instanceof Error ? Y.message : String(Y)}`);
      }
  }, [r, E]), Q = _(async () => {
    const F = M.current.main;
    F && await E(F, F).catch(() => {
    });
  }, [E]), ue = _(async () => {
    const F = M.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) !== "side")) {
      g("busy");
      try {
        await r.close(F.conversation_id), g("idle"), await Q();
      } catch {
        g("failed");
      }
    }
  }, [r, Q]), Re = _(async () => r != null && r.archived ? r.archived(I.current.documentId) : [], [r]), ce = _(async (F) => {
    d(""), y(null);
    try {
      await E(F, M.current.main);
    } catch (K) {
      d(`打不开这个对话：${K instanceof Error ? K.message : String(K)}`);
    }
  }, [E, y]), oe = _(async () => {
    const F = M.current.main;
    if (!r || !F) return;
    await r.archive(F.conversation_id);
    const K = await r.main(I.current.documentId || void 0);
    await E(K, K);
  }, [r, E]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: f,
    pending: h,
    setPending: y,
    extras: w,
    addExtra: v,
    closingSide: m,
    notices: k,
    persistent: !!r,
    openMain: L,
    ask: C,
    close: _(() => s(!1), []),
    loadEarlier: W,
    onTurn: J,
    rewrite: j,
    fork: X,
    openSide: pe,
    backToMain: Q,
    closeSide: ue,
    archiveMain: oe,
    listArchived: Re,
    viewArchived: ce,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function uo(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Sf({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Cf({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = R([]), s = N(0), i = N(r);
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
      (h) => d(h.map((b) => uo(b, c(), i.current)).filter((b) => !!b)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = _((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => uo(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = _((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const $f = Ho(() => import("./ReaderAskPanel-Qs0E2cui.js"));
function Of({
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
  activePanel: b = null
}) {
  var Ue;
  const w = V(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), S = _((O, q, ae) => {
    const we = O ? o.find((qe) => qe.itemId === O) : null, Le = we ? Rt(we, a, q) : null, De = Le && Le.box.page === ae ? pt(Le, 1, 1) : null;
    return De ? { x: De.left, y: De.top } : null;
  }, [o, a]), y = Cf({ port: e, documentId: t, resetKey: c, pointOf: S }), v = Df({ port: e, book: w, onAppended: y.addRecords }), [k, P] = R(null), x = _(
    (O, q, ae, we) => bf({
      pageElement: (O == null ? void 0 : O.closest(`[${Te}]`)) ?? null,
      clientX: q,
      clientY: ae,
      itemId: i(),
      selection: we,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), A = _(() => {
    var q;
    const O = io(((q = globalThis.getSelection) == null ? void 0 : q.call(globalThis)) ?? null);
    return !O.text || !O.element || !O.rect ? null : x(O.element, O.rect.left + O.rect.width / 2, O.rect.top + O.rect.height / 2, O.text);
  }, [x]), z = _((O) => {
    P(null), v.ask(O);
  }, [v.ask]);
  $(() => {
    if (!e) return;
    const O = (q) => {
      var Le;
      if (q.key !== "?" || q.metaKey || q.ctrlKey || q.altKey || q.defaultPrevented) return;
      const ae = q.target;
      if ((Le = ae == null ? void 0 : ae.closest) != null && Le.call(ae, "input, textarea, select, [contenteditable='true']")) return;
      const we = A();
      we && (q.preventDefault(), q.stopImmediatePropagation(), z(we));
    };
    return window.addEventListener("keydown", O, !0), () => window.removeEventListener("keydown", O, !0);
  }, [e, A, z]);
  const M = N(/* @__PURE__ */ new Set()), I = ((Ue = v.pending) == null ? void 0 : Ue.selection) || "";
  $(() => {
    I && M.current.add(I);
  }, [I]);
  const T = v.visible && !k, E = v.setPending, [L, C] = R(null), U = !!v.pending;
  $(() => {
    U || C(null);
  }, [U]);
  const W = N(v.pending);
  W.current = v.pending, $(() => {
    if (!T) return;
    let O = null;
    const q = () => {
      O && clearTimeout(O), O = setTimeout(() => {
        const ae = A();
        !ae || M.current.has(ae.selection) || (W.current ? C(ae) : E(ae));
      }, 250);
    };
    return document.addEventListener("selectionchange", q), () => {
      O && clearTimeout(O), document.removeEventListener("selectionchange", q);
    };
  }, [T, A, E]);
  const G = v.addExtra, j = v.extras.length, J = V(() => {
    if (!L) return null;
    const O = () => {
      M.current.add(L.selection), C(null);
    };
    return {
      label: `第 ${L.page} 页 · ${[...L.selection].length} 字`,
      replace: () => {
        O(), E(L);
      },
      ...j < Ba ? { add: () => {
        O(), G(L);
      } } : {},
      dismiss: O
    };
  }, [L, j, E, G]), X = N(m);
  X.current = m;
  const pe = _(async ({ page: O, pane: q, region: ae, canvas: we }) => {
    const Le = X.current[q];
    let De;
    if (Le)
      De = await df(Le, O, ae);
    else {
      const qe = we ?? document.querySelector(`[${Ie}="${q}"] [${Te}="${O}"] canvas`);
      if (!qe) throw new Error(`第 ${O} 页还没画出来，翻到那一页再试`);
      De = await ff(qe, ae);
    }
    return new File([De], mf(O, ae), { type: "image/png" });
  }, []), [Q, ue] = R(null), Re = N(v.pending);
  Re.current = v.pending;
  const ce = V(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(Hs, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const O = Re.current, q = (O == null ? void 0 : O.pane) || (h === "translated" ? "translated" : "source");
      return pe({ page: (O == null ? void 0 : O.page) || g() || 1, pane: q, region: cr });
    }
  }], [pe, g, h]), [oe, F] = R(!1), [K, Y] = R(""), fe = _(async (O) => {
    F(!1), Y("");
    try {
      const q = await pe(O), ae = x(O.point.target, O.point.x, O.point.y, "");
      ue((we) => ({ id: ((we == null ? void 0 : we.id) || 0) + 1, files: [q] })), ae ? z({ ...ae, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (q) {
      Y(q instanceof Error ? q.message : String(q));
    }
  }, [pe, x, z]), ie = _(() => F(!1), []), me = _(async (O) => {
    if (O.threadId && (e != null && e.threads) && t) {
      try {
        const q = await e.threads.get(t, O.threadId);
        P({ anchor: q.anchor || O.anchor, messages: q.messages || [], mark: O });
      } catch {
        P({ anchor: O.anchor, messages: [], mark: O });
      }
      return;
    }
    P(null), v.openMain();
  }, [e, t, v.openMain]), ke = _((O) => {
    var we;
    if (!e) return [];
    const q = io(((we = globalThis.getSelection) == null ? void 0 : we.call(globalThis)) ?? null), ae = x(O.target, O.clientX, O.clientY, q.element ? q.text : "");
    return ae ? [{
      key: "ask",
      label: ae.selection ? "问这段" : "在这里提问",
      hint: ae.selection ? "?" : void 0,
      onSelect: () => z(ae)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        Y(""), F(!0);
      }
    }] : [];
  }, [e, x, z]), le = k ? {
    anchor: k.anchor,
    messages: k.messages,
    onClose: () => P(null),
    onDelete: e != null && e.threads && k.mark.threadId ? () => {
      e.threads.remove(t, k.mark.threadId).catch(() => {
      }), y.removeMark(k.mark.key), P(null);
    } : void 0
  } : null, ee = V(() => f ? (O, q) => {
    f(O, q ?? void 0), requestAnimationFrame(() => d(O, "translated"));
  } : null, [f, d]), ge = _((O) => Ia(o, O), [o]), [B, te] = R(0), he = _(({ mode: O, width: q }) => {
    const ae = globalThis.innerWidth || 0;
    te(O === "dock" && ae - q >= 480 ? Math.round(q) : 0);
  }, []), Me = !v.persistent || !!v.view.conversation || !!v.error, _e = e && (v.visible && Me || k) ? /* @__PURE__ */ p(jo, { fallback: null, children: /* @__PURE__ */ p(
    $f,
    {
      port: e,
      jobId: n,
      book: w,
      ask: v,
      legacy: le,
      onShowSelection: ({ page: O, pane: q }) => l(O, q),
      onJumpToPage: (O) => l(O),
      pageCount: u,
      onLayout: he,
      dockTaken: b !== null,
      onEditBlock: ee,
      canEditBlock: ge,
      attachTools: ce,
      attachRequest: Q,
      contextOffer: J
    }
  ) }) : null, Ae = oe || K ? /* @__PURE__ */ D(Oe, { children: [
    oe ? /* @__PURE__ */ p(vf, { onDone: (O) => void fe(O), onCancel: ie }) : null,
    K ? /* @__PURE__ */ D("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => Y(""), children: [
      "截图没成：",
      K
    ] }) : null
  ] }) : null, xe = v.visible && Me || !!k, $e = v.close, je = _(() => {
    if (xe) {
      P(null), $e();
      return;
    }
    v.openMain();
  }, [xe, $e, v.openMain]);
  return { marks: y.marks, onMark: me, menuItems: ke, panel: _e, overlay: Ae, cropping: oe, open: v.openMain, toggle: je, showing: xe, reserveRight: xe ? B : 0, enabled: !!e };
}
const zf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Ff() {
  const e = Zt(), t = V(() => {
    try {
      return et().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Of({
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
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, enabled: l, toggle: u, showing: f, reserveRight: d } = n, m = V(() => l ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Us,
      pressed: f,
      onClick: u
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: g, height: h }) => /* @__PURE__ */ p(cf, { marks: r, page: g, height: h, onOpen: o }) : void 0,
    shortcuts: zf,
    reserveRight: d,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [l, a, r, o, u, f, d, c]);
  return yn(m), /* @__PURE__ */ D(Oe, { children: [
    s,
    i
  ] });
}
const Bf = { id: "ask", title: "提问", Component: Ff };
function jn() {
  try {
    return et().translationVersions ?? null;
  } catch {
    return null;
  }
}
function jf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Hf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Uf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Wf({ documentId: e, jobId: t }) {
  const [n, r] = R([]), [o, a] = R(null);
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
  const s = Hf(n, t, o);
  return V(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Kf({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = R(null), [s, i] = R(""), [c, l] = R(""), u = N(0);
  $(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = _((g) => {
    const h = jn(), b = n.find((S) => S.versionId === g);
    if (!h || !b || !e) return;
    const w = ++u.current;
    i(g), l(""), (async () => {
      const S = et(), y = await h.resolveJob(e, g);
      if (!y) throw new Error("这一份还没有能读的译文。");
      const v = await S.loadReaderPayload(y, { includeOptionalArtifacts: !0 }), k = S.resolveReaderTranslatedPdfUrl(v.jobPayload, v.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: b.name, jobId: y, url: k, regions: jf(Wo(v.regionsPayload)) };
    })().then((S) => {
      w === u.current && a(S);
    }).catch((S) => {
      w === u.current && l((S == null ? void 0 : S.message) || "这一份打不开。");
    }).finally(() => {
      w === u.current && i("");
    });
  }, [e, n]), d = _(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), m = _(async () => {
    var b, w;
    const g = jn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (S) {
      l((S == null ? void 0 : S.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (b = globalThis.location) == null ? void 0 : b.href;
    h && ((w = globalThis.history) == null || w.replaceState(globalThis.history.state, "", Uf(h, o.jobId))), a(null);
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
function Vf(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Ws,
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(Cd, { compare: e, onDone: t })
  } : null;
}
function qf(e) {
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
function Jf() {
  var i;
  const e = Zt(), t = Kf({
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
    const c = Vf(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: qf(t) };
  }, [t]);
  return yn(s), null;
}
const Gf = { id: "compare", title: "对比版本", Component: Jf }, ja = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], fo = { pen: 35e-4, highlighter: 0.018 }, mo = 0.015, Hn = "retainpdf.reader.ink.v1:";
function ho(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Hn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Xf(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Hn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Hn + e);
    } catch {
    }
}
function Yf(e, t, n, r, o, a) {
  const s = mo * mo;
  return e.filter((i) => Ha(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Ha(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Zf(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Qf(e) {
  const [t, n] = R(null), [r, o] = R(ja[0].key), [a, s] = R(() => ho(e)), i = N(a), c = N([]);
  $(() => {
    const h = ho(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = _((h) => {
    i.current = h, s(h), Xf(e, h);
  }, [e]), u = _((h) => {
    const b = i.current, w = h(b);
    w !== b && (c.current = [...c.current.slice(-49), b], l(w));
  }, [l]), f = _((h) => {
    h.points.length < 1 || u((b) => [...b, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = _((h) => {
    h.length && u((b) => b.filter((w) => !h.includes(w.id)));
  }, [u]), m = _((h) => {
    u((b) => b.some((w) => w.page === h) ? b.filter((w) => w.page !== h) : b);
  }, [u]), g = _(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return V(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const em = [
  { tool: "pen", label: "画笔", Icon: Qn },
  { tool: "highlighter", label: "荧光笔", Icon: Ks },
  { tool: "eraser", label: "橡皮", Icon: Vs }
];
function tm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ua({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ D(Oe, { children: [
    em.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    ja.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(se, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(qs, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      se,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Js, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ p(gt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function nm({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Ua, { ink: e, page: t, onPick: n }) });
}
function rm({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Ua, { ink: e }) }) : null;
}
function om(e) {
  const t = N(e);
  t.current = e, $(() => {
    const n = (r) => {
      if (tm(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const am = "reader-ink-layer";
function sm(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function po({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: sm(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function im({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = R(null), i = N(!1), c = o.strokes.filter((h) => Ha(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const b = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - b.left) / Math.max(1, b.width))),
      Math.min(1, Math.max(0, (h.clientY - b.top) / Math.max(1, b.height)))
    ];
  }, f = (h, b) => o.erase(Yf(o.strokes, e, t, h, b, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [b, w] = u(h);
    o.tool === "eraser" ? f(b, w) : s([[b, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [b, w] = u(h);
    o.tool === "eraser" ? f(b, w) : s((S) => S ? Zf(S, b, w) : [[b, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: fo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ D(
    "svg",
    {
      className: am,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(po, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(po, { stroke: { tool: o.tool, color: o.color, width: fo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const cm = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function lm(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: Qn,
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen")
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(nm, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(im, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: cm
  };
}
function um() {
  const e = Zt(), t = Qf(e.resetKey);
  om(t);
  const n = V(() => lm(t), [t]);
  return yn(n), /* @__PURE__ */ p(rm, { ink: t });
}
const dm = { id: "ink", title: "画笔", Component: um }, fm = Bo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ D(
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
}), mm = fm;
function hm(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
const pm = Ho(() => import("./ReaderMarkdownPanel-B87lCg3z.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Wa = { id: "markdown", label: "Markdown", short: "MD", Icon: mm, needsJob: !0 };
function gm() {
  const e = Zt(), t = e.activePanel === Wa.id;
  return hm(t) ? /* @__PURE__ */ p(jo, { fallback: null, children: /* @__PURE__ */ p(pm, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) }) : null;
}
const bm = {
  id: "markdown",
  title: "Markdown",
  Component: gm,
  panels: [Wa]
}, Ka = "reader-xref", Un = "data-xref", zt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, ym = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${zt})`), vm = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Wn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function wm(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Sm(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function km(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Be(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Im(e, t, n) {
  return (e.find((o) => Be(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Tm(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Be(r), s = Sm(r);
    if (a === "formula") {
      for (const g of s.matchAll(vm)) {
        const h = Wn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = ym.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = wm(i[1]), u = Wn(i[2]), f = km(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Im(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Em = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${zt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${zt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${zt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${zt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Pm(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Em) {
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
function Rm(e, t) {
  return Pm(e, t).map((n) => ({ start: n.start, end: n.end, className: Ka, attrs: { [Un]: n.key } }));
}
const Mm = { figure: "图", table: "表", equation: "式" };
function go(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Mm[e.kind]} ${e.label}`;
}
const bo = { figure: "图", table: "表", formula: "公式", text: "文字" }, nt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function _m(e, t, n) {
  const r = Rt(e, t, n), o = r ? pt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = $a({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Nm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = Rt(u, t, n), d = f ? pt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = $a({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Am(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function xm(e, t) {
  const n = (o) => {
    const a = Be(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Lm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var z;
  const i = t.find((M) => M.itemId === e) ?? null, c = V(() => i ? xm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = R(nt.indexOf(1)), d = nt[u], m = N(null), [g, h] = R(0);
  Ce(() => {
    const M = m.current;
    if (!M) return;
    const I = () => h(M.clientWidth);
    I();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return T == null || T.observe(M), () => T == null ? void 0 : T.disconnect();
  }, []);
  const b = _((M) => {
    const I = c[l + M];
    I && a(I.itemId);
  }, [c, l, a]);
  $(() => {
    const M = (I) => {
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
    return window.addEventListener("keydown", M, !0), () => window.removeEventListener("keydown", M, !0);
  }, [s, b]), $(() => {
    const M = m.current;
    if (!M) return;
    const I = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), f((E) => Math.max(0, Math.min(nt.length - 1, E + (T.deltaY < 0 ? 1 : -1)))));
    };
    return M.addEventListener("wheel", I, { passive: !1 }), () => M.removeEventListener("wheel", I);
  }, []);
  const w = N(null);
  if (!i) return null;
  const S = Be(i), y = o.map((M) => ({ pane: M, pdf: r[M] ?? null, where: _m(i, n, M) })).filter((M) => !!(M.pdf && M.where)), v = 16, k = typeof window > "u" ? 800 : window.innerHeight, P = Math.min(880, k * 0.9) - 56 - 32 - (y.length > 1 ? 26 : 0), x = y.length ? Am(Math.max(120, (g - v * (y.length - 1) - 32) / y.length), P, y.map((M) => M.where.aspect)) : 0, A = ((z = y[0]) == null ? void 0 : z.where.page) ?? i.source.page;
  return /* @__PURE__ */ D("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${bo[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ D("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ D("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ D("span", { className: "reader-zoom-title", children: [
          bo[S] ?? "这一块",
          " · 第 ",
          A,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ D("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => b(-1), children: /* @__PURE__ */ p(Gs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => b(1), children: /* @__PURE__ */ p(Yo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((M) => Math.max(0, M - 1)), children: /* @__PURE__ */ p(Xs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ D(se, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(nt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === nt.length - 1, onClick: () => f((M) => Math.min(nt.length - 1, M + 1)), children: /* @__PURE__ */ p(Ys, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(gt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (M) => {
            const I = m.current;
            !I || M.button !== 0 || (w.current = { x: M.clientX, y: M.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(M.pointerId));
          },
          onPointerMove: (M) => {
            const I = m.current, T = w.current;
            !I || !T || (I.scrollLeft = T.left - (M.clientX - T.x), I.scrollTop = T.top - (M.clientY - T.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: y.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: v }, children: y.map(({ pane: M, pdf: I, where: T }) => /* @__PURE__ */ D("figure", { className: "reader-zoom-column", children: [
            y.length > 1 ? /* @__PURE__ */ p("figcaption", { children: M === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              za,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: T.page,
                region: T.fraction,
                cssWidth: x * d,
                label: `${M === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, M)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Dm = 380, Cm = 320, vt = 8;
function $m(e, t, n) {
  const r = Math.max(vt, Math.min(e.left, n.width - t.width - vt)), o = e.bottom + vt, a = o + t.height <= n.height - vt ? o : Math.max(vt, e.top - vt - t.height);
  return { left: r, top: a };
}
function Om({
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
    const m = r[d], g = m ? Nm(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Dm, Cm / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = $m(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ D("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ D("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: go(e.target) }),
      /* @__PURE__ */ D("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(za, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: go(e.target) })
  ] });
}
const zm = 250;
function Fm(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Bm(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function jm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Hm({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = R(null), [s, i] = R({ back: [], forward: [] }), c = N(s);
  c.current = s;
  const l = N(null), u = N({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = _(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Bt(m, g);
  }, []);
  $(() => {
    if (!e) return;
    const m = (y) => {
      var v, k;
      return (k = (v = y.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${Ka}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (y) => {
      var x;
      const v = m(y);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(Un) || "");
      if (!k) return;
      const P = ((x = v.closest("[data-reader-pane]")) == null ? void 0 : x.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const A = v.getBoundingClientRect();
        a({ target: k, pane: P, anchor: { left: A.left, top: A.top, right: A.right, bottom: A.bottom } });
      }, zm);
    }, b = (y) => {
      const v = m(y);
      !v || v.contains(y.relatedTarget) || (g(), a(null));
    }, w = (y) => {
      var A, z;
      const v = m(y);
      if (!v || y.button !== 0 || y.metaKey || y.ctrlKey || y.shiftKey || `${((A = window.getSelection) == null ? void 0 : A.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(Un) || "");
      if (!k) return;
      y.preventDefault(), y.stopPropagation(), g(), a(null);
      const P = ((z = v.closest("[data-reader-pane]")) == null ? void 0 : z.getAttribute("data-reader-pane")) || u.current.primaryPane, x = f();
      x && i((M) => Fm(M, x)), u.current.follow(k, P);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", b), e.addEventListener("click", w, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", b), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = _((m) => {
    const g = f();
    if (!g) return !1;
    const h = Bm(c.current, g, m);
    if (!h) return !1;
    const { shellEl: b, primaryPane: w } = u.current;
    return Mt(b, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [f]);
  return $(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || jm(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [d]), {
    preview: o,
    closePreview: _(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: _(() => d("back"), [d])
  };
}
const Um = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Wm() {
  const e = Zt(), t = V(() => Tm(e.regions), [e.regions]), { jumpToBlock: n } = e, r = _((s, i) => n(s.itemId, i), [n]), o = Hm({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = V(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => Rm(s, t) : void 0,
    shortcuts: Um
  }), [t]);
  return yn(a), /* @__PURE__ */ D(Oe, { children: [
    o.preview ? /* @__PURE__ */ p(Om, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ D(se, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(Zs, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const Km = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Wm }, lr = [dm, bm, Gf, Km, Bf];
function ur(e = lr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Vm(e) {
  const t = tt(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Oe, { children: (e.tabs ?? ur()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, f = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ D(
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
function qm(e) {
  const t = tt(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = ur().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
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
        children: /* @__PURE__ */ p(gt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Jm(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Gm(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Xm(e) {
  return e / 100 * window.innerHeight;
}
function Ym(e) {
  return e / 100 * window.innerWidth;
}
function Zm(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Ft({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Zm(n);
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
      r = Gm(t, o);
      break;
    }
    case "em": {
      r = Jm(t, o);
      break;
    }
    case "vh": {
      r = Xm(o);
      break;
    }
    case "vw": {
      r = Ym(o);
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
function Kn(e) {
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
      const u = Ft({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Ne(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Ft({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ne(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Ft({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ne(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Ft({
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
function be(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Vn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Qm : eh
  );
}
function Qm(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function eh(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Va(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function qa(e, t) {
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
function th({
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
    const { x: i, y: c } = qa(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return be(o, "No rect found"), o;
}
let rn;
function nh() {
  return rn === void 0 && (typeof matchMedia == "function" ? rn = !!matchMedia("(pointer:coarse)").matches : rn = !1), rn;
}
function Ja(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Vn(
    n,
    Array.from(t.children).filter(Va).map((g) => ({ element: g }))
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
          (w) => w.element === h
        );
        if (b) {
          if (d) {
            const w = d.element.getBoundingClientRect(), S = h.getBoundingClientRect();
            let y;
            if (c) {
              const v = n === "horizontal" ? new DOMRect(
                w.right,
                w.top,
                0,
                w.height
              ) : new DOMRect(
                w.left,
                w.bottom,
                w.width,
                0
              ), k = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (m.length) {
                case 0: {
                  y = [
                    v,
                    k
                  ];
                  break;
                }
                case 1: {
                  const P = m[0], x = th({
                    orientation: n,
                    rects: [w, S],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  y = [
                    P,
                    x === w ? k : v
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
                  w.right,
                  S.top,
                  S.left - w.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  w.bottom,
                  S.width,
                  S.top - w.bottom
                )
              ];
            for (const v of y) {
              let k = "width" in v ? v : v.element.getBoundingClientRect();
              const P = nh() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < P) {
                const A = P - k.width;
                k = new DOMRect(
                  k.x - A / 2,
                  k.y,
                  k.width + A,
                  k.height
                );
              }
              if (k.height < P) {
                const A = P - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - A / 2,
                  k.width,
                  k.height + A
                );
              }
              const x = g <= l || g > u;
              !i && !x && s.push({
                group: e,
                groupSize: _t({ group: e }),
                panels: [d, b],
                separator: "width" in v ? void 0 : v,
                rect: k
              }), i = !1;
            }
          }
          c = !1, d = b, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const b = o.find(
          (w) => w.element === h
        );
        b ? m.push(b) : (d = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var ot;
class Ga {
  constructor() {
    Mr(this, ot, {});
  }
  addListener(t, n) {
    const r = At(this, ot)[t];
    return r === void 0 ? At(this, ot)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = At(this, ot)[t];
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
    const r = At(this, ot)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
ot = new WeakMap();
let Et = {
  cursorFlags: 0,
  state: "inactive"
};
const dr = new Ga();
function ft() {
  return Et;
}
function rh(e) {
  return dr.addListener("change", e);
}
function oh(e) {
  const t = Et, n = { ...Et };
  n.cursorFlags = e, Et = n, dr.emit("change", {
    prev: t,
    next: n
  });
}
function Pt(e) {
  const t = Et;
  Et = e, dr.emit("change", {
    prev: t,
    next: e
  });
}
const ah = (e) => e, _n = () => {
}, Xa = 1, Ya = 2, Za = 4, Qa = 8, yo = 3, vo = 12;
let on;
function wo() {
  return on === void 0 && (on = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (on = !0)), on;
}
function sh({
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
        if (e && wo()) {
          const a = (e & Xa) !== 0, s = (e & Ya) !== 0, i = (e & Za) !== 0, c = (e & Qa) !== 0;
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
    return wo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const So = /* @__PURE__ */ new WeakMap();
function fr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = So.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = ft();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = sh({
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
  So.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ke = /* @__PURE__ */ new Map();
const es = new Ga();
function ih(e) {
  Ke = new Map(Ke), Ke.delete(e);
}
function ko(e, t) {
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
function bt() {
  return Ke;
}
function mr(e, t) {
  return es.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Qe(e, t, n) {
  const r = Ke.get(e);
  Ke = new Map(Ke), Ke.set(e, t), es.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function ts(e) {
  const t = ft();
  let n = !1;
  switch (t.state) {
    case "active":
      Pt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (fr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = st(r.group.id, !0);
        Qe(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Io(e) {
  e.defaultPrevented || ts(e.currentTarget);
}
function ch(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = qa(n, a.rect);
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
function lh(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function uh(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Po(e),
    b: Po(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  be(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Eo(To(n.a)),
    b: Eo(To(n.b))
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
const dh = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function fh(e) {
  const t = getComputedStyle(ns(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function mh(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || fh(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || dh.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function To(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (be(n, "Missing node"), mh(n)) return n;
  }
  return null;
}
function Eo(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Po(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ns(e);
  return t;
}
function ns(e) {
  const { parentNode: t } = e;
  return lh(t) ? t.host : t;
}
function hh(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function ph({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Va(n) || n.contains(e) || e.contains(n))
    return !0;
  if (uh(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (hh(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function hr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Ja(o), s = ch(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && ph({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function gh(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Pe(e, t, n = 0) {
  return Math.abs(Ne(e) - Ne(t)) <= n;
}
function We(e, t) {
  return Pe(e, t) ? 0 : e > t ? 1 : -1;
}
function It({
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
  return r = Math.min(i, r), r = Ne(r), r;
}
function Vt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Pe(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  be(u != null, "Invalid first pivot index"), be(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, b = n[h];
        be(
          b,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: y = 0
        } = b;
        if (S) {
          const v = i[h];
          if (be(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), Pe(v, w)) {
            const k = y - v;
            We(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : f, b = n[h];
        be(
          b,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: y = 0
        } = b;
        if (S) {
          const v = i[h];
          if (be(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), Pe(v, y)) {
            const k = v - w;
            We(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, b = n[h];
      be(
        b,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: S, collapsedSize: y, minSize: v } = b;
      if (S && We(w, v) < 0)
        if (e > 0) {
          const k = v - y, P = k / 2, x = w + e;
          We(x, v) < 0 && (e = We(e, P) <= 0 ? 0 : k);
        } else {
          const k = v - y, P = 100 - k / 2, x = w - e;
          We(x, v) < 0 && (e = We(100 + e, P) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let b = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const y = i[b];
      be(
        y != null,
        `Previous layout not found for panel index ${b}`
      );
      const v = It({
        overrideDisabledPanels: s,
        panelConstraints: n[b],
        prevSize: y,
        size: 100
      }) - y;
      if (w += v, b += h, b < 0 || b >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? u : f;
    for (; h >= 0 && h < n.length; ) {
      const b = Math.abs(e) - Math.abs(d), w = i[h];
      be(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = w - b, y = It({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: S
      });
      if (!Pe(w, y) && (d += w - y, l[h] = y, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (gh(c, l))
    return o;
  {
    const h = e < 0 ? f : u, b = i[h];
    be(
      b != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = b + d, S = It({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: b,
      size: w
    });
    if (l[h] = S, !Pe(S, w)) {
      let y = w - S, v = e < 0 ? f : u;
      for (; v >= 0 && v < n.length; ) {
        const k = l[v];
        be(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const P = k + y, x = It({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: P
        });
        if (Pe(k, x) || (y -= x - k, l[v] = x), Pe(y, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, b) => b + h,
    0
  );
  if (!Pe(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, b, w) => (h[g[w]] = b, h), {});
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
  if (!Pe(o, 100) && r.length > 0)
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
    const u = It({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!Pe(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      be(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = It({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Pe(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function rs({
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
    const d = a(), m = l.findIndex((b) => b.id === t), g = m === 0, h = m === l.length - 1;
    if (h && c < d && (g || l.slice(0, m).every((b, w) => {
      const S = f[w];
      return (S == null ? void 0 : S.collapsible) && Pe(S.collapsedSize, u[S.panelId]);
    }))) {
      const b = l.slice(0, m).reduce((w, S) => w + u[S.id], 0);
      return {
        ...u,
        [t]: Ne(100 - b)
      };
    }
    return Vt({
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
    }), w = ht({
      layout: b,
      panelConstraints: f
    });
    mt(g, w) || Qe(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: m,
      layout: w,
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
      return c && Pe(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = _t({ group: l }), d = Ft({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ne(d / f * 100);
      i(m);
    }
  };
}
function Ro(e) {
  if (e.defaultPrevented)
    return;
  const t = bt();
  hr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = rs({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function an(e) {
  const t = bt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function os({
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
  const s = a.map((u) => n.panels.indexOf(u)), i = os({ groupId: n.id }).getLayout(), c = Vt({
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
function Mo(e) {
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
function _o(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = bt(), n = hr(e, t), r = /* @__PURE__ */ new Map();
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
function as({
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
    const b = r.get(u), w = o.get(u);
    if (!b || !w)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: y,
      groupSize: v,
      layout: k,
      separatorToPanels: P
    } = w;
    if (y && k && P) {
      const x = Vt({
        delta: h,
        initialLayout: b,
        panelConstraints: y,
        pivotIndices: l.panels.map((A) => m.indexOf(A)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (mt(x, k)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Xa : Ya;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Za : Qa;
              break;
            }
          }
      } else
        Qe(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: y,
          groupSize: v,
          layout: x,
          separatorToPanels: P
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & yo : c |= i & yo, t.movementY === 0 ? c |= s & vo : c |= i & vo, oh(c), fr(e);
}
function No(e) {
  const t = bt(), n = ft();
  switch (n.state) {
    case "active":
      as({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Ao(e) {
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
      as({
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
      const a = hr(e, n);
      a.length === 0 ? t.state !== "inactive" && Pt({
        cursorFlags: 0,
        state: "inactive"
      }) : Pt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), fr(e.currentTarget);
      break;
    }
  }
}
function xo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (ft().state) {
      case "hover":
        Pt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Lo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || ts(e.currentTarget) && e.preventDefault();
}
function Do(e) {
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
function bh(e, t, n) {
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
function yh(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function vh({
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
function wh(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const wt = /* @__PURE__ */ new Map();
function Sh(e) {
  let t = !0;
  be(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: b, target: w } = h;
      if (w === e.element) {
        if (t) {
          const S = _t({ group: e });
          if (S === 0)
            return;
          const y = st(e.id);
          if (!y)
            return;
          const v = Kn(e), k = y.defaultLayoutDeferred ? Do(v) : y.layout, P = vh({
            group: e,
            nextGroupSize: S,
            prevGroupSize: y.groupSize,
            prevLayout: k
          }), x = ht({
            layout: P,
            panelConstraints: v
          });
          if (!y.defaultLayoutDeferred && mt(y.layout, x) && yh(
            y.derivedPanelConstraints,
            v
          ) && y.groupSize === S)
            return;
          Qe(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: x,
            separatorToPanels: y.separatorToPanels
          });
        }
      } else
        bh(e, w, b);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    be(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = _t({ group: e }), i = Kn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (wh(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? Do(i), f = ht({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  wt.set(
    d,
    (wt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Ja(e).forEach((g) => {
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
    ), o.add(g.id), g.element.addEventListener("keydown", Mo);
  }), wt.get(d) === 1 && (d.addEventListener("contextmenu", Io, !0), d.addEventListener("dblclick", Ro, !0), d.addEventListener("pointerdown", _o, !0), d.addEventListener("pointerleave", No), d.addEventListener("pointermove", Ao), d.addEventListener("pointerout", xo), d.addEventListener("pointerup", Lo, !0)), function() {
    t = !1, wt.set(
      d,
      Math.max(0, (wt.get(d) ?? 0) - 1)
    ), ih(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Mo);
    }), wt.get(d) || (d.removeEventListener(
      "contextmenu",
      Io,
      !0
    ), d.removeEventListener(
      "dblclick",
      Ro,
      !0
    ), d.removeEventListener(
      "pointerdown",
      _o,
      !0
    ), d.removeEventListener("pointerleave", No), d.removeEventListener("pointermove", Ao), d.removeEventListener("pointerout", xo), d.removeEventListener("pointerup", Lo, !0)), a.disconnect();
  };
}
function kh() {
  const [e, t] = R({}), n = _(() => t({}), []);
  return [e, n];
}
function pr(e) {
  const t = Uo();
  return `${e ?? t}`;
}
const yt = typeof window < "u" ? Ce : $;
function jt(e) {
  const t = N(e);
  return yt(() => {
    t.current = e;
  }, [e]), _(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function gr(...e) {
  return jt((t) => {
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
function br(e) {
  const t = N({ ...e });
  return yt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ss = Xt(null);
function Ih(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: ah
  });
  Zn(t, () => n.current, []), yt(() => {
    Object.assign(
      n.current,
      os({ groupId: e })
    );
  });
}
function is({
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
  }), h = jt((I) => {
    mt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), b = jt(
    (I, T) => {
      mt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), w = pr(i), S = N(null), [y, v] = kh(), k = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), P = gr(S, a);
  Ih(w, s);
  const x = jt(
    (I, T) => {
      const E = ft(), L = ko(I), C = st(I);
      if (C) {
        let U = !1;
        switch (E.state) {
          case "active": {
            U = E.hitRegions.some(
              (W) => W.group === L
            );
            break;
          }
        }
        return {
          flexGrow: C.layout[T] ?? 1,
          pointerEvents: U ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), A = br({
    defaultLayout: n,
    disableCursor: r
  }), z = V(
    () => ({
      get disableCursor() {
        return !!A.disableCursor;
      },
      getPanelStyles: x,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const T = k.current;
        return T.panels = Vn(u, [
          ...T.panels,
          I
        ]), v(), () => {
          T.panels = T.panels.filter(
            (E) => E !== I
          ), v();
        };
      },
      registerSeparator: (I) => {
        const T = k.current;
        return T.separators = Vn(u, [
          ...T.separators,
          I
        ]), v(), () => {
          T.separators = T.separators.filter(
            (E) => E !== I
          ), v();
        };
      },
      updatePanelProps: (I, { disabled: T }) => {
        const E = k.current.panels.find(
          (U) => U.id === I
        );
        E && (E.panelConstraints.disabled = T);
        const L = ko(w), C = st(w);
        L && C && Qe(L, {
          ...C,
          derivedPanelConstraints: Kn(L)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: E
      }) => {
        const L = k.current.separators.find(
          (C) => C.id === I
        );
        L && (L.disabled = T, L.disableDoubleClick = E);
      }
    }),
    [x, w, v, u, A]
  ), M = N(null);
  return yt(() => {
    const I = S.current;
    if (I === null)
      return;
    const T = k.current;
    let E;
    if (A.defaultLayout !== void 0 && Object.keys(A.defaultLayout).length === T.panels.length) {
      E = {};
      for (const J of T.panels) {
        const X = A.defaultLayout[J.id];
        X !== void 0 && (E[J.id] = X);
      }
    }
    const L = {
      disabled: !!o,
      element: I,
      id: w,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!A.disableCursor,
        expandedPanelSizes: k.current.lastExpandedPanelSizes,
        layouts: k.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    M.current = L;
    const C = Sh(L), { defaultLayoutDeferred: U, derivedPanelConstraints: W, layout: G } = st(L.id, !0);
    !U && W.length > 0 && (h(G), b(G, !1));
    const j = mr(w, (J) => {
      const { defaultLayoutDeferred: X, derivedPanelConstraints: pe, layout: Q } = J.next;
      if (X || pe.length === 0)
        return;
      const ue = L.panels.map(({ id: ce }) => ce).join(",");
      L.mutableState.layouts[ue] = Q, pe.forEach((ce) => {
        if (ce.collapsible) {
          const { layout: oe } = J.prev ?? {};
          if (oe) {
            const F = Pe(
              ce.collapsedSize,
              Q[ce.panelId]
            ), K = Pe(
              ce.collapsedSize,
              oe[ce.panelId]
            );
            F && !K && (L.mutableState.expandedPanelSizes[ce.panelId] = oe[ce.panelId]);
          }
        }
      });
      const Re = ft().state !== "active";
      h(Q), Re && b(Q, J.isUserInteraction);
    });
    return () => {
      M.current = null, C(), j();
    };
  }, [
    o,
    w,
    b,
    h,
    u,
    y,
    A
  ]), $(() => {
    const I = M.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ss.Provider, { value: z, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
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
is.displayName = "Group";
function yr() {
  const e = ut(ss);
  return be(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Th(e, t) {
  const { id: n } = yr(), r = N({
    collapse: _n,
    expand: _n,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: _n
  });
  Zn(t, () => r.current, []), yt(() => {
    Object.assign(
      r.current,
      rs({ groupId: n, panelId: e })
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
  const h = !!c, b = pr(c), w = br({
    disabled: a
  }), S = N(null), y = gr(S, s), {
    getPanelStyles: v,
    id: k,
    orientation: P,
    registerPanel: x,
    updatePanelProps: A
  } = yr(), z = f !== null, M = jt(
    (L, C, U) => {
      f == null || f(L, c, U);
    }
  );
  yt(() => {
    const L = S.current;
    if (L !== null) {
      const C = {
        element: L,
        id: b,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: z ? M : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: w.disabled,
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
    z,
    b,
    h,
    l,
    u,
    M,
    x,
    w
  ]), $(() => {
    A(b, { disabled: a });
  }, [a, b, A]), Th(b, d);
  const I = () => {
    const L = v(k, b);
    if (L)
      return JSON.stringify(L);
  }, T = hn(
    (L) => mr(k, L),
    I,
    I
  );
  let E;
  return T ? E = JSON.parse(T) : o !== void 0 ? E = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : E = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": b,
      id: b,
      ref: y,
      style: {
        ...Eh,
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
qn.displayName = "Panel";
const Eh = {
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
function Ph({
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
      layout: Vt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = ht({
      layout: Vt({
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
function cs({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = pr(a), l = br({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = R({}), [d, m] = R("inactive"), [g, h] = R(!1), b = N(null), w = gr(b, o), {
    disableCursor: S,
    id: y,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: P
  } = yr(), x = v === "horizontal" ? "vertical" : "horizontal";
  yt(() => {
    const M = b.current;
    if (M !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: M,
        id: c
      }, T = k(I), E = rh(
        (C) => {
          m(
            C.next.state !== "inactive" && C.next.hitRegions.some(
              (U) => U.separator === I
            ) ? C.next.state : "inactive"
          );
        }
      ), L = mr(
        y,
        (C) => {
          const { derivedPanelConstraints: U, layout: W, separatorToPanels: G } = C.next, j = G.get(I);
          if (j) {
            const J = j[0], X = j.indexOf(J);
            f(
              Ph({
                layout: W,
                panelConstraints: U,
                panelId: J.id,
                panelIndex: X
              })
            );
          }
        }
      );
      return () => {
        E(), L(), T();
      };
    }
  }, [y, c, k, l]), $(() => {
    P(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, P]);
  let A;
  n && !S && (A = "not-allowed");
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
      "aria-orientation": x,
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
      ref: w,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: A,
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
cs.displayName = "Separator";
const vr = 30, wr = 65, qt = 50, Rh = 100 - wr, Mh = 100 - vr;
function _h(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(wr, Math.max(vr, t)) : qt;
}
function Sr(e) {
  return 100 - e;
}
function St(e) {
  return `${e}%`;
}
const kr = "reader-document", Jt = "reader-assistant", ls = "retainpdf.reader.ai-split-layout.v1", Nh = {
  [kr]: Sr(qt),
  [Jt]: qt
};
function Ir(e) {
  const t = _h(e == null ? void 0 : e[Jt]);
  return {
    [kr]: Sr(t),
    [Jt]: t
  };
}
function Ah() {
  try {
    const e = JSON.parse(localStorage.getItem(ls) || "null");
    return Ir(e);
  } catch {
    return Nh;
  }
}
function xh(e) {
  try {
    localStorage.setItem(ls, JSON.stringify(Ir(e)));
  } catch {
  }
}
function Nn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Ir(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Jt]}vw`
  );
}
function Lh() {
  const e = N(null), [t] = R(Ah);
  Ce(() => {
    const o = e.current;
    return Nn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = _((o) => {
    Nn(e.current, o);
  }, []), r = _((o, a) => {
    Nn(e.current, o), a.isUserInteraction && xh(o);
  }, []);
  return /* @__PURE__ */ D(
    is,
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
            id: kr,
            defaultSize: St(Sr(qt)),
            minSize: St(Rh),
            maxSize: St(Mh)
          }
        ),
        /* @__PURE__ */ p(
          cs,
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
            id: Jt,
            defaultSize: St(qt),
            minSize: St(vr),
            maxSize: St(wr)
          }
        )
      ]
    }
  );
}
function Dh({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = R(!1);
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
function Ch({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Dh, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ D(Oe, { children: [
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
function $h(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Oh() {
  const [e, t] = R(!1), n = Uo(), r = N(null), o = Ca(), a = V(() => [...Ml, ...ef(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || $h(i.target)) return;
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
        children: /* @__PURE__ */ p(Qs, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
const zh = ["source", "sideBySide", "translated"], Fh = { source: "", translated: "", sideBySide: "" };
function Bh(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = sn(e.sourceUrl), n = sn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return vi({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function jh(e) {
  const [t, n] = R(() => /* @__PURE__ */ new Set()), r = V(
    () => e ? Bh(e) : Fh,
    [e]
  ), o = V(
    () => zh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = _(async (s) => {
    if (!e) return;
    const i = sn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? yi(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await wi(
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
        Si(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Hh = {
  source: Jo,
  sideBySide: Go,
  translated: Xo
}, Uh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Wh(e) {
  const t = tt(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = jh(n), i = N(null);
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
      /* @__PURE__ */ p(ei, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(Vo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = ws[c], u = sn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : Ss(c, r), g = Hh[c];
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
            /* @__PURE__ */ p(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ D("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ D("span", { className: "reader-download-action-label", children: [
                Uh[c],
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
const Kh = "retainpdf:reader:bookmarks:v1:", Vh = 200;
function Tr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function us(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Kh}${t}` : "";
}
function qh(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Ht(e, t = Tr()) {
  const n = us(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = qh(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const Jn = /* @__PURE__ */ new Set();
function Jh(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return Jn.add(n), () => {
    Jn.delete(n);
  };
}
function Gn(e, t, n) {
  const r = us(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Vh);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...Jn]) a(e);
  return o;
}
function Gh(e, t, n = "", { storage: r = Tr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Ht(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Gn(e, a.filter((i) => i.page !== s), r) : Gn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Xh(e, t, n = Tr()) {
  return Gn(e, Ht(e, n).filter((r) => r.page !== t), n);
}
function Yh(e, t) {
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
function ds(e, t) {
  const [n, r] = R(() => Ht(e));
  $(() => (r(Ht(e)), Jh(e, () => r(Ht(e)))), [e]);
  const o = _((s) => {
    r(Gh(e, s, Yh(t, s)));
  }, [e, t]), a = _((s) => r(Xh(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
function Zh({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Qh({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = ds(e, r);
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
      children: /* @__PURE__ */ p(Zh, { filled: i })
    }
  ) });
}
const ep = 48, tp = 96, np = 700;
function rp(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= ep, downSoFar: r };
}
function op(e) {
  const [t, n] = R(!1), r = N(0);
  return $(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), c = () => {
      const d = e.current;
      return !!(d && (d.querySelector(":focus-visible") || d.querySelector("[aria-expanded='true']")));
    }, l = (d) => {
      const m = d.target;
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${Te}]`)), !i.get(m))) return;
      const g = m.scrollTop, h = o.get(m);
      if (o.set(m, g), h === void 0 || Date.now() - a > np) return;
      const b = rp(!1, r.current, g - h);
      r.current = b.downSoFar, g - h < -4 ? n(!1) : b.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - tp && (r.current = 0, n(!1));
    }, f = () => {
      c() && n(!1);
    };
    document.addEventListener("scroll", l, { capture: !0, passive: !0 }), window.addEventListener("pointermove", u, { passive: !0 }), document.addEventListener("focusin", f);
    for (const d of ["wheel", "touchmove", "keydown"]) window.addEventListener(d, s, { passive: !0, capture: !0 });
    return () => {
      for (const d of ["wheel", "touchmove", "keydown"]) window.removeEventListener(d, s, { capture: !0 });
      document.removeEventListener("scroll", l, { capture: !0 }), window.removeEventListener("pointermove", u), document.removeEventListener("focusin", f);
    };
  }, [e]), t;
}
function ap(e) {
  const t = tt(), n = sr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = cc(a), f = a > aa + 1e-3, d = a < fn - 1e-3, m = kt(r, Tt()), g = m >= fn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = N(null), b = op(h), [w, S] = R(!1), [y, v] = R(`${i}`);
  $(() => {
    w || v(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, w]);
  const k = () => {
    if (S(!1), !l || c <= 0)
      return;
    const P = Number(`${y}`.trim());
    l(mn(P, c));
  };
  return /* @__PURE__ */ D("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": b ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ D(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (P) => {
          P.preventDefault(), k();
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
              value: y,
              autoFocus: !0,
              onChange: (P) => v(P.target.value.replace(/[^\d]/g, "")),
              onBlur: k,
              onKeyDown: (P) => {
                P.key === "Escape" && (P.preventDefault(), S(!1), v(`${i}`));
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
          !l || c <= 0 || (v(`${i}`), S(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      Qh,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions
      }
    ) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      se,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(sp, {})
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
          onClick: () => s(Kt(a, -1)),
          children: "−"
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
          onClick: () => s(Kt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Oh, {}) })
  ] });
}
function sp() {
  return /* @__PURE__ */ D("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function Co(e) {
  var t, n;
  return ua(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function ip(e) {
  const [t, n] = R(() => ({
    scope: e,
    panel: Co(Ve(e))
  }));
  $(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Co(Ve(e))
    });
  }, [e]), $(() => {
    t.scope === e && gn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = _((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Xn = "download-toast";
function cp({
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
function lp(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    xn.dismiss(Xn);
    return;
  }
  xn.custom(
    () => /* @__PURE__ */ p(cp, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Xn, duration: 1 / 0 }
  );
}
function up() {
  const e = _((t) => {
    t && (t.setState = lp, t.hide = () => xn.dismiss(Xn));
  }, []);
  return /* @__PURE__ */ D(Oe, { children: [
    /* @__PURE__ */ p(xs, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const $o = { itemId: null, origin: null };
function dp() {
  let e = $o;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? $o : { itemId: n, origin: r };
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
function fp({
  active: e,
  extensions: t = lr
}) {
  const [n, r] = R(!1), [o, a] = R(null), s = Ca(), i = (d) => {
    var m;
    return ((m = s.find((g) => g.id === d)) == null ? void 0 : m.contribution.toolbarItems) ?? [];
  }, c = t.some(({ id: d }) => i(d).some((m) => m.pressed)), l = t.flatMap((d) => [...i(d.id).map((m) => m.label), ...(d.panels ?? []).map((m) => m.label)]), u = (() => {
    if (!o) return null;
    for (const { id: d } of t) {
      const m = i(d).find((g) => `${d}:${g.key}` === o);
      if (m != null && m.popup) return m.popup(() => {
        a(null), r(!1);
      });
    }
    return null;
  })(), f = N(null);
  return $(() => {
    if (!n && !o) return;
    const d = () => {
      r(!1), a(null);
    }, m = (h) => {
      var b;
      (b = f.current) != null && b.contains(h.target) || d();
    }, g = (h) => {
      h.key === "Escape" && d();
    };
    return document.addEventListener("pointerdown", m, !0), document.addEventListener("keydown", g), () => {
      document.removeEventListener("pointerdown", m, !0), document.removeEventListener("keydown", g);
    };
  }, [n, o]), /* @__PURE__ */ D("div", { className: "reader-toolball", ref: f, "data-open": n ? "true" : void 0, children: [
    u,
    n ? /* @__PURE__ */ p("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: t.map((d) => {
      const m = ur([d]);
      return /* @__PURE__ */ D(Yn, { children: [
        i(d.id).map((g) => {
          const h = `${d.id}:${g.key}`, b = g.Icon;
          return /* @__PURE__ */ p(
            se,
            {
              className: "reader-toolball-item",
              "aria-label": g.label,
              title: g.title || g.label,
              "aria-pressed": !!g.pressed || o === h,
              "data-toolball-item": g.key,
              onClick: () => {
                var w;
                if (g.popup) {
                  a((S) => S === h ? null : h);
                  return;
                }
                (w = g.onClick) == null || w.call(g), r(!1);
              },
              children: /* @__PURE__ */ p(b, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
            },
            h
          );
        }),
        m.length ? /* @__PURE__ */ p(Vm, { active: e, tabs: m }) : null
      ] }, d.id);
    }) }) : null,
    /* @__PURE__ */ p(
      se,
      {
        className: "reader-toolball-ball",
        "aria-label": n ? "收起工具" : `工具：${l.join("、")}`,
        title: n ? "收起" : "工具",
        "aria-expanded": n,
        "data-active": e || c ? "true" : void 0,
        onClick: () => {
          r((d) => !d), a(null);
        },
        children: n ? /* @__PURE__ */ p(gt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(ti, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
function mp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function hp(e) {
  var r;
  if (e.shiftKey || mp(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${ra}`))) return null;
  const n = Number((r = t.closest(`[${Te}]`)) == null ? void 0 : r.getAttribute(Te)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function pp({
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
    r.map((c) => /* @__PURE__ */ p(Yn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function gp({ edit: e }) {
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
const fs = "retainpdf:reader:doc-theme:v1", Oo = "data-reader-doc";
function ms() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function bp(e = ms()) {
  try {
    return (e == null ? void 0 : e.getItem(fs)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function yp(e, t = ms()) {
  try {
    t == null || t.setItem(fs, e);
  } catch {
  }
}
function zo(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Oo, "dark") : t.removeAttribute(Oo));
}
function vp() {
  const [e, t] = R(() => bp());
  $(() => {
    zo(e);
  }, [e]), $(() => () => zo("light"), []);
  const n = _(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return yp(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function wp({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = V(() => Sa(e, t), [e, t]), [o, a] = R(() => /* @__PURE__ */ new Set([...Wr(r), ...r ? [r] : []]));
  $(() => {
    a(/* @__PURE__ */ new Set([...Wr(r), ...r ? [r] : []]));
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
    return /* @__PURE__ */ D("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ D("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          se,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(Yo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ D(
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
const Fo = { outline: "目录", search: "搜索", bookmarks: "书签", issues: "待处理" }, Sp = [], kp = [];
function Ip({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `目录、搜索、书签${n ? `、待处理 ${n} 处` : ""}（⌘F 搜索）`;
  return /* @__PURE__ */ D("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ D(se, { className: "reader-finder-toggle", "aria-label": "左栏：目录、搜索、书签", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(ni, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-badge", "aria-label": `待处理 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function Tp({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = kp,
  onJumpPage: l,
  pinned: u = !1,
  onPin: f,
  bookmarkPane: d,
  issuesPane: m,
  issueCount: g = 0
}) {
  var W, G;
  const h = ((W = tt()) == null ? void 0 : W.regions) ?? Sp, b = ((G = sr()) == null ? void 0 : G.currentPage) ?? 1, w = V(() => Ql(h), [h]), S = c.length > 0 && !!l, [y, v] = R("bookmarks"), k = S && (y === "bookmarks" || !w.length), P = eu(w, b), x = V(() => ru(h, s), [h, s]), [A, z] = R(-1);
  $(() => z(-1), [s]);
  const M = N(null), I = N(null), T = N(n);
  T.current = n, $(() => {
    if (u) return;
    const j = (X) => {
      var Q, ue;
      const pe = X.target;
      !pe || (Q = I.current) != null && Q.contains(pe) || (ue = pe.closest) != null && ue.call(pe, ".reader-finder-toggles, [data-finder-toggle]") || T.current();
    }, J = (X) => {
      X.key === "Escape" && T.current();
    };
    return document.addEventListener("pointerdown", j, !0), document.addEventListener("keydown", J), () => {
      document.removeEventListener("pointerdown", j, !0), document.removeEventListener("keydown", J);
    };
  }, [u]);
  const E = N(null);
  $(() => {
    var j, J, X;
    e === "search" ? (j = M.current) == null || j.focus() : (X = (J = E.current) == null ? void 0 : J.querySelector('[aria-current="location"]')) == null || X.scrollIntoView({ block: "center" });
  }, [e, i]), $(() => {
    var j, J;
    e === "search" && A >= 0 && ((J = (j = E.current) == null ? void 0 : j.querySelector('[aria-current="true"]')) == null || J.scrollIntoView({ block: "nearest" }));
  }, [e, A]);
  const L = (j) => {
    const J = x[j];
    J && (z(j), r(J.itemId));
  }, C = ["outline", "search", ...d ? ["bookmarks"] : [], ...m ? ["issues"] : []], U = C.includes(e) ? e : "outline";
  return /* @__PURE__ */ D("aside", { ref: I, className: "reader-finder", "data-finder-tab": U, "data-pinned": u ? "true" : void 0, "aria-label": `左栏：${Fo[U]}`, children: [
    /* @__PURE__ */ D("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: C.map((j) => /* @__PURE__ */ D(se, { className: "reader-finder-tab", role: "tab", "aria-selected": U === j, onClick: () => t(j), children: [
        Fo[j],
        j === "issues" && g ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: g }) : null
      ] }, j)) }),
      f ? /* @__PURE__ */ p(
        se,
        {
          className: "reader-finder-close reader-finder-pin",
          "aria-pressed": u,
          "aria-label": u ? "不钉了，浮在书上" : "钉在左边",
          title: u ? "不钉了：浮在书上，点别处收起" : "钉在左边：书页往右让，一直开着",
          onClick: () => f(!u),
          children: u ? /* @__PURE__ */ p(ri, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }) : /* @__PURE__ */ p(qo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(se, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(gt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    U === "bookmarks" ? d : U === "issues" ? m : null,
    U === "outline" && S && w.length ? /* @__PURE__ */ D("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(se, { className: "reader-finder-switch-option", role: "radio", "aria-checked": k, onClick: () => v("bookmarks"), children: "按 PDF 目录" }),
      /* @__PURE__ */ p(se, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !k, onClick: () => v("headings"), children: "按标题" })
    ] }) : null,
    U === "outline" && k && l ? /* @__PURE__ */ p(wp, { nodes: c, currentPage: b, onJumpPage: l }) : U === "outline" ? w.length ? /* @__PURE__ */ p("ol", { ref: E, className: "reader-finder-list", children: w.map((j, J) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(
      se,
      {
        className: "reader-finder-entry",
        "data-level": j.level,
        "aria-current": J === P ? "location" : void 0,
        onClick: () => r(j.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: j.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: j.page })
        ]
      }
    ) }, j.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: h.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : U !== "search" ? null : /* @__PURE__ */ D(Oe, { children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          Zo,
          {
            ref: M,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (j) => a(j.target.value),
            onKeyDown: (j) => {
              j.key === "Enter" ? (j.preventDefault(), L(ou(A, x.length, j.shiftKey))) : j.key === "Escape" && (j.preventDefault(), u ? j.currentTarget.blur() : n()), j.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: x.length === 0 ? "没有找到" : `${A >= 0 ? `第 ${A + 1} / ` : ""}${x.length >= 200 ? "200+ 处，只列前 200 处" : `${x.length} 处`}${A < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: x.map((j, J) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(se, { className: "reader-finder-entry is-hit", "aria-current": J === A ? "true" : void 0, onClick: () => L(J), children: [
        /* @__PURE__ */ D("span", { className: "reader-finder-entry-text", children: [
          j.snippet.slice(0, j.at),
          /* @__PURE__ */ p("mark", { children: j.snippet.slice(j.at, j.at + j.length) }),
          j.snippet.slice(j.at + j.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: j.page })
      ] }) }, j.itemId)) })
    ] })
  ] });
}
function Ep(e) {
  const [t, n] = R([]);
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
function Pp(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Rp = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Mp = ["failed", "content", "layout"];
function _p(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Np(e, t, n) {
  const r = Ep(e), [o, a] = R(-1);
  $(() => a(-1), [r]);
  const s = _((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = N({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, $(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || _p(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = Pp(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function Ap({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = ds(e, t);
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
function xp({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ D("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    Mp.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ D("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ D("h4", { children: [
          Rp[o],
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
function Lp({ state: e, bookmarks: t, bookmarkScope: n, issuesJobId: r }) {
  const { finder: o, setFinder: a, toggleSidebar: s, findQuery: i, setFindQuery: c, findTerm: l, findFocus: u, jumpFromFinder: f, jumpToPageFromFinder: d, pinned: m, setPinned: g, canPin: h } = e, b = tt(), w = sr(), S = (w == null ? void 0 : w.currentPage) ?? 1, y = Np(r, S, b == null ? void 0 : b.jumpToBlock), v = y.issues.length;
  return /* @__PURE__ */ D(Oe, { children: [
    /* @__PURE__ */ p(Ip, { open: o, onToggle: s, issueCount: v }),
    o ? /* @__PURE__ */ p(
      Tp,
      {
        tab: o,
        onTab: a,
        onClose: () => a(null),
        onJump: f,
        bookmarks: t,
        onJumpPage: d,
        query: i,
        onQuery: c,
        term: l,
        focusSignal: u,
        pinned: m,
        onPin: h ? g : void 0,
        bookmarkPane: n ? /* @__PURE__ */ p(
          Ap,
          {
            scope: n,
            regions: b == null ? void 0 : b.regions,
            currentPage: S,
            numPages: (w == null ? void 0 : w.numPages) ?? 0,
            onJumpPage: d
          }
        ) : void 0,
        issuesPane: v ? /* @__PURE__ */ p(xp, { nav: y }) : void 0,
        issueCount: v
      }
    ) : null
  ] });
}
function Dp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(Oe, { children: n ? /* @__PURE__ */ p(
    Lm,
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
const $p = 720;
function Op(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= $p;
}
function zp(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Fp(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = R(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Cp({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = ml({
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
    f.current !== e.viewStateKey && gl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function Bp(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = hl(e.liveTranslation), i = _(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = R(null);
  $(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && bl({
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
function jp() {
  const [e] = R(Vd), t = rf(e), n = Zd(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function Hp(e, t, n) {
  const r = N(e);
  $(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function Up(e, t, {
  translationVersions: n,
  bookmarks: r,
  regionHover: o,
  assistantPanel: a,
  closeAssistant: s,
  visiblePdfMode: i,
  changeWorkspace: c,
  jumpToBlockIn: l,
  zoomDocuments: u,
  editBlock: f
}) {
  const { session: d, panes: m } = e, g = N(e.currentPage);
  g.current = e.currentPage;
  const h = _(() => g.current, []), b = V(() => ({
    documentId: d.documentId || "",
    jobId: d.jobId,
    versionId: n.readingVersionId || null,
    translationVersions: n.versions,
    regions: d.regions,
    metadata: d.readerMetadata,
    bookmarks: r,
    pageCount: m.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => o.get().itemId,
    goToPage: e.goToPage,
    sourceOnly: e.sourceOnly,
    activePanel: a,
    closePanel: s,
    visibleMode: i,
    setWorkspace: c,
    jumpToBlock: l,
    shellEl: e.shell.shellEl,
    primaryPane: e.panes.primaryPane,
    pdfDocuments: u,
    editBlock: f,
    currentPage: h
  }), [
    d.documentId,
    d.jobId,
    n,
    d.regions,
    d.readerMetadata,
    r,
    m.hudNumPages,
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
    f
  ]), { contributionStore: w, contributions: S, reserveRight: y } = t, v = V(() => Jd(S), [S]), k = V(() => Qd(S), [S]), P = V(() => Yd(S), [S]), x = V(() => Gd(S), [S]), A = Xd(S);
  return { readerApi: b, contributionStore: w, contributions: S, pageLayers: v, compareVersion: k, textMarks: P, menuSections: x, pointerTakenId: A, reserveRight: y };
}
function Wp() {
  try {
    return et().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Kp = "这本书正在处理（翻译或排版），处理完才能改。", Vp = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function qp({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Wp(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = iu(s), l = !t || Ut(t), u = mu(n), [f, d] = R(""), [m, g] = R(null), [h, b] = R(() => /* @__PURE__ */ new Map()), [w, S] = R(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [y, v] = R(() => /* @__PURE__ */ new Map()), [k, P] = R({ phase: "idle" }), x = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  $(() => {
    g(null), x.drafts.clear(), x.generation.current = null, v(/* @__PURE__ */ new Map()), P({ phase: "idle" });
  }, [s]), $(() => {
    if (d(""), !i || c || !a) return;
    let C = !1;
    return a.resolveOwnerJobId(s).then((U) => {
      C || d(`${U || s}`.trim() || s);
    }).catch(() => {
      C || d(s);
    }), () => {
      C = !0;
    };
  }, [i, c, a, s]), $(() => {
    if (b(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let C = !1;
    return a.fetchRevisions(f).then((U) => {
      C || b(hu(U, u));
    }).catch(() => {
    }), () => {
      C = !0;
    };
  }, [a, f, u, l]);
  const A = k.phase === "running" && k.seenActive;
  $(() => {
    if (k.phase === "running") {
      if (!l) {
        A || P({ phase: "running", seenActive: !0 });
        return;
      }
      A && P(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, A, l, t]);
  const z = V(() => {
    const C = new Map(h);
    if (w.renderedAt === u)
      for (const [U, W] of w.edits) C.set(U, W);
    return C;
  }, [h, w, u]), M = _((C) => {
    const U = `${C || ""}`.trim();
    U && g({ itemId: U, page: cu(U) });
  }, []), I = _(() => g(null), []), T = _((C, U) => {
    S((W) => {
      const G = new Map(W.renderedAt === u ? W.edits : []);
      return G.set(C, U), { renderedAt: u, edits: G };
    }), v((W) => new Map(W).set(C, (W.get(C) || 0) + 1));
  }, [u]), E = _(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      P({ phase: "submitting" });
      try {
        await a.rerender(s), P({ phase: "running", seenActive: !1 }), await o();
      } catch (C) {
        P({ phase: "failed", message: (C == null ? void 0 : C.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), L = c ? Vp : !l || k.phase === "running" || k.phase === "submitting" ? Kp : "";
  return V(() => ({
    available: i,
    blockedReason: L,
    port: a,
    ownerJobId: f,
    target: m,
    select: M,
    close: I,
    memory: x,
    pendingEdits: z,
    savedCounts: y,
    markSaved: T,
    rerender: k,
    startRerender: E
  }), [i, L, a, f, m, M, I, x, z, y, T, k, E]);
}
function Jp(e, t) {
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
function Gp(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = qp({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = _((d, m) => {
    Ia(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  Jp(a.available ? u : null, n);
  const f = V(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const Xp = "reader-finder-input";
function Yp(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Zp(e, t = typeof window > "u" ? null : window) {
  $(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Yp(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Xp) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const hs = "retainpdf.reader.sidebar.v1", Qp = ["outline", "search", "bookmarks", "issues"], eg = 900;
function tg() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(hs)) || "{}"), n = Qp.includes(t == null ? void 0 : t.tab) ? t.tab : "outline";
    return { pinned: (t == null ? void 0 : t.pinned) === !0, open: (t == null ? void 0 : t.open) === !0, tab: n };
  } catch {
    return { pinned: !1, open: !1, tab: "outline" };
  }
}
function ng(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(hs, JSON.stringify(e));
  } catch {
  }
}
function rg() {
  const e = `(min-width: ${eg}px)`, [t, n] = R(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
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
function og(e) {
  const [t] = R(tg), [n, r] = R(t.pinned && t.open ? t.tab : null), [o, a] = R(t.tab), [s, i] = R(t.pinned), c = rg(), l = s && c, u = _((A) => {
    r(A), A && a(A);
  }, []);
  $(() => {
    ng({ pinned: s, open: !!n, tab: n || o });
  }, [s, n, o]);
  const f = _(() => r((A) => A ? null : o), [o]), d = _((A) => {
    r((z) => z === A ? null : A), a(A);
  }, []), m = _((A) => i(A), []), [g, h] = R(""), [b, w] = R("");
  $(() => {
    const A = g.replace(/\s+/gu, " ").trim(), z = window.setTimeout(() => w(A), A ? 150 : 0);
    return () => window.clearTimeout(z);
  }, [g]);
  const [S, y] = R(0), v = _(() => {
    u("search"), y((A) => A + 1);
  }, [u]);
  Zp(v);
  const k = _(() => {
    l || (n === "outline" || n === "bookmarks" || !c) && r(null);
  }, [l, n, c]), P = _((A) => {
    e.jumpToAnchor({ block_id: A }), k();
  }, [e.jumpToAnchor, k]), x = _((A) => {
    e.goToPage(A), k();
  }, [e.goToPage, k]);
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
    jumpFromFinder: P,
    jumpToPageFromFinder: x
  };
}
function ag(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ia(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function sg(e, t) {
  return t === null || e !== t;
}
function ig(e, t) {
  const { boot: n } = e, r = N(null), o = N(null);
  $(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Ve(e.viewStateKey), s = ag({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Tt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      sg(e.mode, o.current) && (o.current = null, gn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const cg = [];
function lg(e) {
  const { sessionFiles: t } = e, [n, r] = R({}), o = N({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = _((b, w) => {
    r((S) => ({ ...S, [w]: { url: o.current[w], nodes: b } }));
  }, []), s = V(() => {
    const b = n.source;
    if (b && b.url === t.sourceUrl && b.nodes.length) return b.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : cg;
  }, [n, t.sourceUrl, t.translatedUrl]), i = N({}), [c, l] = R(0), u = _((b, w) => {
    i.current[w] = { url: o.current[w], pdf: b }, l((S) => S + 1);
  }, []), [f, d] = R(null), m = _((b) => d(b), []), g = _(() => d(null), []);
  $(() => d(null), [e.viewStateKey]);
  const h = V(() => {
    const b = (w, S) => {
      const y = i.current[w];
      return y && y.url === S ? y.pdf : null;
    };
    return { source: b("source", t.sourceUrl), translated: b("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
function ug() {
  const e = Pl(), { boot: t, panes: n, session: r } = e, o = ip(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = jp(), { reserveRight: l } = c, u = i || l > 0, f = og(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, h = _(() => {
    s(null);
  }, []);
  Hp(l, a, h);
  const { liveTranslationVisible: b, setLiveTranslationVisible: w, paneComposition: S, liveToggles: y, sourceViewOnly: v, visiblePdfMode: k } = Fp(
    e,
    i,
    Op(e.shell.shellWidth, u || g)
  );
  ig(e, v);
  const P = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: x, toggleDocDark: A } = vp();
  Ll({
    toggleDocDark: A,
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
  const { latestLivePage: z, jumpToLatestLivePage: M, offerCompletion: I, setCompletionDismissedKey: T, sourcePaneAction: E } = Bp(e, {
    liveTranslationVisible: b,
    setLiveTranslationVisible: w,
    liveToggles: y,
    sourceViewOnly: v,
    visiblePdfMode: k
  }), L = _((O) => {
    const q = zp(O, e.liveTranslationAvailable);
    q !== null && w(q), e.setModeKeepingPage(O);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), C = _((O) => {
    s(O);
  }, []), [U] = R(dp), W = _((O) => e.jumpToAnchor({ block_id: O }), [e.jumpToAnchor]), G = _((O, q) => e.jumpToAnchor({ block_id: O }, q), [e.jumpToAnchor]), { bookmarks: j, onPdfOutline: J, onPdfDocument: X, zoomItem: pe, setZoomItem: Q, zoomBlock: ue, closeZoom: Re, zoomDocuments: ce } = lg(e), { blockEdit: oe, editBlock: F, revisedBlocks: K } = Gp(e, k, U), [Y, fe] = R(null), ie = _(() => fe(null), []), me = Wf({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: ke,
    contributionStore: le,
    contributions: ee,
    pageLayers: ge,
    compareVersion: B,
    textMarks: te,
    menuSections: he,
    pointerTakenId: Me
  } = Up(e, c, {
    translationVersions: me,
    bookmarks: j,
    regionHover: U,
    assistantPanel: a,
    closeAssistant: h,
    visiblePdfMode: k,
    changeWorkspace: L,
    jumpToBlockIn: G,
    zoomDocuments: ce,
    editBlock: oe.available && !oe.blockedReason ? F : null
  }), _e = !!Me, [Ae, xe] = R([]), $e = V(() => ({
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
    revisedBlocks: K,
    onPdfOutline: J,
    onPdfDocument: X,
    zoomBlock: ue,
    textMarks: te,
    pageLayers: ge,
    editBlock: oe.available ? F : void 0,
    blockEdit: oe,
    editShowsSource: k !== "compare",
    findTerm: d === "search" ? m : "",
    compareVersion: B,
    pointerTaken: _e,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: v,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: C, close: h },
    docDark: x,
    toggleDocDark: A
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
    K,
    J,
    X,
    ue,
    te,
    ge,
    oe,
    F,
    k,
    d,
    m,
    B,
    _e,
    e.sourceOnly,
    v,
    e.download,
    e.goToPage,
    C,
    h,
    x,
    A
  ]), je = V(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Ue = [
    rc,
    `is-workspace-${P}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    S.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(tf, { api: ke, store: le, children: /* @__PURE__ */ p(id, { value: $e, hud: je, children: /* @__PURE__ */ D(
    "div",
    {
      className: Ue,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": P,
      "data-pointer-taken": Me || void 0,
      "data-right-inset": l ? "true" : void 0,
      style: l ? { "--reader-right-inset": `${l}px` } : void 0,
      onContextMenu: (O) => {
        const q = hp(O);
        if (!q) return;
        const ae = qd(ee, { target: O.target, clientX: O.clientX, clientY: O.clientY, page: q.page });
        !ae.length && !he.length || (O.preventDefault(), xe(ae), fe(q));
      },
      children: [
        /* @__PURE__ */ p(Ch, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
        /* @__PURE__ */ p(Lp, { state: f, bookmarks: j, bookmarkScope: e.viewStateKey, issuesJobId: e.sourceOnly ? "" : r.jobId }),
        /* @__PURE__ */ D("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(Wh, {}),
          /* @__PURE__ */ p(Bl, { onBeforeClose: r.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Kd,
          {
            mode: k,
            documentReady: !!r.jobId,
            sourceViewOnly: v,
            onModeChange: L,
            liveTranslation: y.topBarPill ? {
              visible: b,
              state: e.liveTranslation,
              onToggle: () => w((O) => !O),
              latestPage: b ? z : null,
              currentPage: e.currentPage,
              onJumpToLatest: M
            } : null,
            completion: I ? {
              onOpenCompare: () => {
                T(e.viewStateKey), L("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(qm, { active: a }),
        i ? /* @__PURE__ */ p(Lh, {}) : null,
        /* @__PURE__ */ D("div", { className: "reader-stage", children: [
          /* @__PURE__ */ p(jd, { paneComposition: S, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
          e.showHud ? /* @__PURE__ */ p(
            ap,
            {
              mode: k,
              modeControls: null,
              bookmarkScope: e.viewStateKey
            }
          ) : null,
          /* @__PURE__ */ p(fp, { active: a })
        ] }),
        /* @__PURE__ */ p(
          Dp,
          {
            session: r,
            zoomDocuments: ce,
            zoomItem: pe,
            setZoomItem: Q,
            closeZoom: Re,
            visiblePdfMode: k
          }
        ),
        /* @__PURE__ */ p(pp, { menu: Y, onClose: ie, actions: Ae, sections: he }),
        /* @__PURE__ */ p(af, { extensions: lr }),
        /* @__PURE__ */ p(gp, { edit: oe }),
        /* @__PURE__ */ p(up, {})
      ]
    }
  ) }) });
}
function Lg() {
  return /* @__PURE__ */ p(ug, {});
}
export {
  Lg as R,
  ug as a,
  Ng as b,
  Ag as c,
  Sf as d,
  If as e,
  Mg as f,
  _g as g,
  Pg as h,
  Rg as r,
  xg as s,
  tt as u
};
//# sourceMappingURL=ReaderApp-CBWFYl3Y.js.map
