var Ps = Object.defineProperty;
var Nr = (e) => {
  throw TypeError(e);
};
var Ms = (e, t, n) => t in e ? Ps(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Ar = (e, t, n) => Ms(e, typeof t != "symbol" ? t + "" : t, n), xr = (e, t, n) => t.has(e) || Nr("Cannot " + n);
var xt = (e, t, n) => (xr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Lr = (e, t, n) => t.has(e) ? Nr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Cr = (e, t, n, r) => (xr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as C, jsx as p, Fragment as Le } from "react/jsx-runtime";
import { useMemo as K, useState as _, useEffect as O, useCallback as N, useRef as A, useLayoutEffect as Ce, memo as Yt, createContext as Zt, useContext as dt, Fragment as yn, forwardRef as _s, useImperativeHandle as rr, useSyncExternalStore as vn, Component as Ns, Suspense as Go, lazy as Xo, useId as Yo } from "react";
import { requireAdapter as Nt, getReaderAdapters as He } from "./adapters.js";
import { resolveReaderDownloadName as As, resolveReaderDownloadUrls as xs, READER_PROGRESS_COPY as Xe, trimString as ln, READER_DOWNLOAD_ACTIONS as Ls, disabledReason as Cs } from "./runtime/state.js";
import { r as Ds, b as $s } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as $n, isFinishedJobStatus as Wt } from "@retainpdf/domain/job";
import { n as Zo, d as Os, f as Tn, k as Dr, b as zs, c as Fs, j as Ue, p as gt, g as Bs, l as Pt, i as js } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as Hs } from "@retainpdf/api/documents";
import { isReaderTransportError as Us, createReaderTransportError as Ks } from "./contracts.js";
import { toast as On, Toaster as Ws } from "sonner";
import { ChevronLeft as Qo, PenLine as un, ZoomIn as Vs, Check as ea, X as At, Copy as qs, ChevronUp as Js, ChevronDown as dn, History as Gs, LoaderCircle as Xs, Pin as ta, LogOut as Ys, FileText as na, Columns2 as ra, Languages as oa, Radio as Zs, ArrowDownToLine as Qs, CheckCircle2 as ei, ImagePlus as ti, MessageCircle as ni, Scan as ri, GitCompareArrows as oi, Highlighter as ai, Eraser as si, Undo2 as ii, Trash2 as ci, BookText as li, ChevronRight as aa, Minus as sa, Plus as ia, ArrowLeft as ui, CircleHelp as di, Download as fi, Bookmark as mi, Star as hi, Contrast as pi, Search as ca, ListTree as gi, PinOff as bi } from "lucide-react";
import { Button as oe, Textarea as yi, IconButton as ut, Input as or } from "@retainpdf/ui";
import { createPortal as vi } from "react-dom";
import { pdfjs as la, Page as wi, Document as Si } from "react-pdf";
import { e as Ii, m as ki, a as Ti } from "./markdown-math-XkF5urpn.js";
const Ei = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ri = "", Pi = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Mi = (e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, zg = (...e) => {
  var n;
  return (((n = He()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Fg = () => {
  var e, t;
  return ((t = (e = He()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ye = () => Nt("defaultReaderDataPort"), $r = () => Nt("defaultReaderPageConfigPort"), Bg = {
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
}, ua = {
  messageTargetOrigin: () => $r().messageTargetOrigin(),
  readerJobId: () => $r().readerJobId()
}, _i = () => {
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
}, Ni = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Ai = () => {
  var e, t;
  return ((t = (e = He()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, xi = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Li = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? As(...e);
}, Ci = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? xs(...e);
}, Di = (...e) => Nt("downloadProtectedResource")(...e), $i = (...e) => Nt("failDownloadToast")(...e), jg = (e, t) => Nt("resolveMarkdownAssetUrl")(e, t), Or = "/api/v1";
function Oi() {
  const e = () => {
    var r;
    return Ds(
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
function zi() {
  const e = Oi(), t = K(() => xi(ua), [e]), n = K(() => Ai(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Fi(e) {
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
  }), I = h.jobId === g ? h.documentId : "", w = t || I, b = !!t && !g, [S, v] = _(null), M = (S == null ? void 0 : S.sessionIdentity) === r && S.documentId === w ? S : null, L = b || !!M, R = N((P) => {
    const k = `${P.documentId || ""}`.trim();
    if (!k || a.current && a.current !== k) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: k
      });
    else if (!a.current)
      return;
    const T = `${P.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: k,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  O(() => {
    v((P) => P && P.sessionIdentity !== r ? null : P);
  }, [r]);
  const z = N((P) => {
    switch (P.type) {
      case "resolved-document-job":
        l({ documentId: P.documentId, jobId: P.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: P.documentId, jobId: P.jobId });
        break;
      case "resolved-job-document":
        y((k) => k.jobId === P.jobId && k.documentId === P.documentId ? k : { jobId: P.jobId, documentId: P.documentId });
        break;
      case "committed-source":
        v({
          documentId: P.documentId,
          revision: P.revision,
          sessionIdentity: P.sessionIdentity
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
    activeCommittedDocumentSource: M,
    sourceViewOnly: L,
    refreshCommittedDocument: R,
    applyIdentityEvent: z
  };
}
function zr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Bi(e) {
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
function Fr(e, t) {
  return Mi($n(e, t));
}
function ji(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Hi(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !ji(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function zn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Pi.progress,
        stage: n,
        percent: e,
        text: t
      },
      ua.messageTargetOrigin()
    );
  } catch {
  }
}
function fn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), zn({ percent: t, text: n, stage: r });
}
function Ui(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = _(null), [l, u] = _(null), [f, d] = _(""), [m, g] = _(0), h = f === n ? i : null, y = f === n ? l : null, I = zr(h), w = Wt(I), b = N(() => {
    g((z) => z + 1);
  }, []), S = N((z) => {
    c(z.jobPayload), u(z.manifestPayload), d(z.sessionIdentity);
  }, []), v = N((z) => {
    c(null), u(null), d(z);
  }, []), M = A(""), L = A(""), R = N(async () => {
    const z = o.current;
    if (!z || M.current === z) return;
    const P = nt().loadJobPayload;
    if (typeof P != "function") return;
    const k = a.current.value;
    M.current = z;
    try {
      const T = await P(z);
      if (s.current || a.current.value !== k || o.current !== z || !T || typeof T != "object")
        return;
      const E = zr(T);
      c(T), d(r.current), !Wt(E) && L.current === z && (L.current = ""), E === "succeeded" && L.current !== z && (L.current = z, g((x) => x + 1));
    } catch {
    } finally {
      M.current === z && (M.current = "");
    }
  }, []);
  return O(() => {
    L.current = "";
  }, [n]), O(() => {
    if (!t || w || !h) return;
    const z = window.setInterval(() => {
      document.visibilityState !== "hidden" && R();
    }, 1e3);
    return () => window.clearInterval(z);
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
function Fn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ki(e, t) {
  e(t), Fn(t);
}
function Wi(e) {
  const [t, n] = _(e ? "source" : "compare"), r = N((a) => {
    e && a !== "source" || (n(a), Fn(a));
  }, [e]), o = N((a) => {
    Ki(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), Fn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Br(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Vi(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Br(n.active_job_id),
    activeVersionId: Br(n.active_version_id)
  };
}
function qi(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ji(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Gi(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Xi = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Yi(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Xi.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Zi = 48 * 1024 * 1024;
function Qi(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const ec = 2, je = /* @__PURE__ */ new Map();
function Bn(e, t) {
  je.delete(e), je.set(e, t);
}
function jr(e) {
  if (je.size < ec) return;
  const t = je.keys().next().value;
  t && je.delete(t);
}
async function tc(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function da(e, t = Vt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, I, w;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (je.has(r)) {
    const b = je.get(r);
    return Bn(r, b), b;
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
    const S = await tc(s);
    throw S && (b.reason = S), b;
  }
  const i = nc(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return jr(), je.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (w = (I = n.signal) == null ? void 0 : I.removeEventListener) == null || w.call(I, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return je.has(r) ? Bn(r, l) : (jr(), je.set(r, l)), l;
}
function nc(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Zi ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const rc = { file: null, loading: !1, error: "" }, oc = { file: null, loading: !0, error: "" };
function ac(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if (O(() => {
    if (t || !n) return;
    const s = je.get(n);
    if (s) {
      Bn(n, s);
      return;
    }
    const i = new AbortController();
    return da(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return rc;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = je.get(n);
  return a ? { file: a, loading: !1, error: "" } : oc;
}
function sc(e) {
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
async function jn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  fn(s, r, n, "download");
  const i = await da(t, Vt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (fn(s, o, n, "download"), i);
}
async function ic(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  fn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    jn({
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
    jn({
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
function cc(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function lc({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Hs,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(cc(o.href, t, a)), !0);
}
const tn = {
  regions: null,
  metadata: null
};
function uc(e) {
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
  } = e, [w, b] = _(""), [S, v] = _(""), [M, L] = _(null), [R, z] = _(null), [P, k] = _(!1), [T, E] = _(""), [x, D] = _([]), [W, H] = _(!1), [J, se] = _(() => ({
    source: null,
    translated: null
  })), [G, ie] = _(
    tn
  ), [Ie, ee] = _({
    loading: !0,
    percent: 4,
    text: Xe.boot,
    stage: "progress",
    failed: !1
  });
  return O(() => {
    const me = new AbortController(), Te = h.current.value, ae = sc({
      sessionEpochRef: h,
      closingRef: y,
      abort: me,
      sessionEpoch: Te
    });
    I.current = me;
    const fe = nt();
    if (y.current)
      return me.abort(), () => {
        I.current === me && (I.current = null);
      };
    let B = !1;
    function U(re, Q) {
      ae.markFailed(), H(!0), ee({
        loading: !1,
        percent: 100,
        text: re,
        stage: "failed",
        failed: !0
      }), zn({ percent: 100, text: Q, stage: "failed" });
    }
    function X() {
      k(!0), B || H(!0), ee({
        loading: !1,
        percent: 100,
        text: Xe.ready,
        stage: "ready",
        failed: !1
      }), zn({ percent: 100, text: Xe.ready, stage: "ready" });
    }
    function ce() {
      return l != null && l.documentId ? Fr(
        l.documentId,
        l.revision
      ) : Ei() ? Ri : fe.resolveResourceUrl($n(r));
    }
    async function ne() {
      var te;
      let re = { activeJobId: "", activeVersionId: "" };
      try {
        const he = await ((te = fe.fetchDocument) == null ? void 0 : te.call(fe, r));
        he && (re = Vi(he));
      } catch {
      }
      const Q = qi({
        link: re,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (Q.kind === "follow-active-job") {
        if (ae.isInactive()) return;
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
        if (ae.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: Q.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ge = ce();
      if (ae.isInactive()) return;
      b(ge), v(""), E(""), d(c);
      const F = await jn({
        url: ge,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ae,
        setBoot: ee
      });
      if (!ae.isInactive()) {
        if (!F) {
          U("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        L(F), X();
      }
    }
    async function ue() {
      var Me;
      const re = !l, Q = !!(re && fe.loadSessionSnapshot && fe.loadReaderOptionalArtifacts), ge = Q ? fe.loadReaderOptionalArtifacts(t) : null, F = await ((Me = fe.loadSessionSnapshot) == null ? void 0 : Me.call(fe, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: re && !Q
      })), te = F ? {
        jobPayload: F.sourcePayload,
        manifestPayload: F.manifestPayload,
        readerMetadata: F.readerMetadata,
        regionsPayload: F.regions,
        readerErrors: F.readerErrors
      } : await fe.loadReaderPayload(t, {
        includeOptionalArtifacts: re
      });
      if (ae.isInactive()) return;
      let he = null;
      if (n && !r)
        if (F && F.linkedDocument !== void 0)
          he = F.linkedDocument;
        else {
          try {
            he = await fe.fetchDocumentByJobId(Or, t);
          } catch {
          }
          if (ae.isInactive()) return;
        }
      const Oe = Bi(te.jobPayload) || `${(he == null ? void 0 : he.document_id) || ""}`.trim();
      Oe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Oe
      });
      const De = Ji({
        payloadDocumentId: Oe,
        linkedActiveJobId: `${(he == null ? void 0 : he.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(he == null ? void 0 : he.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (De.kind === "restore-committed-source") {
        if (ae.isInactive()) return;
        u({
          type: "committed-source",
          documentId: De.documentId,
          revision: De.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Ne = fe.resolveReaderSourcePdf(te.manifestPayload), Be = fe.resolveReaderTranslatedPdfUrl(te.jobPayload, te.manifestPayload), ze = typeof Ne == "string" ? Ne : fe.resolveReaderArtifactUrl(Ne), Ae = r || Oe, Ke = l != null && l.documentId ? Fr(
        l.documentId,
        l.revision
      ) : ze || (Ae ? fe.resolveResourceUrl($n(Ae)) : ""), $e = l ? "" : Be || "";
      b(Ke || ""), v($e), E(Hi(te.jobPayload, t)), f({
        jobPayload: te.jobPayload || null,
        manifestPayload: te.manifestPayload || null,
        sessionIdentity: c
      });
      const Fe = () => ic({
        sourceFinal: Ke || "",
        translatedFinal: $e,
        fence: ae,
        setBoot: ee
      }), j = !!(Ke || $e), q = ge && j ? Fe() : null;
      q == null || q.catch(() => {
      });
      const de = ($) => {
        ae.isInactive() || (D(l ? [] : Zo($.regionsPayload)), se(l ? { source: null, translated: null } : Os($.readerMetadata)), ie(l ? tn : $.readerErrors ?? tn), H(!0));
      };
      if (ge ? (B = !0, ge.then(de)) : de(te), !j) {
        U(Xe.failed, Xe.failed);
        return;
      }
      const ve = await (q ?? Fe());
      if (ve.status !== "inactive") {
        if (ve.status === "incomplete") {
          U("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        L(ve.sourceBytes), z(ve.translatedBytes), X();
      }
    }
    async function we() {
      k(!1), L(null), z(null), D([]), H(!1), se({ source: null, translated: null }), ie(tn), fn(ee, 8, Xe.metadata, "metadata");
      try {
        if (s) {
          await ne();
          return;
        }
        if (!t) {
          U(Xe.failed, Xe.failed);
          return;
        }
        await ue();
      } catch (re) {
        if (ae.isClosedOrStale() || (re == null ? void 0 : re.name) === "AbortError") return;
        ae.markFailed();
        const Q = Number(re == null ? void 0 : re.status), ge = `${(re == null ? void 0 : re.reason) || ""}`, F = Yi({ status: Q, reason: ge, sessionJobId: t });
        if (F && (await lc({
          apiPrefix: Or,
          documentId: F,
          expiredJobId: t
        }) || ae.isClosedOrStale()))
          return;
        if (Gi({
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
        const te = re instanceof Error ? re.message : Xe.failed;
        U(te, te);
      }
    }
    return we(), () => {
      me.abort(), I.current === me && (I.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: w,
    translatedUrl: S,
    sourceFile: M,
    translatedFile: R,
    assetsReady: P,
    title: T,
    regions: x,
    regionsSettled: W,
    readerMetadata: J,
    readerErrors: G,
    boot: Ie
  };
}
function dc() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = zi(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), c = A(""), l = A(""), u = A(() => {
  }), f = N(() => u.current(), []), d = Fi({
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
  } = d, { mode: I, setMode: w, switchSessionMode: b } = Wi(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const S = Ui({
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
    jobTerminal: R,
    jobRefreshRevision: z,
    refreshJobArtifacts: P,
    refreshJobStatus: k
  } = S, T = uc({
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
    jobRefreshRevision: z,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = N(() => {
    var D;
    e.current = !0, (D = t.current) == null || D.abort();
  }, []), x = K(
    () => ({
      fetchProtected: nt().fetchProtected,
      jobId: m,
      jobPayload: v,
      manifestPayload: M,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: y
    }),
    [m, v, M, T.sourceUrl, T.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: L,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: R,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: I,
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
    download: x,
    refreshJobArtifacts: P,
    refreshJobStatus: k,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: E
  };
}
const fc = 160, mc = 8, hc = 0;
function pc() {
  const e = A(null), [t, n] = _(null), [r, o] = _(hc), a = N((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < fc || o((u) => Math.abs(u - l) < mc ? u : l);
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
function gc(e) {
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
const En = { source: 0, translated: 0 };
function bc(e, t) {
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
    pages: En
  })), [m, g] = _(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : En, y = m.identity === l ? m.tick : 0, I = gc({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: w } = I, b = N((k, T) => {
    u.current === l && d((E) => {
      const x = E.identity === l ? E.pages : En;
      return x[T] === k && E.identity === l ? E : {
        identity: l,
        pages: { ...x, [T]: k }
      };
    });
  }, [l]), S = A(null), v = N(() => {
    S.current && clearTimeout(S.current);
    const k = l;
    S.current = setTimeout(() => {
      S.current = null, u.current === k && g((T) => ({
        identity: k,
        tick: T.identity === k ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  O(() => (S.current && (clearTimeout(S.current), S.current = null), d((k) => k.identity === l && k.pages.source === 0 && k.pages.translated === 0 ? k : { identity: l, pages: { source: 0, translated: 0 } }), g((k) => k.identity === l && k.tick === 0 ? k : { identity: l, tick: 0 }), () => {
    S.current && (clearTimeout(S.current), S.current = null);
  }), [l]);
  const M = K(
    () => Math.max(h.source, h.translated),
    [h]
  ), L = w === "translated" ? h.translated : h.source || h.translated, R = t == null ? void 0 : t.userZoom, z = t == null ? void 0 : t.shellWidth, P = `${l}-${y}-${R}-${n}-${h.source}-${h.translated}-${z}`;
  return {
    ...I,
    numPagesByPane: h,
    hudNumPages: M,
    primaryNumPages: L,
    metricsTick: y,
    onNumPages: b,
    onMetrics: v,
    rowSyncRevision: P
  };
}
const Pe = "data-reader-page", ke = "data-reader-pane", ar = "data-natural-height", yc = "reader-react-root", fa = "reader-react-grid", ma = "reader-react-scroll-shell", wn = "reader-react-pdf-pane", ha = "reader-react-pdf-page", mn = "reader-react-pdf-page-placeholder", sr = "reader-react-pdf-page-slot";
function hn(e, t) {
  const n = e != null ? `[${Pe}="${e}"]` : `[${Pe}]`;
  return t ? `${n}[${ke}="${t}"]` : n;
}
function ir() {
  return `.${sr}[${Pe}]`;
}
function pn(e) {
  return Number(e.getAttribute(Pe));
}
const pa = 0.25, gn = 1, vc = 0.05, Qt = 0.5, wc = 16, Sc = 8, ga = wc + Sc, Ic = 720;
function Tt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ba(e) {
  return Number.isFinite(e) && e < Ic;
}
function It(e, t = Number.POSITIVE_INFINITY) {
  return ba(t) && (e === "source" || e === "translated") ? gn : Qt;
}
function et(e) {
  return Number.isFinite(e) ? Math.min(gn, Math.max(pa, e)) : Qt;
}
function qt(e, t) {
  const n = et(Number(e) + t * vc);
  return Math.round(n * 100) / 100;
}
function kc(e) {
  return Math.round(et(e) * 100);
}
function ya(e) {
  const n = (Number(e) || 0) - ga;
  return Math.max(160, Math.floor(n));
}
function Tc(e, t = Qt) {
  const n = et(t);
  return ya((Number(e) || 0) * n);
}
function Ec(e, t) {
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
const Rc = 8;
function Pc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Rc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const va = 200, Mc = [
  "markdown"
], _c = Mc;
function wa(e) {
  return _c.includes(e);
}
const Nc = "retainpdf:reader:view:v1:", Hr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Ac = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Sa() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Hn(e) {
  return `${e || ""}`.trim();
}
function xc({
  documentId: e,
  jobId: t
}) {
  const n = Hn(e);
  if (n) return `document:${n}`;
  const r = Hn(t);
  return r ? `job:${r}` : "";
}
function Ia(e) {
  const t = Hn(e);
  return t ? `${Nc}${t}` : "";
}
function Lc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Cc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Hr.has(t) || !Hr.has(n) || t === n))
    return { left: t, right: n };
}
function Dc(e) {
  return e === null ? null : wa(e) ? e : void 0;
}
function $c(e) {
  return Ac.has(e) ? e : void 0;
}
function ka(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Lc(t.anchor), r = Number(t.zoom), o = $c(t.mode), a = Cc(t.splitLayout), s = Dc(t.assistantPanel);
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
function Je(e, t = Sa()) {
  const n = Ia(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ka(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Sn(e, t, n = Sa()) {
  const r = Ia(e);
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
function Oc(e, t, n = "") {
  var d;
  const [r, o] = _(() => {
    var m;
    return ((m = Je(n)) == null ? void 0 : m.zoom) ?? It(e, Tt());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), c = A(((d = Je(n)) == null ? void 0 : d.zoom) !== void 0);
  O(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Je(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? It(e, Tt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), O(() => {
    if (c.current) return;
    const m = It(e, Tt()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = N((m, g) => {
    const h = et(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, Sn(s.current, { zoom: h }), o(h));
  }, []), u = N((m) => {
    l(qt(a.current, m));
  }, [l]), f = N((m) => {
    l(It(m));
  }, [l]);
  return Ce(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Ec(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const zc = 160, Fc = 3e-3, Ur = 50, Bc = 16, jc = 800;
function Hc(e, t = 0) {
  const n = t === 1 ? Bc : t === 2 ? jc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Ur, Math.min(Ur, r));
  return Math.exp(-o * Fc);
}
function Uc(e, t, n = 0) {
  return et(e * Hc(t, n));
}
function Kc(e) {
  return Math.round(et(e) * 100) / 100;
}
function Wc(e, t, n) {
  const r = et(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return et(t) / r;
  const a = (o + ga) / r;
  return ya(a * et(t)) / o;
}
function Vc(e) {
  return Array.from(e.querySelectorAll(ir()));
}
function qc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Jc(e, t, n) {
  let r = null;
  for (const s of Vc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = qc(i, t, n);
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
function Gc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Ta(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${ir()}[${Pe}="${t.page}"][${ke}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Gc(n, e).scrollLeft += a);
}
function Xc(e, t, n, r) {
  const o = e.querySelector(`.${fa}`);
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
const Yc = 600, Zc = 1e3;
function Qc(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Ta(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Zc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function el(e, t, n) {
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
      const f = Kc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Lt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Lt(d.grid));
      }, Yc), s.current = d, o.current(f, { keepScroll: !1 });
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
          anchor: Jc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Uc(f.target, u.deltaY, u.deltaMode);
      const d = Wc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Xc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, zc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Lt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Ce(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Lt(c.grid), !(!e || !c.anchor) && (Ta(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Qc(e, c.anchor)));
  }, [t, e]);
}
function tl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: N((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const cr = 48;
function Ea(e, t = cr) {
  return e.getBoundingClientRect().top + t;
}
function Ra(e, t) {
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
  const o = pn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Ht(e, t, n = cr) {
  if (!e)
    return null;
  const r = hn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Ea(e, n), i = Ra(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Mt(e, t, n = "auto", r, o = cr) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(hn(a, r))), i || (i = e.querySelector(hn(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function nl(e, t, n = "smooth", r) {
  return Mt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Un(e, t, n) {
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
function rl(e, t, n) {
  return Un(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function bn(e, t) {
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
function ol(e, t, n = !0, r = "", o) {
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
    const f = hn(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = Ea(i), I = Ra(h, y);
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
const al = `canvas, .react-pdf__Page, .${ha}, .${mn}`, Kr = /* @__PURE__ */ new WeakMap();
function sl(e) {
  const t = Number(e.getAttribute(ar));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Kr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(al), Kr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function il(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function cl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(ir()).forEach((r) => {
    const o = pn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = sl(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function ll(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Ce(() => {
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
      const S = cl(b);
      il(s.current, S) || (s.current = S, a(S)), u && !f && (f = !0, (v = i.current) == null || v.call(i));
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
const ul = [0, 48, 140, 320, 560], dl = 700, fl = [80, 200, 400], ml = 500, hl = 50, pl = /* @__PURE__ */ new Set([
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
]), gl = 180, Wr = [0, 48, 140, 320, 700, 1200];
function bl(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((T = Je(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = A(null), l = A(!1), u = A(r), f = A(null), d = A(null), m = A(null), g = A(null), h = A(a), y = A(""), I = A(n);
  I.current = n;
  const w = N(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = N(() => {
    !l.current && c.current == null || (w(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [w]), S = N((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const x = () => {
      g.current = null, Sn(h.current, {
        anchor: We(i.current)
      });
    };
    E ? x() : g.current = setTimeout(x, gl);
  }, []), v = N((E) => {
    i.current = We(E), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, hl);
  }, []);
  O(() => {
    if (!o)
      return;
    let E = !1, x = null, D = null, W = null;
    const H = () => {
      if (E) return;
      const J = e.current;
      if (!J) {
        W = setTimeout(H, 50);
        return;
      }
      x = J, D = () => {
        if (l.current)
          return;
        const se = Ht(x, I.current);
        se && (i.current = se, S());
      }, x.addEventListener("scroll", D, { passive: !0 }), l.current || D();
    };
    return H(), () => {
      E = !0, W != null && clearTimeout(W), x && D && x.removeEventListener("scroll", D);
    };
  }, [o, r, n, e, S]), O(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const x = (D) => {
      D.metaKey || D.ctrlKey || D.altKey || pl.has(D.key) && b();
    };
    return E.addEventListener("wheel", b, { passive: !0 }), E.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", x), () => {
      E.removeEventListener("wheel", b), E.removeEventListener("touchmove", b), window.removeEventListener("keydown", x);
    };
  }, [o, e, b]), Ce(() => {
    var x;
    if (h.current === a) return;
    S(!0), w(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const E = (x = Je(a)) == null ? void 0 : x.anchor;
    i.current = E ? We(E) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, S, w]), O(() => {
    var x;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const E = We(
      ((x = Je(a)) == null ? void 0 : x.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, c.current = E, l.current = !0, w(), f.current = Un(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: I.current,
        delaysMs: Wr,
        onDone: () => v(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(E);
    }, Math.max(...Wr) + 160), () => w();
  }, [o, s, a, e, v, w]), O(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, w();
      return;
    }
    const E = c.current ? We(c.current) : We(i.current);
    return l.current = !0, c.current = E, i.current = E, w(), f.current = Un(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: ul,
        onDone: () => v(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(E);
    }, dl), () => {
      w();
    };
  }, [r, o, n, e, v, w]), O(() => () => {
    w(), m.current != null && (clearTimeout(m.current), m.current = null), S(!0);
  }, [w, S]);
  const M = N(() => {
    const E = Ht(
      e.current,
      I.current
    );
    return We(E || i.current);
  }, [e]), L = N(() => {
    l.current = !0;
    const E = Ht(
      e.current,
      I.current
    ), x = We(E ?? i.current);
    return i.current = x, c.current = x, S(), x;
  }, [e, S]), R = N((E, x, D) => {
    const W = D || I.current, H = bn(E, x || 1), J = { page: H, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, S(), w(), nl(e.current, H, "smooth", W), f.current = rl(
      () => e.current,
      H,
      {
        behavior: "auto",
        pane: W,
        delaysMs: fl,
        onDone: () => v(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(J);
    }, ml);
  }, [e, v, w, S]), z = N(() => We(i.current), []), P = N(() => l.current, []), k = N(() => {
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
    lockFromShell: M,
    beginModeSwitch: L,
    goToPage: R,
    getAnchor: z,
    isRestoring: P,
    repinIfRestoring: k
  };
}
function yl(e, t) {
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
function Pa(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const vl = [0, 80, 200, 400, 800], wl = 120, Sl = 400;
function Il(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = A(a);
  f.current = a;
  const d = A(s);
  d.current = s;
  const m = A(i);
  m.current = i;
  const g = A(n);
  g.current = n, O(() => {
    var S, v;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Ni(), y = yl(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const I = Pa(h, y, { jobId: c, documentId: l });
    if (t.current === I)
      return;
    if (y == null) {
      t.current = I, (S = g.current) == null || S.call(g);
      return;
    }
    t.current = I, h && ((v = m.current) == null || v.call(m, h, y));
    const w = [];
    let b = 0;
    for (const M of vl)
      b = Math.max(b, M), w.push(
        setTimeout(() => {
          f.current(y);
        }, M)
      );
    return w.push(
      setTimeout(() => {
        var M;
        (M = g.current) == null || M.call(g);
      }, b + wl)
    ), () => {
      for (const M of w) clearTimeout(M);
    };
  }, [r, o, c, l, t, u]);
}
function kl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Tl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Sl,
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
      const g = ((I = globalThis.location) == null ? void 0 : I.search) || "", h = $s(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Pa(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || kl)(h);
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
function El(e) {
  const t = A(""), [n, r] = _(!1), o = N(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Il(a, t, o), Tl(e, t, n);
}
const Ct = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Rl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Vr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Ma(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Vr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Vr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Pl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Ma(r, t, n);
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
function Ml(e) {
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
function _l(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function Nl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function Al(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function xl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const qr = [250, 500, 1e3, 2e3, 4e3], Rn = [80, 160, 320, 640, 1e3, 1500], Jr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Kn(e, t) {
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
function lr(e) {
  return Us(e) ? `${e.code || ""}`.trim() : "";
}
function nn(e, t) {
  const n = lr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Ll(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Ma(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Ks(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = lr(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Rn[Math.min(s, Rn.length - 1)];
    if (await Kn(i, r), s >= Rn.length + 2) throw a;
  }
}
function Cl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _(Ct), s = A(o), i = A("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Wt(l) ? l : "";
  return O(() => {
    if (!n || !c) {
      i.current = "", s.current = Ct, a(Ct);
      return;
    }
    const f = r === void 0 ? _i() : r, d = i.current === c;
    if (i.current = c, !f) {
      const b = {
        ...d ? s.current : Ct,
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
      ...d ? s.current : Ct,
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
            layoutByPage: Rl(S),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (S) {
          if ((S == null ? void 0 : S.name) === "AbortError") return;
          const v = lr(S);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            y((L) => ({
              ...L,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: nn(S, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((L) => ({
              ...L,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((L) => ({
            ...L,
            connection: "connecting",
            jobStatus: l,
            error: nn(S, "正在等待 OCR 版面数据")
          })), await Kn(qr[Math.min(b, qr.length - 1)], m.signal).catch(() => {
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
                v = await Ll(
                  c,
                  S,
                  s.current,
                  m.signal,
                  f
                );
              } catch (M) {
                if ((M == null ? void 0 : M.name) === "AbortError" || m.signal.aborted) throw M;
                y((L) => ({
                  ...L,
                  lastSeq: Math.max(L.lastSeq, S.seq),
                  error: nn(M, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((M) => {
                const L = Pl(M, S, v);
                return u ? {
                  ...L,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...L,
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
        await Kn(Jr[Math.min(b, Jr.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function Dl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function $l(e, t = !0) {
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = nt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Dl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Ol = 4500;
function zl(e) {
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
const Fl = /* @__PURE__ */ new Set(["book", "translate"]);
function _a(e) {
  return !!(e.jobId && e.sourceUrl && Fl.has(e.workflow));
}
function Bl(e) {
  return !!(_a(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function jl() {
  const e = dc(), t = _a({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Bl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Wt(o) && (r.current.running = !0);
  const a = Cl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = pc(), u = $l(e.jobId, !e.sourceOnly), f = xc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = Oc(e.mode, s, f);
  el(i, m, g);
  const h = bc(
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
  } = bl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  O(() => {
    w();
  }, [c, w]);
  const b = ll(
    s,
    h.compareMode,
    h.rowSyncRevision,
    w
  ), S = ol(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), v = N((H, J) => {
    var G, ie;
    const se = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((G = h.numPagesByPane) == null ? void 0 : G.source) || 0,
      Number((ie = h.numPagesByPane) == null ? void 0 : ie.translated) || 0
    );
    I(H, se, J);
  }, [I, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [M, L] = _(null), R = A(null), z = N((H) => {
    R.current && clearTimeout(R.current), L(H), H && (R.current = setTimeout(() => L(null), Ol));
  }, []);
  O(() => () => {
    R.current && clearTimeout(R.current);
  }, []);
  const P = N((H) => {
    const J = Tn(e.regions, H);
    return J ? Dr(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), k = N((H, J) => {
    const se = J || h.primaryPane, G = typeof H == "object" && H ? `${H.block_id || ""}`.trim() : "", ie = typeof H == "object" && H ? `${H.image_url || ""}`.trim() : "", Ie = typeof H == "object" && H ? H.page_idx != null ? Number(H.page_idx) + 1 : H.page != null ? Number(H.page) : null : typeof H == "number" ? H + 1 : null, ee = zs(e.regions, ie, Ie) || Tn(e.regions, G) || (typeof H == "object" ? Fs(e.regions, H) : null);
    let me = ee ? Dr(ee, se).page : null;
    me == null && (me = zl(H)), !(me == null || me < 1) && (z(ee), v(me, se));
  }, [z, v, h.primaryPane, e.regions]);
  El({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: S,
    goToPage: v,
    resolveBlockPage: P,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (H) => {
      z(Tn(e.regions, H.blockId));
    }
  });
  const { setModeKeepingPage: T } = tl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  O(() => {
    z(null);
  }, [d, z]);
  const E = !e.boot.loading && !e.boot.failed, x = K(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), D = K(() => ({
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
    shell: x,
    panes: h,
    sessionFiles: D,
    rowHeights: b,
    goToPage: v,
    activeRegion: M,
    jumpToAnchor: k,
    setModeKeepingPage: T,
    download: e.download,
    showHud: E,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, x, h, D, b, v, M, k, T, E, m, g, f, a, n, u]);
  return K(() => ({
    ...W,
    currentPage: S
  }), [W, S]);
}
const Hl = [
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
], Ul = [
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
function Kl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Hl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Wl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Vl = ".reader-notes-panel";
function ql(e) {
  return e instanceof Element ? !!e.closest(Vl) : !1;
}
function Jl(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Wl(d.target) || ql(d.target))
        return;
      const m = d.key, g = Kl(m);
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
              a(It(t, Tt()));
              return;
            case "next-page":
              c(bn(s + 1, i));
              return;
            case "prev-page":
              c(bn(s - 1, i));
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
const Ee = { size: 16, strokeWidth: 1.75 }, Gr = { size: 12, strokeWidth: 1.75 }, Gl = "retainpdf:soft-reader-close";
function Xl() {
  return new URL("./index.html", window.location.href).href;
}
function Yl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Gl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Zl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Ql() {
  if (!(typeof window > "u") && !Yl()) {
    if (Zl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Xl());
  }
}
function eu({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function tu({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ C(eu, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Ql();
  }, children: [
    /* @__PURE__ */ p(Qo, { className: "reader-close-home-icon", ...Ee, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const nu = 3e3, ru = 8;
async function ou(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function au(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function su(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = nu;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = au(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < ru && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await ou(e, i);
  })), a;
}
function Na(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function iu(e, t) {
  let n = null;
  for (const r of Na(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let Xr = !1;
function cu() {
  if (Xr)
    return;
  const e = Vt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (la.GlobalWorkerOptions.workerSrc = e, Xr = !0);
}
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), lu = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, uu = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, du = {
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
}, Yr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function fu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Yr(o ?? a ?? "", lu)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Yr(o ?? a ?? "", uu)).replace(/\\([a-zA-Z]+)/gu, (r, o) => du[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function mu(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const hu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Aa(e) {
  const t = [];
  for (const n of e) {
    if (!hu(n)) continue;
    const r = fu(mu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const pu = 24, gu = 60;
function Zr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - pu), o = Math.min(e.length, n + t.length + gu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function bu(e, t, n = 200) {
  const r = st(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = st(a.translatedBlockText) || st(a.translated.text), c = i ? Zr(i, r) : null, l = c ?? Zr(st(a.source.text), r);
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
function yu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const vu = /^data-[a-z0-9-]+$/;
function Qr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function wu(e, t, n = "") {
  if (!t.length) return zt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += zt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => vu.test(c)).map(([c, l]) => ` ${c}="${Qr(l)}"`).join("");
    o += `<mark class="${Qr(s.className)}"${i}>${zt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + zt(e.slice(a), n);
}
function Se(e) {
  return typeof e == "string" ? e : "";
}
function Su(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Iu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function ku(e) {
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
function Eu(e) {
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
function Ru(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Pu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return Se(r.finished_at) || Se(n.finished_at) || "";
}
function Mu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = xa(e).sort((a, s) => Se(a.ts).localeCompare(Se(s.ts)));
  for (const a of o) {
    const s = new Date(Se(a.ts)).getTime(), i = Se(a.reader_item_id) || Se(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, Se(a.new_text));
  }
  return n;
}
const _u = {
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
function Nu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = _u[Se(n.kind)] || Se(n.kind) || "问题", o = Se(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Au = /* @__PURE__ */ new Set(["text", "formula"]);
function ur(e) {
  return Au.has(e);
}
function La(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || ur(Ue(n));
}
function xu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !ur(Ue(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Lu = 300, Cu = 72;
function Du(e, t) {
  if (e.width >= Lu && e.height >= Cu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const $u = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Ou(e, t, n) {
  return e.flatMap((r) => {
    if (!$u.has(Ue(r.region))) return [];
    const o = gt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function eo(e, t, n) {
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
async function zu(e) {
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
const Fu = "reader-text-hover-copy", Bu = "reader-text-hover-edit", ju = "reader-text-hover-zoom", Hu = "reader-text-hover-id";
function Uu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Ca = "reader-text-hover-tools";
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
const Ku = 26, Wu = 220;
function Vu(e, t = Wu) {
  return e.height < Ku * 2 || e.width < t;
}
function qu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? ea : e === "failed" ? At : qs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Ju({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = _("idle"), [u, f] = _("idle"), [d] = _(() => Uu()), m = A([]), g = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    l("idle"), f("idle");
    const v = m.current;
    return () => {
      v.forEach((M) => window.clearTimeout(M)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = Bs(e.highlight.region, t), y = Ue(e.highlight.region), I = (v, M) => async (L) => {
    L.preventDefault(), L.stopPropagation();
    const R = await zu(v);
    M(R ? "copied" : "failed"), m.current.push(window.setTimeout(() => M("idle"), 1200));
  }, w = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, S = s || (Vu(b) ? "outside" : "inside");
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
          className: Ca,
          "data-placement": S,
          style: S === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              on,
              {
                className: Hu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: I(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && ur(y) ? /* @__PURE__ */ p(
              on,
              {
                className: Bu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(un, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              on,
              {
                className: Fu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : w,
                onClick: I(h, l),
                children: /* @__PURE__ */ p(qu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              on,
              {
                className: ju,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Vs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Gu(e, t) {
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
function Xu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = gt(
      Gu(e, a),
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
const Yu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Zu = 256, Dt = /* @__PURE__ */ new Map();
function Qu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Da(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ii(t, { bareLatex: !0 }), o = Qu(n), a = ki(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Dt.get(t);
  if (!s && (s = Ti(o, r), Dt.set(t, s), Dt.size > Zu)) {
    const i = Dt.keys().next().value;
    i !== void 0 && Dt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Pn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ze(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function ed(e, t) {
  const n = e.typography, r = Ze(t) || 1, o = Ze(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Pn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ze(n == null ? void 0 : n.fit_min_font_size_pt), u = Ze(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Ze(n == null ? void 0 : n.leading_em), h = [
    Ze(n == null ? void 0 : n.padding_top_pt) || 0,
    Ze(n == null ? void 0 : n.padding_right_pt) || 0,
    Ze(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ze(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Yu,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Pn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Pn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function td(e, t, n, r) {
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
const nd = 512, $t = /* @__PURE__ */ new Map();
let Wn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Wn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Wn += 1;
}));
function rd(e, t, n, r) {
  return [
    Wn,
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
  const n = A(null), r = K(
    () => Da(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = K(
    () => ed(e, t),
    [e, t]
  );
  O(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Ce(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), I = Math.max(1, e.rect.height - d - g), w = rd(o, y, I, s);
    let b = $t.get(w);
    if (b === void 0 && (b = td(
      (S) => (f.style.fontSize = `${S}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      I,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), $t.set(w, b), $t.size > nd)) {
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
function od({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = K(
    () => Xu(e, t, n, r),
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
const ad = Yt(od);
function sd({
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
const id = Yt(sd), Oa = 24, ot = Oa * 2 + 4, Qe = 24, cd = 4, ld = 6, ft = (e) => e.left + e.width, ct = (e) => e.top + e.height;
function Ft(e, t) {
  const n = Math.min(ft(e), ft(t)) - Math.max(e.left, t.left), r = Math.min(ct(e), ct(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const to = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ft(t) && r >= t.top && r <= ct(t);
}, ud = (e) => e.height > 40 && e.height > e.width * 2.5;
function dd(e, t, n) {
  if (!t.length || e.height < Qe || e.width < n + 8) return null;
  const r = Math.max(...t.map(ct)), o = ft(e) - 4 - n;
  for (const a of [r, ct(e) - 2]) {
    const s = Math.max(e.top, a - Qe), i = { left: o, top: s, width: n, height: Qe };
    if (!t.some((c) => Ft(i, c) > 0)) return s - e.top;
  }
  return null;
}
function fd(e, t) {
  const n = [], r = (a) => {
    const s = Oa + cd, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ft(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Qe - 3, width: ot, height: Qe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: ct(e), width: ot, height: Qe + 3 } }), r(!0);
  const o = dd(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ft(e) - 4 - ot, top: e.top + o, width: ot, height: Qe } }), n;
}
function md(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((w) => w.width > 0 && w.height > 0 && !ud(w)), i = s.filter((w) => to(w, t)), c = s.filter((w) => !to(w, t)), l = n.filter((w) => w !== t && Ft(w, t) < t.width * t.height * 0.5), u = fd(t, i).filter(({ box: w, overhang: b }) => {
    const S = b ? ld : 0;
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
function hd(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Qe - 3 : ct(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Qe + 3;
}
const Mn = (e) => e.left + e.width, _n = (e) => e.top + e.height;
function pd(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > Mn(e) || f < e.top || f > _n(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, Mn(l)), i = Math.max(i, _n(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(Mn(e) + r, s + n) - c.left, c.height = Math.min(_n(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function gd(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function bd(e, t, n, r) {
  const [o, a] = _(null);
  return Ce(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? gd(s) : [], c = Ue(t.highlight.region) === "figure", l = i.length && !c ? pd(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...md({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function yd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = _(null), [i, c] = _(!1), [l, u] = _([]), [f, d] = _(""), [m, g] = _(""), [h, y] = _(!1), [I, w] = _(null), [b, S] = _([]), v = r.drafts, M = r.generation, L = N(async (k, T) => {
    if (e)
      try {
        u(Eu(await e.fetchRevisions(k, T)));
      } catch {
        u([]);
      }
  }, [e]);
  O(() => {
    if (s(null), u([]), w(null), S([]), g(""), !e || !t || !n) return;
    let k = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (k) return;
      const E = T == null ? void 0 : T.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const x = `${(T == null ? void 0 : T.item_id) || n}`, { source: D, translated: W } = ku(E);
      s({ readerItemId: n, itemId: x, source: D, current: W }), d(v.get(n) ?? W);
    }).catch((T) => {
      k || w({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      k || c(!1);
    }), L(t, n), () => {
      k = !0;
    };
  }, [e, t, n, L]);
  const R = N((k) => {
    d(k), n && v.set(n, k);
  }, [n, v]), z = N(async (k, T) => {
    if (!e || !a || h) return !1;
    const E = k ?? f;
    if (!E.trim()) return !1;
    y(!0), w(null), S([]);
    try {
      const x = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ...M.current != null ? { expected_generation: M.current } : {}
      }), D = Number(x == null ? void 0 : x.generation);
      return Number.isFinite(D) && (M.current = D), v.delete(a.readerItemId), s({ ...a, current: E }), d(E), g(""), (x == null ? void 0 : x.changed) === !1 ? w({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), w({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), L(t, a.readerItemId), !0;
    } catch (x) {
      const D = x;
      return (D == null ? void 0 : D.reason) === "generation_mismatch" && (M.current = null), w({ tone: "error", message: (D == null ? void 0 : D.message) || "保存失败，请稍后再试。" }), S(Nu(D == null ? void 0 : D.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, L, v, M]), P = N(() => {
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
    save: z,
    discardDraft: P
  };
}
const za = "reader-inline-edit";
function vd({ text: e }) {
  const [t, n] = _("");
  return O(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Da(e);
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
function wd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var P;
  const s = e.itemId, i = yd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = _(!1), [u, f] = _(!1), d = A(null), m = Du(e.rect, t), g = K(() => xu(o), [o]), h = g.indexOf(s), { loaded: y } = i, I = i.saving || i.loading, w = n.blockedReason, b = !y || i.draft === y.current, { close: S, select: v } = n, M = N((k) => {
    const T = g[h + k];
    T && (v(T), a == null || a(T));
  }, [g, h, v, a]), L = N(() => {
    i.discardDraft(), S();
  }, [i, S]), R = N(async (k, T) => {
    await i.save(k, T) && S();
  }, [i, S]);
  O(() => {
    const k = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), M(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", k), () => window.removeEventListener("keydown", k);
  }, [M]), Ce(() => {
    const k = d.current;
    if (!k) return;
    k.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    k.style.height = `${Math.max(T, k.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const z = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ C(Le, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ C(
      "div",
      {
        className: `${za} is-${m.mode}`,
        style: z,
        role: "group",
        "aria-label": `改第 ${((P = n.target) == null ? void 0 : P.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (k) => k.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            oe,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((k) => !k),
              children: y.source
            }
          ) : null,
          w ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: w }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            yi,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: I || !!w,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (k) => i.setDraft(k.target.value),
              onKeyDown: (k) => {
                k.key === "Enter" && (k.metaKey || k.ctrlKey) ? (k.preventDefault(), b || R()) : k.key === "Escape" && (k.preventDefault(), L());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(vd, { text: i.draft }) : null,
          /* @__PURE__ */ C("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => M(-1), children: /* @__PURE__ */ p(Js, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => M(1), children: /* @__PURE__ */ p(dn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              or,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: I || !!w || !y,
                onChange: (k) => i.setReason(k.target.value),
                onKeyDown: (k) => {
                  k.key === "Enter" ? (k.preventDefault(), b || R()) : k.key === "Escape" && (k.preventDefault(), L());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ C(
              oe,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((k) => !k),
                children: [
                  /* @__PURE__ */ p(Gs, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(oe, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: L, children: "取消" }),
            /* @__PURE__ */ p(
              oe,
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
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((k) => /* @__PURE__ */ p("li", { children: k }, k)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((k, T) => {
            const E = k.text === y.current, x = [Ru(k.ts), k.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ C("li", { "data-block-edit-history": k.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ C("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ C("span", { children: [
                  x,
                  E ? "（现在用的）" : "",
                  k.reason ? ` · ${k.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  oe,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: I || !!w,
                    onClick: () => {
                      R(k.text, `回到「${x.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: k.text })
            ] }, `${k.ts}:${T}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Fa = Zt(null), Ba = Zt(null);
function Sd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Fa.Provider, { value: e, children: /* @__PURE__ */ p(Ba.Provider, { value: t, children: n }) });
}
function Ge() {
  return dt(Fa);
}
function dr() {
  return dt(Ba);
}
const ja = 1.414;
function Id({
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
  const b = Ge(), S = b == null ? void 0 : b.revisedBlocks, v = b == null ? void 0 : b.blockEdit, M = v == null ? void 0 : v.pendingEdits, L = b == null ? void 0 : b.editBlock, R = (b == null ? void 0 : b.findTerm) || "", z = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", P = b == null ? void 0 : b.textMarks, k = K(
    () => P ? ({ str: F }) => wu(F, P(F), R) : R ? ({ str: F }) => zt(F, R) : void 0,
    [R, P]
  ), T = A(c ?? ja), [E, x] = _(T.current);
  O(() => {
    c != null && Math.abs(c - T.current) >= 1e-3 && (T.current = c, x(c));
  }, [c]);
  const D = A(u);
  D.current = u;
  const W = A(null), H = A((F) => {
    var te;
    W.current = F, (te = D.current) == null || te.call(D, F);
  }).current, J = A(null), se = A(`${t}@${n}`);
  Ce(() => {
    const F = `${t}@${n}`;
    se.current !== F && (se.current = F, o && Td(W.current, J.current));
  }, [o, n, t]), O(() => {
    o || Nn(J.current);
  }, [o]), O(() => () => Nn(J.current), []);
  const G = Math.max(120, Math.floor(t * E)), ie = Math.max(G, Math.ceil(s || 0)), Ie = gt(f, t, G), ee = K(
    () => Ou(d, t, G),
    [G, d, t]
  ), [me, Te] = _(null), ae = typeof g == "function", fe = ae ? m ?? null : me, B = (F) => {
    ae ? F !== (m ?? null) && (g == null || g(F)) : Te((te) => te === F ? te : F);
  }, U = K(
    () => ee.find((F) => F.itemId === fe) || null,
    [fe, ee]
  ), X = r === "translated" && ((Q = v == null ? void 0 : v.target) == null ? void 0 : Q.itemId) || "", ce = K(
    () => X && ee.find((F) => F.itemId === X) || null,
    [X, ee]
  ), ne = bd(W, o ? U : null, ee, t), ue = (F) => {
    var Ne, Be, ze, Ae;
    if (F.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      B(null);
      return;
    }
    if (F.buttons !== 0) {
      B(null);
      return;
    }
    if ((Be = (Ne = F.target) == null ? void 0 : Ne.closest) != null && Be.call(Ne, `.${Ca}`) || (Ae = (ze = F.target) == null ? void 0 : ze.closest) != null && Ae.call(ze, `.${za}`)) return;
    const te = F.currentTarget.getBoundingClientRect(), he = F.clientX - te.left, Oe = F.clientY - te.top;
    if (hd(ne, he, Oe)) return;
    const De = eo(ee, he, Oe);
    B((De == null ? void 0 : De.itemId) || null);
  }, we = (F) => {
    if (F.pointerType === "mouse") return;
    const te = F.currentTarget.getBoundingClientRect(), he = eo(
      ee,
      F.clientX - te.left,
      F.clientY - te.top
    );
    B((he == null ? void 0 : he.itemId) || null);
  }, re = (F) => {
    !Number.isFinite(F) || F <= 0 || Math.abs(T.current - F) < 1e-3 || (T.current = F, x(F), l == null || l(e, F));
  };
  return /* @__PURE__ */ C(
    "div",
    {
      ref: H,
      [Pe]: e,
      [ke]: r,
      [ar]: G,
      className: sr,
      onPointerMoveCapture: ue,
      onPointerDown: we,
      onDoubleClick: (F) => {
        const te = b == null ? void 0 : b.zoomBlock;
        !te || b != null && b.pointerTaken || !U || Ue(U.highlight.region) === "figure" && (F.preventDefault(), te(U.itemId));
      },
      onPointerLeave: (F) => {
        F.pointerType === "mouse" && B(null);
      },
      style: {
        width: t,
        height: ie,
        minHeight: ie
      },
      children: [
        o ? /* @__PURE__ */ p(
          wi,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: k,
            renderAnnotationLayer: !1,
            className: ha,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: mn,
                style: { width: t, height: G }
              }
            ),
            onLoadSuccess: (F) => {
              try {
                const te = F.getViewport({ scale: 1 });
                if (te.width > 0) {
                  const he = te.height / te.width;
                  re(he);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Nn(J.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: mn,
            style: { width: t, height: G },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        Ie ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: Ie,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && I ? /* @__PURE__ */ p(
          ad,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: G
          }
        ) : null,
        o && I && w ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (M != null && M.size) ? /* @__PURE__ */ p(id, { targets: ee, edits: M, width: t, excludeId: ce == null ? void 0 : ce.itemId }) : null,
        o && ce && v ? /* @__PURE__ */ p(
          wd,
          {
            target: ce,
            page: { width: t, height: G },
            edit: v,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (S != null && S.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: ee.filter((F) => S.has(F.itemId)).map((F) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": F.itemId,
            style: { left: F.rect.left, top: F.rect.top, height: F.rect.height }
          },
          F.itemId
        )) }) : null,
        (ge = b == null ? void 0 : b.pageLayers) == null ? void 0 : ge.map((F) => /* @__PURE__ */ p(yn, { children: F.render({ page: e, width: t, height: G, pane: z, active: o }) }, F.id)),
        /* @__PURE__ */ p(
          Ju,
          {
            target: o && !(b != null && b.pointerTaken) && (U == null ? void 0 : U.itemId) !== (ce == null ? void 0 : ce.itemId) ? U : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: U && (S == null ? void 0 : S.get(U.itemId)) || 0,
            onEdit: L,
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
const kd = Yt(Id);
function Td(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Nn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Ed = 2 * 1024 * 1024;
function Rd(e) {
  const t = new la.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const An = 5, Pd = "120% 0px", Md = 120, _d = "25% 0px";
let no = 1;
const ro = /* @__PURE__ */ new WeakMap();
function Nd(e) {
  if (!e) return 0;
  const t = ro.get(e);
  if (t) return t;
  const n = no;
  return no += 1, ro.set(e, n), n;
}
function Ad() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const xd = _s(
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
    showLiveTranslation: M = t === "source",
    liveTranslationPendingLabel: L = "",
    paneAction: R
  }, z) {
    cu();
    const { file: P, loading: k, error: T } = ac(n, r), E = `${n}\0${Nd(P)}`, x = A(E);
    x.current = E;
    const D = K(() => {
      const $ = Qi(P);
      return $ ? "ranged" in $ ? { range: Rd($.ranged) } : $ : null;
    }, [P, n]), [W, H] = _(0), [J, se] = _(""), [G, ie] = _(null), [Ie, ee] = _(480), me = A(null), Te = A(0), ae = K(() => Ad(), []), fe = K(() => ({
      cMapUrl: Vt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Vt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Ed,
      disableAutoFetch: !0
    }), []);
    rr(z, () => G, [G]), O(() => {
      const $ = (Z) => {
        Te.current = Z, ee(Z);
      }, V = (Z) => {
        const be = Pc(Z, Te.current);
        if (be !== "ignore") {
          if (me.current && clearTimeout(me.current), be === "immediate") {
            $(Z);
            return;
          }
          me.current = setTimeout(() => $(Z), va);
        }
      }, Y = !!(c && c >= 80);
      V(Y ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ye = !Y && i && typeof ResizeObserver < "u" ? new ResizeObserver((Z) => {
        var be, Re;
        V(((Re = (be = Z[0]) == null ? void 0 : be.contentRect) == null ? void 0 : Re.width) ?? i.clientWidth);
      }) : null;
      return ye && i && ye.observe(i), () => {
        ye == null || ye.disconnect(), me.current && clearTimeout(me.current);
      };
    }, [c, i, a]);
    const B = K(
      () => Tc(Ie, o),
      [Ie, o]
    ), [U, X] = _(() => /* @__PURE__ */ new Map()), [ce, ne] = _(() => /* @__PURE__ */ new Set()), [ue, we] = _(() => /* @__PURE__ */ new Set()), re = A(/* @__PURE__ */ new Map()), Q = A(null), ge = A(null), [F, te] = _(() => /* @__PURE__ */ new Set()), he = A(/* @__PURE__ */ new Map()), Oe = N(($, V) => {
      X((Y) => {
        if (Y.get($) === V) return Y;
        const le = new Map(Y);
        return le.set($, V), le;
      });
    }, []), De = N(($, V) => {
      const Y = re.current, le = Y.get($), ye = [Q.current, ge.current];
      if (le)
        for (const Z of ye)
          try {
            Z == null || Z.unobserve(le);
          } catch {
          }
      if (V) {
        Y.set($, V);
        for (const Z of ye)
          try {
            Z == null || Z.observe(V);
          } catch {
          }
      } else
        Y.delete($);
    }, []), Ne = A(/* @__PURE__ */ new Map()), Be = N(($) => {
      const V = Ne.current;
      let Y = V.get($);
      return Y || (Y = (le) => De($, le), V.set($, Y)), Y;
    }, [De]);
    O(() => {
      if (typeof IntersectionObserver > "u") return;
      const $ = he.current, V = new IntersectionObserver(
        (Y) => {
          const le = [], ye = [];
          for (const Z of Y) {
            const be = Z.target, Re = pn(be);
            Number.isFinite(Re) && (Z.isIntersecting ? le : ye).push(Re);
          }
          if ((le.length || ye.length) && ne((Z) => {
            let be = null;
            for (const Re of le)
              Z.has(Re) || (be = be || new Set(Z), be.add(Re));
            for (const Re of ye)
              Z.has(Re) && (be = be || new Set(Z), be.delete(Re));
            return be || Z;
          }), le.length) {
            for (const Z of le) {
              const be = $.get(Z);
              be && (clearTimeout(be), $.delete(Z));
            }
            we((Z) => {
              let be = null;
              for (const Re of le)
                Z.has(Re) || (be = be || new Set(Z), be.add(Re));
              return be || Z;
            });
          }
          for (const Z of ye)
            $.has(Z) || $.set(Z, setTimeout(() => {
              $.delete(Z), we((be) => {
                if (!be.has(Z)) return be;
                const Re = new Set(be);
                return Re.delete(Z), Re;
              });
            }, Md));
        },
        { root: i, rootMargin: Pd, threshold: 0 }
      );
      Q.current = V;
      for (const Y of re.current.values())
        try {
          V.observe(Y);
        } catch {
        }
      return () => {
        V.disconnect(), Q.current === V && (Q.current = null);
        for (const Y of $.values()) clearTimeout(Y);
        $.clear();
      };
    }, [i]), O(() => {
      if (typeof IntersectionObserver > "u") return;
      const $ = new IntersectionObserver(
        (V) => {
          te((Y) => {
            let le = null;
            for (const ye of V) {
              const Z = pn(ye.target);
              !Number.isFinite(Z) || ye.isIntersecting === Y.has(Z) || (le = le || new Set(Y), ye.isIntersecting ? le.add(Z) : le.delete(Z));
            }
            return le || Y;
          });
        },
        { root: i, rootMargin: _d, threshold: 0 }
      );
      ge.current = $;
      for (const V of re.current.values())
        try {
          $.observe(V);
        } catch {
        }
      return () => {
        $.disconnect(), ge.current === $ && (ge.current = null);
      };
    }, [i]);
    const ze = !!i && typeof IntersectionObserver < "u";
    Ce(() => {
      H(0), se(""), ne(/* @__PURE__ */ new Set()), we(/* @__PURE__ */ new Set()), X(/* @__PURE__ */ new Map()), re.current.clear();
      const $ = he.current;
      for (const V of $.values()) clearTimeout(V);
      $.clear(), h == null || h(0, t);
    }, [E, h, t]);
    const Ae = N(
      ($) => {
        if (x.current !== E) return;
        const V = $.numPages;
        H(V), se(""), h == null || h(V, t), f == null || f({ numPages: V, pane: t }), m && typeof $.getPage == "function" && m($, t), d && typeof $.getOutline == "function" && su($).then((Y) => {
          x.current === E && d(Y, t);
        }, () => {
        });
      },
      [E, f, d, m, h, t]
    ), Ke = N(
      ($) => {
        if (x.current !== E) return;
        const V = ($ == null ? void 0 : $.message) || "PDF 解析失败";
        se(V), H(0), h == null || h(0, t), g == null || g($, t);
      },
      [E, g, h, t]
    ), $e = K(
      () => W > 0 ? Array.from({ length: W }, ($, V) => V + 1) : [],
      [W]
    );
    O(() => {
      typeof IntersectionObserver < "u" || we(new Set($e));
    }, [$e]);
    const Fe = K(
      () => Pt(y, w, t),
      [y, w, t]
    ), j = K(() => {
      const $ = /* @__PURE__ */ new Map();
      for (const V of I) {
        const Y = Pt(V, w, t);
        if (!Y) continue;
        const le = $.get(Y.box.page) || [];
        le.push(Y), $.set(Y.box.page, le);
      }
      return $;
    }, [t, w, I]), q = K(() => {
      const $ = /* @__PURE__ */ new Set();
      if (!b) return $;
      for (const [V, Y] of j)
        Y.some((le) => le.itemId === b) && $.add(V);
      return $;
    }, [b, j]), de = K(() => {
      if (W === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set($e);
      if (ce.size === 0) {
        const Y = Math.min(W, An * 2 + 1);
        return new Set(Array.from({ length: Y }, (le, ye) => ye + 1));
      }
      const V = /* @__PURE__ */ new Set();
      for (const Y of ce)
        for (let le = -An; le <= An; le++) {
          const ye = Y + le;
          ye >= 1 && ye <= W && V.add(ye);
        }
      return V;
    }, [W, $e, i, a, ce]), ve = !n || !!T || !!J, Me = n && (T || J) || s;
    return /* @__PURE__ */ C(
      "section",
      {
        ref: ie,
        className: `reader-panel ${wn}${a ? "" : " is-hidden"}`,
        [ke]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (v == null ? void 0 : v.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          R ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: R }) : null,
          L ? /* @__PURE__ */ C("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: L })
          ] }) : null,
          ve && !k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Me }) : null,
          k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          D && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Si,
            {
              file: D,
              loading: null,
              error: null,
              options: fe,
              onLoadSuccess: Ae,
              onLoadError: Ke,
              className: "reader-react-pdf-document",
              children: $e.map(($) => {
                if (de.has($))
                  return /* @__PURE__ */ p(
                    kd,
                    {
                      pane: t,
                      pageNumber: $,
                      width: B,
                      devicePixelRatio: ae,
                      active: ue.has($),
                      textLayer: !ze || F.has($),
                      syncedMinHeight: (l == null ? void 0 : l.get($)) || 0,
                      onMetrics: u,
                      cachedAspect: U.get($),
                      onAspectChange: Oe,
                      sentinelRef: Be($),
                      regionHighlight: (Fe == null ? void 0 : Fe.box.page) === $ ? Fe : null,
                      regionTargets: j.get($),
                      hoveredRegionId: b && q.has($) ? b : null,
                      onHoverRegion: S,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get($ - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get($ - 1),
                      showLiveTranslation: M,
                      liveTranslationMissing: Nl(v, $ - 1)
                    },
                    `${t}-${$}`
                  );
                const Y = U.get($) ?? ja, le = Math.max(120, Math.floor(B * Y)), ye = Math.max(le, Math.ceil((l == null ? void 0 : l.get($)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Be($),
                    [Pe]: $,
                    [ke]: t,
                    [ar]: le,
                    className: `${sr} is-placeholder`,
                    style: {
                      width: B,
                      height: ye,
                      minHeight: ye
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: mn,
                        style: { width: B, height: le },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${$}`
                );
              })
            },
            E
          ) }) : null
        ]
      }
    );
  }
), oo = Yt(xd), Ld = 2e3, Cd = 6, Dd = 500, ao = "reader-react-resizing";
function $d(e, t) {
  const n = A(null), r = A(null);
  Ce(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const S = Od(e), v = Ht(e, S);
      if (!v) return;
      s = { pane: S, progress: v, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), I = typeof ResizeObserver > "u" ? null : new ResizeObserver((S) => {
      let v = !1;
      for (const M of S) {
        const L = Math.round(M.contentRect.height);
        y.has(M.target) && y.get(M.target) !== L && (v = !0), y.set(M.target, L);
      }
      v && Mt(e, c, "auto", i);
    }), w = () => {
      var S;
      f && clearTimeout(f), cancelAnimationFrame(u), I == null || I.disconnect(), e.classList.remove(ao);
      for (const v of so) e.removeEventListener(v, w);
      ((S = r.current) == null ? void 0 : S.stop) === w && (r.current = null);
    }, b = () => {
      Mt(e, c, "auto", i);
      const S = e.scrollHeight;
      g = S === m ? g + 1 : 0, m = S;
      const v = performance.now() - h;
      g >= Cd && (S !== d || v > Dd) || v > Ld ? w() : u = requestAnimationFrame(b);
    };
    for (const S of so) e.addEventListener(S, w, { passive: !0 });
    for (const S of Array.from(e.children)) I == null || I.observe(S);
    e.classList.add(ao), r.current = { ...s, stop: w }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, va);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Od(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Pe}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ke) || null;
  }
  return null;
}
const so = ["wheel", "touchstart", "keydown", "pointerdown"];
function zd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Fd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(wn)) && ((n = e.hasAttribute) != null && n.call(e, ke)));
}
function Bd(e, t) {
  O(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Fd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${wn}[${ke}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = zd(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function jd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Hd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const io = 12;
function fr(e) {
  return Array.from(e.querySelectorAll(`.${wn}[${ke}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Ud(e) {
  const t = e.getBoundingClientRect();
  return fr(e).map((n) => {
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
function Kd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Wd(e, t) {
  return e ? fr(e).find((n) => n.getAttribute(ke) === t) ?? null : null;
}
function Vd({ shellEl: e }) {
  const [t, n] = _([]), r = A(0), o = N(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Ud(e);
      n((i) => Kd(i, s) ? i : s);
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
        for (const f of fr(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(qd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function qd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - io * 2), r = jd(e, n), o = A(null);
  if (!r) return null;
  const a = (d) => {
    const m = Wd(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + Hd(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + io, width: n },
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
function Jd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Gd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ C("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(
        oe,
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
            o ? /* @__PURE__ */ p(ea, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Xs, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ C("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ C(
        oe,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(ta, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ C(
        oe,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Ys, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function co({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Jd(t), a = [e === "compare" ? "对比" : "正在读", r, Ha(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ C("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Xd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = _({ source: null, translated: null });
  return Ce(() => {
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
  }, [e]), /* @__PURE__ */ C("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(co, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(co, { role: "reading", ...n }) }) : null
  ] });
}
const Yd = () => () => {
}, lo = () => null;
function Zd({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Qd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function ef(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function tf(e) {
  const t = Ge(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Qt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, I = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, S = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", v = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", M = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, L = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, R = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), z = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), P = t == null ? void 0 : t.onPdfOutline, k = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], x = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), D = (t == null ? void 0 : t.regionHover) ?? null, [W, H] = _(null), J = vn(
    D ? D.subscribe : Yd,
    D ? () => D.get().itemId : lo,
    D ? () => D.get().itemId : lo
  ), se = D ? J : W, G = N((me) => {
    D ? D.set(me, "pdf") : H(me);
  }, [D]), ie = Zd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), ee = Number.isFinite(g) && g > 0 ? Qd(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !ie.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return $d(d, ee), Bd(d, ie.compareMode), /* @__PURE__ */ C(
    "div",
    {
      ref: f,
      className: ma,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(js).length,
      "data-reader-metadata-ready": x ? "true" : "false",
      children: [
        /* @__PURE__ */ C(
          "main",
          {
            className: `${fa} reader-mode-${ie.mode}`,
            "data-reader-mode": ie.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                oo,
                {
                  pane: "source",
                  url: S,
                  preloadedFile: M,
                  userZoom: m,
                  visible: ie.showSource,
                  scrollRoot: d,
                  pageWidthOverride: ee,
                  rowHeights: ie.compareMode ? h : void 0,
                  onMetrics: R,
                  emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: z,
                  onOutline: b ? void 0 : P,
                  onDocument: b ? void 0 : k,
                  activeRegion: T,
                  regions: (b == null ? void 0 : b.regions) ?? E,
                  readerMetadata: x,
                  hoveredRegionId: se,
                  onHoverRegion: G,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? ef(o) : "",
                  paneAction: u && ie.showTranslated ? /* @__PURE__ */ C(Le, { children: [
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
                oo,
                {
                  pane: "translated",
                  url: v,
                  preloadedFile: L,
                  userZoom: m,
                  visible: ie.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: ee,
                  rowHeights: ie.compareMode ? h : void 0,
                  onMetrics: R,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: z,
                  onOutline: P,
                  onDocument: k,
                  activeRegion: T,
                  regions: E,
                  readerMetadata: x,
                  hoveredRegionId: se,
                  onHoverRegion: G,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Vd, { shellEl: d }),
        b ? /* @__PURE__ */ p(Xd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const nf = [
  { id: "source", label: "原文", Icon: na },
  { id: "compare", label: "对照", Icon: ra },
  { id: "translated", label: "译文", Icon: oa }
];
function rf(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function of(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function af(e) {
  const t = Ge(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? rf(a.state) : "";
  return /* @__PURE__ */ C("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }),
    /* @__PURE__ */ C("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: nf.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = of({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ C(yn, { children: [
          /* @__PURE__ */ p(
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
              children: /* @__PURE__ */ p(f, { ...Ee, "aria-hidden": !0 })
            }
          ),
          l === "compare" ? e.compareExtra : null
        ] }, l);
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
              /* @__PURE__ */ p(Zs, { ...Ee, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ C(
          oe,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Qs, { ...Ee, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ C(
        oe,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(ei, { ...Ee, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-end", children: e.end })
  ] });
}
const Ua = [];
function sf() {
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
function cf(e, t) {
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
function lf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function uf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function df(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function ff(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function mf(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function hf(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function pf(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const In = Zt(null), Ka = Zt(null);
function gf({ api: e, store: t, children: n }) {
  const r = K(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(In.Provider, { value: r, children: n });
}
function en() {
  const e = dt(In);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const bf = () => () => {
}, uo = () => Ua;
function yf(e) {
  return vn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Wa() {
  var t;
  const e = (t = dt(In)) == null ? void 0 : t.store;
  return vn((e == null ? void 0 : e.subscribe) ?? bf, (e == null ? void 0 : e.getSnapshot) ?? uo, (e == null ? void 0 : e.getSnapshot) ?? uo);
}
function kn(e) {
  var a;
  const t = (a = dt(In)) == null ? void 0 : a.store, n = dt(Ka);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  O(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), O(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class vf extends Ns {
  constructor() {
    super(...arguments);
    Ar(this, "state", { failed: !1 });
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
const wf = Yt(function({ extensions: t }) {
  return /* @__PURE__ */ p(Le, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(vf, { id: n, children: /* @__PURE__ */ p(Sf, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function Sf({ id: e, title: t, children: n }) {
  const r = K(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(Ka.Provider, { value: r, children: n });
}
function If({
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
      oe,
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
const fo = 6e3;
function Va(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function qa(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > fo && (s *= fo / i), {
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
  const s = A(null), [i, c] = _({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return O(() => {
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
const kf = 1600, mr = { left: 0, top: 0, width: 1, height: 1 };
function Ga(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function Tf(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function Ef(e, t, n = mr, r = kf) {
  const o = await e.getPage(t), a = qa(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, Ga(s);
}
async function Rf(e, t = mr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), Ga(s);
}
function Pf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const Mf = 4e3;
function _f(e, t, n) {
  if (e.length) {
    const o = iu(e, n), a = o ? Na(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function mo(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Pe}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, Mf), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function Nf(e, t, n, r, o) {
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
function Af({
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
  const l = e.getAttribute(ke) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? Nf(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: _f(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
function xf(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Pe}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Pe)) || 0, i = (o.closest(`[${ke}]`) ?? o).getAttribute(ke) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function Lf({ onDone: e, onCancel: t }) {
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
      return xf(c, l);
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
        const f = Tf(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const ho = 5e4, Cf = 2e4;
function xn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Hg(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Df(e, t = null) {
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
function $f(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Of(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function Ug(e, t) {
  var r;
  const n = Of(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Kg(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function zf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Ff(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Ff(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Bf(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = zf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: $f(o.selection, n),
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
function jf(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: xn(e.question.text, ho), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: xn(e.answer.text, ho),
      thought: e.answer.thought ? xn(e.answer.thought, Cf) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Hf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Uf(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Kf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Wf(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Vf = 50, Xa = 2, Ln = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function qf() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function po(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Jf({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = _(!1), [i, c] = _(Ln), [l, u] = _(!1), [f, d] = _(""), [m, g] = _("idle"), [h, y] = _(null), [I, w] = _([]), b = N((B) => {
    y(B), w([]);
  }, []), S = N((B) => w((U) => [...U, B].slice(-Xa)), []), [v, M] = _(() => /* @__PURE__ */ new Map()), L = A(/* @__PURE__ */ new Set()), R = A(/* @__PURE__ */ new Map()), z = (B) => {
    if (!B) return null;
    const U = R.current.get(B);
    return U || (P.current.records.some((X) => X.message_id === B) ? B : null);
  }, P = A(i);
  P.current = i;
  const k = A(t);
  k.current = t;
  const T = A(0), E = N(async (B, U, X, ce = []) => {
    if (!r) return;
    const ne = await r.messages(B.conversation_id, { limit: Vf, ...X ? { beforeSeq: X } : {} }), ue = [...ne.messages, ...ce];
    T.current += 1, c({
      conversation: B,
      main: U ?? B,
      records: ue,
      compactions: ne.compactions || [],
      hasMore: ne.has_more,
      key: `${B.conversation_id}:${T.current}`,
      initial: Bf(ue, ne.compactions || [], k.current.documentId)
    });
  }, [r]), x = N(async () => {
    s(!0);
    const B = P.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) === "main" && B.status !== "archived")) {
      u(!0), d("");
      try {
        const U = await r.main(k.current.documentId || void 0);
        await E(U, U);
      } catch (U) {
        d(U instanceof Error ? U.message : String(U));
      } finally {
        u(!1);
      }
    }
  }, [r, E]), D = N((B) => {
    b(B), x();
  }, [x]), W = A(t.documentId);
  O(() => {
    W.current !== t.documentId && (W.current = t.documentId, P.current = Ln, c(Ln), b(null), M(/* @__PURE__ */ new Map()), R.current.clear(), a && x());
  }, [t.documentId, a, x]);
  const H = N(async () => {
    const B = P.current, U = B.records[0];
    if (!(!B.conversation || !U || !B.hasMore)) {
      u(!0);
      try {
        await E(B.conversation, B.main, U.seq, B.records);
      } finally {
        u(!1);
      }
    }
  }, [E]), J = N(async (B) => {
    const X = P.current.conversation;
    if (!r || !X) return;
    for (const Q of B.memoryIds) L.current.add(Q);
    let ce = B.memoryIds;
    if (!ce.length && o && B.startedAt) {
      const Q = Uf(
        await o.list({ source_conversation_id: X.conversation_id, created_after: Hf(B.startedAt) }).catch(() => []),
        L.current
      );
      for (const F of Q) L.current.add(F.id);
      ce = Q.map((F) => F.id);
      const ge = B.answerId;
      Q.length && ge && M((F) => new Map(F).set(ge, Q));
    }
    const ne = jf({ ...B, memoryIds: ce }, k.current.documentId, qf(), z(B.editedFrom));
    let ue;
    try {
      ue = await r.append(X.conversation_id, ne);
    } catch (Q) {
      if (X.kind !== "side" || !/ask_conversation_not_open/.test(po(Q))) throw Q;
      await r.reopen(X.conversation_id), ue = await r.append(X.conversation_id, ne);
    }
    const [we, re] = ue.messages;
    B.questionId && we && R.current.set(B.questionId, we.message_id), B.answerId && re && R.current.set(B.answerId, re.message_id), c((Q) => {
      var ge;
      return ((ge = Q.conversation) == null ? void 0 : ge.conversation_id) === X.conversation_id ? { ...Q, conversation: ue.conversation, records: [...Q.records, ...ue.messages] } : Q;
    }), n == null || n(ue.messages), ue.compaction_due && X.kind === "main" && r.compact(X.conversation_id).catch(() => {
    });
  }, [r, o, n]), se = N(async (B) => {
    const U = P.current.conversation, X = z(B);
    if (!r || !U || !X) return null;
    try {
      await r.supersede(U.conversation_id, X);
    } catch (ue) {
      if (!/ask_message_superseded/.test(po(ue))) throw ue;
    }
    const ce = P.current.records.find((ue) => ue.message_id === X), ne = P.current.records.findIndex((ue) => ue.message_id === X);
    return c((ue) => ({ ...ue, records: ue.records.map((we, re) => re >= ne && ne >= 0 && !we.superseded_at ? { ...we, superseded_at: "now" } : we) })), (ce == null ? void 0 : ce.selection) ?? null;
  }, [r]), G = N((B) => {
    J(B).catch((U) => d(`这一轮没存上：${U instanceof Error ? U.message : String(U)}`));
  }, [J]), ie = N(async (B) => {
    var ce;
    const U = P.current, X = U.main;
    if (!(!r || !X || ((ce = U.conversation) == null ? void 0 : ce.kind) !== "main")) {
      d("");
      try {
        const ne = Kf(U.records, B), ue = await r.fork({
          parent_id: X.conversation_id,
          ...ne ? { forked_from_message_id: ne } : {},
          title: Wf(B.text),
          ...k.current.documentId ? { document_id: k.current.documentId } : {}
        });
        await E(ue, X);
      } catch (ne) {
        d(`开不了副对话：${ne instanceof Error ? ne.message : String(ne)}`);
      }
    }
  }, [r, E]), Ie = N(async (B) => {
    const U = P.current.main;
    if (r)
      try {
        await E(await r.get(B), U);
      } catch (X) {
        d(`打不开副对话：${X instanceof Error ? X.message : String(X)}`);
      }
  }, [r, E]), ee = N(async () => {
    const B = P.current.main;
    B && await E(B, B).catch(() => {
    });
  }, [E]), me = N(async () => {
    const B = P.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) !== "side")) {
      g("busy");
      try {
        await r.close(B.conversation_id), g("idle"), await ee();
      } catch {
        g("failed");
      }
    }
  }, [r, ee]), Te = N(async () => r != null && r.archived ? r.archived(k.current.documentId) : [], [r]), ae = N(async (B) => {
    d(""), b(null);
    try {
      await E(B, P.current.main);
    } catch (U) {
      d(`打不开这个对话：${U instanceof Error ? U.message : String(U)}`);
    }
  }, [E, b]), fe = N(async () => {
    const B = P.current.main;
    if (!r || !B) return;
    await r.archive(B.conversation_id);
    const U = await r.main(k.current.documentId || void 0);
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
    openMain: x,
    ask: D,
    close: N(() => s(!1), []),
    loadEarlier: H,
    onTurn: G,
    rewrite: se,
    fork: ie,
    openSide: Ie,
    backToMain: ee,
    closeSide: me,
    archiveMain: fe,
    listArchived: Te,
    viewArchived: ae,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function go(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Df({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Gf({ port: e, documentId: t, resetKey: n, pointOf: r }) {
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
      (h) => d(h.map((y) => go(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = N((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => go(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = N((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Xf = Xo(() => import("./ReaderAskPanel-B-63xUbv.js"));
function Yf({
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
  var Fe;
  const w = K(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), b = N((j, q, de) => {
    const ve = j ? o.find((V) => V.itemId === j) : null, Me = ve ? Pt(ve, a, q) : null, $ = Me && Me.box.page === de ? gt(Me, 1, 1) : null;
    return $ ? { x: $.left, y: $.top } : null;
  }, [o, a]), S = Gf({ port: e, documentId: t, resetKey: c, pointOf: b }), v = Jf({ port: e, book: w, onAppended: S.addRecords }), [M, L] = _(null), R = N(
    (j, q, de, ve) => Af({
      pageElement: (j == null ? void 0 : j.closest(`[${Pe}]`)) ?? null,
      clientX: q,
      clientY: de,
      itemId: i(),
      selection: ve,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), z = N(() => {
    var q;
    const j = mo(((q = globalThis.getSelection) == null ? void 0 : q.call(globalThis)) ?? null);
    return !j.text || !j.element || !j.rect ? null : R(j.element, j.rect.left + j.rect.width / 2, j.rect.top + j.rect.height / 2, j.text);
  }, [R]), P = N((j) => {
    L(null), v.ask(j);
  }, [v.ask]);
  O(() => {
    if (!e) return;
    const j = (q) => {
      var Me;
      if (q.key !== "?" || q.metaKey || q.ctrlKey || q.altKey || q.defaultPrevented) return;
      const de = q.target;
      if ((Me = de == null ? void 0 : de.closest) != null && Me.call(de, "input, textarea, select, [contenteditable='true']")) return;
      const ve = z();
      ve && (q.preventDefault(), q.stopImmediatePropagation(), P(ve));
    };
    return window.addEventListener("keydown", j, !0), () => window.removeEventListener("keydown", j, !0);
  }, [e, z, P]);
  const k = A(/* @__PURE__ */ new Set()), T = ((Fe = v.pending) == null ? void 0 : Fe.selection) || "";
  O(() => {
    T && k.current.add(T);
  }, [T]);
  const E = v.visible && !M, x = v.setPending, [D, W] = _(null), H = !!v.pending;
  O(() => {
    H || W(null);
  }, [H]);
  const J = A(v.pending);
  J.current = v.pending, O(() => {
    if (!E) return;
    let j = null;
    const q = () => {
      j && clearTimeout(j), j = setTimeout(() => {
        const de = z();
        !de || k.current.has(de.selection) || (J.current ? W(de) : x(de));
      }, 250);
    };
    return document.addEventListener("selectionchange", q), () => {
      j && clearTimeout(j), document.removeEventListener("selectionchange", q);
    };
  }, [E, z, x]);
  const se = v.addExtra, G = v.extras.length, ie = K(() => {
    if (!D) return null;
    const j = () => {
      k.current.add(D.selection), W(null);
    };
    return {
      label: `第 ${D.page} 页 · ${[...D.selection].length} 字`,
      replace: () => {
        j(), x(D);
      },
      ...G < Xa ? { add: () => {
        j(), se(D);
      } } : {},
      dismiss: j
    };
  }, [D, G, x, se]), Ie = A(m);
  Ie.current = m;
  const ee = N(async ({ page: j, pane: q, region: de, canvas: ve }) => {
    const Me = Ie.current[q];
    let $;
    if (Me)
      $ = await Ef(Me, j, de);
    else {
      const V = ve ?? document.querySelector(`[${ke}="${q}"] [${Pe}="${j}"] canvas`);
      if (!V) throw new Error(`第 ${j} 页还没画出来，翻到那一页再试`);
      $ = await Rf(V, de);
    }
    return new File([$], Pf(j, de), { type: "image/png" });
  }, []), [me, Te] = _(null), ae = A(v.pending);
  ae.current = v.pending;
  const fe = K(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(ti, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const j = ae.current, q = (j == null ? void 0 : j.pane) || (h === "translated" ? "translated" : "source");
      return ee({ page: (j == null ? void 0 : j.page) || g() || 1, pane: q, region: mr });
    }
  }], [ee, g, h]), [B, U] = _(!1), [X, ce] = _(""), ne = N(async (j) => {
    U(!1), ce("");
    try {
      const q = await ee(j), de = R(j.point.target, j.point.x, j.point.y, "");
      Te((ve) => ({ id: ((ve == null ? void 0 : ve.id) || 0) + 1, files: [q] })), de ? P({ ...de, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (q) {
      ce(q instanceof Error ? q.message : String(q));
    }
  }, [ee, R, P]), ue = N(() => U(!1), []), we = N(() => {
    ce(""), U((j) => !j);
  }, []), re = N(async (j) => {
    if (j.threadId && (e != null && e.threads) && t) {
      try {
        const q = await e.threads.get(t, j.threadId);
        L({ anchor: q.anchor || j.anchor, messages: q.messages || [], mark: j });
      } catch {
        L({ anchor: j.anchor, messages: [], mark: j });
      }
      return;
    }
    L(null), v.openMain();
  }, [e, t, v.openMain]), Q = N((j) => {
    var ve;
    if (!e) return [];
    const q = mo(((ve = globalThis.getSelection) == null ? void 0 : ve.call(globalThis)) ?? null), de = R(j.target, j.clientX, j.clientY, q.element ? q.text : "");
    return de ? [{
      key: "ask",
      label: de.selection ? "问这段" : "在这里提问",
      hint: de.selection ? "?" : void 0,
      onSelect: () => P(de)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        ce(""), U(!0);
      }
    }] : [];
  }, [e, R, P]), ge = M ? {
    anchor: M.anchor,
    messages: M.messages,
    onClose: () => L(null),
    onDelete: e != null && e.threads && M.mark.threadId ? () => {
      e.threads.remove(t, M.mark.threadId).catch(() => {
      }), S.removeMark(M.mark.key), L(null);
    } : void 0
  } : null, F = K(() => f ? (j, q) => {
    f(j, q ?? void 0), requestAnimationFrame(() => d(j, "translated"));
  } : null, [f, d]), te = N((j) => La(o, j), [o]), [he, Oe] = _(0), De = N(({ mode: j, width: q }) => {
    Oe(j === "dock" ? Math.round(q) : 0);
  }, []), Ne = !v.persistent || !!v.view.conversation || !!v.error, Be = e && (v.visible && Ne || M) ? /* @__PURE__ */ p(Go, { fallback: null, children: /* @__PURE__ */ p(
    Xf,
    {
      port: e,
      jobId: n,
      book: w,
      ask: v,
      legacy: ge,
      onShowSelection: ({ page: j, pane: q }) => l(j, q),
      onJumpToPage: (j) => l(j),
      pageCount: u,
      onLayout: De,
      dockTaken: y !== null,
      dockHost: I,
      onEditBlock: F,
      canEditBlock: te,
      attachTools: fe,
      attachRequest: me,
      contextOffer: ie
    }
  ) }) : null, ze = B || X ? /* @__PURE__ */ C(Le, { children: [
    B ? /* @__PURE__ */ p(Lf, { onDone: (j) => void ne(j), onCancel: ue }) : null,
    X ? /* @__PURE__ */ C("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => ce(""), children: [
      "截图没成：",
      X
    ] }) : null
  ] }) : null, Ae = v.visible && Ne || !!M, Ke = v.close, $e = N(() => {
    if (Ae) {
      L(null), Ke();
      return;
    }
    v.openMain();
  }, [Ae, Ke, v.openMain]);
  return { marks: S.marks, onMark: re, menuItems: Q, panel: Be, overlay: ze, cropping: B, toggleCrop: we, open: v.openMain, toggle: $e, showing: Ae, reserveRight: Ae ? he : 0, enabled: !!e };
}
const Zf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Qf() {
  const e = en(), t = K(() => {
    try {
      return nt().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Yf({
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
      Icon: ni,
      pressed: d,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: ri,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: h, height: y }) => /* @__PURE__ */ p(If, { marks: r, page: h, height: y, onOpen: o }) : void 0,
    shortcuts: Zf,
    reserveRight: m,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, m, c, l]);
  return kn(g), /* @__PURE__ */ C(Le, { children: [
    s,
    i
  ] });
}
const em = { id: "ask", title: "提问", Component: Qf };
function Vn() {
  try {
    return nt().translationVersions ?? null;
  } catch {
    return null;
  }
}
function tm(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function nm(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function rm(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function om({ documentId: e, jobId: t }) {
  const [n, r] = _([]), [o, a] = _(null);
  O(() => {
    r([]);
    const i = Vn();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = nm(n, t, o);
  return K(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function am({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = _(null), [s, i] = _(""), [c, l] = _(""), u = A(0);
  O(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = N((g) => {
    const h = Vn(), y = n.find((w) => w.versionId === g);
    if (!h || !y || !e) return;
    const I = ++u.current;
    i(g), l(""), (async () => {
      const w = nt(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const S = await w.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), v = w.resolveReaderTranslatedPdfUrl(S.jobPayload, S.manifestPayload);
      if (!v) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: v, regions: tm(Zo(S.regionsPayload)) };
    })().then((w) => {
      I === u.current && a(w);
    }).catch((w) => {
      I === u.current && l((w == null ? void 0 : w.message) || "这一份打不开。");
    }).finally(() => {
      I === u.current && i("");
    });
  }, [e, n]), d = N(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), m = N(async () => {
    var y, I;
    const g = Vn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (w) {
      l((w == null ? void 0 : w.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((I = globalThis.history) == null || I.replaceState(globalThis.history.state, "", rm(h, o.jobId))), a(null);
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
function sm(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: oi,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(Gd, { compare: e, onDone: t })
  } : null;
}
function im(e) {
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
function cm() {
  var i;
  const e = en(), t = am({
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
  const s = K(() => {
    const c = sm(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: im(t) };
  }, [t]);
  return kn(s), null;
}
const lm = { id: "compare", title: "对比版本", Component: cm }, Ya = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], bo = { pen: 35e-4, highlighter: 0.018 }, yo = 0.015, qn = "retainpdf.reader.ink.v1:";
function vo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(qn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function um(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(qn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(qn + e);
    } catch {
    }
}
function dm(e, t, n, r, o, a) {
  const s = yo * yo;
  return e.filter((i) => Za(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Za(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function fm(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function mm(e) {
  const [t, n] = _(null), [r, o] = _(Ya[0].key), [a, s] = _(() => vo(e)), i = A(a), c = A([]);
  O(() => {
    const h = vo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = N((h) => {
    i.current = h, s(h), um(e, h);
  }, [e]), u = N((h) => {
    const y = i.current, I = h(y);
    I !== y && (c.current = [...c.current.slice(-49), y], l(I));
  }, [l]), f = N((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = N((h) => {
    h.length && u((y) => y.filter((I) => !h.includes(I.id)));
  }, [u]), m = N((h) => {
    u((y) => y.some((I) => I.page === h) ? y.filter((I) => I.page !== h) : y);
  }, [u]), g = N(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return K(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const hm = [
  { tool: "pen", label: "画笔", Icon: un },
  { tool: "highlighter", label: "荧光笔", Icon: ai },
  { tool: "eraser", label: "橡皮", Icon: si }
];
function pm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function gm({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ C(Le, { children: [
    hm.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      oe,
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
      oe,
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
    /* @__PURE__ */ p(oe, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(ii, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(ci, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      oe,
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
function wo({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(gm, { ink: e, page: t, onPick: n }) });
}
function bm(e) {
  const t = A(e);
  t.current = e, O(() => {
    const n = (r) => {
      if (pm(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const ym = "reader-ink-layer";
function vm(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function So({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: vm(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function wm({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = _(null), i = A(!1), c = o.strokes.filter((h) => Za(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(dm(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s([[y, I]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s((w) => w ? fm(w, y, I) : [[y, I]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: bo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      className: ym,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(So, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(So, { stroke: { tool: o.tool, color: o.color, width: bo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const Sm = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function Im(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: un,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ C("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
        /* @__PURE__ */ p(un, { ...Ee }),
        /* @__PURE__ */ p("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` } })
      ] }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p(wo, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(wo, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(wm, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: Sm
  };
}
function km() {
  const e = en(), t = mm(e.resetKey);
  bm(t);
  const n = K(() => Im(t), [t]);
  return kn(n), null;
}
const Tm = { id: "ink", title: "画笔", Component: km };
function Em(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
const Rm = Xo(() => import("./ReaderMarkdownPanel-BdAhCmpW.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Qa = { id: "markdown", label: "Markdown", short: "MD", Icon: li, needsJob: !0 };
function Pm() {
  const e = en(), t = e.activePanel === Qa.id;
  if (!Em(t)) return null;
  const r = /* @__PURE__ */ p(Go, { fallback: null, children: /* @__PURE__ */ p(Rm, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? vi(r, e.panelHost) : r;
}
const Mm = {
  id: "markdown",
  title: "Markdown",
  Component: Pm,
  panels: [Qa]
}, es = "reader-xref", Jn = "data-xref", Bt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, _m = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Bt})`), Nm = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Gn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Am(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function xm(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Lm(e, t, n) {
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
function Cm(e, t, n) {
  return (e.find((o) => Ue(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Dm(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ue(r), s = xm(r);
    if (a === "formula") {
      for (const g of s.matchAll(Nm)) {
        const h = Gn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = _m.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = Am(i[1]), u = Gn(i[2]), f = Lm(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Cm(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const $m = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Bt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Bt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Bt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Bt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Om(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of $m) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Gn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function zm(e, t) {
  return Om(e, t).map((n) => ({ start: n.start, end: n.end, className: es, attrs: { [Jn]: n.key } }));
}
const Fm = { figure: "图", table: "表", equation: "式" };
function Io(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Fm[e.kind]} ${e.label}`;
}
const ko = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Bm(e, t, n) {
  const r = Pt(e, t, n), o = r ? gt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Va({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function jm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = Pt(u, t, n), d = f ? gt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Va({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Hm(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function Um(e, t) {
  const n = (o) => {
    const a = Ue(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Km({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var z;
  const i = t.find((P) => P.itemId === e) ?? null, c = K(() => i ? Um(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = _(rt.indexOf(1)), d = rt[u], m = A(null), [g, h] = _(0);
  Ce(() => {
    const P = m.current;
    if (!P) return;
    const k = () => h(P.clientWidth);
    k();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(k) : null;
    return T == null || T.observe(P), () => T == null ? void 0 : T.disconnect();
  }, []);
  const y = N((P) => {
    const k = c[l + P];
    k && a(k.itemId);
  }, [c, l, a]);
  O(() => {
    const P = (k) => {
      if (k.key === "Escape")
        k.preventDefault(), s();
      else if (k.key === "ArrowLeft")
        k.preventDefault(), y(-1);
      else if (k.key === "ArrowRight")
        k.preventDefault(), y(1);
      else if (k.key === "+" || k.key === "=")
        k.preventDefault(), f((T) => Math.min(rt.length - 1, T + 1));
      else if (k.key === "-" || k.key === "_")
        k.preventDefault(), f((T) => Math.max(0, T - 1));
      else if (k.key === "0")
        k.preventDefault(), f(rt.indexOf(1));
      else
        return;
      k.stopPropagation();
    };
    return window.addEventListener("keydown", P, !0), () => window.removeEventListener("keydown", P, !0);
  }, [s, y]), O(() => {
    const P = m.current;
    if (!P) return;
    const k = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), f((E) => Math.max(0, Math.min(rt.length - 1, E + (T.deltaY < 0 ? 1 : -1)))));
    };
    return P.addEventListener("wheel", k, { passive: !1 }), () => P.removeEventListener("wheel", k);
  }, []);
  const I = A(null);
  if (!i) return null;
  const w = Ue(i), b = o.map((P) => ({ pane: P, pdf: r[P] ?? null, where: Bm(i, n, P) })).filter((P) => !!(P.pdf && P.where)), S = 16, v = typeof window > "u" ? 800 : window.innerHeight, M = Math.min(880, v * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), L = b.length ? Hm(Math.max(120, (g - S * (b.length - 1) - 32) / b.length), M, b.map((P) => P.where.aspect)) : 0, R = ((z = b[0]) == null ? void 0 : z.where.page) ?? i.source.page;
  return /* @__PURE__ */ C("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${ko[w] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ C("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ C("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ C("span", { className: "reader-zoom-title", children: [
          ko[w] ?? "这一块",
          " · 第 ",
          R,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ C("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Qo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(aa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((P) => Math.max(0, P - 1)), children: /* @__PURE__ */ p(sa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ C(oe, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(rt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => f((P) => Math.min(rt.length - 1, P + 1)), children: /* @__PURE__ */ p(ia, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(At, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (P) => {
            const k = m.current;
            !k || P.button !== 0 || (I.current = { x: P.clientX, y: P.clientY, left: k.scrollLeft, top: k.scrollTop }, k.setPointerCapture(P.pointerId));
          },
          onPointerMove: (P) => {
            const k = m.current, T = I.current;
            !k || !T || (k.scrollLeft = T.left - (P.clientX - T.x), k.scrollTop = T.top - (P.clientY - T.y));
          },
          onPointerUp: () => {
            I.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: S }, children: b.map(({ pane: P, pdf: k, where: T }) => /* @__PURE__ */ C("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: P === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Ja,
              {
                className: "reader-zoom-canvas",
                pdf: k,
                page: T.page,
                region: T.fraction,
                cssWidth: L * d,
                label: `${P === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, P)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Wm = 380, Vm = 320, vt = 8;
function qm(e, t, n) {
  const r = Math.max(vt, Math.min(e.left, n.width - t.width - vt)), o = e.bottom + vt, a = o + t.height <= n.height - vt ? o : Math.max(vt, e.top - vt - t.height);
  return { left: r, top: a };
}
function Jm({
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
    const m = r[d], g = m ? jm(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Wm, Vm / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = qm(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ C("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ C("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Io(e.target) }),
      /* @__PURE__ */ C("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Ja, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Io(e.target) })
  ] });
}
const Gm = 250;
function Xm(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Ym(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Zm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Qm({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = _(null), [s, i] = _({ back: [], forward: [] }), c = A(s);
  c.current = s;
  const l = A(null), u = A({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = N(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Ht(m, g);
  }, []);
  O(() => {
    if (!e) return;
    const m = (b) => {
      var S, v;
      return (v = (S = b.target) == null ? void 0 : S.closest) == null ? void 0 : v.call(S, `.${es}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var L;
      const S = m(b);
      if (!S) return;
      const v = u.current.index.get(S.getAttribute(Jn) || "");
      if (!v) return;
      const M = ((L = S.closest("[data-reader-pane]")) == null ? void 0 : L.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const R = S.getBoundingClientRect();
        a({ target: v, pane: M, anchor: { left: R.left, top: R.top, right: R.right, bottom: R.bottom } });
      }, Gm);
    }, y = (b) => {
      const S = m(b);
      !S || S.contains(b.relatedTarget) || (g(), a(null));
    }, I = (b) => {
      var R, z;
      const S = m(b);
      if (!S || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((R = window.getSelection) == null ? void 0 : R.call(window)) || ""}`.trim()) return;
      const v = u.current.index.get(S.getAttribute(Jn) || "");
      if (!v) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const M = ((z = S.closest("[data-reader-pane]")) == null ? void 0 : z.getAttribute("data-reader-pane")) || u.current.primaryPane, L = f();
      L && i((P) => Xm(P, L)), u.current.follow(v, M);
    }, w = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", I, !0), e.addEventListener("scroll", w, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", I, !0), e.removeEventListener("scroll", w);
    };
  }, [e, f]);
  const d = N((m) => {
    const g = f();
    if (!g) return !1;
    const h = Ym(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: I } = u.current;
    return Mt(y, h.to, "auto", I) ? (i(h.history), !0) : !1;
  }, [f]);
  return O(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Zm(g.target)) return;
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
const eh = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function th() {
  const e = en(), t = K(() => Dm(e.regions), [e.regions]), { jumpToBlock: n } = e, r = N((s, i) => n(s.itemId, i), [n]), o = Qm({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = K(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => zm(s, t) : void 0,
    shortcuts: eh
  }), [t]);
  return kn(a), /* @__PURE__ */ C(Le, { children: [
    o.preview ? /* @__PURE__ */ p(Jm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ C(oe, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(ui, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const nh = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: th }, hr = [Tm, Mm, lm, nh, em];
function pr(e = hr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function rh(e) {
  const t = Ge(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Le, { children: (e.tabs ?? pr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
        children: /* @__PURE__ */ p(c, { className: "reader-close-home-icon", ...Ee, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function oh(e) {
  const t = Ge(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = pr().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
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
        children: /* @__PURE__ */ p(At, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function ah(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function sh(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function ih(e) {
  return e / 100 * window.innerHeight;
}
function ch(e) {
  return e / 100 * window.innerWidth;
}
function lh(e) {
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
  const [o, a] = lh(n);
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
      r = sh(t, o);
      break;
    }
    case "em": {
      r = ah(t, o);
      break;
    }
    case "vh": {
      r = ih(o);
      break;
    }
    case "vw": {
      r = ch(o);
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
function Xn(e) {
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
function pe(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Yn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? uh : dh
  );
}
function uh(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function dh(e, t) {
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
function fh({
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
  return pe(o, "No rect found"), o;
}
let an;
function mh() {
  return an === void 0 && (typeof matchMedia == "function" ? an = !!matchMedia("(pointer:coarse)").matches : an = !1), an;
}
function rs(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Yn(
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
                  const M = m[0], L = fh({
                    orientation: n,
                    rects: [I, w],
                    targetRect: M.element.getBoundingClientRect()
                  });
                  b = [
                    M,
                    L === I ? v : S
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
              const M = mh() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (v.width < M) {
                const R = M - v.width;
                v = new DOMRect(
                  v.x - R / 2,
                  v.y,
                  v.width + R,
                  v.height
                );
              }
              if (v.height < M) {
                const R = M - v.height;
                v = new DOMRect(
                  v.x,
                  v.y - R / 2,
                  v.width,
                  v.height + R
                );
              }
              const L = g <= l || g > u;
              !i && !L && s.push({
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
    Lr(this, at, {});
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
const gr = new os();
function mt() {
  return Et;
}
function hh(e) {
  return gr.addListener("change", e);
}
function ph(e) {
  const t = Et, n = { ...Et };
  n.cursorFlags = e, Et = n, gr.emit("change", {
    prev: t,
    next: n
  });
}
function Rt(e) {
  const t = Et;
  Et = e, gr.emit("change", {
    prev: t,
    next: e
  });
}
const gh = (e) => e, Cn = () => {
}, as = 1, ss = 2, is = 4, cs = 8, To = 3, Eo = 12;
let sn;
function Ro() {
  return sn === void 0 && (sn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (sn = !0)), sn;
}
function bh({
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
        if (e && Ro()) {
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
    return Ro() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Po = /* @__PURE__ */ new WeakMap();
function br(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Po.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = mt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = bh({
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
  Po.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let qe = /* @__PURE__ */ new Map();
const ls = new os();
function yh(e) {
  qe = new Map(qe), qe.delete(e);
}
function Mo(e, t) {
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
function yr(e, t) {
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
      }), t.hitRegions.length > 0 && (br(e), n = !0, t.hitRegions.forEach((r) => {
        const o = it(r.group.id, !0);
        tt(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function _o(e) {
  e.defaultPrevented || us(e.currentTarget);
}
function vh(e, t, n) {
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
function wh(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Sh(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: xo(e),
    b: xo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  pe(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Ao(No(n.a)),
    b: Ao(No(n.b))
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
const Ih = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function kh(e) {
  const t = getComputedStyle(ds(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Th(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || kh(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Ih.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function No(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (pe(n, "Missing node"), Th(n)) return n;
  }
  return null;
}
function Ao(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function xo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ds(e);
  return t;
}
function ds(e) {
  const { parentNode: t } = e;
  return wh(t) ? t.host : t;
}
function Eh(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Rh({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!ts(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Sh(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Eh(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function vr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = rs(o), s = vh(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Rh({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Ph(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function _e(e, t, n = 0) {
  return Math.abs(xe(e) - xe(t)) <= n;
}
function Ve(e, t) {
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
  if (_e(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  pe(u != null, "Invalid first pivot index"), pe(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, y = n[h];
        pe(
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
          if (pe(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), _e(S, I)) {
            const v = b - S;
            Ve(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      {
        const h = e < 0 ? u : f, y = n[h];
        pe(
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
          if (pe(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), _e(S, b)) {
            const v = S - I;
            Ve(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, y = n[h];
      pe(
        y,
        `Panel constraints not found for index ${h}`
      );
      const I = i[h], { collapsible: w, collapsedSize: b, minSize: S } = y;
      if (w && Ve(I, S) < 0)
        if (e > 0) {
          const v = S - b, M = v / 2, L = I + e;
          Ve(L, S) < 0 && (e = Ve(e, M) <= 0 ? 0 : v);
        } else {
          const v = S - b, M = 100 - v / 2, L = I - e;
          Ve(L, S) < 0 && (e = Ve(100 + e, M) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, I = 0;
    for (; ; ) {
      const b = i[y];
      pe(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const S = kt({
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
      pe(
        I != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = I - y, b = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: I,
        size: w
      });
      if (!_e(I, b) && (d += I - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Ph(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    pe(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const I = y + d, w = kt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: I
    });
    if (l[h] = w, !_e(w, I)) {
      let b = I - w, S = e < 0 ? f : u;
      for (; S >= 0 && S < n.length; ) {
        const v = l[S];
        pe(
          v != null,
          `Previous layout not found for panel index ${S}`
        );
        const M = v + b, L = kt({
          overrideDisabledPanels: s,
          panelConstraints: n[S],
          prevSize: v,
          size: M
        });
        if (_e(v, L) || (b -= L - v, l[S] = L), _e(b, 0))
          break;
        e > 0 ? S-- : S++;
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
  if (!_e(o, 100) && r.length > 0)
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
  if (!_e(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      pe(c != null, `No layout data found for index ${i}`);
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
      return (w == null ? void 0 : w.collapsible) && _e(w.collapsedSize, u[w.panelId]);
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
      return c && _e(l, u);
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
function Lo(e) {
  if (e.defaultPrevented)
    return;
  const t = bt();
  vr(e, t).forEach((n) => {
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
function cn(e) {
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
  const n = cn(e), r = it(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  pe(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  pe(a, "Matching panels not found");
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
  const t = e.currentTarget, n = cn(t);
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
        const r = cn(t), o = it(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
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
          lt(t, m - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = cn(t).separators.map(
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
        e.preventDefault(), lt(t, -100);
        break;
      }
    }
}
function Do(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = bt(), n = vr(e, t), r = /* @__PURE__ */ new Map();
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
      separatorToPanels: M
    } = I;
    if (b && v && M) {
      const L = Jt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((R) => m.indexOf(R)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (ht(L, v)) {
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
          layout: L,
          separatorToPanels: M
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & To : c |= i & To, t.movementY === 0 ? c |= s & Eo : c |= i & Eo, ph(c), br(e);
}
function $o(e) {
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
function Oo(e) {
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
      const a = vr(e, n);
      a.length === 0 ? t.state !== "inactive" && Rt({
        cursorFlags: 0,
        state: "inactive"
      }) : Rt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), br(e.currentTarget);
      break;
    }
  }
}
function zo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (mt().state) {
      case "hover":
        Rt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Fo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || us(e.currentTarget) && e.preventDefault();
}
function Bo(e) {
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
function Mh(e, t, n) {
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
function _h(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Nh({
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
function Ah(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const wt = /* @__PURE__ */ new Map();
function xh(e) {
  let t = !0;
  pe(
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
          const S = Xn(e), v = b.defaultLayoutDeferred ? Bo(S) : b.layout, M = Nh({
            group: e,
            nextGroupSize: w,
            prevGroupSize: b.groupSize,
            prevLayout: v
          }), L = pt({
            layout: M,
            panelConstraints: S
          });
          if (!b.defaultLayoutDeferred && ht(b.layout, L) && _h(
            b.derivedPanelConstraints,
            S
          ) && b.groupSize === w)
            return;
          tt(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: S,
            groupSize: w,
            layout: L,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        Mh(e, I, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    pe(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = _t({ group: e }), i = Xn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Ah(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? Bo(i), f = pt({
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
    pe(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Co);
  }), wt.get(d) === 1 && (d.addEventListener("contextmenu", _o, !0), d.addEventListener("dblclick", Lo, !0), d.addEventListener("pointerdown", Do, !0), d.addEventListener("pointerleave", $o), d.addEventListener("pointermove", Oo), d.addEventListener("pointerout", zo), d.addEventListener("pointerup", Fo, !0)), function() {
    t = !1, wt.set(
      d,
      Math.max(0, (wt.get(d) ?? 0) - 1)
    ), yh(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Co);
    }), wt.get(d) || (d.removeEventListener(
      "contextmenu",
      _o,
      !0
    ), d.removeEventListener(
      "dblclick",
      Lo,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Do,
      !0
    ), d.removeEventListener("pointerleave", $o), d.removeEventListener("pointermove", Oo), d.removeEventListener("pointerout", zo), d.removeEventListener("pointerup", Fo, !0)), a.disconnect();
  };
}
function Lh() {
  const [e, t] = _({}), n = N(() => t({}), []);
  return [e, n];
}
function wr(e) {
  const t = Yo();
  return `${e ?? t}`;
}
const yt = typeof window < "u" ? Ce : O;
function Ut(e) {
  const t = A(e);
  return yt(() => {
    t.current = e;
  }, [e]), N(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Sr(...e) {
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
function Ir(e) {
  const t = A({ ...e });
  return yt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ps = Zt(null);
function Ch(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: gh
  });
  rr(t, () => n.current, []), yt(() => {
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
  const g = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Ut((k) => {
    ht(g.current.onLayoutChange, k) || (g.current.onLayoutChange = k, c == null || c(k));
  }), y = Ut(
    (k, T) => {
      ht(g.current.onLayoutChanged, k) || (g.current.onLayoutChanged = k, l == null || l(k, { isUserInteraction: T }));
    }
  ), I = wr(i), w = A(null), [b, S] = Lh(), v = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), M = Sr(w, a);
  Ch(I, s);
  const L = Ut(
    (k, T) => {
      const E = mt(), x = Mo(k), D = it(k);
      if (D) {
        let W = !1;
        switch (E.state) {
          case "active": {
            W = E.hitRegions.some(
              (H) => H.group === x
            );
            break;
          }
        }
        return {
          flexGrow: D.layout[T] ?? 1,
          pointerEvents: W ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), R = Ir({
    defaultLayout: n,
    disableCursor: r
  }), z = K(
    () => ({
      get disableCursor() {
        return !!R.disableCursor;
      },
      getPanelStyles: L,
      id: I,
      orientation: u,
      registerPanel: (k) => {
        const T = v.current;
        return T.panels = Yn(u, [
          ...T.panels,
          k
        ]), S(), () => {
          T.panels = T.panels.filter(
            (E) => E !== k
          ), S();
        };
      },
      registerSeparator: (k) => {
        const T = v.current;
        return T.separators = Yn(u, [
          ...T.separators,
          k
        ]), S(), () => {
          T.separators = T.separators.filter(
            (E) => E !== k
          ), S();
        };
      },
      updatePanelProps: (k, { disabled: T }) => {
        const E = v.current.panels.find(
          (W) => W.id === k
        );
        E && (E.panelConstraints.disabled = T);
        const x = Mo(I), D = it(I);
        x && D && tt(x, {
          ...D,
          derivedPanelConstraints: Xn(x)
        });
      },
      updateSeparatorProps: (k, {
        disabled: T,
        disableDoubleClick: E
      }) => {
        const x = v.current.separators.find(
          (D) => D.id === k
        );
        x && (x.disabled = T, x.disableDoubleClick = E);
      }
    }),
    [L, I, S, u, R]
  ), P = A(null);
  return yt(() => {
    const k = w.current;
    if (k === null)
      return;
    const T = v.current;
    let E;
    if (R.defaultLayout !== void 0 && Object.keys(R.defaultLayout).length === T.panels.length) {
      E = {};
      for (const G of T.panels) {
        const ie = R.defaultLayout[G.id];
        ie !== void 0 && (E[G.id] = ie);
      }
    }
    const x = {
      disabled: !!o,
      element: k,
      id: I,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!R.disableCursor,
        expandedPanelSizes: v.current.lastExpandedPanelSizes,
        layouts: v.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    P.current = x;
    const D = xh(x), { defaultLayoutDeferred: W, derivedPanelConstraints: H, layout: J } = it(x.id, !0);
    !W && H.length > 0 && (h(J), y(J, !1));
    const se = yr(I, (G) => {
      const { defaultLayoutDeferred: ie, derivedPanelConstraints: Ie, layout: ee } = G.next;
      if (ie || Ie.length === 0)
        return;
      const me = x.panels.map(({ id: ae }) => ae).join(",");
      x.mutableState.layouts[me] = ee, Ie.forEach((ae) => {
        if (ae.collapsible) {
          const { layout: fe } = G.prev ?? {};
          if (fe) {
            const B = _e(
              ae.collapsedSize,
              ee[ae.panelId]
            ), U = _e(
              ae.collapsedSize,
              fe[ae.panelId]
            );
            B && !U && (x.mutableState.expandedPanelSizes[ae.panelId] = fe[ae.panelId]);
          }
        }
      });
      const Te = mt().state !== "active";
      h(ee), Te && y(ee, G.isUserInteraction);
    });
    return () => {
      P.current = null, D(), se();
    };
  }, [
    o,
    I,
    y,
    h,
    u,
    b,
    R
  ]), O(() => {
    const k = P.current;
    k && (k.mutableState.defaultLayout = n, k.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ps.Provider, { value: z, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": I,
      id: I,
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
gs.displayName = "Group";
function kr() {
  const e = dt(ps);
  return pe(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Dh(e, t) {
  const { id: n } = kr(), r = A({
    collapse: Cn,
    expand: Cn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Cn
  });
  rr(t, () => r.current, []), yt(() => {
    Object.assign(
      r.current,
      fs({ groupId: n, panelId: e })
    );
  });
}
function Zn({
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
  const h = !!c, y = wr(c), I = Ir({
    disabled: a
  }), w = A(null), b = Sr(w, s), {
    getPanelStyles: S,
    id: v,
    orientation: M,
    registerPanel: L,
    updatePanelProps: R
  } = kr(), z = f !== null, P = Ut(
    (x, D, W) => {
      f == null || f(x, c, W);
    }
  );
  yt(() => {
    const x = w.current;
    if (x !== null) {
      const D = {
        element: x,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: z ? P : void 0,
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
      return L(D);
    }
  }, [
    i,
    n,
    r,
    o,
    z,
    y,
    h,
    l,
    u,
    P,
    L,
    I
  ]), O(() => {
    R(y, { disabled: a });
  }, [a, y, R]), Dh(y, d);
  const k = () => {
    const x = S(v, y);
    if (x)
      return JSON.stringify(x);
  }, T = vn(
    (x) => yr(v, x),
    k,
    k
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
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...$h,
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
            touchAction: M === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Zn.displayName = "Panel";
const $h = {
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
function Oh({
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
  const c = wr(a), l = Ir({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = _({}), [d, m] = _("inactive"), [g, h] = _(!1), y = A(null), I = Sr(y, o), {
    disableCursor: w,
    id: b,
    orientation: S,
    registerSeparator: v,
    updateSeparatorProps: M
  } = kr(), L = S === "horizontal" ? "vertical" : "horizontal";
  yt(() => {
    const P = y.current;
    if (P !== null) {
      const k = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: P,
        id: c
      }, T = v(k), E = hh(
        (D) => {
          m(
            D.next.state !== "inactive" && D.next.hitRegions.some(
              (W) => W.separator === k
            ) ? D.next.state : "inactive"
          );
        }
      ), x = yr(
        b,
        (D) => {
          const { derivedPanelConstraints: W, layout: H, separatorToPanels: J } = D.next, se = J.get(k);
          if (se) {
            const G = se[0], ie = se.indexOf(G);
            f(
              Oh({
                layout: H,
                panelConstraints: W,
                panelId: G.id,
                panelIndex: ie
              })
            );
          }
        }
      );
      return () => {
        E(), x(), T();
      };
    }
  }, [b, c, v, l]), O(() => {
    M(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, M]);
  let R;
  n && !w && (R = "not-allowed");
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
const Tr = 30, Er = 65, Gt = 50, zh = 100 - Er, Fh = 100 - Tr;
function Bh(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Er, Math.max(Tr, t)) : Gt;
}
function Rr(e) {
  return 100 - e;
}
function St(e) {
  return `${e}%`;
}
const Pr = "reader-document", Xt = "reader-assistant", ys = "retainpdf.reader.ai-split-layout.v1", jh = {
  [Pr]: Rr(Gt),
  [Xt]: Gt
};
function Mr(e) {
  const t = Bh(e == null ? void 0 : e[Xt]);
  return {
    [Pr]: Rr(t),
    [Xt]: t
  };
}
function Hh() {
  try {
    const e = JSON.parse(localStorage.getItem(ys) || "null");
    return Mr(e);
  } catch {
    return jh;
  }
}
function Uh(e) {
  try {
    localStorage.setItem(ys, JSON.stringify(Mr(e)));
  } catch {
  }
}
function Dn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Mr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Xt]}vw`
  );
}
function Kh() {
  const e = A(null), [t] = _(Hh);
  Ce(() => {
    const o = e.current;
    return Dn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = N((o) => {
    Dn(e.current, o);
  }, []), r = N((o, a) => {
    Dn(e.current, o), a.isUserInteraction && Uh(o);
  }, []);
  return /* @__PURE__ */ C(
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
          Zn,
          {
            id: Pr,
            defaultSize: St(Rr(Gt)),
            minSize: St(zh),
            maxSize: St(Fh)
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
          Zn,
          {
            id: Xt,
            defaultSize: St(Gt),
            minSize: St(Tr),
            maxSize: St(Er)
          }
        )
      ]
    }
  );
}
function Wh({
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
    n ? /* @__PURE__ */ p(oe, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function Vh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Wh, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ C(Le, { children: [
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
      s ? /* @__PURE__ */ p(oe, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function qh(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Jh() {
  const [e, t] = _(!1), n = Yo(), r = A(null), o = Wa(), a = K(() => [...Ul, ...pf(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || qh(i.target)) return;
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
        children: /* @__PURE__ */ p(di, { ...Ee, "aria-hidden": !0 })
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
const Gh = ["source", "sideBySide", "translated"], Xh = { source: "", translated: "", sideBySide: "" };
function Yh(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = ln(e.sourceUrl), n = ln(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Ci({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Zh(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = K(
    () => e ? Yh(e) : Xh,
    [e]
  ), o = K(
    () => Gh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = N(async (s) => {
    if (!e) return;
    const i = ln(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Li(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Di(
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
        $i(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Qh = {
  source: na,
  sideBySide: ra,
  translated: oa
}, ep = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function tp(e) {
  const t = Ge(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Zh(n), i = A(null);
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
      /* @__PURE__ */ p(fi, { ...Ee, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = Ls[c], u = ln(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : Cs(c, r), g = Qh[c];
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
            /* @__PURE__ */ p(g, { ...Ee, "aria-hidden": !0 }),
            /* @__PURE__ */ C("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ C("span", { className: "reader-download-action-label", children: [
                ep[c],
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
const np = "retainpdf:reader:bookmarks:v1:", rp = 200;
function _r() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function vs(e) {
  const t = `${e || ""}`.trim();
  return t ? `${np}${t}` : "";
}
function op(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Kt(e, t = _r()) {
  const n = vs(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = op(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const Qn = /* @__PURE__ */ new Set();
function ap(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return Qn.add(n), () => {
    Qn.delete(n);
  };
}
function er(e, t, n) {
  const r = vs(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, rp);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...Qn]) a(e);
  return o;
}
function sp(e, t, n = "", { storage: r = _r(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Kt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? er(e, a.filter((i) => i.page !== s), r) : er(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function ip(e, t, n = _r()) {
  return er(e, Kt(e, n).filter((r) => r.page !== t), n);
}
function cp(e, t) {
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
  O(() => (r(Kt(e)), ap(e, () => r(Kt(e)))), [e]);
  const o = N((s) => {
    r(sp(e, s, cp(t, s)));
  }, [e, t]), a = N((s) => r(ip(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
function lp({ filled: e }) {
  return /* @__PURE__ */ p(mi, { ...Ee, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function up({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = ws(e, r);
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
        children: /* @__PURE__ */ p(lp, { filled: i })
      }
    ),
    /* @__PURE__ */ p(dp, {})
  ] });
}
function dp() {
  const [e, t] = _(!1), n = A(null);
  return O(() => {
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
  }, [e]), /* @__PURE__ */ C("span", { className: "reader-favorites", ref: n, children: [
    /* @__PURE__ */ p(
      oe,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": e,
        "aria-haspopup": "dialog",
        "aria-label": "收藏",
        title: "收藏（还在做）",
        onClick: () => t((r) => !r),
        children: /* @__PURE__ */ p(hi, { ...Ee, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ C("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ p("strong", { children: "收藏" }),
      /* @__PURE__ */ p("p", { children: "还在做：以后可以把喜欢的段落、整页收在这里，按书分好，随时翻回来。现在先用「书签」记页。" })
    ] }) : null
  ] });
}
function fp(e) {
  const t = Ge(), n = dr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Qt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = kc(a), f = a > pa + 1e-3, d = a < gn - 1e-3, m = It(r, Tt()), g = m >= gn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, y] = _(!1), [I, w] = _(`${i}`);
  O(() => {
    h || w(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const S = Number(`${I}`.trim());
    l(bn(S, c));
  };
  return /* @__PURE__ */ C("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ C("div", { className: "reader-bottombar-start", children: [
      e.bookmarkScope ? /* @__PURE__ */ p(
        up,
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
            !l || c <= 0 || (w(`${i}`), y(!0));
          },
          children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
        }
      ) }),
      e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
      t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
        oe,
        {
          className: "reader-react-hud-btn reader-react-hud-doc-dark",
          "aria-pressed": t.docDark ? "true" : "false",
          "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
          title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
          onClick: t.toggleDocDark,
          children: /* @__PURE__ */ p(pi, { ...Ee, "aria-hidden": !0 })
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
            onClick: () => s(qt(a, -1)),
            children: /* @__PURE__ */ p(sa, { ...Ee, "aria-hidden": !0 })
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
            onClick: () => s(qt(a, 1)),
            children: /* @__PURE__ */ p(ia, { ...Ee, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ C("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Jh, {}) })
    ] })
  ] });
}
function jo(e) {
  var t, n;
  return wa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function mp(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: jo(Je(e))
  }));
  O(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: jo(Je(e))
    });
  }, [e]), O(() => {
    t.scope === e && Sn(t.scope, {
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
const tr = "download-toast";
function hp({
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
function pp(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    On.dismiss(tr);
    return;
  }
  On.custom(
    () => /* @__PURE__ */ p(hp, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: tr, duration: 1 / 0 }
  );
}
function gp() {
  const e = N((t) => {
    t && (t.setState = pp, t.hide = () => On.dismiss(tr));
  }, []);
  return /* @__PURE__ */ C(Le, { children: [
    /* @__PURE__ */ p(Ws, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Ho = { itemId: null, origin: null };
function bp() {
  let e = Ho;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Ho : { itemId: n, origin: r };
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
const Uo = ["ask"];
function yp(e) {
  const t = (n) => {
    const r = Uo.indexOf(n.id);
    return r < 0 ? Uo.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function nr({
  place: e,
  active: t = null,
  extensions: n = hr
}) {
  const r = e === "side" ? yp(n) : n, [o, a] = _(null), s = Wa(), i = (d) => {
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
    const m = i(d.id), g = e === "side" ? pr([d]) : [];
    return !m.length && !g.length ? null : /* @__PURE__ */ C(yn, { children: [
      m.map((h) => {
        const y = `${d.id}:${h.key}`, I = h.Icon;
        return /* @__PURE__ */ C("span", { className: "reader-bar-tool-group", "data-has-dropdown": h.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ p(
            oe,
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
              children: e === "compare" ? /* @__PURE__ */ p(dn, { ...Gr, "aria-hidden": !0 }) : h.mark ?? /* @__PURE__ */ p(I, { ...Ee, "aria-hidden": !0 })
            }
          ),
          h.dropdown ? /* @__PURE__ */ p(
            oe,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${h.label}：选项`,
              title: `${h.label}的选项`,
              "aria-expanded": o === `${y}:dropdown`,
              "data-bar-tool-caret": h.key,
              onClick: () => a((w) => w === `${y}:dropdown` ? null : `${y}:dropdown`),
              children: /* @__PURE__ */ p(dn, { ...Gr, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(rh, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ C("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "side" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const Ko = { search: "搜索", bookmarks: "书签", issues: "待改" }, vp = [];
function wp({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ C("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ C(oe, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(ca, { ...Ee, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function Sp({
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
  var L;
  const d = ((L = Ge()) == null ? void 0 : L.regions) ?? vp, m = K(() => bu(d, s), [d, s]), [g, h] = _(-1);
  O(() => h(-1), [s]);
  const y = A(null), I = A(null), w = A(n);
  w.current = n, O(() => {
    if (c) return;
    const R = (P) => {
      var T, E;
      const k = P.target;
      !k || (T = I.current) != null && T.contains(k) || (E = k.closest) != null && E.call(k, ".reader-finder-toggles, [data-finder-toggle]") || w.current();
    }, z = (P) => {
      P.key === "Escape" && w.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", z), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", z);
    };
  }, [c]);
  const b = A(null);
  O(() => {
    var R;
    e === "search" && ((R = y.current) == null || R.focus());
  }, [e, i]), O(() => {
    var R, z, P;
    e === "search" && g >= 0 && ((P = (z = (R = b.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null ? void 0 : z.scrollIntoView) == null || P.call(z, { block: "nearest" }));
  }, [e, g]);
  const S = (R) => {
    const z = m[R];
    z && (h(R), r(z.itemId));
  }, v = ["search", ...l ? ["bookmarks"] : [], ...u ? ["issues"] : []], M = v.includes(e) ? e : "search";
  return /* @__PURE__ */ C("aside", { ref: I, className: "reader-finder", "data-finder-tab": M, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${Ko[M]}`, children: [
    /* @__PURE__ */ C("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: v.map((R) => /* @__PURE__ */ C(oe, { className: "reader-finder-tab", role: "tab", "aria-selected": M === R, onClick: () => t(R), children: [
        Ko[R],
        R === "issues" && f ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, R)) }),
      /* @__PURE__ */ p(oe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(At, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    M === "bookmarks" ? l : M === "issues" ? u : null,
    M !== "search" ? null : /* @__PURE__ */ C(Le, { children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          or,
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
              R.key === "Enter" ? (R.preventDefault(), S(yu(g, m.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), c ? R.currentTarget.blur() : n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: m.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${m.length >= 200 ? "200+ 处，只列前 200 处" : `${m.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { ref: b, className: "reader-finder-list", children: m.map((R, z) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(oe, { className: "reader-finder-entry is-hit", "aria-current": z === g ? "true" : void 0, onClick: () => S(z), children: [
        /* @__PURE__ */ C("span", { className: "reader-finder-entry-text", children: [
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
const Ip = 24, Ot = 28, Wo = 15;
function Is(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function ks(e, t) {
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
function kp(e, t) {
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
function Tp(e, t) {
  const n = Is(e) > Ip, r = Math.max(1, Math.ceil(e.length / Ot)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= Ot) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(Ot / 2)), o.length - Ot);
  return o.slice(s, s + Ot);
}
function Ep(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const Rp = [];
function Pp({ pinned: e, available: t, onToggle: n }) {
  return /* @__PURE__ */ p(
    oe,
    {
      className: "reader-toc-toggle",
      "aria-label": "目录",
      "aria-pressed": e,
      disabled: !t,
      title: t ? e ? "收起目录" : "把目录固定在左边" : "这本书没有目录",
      onClick: n,
      children: /* @__PURE__ */ p(gi, { ...Ee, "aria-hidden": !0 })
    }
  );
}
function Vo({ bookmarks: e, onJumpPage: t, onJumpBlock: n, pinned: r = !1, docked: o = !1, onPinChange: a }) {
  var P, k;
  const s = ((P = Ge()) == null ? void 0 : P.regions) ?? Rp, i = ((k = dr()) == null ? void 0 : k.currentPage) ?? 1, c = K(() => ks(e, Aa(s)), [e, s]), l = K(() => kp(c, i), [c, i]), u = K(() => Tp(c, l), [c, l]), f = Is(c), [d, m] = _(""), g = K(() => Ep(c, d), [c, d]), [h, y] = _(() => /* @__PURE__ */ new Set()), I = A(null), w = A(!1), b = () => {
    l.chapterId && !h.has(l.chapterId) && y((T) => new Set(T).add(l.chapterId)), w.current = !0;
  };
  if (O(() => {
    (r || o) && b();
  }, [r, o]), Ce(() => {
    var T, E, x;
    w.current && (w.current = !1, (x = (E = (T = I.current) == null ? void 0 : T.querySelector('[aria-current="location"]')) == null ? void 0 : E.scrollIntoView) == null || x.call(E, { block: "center" }));
  }), !c.length) return null;
  const S = (T) => y((E) => {
    const x = new Set(E);
    return x.has(T) ? x.delete(T) : x.add(T), x;
  }), v = (T, E) => {
    y((x) => x.has(E) ? x : new Set(x).add(E)), T.itemId ? n(T.itemId) : T.page !== null && t(T.page);
  }, M = !!d.trim(), L = (T, E) => /* @__PURE__ */ C(
    oe,
    {
      className: "reader-toc-entry",
      "data-depth": Math.min(T.depth, 3),
      "aria-current": T.id === l.nodeId ? "location" : void 0,
      disabled: !T.itemId && T.page === null,
      title: T.page === null ? "这条书签没有指到页" : `${T.title}（第 ${T.page} 页）`,
      onClick: () => v(T, E),
      children: [
        /* @__PURE__ */ p("span", { className: "reader-toc-title", children: T.title }),
        T.page !== null ? /* @__PURE__ */ C("span", { className: "reader-toc-page", children: [
          "p.",
          T.page
        ] }) : null
      ]
    }
  ), R = r ? "取消固定" : "固定在左边", z = /* @__PURE__ */ C(Le, { children: [
    /* @__PURE__ */ C("div", { className: "reader-toc-head", children: [
      /* @__PURE__ */ p("span", { className: "reader-toc-head-title", children: "目录" }),
      /* @__PURE__ */ p(oe, { className: "reader-toc-pin", "aria-label": R, title: R, "aria-pressed": r, onClick: () => a == null ? void 0 : a(!r), children: r ? /* @__PURE__ */ p(bi, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(ta, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) })
    ] }),
    f > Wo ? /* @__PURE__ */ C("div", { className: "reader-toc-filter", children: [
      /* @__PURE__ */ p(ca, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ p(
        or,
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
      d ? /* @__PURE__ */ p(oe, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => m(""), children: /* @__PURE__ */ p(At, { size: 12, "aria-hidden": !0 }) }) : null
    ] }) : null,
    /* @__PURE__ */ p("div", { className: "reader-toc-list", ref: I, children: g.length ? g.map((T) => {
      const E = M || h.has(T.id);
      return /* @__PURE__ */ C("div", { className: "reader-toc-chapter", children: [
        /* @__PURE__ */ C("div", { className: "reader-toc-chapter-row", children: [
          T.children.length ? /* @__PURE__ */ p(
            oe,
            {
              className: "reader-toc-caret",
              "aria-expanded": E,
              "aria-label": `${E ? "收起" : "展开"}「${T.title}」`,
              onClick: () => S(T.id),
              children: E ? /* @__PURE__ */ p(dn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(aa, { size: 12, "aria-hidden": !0 })
            }
          ) : /* @__PURE__ */ p("span", { className: "reader-toc-caret-space" }),
          L(T, T.id)
        ] }),
        E ? T.children.map((x) => /* @__PURE__ */ p("div", { children: L(x, T.id) }, x.id)) : null
      ] }, T.id);
    }) : /* @__PURE__ */ p("p", { className: "reader-toc-empty", children: "没有匹配的章节" }) })
  ] });
  return o ? /* @__PURE__ */ p("nav", { className: "reader-toc-dock", "aria-label": "目录", children: z }) : /* @__PURE__ */ C(
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
        /* @__PURE__ */ p("div", { className: "reader-toc-card", "data-compact": f <= Wo ? "true" : void 0, children: z })
      ]
    }
  );
}
function Mp({ active: e }) {
  return /* @__PURE__ */ C("div", { className: "reader-side-rail", role: "toolbar", "aria-orientation": "vertical", "aria-label": "面板和下载", children: [
    /* @__PURE__ */ p(nr, { place: "side", active: e }),
    /* @__PURE__ */ p("span", { className: "reader-side-rail-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(tp, {})
  ] });
}
function _p(e) {
  const [t, n] = _([]);
  return O(() => {
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
function Np(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Ap = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, xp = ["failed", "content", "layout"];
function Lp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Cp(e, t, n) {
  const r = _p(e), [o, a] = _(-1);
  O(() => a(-1), [r]);
  const s = N((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = A({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, O(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || Lp(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = Np(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function Dp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function $p(e) {
  var r;
  if (e.shiftKey || Dp(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${ma}`))) return null;
  const n = Number((r = t.closest(`[${Pe}]`)) == null ? void 0 : r.getAttribute(Pe)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Op({
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
      oe,
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
    r.map((c) => /* @__PURE__ */ p(yn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function zp({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ C("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      oe,
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
const Ts = "retainpdf:reader:doc-theme:v1", qo = "data-reader-doc";
function Es() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Fp(e = Es()) {
  try {
    return (e == null ? void 0 : e.getItem(Ts)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Bp(e, t = Es()) {
  try {
    t == null || t.setItem(Ts, e);
  } catch {
  }
}
function Jo(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(qo, "dark") : t.removeAttribute(qo));
}
function jp() {
  const [e, t] = _(() => Fp());
  O(() => {
    Jo(e);
  }, [e]), O(() => () => Jo("light"), []);
  const n = N(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Bp(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function Hp({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = ws(e, t);
  return a.length ? /* @__PURE__ */ p("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ C("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ C(
      oe,
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
    /* @__PURE__ */ p(oe, { className: "reader-bookmark-remove", "aria-label": `删除第 ${i.page} 页的书签`, title: "删除这个书签", onClick: () => s(i.page), children: "×" })
  ] }, i.page)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: "还没有书签。底栏的书签按钮给眼下这一页加一个。" });
}
function Up({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ C("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    xp.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ C("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ C("h4", { children: [
          Ap[o],
          /* @__PURE__ */ p("span", { children: a.length })
        ] }),
        /* @__PURE__ */ p("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(oe, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
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
function Kp({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: f } = e, d = Ge(), m = dr(), g = (m == null ? void 0 : m.currentPage) ?? 1, h = n.issues.length;
  return /* @__PURE__ */ p(Le, { children: r ? /* @__PURE__ */ p(
    Sp,
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
        Hp,
        {
          scope: t,
          regions: d == null ? void 0 : d.regions,
          currentPage: g,
          numPages: (m == null ? void 0 : m.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: h ? /* @__PURE__ */ p(Up, { nav: n }) : void 0,
      issueCount: h
    }
  ) : null });
}
function Wp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(Le, { children: n ? /* @__PURE__ */ p(
    Km,
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
function Vp(e) {
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
const qp = 720;
function Jp(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= qp;
}
function Gp(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Xp(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = _(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Vp({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = Ml({
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
    f.current !== e.viewStateKey && Al({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function Yp(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = _l(e.liveTranslation), i = N(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = _(null);
  O(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && xl({
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
function Zp() {
  const [e] = _(sf), t = yf(e), n = mf(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function Qp(e, t, n) {
  const r = A(e);
  O(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function eg(e, t, {
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
  const y = N(() => h.current, []), I = K(() => ({
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
  ]), { contributionStore: w, contributions: b, reserveRight: S } = t, v = K(() => lf(b), [b]), M = K(() => hf(b), [b]), L = K(() => ff(b), [b]), R = K(() => uf(b), [b]), z = df(b);
  return { readerApi: I, contributionStore: w, contributions: b, pageLayers: v, compareVersion: M, textMarks: L, menuSections: R, pointerTakenId: z, reserveRight: S };
}
function tg() {
  try {
    return nt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const ng = "这本书正在处理（翻译或排版），处理完才能改。", rg = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function og({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = tg(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = Su(s), l = !t || Wt(t), u = Pu(n), [f, d] = _(""), [m, g] = _(null), [h, y] = _(() => /* @__PURE__ */ new Map()), [I, w] = _(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, S] = _(() => /* @__PURE__ */ new Map()), [v, M] = _({ phase: "idle" }), L = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  O(() => {
    g(null), L.drafts.clear(), L.generation.current = null, S(/* @__PURE__ */ new Map()), M({ phase: "idle" });
  }, [s]), O(() => {
    if (d(""), !i || c || !a) return;
    let D = !1;
    return a.resolveOwnerJobId(s).then((W) => {
      D || d(`${W || s}`.trim() || s);
    }).catch(() => {
      D || d(s);
    }), () => {
      D = !0;
    };
  }, [i, c, a, s]), O(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let D = !1;
    return a.fetchRevisions(f).then((W) => {
      D || y(Mu(W, u));
    }).catch(() => {
    }), () => {
      D = !0;
    };
  }, [a, f, u, l]);
  const R = v.phase === "running" && v.seenActive;
  O(() => {
    if (v.phase === "running") {
      if (!l) {
        R || M({ phase: "running", seenActive: !0 });
        return;
      }
      R && M(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [v.phase, R, l, t]);
  const z = K(() => {
    const D = new Map(h);
    if (I.renderedAt === u)
      for (const [W, H] of I.edits) D.set(W, H);
    return D;
  }, [h, I, u]), P = N((D) => {
    const W = `${D || ""}`.trim();
    W && g({ itemId: W, page: Iu(W) });
  }, []), k = N(() => g(null), []), T = N((D, W) => {
    w((H) => {
      const J = new Map(H.renderedAt === u ? H.edits : []);
      return J.set(D, W), { renderedAt: u, edits: J };
    }), S((H) => new Map(H).set(D, (H.get(D) || 0) + 1));
  }, [u]), E = N(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      M({ phase: "submitting" });
      try {
        await a.rerender(s), M({ phase: "running", seenActive: !1 }), await o();
      } catch (D) {
        M({ phase: "failed", message: (D == null ? void 0 : D.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), x = c ? rg : !l || v.phase === "running" || v.phase === "submitting" ? ng : "";
  return K(() => ({
    available: i,
    blockedReason: x,
    port: a,
    ownerJobId: f,
    target: m,
    select: P,
    close: k,
    memory: L,
    pendingEdits: z,
    savedCounts: b,
    markSaved: T,
    rerender: v,
    startRerender: E
  }), [i, x, a, f, m, P, k, L, z, b, T, v, E]);
}
function ag(e, t) {
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
function sg(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = og({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = N((d, m) => {
    La(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  ag(a.available ? u : null, n);
  const f = K(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const ig = "reader-finder-input";
function cg(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function lg(e, t = typeof window > "u" ? null : window) {
  O(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!cg(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(ig) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const Rs = "retainpdf.reader.sidebar.v1", ug = ["search", "bookmarks", "issues"], dg = 900;
function fg() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(Rs)) || "{}");
    return { tab: ug.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function mg(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(Rs, JSON.stringify(e));
  } catch {
  }
}
function hg() {
  const e = `(min-width: ${dg}px)`, [t, n] = _(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
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
function pg(e) {
  const [t] = _(fg), [n, r] = _(null), [o, a] = _(t.tab), i = hg(), c = N((v) => {
    r(v), v && a(v);
  }, []);
  O(() => {
    mg({ tab: n || o });
  }, [n, o]);
  const l = N(() => r((v) => v ? null : o), [o]), u = N((v) => {
    r((M) => M === v ? null : v), a(v);
  }, []), [f, d] = _(""), [m, g] = _("");
  O(() => {
    const v = f.replace(/\s+/gu, " ").trim(), M = window.setTimeout(() => g(v), v ? 150 : 0);
    return () => window.clearTimeout(M);
  }, [f]);
  const [h, y] = _(0), I = N(() => {
    c("search"), y((v) => v + 1);
  }, [c]);
  lg(I);
  const w = N(() => {
    i || r(null);
  }, [i]), b = N((v) => {
    e.jumpToAnchor({ block_id: v }), w();
  }, [e.jumpToAnchor, w]), S = N((v) => {
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
function gg(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ba(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function bg(e, t) {
  return t === null || e !== t;
}
function yg(e, t) {
  const { boot: n } = e, r = A(null), o = A(null);
  O(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Je(e.viewStateKey), s = gg({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Tt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      bg(e.mode, o.current) && (o.current = null, Sn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const vg = [];
function wg(e) {
  const { sessionFiles: t } = e, [n, r] = _({}), o = A({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = N((y, I) => {
    r((w) => ({ ...w, [I]: { url: o.current[I], nodes: y } }));
  }, []), s = K(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const I = n.translated;
    return I && I.url === t.translatedUrl && I.nodes.length ? I.nodes : vg;
  }, [n, t.sourceUrl, t.translatedUrl]), i = A({}), [c, l] = _(0), u = N((y, I) => {
    i.current[I] = { url: o.current[I], pdf: y }, l((w) => w + 1);
  }, []), [f, d] = _(null), m = N((y) => d(y), []), g = N(() => d(null), []);
  O(() => d(null), [e.viewStateKey]);
  const h = K(() => {
    const y = (I, w) => {
      const b = i.current[I];
      return b && b.url === w ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
function Sg() {
  const e = jl(), { boot: t, panes: n, session: r } = e, o = mp(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = Zp(), { reserveRight: l } = c, u = i || l > 0, f = pg(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, [h, y] = _(!1), I = h && f.pinned, w = N(() => {
    s(null);
  }, []);
  Qp(l, a, w);
  const { liveTranslationVisible: b, setLiveTranslationVisible: S, paneComposition: v, liveToggles: M, sourceViewOnly: L, visiblePdfMode: R } = Xp(
    e,
    i,
    Jp(e.shell.shellWidth, u || g || I)
  );
  yg(e, L);
  const z = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: P, toggleDocDark: k } = jp();
  Jl({
    toggleDocDark: k,
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
  const { latestLivePage: T, jumpToLatestLivePage: E, offerCompletion: x, setCompletionDismissedKey: D, sourcePaneAction: W } = Yp(e, {
    liveTranslationVisible: b,
    setLiveTranslationVisible: S,
    liveToggles: M,
    sourceViewOnly: L,
    visiblePdfMode: R
  }), H = N(($) => {
    const V = Gp($, e.liveTranslationAvailable);
    V !== null && S(V), e.setModeKeepingPage($);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), J = N(($) => {
    s($);
  }, []), [se] = _(bp), G = N(($) => e.jumpToAnchor({ block_id: $ }), [e.jumpToAnchor]), ie = Cp(e.sourceOnly ? "" : r.jobId, e.currentPage, G), [Ie, ee] = _(null), me = N(($, V) => e.jumpToAnchor({ block_id: $ }, V), [e.jumpToAnchor]), { bookmarks: Te, onPdfOutline: ae, onPdfDocument: fe, zoomItem: B, setZoomItem: U, zoomBlock: X, closeZoom: ce, zoomDocuments: ne } = wg(e), ue = K(() => ks(Te, Aa(r.regions)).length > 0, [Te, r.regions]), { blockEdit: we, editBlock: re, revisedBlocks: Q } = sg(e, R, se), [ge, F] = _(null), te = N(() => F(null), []), he = om({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: Oe,
    contributionStore: De,
    contributions: Ne,
    pageLayers: Be,
    compareVersion: ze,
    textMarks: Ae,
    menuSections: Ke,
    pointerTakenId: $e
  } = eg(e, c, {
    translationVersions: he,
    bookmarks: Te,
    regionHover: se,
    assistantPanel: a,
    closeAssistant: w,
    visiblePdfMode: R,
    changeWorkspace: H,
    jumpToBlockIn: me,
    zoomDocuments: ne,
    editBlock: we.available && !we.blockedReason ? re : null,
    panelHost: Ie
  }), Fe = !!$e, [j, q] = _([]), de = K(() => ({
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
    regionHover: se,
    jumpToBlock: G,
    revisedBlocks: Q,
    onPdfOutline: ae,
    onPdfDocument: fe,
    zoomBlock: X,
    textMarks: Ae,
    pageLayers: Be,
    editBlock: we.available ? re : void 0,
    blockEdit: we,
    editShowsSource: R !== "compare",
    findTerm: d === "search" ? m : "",
    compareVersion: ze,
    pointerTaken: Fe,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: L,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: J, close: w },
    docDark: P,
    toggleDocDark: k
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
    se,
    G,
    Q,
    ae,
    fe,
    X,
    Ae,
    Be,
    we,
    re,
    R,
    d,
    m,
    ze,
    Fe,
    e.sourceOnly,
    L,
    e.download,
    e.goToPage,
    J,
    w,
    P,
    k
  ]), ve = K(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Me = [
    yc,
    `is-workspace-${z}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    I && ue ? "is-toc-docked" : "",
    v.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(gf, { api: Oe, store: De, children: /* @__PURE__ */ p(Sd, { value: de, hud: ve, children: /* @__PURE__ */ C(
    "div",
    {
      className: Me,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": z,
      "data-pointer-taken": $e || void 0,
      onContextMenu: ($) => {
        const V = $p($);
        if (!V) return;
        const Y = cf(Ne, { target: $.target, clientX: $.clientX, clientY: $.clientY, page: V.page });
        !Y.length && !Ke.length || ($.preventDefault(), q(Y), F(V));
      },
      children: [
        /* @__PURE__ */ p(
          af,
          {
            mode: R,
            documentReady: !!r.jobId,
            sourceViewOnly: L,
            onModeChange: H,
            compareExtra: /* @__PURE__ */ p(nr, { place: "compare" }),
            liveTranslation: M.topBarPill ? {
              visible: b,
              state: e.liveTranslation,
              onToggle: () => S(($) => !$),
              latestPage: b ? T : null,
              currentPage: e.currentPage,
              onJumpToLatest: E
            } : null,
            completion: x ? {
              onOpenCompare: () => {
                D(e.viewStateKey), H("compare");
              }
            } : null,
            start: /* @__PURE__ */ C(Le, { children: [
              /* @__PURE__ */ p(tu, { onBeforeClose: r.prepareClose }),
              /* @__PURE__ */ p(Pp, { pinned: h && ue, available: ue, onToggle: () => y(($) => !$) }),
              /* @__PURE__ */ p(wp, { open: d, onToggle: f.toggleSidebar, issueCount: ie.issues.length }),
              r.title ? /* @__PURE__ */ p("span", { className: "reader-workspace-title", title: r.title, children: r.title }) : null
            ] })
          }
        ),
        /* @__PURE__ */ C("div", { className: "reader-workspace", children: [
          I ? /* @__PURE__ */ p(Vo, { bookmarks: Te, onJumpPage: e.goToPage, onJumpBlock: G, pinned: !0, docked: !0, onPinChange: y }) : null,
          /* @__PURE__ */ p(Kp, { state: f, bookmarkScope: e.viewStateKey, issues: ie }),
          /* @__PURE__ */ C("div", { className: "reader-stage", children: [
            I ? null : /* @__PURE__ */ p(Vo, { bookmarks: Te, onJumpPage: e.goToPage, onJumpBlock: G, pinned: h, onPinChange: y }),
            /* @__PURE__ */ p(Mp, { active: a }),
            /* @__PURE__ */ p(tf, { paneComposition: v, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: W }),
            /* @__PURE__ */ p(Vh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts })
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
                /* @__PURE__ */ p(oh, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: ee })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p(Kh, {}) : null,
        /* @__PURE__ */ p(
          fp,
          {
            mode: R,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            leftSlot: /* @__PURE__ */ p(zp, { edit: we }),
            toolsSlot: /* @__PURE__ */ p(nr, { place: "bottom" })
          }
        ),
        /* @__PURE__ */ p(
          Wp,
          {
            session: r,
            zoomDocuments: ne,
            zoomItem: B,
            setZoomItem: U,
            closeZoom: ce,
            visiblePdfMode: R
          }
        ),
        /* @__PURE__ */ p(Op, { menu: ge, onClose: te, actions: j, sections: Ke }),
        /* @__PURE__ */ p(wf, { extensions: hr }),
        /* @__PURE__ */ p(gp, {})
      ]
    }
  ) }) });
}
function Wg() {
  return /* @__PURE__ */ p(Sg, {});
}
export {
  Wg as R,
  Sg as a,
  Hg as b,
  Ug as c,
  Df as d,
  Of as e,
  Bg as f,
  jg as g,
  zg as h,
  Fg as r,
  Kg as s,
  Ge as u
};
//# sourceMappingURL=ReaderApp-BWnqFqOx.js.map
