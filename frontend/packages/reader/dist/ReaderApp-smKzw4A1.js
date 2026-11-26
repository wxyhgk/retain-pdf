var kr = (e) => {
  throw TypeError(e);
};
var Ir = (e, t, n) => t.has(e) || kr("Cannot " + n);
var Ct = (e, t, n) => (Ir(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Tr = (e, t, n) => t.has(e) ? kr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Rr = (e, t, n, r) => (Ir(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as C, jsx as p, Fragment as yt } from "react/jsx-runtime";
import { useMemo as Z, useState as P, useEffect as z, useCallback as L, useRef as _, useLayoutEffect as Re, memo as pn, createContext as Gn, useContext as Xn, forwardRef as xo, useImperativeHandle as Zn, useSyncExternalStore as Do, useId as Co, Suspense as zo, lazy as Oo } from "react";
import { requireAdapter as Dt, getReaderAdapters as Le } from "./adapters.js";
import { resolveReaderDownloadName as as, resolveReaderDownloadUrls as ss, READER_PROGRESS_COPY as qe, trimString as sn, READER_DOWNLOAD_ACTIONS as is, disabledReason as cs } from "./runtime/state.js";
import { r as ls, b as us } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as An, isFinishedJobStatus as Vt } from "@retainpdf/domain/job";
import { n as $o, d as ds, f as vn, k as Er, b as fs, c as ms, j as xe, p as vt, g as hs, l as At, i as ps } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as gs } from "@retainpdf/api/documents";
import { isReaderTransportError as bs, createReaderTransportError as ys } from "./contracts.js";
import { X as wt, PenLine as Yn, ZoomIn as vs, Check as Fo, Copy as ws, ChevronUp as Ss, ChevronDown as Bo, History as ks, LoaderCircle as Is, Pin as Ts, LogOut as Rs, FileText as jo, Columns2 as Ho, Languages as Uo, Radio as Es, ArrowDownToLine as Ps, CheckCircle2 as Ms, Keyboard as _s, Download as Ns, ListOrdered as As, TriangleAlert as Ls, ChevronRight as Wo, ListTree as xs, Search as Ds, GitCompareArrows as Cs, LayoutGrid as zs, Highlighter as Os, Eraser as $s, Undo2 as Fs, Trash2 as Bs, ChevronLeft as js, Minus as Hs, Plus as Us, ArrowLeft as Ws } from "lucide-react";
import { Button as re, Textarea as Ks, IconButton as mt, Input as Ko } from "@retainpdf/ui";
import { toast as Ln, Toaster as Vs } from "sonner";
import { pdfjs as Vo, Page as qs, Document as Js } from "react-pdf";
import { e as Gs, m as Xs, a as Zs } from "./markdown-math-XkF5urpn.js";
const Ys = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Qs = "", ei = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ti = (e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, lp = (...e) => {
  var n;
  return (((n = Le()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, up = () => {
  var e, t;
  return ((t = (e = Le()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Je = () => Dt("defaultReaderDataPort"), Pr = () => Dt("defaultReaderPageConfigPort"), dp = {
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
}, qo = {
  messageTargetOrigin: () => Pr().messageTargetOrigin(),
  readerJobId: () => Pr().readerJobId()
}, ni = () => {
  var e;
  return ((e = Le()) == null ? void 0 : e.liveTranslation) ?? null;
}, qt = () => {
  var t;
  const e = Le();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Qe = () => {
  const e = Le();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Dt("fetchDocumentByJobId")(...n),
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
}, ri = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, oi = () => {
  var e, t;
  return ((t = (e = Le()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ai = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, si = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? as(...e);
}, ii = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ss(...e);
}, ci = (...e) => Dt("downloadProtectedResource")(...e), li = (...e) => Dt("failDownloadToast")(...e), fp = (e, t) => Dt("resolveMarkdownAssetUrl")(e, t), Mr = "/api/v1";
function ui() {
  const e = () => {
    var r;
    return ls(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = P(e);
  return z(() => {
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
function di() {
  const e = ui(), t = Z(() => ai(qo), [e]), n = Z(() => oi(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function fi(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = P({
    documentId: "",
    jobId: ""
  }), [u, f] = P({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, y] = P({
    jobId: "",
    documentId: ""
  }), w = h.jobId === g ? h.documentId : "", S = t || w, b = !!t && !g, [v, k] = P(null), R = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, N = b || !!R, F = L((A) => {
    const I = `${A.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${A.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  z(() => {
    k((A) => A && A.sessionIdentity !== r ? null : A);
  }, [r]);
  const O = L((A) => {
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
    activeCommittedDocumentSource: R,
    sourceViewOnly: N,
    refreshCommittedDocument: F,
    applyIdentityEvent: O
  };
}
function _r(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function mi(e) {
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
function Nr(e, t) {
  return ti(An(e, t));
}
function hi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function pi(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !hi(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function xn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ei.progress,
        stage: n,
        percent: e,
        text: t
      },
      qo.messageTargetOrigin()
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
  }), xn({ percent: t, text: n, stage: r });
}
function gi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = P(null), [l, u] = P(null), [f, d] = P(""), [m, g] = P(0), h = f === n ? i : null, y = f === n ? l : null, w = _r(h), S = Vt(w), b = L(() => {
    g((O) => O + 1);
  }, []), v = L((O) => {
    c(O.jobPayload), u(O.manifestPayload), d(O.sessionIdentity);
  }, []), k = L((O) => {
    c(null), u(null), d(O);
  }, []), R = _(""), N = _(""), F = L(async () => {
    const O = o.current;
    if (!O || R.current === O) return;
    const A = Qe().loadJobPayload;
    if (typeof A != "function") return;
    const I = a.current.value;
    R.current = O;
    try {
      const T = await A(O);
      if (s.current || a.current.value !== I || o.current !== O || !T || typeof T != "object")
        return;
      const E = _r(T);
      c(T), d(r.current), !Vt(E) && N.current === O && (N.current = ""), E === "succeeded" && N.current !== O && (N.current = O, g((x) => x + 1));
    } catch {
    } finally {
      R.current === O && (R.current = "");
    }
  }, []);
  return z(() => {
    N.current = "";
  }, [n]), z(() => {
    if (!t || S || !h) return;
    const O = window.setInterval(() => {
      document.visibilityState !== "hidden" && F();
    }, 1e3);
    return () => window.clearInterval(O);
  }, [S, F, h, t]), {
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
    refreshJobStatus: F,
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
function bi(e, t) {
  e(t), Dn(t);
}
function yi(e) {
  const [t, n] = P(e ? "source" : "compare"), r = L((a) => {
    e && a !== "source" || (n(a), Dn(a));
  }, [e]), o = L((a) => {
    bi(n, a);
  }, []);
  return z(() => (e && document.documentElement.classList.add("reader-source-only"), Dn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Ar(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function vi(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Ar(n.active_job_id),
    activeVersionId: Ar(n.active_version_id)
  };
}
function wi(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Si(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function ki(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ii = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ti(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ii.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Ri = 48 * 1024 * 1024;
function Ei(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Pi = 2, Ae = /* @__PURE__ */ new Map();
function Cn(e, t) {
  Ae.delete(e), Ae.set(e, t);
}
function Lr(e) {
  if (Ae.size < Pi) return;
  const t = Ae.keys().next().value;
  t && Ae.delete(t);
}
async function Mi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Jo(e, t = qt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Ae.has(r)) {
    const b = Ae.get(r);
    return Cn(r, b), b;
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
    const v = await Mi(s);
    throw v && (b.reason = v), b;
  }
  const i = _i(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Lr(), Ae.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Ae.has(r) ? Cn(r, l) : (Lr(), Ae.set(r, l)), l;
}
function _i(e, t, n) {
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
const Ni = { file: null, loading: !1, error: "" }, Ai = { file: null, loading: !0, error: "" };
function Li(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = P(null);
  if (z(() => {
    if (t || !n) return;
    const s = Ae.get(n);
    if (s) {
      Cn(n, s);
      return;
    }
    const i = new AbortController();
    return Jo(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ni;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Ae.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ai;
}
function xi(e) {
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
async function zn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  cn(s, r, n, "download");
  const i = await Jo(t, qt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (cn(s, o, n, "download"), i);
}
async function Di(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  cn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    zn({
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
    zn({
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
function Ci(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function zi({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = gs,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Ci(o.href, t, a)), !0);
}
const Qt = {
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
  } = e, [S, b] = P(""), [v, k] = P(""), [R, N] = P(null), [F, O] = P(null), [A, I] = P(!1), [T, E] = P(""), [x, D] = P([]), [U, M] = P(!1), [H, V] = P(() => ({
    source: null,
    translated: null
  })), [Y, $] = P(
    Qt
  ), [K, q] = P({
    loading: !0,
    percent: 4,
    text: qe.boot,
    stage: "progress",
    failed: !1
  });
  return z(() => {
    const te = new AbortController(), ue = h.current.value, J = xi({
      sessionEpochRef: h,
      closingRef: y,
      abort: te,
      sessionEpoch: ue
    });
    w.current = te;
    const oe = Qe();
    if (y.current)
      return te.abort(), () => {
        w.current === te && (w.current = null);
      };
    let fe = !1;
    function se(ce, pe) {
      J.markFailed(), M(!0), q({
        loading: !1,
        percent: 100,
        text: ce,
        stage: "failed",
        failed: !0
      }), xn({ percent: 100, text: pe, stage: "failed" });
    }
    function be() {
      I(!0), fe || M(!0), q({
        loading: !1,
        percent: 100,
        text: qe.ready,
        stage: "ready",
        failed: !1
      }), xn({ percent: 100, text: qe.ready, stage: "ready" });
    }
    function he() {
      return l != null && l.documentId ? Nr(
        l.documentId,
        l.revision
      ) : Ys() ? Qs : oe.resolveResourceUrl(An(r));
    }
    async function We() {
      var ne;
      let ce = { activeJobId: "", activeVersionId: "" };
      try {
        const ie = await ((ne = oe.fetchDocument) == null ? void 0 : ne.call(oe, r));
        ie && (ce = vi(ie));
      } catch {
      }
      const pe = wi({
        link: ce,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (pe.kind === "follow-active-job") {
        if (J.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: pe.jobId
        }), pe.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: pe.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (pe.kind === "open-committed-source") {
        if (J.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: pe.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ye = he();
      if (J.isInactive()) return;
      b(ye), k(""), E(""), d(c);
      const j = await zn({
        url: ye,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: J,
        setBoot: q
      });
      if (!J.isInactive()) {
        if (!j) {
          se("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        N(j), be();
      }
    }
    async function tt() {
      var ut;
      const ce = !l, pe = !!(ce && oe.loadSessionSnapshot && oe.loadReaderOptionalArtifacts), ye = pe ? oe.loadReaderOptionalArtifacts(t) : null, j = await ((ut = oe.loadSessionSnapshot) == null ? void 0 : ut.call(oe, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ce && !pe
      })), ne = j ? {
        jobPayload: j.sourcePayload,
        manifestPayload: j.manifestPayload,
        readerMetadata: j.readerMetadata,
        regionsPayload: j.regions,
        readerErrors: j.readerErrors
      } : await oe.loadReaderPayload(t, {
        includeOptionalArtifacts: ce
      });
      if (J.isInactive()) return;
      let ie = null;
      if (n && !r)
        if (j && j.linkedDocument !== void 0)
          ie = j.linkedDocument;
        else {
          try {
            ie = await oe.fetchDocumentByJobId(Mr, t);
          } catch {
          }
          if (J.isInactive()) return;
        }
      const Ce = mi(ne.jobPayload) || `${(ie == null ? void 0 : ie.document_id) || ""}`.trim();
      Ce && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ce
      });
      const Ee = Si({
        payloadDocumentId: Ce,
        linkedActiveJobId: `${(ie == null ? void 0 : ie.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ie == null ? void 0 : ie.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ee.kind === "restore-committed-source") {
        if (J.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Ee.documentId,
          revision: Ee.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Pe = oe.resolveReaderSourcePdf(ne.manifestPayload), ze = oe.resolveReaderTranslatedPdfUrl(ne.jobPayload, ne.manifestPayload), Me = typeof Pe == "string" ? Pe : oe.resolveReaderArtifactUrl(Pe), Oe = r || Ce, we = l != null && l.documentId ? Nr(
        l.documentId,
        l.revision
      ) : Me || (Oe ? oe.resolveResourceUrl(An(Oe)) : ""), _e = l ? "" : ze || "";
      b(we || ""), k(_e), E(pi(ne.jobPayload, t)), f({
        jobPayload: ne.jobPayload || null,
        manifestPayload: ne.manifestPayload || null,
        sessionIdentity: c
      });
      const Fe = () => Di({
        sourceFinal: we || "",
        translatedFinal: _e,
        fence: J,
        setBoot: q
      }), Ke = !!(we || _e), Be = ye && Ke ? Fe() : null;
      Be == null || Be.catch(() => {
      });
      const Ne = (B) => {
        J.isInactive() || (D(l ? [] : $o(B.regionsPayload)), V(l ? { source: null, translated: null } : ds(B.readerMetadata)), $(l ? Qt : B.readerErrors ?? Qt), M(!0));
      };
      if (ye ? (fe = !0, ye.then(Ne)) : Ne(ne), !Ke) {
        se(qe.failed, qe.failed);
        return;
      }
      const nt = await (Be ?? Fe());
      if (nt.status !== "inactive") {
        if (nt.status === "incomplete") {
          se("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        N(nt.sourceBytes), O(nt.translatedBytes), be();
      }
    }
    async function De() {
      I(!1), N(null), O(null), D([]), M(!1), V({ source: null, translated: null }), $(Qt), cn(q, 8, qe.metadata, "metadata");
      try {
        if (s) {
          await We();
          return;
        }
        if (!t) {
          se(qe.failed, qe.failed);
          return;
        }
        await tt();
      } catch (ce) {
        if (J.isClosedOrStale() || (ce == null ? void 0 : ce.name) === "AbortError") return;
        J.markFailed();
        const pe = Number(ce == null ? void 0 : ce.status), ye = `${(ce == null ? void 0 : ce.reason) || ""}`, j = Ti({ status: pe, reason: ye, sessionJobId: t });
        if (j && (await zi({
          apiPrefix: Mr,
          documentId: j,
          expiredJobId: t
        }) || J.isClosedOrStale()))
          return;
        if (ki({
          status: pe,
          reason: ye,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const ne = ce instanceof Error ? ce.message : qe.failed;
        se(ne, ne);
      }
    }
    return De(), () => {
      te.abort(), w.current === te && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: R,
    translatedFile: F,
    assetsReady: A,
    title: T,
    regions: x,
    regionsSettled: U,
    readerMetadata: H,
    readerErrors: Y,
    boot: K
  };
}
function $i() {
  const e = _(!1), t = _(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = di(), s = _({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = _(a), c = _(""), l = _(""), u = _(() => {
  }), f = L(() => u.current(), []), d = fi({
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
  } = d, { mode: w, setMode: S, switchSessionMode: b } = yi(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const v = gi({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: R,
    jobStatus: N,
    jobTerminal: F,
    jobRefreshRevision: O,
    refreshJobArtifacts: A,
    refreshJobStatus: I
  } = v, T = Oi({
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
  }), E = L(() => {
    var D;
    e.current = !0, (D = t.current) == null || D.abort();
  }, []), x = Z(
    () => ({
      fetchProtected: Qe().fetchProtected,
      jobId: m,
      jobPayload: k,
      manifestPayload: R,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: y
    }),
    [m, k, R, T.sourceUrl, T.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: N,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: F,
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
    download: x,
    refreshJobArtifacts: A,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: E
  };
}
const Fi = 160, Bi = 8, ji = 0;
function Hi() {
  const e = _(null), [t, n] = P(null), [r, o] = P(ji), a = L((s) => {
    e.current = s, n(s);
  }, []);
  return z(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Fi || o((u) => Math.abs(u - l) < Bi ? u : l);
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
function Ui(e) {
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
function Wi(e, t) {
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
  const [f, d] = P(() => ({
    identity: l,
    pages: wn
  })), [m, g] = P(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : wn, y = m.identity === l ? m.tick : 0, w = Ui({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = w, b = L((I, T) => {
    u.current === l && d((E) => {
      const x = E.identity === l ? E.pages : wn;
      return x[T] === I && E.identity === l ? E : {
        identity: l,
        pages: { ...x, [T]: I }
      };
    });
  }, [l]), v = _(null), k = L(() => {
    v.current && clearTimeout(v.current);
    const I = l;
    v.current = setTimeout(() => {
      v.current = null, u.current === I && g((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  z(() => (v.current && (clearTimeout(v.current), v.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [l]);
  const R = Z(
    () => Math.max(h.source, h.translated),
    [h]
  ), N = S === "translated" ? h.translated : h.source || h.translated, F = t == null ? void 0 : t.userZoom, O = t == null ? void 0 : t.shellWidth, A = `${l}-${y}-${F}-${n}-${h.source}-${h.translated}-${O}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: R,
    primaryNumPages: N,
    metricsTick: y,
    onNumPages: b,
    onMetrics: k,
    rowSyncRevision: A
  };
}
const Te = "data-reader-page", ke = "data-reader-pane", Qn = "data-natural-height", Ki = "reader-react-root", Go = "reader-react-grid", Xo = "reader-react-scroll-shell", gn = "reader-react-pdf-pane", Zo = "reader-react-pdf-page", ln = "reader-react-pdf-page-placeholder", er = "reader-react-pdf-page-slot";
function un(e, t) {
  const n = e != null ? `[${Te}="${e}"]` : `[${Te}]`;
  return t ? `${n}[${ke}="${t}"]` : n;
}
function tr() {
  return `.${er}[${Te}]`;
}
function dn(e) {
  return Number(e.getAttribute(Te));
}
const Yo = 0.25, fn = 1, Vi = 0.05, Yt = 0.5, qi = 16, Ji = 8, Qo = qi + Ji, Gi = 720;
function it() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ea(e) {
  return Number.isFinite(e) && e < Gi;
}
function Pt(e, t = Number.POSITIVE_INFINITY) {
  return ea(t) && (e === "source" || e === "translated") ? fn : Yt;
}
function Ze(e) {
  return Number.isFinite(e) ? Math.min(fn, Math.max(Yo, e)) : Yt;
}
function Jt(e, t) {
  const n = Ze(Number(e) + t * Vi);
  return Math.round(n * 100) / 100;
}
function Xi(e) {
  return Math.round(Ze(e) * 100);
}
function ta(e) {
  const n = (Number(e) || 0) - Qo;
  return Math.max(160, Math.floor(n));
}
function Zi(e, t = Yt) {
  const n = Ze(t);
  return ta((Number(e) || 0) * n);
}
function Yi(e, t) {
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
const Qi = 8;
function ec(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Qi ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const na = 200, ra = [
  "markdown"
], tc = ra;
function oa(e) {
  return tc.includes(e);
}
const nc = "retainpdf:reader:view:v1:", xr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), rc = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function aa() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function On(e) {
  return `${e || ""}`.trim();
}
function oc({
  documentId: e,
  jobId: t
}) {
  const n = On(e);
  if (n) return `document:${n}`;
  const r = On(t);
  return r ? `job:${r}` : "";
}
function sa(e) {
  const t = On(e);
  return t ? `${nc}${t}` : "";
}
function ac(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function sc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!xr.has(t) || !xr.has(n) || t === n))
    return { left: t, right: n };
}
function ic(e) {
  return e === null ? null : oa(e) ? e : void 0;
}
function cc(e) {
  return rc.has(e) ? e : void 0;
}
function ia(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = ac(t.anchor), r = Number(t.zoom), o = cc(t.mode), a = sc(t.splitLayout), s = ic(t.assistantPanel);
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
function Ue(e, t = aa()) {
  const n = sa(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ia(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function bn(e, t, n = aa()) {
  const r = sa(e);
  if (!r || !n) return null;
  const o = Ue(e, n), a = ia({
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
function lc(e, t, n = "") {
  var d;
  const [r, o] = P(() => {
    var m;
    return ((m = Ue(n)) == null ? void 0 : m.zoom) ?? Pt(e, it());
  }), a = _(r), s = _(n);
  a.current = r;
  const i = _(1), c = _(((d = Ue(n)) == null ? void 0 : d.zoom) !== void 0);
  z(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Ue(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? Pt(e, it());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), z(() => {
    if (c.current) return;
    const m = Pt(e, it()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = L((m, g) => {
    const h = Ze(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, bn(s.current, { zoom: h }), o(h));
  }, []), u = L((m) => {
    l(Jt(a.current, m));
  }, [l]), f = L((m) => {
    l(Pt(m));
  }, [l]);
  return Re(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Yi(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const uc = 160, dc = 3e-3, Dr = 50, fc = 16, mc = 800;
function hc(e, t = 0) {
  const n = t === 1 ? fc : t === 2 ? mc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Dr, Math.min(Dr, r));
  return Math.exp(-o * dc);
}
function pc(e, t, n = 0) {
  return Ze(e * hc(t, n));
}
function gc(e) {
  return Math.round(Ze(e) * 100) / 100;
}
function bc(e, t, n) {
  const r = Ze(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ze(t) / r;
  const a = (o + Qo) / r;
  return ta(a * Ze(t)) / o;
}
function yc(e) {
  return Array.from(e.querySelectorAll(tr()));
}
function vc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function wc(e, t, n) {
  let r = null;
  for (const s of yc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = vc(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Te) || "",
    pane: o.getAttribute(ke) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Sc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ca(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${tr()}[${Te}="${t.page}"][${ke}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Sc(n, e).scrollLeft += a);
}
function kc(e, t, n, r) {
  const o = e.querySelector(`.${Go}`);
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
const Ic = 600, Tc = 1e3;
function Rc(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ca(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Tc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Ec(e, t, n) {
  const r = _(t);
  r.current = t;
  const o = _(n);
  o.current = n;
  const a = _(null), s = _(null), i = _(null);
  z(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = gc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        zt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, zt(d.grid));
      }, Ic), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, zt(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: wc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = pc(f.target, u.deltaY, u.deltaMode);
      const d = bc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = kc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, uc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), zt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Re(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), zt(c.grid), !(!e || !c.anchor) && (ca(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Rc(e, c.anchor)));
  }, [t, e]);
}
function Pc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = _(t), a = _(n), s = _(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: L((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const nr = 48;
function la(e, t = nr) {
  return e.getBoundingClientRect().top + t;
}
function ua(e, t) {
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
function Wt(e, t, n = nr) {
  if (!e)
    return null;
  const r = un(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = la(e, n), i = ua(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Lt(e, t, n = "auto", r, o = nr) {
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
function Mc(e, t, n = "smooth", r) {
  return Lt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function $n(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var u;
    if (a) return;
    Lt(
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
function _c(e, t, n) {
  return $n(
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
function $e(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Nc(e, t, n = !0, r = "", o) {
  const [a, s] = P(1);
  return z(() => {
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
      const y = la(i), w = ua(h, y);
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
const Ac = `canvas, .react-pdf__Page, .${Zo}, .${ln}`, Cr = /* @__PURE__ */ new WeakMap();
function Lc(e) {
  const t = Number(e.getAttribute(Qn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Cr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Ac), Cr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function xc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Dc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(tr()).forEach((r) => {
    const o = dn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Lc(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Cc(e, t, n = "", r) {
  const [o, a] = P(() => /* @__PURE__ */ new Map()), s = _(o), i = _(r);
  return i.current = r, Re(() => {
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
      const v = Dc(b);
      xc(s.current, v) || (s.current = v, a(v)), u && !f && (f = !0, (k = i.current) == null || k.call(i));
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
const zc = [0, 48, 140, 320, 560], Oc = 700, $c = [80, 200, 400], Fc = 500, Bc = 50, jc = /* @__PURE__ */ new Set([
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
]), Hc = 180, zr = [0, 48, 140, 320, 700, 1200];
function Uc(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = _(
    ((T = Ue(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = _(null), l = _(!1), u = _(r), f = _(null), d = _(null), m = _(null), g = _(null), h = _(a), y = _(""), w = _(n);
  w.current = n;
  const S = L(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = L(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), v = L((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const x = () => {
      g.current = null, bn(h.current, {
        anchor: $e(i.current)
      });
    };
    E ? x() : g.current = setTimeout(x, Hc);
  }, []), k = L((E) => {
    i.current = $e(E), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Bc);
  }, []);
  z(() => {
    if (!o)
      return;
    let E = !1, x = null, D = null, U = null;
    const M = () => {
      if (E) return;
      const H = e.current;
      if (!H) {
        U = setTimeout(M, 50);
        return;
      }
      x = H, D = () => {
        if (l.current)
          return;
        const V = Wt(x, w.current);
        V && (i.current = V, v());
      }, x.addEventListener("scroll", D, { passive: !0 }), l.current || D();
    };
    return M(), () => {
      E = !0, U != null && clearTimeout(U), x && D && x.removeEventListener("scroll", D);
    };
  }, [o, r, n, e, v]), z(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const x = (D) => {
      D.metaKey || D.ctrlKey || D.altKey || jc.has(D.key) && b();
    };
    return E.addEventListener("wheel", b, { passive: !0 }), E.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", x), () => {
      E.removeEventListener("wheel", b), E.removeEventListener("touchmove", b), window.removeEventListener("keydown", x);
    };
  }, [o, e, b]), Re(() => {
    var x;
    if (h.current === a) return;
    v(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const E = (x = Ue(a)) == null ? void 0 : x.anchor;
    i.current = E ? $e(E) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, v, S]), z(() => {
    var x;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const E = $e(
      ((x = Ue(a)) == null ? void 0 : x.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, c.current = E, l.current = !0, S(), f.current = $n(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: zr,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Math.max(...zr) + 160), () => S();
  }, [o, s, a, e, k, S]), z(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const E = c.current ? $e(c.current) : $e(i.current);
    return l.current = !0, c.current = E, i.current = E, S(), f.current = $n(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: zc,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Oc), () => {
      S();
    };
  }, [r, o, n, e, k, S]), z(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), v(!0);
  }, [S, v]);
  const R = L(() => {
    const E = Wt(
      e.current,
      w.current
    );
    return $e(E || i.current);
  }, [e]), N = L(() => {
    l.current = !0;
    const E = Wt(
      e.current,
      w.current
    ), x = $e(E ?? i.current);
    return i.current = x, c.current = x, v(), x;
  }, [e, v]), F = L((E, x, D) => {
    const U = D || w.current, M = mn(E, x || 1), H = { page: M, fraction: 0 };
    i.current = H, l.current = !0, c.current = H, v(), S(), Mc(e.current, M, "smooth", U), f.current = _c(
      () => e.current,
      M,
      {
        behavior: "auto",
        pane: U,
        delaysMs: $c,
        onDone: () => k(H)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(H);
    }, Fc);
  }, [e, k, S, v]), O = L(() => $e(i.current), []), A = L(() => l.current, []), I = L(() => {
    if (!l.current || !c.current)
      return;
    const E = $e(c.current);
    Lt(
      e.current,
      E,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: R,
    beginModeSwitch: N,
    goToPage: F,
    getAnchor: O,
    isRestoring: A,
    repinIfRestoring: I
  };
}
function Wc(e, t) {
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
function da(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Kc = [0, 80, 200, 400, 800], Vc = 120, qc = 400;
function Jc(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = _(a);
  f.current = a;
  const d = _(s);
  d.current = s;
  const m = _(i);
  m.current = i;
  const g = _(n);
  g.current = n, z(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = ri(), y = Wc(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const w = da(h, y, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, h && ((k = m.current) == null || k.call(m, h, y));
    const S = [];
    let b = 0;
    for (const R of Kc)
      b = Math.max(b, R), S.push(
        setTimeout(() => {
          f.current(y);
        }, R)
      );
    return S.push(
      setTimeout(() => {
        var R;
        (R = g.current) == null || R.call(g);
      }, b + Vc)
    ), () => {
      for (const R of S) clearTimeout(R);
    };
  }, [r, o, c, l, t, u]);
}
function Gc(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Xc(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = qc,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = _(a);
  u.current = a;
  const f = _(l);
  f.current = l;
  const d = _(0);
  z(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = us(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = da(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || Gc)(h);
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
function Zc(e) {
  const t = _(""), [n, r] = P(!1), o = L(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Jc(a, t, o), Xc(e, t, n);
}
const Ot = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Yc(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Or(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function fa(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Or(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Or(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Qc(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = fa(r, t, n);
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
function el(e) {
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
function tl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function nl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function rl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function ol(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const $r = [250, 500, 1e3, 2e3, 4e3], Sn = [80, 160, 320, 640, 1e3, 1500], Fr = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
function rr(e) {
  return bs(e) ? `${e.code || ""}`.trim() : "";
}
function en(e, t) {
  const n = rr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function al(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (fa(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = ys(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = rr(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Sn[Math.min(s, Sn.length - 1)];
    if (await Fn(i, r), s >= Sn.length + 2) throw a;
  }
}
function sl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = P(Ot), s = _(o), i = _("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Vt(l) ? l : "";
  return z(() => {
    if (!n || !c) {
      i.current = "", s.current = Ot, a(Ot);
      return;
    }
    const f = r === void 0 ? ni() : r, d = i.current === c;
    if (i.current = c, !f) {
      const b = {
        ...d ? s.current : Ot,
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
      ...d ? s.current : Ot,
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
            layoutByPage: Yc(v),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = rr(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            y((N) => ({
              ...N,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: en(v, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((N) => ({
              ...N,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((N) => ({
            ...N,
            connection: "connecting",
            jobStatus: l,
            error: en(v, "正在等待 OCR 版面数据")
          })), await Fn($r[Math.min(b, $r.length - 1)], m.signal).catch(() => {
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
                k = await al(
                  c,
                  v,
                  s.current,
                  m.signal,
                  f
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || m.signal.aborted) throw R;
                y((N) => ({
                  ...N,
                  lastSeq: Math.max(N.lastSeq, v.seq),
                  error: en(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((R) => {
                const N = Qc(R, v, k);
                return u ? {
                  ...N,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...N,
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
        await Fn(Fr[Math.min(b, Fr.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function il(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function cl(e, t = !0) {
  const [n, r] = P(() => /* @__PURE__ */ new Map());
  return z(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Qe().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(il(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const ll = 4500;
function ul(e) {
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
const dl = /* @__PURE__ */ new Set(["book", "translate"]);
function ma(e) {
  return !!(e.jobId && e.sourceUrl && dl.has(e.workflow));
}
function fl(e) {
  return !!(ma(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function ml() {
  const e = $i(), t = ma({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = fl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = _({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Vt(o) && (r.current.running = !0);
  const a = sl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = Hi(), u = cl(e.jobId, !e.sourceOnly), f = oc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = lc(e.mode, s, f);
  Ec(i, m, g);
  const h = Wi(
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
  } = Uc(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  z(() => {
    S();
  }, [c, S]);
  const b = Cc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), v = Nc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), k = L((M, H) => {
    var Y, $;
    const V = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Y = h.numPagesByPane) == null ? void 0 : Y.source) || 0,
      Number(($ = h.numPagesByPane) == null ? void 0 : $.translated) || 0
    );
    w(M, V, H);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, N] = P(null), F = _(null), O = L((M) => {
    F.current && clearTimeout(F.current), N(M), M && (F.current = setTimeout(() => N(null), ll));
  }, []);
  z(() => () => {
    F.current && clearTimeout(F.current);
  }, []);
  const A = L((M) => {
    const H = vn(e.regions, M);
    return H ? Er(H, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = L((M, H) => {
    const V = H || h.primaryPane, Y = typeof M == "object" && M ? `${M.block_id || ""}`.trim() : "", $ = typeof M == "object" && M ? `${M.image_url || ""}`.trim() : "", K = typeof M == "object" && M ? M.page_idx != null ? Number(M.page_idx) + 1 : M.page != null ? Number(M.page) : null : typeof M == "number" ? M + 1 : null, q = fs(e.regions, $, K) || vn(e.regions, Y) || (typeof M == "object" ? ms(e.regions, M) : null);
    let te = q ? Er(q, V).page : null;
    te == null && (te = ul(M)), !(te == null || te < 1) && (O(q), k(te, V));
  }, [O, k, h.primaryPane, e.regions]);
  Zc({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: v,
    goToPage: k,
    resolveBlockPage: A,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (M) => {
      O(vn(e.regions, M.blockId));
    }
  });
  const { setModeKeepingPage: T } = Pc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  z(() => {
    O(null);
  }, [d, O]);
  const E = !e.boot.loading && !e.boot.failed, x = Z(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), D = Z(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), U = Z(() => ({
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
    goToPage: k,
    activeRegion: R,
    jumpToAnchor: I,
    setModeKeepingPage: T,
    download: e.download,
    showHud: E,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, x, h, D, b, k, R, I, T, E, m, g, f, a, n, u]);
  return Z(() => ({
    ...U,
    currentPage: v
  }), [U, v]);
}
const hl = [
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
], pl = [
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
function gl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of hl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function bl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const yl = ".reader-notes-panel";
function vl(e) {
  return e instanceof Element ? !!e.closest(yl) : !1;
}
function wl(e) {
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
  z(() => {
    if (!u)
      return;
    const f = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || bl(d.target) || vl(d.target))
        return;
      const m = d.key, g = gl(m);
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
              a(Pt(t, it()));
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
const Sl = "retainpdf:soft-reader-close";
function kl() {
  return new URL("./index.html", window.location.href).href;
}
function Il() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Sl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Tl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Rl() {
  if (!(typeof window > "u") && !Il()) {
    if (Tl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(kl());
  }
}
function El({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Pl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ C(El, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Rl();
  }, children: [
    /* @__PURE__ */ p(wt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Ml = 3e3, _l = 8;
async function Nl(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Al(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Ll(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Ml;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Al(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < _l && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Nl(e, i);
  })), a;
}
function ha(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function pa(e, t) {
  let n = null;
  for (const r of ha(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function Br(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let jr = !1;
function xl() {
  if (jr)
    return;
  const e = qt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Vo.GlobalWorkerOptions.workerSrc = e, jr = !0);
}
function Dl({
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
      re,
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
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Cl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, zl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Ol = {
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
}, Hr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function $l(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Hr(o ?? a ?? "", Cl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Hr(o ?? a ?? "", zl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Ol[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Fl(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const Bl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function jl(e) {
  const t = [];
  for (const n of e) {
    if (!Bl(n)) continue;
    const r = $l(Fl(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Hl(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Ul = 24, Wl = 60;
function Ur(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Ul), o = Math.min(e.length, n + t.length + Wl), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Kl(e, t, n = 200) {
  const r = st(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = st(a.translatedBlockText) || st(a.translated.text), c = i ? Ur(i, r) : null, l = c ?? Ur(st(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function tn(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Bt(e, t) {
  const n = st(t).toLowerCase();
  if (!n || !e) return tn(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${tn(e.slice(a, s))}<mark class="reader-find-mark">${tn(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + tn(e.slice(a));
}
function Vl(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const ga = "reader-xref", Bn = "data-xref", jt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, ql = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${jt})`), Jl = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function jn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Gl(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Xl(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Zl(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = xe(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Yl(e, t, n) {
  return (e.find((o) => xe(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Ql(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = xe(r), s = Xl(r);
    if (a === "formula") {
      for (const g of s.matchAll(Jl)) {
        const h = jn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = ql.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = Gl(i[1]), u = jn(i[2]), f = Zl(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Yl(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const eu = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${jt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${jt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${jt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${jt})\s*[）)]`, "g"), kind: () => "equation" }
];
function tu(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of eu) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = jn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function nu(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function ru(e, t, n = "") {
  const r = tu(e, t);
  if (!r.length) return Bt(e, n);
  let o = "", a = 0;
  for (const s of r)
    o += Bt(e.slice(a, s.start), n), o += `<mark class="${ga}" ${Bn}="${nu(s.key)}">${Bt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  return o + Bt(e.slice(a), n);
}
const ou = { figure: "图", table: "表", equation: "式" };
function Wr(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${ou[e.kind]} ${e.label}`;
}
function ge(e) {
  return typeof e == "string" ? e : "";
}
function au(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function su(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function iu(e) {
  return {
    source: ge(e == null ? void 0 : e.source_text) || ge(e == null ? void 0 : e.unit_source_text),
    translated: ge(e == null ? void 0 : e.protected_translated_text) || ge(e == null ? void 0 : e.translated_text)
  };
}
const cu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ba(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function lu(e) {
  const t = ba(e).sort((r, o) => ge(r.ts).localeCompare(ge(o.ts)));
  return t.length ? [
    { text: ge(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ge(r.new_text),
      label: cu[ge(r.source)] || ge(r.source) || "修订",
      ts: ge(r.ts),
      reason: ge(r.reason)
    }))
  ].reverse() : [];
}
function uu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function du(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ge(r.finished_at) || ge(n.finished_at) || "";
}
function fu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ba(e).sort((a, s) => ge(a.ts).localeCompare(ge(s.ts)));
  for (const a of o) {
    const s = new Date(ge(a.ts)).getTime(), i = ge(a.reader_item_id) || ge(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ge(a.new_text));
  }
  return n;
}
const mu = {
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
function hu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = mu[ge(n.kind)] || ge(n.kind) || "问题", o = ge(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const pu = /* @__PURE__ */ new Set(["text", "formula"]);
function or(e) {
  return pu.has(e);
}
function gu(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || or(xe(n));
}
function bu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !or(xe(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const yu = 300, vu = 72;
function wu(e, t) {
  if (e.width >= yu && e.height >= vu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Su = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function ku(e, t, n) {
  return e.flatMap((r) => {
    if (!Su.has(xe(r.region))) return [];
    const o = vt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Kr(e, t, n) {
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
async function Iu(e) {
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
const Tu = "reader-text-hover-copy", Ru = "reader-text-hover-edit", Eu = "reader-text-hover-zoom", Pu = "reader-text-hover-id";
function Mu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const ya = "reader-text-hover-tools";
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
const _u = 26, Nu = 220;
function Au(e, t = Nu) {
  return e.height < _u * 2 || e.width < t;
}
function Lu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Fo : e === "failed" ? wt : ws, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function xu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = P("idle"), [u, f] = P("idle"), [d] = P(() => Mu()), m = _([]), g = (e == null ? void 0 : e.itemId) || "";
  if (z(() => {
    l("idle"), f("idle");
    const k = m.current;
    return () => {
      k.forEach((R) => window.clearTimeout(R)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = hs(e.highlight.region, t), y = xe(e.highlight.region), w = (k, R) => async (N) => {
    N.preventDefault(), N.stopPropagation();
    const F = await Iu(k);
    R(F ? "copied" : "failed"), m.current.push(window.setTimeout(() => R("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (Au(b) ? "outside" : "inside");
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
          className: ya,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              nn,
              {
                className: Pu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && or(y) ? /* @__PURE__ */ p(
              nn,
              {
                className: Ru,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Yn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              nn,
              {
                className: Tu,
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
                className: Eu,
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
function Du(e, t) {
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
function Cu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = vt(
      Du(e, a),
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
const zu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Ou = 256, $t = /* @__PURE__ */ new Map();
function $u(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function va(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Gs(t, { bareLatex: !0 }), o = $u(n), a = Xs(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = $t.get(t);
  if (!s && (s = Zs(o, r), $t.set(t, s), $t.size > Ou)) {
    const i = $t.keys().next().value;
    i !== void 0 && $t.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function kn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ge(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Fu(e, t) {
  const n = e.typography, r = Ge(t) || 1, o = Ge(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = kn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ge(n == null ? void 0 : n.fit_min_font_size_pt), u = Ge(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Ge(n == null ? void 0 : n.leading_em), h = [
    Ge(n == null ? void 0 : n.padding_top_pt) || 0,
    Ge(n == null ? void 0 : n.padding_right_pt) || 0,
    Ge(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ge(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || zu,
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
function Bu(e, t, n, r) {
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
const ju = 512, Ft = /* @__PURE__ */ new Map();
let Hn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Hn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Hn += 1;
}));
function Hu(e, t, n, r) {
  return [
    Hn,
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
function wa({ item: e, pageScale: t }) {
  const n = _(null), r = Z(
    () => va(e.translatedText),
    [e.translatedText]
  ), [o, a] = P(r.fallbackHtml), s = Z(
    () => Fu(e, t),
    [e, t]
  );
  z(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Re(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - d - g), S = Hu(o, y, w, s);
    let b = Ft.get(S);
    if (b === void 0 && (b = Bu(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ft.set(S, b), Ft.size > ju)) {
      const v = Ft.keys().next().value;
      v !== void 0 && Ft.delete(v);
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
function Uu({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = Z(
    () => Cu(e, t, n, r),
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
        wa,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Wu = pn(Uu);
function Ku({
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
        wa,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: xe(a.highlight.region),
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
const Vu = pn(Ku), Sa = 24, ot = Sa * 2 + 4, Xe = 24, qu = 4, Ju = 6, ht = (e) => e.left + e.width, lt = (e) => e.top + e.height;
function Ht(e, t) {
  const n = Math.min(ht(e), ht(t)) - Math.max(e.left, t.left), r = Math.min(lt(e), lt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Vr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ht(t) && r >= t.top && r <= lt(t);
}, Gu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Xu(e, t, n) {
  if (!t.length || e.height < Xe || e.width < n + 8) return null;
  const r = Math.max(...t.map(lt)), o = ht(e) - 4 - n;
  for (const a of [r, lt(e) - 2]) {
    const s = Math.max(e.top, a - Xe), i = { left: o, top: s, width: n, height: Xe };
    if (!t.some((c) => Ht(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Zu(e, t) {
  const n = [], r = (a) => {
    const s = Sa + qu, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ht(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Xe - 3, width: ot, height: Xe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: lt(e), width: ot, height: Xe + 3 } }), r(!0);
  const o = Xu(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ht(e) - 4 - ot, top: e.top + o, width: ot, height: Xe } }), n;
}
function Yu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !Gu(S)), i = s.filter((S) => Vr(S, t)), c = s.filter((S) => !Vr(S, t)), l = n.filter((S) => S !== t && Ht(S, t) < t.width * t.height * 0.5), u = Zu(t, i).filter(({ box: S, overhang: b }) => {
    const v = b ? Ju : 0;
    return S.left >= -v && ht(S) <= r + v && S.top >= 0 && lt(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !c.some((b) => Ht(S, b) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((b) => Ht(S.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((v, k) => v + Ht(S.box, k), 0);
    b < w && (y = S, w = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function Qu(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Xe - 3 : lt(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Xe + 3;
}
const In = (e) => e.left + e.width, Tn = (e) => e.top + e.height;
function ed(e, t, n = 3, r = 6) {
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
function td(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function nd(e, t, n, r) {
  const [o, a] = P(null);
  return Re(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? td(s) : [], c = xe(t.highlight.region) === "figure", l = i.length && !c ? ed(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Yu({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const ka = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], qr = { pen: 35e-4, highlighter: 0.018 }, Jr = 0.015, Un = "retainpdf.reader.ink.v1:";
function Gr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Un + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function rd(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Un + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Un + e);
    } catch {
    }
}
function od(e, t, n, r, o, a) {
  const s = Jr * Jr;
  return e.filter((i) => Ia(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Ia(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function ad(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function sd(e) {
  const [t, n] = P(null), [r, o] = P(ka[0].key), [a, s] = P(() => Gr(e)), i = _(a), c = _([]);
  z(() => {
    const h = Gr(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = L((h) => {
    i.current = h, s(h), rd(e, h);
  }, [e]), u = L((h) => {
    const y = i.current, w = h(y);
    w !== y && (c.current = [...c.current.slice(-49), y], l(w));
  }, [l]), f = L((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = L((h) => {
    h.length && u((y) => y.filter((w) => !h.includes(w.id)));
  }, [u]), m = L((h) => {
    u((y) => y.some((w) => w.page === h) ? y.filter((w) => w.page !== h) : y);
  }, [u]), g = L(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return Z(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const id = "reader-ink-layer";
function cd(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Xr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: cd(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function ld({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = P(null), i = _(!1), c = o.strokes.filter((h) => Ia(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(od(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, w] = u(h);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, w] = u(h);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? ad(S, y, w) : [[y, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: qr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      className: id,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(Xr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Xr, { stroke: { tool: o.tool, color: o.color, width: qr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function ud({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = P(null), [i, c] = P(!1), [l, u] = P([]), [f, d] = P(""), [m, g] = P(""), [h, y] = P(!1), [w, S] = P(null), [b, v] = P([]), k = r.drafts, R = r.generation, N = L(async (I, T) => {
    if (e)
      try {
        u(lu(await e.fetchRevisions(I, T)));
      } catch {
        u([]);
      }
  }, [e]);
  z(() => {
    if (s(null), u([]), S(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (I) return;
      const E = T == null ? void 0 : T.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const x = `${(T == null ? void 0 : T.item_id) || n}`, { source: D, translated: U } = iu(E);
      s({ readerItemId: n, itemId: x, source: D, current: U }), d(k.get(n) ?? U);
    }).catch((T) => {
      I || S({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), N(t, n), () => {
      I = !0;
    };
  }, [e, t, n, N]);
  const F = L((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), O = L(async (I, T) => {
    if (!e || !a || h) return !1;
    const E = I ?? f;
    if (!E.trim()) return !1;
    y(!0), S(null), v([]);
    try {
      const x = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), D = Number(x == null ? void 0 : x.generation);
      return Number.isFinite(D) && (R.current = D), k.delete(a.readerItemId), s({ ...a, current: E }), d(E), g(""), (x == null ? void 0 : x.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), N(t, a.readerItemId), !0;
    } catch (x) {
      const D = x;
      return (D == null ? void 0 : D.reason) === "generation_mismatch" && (R.current = null), S({ tone: "error", message: (D == null ? void 0 : D.message) || "保存失败，请稍后再试。" }), v(hu(D == null ? void 0 : D.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, N, k, R]), A = L(() => {
    n && k.delete(n);
  }, [n, k]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: F,
    reason: m,
    setReason: g,
    saving: h,
    status: w,
    issues: b,
    save: O,
    discardDraft: A
  };
}
const Ta = "reader-inline-edit";
function dd({ text: e }) {
  const [t, n] = P("");
  return z(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = va(e);
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
function fd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var A;
  const s = e.itemId, i = ud({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = P(!1), [u, f] = P(!1), d = _(null), m = wu(e.rect, t), g = Z(() => bu(o), [o]), h = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: k } = n, R = L((I) => {
    const T = g[h + I];
    T && (k(T), a == null || a(T));
  }, [g, h, k, a]), N = L(() => {
    i.discardDraft(), v();
  }, [i, v]), F = L(async (I, T) => {
    await i.save(I, T) && v();
  }, [i, v]);
  z(() => {
    const I = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), R(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [R]), Re(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    I.style.height = `${Math.max(T, I.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const O = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ C(yt, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ C(
      "div",
      {
        className: `${Ta} is-${m.mode}`,
        style: O,
        role: "group",
        "aria-label": `改第 ${((A = n.target) == null ? void 0 : A.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            re,
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
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || F()) : I.key === "Escape" && (I.preventDefault(), N());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(dd, { text: i.draft }) : null,
          /* @__PURE__ */ C("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(mt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(Ss, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(mt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(Bo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              Ko,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || F()) : I.key === "Escape" && (I.preventDefault(), N());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ C(
              re,
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
            /* @__PURE__ */ p(re, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: N, children: "取消" }),
            /* @__PURE__ */ p(
              re,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  F();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, T) => {
            const E = I.text === y.current, x = [uu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ C("li", { "data-block-edit-history": I.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ C("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ C("span", { children: [
                  x,
                  E ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  re,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      F(I.text, `回到「${x.replace(" · ", " ")}」那一版`);
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
const Ra = Gn(null), Ea = Gn(null);
function md({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Ra.Provider, { value: e, children: /* @__PURE__ */ p(Ea.Provider, { value: t, children: n }) });
}
function et() {
  return Xn(Ra);
}
function Pa() {
  return Xn(Ea);
}
const Ma = 1.414;
function hd({
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
  var ce, pe, ye;
  const b = et(), v = b == null ? void 0 : b.revisedBlocks, k = b == null ? void 0 : b.blockEdit, R = k == null ? void 0 : k.pendingEdits, N = b == null ? void 0 : b.editBlock, F = (b == null ? void 0 : b.findTerm) || "", O = b == null ? void 0 : b.xrefIndex, A = Z(
    () => O != null && O.size ? ({ str: j }) => ru(j, O, F) : F ? ({ str: j }) => Bt(j, F) : void 0,
    [F, O]
  ), I = _(c ?? Ma), [T, E] = P(I.current);
  z(() => {
    c != null && Math.abs(c - I.current) >= 1e-3 && (I.current = c, E(c));
  }, [c]);
  const x = _(u);
  x.current = u;
  const D = _(null), U = _((j) => {
    var ne;
    D.current = j, (ne = x.current) == null || ne.call(x, j);
  }).current, M = _(null), H = _(`${t}@${n}`);
  Re(() => {
    const j = `${t}@${n}`;
    H.current !== j && (H.current = j, o && gd(D.current, M.current));
  }, [o, n, t]), z(() => {
    o || Rn(M.current);
  }, [o]), z(() => () => Rn(M.current), []);
  const V = Math.max(120, Math.floor(t * T)), Y = Math.max(V, Math.ceil(s || 0)), $ = vt(f, t, V), K = Z(
    () => ku(d, t, V),
    [V, d, t]
  ), [q, te] = P(null), ue = typeof g == "function", J = ue ? m ?? null : q, oe = (j) => {
    ue ? j !== (m ?? null) && (g == null || g(j)) : te((ne) => ne === j ? ne : j);
  }, fe = Z(
    () => K.find((j) => j.itemId === J) || null,
    [J, K]
  ), se = r === "translated" && ((ce = k == null ? void 0 : k.target) == null ? void 0 : ce.itemId) || "", be = Z(
    () => se && K.find((j) => j.itemId === se) || null,
    [se, K]
  ), he = nd(D, o ? fe : null, K, t), We = (j) => {
    var Pe, ze, Me, Oe, we;
    if (j.pointerType === "touch") return;
    if ((Pe = b == null ? void 0 : b.ink) != null && Pe.tool) {
      oe(null);
      return;
    }
    if (j.buttons !== 0) {
      oe(null);
      return;
    }
    if ((Me = (ze = j.target) == null ? void 0 : ze.closest) != null && Me.call(ze, `.${ya}`) || (we = (Oe = j.target) == null ? void 0 : Oe.closest) != null && we.call(Oe, `.${Ta}`)) return;
    const ne = j.currentTarget.getBoundingClientRect(), ie = j.clientX - ne.left, Ce = j.clientY - ne.top;
    if (Qu(he, ie, Ce)) return;
    const Ee = Kr(K, ie, Ce);
    oe((Ee == null ? void 0 : Ee.itemId) || null);
  }, tt = (j) => {
    if (j.pointerType === "mouse") return;
    const ne = j.currentTarget.getBoundingClientRect(), ie = Kr(
      K,
      j.clientX - ne.left,
      j.clientY - ne.top
    );
    oe((ie == null ? void 0 : ie.itemId) || null);
  }, De = (j) => {
    !Number.isFinite(j) || j <= 0 || Math.abs(I.current - j) < 1e-3 || (I.current = j, E(j), l == null || l(e, j));
  };
  return /* @__PURE__ */ C(
    "div",
    {
      ref: U,
      [Te]: e,
      [ke]: r,
      [Qn]: V,
      className: er,
      onPointerMoveCapture: We,
      onPointerDown: tt,
      onDoubleClick: (j) => {
        var ie;
        const ne = b == null ? void 0 : b.zoomBlock;
        !ne || (ie = b == null ? void 0 : b.ink) != null && ie.tool || !fe || xe(fe.highlight.region) === "figure" && (j.preventDefault(), ne(fe.itemId));
      },
      onPointerLeave: (j) => {
        j.pointerType === "mouse" && oe(null);
      },
      style: {
        width: t,
        height: Y,
        minHeight: Y
      },
      children: [
        o ? /* @__PURE__ */ p(
          qs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: A,
            renderAnnotationLayer: !1,
            className: Zo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: ln,
                style: { width: t, height: V }
              }
            ),
            onLoadSuccess: (j) => {
              try {
                const ne = j.getViewport({ scale: 1 });
                if (ne.width > 0) {
                  const ie = ne.height / ne.width;
                  De(ie);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Rn(M.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: ln,
            style: { width: t, height: V },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: M, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        $ ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: $,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Wu,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: V
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p(Vu, { targets: K, edits: R, width: t, excludeId: be == null ? void 0 : be.itemId }) : null,
        o && be && k ? /* @__PURE__ */ p(
          fd,
          {
            target: be,
            page: { width: t, height: V },
            edit: k,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: K.filter((j) => v.has(j.itemId)).map((j) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": j.itemId,
            style: { left: j.rect.left, top: j.rect.top, height: j.rect.height }
          },
          j.itemId
        )) }) : null,
        o && (b != null && b.ink) ? /* @__PURE__ */ p(
          ld,
          {
            page: e,
            pane: r === "translated" ? "translated" : b.compareVersion ? "compare" : "source",
            width: t,
            height: V,
            ink: b.ink
          }
        ) : null,
        (pe = b == null ? void 0 : b.askMarks) != null && pe.length && b.onAskMark ? /* @__PURE__ */ p(Dl, { marks: b.askMarks, page: e, height: V, onOpen: b.onAskMark }) : null,
        /* @__PURE__ */ p(
          xu,
          {
            target: o && !((ye = b == null ? void 0 : b.ink) != null && ye.tool) && (fe == null ? void 0 : fe.itemId) !== (be == null ? void 0 : be.itemId) ? fe : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: fe && (v == null ? void 0 : v.get(fe.itemId)) || 0,
            onEdit: N,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: he == null ? void 0 : he.rect,
            placement: he == null ? void 0 : he.placement,
            tailTop: he == null ? void 0 : he.tailTop
          }
        )
      ]
    }
  );
}
const pd = pn(hd);
function gd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Rn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const bd = 2 * 1024 * 1024;
function yd(e) {
  const t = new Vo.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const En = 5, vd = "120% 0px", wd = 120, Sd = "25% 0px";
let Zr = 1;
const Yr = /* @__PURE__ */ new WeakMap();
function kd(e) {
  if (!e) return 0;
  const t = Yr.get(e);
  if (t) return t;
  const n = Zr;
  return Zr += 1, Yr.set(e, n), n;
}
function Id() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Td = xo(
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
    showLiveTranslation: R = t === "source",
    liveTranslationPendingLabel: N = "",
    paneAction: F
  }, O) {
    xl();
    const { file: A, loading: I, error: T } = Li(n, r), E = `${n}\0${kd(A)}`, x = _(E);
    x.current = E;
    const D = Z(() => {
      const B = Ei(A);
      return B ? "ranged" in B ? { range: yd(B.ranged) } : B : null;
    }, [A, n]), [U, M] = P(0), [H, V] = P(""), [Y, $] = P(null), [K, q] = P(480), te = _(null), ue = _(0), J = Z(() => Id(), []), oe = Z(() => ({
      cMapUrl: qt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: qt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: bd,
      disableAutoFetch: !0
    }), []);
    Zn(O, () => Y, [Y]), z(() => {
      const B = (X) => {
        ue.current = X, q(X);
      }, G = (X) => {
        const le = ec(X, ue.current);
        if (le !== "ignore") {
          if (te.current && clearTimeout(te.current), le === "immediate") {
            B(X);
            return;
          }
          te.current = setTimeout(() => B(X), na);
        }
      }, Q = !!(c && c >= 80);
      G(Q ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const de = !Q && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var le, ve;
        G(((ve = (le = X[0]) == null ? void 0 : le.contentRect) == null ? void 0 : ve.width) ?? i.clientWidth);
      }) : null;
      return de && i && de.observe(i), () => {
        de == null || de.disconnect(), te.current && clearTimeout(te.current);
      };
    }, [c, i, a]);
    const fe = Z(
      () => Zi(K, o),
      [K, o]
    ), [se, be] = P(() => /* @__PURE__ */ new Map()), [he, We] = P(() => /* @__PURE__ */ new Set()), [tt, De] = P(() => /* @__PURE__ */ new Set()), ce = _(/* @__PURE__ */ new Map()), pe = _(null), ye = _(null), [j, ne] = P(() => /* @__PURE__ */ new Set()), ie = _(/* @__PURE__ */ new Map()), Ce = L((B, G) => {
      be((Q) => {
        if (Q.get(B) === G) return Q;
        const ee = new Map(Q);
        return ee.set(B, G), ee;
      });
    }, []), Ee = L((B, G) => {
      const Q = ce.current, ee = Q.get(B), de = [pe.current, ye.current];
      if (ee)
        for (const X of de)
          try {
            X == null || X.unobserve(ee);
          } catch {
          }
      if (G) {
        Q.set(B, G);
        for (const X of de)
          try {
            X == null || X.observe(G);
          } catch {
          }
      } else
        Q.delete(B);
    }, []), Pe = _(/* @__PURE__ */ new Map()), ze = L((B) => {
      const G = Pe.current;
      let Q = G.get(B);
      return Q || (Q = (ee) => Ee(B, ee), G.set(B, Q)), Q;
    }, [Ee]);
    z(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = ie.current, G = new IntersectionObserver(
        (Q) => {
          const ee = [], de = [];
          for (const X of Q) {
            const le = X.target, ve = dn(le);
            Number.isFinite(ve) && (X.isIntersecting ? ee : de).push(ve);
          }
          if ((ee.length || de.length) && We((X) => {
            let le = null;
            for (const ve of ee)
              X.has(ve) || (le = le || new Set(X), le.add(ve));
            for (const ve of de)
              X.has(ve) && (le = le || new Set(X), le.delete(ve));
            return le || X;
          }), ee.length) {
            for (const X of ee) {
              const le = B.get(X);
              le && (clearTimeout(le), B.delete(X));
            }
            De((X) => {
              let le = null;
              for (const ve of ee)
                X.has(ve) || (le = le || new Set(X), le.add(ve));
              return le || X;
            });
          }
          for (const X of de)
            B.has(X) || B.set(X, setTimeout(() => {
              B.delete(X), De((le) => {
                if (!le.has(X)) return le;
                const ve = new Set(le);
                return ve.delete(X), ve;
              });
            }, wd));
        },
        { root: i, rootMargin: vd, threshold: 0 }
      );
      pe.current = G;
      for (const Q of ce.current.values())
        try {
          G.observe(Q);
        } catch {
        }
      return () => {
        G.disconnect(), pe.current === G && (pe.current = null);
        for (const Q of B.values()) clearTimeout(Q);
        B.clear();
      };
    }, [i]), z(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = new IntersectionObserver(
        (G) => {
          ne((Q) => {
            let ee = null;
            for (const de of G) {
              const X = dn(de.target);
              !Number.isFinite(X) || de.isIntersecting === Q.has(X) || (ee = ee || new Set(Q), de.isIntersecting ? ee.add(X) : ee.delete(X));
            }
            return ee || Q;
          });
        },
        { root: i, rootMargin: Sd, threshold: 0 }
      );
      ye.current = B;
      for (const G of ce.current.values())
        try {
          B.observe(G);
        } catch {
        }
      return () => {
        B.disconnect(), ye.current === B && (ye.current = null);
      };
    }, [i]);
    const Me = !!i && typeof IntersectionObserver < "u";
    Re(() => {
      M(0), V(""), We(/* @__PURE__ */ new Set()), De(/* @__PURE__ */ new Set()), be(/* @__PURE__ */ new Map()), ce.current.clear();
      const B = ie.current;
      for (const G of B.values()) clearTimeout(G);
      B.clear(), h == null || h(0, t);
    }, [E, h, t]);
    const Oe = L(
      (B) => {
        if (x.current !== E) return;
        const G = B.numPages;
        M(G), V(""), h == null || h(G, t), f == null || f({ numPages: G, pane: t }), m && typeof B.getPage == "function" && m(B, t), d && typeof B.getOutline == "function" && Ll(B).then((Q) => {
          x.current === E && d(Q, t);
        }, () => {
        });
      },
      [E, f, d, m, h, t]
    ), we = L(
      (B) => {
        if (x.current !== E) return;
        const G = (B == null ? void 0 : B.message) || "PDF 解析失败";
        V(G), M(0), h == null || h(0, t), g == null || g(B, t);
      },
      [E, g, h, t]
    ), _e = Z(
      () => U > 0 ? Array.from({ length: U }, (B, G) => G + 1) : [],
      [U]
    );
    z(() => {
      typeof IntersectionObserver < "u" || De(new Set(_e));
    }, [_e]);
    const Fe = Z(
      () => At(y, S, t),
      [y, S, t]
    ), Ke = Z(() => {
      const B = /* @__PURE__ */ new Map();
      for (const G of w) {
        const Q = At(G, S, t);
        if (!Q) continue;
        const ee = B.get(Q.box.page) || [];
        ee.push(Q), B.set(Q.box.page, ee);
      }
      return B;
    }, [t, S, w]), Be = Z(() => {
      const B = /* @__PURE__ */ new Set();
      if (!b) return B;
      for (const [G, Q] of Ke)
        Q.some((ee) => ee.itemId === b) && B.add(G);
      return B;
    }, [b, Ke]), Ne = Z(() => {
      if (U === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(_e);
      if (he.size === 0) {
        const Q = Math.min(U, En * 2 + 1);
        return new Set(Array.from({ length: Q }, (ee, de) => de + 1));
      }
      const G = /* @__PURE__ */ new Set();
      for (const Q of he)
        for (let ee = -En; ee <= En; ee++) {
          const de = Q + ee;
          de >= 1 && de <= U && G.add(de);
        }
      return G;
    }, [U, _e, i, a, he]), nt = !n || !!T || !!H, ut = n && (T || H) || s;
    return /* @__PURE__ */ C(
      "section",
      {
        ref: $,
        className: `reader-panel ${gn}${a ? "" : " is-hidden"}`,
        [ke]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          F ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: F }) : null,
          N ? /* @__PURE__ */ C("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: N })
          ] }) : null,
          nt && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ut }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          D && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Js,
            {
              file: D,
              loading: null,
              error: null,
              options: oe,
              onLoadSuccess: Oe,
              onLoadError: we,
              className: "reader-react-pdf-document",
              children: _e.map((B) => {
                if (Ne.has(B))
                  return /* @__PURE__ */ p(
                    pd,
                    {
                      pane: t,
                      pageNumber: B,
                      width: fe,
                      devicePixelRatio: J,
                      active: tt.has(B),
                      textLayer: !Me || j.has(B),
                      syncedMinHeight: (l == null ? void 0 : l.get(B)) || 0,
                      onMetrics: u,
                      cachedAspect: se.get(B),
                      onAspectChange: Ce,
                      sentinelRef: ze(B),
                      regionHighlight: (Fe == null ? void 0 : Fe.box.page) === B ? Fe : null,
                      regionTargets: Ke.get(B),
                      hoveredRegionId: b && Be.has(B) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(B - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(B - 1),
                      showLiveTranslation: R,
                      liveTranslationMissing: nl(k, B - 1)
                    },
                    `${t}-${B}`
                  );
                const Q = se.get(B) ?? Ma, ee = Math.max(120, Math.floor(fe * Q)), de = Math.max(ee, Math.ceil((l == null ? void 0 : l.get(B)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: ze(B),
                    [Te]: B,
                    [ke]: t,
                    [Qn]: ee,
                    className: `${er} is-placeholder`,
                    style: {
                      width: fe,
                      height: de,
                      minHeight: de
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: ln,
                        style: { width: fe, height: ee },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${B}`
                );
              })
            },
            E
          ) }) : null
        ]
      }
    );
  }
), Qr = pn(Td), Rd = 2e3, Ed = 6, Pd = 500, eo = "reader-react-resizing";
function Md(e, t) {
  const n = _(null), r = _(null);
  Re(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = _d(e), k = Wt(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const R of v) {
        const N = Math.round(R.contentRect.height);
        y.has(R.target) && y.get(R.target) !== N && (k = !0), y.set(R.target, N);
      }
      k && Lt(e, c, "auto", i);
    }), S = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(eo);
      for (const k of to) e.removeEventListener(k, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, b = () => {
      Lt(e, c, "auto", i);
      const v = e.scrollHeight;
      g = v === m ? g + 1 : 0, m = v;
      const k = performance.now() - h;
      g >= Ed && (v !== d || k > Pd) || k > Rd ? S() : u = requestAnimationFrame(b);
    };
    for (const v of to) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(eo), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, na);
  }, [e, t]), z(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function _d(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Te}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ke) || null;
  }
  return null;
}
const to = ["wheel", "touchstart", "keydown", "pointerdown"];
function Nd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Ad(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(gn)) && ((n = e.hasAttribute) != null && n.call(e, ke)));
}
function Ld(e, t) {
  z(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Ad(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${gn}[${ke}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = Nd(a, i);
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
function Dd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const no = 12;
function ar(e) {
  return Array.from(e.querySelectorAll(`.${gn}[${ke}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Cd(e) {
  const t = e.getBoundingClientRect();
  return ar(e).map((n) => {
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
function zd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Od(e, t) {
  return e ? ar(e).find((n) => n.getAttribute(ke) === t) ?? null : null;
}
function $d({ shellEl: e }) {
  const [t, n] = P([]), r = _(0), o = L(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Cd(e);
      n((i) => zd(i, s) ? i : s);
    }));
  }, [e]);
  z(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, c = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of ar(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Fd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Fd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - no * 2), r = xd(e, n), o = _(null);
  if (!r) return null;
  const a = (d) => {
    const m = Od(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + Dd(e, n, r.size, d.clientX - m.startX));
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
function _a(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Bd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function jd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ C("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(
        re,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: _a(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Fo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Is, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ C("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ C(
        re,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Ts, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ C(
        re,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Rs, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function ro({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Bd(t), a = [e === "compare" ? "对比" : "正在读", r, _a(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ C("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Hd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = P({ source: null, translated: null });
  return Re(() => {
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
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(ro, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(ro, { role: "reading", ...n }) }) : null
  ] });
}
const Ud = () => () => {
}, oo = () => null;
function Wd({
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
function Kd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Vd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function qd(e) {
  const t = et(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, N = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, F = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), A = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], x = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), D = (t == null ? void 0 : t.regionHover) ?? null, [U, M] = P(null), H = Do(
    D ? D.subscribe : Ud,
    D ? () => D.get().itemId : oo,
    D ? () => D.get().itemId : oo
  ), V = D ? H : U, Y = L((te) => {
    D ? D.set(te, "pdf") : M(te);
  }, [D]), $ = Wd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), q = Number.isFinite(g) && g > 0 ? Kd(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Md(d, q), Ld(d, $.compareMode), /* @__PURE__ */ C(
    "div",
    {
      ref: f,
      className: Xo,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(ps).length,
      "data-reader-metadata-ready": x ? "true" : "false",
      children: [
        /* @__PURE__ */ C(
          "main",
          {
            className: `${Go} reader-mode-${$.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Qr,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: R,
                  userZoom: m,
                  visible: $.showSource,
                  scrollRoot: d,
                  pageWidthOverride: q,
                  rowHeights: $.compareMode ? h : void 0,
                  onMetrics: F,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: O,
                  onOutline: b ? void 0 : A,
                  onDocument: b ? void 0 : I,
                  activeRegion: T,
                  regions: (b == null ? void 0 : b.regions) ?? E,
                  readerMetadata: x,
                  hoveredRegionId: V,
                  onHoverRegion: Y,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Vd(o) : "",
                  paneAction: u && $.showTranslated ? /* @__PURE__ */ C(yt, { children: [
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
                Qr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: N,
                  userZoom: m,
                  visible: $.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: q,
                  rowHeights: $.compareMode ? h : void 0,
                  onMetrics: F,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: O,
                  onOutline: A,
                  onDocument: I,
                  activeRegion: T,
                  regions: E,
                  readerMetadata: x,
                  hoveredRegionId: V,
                  onHoverRegion: Y,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p($d, { shellEl: d }),
        b ? /* @__PURE__ */ p(Hd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Jd = [
  { id: "source", label: "原文", Icon: jo },
  { id: "compare", label: "对照", Icon: Ho },
  { id: "translated", label: "译文", Icon: Uo }
];
function Gd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Xd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Zd(e) {
  const t = et(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Gd(a.state) : "";
  return /* @__PURE__ */ C("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ C("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Jd.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = Xd({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ C(
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
              /* @__PURE__ */ p(Es, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ C(
          re,
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
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ C(
        re,
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
const Yd = xo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ C(
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
}), Qd = Yd, ef = {
  markdown: { label: "Markdown", short: "MD", Icon: Qd, needsJob: !0 }
}, tf = ra.map(
  (e) => ({ id: e, ...ef[e] })
);
function Na() {
  return tf.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function nf(e) {
  const t = et(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(yt, { children: Na().map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, f = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ C(
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
function rf(e) {
  const t = et(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Na().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
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
        children: /* @__PURE__ */ p(wt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function of(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function af(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function sf(e) {
  return e / 100 * window.innerHeight;
}
function cf(e) {
  return e / 100 * window.innerWidth;
}
function lf(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Ut({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = lf(n);
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
      r = af(t, o);
      break;
    }
    case "em": {
      r = of(t, o);
      break;
    }
    case "vh": {
      r = sf(o);
      break;
    }
    case "vw": {
      r = cf(o);
      break;
    }
  }
  return r;
}
function Ie(e) {
  return parseFloat(e.toFixed(3));
}
function xt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Wn(e) {
  const { panels: t } = e, n = xt({ group: e });
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
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Ie(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ie(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ie(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Ut({
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
function me(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Kn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? uf : df
  );
}
function uf(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function df(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Aa(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function La(e, t) {
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
function ff({
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
    const { x: i, y: c } = La(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return me(o, "No rect found"), o;
}
let rn;
function mf() {
  return rn === void 0 && (typeof matchMedia == "function" ? rn = !!matchMedia("(pointer:coarse)").matches : rn = !1), rn;
}
function xa(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Kn(
    n,
    Array.from(t.children).filter(Aa).map((g) => ({ element: g }))
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
                  const R = m[0], N = ff({
                    orientation: n,
                    rects: [w, S],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  b = [
                    R,
                    N === w ? k : v
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
              const R = mf() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < R) {
                const F = R - k.width;
                k = new DOMRect(
                  k.x - F / 2,
                  k.y,
                  k.width + F,
                  k.height
                );
              }
              if (k.height < R) {
                const F = R - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - F / 2,
                  k.width,
                  k.height + F
                );
              }
              const N = g <= l || g > u;
              !i && !N && s.push({
                group: e,
                groupSize: xt({ group: e }),
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
var at;
class Da {
  constructor() {
    Tr(this, at, {});
  }
  addListener(t, n) {
    const r = Ct(this, at)[t];
    return r === void 0 ? Ct(this, at)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Ct(this, at)[t];
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
    Rr(this, at, {});
  }
  removeListener(t, n) {
    const r = Ct(this, at)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
at = new WeakMap();
let _t = {
  cursorFlags: 0,
  state: "inactive"
};
const sr = new Da();
function pt() {
  return _t;
}
function hf(e) {
  return sr.addListener("change", e);
}
function pf(e) {
  const t = _t, n = { ..._t };
  n.cursorFlags = e, _t = n, sr.emit("change", {
    prev: t,
    next: n
  });
}
function Nt(e) {
  const t = _t;
  _t = e, sr.emit("change", {
    prev: t,
    next: e
  });
}
const gf = (e) => e, Pn = () => {
}, Ca = 1, za = 2, Oa = 4, $a = 8, ao = 3, so = 12;
let on;
function io() {
  return on === void 0 && (on = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (on = !0)), on;
}
function bf({
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
        if (e && io()) {
          const a = (e & Ca) !== 0, s = (e & za) !== 0, i = (e & Oa) !== 0, c = (e & $a) !== 0;
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
    return io() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const co = /* @__PURE__ */ new WeakMap();
function ir(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = co.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = pt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = bf({
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
  co.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let He = /* @__PURE__ */ new Map();
const Fa = new Da();
function yf(e) {
  He = new Map(He), He.delete(e);
}
function lo(e, t) {
  for (const [n] of He)
    if (n.id === e)
      return n;
}
function ct(e, t) {
  for (const [n, r] of He)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function St() {
  return He;
}
function cr(e, t) {
  return Fa.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ye(e, t, n) {
  const r = He.get(e);
  He = new Map(He), He.set(e, t), Fa.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Ba(e) {
  const t = pt();
  let n = !1;
  switch (t.state) {
    case "active":
      Nt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (ir(e), n = !0, t.hitRegions.forEach((r) => {
        const o = ct(r.group.id, !0);
        Ye(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function uo(e) {
  e.defaultPrevented || Ba(e.currentTarget);
}
function vf(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = La(n, a.rect);
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
function wf(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Sf(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: ho(e),
    b: ho(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  me(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: mo(fo(n.a)),
    b: mo(fo(n.b))
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
const kf = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function If(e) {
  const t = getComputedStyle(ja(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Tf(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || If(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || kf.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function fo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (me(n, "Missing node"), Tf(n)) return n;
  }
  return null;
}
function mo(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function ho(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ja(e);
  return t;
}
function ja(e) {
  const { parentNode: t } = e;
  return wf(t) ? t.host : t;
}
function Rf(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Ef({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Aa(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Sf(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Rf(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function lr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = xa(o), s = vf(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Ef({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Pf(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Se(e, t, n = 0) {
  return Math.abs(Ie(e) - Ie(t)) <= n;
}
function je(e, t) {
  return Se(e, t) ? 0 : e > t ? 1 : -1;
}
function Mt({
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
  return r = Math.min(i, r), r = Ie(r), r;
}
function Gt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Se(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  me(u != null, "Invalid first pivot index"), me(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, y = n[h];
        me(
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
          if (me(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), Se(v, w)) {
            const k = b - v;
            je(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : f, y = n[h];
        me(
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
          if (me(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), Se(v, b)) {
            const k = v - w;
            je(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, y = n[h];
      me(
        y,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: S, collapsedSize: b, minSize: v } = y;
      if (S && je(w, v) < 0)
        if (e > 0) {
          const k = v - b, R = k / 2, N = w + e;
          je(N, v) < 0 && (e = je(e, R) <= 0 ? 0 : k);
        } else {
          const k = v - b, R = 100 - k / 2, N = w - e;
          je(N, v) < 0 && (e = je(100 + e, R) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const b = i[y];
      me(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const v = Mt({
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
      me(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = w - y, b = Mt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: S
      });
      if (!Se(w, b) && (d += w - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Pf(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    me(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = y + d, S = Mt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: w
    });
    if (l[h] = S, !Se(S, w)) {
      let b = w - S, v = e < 0 ? f : u;
      for (; v >= 0 && v < n.length; ) {
        const k = l[v];
        me(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const R = k + b, N = Mt({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: R
        });
        if (Se(k, N) || (b -= N - k, l[v] = N), Se(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!Se(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, w) => (h[g[w]] = y, h), {});
}
function gt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || je(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function bt({
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
  if (!Se(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      me(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    me(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    me(l != null, `No layout data found for index ${i}`);
    const u = Mt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!Se(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      me(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = Mt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Se(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function Ha({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = St();
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
      return (S == null ? void 0 : S.collapsible) && Se(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = l.slice(0, m).reduce((w, S) => w + u[S.id], 0);
      return {
        ...u,
        [t]: Ie(100 - y)
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
    }), w = bt({
      layout: y,
      panelConstraints: f
    });
    gt(g, w) || Ye(d, {
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
      return c && Se(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = xt({ group: l }), d = Ut({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ie(d / f * 100);
      i(m);
    }
  };
}
function po(e) {
  if (e.defaultPrevented)
    return;
  const t = St();
  lr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Ha({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function an(e) {
  const t = St();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Ua({
  groupId: e
}) {
  const t = () => {
    const n = St();
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
      } = t(), l = bt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (gt(i, l) || Ye(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function ft(e, t) {
  const n = an(e), r = ct(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  me(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  me(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Ua({ groupId: n.id }).getLayout(), c = Gt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = bt({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  gt(i, l) || Ye(
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
function go(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = an(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ft(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ft(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ft(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ft(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ft(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = an(t), o = ct(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        me(c, "Matching separator not found");
        const l = i.get(c);
        me(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (me(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], m = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ft(t, m - d);
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
        me(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), ft(t, -100);
        break;
      }
    }
}
function bo(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = St(), n = lr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Nt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Wa({
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
      separatorToPanels: R
    } = w;
    if (b && k && R) {
      const N = Gt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((F) => m.indexOf(F)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (gt(N, k)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Ca : za;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Oa : $a;
              break;
            }
          }
      } else
        Ye(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: N,
          separatorToPanels: R
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & ao : c |= i & ao, t.movementY === 0 ? c |= s & so : c |= i & so, pf(c), ir(e);
}
function yo(e) {
  const t = St(), n = pt();
  switch (n.state) {
    case "active":
      Wa({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function vo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = pt(), n = St();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Nt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = ct(a.group.id, !0);
          Ye(a.group, s, {
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
      Wa({
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
      const a = lr(e, n);
      a.length === 0 ? t.state !== "inactive" && Nt({
        cursorFlags: 0,
        state: "inactive"
      }) : Nt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), ir(e.currentTarget);
      break;
    }
  }
}
function wo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (pt().state) {
      case "hover":
        Nt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function So(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Ba(e.currentTarget) && e.preventDefault();
}
function ko(e) {
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
function Mf(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = xt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Ie(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function _f(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Nf({
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
function Af(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Tt = /* @__PURE__ */ new Map();
function Lf(e) {
  let t = !0;
  me(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: w } = h;
      if (w === e.element) {
        if (t) {
          const S = xt({ group: e });
          if (S === 0)
            return;
          const b = ct(e.id);
          if (!b)
            return;
          const v = Wn(e), k = b.defaultLayoutDeferred ? ko(v) : b.layout, R = Nf({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: k
          }), N = bt({
            layout: R,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && gt(b.layout, N) && _f(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === S)
            return;
          Ye(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: N,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        Mf(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    me(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = xt({ group: e }), i = Wn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Af(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? ko(i), f = bt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  Tt.set(
    d,
    (Tt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return xa(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Ye(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    me(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", go);
  }), Tt.get(d) === 1 && (d.addEventListener("contextmenu", uo, !0), d.addEventListener("dblclick", po, !0), d.addEventListener("pointerdown", bo, !0), d.addEventListener("pointerleave", yo), d.addEventListener("pointermove", vo), d.addEventListener("pointerout", wo), d.addEventListener("pointerup", So, !0)), function() {
    t = !1, Tt.set(
      d,
      Math.max(0, (Tt.get(d) ?? 0) - 1)
    ), yf(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", go);
    }), Tt.get(d) || (d.removeEventListener(
      "contextmenu",
      uo,
      !0
    ), d.removeEventListener(
      "dblclick",
      po,
      !0
    ), d.removeEventListener(
      "pointerdown",
      bo,
      !0
    ), d.removeEventListener("pointerleave", yo), d.removeEventListener("pointermove", vo), d.removeEventListener("pointerout", wo), d.removeEventListener("pointerup", So, !0)), a.disconnect();
  };
}
function xf() {
  const [e, t] = P({}), n = L(() => t({}), []);
  return [e, n];
}
function ur(e) {
  const t = Co();
  return `${e ?? t}`;
}
const kt = typeof window < "u" ? Re : z;
function Kt(e) {
  const t = _(e);
  return kt(() => {
    t.current = e;
  }, [e]), L(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function dr(...e) {
  return Kt((t) => {
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
function fr(e) {
  const t = _({ ...e });
  return kt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Ka = Gn(null);
function Df(e, t) {
  const n = _({
    getLayout: () => ({}),
    setLayout: gf
  });
  Zn(t, () => n.current, []), kt(() => {
    Object.assign(
      n.current,
      Ua({ groupId: e })
    );
  });
}
function Va({
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
  }), h = Kt((I) => {
    gt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), y = Kt(
    (I, T) => {
      gt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), w = ur(i), S = _(null), [b, v] = xf(), k = _({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), R = dr(S, a);
  Df(w, s);
  const N = Kt(
    (I, T) => {
      const E = pt(), x = lo(I), D = ct(I);
      if (D) {
        let U = !1;
        switch (E.state) {
          case "active": {
            U = E.hitRegions.some(
              (M) => M.group === x
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
  ), F = fr({
    defaultLayout: n,
    disableCursor: r
  }), O = Z(
    () => ({
      get disableCursor() {
        return !!F.disableCursor;
      },
      getPanelStyles: N,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const T = k.current;
        return T.panels = Kn(u, [
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
        return T.separators = Kn(u, [
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
        const x = lo(w), D = ct(w);
        x && D && Ye(x, {
          ...D,
          derivedPanelConstraints: Wn(x)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: E
      }) => {
        const x = k.current.separators.find(
          (D) => D.id === I
        );
        x && (x.disabled = T, x.disableDoubleClick = E);
      }
    }),
    [N, w, v, u, F]
  ), A = _(null);
  return kt(() => {
    const I = S.current;
    if (I === null)
      return;
    const T = k.current;
    let E;
    if (F.defaultLayout !== void 0 && Object.keys(F.defaultLayout).length === T.panels.length) {
      E = {};
      for (const Y of T.panels) {
        const $ = F.defaultLayout[Y.id];
        $ !== void 0 && (E[Y.id] = $);
      }
    }
    const x = {
      disabled: !!o,
      element: I,
      id: w,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!F.disableCursor,
        expandedPanelSizes: k.current.lastExpandedPanelSizes,
        layouts: k.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    A.current = x;
    const D = Lf(x), { defaultLayoutDeferred: U, derivedPanelConstraints: M, layout: H } = ct(x.id, !0);
    !U && M.length > 0 && (h(H), y(H, !1));
    const V = cr(w, (Y) => {
      const { defaultLayoutDeferred: $, derivedPanelConstraints: K, layout: q } = Y.next;
      if ($ || K.length === 0)
        return;
      const te = x.panels.map(({ id: J }) => J).join(",");
      x.mutableState.layouts[te] = q, K.forEach((J) => {
        if (J.collapsible) {
          const { layout: oe } = Y.prev ?? {};
          if (oe) {
            const fe = Se(
              J.collapsedSize,
              q[J.panelId]
            ), se = Se(
              J.collapsedSize,
              oe[J.panelId]
            );
            fe && !se && (x.mutableState.expandedPanelSizes[J.panelId] = oe[J.panelId]);
          }
        }
      });
      const ue = pt().state !== "active";
      h(q), ue && y(q, Y.isUserInteraction);
    });
    return () => {
      A.current = null, D(), V();
    };
  }, [
    o,
    w,
    y,
    h,
    u,
    b,
    F
  ]), z(() => {
    const I = A.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Ka.Provider, { value: O, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
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
Va.displayName = "Group";
function mr() {
  const e = Xn(Ka);
  return me(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Cf(e, t) {
  const { id: n } = mr(), r = _({
    collapse: Pn,
    expand: Pn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Pn
  });
  Zn(t, () => r.current, []), kt(() => {
    Object.assign(
      r.current,
      Ha({ groupId: n, panelId: e })
    );
  });
}
function Vn({
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
  const h = !!c, y = ur(c), w = fr({
    disabled: a
  }), S = _(null), b = dr(S, s), {
    getPanelStyles: v,
    id: k,
    orientation: R,
    registerPanel: N,
    updatePanelProps: F
  } = mr(), O = f !== null, A = Kt(
    (x, D, U) => {
      f == null || f(x, c, U);
    }
  );
  kt(() => {
    const x = S.current;
    if (x !== null) {
      const D = {
        element: x,
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
      return N(D);
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
    N,
    w
  ]), z(() => {
    F(y, { disabled: a });
  }, [a, y, F]), Cf(y, d);
  const I = () => {
    const x = v(k, y);
    if (x)
      return JSON.stringify(x);
  }, T = Do(
    (x) => cr(k, x),
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
        ...zf,
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
            touchAction: R === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Vn.displayName = "Panel";
const zf = {
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
function Of({
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
    a = bt({
      layout: Gt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = bt({
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
function qa({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = ur(a), l = fr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = P({}), [d, m] = P("inactive"), [g, h] = P(!1), y = _(null), w = dr(y, o), {
    disableCursor: S,
    id: b,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: R
  } = mr(), N = v === "horizontal" ? "vertical" : "horizontal";
  kt(() => {
    const A = y.current;
    if (A !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: A,
        id: c
      }, T = k(I), E = hf(
        (D) => {
          m(
            D.next.state !== "inactive" && D.next.hitRegions.some(
              (U) => U.separator === I
            ) ? D.next.state : "inactive"
          );
        }
      ), x = cr(
        b,
        (D) => {
          const { derivedPanelConstraints: U, layout: M, separatorToPanels: H } = D.next, V = H.get(I);
          if (V) {
            const Y = V[0], $ = V.indexOf(Y);
            f(
              Of({
                layout: M,
                panelConstraints: U,
                panelId: Y.id,
                panelIndex: $
              })
            );
          }
        }
      );
      return () => {
        E(), x(), T();
      };
    }
  }, [b, c, k, l]), z(() => {
    R(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, R]);
  let F;
  n && !S && (F = "not-allowed");
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
      "aria-orientation": N,
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
        cursor: F,
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
qa.displayName = "Separator";
const hr = 30, pr = 65, Xt = 50, $f = 100 - pr, Ff = 100 - hr;
function Bf(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(pr, Math.max(hr, t)) : Xt;
}
function gr(e) {
  return 100 - e;
}
function Rt(e) {
  return `${e}%`;
}
const br = "reader-document", Zt = "reader-assistant", Ja = "retainpdf.reader.ai-split-layout.v1", jf = {
  [br]: gr(Xt),
  [Zt]: Xt
};
function yr(e) {
  const t = Bf(e == null ? void 0 : e[Zt]);
  return {
    [br]: gr(t),
    [Zt]: t
  };
}
function Hf() {
  try {
    const e = JSON.parse(localStorage.getItem(Ja) || "null");
    return yr(e);
  } catch {
    return jf;
  }
}
function Uf(e) {
  try {
    localStorage.setItem(Ja, JSON.stringify(yr(e)));
  } catch {
  }
}
function Mn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = yr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Zt]}vw`
  );
}
function Wf() {
  const e = _(null), [t] = P(Hf);
  Re(() => {
    const o = e.current;
    return Mn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = L((o) => {
    Mn(e.current, o);
  }, []), r = L((o, a) => {
    Mn(e.current, o), a.isUserInteraction && Uf(o);
  }, []);
  return /* @__PURE__ */ C(
    Va,
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
          Vn,
          {
            id: br,
            defaultSize: Rt(gr(Xt)),
            minSize: Rt($f),
            maxSize: Rt(Ff)
          }
        ),
        /* @__PURE__ */ p(
          qa,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Vn,
          {
            id: Zt,
            defaultSize: Rt(Xt),
            minSize: Rt(hr),
            maxSize: Rt(pr)
          }
        )
      ]
    }
  );
}
function Kf({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = P(!1);
  if (z(() => {
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
    n ? /* @__PURE__ */ p(re, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function Vf({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Kf, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ C(yt, { children: [
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
      s ? /* @__PURE__ */ p(re, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function qf(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Jf() {
  const [e, t] = P(!1), n = Co(), r = _(null);
  return z(() => {
    if (!e) return;
    const o = (s) => {
      const i = r.current;
      i && s.target instanceof Node && !i.contains(s.target) && t(!1);
    }, a = (s) => {
      s.key === "Escape" && (s.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", o), window.addEventListener("keydown", a), () => {
      document.removeEventListener("mousedown", o), window.removeEventListener("keydown", a);
    };
  }, [e]), z(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || qf(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
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
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ p(_s, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: pl.map((o) => /* @__PURE__ */ C("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: o.title }),
            /* @__PURE__ */ p("ul", { children: o.items.map((a) => /* @__PURE__ */ C("li", { children: [
              /* @__PURE__ */ p("kbd", { children: a.keys }),
              /* @__PURE__ */ p("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ p("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const Gf = ["source", "sideBySide", "translated"], Xf = { source: "", translated: "", sideBySide: "" };
function Zf(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = sn(e.sourceUrl), n = sn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ii({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Yf(e) {
  const [t, n] = P(() => /* @__PURE__ */ new Set()), r = Z(
    () => e ? Zf(e) : Xf,
    [e]
  ), o = Z(
    () => Gf.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = L(async (s) => {
    if (!e) return;
    const i = sn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? si(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ci(
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
        li(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Qf = {
  source: jo,
  sideBySide: Ho,
  translated: Uo
}, em = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function tm(e) {
  const t = et(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Yf(n), i = _(null);
  return z(() => {
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
      /* @__PURE__ */ p(Ns, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(Bo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = is[c], u = sn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : cs(c, r), g = Qf[c];
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
            /* @__PURE__ */ p(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ C("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ C("span", { className: "reader-download-action-label", children: [
                em[c],
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
const nm = "retainpdf:reader:bookmarks:v1:", rm = 200;
function vr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ga(e) {
  const t = `${e || ""}`.trim();
  return t ? `${nm}${t}` : "";
}
function om(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function hn(e, t = vr()) {
  const n = Ga(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = om(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function qn(e, t, n) {
  const r = Ga(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, rm);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function am(e, t, n = "", { storage: r = vr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = hn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? qn(e, a.filter((i) => i.page !== s), r) : qn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function sm(e, t, n = vr()) {
  return qn(e, hn(e, n).filter((r) => r.page !== t), n);
}
function im(e, t) {
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
function cm({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function lm({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = P(() => hn(e)), [i, c] = P(!1), l = _(null);
  if (z(() => {
    s(hn(e)), c(!1);
  }, [e]), z(() => {
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
  return /* @__PURE__ */ C("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(am(e, u, im(r, u))),
        children: /* @__PURE__ */ p(cm, { filled: f })
      }
    ),
    a.length ? /* @__PURE__ */ C(
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
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ C("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ C(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), c(!1);
          },
          children: [
            /* @__PURE__ */ C("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(sm(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function um(e) {
  const [t, n] = P([]);
  return z(() => {
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
function dm(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const fm = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, mm = ["failed", "content", "layout"];
function hm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function pm({ jobId: e, currentPage: t }) {
  var f;
  const n = um(e), r = (f = et()) == null ? void 0 : f.jumpToBlock, [o, a] = P(!1), [s, i] = P(-1), c = _(null);
  z(() => i(-1), [n]);
  const l = (d) => {
    const m = n[d];
    !m || !r || (i(d), r(m.readerItemId));
  }, u = _({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, z(() => {
    const d = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || hm(m.target)) return;
      const { issues: g, last: h, currentPage: y, goTo: w } = u.current, S = dm(g, h, y, m.shiftKey);
      S < 0 || (m.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), z(() => {
    if (!o) return;
    const d = (m) => {
      var g;
      (g = c.current) != null && g.contains(m.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ C("div", { className: "reader-react-hud-group reader-issues", ref: c, "aria-label": "待处理", children: [
    /* @__PURE__ */ C(
      re,
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
    o ? /* @__PURE__ */ C("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      mm.map((d) => {
        const m = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === d);
        return m.length ? /* @__PURE__ */ C("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ C("h4", { children: [
            fm[d],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: g, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(
            re,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                l(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ C("span", { className: "reader-issues-page", children: [
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
const gm = 48, bm = 96, ym = 700;
function vm(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= gm, downSoFar: r };
}
function wm(e) {
  const [t, n] = P(!1), r = _(0);
  return z(() => {
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
      if (o.set(m, g), h === void 0 || Date.now() - a > ym) return;
      const y = vm(!1, r.current, g - h);
      r.current = y.downSoFar, g - h < -4 ? n(!1) : y.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - bm && (r.current = 0, n(!1));
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
function Sm(e) {
  const t = et(), n = Pa(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Xi(a), f = a > Yo + 1e-3, d = a < fn - 1e-3, m = Pt(r, it()), g = m >= fn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = _(null), y = wm(h), [w, S] = P(!1), [b, v] = P(`${i}`);
  z(() => {
    w || v(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, w]);
  const k = () => {
    if (S(!1), !l || c <= 0)
      return;
    const R = Number(`${b}`.trim());
    l(mn(R, c));
  };
  return /* @__PURE__ */ C("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ C(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (R) => {
          R.preventDefault(), k();
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
              onChange: (R) => v(R.target.value.replace(/[^\d]/g, "")),
              onBlur: k,
              onKeyDown: (R) => {
                R.key === "Escape" && (R.preventDefault(), S(!1), v(`${i}`));
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
          !l || c <= 0 || (v(`${i}`), S(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      lm,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(pm, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      re,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(km, {})
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
          children: "−"
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
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Jf, {}) })
  ] });
}
function km() {
  return /* @__PURE__ */ C("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function Io(e) {
  var t, n;
  return oa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Im(e) {
  const [t, n] = P(() => ({
    scope: e,
    panel: Io(Ue(e))
  }));
  z(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Io(Ue(e))
    });
  }, [e]), z(() => {
    t.scope === e && bn(t.scope, {
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
const Jn = "download-toast";
function Tm({
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
function Rm(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Ln.dismiss(Jn);
    return;
  }
  Ln.custom(
    () => /* @__PURE__ */ p(Tm, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Jn, duration: 1 / 0 }
  );
}
function Em() {
  const e = L((t) => {
    t && (t.setState = Rm, t.hide = () => Ln.dismiss(Jn));
  }, []);
  return /* @__PURE__ */ C(yt, { children: [
    /* @__PURE__ */ p(Vs, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Pm(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ea(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Mm(e, t) {
  return t === null || e !== t;
}
function _m(e) {
  const t = _(!1);
  return e && (t.current = !0), t.current;
}
function Nm(e, t) {
  const n = e === t;
  return { open: n, mounted: _m(n) };
}
const To = { itemId: null, origin: null };
function Am() {
  let e = To;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? To : { itemId: n, origin: r };
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
function Lm({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = Z(() => pa(e, t), [e, t]), [o, a] = P(() => /* @__PURE__ */ new Set([...Br(r), ...r ? [r] : []]));
  z(() => {
    a(/* @__PURE__ */ new Set([...Br(r), ...r ? [r] : []]));
  }, [e]);
  const s = _(null);
  z(() => {
    var l, u;
    (u = (l = s.current) == null ? void 0 : l.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (l) => a((u) => {
    const f = new Set(u);
    return f.has(l) ? f.delete(l) : f.add(l), f;
  }), c = (l) => l.map((u) => {
    const f = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ C("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ C("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          re,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(Wo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ C(
          re,
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
const xm = [], Dm = [];
function Cm({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ C("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(re, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(xs, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function zm({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    re,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(Ds, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Om({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = Dm,
  onJumpPage: l
}) {
  var A, I;
  const u = ((A = et()) == null ? void 0 : A.regions) ?? xm, f = ((I = Pa()) == null ? void 0 : I.currentPage) ?? 1, d = Z(() => jl(u), [u]), m = c.length > 0 && !!l, [g, h] = P("bookmarks"), y = m && (g === "bookmarks" || !d.length), w = Hl(d, f), S = Z(() => Kl(u, s), [u, s]), [b, v] = P(-1);
  z(() => v(-1), [s]);
  const k = _(null), R = _(null), N = _(n);
  N.current = n, z(() => {
    const T = (x) => {
      var U, M;
      const D = x.target;
      !D || (U = R.current) != null && U.contains(D) || (M = D.closest) != null && M.call(D, ".reader-finder-toggles, [data-finder-toggle]") || N.current();
    }, E = (x) => {
      x.key === "Escape" && N.current();
    };
    return document.addEventListener("pointerdown", T, !0), document.addEventListener("keydown", E), () => {
      document.removeEventListener("pointerdown", T, !0), document.removeEventListener("keydown", E);
    };
  }, []);
  const F = _(null);
  z(() => {
    var T, E, x;
    e === "search" ? (T = k.current) == null || T.focus() : (x = (E = F.current) == null ? void 0 : E.querySelector('[aria-current="location"]')) == null || x.scrollIntoView({ block: "center" });
  }, [e, i]), z(() => {
    var T, E;
    e === "search" && b >= 0 && ((E = (T = F.current) == null ? void 0 : T.querySelector('[aria-current="true"]')) == null || E.scrollIntoView({ block: "nearest" }));
  }, [e, b]);
  const O = (T) => {
    const E = S[T];
    E && (v(T), r(E.itemId));
  };
  return /* @__PURE__ */ C("aside", { ref: R, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ C("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(re, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(re, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(re, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(wt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && m && d.length ? /* @__PURE__ */ C("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(re, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ p(re, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && l ? /* @__PURE__ */ p(Lm, { nodes: c, currentPage: f, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: F, className: "reader-finder-list", children: d.map((T, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(
      re,
      {
        className: "reader-finder-entry",
        "data-level": T.level,
        "aria-current": E === w ? "location" : void 0,
        onClick: () => r(T.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: T.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: T.page })
        ]
      }
    ) }, T.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ C(yt, { children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          Ko,
          {
            ref: k,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (T) => a(T.target.value),
            onKeyDown: (T) => {
              T.key === "Enter" ? (T.preventDefault(), O(Vl(b, S.length, T.shiftKey))) : T.key === "Escape" && (T.preventDefault(), n()), T.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: S.length === 0 ? "没有找到" : `${b >= 0 ? `第 ${b + 1} / ` : ""}${S.length >= 200 ? "200+ 处，只列前 200 处" : `${S.length} 处`}${b < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: S.map((T, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(re, { className: "reader-finder-entry is-hit", "aria-current": E === b ? "true" : void 0, onClick: () => O(E), children: [
        /* @__PURE__ */ C("span", { className: "reader-finder-entry-text", children: [
          T.snippet.slice(0, T.at),
          /* @__PURE__ */ p("mark", { children: T.snippet.slice(T.at, T.at + T.length) }),
          T.snippet.slice(T.at + T.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: T.page })
      ] }) }, T.itemId)) })
    ] })
  ] });
}
function $m({ active: e, compare: t, ink: n }) {
  const [r, o] = P(!1), [a, s] = P(!1), i = _(null);
  z(() => {
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
  return /* @__PURE__ */ C("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(jd, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ C("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        re,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(Yn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(nf, { active: e }),
      t.available ? /* @__PURE__ */ p(
        re,
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
      re,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || c ? "true" : void 0,
        onClick: () => {
          o((l) => !l), s(!1);
        },
        children: r ? /* @__PURE__ */ p(wt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(zs, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Fm = [
  { tool: "pen", label: "画笔", Icon: Yn },
  { tool: "highlighter", label: "荧光笔", Icon: Os },
  { tool: "eraser", label: "橡皮", Icon: $s }
];
function Xa(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Za({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ C(yt, { children: [
    Fm.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      re,
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
    ka.map((o) => /* @__PURE__ */ p(
      re,
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
    /* @__PURE__ */ p(re, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Fs, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      re,
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
      re,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(wt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Bm({
  ink: e,
  menu: t,
  onClose: n,
  actions: r = []
}) {
  const o = _(null);
  if (z(() => {
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
  return /* @__PURE__ */ C("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    r.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: r.map((c) => /* @__PURE__ */ C(
      re,
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
    /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Za, { ink: e, page: t.page, onPick: n }) })
  ] });
}
function jm({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Za, { ink: e }) }) : null;
}
function Hm(e) {
  var r;
  if (e.shiftKey || Xa(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Xo}`))) return null;
  const n = Number((r = t.closest(`[${Te}]`)) == null ? void 0 : r.getAttribute(Te)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Um(e) {
  const t = _(e);
  t.current = e, z(() => {
    const n = (r) => {
      if (Xa(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function _n() {
  try {
    return Qe().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Wm(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Km(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Vm(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function qm({ documentId: e, jobId: t }) {
  const [n, r] = P([]), [o, a] = P(null), [s, i] = P(null), [c, l] = P(""), [u, f] = P(""), d = _(0);
  z(() => {
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
  const m = L((y) => {
    const w = _n(), S = n.find((v) => v.versionId === y);
    if (!w || !S || !e) return;
    const b = ++d.current;
    l(y), f(""), (async () => {
      const v = Qe(), k = await w.resolveJob(e, y);
      if (!k) throw new Error("这一份还没有能读的译文。");
      const R = await v.loadReaderPayload(k, { includeOptionalArtifacts: !0 }), N = v.resolveReaderTranslatedPdfUrl(R.jobPayload, R.manifestPayload);
      if (!N) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: k, url: N, regions: Wm($o(R.regionsPayload)) };
    })().then((v) => {
      b === d.current && i(v);
    }).catch((v) => {
      b === d.current && f((v == null ? void 0 : v.message) || "这一份打不开。");
    }).finally(() => {
      b === d.current && l("");
    });
  }, [e, n]), g = L(() => {
    d.current += 1, i(null), l(""), f("");
  }, []), h = L(async () => {
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
    w && ((b = globalThis.history) == null || b.replaceState(globalThis.history.state, "", Vm(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Km(n, t, o),
    compared: s,
    loading: c,
    error: u,
    choose: m,
    clear: g,
    adopt: h
  };
}
const Jm = "reader-finder-input";
function Gm(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Xm(e, t = typeof window > "u" ? null : window) {
  z(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Gm(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Jm) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Zm() {
  try {
    return Qe().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Ym = "这本书正在处理（翻译或排版），处理完才能改。", Qm = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function eh({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Zm(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = au(s), l = !t || Vt(t), u = du(n), [f, d] = P(""), [m, g] = P(null), [h, y] = P(() => /* @__PURE__ */ new Map()), [w, S] = P(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = P(() => /* @__PURE__ */ new Map()), [k, R] = P({ phase: "idle" }), N = _({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  z(() => {
    g(null), N.drafts.clear(), N.generation.current = null, v(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), z(() => {
    if (d(""), !i || c || !a) return;
    let D = !1;
    return a.resolveOwnerJobId(s).then((U) => {
      D || d(`${U || s}`.trim() || s);
    }).catch(() => {
      D || d(s);
    }), () => {
      D = !0;
    };
  }, [i, c, a, s]), z(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let D = !1;
    return a.fetchRevisions(f).then((U) => {
      D || y(fu(U, u));
    }).catch(() => {
    }), () => {
      D = !0;
    };
  }, [a, f, u, l]);
  const F = k.phase === "running" && k.seenActive;
  z(() => {
    if (k.phase === "running") {
      if (!l) {
        F || R({ phase: "running", seenActive: !0 });
        return;
      }
      F && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, F, l, t]);
  const O = Z(() => {
    const D = new Map(h);
    if (w.renderedAt === u)
      for (const [U, M] of w.edits) D.set(U, M);
    return D;
  }, [h, w, u]), A = L((D) => {
    const U = `${D || ""}`.trim();
    U && g({ itemId: U, page: su(U) });
  }, []), I = L(() => g(null), []), T = L((D, U) => {
    S((M) => {
      const H = new Map(M.renderedAt === u ? M.edits : []);
      return H.set(D, U), { renderedAt: u, edits: H };
    }), v((M) => new Map(M).set(D, (M.get(D) || 0) + 1));
  }, [u]), E = L(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch (D) {
        R({ phase: "failed", message: (D == null ? void 0 : D.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), x = c ? Qm : !l || k.phase === "running" || k.phase === "submitting" ? Ym : "";
  return Z(() => ({
    available: i,
    blockedReason: x,
    port: a,
    ownerJobId: f,
    target: m,
    select: A,
    close: I,
    memory: N,
    pendingEdits: O,
    savedCounts: b,
    markSaved: T,
    rerender: k,
    startRerender: E
  }), [i, x, a, f, m, A, I, N, O, b, T, k, E]);
}
function th(e, t) {
  z(() => {
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
function nh({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ C("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      re,
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
const Ya = "retainpdf:reader:doc-theme:v1", Ro = "data-reader-doc";
function Qa() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function rh(e = Qa()) {
  try {
    return (e == null ? void 0 : e.getItem(Ya)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function oh(e, t = Qa()) {
  try {
    t == null || t.setItem(Ya, e);
  } catch {
  }
}
function Eo(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Ro, "dark") : t.removeAttribute(Ro));
}
function ah() {
  const [e, t] = P(() => rh());
  z(() => {
    Eo(e);
  }, [e]), z(() => () => Eo("light"), []);
  const n = L(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return oh(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const Po = 6e3;
function es(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function sh(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > Po && (s *= Po / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function ts({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = _(null), [i, c] = P({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return z(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = sh(n, m, r, g), y = s.current, w = y == null ? void 0 : y.getContext("2d");
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
const Mo = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function ih(e, t, n) {
  const r = At(e, t, n), o = r ? vt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = es({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function ch(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = At(u, t, n), d = f ? vt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = es({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function lh(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function uh(e, t) {
  const n = (o) => {
    const a = xe(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function dh({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var O;
  const i = t.find((A) => A.itemId === e) ?? null, c = Z(() => i ? uh(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = P(rt.indexOf(1)), d = rt[u], m = _(null), [g, h] = P(0);
  Re(() => {
    const A = m.current;
    if (!A) return;
    const I = () => h(A.clientWidth);
    I();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return T == null || T.observe(A), () => T == null ? void 0 : T.disconnect();
  }, []);
  const y = L((A) => {
    const I = c[l + A];
    I && a(I.itemId);
  }, [c, l, a]);
  z(() => {
    const A = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), y(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), y(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), f((T) => Math.min(rt.length - 1, T + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), f((T) => Math.max(0, T - 1));
      else if (I.key === "0")
        I.preventDefault(), f(rt.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", A, !0), () => window.removeEventListener("keydown", A, !0);
  }, [s, y]), z(() => {
    const A = m.current;
    if (!A) return;
    const I = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), f((E) => Math.max(0, Math.min(rt.length - 1, E + (T.deltaY < 0 ? 1 : -1)))));
    };
    return A.addEventListener("wheel", I, { passive: !1 }), () => A.removeEventListener("wheel", I);
  }, []);
  const w = _(null);
  if (!i) return null;
  const S = xe(i), b = o.map((A) => ({ pane: A, pdf: r[A] ?? null, where: ih(i, n, A) })).filter((A) => !!(A.pdf && A.where)), v = 16, k = typeof window > "u" ? 800 : window.innerHeight, R = Math.min(880, k * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), N = b.length ? lh(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), R, b.map((A) => A.where.aspect)) : 0, F = ((O = b[0]) == null ? void 0 : O.where.page) ?? i.source.page;
  return /* @__PURE__ */ C("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${Mo[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ C("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ C("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ C("span", { className: "reader-zoom-title", children: [
          Mo[S] ?? "这一块",
          " · 第 ",
          F,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ C("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(js, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(Wo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((A) => Math.max(0, A - 1)), children: /* @__PURE__ */ p(Hs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ C(re, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(rt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => f((A) => Math.min(rt.length - 1, A + 1)), children: /* @__PURE__ */ p(Us, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(wt, { size: 16, "aria-hidden": !0 }) })
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
            const I = m.current, T = w.current;
            !I || !T || (I.scrollLeft = T.left - (A.clientX - T.x), I.scrollTop = T.top - (A.clientY - T.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: A, pdf: I, where: T }) => /* @__PURE__ */ C("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: A === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              ts,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: T.page,
                region: T.fraction,
                cssWidth: N * d,
                label: `${A === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, A)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const fh = 380, mh = 320, Et = 8;
function hh(e, t, n) {
  const r = Math.max(Et, Math.min(e.left, n.width - t.width - Et)), o = e.bottom + Et, a = o + t.height <= n.height - Et ? o : Math.max(Et, e.top - Et - t.height);
  return { left: r, top: a };
}
function ph({
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
    const m = r[d], g = m ? ch(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(fh, mh / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = hh(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ C("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ C("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Wr(e.target) }),
      /* @__PURE__ */ C("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(ts, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Wr(e.target) })
  ] });
}
const gh = 4e3;
function bh(e, t, n) {
  if (e.length) {
    const o = pa(e, n), a = o ? ha(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function _o(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Te}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, gh), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function yh(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = At(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = vt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function vh({
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
  const l = e.getAttribute(ke) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? yh(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: bh(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
const No = 5e4, wh = 2e4;
function Nn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function mp(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Sh(e, t = null) {
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
function kh(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Ih(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Th(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Th(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Rh(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Ih(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: kh(o.selection, n),
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
function Eh(e, t, n, r) {
  var c, l, u;
  const o = ((u = (l = (c = e.context) == null ? void 0 : c.meta) == null ? void 0 : l.retainpdf) == null ? void 0 : u.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = { agent_id: e.agentId || null, document_id: a }, i = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...s, role: "user", text: Nn(e.question.text, No), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...s,
      role: "assistant",
      text: Nn(e.answer.text, No),
      thought: e.answer.thought ? Nn(e.answer.thought, wh) : null,
      usage: i,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Ph(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Mh(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function _h(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Nh(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Ah = 50, Lh = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function xh() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function Ao(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Dh({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = P(!1), [i, c] = P(Lh), [l, u] = P(!1), [f, d] = P(""), [m, g] = P("idle"), [h, y] = P(null), [w, S] = P(() => /* @__PURE__ */ new Map()), b = _(/* @__PURE__ */ new Set()), v = _(/* @__PURE__ */ new Map()), k = ($) => {
    if (!$) return null;
    const K = v.current.get($);
    return K || (R.current.records.some((q) => q.message_id === $) ? $ : null);
  }, R = _(i);
  R.current = i;
  const N = _(t);
  N.current = t;
  const F = _(0), O = L(async ($, K, q, te = []) => {
    if (!r) return;
    const ue = await r.messages($.conversation_id, { limit: Ah, ...q ? { beforeSeq: q } : {} }), J = [...ue.messages, ...te];
    F.current += 1, c({
      conversation: $,
      main: K ?? $,
      records: J,
      compactions: ue.compactions || [],
      hasMore: ue.has_more,
      key: `${$.conversation_id}:${F.current}`,
      initial: Rh(J, ue.compactions || [], N.current.documentId)
    });
  }, [r]), A = L(async () => {
    var $;
    if (s(!0), !(!r || (($ = R.current.conversation) == null ? void 0 : $.kind) === "main")) {
      u(!0), d("");
      try {
        const K = await r.main();
        await O(K, K);
      } catch (K) {
        d(K instanceof Error ? K.message : String(K));
      } finally {
        u(!1);
      }
    }
  }, [r, O]), I = L(($) => {
    y($), A();
  }, [A]), T = L(async () => {
    const $ = R.current, K = $.records[0];
    if (!(!$.conversation || !K || !$.hasMore)) {
      u(!0);
      try {
        await O($.conversation, $.main, K.seq, $.records);
      } finally {
        u(!1);
      }
    }
  }, [O]), E = L(async ($) => {
    const q = R.current.conversation;
    if (!r || !q) return;
    for (const se of $.memoryIds) b.current.add(se);
    let te = $.memoryIds;
    if (!te.length && o && $.startedAt) {
      const se = Mh(
        await o.list({ source_conversation_id: q.conversation_id, created_after: Ph($.startedAt) }).catch(() => []),
        b.current
      );
      for (const he of se) b.current.add(he.id);
      te = se.map((he) => he.id);
      const be = $.answerId;
      se.length && be && S((he) => new Map(he).set(be, se));
    }
    const ue = Eh({ ...$, memoryIds: te }, N.current.documentId, xh(), k($.editedFrom));
    let J;
    try {
      J = await r.append(q.conversation_id, ue);
    } catch (se) {
      if (q.kind !== "side" || !/ask_conversation_not_open/.test(Ao(se))) throw se;
      await r.reopen(q.conversation_id), J = await r.append(q.conversation_id, ue);
    }
    const [oe, fe] = J.messages;
    $.questionId && oe && v.current.set($.questionId, oe.message_id), $.answerId && fe && v.current.set($.answerId, fe.message_id), c((se) => {
      var be;
      return ((be = se.conversation) == null ? void 0 : be.conversation_id) === q.conversation_id ? { ...se, conversation: J.conversation, records: [...se.records, ...J.messages] } : se;
    }), n == null || n(J.messages), J.compaction_due && q.kind === "main" && r.compact(q.conversation_id).catch(() => {
    });
  }, [r, o, n]), x = L(async ($) => {
    const K = R.current.conversation, q = k($);
    if (!r || !K || !q) return null;
    try {
      await r.supersede(K.conversation_id, q);
    } catch (J) {
      if (!/ask_message_superseded/.test(Ao(J))) throw J;
    }
    const te = R.current.records.find((J) => J.message_id === q), ue = R.current.records.findIndex((J) => J.message_id === q);
    return c((J) => ({ ...J, records: J.records.map((oe, fe) => fe >= ue && ue >= 0 && !oe.superseded_at ? { ...oe, superseded_at: "now" } : oe) })), (te == null ? void 0 : te.selection) ?? null;
  }, [r]), D = L(($) => {
    E($).catch((K) => d(`这一轮没存上：${K instanceof Error ? K.message : String(K)}`));
  }, [E]), U = L(async ($) => {
    var te;
    const K = R.current, q = K.main;
    if (!(!r || !q || ((te = K.conversation) == null ? void 0 : te.kind) !== "main")) {
      d("");
      try {
        const ue = _h(K.records, $), J = await r.fork({
          parent_id: q.conversation_id,
          ...ue ? { forked_from_message_id: ue } : {},
          title: Nh($.text),
          ...N.current.documentId ? { document_id: N.current.documentId } : {}
        });
        await O(J, q);
      } catch (ue) {
        d(`开不了副对话：${ue instanceof Error ? ue.message : String(ue)}`);
      }
    }
  }, [r, O]), M = L(async ($) => {
    const K = R.current.main;
    if (r)
      try {
        await O(await r.get($), K);
      } catch (q) {
        d(`打不开副对话：${q instanceof Error ? q.message : String(q)}`);
      }
  }, [r, O]), H = L(async () => {
    const $ = R.current.main;
    $ && await O($, $).catch(() => {
    });
  }, [O]), V = L(async () => {
    const $ = R.current.conversation;
    if (!(!r || ($ == null ? void 0 : $.kind) !== "side")) {
      g("busy");
      try {
        await r.close($.conversation_id), g("idle"), await H();
      } catch {
        g("failed");
      }
    }
  }, [r, H]), Y = L(async () => {
    const $ = R.current.main;
    if (!r || !$) return;
    await r.archive($.conversation_id);
    const K = await r.main();
    await O(K, K);
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
    close: L(() => s(!1), []),
    loadEarlier: T,
    onTurn: D,
    rewrite: x,
    fork: U,
    openSide: M,
    backToMain: H,
    closeSide: V,
    archiveMain: Y,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function Lo(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Sh({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Ch({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = P([]), s = _(0), i = _(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  z(() => {
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
      (h) => d(h.map((y) => Lo(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = L((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => Lo(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = L((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const zh = Oo(() => import("./ReaderAskPanel-CBtSKLrh.js"));
function Oh({
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
  var U;
  const f = Z(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), d = L((M, H, V) => {
    const Y = M ? o.find((q) => q.itemId === M) : null, $ = Y ? At(Y, a, H) : null, K = $ && $.box.page === V ? vt($, 1, 1) : null;
    return K ? { x: K.left, y: K.top } : null;
  }, [o, a]), m = Ch({ port: e, documentId: t, resetKey: c, pointOf: d }), g = Dh({ port: e, book: f, onAppended: m.addRecords }), [h, y] = P(null), w = L(
    (M, H, V, Y) => vh({
      pageElement: (M == null ? void 0 : M.closest(`[${Te}]`)) ?? null,
      clientX: H,
      clientY: V,
      itemId: i(),
      selection: Y,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), S = L(() => {
    var H;
    const M = _o(((H = globalThis.getSelection) == null ? void 0 : H.call(globalThis)) ?? null);
    return !M.text || !M.element || !M.rect ? null : w(M.element, M.rect.left + M.rect.width / 2, M.rect.top + M.rect.height / 2, M.text);
  }, [w]), b = L((M) => {
    y(null), g.ask(M);
  }, [g.ask]);
  z(() => {
    if (!e) return;
    const M = (H) => {
      var $;
      if (H.key !== "?" || H.metaKey || H.ctrlKey || H.altKey || H.defaultPrevented) return;
      const V = H.target;
      if (($ = V == null ? void 0 : V.closest) != null && $.call(V, "input, textarea, select, [contenteditable='true']")) return;
      const Y = S();
      Y && (H.preventDefault(), H.stopImmediatePropagation(), b(Y));
    };
    return window.addEventListener("keydown", M, !0), () => window.removeEventListener("keydown", M, !0);
  }, [e, S, b]);
  const v = _(""), k = ((U = g.pending) == null ? void 0 : U.selection) || "";
  z(() => {
    k && (v.current = k);
  }, [k]);
  const R = g.visible && !h, N = g.setPending;
  z(() => {
    if (!R) return;
    let M = null;
    const H = () => {
      M && clearTimeout(M), M = setTimeout(() => {
        const V = S();
        V && V.selection !== v.current && N(V);
      }, 250);
    };
    return document.addEventListener("selectionchange", H), () => {
      M && clearTimeout(M), document.removeEventListener("selectionchange", H);
    };
  }, [R, S, N]);
  const F = L(async (M) => {
    if (M.threadId && (e != null && e.threads) && t) {
      try {
        const H = await e.threads.get(t, M.threadId);
        y({ anchor: H.anchor || M.anchor, messages: H.messages || [], mark: M });
      } catch {
        y({ anchor: M.anchor, messages: [], mark: M });
      }
      return;
    }
    y(null), g.openMain();
  }, [e, t, g.openMain]), [O, A] = P(null), I = L((M, H, V) => {
    var $;
    if (!e) return;
    const Y = _o((($ = globalThis.getSelection) == null ? void 0 : $.call(globalThis)) ?? null);
    A(w(M, H, V, Y.element ? Y.text : ""));
  }, [e, w]), T = e && O ? [{
    key: "ask",
    label: O.selection ? "问这段" : "在这里提问",
    hint: O.selection ? "?" : void 0,
    onSelect: () => b(O)
  }] : [], E = h ? {
    anchor: h.anchor,
    messages: h.messages,
    onClose: () => y(null),
    onDelete: e != null && e.threads && h.mark.threadId ? () => {
      e.threads.remove(t, h.mark.threadId).catch(() => {
      }), m.removeMark(h.mark.key), y(null);
    } : void 0
  } : null, x = !g.persistent || !!g.view.conversation || !!g.error, D = e && (g.visible && x || h) ? /* @__PURE__ */ p(zo, { fallback: null, children: /* @__PURE__ */ p(
    zh,
    {
      port: e,
      jobId: n,
      book: f,
      ask: g,
      legacy: E,
      onShowSelection: ({ page: M, pane: H }) => l(M, H),
      onJumpToPage: (M) => l(M),
      pageCount: u
    }
  ) }) : null;
  return { marks: m.marks, onMark: F, captureMenu: I, menuActions: T, panel: D, open: g.openMain };
}
const $h = 250;
function Fh(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Bh(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function jh(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Hh({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = P(null), [s, i] = P({ back: [], forward: [] }), c = _(s);
  c.current = s;
  const l = _(null), u = _({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = L(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Wt(m, g);
  }, []);
  z(() => {
    if (!e) return;
    const m = (b) => {
      var v, k;
      return (k = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${ga}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var N;
      const v = m(b);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(Bn) || "");
      if (!k) return;
      const R = ((N = v.closest("[data-reader-pane]")) == null ? void 0 : N.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const F = v.getBoundingClientRect();
        a({ target: k, pane: R, anchor: { left: F.left, top: F.top, right: F.right, bottom: F.bottom } });
      }, $h);
    }, y = (b) => {
      const v = m(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, w = (b) => {
      var F, O;
      const v = m(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((F = window.getSelection) == null ? void 0 : F.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(Bn) || "");
      if (!k) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const R = ((O = v.closest("[data-reader-pane]")) == null ? void 0 : O.getAttribute("data-reader-pane")) || u.current.primaryPane, N = f();
      N && i((A) => Fh(A, N)), u.current.follow(k, R);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", w, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = L((m) => {
    const g = f();
    if (!g) return !1;
    const h = Bh(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: w } = u.current;
    return Lt(y, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [f]);
  return z(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || jh(g.target)) return;
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
const Uh = Oo(() => import("./ReaderMarkdownPanel-CEbw5BzX.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Wh = [];
function Kh(e) {
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
function Vh(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function qh() {
  var Sr;
  const e = ml(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Im(e.viewStateKey), s = a.panel, i = a.setPanel, [c, l] = P(!1), u = _(null), f = _(null), d = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = Kh({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: c,
    assistantOpen: d
  }), h = el({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: g.showSource,
    liveTranslationVisible: c,
    assistantOpen: d
  }), y = g.sourceViewOnly, w = g.visibleMode;
  z(() => {
    l(!1);
  }, [e.viewStateKey]), z(() => {
    e.session.jobTerminal && l(!1);
  }, [e.session.jobTerminal]);
  const S = _(null);
  z(() => {
    S.current !== e.viewStateKey && rl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: y,
      jobTerminal: e.session.jobTerminal
    }) && (S.current = e.viewStateKey, l(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, y]), z(() => {
    if (!(t.loading || t.failed)) {
      if (u.current !== e.viewStateKey) {
        u.current = e.viewStateKey;
        const W = Ue(e.viewStateKey), ae = Pm({
          savedMode: W == null ? void 0 : W.mode,
          sourceViewOnly: y,
          viewportWidth: it()
        });
        f.current = ae.auto ? ae.mode : null, ae.mode && ae.mode !== e.mode && e.setModeKeepingPage(ae.mode);
        return;
      }
      Mm(e.mode, f.current) && (f.current = null, bn(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const b = s || (e.mode === "compare" ? "compare" : "reading"), v = Nm(s, "markdown"), { docDark: k, toggleDocDark: R } = ah();
  wl({
    toggleDocDark: R,
    mode: w,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const N = L(() => {
    i(null);
  }, []), F = tl(e.liveTranslation), O = L(() => {
    F && e.goToPage(F, "source");
  }, [e.goToPage, F]), [A, I] = P(null);
  z(() => {
    w === "compare" && e.session.jobTerminal && I(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, w]);
  const T = A !== e.viewStateKey && ol({
    state: e.liveTranslation,
    sourceViewOnly: y,
    visibleMode: w
  }), E = L((W) => {
    const ae = Vh(W, e.liveTranslationAvailable);
    ae !== null && l(ae), e.setModeKeepingPage(W);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), x = Z(() => h.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${c ? " is-active" : ""}`,
      onClick: () => l((W) => !W),
      "aria-pressed": c,
      title: c ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [h.sourcePaneToggle, c]), D = L((W) => {
    i(W);
  }, []), [U] = P(Am), [M, H] = P(null), V = L((W) => H((ae) => ae === W ? null : W), []), [Y, $] = P(""), [K, q] = P("");
  z(() => {
    const W = Y.replace(/\s+/gu, " ").trim(), ae = window.setTimeout(() => q(W), W ? 150 : 0);
    return () => window.clearTimeout(ae);
  }, [Y]);
  const [te, ue] = P(0), J = L(() => {
    H("search"), ue((W) => W + 1);
  }, []);
  Xm(J);
  const oe = L((W) => {
    e.jumpToAnchor({ block_id: W }), (M === "outline" || it() < 900) && H(null);
  }, [e.jumpToAnchor, M]), fe = L((W) => e.jumpToAnchor({ block_id: W }), [e.jumpToAnchor]), [se, be] = P({}), he = _({ source: r.sourceUrl, translated: r.translatedUrl });
  he.current = { source: r.sourceUrl, translated: r.translatedUrl };
  const We = L((W, ae) => {
    be((Ve) => ({ ...Ve, [ae]: { url: he.current[ae], nodes: W } }));
  }, []), tt = Z(() => {
    const W = se.source;
    if (W && W.url === r.sourceUrl && W.nodes.length) return W.nodes;
    const ae = se.translated;
    return ae && ae.url === r.translatedUrl && ae.nodes.length ? ae.nodes : Wh;
  }, [se, r.sourceUrl, r.translatedUrl]), De = _({}), [ce, pe] = P(0), ye = L((W, ae) => {
    De.current[ae] = { url: he.current[ae], pdf: W }, pe((Ve) => Ve + 1);
  }, []), [j, ne] = P(null), ie = L((W) => ne(W), []), Ce = L(() => ne(null), []);
  z(() => ne(null), [e.viewStateKey]);
  const Ee = Z(() => {
    const W = (ae, Ve) => {
      const dt = De.current[ae];
      return dt && dt.url === Ve ? dt.pdf : null;
    };
    return { source: W("source", r.sourceUrl), translated: W("translated", r.translatedUrl) };
  }, [ce, r.sourceUrl, r.translatedUrl]), Pe = Z(() => Ql(o.regions), [o.regions]), ze = L(
    (W, ae) => e.jumpToAnchor({ block_id: W.itemId }, ae),
    [e.jumpToAnchor]
  ), Me = Hh({ shellEl: e.shell.shellEl, index: Pe, primaryPane: e.panes.primaryPane, follow: ze }), Oe = L((W) => {
    e.goToPage(W), (M === "outline" || it() < 900) && H(null);
  }, [e.goToPage, M]), we = eh({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), _e = we.select, Fe = e.setModeKeepingPage, Ke = o.regions, Be = L((W) => {
    gu(Ke, W) && (w === "source" && Fe("compare"), _e(W));
  }, [Ke, _e, w, Fe]);
  th(we.available ? Be : null, U);
  const Ne = sd(e.viewStateKey);
  Um(Ne);
  const [nt, ut] = P(null), B = L(() => ut(null), []), G = qm({ documentId: o.documentId, jobId: o.jobId }), Q = Z(() => {
    try {
      return Qe().ask ?? null;
    } catch {
      return null;
    }
  }, []), ee = Oh({
    port: Q,
    documentId: o.documentId || "",
    jobId: o.jobId,
    versionId: G.readingVersionId || null,
    regions: o.regions,
    metadata: o.readerMetadata,
    bookmarks: tt,
    hoveredItemId: () => U.get().itemId,
    resetKey: e.viewStateKey,
    goToPage: e.goToPage,
    pageCount: n.hudNumPages || 0
  }), de = ee.marks, X = ee.onMark, le = ((Sr = G.compared) == null ? void 0 : Sr.url) || "";
  z(() => {
    le && w !== "compare" && E("compare");
  }, [le]), z(() => {
    w !== "compare" && G.clear();
  }, [w]);
  const ve = Z(
    () => {
      const { compared: W, versions: ae, readingVersionId: Ve } = G;
      if (!W) return null;
      const dt = ae.find((yn) => yn.versionId === W.versionId), It = ae.find((yn) => yn.versionId === Ve);
      return {
        url: W.url,
        regions: W.regions,
        left: { name: W.name, createdAt: (dt == null ? void 0 : dt.createdAt) || "" },
        right: { name: (It == null ? void 0 : It.name) || "当前译文", createdAt: (It == null ? void 0 : It.createdAt) || "" }
      };
    },
    [G.compared, G.versions, G.readingVersionId]
  ), wr = Z(() => {
    if (!we.savedCounts.size) return e.revisedBlocks;
    const W = new Map(e.revisedBlocks);
    for (const [ae, Ve] of we.savedCounts) W.set(ae, (W.get(ae) || 0) + Ve);
    return W;
  }, [e.revisedBlocks, we.savedCounts]), ns = Z(() => ({
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
    regions: o.regions,
    readerMetadata: o.readerMetadata,
    activeRegion: e.activeRegion,
    regionHover: U,
    jumpToBlock: fe,
    revisedBlocks: wr,
    onPdfOutline: We,
    onPdfDocument: ye,
    zoomBlock: ie,
    xrefIndex: Pe,
    askMarks: de,
    onAskMark: X,
    editBlock: we.available ? Be : void 0,
    blockEdit: we,
    editShowsSource: w !== "compare",
    findTerm: M === "search" ? K : "",
    compareVersion: ve,
    ink: Ne,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: y,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: D, close: N },
    docDark: k,
    toggleDocDark: R
  }), [
    e.shell,
    e.userZoom,
    e.onZoomChange,
    e.rowHeights,
    e.panes,
    e.sessionFiles,
    o.regions,
    o.readerMetadata,
    e.activeRegion,
    U,
    fe,
    wr,
    We,
    ye,
    ie,
    Pe,
    de,
    X,
    we,
    Be,
    w,
    M,
    K,
    ve,
    Ne,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    D,
    N,
    k,
    R
  ]), rs = Z(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), os = [
    Ki,
    `is-workspace-${b}`,
    d ? "is-assistant-open" : "",
    M ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(md, { value: ns, hud: rs, children: /* @__PURE__ */ C(
    "div",
    {
      className: os,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": b,
      "data-ink-mode": Ne.tool || void 0,
      onContextMenu: (W) => {
        const ae = Hm(W);
        ae && (W.preventDefault(), ee.captureMenu(W.target, W.clientX, W.clientY), ut(ae));
      },
      children: [
        /* @__PURE__ */ p(Vf, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(Cm, { open: M, onToggle: V }),
        M ? /* @__PURE__ */ p(
          Om,
          {
            tab: M,
            onTab: H,
            onClose: () => H(null),
            onJump: oe,
            bookmarks: tt,
            onJumpPage: Oe,
            query: Y,
            onQuery: $,
            term: K,
            focusSignal: te
          }
        ) : null,
        /* @__PURE__ */ C("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(tm, {}),
          /* @__PURE__ */ p(Pl, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Zd,
          {
            mode: w,
            documentReady: !!o.jobId,
            sourceViewOnly: y,
            onModeChange: E,
            liveTranslation: h.topBarPill ? {
              visible: c,
              state: e.liveTranslation,
              onToggle: () => l((W) => !W),
              latestPage: c ? F : null,
              currentPage: e.currentPage,
              onJumpToLatest: O
            } : null,
            completion: T ? {
              onOpenCompare: () => {
                I(e.viewStateKey), E("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(rf, { active: s }),
        d ? /* @__PURE__ */ p(Wf, {}) : null,
        /* @__PURE__ */ p(qd, { paneComposition: g, markdownSplit: v.open, assistantSplit: d, liveTranslation: e.liveTranslation, sourcePaneAction: x }),
        e.showHud ? /* @__PURE__ */ p(
          Sm,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(zm, { open: M, onToggle: V })
          }
        ) : null,
        /* @__PURE__ */ p(zo, { fallback: null, children: v.mounted ? /* @__PURE__ */ p(Uh, { open: v.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: N }) : null }),
        Me.preview ? /* @__PURE__ */ p(ph, { preview: Me.preview, regions: o.regions, metadata: o.readerMetadata, documents: Ee }) : null,
        Me.canGoBack ? /* @__PURE__ */ C(re, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => Me.goBack(), children: [
          /* @__PURE__ */ p(Ws, { size: 14, "aria-hidden": !0 }),
          " 回到第 ",
          Me.backPage,
          " 页"
        ] }) : null,
        j ? /* @__PURE__ */ p(
          dh,
          {
            itemId: j,
            regions: o.regions,
            metadata: o.readerMetadata,
            documents: Ee,
            panes: w === "compare" ? ["source", "translated"] : w === "translated" ? ["translated"] : ["source"],
            onNavigate: ne,
            onClose: Ce
          }
        ) : null,
        /* @__PURE__ */ p($m, { active: s, compare: G, ink: Ne }),
        /* @__PURE__ */ p(
          Bm,
          {
            ink: Ne,
            menu: nt,
            onClose: B,
            actions: ee.menuActions
          }
        ),
        ee.panel,
        /* @__PURE__ */ p(jm, { ink: Ne }),
        /* @__PURE__ */ p(nh, { edit: we }),
        /* @__PURE__ */ p(Em, {})
      ]
    }
  ) });
}
function hp() {
  return /* @__PURE__ */ p(qh, {});
}
export {
  hp as R,
  qh as a,
  mp as b,
  fp as c,
  dp as d,
  lp as f,
  up as r,
  Sh as s,
  et as u
};
//# sourceMappingURL=ReaderApp-smKzw4A1.js.map
