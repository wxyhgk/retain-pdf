var Vn = (e) => {
  throw TypeError(e);
};
var Jn = (e, t, n) => t.has(e) || Vn("Cannot " + n);
var ft = (e, t, n) => (Jn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Kn = (e, t, n) => t.has(e) ? Vn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), qn = (e, t, n, r) => (Jn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as dt } from "react/jsx-runtime";
import { useMemo as K, useState as M, useEffect as z, useCallback as B, useRef as A, useLayoutEffect as Pe, memo as Jt, createContext as In, useContext as En, forwardRef as Vo, useImperativeHandle as Pn, useSyncExternalStore as $r, useId as Br, Suspense as Jo, lazy as Ko } from "react";
import { requireAdapter as ut, getReaderAdapters as Te } from "./adapters.js";
import { resolveReaderDownloadName as qo, resolveReaderDownloadUrls as Go, READER_PROGRESS_COPY as Le, trimString as Ft, READER_DOWNLOAD_ACTIONS as Zo, disabledReason as Yo } from "./runtime/state.js";
import { r as Xo, b as Qo } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as cn, isFinishedJobStatus as vt } from "@retainpdf/domain/job";
import { n as jr, d as ea, f as Yt, k as Gn, b as ta, c as na, j as Tt, p as Tn, g as ra, l as Zn, i as oa } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as aa } from "@retainpdf/api/documents";
import { isReaderTransportError as sa, createReaderTransportError as ia } from "./contracts.js";
import { toast as ln, Toaster as ca } from "sonner";
import { X as Kt, ChevronUp as la, ChevronDown as Ur, History as da, Radio as ua, FileText as Hr, Columns2 as Wr, Languages as Vr, FileCode2 as fa, Keyboard as ma, Download as ha, ListOrdered as pa, TriangleAlert as ga, ListTree as ba, Search as ya, GitCompareArrows as va, Check as wa, LoaderCircle as Jr } from "lucide-react";
import { Button as fe, Textarea as Sa, IconButton as Yn, Input as Kr } from "@retainpdf/ui";
import { pdfjs as qr, Page as Ra, Document as Ia } from "react-pdf";
import { e as Ea, m as Pa, a as Ta } from "./markdown-math-XkF5urpn.js";
const ka = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Na = "", Ma = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Aa = (e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Lu = (...e) => {
  var n;
  return (((n = Te()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, De = () => ut("defaultReaderDataPort"), Xn = () => ut("defaultReaderPageConfigPort"), Du = {
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
}, Gr = {
  messageTargetOrigin: () => Xn().messageTargetOrigin(),
  readerJobId: () => Xn().readerJobId()
}, _a = () => {
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
}, He = () => {
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
}, La = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Da = () => {
  var e, t;
  return ((t = (e = Te()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Ca = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, xa = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? qo(...e);
}, za = (...e) => {
  var t, n;
  return ((n = (t = Te()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Go(...e);
}, Oa = (...e) => ut("downloadProtectedResource")(...e), Fa = (...e) => ut("failDownloadToast")(...e), Cu = (e, t) => ut("resolveMarkdownAssetUrl")(e, t), Qn = "/api/v1";
function $a() {
  const e = () => {
    var r;
    return Xo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = M(e);
  return z(() => {
    var i, c, l, d;
    const r = () => n(e()), o = (c = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : c.bind(globalThis.history), a = (d = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : d.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const m = (u) => function(...f) {
          const b = u.apply(this, f);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), b;
        };
        globalThis.history.pushState = m(o), globalThis.history.replaceState = m(a), s = !0;
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
function Ba() {
  const e = $a(), t = K(() => Ca(Gr), [e]), n = K(() => Da(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function ja(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = M({
    documentId: "",
    jobId: ""
  }), [d, m] = M({
    documentId: "",
    jobId: ""
  }), u = c.documentId === t ? c.jobId : "", f = d.documentId === t ? d.jobId : "", b = n || u, [h, w] = M({
    jobId: "",
    documentId: ""
  }), y = h.jobId === b ? h.documentId : "", v = t || y, R = !!t && !b, [g, S] = M(null), E = (g == null ? void 0 : g.sessionIdentity) === r && g.documentId === v ? g : null, k = R || !!E, O = B(($) => {
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
  const D = B(($) => {
    switch ($.type) {
      case "resolved-document-job":
        l({ documentId: $.documentId, jobId: $.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        m({ documentId: $.documentId, jobId: $.jobId });
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
    setMissingDocumentJob: m,
    documentJobId: u,
    rejectedDocumentJobId: f,
    sessionJobId: b,
    resolvedJobDocument: h,
    setResolvedJobDocument: w,
    jobDocumentId: y,
    documentId: v,
    sourceOnly: R,
    committedDocumentSource: g,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: E,
    sourceViewOnly: k,
    refreshCommittedDocument: O,
    applyIdentityEvent: D
  };
}
function er(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Ua(e) {
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
  return Aa(cn(e, t));
}
function Ha(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Wa(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ha(a, t))
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
        type: Ma.progress,
        stage: n,
        percent: e,
        text: t
      },
      Gr.messageTargetOrigin()
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
function Va(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = M(null), [l, d] = M(null), [m, u] = M(""), [f, b] = M(0), h = m === n ? i : null, w = m === n ? l : null, y = er(h), v = vt(y), R = B(() => {
    b((D) => D + 1);
  }, []), g = B((D) => {
    c(D.jobPayload), d(D.manifestPayload), u(D.sessionIdentity);
  }, []), S = B((D) => {
    c(null), d(null), u(D);
  }, []), E = A(""), k = A(""), O = B(async () => {
    const D = o.current;
    if (!D || E.current === D) return;
    const $ = He().loadJobPayload;
    if (typeof $ != "function") return;
    const I = a.current.value;
    E.current = D;
    try {
      const P = await $(D);
      if (s.current || a.current.value !== I || o.current !== D || !P || typeof P != "object")
        return;
      const T = er(P);
      c(P), u(r.current), !vt(T) && k.current === D && (k.current = ""), T === "succeeded" && k.current !== D && (k.current = D, b((N) => N + 1));
    } catch {
    } finally {
      E.current === D && (E.current = "");
    }
  }, []);
  return z(() => {
    k.current = "";
  }, [n]), z(() => {
    if (!t || v || !h) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [v, O, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: d,
    payloadSessionIdentity: m,
    setPayloadSessionIdentity: u,
    scopedJobPayload: h,
    scopedManifestPayload: w,
    jobStatus: y,
    jobTerminal: v,
    jobRefreshRevision: f,
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
function Ja(e, t) {
  e(t), un(t);
}
function Ka(e) {
  const [t, n] = M(e ? "source" : "compare"), r = B((a) => {
    e && a !== "source" || (n(a), un(a));
  }, [e]), o = B((a) => {
    Ja(n, a);
  }, []);
  return z(() => (e && document.documentElement.classList.add("reader-source-only"), un(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function nr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function qa(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: nr(n.active_job_id),
    activeVersionId: nr(n.active_version_id)
  };
}
function Ga(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Za(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ya(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Xa = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Qa(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Xa.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const es = 48 * 1024 * 1024;
function ts(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const ns = 2, Se = /* @__PURE__ */ new Map();
function fn(e, t) {
  Se.delete(e), Se.set(e, t);
}
function rr(e) {
  if (Se.size < ns) return;
  const t = Se.keys().next().value;
  t && Se.delete(t);
}
async function rs(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Zr(e, t = wt().fetchProtected, n = {}) {
  var d, m, u, f, b, h, w, y, v;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Se.has(r)) {
    const R = Se.get(r);
    return fn(r, R), R;
  }
  const o = new AbortController(), a = () => o.abort();
  (d = n.signal) != null && d.aborted && o.abort(), (u = (m = n.signal) == null ? void 0 : m.addEventListener) == null || u.call(m, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (b = (f = n.signal) == null ? void 0 : f.removeEventListener) == null || b.call(f, "abort", a);
  }
  if (!s.ok) {
    const R = new Error(`读取 PDF 失败 (${s.status})`);
    R.status = s.status;
    const g = await rs(s);
    throw g && (R.reason = g), R;
  }
  const i = os(r, s, t);
  if (i) {
    o.abort();
    const R = { ranged: i };
    return rr(), Se.set(r, R), R;
  }
  (w = (h = n.signal) == null ? void 0 : h.addEventListener) == null || w.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (v = (y = n.signal) == null ? void 0 : y.removeEventListener) == null || v.call(y, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Se.has(r) ? fn(r, l) : (rr(), Se.set(r, l)), l;
}
function os(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < es ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const as = { file: null, loading: !1, error: "" }, ss = { file: null, loading: !0, error: "" };
function is(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = M(null);
  if (z(() => {
    if (t || !n) return;
    const s = Se.get(n);
    if (s) {
      fn(n, s);
      return;
    }
    const i = new AbortController();
    return Zr(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return as;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Se.get(n);
  return a ? { file: a, loading: !1, error: "" } : ss;
}
function cs(e) {
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
  const i = await Zr(t, wt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : ($t(s, o, n, "download"), i);
}
async function ls(e) {
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
function ds(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function us({
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
  return a === n || !o ? !1 : (o.replace(ds(o.href, t, a)), !0);
}
const _t = {
  regions: null,
  metadata: null
};
function fs(e) {
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
    publishPayload: m,
    clearPayload: u,
    switchSessionMode: f,
    jobRefreshRevision: b,
    sessionEpochRef: h,
    closingRef: w,
    activeLoadAbortRef: y
  } = e, [v, R] = M(""), [g, S] = M(""), [E, k] = M(null), [O, D] = M(null), [$, I] = M(!1), [P, T] = M(""), [N, _] = M([]), [j, F] = M(!1), [q, ee] = M(() => ({
    source: null,
    translated: null
  })), [Z, Y] = M(
    _t
  ), [he, ae] = M({
    loading: !0,
    percent: 4,
    text: Le.boot,
    stage: "progress",
    failed: !1
  });
  return z(() => {
    const se = new AbortController(), ce = h.current.value, H = cs({
      sessionEpochRef: h,
      closingRef: w,
      abort: se,
      sessionEpoch: ce
    });
    y.current = se;
    const Q = He();
    if (w.current)
      return se.abort(), () => {
        y.current === se && (y.current = null);
      };
    let ge = !1;
    function ve(x, X) {
      H.markFailed(), F(!0), ae({
        loading: !1,
        percent: 100,
        text: x,
        stage: "failed",
        failed: !0
      }), dn({ percent: 100, text: X, stage: "failed" });
    }
    function pe() {
      I(!0), ge || F(!0), ae({
        loading: !1,
        percent: 100,
        text: Le.ready,
        stage: "ready",
        failed: !1
      }), dn({ percent: 100, text: Le.ready, stage: "ready" });
    }
    function We() {
      return l != null && l.documentId ? tr(
        l.documentId,
        l.revision
      ) : ka() ? Na : Q.resolveResourceUrl(cn(r));
    }
    async function Re() {
      var de;
      let x = { activeJobId: "", activeVersionId: "" };
      try {
        const ue = await ((de = Q.fetchDocument) == null ? void 0 : de.call(Q, r));
        ue && (x = qa(ue));
      } catch {
      }
      const X = Ga({
        link: x,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (X.kind === "follow-active-job") {
        if (H.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: X.jobId
        }), X.activeVersionId ? (l || d({
          type: "committed-source",
          documentId: r,
          revision: X.activeVersionId,
          sessionIdentity: c
        }), f("source")) : f("compare");
        return;
      }
      if (X.kind === "open-committed-source") {
        if (H.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: X.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const me = We();
      if (H.isInactive()) return;
      R(me), S(""), T(""), u(c);
      const le = await mn({
        url: me,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: H,
        setBoot: ae
      });
      if (!H.isInactive()) {
        if (!le) {
          ve("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        k(le), pe();
      }
    }
    async function V() {
      var J;
      const x = !l, X = !!(x && Q.loadSessionSnapshot && Q.loadReaderOptionalArtifacts), me = X ? Q.loadReaderOptionalArtifacts(t) : null, le = await ((J = Q.loadSessionSnapshot) == null ? void 0 : J.call(Q, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: x && !X
      })), de = le ? {
        jobPayload: le.sourcePayload,
        manifestPayload: le.manifestPayload,
        readerMetadata: le.readerMetadata,
        regionsPayload: le.regions,
        readerErrors: le.readerErrors
      } : await Q.loadReaderPayload(t, {
        includeOptionalArtifacts: x
      });
      if (H.isInactive()) return;
      let ue = null;
      if (n && !r)
        if (le && le.linkedDocument !== void 0)
          ue = le.linkedDocument;
        else {
          try {
            ue = await Q.fetchDocumentByJobId(Qn, t);
          } catch {
          }
          if (H.isInactive()) return;
        }
      const Ie = Ua(de.jobPayload) || `${(ue == null ? void 0 : ue.document_id) || ""}`.trim();
      Ie && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ie
      });
      const _e = Za({
        payloadDocumentId: Ie,
        linkedActiveJobId: `${(ue == null ? void 0 : ue.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ue == null ? void 0 : ue.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (_e.kind === "restore-committed-source") {
        if (H.isInactive()) return;
        d({
          type: "committed-source",
          documentId: _e.documentId,
          revision: _e.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const ke = Q.resolveReaderSourcePdf(de.manifestPayload), et = Q.resolveReaderTranslatedPdfUrl(de.jobPayload, de.manifestPayload), Zt = typeof ke == "string" ? ke : Q.resolveReaderArtifactUrl(ke), Oe = r || Ie, Fe = l != null && l.documentId ? tr(
        l.documentId,
        l.revision
      ) : Zt || (Oe ? Q.resolveResourceUrl(cn(Oe)) : ""), Ve = l ? "" : et || "";
      R(Fe || ""), S(Ve), T(Wa(de.jobPayload, t)), m({
        jobPayload: de.jobPayload || null,
        manifestPayload: de.manifestPayload || null,
        sessionIdentity: c
      });
      const Nt = () => ls({
        sourceFinal: Fe || "",
        translatedFinal: Ve,
        fence: H,
        setBoot: ae
      }), Mt = !!(Fe || Ve), tt = me && Mt ? Nt() : null;
      tt == null || tt.catch(() => {
      });
      const At = (W) => {
        H.isInactive() || (_(l ? [] : jr(W.regionsPayload)), ee(l ? { source: null, translated: null } : ea(W.readerMetadata)), Y(l ? _t : W.readerErrors ?? _t), F(!0));
      };
      if (me ? (ge = !0, me.then(At)) : At(de), !Mt) {
        ve(Le.failed, Le.failed);
        return;
      }
      const C = await (tt ?? Nt());
      if (C.status !== "inactive") {
        if (C.status === "incomplete") {
          ve("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        k(C.sourceBytes), D(C.translatedBytes), pe();
      }
    }
    async function oe() {
      I(!1), k(null), D(null), _([]), F(!1), ee({ source: null, translated: null }), Y(_t), $t(ae, 8, Le.metadata, "metadata");
      try {
        if (s) {
          await Re();
          return;
        }
        if (!t) {
          ve(Le.failed, Le.failed);
          return;
        }
        await V();
      } catch (x) {
        if (H.isClosedOrStale() || (x == null ? void 0 : x.name) === "AbortError") return;
        H.markFailed();
        const X = Number(x == null ? void 0 : x.status), me = `${(x == null ? void 0 : x.reason) || ""}`, le = Qa({ status: X, reason: me, sessionJobId: t });
        if (le && (await us({
          apiPrefix: Qn,
          documentId: le,
          expiredJobId: t
        }) || H.isClosedOrStale()))
          return;
        if (Ya({
          status: X,
          reason: me,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), f("source");
          return;
        }
        const de = x instanceof Error ? x.message : Le.failed;
        ve(de, de);
      }
    }
    return oe(), () => {
      se.abort(), y.current === se && (y.current = null);
    };
  }, [t, r, o, a, s, i, l, b, n, c, d, m, u, f]), {
    sourceUrl: v,
    translatedUrl: g,
    sourceFile: E,
    translatedFile: O,
    assetsReady: $,
    title: P,
    regions: N,
    regionsSettled: j,
    readerMetadata: q,
    readerErrors: Z,
    boot: he
  };
}
function ms() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ba(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), c = A(""), l = A(""), d = A(() => {
  }), m = B(() => d.current(), []), u = ja({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: m
  }), {
    sessionJobId: f,
    documentId: b,
    sourceOnly: h,
    sourceViewOnly: w
  } = u, { mode: y, setMode: v, switchSessionMode: R } = Ka(w);
  d.current = () => {
    R("source");
  }, i.current = a, c.current = b, l.current = f;
  const g = Va({
    sessionJobId: f,
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
    jobRefreshRevision: D,
    refreshJobArtifacts: $,
    refreshJobStatus: I
  } = g, P = fs({
    sessionJobId: f,
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
    switchSessionMode: R,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = B(() => {
    var _;
    e.current = !0, (_ = t.current) == null || _.abort();
  }, []), N = K(
    () => ({
      fetchProtected: He().fetchProtected,
      jobId: f,
      jobPayload: S,
      manifestPayload: E,
      sourceUrl: P.sourceUrl,
      translatedUrl: P.translatedUrl,
      sourceOnly: w
    }),
    [f, S, E, P.sourceUrl, P.translatedUrl, w]
  );
  return {
    jobId: f,
    jobStatus: k,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: b,
    sessionIdentity: a,
    sourceOnly: h,
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
    download: N,
    refreshJobArtifacts: $,
    refreshJobStatus: I,
    refreshCommittedDocument: u.refreshCommittedDocument,
    prepareClose: T
  };
}
const hs = 160, ps = 8, gs = 0;
function bs() {
  const e = A(null), [t, n] = M(null), [r, o] = M(gs), a = B((s) => {
    e.current = s, n(s);
  }, []);
  return z(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < hs || o((d) => Math.abs(d - l) < ps ? d : l);
    }, c = new ResizeObserver((l) => {
      var d, m;
      i(((m = (d = l[0]) == null ? void 0 : d.contentRect) == null ? void 0 : m.width) ?? s.clientWidth);
    });
    return c.observe(s), i(s.clientWidth), () => c.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function ys(e) {
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
function vs(e, t) {
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
  const [m, u] = M(() => ({
    identity: l,
    pages: Xt
  })), [f, b] = M(() => ({ identity: l, tick: 0 })), h = m.identity === l ? m.pages : Xt, w = f.identity === l ? f.tick : 0, y = ys({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: v } = y, R = B((I, P) => {
    d.current === l && u((T) => {
      const N = T.identity === l ? T.pages : Xt;
      return N[P] === I && T.identity === l ? T : {
        identity: l,
        pages: { ...N, [P]: I }
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
    () => Math.max(h.source, h.translated),
    [h]
  ), k = v === "translated" ? h.translated : h.source || h.translated, O = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, $ = `${l}-${w}-${O}-${n}-${h.source}-${h.translated}-${D}`;
  return {
    ...y,
    numPagesByPane: h,
    hudNumPages: E,
    primaryNumPages: k,
    metricsTick: w,
    onNumPages: R,
    onMetrics: S,
    rowSyncRevision: $
  };
}
const Ue = "data-reader-page", ct = "data-reader-pane", kn = "data-natural-height", ws = "reader-react-root", Ss = "reader-react-grid", Rs = "reader-react-scroll-shell", Is = "reader-react-pdf-pane", Yr = "reader-react-pdf-page", Bt = "reader-react-pdf-page-placeholder", Nn = "reader-react-pdf-page-slot";
function jt(e, t) {
  const n = e != null ? `[${Ue}="${e}"]` : `[${Ue}]`;
  return t ? `${n}[${ct}="${t}"]` : n;
}
function Es() {
  return `.${Nn}[${Ue}]`;
}
function Ut(e) {
  return Number(e.getAttribute(Ue));
}
const Xr = 0.25, Ht = 1, Ps = 0.05, kt = 0.5, Ts = 16, ks = 8, Ns = 720;
function qe() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Qr(e) {
  return Number.isFinite(e) && e < Ns;
}
function ot(e, t = Number.POSITIVE_INFINITY) {
  return Qr(t) && (e === "source" || e === "translated") ? Ht : kt;
}
function qt(e) {
  return Number.isFinite(e) ? Math.min(Ht, Math.max(Xr, e)) : kt;
}
function St(e, t) {
  const n = qt(Number(e) + t * Ps);
  return Math.round(n * 100) / 100;
}
function Ms(e) {
  return Math.round(qt(e) * 100);
}
function As(e) {
  const n = (Number(e) || 0) - Ts - ks;
  return Math.max(160, Math.floor(n));
}
function _s(e, t = kt) {
  const n = qt(t);
  return As((Number(e) || 0) * n);
}
function Ls(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${ct}]`)
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
const Ds = 8;
function Cs(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Ds ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const eo = 200, to = [
  "markdown"
], xs = to;
function no(e) {
  return xs.includes(e);
}
const zs = "retainpdf:reader:view:v1:", or = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Os = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function ro() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function hn(e) {
  return `${e || ""}`.trim();
}
function Fs({
  documentId: e,
  jobId: t
}) {
  const n = hn(e);
  if (n) return `document:${n}`;
  const r = hn(t);
  return r ? `job:${r}` : "";
}
function oo(e) {
  const t = hn(e);
  return t ? `${zs}${t}` : "";
}
function $s(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Bs(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!or.has(t) || !or.has(n) || t === n))
    return { left: t, right: n };
}
function js(e) {
  return e === null ? null : no(e) ? e : void 0;
}
function Us(e) {
  return Os.has(e) ? e : void 0;
}
function ao(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = $s(t.anchor), r = Number(t.zoom), o = Us(t.mode), a = Bs(t.splitLayout), s = js(t.assistantPanel);
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
function Ae(e, t = ro()) {
  const n = oo(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ao(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Gt(e, t, n = ro()) {
  const r = oo(e);
  if (!r || !n) return null;
  const o = Ae(e, n), a = ao({
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
function Hs(e, t, n = "") {
  var u;
  const [r, o] = M(() => {
    var f;
    return ((f = Ae(n)) == null ? void 0 : f.zoom) ?? ot(e, qe());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), c = A(((u = Ae(n)) == null ? void 0 : u.zoom) !== void 0);
  z(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const f = (h = Ae(n)) == null ? void 0 : h.zoom;
    c.current = f !== void 0;
    const b = f ?? ot(e, qe());
    i.current = 1, a.current = b, o(b);
  }, [e, n]), z(() => {
    if (c.current) return;
    const f = ot(e, qe()), b = a.current;
    Math.abs(f - b) < 5e-4 || (i.current = 1, a.current = f, o(f));
  }, [e]);
  const l = B((f) => {
    const b = qt(f), h = a.current;
    Math.abs(b - h) < 5e-4 || (i.current = b / (h || 1), c.current = !0, Gt(s.current, { zoom: b }), o(b));
  }, []), d = B((f) => {
    l(St(a.current, f));
  }, [l]), m = B((f) => {
    l(ot(f));
  }, [l]);
  return Pe(() => {
    const f = i.current;
    Math.abs(f - 1) < 1e-3 || (i.current = 1, Ls(t == null ? void 0 : t.current, f));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: d, resetZoom: m };
}
function Ws(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: B((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const Mn = 48;
function so(e, t = Mn) {
  return e.getBoundingClientRect().top + t;
}
function io(e, t) {
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
      const m = d.getBoundingClientRect();
      return m.height >= 8 && m.width >= 8;
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
  const s = so(e, n), i = io(o, s);
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
  const d = l.height > 0 ? l.height : i.offsetHeight, m = e.scrollTop + (l.top - c.top), u = Math.max(0, m + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - u) >= 1 && (e.scrollTop = u) : e.scrollTo({ top: u, behavior: n }), !0;
}
function Vs(e, t, n = "smooth", r) {
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
function Js(e, t, n) {
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
function Ee(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Ks(e, t, n = !0, r = "", o) {
  const [a, s] = M(1);
  return z(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, d = 0;
    const m = jt(void 0, o), u = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(m));
      if (!h.length)
        return;
      const w = so(i), y = io(h, w);
      y && s(y.page);
    }, f = () => {
      c || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, u();
      }));
    }, b = () => {
      if (c) return;
      if (!Array.from(i.querySelectorAll(m)).length) {
        l = setTimeout(b, 120);
        return;
      }
      u(), i.addEventListener("scroll", f, { passive: !0 });
    };
    return b(), () => {
      c = !0, l && clearTimeout(l), d && cancelAnimationFrame(d), i.removeEventListener("scroll", f);
    };
  }, [e, t, n, r, o]), a;
}
const qs = `canvas, .react-pdf__Page, .${Yr}, .${Bt}`, ar = /* @__PURE__ */ new WeakMap();
function Gs(e) {
  const t = Number(e.getAttribute(kn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = ar.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(qs), ar.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Zs(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Ys(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Es()).forEach((r) => {
    const o = Ut(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Gs(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Xs(e, t, n = "", r) {
  const [o, a] = M(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Pe(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, d = !1, m = !1;
    const u = () => {
      var S;
      if (c) return;
      const R = e.current;
      if (!R) return;
      const g = Ys(R);
      Zs(s.current, g) || (s.current = g, a(g)), d && !m && (m = !0, (S = i.current) == null || S.call(i));
    }, f = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(u);
      });
    };
    f();
    const b = window.setTimeout(f, 100), h = window.setTimeout(() => {
      d = !0, f();
    }, 300), w = window.setTimeout(f, 700), y = e.current;
    let v = null;
    return y && typeof ResizeObserver < "u" && (v = new ResizeObserver(() => f()), v.observe(y)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(b), window.clearTimeout(h), window.clearTimeout(w), v == null || v.disconnect();
    };
  }, [e, t, n]), o;
}
const Qs = [0, 48, 140, 320, 560], ei = 700, ti = [80, 200, 400], ni = 500, ri = 50, oi = /* @__PURE__ */ new Set([
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
]), ai = 180, sr = [0, 48, 140, 320, 700, 1200];
function si(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((P = Ae(a)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), c = A(null), l = A(!1), d = A(r), m = A(null), u = A(null), f = A(null), b = A(null), h = A(a), w = A(""), y = A(n);
  y.current = n;
  const v = B(() => {
    var T;
    (T = m.current) == null || T.call(m), m.current = null, u.current != null && (clearTimeout(u.current), u.current = null);
  }, []), R = B(() => {
    !l.current && c.current == null || (v(), f.current != null && (clearTimeout(f.current), f.current = null), c.current = null, l.current = !1);
  }, [v]), g = B((T = !1) => {
    b.current != null && (clearTimeout(b.current), b.current = null);
    const N = () => {
      b.current = null, Gt(h.current, {
        anchor: Ee(i.current)
      });
    };
    T ? N() : b.current = setTimeout(N, ai);
  }, []), S = B((T) => {
    i.current = Ee(T), c.current = null, f.current != null && clearTimeout(f.current), f.current = setTimeout(() => {
      f.current = null, l.current = !1;
    }, ri);
  }, []);
  z(() => {
    if (!o)
      return;
    let T = !1, N = null, _ = null, j = null;
    const F = () => {
      if (T) return;
      const q = e.current;
      if (!q) {
        j = setTimeout(F, 50);
        return;
      }
      N = q, _ = () => {
        if (l.current)
          return;
        const ee = zt(N, y.current);
        ee && (i.current = ee, g());
      }, N.addEventListener("scroll", _, { passive: !0 }), l.current || _();
    };
    return F(), () => {
      T = !0, j != null && clearTimeout(j), N && _ && N.removeEventListener("scroll", _);
    };
  }, [o, r, n, e, g]), z(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const N = (_) => {
      _.metaKey || _.ctrlKey || _.altKey || oi.has(_.key) && R();
    };
    return T.addEventListener("wheel", R, { passive: !0 }), T.addEventListener("touchmove", R, { passive: !0 }), window.addEventListener("keydown", N), () => {
      T.removeEventListener("wheel", R), T.removeEventListener("touchmove", R), window.removeEventListener("keydown", N);
    };
  }, [o, e, R]), Pe(() => {
    var N;
    if (h.current === a) return;
    g(!0), v(), f.current != null && (clearTimeout(f.current), f.current = null), h.current = a, w.current = "";
    const T = (N = Ae(a)) == null ? void 0 : N.anchor;
    i.current = T ? Ee(T) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, d.current = r;
  }, [a, r, g, v]), z(() => {
    var N;
    if (!o || !s || !a || w.current === a) return;
    w.current = a;
    const T = Ee(
      ((N = Ae(a)) == null ? void 0 : N.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = T, c.current = T, l.current = !0, v(), m.current = pn(
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
    const T = c.current ? Ee(c.current) : Ee(i.current);
    return l.current = !0, c.current = T, i.current = T, v(), m.current = pn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Qs,
        onDone: () => S(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, S(T);
    }, ei), () => {
      v();
    };
  }, [r, o, n, e, S, v]), z(() => () => {
    v(), f.current != null && (clearTimeout(f.current), f.current = null), g(!0);
  }, [v, g]);
  const E = B(() => {
    const T = zt(
      e.current,
      y.current
    );
    return Ee(T || i.current);
  }, [e]), k = B(() => {
    l.current = !0;
    const T = zt(
      e.current,
      y.current
    ), N = Ee(T ?? i.current);
    return i.current = N, c.current = N, g(), N;
  }, [e, g]), O = B((T, N, _) => {
    const j = _ || y.current, F = Wt(T, N || 1), q = { page: F, fraction: 0 };
    i.current = q, l.current = !0, c.current = q, g(), v(), Vs(e.current, F, "smooth", j), m.current = Js(
      () => e.current,
      F,
      {
        behavior: "auto",
        pane: j,
        delaysMs: ti,
        onDone: () => S(q)
      }
    ), u.current = setTimeout(() => {
      u.current = null, S(q);
    }, ni);
  }, [e, S, v, g]), D = B(() => Ee(i.current), []), $ = B(() => l.current, []), I = B(() => {
    if (!l.current || !c.current)
      return;
    const T = Ee(c.current);
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
    getAnchor: D,
    isRestoring: $,
    repinIfRestoring: I
  };
}
function ii(e, t) {
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
function co(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const ci = [0, 80, 200, 400, 800], li = 120, di = 400;
function ui(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: d = !0 } = e, m = A(a);
  m.current = a;
  const u = A(s);
  u.current = s;
  const f = A(i);
  f.current = i;
  const b = A(n);
  b.current = n, z(() => {
    var g, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = La(), w = ii(h, u.current);
    if (w == null && (h != null && h.blockId) && !d) return;
    const y = co(h, w, { jobId: c, documentId: l });
    if (t.current === y)
      return;
    if (w == null) {
      t.current = y, (g = b.current) == null || g.call(b);
      return;
    }
    t.current = y, h && ((S = f.current) == null || S.call(f, h, w));
    const v = [];
    let R = 0;
    for (const E of ci)
      R = Math.max(R, E), v.push(
        setTimeout(() => {
          m.current(w);
        }, E)
      );
    return v.push(
      setTimeout(() => {
        var E;
        (E = b.current) == null || E.call(b);
      }, R + li)
    ), () => {
      for (const E of v) clearTimeout(E);
    };
  }, [r, o, c, l, t, d]);
}
function fi(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function mi(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = di,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, d = A(a);
  d.current = a;
  const m = A(l);
  m.current = l;
  const u = A(0);
  z(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || u.current === o) return;
    const f = setTimeout(() => {
      var y;
      const b = ((y = globalThis.location) == null ? void 0 : y.search) || "", h = Qo(b, o, d.current);
      if (u.current = o, h === null) return;
      const w = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = co(
        { blockId: w },
        o,
        { jobId: i, documentId: c }
      ), (m.current || fi)(h);
    }, s);
    return () => clearTimeout(f);
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
function hi(e) {
  const t = A(""), [n, r] = M(!1), o = B(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  ui(a, t, o), mi(e, t, n);
}
const mt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function pi(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function ir(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function lo(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = ir(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = ir(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function gi(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = lo(r, t, n);
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
function bi(e) {
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
async function yi(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (lo(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
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
function vi({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = M(mt), s = A(o), i = A("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), d = vt(l) ? l : "";
  return z(() => {
    if (!n || !c) {
      i.current = "", s.current = mt, a(mt);
      return;
    }
    const m = r === void 0 ? _a() : r, u = i.current === c;
    if (i.current = c, !m) {
      const R = {
        ...u ? s.current : mt,
        connection: d ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = R, a(R);
      return;
    }
    const f = new AbortController();
    let b = !1;
    const h = {
      ...u ? s.current : mt,
      connection: d ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const w = (R) => {
      f.signal.aborted || a((g) => {
        const S = R(g);
        return s.current = S, S;
      });
    }, y = async () => {
      let R = 0;
      for (; !f.signal.aborted; )
        try {
          const g = await m.fetchLayout(c, { signal: f.signal });
          b = !0, w((S) => ({
            ...S,
            layoutByPage: pi(g),
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
          })), await gn(cr[Math.min(R, cr.length - 1)], f.signal).catch(() => {
          }), R += 1;
        }
    };
    return (async () => {
      if (await y(), !b || f.signal.aborted) return;
      let R = 0;
      for (; !f.signal.aborted; ) {
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
          await m.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: f.signal,
            onEvent: async (g) => {
              if (g.seq <= s.current.lastSeq) return;
              let S;
              try {
                S = await yi(
                  c,
                  g,
                  s.current,
                  f.signal,
                  m
                );
              } catch (E) {
                if ((E == null ? void 0 : E.name) === "AbortError" || f.signal.aborted) throw E;
                w((k) => ({
                  ...k,
                  lastSeq: Math.max(k.lastSeq, g.seq),
                  error: Lt(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              w((E) => {
                const k = gi(E, g, S);
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
          if ((g == null ? void 0 : g.name) === "AbortError" || f.signal.aborted) return;
          w((S) => ({
            ...S,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: l,
            error: Lt(g, "实时译文连接已中断，正在重连")
          }));
        }
        if (f.signal.aborted) return;
        if (d) {
          w((g) => ({
            ...g,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await gn(lr[Math.min(R, lr.length - 1)], f.signal).catch(() => {
        }), R += 1;
      }
    })(), () => f.abort();
  }, [n, r, c, d]), o;
}
function wi(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Si(e, t = !0) {
  const [n, r] = M(() => /* @__PURE__ */ new Map());
  return z(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = He().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(wi(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Ri = 4500;
function Ii(e) {
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
const Ei = /* @__PURE__ */ new Set(["book", "translate"]);
function uo(e) {
  return !!(e.jobId && e.sourceUrl && Ei.has(e.workflow));
}
function Pi(e) {
  return !!(uo(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Ti() {
  const e = ms(), t = uo({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Pi({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !vt(o) && (r.current.running = !0);
  const a = vi({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = bs(), d = Si(e.jobId, !e.sourceOnly), m = Fs({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${m}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: f, onZoomChange: b } = Hs(e.mode, s, m), h = vs(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: f, shellWidth: c, identityKey: u }
  ), {
    beginModeSwitch: w,
    goToPage: y,
    repinIfRestoring: v
  } = si(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: m,
    restoreReady: h.primaryNumPages > 0
  });
  z(() => {
    v();
  }, [c, v]);
  const R = Xs(
    s,
    h.compareMode,
    h.rowSyncRevision,
    v
  ), g = Ks(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${f}-${h.metricsTick}`,
    h.primaryPane
  ), S = B((F, q) => {
    var Z, Y;
    const ee = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Z = h.numPagesByPane) == null ? void 0 : Z.source) || 0,
      Number((Y = h.numPagesByPane) == null ? void 0 : Y.translated) || 0
    );
    y(F, ee, q);
  }, [y, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [E, k] = M(null), O = A(null), D = B((F) => {
    O.current && clearTimeout(O.current), k(F), F && (O.current = setTimeout(() => k(null), Ri));
  }, []);
  z(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const $ = B((F) => {
    const q = Yt(e.regions, F);
    return q ? Gn(q, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = B((F, q) => {
    const ee = q || h.primaryPane, Z = typeof F == "object" && F ? `${F.block_id || ""}`.trim() : "", Y = typeof F == "object" && F ? `${F.image_url || ""}`.trim() : "", he = typeof F == "object" && F ? F.page_idx != null ? Number(F.page_idx) + 1 : F.page != null ? Number(F.page) : null : typeof F == "number" ? F + 1 : null, ae = ta(e.regions, Y, he) || Yt(e.regions, Z) || (typeof F == "object" ? na(e.regions, F) : null);
    let se = ae ? Gn(ae, ee).page : null;
    se == null && (se = Ii(F)), !(se == null || se < 1) && (D(ae), S(se, ee));
  }, [D, S, h.primaryPane, e.regions]);
  hi({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: g,
    goToPage: S,
    resolveBlockPage: $,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (F) => {
      D(Yt(e.regions, F.blockId));
    }
  });
  const { setModeKeepingPage: P } = Ws({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: w
  });
  z(() => {
    D(null);
  }, [u, D]);
  const T = !e.boot.loading && !e.boot.failed, N = K(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), _ = K(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), j = K(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: f,
    onZoomChange: b,
    shell: N,
    panes: h,
    sessionFiles: _,
    rowHeights: R,
    goToPage: S,
    activeRegion: E,
    jumpToAnchor: I,
    setModeKeepingPage: P,
    download: e.download,
    showHud: T,
    viewStateKey: m,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, N, h, _, R, S, E, I, P, T, f, b, m, a, n, d]);
  return K(() => ({
    ...j,
    currentPage: g
  }), [j, g]);
}
const ki = [
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
], Ni = [
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
function Mi(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of ki)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Ai(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const _i = ".reader-notes-panel";
function Li(e) {
  return e instanceof Element ? !!e.closest(_i) : !1;
}
function Di(e) {
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
    const d = (m) => {
      if (m.defaultPrevented || m.metaKey || m.ctrlKey || m.altKey || Ai(m.target) || Li(m.target))
        return;
      const u = m.key, f = Mi(u);
      if (f) {
        if (f.mode) {
          if (n && f.mode !== "source")
            return;
          m.preventDefault(), r(f.mode);
          return;
        }
        if (!(f.requiresPages && i <= 0))
          switch (m.preventDefault(), f.action) {
            case "zoom-in":
              a(St(o, 1));
              return;
            case "zoom-out":
              a(St(o, -1));
              return;
            case "zoom-reset":
              a(ot(t, qe()));
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
const Ci = "retainpdf:soft-reader-close";
function xi() {
  return new URL("./index.html", window.location.href).href;
}
function zi() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Ci },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Oi(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Fi() {
  if (!(typeof window > "u") && !zi()) {
    if (Oi(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(xi());
  }
}
function $i({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Bi({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L($i, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Fi();
  }, children: [
    /* @__PURE__ */ p(Kt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let dr = !1;
function ji() {
  if (dr)
    return;
  const e = wt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (qr.GlobalWorkerOptions.workerSrc = e, dr = !0);
}
const Ui = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Hi(e, t, n) {
  return e.flatMap((r) => {
    if (!Ui.has(Tt(r.region))) return [];
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
async function Wi(e) {
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
const Vi = "reader-text-hover-copy", Ji = "reader-text-hover-edit", Ki = "reader-text-hover-id";
function qi(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const fo = "reader-text-hover-tools";
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
const mo = 26, ho = 220;
function po(e, t = ho) {
  return e.height < mo * 2 || e.width < t;
}
function Gi({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a
}) {
  const [s, i] = M("idle"), [c, l] = M("idle"), [d] = M(() => qi()), m = A([]), u = (e == null ? void 0 : e.itemId) || "";
  if (z(() => {
    i("idle"), l("idle");
    const R = m.current;
    return () => {
      R.forEach((g) => window.clearTimeout(g)), m.current = [];
    };
  }, [u]), !e) return null;
  const f = ra(e.highlight.region, t), b = Tt(e.highlight.region), h = (R, g) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const E = await Wi(R);
    g(E ? "copied" : "failed"), m.current.push(window.setTimeout(() => g("idle"), 1200));
  }, w = b === "formula" ? "复制 LaTeX" : "复制", y = o || e.rect, v = a || (po(y) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": b,
      style: y,
      children: /* @__PURE__ */ L(
        "div",
        {
          className: fo,
          "data-placement": v,
          children: [
            d ? /* @__PURE__ */ p(
              en,
              {
                className: Ki,
                state: c,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: h(e.itemId, l),
                children: c === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && n > 0 ? /* @__PURE__ */ L("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            t === "translated" && r ? /* @__PURE__ */ p(
              en,
              {
                className: Ji,
                state: "idle",
                label: "改这段译文",
                title: "改这段译文（E）",
                onClick: (R) => {
                  R.preventDefault(), R.stopPropagation(), r(e.itemId);
                },
                children: "改"
              }
            ) : null,
            f ? /* @__PURE__ */ p(
              en,
              {
                className: Vi,
                state: s,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: h(f, i),
                children: s === "copied" ? "已复制" : s === "failed" ? "复制失败" : w
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Zi(e, t) {
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
function Yi(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = Tn(
      Zi(e, a),
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
const Xi = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Qi = 256, ht = /* @__PURE__ */ new Map();
function ec(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function go(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ea(t, { bareLatex: !0 }), o = ec(n), a = Pa(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = ht.get(t);
  if (!s && (s = Ta(o, r), ht.set(t, s), ht.size > Qi)) {
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
function tc(e, t) {
  const n = e.typography, r = Ce(t) || 1, o = Ce(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = tn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ce(n == null ? void 0 : n.fit_min_font_size_pt), d = Ce(n == null ? void 0 : n.fit_max_font_size_pt), m = Math.max(3.5, (l || 5.5) * r), u = Math.max(
    m,
    d ? d * r : o ? o * r : c
  ), f = o ? o * r : c, b = Ce(n == null ? void 0 : n.leading_em), h = [
    Ce(n == null ? void 0 : n.padding_top_pt) || 0,
    Ce(n == null ? void 0 : n.padding_right_pt) || 0,
    Ce(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ce(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((w) => w * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Xi,
    fontSizePx: Math.max(m, Math.min(u, f)),
    minFontSizePx: m,
    maxFontSizePx: u,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: b ? 1 + b : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (tn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : tn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function nc(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (m) => {
    const u = s.get(m);
    if (u !== void 0) return u;
    const { width: f, height: b } = e(m), h = f <= t + 0.5 && b <= n + 0.5;
    return s.set(m, h), h;
  };
  let c = o, l = a, d = Math.min(r.requestedFontSizePx, l);
  if (i(d)) {
    if (!r.exact) {
      c = d;
      for (let m = 0; m < 6 && l > c; m += 1) {
        const u = (c + l) / 2;
        i(u) ? (d = u, c = u) : l = u;
      }
    }
  } else {
    l = d, d = c;
    for (let m = 0; m < 8 && l > c; m += 1) {
      const u = (c + l) / 2;
      i(u) ? (d = u, c = u) : l = u;
    }
  }
  return Math.max(o, d);
}
const rc = 512, pt = /* @__PURE__ */ new Map();
let bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  bn += 1;
}));
function oc(e, t, n, r) {
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
function bo({ item: e, pageScale: t }) {
  const n = A(null), r = K(
    () => go(e.translatedText),
    [e.translatedText]
  ), [o, a] = M(r.fallbackHtml), s = K(
    () => tc(e, t),
    [e, t]
  );
  z(() => {
    let m = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((u) => {
      m && a(u);
    }), () => {
      m = !1;
    };
  }, [r]), Pe(() => {
    const m = n.current;
    if (!m) return;
    const [u, f, b, h] = s.padding, w = Math.max(1, e.rect.width - h - f), y = Math.max(1, e.rect.height - u - b), v = oc(o, w, y, s);
    let R = pt.get(v);
    if (R === void 0 && (R = nc(
      (g) => (m.style.fontSize = `${g}px`, { width: m.scrollWidth, height: m.scrollHeight }),
      w,
      y,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), pt.set(v, R), pt.size > rc)) {
      const g = pt.keys().next().value;
      g !== void 0 && pt.delete(g);
    }
    m.style.fontSize = `${R.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, c, l, d] = s.padding;
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
        padding: `${i}px ${c}px ${l}px ${d}px`
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
function ac({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = K(
    () => Yi(e, t, n, r),
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
        bo,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const sc = Jt(ac);
function ic({
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
        bo,
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
      /* @__PURE__ */ p("span", { className: "reader-edited-badge", style: { left: a.rect.left, top: a.rect.top }, children: "待排版" })
    ] }, a.itemId);
  }) }) : null;
}
const cc = Jt(ic);
function lc(e) {
  return e === "formula" ? 84 : 64;
}
const dc = 6, Ke = (e) => e.left + e.width, bt = (e) => e.top + e.height, uc = (e, t) => e.top < bt(t) && t.top < bt(e);
function fc(e, t, n, r) {
  const o = r + dc;
  let a = n, s = 0;
  for (const i of t)
    i === e || !uc(e, i) || (i.left >= Ke(e) - 1 && (a = Math.min(a, i.left)), Ke(i) <= e.left + 1 && (s = Math.max(s, Ke(i))));
  return a - Ke(e) >= o ? "side-right" : e.left - s >= o ? "side-left" : po(e, r) ? "outside" : "inside";
}
function mc(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const d = l.left + l.width / 2, m = l.top + l.height / 2;
    d < e.left || d > Ke(e) || m < e.top || m > bt(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, Ke(l)), i = Math.max(i, bt(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(Ke(e) + r, s + n) - c.left, c.height = Math.min(bt(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function hc(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function pc(e, t, n, r, o) {
  const [a, s] = M(null);
  return Pe(() => {
    if (!t) {
      s(null);
      return;
    }
    const i = e.current, c = i ? mc(t.rect, hc(i)) : t.rect, l = fc(t.rect, n.map((d) => d.rect), r, lc(o));
    s({ rect: c, placement: l });
  }, [e, o, r, t, n]), a && t ? a : null;
}
function ie(e) {
  return typeof e == "string" ? e : "";
}
function gc(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function bc(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function yc(e) {
  return {
    source: ie(e == null ? void 0 : e.source_text) || ie(e == null ? void 0 : e.unit_source_text),
    translated: ie(e == null ? void 0 : e.protected_translated_text) || ie(e == null ? void 0 : e.translated_text)
  };
}
const vc = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function yo(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function wc(e) {
  const t = yo(e).sort((r, o) => ie(r.ts).localeCompare(ie(o.ts)));
  return t.length ? [
    { text: ie(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ie(r.new_text),
      label: vc[ie(r.source)] || ie(r.source) || "修订",
      ts: ie(r.ts),
      reason: ie(r.reason)
    }))
  ].reverse() : [];
}
function Sc(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Rc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ie(r.finished_at) || ie(n.finished_at) || "";
}
function Ic(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = yo(e).sort((a, s) => ie(a.ts).localeCompare(ie(s.ts)));
  for (const a of o) {
    const s = new Date(ie(a.ts)).getTime(), i = ie(a.reader_item_id) || ie(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ie(a.new_text));
  }
  return n;
}
const Ec = {
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
function Pc(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = Ec[ie(n.kind)] || ie(n.kind) || "问题", o = ie(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Tc = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function kc(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Tc.has(Tt(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Nc = 300, Mc = 72;
function Ac(e, t) {
  if (e.width >= Nc && e.height >= Mc)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
function _c({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = M(null), [i, c] = M(!1), [l, d] = M([]), [m, u] = M(""), [f, b] = M(""), [h, w] = M(!1), [y, v] = M(null), [R, g] = M([]), S = r.drafts, E = r.generation, k = B(async (I, P) => {
    if (e)
      try {
        d(wc(await e.fetchRevisions(I, P)));
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
      const N = `${(P == null ? void 0 : P.item_id) || n}`, { source: _, translated: j } = yc(T);
      s({ readerItemId: n, itemId: N, source: _, current: j }), u(S.get(n) ?? j);
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
  }, [n, S]), D = B(async (I, P) => {
    if (!e || !a || h) return !1;
    const T = I ?? m;
    if (!T.trim()) return !1;
    w(!0), v(null), g([]);
    try {
      const N = await e.revise(t, a.itemId, {
        translated_text: T,
        source: "user",
        reason: (P ?? f).trim() || "在阅读页手动修改",
        ...E.current != null ? { expected_generation: E.current } : {}
      }), _ = Number(N == null ? void 0 : N.generation);
      return Number.isFinite(_) && (E.current = _), S.delete(a.readerItemId), s({ ...a, current: T }), u(T), b(""), (N == null ? void 0 : N.changed) === !1 ? v({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, T), v({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), k(t, a.readerItemId), !0;
    } catch (N) {
      const _ = N;
      return (_ == null ? void 0 : _.reason) === "generation_mismatch" && (E.current = null), v({ tone: "error", message: (_ == null ? void 0 : _.message) || "保存失败，请稍后再试。" }), g(Pc(_ == null ? void 0 : _.issues)), !1;
    } finally {
      w(!1);
    }
  }, [e, a, h, m, f, t, o, k, S, E]), $ = B(() => {
    n && S.delete(n);
  }, [n, S]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: m,
    setDraft: O,
    reason: f,
    setReason: b,
    saving: h,
    status: y,
    issues: R,
    save: D,
    discardDraft: $
  };
}
const vo = "reader-inline-edit";
function Lc({ text: e }) {
  const [t, n] = M("");
  return z(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = go(e);
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
function Dc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var $;
  const s = e.itemId, i = _c({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = M(!1), [d, m] = M(!1), u = A(null), f = Ac(e.rect, t), b = K(() => kc(o), [o]), h = b.indexOf(s), { loaded: w } = i, y = i.saving || i.loading, v = n.blockedReason, R = !w || i.draft === w.current, { close: g, select: S } = n, E = B((I) => {
    const P = b[h + I];
    P && (S(P), a == null || a(P));
  }, [b, h, S, a]), k = B(() => {
    i.discardDraft(), g();
  }, [i, g]), O = B(async (I, P) => {
    await i.save(I, P) && g();
  }, [i, g]);
  z(() => {
    const I = (P) => {
      !P.altKey || P.key !== "ArrowUp" && P.key !== "ArrowDown" || (P.preventDefault(), E(P.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [E]), Pe(() => {
    const I = u.current;
    if (!I) return;
    I.style.height = "auto";
    const P = f.mode === "inline" ? f.minHeight : 0;
    I.style.height = `${Math.max(P, I.scrollHeight + 2)}px`;
  }, [i.draft, w, f.mode, f.mode === "inline" ? f.minHeight : 0]);
  const D = f.mode === "inline" ? { left: f.left, top: f.top, width: f.width } : { left: f.left, width: f.width, top: f.top, bottom: f.bottom };
  return /* @__PURE__ */ L(dt, { children: [
    f.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${vo} is-${f.mode}`,
        style: D,
        role: "group",
        "aria-label": `改第 ${(($ = n.target) == null ? void 0 : $.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": f.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (w != null && w.source) ? /* @__PURE__ */ p(
            fe,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((I) => !I),
              children: w.source
            }
          ) : null,
          v ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: v }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          w ? /* @__PURE__ */ p(
            Sa,
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
          w ? /* @__PURE__ */ p(Lc, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(Yn, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => E(-1), children: /* @__PURE__ */ p(la, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(Yn, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= b.length - 1, onClick: () => E(1), children: /* @__PURE__ */ p(Ur, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              Kr,
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
            i.history.length ? /* @__PURE__ */ L(
              fe,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": d,
                "data-block-edit-action": "history",
                onClick: () => m((I) => !I),
                children: [
                  /* @__PURE__ */ p(da, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(fe, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: k, children: "取消" }),
            /* @__PURE__ */ p(
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
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          d && w && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, P) => {
            const T = I.text === w.current, N = [Sc(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": I.label, "data-current": T ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  N,
                  T ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                T ? null : /* @__PURE__ */ p(
                  fe,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: y || !!v,
                    onClick: () => {
                      O(I.text, `回到「${N.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${P}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const wo = In(null), So = In(null);
function Cc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(wo.Provider, { value: e, children: /* @__PURE__ */ p(So.Provider, { value: t, children: n }) });
}
function ze() {
  return En(wo);
}
function Ro() {
  return En(So);
}
const Be = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), xc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, zc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Oc = {
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
function Fc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => fr(o ?? a ?? "", xc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => fr(o ?? a ?? "", zc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Oc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function $c(e) {
  return Be(e.translatedBlockText) || Be(e.translated.text) || Be(e.source.text);
}
const Bc = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function jc(e) {
  const t = [];
  for (const n of e) {
    if (!Bc(n)) continue;
    const r = Fc($c(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Uc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Hc = 24, Wc = 60;
function mr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Hc), o = Math.min(e.length, n + t.length + Wc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Vc(e, t, n = 200) {
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
function Jc(e, t) {
  const n = Be(t).toLowerCase();
  if (!n || !e) return Dt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Dt(e.slice(a, s))}<mark class="reader-find-mark">${Dt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Dt(e.slice(a));
}
function Kc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Io = 1.414;
function qc({
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
  regionHighlight: m = null,
  regionTargets: u = [],
  hoveredRegionId: f,
  onHoverRegion: b,
  liveTranslationLayout: h,
  liveTranslationPage: w,
  showLiveTranslation: y = r === "source"
}) {
  var oe;
  const v = ze(), R = v == null ? void 0 : v.revisedBlocks, g = v == null ? void 0 : v.blockEdit, S = g == null ? void 0 : g.pendingEdits, E = v == null ? void 0 : v.editBlock, k = (v == null ? void 0 : v.findTerm) || "", O = K(
    () => k ? ({ str: x }) => Jc(x, k) : void 0,
    [k]
  ), D = A(c ?? Io), [$, I] = M(D.current);
  z(() => {
    c != null && Math.abs(c - D.current) >= 1e-3 && (D.current = c, I(c));
  }, [c]);
  const P = A(d);
  P.current = d;
  const T = A(null), N = A((x) => {
    var X;
    T.current = x, (X = P.current) == null || X.call(P, x);
  }).current, _ = A(null), j = A(`${t}@${n}`);
  Pe(() => {
    const x = `${t}@${n}`;
    j.current !== x && (j.current = x, o && Zc(T.current, _.current));
  }, [o, n, t]), z(() => {
    o || nn(_.current);
  }, [o]), z(() => () => nn(_.current), []);
  const F = Math.max(120, Math.floor(t * $)), q = Math.max(F, Math.ceil(s || 0)), ee = Tn(m, t, F), Z = K(
    () => Hi(u, t, F),
    [F, u, t]
  ), [Y, he] = M(null), ae = typeof b == "function", se = ae ? f ?? null : Y, ce = (x) => {
    ae ? x !== (f ?? null) && (b == null || b(x)) : he((X) => X === x ? X : x);
  }, H = K(
    () => Z.find((x) => x.itemId === se) || null,
    [se, Z]
  ), Q = r === "translated" && ((oe = g == null ? void 0 : g.target) == null ? void 0 : oe.itemId) || "", ge = K(
    () => Q && Z.find((x) => x.itemId === Q) || null,
    [Q, Z]
  ), ve = H ? Tt(H.highlight.region) : "", pe = pc(T, o ? H : null, Z, t, ve), We = (x) => {
    var Ie, _e, ke, et;
    if (x.pointerType === "touch") return;
    if (x.buttons !== 0) {
      ce(null);
      return;
    }
    if ((_e = (Ie = x.target) == null ? void 0 : Ie.closest) != null && _e.call(Ie, `.${fo}`) || (et = (ke = x.target) == null ? void 0 : ke.closest) != null && et.call(ke, `.${vo}`)) return;
    const X = x.currentTarget.getBoundingClientRect(), me = x.clientX - X.left, le = x.clientY - X.top, de = pe == null ? void 0 : pe.rect;
    if (de && (pe == null ? void 0 : pe.placement) === "outside" && me >= de.left - 4 && me <= de.left + ho && le >= de.top - mo && le <= de.top) return;
    const ue = ur(Z, me, le);
    ce((ue == null ? void 0 : ue.itemId) || null);
  }, Re = (x) => {
    if (x.pointerType === "mouse") return;
    const X = x.currentTarget.getBoundingClientRect(), me = ur(
      Z,
      x.clientX - X.left,
      x.clientY - X.top
    );
    ce((me == null ? void 0 : me.itemId) || null);
  }, V = (x) => {
    !Number.isFinite(x) || x <= 0 || Math.abs(D.current - x) < 1e-3 || (D.current = x, I(x), l == null || l(e, x));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: N,
      [Ue]: e,
      [ct]: r,
      [kn]: F,
      className: Nn,
      onPointerMoveCapture: We,
      onPointerDown: Re,
      onPointerLeave: (x) => {
        x.pointerType === "mouse" && ce(null);
      },
      style: {
        width: t,
        height: q,
        minHeight: q
      },
      children: [
        o ? /* @__PURE__ */ p(
          Ra,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: O,
            renderAnnotationLayer: !1,
            className: Yr,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Bt,
                style: { width: t, height: F }
              }
            ),
            onLoadSuccess: (x) => {
              try {
                const X = x.getViewport({ scale: 1 });
                if (X.width > 0) {
                  const me = X.height / X.width;
                  V(me);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              nn(_.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: Bt,
            style: { width: t, height: F },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: _, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        ee ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": m == null ? void 0 : m.itemId,
            style: ee,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && y ? /* @__PURE__ */ p(
          sc,
          {
            layoutPage: h,
            pageState: w,
            width: t,
            height: F
          }
        ) : null,
        o && r === "translated" && (S != null && S.size) ? /* @__PURE__ */ p(cc, { targets: Z, edits: S, width: t, excludeId: ge == null ? void 0 : ge.itemId }) : null,
        o && ge && g ? /* @__PURE__ */ p(
          Dc,
          {
            target: ge,
            page: { width: t, height: F },
            edit: g,
            showSource: !!(v != null && v.editShowsSource),
            regions: v == null ? void 0 : v.regions,
            jumpToBlock: v == null ? void 0 : v.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: Z.filter((x) => R.has(x.itemId)).map((x) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": x.itemId,
            style: { left: x.rect.left, top: x.rect.top, height: x.rect.height }
          },
          x.itemId
        )) }) : null,
        /* @__PURE__ */ p(
          Gi,
          {
            target: o && (H == null ? void 0 : H.itemId) !== (ge == null ? void 0 : ge.itemId) ? H : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: H && (R == null ? void 0 : R.get(H.itemId)) || 0,
            onEdit: E,
            frameRect: pe == null ? void 0 : pe.rect,
            placement: pe == null ? void 0 : pe.placement
          }
        )
      ]
    }
  );
}
const Gc = Jt(qc);
function Zc(e, t) {
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
const Yc = 2 * 1024 * 1024;
function Xc(e) {
  const t = new qr.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const rn = 5, Qc = "120% 0px", el = 120, tl = "25% 0px";
let hr = 1;
const pr = /* @__PURE__ */ new WeakMap();
function nl(e) {
  if (!e) return 0;
  const t = pr.get(e);
  if (t) return t;
  const n = hr;
  return hr += 1, pr.set(e, n), n;
}
function rl() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const ol = Vo(
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
    onLoadSuccess: m,
    onLoadError: u,
    onNumPagesChange: f,
    activeRegion: b = null,
    regions: h = [],
    readerMetadata: w = null,
    hoveredRegionId: y = null,
    onHoverRegion: v,
    liveTranslation: R,
    showLiveTranslation: g = t === "source",
    liveTranslationPendingLabel: S = "",
    paneAction: E
  }, k) {
    ji();
    const { file: O, loading: D, error: $ } = is(n, r), I = `${n}\0${nl(O)}`, P = A(I);
    P.current = I;
    const T = K(() => {
      const C = ts(O);
      return C ? "ranged" in C ? { range: Xc(C.ranged) } : C : null;
    }, [O, n]), [N, _] = M(0), [j, F] = M(""), [q, ee] = M(null), [Z, Y] = M(480), he = A(null), ae = A(0), se = K(() => rl(), []), ce = K(() => ({
      cMapUrl: wt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: wt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Yc,
      disableAutoFetch: !0
    }), []);
    Pn(k, () => q, [q]), z(() => {
      const C = (U) => {
        ae.current = U, Y(U);
      }, J = (U) => {
        const ne = Cs(U, ae.current);
        if (ne !== "ignore") {
          if (he.current && clearTimeout(he.current), ne === "immediate") {
            C(U);
            return;
          }
          he.current = setTimeout(() => C(U), eo);
        }
      }, W = !!(c && c >= 80);
      J(W ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const re = !W && i && typeof ResizeObserver < "u" ? new ResizeObserver((U) => {
        var ne, be;
        J(((be = (ne = U[0]) == null ? void 0 : ne.contentRect) == null ? void 0 : be.width) ?? i.clientWidth);
      }) : null;
      return re && i && re.observe(i), () => {
        re == null || re.disconnect(), he.current && clearTimeout(he.current);
      };
    }, [c, i, a]);
    const H = K(
      () => _s(Z, o),
      [Z, o]
    ), [Q, ge] = M(() => /* @__PURE__ */ new Map()), [ve, pe] = M(() => /* @__PURE__ */ new Set()), [We, Re] = M(() => /* @__PURE__ */ new Set()), V = A(/* @__PURE__ */ new Map()), oe = A(null), x = A(null), [X, me] = M(() => /* @__PURE__ */ new Set()), le = A(/* @__PURE__ */ new Map()), de = B((C, J) => {
      ge((W) => {
        if (W.get(C) === J) return W;
        const G = new Map(W);
        return G.set(C, J), G;
      });
    }, []), ue = B((C, J) => {
      const W = V.current, G = W.get(C), re = [oe.current, x.current];
      if (G)
        for (const U of re)
          try {
            U == null || U.unobserve(G);
          } catch {
          }
      if (J) {
        W.set(C, J);
        for (const U of re)
          try {
            U == null || U.observe(J);
          } catch {
          }
      } else
        W.delete(C);
    }, []), Ie = A(/* @__PURE__ */ new Map()), _e = B((C) => {
      const J = Ie.current;
      let W = J.get(C);
      return W || (W = (G) => ue(C, G), J.set(C, W)), W;
    }, [ue]);
    z(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = le.current, J = new IntersectionObserver(
        (W) => {
          const G = [], re = [];
          for (const U of W) {
            const ne = U.target, be = Ut(ne);
            Number.isFinite(be) && (U.isIntersecting ? G : re).push(be);
          }
          if ((G.length || re.length) && pe((U) => {
            let ne = null;
            for (const be of G)
              U.has(be) || (ne = ne || new Set(U), ne.add(be));
            for (const be of re)
              U.has(be) && (ne = ne || new Set(U), ne.delete(be));
            return ne || U;
          }), G.length) {
            for (const U of G) {
              const ne = C.get(U);
              ne && (clearTimeout(ne), C.delete(U));
            }
            Re((U) => {
              let ne = null;
              for (const be of G)
                U.has(be) || (ne = ne || new Set(U), ne.add(be));
              return ne || U;
            });
          }
          for (const U of re)
            C.has(U) || C.set(U, setTimeout(() => {
              C.delete(U), Re((ne) => {
                if (!ne.has(U)) return ne;
                const be = new Set(ne);
                return be.delete(U), be;
              });
            }, el));
        },
        { root: i, rootMargin: Qc, threshold: 0 }
      );
      oe.current = J;
      for (const W of V.current.values())
        try {
          J.observe(W);
        } catch {
        }
      return () => {
        J.disconnect(), oe.current === J && (oe.current = null);
        for (const W of C.values()) clearTimeout(W);
        C.clear();
      };
    }, [i]), z(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = new IntersectionObserver(
        (J) => {
          me((W) => {
            let G = null;
            for (const re of J) {
              const U = Ut(re.target);
              !Number.isFinite(U) || re.isIntersecting === W.has(U) || (G = G || new Set(W), re.isIntersecting ? G.add(U) : G.delete(U));
            }
            return G || W;
          });
        },
        { root: i, rootMargin: tl, threshold: 0 }
      );
      x.current = C;
      for (const J of V.current.values())
        try {
          C.observe(J);
        } catch {
        }
      return () => {
        C.disconnect(), x.current === C && (x.current = null);
      };
    }, [i]);
    const ke = !!i && typeof IntersectionObserver < "u";
    Pe(() => {
      _(0), F(""), pe(/* @__PURE__ */ new Set()), Re(/* @__PURE__ */ new Set()), ge(/* @__PURE__ */ new Map()), V.current.clear();
      const C = le.current;
      for (const J of C.values()) clearTimeout(J);
      C.clear(), f == null || f(0, t);
    }, [I, f, t]);
    const et = B(
      ({ numPages: C }) => {
        P.current === I && (_(C), F(""), f == null || f(C, t), m == null || m({ numPages: C, pane: t }));
      },
      [I, m, f, t]
    ), Zt = B(
      (C) => {
        if (P.current !== I) return;
        const J = (C == null ? void 0 : C.message) || "PDF 解析失败";
        F(J), _(0), f == null || f(0, t), u == null || u(C, t);
      },
      [I, u, f, t]
    ), Oe = K(
      () => N > 0 ? Array.from({ length: N }, (C, J) => J + 1) : [],
      [N]
    );
    z(() => {
      typeof IntersectionObserver < "u" || Re(new Set(Oe));
    }, [Oe]);
    const Fe = K(
      () => Zn(b, w, t),
      [b, w, t]
    ), Ve = K(() => {
      const C = /* @__PURE__ */ new Map();
      for (const J of h) {
        const W = Zn(J, w, t);
        if (!W) continue;
        const G = C.get(W.box.page) || [];
        G.push(W), C.set(W.box.page, G);
      }
      return C;
    }, [t, w, h]), Nt = K(() => {
      const C = /* @__PURE__ */ new Set();
      if (!y) return C;
      for (const [J, W] of Ve)
        W.some((G) => G.itemId === y) && C.add(J);
      return C;
    }, [y, Ve]), Mt = K(() => {
      if (N === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Oe);
      if (ve.size === 0) {
        const W = Math.min(N, rn * 2 + 1);
        return new Set(Array.from({ length: W }, (G, re) => re + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const W of ve)
        for (let G = -rn; G <= rn; G++) {
          const re = W + G;
          re >= 1 && re <= N && J.add(re);
        }
      return J;
    }, [N, Oe, i, a, ve]), tt = !n || !!$ || !!j, At = n && ($ || j) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: ee,
        className: `reader-panel ${Is}${a ? "" : " is-hidden"}`,
        [ct]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (R == null ? void 0 : R.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          E ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: E }) : null,
          S ? /* @__PURE__ */ L("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: S })
          ] }) : null,
          tt && !D ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: At }) : null,
          D ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !$ ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Ia,
            {
              file: T,
              loading: null,
              error: null,
              options: ce,
              onLoadSuccess: et,
              onLoadError: Zt,
              className: "reader-react-pdf-document",
              children: Oe.map((C) => {
                if (Mt.has(C))
                  return /* @__PURE__ */ p(
                    Gc,
                    {
                      pane: t,
                      pageNumber: C,
                      width: H,
                      devicePixelRatio: se,
                      active: We.has(C),
                      textLayer: !ke || X.has(C),
                      syncedMinHeight: (l == null ? void 0 : l.get(C)) || 0,
                      onMetrics: d,
                      cachedAspect: Q.get(C),
                      onAspectChange: de,
                      sentinelRef: _e(C),
                      regionHighlight: (Fe == null ? void 0 : Fe.box.page) === C ? Fe : null,
                      regionTargets: Ve.get(C),
                      hoveredRegionId: y && Nt.has(C) ? y : null,
                      onHoverRegion: v,
                      liveTranslationLayout: R == null ? void 0 : R.layoutByPage.get(C - 1),
                      liveTranslationPage: R == null ? void 0 : R.pagesByPage.get(C - 1),
                      showLiveTranslation: g
                    },
                    `${t}-${C}`
                  );
                const W = Q.get(C) ?? Io, G = Math.max(120, Math.floor(H * W)), re = Math.max(G, Math.ceil((l == null ? void 0 : l.get(C)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: _e(C),
                    [Ue]: C,
                    [ct]: t,
                    [kn]: G,
                    className: `${Nn} is-placeholder`,
                    style: {
                      width: H,
                      height: re,
                      minHeight: re
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: Bt,
                        style: { width: H, height: G },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${C}`
                );
              })
            },
            I
          ) }) : null
        ]
      }
    );
  }
), gr = Jt(ol), al = 2e3, sl = 6, il = 500, br = "reader-react-resizing";
function cl(e, t) {
  const n = A(null), r = A(null);
  Pe(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const g = ll(e), S = zt(e, g);
      if (!S) return;
      s = { pane: g, progress: S, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let d = 0, m = null, u = e.scrollHeight, f = u, b = 0, h = l;
    const w = /* @__PURE__ */ new WeakMap(), y = typeof ResizeObserver > "u" ? null : new ResizeObserver((g) => {
      let S = !1;
      for (const E of g) {
        const k = Math.round(E.contentRect.height);
        w.has(E.target) && w.get(E.target) !== k && (S = !0), w.set(E.target, k);
      }
      S && Rt(e, c, "auto", i);
    }), v = () => {
      var g;
      m && clearTimeout(m), cancelAnimationFrame(d), y == null || y.disconnect(), e.classList.remove(br);
      for (const S of yr) e.removeEventListener(S, v);
      ((g = r.current) == null ? void 0 : g.stop) === v && (r.current = null);
    }, R = () => {
      Rt(e, c, "auto", i);
      const g = e.scrollHeight;
      b = g === f ? b + 1 : 0, f = g;
      const S = performance.now() - h;
      b >= sl && (g !== u || S > il) || S > al ? v() : d = requestAnimationFrame(R);
    };
    for (const g of yr) e.addEventListener(g, v, { passive: !0 });
    for (const g of Array.from(e.children)) y == null || y.observe(g);
    e.classList.add(br), r.current = { ...s, stop: v }, m = setTimeout(() => {
      m = null, h = performance.now(), u = e.scrollHeight, f = u, b = 0, d = requestAnimationFrame(R);
    }, eo);
  }, [e, t]), z(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function ll(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ue}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ct) || null;
  }
  return null;
}
const yr = ["wheel", "touchstart", "keydown", "pointerdown"], dl = () => () => {
}, vr = () => null;
function ul({
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
function fl(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function ml(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function hl(e) {
  const t = ze(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, m = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, f = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? kt, b = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), w = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, y = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, v = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, R = (t == null ? void 0 : t.compareVersion) ?? null, g = (R == null ? void 0 : R.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", S = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = R ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, O = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), D = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), $ = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), I = e.regions ?? (t == null ? void 0 : t.regions) ?? [], P = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [N, _] = M(null), j = $r(
    T ? T.subscribe : dl,
    T ? () => T.get().itemId : vr,
    T ? () => T.get().itemId : vr
  ), F = T ? j : N, q = B((he) => {
    T ? T.set(he, "pdf") : _(he);
  }, [T]), ee = ul({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: d
  }), Y = Number.isFinite(b) && b > 0 ? fl(
    b,
    n || r,
    typeof document > "u" ? b * 2 : document.documentElement.clientWidth
  ) : null;
  return cl(u, Y), /* @__PURE__ */ p(
    "div",
    {
      ref: m,
      className: Rs,
      "data-reader-region-count": I.length,
      "data-reader-structured-region-count": I.filter(oa).length,
      "data-reader-metadata-ready": P ? "true" : "false",
      children: /* @__PURE__ */ L(
        "main",
        {
          className: `${Ss} reader-mode-${ee.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            w ? /* @__PURE__ */ p(
              gr,
              {
                pane: "source",
                url: g,
                preloadedFile: E,
                userZoom: f,
                visible: ee.showSource,
                scrollRoot: u,
                pageWidthOverride: Y,
                rowHeights: ee.compareMode ? h : void 0,
                onMetrics: O,
                emptyLabel: v ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: D,
                activeRegion: $,
                regions: (R == null ? void 0 : R.regions) ?? I,
                readerMetadata: P,
                hoveredRegionId: F,
                onHoverRegion: q,
                liveTranslation: d ? o : void 0,
                showLiveTranslation: d,
                liveTranslationPendingLabel: d ? ml(o) : "",
                paneAction: d ? /* @__PURE__ */ L(dt, { children: [
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
              R ? `compare:${R.url}` : "source"
            ) : null,
            y ? /* @__PURE__ */ p(
              gr,
              {
                pane: "translated",
                url: S,
                preloadedFile: k,
                userZoom: f,
                visible: ee.showTranslated,
                scrollRoot: u,
                pageWidthOverride: Y,
                rowHeights: ee.compareMode ? h : void 0,
                onMetrics: O,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: D,
                activeRegion: $,
                regions: I,
                readerMetadata: P,
                hoveredRegionId: F,
                onHoverRegion: q,
                liveTranslation: void 0,
                showLiveTranslation: !1
              }
            ) : null
          ]
        }
      )
    }
  );
}
const pl = [
  { id: "source", label: "原文", Icon: Hr },
  { id: "compare", label: "对照", Icon: Wr },
  { id: "translated", label: "译文", Icon: Vr }
];
function gl(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function bl(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function yl(e) {
  const t = ze(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, i = a ? gl(a.state) : "";
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
          /* @__PURE__ */ p(ua, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: i })
        ]
      }
    ) : null,
    /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: pl.map(({ id: c, label: l, Icon: d }) => {
      const m = n === c, u = bl({
        id: c,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${m ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": m,
          "aria-label": l,
          title: u ? `${l} 需要文档任务` : l,
          disabled: u,
          onClick: () => o(c),
          children: [
            /* @__PURE__ */ p(d, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        c
      );
    }) })
  ] });
}
const vl = {
  markdown: { label: "Markdown", short: "MD", Icon: fa, needsJob: !0 }
}, wl = to.map(
  (e) => ({ id: e, ...vl[e] })
);
function Eo() {
  return wl.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Sl(e) {
  const t = ze(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(dt, { children: Eo().map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const d = n === s, m = l && r, u = d ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": u,
        "aria-pressed": d,
        title: m ? `${i} 需打开任务阅读` : i,
        disabled: m,
        onClick: () => d ? a() : o(s),
        children: [
          /* @__PURE__ */ p(c, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function Rl(e) {
  const t = ze(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Eo().map(({ id: c, label: l, short: d, Icon: m, needsJob: u }) => ({
    key: c,
    label: l,
    short: d,
    Icon: m,
    disabled: u && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ L("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: d, disabled: m, selected: u, badge: f, onClick: b }) => /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": u,
        className: `reader-assistant-dock-tab${u ? " is-active" : ""}`,
        title: m ? `${l} 需打开任务阅读` : l,
        disabled: m,
        onClick: b,
        children: [
          /* @__PURE__ */ p(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-assistant-dock-tab-label", children: l }),
          f ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: f }) : null
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
        children: /* @__PURE__ */ p(Kt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Il(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function El(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Pl(e) {
  return e / 100 * window.innerHeight;
}
function Tl(e) {
  return e / 100 * window.innerWidth;
}
function kl(e) {
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
  const [o, a] = kl(n);
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
      r = El(t, o);
      break;
    }
    case "em": {
      r = Il(t, o);
      break;
    }
    case "vh": {
      r = Pl(o);
      break;
    }
    case "vw": {
      r = Tl(o);
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
function te(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function vn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Nl : Ml
  );
}
function Nl(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Ml(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Po(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function To(e, t) {
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
function Al({
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
    const { x: i, y: c } = To(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return te(o, "No rect found"), o;
}
let Ct;
function _l() {
  return Ct === void 0 && (typeof matchMedia == "function" ? Ct = !!matchMedia("(pointer:coarse)").matches : Ct = !1), Ct;
}
function ko(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = vn(
    n,
    Array.from(t.children).filter(Po).map((b) => ({ element: b }))
  ).map(({ element: b }) => b), s = [];
  let i = !1, c = !1, l = -1, d = -1, m = 0, u, f = [];
  {
    let b = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (b++, h.hasAttribute("data-disabled") || (m++, l === -1 && (l = b), d = b));
  }
  if (m > 1) {
    let b = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        b++;
        const w = r.find(
          (y) => y.element === h
        );
        if (w) {
          if (u) {
            const y = u.element.getBoundingClientRect(), v = h.getBoundingClientRect();
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
              switch (f.length) {
                case 0: {
                  R = [
                    g,
                    S
                  ];
                  break;
                }
                case 1: {
                  const E = f[0], k = Al({
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
                  R = f;
                  break;
                }
              }
            } else
              f.length ? R = f : R = [
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
              const E = _l() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
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
          c = !1, u = w, f = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const w = o.find(
          (y) => y.element === h
        );
        w ? f.push(w) : (u = void 0, f = []);
      } else
        c = !0;
  }
  return s;
}
var $e;
class No {
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
let st = {
  cursorFlags: 0,
  state: "inactive"
};
const _n = new No();
function Ge() {
  return st;
}
function Ll(e) {
  return _n.addListener("change", e);
}
function Dl(e) {
  const t = st, n = { ...st };
  n.cursorFlags = e, st = n, _n.emit("change", {
    prev: t,
    next: n
  });
}
function it(e) {
  const t = st;
  st = e, _n.emit("change", {
    prev: t,
    next: e
  });
}
const Cl = (e) => e, on = () => {
}, Mo = 1, Ao = 2, _o = 4, Lo = 8, wr = 3, Sr = 12;
let xt;
function Rr() {
  return xt === void 0 && (xt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (xt = !0)), xt;
}
function xl({
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
        if (e && Rr()) {
          const a = (e & Mo) !== 0, s = (e & Ao) !== 0, i = (e & _o) !== 0, c = (e & Lo) !== 0;
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
    return Rr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Ir = /* @__PURE__ */ new WeakMap();
function Ln(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Ir.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Ge();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = xl({
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
  Ir.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Me = /* @__PURE__ */ new Map();
const Do = new No();
function zl(e) {
  Me = new Map(Me), Me.delete(e);
}
function Er(e, t) {
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
function Xe() {
  return Me;
}
function Dn(e, t) {
  return Do.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function xe(e, t, n) {
  const r = Me.get(e);
  Me = new Map(Me), Me.set(e, t), Do.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Co(e) {
  const t = Ge();
  let n = !1;
  switch (t.state) {
    case "active":
      it({
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
function Pr(e) {
  e.defaultPrevented || Co(e.currentTarget);
}
function Ol(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = To(n, a.rect);
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
function Fl(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function $l(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Nr(e),
    b: Nr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  te(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: kr(Tr(n.a)),
    b: kr(Tr(n.b))
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
const Bl = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function jl(e) {
  const t = getComputedStyle(xo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Ul(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || jl(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Bl.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Tr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (te(n, "Missing node"), Ul(n)) return n;
  }
  return null;
}
function kr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Nr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = xo(e);
  return t;
}
function xo(e) {
  const { parentNode: t } = e;
  return Fl(t) ? t.host : t;
}
function Hl(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Wl({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Po(n) || n.contains(e) || e.contains(n))
    return !0;
  if ($l(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Hl(r.getBoundingClientRect(), t))
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
    const a = ko(o), s = Ol(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Wl({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Vl(e, t) {
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
function at({
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
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [d, m] = r;
  te(d != null, "Invalid first pivot index"), te(m != null, "Invalid second pivot index");
  let u = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? m : d, w = n[h];
        te(
          w,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: v,
          minSize: R = 0
        } = w;
        if (v) {
          const g = i[h];
          if (te(
            g != null,
            `Previous layout not found for panel index ${h}`
          ), ye(g, y)) {
            const S = R - g;
            Ne(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const h = e < 0 ? d : m, w = n[h];
        te(
          w,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: v,
          minSize: R = 0
        } = w;
        if (v) {
          const g = i[h];
          if (te(
            g != null,
            `Previous layout not found for panel index ${h}`
          ), ye(g, R)) {
            const S = g - y;
            Ne(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? m : d, w = n[h];
      te(
        w,
        `Panel constraints not found for index ${h}`
      );
      const y = i[h], { collapsible: v, collapsedSize: R, minSize: g } = w;
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
    const h = e < 0 ? 1 : -1;
    let w = e < 0 ? m : d, y = 0;
    for (; ; ) {
      const R = i[w];
      te(
        R != null,
        `Previous layout not found for panel index ${w}`
      );
      const g = at({
        overrideDisabledPanels: s,
        panelConstraints: n[w],
        prevSize: R,
        size: 100
      }) - R;
      if (y += g, w += h, w < 0 || w >= n.length)
        break;
    }
    const v = Math.min(Math.abs(e), Math.abs(y));
    e = e < 0 ? 0 - v : v;
  }
  {
    let h = e < 0 ? d : m;
    for (; h >= 0 && h < n.length; ) {
      const w = Math.abs(e) - Math.abs(u), y = i[h];
      te(
        y != null,
        `Previous layout not found for panel index ${h}`
      );
      const v = y - w, R = at({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: y,
        size: v
      });
      if (!ye(y, R) && (u += y - R, l[h] = R, u.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Vl(c, l))
    return o;
  {
    const h = e < 0 ? m : d, w = i[h];
    te(
      w != null,
      `Previous layout not found for panel index ${h}`
    );
    const y = w + u, v = at({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: w,
      size: y
    });
    if (l[h] = v, !ye(v, y)) {
      let R = y - v, g = e < 0 ? m : d;
      for (; g >= 0 && g < n.length; ) {
        const S = l[g];
        te(
          S != null,
          `Previous layout not found for panel index ${g}`
        );
        const E = S + R, k = at({
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
  const f = Object.values(l).reduce(
    (h, w) => w + h,
    0
  );
  if (!ye(f, 100, 0.1))
    return o;
  const b = Object.keys(o);
  return l.reduce((h, w, y) => (h[b[y]] = w, h), {});
}
function Ze(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ne(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Ye({
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
      te(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    te(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    te(l != null, `No layout data found for index ${i}`);
    const d = at({
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
      te(c != null, `No layout data found for index ${i}`);
      const l = c + a, d = at({
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
function zo({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = Xe();
    for (const [
      l,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: m,
        layout: u,
        groupSize: f,
        separatorToPanels: b
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: m,
          group: l,
          groupSize: f,
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
    derivedPanelConstraints: m
  }) => {
    const u = a(), f = l.findIndex((w) => w.id === t), b = f === 0, h = f === l.length - 1;
    if (h && c < u && (b || l.slice(0, f).every((w, y) => {
      const v = m[y];
      return (v == null ? void 0 : v.collapsible) && ye(v.collapsedSize, d[v.panelId]);
    }))) {
      const w = l.slice(0, f).reduce((y, v) => y + d[v.id], 0);
      return {
        ...d,
        [t]: we(100 - w)
      };
    }
    return It({
      delta: h ? u - c : c - u,
      initialLayout: d,
      panelConstraints: m,
      pivotIndices: h ? [f - 1, f] : [f, f + 1],
      prevLayout: d,
      trigger: "imperative-api"
    });
  }, i = (c) => {
    const l = a();
    if (c === l)
      return;
    const {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: m,
      group: u,
      groupSize: f,
      layout: b,
      separatorToPanels: h
    } = n(), w = s({
      nextSize: c,
      panels: u.panels,
      prevLayout: b,
      derivedPanelConstraints: m
    }), y = Ye({
      layout: w,
      panelConstraints: m
    });
    Ze(b, y) || xe(u, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: m,
      groupSize: f,
      layout: y,
      separatorToPanels: h
    });
  };
  return {
    collapse: () => {
      const { collapsible: c, collapsedSize: l } = r(), { mutableValues: d } = o(), m = a();
      c && m !== l && (d.expandToSize = m, i(l));
    },
    expand: () => {
      const { collapsible: c, collapsedSize: l, minSize: d } = r(), { mutableValues: m } = o(), u = a();
      if (c && u === l) {
        let f = m.expandToSize ?? d;
        f === 0 && (f = 1), i(f);
      }
    },
    getSize: () => {
      const { group: c } = n(), l = a(), { element: d } = o(), m = c.orientation === "horizontal" ? d.offsetWidth : d.offsetHeight;
      return {
        asPercentage: l,
        inPixels: m
      };
    },
    isCollapsed: () => {
      const { collapsible: c, collapsedSize: l } = r(), d = a();
      return c && ye(l, d);
    },
    resize: (c) => {
      const { group: l } = n(), { element: d } = o(), m = lt({ group: l }), u = gt({
        groupSize: m,
        panelElement: d,
        styleProp: c
      }), f = we(u / m * 100);
      i(f);
    }
  };
}
function Mr(e) {
  if (e.defaultPrevented)
    return;
  const t = Xe();
  Cn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = zo({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Ot(e) {
  const t = Xe();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Oo({
  groupId: e
}) {
  const t = () => {
    const n = Xe();
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
      } = t(), l = Ye({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (Ze(i, l) || xe(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function Je(e, t) {
  const n = Ot(e), r = je(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  te(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  te(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = Oo({ groupId: n.id }).getLayout(), c = It({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = Ye({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  Ze(i, l) || xe(
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
function Ar(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Ot(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && Je(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Je(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Je(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Je(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Je(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Ot(t), o = je(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (u) => u.element === t
        );
        te(c, "Matching separator not found");
        const l = i.get(c);
        te(l, "Matching panels not found");
        const d = l[0], m = a.find(
          (u) => u.panelId === d.id
        );
        if (te(m, "Panel metadata not found"), m.collapsible) {
          const u = s[d.id], f = m.collapsedSize === u ? r.mutableState.expandedPanelSizes[d.id] ?? m.minSize : m.collapsedSize;
          Je(t, f - u);
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
        te(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), Je(t, -100);
        break;
      }
    }
}
function _r(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = Xe(), n = Cn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), it({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Fo({
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
    const { group: d, groupSize: m } = l, { orientation: u, panels: f } = d, { disableCursor: b } = d.mutableState;
    let h = 0;
    a ? u === "horizontal" ? h = (t.clientX - a.x) / m * 100 : h = (t.clientY - a.y) / m * 100 : u === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
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
        delta: h,
        initialLayout: w,
        panelConstraints: R,
        pivotIndices: l.panels.map((O) => f.indexOf(O)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (Ze(k, S)) {
        if (h !== 0 && !b)
          switch (u) {
            case "horizontal": {
              i |= h < 0 ? Mo : Ao;
              break;
            }
            case "vertical": {
              i |= h < 0 ? _o : Lo;
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
  t.movementX === 0 ? c |= s & wr : c |= i & wr, t.movementY === 0 ? c |= s & Sr : c |= i & Sr, Dl(c), Ln(e);
}
function Lr(e) {
  const t = Xe(), n = Ge();
  switch (n.state) {
    case "active":
      Fo({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Dr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = Ge(), n = Xe();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        it({
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
      Fo({
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
      a.length === 0 ? t.state !== "inactive" && it({
        cursorFlags: 0,
        state: "inactive"
      }) : it({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Ln(e.currentTarget);
      break;
    }
  }
}
function Cr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Ge().state) {
      case "hover":
        it({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function xr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Co(e.currentTarget) && e.preventDefault();
}
function zr(e) {
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
function Jl(e, t, n) {
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
function Kl(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function ql({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const i = /* @__PURE__ */ new Map(), c = [];
  for (const m of e.panels) {
    const u = r[m.id] ?? 0;
    switch (m.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const f = u / 100 * n, b = we(
          f / t * 100
        );
        i.set(m.id, b), o += b;
        break;
      }
      case "preserve-relative-size":
      default: {
        c.push(m.id), a += u;
        break;
      }
    }
  }
  if (!s || c.length === 0)
    return r;
  const l = 100 - o, d = { ...r };
  if (i.forEach((m, u) => {
    d[u] = m;
  }), a > 0)
    for (const m of c) {
      const u = r[m] ?? 0;
      d[m] = we(
        u / a * l
      );
    }
  else {
    const m = we(
      l / c.length
    );
    for (const u of c)
      d[u] = m;
  }
  return d;
}
function Gl(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const nt = /* @__PURE__ */ new Map();
function Zl(e) {
  let t = !0;
  te(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((b) => {
    for (const h of b) {
      const { borderBoxSize: w, target: y } = h;
      if (y === e.element) {
        if (t) {
          const v = lt({ group: e });
          if (v === 0)
            return;
          const R = je(e.id);
          if (!R)
            return;
          const g = yn(e), S = R.defaultLayoutDeferred ? zr(g) : R.layout, E = ql({
            group: e,
            nextGroupSize: v,
            prevGroupSize: R.groupSize,
            prevLayout: S
          }), k = Ye({
            layout: E,
            panelConstraints: g
          });
          if (!R.defaultLayoutDeferred && Ze(R.layout, k) && Kl(
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
        Jl(e, y, w);
    }
  });
  a.observe(e.element), e.panels.forEach((b) => {
    te(
      !r.has(b.id),
      `Panel ids must be unique; id "${b.id}" was used more than once`
    ), r.add(b.id), b.onResize && a.observe(b.element);
  });
  const s = lt({ group: e }), i = yn(e), c = e.panels.map(({ id: b }) => b).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Gl(e.panels, l) || (l = void 0));
  const d = e.mutableState.layouts[c] ?? l ?? zr(i), m = Ye({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  nt.set(
    u,
    (nt.get(u) ?? 0) + 1
  );
  const f = /* @__PURE__ */ new Map();
  return ko(e).forEach((b) => {
    b.separator && f.set(b.separator, b.panels);
  }), xe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: m,
    separatorToPanels: f
  }), e.separators.forEach((b) => {
    te(
      !o.has(b.id),
      `Separator ids must be unique; id "${b.id}" was used more than once`
    ), o.add(b.id), b.element.addEventListener("keydown", Ar);
  }), nt.get(u) === 1 && (u.addEventListener("contextmenu", Pr, !0), u.addEventListener("dblclick", Mr, !0), u.addEventListener("pointerdown", _r, !0), u.addEventListener("pointerleave", Lr), u.addEventListener("pointermove", Dr), u.addEventListener("pointerout", Cr), u.addEventListener("pointerup", xr, !0)), function() {
    t = !1, nt.set(
      u,
      Math.max(0, (nt.get(u) ?? 0) - 1)
    ), zl(e), e.separators.forEach((b) => {
      b.element.removeEventListener("keydown", Ar);
    }), nt.get(u) || (u.removeEventListener(
      "contextmenu",
      Pr,
      !0
    ), u.removeEventListener(
      "dblclick",
      Mr,
      !0
    ), u.removeEventListener(
      "pointerdown",
      _r,
      !0
    ), u.removeEventListener("pointerleave", Lr), u.removeEventListener("pointermove", Dr), u.removeEventListener("pointerout", Cr), u.removeEventListener("pointerup", xr, !0)), a.disconnect();
  };
}
function Yl() {
  const [e, t] = M({}), n = B(() => t({}), []);
  return [e, n];
}
function xn(e) {
  const t = Br();
  return `${e ?? t}`;
}
const Qe = typeof window < "u" ? Pe : z;
function yt(e) {
  const t = A(e);
  return Qe(() => {
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
  return Qe(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const $o = In(null);
function Xl(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: Cl
  });
  Pn(t, () => n.current, []), Qe(() => {
    Object.assign(
      n.current,
      Oo({ groupId: e })
    );
  });
}
function Bo({
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
  resizeTargetMinimumSize: m = {
    coarse: 20,
    fine: 10
  },
  style: u,
  ...f
}) {
  const b = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = yt((I) => {
    Ze(b.current.onLayoutChange, I) || (b.current.onLayoutChange = I, c == null || c(I));
  }), w = yt(
    (I, P) => {
      Ze(b.current.onLayoutChanged, I) || (b.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: P }));
    }
  ), y = xn(i), v = A(null), [R, g] = Yl(), S = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: m,
    separators: []
  }), E = zn(v, a);
  Xl(y, s);
  const k = yt(
    (I, P) => {
      const T = Ge(), N = Er(I), _ = je(I);
      if (_) {
        let j = !1;
        switch (T.state) {
          case "active": {
            j = T.hitRegions.some(
              (F) => F.group === N
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
  }), D = K(
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
        const N = Er(y), _ = je(y);
        N && _ && xe(N, {
          ..._,
          derivedPanelConstraints: yn(N)
        });
      },
      updateSeparatorProps: (I, {
        disabled: P,
        disableDoubleClick: T
      }) => {
        const N = S.current.separators.find(
          (_) => _.id === I
        );
        N && (N.disabled = P, N.disableDoubleClick = T);
      }
    }),
    [k, y, g, d, O]
  ), $ = A(null);
  return Qe(() => {
    const I = v.current;
    if (I === null)
      return;
    const P = S.current;
    let T;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === P.panels.length) {
      T = {};
      for (const Z of P.panels) {
        const Y = O.defaultLayout[Z.id];
        Y !== void 0 && (T[Z.id] = Y);
      }
    }
    const N = {
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
    $.current = N;
    const _ = Zl(N), { defaultLayoutDeferred: j, derivedPanelConstraints: F, layout: q } = je(N.id, !0);
    !j && F.length > 0 && (h(q), w(q, !1));
    const ee = Dn(y, (Z) => {
      const { defaultLayoutDeferred: Y, derivedPanelConstraints: he, layout: ae } = Z.next;
      if (Y || he.length === 0)
        return;
      const se = N.panels.map(({ id: H }) => H).join(",");
      N.mutableState.layouts[se] = ae, he.forEach((H) => {
        if (H.collapsible) {
          const { layout: Q } = Z.prev ?? {};
          if (Q) {
            const ge = ye(
              H.collapsedSize,
              ae[H.panelId]
            ), ve = ye(
              H.collapsedSize,
              Q[H.panelId]
            );
            ge && !ve && (N.mutableState.expandedPanelSizes[H.panelId] = Q[H.panelId]);
          }
        }
      });
      const ce = Ge().state !== "active";
      h(ae), ce && w(ae, Z.isUserInteraction);
    });
    return () => {
      $.current = null, _(), ee();
    };
  }, [
    o,
    y,
    w,
    h,
    d,
    R,
    O
  ]), z(() => {
    const I = $.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p($o.Provider, { value: D, children: /* @__PURE__ */ p(
    "div",
    {
      ...f,
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
Bo.displayName = "Group";
function Fn() {
  const e = En($o);
  return te(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Ql(e, t) {
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
  Pn(t, () => r.current, []), Qe(() => {
    Object.assign(
      r.current,
      zo({ groupId: n, panelId: e })
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
  onResize: m,
  panelRef: u,
  style: f,
  ...b
}) {
  const h = !!c, w = xn(c), y = On({
    disabled: a
  }), v = A(null), R = zn(v, s), {
    getPanelStyles: g,
    id: S,
    orientation: E,
    registerPanel: k,
    updatePanelProps: O
  } = Fn(), D = m !== null, $ = yt(
    (N, _, j) => {
      m == null || m(N, c, j);
    }
  );
  Qe(() => {
    const N = v.current;
    if (N !== null) {
      const _ = {
        element: N,
        id: w,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? $ : void 0,
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
    D,
    w,
    h,
    l,
    d,
    $,
    k,
    y
  ]), z(() => {
    O(w, { disabled: a });
  }, [a, w, O]), Ql(w, u);
  const I = () => {
    const N = g(S, w);
    if (N)
      return JSON.stringify(N);
  }, P = $r(
    (N) => Dn(S, N),
    I,
    I
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
      "data-testid": w,
      id: w,
      ref: R,
      style: {
        ...ed,
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
            ...f,
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
const ed = {
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
function td({
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
    a = Ye({
      layout: It({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Ye({
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
function jo({
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
  }), [d, m] = M({}), [u, f] = M("inactive"), [b, h] = M(!1), w = A(null), y = zn(w, o), {
    disableCursor: v,
    id: R,
    orientation: g,
    registerSeparator: S,
    updateSeparatorProps: E
  } = Fn(), k = g === "horizontal" ? "vertical" : "horizontal";
  Qe(() => {
    const $ = w.current;
    if ($ !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: $,
        id: c
      }, P = S(I), T = Ll(
        (_) => {
          f(
            _.next.state !== "inactive" && _.next.hitRegions.some(
              (j) => j.separator === I
            ) ? _.next.state : "inactive"
          );
        }
      ), N = Dn(
        R,
        (_) => {
          const { derivedPanelConstraints: j, layout: F, separatorToPanels: q } = _.next, ee = q.get(I);
          if (ee) {
            const Z = ee[0], Y = ee.indexOf(Z);
            m(
              td({
                layout: F,
                panelConstraints: j,
                panelId: Z.id,
                panelIndex: Y
              })
            );
          }
        }
      );
      return () => {
        T(), N(), P();
      };
    }
  }, [R, c, S, l]), z(() => {
    E(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, E]);
  let O;
  n && !v && (O = "not-allowed");
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
      "data-testid": c,
      id: c,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
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
jo.displayName = "Separator";
const $n = 30, Bn = 65, Et = 50, nd = 100 - Bn, rd = 100 - $n;
function od(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Bn, Math.max($n, t)) : Et;
}
function jn(e) {
  return 100 - e;
}
function rt(e) {
  return `${e}%`;
}
const Un = "reader-document", Pt = "reader-assistant", Uo = "retainpdf.reader.ai-split-layout.v1", ad = {
  [Un]: jn(Et),
  [Pt]: Et
};
function Hn(e) {
  const t = od(e == null ? void 0 : e[Pt]);
  return {
    [Un]: jn(t),
    [Pt]: t
  };
}
function sd() {
  try {
    const e = JSON.parse(localStorage.getItem(Uo) || "null");
    return Hn(e);
  } catch {
    return ad;
  }
}
function id(e) {
  try {
    localStorage.setItem(Uo, JSON.stringify(Hn(e)));
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
function cd() {
  const e = A(null), [t] = M(sd);
  Pe(() => {
    const o = e.current;
    return an(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = B((o) => {
    an(e.current, o);
  }, []), r = B((o, a) => {
    an(e.current, o), a.isUserInteraction && id(o);
  }, []);
  return /* @__PURE__ */ L(
    Bo,
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
          wn,
          {
            id: Un,
            defaultSize: rt(jn(Et)),
            minSize: rt(nd),
            maxSize: rt(rd)
          }
        ),
        /* @__PURE__ */ p(
          jo,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          wn,
          {
            id: Pt,
            defaultSize: rt(Et),
            minSize: rt($n),
            maxSize: rt(Bn)
          }
        )
      ]
    }
  );
}
function ld({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = M(!1);
  if (z(() => {
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
    n ? /* @__PURE__ */ p(fe, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function dd({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(ld, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(dt, { children: [
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
      s ? /* @__PURE__ */ p(fe, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function ud(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function fd() {
  const [e, t] = M(!1), n = Br(), r = A(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || ud(a.target)) return;
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
        children: /* @__PURE__ */ p(ma, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: Ni.map((o) => /* @__PURE__ */ L("section", { className: "reader-react-shortcuts-group", children: [
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
const md = ["source", "sideBySide", "translated"], hd = { source: "", translated: "", sideBySide: "" };
function pd(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Ft(e.sourceUrl), n = Ft(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return za({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function gd(e) {
  const [t, n] = M(() => /* @__PURE__ */ new Set()), r = K(
    () => e ? pd(e) : hd,
    [e]
  ), o = K(
    () => md.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = B(async (s) => {
    if (!e) return;
    const i = Ft(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? xa(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Oa(
          e.fetchProtected,
          i,
          c,
          c,
          null,
          (l) => n((d) => {
            const m = new Set(d);
            return l ? m.add(s) : m.delete(s), m;
          })
        );
      } catch (c) {
        const l = c instanceof Error ? c.message : "下载失败";
        Fa(l), n((d) => {
          const m = new Set(d);
          return m.delete(s), m;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const bd = {
  source: Hr,
  sideBySide: Wr,
  translated: Vr
}, yd = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function vd(e) {
  const t = ze(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = gd(n), i = A(null);
  return z(() => {
    const c = () => {
      var m;
      (m = i.current) != null && m.open && (i.current.open = !1);
    }, l = (m) => {
      i.current && !i.current.contains(m.target) && c();
    }, d = (m) => {
      m.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", l), document.addEventListener("keydown", d), () => {
      document.removeEventListener("pointerdown", l), document.removeEventListener("keydown", d);
    };
  }, []), /* @__PURE__ */ L("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ L("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(ha, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(Ur, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = Zo[c], d = Ft(r[c]), m = a.has(c), u = !!d && !m, f = u ? "" : Yo(c, r), b = bd[c];
      return /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          id: `reader-download-${c}`,
          className: `reader-download-action${m ? " is-busy" : ""}`,
          disabled: !u,
          "aria-label": u ? `下载${l.label}` : f,
          onClick: () => {
            i.current && (i.current.open = !1), s(c);
          },
          children: [
            /* @__PURE__ */ p(b, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ L("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ L("span", { className: "reader-download-action-label", children: [
                yd[c],
                " PDF"
              ] }),
              f ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: f }) : null
            ] })
          ]
        },
        c
      );
    }) })
  ] });
}
const wd = "retainpdf:reader:bookmarks:v1:", Sd = 200;
function Wn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ho(e) {
  const t = `${e || ""}`.trim();
  return t ? `${wd}${t}` : "";
}
function Rd(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Vt(e, t = Wn()) {
  const n = Ho(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Rd(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Sn(e, t, n) {
  const r = Ho(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Sd);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Id(e, t, n = "", { storage: r = Wn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Vt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Sn(e, a.filter((i) => i.page !== s), r) : Sn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Ed(e, t, n = Wn()) {
  return Sn(e, Vt(e, n).filter((r) => r.page !== t), n);
}
function Pd(e, t) {
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
function Td({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function kd({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = M(() => Vt(e)), [i, c] = M(!1), l = A(null);
  if (z(() => {
    s(Vt(e)), c(!1);
  }, [e]), z(() => {
    if (!i) return;
    const u = (b) => {
      l.current && !l.current.contains(b.target) && c(!1);
    }, f = (b) => {
      b.key === "Escape" && c(!1);
    };
    return document.addEventListener("pointerdown", u), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", u), document.removeEventListener("keydown", f);
    };
  }, [i]), !e || n <= 0) return null;
  const d = Math.min(Math.max(t, 1), n), m = a.some((u) => u.page === d);
  return /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${m ? " is-marked" : ""}`,
        "aria-pressed": m,
        "aria-label": m ? `取消第 ${d} 页的书签` : `给第 ${d} 页加书签`,
        title: m ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Id(e, d, Pd(r, d))),
        children: /* @__PURE__ */ p(Td, { filled: m })
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
        onClick: () => c((u) => !u),
        children: [
          /* @__PURE__ */ p(pa, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
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
            o == null || o(Math.min(u.page, n)), c(!1);
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
          onClick: () => s(Ed(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function Nd(e) {
  const [t, n] = M([]);
  return z(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = He().loadIssues;
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
function Md(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Ad = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, _d = ["failed", "content", "layout"];
function Ld(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Dd({ jobId: e, currentPage: t }) {
  var m;
  const n = Nd(e), r = (m = ze()) == null ? void 0 : m.jumpToBlock, [o, a] = M(!1), [s, i] = M(-1), c = A(null);
  z(() => i(-1), [n]);
  const l = (u) => {
    const f = n[u];
    !f || !r || (i(u), r(f.readerItemId));
  }, d = A({ issues: n, last: s, currentPage: t, goTo: l });
  return d.current = { issues: n, last: s, currentPage: t, goTo: l }, z(() => {
    const u = (f) => {
      if (f.key.toLowerCase() !== "n" || f.metaKey || f.ctrlKey || f.altKey || Ld(f.target)) return;
      const { issues: b, last: h, currentPage: w, goTo: y } = d.current, v = Md(b, h, w, f.shiftKey);
      v < 0 || (f.preventDefault(), y(v));
    };
    return document.addEventListener("keydown", u), () => document.removeEventListener("keydown", u);
  }, []), z(() => {
    if (!o) return;
    const u = (f) => {
      var b;
      (b = c.current) != null && b.contains(f.target) || a(!1);
    };
    return document.addEventListener("pointerdown", u, !0), () => document.removeEventListener("pointerdown", u, !0);
  }, [o]), n.length ? /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-issues", ref: c, "aria-label": "待处理", children: [
    /* @__PURE__ */ L(
      fe,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((u) => !u),
        children: [
          /* @__PURE__ */ p(ga, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ L("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      _d.map((u) => {
        const f = n.map((b, h) => ({ issue: b, index: h })).filter(({ issue: b }) => b.kind === u);
        return f.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ L("h4", { children: [
            Ad[u],
            /* @__PURE__ */ p("span", { children: f.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: f.map(({ issue: b, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
            fe,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                l(h), a(!1);
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
const Cd = 48, xd = 96, zd = 700;
function Od(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Cd, downSoFar: r };
}
function Fd(e) {
  const [t, n] = M(!1), r = A(0);
  return z(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), c = () => {
      const u = e.current;
      return !!(u && (u.querySelector(":focus-visible") || u.querySelector("[aria-expanded='true']")));
    }, l = (u) => {
      const f = u.target;
      if (!(f instanceof Element) || (i.has(f) || i.set(f, !!f.querySelector(`[${Ue}]`)), !i.get(f))) return;
      const b = f.scrollTop, h = o.get(f);
      if (o.set(f, b), h === void 0 || Date.now() - a > zd) return;
      const w = Od(!1, r.current, b - h);
      r.current = w.downSoFar, b - h < -4 ? n(!1) : w.hidden && !c() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - xd && (r.current = 0, n(!1));
    }, m = () => {
      c() && n(!1);
    };
    document.addEventListener("scroll", l, { capture: !0, passive: !0 }), window.addEventListener("pointermove", d, { passive: !0 }), document.addEventListener("focusin", m);
    for (const u of ["wheel", "touchmove", "keydown"]) window.addEventListener(u, s, { passive: !0, capture: !0 });
    return () => {
      for (const u of ["wheel", "touchmove", "keydown"]) window.removeEventListener(u, s, { capture: !0 });
      document.removeEventListener("scroll", l, { capture: !0 }), window.removeEventListener("pointermove", d), document.removeEventListener("focusin", m);
    };
  }, [e]), t;
}
function $d(e) {
  const t = ze(), n = Ro(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? kt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = Ms(a), m = a > Xr + 1e-3, u = a < Ht - 1e-3, f = ot(r, qe()), b = f >= Ht ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = A(null), w = Fd(h), [y, v] = M(!1), [R, g] = M(`${i}`);
  z(() => {
    y || g(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, y]);
  const S = () => {
    if (v(!1), !l || c <= 0)
      return;
    const E = Number(`${R}`.trim());
    l(Wt(E, c));
  };
  return /* @__PURE__ */ L("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": w ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: y ? /* @__PURE__ */ L(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (E) => {
          E.preventDefault(), S();
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
              value: R,
              autoFocus: !0,
              onChange: (E) => g(E.target.value.replace(/[^\d]/g, "")),
              onBlur: S,
              onKeyDown: (E) => {
                E.key === "Escape" && (E.preventDefault(), v(!1), g(`${i}`));
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
          !l || c <= 0 || (g(`${i}`), v(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ p(
      kd,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(Dd, { jobId: e.issuesJobId, currentPage: i }) : null,
    /* @__PURE__ */ L("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !m,
          onClick: () => s(St(a, -1)),
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
          onClick: () => s(f),
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
          onClick: () => s(St(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(fd, {}) })
  ] });
}
function Or(e) {
  var t, n;
  return no(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Bd(e) {
  const [t, n] = M(() => ({
    scope: e,
    panel: Or(Ae(e))
  }));
  z(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Or(Ae(e))
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
function jd({
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
function Ud(e = {}) {
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
    () => /* @__PURE__ */ p(jd, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Rn, duration: 1 / 0 }
  );
}
function Hd() {
  const e = B((t) => {
    t && (t.setState = Ud, t.hide = () => ln.dismiss(Rn));
  }, []);
  return /* @__PURE__ */ L(dt, { children: [
    /* @__PURE__ */ p(ca, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Wd(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Qr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Vd(e, t) {
  return t === null || e !== t;
}
function Jd(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function Kd(e, t) {
  const n = e === t;
  return { open: n, mounted: Jd(n) };
}
const Fr = { itemId: null, origin: null };
function qd() {
  let e = Fr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Fr : { itemId: n, origin: r };
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
const Gd = [];
function Zd({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ L(fe, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ p(ba, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ L(fe, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ p(ya, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { children: "搜索" })
    ] }),
    n
  ] });
}
function Yd({
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
  const c = ((g = ze()) == null ? void 0 : g.regions) ?? Gd, l = ((S = Ro()) == null ? void 0 : S.currentPage) ?? 1, d = K(() => jc(c), [c]), m = Uc(d, l), u = K(() => Vc(c, s), [c, s]), [f, b] = M(-1);
  z(() => b(-1), [s]);
  const h = A(null), w = A(null), y = A(n);
  y.current = n, z(() => {
    const E = (O) => {
      var $, I;
      const D = O.target;
      !D || ($ = w.current) != null && $.contains(D) || (I = D.closest) != null && I.call(D, ".reader-finder-toggles") || y.current();
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
    e === "search" ? (E = h.current) == null || E.focus() : (O = (k = v.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null || O.scrollIntoView({ block: "center" });
  }, [e, i]), z(() => {
    var E, k;
    e === "search" && f >= 0 && ((k = (E = v.current) == null ? void 0 : E.querySelector('[aria-current="true"]')) == null || k.scrollIntoView({ block: "nearest" }));
  }, [e, f]);
  const R = (E) => {
    const k = u[E];
    k && (b(E), r(k.itemId));
  };
  return /* @__PURE__ */ L("aside", { ref: w, className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(fe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(fe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(fe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(Kt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: v, className: "reader-finder-list", children: d.map((E, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
      fe,
      {
        className: "reader-finder-entry",
        "data-level": E.level,
        "aria-current": k === m ? "location" : void 0,
        onClick: () => r(E.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: E.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: E.page })
        ]
      }
    ) }, E.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: c.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ L(dt, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          Kr,
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
              E.key === "Enter" ? (E.preventDefault(), R(Kc(f, u.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: u.length === 0 ? "没有找到" : `${f >= 0 ? `第 ${f + 1} / ` : ""}${u.length >= 200 ? "200+ 处，只列前 200 处" : `${u.length} 处`}${f < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: u.map((E, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(fe, { className: "reader-finder-entry is-hit", "aria-current": k === f ? "true" : void 0, onClick: () => R(k), children: [
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
function Wo(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Xd({ compare: e }) {
  const [t, n] = M(!1), r = A(null);
  return z(() => {
    if (!t) return;
    const o = (s) => {
      var i;
      (i = r.current) != null && i.contains(s.target) || n(!1);
    }, a = (s) => {
      s.key === "Escape" && n(!1);
    };
    return document.addEventListener("pointerdown", o, !0), document.addEventListener("keydown", a), () => {
      document.removeEventListener("pointerdown", o, !0), document.removeEventListener("keydown", a);
    };
  }, [t]), e.available ? /* @__PURE__ */ L("div", { className: "reader-version-compare", ref: r, children: [
    /* @__PURE__ */ L(
      fe,
      {
        className: "reader-finder-toggle",
        "aria-pressed": !!e.compared || t,
        "aria-expanded": t,
        title: "和这本书的另一份译文左右对照",
        onClick: () => n((o) => !o),
        children: [
          /* @__PURE__ */ p(va, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { children: "对比版本" })
        ]
      }
    ),
    t ? /* @__PURE__ */ L("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
      /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
      /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((o) => {
        var c;
        const a = o.versionId === e.readingVersionId, s = ((c = e.compared) == null ? void 0 : c.versionId) === o.versionId, i = e.loading === o.versionId;
        return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
          fe,
          {
            className: "reader-version-compare-item",
            "data-version-id": o.versionId,
            "aria-current": s ? "true" : void 0,
            disabled: a,
            onClick: () => {
              e.choose(o.versionId), n(!1);
            },
            children: [
              /* @__PURE__ */ p("span", { className: "reader-version-compare-name", children: o.name }),
              /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Wo(o.createdAt) }),
              a ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
              s ? /* @__PURE__ */ p(wa, { size: 14, "aria-hidden": !0 }) : null,
              i ? /* @__PURE__ */ p(Jr, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
            ]
          }
        ) }, o.versionId);
      }) }),
      e.compared ? /* @__PURE__ */ p(fe, { className: "reader-version-compare-off", onClick: () => {
        e.clear(), n(!1);
      }, children: "不对比了，左边换回原文" }) : null
    ] }) : null
  ] }) : null;
}
function Qd({ compare: e }) {
  var i, c;
  const [t, n] = M(!1);
  if (!e.compared && !e.loading && !e.error) return null;
  const r = e.versions.find((l) => l.versionId === e.readingVersionId), o = (i = e.versions.find((l) => l.versionId === e.loading)) == null ? void 0 : i.name, a = e.versions.find((l) => {
    var d;
    return l.versionId === ((d = e.compared) == null ? void 0 : d.versionId);
  }), s = (l) => l ? /* @__PURE__ */ p("small", { children: Wo(l) }) : null;
  return /* @__PURE__ */ L("div", { className: "reader-version-compare-bar", role: "status", "data-version-compare-bar": "true", children: [
    /* @__PURE__ */ L("div", { className: "reader-version-compare-side is-left", children: [
      e.error ? /* @__PURE__ */ p("span", { className: "reader-version-compare-error", children: e.error }) : e.loading ? /* @__PURE__ */ L("span", { className: "reader-version-compare-label", children: [
        /* @__PURE__ */ p(Jr, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }),
        "正在打开 ",
        o,
        "…"
      ] }) : /* @__PURE__ */ L("span", { className: "reader-version-compare-label", "data-compare-side": "left", children: [
        /* @__PURE__ */ p("em", { children: "对比" }),
        (c = e.compared) == null ? void 0 : c.name,
        s(a == null ? void 0 : a.createdAt)
      ] }),
      e.compared && !e.loading ? /* @__PURE__ */ p(
        fe,
        {
          size: "sm",
          variant: "secondary",
          className: "reader-version-compare-adopt",
          disabled: t,
          title: "以后阅读就用这一份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            n(!0), e.adopt().finally(() => n(!1));
          },
          children: "用这一份"
        }
      ) : null,
      /* @__PURE__ */ p(fe, { size: "sm", variant: "ghost", className: "reader-version-compare-close", "aria-label": "不对比了", title: "不对比了", onClick: e.clear, children: /* @__PURE__ */ p(Kt, { size: 14, "aria-hidden": !0 }) })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-version-compare-side is-right", children: /* @__PURE__ */ L("span", { className: "reader-version-compare-label", "data-compare-side": "right", children: [
      /* @__PURE__ */ p("em", { children: "正在读" }),
      (r == null ? void 0 : r.name) || "当前译文",
      s(r == null ? void 0 : r.createdAt)
    ] }) })
  ] });
}
function sn() {
  try {
    return He().translationVersions ?? null;
  } catch {
    return null;
  }
}
function eu(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function tu(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function nu(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function ru({ documentId: e, jobId: t }) {
  const [n, r] = M([]), [o, a] = M(null), [s, i] = M(null), [c, l] = M(""), [d, m] = M(""), u = A(0);
  z(() => {
    r([]), i(null), m("");
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
  const f = B((w) => {
    const y = sn(), v = n.find((g) => g.versionId === w);
    if (!y || !v || !e) return;
    const R = ++u.current;
    l(w), m(""), (async () => {
      const g = He(), S = await y.resolveJob(e, w);
      if (!S) throw new Error("这一份还没有能读的译文。");
      const E = await g.loadReaderPayload(S, { includeOptionalArtifacts: !0 }), k = g.resolveReaderTranslatedPdfUrl(E.jobPayload, E.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: w, name: v.name, jobId: S, url: k, regions: eu(jr(E.regionsPayload)) };
    })().then((g) => {
      R === u.current && i(g);
    }).catch((g) => {
      R === u.current && m((g == null ? void 0 : g.message) || "这一份打不开。");
    }).finally(() => {
      R === u.current && l("");
    });
  }, [e, n]), b = B(() => {
    u.current += 1, i(null), l(""), m("");
  }, []), h = B(async () => {
    var v, R;
    const w = sn();
    if (!w || !s || !e) return;
    try {
      await w.select(e, s.versionId);
    } catch (g) {
      m((g == null ? void 0 : g.message) || "换不过去，请稍后再试。");
      return;
    }
    const y = (v = globalThis.location) == null ? void 0 : v.href;
    y && ((R = globalThis.history) == null || R.replaceState(globalThis.history.state, "", nu(y, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: tu(n, t, o),
    compared: s,
    loading: c,
    error: d,
    choose: f,
    clear: b,
    adopt: h
  };
}
const ou = "reader-finder-input";
function au(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function su(e, t = typeof window > "u" ? null : window) {
  z(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!au(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(ou) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function iu() {
  try {
    return He().translationEdit ?? null;
  } catch {
    return null;
  }
}
const cu = "这本书正在处理（翻译或排版），处理完才能改。", lu = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function du({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = iu(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = gc(s), l = !t || vt(t), d = Rc(n), [m, u] = M(""), [f, b] = M(null), [h, w] = M(() => /* @__PURE__ */ new Map()), [y, v] = M(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [R, g] = M(() => /* @__PURE__ */ new Map()), [S, E] = M({ phase: "idle" }), k = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
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
    if (w(/* @__PURE__ */ new Map()), !a || !m || !d || !l) return;
    let _ = !1;
    return a.fetchRevisions(m).then((j) => {
      _ || w(Ic(j, d));
    }).catch(() => {
    }), () => {
      _ = !0;
    };
  }, [a, m, d, l]);
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
  const D = K(() => {
    const _ = new Map(h);
    if (y.renderedAt === d)
      for (const [j, F] of y.edits) _.set(j, F);
    return _;
  }, [h, y, d]), $ = B((_) => {
    const j = `${_ || ""}`.trim();
    j && b({ itemId: j, page: bc(j) });
  }, []), I = B(() => b(null), []), P = B((_, j) => {
    v((F) => {
      const q = new Map(F.renderedAt === d ? F.edits : []);
      return q.set(_, j), { renderedAt: d, edits: q };
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
  }, [a, s, S.phase, o]), N = c ? lu : !l || S.phase === "running" || S.phase === "submitting" ? cu : "";
  return K(() => ({
    available: i,
    blockedReason: N,
    port: a,
    ownerJobId: m,
    target: f,
    select: $,
    close: I,
    memory: k,
    pendingEdits: D,
    savedCounts: R,
    markSaved: P,
    rerender: S,
    startRerender: T
  }), [i, N, a, m, f, $, I, k, D, R, P, S, T]);
}
function uu(e, t) {
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
function fu({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ L("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
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
const mu = Ko(() => import("./ReaderMarkdownPanel-B8__J7_f.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function hu(e) {
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
function pu(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function gu() {
  var Re;
  const e = Ti(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Bd(e.viewStateKey), s = a.panel, i = a.setPanel, [c, l] = M(!1), d = A(null), m = A(null), u = s !== null, f = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, b = hu({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: f,
    liveTranslationVisible: c,
    assistantOpen: u
  }), h = bi({
    hasOverlayContent: f,
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
        const V = Ae(e.viewStateKey), oe = Wd({
          savedMode: V == null ? void 0 : V.mode,
          sourceViewOnly: w,
          viewportWidth: qe()
        });
        m.current = oe.auto ? oe.mode : null, oe.mode && oe.mode !== e.mode && e.setModeKeepingPage(oe.mode);
        return;
      }
      Vd(e.mode, m.current) && (m.current = null, Gt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, w]);
  const v = s || (e.mode === "compare" ? "compare" : "reading"), R = Kd(s, "markdown");
  Di({
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
  }, []), S = B((V) => {
    const oe = pu(V, e.liveTranslationAvailable);
    oe !== null && l(oe), e.setModeKeepingPage(V);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), E = K(() => h.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${c ? " is-active" : ""}`,
      onClick: () => l((V) => !V),
      "aria-pressed": c,
      title: c ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [h.sourcePaneToggle, c]), k = B((V) => {
    i(V);
  }, []), [O] = M(qd), [D, $] = M(null), I = B((V) => $((oe) => oe === V ? null : V), []), [P, T] = M(""), [N, _] = M("");
  z(() => {
    const V = P.replace(/\s+/gu, " ").trim(), oe = window.setTimeout(() => _(V), V ? 150 : 0);
    return () => window.clearTimeout(oe);
  }, [P]);
  const [j, F] = M(0), q = B(() => {
    $("search"), F((V) => V + 1);
  }, []);
  su(q);
  const ee = B((V) => {
    e.jumpToAnchor({ block_id: V }), (D === "outline" || qe() < 900) && $(null);
  }, [e.jumpToAnchor, D]), Z = B((V) => e.jumpToAnchor({ block_id: V }), [e.jumpToAnchor]), Y = du({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), he = Y.select, ae = e.setModeKeepingPage, se = B((V) => {
    y === "source" && ae("compare"), he(V);
  }, [he, y, ae]);
  uu(Y.available ? se : null, O);
  const ce = ru({ documentId: o.documentId, jobId: o.jobId }), H = ((Re = ce.compared) == null ? void 0 : Re.url) || "";
  z(() => {
    H && y !== "compare" && S("compare");
  }, [H]), z(() => {
    y !== "compare" && ce.clear();
  }, [y]);
  const Q = K(
    () => ce.compared ? { url: ce.compared.url, regions: ce.compared.regions } : null,
    [ce.compared]
  ), ge = K(() => {
    if (!Y.savedCounts.size) return e.revisedBlocks;
    const V = new Map(e.revisedBlocks);
    for (const [oe, x] of Y.savedCounts) V.set(oe, (V.get(oe) || 0) + x);
    return V;
  }, [e.revisedBlocks, Y.savedCounts]), ve = K(() => ({
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
    jumpToBlock: Z,
    revisedBlocks: ge,
    editBlock: Y.available ? se : void 0,
    blockEdit: Y,
    editShowsSource: y !== "compare",
    findTerm: D === "search" ? N : "",
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
    Z,
    ge,
    Y,
    se,
    y,
    D,
    N,
    Q,
    e.sourceOnly,
    w,
    e.download,
    e.goToPage,
    k,
    g
  ]), pe = K(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), We = [
    ws,
    `is-workspace-${v}`,
    u ? "is-assistant-open" : "",
    D ? "is-finder-open" : "",
    ce.compared || ce.loading || ce.error ? "is-version-compare" : "",
    b.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Cc, { value: ve, hud: pe, children: /* @__PURE__ */ L("div", { className: We, "data-reader-engine": "react-pdf", "data-reader-workspace": v, children: [
    /* @__PURE__ */ p(dd, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
    /* @__PURE__ */ p(Zd, { open: D, onToggle: I, children: /* @__PURE__ */ p(Xd, { compare: ce }) }),
    /* @__PURE__ */ p(Qd, { compare: ce }),
    D ? /* @__PURE__ */ p(
      Yd,
      {
        tab: D,
        onTab: $,
        onClose: () => $(null),
        onJump: ee,
        query: P,
        onQuery: T,
        term: N,
        focusSignal: j
      }
    ) : null,
    /* @__PURE__ */ L("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ p(Sl, { active: s }),
      /* @__PURE__ */ p(vd, {}),
      /* @__PURE__ */ p(Bi, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ p(
      yl,
      {
        mode: y,
        documentReady: !!o.jobId,
        sourceViewOnly: w,
        onModeChange: S,
        liveTranslation: h.topBarPill ? {
          visible: c,
          state: e.liveTranslation,
          onToggle: () => l((V) => !V)
        } : null
      }
    ),
    /* @__PURE__ */ p(Rl, { active: s }),
    u ? /* @__PURE__ */ p(cd, {}) : null,
    /* @__PURE__ */ p(hl, { paneComposition: b, markdownSplit: R.open, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
    e.showHud ? /* @__PURE__ */ p(
      $d,
      {
        mode: y,
        modeControls: null,
        bookmarkScope: e.viewStateKey,
        issuesJobId: e.sourceOnly ? "" : o.jobId
      }
    ) : null,
    /* @__PURE__ */ p(Jo, { fallback: null, children: R.mounted ? /* @__PURE__ */ p(mu, { open: R.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: g }) : null }),
    /* @__PURE__ */ p(fu, { edit: Y }),
    /* @__PURE__ */ p(Hd, {})
  ] }) });
}
function xu() {
  return /* @__PURE__ */ p(gu, {});
}
export {
  xu as R,
  gu as a,
  Du as d,
  Lu as f,
  Cu as r,
  ze as u
};
//# sourceMappingURL=ReaderApp-DCtAkxcQ.js.map
