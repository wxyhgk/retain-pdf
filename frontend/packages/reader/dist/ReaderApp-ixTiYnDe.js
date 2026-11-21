var Xn = (e) => {
  throw TypeError(e);
};
var Qn = (e, t, n) => t.has(e) || Xn("Cannot " + n);
var gt = (e, t, n) => (Qn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), er = (e, t, n) => t.has(e) ? Xn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), tr = (e, t, n, r) => (Qn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as nt } from "react/jsx-runtime";
import { useMemo as q, useState as N, useEffect as x, useCallback as O, useRef as A, useLayoutEffect as Se, memo as Gt, createContext as Mn, useContext as An, forwardRef as Xr, useImperativeHandle as _n, useSyncExternalStore as Qr, useId as eo, Suspense as la, lazy as ca } from "react";
import { requireAdapter as ht, getReaderAdapters as Te } from "./adapters.js";
import { resolveReaderDownloadName as da, resolveReaderDownloadUrls as ua, READER_PROGRESS_COPY as De, trimString as jt, READER_DOWNLOAD_ACTIONS as fa, disabledReason as ma } from "./runtime/state.js";
import { r as ha, b as pa } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as mn, isFinishedJobStatus as Rt } from "@retainpdf/domain/job";
import { n as to, d as ga, f as en, k as nr, b as ba, c as ya, j as Zt, p as Ln, g as va, l as rr, i as wa } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as Sa } from "@retainpdf/api/documents";
import { isReaderTransportError as Ia, createReaderTransportError as Ra } from "./contracts.js";
import { toast as hn, Toaster as Ea } from "sonner";
import { X as pt, PenLine as Dn, Check as no, Copy as Pa, ChevronUp as Ta, ChevronDown as ro, History as ka, LoaderCircle as Na, Pin as Ma, LogOut as Aa, Radio as _a, FileText as oo, Columns2 as ao, Languages as so, Keyboard as La, Download as Da, ListOrdered as Ca, TriangleAlert as xa, ListTree as za, Search as Oa, GitCompareArrows as $a, LayoutGrid as Fa, Highlighter as Ba, Eraser as ja, Undo2 as Ua, Trash2 as Ha } from "lucide-react";
import { Button as oe, Textarea as Wa, IconButton as or, Input as io } from "@retainpdf/ui";
import { pdfjs as lo, Page as Va, Document as Ka } from "react-pdf";
import { e as Ja, m as qa, a as Ga } from "./markdown-math-XkF5urpn.js";
const Za = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ya = "", Xa = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Qa = (e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Pf = (...e) => {
  var n;
  return (((n = Te()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Ce = () => ht("defaultReaderDataPort"), ar = () => ht("defaultReaderPageConfigPort"), Tf = {
  get apiPrefix() {
    return Ce().apiPrefix;
  },
  fetchProtected: (...e) => Ce().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ce().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ce().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ce().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ce().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ce().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ce().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ce().liveTranslation;
  }
}, co = {
  messageTargetOrigin: () => ar().messageTargetOrigin(),
  readerJobId: () => ar().readerJobId()
}, es = () => {
  var e;
  return ((e = Te()) == null ? void 0 : e.liveTranslation) ?? null;
}, Et = () => {
  var t;
  const e = Te();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, qe = () => {
  const e = Te();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => ht("fetchDocumentByJobId")(...n),
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
}, ts = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ns = () => {
  var e, t;
  return ((t = (e = Te()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, rs = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, os = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? da(...e);
}, as = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ua(...e);
}, ss = (...e) => ht("downloadProtectedResource")(...e), is = (...e) => ht("failDownloadToast")(...e), kf = (e, t) => ht("resolveMarkdownAssetUrl")(e, t), sr = "/api/v1";
function ls() {
  const e = () => {
    var r;
    return ha(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
  return x(() => {
    var i, l, c, d;
    const r = () => n(e()), o = (l = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : l.bind(globalThis.history), a = (d = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : d.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (u) => function(...m) {
          const y = u.apply(this, m);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), y;
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
function cs() {
  const e = ls(), t = q(() => rs(co), [e]), n = q(() => ns(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function ds(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [l, c] = N({
    documentId: "",
    jobId: ""
  }), [d, f] = N({
    documentId: "",
    jobId: ""
  }), u = l.documentId === t ? l.jobId : "", m = d.documentId === t ? d.jobId : "", y = n || u, [h, v] = N({
    jobId: "",
    documentId: ""
  }), w = h.jobId === y ? h.documentId : "", g = t || w, S = !!t && !y, [b, I] = N(null), E = (b == null ? void 0 : b.sessionIdentity) === r && b.documentId === g ? b : null, k = S || !!E, $ = O((B) => {
    const R = `${B.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      v({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const P = `${B.revision || ""}`.trim() || `${Date.now()}`;
    I({
      documentId: R,
      revision: P,
      sessionIdentity: o.current
    }), i();
  }, []);
  x(() => {
    I((B) => B && B.sessionIdentity !== r ? null : B);
  }, [r]);
  const D = O((B) => {
    switch (B.type) {
      case "resolved-document-job":
        c({ documentId: B.documentId, jobId: B.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: B.documentId, jobId: B.jobId });
        break;
      case "resolved-job-document":
        v((R) => R.jobId === B.jobId && R.documentId === B.documentId ? R : { jobId: B.jobId, documentId: B.documentId });
        break;
      case "committed-source":
        I({
          documentId: B.documentId,
          revision: B.revision,
          sessionIdentity: B.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: l,
    setResolvedDocumentJob: c,
    missingDocumentJob: d,
    setMissingDocumentJob: f,
    documentJobId: u,
    rejectedDocumentJobId: m,
    sessionJobId: y,
    resolvedJobDocument: h,
    setResolvedJobDocument: v,
    jobDocumentId: w,
    documentId: g,
    sourceOnly: S,
    committedDocumentSource: b,
    setCommittedDocumentSource: I,
    activeCommittedDocumentSource: E,
    sourceViewOnly: k,
    refreshCommittedDocument: $,
    applyIdentityEvent: D
  };
}
function ir(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function us(e) {
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
    const l = `${i || ""}`.trim();
    if (l) return l;
  }
  return "";
}
function lr(e, t) {
  return Qa(mn(e, t));
}
function fs(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function ms(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !fs(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function pn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Xa.progress,
        stage: n,
        percent: e,
        text: t
      },
      co.messageTargetOrigin()
    );
  } catch {
  }
}
function Ut(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), pn({ percent: t, text: n, stage: r });
}
function hs(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = N(null), [c, d] = N(null), [f, u] = N(""), [m, y] = N(0), h = f === n ? i : null, v = f === n ? c : null, w = ir(h), g = Rt(w), S = O(() => {
    y((D) => D + 1);
  }, []), b = O((D) => {
    l(D.jobPayload), d(D.manifestPayload), u(D.sessionIdentity);
  }, []), I = O((D) => {
    l(null), d(null), u(D);
  }, []), E = A(""), k = A(""), $ = O(async () => {
    const D = o.current;
    if (!D || E.current === D) return;
    const B = qe().loadJobPayload;
    if (typeof B != "function") return;
    const R = a.current.value;
    E.current = D;
    try {
      const P = await B(D);
      if (s.current || a.current.value !== R || o.current !== D || !P || typeof P != "object")
        return;
      const T = ir(P);
      l(P), u(r.current), !Rt(T) && k.current === D && (k.current = ""), T === "succeeded" && k.current !== D && (k.current = D, y((M) => M + 1));
    } catch {
    } finally {
      E.current === D && (E.current = "");
    }
  }, []);
  return x(() => {
    k.current = "";
  }, [n]), x(() => {
    if (!t || g || !h) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && $();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [g, $, h, t]), {
    jobPayload: i,
    setJobPayload: l,
    manifestPayload: c,
    setManifestPayload: d,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: u,
    scopedJobPayload: h,
    scopedManifestPayload: v,
    jobStatus: w,
    jobTerminal: g,
    jobRefreshRevision: m,
    refreshJobArtifacts: S,
    refreshJobStatus: $,
    publishPayload: b,
    clearPayload: I
  };
}
function gn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function ps(e, t) {
  e(t), gn(t);
}
function gs(e) {
  const [t, n] = N(e ? "source" : "compare"), r = O((a) => {
    e && a !== "source" || (n(a), gn(a));
  }, [e]), o = O((a) => {
    ps(n, a);
  }, []);
  return x(() => (e && document.documentElement.classList.add("reader-source-only"), gn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function cr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function bs(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: cr(n.active_job_id),
    activeVersionId: cr(n.active_version_id)
  };
}
function ys(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function vs(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function ws(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ss = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Is(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ss.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Rs = 48 * 1024 * 1024;
function Es(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ps = 2, we = /* @__PURE__ */ new Map();
function bn(e, t) {
  we.delete(e), we.set(e, t);
}
function dr(e) {
  if (we.size < Ps) return;
  const t = we.keys().next().value;
  t && we.delete(t);
}
async function Ts(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function uo(e, t = Et().fetchProtected, n = {}) {
  var d, f, u, m, y, h, v, w, g;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (we.has(r)) {
    const S = we.get(r);
    return bn(r, S), S;
  }
  const o = new AbortController(), a = () => o.abort();
  (d = n.signal) != null && d.aborted && o.abort(), (u = (f = n.signal) == null ? void 0 : f.addEventListener) == null || u.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (y = (m = n.signal) == null ? void 0 : m.removeEventListener) == null || y.call(m, "abort", a);
  }
  if (!s.ok) {
    const S = new Error(`读取 PDF 失败 (${s.status})`);
    S.status = s.status;
    const b = await Ts(s);
    throw b && (S.reason = b), S;
  }
  const i = ks(r, s, t);
  if (i) {
    o.abort();
    const S = { ranged: i };
    return dr(), we.set(r, S), S;
  }
  (v = (h = n.signal) == null ? void 0 : h.addEventListener) == null || v.call(h, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (g = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || g.call(w, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return we.has(r) ? bn(r, c) : (dr(), we.set(r, c)), c;
}
function ks(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Rs ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const Ns = { file: null, loading: !1, error: "" }, Ms = { file: null, loading: !0, error: "" };
function As(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (x(() => {
    if (t || !n) return;
    const s = we.get(n);
    if (s) {
      bn(n, s);
      return;
    }
    const i = new AbortController();
    return uo(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ns;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = we.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ms;
}
function _s(e) {
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
async function yn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Ut(s, r, n, "download");
  const i = await uo(t, Et().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Ut(s, o, n, "download"), i);
}
async function Ls(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Ut(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    yn({
      url: t,
      label: "正在下载原文 PDF…",
      percentStart: 30,
      percentEnd: 55,
      fence: r,
      setBoot: o
    }).then((d) => {
      s = d;
    })
  ), n && a.push(
    yn({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: o
    }).then((d) => {
      i = d;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !i ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: i };
}
function Ds(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Cs({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Sa,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Ds(o.href, t, a)), !0);
}
const Ct = {
  regions: null,
  metadata: null
};
function xs(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: o,
    rejectedDocumentJobId: a,
    sourceOnly: s,
    locationKey: i,
    sessionIdentity: l,
    committedSource: c,
    applyIdentityEvent: d,
    publishPayload: f,
    clearPayload: u,
    switchSessionMode: m,
    jobRefreshRevision: y,
    sessionEpochRef: h,
    closingRef: v,
    activeLoadAbortRef: w
  } = e, [g, S] = N(""), [b, I] = N(""), [E, k] = N(null), [$, D] = N(null), [B, R] = N(!1), [P, T] = N(""), [M, _] = N([]), [U, F] = N(!1), [G, ne] = N(() => ({
    source: null,
    translated: null
  })), [X, Q] = N(
    Ct
  ), [fe, ce] = N({
    loading: !0,
    percent: 4,
    text: De.boot,
    stage: "progress",
    failed: !1
  });
  return x(() => {
    const de = new AbortController(), me = h.current.value, K = _s({
      sessionEpochRef: h,
      closingRef: v,
      abort: de,
      sessionEpoch: me
    });
    w.current = de;
    const ee = qe();
    if (v.current)
      return de.abort(), () => {
        w.current === de && (w.current = null);
      };
    let he = !1;
    function te(z, Z) {
      K.markFailed(), F(!0), ce({
        loading: !1,
        percent: 100,
        text: z,
        stage: "failed",
        failed: !0
      }), pn({ percent: 100, text: Z, stage: "failed" });
    }
    function ke() {
      R(!0), he || F(!0), ce({
        loading: !1,
        percent: 100,
        text: De.ready,
        stage: "ready",
        failed: !1
      }), pn({ percent: 100, text: De.ready, stage: "ready" });
    }
    function Fe() {
      return c != null && c.documentId ? lr(
        c.documentId,
        c.revision
      ) : Za() ? Ya : ee.resolveResourceUrl(mn(r));
    }
    async function Ie() {
      var le;
      let z = { activeJobId: "", activeVersionId: "" };
      try {
        const ie = await ((le = ee.fetchDocument) == null ? void 0 : le.call(ee, r));
        ie && (z = bs(ie));
      } catch {
      }
      const Z = ys({
        link: z,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (Z.kind === "follow-active-job") {
        if (K.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: Z.jobId
        }), Z.activeVersionId ? (c || d({
          type: "committed-source",
          documentId: r,
          revision: Z.activeVersionId,
          sessionIdentity: l
        }), m("source")) : m("compare");
        return;
      }
      if (Z.kind === "open-committed-source") {
        if (K.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: Z.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const j = Fe();
      if (K.isInactive()) return;
      S(j), I(""), T(""), u(l);
      const H = await yn({
        url: j,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: K,
        setBoot: ce
      });
      if (!K.isInactive()) {
        if (!H) {
          te("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        k(H), ke();
      }
    }
    async function Re() {
      var J;
      const z = !c, Z = !!(z && ee.loadSessionSnapshot && ee.loadReaderOptionalArtifacts), j = Z ? ee.loadReaderOptionalArtifacts(t) : null, H = await ((J = ee.loadSessionSnapshot) == null ? void 0 : J.call(ee, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: z && !Z
      })), le = H ? {
        jobPayload: H.sourcePayload,
        manifestPayload: H.manifestPayload,
        readerMetadata: H.readerMetadata,
        regionsPayload: H.regions,
        readerErrors: H.readerErrors
      } : await ee.loadReaderPayload(t, {
        includeOptionalArtifacts: z
      });
      if (K.isInactive()) return;
      let ie = null;
      if (n && !r)
        if (H && H.linkedDocument !== void 0)
          ie = H.linkedDocument;
        else {
          try {
            ie = await ee.fetchDocumentByJobId(sr, t);
          } catch {
          }
          if (K.isInactive()) return;
        }
      const pe = us(le.jobPayload) || `${(ie == null ? void 0 : ie.document_id) || ""}`.trim();
      pe && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: pe
      });
      const ve = vs({
        payloadDocumentId: pe,
        linkedActiveJobId: `${(ie == null ? void 0 : ie.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ie == null ? void 0 : ie.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (ve.kind === "restore-committed-source") {
        if (K.isInactive()) return;
        d({
          type: "committed-source",
          documentId: ve.documentId,
          revision: ve.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const Ne = ee.resolveReaderSourcePdf(le.manifestPayload), at = ee.resolveReaderTranslatedPdfUrl(le.jobPayload, le.manifestPayload), Qt = typeof Ne == "string" ? Ne : ee.resolveReaderArtifactUrl(Ne), Be = r || pe, je = c != null && c.documentId ? lr(
        c.documentId,
        c.revision
      ) : Qt || (Be ? ee.resolveResourceUrl(mn(Be)) : ""), Ge = c ? "" : at || "";
      S(je || ""), I(Ge), T(ms(le.jobPayload, t)), f({
        jobPayload: le.jobPayload || null,
        manifestPayload: le.manifestPayload || null,
        sessionIdentity: l
      });
      const _t = () => Ls({
        sourceFinal: je || "",
        translatedFinal: Ge,
        fence: K,
        setBoot: ce
      }), Lt = !!(je || Ge), st = j && Lt ? _t() : null;
      st == null || st.catch(() => {
      });
      const Dt = (V) => {
        K.isInactive() || (_(c ? [] : to(V.regionsPayload)), ne(c ? { source: null, translated: null } : ga(V.readerMetadata)), Q(c ? Ct : V.readerErrors ?? Ct), F(!0));
      };
      if (j ? (he = !0, j.then(Dt)) : Dt(le), !Lt) {
        te(De.failed, De.failed);
        return;
      }
      const C = await (st ?? _t());
      if (C.status !== "inactive") {
        if (C.status === "incomplete") {
          te("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        k(C.sourceBytes), D(C.translatedBytes), ke();
      }
    }
    async function Ee() {
      R(!1), k(null), D(null), _([]), F(!1), ne({ source: null, translated: null }), Q(Ct), Ut(ce, 8, De.metadata, "metadata");
      try {
        if (s) {
          await Ie();
          return;
        }
        if (!t) {
          te(De.failed, De.failed);
          return;
        }
        await Re();
      } catch (z) {
        if (K.isClosedOrStale() || (z == null ? void 0 : z.name) === "AbortError") return;
        K.markFailed();
        const Z = Number(z == null ? void 0 : z.status), j = `${(z == null ? void 0 : z.reason) || ""}`, H = Is({ status: Z, reason: j, sessionJobId: t });
        if (H && (await Cs({
          apiPrefix: sr,
          documentId: H,
          expiredJobId: t
        }) || K.isClosedOrStale()))
          return;
        if (ws({
          status: Z,
          reason: j,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const le = z instanceof Error ? z.message : De.failed;
        te(le, le);
      }
    }
    return Ee(), () => {
      de.abort(), w.current === de && (w.current = null);
    };
  }, [t, r, o, a, s, i, c, y, n, l, d, f, u, m]), {
    sourceUrl: g,
    translatedUrl: b,
    sourceFile: E,
    translatedFile: $,
    assetsReady: B,
    title: P,
    regions: M,
    regionsSettled: U,
    readerMetadata: G,
    readerErrors: X,
    boot: fe
  };
}
function zs() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = cs(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), l = A(""), c = A(""), d = A(() => {
  }), f = O(() => d.current(), []), u = ds({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: l,
    sessionJobIdRef: c,
    switchToSourceMode: f
  }), {
    sessionJobId: m,
    documentId: y,
    sourceOnly: h,
    sourceViewOnly: v
  } = u, { mode: w, setMode: g, switchSessionMode: S } = gs(v);
  d.current = () => {
    S("source");
  }, i.current = a, l.current = y, c.current = m;
  const b = hs({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: I,
    scopedManifestPayload: E,
    jobStatus: k,
    jobTerminal: $,
    jobRefreshRevision: D,
    refreshJobArtifacts: B,
    refreshJobStatus: R
  } = b, P = xs({
    sessionJobId: m,
    jobId: r,
    routeDocumentId: o,
    documentJobId: u.documentJobId,
    rejectedDocumentJobId: u.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: a,
    committedSource: u.activeCommittedDocumentSource,
    applyIdentityEvent: u.applyIdentityEvent,
    publishPayload: b.publishPayload,
    clearPayload: b.clearPayload,
    switchSessionMode: S,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = O(() => {
    var _;
    e.current = !0, (_ = t.current) == null || _.abort();
  }, []), M = q(
    () => ({
      fetchProtected: qe().fetchProtected,
      jobId: m,
      jobPayload: I,
      manifestPayload: E,
      sourceUrl: P.sourceUrl,
      translatedUrl: P.translatedUrl,
      sourceOnly: v
    }),
    [m, I, E, P.sourceUrl, P.translatedUrl, v]
  );
  return {
    jobId: m,
    jobStatus: k,
    workflow: `${(I == null ? void 0 : I.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: $,
    documentId: y,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
    setMode: g,
    sourceUrl: P.sourceUrl,
    translatedUrl: P.translatedUrl,
    sourceFile: P.sourceFile,
    translatedFile: P.translatedFile,
    assetsReady: P.assetsReady,
    boot: P.boot,
    title: P.title,
    regions: P.regions,
    regionsSettled: P.regionsSettled,
    readerMetadata: P.readerMetadata,
    readerErrors: P.readerErrors,
    download: M,
    refreshJobArtifacts: B,
    refreshJobStatus: R,
    refreshCommittedDocument: u.refreshCommittedDocument,
    prepareClose: T
  };
}
const Os = 160, $s = 8, Fs = 0;
function Bs() {
  const e = A(null), [t, n] = N(null), [r, o] = N(Fs), a = O((s) => {
    e.current = s, n(s);
  }, []);
  return x(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < Os || o((d) => Math.abs(d - c) < $s ? d : c);
    }, l = new ResizeObserver((c) => {
      var d, f;
      i(((f = (d = c[0]) == null ? void 0 : d.contentRect) == null ? void 0 : f.width) ?? s.clientWidth);
    });
    return l.observe(s), i(s.clientWidth), () => l.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function js(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: o, hasTranslated: a } = e, s = r && o, i = r && a && !n, l = t === "source" || t === "compare", c = !n && (t === "translated" || t === "compare");
  return {
    mountSource: s,
    mountTranslated: i,
    showSource: l,
    showTranslated: c,
    compareMode: t === "compare" && l && c && s && i,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
const tn = { source: 0, translated: 0 };
function Us(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: l
  } = e, c = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, d = A(c);
  d.current = c;
  const [f, u] = N(() => ({
    identity: c,
    pages: tn
  })), [m, y] = N(() => ({ identity: c, tick: 0 })), h = f.identity === c ? f.pages : tn, v = m.identity === c ? m.tick : 0, w = js({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: g } = w, S = O((R, P) => {
    d.current === c && u((T) => {
      const M = T.identity === c ? T.pages : tn;
      return M[P] === R && T.identity === c ? T : {
        identity: c,
        pages: { ...M, [P]: R }
      };
    });
  }, [c]), b = A(null), I = O(() => {
    b.current && clearTimeout(b.current);
    const R = c;
    b.current = setTimeout(() => {
      b.current = null, d.current === R && y((P) => ({
        identity: R,
        tick: P.identity === R ? P.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  x(() => (b.current && (clearTimeout(b.current), b.current = null), u((R) => R.identity === c && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: c, pages: { source: 0, translated: 0 } }), y((R) => R.identity === c && R.tick === 0 ? R : { identity: c, tick: 0 }), () => {
    b.current && (clearTimeout(b.current), b.current = null);
  }), [c]);
  const E = q(
    () => Math.max(h.source, h.translated),
    [h]
  ), k = g === "translated" ? h.translated : h.source || h.translated, $ = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, B = `${c}-${v}-${$}-${n}-${h.source}-${h.translated}-${D}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: E,
    primaryNumPages: k,
    metricsTick: v,
    onNumPages: S,
    onMetrics: I,
    rowSyncRevision: B
  };
}
const Le = "data-reader-page", Ke = "data-reader-pane", Cn = "data-natural-height", Hs = "reader-react-root", Ws = "reader-react-grid", fo = "reader-react-scroll-shell", Vs = "reader-react-pdf-pane", mo = "reader-react-pdf-page", Ht = "reader-react-pdf-page-placeholder", xn = "reader-react-pdf-page-slot";
function Wt(e, t) {
  const n = e != null ? `[${Le}="${e}"]` : `[${Le}]`;
  return t ? `${n}[${Ke}="${t}"]` : n;
}
function Ks() {
  return `.${xn}[${Le}]`;
}
function Vt(e) {
  return Number(e.getAttribute(Le));
}
const ho = 0.25, Kt = 1, Js = 0.05, At = 0.5, qs = 16, Gs = 8, Zs = 720;
function Ye() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function po(e) {
  return Number.isFinite(e) && e < Zs;
}
function ct(e, t = Number.POSITIVE_INFINITY) {
  return po(t) && (e === "source" || e === "translated") ? Kt : At;
}
function Yt(e) {
  return Number.isFinite(e) ? Math.min(Kt, Math.max(ho, e)) : At;
}
function Pt(e, t) {
  const n = Yt(Number(e) + t * Js);
  return Math.round(n * 100) / 100;
}
function Ys(e) {
  return Math.round(Yt(e) * 100);
}
function Xs(e) {
  const n = (Number(e) || 0) - qs - Gs;
  return Math.max(160, Math.floor(n));
}
function Qs(e, t = At) {
  const n = Yt(t);
  return Xs((Number(e) || 0) * n);
}
function ei(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Ke}]`)
  ).map((s) => ({
    pane: s,
    cx: s.scrollLeft + s.clientWidth / 2,
    hadOverflow: s.scrollWidth > s.clientWidth + 1
  })), a = () => {
    e.scrollLeft = Math.max(0, n * t - e.clientWidth / 2), e.scrollTop = Math.max(0, r * t - e.clientHeight / 2);
    for (const { pane: s, cx: i, hadOverflow: l } of o) {
      const c = Math.max(0, s.scrollWidth - s.clientWidth);
      if (c <= 0) {
        s.scrollLeft = 0;
        continue;
      }
      l ? s.scrollLeft = Math.min(
        c,
        Math.max(0, i * t - s.clientWidth / 2)
      ) : s.scrollLeft = c / 2;
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(a);
  });
}
const ti = 8;
function ni(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < ti ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const go = 200, bo = [
  "markdown"
], ri = bo;
function yo(e) {
  return ri.includes(e);
}
const oi = "retainpdf:reader:view:v1:", ur = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), ai = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function vo() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function vn(e) {
  return `${e || ""}`.trim();
}
function si({
  documentId: e,
  jobId: t
}) {
  const n = vn(e);
  if (n) return `document:${n}`;
  const r = vn(t);
  return r ? `job:${r}` : "";
}
function wo(e) {
  const t = vn(e);
  return t ? `${oi}${t}` : "";
}
function ii(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function li(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!ur.has(t) || !ur.has(n) || t === n))
    return { left: t, right: n };
}
function ci(e) {
  return e === null ? null : yo(e) ? e : void 0;
}
function di(e) {
  return ai.has(e) ? e : void 0;
}
function So(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = ii(t.anchor), r = Number(t.zoom), o = di(t.mode), a = li(t.splitLayout), s = ci(t.assistantPanel);
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
function _e(e, t = vo()) {
  const n = wo(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? So(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Xt(e, t, n = vo()) {
  const r = wo(e);
  if (!r || !n) return null;
  const o = _e(e, n), a = So({
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
function ui(e, t, n = "") {
  var u;
  const [r, o] = N(() => {
    var m;
    return ((m = _e(n)) == null ? void 0 : m.zoom) ?? ct(e, Ye());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), l = A(((u = _e(n)) == null ? void 0 : u.zoom) !== void 0);
  x(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = _e(n)) == null ? void 0 : h.zoom;
    l.current = m !== void 0;
    const y = m ?? ct(e, Ye());
    i.current = 1, a.current = y, o(y);
  }, [e, n]), x(() => {
    if (l.current) return;
    const m = ct(e, Ye()), y = a.current;
    Math.abs(m - y) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const c = O((m) => {
    const y = Yt(m), h = a.current;
    Math.abs(y - h) < 5e-4 || (i.current = y / (h || 1), l.current = !0, Xt(s.current, { zoom: y }), o(y));
  }, []), d = O((m) => {
    c(Pt(a.current, m));
  }, [c]), f = O((m) => {
    c(ct(m));
  }, [c]);
  return Se(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, ei(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: d, resetZoom: f };
}
function fi(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: O((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const zn = 48;
function Io(e, t = zn) {
  return e.getBoundingClientRect().top + t;
}
function Ro(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const l of e) {
    const c = l.getBoundingClientRect();
    c.height < 8 || c.width < 8 || c.top <= t + 1 && c.top >= r && (n = l, r = c.top);
  }
  if (!n && (n = e.find((c) => {
    const d = c.getBoundingClientRect();
    return d.height >= 8 && d.width >= 8;
  }) ?? null, n)) {
    const c = [...e].reverse().find((d) => {
      const f = d.getBoundingClientRect();
      return f.height >= 8 && f.width >= 8;
    });
    c && c.getBoundingClientRect().bottom < t && (n = c);
  }
  if (!n)
    return null;
  const o = Vt(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Ft(e, t, n = zn) {
  if (!e)
    return null;
  const r = Wt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Io(e, n), i = Ro(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Tt(e, t, n = "auto", r, o = zn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(Wt(a, r))), i || (i = e.querySelector(Wt(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const d = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), u = Math.max(0, f + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - u) >= 1 && (e.scrollTop = u) : e.scrollTo({ top: u, behavior: n }), !0;
}
function mi(e, t, n = "smooth", r) {
  return Tt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function wn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var d;
    if (a) return;
    Tt(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (d = n == null ? void 0 : n.onDone) == null || d.call(n));
  };
  for (const c of o)
    c <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(l);
    }) : i.push(setTimeout(l, c));
  return () => {
    a = !0;
    for (const c of i)
      clearTimeout(c);
  };
}
function hi(e, t, n) {
  return wn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Jt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Pe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function pi(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
  return x(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let l = !1, c = null, d = 0;
    const f = Wt(void 0, o), u = () => {
      if (l) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const v = Io(i), w = Ro(h, v);
      w && s(w.page);
    }, m = () => {
      l || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, u();
      }));
    }, y = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        c = setTimeout(y, 120);
        return;
      }
      u(), i.addEventListener("scroll", m, { passive: !0 });
    };
    return y(), () => {
      l = !0, c && clearTimeout(c), d && cancelAnimationFrame(d), i.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const gi = `canvas, .react-pdf__Page, .${mo}, .${Ht}`, fr = /* @__PURE__ */ new WeakMap();
function bi(e) {
  const t = Number(e.getAttribute(Cn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = fr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(gi), fr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function yi(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function vi(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Ks()).forEach((r) => {
    const o = Vt(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = bi(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function wi(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Se(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, d = !1, f = !1;
    const u = () => {
      var I;
      if (l) return;
      const S = e.current;
      if (!S) return;
      const b = vi(S);
      yi(s.current, b) || (s.current = b, a(b)), d && !f && (f = !0, (I = i.current) == null || I.call(i));
    }, m = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(u);
      });
    };
    m();
    const y = window.setTimeout(m, 100), h = window.setTimeout(() => {
      d = !0, m();
    }, 300), v = window.setTimeout(m, 700), w = e.current;
    let g = null;
    return w && typeof ResizeObserver < "u" && (g = new ResizeObserver(() => m()), g.observe(w)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(y), window.clearTimeout(h), window.clearTimeout(v), g == null || g.disconnect();
    };
  }, [e, t, n]), o;
}
const Si = [0, 48, 140, 320, 560], Ii = 700, Ri = [80, 200, 400], Ei = 500, Pi = 50, Ti = /* @__PURE__ */ new Set([
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
]), ki = 180, mr = [0, 48, 140, 320, 700, 1200];
function Ni(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((P = _e(a)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), l = A(null), c = A(!1), d = A(r), f = A(null), u = A(null), m = A(null), y = A(null), h = A(a), v = A(""), w = A(n);
  w.current = n;
  const g = O(() => {
    var T;
    (T = f.current) == null || T.call(f), f.current = null, u.current != null && (clearTimeout(u.current), u.current = null);
  }, []), S = O(() => {
    !c.current && l.current == null || (g(), m.current != null && (clearTimeout(m.current), m.current = null), l.current = null, c.current = !1);
  }, [g]), b = O((T = !1) => {
    y.current != null && (clearTimeout(y.current), y.current = null);
    const M = () => {
      y.current = null, Xt(h.current, {
        anchor: Pe(i.current)
      });
    };
    T ? M() : y.current = setTimeout(M, ki);
  }, []), I = O((T) => {
    i.current = Pe(T), l.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, c.current = !1;
    }, Pi);
  }, []);
  x(() => {
    if (!o)
      return;
    let T = !1, M = null, _ = null, U = null;
    const F = () => {
      if (T) return;
      const G = e.current;
      if (!G) {
        U = setTimeout(F, 50);
        return;
      }
      M = G, _ = () => {
        if (c.current)
          return;
        const ne = Ft(M, w.current);
        ne && (i.current = ne, b());
      }, M.addEventListener("scroll", _, { passive: !0 }), c.current || _();
    };
    return F(), () => {
      T = !0, U != null && clearTimeout(U), M && _ && M.removeEventListener("scroll", _);
    };
  }, [o, r, n, e, b]), x(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const M = (_) => {
      _.metaKey || _.ctrlKey || _.altKey || Ti.has(_.key) && S();
    };
    return T.addEventListener("wheel", S, { passive: !0 }), T.addEventListener("touchmove", S, { passive: !0 }), window.addEventListener("keydown", M), () => {
      T.removeEventListener("wheel", S), T.removeEventListener("touchmove", S), window.removeEventListener("keydown", M);
    };
  }, [o, e, S]), Se(() => {
    var M;
    if (h.current === a) return;
    b(!0), g(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, v.current = "";
    const T = (M = _e(a)) == null ? void 0 : M.anchor;
    i.current = T ? Pe(T) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, d.current = r;
  }, [a, r, b, g]), x(() => {
    var M;
    if (!o || !s || !a || v.current === a) return;
    v.current = a;
    const T = Pe(
      ((M = _e(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = T, l.current = T, c.current = !0, g(), f.current = wn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: mr,
        onDone: () => I(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(T);
    }, Math.max(...mr) + 160), () => g();
  }, [o, s, a, e, I, g]), x(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      c.current = !1, l.current = null, g();
      return;
    }
    const T = l.current ? Pe(l.current) : Pe(i.current);
    return c.current = !0, l.current = T, i.current = T, g(), f.current = wn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Si,
        onDone: () => I(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(T);
    }, Ii), () => {
      g();
    };
  }, [r, o, n, e, I, g]), x(() => () => {
    g(), m.current != null && (clearTimeout(m.current), m.current = null), b(!0);
  }, [g, b]);
  const E = O(() => {
    const T = Ft(
      e.current,
      w.current
    );
    return Pe(T || i.current);
  }, [e]), k = O(() => {
    c.current = !0;
    const T = Ft(
      e.current,
      w.current
    ), M = Pe(T ?? i.current);
    return i.current = M, l.current = M, b(), M;
  }, [e, b]), $ = O((T, M, _) => {
    const U = _ || w.current, F = Jt(T, M || 1), G = { page: F, fraction: 0 };
    i.current = G, c.current = !0, l.current = G, b(), g(), mi(e.current, F, "smooth", U), f.current = hi(
      () => e.current,
      F,
      {
        behavior: "auto",
        pane: U,
        delaysMs: Ri,
        onDone: () => I(G)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(G);
    }, Ei);
  }, [e, I, g, b]), D = O(() => Pe(i.current), []), B = O(() => c.current, []), R = O(() => {
    if (!c.current || !l.current)
      return;
    const T = Pe(l.current);
    Tt(
      e.current,
      T,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: E,
    beginModeSwitch: k,
    goToPage: $,
    getAnchor: D,
    isRestoring: B,
    repinIfRestoring: R
  };
}
function Mi(e, t) {
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
function Eo(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Ai = [0, 80, 200, 400, 800], _i = 120, Li = 400;
function Di(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: d = !0 } = e, f = A(a);
  f.current = a;
  const u = A(s);
  u.current = s;
  const m = A(i);
  m.current = i;
  const y = A(n);
  y.current = n, x(() => {
    var b, I;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = ts(), v = Mi(h, u.current);
    if (v == null && (h != null && h.blockId) && !d) return;
    const w = Eo(h, v, { jobId: l, documentId: c });
    if (t.current === w)
      return;
    if (v == null) {
      t.current = w, (b = y.current) == null || b.call(y);
      return;
    }
    t.current = w, h && ((I = m.current) == null || I.call(m, h, v));
    const g = [];
    let S = 0;
    for (const E of Ai)
      S = Math.max(S, E), g.push(
        setTimeout(() => {
          f.current(v);
        }, E)
      );
    return g.push(
      setTimeout(() => {
        var E;
        (E = y.current) == null || E.call(y);
      }, S + _i)
    ), () => {
      for (const E of g) clearTimeout(E);
    };
  }, [r, o, l, c, t, d]);
}
function Ci(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function xi(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Li,
    jobId: i,
    documentId: l,
    applyReaderSearch: c
  } = e, d = A(a);
  d.current = a;
  const f = A(c);
  f.current = c;
  const u = A(0);
  x(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || u.current === o) return;
    const m = setTimeout(() => {
      var w;
      const y = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = pa(y, o, d.current);
      if (u.current = o, h === null) return;
      const v = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Eo(
        { blockId: v },
        o,
        { jobId: i, documentId: l }
      ), (f.current || Ci)(h);
    }, s);
    return () => clearTimeout(m);
  }, [
    n,
    r,
    o,
    s,
    i,
    l,
    t
  ]);
}
function zi(e) {
  const t = A(""), [n, r] = N(!1), o = O(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Di(a, t, o), xi(e, t, n);
}
const bt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Oi(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function hr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Po(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = hr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = hr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function $i(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Po(r, t, n);
  if (o === "retry") return e;
  if (o === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const a = new Map(n.items.map((l) => [l.item_id, l])), s = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const l of t.changed_item_ids)
    a.has(l) && s.set(l, t.seq);
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
function Fi(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const pr = [250, 500, 1e3, 2e3, 4e3], nn = [80, 160, 320, 640, 1e3, 1500], gr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Sn(e, t) {
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
function On(e) {
  return Ia(e) ? `${e.code || ""}`.trim() : "";
}
function xt(e, t) {
  const n = On(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Bi(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Po(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = Ra(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = On(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = nn[Math.min(s, nn.length - 1)];
    if (await Sn(i, r), s >= nn.length + 2) throw a;
  }
}
function ji({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(bt), s = A(o), i = A("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), d = Rt(c) ? c : "";
  return x(() => {
    if (!n || !l) {
      i.current = "", s.current = bt, a(bt);
      return;
    }
    const f = r === void 0 ? es() : r, u = i.current === l;
    if (i.current = l, !f) {
      const S = {
        ...u ? s.current : bt,
        connection: d ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = S, a(S);
      return;
    }
    const m = new AbortController();
    let y = !1;
    const h = {
      ...u ? s.current : bt,
      connection: d ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = h, a(h);
    const v = (S) => {
      m.signal.aborted || a((b) => {
        const I = S(b);
        return s.current = I, I;
      });
    }, w = async () => {
      let S = 0;
      for (; !m.signal.aborted; )
        try {
          const b = await f.fetchLayout(l, { signal: m.signal });
          y = !0, v((I) => ({
            ...I,
            layoutByPage: Oi(b),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError") return;
          const I = On(b);
          if (!(I === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !I)) {
            v((k) => ({
              ...k,
              connection: d ? "terminal" : "unavailable",
              jobStatus: c,
              error: xt(b, "实时译文暂不可用")
            }));
            return;
          }
          if (d) {
            v((k) => ({
              ...k,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          v((k) => ({
            ...k,
            connection: "connecting",
            jobStatus: c,
            error: xt(b, "正在等待 OCR 版面数据")
          })), await Sn(pr[Math.min(S, pr.length - 1)], m.signal).catch(() => {
          }), S += 1;
        }
    };
    return (async () => {
      if (await w(), !y || m.signal.aborted) return;
      let S = 0;
      for (; !m.signal.aborted; ) {
        d || v((b) => ({
          ...b,
          connection: b.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: b.error
        }));
        try {
          await f.streamEvents(l, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (b) => {
              if (b.seq <= s.current.lastSeq) return;
              let I;
              try {
                I = await Bi(
                  l,
                  b,
                  s.current,
                  m.signal,
                  f
                );
              } catch (E) {
                if ((E == null ? void 0 : E.name) === "AbortError" || m.signal.aborted) throw E;
                v((k) => ({
                  ...k,
                  lastSeq: Math.max(k.lastSeq, b.seq),
                  error: xt(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              v((E) => {
                const k = $i(E, b, I);
                return d ? {
                  ...k,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...k,
                  jobStatus: c
                };
              }), S = 0;
            }
          });
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError" || m.signal.aborted) return;
          v((I) => ({
            ...I,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: c,
            error: xt(b, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (d) {
          v((b) => ({
            ...b,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await Sn(gr[Math.min(S, gr.length - 1)], m.signal).catch(() => {
        }), S += 1;
      }
    })(), () => m.abort();
  }, [n, r, l, d]), o;
}
function Ui(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function Hi(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return x(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = qe().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Ui(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Wi = 4500;
function Vi(e) {
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
const Ki = /* @__PURE__ */ new Set(["book", "translate"]);
function To(e) {
  return !!(e.jobId && e.sourceUrl && Ki.has(e.workflow));
}
function Ji(e) {
  return !!(To(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function qi() {
  const e = zs(), t = To({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Ji({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Rt(o) && (r.current.running = !0);
  const a = ji({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = Bs(), d = Hi(e.jobId, !e.sourceOnly), f = si({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: y } = ui(e.mode, s, f), h = Us(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: m, shellWidth: l, identityKey: u }
  ), {
    beginModeSwitch: v,
    goToPage: w,
    repinIfRestoring: g
  } = Ni(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  x(() => {
    g();
  }, [l, g]);
  const S = wi(
    s,
    h.compareMode,
    h.rowSyncRevision,
    g
  ), b = pi(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), I = O((F, G) => {
    var X, Q;
    const ne = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((X = h.numPagesByPane) == null ? void 0 : X.source) || 0,
      Number((Q = h.numPagesByPane) == null ? void 0 : Q.translated) || 0
    );
    w(F, ne, G);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [E, k] = N(null), $ = A(null), D = O((F) => {
    $.current && clearTimeout($.current), k(F), F && ($.current = setTimeout(() => k(null), Wi));
  }, []);
  x(() => () => {
    $.current && clearTimeout($.current);
  }, []);
  const B = O((F) => {
    const G = en(e.regions, F);
    return G ? nr(G, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), R = O((F, G) => {
    const ne = G || h.primaryPane, X = typeof F == "object" && F ? `${F.block_id || ""}`.trim() : "", Q = typeof F == "object" && F ? `${F.image_url || ""}`.trim() : "", fe = typeof F == "object" && F ? F.page_idx != null ? Number(F.page_idx) + 1 : F.page != null ? Number(F.page) : null : typeof F == "number" ? F + 1 : null, ce = ba(e.regions, Q, fe) || en(e.regions, X) || (typeof F == "object" ? ya(e.regions, F) : null);
    let de = ce ? nr(ce, ne).page : null;
    de == null && (de = Vi(F)), !(de == null || de < 1) && (D(ce), I(de, ne));
  }, [D, I, h.primaryPane, e.regions]);
  zi({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: b,
    goToPage: I,
    resolveBlockPage: B,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (F) => {
      D(en(e.regions, F.blockId));
    }
  });
  const { setModeKeepingPage: P } = fi({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  x(() => {
    D(null);
  }, [u, D]);
  const T = !e.boot.loading && !e.boot.failed, M = q(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), _ = q(() => ({
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
    onZoomChange: y,
    shell: M,
    panes: h,
    sessionFiles: _,
    rowHeights: S,
    goToPage: I,
    activeRegion: E,
    jumpToAnchor: R,
    setModeKeepingPage: P,
    download: e.download,
    showHud: T,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, M, h, _, S, I, E, R, P, T, m, y, f, a, n, d]);
  return q(() => ({
    ...U,
    currentPage: b
  }), [U, b]);
}
const Gi = [
  { action: "mode-source", keys: ["1"], mode: "source" },
  { action: "mode-compare", keys: ["2"], mode: "compare" },
  { action: "mode-translated", keys: ["3"], mode: "translated" },
  { action: "zoom-in", keys: ["+", "="] },
  { action: "zoom-out", keys: ["-", "_"] },
  { action: "zoom-reset", keys: ["0"] },
  { action: "next-page", keys: ["j", "ArrowDown", "PageDown"], requiresPages: !0 },
  { action: "prev-page", keys: ["k", "ArrowUp", "PageUp"], requiresPages: !0 },
  { action: "first-page", keys: ["Home"], requiresPages: !0 },
  { action: "last-page", keys: ["End"], requiresPages: !0 }
], Zi = [
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
      { actions: [], keys: "点百分比", desc: "重置为模式默认" }
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
  }
];
function Yi(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Gi)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Xi(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Qi = ".reader-notes-panel";
function el(e) {
  return e instanceof Element ? !!e.closest(Qi) : !1;
}
function tl(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: i,
    goToPage: l,
    enabled: c = !0
  } = e;
  x(() => {
    if (!c)
      return;
    const d = (f) => {
      if (f.defaultPrevented || f.metaKey || f.ctrlKey || f.altKey || Xi(f.target) || el(f.target))
        return;
      const u = f.key, m = Yi(u);
      if (m) {
        if (m.mode) {
          if (n && m.mode !== "source")
            return;
          f.preventDefault(), r(m.mode);
          return;
        }
        if (!(m.requiresPages && i <= 0))
          switch (f.preventDefault(), m.action) {
            case "zoom-in":
              a(Pt(o, 1));
              return;
            case "zoom-out":
              a(Pt(o, -1));
              return;
            case "zoom-reset":
              a(ct(t, Ye()));
              return;
            case "next-page":
              l(Jt(s + 1, i));
              return;
            case "prev-page":
              l(Jt(s - 1, i));
              return;
            case "first-page":
              l(1);
              return;
            case "last-page":
              l(i);
              return;
          }
      }
    };
    return window.addEventListener("keydown", d), () => window.removeEventListener("keydown", d);
  }, [
    c,
    t,
    n,
    r,
    o,
    a,
    s,
    i,
    l
  ]);
}
const nl = "retainpdf:soft-reader-close";
function rl() {
  return new URL("./index.html", window.location.href).href;
}
function ol() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: nl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function al(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function sl() {
  if (!(typeof window > "u") && !ol()) {
    if (al(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(rl());
  }
}
function il({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function ll({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L(il, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), sl();
  }, children: [
    /* @__PURE__ */ p(pt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let br = !1;
function cl() {
  if (br)
    return;
  const e = Et().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (lo.GlobalWorkerOptions.workerSrc = e, br = !0);
}
const dl = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function ul(e, t, n) {
  return e.flatMap((r) => {
    if (!dl.has(Zt(r.region))) return [];
    const o = Ln(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function yr(e, t, n) {
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
async function fl(e) {
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
const ml = "reader-text-hover-copy", hl = "reader-text-hover-edit", pl = "reader-text-hover-id";
function gl(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const ko = "reader-text-hover-tools";
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
const bl = 26, yl = 220;
function vl(e, t = yl) {
  return e.height < bl * 2 || e.width < t;
}
function wl({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? no : e === "failed" ? pt : Pa, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Sl({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a,
  tailTop: s = 0
}) {
  const [i, l] = N("idle"), [c, d] = N("idle"), [f] = N(() => gl()), u = A([]), m = (e == null ? void 0 : e.itemId) || "";
  if (x(() => {
    l("idle"), d("idle");
    const b = u.current;
    return () => {
      b.forEach((I) => window.clearTimeout(I)), u.current = [];
    };
  }, [m]), !e) return null;
  const y = va(e.highlight.region, t), h = Zt(e.highlight.region), v = (b, I) => async (E) => {
    E.preventDefault(), E.stopPropagation();
    const k = await fl(b);
    I(k ? "copied" : "failed"), u.current.push(window.setTimeout(() => I("idle"), 1200));
  }, w = h === "formula" ? "复制 LaTeX" : "复制", g = o || e.rect, S = a || (vl(g) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": h,
      style: g,
      children: /* @__PURE__ */ L(
        "div",
        {
          className: ko,
          "data-placement": S,
          style: S === "tail" ? { top: s } : void 0,
          children: [
            f ? /* @__PURE__ */ p(
              rn,
              {
                className: pl,
                state: c,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: v(e.itemId, d),
                children: c === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r ? /* @__PURE__ */ p(
              rn,
              {
                className: hl,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (b) => {
                  b.preventDefault(), b.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Dn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            y ? /* @__PURE__ */ p(
              rn,
              {
                className: ml,
                state: i,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: i === "copied" ? "已复制" : i === "failed" ? "复制失败" : w,
                onClick: v(y, l),
                children: /* @__PURE__ */ p(wl, { state: i })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Il(e, t) {
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
function Rl(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = Ln(
      Il(e, a),
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
const El = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Pl = 256, yt = /* @__PURE__ */ new Map();
function Tl(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function No(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ja(t, { bareLatex: !0 }), o = Tl(n), a = qa(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = yt.get(t);
  if (!s && (s = Ga(o, r), yt.set(t, s), yt.size > Pl)) {
    const i = yt.keys().next().value;
    i !== void 0 && yt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function on(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function xe(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function kl(e, t) {
  const n = e.typography, r = xe(t) || 1, o = xe(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = on(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = xe(n == null ? void 0 : n.fit_min_font_size_pt), d = xe(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), u = Math.max(
    f,
    d ? d * r : o ? o * r : l
  ), m = o ? o * r : l, y = xe(n == null ? void 0 : n.leading_em), h = [
    xe(n == null ? void 0 : n.padding_top_pt) || 0,
    xe(n == null ? void 0 : n.padding_right_pt) || 0,
    xe(n == null ? void 0 : n.padding_bottom_pt) || 0,
    xe(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((v) => v * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || El,
    fontSizePx: Math.max(f, Math.min(u, m)),
    minFontSizePx: f,
    maxFontSizePx: u,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: y ? 1 + y : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (on(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : on(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Nl(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const u = s.get(f);
    if (u !== void 0) return u;
    const { width: m, height: y } = e(f), h = m <= t + 0.5 && y <= n + 0.5;
    return s.set(f, h), h;
  };
  let l = o, c = a, d = Math.min(r.requestedFontSizePx, c);
  if (i(d)) {
    if (!r.exact) {
      l = d;
      for (let f = 0; f < 6 && c > l; f += 1) {
        const u = (l + c) / 2;
        i(u) ? (d = u, l = u) : c = u;
      }
    }
  } else {
    c = d, d = l;
    for (let f = 0; f < 8 && c > l; f += 1) {
      const u = (l + c) / 2;
      i(u) ? (d = u, l = u) : c = u;
    }
  }
  return Math.max(o, d);
}
const Ml = 512, vt = /* @__PURE__ */ new Map();
let In = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  In += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  In += 1;
}));
function Al(e, t, n, r) {
  return [
    In,
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
function Mo({ item: e, pageScale: t }) {
  const n = A(null), r = q(
    () => No(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = q(
    () => kl(e, t),
    [e, t]
  );
  x(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((u) => {
      f && a(u);
    }), () => {
      f = !1;
    };
  }, [r]), Se(() => {
    const f = n.current;
    if (!f) return;
    const [u, m, y, h] = s.padding, v = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - u - y), g = Al(o, v, w, s);
    let S = vt.get(g);
    if (S === void 0 && (S = Nl(
      (b) => (f.style.fontSize = `${b}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      v,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), vt.set(g, S), vt.size > Ml)) {
      const b = vt.keys().next().value;
      b !== void 0 && vt.delete(b);
    }
    f.style.fontSize = `${S.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, l, c, d] = s.padding;
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
        padding: `${i}px ${l}px ${c}px ${d}px`
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
function _l({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = q(
    () => Rl(e, t, n, r),
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
        Mo,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Ll = Gt(_l);
function Dl({
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
        Mo,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Zt(a.highlight.region),
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
const Cl = Gt(Dl), Ao = 24, Ue = Ao * 2 + 4, ze = 24, xl = 4, zl = 6, Xe = (e) => e.left + e.width, Je = (e) => e.top + e.height;
function wt(e, t) {
  const n = Math.min(Xe(e), Xe(t)) - Math.max(e.left, t.left), r = Math.min(Je(e), Je(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const vr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= Xe(t) && r >= t.top && r <= Je(t);
}, Ol = (e) => e.height > 40 && e.height > e.width * 2.5;
function $l(e, t, n) {
  if (!t.length || e.height < ze || e.width < n + 8) return null;
  const r = Math.max(...t.map(Je)), o = Xe(e) - 4 - n;
  for (const a of [r, Je(e) - 2]) {
    const s = Math.max(e.top, a - ze), i = { left: o, top: s, width: n, height: ze };
    if (!t.some((l) => wt(i, l) > 0)) return s - e.top;
  }
  return null;
}
function Fl(e, t) {
  const n = [], r = (a) => {
    const s = Ao + xl, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: Xe(e), top: i, width: s, height: Ue } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Ue } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - ze - 3, width: Ue, height: ze + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: Je(e), width: Ue, height: ze + 3 } }), r(!0);
  const o = $l(e, t, Ue);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: Xe(e) - 4 - Ue, top: e.top + o, width: Ue, height: ze } }), n;
}
function Bl(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((g) => g.width > 0 && g.height > 0 && !Ol(g)), i = s.filter((g) => vr(g, t)), l = s.filter((g) => !vr(g, t)), c = n.filter((g) => g !== t && wt(g, t) < t.width * t.height * 0.5), d = Fl(t, i).filter(({ box: g, overhang: S }) => {
    const b = S ? zl : 0;
    return g.left >= -b && Xe(g) <= r + b && g.top >= 0 && Je(g) <= o;
  }), f = ({ placement: g, tailTop: S }) => S === void 0 ? { placement: g } : { placement: g, tailTop: S }, u = ({ box: g }) => !l.some((S) => wt(g, S) > 0), m = d.filter((g) => g.placement !== "tail"), y = m.find((g) => u(g) && !c.some((S) => wt(g.box, S) > 0));
  if (y) return f(y);
  const h = m.find(u) || d.find((g) => g.placement === "tail" && u(g));
  if (h) return f(h);
  let v = null, w = Number.POSITIVE_INFINITY;
  for (const g of d) {
    const S = l.reduce((b, I) => b + wt(g.box, I), 0);
    S < w && (v = g, w = S);
  }
  return v ? f(v) : { placement: "outside" };
}
function jl(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - ze - 3 : Je(r);
  return t >= r.left - 4 && t <= r.left + Ue + 4 && n >= a && n <= a + ze + 3;
}
const an = (e) => e.left + e.width, sn = (e) => e.top + e.height;
function Ul(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const d = c.left + c.width / 2, f = c.top + c.height / 2;
    d < e.left || d > an(e) || f < e.top || f > sn(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, an(c)), i = Math.max(i, sn(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(an(e) + r, s + n) - l.left, l.height = Math.min(sn(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function Hl(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Wl(e, t, n, r) {
  const [o, a] = N(null);
  return Se(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Hl(s) : [], l = i.length ? Ul(t.rect, i) : t.rect, c = n.filter((f) => f.itemId !== t.itemId).map((f) => f.rect), d = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Bl({ frame: l, others: c, pageWidth: r, pageHeight: d, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const _o = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], wr = { pen: 35e-4, highlighter: 0.018 }, Sr = 0.015, Rn = "retainpdf.reader.ink.v1:";
function Ir(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Rn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Vl(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Rn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Rn + e);
    } catch {
    }
}
function Kl(e, t, n, r, o, a) {
  const s = Sr * Sr;
  return e.filter((i) => Lo(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Lo(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Jl(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function ql(e) {
  const [t, n] = N(null), [r, o] = N(_o[0].key), [a, s] = N(() => Ir(e)), i = A(a), l = A([]);
  x(() => {
    const h = Ir(e);
    i.current = h, s(h), l.current = [];
  }, [e]);
  const c = O((h) => {
    i.current = h, s(h), Vl(e, h);
  }, [e]), d = O((h) => {
    const v = i.current, w = h(v);
    w !== v && (l.current = [...l.current.slice(-49), v], c(w));
  }, [c]), f = O((h) => {
    h.points.length < 1 || d((v) => [...v, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [d]), u = O((h) => {
    h.length && d((v) => v.filter((w) => !h.includes(w.id)));
  }, [d]), m = O((h) => {
    d((v) => v.some((w) => w.page === h) ? v.filter((w) => w.page !== h) : v);
  }, [d]), y = O(() => {
    const h = l.current.pop();
    h && c(h);
  }, [c]);
  return q(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: u, undo: y, clearPage: m }),
    [t, r, a, f, u, y, m]
  );
}
const Gl = "reader-ink-layer";
function Zl(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Rr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Zl(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Yl({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = A(!1), l = o.strokes.filter((h) => Lo(h, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const d = (h) => {
    const v = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - v.left) / Math.max(1, v.width))),
      Math.min(1, Math.max(0, (h.clientY - v.top) / Math.max(1, v.height)))
    ];
  }, f = (h, v) => o.erase(Kl(o.strokes, e, t, h, v, r / Math.max(1, n))), u = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [v, w] = d(h);
    o.tool === "eraser" ? f(v, w) : s([[v, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [v, w] = d(h);
    o.tool === "eraser" ? f(v, w) : s((g) => g ? Jl(g, v, w) : [[v, w]]);
  }, y = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: wr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: Gl,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: u,
      onPointerMove: m,
      onPointerUp: y,
      onPointerCancel: y,
      children: [
        l.map((h) => /* @__PURE__ */ p(Rr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Rr, { stroke: { tool: o.tool, color: o.color, width: wr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function ue(e) {
  return typeof e == "string" ? e : "";
}
function Xl(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Ql(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function ec(e) {
  return {
    source: ue(e == null ? void 0 : e.source_text) || ue(e == null ? void 0 : e.unit_source_text),
    translated: ue(e == null ? void 0 : e.protected_translated_text) || ue(e == null ? void 0 : e.translated_text)
  };
}
const tc = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Do(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function nc(e) {
  const t = Do(e).sort((r, o) => ue(r.ts).localeCompare(ue(o.ts)));
  return t.length ? [
    { text: ue(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ue(r.new_text),
      label: tc[ue(r.source)] || ue(r.source) || "修订",
      ts: ue(r.ts),
      reason: ue(r.reason)
    }))
  ].reverse() : [];
}
function rc(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function oc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ue(r.finished_at) || ue(n.finished_at) || "";
}
function ac(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Do(e).sort((a, s) => ue(a.ts).localeCompare(ue(s.ts)));
  for (const a of o) {
    const s = new Date(ue(a.ts)).getTime(), i = ue(a.reader_item_id) || ue(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ue(a.new_text));
  }
  return n;
}
const sc = {
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
function ic(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = sc[ue(n.kind)] || ue(n.kind) || "问题", o = ue(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const lc = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function cc(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !lc.has(Zt(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const dc = 300, uc = 72;
function fc(e, t) {
  if (e.width >= dc && e.height >= uc)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
function mc({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, l] = N(!1), [c, d] = N([]), [f, u] = N(""), [m, y] = N(""), [h, v] = N(!1), [w, g] = N(null), [S, b] = N([]), I = r.drafts, E = r.generation, k = O(async (R, P) => {
    if (e)
      try {
        d(nc(await e.fetchRevisions(R, P)));
      } catch {
        d([]);
      }
  }, [e]);
  x(() => {
    if (s(null), d([]), g(null), b([]), y(""), !e || !t || !n) return;
    let R = !1;
    return l(!0), e.loadItem(t, n).then((P) => {
      if (R) return;
      const T = P == null ? void 0 : P.item;
      if (!T) throw new Error("找不到这一段的译文。");
      const M = `${(P == null ? void 0 : P.item_id) || n}`, { source: _, translated: U } = ec(T);
      s({ readerItemId: n, itemId: M, source: _, current: U }), u(I.get(n) ?? U);
    }).catch((P) => {
      R || g({ tone: "error", message: (P == null ? void 0 : P.message) || "读取这段译文失败。" });
    }).finally(() => {
      R || l(!1);
    }), k(t, n), () => {
      R = !0;
    };
  }, [e, t, n, k]);
  const $ = O((R) => {
    u(R), n && I.set(n, R);
  }, [n, I]), D = O(async (R, P) => {
    if (!e || !a || h) return !1;
    const T = R ?? f;
    if (!T.trim()) return !1;
    v(!0), g(null), b([]);
    try {
      const M = await e.revise(t, a.itemId, {
        translated_text: T,
        source: "user",
        reason: (P ?? m).trim() || "在阅读页手动修改",
        ...E.current != null ? { expected_generation: E.current } : {}
      }), _ = Number(M == null ? void 0 : M.generation);
      return Number.isFinite(_) && (E.current = _), I.delete(a.readerItemId), s({ ...a, current: T }), u(T), y(""), (M == null ? void 0 : M.changed) === !1 ? g({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, T), g({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), k(t, a.readerItemId), !0;
    } catch (M) {
      const _ = M;
      return (_ == null ? void 0 : _.reason) === "generation_mismatch" && (E.current = null), g({ tone: "error", message: (_ == null ? void 0 : _.message) || "保存失败，请稍后再试。" }), b(ic(_ == null ? void 0 : _.issues)), !1;
    } finally {
      v(!1);
    }
  }, [e, a, h, f, m, t, o, k, I, E]), B = O(() => {
    n && I.delete(n);
  }, [n, I]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: f,
    setDraft: $,
    reason: m,
    setReason: y,
    saving: h,
    status: w,
    issues: S,
    save: D,
    discardDraft: B
  };
}
const Co = "reader-inline-edit";
function hc({ text: e }) {
  const [t, n] = N("");
  return x(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = No(e);
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
function pc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var B;
  const s = e.itemId, i = mc({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = N(!1), [d, f] = N(!1), u = A(null), m = fc(e.rect, t), y = q(() => cc(o), [o]), h = y.indexOf(s), { loaded: v } = i, w = i.saving || i.loading, g = n.blockedReason, S = !v || i.draft === v.current, { close: b, select: I } = n, E = O((R) => {
    const P = y[h + R];
    P && (I(P), a == null || a(P));
  }, [y, h, I, a]), k = O(() => {
    i.discardDraft(), b();
  }, [i, b]), $ = O(async (R, P) => {
    await i.save(R, P) && b();
  }, [i, b]);
  x(() => {
    const R = (P) => {
      !P.altKey || P.key !== "ArrowUp" && P.key !== "ArrowDown" || (P.preventDefault(), E(P.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", R), () => window.removeEventListener("keydown", R);
  }, [E]), Se(() => {
    const R = u.current;
    if (!R) return;
    R.style.height = "auto";
    const P = m.mode === "inline" ? m.minHeight : 0;
    R.style.height = `${Math.max(P, R.scrollHeight + 2)}px`;
  }, [i.draft, v, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const D = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ L(nt, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${Co} is-${m.mode}`,
        style: D,
        role: "group",
        "aria-label": `改第 ${((B = n.target) == null ? void 0 : B.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (R) => R.stopPropagation(),
        children: [
          r && (v != null && v.source) ? /* @__PURE__ */ p(
            oe,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((R) => !R),
              children: v.source
            }
          ) : null,
          g ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: g }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          v ? /* @__PURE__ */ p(
            Wa,
            {
              ref: u,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!g,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (R) => i.setDraft(R.target.value),
              onKeyDown: (R) => {
                R.key === "Enter" && (R.metaKey || R.ctrlKey) ? (R.preventDefault(), S || $()) : R.key === "Escape" && (R.preventDefault(), k());
              }
            }
          ) : null,
          v ? /* @__PURE__ */ p(hc, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(or, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => E(-1), children: /* @__PURE__ */ p(Ta, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(or, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= y.length - 1, onClick: () => E(1), children: /* @__PURE__ */ p(ro, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              io,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!g || !v,
                onChange: (R) => i.setReason(R.target.value),
                onKeyDown: (R) => {
                  R.key === "Enter" ? (R.preventDefault(), S || $()) : R.key === "Escape" && (R.preventDefault(), k());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ L(
              oe,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": d,
                "data-block-edit-action": "history",
                onClick: () => f((R) => !R),
                children: [
                  /* @__PURE__ */ p(ka, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(oe, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: k, children: "取消" }),
            /* @__PURE__ */ p(
              oe,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!g || S || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  $();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((R) => /* @__PURE__ */ p("li", { children: R }, R)) }) : null,
          d && v && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((R, P) => {
            const T = R.text === v.current, M = [rc(R.ts), R.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": R.label, "data-current": T ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  M,
                  T ? "（现在用的）" : "",
                  R.reason ? ` · ${R.reason}` : ""
                ] }),
                T ? null : /* @__PURE__ */ p(
                  oe,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!g,
                    onClick: () => {
                      $(R.text, `回到「${M.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: R.text })
            ] }, `${R.ts}:${P}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const xo = Mn(null), zo = Mn(null);
function gc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(xo.Provider, { value: e, children: /* @__PURE__ */ p(zo.Provider, { value: t, children: n }) });
}
function $e() {
  return An(xo);
}
function Oo() {
  return An(zo);
}
const We = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), bc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, yc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, vc = {
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
}, Er = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function wc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Er(o ?? a ?? "", bc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Er(o ?? a ?? "", yc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => vc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Sc(e) {
  return We(e.translatedBlockText) || We(e.translated.text) || We(e.source.text);
}
const Ic = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Rc(e) {
  const t = [];
  for (const n of e) {
    if (!Ic(n)) continue;
    const r = wc(Sc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Ec(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Pc = 24, Tc = 60;
function Pr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Pc), o = Math.min(e.length, n + t.length + Tc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function kc(e, t, n = 200) {
  const r = We(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = We(a.translatedBlockText) || We(a.translated.text), l = i ? Pr(i, r) : null, c = l ?? Pr(We(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function zt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Nc(e, t) {
  const n = We(t).toLowerCase();
  if (!n || !e) return zt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${zt(e.slice(a, s))}<mark class="reader-find-mark">${zt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + zt(e.slice(a));
}
function Mc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const $o = 1.414;
function Ac({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  textLayer: a = !0,
  syncedMinHeight: s = 0,
  onMetrics: i,
  cachedAspect: l,
  onAspectChange: c,
  sentinelRef: d,
  regionHighlight: f = null,
  regionTargets: u = [],
  hoveredRegionId: m,
  onHoverRegion: y,
  liveTranslationLayout: h,
  liveTranslationPage: v,
  showLiveTranslation: w = r === "source"
}) {
  var Re, Ee;
  const g = $e(), S = g == null ? void 0 : g.revisedBlocks, b = g == null ? void 0 : g.blockEdit, I = b == null ? void 0 : b.pendingEdits, E = g == null ? void 0 : g.editBlock, k = (g == null ? void 0 : g.findTerm) || "", $ = q(
    () => k ? ({ str: z }) => Nc(z, k) : void 0,
    [k]
  ), D = A(l ?? $o), [B, R] = N(D.current);
  x(() => {
    l != null && Math.abs(l - D.current) >= 1e-3 && (D.current = l, R(l));
  }, [l]);
  const P = A(d);
  P.current = d;
  const T = A(null), M = A((z) => {
    var Z;
    T.current = z, (Z = P.current) == null || Z.call(P, z);
  }).current, _ = A(null), U = A(`${t}@${n}`);
  Se(() => {
    const z = `${t}@${n}`;
    U.current !== z && (U.current = z, o && Lc(T.current, _.current));
  }, [o, n, t]), x(() => {
    o || ln(_.current);
  }, [o]), x(() => () => ln(_.current), []);
  const F = Math.max(120, Math.floor(t * B)), G = Math.max(F, Math.ceil(s || 0)), ne = Ln(f, t, F), X = q(
    () => ul(u, t, F),
    [F, u, t]
  ), [Q, fe] = N(null), ce = typeof y == "function", de = ce ? m ?? null : Q, me = (z) => {
    ce ? z !== (m ?? null) && (y == null || y(z)) : fe((Z) => Z === z ? Z : z);
  }, K = q(
    () => X.find((z) => z.itemId === de) || null,
    [de, X]
  ), ee = r === "translated" && ((Re = b == null ? void 0 : b.target) == null ? void 0 : Re.itemId) || "", he = q(
    () => ee && X.find((z) => z.itemId === ee) || null,
    [ee, X]
  ), te = Wl(T, o ? K : null, X, t), ke = (z) => {
    var ie, pe, ve, Ne, at;
    if (z.pointerType === "touch") return;
    if ((ie = g == null ? void 0 : g.ink) != null && ie.tool) {
      me(null);
      return;
    }
    if (z.buttons !== 0) {
      me(null);
      return;
    }
    if ((ve = (pe = z.target) == null ? void 0 : pe.closest) != null && ve.call(pe, `.${ko}`) || (at = (Ne = z.target) == null ? void 0 : Ne.closest) != null && at.call(Ne, `.${Co}`)) return;
    const Z = z.currentTarget.getBoundingClientRect(), j = z.clientX - Z.left, H = z.clientY - Z.top;
    if (jl(te, j, H)) return;
    const le = yr(X, j, H);
    me((le == null ? void 0 : le.itemId) || null);
  }, Fe = (z) => {
    if (z.pointerType === "mouse") return;
    const Z = z.currentTarget.getBoundingClientRect(), j = yr(
      X,
      z.clientX - Z.left,
      z.clientY - Z.top
    );
    me((j == null ? void 0 : j.itemId) || null);
  }, Ie = (z) => {
    !Number.isFinite(z) || z <= 0 || Math.abs(D.current - z) < 1e-3 || (D.current = z, R(z), c == null || c(e, z));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: M,
      [Le]: e,
      [Ke]: r,
      [Cn]: F,
      className: xn,
      onPointerMoveCapture: ke,
      onPointerDown: Fe,
      onPointerLeave: (z) => {
        z.pointerType === "mouse" && me(null);
      },
      style: {
        width: t,
        height: G,
        minHeight: G
      },
      children: [
        o ? /* @__PURE__ */ p(
          Va,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: $,
            renderAnnotationLayer: !1,
            className: mo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Ht,
                style: { width: t, height: F }
              }
            ),
            onLoadSuccess: (z) => {
              try {
                const Z = z.getViewport({ scale: 1 });
                if (Z.width > 0) {
                  const j = Z.height / Z.width;
                  Ie(j);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              ln(_.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: Ht,
            style: { width: t, height: F },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: _, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        ne ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: ne,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Ll,
          {
            layoutPage: h,
            pageState: v,
            width: t,
            height: F
          }
        ) : null,
        o && r === "translated" && (I != null && I.size) ? /* @__PURE__ */ p(Cl, { targets: X, edits: I, width: t, excludeId: he == null ? void 0 : he.itemId }) : null,
        o && he && b ? /* @__PURE__ */ p(
          pc,
          {
            target: he,
            page: { width: t, height: F },
            edit: b,
            showSource: !!(g != null && g.editShowsSource),
            regions: g == null ? void 0 : g.regions,
            jumpToBlock: g == null ? void 0 : g.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (S != null && S.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: X.filter((z) => S.has(z.itemId)).map((z) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": z.itemId,
            style: { left: z.rect.left, top: z.rect.top, height: z.rect.height }
          },
          z.itemId
        )) }) : null,
        o && (g != null && g.ink) ? /* @__PURE__ */ p(
          Yl,
          {
            page: e,
            pane: r === "translated" ? "translated" : g.compareVersion ? "compare" : "source",
            width: t,
            height: F,
            ink: g.ink
          }
        ) : null,
        /* @__PURE__ */ p(
          Sl,
          {
            target: o && !((Ee = g == null ? void 0 : g.ink) != null && Ee.tool) && (K == null ? void 0 : K.itemId) !== (he == null ? void 0 : he.itemId) ? K : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: K && (S == null ? void 0 : S.get(K.itemId)) || 0,
            onEdit: E,
            frameRect: te == null ? void 0 : te.rect,
            placement: te == null ? void 0 : te.placement,
            tailTop: te == null ? void 0 : te.tailTop
          }
        )
      ]
    }
  );
}
const _c = Gt(Ac);
function Lc(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function ln(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Dc = 2 * 1024 * 1024;
function Cc(e) {
  const t = new lo.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const cn = 5, xc = "120% 0px", zc = 120, Oc = "25% 0px";
let Tr = 1;
const kr = /* @__PURE__ */ new WeakMap();
function $c(e) {
  if (!e) return 0;
  const t = kr.get(e);
  if (t) return t;
  const n = Tr;
  return Tr += 1, kr.set(e, n), n;
}
function Fc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Bc = Xr(
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: o = 1,
    visible: a = !0,
    emptyLabel: s = "暂无 PDF",
    scrollRoot: i = null,
    pageWidthOverride: l = null,
    rowHeights: c,
    onMetrics: d,
    onLoadSuccess: f,
    onLoadError: u,
    onNumPagesChange: m,
    activeRegion: y = null,
    regions: h = [],
    readerMetadata: v = null,
    hoveredRegionId: w = null,
    onHoverRegion: g,
    liveTranslation: S,
    showLiveTranslation: b = t === "source",
    liveTranslationPendingLabel: I = "",
    paneAction: E
  }, k) {
    cl();
    const { file: $, loading: D, error: B } = As(n, r), R = `${n}\0${$c($)}`, P = A(R);
    P.current = R;
    const T = q(() => {
      const C = Es($);
      return C ? "ranged" in C ? { range: Cc(C.ranged) } : C : null;
    }, [$, n]), [M, _] = N(0), [U, F] = N(""), [G, ne] = N(null), [X, Q] = N(480), fe = A(null), ce = A(0), de = q(() => Fc(), []), me = q(() => ({
      cMapUrl: Et().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Et().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Dc,
      disableAutoFetch: !0
    }), []);
    _n(k, () => G, [G]), x(() => {
      const C = (W) => {
        ce.current = W, Q(W);
      }, J = (W) => {
        const ae = ni(W, ce.current);
        if (ae !== "ignore") {
          if (fe.current && clearTimeout(fe.current), ae === "immediate") {
            C(W);
            return;
          }
          fe.current = setTimeout(() => C(W), go);
        }
      }, V = !!(l && l >= 80);
      J(V ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const se = !V && i && typeof ResizeObserver < "u" ? new ResizeObserver((W) => {
        var ae, ge;
        J(((ge = (ae = W[0]) == null ? void 0 : ae.contentRect) == null ? void 0 : ge.width) ?? i.clientWidth);
      }) : null;
      return se && i && se.observe(i), () => {
        se == null || se.disconnect(), fe.current && clearTimeout(fe.current);
      };
    }, [l, i, a]);
    const K = q(
      () => Qs(X, o),
      [X, o]
    ), [ee, he] = N(() => /* @__PURE__ */ new Map()), [te, ke] = N(() => /* @__PURE__ */ new Set()), [Fe, Ie] = N(() => /* @__PURE__ */ new Set()), Re = A(/* @__PURE__ */ new Map()), Ee = A(null), z = A(null), [Z, j] = N(() => /* @__PURE__ */ new Set()), H = A(/* @__PURE__ */ new Map()), le = O((C, J) => {
      he((V) => {
        if (V.get(C) === J) return V;
        const Y = new Map(V);
        return Y.set(C, J), Y;
      });
    }, []), ie = O((C, J) => {
      const V = Re.current, Y = V.get(C), se = [Ee.current, z.current];
      if (Y)
        for (const W of se)
          try {
            W == null || W.unobserve(Y);
          } catch {
          }
      if (J) {
        V.set(C, J);
        for (const W of se)
          try {
            W == null || W.observe(J);
          } catch {
          }
      } else
        V.delete(C);
    }, []), pe = A(/* @__PURE__ */ new Map()), ve = O((C) => {
      const J = pe.current;
      let V = J.get(C);
      return V || (V = (Y) => ie(C, Y), J.set(C, V)), V;
    }, [ie]);
    x(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = H.current, J = new IntersectionObserver(
        (V) => {
          const Y = [], se = [];
          for (const W of V) {
            const ae = W.target, ge = Vt(ae);
            Number.isFinite(ge) && (W.isIntersecting ? Y : se).push(ge);
          }
          if ((Y.length || se.length) && ke((W) => {
            let ae = null;
            for (const ge of Y)
              W.has(ge) || (ae = ae || new Set(W), ae.add(ge));
            for (const ge of se)
              W.has(ge) && (ae = ae || new Set(W), ae.delete(ge));
            return ae || W;
          }), Y.length) {
            for (const W of Y) {
              const ae = C.get(W);
              ae && (clearTimeout(ae), C.delete(W));
            }
            Ie((W) => {
              let ae = null;
              for (const ge of Y)
                W.has(ge) || (ae = ae || new Set(W), ae.add(ge));
              return ae || W;
            });
          }
          for (const W of se)
            C.has(W) || C.set(W, setTimeout(() => {
              C.delete(W), Ie((ae) => {
                if (!ae.has(W)) return ae;
                const ge = new Set(ae);
                return ge.delete(W), ge;
              });
            }, zc));
        },
        { root: i, rootMargin: xc, threshold: 0 }
      );
      Ee.current = J;
      for (const V of Re.current.values())
        try {
          J.observe(V);
        } catch {
        }
      return () => {
        J.disconnect(), Ee.current === J && (Ee.current = null);
        for (const V of C.values()) clearTimeout(V);
        C.clear();
      };
    }, [i]), x(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = new IntersectionObserver(
        (J) => {
          j((V) => {
            let Y = null;
            for (const se of J) {
              const W = Vt(se.target);
              !Number.isFinite(W) || se.isIntersecting === V.has(W) || (Y = Y || new Set(V), se.isIntersecting ? Y.add(W) : Y.delete(W));
            }
            return Y || V;
          });
        },
        { root: i, rootMargin: Oc, threshold: 0 }
      );
      z.current = C;
      for (const J of Re.current.values())
        try {
          C.observe(J);
        } catch {
        }
      return () => {
        C.disconnect(), z.current === C && (z.current = null);
      };
    }, [i]);
    const Ne = !!i && typeof IntersectionObserver < "u";
    Se(() => {
      _(0), F(""), ke(/* @__PURE__ */ new Set()), Ie(/* @__PURE__ */ new Set()), he(/* @__PURE__ */ new Map()), Re.current.clear();
      const C = H.current;
      for (const J of C.values()) clearTimeout(J);
      C.clear(), m == null || m(0, t);
    }, [R, m, t]);
    const at = O(
      ({ numPages: C }) => {
        P.current === R && (_(C), F(""), m == null || m(C, t), f == null || f({ numPages: C, pane: t }));
      },
      [R, f, m, t]
    ), Qt = O(
      (C) => {
        if (P.current !== R) return;
        const J = (C == null ? void 0 : C.message) || "PDF 解析失败";
        F(J), _(0), m == null || m(0, t), u == null || u(C, t);
      },
      [R, u, m, t]
    ), Be = q(
      () => M > 0 ? Array.from({ length: M }, (C, J) => J + 1) : [],
      [M]
    );
    x(() => {
      typeof IntersectionObserver < "u" || Ie(new Set(Be));
    }, [Be]);
    const je = q(
      () => rr(y, v, t),
      [y, v, t]
    ), Ge = q(() => {
      const C = /* @__PURE__ */ new Map();
      for (const J of h) {
        const V = rr(J, v, t);
        if (!V) continue;
        const Y = C.get(V.box.page) || [];
        Y.push(V), C.set(V.box.page, Y);
      }
      return C;
    }, [t, v, h]), _t = q(() => {
      const C = /* @__PURE__ */ new Set();
      if (!w) return C;
      for (const [J, V] of Ge)
        V.some((Y) => Y.itemId === w) && C.add(J);
      return C;
    }, [w, Ge]), Lt = q(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Be);
      if (te.size === 0) {
        const V = Math.min(M, cn * 2 + 1);
        return new Set(Array.from({ length: V }, (Y, se) => se + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const V of te)
        for (let Y = -cn; Y <= cn; Y++) {
          const se = V + Y;
          se >= 1 && se <= M && J.add(se);
        }
      return J;
    }, [M, Be, i, a, te]), st = !n || !!B || !!U, Dt = n && (B || U) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: ne,
        className: `reader-panel ${Vs}${a ? "" : " is-hidden"}`,
        [Ke]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (S == null ? void 0 : S.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          E ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: E }) : null,
          I ? /* @__PURE__ */ L("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: I })
          ] }) : null,
          st && !D ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Dt }) : null,
          D ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !B ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Ka,
            {
              file: T,
              loading: null,
              error: null,
              options: me,
              onLoadSuccess: at,
              onLoadError: Qt,
              className: "reader-react-pdf-document",
              children: Be.map((C) => {
                if (Lt.has(C))
                  return /* @__PURE__ */ p(
                    _c,
                    {
                      pane: t,
                      pageNumber: C,
                      width: K,
                      devicePixelRatio: de,
                      active: Fe.has(C),
                      textLayer: !Ne || Z.has(C),
                      syncedMinHeight: (c == null ? void 0 : c.get(C)) || 0,
                      onMetrics: d,
                      cachedAspect: ee.get(C),
                      onAspectChange: le,
                      sentinelRef: ve(C),
                      regionHighlight: (je == null ? void 0 : je.box.page) === C ? je : null,
                      regionTargets: Ge.get(C),
                      hoveredRegionId: w && _t.has(C) ? w : null,
                      onHoverRegion: g,
                      liveTranslationLayout: S == null ? void 0 : S.layoutByPage.get(C - 1),
                      liveTranslationPage: S == null ? void 0 : S.pagesByPage.get(C - 1),
                      showLiveTranslation: b
                    },
                    `${t}-${C}`
                  );
                const V = ee.get(C) ?? $o, Y = Math.max(120, Math.floor(K * V)), se = Math.max(Y, Math.ceil((c == null ? void 0 : c.get(C)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: ve(C),
                    [Le]: C,
                    [Ke]: t,
                    [Cn]: Y,
                    className: `${xn} is-placeholder`,
                    style: {
                      width: K,
                      height: se,
                      minHeight: se
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: Ht,
                        style: { width: K, height: Y },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${C}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), Nr = Gt(Bc), jc = 2e3, Uc = 6, Hc = 500, Mr = "reader-react-resizing";
function Wc(e, t) {
  const n = A(null), r = A(null);
  Se(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const b = Vc(e), I = Ft(e, b);
      if (!I) return;
      s = { pane: b, progress: I, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let d = 0, f = null, u = e.scrollHeight, m = u, y = 0, h = c;
    const v = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((b) => {
      let I = !1;
      for (const E of b) {
        const k = Math.round(E.contentRect.height);
        v.has(E.target) && v.get(E.target) !== k && (I = !0), v.set(E.target, k);
      }
      I && Tt(e, l, "auto", i);
    }), g = () => {
      var b;
      f && clearTimeout(f), cancelAnimationFrame(d), w == null || w.disconnect(), e.classList.remove(Mr);
      for (const I of Ar) e.removeEventListener(I, g);
      ((b = r.current) == null ? void 0 : b.stop) === g && (r.current = null);
    }, S = () => {
      Tt(e, l, "auto", i);
      const b = e.scrollHeight;
      y = b === m ? y + 1 : 0, m = b;
      const I = performance.now() - h;
      y >= Uc && (b !== u || I > Hc) || I > jc ? g() : d = requestAnimationFrame(S);
    };
    for (const b of Ar) e.addEventListener(b, g, { passive: !0 });
    for (const b of Array.from(e.children)) w == null || w.observe(b);
    e.classList.add(Mr), r.current = { ...s, stop: g }, f = setTimeout(() => {
      f = null, h = performance.now(), u = e.scrollHeight, m = u, y = 0, d = requestAnimationFrame(S);
    }, go);
  }, [e, t]), x(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Vc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Le}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ke) || null;
  }
  return null;
}
const Ar = ["wheel", "touchstart", "keydown", "pointerdown"];
function Fo(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Kc(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Jc({ compare: e, onDone: t }) {
  return /* @__PURE__ */ L("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Fo(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(no, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Na, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ L("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ L(
        oe,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Ma, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ L(
        oe,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Aa, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function _r({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Kc(t), a = [e === "compare" ? "对比" : "正在读", r, Fo(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function qc({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return Se(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const d = e.querySelector(`[${Ke}="${c}"]`), f = d == null ? void 0 : d.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Ke}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ L("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(_r, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(_r, { role: "reading", ...n }) }) : null
  ] });
}
const Gc = () => () => {
}, Lr = () => null;
function Zc({
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
function Yc(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Xc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Qc(e) {
  const t = $e(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? At, y = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), v = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, g = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, S = (t == null ? void 0 : t.compareVersion) ?? null, b = (S == null ? void 0 : S.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", I = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = S ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, $ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), D = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), B = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), R = e.regions ?? (t == null ? void 0 : t.regions) ?? [], P = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [M, _] = N(null), U = Qr(
    T ? T.subscribe : Gc,
    T ? () => T.get().itemId : Lr,
    T ? () => T.get().itemId : Lr
  ), F = T ? U : M, G = O((fe) => {
    T ? T.set(fe, "pdf") : _(fe);
  }, [T]), ne = Zc({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: d
  }), Q = Number.isFinite(y) && y > 0 ? Yc(
    y,
    n || r,
    typeof document > "u" ? y * 2 : document.documentElement.clientWidth
  ) : null;
  return Wc(u, Q), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: fo,
      "data-reader-region-count": R.length,
      "data-reader-structured-region-count": R.filter(wa).length,
      "data-reader-metadata-ready": P ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${Ws} reader-mode-${ne.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              v ? /* @__PURE__ */ p(
                Nr,
                {
                  pane: "source",
                  url: b,
                  preloadedFile: E,
                  userZoom: m,
                  visible: ne.showSource,
                  scrollRoot: u,
                  pageWidthOverride: Q,
                  rowHeights: ne.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: g ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: D,
                  activeRegion: B,
                  regions: (S == null ? void 0 : S.regions) ?? R,
                  readerMetadata: P,
                  hoveredRegionId: F,
                  onHoverRegion: G,
                  liveTranslation: d ? o : void 0,
                  showLiveTranslation: d,
                  liveTranslationPendingLabel: d ? Xc(o) : "",
                  paneAction: d ? /* @__PURE__ */ L(nt, { children: [
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
                S ? `compare:${S.url}` : "source"
              ) : null,
              w ? /* @__PURE__ */ p(
                Nr,
                {
                  pane: "translated",
                  url: I,
                  preloadedFile: k,
                  userZoom: m,
                  visible: ne.showTranslated,
                  scrollRoot: u,
                  pageWidthOverride: Q,
                  rowHeights: ne.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: D,
                  activeRegion: B,
                  regions: R,
                  readerMetadata: P,
                  hoveredRegionId: F,
                  onHoverRegion: G,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        S ? /* @__PURE__ */ p(qc, { shellEl: u, left: S.left, right: S.right }) : null
      ]
    }
  );
}
const ed = [
  { id: "source", label: "原文", Icon: oo },
  { id: "compare", label: "对照", Icon: ao },
  { id: "translated", label: "译文", Icon: so }
];
function td(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function nd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function rd(e) {
  const t = $e(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, i = a ? td(a.state) : "";
  return /* @__PURE__ */ L("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || i,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ p(_a, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: i })
        ]
      }
    ) : null,
    /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: ed.map(({ id: l, label: c, Icon: d }) => {
      const f = n === l, u = nd({
        id: l,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${f ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": f,
          "aria-label": c,
          title: u ? `${c} 需要文档任务` : c,
          disabled: u,
          onClick: () => o(l),
          children: [
            /* @__PURE__ */ p(d, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: c })
          ]
        },
        l
      );
    }) })
  ] });
}
const od = Xr(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), ad = od, sd = {
  markdown: { label: "Markdown", short: "MD", Icon: ad, needsJob: !0 }
}, id = bo.map(
  (e) => ({ id: e, ...sd[e] })
);
function Bo() {
  return id.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function ld(e) {
  const t = $e(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(nt, { children: Bo().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
    const d = n === s, f = c && r, u = d ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": u,
        "aria-pressed": d,
        title: f ? `${i} 需打开任务阅读` : i,
        disabled: f,
        onClick: () => d ? a() : o(s),
        children: [
          /* @__PURE__ */ p(l, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function cd(e) {
  const t = $e(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Bo().map(({ id: l, label: c, short: d, Icon: f, needsJob: u }) => ({
    key: l,
    label: c,
    short: d,
    Icon: f,
    disabled: u && o,
    selected: n === l,
    badge: r == null ? void 0 : r[l],
    onClick: () => a(l)
  }));
  return n ? /* @__PURE__ */ L("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: d, disabled: f, selected: u, badge: m, onClick: y }) => /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": u,
        className: `reader-assistant-dock-tab${u ? " is-active" : ""}`,
        title: f ? `${c} 需打开任务阅读` : c,
        disabled: f,
        onClick: y,
        children: [
          /* @__PURE__ */ p(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-assistant-dock-tab-label", children: c }),
          m ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: m }) : null
        ]
      },
      l
    )) }),
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ p(pt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function dd(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function ud(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function fd(e) {
  return e / 100 * window.innerHeight;
}
function md(e) {
  return e / 100 * window.innerWidth;
}
function hd(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function St({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = hd(n);
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
      r = ud(t, o);
      break;
    }
    case "em": {
      r = dd(t, o);
      break;
    }
    case "vh": {
      r = fd(o);
      break;
    }
    case "vw": {
      r = md(o);
      break;
    }
  }
  return r;
}
function ye(e) {
  return parseFloat(e.toFixed(3));
}
function mt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function En(e) {
  const { panels: t } = e, n = mt({ group: e });
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
      const d = St({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = ye(d / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const d = St({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = ye(d / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const d = St({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = ye(d / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const d = St({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = ye(d / n * 100);
    }
    return {
      groupResizeBehavior: a.groupResizeBehavior,
      collapsedSize: s,
      collapsible: a.collapsible === !0,
      defaultSize: i,
      disabled: a.disabled,
      minSize: l,
      maxSize: c,
      panelId: r.id
    };
  });
}
function re(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Pn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? pd : gd
  );
}
function pd(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function gd(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function jo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Uo(e, t) {
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
function bd({
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
    const { x: i, y: l } = Uo(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return re(o, "No rect found"), o;
}
let Ot;
function yd() {
  return Ot === void 0 && (typeof matchMedia == "function" ? Ot = !!matchMedia("(pointer:coarse)").matches : Ot = !1), Ot;
}
function Ho(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Pn(
    n,
    Array.from(t.children).filter(jo).map((y) => ({ element: y }))
  ).map(({ element: y }) => y), s = [];
  let i = !1, l = !1, c = -1, d = -1, f = 0, u, m = [];
  {
    let y = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (y++, h.hasAttribute("data-disabled") || (f++, c === -1 && (c = y), d = y));
  }
  if (f > 1) {
    let y = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        y++;
        const v = r.find(
          (w) => w.element === h
        );
        if (v) {
          if (u) {
            const w = u.element.getBoundingClientRect(), g = h.getBoundingClientRect();
            let S;
            if (l) {
              const b = n === "horizontal" ? new DOMRect(
                w.right,
                w.top,
                0,
                w.height
              ) : new DOMRect(
                w.left,
                w.bottom,
                w.width,
                0
              ), I = n === "horizontal" ? new DOMRect(g.left, g.top, 0, g.height) : new DOMRect(g.left, g.top, g.width, 0);
              switch (m.length) {
                case 0: {
                  S = [
                    b,
                    I
                  ];
                  break;
                }
                case 1: {
                  const E = m[0], k = bd({
                    orientation: n,
                    rects: [w, g],
                    targetRect: E.element.getBoundingClientRect()
                  });
                  S = [
                    E,
                    k === w ? I : b
                  ];
                  break;
                }
                default: {
                  S = m;
                  break;
                }
              }
            } else
              m.length ? S = m : S = [
                n === "horizontal" ? new DOMRect(
                  w.right,
                  g.top,
                  g.left - w.right,
                  g.height
                ) : new DOMRect(
                  g.left,
                  w.bottom,
                  g.width,
                  g.top - w.bottom
                )
              ];
            for (const b of S) {
              let I = "width" in b ? b : b.element.getBoundingClientRect();
              const E = yd() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (I.width < E) {
                const $ = E - I.width;
                I = new DOMRect(
                  I.x - $ / 2,
                  I.y,
                  I.width + $,
                  I.height
                );
              }
              if (I.height < E) {
                const $ = E - I.height;
                I = new DOMRect(
                  I.x,
                  I.y - $ / 2,
                  I.width,
                  I.height + $
                );
              }
              const k = y <= c || y > d;
              !i && !k && s.push({
                group: e,
                groupSize: mt({ group: e }),
                panels: [u, v],
                separator: "width" in b ? void 0 : b,
                rect: I
              }), i = !1;
            }
          }
          l = !1, u = v, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const v = o.find(
          (w) => w.element === h
        );
        v ? m.push(v) : (u = void 0, m = []);
      } else
        l = !0;
  }
  return s;
}
var He;
class Wo {
  constructor() {
    er(this, He, {});
  }
  addListener(t, n) {
    const r = gt(this, He)[t];
    return r === void 0 ? gt(this, He)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = gt(this, He)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let o = !1, a = null;
        const s = Array.from(r);
        for (let i = 0; i < s.length; i++) {
          const l = s[i];
          try {
            l.call(null, n);
          } catch (c) {
            a === null && (o = !0, a = c);
          }
        }
        if (o)
          throw a;
      }
  }
  removeAllListeners() {
    tr(this, He, {});
  }
  removeListener(t, n) {
    const r = gt(this, He)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
He = new WeakMap();
let ut = {
  cursorFlags: 0,
  state: "inactive"
};
const $n = new Wo();
function Qe() {
  return ut;
}
function vd(e) {
  return $n.addListener("change", e);
}
function wd(e) {
  const t = ut, n = { ...ut };
  n.cursorFlags = e, ut = n, $n.emit("change", {
    prev: t,
    next: n
  });
}
function ft(e) {
  const t = ut;
  ut = e, $n.emit("change", {
    prev: t,
    next: e
  });
}
const Sd = (e) => e, dn = () => {
}, Vo = 1, Ko = 2, Jo = 4, qo = 8, Dr = 3, Cr = 12;
let $t;
function xr() {
  return $t === void 0 && ($t = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && ($t = !0)), $t;
}
function Id({
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
        if (e && xr()) {
          const a = (e & Vo) !== 0, s = (e & Ko) !== 0, i = (e & Jo) !== 0, l = (e & qo) !== 0;
          if (a)
            return i ? "se-resize" : l ? "ne-resize" : "e-resize";
          if (s)
            return i ? "sw-resize" : l ? "nw-resize" : "w-resize";
          if (i)
            return "s-resize";
          if (l)
            return "n-resize";
        }
        break;
      }
    }
    return xr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const zr = /* @__PURE__ */ new WeakMap();
function Fn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = zr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Qe();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Id({
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
  zr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ae = /* @__PURE__ */ new Map();
const Go = new Wo();
function Rd(e) {
  Ae = new Map(Ae), Ae.delete(e);
}
function Or(e, t) {
  for (const [n] of Ae)
    if (n.id === e)
      return n;
}
function Ve(e, t) {
  for (const [n, r] of Ae)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function rt() {
  return Ae;
}
function Bn(e, t) {
  return Go.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Oe(e, t, n) {
  const r = Ae.get(e);
  Ae = new Map(Ae), Ae.set(e, t), Go.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Zo(e) {
  const t = Qe();
  let n = !1;
  switch (t.state) {
    case "active":
      ft({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Fn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Ve(r.group.id, !0);
        Oe(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function $r(e) {
  e.defaultPrevented || Zo(e.currentTarget);
}
function Ed(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Uo(n, a.rect);
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
function Pd(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Td(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: jr(e),
    b: jr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  re(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Br(Fr(n.a)),
    b: Br(Fr(n.b))
  };
  if (o.a === o.b) {
    const a = r.childNodes, s = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let i = a.length;
    for (; i--; ) {
      const l = a[i];
      if (l === s.a) return 1;
      if (l === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
const kd = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Nd(e) {
  const t = getComputedStyle(Yo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Md(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Nd(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || kd.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Fr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (re(n, "Missing node"), Md(n)) return n;
  }
  return null;
}
function Br(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function jr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Yo(e);
  return t;
}
function Yo(e) {
  const { parentNode: t } = e;
  return Pd(t) ? t.host : t;
}
function Ad(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function _d({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!jo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Td(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Ad(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function jn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Ho(o), s = Ed(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && _d({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Ld(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function be(e, t, n = 0) {
  return Math.abs(ye(e) - ye(t)) <= n;
}
function Me(e, t) {
  return be(e, t) ? 0 : e > t ? 1 : -1;
}
function dt({
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
    minSize: l = 0
  } = t;
  if (s && !e)
    return n;
  if (Me(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      Me(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = ye(r), r;
}
function kt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (be(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), l = Object.values(o), c = [...i], [d, f] = r;
  re(d != null, "Invalid first pivot index"), re(f != null, "Invalid second pivot index");
  let u = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : d, v = n[h];
        re(
          v,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: g,
          minSize: S = 0
        } = v;
        if (g) {
          const b = i[h];
          if (re(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), be(b, w)) {
            const I = S - b;
            Me(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      {
        const h = e < 0 ? d : f, v = n[h];
        re(
          v,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: g,
          minSize: S = 0
        } = v;
        if (g) {
          const b = i[h];
          if (re(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), be(b, S)) {
            const I = b - w;
            Me(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : d, v = n[h];
      re(
        v,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: g, collapsedSize: S, minSize: b } = v;
      if (g && Me(w, b) < 0)
        if (e > 0) {
          const I = b - S, E = I / 2, k = w + e;
          Me(k, b) < 0 && (e = Me(e, E) <= 0 ? 0 : I);
        } else {
          const I = b - S, E = 100 - I / 2, k = w - e;
          Me(k, b) < 0 && (e = Me(100 + e, E) > 0 ? 0 : -I);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let v = e < 0 ? f : d, w = 0;
    for (; ; ) {
      const S = i[v];
      re(
        S != null,
        `Previous layout not found for panel index ${v}`
      );
      const b = dt({
        overrideDisabledPanels: s,
        panelConstraints: n[v],
        prevSize: S,
        size: 100
      }) - S;
      if (w += b, v += h, v < 0 || v >= n.length)
        break;
    }
    const g = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - g : g;
  }
  {
    let h = e < 0 ? d : f;
    for (; h >= 0 && h < n.length; ) {
      const v = Math.abs(e) - Math.abs(u), w = i[h];
      re(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const g = w - v, S = dt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: g
      });
      if (!be(w, S) && (u += w - S, c[h] = S, u.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Ld(l, c))
    return o;
  {
    const h = e < 0 ? f : d, v = i[h];
    re(
      v != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = v + u, g = dt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: v,
      size: w
    });
    if (c[h] = g, !be(g, w)) {
      let S = w - g, b = e < 0 ? f : d;
      for (; b >= 0 && b < n.length; ) {
        const I = c[b];
        re(
          I != null,
          `Previous layout not found for panel index ${b}`
        );
        const E = I + S, k = dt({
          overrideDisabledPanels: s,
          panelConstraints: n[b],
          prevSize: I,
          size: E
        });
        if (be(I, k) || (S -= k - I, c[b] = k), be(S, 0))
          break;
        e > 0 ? b-- : b++;
      }
    }
  }
  const m = Object.values(c).reduce(
    (h, v) => v + h,
    0
  );
  if (!be(m, 100, 0.1))
    return o;
  const y = Object.keys(o);
  return c.reduce((h, v, w) => (h[y[w]] = v, h), {});
}
function et(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Me(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function tt({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], o = r.reduce(
    (i, l) => i + l,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((i) => `${i}%`).join(", ")}`
    );
  if (!be(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      re(l != null, `No layout data found for index ${i}`);
      const c = 100 / o * l;
      r[i] = c;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const l = n[i];
    re(l != null, `No layout data found for index ${i}`);
    const c = r[i];
    re(c != null, `No layout data found for index ${i}`);
    const d = dt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: l,
      size: c
    });
    c != d && (a += c - d, r[i] = d);
  }
  if (!be(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      re(l != null, `No layout data found for index ${i}`);
      const c = l + a, d = dt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== d && (a -= d - l, r[i] = d, be(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, l, c) => (i[s[c]] = l, i), {});
}
function Xo({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = rt();
    for (const [
      c,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: f,
        layout: u,
        groupSize: m,
        separatorToPanels: y
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: f,
          group: c,
          groupSize: m,
          layout: u,
          separatorToPanels: y
        };
    throw Error(`Group ${e} not found`);
  }, r = () => {
    const l = n().derivedPanelConstraints.find(
      (c) => c.panelId === t
    );
    if (l !== void 0)
      return l;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, o = () => {
    const l = n().group.panels.find((c) => c.id === t);
    if (l !== void 0)
      return l;
    throw Error(`Layout not found for Panel ${t}`);
  }, a = () => {
    const l = n().layout[t];
    if (l !== void 0)
      return l;
    throw Error(`Layout not found for Panel ${t}`);
  }, s = ({
    nextSize: l,
    panels: c,
    prevLayout: d,
    derivedPanelConstraints: f
  }) => {
    const u = a(), m = c.findIndex((v) => v.id === t), y = m === 0, h = m === c.length - 1;
    if (h && l < u && (y || c.slice(0, m).every((v, w) => {
      const g = f[w];
      return (g == null ? void 0 : g.collapsible) && be(g.collapsedSize, d[g.panelId]);
    }))) {
      const v = c.slice(0, m).reduce((w, g) => w + d[g.id], 0);
      return {
        ...d,
        [t]: ye(100 - v)
      };
    }
    return kt({
      delta: h ? u - l : l - u,
      initialLayout: d,
      panelConstraints: f,
      pivotIndices: h ? [m - 1, m] : [m, m + 1],
      prevLayout: d,
      trigger: "imperative-api"
    });
  }, i = (l) => {
    const c = a();
    if (l === c)
      return;
    const {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: f,
      group: u,
      groupSize: m,
      layout: y,
      separatorToPanels: h
    } = n(), v = s({
      nextSize: l,
      panels: u.panels,
      prevLayout: y,
      derivedPanelConstraints: f
    }), w = tt({
      layout: v,
      panelConstraints: f
    });
    et(y, w) || Oe(u, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: f,
      groupSize: m,
      layout: w,
      separatorToPanels: h
    });
  };
  return {
    collapse: () => {
      const { collapsible: l, collapsedSize: c } = r(), { mutableValues: d } = o(), f = a();
      l && f !== c && (d.expandToSize = f, i(c));
    },
    expand: () => {
      const { collapsible: l, collapsedSize: c, minSize: d } = r(), { mutableValues: f } = o(), u = a();
      if (l && u === c) {
        let m = f.expandToSize ?? d;
        m === 0 && (m = 1), i(m);
      }
    },
    getSize: () => {
      const { group: l } = n(), c = a(), { element: d } = o(), f = l.orientation === "horizontal" ? d.offsetWidth : d.offsetHeight;
      return {
        asPercentage: c,
        inPixels: f
      };
    },
    isCollapsed: () => {
      const { collapsible: l, collapsedSize: c } = r(), d = a();
      return l && be(c, d);
    },
    resize: (l) => {
      const { group: c } = n(), { element: d } = o(), f = mt({ group: c }), u = St({
        groupSize: f,
        panelElement: d,
        styleProp: l
      }), m = ye(u / f * 100);
      i(m);
    }
  };
}
function Ur(e) {
  if (e.defaultPrevented)
    return;
  const t = rt();
  jn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Xo({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Bt(e) {
  const t = rt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Qo({
  groupId: e
}) {
  const t = () => {
    const n = rt();
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
        separatorToPanels: l
      } = t(), c = tt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (et(i, c) || Oe(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function Ze(e, t) {
  const n = Bt(e), r = Ve(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  re(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  re(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = Qo({ groupId: n.id }).getLayout(), l = kt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = tt({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  et(i, c) || Oe(
    n,
    {
      defaultLayoutDeferred: r.defaultLayoutDeferred,
      derivedPanelConstraints: r.derivedPanelConstraints,
      groupSize: r.groupSize,
      layout: c,
      separatorToPanels: r.separatorToPanels
    },
    // Keyboard resizes (arrow keys, Home/End, Enter collapse/expand) originate
    // from a real DOM event on the separator, so they are user interactions
    // just like pointer drags. This function is only reached from
    // onDocumentKeyDown. See #716.
    { isUserInteraction: !0 }
  );
}
function Hr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Bt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && Ze(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Ze(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Ze(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Ze(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Ze(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Bt(t), o = Ve(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (u) => u.element === t
        );
        re(l, "Matching separator not found");
        const c = i.get(l);
        re(c, "Matching panels not found");
        const d = c[0], f = a.find(
          (u) => u.panelId === d.id
        );
        if (re(f, "Panel metadata not found"), f.collapsible) {
          const u = s[d.id], m = f.collapsedSize === u ? r.mutableState.expandedPanelSizes[d.id] ?? f.minSize : f.collapsedSize;
          Ze(t, m - u);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Bt(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        re(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), Ze(t, -100);
        break;
      }
    }
}
function Wr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = rt(), n = jn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), ft({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function ea({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: o,
  pointerDownAtPoint: a,
  prevCursorFlags: s
}) {
  let i = 0;
  n.forEach((c) => {
    const { group: d, groupSize: f } = c, { orientation: u, panels: m } = d, { disableCursor: y } = d.mutableState;
    let h = 0;
    a ? u === "horizontal" ? h = (t.clientX - a.x) / f * 100 : h = (t.clientY - a.y) / f * 100 : u === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const v = r.get(d), w = o.get(d);
    if (!v || !w)
      return;
    const {
      defaultLayoutDeferred: g,
      derivedPanelConstraints: S,
      groupSize: b,
      layout: I,
      separatorToPanels: E
    } = w;
    if (S && I && E) {
      const k = kt({
        delta: h,
        initialLayout: v,
        panelConstraints: S,
        pivotIndices: c.panels.map(($) => m.indexOf($)),
        prevLayout: I,
        trigger: "mouse-or-touch"
      });
      if (et(k, I)) {
        if (h !== 0 && !y)
          switch (u) {
            case "horizontal": {
              i |= h < 0 ? Vo : Ko;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Jo : qo;
              break;
            }
          }
      } else
        Oe(c.group, {
          defaultLayoutDeferred: g,
          derivedPanelConstraints: S,
          groupSize: b,
          layout: k,
          separatorToPanels: E
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & Dr : l |= i & Dr, t.movementY === 0 ? l |= s & Cr : l |= i & Cr, wd(l), Fn(e);
}
function Vr(e) {
  const t = rt(), n = Qe();
  switch (n.state) {
    case "active":
      ea({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Kr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = Qe(), n = rt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        ft({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Ve(a.group.id, !0);
          Oe(a.group, s, {
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
      ea({
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
      const a = jn(e, n);
      a.length === 0 ? t.state !== "inactive" && ft({
        cursorFlags: 0,
        state: "inactive"
      }) : ft({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Fn(e.currentTarget);
      break;
    }
  }
}
function Jr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Qe().state) {
      case "hover":
        ft({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function qr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Zo(e.currentTarget) && e.preventDefault();
}
function Gr(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = ye(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = ye((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Dd(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = mt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: ye(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Cd(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function xd({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const i = /* @__PURE__ */ new Map(), l = [];
  for (const f of e.panels) {
    const u = r[f.id] ?? 0;
    switch (f.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const m = u / 100 * n, y = ye(
          m / t * 100
        );
        i.set(f.id, y), o += y;
        break;
      }
      case "preserve-relative-size":
      default: {
        l.push(f.id), a += u;
        break;
      }
    }
  }
  if (!s || l.length === 0)
    return r;
  const c = 100 - o, d = { ...r };
  if (i.forEach((f, u) => {
    d[u] = f;
  }), a > 0)
    for (const f of l) {
      const u = r[f] ?? 0;
      d[f] = ye(
        u / a * c
      );
    }
  else {
    const f = ye(
      c / l.length
    );
    for (const u of l)
      d[u] = f;
  }
  return d;
}
function zd(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const it = /* @__PURE__ */ new Map();
function Od(e) {
  let t = !0;
  re(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((y) => {
    for (const h of y) {
      const { borderBoxSize: v, target: w } = h;
      if (w === e.element) {
        if (t) {
          const g = mt({ group: e });
          if (g === 0)
            return;
          const S = Ve(e.id);
          if (!S)
            return;
          const b = En(e), I = S.defaultLayoutDeferred ? Gr(b) : S.layout, E = xd({
            group: e,
            nextGroupSize: g,
            prevGroupSize: S.groupSize,
            prevLayout: I
          }), k = tt({
            layout: E,
            panelConstraints: b
          });
          if (!S.defaultLayoutDeferred && et(S.layout, k) && Cd(
            S.derivedPanelConstraints,
            b
          ) && S.groupSize === g)
            return;
          Oe(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: b,
            groupSize: g,
            layout: k,
            separatorToPanels: S.separatorToPanels
          });
        }
      } else
        Dd(e, w, v);
    }
  });
  a.observe(e.element), e.panels.forEach((y) => {
    re(
      !r.has(y.id),
      `Panel ids must be unique; id "${y.id}" was used more than once`
    ), r.add(y.id), y.onResize && a.observe(y.element);
  });
  const s = mt({ group: e }), i = En(e), l = e.panels.map(({ id: y }) => y).join(",");
  let c = e.mutableState.defaultLayout;
  c && (zd(e.panels, c) || (c = void 0));
  const d = e.mutableState.layouts[l] ?? c ?? Gr(i), f = tt({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  it.set(
    u,
    (it.get(u) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Ho(e).forEach((y) => {
    y.separator && m.set(y.separator, y.panels);
  }), Oe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((y) => {
    re(
      !o.has(y.id),
      `Separator ids must be unique; id "${y.id}" was used more than once`
    ), o.add(y.id), y.element.addEventListener("keydown", Hr);
  }), it.get(u) === 1 && (u.addEventListener("contextmenu", $r, !0), u.addEventListener("dblclick", Ur, !0), u.addEventListener("pointerdown", Wr, !0), u.addEventListener("pointerleave", Vr), u.addEventListener("pointermove", Kr), u.addEventListener("pointerout", Jr), u.addEventListener("pointerup", qr, !0)), function() {
    t = !1, it.set(
      u,
      Math.max(0, (it.get(u) ?? 0) - 1)
    ), Rd(e), e.separators.forEach((y) => {
      y.element.removeEventListener("keydown", Hr);
    }), it.get(u) || (u.removeEventListener(
      "contextmenu",
      $r,
      !0
    ), u.removeEventListener(
      "dblclick",
      Ur,
      !0
    ), u.removeEventListener(
      "pointerdown",
      Wr,
      !0
    ), u.removeEventListener("pointerleave", Vr), u.removeEventListener("pointermove", Kr), u.removeEventListener("pointerout", Jr), u.removeEventListener("pointerup", qr, !0)), a.disconnect();
  };
}
function $d() {
  const [e, t] = N({}), n = O(() => t({}), []);
  return [e, n];
}
function Un(e) {
  const t = eo();
  return `${e ?? t}`;
}
const ot = typeof window < "u" ? Se : x;
function It(e) {
  const t = A(e);
  return ot(() => {
    t.current = e;
  }, [e]), O(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Hn(...e) {
  return It((t) => {
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
function Wn(e) {
  const t = A({ ...e });
  return ot(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ta = Mn(null);
function Fd(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: Sd
  });
  _n(t, () => n.current, []), ot(() => {
    Object.assign(
      n.current,
      Qo({ groupId: e })
    );
  });
}
function na({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: o,
  elementRef: a,
  groupRef: s,
  id: i,
  onLayoutChange: l,
  onLayoutChanged: c,
  orientation: d = "horizontal",
  resizeTargetMinimumSize: f = {
    coarse: 20,
    fine: 10
  },
  style: u,
  ...m
}) {
  const y = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = It((R) => {
    et(y.current.onLayoutChange, R) || (y.current.onLayoutChange = R, l == null || l(R));
  }), v = It(
    (R, P) => {
      et(y.current.onLayoutChanged, R) || (y.current.onLayoutChanged = R, c == null || c(R, { isUserInteraction: P }));
    }
  ), w = Un(i), g = A(null), [S, b] = $d(), I = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), E = Hn(g, a);
  Fd(w, s);
  const k = It(
    (R, P) => {
      const T = Qe(), M = Or(R), _ = Ve(R);
      if (_) {
        let U = !1;
        switch (T.state) {
          case "active": {
            U = T.hitRegions.some(
              (F) => F.group === M
            );
            break;
          }
        }
        return {
          flexGrow: _.layout[P] ?? 1,
          pointerEvents: U ? "none" : void 0
        };
      }
      if (n != null && n[P])
        return {
          flexGrow: n == null ? void 0 : n[P]
        };
    }
  ), $ = Wn({
    defaultLayout: n,
    disableCursor: r
  }), D = q(
    () => ({
      get disableCursor() {
        return !!$.disableCursor;
      },
      getPanelStyles: k,
      id: w,
      orientation: d,
      registerPanel: (R) => {
        const P = I.current;
        return P.panels = Pn(d, [
          ...P.panels,
          R
        ]), b(), () => {
          P.panels = P.panels.filter(
            (T) => T !== R
          ), b();
        };
      },
      registerSeparator: (R) => {
        const P = I.current;
        return P.separators = Pn(d, [
          ...P.separators,
          R
        ]), b(), () => {
          P.separators = P.separators.filter(
            (T) => T !== R
          ), b();
        };
      },
      updatePanelProps: (R, { disabled: P }) => {
        const T = I.current.panels.find(
          (U) => U.id === R
        );
        T && (T.panelConstraints.disabled = P);
        const M = Or(w), _ = Ve(w);
        M && _ && Oe(M, {
          ..._,
          derivedPanelConstraints: En(M)
        });
      },
      updateSeparatorProps: (R, {
        disabled: P,
        disableDoubleClick: T
      }) => {
        const M = I.current.separators.find(
          (_) => _.id === R
        );
        M && (M.disabled = P, M.disableDoubleClick = T);
      }
    }),
    [k, w, b, d, $]
  ), B = A(null);
  return ot(() => {
    const R = g.current;
    if (R === null)
      return;
    const P = I.current;
    let T;
    if ($.defaultLayout !== void 0 && Object.keys($.defaultLayout).length === P.panels.length) {
      T = {};
      for (const X of P.panels) {
        const Q = $.defaultLayout[X.id];
        Q !== void 0 && (T[X.id] = Q);
      }
    }
    const M = {
      disabled: !!o,
      element: R,
      id: w,
      mutableState: {
        defaultLayout: T,
        disableCursor: !!$.disableCursor,
        expandedPanelSizes: I.current.lastExpandedPanelSizes,
        layouts: I.current.layouts
      },
      orientation: d,
      panels: P.panels,
      resizeTargetMinimumSize: P.resizeTargetMinimumSize,
      separators: P.separators
    };
    B.current = M;
    const _ = Od(M), { defaultLayoutDeferred: U, derivedPanelConstraints: F, layout: G } = Ve(M.id, !0);
    !U && F.length > 0 && (h(G), v(G, !1));
    const ne = Bn(w, (X) => {
      const { defaultLayoutDeferred: Q, derivedPanelConstraints: fe, layout: ce } = X.next;
      if (Q || fe.length === 0)
        return;
      const de = M.panels.map(({ id: K }) => K).join(",");
      M.mutableState.layouts[de] = ce, fe.forEach((K) => {
        if (K.collapsible) {
          const { layout: ee } = X.prev ?? {};
          if (ee) {
            const he = be(
              K.collapsedSize,
              ce[K.panelId]
            ), te = be(
              K.collapsedSize,
              ee[K.panelId]
            );
            he && !te && (M.mutableState.expandedPanelSizes[K.panelId] = ee[K.panelId]);
          }
        }
      });
      const me = Qe().state !== "active";
      h(ce), me && v(ce, X.isUserInteraction);
    });
    return () => {
      B.current = null, _(), ne();
    };
  }, [
    o,
    w,
    v,
    h,
    d,
    S,
    $
  ]), x(() => {
    const R = B.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ta.Provider, { value: D, children: /* @__PURE__ */ p(
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
        ...u,
        display: "flex",
        flexDirection: d === "horizontal" ? "row" : "column",
        flexWrap: "nowrap",
        // Inform the browser that the library is handling touch events for this element
        // but still allow users to scroll content within panels in the non-resizing direction
        // NOTE This is not an inherited style
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: d === "horizontal" ? "pan-y" : "pan-x"
      },
      children: e
    }
  ) });
}
na.displayName = "Group";
function Vn() {
  const e = An(ta);
  return re(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Bd(e, t) {
  const { id: n } = Vn(), r = A({
    collapse: dn,
    expand: dn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: dn
  });
  _n(t, () => r.current, []), ot(() => {
    Object.assign(
      r.current,
      Xo({ groupId: n, panelId: e })
    );
  });
}
function Tn({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: r = !1,
  defaultSize: o,
  disabled: a,
  elementRef: s,
  groupResizeBehavior: i = "preserve-relative-size",
  id: l,
  maxSize: c = "100%",
  minSize: d = "0%",
  onResize: f,
  panelRef: u,
  style: m,
  ...y
}) {
  const h = !!l, v = Un(l), w = Wn({
    disabled: a
  }), g = A(null), S = Hn(g, s), {
    getPanelStyles: b,
    id: I,
    orientation: E,
    registerPanel: k,
    updatePanelProps: $
  } = Vn(), D = f !== null, B = It(
    (M, _, U) => {
      f == null || f(M, l, U);
    }
  );
  ot(() => {
    const M = g.current;
    if (M !== null) {
      const _ = {
        element: M,
        id: v,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? B : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: w.disabled,
          maxSize: c,
          minSize: d
        }
      };
      return k(_);
    }
  }, [
    i,
    n,
    r,
    o,
    D,
    v,
    h,
    c,
    d,
    B,
    k,
    w
  ]), x(() => {
    $(v, { disabled: a });
  }, [a, v, $]), Bd(v, u);
  const R = () => {
    const M = b(I, v);
    if (M)
      return JSON.stringify(M);
  }, P = Qr(
    (M) => Bn(I, M),
    R,
    R
  );
  let T;
  return P ? T = JSON.parse(P) : o !== void 0 ? T = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : T = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...y,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": v,
      id: v,
      ref: S,
      style: {
        ...jd,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...T
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
Tn.displayName = "Panel";
const jd = {
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
function Ud({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let o, a;
  const s = e[n], i = t.find(
    (l) => l.panelId === n
  );
  if (i) {
    const l = i.maxSize, c = i.collapsible ? i.collapsedSize : i.minSize, d = [r, r + 1];
    a = tt({
      layout: kt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = tt({
      layout: kt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
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
function ra({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = Un(a), c = Wn({
    disabled: n,
    disableDoubleClick: r
  }), [d, f] = N({}), [u, m] = N("inactive"), [y, h] = N(!1), v = A(null), w = Hn(v, o), {
    disableCursor: g,
    id: S,
    orientation: b,
    registerSeparator: I,
    updateSeparatorProps: E
  } = Vn(), k = b === "horizontal" ? "vertical" : "horizontal";
  ot(() => {
    const B = v.current;
    if (B !== null) {
      const R = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: B,
        id: l
      }, P = I(R), T = vd(
        (_) => {
          m(
            _.next.state !== "inactive" && _.next.hitRegions.some(
              (U) => U.separator === R
            ) ? _.next.state : "inactive"
          );
        }
      ), M = Bn(
        S,
        (_) => {
          const { derivedPanelConstraints: U, layout: F, separatorToPanels: G } = _.next, ne = G.get(R);
          if (ne) {
            const X = ne[0], Q = ne.indexOf(X);
            f(
              Ud({
                layout: F,
                panelConstraints: U,
                panelId: X.id,
                panelIndex: Q
              })
            );
          }
        }
      );
      return () => {
        T(), M(), P();
      };
    }
  }, [S, l, I, c]), x(() => {
    E(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, E]);
  let $;
  n && !g && ($ = "not-allowed");
  let D;
  if (n)
    D = "disabled";
  else
    switch (u) {
      case "active": {
        D = "active";
        break;
      }
      default:
        y ? D = "focus" : D = u;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": d.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": k,
      "aria-valuemax": d.valueMax,
      "aria-valuemin": d.valueMin,
      "aria-valuenow": d.valueNow,
      children: e,
      className: t,
      "data-separator": D,
      "data-testid": l,
      id: l,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: w,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: $,
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
ra.displayName = "Separator";
const Kn = 30, Jn = 65, Nt = 50, Hd = 100 - Jn, Wd = 100 - Kn;
function Vd(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Jn, Math.max(Kn, t)) : Nt;
}
function qn(e) {
  return 100 - e;
}
function lt(e) {
  return `${e}%`;
}
const Gn = "reader-document", Mt = "reader-assistant", oa = "retainpdf.reader.ai-split-layout.v1", Kd = {
  [Gn]: qn(Nt),
  [Mt]: Nt
};
function Zn(e) {
  const t = Vd(e == null ? void 0 : e[Mt]);
  return {
    [Gn]: qn(t),
    [Mt]: t
  };
}
function Jd() {
  try {
    const e = JSON.parse(localStorage.getItem(oa) || "null");
    return Zn(e);
  } catch {
    return Kd;
  }
}
function qd(e) {
  try {
    localStorage.setItem(oa, JSON.stringify(Zn(e)));
  } catch {
  }
}
function un(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Zn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Mt]}vw`
  );
}
function Gd() {
  const e = A(null), [t] = N(Jd);
  Se(() => {
    const o = e.current;
    return un(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = O((o) => {
    un(e.current, o);
  }, []), r = O((o, a) => {
    un(e.current, o), a.isUserInteraction && qd(o);
  }, []);
  return /* @__PURE__ */ L(
    na,
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
          Tn,
          {
            id: Gn,
            defaultSize: lt(qn(Nt)),
            minSize: lt(Hd),
            maxSize: lt(Wd)
          }
        ),
        /* @__PURE__ */ p(
          ra,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Tn,
          {
            id: Mt,
            defaultSize: lt(Nt),
            minSize: lt(Kn),
            maxSize: lt(Jn)
          }
        )
      ]
    }
  );
}
function Zd({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = N(!1);
  if (x(() => {
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
function Yd({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Zd, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(nt, { children: [
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
      s ? /* @__PURE__ */ p(oe, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Xd(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Qd() {
  const [e, t] = N(!1), n = eo(), r = A(null);
  return x(() => {
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
  }, [e]), x(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Xd(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
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
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ p(La, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: Zi.map((o) => /* @__PURE__ */ L("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: o.title }),
            /* @__PURE__ */ p("ul", { children: o.items.map((a) => /* @__PURE__ */ L("li", { children: [
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
const eu = ["source", "sideBySide", "translated"], tu = { source: "", translated: "", sideBySide: "" };
function nu(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = jt(e.sourceUrl), n = jt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return as({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function ru(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = q(
    () => e ? nu(e) : tu,
    [e]
  ), o = q(
    () => eu.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = O(async (s) => {
    if (!e) return;
    const i = jt(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? os(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ss(
          e.fetchProtected,
          i,
          l,
          l,
          null,
          (c) => n((d) => {
            const f = new Set(d);
            return c ? f.add(s) : f.delete(s), f;
          })
        );
      } catch (l) {
        const c = l instanceof Error ? l.message : "下载失败";
        is(c), n((d) => {
          const f = new Set(d);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const ou = {
  source: oo,
  sideBySide: ao,
  translated: so
}, au = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function su(e) {
  const t = $e(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = ru(n), i = A(null);
  return x(() => {
    const l = () => {
      var f;
      (f = i.current) != null && f.open && (i.current.open = !1);
    }, c = (f) => {
      i.current && !i.current.contains(f.target) && l();
    }, d = (f) => {
      f.key === "Escape" && l();
    };
    return document.addEventListener("pointerdown", c), document.addEventListener("keydown", d), () => {
      document.removeEventListener("pointerdown", c), document.removeEventListener("keydown", d);
    };
  }, []), /* @__PURE__ */ L("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ L("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(Da, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(ro, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = fa[l], d = jt(r[l]), f = a.has(l), u = !!d && !f, m = u ? "" : ma(l, r), y = ou[l];
      return /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          id: `reader-download-${l}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !u,
          "aria-label": u ? `下载${c.label}` : m,
          onClick: () => {
            i.current && (i.current.open = !1), s(l);
          },
          children: [
            /* @__PURE__ */ p(y, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ L("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ L("span", { className: "reader-download-action-label", children: [
                au[l],
                " PDF"
              ] }),
              m ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: m }) : null
            ] })
          ]
        },
        l
      );
    }) })
  ] });
}
const iu = "retainpdf:reader:bookmarks:v1:", lu = 200;
function Yn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function aa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${iu}${t}` : "";
}
function cu(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function qt(e, t = Yn()) {
  const n = aa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = cu(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function kn(e, t, n) {
  const r = aa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, lu);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function du(e, t, n = "", { storage: r = Yn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = qt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? kn(e, a.filter((i) => i.page !== s), r) : kn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function uu(e, t, n = Yn()) {
  return kn(e, qt(e, n).filter((r) => r.page !== t), n);
}
function fu(e, t) {
  var r, o, a, s;
  let n = null;
  for (const i of e || []) {
    if (`${(i == null ? void 0 : i.regionType) || ""}` != "heading") continue;
    const l = Number(((r = i.source) == null ? void 0 : r.page) ?? ((o = i.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(l) || l > t) continue;
    const c = `${((a = i.translated) == null ? void 0 : a.text) || i.markdown || ((s = i.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!c) continue;
    const d = Number(i.readingOrder) || 0;
    (!n || l > n.page || l === n.page && d >= n.order) && (n = { page: l, order: d, text: c });
  }
  return n ? n.text.slice(0, 60) : "";
}
function mu({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function hu({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => qt(e)), [i, l] = N(!1), c = A(null);
  if (x(() => {
    s(qt(e)), l(!1);
  }, [e]), x(() => {
    if (!i) return;
    const u = (y) => {
      c.current && !c.current.contains(y.target) && l(!1);
    }, m = (y) => {
      y.key === "Escape" && l(!1);
    };
    return document.addEventListener("pointerdown", u), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", u), document.removeEventListener("keydown", m);
    };
  }, [i]), !e || n <= 0) return null;
  const d = Math.min(Math.max(t, 1), n), f = a.some((u) => u.page === d);
  return /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: c, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${d} 页的书签` : `给第 ${d} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(du(e, d, fu(r, d))),
        children: /* @__PURE__ */ p(mu, { filled: f })
      }
    ),
    a.length ? /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": i,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        onClick: () => l((u) => !u),
        children: [
          /* @__PURE__ */ p(Ca, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((u) => /* @__PURE__ */ L("li", { className: u.page === d ? "is-current" : "", children: [
      /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(u.page, n)), l(!1);
          },
          children: [
            /* @__PURE__ */ L("span", { className: "reader-bookmark-page", children: [
              "第 ",
              u.page,
              " 页"
            ] }),
            u.label ? /* @__PURE__ */ p("span", { className: "reader-bookmark-label", children: u.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${u.page} 页的书签`,
          onClick: () => s(uu(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function pu(e) {
  const [t, n] = N([]);
  return x(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = qe().loadIssues;
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
function gu(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const bu = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, yu = ["failed", "content", "layout"];
function vu(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function wu({ jobId: e, currentPage: t }) {
  var f;
  const n = pu(e), r = (f = $e()) == null ? void 0 : f.jumpToBlock, [o, a] = N(!1), [s, i] = N(-1), l = A(null);
  x(() => i(-1), [n]);
  const c = (u) => {
    const m = n[u];
    !m || !r || (i(u), r(m.readerItemId));
  }, d = A({ issues: n, last: s, currentPage: t, goTo: c });
  return d.current = { issues: n, last: s, currentPage: t, goTo: c }, x(() => {
    const u = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || vu(m.target)) return;
      const { issues: y, last: h, currentPage: v, goTo: w } = d.current, g = gu(y, h, v, m.shiftKey);
      g < 0 || (m.preventDefault(), w(g));
    };
    return document.addEventListener("keydown", u), () => document.removeEventListener("keydown", u);
  }, []), x(() => {
    if (!o) return;
    const u = (m) => {
      var y;
      (y = l.current) != null && y.contains(m.target) || a(!1);
    };
    return document.addEventListener("pointerdown", u, !0), () => document.removeEventListener("pointerdown", u, !0);
  }, [o]), n.length ? /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-issues", ref: l, "aria-label": "待处理", children: [
    /* @__PURE__ */ L(
      oe,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((u) => !u),
        children: [
          /* @__PURE__ */ p(xa, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ L("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      yu.map((u) => {
        const m = n.map((y, h) => ({ issue: y, index: h })).filter(({ issue: y }) => y.kind === u);
        return m.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ L("h4", { children: [
            bu[u],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: y, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
            oe,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                c(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: y.title }),
                /* @__PURE__ */ L("span", { className: "reader-issues-page", children: [
                  "第 ",
                  y.page,
                  " 页"
                ] }),
                y.detail ? /* @__PURE__ */ p("span", { className: "reader-issues-detail", children: y.detail }) : null
              ]
            }
          ) }, `${y.kind}:${y.readerItemId}`)) })
        ] }, u) : null;
      })
    ] }) : null
  ] }) : null;
}
const Su = 48, Iu = 96, Ru = 700;
function Eu(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Su, downSoFar: r };
}
function Pu(e) {
  const [t, n] = N(!1), r = A(0);
  return x(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), l = () => {
      const u = e.current;
      return !!(u && (u.querySelector(":focus-visible") || u.querySelector("[aria-expanded='true']")));
    }, c = (u) => {
      const m = u.target;
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${Le}]`)), !i.get(m))) return;
      const y = m.scrollTop, h = o.get(m);
      if (o.set(m, y), h === void 0 || Date.now() - a > Ru) return;
      const v = Eu(!1, r.current, y - h);
      r.current = v.downSoFar, y - h < -4 ? n(!1) : v.hidden && !l() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - Iu && (r.current = 0, n(!1));
    }, f = () => {
      l() && n(!1);
    };
    document.addEventListener("scroll", c, { capture: !0, passive: !0 }), window.addEventListener("pointermove", d, { passive: !0 }), document.addEventListener("focusin", f);
    for (const u of ["wheel", "touchmove", "keydown"]) window.addEventListener(u, s, { passive: !0, capture: !0 });
    return () => {
      for (const u of ["wheel", "touchmove", "keydown"]) window.removeEventListener(u, s, { capture: !0 });
      document.removeEventListener("scroll", c, { capture: !0 }), window.removeEventListener("pointermove", d), document.removeEventListener("focusin", f);
    };
  }, [e]), t;
}
function Tu(e) {
  const t = $e(), n = Oo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? At, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = Ys(a), f = a > ho + 1e-3, u = a < Kt - 1e-3, m = ct(r, Ye()), y = m >= Kt ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = A(null), v = Pu(h), [w, g] = N(!1), [S, b] = N(`${i}`);
  x(() => {
    w || b(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, w]);
  const I = () => {
    if (g(!1), !c || l <= 0)
      return;
    const E = Number(`${S}`.trim());
    c(Jt(E, l));
  };
  return /* @__PURE__ */ L("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": v ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ L(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (E) => {
          E.preventDefault(), I();
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
              value: S,
              autoFocus: !0,
              onChange: (E) => b(E.target.value.replace(/[^\d]/g, "")),
              onBlur: I,
              onKeyDown: (E) => {
                E.key === "Escape" && (E.preventDefault(), g(!1), b(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ L("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            l || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": l > 0 ? `跳转页码，当前第 ${i} 页，共 ${l} 页` : "页码",
        title: l > 0 ? "点击输入页码跳转" : void 0,
        disabled: !c || l <= 0,
        onClick: () => {
          !c || l <= 0 || (b(`${i}`), g(!0));
        },
        children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      hu,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(wu, { jobId: e.issuesJobId, currentPage: i }) : null,
    /* @__PURE__ */ L("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(Pt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${d}%，点击${y}`,
          title: y,
          onClick: () => s(m),
          children: [
            d,
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
          disabled: !u,
          onClick: () => s(Pt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Qd, {}) })
  ] });
}
function Zr(e) {
  var t, n;
  return yo(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function ku(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Zr(_e(e))
  }));
  x(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Zr(_e(e))
    });
  }, [e]), x(() => {
    t.scope === e && Xt(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = O((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Nn = "download-toast";
function Nu({
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
function Mu(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    hn.dismiss(Nn);
    return;
  }
  hn.custom(
    () => /* @__PURE__ */ p(Nu, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Nn, duration: 1 / 0 }
  );
}
function Au() {
  const e = O((t) => {
    t && (t.setState = Mu, t.hide = () => hn.dismiss(Nn));
  }, []);
  return /* @__PURE__ */ L(nt, { children: [
    /* @__PURE__ */ p(Ea, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function _u(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : po(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Lu(e, t) {
  return t === null || e !== t;
}
function Du(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function Cu(e, t) {
  const n = e === t;
  return { open: n, mounted: Du(n) };
}
const Yr = { itemId: null, origin: null };
function xu() {
  let e = Yr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Yr : { itemId: n, origin: r };
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
const zu = [];
function Ou({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(oe, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(za, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function $u({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    oe,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(Oa, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Fu({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0
}) {
  var b, I;
  const l = ((b = $e()) == null ? void 0 : b.regions) ?? zu, c = ((I = Oo()) == null ? void 0 : I.currentPage) ?? 1, d = q(() => Rc(l), [l]), f = Ec(d, c), u = q(() => kc(l, s), [l, s]), [m, y] = N(-1);
  x(() => y(-1), [s]);
  const h = A(null), v = A(null), w = A(n);
  w.current = n, x(() => {
    const E = ($) => {
      var B, R;
      const D = $.target;
      !D || (B = v.current) != null && B.contains(D) || (R = D.closest) != null && R.call(D, ".reader-finder-toggles, [data-finder-toggle]") || w.current();
    }, k = ($) => {
      $.key === "Escape" && w.current();
    };
    return document.addEventListener("pointerdown", E, !0), document.addEventListener("keydown", k), () => {
      document.removeEventListener("pointerdown", E, !0), document.removeEventListener("keydown", k);
    };
  }, []);
  const g = A(null);
  x(() => {
    var E, k, $;
    e === "search" ? (E = h.current) == null || E.focus() : ($ = (k = g.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null || $.scrollIntoView({ block: "center" });
  }, [e, i]), x(() => {
    var E, k;
    e === "search" && m >= 0 && ((k = (E = g.current) == null ? void 0 : E.querySelector('[aria-current="true"]')) == null || k.scrollIntoView({ block: "nearest" }));
  }, [e, m]);
  const S = (E) => {
    const k = u[E];
    k && (y(E), r(k.itemId));
  };
  return /* @__PURE__ */ L("aside", { ref: v, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(oe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(oe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(oe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(pt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: g, className: "reader-finder-list", children: d.map((E, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
      oe,
      {
        className: "reader-finder-entry",
        "data-level": E.level,
        "aria-current": k === f ? "location" : void 0,
        onClick: () => r(E.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: E.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: E.page })
        ]
      }
    ) }, E.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: l.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ L(nt, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          io,
          {
            ref: h,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (E) => a(E.target.value),
            onKeyDown: (E) => {
              E.key === "Enter" ? (E.preventDefault(), S(Mc(m, u.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: u.length === 0 ? "没有找到" : `${m >= 0 ? `第 ${m + 1} / ` : ""}${u.length >= 200 ? "200+ 处，只列前 200 处" : `${u.length} 处`}${m < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: u.map((E, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(oe, { className: "reader-finder-entry is-hit", "aria-current": k === m ? "true" : void 0, onClick: () => S(k), children: [
        /* @__PURE__ */ L("span", { className: "reader-finder-entry-text", children: [
          E.snippet.slice(0, E.at),
          /* @__PURE__ */ p("mark", { children: E.snippet.slice(E.at, E.at + E.length) }),
          E.snippet.slice(E.at + E.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: E.page })
      ] }) }, E.itemId)) })
    ] })
  ] });
}
function Bu({ active: e, compare: t, ink: n }) {
  const [r, o] = N(!1), [a, s] = N(!1), i = A(null);
  x(() => {
    if (!r && !a) return;
    const c = () => {
      o(!1), s(!1);
    }, d = (u) => {
      var m;
      (m = i.current) != null && m.contains(u.target) || c();
    }, f = (u) => {
      u.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", d, !0), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", d, !0), document.removeEventListener("keydown", f);
    };
  }, [r, a]);
  const l = !!(t.compared || t.loading);
  return /* @__PURE__ */ L("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(Jc, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ L("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        oe,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(Dn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(ld, { active: e }),
      t.available ? /* @__PURE__ */ p(
        oe,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ p($a, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ p(
      oe,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || l ? "true" : void 0,
        onClick: () => {
          o((c) => !c), s(!1);
        },
        children: r ? /* @__PURE__ */ p(pt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Fa, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const ju = [
  { tool: "pen", label: "画笔", Icon: Dn },
  { tool: "highlighter", label: "荧光笔", Icon: Ba },
  { tool: "eraser", label: "橡皮", Icon: ja }
];
function sa(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function ia({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L(nt, { children: [
    ju.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    _o.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(oe, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Ua, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Ha, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ p(pt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Uu({ ink: e, menu: t, onClose: n }) {
  const r = A(null);
  if (x(() => {
    if (!t) return;
    const i = (c) => {
      var d;
      (d = r.current) != null && d.contains(c.target) || n();
    }, l = (c) => {
      c.key === "Escape" && n();
    };
    return document.addEventListener("pointerdown", i, !0), document.addEventListener("keydown", l), () => {
      document.removeEventListener("pointerdown", i, !0), document.removeEventListener("keydown", l);
    };
  }, [t, n]), !t) return null;
  const o = 380, a = Math.max(8, Math.min(t.x, (globalThis.innerWidth || o) - o - 8)), s = Math.max(68, Math.min(t.y, (globalThis.innerHeight || 600) - 60));
  return /* @__PURE__ */ p("div", { ref: r, className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", style: { left: a, top: s }, "data-ink-menu": "true", children: /* @__PURE__ */ p(ia, { ink: e, page: t.page, onPick: n }) });
}
function Hu({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(ia, { ink: e }) }) : null;
}
function Wu(e) {
  var r;
  if (e.shiftKey || sa(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${fo}`))) return null;
  const n = Number((r = t.closest(`[${Le}]`)) == null ? void 0 : r.getAttribute(Le)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Vu(e) {
  const t = A(e);
  t.current = e, x(() => {
    const n = (r) => {
      if (sa(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function fn() {
  try {
    return qe().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Ku(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Ju(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function qu(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Gu({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null), [s, i] = N(null), [l, c] = N(""), [d, f] = N(""), u = A(0);
  x(() => {
    r([]), i(null), f("");
    const v = fn();
    if (!v || !e) return;
    let w = !1;
    return v.list(e).then((g) => {
      w || (r(g.versions), a(g.currentVersionId));
    }).catch(() => {
    }), () => {
      w = !0;
    };
  }, [e, t]);
  const m = O((v) => {
    const w = fn(), g = n.find((b) => b.versionId === v);
    if (!w || !g || !e) return;
    const S = ++u.current;
    c(v), f(""), (async () => {
      const b = qe(), I = await w.resolveJob(e, v);
      if (!I) throw new Error("这一份还没有能读的译文。");
      const E = await b.loadReaderPayload(I, { includeOptionalArtifacts: !0 }), k = b.resolveReaderTranslatedPdfUrl(E.jobPayload, E.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: v, name: g.name, jobId: I, url: k, regions: Ku(to(E.regionsPayload)) };
    })().then((b) => {
      S === u.current && i(b);
    }).catch((b) => {
      S === u.current && f((b == null ? void 0 : b.message) || "这一份打不开。");
    }).finally(() => {
      S === u.current && c("");
    });
  }, [e, n]), y = O(() => {
    u.current += 1, i(null), c(""), f("");
  }, []), h = O(async () => {
    var g, S;
    const v = fn();
    if (!v || !s || !e) return;
    try {
      await v.select(e, s.versionId);
    } catch (b) {
      f((b == null ? void 0 : b.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (g = globalThis.location) == null ? void 0 : g.href;
    w && ((S = globalThis.history) == null || S.replaceState(globalThis.history.state, "", qu(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Ju(n, t, o),
    compared: s,
    loading: l,
    error: d,
    choose: m,
    clear: y,
    adopt: h
  };
}
const Zu = "reader-finder-input";
function Yu(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Xu(e, t = typeof window > "u" ? null : window) {
  x(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Yu(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Zu) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Qu() {
  try {
    return qe().translationEdit ?? null;
  } catch {
    return null;
  }
}
const ef = "这本书正在处理（翻译或排版），处理完才能改。", tf = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function nf({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Qu(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = Xl(s), c = !t || Rt(t), d = oc(n), [f, u] = N(""), [m, y] = N(null), [h, v] = N(() => /* @__PURE__ */ new Map()), [w, g] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [S, b] = N(() => /* @__PURE__ */ new Map()), [I, E] = N({ phase: "idle" }), k = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  x(() => {
    y(null), k.drafts.clear(), k.generation.current = null, b(/* @__PURE__ */ new Map()), E({ phase: "idle" });
  }, [s]), x(() => {
    if (u(""), !i || l || !a) return;
    let _ = !1;
    return a.resolveOwnerJobId(s).then((U) => {
      _ || u(`${U || s}`.trim() || s);
    }).catch(() => {
      _ || u(s);
    }), () => {
      _ = !0;
    };
  }, [i, l, a, s]), x(() => {
    if (v(/* @__PURE__ */ new Map()), !a || !f || !d || !c) return;
    let _ = !1;
    return a.fetchRevisions(f).then((U) => {
      _ || v(ac(U, d));
    }).catch(() => {
    }), () => {
      _ = !0;
    };
  }, [a, f, d, c]);
  const $ = I.phase === "running" && I.seenActive;
  x(() => {
    if (I.phase === "running") {
      if (!c) {
        $ || E({ phase: "running", seenActive: !0 });
        return;
      }
      $ && E(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [I.phase, $, c, t]);
  const D = q(() => {
    const _ = new Map(h);
    if (w.renderedAt === d)
      for (const [U, F] of w.edits) _.set(U, F);
    return _;
  }, [h, w, d]), B = O((_) => {
    const U = `${_ || ""}`.trim();
    U && y({ itemId: U, page: Ql(U) });
  }, []), R = O(() => y(null), []), P = O((_, U) => {
    g((F) => {
      const G = new Map(F.renderedAt === d ? F.edits : []);
      return G.set(_, U), { renderedAt: d, edits: G };
    }), b((F) => new Map(F).set(_, (F.get(_) || 0) + 1));
  }, [d]), T = O(async () => {
    if (!(!a || !s || I.phase === "submitting" || I.phase === "running")) {
      E({ phase: "submitting" });
      try {
        await a.rerender(s), E({ phase: "running", seenActive: !1 }), await o();
      } catch (_) {
        E({ phase: "failed", message: (_ == null ? void 0 : _.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, I.phase, o]), M = l ? tf : !c || I.phase === "running" || I.phase === "submitting" ? ef : "";
  return q(() => ({
    available: i,
    blockedReason: M,
    port: a,
    ownerJobId: f,
    target: m,
    select: B,
    close: R,
    memory: k,
    pendingEdits: D,
    savedCounts: S,
    markSaved: P,
    rerender: I,
    startRerender: T
  }), [i, M, a, f, m, B, R, k, D, S, P, I, T]);
}
function rf(e, t) {
  x(() => {
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
function of({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ L("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
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
const af = ca(() => import("./ReaderMarkdownPanel-CHVk4szQ.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function sf(e) {
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
function lf(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function cf() {
  var Z;
  const e = qi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = ku(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = N(!1), d = A(null), f = A(null), u = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, y = sf({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: l,
    assistantOpen: u
  }), h = Fi({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: y.showSource,
    liveTranslationVisible: l,
    assistantOpen: u
  }), v = y.sourceViewOnly, w = y.visibleMode;
  x(() => {
    c(!1);
  }, [e.viewStateKey]), x(() => {
    e.session.jobTerminal && c(!1);
  }, [e.session.jobTerminal]), x(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const j = _e(e.viewStateKey), H = _u({
          savedMode: j == null ? void 0 : j.mode,
          sourceViewOnly: v,
          viewportWidth: Ye()
        });
        f.current = H.auto ? H.mode : null, H.mode && H.mode !== e.mode && e.setModeKeepingPage(H.mode);
        return;
      }
      Lu(e.mode, f.current) && (f.current = null, Xt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, v]);
  const g = s || (e.mode === "compare" ? "compare" : "reading"), S = Cu(s, "markdown");
  tl({
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
  const b = O(() => {
    i(null);
  }, []), I = O((j) => {
    const H = lf(j, e.liveTranslationAvailable);
    H !== null && c(H), e.setModeKeepingPage(j);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), E = q(() => h.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${l ? " is-active" : ""}`,
      onClick: () => c((j) => !j),
      "aria-pressed": l,
      title: l ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [h.sourcePaneToggle, l]), k = O((j) => {
    i(j);
  }, []), [$] = N(xu), [D, B] = N(null), R = O((j) => B((H) => H === j ? null : j), []), [P, T] = N(""), [M, _] = N("");
  x(() => {
    const j = P.replace(/\s+/gu, " ").trim(), H = window.setTimeout(() => _(j), j ? 150 : 0);
    return () => window.clearTimeout(H);
  }, [P]);
  const [U, F] = N(0), G = O(() => {
    B("search"), F((j) => j + 1);
  }, []);
  Xu(G);
  const ne = O((j) => {
    e.jumpToAnchor({ block_id: j }), (D === "outline" || Ye() < 900) && B(null);
  }, [e.jumpToAnchor, D]), X = O((j) => e.jumpToAnchor({ block_id: j }), [e.jumpToAnchor]), Q = nf({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), fe = Q.select, ce = e.setModeKeepingPage, de = O((j) => {
    w === "source" && ce("compare"), fe(j);
  }, [fe, w, ce]);
  rf(Q.available ? de : null, $);
  const me = ql(e.viewStateKey);
  Vu(me);
  const [K, ee] = N(null), he = O(() => ee(null), []), te = Gu({ documentId: o.documentId, jobId: o.jobId }), ke = ((Z = te.compared) == null ? void 0 : Z.url) || "";
  x(() => {
    ke && w !== "compare" && I("compare");
  }, [ke]), x(() => {
    w !== "compare" && te.clear();
  }, [w]);
  const Fe = q(
    () => {
      const { compared: j, versions: H, readingVersionId: le } = te;
      if (!j) return null;
      const ie = H.find((ve) => ve.versionId === j.versionId), pe = H.find((ve) => ve.versionId === le);
      return {
        url: j.url,
        regions: j.regions,
        left: { name: j.name, createdAt: (ie == null ? void 0 : ie.createdAt) || "" },
        right: { name: (pe == null ? void 0 : pe.name) || "当前译文", createdAt: (pe == null ? void 0 : pe.createdAt) || "" }
      };
    },
    [te.compared, te.versions, te.readingVersionId]
  ), Ie = q(() => {
    if (!Q.savedCounts.size) return e.revisedBlocks;
    const j = new Map(e.revisedBlocks);
    for (const [H, le] of Q.savedCounts) j.set(H, (j.get(H) || 0) + le);
    return j;
  }, [e.revisedBlocks, Q.savedCounts]), Re = q(() => ({
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
    regionHover: $,
    jumpToBlock: X,
    revisedBlocks: Ie,
    editBlock: Q.available ? de : void 0,
    blockEdit: Q,
    editShowsSource: w !== "compare",
    findTerm: D === "search" ? M : "",
    compareVersion: Fe,
    ink: me,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: v,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: k, close: b }
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
    $,
    X,
    Ie,
    Q,
    de,
    w,
    D,
    M,
    Fe,
    me,
    e.sourceOnly,
    v,
    e.download,
    e.goToPage,
    k,
    b
  ]), Ee = q(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), z = [
    Hs,
    `is-workspace-${g}`,
    u ? "is-assistant-open" : "",
    D ? "is-finder-open" : "",
    y.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(gc, { value: Re, hud: Ee, children: /* @__PURE__ */ L(
    "div",
    {
      className: z,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": g,
      "data-ink-mode": me.tool || void 0,
      onContextMenu: (j) => {
        const H = Wu(j);
        H && (j.preventDefault(), ee(H));
      },
      children: [
        /* @__PURE__ */ p(Yd, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(Ou, { open: D, onToggle: R }),
        D ? /* @__PURE__ */ p(
          Fu,
          {
            tab: D,
            onTab: B,
            onClose: () => B(null),
            onJump: ne,
            query: P,
            onQuery: T,
            term: M,
            focusSignal: U
          }
        ) : null,
        /* @__PURE__ */ L("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(su, {}),
          /* @__PURE__ */ p(ll, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          rd,
          {
            mode: w,
            documentReady: !!o.jobId,
            sourceViewOnly: v,
            onModeChange: I,
            liveTranslation: h.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((j) => !j)
            } : null
          }
        ),
        /* @__PURE__ */ p(cd, { active: s }),
        u ? /* @__PURE__ */ p(Gd, {}) : null,
        /* @__PURE__ */ p(Qc, { paneComposition: y, markdownSplit: S.open, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
        e.showHud ? /* @__PURE__ */ p(
          Tu,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p($u, { open: D, onToggle: R })
          }
        ) : null,
        /* @__PURE__ */ p(la, { fallback: null, children: S.mounted ? /* @__PURE__ */ p(af, { open: S.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: b }) : null }),
        /* @__PURE__ */ p(Bu, { active: s, compare: te, ink: me }),
        /* @__PURE__ */ p(Uu, { ink: me, menu: K, onClose: he }),
        /* @__PURE__ */ p(Hu, { ink: me }),
        /* @__PURE__ */ p(of, { edit: Q }),
        /* @__PURE__ */ p(Au, {})
      ]
    }
  ) });
}
function Nf() {
  return /* @__PURE__ */ p(cf, {});
}
export {
  Nf as R,
  cf as a,
  Tf as d,
  Pf as f,
  kf as r,
  $e as u
};
//# sourceMappingURL=ReaderApp-ixTiYnDe.js.map
