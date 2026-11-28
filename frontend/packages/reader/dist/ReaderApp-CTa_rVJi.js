var ki = Object.defineProperty;
var eo = (e) => {
  throw TypeError(e);
};
var Ti = (e, t, n) => t in e ? ki(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var to = (e, t, n) => Ti(e, typeof t != "symbol" ? t + "" : t, n), no = (e, t, n) => t.has(e) || eo("Cannot " + n);
var Dt = (e, t, n) => (no(e, t, "read from private field"), n ? n.call(e) : t.get(e)), ro = (e, t, n) => t.has(e) ? eo("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), oo = (e, t, n, r) => (no(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as _, jsx as p, Fragment as Te } from "react/jsx-runtime";
import { useMemo as U, useState as x, useEffect as D, useCallback as N, useRef as A, useLayoutEffect as Ne, memo as nn, createContext as rn, useContext as ft, Fragment as xn, forwardRef as Ii, useImperativeHandle as vr, useSyncExternalStore as An, Component as Ei, Suspense as La, lazy as Ca, useId as $a } from "react";
import { requireAdapter as Ct, getReaderAdapters as Oe } from "./adapters.js";
import { resolveReaderDownloadName as Pi, resolveReaderDownloadUrls as Ri, READER_PROGRESS_COPY as qe, trimString as vn, READER_DOWNLOAD_ACTIONS as Mi, disabledReason as xi } from "./runtime/state.js";
import { r as Ai, b as _i } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Jn, isFinishedJobStatus as Yt } from "@retainpdf/domain/job";
import { n as Da, d as Ni, f as $n, k as ao, b as Li, c as Ci, j as Ce, p as lt, g as $i, l as mt, i as Di } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as Oi } from "@retainpdf/api/documents";
import { isReaderTransportError as zi, createReaderTransportError as Fi } from "./contracts.js";
import { toast as Gn, Toaster as Bi } from "sonner";
import { ChevronLeft as Oa, PenLine as wn, ZoomIn as Hi, Check as wr, X as bt, Copy as za, ChevronUp as ji, ChevronDown as Sn, History as Ui, LoaderCircle as Wi, Pin as Fa, LogOut as Ki, FileText as Ba, Columns2 as Ha, Languages as ja, Radio as Vi, ArrowDownToLine as qi, CheckCircle2 as Ji, ImagePlus as Gi, MessageCircle as Ua, Scan as Xi, GitCompareArrows as Yi, CodeXml as Zi, Highlighter as Qi, Eraser as el, Undo2 as tl, Trash2 as nl, BookText as rl, ChevronRight as Wa, Minus as Ka, Plus as Va, ArrowLeft as ol, CircleHelp as al, Download as sl, Bookmark as il, Star as qa, Contrast as ll, Search as Ja, PinOff as cl } from "lucide-react";
import { Button as Y, Textarea as ul, IconButton as dt, Input as Sr } from "@retainpdf/ui";
import { e as dl, m as fl, a as ml, c as hl } from "./markdown-math-B8jhIfTG.js";
import { pdfjs as kn, Page as pl, Document as gl } from "react-pdf";
import { createPortal as yl } from "react-dom";
const bl = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, vl = "", wl = Object.freeze({
  progress: "retainpdf-reader-progress"
}), kr = (e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Kb = (...e) => {
  var n;
  return (((n = Oe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Vb = () => {
  var e, t;
  return ((t = (e = Oe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Je = () => Ct("defaultReaderDataPort"), so = () => Ct("defaultReaderPageConfigPort"), io = {
  get apiPrefix() {
    return Je().apiPrefix;
  },
  fetchProtected: (...e) => Je().fetchProtected(...e),
  loadMarkdownPayload: (e) => Je().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Je().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Je().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Je().loadJobPayload(e),
  loadReaderPayload: (e, t) => Je().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Je().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Je().liveTranslation;
  }
}, Ga = {
  messageTargetOrigin: () => so().messageTargetOrigin(),
  readerJobId: () => so().readerJobId()
}, Sl = () => {
  var e;
  return ((e = Oe()) == null ? void 0 : e.liveTranslation) ?? null;
}, _t = () => {
  var t;
  const e = Oe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Qe = () => {
  const e = Oe();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Ct("fetchDocumentByJobId")(...n),
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
}, kl = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Tl = () => {
  var e, t;
  return ((t = (e = Oe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Il = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, El = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Pi(...e);
}, Pl = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Ri(...e);
}, Rl = (...e) => Ct("downloadProtectedResource")(...e), Ml = (...e) => Ct("failDownloadToast")(...e), qb = (e, t) => Ct("resolveMarkdownAssetUrl")(e, t), lo = "/api/v1";
function xl() {
  const e = () => {
    var r;
    return Ai(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = x(e);
  return D(() => {
    var i, c, l, u;
    const r = () => n(e()), o = (c = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : c.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (m) => function(...h) {
          const g = m.apply(this, h);
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
function Al() {
  const e = xl(), t = U(() => Il(Ga), [e]), n = U(() => Tl(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function _l(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = x({
    documentId: "",
    jobId: ""
  }), [u, f] = x({
    documentId: "",
    jobId: ""
  }), m = c.documentId === t ? c.jobId : "", h = u.documentId === t ? u.jobId : "", g = n || m, [d, y] = x({
    jobId: "",
    documentId: ""
  }), w = d.jobId === g ? d.documentId : "", S = t || w, b = !!t && !g, [v, k] = x(null), M = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, R = b || !!M, P = N(($) => {
    const I = `${$.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${$.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  D(() => {
    k(($) => $ && $.sessionIdentity !== r ? null : $);
  }, [r]);
  const C = N(($) => {
    switch ($.type) {
      case "resolved-document-job":
        l({ documentId: $.documentId, jobId: $.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: $.documentId, jobId: $.jobId });
        break;
      case "resolved-job-document":
        y((I) => I.jobId === $.jobId && I.documentId === $.documentId ? I : { jobId: $.jobId, documentId: $.documentId });
        break;
      case "committed-source":
        k({
          documentId: $.documentId,
          revision: $.revision,
          sessionIdentity: $.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: c,
    setResolvedDocumentJob: l,
    missingDocumentJob: u,
    setMissingDocumentJob: f,
    documentJobId: m,
    rejectedDocumentJobId: h,
    sessionJobId: g,
    resolvedJobDocument: d,
    setResolvedJobDocument: y,
    jobDocumentId: w,
    documentId: S,
    sourceOnly: b,
    committedDocumentSource: v,
    setCommittedDocumentSource: k,
    activeCommittedDocumentSource: M,
    sourceViewOnly: R,
    refreshCommittedDocument: P,
    applyIdentityEvent: C
  };
}
function co(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Nl(e) {
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
function uo(e, t) {
  return kr(Jn(e, t));
}
function Ll(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Cl(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !Ll(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Xn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: wl.progress,
        stage: n,
        percent: e,
        text: t
      },
      Ga.messageTargetOrigin()
    );
  } catch {
  }
}
function Tn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Xn({ percent: t, text: n, stage: r });
}
function $l(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = x(null), [l, u] = x(null), [f, m] = x(""), [h, g] = x(0), d = f === n ? i : null, y = f === n ? l : null, w = co(d), S = Yt(w), b = N(() => {
    g((C) => C + 1);
  }, []), v = N((C) => {
    c(C.jobPayload), u(C.manifestPayload), m(C.sessionIdentity);
  }, []), k = N((C) => {
    c(null), u(null), m(C);
  }, []), M = A(""), R = A(""), P = N(async () => {
    const C = o.current;
    if (!C || M.current === C) return;
    const $ = Qe().loadJobPayload;
    if (typeof $ != "function") return;
    const I = a.current.value;
    M.current = C;
    try {
      const T = await $(C);
      if (s.current || a.current.value !== I || o.current !== C || !T || typeof T != "object")
        return;
      const E = co(T);
      c(T), m(r.current), !Yt(E) && R.current === C && (R.current = ""), E === "succeeded" && R.current !== C && (R.current = C, g((L) => L + 1));
    } catch {
    } finally {
      M.current === C && (M.current = "");
    }
  }, []);
  return D(() => {
    R.current = "";
  }, [n]), D(() => {
    if (!t || S || !d) return;
    const C = window.setInterval(() => {
      document.visibilityState !== "hidden" && P();
    }, 1e3);
    return () => window.clearInterval(C);
  }, [S, P, d, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: m,
    scopedJobPayload: d,
    scopedManifestPayload: y,
    jobStatus: w,
    jobTerminal: S,
    jobRefreshRevision: h,
    refreshJobArtifacts: b,
    refreshJobStatus: P,
    publishPayload: v,
    clearPayload: k
  };
}
function Yn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Dl(e, t) {
  e(t), Yn(t);
}
function Ol(e) {
  const [t, n] = x(e ? "source" : "compare"), r = N((a) => {
    e && a !== "source" || (n(a), Yn(a));
  }, [e]), o = N((a) => {
    Dl(n, a);
  }, []);
  return D(() => (e && document.documentElement.classList.add("reader-source-only"), Yn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function fo(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function zl(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: fo(n.active_job_id),
    activeVersionId: fo(n.active_version_id)
  };
}
function Fl(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Bl(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Hl(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const jl = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ul(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = jl.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Wl = 48 * 1024 * 1024;
function Kl(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Vl = 2, De = /* @__PURE__ */ new Map();
function Zn(e, t) {
  De.delete(e), De.set(e, t);
}
function mo(e) {
  if (De.size < Vl) return;
  const t = De.keys().next().value;
  t && De.delete(t);
}
async function ql(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Tr(e, t = _t().fetchProtected, n = {}) {
  var u, f, m, h, g, d, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (De.has(r)) {
    const b = De.get(r);
    return Zn(r, b), b;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (m = (f = n.signal) == null ? void 0 : f.addEventListener) == null || m.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (h = n.signal) == null ? void 0 : h.removeEventListener) == null || g.call(h, "abort", a);
  }
  if (!s.ok) {
    const b = new Error(`读取 PDF 失败 (${s.status})`);
    b.status = s.status;
    const v = await ql(s);
    throw v && (b.reason = v), b;
  }
  const i = Jl(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return mo(), De.set(r, b), b;
  }
  (y = (d = n.signal) == null ? void 0 : d.addEventListener) == null || y.call(d, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return De.has(r) ? Zn(r, l) : (mo(), De.set(r, l)), l;
}
function Jl(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Wl ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Gl = { file: null, loading: !1, error: "" }, Xl = { file: null, loading: !0, error: "" };
function Yl(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = x(null);
  if (D(() => {
    if (t || !n) return;
    const s = De.get(n);
    if (s) {
      Zn(n, s);
      return;
    }
    const i = new AbortController();
    return Tr(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Gl;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = De.get(n);
  return a ? { file: a, loading: !1, error: "" } : Xl;
}
function Zl(e) {
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
async function Qn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Tn(s, r, n, "download");
  const i = await Tr(t, _t().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Tn(s, o, n, "download"), i);
}
async function Ql(e) {
  const { sourceFinal: t, fence: n, setBoot: r } = e;
  Tn(r, 25, "正在下载 PDF…", "download");
  const o = [];
  let a = null, s = null;
  t && o.push(
    Qn({
      url: t,
      label: "正在下载原文 PDF…",
      percentStart: 30,
      percentEnd: 55,
      fence: n,
      setBoot: r
    }).then((u) => {
      a = u;
    })
  );
  for (const u of o) u.catch(() => {
  });
  const i = await e.translatedFinal;
  return i && o.push(
    Qn({
      url: i,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: n,
      setBoot: r
    }).then((u) => {
      s = u;
    })
  ), await Promise.all(o), n.isInactive() ? { status: "inactive" } : !!t && !a || !!i && !s ? { status: "incomplete" } : { status: "downloaded", sourceBytes: a, translatedBytes: s };
}
function ec(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function tc({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Oi,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(ec(o.href, t, a)), !0);
}
const ve = (e) => {
  const t = Number(e);
  return Number.isFinite(t) ? t : 0;
}, Ir = (e) => {
  const t = Array.isArray(e) ? e : [];
  return [ve(t[0]), ve(t[1]), ve(t[2])];
};
function Ot([e, t, n]) {
  const r = Math.max(e, t, n) > 1 ? 1 : 255, o = (a) => Math.round(Math.min(255, Math.max(0, a * r)));
  return `rgb(${o(e)}, ${o(t)}, ${o(n)})`;
}
function Xa(e) {
  const t = e && typeof e == "object" ? e : null;
  if (!t) return null;
  const n = Math.floor(ve(t.index));
  if (n < 0 || !(ve(t.width) > 0) || !(ve(t.height) > 0)) return null;
  const r = (Array.isArray(t.covers) ? t.covers : []).flatMap((i) => {
    const c = i, l = Array.isArray(c.rect) ? c.rect.map(ve) : [];
    return l.length === 4 && l[2] > l[0] && l[3] > l[1] ? [{ block: `${c.block || ""}`, rect: l, fill: Ir(c.fill) }] : [];
  }), o = ho(t.blocks), a = Dn(t.erase), s = (Array.isArray(t.tables) ? t.tables : []).flatMap((i) => {
    const c = i, l = `${c.id || ""}`;
    return l ? [{ id: l, cover: Dn([c.cover])[0] ?? null, rules: Dn(c.rules), blocks: ho(c.blocks) }] : [];
  });
  return { index: n, width: ve(t.width), height: ve(t.height), covers: r, blocks: o, erase: a, tables: s };
}
function Dn(e) {
  return (Array.isArray(e) ? e : []).flatMap((t) => {
    const n = t && typeof t == "object" ? t : null, r = Array.isArray(n == null ? void 0 : n.rect) ? n.rect.map(ve) : [];
    return r.length === 4 && r[2] > r[0] && r[3] > r[1] ? [{ rect: r, fill: Ir(n.fill) }] : [];
  });
}
function ho(e) {
  return (Array.isArray(e) ? e : []).flatMap((t) => {
    const n = t, r = ve(n.fontSize);
    if (!(r > 0)) return [];
    const o = (Array.isArray(n.lines) ? n.lines : []).map((a) => {
      const s = a, i = (Array.isArray(s.items) ? s.items : []).flatMap((c) => {
        const l = c;
        return typeof l.tex == "string" ? [{
          x: ve(l.x),
          tex: l.tex,
          display: !!l.display,
          w: ve(l.w),
          h: ve(l.h),
          d: ve(l.d),
          ...typeof l.svg == "string" && l.svg ? { svg: l.svg } : {}
        }] : typeof l.t == "string" && l.t ? [{
          x: ve(l.x),
          t: l.t,
          ...l.mode === "dflt" ? { mode: "dflt" } : {},
          ...typeof l.font == "string" && l.font ? { font: l.font } : {}
        }] : [];
      });
      return { text: `${s.text || ""}`, x: ve(s.x), baseline: ve(s.baseline), width: ve(s.width), justified: !!s.justified, items: i };
    });
    return [{ id: `${n.id || ""}`, fontSize: r, weight: n.weight === "bold" ? "bold" : "regular", color: Ir(n.color), lines: o }];
  });
}
function nc(e, t = []) {
  const n = e && typeof e == "object" ? e : null;
  if (!n || !`${n.schema || ""}`.startsWith("rpr_layout_")) return null;
  const r = /* @__PURE__ */ new Map();
  for (const o of Array.isArray(n.pages) ? n.pages : []) {
    const a = Xa(o);
    a && r.set(a.index + 1, a);
  }
  return { schema: `${n.schema}`, pages: r, fonts: t };
}
async function rc(e, t = fetch) {
  var s;
  const n = new URL(e, (s = globalThis.location) == null ? void 0 : s.href), r = await (await t(n.href)).json(), o = (r.fonts || []).flatMap((i) => i.family && i.url ? [{ family: i.family, weight: ve(i.weight) || 400, url: new URL(i.url, n).href }] : []), a = await (await t(new URL(r.layout || "layout.json", n).href)).json();
  return nc(a, o);
}
const oc = /* @__PURE__ */ new Set(["no_translated_pdf", "not_engine_route", "unsupported_render", "merged_reading", "not_kept", "backfill_queued", "job_active"]), ac = /* @__PURE__ */ new Set(["backfill_queued", "job_active"]);
function sc(e) {
  const t = `${e || ""}`.trim();
  return oc.has(t) ? t : "not_kept";
}
const po = (e) => {
  const t = e && typeof e == "object" ? e : null;
  return (t && t.data && typeof t.data == "object" ? t.data : null) ?? t;
}, ic = (e) => `RPR ${e}`;
async function er(e, { apiPrefix: t = "/api/v1", fetcher: n }) {
  const r = `${t.replace(/\/$/, "")}/jobs/${encodeURIComponent(e)}/reader/layout`, o = await n(r);
  if (!o.ok) throw new Error(`版面清单 HTTP ${o.status}`);
  const a = po(await o.json()) ?? {}, s = a.generate && typeof a.generate == "object" ? a.generate : null, i = s && s.url ? { method: `${s.method || "POST"}`, url: `${s.url}`, body: s.body ?? null } : null;
  if (!a.available) return { available: !1, reason: sc(a.reason), generate: i, source: null };
  const c = /* @__PURE__ */ new Map();
  for (const w of Array.isArray(a.pages) ? a.pages : []) {
    const S = w, b = Math.floor(ve(S.index));
    b >= 0 && c.set(b + 1, `${S.url || `${r}/pages/${b}`}`);
  }
  const l = (Array.isArray(a.fonts) ? a.fonts : []).flatMap((w) => {
    const S = w;
    return S.family && S.url ? [{ key: `${S.key || ""}` || void 0, family: ic(`${S.family}`), weight: ve(S.weight) || 400, url: `${S.url}` }] : [];
  }), u = new Set((Array.isArray(a.features) ? a.features : []).map((w) => `${w}`)), f = !u.has("erase") && a.background && typeof a.background == "object" ? a.background : null, m = Array.isArray(f == null ? void 0 : f.pages) ? f.pages.map((w) => Math.floor(ve(w))) : [], h = f != null && f.url ? {
    url: `${f.url}`,
    pageFor(w) {
      const S = m.indexOf(w - 1);
      return S >= 0 ? S + 1 : null;
    }
  } : null, g = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), y = {
    schema: `${a.schema || "rpr_layout_v1"}`,
    features: u,
    pages: new Set(c.keys()),
    fonts: l,
    background: h,
    loadPage(w) {
      const S = c.get(w);
      if (!S) return Promise.resolve(null);
      let b = g.get(w);
      return b || (b = n(S).then(async (v) => v.ok ? Xa(po(await v.json())) : null).catch(() => null), g.set(w, b)), b;
    },
    loadMath(w) {
      let S = d.get(w);
      return S || (S = n(`${r}/${w.replace(/^\/+/, "")}`).then(async (b) => b.ok ? b.text() : null).catch(() => null), d.set(w, S)), S;
    },
    async loadFont(w) {
      const S = await n(w.url);
      if (!S.ok) throw new Error(`字体 HTTP ${S.status}`);
      return S.arrayBuffer();
    }
  };
  return { available: !0, reason: null, generate: i, source: y };
}
function lc(e, t = fetch) {
  return {
    schema: e.schema,
    features: /* @__PURE__ */ new Set(),
    pages: new Set(e.pages.keys()),
    fonts: e.fonts,
    background: null,
    loadPage: (n) => Promise.resolve(e.pages.get(n) ?? null),
    loadMath: () => Promise.resolve(null),
    async loadFont(n) {
      const r = await t(n.url);
      if (!r.ok) throw new Error(`字体 HTTP ${r.status}`);
      return r.arrayBuffer();
    }
  };
}
function Ya(e) {
  return [...[...new Set(e.map((n) => n.family))].map((n) => `"${n.replace(/"/g, "")}"`), "serif"].join(", ");
}
const go = /* @__PURE__ */ new Set();
async function cc(e, t) {
  const n = `${e.family}|${e.weight}|${e.url}`;
  if (go.has(n)) return !0;
  for (let r = 0; r < 2; r += 1)
    try {
      const o = new FontFace(e.family, await t(e), { weight: `${e.weight}` });
      return document.fonts.add(await o.load()), go.add(n), !0;
    } catch (o) {
      r === 1 && console.warn("[render-layout] 字体没装上：", e.family, e.url, o);
    }
  return !1;
}
async function Za(e, t) {
  var o;
  if (typeof FontFace > "u" || typeof document > "u" || !document.fonts) return !1;
  const n = (o = e[0]) == null ? void 0 : o.family, r = await Promise.all(e.map(async (a) => ({ font: a, ok: await cc(a, t) })));
  return !!n && r.every(({ font: a, ok: s }) => s || a.family !== n);
}
function uc() {
  var e;
  try {
    return new URLSearchParams(((e = globalThis.location) == null ? void 0 : e.search) || "").get("render_layout") || "";
  } catch {
    return "";
  }
}
const dc = 5e3, fc = 360;
function Qa() {
  try {
    const e = io.fetchProtected;
    return {
      apiPrefix: io.apiPrefix,
      fetchProtected: ((t, n) => e(typeof t == "string" ? kr(t) : t, n))
    };
  } catch {
    return null;
  }
}
function mc(e, t) {
  const [n, r] = x({ status: "idle" }), [o, a] = x(0), [s, i] = x(e);
  D(() => i(e), [e]);
  const c = A(""), l = A(uc()).current, u = A(Qa()).current;
  D(() => {
    if (!l && (!t || !s || !u)) return;
    let h = !0;
    return r((g) => g.status === "generating" ? g : { status: "loading" }), (async () => {
      let g = null;
      if (l) {
        const w = await rc(l);
        g = w ? lc(w) : null;
      } else {
        const w = await er(s, { apiPrefix: u.apiPrefix || "/api/v1", fetcher: u.fetchProtected });
        if (!w.source) {
          if (h) {
            const S = ac.has(w.reason || "");
            r((b) => b.status === "generating" || S ? { status: "generating" } : { status: "unavailable", reason: w.reason || "not_kept", generate: w.generate });
          }
          return;
        }
        g = w.source;
      }
      if (!g) {
        h && r({ status: "unavailable", reason: "failed", generate: null });
        return;
      }
      const d = g, y = await Za(d.fonts, (w) => d.loadFont(w));
      if (h) {
        if (!y) {
          console.warn("[render-layout] 版面的字体没有或没装全，HTML 页退回按 OCR 的框塞字"), r({ status: "unavailable", reason: "no_fonts", generate: null });
          return;
        }
        r({ status: "ready", source: d, fontFamily: Ya(d.fonts) });
      }
    })().catch((g) => {
      console.warn("[render-layout] 版面没读到：", g), h && r({ status: "unavailable", reason: "failed", generate: null });
    }), () => {
      h = !1;
    };
  }, [l, t, s, u, o]);
  const f = n.status === "unavailable" ? n.generate : null, m = N(() => {
    !f || !u || (r({ status: "generating" }), u.fetchProtected(f.url, {
      method: f.method || "POST",
      headers: { "Content-Type": "application/json" },
      body: f.body == null ? void 0 : JSON.stringify(f.body)
    }).then(async (h) => {
      var g;
      if (!h.ok) throw new Error(`补排 HTTP ${h.status}`);
      try {
        const d = await h.json(), y = `${((g = d == null ? void 0 : d.data) == null ? void 0 : g.job_id) ?? (d == null ? void 0 : d.job_id) ?? ""}`.trim();
        c.current = y && y !== e ? y : "";
      } catch {
        c.current = "";
      }
    }).catch((h) => {
      console.warn("[render-layout] 补排没发出去：", h), r({ status: "unavailable", reason: "failed", generate: f });
    }));
  }, [f, u]);
  return D(() => {
    if (n.status !== "generating" || !u) return;
    let h = 0;
    const g = setInterval(() => {
      if (h += 1, h > fc) {
        clearInterval(g), r({ status: "unavailable", reason: "failed", generate: null });
        return;
      }
      const d = [e, c.current].filter(Boolean);
      for (const y of d)
        er(y, { apiPrefix: u.apiPrefix || "/api/v1", fetcher: u.fetchProtected }).then((w) => {
          w.available && (clearInterval(g), i(y), r({ status: "loading" }), a((S) => S + 1));
        }).catch(() => {
        });
    }, dc);
    return () => clearInterval(g);
  }, [n.status, e, u]), { ...n, generateNow: m };
}
const hc = 3e3, pc = ["erase", "tables"];
function gc(e = ((t) => (t = globalThis.location) == null ? void 0 : t.search)() || "") {
  try {
    return new URLSearchParams(e).get("translated") === "pdf";
  } catch {
    return !1;
  }
}
function yc(e) {
  return !!(e && e.fonts.length && pc.every((t) => e.features.has(t)));
}
async function bc(e, { signal: t, waitMs: n = hc } = {}) {
  const r = Qa();
  if (!e || !r || gc()) return null;
  const o = (async () => {
    const c = (await er(e, { apiPrefix: r.apiPrefix || "/api/v1", fetcher: r.fetchProtected })).source;
    return !yc(c) || t != null && t.aborted ? null : await Za(c.fonts, (u) => c.loadFont(u)) ? { source: c, fontFamily: Ya(c.fonts) } : null;
  })().catch((i) => (console.warn("[translated-layout] 版面没要到，译文栏照旧用译文 PDF：", i), null));
  let a;
  const s = new Promise((i) => {
    a = setTimeout(() => i(null), n);
  });
  try {
    return await Promise.race([o, s]);
  } finally {
    clearTimeout(a);
  }
}
const ln = {
  regions: null,
  metadata: null
};
function vc(e) {
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
    clearPayload: m,
    switchSessionMode: h,
    jobRefreshRevision: g,
    sessionEpochRef: d,
    closingRef: y,
    activeLoadAbortRef: w
  } = e, [S, b] = x(""), [v, k] = x(""), [M, R] = x(null), [P, C] = x(null), [$, I] = x(null), [T, E] = x(!1), [L, B] = x(""), [W, j] = x([]), [Q, ae] = x(!1), [ne, fe] = x(() => ({
    source: null,
    translated: null
  })), [se, be] = x(
    ln
  ), [me, ue] = x({
    loading: !0,
    percent: 4,
    text: qe.boot,
    stage: "progress",
    failed: !1
  });
  return D(() => {
    const ge = new AbortController(), xe = d.current.value, z = Zl({
      sessionEpochRef: d,
      closingRef: y,
      abort: ge,
      sessionEpoch: xe
    });
    w.current = ge;
    const K = Qe();
    if (y.current)
      return ge.abort(), () => {
        w.current === ge && (w.current = null);
      };
    let ee = !1;
    function ie(oe, F) {
      z.markFailed(), ae(!0), ue({
        loading: !1,
        percent: 100,
        text: oe,
        stage: "failed",
        failed: !0
      }), Xn({ percent: 100, text: F, stage: "failed" });
    }
    function ce() {
      E(!0), ee || ae(!0), ue({
        loading: !1,
        percent: 100,
        text: qe.ready,
        stage: "ready",
        failed: !1
      }), Xn({ percent: 100, text: qe.ready, stage: "ready" });
    }
    function te() {
      return l != null && l.documentId ? uo(
        l.documentId,
        l.revision
      ) : bl() ? vl : K.resolveResourceUrl(Jn(r));
    }
    async function de() {
      var J;
      let oe = { activeJobId: "", activeVersionId: "" };
      try {
        const re = await ((J = K.fetchDocument) == null ? void 0 : J.call(K, r));
        re && (oe = zl(re));
      } catch {
      }
      const F = Fl({
        link: oe,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (F.kind === "follow-active-job") {
        if (z.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: F.jobId
        }), F.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: F.activeVersionId,
          sessionIdentity: c
        }), h("source")) : h("compare");
        return;
      }
      if (F.kind === "open-committed-source") {
        if (z.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: F.revision,
          sessionIdentity: c
        }), h("source");
        return;
      }
      const q = te();
      if (z.isInactive()) return;
      b(q), k(""), B(""), m(c);
      const O = await Qn({
        url: q,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: z,
        setBoot: ue
      });
      if (!z.isInactive()) {
        if (!O) {
          ie("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        R(O), ce();
      }
    }
    async function ke() {
      var Z;
      const oe = !l, F = !!(oe && K.loadSessionSnapshot && K.loadReaderOptionalArtifacts), q = F ? K.loadReaderOptionalArtifacts(t) : null, O = await ((Z = K.loadSessionSnapshot) == null ? void 0 : Z.call(K, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: oe && !F
      })), J = O ? {
        jobPayload: O.sourcePayload,
        manifestPayload: O.manifestPayload,
        readerMetadata: O.readerMetadata,
        regionsPayload: O.regions,
        readerErrors: O.readerErrors
      } : await K.loadReaderPayload(t, {
        includeOptionalArtifacts: oe
      });
      if (z.isInactive()) return;
      let re = null;
      if (n && !r)
        if (O && O.linkedDocument !== void 0)
          re = O.linkedDocument;
        else {
          try {
            re = await K.fetchDocumentByJobId(lo, t);
          } catch {
          }
          if (z.isInactive()) return;
        }
      const Ee = Nl(J.jobPayload) || `${(re == null ? void 0 : re.document_id) || ""}`.trim();
      Ee && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ee
      });
      const Pe = Bl({
        payloadDocumentId: Ee,
        linkedActiveJobId: `${(re == null ? void 0 : re.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(re == null ? void 0 : re.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Pe.kind === "restore-committed-source") {
        if (z.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Pe.documentId,
          revision: Pe.revision,
          sessionIdentity: c
        }), h("source");
        return;
      }
      const $e = K.resolveReaderSourcePdf(J.manifestPayload), Ve = K.resolveReaderTranslatedPdfUrl(J.jobPayload, J.manifestPayload), ze = typeof $e == "string" ? $e : K.resolveReaderArtifactUrl($e), Le = r || Ee, Fe = l != null && l.documentId ? uo(
        l.documentId,
        l.revision
      ) : ze || (Le ? K.resolveResourceUrl(Jn(Le)) : ""), Be = l ? "" : Ve || "";
      b(Fe || ""), k(Be), B(Cl(J.jobPayload, t)), f({
        jobPayload: J.jobPayload || null,
        manifestPayload: J.manifestPayload || null,
        sessionIdentity: c
      });
      let et = null;
      const ct = () => (et = Be ? bc(t, { signal: z.signal }) : Promise.resolve(null), Ql({
        sourceFinal: Fe || "",
        translatedFinal: et.then((V) => V ? "" : Be),
        fence: z,
        setBoot: ue
      })), St = !!(Fe || Be), tt = q && St ? ct() : null;
      tt == null || tt.catch(() => {
      });
      const H = (V) => {
        z.isInactive() || (j(l ? [] : Da(V.regionsPayload)), fe(l ? { source: null, translated: null } : Ni(V.readerMetadata)), be(l ? ln : V.readerErrors ?? ln), ae(!0));
      };
      if (q ? (ee = !0, q.then(H)) : H(J), !St) {
        ie(qe.failed, qe.failed);
        return;
      }
      const G = await (tt ?? ct());
      if (G.status !== "inactive") {
        if (G.status === "incomplete") {
          ie("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        R(G.sourceBytes), C(G.translatedBytes), I(await et ?? null), ce();
      }
    }
    async function he() {
      E(!1), R(null), C(null), I(null), j([]), ae(!1), fe({ source: null, translated: null }), be(ln), Tn(ue, 8, qe.metadata, "metadata");
      try {
        if (s) {
          await de();
          return;
        }
        if (!t) {
          ie(qe.failed, qe.failed);
          return;
        }
        await ke();
      } catch (oe) {
        if (z.isClosedOrStale() || (oe == null ? void 0 : oe.name) === "AbortError") return;
        z.markFailed();
        const F = Number(oe == null ? void 0 : oe.status), q = `${(oe == null ? void 0 : oe.reason) || ""}`, O = Ul({ status: F, reason: q, sessionJobId: t });
        if (O && (await tc({
          apiPrefix: lo,
          documentId: O,
          expiredJobId: t
        }) || z.isClosedOrStale()))
          return;
        if (Hl({
          status: F,
          reason: q,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const J = oe instanceof Error ? oe.message : qe.failed;
        ie(J, J);
      }
    }
    return he(), () => {
      ge.abort(), w.current === ge && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, m, h]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: M,
    translatedFile: P,
    translatedLayout: $,
    assetsReady: T,
    title: L,
    regions: W,
    regionsSettled: Q,
    readerMetadata: ne,
    readerErrors: se,
    boot: me
  };
}
function wc() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Al(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), c = A(""), l = A(""), u = A(() => {
  }), f = N(() => u.current(), []), m = _l({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: f
  }), {
    sessionJobId: h,
    documentId: g,
    sourceOnly: d,
    sourceViewOnly: y
  } = m, { mode: w, setMode: S, switchSessionMode: b } = Ol(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = h;
  const v = $l({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: M,
    jobStatus: R,
    jobTerminal: P,
    jobRefreshRevision: C,
    refreshJobArtifacts: $,
    refreshJobStatus: I
  } = v, T = vc({
    sessionJobId: h,
    jobId: r,
    routeDocumentId: o,
    documentJobId: m.documentJobId,
    rejectedDocumentJobId: m.rejectedDocumentJobId,
    sourceOnly: d,
    locationKey: n,
    sessionIdentity: a,
    committedSource: m.activeCommittedDocumentSource,
    applyIdentityEvent: m.applyIdentityEvent,
    publishPayload: v.publishPayload,
    clearPayload: v.clearPayload,
    switchSessionMode: b,
    jobRefreshRevision: C,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = N(() => {
    var B;
    e.current = !0, (B = t.current) == null || B.abort();
  }, []), L = U(
    () => ({
      fetchProtected: Qe().fetchProtected,
      jobId: h,
      jobPayload: k,
      manifestPayload: M,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: y
    }),
    [h, k, M, T.sourceUrl, T.translatedUrl, y]
  );
  return {
    jobId: h,
    jobStatus: R,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: P,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: d,
    mode: w,
    setMode: S,
    sourceUrl: T.sourceUrl,
    translatedUrl: T.translatedUrl,
    sourceFile: T.sourceFile,
    translatedFile: T.translatedFile,
    translatedLayout: T.translatedLayout,
    assetsReady: T.assetsReady,
    boot: T.boot,
    title: T.title,
    regions: T.regions,
    regionsSettled: T.regionsSettled,
    readerMetadata: T.readerMetadata,
    readerErrors: T.readerErrors,
    download: L,
    refreshJobArtifacts: $,
    refreshJobStatus: I,
    refreshCommittedDocument: m.refreshCommittedDocument,
    prepareClose: E
  };
}
const Sc = 160, kc = 8, Tc = 0;
function Ic() {
  const e = A(null), [t, n] = x(null), [r, o] = x(Tc), a = N((s) => {
    e.current = s, n(s);
  }, []);
  return D(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Sc || o((u) => Math.abs(u - l) < kc ? u : l);
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
function Ec(e) {
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
const On = { source: 0, translated: 0 };
function Pc(e, t) {
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
  const [f, m] = x(() => ({
    identity: l,
    pages: On
  })), [h, g] = x(() => ({ identity: l, tick: 0 })), d = f.identity === l ? f.pages : On, y = h.identity === l ? h.tick : 0, w = Ec({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c || !!e.translatedHtml
  }), { primaryPane: S } = w, b = N((I, T) => {
    u.current === l && m((E) => {
      const L = E.identity === l ? E.pages : On;
      return L[T] === I && E.identity === l ? E : {
        identity: l,
        pages: { ...L, [T]: I }
      };
    });
  }, [l]), v = A(null), k = N(() => {
    v.current && clearTimeout(v.current);
    const I = l;
    v.current = setTimeout(() => {
      v.current = null, u.current === I && g((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  D(() => (v.current && (clearTimeout(v.current), v.current = null), m((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [l]);
  const M = U(
    () => Math.max(d.source, d.translated),
    [d]
  ), R = S === "translated" ? d.translated : d.source || d.translated, P = t == null ? void 0 : t.userZoom, C = t == null ? void 0 : t.shellWidth, $ = `${l}-${y}-${P}-${n}-${d.source}-${d.translated}-${C}`;
  return {
    ...w,
    numPagesByPane: d,
    hudNumPages: M,
    primaryNumPages: R,
    metricsTick: y,
    onNumPages: b,
    onMetrics: k,
    rowSyncRevision: $
  };
}
const Ie = "data-reader-page", Se = "data-reader-pane", Er = "data-natural-height", es = "reader-react-root", ts = "reader-react-grid", ns = "reader-react-scroll-shell", on = "reader-react-pdf-pane", rs = "reader-react-pdf-page", In = "reader-react-pdf-page-placeholder", Pr = "reader-react-pdf-page-slot";
function En(e, t) {
  const n = e != null ? `[${Ie}="${e}"]` : `[${Ie}]`;
  return t ? `${n}[${Se}="${t}"]` : n;
}
function Rr() {
  return `.${Pr}[${Ie}]`;
}
function Pn(e) {
  return Number(e.getAttribute(Ie));
}
const os = 0.25, Rn = 1, Rc = 0.05, an = 0.5, Mc = 16, xc = 8, as = Mc + xc, Ac = 720;
function Rt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ss(e) {
  return Number.isFinite(e) && e < Ac;
}
function Et(e, t = Number.POSITIVE_INFINITY) {
  return ss(t) && (e === "source" || e === "translated") ? Rn : an;
}
function Ye(e) {
  return Number.isFinite(e) ? Math.min(Rn, Math.max(os, e)) : an;
}
function Zt(e, t) {
  const n = Ye(Number(e) + t * Rc);
  return Math.round(n * 100) / 100;
}
function _c(e) {
  return Math.round(Ye(e) * 100);
}
function is(e) {
  const n = (Number(e) || 0) - as;
  return Math.max(160, Math.floor(n));
}
function Nc(e, t = an) {
  const n = Ye(t);
  return is((Number(e) || 0) * n);
}
function Lc(e, t) {
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
const Cc = 8;
function $c(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Cc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const ls = 200, Dc = [
  "markdown"
], Oc = Dc;
function cs(e) {
  return Oc.includes(e);
}
const zc = "retainpdf:reader:view:v1:", yo = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Fc = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function us() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function tr(e) {
  return `${e || ""}`.trim();
}
function Bc({
  documentId: e,
  jobId: t
}) {
  const n = tr(e);
  if (n) return `document:${n}`;
  const r = tr(t);
  return r ? `job:${r}` : "";
}
function ds(e) {
  const t = tr(e);
  return t ? `${zc}${t}` : "";
}
function Hc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function jc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!yo.has(t) || !yo.has(n) || t === n))
    return { left: t, right: n };
}
function Uc(e) {
  return e === null ? null : cs(e) ? e : void 0;
}
function Wc(e) {
  return Fc.has(e) ? e : void 0;
}
function fs(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Hc(t.anchor), r = Number(t.zoom), o = Wc(t.mode), a = jc(t.splitLayout), s = Uc(t.assistantPanel);
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
function Ke(e, t = us()) {
  const n = ds(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? fs(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function _n(e, t, n = us()) {
  const r = ds(e);
  if (!r || !n) return null;
  const o = Ke(e, n), a = fs({
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
function Kc(e, t, n = "") {
  var m;
  const [r, o] = x(() => {
    var h;
    return ((h = Ke(n)) == null ? void 0 : h.zoom) ?? Et(e, Rt());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), c = A(((m = Ke(n)) == null ? void 0 : m.zoom) !== void 0);
  D(() => {
    var d;
    if (s.current === n) return;
    s.current = n;
    const h = (d = Ke(n)) == null ? void 0 : d.zoom;
    c.current = h !== void 0;
    const g = h ?? Et(e, Rt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), D(() => {
    if (c.current) return;
    const h = Et(e, Rt()), g = a.current;
    Math.abs(h - g) < 5e-4 || (i.current = 1, a.current = h, o(h));
  }, [e]);
  const l = N((h, g) => {
    const d = Ye(h), y = a.current;
    Math.abs(d - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : d / (y || 1), a.current = d, c.current = !0, _n(s.current, { zoom: d }), o(d));
  }, []), u = N((h) => {
    l(Zt(a.current, h));
  }, [l]), f = N((h) => {
    l(Et(h));
  }, [l]);
  return Ne(() => {
    const h = i.current;
    Math.abs(h - 1) < 1e-3 || (i.current = 1, Lc(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const Vc = 160, qc = 3e-3, bo = 50, Jc = 16, Gc = 800;
function Xc(e, t = 0) {
  const n = t === 1 ? Jc : t === 2 ? Gc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-bo, Math.min(bo, r));
  return Math.exp(-o * qc);
}
function Yc(e, t, n = 0) {
  return Ye(e * Xc(t, n));
}
function Zc(e) {
  return Math.round(Ye(e) * 100) / 100;
}
function Qc(e, t, n) {
  const r = Ye(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ye(t) / r;
  const a = (o + as) / r;
  return is(a * Ye(t)) / o;
}
function eu(e) {
  return Array.from(e.querySelectorAll(Rr()));
}
function tu(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function nu(e, t, n) {
  let r = null;
  for (const s of eu(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = tu(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Ie) || "",
    pane: o.getAttribute(Se) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function ru(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ms(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Rr()}[${Ie}="${t.page}"][${Se}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (ru(n, e).scrollLeft += a);
}
function ou(e, t, n, r) {
  const o = e.querySelector(`.${ts}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function zt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const au = 600, su = 1e3;
function iu(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ms(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), su);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function lu(e, t, n) {
  const r = A(t);
  r.current = t;
  const o = A(n);
  o.current = n;
  const a = A(null), s = A(null), i = A(null);
  D(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = Zc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        zt(u.grid);
        return;
      }
      const m = { anchor: u.anchor, grid: u.grid, fallback: null };
      m.fallback = setTimeout(() => {
        s.current === m && (s.current = null, zt(m.grid));
      }, au), s.current = m, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var h, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (h = i.current) == null || h.call(i), i.current = null;
        const d = s.current;
        d && (d.fallback && clearTimeout(d.fallback), s.current = null, zt(d.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: nu(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Yc(f.target, u.deltaY, u.deltaMode);
      const m = Qc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = ou(e, m, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, Vc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), zt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Ne(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), zt(c.grid), !(!e || !c.anchor) && (ms(e, c.anchor), (l = i.current) == null || l.call(i), i.current = iu(e, c.anchor)));
  }, [t, e]);
}
function cu(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: N((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const Mr = 56;
function hs(e, t = Mr) {
  return e.getBoundingClientRect().top + t;
}
function ps(e, t) {
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
  const o = Pn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Jt(e, t, n = Mr) {
  if (!e)
    return null;
  const r = En(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = hs(e, n), i = ps(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Nt(e, t, n = "auto", r, o = Mr) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(En(a, r))), i || (i = e.querySelector(En(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), m = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - m) >= 1 && (e.scrollTop = m) : e.scrollTo({ top: m, behavior: n }), !0;
}
function uu(e, t, n = "smooth", r) {
  return Nt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function nr(e, t, n) {
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
function du(e, t, n) {
  return nr(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Mn(e, t) {
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
function fu(e, t, n = !0, r = "", o) {
  const [a, s] = x(1);
  return D(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, u = 0;
    const f = En(void 0, o), m = () => {
      if (c) return;
      const d = Array.from(i.querySelectorAll(f));
      if (!d.length)
        return;
      const y = hs(i), w = ps(d, y);
      w && s(w.page);
    }, h = () => {
      c || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, m();
      }));
    }, g = () => {
      if (c) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        l = setTimeout(g, 120);
        return;
      }
      m(), i.addEventListener("scroll", h, { passive: !0 });
    };
    return g(), () => {
      c = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), i.removeEventListener("scroll", h);
    };
  }, [e, t, n, r, o]), a;
}
const mu = `canvas, .react-pdf__Page, .${rs}, .${In}`, vo = /* @__PURE__ */ new WeakMap();
function hu(e) {
  const t = Number(e.getAttribute(Er));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = vo.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(mu), vo.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function pu(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function gu(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Rr()).forEach((r) => {
    const o = Pn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = hu(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function yu(e, t, n = "", r) {
  const [o, a] = x(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Ne(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, f = !1;
    const m = () => {
      var k;
      if (c) return;
      const b = e.current;
      if (!b) return;
      const v = gu(b);
      pu(s.current, v) || (s.current = v, a(v)), u && !f && (f = !0, (k = i.current) == null || k.call(i));
    }, h = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(m);
      });
    };
    h();
    const g = window.setTimeout(h, 100), d = window.setTimeout(() => {
      u = !0, h();
    }, 300), y = window.setTimeout(h, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => h()), S.observe(w)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(d), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const bu = [0, 48, 140, 320, 560], vu = 700, wu = [80, 200, 400], Su = 500, ku = 50, Tu = /* @__PURE__ */ new Set([
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
]), Iu = 180, wo = [0, 48, 140, 320, 700, 1200];
function Eu(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((T = Ke(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = A(null), l = A(!1), u = A(r), f = A(null), m = A(null), h = A(null), g = A(null), d = A(a), y = A(""), w = A(n);
  w.current = n;
  const S = N(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, m.current != null && (clearTimeout(m.current), m.current = null);
  }, []), b = N(() => {
    !l.current && c.current == null || (S(), h.current != null && (clearTimeout(h.current), h.current = null), c.current = null, l.current = !1);
  }, [S]), v = N((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const L = () => {
      g.current = null, _n(d.current, {
        anchor: He(i.current)
      });
    };
    E ? L() : g.current = setTimeout(L, Iu);
  }, []), k = N((E) => {
    i.current = He(E), c.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, l.current = !1;
    }, ku);
  }, []);
  D(() => {
    if (!o)
      return;
    let E = !1, L = null, B = null, W = null;
    const j = () => {
      if (E) return;
      const Q = e.current;
      if (!Q) {
        W = setTimeout(j, 50);
        return;
      }
      L = Q, B = () => {
        if (l.current)
          return;
        const ae = Jt(L, w.current);
        ae && (i.current = ae, v());
      }, L.addEventListener("scroll", B, { passive: !0 }), l.current || B();
    };
    return j(), () => {
      E = !0, W != null && clearTimeout(W), L && B && L.removeEventListener("scroll", B);
    };
  }, [o, r, n, e, v]), D(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const L = (B) => {
      B.metaKey || B.ctrlKey || B.altKey || Tu.has(B.key) && b();
    };
    return E.addEventListener("wheel", b, { passive: !0 }), E.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", L), () => {
      E.removeEventListener("wheel", b), E.removeEventListener("touchmove", b), window.removeEventListener("keydown", L);
    };
  }, [o, e, b]), Ne(() => {
    var L;
    if (d.current === a) return;
    v(!0), S(), h.current != null && (clearTimeout(h.current), h.current = null), d.current = a, y.current = "";
    const E = (L = Ke(a)) == null ? void 0 : L.anchor;
    i.current = E ? He(E) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, v, S]), D(() => {
    var L;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const E = He(
      ((L = Ke(a)) == null ? void 0 : L.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, c.current = E, l.current = !0, S(), f.current = nr(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: wo,
        onDone: () => k(E)
      }
    ), m.current = setTimeout(() => {
      m.current = null, k(E);
    }, Math.max(...wo) + 160), () => S();
  }, [o, s, a, e, k, S]), D(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const E = c.current ? He(c.current) : He(i.current);
    return l.current = !0, c.current = E, i.current = E, S(), f.current = nr(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: bu,
        onDone: () => k(E)
      }
    ), m.current = setTimeout(() => {
      m.current = null, k(E);
    }, vu), () => {
      S();
    };
  }, [r, o, n, e, k, S]), D(() => () => {
    S(), h.current != null && (clearTimeout(h.current), h.current = null), v(!0);
  }, [S, v]);
  const M = N(() => {
    const E = Jt(
      e.current,
      w.current
    );
    return He(E || i.current);
  }, [e]), R = N(() => {
    l.current = !0;
    const E = Jt(
      e.current,
      w.current
    ), L = He(E ?? i.current);
    return i.current = L, c.current = L, v(), L;
  }, [e, v]), P = N((E, L, B) => {
    const W = B || w.current, j = Mn(E, L || 1), Q = { page: j, fraction: 0 };
    i.current = Q, l.current = !0, c.current = Q, v(), S(), uu(e.current, j, "smooth", W), f.current = du(
      () => e.current,
      j,
      {
        behavior: "auto",
        pane: W,
        delaysMs: wu,
        onDone: () => k(Q)
      }
    ), m.current = setTimeout(() => {
      m.current = null, k(Q);
    }, Su);
  }, [e, k, S, v]), C = N(() => He(i.current), []), $ = N(() => l.current, []), I = N(() => {
    if (!l.current || !c.current)
      return;
    const E = He(c.current);
    Nt(
      e.current,
      E,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: M,
    beginModeSwitch: R,
    goToPage: P,
    getAnchor: C,
    isRestoring: $,
    repinIfRestoring: I
  };
}
function Pu(e, t) {
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
function gs(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Ru = [0, 80, 200, 400, 800], Mu = 120, xu = 400;
function Au(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = A(a);
  f.current = a;
  const m = A(s);
  m.current = s;
  const h = A(i);
  h.current = i;
  const g = A(n);
  g.current = n, D(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const d = kl(), y = Pu(d, m.current);
    if (y == null && (d != null && d.blockId) && !u) return;
    const w = gs(d, y, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, d && ((k = h.current) == null || k.call(h, d, y));
    const S = [];
    let b = 0;
    for (const M of Ru)
      b = Math.max(b, M), S.push(
        setTimeout(() => {
          f.current(y);
        }, M)
      );
    return S.push(
      setTimeout(() => {
        var M;
        (M = g.current) == null || M.call(g);
      }, b + Mu)
    ), () => {
      for (const M of S) clearTimeout(M);
    };
  }, [r, o, c, l, t, u]);
}
function _u(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Nu(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = xu,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = A(a);
  u.current = a;
  const f = A(l);
  f.current = l;
  const m = A(0);
  D(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || m.current === o) return;
    const h = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", d = _i(g, o, u.current);
      if (m.current = o, d === null) return;
      const y = `${new URLSearchParams(d).get("block_id") || ""}`.trim();
      t.current = gs(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || _u)(d);
    }, s);
    return () => clearTimeout(h);
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
function Lu(e) {
  const t = A(""), [n, r] = x(!1), o = N(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Au(a, t, o), Nu(e, t, n);
}
const Ft = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Cu(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function So(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function ys(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = So(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = So(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function $u(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = ys(r, t, n);
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
function Du(e) {
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
function Ou(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function zu(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function Fu(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Bu(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const ko = [250, 500, 1e3, 2e3, 4e3], zn = [80, 160, 320, 640, 1e3, 1500], To = [250, 500, 1e3, 2e3, 4e3, 5e3];
function rr(e, t) {
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
function xr(e) {
  return zi(e) ? `${e.code || ""}`.trim() : "";
}
function cn(e, t) {
  const n = xr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Hu(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ys(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Fi(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = xr(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = zn[Math.min(s, zn.length - 1)];
    if (await rr(i, r), s >= zn.length + 2) throw a;
  }
}
function ju({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = x(Ft), s = A(o), i = A("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Yt(l) ? l : "";
  return D(() => {
    if (!n || !c) {
      i.current = "", s.current = Ft, a(Ft);
      return;
    }
    const f = r === void 0 ? Sl() : r, m = i.current === c;
    if (i.current = c, !f) {
      const b = {
        ...m ? s.current : Ft,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = b, a(b);
      return;
    }
    const h = new AbortController();
    let g = !1;
    const d = {
      ...m ? s.current : Ft,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = d, a(d);
    const y = (b) => {
      h.signal.aborted || a((v) => {
        const k = b(v);
        return s.current = k, k;
      });
    }, w = async () => {
      let b = 0;
      for (; !h.signal.aborted; )
        try {
          const v = await f.fetchLayout(c, { signal: h.signal });
          g = !0, y((k) => ({
            ...k,
            layoutByPage: Cu(v),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = xr(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            y((R) => ({
              ...R,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: cn(v, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((R) => ({
              ...R,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((R) => ({
            ...R,
            connection: "connecting",
            jobStatus: l,
            error: cn(v, "正在等待 OCR 版面数据")
          })), await rr(ko[Math.min(b, ko.length - 1)], h.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await w(), !g || h.signal.aborted) return;
      let b = 0;
      for (; !h.signal.aborted; ) {
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
            signal: h.signal,
            onEvent: async (v) => {
              if (v.seq <= s.current.lastSeq) return;
              let k;
              try {
                k = await Hu(
                  c,
                  v,
                  s.current,
                  h.signal,
                  f
                );
              } catch (M) {
                if ((M == null ? void 0 : M.name) === "AbortError" || h.signal.aborted) throw M;
                y((R) => ({
                  ...R,
                  lastSeq: Math.max(R.lastSeq, v.seq),
                  error: cn(M, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((M) => {
                const R = $u(M, v, k);
                return u ? {
                  ...R,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...R,
                  jobStatus: l
                };
              }), b = 0;
            }
          });
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError" || h.signal.aborted) return;
          y((k) => ({
            ...k,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: cn(v, "实时译文连接已中断，正在重连")
          }));
        }
        if (h.signal.aborted) return;
        if (u) {
          y((v) => ({
            ...v,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await rr(To[Math.min(b, To.length - 1)], h.signal).catch(() => {
        }), b += 1;
      }
    })(), () => h.abort();
  }, [n, r, c, u]), o;
}
function Uu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Wu(e, t = !0) {
  const [n, r] = x(() => /* @__PURE__ */ new Map());
  return D(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Qe().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Uu(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Ku = 4500;
function Vu(e) {
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
const qu = /* @__PURE__ */ new Set(["book", "translate"]);
function bs(e) {
  return !!(e.jobId && e.sourceUrl && qu.has(e.workflow));
}
function Ju(e) {
  return !!(bs(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Gu() {
  const e = wc(), t = bs({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Ju({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Yt(o) && (r.current.running = !0);
  const a = ju({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = Ic(), u = Wu(e.jobId, !e.sourceOnly), f = Bc({
    documentId: e.documentId,
    jobId: e.jobId
  }), m = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: g } = Kc(e.mode, s, f);
  lu(i, h, g);
  const d = Pc(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile,
      translatedHtml: !!e.translatedLayout
    },
    { userZoom: h, shellWidth: c, identityKey: m }
  ), {
    beginModeSwitch: y,
    goToPage: w,
    repinIfRestoring: S
  } = Eu(s, {
    primaryPane: d.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: d.primaryNumPages > 0
  });
  D(() => {
    S();
  }, [c, S]);
  const b = yu(
    s,
    d.compareMode,
    d.rowSyncRevision,
    S
  ), v = fu(
    s,
    d.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${d.metricsTick}`,
    d.primaryPane
  ), k = N((j, Q) => {
    var ne, fe;
    const ae = Math.max(
      Number(d.hudNumPages) || 0,
      Number(d.primaryNumPages) || 0,
      Number((ne = d.numPagesByPane) == null ? void 0 : ne.source) || 0,
      Number((fe = d.numPagesByPane) == null ? void 0 : fe.translated) || 0
    );
    w(j, ae, Q);
  }, [w, d.hudNumPages, d.primaryNumPages, d.numPagesByPane]), [M, R] = x(null), P = A(null), C = N((j) => {
    P.current && clearTimeout(P.current), R(j), j && (P.current = setTimeout(() => R(null), Ku));
  }, []);
  D(() => () => {
    P.current && clearTimeout(P.current);
  }, []);
  const $ = N((j) => {
    const Q = $n(e.regions, j);
    return Q ? ao(Q, d.primaryPane).page : null;
  }, [e.regions, d.primaryPane]), I = N((j, Q) => {
    const ae = Q || d.primaryPane, ne = typeof j == "object" && j ? `${j.block_id || ""}`.trim() : "", fe = typeof j == "object" && j ? `${j.image_url || ""}`.trim() : "", se = typeof j == "object" && j ? j.page_idx != null ? Number(j.page_idx) + 1 : j.page != null ? Number(j.page) : null : typeof j == "number" ? j + 1 : null, be = Li(e.regions, fe, se) || $n(e.regions, ne) || (typeof j == "object" ? Ci(e.regions, j) : null);
    let me = be ? ao(be, ae).page : null;
    me == null && (me = Vu(j)), !(me == null || me < 1) && (C(be), k(me, ae));
  }, [C, k, d.primaryPane, e.regions]);
  Lu({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: d.hudNumPages || 0,
    currentPage: v,
    goToPage: k,
    resolveBlockPage: $,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (j) => {
      C($n(e.regions, j.blockId));
    }
  });
  const { setModeKeepingPage: T } = cu({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  D(() => {
    C(null);
  }, [m, C]);
  const E = !e.boot.loading && !e.boot.failed, L = U(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), B = U(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), W = U(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: g,
    shell: L,
    panes: d,
    sessionFiles: B,
    rowHeights: b,
    goToPage: k,
    activeRegion: M,
    jumpToAnchor: I,
    setModeKeepingPage: T,
    download: e.download,
    showHud: E,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, L, d, B, b, k, M, I, T, E, h, g, f, a, n, u]);
  return U(() => ({
    ...W,
    currentPage: v
  }), [W, v]);
}
const Xu = [
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
], Yu = [
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
function Zu(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Xu)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Qu(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const ed = ".reader-notes-panel";
function td(e) {
  return e instanceof Element ? !!e.closest(ed) : !1;
}
function nd(e) {
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
  D(() => {
    if (!u)
      return;
    const f = (m) => {
      if (m.defaultPrevented || m.metaKey || m.ctrlKey || m.altKey || Qu(m.target) || td(m.target))
        return;
      const h = m.key, g = Zu(h);
      if (g) {
        if (g.mode) {
          if (n && g.mode !== "source")
            return;
          m.preventDefault(), r(g.mode);
          return;
        }
        if (g.action === "doc-dark") {
          if (!l || m.repeat) return;
          m.preventDefault(), l();
          return;
        }
        if (!(g.requiresPages && i <= 0))
          switch (m.preventDefault(), g.action) {
            case "zoom-in":
              a(Zt(o, 1));
              return;
            case "zoom-out":
              a(Zt(o, -1));
              return;
            case "zoom-reset":
              a(Et(t, Rt()));
              return;
            case "next-page":
              c(Mn(s + 1, i));
              return;
            case "prev-page":
              c(Mn(s - 1, i));
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
const Me = { size: 16, strokeWidth: 1.75 }, Io = { size: 12, strokeWidth: 1.75 }, rd = "retainpdf:soft-reader-close";
function od() {
  return new URL("./index.html", window.location.href).href;
}
function ad() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: rd },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function sd(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function id() {
  if (!(typeof window > "u") && !ad()) {
    if (sd(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(od());
  }
}
function ld({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function cd({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ _(ld, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), id();
  }, children: [
    /* @__PURE__ */ p(Oa, { className: "reader-close-home-icon", ...Me, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const ud = 3e3, dd = 8;
async function fd(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function md(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function hd(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = ud;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], m = md(f == null ? void 0 : f.title);
      if (!m) continue;
      n -= 1;
      const h = c ? `${c}.${u}` : `${u}`, g = { id: h, title: m, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < dd && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, h));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await fd(e, i);
  })), a;
}
function vs(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function pd(e, t) {
  let n = null;
  for (const r of vs(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let Eo = !1;
function ws() {
  if (Eo)
    return;
  const e = _t().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (kn.GlobalWorkerOptions.workerSrc = e, Eo = !0);
}
const at = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), gd = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, yd = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, bd = {
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
}, Po = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function vd(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Po(o ?? a ?? "", gd)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Po(o ?? a ?? "", yd)).replace(/\\([a-zA-Z]+)/gu, (r, o) => bd[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function wd(e) {
  return at(e.translatedBlockText) || at(e.translated.text) || at(e.source.text);
}
const Sd = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function kd(e) {
  const t = [];
  for (const n of e) {
    if (!Sd(n)) continue;
    const r = vd(wd(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const Td = 24, Id = 60;
function Ro(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Td), o = Math.min(e.length, n + t.length + Id), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Ed(e, t, n = 200) {
  const r = at(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = at(a.translatedBlockText) || at(a.translated.text), c = i ? Ro(i, r) : null, l = c ?? Ro(at(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function un(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Wt(e, t) {
  const n = at(t).toLowerCase();
  if (!n || !e) return un(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${un(e.slice(a, s))}<mark class="reader-find-mark">${un(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + un(e.slice(a));
}
function Pd(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Rd = /^data-[a-z0-9-]+$/;
function Mo(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function Md(e, t, n = "") {
  if (!t.length) return Wt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Wt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => Rd.test(c)).map(([c, l]) => ` ${c}="${Mo(l)}"`).join("");
    o += `<mark class="${Mo(s.className)}"${i}>${Wt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Wt(e.slice(a), n);
}
function we(e) {
  return typeof e == "string" ? e : "";
}
function xd(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Ad(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function _d(e) {
  return {
    source: we(e == null ? void 0 : e.source_text) || we(e == null ? void 0 : e.unit_source_text),
    translated: we(e == null ? void 0 : e.protected_translated_text) || we(e == null ? void 0 : e.translated_text)
  };
}
const Nd = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Ss(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Ld(e) {
  const t = Ss(e).sort((r, o) => we(r.ts).localeCompare(we(o.ts)));
  return t.length ? [
    { text: we(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: we(r.new_text),
      label: Nd[we(r.source)] || we(r.source) || "修订",
      ts: we(r.ts),
      reason: we(r.reason)
    }))
  ].reverse() : [];
}
function Cd(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function $d(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return we(r.finished_at) || we(n.finished_at) || "";
}
function Dd(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Ss(e).sort((a, s) => we(a.ts).localeCompare(we(s.ts)));
  for (const a of o) {
    const s = new Date(we(a.ts)).getTime(), i = we(a.reader_item_id) || we(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, we(a.new_text));
  }
  return n;
}
const Od = {
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
function zd(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = Od[we(n.kind)] || we(n.kind) || "问题", o = we(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Fd = /* @__PURE__ */ new Set(["text", "formula"]);
function Ar(e) {
  return Fd.has(e);
}
function ks(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || Ar(Ce(n));
}
function Bd(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Ar(Ce(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Hd = 300, jd = 72;
function Ud(e, t) {
  if (e.width >= Hd && e.height >= jd)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Wd = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Kd(e, t, n) {
  return e.flatMap((r) => {
    if (!Wd.has(Ce(r.region))) return [];
    const o = lt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function xo(e, t, n) {
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
async function Vd(e) {
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
const qd = "reader-text-hover-copy", Jd = "reader-text-hover-edit", Gd = "reader-text-hover-zoom", Xd = "reader-text-hover-id";
function Yd(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Ts = "reader-text-hover-tools";
function dn({
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
const Zd = 26, Qd = 220;
function ef(e, t = Qd) {
  return e.height < Zd * 2 || e.width < t;
}
function tf({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? wr : e === "failed" ? bt : za, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function nf({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = x("idle"), [u, f] = x("idle"), [m] = x(() => Yd()), h = A([]), g = (e == null ? void 0 : e.itemId) || "";
  if (D(() => {
    l("idle"), f("idle");
    const k = h.current;
    return () => {
      k.forEach((M) => window.clearTimeout(M)), h.current = [];
    };
  }, [g]), !e) return null;
  const d = $i(e.highlight.region, t), y = Ce(e.highlight.region), w = (k, M) => async (R) => {
    R.preventDefault(), R.stopPropagation();
    const P = await Vd(k);
    M(P ? "copied" : "failed"), h.current.push(window.setTimeout(() => M("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (ef(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ _(
        "div",
        {
          className: Ts,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            m ? /* @__PURE__ */ p(
              dn,
              {
                className: Xd,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && Ar(y) ? /* @__PURE__ */ p(
              dn,
              {
                className: Jd,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(wn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            d ? /* @__PURE__ */ p(
              dn,
              {
                className: qd,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: w(d, l),
                children: /* @__PURE__ */ p(tf, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              dn,
              {
                className: Gd,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Hi, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function rf(e, t) {
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
function of(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = lt(
      rf(e, a),
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
const af = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', sf = 256, Bt = /* @__PURE__ */ new Map();
function lf(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Is(e) {
  const t = `${e || ""}`, { text: n, slots: r } = dl(t, { bareLatex: !0 }), o = lf(n), a = fl(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Bt.get(t);
  if (!s && (s = ml(o, r), Bt.set(t, s), Bt.size > sf)) {
    const i = Bt.keys().next().value;
    i !== void 0 && Bt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Fn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ge(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function cf(e, t) {
  const n = e.typography, r = Ge(t) || 1, o = Ge(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Fn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ge(n == null ? void 0 : n.fit_min_font_size_pt), u = Ge(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), m = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), h = o ? o * r : c, g = Ge(n == null ? void 0 : n.leading_em), d = [
    Ge(n == null ? void 0 : n.padding_top_pt) || 0,
    Ge(n == null ? void 0 : n.padding_right_pt) || 0,
    Ge(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ge(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || af,
    fontSizePx: Math.max(f, Math.min(m, h)),
    minFontSizePx: f,
    maxFontSizePx: m,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Fn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Fn(e.kind) ? "center" : "justify",
    padding: d,
    exact: !!o
  };
}
function uf(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const m = s.get(f);
    if (m !== void 0) return m;
    const { width: h, height: g } = e(f), d = h <= t + 0.5 && g <= n + 0.5;
    return s.set(f, d), d;
  };
  let c = o, l = a, u = Math.min(r.requestedFontSizePx, l);
  if (i(u)) {
    if (!r.exact) {
      c = u;
      for (let f = 0; f < 6 && l > c; f += 1) {
        const m = (c + l) / 2;
        i(m) ? (u = m, c = m) : l = m;
      }
    }
  } else {
    l = u, u = c;
    for (let f = 0; f < 8 && l > c; f += 1) {
      const m = (c + l) / 2;
      i(m) ? (u = m, c = m) : l = m;
    }
  }
  return Math.max(o, u);
}
const df = 512, Ht = /* @__PURE__ */ new Map();
let or = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  or += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  or += 1;
}));
function ff(e, t, n, r) {
  return [
    or,
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
function _r({ item: e, pageScale: t }) {
  const n = A(null), r = U(
    () => Is(e.translatedText),
    [e.translatedText]
  ), [o, a] = x(r.fallbackHtml), s = U(
    () => cf(e, t),
    [e, t]
  );
  D(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((m) => {
      f && a(m);
    }), () => {
      f = !1;
    };
  }, [r]), Ne(() => {
    const f = n.current;
    if (!f) return;
    const [m, h, g, d] = s.padding, y = Math.max(1, e.rect.width - d - h), w = Math.max(1, e.rect.height - m - g), S = ff(o, y, w, s);
    let b = Ht.get(S);
    if (b === void 0 && (b = uf(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ht.set(S, b), Ht.size > df)) {
      const v = Ht.keys().next().value;
      v !== void 0 && Ht.delete(v);
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
function mf({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = U(
    () => of(e, t, n, r),
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
        _r,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const hf = nn(mf);
function pf({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ _("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        _r,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Ce(a.highlight.region),
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
const gf = nn(pf), Es = 24, rt = Es * 2 + 4, Xe = 24, yf = 4, bf = 6, ht = (e) => e.left + e.width, it = (e) => e.top + e.height;
function Kt(e, t) {
  const n = Math.min(ht(e), ht(t)) - Math.max(e.left, t.left), r = Math.min(it(e), it(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Ao = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ht(t) && r >= t.top && r <= it(t);
}, vf = (e) => e.height > 40 && e.height > e.width * 2.5;
function wf(e, t, n) {
  if (!t.length || e.height < Xe || e.width < n + 8) return null;
  const r = Math.max(...t.map(it)), o = ht(e) - 4 - n;
  for (const a of [r, it(e) - 2]) {
    const s = Math.max(e.top, a - Xe), i = { left: o, top: s, width: n, height: Xe };
    if (!t.some((c) => Kt(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Sf(e, t) {
  const n = [], r = (a) => {
    const s = Es + yf, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ht(e), top: i, width: s, height: rt } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: rt } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Xe - 3, width: rt, height: Xe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: it(e), width: rt, height: Xe + 3 } }), r(!0);
  const o = wf(e, t, rt);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ht(e) - 4 - rt, top: e.top + o, width: rt, height: Xe } }), n;
}
function kf(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !vf(S)), i = s.filter((S) => Ao(S, t)), c = s.filter((S) => !Ao(S, t)), l = n.filter((S) => S !== t && Kt(S, t) < t.width * t.height * 0.5), u = Sf(t, i).filter(({ box: S, overhang: b }) => {
    const v = b ? bf : 0;
    return S.left >= -v && ht(S) <= r + v && S.top >= 0 && it(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, m = ({ box: S }) => !c.some((b) => Kt(S, b) > 0), h = u.filter((S) => S.placement !== "tail"), g = h.find((S) => m(S) && !l.some((b) => Kt(S.box, b) > 0));
  if (g) return f(g);
  const d = h.find(m) || u.find((S) => S.placement === "tail" && m(S));
  if (d) return f(d);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((v, k) => v + Kt(S.box, k), 0);
    b < w && (y = S, w = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function Tf(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Xe - 3 : it(r);
  return t >= r.left - 4 && t <= r.left + rt + 4 && n >= a && n <= a + Xe + 3;
}
const Bn = (e) => e.left + e.width, Hn = (e) => e.top + e.height;
function If(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > Bn(e) || f < e.top || f > Hn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, Bn(l)), i = Math.max(i, Hn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(Bn(e) + r, s + n) - c.left, c.height = Math.min(Hn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function Ef(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Pf(e, t, n, r) {
  const [o, a] = x(null);
  return Ne(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Ef(s) : [], c = Ce(t.highlight.region) === "figure", l = i.length && !c ? If(t.rect, i) : t.rect, u = n.filter((m) => m.itemId !== t.itemId).map((m) => m.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...kf({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function Rf({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = x(null), [i, c] = x(!1), [l, u] = x([]), [f, m] = x(""), [h, g] = x(""), [d, y] = x(!1), [w, S] = x(null), [b, v] = x([]), k = r.drafts, M = r.generation, R = N(async (I, T) => {
    if (e)
      try {
        u(Ld(await e.fetchRevisions(I, T)));
      } catch {
        u([]);
      }
  }, [e]);
  D(() => {
    if (s(null), u([]), S(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (I) return;
      const E = T == null ? void 0 : T.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const L = `${(T == null ? void 0 : T.item_id) || n}`, { source: B, translated: W } = _d(E);
      s({ readerItemId: n, itemId: L, source: B, current: W }), m(k.get(n) ?? W);
    }).catch((T) => {
      I || S({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), R(t, n), () => {
      I = !0;
    };
  }, [e, t, n, R]);
  const P = N((I) => {
    m(I), n && k.set(n, I);
  }, [n, k]), C = N(async (I, T) => {
    if (!e || !a || d) return !1;
    const E = I ?? f;
    if (!E.trim()) return !1;
    y(!0), S(null), v([]);
    try {
      const L = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (T ?? h).trim() || "在阅读页手动修改",
        ...M.current != null ? { expected_generation: M.current } : {}
      }), B = Number(L == null ? void 0 : L.generation);
      return Number.isFinite(B) && (M.current = B), k.delete(a.readerItemId), s({ ...a, current: E }), m(E), g(""), (L == null ? void 0 : L.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), R(t, a.readerItemId), !0;
    } catch (L) {
      const B = L;
      return (B == null ? void 0 : B.reason) === "generation_mismatch" && (M.current = null), S({ tone: "error", message: (B == null ? void 0 : B.message) || "保存失败，请稍后再试。" }), v(zd(B == null ? void 0 : B.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, d, f, h, t, o, R, k, M]), $ = N(() => {
    n && k.delete(n);
  }, [n, k]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: P,
    reason: h,
    setReason: g,
    saving: d,
    status: w,
    issues: b,
    save: C,
    discardDraft: $
  };
}
const Ps = "reader-inline-edit";
function Mf({ text: e }) {
  const [t, n] = x("");
  return D(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Is(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ _("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function xf({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var $;
  const s = e.itemId, i = Rf({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = x(!1), [u, f] = x(!1), m = A(null), h = Ud(e.rect, t), g = U(() => Bd(o), [o]), d = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: k } = n, M = N((I) => {
    const T = g[d + I];
    T && (k(T), a == null || a(T));
  }, [g, d, k, a]), R = N(() => {
    i.discardDraft(), v();
  }, [i, v]), P = N(async (I, T) => {
    await i.save(I, T) && v();
  }, [i, v]);
  D(() => {
    const I = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), M(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [M]), Ne(() => {
    const I = m.current;
    if (!I) return;
    I.style.height = "auto";
    const T = h.mode === "inline" ? h.minHeight : 0;
    I.style.height = `${Math.max(T, I.scrollHeight + 2)}px`;
  }, [i.draft, y, h.mode, h.mode === "inline" ? h.minHeight : 0]);
  const C = h.mode === "inline" ? { left: h.left, top: h.top, width: h.width } : { left: h.left, width: h.width, top: h.top, bottom: h.bottom };
  return /* @__PURE__ */ _(Te, { children: [
    h.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ _(
      "div",
      {
        className: `${Ps} is-${h.mode}`,
        style: C,
        role: "group",
        "aria-label": `改第 ${(($ = n.target) == null ? void 0 : $.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": h.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            Y,
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
            ul,
            {
              ref: m,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || P()) : I.key === "Escape" && (I.preventDefault(), R());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(Mf, { text: i.draft }) : null,
          /* @__PURE__ */ _("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(dt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: d <= 0, onClick: () => M(-1), children: /* @__PURE__ */ p(ji, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(dt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: d < 0 || d >= g.length - 1, onClick: () => M(1), children: /* @__PURE__ */ p(Sn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              Sr,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || P()) : I.key === "Escape" && (I.preventDefault(), R());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ _(
              Y,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p(Ui, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(Y, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: R, children: "取消" }),
            /* @__PURE__ */ p(
              Y,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  P();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, T) => {
            const E = I.text === y.current, L = [Cd(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ _("li", { "data-block-edit-history": I.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ _("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ _("span", { children: [
                  L,
                  E ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  Y,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      P(I.text, `回到「${L.replace(" · ", " ")}」那一版`);
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
const _o = 6e3;
function Rs(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Ms(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > _o && (s *= _o / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function Nn({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = A(null), [i, c] = x({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return D(() => {
    let u = !1, f = null;
    return c((m) => ({ status: "loading", cssHeight: m.cssHeight })), (async () => {
      try {
        const m = await e.getPage(t);
        if (u) return;
        const h = m.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), d = Ms(n, h, r, g), y = s.current, w = y == null ? void 0 : y.getContext("2d");
        if (!y || !w) return;
        y.width = d.canvasWidth, y.height = d.canvasHeight, c({ status: "loading", cssHeight: d.cssHeight });
        const S = m.getViewport({ scale: d.scale, offsetX: d.offsetX, offsetY: d.offsetY }), b = m.render({ canvasContext: w, viewport: S });
        f = b, await b.promise, u || c({ status: "ready", cssHeight: d.cssHeight });
      } catch (m) {
        !u && (m == null ? void 0 : m.name) !== "RenderingCancelledException" && c((h) => ({ status: "error", cssHeight: h.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, l]), /* @__PURE__ */ _(
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
const Af = 1600, Ln = { left: 0, top: 0, width: 1, height: 1 };
function xs(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function _f(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function Nf(e, t, n = Ln, r = Af) {
  const o = await e.getPage(t), a = Ms(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, xs(s);
}
async function Lf(e, t = Ln) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), xs(s);
}
function Cf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
function As(e) {
  var r;
  if (!e) return null;
  const t = /<svg([^>]*)>([\s\S]*)<\/svg>/i.exec(e);
  if (!t) return null;
  const n = (r = /viewBox="([^"]+)"/i.exec(t[1])) == null ? void 0 : r[1];
  return n ? { viewBox: n, inner: t[2] } : null;
}
const jt = /* @__PURE__ */ new Map(), $f = 512;
function No(e) {
  let t = jt.get(e);
  if (!t && (t = hl(e, !1).then(As), jt.set(e, t), jt.size > $f)) {
    const n = jt.keys().next().value;
    n !== void 0 && jt.delete(n);
  }
  return t;
}
function Df(e) {
  var n;
  let t = e.querySelector('g[data-mml-node="math"]');
  for (; t && t.children.length === 1 && ((n = t.firstElementChild) != null && n.hasAttribute("data-mml-node")); ) t = t.firstElementChild;
  return t ? [...t.children] : [];
}
const Lo = "rgb(40, 110, 215)", Of = 70, zf = 1400, Ff = 520, Bf = () => {
  var e;
  try {
    return ((e = globalThis.matchMedia) == null ? void 0 : e.call(globalThis, "(prefers-reduced-motion: reduce)").matches) ?? !1;
  } catch {
    return !1;
  }
};
function Hf(e) {
  if (Bf() || typeof e.animate != "function") return;
  const t = Df(e), n = Math.min(220, 1200 / Math.max(1, t.length));
  t.forEach((r, o) => {
    var a;
    (a = r.animate) == null || a.call(
      r,
      [{ opacity: 0, transform: "translate(0px, -600px)" }, { opacity: 1, transform: "translate(0px, 0px)" }],
      { duration: 460, delay: o * n, easing: "cubic-bezier(.2, .75, .25, 1)", fill: "backwards" }
    );
  }), e.animate(
    [{ color: Lo }, { color: Lo, offset: 0.75 }, { color: "currentColor" }],
    { duration: t.length * n + 900, easing: "ease-out" }
  );
}
function jf(e, t, n) {
  return !t || !n ? No(e) : n(t).then((r) => As(r) ?? No(e));
}
function Uf({ page: e, width: t, height: n, fontFamily: r, arrivedAt: o, charRise: a = !1, loadMath: s, fontByKey: i, findTerm: c = "" }) {
  const l = U(() => {
    const d = /* @__PURE__ */ new Map(), y = [...e.blocks, ...e.tables.flatMap((w) => w.blocks)];
    for (const w of y) for (const S of w.lines) for (const b of S.items) "tex" in b && d.set(b.tex, b.svg);
    return [...d];
  }, [e]), [u, f] = x(() => /* @__PURE__ */ new Map());
  D(() => {
    let d = !0;
    return Promise.all(l.map(async ([y, w]) => [y, await jf(y, w, s)])).then((y) => {
      d && f(new Map(y));
    }), () => {
      d = !1;
    };
  }, [l, s]);
  const m = Date.now() - o < 1500, h = A(null);
  D(() => {
    const d = h.current;
    if (!a || !d || typeof IntersectionObserver > "u") return;
    const y = [...d.querySelectorAll(".reader-layout-block")];
    for (const b of y) b.removeAttribute("data-risen");
    const w = /* @__PURE__ */ new Set(), S = new IntersectionObserver((b) => {
      for (const v of b) {
        if (!v.isIntersecting) continue;
        const k = v.target;
        k.setAttribute("data-risen", "run"), S.unobserve(k);
        const M = k.querySelectorAll(".reader-layout-line").length, R = setTimeout(() => {
          w.delete(R), k.setAttribute("data-risen", "done");
        }, Math.min(M * Of, zf) + Ff + 100);
        w.add(R);
      }
    }, { threshold: 0.2 });
    for (const b of y) S.observe(b);
    return () => {
      S.disconnect();
      for (const b of w) clearTimeout(b);
    };
  }, [a, e]);
  const g = (d) => {
    var y;
    `${((y = globalThis.getSelection) == null ? void 0 : y.call(globalThis)) || ""}`.trim() || Hf(d.currentTarget);
  };
  return /* @__PURE__ */ _(
    "svg",
    {
      ref: h,
      className: `reader-layout-page${a ? " is-char-rise" : ""}`,
      "data-html-page": e.index + 1,
      viewBox: `0 0 ${e.width} ${e.height}`,
      width: t,
      height: n,
      preserveAspectRatio: "none",
      style: { fontFamily: r },
      children: [
        e.erase.map((d, y) => /* @__PURE__ */ p("rect", { x: d.rect[0], y: d.rect[1], width: d.rect[2] - d.rect[0], height: d.rect[3] - d.rect[1], fill: Ot(d.fill) }, `erase:${y}`)),
        e.covers.map((d, y) => /* @__PURE__ */ p(
          "rect",
          {
            x: d.rect[0],
            y: d.rect[1],
            width: d.rect[2] - d.rect[0],
            height: d.rect[3] - d.rect[1],
            fill: Ot(d.fill)
          },
          `${d.block}:${y}`
        )),
        e.tables.flatMap((d) => [
          ...(d.cover ? [d.cover] : []).map((y) => /* @__PURE__ */ p("rect", { x: y.rect[0], y: y.rect[1], width: y.rect[2] - y.rect[0], height: y.rect[3] - y.rect[1], fill: Ot(y.fill) }, `${d.id}:cover`)),
          ...d.rules.map((y, w) => /* @__PURE__ */ p("rect", { x: y.rect[0], y: y.rect[1], width: y.rect[2] - y.rect[0], height: y.rect[3] - y.rect[1], fill: Ot(y.fill) }, `${d.id}:rule:${w}`))
        ]),
        [...e.blocks, ...e.tables.flatMap((d) => d.blocks)].map((d, y) => {
          const w = Ot(d.color);
          return /* @__PURE__ */ p(
            "g",
            {
              className: `reader-layout-block${m ? " is-arriving" : ""}`,
              "data-html-block": d.id,
              fill: w,
              fontSize: d.fontSize,
              fontWeight: d.weight === "bold" ? 700 : 400,
              style: { "--reader-html-order": y, color: w },
              children: d.lines.map((S, b) => /* @__PURE__ */ _("g", { className: "reader-layout-line", style: { "--l": b }, children: [
                c ? Wf(S, c).map(([v, k], M) => /* @__PURE__ */ p(
                  "rect",
                  {
                    className: "reader-layout-find-mark",
                    x: v,
                    y: S.baseline - d.fontSize * 0.9,
                    width: k - v,
                    height: d.fontSize * 1.2,
                    rx: d.fontSize * 0.15
                  },
                  `find:${M}`
                )) : null,
                S.items.map((v, k) => {
                  const M = `${b}:${k}`;
                  if ("tex" in v) {
                    const R = u.get(v.tex), P = d.fontSize;
                    return R ? /* @__PURE__ */ p(
                      "svg",
                      {
                        className: "reader-layout-math",
                        x: v.x,
                        y: S.baseline - v.h * P,
                        width: Math.max(0.01, v.w * P),
                        height: Math.max(0.01, (v.h + v.d) * P),
                        viewBox: R.viewBox,
                        preserveAspectRatio: "none",
                        "data-tex": v.tex,
                        "data-baseline": S.baseline,
                        onClick: g,
                        dangerouslySetInnerHTML: { __html: R.inner }
                      },
                      M
                    ) : null;
                  }
                  return /* @__PURE__ */ p(
                    "text",
                    {
                      x: v.x,
                      y: S.baseline,
                      lang: v.mode === "dflt" ? "en" : "zh-Hans",
                      fontFamily: v.font && (i != null && i.get(v.font)) ? `"${i.get(v.font)}", ${r}` : void 0,
                      children: v.t
                    },
                    M
                  );
                })
              ] }, b))
            },
            `${d.id}:${o}:${a ? "rise" : ""}`
          );
        })
      ]
    }
  );
}
function Wf(e, t) {
  const n = t.replace(/\s+/gu, " ").trim().toLowerCase();
  if (!n) return [];
  const r = [];
  let o = "";
  for (const l of e.items)
    r.push(o.length), o += "tex" in l ? "\0" : l.t;
  const a = o.toLowerCase(), s = (l) => {
    const u = e.items[l + 1], f = e.items[l];
    return u ? u.x : Math.max(e.x + e.width, f.x);
  }, i = (l) => {
    let u = 0;
    for (let f = 0; f < r.length; f += 1) r[f] <= l && (u = f);
    return u;
  }, c = [];
  for (let l = a.indexOf(n); l >= 0; l = a.indexOf(n, l + n.length)) {
    const u = i(l), f = i(l + n.length - 1);
    c.push([e.items[u].x, s(f)]);
  }
  return c;
}
function Nr({ source: e, page: t, width: n, height: r, fontFamily: o, arrivedAt: a, charRise: s, backgroundPdf: i, findTerm: c, coverWhileLoading: l = !1 }) {
  var S;
  const [u, f] = x(null), m = e.pages.has(t);
  D(() => {
    if (!m) return;
    let b = !0;
    return e.loadPage(t).then((v) => {
      b && f({ source: e, page: t, data: v });
    }), () => {
      b = !1;
    };
  }, [e, t, m]);
  const h = U(() => new Map(e.fonts.flatMap((b) => b.key ? [[b.key, b.family]] : [])), [e]), g = U(() => (b) => e.loadMath(b), [e]);
  if (!m) return null;
  if (!((u == null ? void 0 : u.source) === e && u.page === t)) return l ? /* @__PURE__ */ p("div", { className: "reader-layout-loading", "data-layout-loading": t, "aria-hidden": "true" }) : null;
  const y = u.data;
  if (!y) return null;
  const w = ((S = e.background) == null ? void 0 : S.pageFor(t)) ?? null;
  return /* @__PURE__ */ _(Te, { children: [
    i && w ? /* @__PURE__ */ p(Nn, { pdf: i, page: w, region: Ln, cssWidth: n, className: "reader-layout-background", label: "底图" }) : null,
    /* @__PURE__ */ p(
      Uf,
      {
        page: y,
        width: n,
        height: r,
        fontFamily: o,
        arrivedAt: a,
        charRise: s,
        loadMath: g,
        fontByKey: h,
        findTerm: c
      }
    )
  ] });
}
const _s = rn(null), Ns = rn(null);
function Kf({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(_s.Provider, { value: e, children: /* @__PURE__ */ p(Ns.Provider, { value: t, children: n }) });
}
function je() {
  return ft(_s);
}
function Lr() {
  return ft(Ns);
}
const Ls = 1.414;
function Vf({
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
  regionTargets: m = [],
  hoveredRegionId: h,
  onHoverRegion: g,
  liveTranslationLayout: d,
  liveTranslationPage: y,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var F, q;
  const b = je(), v = b == null ? void 0 : b.revisedBlocks, k = b == null ? void 0 : b.blockEdit, M = k == null ? void 0 : k.pendingEdits, R = b == null ? void 0 : b.editBlock, P = (b == null ? void 0 : b.findTerm) || "", C = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", $ = r === "translated" ? (b == null ? void 0 : b.translatedLayout) ?? null : null, I = !!($ != null && $.source.pages.has(e)), T = b == null ? void 0 : b.textMarks, E = U(
    () => T ? ({ str: O }) => Md(O, T(O), P) : P ? ({ str: O }) => Wt(O, P) : void 0,
    [P, T]
  ), L = A(c ?? Ls), [B, W] = x(L.current);
  D(() => {
    c != null && Math.abs(c - L.current) >= 1e-3 && (L.current = c, W(c));
  }, [c]);
  const j = A(u);
  j.current = u;
  const Q = A(null), ae = A((O) => {
    var J;
    Q.current = O, (J = j.current) == null || J.call(j, O);
  }).current, ne = A(null), fe = A(`${t}@${n}`);
  Ne(() => {
    const O = `${t}@${n}`;
    fe.current !== O && (fe.current = O, o && Jf(Q.current, ne.current));
  }, [o, n, t]), D(() => {
    o || jn(ne.current);
  }, [o]), D(() => () => jn(ne.current), []);
  const se = Math.max(120, Math.floor(t * B)), be = Math.max(se, Math.ceil(s || 0)), me = lt(f, t, se), ue = U(
    () => Kd(m, t, se),
    [se, m, t]
  ), [ge, xe] = x(null), z = typeof g == "function", K = z ? h ?? null : ge, ee = (O) => {
    z ? O !== (h ?? null) && (g == null || g(O)) : xe((J) => J === O ? J : O);
  }, ie = U(
    () => ue.find((O) => O.itemId === K) || null,
    [K, ue]
  ), ce = r === "translated" && ((F = k == null ? void 0 : k.target) == null ? void 0 : F.itemId) || "", te = U(
    () => ce && ue.find((O) => O.itemId === ce) || null,
    [ce, ue]
  ), de = Pf(Q, o ? ie : null, ue, t), ke = (O) => {
    var $e, Ve, ze, Le;
    if (O.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      ee(null);
      return;
    }
    if (O.buttons !== 0) {
      ee(null);
      return;
    }
    if ((Ve = ($e = O.target) == null ? void 0 : $e.closest) != null && Ve.call($e, `.${Ts}`) || (Le = (ze = O.target) == null ? void 0 : ze.closest) != null && Le.call(ze, `.${Ps}`)) return;
    const J = O.currentTarget.getBoundingClientRect(), re = O.clientX - J.left, Ee = O.clientY - J.top;
    if (Tf(de, re, Ee)) return;
    const Pe = xo(ue, re, Ee);
    ee((Pe == null ? void 0 : Pe.itemId) || null);
  }, he = (O) => {
    if (O.pointerType === "mouse") return;
    const J = O.currentTarget.getBoundingClientRect(), re = xo(
      ue,
      O.clientX - J.left,
      O.clientY - J.top
    );
    ee((re == null ? void 0 : re.itemId) || null);
  }, oe = (O) => {
    !Number.isFinite(O) || O <= 0 || Math.abs(L.current - O) < 1e-3 || (L.current = O, W(O), l == null || l(e, O));
  };
  return /* @__PURE__ */ _(
    "div",
    {
      ref: ae,
      [Ie]: e,
      [Se]: r,
      [Er]: se,
      className: Pr,
      onPointerMoveCapture: ke,
      onPointerDown: he,
      onDoubleClick: (O) => {
        const J = b == null ? void 0 : b.zoomBlock;
        !J || b != null && b.pointerTaken || !ie || Ce(ie.highlight.region) === "figure" && (O.preventDefault(), J(ie.itemId));
      },
      onPointerLeave: (O) => {
        O.pointerType === "mouse" && ee(null);
      },
      style: {
        width: t,
        height: be,
        minHeight: be
      },
      children: [
        o ? /* @__PURE__ */ p(
          pl,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a && !I,
            customTextRenderer: E,
            renderAnnotationLayer: !1,
            className: rs,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: In,
                style: { width: t, height: se }
              }
            ),
            onLoadSuccess: (O) => {
              try {
                const J = O.getViewport({ scale: 1 });
                if (J.width > 0) {
                  const re = J.height / J.width;
                  oe(re);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              jn(ne.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: In,
            style: { width: t, height: se },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: ne, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        me ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: me,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          hf,
          {
            layoutPage: d,
            pageState: y,
            width: t,
            height: se
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (M != null && M.size) ? /* @__PURE__ */ p(gf, { targets: ue, edits: M, width: t, excludeId: te == null ? void 0 : te.itemId }) : null,
        o && te && k ? /* @__PURE__ */ p(
          xf,
          {
            target: te,
            page: { width: t, height: se },
            edit: k,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: ue.filter((O) => v.has(O.itemId)).map((O) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": O.itemId,
            style: { left: O.rect.left, top: O.rect.top, height: O.rect.height }
          },
          O.itemId
        )) }) : null,
        o && $ && I ? /* @__PURE__ */ p(
          Nr,
          {
            source: $.source,
            page: e,
            width: t,
            height: se,
            fontFamily: $.fontFamily,
            arrivedAt: 0,
            backgroundPdf: null,
            findTerm: P,
            coverWhileLoading: !0
          }
        ) : null,
        (q = b == null ? void 0 : b.pageLayers) == null ? void 0 : q.map((O) => /* @__PURE__ */ p(xn, { children: O.render({ page: e, width: t, height: se, pane: C, active: o }) }, O.id)),
        /* @__PURE__ */ p(
          nf,
          {
            target: o && !(b != null && b.pointerTaken) && (ie == null ? void 0 : ie.itemId) !== (te == null ? void 0 : te.itemId) ? ie : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: ie && (v == null ? void 0 : v.get(ie.itemId)) || 0,
            onEdit: R,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: de == null ? void 0 : de.rect,
            placement: de == null ? void 0 : de.placement,
            tailTop: de == null ? void 0 : de.tailTop
          }
        )
      ]
    }
  );
}
const qf = nn(Vf);
function Jf(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function jn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Cs = 2 * 1024 * 1024;
function $s(e) {
  const t = new kn.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const Un = 5, Gf = "120% 0px", Xf = 120, Yf = "25% 0px";
let Co = 1;
const $o = /* @__PURE__ */ new WeakMap();
function Zf(e) {
  if (!e) return 0;
  const t = $o.get(e);
  if (t) return t;
  const n = Co;
  return Co += 1, $o.set(e, n), n;
}
function Qf() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const em = Ii(
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
    onOutline: m,
    onDocument: h,
    onLoadError: g,
    onNumPagesChange: d,
    activeRegion: y = null,
    regions: w = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: v,
    liveTranslation: k,
    showLiveTranslation: M = t === "source",
    liveTranslationPendingLabel: R = "",
    paneAction: P
  }, C) {
    ws();
    const { file: $, loading: I, error: T } = Yl(n, r), E = `${n}\0${Zf($)}`, L = A(E);
    L.current = E;
    const B = U(() => {
      const H = Kl($);
      return H ? "ranged" in H ? { range: $s(H.ranged) } : H : null;
    }, [$, n]), [W, j] = x(0), [Q, ae] = x(""), [ne, fe] = x(null), [se, be] = x(480), me = A(null), ue = A(0), ge = U(() => Qf(), []), xe = U(() => ({
      cMapUrl: _t().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: _t().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Cs,
      disableAutoFetch: !0
    }), []);
    vr(C, () => ne, [ne]), D(() => {
      const H = (X) => {
        ue.current = X, be(X);
      }, G = (X) => {
        const ye = $c(X, ue.current);
        if (ye !== "ignore") {
          if (me.current && clearTimeout(me.current), ye === "immediate") {
            H(X);
            return;
          }
          me.current = setTimeout(() => H(X), ls);
        }
      }, Z = !!(c && c >= 80);
      G(Z ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const le = !Z && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var ye, Re;
        G(((Re = (ye = X[0]) == null ? void 0 : ye.contentRect) == null ? void 0 : Re.width) ?? i.clientWidth);
      }) : null;
      return le && i && le.observe(i), () => {
        le == null || le.disconnect(), me.current && clearTimeout(me.current);
      };
    }, [c, i, a]);
    const z = U(
      () => Nc(se, o),
      [se, o]
    ), [K, ee] = x(() => /* @__PURE__ */ new Map()), [ie, ce] = x(() => /* @__PURE__ */ new Set()), [te, de] = x(() => /* @__PURE__ */ new Set()), ke = A(/* @__PURE__ */ new Map()), he = A(null), oe = A(null), [F, q] = x(() => /* @__PURE__ */ new Set()), O = A(/* @__PURE__ */ new Map()), J = N((H, G) => {
      ee((Z) => {
        if (Z.get(H) === G) return Z;
        const V = new Map(Z);
        return V.set(H, G), V;
      });
    }, []), re = N((H, G) => {
      const Z = ke.current, V = Z.get(H), le = [he.current, oe.current];
      if (V)
        for (const X of le)
          try {
            X == null || X.unobserve(V);
          } catch {
          }
      if (G) {
        Z.set(H, G);
        for (const X of le)
          try {
            X == null || X.observe(G);
          } catch {
          }
      } else
        Z.delete(H);
    }, []), Ee = A(/* @__PURE__ */ new Map()), Pe = N((H) => {
      const G = Ee.current;
      let Z = G.get(H);
      return Z || (Z = (V) => re(H, V), G.set(H, Z)), Z;
    }, [re]);
    D(() => {
      if (typeof IntersectionObserver > "u") return;
      const H = O.current, G = new IntersectionObserver(
        (Z) => {
          const V = [], le = [];
          for (const X of Z) {
            const ye = X.target, Re = Pn(ye);
            Number.isFinite(Re) && (X.isIntersecting ? V : le).push(Re);
          }
          if ((V.length || le.length) && ce((X) => {
            let ye = null;
            for (const Re of V)
              X.has(Re) || (ye = ye || new Set(X), ye.add(Re));
            for (const Re of le)
              X.has(Re) && (ye = ye || new Set(X), ye.delete(Re));
            return ye || X;
          }), V.length) {
            for (const X of V) {
              const ye = H.get(X);
              ye && (clearTimeout(ye), H.delete(X));
            }
            de((X) => {
              let ye = null;
              for (const Re of V)
                X.has(Re) || (ye = ye || new Set(X), ye.add(Re));
              return ye || X;
            });
          }
          for (const X of le)
            H.has(X) || H.set(X, setTimeout(() => {
              H.delete(X), de((ye) => {
                if (!ye.has(X)) return ye;
                const Re = new Set(ye);
                return Re.delete(X), Re;
              });
            }, Xf));
        },
        { root: i, rootMargin: Gf, threshold: 0 }
      );
      he.current = G;
      for (const Z of ke.current.values())
        try {
          G.observe(Z);
        } catch {
        }
      return () => {
        G.disconnect(), he.current === G && (he.current = null);
        for (const Z of H.values()) clearTimeout(Z);
        H.clear();
      };
    }, [i]), D(() => {
      if (typeof IntersectionObserver > "u") return;
      const H = new IntersectionObserver(
        (G) => {
          q((Z) => {
            let V = null;
            for (const le of G) {
              const X = Pn(le.target);
              !Number.isFinite(X) || le.isIntersecting === Z.has(X) || (V = V || new Set(Z), le.isIntersecting ? V.add(X) : V.delete(X));
            }
            return V || Z;
          });
        },
        { root: i, rootMargin: Yf, threshold: 0 }
      );
      oe.current = H;
      for (const G of ke.current.values())
        try {
          H.observe(G);
        } catch {
        }
      return () => {
        H.disconnect(), oe.current === H && (oe.current = null);
      };
    }, [i]);
    const $e = !!i && typeof IntersectionObserver < "u";
    Ne(() => {
      j(0), ae(""), ce(/* @__PURE__ */ new Set()), de(/* @__PURE__ */ new Set()), ee(/* @__PURE__ */ new Map()), ke.current.clear();
      const H = O.current;
      for (const G of H.values()) clearTimeout(G);
      H.clear(), d == null || d(0, t);
    }, [E, d, t]);
    const Ve = N(
      (H) => {
        if (L.current !== E) return;
        const G = H.numPages;
        j(G), ae(""), d == null || d(G, t), f == null || f({ numPages: G, pane: t }), h && typeof H.getPage == "function" && h(H, t), m && typeof H.getOutline == "function" && hd(H).then((Z) => {
          L.current === E && m(Z, t);
        }, () => {
        });
      },
      [E, f, m, h, d, t]
    ), ze = N(
      (H) => {
        if (L.current !== E) return;
        const G = (H == null ? void 0 : H.message) || "PDF 解析失败";
        ae(G), j(0), d == null || d(0, t), g == null || g(H, t);
      },
      [E, g, d, t]
    ), Le = U(
      () => W > 0 ? Array.from({ length: W }, (H, G) => G + 1) : [],
      [W]
    );
    D(() => {
      typeof IntersectionObserver < "u" || de(new Set(Le));
    }, [Le]);
    const Fe = U(
      () => mt(y, S, t),
      [y, S, t]
    ), Be = U(() => {
      const H = /* @__PURE__ */ new Map();
      for (const G of w) {
        const Z = mt(G, S, t);
        if (!Z) continue;
        const V = H.get(Z.box.page) || [];
        V.push(Z), H.set(Z.box.page, V);
      }
      return H;
    }, [t, S, w]), et = U(() => {
      const H = /* @__PURE__ */ new Set();
      if (!b) return H;
      for (const [G, Z] of Be)
        Z.some((V) => V.itemId === b) && H.add(G);
      return H;
    }, [b, Be]), ct = U(() => {
      if (W === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Le);
      if (ie.size === 0) {
        const Z = Math.min(W, Un * 2 + 1);
        return new Set(Array.from({ length: Z }, (V, le) => le + 1));
      }
      const G = /* @__PURE__ */ new Set();
      for (const Z of ie)
        for (let V = -Un; V <= Un; V++) {
          const le = Z + V;
          le >= 1 && le <= W && G.add(le);
        }
      return G;
    }, [W, Le, i, a, ie]), St = !n || !!T || !!Q, tt = n && (T || Q) || s;
    return /* @__PURE__ */ _(
      "section",
      {
        ref: fe,
        className: `reader-panel ${on}${a ? "" : " is-hidden"}`,
        [Se]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          P ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: P }) : null,
          R ? /* @__PURE__ */ _("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: R })
          ] }) : null,
          St && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: tt }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          B && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            gl,
            {
              file: B,
              loading: null,
              error: null,
              options: xe,
              onLoadSuccess: Ve,
              onLoadError: ze,
              className: "reader-react-pdf-document",
              children: Le.map((H) => {
                if (ct.has(H))
                  return /* @__PURE__ */ p(
                    qf,
                    {
                      pane: t,
                      pageNumber: H,
                      width: z,
                      devicePixelRatio: ge,
                      active: te.has(H),
                      textLayer: !$e || F.has(H),
                      syncedMinHeight: (l == null ? void 0 : l.get(H)) || 0,
                      onMetrics: u,
                      cachedAspect: K.get(H),
                      onAspectChange: J,
                      sentinelRef: Pe(H),
                      regionHighlight: (Fe == null ? void 0 : Fe.box.page) === H ? Fe : null,
                      regionTargets: Be.get(H),
                      hoveredRegionId: b && et.has(H) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(H - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(H - 1),
                      showLiveTranslation: M,
                      liveTranslationMissing: zu(k, H - 1)
                    },
                    `${t}-${H}`
                  );
                const Z = K.get(H) ?? Ls, V = Math.max(120, Math.floor(z * Z)), le = Math.max(V, Math.ceil((l == null ? void 0 : l.get(H)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Pe(H),
                    [Ie]: H,
                    [Se]: t,
                    [Er]: V,
                    className: `${Pr} is-placeholder`,
                    style: {
                      width: z,
                      height: le,
                      minHeight: le
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: In,
                        style: { width: z, height: V },
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
), Do = nn(em), tm = 2e3, nm = 6, rm = 500, Oo = "reader-react-resizing";
function om(e, t) {
  const n = A(null), r = A(null);
  Ne(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = am(e), k = Jt(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, m = e.scrollHeight, h = m, g = 0, d = l;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const M of v) {
        const R = Math.round(M.contentRect.height);
        y.has(M.target) && y.get(M.target) !== R && (k = !0), y.set(M.target, R);
      }
      k && Nt(e, c, "auto", i);
    }), S = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(Oo);
      for (const k of zo) e.removeEventListener(k, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, b = () => {
      Nt(e, c, "auto", i);
      const v = e.scrollHeight;
      g = v === h ? g + 1 : 0, h = v;
      const k = performance.now() - d;
      g >= nm && (v !== m || k > rm) || k > tm ? S() : u = requestAnimationFrame(b);
    };
    for (const v of zo) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(Oo), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, d = performance.now(), m = e.scrollHeight, h = m, g = 0, u = requestAnimationFrame(b);
    }, ls);
  }, [e, t]), D(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function am(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ie}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Se) || null;
  }
  return null;
}
const zo = ["wheel", "touchstart", "keydown", "pointerdown"];
function sm(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function im(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(on)) && ((n = e.hasAttribute) != null && n.call(e, Se)));
}
function lm(e, t) {
  D(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!im(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${on}[${Se}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = sm(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function cm(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function um(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Fo = 12;
function Cr(e) {
  return Array.from(e.querySelectorAll(`.${on}[${Se}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function dm(e) {
  const t = e.getBoundingClientRect();
  return Cr(e).map((n) => {
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
function fm(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function mm(e, t) {
  return e ? Cr(e).find((n) => n.getAttribute(Se) === t) ?? null : null;
}
function hm({ shellEl: e }) {
  const [t, n] = x([]), r = A(0), o = N(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = dm(e);
      n((i) => fm(i, s) ? i : s);
    }));
  }, [e]);
  D(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, c = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of Cr(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(pm, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function pm({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Fo * 2), r = cm(e, n), o = A(null);
  if (!r) return null;
  const a = (m) => {
    const h = mm(t, e.pane);
    h && (h.scrollLeft = m);
  }, s = (m) => {
    var h, g;
    m.button === 0 && (m.preventDefault(), m.stopPropagation(), (g = (h = m.currentTarget).setPointerCapture) == null || g.call(h, m.pointerId), o.current = { startX: m.clientX, startScroll: e.scrollLeft, pointerId: m.pointerId });
  }, i = (m) => {
    const h = o.current;
    !h || h.pointerId !== m.pointerId || a(h.startScroll + um(e, n, r.size, m.clientX - h.startX));
  }, c = (m) => {
    var h, g, d;
    ((h = o.current) == null ? void 0 : h.pointerId) === m.pointerId && (o.current = null, (d = (g = m.currentTarget).releasePointerCapture) == null || d.call(g, m.pointerId));
  }, l = (m) => {
    if (m.button !== 0 || m.target !== m.currentTarget) return;
    m.preventDefault();
    const h = m.currentTarget.getBoundingClientRect(), g = m.clientX - h.left, d = e.width * 0.8;
    a(e.scrollLeft + (g < r.offset ? -d : d));
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
      style: { left: e.left + Fo, width: n },
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
function Ds(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function gm(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function ym({ compare: e, onDone: t }) {
  return /* @__PURE__ */ _("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
        Y,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Ds(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(wr, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Wi, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ _("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ _(
        Y,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Fa, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ _(
        Y,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Ki, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Bo({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = gm(t), a = [e === "compare" ? "对比" : "正在读", r, Ds(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ _("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function bm({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = x({ source: null, translated: null });
  return Ne(() => {
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
  }, [e]), /* @__PURE__ */ _("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(Bo, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(Bo, { role: "reading", ...n }) }) : null
  ] });
}
const vm = () => () => {
}, Ho = () => null;
function wm({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Sm(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function km(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Tm(e) {
  const t = je(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), m = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? an, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, d = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = (t == null ? void 0 : t.translatedLayout) ?? null, M = k ? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "" : e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, P = k ? e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null : e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, C = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), $ = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), I = t == null ? void 0 : t.onPdfOutline, T = t == null ? void 0 : t.onPdfDocument, E = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), L = e.regions ?? (t == null ? void 0 : t.regions) ?? [], B = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), W = (t == null ? void 0 : t.regionHover) ?? null, [j, Q] = x(null), ae = An(
    W ? W.subscribe : vm,
    W ? () => W.get().itemId : Ho,
    W ? () => W.get().itemId : Ho
  ), ne = W ? ae : j, fe = N((ue) => {
    W ? W.set(ue, "pdf") : Q(ue);
  }, [W]), se = wm({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), me = Number.isFinite(g) && g > 0 ? Sm(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !se.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return om(m, me), lm(m, se.compareMode), /* @__PURE__ */ _(
    "div",
    {
      ref: f,
      className: ns,
      "data-reader-region-count": L.length,
      "data-reader-structured-region-count": L.filter(Di).length,
      "data-reader-metadata-ready": B ? "true" : "false",
      children: [
        /* @__PURE__ */ _(
          "main",
          {
            className: `${ts} reader-mode-${se.mode}`,
            "data-reader-mode": se.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Do,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: R,
                  userZoom: h,
                  visible: se.showSource,
                  scrollRoot: m,
                  pageWidthOverride: me,
                  rowHeights: se.compareMode ? d : void 0,
                  onMetrics: C,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: $,
                  onOutline: b ? void 0 : I,
                  onDocument: b ? void 0 : T,
                  activeRegion: E,
                  regions: (b == null ? void 0 : b.regions) ?? L,
                  readerMetadata: B,
                  hoveredRegionId: ne,
                  onHoverRegion: fe,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? km(o) : "",
                  paneAction: u && se.showTranslated ? /* @__PURE__ */ _(Te, { children: [
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
                Do,
                {
                  pane: "translated",
                  url: M,
                  preloadedFile: P,
                  userZoom: h,
                  visible: se.showTranslated,
                  scrollRoot: m,
                  pageWidthOverride: me,
                  rowHeights: se.compareMode ? d : void 0,
                  onMetrics: C,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: $,
                  onOutline: k ? void 0 : I,
                  onDocument: k ? void 0 : T,
                  activeRegion: E,
                  regions: L,
                  readerMetadata: B,
                  hoveredRegionId: ne,
                  onHoverRegion: fe,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                },
                k ? "translated-html" : "translated"
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(hm, { shellEl: m }),
        b ? /* @__PURE__ */ p(bm, { shellEl: m, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Im = 72, fn = 1500, Em = 2e3, Pm = 1200;
function Rm(e, t) {
  return e - t < Im;
}
function Mm(e) {
  try {
    return e.matches(":focus-visible");
  } catch {
    return !1;
  }
}
function xm(e, t) {
  const [n, r] = x(!0), o = A(null), a = A(!1), s = A(!1), i = N(() => {
    o.current !== null && (window.clearTimeout(o.current), o.current = null);
  }, []), c = N((u) => {
    i(), o.current = window.setTimeout(() => {
      o.current = null, s.current || r(!1);
    }, u);
  }, [i]);
  D(() => {
    var v;
    const u = (v = e.current) == null ? void 0 : v.parentElement;
    if (!u) return;
    let f = u.getBoundingClientRect().top;
    const m = () => {
      f = u.getBoundingClientRect().top;
    }, h = (k) => {
      k.pointerType !== "touch" && (Rm(k.clientY, f) ? a.current || (a.current = !0, i(), r(!0)) : a.current && (a.current = !1, c(fn)));
    }, g = () => {
      a.current && (a.current = !1, c(fn));
    }, d = (k) => {
      s.current = k.target instanceof Element && Mm(k.target), s.current && (i(), r(!0));
    }, y = (k) => {
      var P;
      const M = k.relatedTarget;
      if (M instanceof Node && ((P = e.current) != null && P.contains(M))) return;
      const R = s.current;
      s.current = !1, R && !a.current && c(fn);
    }, w = () => {
      a.current || (r(!0), c(fn));
    }, S = () => {
      s.current = !1;
    }, b = e.current;
    return c(Em), b == null || b.addEventListener("focusin", d), b == null || b.addEventListener("focusout", y), b == null || b.addEventListener("pointerdown", S), u.addEventListener("scroll", w, { capture: !0, passive: !0 }), u.addEventListener("pointerenter", m), u.addEventListener("pointermove", h, { passive: !0 }), u.addEventListener("pointerleave", g), window.addEventListener("resize", m), () => {
      i(), b == null || b.removeEventListener("focusin", d), b == null || b.removeEventListener("focusout", y), b == null || b.removeEventListener("pointerdown", S), u.removeEventListener("scroll", w, { capture: !0 }), u.removeEventListener("pointerenter", m), u.removeEventListener("pointermove", h), u.removeEventListener("pointerleave", g), window.removeEventListener("resize", m);
    };
  }, [e, i, c]);
  const l = A(t);
  return D(() => {
    l.current !== t && (l.current = t, !a.current && (r(!0), c(Pm)));
  }, [t, c]), n;
}
const Am = [
  { id: "source", label: "原文", Icon: Ba },
  { id: "compare", label: "对照", Icon: Ha },
  { id: "translated", label: "译文", Icon: ja }
];
function _m(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Nm(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Lm(e) {
  const t = je(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? _m(a.state) : "", l = A(null), u = xm(l, n);
  return (
    // 浮在书页区顶上（2026-11-28 用户：「顶部的 bar 不要保留了，用悬浮的方式……更有沉浸感」）：
    // 这一层本身透明、不接点击，只有左上的胶囊和正中的页签接；左右两段同宽，页签在书页区正中。
    // 读的时候藏着，鼠标到书页区顶上才出来（use-topbar-reveal.ts；不藏的几种在 chrome.css）。
    /* @__PURE__ */ _("header", { className: "reader-workspace-bar", ref: l, "data-revealed": u ? "true" : "false", children: [
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
      e.start ? /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }) : null,
      /* @__PURE__ */ _("div", { className: "reader-workspace-center", children: [
        /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Am.map(({ id: f, label: m, Icon: h }) => {
          const g = n === f, d = Nm({
            id: f,
            documentReady: r,
            sourceViewOnly: i,
            liveTranslationAvailable: !!a
          });
          return /* @__PURE__ */ _(xn, { children: [
            /* @__PURE__ */ p(
              "button",
              {
                type: "button",
                className: `reader-workspace-tab${g ? " is-active" : ""}`,
                role: "tab",
                "aria-selected": g,
                "aria-label": m,
                title: d ? `${m} 需要文档任务` : m,
                disabled: d,
                onClick: () => o(f),
                children: /* @__PURE__ */ p(h, { ...Me, "aria-hidden": !0 })
              }
            ),
            f === "compare" ? e.compareExtra : null
          ] }, f);
        }) }),
        a ? /* @__PURE__ */ _("div", { className: "reader-live-strip", children: [
          /* @__PURE__ */ _(
            "button",
            {
              type: "button",
              className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
              "aria-pressed": a.visible,
              "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
              title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
              onClick: a.onToggle,
              children: [
                /* @__PURE__ */ p(Vi, { ...Me, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
              ]
            }
          ),
          a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ _(
            Y,
            {
              className: "reader-live-translation-toggle reader-live-jump",
              "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
              title: `跳到最新译好的第 ${a.latestPage} 页`,
              onClick: a.onJumpToLatest,
              children: [
                /* @__PURE__ */ p(qi, { ...Me, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
              ]
            }
          ) : null
        ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ _(
          Y,
          {
            className: "reader-live-translation-toggle is-done",
            title: "翻译完成，左右对照看最终译文",
            onClick: s.onOpenCompare,
            children: [
              /* @__PURE__ */ p(Ji, { ...Me, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
            ]
          }
        ) }) : null
      ] }),
      /* @__PURE__ */ p("span", { className: "reader-workspace-end", "aria-hidden": "true" })
    ] })
  );
}
const Os = [];
function Cm() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = Os;
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
function jo(e, t) {
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
function $m(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function Dm(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Om(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function zm(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function Fm(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function Bm(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function Hm(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const Cn = rn(null), zs = rn(null);
function jm({ api: e, store: t, children: n }) {
  const r = U(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(Cn.Provider, { value: r, children: n });
}
function $t() {
  const e = ft(Cn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const Um = () => () => {
}, Uo = () => Os;
function Wm(e) {
  return An(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Fs() {
  var t;
  const e = (t = ft(Cn)) == null ? void 0 : t.store;
  return An((e == null ? void 0 : e.subscribe) ?? Um, (e == null ? void 0 : e.getSnapshot) ?? Uo, (e == null ? void 0 : e.getSnapshot) ?? Uo);
}
function sn(e) {
  var a;
  const t = (a = ft(Cn)) == null ? void 0 : a.store, n = ft(zs);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  D(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), D(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class Km extends Ei {
  constructor() {
    super(...arguments);
    to(this, "state", { failed: !1 });
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
const Vm = nn(function({ extensions: t }) {
  return /* @__PURE__ */ p(Te, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(Km, { id: n, children: /* @__PURE__ */ p(qm, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function qm({ id: e, title: t, children: n }) {
  const r = U(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(zs.Provider, { value: r, children: n });
}
function Jm({
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
      Y,
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
const Gm = /[\u{1D400}-\u{1D7FF}ﬀ-ﬆ]/gu, Wo = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/u;
function Xm(e) {
  let t = `${e || ""}`.replace(/\r\n?/g, `
`).replace(/­/g, "");
  return t.trim() ? (t = t.replace(Gm, (r) => r.normalize("NFKC")), t = t.normalize("NFC"), t.includes("̸") && (t = t.replace(/(\S)?̸[ \t]*(\S)/gu, (r, o, a) => `${o ? `${o} ` : ""}${a}̸`).normalize("NFC")), t.split(/\n[ \t]*\n+/).map((r) => Ym(r.split(`
`))).filter(Boolean).join(`
`).trim()) : "";
}
function Ym(e) {
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
    t += Wo.test(o) || Wo.test(a) ? r : ` ${r}`;
  }
  return t;
}
const Zm = /[\u{1D400}-\u{1D7FF}Ͱ-Ͽ℀-⅏←-⋿⨀-⫿⟀-⟯⦀-⧿⁰-₟̀-ͯ√±×÷]/u;
function Ko(e) {
  return Zm.test(e);
}
function Qm(e) {
  const t = `${e || ""}`;
  return t.trim() ? [...t.trim()].length > 6 ? !1 : !new RegExp("\\p{Ll}{3,}", "u").test(t) : !0;
}
function eh(e, t) {
  const n = e[t];
  if (!n) return null;
  const r = (i) => {
    const c = e[i];
    return !!c && c.line === n.line && (Ko(c.text) || Qm(c.text));
  };
  if (!r(t)) return null;
  let o = t, a = t;
  for (; r(o - 1); ) o -= 1;
  for (; r(a + 1); ) a += 1;
  let s = !1;
  for (let i = o; i <= a; i += 1) Ko(e[i].text) && (s = !0);
  if (!s) return null;
  for (; o < a && !e[o].text.trim(); ) o += 1;
  for (; a > o && !e[a].text.trim(); ) a -= 1;
  return [o, a];
}
function th(e) {
  const t = e.filter((a) => a.right - a.left > 0.5 && a.bottom - a.top > 0.5);
  if (!t.length) return [];
  const n = [...t].sort((a, s) => (a.top + a.bottom) / 2 - (s.top + s.bottom) / 2), r = [];
  for (const a of n) {
    const s = r.at(-1), i = s ? Vo(s) : null;
    i && nh(i, a) >= 0.5 * Math.min(i.bottom - i.top, a.bottom - a.top) ? s.push(a) : r.push([a]);
  }
  const o = [];
  for (const a of r) {
    const s = Vo(a), i = s.bottom - s.top, c = [...a].sort((u, f) => u.left - f.left);
    let l = null;
    for (const u of c)
      l && u.left - l.right <= i * 2 ? l.right = Math.max(l.right, u.right) : (l && o.push(l), l = { left: u.left, top: s.top, right: u.right, bottom: s.bottom });
    l && o.push(l);
  }
  return o;
}
function Vo(e) {
  const t = Math.max(...e.map((r) => r.bottom - r.top)), n = e.filter((r) => r.bottom - r.top >= t * 0.75);
  return { top: Math.min(...n.map((r) => r.top)), bottom: Math.max(...n.map((r) => r.bottom)) };
}
function nh(e, t) {
  return Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top);
}
const ar = ".textLayer, .reader-layout-page, .reader-html-page", mn = ".reader-layout-page", qo = "svg.reader-layout-math";
function sr(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function rh(e) {
  var t, n;
  return ((t = sr(e.startContainer)) == null ? void 0 : t.closest(ar)) ?? ((n = sr(e.endContainer)) == null ? void 0 : n.closest(ar)) ?? null;
}
const oh = /[\p{Script=Latin}\p{N})\].,;:!?%]$/u, ah = /^[\p{Script=Latin}\p{N}(\[$]/u;
function sh(e, t) {
  var s, i, c;
  let n = "", r = null, o = null, a = Number.NaN;
  for (const l of t.querySelectorAll(`text, ${qo}`)) {
    if (!e.intersectsNode(l)) continue;
    let u, f = Number(l.getAttribute("x")), m, h;
    if (l.matches(qo))
      u = `$${l.getAttribute("data-tex") || ""}$`, h = l.getAttribute("data-baseline"), m = f + Number(l.getAttribute("width") || 0);
    else {
      const d = l.textContent || "", y = l.firstChild;
      let w = 0, S = d.length;
      y && y === e.startContainer && (w = e.startOffset), y && y === e.endContainer && (S = e.endOffset), u = d.slice(w, S), h = l.getAttribute("y");
      let b = 0;
      try {
        b = ((s = l.getComputedTextLength) == null ? void 0 : s.call(l)) || 0;
      } catch {
        b = 0;
      }
      m = f + b, w > 0 && (f = Number.NaN);
    }
    if (!u) continue;
    const g = ((i = l.closest("[data-html-block]")) == null ? void 0 : i.getAttribute("data-html-block")) ?? null;
    if (o !== null && g !== o) n += `

`;
    else if (r !== null && h !== r) n += `
`;
    else if (n && Number.isFinite(a) && Number.isFinite(f)) {
      const d = Number((c = l.closest("[font-size]")) == null ? void 0 : c.getAttribute("font-size")) || 10;
      f - a > d * 0.2 && oh.test(n) && ah.test(u) && (n += " ");
    }
    n += u, r = h, o = g, a = m;
  }
  return n;
}
function ih(e) {
  if (!e.rangeCount) return "";
  const t = e.getRangeAt(0), n = sr(t.commonAncestorContainer), r = (n == null ? void 0 : n.closest(mn)) ?? (n != null && n.querySelector(mn) ? n : null);
  if (r) {
    const o = r.matches(mn) ? [r] : [...r.querySelectorAll(mn)].filter((a) => t.intersectsNode(a));
    if (o.length) return o.map((a) => sh(t, a)).filter(Boolean).join(`

`);
  }
  return `${e}`;
}
function Bs(e) {
  return Xm(ih(e));
}
const lh = 4e3;
function ch(e, t, n) {
  if (e.length) {
    const o = pd(e, n), a = o ? vs(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function Jo(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ie}]`)) ?? null;
  return r ? { text: Bs(e).slice(0, lh), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function uh(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = mt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = lt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, m = u + f * 0.25;
    (m < s || m === 0 && a === null) && (a = i, s = m);
  }
  return a;
}
function dh({
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
  const c = Number(e.getAttribute(Ie)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(Se) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, h = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? uh(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (h == null ? void 0 : h.itemId) ?? null,
    selection: o,
    sourceText: `${(h == null ? void 0 : h.source.text) || (h == null ? void 0 : h.markdown) || ""}`.trim(),
    translatedText: `${(h == null ? void 0 : h.translatedBlockText) || (h == null ? void 0 : h.translated.text) || ""}`.trim(),
    section: ch(s, a, (h == null ? void 0 : h.source.page) ?? c),
    point: f
  };
}
function fh(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Ie}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Ie)) || 0, i = (o.closest(`[${Se}]`) ?? o).getAttribute(Se) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function mh({ onDone: e, onCancel: t }) {
  const [n, r] = x(null), o = A(null), a = A(null);
  D(() => {
    const c = (l) => {
      l.key === "Escape" && (l.preventDefault(), l.stopImmediatePropagation(), t());
    };
    return window.addEventListener("keydown", c, !0), () => window.removeEventListener("keydown", c, !0);
  }, [t]);
  const s = (c, l) => {
    const u = a.current;
    u && (u.style.pointerEvents = "none");
    try {
      return fh(c, l);
    } finally {
      u && (u.style.pointerEvents = "");
    }
  }, i = n ? { left: Math.min(n.from.x, n.to.x), top: Math.min(n.from.y, n.to.y), width: Math.abs(n.to.x - n.from.x), height: Math.abs(n.to.y - n.from.y) } : null;
  return /* @__PURE__ */ _(
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
const Go = 5e4, hh = 2e4;
function Wn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Jb(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function ph(e, t = null) {
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
function gh(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function yh(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function Gb(e, t) {
  var r;
  const n = yh(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Xb(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function bh(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? vh(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function vh(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function wh(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = bh(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: gh(o.selection, n),
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
function Sh(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Wn(e.question.text, Go), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Wn(e.answer.text, Go),
      thought: e.answer.thought ? Wn(e.answer.thought, hh) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function kh(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Th(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Ih(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Eh(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Ph = 50, Kn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Rh() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function Xo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Mh({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = x(!1), [i, c] = x(Kn), [l, u] = x(!1), [f, m] = x(""), [h, g] = x("idle"), [d, y] = x(null), [w, S] = x([]), b = N((z) => {
    y(z), S([]);
  }, []), v = N((z) => S((K) => [...K, z].slice(-2)), []), [k, M] = x(() => /* @__PURE__ */ new Map()), R = A(/* @__PURE__ */ new Set()), P = A(/* @__PURE__ */ new Map()), C = (z) => {
    if (!z) return null;
    const K = P.current.get(z);
    return K || ($.current.records.some((ee) => ee.message_id === z) ? z : null);
  }, $ = A(i);
  $.current = i;
  const I = A(t);
  I.current = t;
  const T = A(0), E = N(async (z, K, ee, ie = []) => {
    if (!r) return;
    const ce = await r.messages(z.conversation_id, { limit: Ph, ...ee ? { beforeSeq: ee } : {} }), te = [...ce.messages, ...ie];
    T.current += 1, c({
      conversation: z,
      main: K ?? z,
      records: te,
      compactions: ce.compactions || [],
      hasMore: ce.has_more,
      key: `${z.conversation_id}:${T.current}`,
      initial: wh(te, ce.compactions || [], I.current.documentId)
    });
  }, [r]), L = N(async () => {
    s(!0);
    const z = $.current.conversation;
    if (!(!r || (z == null ? void 0 : z.kind) === "main" && z.status !== "archived")) {
      u(!0), m("");
      try {
        const K = await r.main(I.current.documentId || void 0);
        await E(K, K);
      } catch (K) {
        m(K instanceof Error ? K.message : String(K));
      } finally {
        u(!1);
      }
    }
  }, [r, E]), B = N((z) => {
    b(z), L();
  }, [L]), W = A(t.documentId);
  D(() => {
    W.current !== t.documentId && (W.current = t.documentId, $.current = Kn, c(Kn), b(null), M(/* @__PURE__ */ new Map()), P.current.clear(), a && L());
  }, [t.documentId, a, L]);
  const j = N(async () => {
    const z = $.current, K = z.records[0];
    if (!(!z.conversation || !K || !z.hasMore)) {
      u(!0);
      try {
        await E(z.conversation, z.main, K.seq, z.records);
      } finally {
        u(!1);
      }
    }
  }, [E]), Q = N(async (z) => {
    const ee = $.current.conversation;
    if (!r || !ee) return;
    for (const he of z.memoryIds) R.current.add(he);
    let ie = z.memoryIds;
    if (!ie.length && o && z.startedAt) {
      const he = Th(
        await o.list({ source_conversation_id: ee.conversation_id, created_after: kh(z.startedAt) }).catch(() => []),
        R.current
      );
      for (const F of he) R.current.add(F.id);
      ie = he.map((F) => F.id);
      const oe = z.answerId;
      he.length && oe && M((F) => new Map(F).set(oe, he));
    }
    const ce = Sh({ ...z, memoryIds: ie }, I.current.documentId, Rh(), C(z.editedFrom));
    let te;
    try {
      te = await r.append(ee.conversation_id, ce);
    } catch (he) {
      if (ee.kind !== "side" || !/ask_conversation_not_open/.test(Xo(he))) throw he;
      await r.reopen(ee.conversation_id), te = await r.append(ee.conversation_id, ce);
    }
    const [de, ke] = te.messages;
    z.questionId && de && P.current.set(z.questionId, de.message_id), z.answerId && ke && P.current.set(z.answerId, ke.message_id), c((he) => {
      var oe;
      return ((oe = he.conversation) == null ? void 0 : oe.conversation_id) === ee.conversation_id ? { ...he, conversation: te.conversation, records: [...he.records, ...te.messages] } : he;
    }), n == null || n(te.messages), te.compaction_due && ee.kind === "main" && r.compact(ee.conversation_id).catch(() => {
    });
  }, [r, o, n]), ae = N(async (z) => {
    const K = $.current.conversation, ee = C(z);
    if (!r || !K || !ee) return null;
    try {
      await r.supersede(K.conversation_id, ee);
    } catch (te) {
      if (!/ask_message_superseded/.test(Xo(te))) throw te;
    }
    const ie = $.current.records.find((te) => te.message_id === ee), ce = $.current.records.findIndex((te) => te.message_id === ee);
    return c((te) => ({ ...te, records: te.records.map((de, ke) => ke >= ce && ce >= 0 && !de.superseded_at ? { ...de, superseded_at: "now" } : de) })), (ie == null ? void 0 : ie.selection) ?? null;
  }, [r]), ne = N((z) => {
    Q(z).catch((K) => m(`这一轮没存上：${K instanceof Error ? K.message : String(K)}`));
  }, [Q]), fe = N(async (z) => {
    var ie;
    const K = $.current, ee = K.main;
    if (!(!r || !ee || ((ie = K.conversation) == null ? void 0 : ie.kind) !== "main")) {
      m("");
      try {
        const ce = Ih(K.records, z), te = await r.fork({
          parent_id: ee.conversation_id,
          ...ce ? { forked_from_message_id: ce } : {},
          title: Eh(z.text),
          ...I.current.documentId ? { document_id: I.current.documentId } : {}
        });
        await E(te, ee);
      } catch (ce) {
        m(`开不了副对话：${ce instanceof Error ? ce.message : String(ce)}`);
      }
    }
  }, [r, E]), se = N(async (z) => {
    const K = $.current.main;
    if (r)
      try {
        await E(await r.get(z), K);
      } catch (ee) {
        m(`打不开副对话：${ee instanceof Error ? ee.message : String(ee)}`);
      }
  }, [r, E]), be = N(async () => {
    const z = $.current.main;
    z && await E(z, z).catch(() => {
    });
  }, [E]), me = N(async () => {
    const z = $.current.conversation;
    if (!(!r || (z == null ? void 0 : z.kind) !== "side")) {
      g("busy");
      try {
        await r.close(z.conversation_id), g("idle"), await be();
      } catch {
        g("failed");
      }
    }
  }, [r, be]), ue = N(async () => r != null && r.archived ? r.archived(I.current.documentId) : [], [r]), ge = N(async (z) => {
    m(""), b(null);
    try {
      await E(z, $.current.main);
    } catch (K) {
      m(`打不开这个对话：${K instanceof Error ? K.message : String(K)}`);
    }
  }, [E, b]), xe = N(async () => {
    const z = $.current.main;
    if (!r || !z) return;
    await r.archive(z.conversation_id);
    const K = await r.main(I.current.documentId || void 0);
    await E(K, K);
  }, [r, E]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: f,
    pending: d,
    setPending: b,
    extras: w,
    addExtra: v,
    closingSide: h,
    notices: k,
    persistent: !!r,
    openMain: L,
    ask: B,
    close: N(() => s(!1), []),
    loadEarlier: j,
    onTurn: ne,
    rewrite: ae,
    fork: fe,
    openSide: se,
    backToMain: be,
    closeSide: me,
    archiveMain: xe,
    listArchived: ue,
    viewArchived: ge,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function Yo(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = ph({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function xh({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = x([]), s = A(0), i = A(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  D(() => {
    var h, g;
    if (a([]), !e || !t) return;
    let f = !1;
    const m = (d) => {
      !f && d.length && a((y) => [...y, ...d]);
    };
    return (h = e.threads) == null || h.list(t).then(
      (d) => m(d.map((y) => ({ key: c(), anchor: y.anchor, threadId: y.threadId, title: y.title }))),
      () => {
      }
    ), (g = e.conversations) == null || g.bookMessages(t).then(
      (d) => m(d.map((y) => Yo(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = N((f) => {
    const m = f.filter((h) => !h.document_id || h.document_id === t).map((h) => Yo(h, c(), i.current)).filter((h) => !!h);
    m.length && a((h) => [...h.filter((g) => !m.some((d) => d.messageId === g.messageId)), ...m]);
  }, [t]), u = N((f) => a((m) => m.filter((h) => h.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Ah = Ca(() => import("./ReaderAskPanel-B6SmpJA3.js"));
function _h({
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
  jumpToBlock: m,
  pdfDocuments: h,
  currentPage: g,
  visibleMode: d,
  activePanel: y = null,
  panelHost: w = null
}) {
  const S = U(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), b = N((F, q, O) => {
    const J = F ? o.find((Pe) => Pe.itemId === F) : null, re = J ? mt(J, a, q) : null, Ee = re && re.box.page === O ? lt(re, 1, 1) : null;
    return Ee ? { x: Ee.left, y: Ee.top } : null;
  }, [o, a]), v = xh({ port: e, documentId: t, resetKey: c, pointOf: b }), k = Mh({ port: e, book: S, onAppended: v.addRecords }), [M, R] = x(null), P = N(
    (F, q, O, J) => dh({
      pageElement: (F == null ? void 0 : F.closest(`[${Ie}]`)) ?? null,
      clientX: q,
      clientY: O,
      itemId: i(),
      selection: J,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), C = N(() => {
    var q;
    const F = Jo(((q = globalThis.getSelection) == null ? void 0 : q.call(globalThis)) ?? null);
    return !F.text || !F.element || !F.rect ? null : P(F.element, F.rect.left + F.rect.width / 2, F.rect.top + F.rect.height / 2, F.text);
  }, [P]), $ = N((F) => {
    R(null), k.ask(F);
  }, [k.ask]);
  D(() => {
    if (!e) return;
    const F = (q) => {
      var re;
      if (q.key !== "?" || q.metaKey || q.ctrlKey || q.altKey || q.defaultPrevented) return;
      const O = q.target;
      if ((re = O == null ? void 0 : O.closest) != null && re.call(O, "input, textarea, select, [contenteditable='true']")) return;
      const J = C();
      J && (q.preventDefault(), q.stopImmediatePropagation(), $(J));
    };
    return window.addEventListener("keydown", F, !0), () => window.removeEventListener("keydown", F, !0);
  }, [e, C, $]);
  const I = A(h);
  I.current = h;
  const T = N(async ({ page: F, pane: q, region: O, canvas: J }) => {
    const re = I.current[q];
    let Ee;
    if (re)
      Ee = await Nf(re, F, O);
    else {
      const Pe = J ?? document.querySelector(`[${Se}="${q}"] [${Ie}="${F}"] canvas`);
      if (!Pe) throw new Error(`第 ${F} 页还没画出来，翻到那一页再试`);
      Ee = await Lf(Pe, O);
    }
    return new File([Ee], Cf(F, O), { type: "image/png" });
  }, []), [E, L] = x(null), B = A(k.pending);
  B.current = k.pending;
  const W = U(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(Gi, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const F = B.current, q = (F == null ? void 0 : F.pane) || (d === "translated" ? "translated" : "source");
      return T({ page: (F == null ? void 0 : F.page) || g() || 1, pane: q, region: Ln });
    }
  }], [T, g, d]), [j, Q] = x(!1), [ae, ne] = x(""), fe = N(async (F) => {
    Q(!1), ne("");
    try {
      const q = await T(F), O = P(F.point.target, F.point.x, F.point.y, "");
      L((J) => ({ id: ((J == null ? void 0 : J.id) || 0) + 1, files: [q] })), O ? $({ ...O, itemId: null, sourceText: "", translatedText: "" }) : k.openMain();
    } catch (q) {
      ne(q instanceof Error ? q.message : String(q));
    }
  }, [T, P, $]), se = N(() => Q(!1), []), be = N(() => {
    ne(""), Q((F) => !F);
  }, []), me = N(async (F) => {
    if (F.threadId && (e != null && e.threads) && t) {
      try {
        const q = await e.threads.get(t, F.threadId);
        R({ anchor: q.anchor || F.anchor, messages: q.messages || [], mark: F });
      } catch {
        R({ anchor: F.anchor, messages: [], mark: F });
      }
      return;
    }
    R(null), k.openMain();
  }, [e, t, k.openMain]), ue = N((F) => {
    var J;
    if (!e) return [];
    const q = Jo(((J = globalThis.getSelection) == null ? void 0 : J.call(globalThis)) ?? null), O = P(F.target, F.clientX, F.clientY, q.element ? q.text : "");
    return O ? [{
      key: "ask",
      label: O.selection ? "问这段" : "在这里提问",
      hint: O.selection ? "?" : void 0,
      // 选着字时也出现在选字浮条上（「复制 · 收藏 · 提问」，ReaderSelectionLayer）。
      inSelectionBar: O.selection ? "提问" : void 0,
      onSelect: () => $(O)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        ne(""), Q(!0);
      }
    }] : [];
  }, [e, P, $]), ge = M ? {
    anchor: M.anchor,
    messages: M.messages,
    onClose: () => R(null),
    onDelete: e != null && e.threads && M.mark.threadId ? () => {
      e.threads.remove(t, M.mark.threadId).catch(() => {
      }), v.removeMark(M.mark.key), R(null);
    } : void 0
  } : null, xe = U(() => f ? (F, q) => {
    f(F, q ?? void 0), requestAnimationFrame(() => m(F, "translated"));
  } : null, [f, m]), z = N((F) => ks(o, F), [o]), [K, ee] = x(0), ie = N(({ mode: F, width: q }) => {
    ee(F === "dock" ? Math.round(q) : 0);
  }, []), ce = !k.persistent || !!k.view.conversation || !!k.error, te = e && (k.visible && ce || M) ? /* @__PURE__ */ p(La, { fallback: null, children: /* @__PURE__ */ p(
    Ah,
    {
      port: e,
      jobId: n,
      book: S,
      ask: k,
      legacy: ge,
      onShowSelection: ({ page: F, pane: q }) => l(F, q),
      onJumpToPage: (F) => l(F),
      pageCount: u,
      onLayout: ie,
      dockTaken: y !== null,
      dockHost: w,
      onEditBlock: xe,
      canEditBlock: z,
      attachTools: W,
      attachRequest: E
    }
  ) }) : null, de = j || ae ? /* @__PURE__ */ _(Te, { children: [
    j ? /* @__PURE__ */ p(mh, { onDone: (F) => void fe(F), onCancel: se }) : null,
    ae ? /* @__PURE__ */ _("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => ne(""), children: [
      "截图没成：",
      ae
    ] }) : null
  ] }) : null, ke = k.visible && ce || !!M, he = k.close, oe = N(() => {
    if (ke) {
      R(null), he();
      return;
    }
    k.openMain();
  }, [ke, he, k.openMain]);
  return { marks: v.marks, onMark: me, menuItems: ue, panel: te, overlay: de, cropping: j, toggleCrop: be, open: k.openMain, toggle: oe, showing: ke, reserveRight: ke ? K : 0, enabled: !!e };
}
const Nh = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Lh() {
  const e = $t(), t = U(() => {
    try {
      return Qe().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = _h({
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
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: f, showing: m, reserveRight: h } = n, g = U(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Ua,
      pressed: m,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: Xi,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: d, height: y }) => /* @__PURE__ */ p(Jm, { marks: r, page: d, height: y, onOpen: o }) : void 0,
    shortcuts: Nh,
    reserveRight: h,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, m, h, c, l]);
  return sn(g), /* @__PURE__ */ _(Te, { children: [
    s,
    i
  ] });
}
const Ch = { id: "ask", title: "提问", Component: Lh };
function ir() {
  try {
    return Qe().translationVersions ?? null;
  } catch {
    return null;
  }
}
function $h(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Dh(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Oh(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function zh({ documentId: e, jobId: t }) {
  const [n, r] = x([]), [o, a] = x(null);
  D(() => {
    r([]);
    const i = ir();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = Dh(n, t, o);
  return U(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Fh({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = x(null), [s, i] = x(""), [c, l] = x(""), u = A(0);
  D(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = N((g) => {
    const d = ir(), y = n.find((S) => S.versionId === g);
    if (!d || !y || !e) return;
    const w = ++u.current;
    i(g), l(""), (async () => {
      const S = Qe(), b = await d.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const v = await S.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), k = S.resolveReaderTranslatedPdfUrl(v.jobPayload, v.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: k, regions: $h(Da(v.regionsPayload)) };
    })().then((S) => {
      w === u.current && a(S);
    }).catch((S) => {
      w === u.current && l((S == null ? void 0 : S.message) || "这一份打不开。");
    }).finally(() => {
      w === u.current && i("");
    });
  }, [e, n]), m = N(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), h = N(async () => {
    var y, w;
    const g = ir();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (S) {
      l((S == null ? void 0 : S.message) || "换不过去，请稍后再试。");
      return;
    }
    const d = (y = globalThis.location) == null ? void 0 : y.href;
    d && ((w = globalThis.history) == null || w.replaceState(globalThis.history.state, "", Oh(d, o.jobId))), a(null);
  }, [o, e]);
  return U(() => ({
    available: n.length >= 2,
    versions: n,
    readingVersionId: r,
    compared: o,
    loading: s,
    error: c,
    choose: f,
    clear: m,
    adopt: h
  }), [n, r, o, s, c, f, m, h]);
}
function Bh(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Yi,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(ym, { compare: e, onDone: t })
  } : null;
}
function Hh(e) {
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
function jh() {
  var i;
  const e = $t(), t = Fh({
    documentId: e.documentId,
    jobId: e.jobId,
    versions: e.translationVersions,
    readingVersionId: e.versionId || ""
  }), { visibleMode: n, setWorkspace: r } = e, o = ((i = t.compared) == null ? void 0 : i.url) || "";
  D(() => {
    o && n !== "compare" && r("compare");
  }, [o]);
  const a = t.clear;
  D(() => {
    n !== "compare" && a();
  }, [n, a]);
  const s = U(() => {
    const c = Bh(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Hh(t) };
  }, [t]);
  return sn(s), null;
}
const Uh = { id: "compare", title: "对比版本", Component: jh }, Wh = '"Times New Roman", "Tinos", "Liberation Serif", "Source Han Serif SC", "Noto Serif CJK SC", serif', hn = 1.5;
function Kh(e, t) {
  const n = Ce(e);
  if (n === "formula") {
    const o = `${e.markdown || e.source.text || ""}`.trim();
    return o ? { kind: "display_formula", content: o } : null;
  }
  if (n !== "text") return null;
  const r = t === "translated" ? `${e.translatedBlockText || e.markdown || e.translated.text || ""}`.trim() : `${e.source.text || ""}`.trim();
  return r ? { kind: e.regionType || "text", content: r } : null;
}
function Vh(e) {
  var n;
  const t = /* @__PURE__ */ new Map();
  for (const r of e) {
    const o = Number((n = r.source) == null ? void 0 : n.page);
    if (!Number.isFinite(o)) continue;
    const a = t.get(o);
    a ? a.push(r) : t.set(o, [r]);
  }
  return t;
}
function qh({ page: e, width: t, height: n, regions: r, metadata: o, text: a, arrivedAt: s }) {
  const { items: i, scale: c } = U(() => {
    var m;
    const l = [];
    let u = 0;
    const f = [...r].sort((h, g) => (h.readingOrder ?? 0) - (g.readingOrder ?? 0));
    for (const h of f) {
      const g = Kh(h, a);
      if (!g) continue;
      const d = mt(h, o, "source");
      if (!d || d.box.page !== e) continue;
      const y = lt(d, t, n);
      !y || y.width < 2 || y.height < 2 || (!u && ((m = d.pageSize) != null && m.width) && (u = t / d.pageSize.width), l.push({
        order: l.length,
        item: {
          itemId: h.itemId,
          translatedText: g.content,
          status: "html",
          kind: g.kind,
          sourceText: h.source.text || "",
          typography: a === "source" && g.kind !== "display_formula" ? { font_family: Wh } : void 0,
          rect: {
            left: y.left - hn,
            top: y.top - hn,
            width: y.width + hn * 2,
            height: y.height + hn * 2
          },
          changedAtSeq: s,
          changedNow: Date.now() - s < 1500
        }
      }));
    }
    return { items: l, scale: u || 1 };
  }, [r, o, a, e, t, n, s]);
  return i.length ? /* @__PURE__ */ p("div", { className: "reader-html-page", "data-html-page": e, "data-html-text": a, children: i.map(({ item: l, order: u }) => /* @__PURE__ */ p(
    "div",
    {
      className: "reader-html-block",
      "data-html-block": l.itemId,
      "data-html-kind": l.kind,
      style: { "--reader-html-order": u },
      children: /* @__PURE__ */ p(_r, { item: l, pageScale: c })
    },
    `${l.itemId}:${l.changedAtSeq}`
  )) }) : null;
}
async function Jh(e, t) {
  ws();
  const n = await Tr(kr(e), void 0, { signal: t });
  if (!n || t != null && t.aborted) return null;
  const r = _t(), o = {
    cMapUrl: r.resolvePdfjsVendorUrl("cmaps/"),
    cMapPacked: !0,
    standardFontDataUrl: r.resolvePdfjsVendorUrl("standard_fonts/"),
    rangeChunkSize: Cs,
    disableAutoFetch: !0
  };
  return await ("ranged" in n ? kn.getDocument({ ...o, range: $s(n.ranged) }) : kn.getDocument({ ...o, data: n.data })).promise;
}
const Gh = [
  { value: null, label: "关", hint: "看原来的 PDF" },
  { value: "translated", label: "画译文", hint: "原文页上按 OCR 的框用 HTML 画译文" },
  { value: "source", label: "画原文", hint: "原文页上按 OCR 的框用 HTML 重画原文" }
], Zo = {
  no_translated_pdf: "还没有译文 PDF（或正在重新渲染）",
  not_engine_route: "这次的译文是 Typst 排的，没有版面",
  unsupported_render: "这本书的排版设置引擎排不了（双栏对照、字体不是思源宋体）",
  merged_reading: "合并阅读的书没有版面",
  not_kept: "版面没留下来（以前排的书）",
  no_fonts: "版面还没有字体（以前排的书）",
  failed: "版面没要到"
};
function Xh() {
  var M;
  const e = $t(), [t, n] = x(null), [r, o] = x(0), [a, s] = x(!1), i = U(() => Vh(e.regions), [e.regions]), c = mc(e.jobId, t === "translated"), l = c.status === "ready" ? c : null, { generateNow: u } = c, f = c.status === "unavailable" ? c : null, m = c.status === "generating", h = ((M = l == null ? void 0 : l.source.background) == null ? void 0 : M.url) || "", [g, d] = x(null);
  D(() => {
    if (d(null), !h) return;
    const R = new AbortController();
    return Jh(h, R.signal).then((P) => {
      !R.signal.aborted && P && d(P);
    }).catch((P) => {
      R.signal.aborted || console.warn("[html-page] 底图没读到，用原文页做底：", P);
    }), () => R.abort();
  }, [h]);
  const y = !e.sourceOnly, { metadata: w, visibleMode: S, setWorkspace: b, translatedPane: v } = e, k = U(() => {
    const R = (P) => {
      n(P), o(Date.now()), P && S === "translated" && b("source");
    };
    return {
      toolbarItems: [{
        key: "html-page",
        label: "HTML 页",
        title: t ? `HTML 页：${t === "translated" ? l ? "画译文（照排版引擎的版面）" : "画译文（按识别的框）" : "画原文"}（点开换）` : "HTML 页：把书页用 HTML 画出来",
        Icon: Zi,
        pressed: !!t,
        popup: (P) => /* @__PURE__ */ _("div", { className: "reader-html-page-menu reader-floating-surface", role: "menu", "aria-label": "HTML 页", children: [
          Gh.filter((C) => C.value !== "translated" || y).map((C) => /* @__PURE__ */ p(
            Y,
            {
              className: "reader-html-page-choice",
              role: "menuitemradio",
              "aria-checked": t === C.value,
              title: C.hint,
              onClick: () => {
                R(C.value), P();
              },
              children: C.label
            },
            C.label
          )),
          t === "translated" && f ? /* @__PURE__ */ _(Te, { children: [
            /* @__PURE__ */ p("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ _("p", { className: "reader-html-page-menu-note", children: [
              "现在按识别的框画：",
              Zo[f.reason] || Zo.not_kept,
              "。"
            ] }),
            f.generate ? /* @__PURE__ */ p(
              Y,
              {
                className: "reader-html-page-choice",
                title: "照排版引擎重新排一次版面（不重新翻译、不花钱），排好自动换上，和译文 PDF 一样",
                onClick: () => {
                  u(), P();
                },
                children: "生成 HTML 排版"
              }
            ) : null
          ] }) : null,
          t === "translated" && m ? /* @__PURE__ */ _(Te, { children: [
            /* @__PURE__ */ p("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ p("p", { className: "reader-html-page-menu-note", children: "正在排版（不花钱），先按识别的框画，排好自动换上…" })
          ] }) : null,
          v.canHtml ? /* @__PURE__ */ _(Te, { children: [
            /* @__PURE__ */ p("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ p(
              Y,
              {
                className: "reader-html-page-choice",
                role: "menuitemcheckbox",
                "aria-checked": v.usePdf,
                title: "译文栏现在用 HTML 画（原文 PDF 加排版引擎的版面，不下载译文 PDF）；勾上照旧用译文 PDF",
                onClick: () => {
                  v.setUsePdf(!v.usePdf), P();
                },
                children: "译文栏用 PDF"
              }
            )
          ] }) : null,
          l ? /* @__PURE__ */ _(Te, { children: [
            /* @__PURE__ */ p("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ p(
              Y,
              {
                className: "reader-html-page-choice",
                role: "menuitemcheckbox",
                "aria-checked": a,
                title: "一段话滚进来时，一行接一行浮上来",
                onClick: () => {
                  s((C) => !C), t || R("translated"), P();
                },
                children: "逐行浮现"
              }
            ),
            /* @__PURE__ */ p("p", { className: "reader-html-page-menu-note", children: "点公式会分步展开" })
          ] }) : null
        ] })
      }],
      pageLayer: t ? ({ page: P, width: C, height: $, pane: I, active: T }) => !T || I !== "source" ? null : t === "translated" && l ? /* @__PURE__ */ p(
        Nr,
        {
          source: l.source,
          page: P,
          width: C,
          height: $,
          fontFamily: l.fontFamily,
          arrivedAt: r,
          charRise: a,
          backgroundPdf: g
        }
      ) : /* @__PURE__ */ p(
        qh,
        {
          page: P,
          width: C,
          height: $,
          regions: i.get(P) ?? [],
          metadata: w,
          text: t,
          arrivedAt: r
        }
      ) : void 0
    };
  }, [t, r, i, w, y, S, b, l, a, f, m, u, g, v]);
  return sn(k), null;
}
const Yh = { id: "html-page", title: "HTML 页", Component: Xh }, Hs = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Qo = { pen: 35e-4, highlighter: 0.018 }, ea = 0.015, lr = "retainpdf.reader.ink.v1:";
function ta(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(lr + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Zh(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(lr + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(lr + e);
    } catch {
    }
}
function Qh(e, t, n, r, o, a) {
  const s = ea * ea;
  return e.filter((i) => js(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function js(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function ep(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function tp(e) {
  const [t, n] = x(null), [r, o] = x(Hs[0].key), [a, s] = x(() => ta(e)), i = A(a), c = A([]);
  D(() => {
    const d = ta(e);
    i.current = d, s(d), c.current = [];
  }, [e]);
  const l = N((d) => {
    i.current = d, s(d), Zh(e, d);
  }, [e]), u = N((d) => {
    const y = i.current, w = d(y);
    w !== y && (c.current = [...c.current.slice(-49), y], l(w));
  }, [l]), f = N((d) => {
    d.points.length < 1 || u((y) => [...y, { ...d, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), m = N((d) => {
    d.length && u((y) => y.filter((w) => !d.includes(w.id)));
  }, [u]), h = N((d) => {
    u((y) => y.some((w) => w.page === d) ? y.filter((w) => w.page !== d) : y);
  }, [u]), g = N(() => {
    const d = c.current.pop();
    d && l(d);
  }, [l]);
  return U(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: m, undo: g, clearPage: h }),
    [t, r, a, f, m, g, h]
  );
}
const np = [
  { tool: "pen", label: "画笔", Icon: wn },
  { tool: "highlighter", label: "荧光笔", Icon: Qi },
  { tool: "eraser", label: "橡皮", Icon: el }
];
function rp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function op({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ _(Te, { children: [
    np.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      Y,
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
    Hs.map((o) => /* @__PURE__ */ p(
      Y,
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
    /* @__PURE__ */ p(Y, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(tl, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      Y,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(nl, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      Y,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(bt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function na({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(op, { ink: e, page: t, onPick: n }) });
}
function ap(e) {
  const t = A(e);
  t.current = e, D(() => {
    const n = (r) => {
      if (rp(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const sp = "reader-ink-layer";
function ip(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function ra({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: ip(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function lp({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = x(null), i = A(!1), c = o.strokes.filter((d) => js(d, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (d) => {
    const y = d.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (d.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (d.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (d, y) => o.erase(Qh(o.strokes, e, t, d, y, r / Math.max(1, n))), m = (d) => {
    if (!o.tool || d.button !== 0) return;
    d.preventDefault(), d.stopPropagation(), d.currentTarget.setPointerCapture(d.pointerId), i.current = !0;
    const [y, w] = u(d);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, h = (d) => {
    if (!i.current || !o.tool) return;
    d.stopPropagation();
    const [y, w] = u(d);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? ep(S, y, w) : [[y, w]]);
  }, g = (d) => {
    i.current && (i.current = !1, d.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Qo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ _(
    "svg",
    {
      className: sp,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: m,
      onPointerMove: h,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((d) => /* @__PURE__ */ p(ra, { stroke: d, width: n, height: r }, d.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(ra, { stroke: { tool: o.tool, color: o.color, width: Qo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const cp = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function up(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: wn,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ _("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
        /* @__PURE__ */ p(wn, { ...Me }),
        /* @__PURE__ */ p("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` } })
      ] }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p(na, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(na, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(lp, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: cp
  };
}
function dp() {
  const e = $t(), t = tp(e.resetKey);
  ap(t);
  const n = U(() => up(t), [t]);
  return sn(n), null;
}
const fp = { id: "ink", title: "画笔", Component: dp };
function mp(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
const hp = Ca(() => import("./ReaderMarkdownPanel-Pzmcy_pJ.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Us = { id: "markdown", label: "Markdown", short: "MD", Icon: rl, needsJob: !0 };
function pp() {
  const e = $t(), t = e.activePanel === Us.id;
  if (!mp(t)) return null;
  const r = /* @__PURE__ */ p(La, { fallback: null, children: /* @__PURE__ */ p(hp, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? yl(r, e.panelHost) : r;
}
const gp = {
  id: "markdown",
  title: "Markdown",
  Component: pp,
  panels: [Us]
}, Ws = "reader-xref", cr = "data-xref", Vt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, yp = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Vt})`), bp = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function ur(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function vp(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function wp(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Sp(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Ce(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function kp(e, t, n) {
  return (e.find((o) => Ce(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Tp(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ce(r), s = wp(r);
    if (a === "formula") {
      for (const g of s.matchAll(bp)) {
        const d = ur(g[1]);
        d && n({ key: `equation:${d}`, kind: "equation", label: d, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = yp.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = vp(i[1]), u = ur(i[2]), f = Sp(e, o, l), m = [...f.map((g) => g.itemId), r.itemId], h = new Map(e.map((g, d) => [g.itemId, d]));
    m.sort((g, d) => (h.get(g) ?? 0) - (h.get(d) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: kp(f, r, l), itemIds: m, captionId: r.itemId });
  }), t;
}
const Ip = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Vt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Vt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Vt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Vt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Ep(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Ip) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = ur(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function Pp(e, t) {
  return Ep(e, t).map((n) => ({ start: n.start, end: n.end, className: Ws, attrs: { [cr]: n.key } }));
}
const Rp = { figure: "图", table: "表", equation: "式" };
function oa(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Rp[e.kind]} ${e.label}`;
}
const aa = { figure: "图", table: "表", formula: "公式", text: "文字" }, nt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Mp(e, t, n) {
  const r = mt(e, t, n), o = r ? lt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Rs({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function xp(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = mt(u, t, n), m = f ? lt(f, 1, 1) : null;
    !f || !m || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, m.left), a = Math.min(a, m.top), s = Math.max(s, m.left + m.width), i = Math.max(i, m.top + m.height)));
  }
  if (!r || !c) return null;
  const l = Rs({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Ap(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function _p(e, t) {
  const n = (o) => {
    const a = Ce(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Np({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  translatedLayout: a = null,
  onNavigate: s,
  onClose: i
}) {
  var $;
  const c = t.find((I) => I.itemId === e) ?? null, l = U(() => c ? _p(t, c) : [], [t, c]), u = c ? l.indexOf(c) : -1, [f, m] = x(nt.indexOf(1)), h = nt[f], g = A(null), [d, y] = x(0);
  Ne(() => {
    const I = g.current;
    if (!I) return;
    const T = () => y(I.clientWidth);
    T();
    const E = typeof ResizeObserver == "function" ? new ResizeObserver(T) : null;
    return E == null || E.observe(I), () => E == null ? void 0 : E.disconnect();
  }, []);
  const w = N((I) => {
    const T = l[u + I];
    T && s(T.itemId);
  }, [l, u, s]);
  D(() => {
    const I = (T) => {
      if (T.key === "Escape")
        T.preventDefault(), i();
      else if (T.key === "ArrowLeft")
        T.preventDefault(), w(-1);
      else if (T.key === "ArrowRight")
        T.preventDefault(), w(1);
      else if (T.key === "+" || T.key === "=")
        T.preventDefault(), m((E) => Math.min(nt.length - 1, E + 1));
      else if (T.key === "-" || T.key === "_")
        T.preventDefault(), m((E) => Math.max(0, E - 1));
      else if (T.key === "0")
        T.preventDefault(), m(nt.indexOf(1));
      else
        return;
      T.stopPropagation();
    };
    return window.addEventListener("keydown", I, !0), () => window.removeEventListener("keydown", I, !0);
  }, [i, w]), D(() => {
    const I = g.current;
    if (!I) return;
    const T = (E) => {
      !E.ctrlKey && !E.metaKey || (E.preventDefault(), m((L) => Math.max(0, Math.min(nt.length - 1, L + (E.deltaY < 0 ? 1 : -1)))));
    };
    return I.addEventListener("wheel", T, { passive: !1 }), () => I.removeEventListener("wheel", T);
  }, []);
  const S = A(null);
  if (!c) return null;
  const b = Ce(c), v = o.map((I) => ({
    pane: I,
    pdf: (I === "translated" && a ? r.source : r[I]) ?? null,
    where: Mp(c, n, I)
  })).filter((I) => !!(I.pdf && I.where)), k = 16, M = typeof window > "u" ? 800 : window.innerHeight, R = Math.min(880, M * 0.9) - 56 - 32 - (v.length > 1 ? 26 : 0), P = v.length ? Ap(Math.max(120, (d - k * (v.length - 1) - 32) / v.length), R, v.map((I) => I.where.aspect)) : 0, C = (($ = v[0]) == null ? void 0 : $.where.page) ?? c.source.page;
  return /* @__PURE__ */ _("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${aa[b] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: i }),
    /* @__PURE__ */ _("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ _("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ _("span", { className: "reader-zoom-title", children: [
          aa[b] ?? "这一块",
          " · 第 ",
          C,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: u >= 0 ? `${u + 1} / ${l.length}` : "" }),
        /* @__PURE__ */ _("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: u <= 0, onClick: () => w(-1), children: /* @__PURE__ */ p(Oa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: u < 0 || u >= l.length - 1, onClick: () => w(1), children: /* @__PURE__ */ p(Wa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: f === 0, onClick: () => m((I) => Math.max(0, I - 1)), children: /* @__PURE__ */ p(Ka, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ _(Y, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => m(nt.indexOf(1)), children: [
            Math.round(h * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: f === nt.length - 1, onClick: () => m((I) => Math.min(nt.length - 1, I + 1)), children: /* @__PURE__ */ p(Va, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: i, children: /* @__PURE__ */ p(bt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: g,
          className: "reader-zoom-body",
          onPointerDown: (I) => {
            const T = g.current;
            !T || I.button !== 0 || (S.current = { x: I.clientX, y: I.clientY, left: T.scrollLeft, top: T.scrollTop }, T.setPointerCapture(I.pointerId));
          },
          onPointerMove: (I) => {
            const T = g.current, E = S.current;
            !T || !E || (T.scrollLeft = E.left - (I.clientX - E.x), T.scrollTop = E.top - (I.clientY - E.y));
          },
          onPointerUp: () => {
            S.current = null;
          },
          children: v.length && d ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: k }, children: v.map(({ pane: I, pdf: T, where: E }) => /* @__PURE__ */ _("figure", { className: "reader-zoom-column", children: [
            v.length > 1 ? /* @__PURE__ */ p("figcaption", { children: I === "source" ? "原文" : "译文" }) : null,
            I === "translated" && a ? /* @__PURE__ */ p(Lp, { layout: a, pdf: T, where: E, cssWidth: P * h }) : /* @__PURE__ */ p(
              Nn,
              {
                className: "reader-zoom-canvas",
                pdf: T,
                page: E.page,
                region: E.fraction,
                cssWidth: P * h,
                label: `${I === "source" ? "原文" : "译文"}第 ${E.page} 页`
              }
            )
          ] }, I)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: d ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
function Lp({ layout: e, pdf: t, where: n, cssWidth: r }) {
  const o = r * n.aspect, a = r / Math.max(1e-6, n.fraction.width), s = o / Math.max(1e-6, n.fraction.height);
  return /* @__PURE__ */ _("div", { className: "reader-zoom-layout", style: { width: r, height: o }, children: [
    /* @__PURE__ */ p(Nn, { className: "reader-zoom-canvas", pdf: t, page: n.page, region: n.fraction, cssWidth: r, label: `译文第 ${n.page} 页` }),
    /* @__PURE__ */ p(
      "div",
      {
        className: "reader-zoom-layout-page",
        style: { left: -n.fraction.left * a, top: -n.fraction.top * s, width: a, height: s },
        children: /* @__PURE__ */ p(
          Nr,
          {
            source: e.source,
            page: n.page,
            width: a,
            height: s,
            fontFamily: e.fontFamily,
            arrivedAt: 0,
            backgroundPdf: null,
            coverWhileLoading: !0
          }
        )
      }
    )
  ] });
}
const Cp = 380, $p = 320, kt = 8;
function Dp(e, t, n) {
  const r = Math.max(kt, Math.min(e.left, n.width - t.width - kt)), o = e.bottom + kt, a = o + t.height <= n.height - kt ? o : Math.max(kt, e.top - kt - t.height);
  return { left: r, top: a };
}
function Op({
  preview: e,
  regions: t,
  metadata: n,
  documents: r
}) {
  const o = e.target.itemIds.map((m) => t.find((h) => h.itemId === m)).filter((m) => !!m);
  if (!o.length) return null;
  const a = e.pane === "source" ? ["source", "translated"] : ["translated", "source"];
  let s = null;
  for (const m of a) {
    const h = r[m], g = h ? xp(o, n, m) : null;
    if (h && g) {
      s = { pdf: h, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Cp, $p / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = Dp(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ _("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ _("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: oa(e.target) }),
      /* @__PURE__ */ _("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Nn, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: oa(e.target) })
  ] });
}
const zp = 250;
function Fp(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Bp(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Hp(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function jp({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = x(null), [s, i] = x({ back: [], forward: [] }), c = A(s);
  c.current = s;
  const l = A(null), u = A({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = N(() => {
    const { shellEl: h, primaryPane: g } = u.current;
    return Jt(h, g);
  }, []);
  D(() => {
    if (!e) return;
    const h = (b) => {
      var v, k;
      return (k = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${Ws}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, d = (b) => {
      var R;
      const v = h(b);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(cr) || "");
      if (!k) return;
      const M = ((R = v.closest("[data-reader-pane]")) == null ? void 0 : R.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const P = v.getBoundingClientRect();
        a({ target: k, pane: M, anchor: { left: P.left, top: P.top, right: P.right, bottom: P.bottom } });
      }, zp);
    }, y = (b) => {
      const v = h(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, w = (b) => {
      var P, C;
      const v = h(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((P = window.getSelection) == null ? void 0 : P.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(cr) || "");
      if (!k) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const M = ((C = v.closest("[data-reader-pane]")) == null ? void 0 : C.getAttribute("data-reader-pane")) || u.current.primaryPane, R = f();
      R && i(($) => Fp($, R)), u.current.follow(k, M);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", d), e.addEventListener("pointerout", y), e.addEventListener("click", w, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", d), e.removeEventListener("pointerout", y), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const m = N((h) => {
    const g = f();
    if (!g) return !1;
    const d = Bp(c.current, g, h);
    if (!d) return !1;
    const { shellEl: y, primaryPane: w } = u.current;
    return Nt(y, d.to, "auto", w) ? (i(d.history), !0) : !1;
  }, [f]);
  return D(() => {
    const h = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Hp(g.target)) return;
      m(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", h), () => window.removeEventListener("keydown", h);
  }, [m]), {
    preview: o,
    closePreview: N(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: N(() => m("back"), [m])
  };
}
const Up = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Wp() {
  const e = $t(), t = U(() => Tp(e.regions), [e.regions]), { jumpToBlock: n } = e, r = N((s, i) => n(s.itemId, i), [n]), o = jp({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = U(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => Pp(s, t) : void 0,
    shortcuts: Up
  }), [t]);
  return sn(a), /* @__PURE__ */ _(Te, { children: [
    o.preview ? /* @__PURE__ */ p(Op, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ _(Y, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(ol, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const Kp = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Wp }, $r = [fp, gp, Uh, Kp, Ch, Yh];
function Dr(e = $r) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Vp(e) {
  const t = je(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Te, { children: (e.tabs ?? Dr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, f = l && r, m = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": m,
        "aria-pressed": u,
        title: f ? `${i} 需打开任务阅读` : i,
        disabled: f,
        onClick: () => u ? a() : o(s),
        children: /* @__PURE__ */ p(c, { className: "reader-close-home-icon", ...Me, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function qp(e) {
  const t = je(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Dr().map(({ id: c, label: l, short: u, Icon: f, needsJob: m }) => ({
    key: c,
    label: l,
    short: u,
    Icon: f,
    disabled: m && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ _("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: m, badge: h, onClick: g }) => /* @__PURE__ */ _(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": m,
        className: `reader-assistant-dock-tab${m ? " is-active" : ""}`,
        title: f ? `${l} 需打开任务阅读` : l,
        disabled: f,
        onClick: g,
        children: [
          /* @__PURE__ */ p(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-assistant-dock-tab-label", children: l }),
          h ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: h }) : null
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
        children: /* @__PURE__ */ p(bt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Jp(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Gp(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Xp(e) {
  return e / 100 * window.innerHeight;
}
function Yp(e) {
  return e / 100 * window.innerWidth;
}
function Zp(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function qt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Zp(n);
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
      r = Gp(t, o);
      break;
    }
    case "em": {
      r = Jp(t, o);
      break;
    }
    case "vh": {
      r = Xp(o);
      break;
    }
    case "vw": {
      r = Yp(o);
      break;
    }
  }
  return r;
}
function _e(e) {
  return parseFloat(e.toFixed(3));
}
function Lt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function dr(e) {
  const { panels: t } = e, n = Lt({ group: e });
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
      const u = qt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = _e(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = qt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = _e(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = qt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = _e(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = qt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = _e(u / n * 100);
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
function fr(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Qp : eg
  );
}
function Qp(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function eg(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Ks(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Vs(e, t) {
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
function tg({
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
    const { x: i, y: c } = Vs(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return pe(o, "No rect found"), o;
}
let pn;
function ng() {
  return pn === void 0 && (typeof matchMedia == "function" ? pn = !!matchMedia("(pointer:coarse)").matches : pn = !1), pn;
}
function qs(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = fr(
    n,
    Array.from(t.children).filter(Ks).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, c = !1, l = -1, u = -1, f = 0, m, h = [];
  {
    let g = -1;
    for (const d of a)
      d.hasAttribute("data-panel") && (g++, d.hasAttribute("data-disabled") || (f++, l === -1 && (l = g), u = g));
  }
  if (f > 1) {
    let g = -1;
    for (const d of a)
      if (d.hasAttribute("data-panel")) {
        g++;
        const y = r.find(
          (w) => w.element === d
        );
        if (y) {
          if (m) {
            const w = m.element.getBoundingClientRect(), S = d.getBoundingClientRect();
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
              switch (h.length) {
                case 0: {
                  b = [
                    v,
                    k
                  ];
                  break;
                }
                case 1: {
                  const M = h[0], R = tg({
                    orientation: n,
                    rects: [w, S],
                    targetRect: M.element.getBoundingClientRect()
                  });
                  b = [
                    M,
                    R === w ? k : v
                  ];
                  break;
                }
                default: {
                  b = h;
                  break;
                }
              }
            } else
              h.length ? b = h : b = [
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
              const M = ng() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < M) {
                const P = M - k.width;
                k = new DOMRect(
                  k.x - P / 2,
                  k.y,
                  k.width + P,
                  k.height
                );
              }
              if (k.height < M) {
                const P = M - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - P / 2,
                  k.width,
                  k.height + P
                );
              }
              const R = g <= l || g > u;
              !i && !R && s.push({
                group: e,
                groupSize: Lt({ group: e }),
                panels: [m, y],
                separator: "width" in v ? void 0 : v,
                rect: k
              }), i = !1;
            }
          }
          c = !1, m = y, h = [];
        }
      } else if (d.hasAttribute("data-separator")) {
        d.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (w) => w.element === d
        );
        y ? h.push(y) : (m = void 0, h = []);
      } else
        c = !0;
  }
  return s;
}
var ot;
class Js {
  constructor() {
    ro(this, ot, {});
  }
  addListener(t, n) {
    const r = Dt(this, ot)[t];
    return r === void 0 ? Dt(this, ot)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Dt(this, ot)[t];
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
    oo(this, ot, {});
  }
  removeListener(t, n) {
    const r = Dt(this, ot)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
ot = new WeakMap();
let Mt = {
  cursorFlags: 0,
  state: "inactive"
};
const Or = new Js();
function pt() {
  return Mt;
}
function rg(e) {
  return Or.addListener("change", e);
}
function og(e) {
  const t = Mt, n = { ...Mt };
  n.cursorFlags = e, Mt = n, Or.emit("change", {
    prev: t,
    next: n
  });
}
function xt(e) {
  const t = Mt;
  Mt = e, Or.emit("change", {
    prev: t,
    next: e
  });
}
const ag = (e) => e, Vn = () => {
}, Gs = 1, Xs = 2, Ys = 4, Zs = 8, sa = 3, ia = 12;
let gn;
function la() {
  return gn === void 0 && (gn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (gn = !0)), gn;
}
function sg({
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
        if (e && la()) {
          const a = (e & Gs) !== 0, s = (e & Xs) !== 0, i = (e & Ys) !== 0, c = (e & Zs) !== 0;
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
    return la() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const ca = /* @__PURE__ */ new WeakMap();
function zr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = ca.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = pt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = sg({
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
  ca.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let We = /* @__PURE__ */ new Map();
const Qs = new Js();
function ig(e) {
  We = new Map(We), We.delete(e);
}
function ua(e, t) {
  for (const [n] of We)
    if (n.id === e)
      return n;
}
function st(e, t) {
  for (const [n, r] of We)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function vt() {
  return We;
}
function Fr(e, t) {
  return Qs.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ze(e, t, n) {
  const r = We.get(e);
  We = new Map(We), We.set(e, t), Qs.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function ei(e) {
  const t = pt();
  let n = !1;
  switch (t.state) {
    case "active":
      xt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (zr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = st(r.group.id, !0);
        Ze(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function da(e) {
  e.defaultPrevented || ei(e.currentTarget);
}
function lg(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Vs(n, a.rect);
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
function cg(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function ug(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: ha(e),
    b: ha(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  pe(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: ma(fa(n.a)),
    b: ma(fa(n.b))
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
const dg = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function fg(e) {
  const t = getComputedStyle(ti(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function mg(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || fg(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || dg.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function fa(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (pe(n, "Missing node"), mg(n)) return n;
  }
  return null;
}
function ma(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function ha(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ti(e);
  return t;
}
function ti(e) {
  const { parentNode: t } = e;
  return cg(t) ? t.host : t;
}
function hg(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function pg({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Ks(n) || n.contains(e) || e.contains(n))
    return !0;
  if (ug(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (hg(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Br(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = qs(o), s = lg(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && pg({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function gg(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Ae(e, t, n = 0) {
  return Math.abs(_e(e) - _e(t)) <= n;
}
function Ue(e, t) {
  return Ae(e, t) ? 0 : e > t ? 1 : -1;
}
function Pt({
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
  if (Ue(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Ue(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = _e(r), r;
}
function Qt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Ae(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  pe(u != null, "Invalid first pivot index"), pe(f != null, "Invalid second pivot index");
  let m = 0;
  switch (a) {
    case "keyboard": {
      {
        const d = e < 0 ? f : u, y = n[d];
        pe(
          y,
          `Panel constraints not found for index ${d}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const v = i[d];
          if (pe(
            v != null,
            `Previous layout not found for panel index ${d}`
          ), Ae(v, w)) {
            const k = b - v;
            Ue(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const d = e < 0 ? u : f, y = n[d];
        pe(
          y,
          `No panel constraints found for index ${d}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const v = i[d];
          if (pe(
            v != null,
            `Previous layout not found for panel index ${d}`
          ), Ae(v, b)) {
            const k = v - w;
            Ue(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const d = e < 0 ? f : u, y = n[d];
      pe(
        y,
        `Panel constraints not found for index ${d}`
      );
      const w = i[d], { collapsible: S, collapsedSize: b, minSize: v } = y;
      if (S && Ue(w, v) < 0)
        if (e > 0) {
          const k = v - b, M = k / 2, R = w + e;
          Ue(R, v) < 0 && (e = Ue(e, M) <= 0 ? 0 : k);
        } else {
          const k = v - b, M = 100 - k / 2, R = w - e;
          Ue(R, v) < 0 && (e = Ue(100 + e, M) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const d = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const b = i[y];
      pe(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const v = Pt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (w += v, y += d, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - S : S;
  }
  {
    let d = e < 0 ? u : f;
    for (; d >= 0 && d < n.length; ) {
      const y = Math.abs(e) - Math.abs(m), w = i[d];
      pe(
        w != null,
        `Previous layout not found for panel index ${d}`
      );
      const S = w - y, b = Pt({
        overrideDisabledPanels: s,
        panelConstraints: n[d],
        prevSize: w,
        size: S
      });
      if (!Ae(w, b) && (m += w - b, l[d] = b, m.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? d-- : d++;
    }
  }
  if (gg(c, l))
    return o;
  {
    const d = e < 0 ? f : u, y = i[d];
    pe(
      y != null,
      `Previous layout not found for panel index ${d}`
    );
    const w = y + m, S = Pt({
      overrideDisabledPanels: s,
      panelConstraints: n[d],
      prevSize: y,
      size: w
    });
    if (l[d] = S, !Ae(S, w)) {
      let b = w - S, v = e < 0 ? f : u;
      for (; v >= 0 && v < n.length; ) {
        const k = l[v];
        pe(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const M = k + b, R = Pt({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: M
        });
        if (Ae(k, R) || (b -= R - k, l[v] = R), Ae(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const h = Object.values(l).reduce(
    (d, y) => y + d,
    0
  );
  if (!Ae(h, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((d, y, w) => (d[g[w]] = y, d), {});
}
function gt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ue(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function yt({
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
  if (!Ae(o, 100) && r.length > 0)
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
    const u = Pt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!Ae(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      pe(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = Pt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Ae(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function ni({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = vt();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: f,
        layout: m,
        groupSize: h,
        separatorToPanels: g
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: f,
          group: l,
          groupSize: h,
          layout: m,
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
    const m = a(), h = l.findIndex((y) => y.id === t), g = h === 0, d = h === l.length - 1;
    if (d && c < m && (g || l.slice(0, h).every((y, w) => {
      const S = f[w];
      return (S == null ? void 0 : S.collapsible) && Ae(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = l.slice(0, h).reduce((w, S) => w + u[S.id], 0);
      return {
        ...u,
        [t]: _e(100 - y)
      };
    }
    return Qt({
      delta: d ? m - c : c - m,
      initialLayout: u,
      panelConstraints: f,
      pivotIndices: d ? [h - 1, h] : [h, h + 1],
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
      group: m,
      groupSize: h,
      layout: g,
      separatorToPanels: d
    } = n(), y = s({
      nextSize: c,
      panels: m.panels,
      prevLayout: g,
      derivedPanelConstraints: f
    }), w = yt({
      layout: y,
      panelConstraints: f
    });
    gt(g, w) || Ze(m, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: h,
      layout: w,
      separatorToPanels: d
    });
  };
  return {
    collapse: () => {
      const { collapsible: c, collapsedSize: l } = r(), { mutableValues: u } = o(), f = a();
      c && f !== l && (u.expandToSize = f, i(l));
    },
    expand: () => {
      const { collapsible: c, collapsedSize: l, minSize: u } = r(), { mutableValues: f } = o(), m = a();
      if (c && m === l) {
        let h = f.expandToSize ?? u;
        h === 0 && (h = 1), i(h);
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
      return c && Ae(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = Lt({ group: l }), m = qt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), h = _e(m / f * 100);
      i(h);
    }
  };
}
function pa(e) {
  if (e.defaultPrevented)
    return;
  const t = vt();
  Br(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = ni({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function yn(e) {
  const t = vt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function ri({
  groupId: e
}) {
  const t = () => {
    const n = vt();
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
      } = t(), l = yt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (gt(i, l) || Ze(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function ut(e, t) {
  const n = yn(e), r = st(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  pe(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  pe(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = ri({ groupId: n.id }).getLayout(), c = Qt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = yt({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  gt(i, l) || Ze(
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
function ga(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = yn(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ut(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ut(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ut(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ut(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ut(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = yn(t), o = st(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (m) => m.element === t
        );
        pe(c, "Matching separator not found");
        const l = i.get(c);
        pe(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (m) => m.panelId === u.id
        );
        if (pe(f, "Panel metadata not found"), f.collapsible) {
          const m = s[u.id], h = f.collapsedSize === m ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ut(t, h - m);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = yn(t).separators.map(
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
        e.preventDefault(), ut(t, -100);
        break;
      }
    }
}
function ya(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = vt(), n = Br(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), xt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function oi({
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
    const { group: u, groupSize: f } = l, { orientation: m, panels: h } = u, { disableCursor: g } = u.mutableState;
    let d = 0;
    a ? m === "horizontal" ? d = (t.clientX - a.x) / f * 100 : d = (t.clientY - a.y) / f * 100 : m === "horizontal" ? d = t.clientX < 0 ? -100 : 100 : d = t.clientY < 0 ? -100 : 100;
    const y = r.get(u), w = o.get(u);
    if (!y || !w)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: b,
      groupSize: v,
      layout: k,
      separatorToPanels: M
    } = w;
    if (b && k && M) {
      const R = Qt({
        delta: d,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((P) => h.indexOf(P)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (gt(R, k)) {
        if (d !== 0 && !g)
          switch (m) {
            case "horizontal": {
              i |= d < 0 ? Gs : Xs;
              break;
            }
            case "vertical": {
              i |= d < 0 ? Ys : Zs;
              break;
            }
          }
      } else
        Ze(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: R,
          separatorToPanels: M
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & sa : c |= i & sa, t.movementY === 0 ? c |= s & ia : c |= i & ia, og(c), zr(e);
}
function ba(e) {
  const t = vt(), n = pt();
  switch (n.state) {
    case "active":
      oi({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function va(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = pt(), n = vt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        xt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = st(a.group.id, !0);
          Ze(a.group, s, {
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
      oi({
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
      const a = Br(e, n);
      a.length === 0 ? t.state !== "inactive" && xt({
        cursorFlags: 0,
        state: "inactive"
      }) : xt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), zr(e.currentTarget);
      break;
    }
  }
}
function wa(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (pt().state) {
      case "hover":
        xt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Sa(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || ei(e.currentTarget) && e.preventDefault();
}
function ka(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = _e(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = _e((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function yg(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = Lt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: _e(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function bg(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function vg({
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
    const m = r[f.id] ?? 0;
    switch (f.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const h = m / 100 * n, g = _e(
          h / t * 100
        );
        i.set(f.id, g), o += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        c.push(f.id), a += m;
        break;
      }
    }
  }
  if (!s || c.length === 0)
    return r;
  const l = 100 - o, u = { ...r };
  if (i.forEach((f, m) => {
    u[m] = f;
  }), a > 0)
    for (const f of c) {
      const m = r[f] ?? 0;
      u[f] = _e(
        m / a * l
      );
    }
  else {
    const f = _e(
      l / c.length
    );
    for (const m of c)
      u[m] = f;
  }
  return u;
}
function wg(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Tt = /* @__PURE__ */ new Map();
function Sg(e) {
  let t = !0;
  pe(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const d of g) {
      const { borderBoxSize: y, target: w } = d;
      if (w === e.element) {
        if (t) {
          const S = Lt({ group: e });
          if (S === 0)
            return;
          const b = st(e.id);
          if (!b)
            return;
          const v = dr(e), k = b.defaultLayoutDeferred ? ka(v) : b.layout, M = vg({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: k
          }), R = yt({
            layout: M,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && gt(b.layout, R) && bg(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === S)
            return;
          Ze(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: R,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        yg(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    pe(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Lt({ group: e }), i = dr(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (wg(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? ka(i), f = yt({
    layout: u,
    panelConstraints: i
  }), m = e.element.ownerDocument;
  Tt.set(
    m,
    (Tt.get(m) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return qs(e).forEach((g) => {
    g.separator && h.set(g.separator, g.panels);
  }), Ze(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: h
  }), e.separators.forEach((g) => {
    pe(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", ga);
  }), Tt.get(m) === 1 && (m.addEventListener("contextmenu", da, !0), m.addEventListener("dblclick", pa, !0), m.addEventListener("pointerdown", ya, !0), m.addEventListener("pointerleave", ba), m.addEventListener("pointermove", va), m.addEventListener("pointerout", wa), m.addEventListener("pointerup", Sa, !0)), function() {
    t = !1, Tt.set(
      m,
      Math.max(0, (Tt.get(m) ?? 0) - 1)
    ), ig(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", ga);
    }), Tt.get(m) || (m.removeEventListener(
      "contextmenu",
      da,
      !0
    ), m.removeEventListener(
      "dblclick",
      pa,
      !0
    ), m.removeEventListener(
      "pointerdown",
      ya,
      !0
    ), m.removeEventListener("pointerleave", ba), m.removeEventListener("pointermove", va), m.removeEventListener("pointerout", wa), m.removeEventListener("pointerup", Sa, !0)), a.disconnect();
  };
}
function kg() {
  const [e, t] = x({}), n = N(() => t({}), []);
  return [e, n];
}
function Hr(e) {
  const t = $a();
  return `${e ?? t}`;
}
const wt = typeof window < "u" ? Ne : D;
function Gt(e) {
  const t = A(e);
  return wt(() => {
    t.current = e;
  }, [e]), N(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function jr(...e) {
  return Gt((t) => {
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
function Ur(e) {
  const t = A({ ...e });
  return wt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ai = rn(null);
function Tg(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: ag
  });
  vr(t, () => n.current, []), wt(() => {
    Object.assign(
      n.current,
      ri({ groupId: e })
    );
  });
}
function si({
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
  style: m,
  ...h
}) {
  const g = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), d = Gt((I) => {
    gt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), y = Gt(
    (I, T) => {
      gt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), w = Hr(i), S = A(null), [b, v] = kg(), k = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), M = jr(S, a);
  Tg(w, s);
  const R = Gt(
    (I, T) => {
      const E = pt(), L = ua(I), B = st(I);
      if (B) {
        let W = !1;
        switch (E.state) {
          case "active": {
            W = E.hitRegions.some(
              (j) => j.group === L
            );
            break;
          }
        }
        return {
          flexGrow: B.layout[T] ?? 1,
          pointerEvents: W ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), P = Ur({
    defaultLayout: n,
    disableCursor: r
  }), C = U(
    () => ({
      get disableCursor() {
        return !!P.disableCursor;
      },
      getPanelStyles: R,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const T = k.current;
        return T.panels = fr(u, [
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
        return T.separators = fr(u, [
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
          (W) => W.id === I
        );
        E && (E.panelConstraints.disabled = T);
        const L = ua(w), B = st(w);
        L && B && Ze(L, {
          ...B,
          derivedPanelConstraints: dr(L)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: E
      }) => {
        const L = k.current.separators.find(
          (B) => B.id === I
        );
        L && (L.disabled = T, L.disableDoubleClick = E);
      }
    }),
    [R, w, v, u, P]
  ), $ = A(null);
  return wt(() => {
    const I = S.current;
    if (I === null)
      return;
    const T = k.current;
    let E;
    if (P.defaultLayout !== void 0 && Object.keys(P.defaultLayout).length === T.panels.length) {
      E = {};
      for (const ne of T.panels) {
        const fe = P.defaultLayout[ne.id];
        fe !== void 0 && (E[ne.id] = fe);
      }
    }
    const L = {
      disabled: !!o,
      element: I,
      id: w,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!P.disableCursor,
        expandedPanelSizes: k.current.lastExpandedPanelSizes,
        layouts: k.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    $.current = L;
    const B = Sg(L), { defaultLayoutDeferred: W, derivedPanelConstraints: j, layout: Q } = st(L.id, !0);
    !W && j.length > 0 && (d(Q), y(Q, !1));
    const ae = Fr(w, (ne) => {
      const { defaultLayoutDeferred: fe, derivedPanelConstraints: se, layout: be } = ne.next;
      if (fe || se.length === 0)
        return;
      const me = L.panels.map(({ id: ge }) => ge).join(",");
      L.mutableState.layouts[me] = be, se.forEach((ge) => {
        if (ge.collapsible) {
          const { layout: xe } = ne.prev ?? {};
          if (xe) {
            const z = Ae(
              ge.collapsedSize,
              be[ge.panelId]
            ), K = Ae(
              ge.collapsedSize,
              xe[ge.panelId]
            );
            z && !K && (L.mutableState.expandedPanelSizes[ge.panelId] = xe[ge.panelId]);
          }
        }
      });
      const ue = pt().state !== "active";
      d(be), ue && y(be, ne.isUserInteraction);
    });
    return () => {
      $.current = null, B(), ae();
    };
  }, [
    o,
    w,
    y,
    d,
    u,
    b,
    P
  ]), D(() => {
    const I = $.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ai.Provider, { value: C, children: /* @__PURE__ */ p(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
      ref: M,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...m,
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
si.displayName = "Group";
function Wr() {
  const e = ft(ai);
  return pe(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Ig(e, t) {
  const { id: n } = Wr(), r = A({
    collapse: Vn,
    expand: Vn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Vn
  });
  vr(t, () => r.current, []), wt(() => {
    Object.assign(
      r.current,
      ni({ groupId: n, panelId: e })
    );
  });
}
function mr({
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
  panelRef: m,
  style: h,
  ...g
}) {
  const d = !!c, y = Hr(c), w = Ur({
    disabled: a
  }), S = A(null), b = jr(S, s), {
    getPanelStyles: v,
    id: k,
    orientation: M,
    registerPanel: R,
    updatePanelProps: P
  } = Wr(), C = f !== null, $ = Gt(
    (L, B, W) => {
      f == null || f(L, c, W);
    }
  );
  wt(() => {
    const L = S.current;
    if (L !== null) {
      const B = {
        element: L,
        id: y,
        idIsStable: d,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: C ? $ : void 0,
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
      return R(B);
    }
  }, [
    i,
    n,
    r,
    o,
    C,
    y,
    d,
    l,
    u,
    $,
    R,
    w
  ]), D(() => {
    P(y, { disabled: a });
  }, [a, y, P]), Ig(y, m);
  const I = () => {
    const L = v(k, y);
    if (L)
      return JSON.stringify(L);
  }, T = An(
    (L) => Fr(k, L),
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
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...Eg,
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
            ...h,
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
mr.displayName = "Panel";
const Eg = {
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
function Pg({
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
    a = yt({
      layout: Qt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = yt({
      layout: Qt({
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
function ii({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = Hr(a), l = Ur({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = x({}), [m, h] = x("inactive"), [g, d] = x(!1), y = A(null), w = jr(y, o), {
    disableCursor: S,
    id: b,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: M
  } = Wr(), R = v === "horizontal" ? "vertical" : "horizontal";
  wt(() => {
    const $ = y.current;
    if ($ !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: $,
        id: c
      }, T = k(I), E = rg(
        (B) => {
          h(
            B.next.state !== "inactive" && B.next.hitRegions.some(
              (W) => W.separator === I
            ) ? B.next.state : "inactive"
          );
        }
      ), L = Fr(
        b,
        (B) => {
          const { derivedPanelConstraints: W, layout: j, separatorToPanels: Q } = B.next, ae = Q.get(I);
          if (ae) {
            const ne = ae[0], fe = ae.indexOf(ne);
            f(
              Pg({
                layout: j,
                panelConstraints: W,
                panelId: ne.id,
                panelIndex: fe
              })
            );
          }
        }
      );
      return () => {
        E(), L(), T();
      };
    }
  }, [b, c, k, l]), D(() => {
    M(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, M]);
  let P;
  n && !S && (P = "not-allowed");
  let C;
  if (n)
    C = "disabled";
  else
    switch (m) {
      case "active": {
        C = "active";
        break;
      }
      default:
        g ? C = "focus" : C = m;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": R,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": C,
      "data-testid": c,
      id: c,
      onBlur: () => d(!1),
      onFocus: () => d(!0),
      ref: w,
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
ii.displayName = "Separator";
const Kr = 30, Vr = 65, en = 50, Rg = 100 - Vr, Mg = 100 - Kr;
function xg(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Vr, Math.max(Kr, t)) : en;
}
function qr(e) {
  return 100 - e;
}
function It(e) {
  return `${e}%`;
}
const Jr = "reader-document", tn = "reader-assistant", li = "retainpdf.reader.ai-split-layout.v1", Ag = {
  [Jr]: qr(en),
  [tn]: en
};
function Gr(e) {
  const t = xg(e == null ? void 0 : e[tn]);
  return {
    [Jr]: qr(t),
    [tn]: t
  };
}
function _g() {
  try {
    const e = JSON.parse(localStorage.getItem(li) || "null");
    return Gr(e);
  } catch {
    return Ag;
  }
}
function Ng(e) {
  try {
    localStorage.setItem(li, JSON.stringify(Gr(e)));
  } catch {
  }
}
function qn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Gr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[tn]}vw`
  );
}
function Lg() {
  const e = A(null), [t] = x(_g);
  Ne(() => {
    const o = e.current;
    return qn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = N((o) => {
    qn(e.current, o);
  }, []), r = N((o, a) => {
    qn(e.current, o), a.isUserInteraction && Ng(o);
  }, []);
  return /* @__PURE__ */ _(
    si,
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
          mr,
          {
            id: Jr,
            defaultSize: It(qr(en)),
            minSize: It(Rg),
            maxSize: It(Mg)
          }
        ),
        /* @__PURE__ */ p(
          ii,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          mr,
          {
            id: tn,
            defaultSize: It(en),
            minSize: It(Kr),
            maxSize: It(Vr)
          }
        )
      ]
    }
  );
}
function Cg({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = x(!1);
  if (D(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ _("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ _("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ p(Y, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function $g({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Cg, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ _(Te, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ _("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ _("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(Y, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Dg(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Og() {
  const [e, t] = x(!1), n = $a(), r = A(null), o = Fs(), a = U(() => [...Yu, ...Hm(o)], [o]);
  return D(() => {
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
  }, [e]), D(() => {
    const s = (i) => {
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Dg(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ _("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ p(al, { ...Me, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ _(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ _("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ _("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: s.title }),
            /* @__PURE__ */ p("ul", { children: s.items.map((i) => /* @__PURE__ */ _("li", { children: [
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
const zg = ["source", "sideBySide", "translated"], Fg = { source: "", translated: "", sideBySide: "" };
function Bg(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = vn(e.sourceUrl), n = vn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Pl({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Hg(e) {
  const [t, n] = x(() => /* @__PURE__ */ new Set()), r = U(
    () => e ? Bg(e) : Fg,
    [e]
  ), o = U(
    () => zg.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = N(async (s) => {
    if (!e) return;
    const i = vn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? El(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Rl(
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
        Ml(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const jg = {
  source: Ba,
  sideBySide: Ha,
  translated: ja
}, Ug = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Wg(e) {
  const t = je(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Hg(n), i = A(null);
  return D(() => {
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
  }, []), /* @__PURE__ */ _("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ _("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(sl, { ...Me, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = Mi[c], u = vn(r[c]), f = a.has(c), m = !!u && !f, h = m ? "" : xi(c, r), g = jg[c];
      return /* @__PURE__ */ _(
        "button",
        {
          type: "button",
          id: `reader-download-${c}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !m,
          "aria-label": m ? `下载${l.label}` : h,
          onClick: () => {
            i.current && (i.current.open = !1), s(c);
          },
          children: [
            /* @__PURE__ */ p(g, { ...Me, "aria-hidden": !0 }),
            /* @__PURE__ */ _("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ _("span", { className: "reader-download-action-label", children: [
                Ug[c],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        c
      );
    }) })
  ] });
}
const Kg = "retainpdf:reader:bookmarks:v1:", Vg = 200;
function Xr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ci(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Kg}${t}` : "";
}
function qg(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Xt(e, t = Xr()) {
  const n = ci(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = qg(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const hr = /* @__PURE__ */ new Set();
function Jg(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return hr.add(n), () => {
    hr.delete(n);
  };
}
function pr(e, t, n) {
  const r = ci(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Vg);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...hr]) a(e);
  return o;
}
function Gg(e, t, n = "", { storage: r = Xr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Xt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? pr(e, a.filter((i) => i.page !== s), r) : pr(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Xg(e, t, n = Xr()) {
  return pr(e, Xt(e, n).filter((r) => r.page !== t), n);
}
function Yg(e, t) {
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
function ui(e, t) {
  const [n, r] = x(() => Xt(e));
  D(() => (r(Xt(e)), Jg(e, () => r(Xt(e)))), [e]);
  const o = N((s) => {
    r(Gg(e, s, Yg(t, s)));
  }, [e, t]), a = N((s) => r(Xg(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
const Zg = "retainpdf:reader:favorites:v1:", Qg = 500, Yr = 2e3;
function Zr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function di(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Zg}${t}` : "";
}
function ey(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page)), r = `${t.text || ""}`.trim().slice(0, Yr), o = `${t.id || ""}`.trim();
  return !o || !r || !Number.isFinite(n) || n < 1 ? null : { id: o, text: r, page: n, pane: t.pane === "translated" ? "translated" : "source", createdAt: `${t.createdAt || ""}` };
}
function At(e, t = Zr()) {
  const n = di(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Set(), a = [];
    for (const s of Array.isArray(r) ? r : []) {
      const i = ey(s);
      i && !o.has(i.id) && (o.add(i.id), a.push(i));
    }
    return a;
  } catch {
    return [];
  }
}
const gr = /* @__PURE__ */ new Set();
function ty(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return gr.add(n), () => {
    gr.delete(n);
  };
}
function fi(e, t, n) {
  const r = di(e), o = t.slice(0, Qg);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...gr]) a(e);
  return o;
}
function Qr(e, t, n) {
  const r = `${t || ""}`.trim().slice(0, Yr);
  return e.find((o) => o.page === n && o.text === r) ?? null;
}
function mi(e, t, { storage: n = Zr(), now: r = () => (/* @__PURE__ */ new Date()).toISOString(), makeId: o = ry } = {}) {
  const a = At(e, n), s = `${t.text || ""}`.trim().slice(0, Yr), i = Math.floor(Number(t.page));
  return !s || !Number.isFinite(i) || i < 1 || Qr(a, s, i) ? a : fi(e, [{ id: o(), text: s, page: i, pane: t.pane === "translated" ? "translated" : "source", createdAt: r() }, ...a], n);
}
function ny(e, t, n = Zr()) {
  return fi(e, At(e, n).filter((r) => r.id !== t), n);
}
function ry() {
  var e;
  try {
    if ((e = globalThis.crypto) != null && e.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function hi(e) {
  const [t, n] = x(() => At(e));
  D(() => (n(At(e)), ty(e, () => n(At(e)))), [e]);
  const r = N(
    (a) => n(mi(e, a)),
    [e]
  ), o = N((a) => n(ny(e, a)), [e]);
  return { favorites: t, add: r, remove: o };
}
function oy({ filled: e }) {
  return /* @__PURE__ */ p(il, { ...Me, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function ay({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = ui(e, r);
  if (!e || n <= 0) return null;
  const s = Math.min(Math.max(t, 1), n), i = o.some((c) => c.page === s);
  return /* @__PURE__ */ _("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-mark${i ? " is-marked" : ""}`,
        "aria-pressed": i,
        "aria-label": i ? `取消第 ${s} 页的书签` : `给第 ${s} 页加书签`,
        title: i ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）",
        onClick: () => a(s),
        children: /* @__PURE__ */ p(oy, { filled: i })
      }
    ),
    /* @__PURE__ */ p(sy, { scope: e })
  ] });
}
function sy({ scope: e }) {
  var c;
  const [t, n] = x(!1), r = A(null), { favorites: o, remove: a } = hi(e), s = (c = je()) == null ? void 0 : c.goToPage;
  D(() => {
    if (!t) return;
    const l = (f) => {
      var m;
      (m = r.current) != null && m.contains(f.target) || n(!1);
    }, u = (f) => {
      f.key === "Escape" && n(!1);
    };
    return document.addEventListener("pointerdown", l, !0), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", l, !0), document.removeEventListener("keydown", u);
    };
  }, [t]);
  const i = o.length;
  return /* @__PURE__ */ _("span", { className: "reader-favorites", ref: r, children: [
    /* @__PURE__ */ p(
      Y,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": t,
        "aria-haspopup": "dialog",
        "aria-label": i ? `收藏（${i} 段）` : "收藏",
        title: i ? `收藏的段落（${i} 段）` : "收藏：书页上选一段字，点浮条上的「收藏」",
        onClick: () => n((l) => !l),
        children: /* @__PURE__ */ p(qa, { ...Me, fill: i ? "currentColor" : "none", "aria-hidden": !0 })
      }
    ),
    t ? /* @__PURE__ */ _("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ _("strong", { children: [
        "收藏",
        i ? /* @__PURE__ */ p("span", { className: "reader-favorites-count", children: i }) : null
      ] }),
      i ? /* @__PURE__ */ p("ul", { className: "reader-favorites-list", children: o.map((l) => /* @__PURE__ */ _("li", { children: [
        /* @__PURE__ */ _(
          Y,
          {
            className: "reader-favorites-jump",
            title: `翻到第 ${l.page} 页`,
            onClick: () => {
              s == null || s(l.page, l.pane), n(!1);
            },
            children: [
              /* @__PURE__ */ p("span", { className: "reader-favorites-text", children: l.text }),
              /* @__PURE__ */ _("span", { className: "reader-favorites-page", children: [
                "p.",
                l.page,
                l.pane === "translated" ? " · 译文" : ""
              ] })
            ]
          }
        ),
        /* @__PURE__ */ p(
          Y,
          {
            className: "reader-favorites-remove",
            "aria-label": `删掉第 ${l.page} 页这段收藏`,
            title: "删掉",
            onClick: () => a(l.id),
            children: /* @__PURE__ */ p(bt, { size: 13, "aria-hidden": !0 })
          }
        )
      ] }, l.id)) }) : /* @__PURE__ */ p("p", { children: "还没有收藏。在书页上选一段字，点浮条上的「收藏」（或右键「收藏这段」），就收在这里，随时翻回来。" })
    ] }) : null
  ] });
}
function iy(e) {
  const t = je(), n = Lr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? an, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = _c(a), f = a > os + 1e-3, m = a < Rn - 1e-3, h = Et(r, Rt()), g = h >= Rn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [d, y] = x(!1), [w, S] = x(`${i}`);
  D(() => {
    d || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, d]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const v = Number(`${w}`.trim());
    l(Mn(v, c));
  };
  return /* @__PURE__ */ _("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ _("div", { className: "reader-bottombar-start", children: [
      e.startSlot,
      e.bookmarkScope ? /* @__PURE__ */ p(
        ay,
        {
          scope: e.bookmarkScope,
          currentPage: i,
          numPages: c,
          regions: t == null ? void 0 : t.regions
        }
      ) : null,
      e.leftSlot
    ] }),
    /* @__PURE__ */ _("div", { className: "reader-bottombar-center", children: [
      o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: d ? /* @__PURE__ */ _(
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
                value: w,
                autoFocus: !0,
                onChange: (v) => S(v.target.value.replace(/[^\d]/g, "")),
                onBlur: b,
                onKeyDown: (v) => {
                  v.key === "Escape" && (v.preventDefault(), y(!1), S(`${i}`));
                }
              }
            ),
            /* @__PURE__ */ _("span", { className: "reader-react-hud-page-suffix", children: [
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
        Y,
        {
          className: "reader-react-hud-btn reader-react-hud-doc-dark",
          "aria-pressed": t.docDark ? "true" : "false",
          "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
          title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
          onClick: t.toggleDocDark,
          children: /* @__PURE__ */ p(ll, { ...Me, "aria-hidden": !0 })
        }
      ) }) : null,
      /* @__PURE__ */ _("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
        /* @__PURE__ */ p(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "缩小",
            disabled: !f,
            onClick: () => s(Zt(a, -1)),
            children: /* @__PURE__ */ p(Ka, { ...Me, "aria-hidden": !0 })
          }
        ),
        /* @__PURE__ */ _(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn reader-react-hud-zoom-label",
            "aria-label": `${u}%，点击${g}`,
            title: g,
            onClick: () => s(h),
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
            disabled: !m,
            onClick: () => s(Zt(a, 1)),
            children: /* @__PURE__ */ p(Va, { ...Me, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ _("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Og, {}) })
    ] })
  ] });
}
function Ta(e) {
  var t, n;
  return cs(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function ly(e) {
  const [t, n] = x(() => ({
    scope: e,
    panel: Ta(Ke(e))
  }));
  D(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Ta(Ke(e))
    });
  }, [e]), D(() => {
    t.scope === e && _n(t.scope, {
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
const yr = "download-toast";
function cy({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ _("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ _("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function uy(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Gn.dismiss(yr);
    return;
  }
  Gn.custom(
    () => /* @__PURE__ */ p(cy, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: yr, duration: 1 / 0 }
  );
}
function dy() {
  const e = N((t) => {
    t && (t.setState = uy, t.hide = () => Gn.dismiss(yr));
  }, []);
  return /* @__PURE__ */ _(Te, { children: [
    /* @__PURE__ */ p(Bi, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Ia = { itemId: null, origin: null };
function fy() {
  let e = Ia;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Ia : { itemId: n, origin: r };
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
const Ea = ["ask"];
function my(e) {
  const t = (n) => {
    const r = Ea.indexOf(n.id);
    return r < 0 ? Ea.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function br({
  place: e,
  active: t = null,
  extensions: n = $r
}) {
  const r = e === "side" ? my(n) : n, [o, a] = x(null), s = Fs(), i = (m) => {
    var h;
    return (((h = s.find((g) => g.id === m)) == null ? void 0 : h.contribution.toolbarItems) ?? []).filter((g) => (g.place ?? "side") === e);
  }, c = () => a(null), l = (() => {
    if (!o) return null;
    for (const { id: m } of r)
      for (const h of i(m)) {
        if (`${m}:${h.key}:popup` === o && h.popup) return h.popup(c);
        if (`${m}:${h.key}:dropdown` === o && h.dropdown) return h.dropdown(c);
      }
    return null;
  })(), u = A(null);
  D(() => {
    if (!o) return;
    const m = (g) => {
      var d;
      (d = u.current) != null && d.contains(g.target) || c();
    }, h = (g) => {
      g.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", m, !0), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", m, !0), document.removeEventListener("keydown", h);
    };
  }, [o]);
  const f = r.map((m) => {
    const h = i(m.id), g = e === "side" ? Dr([m]) : [];
    return !h.length && !g.length ? null : /* @__PURE__ */ _(xn, { children: [
      h.map((d) => {
        const y = `${m.id}:${d.key}`, w = d.Icon;
        return /* @__PURE__ */ _("span", { className: "reader-bar-tool-group", "data-has-dropdown": d.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ p(
            Y,
            {
              className: e === "compare" ? "reader-bar-tool reader-bar-tool-compare" : "reader-bar-tool",
              "aria-label": d.label,
              title: d.title || d.label,
              "aria-pressed": !!d.pressed || o === `${y}:popup`,
              "aria-expanded": d.popup ? o === `${y}:popup` : void 0,
              "data-bar-tool": d.key,
              onClick: () => {
                var S;
                if (d.popup) {
                  a((b) => b === `${y}:popup` ? null : `${y}:popup`);
                  return;
                }
                (S = d.onClick) == null || S.call(d), c();
              },
              children: e === "compare" ? /* @__PURE__ */ p(Sn, { ...Io, "aria-hidden": !0 }) : d.mark ?? /* @__PURE__ */ p(w, { ...Me, "aria-hidden": !0 })
            }
          ),
          d.dropdown ? /* @__PURE__ */ p(
            Y,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${d.label}：选项`,
              title: `${d.label}的选项`,
              "aria-expanded": o === `${y}:dropdown`,
              "data-bar-tool-caret": d.key,
              onClick: () => a((S) => S === `${y}:dropdown` ? null : `${y}:dropdown`),
              children: /* @__PURE__ */ p(Sn, { ...Io, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(Vp, { active: t, tabs: g }) : null
    ] }, m.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ _("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "side" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const Pa = { search: "搜索", bookmarks: "书签", issues: "待改" }, hy = [];
function py({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ _("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ _(Y, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(Ja, { ...Me, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function gy({
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
  var R;
  const m = ((R = je()) == null ? void 0 : R.regions) ?? hy, h = U(() => Ed(m, s), [m, s]), [g, d] = x(-1);
  D(() => d(-1), [s]);
  const y = A(null), w = A(null), S = A(n);
  S.current = n, D(() => {
    if (c) return;
    const P = ($) => {
      var T, E;
      const I = $.target;
      !I || (T = w.current) != null && T.contains(I) || (E = I.closest) != null && E.call(I, ".reader-finder-toggles, [data-finder-toggle]") || S.current();
    }, C = ($) => {
      $.key === "Escape" && S.current();
    };
    return document.addEventListener("pointerdown", P, !0), document.addEventListener("keydown", C), () => {
      document.removeEventListener("pointerdown", P, !0), document.removeEventListener("keydown", C);
    };
  }, [c]);
  const b = A(null);
  D(() => {
    var P;
    e === "search" && ((P = y.current) == null || P.focus());
  }, [e, i]), D(() => {
    var P, C, $;
    e === "search" && g >= 0 && (($ = (C = (P = b.current) == null ? void 0 : P.querySelector('[aria-current="true"]')) == null ? void 0 : C.scrollIntoView) == null || $.call(C, { block: "nearest" }));
  }, [e, g]);
  const v = (P) => {
    const C = h[P];
    C && (d(P), r(C.itemId));
  }, k = ["search", ...l ? ["bookmarks"] : [], ...u ? ["issues"] : []], M = k.includes(e) ? e : "search";
  return /* @__PURE__ */ _("aside", { ref: w, className: "reader-finder", "data-finder-tab": M, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${Pa[M]}`, children: [
    /* @__PURE__ */ _("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: k.map((P) => /* @__PURE__ */ _(Y, { className: "reader-finder-tab", role: "tab", "aria-selected": M === P, onClick: () => t(P), children: [
        Pa[P],
        P === "issues" && f ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, P)) }),
      /* @__PURE__ */ p(Y, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(bt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    M === "bookmarks" ? l : M === "issues" ? u : null,
    M !== "search" ? null : /* @__PURE__ */ _(Te, { children: [
      /* @__PURE__ */ _("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          Sr,
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
              P.key === "Enter" ? (P.preventDefault(), v(Pd(g, h.length, P.shiftKey))) : P.key === "Escape" && (P.preventDefault(), c ? P.currentTarget.blur() : n()), P.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: h.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${h.length >= 200 ? "200+ 处，只列前 200 处" : `${h.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { ref: b, className: "reader-finder-list", children: h.map((P, C) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(Y, { className: "reader-finder-entry is-hit", "aria-current": C === g ? "true" : void 0, onClick: () => v(C), children: [
        /* @__PURE__ */ _("span", { className: "reader-finder-entry-text", children: [
          P.snippet.slice(0, P.at),
          /* @__PURE__ */ p("mark", { children: P.snippet.slice(P.at, P.at + P.length) }),
          P.snippet.slice(P.at + P.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: P.page })
      ] }) }, P.itemId)) })
    ] })
  ] });
}
function pi(e, t = []) {
  for (const n of e)
    t.push(n), pi(n.children, t);
  return t;
}
const yy = 24, Ut = 28, Ra = 15;
function gi(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function by(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: pi(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function vy(e, t) {
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
function wy(e, t) {
  const n = gi(e) > yy, r = Math.max(1, Math.ceil(e.length / Ut)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= Ut) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(Ut / 2)), o.length - Ut);
  return o.slice(s, s + Ut);
}
function Sy(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const ky = [];
function Ma({ bookmarks: e, onJumpPage: t, onJumpBlock: n, pinned: r = !1, docked: o = !1, onPinChange: a }) {
  var $, I;
  const s = (($ = je()) == null ? void 0 : $.regions) ?? ky, i = ((I = Lr()) == null ? void 0 : I.currentPage) ?? 1, c = U(() => by(e, kd(s)), [e, s]), l = U(() => vy(c, i), [c, i]), u = U(() => wy(c, l), [c, l]), f = gi(c), [m, h] = x(""), g = U(() => Sy(c, m), [c, m]), [d, y] = x(() => /* @__PURE__ */ new Set()), w = A(null), S = A(!1), b = () => {
    l.chapterId && !d.has(l.chapterId) && y((T) => new Set(T).add(l.chapterId)), S.current = !0;
  };
  if (D(() => {
    (r || o) && b();
  }, [r, o]), Ne(() => {
    var T, E, L;
    S.current && (S.current = !1, (L = (E = (T = w.current) == null ? void 0 : T.querySelector('[aria-current="location"]')) == null ? void 0 : E.scrollIntoView) == null || L.call(E, { block: "center" }));
  }), !c.length) return null;
  const v = (T) => y((E) => {
    const L = new Set(E);
    return L.has(T) ? L.delete(T) : L.add(T), L;
  }), k = (T, E) => {
    y((L) => L.has(E) ? L : new Set(L).add(E)), T.itemId ? n(T.itemId) : T.page !== null && t(T.page);
  }, M = !!m.trim(), R = (T, E) => /* @__PURE__ */ _(
    Y,
    {
      className: "reader-toc-entry",
      "data-depth": Math.min(T.depth, 3),
      "aria-current": T.id === l.nodeId ? "location" : void 0,
      disabled: !T.itemId && T.page === null,
      title: T.page === null ? "这条书签没有指到页" : `${T.title}（第 ${T.page} 页）`,
      onClick: () => k(T, E),
      children: [
        /* @__PURE__ */ p("span", { className: "reader-toc-title", children: T.title }),
        T.page !== null ? /* @__PURE__ */ _("span", { className: "reader-toc-page", children: [
          "p.",
          T.page
        ] }) : null
      ]
    }
  ), P = r ? "取消固定" : "固定在左边", C = /* @__PURE__ */ _(Te, { children: [
    /* @__PURE__ */ _("div", { className: "reader-toc-head", children: [
      /* @__PURE__ */ p("span", { className: "reader-toc-head-title", children: "目录" }),
      /* @__PURE__ */ p(Y, { className: "reader-toc-pin", "aria-label": P, title: P, "aria-pressed": r, onClick: () => a == null ? void 0 : a(!r), children: r ? /* @__PURE__ */ p(cl, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(Fa, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) })
    ] }),
    f > Ra ? /* @__PURE__ */ _("div", { className: "reader-toc-filter", children: [
      /* @__PURE__ */ p(Ja, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ p(
        Sr,
        {
          size: "sm",
          className: "reader-toc-filter-input",
          value: m,
          placeholder: "过滤章节标题或节号…",
          "aria-label": "过滤目录",
          onChange: (T) => h(T.target.value),
          onKeyDown: (T) => {
            T.stopPropagation(), T.key === "Escape" && (m ? h("") : (T.currentTarget.blur(), r && !o && (a == null || a(!1))));
          }
        }
      ),
      m ? /* @__PURE__ */ p(Y, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => h(""), children: /* @__PURE__ */ p(bt, { size: 12, "aria-hidden": !0 }) }) : null
    ] }) : null,
    /* @__PURE__ */ p("div", { className: "reader-toc-list", ref: w, children: g.length ? g.map((T) => {
      const E = M || d.has(T.id);
      return /* @__PURE__ */ _("div", { className: "reader-toc-chapter", children: [
        /* @__PURE__ */ _("div", { className: "reader-toc-chapter-row", children: [
          T.children.length ? /* @__PURE__ */ p(
            Y,
            {
              className: "reader-toc-caret",
              "aria-expanded": E,
              "aria-label": `${E ? "收起" : "展开"}「${T.title}」`,
              onClick: () => v(T.id),
              children: E ? /* @__PURE__ */ p(Sn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(Wa, { size: 12, "aria-hidden": !0 })
            }
          ) : /* @__PURE__ */ p("span", { className: "reader-toc-caret-space" }),
          R(T, T.id)
        ] }),
        E ? T.children.map((L) => /* @__PURE__ */ p("div", { children: R(L, T.id) }, L.id)) : null
      ] }, T.id);
    }) : /* @__PURE__ */ p("p", { className: "reader-toc-empty", children: "没有匹配的章节" }) })
  ] });
  return o ? /* @__PURE__ */ p("nav", { className: "reader-toc-dock", "aria-label": "目录", children: C }) : /* @__PURE__ */ _(
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
        /* @__PURE__ */ p("div", { className: "reader-toc-card", "data-compact": f <= Ra ? "true" : void 0, children: C })
      ]
    }
  );
}
function Ty({ active: e }) {
  return /* @__PURE__ */ _("div", { className: "reader-side-rail", role: "toolbar", "aria-orientation": "vertical", "aria-label": "面板和下载", children: [
    /* @__PURE__ */ p(br, { place: "side", active: e }),
    /* @__PURE__ */ p("span", { className: "reader-side-rail-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(Wg, {})
  ] });
}
const Iy = ".textLayer", xa = 8, Ey = 34, Py = 56;
function Ry(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function bn(e = ((t) => (t = globalThis.getSelection) == null ? void 0 : t.call(globalThis))() ?? null) {
  if (!e || e.isCollapsed || !e.rangeCount) return null;
  const n = e.getRangeAt(0), r = rh(n);
  if (!r) return null;
  const o = Bs(e);
  if (!o) return null;
  const a = r.closest(`[${Ie}]`);
  return {
    text: o,
    page: Math.max(1, Number(a == null ? void 0 : a.getAttribute(Ie)) || 1),
    pane: (a == null ? void 0 : a.getAttribute(Se)) === "translated" ? "translated" : "source",
    layer: r
  };
}
async function yi(e) {
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
const bi = typeof navigator < "u" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
function My(e) {
  const t = bn();
  if (!t) return [];
  const n = [{ key: "copy", label: "复制", hint: bi ? "⌘C" : "Ctrl+C", onSelect: () => {
    yi(t.text);
  } }];
  if (e) {
    const r = Qr(At(e), t.text, t.page);
    n.push({
      key: "favorite",
      label: r ? "已收藏（在左下角「收藏」里）" : "收藏这段",
      onSelect: () => {
        mi(e, t);
      }
    });
  }
  return n;
}
function xy(e) {
  return [...e.querySelectorAll("span")].filter((t) => !t.classList.contains("markedContent") && !t.querySelector("span"));
}
function Ay(e) {
  let t = 0, n = null;
  return e.map((r) => {
    const o = r.getBoundingClientRect(), a = o.top + o.height / 2;
    return n && Math.abs(a - n.center) > Math.max(o.height, n.height) / 2 && (t += 1), n = { center: a, height: o.height || (n == null ? void 0 : n.height) || 0 }, { text: r.textContent || "", line: t };
  });
}
function _y(e) {
  const t = [], n = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  for (let r = n.nextNode(); r; r = n.nextNode()) t.push(r);
  return t;
}
function Aa(e, t) {
  const n = Ry(e), r = n == null ? void 0 : n.closest(Iy), o = n == null ? void 0 : n.closest("span");
  if (!r || !o) return null;
  const a = xy(r), s = a.indexOf(o);
  if (s < 0) return null;
  const i = Math.max(0, s - 60), c = a.slice(i, Math.min(a.length, s + 61)), l = eh(Ay(c), s - i);
  if (!l) return null;
  const u = _y(c[t === "start" ? l[0] : l[1]]);
  return u.length ? t === "start" ? { node: u[0], offset: 0 } : { node: u[u.length - 1], offset: u[u.length - 1].length } : null;
}
function Ny(e) {
  if (!e || e.isCollapsed || !e.rangeCount) return !1;
  const t = e.getRangeAt(0), n = Aa(t.startContainer, "start"), r = Aa(t.endContainer, "end");
  if (!n && !r) return !1;
  const o = t.cloneRange();
  return n && t.comparePoint(n.node, n.offset) <= 0 && o.setStart(n.node, n.offset), r && t.comparePoint(r.node, r.offset) >= 0 && o.setEnd(r.node, r.offset), o.compareBoundaryPoints(Range.START_TO_START, t) === 0 && o.compareBoundaryPoints(Range.END_TO_END, t) === 0 ? !1 : (e.removeAllRanges(), e.addRange(o), !0);
}
function Ly(e) {
  var i;
  if (!e || e.isCollapsed || !e.rangeCount) return [];
  const t = e.getRangeAt(0), n = t.commonAncestorContainer, r = n.nodeType === 3 ? [n] : (() => {
    const c = [], l = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let u = l.nextNode(); u; u = l.nextNode()) t.intersectsNode(u) && c.push(u);
    return c;
  })(), o = [], a = /* @__PURE__ */ new Map();
  for (const c of r) {
    const l = (i = c.parentElement) == null ? void 0 : i.closest(ar);
    if (!l) continue;
    const u = l.closest(`.${on}`) ?? l;
    let f = a.get(u);
    f || (f = u.getBoundingClientRect(), a.set(u, f));
    const m = document.createRange();
    if (m.selectNodeContents(c), c === t.startContainer && m.setStart(c, t.startOffset), c === t.endContainer && m.setEnd(c, t.endOffset), !!m.toString().trim())
      for (const h of m.getClientRects()) {
        const g = Math.max(h.left, f.left), d = Math.min(h.right, f.right);
        d - g > 0.5 && o.push({ left: g, top: h.top, right: d, bottom: h.bottom });
      }
  }
  const s = n.nodeType === 1 ? n : n.parentElement;
  for (const c of (s == null ? void 0 : s.querySelectorAll(".reader-layout-page svg.reader-layout-math")) ?? []) {
    if (!t.intersectsNode(c)) continue;
    const l = c.getBoundingClientRect();
    l.width > 0.5 && o.push({ left: l.left, top: l.top, right: l.right, bottom: l.bottom });
  }
  return th(o);
}
function Cy({ scope: e, menuItemsAt: t }) {
  const n = A(null), r = A(!1), o = A(!1), a = A(0), s = A(t);
  s.current = t;
  const [i, c] = x(null), l = A(null), u = N(() => {
    var M;
    a.current = 0;
    const m = n.current;
    if (!m) return;
    const h = ((M = globalThis.getSelection) == null ? void 0 : M.call(globalThis)) ?? null, g = Ly(h), d = m.getBoundingClientRect();
    for (; m.children.length > g.length; ) m.lastElementChild.remove();
    if (g.forEach((R, P) => {
      const C = m.children[P] ?? m.appendChild(document.createElement("div"));
      C.className = "reader-selection-band", C.style.left = `${R.left - d.left}px`, C.style.top = `${R.top - d.top}px`, C.style.width = `${R.right - R.left}px`, C.style.height = `${R.bottom - R.top}px`;
    }), !r.current) return;
    const y = bn(h);
    if (!y || !g.length) {
      r.current = !1, c(null);
      return;
    }
    const w = g[0], S = g[g.length - 1], b = (Math.min(...g.map((R) => R.left)) + Math.max(...g.map((R) => R.right))) / 2 - d.left, v = w.top - d.top - xa - Ey, k = v >= Py ? v : S.bottom - d.top + xa;
    c((R) => {
      var I;
      const P = R && R.text === y.text ? R.actions : s.current({
        target: y.layer,
        clientX: (w.left + w.right) / 2,
        clientY: (w.top + w.bottom) / 2,
        page: y.page
      }).filter((T) => T.inSelectionBar), C = ((I = l.current) == null ? void 0 : I.offsetWidth) || 220, $ = Math.min(Math.max(b, C / 2 + 8), d.width - C / 2 - 8);
      return R && R.text === y.text && Math.abs(R.left - $) < 0.5 && Math.abs(R.top - k) < 0.5 ? R : { left: $, top: k, text: y.text, page: y.page, pane: y.pane, actions: P };
    });
  }, []), f = N(() => {
    a.current || (a.current = requestAnimationFrame(u));
  }, [u]);
  return D(() => {
    const m = n.current, h = m == null ? void 0 : m.parentElement, g = m == null ? void 0 : m.closest(`.${es}`);
    if (!m || !h) return;
    const d = () => {
      g && delete g.dataset.selectPane;
    }, y = (v) => {
      var R, P, C;
      const k = v.target;
      if (k && ((R = l.current) != null && R.contains(k))) return;
      r.current = !1, c(null);
      const M = (C = (P = k == null ? void 0 : k.closest) == null ? void 0 : P.call(k, `[${Ie}][${Se}]`)) == null ? void 0 : C.getAttribute(Se);
      o.current = !!M && v.button === 0, g && M && v.button === 0 && (g.dataset.selectPane = M);
    }, w = (v) => {
      var R;
      d();
      const k = o.current;
      if (o.current = !1, v.button !== 0 || !k) return;
      const M = ((R = globalThis.getSelection) == null ? void 0 : R.call(globalThis)) ?? null;
      bn(M) && (Ny(M), r.current = !0, f());
    }, S = (v) => {
      const k = bn();
      !k || !v.clipboardData || (v.clipboardData.setData("text/plain", k.text), v.preventDefault());
    }, b = (v) => {
      v.key === "Escape" && r.current && (r.current = !1, c(null));
    };
    return h.addEventListener("pointerdown", y, !0), window.addEventListener("pointerup", w), window.addEventListener("pointercancel", d), document.addEventListener("selectionchange", f), document.addEventListener("copy", S), document.addEventListener("keydown", b), h.addEventListener("scroll", f, { capture: !0, passive: !0 }), window.addEventListener("resize", f), () => {
      d(), a.current && cancelAnimationFrame(a.current), h.removeEventListener("pointerdown", y, !0), window.removeEventListener("pointerup", w), window.removeEventListener("pointercancel", d), document.removeEventListener("selectionchange", f), document.removeEventListener("copy", S), document.removeEventListener("keydown", b), h.removeEventListener("scroll", f, { capture: !0 }), window.removeEventListener("resize", f);
    };
  }, [f]), /* @__PURE__ */ _(Te, { children: [
    /* @__PURE__ */ p("div", { className: "reader-selection-paint", ref: n, "aria-hidden": "true" }),
    i ? /* @__PURE__ */ p(
      $y,
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
function $y({ bar: e, scope: t, onDone: n, ref: r }) {
  const { favorites: o, add: a } = hi(t), s = !!t && !!Qr(o, e.text, e.page), [i, c] = x(!1);
  return D(() => {
    if (!i) return;
    const l = setTimeout(() => c(!1), 1200);
    return () => clearTimeout(l);
  }, [i]), /* @__PURE__ */ _(
    "div",
    {
      ref: r,
      className: "reader-selection-bar",
      role: "toolbar",
      "aria-label": "选中的字",
      style: { left: e.left, top: e.top },
      onPointerDown: (l) => l.preventDefault(),
      children: [
        /* @__PURE__ */ _(
          Y,
          {
            className: "reader-selection-action",
            title: bi ? "复制（⌘C）" : "复制（Ctrl+C）",
            onClick: () => {
              yi(e.text).then((l) => c(l));
            },
            children: [
              i ? /* @__PURE__ */ p(wr, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(za, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: i ? "已复制" : "复制" })
            ]
          }
        ),
        t ? /* @__PURE__ */ _(
          Y,
          {
            className: "reader-selection-action",
            "aria-pressed": s,
            title: s ? "已收藏，在左下角「收藏」（星）里" : "收藏这段，在左下角「收藏」（星）里翻回来",
            onClick: () => {
              s || a({ text: e.text, page: e.page, pane: e.pane });
            },
            children: [
              /* @__PURE__ */ p(qa, { size: 14, strokeWidth: 1.75, fill: s ? "currentColor" : "none", "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: s ? "已收藏" : "收藏" })
            ]
          }
        ) : null,
        e.actions.map((l) => /* @__PURE__ */ _(
          Y,
          {
            className: "reader-selection-action",
            title: l.hint ? `${l.label}（${l.hint}）` : l.label,
            onClick: () => {
              n(), l.onSelect();
            },
            children: [
              /* @__PURE__ */ p(Ua, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: l.inSelectionBar })
            ]
          },
          l.key
        ))
      ]
    }
  );
}
function Dy(e) {
  const [t, n] = x([]);
  return D(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Qe().loadIssues;
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
function Oy(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const zy = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Fy = ["failed", "content", "layout"];
function By(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Hy(e, t, n) {
  const r = Dy(e), [o, a] = x(-1);
  D(() => a(-1), [r]);
  const s = N((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = A({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, D(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || By(l.target)) return;
      const { issues: u, last: f, currentPage: m, goTo: h } = i.current, g = Oy(u, f, m, l.shiftKey);
      g < 0 || (l.preventDefault(), h(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function jy(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Uy(e) {
  var r;
  if (e.shiftKey || jy(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${ns}`))) return null;
  const n = Number((r = t.closest(`[${Ie}]`)) == null ? void 0 : r.getAttribute(Ie)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Wy({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = A(null);
  if (D(() => {
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
  return /* @__PURE__ */ _("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ _(
      Y,
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
    r.map((c) => /* @__PURE__ */ p(xn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function Ky({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ _("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      Y,
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
const vi = "retainpdf:reader:doc-theme:v1", _a = "data-reader-doc";
function wi() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Vy(e = wi()) {
  try {
    return (e == null ? void 0 : e.getItem(vi)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function qy(e, t = wi()) {
  try {
    t == null || t.setItem(vi, e);
  } catch {
  }
}
function Na(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(_a, "dark") : t.removeAttribute(_a));
}
function Jy() {
  const [e, t] = x(() => Vy());
  D(() => {
    Na(e);
  }, [e]), D(() => () => Na("light"), []);
  const n = N(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return qy(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function Gy({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = ui(e, t);
  return a.length ? /* @__PURE__ */ p("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ _("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ _(
      Y,
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
    /* @__PURE__ */ p(Y, { className: "reader-bookmark-remove", "aria-label": `删除第 ${i.page} 页的书签`, title: "删除这个书签", onClick: () => s(i.page), children: "×" })
  ] }, i.page)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: "还没有书签。左下角的书签按钮给眼下这一页加一个。" });
}
function Xy({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ _("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    Fy.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ _("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ _("h4", { children: [
          zy[o],
          /* @__PURE__ */ p("span", { children: a.length })
        ] }),
        /* @__PURE__ */ p("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(Y, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
          /* @__PURE__ */ p("span", { className: "reader-issues-title", children: s.title }),
          /* @__PURE__ */ _("span", { className: "reader-issues-page", children: [
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
function Yy({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: f } = e, m = je(), h = Lr(), g = (h == null ? void 0 : h.currentPage) ?? 1, d = n.issues.length;
  return /* @__PURE__ */ p(Te, { children: r ? /* @__PURE__ */ p(
    gy,
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
        Gy,
        {
          scope: t,
          regions: m == null ? void 0 : m.regions,
          currentPage: g,
          numPages: (h == null ? void 0 : h.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: d ? /* @__PURE__ */ p(Xy, { nav: n }) : void 0,
      issueCount: d
    }
  ) : null });
}
function Zy({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a,
  translatedLayout: s = null
}) {
  return /* @__PURE__ */ p(Te, { children: n ? /* @__PURE__ */ p(
    Np,
    {
      itemId: n,
      regions: e.regions,
      metadata: e.readerMetadata,
      documents: t,
      panes: a === "compare" ? ["source", "translated"] : a === "translated" ? ["translated"] : ["source"],
      translatedLayout: s,
      onNavigate: r,
      onClose: o
    }
  ) : null });
}
function Qy(e) {
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
const eb = 720;
function tb(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= eb;
}
function nb(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function rb(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = x(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Qy({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = Du({
    hasOverlayContent: s,
    connection: e.liveTranslation.connection,
    showSource: i.showSource,
    liveTranslationVisible: o,
    assistantOpen: t
  }), l = i.sourceViewOnly, u = i.visibleMode;
  D(() => {
    a(!1);
  }, [e.viewStateKey]), D(() => {
    e.session.jobTerminal && a(!1);
  }, [e.session.jobTerminal]);
  const f = A(null);
  return D(() => {
    f.current !== e.viewStateKey && Fu({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function ob(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = Ou(e.liveTranslation), i = N(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = x(null);
  D(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && Bu({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), f = U(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${t ? " is-active" : ""}`,
      onClick: () => n((m) => !m),
      "aria-pressed": t,
      title: t ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [r.sourcePaneToggle, t]);
  return { latestLivePage: s, jumpToLatestLivePage: i, offerCompletion: u, setCompletionDismissedKey: l, sourcePaneAction: f };
}
function ab() {
  const [e] = x(Cm), t = Wm(e), n = Fm(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function sb(e, t, n) {
  const r = A(e);
  D(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function ib(e, t, {
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
  translatedPane: m,
  panelHost: h = null
}) {
  const { session: g, panes: d } = e, y = A(e.currentPage);
  y.current = e.currentPage;
  const w = N(() => y.current, []), S = U(() => ({
    documentId: g.documentId || "",
    jobId: g.jobId,
    versionId: n.readingVersionId || null,
    translationVersions: n.versions,
    regions: g.regions,
    metadata: g.readerMetadata,
    bookmarks: r,
    pageCount: d.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => o.get().itemId,
    goToPage: e.goToPage,
    sourceOnly: e.sourceOnly,
    activePanel: a,
    closePanel: s,
    panelHost: h,
    visibleMode: i,
    setWorkspace: c,
    jumpToBlock: l,
    shellEl: e.shell.shellEl,
    primaryPane: e.panes.primaryPane,
    pdfDocuments: u,
    editBlock: f,
    currentPage: w,
    translatedPane: m
  }), [
    g.documentId,
    g.jobId,
    n,
    g.regions,
    g.readerMetadata,
    r,
    d.hudNumPages,
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
    h,
    m
  ]), { contributionStore: b, contributions: v, reserveRight: k } = t, M = U(() => $m(v), [v]), R = U(() => Bm(v), [v]), P = U(() => zm(v), [v]), C = U(() => Dm(v), [v]), $ = Om(v);
  return { readerApi: S, contributionStore: b, contributions: v, pageLayers: M, compareVersion: R, textMarks: P, menuSections: C, pointerTakenId: $, reserveRight: k };
}
function lb() {
  try {
    return Qe().translationEdit ?? null;
  } catch {
    return null;
  }
}
const cb = "这本书正在处理（翻译或排版），处理完才能改。", ub = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function db({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = lb(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = xd(s), l = !t || Yt(t), u = $d(n), [f, m] = x(""), [h, g] = x(null), [d, y] = x(() => /* @__PURE__ */ new Map()), [w, S] = x(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = x(() => /* @__PURE__ */ new Map()), [k, M] = x({ phase: "idle" }), R = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  D(() => {
    g(null), R.drafts.clear(), R.generation.current = null, v(/* @__PURE__ */ new Map()), M({ phase: "idle" });
  }, [s]), D(() => {
    if (m(""), !i || c || !a) return;
    let B = !1;
    return a.resolveOwnerJobId(s).then((W) => {
      B || m(`${W || s}`.trim() || s);
    }).catch(() => {
      B || m(s);
    }), () => {
      B = !0;
    };
  }, [i, c, a, s]), D(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let B = !1;
    return a.fetchRevisions(f).then((W) => {
      B || y(Dd(W, u));
    }).catch(() => {
    }), () => {
      B = !0;
    };
  }, [a, f, u, l]);
  const P = k.phase === "running" && k.seenActive;
  D(() => {
    if (k.phase === "running") {
      if (!l) {
        P || M({ phase: "running", seenActive: !0 });
        return;
      }
      P && M(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, P, l, t]);
  const C = U(() => {
    const B = new Map(d);
    if (w.renderedAt === u)
      for (const [W, j] of w.edits) B.set(W, j);
    return B;
  }, [d, w, u]), $ = N((B) => {
    const W = `${B || ""}`.trim();
    W && g({ itemId: W, page: Ad(W) });
  }, []), I = N(() => g(null), []), T = N((B, W) => {
    S((j) => {
      const Q = new Map(j.renderedAt === u ? j.edits : []);
      return Q.set(B, W), { renderedAt: u, edits: Q };
    }), v((j) => new Map(j).set(B, (j.get(B) || 0) + 1));
  }, [u]), E = N(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      M({ phase: "submitting" });
      try {
        await a.rerender(s), M({ phase: "running", seenActive: !1 }), await o();
      } catch (B) {
        M({ phase: "failed", message: (B == null ? void 0 : B.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), L = c ? ub : !l || k.phase === "running" || k.phase === "submitting" ? cb : "";
  return U(() => ({
    available: i,
    blockedReason: L,
    port: a,
    ownerJobId: f,
    target: h,
    select: $,
    close: I,
    memory: R,
    pendingEdits: C,
    savedCounts: b,
    markSaved: T,
    rerender: k,
    startRerender: E
  }), [i, L, a, f, h, $, I, R, C, b, T, k, E]);
}
function fb(e, t) {
  D(() => {
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
function mb(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = db({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = N((m, h) => {
    ks(c, m) && (t === "source" && i("compare"), h != null && h.trim() && l.set(m, h), s(m));
  }, [c, s, t, i, l]);
  fb(a.available ? u : null, n);
  const f = U(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const m = new Map(e.revisedBlocks);
    for (const [h, g] of a.savedCounts) m.set(h, (m.get(h) || 0) + g);
    return m;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const hb = "reader-finder-input";
function pb(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function gb(e, t = typeof window > "u" ? null : window) {
  D(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!pb(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(hb) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const Si = "retainpdf.reader.sidebar.v1", yb = ["search", "bookmarks", "issues"], bb = 900;
function vb() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(Si)) || "{}");
    return { tab: yb.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function wb(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(Si, JSON.stringify(e));
  } catch {
  }
}
function Sb() {
  const e = `(min-width: ${bb}px)`, [t, n] = x(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
  return D(() => {
    var a;
    if (typeof window > "u" || !window.matchMedia) return;
    const r = window.matchMedia(e), o = () => n(r.matches);
    return o(), (a = r.addEventListener) == null || a.call(r, "change", o), () => {
      var s;
      return (s = r.removeEventListener) == null ? void 0 : s.call(r, "change", o);
    };
  }, [e]), t;
}
function kb(e) {
  const [t] = x(vb), [n, r] = x(null), [o, a] = x(t.tab), i = Sb(), c = N((k) => {
    r(k), k && a(k);
  }, []);
  D(() => {
    wb({ tab: n || o });
  }, [n, o]);
  const l = N(() => r((k) => k ? null : o), [o]), u = N((k) => {
    r((M) => M === k ? null : k), a(k);
  }, []), [f, m] = x(""), [h, g] = x("");
  D(() => {
    const k = f.replace(/\s+/gu, " ").trim(), M = window.setTimeout(() => g(k), k ? 150 : 0);
    return () => window.clearTimeout(M);
  }, [f]);
  const [d, y] = x(0), w = N(() => {
    c("search"), y((k) => k + 1);
  }, [c]);
  gb(w);
  const S = N(() => {
    i || r(null);
  }, [i]), b = N((k) => {
    e.jumpToAnchor({ block_id: k }), S();
  }, [e.jumpToAnchor, S]), v = N((k) => {
    e.goToPage(k), S();
  }, [e.goToPage, S]);
  return {
    finder: n,
    setFinder: c,
    toggleFinder: u,
    toggleSidebar: l,
    pinned: i,
    findQuery: f,
    setFindQuery: m,
    findTerm: h,
    findFocus: d,
    jumpFromFinder: b,
    jumpToPageFromFinder: v
  };
}
function Tb(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ss(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Ib(e, t) {
  return t === null || e !== t;
}
function Eb(e, t) {
  const { boot: n } = e, r = A(null), o = A(null);
  D(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Ke(e.viewStateKey), s = Tb({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Rt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      Ib(e.mode, o.current) && (o.current = null, _n(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const Pb = [];
function Rb(e) {
  const { sessionFiles: t } = e, [n, r] = x({}), o = A({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = N((y, w) => {
    r((S) => ({ ...S, [w]: { url: o.current[w], nodes: y } }));
  }, []), s = U(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : Pb;
  }, [n, t.sourceUrl, t.translatedUrl]), i = A({}), [c, l] = x(0), u = N((y, w) => {
    i.current[w] = { url: o.current[w], pdf: y }, l((S) => S + 1);
  }, []), [f, m] = x(null), h = N((y) => m(y), []), g = N(() => m(null), []);
  D(() => m(null), [e.viewStateKey]);
  const d = U(() => {
    const y = (w, S) => {
      const b = i.current[w];
      return b && b.url === S ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: m, zoomBlock: h, closeZoom: g, zoomDocuments: d };
}
function Mb() {
  const e = Gu(), { boot: t, panes: n, session: r } = e, o = ly(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = ab(), { reserveRight: l } = c, u = i || l > 0, f = kb(e), { finder: m, findTerm: h } = f, g = !!m && f.pinned, [d, y] = x(!1), w = d && f.pinned, S = N(() => {
    s(null);
  }, []);
  sb(l, a, S);
  const { liveTranslationVisible: b, setLiveTranslationVisible: v, paneComposition: k, liveToggles: M, sourceViewOnly: R, visiblePdfMode: P } = rb(
    e,
    i,
    tb(e.shell.shellWidth, u || g || w)
  );
  Eb(e, R);
  const C = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: $, toggleDocDark: I } = Jy();
  nd({
    toggleDocDark: I,
    mode: P,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const { latestLivePage: T, jumpToLatestLivePage: E, offerCompletion: L, setCompletionDismissedKey: B, sourcePaneAction: W } = ob(e, {
    liveTranslationVisible: b,
    setLiveTranslationVisible: v,
    liveToggles: M,
    sourceViewOnly: R,
    visiblePdfMode: P
  }), j = N((V) => {
    const le = nb(V, e.liveTranslationAvailable);
    le !== null && v(le), e.setModeKeepingPage(V);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), Q = N((V) => {
    s(V);
  }, []), [ae] = x(fy), ne = N((V) => e.jumpToAnchor({ block_id: V }), [e.jumpToAnchor]), fe = Hy(e.sourceOnly ? "" : r.jobId, e.currentPage, ne), [se, be] = x(null), me = N((V, le) => e.jumpToAnchor({ block_id: V }, le), [e.jumpToAnchor]), { bookmarks: ue, onPdfOutline: ge, onPdfDocument: xe, zoomItem: z, setZoomItem: K, zoomBlock: ee, closeZoom: ie, zoomDocuments: ce } = Rb(e), { blockEdit: te, editBlock: de, revisedBlocks: ke } = mb(e, P, ae), [he, oe] = x(null), F = N(() => oe(null), []), q = zh({ documentId: r.documentId, jobId: r.jobId }), [O, J] = x(!1), re = O ? null : r.translatedLayout, Ee = U(
    () => ({ canHtml: !!r.translatedLayout, usePdf: O, setUsePdf: J }),
    [r.translatedLayout, O]
  ), {
    readerApi: Pe,
    contributionStore: $e,
    contributions: Ve,
    pageLayers: ze,
    compareVersion: Le,
    textMarks: Fe,
    menuSections: Be,
    pointerTakenId: et
  } = ib(e, c, {
    translationVersions: q,
    bookmarks: ue,
    regionHover: ae,
    assistantPanel: a,
    closeAssistant: S,
    visiblePdfMode: P,
    changeWorkspace: j,
    jumpToBlockIn: me,
    zoomDocuments: ce,
    editBlock: te.available && !te.blockedReason ? de : null,
    translatedPane: Ee,
    panelHost: se
  }), ct = !!et, [St, tt] = x([]), H = U(() => ({
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
    regionHover: ae,
    jumpToBlock: ne,
    revisedBlocks: ke,
    onPdfOutline: ge,
    onPdfDocument: xe,
    zoomBlock: ee,
    textMarks: Fe,
    pageLayers: ze,
    editBlock: te.available ? de : void 0,
    blockEdit: te,
    editShowsSource: P !== "compare",
    findTerm: m === "search" ? h : "",
    compareVersion: Le,
    translatedLayout: re,
    pointerTaken: ct,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: R,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: Q, close: S },
    docDark: $,
    toggleDocDark: I
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
    ae,
    ne,
    ke,
    ge,
    xe,
    ee,
    Fe,
    ze,
    te,
    de,
    P,
    m,
    h,
    Le,
    re,
    ct,
    e.sourceOnly,
    R,
    e.download,
    e.goToPage,
    Q,
    S,
    $,
    I
  ]), G = U(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Z = [
    es,
    `is-workspace-${C}`,
    i ? "is-assistant-open" : "",
    m ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    w ? "is-toc-docked" : "",
    k.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(jm, { api: Pe, store: $e, children: /* @__PURE__ */ p(Kf, { value: H, hud: G, children: /* @__PURE__ */ _(
    "div",
    {
      className: Z,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": C,
      "data-pointer-taken": et || void 0,
      onContextMenu: (V) => {
        const le = Uy(V);
        if (!le) return;
        const X = [
          ...My(e.viewStateKey),
          ...jo(Ve, { target: V.target, clientX: V.clientX, clientY: V.clientY, page: le.page })
        ];
        !X.length && !Be.length || (V.preventDefault(), tt(X), oe(le));
      },
      children: [
        /* @__PURE__ */ _("div", { className: "reader-workspace", children: [
          w ? /* @__PURE__ */ p(Ma, { bookmarks: ue, onJumpPage: e.goToPage, onJumpBlock: ne, pinned: !0, docked: !0, onPinChange: y }) : null,
          /* @__PURE__ */ p(Yy, { state: f, bookmarkScope: e.viewStateKey, issues: fe }),
          /* @__PURE__ */ _("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(
              Lm,
              {
                mode: P,
                documentReady: !!r.jobId,
                sourceViewOnly: R,
                onModeChange: j,
                compareExtra: /* @__PURE__ */ p(br, { place: "compare" }),
                liveTranslation: M.topBarPill ? {
                  visible: b,
                  state: e.liveTranslation,
                  onToggle: () => v((V) => !V),
                  latestPage: b ? T : null,
                  currentPage: e.currentPage,
                  onJumpToLatest: E
                } : null,
                completion: L ? {
                  onOpenCompare: () => {
                    B(e.viewStateKey), j("compare");
                  }
                } : null,
                start: /* @__PURE__ */ p(cd, { onBeforeClose: r.prepareClose })
              }
            ),
            w ? null : /* @__PURE__ */ p(Ma, { bookmarks: ue, onJumpPage: e.goToPage, onJumpBlock: ne, pinned: d, onPinChange: y }),
            /* @__PURE__ */ p(Ty, { active: a }),
            /* @__PURE__ */ p(Cy, { scope: e.viewStateKey, menuItemsAt: (V) => jo(Ve, V) }),
            /* @__PURE__ */ p(Tm, { paneComposition: k, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: W }),
            /* @__PURE__ */ p($g, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
            /* @__PURE__ */ p(
              iy,
              {
                mode: P,
                modeControls: null,
                bookmarkScope: e.viewStateKey,
                startSlot: /* @__PURE__ */ p(py, { open: m, onToggle: f.toggleSidebar, issueCount: fe.issues.length }),
                leftSlot: /* @__PURE__ */ p(Ky, { edit: te }),
                toolsSlot: /* @__PURE__ */ p(br, { place: "bottom" })
              }
            )
          ] }),
          /* @__PURE__ */ _(
            "aside",
            {
              className: "reader-dock",
              hidden: !u,
              "data-dock": i ? "panel" : l ? "extension" : void 0,
              style: !i && l ? { "--reader-dock-width": `${l}px` } : void 0,
              "aria-label": "阅读辅助面板",
              children: [
                /* @__PURE__ */ p(qp, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: be })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p(Lg, {}) : null,
        /* @__PURE__ */ p(
          Zy,
          {
            session: r,
            zoomDocuments: ce,
            translatedLayout: re,
            zoomItem: z,
            setZoomItem: K,
            closeZoom: ie,
            visiblePdfMode: P
          }
        ),
        /* @__PURE__ */ p(Wy, { menu: he, onClose: F, actions: St, sections: Be }),
        /* @__PURE__ */ p(Vm, { extensions: $r }),
        /* @__PURE__ */ p(dy, {})
      ]
    }
  ) }) });
}
function Yb() {
  return /* @__PURE__ */ p(Mb, {});
}
export {
  Yb as R,
  Mb as a,
  Jb as b,
  Gb as c,
  ph as d,
  yh as e,
  io as f,
  qb as g,
  Kb as h,
  Vb as r,
  Xb as s,
  je as u
};
//# sourceMappingURL=ReaderApp-CTa_rVJi.js.map
