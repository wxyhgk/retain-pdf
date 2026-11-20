var Qn = (e) => {
  throw TypeError(e);
};
var er = (e, t, n) => t.has(e) || Qn("Cannot " + n);
var gt = (e, t, n) => (er(e, t, "read from private field"), n ? n.call(e) : t.get(e)), tr = (e, t, n) => t.has(e) ? Qn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), nr = (e, t, n, r) => (er(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as nt } from "react/jsx-runtime";
import { useMemo as G, useState as N, useEffect as x, useCallback as O, useRef as A, useLayoutEffect as Ie, memo as Zt, createContext as Mn, useContext as An, forwardRef as Qr, useImperativeHandle as _n, useSyncExternalStore as eo, useId as to, Suspense as la, lazy as ca } from "react";
import { requireAdapter as ht, getReaderAdapters as Te } from "./adapters.js";
import { resolveReaderDownloadName as da, resolveReaderDownloadUrls as ua, READER_PROGRESS_COPY as Le, trimString as Ut, READER_DOWNLOAD_ACTIONS as fa, disabledReason as ma } from "./runtime/state.js";
import { r as ha, b as pa } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as fn, isFinishedJobStatus as Et } from "@retainpdf/domain/job";
import { n as no, d as ga, f as Qt, k as rr, b as ba, c as ya, j as At, p as Ln, g as va, l as or, i as wa } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as Sa } from "@retainpdf/api/documents";
import { isReaderTransportError as Ia, createReaderTransportError as Ea } from "./contracts.js";
import { toast as mn, Toaster as Ra } from "sonner";
import { X as pt, PenLine as Dn, Check as ro, Copy as Pa, ChevronUp as Ta, ChevronDown as oo, History as ka, LoaderCircle as Na, Pin as Ma, LogOut as Aa, Radio as _a, FileText as ao, Columns2 as so, Languages as io, Keyboard as La, Download as Da, ListOrdered as Ca, TriangleAlert as xa, ListTree as za, Search as Oa, GitCompareArrows as $a, LayoutGrid as Fa, Highlighter as Ba, Eraser as ja, Undo2 as Ua, Trash2 as Ha } from "lucide-react";
import { Button as re, Textarea as Wa, IconButton as ar, Input as lo } from "@retainpdf/ui";
import { pdfjs as co, Page as Va, Document as Ka } from "react-pdf";
import { e as Ja, m as Ga, a as qa } from "./markdown-math-XkF5urpn.js";
const Za = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ya = "", Xa = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Qa = (e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Mf = (...e) => {
  var n;
  return (((n = Te()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, De = () => ht("defaultReaderDataPort"), sr = () => ht("defaultReaderPageConfigPort"), Af = {
  get apiPrefix() {
    return De().apiPrefix;
  },
  fetchProtected: (...e) => De().fetchProtected(...e),
  loadMarkdownPayload: (e) => De().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => De().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => De().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => De().loadJobPayload(e),
  loadReaderPayload: (e, t) => De().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => De().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return De().liveTranslation;
  }
}, uo = {
  messageTargetOrigin: () => sr().messageTargetOrigin(),
  readerJobId: () => sr().readerJobId()
}, es = () => {
  var e;
  return ((e = Te()) == null ? void 0 : e.liveTranslation) ?? null;
}, Rt = () => {
  var t;
  const e = Te();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ge = () => {
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
}, ss = (...e) => ht("downloadProtectedResource")(...e), is = (...e) => ht("failDownloadToast")(...e), _f = (e, t) => ht("resolveMarkdownAssetUrl")(e, t), ir = "/api/v1";
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
          const b = u.apply(this, m);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), b;
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
  const e = ls(), t = G(() => rs(uo), [e]), n = G(() => ns(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
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
  }), u = l.documentId === t ? l.jobId : "", m = d.documentId === t ? d.jobId : "", b = n || u, [h, y] = N({
    jobId: "",
    documentId: ""
  }), v = h.jobId === b ? h.documentId : "", S = t || v, w = !!t && !b, [g, I] = N(null), R = (g == null ? void 0 : g.sessionIdentity) === r && g.documentId === S ? g : null, k = w || !!R, z = O((F) => {
    const E = `${F.documentId || ""}`.trim();
    if (!E || a.current && a.current !== E) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: E
      });
    else if (!a.current)
      return;
    const P = `${F.revision || ""}`.trim() || `${Date.now()}`;
    I({
      documentId: E,
      revision: P,
      sessionIdentity: o.current
    }), i();
  }, []);
  x(() => {
    I((F) => F && F.sessionIdentity !== r ? null : F);
  }, [r]);
  const D = O((F) => {
    switch (F.type) {
      case "resolved-document-job":
        c({ documentId: F.documentId, jobId: F.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: F.documentId, jobId: F.jobId });
        break;
      case "resolved-job-document":
        y((E) => E.jobId === F.jobId && E.documentId === F.documentId ? E : { jobId: F.jobId, documentId: F.documentId });
        break;
      case "committed-source":
        I({
          documentId: F.documentId,
          revision: F.revision,
          sessionIdentity: F.sessionIdentity
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
    sessionJobId: b,
    resolvedJobDocument: h,
    setResolvedJobDocument: y,
    jobDocumentId: v,
    documentId: S,
    sourceOnly: w,
    committedDocumentSource: g,
    setCommittedDocumentSource: I,
    activeCommittedDocumentSource: R,
    sourceViewOnly: k,
    refreshCommittedDocument: z,
    applyIdentityEvent: D
  };
}
function lr(e) {
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
function cr(e, t) {
  return Qa(fn(e, t));
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
function hn({
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
  }), hn({ percent: t, text: n, stage: r });
}
function hs(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = N(null), [c, d] = N(null), [f, u] = N(""), [m, b] = N(0), h = f === n ? i : null, y = f === n ? c : null, v = lr(h), S = Et(v), w = O(() => {
    b((D) => D + 1);
  }, []), g = O((D) => {
    l(D.jobPayload), d(D.manifestPayload), u(D.sessionIdentity);
  }, []), I = O((D) => {
    l(null), d(null), u(D);
  }, []), R = A(""), k = A(""), z = O(async () => {
    const D = o.current;
    if (!D || R.current === D) return;
    const F = Ge().loadJobPayload;
    if (typeof F != "function") return;
    const E = a.current.value;
    R.current = D;
    try {
      const P = await F(D);
      if (s.current || a.current.value !== E || o.current !== D || !P || typeof P != "object")
        return;
      const T = lr(P);
      l(P), u(r.current), !Et(T) && k.current === D && (k.current = ""), T === "succeeded" && k.current !== D && (k.current = D, b((M) => M + 1));
    } catch {
    } finally {
      R.current === D && (R.current = "");
    }
  }, []);
  return x(() => {
    k.current = "";
  }, [n]), x(() => {
    if (!t || S || !h) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && z();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [S, z, h, t]), {
    jobPayload: i,
    setJobPayload: l,
    manifestPayload: c,
    setManifestPayload: d,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: u,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: v,
    jobTerminal: S,
    jobRefreshRevision: m,
    refreshJobArtifacts: w,
    refreshJobStatus: z,
    publishPayload: g,
    clearPayload: I
  };
}
function pn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function ps(e, t) {
  e(t), pn(t);
}
function gs(e) {
  const [t, n] = N(e ? "source" : "compare"), r = O((a) => {
    e && a !== "source" || (n(a), pn(a));
  }, [e]), o = O((a) => {
    ps(n, a);
  }, []);
  return x(() => (e && document.documentElement.classList.add("reader-source-only"), pn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function dr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function bs(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: dr(n.active_job_id),
    activeVersionId: dr(n.active_version_id)
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
const Es = 48 * 1024 * 1024;
function Rs(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ps = 2, Se = /* @__PURE__ */ new Map();
function gn(e, t) {
  Se.delete(e), Se.set(e, t);
}
function ur(e) {
  if (Se.size < Ps) return;
  const t = Se.keys().next().value;
  t && Se.delete(t);
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
async function fo(e, t = Rt().fetchProtected, n = {}) {
  var d, f, u, m, b, h, y, v, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Se.has(r)) {
    const w = Se.get(r);
    return gn(r, w), w;
  }
  const o = new AbortController(), a = () => o.abort();
  (d = n.signal) != null && d.aborted && o.abort(), (u = (f = n.signal) == null ? void 0 : f.addEventListener) == null || u.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (b = (m = n.signal) == null ? void 0 : m.removeEventListener) == null || b.call(m, "abort", a);
  }
  if (!s.ok) {
    const w = new Error(`读取 PDF 失败 (${s.status})`);
    w.status = s.status;
    const g = await Ts(s);
    throw g && (w.reason = g), w;
  }
  const i = ks(r, s, t);
  if (i) {
    o.abort();
    const w = { ranged: i };
    return ur(), Se.set(r, w), w;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (S = (v = n.signal) == null ? void 0 : v.removeEventListener) == null || S.call(v, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return Se.has(r) ? gn(r, c) : (ur(), Se.set(r, c)), c;
}
function ks(e, t, n) {
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
const Ns = { file: null, loading: !1, error: "" }, Ms = { file: null, loading: !0, error: "" };
function As(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (x(() => {
    if (t || !n) return;
    const s = Se.get(n);
    if (s) {
      gn(n, s);
      return;
    }
    const i = new AbortController();
    return fo(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ns;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Se.get(n);
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
async function bn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Ht(s, r, n, "download");
  const i = await fo(t, Rt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Ht(s, o, n, "download"), i);
}
async function Ls(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Ht(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    bn({
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
    bn({
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
const xt = {
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
    jobRefreshRevision: b,
    sessionEpochRef: h,
    closingRef: y,
    activeLoadAbortRef: v
  } = e, [S, w] = N(""), [g, I] = N(""), [R, k] = N(null), [z, D] = N(null), [F, E] = N(!1), [P, T] = N(""), [M, _] = N([]), [U, $] = N(!1), [q, te] = N(() => ({
    source: null,
    translated: null
  })), [Y, X] = N(
    xt
  ), [me, ie] = N({
    loading: !0,
    percent: 4,
    text: Le.boot,
    stage: "progress",
    failed: !1
  });
  return x(() => {
    const le = new AbortController(), he = h.current.value, K = _s({
      sessionEpochRef: h,
      closingRef: y,
      abort: le,
      sessionEpoch: he
    });
    v.current = le;
    const Q = Ge();
    if (y.current)
      return le.abort(), () => {
        v.current === le && (v.current = null);
      };
    let pe = !1;
    function ue(ee, B) {
      K.markFailed(), $(!0), ie({
        loading: !1,
        percent: 100,
        text: ee,
        stage: "failed",
        failed: !0
      }), hn({ percent: 100, text: B, stage: "failed" });
    }
    function fe() {
      E(!0), pe || $(!0), ie({
        loading: !1,
        percent: 100,
        text: Le.ready,
        stage: "ready",
        failed: !1
      }), hn({ percent: 100, text: Le.ready, stage: "ready" });
    }
    function $e() {
      return c != null && c.documentId ? cr(
        c.documentId,
        c.revision
      ) : Za() ? Ya : Q.resolveResourceUrl(fn(r));
    }
    async function Ee() {
      var ce;
      let ee = { activeJobId: "", activeVersionId: "" };
      try {
        const ae = await ((ce = Q.fetchDocument) == null ? void 0 : ce.call(Q, r));
        ae && (ee = bs(ae));
      } catch {
      }
      const B = ys({
        link: ee,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (B.kind === "follow-active-job") {
        if (K.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: B.jobId
        }), B.activeVersionId ? (c || d({
          type: "committed-source",
          documentId: r,
          revision: B.activeVersionId,
          sessionIdentity: l
        }), m("source")) : m("compare");
        return;
      }
      if (B.kind === "open-committed-source") {
        if (K.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: B.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const j = $e();
      if (K.isInactive()) return;
      w(j), I(""), T(""), u(l);
      const H = await bn({
        url: j,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: K,
        setBoot: ie
      });
      if (!K.isInactive()) {
        if (!H) {
          ue("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        k(H), fe();
      }
    }
    async function ke() {
      var J;
      const ee = !c, B = !!(ee && Q.loadSessionSnapshot && Q.loadReaderOptionalArtifacts), j = B ? Q.loadReaderOptionalArtifacts(t) : null, H = await ((J = Q.loadSessionSnapshot) == null ? void 0 : J.call(Q, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: ee && !B
      })), ce = H ? {
        jobPayload: H.sourcePayload,
        manifestPayload: H.manifestPayload,
        readerMetadata: H.readerMetadata,
        regionsPayload: H.regions,
        readerErrors: H.readerErrors
      } : await Q.loadReaderPayload(t, {
        includeOptionalArtifacts: ee
      });
      if (K.isInactive()) return;
      let ae = null;
      if (n && !r)
        if (H && H.linkedDocument !== void 0)
          ae = H.linkedDocument;
        else {
          try {
            ae = await Q.fetchDocumentByJobId(ir, t);
          } catch {
          }
          if (K.isInactive()) return;
        }
      const be = us(ce.jobPayload) || `${(ae == null ? void 0 : ae.document_id) || ""}`.trim();
      be && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: be
      });
      const ve = vs({
        payloadDocumentId: be,
        linkedActiveJobId: `${(ae == null ? void 0 : ae.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ae == null ? void 0 : ae.active_version_id) || ""}`.trim(),
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
      const Fe = Q.resolveReaderSourcePdf(ce.manifestPayload), Be = Q.resolveReaderTranslatedPdfUrl(ce.jobPayload, ce.manifestPayload), at = typeof Fe == "string" ? Fe : Q.resolveReaderArtifactUrl(Fe), je = r || be, Ue = c != null && c.documentId ? cr(
        c.documentId,
        c.revision
      ) : at || (je ? Q.resolveResourceUrl(fn(je)) : ""), qe = c ? "" : Be || "";
      w(Ue || ""), I(qe), T(ms(ce.jobPayload, t)), f({
        jobPayload: ce.jobPayload || null,
        manifestPayload: ce.manifestPayload || null,
        sessionIdentity: l
      });
      const Lt = () => Ls({
        sourceFinal: Ue || "",
        translatedFinal: qe,
        fence: K,
        setBoot: ie
      }), Dt = !!(Ue || qe), st = j && Dt ? Lt() : null;
      st == null || st.catch(() => {
      });
      const Ct = (V) => {
        K.isInactive() || (_(c ? [] : no(V.regionsPayload)), te(c ? { source: null, translated: null } : ga(V.readerMetadata)), X(c ? xt : V.readerErrors ?? xt), $(!0));
      };
      if (j ? (pe = !0, j.then(Ct)) : Ct(ce), !Dt) {
        ue(Le.failed, Le.failed);
        return;
      }
      const C = await (st ?? Lt());
      if (C.status !== "inactive") {
        if (C.status === "incomplete") {
          ue("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        k(C.sourceBytes), D(C.translatedBytes), fe();
      }
    }
    async function Re() {
      E(!1), k(null), D(null), _([]), $(!1), te({ source: null, translated: null }), X(xt), Ht(ie, 8, Le.metadata, "metadata");
      try {
        if (s) {
          await Ee();
          return;
        }
        if (!t) {
          ue(Le.failed, Le.failed);
          return;
        }
        await ke();
      } catch (ee) {
        if (K.isClosedOrStale() || (ee == null ? void 0 : ee.name) === "AbortError") return;
        K.markFailed();
        const B = Number(ee == null ? void 0 : ee.status), j = `${(ee == null ? void 0 : ee.reason) || ""}`, H = Is({ status: B, reason: j, sessionJobId: t });
        if (H && (await Cs({
          apiPrefix: ir,
          documentId: H,
          expiredJobId: t
        }) || K.isClosedOrStale()))
          return;
        if (ws({
          status: B,
          reason: j,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const ce = ee instanceof Error ? ee.message : Le.failed;
        ue(ce, ce);
      }
    }
    return Re(), () => {
      le.abort(), v.current === le && (v.current = null);
    };
  }, [t, r, o, a, s, i, c, b, n, l, d, f, u, m]), {
    sourceUrl: S,
    translatedUrl: g,
    sourceFile: R,
    translatedFile: z,
    assetsReady: F,
    title: P,
    regions: M,
    regionsSettled: U,
    readerMetadata: q,
    readerErrors: Y,
    boot: me
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
    documentId: b,
    sourceOnly: h,
    sourceViewOnly: y
  } = u, { mode: v, setMode: S, switchSessionMode: w } = gs(y);
  d.current = () => {
    w("source");
  }, i.current = a, l.current = b, c.current = m;
  const g = hs({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: I,
    scopedManifestPayload: R,
    jobStatus: k,
    jobTerminal: z,
    jobRefreshRevision: D,
    refreshJobArtifacts: F,
    refreshJobStatus: E
  } = g, P = xs({
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
    publishPayload: g.publishPayload,
    clearPayload: g.clearPayload,
    switchSessionMode: w,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = O(() => {
    var _;
    e.current = !0, (_ = t.current) == null || _.abort();
  }, []), M = G(
    () => ({
      fetchProtected: Ge().fetchProtected,
      jobId: m,
      jobPayload: I,
      manifestPayload: R,
      sourceUrl: P.sourceUrl,
      translatedUrl: P.translatedUrl,
      sourceOnly: y
    }),
    [m, I, R, P.sourceUrl, P.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: k,
    workflow: `${(I == null ? void 0 : I.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: z,
    documentId: b,
    sessionIdentity: a,
    sourceOnly: h,
    mode: v,
    setMode: S,
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
    refreshJobArtifacts: F,
    refreshJobStatus: E,
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
const en = { source: 0, translated: 0 };
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
    pages: en
  })), [m, b] = N(() => ({ identity: c, tick: 0 })), h = f.identity === c ? f.pages : en, y = m.identity === c ? m.tick : 0, v = js({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: S } = v, w = O((E, P) => {
    d.current === c && u((T) => {
      const M = T.identity === c ? T.pages : en;
      return M[P] === E && T.identity === c ? T : {
        identity: c,
        pages: { ...M, [P]: E }
      };
    });
  }, [c]), g = A(null), I = O(() => {
    g.current && clearTimeout(g.current);
    const E = c;
    g.current = setTimeout(() => {
      g.current = null, d.current === E && b((P) => ({
        identity: E,
        tick: P.identity === E ? P.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  x(() => (g.current && (clearTimeout(g.current), g.current = null), u((E) => E.identity === c && E.pages.source === 0 && E.pages.translated === 0 ? E : { identity: c, pages: { source: 0, translated: 0 } }), b((E) => E.identity === c && E.tick === 0 ? E : { identity: c, tick: 0 }), () => {
    g.current && (clearTimeout(g.current), g.current = null);
  }), [c]);
  const R = G(
    () => Math.max(h.source, h.translated),
    [h]
  ), k = S === "translated" ? h.translated : h.source || h.translated, z = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, F = `${c}-${y}-${z}-${n}-${h.source}-${h.translated}-${D}`;
  return {
    ...v,
    numPagesByPane: h,
    hudNumPages: R,
    primaryNumPages: k,
    metricsTick: y,
    onNumPages: w,
    onMetrics: I,
    rowSyncRevision: F
  };
}
const _e = "data-reader-page", Ke = "data-reader-pane", Cn = "data-natural-height", Hs = "reader-react-root", Ws = "reader-react-grid", mo = "reader-react-scroll-shell", Vs = "reader-react-pdf-pane", ho = "reader-react-pdf-page", Wt = "reader-react-pdf-page-placeholder", xn = "reader-react-pdf-page-slot";
function Vt(e, t) {
  const n = e != null ? `[${_e}="${e}"]` : `[${_e}]`;
  return t ? `${n}[${Ke}="${t}"]` : n;
}
function Ks() {
  return `.${xn}[${_e}]`;
}
function Kt(e) {
  return Number(e.getAttribute(_e));
}
const po = 0.25, Jt = 1, Js = 0.05, _t = 0.5, Gs = 16, qs = 8, Zs = 720;
function Ye() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function go(e) {
  return Number.isFinite(e) && e < Zs;
}
function ct(e, t = Number.POSITIVE_INFINITY) {
  return go(t) && (e === "source" || e === "translated") ? Jt : _t;
}
function Yt(e) {
  return Number.isFinite(e) ? Math.min(Jt, Math.max(po, e)) : _t;
}
function Pt(e, t) {
  const n = Yt(Number(e) + t * Js);
  return Math.round(n * 100) / 100;
}
function Ys(e) {
  return Math.round(Yt(e) * 100);
}
function Xs(e) {
  const n = (Number(e) || 0) - Gs - qs;
  return Math.max(160, Math.floor(n));
}
function Qs(e, t = _t) {
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
const bo = 200, yo = [
  "markdown"
], ri = yo;
function vo(e) {
  return ri.includes(e);
}
const oi = "retainpdf:reader:view:v1:", fr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), ai = /* @__PURE__ */ new Set([
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
function yn(e) {
  return `${e || ""}`.trim();
}
function si({
  documentId: e,
  jobId: t
}) {
  const n = yn(e);
  if (n) return `document:${n}`;
  const r = yn(t);
  return r ? `job:${r}` : "";
}
function So(e) {
  const t = yn(e);
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
  if (!(!fr.has(t) || !fr.has(n) || t === n))
    return { left: t, right: n };
}
function ci(e) {
  return e === null ? null : vo(e) ? e : void 0;
}
function di(e) {
  return ai.has(e) ? e : void 0;
}
function Io(e) {
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
function Ae(e, t = wo()) {
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
  const o = Ae(e, n), a = Io({
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
    return ((m = Ae(n)) == null ? void 0 : m.zoom) ?? ct(e, Ye());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), l = A(((u = Ae(n)) == null ? void 0 : u.zoom) !== void 0);
  x(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Ae(n)) == null ? void 0 : h.zoom;
    l.current = m !== void 0;
    const b = m ?? ct(e, Ye());
    i.current = 1, a.current = b, o(b);
  }, [e, n]), x(() => {
    if (l.current) return;
    const m = ct(e, Ye()), b = a.current;
    Math.abs(m - b) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const c = O((m) => {
    const b = Yt(m), h = a.current;
    Math.abs(b - h) < 5e-4 || (i.current = b / (h || 1), l.current = !0, Xt(s.current, { zoom: b }), o(b));
  }, []), d = O((m) => {
    c(Pt(a.current, m));
  }, [c]), f = O((m) => {
    c(ct(m));
  }, [c]);
  return Ie(() => {
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
function Eo(e, t = zn) {
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
  const s = Eo(e, n), i = Ro(o, s);
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
function mi(e, t, n = "smooth", r) {
  return Tt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function vn(e, t, n) {
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
  return vn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Gt(e, t) {
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
    const f = Vt(void 0, o), u = () => {
      if (l) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = Eo(i), v = Ro(h, y);
      v && s(v.page);
    }, m = () => {
      l || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, u();
      }));
    }, b = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        c = setTimeout(b, 120);
        return;
      }
      u(), i.addEventListener("scroll", m, { passive: !0 });
    };
    return b(), () => {
      l = !0, c && clearTimeout(c), d && cancelAnimationFrame(d), i.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const gi = `canvas, .react-pdf__Page, .${ho}, .${Wt}`, mr = /* @__PURE__ */ new WeakMap();
function bi(e) {
  const t = Number(e.getAttribute(Cn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = mr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(gi), mr.set(e, n)), n) {
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
    const o = Kt(r);
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
  return i.current = r, Ie(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, d = !1, f = !1;
    const u = () => {
      var I;
      if (l) return;
      const w = e.current;
      if (!w) return;
      const g = vi(w);
      yi(s.current, g) || (s.current = g, a(g)), d && !f && (f = !0, (I = i.current) == null || I.call(i));
    }, m = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(u);
      });
    };
    m();
    const b = window.setTimeout(m, 100), h = window.setTimeout(() => {
      d = !0, m();
    }, 300), y = window.setTimeout(m, 700), v = e.current;
    let S = null;
    return v && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => m()), S.observe(v)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(b), window.clearTimeout(h), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Si = [0, 48, 140, 320, 560], Ii = 700, Ei = [80, 200, 400], Ri = 500, Pi = 50, Ti = /* @__PURE__ */ new Set([
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
]), ki = 180, hr = [0, 48, 140, 320, 700, 1200];
function Ni(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((P = Ae(a)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), l = A(null), c = A(!1), d = A(r), f = A(null), u = A(null), m = A(null), b = A(null), h = A(a), y = A(""), v = A(n);
  v.current = n;
  const S = O(() => {
    var T;
    (T = f.current) == null || T.call(f), f.current = null, u.current != null && (clearTimeout(u.current), u.current = null);
  }, []), w = O(() => {
    !c.current && l.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), l.current = null, c.current = !1);
  }, [S]), g = O((T = !1) => {
    b.current != null && (clearTimeout(b.current), b.current = null);
    const M = () => {
      b.current = null, Xt(h.current, {
        anchor: Pe(i.current)
      });
    };
    T ? M() : b.current = setTimeout(M, ki);
  }, []), I = O((T) => {
    i.current = Pe(T), l.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, c.current = !1;
    }, Pi);
  }, []);
  x(() => {
    if (!o)
      return;
    let T = !1, M = null, _ = null, U = null;
    const $ = () => {
      if (T) return;
      const q = e.current;
      if (!q) {
        U = setTimeout($, 50);
        return;
      }
      M = q, _ = () => {
        if (c.current)
          return;
        const te = Bt(M, v.current);
        te && (i.current = te, g());
      }, M.addEventListener("scroll", _, { passive: !0 }), c.current || _();
    };
    return $(), () => {
      T = !0, U != null && clearTimeout(U), M && _ && M.removeEventListener("scroll", _);
    };
  }, [o, r, n, e, g]), x(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const M = (_) => {
      _.metaKey || _.ctrlKey || _.altKey || Ti.has(_.key) && w();
    };
    return T.addEventListener("wheel", w, { passive: !0 }), T.addEventListener("touchmove", w, { passive: !0 }), window.addEventListener("keydown", M), () => {
      T.removeEventListener("wheel", w), T.removeEventListener("touchmove", w), window.removeEventListener("keydown", M);
    };
  }, [o, e, w]), Ie(() => {
    var M;
    if (h.current === a) return;
    g(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const T = (M = Ae(a)) == null ? void 0 : M.anchor;
    i.current = T ? Pe(T) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, d.current = r;
  }, [a, r, g, S]), x(() => {
    var M;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const T = Pe(
      ((M = Ae(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = T, l.current = T, c.current = !0, S(), f.current = vn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: v.current,
        delaysMs: hr,
        onDone: () => I(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(T);
    }, Math.max(...hr) + 160), () => S();
  }, [o, s, a, e, I, S]), x(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      c.current = !1, l.current = null, S();
      return;
    }
    const T = l.current ? Pe(l.current) : Pe(i.current);
    return c.current = !0, l.current = T, i.current = T, S(), f.current = vn(
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
      S();
    };
  }, [r, o, n, e, I, S]), x(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), g(!0);
  }, [S, g]);
  const R = O(() => {
    const T = Bt(
      e.current,
      v.current
    );
    return Pe(T || i.current);
  }, [e]), k = O(() => {
    c.current = !0;
    const T = Bt(
      e.current,
      v.current
    ), M = Pe(T ?? i.current);
    return i.current = M, l.current = M, g(), M;
  }, [e, g]), z = O((T, M, _) => {
    const U = _ || v.current, $ = Gt(T, M || 1), q = { page: $, fraction: 0 };
    i.current = q, c.current = !0, l.current = q, g(), S(), mi(e.current, $, "smooth", U), f.current = hi(
      () => e.current,
      $,
      {
        behavior: "auto",
        pane: U,
        delaysMs: Ei,
        onDone: () => I(q)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(q);
    }, Ri);
  }, [e, I, S, g]), D = O(() => Pe(i.current), []), F = O(() => c.current, []), E = O(() => {
    if (!c.current || !l.current)
      return;
    const T = Pe(l.current);
    Tt(
      e.current,
      T,
      "auto",
      v.current
    );
  }, [e]);
  return {
    lockFromShell: R,
    beginModeSwitch: k,
    goToPage: z,
    getAnchor: D,
    isRestoring: F,
    repinIfRestoring: E
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
function Po(e, t, n) {
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
  const b = A(n);
  b.current = n, x(() => {
    var g, I;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = ts(), y = Mi(h, u.current);
    if (y == null && (h != null && h.blockId) && !d) return;
    const v = Po(h, y, { jobId: l, documentId: c });
    if (t.current === v)
      return;
    if (y == null) {
      t.current = v, (g = b.current) == null || g.call(b);
      return;
    }
    t.current = v, h && ((I = m.current) == null || I.call(m, h, y));
    const S = [];
    let w = 0;
    for (const R of Ai)
      w = Math.max(w, R), S.push(
        setTimeout(() => {
          f.current(y);
        }, R)
      );
    return S.push(
      setTimeout(() => {
        var R;
        (R = b.current) == null || R.call(b);
      }, w + _i)
    ), () => {
      for (const R of S) clearTimeout(R);
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
      var v;
      const b = ((v = globalThis.location) == null ? void 0 : v.search) || "", h = pa(b, o, d.current);
      if (u.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Po(
        { blockId: y },
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
function $i(e, t, n) {
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
const gr = [250, 500, 1e3, 2e3, 4e3], tn = [80, 160, 320, 640, 1e3, 1500], br = [250, 500, 1e3, 2e3, 4e3, 5e3];
function wn(e, t) {
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
function zt(e, t) {
  const n = On(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Bi(e, t, n, r, o) {
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
    const i = tn[Math.min(s, tn.length - 1)];
    if (await wn(i, r), s >= tn.length + 2) throw a;
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
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), d = Et(c) ? c : "";
  return x(() => {
    if (!n || !l) {
      i.current = "", s.current = bt, a(bt);
      return;
    }
    const f = r === void 0 ? es() : r, u = i.current === l;
    if (i.current = l, !f) {
      const w = {
        ...u ? s.current : bt,
        connection: d ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = w, a(w);
      return;
    }
    const m = new AbortController();
    let b = !1;
    const h = {
      ...u ? s.current : bt,
      connection: d ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = h, a(h);
    const y = (w) => {
      m.signal.aborted || a((g) => {
        const I = w(g);
        return s.current = I, I;
      });
    }, v = async () => {
      let w = 0;
      for (; !m.signal.aborted; )
        try {
          const g = await f.fetchLayout(l, { signal: m.signal });
          b = !0, y((I) => ({
            ...I,
            layoutByPage: Oi(g),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError") return;
          const I = On(g);
          if (!(I === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !I)) {
            y((k) => ({
              ...k,
              connection: d ? "terminal" : "unavailable",
              jobStatus: c,
              error: zt(g, "实时译文暂不可用")
            }));
            return;
          }
          if (d) {
            y((k) => ({
              ...k,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          y((k) => ({
            ...k,
            connection: "connecting",
            jobStatus: c,
            error: zt(g, "正在等待 OCR 版面数据")
          })), await wn(gr[Math.min(w, gr.length - 1)], m.signal).catch(() => {
          }), w += 1;
        }
    };
    return (async () => {
      if (await v(), !b || m.signal.aborted) return;
      let w = 0;
      for (; !m.signal.aborted; ) {
        d || y((g) => ({
          ...g,
          connection: g.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: g.error
        }));
        try {
          await f.streamEvents(l, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (g) => {
              if (g.seq <= s.current.lastSeq) return;
              let I;
              try {
                I = await Bi(
                  l,
                  g,
                  s.current,
                  m.signal,
                  f
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || m.signal.aborted) throw R;
                y((k) => ({
                  ...k,
                  lastSeq: Math.max(k.lastSeq, g.seq),
                  error: zt(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((R) => {
                const k = $i(R, g, I);
                return d ? {
                  ...k,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...k,
                  jobStatus: c
                };
              }), w = 0;
            }
          });
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError" || m.signal.aborted) return;
          y((I) => ({
            ...I,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: c,
            error: zt(g, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (d) {
          y((g) => ({
            ...g,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await wn(br[Math.min(w, br.length - 1)], m.signal).catch(() => {
        }), w += 1;
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
    const a = Ge().fetchRevisionGroups;
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
function ko(e) {
  return !!(e.jobId && e.sourceUrl && Ki.has(e.workflow));
}
function Ji(e) {
  return !!(ko(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Gi() {
  const e = zs(), t = ko({
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
  o && !Et(o) && (r.current.running = !0);
  const a = ji({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = Bs(), d = Hi(e.jobId, !e.sourceOnly), f = si({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: b } = ui(e.mode, s, f), h = Us(
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
    beginModeSwitch: y,
    goToPage: v,
    repinIfRestoring: S
  } = Ni(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  x(() => {
    S();
  }, [l, S]);
  const w = wi(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), g = pi(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), I = O(($, q) => {
    var Y, X;
    const te = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Y = h.numPagesByPane) == null ? void 0 : Y.source) || 0,
      Number((X = h.numPagesByPane) == null ? void 0 : X.translated) || 0
    );
    v($, te, q);
  }, [v, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, k] = N(null), z = A(null), D = O(($) => {
    z.current && clearTimeout(z.current), k($), $ && (z.current = setTimeout(() => k(null), Wi));
  }, []);
  x(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const F = O(($) => {
    const q = Qt(e.regions, $);
    return q ? rr(q, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), E = O(($, q) => {
    const te = q || h.primaryPane, Y = typeof $ == "object" && $ ? `${$.block_id || ""}`.trim() : "", X = typeof $ == "object" && $ ? `${$.image_url || ""}`.trim() : "", me = typeof $ == "object" && $ ? $.page_idx != null ? Number($.page_idx) + 1 : $.page != null ? Number($.page) : null : typeof $ == "number" ? $ + 1 : null, ie = ba(e.regions, X, me) || Qt(e.regions, Y) || (typeof $ == "object" ? ya(e.regions, $) : null);
    let le = ie ? rr(ie, te).page : null;
    le == null && (le = Vi($)), !(le == null || le < 1) && (D(ie), I(le, te));
  }, [D, I, h.primaryPane, e.regions]);
  zi({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: g,
    goToPage: I,
    resolveBlockPage: F,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: ($) => {
      D(Qt(e.regions, $.blockId));
    }
  });
  const { setModeKeepingPage: P } = fi({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  x(() => {
    D(null);
  }, [u, D]);
  const T = !e.boot.loading && !e.boot.failed, M = G(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), _ = G(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), U = G(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: b,
    shell: M,
    panes: h,
    sessionFiles: _,
    rowHeights: w,
    goToPage: I,
    activeRegion: R,
    jumpToAnchor: E,
    setModeKeepingPage: P,
    download: e.download,
    showHud: T,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, M, h, _, w, I, R, E, P, T, m, b, f, a, n, d]);
  return G(() => ({
    ...U,
    currentPage: g
  }), [U, g]);
}
const qi = [
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
  for (const n of qi)
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
              l(Gt(s + 1, i));
              return;
            case "prev-page":
              l(Gt(s - 1, i));
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
let yr = !1;
function cl() {
  if (yr)
    return;
  const e = Rt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (co.GlobalWorkerOptions.workerSrc = e, yr = !0);
}
const dl = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function ul(e, t, n) {
  return e.flatMap((r) => {
    if (!dl.has(At(r.region))) return [];
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
const No = "reader-text-hover-tools";
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
const bl = 26, yl = 220;
function vl(e, t = yl) {
  return e.height < bl * 2 || e.width < t;
}
function wl({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? ro : e === "failed" ? pt : Pa, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Sl({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a,
  compact: s = !1,
  tailTop: i = 0
}) {
  const [l, c] = N("idle"), [d, f] = N("idle"), [u] = N(() => gl()), m = A([]), b = (e == null ? void 0 : e.itemId) || "";
  if (x(() => {
    c("idle"), f("idle");
    const I = m.current;
    return () => {
      I.forEach((R) => window.clearTimeout(R)), m.current = [];
    };
  }, [b]), !e) return null;
  const h = va(e.highlight.region, t), y = At(e.highlight.region), v = (I, R) => async (k) => {
    k.preventDefault(), k.stopPropagation();
    const z = await fl(I);
    R(z ? "copied" : "failed"), m.current.push(window.setTimeout(() => R("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", w = o || e.rect, g = a || (vl(w) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: w,
      children: /* @__PURE__ */ L(
        "div",
        {
          className: No,
          "data-placement": g,
          "data-compact": s || void 0,
          style: g === "tail" ? { top: i } : void 0,
          children: [
            u ? /* @__PURE__ */ p(
              nn,
              {
                className: pl,
                state: d,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: v(e.itemId, f),
                children: d === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && n > 0 && !s ? /* @__PURE__ */ L("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            t === "translated" && r ? /* @__PURE__ */ p(
              nn,
              {
                className: hl,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (I) => {
                  I.preventDefault(), I.stopPropagation(), r(e.itemId);
                },
                children: s ? /* @__PURE__ */ p(Dn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 }) : "改"
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              nn,
              {
                className: ml,
                state: l,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: s ? S : void 0,
                onClick: v(h, c),
                children: s ? /* @__PURE__ */ p(wl, { state: l }) : l === "copied" ? "已复制" : l === "failed" ? "复制失败" : S
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
function El(e, t, n, r) {
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
const Rl = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Pl = 256, yt = /* @__PURE__ */ new Map();
function Tl(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Mo(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ja(t, { bareLatex: !0 }), o = Tl(n), a = Ga(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = yt.get(t);
  if (!s && (s = qa(o, r), yt.set(t, s), yt.size > Pl)) {
    const i = yt.keys().next().value;
    i !== void 0 && yt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function rn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ce(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function kl(e, t) {
  const n = e.typography, r = Ce(t) || 1, o = Ce(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = rn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = Ce(n == null ? void 0 : n.fit_min_font_size_pt), d = Ce(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), u = Math.max(
    f,
    d ? d * r : o ? o * r : l
  ), m = o ? o * r : l, b = Ce(n == null ? void 0 : n.leading_em), h = [
    Ce(n == null ? void 0 : n.padding_top_pt) || 0,
    Ce(n == null ? void 0 : n.padding_right_pt) || 0,
    Ce(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ce(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Rl,
    fontSizePx: Math.max(f, Math.min(u, m)),
    minFontSizePx: f,
    maxFontSizePx: u,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: b ? 1 + b : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (rn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : rn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Nl(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const u = s.get(f);
    if (u !== void 0) return u;
    const { width: m, height: b } = e(f), h = m <= t + 0.5 && b <= n + 0.5;
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
let Sn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Sn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Sn += 1;
}));
function Al(e, t, n, r) {
  return [
    Sn,
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
function Ao({ item: e, pageScale: t }) {
  const n = A(null), r = G(
    () => Mo(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = G(
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
  }, [r]), Ie(() => {
    const f = n.current;
    if (!f) return;
    const [u, m, b, h] = s.padding, y = Math.max(1, e.rect.width - h - m), v = Math.max(1, e.rect.height - u - b), S = Al(o, y, v, s);
    let w = vt.get(S);
    if (w === void 0 && (w = Nl(
      (g) => (f.style.fontSize = `${g}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      v,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), vt.set(S, w), vt.size > Ml)) {
      const g = vt.keys().next().value;
      g !== void 0 && vt.delete(g);
    }
    f.style.fontSize = `${w.toFixed(2)}px`;
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
  const o = G(
    () => El(e, t, n, r),
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
        Ao,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Ll = Zt(_l);
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
        Ao,
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
const Cl = Zt(Dl);
function xl(e) {
  return e === "formula" ? 84 : 64;
}
const $n = 24, xe = 24;
function In(e, t) {
  return t ? $n * 2 + 4 : e === "formula" ? 112 : 92;
}
const zl = 6, Ol = 4, $l = 44, Fl = $n * 2 + 4, Bl = 6, Xe = (e) => e.left + e.width, Je = (e) => e.top + e.height;
function wt(e, t) {
  const n = Math.min(Xe(e), Xe(t)) - Math.max(e.left, t.left), r = Math.min(Je(e), Je(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const wr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= Xe(t) && r >= t.top && r <= Je(t);
}, jl = (e) => e.height > 40 && e.height > e.width * 2.5;
function Ul(e, t, n) {
  if (!t.length || e.height < xe || e.width < n + 8) return null;
  const r = Math.max(...t.map(Je)), o = Xe(e) - 4 - n;
  for (const a of [r, Je(e) - 2]) {
    const s = Math.max(e.top, a - xe), i = { left: o, top: s, width: n, height: xe };
    if (!t.some((l) => wt(i, l) > 0)) return s - e.top;
  }
  return null;
}
function Hl(e, t, n) {
  const r = [], o = (a, s = !1) => {
    const i = a ? $n + Ol : xl(t) + zl, l = a ? Fl : $l, c = e.top - 2;
    r.push({ placement: "side-right", compact: a, overhang: s, box: { left: Xe(e), top: c, width: i, height: l } }), r.push({ placement: "side-left", compact: a, overhang: s, box: { left: e.left - i, top: c, width: i, height: l } });
  };
  o(!1), o(!0);
  for (const a of [!1, !0]) {
    const s = In(t, a);
    r.push({ placement: "outside", compact: a, box: { left: e.left - 2, top: e.top - xe - 3, width: s, height: xe + 3 } }), r.push({ placement: "below", compact: a, box: { left: e.left - 2, top: Je(e), width: s, height: xe + 3 } });
  }
  for (const a of [!1, !0]) {
    const s = In(t, a), i = Ul(e, n, s);
    i !== null && r.push({ placement: "tail", compact: a, tailTop: i, box: { left: Xe(e) - 4 - s, top: e.top + i, width: s, height: xe } });
  }
  return o(!0, !0), r;
}
function Wl(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [], kind: s = "text" } = e, i = a.filter((w) => w.width > 0 && w.height > 0 && !jl(w)), l = i.filter((w) => wr(w, t)), c = i.filter((w) => !wr(w, t)), d = n.filter((w) => w !== t && wt(w, t) < t.width * t.height * 0.5), f = Hl(t, s, l).filter(({ box: w, overhang: g }) => {
    const I = g ? Bl : 0;
    return w.left >= -I && Xe(w) <= r + I && w.top >= 0 && Je(w) <= o;
  }), u = ({ placement: w, compact: g, tailTop: I }) => I === void 0 ? { placement: w, compact: g } : { placement: w, compact: g, tailTop: I }, m = ({ box: w }) => !c.some((g) => wt(w, g) > 0), b = f.filter((w) => w.placement !== "tail"), h = b.find((w) => m(w) && !d.some((g) => wt(w.box, g) > 0));
  if (h) return u(h);
  const y = b.find(m) || f.find((w) => w.placement === "tail" && m(w));
  if (y) return u(y);
  let v = null, S = Number.POSITIVE_INFINITY;
  for (const w of f) {
    if (!w.compact) continue;
    const g = c.reduce((I, R) => I + wt(w.box, R), 0);
    g < S && (v = w, S = g);
  }
  return v ? u(v) : { placement: "outside", compact: !0 };
}
function Vl(e, t, n, r) {
  if (!e) return !1;
  const { rect: o, placement: a, compact: s } = e;
  if (a !== "outside" && a !== "below") return !1;
  const i = a === "outside" ? o.top - xe - 3 : Je(o);
  return n >= o.left - 4 && n <= o.left + In(t, s) + 4 && r >= i && r <= i + xe + 3;
}
const on = (e) => e.left + e.width, an = (e) => e.top + e.height;
function Kl(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const d = c.left + c.width / 2, f = c.top + c.height / 2;
    d < e.left || d > on(e) || f < e.top || f > an(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, on(c)), i = Math.max(i, an(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(on(e) + r, s + n) - l.left, l.height = Math.min(an(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function Jl(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Gl(e, t, n, r, o) {
  const [a, s] = N(null);
  return Ie(() => {
    if (!t) {
      s(null);
      return;
    }
    const i = e.current, l = i ? Jl(i) : [], c = l.length ? Kl(t.rect, l) : t.rect, d = n.filter((u) => u.itemId !== t.itemId).map((u) => u.rect), f = (i == null ? void 0 : i.clientHeight) || Number.POSITIVE_INFINITY;
    s({ rect: c, ...Wl({ frame: c, others: d, pageWidth: r, pageHeight: f, glyphs: l, kind: o }) });
  }, [e, o, r, t, n]), a && t ? a : null;
}
const _o = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Sr = { pen: 35e-4, highlighter: 0.018 }, Ir = 0.015, En = "retainpdf.reader.ink.v1:";
function Er(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(En + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function ql(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(En + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(En + e);
    } catch {
    }
}
function Zl(e, t, n, r, o, a) {
  const s = Ir * Ir;
  return e.filter((i) => Lo(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Lo(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Yl(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Xl(e) {
  const [t, n] = N(null), [r, o] = N(_o[0].key), [a, s] = N(() => Er(e)), i = A(a), l = A([]);
  x(() => {
    const h = Er(e);
    i.current = h, s(h), l.current = [];
  }, [e]);
  const c = O((h) => {
    i.current = h, s(h), ql(e, h);
  }, [e]), d = O((h) => {
    const y = i.current, v = h(y);
    v !== y && (l.current = [...l.current.slice(-49), y], c(v));
  }, [c]), f = O((h) => {
    h.points.length < 1 || d((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [d]), u = O((h) => {
    h.length && d((y) => y.filter((v) => !h.includes(v.id)));
  }, [d]), m = O((h) => {
    d((y) => y.some((v) => v.page === h) ? y.filter((v) => v.page !== h) : y);
  }, [d]), b = O(() => {
    const h = l.current.pop();
    h && c(h);
  }, [c]);
  return G(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: u, undo: b, clearPage: m }),
    [t, r, a, f, u, b, m]
  );
}
const Ql = "reader-ink-layer";
function ec(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Rr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: ec(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function tc({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = A(!1), l = o.strokes.filter((h) => Lo(h, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const d = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(Zl(o.strokes, e, t, h, y, r / Math.max(1, n))), u = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, v] = d(h);
    o.tool === "eraser" ? f(y, v) : s([[y, v]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, v] = d(h);
    o.tool === "eraser" ? f(y, v) : s((S) => S ? Yl(S, y, v) : [[y, v]]);
  }, b = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Sr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: Ql,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: u,
      onPointerMove: m,
      onPointerUp: b,
      onPointerCancel: b,
      children: [
        l.map((h) => /* @__PURE__ */ p(Rr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Rr, { stroke: { tool: o.tool, color: o.color, width: Sr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function de(e) {
  return typeof e == "string" ? e : "";
}
function nc(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function rc(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function oc(e) {
  return {
    source: de(e == null ? void 0 : e.source_text) || de(e == null ? void 0 : e.unit_source_text),
    translated: de(e == null ? void 0 : e.protected_translated_text) || de(e == null ? void 0 : e.translated_text)
  };
}
const ac = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Do(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function sc(e) {
  const t = Do(e).sort((r, o) => de(r.ts).localeCompare(de(o.ts)));
  return t.length ? [
    { text: de(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: de(r.new_text),
      label: ac[de(r.source)] || de(r.source) || "修订",
      ts: de(r.ts),
      reason: de(r.reason)
    }))
  ].reverse() : [];
}
function ic(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function lc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return de(r.finished_at) || de(n.finished_at) || "";
}
function cc(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Do(e).sort((a, s) => de(a.ts).localeCompare(de(s.ts)));
  for (const a of o) {
    const s = new Date(de(a.ts)).getTime(), i = de(a.reader_item_id) || de(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, de(a.new_text));
  }
  return n;
}
const dc = {
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
function uc(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = dc[de(n.kind)] || de(n.kind) || "问题", o = de(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const fc = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function mc(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !fc.has(At(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const hc = 300, pc = 72;
function gc(e, t) {
  if (e.width >= hc && e.height >= pc)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
function bc({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, l] = N(!1), [c, d] = N([]), [f, u] = N(""), [m, b] = N(""), [h, y] = N(!1), [v, S] = N(null), [w, g] = N([]), I = r.drafts, R = r.generation, k = O(async (E, P) => {
    if (e)
      try {
        d(sc(await e.fetchRevisions(E, P)));
      } catch {
        d([]);
      }
  }, [e]);
  x(() => {
    if (s(null), d([]), S(null), g([]), b(""), !e || !t || !n) return;
    let E = !1;
    return l(!0), e.loadItem(t, n).then((P) => {
      if (E) return;
      const T = P == null ? void 0 : P.item;
      if (!T) throw new Error("找不到这一段的译文。");
      const M = `${(P == null ? void 0 : P.item_id) || n}`, { source: _, translated: U } = oc(T);
      s({ readerItemId: n, itemId: M, source: _, current: U }), u(I.get(n) ?? U);
    }).catch((P) => {
      E || S({ tone: "error", message: (P == null ? void 0 : P.message) || "读取这段译文失败。" });
    }).finally(() => {
      E || l(!1);
    }), k(t, n), () => {
      E = !0;
    };
  }, [e, t, n, k]);
  const z = O((E) => {
    u(E), n && I.set(n, E);
  }, [n, I]), D = O(async (E, P) => {
    if (!e || !a || h) return !1;
    const T = E ?? f;
    if (!T.trim()) return !1;
    y(!0), S(null), g([]);
    try {
      const M = await e.revise(t, a.itemId, {
        translated_text: T,
        source: "user",
        reason: (P ?? m).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), _ = Number(M == null ? void 0 : M.generation);
      return Number.isFinite(_) && (R.current = _), I.delete(a.readerItemId), s({ ...a, current: T }), u(T), b(""), (M == null ? void 0 : M.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, T), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), k(t, a.readerItemId), !0;
    } catch (M) {
      const _ = M;
      return (_ == null ? void 0 : _.reason) === "generation_mismatch" && (R.current = null), S({ tone: "error", message: (_ == null ? void 0 : _.message) || "保存失败，请稍后再试。" }), g(uc(_ == null ? void 0 : _.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, k, I, R]), F = O(() => {
    n && I.delete(n);
  }, [n, I]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: f,
    setDraft: z,
    reason: m,
    setReason: b,
    saving: h,
    status: v,
    issues: w,
    save: D,
    discardDraft: F
  };
}
const Co = "reader-inline-edit";
function yc({ text: e }) {
  const [t, n] = N("");
  return x(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Mo(e);
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
function vc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var F;
  const s = e.itemId, i = bc({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = N(!1), [d, f] = N(!1), u = A(null), m = gc(e.rect, t), b = G(() => mc(o), [o]), h = b.indexOf(s), { loaded: y } = i, v = i.saving || i.loading, S = n.blockedReason, w = !y || i.draft === y.current, { close: g, select: I } = n, R = O((E) => {
    const P = b[h + E];
    P && (I(P), a == null || a(P));
  }, [b, h, I, a]), k = O(() => {
    i.discardDraft(), g();
  }, [i, g]), z = O(async (E, P) => {
    await i.save(E, P) && g();
  }, [i, g]);
  x(() => {
    const E = (P) => {
      !P.altKey || P.key !== "ArrowUp" && P.key !== "ArrowDown" || (P.preventDefault(), R(P.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", E), () => window.removeEventListener("keydown", E);
  }, [R]), Ie(() => {
    const E = u.current;
    if (!E) return;
    E.style.height = "auto";
    const P = m.mode === "inline" ? m.minHeight : 0;
    E.style.height = `${Math.max(P, E.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const D = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ L(nt, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${Co} is-${m.mode}`,
        style: D,
        role: "group",
        "aria-label": `改第 ${((F = n.target) == null ? void 0 : F.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (E) => E.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            re,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((E) => !E),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            Wa,
            {
              ref: u,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: v || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (E) => i.setDraft(E.target.value),
              onKeyDown: (E) => {
                E.key === "Enter" && (E.metaKey || E.ctrlKey) ? (E.preventDefault(), w || z()) : E.key === "Escape" && (E.preventDefault(), k());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(yc, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ar, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(Ta, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ar, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= b.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(oo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              lo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: v || !!S || !y,
                onChange: (E) => i.setReason(E.target.value),
                onKeyDown: (E) => {
                  E.key === "Enter" ? (E.preventDefault(), w || z()) : E.key === "Escape" && (E.preventDefault(), k());
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
                onClick: () => f((E) => !E),
                children: [
                  /* @__PURE__ */ p(ka, { size: 13, "aria-hidden": !0 }),
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
                disabled: v || !!S || w || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  z();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((E) => /* @__PURE__ */ p("li", { children: E }, E)) }) : null,
          d && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((E, P) => {
            const T = E.text === y.current, M = [ic(E.ts), E.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": E.label, "data-current": T ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  M,
                  T ? "（现在用的）" : "",
                  E.reason ? ` · ${E.reason}` : ""
                ] }),
                T ? null : /* @__PURE__ */ p(
                  re,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: v || !!S,
                    onClick: () => {
                      z(E.text, `回到「${M.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: E.text })
            ] }, `${E.ts}:${P}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const xo = Mn(null), zo = Mn(null);
function wc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(xo.Provider, { value: e, children: /* @__PURE__ */ p(zo.Provider, { value: t, children: n }) });
}
function Oe() {
  return An(xo);
}
function Oo() {
  return An(zo);
}
const We = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Sc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Ic = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Ec = {
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
function Rc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Pr(o ?? a ?? "", Sc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Pr(o ?? a ?? "", Ic)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Ec[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Pc(e) {
  return We(e.translatedBlockText) || We(e.translated.text) || We(e.source.text);
}
const Tc = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function kc(e) {
  const t = [];
  for (const n of e) {
    if (!Tc(n)) continue;
    const r = Rc(Pc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Nc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Mc = 24, Ac = 60;
function Tr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Mc), o = Math.min(e.length, n + t.length + Ac), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function _c(e, t, n = 200) {
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
function Lc(e, t) {
  const n = We(t).toLowerCase();
  if (!n || !e) return Ot(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Ot(e.slice(a, s))}<mark class="reader-find-mark">${Ot(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Ot(e.slice(a));
}
function Dc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const $o = 1.414;
function Cc({
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
  onHoverRegion: b,
  liveTranslationLayout: h,
  liveTranslationPage: y,
  showLiveTranslation: v = r === "source"
}) {
  var Re, ee;
  const S = Oe(), w = S == null ? void 0 : S.revisedBlocks, g = S == null ? void 0 : S.blockEdit, I = g == null ? void 0 : g.pendingEdits, R = S == null ? void 0 : S.editBlock, k = (S == null ? void 0 : S.findTerm) || "", z = G(
    () => k ? ({ str: B }) => Lc(B, k) : void 0,
    [k]
  ), D = A(l ?? $o), [F, E] = N(D.current);
  x(() => {
    l != null && Math.abs(l - D.current) >= 1e-3 && (D.current = l, E(l));
  }, [l]);
  const P = A(d);
  P.current = d;
  const T = A(null), M = A((B) => {
    var j;
    T.current = B, (j = P.current) == null || j.call(P, B);
  }).current, _ = A(null), U = A(`${t}@${n}`);
  Ie(() => {
    const B = `${t}@${n}`;
    U.current !== B && (U.current = B, o && zc(T.current, _.current));
  }, [o, n, t]), x(() => {
    o || sn(_.current);
  }, [o]), x(() => () => sn(_.current), []);
  const $ = Math.max(120, Math.floor(t * F)), q = Math.max($, Math.ceil(s || 0)), te = Ln(f, t, $), Y = G(
    () => ul(u, t, $),
    [$, u, t]
  ), [X, me] = N(null), ie = typeof b == "function", le = ie ? m ?? null : X, he = (B) => {
    ie ? B !== (m ?? null) && (b == null || b(B)) : me((j) => j === B ? j : B);
  }, K = G(
    () => Y.find((B) => B.itemId === le) || null,
    [le, Y]
  ), Q = r === "translated" && ((Re = g == null ? void 0 : g.target) == null ? void 0 : Re.itemId) || "", pe = G(
    () => Q && Y.find((B) => B.itemId === Q) || null,
    [Q, Y]
  ), ue = K ? At(K.highlight.region) : "", fe = Gl(T, o ? K : null, Y, t, ue), $e = (B) => {
    var be, ve, Fe, Be, at;
    if (B.pointerType === "touch") return;
    if ((be = S == null ? void 0 : S.ink) != null && be.tool) {
      he(null);
      return;
    }
    if (B.buttons !== 0) {
      he(null);
      return;
    }
    if ((Fe = (ve = B.target) == null ? void 0 : ve.closest) != null && Fe.call(ve, `.${No}`) || (at = (Be = B.target) == null ? void 0 : Be.closest) != null && at.call(Be, `.${Co}`)) return;
    const j = B.currentTarget.getBoundingClientRect(), H = B.clientX - j.left, ce = B.clientY - j.top;
    if (Vl(fe, ue, H, ce)) return;
    const ae = vr(Y, H, ce);
    he((ae == null ? void 0 : ae.itemId) || null);
  }, Ee = (B) => {
    if (B.pointerType === "mouse") return;
    const j = B.currentTarget.getBoundingClientRect(), H = vr(
      Y,
      B.clientX - j.left,
      B.clientY - j.top
    );
    he((H == null ? void 0 : H.itemId) || null);
  }, ke = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(D.current - B) < 1e-3 || (D.current = B, E(B), c == null || c(e, B));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: M,
      [_e]: e,
      [Ke]: r,
      [Cn]: $,
      className: xn,
      onPointerMoveCapture: $e,
      onPointerDown: Ee,
      onPointerLeave: (B) => {
        B.pointerType === "mouse" && he(null);
      },
      style: {
        width: t,
        height: q,
        minHeight: q
      },
      children: [
        o ? /* @__PURE__ */ p(
          Va,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: z,
            renderAnnotationLayer: !1,
            className: ho,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Wt,
                style: { width: t, height: $ }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const j = B.getViewport({ scale: 1 });
                if (j.width > 0) {
                  const H = j.height / j.width;
                  ke(H);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              sn(_.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: Wt,
            style: { width: t, height: $ },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: _, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        te ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: te,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && v ? /* @__PURE__ */ p(
          Ll,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: $
          }
        ) : null,
        o && r === "translated" && (I != null && I.size) ? /* @__PURE__ */ p(Cl, { targets: Y, edits: I, width: t, excludeId: pe == null ? void 0 : pe.itemId }) : null,
        o && pe && g ? /* @__PURE__ */ p(
          vc,
          {
            target: pe,
            page: { width: t, height: $ },
            edit: g,
            showSource: !!(S != null && S.editShowsSource),
            regions: S == null ? void 0 : S.regions,
            jumpToBlock: S == null ? void 0 : S.jumpToBlock
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
        o && (S != null && S.ink) ? /* @__PURE__ */ p(
          tc,
          {
            page: e,
            pane: r === "translated" ? "translated" : S.compareVersion ? "compare" : "source",
            width: t,
            height: $,
            ink: S.ink
          }
        ) : null,
        /* @__PURE__ */ p(
          Sl,
          {
            target: o && !((ee = S == null ? void 0 : S.ink) != null && ee.tool) && (K == null ? void 0 : K.itemId) !== (pe == null ? void 0 : pe.itemId) ? K : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: K && (w == null ? void 0 : w.get(K.itemId)) || 0,
            onEdit: R,
            frameRect: fe == null ? void 0 : fe.rect,
            placement: fe == null ? void 0 : fe.placement,
            compact: fe == null ? void 0 : fe.compact,
            tailTop: fe == null ? void 0 : fe.tailTop
          }
        )
      ]
    }
  );
}
const xc = Zt(Cc);
function zc(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function sn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Oc = 2 * 1024 * 1024;
function $c(e) {
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
const ln = 5, Fc = "120% 0px", Bc = 120, jc = "25% 0px";
let kr = 1;
const Nr = /* @__PURE__ */ new WeakMap();
function Uc(e) {
  if (!e) return 0;
  const t = Nr.get(e);
  if (t) return t;
  const n = kr;
  return kr += 1, Nr.set(e, n), n;
}
function Hc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Wc = Qr(
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
    activeRegion: b = null,
    regions: h = [],
    readerMetadata: y = null,
    hoveredRegionId: v = null,
    onHoverRegion: S,
    liveTranslation: w,
    showLiveTranslation: g = t === "source",
    liveTranslationPendingLabel: I = "",
    paneAction: R
  }, k) {
    cl();
    const { file: z, loading: D, error: F } = As(n, r), E = `${n}\0${Uc(z)}`, P = A(E);
    P.current = E;
    const T = G(() => {
      const C = Rs(z);
      return C ? "ranged" in C ? { range: $c(C.ranged) } : C : null;
    }, [z, n]), [M, _] = N(0), [U, $] = N(""), [q, te] = N(null), [Y, X] = N(480), me = A(null), ie = A(0), le = G(() => Hc(), []), he = G(() => ({
      cMapUrl: Rt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Rt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Oc,
      disableAutoFetch: !0
    }), []);
    _n(k, () => q, [q]), x(() => {
      const C = (W) => {
        ie.current = W, X(W);
      }, J = (W) => {
        const oe = ni(W, ie.current);
        if (oe !== "ignore") {
          if (me.current && clearTimeout(me.current), oe === "immediate") {
            C(W);
            return;
          }
          me.current = setTimeout(() => C(W), bo);
        }
      }, V = !!(l && l >= 80);
      J(V ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const se = !V && i && typeof ResizeObserver < "u" ? new ResizeObserver((W) => {
        var oe, ge;
        J(((ge = (oe = W[0]) == null ? void 0 : oe.contentRect) == null ? void 0 : ge.width) ?? i.clientWidth);
      }) : null;
      return se && i && se.observe(i), () => {
        se == null || se.disconnect(), me.current && clearTimeout(me.current);
      };
    }, [l, i, a]);
    const K = G(
      () => Qs(Y, o),
      [Y, o]
    ), [Q, pe] = N(() => /* @__PURE__ */ new Map()), [ue, fe] = N(() => /* @__PURE__ */ new Set()), [$e, Ee] = N(() => /* @__PURE__ */ new Set()), ke = A(/* @__PURE__ */ new Map()), Re = A(null), ee = A(null), [B, j] = N(() => /* @__PURE__ */ new Set()), H = A(/* @__PURE__ */ new Map()), ce = O((C, J) => {
      pe((V) => {
        if (V.get(C) === J) return V;
        const Z = new Map(V);
        return Z.set(C, J), Z;
      });
    }, []), ae = O((C, J) => {
      const V = ke.current, Z = V.get(C), se = [Re.current, ee.current];
      if (Z)
        for (const W of se)
          try {
            W == null || W.unobserve(Z);
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
    }, []), be = A(/* @__PURE__ */ new Map()), ve = O((C) => {
      const J = be.current;
      let V = J.get(C);
      return V || (V = (Z) => ae(C, Z), J.set(C, V)), V;
    }, [ae]);
    x(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = H.current, J = new IntersectionObserver(
        (V) => {
          const Z = [], se = [];
          for (const W of V) {
            const oe = W.target, ge = Kt(oe);
            Number.isFinite(ge) && (W.isIntersecting ? Z : se).push(ge);
          }
          if ((Z.length || se.length) && fe((W) => {
            let oe = null;
            for (const ge of Z)
              W.has(ge) || (oe = oe || new Set(W), oe.add(ge));
            for (const ge of se)
              W.has(ge) && (oe = oe || new Set(W), oe.delete(ge));
            return oe || W;
          }), Z.length) {
            for (const W of Z) {
              const oe = C.get(W);
              oe && (clearTimeout(oe), C.delete(W));
            }
            Ee((W) => {
              let oe = null;
              for (const ge of Z)
                W.has(ge) || (oe = oe || new Set(W), oe.add(ge));
              return oe || W;
            });
          }
          for (const W of se)
            C.has(W) || C.set(W, setTimeout(() => {
              C.delete(W), Ee((oe) => {
                if (!oe.has(W)) return oe;
                const ge = new Set(oe);
                return ge.delete(W), ge;
              });
            }, Bc));
        },
        { root: i, rootMargin: Fc, threshold: 0 }
      );
      Re.current = J;
      for (const V of ke.current.values())
        try {
          J.observe(V);
        } catch {
        }
      return () => {
        J.disconnect(), Re.current === J && (Re.current = null);
        for (const V of C.values()) clearTimeout(V);
        C.clear();
      };
    }, [i]), x(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = new IntersectionObserver(
        (J) => {
          j((V) => {
            let Z = null;
            for (const se of J) {
              const W = Kt(se.target);
              !Number.isFinite(W) || se.isIntersecting === V.has(W) || (Z = Z || new Set(V), se.isIntersecting ? Z.add(W) : Z.delete(W));
            }
            return Z || V;
          });
        },
        { root: i, rootMargin: jc, threshold: 0 }
      );
      ee.current = C;
      for (const J of ke.current.values())
        try {
          C.observe(J);
        } catch {
        }
      return () => {
        C.disconnect(), ee.current === C && (ee.current = null);
      };
    }, [i]);
    const Fe = !!i && typeof IntersectionObserver < "u";
    Ie(() => {
      _(0), $(""), fe(/* @__PURE__ */ new Set()), Ee(/* @__PURE__ */ new Set()), pe(/* @__PURE__ */ new Map()), ke.current.clear();
      const C = H.current;
      for (const J of C.values()) clearTimeout(J);
      C.clear(), m == null || m(0, t);
    }, [E, m, t]);
    const Be = O(
      ({ numPages: C }) => {
        P.current === E && (_(C), $(""), m == null || m(C, t), f == null || f({ numPages: C, pane: t }));
      },
      [E, f, m, t]
    ), at = O(
      (C) => {
        if (P.current !== E) return;
        const J = (C == null ? void 0 : C.message) || "PDF 解析失败";
        $(J), _(0), m == null || m(0, t), u == null || u(C, t);
      },
      [E, u, m, t]
    ), je = G(
      () => M > 0 ? Array.from({ length: M }, (C, J) => J + 1) : [],
      [M]
    );
    x(() => {
      typeof IntersectionObserver < "u" || Ee(new Set(je));
    }, [je]);
    const Ue = G(
      () => or(b, y, t),
      [b, y, t]
    ), qe = G(() => {
      const C = /* @__PURE__ */ new Map();
      for (const J of h) {
        const V = or(J, y, t);
        if (!V) continue;
        const Z = C.get(V.box.page) || [];
        Z.push(V), C.set(V.box.page, Z);
      }
      return C;
    }, [t, y, h]), Lt = G(() => {
      const C = /* @__PURE__ */ new Set();
      if (!v) return C;
      for (const [J, V] of qe)
        V.some((Z) => Z.itemId === v) && C.add(J);
      return C;
    }, [v, qe]), Dt = G(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(je);
      if (ue.size === 0) {
        const V = Math.min(M, ln * 2 + 1);
        return new Set(Array.from({ length: V }, (Z, se) => se + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const V of ue)
        for (let Z = -ln; Z <= ln; Z++) {
          const se = V + Z;
          se >= 1 && se <= M && J.add(se);
        }
      return J;
    }, [M, je, i, a, ue]), st = !n || !!F || !!U, Ct = n && (F || U) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: te,
        className: `reader-panel ${Vs}${a ? "" : " is-hidden"}`,
        [Ke]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (w == null ? void 0 : w.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          R ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: R }) : null,
          I ? /* @__PURE__ */ L("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: I })
          ] }) : null,
          st && !D ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Ct }) : null,
          D ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !F ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Ka,
            {
              file: T,
              loading: null,
              error: null,
              options: he,
              onLoadSuccess: Be,
              onLoadError: at,
              className: "reader-react-pdf-document",
              children: je.map((C) => {
                if (Dt.has(C))
                  return /* @__PURE__ */ p(
                    xc,
                    {
                      pane: t,
                      pageNumber: C,
                      width: K,
                      devicePixelRatio: le,
                      active: $e.has(C),
                      textLayer: !Fe || B.has(C),
                      syncedMinHeight: (c == null ? void 0 : c.get(C)) || 0,
                      onMetrics: d,
                      cachedAspect: Q.get(C),
                      onAspectChange: ce,
                      sentinelRef: ve(C),
                      regionHighlight: (Ue == null ? void 0 : Ue.box.page) === C ? Ue : null,
                      regionTargets: qe.get(C),
                      hoveredRegionId: v && Lt.has(C) ? v : null,
                      onHoverRegion: S,
                      liveTranslationLayout: w == null ? void 0 : w.layoutByPage.get(C - 1),
                      liveTranslationPage: w == null ? void 0 : w.pagesByPage.get(C - 1),
                      showLiveTranslation: g
                    },
                    `${t}-${C}`
                  );
                const V = Q.get(C) ?? $o, Z = Math.max(120, Math.floor(K * V)), se = Math.max(Z, Math.ceil((c == null ? void 0 : c.get(C)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: ve(C),
                    [_e]: C,
                    [Ke]: t,
                    [Cn]: Z,
                    className: `${xn} is-placeholder`,
                    style: {
                      width: K,
                      height: se,
                      minHeight: se
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: Wt,
                        style: { width: K, height: Z },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${C}`
                );
              })
            },
            E
          ) }) : null
        ]
      }
    );
  }
), Mr = Zt(Wc), Vc = 2e3, Kc = 6, Jc = 500, Ar = "reader-react-resizing";
function Gc(e, t) {
  const n = A(null), r = A(null);
  Ie(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const g = qc(e), I = Bt(e, g);
      if (!I) return;
      s = { pane: g, progress: I, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let d = 0, f = null, u = e.scrollHeight, m = u, b = 0, h = c;
    const y = /* @__PURE__ */ new WeakMap(), v = typeof ResizeObserver > "u" ? null : new ResizeObserver((g) => {
      let I = !1;
      for (const R of g) {
        const k = Math.round(R.contentRect.height);
        y.has(R.target) && y.get(R.target) !== k && (I = !0), y.set(R.target, k);
      }
      I && Tt(e, l, "auto", i);
    }), S = () => {
      var g;
      f && clearTimeout(f), cancelAnimationFrame(d), v == null || v.disconnect(), e.classList.remove(Ar);
      for (const I of _r) e.removeEventListener(I, S);
      ((g = r.current) == null ? void 0 : g.stop) === S && (r.current = null);
    }, w = () => {
      Tt(e, l, "auto", i);
      const g = e.scrollHeight;
      b = g === m ? b + 1 : 0, m = g;
      const I = performance.now() - h;
      b >= Kc && (g !== u || I > Jc) || I > Vc ? S() : d = requestAnimationFrame(w);
    };
    for (const g of _r) e.addEventListener(g, S, { passive: !0 });
    for (const g of Array.from(e.children)) v == null || v.observe(g);
    e.classList.add(Ar), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), u = e.scrollHeight, m = u, b = 0, d = requestAnimationFrame(w);
    }, bo);
  }, [e, t]), x(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function qc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${_e}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ke) || null;
  }
  return null;
}
const _r = ["wheel", "touchstart", "keydown", "pointerdown"];
function Fo(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Zc(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Yc({ compare: e, onDone: t }) {
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Fo(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(ro, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Na, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
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
            /* @__PURE__ */ p(Ma, { size: 13, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(Aa, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Lr({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Zc(t), a = [e === "compare" ? "对比" : "正在读", r, Fo(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Xc({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return Ie(() => {
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
const Qc = () => () => {
}, Dr = () => null;
function ed({
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
function td(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function nd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function rd(e) {
  const t = Oe(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? _t, b = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, v = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, w = (t == null ? void 0 : t.compareVersion) ?? null, g = (w == null ? void 0 : w.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", I = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = w ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, z = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), D = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), F = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], P = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [M, _] = N(null), U = eo(
    T ? T.subscribe : Qc,
    T ? () => T.get().itemId : Dr,
    T ? () => T.get().itemId : Dr
  ), $ = T ? U : M, q = O((me) => {
    T ? T.set(me, "pdf") : _(me);
  }, [T]), te = ed({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: d
  }), X = Number.isFinite(b) && b > 0 ? td(
    b,
    n || r,
    typeof document > "u" ? b * 2 : document.documentElement.clientWidth
  ) : null;
  return Gc(u, X), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: mo,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(wa).length,
      "data-reader-metadata-ready": P ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${Ws} reader-mode-${te.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Mr,
                {
                  pane: "source",
                  url: g,
                  preloadedFile: R,
                  userZoom: m,
                  visible: te.showSource,
                  scrollRoot: u,
                  pageWidthOverride: X,
                  rowHeights: te.compareMode ? h : void 0,
                  onMetrics: z,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: D,
                  activeRegion: F,
                  regions: (w == null ? void 0 : w.regions) ?? E,
                  readerMetadata: P,
                  hoveredRegionId: $,
                  onHoverRegion: q,
                  liveTranslation: d ? o : void 0,
                  showLiveTranslation: d,
                  liveTranslationPendingLabel: d ? nd(o) : "",
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
                w ? `compare:${w.url}` : "source"
              ) : null,
              v ? /* @__PURE__ */ p(
                Mr,
                {
                  pane: "translated",
                  url: I,
                  preloadedFile: k,
                  userZoom: m,
                  visible: te.showTranslated,
                  scrollRoot: u,
                  pageWidthOverride: X,
                  rowHeights: te.compareMode ? h : void 0,
                  onMetrics: z,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: D,
                  activeRegion: F,
                  regions: E,
                  readerMetadata: P,
                  hoveredRegionId: $,
                  onHoverRegion: q,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        w ? /* @__PURE__ */ p(Xc, { shellEl: u, left: w.left, right: w.right }) : null
      ]
    }
  );
}
const od = [
  { id: "source", label: "原文", Icon: ao },
  { id: "compare", label: "对照", Icon: so },
  { id: "translated", label: "译文", Icon: io }
];
function ad(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function sd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function id(e) {
  const t = Oe(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, i = a ? ad(a.state) : "";
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
    /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: od.map(({ id: l, label: c, Icon: d }) => {
      const f = n === l, u = sd({
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
const ld = Qr(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), cd = ld, dd = {
  markdown: { label: "Markdown", short: "MD", Icon: cd, needsJob: !0 }
}, ud = yo.map(
  (e) => ({ id: e, ...dd[e] })
);
function Bo() {
  return ud.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function fd(e) {
  const t = Oe(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
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
function md(e) {
  const t = Oe(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
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
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: d, disabled: f, selected: u, badge: m, onClick: b }) => /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": u,
        className: `reader-assistant-dock-tab${u ? " is-active" : ""}`,
        title: f ? `${c} 需打开任务阅读` : c,
        disabled: f,
        onClick: b,
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
function hd(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function pd(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function gd(e) {
  return e / 100 * window.innerHeight;
}
function bd(e) {
  return e / 100 * window.innerWidth;
}
function yd(e) {
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
  const [o, a] = yd(n);
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
      r = pd(t, o);
      break;
    }
    case "em": {
      r = hd(t, o);
      break;
    }
    case "vh": {
      r = gd(o);
      break;
    }
    case "vw": {
      r = bd(o);
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
function Rn(e) {
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
    e === "horizontal" ? vd : wd
  );
}
function vd(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function wd(e, t) {
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
function Sd({
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
  return ne(o, "No rect found"), o;
}
let $t;
function Id() {
  return $t === void 0 && (typeof matchMedia == "function" ? $t = !!matchMedia("(pointer:coarse)").matches : $t = !1), $t;
}
function Ho(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Pn(
    n,
    Array.from(t.children).filter(jo).map((b) => ({ element: b }))
  ).map(({ element: b }) => b), s = [];
  let i = !1, l = !1, c = -1, d = -1, f = 0, u, m = [];
  {
    let b = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (b++, h.hasAttribute("data-disabled") || (f++, c === -1 && (c = b), d = b));
  }
  if (f > 1) {
    let b = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        b++;
        const y = r.find(
          (v) => v.element === h
        );
        if (y) {
          if (u) {
            const v = u.element.getBoundingClientRect(), S = h.getBoundingClientRect();
            let w;
            if (l) {
              const g = n === "horizontal" ? new DOMRect(
                v.right,
                v.top,
                0,
                v.height
              ) : new DOMRect(
                v.left,
                v.bottom,
                v.width,
                0
              ), I = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (m.length) {
                case 0: {
                  w = [
                    g,
                    I
                  ];
                  break;
                }
                case 1: {
                  const R = m[0], k = Sd({
                    orientation: n,
                    rects: [v, S],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  w = [
                    R,
                    k === v ? I : g
                  ];
                  break;
                }
                default: {
                  w = m;
                  break;
                }
              }
            } else
              m.length ? w = m : w = [
                n === "horizontal" ? new DOMRect(
                  v.right,
                  S.top,
                  S.left - v.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  v.bottom,
                  S.width,
                  S.top - v.bottom
                )
              ];
            for (const g of w) {
              let I = "width" in g ? g : g.element.getBoundingClientRect();
              const R = Id() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (I.width < R) {
                const z = R - I.width;
                I = new DOMRect(
                  I.x - z / 2,
                  I.y,
                  I.width + z,
                  I.height
                );
              }
              if (I.height < R) {
                const z = R - I.height;
                I = new DOMRect(
                  I.x,
                  I.y - z / 2,
                  I.width,
                  I.height + z
                );
              }
              const k = b <= c || b > d;
              !i && !k && s.push({
                group: e,
                groupSize: mt({ group: e }),
                panels: [u, y],
                separator: "width" in g ? void 0 : g,
                rect: I
              }), i = !1;
            }
          }
          l = !1, u = y, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (v) => v.element === h
        );
        y ? m.push(y) : (u = void 0, m = []);
      } else
        l = !0;
  }
  return s;
}
var He;
class Wo {
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
const Fn = new Wo();
function Qe() {
  return ut;
}
function Ed(e) {
  return Fn.addListener("change", e);
}
function Rd(e) {
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
const Pd = (e) => e, cn = () => {
}, Vo = 1, Ko = 2, Jo = 4, Go = 8, Cr = 3, xr = 12;
let Ft;
function zr() {
  return Ft === void 0 && (Ft = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Ft = !0)), Ft;
}
function Td({
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
          const a = (e & Vo) !== 0, s = (e & Ko) !== 0, i = (e & Jo) !== 0, l = (e & Go) !== 0;
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
      const o = Td({
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
let Me = /* @__PURE__ */ new Map();
const qo = new Wo();
function kd(e) {
  Me = new Map(Me), Me.delete(e);
}
function $r(e, t) {
  for (const [n] of Me)
    if (n.id === e)
      return n;
}
function Ve(e, t) {
  for (const [n, r] of Me)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function rt() {
  return Me;
}
function jn(e, t) {
  return qo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function ze(e, t, n) {
  const r = Me.get(e);
  Me = new Map(Me), Me.set(e, t), qo.emit("groupChange", {
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
      }), t.hitRegions.length > 0 && (Bn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Ve(r.group.id, !0);
        ze(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Fr(e) {
  e.defaultPrevented || Zo(e.currentTarget);
}
function Nd(e, t, n) {
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
function Md(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Ad(e, t) {
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
const _d = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Ld(e) {
  const t = getComputedStyle(Yo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Dd(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Ld(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || _d.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Br(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ne(n, "Missing node"), Dd(n)) return n;
  }
  return null;
}
function jr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Ur(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Yo(e);
  return t;
}
function Yo(e) {
  const { parentNode: t } = e;
  return Md(t) ? t.host : t;
}
function Cd(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function xd({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!jo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Ad(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Cd(r.getBoundingClientRect(), t))
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
    const a = Ho(o), s = Nd(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && xd({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function zd(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function ye(e, t, n = 0) {
  return Math.abs(we(e) - we(t)) <= n;
}
function Ne(e, t) {
  return ye(e, t) ? 0 : e > t ? 1 : -1;
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
  if (Ne(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      Ne(r, c) < 0 ? r = o : r = l;
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
  if (ye(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), l = Object.values(o), c = [...i], [d, f] = r;
  ne(d != null, "Invalid first pivot index"), ne(f != null, "Invalid second pivot index");
  let u = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : d, y = n[h];
        ne(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: S,
          minSize: w = 0
        } = y;
        if (S) {
          const g = i[h];
          if (ne(
            g != null,
            `Previous layout not found for panel index ${h}`
          ), ye(g, v)) {
            const I = w - g;
            Ne(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      {
        const h = e < 0 ? d : f, y = n[h];
        ne(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: S,
          minSize: w = 0
        } = y;
        if (S) {
          const g = i[h];
          if (ne(
            g != null,
            `Previous layout not found for panel index ${h}`
          ), ye(g, w)) {
            const I = g - v;
            Ne(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : d, y = n[h];
      ne(
        y,
        `Panel constraints not found for index ${h}`
      );
      const v = i[h], { collapsible: S, collapsedSize: w, minSize: g } = y;
      if (S && Ne(v, g) < 0)
        if (e > 0) {
          const I = g - w, R = I / 2, k = v + e;
          Ne(k, g) < 0 && (e = Ne(e, R) <= 0 ? 0 : I);
        } else {
          const I = g - w, R = 100 - I / 2, k = v - e;
          Ne(k, g) < 0 && (e = Ne(100 + e, R) > 0 ? 0 : -I);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : d, v = 0;
    for (; ; ) {
      const w = i[y];
      ne(
        w != null,
        `Previous layout not found for panel index ${y}`
      );
      const g = dt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: w,
        size: 100
      }) - w;
      if (v += g, y += h, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(v));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? d : f;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(u), v = i[h];
      ne(
        v != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = v - y, w = dt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: v,
        size: S
      });
      if (!ye(v, w) && (u += v - w, c[h] = w, u.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (zd(l, c))
    return o;
  {
    const h = e < 0 ? f : d, y = i[h];
    ne(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const v = y + u, S = dt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: v
    });
    if (c[h] = S, !ye(S, v)) {
      let w = v - S, g = e < 0 ? f : d;
      for (; g >= 0 && g < n.length; ) {
        const I = c[g];
        ne(
          I != null,
          `Previous layout not found for panel index ${g}`
        );
        const R = I + w, k = dt({
          overrideDisabledPanels: s,
          panelConstraints: n[g],
          prevSize: I,
          size: R
        });
        if (ye(I, k) || (w -= k - I, c[g] = k), ye(w, 0))
          break;
        e > 0 ? g-- : g++;
      }
    }
  }
  const m = Object.values(c).reduce(
    (h, y) => y + h,
    0
  );
  if (!ye(m, 100, 0.1))
    return o;
  const b = Object.keys(o);
  return c.reduce((h, y, v) => (h[b[v]] = y, h), {});
}
function et(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ne(e[n], t[n]) !== 0)
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
  if (!ye(o, 100) && r.length > 0)
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
  if (!ye(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      ne(l != null, `No layout data found for index ${i}`);
      const c = l + a, d = dt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== d && (a -= d - l, r[i] = d, ye(a, 0)))
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
        separatorToPanels: b
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: f,
          group: c,
          groupSize: m,
          layout: u,
          separatorToPanels: b
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
    const u = a(), m = c.findIndex((y) => y.id === t), b = m === 0, h = m === c.length - 1;
    if (h && l < u && (b || c.slice(0, m).every((y, v) => {
      const S = f[v];
      return (S == null ? void 0 : S.collapsible) && ye(S.collapsedSize, d[S.panelId]);
    }))) {
      const y = c.slice(0, m).reduce((v, S) => v + d[S.id], 0);
      return {
        ...d,
        [t]: we(100 - y)
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
      layout: b,
      separatorToPanels: h
    } = n(), y = s({
      nextSize: l,
      panels: u.panels,
      prevLayout: b,
      derivedPanelConstraints: f
    }), v = tt({
      layout: y,
      panelConstraints: f
    });
    et(b, v) || ze(u, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: f,
      groupSize: m,
      layout: v,
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
      return l && ye(c, d);
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
        const o = r.panelConstraints.defaultSize, a = Xo({
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
      return r ? i : (et(i, c) || ze(a, {
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
  et(i, c) || ze(
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
    const { group: d, groupSize: f } = c, { orientation: u, panels: m } = d, { disableCursor: b } = d.mutableState;
    let h = 0;
    a ? u === "horizontal" ? h = (t.clientX - a.x) / f * 100 : h = (t.clientY - a.y) / f * 100 : u === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const y = r.get(d), v = o.get(d);
    if (!y || !v)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: w,
      groupSize: g,
      layout: I,
      separatorToPanels: R
    } = v;
    if (w && I && R) {
      const k = kt({
        delta: h,
        initialLayout: y,
        panelConstraints: w,
        pivotIndices: c.panels.map((z) => m.indexOf(z)),
        prevLayout: I,
        trigger: "mouse-or-touch"
      });
      if (et(k, I)) {
        if (h !== 0 && !b)
          switch (u) {
            case "horizontal": {
              i |= h < 0 ? Vo : Ko;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Jo : Go;
              break;
            }
          }
      } else
        ze(c.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: w,
          groupSize: g,
          layout: k,
          separatorToPanels: R
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & Cr : l |= i & Cr, t.movementY === 0 ? l |= s & xr : l |= i & xr, Rd(l), Bn(e);
}
function Kr(e) {
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
          ze(a.group, s, {
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
function Gr(e) {
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
function Od(e, t, n) {
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
function $d(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Fd({
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
        const m = u / 100 * n, b = we(
          m / t * 100
        );
        i.set(f.id, b), o += b;
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
function Bd(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const it = /* @__PURE__ */ new Map();
function jd(e) {
  let t = !0;
  ne(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((b) => {
    for (const h of b) {
      const { borderBoxSize: y, target: v } = h;
      if (v === e.element) {
        if (t) {
          const S = mt({ group: e });
          if (S === 0)
            return;
          const w = Ve(e.id);
          if (!w)
            return;
          const g = Rn(e), I = w.defaultLayoutDeferred ? Zr(g) : w.layout, R = Fd({
            group: e,
            nextGroupSize: S,
            prevGroupSize: w.groupSize,
            prevLayout: I
          }), k = tt({
            layout: R,
            panelConstraints: g
          });
          if (!w.defaultLayoutDeferred && et(w.layout, k) && $d(
            w.derivedPanelConstraints,
            g
          ) && w.groupSize === S)
            return;
          ze(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: g,
            groupSize: S,
            layout: k,
            separatorToPanels: w.separatorToPanels
          });
        }
      } else
        Od(e, v, y);
    }
  });
  a.observe(e.element), e.panels.forEach((b) => {
    ne(
      !r.has(b.id),
      `Panel ids must be unique; id "${b.id}" was used more than once`
    ), r.add(b.id), b.onResize && a.observe(b.element);
  });
  const s = mt({ group: e }), i = Rn(e), l = e.panels.map(({ id: b }) => b).join(",");
  let c = e.mutableState.defaultLayout;
  c && (Bd(e.panels, c) || (c = void 0));
  const d = e.mutableState.layouts[l] ?? c ?? Zr(i), f = tt({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  it.set(
    u,
    (it.get(u) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Ho(e).forEach((b) => {
    b.separator && m.set(b.separator, b.panels);
  }), ze(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((b) => {
    ne(
      !o.has(b.id),
      `Separator ids must be unique; id "${b.id}" was used more than once`
    ), o.add(b.id), b.element.addEventListener("keydown", Wr);
  }), it.get(u) === 1 && (u.addEventListener("contextmenu", Fr, !0), u.addEventListener("dblclick", Hr, !0), u.addEventListener("pointerdown", Vr, !0), u.addEventListener("pointerleave", Kr), u.addEventListener("pointermove", Jr), u.addEventListener("pointerout", Gr), u.addEventListener("pointerup", qr, !0)), function() {
    t = !1, it.set(
      u,
      Math.max(0, (it.get(u) ?? 0) - 1)
    ), kd(e), e.separators.forEach((b) => {
      b.element.removeEventListener("keydown", Wr);
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
    ), u.removeEventListener("pointerleave", Kr), u.removeEventListener("pointermove", Jr), u.removeEventListener("pointerout", Gr), u.removeEventListener("pointerup", qr, !0)), a.disconnect();
  };
}
function Ud() {
  const [e, t] = N({}), n = O(() => t({}), []);
  return [e, n];
}
function Hn(e) {
  const t = to();
  return `${e ?? t}`;
}
const ot = typeof window < "u" ? Ie : x;
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
const ta = Mn(null);
function Hd(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: Pd
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
  const b = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = It((E) => {
    et(b.current.onLayoutChange, E) || (b.current.onLayoutChange = E, l == null || l(E));
  }), y = It(
    (E, P) => {
      et(b.current.onLayoutChanged, E) || (b.current.onLayoutChanged = E, c == null || c(E, { isUserInteraction: P }));
    }
  ), v = Hn(i), S = A(null), [w, g] = Ud(), I = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), R = Wn(S, a);
  Hd(v, s);
  const k = It(
    (E, P) => {
      const T = Qe(), M = $r(E), _ = Ve(E);
      if (_) {
        let U = !1;
        switch (T.state) {
          case "active": {
            U = T.hitRegions.some(
              ($) => $.group === M
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
  ), z = Vn({
    defaultLayout: n,
    disableCursor: r
  }), D = G(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: k,
      id: v,
      orientation: d,
      registerPanel: (E) => {
        const P = I.current;
        return P.panels = Pn(d, [
          ...P.panels,
          E
        ]), g(), () => {
          P.panels = P.panels.filter(
            (T) => T !== E
          ), g();
        };
      },
      registerSeparator: (E) => {
        const P = I.current;
        return P.separators = Pn(d, [
          ...P.separators,
          E
        ]), g(), () => {
          P.separators = P.separators.filter(
            (T) => T !== E
          ), g();
        };
      },
      updatePanelProps: (E, { disabled: P }) => {
        const T = I.current.panels.find(
          (U) => U.id === E
        );
        T && (T.panelConstraints.disabled = P);
        const M = $r(v), _ = Ve(v);
        M && _ && ze(M, {
          ..._,
          derivedPanelConstraints: Rn(M)
        });
      },
      updateSeparatorProps: (E, {
        disabled: P,
        disableDoubleClick: T
      }) => {
        const M = I.current.separators.find(
          (_) => _.id === E
        );
        M && (M.disabled = P, M.disableDoubleClick = T);
      }
    }),
    [k, v, g, d, z]
  ), F = A(null);
  return ot(() => {
    const E = S.current;
    if (E === null)
      return;
    const P = I.current;
    let T;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === P.panels.length) {
      T = {};
      for (const Y of P.panels) {
        const X = z.defaultLayout[Y.id];
        X !== void 0 && (T[Y.id] = X);
      }
    }
    const M = {
      disabled: !!o,
      element: E,
      id: v,
      mutableState: {
        defaultLayout: T,
        disableCursor: !!z.disableCursor,
        expandedPanelSizes: I.current.lastExpandedPanelSizes,
        layouts: I.current.layouts
      },
      orientation: d,
      panels: P.panels,
      resizeTargetMinimumSize: P.resizeTargetMinimumSize,
      separators: P.separators
    };
    F.current = M;
    const _ = jd(M), { defaultLayoutDeferred: U, derivedPanelConstraints: $, layout: q } = Ve(M.id, !0);
    !U && $.length > 0 && (h(q), y(q, !1));
    const te = jn(v, (Y) => {
      const { defaultLayoutDeferred: X, derivedPanelConstraints: me, layout: ie } = Y.next;
      if (X || me.length === 0)
        return;
      const le = M.panels.map(({ id: K }) => K).join(",");
      M.mutableState.layouts[le] = ie, me.forEach((K) => {
        if (K.collapsible) {
          const { layout: Q } = Y.prev ?? {};
          if (Q) {
            const pe = ye(
              K.collapsedSize,
              ie[K.panelId]
            ), ue = ye(
              K.collapsedSize,
              Q[K.panelId]
            );
            pe && !ue && (M.mutableState.expandedPanelSizes[K.panelId] = Q[K.panelId]);
          }
        }
      });
      const he = Qe().state !== "active";
      h(ie), he && y(ie, Y.isUserInteraction);
    });
    return () => {
      F.current = null, _(), te();
    };
  }, [
    o,
    v,
    y,
    h,
    d,
    w,
    z
  ]), x(() => {
    const E = F.current;
    E && (E.mutableState.defaultLayout = n, E.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ta.Provider, { value: D, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": v,
      id: v,
      ref: R,
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
function Kn() {
  const e = An(ta);
  return ne(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Wd(e, t) {
  const { id: n } = Kn(), r = A({
    collapse: cn,
    expand: cn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: cn
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
  ...b
}) {
  const h = !!l, y = Hn(l), v = Vn({
    disabled: a
  }), S = A(null), w = Wn(S, s), {
    getPanelStyles: g,
    id: I,
    orientation: R,
    registerPanel: k,
    updatePanelProps: z
  } = Kn(), D = f !== null, F = It(
    (M, _, U) => {
      f == null || f(M, l, U);
    }
  );
  ot(() => {
    const M = S.current;
    if (M !== null) {
      const _ = {
        element: M,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? F : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: v.disabled,
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
    y,
    h,
    c,
    d,
    F,
    k,
    v
  ]), x(() => {
    z(y, { disabled: a });
  }, [a, y, z]), Wd(y, u);
  const E = () => {
    const M = g(I, y);
    if (M)
      return JSON.stringify(M);
  }, P = eo(
    (M) => jn(I, M),
    E,
    E
  );
  let T;
  return P ? T = JSON.parse(P) : o !== void 0 ? T = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : T = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...b,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: w,
      style: {
        ...Vd,
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
            touchAction: R === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Tn.displayName = "Panel";
const Vd = {
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
function Kd({
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
  const l = Hn(a), c = Vn({
    disabled: n,
    disableDoubleClick: r
  }), [d, f] = N({}), [u, m] = N("inactive"), [b, h] = N(!1), y = A(null), v = Wn(y, o), {
    disableCursor: S,
    id: w,
    orientation: g,
    registerSeparator: I,
    updateSeparatorProps: R
  } = Kn(), k = g === "horizontal" ? "vertical" : "horizontal";
  ot(() => {
    const F = y.current;
    if (F !== null) {
      const E = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: F,
        id: l
      }, P = I(E), T = Ed(
        (_) => {
          m(
            _.next.state !== "inactive" && _.next.hitRegions.some(
              (U) => U.separator === E
            ) ? _.next.state : "inactive"
          );
        }
      ), M = jn(
        w,
        (_) => {
          const { derivedPanelConstraints: U, layout: $, separatorToPanels: q } = _.next, te = q.get(E);
          if (te) {
            const Y = te[0], X = te.indexOf(Y);
            f(
              Kd({
                layout: $,
                panelConstraints: U,
                panelId: Y.id,
                panelIndex: X
              })
            );
          }
        }
      );
      return () => {
        T(), M(), P();
      };
    }
  }, [w, l, I, c]), x(() => {
    R(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, R]);
  let z;
  n && !S && (z = "not-allowed");
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
        b ? D = "focus" : D = u;
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
      ref: v,
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
ra.displayName = "Separator";
const Jn = 30, Gn = 65, Nt = 50, Jd = 100 - Gn, Gd = 100 - Jn;
function qd(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Gn, Math.max(Jn, t)) : Nt;
}
function qn(e) {
  return 100 - e;
}
function lt(e) {
  return `${e}%`;
}
const Zn = "reader-document", Mt = "reader-assistant", oa = "retainpdf.reader.ai-split-layout.v1", Zd = {
  [Zn]: qn(Nt),
  [Mt]: Nt
};
function Yn(e) {
  const t = qd(e == null ? void 0 : e[Mt]);
  return {
    [Zn]: qn(t),
    [Mt]: t
  };
}
function Yd() {
  try {
    const e = JSON.parse(localStorage.getItem(oa) || "null");
    return Yn(e);
  } catch {
    return Zd;
  }
}
function Xd(e) {
  try {
    localStorage.setItem(oa, JSON.stringify(Yn(e)));
  } catch {
  }
}
function dn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Yn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Mt]}vw`
  );
}
function Qd() {
  const e = A(null), [t] = N(Yd);
  Ie(() => {
    const o = e.current;
    return dn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = O((o) => {
    dn(e.current, o);
  }, []), r = O((o, a) => {
    dn(e.current, o), a.isUserInteraction && Xd(o);
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
            id: Zn,
            defaultSize: lt(qn(Nt)),
            minSize: lt(Jd),
            maxSize: lt(Gd)
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
            minSize: lt(Jn),
            maxSize: lt(Gn)
          }
        )
      ]
    }
  );
}
function eu({
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
function tu({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(eu, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(nt, { children: [
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
function nu(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function ru() {
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || nu(a.target)) return;
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
const ou = ["source", "sideBySide", "translated"], au = { source: "", translated: "", sideBySide: "" };
function su(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Ut(e.sourceUrl), n = Ut(e.translatedUrl);
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
function iu(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = G(
    () => e ? su(e) : au,
    [e]
  ), o = G(
    () => ou.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = O(async (s) => {
    if (!e) return;
    const i = Ut(r[s]);
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
const lu = {
  source: ao,
  sideBySide: so,
  translated: io
}, cu = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function du(e) {
  const t = Oe(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = iu(n), i = A(null);
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
      /* @__PURE__ */ p(oo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = fa[l], d = Ut(r[l]), f = a.has(l), u = !!d && !f, m = u ? "" : ma(l, r), b = lu[l];
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
            /* @__PURE__ */ p(b, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ L("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ L("span", { className: "reader-download-action-label", children: [
                cu[l],
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
const uu = "retainpdf:reader:bookmarks:v1:", fu = 200;
function Xn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function aa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${uu}${t}` : "";
}
function mu(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function qt(e, t = Xn()) {
  const n = aa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = mu(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function kn(e, t, n) {
  const r = aa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, fu);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function hu(e, t, n = "", { storage: r = Xn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = qt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? kn(e, a.filter((i) => i.page !== s), r) : kn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function pu(e, t, n = Xn()) {
  return kn(e, qt(e, n).filter((r) => r.page !== t), n);
}
function gu(e, t) {
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
function bu({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function yu({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => qt(e)), [i, l] = N(!1), c = A(null);
  if (x(() => {
    s(qt(e)), l(!1);
  }, [e]), x(() => {
    if (!i) return;
    const u = (b) => {
      c.current && !c.current.contains(b.target) && l(!1);
    }, m = (b) => {
      b.key === "Escape" && l(!1);
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
        onClick: () => s(hu(e, d, gu(r, d))),
        children: /* @__PURE__ */ p(bu, { filled: f })
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
          onClick: () => s(pu(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function vu(e) {
  const [t, n] = N([]);
  return x(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Ge().loadIssues;
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
function wu(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Su = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Iu = ["failed", "content", "layout"];
function Eu(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ru({ jobId: e, currentPage: t }) {
  var f;
  const n = vu(e), r = (f = Oe()) == null ? void 0 : f.jumpToBlock, [o, a] = N(!1), [s, i] = N(-1), l = A(null);
  x(() => i(-1), [n]);
  const c = (u) => {
    const m = n[u];
    !m || !r || (i(u), r(m.readerItemId));
  }, d = A({ issues: n, last: s, currentPage: t, goTo: c });
  return d.current = { issues: n, last: s, currentPage: t, goTo: c }, x(() => {
    const u = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || Eu(m.target)) return;
      const { issues: b, last: h, currentPage: y, goTo: v } = d.current, S = wu(b, h, y, m.shiftKey);
      S < 0 || (m.preventDefault(), v(S));
    };
    return document.addEventListener("keydown", u), () => document.removeEventListener("keydown", u);
  }, []), x(() => {
    if (!o) return;
    const u = (m) => {
      var b;
      (b = l.current) != null && b.contains(m.target) || a(!1);
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
          /* @__PURE__ */ p(xa, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ L("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      Iu.map((u) => {
        const m = n.map((b, h) => ({ issue: b, index: h })).filter(({ issue: b }) => b.kind === u);
        return m.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ L("h4", { children: [
            Su[u],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: b, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
            re,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                c(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: b.title }),
                /* @__PURE__ */ L("span", { className: "reader-issues-page", children: [
                  "第 ",
                  b.page,
                  " 页"
                ] }),
                b.detail ? /* @__PURE__ */ p("span", { className: "reader-issues-detail", children: b.detail }) : null
              ]
            }
          ) }, `${b.kind}:${b.readerItemId}`)) })
        ] }, u) : null;
      })
    ] }) : null
  ] }) : null;
}
const Pu = 48, Tu = 96, ku = 700;
function Nu(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Pu, downSoFar: r };
}
function Mu(e) {
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
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${_e}]`)), !i.get(m))) return;
      const b = m.scrollTop, h = o.get(m);
      if (o.set(m, b), h === void 0 || Date.now() - a > ku) return;
      const y = Nu(!1, r.current, b - h);
      r.current = y.downSoFar, b - h < -4 ? n(!1) : y.hidden && !l() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - Tu && (r.current = 0, n(!1));
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
function Au(e) {
  const t = Oe(), n = Oo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? _t, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = Ys(a), f = a > po + 1e-3, u = a < Jt - 1e-3, m = ct(r, Ye()), b = m >= Jt ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = A(null), y = Mu(h), [v, S] = N(!1), [w, g] = N(`${i}`);
  x(() => {
    v || g(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, v]);
  const I = () => {
    if (S(!1), !c || l <= 0)
      return;
    const R = Number(`${w}`.trim());
    c(Gt(R, l));
  };
  return /* @__PURE__ */ L("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: v ? /* @__PURE__ */ L(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (R) => {
          R.preventDefault(), I();
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
              onChange: (R) => g(R.target.value.replace(/[^\d]/g, "")),
              onBlur: I,
              onKeyDown: (R) => {
                R.key === "Escape" && (R.preventDefault(), S(!1), g(`${i}`));
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
          !c || l <= 0 || (g(`${i}`), S(!0));
        },
        children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      yu,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(Ru, { jobId: e.issuesJobId, currentPage: i }) : null,
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
          "aria-label": `${d}%，点击${b}`,
          title: b,
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
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(ru, {}) })
  ] });
}
function Yr(e) {
  var t, n;
  return vo(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function _u(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Yr(Ae(e))
  }));
  x(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Yr(Ae(e))
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
function Lu({
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
function Du(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    mn.dismiss(Nn);
    return;
  }
  mn.custom(
    () => /* @__PURE__ */ p(Lu, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Nn, duration: 1 / 0 }
  );
}
function Cu() {
  const e = O((t) => {
    t && (t.setState = Du, t.hide = () => mn.dismiss(Nn));
  }, []);
  return /* @__PURE__ */ L(nt, { children: [
    /* @__PURE__ */ p(Ra, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function xu(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : go(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function zu(e, t) {
  return t === null || e !== t;
}
function Ou(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function $u(e, t) {
  const n = e === t;
  return { open: n, mounted: Ou(n) };
}
const Xr = { itemId: null, origin: null };
function Fu() {
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
const Bu = [];
function ju({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(re, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(za, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Uu({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    re,
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
function Hu({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0
}) {
  var g, I;
  const l = ((g = Oe()) == null ? void 0 : g.regions) ?? Bu, c = ((I = Oo()) == null ? void 0 : I.currentPage) ?? 1, d = G(() => kc(l), [l]), f = Nc(d, c), u = G(() => _c(l, s), [l, s]), [m, b] = N(-1);
  x(() => b(-1), [s]);
  const h = A(null), y = A(null), v = A(n);
  v.current = n, x(() => {
    const R = (z) => {
      var F, E;
      const D = z.target;
      !D || (F = y.current) != null && F.contains(D) || (E = D.closest) != null && E.call(D, ".reader-finder-toggles, [data-finder-toggle]") || v.current();
    }, k = (z) => {
      z.key === "Escape" && v.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", k), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", k);
    };
  }, []);
  const S = A(null);
  x(() => {
    var R, k, z;
    e === "search" ? (R = h.current) == null || R.focus() : (z = (k = S.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null || z.scrollIntoView({ block: "center" });
  }, [e, i]), x(() => {
    var R, k;
    e === "search" && m >= 0 && ((k = (R = S.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null || k.scrollIntoView({ block: "nearest" }));
  }, [e, m]);
  const w = (R) => {
    const k = u[R];
    k && (b(R), r(k.itemId));
  };
  return /* @__PURE__ */ L("aside", { ref: y, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(re, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(re, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(re, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(pt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: S, className: "reader-finder-list", children: d.map((R, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
      re,
      {
        className: "reader-finder-entry",
        "data-level": R.level,
        "aria-current": k === f ? "location" : void 0,
        onClick: () => r(R.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: R.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
        ]
      }
    ) }, R.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: l.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ L(nt, { children: [
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
            onChange: (R) => a(R.target.value),
            onKeyDown: (R) => {
              R.key === "Enter" ? (R.preventDefault(), w(Dc(m, u.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: u.length === 0 ? "没有找到" : `${m >= 0 ? `第 ${m + 1} / ` : ""}${u.length >= 200 ? "200+ 处，只列前 200 处" : `${u.length} 处`}${m < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: u.map((R, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(re, { className: "reader-finder-entry is-hit", "aria-current": k === m ? "true" : void 0, onClick: () => w(k), children: [
        /* @__PURE__ */ L("span", { className: "reader-finder-entry-text", children: [
          R.snippet.slice(0, R.at),
          /* @__PURE__ */ p("mark", { children: R.snippet.slice(R.at, R.at + R.length) }),
          R.snippet.slice(R.at + R.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
      ] }) }, R.itemId)) })
    ] })
  ] });
}
function Wu({ active: e, compare: t, ink: n }) {
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
    a ? /* @__PURE__ */ p(Yc, { compare: t, onDone: () => {
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
      /* @__PURE__ */ p(fd, { active: e }),
      t.available ? /* @__PURE__ */ p(
        re,
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
        children: r ? /* @__PURE__ */ p(pt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Fa, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Vu = [
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
    Vu.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    _o.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(re, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Ua, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      re,
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
function Ku({ ink: e, menu: t, onClose: n }) {
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
function Ju({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(ia, { ink: e }) }) : null;
}
function Gu(e) {
  var r;
  if (e.shiftKey || sa(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${mo}`))) return null;
  const n = Number((r = t.closest(`[${_e}]`)) == null ? void 0 : r.getAttribute(_e)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function qu(e) {
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
function un() {
  try {
    return Ge().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Zu(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Yu(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Xu(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Qu({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null), [s, i] = N(null), [l, c] = N(""), [d, f] = N(""), u = A(0);
  x(() => {
    r([]), i(null), f("");
    const y = un();
    if (!y || !e) return;
    let v = !1;
    return y.list(e).then((S) => {
      v || (r(S.versions), a(S.currentVersionId));
    }).catch(() => {
    }), () => {
      v = !0;
    };
  }, [e, t]);
  const m = O((y) => {
    const v = un(), S = n.find((g) => g.versionId === y);
    if (!v || !S || !e) return;
    const w = ++u.current;
    c(y), f(""), (async () => {
      const g = Ge(), I = await v.resolveJob(e, y);
      if (!I) throw new Error("这一份还没有能读的译文。");
      const R = await g.loadReaderPayload(I, { includeOptionalArtifacts: !0 }), k = g.resolveReaderTranslatedPdfUrl(R.jobPayload, R.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: I, url: k, regions: Zu(no(R.regionsPayload)) };
    })().then((g) => {
      w === u.current && i(g);
    }).catch((g) => {
      w === u.current && f((g == null ? void 0 : g.message) || "这一份打不开。");
    }).finally(() => {
      w === u.current && c("");
    });
  }, [e, n]), b = O(() => {
    u.current += 1, i(null), c(""), f("");
  }, []), h = O(async () => {
    var S, w;
    const y = un();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (g) {
      f((g == null ? void 0 : g.message) || "换不过去，请稍后再试。");
      return;
    }
    const v = (S = globalThis.location) == null ? void 0 : S.href;
    v && ((w = globalThis.history) == null || w.replaceState(globalThis.history.state, "", Xu(v, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Yu(n, t, o),
    compared: s,
    loading: l,
    error: d,
    choose: m,
    clear: b,
    adopt: h
  };
}
const ef = "reader-finder-input";
function tf(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function nf(e, t = typeof window > "u" ? null : window) {
  x(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!tf(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(ef) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function rf() {
  try {
    return Ge().translationEdit ?? null;
  } catch {
    return null;
  }
}
const of = "这本书正在处理（翻译或排版），处理完才能改。", af = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function sf({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = rf(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = nc(s), c = !t || Et(t), d = lc(n), [f, u] = N(""), [m, b] = N(null), [h, y] = N(() => /* @__PURE__ */ new Map()), [v, S] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [w, g] = N(() => /* @__PURE__ */ new Map()), [I, R] = N({ phase: "idle" }), k = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  x(() => {
    b(null), k.drafts.clear(), k.generation.current = null, g(/* @__PURE__ */ new Map()), R({ phase: "idle" });
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
    if (y(/* @__PURE__ */ new Map()), !a || !f || !d || !c) return;
    let _ = !1;
    return a.fetchRevisions(f).then((U) => {
      _ || y(cc(U, d));
    }).catch(() => {
    }), () => {
      _ = !0;
    };
  }, [a, f, d, c]);
  const z = I.phase === "running" && I.seenActive;
  x(() => {
    if (I.phase === "running") {
      if (!c) {
        z || R({ phase: "running", seenActive: !0 });
        return;
      }
      z && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [I.phase, z, c, t]);
  const D = G(() => {
    const _ = new Map(h);
    if (v.renderedAt === d)
      for (const [U, $] of v.edits) _.set(U, $);
    return _;
  }, [h, v, d]), F = O((_) => {
    const U = `${_ || ""}`.trim();
    U && b({ itemId: U, page: rc(U) });
  }, []), E = O(() => b(null), []), P = O((_, U) => {
    S(($) => {
      const q = new Map($.renderedAt === d ? $.edits : []);
      return q.set(_, U), { renderedAt: d, edits: q };
    }), g(($) => new Map($).set(_, ($.get(_) || 0) + 1));
  }, [d]), T = O(async () => {
    if (!(!a || !s || I.phase === "submitting" || I.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch (_) {
        R({ phase: "failed", message: (_ == null ? void 0 : _.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, I.phase, o]), M = l ? af : !c || I.phase === "running" || I.phase === "submitting" ? of : "";
  return G(() => ({
    available: i,
    blockedReason: M,
    port: a,
    ownerJobId: f,
    target: m,
    select: F,
    close: E,
    memory: k,
    pendingEdits: D,
    savedCounts: w,
    markSaved: P,
    rerender: I,
    startRerender: T
  }), [i, M, a, f, m, F, E, k, D, w, P, I, T]);
}
function lf(e, t) {
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
function cf({ edit: e }) {
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
const df = ca(() => import("./ReaderMarkdownPanel-DOl35Chv.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function uf(e) {
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
function ff(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function mf() {
  var B;
  const e = Gi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = _u(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = N(!1), d = A(null), f = A(null), u = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, b = uf({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: l,
    assistantOpen: u
  }), h = Fi({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: b.showSource,
    liveTranslationVisible: l,
    assistantOpen: u
  }), y = b.sourceViewOnly, v = b.visibleMode;
  x(() => {
    c(!1);
  }, [e.viewStateKey]), x(() => {
    e.session.jobTerminal && c(!1);
  }, [e.session.jobTerminal]), x(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const j = Ae(e.viewStateKey), H = xu({
          savedMode: j == null ? void 0 : j.mode,
          sourceViewOnly: y,
          viewportWidth: Ye()
        });
        f.current = H.auto ? H.mode : null, H.mode && H.mode !== e.mode && e.setModeKeepingPage(H.mode);
        return;
      }
      zu(e.mode, f.current) && (f.current = null, Xt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const S = s || (e.mode === "compare" ? "compare" : "reading"), w = $u(s, "markdown");
  tl({
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
  const g = O(() => {
    i(null);
  }, []), I = O((j) => {
    const H = ff(j, e.liveTranslationAvailable);
    H !== null && c(H), e.setModeKeepingPage(j);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), R = G(() => h.sourcePaneToggle ? /* @__PURE__ */ p(
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
  }, []), [z] = N(Fu), [D, F] = N(null), E = O((j) => F((H) => H === j ? null : j), []), [P, T] = N(""), [M, _] = N("");
  x(() => {
    const j = P.replace(/\s+/gu, " ").trim(), H = window.setTimeout(() => _(j), j ? 150 : 0);
    return () => window.clearTimeout(H);
  }, [P]);
  const [U, $] = N(0), q = O(() => {
    F("search"), $((j) => j + 1);
  }, []);
  nf(q);
  const te = O((j) => {
    e.jumpToAnchor({ block_id: j }), (D === "outline" || Ye() < 900) && F(null);
  }, [e.jumpToAnchor, D]), Y = O((j) => e.jumpToAnchor({ block_id: j }), [e.jumpToAnchor]), X = sf({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), me = X.select, ie = e.setModeKeepingPage, le = O((j) => {
    v === "source" && ie("compare"), me(j);
  }, [me, v, ie]);
  lf(X.available ? le : null, z);
  const he = Xl(e.viewStateKey);
  qu(he);
  const [K, Q] = N(null), pe = O(() => Q(null), []), ue = Qu({ documentId: o.documentId, jobId: o.jobId }), fe = ((B = ue.compared) == null ? void 0 : B.url) || "";
  x(() => {
    fe && v !== "compare" && I("compare");
  }, [fe]), x(() => {
    v !== "compare" && ue.clear();
  }, [v]);
  const $e = G(
    () => {
      const { compared: j, versions: H, readingVersionId: ce } = ue;
      if (!j) return null;
      const ae = H.find((ve) => ve.versionId === j.versionId), be = H.find((ve) => ve.versionId === ce);
      return {
        url: j.url,
        regions: j.regions,
        left: { name: j.name, createdAt: (ae == null ? void 0 : ae.createdAt) || "" },
        right: { name: (be == null ? void 0 : be.name) || "当前译文", createdAt: (be == null ? void 0 : be.createdAt) || "" }
      };
    },
    [ue.compared, ue.versions, ue.readingVersionId]
  ), Ee = G(() => {
    if (!X.savedCounts.size) return e.revisedBlocks;
    const j = new Map(e.revisedBlocks);
    for (const [H, ce] of X.savedCounts) j.set(H, (j.get(H) || 0) + ce);
    return j;
  }, [e.revisedBlocks, X.savedCounts]), ke = G(() => ({
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
    regionHover: z,
    jumpToBlock: Y,
    revisedBlocks: Ee,
    editBlock: X.available ? le : void 0,
    blockEdit: X,
    editShowsSource: v !== "compare",
    findTerm: D === "search" ? M : "",
    compareVersion: $e,
    ink: he,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: y,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: k, close: g }
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
    z,
    Y,
    Ee,
    X,
    le,
    v,
    D,
    M,
    $e,
    he,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    k,
    g
  ]), Re = G(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), ee = [
    Hs,
    `is-workspace-${S}`,
    u ? "is-assistant-open" : "",
    D ? "is-finder-open" : "",
    b.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(wc, { value: ke, hud: Re, children: /* @__PURE__ */ L(
    "div",
    {
      className: ee,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": S,
      "data-ink-mode": he.tool || void 0,
      onContextMenu: (j) => {
        const H = Gu(j);
        H && (j.preventDefault(), Q(H));
      },
      children: [
        /* @__PURE__ */ p(tu, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(ju, { open: D, onToggle: E }),
        D ? /* @__PURE__ */ p(
          Hu,
          {
            tab: D,
            onTab: F,
            onClose: () => F(null),
            onJump: te,
            query: P,
            onQuery: T,
            term: M,
            focusSignal: U
          }
        ) : null,
        /* @__PURE__ */ L("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(du, {}),
          /* @__PURE__ */ p(ll, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          id,
          {
            mode: v,
            documentReady: !!o.jobId,
            sourceViewOnly: y,
            onModeChange: I,
            liveTranslation: h.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((j) => !j)
            } : null
          }
        ),
        /* @__PURE__ */ p(md, { active: s }),
        u ? /* @__PURE__ */ p(Qd, {}) : null,
        /* @__PURE__ */ p(rd, { paneComposition: b, markdownSplit: w.open, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: R }),
        e.showHud ? /* @__PURE__ */ p(
          Au,
          {
            mode: v,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(Uu, { open: D, onToggle: E })
          }
        ) : null,
        /* @__PURE__ */ p(la, { fallback: null, children: w.mounted ? /* @__PURE__ */ p(df, { open: w.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: g }) : null }),
        /* @__PURE__ */ p(Wu, { active: s, compare: ue, ink: he }),
        /* @__PURE__ */ p(Ku, { ink: he, menu: K, onClose: pe }),
        /* @__PURE__ */ p(Ju, { ink: he }),
        /* @__PURE__ */ p(cf, { edit: X }),
        /* @__PURE__ */ p(Cu, {})
      ]
    }
  ) });
}
function Lf() {
  return /* @__PURE__ */ p(mf, {});
}
export {
  Lf as R,
  mf as a,
  Af as d,
  Mf as f,
  _f as r,
  Oe as u
};
//# sourceMappingURL=ReaderApp-S-oaOvuy.js.map
