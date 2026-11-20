var Vn = (e) => {
  throw TypeError(e);
};
var Jn = (e, t, n) => t.has(e) || Vn("Cannot " + n);
var ft = (e, t, n) => (Jn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Kn = (e, t, n) => t.has(e) ? Vn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), qn = (e, t, n, r) => (Jn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as D, jsx as h, Fragment as dt } from "react/jsx-runtime";
import { useMemo as K, useState as N, useEffect as z, useCallback as B, useRef as A, useLayoutEffect as Re, memo as Jt, createContext as In, useContext as En, forwardRef as Br, useImperativeHandle as Pn, useSyncExternalStore as jr, useId as Ur, Suspense as Jo, lazy as Ko } from "react";
import { requireAdapter as ut, getReaderAdapters as Te } from "./adapters.js";
import { resolveReaderDownloadName as qo, resolveReaderDownloadUrls as Go, READER_PROGRESS_COPY as Le, trimString as Ft, READER_DOWNLOAD_ACTIONS as Zo, disabledReason as Yo } from "./runtime/state.js";
import { r as Xo, b as Qo } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as cn, isFinishedJobStatus as vt } from "@retainpdf/domain/job";
import { n as Hr, d as ea, f as Yt, k as Gn, b as ta, c as na, j as Tt, p as Tn, g as ra, l as Zn, i as oa } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as aa } from "@retainpdf/api/documents";
import { isReaderTransportError as sa, createReaderTransportError as ia } from "./contracts.js";
import { toast as ln, Toaster as ca } from "sonner";
import { X as Kt, ChevronUp as la, ChevronDown as Wr, History as da, Check as ua, LoaderCircle as fa, Pin as ma, LogOut as ha, Radio as pa, FileText as Vr, Columns2 as Jr, Languages as Kr, Keyboard as ga, Download as ba, ListOrdered as ya, TriangleAlert as va, ListTree as wa, Search as Sa, GitCompareArrows as Ra, LayoutGrid as Ia } from "lucide-react";
import { Button as fe, Textarea as Ea, IconButton as Yn, Input as qr } from "@retainpdf/ui";
import { pdfjs as Gr, Page as Pa, Document as Ta } from "react-pdf";
import { e as ka, m as Na, a as Ma } from "./markdown-math-XkF5urpn.js";
const Aa = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, _a = "", La = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Da = (e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Bu = (...e) => {
  var n;
  return (((n = Te()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, De = () => ut("defaultReaderDataPort"), Xn = () => ut("defaultReaderPageConfigPort"), ju = {
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
}, Zr = {
  messageTargetOrigin: () => Xn().messageTargetOrigin(),
  readerJobId: () => Xn().readerJobId()
}, Ca = () => {
  var e;
  return ((e = Te()) == null ? void 0 : e.liveTranslation) ?? null;
}, wt = () => {
  var t;
  const e = Te();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, We = () => {
  const e = Te();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => ut("fetchDocumentByJobId")(...n),
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
}, xa = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, za = () => {
  var e, t;
  return ((t = (e = Te()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Oa = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Fa = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? qo(...e);
}, $a = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Go(...e);
}, Ba = (...e) => ut("downloadProtectedResource")(...e), ja = (...e) => ut("failDownloadToast")(...e), Uu = (e, t) => ut("resolveMarkdownAssetUrl")(e, t), Qn = "/api/v1";
function Ua() {
  const e = () => {
    var r;
    return Xo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
  return z(() => {
    var i, c, l, d;
    const r = () => n(e()), o = (c = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : c.bind(globalThis.history), a = (d = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : d.bind(globalThis.history);
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
function Ha() {
  const e = Ua(), t = K(() => Oa(Zr), [e]), n = K(() => za(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Wa(e) {
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
  }), [d, f] = N({
    documentId: "",
    jobId: ""
  }), u = c.documentId === t ? c.jobId : "", m = d.documentId === t ? d.jobId : "", b = n || u, [p, w] = N({
    jobId: "",
    documentId: ""
  }), y = p.jobId === b ? p.documentId : "", v = t || y, R = !!t && !b, [g, S] = N(null), E = (g == null ? void 0 : g.sessionIdentity) === r && g.documentId === v ? g : null, k = R || !!E, O = B(($) => {
    const I = `${$.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      w({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const P = `${$.revision || ""}`.trim() || `${Date.now()}`;
    S({
      documentId: I,
      revision: P,
      sessionIdentity: o.current
    }), i();
  }, []);
  z(() => {
    S(($) => $ && $.sessionIdentity !== r ? null : $);
  }, [r]);
  const L = B(($) => {
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
        w((I) => I.jobId === $.jobId && I.documentId === $.documentId ? I : { jobId: $.jobId, documentId: $.documentId });
        break;
      case "committed-source":
        S({
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
    missingDocumentJob: d,
    setMissingDocumentJob: f,
    documentJobId: u,
    rejectedDocumentJobId: m,
    sessionJobId: b,
    resolvedJobDocument: p,
    setResolvedJobDocument: w,
    jobDocumentId: y,
    documentId: v,
    sourceOnly: R,
    committedDocumentSource: g,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: E,
    sourceViewOnly: k,
    refreshCommittedDocument: O,
    applyIdentityEvent: L
  };
}
function er(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Va(e) {
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
function tr(e, t) {
  return Da(cn(e, t));
}
function Ja(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ka(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ja(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function dn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: La.progress,
        stage: n,
        percent: e,
        text: t
      },
      Zr.messageTargetOrigin()
    );
  } catch {
  }
}
function $t(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), dn({ percent: t, text: n, stage: r });
}
function qa(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = N(null), [l, d] = N(null), [f, u] = N(""), [m, b] = N(0), p = f === n ? i : null, w = f === n ? l : null, y = er(p), v = vt(y), R = B(() => {
    b((L) => L + 1);
  }, []), g = B((L) => {
    c(L.jobPayload), d(L.manifestPayload), u(L.sessionIdentity);
  }, []), S = B((L) => {
    c(null), d(null), u(L);
  }, []), E = A(""), k = A(""), O = B(async () => {
    const L = o.current;
    if (!L || E.current === L) return;
    const $ = We().loadJobPayload;
    if (typeof $ != "function") return;
    const I = a.current.value;
    E.current = L;
    try {
      const P = await $(L);
      if (s.current || a.current.value !== I || o.current !== L || !P || typeof P != "object")
        return;
      const T = er(P);
      c(P), u(r.current), !vt(T) && k.current === L && (k.current = ""), T === "succeeded" && k.current !== L && (k.current = L, b((M) => M + 1));
    } catch {
    } finally {
      E.current === L && (E.current = "");
    }
  }, []);
  return z(() => {
    k.current = "";
  }, [n]), z(() => {
    if (!t || v || !p) return;
    const L = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval(L);
  }, [v, O, p, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: d,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: u,
    scopedJobPayload: p,
    scopedManifestPayload: w,
    jobStatus: y,
    jobTerminal: v,
    jobRefreshRevision: m,
    refreshJobArtifacts: R,
    refreshJobStatus: O,
    publishPayload: g,
    clearPayload: S
  };
}
function un(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ga(e, t) {
  e(t), un(t);
}
function Za(e) {
  const [t, n] = N(e ? "source" : "compare"), r = B((a) => {
    e && a !== "source" || (n(a), un(a));
  }, [e]), o = B((a) => {
    Ga(n, a);
  }, []);
  return z(() => (e && document.documentElement.classList.add("reader-source-only"), un(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function nr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ya(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: nr(n.active_job_id),
    activeVersionId: nr(n.active_version_id)
  };
}
function Xa(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Qa(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function es(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const ts = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function ns(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = ts.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const rs = 48 * 1024 * 1024;
function os(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const as = 2, Se = /* @__PURE__ */ new Map();
function fn(e, t) {
  Se.delete(e), Se.set(e, t);
}
function rr(e) {
  if (Se.size < as) return;
  const t = Se.keys().next().value;
  t && Se.delete(t);
}
async function ss(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Yr(e, t = wt().fetchProtected, n = {}) {
  var d, f, u, m, b, p, w, y, v;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Se.has(r)) {
    const R = Se.get(r);
    return fn(r, R), R;
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
    const R = new Error(`读取 PDF 失败 (${s.status})`);
    R.status = s.status;
    const g = await ss(s);
    throw g && (R.reason = g), R;
  }
  const i = is(r, s, t);
  if (i) {
    o.abort();
    const R = { ranged: i };
    return rr(), Se.set(r, R), R;
  }
  (w = (p = n.signal) == null ? void 0 : p.addEventListener) == null || w.call(p, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (v = (y = n.signal) == null ? void 0 : y.removeEventListener) == null || v.call(y, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Se.has(r) ? fn(r, l) : (rr(), Se.set(r, l)), l;
}
function is(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < rs ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const cs = { file: null, loading: !1, error: "" }, ls = { file: null, loading: !0, error: "" };
function ds(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (z(() => {
    if (t || !n) return;
    const s = Se.get(n);
    if (s) {
      fn(n, s);
      return;
    }
    const i = new AbortController();
    return Yr(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return cs;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Se.get(n);
  return a ? { file: a, loading: !1, error: "" } : ls;
}
function us(e) {
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
async function mn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  $t(s, r, n, "download");
  const i = await Yr(t, wt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : ($t(s, o, n, "download"), i);
}
async function fs(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  $t(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    mn({
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
    mn({
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
function ms(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function hs({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = aa,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(ms(o.href, t, a)), !0);
}
const _t = {
  regions: null,
  metadata: null
};
function ps(e) {
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
    applyIdentityEvent: d,
    publishPayload: f,
    clearPayload: u,
    switchSessionMode: m,
    jobRefreshRevision: b,
    sessionEpochRef: p,
    closingRef: w,
    activeLoadAbortRef: y
  } = e, [v, R] = N(""), [g, S] = N(""), [E, k] = N(null), [O, L] = N(null), [$, I] = N(!1), [P, T] = N(""), [M, _] = N([]), [j, F] = N(!1), [G, ee] = N(() => ({
    source: null,
    translated: null
  })), [Y, X] = N(
    _t
  ), [me, ie] = N({
    loading: !0,
    percent: 4,
    text: Le.boot,
    stage: "progress",
    failed: !1
  });
  return z(() => {
    const ce = new AbortController(), ge = p.current.value, W = us({
      sessionEpochRef: p,
      closingRef: w,
      abort: ce,
      sessionEpoch: ge
    });
    y.current = ce;
    const Q = We();
    if (w.current)
      return ce.abort(), () => {
        y.current === ce && (y.current = null);
      };
    let pe = !1;
    function ve(C, q) {
      W.markFailed(), F(!0), ie({
        loading: !1,
        percent: 100,
        text: C,
        stage: "failed",
        failed: !0
      }), dn({ percent: 100, text: q, stage: "failed" });
    }
    function he() {
      I(!0), pe || F(!0), ie({
        loading: !1,
        percent: 100,
        text: Le.ready,
        stage: "ready",
        failed: !1
      }), dn({ percent: 100, text: Le.ready, stage: "ready" });
    }
    function Ve() {
      return l != null && l.documentId ? tr(
        l.documentId,
        l.revision
      ) : Aa() ? _a : Q.resolveResourceUrl(cn(r));
    }
    async function Ie() {
      var de;
      let C = { activeJobId: "", activeVersionId: "" };
      try {
        const ue = await ((de = Q.fetchDocument) == null ? void 0 : de.call(Q, r));
        ue && (C = Ya(ue));
      } catch {
      }
      const q = Xa({
        link: C,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (q.kind === "follow-active-job") {
        if (W.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: q.jobId
        }), q.activeVersionId ? (l || d({
          type: "committed-source",
          documentId: r,
          revision: q.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (q.kind === "open-committed-source") {
        if (W.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: q.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ne = Ve();
      if (W.isInactive()) return;
      R(ne), S(""), T(""), u(c);
      const ae = await mn({
        url: ne,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: W,
        setBoot: ie
      });
      if (!W.isInactive()) {
        if (!ae) {
          ve("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        k(ae), he();
      }
    }
    async function U() {
      var J;
      const C = !l, q = !!(C && Q.loadSessionSnapshot && Q.loadReaderOptionalArtifacts), ne = q ? Q.loadReaderOptionalArtifacts(t) : null, ae = await ((J = Q.loadSessionSnapshot) == null ? void 0 : J.call(Q, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: C && !q
      })), de = ae ? {
        jobPayload: ae.sourcePayload,
        manifestPayload: ae.manifestPayload,
        readerMetadata: ae.readerMetadata,
        regionsPayload: ae.regions,
        readerErrors: ae.readerErrors
      } : await Q.loadReaderPayload(t, {
        includeOptionalArtifacts: C
      });
      if (W.isInactive()) return;
      let ue = null;
      if (n && !r)
        if (ae && ae.linkedDocument !== void 0)
          ue = ae.linkedDocument;
        else {
          try {
            ue = await Q.fetchDocumentByJobId(Qn, t);
          } catch {
          }
          if (W.isInactive()) return;
        }
      const Ee = Va(de.jobPayload) || `${(ue == null ? void 0 : ue.document_id) || ""}`.trim();
      Ee && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ee
      });
      const _e = Qa({
        payloadDocumentId: Ee,
        linkedActiveJobId: `${(ue == null ? void 0 : ue.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ue == null ? void 0 : ue.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (_e.kind === "restore-committed-source") {
        if (W.isInactive()) return;
        d({
          type: "committed-source",
          documentId: _e.documentId,
          revision: _e.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ke = Q.resolveReaderSourcePdf(de.manifestPayload), tt = Q.resolveReaderTranslatedPdfUrl(de.jobPayload, de.manifestPayload), Zt = typeof ke == "string" ? ke : Q.resolveReaderArtifactUrl(ke), Oe = r || Ee, Fe = l != null && l.documentId ? tr(
        l.documentId,
        l.revision
      ) : Zt || (Oe ? Q.resolveResourceUrl(cn(Oe)) : ""), Je = l ? "" : tt || "";
      R(Fe || ""), S(Je), T(Ka(de.jobPayload, t)), f({
        jobPayload: de.jobPayload || null,
        manifestPayload: de.manifestPayload || null,
        sessionIdentity: c
      });
      const Nt = () => fs({
        sourceFinal: Fe || "",
        translatedFinal: Je,
        fence: W,
        setBoot: ie
      }), Mt = !!(Fe || Je), nt = ne && Mt ? Nt() : null;
      nt == null || nt.catch(() => {
      });
      const At = (V) => {
        W.isInactive() || (_(l ? [] : Hr(V.regionsPayload)), ee(l ? { source: null, translated: null } : ea(V.readerMetadata)), X(l ? _t : V.readerErrors ?? _t), F(!0));
      };
      if (ne ? (pe = !0, ne.then(At)) : At(de), !Mt) {
        ve(Le.failed, Le.failed);
        return;
      }
      const x = await (nt ?? Nt());
      if (x.status !== "inactive") {
        if (x.status === "incomplete") {
          ve("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        k(x.sourceBytes), L(x.translatedBytes), he();
      }
    }
    async function te() {
      I(!1), k(null), L(null), _([]), F(!1), ee({ source: null, translated: null }), X(_t), $t(ie, 8, Le.metadata, "metadata");
      try {
        if (s) {
          await Ie();
          return;
        }
        if (!t) {
          ve(Le.failed, Le.failed);
          return;
        }
        await U();
      } catch (C) {
        if (W.isClosedOrStale() || (C == null ? void 0 : C.name) === "AbortError") return;
        W.markFailed();
        const q = Number(C == null ? void 0 : C.status), ne = `${(C == null ? void 0 : C.reason) || ""}`, ae = ns({ status: q, reason: ne, sessionJobId: t });
        if (ae && (await hs({
          apiPrefix: Qn,
          documentId: ae,
          expiredJobId: t
        }) || W.isClosedOrStale()))
          return;
        if (es({
          status: q,
          reason: ne,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const de = C instanceof Error ? C.message : Le.failed;
        ve(de, de);
      }
    }
    return te(), () => {
      ce.abort(), y.current === ce && (y.current = null);
    };
  }, [t, r, o, a, s, i, l, b, n, c, d, f, u, m]), {
    sourceUrl: v,
    translatedUrl: g,
    sourceFile: E,
    translatedFile: O,
    assetsReady: $,
    title: P,
    regions: M,
    regionsSettled: j,
    readerMetadata: G,
    readerErrors: Y,
    boot: me
  };
}
function gs() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ha(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), c = A(""), l = A(""), d = A(() => {
  }), f = B(() => d.current(), []), u = Wa({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: f
  }), {
    sessionJobId: m,
    documentId: b,
    sourceOnly: p,
    sourceViewOnly: w
  } = u, { mode: y, setMode: v, switchSessionMode: R } = Za(w);
  d.current = () => {
    R("source");
  }, i.current = a, c.current = b, l.current = m;
  const g = qa({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: E,
    jobStatus: k,
    jobTerminal: O,
    jobRefreshRevision: L,
    refreshJobArtifacts: $,
    refreshJobStatus: I
  } = g, P = ps({
    sessionJobId: m,
    jobId: r,
    routeDocumentId: o,
    documentJobId: u.documentJobId,
    rejectedDocumentJobId: u.rejectedDocumentJobId,
    sourceOnly: p,
    locationKey: n,
    sessionIdentity: a,
    committedSource: u.activeCommittedDocumentSource,
    applyIdentityEvent: u.applyIdentityEvent,
    publishPayload: g.publishPayload,
    clearPayload: g.clearPayload,
    switchSessionMode: R,
    jobRefreshRevision: L,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = B(() => {
    var _;
    e.current = !0, (_ = t.current) == null || _.abort();
  }, []), M = K(
    () => ({
      fetchProtected: We().fetchProtected,
      jobId: m,
      jobPayload: S,
      manifestPayload: E,
      sourceUrl: P.sourceUrl,
      translatedUrl: P.translatedUrl,
      sourceOnly: w
    }),
    [m, S, E, P.sourceUrl, P.translatedUrl, w]
  );
  return {
    jobId: m,
    jobStatus: k,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: b,
    sessionIdentity: a,
    sourceOnly: p,
    mode: y,
    setMode: v,
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
    refreshJobArtifacts: $,
    refreshJobStatus: I,
    refreshCommittedDocument: u.refreshCommittedDocument,
    prepareClose: T
  };
}
const bs = 160, ys = 8, vs = 0;
function ws() {
  const e = A(null), [t, n] = N(null), [r, o] = N(vs), a = B((s) => {
    e.current = s, n(s);
  }, []);
  return z(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < bs || o((d) => Math.abs(d - l) < ys ? d : l);
    }, c = new ResizeObserver((l) => {
      var d, f;
      i(((f = (d = l[0]) == null ? void 0 : d.contentRect) == null ? void 0 : f.width) ?? s.clientWidth);
    });
    return c.observe(s), i(s.clientWidth), () => c.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function Ss(e) {
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
const Xt = { source: 0, translated: 0 };
function Rs(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, d = A(l);
  d.current = l;
  const [f, u] = N(() => ({
    identity: l,
    pages: Xt
  })), [m, b] = N(() => ({ identity: l, tick: 0 })), p = f.identity === l ? f.pages : Xt, w = m.identity === l ? m.tick : 0, y = Ss({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: v } = y, R = B((I, P) => {
    d.current === l && u((T) => {
      const M = T.identity === l ? T.pages : Xt;
      return M[P] === I && T.identity === l ? T : {
        identity: l,
        pages: { ...M, [P]: I }
      };
    });
  }, [l]), g = A(null), S = B(() => {
    g.current && clearTimeout(g.current);
    const I = l;
    g.current = setTimeout(() => {
      g.current = null, d.current === I && b((P) => ({
        identity: I,
        tick: P.identity === I ? P.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  z(() => (g.current && (clearTimeout(g.current), g.current = null), u((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), b((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    g.current && (clearTimeout(g.current), g.current = null);
  }), [l]);
  const E = K(
    () => Math.max(p.source, p.translated),
    [p]
  ), k = v === "translated" ? p.translated : p.source || p.translated, O = t == null ? void 0 : t.userZoom, L = t == null ? void 0 : t.shellWidth, $ = `${l}-${w}-${O}-${n}-${p.source}-${p.translated}-${L}`;
  return {
    ...y,
    numPagesByPane: p,
    hudNumPages: E,
    primaryNumPages: k,
    metricsTick: w,
    onNumPages: R,
    onMetrics: S,
    rowSyncRevision: $
  };
}
const Ue = "data-reader-page", He = "data-reader-pane", kn = "data-natural-height", Is = "reader-react-root", Es = "reader-react-grid", Ps = "reader-react-scroll-shell", Ts = "reader-react-pdf-pane", Xr = "reader-react-pdf-page", Bt = "reader-react-pdf-page-placeholder", Nn = "reader-react-pdf-page-slot";
function jt(e, t) {
  const n = e != null ? `[${Ue}="${e}"]` : `[${Ue}]`;
  return t ? `${n}[${He}="${t}"]` : n;
}
function ks() {
  return `.${Nn}[${Ue}]`;
}
function Ut(e) {
  return Number(e.getAttribute(Ue));
}
const Qr = 0.25, Ht = 1, Ns = 0.05, kt = 0.5, Ms = 16, As = 8, _s = 720;
function Ge() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function eo(e) {
  return Number.isFinite(e) && e < _s;
}
function at(e, t = Number.POSITIVE_INFINITY) {
  return eo(t) && (e === "source" || e === "translated") ? Ht : kt;
}
function qt(e) {
  return Number.isFinite(e) ? Math.min(Ht, Math.max(Qr, e)) : kt;
}
function St(e, t) {
  const n = qt(Number(e) + t * Ns);
  return Math.round(n * 100) / 100;
}
function Ls(e) {
  return Math.round(qt(e) * 100);
}
function Ds(e) {
  const n = (Number(e) || 0) - Ms - As;
  return Math.max(160, Math.floor(n));
}
function Cs(e, t = kt) {
  const n = qt(t);
  return Ds((Number(e) || 0) * n);
}
function xs(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${He}]`)
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
const zs = 8;
function Os(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < zs ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const to = 200, no = [
  "markdown"
], Fs = no;
function ro(e) {
  return Fs.includes(e);
}
const $s = "retainpdf:reader:view:v1:", or = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Bs = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function oo() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function hn(e) {
  return `${e || ""}`.trim();
}
function js({
  documentId: e,
  jobId: t
}) {
  const n = hn(e);
  if (n) return `document:${n}`;
  const r = hn(t);
  return r ? `job:${r}` : "";
}
function ao(e) {
  const t = hn(e);
  return t ? `${$s}${t}` : "";
}
function Us(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Hs(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!or.has(t) || !or.has(n) || t === n))
    return { left: t, right: n };
}
function Ws(e) {
  return e === null ? null : ro(e) ? e : void 0;
}
function Vs(e) {
  return Bs.has(e) ? e : void 0;
}
function so(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Us(t.anchor), r = Number(t.zoom), o = Vs(t.mode), a = Hs(t.splitLayout), s = Ws(t.assistantPanel);
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
function Ae(e, t = oo()) {
  const n = ao(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? so(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Gt(e, t, n = oo()) {
  const r = ao(e);
  if (!r || !n) return null;
  const o = Ae(e, n), a = so({
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
function Js(e, t, n = "") {
  var u;
  const [r, o] = N(() => {
    var m;
    return ((m = Ae(n)) == null ? void 0 : m.zoom) ?? at(e, Ge());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), c = A(((u = Ae(n)) == null ? void 0 : u.zoom) !== void 0);
  z(() => {
    var p;
    if (s.current === n) return;
    s.current = n;
    const m = (p = Ae(n)) == null ? void 0 : p.zoom;
    c.current = m !== void 0;
    const b = m ?? at(e, Ge());
    i.current = 1, a.current = b, o(b);
  }, [e, n]), z(() => {
    if (c.current) return;
    const m = at(e, Ge()), b = a.current;
    Math.abs(m - b) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = B((m) => {
    const b = qt(m), p = a.current;
    Math.abs(b - p) < 5e-4 || (i.current = b / (p || 1), c.current = !0, Gt(s.current, { zoom: b }), o(b));
  }, []), d = B((m) => {
    l(St(a.current, m));
  }, [l]), f = B((m) => {
    l(at(m));
  }, [l]);
  return Re(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, xs(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: d, resetZoom: f };
}
function Ks(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: B((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const Mn = 48;
function io(e, t = Mn) {
  return e.getBoundingClientRect().top + t;
}
function co(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const c of e) {
    const l = c.getBoundingClientRect();
    l.height < 8 || l.width < 8 || l.top <= t + 1 && l.top >= r && (n = c, r = l.top);
  }
  if (!n && (n = e.find((l) => {
    const d = l.getBoundingClientRect();
    return d.height >= 8 && d.width >= 8;
  }) ?? null, n)) {
    const l = [...e].reverse().find((d) => {
      const f = d.getBoundingClientRect();
      return f.height >= 8 && f.width >= 8;
    });
    l && l.getBoundingClientRect().bottom < t && (n = l);
  }
  if (!n)
    return null;
  const o = Ut(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function zt(e, t, n = Mn) {
  if (!e)
    return null;
  const r = jt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = io(e, n), i = co(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Rt(e, t, n = "auto", r, o = Mn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(jt(a, r))), i || (i = e.querySelector(jt(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const d = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), u = Math.max(0, f + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - u) >= 1 && (e.scrollTop = u) : e.scrollTo({ top: u, behavior: n }), !0;
}
function qs(e, t, n = "smooth", r) {
  return Rt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function pn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var d;
    if (a) return;
    Rt(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (d = n == null ? void 0 : n.onDone) == null || d.call(n));
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
function Gs(e, t, n) {
  return pn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Wt(e, t) {
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
function Zs(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
  return z(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, d = 0;
    const f = jt(void 0, o), u = () => {
      if (c) return;
      const p = Array.from(i.querySelectorAll(f));
      if (!p.length)
        return;
      const w = io(i), y = co(p, w);
      y && s(y.page);
    }, m = () => {
      c || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, u();
      }));
    }, b = () => {
      if (c) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        l = setTimeout(b, 120);
        return;
      }
      u(), i.addEventListener("scroll", m, { passive: !0 });
    };
    return b(), () => {
      c = !0, l && clearTimeout(l), d && cancelAnimationFrame(d), i.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const Ys = `canvas, .react-pdf__Page, .${Xr}, .${Bt}`, ar = /* @__PURE__ */ new WeakMap();
function Xs(e) {
  const t = Number(e.getAttribute(kn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = ar.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Ys), ar.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Qs(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function ei(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(ks()).forEach((r) => {
    const o = Ut(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Xs(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function ti(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Re(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, d = !1, f = !1;
    const u = () => {
      var S;
      if (c) return;
      const R = e.current;
      if (!R) return;
      const g = ei(R);
      Qs(s.current, g) || (s.current = g, a(g)), d && !f && (f = !0, (S = i.current) == null || S.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(u);
      });
    };
    m();
    const b = window.setTimeout(m, 100), p = window.setTimeout(() => {
      d = !0, m();
    }, 300), w = window.setTimeout(m, 700), y = e.current;
    let v = null;
    return y && typeof ResizeObserver < "u" && (v = new ResizeObserver(() => m()), v.observe(y)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(b), window.clearTimeout(p), window.clearTimeout(w), v == null || v.disconnect();
    };
  }, [e, t, n]), o;
}
const ni = [0, 48, 140, 320, 560], ri = 700, oi = [80, 200, 400], ai = 500, si = 50, ii = /* @__PURE__ */ new Set([
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
]), ci = 180, sr = [0, 48, 140, 320, 700, 1200];
function li(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((P = Ae(a)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), c = A(null), l = A(!1), d = A(r), f = A(null), u = A(null), m = A(null), b = A(null), p = A(a), w = A(""), y = A(n);
  y.current = n;
  const v = B(() => {
    var T;
    (T = f.current) == null || T.call(f), f.current = null, u.current != null && (clearTimeout(u.current), u.current = null);
  }, []), R = B(() => {
    !l.current && c.current == null || (v(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [v]), g = B((T = !1) => {
    b.current != null && (clearTimeout(b.current), b.current = null);
    const M = () => {
      b.current = null, Gt(p.current, {
        anchor: Pe(i.current)
      });
    };
    T ? M() : b.current = setTimeout(M, ci);
  }, []), S = B((T) => {
    i.current = Pe(T), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, si);
  }, []);
  z(() => {
    if (!o)
      return;
    let T = !1, M = null, _ = null, j = null;
    const F = () => {
      if (T) return;
      const G = e.current;
      if (!G) {
        j = setTimeout(F, 50);
        return;
      }
      M = G, _ = () => {
        if (l.current)
          return;
        const ee = zt(M, y.current);
        ee && (i.current = ee, g());
      }, M.addEventListener("scroll", _, { passive: !0 }), l.current || _();
    };
    return F(), () => {
      T = !0, j != null && clearTimeout(j), M && _ && M.removeEventListener("scroll", _);
    };
  }, [o, r, n, e, g]), z(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const M = (_) => {
      _.metaKey || _.ctrlKey || _.altKey || ii.has(_.key) && R();
    };
    return T.addEventListener("wheel", R, { passive: !0 }), T.addEventListener("touchmove", R, { passive: !0 }), window.addEventListener("keydown", M), () => {
      T.removeEventListener("wheel", R), T.removeEventListener("touchmove", R), window.removeEventListener("keydown", M);
    };
  }, [o, e, R]), Re(() => {
    var M;
    if (p.current === a) return;
    g(!0), v(), m.current != null && (clearTimeout(m.current), m.current = null), p.current = a, w.current = "";
    const T = (M = Ae(a)) == null ? void 0 : M.anchor;
    i.current = T ? Pe(T) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, d.current = r;
  }, [a, r, g, v]), z(() => {
    var M;
    if (!o || !s || !a || w.current === a) return;
    w.current = a;
    const T = Pe(
      ((M = Ae(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = T, c.current = T, l.current = !0, v(), f.current = pn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: y.current,
        delaysMs: sr,
        onDone: () => S(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, S(T);
    }, Math.max(...sr) + 160), () => v();
  }, [o, s, a, e, S, v]), z(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      l.current = !1, c.current = null, v();
      return;
    }
    const T = c.current ? Pe(c.current) : Pe(i.current);
    return l.current = !0, c.current = T, i.current = T, v(), f.current = pn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: ni,
        onDone: () => S(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, S(T);
    }, ri), () => {
      v();
    };
  }, [r, o, n, e, S, v]), z(() => () => {
    v(), m.current != null && (clearTimeout(m.current), m.current = null), g(!0);
  }, [v, g]);
  const E = B(() => {
    const T = zt(
      e.current,
      y.current
    );
    return Pe(T || i.current);
  }, [e]), k = B(() => {
    l.current = !0;
    const T = zt(
      e.current,
      y.current
    ), M = Pe(T ?? i.current);
    return i.current = M, c.current = M, g(), M;
  }, [e, g]), O = B((T, M, _) => {
    const j = _ || y.current, F = Wt(T, M || 1), G = { page: F, fraction: 0 };
    i.current = G, l.current = !0, c.current = G, g(), v(), qs(e.current, F, "smooth", j), f.current = Gs(
      () => e.current,
      F,
      {
        behavior: "auto",
        pane: j,
        delaysMs: oi,
        onDone: () => S(G)
      }
    ), u.current = setTimeout(() => {
      u.current = null, S(G);
    }, ai);
  }, [e, S, v, g]), L = B(() => Pe(i.current), []), $ = B(() => l.current, []), I = B(() => {
    if (!l.current || !c.current)
      return;
    const T = Pe(c.current);
    Rt(
      e.current,
      T,
      "auto",
      y.current
    );
  }, [e]);
  return {
    lockFromShell: E,
    beginModeSwitch: k,
    goToPage: O,
    getAnchor: L,
    isRestoring: $,
    repinIfRestoring: I
  };
}
function di(e, t) {
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
function lo(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const ui = [0, 80, 200, 400, 800], fi = 120, mi = 400;
function hi(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: d = !0 } = e, f = A(a);
  f.current = a;
  const u = A(s);
  u.current = s;
  const m = A(i);
  m.current = i;
  const b = A(n);
  b.current = n, z(() => {
    var g, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const p = xa(), w = di(p, u.current);
    if (w == null && (p != null && p.blockId) && !d) return;
    const y = lo(p, w, { jobId: c, documentId: l });
    if (t.current === y)
      return;
    if (w == null) {
      t.current = y, (g = b.current) == null || g.call(b);
      return;
    }
    t.current = y, p && ((S = m.current) == null || S.call(m, p, w));
    const v = [];
    let R = 0;
    for (const E of ui)
      R = Math.max(R, E), v.push(
        setTimeout(() => {
          f.current(w);
        }, E)
      );
    return v.push(
      setTimeout(() => {
        var E;
        (E = b.current) == null || E.call(b);
      }, R + fi)
    ), () => {
      for (const E of v) clearTimeout(E);
    };
  }, [r, o, c, l, t, d]);
}
function pi(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function gi(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = mi,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, d = A(a);
  d.current = a;
  const f = A(l);
  f.current = l;
  const u = A(0);
  z(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || u.current === o) return;
    const m = setTimeout(() => {
      var y;
      const b = ((y = globalThis.location) == null ? void 0 : y.search) || "", p = Qo(b, o, d.current);
      if (u.current = o, p === null) return;
      const w = `${new URLSearchParams(p).get("block_id") || ""}`.trim();
      t.current = lo(
        { blockId: w },
        o,
        { jobId: i, documentId: c }
      ), (f.current || pi)(p);
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
function bi(e) {
  const t = A(""), [n, r] = N(!1), o = B(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  hi(a, t, o), gi(e, t, n);
}
const mt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function yi(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function ir(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function uo(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = ir(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = ir(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function vi(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = uo(r, t, n);
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
function wi(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const cr = [250, 500, 1e3, 2e3, 4e3], Qt = [80, 160, 320, 640, 1e3, 1500], lr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function gn(e, t) {
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
function An(e) {
  return sa(e) ? `${e.code || ""}`.trim() : "";
}
function Lt(e, t) {
  const n = An(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Si(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (uo(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = ia(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = An(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Qt[Math.min(s, Qt.length - 1)];
    if (await gn(i, r), s >= Qt.length + 2) throw a;
  }
}
function Ri({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(mt), s = A(o), i = A("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), d = vt(l) ? l : "";
  return z(() => {
    if (!n || !c) {
      i.current = "", s.current = mt, a(mt);
      return;
    }
    const f = r === void 0 ? Ca() : r, u = i.current === c;
    if (i.current = c, !f) {
      const R = {
        ...u ? s.current : mt,
        connection: d ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = R, a(R);
      return;
    }
    const m = new AbortController();
    let b = !1;
    const p = {
      ...u ? s.current : mt,
      connection: d ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = p, a(p);
    const w = (R) => {
      m.signal.aborted || a((g) => {
        const S = R(g);
        return s.current = S, S;
      });
    }, y = async () => {
      let R = 0;
      for (; !m.signal.aborted; )
        try {
          const g = await f.fetchLayout(c, { signal: m.signal });
          b = !0, w((S) => ({
            ...S,
            layoutByPage: yi(g),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError") return;
          const S = An(g);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            w((k) => ({
              ...k,
              connection: d ? "terminal" : "unavailable",
              jobStatus: l,
              error: Lt(g, "实时译文暂不可用")
            }));
            return;
          }
          if (d) {
            w((k) => ({
              ...k,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          w((k) => ({
            ...k,
            connection: "connecting",
            jobStatus: l,
            error: Lt(g, "正在等待 OCR 版面数据")
          })), await gn(cr[Math.min(R, cr.length - 1)], m.signal).catch(() => {
          }), R += 1;
        }
    };
    return (async () => {
      if (await y(), !b || m.signal.aborted) return;
      let R = 0;
      for (; !m.signal.aborted; ) {
        d || w((g) => ({
          ...g,
          connection: g.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: g.error
        }));
        try {
          await f.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (g) => {
              if (g.seq <= s.current.lastSeq) return;
              let S;
              try {
                S = await Si(
                  c,
                  g,
                  s.current,
                  m.signal,
                  f
                );
              } catch (E) {
                if ((E == null ? void 0 : E.name) === "AbortError" || m.signal.aborted) throw E;
                w((k) => ({
                  ...k,
                  lastSeq: Math.max(k.lastSeq, g.seq),
                  error: Lt(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              w((E) => {
                const k = vi(E, g, S);
                return d ? {
                  ...k,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...k,
                  jobStatus: l
                };
              }), R = 0;
            }
          });
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError" || m.signal.aborted) return;
          w((S) => ({
            ...S,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: l,
            error: Lt(g, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (d) {
          w((g) => ({
            ...g,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await gn(lr[Math.min(R, lr.length - 1)], m.signal).catch(() => {
        }), R += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, d]), o;
}
function Ii(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Ei(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return z(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = We().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Ii(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Pi = 4500;
function Ti(e) {
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
const ki = /* @__PURE__ */ new Set(["book", "translate"]);
function fo(e) {
  return !!(e.jobId && e.sourceUrl && ki.has(e.workflow));
}
function Ni(e) {
  return !!(fo(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Mi() {
  const e = gs(), t = fo({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Ni({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !vt(o) && (r.current.running = !0);
  const a = Ri({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = ws(), d = Ei(e.jobId, !e.sourceOnly), f = js({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: b } = Js(e.mode, s, f), p = Rs(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: m, shellWidth: c, identityKey: u }
  ), {
    beginModeSwitch: w,
    goToPage: y,
    repinIfRestoring: v
  } = li(s, {
    primaryPane: p.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: p.primaryNumPages > 0
  });
  z(() => {
    v();
  }, [c, v]);
  const R = ti(
    s,
    p.compareMode,
    p.rowSyncRevision,
    v
  ), g = Zs(
    s,
    p.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${p.metricsTick}`,
    p.primaryPane
  ), S = B((F, G) => {
    var Y, X;
    const ee = Math.max(
      Number(p.hudNumPages) || 0,
      Number(p.primaryNumPages) || 0,
      Number((Y = p.numPagesByPane) == null ? void 0 : Y.source) || 0,
      Number((X = p.numPagesByPane) == null ? void 0 : X.translated) || 0
    );
    y(F, ee, G);
  }, [y, p.hudNumPages, p.primaryNumPages, p.numPagesByPane]), [E, k] = N(null), O = A(null), L = B((F) => {
    O.current && clearTimeout(O.current), k(F), F && (O.current = setTimeout(() => k(null), Pi));
  }, []);
  z(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const $ = B((F) => {
    const G = Yt(e.regions, F);
    return G ? Gn(G, p.primaryPane).page : null;
  }, [e.regions, p.primaryPane]), I = B((F, G) => {
    const ee = G || p.primaryPane, Y = typeof F == "object" && F ? `${F.block_id || ""}`.trim() : "", X = typeof F == "object" && F ? `${F.image_url || ""}`.trim() : "", me = typeof F == "object" && F ? F.page_idx != null ? Number(F.page_idx) + 1 : F.page != null ? Number(F.page) : null : typeof F == "number" ? F + 1 : null, ie = ta(e.regions, X, me) || Yt(e.regions, Y) || (typeof F == "object" ? na(e.regions, F) : null);
    let ce = ie ? Gn(ie, ee).page : null;
    ce == null && (ce = Ti(F)), !(ce == null || ce < 1) && (L(ie), S(ce, ee));
  }, [L, S, p.primaryPane, e.regions]);
  bi({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: p.hudNumPages || 0,
    currentPage: g,
    goToPage: S,
    resolveBlockPage: $,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (F) => {
      L(Yt(e.regions, F.blockId));
    }
  });
  const { setModeKeepingPage: P } = Ks({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: w
  });
  z(() => {
    L(null);
  }, [u, L]);
  const T = !e.boot.loading && !e.boot.failed, M = K(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), _ = K(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), j = K(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: b,
    shell: M,
    panes: p,
    sessionFiles: _,
    rowHeights: R,
    goToPage: S,
    activeRegion: E,
    jumpToAnchor: I,
    setModeKeepingPage: P,
    download: e.download,
    showHud: T,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, M, p, _, R, S, E, I, P, T, m, b, f, a, n, d]);
  return K(() => ({
    ...j,
    currentPage: g
  }), [j, g]);
}
const Ai = [
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
], _i = [
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
function Li(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Ai)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Di(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Ci = ".reader-notes-panel";
function xi(e) {
  return e instanceof Element ? !!e.closest(Ci) : !1;
}
function zi(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: i,
    goToPage: c,
    enabled: l = !0
  } = e;
  z(() => {
    if (!l)
      return;
    const d = (f) => {
      if (f.defaultPrevented || f.metaKey || f.ctrlKey || f.altKey || Di(f.target) || xi(f.target))
        return;
      const u = f.key, m = Li(u);
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
              a(St(o, 1));
              return;
            case "zoom-out":
              a(St(o, -1));
              return;
            case "zoom-reset":
              a(at(t, Ge()));
              return;
            case "next-page":
              c(Wt(s + 1, i));
              return;
            case "prev-page":
              c(Wt(s - 1, i));
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
    return window.addEventListener("keydown", d), () => window.removeEventListener("keydown", d);
  }, [
    l,
    t,
    n,
    r,
    o,
    a,
    s,
    i,
    c
  ]);
}
const Oi = "retainpdf:soft-reader-close";
function Fi() {
  return new URL("./index.html", window.location.href).href;
}
function $i() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Oi },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Bi(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function ji() {
  if (!(typeof window > "u") && !$i()) {
    if (Bi(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Fi());
  }
}
function Ui({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ h("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Hi({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ D(Ui, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), ji();
  }, children: [
    /* @__PURE__ */ h(Kt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ h("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let dr = !1;
function Wi() {
  if (dr)
    return;
  const e = wt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Gr.GlobalWorkerOptions.workerSrc = e, dr = !0);
}
const Vi = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Ji(e, t, n) {
  return e.flatMap((r) => {
    if (!Vi.has(Tt(r.region))) return [];
    const o = Tn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function ur(e, t, n) {
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
async function Ki(e) {
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
const qi = "reader-text-hover-copy", Gi = "reader-text-hover-edit", Zi = "reader-text-hover-id";
function Yi(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const mo = "reader-text-hover-tools";
function en({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ h(
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
const ho = 26, po = 220;
function go(e, t = po) {
  return e.height < ho * 2 || e.width < t;
}
function Xi({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a
}) {
  const [s, i] = N("idle"), [c, l] = N("idle"), [d] = N(() => Yi()), f = A([]), u = (e == null ? void 0 : e.itemId) || "";
  if (z(() => {
    i("idle"), l("idle");
    const R = f.current;
    return () => {
      R.forEach((g) => window.clearTimeout(g)), f.current = [];
    };
  }, [u]), !e) return null;
  const m = ra(e.highlight.region, t), b = Tt(e.highlight.region), p = (R, g) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const E = await Ki(R);
    g(E ? "copied" : "failed"), f.current.push(window.setTimeout(() => g("idle"), 1200));
  }, w = b === "formula" ? "复制 LaTeX" : "复制", y = o || e.rect, v = a || (go(y) ? "outside" : "inside");
  return /* @__PURE__ */ h("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ h(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": b,
      style: y,
      children: /* @__PURE__ */ D(
        "div",
        {
          className: mo,
          "data-placement": v,
          children: [
            d ? /* @__PURE__ */ h(
              en,
              {
                className: Zi,
                state: c,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: p(e.itemId, l),
                children: c === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && n > 0 ? /* @__PURE__ */ D("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            t === "translated" && r ? /* @__PURE__ */ h(
              en,
              {
                className: Gi,
                state: "idle",
                label: "改这段译文",
                title: "改这段译文（E）",
                onClick: (R) => {
                  R.preventDefault(), R.stopPropagation(), r(e.itemId);
                },
                children: "改"
              }
            ) : null,
            m ? /* @__PURE__ */ h(
              en,
              {
                className: qi,
                state: s,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: p(m, i),
                children: s === "copied" ? "已复制" : s === "failed" ? "复制失败" : w
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Qi(e, t) {
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
function ec(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = Tn(
      Qi(e, a),
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
const tc = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', nc = 256, ht = /* @__PURE__ */ new Map();
function rc(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function bo(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ka(t, { bareLatex: !0 }), o = rc(n), a = Na(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = ht.get(t);
  if (!s && (s = Ma(o, r), ht.set(t, s), ht.size > nc)) {
    const i = ht.keys().next().value;
    i !== void 0 && ht.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function tn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ce(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function oc(e, t) {
  const n = e.typography, r = Ce(t) || 1, o = Ce(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = tn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ce(n == null ? void 0 : n.fit_min_font_size_pt), d = Ce(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), u = Math.max(
    f,
    d ? d * r : o ? o * r : c
  ), m = o ? o * r : c, b = Ce(n == null ? void 0 : n.leading_em), p = [
    Ce(n == null ? void 0 : n.padding_top_pt) || 0,
    Ce(n == null ? void 0 : n.padding_right_pt) || 0,
    Ce(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ce(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((w) => w * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || tc,
    fontSizePx: Math.max(f, Math.min(u, m)),
    minFontSizePx: f,
    maxFontSizePx: u,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: b ? 1 + b : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (tn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : tn(e.kind) ? "center" : "justify",
    padding: p,
    exact: !!o
  };
}
function ac(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const u = s.get(f);
    if (u !== void 0) return u;
    const { width: m, height: b } = e(f), p = m <= t + 0.5 && b <= n + 0.5;
    return s.set(f, p), p;
  };
  let c = o, l = a, d = Math.min(r.requestedFontSizePx, l);
  if (i(d)) {
    if (!r.exact) {
      c = d;
      for (let f = 0; f < 6 && l > c; f += 1) {
        const u = (c + l) / 2;
        i(u) ? (d = u, c = u) : l = u;
      }
    }
  } else {
    l = d, d = c;
    for (let f = 0; f < 8 && l > c; f += 1) {
      const u = (c + l) / 2;
      i(u) ? (d = u, c = u) : l = u;
    }
  }
  return Math.max(o, d);
}
const sc = 512, pt = /* @__PURE__ */ new Map();
let bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  bn += 1;
}));
function ic(e, t, n, r) {
  return [
    bn,
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
function yo({ item: e, pageScale: t }) {
  const n = A(null), r = K(
    () => bo(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = K(
    () => oc(e, t),
    [e, t]
  );
  z(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((u) => {
      f && a(u);
    }), () => {
      f = !1;
    };
  }, [r]), Re(() => {
    const f = n.current;
    if (!f) return;
    const [u, m, b, p] = s.padding, w = Math.max(1, e.rect.width - p - m), y = Math.max(1, e.rect.height - u - b), v = ic(o, w, y, s);
    let R = pt.get(v);
    if (R === void 0 && (R = ac(
      (g) => (f.style.fontSize = `${g}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      w,
      y,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), pt.set(v, R), pt.size > sc)) {
      const g = pt.keys().next().value;
      g !== void 0 && pt.delete(g);
    }
    f.style.fontSize = `${R.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, c, l, d] = s.padding;
  return /* @__PURE__ */ h(
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": s.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${i}px ${c}px ${l}px ${d}px`
      },
      children: /* @__PURE__ */ h(
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
function cc({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = K(
    () => ec(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ h(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ h(
        yo,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const lc = Jt(cc);
function dc({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ h("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ D("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ h(
        yo,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Tt(a.highlight.region),
            sourceText: a.highlight.box.text || "",
            rect: a.rect,
            changedAtSeq: 0,
            changedNow: !1
          },
          pageScale: s > 0 ? n / s : 1
        }
      ),
      /* @__PURE__ */ h("span", { className: "reader-edited-badge", style: { left: a.rect.left, top: a.rect.top }, children: "待排版" })
    ] }, a.itemId);
  }) }) : null;
}
const uc = Jt(dc);
function fc(e) {
  return e === "formula" ? 84 : 64;
}
const mc = 6, qe = (e) => e.left + e.width, bt = (e) => e.top + e.height, hc = (e, t) => e.top < bt(t) && t.top < bt(e);
function pc(e, t, n, r) {
  const o = r + mc;
  let a = n, s = 0;
  for (const i of t)
    i === e || !hc(e, i) || (i.left >= qe(e) - 1 && (a = Math.min(a, i.left)), qe(i) <= e.left + 1 && (s = Math.max(s, qe(i))));
  return a - qe(e) >= o ? "side-right" : e.left - s >= o ? "side-left" : go(e, r) ? "outside" : "inside";
}
function gc(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const d = l.left + l.width / 2, f = l.top + l.height / 2;
    d < e.left || d > qe(e) || f < e.top || f > bt(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, qe(l)), i = Math.max(i, bt(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(qe(e) + r, s + n) - c.left, c.height = Math.min(bt(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function bc(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function yc(e, t, n, r, o) {
  const [a, s] = N(null);
  return Re(() => {
    if (!t) {
      s(null);
      return;
    }
    const i = e.current, c = i ? gc(t.rect, bc(i)) : t.rect, l = pc(t.rect, n.map((d) => d.rect), r, fc(o));
    s({ rect: c, placement: l });
  }, [e, o, r, t, n]), a && t ? a : null;
}
function le(e) {
  return typeof e == "string" ? e : "";
}
function vc(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function wc(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Sc(e) {
  return {
    source: le(e == null ? void 0 : e.source_text) || le(e == null ? void 0 : e.unit_source_text),
    translated: le(e == null ? void 0 : e.protected_translated_text) || le(e == null ? void 0 : e.translated_text)
  };
}
const Rc = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function vo(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Ic(e) {
  const t = vo(e).sort((r, o) => le(r.ts).localeCompare(le(o.ts)));
  return t.length ? [
    { text: le(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: le(r.new_text),
      label: Rc[le(r.source)] || le(r.source) || "修订",
      ts: le(r.ts),
      reason: le(r.reason)
    }))
  ].reverse() : [];
}
function Ec(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Pc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return le(r.finished_at) || le(n.finished_at) || "";
}
function Tc(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = vo(e).sort((a, s) => le(a.ts).localeCompare(le(s.ts)));
  for (const a of o) {
    const s = new Date(le(a.ts)).getTime(), i = le(a.reader_item_id) || le(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, le(a.new_text));
  }
  return n;
}
const kc = {
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
function Nc(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = kc[le(n.kind)] || le(n.kind) || "问题", o = le(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Mc = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Ac(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Mc.has(Tt(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const _c = 300, Lc = 72;
function Dc(e, t) {
  if (e.width >= _c && e.height >= Lc)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
function Cc({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, c] = N(!1), [l, d] = N([]), [f, u] = N(""), [m, b] = N(""), [p, w] = N(!1), [y, v] = N(null), [R, g] = N([]), S = r.drafts, E = r.generation, k = B(async (I, P) => {
    if (e)
      try {
        d(Ic(await e.fetchRevisions(I, P)));
      } catch {
        d([]);
      }
  }, [e]);
  z(() => {
    if (s(null), d([]), v(null), g([]), b(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((P) => {
      if (I) return;
      const T = P == null ? void 0 : P.item;
      if (!T) throw new Error("找不到这一段的译文。");
      const M = `${(P == null ? void 0 : P.item_id) || n}`, { source: _, translated: j } = Sc(T);
      s({ readerItemId: n, itemId: M, source: _, current: j }), u(S.get(n) ?? j);
    }).catch((P) => {
      I || v({ tone: "error", message: (P == null ? void 0 : P.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), k(t, n), () => {
      I = !0;
    };
  }, [e, t, n, k]);
  const O = B((I) => {
    u(I), n && S.set(n, I);
  }, [n, S]), L = B(async (I, P) => {
    if (!e || !a || p) return !1;
    const T = I ?? f;
    if (!T.trim()) return !1;
    w(!0), v(null), g([]);
    try {
      const M = await e.revise(t, a.itemId, {
        translated_text: T,
        source: "user",
        reason: (P ?? m).trim() || "在阅读页手动修改",
        ...E.current != null ? { expected_generation: E.current } : {}
      }), _ = Number(M == null ? void 0 : M.generation);
      return Number.isFinite(_) && (E.current = _), S.delete(a.readerItemId), s({ ...a, current: T }), u(T), b(""), (M == null ? void 0 : M.changed) === !1 ? v({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, T), v({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), k(t, a.readerItemId), !0;
    } catch (M) {
      const _ = M;
      return (_ == null ? void 0 : _.reason) === "generation_mismatch" && (E.current = null), v({ tone: "error", message: (_ == null ? void 0 : _.message) || "保存失败，请稍后再试。" }), g(Nc(_ == null ? void 0 : _.issues)), !1;
    } finally {
      w(!1);
    }
  }, [e, a, p, f, m, t, o, k, S, E]), $ = B(() => {
    n && S.delete(n);
  }, [n, S]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: O,
    reason: m,
    setReason: b,
    saving: p,
    status: y,
    issues: R,
    save: L,
    discardDraft: $
  };
}
const wo = "reader-inline-edit";
function xc({ text: e }) {
  const [t, n] = N("");
  return z(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = bo(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ D("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ h("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ h("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function zc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var $;
  const s = e.itemId, i = Cc({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = N(!1), [d, f] = N(!1), u = A(null), m = Dc(e.rect, t), b = K(() => Ac(o), [o]), p = b.indexOf(s), { loaded: w } = i, y = i.saving || i.loading, v = n.blockedReason, R = !w || i.draft === w.current, { close: g, select: S } = n, E = B((I) => {
    const P = b[p + I];
    P && (S(P), a == null || a(P));
  }, [b, p, S, a]), k = B(() => {
    i.discardDraft(), g();
  }, [i, g]), O = B(async (I, P) => {
    await i.save(I, P) && g();
  }, [i, g]);
  z(() => {
    const I = (P) => {
      !P.altKey || P.key !== "ArrowUp" && P.key !== "ArrowDown" || (P.preventDefault(), E(P.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [E]), Re(() => {
    const I = u.current;
    if (!I) return;
    I.style.height = "auto";
    const P = m.mode === "inline" ? m.minHeight : 0;
    I.style.height = `${Math.max(P, I.scrollHeight + 2)}px`;
  }, [i.draft, w, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const L = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ D(dt, { children: [
    m.mode === "popout" ? /* @__PURE__ */ h("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ D(
      "div",
      {
        className: `${wo} is-${m.mode}`,
        style: L,
        role: "group",
        "aria-label": `改第 ${(($ = n.target) == null ? void 0 : $.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (w != null && w.source) ? /* @__PURE__ */ h(
            fe,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((I) => !I),
              children: w.source
            }
          ) : null,
          v ? /* @__PURE__ */ h("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: v }) : null,
          i.loading ? /* @__PURE__ */ h("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          w ? /* @__PURE__ */ h(
            Ea,
            {
              ref: u,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: y || !!v,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), R || O()) : I.key === "Escape" && (I.preventDefault(), k());
              }
            }
          ) : null,
          w ? /* @__PURE__ */ h(xc, { text: i.draft }) : null,
          /* @__PURE__ */ D("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ h(Yn, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: p <= 0, onClick: () => E(-1), children: /* @__PURE__ */ h(la, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ h(Yn, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: p < 0 || p >= b.length - 1, onClick: () => E(1), children: /* @__PURE__ */ h(Wr, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ h(
              qr,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: y || !!v || !w,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), R || O()) : I.key === "Escape" && (I.preventDefault(), k());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ D(
              fe,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": d,
                "data-block-edit-action": "history",
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ h(da, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ h(fe, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: k, children: "取消" }),
            /* @__PURE__ */ h(
              fe,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: y || !!v || R || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  O();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ h("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ h("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ h("li", { children: I }, I)) }) : null,
          d && w && i.history.length ? /* @__PURE__ */ h("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, P) => {
            const T = I.text === w.current, M = [Ec(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ D("li", { "data-block-edit-history": I.label, "data-current": T ? "true" : void 0, children: [
              /* @__PURE__ */ D("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ D("span", { children: [
                  M,
                  T ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                T ? null : /* @__PURE__ */ h(
                  fe,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: y || !!v,
                    onClick: () => {
                      O(I.text, `回到「${M.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ h("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${P}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const So = In(null), Ro = In(null);
function Oc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ h(So.Provider, { value: e, children: /* @__PURE__ */ h(Ro.Provider, { value: t, children: n }) });
}
function ze() {
  return En(So);
}
function Io() {
  return En(Ro);
}
const Be = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Fc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, $c = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Bc = {
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
}, fr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function jc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => fr(o ?? a ?? "", Fc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => fr(o ?? a ?? "", $c)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Bc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Uc(e) {
  return Be(e.translatedBlockText) || Be(e.translated.text) || Be(e.source.text);
}
const Hc = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Wc(e) {
  const t = [];
  for (const n of e) {
    if (!Hc(n)) continue;
    const r = jc(Uc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Vc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Jc = 24, Kc = 60;
function mr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Jc), o = Math.min(e.length, n + t.length + Kc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function qc(e, t, n = 200) {
  const r = Be(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Be(a.translatedBlockText) || Be(a.translated.text), c = i ? mr(i, r) : null, l = c ?? mr(Be(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function Dt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Gc(e, t) {
  const n = Be(t).toLowerCase();
  if (!n || !e) return Dt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Dt(e.slice(a, s))}<mark class="reader-find-mark">${Dt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Dt(e.slice(a));
}
function Zc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Eo = 1.414;
function Yc({
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
  sentinelRef: d,
  regionHighlight: f = null,
  regionTargets: u = [],
  hoveredRegionId: m,
  onHoverRegion: b,
  liveTranslationLayout: p,
  liveTranslationPage: w,
  showLiveTranslation: y = r === "source"
}) {
  var te;
  const v = ze(), R = v == null ? void 0 : v.revisedBlocks, g = v == null ? void 0 : v.blockEdit, S = g == null ? void 0 : g.pendingEdits, E = v == null ? void 0 : v.editBlock, k = (v == null ? void 0 : v.findTerm) || "", O = K(
    () => k ? ({ str: C }) => Gc(C, k) : void 0,
    [k]
  ), L = A(c ?? Eo), [$, I] = N(L.current);
  z(() => {
    c != null && Math.abs(c - L.current) >= 1e-3 && (L.current = c, I(c));
  }, [c]);
  const P = A(d);
  P.current = d;
  const T = A(null), M = A((C) => {
    var q;
    T.current = C, (q = P.current) == null || q.call(P, C);
  }).current, _ = A(null), j = A(`${t}@${n}`);
  Re(() => {
    const C = `${t}@${n}`;
    j.current !== C && (j.current = C, o && Qc(T.current, _.current));
  }, [o, n, t]), z(() => {
    o || nn(_.current);
  }, [o]), z(() => () => nn(_.current), []);
  const F = Math.max(120, Math.floor(t * $)), G = Math.max(F, Math.ceil(s || 0)), ee = Tn(f, t, F), Y = K(
    () => Ji(u, t, F),
    [F, u, t]
  ), [X, me] = N(null), ie = typeof b == "function", ce = ie ? m ?? null : X, ge = (C) => {
    ie ? C !== (m ?? null) && (b == null || b(C)) : me((q) => q === C ? q : C);
  }, W = K(
    () => Y.find((C) => C.itemId === ce) || null,
    [ce, Y]
  ), Q = r === "translated" && ((te = g == null ? void 0 : g.target) == null ? void 0 : te.itemId) || "", pe = K(
    () => Q && Y.find((C) => C.itemId === Q) || null,
    [Q, Y]
  ), ve = W ? Tt(W.highlight.region) : "", he = yc(T, o ? W : null, Y, t, ve), Ve = (C) => {
    var Ee, _e, ke, tt;
    if (C.pointerType === "touch") return;
    if (C.buttons !== 0) {
      ge(null);
      return;
    }
    if ((_e = (Ee = C.target) == null ? void 0 : Ee.closest) != null && _e.call(Ee, `.${mo}`) || (tt = (ke = C.target) == null ? void 0 : ke.closest) != null && tt.call(ke, `.${wo}`)) return;
    const q = C.currentTarget.getBoundingClientRect(), ne = C.clientX - q.left, ae = C.clientY - q.top, de = he == null ? void 0 : he.rect;
    if (de && (he == null ? void 0 : he.placement) === "outside" && ne >= de.left - 4 && ne <= de.left + po && ae >= de.top - ho && ae <= de.top) return;
    const ue = ur(Y, ne, ae);
    ge((ue == null ? void 0 : ue.itemId) || null);
  }, Ie = (C) => {
    if (C.pointerType === "mouse") return;
    const q = C.currentTarget.getBoundingClientRect(), ne = ur(
      Y,
      C.clientX - q.left,
      C.clientY - q.top
    );
    ge((ne == null ? void 0 : ne.itemId) || null);
  }, U = (C) => {
    !Number.isFinite(C) || C <= 0 || Math.abs(L.current - C) < 1e-3 || (L.current = C, I(C), l == null || l(e, C));
  };
  return /* @__PURE__ */ D(
    "div",
    {
      ref: M,
      [Ue]: e,
      [He]: r,
      [kn]: F,
      className: Nn,
      onPointerMoveCapture: Ve,
      onPointerDown: Ie,
      onPointerLeave: (C) => {
        C.pointerType === "mouse" && ge(null);
      },
      style: {
        width: t,
        height: G,
        minHeight: G
      },
      children: [
        o ? /* @__PURE__ */ h(
          Pa,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: O,
            renderAnnotationLayer: !1,
            className: Xr,
            loading: /* @__PURE__ */ h(
              "div",
              {
                className: Bt,
                style: { width: t, height: F }
              }
            ),
            onLoadSuccess: (C) => {
              try {
                const q = C.getViewport({ scale: 1 });
                if (q.width > 0) {
                  const ne = q.height / q.width;
                  U(ne);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              nn(_.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ h(
          "div",
          {
            className: Bt,
            style: { width: t, height: F },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ h("div", { ref: _, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        ee ? /* @__PURE__ */ h(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: ee,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && y ? /* @__PURE__ */ h(
          lc,
          {
            layoutPage: p,
            pageState: w,
            width: t,
            height: F
          }
        ) : null,
        o && r === "translated" && (S != null && S.size) ? /* @__PURE__ */ h(uc, { targets: Y, edits: S, width: t, excludeId: pe == null ? void 0 : pe.itemId }) : null,
        o && pe && g ? /* @__PURE__ */ h(
          zc,
          {
            target: pe,
            page: { width: t, height: F },
            edit: g,
            showSource: !!(v != null && v.editShowsSource),
            regions: v == null ? void 0 : v.regions,
            jumpToBlock: v == null ? void 0 : v.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ h("div", { className: "reader-revised-markers", "aria-hidden": "true", children: Y.filter((C) => R.has(C.itemId)).map((C) => /* @__PURE__ */ h(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": C.itemId,
            style: { left: C.rect.left, top: C.rect.top, height: C.rect.height }
          },
          C.itemId
        )) }) : null,
        /* @__PURE__ */ h(
          Xi,
          {
            target: o && (W == null ? void 0 : W.itemId) !== (pe == null ? void 0 : pe.itemId) ? W : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: W && (R == null ? void 0 : R.get(W.itemId)) || 0,
            onEdit: E,
            frameRect: he == null ? void 0 : he.rect,
            placement: he == null ? void 0 : he.placement
          }
        )
      ]
    }
  );
}
const Xc = Jt(Yc);
function Qc(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function nn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const el = 2 * 1024 * 1024;
function tl(e) {
  const t = new Gr.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const rn = 5, nl = "120% 0px", rl = 120, ol = "25% 0px";
let hr = 1;
const pr = /* @__PURE__ */ new WeakMap();
function al(e) {
  if (!e) return 0;
  const t = pr.get(e);
  if (t) return t;
  const n = hr;
  return hr += 1, pr.set(e, n), n;
}
function sl() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const il = Br(
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
    onMetrics: d,
    onLoadSuccess: f,
    onLoadError: u,
    onNumPagesChange: m,
    activeRegion: b = null,
    regions: p = [],
    readerMetadata: w = null,
    hoveredRegionId: y = null,
    onHoverRegion: v,
    liveTranslation: R,
    showLiveTranslation: g = t === "source",
    liveTranslationPendingLabel: S = "",
    paneAction: E
  }, k) {
    Wi();
    const { file: O, loading: L, error: $ } = ds(n, r), I = `${n}\0${al(O)}`, P = A(I);
    P.current = I;
    const T = K(() => {
      const x = os(O);
      return x ? "ranged" in x ? { range: tl(x.ranged) } : x : null;
    }, [O, n]), [M, _] = N(0), [j, F] = N(""), [G, ee] = N(null), [Y, X] = N(480), me = A(null), ie = A(0), ce = K(() => sl(), []), ge = K(() => ({
      cMapUrl: wt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: wt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: el,
      disableAutoFetch: !0
    }), []);
    Pn(k, () => G, [G]), z(() => {
      const x = (H) => {
        ie.current = H, X(H);
      }, J = (H) => {
        const oe = Os(H, ie.current);
        if (oe !== "ignore") {
          if (me.current && clearTimeout(me.current), oe === "immediate") {
            x(H);
            return;
          }
          me.current = setTimeout(() => x(H), to);
        }
      }, V = !!(c && c >= 80);
      J(V ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const se = !V && i && typeof ResizeObserver < "u" ? new ResizeObserver((H) => {
        var oe, be;
        J(((be = (oe = H[0]) == null ? void 0 : oe.contentRect) == null ? void 0 : be.width) ?? i.clientWidth);
      }) : null;
      return se && i && se.observe(i), () => {
        se == null || se.disconnect(), me.current && clearTimeout(me.current);
      };
    }, [c, i, a]);
    const W = K(
      () => Cs(Y, o),
      [Y, o]
    ), [Q, pe] = N(() => /* @__PURE__ */ new Map()), [ve, he] = N(() => /* @__PURE__ */ new Set()), [Ve, Ie] = N(() => /* @__PURE__ */ new Set()), U = A(/* @__PURE__ */ new Map()), te = A(null), C = A(null), [q, ne] = N(() => /* @__PURE__ */ new Set()), ae = A(/* @__PURE__ */ new Map()), de = B((x, J) => {
      pe((V) => {
        if (V.get(x) === J) return V;
        const Z = new Map(V);
        return Z.set(x, J), Z;
      });
    }, []), ue = B((x, J) => {
      const V = U.current, Z = V.get(x), se = [te.current, C.current];
      if (Z)
        for (const H of se)
          try {
            H == null || H.unobserve(Z);
          } catch {
          }
      if (J) {
        V.set(x, J);
        for (const H of se)
          try {
            H == null || H.observe(J);
          } catch {
          }
      } else
        V.delete(x);
    }, []), Ee = A(/* @__PURE__ */ new Map()), _e = B((x) => {
      const J = Ee.current;
      let V = J.get(x);
      return V || (V = (Z) => ue(x, Z), J.set(x, V)), V;
    }, [ue]);
    z(() => {
      if (typeof IntersectionObserver > "u") return;
      const x = ae.current, J = new IntersectionObserver(
        (V) => {
          const Z = [], se = [];
          for (const H of V) {
            const oe = H.target, be = Ut(oe);
            Number.isFinite(be) && (H.isIntersecting ? Z : se).push(be);
          }
          if ((Z.length || se.length) && he((H) => {
            let oe = null;
            for (const be of Z)
              H.has(be) || (oe = oe || new Set(H), oe.add(be));
            for (const be of se)
              H.has(be) && (oe = oe || new Set(H), oe.delete(be));
            return oe || H;
          }), Z.length) {
            for (const H of Z) {
              const oe = x.get(H);
              oe && (clearTimeout(oe), x.delete(H));
            }
            Ie((H) => {
              let oe = null;
              for (const be of Z)
                H.has(be) || (oe = oe || new Set(H), oe.add(be));
              return oe || H;
            });
          }
          for (const H of se)
            x.has(H) || x.set(H, setTimeout(() => {
              x.delete(H), Ie((oe) => {
                if (!oe.has(H)) return oe;
                const be = new Set(oe);
                return be.delete(H), be;
              });
            }, rl));
        },
        { root: i, rootMargin: nl, threshold: 0 }
      );
      te.current = J;
      for (const V of U.current.values())
        try {
          J.observe(V);
        } catch {
        }
      return () => {
        J.disconnect(), te.current === J && (te.current = null);
        for (const V of x.values()) clearTimeout(V);
        x.clear();
      };
    }, [i]), z(() => {
      if (typeof IntersectionObserver > "u") return;
      const x = new IntersectionObserver(
        (J) => {
          ne((V) => {
            let Z = null;
            for (const se of J) {
              const H = Ut(se.target);
              !Number.isFinite(H) || se.isIntersecting === V.has(H) || (Z = Z || new Set(V), se.isIntersecting ? Z.add(H) : Z.delete(H));
            }
            return Z || V;
          });
        },
        { root: i, rootMargin: ol, threshold: 0 }
      );
      C.current = x;
      for (const J of U.current.values())
        try {
          x.observe(J);
        } catch {
        }
      return () => {
        x.disconnect(), C.current === x && (C.current = null);
      };
    }, [i]);
    const ke = !!i && typeof IntersectionObserver < "u";
    Re(() => {
      _(0), F(""), he(/* @__PURE__ */ new Set()), Ie(/* @__PURE__ */ new Set()), pe(/* @__PURE__ */ new Map()), U.current.clear();
      const x = ae.current;
      for (const J of x.values()) clearTimeout(J);
      x.clear(), m == null || m(0, t);
    }, [I, m, t]);
    const tt = B(
      ({ numPages: x }) => {
        P.current === I && (_(x), F(""), m == null || m(x, t), f == null || f({ numPages: x, pane: t }));
      },
      [I, f, m, t]
    ), Zt = B(
      (x) => {
        if (P.current !== I) return;
        const J = (x == null ? void 0 : x.message) || "PDF 解析失败";
        F(J), _(0), m == null || m(0, t), u == null || u(x, t);
      },
      [I, u, m, t]
    ), Oe = K(
      () => M > 0 ? Array.from({ length: M }, (x, J) => J + 1) : [],
      [M]
    );
    z(() => {
      typeof IntersectionObserver < "u" || Ie(new Set(Oe));
    }, [Oe]);
    const Fe = K(
      () => Zn(b, w, t),
      [b, w, t]
    ), Je = K(() => {
      const x = /* @__PURE__ */ new Map();
      for (const J of p) {
        const V = Zn(J, w, t);
        if (!V) continue;
        const Z = x.get(V.box.page) || [];
        Z.push(V), x.set(V.box.page, Z);
      }
      return x;
    }, [t, w, p]), Nt = K(() => {
      const x = /* @__PURE__ */ new Set();
      if (!y) return x;
      for (const [J, V] of Je)
        V.some((Z) => Z.itemId === y) && x.add(J);
      return x;
    }, [y, Je]), Mt = K(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Oe);
      if (ve.size === 0) {
        const V = Math.min(M, rn * 2 + 1);
        return new Set(Array.from({ length: V }, (Z, se) => se + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const V of ve)
        for (let Z = -rn; Z <= rn; Z++) {
          const se = V + Z;
          se >= 1 && se <= M && J.add(se);
        }
      return J;
    }, [M, Oe, i, a, ve]), nt = !n || !!$ || !!j, At = n && ($ || j) || s;
    return /* @__PURE__ */ D(
      "section",
      {
        ref: ee,
        className: `reader-panel ${Ts}${a ? "" : " is-hidden"}`,
        [He]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (R == null ? void 0 : R.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          E ? /* @__PURE__ */ h("div", { className: "reader-react-pdf-pane-action", children: E }) : null,
          S ? /* @__PURE__ */ D("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ h("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ h("span", { children: S })
          ] }) : null,
          nt && !L ? /* @__PURE__ */ h("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: At }) : null,
          L ? /* @__PURE__ */ h("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !$ ? /* @__PURE__ */ h("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ h(
            Ta,
            {
              file: T,
              loading: null,
              error: null,
              options: ge,
              onLoadSuccess: tt,
              onLoadError: Zt,
              className: "reader-react-pdf-document",
              children: Oe.map((x) => {
                if (Mt.has(x))
                  return /* @__PURE__ */ h(
                    Xc,
                    {
                      pane: t,
                      pageNumber: x,
                      width: W,
                      devicePixelRatio: ce,
                      active: Ve.has(x),
                      textLayer: !ke || q.has(x),
                      syncedMinHeight: (l == null ? void 0 : l.get(x)) || 0,
                      onMetrics: d,
                      cachedAspect: Q.get(x),
                      onAspectChange: de,
                      sentinelRef: _e(x),
                      regionHighlight: (Fe == null ? void 0 : Fe.box.page) === x ? Fe : null,
                      regionTargets: Je.get(x),
                      hoveredRegionId: y && Nt.has(x) ? y : null,
                      onHoverRegion: v,
                      liveTranslationLayout: R == null ? void 0 : R.layoutByPage.get(x - 1),
                      liveTranslationPage: R == null ? void 0 : R.pagesByPage.get(x - 1),
                      showLiveTranslation: g
                    },
                    `${t}-${x}`
                  );
                const V = Q.get(x) ?? Eo, Z = Math.max(120, Math.floor(W * V)), se = Math.max(Z, Math.ceil((l == null ? void 0 : l.get(x)) || 0));
                return /* @__PURE__ */ h(
                  "div",
                  {
                    ref: _e(x),
                    [Ue]: x,
                    [He]: t,
                    [kn]: Z,
                    className: `${Nn} is-placeholder`,
                    style: {
                      width: W,
                      height: se,
                      minHeight: se
                    },
                    children: /* @__PURE__ */ h(
                      "div",
                      {
                        className: Bt,
                        style: { width: W, height: Z },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${x}`
                );
              })
            },
            I
          ) }) : null
        ]
      }
    );
  }
), gr = Jt(il), cl = 2e3, ll = 6, dl = 500, br = "reader-react-resizing";
function ul(e, t) {
  const n = A(null), r = A(null);
  Re(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const g = fl(e), S = zt(e, g);
      if (!S) return;
      s = { pane: g, progress: S, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let d = 0, f = null, u = e.scrollHeight, m = u, b = 0, p = l;
    const w = /* @__PURE__ */ new WeakMap(), y = typeof ResizeObserver > "u" ? null : new ResizeObserver((g) => {
      let S = !1;
      for (const E of g) {
        const k = Math.round(E.contentRect.height);
        w.has(E.target) && w.get(E.target) !== k && (S = !0), w.set(E.target, k);
      }
      S && Rt(e, c, "auto", i);
    }), v = () => {
      var g;
      f && clearTimeout(f), cancelAnimationFrame(d), y == null || y.disconnect(), e.classList.remove(br);
      for (const S of yr) e.removeEventListener(S, v);
      ((g = r.current) == null ? void 0 : g.stop) === v && (r.current = null);
    }, R = () => {
      Rt(e, c, "auto", i);
      const g = e.scrollHeight;
      b = g === m ? b + 1 : 0, m = g;
      const S = performance.now() - p;
      b >= ll && (g !== u || S > dl) || S > cl ? v() : d = requestAnimationFrame(R);
    };
    for (const g of yr) e.addEventListener(g, v, { passive: !0 });
    for (const g of Array.from(e.children)) y == null || y.observe(g);
    e.classList.add(br), r.current = { ...s, stop: v }, f = setTimeout(() => {
      f = null, p = performance.now(), u = e.scrollHeight, m = u, b = 0, d = requestAnimationFrame(R);
    }, to);
  }, [e, t]), z(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function fl(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ue}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(He) || null;
  }
  return null;
}
const yr = ["wheel", "touchstart", "keydown", "pointerdown"];
function Po(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function ml(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function hl({ compare: e, onDone: t }) {
  return /* @__PURE__ */ D("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ h("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ h("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ h("li", { children: /* @__PURE__ */ D(
        fe,
        {
          className: "reader-version-compare-item",
          "data-version-id": n.versionId,
          "aria-current": o ? "true" : void 0,
          disabled: r,
          onClick: () => {
            e.choose(n.versionId), t();
          },
          children: [
            /* @__PURE__ */ h("span", { className: "reader-version-compare-name", children: n.name }),
            /* @__PURE__ */ h("span", { className: "reader-version-compare-time", children: Po(n.createdAt) }),
            r ? /* @__PURE__ */ h("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ h(ua, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ h(fa, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ h("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ D("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ D(
        fe,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ h(ma, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ D(
        fe,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ h(ha, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function vr({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = ml(t), a = [e === "compare" ? "对比" : "正在读", r, Po(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ D("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ h("em", { children: "RetainPDF" }),
    /* @__PURE__ */ h("strong", { children: o }),
    /* @__PURE__ */ h("span", { children: a })
  ] });
}
function pl({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return Re(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const d = e.querySelector(`[${He}="${l}"]`), f = d == null ? void 0 : d.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${He}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ D("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ h("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ h(vr, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ h("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ h(vr, { role: "reading", ...n }) }) : null
  ] });
}
const gl = () => () => {
}, wr = () => null;
function bl({
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
function yl(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function vl(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function wl(e) {
  const t = ze(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? kt, b = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, p = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), w = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, y = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, v = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, R = (t == null ? void 0 : t.compareVersion) ?? null, g = (R == null ? void 0 : R.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", S = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = R ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, O = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), L = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), $ = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), I = e.regions ?? (t == null ? void 0 : t.regions) ?? [], P = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [M, _] = N(null), j = jr(
    T ? T.subscribe : gl,
    T ? () => T.get().itemId : wr,
    T ? () => T.get().itemId : wr
  ), F = T ? j : M, G = B((me) => {
    T ? T.set(me, "pdf") : _(me);
  }, [T]), ee = bl({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: d
  }), X = Number.isFinite(b) && b > 0 ? yl(
    b,
    n || r,
    typeof document > "u" ? b * 2 : document.documentElement.clientWidth
  ) : null;
  return ul(u, X), /* @__PURE__ */ D(
    "div",
    {
      ref: f,
      className: Ps,
      "data-reader-region-count": I.length,
      "data-reader-structured-region-count": I.filter(oa).length,
      "data-reader-metadata-ready": P ? "true" : "false",
      children: [
        /* @__PURE__ */ D(
          "main",
          {
            className: `${Es} reader-mode-${ee.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              w ? /* @__PURE__ */ h(
                gr,
                {
                  pane: "source",
                  url: g,
                  preloadedFile: E,
                  userZoom: m,
                  visible: ee.showSource,
                  scrollRoot: u,
                  pageWidthOverride: X,
                  rowHeights: ee.compareMode ? p : void 0,
                  onMetrics: O,
                  emptyLabel: v ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: L,
                  activeRegion: $,
                  regions: (R == null ? void 0 : R.regions) ?? I,
                  readerMetadata: P,
                  hoveredRegionId: F,
                  onHoverRegion: G,
                  liveTranslation: d ? o : void 0,
                  showLiveTranslation: d,
                  liveTranslationPendingLabel: d ? vl(o) : "",
                  paneAction: d ? /* @__PURE__ */ D(dt, { children: [
                    e.sourcePaneAction,
                    /* @__PURE__ */ h(
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
                R ? `compare:${R.url}` : "source"
              ) : null,
              y ? /* @__PURE__ */ h(
                gr,
                {
                  pane: "translated",
                  url: S,
                  preloadedFile: k,
                  userZoom: m,
                  visible: ee.showTranslated,
                  scrollRoot: u,
                  pageWidthOverride: X,
                  rowHeights: ee.compareMode ? p : void 0,
                  onMetrics: O,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: L,
                  activeRegion: $,
                  regions: I,
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
        R ? /* @__PURE__ */ h(pl, { shellEl: u, left: R.left, right: R.right }) : null
      ]
    }
  );
}
const Sl = [
  { id: "source", label: "原文", Icon: Vr },
  { id: "compare", label: "对照", Icon: Jr },
  { id: "translated", label: "译文", Icon: Kr }
];
function Rl(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Il(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function El(e) {
  const t = ze(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, i = a ? Rl(a.state) : "";
  return /* @__PURE__ */ D("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ D(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || i,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ h(pa, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ h("span", { className: "reader-live-translation-toggle-label", children: i })
        ]
      }
    ) : null,
    /* @__PURE__ */ h("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Sl.map(({ id: c, label: l, Icon: d }) => {
      const f = n === c, u = Il({
        id: c,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ D(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${f ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": f,
          "aria-label": l,
          title: u ? `${l} 需要文档任务` : l,
          disabled: u,
          onClick: () => o(c),
          children: [
            /* @__PURE__ */ h(d, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ h("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        c
      );
    }) })
  ] });
}
const Pl = Br(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
        /* @__PURE__ */ h("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2.5" }),
        /* @__PURE__ */ h("path", { d: "M6 15V9l2.5 3L11 9v6" }),
        /* @__PURE__ */ h("path", { d: "M16.5 9v6M14.5 13l2 2 2-2" })
      ]
    }
  );
}), Tl = Pl, kl = {
  markdown: { label: "Markdown", short: "MD", Icon: Tl, needsJob: !0 }
}, Nl = no.map(
  (e) => ({ id: e, ...kl[e] })
);
function To() {
  return Nl.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Ml(e) {
  const t = ze(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ h(dt, { children: To().map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const d = n === s, f = l && r, u = d ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ D(
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
          /* @__PURE__ */ h(c, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ h("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function Al(e) {
  const t = ze(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = To().map(({ id: c, label: l, short: d, Icon: f, needsJob: u }) => ({
    key: c,
    label: l,
    short: d,
    Icon: f,
    disabled: u && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ D("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ h("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: d, disabled: f, selected: u, badge: m, onClick: b }) => /* @__PURE__ */ D(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": u,
        className: `reader-assistant-dock-tab${u ? " is-active" : ""}`,
        title: f ? `${l} 需打开任务阅读` : l,
        disabled: f,
        onClick: b,
        children: [
          /* @__PURE__ */ h(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ h("span", { className: "reader-assistant-dock-tab-label", children: l }),
          m ? /* @__PURE__ */ h("span", { className: "reader-assistant-dock-badge", children: m }) : null
        ]
      },
      c
    )) }),
    /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ h(Kt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function _l(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Ll(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Dl(e) {
  return e / 100 * window.innerHeight;
}
function Cl(e) {
  return e / 100 * window.innerWidth;
}
function xl(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function gt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = xl(n);
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
      r = Ll(t, o);
      break;
    }
    case "em": {
      r = _l(t, o);
      break;
    }
    case "vh": {
      r = Dl(o);
      break;
    }
    case "vw": {
      r = Cl(o);
      break;
    }
  }
  return r;
}
function we(e) {
  return parseFloat(e.toFixed(3));
}
function lt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function yn(e) {
  const { panels: t } = e, n = lt({ group: e });
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
      const d = gt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = we(d / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const d = gt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = we(d / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const d = gt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = we(d / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const d = gt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = we(d / n * 100);
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
function re(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function vn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? zl : Ol
  );
}
function zl(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Ol(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function ko(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function No(e, t) {
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
function Fl({
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
    const { x: i, y: c } = No(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return re(o, "No rect found"), o;
}
let Ct;
function $l() {
  return Ct === void 0 && (typeof matchMedia == "function" ? Ct = !!matchMedia("(pointer:coarse)").matches : Ct = !1), Ct;
}
function Mo(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = vn(
    n,
    Array.from(t.children).filter(ko).map((b) => ({ element: b }))
  ).map(({ element: b }) => b), s = [];
  let i = !1, c = !1, l = -1, d = -1, f = 0, u, m = [];
  {
    let b = -1;
    for (const p of a)
      p.hasAttribute("data-panel") && (b++, p.hasAttribute("data-disabled") || (f++, l === -1 && (l = b), d = b));
  }
  if (f > 1) {
    let b = -1;
    for (const p of a)
      if (p.hasAttribute("data-panel")) {
        b++;
        const w = r.find(
          (y) => y.element === p
        );
        if (w) {
          if (u) {
            const y = u.element.getBoundingClientRect(), v = p.getBoundingClientRect();
            let R;
            if (c) {
              const g = n === "horizontal" ? new DOMRect(
                y.right,
                y.top,
                0,
                y.height
              ) : new DOMRect(
                y.left,
                y.bottom,
                y.width,
                0
              ), S = n === "horizontal" ? new DOMRect(v.left, v.top, 0, v.height) : new DOMRect(v.left, v.top, v.width, 0);
              switch (m.length) {
                case 0: {
                  R = [
                    g,
                    S
                  ];
                  break;
                }
                case 1: {
                  const E = m[0], k = Fl({
                    orientation: n,
                    rects: [y, v],
                    targetRect: E.element.getBoundingClientRect()
                  });
                  R = [
                    E,
                    k === y ? S : g
                  ];
                  break;
                }
                default: {
                  R = m;
                  break;
                }
              }
            } else
              m.length ? R = m : R = [
                n === "horizontal" ? new DOMRect(
                  y.right,
                  v.top,
                  v.left - y.right,
                  v.height
                ) : new DOMRect(
                  v.left,
                  y.bottom,
                  v.width,
                  v.top - y.bottom
                )
              ];
            for (const g of R) {
              let S = "width" in g ? g : g.element.getBoundingClientRect();
              const E = $l() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < E) {
                const O = E - S.width;
                S = new DOMRect(
                  S.x - O / 2,
                  S.y,
                  S.width + O,
                  S.height
                );
              }
              if (S.height < E) {
                const O = E - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - O / 2,
                  S.width,
                  S.height + O
                );
              }
              const k = b <= l || b > d;
              !i && !k && s.push({
                group: e,
                groupSize: lt({ group: e }),
                panels: [u, w],
                separator: "width" in g ? void 0 : g,
                rect: S
              }), i = !1;
            }
          }
          c = !1, u = w, m = [];
        }
      } else if (p.hasAttribute("data-separator")) {
        p.ariaDisabled !== null && (i = !0);
        const w = o.find(
          (y) => y.element === p
        );
        w ? m.push(w) : (u = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var $e;
class Ao {
  constructor() {
    Kn(this, $e, {});
  }
  addListener(t, n) {
    const r = ft(this, $e)[t];
    return r === void 0 ? ft(this, $e)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = ft(this, $e)[t];
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
    qn(this, $e, {});
  }
  removeListener(t, n) {
    const r = ft(this, $e)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
$e = new WeakMap();
let it = {
  cursorFlags: 0,
  state: "inactive"
};
const _n = new Ao();
function Ze() {
  return it;
}
function Bl(e) {
  return _n.addListener("change", e);
}
function jl(e) {
  const t = it, n = { ...it };
  n.cursorFlags = e, it = n, _n.emit("change", {
    prev: t,
    next: n
  });
}
function ct(e) {
  const t = it;
  it = e, _n.emit("change", {
    prev: t,
    next: e
  });
}
const Ul = (e) => e, on = () => {
}, _o = 1, Lo = 2, Do = 4, Co = 8, Sr = 3, Rr = 12;
let xt;
function Ir() {
  return xt === void 0 && (xt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (xt = !0)), xt;
}
function Hl({
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
        if (e && Ir()) {
          const a = (e & _o) !== 0, s = (e & Lo) !== 0, i = (e & Do) !== 0, c = (e & Co) !== 0;
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
    return Ir() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Er = /* @__PURE__ */ new WeakMap();
function Ln(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Er.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Ze();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Hl({
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
  Er.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Me = /* @__PURE__ */ new Map();
const xo = new Ao();
function Wl(e) {
  Me = new Map(Me), Me.delete(e);
}
function Pr(e, t) {
  for (const [n] of Me)
    if (n.id === e)
      return n;
}
function je(e, t) {
  for (const [n, r] of Me)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function Qe() {
  return Me;
}
function Dn(e, t) {
  return xo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function xe(e, t, n) {
  const r = Me.get(e);
  Me = new Map(Me), Me.set(e, t), xo.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function zo(e) {
  const t = Ze();
  let n = !1;
  switch (t.state) {
    case "active":
      ct({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Ln(e), n = !0, t.hitRegions.forEach((r) => {
        const o = je(r.group.id, !0);
        xe(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Tr(e) {
  e.defaultPrevented || zo(e.currentTarget);
}
function Vl(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = No(n, a.rect);
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
function Jl(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Kl(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Mr(e),
    b: Mr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  re(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Nr(kr(n.a)),
    b: Nr(kr(n.b))
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
const ql = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Gl(e) {
  const t = getComputedStyle(Oo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Zl(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Gl(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || ql.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function kr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (re(n, "Missing node"), Zl(n)) return n;
  }
  return null;
}
function Nr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Mr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Oo(e);
  return t;
}
function Oo(e) {
  const { parentNode: t } = e;
  return Jl(t) ? t.host : t;
}
function Yl(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Xl({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!ko(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Kl(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Yl(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Cn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Mo(o), s = Vl(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Xl({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Ql(e, t) {
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
function st({
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
  if (Ne(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Ne(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = we(r), r;
}
function It({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (ye(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [d, f] = r;
  re(d != null, "Invalid first pivot index"), re(f != null, "Invalid second pivot index");
  let u = 0;
  switch (a) {
    case "keyboard": {
      {
        const p = e < 0 ? f : d, w = n[p];
        re(
          w,
          `Panel constraints not found for index ${p}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: v,
          minSize: R = 0
        } = w;
        if (v) {
          const g = i[p];
          if (re(
            g != null,
            `Previous layout not found for panel index ${p}`
          ), ye(g, y)) {
            const S = R - g;
            Ne(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const p = e < 0 ? d : f, w = n[p];
        re(
          w,
          `No panel constraints found for index ${p}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: v,
          minSize: R = 0
        } = w;
        if (v) {
          const g = i[p];
          if (re(
            g != null,
            `Previous layout not found for panel index ${p}`
          ), ye(g, R)) {
            const S = g - y;
            Ne(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const p = e < 0 ? f : d, w = n[p];
      re(
        w,
        `Panel constraints not found for index ${p}`
      );
      const y = i[p], { collapsible: v, collapsedSize: R, minSize: g } = w;
      if (v && Ne(y, g) < 0)
        if (e > 0) {
          const S = g - R, E = S / 2, k = y + e;
          Ne(k, g) < 0 && (e = Ne(e, E) <= 0 ? 0 : S);
        } else {
          const S = g - R, E = 100 - S / 2, k = y - e;
          Ne(k, g) < 0 && (e = Ne(100 + e, E) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const p = e < 0 ? 1 : -1;
    let w = e < 0 ? f : d, y = 0;
    for (; ; ) {
      const R = i[w];
      re(
        R != null,
        `Previous layout not found for panel index ${w}`
      );
      const g = st({
        overrideDisabledPanels: s,
        panelConstraints: n[w],
        prevSize: R,
        size: 100
      }) - R;
      if (y += g, w += p, w < 0 || w >= n.length)
        break;
    }
    const v = Math.min(Math.abs(e), Math.abs(y));
    e = e < 0 ? 0 - v : v;
  }
  {
    let p = e < 0 ? d : f;
    for (; p >= 0 && p < n.length; ) {
      const w = Math.abs(e) - Math.abs(u), y = i[p];
      re(
        y != null,
        `Previous layout not found for panel index ${p}`
      );
      const v = y - w, R = st({
        overrideDisabledPanels: s,
        panelConstraints: n[p],
        prevSize: y,
        size: v
      });
      if (!ye(y, R) && (u += y - R, l[p] = R, u.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? p-- : p++;
    }
  }
  if (Ql(c, l))
    return o;
  {
    const p = e < 0 ? f : d, w = i[p];
    re(
      w != null,
      `Previous layout not found for panel index ${p}`
    );
    const y = w + u, v = st({
      overrideDisabledPanels: s,
      panelConstraints: n[p],
      prevSize: w,
      size: y
    });
    if (l[p] = v, !ye(v, y)) {
      let R = y - v, g = e < 0 ? f : d;
      for (; g >= 0 && g < n.length; ) {
        const S = l[g];
        re(
          S != null,
          `Previous layout not found for panel index ${g}`
        );
        const E = S + R, k = st({
          overrideDisabledPanels: s,
          panelConstraints: n[g],
          prevSize: S,
          size: E
        });
        if (ye(S, k) || (R -= k - S, l[g] = k), ye(R, 0))
          break;
        e > 0 ? g-- : g++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (p, w) => w + p,
    0
  );
  if (!ye(m, 100, 0.1))
    return o;
  const b = Object.keys(o);
  return l.reduce((p, w, y) => (p[b[y]] = w, p), {});
}
function Ye(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ne(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Xe({
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
  if (!ye(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      re(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    re(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    re(l != null, `No layout data found for index ${i}`);
    const d = st({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != d && (a += l - d, r[i] = d);
  }
  if (!ye(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      re(c != null, `No layout data found for index ${i}`);
      const l = c + a, d = st({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== d && (a -= d - c, r[i] = d, ye(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function Fo({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = Qe();
    for (const [
      l,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: f,
        layout: u,
        groupSize: m,
        separatorToPanels: b
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: f,
          group: l,
          groupSize: m,
          layout: u,
          separatorToPanels: b
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
    prevLayout: d,
    derivedPanelConstraints: f
  }) => {
    const u = a(), m = l.findIndex((w) => w.id === t), b = m === 0, p = m === l.length - 1;
    if (p && c < u && (b || l.slice(0, m).every((w, y) => {
      const v = f[y];
      return (v == null ? void 0 : v.collapsible) && ye(v.collapsedSize, d[v.panelId]);
    }))) {
      const w = l.slice(0, m).reduce((y, v) => y + d[v.id], 0);
      return {
        ...d,
        [t]: we(100 - w)
      };
    }
    return It({
      delta: p ? u - c : c - u,
      initialLayout: d,
      panelConstraints: f,
      pivotIndices: p ? [m - 1, m] : [m, m + 1],
      prevLayout: d,
      trigger: "imperative-api"
    });
  }, i = (c) => {
    const l = a();
    if (c === l)
      return;
    const {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: f,
      group: u,
      groupSize: m,
      layout: b,
      separatorToPanels: p
    } = n(), w = s({
      nextSize: c,
      panels: u.panels,
      prevLayout: b,
      derivedPanelConstraints: f
    }), y = Xe({
      layout: w,
      panelConstraints: f
    });
    Ye(b, y) || xe(u, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: f,
      groupSize: m,
      layout: y,
      separatorToPanels: p
    });
  };
  return {
    collapse: () => {
      const { collapsible: c, collapsedSize: l } = r(), { mutableValues: d } = o(), f = a();
      c && f !== l && (d.expandToSize = f, i(l));
    },
    expand: () => {
      const { collapsible: c, collapsedSize: l, minSize: d } = r(), { mutableValues: f } = o(), u = a();
      if (c && u === l) {
        let m = f.expandToSize ?? d;
        m === 0 && (m = 1), i(m);
      }
    },
    getSize: () => {
      const { group: c } = n(), l = a(), { element: d } = o(), f = c.orientation === "horizontal" ? d.offsetWidth : d.offsetHeight;
      return {
        asPercentage: l,
        inPixels: f
      };
    },
    isCollapsed: () => {
      const { collapsible: c, collapsedSize: l } = r(), d = a();
      return c && ye(l, d);
    },
    resize: (c) => {
      const { group: l } = n(), { element: d } = o(), f = lt({ group: l }), u = gt({
        groupSize: f,
        panelElement: d,
        styleProp: c
      }), m = we(u / f * 100);
      i(m);
    }
  };
}
function Ar(e) {
  if (e.defaultPrevented)
    return;
  const t = Qe();
  Cn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Fo({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Ot(e) {
  const t = Qe();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function $o({
  groupId: e
}) {
  const t = () => {
    const n = Qe();
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
      } = t(), l = Xe({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (Ye(i, l) || xe(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function Ke(e, t) {
  const n = Ot(e), r = je(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  re(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  re(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = $o({ groupId: n.id }).getLayout(), c = It({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = Xe({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  Ye(i, l) || xe(
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
function _r(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Ot(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && Ke(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Ke(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Ke(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Ke(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Ke(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Ot(t), o = je(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (u) => u.element === t
        );
        re(c, "Matching separator not found");
        const l = i.get(c);
        re(l, "Matching panels not found");
        const d = l[0], f = a.find(
          (u) => u.panelId === d.id
        );
        if (re(f, "Panel metadata not found"), f.collapsible) {
          const u = s[d.id], m = f.collapsedSize === u ? r.mutableState.expandedPanelSizes[d.id] ?? f.minSize : f.collapsedSize;
          Ke(t, m - u);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Ot(t).separators.map(
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
        e.preventDefault(), Ke(t, -100);
        break;
      }
    }
}
function Lr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = Qe(), n = Cn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), ct({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Bo({
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
    const { group: d, groupSize: f } = l, { orientation: u, panels: m } = d, { disableCursor: b } = d.mutableState;
    let p = 0;
    a ? u === "horizontal" ? p = (t.clientX - a.x) / f * 100 : p = (t.clientY - a.y) / f * 100 : u === "horizontal" ? p = t.clientX < 0 ? -100 : 100 : p = t.clientY < 0 ? -100 : 100;
    const w = r.get(d), y = o.get(d);
    if (!w || !y)
      return;
    const {
      defaultLayoutDeferred: v,
      derivedPanelConstraints: R,
      groupSize: g,
      layout: S,
      separatorToPanels: E
    } = y;
    if (R && S && E) {
      const k = It({
        delta: p,
        initialLayout: w,
        panelConstraints: R,
        pivotIndices: l.panels.map((O) => m.indexOf(O)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (Ye(k, S)) {
        if (p !== 0 && !b)
          switch (u) {
            case "horizontal": {
              i |= p < 0 ? _o : Lo;
              break;
            }
            case "vertical": {
              i |= p < 0 ? Do : Co;
              break;
            }
          }
      } else
        xe(l.group, {
          defaultLayoutDeferred: v,
          derivedPanelConstraints: R,
          groupSize: g,
          layout: k,
          separatorToPanels: E
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & Sr : c |= i & Sr, t.movementY === 0 ? c |= s & Rr : c |= i & Rr, jl(c), Ln(e);
}
function Dr(e) {
  const t = Qe(), n = Ze();
  switch (n.state) {
    case "active":
      Bo({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Cr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = Ze(), n = Qe();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        ct({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = je(a.group.id, !0);
          xe(a.group, s, {
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
      Bo({
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
      const a = Cn(e, n);
      a.length === 0 ? t.state !== "inactive" && ct({
        cursorFlags: 0,
        state: "inactive"
      }) : ct({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Ln(e.currentTarget);
      break;
    }
  }
}
function xr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Ze().state) {
      case "hover":
        ct({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function zr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || zo(e.currentTarget) && e.preventDefault();
}
function Or(e) {
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
function ed(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = lt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: we(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function td(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function nd({
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
        c.push(f.id), a += u;
        break;
      }
    }
  }
  if (!s || c.length === 0)
    return r;
  const l = 100 - o, d = { ...r };
  if (i.forEach((f, u) => {
    d[u] = f;
  }), a > 0)
    for (const f of c) {
      const u = r[f] ?? 0;
      d[f] = we(
        u / a * l
      );
    }
  else {
    const f = we(
      l / c.length
    );
    for (const u of c)
      d[u] = f;
  }
  return d;
}
function rd(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const rt = /* @__PURE__ */ new Map();
function od(e) {
  let t = !0;
  re(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((b) => {
    for (const p of b) {
      const { borderBoxSize: w, target: y } = p;
      if (y === e.element) {
        if (t) {
          const v = lt({ group: e });
          if (v === 0)
            return;
          const R = je(e.id);
          if (!R)
            return;
          const g = yn(e), S = R.defaultLayoutDeferred ? Or(g) : R.layout, E = nd({
            group: e,
            nextGroupSize: v,
            prevGroupSize: R.groupSize,
            prevLayout: S
          }), k = Xe({
            layout: E,
            panelConstraints: g
          });
          if (!R.defaultLayoutDeferred && Ye(R.layout, k) && td(
            R.derivedPanelConstraints,
            g
          ) && R.groupSize === v)
            return;
          xe(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: g,
            groupSize: v,
            layout: k,
            separatorToPanels: R.separatorToPanels
          });
        }
      } else
        ed(e, y, w);
    }
  });
  a.observe(e.element), e.panels.forEach((b) => {
    re(
      !r.has(b.id),
      `Panel ids must be unique; id "${b.id}" was used more than once`
    ), r.add(b.id), b.onResize && a.observe(b.element);
  });
  const s = lt({ group: e }), i = yn(e), c = e.panels.map(({ id: b }) => b).join(",");
  let l = e.mutableState.defaultLayout;
  l && (rd(e.panels, l) || (l = void 0));
  const d = e.mutableState.layouts[c] ?? l ?? Or(i), f = Xe({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  rt.set(
    u,
    (rt.get(u) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Mo(e).forEach((b) => {
    b.separator && m.set(b.separator, b.panels);
  }), xe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((b) => {
    re(
      !o.has(b.id),
      `Separator ids must be unique; id "${b.id}" was used more than once`
    ), o.add(b.id), b.element.addEventListener("keydown", _r);
  }), rt.get(u) === 1 && (u.addEventListener("contextmenu", Tr, !0), u.addEventListener("dblclick", Ar, !0), u.addEventListener("pointerdown", Lr, !0), u.addEventListener("pointerleave", Dr), u.addEventListener("pointermove", Cr), u.addEventListener("pointerout", xr), u.addEventListener("pointerup", zr, !0)), function() {
    t = !1, rt.set(
      u,
      Math.max(0, (rt.get(u) ?? 0) - 1)
    ), Wl(e), e.separators.forEach((b) => {
      b.element.removeEventListener("keydown", _r);
    }), rt.get(u) || (u.removeEventListener(
      "contextmenu",
      Tr,
      !0
    ), u.removeEventListener(
      "dblclick",
      Ar,
      !0
    ), u.removeEventListener(
      "pointerdown",
      Lr,
      !0
    ), u.removeEventListener("pointerleave", Dr), u.removeEventListener("pointermove", Cr), u.removeEventListener("pointerout", xr), u.removeEventListener("pointerup", zr, !0)), a.disconnect();
  };
}
function ad() {
  const [e, t] = N({}), n = B(() => t({}), []);
  return [e, n];
}
function xn(e) {
  const t = Ur();
  return `${e ?? t}`;
}
const et = typeof window < "u" ? Re : z;
function yt(e) {
  const t = A(e);
  return et(() => {
    t.current = e;
  }, [e]), B(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function zn(...e) {
  return yt((t) => {
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
function On(e) {
  const t = A({ ...e });
  return et(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const jo = In(null);
function sd(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: Ul
  });
  Pn(t, () => n.current, []), et(() => {
    Object.assign(
      n.current,
      $o({ groupId: e })
    );
  });
}
function Uo({
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
  }), p = yt((I) => {
    Ye(b.current.onLayoutChange, I) || (b.current.onLayoutChange = I, c == null || c(I));
  }), w = yt(
    (I, P) => {
      Ye(b.current.onLayoutChanged, I) || (b.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: P }));
    }
  ), y = xn(i), v = A(null), [R, g] = ad(), S = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), E = zn(v, a);
  sd(y, s);
  const k = yt(
    (I, P) => {
      const T = Ze(), M = Pr(I), _ = je(I);
      if (_) {
        let j = !1;
        switch (T.state) {
          case "active": {
            j = T.hitRegions.some(
              (F) => F.group === M
            );
            break;
          }
        }
        return {
          flexGrow: _.layout[P] ?? 1,
          pointerEvents: j ? "none" : void 0
        };
      }
      if (n != null && n[P])
        return {
          flexGrow: n == null ? void 0 : n[P]
        };
    }
  ), O = On({
    defaultLayout: n,
    disableCursor: r
  }), L = K(
    () => ({
      get disableCursor() {
        return !!O.disableCursor;
      },
      getPanelStyles: k,
      id: y,
      orientation: d,
      registerPanel: (I) => {
        const P = S.current;
        return P.panels = vn(d, [
          ...P.panels,
          I
        ]), g(), () => {
          P.panels = P.panels.filter(
            (T) => T !== I
          ), g();
        };
      },
      registerSeparator: (I) => {
        const P = S.current;
        return P.separators = vn(d, [
          ...P.separators,
          I
        ]), g(), () => {
          P.separators = P.separators.filter(
            (T) => T !== I
          ), g();
        };
      },
      updatePanelProps: (I, { disabled: P }) => {
        const T = S.current.panels.find(
          (j) => j.id === I
        );
        T && (T.panelConstraints.disabled = P);
        const M = Pr(y), _ = je(y);
        M && _ && xe(M, {
          ..._,
          derivedPanelConstraints: yn(M)
        });
      },
      updateSeparatorProps: (I, {
        disabled: P,
        disableDoubleClick: T
      }) => {
        const M = S.current.separators.find(
          (_) => _.id === I
        );
        M && (M.disabled = P, M.disableDoubleClick = T);
      }
    }),
    [k, y, g, d, O]
  ), $ = A(null);
  return et(() => {
    const I = v.current;
    if (I === null)
      return;
    const P = S.current;
    let T;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === P.panels.length) {
      T = {};
      for (const Y of P.panels) {
        const X = O.defaultLayout[Y.id];
        X !== void 0 && (T[Y.id] = X);
      }
    }
    const M = {
      disabled: !!o,
      element: I,
      id: y,
      mutableState: {
        defaultLayout: T,
        disableCursor: !!O.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
      },
      orientation: d,
      panels: P.panels,
      resizeTargetMinimumSize: P.resizeTargetMinimumSize,
      separators: P.separators
    };
    $.current = M;
    const _ = od(M), { defaultLayoutDeferred: j, derivedPanelConstraints: F, layout: G } = je(M.id, !0);
    !j && F.length > 0 && (p(G), w(G, !1));
    const ee = Dn(y, (Y) => {
      const { defaultLayoutDeferred: X, derivedPanelConstraints: me, layout: ie } = Y.next;
      if (X || me.length === 0)
        return;
      const ce = M.panels.map(({ id: W }) => W).join(",");
      M.mutableState.layouts[ce] = ie, me.forEach((W) => {
        if (W.collapsible) {
          const { layout: Q } = Y.prev ?? {};
          if (Q) {
            const pe = ye(
              W.collapsedSize,
              ie[W.panelId]
            ), ve = ye(
              W.collapsedSize,
              Q[W.panelId]
            );
            pe && !ve && (M.mutableState.expandedPanelSizes[W.panelId] = Q[W.panelId]);
          }
        }
      });
      const ge = Ze().state !== "active";
      p(ie), ge && w(ie, Y.isUserInteraction);
    });
    return () => {
      $.current = null, _(), ee();
    };
  }, [
    o,
    y,
    w,
    p,
    d,
    R,
    O
  ]), z(() => {
    const I = $.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ h(jo.Provider, { value: L, children: /* @__PURE__ */ h(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": y,
      id: y,
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
Uo.displayName = "Group";
function Fn() {
  const e = En(jo);
  return re(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function id(e, t) {
  const { id: n } = Fn(), r = A({
    collapse: on,
    expand: on,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: on
  });
  Pn(t, () => r.current, []), et(() => {
    Object.assign(
      r.current,
      Fo({ groupId: n, panelId: e })
    );
  });
}
function wn({
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
  minSize: d = "0%",
  onResize: f,
  panelRef: u,
  style: m,
  ...b
}) {
  const p = !!c, w = xn(c), y = On({
    disabled: a
  }), v = A(null), R = zn(v, s), {
    getPanelStyles: g,
    id: S,
    orientation: E,
    registerPanel: k,
    updatePanelProps: O
  } = Fn(), L = f !== null, $ = yt(
    (M, _, j) => {
      f == null || f(M, c, j);
    }
  );
  et(() => {
    const M = v.current;
    if (M !== null) {
      const _ = {
        element: M,
        id: w,
        idIsStable: p,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: L ? $ : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: y.disabled,
          maxSize: l,
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
    L,
    w,
    p,
    l,
    d,
    $,
    k,
    y
  ]), z(() => {
    O(w, { disabled: a });
  }, [a, w, O]), id(w, u);
  const I = () => {
    const M = g(S, w);
    if (M)
      return JSON.stringify(M);
  }, P = jr(
    (M) => Dn(S, M),
    I,
    I
  );
  let T;
  return P ? T = JSON.parse(P) : o !== void 0 ? T = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : T = { flexGrow: 1 }, /* @__PURE__ */ h(
    "div",
    {
      ...b,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": w,
      id: w,
      ref: R,
      style: {
        ...cd,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...T
      },
      children: /* @__PURE__ */ h(
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
wn.displayName = "Panel";
const cd = {
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
function ld({
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
    const c = i.maxSize, l = i.collapsible ? i.collapsedSize : i.minSize, d = [r, r + 1];
    a = Xe({
      layout: It({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Xe({
      layout: It({
        delta: c - s,
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
function Ho({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = xn(a), l = On({
    disabled: n,
    disableDoubleClick: r
  }), [d, f] = N({}), [u, m] = N("inactive"), [b, p] = N(!1), w = A(null), y = zn(w, o), {
    disableCursor: v,
    id: R,
    orientation: g,
    registerSeparator: S,
    updateSeparatorProps: E
  } = Fn(), k = g === "horizontal" ? "vertical" : "horizontal";
  et(() => {
    const $ = w.current;
    if ($ !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: $,
        id: c
      }, P = S(I), T = Bl(
        (_) => {
          m(
            _.next.state !== "inactive" && _.next.hitRegions.some(
              (j) => j.separator === I
            ) ? _.next.state : "inactive"
          );
        }
      ), M = Dn(
        R,
        (_) => {
          const { derivedPanelConstraints: j, layout: F, separatorToPanels: G } = _.next, ee = G.get(I);
          if (ee) {
            const Y = ee[0], X = ee.indexOf(Y);
            f(
              ld({
                layout: F,
                panelConstraints: j,
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
  }, [R, c, S, l]), z(() => {
    E(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, E]);
  let O;
  n && !v && (O = "not-allowed");
  let L;
  if (n)
    L = "disabled";
  else
    switch (u) {
      case "active": {
        L = "active";
        break;
      }
      default:
        b ? L = "focus" : L = u;
    }
  return /* @__PURE__ */ h(
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
      "data-separator": L,
      "data-testid": c,
      id: c,
      onBlur: () => p(!1),
      onFocus: () => p(!0),
      ref: y,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: O,
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
Ho.displayName = "Separator";
const $n = 30, Bn = 65, Et = 50, dd = 100 - Bn, ud = 100 - $n;
function fd(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Bn, Math.max($n, t)) : Et;
}
function jn(e) {
  return 100 - e;
}
function ot(e) {
  return `${e}%`;
}
const Un = "reader-document", Pt = "reader-assistant", Wo = "retainpdf.reader.ai-split-layout.v1", md = {
  [Un]: jn(Et),
  [Pt]: Et
};
function Hn(e) {
  const t = fd(e == null ? void 0 : e[Pt]);
  return {
    [Un]: jn(t),
    [Pt]: t
  };
}
function hd() {
  try {
    const e = JSON.parse(localStorage.getItem(Wo) || "null");
    return Hn(e);
  } catch {
    return md;
  }
}
function pd(e) {
  try {
    localStorage.setItem(Wo, JSON.stringify(Hn(e)));
  } catch {
  }
}
function an(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Hn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Pt]}vw`
  );
}
function gd() {
  const e = A(null), [t] = N(hd);
  Re(() => {
    const o = e.current;
    return an(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = B((o) => {
    an(e.current, o);
  }, []), r = B((o, a) => {
    an(e.current, o), a.isUserInteraction && pd(o);
  }, []);
  return /* @__PURE__ */ D(
    Uo,
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
        /* @__PURE__ */ h(
          wn,
          {
            id: Un,
            defaultSize: ot(jn(Et)),
            minSize: ot(dd),
            maxSize: ot(ud)
          }
        ),
        /* @__PURE__ */ h(
          Ho,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ h("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ h(
          wn,
          {
            id: Pt,
            defaultSize: ot(Et),
            minSize: ot($n),
            maxSize: ot(Bn)
          }
        )
      ]
    }
  );
}
function bd({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = N(!1);
  if (z(() => {
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
    n ? /* @__PURE__ */ h(fe, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
    /* @__PURE__ */ h(
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
function yd({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ h(bd, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ D(dt, { children: [
    e ? /* @__PURE__ */ h("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ D("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ h("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ h("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ h(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ D("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ h("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ h(fe, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function vd(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function wd() {
  const [e, t] = N(!1), n = Ur(), r = A(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || vd(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ D("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ h(ga, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
            /* @__PURE__ */ h("strong", { children: "快捷键" }),
            /* @__PURE__ */ h(
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
          /* @__PURE__ */ h("div", { className: "reader-react-shortcuts-body", children: _i.map((o) => /* @__PURE__ */ D("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ h("h3", { children: o.title }),
            /* @__PURE__ */ h("ul", { children: o.items.map((a) => /* @__PURE__ */ D("li", { children: [
              /* @__PURE__ */ h("kbd", { children: a.keys }),
              /* @__PURE__ */ h("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ h("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const Sd = ["source", "sideBySide", "translated"], Rd = { source: "", translated: "", sideBySide: "" };
function Id(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Ft(e.sourceUrl), n = Ft(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return $a({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Ed(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = K(
    () => e ? Id(e) : Rd,
    [e]
  ), o = K(
    () => Sd.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = B(async (s) => {
    if (!e) return;
    const i = Ft(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Fa(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Ba(
          e.fetchProtected,
          i,
          c,
          c,
          null,
          (l) => n((d) => {
            const f = new Set(d);
            return l ? f.add(s) : f.delete(s), f;
          })
        );
      } catch (c) {
        const l = c instanceof Error ? c.message : "下载失败";
        ja(l), n((d) => {
          const f = new Set(d);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Pd = {
  source: Vr,
  sideBySide: Jr,
  translated: Kr
}, Td = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function kd(e) {
  const t = ze(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Ed(n), i = A(null);
  return z(() => {
    const c = () => {
      var f;
      (f = i.current) != null && f.open && (i.current.open = !1);
    }, l = (f) => {
      i.current && !i.current.contains(f.target) && c();
    }, d = (f) => {
      f.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", l), document.addEventListener("keydown", d), () => {
      document.removeEventListener("pointerdown", l), document.removeEventListener("keydown", d);
    };
  }, []), /* @__PURE__ */ D("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ D("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ h(ba, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ h("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ h(Wr, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ h("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = Zo[c], d = Ft(r[c]), f = a.has(c), u = !!d && !f, m = u ? "" : Yo(c, r), b = Pd[c];
      return /* @__PURE__ */ D(
        "button",
        {
          type: "button",
          id: `reader-download-${c}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !u,
          "aria-label": u ? `下载${l.label}` : m,
          onClick: () => {
            i.current && (i.current.open = !1), s(c);
          },
          children: [
            /* @__PURE__ */ h(b, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ D("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ D("span", { className: "reader-download-action-label", children: [
                Td[c],
                " PDF"
              ] }),
              m ? /* @__PURE__ */ h("span", { className: "reader-download-action-reason", children: m }) : null
            ] })
          ]
        },
        c
      );
    }) })
  ] });
}
const Nd = "retainpdf:reader:bookmarks:v1:", Md = 200;
function Wn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Vo(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Nd}${t}` : "";
}
function Ad(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Vt(e, t = Wn()) {
  const n = Vo(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Ad(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Sn(e, t, n) {
  const r = Vo(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Md);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function _d(e, t, n = "", { storage: r = Wn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Vt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Sn(e, a.filter((i) => i.page !== s), r) : Sn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Ld(e, t, n = Wn()) {
  return Sn(e, Vt(e, n).filter((r) => r.page !== t), n);
}
function Dd(e, t) {
  var r, o, a, s;
  let n = null;
  for (const i of e || []) {
    if (`${(i == null ? void 0 : i.regionType) || ""}` != "heading") continue;
    const c = Number(((r = i.source) == null ? void 0 : r.page) ?? ((o = i.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(c) || c > t) continue;
    const l = `${((a = i.translated) == null ? void 0 : a.text) || i.markdown || ((s = i.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!l) continue;
    const d = Number(i.readingOrder) || 0;
    (!n || c > n.page || c === n.page && d >= n.order) && (n = { page: c, order: d, text: l });
  }
  return n ? n.text.slice(0, 60) : "";
}
function Cd({ filled: e }) {
  return /* @__PURE__ */ h("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ h("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function xd({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => Vt(e)), [i, c] = N(!1), l = A(null);
  if (z(() => {
    s(Vt(e)), c(!1);
  }, [e]), z(() => {
    if (!i) return;
    const u = (b) => {
      l.current && !l.current.contains(b.target) && c(!1);
    }, m = (b) => {
      b.key === "Escape" && c(!1);
    };
    return document.addEventListener("pointerdown", u), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", u), document.removeEventListener("keydown", m);
    };
  }, [i]), !e || n <= 0) return null;
  const d = Math.min(Math.max(t, 1), n), f = a.some((u) => u.page === d);
  return /* @__PURE__ */ D("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${d} 页的书签` : `给第 ${d} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(_d(e, d, Dd(r, d))),
        children: /* @__PURE__ */ h(Cd, { filled: f })
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
        onClick: () => c((u) => !u),
        children: [
          /* @__PURE__ */ h(ya, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ h("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ h("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ h("ol", { className: "reader-bookmark-list", children: a.map((u) => /* @__PURE__ */ D("li", { className: u.page === d ? "is-current" : "", children: [
      /* @__PURE__ */ D(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(u.page, n)), c(!1);
          },
          children: [
            /* @__PURE__ */ D("span", { className: "reader-bookmark-page", children: [
              "第 ",
              u.page,
              " 页"
            ] }),
            u.label ? /* @__PURE__ */ h("span", { className: "reader-bookmark-label", children: u.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ h(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${u.page} 页的书签`,
          onClick: () => s(Ld(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function zd(e) {
  const [t, n] = N([]);
  return z(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = We().loadIssues;
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
function Od(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Fd = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, $d = ["failed", "content", "layout"];
function Bd(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function jd({ jobId: e, currentPage: t }) {
  var f;
  const n = zd(e), r = (f = ze()) == null ? void 0 : f.jumpToBlock, [o, a] = N(!1), [s, i] = N(-1), c = A(null);
  z(() => i(-1), [n]);
  const l = (u) => {
    const m = n[u];
    !m || !r || (i(u), r(m.readerItemId));
  }, d = A({ issues: n, last: s, currentPage: t, goTo: l });
  return d.current = { issues: n, last: s, currentPage: t, goTo: l }, z(() => {
    const u = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || Bd(m.target)) return;
      const { issues: b, last: p, currentPage: w, goTo: y } = d.current, v = Od(b, p, w, m.shiftKey);
      v < 0 || (m.preventDefault(), y(v));
    };
    return document.addEventListener("keydown", u), () => document.removeEventListener("keydown", u);
  }, []), z(() => {
    if (!o) return;
    const u = (m) => {
      var b;
      (b = c.current) != null && b.contains(m.target) || a(!1);
    };
    return document.addEventListener("pointerdown", u, !0), () => document.removeEventListener("pointerdown", u, !0);
  }, [o]), n.length ? /* @__PURE__ */ D("div", { className: "reader-react-hud-group reader-issues", ref: c, "aria-label": "待处理", children: [
    /* @__PURE__ */ D(
      fe,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((u) => !u),
        children: [
          /* @__PURE__ */ h(va, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ h("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ D("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ h("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      $d.map((u) => {
        const m = n.map((b, p) => ({ issue: b, index: p })).filter(({ issue: b }) => b.kind === u);
        return m.length ? /* @__PURE__ */ D("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ D("h4", { children: [
            Fd[u],
            /* @__PURE__ */ h("span", { children: m.length })
          ] }),
          /* @__PURE__ */ h("ol", { children: m.map(({ issue: b, index: p }) => /* @__PURE__ */ h("li", { children: /* @__PURE__ */ D(
            fe,
            {
              className: "reader-issues-item",
              "aria-current": p === s ? "true" : void 0,
              onClick: () => {
                l(p), a(!1);
              },
              children: [
                /* @__PURE__ */ h("span", { className: "reader-issues-title", children: b.title }),
                /* @__PURE__ */ D("span", { className: "reader-issues-page", children: [
                  "第 ",
                  b.page,
                  " 页"
                ] }),
                b.detail ? /* @__PURE__ */ h("span", { className: "reader-issues-detail", children: b.detail }) : null
              ]
            }
          ) }, `${b.kind}:${b.readerItemId}`)) })
        ] }, u) : null;
      })
    ] }) : null
  ] }) : null;
}
const Ud = 48, Hd = 96, Wd = 700;
function Vd(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Ud, downSoFar: r };
}
function Jd(e) {
  const [t, n] = N(!1), r = A(0);
  return z(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), c = () => {
      const u = e.current;
      return !!(u && (u.querySelector(":focus-visible") || u.querySelector("[aria-expanded='true']")));
    }, l = (u) => {
      const m = u.target;
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${Ue}]`)), !i.get(m))) return;
      const b = m.scrollTop, p = o.get(m);
      if (o.set(m, b), p === void 0 || Date.now() - a > Wd) return;
      const w = Vd(!1, r.current, b - p);
      r.current = w.downSoFar, b - p < -4 ? n(!1) : w.hidden && !c() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - Hd && (r.current = 0, n(!1));
    }, f = () => {
      c() && n(!1);
    };
    document.addEventListener("scroll", l, { capture: !0, passive: !0 }), window.addEventListener("pointermove", d, { passive: !0 }), document.addEventListener("focusin", f);
    for (const u of ["wheel", "touchmove", "keydown"]) window.addEventListener(u, s, { passive: !0, capture: !0 });
    return () => {
      for (const u of ["wheel", "touchmove", "keydown"]) window.removeEventListener(u, s, { capture: !0 });
      document.removeEventListener("scroll", l, { capture: !0 }), window.removeEventListener("pointermove", d), document.removeEventListener("focusin", f);
    };
  }, [e]), t;
}
function Kd(e) {
  const t = ze(), n = Io(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? kt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = Ls(a), f = a > Qr + 1e-3, u = a < Ht - 1e-3, m = at(r, Ge()), b = m >= Ht ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", p = A(null), w = Jd(p), [y, v] = N(!1), [R, g] = N(`${i}`);
  z(() => {
    y || g(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, y]);
  const S = () => {
    if (v(!1), !l || c <= 0)
      return;
    const E = Number(`${R}`.trim());
    l(Wt(E, c));
  };
  return /* @__PURE__ */ D("div", { ref: p, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": w ? "true" : void 0, children: [
    o ? /* @__PURE__ */ h("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ h("div", { className: "reader-react-hud-group", "aria-label": "页码", children: y ? /* @__PURE__ */ D(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (E) => {
          E.preventDefault(), S();
        },
        children: [
          /* @__PURE__ */ h(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: R,
              autoFocus: !0,
              onChange: (E) => g(E.target.value.replace(/[^\d]/g, "")),
              onBlur: S,
              onKeyDown: (E) => {
                E.key === "Escape" && (E.preventDefault(), v(!1), g(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ D("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            c || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": c > 0 ? `跳转页码，当前第 ${i} 页，共 ${c} 页` : "页码",
        title: c > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || c <= 0,
        onClick: () => {
          !l || c <= 0 || (g(`${i}`), v(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ h("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ h(
      xd,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ h(jd, { jobId: e.issuesJobId, currentPage: i }) : null,
    /* @__PURE__ */ D("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ h(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(St(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ D(
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
      /* @__PURE__ */ h(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !u,
          onClick: () => s(St(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ h("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ h(wd, {}) })
  ] });
}
function Fr(e) {
  var t, n;
  return ro(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function qd(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Fr(Ae(e))
  }));
  z(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Fr(Ae(e))
    });
  }, [e]), z(() => {
    t.scope === e && Gt(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = B((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Rn = "download-toast";
function Gd({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ D("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ D("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ h("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ h("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ h("div", { className: "download-toast-track", children: /* @__PURE__ */ h("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ h("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Zd(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    ln.dismiss(Rn);
    return;
  }
  ln.custom(
    () => /* @__PURE__ */ h(Gd, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Rn, duration: 1 / 0 }
  );
}
function Yd() {
  const e = B((t) => {
    t && (t.setState = Zd, t.hide = () => ln.dismiss(Rn));
  }, []);
  return /* @__PURE__ */ D(dt, { children: [
    /* @__PURE__ */ h(ca, { position: "bottom-right" }),
    /* @__PURE__ */ h("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Xd(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : eo(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Qd(e, t) {
  return t === null || e !== t;
}
function eu(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function tu(e, t) {
  const n = e === t;
  return { open: n, mounted: eu(n) };
}
const $r = { itemId: null, origin: null };
function nu() {
  let e = $r;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? $r : { itemId: n, origin: r };
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
const ru = [];
function ou({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ D("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ h(fe, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ h(wa, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function au({ open: e, onToggle: t }) {
  return /* @__PURE__ */ h(
    fe,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ h(Sa, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function su({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0
}) {
  var g, S;
  const c = ((g = ze()) == null ? void 0 : g.regions) ?? ru, l = ((S = Io()) == null ? void 0 : S.currentPage) ?? 1, d = K(() => Wc(c), [c]), f = Vc(d, l), u = K(() => qc(c, s), [c, s]), [m, b] = N(-1);
  z(() => b(-1), [s]);
  const p = A(null), w = A(null), y = A(n);
  y.current = n, z(() => {
    const E = (O) => {
      var $, I;
      const L = O.target;
      !L || ($ = w.current) != null && $.contains(L) || (I = L.closest) != null && I.call(L, ".reader-finder-toggles, [data-finder-toggle]") || y.current();
    }, k = (O) => {
      O.key === "Escape" && y.current();
    };
    return document.addEventListener("pointerdown", E, !0), document.addEventListener("keydown", k), () => {
      document.removeEventListener("pointerdown", E, !0), document.removeEventListener("keydown", k);
    };
  }, []);
  const v = A(null);
  z(() => {
    var E, k, O;
    e === "search" ? (E = p.current) == null || E.focus() : (O = (k = v.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null || O.scrollIntoView({ block: "center" });
  }, [e, i]), z(() => {
    var E, k;
    e === "search" && m >= 0 && ((k = (E = v.current) == null ? void 0 : E.querySelector('[aria-current="true"]')) == null || k.scrollIntoView({ block: "nearest" }));
  }, [e, m]);
  const R = (E) => {
    const k = u[E];
    k && (b(E), r(k.itemId));
  };
  return /* @__PURE__ */ D("aside", { ref: w, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ D("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ h(fe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ h(fe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ h(fe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ h(Kt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ h("ol", { ref: v, className: "reader-finder-list", children: d.map((E, k) => /* @__PURE__ */ h("li", { children: /* @__PURE__ */ D(
      fe,
      {
        className: "reader-finder-entry",
        "data-level": E.level,
        "aria-current": k === f ? "location" : void 0,
        onClick: () => r(E.itemId),
        children: [
          /* @__PURE__ */ h("span", { className: "reader-finder-entry-text", children: E.text }),
          /* @__PURE__ */ h("span", { className: "reader-finder-entry-page", children: E.page })
        ]
      }
    ) }, E.itemId)) }) : /* @__PURE__ */ h("p", { className: "reader-finder-empty", children: c.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ D(dt, { children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ h(
          qr,
          {
            ref: p,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (E) => a(E.target.value),
            onKeyDown: (E) => {
              E.key === "Enter" ? (E.preventDefault(), R(Zc(m, u.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ h("p", { className: "reader-finder-count", "aria-live": "polite", children: u.length === 0 ? "没有找到" : `${m >= 0 ? `第 ${m + 1} / ` : ""}${u.length >= 200 ? "200+ 处，只列前 200 处" : `${u.length} 处`}${m < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ h("ol", { className: "reader-finder-list", children: u.map((E, k) => /* @__PURE__ */ h("li", { children: /* @__PURE__ */ D(fe, { className: "reader-finder-entry is-hit", "aria-current": k === m ? "true" : void 0, onClick: () => R(k), children: [
        /* @__PURE__ */ D("span", { className: "reader-finder-entry-text", children: [
          E.snippet.slice(0, E.at),
          /* @__PURE__ */ h("mark", { children: E.snippet.slice(E.at, E.at + E.length) }),
          E.snippet.slice(E.at + E.length)
        ] }),
        /* @__PURE__ */ h("span", { className: "reader-finder-entry-page", children: E.page })
      ] }) }, E.itemId)) })
    ] })
  ] });
}
function iu({ active: e, compare: t }) {
  const [n, r] = N(!1), [o, a] = N(!1), s = A(null);
  z(() => {
    if (!n && !o) return;
    const c = () => {
      r(!1), a(!1);
    }, l = (f) => {
      var u;
      (u = s.current) != null && u.contains(f.target) || c();
    }, d = (f) => {
      f.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", l, !0), document.addEventListener("keydown", d), () => {
      document.removeEventListener("pointerdown", l, !0), document.removeEventListener("keydown", d);
    };
  }, [n, o]);
  const i = !!(t.compared || t.loading);
  return /* @__PURE__ */ D("div", { className: "reader-toolball", ref: s, "data-open": n ? "true" : void 0, children: [
    o ? /* @__PURE__ */ h(hl, { compare: t, onDone: () => {
      a(!1), r(!1);
    } }) : null,
    n ? /* @__PURE__ */ D("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      /* @__PURE__ */ h(Ml, { active: e }),
      t.available ? /* @__PURE__ */ h(
        fe,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": i || o,
          "data-toolball-item": "compare",
          onClick: () => a((c) => !c),
          children: /* @__PURE__ */ h(Ra, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ h(
      fe,
      {
        className: "reader-toolball-ball",
        "aria-label": n ? "收起工具" : "工具：Markdown、对比版本",
        title: n ? "收起" : "工具",
        "aria-expanded": n,
        "data-active": e || i ? "true" : void 0,
        onClick: () => {
          r((c) => !c), a(!1);
        },
        children: n ? /* @__PURE__ */ h(Kt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ h(Ia, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
function sn() {
  try {
    return We().translationVersions ?? null;
  } catch {
    return null;
  }
}
function cu(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function lu(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function du(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function uu({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null), [s, i] = N(null), [c, l] = N(""), [d, f] = N(""), u = A(0);
  z(() => {
    r([]), i(null), f("");
    const w = sn();
    if (!w || !e) return;
    let y = !1;
    return w.list(e).then((v) => {
      y || (r(v.versions), a(v.currentVersionId));
    }).catch(() => {
    }), () => {
      y = !0;
    };
  }, [e, t]);
  const m = B((w) => {
    const y = sn(), v = n.find((g) => g.versionId === w);
    if (!y || !v || !e) return;
    const R = ++u.current;
    l(w), f(""), (async () => {
      const g = We(), S = await y.resolveJob(e, w);
      if (!S) throw new Error("这一份还没有能读的译文。");
      const E = await g.loadReaderPayload(S, { includeOptionalArtifacts: !0 }), k = g.resolveReaderTranslatedPdfUrl(E.jobPayload, E.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: w, name: v.name, jobId: S, url: k, regions: cu(Hr(E.regionsPayload)) };
    })().then((g) => {
      R === u.current && i(g);
    }).catch((g) => {
      R === u.current && f((g == null ? void 0 : g.message) || "这一份打不开。");
    }).finally(() => {
      R === u.current && l("");
    });
  }, [e, n]), b = B(() => {
    u.current += 1, i(null), l(""), f("");
  }, []), p = B(async () => {
    var v, R;
    const w = sn();
    if (!w || !s || !e) return;
    try {
      await w.select(e, s.versionId);
    } catch (g) {
      f((g == null ? void 0 : g.message) || "换不过去，请稍后再试。");
      return;
    }
    const y = (v = globalThis.location) == null ? void 0 : v.href;
    y && ((R = globalThis.history) == null || R.replaceState(globalThis.history.state, "", du(y, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: lu(n, t, o),
    compared: s,
    loading: c,
    error: d,
    choose: m,
    clear: b,
    adopt: p
  };
}
const fu = "reader-finder-input";
function mu(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function hu(e, t = typeof window > "u" ? null : window) {
  z(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!mu(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(fu) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function pu() {
  try {
    return We().translationEdit ?? null;
  } catch {
    return null;
  }
}
const gu = "这本书正在处理（翻译或排版），处理完才能改。", bu = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function yu({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = pu(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = vc(s), l = !t || vt(t), d = Pc(n), [f, u] = N(""), [m, b] = N(null), [p, w] = N(() => /* @__PURE__ */ new Map()), [y, v] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [R, g] = N(() => /* @__PURE__ */ new Map()), [S, E] = N({ phase: "idle" }), k = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  z(() => {
    b(null), k.drafts.clear(), k.generation.current = null, g(/* @__PURE__ */ new Map()), E({ phase: "idle" });
  }, [s]), z(() => {
    if (u(""), !i || c || !a) return;
    let _ = !1;
    return a.resolveOwnerJobId(s).then((j) => {
      _ || u(`${j || s}`.trim() || s);
    }).catch(() => {
      _ || u(s);
    }), () => {
      _ = !0;
    };
  }, [i, c, a, s]), z(() => {
    if (w(/* @__PURE__ */ new Map()), !a || !f || !d || !l) return;
    let _ = !1;
    return a.fetchRevisions(f).then((j) => {
      _ || w(Tc(j, d));
    }).catch(() => {
    }), () => {
      _ = !0;
    };
  }, [a, f, d, l]);
  const O = S.phase === "running" && S.seenActive;
  z(() => {
    if (S.phase === "running") {
      if (!l) {
        O || E({ phase: "running", seenActive: !0 });
        return;
      }
      O && E(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [S.phase, O, l, t]);
  const L = K(() => {
    const _ = new Map(p);
    if (y.renderedAt === d)
      for (const [j, F] of y.edits) _.set(j, F);
    return _;
  }, [p, y, d]), $ = B((_) => {
    const j = `${_ || ""}`.trim();
    j && b({ itemId: j, page: wc(j) });
  }, []), I = B(() => b(null), []), P = B((_, j) => {
    v((F) => {
      const G = new Map(F.renderedAt === d ? F.edits : []);
      return G.set(_, j), { renderedAt: d, edits: G };
    }), g((F) => new Map(F).set(_, (F.get(_) || 0) + 1));
  }, [d]), T = B(async () => {
    if (!(!a || !s || S.phase === "submitting" || S.phase === "running")) {
      E({ phase: "submitting" });
      try {
        await a.rerender(s), E({ phase: "running", seenActive: !1 }), await o();
      } catch (_) {
        E({ phase: "failed", message: (_ == null ? void 0 : _.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, S.phase, o]), M = c ? bu : !l || S.phase === "running" || S.phase === "submitting" ? gu : "";
  return K(() => ({
    available: i,
    blockedReason: M,
    port: a,
    ownerJobId: f,
    target: m,
    select: $,
    close: I,
    memory: k,
    pendingEdits: L,
    savedCounts: R,
    markSaved: P,
    rerender: S,
    startRerender: T
  }), [i, M, a, f, m, $, I, k, L, R, P, S, T]);
}
function vu(e, t) {
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
function wu({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ h("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ D("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ h("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ h(
      fe,
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
const Su = Ko(() => import("./ReaderMarkdownPanel-BqzEadRB.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Ru(e) {
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
function Iu(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Eu() {
  var Ie;
  const e = Mi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = qd(e.viewStateKey), s = a.panel, i = a.setPanel, [c, l] = N(!1), d = A(null), f = A(null), u = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, b = Ru({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: c,
    assistantOpen: u
  }), p = wi({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: b.showSource,
    liveTranslationVisible: c,
    assistantOpen: u
  }), w = b.sourceViewOnly, y = b.visibleMode;
  z(() => {
    l(!1);
  }, [e.viewStateKey]), z(() => {
    e.session.jobTerminal && l(!1);
  }, [e.session.jobTerminal]), z(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const U = Ae(e.viewStateKey), te = Xd({
          savedMode: U == null ? void 0 : U.mode,
          sourceViewOnly: w,
          viewportWidth: Ge()
        });
        f.current = te.auto ? te.mode : null, te.mode && te.mode !== e.mode && e.setModeKeepingPage(te.mode);
        return;
      }
      Qd(e.mode, f.current) && (f.current = null, Gt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, w]);
  const v = s || (e.mode === "compare" ? "compare" : "reading"), R = tu(s, "markdown");
  zi({
    mode: y,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const g = B(() => {
    i(null);
  }, []), S = B((U) => {
    const te = Iu(U, e.liveTranslationAvailable);
    te !== null && l(te), e.setModeKeepingPage(U);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), E = K(() => p.sourcePaneToggle ? /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${c ? " is-active" : ""}`,
      onClick: () => l((U) => !U),
      "aria-pressed": c,
      title: c ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [p.sourcePaneToggle, c]), k = B((U) => {
    i(U);
  }, []), [O] = N(nu), [L, $] = N(null), I = B((U) => $((te) => te === U ? null : U), []), [P, T] = N(""), [M, _] = N("");
  z(() => {
    const U = P.replace(/\s+/gu, " ").trim(), te = window.setTimeout(() => _(U), U ? 150 : 0);
    return () => window.clearTimeout(te);
  }, [P]);
  const [j, F] = N(0), G = B(() => {
    $("search"), F((U) => U + 1);
  }, []);
  hu(G);
  const ee = B((U) => {
    e.jumpToAnchor({ block_id: U }), (L === "outline" || Ge() < 900) && $(null);
  }, [e.jumpToAnchor, L]), Y = B((U) => e.jumpToAnchor({ block_id: U }), [e.jumpToAnchor]), X = yu({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), me = X.select, ie = e.setModeKeepingPage, ce = B((U) => {
    y === "source" && ie("compare"), me(U);
  }, [me, y, ie]);
  vu(X.available ? ce : null, O);
  const ge = uu({ documentId: o.documentId, jobId: o.jobId }), W = ((Ie = ge.compared) == null ? void 0 : Ie.url) || "";
  z(() => {
    W && y !== "compare" && S("compare");
  }, [W]), z(() => {
    y !== "compare" && ge.clear();
  }, [y]);
  const Q = K(
    () => {
      const { compared: U, versions: te, readingVersionId: C } = ge;
      if (!U) return null;
      const q = te.find((ae) => ae.versionId === U.versionId), ne = te.find((ae) => ae.versionId === C);
      return {
        url: U.url,
        regions: U.regions,
        left: { name: U.name, createdAt: (q == null ? void 0 : q.createdAt) || "" },
        right: { name: (ne == null ? void 0 : ne.name) || "当前译文", createdAt: (ne == null ? void 0 : ne.createdAt) || "" }
      };
    },
    [ge.compared, ge.versions, ge.readingVersionId]
  ), pe = K(() => {
    if (!X.savedCounts.size) return e.revisedBlocks;
    const U = new Map(e.revisedBlocks);
    for (const [te, C] of X.savedCounts) U.set(te, (U.get(te) || 0) + C);
    return U;
  }, [e.revisedBlocks, X.savedCounts]), ve = K(() => ({
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
    regionHover: O,
    jumpToBlock: Y,
    revisedBlocks: pe,
    editBlock: X.available ? ce : void 0,
    blockEdit: X,
    editShowsSource: y !== "compare",
    findTerm: L === "search" ? M : "",
    compareVersion: Q,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: w,
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
    O,
    Y,
    pe,
    X,
    ce,
    y,
    L,
    M,
    Q,
    e.sourceOnly,
    w,
    e.download,
    e.goToPage,
    k,
    g
  ]), he = K(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Ve = [
    Is,
    `is-workspace-${v}`,
    u ? "is-assistant-open" : "",
    L ? "is-finder-open" : "",
    b.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ h(Oc, { value: ve, hud: he, children: /* @__PURE__ */ D("div", { className: Ve, "data-reader-engine": "react-pdf", "data-reader-workspace": v, children: [
    /* @__PURE__ */ h(yd, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
    /* @__PURE__ */ h(ou, { open: L, onToggle: I }),
    L ? /* @__PURE__ */ h(
      su,
      {
        tab: L,
        onTab: $,
        onClose: () => $(null),
        onJump: ee,
        query: P,
        onQuery: T,
        term: M,
        focusSignal: j
      }
    ) : null,
    /* @__PURE__ */ D("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ h(kd, {}),
      /* @__PURE__ */ h(Hi, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ h(
      El,
      {
        mode: y,
        documentReady: !!o.jobId,
        sourceViewOnly: w,
        onModeChange: S,
        liveTranslation: p.topBarPill ? {
          visible: c,
          state: e.liveTranslation,
          onToggle: () => l((U) => !U)
        } : null
      }
    ),
    /* @__PURE__ */ h(Al, { active: s }),
    u ? /* @__PURE__ */ h(gd, {}) : null,
    /* @__PURE__ */ h(wl, { paneComposition: b, markdownSplit: R.open, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
    e.showHud ? /* @__PURE__ */ h(
      Kd,
      {
        mode: y,
        modeControls: null,
        bookmarkScope: e.viewStateKey,
        issuesJobId: e.sourceOnly ? "" : o.jobId,
        searchSlot: /* @__PURE__ */ h(au, { open: L, onToggle: I })
      }
    ) : null,
    /* @__PURE__ */ h(Jo, { fallback: null, children: R.mounted ? /* @__PURE__ */ h(Su, { open: R.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: g }) : null }),
    /* @__PURE__ */ h(iu, { active: s, compare: ge }),
    /* @__PURE__ */ h(wu, { edit: X }),
    /* @__PURE__ */ h(Yd, {})
  ] }) });
}
function Hu() {
  return /* @__PURE__ */ h(Eu, {});
}
export {
  Hu as R,
  Eu as a,
  ju as d,
  Bu as f,
  Uu as r,
  ze as u
};
//# sourceMappingURL=ReaderApp-DTDydcNR.js.map
