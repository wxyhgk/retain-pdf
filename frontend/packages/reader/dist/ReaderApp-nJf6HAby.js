var vs = Object.defineProperty;
var _r = (e) => {
  throw TypeError(e);
};
var ws = (e, t, n) => t in e ? vs(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Nr = (e, t, n) => ws(e, typeof t != "symbol" ? t + "" : t, n), xr = (e, t, n) => t.has(e) || _r("Cannot " + n);
var xt = (e, t, n) => (xr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Ar = (e, t, n) => t.has(e) ? _r("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Lr = (e, t, n, r) => (xr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as Me } from "react/jsx-runtime";
import { useMemo as V, useState as N, useEffect as O, useCallback as x, useRef as A, useLayoutEffect as xe, memo as Xt, createContext as Yt, useContext as ut, Fragment as gn, forwardRef as Vo, useImperativeHandle as tr, useSyncExternalStore as bn, Component as Ss, Suspense as qo, lazy as Jo, useId as Go } from "react";
import { requireAdapter as _t, getReaderAdapters as je } from "./adapters.js";
import { resolveReaderDownloadName as Is, resolveReaderDownloadUrls as ks, READER_PROGRESS_COPY as Ge, trimString as cn, READER_DOWNLOAD_ACTIONS as Ts, disabledReason as Es } from "./runtime/state.js";
import { r as Ps, b as Rs } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Dn, isFinishedJobStatus as Wt } from "@retainpdf/domain/job";
import { n as Xo, d as Ms, f as In, k as Cr, b as _s, c as Ns, j as He, p as pt, g as xs, l as Pt, i as As } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as Ls } from "@retainpdf/api/documents";
import { isReaderTransportError as Cs, createReaderTransportError as Ds } from "./contracts.js";
import { toast as $n, Toaster as $s } from "sonner";
import { ChevronLeft as Yo, PenLine as nr, ZoomIn as Os, Check as Zo, X as Nt, Copy as zs, ChevronUp as Fs, ChevronDown as ln, History as Bs, LoaderCircle as js, Pin as Hs, LogOut as Us, Radio as Ws, ArrowDownToLine as Ks, CheckCircle2 as Vs, ImagePlus as qs, MessageCircleQuestion as Js, Crop as Gs, GitCompareArrows as Xs, Highlighter as Ys, Eraser as Zs, Undo2 as Qs, Trash2 as ei, ChevronRight as Qo, Minus as ea, Plus as ta, ArrowLeft as ti, Download as ni, Languages as ri, Columns2 as oi, FileText as ai, Star as si, Search as na } from "lucide-react";
import { Button as ie, Textarea as ii, IconButton as lt, Input as rr } from "@retainpdf/ui";
import { createPortal as ci } from "react-dom";
import { pdfjs as ra, Page as li, Document as ui } from "react-pdf";
import { e as di, m as fi, a as mi } from "./markdown-math-XkF5urpn.js";
const hi = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, pi = "", gi = Object.freeze({
  progress: "retainpdf-reader-progress"
}), bi = (e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, xg = (...e) => {
  var n;
  return (((n = je()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Ag = () => {
  var e, t;
  return ((t = (e = je()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Xe = () => _t("defaultReaderDataPort"), Dr = () => _t("defaultReaderPageConfigPort"), Lg = {
  get apiPrefix() {
    return Xe().apiPrefix;
  },
  fetchProtected: (...e) => Xe().fetchProtected(...e),
  loadMarkdownPayload: (e) => Xe().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Xe().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Xe().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Xe().loadJobPayload(e),
  loadReaderPayload: (e, t) => Xe().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Xe().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Xe().liveTranslation;
  }
}, oa = {
  messageTargetOrigin: () => Dr().messageTargetOrigin(),
  readerJobId: () => Dr().readerJobId()
}, yi = () => {
  var e;
  return ((e = je()) == null ? void 0 : e.liveTranslation) ?? null;
}, Kt = () => {
  var t;
  const e = je();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, tt = () => {
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
}, vi = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, wi = () => {
  var e, t;
  return ((t = (e = je()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Si = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Ii = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Is(...e);
}, ki = (...e) => {
  var t, n;
  return ((n = (t = je()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ks(...e);
}, Ti = (...e) => _t("downloadProtectedResource")(...e), Ei = (...e) => _t("failDownloadToast")(...e), Cg = (e, t) => _t("resolveMarkdownAssetUrl")(e, t), $r = "/api/v1";
function Pi() {
  const e = () => {
    var r;
    return Ps(
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
function Ri() {
  const e = Pi(), t = V(() => Si(oa), [e]), n = V(() => wi(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
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
  } = e, [c, l] = N({
    documentId: "",
    jobId: ""
  }), [u, f] = N({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, y] = N({
    jobId: "",
    documentId: ""
  }), I = h.jobId === g ? h.documentId : "", S = t || I, b = !!t && !g, [w, v] = N(null), R = (w == null ? void 0 : w.sessionIdentity) === r && w.documentId === S ? w : null, T = b || !!R, P = x((_) => {
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
  const C = x((_) => {
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
function Or(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function _i(e) {
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
function zr(e, t) {
  return bi(Dn(e, t));
}
function Ni(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function xi(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !Ni(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function On({
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
      oa.messageTargetOrigin()
    );
  } catch {
  }
}
function un(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), On({ percent: t, text: n, stage: r });
}
function Ai(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = N(null), [l, u] = N(null), [f, d] = N(""), [m, g] = N(0), h = f === n ? i : null, y = f === n ? l : null, I = Or(h), S = Wt(I), b = x(() => {
    g((C) => C + 1);
  }, []), w = x((C) => {
    c(C.jobPayload), u(C.manifestPayload), d(C.sessionIdentity);
  }, []), v = x((C) => {
    c(null), u(null), d(C);
  }, []), R = A(""), T = A(""), P = x(async () => {
    const C = o.current;
    if (!C || R.current === C) return;
    const _ = tt().loadJobPayload;
    if (typeof _ != "function") return;
    const k = a.current.value;
    R.current = C;
    try {
      const E = await _(C);
      if (s.current || a.current.value !== k || o.current !== C || !E || typeof E != "object")
        return;
      const M = Or(E);
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
function zn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Li(e, t) {
  e(t), zn(t);
}
function Ci(e) {
  const [t, n] = N(e ? "source" : "compare"), r = x((a) => {
    e && a !== "source" || (n(a), zn(a));
  }, [e]), o = x((a) => {
    Li(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), zn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Fr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Di(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Fr(n.active_job_id),
    activeVersionId: Fr(n.active_version_id)
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
function Fn(e, t) {
  Be.delete(e), Be.set(e, t);
}
function Br(e) {
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
async function aa(e, t = Kt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, I, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Be.has(r)) {
    const b = Be.get(r);
    return Fn(r, b), b;
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
    const w = await Wi(s);
    throw w && (b.reason = w), b;
  }
  const i = Ki(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Br(), Be.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (I = n.signal) == null ? void 0 : I.removeEventListener) == null || S.call(I, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Be.has(r) ? Fn(r, l) : (Br(), Be.set(r, l)), l;
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
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (O(() => {
    if (t || !n) return;
    const s = Be.get(n);
    if (s) {
      Fn(n, s);
      return;
    }
    const i = new AbortController();
    return aa(n, void 0, { signal: i.signal }).then((c) => {
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
async function Bn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  un(s, r, n, "download");
  const i = await aa(t, Kt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (un(s, o, n, "download"), i);
}
async function Xi(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  un(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Bn({
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
    Bn({
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
  fetchReading: r = Ls,
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
const en = {
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
    closingRef: y,
    activeLoadAbortRef: I
  } = e, [S, b] = N(""), [w, v] = N(""), [R, T] = N(null), [P, C] = N(null), [_, k] = N(!1), [E, M] = N(""), [D, $] = N([]), [W, H] = N(!1), [J, ue] = N(() => ({
    source: null,
    translated: null
  })), [Q, ce] = N(
    en
  ), [Se, Y] = N({
    loading: !0,
    percent: 4,
    text: Ge.boot,
    stage: "progress",
    failed: !1
  });
  return O(() => {
    const de = new AbortController(), Ae = h.current.value, ae = Gi({
      sessionEpochRef: h,
      closingRef: y,
      abort: de,
      sessionEpoch: Ae
    });
    I.current = de;
    const fe = tt();
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
      }), On({ percent: 100, text: Z, stage: "failed" });
    }
    function q() {
      k(!0), F || H(!0), Y({
        loading: !1,
        percent: 100,
        text: Ge.ready,
        stage: "ready",
        failed: !1
      }), On({ percent: 100, text: Ge.ready, stage: "ready" });
    }
    function oe() {
      return l != null && l.documentId ? zr(
        l.documentId,
        l.revision
      ) : hi() ? pi : fe.resolveResourceUrl(Dn(r));
    }
    async function re() {
      var ne;
      let se = { activeJobId: "", activeVersionId: "" };
      try {
        const he = await ((ne = fe.fetchDocument) == null ? void 0 : ne.call(fe, r));
        he && (se = Di(he));
      } catch {
      }
      const Z = $i({
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
      const B = await Bn({
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
      var De;
      const se = !l, Z = !!(se && fe.loadSessionSnapshot && fe.loadReaderOptionalArtifacts), ge = Z ? fe.loadReaderOptionalArtifacts(t) : null, B = await ((De = fe.loadSessionSnapshot) == null ? void 0 : De.call(fe, {
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
            he = await fe.fetchDocumentByJobId($r, t);
          } catch {
          }
          if (ae.isInactive()) return;
        }
      const Le = _i(ne.jobPayload) || `${(he == null ? void 0 : he.document_id) || ""}`.trim();
      Le && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Le
      });
      const _e = Oi({
        payloadDocumentId: Le,
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
      const Pe = fe.resolveReaderSourcePdf(ne.manifestPayload), ze = fe.resolveReaderTranslatedPdfUrl(ne.jobPayload, ne.manifestPayload), $e = typeof Pe == "string" ? Pe : fe.resolveReaderArtifactUrl(Pe), Ce = r || Le, We = l != null && l.documentId ? zr(
        l.documentId,
        l.revision
      ) : $e || (Ce ? fe.resolveResourceUrl(Dn(Ce)) : ""), Oe = l ? "" : ze || "";
      b(We || ""), v(Oe), M(xi(ne.jobPayload, t)), f({
        jobPayload: ne.jobPayload || null,
        manifestPayload: ne.manifestPayload || null,
        sessionIdentity: c
      });
      const Fe = () => Xi({
        sourceFinal: We || "",
        translatedFinal: Oe,
        fence: ae,
        setBoot: Y
      }), j = !!(We || Oe), K = ge && j ? Fe() : null;
      K == null || K.catch(() => {
      });
      const ee = (z) => {
        ae.isInactive() || ($(l ? [] : Xo(z.regionsPayload)), ue(l ? { source: null, translated: null } : Ms(z.readerMetadata)), ce(l ? en : z.readerErrors ?? en), H(!0));
      };
      if (ge ? (F = !0, ge.then(ee)) : ee(ne), !j) {
        U(Ge.failed, Ge.failed);
        return;
      }
      const ye = await (K ?? Fe());
      if (ye.status !== "inactive") {
        if (ye.status === "incomplete") {
          U("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        T(ye.sourceBytes), C(ye.translatedBytes), q();
      }
    }
    async function Ie() {
      k(!1), T(null), C(null), $([]), H(!1), ue({ source: null, translated: null }), ce(en), un(Y, 8, Ge.metadata, "metadata");
      try {
        if (s) {
          await re();
          return;
        }
        if (!t) {
          U(Ge.failed, Ge.failed);
          return;
        }
        await me();
      } catch (se) {
        if (ae.isClosedOrStale() || (se == null ? void 0 : se.name) === "AbortError") return;
        ae.markFailed();
        const Z = Number(se == null ? void 0 : se.status), ge = `${(se == null ? void 0 : se.reason) || ""}`, B = Bi({ status: Z, reason: ge, sessionJobId: t });
        if (B && (await Zi({
          apiPrefix: $r,
          documentId: B,
          expiredJobId: t
        }) || ae.isClosedOrStale()))
          return;
        if (zi({
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
        const ne = se instanceof Error ? se.message : Ge.failed;
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
    regionsSettled: W,
    readerMetadata: J,
    readerErrors: Q,
    boot: Se
  };
}
function ec() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ri(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), c = A(""), l = A(""), u = A(() => {
  }), f = x(() => u.current(), []), d = Mi({
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
  } = d, { mode: I, setMode: S, switchSessionMode: b } = Ci(y);
  u.current = () => {
    b("source");
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
    scopedManifestPayload: R,
    jobStatus: T,
    jobTerminal: P,
    jobRefreshRevision: C,
    refreshJobArtifacts: _,
    refreshJobStatus: k
  } = w, E = Qi({
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
  }), M = x(() => {
    var $;
    e.current = !0, ($ = t.current) == null || $.abort();
  }, []), D = V(
    () => ({
      fetchProtected: tt().fetchProtected,
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
const tc = 160, nc = 8, rc = 0;
function oc() {
  const e = A(null), [t, n] = N(null), [r, o] = N(rc), a = x((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
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
const kn = { source: 0, translated: 0 };
function sc(e, t) {
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
  const [f, d] = N(() => ({
    identity: l,
    pages: kn
  })), [m, g] = N(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : kn, y = m.identity === l ? m.tick : 0, I = ac({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = I, b = x((k, E) => {
    u.current === l && d((M) => {
      const D = M.identity === l ? M.pages : kn;
      return D[E] === k && M.identity === l ? M : {
        identity: l,
        pages: { ...D, [E]: k }
      };
    });
  }, [l]), w = A(null), v = x(() => {
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
const Ee = "data-reader-page", ke = "data-reader-pane", or = "data-natural-height", ic = "reader-react-root", sa = "reader-react-grid", ia = "reader-react-scroll-shell", yn = "reader-react-pdf-pane", ca = "reader-react-pdf-page", dn = "reader-react-pdf-page-placeholder", ar = "reader-react-pdf-page-slot";
function fn(e, t) {
  const n = e != null ? `[${Ee}="${e}"]` : `[${Ee}]`;
  return t ? `${n}[${ke}="${t}"]` : n;
}
function sr() {
  return `.${ar}[${Ee}]`;
}
function mn(e) {
  return Number(e.getAttribute(Ee));
}
const la = 0.25, hn = 1, cc = 0.05, Zt = 0.5, lc = 16, uc = 8, ua = lc + uc, dc = 720;
function kt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function da(e) {
  return Number.isFinite(e) && e < dc;
}
function St(e, t = Number.POSITIVE_INFINITY) {
  return da(t) && (e === "source" || e === "translated") ? hn : Zt;
}
function Qe(e) {
  return Number.isFinite(e) ? Math.min(hn, Math.max(la, e)) : Zt;
}
function Vt(e, t) {
  const n = Qe(Number(e) + t * cc);
  return Math.round(n * 100) / 100;
}
function fc(e) {
  return Math.round(Qe(e) * 100);
}
function fa(e) {
  const n = (Number(e) || 0) - ua;
  return Math.max(160, Math.floor(n));
}
function mc(e, t = Zt) {
  const n = Qe(t);
  return fa((Number(e) || 0) * n);
}
function hc(e, t) {
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
const pc = 8;
function gc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < pc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const ma = 200, bc = [
  "markdown"
], yc = bc;
function ha(e) {
  return yc.includes(e);
}
const vc = "retainpdf:reader:view:v1:", jr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), wc = /* @__PURE__ */ new Set([
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
function jn(e) {
  return `${e || ""}`.trim();
}
function Sc({
  documentId: e,
  jobId: t
}) {
  const n = jn(e);
  if (n) return `document:${n}`;
  const r = jn(t);
  return r ? `job:${r}` : "";
}
function ga(e) {
  const t = jn(e);
  return t ? `${vc}${t}` : "";
}
function Ic(e) {
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
  if (!(!jr.has(t) || !jr.has(n) || t === n))
    return { left: t, right: n };
}
function Tc(e) {
  return e === null ? null : ha(e) ? e : void 0;
}
function Ec(e) {
  return wc.has(e) ? e : void 0;
}
function ba(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Ic(t.anchor), r = Number(t.zoom), o = Ec(t.mode), a = kc(t.splitLayout), s = Tc(t.assistantPanel);
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
function qe(e, t = pa()) {
  const n = ga(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ba(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function vn(e, t, n = pa()) {
  const r = ga(e);
  if (!r || !n) return null;
  const o = qe(e, n), a = ba({
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
  const [r, o] = N(() => {
    var m;
    return ((m = qe(n)) == null ? void 0 : m.zoom) ?? St(e, kt());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), c = A(((d = qe(n)) == null ? void 0 : d.zoom) !== void 0);
  O(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = qe(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? St(e, kt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), O(() => {
    if (c.current) return;
    const m = St(e, kt()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = x((m, g) => {
    const h = Qe(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, vn(s.current, { zoom: h }), o(h));
  }, []), u = x((m) => {
    l(Vt(a.current, m));
  }, [l]), f = x((m) => {
    l(St(m));
  }, [l]);
  return xe(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, hc(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const Rc = 160, Mc = 3e-3, Hr = 50, _c = 16, Nc = 800;
function xc(e, t = 0) {
  const n = t === 1 ? _c : t === 2 ? Nc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Hr, Math.min(Hr, r));
  return Math.exp(-o * Mc);
}
function Ac(e, t, n = 0) {
  return Qe(e * xc(t, n));
}
function Lc(e) {
  return Math.round(Qe(e) * 100) / 100;
}
function Cc(e, t, n) {
  const r = Qe(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Qe(t) / r;
  const a = (o + ua) / r;
  return fa(a * Qe(t)) / o;
}
function Dc(e) {
  return Array.from(e.querySelectorAll(sr()));
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
    page: o.getAttribute(Ee) || "",
    pane: o.getAttribute(ke) || "",
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
function ya(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${sr()}[${Ee}="${t.page}"][${ke}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (zc(n, e).scrollLeft += a);
}
function Fc(e, t, n, r) {
  const o = e.querySelector(`.${sa}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function At(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Bc = 600, jc = 1e3;
function Hc(e, t) {
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
      const f = Lc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        At(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, At(d.grid));
      }, Bc), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, At(h.grid)), f = {
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
      a.current = null, u != null && u.timer && clearTimeout(u.timer), At((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), xe(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), At(c.grid), !(!e || !c.anchor) && (ya(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Hc(e, c.anchor)));
  }, [t, e]);
}
function Wc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: x((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const ir = 48;
function va(e, t = ir) {
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
  const o = mn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function jt(e, t, n = ir) {
  if (!e)
    return null;
  const r = fn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = va(e, n), i = wa(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Rt(e, t, n = "auto", r, o = ir) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(fn(a, r))), i || (i = e.querySelector(fn(a))), !i)
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
function Hn(e, t, n) {
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
  return Hn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function pn(e, t) {
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
    const f = fn(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = va(i), I = wa(h, y);
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
const Jc = `canvas, .react-pdf__Page, .${ca}, .${dn}`, Ur = /* @__PURE__ */ new WeakMap();
function Gc(e) {
  const t = Number(e.getAttribute(or));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Ur.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Jc), Ur.set(e, n)), n) {
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
  e.querySelectorAll(sr()).forEach((r) => {
    const o = mn(r);
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
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
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
      const w = Yc(b);
      Xc(s.current, w) || (s.current = w, a(w)), u && !f && (f = !0, (v = i.current) == null || v.call(i));
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
]), al = 180, Wr = [0, 48, 140, 320, 700, 1200];
function sl(e, t) {
  var E;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((E = qe(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
  ), c = A(null), l = A(!1), u = A(r), f = A(null), d = A(null), m = A(null), g = A(null), h = A(a), y = A(""), I = A(n);
  I.current = n;
  const S = x(() => {
    var M;
    (M = f.current) == null || M.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = x(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), w = x((M = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const D = () => {
      g.current = null, vn(h.current, {
        anchor: Ue(i.current)
      });
    };
    M ? D() : g.current = setTimeout(D, al);
  }, []), v = x((M) => {
    i.current = Ue(M), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, rl);
  }, []);
  O(() => {
    if (!o)
      return;
    let M = !1, D = null, $ = null, W = null;
    const H = () => {
      if (M) return;
      const J = e.current;
      if (!J) {
        W = setTimeout(H, 50);
        return;
      }
      D = J, $ = () => {
        if (l.current)
          return;
        const ue = jt(D, I.current);
        ue && (i.current = ue, w());
      }, D.addEventListener("scroll", $, { passive: !0 }), l.current || $();
    };
    return H(), () => {
      M = !0, W != null && clearTimeout(W), D && $ && D.removeEventListener("scroll", $);
    };
  }, [o, r, n, e, w]), O(() => {
    if (!o) return;
    const M = e.current;
    if (!M) return;
    const D = ($) => {
      $.metaKey || $.ctrlKey || $.altKey || ol.has($.key) && b();
    };
    return M.addEventListener("wheel", b, { passive: !0 }), M.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", D), () => {
      M.removeEventListener("wheel", b), M.removeEventListener("touchmove", b), window.removeEventListener("keydown", D);
    };
  }, [o, e, b]), xe(() => {
    var D;
    if (h.current === a) return;
    w(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const M = (D = qe(a)) == null ? void 0 : D.anchor;
    i.current = M ? Ue(M) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, w, S]), O(() => {
    var D;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const M = Ue(
      ((D = qe(a)) == null ? void 0 : D.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = M, c.current = M, l.current = !0, S(), f.current = Hn(
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
    const M = c.current ? Ue(c.current) : Ue(i.current);
    return l.current = !0, c.current = M, i.current = M, S(), f.current = Hn(
      () => e.current,
      M,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Qc,
        onDone: () => v(M)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(M);
    }, el), () => {
      S();
    };
  }, [r, o, n, e, v, S]), O(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), w(!0);
  }, [S, w]);
  const R = x(() => {
    const M = jt(
      e.current,
      I.current
    );
    return Ue(M || i.current);
  }, [e]), T = x(() => {
    l.current = !0;
    const M = jt(
      e.current,
      I.current
    ), D = Ue(M ?? i.current);
    return i.current = D, c.current = D, w(), D;
  }, [e, w]), P = x((M, D, $) => {
    const W = $ || I.current, H = pn(M, D || 1), J = { page: H, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, w(), S(), Kc(e.current, H, "smooth", W), f.current = Vc(
      () => e.current,
      H,
      {
        behavior: "auto",
        pane: W,
        delaysMs: tl,
        onDone: () => v(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(J);
    }, nl);
  }, [e, v, S, w]), C = x(() => Ue(i.current), []), _ = x(() => l.current, []), k = x(() => {
    if (!l.current || !c.current)
      return;
    const M = Ue(c.current);
    Rt(
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
function Sa(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const cl = [0, 80, 200, 400, 800], ll = 120, ul = 400;
function dl(e, t, n) {
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
    const h = vi(), y = il(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const I = Sa(h, y, { jobId: c, documentId: l });
    if (t.current === I)
      return;
    if (y == null) {
      t.current = I, (w = g.current) == null || w.call(g);
      return;
    }
    t.current = I, h && ((v = m.current) == null || v.call(m, h, y));
    const S = [];
    let b = 0;
    for (const R of cl)
      b = Math.max(b, R), S.push(
        setTimeout(() => {
          f.current(y);
        }, R)
      );
    return S.push(
      setTimeout(() => {
        var R;
        (R = g.current) == null || R.call(g);
      }, b + ll)
    ), () => {
      for (const R of S) clearTimeout(R);
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
  } = e, u = A(a);
  u.current = a;
  const f = A(l);
  f.current = l;
  const d = A(0);
  O(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var I;
      const g = ((I = globalThis.location) == null ? void 0 : I.search) || "", h = Rs(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Sa(
        { blockId: y },
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
  const t = A(""), [n, r] = N(!1), o = x(() => r(!0), []), a = {
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
const Lt = {
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
function Kr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Ia(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Kr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Kr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function gl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Ia(r, t, n);
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
const Vr = [250, 500, 1e3, 2e3, 4e3], Tn = [80, 160, 320, 640, 1e3, 1500], qr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Un(e, t) {
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
function cr(e) {
  return Cs(e) ? `${e.code || ""}`.trim() : "";
}
function tn(e, t) {
  const n = cr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Il(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Ia(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Ds(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = cr(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Tn[Math.min(s, Tn.length - 1)];
    if (await Un(i, r), s >= Tn.length + 2) throw a;
  }
}
function kl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(Lt), s = A(o), i = A("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Wt(l) ? l : "";
  return O(() => {
    if (!n || !c) {
      i.current = "", s.current = Lt, a(Lt);
      return;
    }
    const f = r === void 0 ? yi() : r, d = i.current === c;
    if (i.current = c, !f) {
      const b = {
        ...d ? s.current : Lt,
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
      ...d ? s.current : Lt,
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
            layoutByPage: pl(w),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (w) {
          if ((w == null ? void 0 : w.name) === "AbortError") return;
          const v = cr(w);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            y((T) => ({
              ...T,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: tn(w, "实时译文暂不可用")
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
            error: tn(w, "正在等待 OCR 版面数据")
          })), await Un(Vr[Math.min(b, Vr.length - 1)], m.signal).catch(() => {
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
                v = await Il(
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
                  error: tn(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((R) => {
                const T = gl(R, w, v);
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
            error: tn(w, "实时译文连接已中断，正在重连")
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
        await Un(qr[Math.min(b, qr.length - 1)], m.signal).catch(() => {
        }), b += 1;
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
function El(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = tt().fetchRevisionGroups;
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
const Pl = 4500;
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
function ka(e) {
  return !!(e.jobId && e.sourceUrl && Ml.has(e.workflow));
}
function _l(e) {
  return !!(ka(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Nl() {
  const e = ec(), t = ka({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = _l({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Wt(o) && (r.current.running = !0);
  const a = kl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = oc(), u = El(e.jobId, !e.sourceOnly), f = Sc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = Pc(e.mode, s, f);
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
    beginModeSwitch: y,
    goToPage: I,
    repinIfRestoring: S
  } = sl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  O(() => {
    S();
  }, [c, S]);
  const b = Zc(
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
  ), v = x((H, J) => {
    var Q, ce;
    const ue = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Q = h.numPagesByPane) == null ? void 0 : Q.source) || 0,
      Number((ce = h.numPagesByPane) == null ? void 0 : ce.translated) || 0
    );
    I(H, ue, J);
  }, [I, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, T] = N(null), P = A(null), C = x((H) => {
    P.current && clearTimeout(P.current), T(H), H && (P.current = setTimeout(() => T(null), Pl));
  }, []);
  O(() => () => {
    P.current && clearTimeout(P.current);
  }, []);
  const _ = x((H) => {
    const J = In(e.regions, H);
    return J ? Cr(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), k = x((H, J) => {
    const ue = J || h.primaryPane, Q = typeof H == "object" && H ? `${H.block_id || ""}`.trim() : "", ce = typeof H == "object" && H ? `${H.image_url || ""}`.trim() : "", Se = typeof H == "object" && H ? H.page_idx != null ? Number(H.page_idx) + 1 : H.page != null ? Number(H.page) : null : typeof H == "number" ? H + 1 : null, Y = _s(e.regions, ce, Se) || In(e.regions, Q) || (typeof H == "object" ? Ns(e.regions, H) : null);
    let de = Y ? Cr(Y, ue).page : null;
    de == null && (de = Rl(H)), !(de == null || de < 1) && (C(Y), v(de, ue));
  }, [C, v, h.primaryPane, e.regions]);
  hl({
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
      C(In(e.regions, H.blockId));
    }
  });
  const { setModeKeepingPage: E } = Wc({
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
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), W = V(() => ({
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
    ...W,
    currentPage: w
  }), [W, w]);
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
  O(() => {
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
              a(Vt(o, 1));
              return;
            case "zoom-out":
              a(Vt(o, -1));
              return;
            case "zoom-reset":
              a(St(t, kt()));
              return;
            case "next-page":
              c(pn(s + 1, i));
              return;
            case "prev-page":
              c(pn(s - 1, i));
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
  return /* @__PURE__ */ L(Ul, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Hl();
  }, children: [
    /* @__PURE__ */ p(Yo, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
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
function Ta(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Xl(e, t) {
  let n = null;
  for (const r of Ta(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let Jr = !1;
function Yl() {
  if (Jr)
    return;
  const e = Kt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (ra.GlobalWorkerOptions.workerSrc = e, Jr = !0);
}
const at = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Zl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Ql = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, eu = {
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
}, Gr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function tu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Gr(o ?? a ?? "", Zl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Gr(o ?? a ?? "", Ql)).replace(/\\([a-zA-Z]+)/gu, (r, o) => eu[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function nu(e) {
  return at(e.translatedBlockText) || at(e.translated.text) || at(e.source.text);
}
const ru = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function ou(e) {
  const t = [];
  for (const n of e) {
    if (!ru(n)) continue;
    const r = tu(nu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const au = 24, su = 60;
function Xr(e, t) {
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
    const i = at(a.translatedBlockText) || at(a.translated.text), c = i ? Xr(i, r) : null, l = c ?? Xr(at(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function nn(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Ot(e, t) {
  const n = at(t).toLowerCase();
  if (!n || !e) return nn(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${nn(e.slice(a, s))}<mark class="reader-find-mark">${nn(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + nn(e.slice(a));
}
function cu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const lu = /^data-[a-z0-9-]+$/;
function Yr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function uu(e, t, n = "") {
  if (!t.length) return Ot(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Ot(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => lu.test(c)).map(([c, l]) => ` ${c}="${Yr(l)}"`).join("");
    o += `<mark class="${Yr(s.className)}"${i}>${Ot(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Ot(e.slice(a), n);
}
function we(e) {
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
    source: we(e == null ? void 0 : e.source_text) || we(e == null ? void 0 : e.unit_source_text),
    translated: we(e == null ? void 0 : e.protected_translated_text) || we(e == null ? void 0 : e.translated_text)
  };
}
const hu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Ea(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function pu(e) {
  const t = Ea(e).sort((r, o) => we(r.ts).localeCompare(we(o.ts)));
  return t.length ? [
    { text: we(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: we(r.new_text),
      label: hu[we(r.source)] || we(r.source) || "修订",
      ts: we(r.ts),
      reason: we(r.reason)
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
  return we(r.finished_at) || we(n.finished_at) || "";
}
function yu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Ea(e).sort((a, s) => we(a.ts).localeCompare(we(s.ts)));
  for (const a of o) {
    const s = new Date(we(a.ts)).getTime(), i = we(a.reader_item_id) || we(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, we(a.new_text));
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
    const n = t, r = vu[we(n.kind)] || we(n.kind) || "问题", o = we(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Su = /* @__PURE__ */ new Set(["text", "formula"]);
function lr(e) {
  return Su.has(e);
}
function Pa(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || lr(He(n));
}
function Iu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !lr(He(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const ku = 300, Tu = 72;
function Eu(e, t) {
  if (e.width >= ku && e.height >= Tu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Pu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Ru(e, t, n) {
  return e.flatMap((r) => {
    if (!Pu.has(He(r.region))) return [];
    const o = pt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Zr(e, t, n) {
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
const _u = "reader-text-hover-copy", Nu = "reader-text-hover-edit", xu = "reader-text-hover-zoom", Au = "reader-text-hover-id";
function Lu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Ra = "reader-text-hover-tools";
function rn({
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
  return /* @__PURE__ */ p(e === "copied" ? Zo : e === "failed" ? Nt : zs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
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
  const [c, l] = N("idle"), [u, f] = N("idle"), [d] = N(() => Lu()), m = A([]), g = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    l("idle"), f("idle");
    const v = m.current;
    return () => {
      v.forEach((R) => window.clearTimeout(R)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = xs(e.highlight.region, t), y = He(e.highlight.region), I = (v, R) => async (T) => {
    T.preventDefault(), T.stopPropagation();
    const P = await Mu(v);
    R(P ? "copied" : "failed"), m.current.push(window.setTimeout(() => R("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, w = s || ($u(b) ? "outside" : "inside");
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
          className: Ra,
          "data-placement": w,
          style: w === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              rn,
              {
                className: Au,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: I(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && lr(y) ? /* @__PURE__ */ p(
              rn,
              {
                className: Nu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(nr, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              rn,
              {
                className: _u,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: I(h, l),
                children: /* @__PURE__ */ p(Ou, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              rn,
              {
                className: xu,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Os, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
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
const ju = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Hu = 256, Ct = /* @__PURE__ */ new Map();
function Uu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Ma(e) {
  const t = `${e || ""}`, { text: n, slots: r } = di(t, { bareLatex: !0 }), o = Uu(n), a = fi(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Ct.get(t);
  if (!s && (s = mi(o, r), Ct.set(t, s), Ct.size > Hu)) {
    const i = Ct.keys().next().value;
    i !== void 0 && Ct.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function En(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ye(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Wu(e, t) {
  const n = e.typography, r = Ye(t) || 1, o = Ye(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = En(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ye(n == null ? void 0 : n.fit_min_font_size_pt), u = Ye(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Ye(n == null ? void 0 : n.leading_em), h = [
    Ye(n == null ? void 0 : n.padding_top_pt) || 0,
    Ye(n == null ? void 0 : n.padding_right_pt) || 0,
    Ye(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ye(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || ju,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (En(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : En(e.kind) ? "center" : "justify",
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
const Vu = 512, Dt = /* @__PURE__ */ new Map();
let Wn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Wn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Wn += 1;
}));
function qu(e, t, n, r) {
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
function _a({ item: e, pageScale: t }) {
  const n = A(null), r = V(
    () => Ma(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = V(
    () => Wu(e, t),
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
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), I = Math.max(1, e.rect.height - d - g), S = qu(o, y, I, s);
    let b = Dt.get(S);
    if (b === void 0 && (b = Ku(
      (w) => (f.style.fontSize = `${w}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      I,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Dt.set(S, b), Dt.size > Vu)) {
      const w = Dt.keys().next().value;
      w !== void 0 && Dt.delete(w);
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
function Ju({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = V(
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
        _a,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Gu = Xt(Ju);
function Xu({
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
        _a,
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
const Yu = Xt(Xu), Na = 24, rt = Na * 2 + 4, Ze = 24, Zu = 4, Qu = 6, dt = (e) => e.left + e.width, it = (e) => e.top + e.height;
function zt(e, t) {
  const n = Math.min(dt(e), dt(t)) - Math.max(e.left, t.left), r = Math.min(it(e), it(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Qr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= dt(t) && r >= t.top && r <= it(t);
}, ed = (e) => e.height > 40 && e.height > e.width * 2.5;
function td(e, t, n) {
  if (!t.length || e.height < Ze || e.width < n + 8) return null;
  const r = Math.max(...t.map(it)), o = dt(e) - 4 - n;
  for (const a of [r, it(e) - 2]) {
    const s = Math.max(e.top, a - Ze), i = { left: o, top: s, width: n, height: Ze };
    if (!t.some((c) => zt(i, c) > 0)) return s - e.top;
  }
  return null;
}
function nd(e, t) {
  const n = [], r = (a) => {
    const s = Na + Zu, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: dt(e), top: i, width: s, height: rt } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: rt } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ze - 3, width: rt, height: Ze + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: it(e), width: rt, height: Ze + 3 } }), r(!0);
  const o = td(e, t, rt);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: dt(e) - 4 - rt, top: e.top + o, width: rt, height: Ze } }), n;
}
function rd(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !ed(S)), i = s.filter((S) => Qr(S, t)), c = s.filter((S) => !Qr(S, t)), l = n.filter((S) => S !== t && zt(S, t) < t.width * t.height * 0.5), u = nd(t, i).filter(({ box: S, overhang: b }) => {
    const w = b ? Qu : 0;
    return S.left >= -w && dt(S) <= r + w && S.top >= 0 && it(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !c.some((b) => zt(S, b) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((b) => zt(S.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let y = null, I = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((w, v) => w + zt(S.box, v), 0);
    b < I && (y = S, I = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function od(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ze - 3 : it(r);
  return t >= r.left - 4 && t <= r.left + rt + 4 && n >= a && n <= a + Ze + 3;
}
const Pn = (e) => e.left + e.width, Rn = (e) => e.top + e.height;
function ad(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > Pn(e) || f < e.top || f > Rn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, Pn(l)), i = Math.max(i, Rn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(Pn(e) + r, s + n) - c.left, c.height = Math.min(Rn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
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
  const [o, a] = N(null);
  return xe(() => {
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
  const [a, s] = N(null), [i, c] = N(!1), [l, u] = N([]), [f, d] = N(""), [m, g] = N(""), [h, y] = N(!1), [I, S] = N(null), [b, w] = N([]), v = r.drafts, R = r.generation, T = x(async (k, E) => {
    if (e)
      try {
        u(pu(await e.fetchRevisions(k, E)));
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
      const D = `${(E == null ? void 0 : E.item_id) || n}`, { source: $, translated: W } = mu(M);
      s({ readerItemId: n, itemId: D, source: $, current: W }), d(v.get(n) ?? W);
    }).catch((E) => {
      k || S({ tone: "error", message: (E == null ? void 0 : E.message) || "读取这段译文失败。" });
    }).finally(() => {
      k || c(!1);
    }), T(t, n), () => {
      k = !0;
    };
  }, [e, t, n, T]);
  const P = x((k) => {
    d(k), n && v.set(n, k);
  }, [n, v]), C = x(async (k, E) => {
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
      return ($ == null ? void 0 : $.reason) === "generation_mismatch" && (R.current = null), S({ tone: "error", message: ($ == null ? void 0 : $.message) || "保存失败，请稍后再试。" }), w(wu($ == null ? void 0 : $.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, T, v, R]), _ = x(() => {
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
const xa = "reader-inline-edit";
function ld({ text: e }) {
  const [t, n] = N("");
  return O(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Ma(e);
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
function ud({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var _;
  const s = e.itemId, i = cd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = N(!1), [u, f] = N(!1), d = A(null), m = Eu(e.rect, t), g = V(() => Iu(o), [o]), h = g.indexOf(s), { loaded: y } = i, I = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: w, select: v } = n, R = x((k) => {
    const E = g[h + k];
    E && (v(E), a == null || a(E));
  }, [g, h, v, a]), T = x(() => {
    i.discardDraft(), w();
  }, [i, w]), P = x(async (k, E) => {
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
  return /* @__PURE__ */ L(Me, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${xa} is-${m.mode}`,
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
            ii,
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
          y ? /* @__PURE__ */ p(ld, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(lt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(Fs, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(lt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(ln, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              rr,
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
                  /* @__PURE__ */ p(Bs, { size: 13, "aria-hidden": !0 }),
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
            const M = k.text === y.current, D = [gu(k.ts), k.label].filter(Boolean).join(" · ");
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
const Aa = Yt(null), La = Yt(null);
function dd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Aa.Provider, { value: e, children: /* @__PURE__ */ p(La.Provider, { value: t, children: n }) });
}
function Je() {
  return ut(Aa);
}
function ur() {
  return ut(La);
}
const Ca = 1.414;
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
  liveTranslationPage: y,
  showLiveTranslation: I = r === "source",
  liveTranslationMissing: S = !1
}) {
  var Z, ge;
  const b = Je(), w = b == null ? void 0 : b.revisedBlocks, v = b == null ? void 0 : b.blockEdit, R = v == null ? void 0 : v.pendingEdits, T = b == null ? void 0 : b.editBlock, P = (b == null ? void 0 : b.findTerm) || "", C = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", _ = b == null ? void 0 : b.textMarks, k = V(
    () => _ ? ({ str: B }) => uu(B, _(B), P) : P ? ({ str: B }) => Ot(B, P) : void 0,
    [P, _]
  ), E = A(c ?? Ca), [M, D] = N(E.current);
  O(() => {
    c != null && Math.abs(c - E.current) >= 1e-3 && (E.current = c, D(c));
  }, [c]);
  const $ = A(u);
  $.current = u;
  const W = A(null), H = A((B) => {
    var ne;
    W.current = B, (ne = $.current) == null || ne.call($, B);
  }).current, J = A(null), ue = A(`${t}@${n}`);
  xe(() => {
    const B = `${t}@${n}`;
    ue.current !== B && (ue.current = B, o && hd(W.current, J.current));
  }, [o, n, t]), O(() => {
    o || Mn(J.current);
  }, [o]), O(() => () => Mn(J.current), []);
  const Q = Math.max(120, Math.floor(t * M)), ce = Math.max(Q, Math.ceil(s || 0)), Se = pt(f, t, Q), Y = V(
    () => Ru(d, t, Q),
    [Q, d, t]
  ), [de, Ae] = N(null), ae = typeof g == "function", fe = ae ? m ?? null : de, F = (B) => {
    ae ? B !== (m ?? null) && (g == null || g(B)) : Ae((ne) => ne === B ? ne : B);
  }, U = V(
    () => Y.find((B) => B.itemId === fe) || null,
    [fe, Y]
  ), q = r === "translated" && ((Z = v == null ? void 0 : v.target) == null ? void 0 : Z.itemId) || "", oe = V(
    () => q && Y.find((B) => B.itemId === q) || null,
    [q, Y]
  ), re = id(W, o ? U : null, Y, t), me = (B) => {
    var Pe, ze, $e, Ce;
    if (B.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      F(null);
      return;
    }
    if (B.buttons !== 0) {
      F(null);
      return;
    }
    if ((ze = (Pe = B.target) == null ? void 0 : Pe.closest) != null && ze.call(Pe, `.${Ra}`) || (Ce = ($e = B.target) == null ? void 0 : $e.closest) != null && Ce.call($e, `.${xa}`)) return;
    const ne = B.currentTarget.getBoundingClientRect(), he = B.clientX - ne.left, Le = B.clientY - ne.top;
    if (od(re, he, Le)) return;
    const _e = Zr(Y, he, Le);
    F((_e == null ? void 0 : _e.itemId) || null);
  }, Ie = (B) => {
    if (B.pointerType === "mouse") return;
    const ne = B.currentTarget.getBoundingClientRect(), he = Zr(
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
      [Ee]: e,
      [ke]: r,
      [or]: Q,
      className: ar,
      onPointerMoveCapture: me,
      onPointerDown: Ie,
      onDoubleClick: (B) => {
        const ne = b == null ? void 0 : b.zoomBlock;
        !ne || b != null && b.pointerTaken || !U || He(U.highlight.region) === "figure" && (B.preventDefault(), ne(U.itemId));
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
          li,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: k,
            renderAnnotationLayer: !1,
            className: ca,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: dn,
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
              Mn(J.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: dn,
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
          Gu,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: Q
          }
        ) : null,
        o && I && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p(Yu, { targets: Y, edits: R, width: t, excludeId: oe == null ? void 0 : oe.itemId }) : null,
        o && oe && v ? /* @__PURE__ */ p(
          ud,
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
        (ge = b == null ? void 0 : b.pageLayers) == null ? void 0 : ge.map((B) => /* @__PURE__ */ p(gn, { children: B.render({ page: e, width: t, height: Q, pane: C, active: o }) }, B.id)),
        /* @__PURE__ */ p(
          zu,
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
const md = Xt(fd);
function hd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Mn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const pd = 2 * 1024 * 1024;
function gd(e) {
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
const _n = 5, bd = "120% 0px", yd = 120, vd = "25% 0px";
let eo = 1;
const to = /* @__PURE__ */ new WeakMap();
function wd(e) {
  if (!e) return 0;
  const t = to.get(e);
  if (t) return t;
  const n = eo;
  return eo += 1, to.set(e, n), n;
}
function Sd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Id = Vo(
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
    Yl();
    const { file: _, loading: k, error: E } = Ji(n, r), M = `${n}\0${wd(_)}`, D = A(M);
    D.current = M;
    const $ = V(() => {
      const z = Hi(_);
      return z ? "ranged" in z ? { range: gd(z.ranged) } : z : null;
    }, [_, n]), [W, H] = N(0), [J, ue] = N(""), [Q, ce] = N(null), [Se, Y] = N(480), de = A(null), Ae = A(0), ae = V(() => Sd(), []), fe = V(() => ({
      cMapUrl: Kt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Kt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: pd,
      disableAutoFetch: !0
    }), []);
    tr(C, () => Q, [Q]), O(() => {
      const z = (X) => {
        Ae.current = X, Y(X);
      }, G = (X) => {
        const be = gc(X, Ae.current);
        if (be !== "ignore") {
          if (de.current && clearTimeout(de.current), be === "immediate") {
            z(X);
            return;
          }
          de.current = setTimeout(() => z(X), ma);
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
      () => mc(Se, o),
      [Se, o]
    ), [U, q] = N(() => /* @__PURE__ */ new Map()), [oe, re] = N(() => /* @__PURE__ */ new Set()), [me, Ie] = N(() => /* @__PURE__ */ new Set()), se = A(/* @__PURE__ */ new Map()), Z = A(null), ge = A(null), [B, ne] = N(() => /* @__PURE__ */ new Set()), he = A(/* @__PURE__ */ new Map()), Le = x((z, G) => {
      q((te) => {
        if (te.get(z) === G) return te;
        const le = new Map(te);
        return le.set(z, G), le;
      });
    }, []), _e = x((z, G) => {
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
    }, []), Pe = A(/* @__PURE__ */ new Map()), ze = x((z) => {
      const G = Pe.current;
      let te = G.get(z);
      return te || (te = (le) => _e(z, le), G.set(z, te)), te;
    }, [_e]);
    O(() => {
      if (typeof IntersectionObserver > "u") return;
      const z = he.current, G = new IntersectionObserver(
        (te) => {
          const le = [], ve = [];
          for (const X of te) {
            const be = X.target, Te = mn(be);
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
            }, yd));
        },
        { root: i, rootMargin: bd, threshold: 0 }
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
              const X = mn(ve.target);
              !Number.isFinite(X) || ve.isIntersecting === te.has(X) || (le = le || new Set(te), ve.isIntersecting ? le.add(X) : le.delete(X));
            }
            return le || te;
          });
        },
        { root: i, rootMargin: vd, threshold: 0 }
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
    const $e = !!i && typeof IntersectionObserver < "u";
    xe(() => {
      H(0), ue(""), re(/* @__PURE__ */ new Set()), Ie(/* @__PURE__ */ new Set()), q(/* @__PURE__ */ new Map()), se.current.clear();
      const z = he.current;
      for (const G of z.values()) clearTimeout(G);
      z.clear(), h == null || h(0, t);
    }, [M, h, t]);
    const Ce = x(
      (z) => {
        if (D.current !== M) return;
        const G = z.numPages;
        H(G), ue(""), h == null || h(G, t), f == null || f({ numPages: G, pane: t }), m && typeof z.getPage == "function" && m(z, t), d && typeof z.getOutline == "function" && Gl(z).then((te) => {
          D.current === M && d(te, t);
        }, () => {
        });
      },
      [M, f, d, m, h, t]
    ), We = x(
      (z) => {
        if (D.current !== M) return;
        const G = (z == null ? void 0 : z.message) || "PDF 解析失败";
        ue(G), H(0), h == null || h(0, t), g == null || g(z, t);
      },
      [M, g, h, t]
    ), Oe = V(
      () => W > 0 ? Array.from({ length: W }, (z, G) => G + 1) : [],
      [W]
    );
    O(() => {
      typeof IntersectionObserver < "u" || Ie(new Set(Oe));
    }, [Oe]);
    const Fe = V(
      () => Pt(y, S, t),
      [y, S, t]
    ), j = V(() => {
      const z = /* @__PURE__ */ new Map();
      for (const G of I) {
        const te = Pt(G, S, t);
        if (!te) continue;
        const le = z.get(te.box.page) || [];
        le.push(te), z.set(te.box.page, le);
      }
      return z;
    }, [t, S, I]), K = V(() => {
      const z = /* @__PURE__ */ new Set();
      if (!b) return z;
      for (const [G, te] of j)
        te.some((le) => le.itemId === b) && z.add(G);
      return z;
    }, [b, j]), ee = V(() => {
      if (W === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Oe);
      if (oe.size === 0) {
        const te = Math.min(W, _n * 2 + 1);
        return new Set(Array.from({ length: te }, (le, ve) => ve + 1));
      }
      const G = /* @__PURE__ */ new Set();
      for (const te of oe)
        for (let le = -_n; le <= _n; le++) {
          const ve = te + le;
          ve >= 1 && ve <= W && G.add(ve);
        }
      return G;
    }, [W, Oe, i, a, oe]), ye = !n || !!E || !!J, De = n && (E || J) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: ce,
        className: `reader-panel ${yn}${a ? "" : " is-hidden"}`,
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
          ye && !k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: De }) : null,
          k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          $ && !E ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            ui,
            {
              file: $,
              loading: null,
              error: null,
              options: fe,
              onLoadSuccess: Ce,
              onLoadError: We,
              className: "reader-react-pdf-document",
              children: Oe.map((z) => {
                if (ee.has(z))
                  return /* @__PURE__ */ p(
                    md,
                    {
                      pane: t,
                      pageNumber: z,
                      width: F,
                      devicePixelRatio: ae,
                      active: me.has(z),
                      textLayer: !$e || B.has(z),
                      syncedMinHeight: (l == null ? void 0 : l.get(z)) || 0,
                      onMetrics: u,
                      cachedAspect: U.get(z),
                      onAspectChange: Le,
                      sentinelRef: ze(z),
                      regionHighlight: (Fe == null ? void 0 : Fe.box.page) === z ? Fe : null,
                      regionTargets: j.get(z),
                      hoveredRegionId: b && K.has(z) ? b : null,
                      onHoverRegion: w,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(z - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(z - 1),
                      showLiveTranslation: R,
                      liveTranslationMissing: vl(v, z - 1)
                    },
                    `${t}-${z}`
                  );
                const te = U.get(z) ?? Ca, le = Math.max(120, Math.floor(F * te)), ve = Math.max(le, Math.ceil((l == null ? void 0 : l.get(z)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: ze(z),
                    [Ee]: z,
                    [ke]: t,
                    [or]: le,
                    className: `${ar} is-placeholder`,
                    style: {
                      width: F,
                      height: ve,
                      minHeight: ve
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: dn,
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
), no = Xt(Id), kd = 2e3, Td = 6, Ed = 500, ro = "reader-react-resizing";
function Pd(e, t) {
  const n = A(null), r = A(null);
  xe(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const w = Rd(e), v = jt(e, w);
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
      v && Rt(e, c, "auto", i);
    }), S = () => {
      var w;
      f && clearTimeout(f), cancelAnimationFrame(u), I == null || I.disconnect(), e.classList.remove(ro);
      for (const v of oo) e.removeEventListener(v, S);
      ((w = r.current) == null ? void 0 : w.stop) === S && (r.current = null);
    }, b = () => {
      Rt(e, c, "auto", i);
      const w = e.scrollHeight;
      g = w === m ? g + 1 : 0, m = w;
      const v = performance.now() - h;
      g >= Td && (w !== d || v > Ed) || v > kd ? S() : u = requestAnimationFrame(b);
    };
    for (const w of oo) e.addEventListener(w, S, { passive: !0 });
    for (const w of Array.from(e.children)) I == null || I.observe(w);
    e.classList.add(ro), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, ma);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Rd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ee}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ke) || null;
  }
  return null;
}
const oo = ["wheel", "touchstart", "keydown", "pointerdown"];
function Md(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function _d(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(yn)) && ((n = e.hasAttribute) != null && n.call(e, ke)));
}
function Nd(e, t) {
  O(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!_d(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${yn}[${ke}]`));
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
const ao = 12;
function dr(e) {
  return Array.from(e.querySelectorAll(`.${yn}[${ke}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Ld(e) {
  const t = e.getBoundingClientRect();
  return dr(e).map((n) => {
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
function Cd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Dd(e, t) {
  return e ? dr(e).find((n) => n.getAttribute(ke) === t) ?? null : null;
}
function $d({ shellEl: e }) {
  const [t, n] = N([]), r = A(0), o = x(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Ld(e);
      n((i) => Cd(i, s) ? i : s);
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
        for (const f of dr(e))
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
  const n = Math.max(0, e.width - ao * 2), r = xd(e, n), o = A(null);
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
      style: { left: e.left + ao, width: n },
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
function Da(e) {
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Da(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Zo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(js, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
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
            /* @__PURE__ */ p(Hs, { size: 13, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(Us, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function so({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = zd(t), a = [e === "compare" ? "对比" : "正在读", r, Da(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
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
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(so, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(so, { role: "reading", ...n }) }) : null
  ] });
}
const jd = () => () => {
}, io = () => null;
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
  const t = Je(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Zt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, I = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, w = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", v = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, T = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, P = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), C = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), _ = t == null ? void 0 : t.onPdfOutline, k = t == null ? void 0 : t.onPdfDocument, E = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), M = e.regions ?? (t == null ? void 0 : t.regions) ?? [], D = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), $ = (t == null ? void 0 : t.regionHover) ?? null, [W, H] = N(null), J = bn(
    $ ? $.subscribe : jd,
    $ ? () => $.get().itemId : io,
    $ ? () => $.get().itemId : io
  ), ue = $ ? J : W, Q = x((de) => {
    $ ? $.set(de, "pdf") : H(de);
  }, [$]), ce = Hd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), Y = Number.isFinite(g) && g > 0 ? Ud(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !ce.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Pd(d, Y), Nd(d, ce.compareMode), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: ia,
      "data-reader-region-count": M.length,
      "data-reader-structured-region-count": M.filter(As).length,
      "data-reader-metadata-ready": D ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${sa} reader-mode-${ce.mode}`,
            "data-reader-mode": ce.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                no,
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
                  liveTranslationPendingLabel: u ? Wd(o) : "",
                  paneAction: u && ce.showTranslated ? /* @__PURE__ */ L(Me, { children: [
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
                no,
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
        /* @__PURE__ */ p($d, { shellEl: d }),
        b ? /* @__PURE__ */ p(Bd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Vd = [
  { id: "source", label: "原文" },
  { id: "compare", label: "对照" },
  { id: "translated", label: "译文" }
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
  const t = Je(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? qd(a.state) : "";
  return /* @__PURE__ */ L("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }),
    /* @__PURE__ */ L("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Vd.map(({ id: l, label: u }) => {
        const f = n === l, d = Jd({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ L(gn, { children: [
          /* @__PURE__ */ p(
            "button",
            {
              type: "button",
              className: `reader-workspace-tab${f ? " is-active" : ""}`,
              role: "tab",
              "aria-selected": f,
              "aria-label": u,
              title: d ? `${u} 需要文档任务` : u,
              disabled: d,
              onClick: () => o(l),
              children: /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: u })
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
              /* @__PURE__ */ p(Ws, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
              /* @__PURE__ */ p(Ks, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(Vs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-end", children: e.end })
  ] });
}
const $a = [];
function Xd() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = $a;
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
const wn = Yt(null), Oa = Yt(null);
function af({ api: e, store: t, children: n }) {
  const r = V(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(wn.Provider, { value: r, children: n });
}
function Qt() {
  const e = ut(wn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const sf = () => () => {
}, co = () => $a;
function cf(e) {
  return bn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function za() {
  var t;
  const e = (t = ut(wn)) == null ? void 0 : t.store;
  return bn((e == null ? void 0 : e.subscribe) ?? sf, (e == null ? void 0 : e.getSnapshot) ?? co, (e == null ? void 0 : e.getSnapshot) ?? co);
}
function Sn(e) {
  var a;
  const t = (a = ut(wn)) == null ? void 0 : a.store, n = ut(Oa);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  O(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), O(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class lf extends Ss {
  constructor() {
    super(...arguments);
    Nr(this, "state", { failed: !1 });
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
const uf = Xt(function({ extensions: t }) {
  return /* @__PURE__ */ p(Me, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(lf, { id: n, children: /* @__PURE__ */ p(df, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function df({ id: e, title: t, children: n }) {
  const r = V(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(Oa.Provider, { value: r, children: n });
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
const lo = 6e3;
function Fa(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Ba(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > lo && (s *= lo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function ja({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = A(null), [i, c] = N({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return O(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = Ba(n, m, r, g), y = s.current, I = y == null ? void 0 : y.getContext("2d");
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
const mf = 1600, fr = { left: 0, top: 0, width: 1, height: 1 };
function Ha(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function hf(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function pf(e, t, n = fr, r = mf) {
  const o = await e.getPage(t), a = Ba(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, Ha(s);
}
async function gf(e, t = fr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), Ha(s);
}
function bf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const yf = 4e3;
function vf(e, t, n) {
  if (e.length) {
    const o = Xl(e, n), a = o ? Ta(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function uo(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ee}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, yf), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function wf(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Pt(i, t, n);
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
  const c = Number(e.getAttribute(Ee)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(ke) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? wf(a, i, l, c, f) : null);
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
function If(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Ee}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Ee)) || 0, i = (o.closest(`[${ke}]`) ?? o).getAttribute(ke) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function kf({ onDone: e, onCancel: t }) {
  const [n, r] = N(null), o = A(null), a = A(null);
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
      return If(c, l);
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
const fo = 5e4, Tf = 2e4;
function Nn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Dg(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Ef(e, t = null) {
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
function Rf(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function $g(e, t) {
  var r;
  const n = Rf(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Og(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function Mf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? _f(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function _f(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Nf(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Mf(e, o.edited_from);
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
function xf(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Nn(e.question.text, fo), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Nn(e.answer.text, fo),
      thought: e.answer.thought ? Nn(e.answer.thought, Tf) : null,
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
const $f = 50, Ua = 2, xn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Of() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function mo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function zf({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = N(!1), [i, c] = N(xn), [l, u] = N(!1), [f, d] = N(""), [m, g] = N("idle"), [h, y] = N(null), [I, S] = N([]), b = x((F) => {
    y(F), S([]);
  }, []), w = x((F) => S((U) => [...U, F].slice(-Ua)), []), [v, R] = N(() => /* @__PURE__ */ new Map()), T = A(/* @__PURE__ */ new Set()), P = A(/* @__PURE__ */ new Map()), C = (F) => {
    if (!F) return null;
    const U = P.current.get(F);
    return U || (_.current.records.some((q) => q.message_id === F) ? F : null);
  }, _ = A(i);
  _.current = i;
  const k = A(t);
  k.current = t;
  const E = A(0), M = x(async (F, U, q, oe = []) => {
    if (!r) return;
    const re = await r.messages(F.conversation_id, { limit: $f, ...q ? { beforeSeq: q } : {} }), me = [...re.messages, ...oe];
    E.current += 1, c({
      conversation: F,
      main: U ?? F,
      records: me,
      compactions: re.compactions || [],
      hasMore: re.has_more,
      key: `${F.conversation_id}:${E.current}`,
      initial: Nf(me, re.compactions || [], k.current.documentId)
    });
  }, [r]), D = x(async () => {
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
  }, [r, M]), $ = x((F) => {
    b(F), D();
  }, [D]), W = A(t.documentId);
  O(() => {
    W.current !== t.documentId && (W.current = t.documentId, _.current = xn, c(xn), b(null), R(/* @__PURE__ */ new Map()), P.current.clear(), a && D());
  }, [t.documentId, a, D]);
  const H = x(async () => {
    const F = _.current, U = F.records[0];
    if (!(!F.conversation || !U || !F.hasMore)) {
      u(!0);
      try {
        await M(F.conversation, F.main, U.seq, F.records);
      } finally {
        u(!1);
      }
    }
  }, [M]), J = x(async (F) => {
    const q = _.current.conversation;
    if (!r || !q) return;
    for (const Z of F.memoryIds) T.current.add(Z);
    let oe = F.memoryIds;
    if (!oe.length && o && F.startedAt) {
      const Z = Lf(
        await o.list({ source_conversation_id: q.conversation_id, created_after: Af(F.startedAt) }).catch(() => []),
        T.current
      );
      for (const B of Z) T.current.add(B.id);
      oe = Z.map((B) => B.id);
      const ge = F.answerId;
      Z.length && ge && R((B) => new Map(B).set(ge, Z));
    }
    const re = xf({ ...F, memoryIds: oe }, k.current.documentId, Of(), C(F.editedFrom));
    let me;
    try {
      me = await r.append(q.conversation_id, re);
    } catch (Z) {
      if (q.kind !== "side" || !/ask_conversation_not_open/.test(mo(Z))) throw Z;
      await r.reopen(q.conversation_id), me = await r.append(q.conversation_id, re);
    }
    const [Ie, se] = me.messages;
    F.questionId && Ie && P.current.set(F.questionId, Ie.message_id), F.answerId && se && P.current.set(F.answerId, se.message_id), c((Z) => {
      var ge;
      return ((ge = Z.conversation) == null ? void 0 : ge.conversation_id) === q.conversation_id ? { ...Z, conversation: me.conversation, records: [...Z.records, ...me.messages] } : Z;
    }), n == null || n(me.messages), me.compaction_due && q.kind === "main" && r.compact(q.conversation_id).catch(() => {
    });
  }, [r, o, n]), ue = x(async (F) => {
    const U = _.current.conversation, q = C(F);
    if (!r || !U || !q) return null;
    try {
      await r.supersede(U.conversation_id, q);
    } catch (me) {
      if (!/ask_message_superseded/.test(mo(me))) throw me;
    }
    const oe = _.current.records.find((me) => me.message_id === q), re = _.current.records.findIndex((me) => me.message_id === q);
    return c((me) => ({ ...me, records: me.records.map((Ie, se) => se >= re && re >= 0 && !Ie.superseded_at ? { ...Ie, superseded_at: "now" } : Ie) })), (oe == null ? void 0 : oe.selection) ?? null;
  }, [r]), Q = x((F) => {
    J(F).catch((U) => d(`这一轮没存上：${U instanceof Error ? U.message : String(U)}`));
  }, [J]), ce = x(async (F) => {
    var oe;
    const U = _.current, q = U.main;
    if (!(!r || !q || ((oe = U.conversation) == null ? void 0 : oe.kind) !== "main")) {
      d("");
      try {
        const re = Cf(U.records, F), me = await r.fork({
          parent_id: q.conversation_id,
          ...re ? { forked_from_message_id: re } : {},
          title: Df(F.text),
          ...k.current.documentId ? { document_id: k.current.documentId } : {}
        });
        await M(me, q);
      } catch (re) {
        d(`开不了副对话：${re instanceof Error ? re.message : String(re)}`);
      }
    }
  }, [r, M]), Se = x(async (F) => {
    const U = _.current.main;
    if (r)
      try {
        await M(await r.get(F), U);
      } catch (q) {
        d(`打不开副对话：${q instanceof Error ? q.message : String(q)}`);
      }
  }, [r, M]), Y = x(async () => {
    const F = _.current.main;
    F && await M(F, F).catch(() => {
    });
  }, [M]), de = x(async () => {
    const F = _.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) !== "side")) {
      g("busy");
      try {
        await r.close(F.conversation_id), g("idle"), await Y();
      } catch {
        g("failed");
      }
    }
  }, [r, Y]), Ae = x(async () => r != null && r.archived ? r.archived(k.current.documentId) : [], [r]), ae = x(async (F) => {
    d(""), b(null);
    try {
      await M(F, _.current.main);
    } catch (U) {
      d(`打不开这个对话：${U instanceof Error ? U.message : String(U)}`);
    }
  }, [M, b]), fe = x(async () => {
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
    close: x(() => s(!1), []),
    loadEarlier: H,
    onTurn: Q,
    rewrite: ue,
    fork: ce,
    openSide: Se,
    backToMain: Y,
    closeSide: de,
    archiveMain: fe,
    listArchived: Ae,
    viewArchived: ae,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function ho(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Ef({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Ff({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = N([]), s = A(0), i = A(r);
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
      (h) => d(h.map((y) => ho(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = x((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => ho(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = x((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Bf = Jo(() => import("./ReaderAskPanel-CvZTCSZ9.js"));
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
  activePanel: y = null,
  panelHost: I = null
}) {
  var Fe;
  const S = V(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), b = x((j, K, ee) => {
    const ye = j ? o.find((G) => G.itemId === j) : null, De = ye ? Pt(ye, a, K) : null, z = De && De.box.page === ee ? pt(De, 1, 1) : null;
    return z ? { x: z.left, y: z.top } : null;
  }, [o, a]), w = Ff({ port: e, documentId: t, resetKey: c, pointOf: b }), v = zf({ port: e, book: S, onAppended: w.addRecords }), [R, T] = N(null), P = x(
    (j, K, ee, ye) => Sf({
      pageElement: (j == null ? void 0 : j.closest(`[${Ee}]`)) ?? null,
      clientX: K,
      clientY: ee,
      itemId: i(),
      selection: ye,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), C = x(() => {
    var K;
    const j = uo(((K = globalThis.getSelection) == null ? void 0 : K.call(globalThis)) ?? null);
    return !j.text || !j.element || !j.rect ? null : P(j.element, j.rect.left + j.rect.width / 2, j.rect.top + j.rect.height / 2, j.text);
  }, [P]), _ = x((j) => {
    T(null), v.ask(j);
  }, [v.ask]);
  O(() => {
    if (!e) return;
    const j = (K) => {
      var De;
      if (K.key !== "?" || K.metaKey || K.ctrlKey || K.altKey || K.defaultPrevented) return;
      const ee = K.target;
      if ((De = ee == null ? void 0 : ee.closest) != null && De.call(ee, "input, textarea, select, [contenteditable='true']")) return;
      const ye = C();
      ye && (K.preventDefault(), K.stopImmediatePropagation(), _(ye));
    };
    return window.addEventListener("keydown", j, !0), () => window.removeEventListener("keydown", j, !0);
  }, [e, C, _]);
  const k = A(/* @__PURE__ */ new Set()), E = ((Fe = v.pending) == null ? void 0 : Fe.selection) || "";
  O(() => {
    E && k.current.add(E);
  }, [E]);
  const M = v.visible && !R, D = v.setPending, [$, W] = N(null), H = !!v.pending;
  O(() => {
    H || W(null);
  }, [H]);
  const J = A(v.pending);
  J.current = v.pending, O(() => {
    if (!M) return;
    let j = null;
    const K = () => {
      j && clearTimeout(j), j = setTimeout(() => {
        const ee = C();
        !ee || k.current.has(ee.selection) || (J.current ? W(ee) : D(ee));
      }, 250);
    };
    return document.addEventListener("selectionchange", K), () => {
      j && clearTimeout(j), document.removeEventListener("selectionchange", K);
    };
  }, [M, C, D]);
  const ue = v.addExtra, Q = v.extras.length, ce = V(() => {
    if (!$) return null;
    const j = () => {
      k.current.add($.selection), W(null);
    };
    return {
      label: `第 ${$.page} 页 · ${[...$.selection].length} 字`,
      replace: () => {
        j(), D($);
      },
      ...Q < Ua ? { add: () => {
        j(), ue($);
      } } : {},
      dismiss: j
    };
  }, [$, Q, D, ue]), Se = A(m);
  Se.current = m;
  const Y = x(async ({ page: j, pane: K, region: ee, canvas: ye }) => {
    const De = Se.current[K];
    let z;
    if (De)
      z = await pf(De, j, ee);
    else {
      const G = ye ?? document.querySelector(`[${ke}="${K}"] [${Ee}="${j}"] canvas`);
      if (!G) throw new Error(`第 ${j} 页还没画出来，翻到那一页再试`);
      z = await gf(G, ee);
    }
    return new File([z], bf(j, ee), { type: "image/png" });
  }, []), [de, Ae] = N(null), ae = A(v.pending);
  ae.current = v.pending;
  const fe = V(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(qs, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const j = ae.current, K = (j == null ? void 0 : j.pane) || (h === "translated" ? "translated" : "source");
      return Y({ page: (j == null ? void 0 : j.page) || g() || 1, pane: K, region: fr });
    }
  }], [Y, g, h]), [F, U] = N(!1), [q, oe] = N(""), re = x(async (j) => {
    U(!1), oe("");
    try {
      const K = await Y(j), ee = P(j.point.target, j.point.x, j.point.y, "");
      Ae((ye) => ({ id: ((ye == null ? void 0 : ye.id) || 0) + 1, files: [K] })), ee ? _({ ...ee, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (K) {
      oe(K instanceof Error ? K.message : String(K));
    }
  }, [Y, P, _]), me = x(() => U(!1), []), Ie = x(() => {
    oe(""), U((j) => !j);
  }, []), se = x(async (j) => {
    if (j.threadId && (e != null && e.threads) && t) {
      try {
        const K = await e.threads.get(t, j.threadId);
        T({ anchor: K.anchor || j.anchor, messages: K.messages || [], mark: j });
      } catch {
        T({ anchor: j.anchor, messages: [], mark: j });
      }
      return;
    }
    T(null), v.openMain();
  }, [e, t, v.openMain]), Z = x((j) => {
    var ye;
    if (!e) return [];
    const K = uo(((ye = globalThis.getSelection) == null ? void 0 : ye.call(globalThis)) ?? null), ee = P(j.target, j.clientX, j.clientY, K.element ? K.text : "");
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
  } : null, B = V(() => f ? (j, K) => {
    f(j, K ?? void 0), requestAnimationFrame(() => d(j, "translated"));
  } : null, [f, d]), ne = x((j) => Pa(o, j), [o]), [he, Le] = N(0), _e = x(({ mode: j, width: K }) => {
    Le(j === "dock" ? Math.round(K) : 0);
  }, []), Pe = !v.persistent || !!v.view.conversation || !!v.error, ze = e && (v.visible && Pe || R) ? /* @__PURE__ */ p(qo, { fallback: null, children: /* @__PURE__ */ p(
    Bf,
    {
      port: e,
      jobId: n,
      book: S,
      ask: v,
      legacy: ge,
      onShowSelection: ({ page: j, pane: K }) => l(j, K),
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
  ) }) : null, $e = F || q ? /* @__PURE__ */ L(Me, { children: [
    F ? /* @__PURE__ */ p(kf, { onDone: (j) => void re(j), onCancel: me }) : null,
    q ? /* @__PURE__ */ L("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => oe(""), children: [
      "截图没成：",
      q
    ] }) : null
  ] }) : null, Ce = v.visible && Pe || !!R, We = v.close, Oe = x(() => {
    if (Ce) {
      T(null), We();
      return;
    }
    v.openMain();
  }, [Ce, We, v.openMain]);
  return { marks: w.marks, onMark: se, menuItems: Z, panel: ze, overlay: $e, cropping: F, toggleCrop: Ie, open: v.openMain, toggle: Oe, showing: Ce, reserveRight: Ce ? he : 0, enabled: !!e };
}
const Hf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Uf() {
  const e = Qt(), t = V(() => {
    try {
      return tt().ask ?? null;
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
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: f, showing: d, reserveRight: m } = n, g = V(() => u ? {
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
    pageLayer: r.length ? ({ page: h, height: y }) => /* @__PURE__ */ p(ff, { marks: r, page: h, height: y, onOpen: o }) : void 0,
    shortcuts: Hf,
    reserveRight: m,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, m, c, l]);
  return Sn(g), /* @__PURE__ */ L(Me, { children: [
    s,
    i
  ] });
}
const Wf = { id: "ask", title: "提问", Component: Uf };
function Kn() {
  try {
    return tt().translationVersions ?? null;
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
  const [n, r] = N([]), [o, a] = N(null);
  O(() => {
    r([]);
    const i = Kn();
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
  return V(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Gf({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = N(null), [s, i] = N(""), [c, l] = N(""), u = A(0);
  O(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = x((g) => {
    const h = Kn(), y = n.find((S) => S.versionId === g);
    if (!h || !y || !e) return;
    const I = ++u.current;
    i(g), l(""), (async () => {
      const S = tt(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const w = await S.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), v = S.resolveReaderTranslatedPdfUrl(w.jobPayload, w.manifestPayload);
      if (!v) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: v, regions: Kf(Xo(w.regionsPayload)) };
    })().then((S) => {
      I === u.current && a(S);
    }).catch((S) => {
      I === u.current && l((S == null ? void 0 : S.message) || "这一份打不开。");
    }).finally(() => {
      I === u.current && i("");
    });
  }, [e, n]), d = x(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), m = x(async () => {
    var y, I;
    const g = Kn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (S) {
      l((S == null ? void 0 : S.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((I = globalThis.history) == null || I.replaceState(globalThis.history.state, "", qf(h, o.jobId))), a(null);
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
function Xf(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Xs,
    place: "compare",
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
  const e = Qt(), t = Gf({
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
    const c = Xf(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Yf(t) };
  }, [t]);
  return Sn(s), null;
}
const Qf = { id: "compare", title: "对比版本", Component: Zf }, Wa = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], po = { pen: 35e-4, highlighter: 0.018 }, go = 0.015, Vn = "retainpdf.reader.ink.v1:";
function bo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Vn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function em(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Vn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Vn + e);
    } catch {
    }
}
function tm(e, t, n, r, o, a) {
  const s = go * go;
  return e.filter((i) => Ka(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Ka(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function nm(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function rm(e) {
  const [t, n] = N(null), [r, o] = N(Wa[0].key), [a, s] = N(() => bo(e)), i = A(a), c = A([]);
  O(() => {
    const h = bo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = x((h) => {
    i.current = h, s(h), em(e, h);
  }, [e]), u = x((h) => {
    const y = i.current, I = h(y);
    I !== y && (c.current = [...c.current.slice(-49), y], l(I));
  }, [l]), f = x((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = x((h) => {
    h.length && u((y) => y.filter((I) => !h.includes(I.id)));
  }, [u]), m = x((h) => {
    u((y) => y.some((I) => I.page === h) ? y.filter((I) => I.page !== h) : y);
  }, [u]), g = x(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return V(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const om = [
  { tool: "pen", label: "画笔", Icon: nr },
  { tool: "highlighter", label: "荧光笔", Icon: Ys },
  { tool: "eraser", label: "橡皮", Icon: Zs }
];
function am(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function sm({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L(Me, { children: [
    om.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    Wa.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(ie, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Qs, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      ie,
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
      ie,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(Nt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function yo({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(sm, { ink: e, page: t, onPick: n }) });
}
function im(e) {
  const t = A(e);
  t.current = e, O(() => {
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
function vo({ stroke: e, width: t, height: n }) {
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
  const [a, s] = N(null), i = A(!1), c = o.strokes.filter((h) => Ka(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(tm(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s([[y, I]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s((S) => S ? nm(S, y, I) : [[y, I]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: po[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
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
        c.map((h) => /* @__PURE__ */ p(vo, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(vo, { stroke: { tool: o.tool, color: o.color, width: po[o.tool], points: a }, width: n, height: r }) : null
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
      Icon: nr,
      // 底栏左右同密度（2026-11-28）：画笔前面是当前笔色的小圆点，不画钢笔线框图。
      mark: /* @__PURE__ */ p("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` }, "aria-hidden": !0 }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p(yo, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(yo, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(um, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: dm
  };
}
function mm() {
  const e = Qt(), t = rm(e.resetKey);
  im(t);
  const n = V(() => fm(t), [t]);
  return Sn(n), null;
}
const hm = { id: "ink", title: "画笔", Component: mm }, pm = Vo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), gm = pm;
function bm(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
const ym = Jo(() => import("./ReaderMarkdownPanel-D5A8XBLU.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Va = { id: "markdown", label: "Markdown", short: "MD", Icon: gm, needsJob: !0 };
function vm() {
  const e = Qt(), t = e.activePanel === Va.id;
  if (!bm(t)) return null;
  const r = /* @__PURE__ */ p(qo, { fallback: null, children: /* @__PURE__ */ p(ym, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? ci(r, e.panelHost) : r;
}
const wm = {
  id: "markdown",
  title: "Markdown",
  Component: vm,
  panels: [Va]
}, qa = "reader-xref", qn = "data-xref", Ft = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Sm = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Ft})`), Im = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Jn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function km(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Tm(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Em(e, t, n) {
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
function Pm(e, t, n) {
  return (e.find((o) => He(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Rm(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = He(r), s = Tm(r);
    if (a === "formula") {
      for (const g of s.matchAll(Im)) {
        const h = Jn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Sm.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = km(i[1]), u = Jn(i[2]), f = Em(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Pm(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Mm = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Ft})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Ft})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Ft})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Ft})\s*[）)]`, "g"), kind: () => "equation" }
];
function _m(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Mm) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Jn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function Nm(e, t) {
  return _m(e, t).map((n) => ({ start: n.start, end: n.end, className: qa, attrs: { [qn]: n.key } }));
}
const xm = { figure: "图", table: "表", equation: "式" };
function wo(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${xm[e.kind]} ${e.label}`;
}
const So = { figure: "图", table: "表", formula: "公式", text: "文字" }, nt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Am(e, t, n) {
  const r = Pt(e, t, n), o = r ? pt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Fa({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Lm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = Pt(u, t, n), d = f ? pt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Fa({ left: o, top: a, width: s - o, height: i - a });
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
  var C;
  const i = t.find((_) => _.itemId === e) ?? null, c = V(() => i ? Dm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = N(nt.indexOf(1)), d = nt[u], m = A(null), [g, h] = N(0);
  xe(() => {
    const _ = m.current;
    if (!_) return;
    const k = () => h(_.clientWidth);
    k();
    const E = typeof ResizeObserver == "function" ? new ResizeObserver(k) : null;
    return E == null || E.observe(_), () => E == null ? void 0 : E.disconnect();
  }, []);
  const y = x((_) => {
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
        k.preventDefault(), f((E) => Math.min(nt.length - 1, E + 1));
      else if (k.key === "-" || k.key === "_")
        k.preventDefault(), f((E) => Math.max(0, E - 1));
      else if (k.key === "0")
        k.preventDefault(), f(nt.indexOf(1));
      else
        return;
      k.stopPropagation();
    };
    return window.addEventListener("keydown", _, !0), () => window.removeEventListener("keydown", _, !0);
  }, [s, y]), O(() => {
    const _ = m.current;
    if (!_) return;
    const k = (E) => {
      !E.ctrlKey && !E.metaKey || (E.preventDefault(), f((M) => Math.max(0, Math.min(nt.length - 1, M + (E.deltaY < 0 ? 1 : -1)))));
    };
    return _.addEventListener("wheel", k, { passive: !1 }), () => _.removeEventListener("wheel", k);
  }, []);
  const I = A(null);
  if (!i) return null;
  const S = He(i), b = o.map((_) => ({ pane: _, pdf: r[_] ?? null, where: Am(i, n, _) })).filter((_) => !!(_.pdf && _.where)), w = 16, v = typeof window > "u" ? 800 : window.innerHeight, R = Math.min(880, v * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), T = b.length ? Cm(Math.max(120, (g - w * (b.length - 1) - 32) / b.length), R, b.map((_) => _.where.aspect)) : 0, P = ((C = b[0]) == null ? void 0 : C.where.page) ?? i.source.page;
  return /* @__PURE__ */ L("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${So[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ L("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ L("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ L("span", { className: "reader-zoom-title", children: [
          So[S] ?? "这一块",
          " · 第 ",
          P,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ L("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Yo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(Qo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((_) => Math.max(0, _ - 1)), children: /* @__PURE__ */ p(ea, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ L(ie, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(nt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === nt.length - 1, onClick: () => f((_) => Math.min(nt.length - 1, _ + 1)), children: /* @__PURE__ */ p(ta, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(lt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(Nt, { size: 16, "aria-hidden": !0 }) })
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
              ja,
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
  return /* @__PURE__ */ L("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ L("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: wo(e.target) }),
      /* @__PURE__ */ L("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(ja, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: wo(e.target) })
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
  const [o, a] = N(null), [s, i] = N({ back: [], forward: [] }), c = A(s);
  c.current = s;
  const l = A(null), u = A({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = x(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return jt(m, g);
  }, []);
  O(() => {
    if (!e) return;
    const m = (b) => {
      var w, v;
      return (v = (w = b.target) == null ? void 0 : w.closest) == null ? void 0 : v.call(w, `.${qa}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var T;
      const w = m(b);
      if (!w) return;
      const v = u.current.index.get(w.getAttribute(qn) || "");
      if (!v) return;
      const R = ((T = w.closest("[data-reader-pane]")) == null ? void 0 : T.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const P = w.getBoundingClientRect();
        a({ target: v, pane: R, anchor: { left: P.left, top: P.top, right: P.right, bottom: P.bottom } });
      }, jm);
    }, y = (b) => {
      const w = m(b);
      !w || w.contains(b.relatedTarget) || (g(), a(null));
    }, I = (b) => {
      var P, C;
      const w = m(b);
      if (!w || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((P = window.getSelection) == null ? void 0 : P.call(window)) || ""}`.trim()) return;
      const v = u.current.index.get(w.getAttribute(qn) || "");
      if (!v) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const R = ((C = w.closest("[data-reader-pane]")) == null ? void 0 : C.getAttribute("data-reader-pane")) || u.current.primaryPane, T = f();
      T && i((_) => Hm(_, T)), u.current.follow(v, R);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", I, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", I, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = x((m) => {
    const g = f();
    if (!g) return !1;
    const h = Um(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: I } = u.current;
    return Rt(y, h.to, "auto", I) ? (i(h.history), !0) : !1;
  }, [f]);
  return O(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Wm(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [d]), {
    preview: o,
    closePreview: x(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: x(() => d("back"), [d])
  };
}
const Vm = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function qm() {
  const e = Qt(), t = V(() => Rm(e.regions), [e.regions]), { jumpToBlock: n } = e, r = x((s, i) => n(s.itemId, i), [n]), o = Km({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = V(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => Nm(s, t) : void 0,
    shortcuts: Vm
  }), [t]);
  return Sn(a), /* @__PURE__ */ L(Me, { children: [
    o.preview ? /* @__PURE__ */ p(Bm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ L(ie, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(ti, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const Jm = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: qm }, mr = [hm, wm, Qf, Jm, Wf];
function hr(e = mr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Gm(e) {
  const t = Je(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Me, { children: (e.tabs ?? hr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
function Xm(e) {
  const t = Je(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = hr().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
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
        children: /* @__PURE__ */ p(Nt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
function Bt({
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
function Gn(e) {
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
      const u = Bt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Ne(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Bt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ne(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Bt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ne(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Bt({
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
function Xn(e, t) {
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
function Ja(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Ga(e, t) {
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
    const { x: i, y: c } = Ga(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return pe(o, "No rect found"), o;
}
let on;
function ah() {
  return on === void 0 && (typeof matchMedia == "function" ? on = !!matchMedia("(pointer:coarse)").matches : on = !1), on;
}
function Xa(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Xn(
    n,
    Array.from(t.children).filter(Ja).map((g) => ({ element: g }))
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
                  const R = m[0], T = oh({
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
              const R = ah() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
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
                groupSize: Mt({ group: e }),
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
class Ya {
  constructor() {
    Ar(this, ot, {});
  }
  addListener(t, n) {
    const r = xt(this, ot)[t];
    return r === void 0 ? xt(this, ot)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = xt(this, ot)[t];
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
    Lr(this, ot, {});
  }
  removeListener(t, n) {
    const r = xt(this, ot)[t];
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
const pr = new Ya();
function ft() {
  return Tt;
}
function sh(e) {
  return pr.addListener("change", e);
}
function ih(e) {
  const t = Tt, n = { ...Tt };
  n.cursorFlags = e, Tt = n, pr.emit("change", {
    prev: t,
    next: n
  });
}
function Et(e) {
  const t = Tt;
  Tt = e, pr.emit("change", {
    prev: t,
    next: e
  });
}
const ch = (e) => e, An = () => {
}, Za = 1, Qa = 2, es = 4, ts = 8, Io = 3, ko = 12;
let an;
function To() {
  return an === void 0 && (an = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (an = !0)), an;
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
        if (e && To()) {
          const a = (e & Za) !== 0, s = (e & Qa) !== 0, i = (e & es) !== 0, c = (e & ts) !== 0;
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
    return To() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Eo = /* @__PURE__ */ new WeakMap();
function gr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Eo.get(e) ?? {};
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
  Eo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ve = /* @__PURE__ */ new Map();
const ns = new Ya();
function uh(e) {
  Ve = new Map(Ve), Ve.delete(e);
}
function Po(e, t) {
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
function br(e, t) {
  return ns.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function et(e, t, n) {
  const r = Ve.get(e);
  Ve = new Map(Ve), Ve.set(e, t), ns.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function rs(e) {
  const t = ft();
  let n = !1;
  switch (t.state) {
    case "active":
      Et({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (gr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = st(r.group.id, !0);
        et(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Ro(e) {
  e.defaultPrevented || rs(e.currentTarget);
}
function dh(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Ga(n, a.rect);
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
    a: No(e),
    b: No(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  pe(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: _o(Mo(n.a)),
    b: _o(Mo(n.b))
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
  const t = getComputedStyle(os(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function gh(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || ph(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || hh.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Mo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (pe(n, "Missing node"), gh(n)) return n;
  }
  return null;
}
function _o(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function No(e) {
  const t = [];
  for (; e; )
    t.push(e), e = os(e);
  return t;
}
function os(e) {
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
  if (!Ja(n) || n.contains(e) || e.contains(n))
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
function yr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Xa(o), s = dh(o.orientation, a, {
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
  if (Ke(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Ke(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Ne(r), r;
}
function qt({
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
          ), Re(w, I)) {
            const v = b - w;
            Ke(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
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
          ), Re(w, b)) {
            const v = w - I;
            Ke(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
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
      if (S && Ke(I, w) < 0)
        if (e > 0) {
          const v = w - b, R = v / 2, T = I + e;
          Ke(T, w) < 0 && (e = Ke(e, R) <= 0 ? 0 : v);
        } else {
          const v = w - b, R = 100 - v / 2, T = I - e;
          Ke(T, w) < 0 && (e = Ke(100 + e, R) > 0 ? 0 : -v);
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
      const w = It({
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
      const S = I - y, b = It({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: I,
        size: S
      });
      if (!Re(I, b) && (d += I - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (vh(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    pe(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const I = y + d, S = It({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: I
    });
    if (l[h] = S, !Re(S, I)) {
      let b = I - S, w = e < 0 ? f : u;
      for (; w >= 0 && w < n.length; ) {
        const v = l[w];
        pe(
          v != null,
          `Previous layout not found for panel index ${w}`
        );
        const R = v + b, T = It({
          overrideDisabledPanels: s,
          panelConstraints: n[w],
          prevSize: v,
          size: R
        });
        if (Re(v, T) || (b -= T - v, l[w] = T), Re(b, 0))
          break;
        e > 0 ? w-- : w++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!Re(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, I) => (h[g[I]] = y, h), {});
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
    const u = It({
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
      const l = c + a, u = It({
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
function as({
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
    if (h && c < d && (g || l.slice(0, m).every((y, I) => {
      const S = f[I];
      return (S == null ? void 0 : S.collapsible) && Re(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = l.slice(0, m).reduce((I, S) => I + u[S.id], 0);
      return {
        ...u,
        [t]: Ne(100 - y)
      };
    }
    return qt({
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
    mt(g, I) || et(d, {
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
      return c && Re(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = Mt({ group: l }), d = Bt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ne(d / f * 100);
      i(m);
    }
  };
}
function xo(e) {
  if (e.defaultPrevented)
    return;
  const t = gt();
  yr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = as({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function sn(e) {
  const t = gt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function ss({
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
      return r ? i : (mt(i, l) || et(a, {
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
  const n = sn(e), r = st(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  pe(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  pe(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = ss({ groupId: n.id }).getLayout(), c = qt({
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
  mt(i, l) || et(
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
function Ao(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = sn(t);
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
        const r = sn(t), o = st(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
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
        const r = sn(t).separators.map(
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
function Lo(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = gt(), n = yr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Et({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function is({
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
      const T = qt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((P) => m.indexOf(P)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (mt(T, v)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Za : Qa;
              break;
            }
            case "vertical": {
              i |= h < 0 ? es : ts;
              break;
            }
          }
      } else
        et(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: w,
          layout: T,
          separatorToPanels: R
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & Io : c |= i & Io, t.movementY === 0 ? c |= s & ko : c |= i & ko, ih(c), gr(e);
}
function Co(e) {
  const t = gt(), n = ft();
  switch (n.state) {
    case "active":
      is({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Do(e) {
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
        Et({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = st(a.group.id, !0);
          et(a.group, s, {
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
      is({
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
      const a = yr(e, n);
      a.length === 0 ? t.state !== "inactive" && Et({
        cursorFlags: 0,
        state: "inactive"
      }) : Et({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), gr(e.currentTarget);
      break;
    }
  }
}
function $o(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (ft().state) {
      case "hover":
        Et({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Oo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || rs(e.currentTarget) && e.preventDefault();
}
function zo(e) {
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
function Ih({
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
function Th(e) {
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
          const S = Mt({ group: e });
          if (S === 0)
            return;
          const b = st(e.id);
          if (!b)
            return;
          const w = Gn(e), v = b.defaultLayoutDeferred ? zo(w) : b.layout, R = Ih({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: v
          }), T = ht({
            layout: R,
            panelConstraints: w
          });
          if (!b.defaultLayoutDeferred && mt(b.layout, T) && Sh(
            b.derivedPanelConstraints,
            w
          ) && b.groupSize === S)
            return;
          et(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: w,
            groupSize: S,
            layout: T,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        wh(e, I, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    pe(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Mt({ group: e }), i = Gn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (kh(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? zo(i), f = ht({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  vt.set(
    d,
    (vt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Xa(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), et(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    pe(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Ao);
  }), vt.get(d) === 1 && (d.addEventListener("contextmenu", Ro, !0), d.addEventListener("dblclick", xo, !0), d.addEventListener("pointerdown", Lo, !0), d.addEventListener("pointerleave", Co), d.addEventListener("pointermove", Do), d.addEventListener("pointerout", $o), d.addEventListener("pointerup", Oo, !0)), function() {
    t = !1, vt.set(
      d,
      Math.max(0, (vt.get(d) ?? 0) - 1)
    ), uh(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Ao);
    }), vt.get(d) || (d.removeEventListener(
      "contextmenu",
      Ro,
      !0
    ), d.removeEventListener(
      "dblclick",
      xo,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Lo,
      !0
    ), d.removeEventListener("pointerleave", Co), d.removeEventListener("pointermove", Do), d.removeEventListener("pointerout", $o), d.removeEventListener("pointerup", Oo, !0)), a.disconnect();
  };
}
function Eh() {
  const [e, t] = N({}), n = x(() => t({}), []);
  return [e, n];
}
function vr(e) {
  const t = Go();
  return `${e ?? t}`;
}
const bt = typeof window < "u" ? xe : O;
function Ht(e) {
  const t = A(e);
  return bt(() => {
    t.current = e;
  }, [e]), x(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function wr(...e) {
  return Ht((t) => {
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
function Sr(e) {
  const t = A({ ...e });
  return bt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const cs = Yt(null);
function Ph(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: ch
  });
  tr(t, () => n.current, []), bt(() => {
    Object.assign(
      n.current,
      ss({ groupId: e })
    );
  });
}
function ls({
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
  }), h = Ht((k) => {
    mt(g.current.onLayoutChange, k) || (g.current.onLayoutChange = k, c == null || c(k));
  }), y = Ht(
    (k, E) => {
      mt(g.current.onLayoutChanged, k) || (g.current.onLayoutChanged = k, l == null || l(k, { isUserInteraction: E }));
    }
  ), I = vr(i), S = A(null), [b, w] = Eh(), v = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), R = wr(S, a);
  Ph(I, s);
  const T = Ht(
    (k, E) => {
      const M = ft(), D = Po(k), $ = st(k);
      if ($) {
        let W = !1;
        switch (M.state) {
          case "active": {
            W = M.hitRegions.some(
              (H) => H.group === D
            );
            break;
          }
        }
        return {
          flexGrow: $.layout[E] ?? 1,
          pointerEvents: W ? "none" : void 0
        };
      }
      if (n != null && n[E])
        return {
          flexGrow: n == null ? void 0 : n[E]
        };
    }
  ), P = Sr({
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
        return E.panels = Xn(u, [
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
        return E.separators = Xn(u, [
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
          (W) => W.id === k
        );
        M && (M.panelConstraints.disabled = E);
        const D = Po(I), $ = st(I);
        D && $ && et(D, {
          ...$,
          derivedPanelConstraints: Gn(D)
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
  ), _ = A(null);
  return bt(() => {
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
    const $ = Th(D), { defaultLayoutDeferred: W, derivedPanelConstraints: H, layout: J } = st(D.id, !0);
    !W && H.length > 0 && (h(J), y(J, !1));
    const ue = br(I, (Q) => {
      const { defaultLayoutDeferred: ce, derivedPanelConstraints: Se, layout: Y } = Q.next;
      if (ce || Se.length === 0)
        return;
      const de = D.panels.map(({ id: ae }) => ae).join(",");
      D.mutableState.layouts[de] = Y, Se.forEach((ae) => {
        if (ae.collapsible) {
          const { layout: fe } = Q.prev ?? {};
          if (fe) {
            const F = Re(
              ae.collapsedSize,
              Y[ae.panelId]
            ), U = Re(
              ae.collapsedSize,
              fe[ae.panelId]
            );
            F && !U && (D.mutableState.expandedPanelSizes[ae.panelId] = fe[ae.panelId]);
          }
        }
      });
      const Ae = ft().state !== "active";
      h(Y), Ae && y(Y, Q.isUserInteraction);
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
  }), /* @__PURE__ */ p(cs.Provider, { value: C, children: /* @__PURE__ */ p(
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
ls.displayName = "Group";
function Ir() {
  const e = ut(cs);
  return pe(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Rh(e, t) {
  const { id: n } = Ir(), r = A({
    collapse: An,
    expand: An,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: An
  });
  tr(t, () => r.current, []), bt(() => {
    Object.assign(
      r.current,
      as({ groupId: n, panelId: e })
    );
  });
}
function Yn({
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
  const h = !!c, y = vr(c), I = Sr({
    disabled: a
  }), S = A(null), b = wr(S, s), {
    getPanelStyles: w,
    id: v,
    orientation: R,
    registerPanel: T,
    updatePanelProps: P
  } = Ir(), C = f !== null, _ = Ht(
    (D, $, W) => {
      f == null || f(D, c, W);
    }
  );
  bt(() => {
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
  }, [a, y, P]), Rh(y, d);
  const k = () => {
    const D = w(v, y);
    if (D)
      return JSON.stringify(D);
  }, E = bn(
    (D) => br(v, D),
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
        ...Mh,
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
Yn.displayName = "Panel";
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
function _h({
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
      layout: qt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = ht({
      layout: qt({
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
function us({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = vr(a), l = Sr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = N({}), [d, m] = N("inactive"), [g, h] = N(!1), y = A(null), I = wr(y, o), {
    disableCursor: S,
    id: b,
    orientation: w,
    registerSeparator: v,
    updateSeparatorProps: R
  } = Ir(), T = w === "horizontal" ? "vertical" : "horizontal";
  bt(() => {
    const _ = y.current;
    if (_ !== null) {
      const k = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: _,
        id: c
      }, E = v(k), M = sh(
        ($) => {
          m(
            $.next.state !== "inactive" && $.next.hitRegions.some(
              (W) => W.separator === k
            ) ? $.next.state : "inactive"
          );
        }
      ), D = br(
        b,
        ($) => {
          const { derivedPanelConstraints: W, layout: H, separatorToPanels: J } = $.next, ue = J.get(k);
          if (ue) {
            const Q = ue[0], ce = ue.indexOf(Q);
            f(
              _h({
                layout: H,
                panelConstraints: W,
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
us.displayName = "Separator";
const kr = 30, Tr = 65, Jt = 50, Nh = 100 - Tr, xh = 100 - kr;
function Ah(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Tr, Math.max(kr, t)) : Jt;
}
function Er(e) {
  return 100 - e;
}
function wt(e) {
  return `${e}%`;
}
const Pr = "reader-document", Gt = "reader-assistant", ds = "retainpdf.reader.ai-split-layout.v1", Lh = {
  [Pr]: Er(Jt),
  [Gt]: Jt
};
function Rr(e) {
  const t = Ah(e == null ? void 0 : e[Gt]);
  return {
    [Pr]: Er(t),
    [Gt]: t
  };
}
function Ch() {
  try {
    const e = JSON.parse(localStorage.getItem(ds) || "null");
    return Rr(e);
  } catch {
    return Lh;
  }
}
function Dh(e) {
  try {
    localStorage.setItem(ds, JSON.stringify(Rr(e)));
  } catch {
  }
}
function Ln(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Rr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Gt]}vw`
  );
}
function $h() {
  const e = A(null), [t] = N(Ch);
  xe(() => {
    const o = e.current;
    return Ln(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = x((o) => {
    Ln(e.current, o);
  }, []), r = x((o, a) => {
    Ln(e.current, o), a.isUserInteraction && Dh(o);
  }, []);
  return /* @__PURE__ */ L(
    ls,
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
          Yn,
          {
            id: Pr,
            defaultSize: wt(Er(Jt)),
            minSize: wt(Nh),
            maxSize: wt(xh)
          }
        ),
        /* @__PURE__ */ p(
          us,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Yn,
          {
            id: Gt,
            defaultSize: wt(Jt),
            minSize: wt(kr),
            maxSize: wt(Tr)
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
function zh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Oh, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(Me, { children: [
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
function Fh(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Bh() {
  const [e, t] = N(!1), n = Go(), r = A(null), o = za(), a = V(() => [...Al, ...of(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Fh(i.target)) return;
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
        children: /* @__PURE__ */ p("span", { className: "reader-react-shortcuts-mark", "aria-hidden": !0, children: "?" })
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
const jh = ["source", "sideBySide", "translated"], Hh = { source: "", translated: "", sideBySide: "" };
function Uh(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = cn(e.sourceUrl), n = cn(e.translatedUrl);
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
function Wh(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = V(
    () => e ? Uh(e) : Hh,
    [e]
  ), o = V(
    () => jh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = x(async (s) => {
    if (!e) return;
    const i = cn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Ii(s, {
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
        Ei(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Kh = {
  source: ai,
  sideBySide: oi,
  translated: ri
}, Vh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function qh(e) {
  const t = Je(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Wh(n), i = A(null);
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
      /* @__PURE__ */ p(ni, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = Ts[c], u = cn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : Es(c, r), g = Kh[c];
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
function Mr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function fs(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Jh}${t}` : "";
}
function Xh(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Ut(e, t = Mr()) {
  const n = fs(e);
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
const Zn = /* @__PURE__ */ new Set();
function Yh(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return Zn.add(n), () => {
    Zn.delete(n);
  };
}
function Qn(e, t, n) {
  const r = fs(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Gh);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...Zn]) a(e);
  return o;
}
function Zh(e, t, n = "", { storage: r = Mr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Ut(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Qn(e, a.filter((i) => i.page !== s), r) : Qn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Qh(e, t, n = Mr()) {
  return Qn(e, Ut(e, n).filter((r) => r.page !== t), n);
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
function ms(e, t) {
  const [n, r] = N(() => Ut(e));
  O(() => (r(Ut(e)), Yh(e, () => r(Ut(e)))), [e]);
  const o = x((s) => {
    r(Zh(e, s, ep(t, s)));
  }, [e, t]), a = x((s) => r(Qh(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
function tp({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "14", height: "14", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function np({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = ms(e, r);
  if (!e || n <= 0) return null;
  const s = Math.min(Math.max(t, 1), n), i = o.some((c) => c.page === s);
  return /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", children: [
    /* @__PURE__ */ L(
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
  const [e, t] = N(!1), n = A(null);
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
    /* @__PURE__ */ L(
      ie,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": e,
        "aria-haspopup": "dialog",
        title: "收藏（还在做）",
        onClick: () => t((r) => !r),
        children: [
          /* @__PURE__ */ p(si, { size: 14, strokeWidth: 2, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-bottombar-label", children: "收藏" })
        ]
      }
    ),
    e ? /* @__PURE__ */ L("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ p("strong", { children: "收藏" }),
      /* @__PURE__ */ p("p", { children: "还在做：以后可以把喜欢的段落、整页收在这里，按书分好，随时翻回来。现在先用「书签」记页。" })
    ] }) : null
  ] });
}
function op(e) {
  const t = Je(), n = ur(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Zt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = fc(a), f = a > la + 1e-3, d = a < hn - 1e-3, m = St(r, kt()), g = m >= hn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, y] = N(!1), [I, S] = N(`${i}`);
  O(() => {
    h || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const w = Number(`${I}`.trim());
    l(pn(w, c));
  };
  return /* @__PURE__ */ L("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ L("div", { className: "reader-bottombar-start", children: [
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
          children: /* @__PURE__ */ p(ap, {})
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
            onClick: () => s(Vt(a, -1)),
            children: /* @__PURE__ */ p(ea, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
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
            onClick: () => s(Vt(a, 1)),
            children: /* @__PURE__ */ p(ta, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ L("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Bh, {}) })
    ] })
  ] });
}
function ap() {
  return /* @__PURE__ */ L("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function Fo(e) {
  var t, n;
  return ha(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function sp(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Fo(qe(e))
  }));
  O(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Fo(qe(e))
    });
  }, [e]), O(() => {
    t.scope === e && vn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = x((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const er = "download-toast";
function ip({
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
    $n.dismiss(er);
    return;
  }
  $n.custom(
    () => /* @__PURE__ */ p(ip, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: er, duration: 1 / 0 }
  );
}
function lp() {
  const e = x((t) => {
    t && (t.setState = cp, t.hide = () => $n.dismiss(er));
  }, []);
  return /* @__PURE__ */ L(Me, { children: [
    /* @__PURE__ */ p($s, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Bo = { itemId: null, origin: null };
function up() {
  let e = Bo;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Bo : { itemId: n, origin: r };
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
const jo = ["ask"];
function dp(e) {
  const t = (n) => {
    const r = jo.indexOf(n.id);
    return r < 0 ? jo.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function Cn({
  place: e,
  active: t = null,
  extensions: n = mr
}) {
  const r = e === "top" ? dp(n) : n, [o, a] = N(null), s = za(), i = (d) => {
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
    const m = i(d.id), g = e === "top" ? hr([d]) : [];
    return !m.length && !g.length ? null : /* @__PURE__ */ L(gn, { children: [
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
              children: e === "compare" ? /* @__PURE__ */ p(ln, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ L(Me, { children: [
                h.mark ?? /* @__PURE__ */ p(I, { size: e === "bottom" ? 14 : 15, strokeWidth: 2.1, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-bar-tool-label", children: h.label })
              ] })
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
              children: /* @__PURE__ */ p(ln, { size: 12, strokeWidth: 2.2, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(Gm, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ L("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "top" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const Ho = { search: "搜索", bookmarks: "书签", issues: "待改" }, fp = [];
function mp({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ L(ie, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(na, { size: 14, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-finder-toggle-label", children: "搜索" }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
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
  pinned: c = !1,
  bookmarkPane: l,
  issuesPane: u,
  issueCount: f = 0
}) {
  var T;
  const d = ((T = Je()) == null ? void 0 : T.regions) ?? fp, m = V(() => iu(d, s), [d, s]), [g, h] = N(-1);
  O(() => h(-1), [s]);
  const y = A(null), I = A(null), S = A(n);
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
  const b = A(null);
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
  return /* @__PURE__ */ L("aside", { ref: I, className: "reader-finder", "data-finder-tab": R, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${Ho[R]}`, children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: v.map((P) => /* @__PURE__ */ L(ie, { className: "reader-finder-tab", role: "tab", "aria-selected": R === P, onClick: () => t(P), children: [
        Ho[P],
        P === "issues" && f ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, P)) }),
      /* @__PURE__ */ p(ie, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(Nt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    R === "bookmarks" ? l : R === "issues" ? u : null,
    R !== "search" ? null : /* @__PURE__ */ L(Me, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          rr,
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
              P.key === "Enter" ? (P.preventDefault(), w(cu(g, m.length, P.shiftKey))) : P.key === "Escape" && (P.preventDefault(), c ? P.currentTarget.blur() : n()), P.stopPropagation();
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
function hs(e, t = []) {
  for (const n of e)
    t.push(n), hs(n.children, t);
  return t;
}
const pp = 24, $t = 28, Uo = 15;
function ps(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function gp(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: hs(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function bp(e, t) {
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
function yp(e, t) {
  const n = ps(e) > pp, r = Math.max(1, Math.ceil(e.length / $t)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= $t) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor($t / 2)), o.length - $t);
  return o.slice(s, s + $t);
}
function vp(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const wp = [];
function Sp({ bookmarks: e, onJumpPage: t, onJumpBlock: n }) {
  var v, R;
  const r = ((v = Je()) == null ? void 0 : v.regions) ?? wp, o = ((R = ur()) == null ? void 0 : R.currentPage) ?? 1, a = V(() => gp(e, ou(r)), [e, r]), s = V(() => bp(a, o), [a, o]), i = V(() => yp(a, s), [a, s]), c = ps(a), [l, u] = N(""), f = V(() => vp(a, l), [a, l]), [d, m] = N(() => /* @__PURE__ */ new Set()), g = A(null), h = A(!1), y = () => {
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
        /* @__PURE__ */ L("div", { className: "reader-toc-card", "data-compact": c <= Uo ? "true" : void 0, children: [
          c > Uo ? /* @__PURE__ */ L("div", { className: "reader-toc-filter", children: [
            /* @__PURE__ */ p(na, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ p(
              rr,
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
            l ? /* @__PURE__ */ p(ie, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => u(""), children: /* @__PURE__ */ p(Nt, { size: 12, "aria-hidden": !0 }) }) : null
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
                    children: P ? /* @__PURE__ */ p(ln, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(Qo, { size: 12, "aria-hidden": !0 })
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
function Ip(e) {
  const [t, n] = N([]);
  return O(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = tt().loadIssues;
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
function kp(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Tp = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Ep = ["failed", "content", "layout"];
function Pp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Rp(e, t, n) {
  const r = Ip(e), [o, a] = N(-1);
  O(() => a(-1), [r]);
  const s = x((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = A({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, O(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || Pp(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = kp(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function Mp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function _p(e) {
  var r;
  if (e.shiftKey || Mp(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${ia}`))) return null;
  const n = Number((r = t.closest(`[${Ee}]`)) == null ? void 0 : r.getAttribute(Ee)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Np({
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
    r.map((c) => /* @__PURE__ */ p(gn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function xp({ edit: e }) {
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
const gs = "retainpdf:reader:doc-theme:v1", Wo = "data-reader-doc";
function bs() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ap(e = bs()) {
  try {
    return (e == null ? void 0 : e.getItem(gs)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Lp(e, t = bs()) {
  try {
    t == null || t.setItem(gs, e);
  } catch {
  }
}
function Ko(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Wo, "dark") : t.removeAttribute(Wo));
}
function Cp() {
  const [e, t] = N(() => Ap());
  O(() => {
    Ko(e);
  }, [e]), O(() => () => Ko("light"), []);
  const n = x(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Lp(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function Dp({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = ms(e, t);
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
function $p({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ L("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    Ep.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ L("h4", { children: [
          Tp[o],
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
function Op({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: f } = e, d = Je(), m = ur(), g = (m == null ? void 0 : m.currentPage) ?? 1, h = n.issues.length;
  return /* @__PURE__ */ p(Me, { children: r ? /* @__PURE__ */ p(
    hp,
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
        Dp,
        {
          scope: t,
          regions: d == null ? void 0 : d.regions,
          currentPage: g,
          numPages: (m == null ? void 0 : m.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: h ? /* @__PURE__ */ p($p, { nav: n }) : void 0,
      issueCount: h
    }
  ) : null });
}
function zp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(Me, { children: n ? /* @__PURE__ */ p(
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
function Fp(e) {
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
const Bp = 720;
function jp(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Bp;
}
function Hp(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Up(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = N(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Fp({
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
  O(() => {
    a(!1);
  }, [e.viewStateKey]), O(() => {
    e.session.jobTerminal && a(!1);
  }, [e.session.jobTerminal]);
  const f = A(null);
  return O(() => {
    f.current !== e.viewStateKey && wl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function Wp(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = yl(e.liveTranslation), i = x(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = N(null);
  O(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && Sl({
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
function Kp() {
  const [e] = N(Xd), t = cf(e), n = nf(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function Vp(e, t, n) {
  const r = A(e);
  O(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function qp(e, t, {
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
  const y = x(() => h.current, []), I = V(() => ({
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
  ]), { contributionStore: S, contributions: b, reserveRight: w } = t, v = V(() => Zd(b), [b]), R = V(() => rf(b), [b]), T = V(() => tf(b), [b]), P = V(() => Qd(b), [b]), C = ef(b);
  return { readerApi: I, contributionStore: S, contributions: b, pageLayers: v, compareVersion: R, textMarks: T, menuSections: P, pointerTakenId: C, reserveRight: w };
}
function Jp() {
  try {
    return tt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Gp = "这本书正在处理（翻译或排版），处理完才能改。", Xp = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Yp({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Jp(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = du(s), l = !t || Wt(t), u = bu(n), [f, d] = N(""), [m, g] = N(null), [h, y] = N(() => /* @__PURE__ */ new Map()), [I, S] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, w] = N(() => /* @__PURE__ */ new Map()), [v, R] = N({ phase: "idle" }), T = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  O(() => {
    g(null), T.drafts.clear(), T.generation.current = null, w(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), O(() => {
    if (d(""), !i || c || !a) return;
    let $ = !1;
    return a.resolveOwnerJobId(s).then((W) => {
      $ || d(`${W || s}`.trim() || s);
    }).catch(() => {
      $ || d(s);
    }), () => {
      $ = !0;
    };
  }, [i, c, a, s]), O(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let $ = !1;
    return a.fetchRevisions(f).then((W) => {
      $ || y(yu(W, u));
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
      for (const [W, H] of I.edits) $.set(W, H);
    return $;
  }, [h, I, u]), _ = x(($) => {
    const W = `${$ || ""}`.trim();
    W && g({ itemId: W, page: fu(W) });
  }, []), k = x(() => g(null), []), E = x(($, W) => {
    S((H) => {
      const J = new Map(H.renderedAt === u ? H.edits : []);
      return J.set($, W), { renderedAt: u, edits: J };
    }), w((H) => new Map(H).set($, (H.get($) || 0) + 1));
  }, [u]), M = x(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch ($) {
        R({ phase: "failed", message: ($ == null ? void 0 : $.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), D = c ? Xp : !l || v.phase === "running" || v.phase === "submitting" ? Gp : "";
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
function Zp(e, t) {
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
function Qp(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Yp({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = x((d, m) => {
    Pa(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  Zp(a.available ? u : null, n);
  const f = V(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const eg = "reader-finder-input";
function tg(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function ng(e, t = typeof window > "u" ? null : window) {
  O(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!tg(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(eg) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const ys = "retainpdf.reader.sidebar.v1", rg = ["search", "bookmarks", "issues"], og = 900;
function ag() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(ys)) || "{}");
    return { tab: rg.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function sg(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(ys, JSON.stringify(e));
  } catch {
  }
}
function ig() {
  const e = `(min-width: ${og}px)`, [t, n] = N(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
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
function cg(e) {
  const [t] = N(ag), [n, r] = N(null), [o, a] = N(t.tab), i = ig(), c = x((v) => {
    r(v), v && a(v);
  }, []);
  O(() => {
    sg({ tab: n || o });
  }, [n, o]);
  const l = x(() => r((v) => v ? null : o), [o]), u = x((v) => {
    r((R) => R === v ? null : v), a(v);
  }, []), [f, d] = N(""), [m, g] = N("");
  O(() => {
    const v = f.replace(/\s+/gu, " ").trim(), R = window.setTimeout(() => g(v), v ? 150 : 0);
    return () => window.clearTimeout(R);
  }, [f]);
  const [h, y] = N(0), I = x(() => {
    c("search"), y((v) => v + 1);
  }, [c]);
  ng(I);
  const S = x(() => {
    i || r(null);
  }, [i]), b = x((v) => {
    e.jumpToAnchor({ block_id: v }), S();
  }, [e.jumpToAnchor, S]), w = x((v) => {
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
function lg(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : da(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function ug(e, t) {
  return t === null || e !== t;
}
function dg(e, t) {
  const { boot: n } = e, r = A(null), o = A(null);
  O(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = qe(e.viewStateKey), s = lg({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: kt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      ug(e.mode, o.current) && (o.current = null, vn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const fg = [];
function mg(e) {
  const { sessionFiles: t } = e, [n, r] = N({}), o = A({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = x((y, I) => {
    r((S) => ({ ...S, [I]: { url: o.current[I], nodes: y } }));
  }, []), s = V(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const I = n.translated;
    return I && I.url === t.translatedUrl && I.nodes.length ? I.nodes : fg;
  }, [n, t.sourceUrl, t.translatedUrl]), i = A({}), [c, l] = N(0), u = x((y, I) => {
    i.current[I] = { url: o.current[I], pdf: y }, l((S) => S + 1);
  }, []), [f, d] = N(null), m = x((y) => d(y), []), g = x(() => d(null), []);
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
function hg() {
  const e = Nl(), { boot: t, panes: n, session: r } = e, o = sp(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = Kp(), { reserveRight: l } = c, u = i || l > 0, f = cg(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, h = x(() => {
    s(null);
  }, []);
  Vp(l, a, h);
  const { liveTranslationVisible: y, setLiveTranslationVisible: I, paneComposition: S, liveToggles: b, sourceViewOnly: w, visiblePdfMode: v } = Up(
    e,
    i,
    jp(e.shell.shellWidth, u || g)
  );
  dg(e, w);
  const R = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: T, toggleDocDark: P } = Cp();
  Ol({
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
  const { latestLivePage: C, jumpToLatestLivePage: _, offerCompletion: k, setCompletionDismissedKey: E, sourcePaneAction: M } = Wp(e, {
    liveTranslationVisible: y,
    setLiveTranslationVisible: I,
    liveToggles: b,
    sourceViewOnly: w,
    visiblePdfMode: v
  }), D = x((K) => {
    const ee = Hp(K, e.liveTranslationAvailable);
    ee !== null && I(ee), e.setModeKeepingPage(K);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), $ = x((K) => {
    s(K);
  }, []), [W] = N(up), H = x((K) => e.jumpToAnchor({ block_id: K }), [e.jumpToAnchor]), J = Rp(e.sourceOnly ? "" : r.jobId, e.currentPage, H), [ue, Q] = N(null), ce = x((K, ee) => e.jumpToAnchor({ block_id: K }, ee), [e.jumpToAnchor]), { bookmarks: Se, onPdfOutline: Y, onPdfDocument: de, zoomItem: Ae, setZoomItem: ae, zoomBlock: fe, closeZoom: F, zoomDocuments: U } = mg(e), { blockEdit: q, editBlock: oe, revisedBlocks: re } = Qp(e, v, W), [me, Ie] = N(null), se = x(() => Ie(null), []), Z = Jf({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: ge,
    contributionStore: B,
    contributions: ne,
    pageLayers: he,
    compareVersion: Le,
    textMarks: _e,
    menuSections: Pe,
    pointerTakenId: ze
  } = qp(e, c, {
    translationVersions: Z,
    bookmarks: Se,
    regionHover: W,
    assistantPanel: a,
    closeAssistant: h,
    visiblePdfMode: v,
    changeWorkspace: D,
    jumpToBlockIn: ce,
    zoomDocuments: U,
    editBlock: q.available && !q.blockedReason ? oe : null,
    panelHost: ue
  }), $e = !!ze, [Ce, We] = N([]), Oe = V(() => ({
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
    regionHover: W,
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
    compareVersion: Le,
    pointerTaken: $e,
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
    W,
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
    Le,
    $e,
    e.sourceOnly,
    w,
    e.download,
    e.goToPage,
    $,
    h,
    T,
    P
  ]), Fe = V(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), j = [
    ic,
    `is-workspace-${R}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    S.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(af, { api: ge, store: B, children: /* @__PURE__ */ p(dd, { value: Oe, hud: Fe, children: /* @__PURE__ */ L(
    "div",
    {
      className: j,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": R,
      "data-pointer-taken": ze || void 0,
      onContextMenu: (K) => {
        const ee = _p(K);
        if (!ee) return;
        const ye = Yd(ne, { target: K.target, clientX: K.clientX, clientY: K.clientY, page: ee.page });
        !ye.length && !Pe.length || (K.preventDefault(), We(ye), Ie(ee));
      },
      children: [
        /* @__PURE__ */ p(
          Gd,
          {
            mode: v,
            documentReady: !!r.jobId,
            sourceViewOnly: w,
            onModeChange: D,
            compareExtra: /* @__PURE__ */ p(Cn, { place: "compare" }),
            liveTranslation: b.topBarPill ? {
              visible: y,
              state: e.liveTranslation,
              onToggle: () => I((K) => !K),
              latestPage: y ? C : null,
              currentPage: e.currentPage,
              onJumpToLatest: _
            } : null,
            completion: k ? {
              onOpenCompare: () => {
                E(e.viewStateKey), D("compare");
              }
            } : null,
            start: /* @__PURE__ */ L(Me, { children: [
              /* @__PURE__ */ p(Wl, { onBeforeClose: r.prepareClose }),
              /* @__PURE__ */ p(mp, { open: d, onToggle: f.toggleSidebar, issueCount: J.issues.length }),
              r.title ? /* @__PURE__ */ p("span", { className: "reader-workspace-title", title: r.title, children: r.title }) : null
            ] }),
            end: /* @__PURE__ */ L(Me, { children: [
              /* @__PURE__ */ p(Cn, { place: "top", active: a }),
              /* @__PURE__ */ p(qh, {})
            ] })
          }
        ),
        /* @__PURE__ */ L("div", { className: "reader-workspace", children: [
          /* @__PURE__ */ p(Op, { state: f, bookmarkScope: e.viewStateKey, issues: J }),
          /* @__PURE__ */ L("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(Sp, { bookmarks: Se, onJumpPage: e.goToPage, onJumpBlock: H }),
            /* @__PURE__ */ p(Kd, { paneComposition: S, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: M }),
            /* @__PURE__ */ p(zh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts })
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
                /* @__PURE__ */ p(Xm, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: Q })
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
            leftSlot: /* @__PURE__ */ p(xp, { edit: q }),
            toolsSlot: /* @__PURE__ */ p(Cn, { place: "bottom" })
          }
        ),
        /* @__PURE__ */ p(
          zp,
          {
            session: r,
            zoomDocuments: U,
            zoomItem: Ae,
            setZoomItem: ae,
            closeZoom: F,
            visiblePdfMode: v
          }
        ),
        /* @__PURE__ */ p(Np, { menu: me, onClose: se, actions: Ce, sections: Pe }),
        /* @__PURE__ */ p(uf, { extensions: mr }),
        /* @__PURE__ */ p(lp, {})
      ]
    }
  ) }) });
}
function zg() {
  return /* @__PURE__ */ p(hg, {});
}
export {
  zg as R,
  hg as a,
  Dg as b,
  $g as c,
  Ef as d,
  Rf as e,
  Lg as f,
  Cg as g,
  xg as h,
  Ag as r,
  Og as s,
  Je as u
};
//# sourceMappingURL=ReaderApp-nJf6HAby.js.map
