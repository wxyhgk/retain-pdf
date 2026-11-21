var Qn = (e) => {
  throw TypeError(e);
};
var er = (e, t, n) => t.has(e) || Qn("Cannot " + n);
var gt = (e, t, n) => (er(e, t, "read from private field"), n ? n.call(e) : t.get(e)), tr = (e, t, n) => t.has(e) ? Qn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), nr = (e, t, n, r) => (er(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as nt } from "react/jsx-runtime";
import { useMemo as q, useState as N, useEffect as x, useCallback as O, useRef as A, useLayoutEffect as Ee, memo as Zt, createContext as Mn, useContext as An, forwardRef as Qr, useImperativeHandle as _n, useSyncExternalStore as eo, useId as to, Suspense as ca, lazy as da } from "react";
import { requireAdapter as ht, getReaderAdapters as Ne } from "./adapters.js";
import { resolveReaderDownloadName as ua, resolveReaderDownloadUrls as fa, READER_PROGRESS_COPY as De, trimString as Ut, READER_DOWNLOAD_ACTIONS as ma, disabledReason as ha } from "./runtime/state.js";
import { r as pa, b as ga } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as mn, isFinishedJobStatus as Rt } from "@retainpdf/domain/job";
import { n as no, d as ba, f as en, k as rr, b as ya, c as va, j as At, p as Ln, g as wa, l as or, i as Sa } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as Ia } from "@retainpdf/api/documents";
import { isReaderTransportError as Ra, createReaderTransportError as Ea } from "./contracts.js";
import { toast as hn, Toaster as Pa } from "sonner";
import { X as pt, PenLine as Dn, Check as ro, Copy as Ta, ChevronUp as ka, ChevronDown as oo, History as Na, LoaderCircle as Ma, Pin as Aa, LogOut as _a, Radio as La, FileText as ao, Columns2 as so, Languages as io, Keyboard as Da, Download as Ca, ListOrdered as xa, TriangleAlert as za, ListTree as Oa, Search as $a, GitCompareArrows as Fa, LayoutGrid as Ba, Highlighter as ja, Eraser as Ua, Undo2 as Ha, Trash2 as Wa } from "lucide-react";
import { Button as re, Textarea as Va, IconButton as ar, Input as lo } from "@retainpdf/ui";
import { pdfjs as co, Page as Ka, Document as Ja } from "react-pdf";
import { e as qa, m as Ga, a as Za } from "./markdown-math-XkF5urpn.js";
const Ya = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Xa = "", Qa = Object.freeze({
  progress: "retainpdf-reader-progress"
}), es = (e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, kf = (...e) => {
  var n;
  return (((n = Ne()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Ce = () => ht("defaultReaderDataPort"), sr = () => ht("defaultReaderPageConfigPort"), Nf = {
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
}, uo = {
  messageTargetOrigin: () => sr().messageTargetOrigin(),
  readerJobId: () => sr().readerJobId()
}, ts = () => {
  var e;
  return ((e = Ne()) == null ? void 0 : e.liveTranslation) ?? null;
}, Et = () => {
  var t;
  const e = Ne();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, qe = () => {
  const e = Ne();
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
}, ns = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, rs = () => {
  var e, t;
  return ((t = (e = Ne()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, os = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, as = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ua(...e);
}, ss = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? fa(...e);
}, is = (...e) => ht("downloadProtectedResource")(...e), ls = (...e) => ht("failDownloadToast")(...e), Mf = (e, t) => ht("resolveMarkdownAssetUrl")(e, t), ir = "/api/v1";
function cs() {
  const e = () => {
    var r;
    return pa(
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
function ds() {
  const e = cs(), t = q(() => os(uo), [e]), n = q(() => rs(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function us(e) {
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
function lr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function fs(e) {
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
function cr(e, t) {
  return es(mn(e, t));
}
function ms(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function hs(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !ms(a, t))
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
        type: Qa.progress,
        stage: n,
        percent: e,
        text: t
      },
      uo.messageTargetOrigin()
    );
  } catch {
  }
}
function Ht(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), pn({ percent: t, text: n, stage: r });
}
function ps(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = N(null), [c, d] = N(null), [f, u] = N(""), [m, y] = N(0), h = f === n ? i : null, v = f === n ? c : null, w = lr(h), g = Rt(w), S = O(() => {
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
      const T = lr(P);
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
function gs(e, t) {
  e(t), gn(t);
}
function bs(e) {
  const [t, n] = N(e ? "source" : "compare"), r = O((a) => {
    e && a !== "source" || (n(a), gn(a));
  }, [e]), o = O((a) => {
    gs(n, a);
  }, []);
  return x(() => (e && document.documentElement.classList.add("reader-source-only"), gn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function dr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function ys(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: dr(n.active_job_id),
    activeVersionId: dr(n.active_version_id)
  };
}
function vs(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function ws(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ss(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Is = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Rs(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Is.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Es = 48 * 1024 * 1024;
function Ps(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ts = 2, Re = /* @__PURE__ */ new Map();
function bn(e, t) {
  Re.delete(e), Re.set(e, t);
}
function ur(e) {
  if (Re.size < Ts) return;
  const t = Re.keys().next().value;
  t && Re.delete(t);
}
async function ks(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function fo(e, t = Et().fetchProtected, n = {}) {
  var d, f, u, m, y, h, v, w, g;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Re.has(r)) {
    const S = Re.get(r);
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
    const b = await ks(s);
    throw b && (S.reason = b), S;
  }
  const i = Ns(r, s, t);
  if (i) {
    o.abort();
    const S = { ranged: i };
    return ur(), Re.set(r, S), S;
  }
  (v = (h = n.signal) == null ? void 0 : h.addEventListener) == null || v.call(h, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (g = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || g.call(w, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return Re.has(r) ? bn(r, c) : (ur(), Re.set(r, c)), c;
}
function Ns(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Es ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const Ms = { file: null, loading: !1, error: "" }, As = { file: null, loading: !0, error: "" };
function _s(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (x(() => {
    if (t || !n) return;
    const s = Re.get(n);
    if (s) {
      bn(n, s);
      return;
    }
    const i = new AbortController();
    return fo(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ms;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Re.get(n);
  return a ? { file: a, loading: !1, error: "" } : As;
}
function Ls(e) {
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
  Ht(s, r, n, "download");
  const i = await fo(t, Et().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Ht(s, o, n, "download"), i);
}
async function Ds(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Ht(o, 25, "正在下载 PDF…", "download");
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
function Cs(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function xs({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Ia,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Cs(o.href, t, a)), !0);
}
const xt = {
  regions: null,
  metadata: null
};
function zs(e) {
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
  } = e, [g, S] = N(""), [b, I] = N(""), [E, k] = N(null), [$, D] = N(null), [B, R] = N(!1), [P, T] = N(""), [M, _] = N([]), [U, F] = N(!1), [G, ee] = N(() => ({
    source: null,
    translated: null
  })), [X, Q] = N(
    xt
  ), [fe, le] = N({
    loading: !0,
    percent: 4,
    text: De.boot,
    stage: "progress",
    failed: !1
  });
  return x(() => {
    const ue = new AbortController(), be = h.current.value, H = Ls({
      sessionEpochRef: h,
      closingRef: v,
      abort: ue,
      sessionEpoch: be
    });
    w.current = ue;
    const te = qe();
    if (v.current)
      return ue.abort(), () => {
        w.current === ue && (w.current = null);
      };
    let me = !1;
    function ie(z, Y) {
      H.markFailed(), F(!0), le({
        loading: !1,
        percent: 100,
        text: z,
        stage: "failed",
        failed: !0
      }), pn({ percent: 100, text: Y, stage: "failed" });
    }
    function ye() {
      R(!0), me || F(!0), le({
        loading: !1,
        percent: 100,
        text: De.ready,
        stage: "ready",
        failed: !1
      }), pn({ percent: 100, text: De.ready, stage: "ready" });
    }
    function Fe() {
      return c != null && c.documentId ? cr(
        c.documentId,
        c.revision
      ) : Ya() ? Xa : te.resolveResourceUrl(mn(r));
    }
    async function Pe() {
      var V;
      let z = { activeJobId: "", activeVersionId: "" };
      try {
        const se = await ((V = te.fetchDocument) == null ? void 0 : V.call(te, r));
        se && (z = ys(se));
      } catch {
      }
      const Y = vs({
        link: z,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (Y.kind === "follow-active-job") {
        if (H.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: Y.jobId
        }), Y.activeVersionId ? (c || d({
          type: "committed-source",
          documentId: r,
          revision: Y.activeVersionId,
          sessionIdentity: l
        }), m("source")) : m("compare");
        return;
      }
      if (Y.kind === "open-committed-source") {
        if (H.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: Y.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const ce = Fe();
      if (H.isInactive()) return;
      S(ce), I(""), T(""), u(l);
      const j = await yn({
        url: ce,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: H,
        setBoot: le
      });
      if (!H.isInactive()) {
        if (!j) {
          ie("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        k(j), ye();
      }
    }
    async function Ie() {
      var J;
      const z = !c, Y = !!(z && te.loadSessionSnapshot && te.loadReaderOptionalArtifacts), ce = Y ? te.loadReaderOptionalArtifacts(t) : null, j = await ((J = te.loadSessionSnapshot) == null ? void 0 : J.call(te, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: z && !Y
      })), V = j ? {
        jobPayload: j.sourcePayload,
        manifestPayload: j.manifestPayload,
        readerMetadata: j.readerMetadata,
        regionsPayload: j.regions,
        readerErrors: j.readerErrors
      } : await te.loadReaderPayload(t, {
        includeOptionalArtifacts: z
      });
      if (H.isInactive()) return;
      let se = null;
      if (n && !r)
        if (j && j.linkedDocument !== void 0)
          se = j.linkedDocument;
        else {
          try {
            se = await te.fetchDocumentByJobId(ir, t);
          } catch {
          }
          if (H.isInactive()) return;
        }
      const ve = fs(V.jobPayload) || `${(se == null ? void 0 : se.document_id) || ""}`.trim();
      ve && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: ve
      });
      const pe = ws({
        payloadDocumentId: ve,
        linkedActiveJobId: `${(se == null ? void 0 : se.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(se == null ? void 0 : se.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (pe.kind === "restore-committed-source") {
        if (H.isInactive()) return;
        d({
          type: "committed-source",
          documentId: pe.documentId,
          revision: pe.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const Se = te.resolveReaderSourcePdf(V.manifestPayload), at = te.resolveReaderTranslatedPdfUrl(V.jobPayload, V.manifestPayload), Qt = typeof Se == "string" ? Se : te.resolveReaderArtifactUrl(Se), Be = r || ve, je = c != null && c.documentId ? cr(
        c.documentId,
        c.revision
      ) : Qt || (Be ? te.resolveResourceUrl(mn(Be)) : ""), Ge = c ? "" : at || "";
      S(je || ""), I(Ge), T(hs(V.jobPayload, t)), f({
        jobPayload: V.jobPayload || null,
        manifestPayload: V.manifestPayload || null,
        sessionIdentity: l
      });
      const Lt = () => Ds({
        sourceFinal: je || "",
        translatedFinal: Ge,
        fence: H,
        setBoot: le
      }), Dt = !!(je || Ge), st = ce && Dt ? Lt() : null;
      st == null || st.catch(() => {
      });
      const Ct = (K) => {
        H.isInactive() || (_(c ? [] : no(K.regionsPayload)), ee(c ? { source: null, translated: null } : ba(K.readerMetadata)), Q(c ? xt : K.readerErrors ?? xt), F(!0));
      };
      if (ce ? (me = !0, ce.then(Ct)) : Ct(V), !Dt) {
        ie(De.failed, De.failed);
        return;
      }
      const C = await (st ?? Lt());
      if (C.status !== "inactive") {
        if (C.status === "incomplete") {
          ie("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        k(C.sourceBytes), D(C.translatedBytes), ye();
      }
    }
    async function Te() {
      R(!1), k(null), D(null), _([]), F(!1), ee({ source: null, translated: null }), Q(xt), Ht(le, 8, De.metadata, "metadata");
      try {
        if (s) {
          await Pe();
          return;
        }
        if (!t) {
          ie(De.failed, De.failed);
          return;
        }
        await Ie();
      } catch (z) {
        if (H.isClosedOrStale() || (z == null ? void 0 : z.name) === "AbortError") return;
        H.markFailed();
        const Y = Number(z == null ? void 0 : z.status), ce = `${(z == null ? void 0 : z.reason) || ""}`, j = Rs({ status: Y, reason: ce, sessionJobId: t });
        if (j && (await xs({
          apiPrefix: ir,
          documentId: j,
          expiredJobId: t
        }) || H.isClosedOrStale()))
          return;
        if (Ss({
          status: Y,
          reason: ce,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const V = z instanceof Error ? z.message : De.failed;
        ie(V, V);
      }
    }
    return Te(), () => {
      ue.abort(), w.current === ue && (w.current = null);
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
function Os() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = ds(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), l = A(""), c = A(""), d = A(() => {
  }), f = O(() => d.current(), []), u = us({
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
  } = u, { mode: w, setMode: g, switchSessionMode: S } = bs(v);
  d.current = () => {
    S("source");
  }, i.current = a, l.current = y, c.current = m;
  const b = ps({
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
  } = b, P = zs({
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
const $s = 160, Fs = 8, Bs = 0;
function js() {
  const e = A(null), [t, n] = N(null), [r, o] = N(Bs), a = O((s) => {
    e.current = s, n(s);
  }, []);
  return x(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < $s || o((d) => Math.abs(d - c) < Fs ? d : c);
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
function Us(e) {
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
function Hs(e, t) {
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
  })), [m, y] = N(() => ({ identity: c, tick: 0 })), h = f.identity === c ? f.pages : tn, v = m.identity === c ? m.tick : 0, w = Us({
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
const Le = "data-reader-page", Ke = "data-reader-pane", Cn = "data-natural-height", Ws = "reader-react-root", Vs = "reader-react-grid", mo = "reader-react-scroll-shell", Ks = "reader-react-pdf-pane", ho = "reader-react-pdf-page", Wt = "reader-react-pdf-page-placeholder", xn = "reader-react-pdf-page-slot";
function Vt(e, t) {
  const n = e != null ? `[${Le}="${e}"]` : `[${Le}]`;
  return t ? `${n}[${Ke}="${t}"]` : n;
}
function Js() {
  return `.${xn}[${Le}]`;
}
function Kt(e) {
  return Number(e.getAttribute(Le));
}
const po = 0.25, Jt = 1, qs = 0.05, _t = 0.5, Gs = 16, Zs = 8, Ys = 720;
function Ye() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function go(e) {
  return Number.isFinite(e) && e < Ys;
}
function ct(e, t = Number.POSITIVE_INFINITY) {
  return go(t) && (e === "source" || e === "translated") ? Jt : _t;
}
function Yt(e) {
  return Number.isFinite(e) ? Math.min(Jt, Math.max(po, e)) : _t;
}
function Pt(e, t) {
  const n = Yt(Number(e) + t * qs);
  return Math.round(n * 100) / 100;
}
function Xs(e) {
  return Math.round(Yt(e) * 100);
}
function Qs(e) {
  const n = (Number(e) || 0) - Gs - Zs;
  return Math.max(160, Math.floor(n));
}
function ei(e, t = _t) {
  const n = Yt(t);
  return Qs((Number(e) || 0) * n);
}
function ti(e, t) {
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
const ni = 8;
function ri(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < ni ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const bo = 200, yo = [
  "markdown"
], oi = yo;
function vo(e) {
  return oi.includes(e);
}
const ai = "retainpdf:reader:view:v1:", fr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), si = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function wo() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function vn(e) {
  return `${e || ""}`.trim();
}
function ii({
  documentId: e,
  jobId: t
}) {
  const n = vn(e);
  if (n) return `document:${n}`;
  const r = vn(t);
  return r ? `job:${r}` : "";
}
function So(e) {
  const t = vn(e);
  return t ? `${ai}${t}` : "";
}
function li(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ci(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!fr.has(t) || !fr.has(n) || t === n))
    return { left: t, right: n };
}
function di(e) {
  return e === null ? null : vo(e) ? e : void 0;
}
function ui(e) {
  return si.has(e) ? e : void 0;
}
function Io(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = li(t.anchor), r = Number(t.zoom), o = ui(t.mode), a = ci(t.splitLayout), s = di(t.assistantPanel);
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
function _e(e, t = wo()) {
  const n = So(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Io(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Xt(e, t, n = wo()) {
  const r = So(e);
  if (!r || !n) return null;
  const o = _e(e, n), a = Io({
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
function fi(e, t, n = "") {
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
  return Ee(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, ti(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: d, resetZoom: f };
}
function mi(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: O((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const zn = 48;
function Ro(e, t = zn) {
  return e.getBoundingClientRect().top + t;
}
function Eo(e, t) {
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
  const o = Kt(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Bt(e, t, n = zn) {
  if (!e)
    return null;
  const r = Vt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Ro(e, n), i = Eo(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Tt(e, t, n = "auto", r, o = zn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(Vt(a, r))), i || (i = e.querySelector(Vt(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const d = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), u = Math.max(0, f + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - u) >= 1 && (e.scrollTop = u) : e.scrollTo({ top: u, behavior: n }), !0;
}
function hi(e, t, n = "smooth", r) {
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
function pi(e, t, n) {
  return wn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function qt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function ke(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function gi(e, t, n = !0, r = "", o) {
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
    const f = Vt(void 0, o), u = () => {
      if (l) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const v = Ro(i), w = Eo(h, v);
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
const bi = `canvas, .react-pdf__Page, .${ho}, .${Wt}`, mr = /* @__PURE__ */ new WeakMap();
function yi(e) {
  const t = Number(e.getAttribute(Cn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = mr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(bi), mr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function vi(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function wi(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Js()).forEach((r) => {
    const o = Kt(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = yi(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Si(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Ee(() => {
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
      const b = wi(S);
      vi(s.current, b) || (s.current = b, a(b)), d && !f && (f = !0, (I = i.current) == null || I.call(i));
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
const Ii = [0, 48, 140, 320, 560], Ri = 700, Ei = [80, 200, 400], Pi = 500, Ti = 50, ki = /* @__PURE__ */ new Set([
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
]), Ni = 180, hr = [0, 48, 140, 320, 700, 1200];
function Mi(e, t) {
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
        anchor: ke(i.current)
      });
    };
    T ? M() : y.current = setTimeout(M, Ni);
  }, []), I = O((T) => {
    i.current = ke(T), l.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, c.current = !1;
    }, Ti);
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
        const ee = Bt(M, w.current);
        ee && (i.current = ee, b());
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
      _.metaKey || _.ctrlKey || _.altKey || ki.has(_.key) && S();
    };
    return T.addEventListener("wheel", S, { passive: !0 }), T.addEventListener("touchmove", S, { passive: !0 }), window.addEventListener("keydown", M), () => {
      T.removeEventListener("wheel", S), T.removeEventListener("touchmove", S), window.removeEventListener("keydown", M);
    };
  }, [o, e, S]), Ee(() => {
    var M;
    if (h.current === a) return;
    b(!0), g(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, v.current = "";
    const T = (M = _e(a)) == null ? void 0 : M.anchor;
    i.current = T ? ke(T) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, d.current = r;
  }, [a, r, b, g]), x(() => {
    var M;
    if (!o || !s || !a || v.current === a) return;
    v.current = a;
    const T = ke(
      ((M = _e(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = T, l.current = T, c.current = !0, g(), f.current = wn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: hr,
        onDone: () => I(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(T);
    }, Math.max(...hr) + 160), () => g();
  }, [o, s, a, e, I, g]), x(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      c.current = !1, l.current = null, g();
      return;
    }
    const T = l.current ? ke(l.current) : ke(i.current);
    return c.current = !0, l.current = T, i.current = T, g(), f.current = wn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ii,
        onDone: () => I(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(T);
    }, Ri), () => {
      g();
    };
  }, [r, o, n, e, I, g]), x(() => () => {
    g(), m.current != null && (clearTimeout(m.current), m.current = null), b(!0);
  }, [g, b]);
  const E = O(() => {
    const T = Bt(
      e.current,
      w.current
    );
    return ke(T || i.current);
  }, [e]), k = O(() => {
    c.current = !0;
    const T = Bt(
      e.current,
      w.current
    ), M = ke(T ?? i.current);
    return i.current = M, l.current = M, b(), M;
  }, [e, b]), $ = O((T, M, _) => {
    const U = _ || w.current, F = qt(T, M || 1), G = { page: F, fraction: 0 };
    i.current = G, c.current = !0, l.current = G, b(), g(), hi(e.current, F, "smooth", U), f.current = pi(
      () => e.current,
      F,
      {
        behavior: "auto",
        pane: U,
        delaysMs: Ei,
        onDone: () => I(G)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(G);
    }, Pi);
  }, [e, I, g, b]), D = O(() => ke(i.current), []), B = O(() => c.current, []), R = O(() => {
    if (!c.current || !l.current)
      return;
    const T = ke(l.current);
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
function Ai(e, t) {
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
function Po(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const _i = [0, 80, 200, 400, 800], Li = 120, Di = 400;
function Ci(e, t, n) {
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
    const h = ns(), v = Ai(h, u.current);
    if (v == null && (h != null && h.blockId) && !d) return;
    const w = Po(h, v, { jobId: l, documentId: c });
    if (t.current === w)
      return;
    if (v == null) {
      t.current = w, (b = y.current) == null || b.call(y);
      return;
    }
    t.current = w, h && ((I = m.current) == null || I.call(m, h, v));
    const g = [];
    let S = 0;
    for (const E of _i)
      S = Math.max(S, E), g.push(
        setTimeout(() => {
          f.current(v);
        }, E)
      );
    return g.push(
      setTimeout(() => {
        var E;
        (E = y.current) == null || E.call(y);
      }, S + Li)
    ), () => {
      for (const E of g) clearTimeout(E);
    };
  }, [r, o, l, c, t, d]);
}
function xi(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function zi(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Di,
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
      const y = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = ga(y, o, d.current);
      if (u.current = o, h === null) return;
      const v = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Po(
        { blockId: v },
        o,
        { jobId: i, documentId: l }
      ), (f.current || xi)(h);
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
function Oi(e) {
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
  Ci(a, t, o), zi(e, t, n);
}
const bt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function $i(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function pr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function To(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = pr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = pr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Fi(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = To(r, t, n);
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
function Bi(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const gr = [250, 500, 1e3, 2e3, 4e3], nn = [80, 160, 320, 640, 1e3, 1500], br = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
  return Ra(e) ? `${e.code || ""}`.trim() : "";
}
function zt(e, t) {
  const n = On(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ji(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (To(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = Ea(
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
function Ui({
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
    const f = r === void 0 ? ts() : r, u = i.current === l;
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
            layoutByPage: $i(b),
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
              error: zt(b, "实时译文暂不可用")
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
            error: zt(b, "正在等待 OCR 版面数据")
          })), await Sn(gr[Math.min(S, gr.length - 1)], m.signal).catch(() => {
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
                I = await ji(
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
                  error: zt(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              v((E) => {
                const k = Fi(E, b, I);
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
            error: zt(b, "实时译文连接已中断，正在重连")
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
        await Sn(br[Math.min(S, br.length - 1)], m.signal).catch(() => {
        }), S += 1;
      }
    })(), () => m.abort();
  }, [n, r, l, d]), o;
}
function Hi(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function Wi(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return x(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = qe().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Hi(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Vi = 4500;
function Ki(e) {
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
const Ji = /* @__PURE__ */ new Set(["book", "translate"]);
function ko(e) {
  return !!(e.jobId && e.sourceUrl && Ji.has(e.workflow));
}
function qi(e) {
  return !!(ko(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Gi() {
  const e = Os(), t = ko({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = qi({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Rt(o) && (r.current.running = !0);
  const a = Ui({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = js(), d = Wi(e.jobId, !e.sourceOnly), f = ii({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: y } = fi(e.mode, s, f), h = Hs(
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
  } = Mi(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  x(() => {
    g();
  }, [l, g]);
  const S = Si(
    s,
    h.compareMode,
    h.rowSyncRevision,
    g
  ), b = gi(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), I = O((F, G) => {
    var X, Q;
    const ee = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((X = h.numPagesByPane) == null ? void 0 : X.source) || 0,
      Number((Q = h.numPagesByPane) == null ? void 0 : Q.translated) || 0
    );
    w(F, ee, G);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [E, k] = N(null), $ = A(null), D = O((F) => {
    $.current && clearTimeout($.current), k(F), F && ($.current = setTimeout(() => k(null), Vi));
  }, []);
  x(() => () => {
    $.current && clearTimeout($.current);
  }, []);
  const B = O((F) => {
    const G = en(e.regions, F);
    return G ? rr(G, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), R = O((F, G) => {
    const ee = G || h.primaryPane, X = typeof F == "object" && F ? `${F.block_id || ""}`.trim() : "", Q = typeof F == "object" && F ? `${F.image_url || ""}`.trim() : "", fe = typeof F == "object" && F ? F.page_idx != null ? Number(F.page_idx) + 1 : F.page != null ? Number(F.page) : null : typeof F == "number" ? F + 1 : null, le = ya(e.regions, Q, fe) || en(e.regions, X) || (typeof F == "object" ? va(e.regions, F) : null);
    let ue = le ? rr(le, ee).page : null;
    ue == null && (ue = Ki(F)), !(ue == null || ue < 1) && (D(le), I(ue, ee));
  }, [D, I, h.primaryPane, e.regions]);
  Oi({
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
  const { setModeKeepingPage: P } = mi({
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
const Zi = [
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
], Yi = [
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
function Xi(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Zi)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Qi(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const el = ".reader-notes-panel";
function tl(e) {
  return e instanceof Element ? !!e.closest(el) : !1;
}
function nl(e) {
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
      if (f.defaultPrevented || f.metaKey || f.ctrlKey || f.altKey || Qi(f.target) || tl(f.target))
        return;
      const u = f.key, m = Xi(u);
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
              l(qt(s + 1, i));
              return;
            case "prev-page":
              l(qt(s - 1, i));
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
const rl = "retainpdf:soft-reader-close";
function ol() {
  return new URL("./index.html", window.location.href).href;
}
function al() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: rl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function sl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function il() {
  if (!(typeof window > "u") && !al()) {
    if (sl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(ol());
  }
}
function ll({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function cl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L(ll, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), il();
  }, children: [
    /* @__PURE__ */ p(pt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let yr = !1;
function dl() {
  if (yr)
    return;
  const e = Et().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (co.GlobalWorkerOptions.workerSrc = e, yr = !0);
}
function de(e) {
  return typeof e == "string" ? e : "";
}
function ul(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function fl(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function ml(e) {
  return {
    source: de(e == null ? void 0 : e.source_text) || de(e == null ? void 0 : e.unit_source_text),
    translated: de(e == null ? void 0 : e.protected_translated_text) || de(e == null ? void 0 : e.translated_text)
  };
}
const hl = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function No(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function pl(e) {
  const t = No(e).sort((r, o) => de(r.ts).localeCompare(de(o.ts)));
  return t.length ? [
    { text: de(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: de(r.new_text),
      label: hl[de(r.source)] || de(r.source) || "修订",
      ts: de(r.ts),
      reason: de(r.reason)
    }))
  ].reverse() : [];
}
function gl(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function bl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return de(r.finished_at) || de(n.finished_at) || "";
}
function yl(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = No(e).sort((a, s) => de(a.ts).localeCompare(de(s.ts)));
  for (const a of o) {
    const s = new Date(de(a.ts)).getTime(), i = de(a.reader_item_id) || de(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, de(a.new_text));
  }
  return n;
}
const vl = {
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
function wl(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = vl[de(n.kind)] || de(n.kind) || "问题", o = de(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Sl = /* @__PURE__ */ new Set(["text", "formula"]);
function $n(e) {
  return Sl.has(e);
}
function Il(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || $n(At(n));
}
function Rl(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !$n(At(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const El = 300, Pl = 72;
function Tl(e, t) {
  if (e.width >= El && e.height >= Pl)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const kl = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Nl(e, t, n) {
  return e.flatMap((r) => {
    if (!kl.has(At(r.region))) return [];
    const o = Ln(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function vr(e, t, n) {
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
async function Ml(e) {
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
const Al = "reader-text-hover-copy", _l = "reader-text-hover-edit", Ll = "reader-text-hover-id";
function Dl(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Mo = "reader-text-hover-tools";
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
const Cl = 26, xl = 220;
function zl(e, t = xl) {
  return e.height < Cl * 2 || e.width < t;
}
function Ol({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? ro : e === "failed" ? pt : Ta, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function $l({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a,
  tailTop: s = 0
}) {
  const [i, l] = N("idle"), [c, d] = N("idle"), [f] = N(() => Dl()), u = A([]), m = (e == null ? void 0 : e.itemId) || "";
  if (x(() => {
    l("idle"), d("idle");
    const b = u.current;
    return () => {
      b.forEach((I) => window.clearTimeout(I)), u.current = [];
    };
  }, [m]), !e) return null;
  const y = wa(e.highlight.region, t), h = At(e.highlight.region), v = (b, I) => async (E) => {
    E.preventDefault(), E.stopPropagation();
    const k = await Ml(b);
    I(k ? "copied" : "failed"), u.current.push(window.setTimeout(() => I("idle"), 1200));
  }, w = h === "formula" ? "复制 LaTeX" : "复制", g = o || e.rect, S = a || (zl(g) ? "outside" : "inside");
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
          className: Mo,
          "data-placement": S,
          style: S === "tail" ? { top: s } : void 0,
          children: [
            f ? /* @__PURE__ */ p(
              rn,
              {
                className: Ll,
                state: c,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: v(e.itemId, d),
                children: c === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && $n(h) ? /* @__PURE__ */ p(
              rn,
              {
                className: _l,
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
                className: Al,
                state: i,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: i === "copied" ? "已复制" : i === "failed" ? "复制失败" : w,
                onClick: v(y, l),
                children: /* @__PURE__ */ p(Ol, { state: i })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Fl(e, t) {
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
function Bl(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = Ln(
      Fl(e, a),
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
const jl = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Ul = 256, yt = /* @__PURE__ */ new Map();
function Hl(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Ao(e) {
  const t = `${e || ""}`, { text: n, slots: r } = qa(t, { bareLatex: !0 }), o = Hl(n), a = Ga(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = yt.get(t);
  if (!s && (s = Za(o, r), yt.set(t, s), yt.size > Ul)) {
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
function Wl(e, t) {
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
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || jl,
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
function Vl(e, t, n, r) {
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
const Kl = 512, vt = /* @__PURE__ */ new Map();
let In = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  In += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  In += 1;
}));
function Jl(e, t, n, r) {
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
function _o({ item: e, pageScale: t }) {
  const n = A(null), r = q(
    () => Ao(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = q(
    () => Wl(e, t),
    [e, t]
  );
  x(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((u) => {
      f && a(u);
    }), () => {
      f = !1;
    };
  }, [r]), Ee(() => {
    const f = n.current;
    if (!f) return;
    const [u, m, y, h] = s.padding, v = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - u - y), g = Jl(o, v, w, s);
    let S = vt.get(g);
    if (S === void 0 && (S = Vl(
      (b) => (f.style.fontSize = `${b}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      v,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), vt.set(g, S), vt.size > Kl)) {
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
function ql({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = q(
    () => Bl(e, t, n, r),
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
        _o,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Gl = Zt(ql);
function Zl({
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
        _o,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: At(a.highlight.region),
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
const Yl = Zt(Zl), Lo = 24, Ue = Lo * 2 + 4, ze = 24, Xl = 4, Ql = 6, Xe = (e) => e.left + e.width, Je = (e) => e.top + e.height;
function wt(e, t) {
  const n = Math.min(Xe(e), Xe(t)) - Math.max(e.left, t.left), r = Math.min(Je(e), Je(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const wr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= Xe(t) && r >= t.top && r <= Je(t);
}, ec = (e) => e.height > 40 && e.height > e.width * 2.5;
function tc(e, t, n) {
  if (!t.length || e.height < ze || e.width < n + 8) return null;
  const r = Math.max(...t.map(Je)), o = Xe(e) - 4 - n;
  for (const a of [r, Je(e) - 2]) {
    const s = Math.max(e.top, a - ze), i = { left: o, top: s, width: n, height: ze };
    if (!t.some((l) => wt(i, l) > 0)) return s - e.top;
  }
  return null;
}
function nc(e, t) {
  const n = [], r = (a) => {
    const s = Lo + Xl, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: Xe(e), top: i, width: s, height: Ue } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Ue } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - ze - 3, width: Ue, height: ze + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: Je(e), width: Ue, height: ze + 3 } }), r(!0);
  const o = tc(e, t, Ue);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: Xe(e) - 4 - Ue, top: e.top + o, width: Ue, height: ze } }), n;
}
function rc(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((g) => g.width > 0 && g.height > 0 && !ec(g)), i = s.filter((g) => wr(g, t)), l = s.filter((g) => !wr(g, t)), c = n.filter((g) => g !== t && wt(g, t) < t.width * t.height * 0.5), d = nc(t, i).filter(({ box: g, overhang: S }) => {
    const b = S ? Ql : 0;
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
function oc(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - ze - 3 : Je(r);
  return t >= r.left - 4 && t <= r.left + Ue + 4 && n >= a && n <= a + ze + 3;
}
const an = (e) => e.left + e.width, sn = (e) => e.top + e.height;
function ac(e, t, n = 3, r = 6) {
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
function sc(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function ic(e, t, n, r) {
  const [o, a] = N(null);
  return Ee(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? sc(s) : [], l = i.length ? ac(t.rect, i) : t.rect, c = n.filter((f) => f.itemId !== t.itemId).map((f) => f.rect), d = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...rc({ frame: l, others: c, pageWidth: r, pageHeight: d, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const Do = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Sr = { pen: 35e-4, highlighter: 0.018 }, Ir = 0.015, Rn = "retainpdf.reader.ink.v1:";
function Rr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Rn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function lc(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Rn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Rn + e);
    } catch {
    }
}
function cc(e, t, n, r, o, a) {
  const s = Ir * Ir;
  return e.filter((i) => Co(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Co(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function dc(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function uc(e) {
  const [t, n] = N(null), [r, o] = N(Do[0].key), [a, s] = N(() => Rr(e)), i = A(a), l = A([]);
  x(() => {
    const h = Rr(e);
    i.current = h, s(h), l.current = [];
  }, [e]);
  const c = O((h) => {
    i.current = h, s(h), lc(e, h);
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
const fc = "reader-ink-layer";
function mc(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Er({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: mc(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function hc({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = A(!1), l = o.strokes.filter((h) => Co(h, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const d = (h) => {
    const v = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - v.left) / Math.max(1, v.width))),
      Math.min(1, Math.max(0, (h.clientY - v.top) / Math.max(1, v.height)))
    ];
  }, f = (h, v) => o.erase(cc(o.strokes, e, t, h, v, r / Math.max(1, n))), u = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [v, w] = d(h);
    o.tool === "eraser" ? f(v, w) : s([[v, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [v, w] = d(h);
    o.tool === "eraser" ? f(v, w) : s((g) => g ? dc(g, v, w) : [[v, w]]);
  }, y = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Sr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: fc,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: u,
      onPointerMove: m,
      onPointerUp: y,
      onPointerCancel: y,
      children: [
        l.map((h) => /* @__PURE__ */ p(Er, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Er, { stroke: { tool: o.tool, color: o.color, width: Sr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function pc({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, l] = N(!1), [c, d] = N([]), [f, u] = N(""), [m, y] = N(""), [h, v] = N(!1), [w, g] = N(null), [S, b] = N([]), I = r.drafts, E = r.generation, k = O(async (R, P) => {
    if (e)
      try {
        d(pl(await e.fetchRevisions(R, P)));
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
      const M = `${(P == null ? void 0 : P.item_id) || n}`, { source: _, translated: U } = ml(T);
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
      return (_ == null ? void 0 : _.reason) === "generation_mismatch" && (E.current = null), g({ tone: "error", message: (_ == null ? void 0 : _.message) || "保存失败，请稍后再试。" }), b(wl(_ == null ? void 0 : _.issues)), !1;
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
const xo = "reader-inline-edit";
function gc({ text: e }) {
  const [t, n] = N("");
  return x(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Ao(e);
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
function bc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var B;
  const s = e.itemId, i = pc({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = N(!1), [d, f] = N(!1), u = A(null), m = Tl(e.rect, t), y = q(() => Rl(o), [o]), h = y.indexOf(s), { loaded: v } = i, w = i.saving || i.loading, g = n.blockedReason, S = !v || i.draft === v.current, { close: b, select: I } = n, E = O((R) => {
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
  }, [E]), Ee(() => {
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
        className: `${xo} is-${m.mode}`,
        style: D,
        role: "group",
        "aria-label": `改第 ${((B = n.target) == null ? void 0 : B.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (R) => R.stopPropagation(),
        children: [
          r && (v != null && v.source) ? /* @__PURE__ */ p(
            re,
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
            Va,
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
          v ? /* @__PURE__ */ p(gc, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ar, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => E(-1), children: /* @__PURE__ */ p(ka, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ar, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= y.length - 1, onClick: () => E(1), children: /* @__PURE__ */ p(oo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              lo,
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
              re,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": d,
                "data-block-edit-action": "history",
                onClick: () => f((R) => !R),
                children: [
                  /* @__PURE__ */ p(Na, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(re, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: k, children: "取消" }),
            /* @__PURE__ */ p(
              re,
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
            const T = R.text === v.current, M = [gl(R.ts), R.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": R.label, "data-current": T ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  M,
                  T ? "（现在用的）" : "",
                  R.reason ? ` · ${R.reason}` : ""
                ] }),
                T ? null : /* @__PURE__ */ p(
                  re,
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
const zo = Mn(null), Oo = Mn(null);
function yc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(zo.Provider, { value: e, children: /* @__PURE__ */ p(Oo.Provider, { value: t, children: n }) });
}
function $e() {
  return An(zo);
}
function $o() {
  return An(Oo);
}
const We = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), vc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, wc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Sc = {
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
}, Pr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Ic(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Pr(o ?? a ?? "", vc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Pr(o ?? a ?? "", wc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Sc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Rc(e) {
  return We(e.translatedBlockText) || We(e.translated.text) || We(e.source.text);
}
const Ec = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Pc(e) {
  const t = [];
  for (const n of e) {
    if (!Ec(n)) continue;
    const r = Ic(Rc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Tc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const kc = 24, Nc = 60;
function Tr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - kc), o = Math.min(e.length, n + t.length + Nc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Mc(e, t, n = 200) {
  const r = We(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = We(a.translatedBlockText) || We(a.translated.text), l = i ? Tr(i, r) : null, c = l ?? Tr(We(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function Ot(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Ac(e, t) {
  const n = We(t).toLowerCase();
  if (!n || !e) return Ot(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Ot(e.slice(a, s))}<mark class="reader-find-mark">${Ot(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Ot(e.slice(a));
}
function _c(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Fo = 1.414;
function Lc({
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
  var Ie, Te;
  const g = $e(), S = g == null ? void 0 : g.revisedBlocks, b = g == null ? void 0 : g.blockEdit, I = b == null ? void 0 : b.pendingEdits, E = g == null ? void 0 : g.editBlock, k = (g == null ? void 0 : g.findTerm) || "", $ = q(
    () => k ? ({ str: z }) => Ac(z, k) : void 0,
    [k]
  ), D = A(l ?? Fo), [B, R] = N(D.current);
  x(() => {
    l != null && Math.abs(l - D.current) >= 1e-3 && (D.current = l, R(l));
  }, [l]);
  const P = A(d);
  P.current = d;
  const T = A(null), M = A((z) => {
    var Y;
    T.current = z, (Y = P.current) == null || Y.call(P, z);
  }).current, _ = A(null), U = A(`${t}@${n}`);
  Ee(() => {
    const z = `${t}@${n}`;
    U.current !== z && (U.current = z, o && Cc(T.current, _.current));
  }, [o, n, t]), x(() => {
    o || ln(_.current);
  }, [o]), x(() => () => ln(_.current), []);
  const F = Math.max(120, Math.floor(t * B)), G = Math.max(F, Math.ceil(s || 0)), ee = Ln(f, t, F), X = q(
    () => Nl(u, t, F),
    [F, u, t]
  ), [Q, fe] = N(null), le = typeof y == "function", ue = le ? m ?? null : Q, be = (z) => {
    le ? z !== (m ?? null) && (y == null || y(z)) : fe((Y) => Y === z ? Y : z);
  }, H = q(
    () => X.find((z) => z.itemId === ue) || null,
    [ue, X]
  ), te = r === "translated" && ((Ie = b == null ? void 0 : b.target) == null ? void 0 : Ie.itemId) || "", me = q(
    () => te && X.find((z) => z.itemId === te) || null,
    [te, X]
  ), ie = ic(T, o ? H : null, X, t), ye = (z) => {
    var se, ve, pe, Se, at;
    if (z.pointerType === "touch") return;
    if ((se = g == null ? void 0 : g.ink) != null && se.tool) {
      be(null);
      return;
    }
    if (z.buttons !== 0) {
      be(null);
      return;
    }
    if ((pe = (ve = z.target) == null ? void 0 : ve.closest) != null && pe.call(ve, `.${Mo}`) || (at = (Se = z.target) == null ? void 0 : Se.closest) != null && at.call(Se, `.${xo}`)) return;
    const Y = z.currentTarget.getBoundingClientRect(), ce = z.clientX - Y.left, j = z.clientY - Y.top;
    if (oc(ie, ce, j)) return;
    const V = vr(X, ce, j);
    be((V == null ? void 0 : V.itemId) || null);
  }, Fe = (z) => {
    if (z.pointerType === "mouse") return;
    const Y = z.currentTarget.getBoundingClientRect(), ce = vr(
      X,
      z.clientX - Y.left,
      z.clientY - Y.top
    );
    be((ce == null ? void 0 : ce.itemId) || null);
  }, Pe = (z) => {
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
      onPointerMoveCapture: ye,
      onPointerDown: Fe,
      onPointerLeave: (z) => {
        z.pointerType === "mouse" && be(null);
      },
      style: {
        width: t,
        height: G,
        minHeight: G
      },
      children: [
        o ? /* @__PURE__ */ p(
          Ka,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: $,
            renderAnnotationLayer: !1,
            className: ho,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Wt,
                style: { width: t, height: F }
              }
            ),
            onLoadSuccess: (z) => {
              try {
                const Y = z.getViewport({ scale: 1 });
                if (Y.width > 0) {
                  const ce = Y.height / Y.width;
                  Pe(ce);
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
            className: Wt,
            style: { width: t, height: F },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: _, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        ee ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: ee,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Gl,
          {
            layoutPage: h,
            pageState: v,
            width: t,
            height: F
          }
        ) : null,
        o && r === "translated" && (I != null && I.size) ? /* @__PURE__ */ p(Yl, { targets: X, edits: I, width: t, excludeId: me == null ? void 0 : me.itemId }) : null,
        o && me && b ? /* @__PURE__ */ p(
          bc,
          {
            target: me,
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
          hc,
          {
            page: e,
            pane: r === "translated" ? "translated" : g.compareVersion ? "compare" : "source",
            width: t,
            height: F,
            ink: g.ink
          }
        ) : null,
        /* @__PURE__ */ p(
          $l,
          {
            target: o && !((Te = g == null ? void 0 : g.ink) != null && Te.tool) && (H == null ? void 0 : H.itemId) !== (me == null ? void 0 : me.itemId) ? H : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: H && (S == null ? void 0 : S.get(H.itemId)) || 0,
            onEdit: E,
            frameRect: ie == null ? void 0 : ie.rect,
            placement: ie == null ? void 0 : ie.placement,
            tailTop: ie == null ? void 0 : ie.tailTop
          }
        )
      ]
    }
  );
}
const Dc = Zt(Lc);
function Cc(e, t) {
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
const xc = 2 * 1024 * 1024;
function zc(e) {
  const t = new co.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const cn = 5, Oc = "120% 0px", $c = 120, Fc = "25% 0px";
let kr = 1;
const Nr = /* @__PURE__ */ new WeakMap();
function Bc(e) {
  if (!e) return 0;
  const t = Nr.get(e);
  if (t) return t;
  const n = kr;
  return kr += 1, Nr.set(e, n), n;
}
function jc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Uc = Qr(
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
    dl();
    const { file: $, loading: D, error: B } = _s(n, r), R = `${n}\0${Bc($)}`, P = A(R);
    P.current = R;
    const T = q(() => {
      const C = Ps($);
      return C ? "ranged" in C ? { range: zc(C.ranged) } : C : null;
    }, [$, n]), [M, _] = N(0), [U, F] = N(""), [G, ee] = N(null), [X, Q] = N(480), fe = A(null), le = A(0), ue = q(() => jc(), []), be = q(() => ({
      cMapUrl: Et().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Et().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: xc,
      disableAutoFetch: !0
    }), []);
    _n(k, () => G, [G]), x(() => {
      const C = (W) => {
        le.current = W, Q(W);
      }, J = (W) => {
        const oe = ri(W, le.current);
        if (oe !== "ignore") {
          if (fe.current && clearTimeout(fe.current), oe === "immediate") {
            C(W);
            return;
          }
          fe.current = setTimeout(() => C(W), bo);
        }
      }, K = !!(l && l >= 80);
      J(K ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const ae = !K && i && typeof ResizeObserver < "u" ? new ResizeObserver((W) => {
        var oe, he;
        J(((he = (oe = W[0]) == null ? void 0 : oe.contentRect) == null ? void 0 : he.width) ?? i.clientWidth);
      }) : null;
      return ae && i && ae.observe(i), () => {
        ae == null || ae.disconnect(), fe.current && clearTimeout(fe.current);
      };
    }, [l, i, a]);
    const H = q(
      () => ei(X, o),
      [X, o]
    ), [te, me] = N(() => /* @__PURE__ */ new Map()), [ie, ye] = N(() => /* @__PURE__ */ new Set()), [Fe, Pe] = N(() => /* @__PURE__ */ new Set()), Ie = A(/* @__PURE__ */ new Map()), Te = A(null), z = A(null), [Y, ce] = N(() => /* @__PURE__ */ new Set()), j = A(/* @__PURE__ */ new Map()), V = O((C, J) => {
      me((K) => {
        if (K.get(C) === J) return K;
        const Z = new Map(K);
        return Z.set(C, J), Z;
      });
    }, []), se = O((C, J) => {
      const K = Ie.current, Z = K.get(C), ae = [Te.current, z.current];
      if (Z)
        for (const W of ae)
          try {
            W == null || W.unobserve(Z);
          } catch {
          }
      if (J) {
        K.set(C, J);
        for (const W of ae)
          try {
            W == null || W.observe(J);
          } catch {
          }
      } else
        K.delete(C);
    }, []), ve = A(/* @__PURE__ */ new Map()), pe = O((C) => {
      const J = ve.current;
      let K = J.get(C);
      return K || (K = (Z) => se(C, Z), J.set(C, K)), K;
    }, [se]);
    x(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = j.current, J = new IntersectionObserver(
        (K) => {
          const Z = [], ae = [];
          for (const W of K) {
            const oe = W.target, he = Kt(oe);
            Number.isFinite(he) && (W.isIntersecting ? Z : ae).push(he);
          }
          if ((Z.length || ae.length) && ye((W) => {
            let oe = null;
            for (const he of Z)
              W.has(he) || (oe = oe || new Set(W), oe.add(he));
            for (const he of ae)
              W.has(he) && (oe = oe || new Set(W), oe.delete(he));
            return oe || W;
          }), Z.length) {
            for (const W of Z) {
              const oe = C.get(W);
              oe && (clearTimeout(oe), C.delete(W));
            }
            Pe((W) => {
              let oe = null;
              for (const he of Z)
                W.has(he) || (oe = oe || new Set(W), oe.add(he));
              return oe || W;
            });
          }
          for (const W of ae)
            C.has(W) || C.set(W, setTimeout(() => {
              C.delete(W), Pe((oe) => {
                if (!oe.has(W)) return oe;
                const he = new Set(oe);
                return he.delete(W), he;
              });
            }, $c));
        },
        { root: i, rootMargin: Oc, threshold: 0 }
      );
      Te.current = J;
      for (const K of Ie.current.values())
        try {
          J.observe(K);
        } catch {
        }
      return () => {
        J.disconnect(), Te.current === J && (Te.current = null);
        for (const K of C.values()) clearTimeout(K);
        C.clear();
      };
    }, [i]), x(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = new IntersectionObserver(
        (J) => {
          ce((K) => {
            let Z = null;
            for (const ae of J) {
              const W = Kt(ae.target);
              !Number.isFinite(W) || ae.isIntersecting === K.has(W) || (Z = Z || new Set(K), ae.isIntersecting ? Z.add(W) : Z.delete(W));
            }
            return Z || K;
          });
        },
        { root: i, rootMargin: Fc, threshold: 0 }
      );
      z.current = C;
      for (const J of Ie.current.values())
        try {
          C.observe(J);
        } catch {
        }
      return () => {
        C.disconnect(), z.current === C && (z.current = null);
      };
    }, [i]);
    const Se = !!i && typeof IntersectionObserver < "u";
    Ee(() => {
      _(0), F(""), ye(/* @__PURE__ */ new Set()), Pe(/* @__PURE__ */ new Set()), me(/* @__PURE__ */ new Map()), Ie.current.clear();
      const C = j.current;
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
      typeof IntersectionObserver < "u" || Pe(new Set(Be));
    }, [Be]);
    const je = q(
      () => or(y, v, t),
      [y, v, t]
    ), Ge = q(() => {
      const C = /* @__PURE__ */ new Map();
      for (const J of h) {
        const K = or(J, v, t);
        if (!K) continue;
        const Z = C.get(K.box.page) || [];
        Z.push(K), C.set(K.box.page, Z);
      }
      return C;
    }, [t, v, h]), Lt = q(() => {
      const C = /* @__PURE__ */ new Set();
      if (!w) return C;
      for (const [J, K] of Ge)
        K.some((Z) => Z.itemId === w) && C.add(J);
      return C;
    }, [w, Ge]), Dt = q(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Be);
      if (ie.size === 0) {
        const K = Math.min(M, cn * 2 + 1);
        return new Set(Array.from({ length: K }, (Z, ae) => ae + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const K of ie)
        for (let Z = -cn; Z <= cn; Z++) {
          const ae = K + Z;
          ae >= 1 && ae <= M && J.add(ae);
        }
      return J;
    }, [M, Be, i, a, ie]), st = !n || !!B || !!U, Ct = n && (B || U) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: ee,
        className: `reader-panel ${Ks}${a ? "" : " is-hidden"}`,
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
          st && !D ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Ct }) : null,
          D ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !B ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Ja,
            {
              file: T,
              loading: null,
              error: null,
              options: be,
              onLoadSuccess: at,
              onLoadError: Qt,
              className: "reader-react-pdf-document",
              children: Be.map((C) => {
                if (Dt.has(C))
                  return /* @__PURE__ */ p(
                    Dc,
                    {
                      pane: t,
                      pageNumber: C,
                      width: H,
                      devicePixelRatio: ue,
                      active: Fe.has(C),
                      textLayer: !Se || Y.has(C),
                      syncedMinHeight: (c == null ? void 0 : c.get(C)) || 0,
                      onMetrics: d,
                      cachedAspect: te.get(C),
                      onAspectChange: V,
                      sentinelRef: pe(C),
                      regionHighlight: (je == null ? void 0 : je.box.page) === C ? je : null,
                      regionTargets: Ge.get(C),
                      hoveredRegionId: w && Lt.has(C) ? w : null,
                      onHoverRegion: g,
                      liveTranslationLayout: S == null ? void 0 : S.layoutByPage.get(C - 1),
                      liveTranslationPage: S == null ? void 0 : S.pagesByPage.get(C - 1),
                      showLiveTranslation: b
                    },
                    `${t}-${C}`
                  );
                const K = te.get(C) ?? Fo, Z = Math.max(120, Math.floor(H * K)), ae = Math.max(Z, Math.ceil((c == null ? void 0 : c.get(C)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: pe(C),
                    [Le]: C,
                    [Ke]: t,
                    [Cn]: Z,
                    className: `${xn} is-placeholder`,
                    style: {
                      width: H,
                      height: ae,
                      minHeight: ae
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: Wt,
                        style: { width: H, height: Z },
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
), Mr = Zt(Uc), Hc = 2e3, Wc = 6, Vc = 500, Ar = "reader-react-resizing";
function Kc(e, t) {
  const n = A(null), r = A(null);
  Ee(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const b = Jc(e), I = Bt(e, b);
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
      f && clearTimeout(f), cancelAnimationFrame(d), w == null || w.disconnect(), e.classList.remove(Ar);
      for (const I of _r) e.removeEventListener(I, g);
      ((b = r.current) == null ? void 0 : b.stop) === g && (r.current = null);
    }, S = () => {
      Tt(e, l, "auto", i);
      const b = e.scrollHeight;
      y = b === m ? y + 1 : 0, m = b;
      const I = performance.now() - h;
      y >= Wc && (b !== u || I > Vc) || I > Hc ? g() : d = requestAnimationFrame(S);
    };
    for (const b of _r) e.addEventListener(b, g, { passive: !0 });
    for (const b of Array.from(e.children)) w == null || w.observe(b);
    e.classList.add(Ar), r.current = { ...s, stop: g }, f = setTimeout(() => {
      f = null, h = performance.now(), u = e.scrollHeight, m = u, y = 0, d = requestAnimationFrame(S);
    }, bo);
  }, [e, t]), x(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Jc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Le}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ke) || null;
  }
  return null;
}
const _r = ["wheel", "touchstart", "keydown", "pointerdown"];
function Bo(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function qc(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Gc({ compare: e, onDone: t }) {
  return /* @__PURE__ */ L("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Bo(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(ro, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Ma, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ L("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ L(
        re,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Aa, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ L(
        re,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(_a, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Lr({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = qc(t), a = [e === "compare" ? "对比" : "正在读", r, Bo(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Zc({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return Ee(() => {
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
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(Lr, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(Lr, { role: "reading", ...n }) }) : null
  ] });
}
const Yc = () => () => {
}, Dr = () => null;
function Xc({
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
function Qc(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function ed(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function td(e) {
  const t = $e(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? _t, y = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), v = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, g = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, S = (t == null ? void 0 : t.compareVersion) ?? null, b = (S == null ? void 0 : S.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", I = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = S ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, $ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), D = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), B = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), R = e.regions ?? (t == null ? void 0 : t.regions) ?? [], P = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [M, _] = N(null), U = eo(
    T ? T.subscribe : Yc,
    T ? () => T.get().itemId : Dr,
    T ? () => T.get().itemId : Dr
  ), F = T ? U : M, G = O((fe) => {
    T ? T.set(fe, "pdf") : _(fe);
  }, [T]), ee = Xc({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: d
  }), Q = Number.isFinite(y) && y > 0 ? Qc(
    y,
    n || r,
    typeof document > "u" ? y * 2 : document.documentElement.clientWidth
  ) : null;
  return Kc(u, Q), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: mo,
      "data-reader-region-count": R.length,
      "data-reader-structured-region-count": R.filter(Sa).length,
      "data-reader-metadata-ready": P ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${Vs} reader-mode-${ee.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              v ? /* @__PURE__ */ p(
                Mr,
                {
                  pane: "source",
                  url: b,
                  preloadedFile: E,
                  userZoom: m,
                  visible: ee.showSource,
                  scrollRoot: u,
                  pageWidthOverride: Q,
                  rowHeights: ee.compareMode ? h : void 0,
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
                  liveTranslationPendingLabel: d ? ed(o) : "",
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
                Mr,
                {
                  pane: "translated",
                  url: I,
                  preloadedFile: k,
                  userZoom: m,
                  visible: ee.showTranslated,
                  scrollRoot: u,
                  pageWidthOverride: Q,
                  rowHeights: ee.compareMode ? h : void 0,
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
        S ? /* @__PURE__ */ p(Zc, { shellEl: u, left: S.left, right: S.right }) : null
      ]
    }
  );
}
const nd = [
  { id: "source", label: "原文", Icon: ao },
  { id: "compare", label: "对照", Icon: so },
  { id: "translated", label: "译文", Icon: io }
];
function rd(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function od(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function ad(e) {
  const t = $e(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, i = a ? rd(a.state) : "";
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
          /* @__PURE__ */ p(La, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: i })
        ]
      }
    ) : null,
    /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: nd.map(({ id: l, label: c, Icon: d }) => {
      const f = n === l, u = od({
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
const sd = Qr(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), id = sd, ld = {
  markdown: { label: "Markdown", short: "MD", Icon: id, needsJob: !0 }
}, cd = yo.map(
  (e) => ({ id: e, ...ld[e] })
);
function jo() {
  return cd.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function dd(e) {
  const t = $e(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(nt, { children: jo().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
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
function ud(e) {
  const t = $e(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = jo().map(({ id: l, label: c, short: d, Icon: f, needsJob: u }) => ({
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
function fd(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function md(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function hd(e) {
  return e / 100 * window.innerHeight;
}
function pd(e) {
  return e / 100 * window.innerWidth;
}
function gd(e) {
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
  const [o, a] = gd(n);
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
      r = md(t, o);
      break;
    }
    case "em": {
      r = fd(t, o);
      break;
    }
    case "vh": {
      r = hd(o);
      break;
    }
    case "vw": {
      r = pd(o);
      break;
    }
  }
  return r;
}
function we(e) {
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
      s = we(d / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const d = St({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = we(d / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const d = St({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = we(d / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const d = St({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = we(d / n * 100);
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
function ne(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Pn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? bd : yd
  );
}
function bd(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function yd(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Uo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Ho(e, t) {
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
function vd({
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
    const { x: i, y: l } = Ho(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return ne(o, "No rect found"), o;
}
let $t;
function wd() {
  return $t === void 0 && (typeof matchMedia == "function" ? $t = !!matchMedia("(pointer:coarse)").matches : $t = !1), $t;
}
function Wo(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Pn(
    n,
    Array.from(t.children).filter(Uo).map((y) => ({ element: y }))
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
                  const E = m[0], k = vd({
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
              const E = wd() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
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
class Vo {
  constructor() {
    tr(this, He, {});
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
    nr(this, He, {});
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
const Fn = new Vo();
function Qe() {
  return ut;
}
function Sd(e) {
  return Fn.addListener("change", e);
}
function Id(e) {
  const t = ut, n = { ...ut };
  n.cursorFlags = e, ut = n, Fn.emit("change", {
    prev: t,
    next: n
  });
}
function ft(e) {
  const t = ut;
  ut = e, Fn.emit("change", {
    prev: t,
    next: e
  });
}
const Rd = (e) => e, dn = () => {
}, Ko = 1, Jo = 2, qo = 4, Go = 8, Cr = 3, xr = 12;
let Ft;
function zr() {
  return Ft === void 0 && (Ft = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Ft = !0)), Ft;
}
function Ed({
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
        if (e && zr()) {
          const a = (e & Ko) !== 0, s = (e & Jo) !== 0, i = (e & qo) !== 0, l = (e & Go) !== 0;
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
    return zr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Or = /* @__PURE__ */ new WeakMap();
function Bn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Or.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Qe();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Ed({
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
  Or.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ae = /* @__PURE__ */ new Map();
const Zo = new Vo();
function Pd(e) {
  Ae = new Map(Ae), Ae.delete(e);
}
function $r(e, t) {
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
function jn(e, t) {
  return Zo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Oe(e, t, n) {
  const r = Ae.get(e);
  Ae = new Map(Ae), Ae.set(e, t), Zo.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Yo(e) {
  const t = Qe();
  let n = !1;
  switch (t.state) {
    case "active":
      ft({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Bn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Ve(r.group.id, !0);
        Oe(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Fr(e) {
  e.defaultPrevented || Yo(e.currentTarget);
}
function Td(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Ho(n, a.rect);
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
function kd(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Nd(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Ur(e),
    b: Ur(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ne(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: jr(Br(n.a)),
    b: jr(Br(n.b))
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
const Md = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Ad(e) {
  const t = getComputedStyle(Xo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function _d(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Ad(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Md.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Br(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ne(n, "Missing node"), _d(n)) return n;
  }
  return null;
}
function jr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Ur(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Xo(e);
  return t;
}
function Xo(e) {
  const { parentNode: t } = e;
  return kd(t) ? t.host : t;
}
function Ld(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Dd({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Uo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Nd(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Ld(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Un(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Wo(o), s = Td(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Dd({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Cd(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function ge(e, t, n = 0) {
  return Math.abs(we(e) - we(t)) <= n;
}
function Me(e, t) {
  return ge(e, t) ? 0 : e > t ? 1 : -1;
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
  return r = Math.min(i, r), r = we(r), r;
}
function kt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (ge(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), l = Object.values(o), c = [...i], [d, f] = r;
  ne(d != null, "Invalid first pivot index"), ne(f != null, "Invalid second pivot index");
  let u = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : d, v = n[h];
        ne(
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
          if (ne(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), ge(b, w)) {
            const I = S - b;
            Me(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      {
        const h = e < 0 ? d : f, v = n[h];
        ne(
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
          if (ne(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), ge(b, S)) {
            const I = b - w;
            Me(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : d, v = n[h];
      ne(
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
      ne(
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
      ne(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const g = w - v, S = dt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: g
      });
      if (!ge(w, S) && (u += w - S, c[h] = S, u.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Cd(l, c))
    return o;
  {
    const h = e < 0 ? f : d, v = i[h];
    ne(
      v != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = v + u, g = dt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: v,
      size: w
    });
    if (c[h] = g, !ge(g, w)) {
      let S = w - g, b = e < 0 ? f : d;
      for (; b >= 0 && b < n.length; ) {
        const I = c[b];
        ne(
          I != null,
          `Previous layout not found for panel index ${b}`
        );
        const E = I + S, k = dt({
          overrideDisabledPanels: s,
          panelConstraints: n[b],
          prevSize: I,
          size: E
        });
        if (ge(I, k) || (S -= k - I, c[b] = k), ge(S, 0))
          break;
        e > 0 ? b-- : b++;
      }
    }
  }
  const m = Object.values(c).reduce(
    (h, v) => v + h,
    0
  );
  if (!ge(m, 100, 0.1))
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
  if (!ge(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      ne(l != null, `No layout data found for index ${i}`);
      const c = 100 / o * l;
      r[i] = c;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const l = n[i];
    ne(l != null, `No layout data found for index ${i}`);
    const c = r[i];
    ne(c != null, `No layout data found for index ${i}`);
    const d = dt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: l,
      size: c
    });
    c != d && (a += c - d, r[i] = d);
  }
  if (!ge(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      ne(l != null, `No layout data found for index ${i}`);
      const c = l + a, d = dt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== d && (a -= d - l, r[i] = d, ge(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, l, c) => (i[s[c]] = l, i), {});
}
function Qo({
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
      return (g == null ? void 0 : g.collapsible) && ge(g.collapsedSize, d[g.panelId]);
    }))) {
      const v = c.slice(0, m).reduce((w, g) => w + d[g.id], 0);
      return {
        ...d,
        [t]: we(100 - v)
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
      return l && ge(c, d);
    },
    resize: (l) => {
      const { group: c } = n(), { element: d } = o(), f = mt({ group: c }), u = St({
        groupSize: f,
        panelElement: d,
        styleProp: l
      }), m = we(u / f * 100);
      i(m);
    }
  };
}
function Hr(e) {
  if (e.defaultPrevented)
    return;
  const t = rt();
  Un(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Qo({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function jt(e) {
  const t = rt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function ea({
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
  const n = jt(e), r = Ve(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  ne(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ne(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = ea({ groupId: n.id }).getLayout(), l = kt({
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
function Wr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = jt(t);
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
        const r = jt(t), o = Ve(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (u) => u.element === t
        );
        ne(l, "Matching separator not found");
        const c = i.get(l);
        ne(c, "Matching panels not found");
        const d = c[0], f = a.find(
          (u) => u.panelId === d.id
        );
        if (ne(f, "Panel metadata not found"), f.collapsible) {
          const u = s[d.id], m = f.collapsedSize === u ? r.mutableState.expandedPanelSizes[d.id] ?? f.minSize : f.collapsedSize;
          Ze(t, m - u);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = jt(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        ne(o !== null, "Index not found");
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
function Vr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = rt(), n = Un(e, t), r = /* @__PURE__ */ new Map();
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
function ta({
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
              i |= h < 0 ? Ko : Jo;
              break;
            }
            case "vertical": {
              i |= h < 0 ? qo : Go;
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
  t.movementX === 0 ? l |= s & Cr : l |= i & Cr, t.movementY === 0 ? l |= s & xr : l |= i & xr, Id(l), Bn(e);
}
function Kr(e) {
  const t = rt(), n = Qe();
  switch (n.state) {
    case "active":
      ta({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Jr(e) {
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
      ta({
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
      const a = Un(e, n);
      a.length === 0 ? t.state !== "inactive" && ft({
        cursorFlags: 0,
        state: "inactive"
      }) : ft({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Bn(e.currentTarget);
      break;
    }
  }
}
function qr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Qe().state) {
      case "hover":
        ft({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Gr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Yo(e.currentTarget) && e.preventDefault();
}
function Zr(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = we(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = we((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function xd(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = mt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: we(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function zd(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Od({
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
        const m = u / 100 * n, y = we(
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
      d[f] = we(
        u / a * c
      );
    }
  else {
    const f = we(
      c / l.length
    );
    for (const u of l)
      d[u] = f;
  }
  return d;
}
function $d(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const it = /* @__PURE__ */ new Map();
function Fd(e) {
  let t = !0;
  ne(
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
          const b = En(e), I = S.defaultLayoutDeferred ? Zr(b) : S.layout, E = Od({
            group: e,
            nextGroupSize: g,
            prevGroupSize: S.groupSize,
            prevLayout: I
          }), k = tt({
            layout: E,
            panelConstraints: b
          });
          if (!S.defaultLayoutDeferred && et(S.layout, k) && zd(
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
        xd(e, w, v);
    }
  });
  a.observe(e.element), e.panels.forEach((y) => {
    ne(
      !r.has(y.id),
      `Panel ids must be unique; id "${y.id}" was used more than once`
    ), r.add(y.id), y.onResize && a.observe(y.element);
  });
  const s = mt({ group: e }), i = En(e), l = e.panels.map(({ id: y }) => y).join(",");
  let c = e.mutableState.defaultLayout;
  c && ($d(e.panels, c) || (c = void 0));
  const d = e.mutableState.layouts[l] ?? c ?? Zr(i), f = tt({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  it.set(
    u,
    (it.get(u) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Wo(e).forEach((y) => {
    y.separator && m.set(y.separator, y.panels);
  }), Oe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((y) => {
    ne(
      !o.has(y.id),
      `Separator ids must be unique; id "${y.id}" was used more than once`
    ), o.add(y.id), y.element.addEventListener("keydown", Wr);
  }), it.get(u) === 1 && (u.addEventListener("contextmenu", Fr, !0), u.addEventListener("dblclick", Hr, !0), u.addEventListener("pointerdown", Vr, !0), u.addEventListener("pointerleave", Kr), u.addEventListener("pointermove", Jr), u.addEventListener("pointerout", qr), u.addEventListener("pointerup", Gr, !0)), function() {
    t = !1, it.set(
      u,
      Math.max(0, (it.get(u) ?? 0) - 1)
    ), Pd(e), e.separators.forEach((y) => {
      y.element.removeEventListener("keydown", Wr);
    }), it.get(u) || (u.removeEventListener(
      "contextmenu",
      Fr,
      !0
    ), u.removeEventListener(
      "dblclick",
      Hr,
      !0
    ), u.removeEventListener(
      "pointerdown",
      Vr,
      !0
    ), u.removeEventListener("pointerleave", Kr), u.removeEventListener("pointermove", Jr), u.removeEventListener("pointerout", qr), u.removeEventListener("pointerup", Gr, !0)), a.disconnect();
  };
}
function Bd() {
  const [e, t] = N({}), n = O(() => t({}), []);
  return [e, n];
}
function Hn(e) {
  const t = to();
  return `${e ?? t}`;
}
const ot = typeof window < "u" ? Ee : x;
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
function Wn(...e) {
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
function Vn(e) {
  const t = A({ ...e });
  return ot(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const na = Mn(null);
function jd(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: Rd
  });
  _n(t, () => n.current, []), ot(() => {
    Object.assign(
      n.current,
      ea({ groupId: e })
    );
  });
}
function ra({
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
  ), w = Hn(i), g = A(null), [S, b] = Bd(), I = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), E = Wn(g, a);
  jd(w, s);
  const k = It(
    (R, P) => {
      const T = Qe(), M = $r(R), _ = Ve(R);
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
  ), $ = Vn({
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
        const M = $r(w), _ = Ve(w);
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
    const _ = Fd(M), { defaultLayoutDeferred: U, derivedPanelConstraints: F, layout: G } = Ve(M.id, !0);
    !U && F.length > 0 && (h(G), v(G, !1));
    const ee = jn(w, (X) => {
      const { defaultLayoutDeferred: Q, derivedPanelConstraints: fe, layout: le } = X.next;
      if (Q || fe.length === 0)
        return;
      const ue = M.panels.map(({ id: H }) => H).join(",");
      M.mutableState.layouts[ue] = le, fe.forEach((H) => {
        if (H.collapsible) {
          const { layout: te } = X.prev ?? {};
          if (te) {
            const me = ge(
              H.collapsedSize,
              le[H.panelId]
            ), ie = ge(
              H.collapsedSize,
              te[H.panelId]
            );
            me && !ie && (M.mutableState.expandedPanelSizes[H.panelId] = te[H.panelId]);
          }
        }
      });
      const be = Qe().state !== "active";
      h(le), be && v(le, X.isUserInteraction);
    });
    return () => {
      B.current = null, _(), ee();
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
  }), /* @__PURE__ */ p(na.Provider, { value: D, children: /* @__PURE__ */ p(
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
ra.displayName = "Group";
function Kn() {
  const e = An(na);
  return ne(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Ud(e, t) {
  const { id: n } = Kn(), r = A({
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
      Qo({ groupId: n, panelId: e })
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
  const h = !!l, v = Hn(l), w = Vn({
    disabled: a
  }), g = A(null), S = Wn(g, s), {
    getPanelStyles: b,
    id: I,
    orientation: E,
    registerPanel: k,
    updatePanelProps: $
  } = Kn(), D = f !== null, B = It(
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
  }, [a, v, $]), Ud(v, u);
  const R = () => {
    const M = b(I, v);
    if (M)
      return JSON.stringify(M);
  }, P = eo(
    (M) => jn(I, M),
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
        ...Hd,
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
const Hd = {
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
function Wd({
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
function oa({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = Hn(a), c = Vn({
    disabled: n,
    disableDoubleClick: r
  }), [d, f] = N({}), [u, m] = N("inactive"), [y, h] = N(!1), v = A(null), w = Wn(v, o), {
    disableCursor: g,
    id: S,
    orientation: b,
    registerSeparator: I,
    updateSeparatorProps: E
  } = Kn(), k = b === "horizontal" ? "vertical" : "horizontal";
  ot(() => {
    const B = v.current;
    if (B !== null) {
      const R = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: B,
        id: l
      }, P = I(R), T = Sd(
        (_) => {
          m(
            _.next.state !== "inactive" && _.next.hitRegions.some(
              (U) => U.separator === R
            ) ? _.next.state : "inactive"
          );
        }
      ), M = jn(
        S,
        (_) => {
          const { derivedPanelConstraints: U, layout: F, separatorToPanels: G } = _.next, ee = G.get(R);
          if (ee) {
            const X = ee[0], Q = ee.indexOf(X);
            f(
              Wd({
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
oa.displayName = "Separator";
const Jn = 30, qn = 65, Nt = 50, Vd = 100 - qn, Kd = 100 - Jn;
function Jd(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(qn, Math.max(Jn, t)) : Nt;
}
function Gn(e) {
  return 100 - e;
}
function lt(e) {
  return `${e}%`;
}
const Zn = "reader-document", Mt = "reader-assistant", aa = "retainpdf.reader.ai-split-layout.v1", qd = {
  [Zn]: Gn(Nt),
  [Mt]: Nt
};
function Yn(e) {
  const t = Jd(e == null ? void 0 : e[Mt]);
  return {
    [Zn]: Gn(t),
    [Mt]: t
  };
}
function Gd() {
  try {
    const e = JSON.parse(localStorage.getItem(aa) || "null");
    return Yn(e);
  } catch {
    return qd;
  }
}
function Zd(e) {
  try {
    localStorage.setItem(aa, JSON.stringify(Yn(e)));
  } catch {
  }
}
function un(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Yn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Mt]}vw`
  );
}
function Yd() {
  const e = A(null), [t] = N(Gd);
  Ee(() => {
    const o = e.current;
    return un(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = O((o) => {
    un(e.current, o);
  }, []), r = O((o, a) => {
    un(e.current, o), a.isUserInteraction && Zd(o);
  }, []);
  return /* @__PURE__ */ L(
    ra,
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
            id: Zn,
            defaultSize: lt(Gn(Nt)),
            minSize: lt(Vd),
            maxSize: lt(Kd)
          }
        ),
        /* @__PURE__ */ p(
          oa,
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
            minSize: lt(Jn),
            maxSize: lt(qn)
          }
        )
      ]
    }
  );
}
function Xd({
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
function Qd({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Xd, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(nt, { children: [
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
      s ? /* @__PURE__ */ p(re, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function eu(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function tu() {
  const [e, t] = N(!1), n = to(), r = A(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || eu(a.target)) return;
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
        children: /* @__PURE__ */ p(Da, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: Yi.map((o) => /* @__PURE__ */ L("section", { className: "reader-react-shortcuts-group", children: [
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
const nu = ["source", "sideBySide", "translated"], ru = { source: "", translated: "", sideBySide: "" };
function ou(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Ut(e.sourceUrl), n = Ut(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ss({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function au(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = q(
    () => e ? ou(e) : ru,
    [e]
  ), o = q(
    () => nu.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = O(async (s) => {
    if (!e) return;
    const i = Ut(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? as(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await is(
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
        ls(c), n((d) => {
          const f = new Set(d);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const su = {
  source: ao,
  sideBySide: so,
  translated: io
}, iu = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function lu(e) {
  const t = $e(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = au(n), i = A(null);
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
      /* @__PURE__ */ p(Ca, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(oo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = ma[l], d = Ut(r[l]), f = a.has(l), u = !!d && !f, m = u ? "" : ha(l, r), y = su[l];
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
                iu[l],
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
const cu = "retainpdf:reader:bookmarks:v1:", du = 200;
function Xn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function sa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${cu}${t}` : "";
}
function uu(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Gt(e, t = Xn()) {
  const n = sa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = uu(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function kn(e, t, n) {
  const r = sa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, du);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function fu(e, t, n = "", { storage: r = Xn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Gt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? kn(e, a.filter((i) => i.page !== s), r) : kn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function mu(e, t, n = Xn()) {
  return kn(e, Gt(e, n).filter((r) => r.page !== t), n);
}
function hu(e, t) {
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
function pu({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function gu({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => Gt(e)), [i, l] = N(!1), c = A(null);
  if (x(() => {
    s(Gt(e)), l(!1);
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
        onClick: () => s(fu(e, d, hu(r, d))),
        children: /* @__PURE__ */ p(pu, { filled: f })
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
          /* @__PURE__ */ p(xa, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
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
          onClick: () => s(mu(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function bu(e) {
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
function yu(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const vu = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, wu = ["failed", "content", "layout"];
function Su(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Iu({ jobId: e, currentPage: t }) {
  var f;
  const n = bu(e), r = (f = $e()) == null ? void 0 : f.jumpToBlock, [o, a] = N(!1), [s, i] = N(-1), l = A(null);
  x(() => i(-1), [n]);
  const c = (u) => {
    const m = n[u];
    !m || !r || (i(u), r(m.readerItemId));
  }, d = A({ issues: n, last: s, currentPage: t, goTo: c });
  return d.current = { issues: n, last: s, currentPage: t, goTo: c }, x(() => {
    const u = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || Su(m.target)) return;
      const { issues: y, last: h, currentPage: v, goTo: w } = d.current, g = yu(y, h, v, m.shiftKey);
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
      re,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((u) => !u),
        children: [
          /* @__PURE__ */ p(za, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ L("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      wu.map((u) => {
        const m = n.map((y, h) => ({ issue: y, index: h })).filter(({ issue: y }) => y.kind === u);
        return m.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ L("h4", { children: [
            vu[u],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: y, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
            re,
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
const Ru = 48, Eu = 96, Pu = 700;
function Tu(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Ru, downSoFar: r };
}
function ku(e) {
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
      if (o.set(m, y), h === void 0 || Date.now() - a > Pu) return;
      const v = Tu(!1, r.current, y - h);
      r.current = v.downSoFar, y - h < -4 ? n(!1) : v.hidden && !l() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - Eu && (r.current = 0, n(!1));
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
function Nu(e) {
  const t = $e(), n = $o(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? _t, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = Xs(a), f = a > po + 1e-3, u = a < Jt - 1e-3, m = ct(r, Ye()), y = m >= Jt ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = A(null), v = ku(h), [w, g] = N(!1), [S, b] = N(`${i}`);
  x(() => {
    w || b(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, w]);
  const I = () => {
    if (g(!1), !c || l <= 0)
      return;
    const E = Number(`${S}`.trim());
    c(qt(E, l));
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
      gu,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(Iu, { jobId: e.issuesJobId, currentPage: i }) : null,
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
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(tu, {}) })
  ] });
}
function Yr(e) {
  var t, n;
  return vo(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Mu(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Yr(_e(e))
  }));
  x(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Yr(_e(e))
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
function Au({
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
function _u(e = {}) {
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
    () => /* @__PURE__ */ p(Au, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Nn, duration: 1 / 0 }
  );
}
function Lu() {
  const e = O((t) => {
    t && (t.setState = _u, t.hide = () => hn.dismiss(Nn));
  }, []);
  return /* @__PURE__ */ L(nt, { children: [
    /* @__PURE__ */ p(Pa, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Du(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : go(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Cu(e, t) {
  return t === null || e !== t;
}
function xu(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function zu(e, t) {
  const n = e === t;
  return { open: n, mounted: xu(n) };
}
const Xr = { itemId: null, origin: null };
function Ou() {
  let e = Xr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Xr : { itemId: n, origin: r };
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
const $u = [];
function Fu({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(re, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Oa, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Bu({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    re,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p($a, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function ju({
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
  const l = ((b = $e()) == null ? void 0 : b.regions) ?? $u, c = ((I = $o()) == null ? void 0 : I.currentPage) ?? 1, d = q(() => Pc(l), [l]), f = Tc(d, c), u = q(() => Mc(l, s), [l, s]), [m, y] = N(-1);
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
        /* @__PURE__ */ p(re, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(re, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(re, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(pt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: g, className: "reader-finder-list", children: d.map((E, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
      re,
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
          lo,
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
              E.key === "Enter" ? (E.preventDefault(), S(_c(m, u.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: u.length === 0 ? "没有找到" : `${m >= 0 ? `第 ${m + 1} / ` : ""}${u.length >= 200 ? "200+ 处，只列前 200 处" : `${u.length} 处`}${m < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: u.map((E, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(re, { className: "reader-finder-entry is-hit", "aria-current": k === m ? "true" : void 0, onClick: () => S(k), children: [
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
function Uu({ active: e, compare: t, ink: n }) {
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
    a ? /* @__PURE__ */ p(Gc, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ L("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
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
          children: /* @__PURE__ */ p(Dn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(dd, { active: e }),
      t.available ? /* @__PURE__ */ p(
        re,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ p(Fa, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
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
        "data-active": e || l ? "true" : void 0,
        onClick: () => {
          o((c) => !c), s(!1);
        },
        children: r ? /* @__PURE__ */ p(pt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Ba, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Hu = [
  { tool: "pen", label: "画笔", Icon: Dn },
  { tool: "highlighter", label: "荧光笔", Icon: ja },
  { tool: "eraser", label: "橡皮", Icon: Ua }
];
function ia(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function la({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L(nt, { children: [
    Hu.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    Do.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(re, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Ha, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      re,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Wa, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ p(pt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Wu({ ink: e, menu: t, onClose: n }) {
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
  return /* @__PURE__ */ p("div", { ref: r, className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", style: { left: a, top: s }, "data-ink-menu": "true", children: /* @__PURE__ */ p(la, { ink: e, page: t.page, onPick: n }) });
}
function Vu({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(la, { ink: e }) }) : null;
}
function Ku(e) {
  var r;
  if (e.shiftKey || ia(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${mo}`))) return null;
  const n = Number((r = t.closest(`[${Le}]`)) == null ? void 0 : r.getAttribute(Le)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Ju(e) {
  const t = A(e);
  t.current = e, x(() => {
    const n = (r) => {
      if (ia(r.target)) return;
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
function qu(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Gu(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Zu(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Yu({ documentId: e, jobId: t }) {
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
      return { versionId: v, name: g.name, jobId: I, url: k, regions: qu(no(E.regionsPayload)) };
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
    w && ((S = globalThis.history) == null || S.replaceState(globalThis.history.state, "", Zu(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Gu(n, t, o),
    compared: s,
    loading: l,
    error: d,
    choose: m,
    clear: y,
    adopt: h
  };
}
const Xu = "reader-finder-input";
function Qu(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function ef(e, t = typeof window > "u" ? null : window) {
  x(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Qu(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Xu) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function tf() {
  try {
    return qe().translationEdit ?? null;
  } catch {
    return null;
  }
}
const nf = "这本书正在处理（翻译或排版），处理完才能改。", rf = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function of({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = tf(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = ul(s), c = !t || Rt(t), d = bl(n), [f, u] = N(""), [m, y] = N(null), [h, v] = N(() => /* @__PURE__ */ new Map()), [w, g] = N(
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
      _ || v(yl(U, d));
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
    U && y({ itemId: U, page: fl(U) });
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
  }, [a, s, I.phase, o]), M = l ? rf : !c || I.phase === "running" || I.phase === "submitting" ? nf : "";
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
function af(e, t) {
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
function sf({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ L("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
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
const lf = da(() => import("./ReaderMarkdownPanel-L9lb6fYA.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function cf(e) {
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
function df(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function uf() {
  var ce;
  const e = Gi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Mu(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = N(!1), d = A(null), f = A(null), u = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, y = cf({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: l,
    assistantOpen: u
  }), h = Bi({
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
        const j = _e(e.viewStateKey), V = Du({
          savedMode: j == null ? void 0 : j.mode,
          sourceViewOnly: v,
          viewportWidth: Ye()
        });
        f.current = V.auto ? V.mode : null, V.mode && V.mode !== e.mode && e.setModeKeepingPage(V.mode);
        return;
      }
      Cu(e.mode, f.current) && (f.current = null, Xt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, v]);
  const g = s || (e.mode === "compare" ? "compare" : "reading"), S = zu(s, "markdown");
  nl({
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
    const V = df(j, e.liveTranslationAvailable);
    V !== null && c(V), e.setModeKeepingPage(j);
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
  }, []), [$] = N(Ou), [D, B] = N(null), R = O((j) => B((V) => V === j ? null : j), []), [P, T] = N(""), [M, _] = N("");
  x(() => {
    const j = P.replace(/\s+/gu, " ").trim(), V = window.setTimeout(() => _(j), j ? 150 : 0);
    return () => window.clearTimeout(V);
  }, [P]);
  const [U, F] = N(0), G = O(() => {
    B("search"), F((j) => j + 1);
  }, []);
  ef(G);
  const ee = O((j) => {
    e.jumpToAnchor({ block_id: j }), (D === "outline" || Ye() < 900) && B(null);
  }, [e.jumpToAnchor, D]), X = O((j) => e.jumpToAnchor({ block_id: j }), [e.jumpToAnchor]), Q = of({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), fe = Q.select, le = e.setModeKeepingPage, ue = o.regions, be = O((j) => {
    Il(ue, j) && (w === "source" && le("compare"), fe(j));
  }, [ue, fe, w, le]);
  af(Q.available ? be : null, $);
  const H = uc(e.viewStateKey);
  Ju(H);
  const [te, me] = N(null), ie = O(() => me(null), []), ye = Yu({ documentId: o.documentId, jobId: o.jobId }), Fe = ((ce = ye.compared) == null ? void 0 : ce.url) || "";
  x(() => {
    Fe && w !== "compare" && I("compare");
  }, [Fe]), x(() => {
    w !== "compare" && ye.clear();
  }, [w]);
  const Pe = q(
    () => {
      const { compared: j, versions: V, readingVersionId: se } = ye;
      if (!j) return null;
      const ve = V.find((Se) => Se.versionId === j.versionId), pe = V.find((Se) => Se.versionId === se);
      return {
        url: j.url,
        regions: j.regions,
        left: { name: j.name, createdAt: (ve == null ? void 0 : ve.createdAt) || "" },
        right: { name: (pe == null ? void 0 : pe.name) || "当前译文", createdAt: (pe == null ? void 0 : pe.createdAt) || "" }
      };
    },
    [ye.compared, ye.versions, ye.readingVersionId]
  ), Ie = q(() => {
    if (!Q.savedCounts.size) return e.revisedBlocks;
    const j = new Map(e.revisedBlocks);
    for (const [V, se] of Q.savedCounts) j.set(V, (j.get(V) || 0) + se);
    return j;
  }, [e.revisedBlocks, Q.savedCounts]), Te = q(() => ({
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
    editBlock: Q.available ? be : void 0,
    blockEdit: Q,
    editShowsSource: w !== "compare",
    findTerm: D === "search" ? M : "",
    compareVersion: Pe,
    ink: H,
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
    be,
    w,
    D,
    M,
    Pe,
    H,
    e.sourceOnly,
    v,
    e.download,
    e.goToPage,
    k,
    b
  ]), z = q(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Y = [
    Ws,
    `is-workspace-${g}`,
    u ? "is-assistant-open" : "",
    D ? "is-finder-open" : "",
    y.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(yc, { value: Te, hud: z, children: /* @__PURE__ */ L(
    "div",
    {
      className: Y,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": g,
      "data-ink-mode": H.tool || void 0,
      onContextMenu: (j) => {
        const V = Ku(j);
        V && (j.preventDefault(), me(V));
      },
      children: [
        /* @__PURE__ */ p(Qd, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(Fu, { open: D, onToggle: R }),
        D ? /* @__PURE__ */ p(
          ju,
          {
            tab: D,
            onTab: B,
            onClose: () => B(null),
            onJump: ee,
            query: P,
            onQuery: T,
            term: M,
            focusSignal: U
          }
        ) : null,
        /* @__PURE__ */ L("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(lu, {}),
          /* @__PURE__ */ p(cl, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          ad,
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
        /* @__PURE__ */ p(ud, { active: s }),
        u ? /* @__PURE__ */ p(Yd, {}) : null,
        /* @__PURE__ */ p(td, { paneComposition: y, markdownSplit: S.open, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
        e.showHud ? /* @__PURE__ */ p(
          Nu,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(Bu, { open: D, onToggle: R })
          }
        ) : null,
        /* @__PURE__ */ p(ca, { fallback: null, children: S.mounted ? /* @__PURE__ */ p(lf, { open: S.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: b }) : null }),
        /* @__PURE__ */ p(Uu, { active: s, compare: ye, ink: H }),
        /* @__PURE__ */ p(Wu, { ink: H, menu: te, onClose: ie }),
        /* @__PURE__ */ p(Vu, { ink: H }),
        /* @__PURE__ */ p(sf, { edit: Q }),
        /* @__PURE__ */ p(Lu, {})
      ]
    }
  ) });
}
function Af() {
  return /* @__PURE__ */ p(uf, {});
}
export {
  Af as R,
  uf as a,
  Nf as d,
  kf as f,
  Mf as r,
  $e as u
};
//# sourceMappingURL=ReaderApp-mxUEU1bU.js.map
