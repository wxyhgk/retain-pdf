var ks = Object.defineProperty;
var Nr = (e) => {
  throw TypeError(e);
};
var Ts = (e, t, n) => t in e ? ks(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Ar = (e, t, n) => Ts(e, typeof t != "symbol" ? t + "" : t, n), xr = (e, t, n) => t.has(e) || Nr("Cannot " + n);
var xt = (e, t, n) => (xr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Lr = (e, t, n) => t.has(e) ? Nr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Cr = (e, t, n, r) => (xr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as Ae } from "react/jsx-runtime";
import { useMemo as V, useState as N, useEffect as O, useCallback as A, useRef as x, useLayoutEffect as xe, memo as Yt, createContext as Zt, useContext as dt, Fragment as yn, forwardRef as Es, useImperativeHandle as rr, useSyncExternalStore as vn, Component as Ps, Suspense as Jo, lazy as Go, useId as Xo } from "react";
import { requireAdapter as Nt, getReaderAdapters as He } from "./adapters.js";
import { resolveReaderDownloadName as Rs, resolveReaderDownloadUrls as Ms, READER_PROGRESS_COPY as Xe, trimString as ln, READER_DOWNLOAD_ACTIONS as _s, disabledReason as Ns } from "./runtime/state.js";
import { r as As, b as xs } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as On, isFinishedJobStatus as Wt } from "@retainpdf/domain/job";
import { n as Yo, d as Ls, f as Tn, k as Dr, b as Cs, c as Ds, j as Ue, p as gt, g as $s, l as Rt, i as Os } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as zs } from "@retainpdf/api/documents";
import { isReaderTransportError as Fs, createReaderTransportError as Bs } from "./contracts.js";
import { toast as zn, Toaster as js } from "sonner";
import { ChevronLeft as Zo, PenLine as un, ZoomIn as Hs, Check as Qo, X as At, Copy as Us, ChevronUp as Ks, ChevronDown as dn, History as Ws, LoaderCircle as Vs, Pin as qs, LogOut as Js, FileText as ea, Columns2 as ta, Languages as na, Radio as Gs, ArrowDownToLine as Xs, CheckCircle2 as Ys, ImagePlus as Zs, MessageCircle as Qs, Scan as ei, GitCompareArrows as ti, Highlighter as ni, Eraser as ri, Undo2 as oi, Trash2 as ai, BookText as si, ChevronRight as ra, Minus as oa, Plus as aa, ArrowLeft as ii, CircleHelp as ci, Download as li, Bookmark as ui, Star as di, Contrast as fi, Search as sa } from "lucide-react";
import { Button as ie, Textarea as mi, IconButton as ut, Input as or } from "@retainpdf/ui";
import { createPortal as hi } from "react-dom";
import { pdfjs as ia, Page as pi, Document as gi } from "react-pdf";
import { e as bi, m as yi, a as vi } from "./markdown-math-XkF5urpn.js";
const wi = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Si = "", Ii = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ki = (e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Cg = (...e) => {
  var n;
  return (((n = He()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Dg = () => {
  var e, t;
  return ((t = (e = He()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ye = () => Nt("defaultReaderDataPort"), $r = () => Nt("defaultReaderPageConfigPort"), $g = {
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
}, ca = {
  messageTargetOrigin: () => $r().messageTargetOrigin(),
  readerJobId: () => $r().readerJobId()
}, Ti = () => {
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
}, Ei = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Pi = () => {
  var e, t;
  return ((t = (e = He()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Ri = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Mi = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Rs(...e);
}, _i = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Ms(...e);
}, Ni = (...e) => Nt("downloadProtectedResource")(...e), Ai = (...e) => Nt("failDownloadToast")(...e), Og = (e, t) => Nt("resolveMarkdownAssetUrl")(e, t), Or = "/api/v1";
function xi() {
  const e = () => {
    var r;
    return As(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
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
function Li() {
  const e = xi(), t = V(() => Ri(ca), [e]), n = V(() => Pi(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Ci(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = N({
    documentId: "",
    jobId: ""
  }), [u, f] = N({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, y] = N({
    jobId: "",
    documentId: ""
  }), I = h.jobId === g ? h.documentId : "", S = t || I, b = !!t && !g, [w, v] = N(null), R = (w == null ? void 0 : w.sessionIdentity) === r && w.documentId === S ? w : null, T = b || !!R, P = A((_) => {
    const k = `${_.documentId || ""}`.trim();
    if (!k || a.current && a.current !== k) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: k
      });
    else if (!a.current)
      return;
    const E = `${_.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: k,
      revision: E,
      sessionIdentity: o.current
    }), i();
  }, []);
  O(() => {
    v((_) => _ && _.sessionIdentity !== r ? null : _);
  }, [r]);
  const C = A((_) => {
    switch (_.type) {
      case "resolved-document-job":
        l({ documentId: _.documentId, jobId: _.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: _.documentId, jobId: _.jobId });
        break;
      case "resolved-job-document":
        y((k) => k.jobId === _.jobId && k.documentId === _.documentId ? k : { jobId: _.jobId, documentId: _.documentId });
        break;
      case "committed-source":
        v({
          documentId: _.documentId,
          revision: _.revision,
          sessionIdentity: _.sessionIdentity
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
    activeCommittedDocumentSource: R,
    sourceViewOnly: T,
    refreshCommittedDocument: P,
    applyIdentityEvent: C
  };
}
function zr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Di(e) {
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
  return ki(On(e, t));
}
function $i(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Oi(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !$i(a, t))
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
        type: Ii.progress,
        stage: n,
        percent: e,
        text: t
      },
      ca.messageTargetOrigin()
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
  }), Fn({ percent: t, text: n, stage: r });
}
function zi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = N(null), [l, u] = N(null), [f, d] = N(""), [m, g] = N(0), h = f === n ? i : null, y = f === n ? l : null, I = zr(h), S = Wt(I), b = A(() => {
    g((C) => C + 1);
  }, []), w = A((C) => {
    c(C.jobPayload), u(C.manifestPayload), d(C.sessionIdentity);
  }, []), v = A((C) => {
    c(null), u(null), d(C);
  }, []), R = x(""), T = x(""), P = A(async () => {
    const C = o.current;
    if (!C || R.current === C) return;
    const _ = nt().loadJobPayload;
    if (typeof _ != "function") return;
    const k = a.current.value;
    R.current = C;
    try {
      const E = await _(C);
      if (s.current || a.current.value !== k || o.current !== C || !E || typeof E != "object")
        return;
      const M = zr(E);
      c(E), d(r.current), !Wt(M) && T.current === C && (T.current = ""), M === "succeeded" && T.current !== C && (T.current = C, g((D) => D + 1));
    } catch {
    } finally {
      R.current === C && (R.current = "");
    }
  }, []);
  return O(() => {
    T.current = "";
  }, [n]), O(() => {
    if (!t || S || !h) return;
    const C = window.setInterval(() => {
      document.visibilityState !== "hidden" && P();
    }, 1e3);
    return () => window.clearInterval(C);
  }, [S, P, h, t]), {
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
    refreshJobStatus: P,
    publishPayload: w,
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
function Fi(e, t) {
  e(t), Bn(t);
}
function Bi(e) {
  const [t, n] = N(e ? "source" : "compare"), r = A((a) => {
    e && a !== "source" || (n(a), Bn(a));
  }, [e]), o = A((a) => {
    Fi(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), Bn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Br(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function ji(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Br(n.active_job_id),
    activeVersionId: Br(n.active_version_id)
  };
}
function Hi(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ui(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ki(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Wi = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Vi(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Wi.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const qi = 48 * 1024 * 1024;
function Ji(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Gi = 2, je = /* @__PURE__ */ new Map();
function jn(e, t) {
  je.delete(e), je.set(e, t);
}
function jr(e) {
  if (je.size < Gi) return;
  const t = je.keys().next().value;
  t && je.delete(t);
}
async function Xi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function la(e, t = Vt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, I, S;
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
    const w = await Xi(s);
    throw w && (b.reason = w), b;
  }
  const i = Yi(r, s, t);
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
    (S = (I = n.signal) == null ? void 0 : I.removeEventListener) == null || S.call(I, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return je.has(r) ? jn(r, l) : (jr(), je.set(r, l)), l;
}
function Yi(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < qi ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Zi = { file: null, loading: !1, error: "" }, Qi = { file: null, loading: !0, error: "" };
function ec(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (O(() => {
    if (t || !n) return;
    const s = je.get(n);
    if (s) {
      jn(n, s);
      return;
    }
    const i = new AbortController();
    return la(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Zi;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = je.get(n);
  return a ? { file: a, loading: !1, error: "" } : Qi;
}
function tc(e) {
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
  fn(s, r, n, "download");
  const i = await la(t, Vt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (fn(s, o, n, "download"), i);
}
async function nc(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  fn(o, 25, "正在下载 PDF…", "download");
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
function rc(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function oc({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = zs,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(rc(o.href, t, a)), !0);
}
const tn = {
  regions: null,
  metadata: null
};
function ac(e) {
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
  } = e, [S, b] = N(""), [w, v] = N(""), [R, T] = N(null), [P, C] = N(null), [_, k] = N(!1), [E, M] = N(""), [D, $] = N([]), [K, H] = N(!1), [J, ue] = N(() => ({
    source: null,
    translated: null
  })), [Q, ce] = N(
    tn
  ), [Se, Y] = N({
    loading: !0,
    percent: 4,
    text: Xe.boot,
    stage: "progress",
    failed: !1
  });
  return O(() => {
    const de = new AbortController(), Le = h.current.value, ae = tc({
      sessionEpochRef: h,
      closingRef: y,
      abort: de,
      sessionEpoch: Le
    });
    I.current = de;
    const fe = nt();
    if (y.current)
      return de.abort(), () => {
        I.current === de && (I.current = null);
      };
    let F = !1;
    function U(se, Z) {
      ae.markFailed(), H(!0), Y({
        loading: !1,
        percent: 100,
        text: se,
        stage: "failed",
        failed: !0
      }), Fn({ percent: 100, text: Z, stage: "failed" });
    }
    function q() {
      k(!0), F || H(!0), Y({
        loading: !1,
        percent: 100,
        text: Xe.ready,
        stage: "ready",
        failed: !1
      }), Fn({ percent: 100, text: Xe.ready, stage: "ready" });
    }
    function oe() {
      return l != null && l.documentId ? Fr(
        l.documentId,
        l.revision
      ) : wi() ? Si : fe.resolveResourceUrl(On(r));
    }
    async function re() {
      var ne;
      let se = { activeJobId: "", activeVersionId: "" };
      try {
        const he = await ((ne = fe.fetchDocument) == null ? void 0 : ne.call(fe, r));
        he && (se = ji(he));
      } catch {
      }
      const Z = Hi({
        link: se,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (Z.kind === "follow-active-job") {
        if (ae.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: Z.jobId
        }), Z.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: Z.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (Z.kind === "open-committed-source") {
        if (ae.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: Z.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ge = oe();
      if (ae.isInactive()) return;
      b(ge), v(""), M(""), d(c);
      const B = await Hn({
        url: ge,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ae,
        setBoot: Y
      });
      if (!ae.isInactive()) {
        if (!B) {
          U("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        T(B), q();
      }
    }
    async function me() {
      var $e;
      const se = !l, Z = !!(se && fe.loadSessionSnapshot && fe.loadReaderOptionalArtifacts), ge = Z ? fe.loadReaderOptionalArtifacts(t) : null, B = await (($e = fe.loadSessionSnapshot) == null ? void 0 : $e.call(fe, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: se && !Z
      })), ne = B ? {
        jobPayload: B.sourcePayload,
        manifestPayload: B.manifestPayload,
        readerMetadata: B.readerMetadata,
        regionsPayload: B.regions,
        readerErrors: B.readerErrors
      } : await fe.loadReaderPayload(t, {
        includeOptionalArtifacts: se
      });
      if (ae.isInactive()) return;
      let he = null;
      if (n && !r)
        if (B && B.linkedDocument !== void 0)
          he = B.linkedDocument;
        else {
          try {
            he = await fe.fetchDocumentByJobId(Or, t);
          } catch {
          }
          if (ae.isInactive()) return;
        }
      const Ce = Di(ne.jobPayload) || `${(he == null ? void 0 : he.document_id) || ""}`.trim();
      Ce && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ce
      });
      const _e = Ui({
        payloadDocumentId: Ce,
        linkedActiveJobId: `${(he == null ? void 0 : he.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(he == null ? void 0 : he.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (_e.kind === "restore-committed-source") {
        if (ae.isInactive()) return;
        u({
          type: "committed-source",
          documentId: _e.documentId,
          revision: _e.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Re = fe.resolveReaderSourcePdf(ne.manifestPayload), Fe = fe.resolveReaderTranslatedPdfUrl(ne.jobPayload, ne.manifestPayload), Oe = typeof Re == "string" ? Re : fe.resolveReaderArtifactUrl(Re), De = r || Ce, We = l != null && l.documentId ? Fr(
        l.documentId,
        l.revision
      ) : Oe || (De ? fe.resolveResourceUrl(On(De)) : ""), ze = l ? "" : Fe || "";
      b(We || ""), v(ze), M(Oi(ne.jobPayload, t)), f({
        jobPayload: ne.jobPayload || null,
        manifestPayload: ne.manifestPayload || null,
        sessionIdentity: c
      });
      const Be = () => nc({
        sourceFinal: We || "",
        translatedFinal: ze,
        fence: ae,
        setBoot: Y
      }), j = !!(We || ze), W = ge && j ? Be() : null;
      W == null || W.catch(() => {
      });
      const ee = (z) => {
        ae.isInactive() || ($(l ? [] : Yo(z.regionsPayload)), ue(l ? { source: null, translated: null } : Ls(z.readerMetadata)), ce(l ? tn : z.readerErrors ?? tn), H(!0));
      };
      if (ge ? (F = !0, ge.then(ee)) : ee(ne), !j) {
        U(Xe.failed, Xe.failed);
        return;
      }
      const ye = await (W ?? Be());
      if (ye.status !== "inactive") {
        if (ye.status === "incomplete") {
          U("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        T(ye.sourceBytes), C(ye.translatedBytes), q();
      }
    }
    async function Ie() {
      k(!1), T(null), C(null), $([]), H(!1), ue({ source: null, translated: null }), ce(tn), fn(Y, 8, Xe.metadata, "metadata");
      try {
        if (s) {
          await re();
          return;
        }
        if (!t) {
          U(Xe.failed, Xe.failed);
          return;
        }
        await me();
      } catch (se) {
        if (ae.isClosedOrStale() || (se == null ? void 0 : se.name) === "AbortError") return;
        ae.markFailed();
        const Z = Number(se == null ? void 0 : se.status), ge = `${(se == null ? void 0 : se.reason) || ""}`, B = Vi({ status: Z, reason: ge, sessionJobId: t });
        if (B && (await oc({
          apiPrefix: Or,
          documentId: B,
          expiredJobId: t
        }) || ae.isClosedOrStale()))
          return;
        if (Ki({
          status: Z,
          reason: ge,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const ne = se instanceof Error ? se.message : Xe.failed;
        U(ne, ne);
      }
    }
    return Ie(), () => {
      de.abort(), I.current === de && (I.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: w,
    sourceFile: R,
    translatedFile: P,
    assetsReady: _,
    title: E,
    regions: D,
    regionsSettled: K,
    readerMetadata: J,
    readerErrors: Q,
    boot: Se
  };
}
function sc() {
  const e = x(!1), t = x(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Li(), s = x({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = x(a), c = x(""), l = x(""), u = x(() => {
  }), f = A(() => u.current(), []), d = Ci({
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
  } = d, { mode: I, setMode: S, switchSessionMode: b } = Bi(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const w = zi({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: v,
    scopedManifestPayload: R,
    jobStatus: T,
    jobTerminal: P,
    jobRefreshRevision: C,
    refreshJobArtifacts: _,
    refreshJobStatus: k
  } = w, E = ac({
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
    jobRefreshRevision: C,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), M = A(() => {
    var $;
    e.current = !0, ($ = t.current) == null || $.abort();
  }, []), D = V(
    () => ({
      fetchProtected: nt().fetchProtected,
      jobId: m,
      jobPayload: v,
      manifestPayload: R,
      sourceUrl: E.sourceUrl,
      translatedUrl: E.translatedUrl,
      sourceOnly: y
    }),
    [m, v, R, E.sourceUrl, E.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: T,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: P,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: I,
    setMode: S,
    sourceUrl: E.sourceUrl,
    translatedUrl: E.translatedUrl,
    sourceFile: E.sourceFile,
    translatedFile: E.translatedFile,
    assetsReady: E.assetsReady,
    boot: E.boot,
    title: E.title,
    regions: E.regions,
    regionsSettled: E.regionsSettled,
    readerMetadata: E.readerMetadata,
    readerErrors: E.readerErrors,
    download: D,
    refreshJobArtifacts: _,
    refreshJobStatus: k,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: M
  };
}
const ic = 160, cc = 8, lc = 0;
function uc() {
  const e = x(null), [t, n] = N(null), [r, o] = N(lc), a = A((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < ic || o((u) => Math.abs(u - l) < cc ? u : l);
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
function dc(e) {
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
function fc(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = x(l);
  u.current = l;
  const [f, d] = N(() => ({
    identity: l,
    pages: En
  })), [m, g] = N(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : En, y = m.identity === l ? m.tick : 0, I = dc({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = I, b = A((k, E) => {
    u.current === l && d((M) => {
      const D = M.identity === l ? M.pages : En;
      return D[E] === k && M.identity === l ? M : {
        identity: l,
        pages: { ...D, [E]: k }
      };
    });
  }, [l]), w = x(null), v = A(() => {
    w.current && clearTimeout(w.current);
    const k = l;
    w.current = setTimeout(() => {
      w.current = null, u.current === k && g((E) => ({
        identity: k,
        tick: E.identity === k ? E.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  O(() => (w.current && (clearTimeout(w.current), w.current = null), d((k) => k.identity === l && k.pages.source === 0 && k.pages.translated === 0 ? k : { identity: l, pages: { source: 0, translated: 0 } }), g((k) => k.identity === l && k.tick === 0 ? k : { identity: l, tick: 0 }), () => {
    w.current && (clearTimeout(w.current), w.current = null);
  }), [l]);
  const R = V(
    () => Math.max(h.source, h.translated),
    [h]
  ), T = S === "translated" ? h.translated : h.source || h.translated, P = t == null ? void 0 : t.userZoom, C = t == null ? void 0 : t.shellWidth, _ = `${l}-${y}-${P}-${n}-${h.source}-${h.translated}-${C}`;
  return {
    ...I,
    numPagesByPane: h,
    hudNumPages: R,
    primaryNumPages: T,
    metricsTick: y,
    onNumPages: b,
    onMetrics: v,
    rowSyncRevision: _
  };
}
const Pe = "data-reader-page", ke = "data-reader-pane", ar = "data-natural-height", mc = "reader-react-root", ua = "reader-react-grid", da = "reader-react-scroll-shell", wn = "reader-react-pdf-pane", fa = "reader-react-pdf-page", mn = "reader-react-pdf-page-placeholder", sr = "reader-react-pdf-page-slot";
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
const ma = 0.25, gn = 1, hc = 0.05, Qt = 0.5, pc = 16, gc = 8, ha = pc + gc, bc = 720;
function Tt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function pa(e) {
  return Number.isFinite(e) && e < bc;
}
function It(e, t = Number.POSITIVE_INFINITY) {
  return pa(t) && (e === "source" || e === "translated") ? gn : Qt;
}
function et(e) {
  return Number.isFinite(e) ? Math.min(gn, Math.max(ma, e)) : Qt;
}
function qt(e, t) {
  const n = et(Number(e) + t * hc);
  return Math.round(n * 100) / 100;
}
function yc(e) {
  return Math.round(et(e) * 100);
}
function ga(e) {
  const n = (Number(e) || 0) - ha;
  return Math.max(160, Math.floor(n));
}
function vc(e, t = Qt) {
  const n = et(t);
  return ga((Number(e) || 0) * n);
}
function wc(e, t) {
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
const Sc = 8;
function Ic(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Sc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const ba = 200, kc = [
  "markdown"
], Tc = kc;
function ya(e) {
  return Tc.includes(e);
}
const Ec = "retainpdf:reader:view:v1:", Hr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Pc = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function va() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Un(e) {
  return `${e || ""}`.trim();
}
function Rc({
  documentId: e,
  jobId: t
}) {
  const n = Un(e);
  if (n) return `document:${n}`;
  const r = Un(t);
  return r ? `job:${r}` : "";
}
function wa(e) {
  const t = Un(e);
  return t ? `${Ec}${t}` : "";
}
function Mc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function _c(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Hr.has(t) || !Hr.has(n) || t === n))
    return { left: t, right: n };
}
function Nc(e) {
  return e === null ? null : ya(e) ? e : void 0;
}
function Ac(e) {
  return Pc.has(e) ? e : void 0;
}
function Sa(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Mc(t.anchor), r = Number(t.zoom), o = Ac(t.mode), a = _c(t.splitLayout), s = Nc(t.assistantPanel);
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
function Je(e, t = va()) {
  const n = wa(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Sa(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Sn(e, t, n = va()) {
  const r = wa(e);
  if (!r || !n) return null;
  const o = Je(e, n), a = Sa({
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
function xc(e, t, n = "") {
  var d;
  const [r, o] = N(() => {
    var m;
    return ((m = Je(n)) == null ? void 0 : m.zoom) ?? It(e, Tt());
  }), a = x(r), s = x(n);
  a.current = r;
  const i = x(1), c = x(((d = Je(n)) == null ? void 0 : d.zoom) !== void 0);
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
  const l = A((m, g) => {
    const h = et(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, Sn(s.current, { zoom: h }), o(h));
  }, []), u = A((m) => {
    l(qt(a.current, m));
  }, [l]), f = A((m) => {
    l(It(m));
  }, [l]);
  return xe(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, wc(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const Lc = 160, Cc = 3e-3, Ur = 50, Dc = 16, $c = 800;
function Oc(e, t = 0) {
  const n = t === 1 ? Dc : t === 2 ? $c : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Ur, Math.min(Ur, r));
  return Math.exp(-o * Cc);
}
function zc(e, t, n = 0) {
  return et(e * Oc(t, n));
}
function Fc(e) {
  return Math.round(et(e) * 100) / 100;
}
function Bc(e, t, n) {
  const r = et(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return et(t) / r;
  const a = (o + ha) / r;
  return ga(a * et(t)) / o;
}
function jc(e) {
  return Array.from(e.querySelectorAll(ir()));
}
function Hc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Uc(e, t, n) {
  let r = null;
  for (const s of jc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = Hc(i, t, n);
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
function Kc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Ia(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${ir()}[${Pe}="${t.page}"][${ke}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Kc(n, e).scrollLeft += a);
}
function Wc(e, t, n, r) {
  const o = e.querySelector(`.${ua}`);
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
const Vc = 600, qc = 1e3;
function Jc(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Ia(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), qc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Gc(e, t, n) {
  const r = x(t);
  r.current = t;
  const o = x(n);
  o.current = n;
  const a = x(null), s = x(null), i = x(null);
  O(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = Fc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Lt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Lt(d.grid));
      }, Vc), s.current = d, o.current(f, { keepScroll: !1 });
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
          anchor: Uc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = zc(f.target, u.deltaY, u.deltaMode);
      const d = Bc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Wc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, Lc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Lt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), xe(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Lt(c.grid), !(!e || !c.anchor) && (Ia(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Jc(e, c.anchor)));
  }, [t, e]);
}
function Xc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = x(t), a = x(n), s = x(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: A((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const cr = 48;
function ka(e, t = cr) {
  return e.getBoundingClientRect().top + t;
}
function Ta(e, t) {
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
  const s = ka(e, n), i = Ta(o, s);
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
function Yc(e, t, n = "smooth", r) {
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
function Zc(e, t, n) {
  return Kn(
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
function Ke(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Qc(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
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
      const y = ka(i), I = Ta(h, y);
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
const el = `canvas, .react-pdf__Page, .${fa}, .${mn}`, Kr = /* @__PURE__ */ new WeakMap();
function tl(e) {
  const t = Number(e.getAttribute(ar));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Kr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(el), Kr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function nl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function rl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(ir()).forEach((r) => {
    const o = pn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = tl(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function ol(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = x(o), i = x(r);
  return i.current = r, xe(() => {
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
      const w = rl(b);
      nl(s.current, w) || (s.current = w, a(w)), u && !f && (f = !0, (v = i.current) == null || v.call(i));
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
const al = [0, 48, 140, 320, 560], sl = 700, il = [80, 200, 400], cl = 500, ll = 50, ul = /* @__PURE__ */ new Set([
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
]), dl = 180, Wr = [0, 48, 140, 320, 700, 1200];
function fl(e, t) {
  var E;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = x(
    ((E = Je(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
  ), c = x(null), l = x(!1), u = x(r), f = x(null), d = x(null), m = x(null), g = x(null), h = x(a), y = x(""), I = x(n);
  I.current = n;
  const S = A(() => {
    var M;
    (M = f.current) == null || M.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = A(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), w = A((M = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const D = () => {
      g.current = null, Sn(h.current, {
        anchor: Ke(i.current)
      });
    };
    M ? D() : g.current = setTimeout(D, dl);
  }, []), v = A((M) => {
    i.current = Ke(M), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, ll);
  }, []);
  O(() => {
    if (!o)
      return;
    let M = !1, D = null, $ = null, K = null;
    const H = () => {
      if (M) return;
      const J = e.current;
      if (!J) {
        K = setTimeout(H, 50);
        return;
      }
      D = J, $ = () => {
        if (l.current)
          return;
        const ue = Ht(D, I.current);
        ue && (i.current = ue, w());
      }, D.addEventListener("scroll", $, { passive: !0 }), l.current || $();
    };
    return H(), () => {
      M = !0, K != null && clearTimeout(K), D && $ && D.removeEventListener("scroll", $);
    };
  }, [o, r, n, e, w]), O(() => {
    if (!o) return;
    const M = e.current;
    if (!M) return;
    const D = ($) => {
      $.metaKey || $.ctrlKey || $.altKey || ul.has($.key) && b();
    };
    return M.addEventListener("wheel", b, { passive: !0 }), M.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", D), () => {
      M.removeEventListener("wheel", b), M.removeEventListener("touchmove", b), window.removeEventListener("keydown", D);
    };
  }, [o, e, b]), xe(() => {
    var D;
    if (h.current === a) return;
    w(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const M = (D = Je(a)) == null ? void 0 : D.anchor;
    i.current = M ? Ke(M) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, w, S]), O(() => {
    var D;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const M = Ke(
      ((D = Je(a)) == null ? void 0 : D.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = M, c.current = M, l.current = !0, S(), f.current = Kn(
      () => e.current,
      M,
      {
        behavior: "auto",
        pane: I.current,
        delaysMs: Wr,
        onDone: () => v(M)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(M);
    }, Math.max(...Wr) + 160), () => S();
  }, [o, s, a, e, v, S]), O(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const M = c.current ? Ke(c.current) : Ke(i.current);
    return l.current = !0, c.current = M, i.current = M, S(), f.current = Kn(
      () => e.current,
      M,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: al,
        onDone: () => v(M)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(M);
    }, sl), () => {
      S();
    };
  }, [r, o, n, e, v, S]), O(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), w(!0);
  }, [S, w]);
  const R = A(() => {
    const M = Ht(
      e.current,
      I.current
    );
    return Ke(M || i.current);
  }, [e]), T = A(() => {
    l.current = !0;
    const M = Ht(
      e.current,
      I.current
    ), D = Ke(M ?? i.current);
    return i.current = D, c.current = D, w(), D;
  }, [e, w]), P = A((M, D, $) => {
    const K = $ || I.current, H = bn(M, D || 1), J = { page: H, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, w(), S(), Yc(e.current, H, "smooth", K), f.current = Zc(
      () => e.current,
      H,
      {
        behavior: "auto",
        pane: K,
        delaysMs: il,
        onDone: () => v(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(J);
    }, cl);
  }, [e, v, S, w]), C = A(() => Ke(i.current), []), _ = A(() => l.current, []), k = A(() => {
    if (!l.current || !c.current)
      return;
    const M = Ke(c.current);
    Mt(
      e.current,
      M,
      "auto",
      I.current
    );
  }, [e]);
  return {
    lockFromShell: R,
    beginModeSwitch: T,
    goToPage: P,
    getAnchor: C,
    isRestoring: _,
    repinIfRestoring: k
  };
}
function ml(e, t) {
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
function Ea(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const hl = [0, 80, 200, 400, 800], pl = 120, gl = 400;
function bl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = x(a);
  f.current = a;
  const d = x(s);
  d.current = s;
  const m = x(i);
  m.current = i;
  const g = x(n);
  g.current = n, O(() => {
    var w, v;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Ei(), y = ml(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const I = Ea(h, y, { jobId: c, documentId: l });
    if (t.current === I)
      return;
    if (y == null) {
      t.current = I, (w = g.current) == null || w.call(g);
      return;
    }
    t.current = I, h && ((v = m.current) == null || v.call(m, h, y));
    const S = [];
    let b = 0;
    for (const R of hl)
      b = Math.max(b, R), S.push(
        setTimeout(() => {
          f.current(y);
        }, R)
      );
    return S.push(
      setTimeout(() => {
        var R;
        (R = g.current) == null || R.call(g);
      }, b + pl)
    ), () => {
      for (const R of S) clearTimeout(R);
    };
  }, [r, o, c, l, t, u]);
}
function yl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function vl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = gl,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = x(a);
  u.current = a;
  const f = x(l);
  f.current = l;
  const d = x(0);
  O(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var I;
      const g = ((I = globalThis.location) == null ? void 0 : I.search) || "", h = xs(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Ea(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || yl)(h);
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
function wl(e) {
  const t = x(""), [n, r] = N(!1), o = A(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  bl(a, t, o), vl(e, t, n);
}
const Ct = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Sl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Vr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Pa(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Vr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Vr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Il(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Pa(r, t, n);
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
function kl(e) {
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
function Tl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function El(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function Pl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Rl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const qr = [250, 500, 1e3, 2e3, 4e3], Pn = [80, 160, 320, 640, 1e3, 1500], Jr = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
function lr(e) {
  return Fs(e) ? `${e.code || ""}`.trim() : "";
}
function nn(e, t) {
  const n = lr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Ml(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Pa(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Bs(
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
    const i = Pn[Math.min(s, Pn.length - 1)];
    if (await Wn(i, r), s >= Pn.length + 2) throw a;
  }
}
function _l({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(Ct), s = x(o), i = x("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Wt(l) ? l : "";
  return O(() => {
    if (!n || !c) {
      i.current = "", s.current = Ct, a(Ct);
      return;
    }
    const f = r === void 0 ? Ti() : r, d = i.current === c;
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
            layoutByPage: Sl(w),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (w) {
          if ((w == null ? void 0 : w.name) === "AbortError") return;
          const v = lr(w);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            y((T) => ({
              ...T,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: nn(w, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((T) => ({
              ...T,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((T) => ({
            ...T,
            connection: "connecting",
            jobStatus: l,
            error: nn(w, "正在等待 OCR 版面数据")
          })), await Wn(qr[Math.min(b, qr.length - 1)], m.signal).catch(() => {
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
                v = await Ml(
                  c,
                  w,
                  s.current,
                  m.signal,
                  f
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || m.signal.aborted) throw R;
                y((T) => ({
                  ...T,
                  lastSeq: Math.max(T.lastSeq, w.seq),
                  error: nn(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((R) => {
                const T = Il(R, w, v);
                return u ? {
                  ...T,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...T,
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
            error: nn(w, "实时译文连接已中断，正在重连")
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
        await Wn(Jr[Math.min(b, Jr.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function Nl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Al(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = nt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Nl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const xl = 4500;
function Ll(e) {
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
const Cl = /* @__PURE__ */ new Set(["book", "translate"]);
function Ra(e) {
  return !!(e.jobId && e.sourceUrl && Cl.has(e.workflow));
}
function Dl(e) {
  return !!(Ra(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function $l() {
  const e = sc(), t = Ra({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Dl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = x({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Wt(o) && (r.current.running = !0);
  const a = _l({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = uc(), u = Al(e.jobId, !e.sourceOnly), f = Rc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = xc(e.mode, s, f);
  Gc(i, m, g);
  const h = fc(
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
  } = fl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  O(() => {
    S();
  }, [c, S]);
  const b = ol(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), w = Qc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), v = A((H, J) => {
    var Q, ce;
    const ue = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Q = h.numPagesByPane) == null ? void 0 : Q.source) || 0,
      Number((ce = h.numPagesByPane) == null ? void 0 : ce.translated) || 0
    );
    I(H, ue, J);
  }, [I, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, T] = N(null), P = x(null), C = A((H) => {
    P.current && clearTimeout(P.current), T(H), H && (P.current = setTimeout(() => T(null), xl));
  }, []);
  O(() => () => {
    P.current && clearTimeout(P.current);
  }, []);
  const _ = A((H) => {
    const J = Tn(e.regions, H);
    return J ? Dr(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), k = A((H, J) => {
    const ue = J || h.primaryPane, Q = typeof H == "object" && H ? `${H.block_id || ""}`.trim() : "", ce = typeof H == "object" && H ? `${H.image_url || ""}`.trim() : "", Se = typeof H == "object" && H ? H.page_idx != null ? Number(H.page_idx) + 1 : H.page != null ? Number(H.page) : null : typeof H == "number" ? H + 1 : null, Y = Cs(e.regions, ce, Se) || Tn(e.regions, Q) || (typeof H == "object" ? Ds(e.regions, H) : null);
    let de = Y ? Dr(Y, ue).page : null;
    de == null && (de = Ll(H)), !(de == null || de < 1) && (C(Y), v(de, ue));
  }, [C, v, h.primaryPane, e.regions]);
  wl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: w,
    goToPage: v,
    resolveBlockPage: _,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (H) => {
      C(Tn(e.regions, H.blockId));
    }
  });
  const { setModeKeepingPage: E } = Xc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  O(() => {
    C(null);
  }, [d, C]);
  const M = !e.boot.loading && !e.boot.failed, D = V(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), $ = V(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), K = V(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: D,
    panes: h,
    sessionFiles: $,
    rowHeights: b,
    goToPage: v,
    activeRegion: R,
    jumpToAnchor: k,
    setModeKeepingPage: E,
    download: e.download,
    showHud: M,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, D, h, $, b, v, R, k, E, M, m, g, f, a, n, u]);
  return V(() => ({
    ...K,
    currentPage: w
  }), [K, w]);
}
const Ol = [
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
], zl = [
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
function Fl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Ol)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Bl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const jl = ".reader-notes-panel";
function Hl(e) {
  return e instanceof Element ? !!e.closest(jl) : !1;
}
function Ul(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Bl(d.target) || Hl(d.target))
        return;
      const m = d.key, g = Fl(m);
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
const Ee = { size: 16, strokeWidth: 1.75 }, Gr = { size: 12, strokeWidth: 1.75 }, Kl = "retainpdf:soft-reader-close";
function Wl() {
  return new URL("./index.html", window.location.href).href;
}
function Vl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Kl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function ql(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Jl() {
  if (!(typeof window > "u") && !Vl()) {
    if (ql(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Wl());
  }
}
function Gl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Xl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L(Gl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Jl();
  }, children: [
    /* @__PURE__ */ p(Zo, { className: "reader-close-home-icon", ...Ee, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const Yl = 3e3, Zl = 8;
async function Ql(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function eu(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function tu(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Yl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = eu(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < Zl && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Ql(e, i);
  })), a;
}
function Ma(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function nu(e, t) {
  let n = null;
  for (const r of Ma(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let Xr = !1;
function ru() {
  if (Xr)
    return;
  const e = Vt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (ia.GlobalWorkerOptions.workerSrc = e, Xr = !0);
}
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), ou = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, au = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, su = {
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
function iu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Yr(o ?? a ?? "", ou)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Yr(o ?? a ?? "", au)).replace(/\\([a-zA-Z]+)/gu, (r, o) => su[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function cu(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const lu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function uu(e) {
  const t = [];
  for (const n of e) {
    if (!lu(n)) continue;
    const r = iu(cu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const du = 24, fu = 60;
function Zr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - du), o = Math.min(e.length, n + t.length + fu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function mu(e, t, n = 200) {
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
function hu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const pu = /^data-[a-z0-9-]+$/;
function Qr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function gu(e, t, n = "") {
  if (!t.length) return zt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += zt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => pu.test(c)).map(([c, l]) => ` ${c}="${Qr(l)}"`).join("");
    o += `<mark class="${Qr(s.className)}"${i}>${zt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + zt(e.slice(a), n);
}
function we(e) {
  return typeof e == "string" ? e : "";
}
function bu(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function yu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function vu(e) {
  return {
    source: we(e == null ? void 0 : e.source_text) || we(e == null ? void 0 : e.unit_source_text),
    translated: we(e == null ? void 0 : e.protected_translated_text) || we(e == null ? void 0 : e.translated_text)
  };
}
const wu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function _a(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Su(e) {
  const t = _a(e).sort((r, o) => we(r.ts).localeCompare(we(o.ts)));
  return t.length ? [
    { text: we(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: we(r.new_text),
      label: wu[we(r.source)] || we(r.source) || "修订",
      ts: we(r.ts),
      reason: we(r.reason)
    }))
  ].reverse() : [];
}
function Iu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function ku(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return we(r.finished_at) || we(n.finished_at) || "";
}
function Tu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = _a(e).sort((a, s) => we(a.ts).localeCompare(we(s.ts)));
  for (const a of o) {
    const s = new Date(we(a.ts)).getTime(), i = we(a.reader_item_id) || we(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, we(a.new_text));
  }
  return n;
}
const Eu = {
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
function Pu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = Eu[we(n.kind)] || we(n.kind) || "问题", o = we(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Ru = /* @__PURE__ */ new Set(["text", "formula"]);
function ur(e) {
  return Ru.has(e);
}
function Na(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || ur(Ue(n));
}
function Mu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !ur(Ue(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const _u = 300, Nu = 72;
function Au(e, t) {
  if (e.width >= _u && e.height >= Nu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const xu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Lu(e, t, n) {
  return e.flatMap((r) => {
    if (!xu.has(Ue(r.region))) return [];
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
async function Cu(e) {
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
const Du = "reader-text-hover-copy", $u = "reader-text-hover-edit", Ou = "reader-text-hover-zoom", zu = "reader-text-hover-id";
function Fu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Aa = "reader-text-hover-tools";
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
const Bu = 26, ju = 220;
function Hu(e, t = ju) {
  return e.height < Bu * 2 || e.width < t;
}
function Uu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Qo : e === "failed" ? At : Us, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Ku({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = N("idle"), [u, f] = N("idle"), [d] = N(() => Fu()), m = x([]), g = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    l("idle"), f("idle");
    const v = m.current;
    return () => {
      v.forEach((R) => window.clearTimeout(R)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = $s(e.highlight.region, t), y = Ue(e.highlight.region), I = (v, R) => async (T) => {
    T.preventDefault(), T.stopPropagation();
    const P = await Cu(v);
    R(P ? "copied" : "failed"), m.current.push(window.setTimeout(() => R("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, w = s || (Hu(b) ? "outside" : "inside");
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
          className: Aa,
          "data-placement": w,
          style: w === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              on,
              {
                className: zu,
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
                className: $u,
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
                className: Du,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: I(h, l),
                children: /* @__PURE__ */ p(Uu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              on,
              {
                className: Ou,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Hs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Wu(e, t) {
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
function Vu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = gt(
      Wu(e, a),
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
const qu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Ju = 256, Dt = /* @__PURE__ */ new Map();
function Gu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function xa(e) {
  const t = `${e || ""}`, { text: n, slots: r } = bi(t, { bareLatex: !0 }), o = Gu(n), a = yi(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Dt.get(t);
  if (!s && (s = vi(o, r), Dt.set(t, s), Dt.size > Ju)) {
    const i = Dt.keys().next().value;
    i !== void 0 && Dt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Rn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ze(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Xu(e, t) {
  const n = e.typography, r = Ze(t) || 1, o = Ze(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Rn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ze(n == null ? void 0 : n.fit_min_font_size_pt), u = Ze(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Ze(n == null ? void 0 : n.leading_em), h = [
    Ze(n == null ? void 0 : n.padding_top_pt) || 0,
    Ze(n == null ? void 0 : n.padding_right_pt) || 0,
    Ze(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ze(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || qu,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Rn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Rn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Yu(e, t, n, r) {
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
const Zu = 512, $t = /* @__PURE__ */ new Map();
let Vn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Vn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Vn += 1;
}));
function Qu(e, t, n, r) {
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
function La({ item: e, pageScale: t }) {
  const n = x(null), r = V(
    () => xa(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = V(
    () => Xu(e, t),
    [e, t]
  );
  O(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), xe(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), I = Math.max(1, e.rect.height - d - g), S = Qu(o, y, I, s);
    let b = $t.get(S);
    if (b === void 0 && (b = Yu(
      (w) => (f.style.fontSize = `${w}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      I,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), $t.set(S, b), $t.size > Zu)) {
      const w = $t.keys().next().value;
      w !== void 0 && $t.delete(w);
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
function ed({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = V(
    () => Vu(e, t, n, r),
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
        La,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const td = Yt(ed);
function nd({
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
        La,
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
const rd = Yt(nd), Ca = 24, ot = Ca * 2 + 4, Qe = 24, od = 4, ad = 6, ft = (e) => e.left + e.width, ct = (e) => e.top + e.height;
function Ft(e, t) {
  const n = Math.min(ft(e), ft(t)) - Math.max(e.left, t.left), r = Math.min(ct(e), ct(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const to = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ft(t) && r >= t.top && r <= ct(t);
}, sd = (e) => e.height > 40 && e.height > e.width * 2.5;
function id(e, t, n) {
  if (!t.length || e.height < Qe || e.width < n + 8) return null;
  const r = Math.max(...t.map(ct)), o = ft(e) - 4 - n;
  for (const a of [r, ct(e) - 2]) {
    const s = Math.max(e.top, a - Qe), i = { left: o, top: s, width: n, height: Qe };
    if (!t.some((c) => Ft(i, c) > 0)) return s - e.top;
  }
  return null;
}
function cd(e, t) {
  const n = [], r = (a) => {
    const s = Ca + od, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ft(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Qe - 3, width: ot, height: Qe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: ct(e), width: ot, height: Qe + 3 } }), r(!0);
  const o = id(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ft(e) - 4 - ot, top: e.top + o, width: ot, height: Qe } }), n;
}
function ld(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !sd(S)), i = s.filter((S) => to(S, t)), c = s.filter((S) => !to(S, t)), l = n.filter((S) => S !== t && Ft(S, t) < t.width * t.height * 0.5), u = cd(t, i).filter(({ box: S, overhang: b }) => {
    const w = b ? ad : 0;
    return S.left >= -w && ft(S) <= r + w && S.top >= 0 && ct(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !c.some((b) => Ft(S, b) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((b) => Ft(S.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let y = null, I = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((w, v) => w + Ft(S.box, v), 0);
    b < I && (y = S, I = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function ud(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Qe - 3 : ct(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Qe + 3;
}
const Mn = (e) => e.left + e.width, _n = (e) => e.top + e.height;
function dd(e, t, n = 3, r = 6) {
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
function fd(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function md(e, t, n, r) {
  const [o, a] = N(null);
  return xe(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? fd(s) : [], c = Ue(t.highlight.region) === "figure", l = i.length && !c ? dd(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...ld({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function hd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, c] = N(!1), [l, u] = N([]), [f, d] = N(""), [m, g] = N(""), [h, y] = N(!1), [I, S] = N(null), [b, w] = N([]), v = r.drafts, R = r.generation, T = A(async (k, E) => {
    if (e)
      try {
        u(Su(await e.fetchRevisions(k, E)));
      } catch {
        u([]);
      }
  }, [e]);
  O(() => {
    if (s(null), u([]), S(null), w([]), g(""), !e || !t || !n) return;
    let k = !1;
    return c(!0), e.loadItem(t, n).then((E) => {
      if (k) return;
      const M = E == null ? void 0 : E.item;
      if (!M) throw new Error("找不到这一段的译文。");
      const D = `${(E == null ? void 0 : E.item_id) || n}`, { source: $, translated: K } = vu(M);
      s({ readerItemId: n, itemId: D, source: $, current: K }), d(v.get(n) ?? K);
    }).catch((E) => {
      k || S({ tone: "error", message: (E == null ? void 0 : E.message) || "读取这段译文失败。" });
    }).finally(() => {
      k || c(!1);
    }), T(t, n), () => {
      k = !0;
    };
  }, [e, t, n, T]);
  const P = A((k) => {
    d(k), n && v.set(n, k);
  }, [n, v]), C = A(async (k, E) => {
    if (!e || !a || h) return !1;
    const M = k ?? f;
    if (!M.trim()) return !1;
    y(!0), S(null), w([]);
    try {
      const D = await e.revise(t, a.itemId, {
        translated_text: M,
        source: "user",
        reason: (E ?? m).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), $ = Number(D == null ? void 0 : D.generation);
      return Number.isFinite($) && (R.current = $), v.delete(a.readerItemId), s({ ...a, current: M }), d(M), g(""), (D == null ? void 0 : D.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, M), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), T(t, a.readerItemId), !0;
    } catch (D) {
      const $ = D;
      return ($ == null ? void 0 : $.reason) === "generation_mismatch" && (R.current = null), S({ tone: "error", message: ($ == null ? void 0 : $.message) || "保存失败，请稍后再试。" }), w(Pu($ == null ? void 0 : $.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, T, v, R]), _ = A(() => {
    n && v.delete(n);
  }, [n, v]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: P,
    reason: m,
    setReason: g,
    saving: h,
    status: I,
    issues: b,
    save: C,
    discardDraft: _
  };
}
const Da = "reader-inline-edit";
function pd({ text: e }) {
  const [t, n] = N("");
  return O(() => {
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
  }, [e]), t ? /* @__PURE__ */ L("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function gd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var _;
  const s = e.itemId, i = hd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = N(!1), [u, f] = N(!1), d = x(null), m = Au(e.rect, t), g = V(() => Mu(o), [o]), h = g.indexOf(s), { loaded: y } = i, I = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: w, select: v } = n, R = A((k) => {
    const E = g[h + k];
    E && (v(E), a == null || a(E));
  }, [g, h, v, a]), T = A(() => {
    i.discardDraft(), w();
  }, [i, w]), P = A(async (k, E) => {
    await i.save(k, E) && w();
  }, [i, w]);
  O(() => {
    const k = (E) => {
      !E.altKey || E.key !== "ArrowUp" && E.key !== "ArrowDown" || (E.preventDefault(), R(E.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", k), () => window.removeEventListener("keydown", k);
  }, [R]), xe(() => {
    const k = d.current;
    if (!k) return;
    k.style.height = "auto";
    const E = m.mode === "inline" ? m.minHeight : 0;
    k.style.height = `${Math.max(E, k.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const C = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ L(Ae, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${Da} is-${m.mode}`,
        style: C,
        role: "group",
        "aria-label": `改第 ${((_ = n.target) == null ? void 0 : _.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (k) => k.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            ie,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((k) => !k),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            mi,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: I || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (k) => i.setDraft(k.target.value),
              onKeyDown: (k) => {
                k.key === "Enter" && (k.metaKey || k.ctrlKey) ? (k.preventDefault(), b || P()) : k.key === "Escape" && (k.preventDefault(), T());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(pd, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(Ks, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(dn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              or,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: I || !!S || !y,
                onChange: (k) => i.setReason(k.target.value),
                onKeyDown: (k) => {
                  k.key === "Enter" ? (k.preventDefault(), b || P()) : k.key === "Escape" && (k.preventDefault(), T());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ L(
              ie,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((k) => !k),
                children: [
                  /* @__PURE__ */ p(Ws, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(ie, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: T, children: "取消" }),
            /* @__PURE__ */ p(
              ie,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: I || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  P();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((k) => /* @__PURE__ */ p("li", { children: k }, k)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((k, E) => {
            const M = k.text === y.current, D = [Iu(k.ts), k.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": k.label, "data-current": M ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  D,
                  M ? "（现在用的）" : "",
                  k.reason ? ` · ${k.reason}` : ""
                ] }),
                M ? null : /* @__PURE__ */ p(
                  ie,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: I || !!S,
                    onClick: () => {
                      P(k.text, `回到「${D.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: k.text })
            ] }, `${k.ts}:${E}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const $a = Zt(null), Oa = Zt(null);
function bd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p($a.Provider, { value: e, children: /* @__PURE__ */ p(Oa.Provider, { value: t, children: n }) });
}
function Ge() {
  return dt($a);
}
function dr() {
  return dt(Oa);
}
const za = 1.414;
function yd({
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
  var Z, ge;
  const b = Ge(), w = b == null ? void 0 : b.revisedBlocks, v = b == null ? void 0 : b.blockEdit, R = v == null ? void 0 : v.pendingEdits, T = b == null ? void 0 : b.editBlock, P = (b == null ? void 0 : b.findTerm) || "", C = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", _ = b == null ? void 0 : b.textMarks, k = V(
    () => _ ? ({ str: B }) => gu(B, _(B), P) : P ? ({ str: B }) => zt(B, P) : void 0,
    [P, _]
  ), E = x(c ?? za), [M, D] = N(E.current);
  O(() => {
    c != null && Math.abs(c - E.current) >= 1e-3 && (E.current = c, D(c));
  }, [c]);
  const $ = x(u);
  $.current = u;
  const K = x(null), H = x((B) => {
    var ne;
    K.current = B, (ne = $.current) == null || ne.call($, B);
  }).current, J = x(null), ue = x(`${t}@${n}`);
  xe(() => {
    const B = `${t}@${n}`;
    ue.current !== B && (ue.current = B, o && wd(K.current, J.current));
  }, [o, n, t]), O(() => {
    o || Nn(J.current);
  }, [o]), O(() => () => Nn(J.current), []);
  const Q = Math.max(120, Math.floor(t * M)), ce = Math.max(Q, Math.ceil(s || 0)), Se = gt(f, t, Q), Y = V(
    () => Lu(d, t, Q),
    [Q, d, t]
  ), [de, Le] = N(null), ae = typeof g == "function", fe = ae ? m ?? null : de, F = (B) => {
    ae ? B !== (m ?? null) && (g == null || g(B)) : Le((ne) => ne === B ? ne : B);
  }, U = V(
    () => Y.find((B) => B.itemId === fe) || null,
    [fe, Y]
  ), q = r === "translated" && ((Z = v == null ? void 0 : v.target) == null ? void 0 : Z.itemId) || "", oe = V(
    () => q && Y.find((B) => B.itemId === q) || null,
    [q, Y]
  ), re = md(K, o ? U : null, Y, t), me = (B) => {
    var Re, Fe, Oe, De;
    if (B.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      F(null);
      return;
    }
    if (B.buttons !== 0) {
      F(null);
      return;
    }
    if ((Fe = (Re = B.target) == null ? void 0 : Re.closest) != null && Fe.call(Re, `.${Aa}`) || (De = (Oe = B.target) == null ? void 0 : Oe.closest) != null && De.call(Oe, `.${Da}`)) return;
    const ne = B.currentTarget.getBoundingClientRect(), he = B.clientX - ne.left, Ce = B.clientY - ne.top;
    if (ud(re, he, Ce)) return;
    const _e = eo(Y, he, Ce);
    F((_e == null ? void 0 : _e.itemId) || null);
  }, Ie = (B) => {
    if (B.pointerType === "mouse") return;
    const ne = B.currentTarget.getBoundingClientRect(), he = eo(
      Y,
      B.clientX - ne.left,
      B.clientY - ne.top
    );
    F((he == null ? void 0 : he.itemId) || null);
  }, se = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(E.current - B) < 1e-3 || (E.current = B, D(B), l == null || l(e, B));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: H,
      [Pe]: e,
      [ke]: r,
      [ar]: Q,
      className: sr,
      onPointerMoveCapture: me,
      onPointerDown: Ie,
      onDoubleClick: (B) => {
        const ne = b == null ? void 0 : b.zoomBlock;
        !ne || b != null && b.pointerTaken || !U || Ue(U.highlight.region) === "figure" && (B.preventDefault(), ne(U.itemId));
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
          pi,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: k,
            renderAnnotationLayer: !1,
            className: fa,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: mn,
                style: { width: t, height: Q }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const ne = B.getViewport({ scale: 1 });
                if (ne.width > 0) {
                  const he = ne.height / ne.width;
                  se(he);
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
            style: { width: t, height: Q },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        Se ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: Se,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && I ? /* @__PURE__ */ p(
          td,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: Q
          }
        ) : null,
        o && I && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p(rd, { targets: Y, edits: R, width: t, excludeId: oe == null ? void 0 : oe.itemId }) : null,
        o && oe && v ? /* @__PURE__ */ p(
          gd,
          {
            target: oe,
            page: { width: t, height: Q },
            edit: v,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
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
        (ge = b == null ? void 0 : b.pageLayers) == null ? void 0 : ge.map((B) => /* @__PURE__ */ p(yn, { children: B.render({ page: e, width: t, height: Q, pane: C, active: o }) }, B.id)),
        /* @__PURE__ */ p(
          Ku,
          {
            target: o && !(b != null && b.pointerTaken) && (U == null ? void 0 : U.itemId) !== (oe == null ? void 0 : oe.itemId) ? U : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: U && (w == null ? void 0 : w.get(U.itemId)) || 0,
            onEdit: T,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: re == null ? void 0 : re.rect,
            placement: re == null ? void 0 : re.placement,
            tailTop: re == null ? void 0 : re.tailTop
          }
        )
      ]
    }
  );
}
const vd = Yt(yd);
function wd(e, t) {
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
const Sd = 2 * 1024 * 1024;
function Id(e) {
  const t = new ia.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const An = 5, kd = "120% 0px", Td = 120, Ed = "25% 0px";
let no = 1;
const ro = /* @__PURE__ */ new WeakMap();
function Pd(e) {
  if (!e) return 0;
  const t = ro.get(e);
  if (t) return t;
  const n = no;
  return no += 1, ro.set(e, n), n;
}
function Rd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Md = Es(
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
    showLiveTranslation: R = t === "source",
    liveTranslationPendingLabel: T = "",
    paneAction: P
  }, C) {
    ru();
    const { file: _, loading: k, error: E } = ec(n, r), M = `${n}\0${Pd(_)}`, D = x(M);
    D.current = M;
    const $ = V(() => {
      const z = Ji(_);
      return z ? "ranged" in z ? { range: Id(z.ranged) } : z : null;
    }, [_, n]), [K, H] = N(0), [J, ue] = N(""), [Q, ce] = N(null), [Se, Y] = N(480), de = x(null), Le = x(0), ae = V(() => Rd(), []), fe = V(() => ({
      cMapUrl: Vt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Vt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Sd,
      disableAutoFetch: !0
    }), []);
    rr(C, () => Q, [Q]), O(() => {
      const z = (X) => {
        Le.current = X, Y(X);
      }, G = (X) => {
        const be = Ic(X, Le.current);
        if (be !== "ignore") {
          if (de.current && clearTimeout(de.current), be === "immediate") {
            z(X);
            return;
          }
          de.current = setTimeout(() => z(X), ba);
        }
      }, te = !!(c && c >= 80);
      G(te ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ve = !te && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var be, Te;
        G(((Te = (be = X[0]) == null ? void 0 : be.contentRect) == null ? void 0 : Te.width) ?? i.clientWidth);
      }) : null;
      return ve && i && ve.observe(i), () => {
        ve == null || ve.disconnect(), de.current && clearTimeout(de.current);
      };
    }, [c, i, a]);
    const F = V(
      () => vc(Se, o),
      [Se, o]
    ), [U, q] = N(() => /* @__PURE__ */ new Map()), [oe, re] = N(() => /* @__PURE__ */ new Set()), [me, Ie] = N(() => /* @__PURE__ */ new Set()), se = x(/* @__PURE__ */ new Map()), Z = x(null), ge = x(null), [B, ne] = N(() => /* @__PURE__ */ new Set()), he = x(/* @__PURE__ */ new Map()), Ce = A((z, G) => {
      q((te) => {
        if (te.get(z) === G) return te;
        const le = new Map(te);
        return le.set(z, G), le;
      });
    }, []), _e = A((z, G) => {
      const te = se.current, le = te.get(z), ve = [Z.current, ge.current];
      if (le)
        for (const X of ve)
          try {
            X == null || X.unobserve(le);
          } catch {
          }
      if (G) {
        te.set(z, G);
        for (const X of ve)
          try {
            X == null || X.observe(G);
          } catch {
          }
      } else
        te.delete(z);
    }, []), Re = x(/* @__PURE__ */ new Map()), Fe = A((z) => {
      const G = Re.current;
      let te = G.get(z);
      return te || (te = (le) => _e(z, le), G.set(z, te)), te;
    }, [_e]);
    O(() => {
      if (typeof IntersectionObserver > "u") return;
      const z = he.current, G = new IntersectionObserver(
        (te) => {
          const le = [], ve = [];
          for (const X of te) {
            const be = X.target, Te = pn(be);
            Number.isFinite(Te) && (X.isIntersecting ? le : ve).push(Te);
          }
          if ((le.length || ve.length) && re((X) => {
            let be = null;
            for (const Te of le)
              X.has(Te) || (be = be || new Set(X), be.add(Te));
            for (const Te of ve)
              X.has(Te) && (be = be || new Set(X), be.delete(Te));
            return be || X;
          }), le.length) {
            for (const X of le) {
              const be = z.get(X);
              be && (clearTimeout(be), z.delete(X));
            }
            Ie((X) => {
              let be = null;
              for (const Te of le)
                X.has(Te) || (be = be || new Set(X), be.add(Te));
              return be || X;
            });
          }
          for (const X of ve)
            z.has(X) || z.set(X, setTimeout(() => {
              z.delete(X), Ie((be) => {
                if (!be.has(X)) return be;
                const Te = new Set(be);
                return Te.delete(X), Te;
              });
            }, Td));
        },
        { root: i, rootMargin: kd, threshold: 0 }
      );
      Z.current = G;
      for (const te of se.current.values())
        try {
          G.observe(te);
        } catch {
        }
      return () => {
        G.disconnect(), Z.current === G && (Z.current = null);
        for (const te of z.values()) clearTimeout(te);
        z.clear();
      };
    }, [i]), O(() => {
      if (typeof IntersectionObserver > "u") return;
      const z = new IntersectionObserver(
        (G) => {
          ne((te) => {
            let le = null;
            for (const ve of G) {
              const X = pn(ve.target);
              !Number.isFinite(X) || ve.isIntersecting === te.has(X) || (le = le || new Set(te), ve.isIntersecting ? le.add(X) : le.delete(X));
            }
            return le || te;
          });
        },
        { root: i, rootMargin: Ed, threshold: 0 }
      );
      ge.current = z;
      for (const G of se.current.values())
        try {
          z.observe(G);
        } catch {
        }
      return () => {
        z.disconnect(), ge.current === z && (ge.current = null);
      };
    }, [i]);
    const Oe = !!i && typeof IntersectionObserver < "u";
    xe(() => {
      H(0), ue(""), re(/* @__PURE__ */ new Set()), Ie(/* @__PURE__ */ new Set()), q(/* @__PURE__ */ new Map()), se.current.clear();
      const z = he.current;
      for (const G of z.values()) clearTimeout(G);
      z.clear(), h == null || h(0, t);
    }, [M, h, t]);
    const De = A(
      (z) => {
        if (D.current !== M) return;
        const G = z.numPages;
        H(G), ue(""), h == null || h(G, t), f == null || f({ numPages: G, pane: t }), m && typeof z.getPage == "function" && m(z, t), d && typeof z.getOutline == "function" && tu(z).then((te) => {
          D.current === M && d(te, t);
        }, () => {
        });
      },
      [M, f, d, m, h, t]
    ), We = A(
      (z) => {
        if (D.current !== M) return;
        const G = (z == null ? void 0 : z.message) || "PDF 解析失败";
        ue(G), H(0), h == null || h(0, t), g == null || g(z, t);
      },
      [M, g, h, t]
    ), ze = V(
      () => K > 0 ? Array.from({ length: K }, (z, G) => G + 1) : [],
      [K]
    );
    O(() => {
      typeof IntersectionObserver < "u" || Ie(new Set(ze));
    }, [ze]);
    const Be = V(
      () => Rt(y, S, t),
      [y, S, t]
    ), j = V(() => {
      const z = /* @__PURE__ */ new Map();
      for (const G of I) {
        const te = Rt(G, S, t);
        if (!te) continue;
        const le = z.get(te.box.page) || [];
        le.push(te), z.set(te.box.page, le);
      }
      return z;
    }, [t, S, I]), W = V(() => {
      const z = /* @__PURE__ */ new Set();
      if (!b) return z;
      for (const [G, te] of j)
        te.some((le) => le.itemId === b) && z.add(G);
      return z;
    }, [b, j]), ee = V(() => {
      if (K === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(ze);
      if (oe.size === 0) {
        const te = Math.min(K, An * 2 + 1);
        return new Set(Array.from({ length: te }, (le, ve) => ve + 1));
      }
      const G = /* @__PURE__ */ new Set();
      for (const te of oe)
        for (let le = -An; le <= An; le++) {
          const ve = te + le;
          ve >= 1 && ve <= K && G.add(ve);
        }
      return G;
    }, [K, ze, i, a, oe]), ye = !n || !!E || !!J, $e = n && (E || J) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: ce,
        className: `reader-panel ${wn}${a ? "" : " is-hidden"}`,
        [ke]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (v == null ? void 0 : v.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          P ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: P }) : null,
          T ? /* @__PURE__ */ L("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: T })
          ] }) : null,
          ye && !k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: $e }) : null,
          k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          $ && !E ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            gi,
            {
              file: $,
              loading: null,
              error: null,
              options: fe,
              onLoadSuccess: De,
              onLoadError: We,
              className: "reader-react-pdf-document",
              children: ze.map((z) => {
                if (ee.has(z))
                  return /* @__PURE__ */ p(
                    vd,
                    {
                      pane: t,
                      pageNumber: z,
                      width: F,
                      devicePixelRatio: ae,
                      active: me.has(z),
                      textLayer: !Oe || B.has(z),
                      syncedMinHeight: (l == null ? void 0 : l.get(z)) || 0,
                      onMetrics: u,
                      cachedAspect: U.get(z),
                      onAspectChange: Ce,
                      sentinelRef: Fe(z),
                      regionHighlight: (Be == null ? void 0 : Be.box.page) === z ? Be : null,
                      regionTargets: j.get(z),
                      hoveredRegionId: b && W.has(z) ? b : null,
                      onHoverRegion: w,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(z - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(z - 1),
                      showLiveTranslation: R,
                      liveTranslationMissing: El(v, z - 1)
                    },
                    `${t}-${z}`
                  );
                const te = U.get(z) ?? za, le = Math.max(120, Math.floor(F * te)), ve = Math.max(le, Math.ceil((l == null ? void 0 : l.get(z)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Fe(z),
                    [Pe]: z,
                    [ke]: t,
                    [ar]: le,
                    className: `${sr} is-placeholder`,
                    style: {
                      width: F,
                      height: ve,
                      minHeight: ve
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: mn,
                        style: { width: F, height: le },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${z}`
                );
              })
            },
            M
          ) }) : null
        ]
      }
    );
  }
), oo = Yt(Md), _d = 2e3, Nd = 6, Ad = 500, ao = "reader-react-resizing";
function xd(e, t) {
  const n = x(null), r = x(null);
  xe(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const w = Ld(e), v = Ht(e, w);
      if (!v) return;
      s = { pane: w, progress: v, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), I = typeof ResizeObserver > "u" ? null : new ResizeObserver((w) => {
      let v = !1;
      for (const R of w) {
        const T = Math.round(R.contentRect.height);
        y.has(R.target) && y.get(R.target) !== T && (v = !0), y.set(R.target, T);
      }
      v && Mt(e, c, "auto", i);
    }), S = () => {
      var w;
      f && clearTimeout(f), cancelAnimationFrame(u), I == null || I.disconnect(), e.classList.remove(ao);
      for (const v of so) e.removeEventListener(v, S);
      ((w = r.current) == null ? void 0 : w.stop) === S && (r.current = null);
    }, b = () => {
      Mt(e, c, "auto", i);
      const w = e.scrollHeight;
      g = w === m ? g + 1 : 0, m = w;
      const v = performance.now() - h;
      g >= Nd && (w !== d || v > Ad) || v > _d ? S() : u = requestAnimationFrame(b);
    };
    for (const w of so) e.addEventListener(w, S, { passive: !0 });
    for (const w of Array.from(e.children)) I == null || I.observe(w);
    e.classList.add(ao), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, ba);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Ld(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Pe}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ke) || null;
  }
  return null;
}
const so = ["wheel", "touchstart", "keydown", "pointerdown"];
function Cd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Dd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(wn)) && ((n = e.hasAttribute) != null && n.call(e, ke)));
}
function $d(e, t) {
  O(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Dd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${wn}[${ke}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = Cd(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Od(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function zd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const io = 12;
function fr(e) {
  return Array.from(e.querySelectorAll(`.${wn}[${ke}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Fd(e) {
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
function Bd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function jd(e, t) {
  return e ? fr(e).find((n) => n.getAttribute(ke) === t) ?? null : null;
}
function Hd({ shellEl: e }) {
  const [t, n] = N([]), r = x(0), o = A(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Fd(e);
      n((i) => Bd(i, s) ? i : s);
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Ud, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Ud({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - io * 2), r = Od(e, n), o = x(null);
  if (!r) return null;
  const a = (d) => {
    const m = jd(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + zd(e, n, r.size, d.clientX - m.startX));
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
function Fa(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Kd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Wd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ L("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
        ie,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Fa(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Qo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Vs, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ L("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ L(
        ie,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(qs, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ L(
        ie,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Js, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function co({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Kd(t), a = [e === "compare" ? "对比" : "正在读", r, Fa(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Vd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return xe(() => {
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
  }, [e]), /* @__PURE__ */ L("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(co, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(co, { role: "reading", ...n }) }) : null
  ] });
}
const qd = () => () => {
}, lo = () => null;
function Jd({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Gd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Xd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Yd(e) {
  const t = Ge(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Qt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, I = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, w = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", v = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, T = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, P = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), C = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), _ = t == null ? void 0 : t.onPdfOutline, k = t == null ? void 0 : t.onPdfDocument, E = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), M = e.regions ?? (t == null ? void 0 : t.regions) ?? [], D = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), $ = (t == null ? void 0 : t.regionHover) ?? null, [K, H] = N(null), J = vn(
    $ ? $.subscribe : qd,
    $ ? () => $.get().itemId : lo,
    $ ? () => $.get().itemId : lo
  ), ue = $ ? J : K, Q = A((de) => {
    $ ? $.set(de, "pdf") : H(de);
  }, [$]), ce = Jd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), Y = Number.isFinite(g) && g > 0 ? Gd(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !ce.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return xd(d, Y), $d(d, ce.compareMode), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: da,
      "data-reader-region-count": M.length,
      "data-reader-structured-region-count": M.filter(Os).length,
      "data-reader-metadata-ready": D ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${ua} reader-mode-${ce.mode}`,
            "data-reader-mode": ce.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                oo,
                {
                  pane: "source",
                  url: w,
                  preloadedFile: R,
                  userZoom: m,
                  visible: ce.showSource,
                  scrollRoot: d,
                  pageWidthOverride: Y,
                  rowHeights: ce.compareMode ? h : void 0,
                  onMetrics: P,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: C,
                  onOutline: b ? void 0 : _,
                  onDocument: b ? void 0 : k,
                  activeRegion: E,
                  regions: (b == null ? void 0 : b.regions) ?? M,
                  readerMetadata: D,
                  hoveredRegionId: ue,
                  onHoverRegion: Q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Xd(o) : "",
                  paneAction: u && ce.showTranslated ? /* @__PURE__ */ L(Ae, { children: [
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
                  preloadedFile: T,
                  userZoom: m,
                  visible: ce.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: Y,
                  rowHeights: ce.compareMode ? h : void 0,
                  onMetrics: P,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: C,
                  onOutline: _,
                  onDocument: k,
                  activeRegion: E,
                  regions: M,
                  readerMetadata: D,
                  hoveredRegionId: ue,
                  onHoverRegion: Q,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Hd, { shellEl: d }),
        b ? /* @__PURE__ */ p(Vd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Zd = [
  { id: "source", label: "原文", Icon: ea },
  { id: "compare", label: "对照", Icon: ta },
  { id: "translated", label: "译文", Icon: na }
];
function Qd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function ef(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function tf(e) {
  const t = Ge(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Qd(a.state) : "";
  return /* @__PURE__ */ L("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }),
    /* @__PURE__ */ L("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Zd.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = ef({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ L(yn, { children: [
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
              /* @__PURE__ */ p(Gs, { ...Ee, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ L(
          ie,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Xs, { ...Ee, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ L(
        ie,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(Ys, { ...Ee, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-end", children: e.end })
  ] });
}
const Ba = [];
function nf() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = Ba;
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
function rf(e, t) {
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
function of(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function af(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function sf(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function cf(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function lf(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function uf(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function df(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const In = Zt(null), ja = Zt(null);
function ff({ api: e, store: t, children: n }) {
  const r = V(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(In.Provider, { value: r, children: n });
}
function en() {
  const e = dt(In);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const mf = () => () => {
}, uo = () => Ba;
function hf(e) {
  return vn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Ha() {
  var t;
  const e = (t = dt(In)) == null ? void 0 : t.store;
  return vn((e == null ? void 0 : e.subscribe) ?? mf, (e == null ? void 0 : e.getSnapshot) ?? uo, (e == null ? void 0 : e.getSnapshot) ?? uo);
}
function kn(e) {
  var a;
  const t = (a = dt(In)) == null ? void 0 : a.store, n = dt(ja);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  O(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), O(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class pf extends Ps {
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
const gf = Yt(function({ extensions: t }) {
  return /* @__PURE__ */ p(Ae, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(pf, { id: n, children: /* @__PURE__ */ p(bf, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function bf({ id: e, title: t, children: n }) {
  const r = V(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(ja.Provider, { value: r, children: n });
}
function yf({
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
      ie,
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
function Ua(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Ka(e, t, n, r) {
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
function Wa({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = x(null), [i, c] = N({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return O(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = Ka(n, m, r, g), y = s.current, I = y == null ? void 0 : y.getContext("2d");
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
const vf = 1600, mr = { left: 0, top: 0, width: 1, height: 1 };
function Va(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function wf(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function Sf(e, t, n = mr, r = vf) {
  const o = await e.getPage(t), a = Ka(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, Va(s);
}
async function If(e, t = mr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), Va(s);
}
function kf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const Tf = 4e3;
function Ef(e, t, n) {
  if (e.length) {
    const o = nu(e, n), a = o ? Ma(e).find((s) => s.id === o) : null;
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
`).trim().slice(0, Tf), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function Pf(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Rt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = gt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function Rf({
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
  const l = e.getAttribute(ke) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? Pf(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: Ef(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
function Mf(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Pe}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Pe)) || 0, i = (o.closest(`[${ke}]`) ?? o).getAttribute(ke) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function _f({ onDone: e, onCancel: t }) {
  const [n, r] = N(null), o = x(null), a = x(null);
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
      return Mf(c, l);
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
        const f = wf(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const ho = 5e4, Nf = 2e4;
function xn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function zg(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Af(e, t = null) {
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
function xf(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Lf(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function Fg(e, t) {
  var r;
  const n = Lf(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Bg(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function Cf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Df(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Df(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function $f(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Cf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: xf(o.selection, n),
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
function Of(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: xn(e.question.text, ho), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: xn(e.answer.text, ho),
      thought: e.answer.thought ? xn(e.answer.thought, Nf) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function zf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Ff(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Bf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function jf(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Hf = 50, qa = 2, Ln = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Uf() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function po(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Kf({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = N(!1), [i, c] = N(Ln), [l, u] = N(!1), [f, d] = N(""), [m, g] = N("idle"), [h, y] = N(null), [I, S] = N([]), b = A((F) => {
    y(F), S([]);
  }, []), w = A((F) => S((U) => [...U, F].slice(-qa)), []), [v, R] = N(() => /* @__PURE__ */ new Map()), T = x(/* @__PURE__ */ new Set()), P = x(/* @__PURE__ */ new Map()), C = (F) => {
    if (!F) return null;
    const U = P.current.get(F);
    return U || (_.current.records.some((q) => q.message_id === F) ? F : null);
  }, _ = x(i);
  _.current = i;
  const k = x(t);
  k.current = t;
  const E = x(0), M = A(async (F, U, q, oe = []) => {
    if (!r) return;
    const re = await r.messages(F.conversation_id, { limit: Hf, ...q ? { beforeSeq: q } : {} }), me = [...re.messages, ...oe];
    E.current += 1, c({
      conversation: F,
      main: U ?? F,
      records: me,
      compactions: re.compactions || [],
      hasMore: re.has_more,
      key: `${F.conversation_id}:${E.current}`,
      initial: $f(me, re.compactions || [], k.current.documentId)
    });
  }, [r]), D = A(async () => {
    s(!0);
    const F = _.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) === "main" && F.status !== "archived")) {
      u(!0), d("");
      try {
        const U = await r.main(k.current.documentId || void 0);
        await M(U, U);
      } catch (U) {
        d(U instanceof Error ? U.message : String(U));
      } finally {
        u(!1);
      }
    }
  }, [r, M]), $ = A((F) => {
    b(F), D();
  }, [D]), K = x(t.documentId);
  O(() => {
    K.current !== t.documentId && (K.current = t.documentId, _.current = Ln, c(Ln), b(null), R(/* @__PURE__ */ new Map()), P.current.clear(), a && D());
  }, [t.documentId, a, D]);
  const H = A(async () => {
    const F = _.current, U = F.records[0];
    if (!(!F.conversation || !U || !F.hasMore)) {
      u(!0);
      try {
        await M(F.conversation, F.main, U.seq, F.records);
      } finally {
        u(!1);
      }
    }
  }, [M]), J = A(async (F) => {
    const q = _.current.conversation;
    if (!r || !q) return;
    for (const Z of F.memoryIds) T.current.add(Z);
    let oe = F.memoryIds;
    if (!oe.length && o && F.startedAt) {
      const Z = Ff(
        await o.list({ source_conversation_id: q.conversation_id, created_after: zf(F.startedAt) }).catch(() => []),
        T.current
      );
      for (const B of Z) T.current.add(B.id);
      oe = Z.map((B) => B.id);
      const ge = F.answerId;
      Z.length && ge && R((B) => new Map(B).set(ge, Z));
    }
    const re = Of({ ...F, memoryIds: oe }, k.current.documentId, Uf(), C(F.editedFrom));
    let me;
    try {
      me = await r.append(q.conversation_id, re);
    } catch (Z) {
      if (q.kind !== "side" || !/ask_conversation_not_open/.test(po(Z))) throw Z;
      await r.reopen(q.conversation_id), me = await r.append(q.conversation_id, re);
    }
    const [Ie, se] = me.messages;
    F.questionId && Ie && P.current.set(F.questionId, Ie.message_id), F.answerId && se && P.current.set(F.answerId, se.message_id), c((Z) => {
      var ge;
      return ((ge = Z.conversation) == null ? void 0 : ge.conversation_id) === q.conversation_id ? { ...Z, conversation: me.conversation, records: [...Z.records, ...me.messages] } : Z;
    }), n == null || n(me.messages), me.compaction_due && q.kind === "main" && r.compact(q.conversation_id).catch(() => {
    });
  }, [r, o, n]), ue = A(async (F) => {
    const U = _.current.conversation, q = C(F);
    if (!r || !U || !q) return null;
    try {
      await r.supersede(U.conversation_id, q);
    } catch (me) {
      if (!/ask_message_superseded/.test(po(me))) throw me;
    }
    const oe = _.current.records.find((me) => me.message_id === q), re = _.current.records.findIndex((me) => me.message_id === q);
    return c((me) => ({ ...me, records: me.records.map((Ie, se) => se >= re && re >= 0 && !Ie.superseded_at ? { ...Ie, superseded_at: "now" } : Ie) })), (oe == null ? void 0 : oe.selection) ?? null;
  }, [r]), Q = A((F) => {
    J(F).catch((U) => d(`这一轮没存上：${U instanceof Error ? U.message : String(U)}`));
  }, [J]), ce = A(async (F) => {
    var oe;
    const U = _.current, q = U.main;
    if (!(!r || !q || ((oe = U.conversation) == null ? void 0 : oe.kind) !== "main")) {
      d("");
      try {
        const re = Bf(U.records, F), me = await r.fork({
          parent_id: q.conversation_id,
          ...re ? { forked_from_message_id: re } : {},
          title: jf(F.text),
          ...k.current.documentId ? { document_id: k.current.documentId } : {}
        });
        await M(me, q);
      } catch (re) {
        d(`开不了副对话：${re instanceof Error ? re.message : String(re)}`);
      }
    }
  }, [r, M]), Se = A(async (F) => {
    const U = _.current.main;
    if (r)
      try {
        await M(await r.get(F), U);
      } catch (q) {
        d(`打不开副对话：${q instanceof Error ? q.message : String(q)}`);
      }
  }, [r, M]), Y = A(async () => {
    const F = _.current.main;
    F && await M(F, F).catch(() => {
    });
  }, [M]), de = A(async () => {
    const F = _.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) !== "side")) {
      g("busy");
      try {
        await r.close(F.conversation_id), g("idle"), await Y();
      } catch {
        g("failed");
      }
    }
  }, [r, Y]), Le = A(async () => r != null && r.archived ? r.archived(k.current.documentId) : [], [r]), ae = A(async (F) => {
    d(""), b(null);
    try {
      await M(F, _.current.main);
    } catch (U) {
      d(`打不开这个对话：${U instanceof Error ? U.message : String(U)}`);
    }
  }, [M, b]), fe = A(async () => {
    const F = _.current.main;
    if (!r || !F) return;
    await r.archive(F.conversation_id);
    const U = await r.main(k.current.documentId || void 0);
    await M(U, U);
  }, [r, M]);
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
    ask: $,
    close: A(() => s(!1), []),
    loadEarlier: H,
    onTurn: Q,
    rewrite: ue,
    fork: ce,
    openSide: Se,
    backToMain: Y,
    closeSide: de,
    archiveMain: fe,
    listArchived: Le,
    viewArchived: ae,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function go(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Af({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Wf({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = N([]), s = x(0), i = x(r);
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
  const l = A((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => go(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = A((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Vf = Go(() => import("./ReaderAskPanel-C9DzQBiX.js"));
function qf({
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
  const S = V(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), b = A((j, W, ee) => {
    const ye = j ? o.find((G) => G.itemId === j) : null, $e = ye ? Rt(ye, a, W) : null, z = $e && $e.box.page === ee ? gt($e, 1, 1) : null;
    return z ? { x: z.left, y: z.top } : null;
  }, [o, a]), w = Wf({ port: e, documentId: t, resetKey: c, pointOf: b }), v = Kf({ port: e, book: S, onAppended: w.addRecords }), [R, T] = N(null), P = A(
    (j, W, ee, ye) => Rf({
      pageElement: (j == null ? void 0 : j.closest(`[${Pe}]`)) ?? null,
      clientX: W,
      clientY: ee,
      itemId: i(),
      selection: ye,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), C = A(() => {
    var W;
    const j = mo(((W = globalThis.getSelection) == null ? void 0 : W.call(globalThis)) ?? null);
    return !j.text || !j.element || !j.rect ? null : P(j.element, j.rect.left + j.rect.width / 2, j.rect.top + j.rect.height / 2, j.text);
  }, [P]), _ = A((j) => {
    T(null), v.ask(j);
  }, [v.ask]);
  O(() => {
    if (!e) return;
    const j = (W) => {
      var $e;
      if (W.key !== "?" || W.metaKey || W.ctrlKey || W.altKey || W.defaultPrevented) return;
      const ee = W.target;
      if (($e = ee == null ? void 0 : ee.closest) != null && $e.call(ee, "input, textarea, select, [contenteditable='true']")) return;
      const ye = C();
      ye && (W.preventDefault(), W.stopImmediatePropagation(), _(ye));
    };
    return window.addEventListener("keydown", j, !0), () => window.removeEventListener("keydown", j, !0);
  }, [e, C, _]);
  const k = x(/* @__PURE__ */ new Set()), E = ((Be = v.pending) == null ? void 0 : Be.selection) || "";
  O(() => {
    E && k.current.add(E);
  }, [E]);
  const M = v.visible && !R, D = v.setPending, [$, K] = N(null), H = !!v.pending;
  O(() => {
    H || K(null);
  }, [H]);
  const J = x(v.pending);
  J.current = v.pending, O(() => {
    if (!M) return;
    let j = null;
    const W = () => {
      j && clearTimeout(j), j = setTimeout(() => {
        const ee = C();
        !ee || k.current.has(ee.selection) || (J.current ? K(ee) : D(ee));
      }, 250);
    };
    return document.addEventListener("selectionchange", W), () => {
      j && clearTimeout(j), document.removeEventListener("selectionchange", W);
    };
  }, [M, C, D]);
  const ue = v.addExtra, Q = v.extras.length, ce = V(() => {
    if (!$) return null;
    const j = () => {
      k.current.add($.selection), K(null);
    };
    return {
      label: `第 ${$.page} 页 · ${[...$.selection].length} 字`,
      replace: () => {
        j(), D($);
      },
      ...Q < qa ? { add: () => {
        j(), ue($);
      } } : {},
      dismiss: j
    };
  }, [$, Q, D, ue]), Se = x(m);
  Se.current = m;
  const Y = A(async ({ page: j, pane: W, region: ee, canvas: ye }) => {
    const $e = Se.current[W];
    let z;
    if ($e)
      z = await Sf($e, j, ee);
    else {
      const G = ye ?? document.querySelector(`[${ke}="${W}"] [${Pe}="${j}"] canvas`);
      if (!G) throw new Error(`第 ${j} 页还没画出来，翻到那一页再试`);
      z = await If(G, ee);
    }
    return new File([z], kf(j, ee), { type: "image/png" });
  }, []), [de, Le] = N(null), ae = x(v.pending);
  ae.current = v.pending;
  const fe = V(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(Zs, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const j = ae.current, W = (j == null ? void 0 : j.pane) || (h === "translated" ? "translated" : "source");
      return Y({ page: (j == null ? void 0 : j.page) || g() || 1, pane: W, region: mr });
    }
  }], [Y, g, h]), [F, U] = N(!1), [q, oe] = N(""), re = A(async (j) => {
    U(!1), oe("");
    try {
      const W = await Y(j), ee = P(j.point.target, j.point.x, j.point.y, "");
      Le((ye) => ({ id: ((ye == null ? void 0 : ye.id) || 0) + 1, files: [W] })), ee ? _({ ...ee, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (W) {
      oe(W instanceof Error ? W.message : String(W));
    }
  }, [Y, P, _]), me = A(() => U(!1), []), Ie = A(() => {
    oe(""), U((j) => !j);
  }, []), se = A(async (j) => {
    if (j.threadId && (e != null && e.threads) && t) {
      try {
        const W = await e.threads.get(t, j.threadId);
        T({ anchor: W.anchor || j.anchor, messages: W.messages || [], mark: j });
      } catch {
        T({ anchor: j.anchor, messages: [], mark: j });
      }
      return;
    }
    T(null), v.openMain();
  }, [e, t, v.openMain]), Z = A((j) => {
    var ye;
    if (!e) return [];
    const W = mo(((ye = globalThis.getSelection) == null ? void 0 : ye.call(globalThis)) ?? null), ee = P(j.target, j.clientX, j.clientY, W.element ? W.text : "");
    return ee ? [{
      key: "ask",
      label: ee.selection ? "问这段" : "在这里提问",
      hint: ee.selection ? "?" : void 0,
      onSelect: () => _(ee)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        oe(""), U(!0);
      }
    }] : [];
  }, [e, P, _]), ge = R ? {
    anchor: R.anchor,
    messages: R.messages,
    onClose: () => T(null),
    onDelete: e != null && e.threads && R.mark.threadId ? () => {
      e.threads.remove(t, R.mark.threadId).catch(() => {
      }), w.removeMark(R.mark.key), T(null);
    } : void 0
  } : null, B = V(() => f ? (j, W) => {
    f(j, W ?? void 0), requestAnimationFrame(() => d(j, "translated"));
  } : null, [f, d]), ne = A((j) => Na(o, j), [o]), [he, Ce] = N(0), _e = A(({ mode: j, width: W }) => {
    Ce(j === "dock" ? Math.round(W) : 0);
  }, []), Re = !v.persistent || !!v.view.conversation || !!v.error, Fe = e && (v.visible && Re || R) ? /* @__PURE__ */ p(Jo, { fallback: null, children: /* @__PURE__ */ p(
    Vf,
    {
      port: e,
      jobId: n,
      book: S,
      ask: v,
      legacy: ge,
      onShowSelection: ({ page: j, pane: W }) => l(j, W),
      onJumpToPage: (j) => l(j),
      pageCount: u,
      onLayout: _e,
      dockTaken: y !== null,
      dockHost: I,
      onEditBlock: B,
      canEditBlock: ne,
      attachTools: fe,
      attachRequest: de,
      contextOffer: ce
    }
  ) }) : null, Oe = F || q ? /* @__PURE__ */ L(Ae, { children: [
    F ? /* @__PURE__ */ p(_f, { onDone: (j) => void re(j), onCancel: me }) : null,
    q ? /* @__PURE__ */ L("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => oe(""), children: [
      "截图没成：",
      q
    ] }) : null
  ] }) : null, De = v.visible && Re || !!R, We = v.close, ze = A(() => {
    if (De) {
      T(null), We();
      return;
    }
    v.openMain();
  }, [De, We, v.openMain]);
  return { marks: w.marks, onMark: se, menuItems: Z, panel: Fe, overlay: Oe, cropping: F, toggleCrop: Ie, open: v.openMain, toggle: ze, showing: De, reserveRight: De ? he : 0, enabled: !!e };
}
const Jf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Gf() {
  const e = en(), t = V(() => {
    try {
      return nt().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = qf({
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
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: f, showing: d, reserveRight: m } = n, g = V(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Qs,
      pressed: d,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: ei,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: h, height: y }) => /* @__PURE__ */ p(yf, { marks: r, page: h, height: y, onOpen: o }) : void 0,
    shortcuts: Jf,
    reserveRight: m,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, m, c, l]);
  return kn(g), /* @__PURE__ */ L(Ae, { children: [
    s,
    i
  ] });
}
const Xf = { id: "ask", title: "提问", Component: Gf };
function qn() {
  try {
    return nt().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Yf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Zf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Qf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function em({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null);
  O(() => {
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
  const s = Zf(n, t, o);
  return V(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function tm({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = N(null), [s, i] = N(""), [c, l] = N(""), u = x(0);
  O(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = A((g) => {
    const h = qn(), y = n.find((S) => S.versionId === g);
    if (!h || !y || !e) return;
    const I = ++u.current;
    i(g), l(""), (async () => {
      const S = nt(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const w = await S.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), v = S.resolveReaderTranslatedPdfUrl(w.jobPayload, w.manifestPayload);
      if (!v) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: v, regions: Yf(Yo(w.regionsPayload)) };
    })().then((S) => {
      I === u.current && a(S);
    }).catch((S) => {
      I === u.current && l((S == null ? void 0 : S.message) || "这一份打不开。");
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
    } catch (S) {
      l((S == null ? void 0 : S.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((I = globalThis.history) == null || I.replaceState(globalThis.history.state, "", Qf(h, o.jobId))), a(null);
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
function nm(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: ti,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(Wd, { compare: e, onDone: t })
  } : null;
}
function rm(e) {
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
function om() {
  var i;
  const e = en(), t = tm({
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
  const s = V(() => {
    const c = nm(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: rm(t) };
  }, [t]);
  return kn(s), null;
}
const am = { id: "compare", title: "对比版本", Component: om }, Ja = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], bo = { pen: 35e-4, highlighter: 0.018 }, yo = 0.015, Jn = "retainpdf.reader.ink.v1:";
function vo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Jn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function sm(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Jn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Jn + e);
    } catch {
    }
}
function im(e, t, n, r, o, a) {
  const s = yo * yo;
  return e.filter((i) => Ga(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Ga(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function cm(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function lm(e) {
  const [t, n] = N(null), [r, o] = N(Ja[0].key), [a, s] = N(() => vo(e)), i = x(a), c = x([]);
  O(() => {
    const h = vo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = A((h) => {
    i.current = h, s(h), sm(e, h);
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
  return V(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const um = [
  { tool: "pen", label: "画笔", Icon: un },
  { tool: "highlighter", label: "荧光笔", Icon: ni },
  { tool: "eraser", label: "橡皮", Icon: ri }
];
function dm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function fm({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L(Ae, { children: [
    um.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      ie,
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
    Ja.map((o) => /* @__PURE__ */ p(
      ie,
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
    /* @__PURE__ */ p(ie, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(oi, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      ie,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(ai, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      ie,
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
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(fm, { ink: e, page: t, onPick: n }) });
}
function mm(e) {
  const t = x(e);
  t.current = e, O(() => {
    const n = (r) => {
      if (dm(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const hm = "reader-ink-layer";
function pm(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function So({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: pm(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function gm({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = x(!1), c = o.strokes.filter((h) => Ga(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(im(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s([[y, I]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s((S) => S ? cm(S, y, I) : [[y, I]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: bo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: hm,
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
const bm = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function ym(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: un,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ L("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
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
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(gm, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: bm
  };
}
function vm() {
  const e = en(), t = lm(e.resetKey);
  mm(t);
  const n = V(() => ym(t), [t]);
  return kn(n), null;
}
const wm = { id: "ink", title: "画笔", Component: vm };
function Sm(e) {
  const t = x(!1);
  return e && (t.current = !0), t.current;
}
const Im = Go(() => import("./ReaderMarkdownPanel-Dn4kn4un.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Xa = { id: "markdown", label: "Markdown", short: "MD", Icon: si, needsJob: !0 };
function km() {
  const e = en(), t = e.activePanel === Xa.id;
  if (!Sm(t)) return null;
  const r = /* @__PURE__ */ p(Jo, { fallback: null, children: /* @__PURE__ */ p(Im, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? hi(r, e.panelHost) : r;
}
const Tm = {
  id: "markdown",
  title: "Markdown",
  Component: km,
  panels: [Xa]
}, Ya = "reader-xref", Gn = "data-xref", Bt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Em = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Bt})`), Pm = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Xn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Rm(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Mm(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function _m(e, t, n) {
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
function Nm(e, t, n) {
  return (e.find((o) => Ue(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Am(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ue(r), s = Mm(r);
    if (a === "formula") {
      for (const g of s.matchAll(Pm)) {
        const h = Xn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Em.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = Rm(i[1]), u = Xn(i[2]), f = _m(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Nm(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const xm = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Bt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Bt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Bt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Bt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Lm(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of xm) {
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
function Cm(e, t) {
  return Lm(e, t).map((n) => ({ start: n.start, end: n.end, className: Ya, attrs: { [Gn]: n.key } }));
}
const Dm = { figure: "图", table: "表", equation: "式" };
function Io(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Dm[e.kind]} ${e.label}`;
}
const ko = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function $m(e, t, n) {
  const r = Rt(e, t, n), o = r ? gt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Ua({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Om(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = Rt(u, t, n), d = f ? gt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Ua({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function zm(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function Fm(e, t) {
  const n = (o) => {
    const a = Ue(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Bm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var C;
  const i = t.find((_) => _.itemId === e) ?? null, c = V(() => i ? Fm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = N(rt.indexOf(1)), d = rt[u], m = x(null), [g, h] = N(0);
  xe(() => {
    const _ = m.current;
    if (!_) return;
    const k = () => h(_.clientWidth);
    k();
    const E = typeof ResizeObserver == "function" ? new ResizeObserver(k) : null;
    return E == null || E.observe(_), () => E == null ? void 0 : E.disconnect();
  }, []);
  const y = A((_) => {
    const k = c[l + _];
    k && a(k.itemId);
  }, [c, l, a]);
  O(() => {
    const _ = (k) => {
      if (k.key === "Escape")
        k.preventDefault(), s();
      else if (k.key === "ArrowLeft")
        k.preventDefault(), y(-1);
      else if (k.key === "ArrowRight")
        k.preventDefault(), y(1);
      else if (k.key === "+" || k.key === "=")
        k.preventDefault(), f((E) => Math.min(rt.length - 1, E + 1));
      else if (k.key === "-" || k.key === "_")
        k.preventDefault(), f((E) => Math.max(0, E - 1));
      else if (k.key === "0")
        k.preventDefault(), f(rt.indexOf(1));
      else
        return;
      k.stopPropagation();
    };
    return window.addEventListener("keydown", _, !0), () => window.removeEventListener("keydown", _, !0);
  }, [s, y]), O(() => {
    const _ = m.current;
    if (!_) return;
    const k = (E) => {
      !E.ctrlKey && !E.metaKey || (E.preventDefault(), f((M) => Math.max(0, Math.min(rt.length - 1, M + (E.deltaY < 0 ? 1 : -1)))));
    };
    return _.addEventListener("wheel", k, { passive: !1 }), () => _.removeEventListener("wheel", k);
  }, []);
  const I = x(null);
  if (!i) return null;
  const S = Ue(i), b = o.map((_) => ({ pane: _, pdf: r[_] ?? null, where: $m(i, n, _) })).filter((_) => !!(_.pdf && _.where)), w = 16, v = typeof window > "u" ? 800 : window.innerHeight, R = Math.min(880, v * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), T = b.length ? zm(Math.max(120, (g - w * (b.length - 1) - 32) / b.length), R, b.map((_) => _.where.aspect)) : 0, P = ((C = b[0]) == null ? void 0 : C.where.page) ?? i.source.page;
  return /* @__PURE__ */ L("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${ko[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ L("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ L("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ L("span", { className: "reader-zoom-title", children: [
          ko[S] ?? "这一块",
          " · 第 ",
          P,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ L("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Zo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(ra, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((_) => Math.max(0, _ - 1)), children: /* @__PURE__ */ p(oa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ L(ie, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(rt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => f((_) => Math.min(rt.length - 1, _ + 1)), children: /* @__PURE__ */ p(aa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(At, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (_) => {
            const k = m.current;
            !k || _.button !== 0 || (I.current = { x: _.clientX, y: _.clientY, left: k.scrollLeft, top: k.scrollTop }, k.setPointerCapture(_.pointerId));
          },
          onPointerMove: (_) => {
            const k = m.current, E = I.current;
            !k || !E || (k.scrollLeft = E.left - (_.clientX - E.x), k.scrollTop = E.top - (_.clientY - E.y));
          },
          onPointerUp: () => {
            I.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: w }, children: b.map(({ pane: _, pdf: k, where: E }) => /* @__PURE__ */ L("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: _ === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Wa,
              {
                className: "reader-zoom-canvas",
                pdf: k,
                page: E.page,
                region: E.fraction,
                cssWidth: T * d,
                label: `${_ === "source" ? "原文" : "译文"}第 ${E.page} 页`
              }
            )
          ] }, _)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const jm = 380, Hm = 320, vt = 8;
function Um(e, t, n) {
  const r = Math.max(vt, Math.min(e.left, n.width - t.width - vt)), o = e.bottom + vt, a = o + t.height <= n.height - vt ? o : Math.max(vt, e.top - vt - t.height);
  return { left: r, top: a };
}
function Km({
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
    const m = r[d], g = m ? Om(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(jm, Hm / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = Um(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ L("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ L("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Io(e.target) }),
      /* @__PURE__ */ L("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Wa, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Io(e.target) })
  ] });
}
const Wm = 250;
function Vm(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function qm(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Jm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Gm({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = N(null), [s, i] = N({ back: [], forward: [] }), c = x(s);
  c.current = s;
  const l = x(null), u = x({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = A(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Ht(m, g);
  }, []);
  O(() => {
    if (!e) return;
    const m = (b) => {
      var w, v;
      return (v = (w = b.target) == null ? void 0 : w.closest) == null ? void 0 : v.call(w, `.${Ya}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var T;
      const w = m(b);
      if (!w) return;
      const v = u.current.index.get(w.getAttribute(Gn) || "");
      if (!v) return;
      const R = ((T = w.closest("[data-reader-pane]")) == null ? void 0 : T.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const P = w.getBoundingClientRect();
        a({ target: v, pane: R, anchor: { left: P.left, top: P.top, right: P.right, bottom: P.bottom } });
      }, Wm);
    }, y = (b) => {
      const w = m(b);
      !w || w.contains(b.relatedTarget) || (g(), a(null));
    }, I = (b) => {
      var P, C;
      const w = m(b);
      if (!w || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((P = window.getSelection) == null ? void 0 : P.call(window)) || ""}`.trim()) return;
      const v = u.current.index.get(w.getAttribute(Gn) || "");
      if (!v) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const R = ((C = w.closest("[data-reader-pane]")) == null ? void 0 : C.getAttribute("data-reader-pane")) || u.current.primaryPane, T = f();
      T && i((_) => Vm(_, T)), u.current.follow(v, R);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", I, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", I, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = A((m) => {
    const g = f();
    if (!g) return !1;
    const h = qm(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: I } = u.current;
    return Mt(y, h.to, "auto", I) ? (i(h.history), !0) : !1;
  }, [f]);
  return O(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Jm(g.target)) return;
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
const Xm = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Ym() {
  const e = en(), t = V(() => Am(e.regions), [e.regions]), { jumpToBlock: n } = e, r = A((s, i) => n(s.itemId, i), [n]), o = Gm({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = V(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => Cm(s, t) : void 0,
    shortcuts: Xm
  }), [t]);
  return kn(a), /* @__PURE__ */ L(Ae, { children: [
    o.preview ? /* @__PURE__ */ p(Km, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ L(ie, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(ii, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const Zm = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Ym }, hr = [wm, Tm, am, Zm, Xf];
function pr(e = hr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Qm(e) {
  const t = Ge(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Ae, { children: (e.tabs ?? pr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
function eh(e) {
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
        children: /* @__PURE__ */ p(At, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function th(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function nh(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function rh(e) {
  return e / 100 * window.innerHeight;
}
function oh(e) {
  return e / 100 * window.innerWidth;
}
function ah(e) {
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
  const [o, a] = ah(n);
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
      r = nh(t, o);
      break;
    }
    case "em": {
      r = th(t, o);
      break;
    }
    case "vh": {
      r = rh(o);
      break;
    }
    case "vw": {
      r = oh(o);
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
      s = Ne(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ne(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ne(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = jt({
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
function Zn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? sh : ih
  );
}
function sh(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function ih(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Za(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Qa(e, t) {
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
function ch({
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
    const { x: i, y: c } = Qa(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return pe(o, "No rect found"), o;
}
let an;
function lh() {
  return an === void 0 && (typeof matchMedia == "function" ? an = !!matchMedia("(pointer:coarse)").matches : an = !1), an;
}
function es(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Zn(
    n,
    Array.from(t.children).filter(Za).map((g) => ({ element: g }))
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
                  const R = m[0], T = ch({
                    orientation: n,
                    rects: [I, S],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  b = [
                    R,
                    T === I ? v : w
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
              const R = lh() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (v.width < R) {
                const P = R - v.width;
                v = new DOMRect(
                  v.x - P / 2,
                  v.y,
                  v.width + P,
                  v.height
                );
              }
              if (v.height < R) {
                const P = R - v.height;
                v = new DOMRect(
                  v.x,
                  v.y - P / 2,
                  v.width,
                  v.height + P
                );
              }
              const T = g <= l || g > u;
              !i && !T && s.push({
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
var at;
class ts {
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
const gr = new ts();
function mt() {
  return Et;
}
function uh(e) {
  return gr.addListener("change", e);
}
function dh(e) {
  const t = Et, n = { ...Et };
  n.cursorFlags = e, Et = n, gr.emit("change", {
    prev: t,
    next: n
  });
}
function Pt(e) {
  const t = Et;
  Et = e, gr.emit("change", {
    prev: t,
    next: e
  });
}
const fh = (e) => e, Cn = () => {
}, ns = 1, rs = 2, os = 4, as = 8, To = 3, Eo = 12;
let sn;
function Po() {
  return sn === void 0 && (sn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (sn = !0)), sn;
}
function mh({
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
          const a = (e & ns) !== 0, s = (e & rs) !== 0, i = (e & os) !== 0, c = (e & as) !== 0;
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
const Ro = /* @__PURE__ */ new WeakMap();
function br(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Ro.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = mt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = mh({
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
  Ro.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let qe = /* @__PURE__ */ new Map();
const ss = new ts();
function hh(e) {
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
  return ss.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function tt(e, t, n) {
  const r = qe.get(e);
  qe = new Map(qe), qe.set(e, t), ss.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function is(e) {
  const t = mt();
  let n = !1;
  switch (t.state) {
    case "active":
      Pt({
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
  e.defaultPrevented || is(e.currentTarget);
}
function ph(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Qa(n, a.rect);
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
function gh(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function bh(e, t) {
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
const yh = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function vh(e) {
  const t = getComputedStyle(cs(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function wh(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || vh(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || yh.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function No(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (pe(n, "Missing node"), wh(n)) return n;
  }
  return null;
}
function Ao(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function xo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = cs(e);
  return t;
}
function cs(e) {
  const { parentNode: t } = e;
  return gh(t) ? t.host : t;
}
function Sh(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Ih({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Za(n) || n.contains(e) || e.contains(n))
    return !0;
  if (bh(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Sh(r.getBoundingClientRect(), t))
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
    const a = es(o), s = ph(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Ih({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function kh(e, t) {
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
function Ve(e, t) {
  return Me(e, t) ? 0 : e > t ? 1 : -1;
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
  return r = Math.min(i, r), r = Ne(r), r;
}
function Jt({
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
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const w = i[h];
          if (pe(
            w != null,
            `Previous layout not found for panel index ${h}`
          ), Me(w, I)) {
            const v = b - w;
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
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const w = i[h];
          if (pe(
            w != null,
            `Previous layout not found for panel index ${h}`
          ), Me(w, b)) {
            const v = w - I;
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
      const I = i[h], { collapsible: S, collapsedSize: b, minSize: w } = y;
      if (S && Ve(I, w) < 0)
        if (e > 0) {
          const v = w - b, R = v / 2, T = I + e;
          Ve(T, w) < 0 && (e = Ve(e, R) <= 0 ? 0 : v);
        } else {
          const v = w - b, R = 100 - v / 2, T = I - e;
          Ve(T, w) < 0 && (e = Ve(100 + e, R) > 0 ? 0 : -v);
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
      const w = kt({
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
      pe(
        I != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = I - y, b = kt({
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
  if (kh(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    pe(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const I = y + d, S = kt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: I
    });
    if (l[h] = S, !Me(S, I)) {
      let b = I - S, w = e < 0 ? f : u;
      for (; w >= 0 && w < n.length; ) {
        const v = l[w];
        pe(
          v != null,
          `Previous layout not found for panel index ${w}`
        );
        const R = v + b, T = kt({
          overrideDisabledPanels: s,
          panelConstraints: n[w],
          prevSize: v,
          size: R
        });
        if (Me(v, T) || (b -= T - v, l[w] = T), Me(b, 0))
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
  if (!Me(o, 100) && r.length > 0)
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
  if (!Me(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      pe(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = kt({
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
function ls({
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
      return c && Me(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = _t({ group: l }), d = jt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ne(d / f * 100);
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
        const o = r.panelConstraints.defaultSize, a = ls({
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
function us({
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
  const s = a.map((u) => n.panels.indexOf(u)), i = us({ groupId: n.id }).getLayout(), c = Jt({
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
  }), Pt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function ds({
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
      separatorToPanels: R
    } = I;
    if (b && v && R) {
      const T = Jt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((P) => m.indexOf(P)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (ht(T, v)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? ns : rs;
              break;
            }
            case "vertical": {
              i |= h < 0 ? os : as;
              break;
            }
          }
      } else
        tt(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: w,
          layout: T,
          separatorToPanels: R
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & To : c |= i & To, t.movementY === 0 ? c |= s & Eo : c |= i & Eo, dh(c), br(e);
}
function $o(e) {
  const t = bt(), n = mt();
  switch (n.state) {
    case "active":
      ds({
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
        Pt({
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
      ds({
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
      a.length === 0 ? t.state !== "inactive" && Pt({
        cursorFlags: 0,
        state: "inactive"
      }) : Pt({
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
        Pt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Fo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || is(e.currentTarget) && e.preventDefault();
}
function Bo(e) {
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
function Th(e, t, n) {
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
function Eh(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Ph({
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
function Rh(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const wt = /* @__PURE__ */ new Map();
function Mh(e) {
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
          const S = _t({ group: e });
          if (S === 0)
            return;
          const b = it(e.id);
          if (!b)
            return;
          const w = Yn(e), v = b.defaultLayoutDeferred ? Bo(w) : b.layout, R = Ph({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: v
          }), T = pt({
            layout: R,
            panelConstraints: w
          });
          if (!b.defaultLayoutDeferred && ht(b.layout, T) && Eh(
            b.derivedPanelConstraints,
            w
          ) && b.groupSize === S)
            return;
          tt(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: w,
            groupSize: S,
            layout: T,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        Th(e, I, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    pe(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = _t({ group: e }), i = Yn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Rh(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? Bo(i), f = pt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  wt.set(
    d,
    (wt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return es(e).forEach((g) => {
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
    ), hh(e), e.separators.forEach((g) => {
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
function _h() {
  const [e, t] = N({}), n = A(() => t({}), []);
  return [e, n];
}
function wr(e) {
  const t = Xo();
  return `${e ?? t}`;
}
const yt = typeof window < "u" ? xe : O;
function Ut(e) {
  const t = x(e);
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
  const t = x({ ...e });
  return yt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const fs = Zt(null);
function Nh(e, t) {
  const n = x({
    getLayout: () => ({}),
    setLayout: fh
  });
  rr(t, () => n.current, []), yt(() => {
    Object.assign(
      n.current,
      us({ groupId: e })
    );
  });
}
function ms({
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
  const g = x({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Ut((k) => {
    ht(g.current.onLayoutChange, k) || (g.current.onLayoutChange = k, c == null || c(k));
  }), y = Ut(
    (k, E) => {
      ht(g.current.onLayoutChanged, k) || (g.current.onLayoutChanged = k, l == null || l(k, { isUserInteraction: E }));
    }
  ), I = wr(i), S = x(null), [b, w] = _h(), v = x({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), R = Sr(S, a);
  Nh(I, s);
  const T = Ut(
    (k, E) => {
      const M = mt(), D = Mo(k), $ = it(k);
      if ($) {
        let K = !1;
        switch (M.state) {
          case "active": {
            K = M.hitRegions.some(
              (H) => H.group === D
            );
            break;
          }
        }
        return {
          flexGrow: $.layout[E] ?? 1,
          pointerEvents: K ? "none" : void 0
        };
      }
      if (n != null && n[E])
        return {
          flexGrow: n == null ? void 0 : n[E]
        };
    }
  ), P = Ir({
    defaultLayout: n,
    disableCursor: r
  }), C = V(
    () => ({
      get disableCursor() {
        return !!P.disableCursor;
      },
      getPanelStyles: T,
      id: I,
      orientation: u,
      registerPanel: (k) => {
        const E = v.current;
        return E.panels = Zn(u, [
          ...E.panels,
          k
        ]), w(), () => {
          E.panels = E.panels.filter(
            (M) => M !== k
          ), w();
        };
      },
      registerSeparator: (k) => {
        const E = v.current;
        return E.separators = Zn(u, [
          ...E.separators,
          k
        ]), w(), () => {
          E.separators = E.separators.filter(
            (M) => M !== k
          ), w();
        };
      },
      updatePanelProps: (k, { disabled: E }) => {
        const M = v.current.panels.find(
          (K) => K.id === k
        );
        M && (M.panelConstraints.disabled = E);
        const D = Mo(I), $ = it(I);
        D && $ && tt(D, {
          ...$,
          derivedPanelConstraints: Yn(D)
        });
      },
      updateSeparatorProps: (k, {
        disabled: E,
        disableDoubleClick: M
      }) => {
        const D = v.current.separators.find(
          ($) => $.id === k
        );
        D && (D.disabled = E, D.disableDoubleClick = M);
      }
    }),
    [T, I, w, u, P]
  ), _ = x(null);
  return yt(() => {
    const k = S.current;
    if (k === null)
      return;
    const E = v.current;
    let M;
    if (P.defaultLayout !== void 0 && Object.keys(P.defaultLayout).length === E.panels.length) {
      M = {};
      for (const Q of E.panels) {
        const ce = P.defaultLayout[Q.id];
        ce !== void 0 && (M[Q.id] = ce);
      }
    }
    const D = {
      disabled: !!o,
      element: k,
      id: I,
      mutableState: {
        defaultLayout: M,
        disableCursor: !!P.disableCursor,
        expandedPanelSizes: v.current.lastExpandedPanelSizes,
        layouts: v.current.layouts
      },
      orientation: u,
      panels: E.panels,
      resizeTargetMinimumSize: E.resizeTargetMinimumSize,
      separators: E.separators
    };
    _.current = D;
    const $ = Mh(D), { defaultLayoutDeferred: K, derivedPanelConstraints: H, layout: J } = it(D.id, !0);
    !K && H.length > 0 && (h(J), y(J, !1));
    const ue = yr(I, (Q) => {
      const { defaultLayoutDeferred: ce, derivedPanelConstraints: Se, layout: Y } = Q.next;
      if (ce || Se.length === 0)
        return;
      const de = D.panels.map(({ id: ae }) => ae).join(",");
      D.mutableState.layouts[de] = Y, Se.forEach((ae) => {
        if (ae.collapsible) {
          const { layout: fe } = Q.prev ?? {};
          if (fe) {
            const F = Me(
              ae.collapsedSize,
              Y[ae.panelId]
            ), U = Me(
              ae.collapsedSize,
              fe[ae.panelId]
            );
            F && !U && (D.mutableState.expandedPanelSizes[ae.panelId] = fe[ae.panelId]);
          }
        }
      });
      const Le = mt().state !== "active";
      h(Y), Le && y(Y, Q.isUserInteraction);
    });
    return () => {
      _.current = null, $(), ue();
    };
  }, [
    o,
    I,
    y,
    h,
    u,
    b,
    P
  ]), O(() => {
    const k = _.current;
    k && (k.mutableState.defaultLayout = n, k.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(fs.Provider, { value: C, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": I,
      id: I,
      ref: R,
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
ms.displayName = "Group";
function kr() {
  const e = dt(fs);
  return pe(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Ah(e, t) {
  const { id: n } = kr(), r = x({
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
      ls({ groupId: n, panelId: e })
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
  const h = !!c, y = wr(c), I = Ir({
    disabled: a
  }), S = x(null), b = Sr(S, s), {
    getPanelStyles: w,
    id: v,
    orientation: R,
    registerPanel: T,
    updatePanelProps: P
  } = kr(), C = f !== null, _ = Ut(
    (D, $, K) => {
      f == null || f(D, c, K);
    }
  );
  yt(() => {
    const D = S.current;
    if (D !== null) {
      const $ = {
        element: D,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: C ? _ : void 0,
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
      return T($);
    }
  }, [
    i,
    n,
    r,
    o,
    C,
    y,
    h,
    l,
    u,
    _,
    T,
    I
  ]), O(() => {
    P(y, { disabled: a });
  }, [a, y, P]), Ah(y, d);
  const k = () => {
    const D = w(v, y);
    if (D)
      return JSON.stringify(D);
  }, E = vn(
    (D) => yr(v, D),
    k,
    k
  );
  let M;
  return E ? M = JSON.parse(E) : o !== void 0 ? M = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : M = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...xh,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...M
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
            touchAction: R === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Qn.displayName = "Panel";
const xh = {
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
function Lh({
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
function hs({
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
  }), [u, f] = N({}), [d, m] = N("inactive"), [g, h] = N(!1), y = x(null), I = Sr(y, o), {
    disableCursor: S,
    id: b,
    orientation: w,
    registerSeparator: v,
    updateSeparatorProps: R
  } = kr(), T = w === "horizontal" ? "vertical" : "horizontal";
  yt(() => {
    const _ = y.current;
    if (_ !== null) {
      const k = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: _,
        id: c
      }, E = v(k), M = uh(
        ($) => {
          m(
            $.next.state !== "inactive" && $.next.hitRegions.some(
              (K) => K.separator === k
            ) ? $.next.state : "inactive"
          );
        }
      ), D = yr(
        b,
        ($) => {
          const { derivedPanelConstraints: K, layout: H, separatorToPanels: J } = $.next, ue = J.get(k);
          if (ue) {
            const Q = ue[0], ce = ue.indexOf(Q);
            f(
              Lh({
                layout: H,
                panelConstraints: K,
                panelId: Q.id,
                panelIndex: ce
              })
            );
          }
        }
      );
      return () => {
        M(), D(), E();
      };
    }
  }, [b, c, v, l]), O(() => {
    R(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, R]);
  let P;
  n && !S && (P = "not-allowed");
  let C;
  if (n)
    C = "disabled";
  else
    switch (d) {
      case "active": {
        C = "active";
        break;
      }
      default:
        g ? C = "focus" : C = d;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": T,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": C,
      "data-testid": c,
      id: c,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: I,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: P,
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
hs.displayName = "Separator";
const Tr = 30, Er = 65, Gt = 50, Ch = 100 - Er, Dh = 100 - Tr;
function $h(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Er, Math.max(Tr, t)) : Gt;
}
function Pr(e) {
  return 100 - e;
}
function St(e) {
  return `${e}%`;
}
const Rr = "reader-document", Xt = "reader-assistant", ps = "retainpdf.reader.ai-split-layout.v1", Oh = {
  [Rr]: Pr(Gt),
  [Xt]: Gt
};
function Mr(e) {
  const t = $h(e == null ? void 0 : e[Xt]);
  return {
    [Rr]: Pr(t),
    [Xt]: t
  };
}
function zh() {
  try {
    const e = JSON.parse(localStorage.getItem(ps) || "null");
    return Mr(e);
  } catch {
    return Oh;
  }
}
function Fh(e) {
  try {
    localStorage.setItem(ps, JSON.stringify(Mr(e)));
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
function Bh() {
  const e = x(null), [t] = N(zh);
  xe(() => {
    const o = e.current;
    return Dn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = A((o) => {
    Dn(e.current, o);
  }, []), r = A((o, a) => {
    Dn(e.current, o), a.isUserInteraction && Fh(o);
  }, []);
  return /* @__PURE__ */ L(
    ms,
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
            id: Rr,
            defaultSize: St(Pr(Gt)),
            minSize: St(Ch),
            maxSize: St(Dh)
          }
        ),
        /* @__PURE__ */ p(
          hs,
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
            minSize: St(Tr),
            maxSize: St(Er)
          }
        )
      ]
    }
  );
}
function jh({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = N(!1);
  if (O(() => {
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
    n ? /* @__PURE__ */ p(ie, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function Hh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(jh, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(Ae, { children: [
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
      s ? /* @__PURE__ */ p(ie, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Uh(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Kh() {
  const [e, t] = N(!1), n = Xo(), r = x(null), o = Ha(), a = V(() => [...zl, ...df(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Uh(i.target)) return;
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
        children: /* @__PURE__ */ p(ci, { ...Ee, "aria-hidden": !0 })
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
const Wh = ["source", "sideBySide", "translated"], Vh = { source: "", translated: "", sideBySide: "" };
function qh(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = ln(e.sourceUrl), n = ln(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return _i({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Jh(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = V(
    () => e ? qh(e) : Vh,
    [e]
  ), o = V(
    () => Wh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = A(async (s) => {
    if (!e) return;
    const i = ln(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Mi(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Ni(
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
        Ai(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Gh = {
  source: ea,
  sideBySide: ta,
  translated: na
}, Xh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Yh(e) {
  const t = Ge(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Jh(n), i = x(null);
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
  }, []), /* @__PURE__ */ L("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ L("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(li, { ...Ee, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = _s[c], u = ln(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : Ns(c, r), g = Gh[c];
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
            /* @__PURE__ */ p(g, { ...Ee, "aria-hidden": !0 }),
            /* @__PURE__ */ L("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ L("span", { className: "reader-download-action-label", children: [
                Xh[c],
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
const Zh = "retainpdf:reader:bookmarks:v1:", Qh = 200;
function _r() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function gs(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Zh}${t}` : "";
}
function ep(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Kt(e, t = _r()) {
  const n = gs(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = ep(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const er = /* @__PURE__ */ new Set();
function tp(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return er.add(n), () => {
    er.delete(n);
  };
}
function tr(e, t, n) {
  const r = gs(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Qh);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...er]) a(e);
  return o;
}
function np(e, t, n = "", { storage: r = _r(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Kt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? tr(e, a.filter((i) => i.page !== s), r) : tr(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function rp(e, t, n = _r()) {
  return tr(e, Kt(e, n).filter((r) => r.page !== t), n);
}
function op(e, t) {
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
function bs(e, t) {
  const [n, r] = N(() => Kt(e));
  O(() => (r(Kt(e)), tp(e, () => r(Kt(e)))), [e]);
  const o = A((s) => {
    r(np(e, s, op(t, s)));
  }, [e, t]), a = A((s) => r(rp(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
function ap({ filled: e }) {
  return /* @__PURE__ */ p(ui, { ...Ee, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function sp({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = bs(e, r);
  if (!e || n <= 0) return null;
  const s = Math.min(Math.max(t, 1), n), i = o.some((c) => c.page === s);
  return /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-mark${i ? " is-marked" : ""}`,
        "aria-pressed": i,
        "aria-label": i ? `取消第 ${s} 页的书签` : `给第 ${s} 页加书签`,
        title: i ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）",
        onClick: () => a(s),
        children: /* @__PURE__ */ p(ap, { filled: i })
      }
    ),
    /* @__PURE__ */ p(ip, {})
  ] });
}
function ip() {
  const [e, t] = N(!1), n = x(null);
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
  }, [e]), /* @__PURE__ */ L("span", { className: "reader-favorites", ref: n, children: [
    /* @__PURE__ */ p(
      ie,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": e,
        "aria-haspopup": "dialog",
        "aria-label": "收藏",
        title: "收藏（还在做）",
        onClick: () => t((r) => !r),
        children: /* @__PURE__ */ p(di, { ...Ee, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ L("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ p("strong", { children: "收藏" }),
      /* @__PURE__ */ p("p", { children: "还在做：以后可以把喜欢的段落、整页收在这里，按书分好，随时翻回来。现在先用「书签」记页。" })
    ] }) : null
  ] });
}
function cp(e) {
  const t = Ge(), n = dr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Qt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = yc(a), f = a > ma + 1e-3, d = a < gn - 1e-3, m = It(r, Tt()), g = m >= gn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, y] = N(!1), [I, S] = N(`${i}`);
  O(() => {
    h || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const w = Number(`${I}`.trim());
    l(bn(w, c));
  };
  return /* @__PURE__ */ L("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ L("div", { className: "reader-bottombar-start", children: [
      e.bookmarkScope ? /* @__PURE__ */ p(
        sp,
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
            !l || c <= 0 || (S(`${i}`), y(!0));
          },
          children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
        }
      ) }),
      e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
      t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
        ie,
        {
          className: "reader-react-hud-btn reader-react-hud-doc-dark",
          "aria-pressed": t.docDark ? "true" : "false",
          "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
          title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
          onClick: t.toggleDocDark,
          children: /* @__PURE__ */ p(fi, { ...Ee, "aria-hidden": !0 })
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
            onClick: () => s(qt(a, -1)),
            children: /* @__PURE__ */ p(oa, { ...Ee, "aria-hidden": !0 })
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
            onClick: () => s(qt(a, 1)),
            children: /* @__PURE__ */ p(aa, { ...Ee, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ L("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Kh, {}) })
    ] })
  ] });
}
function jo(e) {
  var t, n;
  return ya(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function lp(e) {
  const [t, n] = N(() => ({
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
  const r = A((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const nr = "download-toast";
function up({
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
function dp(e = {}) {
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
    () => /* @__PURE__ */ p(up, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: nr, duration: 1 / 0 }
  );
}
function fp() {
  const e = A((t) => {
    t && (t.setState = dp, t.hide = () => zn.dismiss(nr));
  }, []);
  return /* @__PURE__ */ L(Ae, { children: [
    /* @__PURE__ */ p(js, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Ho = { itemId: null, origin: null };
function mp() {
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
function hp(e) {
  const t = (n) => {
    const r = Uo.indexOf(n.id);
    return r < 0 ? Uo.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function $n({
  place: e,
  active: t = null,
  extensions: n = hr
}) {
  const r = e === "top" ? hp(n) : n, [o, a] = N(null), s = Ha(), i = (d) => {
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
  })(), u = x(null);
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
    const m = i(d.id), g = e === "top" ? pr([d]) : [];
    return !m.length && !g.length ? null : /* @__PURE__ */ L(yn, { children: [
      m.map((h) => {
        const y = `${d.id}:${h.key}`, I = h.Icon;
        return /* @__PURE__ */ L("span", { className: "reader-bar-tool-group", "data-has-dropdown": h.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ p(
            ie,
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
              children: e === "compare" ? /* @__PURE__ */ p(dn, { ...Gr, "aria-hidden": !0 }) : h.mark ?? /* @__PURE__ */ p(I, { ...Ee, "aria-hidden": !0 })
            }
          ),
          h.dropdown ? /* @__PURE__ */ p(
            ie,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${h.label}：选项`,
              title: `${h.label}的选项`,
              "aria-expanded": o === `${y}:dropdown`,
              "data-bar-tool-caret": h.key,
              onClick: () => a((S) => S === `${y}:dropdown` ? null : `${y}:dropdown`),
              children: /* @__PURE__ */ p(dn, { ...Gr, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(Qm, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ L("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "top" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const Ko = { search: "搜索", bookmarks: "书签", issues: "待改" }, pp = [];
function gp({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ L(ie, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(sa, { ...Ee, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function bp({
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
  var T;
  const d = ((T = Ge()) == null ? void 0 : T.regions) ?? pp, m = V(() => mu(d, s), [d, s]), [g, h] = N(-1);
  O(() => h(-1), [s]);
  const y = x(null), I = x(null), S = x(n);
  S.current = n, O(() => {
    if (c) return;
    const P = (_) => {
      var E, M;
      const k = _.target;
      !k || (E = I.current) != null && E.contains(k) || (M = k.closest) != null && M.call(k, ".reader-finder-toggles, [data-finder-toggle]") || S.current();
    }, C = (_) => {
      _.key === "Escape" && S.current();
    };
    return document.addEventListener("pointerdown", P, !0), document.addEventListener("keydown", C), () => {
      document.removeEventListener("pointerdown", P, !0), document.removeEventListener("keydown", C);
    };
  }, [c]);
  const b = x(null);
  O(() => {
    var P;
    e === "search" && ((P = y.current) == null || P.focus());
  }, [e, i]), O(() => {
    var P, C, _;
    e === "search" && g >= 0 && ((_ = (C = (P = b.current) == null ? void 0 : P.querySelector('[aria-current="true"]')) == null ? void 0 : C.scrollIntoView) == null || _.call(C, { block: "nearest" }));
  }, [e, g]);
  const w = (P) => {
    const C = m[P];
    C && (h(P), r(C.itemId));
  }, v = ["search", ...l ? ["bookmarks"] : [], ...u ? ["issues"] : []], R = v.includes(e) ? e : "search";
  return /* @__PURE__ */ L("aside", { ref: I, className: "reader-finder", "data-finder-tab": R, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${Ko[R]}`, children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: v.map((P) => /* @__PURE__ */ L(ie, { className: "reader-finder-tab", role: "tab", "aria-selected": R === P, onClick: () => t(P), children: [
        Ko[P],
        P === "issues" && f ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, P)) }),
      /* @__PURE__ */ p(ie, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(At, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    R === "bookmarks" ? l : R === "issues" ? u : null,
    R !== "search" ? null : /* @__PURE__ */ L(Ae, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
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
            onChange: (P) => a(P.target.value),
            onKeyDown: (P) => {
              P.key === "Enter" ? (P.preventDefault(), w(hu(g, m.length, P.shiftKey))) : P.key === "Escape" && (P.preventDefault(), c ? P.currentTarget.blur() : n()), P.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: m.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${m.length >= 200 ? "200+ 处，只列前 200 处" : `${m.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { ref: b, className: "reader-finder-list", children: m.map((P, C) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(ie, { className: "reader-finder-entry is-hit", "aria-current": C === g ? "true" : void 0, onClick: () => w(C), children: [
        /* @__PURE__ */ L("span", { className: "reader-finder-entry-text", children: [
          P.snippet.slice(0, P.at),
          /* @__PURE__ */ p("mark", { children: P.snippet.slice(P.at, P.at + P.length) }),
          P.snippet.slice(P.at + P.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: P.page })
      ] }) }, P.itemId)) })
    ] })
  ] });
}
function ys(e, t = []) {
  for (const n of e)
    t.push(n), ys(n.children, t);
  return t;
}
const yp = 24, Ot = 28, Wo = 15;
function vs(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function vp(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: ys(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function wp(e, t) {
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
function Sp(e, t) {
  const n = vs(e) > yp, r = Math.max(1, Math.ceil(e.length / Ot)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= Ot) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(Ot / 2)), o.length - Ot);
  return o.slice(s, s + Ot);
}
function Ip(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const kp = [];
function Tp({ bookmarks: e, onJumpPage: t, onJumpBlock: n }) {
  var v, R;
  const r = ((v = Ge()) == null ? void 0 : v.regions) ?? kp, o = ((R = dr()) == null ? void 0 : R.currentPage) ?? 1, a = V(() => vp(e, uu(r)), [e, r]), s = V(() => wp(a, o), [a, o]), i = V(() => Sp(a, s), [a, s]), c = vs(a), [l, u] = N(""), f = V(() => Ip(a, l), [a, l]), [d, m] = N(() => /* @__PURE__ */ new Set()), g = x(null), h = x(!1), y = () => {
    s.chapterId && !d.has(s.chapterId) && m((T) => new Set(T).add(s.chapterId)), h.current = !0;
  };
  if (xe(() => {
    var T, P, C;
    h.current && (h.current = !1, (C = (P = (T = g.current) == null ? void 0 : T.querySelector('[aria-current="location"]')) == null ? void 0 : P.scrollIntoView) == null || C.call(P, { block: "center" }));
  }), !a.length) return null;
  const I = (T) => m((P) => {
    const C = new Set(P);
    return C.has(T) ? C.delete(T) : C.add(T), C;
  }), S = (T, P) => {
    m((C) => C.has(P) ? C : new Set(C).add(P)), T.itemId ? n(T.itemId) : T.page !== null && t(T.page);
  }, b = !!l.trim(), w = (T, P) => /* @__PURE__ */ L(
    ie,
    {
      className: "reader-toc-entry",
      "data-depth": Math.min(T.depth, 3),
      "aria-current": T.id === s.nodeId ? "location" : void 0,
      disabled: !T.itemId && T.page === null,
      title: T.page === null ? "这条书签没有指到页" : `${T.title}（第 ${T.page} 页）`,
      onClick: () => S(T, P),
      children: [
        /* @__PURE__ */ p("span", { className: "reader-toc-title", children: T.title }),
        T.page !== null ? /* @__PURE__ */ L("span", { className: "reader-toc-page", children: [
          "p.",
          T.page
        ] }) : null
      ]
    }
  );
  return /* @__PURE__ */ L(
    "nav",
    {
      className: "reader-toc-minimap",
      "aria-label": "目录",
      onPointerEnter: y,
      onFocus: (T) => {
        T.currentTarget.contains(T.relatedTarget) || y();
      },
      children: [
        /* @__PURE__ */ p("div", { className: "reader-toc-bars", tabIndex: 0, "aria-label": `目录，${c} 条（移上去或按 Tab 展开）`, children: i.map((T) => /* @__PURE__ */ p("span", { className: "reader-toc-bar", "data-kind": T.kind, "data-state": T.state || void 0, "aria-hidden": !0 }, T.id)) }),
        /* @__PURE__ */ L("div", { className: "reader-toc-card", "data-compact": c <= Wo ? "true" : void 0, children: [
          c > Wo ? /* @__PURE__ */ L("div", { className: "reader-toc-filter", children: [
            /* @__PURE__ */ p(sa, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ p(
              or,
              {
                size: "sm",
                className: "reader-toc-filter-input",
                value: l,
                placeholder: "过滤章节标题或节号…",
                "aria-label": "过滤目录",
                onChange: (T) => u(T.target.value),
                onKeyDown: (T) => {
                  T.stopPropagation(), T.key === "Escape" && (l ? u("") : T.currentTarget.blur());
                }
              }
            ),
            l ? /* @__PURE__ */ p(ie, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => u(""), children: /* @__PURE__ */ p(At, { size: 12, "aria-hidden": !0 }) }) : null
          ] }) : null,
          /* @__PURE__ */ p("div", { className: "reader-toc-list", ref: g, children: f.length ? f.map((T) => {
            const P = b || d.has(T.id);
            return /* @__PURE__ */ L("div", { className: "reader-toc-chapter", children: [
              /* @__PURE__ */ L("div", { className: "reader-toc-chapter-row", children: [
                T.children.length ? /* @__PURE__ */ p(
                  ie,
                  {
                    className: "reader-toc-caret",
                    "aria-expanded": P,
                    "aria-label": `${P ? "收起" : "展开"}「${T.title}」`,
                    onClick: () => I(T.id),
                    children: P ? /* @__PURE__ */ p(dn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(ra, { size: 12, "aria-hidden": !0 })
                  }
                ) : /* @__PURE__ */ p("span", { className: "reader-toc-caret-space" }),
                w(T, T.id)
              ] }),
              P ? T.children.map((C) => /* @__PURE__ */ p("div", { children: w(C, T.id) }, C.id)) : null
            ] }, T.id);
          }) : /* @__PURE__ */ p("p", { className: "reader-toc-empty", children: "没有匹配的章节" }) })
        ] })
      ]
    }
  );
}
function Ep(e) {
  const [t, n] = N([]);
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
  const r = Ep(e), [o, a] = N(-1);
  O(() => a(-1), [r]);
  const s = A((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = x({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, O(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || _p(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = Pp(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function Ap(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function xp(e) {
  var r;
  if (e.shiftKey || Ap(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${da}`))) return null;
  const n = Number((r = t.closest(`[${Pe}]`)) == null ? void 0 : r.getAttribute(Pe)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Lp({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = x(null);
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
  return /* @__PURE__ */ L("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ L(
      ie,
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
function Cp({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ L("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      ie,
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
const ws = "retainpdf:reader:doc-theme:v1", Vo = "data-reader-doc";
function Ss() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Dp(e = Ss()) {
  try {
    return (e == null ? void 0 : e.getItem(ws)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function $p(e, t = Ss()) {
  try {
    t == null || t.setItem(ws, e);
  } catch {
  }
}
function qo(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Vo, "dark") : t.removeAttribute(Vo));
}
function Op() {
  const [e, t] = N(() => Dp());
  O(() => {
    qo(e);
  }, [e]), O(() => () => qo("light"), []);
  const n = A(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return $p(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function zp({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = bs(e, t);
  return a.length ? /* @__PURE__ */ p("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ L("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ L(
      ie,
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
    /* @__PURE__ */ p(ie, { className: "reader-bookmark-remove", "aria-label": `删除第 ${i.page} 页的书签`, title: "删除这个书签", onClick: () => s(i.page), children: "×" })
  ] }, i.page)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: "还没有书签。底栏的书签按钮给眼下这一页加一个。" });
}
function Fp({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ L("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    Mp.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ L("h4", { children: [
          Rp[o],
          /* @__PURE__ */ p("span", { children: a.length })
        ] }),
        /* @__PURE__ */ p("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(ie, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
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
function Bp({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: f } = e, d = Ge(), m = dr(), g = (m == null ? void 0 : m.currentPage) ?? 1, h = n.issues.length;
  return /* @__PURE__ */ p(Ae, { children: r ? /* @__PURE__ */ p(
    bp,
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
        zp,
        {
          scope: t,
          regions: d == null ? void 0 : d.regions,
          currentPage: g,
          numPages: (m == null ? void 0 : m.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: h ? /* @__PURE__ */ p(Fp, { nav: n }) : void 0,
      issueCount: h
    }
  ) : null });
}
function jp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(Ae, { children: n ? /* @__PURE__ */ p(
    Bm,
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
function Hp(e) {
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
const Up = 720;
function Kp(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Up;
}
function Wp(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Vp(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = N(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Hp({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = kl({
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
  const f = x(null);
  return O(() => {
    f.current !== e.viewStateKey && Pl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function qp(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = Tl(e.liveTranslation), i = A(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = N(null);
  O(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && Rl({
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
function Jp() {
  const [e] = N(nf), t = hf(e), n = lf(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function Gp(e, t, n) {
  const r = x(e);
  O(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function Xp(e, t, {
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
  const { session: m, panes: g } = e, h = x(e.currentPage);
  h.current = e.currentPage;
  const y = A(() => h.current, []), I = V(() => ({
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
  ]), { contributionStore: S, contributions: b, reserveRight: w } = t, v = V(() => of(b), [b]), R = V(() => uf(b), [b]), T = V(() => cf(b), [b]), P = V(() => af(b), [b]), C = sf(b);
  return { readerApi: I, contributionStore: S, contributions: b, pageLayers: v, compareVersion: R, textMarks: T, menuSections: P, pointerTakenId: C, reserveRight: w };
}
function Yp() {
  try {
    return nt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Zp = "这本书正在处理（翻译或排版），处理完才能改。", Qp = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function eg({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Yp(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = bu(s), l = !t || Wt(t), u = ku(n), [f, d] = N(""), [m, g] = N(null), [h, y] = N(() => /* @__PURE__ */ new Map()), [I, S] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, w] = N(() => /* @__PURE__ */ new Map()), [v, R] = N({ phase: "idle" }), T = x({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  O(() => {
    g(null), T.drafts.clear(), T.generation.current = null, w(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), O(() => {
    if (d(""), !i || c || !a) return;
    let $ = !1;
    return a.resolveOwnerJobId(s).then((K) => {
      $ || d(`${K || s}`.trim() || s);
    }).catch(() => {
      $ || d(s);
    }), () => {
      $ = !0;
    };
  }, [i, c, a, s]), O(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let $ = !1;
    return a.fetchRevisions(f).then((K) => {
      $ || y(Tu(K, u));
    }).catch(() => {
    }), () => {
      $ = !0;
    };
  }, [a, f, u, l]);
  const P = v.phase === "running" && v.seenActive;
  O(() => {
    if (v.phase === "running") {
      if (!l) {
        P || R({ phase: "running", seenActive: !0 });
        return;
      }
      P && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [v.phase, P, l, t]);
  const C = V(() => {
    const $ = new Map(h);
    if (I.renderedAt === u)
      for (const [K, H] of I.edits) $.set(K, H);
    return $;
  }, [h, I, u]), _ = A(($) => {
    const K = `${$ || ""}`.trim();
    K && g({ itemId: K, page: yu(K) });
  }, []), k = A(() => g(null), []), E = A(($, K) => {
    S((H) => {
      const J = new Map(H.renderedAt === u ? H.edits : []);
      return J.set($, K), { renderedAt: u, edits: J };
    }), w((H) => new Map(H).set($, (H.get($) || 0) + 1));
  }, [u]), M = A(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch ($) {
        R({ phase: "failed", message: ($ == null ? void 0 : $.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), D = c ? Qp : !l || v.phase === "running" || v.phase === "submitting" ? Zp : "";
  return V(() => ({
    available: i,
    blockedReason: D,
    port: a,
    ownerJobId: f,
    target: m,
    select: _,
    close: k,
    memory: T,
    pendingEdits: C,
    savedCounts: b,
    markSaved: E,
    rerender: v,
    startRerender: M
  }), [i, D, a, f, m, _, k, T, C, b, E, v, M]);
}
function tg(e, t) {
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
function ng(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = eg({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = A((d, m) => {
    Na(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  tg(a.available ? u : null, n);
  const f = V(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const rg = "reader-finder-input";
function og(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function ag(e, t = typeof window > "u" ? null : window) {
  O(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!og(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(rg) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const Is = "retainpdf.reader.sidebar.v1", sg = ["search", "bookmarks", "issues"], ig = 900;
function cg() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(Is)) || "{}");
    return { tab: sg.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function lg(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(Is, JSON.stringify(e));
  } catch {
  }
}
function ug() {
  const e = `(min-width: ${ig}px)`, [t, n] = N(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
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
function dg(e) {
  const [t] = N(cg), [n, r] = N(null), [o, a] = N(t.tab), i = ug(), c = A((v) => {
    r(v), v && a(v);
  }, []);
  O(() => {
    lg({ tab: n || o });
  }, [n, o]);
  const l = A(() => r((v) => v ? null : o), [o]), u = A((v) => {
    r((R) => R === v ? null : v), a(v);
  }, []), [f, d] = N(""), [m, g] = N("");
  O(() => {
    const v = f.replace(/\s+/gu, " ").trim(), R = window.setTimeout(() => g(v), v ? 150 : 0);
    return () => window.clearTimeout(R);
  }, [f]);
  const [h, y] = N(0), I = A(() => {
    c("search"), y((v) => v + 1);
  }, [c]);
  ag(I);
  const S = A(() => {
    i || r(null);
  }, [i]), b = A((v) => {
    e.jumpToAnchor({ block_id: v }), S();
  }, [e.jumpToAnchor, S]), w = A((v) => {
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
function fg(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : pa(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function mg(e, t) {
  return t === null || e !== t;
}
function hg(e, t) {
  const { boot: n } = e, r = x(null), o = x(null);
  O(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Je(e.viewStateKey), s = fg({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Tt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      mg(e.mode, o.current) && (o.current = null, Sn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const pg = [];
function gg(e) {
  const { sessionFiles: t } = e, [n, r] = N({}), o = x({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = A((y, I) => {
    r((S) => ({ ...S, [I]: { url: o.current[I], nodes: y } }));
  }, []), s = V(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const I = n.translated;
    return I && I.url === t.translatedUrl && I.nodes.length ? I.nodes : pg;
  }, [n, t.sourceUrl, t.translatedUrl]), i = x({}), [c, l] = N(0), u = A((y, I) => {
    i.current[I] = { url: o.current[I], pdf: y }, l((S) => S + 1);
  }, []), [f, d] = N(null), m = A((y) => d(y), []), g = A(() => d(null), []);
  O(() => d(null), [e.viewStateKey]);
  const h = V(() => {
    const y = (I, S) => {
      const b = i.current[I];
      return b && b.url === S ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
function bg() {
  const e = $l(), { boot: t, panes: n, session: r } = e, o = lp(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = Jp(), { reserveRight: l } = c, u = i || l > 0, f = dg(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, h = A(() => {
    s(null);
  }, []);
  Gp(l, a, h);
  const { liveTranslationVisible: y, setLiveTranslationVisible: I, paneComposition: S, liveToggles: b, sourceViewOnly: w, visiblePdfMode: v } = Vp(
    e,
    i,
    Kp(e.shell.shellWidth, u || g)
  );
  hg(e, w);
  const R = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: T, toggleDocDark: P } = Op();
  Ul({
    toggleDocDark: P,
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
  const { latestLivePage: C, jumpToLatestLivePage: _, offerCompletion: k, setCompletionDismissedKey: E, sourcePaneAction: M } = qp(e, {
    liveTranslationVisible: y,
    setLiveTranslationVisible: I,
    liveToggles: b,
    sourceViewOnly: w,
    visiblePdfMode: v
  }), D = A((W) => {
    const ee = Wp(W, e.liveTranslationAvailable);
    ee !== null && I(ee), e.setModeKeepingPage(W);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), $ = A((W) => {
    s(W);
  }, []), [K] = N(mp), H = A((W) => e.jumpToAnchor({ block_id: W }), [e.jumpToAnchor]), J = Np(e.sourceOnly ? "" : r.jobId, e.currentPage, H), [ue, Q] = N(null), ce = A((W, ee) => e.jumpToAnchor({ block_id: W }, ee), [e.jumpToAnchor]), { bookmarks: Se, onPdfOutline: Y, onPdfDocument: de, zoomItem: Le, setZoomItem: ae, zoomBlock: fe, closeZoom: F, zoomDocuments: U } = gg(e), { blockEdit: q, editBlock: oe, revisedBlocks: re } = ng(e, v, K), [me, Ie] = N(null), se = A(() => Ie(null), []), Z = em({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: ge,
    contributionStore: B,
    contributions: ne,
    pageLayers: he,
    compareVersion: Ce,
    textMarks: _e,
    menuSections: Re,
    pointerTakenId: Fe
  } = Xp(e, c, {
    translationVersions: Z,
    bookmarks: Se,
    regionHover: K,
    assistantPanel: a,
    closeAssistant: h,
    visiblePdfMode: v,
    changeWorkspace: D,
    jumpToBlockIn: ce,
    zoomDocuments: U,
    editBlock: q.available && !q.blockedReason ? oe : null,
    panelHost: ue
  }), Oe = !!Fe, [De, We] = N([]), ze = V(() => ({
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
    regionHover: K,
    jumpToBlock: H,
    revisedBlocks: re,
    onPdfOutline: Y,
    onPdfDocument: de,
    zoomBlock: fe,
    textMarks: _e,
    pageLayers: he,
    editBlock: q.available ? oe : void 0,
    blockEdit: q,
    editShowsSource: v !== "compare",
    findTerm: d === "search" ? m : "",
    compareVersion: Ce,
    pointerTaken: Oe,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: w,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: $, close: h },
    docDark: T,
    toggleDocDark: P
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
    K,
    H,
    re,
    Y,
    de,
    fe,
    _e,
    he,
    q,
    oe,
    v,
    d,
    m,
    Ce,
    Oe,
    e.sourceOnly,
    w,
    e.download,
    e.goToPage,
    $,
    h,
    T,
    P
  ]), Be = V(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), j = [
    mc,
    `is-workspace-${R}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    S.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(ff, { api: ge, store: B, children: /* @__PURE__ */ p(bd, { value: ze, hud: Be, children: /* @__PURE__ */ L(
    "div",
    {
      className: j,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": R,
      "data-pointer-taken": Fe || void 0,
      onContextMenu: (W) => {
        const ee = xp(W);
        if (!ee) return;
        const ye = rf(ne, { target: W.target, clientX: W.clientX, clientY: W.clientY, page: ee.page });
        !ye.length && !Re.length || (W.preventDefault(), We(ye), Ie(ee));
      },
      children: [
        /* @__PURE__ */ p(
          tf,
          {
            mode: v,
            documentReady: !!r.jobId,
            sourceViewOnly: w,
            onModeChange: D,
            compareExtra: /* @__PURE__ */ p($n, { place: "compare" }),
            liveTranslation: b.topBarPill ? {
              visible: y,
              state: e.liveTranslation,
              onToggle: () => I((W) => !W),
              latestPage: y ? C : null,
              currentPage: e.currentPage,
              onJumpToLatest: _
            } : null,
            completion: k ? {
              onOpenCompare: () => {
                E(e.viewStateKey), D("compare");
              }
            } : null,
            start: /* @__PURE__ */ L(Ae, { children: [
              /* @__PURE__ */ p(Xl, { onBeforeClose: r.prepareClose }),
              /* @__PURE__ */ p(gp, { open: d, onToggle: f.toggleSidebar, issueCount: J.issues.length }),
              r.title ? /* @__PURE__ */ p("span", { className: "reader-workspace-title", title: r.title, children: r.title }) : null
            ] }),
            end: /* @__PURE__ */ L(Ae, { children: [
              /* @__PURE__ */ p($n, { place: "top", active: a }),
              /* @__PURE__ */ p(Yh, {})
            ] })
          }
        ),
        /* @__PURE__ */ L("div", { className: "reader-workspace", children: [
          /* @__PURE__ */ p(Bp, { state: f, bookmarkScope: e.viewStateKey, issues: J }),
          /* @__PURE__ */ L("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(Tp, { bookmarks: Se, onJumpPage: e.goToPage, onJumpBlock: H }),
            /* @__PURE__ */ p(Yd, { paneComposition: S, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: M }),
            /* @__PURE__ */ p(Hh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts })
          ] }),
          /* @__PURE__ */ L(
            "aside",
            {
              className: "reader-dock",
              hidden: !u,
              "data-dock": i ? "panel" : l ? "extension" : void 0,
              style: !i && l ? { "--reader-dock-width": `${l}px` } : void 0,
              "aria-label": "阅读辅助面板",
              children: [
                /* @__PURE__ */ p(eh, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: Q })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p(Bh, {}) : null,
        /* @__PURE__ */ p(
          cp,
          {
            mode: v,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            leftSlot: /* @__PURE__ */ p(Cp, { edit: q }),
            toolsSlot: /* @__PURE__ */ p($n, { place: "bottom" })
          }
        ),
        /* @__PURE__ */ p(
          jp,
          {
            session: r,
            zoomDocuments: U,
            zoomItem: Le,
            setZoomItem: ae,
            closeZoom: F,
            visiblePdfMode: v
          }
        ),
        /* @__PURE__ */ p(Lp, { menu: me, onClose: se, actions: De, sections: Re }),
        /* @__PURE__ */ p(gf, { extensions: hr }),
        /* @__PURE__ */ p(fp, {})
      ]
    }
  ) }) });
}
function jg() {
  return /* @__PURE__ */ p(bg, {});
}
export {
  jg as R,
  bg as a,
  zg as b,
  Fg as c,
  Af as d,
  Lf as e,
  $g as f,
  Og as g,
  Cg as h,
  Dg as r,
  Bg as s,
  Ge as u
};
//# sourceMappingURL=ReaderApp-Bacm366y.js.map
