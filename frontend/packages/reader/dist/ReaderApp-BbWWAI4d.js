var es = Object.defineProperty;
var br = (e) => {
  throw TypeError(e);
};
var ts = (e, t, n) => t in e ? es(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var yr = (e, t, n) => ts(e, typeof t != "symbol" ? t + "" : t, n), vr = (e, t, n) => t.has(e) || br("Cannot " + n);
var _t = (e, t, n) => (vr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), wr = (e, t, n) => t.has(e) ? br("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Sr = (e, t, n, r) => (vr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as D, jsx as p, Fragment as $e } from "react/jsx-runtime";
import { useMemo as V, useState as _, useEffect as C, useCallback as x, useRef as N, useLayoutEffect as Te, memo as Vt, createContext as qt, useContext as st, Fragment as ns, forwardRef as No, useImperativeHandle as Jn, useSyncExternalStore as mn, useId as Ao, Component as rs, Suspense as Lo, lazy as xo } from "react";
import { requireAdapter as Mt, getReaderAdapters as _e } from "./adapters.js";
import { resolveReaderDownloadName as os, resolveReaderDownloadUrls as as, READER_PROGRESS_COPY as Be, trimString as on, READER_DOWNLOAD_ACTIONS as ss, disabledReason as is } from "./runtime/state.js";
import { r as cs, b as ls } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Nn, isFinishedJobStatus as Bt } from "@retainpdf/domain/job";
import { n as Do, d as us, f as bn, k as kr, b as ds, c as fs, j as Ne, p as dt, g as ms, l as Tt, i as hs } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as ps } from "@retainpdf/api/documents";
import { isReaderTransportError as gs, createReaderTransportError as bs } from "./contracts.js";
import { toast as An, Toaster as ys } from "sonner";
import { X as ft, PenLine as Gn, ZoomIn as vs, Check as Co, Copy as ws, ChevronUp as Ss, ChevronDown as Oo, History as ks, LoaderCircle as Is, Pin as Rs, LogOut as Ts, FileText as zo, Columns2 as $o, Languages as Fo, Radio as Es, ArrowDownToLine as Ps, CheckCircle2 as Ms, Keyboard as _s, Download as Ns, ListOrdered as As, TriangleAlert as Ls, ChevronRight as Bo, Search as xs, ListTree as Ds, GitCompareArrows as Cs, LayoutGrid as Os, Highlighter as zs, Eraser as $s, Undo2 as Fs, Trash2 as Bs, ChevronLeft as js, Minus as Hs, Plus as Us, ArrowLeft as Ws } from "lucide-react";
import { Button as Q, Textarea as Ks, IconButton as at, Input as jo } from "@retainpdf/ui";
import { pdfjs as Ho, Page as Vs, Document as qs } from "react-pdf";
import { e as Js, m as Gs, a as Xs } from "./markdown-math-XkF5urpn.js";
const Zs = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ys = "", Qs = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ei = (e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, xp = (...e) => {
  var n;
  return (((n = _e()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Dp = () => {
  var e, t;
  return ((t = (e = _e()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, je = () => Mt("defaultReaderDataPort"), Ir = () => Mt("defaultReaderPageConfigPort"), Cp = {
  get apiPrefix() {
    return je().apiPrefix;
  },
  fetchProtected: (...e) => je().fetchProtected(...e),
  loadMarkdownPayload: (e) => je().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => je().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => je().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => je().loadJobPayload(e),
  loadReaderPayload: (e, t) => je().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => je().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return je().liveTranslation;
  }
}, Uo = {
  messageTargetOrigin: () => Ir().messageTargetOrigin(),
  readerJobId: () => Ir().readerJobId()
}, ti = () => {
  var e;
  return ((e = _e()) == null ? void 0 : e.liveTranslation) ?? null;
}, jt = () => {
  var t;
  const e = _e();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ve = () => {
  const e = _e();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Mt("fetchDocumentByJobId")(...n),
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
}, ni = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ri = () => {
  var e, t;
  return ((t = (e = _e()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, oi = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ai = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? os(...e);
}, si = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? as(...e);
}, ii = (...e) => Mt("downloadProtectedResource")(...e), ci = (...e) => Mt("failDownloadToast")(...e), Op = (e, t) => Mt("resolveMarkdownAssetUrl")(e, t), Rr = "/api/v1";
function li() {
  const e = () => {
    var r;
    return cs(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = _(e);
  return C(() => {
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
function ui() {
  const e = li(), t = V(() => oi(Uo), [e]), n = V(() => ri(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function di(e) {
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
  }), w = h.jobId === g ? h.documentId : "", S = t || w, b = !!t && !g, [v, k] = _(null), E = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, L = b || !!E, z = x((A) => {
    const I = `${A.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const R = `${A.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: R,
      sessionIdentity: o.current
    }), i();
  }, []);
  C(() => {
    k((A) => A && A.sessionIdentity !== r ? null : A);
  }, [r]);
  const O = x((A) => {
    switch (A.type) {
      case "resolved-document-job":
        l({ documentId: A.documentId, jobId: A.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: A.documentId, jobId: A.jobId });
        break;
      case "resolved-job-document":
        y((I) => I.jobId === A.jobId && I.documentId === A.documentId ? I : { jobId: A.jobId, documentId: A.documentId });
        break;
      case "committed-source":
        k({
          documentId: A.documentId,
          revision: A.revision,
          sessionIdentity: A.sessionIdentity
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
    jobDocumentId: w,
    documentId: S,
    sourceOnly: b,
    committedDocumentSource: v,
    setCommittedDocumentSource: k,
    activeCommittedDocumentSource: E,
    sourceViewOnly: L,
    refreshCommittedDocument: z,
    applyIdentityEvent: O
  };
}
function Tr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function fi(e) {
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
function Er(e, t) {
  return ei(Nn(e, t));
}
function mi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function hi(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !mi(a, t))
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
        type: Qs.progress,
        stage: n,
        percent: e,
        text: t
      },
      Uo.messageTargetOrigin()
    );
  } catch {
  }
}
function an(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Ln({ percent: t, text: n, stage: r });
}
function pi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = _(null), [l, u] = _(null), [f, d] = _(""), [m, g] = _(0), h = f === n ? i : null, y = f === n ? l : null, w = Tr(h), S = Bt(w), b = x(() => {
    g((O) => O + 1);
  }, []), v = x((O) => {
    c(O.jobPayload), u(O.manifestPayload), d(O.sessionIdentity);
  }, []), k = x((O) => {
    c(null), u(null), d(O);
  }, []), E = N(""), L = N(""), z = x(async () => {
    const O = o.current;
    if (!O || E.current === O) return;
    const A = Ve().loadJobPayload;
    if (typeof A != "function") return;
    const I = a.current.value;
    E.current = O;
    try {
      const R = await A(O);
      if (s.current || a.current.value !== I || o.current !== O || !R || typeof R != "object")
        return;
      const P = Tr(R);
      c(R), d(r.current), !Bt(P) && L.current === O && (L.current = ""), P === "succeeded" && L.current !== O && (L.current = O, g((T) => T + 1));
    } catch {
    } finally {
      E.current === O && (E.current = "");
    }
  }, []);
  return C(() => {
    L.current = "";
  }, [n]), C(() => {
    if (!t || S || !h) return;
    const O = window.setInterval(() => {
      document.visibilityState !== "hidden" && z();
    }, 1e3);
    return () => window.clearInterval(O);
  }, [S, z, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: w,
    jobTerminal: S,
    jobRefreshRevision: m,
    refreshJobArtifacts: b,
    refreshJobStatus: z,
    publishPayload: v,
    clearPayload: k
  };
}
function xn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function gi(e, t) {
  e(t), xn(t);
}
function bi(e) {
  const [t, n] = _(e ? "source" : "compare"), r = x((a) => {
    e && a !== "source" || (n(a), xn(a));
  }, [e]), o = x((a) => {
    gi(n, a);
  }, []);
  return C(() => (e && document.documentElement.classList.add("reader-source-only"), xn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Pr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function yi(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Pr(n.active_job_id),
    activeVersionId: Pr(n.active_version_id)
  };
}
function vi(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function wi(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Si(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const ki = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ii(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = ki.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Ri = 48 * 1024 * 1024;
function Ti(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ei = 2, Me = /* @__PURE__ */ new Map();
function Dn(e, t) {
  Me.delete(e), Me.set(e, t);
}
function Mr(e) {
  if (Me.size < Ei) return;
  const t = Me.keys().next().value;
  t && Me.delete(t);
}
async function Pi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Wo(e, t = jt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Me.has(r)) {
    const b = Me.get(r);
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
    const v = await Pi(s);
    throw v && (b.reason = v), b;
  }
  const i = Mi(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Mr(), Me.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Me.has(r) ? Dn(r, l) : (Mr(), Me.set(r, l)), l;
}
function Mi(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Ri ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const _i = { file: null, loading: !1, error: "" }, Ni = { file: null, loading: !0, error: "" };
function Ai(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if (C(() => {
    if (t || !n) return;
    const s = Me.get(n);
    if (s) {
      Dn(n, s);
      return;
    }
    const i = new AbortController();
    return Wo(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return _i;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Me.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ni;
}
function Li(e) {
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
async function Cn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  an(s, r, n, "download");
  const i = await Wo(t, jt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (an(s, o, n, "download"), i);
}
async function xi(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  an(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Cn({
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
    Cn({
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
function Di(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ci({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = ps,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Di(o.href, t, a)), !0);
}
const Zt = {
  regions: null,
  metadata: null
};
function Oi(e) {
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
    activeLoadAbortRef: w
  } = e, [S, b] = _(""), [v, k] = _(""), [E, L] = _(null), [z, O] = _(null), [A, I] = _(!1), [R, P] = _(""), [T, M] = _([]), [F, $] = _(!1), [G, J] = _(() => ({
    source: null,
    translated: null
  })), [ae, re] = _(
    Zt
  ), [j, W] = _({
    loading: !0,
    percent: 4,
    text: Be.boot,
    stage: "progress",
    failed: !1
  });
  return C(() => {
    const U = new AbortController(), de = h.current.value, q = Li({
      sessionEpochRef: h,
      closingRef: y,
      abort: U,
      sessionEpoch: de
    });
    w.current = U;
    const K = Ve();
    if (y.current)
      return U.abort(), () => {
        w.current === U && (w.current = null);
      };
    let ie = !1;
    function ge(se, me) {
      q.markFailed(), $(!0), W({
        loading: !1,
        percent: 100,
        text: se,
        stage: "failed",
        failed: !0
      }), Ln({ percent: 100, text: me, stage: "failed" });
    }
    function te() {
      I(!0), ie || $(!0), W({
        loading: !1,
        percent: 100,
        text: Be.ready,
        stage: "ready",
        failed: !1
      }), Ln({ percent: 100, text: Be.ready, stage: "ready" });
    }
    function fe() {
      return l != null && l.documentId ? Er(
        l.documentId,
        l.revision
      ) : Zs() ? Ys : K.resolveResourceUrl(Nn(r));
    }
    async function ke() {
      var ee;
      let se = { activeJobId: "", activeVersionId: "" };
      try {
        const oe = await ((ee = K.fetchDocument) == null ? void 0 : ee.call(K, r));
        oe && (se = yi(oe));
      } catch {
      }
      const me = vi({
        link: se,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (me.kind === "follow-active-job") {
        if (q.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: me.jobId
        }), me.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: me.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (me.kind === "open-committed-source") {
        if (q.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: me.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const be = fe();
      if (q.isInactive()) return;
      b(be), k(""), P(""), d(c);
      const H = await Cn({
        url: be,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: q,
        setBoot: W
      });
      if (!q.isInactive()) {
        if (!H) {
          ge("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        L(H), te();
      }
    }
    async function nt() {
      var Xt;
      const se = !l, me = !!(se && K.loadSessionSnapshot && K.loadReaderOptionalArtifacts), be = me ? K.loadReaderOptionalArtifacts(t) : null, H = await ((Xt = K.loadSessionSnapshot) == null ? void 0 : Xt.call(K, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: se && !me
      })), ee = H ? {
        jobPayload: H.sourcePayload,
        manifestPayload: H.manifestPayload,
        readerMetadata: H.readerMetadata,
        regionsPayload: H.regions,
        readerErrors: H.readerErrors
      } : await K.loadReaderPayload(t, {
        includeOptionalArtifacts: se
      });
      if (q.isInactive()) return;
      let oe = null;
      if (n && !r)
        if (H && H.linkedDocument !== void 0)
          oe = H.linkedDocument;
        else {
          try {
            oe = await K.fetchDocumentByJobId(Rr, t);
          } catch {
          }
          if (q.isInactive()) return;
        }
      const Ae = fi(ee.jobPayload) || `${(oe == null ? void 0 : oe.document_id) || ""}`.trim();
      Ae && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ae
      });
      const Pe = wi({
        payloadDocumentId: Ae,
        linkedActiveJobId: `${(oe == null ? void 0 : oe.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(oe == null ? void 0 : oe.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Pe.kind === "restore-committed-source") {
        if (q.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Pe.documentId,
          revision: Pe.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const De = K.resolveReaderSourcePdf(ee.manifestPayload), Le = K.resolveReaderTranslatedPdfUrl(ee.jobPayload, ee.manifestPayload), he = typeof De == "string" ? De : K.resolveReaderArtifactUrl(De), ye = r || Ae, Je = l != null && l.documentId ? Er(
        l.documentId,
        l.revision
      ) : he || (ye ? K.resolveResourceUrl(Nn(ye)) : ""), Fe = l ? "" : Le || "";
      b(Je || ""), k(Fe), P(hi(ee.jobPayload, t)), f({
        jobPayload: ee.jobPayload || null,
        manifestPayload: ee.manifestPayload || null,
        sessionIdentity: c
      });
      const rt = () => xi({
        sourceFinal: Je || "",
        translatedFinal: Fe,
        fence: q,
        setBoot: W
      }), pt = !!(Je || Fe), gt = be && pt ? rt() : null;
      gt == null || gt.catch(() => {
      });
      const Gt = (B) => {
        q.isInactive() || (M(l ? [] : Do(B.regionsPayload)), J(l ? { source: null, translated: null } : us(B.readerMetadata)), re(l ? Zt : B.readerErrors ?? Zt), $(!0));
      };
      if (be ? (ie = !0, be.then(Gt)) : Gt(ee), !pt) {
        ge(Be.failed, Be.failed);
        return;
      }
      const bt = await (gt ?? rt());
      if (bt.status !== "inactive") {
        if (bt.status === "incomplete") {
          ge("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        L(bt.sourceBytes), O(bt.translatedBytes), te();
      }
    }
    async function Ee() {
      I(!1), L(null), O(null), M([]), $(!1), J({ source: null, translated: null }), re(Zt), an(W, 8, Be.metadata, "metadata");
      try {
        if (s) {
          await ke();
          return;
        }
        if (!t) {
          ge(Be.failed, Be.failed);
          return;
        }
        await nt();
      } catch (se) {
        if (q.isClosedOrStale() || (se == null ? void 0 : se.name) === "AbortError") return;
        q.markFailed();
        const me = Number(se == null ? void 0 : se.status), be = `${(se == null ? void 0 : se.reason) || ""}`, H = Ii({ status: me, reason: be, sessionJobId: t });
        if (H && (await Ci({
          apiPrefix: Rr,
          documentId: H,
          expiredJobId: t
        }) || q.isClosedOrStale()))
          return;
        if (Si({
          status: me,
          reason: be,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const ee = se instanceof Error ? se.message : Be.failed;
        ge(ee, ee);
      }
    }
    return Ee(), () => {
      U.abort(), w.current === U && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: E,
    translatedFile: z,
    assetsReady: A,
    title: R,
    regions: T,
    regionsSettled: F,
    readerMetadata: G,
    readerErrors: ae,
    boot: j
  };
}
function zi() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = ui(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), c = N(""), l = N(""), u = N(() => {
  }), f = x(() => u.current(), []), d = di({
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
  } = d, { mode: w, setMode: S, switchSessionMode: b } = bi(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const v = pi({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: E,
    jobStatus: L,
    jobTerminal: z,
    jobRefreshRevision: O,
    refreshJobArtifacts: A,
    refreshJobStatus: I
  } = v, R = Oi({
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
  }), P = x(() => {
    var M;
    e.current = !0, (M = t.current) == null || M.abort();
  }, []), T = V(
    () => ({
      fetchProtected: Ve().fetchProtected,
      jobId: m,
      jobPayload: k,
      manifestPayload: E,
      sourceUrl: R.sourceUrl,
      translatedUrl: R.translatedUrl,
      sourceOnly: y
    }),
    [m, k, E, R.sourceUrl, R.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: L,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: z,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
    setMode: S,
    sourceUrl: R.sourceUrl,
    translatedUrl: R.translatedUrl,
    sourceFile: R.sourceFile,
    translatedFile: R.translatedFile,
    assetsReady: R.assetsReady,
    boot: R.boot,
    title: R.title,
    regions: R.regions,
    regionsSettled: R.regionsSettled,
    readerMetadata: R.readerMetadata,
    readerErrors: R.readerErrors,
    download: T,
    refreshJobArtifacts: A,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: P
  };
}
const $i = 160, Fi = 8, Bi = 0;
function ji() {
  const e = N(null), [t, n] = _(null), [r, o] = _(Bi), a = x((s) => {
    e.current = s, n(s);
  }, []);
  return C(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < $i || o((u) => Math.abs(u - l) < Fi ? u : l);
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
function Hi(e) {
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
const yn = { source: 0, translated: 0 };
function Ui(e, t) {
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
    pages: yn
  })), [m, g] = _(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : yn, y = m.identity === l ? m.tick : 0, w = Hi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = w, b = x((I, R) => {
    u.current === l && d((P) => {
      const T = P.identity === l ? P.pages : yn;
      return T[R] === I && P.identity === l ? P : {
        identity: l,
        pages: { ...T, [R]: I }
      };
    });
  }, [l]), v = N(null), k = x(() => {
    v.current && clearTimeout(v.current);
    const I = l;
    v.current = setTimeout(() => {
      v.current = null, u.current === I && g((R) => ({
        identity: I,
        tick: R.identity === I ? R.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  C(() => (v.current && (clearTimeout(v.current), v.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [l]);
  const E = V(
    () => Math.max(h.source, h.translated),
    [h]
  ), L = S === "translated" ? h.translated : h.source || h.translated, z = t == null ? void 0 : t.userZoom, O = t == null ? void 0 : t.shellWidth, A = `${l}-${y}-${z}-${n}-${h.source}-${h.translated}-${O}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: E,
    primaryNumPages: L,
    metricsTick: y,
    onNumPages: b,
    onMetrics: k,
    rowSyncRevision: A
  };
}
const Re = "data-reader-page", Se = "data-reader-pane", Xn = "data-natural-height", Wi = "reader-react-root", Ko = "reader-react-grid", Vo = "reader-react-scroll-shell", hn = "reader-react-pdf-pane", qo = "reader-react-pdf-page", sn = "reader-react-pdf-page-placeholder", Zn = "reader-react-pdf-page-slot";
function cn(e, t) {
  const n = e != null ? `[${Re}="${e}"]` : `[${Re}]`;
  return t ? `${n}[${Se}="${t}"]` : n;
}
function Yn() {
  return `.${Zn}[${Re}]`;
}
function ln(e) {
  return Number(e.getAttribute(Re));
}
const Jo = 0.25, un = 1, Ki = 0.05, Jt = 0.5, Vi = 16, qi = 8, Go = Vi + qi, Ji = 720;
function Qe() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Xo(e) {
  return Number.isFinite(e) && e < Ji;
}
function St(e, t = Number.POSITIVE_INFINITY) {
  return Xo(t) && (e === "source" || e === "translated") ? un : Jt;
}
function We(e) {
  return Number.isFinite(e) ? Math.min(un, Math.max(Jo, e)) : Jt;
}
function Ht(e, t) {
  const n = We(Number(e) + t * Ki);
  return Math.round(n * 100) / 100;
}
function Gi(e) {
  return Math.round(We(e) * 100);
}
function Zo(e) {
  const n = (Number(e) || 0) - Go;
  return Math.max(160, Math.floor(n));
}
function Xi(e, t = Jt) {
  const n = We(t);
  return Zo((Number(e) || 0) * n);
}
function Zi(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Se}]`)
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
const Yi = 8;
function Qi(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Yi ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Yo = 200, Qo = [
  "markdown"
], ec = Qo;
function ea(e) {
  return ec.includes(e);
}
const tc = "retainpdf:reader:view:v1:", _r = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), nc = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function ta() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function On(e) {
  return `${e || ""}`.trim();
}
function rc({
  documentId: e,
  jobId: t
}) {
  const n = On(e);
  if (n) return `document:${n}`;
  const r = On(t);
  return r ? `job:${r}` : "";
}
function na(e) {
  const t = On(e);
  return t ? `${tc}${t}` : "";
}
function oc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ac(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!_r.has(t) || !_r.has(n) || t === n))
    return { left: t, right: n };
}
function sc(e) {
  return e === null ? null : ea(e) ? e : void 0;
}
function ic(e) {
  return nc.has(e) ? e : void 0;
}
function ra(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = oc(t.anchor), r = Number(t.zoom), o = ic(t.mode), a = ac(t.splitLayout), s = sc(t.assistantPanel);
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
function ze(e, t = ta()) {
  const n = na(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ra(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function pn(e, t, n = ta()) {
  const r = na(e);
  if (!r || !n) return null;
  const o = ze(e, n), a = ra({
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
function cc(e, t, n = "") {
  var d;
  const [r, o] = _(() => {
    var m;
    return ((m = ze(n)) == null ? void 0 : m.zoom) ?? St(e, Qe());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), c = N(((d = ze(n)) == null ? void 0 : d.zoom) !== void 0);
  C(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = ze(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? St(e, Qe());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), C(() => {
    if (c.current) return;
    const m = St(e, Qe()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = x((m, g) => {
    const h = We(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, pn(s.current, { zoom: h }), o(h));
  }, []), u = x((m) => {
    l(Ht(a.current, m));
  }, [l]), f = x((m) => {
    l(St(m));
  }, [l]);
  return Te(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Zi(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const lc = 160, uc = 3e-3, Nr = 50, dc = 16, fc = 800;
function mc(e, t = 0) {
  const n = t === 1 ? dc : t === 2 ? fc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Nr, Math.min(Nr, r));
  return Math.exp(-o * uc);
}
function hc(e, t, n = 0) {
  return We(e * mc(t, n));
}
function pc(e) {
  return Math.round(We(e) * 100) / 100;
}
function gc(e, t, n) {
  const r = We(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return We(t) / r;
  const a = (o + Go) / r;
  return Zo(a * We(t)) / o;
}
function bc(e) {
  return Array.from(e.querySelectorAll(Yn()));
}
function yc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function vc(e, t, n) {
  let r = null;
  for (const s of bc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = yc(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Re) || "",
    pane: o.getAttribute(Se) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function wc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function oa(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Yn()}[${Re}="${t.page}"][${Se}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (wc(n, e).scrollLeft += a);
}
function Sc(e, t, n, r) {
  const o = e.querySelector(`.${Ko}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function Nt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const kc = 600, Ic = 1e3;
function Rc(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || oa(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Ic);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Tc(e, t, n) {
  const r = N(t);
  r.current = t;
  const o = N(n);
  o.current = n;
  const a = N(null), s = N(null), i = N(null);
  C(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = pc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Nt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Nt(d.grid));
      }, kc), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, Nt(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: vc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = hc(f.target, u.deltaY, u.deltaMode);
      const d = gc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Sc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, lc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Nt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Te(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Nt(c.grid), !(!e || !c.anchor) && (oa(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Rc(e, c.anchor)));
  }, [t, e]);
}
function Ec(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: x((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const Qn = 48;
function aa(e, t = Qn) {
  return e.getBoundingClientRect().top + t;
}
function sa(e, t) {
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
  const o = ln(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function $t(e, t, n = Qn) {
  if (!e)
    return null;
  const r = cn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = aa(e, n), i = sa(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Et(e, t, n = "auto", r, o = Qn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(cn(a, r))), i || (i = e.querySelector(cn(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function Pc(e, t, n = "smooth", r) {
  return Et(
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
    Et(
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
function Mc(e, t, n) {
  return zn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function dn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function xe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function _c(e, t, n = !0, r = "", o) {
  const [a, s] = _(1);
  return C(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, u = 0;
    const f = cn(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = aa(i), w = sa(h, y);
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
const Nc = `canvas, .react-pdf__Page, .${qo}, .${sn}`, Ar = /* @__PURE__ */ new WeakMap();
function Ac(e) {
  const t = Number(e.getAttribute(Xn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Ar.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Nc), Ar.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Lc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function xc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Yn()).forEach((r) => {
    const o = ln(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Ac(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Dc(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, Te(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, f = !1;
    const d = () => {
      var k;
      if (c) return;
      const b = e.current;
      if (!b) return;
      const v = xc(b);
      Lc(s.current, v) || (s.current = v, a(v)), u && !f && (f = !0, (k = i.current) == null || k.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), y = window.setTimeout(m, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => m()), S.observe(w)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Cc = [0, 48, 140, 320, 560], Oc = 700, zc = [80, 200, 400], $c = 500, Fc = 50, Bc = /* @__PURE__ */ new Set([
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
]), jc = 180, Lr = [0, 48, 140, 320, 700, 1200];
function Hc(e, t) {
  var R;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((R = ze(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
  ), c = N(null), l = N(!1), u = N(r), f = N(null), d = N(null), m = N(null), g = N(null), h = N(a), y = N(""), w = N(n);
  w.current = n;
  const S = x(() => {
    var P;
    (P = f.current) == null || P.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = x(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), v = x((P = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const T = () => {
      g.current = null, pn(h.current, {
        anchor: xe(i.current)
      });
    };
    P ? T() : g.current = setTimeout(T, jc);
  }, []), k = x((P) => {
    i.current = xe(P), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Fc);
  }, []);
  C(() => {
    if (!o)
      return;
    let P = !1, T = null, M = null, F = null;
    const $ = () => {
      if (P) return;
      const G = e.current;
      if (!G) {
        F = setTimeout($, 50);
        return;
      }
      T = G, M = () => {
        if (l.current)
          return;
        const J = $t(T, w.current);
        J && (i.current = J, v());
      }, T.addEventListener("scroll", M, { passive: !0 }), l.current || M();
    };
    return $(), () => {
      P = !0, F != null && clearTimeout(F), T && M && T.removeEventListener("scroll", M);
    };
  }, [o, r, n, e, v]), C(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const T = (M) => {
      M.metaKey || M.ctrlKey || M.altKey || Bc.has(M.key) && b();
    };
    return P.addEventListener("wheel", b, { passive: !0 }), P.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", T), () => {
      P.removeEventListener("wheel", b), P.removeEventListener("touchmove", b), window.removeEventListener("keydown", T);
    };
  }, [o, e, b]), Te(() => {
    var T;
    if (h.current === a) return;
    v(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const P = (T = ze(a)) == null ? void 0 : T.anchor;
    i.current = P ? xe(P) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, v, S]), C(() => {
    var T;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const P = xe(
      ((T = ze(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = P, c.current = P, l.current = !0, S(), f.current = zn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: Lr,
        onDone: () => k(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(P);
    }, Math.max(...Lr) + 160), () => S();
  }, [o, s, a, e, k, S]), C(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const P = c.current ? xe(c.current) : xe(i.current);
    return l.current = !0, c.current = P, i.current = P, S(), f.current = zn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Cc,
        onDone: () => k(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(P);
    }, Oc), () => {
      S();
    };
  }, [r, o, n, e, k, S]), C(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), v(!0);
  }, [S, v]);
  const E = x(() => {
    const P = $t(
      e.current,
      w.current
    );
    return xe(P || i.current);
  }, [e]), L = x(() => {
    l.current = !0;
    const P = $t(
      e.current,
      w.current
    ), T = xe(P ?? i.current);
    return i.current = T, c.current = T, v(), T;
  }, [e, v]), z = x((P, T, M) => {
    const F = M || w.current, $ = dn(P, T || 1), G = { page: $, fraction: 0 };
    i.current = G, l.current = !0, c.current = G, v(), S(), Pc(e.current, $, "smooth", F), f.current = Mc(
      () => e.current,
      $,
      {
        behavior: "auto",
        pane: F,
        delaysMs: zc,
        onDone: () => k(G)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(G);
    }, $c);
  }, [e, k, S, v]), O = x(() => xe(i.current), []), A = x(() => l.current, []), I = x(() => {
    if (!l.current || !c.current)
      return;
    const P = xe(c.current);
    Et(
      e.current,
      P,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: E,
    beginModeSwitch: L,
    goToPage: z,
    getAnchor: O,
    isRestoring: A,
    repinIfRestoring: I
  };
}
function Uc(e, t) {
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
function ia(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Wc = [0, 80, 200, 400, 800], Kc = 120, Vc = 400;
function qc(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = N(a);
  f.current = a;
  const d = N(s);
  d.current = s;
  const m = N(i);
  m.current = i;
  const g = N(n);
  g.current = n, C(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = ni(), y = Uc(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const w = ia(h, y, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, h && ((k = m.current) == null || k.call(m, h, y));
    const S = [];
    let b = 0;
    for (const E of Wc)
      b = Math.max(b, E), S.push(
        setTimeout(() => {
          f.current(y);
        }, E)
      );
    return S.push(
      setTimeout(() => {
        var E;
        (E = g.current) == null || E.call(g);
      }, b + Kc)
    ), () => {
      for (const E of S) clearTimeout(E);
    };
  }, [r, o, c, l, t, u]);
}
function Jc(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Gc(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Vc,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = N(a);
  u.current = a;
  const f = N(l);
  f.current = l;
  const d = N(0);
  C(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = ls(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = ia(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || Jc)(h);
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
function Xc(e) {
  const t = N(""), [n, r] = _(!1), o = x(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  qc(a, t, o), Gc(e, t, n);
}
const At = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Zc(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function xr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function ca(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = xr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = xr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Yc(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = ca(r, t, n);
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
function Qc(e) {
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
function el(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function tl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function nl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function rl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Dr = [250, 500, 1e3, 2e3, 4e3], vn = [80, 160, 320, 640, 1e3, 1500], Cr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function $n(e, t) {
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
function er(e) {
  return gs(e) ? `${e.code || ""}`.trim() : "";
}
function Yt(e, t) {
  const n = er(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ol(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ca(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = bs(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = er(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = vn[Math.min(s, vn.length - 1)];
    if (await $n(i, r), s >= vn.length + 2) throw a;
  }
}
function al({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _(At), s = N(o), i = N("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Bt(l) ? l : "";
  return C(() => {
    if (!n || !c) {
      i.current = "", s.current = At, a(At);
      return;
    }
    const f = r === void 0 ? ti() : r, d = i.current === c;
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
        const k = b(v);
        return s.current = k, k;
      });
    }, w = async () => {
      let b = 0;
      for (; !m.signal.aborted; )
        try {
          const v = await f.fetchLayout(c, { signal: m.signal });
          g = !0, y((k) => ({
            ...k,
            layoutByPage: Zc(v),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = er(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            y((L) => ({
              ...L,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Yt(v, "实时译文暂不可用")
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
            error: Yt(v, "正在等待 OCR 版面数据")
          })), await $n(Dr[Math.min(b, Dr.length - 1)], m.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await w(), !g || m.signal.aborted) return;
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
              let k;
              try {
                k = await ol(
                  c,
                  v,
                  s.current,
                  m.signal,
                  f
                );
              } catch (E) {
                if ((E == null ? void 0 : E.name) === "AbortError" || m.signal.aborted) throw E;
                y((L) => ({
                  ...L,
                  lastSeq: Math.max(L.lastSeq, v.seq),
                  error: Yt(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((E) => {
                const L = Yc(E, v, k);
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
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError" || m.signal.aborted) return;
          y((k) => ({
            ...k,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: Yt(v, "实时译文连接已中断，正在重连")
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
        await $n(Cr[Math.min(b, Cr.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function sl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function il(e, t = !0) {
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return C(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ve().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(sl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const cl = 4500;
function ll(e) {
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
const ul = /* @__PURE__ */ new Set(["book", "translate"]);
function la(e) {
  return !!(e.jobId && e.sourceUrl && ul.has(e.workflow));
}
function dl(e) {
  return !!(la(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function fl() {
  const e = zi(), t = la({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = dl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Bt(o) && (r.current.running = !0);
  const a = al({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = ji(), u = il(e.jobId, !e.sourceOnly), f = rc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = cc(e.mode, s, f);
  Tc(i, m, g);
  const h = Ui(
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
    goToPage: w,
    repinIfRestoring: S
  } = Hc(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  C(() => {
    S();
  }, [c, S]);
  const b = Dc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), v = _c(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), k = x(($, G) => {
    var ae, re;
    const J = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((ae = h.numPagesByPane) == null ? void 0 : ae.source) || 0,
      Number((re = h.numPagesByPane) == null ? void 0 : re.translated) || 0
    );
    w($, J, G);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [E, L] = _(null), z = N(null), O = x(($) => {
    z.current && clearTimeout(z.current), L($), $ && (z.current = setTimeout(() => L(null), cl));
  }, []);
  C(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const A = x(($) => {
    const G = bn(e.regions, $);
    return G ? kr(G, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = x(($, G) => {
    const J = G || h.primaryPane, ae = typeof $ == "object" && $ ? `${$.block_id || ""}`.trim() : "", re = typeof $ == "object" && $ ? `${$.image_url || ""}`.trim() : "", j = typeof $ == "object" && $ ? $.page_idx != null ? Number($.page_idx) + 1 : $.page != null ? Number($.page) : null : typeof $ == "number" ? $ + 1 : null, W = ds(e.regions, re, j) || bn(e.regions, ae) || (typeof $ == "object" ? fs(e.regions, $) : null);
    let U = W ? kr(W, J).page : null;
    U == null && (U = ll($)), !(U == null || U < 1) && (O(W), k(U, J));
  }, [O, k, h.primaryPane, e.regions]);
  Xc({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: v,
    goToPage: k,
    resolveBlockPage: A,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: ($) => {
      O(bn(e.regions, $.blockId));
    }
  });
  const { setModeKeepingPage: R } = Ec({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  C(() => {
    O(null);
  }, [d, O]);
  const P = !e.boot.loading && !e.boot.failed, T = V(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), M = V(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), F = V(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: T,
    panes: h,
    sessionFiles: M,
    rowHeights: b,
    goToPage: k,
    activeRegion: E,
    jumpToAnchor: I,
    setModeKeepingPage: R,
    download: e.download,
    showHud: P,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, T, h, M, b, k, E, I, R, P, m, g, f, a, n, u]);
  return V(() => ({
    ...F,
    currentPage: v
  }), [F, v]);
}
const ml = [
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
], hl = [
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
    title: "画笔",
    items: [
      { actions: [], keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
      { actions: [], keys: "Esc", desc: "退出画笔" },
      { actions: [], keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" },
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
  },
  {
    title: "引用（「图 2.1」「式 (3.21)」）",
    items: [
      { actions: [], keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
      { actions: [], keys: "Alt+→", desc: "再跳回去" }
    ]
  }
];
function pl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of ml)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function gl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const bl = ".reader-notes-panel";
function yl(e) {
  return e instanceof Element ? !!e.closest(bl) : !1;
}
function vl(e) {
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
  C(() => {
    if (!u)
      return;
    const f = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || gl(d.target) || yl(d.target))
        return;
      const m = d.key, g = pl(m);
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
              a(Ht(o, 1));
              return;
            case "zoom-out":
              a(Ht(o, -1));
              return;
            case "zoom-reset":
              a(St(t, Qe()));
              return;
            case "next-page":
              c(dn(s + 1, i));
              return;
            case "prev-page":
              c(dn(s - 1, i));
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
const wl = "retainpdf:soft-reader-close";
function Sl() {
  return new URL("./index.html", window.location.href).href;
}
function kl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: wl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Il(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Rl() {
  if (!(typeof window > "u") && !kl()) {
    if (Il(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Sl());
  }
}
function Tl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function El({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ D(Tl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Rl();
  }, children: [
    /* @__PURE__ */ p(ft, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Pl = 3e3, Ml = 8;
async function _l(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Nl(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Al(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Pl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Nl(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < Ml && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await _l(e, i);
  })), a;
}
function ua(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function da(e, t) {
  let n = null;
  for (const r of ua(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function Or(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let zr = !1;
function Ll() {
  if (zr)
    return;
  const e = jt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Ho.GlobalWorkerOptions.workerSrc = e, zr = !0);
}
const Ye = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), xl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Dl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Cl = {
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
}, $r = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Ol(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => $r(o ?? a ?? "", xl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => $r(o ?? a ?? "", Dl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Cl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function zl(e) {
  return Ye(e.translatedBlockText) || Ye(e.translated.text) || Ye(e.source.text);
}
const $l = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Fl(e) {
  const t = [];
  for (const n of e) {
    if (!$l(n)) continue;
    const r = Ol(zl(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Bl(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const jl = 24, Hl = 60;
function Fr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - jl), o = Math.min(e.length, n + t.length + Hl), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Ul(e, t, n = 200) {
  const r = Ye(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Ye(a.translatedBlockText) || Ye(a.translated.text), c = i ? Fr(i, r) : null, l = c ?? Fr(Ye(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function Qt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Dt(e, t) {
  const n = Ye(t).toLowerCase();
  if (!n || !e) return Qt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Qt(e.slice(a, s))}<mark class="reader-find-mark">${Qt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Qt(e.slice(a));
}
function Wl(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const fa = "reader-xref", Fn = "data-xref", Ct = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Kl = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Ct})`), Vl = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Bn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function ql(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Jl(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Gl(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Ne(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Xl(e, t, n) {
  return (e.find((o) => Ne(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Zl(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ne(r), s = Jl(r);
    if (a === "formula") {
      for (const g of s.matchAll(Vl)) {
        const h = Bn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Kl.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = ql(i[1]), u = Bn(i[2]), f = Gl(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Xl(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Yl = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Ct})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Ct})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Ct})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Ct})\s*[）)]`, "g"), kind: () => "equation" }
];
function Ql(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Yl) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Bn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function eu(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function tu(e, t, n = "") {
  const r = Ql(e, t);
  if (!r.length) return Dt(e, n);
  let o = "", a = 0;
  for (const s of r)
    o += Dt(e.slice(a, s.start), n), o += `<mark class="${fa}" ${Fn}="${eu(s.key)}">${Dt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  return o + Dt(e.slice(a), n);
}
const nu = { figure: "图", table: "表", equation: "式" };
function Br(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${nu[e.kind]} ${e.label}`;
}
function pe(e) {
  return typeof e == "string" ? e : "";
}
function ru(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function ou(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function au(e) {
  return {
    source: pe(e == null ? void 0 : e.source_text) || pe(e == null ? void 0 : e.unit_source_text),
    translated: pe(e == null ? void 0 : e.protected_translated_text) || pe(e == null ? void 0 : e.translated_text)
  };
}
const su = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ma(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function iu(e) {
  const t = ma(e).sort((r, o) => pe(r.ts).localeCompare(pe(o.ts)));
  return t.length ? [
    { text: pe(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: pe(r.new_text),
      label: su[pe(r.source)] || pe(r.source) || "修订",
      ts: pe(r.ts),
      reason: pe(r.reason)
    }))
  ].reverse() : [];
}
function cu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function lu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return pe(r.finished_at) || pe(n.finished_at) || "";
}
function uu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ma(e).sort((a, s) => pe(a.ts).localeCompare(pe(s.ts)));
  for (const a of o) {
    const s = new Date(pe(a.ts)).getTime(), i = pe(a.reader_item_id) || pe(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, pe(a.new_text));
  }
  return n;
}
const du = {
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
function fu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = du[pe(n.kind)] || pe(n.kind) || "问题", o = pe(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const mu = /* @__PURE__ */ new Set(["text", "formula"]);
function tr(e) {
  return mu.has(e);
}
function hu(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || tr(Ne(n));
}
function pu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !tr(Ne(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const gu = 300, bu = 72;
function yu(e, t) {
  if (e.width >= gu && e.height >= bu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const vu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function wu(e, t, n) {
  return e.flatMap((r) => {
    if (!vu.has(Ne(r.region))) return [];
    const o = dt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function jr(e, t, n) {
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
async function Su(e) {
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
const ku = "reader-text-hover-copy", Iu = "reader-text-hover-edit", Ru = "reader-text-hover-zoom", Tu = "reader-text-hover-id";
function Eu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const ha = "reader-text-hover-tools";
function en({
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
const Pu = 26, Mu = 220;
function _u(e, t = Mu) {
  return e.height < Pu * 2 || e.width < t;
}
function Nu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Co : e === "failed" ? ft : ws, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Au({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = _("idle"), [u, f] = _("idle"), [d] = _(() => Eu()), m = N([]), g = (e == null ? void 0 : e.itemId) || "";
  if (C(() => {
    l("idle"), f("idle");
    const k = m.current;
    return () => {
      k.forEach((E) => window.clearTimeout(E)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = ms(e.highlight.region, t), y = Ne(e.highlight.region), w = (k, E) => async (L) => {
    L.preventDefault(), L.stopPropagation();
    const z = await Su(k);
    E(z ? "copied" : "failed"), m.current.push(window.setTimeout(() => E("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (_u(b) ? "outside" : "inside");
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
          className: ha,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              en,
              {
                className: Tu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && tr(y) ? /* @__PURE__ */ p(
              en,
              {
                className: Iu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Gn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              en,
              {
                className: ku,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: w(h, l),
                children: /* @__PURE__ */ p(Nu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              en,
              {
                className: Ru,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(vs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Lu(e, t) {
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
function xu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = dt(
      Lu(e, a),
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
const Du = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Cu = 256, Lt = /* @__PURE__ */ new Map();
function Ou(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function pa(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Js(t, { bareLatex: !0 }), o = Ou(n), a = Gs(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Lt.get(t);
  if (!s && (s = Xs(o, r), Lt.set(t, s), Lt.size > Cu)) {
    const i = Lt.keys().next().value;
    i !== void 0 && Lt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function wn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function He(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function zu(e, t) {
  const n = e.typography, r = He(t) || 1, o = He(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = wn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = He(n == null ? void 0 : n.fit_min_font_size_pt), u = He(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = He(n == null ? void 0 : n.leading_em), h = [
    He(n == null ? void 0 : n.padding_top_pt) || 0,
    He(n == null ? void 0 : n.padding_right_pt) || 0,
    He(n == null ? void 0 : n.padding_bottom_pt) || 0,
    He(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Du,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (wn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : wn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function $u(e, t, n, r) {
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
const Fu = 512, xt = /* @__PURE__ */ new Map();
let jn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  jn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  jn += 1;
}));
function Bu(e, t, n, r) {
  return [
    jn,
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
function ga({ item: e, pageScale: t }) {
  const n = N(null), r = V(
    () => pa(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = V(
    () => zu(e, t),
    [e, t]
  );
  C(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Te(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - d - g), S = Bu(o, y, w, s);
    let b = xt.get(S);
    if (b === void 0 && (b = $u(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), xt.set(S, b), xt.size > Fu)) {
      const v = xt.keys().next().value;
      v !== void 0 && xt.delete(v);
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
function ju({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = V(
    () => xu(e, t, n, r),
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
        ga,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Hu = Vt(ju);
function Uu({
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
        ga,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Ne(a.highlight.region),
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
const Wu = Vt(Uu), ba = 24, Xe = ba * 2 + 4, Ue = 24, Ku = 4, Vu = 6, it = (e) => e.left + e.width, tt = (e) => e.top + e.height;
function Ot(e, t) {
  const n = Math.min(it(e), it(t)) - Math.max(e.left, t.left), r = Math.min(tt(e), tt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Hr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= it(t) && r >= t.top && r <= tt(t);
}, qu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Ju(e, t, n) {
  if (!t.length || e.height < Ue || e.width < n + 8) return null;
  const r = Math.max(...t.map(tt)), o = it(e) - 4 - n;
  for (const a of [r, tt(e) - 2]) {
    const s = Math.max(e.top, a - Ue), i = { left: o, top: s, width: n, height: Ue };
    if (!t.some((c) => Ot(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Gu(e, t) {
  const n = [], r = (a) => {
    const s = ba + Ku, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: it(e), top: i, width: s, height: Xe } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Xe } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ue - 3, width: Xe, height: Ue + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: tt(e), width: Xe, height: Ue + 3 } }), r(!0);
  const o = Ju(e, t, Xe);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: it(e) - 4 - Xe, top: e.top + o, width: Xe, height: Ue } }), n;
}
function Xu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !qu(S)), i = s.filter((S) => Hr(S, t)), c = s.filter((S) => !Hr(S, t)), l = n.filter((S) => S !== t && Ot(S, t) < t.width * t.height * 0.5), u = Gu(t, i).filter(({ box: S, overhang: b }) => {
    const v = b ? Vu : 0;
    return S.left >= -v && it(S) <= r + v && S.top >= 0 && tt(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !c.some((b) => Ot(S, b) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((b) => Ot(S.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((v, k) => v + Ot(S.box, k), 0);
    b < w && (y = S, w = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function Zu(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ue - 3 : tt(r);
  return t >= r.left - 4 && t <= r.left + Xe + 4 && n >= a && n <= a + Ue + 3;
}
const Sn = (e) => e.left + e.width, kn = (e) => e.top + e.height;
function Yu(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > Sn(e) || f < e.top || f > kn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, Sn(l)), i = Math.max(i, kn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(Sn(e) + r, s + n) - c.left, c.height = Math.min(kn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function Qu(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function ed(e, t, n, r) {
  const [o, a] = _(null);
  return Te(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Qu(s) : [], c = Ne(t.highlight.region) === "figure", l = i.length && !c ? Yu(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Xu({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const ya = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Ur = { pen: 35e-4, highlighter: 0.018 }, Wr = 0.015, Hn = "retainpdf.reader.ink.v1:";
function Kr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Hn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function td(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Hn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Hn + e);
    } catch {
    }
}
function nd(e, t, n, r, o, a) {
  const s = Wr * Wr;
  return e.filter((i) => va(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function va(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function rd(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function od(e) {
  const [t, n] = _(null), [r, o] = _(ya[0].key), [a, s] = _(() => Kr(e)), i = N(a), c = N([]);
  C(() => {
    const h = Kr(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = x((h) => {
    i.current = h, s(h), td(e, h);
  }, [e]), u = x((h) => {
    const y = i.current, w = h(y);
    w !== y && (c.current = [...c.current.slice(-49), y], l(w));
  }, [l]), f = x((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = x((h) => {
    h.length && u((y) => y.filter((w) => !h.includes(w.id)));
  }, [u]), m = x((h) => {
    u((y) => y.some((w) => w.page === h) ? y.filter((w) => w.page !== h) : y);
  }, [u]), g = x(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return V(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const ad = "reader-ink-layer";
function sd(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Vr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: sd(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function id({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = _(null), i = N(!1), c = o.strokes.filter((h) => va(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(nd(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, w] = u(h);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, w] = u(h);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? rd(S, y, w) : [[y, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Ur[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ D(
    "svg",
    {
      className: ad,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(Vr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Vr, { stroke: { tool: o.tool, color: o.color, width: Ur[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function cd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = _(null), [i, c] = _(!1), [l, u] = _([]), [f, d] = _(""), [m, g] = _(""), [h, y] = _(!1), [w, S] = _(null), [b, v] = _([]), k = r.drafts, E = r.generation, L = x(async (I, R) => {
    if (e)
      try {
        u(iu(await e.fetchRevisions(I, R)));
      } catch {
        u([]);
      }
  }, [e]);
  C(() => {
    if (s(null), u([]), S(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((R) => {
      if (I) return;
      const P = R == null ? void 0 : R.item;
      if (!P) throw new Error("找不到这一段的译文。");
      const T = `${(R == null ? void 0 : R.item_id) || n}`, { source: M, translated: F } = au(P);
      s({ readerItemId: n, itemId: T, source: M, current: F }), d(k.get(n) ?? F);
    }).catch((R) => {
      I || S({ tone: "error", message: (R == null ? void 0 : R.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), L(t, n), () => {
      I = !0;
    };
  }, [e, t, n, L]);
  const z = x((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), O = x(async (I, R) => {
    if (!e || !a || h) return !1;
    const P = I ?? f;
    if (!P.trim()) return !1;
    y(!0), S(null), v([]);
    try {
      const T = await e.revise(t, a.itemId, {
        translated_text: P,
        source: "user",
        reason: (R ?? m).trim() || "在阅读页手动修改",
        ...E.current != null ? { expected_generation: E.current } : {}
      }), M = Number(T == null ? void 0 : T.generation);
      return Number.isFinite(M) && (E.current = M), k.delete(a.readerItemId), s({ ...a, current: P }), d(P), g(""), (T == null ? void 0 : T.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, P), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), L(t, a.readerItemId), !0;
    } catch (T) {
      const M = T;
      return (M == null ? void 0 : M.reason) === "generation_mismatch" && (E.current = null), S({ tone: "error", message: (M == null ? void 0 : M.message) || "保存失败，请稍后再试。" }), v(fu(M == null ? void 0 : M.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, L, k, E]), A = x(() => {
    n && k.delete(n);
  }, [n, k]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: z,
    reason: m,
    setReason: g,
    saving: h,
    status: w,
    issues: b,
    save: O,
    discardDraft: A
  };
}
const wa = "reader-inline-edit";
function ld({ text: e }) {
  const [t, n] = _("");
  return C(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = pa(e);
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
function ud({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var A;
  const s = e.itemId, i = cd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = _(!1), [u, f] = _(!1), d = N(null), m = yu(e.rect, t), g = V(() => pu(o), [o]), h = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: k } = n, E = x((I) => {
    const R = g[h + I];
    R && (k(R), a == null || a(R));
  }, [g, h, k, a]), L = x(() => {
    i.discardDraft(), v();
  }, [i, v]), z = x(async (I, R) => {
    await i.save(I, R) && v();
  }, [i, v]);
  C(() => {
    const I = (R) => {
      !R.altKey || R.key !== "ArrowUp" && R.key !== "ArrowDown" || (R.preventDefault(), E(R.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [E]), Te(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const R = m.mode === "inline" ? m.minHeight : 0;
    I.style.height = `${Math.max(R, I.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const O = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ D($e, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ D(
      "div",
      {
        className: `${wa} is-${m.mode}`,
        style: O,
        role: "group",
        "aria-label": `改第 ${((A = n.target) == null ? void 0 : A.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            Q,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((I) => !I),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            Ks,
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
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || z()) : I.key === "Escape" && (I.preventDefault(), L());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(ld, { text: i.draft }) : null,
          /* @__PURE__ */ D("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(at, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => E(-1), children: /* @__PURE__ */ p(Ss, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(at, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => E(1), children: /* @__PURE__ */ p(Oo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              jo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || z()) : I.key === "Escape" && (I.preventDefault(), L());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ D(
              Q,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p(ks, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(Q, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: L, children: "取消" }),
            /* @__PURE__ */ p(
              Q,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  z();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, R) => {
            const P = I.text === y.current, T = [cu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ D("li", { "data-block-edit-history": I.label, "data-current": P ? "true" : void 0, children: [
              /* @__PURE__ */ D("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ D("span", { children: [
                  T,
                  P ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                P ? null : /* @__PURE__ */ p(
                  Q,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      z(I.text, `回到「${T.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${R}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Sa = qt(null), ka = qt(null);
function dd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Sa.Provider, { value: e, children: /* @__PURE__ */ p(ka.Provider, { value: t, children: n }) });
}
function qe() {
  return st(Sa);
}
function Ia() {
  return st(ka);
}
const Ra = 1.414;
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
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var se, me, be;
  const b = qe(), v = b == null ? void 0 : b.revisedBlocks, k = b == null ? void 0 : b.blockEdit, E = k == null ? void 0 : k.pendingEdits, L = b == null ? void 0 : b.editBlock, z = (b == null ? void 0 : b.findTerm) || "", O = b == null ? void 0 : b.xrefIndex, A = V(
    () => O != null && O.size ? ({ str: H }) => tu(H, O, z) : z ? ({ str: H }) => Dt(H, z) : void 0,
    [z, O]
  ), I = N(c ?? Ra), [R, P] = _(I.current);
  C(() => {
    c != null && Math.abs(c - I.current) >= 1e-3 && (I.current = c, P(c));
  }, [c]);
  const T = N(u);
  T.current = u;
  const M = N(null), F = N((H) => {
    var ee;
    M.current = H, (ee = T.current) == null || ee.call(T, H);
  }).current, $ = N(null), G = N(`${t}@${n}`);
  Te(() => {
    const H = `${t}@${n}`;
    G.current !== H && (G.current = H, o && hd(M.current, $.current));
  }, [o, n, t]), C(() => {
    o || In($.current);
  }, [o]), C(() => () => In($.current), []);
  const J = Math.max(120, Math.floor(t * R)), ae = Math.max(J, Math.ceil(s || 0)), re = dt(f, t, J), j = V(
    () => wu(d, t, J),
    [J, d, t]
  ), [W, U] = _(null), de = typeof g == "function", q = de ? m ?? null : W, K = (H) => {
    de ? H !== (m ?? null) && (g == null || g(H)) : U((ee) => ee === H ? ee : H);
  }, ie = V(
    () => j.find((H) => H.itemId === q) || null,
    [q, j]
  ), ge = r === "translated" && ((se = k == null ? void 0 : k.target) == null ? void 0 : se.itemId) || "", te = V(
    () => ge && j.find((H) => H.itemId === ge) || null,
    [ge, j]
  ), fe = ed(M, o ? ie : null, j, t), ke = (H) => {
    var De, Le, he, ye, Je;
    if (H.pointerType === "touch") return;
    if ((De = b == null ? void 0 : b.ink) != null && De.tool) {
      K(null);
      return;
    }
    if (H.buttons !== 0) {
      K(null);
      return;
    }
    if ((he = (Le = H.target) == null ? void 0 : Le.closest) != null && he.call(Le, `.${ha}`) || (Je = (ye = H.target) == null ? void 0 : ye.closest) != null && Je.call(ye, `.${wa}`)) return;
    const ee = H.currentTarget.getBoundingClientRect(), oe = H.clientX - ee.left, Ae = H.clientY - ee.top;
    if (Zu(fe, oe, Ae)) return;
    const Pe = jr(j, oe, Ae);
    K((Pe == null ? void 0 : Pe.itemId) || null);
  }, nt = (H) => {
    if (H.pointerType === "mouse") return;
    const ee = H.currentTarget.getBoundingClientRect(), oe = jr(
      j,
      H.clientX - ee.left,
      H.clientY - ee.top
    );
    K((oe == null ? void 0 : oe.itemId) || null);
  }, Ee = (H) => {
    !Number.isFinite(H) || H <= 0 || Math.abs(I.current - H) < 1e-3 || (I.current = H, P(H), l == null || l(e, H));
  };
  return /* @__PURE__ */ D(
    "div",
    {
      ref: F,
      [Re]: e,
      [Se]: r,
      [Xn]: J,
      className: Zn,
      onPointerMoveCapture: ke,
      onPointerDown: nt,
      onDoubleClick: (H) => {
        var oe;
        const ee = b == null ? void 0 : b.zoomBlock;
        !ee || (oe = b == null ? void 0 : b.ink) != null && oe.tool || !ie || Ne(ie.highlight.region) === "figure" && (H.preventDefault(), ee(ie.itemId));
      },
      onPointerLeave: (H) => {
        H.pointerType === "mouse" && K(null);
      },
      style: {
        width: t,
        height: ae,
        minHeight: ae
      },
      children: [
        o ? /* @__PURE__ */ p(
          Vs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: A,
            renderAnnotationLayer: !1,
            className: qo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: sn,
                style: { width: t, height: J }
              }
            ),
            onLoadSuccess: (H) => {
              try {
                const ee = H.getViewport({ scale: 1 });
                if (ee.width > 0) {
                  const oe = ee.height / ee.width;
                  Ee(oe);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              In($.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: sn,
            style: { width: t, height: J },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: $, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        re ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: re,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Hu,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: J
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (E != null && E.size) ? /* @__PURE__ */ p(Wu, { targets: j, edits: E, width: t, excludeId: te == null ? void 0 : te.itemId }) : null,
        o && te && k ? /* @__PURE__ */ p(
          ud,
          {
            target: te,
            page: { width: t, height: J },
            edit: k,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: j.filter((H) => v.has(H.itemId)).map((H) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": H.itemId,
            style: { left: H.rect.left, top: H.rect.top, height: H.rect.height }
          },
          H.itemId
        )) }) : null,
        o && (b != null && b.ink) ? /* @__PURE__ */ p(
          id,
          {
            page: e,
            pane: r === "translated" ? "translated" : b.compareVersion ? "compare" : "source",
            width: t,
            height: J,
            ink: b.ink
          }
        ) : null,
        (me = b == null ? void 0 : b.pageLayers) == null ? void 0 : me.map((H) => /* @__PURE__ */ p(ns, { children: H.render({ page: e, height: J }) }, H.id)),
        /* @__PURE__ */ p(
          Au,
          {
            target: o && !((be = b == null ? void 0 : b.ink) != null && be.tool) && (ie == null ? void 0 : ie.itemId) !== (te == null ? void 0 : te.itemId) ? ie : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: ie && (v == null ? void 0 : v.get(ie.itemId)) || 0,
            onEdit: L,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: fe == null ? void 0 : fe.rect,
            placement: fe == null ? void 0 : fe.placement,
            tailTop: fe == null ? void 0 : fe.tailTop
          }
        )
      ]
    }
  );
}
const md = Vt(fd);
function hd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function In(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const pd = 2 * 1024 * 1024;
function gd(e) {
  const t = new Ho.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const Rn = 5, bd = "120% 0px", yd = 120, vd = "25% 0px";
let qr = 1;
const Jr = /* @__PURE__ */ new WeakMap();
function wd(e) {
  if (!e) return 0;
  const t = Jr.get(e);
  if (t) return t;
  const n = qr;
  return qr += 1, Jr.set(e, n), n;
}
function Sd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const kd = No(
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
    regions: w = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: v,
    liveTranslation: k,
    showLiveTranslation: E = t === "source",
    liveTranslationPendingLabel: L = "",
    paneAction: z
  }, O) {
    Ll();
    const { file: A, loading: I, error: R } = Ai(n, r), P = `${n}\0${wd(A)}`, T = N(P);
    T.current = P;
    const M = V(() => {
      const B = Ti(A);
      return B ? "ranged" in B ? { range: gd(B.ranged) } : B : null;
    }, [A, n]), [F, $] = _(0), [G, J] = _(""), [ae, re] = _(null), [j, W] = _(480), U = N(null), de = N(0), q = V(() => Sd(), []), K = V(() => ({
      cMapUrl: jt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: jt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: pd,
      disableAutoFetch: !0
    }), []);
    Jn(O, () => ae, [ae]), C(() => {
      const B = (X) => {
        de.current = X, W(X);
      }, Y = (X) => {
        const le = Qi(X, de.current);
        if (le !== "ignore") {
          if (U.current && clearTimeout(U.current), le === "immediate") {
            B(X);
            return;
          }
          U.current = setTimeout(() => B(X), Yo);
        }
      }, Z = !!(c && c >= 80);
      Y(Z ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ue = !Z && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var le, ve;
        Y(((ve = (le = X[0]) == null ? void 0 : le.contentRect) == null ? void 0 : ve.width) ?? i.clientWidth);
      }) : null;
      return ue && i && ue.observe(i), () => {
        ue == null || ue.disconnect(), U.current && clearTimeout(U.current);
      };
    }, [c, i, a]);
    const ie = V(
      () => Xi(j, o),
      [j, o]
    ), [ge, te] = _(() => /* @__PURE__ */ new Map()), [fe, ke] = _(() => /* @__PURE__ */ new Set()), [nt, Ee] = _(() => /* @__PURE__ */ new Set()), se = N(/* @__PURE__ */ new Map()), me = N(null), be = N(null), [H, ee] = _(() => /* @__PURE__ */ new Set()), oe = N(/* @__PURE__ */ new Map()), Ae = x((B, Y) => {
      te((Z) => {
        if (Z.get(B) === Y) return Z;
        const ne = new Map(Z);
        return ne.set(B, Y), ne;
      });
    }, []), Pe = x((B, Y) => {
      const Z = se.current, ne = Z.get(B), ue = [me.current, be.current];
      if (ne)
        for (const X of ue)
          try {
            X == null || X.unobserve(ne);
          } catch {
          }
      if (Y) {
        Z.set(B, Y);
        for (const X of ue)
          try {
            X == null || X.observe(Y);
          } catch {
          }
      } else
        Z.delete(B);
    }, []), De = N(/* @__PURE__ */ new Map()), Le = x((B) => {
      const Y = De.current;
      let Z = Y.get(B);
      return Z || (Z = (ne) => Pe(B, ne), Y.set(B, Z)), Z;
    }, [Pe]);
    C(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = oe.current, Y = new IntersectionObserver(
        (Z) => {
          const ne = [], ue = [];
          for (const X of Z) {
            const le = X.target, ve = ln(le);
            Number.isFinite(ve) && (X.isIntersecting ? ne : ue).push(ve);
          }
          if ((ne.length || ue.length) && ke((X) => {
            let le = null;
            for (const ve of ne)
              X.has(ve) || (le = le || new Set(X), le.add(ve));
            for (const ve of ue)
              X.has(ve) && (le = le || new Set(X), le.delete(ve));
            return le || X;
          }), ne.length) {
            for (const X of ne) {
              const le = B.get(X);
              le && (clearTimeout(le), B.delete(X));
            }
            Ee((X) => {
              let le = null;
              for (const ve of ne)
                X.has(ve) || (le = le || new Set(X), le.add(ve));
              return le || X;
            });
          }
          for (const X of ue)
            B.has(X) || B.set(X, setTimeout(() => {
              B.delete(X), Ee((le) => {
                if (!le.has(X)) return le;
                const ve = new Set(le);
                return ve.delete(X), ve;
              });
            }, yd));
        },
        { root: i, rootMargin: bd, threshold: 0 }
      );
      me.current = Y;
      for (const Z of se.current.values())
        try {
          Y.observe(Z);
        } catch {
        }
      return () => {
        Y.disconnect(), me.current === Y && (me.current = null);
        for (const Z of B.values()) clearTimeout(Z);
        B.clear();
      };
    }, [i]), C(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = new IntersectionObserver(
        (Y) => {
          ee((Z) => {
            let ne = null;
            for (const ue of Y) {
              const X = ln(ue.target);
              !Number.isFinite(X) || ue.isIntersecting === Z.has(X) || (ne = ne || new Set(Z), ue.isIntersecting ? ne.add(X) : ne.delete(X));
            }
            return ne || Z;
          });
        },
        { root: i, rootMargin: vd, threshold: 0 }
      );
      be.current = B;
      for (const Y of se.current.values())
        try {
          B.observe(Y);
        } catch {
        }
      return () => {
        B.disconnect(), be.current === B && (be.current = null);
      };
    }, [i]);
    const he = !!i && typeof IntersectionObserver < "u";
    Te(() => {
      $(0), J(""), ke(/* @__PURE__ */ new Set()), Ee(/* @__PURE__ */ new Set()), te(/* @__PURE__ */ new Map()), se.current.clear();
      const B = oe.current;
      for (const Y of B.values()) clearTimeout(Y);
      B.clear(), h == null || h(0, t);
    }, [P, h, t]);
    const ye = x(
      (B) => {
        if (T.current !== P) return;
        const Y = B.numPages;
        $(Y), J(""), h == null || h(Y, t), f == null || f({ numPages: Y, pane: t }), m && typeof B.getPage == "function" && m(B, t), d && typeof B.getOutline == "function" && Al(B).then((Z) => {
          T.current === P && d(Z, t);
        }, () => {
        });
      },
      [P, f, d, m, h, t]
    ), Je = x(
      (B) => {
        if (T.current !== P) return;
        const Y = (B == null ? void 0 : B.message) || "PDF 解析失败";
        J(Y), $(0), h == null || h(0, t), g == null || g(B, t);
      },
      [P, g, h, t]
    ), Fe = V(
      () => F > 0 ? Array.from({ length: F }, (B, Y) => Y + 1) : [],
      [F]
    );
    C(() => {
      typeof IntersectionObserver < "u" || Ee(new Set(Fe));
    }, [Fe]);
    const rt = V(
      () => Tt(y, S, t),
      [y, S, t]
    ), pt = V(() => {
      const B = /* @__PURE__ */ new Map();
      for (const Y of w) {
        const Z = Tt(Y, S, t);
        if (!Z) continue;
        const ne = B.get(Z.box.page) || [];
        ne.push(Z), B.set(Z.box.page, ne);
      }
      return B;
    }, [t, S, w]), gt = V(() => {
      const B = /* @__PURE__ */ new Set();
      if (!b) return B;
      for (const [Y, Z] of pt)
        Z.some((ne) => ne.itemId === b) && B.add(Y);
      return B;
    }, [b, pt]), Gt = V(() => {
      if (F === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Fe);
      if (fe.size === 0) {
        const Z = Math.min(F, Rn * 2 + 1);
        return new Set(Array.from({ length: Z }, (ne, ue) => ue + 1));
      }
      const Y = /* @__PURE__ */ new Set();
      for (const Z of fe)
        for (let ne = -Rn; ne <= Rn; ne++) {
          const ue = Z + ne;
          ue >= 1 && ue <= F && Y.add(ue);
        }
      return Y;
    }, [F, Fe, i, a, fe]), bt = !n || !!R || !!G, Xt = n && (R || G) || s;
    return /* @__PURE__ */ D(
      "section",
      {
        ref: re,
        className: `reader-panel ${hn}${a ? "" : " is-hidden"}`,
        [Se]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          z ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: z }) : null,
          L ? /* @__PURE__ */ D("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: L })
          ] }) : null,
          bt && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Xt }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          M && !R ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            qs,
            {
              file: M,
              loading: null,
              error: null,
              options: K,
              onLoadSuccess: ye,
              onLoadError: Je,
              className: "reader-react-pdf-document",
              children: Fe.map((B) => {
                if (Gt.has(B))
                  return /* @__PURE__ */ p(
                    md,
                    {
                      pane: t,
                      pageNumber: B,
                      width: ie,
                      devicePixelRatio: q,
                      active: nt.has(B),
                      textLayer: !he || H.has(B),
                      syncedMinHeight: (l == null ? void 0 : l.get(B)) || 0,
                      onMetrics: u,
                      cachedAspect: ge.get(B),
                      onAspectChange: Ae,
                      sentinelRef: Le(B),
                      regionHighlight: (rt == null ? void 0 : rt.box.page) === B ? rt : null,
                      regionTargets: pt.get(B),
                      hoveredRegionId: b && gt.has(B) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(B - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(B - 1),
                      showLiveTranslation: E,
                      liveTranslationMissing: tl(k, B - 1)
                    },
                    `${t}-${B}`
                  );
                const Z = ge.get(B) ?? Ra, ne = Math.max(120, Math.floor(ie * Z)), ue = Math.max(ne, Math.ceil((l == null ? void 0 : l.get(B)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Le(B),
                    [Re]: B,
                    [Se]: t,
                    [Xn]: ne,
                    className: `${Zn} is-placeholder`,
                    style: {
                      width: ie,
                      height: ue,
                      minHeight: ue
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: sn,
                        style: { width: ie, height: ne },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${B}`
                );
              })
            },
            P
          ) }) : null
        ]
      }
    );
  }
), Gr = Vt(kd), Id = 2e3, Rd = 6, Td = 500, Xr = "reader-react-resizing";
function Ed(e, t) {
  const n = N(null), r = N(null);
  Te(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = Pd(e), k = $t(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const E of v) {
        const L = Math.round(E.contentRect.height);
        y.has(E.target) && y.get(E.target) !== L && (k = !0), y.set(E.target, L);
      }
      k && Et(e, c, "auto", i);
    }), S = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(Xr);
      for (const k of Zr) e.removeEventListener(k, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, b = () => {
      Et(e, c, "auto", i);
      const v = e.scrollHeight;
      g = v === m ? g + 1 : 0, m = v;
      const k = performance.now() - h;
      g >= Rd && (v !== d || k > Td) || k > Id ? S() : u = requestAnimationFrame(b);
    };
    for (const v of Zr) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(Xr), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, Yo);
  }, [e, t]), C(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Pd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Re}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Se) || null;
  }
  return null;
}
const Zr = ["wheel", "touchstart", "keydown", "pointerdown"];
function Md(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function _d(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(hn)) && ((n = e.hasAttribute) != null && n.call(e, Se)));
}
function Nd(e, t) {
  C(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!_d(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${hn}[${Se}]`));
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
function Ad(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Ld(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Yr = 12;
function nr(e) {
  return Array.from(e.querySelectorAll(`.${hn}[${Se}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function xd(e) {
  const t = e.getBoundingClientRect();
  return nr(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(Se) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function Dd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Cd(e, t) {
  return e ? nr(e).find((n) => n.getAttribute(Se) === t) ?? null : null;
}
function Od({ shellEl: e }) {
  const [t, n] = _([]), r = N(0), o = x(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = xd(e);
      n((i) => Dd(i, s) ? i : s);
    }));
  }, [e]);
  C(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, c = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of nr(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(zd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function zd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Yr * 2), r = Ad(e, n), o = N(null);
  if (!r) return null;
  const a = (d) => {
    const m = Cd(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + Ld(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + Yr, width: n },
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
function Ta(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function $d(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Fd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ D("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Ta(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Co, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Is, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ D("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ D(
        Q,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Rs, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ D(
        Q,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Ts, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Qr({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = $d(t), a = [e === "compare" ? "对比" : "正在读", r, Ta(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ D("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
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
  const [r, o] = _({ source: null, translated: null });
  return Te(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${Se}="${l}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Se}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ D("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(Qr, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(Qr, { role: "reading", ...n }) }) : null
  ] });
}
const jd = () => () => {
}, eo = () => null;
function Hd({
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
function Ud(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Wd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Kd(e) {
  const t = qe(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, L = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, z = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), A = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, R = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), P = e.regions ?? (t == null ? void 0 : t.regions) ?? [], T = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), M = (t == null ? void 0 : t.regionHover) ?? null, [F, $] = _(null), G = mn(
    M ? M.subscribe : jd,
    M ? () => M.get().itemId : eo,
    M ? () => M.get().itemId : eo
  ), J = M ? G : F, ae = x((U) => {
    M ? M.set(U, "pdf") : $(U);
  }, [M]), re = Hd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), W = Number.isFinite(g) && g > 0 ? Ud(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Ed(d, W), Nd(d, re.compareMode), /* @__PURE__ */ D(
    "div",
    {
      ref: f,
      className: Vo,
      "data-reader-region-count": P.length,
      "data-reader-structured-region-count": P.filter(hs).length,
      "data-reader-metadata-ready": T ? "true" : "false",
      children: [
        /* @__PURE__ */ D(
          "main",
          {
            className: `${Ko} reader-mode-${re.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Gr,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: E,
                  userZoom: m,
                  visible: re.showSource,
                  scrollRoot: d,
                  pageWidthOverride: W,
                  rowHeights: re.compareMode ? h : void 0,
                  onMetrics: z,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: O,
                  onOutline: b ? void 0 : A,
                  onDocument: b ? void 0 : I,
                  activeRegion: R,
                  regions: (b == null ? void 0 : b.regions) ?? P,
                  readerMetadata: T,
                  hoveredRegionId: J,
                  onHoverRegion: ae,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Wd(o) : "",
                  paneAction: u && re.showTranslated ? /* @__PURE__ */ D($e, { children: [
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
              w ? /* @__PURE__ */ p(
                Gr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: L,
                  userZoom: m,
                  visible: re.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: W,
                  rowHeights: re.compareMode ? h : void 0,
                  onMetrics: z,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: O,
                  onOutline: A,
                  onDocument: I,
                  activeRegion: R,
                  regions: P,
                  readerMetadata: T,
                  hoveredRegionId: J,
                  onHoverRegion: ae,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Od, { shellEl: d }),
        b ? /* @__PURE__ */ p(Bd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Vd = [
  { id: "source", label: "原文", Icon: zo },
  { id: "compare", label: "对照", Icon: $o },
  { id: "translated", label: "译文", Icon: Fo }
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
  const t = qe(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? qd(a.state) : "";
  return /* @__PURE__ */ D("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ D("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Vd.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = Jd({
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
              /* @__PURE__ */ p(Es, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ D(
          Q,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Ps, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ D(
        Q,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(Ms, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const Xd = No(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), Zd = Xd, Yd = {
  markdown: { label: "Markdown", short: "MD", Icon: Zd, needsJob: !0 }
}, Qd = Qo.map(
  (e) => ({ id: e, ...Yd[e] })
);
function Ea() {
  return Qd.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function ef(e) {
  const t = qe(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p($e, { children: Ea().map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
function tf(e) {
  const t = qe(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Ea().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
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
        children: /* @__PURE__ */ p(ft, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function nf(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function rf(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function of(e) {
  return e / 100 * window.innerHeight;
}
function af(e) {
  return e / 100 * window.innerWidth;
}
function sf(e) {
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
  const [o, a] = sf(n);
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
      r = rf(t, o);
      break;
    }
    case "em": {
      r = nf(t, o);
      break;
    }
    case "vh": {
      r = of(o);
      break;
    }
    case "vw": {
      r = af(o);
      break;
    }
  }
  return r;
}
function Ie(e) {
  return parseFloat(e.toFixed(3));
}
function Pt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Un(e) {
  const { panels: t } = e, n = Pt({ group: e });
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
      s = Ie(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ie(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ie(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = Ie(u / n * 100);
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
function ce(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Wn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? cf : lf
  );
}
function cf(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function lf(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Pa(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Ma(e, t) {
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
function uf({
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
    const { x: i, y: c } = Ma(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return ce(o, "No rect found"), o;
}
let tn;
function df() {
  return tn === void 0 && (typeof matchMedia == "function" ? tn = !!matchMedia("(pointer:coarse)").matches : tn = !1), tn;
}
function _a(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Wn(
    n,
    Array.from(t.children).filter(Pa).map((g) => ({ element: g }))
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
          (w) => w.element === h
        );
        if (y) {
          if (d) {
            const w = d.element.getBoundingClientRect(), S = h.getBoundingClientRect();
            let b;
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
                  b = [
                    v,
                    k
                  ];
                  break;
                }
                case 1: {
                  const E = m[0], L = uf({
                    orientation: n,
                    rects: [w, S],
                    targetRect: E.element.getBoundingClientRect()
                  });
                  b = [
                    E,
                    L === w ? k : v
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
            for (const v of b) {
              let k = "width" in v ? v : v.element.getBoundingClientRect();
              const E = df() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < E) {
                const z = E - k.width;
                k = new DOMRect(
                  k.x - z / 2,
                  k.y,
                  k.width + z,
                  k.height
                );
              }
              if (k.height < E) {
                const z = E - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - z / 2,
                  k.width,
                  k.height + z
                );
              }
              const L = g <= l || g > u;
              !i && !L && s.push({
                group: e,
                groupSize: Pt({ group: e }),
                panels: [d, y],
                separator: "width" in v ? void 0 : v,
                rect: k
              }), i = !1;
            }
          }
          c = !1, d = y, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (w) => w.element === h
        );
        y ? m.push(y) : (d = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var Ze;
class Na {
  constructor() {
    wr(this, Ze, {});
  }
  addListener(t, n) {
    const r = _t(this, Ze)[t];
    return r === void 0 ? _t(this, Ze)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = _t(this, Ze)[t];
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
    Sr(this, Ze, {});
  }
  removeListener(t, n) {
    const r = _t(this, Ze)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ze = new WeakMap();
let It = {
  cursorFlags: 0,
  state: "inactive"
};
const rr = new Na();
function ct() {
  return It;
}
function ff(e) {
  return rr.addListener("change", e);
}
function mf(e) {
  const t = It, n = { ...It };
  n.cursorFlags = e, It = n, rr.emit("change", {
    prev: t,
    next: n
  });
}
function Rt(e) {
  const t = It;
  It = e, rr.emit("change", {
    prev: t,
    next: e
  });
}
const hf = (e) => e, Tn = () => {
}, Aa = 1, La = 2, xa = 4, Da = 8, to = 3, no = 12;
let nn;
function ro() {
  return nn === void 0 && (nn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (nn = !0)), nn;
}
function pf({
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
        if (e && ro()) {
          const a = (e & Aa) !== 0, s = (e & La) !== 0, i = (e & xa) !== 0, c = (e & Da) !== 0;
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
    return ro() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const oo = /* @__PURE__ */ new WeakMap();
function or(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = oo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = ct();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = pf({
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
  oo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Oe = /* @__PURE__ */ new Map();
const Ca = new Na();
function gf(e) {
  Oe = new Map(Oe), Oe.delete(e);
}
function ao(e, t) {
  for (const [n] of Oe)
    if (n.id === e)
      return n;
}
function et(e, t) {
  for (const [n, r] of Oe)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function mt() {
  return Oe;
}
function ar(e, t) {
  return Ca.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ke(e, t, n) {
  const r = Oe.get(e);
  Oe = new Map(Oe), Oe.set(e, t), Ca.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Oa(e) {
  const t = ct();
  let n = !1;
  switch (t.state) {
    case "active":
      Rt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (or(e), n = !0, t.hitRegions.forEach((r) => {
        const o = et(r.group.id, !0);
        Ke(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function so(e) {
  e.defaultPrevented || Oa(e.currentTarget);
}
function bf(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Ma(n, a.rect);
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
function yf(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function vf(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: lo(e),
    b: lo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ce(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: co(io(n.a)),
    b: co(io(n.b))
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
const wf = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Sf(e) {
  const t = getComputedStyle(za(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function kf(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Sf(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || wf.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function io(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ce(n, "Missing node"), kf(n)) return n;
  }
  return null;
}
function co(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function lo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = za(e);
  return t;
}
function za(e) {
  const { parentNode: t } = e;
  return yf(t) ? t.host : t;
}
function If(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Rf({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Pa(n) || n.contains(e) || e.contains(n))
    return !0;
  if (vf(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (If(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function sr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = _a(o), s = bf(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Rf({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Tf(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function we(e, t, n = 0) {
  return Math.abs(Ie(e) - Ie(t)) <= n;
}
function Ce(e, t) {
  return we(e, t) ? 0 : e > t ? 1 : -1;
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
  if (Ce(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Ce(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Ie(r), r;
}
function Ut({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (we(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  ce(u != null, "Invalid first pivot index"), ce(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, y = n[h];
        ce(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const v = i[h];
          if (ce(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), we(v, w)) {
            const k = b - v;
            Ce(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : f, y = n[h];
        ce(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const v = i[h];
          if (ce(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), we(v, b)) {
            const k = v - w;
            Ce(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, y = n[h];
      ce(
        y,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: S, collapsedSize: b, minSize: v } = y;
      if (S && Ce(w, v) < 0)
        if (e > 0) {
          const k = v - b, E = k / 2, L = w + e;
          Ce(L, v) < 0 && (e = Ce(e, E) <= 0 ? 0 : k);
        } else {
          const k = v - b, E = 100 - k / 2, L = w - e;
          Ce(L, v) < 0 && (e = Ce(100 + e, E) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const b = i[y];
      ce(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const v = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (w += v, y += h, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? u : f;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), w = i[h];
      ce(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = w - y, b = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: S
      });
      if (!we(w, b) && (d += w - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Tf(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    ce(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = y + d, S = kt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: w
    });
    if (l[h] = S, !we(S, w)) {
      let b = w - S, v = e < 0 ? f : u;
      for (; v >= 0 && v < n.length; ) {
        const k = l[v];
        ce(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const E = k + b, L = kt({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: E
        });
        if (we(k, L) || (b -= L - k, l[v] = L), we(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!we(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, w) => (h[g[w]] = y, h), {});
}
function lt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ce(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function ut({
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
  if (!we(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      ce(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    ce(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    ce(l != null, `No layout data found for index ${i}`);
    const u = kt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!we(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      ce(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = kt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, we(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function $a({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = mt();
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
    if (h && c < d && (g || l.slice(0, m).every((y, w) => {
      const S = f[w];
      return (S == null ? void 0 : S.collapsible) && we(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = l.slice(0, m).reduce((w, S) => w + u[S.id], 0);
      return {
        ...u,
        [t]: Ie(100 - y)
      };
    }
    return Ut({
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
    }), w = ut({
      layout: y,
      panelConstraints: f
    });
    lt(g, w) || Ke(d, {
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
      return c && we(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = Pt({ group: l }), d = zt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ie(d / f * 100);
      i(m);
    }
  };
}
function uo(e) {
  if (e.defaultPrevented)
    return;
  const t = mt();
  sr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = $a({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function rn(e) {
  const t = mt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Fa({
  groupId: e
}) {
  const t = () => {
    const n = mt();
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
      } = t(), l = ut({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (lt(i, l) || Ke(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function ot(e, t) {
  const n = rn(e), r = et(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ce(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ce(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Fa({ groupId: n.id }).getLayout(), c = Ut({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = ut({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  lt(i, l) || Ke(
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
function fo(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = rn(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ot(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ot(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ot(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ot(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ot(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = rn(t), o = et(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        ce(c, "Matching separator not found");
        const l = i.get(c);
        ce(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (ce(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], m = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ot(t, m - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = rn(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        ce(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), ot(t, -100);
        break;
      }
    }
}
function mo(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = mt(), n = sr(e, t), r = /* @__PURE__ */ new Map();
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
function Ba({
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
    const y = r.get(u), w = o.get(u);
    if (!y || !w)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: b,
      groupSize: v,
      layout: k,
      separatorToPanels: E
    } = w;
    if (b && k && E) {
      const L = Ut({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((z) => m.indexOf(z)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (lt(L, k)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Aa : La;
              break;
            }
            case "vertical": {
              i |= h < 0 ? xa : Da;
              break;
            }
          }
      } else
        Ke(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: L,
          separatorToPanels: E
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & to : c |= i & to, t.movementY === 0 ? c |= s & no : c |= i & no, mf(c), or(e);
}
function ho(e) {
  const t = mt(), n = ct();
  switch (n.state) {
    case "active":
      Ba({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function po(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = ct(), n = mt();
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
          const s = et(a.group.id, !0);
          Ke(a.group, s, {
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
      Ba({
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
      const a = sr(e, n);
      a.length === 0 ? t.state !== "inactive" && Rt({
        cursorFlags: 0,
        state: "inactive"
      }) : Rt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), or(e.currentTarget);
      break;
    }
  }
}
function go(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (ct().state) {
      case "hover":
        Rt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function bo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Oa(e.currentTarget) && e.preventDefault();
}
function yo(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Ie(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Ie((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Ef(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = Pt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Ie(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Pf(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Mf({
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
        const m = d / 100 * n, g = Ie(
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
      u[f] = Ie(
        d / a * l
      );
    }
  else {
    const f = Ie(
      l / c.length
    );
    for (const d of c)
      u[d] = f;
  }
  return u;
}
function _f(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const yt = /* @__PURE__ */ new Map();
function Nf(e) {
  let t = !0;
  ce(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: w } = h;
      if (w === e.element) {
        if (t) {
          const S = Pt({ group: e });
          if (S === 0)
            return;
          const b = et(e.id);
          if (!b)
            return;
          const v = Un(e), k = b.defaultLayoutDeferred ? yo(v) : b.layout, E = Mf({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: k
          }), L = ut({
            layout: E,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && lt(b.layout, L) && Pf(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === S)
            return;
          Ke(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: L,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        Ef(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    ce(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Pt({ group: e }), i = Un(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (_f(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? yo(i), f = ut({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  yt.set(
    d,
    (yt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return _a(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Ke(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    ce(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", fo);
  }), yt.get(d) === 1 && (d.addEventListener("contextmenu", so, !0), d.addEventListener("dblclick", uo, !0), d.addEventListener("pointerdown", mo, !0), d.addEventListener("pointerleave", ho), d.addEventListener("pointermove", po), d.addEventListener("pointerout", go), d.addEventListener("pointerup", bo, !0)), function() {
    t = !1, yt.set(
      d,
      Math.max(0, (yt.get(d) ?? 0) - 1)
    ), gf(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", fo);
    }), yt.get(d) || (d.removeEventListener(
      "contextmenu",
      so,
      !0
    ), d.removeEventListener(
      "dblclick",
      uo,
      !0
    ), d.removeEventListener(
      "pointerdown",
      mo,
      !0
    ), d.removeEventListener("pointerleave", ho), d.removeEventListener("pointermove", po), d.removeEventListener("pointerout", go), d.removeEventListener("pointerup", bo, !0)), a.disconnect();
  };
}
function Af() {
  const [e, t] = _({}), n = x(() => t({}), []);
  return [e, n];
}
function ir(e) {
  const t = Ao();
  return `${e ?? t}`;
}
const ht = typeof window < "u" ? Te : C;
function Ft(e) {
  const t = N(e);
  return ht(() => {
    t.current = e;
  }, [e]), x(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function cr(...e) {
  return Ft((t) => {
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
function lr(e) {
  const t = N({ ...e });
  return ht(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ja = qt(null);
function Lf(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: hf
  });
  Jn(t, () => n.current, []), ht(() => {
    Object.assign(
      n.current,
      Fa({ groupId: e })
    );
  });
}
function Ha({
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
  }), h = Ft((I) => {
    lt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), y = Ft(
    (I, R) => {
      lt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: R }));
    }
  ), w = ir(i), S = N(null), [b, v] = Af(), k = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), E = cr(S, a);
  Lf(w, s);
  const L = Ft(
    (I, R) => {
      const P = ct(), T = ao(I), M = et(I);
      if (M) {
        let F = !1;
        switch (P.state) {
          case "active": {
            F = P.hitRegions.some(
              ($) => $.group === T
            );
            break;
          }
        }
        return {
          flexGrow: M.layout[R] ?? 1,
          pointerEvents: F ? "none" : void 0
        };
      }
      if (n != null && n[R])
        return {
          flexGrow: n == null ? void 0 : n[R]
        };
    }
  ), z = lr({
    defaultLayout: n,
    disableCursor: r
  }), O = V(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: L,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const R = k.current;
        return R.panels = Wn(u, [
          ...R.panels,
          I
        ]), v(), () => {
          R.panels = R.panels.filter(
            (P) => P !== I
          ), v();
        };
      },
      registerSeparator: (I) => {
        const R = k.current;
        return R.separators = Wn(u, [
          ...R.separators,
          I
        ]), v(), () => {
          R.separators = R.separators.filter(
            (P) => P !== I
          ), v();
        };
      },
      updatePanelProps: (I, { disabled: R }) => {
        const P = k.current.panels.find(
          (F) => F.id === I
        );
        P && (P.panelConstraints.disabled = R);
        const T = ao(w), M = et(w);
        T && M && Ke(T, {
          ...M,
          derivedPanelConstraints: Un(T)
        });
      },
      updateSeparatorProps: (I, {
        disabled: R,
        disableDoubleClick: P
      }) => {
        const T = k.current.separators.find(
          (M) => M.id === I
        );
        T && (T.disabled = R, T.disableDoubleClick = P);
      }
    }),
    [L, w, v, u, z]
  ), A = N(null);
  return ht(() => {
    const I = S.current;
    if (I === null)
      return;
    const R = k.current;
    let P;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === R.panels.length) {
      P = {};
      for (const ae of R.panels) {
        const re = z.defaultLayout[ae.id];
        re !== void 0 && (P[ae.id] = re);
      }
    }
    const T = {
      disabled: !!o,
      element: I,
      id: w,
      mutableState: {
        defaultLayout: P,
        disableCursor: !!z.disableCursor,
        expandedPanelSizes: k.current.lastExpandedPanelSizes,
        layouts: k.current.layouts
      },
      orientation: u,
      panels: R.panels,
      resizeTargetMinimumSize: R.resizeTargetMinimumSize,
      separators: R.separators
    };
    A.current = T;
    const M = Nf(T), { defaultLayoutDeferred: F, derivedPanelConstraints: $, layout: G } = et(T.id, !0);
    !F && $.length > 0 && (h(G), y(G, !1));
    const J = ar(w, (ae) => {
      const { defaultLayoutDeferred: re, derivedPanelConstraints: j, layout: W } = ae.next;
      if (re || j.length === 0)
        return;
      const U = T.panels.map(({ id: q }) => q).join(",");
      T.mutableState.layouts[U] = W, j.forEach((q) => {
        if (q.collapsible) {
          const { layout: K } = ae.prev ?? {};
          if (K) {
            const ie = we(
              q.collapsedSize,
              W[q.panelId]
            ), ge = we(
              q.collapsedSize,
              K[q.panelId]
            );
            ie && !ge && (T.mutableState.expandedPanelSizes[q.panelId] = K[q.panelId]);
          }
        }
      });
      const de = ct().state !== "active";
      h(W), de && y(W, ae.isUserInteraction);
    });
    return () => {
      A.current = null, M(), J();
    };
  }, [
    o,
    w,
    y,
    h,
    u,
    b,
    z
  ]), C(() => {
    const I = A.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ja.Provider, { value: O, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
      ref: E,
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
Ha.displayName = "Group";
function ur() {
  const e = st(ja);
  return ce(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function xf(e, t) {
  const { id: n } = ur(), r = N({
    collapse: Tn,
    expand: Tn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Tn
  });
  Jn(t, () => r.current, []), ht(() => {
    Object.assign(
      r.current,
      $a({ groupId: n, panelId: e })
    );
  });
}
function Kn({
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
  const h = !!c, y = ir(c), w = lr({
    disabled: a
  }), S = N(null), b = cr(S, s), {
    getPanelStyles: v,
    id: k,
    orientation: E,
    registerPanel: L,
    updatePanelProps: z
  } = ur(), O = f !== null, A = Ft(
    (T, M, F) => {
      f == null || f(T, c, F);
    }
  );
  ht(() => {
    const T = S.current;
    if (T !== null) {
      const M = {
        element: T,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: O ? A : void 0,
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
      return L(M);
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
    A,
    L,
    w
  ]), C(() => {
    z(y, { disabled: a });
  }, [a, y, z]), xf(y, d);
  const I = () => {
    const T = v(k, y);
    if (T)
      return JSON.stringify(T);
  }, R = mn(
    (T) => ar(k, T),
    I,
    I
  );
  let P;
  return R ? P = JSON.parse(R) : o !== void 0 ? P = {
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
        ...Df,
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
            touchAction: E === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Kn.displayName = "Panel";
const Df = {
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
function Cf({
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
    a = ut({
      layout: Ut({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = ut({
      layout: Ut({
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
function Ua({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = ir(a), l = lr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = _({}), [d, m] = _("inactive"), [g, h] = _(!1), y = N(null), w = cr(y, o), {
    disableCursor: S,
    id: b,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: E
  } = ur(), L = v === "horizontal" ? "vertical" : "horizontal";
  ht(() => {
    const A = y.current;
    if (A !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: A,
        id: c
      }, R = k(I), P = ff(
        (M) => {
          m(
            M.next.state !== "inactive" && M.next.hitRegions.some(
              (F) => F.separator === I
            ) ? M.next.state : "inactive"
          );
        }
      ), T = ar(
        b,
        (M) => {
          const { derivedPanelConstraints: F, layout: $, separatorToPanels: G } = M.next, J = G.get(I);
          if (J) {
            const ae = J[0], re = J.indexOf(ae);
            f(
              Cf({
                layout: $,
                panelConstraints: F,
                panelId: ae.id,
                panelIndex: re
              })
            );
          }
        }
      );
      return () => {
        P(), T(), R();
      };
    }
  }, [b, c, k, l]), C(() => {
    E(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, E]);
  let z;
  n && !S && (z = "not-allowed");
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
      "aria-orientation": L,
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
      ref: w,
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
Ua.displayName = "Separator";
const dr = 30, fr = 65, Wt = 50, Of = 100 - fr, zf = 100 - dr;
function $f(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(fr, Math.max(dr, t)) : Wt;
}
function mr(e) {
  return 100 - e;
}
function vt(e) {
  return `${e}%`;
}
const hr = "reader-document", Kt = "reader-assistant", Wa = "retainpdf.reader.ai-split-layout.v1", Ff = {
  [hr]: mr(Wt),
  [Kt]: Wt
};
function pr(e) {
  const t = $f(e == null ? void 0 : e[Kt]);
  return {
    [hr]: mr(t),
    [Kt]: t
  };
}
function Bf() {
  try {
    const e = JSON.parse(localStorage.getItem(Wa) || "null");
    return pr(e);
  } catch {
    return Ff;
  }
}
function jf(e) {
  try {
    localStorage.setItem(Wa, JSON.stringify(pr(e)));
  } catch {
  }
}
function En(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = pr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Kt]}vw`
  );
}
function Hf() {
  const e = N(null), [t] = _(Bf);
  Te(() => {
    const o = e.current;
    return En(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = x((o) => {
    En(e.current, o);
  }, []), r = x((o, a) => {
    En(e.current, o), a.isUserInteraction && jf(o);
  }, []);
  return /* @__PURE__ */ D(
    Ha,
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
          Kn,
          {
            id: hr,
            defaultSize: vt(mr(Wt)),
            minSize: vt(Of),
            maxSize: vt(zf)
          }
        ),
        /* @__PURE__ */ p(
          Ua,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Kn,
          {
            id: Kt,
            defaultSize: vt(Wt),
            minSize: vt(dr),
            maxSize: vt(fr)
          }
        )
      ]
    }
  );
}
function Uf({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = _(!1);
  if (C(() => {
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
function Wf({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Uf, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ D($e, { children: [
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
      s ? /* @__PURE__ */ p(Q, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
const Ka = [];
function Kf() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = Ka;
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
function Vf(e, t) {
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
function qf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function Jf(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const gn = qt(null), Va = qt(null);
function Gf({ api: e, store: t, children: n }) {
  const r = V(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(gn.Provider, { value: r, children: n });
}
function Xf() {
  const e = st(gn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const Zf = () => () => {
}, vo = () => Ka;
function Yf(e) {
  return mn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Qf() {
  var t;
  const e = (t = st(gn)) == null ? void 0 : t.store;
  return mn((e == null ? void 0 : e.subscribe) ?? Zf, (e == null ? void 0 : e.getSnapshot) ?? vo, (e == null ? void 0 : e.getSnapshot) ?? vo);
}
function em(e) {
  var a;
  const t = (a = st(gn)) == null ? void 0 : a.store, n = st(Va);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  C(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), C(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class tm extends rs {
  constructor() {
    super(...arguments);
    yr(this, "state", { failed: !1 });
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
const nm = Vt(function({ extensions: t }) {
  return /* @__PURE__ */ p($e, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(tm, { id: n, children: /* @__PURE__ */ p(rm, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function rm({ id: e, title: t, children: n }) {
  const r = V(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(Va.Provider, { value: r, children: n });
}
function om(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function am() {
  const [e, t] = _(!1), n = Ao(), r = N(null), o = Qf(), a = V(() => [...hl, ...Jf(o)], [o]);
  return C(() => {
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
  }, [e]), C(() => {
    const s = (i) => {
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || om(i.target)) return;
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
        children: /* @__PURE__ */ p(_s, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
const sm = ["source", "sideBySide", "translated"], im = { source: "", translated: "", sideBySide: "" };
function cm(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = on(e.sourceUrl), n = on(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return si({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function lm(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = V(
    () => e ? cm(e) : im,
    [e]
  ), o = V(
    () => sm.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = x(async (s) => {
    if (!e) return;
    const i = on(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? ai(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ii(
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
        ci(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const um = {
  source: zo,
  sideBySide: $o,
  translated: Fo
}, dm = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function fm(e) {
  const t = qe(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = lm(n), i = N(null);
  return C(() => {
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
      /* @__PURE__ */ p(Ns, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(Oo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = ss[c], u = on(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : is(c, r), g = um[c];
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
                dm[c],
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
const mm = "retainpdf:reader:bookmarks:v1:", hm = 200;
function gr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function qa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${mm}${t}` : "";
}
function pm(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function fn(e, t = gr()) {
  const n = qa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = pm(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Vn(e, t, n) {
  const r = qa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, hm);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function gm(e, t, n = "", { storage: r = gr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = fn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Vn(e, a.filter((i) => i.page !== s), r) : Vn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function bm(e, t, n = gr()) {
  return Vn(e, fn(e, n).filter((r) => r.page !== t), n);
}
function ym(e, t) {
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
function vm({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function wm({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = _(() => fn(e)), [i, c] = _(!1), l = N(null);
  if (C(() => {
    s(fn(e)), c(!1);
  }, [e]), C(() => {
    if (!i) return;
    const d = (g) => {
      l.current && !l.current.contains(g.target) && c(!1);
    }, m = (g) => {
      g.key === "Escape" && c(!1);
    };
    return document.addEventListener("pointerdown", d), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", d), document.removeEventListener("keydown", m);
    };
  }, [i]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), f = a.some((d) => d.page === u);
  return /* @__PURE__ */ D("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(gm(e, u, ym(r, u))),
        children: /* @__PURE__ */ p(vm, { filled: f })
      }
    ),
    a.length ? /* @__PURE__ */ D(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": i,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        onClick: () => c((d) => !d),
        children: [
          /* @__PURE__ */ p(As, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ D("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ D(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), c(!1);
          },
          children: [
            /* @__PURE__ */ D("span", { className: "reader-bookmark-page", children: [
              "第 ",
              d.page,
              " 页"
            ] }),
            d.label ? /* @__PURE__ */ p("span", { className: "reader-bookmark-label", children: d.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${d.page} 页的书签`,
          onClick: () => s(bm(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function Sm(e) {
  const [t, n] = _([]);
  return C(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Ve().loadIssues;
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
function km(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Im = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Rm = ["failed", "content", "layout"];
function Tm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Em({ jobId: e, currentPage: t }) {
  var f;
  const n = Sm(e), r = (f = qe()) == null ? void 0 : f.jumpToBlock, [o, a] = _(!1), [s, i] = _(-1), c = N(null);
  C(() => i(-1), [n]);
  const l = (d) => {
    const m = n[d];
    !m || !r || (i(d), r(m.readerItemId));
  }, u = N({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, C(() => {
    const d = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || Tm(m.target)) return;
      const { issues: g, last: h, currentPage: y, goTo: w } = u.current, S = km(g, h, y, m.shiftKey);
      S < 0 || (m.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), C(() => {
    if (!o) return;
    const d = (m) => {
      var g;
      (g = c.current) != null && g.contains(m.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ D("div", { className: "reader-react-hud-group reader-issues", ref: c, "aria-label": "待处理", children: [
    /* @__PURE__ */ D(
      Q,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ p(Ls, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ D("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      Rm.map((d) => {
        const m = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === d);
        return m.length ? /* @__PURE__ */ D("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ D("h4", { children: [
            Im[d],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: g, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(
            Q,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                l(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ D("span", { className: "reader-issues-page", children: [
                  "第 ",
                  g.page,
                  " 页"
                ] }),
                g.detail ? /* @__PURE__ */ p("span", { className: "reader-issues-detail", children: g.detail }) : null
              ]
            }
          ) }, `${g.kind}:${g.readerItemId}`)) })
        ] }, d) : null;
      })
    ] }) : null
  ] }) : null;
}
const Pm = 48, Mm = 96, _m = 700;
function Nm(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Pm, downSoFar: r };
}
function Am(e) {
  const [t, n] = _(!1), r = N(0);
  return C(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), c = () => {
      const d = e.current;
      return !!(d && (d.querySelector(":focus-visible") || d.querySelector("[aria-expanded='true']")));
    }, l = (d) => {
      const m = d.target;
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${Re}]`)), !i.get(m))) return;
      const g = m.scrollTop, h = o.get(m);
      if (o.set(m, g), h === void 0 || Date.now() - a > _m) return;
      const y = Nm(!1, r.current, g - h);
      r.current = y.downSoFar, g - h < -4 ? n(!1) : y.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - Mm && (r.current = 0, n(!1));
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
function Lm(e) {
  const t = qe(), n = Ia(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Gi(a), f = a > Jo + 1e-3, d = a < un - 1e-3, m = St(r, Qe()), g = m >= un ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = N(null), y = Am(h), [w, S] = _(!1), [b, v] = _(`${i}`);
  C(() => {
    w || v(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, w]);
  const k = () => {
    if (S(!1), !l || c <= 0)
      return;
    const E = Number(`${b}`.trim());
    l(dn(E, c));
  };
  return /* @__PURE__ */ D("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ D(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (E) => {
          E.preventDefault(), k();
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
              value: b,
              autoFocus: !0,
              onChange: (E) => v(E.target.value.replace(/[^\d]/g, "")),
              onBlur: k,
              onKeyDown: (E) => {
                E.key === "Escape" && (E.preventDefault(), S(!1), v(`${i}`));
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
      wm,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(Em, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      Q,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(xm, {})
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
          onClick: () => s(Ht(a, -1)),
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
          onClick: () => s(Ht(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(am, {}) })
  ] });
}
function xm() {
  return /* @__PURE__ */ D("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function wo(e) {
  var t, n;
  return ea(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Dm(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: wo(ze(e))
  }));
  C(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: wo(ze(e))
    });
  }, [e]), C(() => {
    t.scope === e && pn(t.scope, {
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
const qn = "download-toast";
function Cm({
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
function Om(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    An.dismiss(qn);
    return;
  }
  An.custom(
    () => /* @__PURE__ */ p(Cm, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: qn, duration: 1 / 0 }
  );
}
function zm() {
  const e = x((t) => {
    t && (t.setState = Om, t.hide = () => An.dismiss(qn));
  }, []);
  return /* @__PURE__ */ D($e, { children: [
    /* @__PURE__ */ p(ys, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function $m(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
function Fm(e, t) {
  const n = e === t;
  return { open: n, mounted: $m(n) };
}
const So = { itemId: null, origin: null };
function Bm() {
  let e = So;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? So : { itemId: n, origin: r };
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
function jm({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = V(() => da(e, t), [e, t]), [o, a] = _(() => /* @__PURE__ */ new Set([...Or(r), ...r ? [r] : []]));
  C(() => {
    a(/* @__PURE__ */ new Set([...Or(r), ...r ? [r] : []]));
  }, [e]);
  const s = N(null);
  C(() => {
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
          Q,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(Bo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ D(
          Q,
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
const Hm = [], Um = [];
function Wm({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ D("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(Q, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Ds, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Km({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    Q,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(xs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Vm({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = Um,
  onJumpPage: l
}) {
  var A, I;
  const u = ((A = qe()) == null ? void 0 : A.regions) ?? Hm, f = ((I = Ia()) == null ? void 0 : I.currentPage) ?? 1, d = V(() => Fl(u), [u]), m = c.length > 0 && !!l, [g, h] = _("bookmarks"), y = m && (g === "bookmarks" || !d.length), w = Bl(d, f), S = V(() => Ul(u, s), [u, s]), [b, v] = _(-1);
  C(() => v(-1), [s]);
  const k = N(null), E = N(null), L = N(n);
  L.current = n, C(() => {
    const R = (T) => {
      var F, $;
      const M = T.target;
      !M || (F = E.current) != null && F.contains(M) || ($ = M.closest) != null && $.call(M, ".reader-finder-toggles, [data-finder-toggle]") || L.current();
    }, P = (T) => {
      T.key === "Escape" && L.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", P), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", P);
    };
  }, []);
  const z = N(null);
  C(() => {
    var R, P, T;
    e === "search" ? (R = k.current) == null || R.focus() : (T = (P = z.current) == null ? void 0 : P.querySelector('[aria-current="location"]')) == null || T.scrollIntoView({ block: "center" });
  }, [e, i]), C(() => {
    var R, P;
    e === "search" && b >= 0 && ((P = (R = z.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null || P.scrollIntoView({ block: "nearest" }));
  }, [e, b]);
  const O = (R) => {
    const P = S[R];
    P && (v(R), r(P.itemId));
  };
  return /* @__PURE__ */ D("aside", { ref: E, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ D("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(Q, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(Q, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(Q, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(ft, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && m && d.length ? /* @__PURE__ */ D("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(Q, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ p(Q, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && l ? /* @__PURE__ */ p(jm, { nodes: c, currentPage: f, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: z, className: "reader-finder-list", children: d.map((R, P) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(
      Q,
      {
        className: "reader-finder-entry",
        "data-level": R.level,
        "aria-current": P === w ? "location" : void 0,
        onClick: () => r(R.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: R.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
        ]
      }
    ) }, R.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ D($e, { children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          jo,
          {
            ref: k,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (R) => a(R.target.value),
            onKeyDown: (R) => {
              R.key === "Enter" ? (R.preventDefault(), O(Wl(b, S.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: S.length === 0 ? "没有找到" : `${b >= 0 ? `第 ${b + 1} / ` : ""}${S.length >= 200 ? "200+ 处，只列前 200 处" : `${S.length} 处`}${b < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: S.map((R, P) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(Q, { className: "reader-finder-entry is-hit", "aria-current": P === b ? "true" : void 0, onClick: () => O(P), children: [
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
function qm({ active: e, compare: t, ink: n }) {
  const [r, o] = _(!1), [a, s] = _(!1), i = N(null);
  C(() => {
    if (!r && !a) return;
    const l = () => {
      o(!1), s(!1);
    }, u = (d) => {
      var m;
      (m = i.current) != null && m.contains(d.target) || l();
    }, f = (d) => {
      d.key === "Escape" && l();
    };
    return document.addEventListener("pointerdown", u, !0), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", u, !0), document.removeEventListener("keydown", f);
    };
  }, [r, a]);
  const c = !!(t.compared || t.loading);
  return /* @__PURE__ */ D("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(Fd, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ D("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        Q,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(Gn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(ef, { active: e }),
      t.available ? /* @__PURE__ */ p(
        Q,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": c || a,
          "data-toolball-item": "compare",
          onClick: () => s((l) => !l),
          children: /* @__PURE__ */ p(Cs, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ p(
      Q,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || c ? "true" : void 0,
        onClick: () => {
          o((l) => !l), s(!1);
        },
        children: r ? /* @__PURE__ */ p(ft, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Os, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Jm = [
  { tool: "pen", label: "画笔", Icon: Gn },
  { tool: "highlighter", label: "荧光笔", Icon: zs },
  { tool: "eraser", label: "橡皮", Icon: $s }
];
function Ja(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ga({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ D($e, { children: [
    Jm.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    ya.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(Q, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Fs, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      Q,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Bs, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ p(ft, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Gm({
  ink: e,
  menu: t,
  onClose: n,
  actions: r = []
}) {
  const o = N(null);
  if (C(() => {
    if (!t) return;
    const c = (u) => {
      var f;
      (f = o.current) != null && f.contains(u.target) || n();
    }, l = (u) => {
      u.key === "Escape" && n();
    };
    return document.addEventListener("pointerdown", c, !0), document.addEventListener("keydown", l), () => {
      document.removeEventListener("pointerdown", c, !0), document.removeEventListener("keydown", l);
    };
  }, [t, n]), !t) return null;
  const a = 380, s = Math.max(8, Math.min(t.x, (globalThis.innerWidth || a) - a - 8)), i = Math.max(68, Math.min(t.y, (globalThis.innerHeight || 600) - 60 - (r.length ? 40 : 0)));
  return /* @__PURE__ */ D("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    r.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: r.map((c) => /* @__PURE__ */ D(
      Q,
      {
        className: "reader-ink-menu-action",
        role: "menuitem",
        title: c.hint,
        onClick: () => {
          c.onSelect(), n();
        },
        children: [
          c.label,
          c.hint ? /* @__PURE__ */ p("kbd", { children: c.hint }) : null
        ]
      },
      c.key
    )) }) : null,
    /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Ga, { ink: e, page: t.page, onPick: n }) })
  ] });
}
function Xm({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Ga, { ink: e }) }) : null;
}
function Zm(e) {
  var r;
  if (e.shiftKey || Ja(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Vo}`))) return null;
  const n = Number((r = t.closest(`[${Re}]`)) == null ? void 0 : r.getAttribute(Re)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Ym(e) {
  const t = N(e);
  t.current = e, C(() => {
    const n = (r) => {
      if (Ja(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function Qm({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ D("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
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
const Xa = "retainpdf:reader:doc-theme:v1", ko = "data-reader-doc";
function Za() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function eh(e = Za()) {
  try {
    return (e == null ? void 0 : e.getItem(Xa)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function th(e, t = Za()) {
  try {
    t == null || t.setItem(Xa, e);
  } catch {
  }
}
function Io(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(ko, "dark") : t.removeAttribute(ko));
}
function nh() {
  const [e, t] = _(() => eh());
  C(() => {
    Io(e);
  }, [e]), C(() => () => Io("light"), []);
  const n = x(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return th(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const rh = 250;
function oh(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function ah(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function sh(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function ih({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = _(null), [s, i] = _({ back: [], forward: [] }), c = N(s);
  c.current = s;
  const l = N(null), u = N({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = x(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return $t(m, g);
  }, []);
  C(() => {
    if (!e) return;
    const m = (b) => {
      var v, k;
      return (k = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${fa}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var L;
      const v = m(b);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(Fn) || "");
      if (!k) return;
      const E = ((L = v.closest("[data-reader-pane]")) == null ? void 0 : L.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const z = v.getBoundingClientRect();
        a({ target: k, pane: E, anchor: { left: z.left, top: z.top, right: z.right, bottom: z.bottom } });
      }, rh);
    }, y = (b) => {
      const v = m(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, w = (b) => {
      var z, O;
      const v = m(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((z = window.getSelection) == null ? void 0 : z.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(Fn) || "");
      if (!k) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const E = ((O = v.closest("[data-reader-pane]")) == null ? void 0 : O.getAttribute("data-reader-pane")) || u.current.primaryPane, L = f();
      L && i((A) => oh(A, L)), u.current.follow(k, E);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", w, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = x((m) => {
    const g = f();
    if (!g) return !1;
    const h = ah(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: w } = u.current;
    return Et(y, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [f]);
  return C(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || sh(g.target)) return;
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
function ch({ state: e, bookmarks: t }) {
  const { finder: n, setFinder: r, toggleFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u } = e;
  return /* @__PURE__ */ D($e, { children: [
    /* @__PURE__ */ p(Wm, { open: n, onToggle: o }),
    n ? /* @__PURE__ */ p(
      Vm,
      {
        tab: n,
        onTab: r,
        onClose: () => r(null),
        onJump: l,
        bookmarks: t,
        onJumpPage: u,
        query: a,
        onQuery: s,
        term: i,
        focusSignal: c
      }
    ) : null
  ] });
}
const Ro = 6e3;
function Ya(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function lh(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > Ro && (s *= Ro / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function Qa({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = N(null), [i, c] = _({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return C(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = lh(n, m, r, g), y = s.current, w = y == null ? void 0 : y.getContext("2d");
        if (!y || !w) return;
        y.width = h.canvasWidth, y.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const S = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), b = d.render({ canvasContext: w, viewport: S });
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
const To = { figure: "图", table: "表", formula: "公式", text: "文字" }, Ge = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function uh(e, t, n) {
  const r = Tt(e, t, n), o = r ? dt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Ya({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function dh(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = Tt(u, t, n), d = f ? dt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Ya({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function fh(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function mh(e, t) {
  const n = (o) => {
    const a = Ne(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function hh({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var O;
  const i = t.find((A) => A.itemId === e) ?? null, c = V(() => i ? mh(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = _(Ge.indexOf(1)), d = Ge[u], m = N(null), [g, h] = _(0);
  Te(() => {
    const A = m.current;
    if (!A) return;
    const I = () => h(A.clientWidth);
    I();
    const R = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return R == null || R.observe(A), () => R == null ? void 0 : R.disconnect();
  }, []);
  const y = x((A) => {
    const I = c[l + A];
    I && a(I.itemId);
  }, [c, l, a]);
  C(() => {
    const A = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), y(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), y(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), f((R) => Math.min(Ge.length - 1, R + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), f((R) => Math.max(0, R - 1));
      else if (I.key === "0")
        I.preventDefault(), f(Ge.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", A, !0), () => window.removeEventListener("keydown", A, !0);
  }, [s, y]), C(() => {
    const A = m.current;
    if (!A) return;
    const I = (R) => {
      !R.ctrlKey && !R.metaKey || (R.preventDefault(), f((P) => Math.max(0, Math.min(Ge.length - 1, P + (R.deltaY < 0 ? 1 : -1)))));
    };
    return A.addEventListener("wheel", I, { passive: !1 }), () => A.removeEventListener("wheel", I);
  }, []);
  const w = N(null);
  if (!i) return null;
  const S = Ne(i), b = o.map((A) => ({ pane: A, pdf: r[A] ?? null, where: uh(i, n, A) })).filter((A) => !!(A.pdf && A.where)), v = 16, k = typeof window > "u" ? 800 : window.innerHeight, E = Math.min(880, k * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), L = b.length ? fh(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), E, b.map((A) => A.where.aspect)) : 0, z = ((O = b[0]) == null ? void 0 : O.where.page) ?? i.source.page;
  return /* @__PURE__ */ D("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${To[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ D("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ D("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ D("span", { className: "reader-zoom-title", children: [
          To[S] ?? "这一块",
          " · 第 ",
          z,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ D("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(js, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(Bo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((A) => Math.max(0, A - 1)), children: /* @__PURE__ */ p(Hs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ D(Q, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(Ge.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === Ge.length - 1, onClick: () => f((A) => Math.min(Ge.length - 1, A + 1)), children: /* @__PURE__ */ p(Us, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(ft, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (A) => {
            const I = m.current;
            !I || A.button !== 0 || (w.current = { x: A.clientX, y: A.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(A.pointerId));
          },
          onPointerMove: (A) => {
            const I = m.current, R = w.current;
            !I || !R || (I.scrollLeft = R.left - (A.clientX - R.x), I.scrollTop = R.top - (A.clientY - R.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: A, pdf: I, where: R }) => /* @__PURE__ */ D("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: A === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Qa,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: R.page,
                region: R.fraction,
                cssWidth: L * d,
                label: `${A === "source" ? "原文" : "译文"}第 ${R.page} 页`
              }
            )
          ] }, A)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const ph = 380, gh = 320, wt = 8;
function bh(e, t, n) {
  const r = Math.max(wt, Math.min(e.left, n.width - t.width - wt)), o = e.bottom + wt, a = o + t.height <= n.height - wt ? o : Math.max(wt, e.top - wt - t.height);
  return { left: r, top: a };
}
function yh({
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
    const m = r[d], g = m ? dh(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(ph, gh / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = bh(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ D("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ D("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Br(e.target) }),
      /* @__PURE__ */ D("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Qa, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Br(e.target) })
  ] });
}
function vh({
  session: e,
  xrefs: t,
  zoomDocuments: n,
  zoomItem: r,
  setZoomItem: o,
  closeZoom: a,
  visiblePdfMode: s
}) {
  return /* @__PURE__ */ D($e, { children: [
    t.preview ? /* @__PURE__ */ p(yh, { preview: t.preview, regions: e.regions, metadata: e.readerMetadata, documents: n }) : null,
    t.canGoBack ? /* @__PURE__ */ D(Q, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => t.goBack(), children: [
      /* @__PURE__ */ p(Ws, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      t.backPage,
      " 页"
    ] }) : null,
    r ? /* @__PURE__ */ p(
      hh,
      {
        itemId: r,
        regions: e.regions,
        metadata: e.readerMetadata,
        documents: n,
        panes: s === "compare" ? ["source", "translated"] : s === "translated" ? ["translated"] : ["source"],
        onNavigate: o,
        onClose: a
      }
    ) : null
  ] });
}
function wh(e) {
  const t = e.sourceOnly || !e.translatedUrl, n = !!(e.overlayContentAvailable && e.liveTranslationVisible && !e.assistantOpen), o = e.assistantOpen && e.mode === "compare" ? "source" : e.mode, a = !t && (o === "translated" || o === "compare");
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
function Sh(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function kh(e, t) {
  const { sessionFiles: n } = e, [r, o] = _(!1), a = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, s = wh({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: n.translatedUrl,
    overlayContentAvailable: a,
    liveTranslationVisible: r,
    assistantOpen: t
  }), i = Qc({
    hasOverlayContent: a,
    connection: e.liveTranslation.connection,
    showSource: s.showSource,
    liveTranslationVisible: r,
    assistantOpen: t
  }), c = s.sourceViewOnly, l = s.visibleMode;
  C(() => {
    o(!1);
  }, [e.viewStateKey]), C(() => {
    e.session.jobTerminal && o(!1);
  }, [e.session.jobTerminal]);
  const u = N(null);
  return C(() => {
    u.current !== e.viewStateKey && nl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: c,
      jobTerminal: e.session.jobTerminal
    }) && (u.current = e.viewStateKey, o(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, c]), { liveTranslationVisible: r, setLiveTranslationVisible: o, paneComposition: s, liveToggles: i, sourceViewOnly: c, visiblePdfMode: l };
}
function Ih(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = el(e.liveTranslation), i = x(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = _(null);
  C(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && rl({
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
function Rh({
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
const Th = 4e3;
function Eh(e, t, n) {
  if (e.length) {
    const o = da(e, n), a = o ? ua(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function Eo(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Re}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, Th), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function Ph(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Tt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = dt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function Mh({
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
  const c = Number(e.getAttribute(Re)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(Se) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? Ph(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: Eh(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
const Po = 5e4, _h = 2e4;
function Pn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function zp(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Nh(e, t = null) {
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
function Ah(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Lh(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? xh(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function xh(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Dh(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Lh(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: Ah(o.selection, n),
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
function Ch(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Pn(e.question.text, Po), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Pn(e.answer.text, Po),
      thought: e.answer.thought ? Pn(e.answer.thought, _h) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Oh(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function zh(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function $h(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Fh(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Bh = 50, Mn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function jh() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function Mo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Hh({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = _(!1), [i, c] = _(Mn), [l, u] = _(!1), [f, d] = _(""), [m, g] = _("idle"), [h, y] = _(null), [w, S] = _(() => /* @__PURE__ */ new Map()), b = N(/* @__PURE__ */ new Set()), v = N(/* @__PURE__ */ new Map()), k = (j) => {
    if (!j) return null;
    const W = v.current.get(j);
    return W || (E.current.records.some((U) => U.message_id === j) ? j : null);
  }, E = N(i);
  E.current = i;
  const L = N(t);
  L.current = t;
  const z = N(0), O = x(async (j, W, U, de = []) => {
    if (!r) return;
    const q = await r.messages(j.conversation_id, { limit: Bh, ...U ? { beforeSeq: U } : {} }), K = [...q.messages, ...de];
    z.current += 1, c({
      conversation: j,
      main: W ?? j,
      records: K,
      compactions: q.compactions || [],
      hasMore: q.has_more,
      key: `${j.conversation_id}:${z.current}`,
      initial: Dh(K, q.compactions || [], L.current.documentId)
    });
  }, [r]), A = x(async () => {
    var j;
    if (s(!0), !(!r || ((j = E.current.conversation) == null ? void 0 : j.kind) === "main")) {
      u(!0), d("");
      try {
        const W = await r.main(L.current.documentId || void 0);
        await O(W, W);
      } catch (W) {
        d(W instanceof Error ? W.message : String(W));
      } finally {
        u(!1);
      }
    }
  }, [r, O]), I = x((j) => {
    y(j), A();
  }, [A]), R = N(t.documentId);
  C(() => {
    R.current !== t.documentId && (R.current = t.documentId, E.current = Mn, c(Mn), y(null), S(/* @__PURE__ */ new Map()), v.current.clear(), a && A());
  }, [t.documentId, a, A]);
  const P = x(async () => {
    const j = E.current, W = j.records[0];
    if (!(!j.conversation || !W || !j.hasMore)) {
      u(!0);
      try {
        await O(j.conversation, j.main, W.seq, j.records);
      } finally {
        u(!1);
      }
    }
  }, [O]), T = x(async (j) => {
    const U = E.current.conversation;
    if (!r || !U) return;
    for (const te of j.memoryIds) b.current.add(te);
    let de = j.memoryIds;
    if (!de.length && o && j.startedAt) {
      const te = zh(
        await o.list({ source_conversation_id: U.conversation_id, created_after: Oh(j.startedAt) }).catch(() => []),
        b.current
      );
      for (const ke of te) b.current.add(ke.id);
      de = te.map((ke) => ke.id);
      const fe = j.answerId;
      te.length && fe && S((ke) => new Map(ke).set(fe, te));
    }
    const q = Ch({ ...j, memoryIds: de }, L.current.documentId, jh(), k(j.editedFrom));
    let K;
    try {
      K = await r.append(U.conversation_id, q);
    } catch (te) {
      if (U.kind !== "side" || !/ask_conversation_not_open/.test(Mo(te))) throw te;
      await r.reopen(U.conversation_id), K = await r.append(U.conversation_id, q);
    }
    const [ie, ge] = K.messages;
    j.questionId && ie && v.current.set(j.questionId, ie.message_id), j.answerId && ge && v.current.set(j.answerId, ge.message_id), c((te) => {
      var fe;
      return ((fe = te.conversation) == null ? void 0 : fe.conversation_id) === U.conversation_id ? { ...te, conversation: K.conversation, records: [...te.records, ...K.messages] } : te;
    }), n == null || n(K.messages), K.compaction_due && U.kind === "main" && r.compact(U.conversation_id).catch(() => {
    });
  }, [r, o, n]), M = x(async (j) => {
    const W = E.current.conversation, U = k(j);
    if (!r || !W || !U) return null;
    try {
      await r.supersede(W.conversation_id, U);
    } catch (K) {
      if (!/ask_message_superseded/.test(Mo(K))) throw K;
    }
    const de = E.current.records.find((K) => K.message_id === U), q = E.current.records.findIndex((K) => K.message_id === U);
    return c((K) => ({ ...K, records: K.records.map((ie, ge) => ge >= q && q >= 0 && !ie.superseded_at ? { ...ie, superseded_at: "now" } : ie) })), (de == null ? void 0 : de.selection) ?? null;
  }, [r]), F = x((j) => {
    T(j).catch((W) => d(`这一轮没存上：${W instanceof Error ? W.message : String(W)}`));
  }, [T]), $ = x(async (j) => {
    var de;
    const W = E.current, U = W.main;
    if (!(!r || !U || ((de = W.conversation) == null ? void 0 : de.kind) !== "main")) {
      d("");
      try {
        const q = $h(W.records, j), K = await r.fork({
          parent_id: U.conversation_id,
          ...q ? { forked_from_message_id: q } : {},
          title: Fh(j.text),
          ...L.current.documentId ? { document_id: L.current.documentId } : {}
        });
        await O(K, U);
      } catch (q) {
        d(`开不了副对话：${q instanceof Error ? q.message : String(q)}`);
      }
    }
  }, [r, O]), G = x(async (j) => {
    const W = E.current.main;
    if (r)
      try {
        await O(await r.get(j), W);
      } catch (U) {
        d(`打不开副对话：${U instanceof Error ? U.message : String(U)}`);
      }
  }, [r, O]), J = x(async () => {
    const j = E.current.main;
    j && await O(j, j).catch(() => {
    });
  }, [O]), ae = x(async () => {
    const j = E.current.conversation;
    if (!(!r || (j == null ? void 0 : j.kind) !== "side")) {
      g("busy");
      try {
        await r.close(j.conversation_id), g("idle"), await J();
      } catch {
        g("failed");
      }
    }
  }, [r, J]), re = x(async () => {
    const j = E.current.main;
    if (!r || !j) return;
    await r.archive(j.conversation_id);
    const W = await r.main(L.current.documentId || void 0);
    await O(W, W);
  }, [r, O]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: f,
    pending: h,
    setPending: y,
    closingSide: m,
    notices: w,
    persistent: !!r,
    openMain: A,
    ask: I,
    close: x(() => s(!1), []),
    loadEarlier: P,
    onTurn: F,
    rewrite: M,
    fork: $,
    openSide: G,
    backToMain: J,
    closeSide: ae,
    archiveMain: re,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function _o(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Nh({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Uh({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = _([]), s = N(0), i = N(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  C(() => {
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
      (h) => d(h.map((y) => _o(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = x((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => _o(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = x((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Wh = xo(() => import("./ReaderAskPanel-DuJ8sOEn.js"));
function Kh({
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
  pageCount: u
}) {
  var P;
  const f = V(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), d = x((T, M, F) => {
    const $ = T ? o.find((ae) => ae.itemId === T) : null, G = $ ? Tt($, a, M) : null, J = G && G.box.page === F ? dt(G, 1, 1) : null;
    return J ? { x: J.left, y: J.top } : null;
  }, [o, a]), m = Uh({ port: e, documentId: t, resetKey: c, pointOf: d }), g = Hh({ port: e, book: f, onAppended: m.addRecords }), [h, y] = _(null), w = x(
    (T, M, F, $) => Mh({
      pageElement: (T == null ? void 0 : T.closest(`[${Re}]`)) ?? null,
      clientX: M,
      clientY: F,
      itemId: i(),
      selection: $,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), S = x(() => {
    var M;
    const T = Eo(((M = globalThis.getSelection) == null ? void 0 : M.call(globalThis)) ?? null);
    return !T.text || !T.element || !T.rect ? null : w(T.element, T.rect.left + T.rect.width / 2, T.rect.top + T.rect.height / 2, T.text);
  }, [w]), b = x((T) => {
    y(null), g.ask(T);
  }, [g.ask]);
  C(() => {
    if (!e) return;
    const T = (M) => {
      var G;
      if (M.key !== "?" || M.metaKey || M.ctrlKey || M.altKey || M.defaultPrevented) return;
      const F = M.target;
      if ((G = F == null ? void 0 : F.closest) != null && G.call(F, "input, textarea, select, [contenteditable='true']")) return;
      const $ = S();
      $ && (M.preventDefault(), M.stopImmediatePropagation(), b($));
    };
    return window.addEventListener("keydown", T, !0), () => window.removeEventListener("keydown", T, !0);
  }, [e, S, b]);
  const v = N(""), k = ((P = g.pending) == null ? void 0 : P.selection) || "";
  C(() => {
    k && (v.current = k);
  }, [k]);
  const E = g.visible && !h, L = g.setPending;
  C(() => {
    if (!E) return;
    let T = null;
    const M = () => {
      T && clearTimeout(T), T = setTimeout(() => {
        const F = S();
        F && F.selection !== v.current && L(F);
      }, 250);
    };
    return document.addEventListener("selectionchange", M), () => {
      T && clearTimeout(T), document.removeEventListener("selectionchange", M);
    };
  }, [E, S, L]);
  const z = x(async (T) => {
    if (T.threadId && (e != null && e.threads) && t) {
      try {
        const M = await e.threads.get(t, T.threadId);
        y({ anchor: M.anchor || T.anchor, messages: M.messages || [], mark: T });
      } catch {
        y({ anchor: T.anchor, messages: [], mark: T });
      }
      return;
    }
    y(null), g.openMain();
  }, [e, t, g.openMain]), O = x((T) => {
    var $;
    if (!e) return [];
    const M = Eo((($ = globalThis.getSelection) == null ? void 0 : $.call(globalThis)) ?? null), F = w(T.target, T.clientX, T.clientY, M.element ? M.text : "");
    return F ? [{
      key: "ask",
      label: F.selection ? "问这段" : "在这里提问",
      hint: F.selection ? "?" : void 0,
      onSelect: () => b(F)
    }] : [];
  }, [e, w, b]), A = h ? {
    anchor: h.anchor,
    messages: h.messages,
    onClose: () => y(null),
    onDelete: e != null && e.threads && h.mark.threadId ? () => {
      e.threads.remove(t, h.mark.threadId).catch(() => {
      }), m.removeMark(h.mark.key), y(null);
    } : void 0
  } : null, I = !g.persistent || !!g.view.conversation || !!g.error, R = e && (g.visible && I || h) ? /* @__PURE__ */ p(Lo, { fallback: null, children: /* @__PURE__ */ p(
    Wh,
    {
      port: e,
      jobId: n,
      book: f,
      ask: g,
      legacy: A,
      onShowSelection: ({ page: T, pane: M }) => l(T, M),
      onJumpToPage: (T) => l(T),
      pageCount: u
    }
  ) }) : null;
  return { marks: m.marks, onMark: z, menuItems: O, panel: R, open: g.openMain, enabled: !!e };
}
const Vh = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function qh() {
  const e = Xf(), t = V(() => {
    try {
      return Ve().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Kh({
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
    pageCount: e.pageCount
  }), { marks: r, onMark: o, menuItems: a, panel: s, enabled: i } = n, c = V(() => i ? {
    menuItems: a,
    pageLayer: r.length ? ({ page: l, height: u }) => /* @__PURE__ */ p(Rh, { marks: r, page: l, height: u, onOpen: o }) : void 0,
    shortcuts: Vh
  } : {}, [i, a, r, o]);
  return em(c), s;
}
const Jh = { id: "ask", title: "提问", Component: qh }, Gh = [Jh];
function Xh() {
  try {
    return Ve().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Zh = "这本书正在处理（翻译或排版），处理完才能改。", Yh = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Qh({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Xh(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = ru(s), l = !t || Bt(t), u = lu(n), [f, d] = _(""), [m, g] = _(null), [h, y] = _(() => /* @__PURE__ */ new Map()), [w, S] = _(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = _(() => /* @__PURE__ */ new Map()), [k, E] = _({ phase: "idle" }), L = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  C(() => {
    g(null), L.drafts.clear(), L.generation.current = null, v(/* @__PURE__ */ new Map()), E({ phase: "idle" });
  }, [s]), C(() => {
    if (d(""), !i || c || !a) return;
    let M = !1;
    return a.resolveOwnerJobId(s).then((F) => {
      M || d(`${F || s}`.trim() || s);
    }).catch(() => {
      M || d(s);
    }), () => {
      M = !0;
    };
  }, [i, c, a, s]), C(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let M = !1;
    return a.fetchRevisions(f).then((F) => {
      M || y(uu(F, u));
    }).catch(() => {
    }), () => {
      M = !0;
    };
  }, [a, f, u, l]);
  const z = k.phase === "running" && k.seenActive;
  C(() => {
    if (k.phase === "running") {
      if (!l) {
        z || E({ phase: "running", seenActive: !0 });
        return;
      }
      z && E(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, z, l, t]);
  const O = V(() => {
    const M = new Map(h);
    if (w.renderedAt === u)
      for (const [F, $] of w.edits) M.set(F, $);
    return M;
  }, [h, w, u]), A = x((M) => {
    const F = `${M || ""}`.trim();
    F && g({ itemId: F, page: ou(F) });
  }, []), I = x(() => g(null), []), R = x((M, F) => {
    S(($) => {
      const G = new Map($.renderedAt === u ? $.edits : []);
      return G.set(M, F), { renderedAt: u, edits: G };
    }), v(($) => new Map($).set(M, ($.get(M) || 0) + 1));
  }, [u]), P = x(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      E({ phase: "submitting" });
      try {
        await a.rerender(s), E({ phase: "running", seenActive: !1 }), await o();
      } catch (M) {
        E({ phase: "failed", message: (M == null ? void 0 : M.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), T = c ? Yh : !l || k.phase === "running" || k.phase === "submitting" ? Zh : "";
  return V(() => ({
    available: i,
    blockedReason: T,
    port: a,
    ownerJobId: f,
    target: m,
    select: A,
    close: I,
    memory: L,
    pendingEdits: O,
    savedCounts: b,
    markSaved: R,
    rerender: k,
    startRerender: P
  }), [i, T, a, f, m, A, I, L, O, b, R, k, P]);
}
function ep(e, t) {
  C(() => {
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
function tp(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Qh({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = x((f) => {
    hu(c, f) && (t === "source" && i("compare"), s(f));
  }, [c, s, t, i]);
  ep(a.available ? l : null, n);
  const u = V(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const f = new Map(e.revisedBlocks);
    for (const [d, m] of a.savedCounts) f.set(d, (f.get(d) || 0) + m);
    return f;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: l, revisedBlocks: u };
}
function _n() {
  try {
    return Ve().translationVersions ?? null;
  } catch {
    return null;
  }
}
function np(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function rp(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function op(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function ap({ documentId: e, jobId: t }) {
  const [n, r] = _([]), [o, a] = _(null), [s, i] = _(null), [c, l] = _(""), [u, f] = _(""), d = N(0);
  C(() => {
    r([]), i(null), f("");
    const y = _n();
    if (!y || !e) return;
    let w = !1;
    return y.list(e).then((S) => {
      w || (r(S.versions), a(S.currentVersionId));
    }).catch(() => {
    }), () => {
      w = !0;
    };
  }, [e, t]);
  const m = x((y) => {
    const w = _n(), S = n.find((v) => v.versionId === y);
    if (!w || !S || !e) return;
    const b = ++d.current;
    l(y), f(""), (async () => {
      const v = Ve(), k = await w.resolveJob(e, y);
      if (!k) throw new Error("这一份还没有能读的译文。");
      const E = await v.loadReaderPayload(k, { includeOptionalArtifacts: !0 }), L = v.resolveReaderTranslatedPdfUrl(E.jobPayload, E.manifestPayload);
      if (!L) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: k, url: L, regions: np(Do(E.regionsPayload)) };
    })().then((v) => {
      b === d.current && i(v);
    }).catch((v) => {
      b === d.current && f((v == null ? void 0 : v.message) || "这一份打不开。");
    }).finally(() => {
      b === d.current && l("");
    });
  }, [e, n]), g = x(() => {
    d.current += 1, i(null), l(""), f("");
  }, []), h = x(async () => {
    var S, b;
    const y = _n();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (v) {
      f((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (S = globalThis.location) == null ? void 0 : S.href;
    w && ((b = globalThis.history) == null || b.replaceState(globalThis.history.state, "", op(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: rp(n, t, o),
    compared: s,
    loading: c,
    error: u,
    choose: m,
    clear: g,
    adopt: h
  };
}
function sp(e, t, n) {
  var i;
  const { session: r } = e, o = ap({ documentId: r.documentId, jobId: r.jobId }), a = ((i = o.compared) == null ? void 0 : i.url) || "";
  C(() => {
    a && t !== "compare" && n("compare");
  }, [a]), C(() => {
    t !== "compare" && o.clear();
  }, [t]);
  const s = V(
    () => {
      const { compared: c, versions: l, readingVersionId: u } = o;
      if (!c) return null;
      const f = l.find((m) => m.versionId === c.versionId), d = l.find((m) => m.versionId === u);
      return {
        url: c.url,
        regions: c.regions,
        left: { name: c.name, createdAt: (f == null ? void 0 : f.createdAt) || "" },
        right: { name: (d == null ? void 0 : d.name) || "当前译文", createdAt: (d == null ? void 0 : d.createdAt) || "" }
      };
    },
    [o.compared, o.versions, o.readingVersionId]
  );
  return { versionCompare: o, compareVersion: s };
}
const ip = "reader-finder-input";
function cp(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function lp(e, t = typeof window > "u" ? null : window) {
  C(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!cp(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(ip) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function up(e) {
  const [t, n] = _(null), r = x((m) => n((g) => g === m ? null : m), []), [o, a] = _(""), [s, i] = _("");
  C(() => {
    const m = o.replace(/\s+/gu, " ").trim(), g = window.setTimeout(() => i(m), m ? 150 : 0);
    return () => window.clearTimeout(g);
  }, [o]);
  const [c, l] = _(0), u = x(() => {
    n("search"), l((m) => m + 1);
  }, []);
  lp(u);
  const f = x((m) => {
    e.jumpToAnchor({ block_id: m }), (t === "outline" || Qe() < 900) && n(null);
  }, [e.jumpToAnchor, t]), d = x((m) => {
    e.goToPage(m), (t === "outline" || Qe() < 900) && n(null);
  }, [e.goToPage, t]);
  return { finder: t, setFinder: n, toggleFinder: r, findQuery: o, setFindQuery: a, findTerm: s, findFocus: c, jumpFromFinder: f, jumpToPageFromFinder: d };
}
function dp(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Xo(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function fp(e, t) {
  return t === null || e !== t;
}
function mp(e, t) {
  const { boot: n } = e, r = N(null), o = N(null);
  C(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = ze(e.viewStateKey), s = dp({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Qe()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      fp(e.mode, o.current) && (o.current = null, pn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const hp = [];
function pp(e) {
  const { sessionFiles: t } = e, [n, r] = _({}), o = N({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = x((y, w) => {
    r((S) => ({ ...S, [w]: { url: o.current[w], nodes: y } }));
  }, []), s = V(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : hp;
  }, [n, t.sourceUrl, t.translatedUrl]), i = N({}), [c, l] = _(0), u = x((y, w) => {
    i.current[w] = { url: o.current[w], pdf: y }, l((S) => S + 1);
  }, []), [f, d] = _(null), m = x((y) => d(y), []), g = x(() => d(null), []);
  C(() => d(null), [e.viewStateKey]);
  const h = V(() => {
    const y = (w, S) => {
      const b = i.current[w];
      return b && b.url === S ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
const gp = xo(() => import("./ReaderMarkdownPanel-DHPaVwfy.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function bp() {
  const e = fl(), { boot: t, panes: n, session: r } = e, o = Dm(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, { liveTranslationVisible: c, setLiveTranslationVisible: l, paneComposition: u, liveToggles: f, sourceViewOnly: d, visiblePdfMode: m } = kh(e, i);
  mp(e, d);
  const g = a || (e.mode === "compare" ? "compare" : "reading"), h = Fm(a, "markdown"), { docDark: y, toggleDocDark: w } = nh();
  vl({
    toggleDocDark: w,
    mode: m,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const S = x(() => {
    s(null);
  }, []), { latestLivePage: b, jumpToLatestLivePage: v, offerCompletion: k, setCompletionDismissedKey: E, sourcePaneAction: L } = Ih(e, {
    liveTranslationVisible: c,
    setLiveTranslationVisible: l,
    liveToggles: f,
    sourceViewOnly: d,
    visiblePdfMode: m
  }), z = x((he) => {
    const ye = Sh(he, e.liveTranslationAvailable);
    ye !== null && l(ye), e.setModeKeepingPage(he);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), O = x((he) => {
    s(he);
  }, []), [A] = _(Bm), I = up(e), { finder: R, toggleFinder: P, findTerm: T } = I, M = x((he) => e.jumpToAnchor({ block_id: he }), [e.jumpToAnchor]), { bookmarks: F, onPdfOutline: $, onPdfDocument: G, zoomItem: J, setZoomItem: ae, zoomBlock: re, closeZoom: j, zoomDocuments: W } = pp(e), U = V(() => Zl(r.regions), [r.regions]), de = x(
    (he, ye) => e.jumpToAnchor({ block_id: he.itemId }, ye),
    [e.jumpToAnchor]
  ), q = ih({ shellEl: e.shell.shellEl, index: U, primaryPane: e.panes.primaryPane, follow: de }), { blockEdit: K, editBlock: ie, revisedBlocks: ge } = tp(e, m, A), te = od(e.viewStateKey);
  Ym(te);
  const [fe, ke] = _(null), nt = x(() => ke(null), []), { versionCompare: Ee, compareVersion: se } = sp(e, m, z), me = V(() => ({
    documentId: r.documentId || "",
    jobId: r.jobId,
    versionId: Ee.readingVersionId || null,
    regions: r.regions,
    metadata: r.readerMetadata,
    bookmarks: F,
    pageCount: n.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => A.get().itemId,
    goToPage: e.goToPage
  }), [r.documentId, r.jobId, Ee.readingVersionId, r.regions, r.readerMetadata, F, n.hudNumPages, e.viewStateKey, A, e.goToPage]), [be] = _(Kf), H = Yf(be), ee = V(() => qf(H), [H]), [oe, Ae] = _([]), Pe = V(() => ({
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
    regionHover: A,
    jumpToBlock: M,
    revisedBlocks: ge,
    onPdfOutline: $,
    onPdfDocument: G,
    zoomBlock: re,
    xrefIndex: U,
    pageLayers: ee,
    editBlock: K.available ? ie : void 0,
    blockEdit: K,
    editShowsSource: m !== "compare",
    findTerm: R === "search" ? T : "",
    compareVersion: se,
    ink: te,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: d,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: O, close: S },
    docDark: y,
    toggleDocDark: w
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
    A,
    M,
    ge,
    $,
    G,
    re,
    U,
    ee,
    K,
    ie,
    m,
    R,
    T,
    se,
    te,
    e.sourceOnly,
    d,
    e.download,
    e.goToPage,
    O,
    S,
    y,
    w
  ]), De = V(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Le = [
    Wi,
    `is-workspace-${g}`,
    i ? "is-assistant-open" : "",
    R ? "is-finder-open" : "",
    u.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Gf, { api: me, store: be, children: /* @__PURE__ */ p(dd, { value: Pe, hud: De, children: /* @__PURE__ */ D(
    "div",
    {
      className: Le,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": g,
      "data-ink-mode": te.tool || void 0,
      onContextMenu: (he) => {
        const ye = Zm(he);
        ye && (he.preventDefault(), Ae(Vf(H, { target: he.target, clientX: he.clientX, clientY: he.clientY, page: ye.page })), ke(ye));
      },
      children: [
        /* @__PURE__ */ p(Wf, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
        /* @__PURE__ */ p(ch, { state: I, bookmarks: F }),
        /* @__PURE__ */ D("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(fm, {}),
          /* @__PURE__ */ p(El, { onBeforeClose: r.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Gd,
          {
            mode: m,
            documentReady: !!r.jobId,
            sourceViewOnly: d,
            onModeChange: z,
            liveTranslation: f.topBarPill ? {
              visible: c,
              state: e.liveTranslation,
              onToggle: () => l((he) => !he),
              latestPage: c ? b : null,
              currentPage: e.currentPage,
              onJumpToLatest: v
            } : null,
            completion: k ? {
              onOpenCompare: () => {
                E(e.viewStateKey), z("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(tf, { active: a }),
        i ? /* @__PURE__ */ p(Hf, {}) : null,
        /* @__PURE__ */ p(Kd, { paneComposition: u, markdownSplit: h.open, assistantSplit: i, liveTranslation: e.liveTranslation, sourcePaneAction: L }),
        e.showHud ? /* @__PURE__ */ p(
          Lm,
          {
            mode: m,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : r.jobId,
            searchSlot: /* @__PURE__ */ p(Km, { open: R, onToggle: P })
          }
        ) : null,
        /* @__PURE__ */ p(Lo, { fallback: null, children: h.mounted ? /* @__PURE__ */ p(gp, { open: h.open, jobId: r.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: S }) : null }),
        /* @__PURE__ */ p(
          vh,
          {
            session: r,
            xrefs: q,
            zoomDocuments: W,
            zoomItem: J,
            setZoomItem: ae,
            closeZoom: j,
            visiblePdfMode: m
          }
        ),
        /* @__PURE__ */ p(qm, { active: a, compare: Ee, ink: te }),
        /* @__PURE__ */ p(
          Gm,
          {
            ink: te,
            menu: fe,
            onClose: nt,
            actions: oe
          }
        ),
        /* @__PURE__ */ p(nm, { extensions: Gh }),
        /* @__PURE__ */ p(Xm, { ink: te }),
        /* @__PURE__ */ p(Qm, { edit: K }),
        /* @__PURE__ */ p(zm, {})
      ]
    }
  ) }) });
}
function $p() {
  return /* @__PURE__ */ p(bp, {});
}
export {
  $p as R,
  bp as a,
  zp as b,
  Op as c,
  Cp as d,
  xp as f,
  Dp as r,
  Nh as s,
  qe as u
};
//# sourceMappingURL=ReaderApp-BbWWAI4d.js.map
