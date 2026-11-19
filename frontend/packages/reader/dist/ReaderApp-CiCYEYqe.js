var Un = (e) => {
  throw TypeError(e);
};
var Hn = (e, t, n) => t.has(e) || Un("Cannot " + n);
var lt = (e, t, n) => (Hn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Wn = (e, t, n) => t.has(e) ? Un("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Vn = (e, t, n, r) => (Hn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as C, jsx as b, Fragment as st } from "react/jsx-runtime";
import { useMemo as G, useState as M, useEffect as x, useCallback as $, useRef as N, useLayoutEffect as De, memo as Ut, createContext as vn, useContext as wn, forwardRef as $o, useImperativeHandle as Sn, useSyncExternalStore as Fr, useId as $r, Suspense as jo, lazy as Bo } from "react";
import { requireAdapter as it, getReaderAdapters as Pe } from "./adapters.js";
import { resolveReaderDownloadName as Uo, resolveReaderDownloadUrls as Ho, READER_PROGRESS_COPY as Ne, trimString as Ct, READER_DOWNLOAD_ACTIONS as Wo, disabledReason as Vo } from "./runtime/state.js";
import { r as Jo, b as Ko } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as rn, isFinishedJobStatus as pt } from "@retainpdf/domain/job";
import { n as Go, d as qo, f as Gt, k as Jn, b as Zo, c as Yo, j as Ht, p as Rn, g as Xo, l as Kn, i as Qo } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as ea } from "@retainpdf/api/documents";
import { isReaderTransportError as ta, createReaderTransportError as na } from "./contracts.js";
import { toast as on, Toaster as ra } from "sonner";
import { X as Pn, Radio as oa, FileText as jr, Columns2 as Br, Languages as Ur, PencilLine as aa, FileCode2 as sa, Keyboard as ia, Download as ca, ChevronDown as Hr, ListTree as la, Search as da, ChevronUp as ua } from "lucide-react";
import { Button as ye, Input as Wr, IconButton as Gn, Textarea as fa } from "@retainpdf/ui";
import { pdfjs as Vr, Page as ma, Document as ha } from "react-pdf";
import { e as pa, m as ga, a as ba } from "./markdown-math-XkF5urpn.js";
const ya = (...e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, va = "", wa = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Sa = (e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Yd = (...e) => {
  var n;
  return (((n = Pe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Me = () => it("defaultReaderDataPort"), qn = () => it("defaultReaderPageConfigPort"), Xd = {
  get apiPrefix() {
    return Me().apiPrefix;
  },
  fetchProtected: (...e) => Me().fetchProtected(...e),
  loadMarkdownPayload: (e) => Me().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Me().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Me().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Me().loadJobPayload(e),
  loadReaderPayload: (e, t) => Me().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Me().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Me().liveTranslation;
  }
}, Jr = {
  messageTargetOrigin: () => qn().messageTargetOrigin(),
  readerJobId: () => qn().readerJobId()
}, Ra = () => {
  var e;
  return ((e = Pe()) == null ? void 0 : e.liveTranslation) ?? null;
}, gt = () => {
  var t;
  const e = Pe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Rt = () => {
  const e = Pe();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => it("fetchDocumentByJobId")(...n),
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
}, Pa = (...e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Ea = () => {
  var e, t;
  return ((t = (e = Pe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Ia = (...e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Ta = (...e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Uo(...e);
}, ka = (...e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Ho(...e);
}, Aa = (...e) => it("downloadProtectedResource")(...e), Na = (...e) => it("failDownloadToast")(...e), Qd = (e, t) => it("resolveMarkdownAssetUrl")(e, t), Zn = "/api/v1";
function Ma() {
  const e = () => {
    var r;
    return Jo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = M(e);
  return x(() => {
    var c, i, l, d;
    const r = () => n(e()), o = (i = (c = globalThis.history) == null ? void 0 : c.pushState) == null ? void 0 : i.bind(globalThis.history), a = (d = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : d.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const u = (f) => function(...h) {
          const y = f.apply(this, h);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), y;
        };
        globalThis.history.pushState = u(o), globalThis.history.replaceState = u(a), s = !0;
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
function _a() {
  const e = Ma(), t = G(() => Ia(Jr), [e]), n = G(() => Ea(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function La(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: c
  } = e, [i, l] = M({
    documentId: "",
    jobId: ""
  }), [d, u] = M({
    documentId: "",
    jobId: ""
  }), f = i.documentId === t ? i.jobId : "", h = d.documentId === t ? d.jobId : "", y = n || f, [p, w] = M({
    jobId: "",
    documentId: ""
  }), g = p.jobId === y ? p.documentId : "", S = t || g, R = !!t && !y, [m, v] = M(null), k = (m == null ? void 0 : m.sessionIdentity) === r && m.documentId === S ? m : null, L = R || !!k, O = $((D) => {
    const I = `${D.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      w({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${D.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), c();
  }, []);
  x(() => {
    v((D) => D && D.sessionIdentity !== r ? null : D);
  }, [r]);
  const z = $((D) => {
    switch (D.type) {
      case "resolved-document-job":
        l({ documentId: D.documentId, jobId: D.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        u({ documentId: D.documentId, jobId: D.jobId });
        break;
      case "resolved-job-document":
        w((I) => I.jobId === D.jobId && I.documentId === D.documentId ? I : { jobId: D.jobId, documentId: D.documentId });
        break;
      case "committed-source":
        v({
          documentId: D.documentId,
          revision: D.revision,
          sessionIdentity: D.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: i,
    setResolvedDocumentJob: l,
    missingDocumentJob: d,
    setMissingDocumentJob: u,
    documentJobId: f,
    rejectedDocumentJobId: h,
    sessionJobId: y,
    resolvedJobDocument: p,
    setResolvedJobDocument: w,
    jobDocumentId: g,
    documentId: S,
    sourceOnly: R,
    committedDocumentSource: m,
    setCommittedDocumentSource: v,
    activeCommittedDocumentSource: k,
    sourceViewOnly: L,
    refreshCommittedDocument: O,
    applyIdentityEvent: z
  };
}
function Yn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Da(e) {
  var r, o, a, s;
  if (!e || typeof e != "object") return "";
  const t = e, n = [
    t.document_id,
    t.documentId,
    (r = t.document) == null ? void 0 : r.document_id,
    (o = t.book_summary) == null ? void 0 : o.document_id,
    (s = (a = t.request_payload) == null ? void 0 : a.source) == null ? void 0 : s.document_id
  ];
  for (const c of n) {
    const i = `${c || ""}`.trim();
    if (i) return i;
  }
  return "";
}
function Xn(e, t) {
  return Sa(rn(e, t));
}
function Ca(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function xa(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ca(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function an({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: wa.progress,
        stage: n,
        percent: e,
        text: t
      },
      Jr.messageTargetOrigin()
    );
  } catch {
  }
}
function xt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), an({ percent: t, text: n, stage: r });
}
function za(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = M(null), [l, d] = M(null), [u, f] = M(""), [h, y] = M(0), p = u === n ? c : null, w = u === n ? l : null, g = Yn(p), S = pt(g), R = $(() => {
    y((z) => z + 1);
  }, []), m = $((z) => {
    i(z.jobPayload), d(z.manifestPayload), f(z.sessionIdentity);
  }, []), v = $((z) => {
    i(null), d(null), f(z);
  }, []), k = N(""), L = N(""), O = $(async () => {
    const z = o.current;
    if (!z || k.current === z) return;
    const D = Rt().loadJobPayload;
    if (typeof D != "function") return;
    const I = a.current.value;
    k.current = z;
    try {
      const T = await D(z);
      if (s.current || a.current.value !== I || o.current !== z || !T || typeof T != "object")
        return;
      const P = Yn(T);
      i(T), f(r.current), !pt(P) && L.current === z && (L.current = ""), P === "succeeded" && L.current !== z && (L.current = z, y((E) => E + 1));
    } catch {
    } finally {
      k.current === z && (k.current = "");
    }
  }, []);
  return x(() => {
    L.current = "";
  }, [n]), x(() => {
    if (!t || S || !p) return;
    const z = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval(z);
  }, [S, O, p, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: d,
    payloadSessionIdentity: u,
    setPayloadSessionIdentity: f,
    scopedJobPayload: p,
    scopedManifestPayload: w,
    jobStatus: g,
    jobTerminal: S,
    jobRefreshRevision: h,
    refreshJobArtifacts: R,
    refreshJobStatus: O,
    publishPayload: m,
    clearPayload: v
  };
}
function sn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Oa(e, t) {
  e(t), sn(t);
}
function Fa(e) {
  const [t, n] = M(e ? "source" : "compare"), r = $((a) => {
    e && a !== "source" || (n(a), sn(a));
  }, [e]), o = $((a) => {
    Oa(n, a);
  }, []);
  return x(() => (e && document.documentElement.classList.add("reader-source-only"), sn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Qn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function $a(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Qn(n.active_job_id),
    activeVersionId: Qn(n.active_version_id)
  };
}
function ja(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ba(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ua(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ha = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Wa(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ha.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Va = 48 * 1024 * 1024;
function Ja(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ka = 2, ve = /* @__PURE__ */ new Map();
function cn(e, t) {
  ve.delete(e), ve.set(e, t);
}
function er(e) {
  if (ve.size < Ka) return;
  const t = ve.keys().next().value;
  t && ve.delete(t);
}
async function Ga(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Kr(e, t = gt().fetchProtected, n = {}) {
  var d, u, f, h, y, p, w, g, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ve.has(r)) {
    const R = ve.get(r);
    return cn(r, R), R;
  }
  const o = new AbortController(), a = () => o.abort();
  (d = n.signal) != null && d.aborted && o.abort(), (f = (u = n.signal) == null ? void 0 : u.addEventListener) == null || f.call(u, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (y = (h = n.signal) == null ? void 0 : h.removeEventListener) == null || y.call(h, "abort", a);
  }
  if (!s.ok) {
    const R = new Error(`读取 PDF 失败 (${s.status})`);
    R.status = s.status;
    const m = await Ga(s);
    throw m && (R.reason = m), R;
  }
  const c = qa(r, s, t);
  if (c) {
    o.abort();
    const R = { ranged: c };
    return er(), ve.set(r, R), R;
  }
  (w = (p = n.signal) == null ? void 0 : p.addEventListener) == null || w.call(p, "abort", a, { once: !0 });
  let i;
  try {
    i = await s.arrayBuffer();
  } finally {
    (S = (g = n.signal) == null ? void 0 : g.removeEventListener) == null || S.call(g, "abort", a);
  }
  const l = { data: new Uint8Array(i) };
  return ve.has(r) ? cn(r, l) : (er(), ve.set(r, l)), l;
}
function qa(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Va ? null : {
    url: e,
    length: o,
    async fetchRange(c, i) {
      const l = await n(e, { headers: { Range: `bytes=${c}-${i - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Za = { file: null, loading: !1, error: "" }, Ya = { file: null, loading: !0, error: "" };
function Xa(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = M(null);
  if (x(() => {
    if (t || !n) return;
    const s = ve.get(n);
    if (s) {
      cn(n, s);
      return;
    }
    const c = new AbortController();
    return Kr(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Za;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = ve.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ya;
}
function Qa(e) {
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
async function ln(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  xt(s, r, n, "download");
  const c = await Kr(t, gt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (xt(s, o, n, "download"), c);
}
async function es(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  xt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, c = null;
  return t && a.push(
    ln({
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
    ln({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: o
    }).then((d) => {
      c = d;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !c ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: c };
}
function ts(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function ns({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = ea,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(ts(o.href, t, a)), !0);
}
const kt = {
  regions: null,
  metadata: null
};
function rs(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: o,
    rejectedDocumentJobId: a,
    sourceOnly: s,
    locationKey: c,
    sessionIdentity: i,
    committedSource: l,
    applyIdentityEvent: d,
    publishPayload: u,
    clearPayload: f,
    switchSessionMode: h,
    jobRefreshRevision: y,
    sessionEpochRef: p,
    closingRef: w,
    activeLoadAbortRef: g
  } = e, [S, R] = M(""), [m, v] = M(""), [k, L] = M(null), [O, z] = M(null), [D, I] = M(!1), [T, P] = M(""), [E, F] = M([]), [B, j] = M(!1), [J, Y] = M(() => ({
    source: null,
    translated: null
  })), [Q, oe] = M(
    kt
  ), [ne, se] = M({
    loading: !0,
    percent: 4,
    text: Ne.boot,
    stage: "progress",
    failed: !1
  });
  return x(() => {
    const ae = new AbortController(), he = p.current.value, q = Qa({
      sessionEpochRef: p,
      closingRef: w,
      abort: ae,
      sessionEpoch: he
    });
    g.current = ae;
    const ee = Rt();
    if (w.current)
      return ae.abort(), () => {
        g.current === ae && (g.current = null);
      };
    let we = !1;
    function A(Z, ce) {
      q.markFailed(), j(!0), se({
        loading: !1,
        percent: 100,
        text: Z,
        stage: "failed",
        failed: !0
      }), an({ percent: 100, text: ce, stage: "failed" });
    }
    function V() {
      I(!0), we || j(!0), se({
        loading: !1,
        percent: 100,
        text: Ne.ready,
        stage: "ready",
        failed: !1
      }), an({ percent: 100, text: Ne.ready, stage: "ready" });
    }
    function pe() {
      return l != null && l.documentId ? Xn(
        l.documentId,
        l.revision
      ) : ya() ? va : ee.resolveResourceUrl(rn(r));
    }
    async function Ee() {
      var fe;
      let Z = { activeJobId: "", activeVersionId: "" };
      try {
        const de = await ((fe = ee.fetchDocument) == null ? void 0 : fe.call(ee, r));
        de && (Z = $a(de));
      } catch {
      }
      const ce = ja({
        link: Z,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (ce.kind === "follow-active-job") {
        if (q.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: ce.jobId
        }), ce.activeVersionId ? (l || d({
          type: "committed-source",
          documentId: r,
          revision: ce.activeVersionId,
          sessionIdentity: i
        }), h("source")) : h("compare");
        return;
      }
      if (ce.kind === "open-committed-source") {
        if (q.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: ce.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const Se = pe();
      if (q.isInactive()) return;
      R(Se), v(""), P(""), f(i);
      const le = await ln({
        url: Se,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: q,
        setBoot: se
      });
      if (!q.isInactive()) {
        if (!le) {
          A("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        L(le), V();
      }
    }
    async function be() {
      var W;
      const Z = !l, ce = !!(Z && ee.loadSessionSnapshot && ee.loadReaderOptionalArtifacts), Se = ce ? ee.loadReaderOptionalArtifacts(t) : null, le = await ((W = ee.loadSessionSnapshot) == null ? void 0 : W.call(ee, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: Z && !ce
      })), fe = le ? {
        jobPayload: le.sourcePayload,
        manifestPayload: le.manifestPayload,
        readerMetadata: le.readerMetadata,
        regionsPayload: le.regions,
        readerErrors: le.readerErrors
      } : await ee.loadReaderPayload(t, {
        includeOptionalArtifacts: Z
      });
      if (q.isInactive()) return;
      let de = null;
      if (n && !r)
        if (le && le.linkedDocument !== void 0)
          de = le.linkedDocument;
        else {
          try {
            de = await ee.fetchDocumentByJobId(Zn, t);
          } catch {
          }
          if (q.isInactive()) return;
        }
      const qe = Da(fe.jobPayload) || `${(de == null ? void 0 : de.document_id) || ""}`.trim();
      qe && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: qe
      });
      const Ze = Ba({
        payloadDocumentId: qe,
        linkedActiveJobId: `${(de == null ? void 0 : de.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(de == null ? void 0 : de.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ze.kind === "restore-committed-source") {
        if (q.isInactive()) return;
        d({
          type: "committed-source",
          documentId: Ze.documentId,
          revision: Ze.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const ct = ee.resolveReaderSourcePdf(fe.manifestPayload), Jt = ee.resolveReaderTranslatedPdfUrl(fe.jobPayload, fe.manifestPayload), Kt = typeof ct == "string" ? ct : ee.resolveReaderArtifactUrl(ct), Ce = r || qe, xe = l != null && l.documentId ? Xn(
        l.documentId,
        l.revision
      ) : Kt || (Ce ? ee.resolveResourceUrl(rn(Ce)) : ""), je = l ? "" : Jt || "";
      R(xe || ""), v(je), P(xa(fe.jobPayload, t)), u({
        jobPayload: fe.jobPayload || null,
        manifestPayload: fe.manifestPayload || null,
        sessionIdentity: i
      });
      const Et = () => es({
        sourceFinal: xe || "",
        translatedFinal: je,
        fence: q,
        setBoot: se
      }), It = !!(xe || je), Ye = Se && It ? Et() : null;
      Ye == null || Ye.catch(() => {
      });
      const Tt = (H) => {
        q.isInactive() || (F(l ? [] : Go(H.regionsPayload)), Y(l ? { source: null, translated: null } : qo(H.readerMetadata)), oe(l ? kt : H.readerErrors ?? kt), j(!0));
      };
      if (Se ? (we = !0, Se.then(Tt)) : Tt(fe), !It) {
        A(Ne.failed, Ne.failed);
        return;
      }
      const _ = await (Ye ?? Et());
      if (_.status !== "inactive") {
        if (_.status === "incomplete") {
          A("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        L(_.sourceBytes), z(_.translatedBytes), V();
      }
    }
    async function Ie() {
      I(!1), L(null), z(null), F([]), j(!1), Y({ source: null, translated: null }), oe(kt), xt(se, 8, Ne.metadata, "metadata");
      try {
        if (s) {
          await Ee();
          return;
        }
        if (!t) {
          A(Ne.failed, Ne.failed);
          return;
        }
        await be();
      } catch (Z) {
        if (q.isClosedOrStale() || (Z == null ? void 0 : Z.name) === "AbortError") return;
        q.markFailed();
        const ce = Number(Z == null ? void 0 : Z.status), Se = `${(Z == null ? void 0 : Z.reason) || ""}`, le = Wa({ status: ce, reason: Se, sessionJobId: t });
        if (le && (await ns({
          apiPrefix: Zn,
          documentId: le,
          expiredJobId: t
        }) || q.isClosedOrStale()))
          return;
        if (Ua({
          status: ce,
          reason: Se,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const fe = Z instanceof Error ? Z.message : Ne.failed;
        A(fe, fe);
      }
    }
    return Ie(), () => {
      ae.abort(), g.current === ae && (g.current = null);
    };
  }, [t, r, o, a, s, c, l, y, n, i, d, u, f, h]), {
    sourceUrl: S,
    translatedUrl: m,
    sourceFile: k,
    translatedFile: O,
    assetsReady: D,
    title: T,
    regions: E,
    regionsSettled: B,
    readerMetadata: J,
    readerErrors: Q,
    boot: ne
  };
}
function os() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = _a(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = N(a), i = N(""), l = N(""), d = N(() => {
  }), u = $(() => d.current(), []), f = La({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: c,
    documentIdRef: i,
    sessionJobIdRef: l,
    switchToSourceMode: u
  }), {
    sessionJobId: h,
    documentId: y,
    sourceOnly: p,
    sourceViewOnly: w
  } = f, { mode: g, setMode: S, switchSessionMode: R } = Fa(w);
  d.current = () => {
    R("source");
  }, c.current = a, i.current = y, l.current = h;
  const m = za({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: v,
    scopedManifestPayload: k,
    jobStatus: L,
    jobTerminal: O,
    jobRefreshRevision: z,
    refreshJobArtifacts: D,
    refreshJobStatus: I
  } = m, T = rs({
    sessionJobId: h,
    jobId: r,
    routeDocumentId: o,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: p,
    locationKey: n,
    sessionIdentity: a,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: m.publishPayload,
    clearPayload: m.clearPayload,
    switchSessionMode: R,
    jobRefreshRevision: z,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), P = $(() => {
    var F;
    e.current = !0, (F = t.current) == null || F.abort();
  }, []), E = G(
    () => ({
      fetchProtected: Rt().fetchProtected,
      jobId: h,
      jobPayload: v,
      manifestPayload: k,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: w
    }),
    [h, v, k, T.sourceUrl, T.translatedUrl, w]
  );
  return {
    jobId: h,
    jobStatus: L,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: y,
    sessionIdentity: a,
    sourceOnly: p,
    mode: g,
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
    download: E,
    refreshJobArtifacts: D,
    refreshJobStatus: I,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: P
  };
}
const as = 160, ss = 8, is = 0;
function cs() {
  const e = N(null), [t, n] = M(null), [r, o] = M(is), a = $((s) => {
    e.current = s, n(s);
  }, []);
  return x(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < as || o((d) => Math.abs(d - l) < ss ? d : l);
    }, i = new ResizeObserver((l) => {
      var d, u;
      c(((u = (d = l[0]) == null ? void 0 : d.contentRect) == null ? void 0 : u.width) ?? s.clientWidth);
    });
    return i.observe(s), c(s.clientWidth), () => i.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function ls(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: o, hasTranslated: a } = e, s = r && o, c = r && a && !n, i = t === "source" || t === "compare", l = !n && (t === "translated" || t === "compare");
  return {
    mountSource: s,
    mountTranslated: c,
    showSource: i,
    showTranslated: l,
    compareMode: t === "compare" && i && l && s && c,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
const qt = { source: 0, translated: 0 };
function ds(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: c,
    translatedFile: i
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, d = N(l);
  d.current = l;
  const [u, f] = M(() => ({
    identity: l,
    pages: qt
  })), [h, y] = M(() => ({ identity: l, tick: 0 })), p = u.identity === l ? u.pages : qt, w = h.identity === l ? h.tick : 0, g = ls({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: S } = g, R = $((I, T) => {
    d.current === l && f((P) => {
      const E = P.identity === l ? P.pages : qt;
      return E[T] === I && P.identity === l ? P : {
        identity: l,
        pages: { ...E, [T]: I }
      };
    });
  }, [l]), m = N(null), v = $(() => {
    m.current && clearTimeout(m.current);
    const I = l;
    m.current = setTimeout(() => {
      m.current = null, d.current === I && y((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  x(() => (m.current && (clearTimeout(m.current), m.current = null), f((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), y((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    m.current && (clearTimeout(m.current), m.current = null);
  }), [l]);
  const k = G(
    () => Math.max(p.source, p.translated),
    [p]
  ), L = S === "translated" ? p.translated : p.source || p.translated, O = t == null ? void 0 : t.userZoom, z = t == null ? void 0 : t.shellWidth, D = `${l}-${w}-${O}-${n}-${p.source}-${p.translated}-${z}`;
  return {
    ...g,
    numPagesByPane: p,
    hudNumPages: k,
    primaryNumPages: L,
    metricsTick: w,
    onNumPages: R,
    onMetrics: v,
    rowSyncRevision: D
  };
}
const He = "data-reader-page", ot = "data-reader-pane", En = "data-natural-height", us = "reader-react-root", fs = "reader-react-grid", ms = "reader-react-scroll-shell", hs = "reader-react-pdf-pane", Gr = "reader-react-pdf-page", zt = "reader-react-pdf-page-placeholder", In = "reader-react-pdf-page-slot";
function Ot(e, t) {
  const n = e != null ? `[${He}="${e}"]` : `[${He}]`;
  return t ? `${n}[${ot}="${t}"]` : n;
}
function ps() {
  return `.${In}[${He}]`;
}
function Ft(e) {
  return Number(e.getAttribute(He));
}
const qr = 0.25, $t = 1, gs = 0.05, Pt = 0.5, bs = 16, ys = 8, vs = 720;
function Ue() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Zr(e) {
  return Number.isFinite(e) && e < vs;
}
function et(e, t = Number.POSITIVE_INFINITY) {
  return Zr(t) && (e === "source" || e === "translated") ? $t : Pt;
}
function Wt(e) {
  return Number.isFinite(e) ? Math.min($t, Math.max(qr, e)) : Pt;
}
function bt(e, t) {
  const n = Wt(Number(e) + t * gs);
  return Math.round(n * 100) / 100;
}
function ws(e) {
  return Math.round(Wt(e) * 100);
}
function Ss(e) {
  const n = (Number(e) || 0) - bs - ys;
  return Math.max(160, Math.floor(n));
}
function Rs(e, t = Pt) {
  const n = Wt(t);
  return Ss((Number(e) || 0) * n);
}
function Ps(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${ot}]`)
  ).map((s) => ({
    pane: s,
    cx: s.scrollLeft + s.clientWidth / 2,
    hadOverflow: s.scrollWidth > s.clientWidth + 1
  })), a = () => {
    e.scrollLeft = Math.max(0, n * t - e.clientWidth / 2), e.scrollTop = Math.max(0, r * t - e.clientHeight / 2);
    for (const { pane: s, cx: c, hadOverflow: i } of o) {
      const l = Math.max(0, s.scrollWidth - s.clientWidth);
      if (l <= 0) {
        s.scrollLeft = 0;
        continue;
      }
      i ? s.scrollLeft = Math.min(
        l,
        Math.max(0, c * t - s.clientWidth / 2)
      ) : s.scrollLeft = l / 2;
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(a);
  });
}
const Es = 8;
function Is(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Es ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Yr = 200, Xr = [
  "markdown",
  // 2026-11-19 加：在阅读页里改译文（ReaderBlockEditPanel）。
  "edit"
], Ts = Xr;
function Qr(e) {
  return Ts.includes(e);
}
const ks = "retainpdf:reader:view:v1:", tr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), As = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function eo() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function dn(e) {
  return `${e || ""}`.trim();
}
function Ns({
  documentId: e,
  jobId: t
}) {
  const n = dn(e);
  if (n) return `document:${n}`;
  const r = dn(t);
  return r ? `job:${r}` : "";
}
function to(e) {
  const t = dn(e);
  return t ? `${ks}${t}` : "";
}
function Ms(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function _s(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!tr.has(t) || !tr.has(n) || t === n))
    return { left: t, right: n };
}
function Ls(e) {
  return e === null ? null : Qr(e) ? e : void 0;
}
function Ds(e) {
  return As.has(e) ? e : void 0;
}
function no(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Ms(t.anchor), r = Number(t.zoom), o = Ds(t.mode), a = _s(t.splitLayout), s = Ls(t.assistantPanel);
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
function Ae(e, t = eo()) {
  const n = to(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? no(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Vt(e, t, n = eo()) {
  const r = to(e);
  if (!r || !n) return null;
  const o = Ae(e, n), a = no({
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
function Cs(e, t, n = "") {
  var f;
  const [r, o] = M(() => {
    var h;
    return ((h = Ae(n)) == null ? void 0 : h.zoom) ?? et(e, Ue());
  }), a = N(r), s = N(n);
  a.current = r;
  const c = N(1), i = N(((f = Ae(n)) == null ? void 0 : f.zoom) !== void 0);
  x(() => {
    var p;
    if (s.current === n) return;
    s.current = n;
    const h = (p = Ae(n)) == null ? void 0 : p.zoom;
    i.current = h !== void 0;
    const y = h ?? et(e, Ue());
    c.current = 1, a.current = y, o(y);
  }, [e, n]), x(() => {
    if (i.current) return;
    const h = et(e, Ue()), y = a.current;
    Math.abs(h - y) < 5e-4 || (c.current = 1, a.current = h, o(h));
  }, [e]);
  const l = $((h) => {
    const y = Wt(h), p = a.current;
    Math.abs(y - p) < 5e-4 || (c.current = y / (p || 1), i.current = !0, Vt(s.current, { zoom: y }), o(y));
  }, []), d = $((h) => {
    l(bt(a.current, h));
  }, [l]), u = $((h) => {
    l(et(h));
  }, [l]);
  return De(() => {
    const h = c.current;
    Math.abs(h - 1) < 1e-3 || (c.current = 1, Ps(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: d, resetZoom: u };
}
function xs(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: $((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const Tn = 48;
function ro(e, t = Tn) {
  return e.getBoundingClientRect().top + t;
}
function oo(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const i of e) {
    const l = i.getBoundingClientRect();
    l.height < 8 || l.width < 8 || l.top <= t + 1 && l.top >= r && (n = i, r = l.top);
  }
  if (!n && (n = e.find((l) => {
    const d = l.getBoundingClientRect();
    return d.height >= 8 && d.width >= 8;
  }) ?? null, n)) {
    const l = [...e].reverse().find((d) => {
      const u = d.getBoundingClientRect();
      return u.height >= 8 && u.width >= 8;
    });
    l && l.getBoundingClientRect().bottom < t && (n = l);
  }
  if (!n)
    return null;
  const o = Ft(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function Lt(e, t, n = Tn) {
  if (!e)
    return null;
  const r = Ot(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = ro(e, n), c = oo(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function yt(e, t, n = "auto", r, o = Tn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(Ot(a, r))), c || (c = e.querySelector(Ot(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const d = l.height > 0 ? l.height : c.offsetHeight, u = e.scrollTop + (l.top - i.top), f = Math.max(0, u + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - f) >= 1 && (e.scrollTop = f) : e.scrollTo({ top: f, behavior: n }), !0;
}
function zs(e, t, n = "smooth", r) {
  return yt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function un(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const c = [], i = () => {
    var d;
    if (a) return;
    yt(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (d = n == null ? void 0 : n.onDone) == null || d.call(n));
  };
  for (const l of o)
    l <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(i);
    }) : c.push(setTimeout(i, l));
  return () => {
    a = !0;
    for (const l of c)
      clearTimeout(l);
  };
}
function Os(e, t, n) {
  return un(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function jt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Re(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Fs(e, t, n = !0, r = "", o) {
  const [a, s] = M(1);
  return x(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, d = 0;
    const u = Ot(void 0, o), f = () => {
      if (i) return;
      const p = Array.from(c.querySelectorAll(u));
      if (!p.length)
        return;
      const w = ro(c), g = oo(p, w);
      g && s(g.page);
    }, h = () => {
      i || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, f();
      }));
    }, y = () => {
      if (i) return;
      if (!Array.from(c.querySelectorAll(u)).length) {
        l = setTimeout(y, 120);
        return;
      }
      f(), c.addEventListener("scroll", h, { passive: !0 });
    };
    return y(), () => {
      i = !0, l && clearTimeout(l), d && cancelAnimationFrame(d), c.removeEventListener("scroll", h);
    };
  }, [e, t, n, r, o]), a;
}
const $s = `canvas, .react-pdf__Page, .${Gr}, .${zt}`, nr = /* @__PURE__ */ new WeakMap();
function js(e) {
  const t = Number(e.getAttribute(En));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = nr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector($s), nr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Bs(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Us(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(ps()).forEach((r) => {
    const o = Ft(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = js(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Hs(e, t, n = "", r) {
  const [o, a] = M(() => /* @__PURE__ */ new Map()), s = N(o), c = N(r);
  return c.current = r, De(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, d = !1, u = !1;
    const f = () => {
      var v;
      if (i) return;
      const R = e.current;
      if (!R) return;
      const m = Us(R);
      Bs(s.current, m) || (s.current = m, a(m)), d && !u && (u = !0, (v = c.current) == null || v.call(c));
    }, h = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    h();
    const y = window.setTimeout(h, 100), p = window.setTimeout(() => {
      d = !0, h();
    }, 300), w = window.setTimeout(h, 700), g = e.current;
    let S = null;
    return g && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => h()), S.observe(g)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(y), window.clearTimeout(p), window.clearTimeout(w), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Ws = [0, 48, 140, 320, 560], Vs = 700, Js = [80, 200, 400], Ks = 500, Gs = 50, qs = /* @__PURE__ */ new Set([
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
]), Zs = 180, rr = [0, 48, 140, 320, 700, 1200];
function Ys(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = N(
    ((T = Ae(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), i = N(null), l = N(!1), d = N(r), u = N(null), f = N(null), h = N(null), y = N(null), p = N(a), w = N(""), g = N(n);
  g.current = n;
  const S = $(() => {
    var P;
    (P = u.current) == null || P.call(u), u.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), R = $(() => {
    !l.current && i.current == null || (S(), h.current != null && (clearTimeout(h.current), h.current = null), i.current = null, l.current = !1);
  }, [S]), m = $((P = !1) => {
    y.current != null && (clearTimeout(y.current), y.current = null);
    const E = () => {
      y.current = null, Vt(p.current, {
        anchor: Re(c.current)
      });
    };
    P ? E() : y.current = setTimeout(E, Zs);
  }, []), v = $((P) => {
    c.current = Re(P), i.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, l.current = !1;
    }, Gs);
  }, []);
  x(() => {
    if (!o)
      return;
    let P = !1, E = null, F = null, B = null;
    const j = () => {
      if (P) return;
      const J = e.current;
      if (!J) {
        B = setTimeout(j, 50);
        return;
      }
      E = J, F = () => {
        if (l.current)
          return;
        const Y = Lt(E, g.current);
        Y && (c.current = Y, m());
      }, E.addEventListener("scroll", F, { passive: !0 }), l.current || F();
    };
    return j(), () => {
      P = !0, B != null && clearTimeout(B), E && F && E.removeEventListener("scroll", F);
    };
  }, [o, r, n, e, m]), x(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const E = (F) => {
      F.metaKey || F.ctrlKey || F.altKey || qs.has(F.key) && R();
    };
    return P.addEventListener("wheel", R, { passive: !0 }), P.addEventListener("touchmove", R, { passive: !0 }), window.addEventListener("keydown", E), () => {
      P.removeEventListener("wheel", R), P.removeEventListener("touchmove", R), window.removeEventListener("keydown", E);
    };
  }, [o, e, R]), De(() => {
    var E;
    if (p.current === a) return;
    m(!0), S(), h.current != null && (clearTimeout(h.current), h.current = null), p.current = a, w.current = "";
    const P = (E = Ae(a)) == null ? void 0 : E.anchor;
    c.current = P ? Re(P) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, d.current = r;
  }, [a, r, m, S]), x(() => {
    var E;
    if (!o || !s || !a || w.current === a) return;
    w.current = a;
    const P = Re(
      ((E = Ae(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = P, i.current = P, l.current = !0, S(), u.current = un(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: g.current,
        delaysMs: rr,
        onDone: () => v(P)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(P);
    }, Math.max(...rr) + 160), () => S();
  }, [o, s, a, e, v, S]), x(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      l.current = !1, i.current = null, S();
      return;
    }
    const P = i.current ? Re(i.current) : Re(c.current);
    return l.current = !0, i.current = P, c.current = P, S(), u.current = un(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ws,
        onDone: () => v(P)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(P);
    }, Vs), () => {
      S();
    };
  }, [r, o, n, e, v, S]), x(() => () => {
    S(), h.current != null && (clearTimeout(h.current), h.current = null), m(!0);
  }, [S, m]);
  const k = $(() => {
    const P = Lt(
      e.current,
      g.current
    );
    return Re(P || c.current);
  }, [e]), L = $(() => {
    l.current = !0;
    const P = Lt(
      e.current,
      g.current
    ), E = Re(P ?? c.current);
    return c.current = E, i.current = E, m(), E;
  }, [e, m]), O = $((P, E, F) => {
    const B = F || g.current, j = jt(P, E || 1), J = { page: j, fraction: 0 };
    c.current = J, l.current = !0, i.current = J, m(), S(), zs(e.current, j, "smooth", B), u.current = Os(
      () => e.current,
      j,
      {
        behavior: "auto",
        pane: B,
        delaysMs: Js,
        onDone: () => v(J)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(J);
    }, Ks);
  }, [e, v, S, m]), z = $(() => Re(c.current), []), D = $(() => l.current, []), I = $(() => {
    if (!l.current || !i.current)
      return;
    const P = Re(i.current);
    yt(
      e.current,
      P,
      "auto",
      g.current
    );
  }, [e]);
  return {
    lockFromShell: k,
    beginModeSwitch: L,
    goToPage: O,
    getAnchor: z,
    isRestoring: D,
    repinIfRestoring: I
  };
}
function Xs(e, t) {
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
function ao(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Qs = [0, 80, 200, 400, 800], ei = 120, ti = 400;
function ni(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l, regionsSettled: d = !0 } = e, u = N(a);
  u.current = a;
  const f = N(s);
  f.current = s;
  const h = N(c);
  h.current = c;
  const y = N(n);
  y.current = n, x(() => {
    var m, v;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const p = Pa(), w = Xs(p, f.current);
    if (w == null && (p != null && p.blockId) && !d) return;
    const g = ao(p, w, { jobId: i, documentId: l });
    if (t.current === g)
      return;
    if (w == null) {
      t.current = g, (m = y.current) == null || m.call(y);
      return;
    }
    t.current = g, p && ((v = h.current) == null || v.call(h, p, w));
    const S = [];
    let R = 0;
    for (const k of Qs)
      R = Math.max(R, k), S.push(
        setTimeout(() => {
          u.current(w);
        }, k)
      );
    return S.push(
      setTimeout(() => {
        var k;
        (k = y.current) == null || k.call(y);
      }, R + ei)
    ), () => {
      for (const k of S) clearTimeout(k);
    };
  }, [r, o, i, l, t, d]);
}
function ri(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function oi(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = ti,
    jobId: c,
    documentId: i,
    applyReaderSearch: l
  } = e, d = N(a);
  d.current = a;
  const u = N(l);
  u.current = l;
  const f = N(0);
  x(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const h = setTimeout(() => {
      var g;
      const y = ((g = globalThis.location) == null ? void 0 : g.search) || "", p = Ko(y, o, d.current);
      if (f.current = o, p === null) return;
      const w = `${new URLSearchParams(p).get("block_id") || ""}`.trim();
      t.current = ao(
        { blockId: w },
        o,
        { jobId: c, documentId: i }
      ), (u.current || ri)(p);
    }, s);
    return () => clearTimeout(h);
  }, [
    n,
    r,
    o,
    s,
    c,
    i,
    t
  ]);
}
function ai(e) {
  const t = N(""), [n, r] = M(!1), o = $(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  ni(a, t, o), oi(e, t, n);
}
const dt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function si(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function or(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function so(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = or(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = or(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function ii(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = so(r, t, n);
  if (o === "retry") return e;
  if (o === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const a = new Map(n.items.map((i) => [i.item_id, i])), s = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const i of t.changed_item_ids)
    a.has(i) && s.set(i, t.seq);
  const c = new Map(e.pagesByPage);
  return c.set(t.page_idx, {
    attempt: n.attempt,
    generation: n.generation,
    pageHash: n.page_hash,
    itemsById: a,
    changedAtSeqById: s,
    lastEventSeq: t.seq
  }), {
    ...e,
    pagesByPage: c,
    lastSeq: t.seq,
    connection: "live",
    error: ""
  };
}
function ci(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const ar = [250, 500, 1e3, 2e3, 4e3], Zt = [80, 160, 320, 640, 1e3, 1500], sr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function fn(e, t) {
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
function kn(e) {
  return ta(e) ? `${e.code || ""}`.trim() : "";
}
function At(e, t) {
  const n = kn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function li(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (so(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = na(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (i) {
      if ((i == null ? void 0 : i.name) === "AbortError") throw i;
      a = i;
      const l = kn(i);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw i;
    }
    const c = Zt[Math.min(s, Zt.length - 1)];
    if (await fn(c, r), s >= Zt.length + 2) throw a;
  }
}
function di({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = M(dt), s = N(o), c = N("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), d = pt(l) ? l : "";
  return x(() => {
    if (!n || !i) {
      c.current = "", s.current = dt, a(dt);
      return;
    }
    const u = r === void 0 ? Ra() : r, f = c.current === i;
    if (c.current = i, !u) {
      const R = {
        ...f ? s.current : dt,
        connection: d ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = R, a(R);
      return;
    }
    const h = new AbortController();
    let y = !1;
    const p = {
      ...f ? s.current : dt,
      connection: d ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = p, a(p);
    const w = (R) => {
      h.signal.aborted || a((m) => {
        const v = R(m);
        return s.current = v, v;
      });
    }, g = async () => {
      let R = 0;
      for (; !h.signal.aborted; )
        try {
          const m = await u.fetchLayout(i, { signal: h.signal });
          y = !0, w((v) => ({
            ...v,
            layoutByPage: si(m),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (m) {
          if ((m == null ? void 0 : m.name) === "AbortError") return;
          const v = kn(m);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            w((L) => ({
              ...L,
              connection: d ? "terminal" : "unavailable",
              jobStatus: l,
              error: At(m, "实时译文暂不可用")
            }));
            return;
          }
          if (d) {
            w((L) => ({
              ...L,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          w((L) => ({
            ...L,
            connection: "connecting",
            jobStatus: l,
            error: At(m, "正在等待 OCR 版面数据")
          })), await fn(ar[Math.min(R, ar.length - 1)], h.signal).catch(() => {
          }), R += 1;
        }
    };
    return (async () => {
      if (await g(), !y || h.signal.aborted) return;
      let R = 0;
      for (; !h.signal.aborted; ) {
        d || w((m) => ({
          ...m,
          connection: m.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: m.error
        }));
        try {
          await u.streamEvents(i, {
            afterSeq: s.current.lastSeq,
            signal: h.signal,
            onEvent: async (m) => {
              if (m.seq <= s.current.lastSeq) return;
              let v;
              try {
                v = await li(
                  i,
                  m,
                  s.current,
                  h.signal,
                  u
                );
              } catch (k) {
                if ((k == null ? void 0 : k.name) === "AbortError" || h.signal.aborted) throw k;
                w((L) => ({
                  ...L,
                  lastSeq: Math.max(L.lastSeq, m.seq),
                  error: At(k, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              w((k) => {
                const L = ii(k, m, v);
                return d ? {
                  ...L,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...L,
                  jobStatus: l
                };
              }), R = 0;
            }
          });
        } catch (m) {
          if ((m == null ? void 0 : m.name) === "AbortError" || h.signal.aborted) return;
          w((v) => ({
            ...v,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: l,
            error: At(m, "实时译文连接已中断，正在重连")
          }));
        }
        if (h.signal.aborted) return;
        if (d) {
          w((m) => ({
            ...m,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await fn(sr[Math.min(R, sr.length - 1)], h.signal).catch(() => {
        }), R += 1;
      }
    })(), () => h.abort();
  }, [n, r, i, d]), o;
}
function ui(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, c = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    c && i > 0 && o.set(c, i);
  }
  return o;
}
function fi(e, t = !0) {
  const [n, r] = M(() => /* @__PURE__ */ new Map());
  return x(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Rt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((c) => {
      !s && c && r(ui(c));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const mi = 4500;
function hi(e) {
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
const pi = /* @__PURE__ */ new Set(["book", "translate"]);
function io(e) {
  return !!(e.jobId && e.sourceUrl && pi.has(e.workflow));
}
function gi(e) {
  return !!(io(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function bi() {
  const e = os(), t = io({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = gi({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !pt(o) && (r.current.running = !0);
  const a = di({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = cs(), d = fi(e.jobId, !e.sourceOnly), u = Ns({
    documentId: e.documentId,
    jobId: e.jobId
  }), f = `${u}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: y } = Cs(e.mode, s, u), p = ds(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: h, shellWidth: i, identityKey: f }
  ), {
    beginModeSwitch: w,
    goToPage: g,
    repinIfRestoring: S
  } = Ys(s, {
    primaryPane: p.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: u,
    restoreReady: p.primaryNumPages > 0
  });
  x(() => {
    S();
  }, [i, S]);
  const R = Hs(
    s,
    p.compareMode,
    p.rowSyncRevision,
    S
  ), m = Fs(
    s,
    p.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${p.metricsTick}`,
    p.primaryPane
  ), v = $((j, J) => {
    var Q, oe;
    const Y = Math.max(
      Number(p.hudNumPages) || 0,
      Number(p.primaryNumPages) || 0,
      Number((Q = p.numPagesByPane) == null ? void 0 : Q.source) || 0,
      Number((oe = p.numPagesByPane) == null ? void 0 : oe.translated) || 0
    );
    g(j, Y, J);
  }, [g, p.hudNumPages, p.primaryNumPages, p.numPagesByPane]), [k, L] = M(null), O = N(null), z = $((j) => {
    O.current && clearTimeout(O.current), L(j), j && (O.current = setTimeout(() => L(null), mi));
  }, []);
  x(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const D = $((j) => {
    const J = Gt(e.regions, j);
    return J ? Jn(J, p.primaryPane).page : null;
  }, [e.regions, p.primaryPane]), I = $((j, J) => {
    const Y = J || p.primaryPane, Q = typeof j == "object" && j ? `${j.block_id || ""}`.trim() : "", oe = typeof j == "object" && j ? `${j.image_url || ""}`.trim() : "", ne = typeof j == "object" && j ? j.page_idx != null ? Number(j.page_idx) + 1 : j.page != null ? Number(j.page) : null : typeof j == "number" ? j + 1 : null, se = Zo(e.regions, oe, ne) || Gt(e.regions, Q) || (typeof j == "object" ? Yo(e.regions, j) : null);
    let ae = se ? Jn(se, Y).page : null;
    ae == null && (ae = hi(j)), !(ae == null || ae < 1) && (z(se), v(ae, Y));
  }, [z, v, p.primaryPane, e.regions]);
  ai({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: p.hudNumPages || 0,
    currentPage: m,
    goToPage: v,
    resolveBlockPage: D,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (j) => {
      z(Gt(e.regions, j.blockId));
    }
  });
  const { setModeKeepingPage: T } = xs({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: w
  });
  x(() => {
    z(null);
  }, [f, z]);
  const P = !e.boot.loading && !e.boot.failed, E = G(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), F = G(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), B = G(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: y,
    shell: E,
    panes: p,
    sessionFiles: F,
    rowHeights: R,
    goToPage: v,
    activeRegion: k,
    jumpToAnchor: I,
    setModeKeepingPage: T,
    download: e.download,
    showHud: P,
    viewStateKey: u,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, E, p, F, R, v, k, I, T, P, h, y, u, a, n, d]);
  return G(() => ({
    ...B,
    currentPage: m
  }), [B, m]);
}
const yi = [
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
], vi = [
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
function wi(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of yi)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Si(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Ri = ".reader-notes-panel";
function Pi(e) {
  return e instanceof Element ? !!e.closest(Ri) : !1;
}
function Ei(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: c,
    goToPage: i,
    enabled: l = !0
  } = e;
  x(() => {
    if (!l)
      return;
    const d = (u) => {
      if (u.defaultPrevented || u.metaKey || u.ctrlKey || u.altKey || Si(u.target) || Pi(u.target))
        return;
      const f = u.key, h = wi(f);
      if (h) {
        if (h.mode) {
          if (n && h.mode !== "source")
            return;
          u.preventDefault(), r(h.mode);
          return;
        }
        if (!(h.requiresPages && c <= 0))
          switch (u.preventDefault(), h.action) {
            case "zoom-in":
              a(bt(o, 1));
              return;
            case "zoom-out":
              a(bt(o, -1));
              return;
            case "zoom-reset":
              a(et(t, Ue()));
              return;
            case "next-page":
              i(jt(s + 1, c));
              return;
            case "prev-page":
              i(jt(s - 1, c));
              return;
            case "first-page":
              i(1);
              return;
            case "last-page":
              i(c);
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
    c,
    i
  ]);
}
const Ii = "retainpdf:soft-reader-close";
function Ti() {
  return new URL("./index.html", window.location.href).href;
}
function ki() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Ii },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ai(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Ni() {
  if (!(typeof window > "u") && !ki()) {
    if (Ai(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Ti());
  }
}
function Mi({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ b("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function _i({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ C(Mi, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Ni();
  }, children: [
    /* @__PURE__ */ b(Pn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ b("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let ir = !1;
function Li() {
  if (ir)
    return;
  const e = gt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Vr.GlobalWorkerOptions.workerSrc = e, ir = !0);
}
const Di = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Ci(e, t, n) {
  return e.flatMap((r) => {
    if (!Di.has(Ht(r.region))) return [];
    const o = Rn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function cr(e, t, n) {
  let r = null, o = Number.POSITIVE_INFINITY;
  for (const a of e) {
    const { rect: s } = a;
    if (t < s.left || t > s.left + s.width || n < s.top || n > s.top + s.height)
      continue;
    const c = s.width * s.height;
    c < o && (r = a, o = c);
  }
  return r;
}
async function xi(e) {
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
const zi = "reader-text-hover-copy", Oi = "reader-text-hover-edit", Fi = "reader-text-hover-id";
function $i(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const co = "reader-text-hover-tools";
function Yt({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ b(
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
const lo = 26, uo = 220;
function fo(e, t = uo) {
  return e.height < lo * 2 || e.width < t;
}
function ji({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r
}) {
  const [o, a] = M("idle"), [s, c] = M("idle"), [i] = M(() => $i()), l = N([]), d = (e == null ? void 0 : e.itemId) || "";
  if (x(() => {
    a("idle"), c("idle");
    const w = l.current;
    return () => {
      w.forEach((g) => window.clearTimeout(g)), l.current = [];
    };
  }, [d]), !e) return null;
  const u = Xo(e.highlight.region, t), f = Ht(e.highlight.region), h = (w, g) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const R = await xi(w);
    g(R ? "copied" : "failed"), l.current.push(window.setTimeout(() => g("idle"), 1200));
  }, y = f === "formula" ? "复制 LaTeX" : "复制", p = fo(e.rect);
  return /* @__PURE__ */ b("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ b(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": f,
      style: e.rect,
      children: /* @__PURE__ */ C(
        "div",
        {
          className: co,
          "data-placement": p ? "outside" : "inside",
          children: [
            i ? /* @__PURE__ */ b(
              Yt,
              {
                className: Fi,
                state: s,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: h(e.itemId, c),
                children: s === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && n > 0 ? /* @__PURE__ */ C("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            t === "translated" && r ? /* @__PURE__ */ b(
              Yt,
              {
                className: Oi,
                state: "idle",
                label: "改这段译文",
                title: "改这段译文（E）",
                onClick: (w) => {
                  w.preventDefault(), w.stopPropagation(), r(e.itemId);
                },
                children: "改"
              }
            ) : null,
            u ? /* @__PURE__ */ b(
              Yt,
              {
                className: zi,
                state: o,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: h(u, a),
                children: o === "copied" ? "已复制" : o === "failed" ? "复制失败" : y
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Bi(e, t) {
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
function Ui(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = Rn(
      Bi(e, a),
      n,
      r
    );
    c && o.push({
      itemId: a.item_id,
      translatedText: s.translated_text,
      status: s.status,
      kind: a.kind,
      sourceText: a.source_text,
      typography: a.typography,
      rect: c,
      changedAtSeq: t.changedAtSeqById.get(a.item_id) || 0,
      changedNow: t.changedAtSeqById.get(a.item_id) === t.lastEventSeq
    });
  }
  return o;
}
const Hi = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Wi = 256, ut = /* @__PURE__ */ new Map();
function Vi(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Ji(e) {
  const t = `${e || ""}`, { text: n, slots: r } = pa(t, { bareLatex: !0 }), o = Vi(n), a = ga(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = ut.get(t);
  if (!s && (s = ba(o, r), ut.set(t, s), ut.size > Wi)) {
    const c = ut.keys().next().value;
    c !== void 0 && ut.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Xt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function _e(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Ki(e, t) {
  const n = e.typography, r = _e(t) || 1, o = _e(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Xt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = _e(n == null ? void 0 : n.fit_min_font_size_pt), d = _e(n == null ? void 0 : n.fit_max_font_size_pt), u = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    u,
    d ? d * r : o ? o * r : i
  ), h = o ? o * r : i, y = _e(n == null ? void 0 : n.leading_em), p = [
    _e(n == null ? void 0 : n.padding_top_pt) || 0,
    _e(n == null ? void 0 : n.padding_right_pt) || 0,
    _e(n == null ? void 0 : n.padding_bottom_pt) || 0,
    _e(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((w) => w * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Hi,
    fontSizePx: Math.max(u, Math.min(f, h)),
    minFontSizePx: u,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: y ? 1 + y : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Xt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Xt(e.kind) ? "center" : "justify",
    padding: p,
    exact: !!o
  };
}
function Gi(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), c = (u) => {
    const f = s.get(u);
    if (f !== void 0) return f;
    const { width: h, height: y } = e(u), p = h <= t + 0.5 && y <= n + 0.5;
    return s.set(u, p), p;
  };
  let i = o, l = a, d = Math.min(r.requestedFontSizePx, l);
  if (c(d)) {
    if (!r.exact) {
      i = d;
      for (let u = 0; u < 6 && l > i; u += 1) {
        const f = (i + l) / 2;
        c(f) ? (d = f, i = f) : l = f;
      }
    }
  } else {
    l = d, d = i;
    for (let u = 0; u < 8 && l > i; u += 1) {
      const f = (i + l) / 2;
      c(f) ? (d = f, i = f) : l = f;
    }
  }
  return Math.max(o, d);
}
const qi = 512, ft = /* @__PURE__ */ new Map();
let mn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  mn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  mn += 1;
}));
function Zi(e, t, n, r) {
  return [
    mn,
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
function mo({ item: e, pageScale: t }) {
  const n = N(null), r = G(
    () => Ji(e.translatedText),
    [e.translatedText]
  ), [o, a] = M(r.fallbackHtml), s = G(
    () => Ki(e, t),
    [e, t]
  );
  x(() => {
    let u = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      u && a(f);
    }), () => {
      u = !1;
    };
  }, [r]), De(() => {
    const u = n.current;
    if (!u) return;
    const [f, h, y, p] = s.padding, w = Math.max(1, e.rect.width - p - h), g = Math.max(1, e.rect.height - f - y), S = Zi(o, w, g, s);
    let R = ft.get(S);
    if (R === void 0 && (R = Gi(
      (m) => (u.style.fontSize = `${m}px`, { width: u.scrollWidth, height: u.scrollHeight }),
      w,
      g,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), ft.set(S, R), ft.size > qi)) {
      const m = ft.keys().next().value;
      m !== void 0 && ft.delete(m);
    }
    u.style.fontSize = `${R.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [c, i, l, d] = s.padding;
  return /* @__PURE__ */ b(
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": s.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${c}px ${i}px ${l}px ${d}px`
      },
      children: /* @__PURE__ */ b(
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
function Yi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = G(
    () => Ui(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ b(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ b(
        mo,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Xi = Ut(Yi);
function Qi({
  targets: e,
  edits: t,
  width: n
}) {
  const r = e.filter((o) => t.has(o.itemId));
  return r.length ? /* @__PURE__ */ b("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: r.map((o) => {
    const a = o.highlight.pageSize.width;
    return /* @__PURE__ */ C("div", { className: "reader-edited-block", "data-reader-edited-id": o.itemId, children: [
      /* @__PURE__ */ b(
        mo,
        {
          item: {
            itemId: o.itemId,
            translatedText: t.get(o.itemId) || "",
            status: "edited",
            kind: Ht(o.highlight.region),
            sourceText: o.highlight.box.text || "",
            rect: o.rect,
            changedAtSeq: 0,
            changedNow: !1
          },
          pageScale: a > 0 ? n / a : 1
        }
      ),
      /* @__PURE__ */ b("span", { className: "reader-edited-badge", style: { left: o.rect.left, top: o.rect.top }, children: "待排版" })
    ] }, o.itemId);
  }) }) : null;
}
const ec = Ut(Qi), ho = vn(null), po = vn(null);
function tc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ b(ho.Provider, { value: e, children: /* @__PURE__ */ b(po.Provider, { value: t, children: n }) });
}
function $e() {
  return wn(ho);
}
function go() {
  return wn(po);
}
const Oe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), nc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, rc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, oc = {
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
}, lr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function ac(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => lr(o ?? a ?? "", nc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => lr(o ?? a ?? "", rc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => oc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function sc(e) {
  return Oe(e.translatedBlockText) || Oe(e.translated.text) || Oe(e.source.text);
}
const ic = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function cc(e) {
  const t = [];
  for (const n of e) {
    if (!ic(n)) continue;
    const r = ac(sc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function lc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const dc = 24, uc = 60;
function dr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - dc), o = Math.min(e.length, n + t.length + uc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function fc(e, t, n = 200) {
  const r = Oe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const c = Oe(a.translatedBlockText) || Oe(a.translated.text), i = c ? dr(c, r) : null, l = i ?? dr(Oe(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function Nt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function mc(e, t) {
  const n = Oe(t).toLowerCase();
  if (!n || !e) return Nt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Nt(e.slice(a, s))}<mark class="reader-find-mark">${Nt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Nt(e.slice(a));
}
function hc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const bo = 1.414;
function pc({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  textLayer: a = !0,
  syncedMinHeight: s = 0,
  onMetrics: c,
  cachedAspect: i,
  onAspectChange: l,
  sentinelRef: d,
  regionHighlight: u = null,
  regionTargets: f = [],
  hoveredRegionId: h,
  onHoverRegion: y,
  liveTranslationLayout: p,
  liveTranslationPage: w,
  showLiveTranslation: g = r === "source"
}) {
  const S = $e(), R = S == null ? void 0 : S.revisedBlocks, m = S == null ? void 0 : S.pendingEdits, v = S == null ? void 0 : S.editBlock, k = (S == null ? void 0 : S.findTerm) || "", L = G(
    () => k ? ({ str: A }) => mc(A, k) : void 0,
    [k]
  ), O = N(i ?? bo), [z, D] = M(O.current);
  x(() => {
    i != null && Math.abs(i - O.current) >= 1e-3 && (O.current = i, D(i));
  }, [i]);
  const I = N(d);
  I.current = d;
  const T = N(null), P = N((A) => {
    var V;
    T.current = A, (V = I.current) == null || V.call(I, A);
  }).current, E = N(null), F = N(`${t}@${n}`);
  De(() => {
    const A = `${t}@${n}`;
    F.current !== A && (F.current = A, o && bc(T.current, E.current));
  }, [o, n, t]), x(() => {
    o || Qt(E.current);
  }, [o]), x(() => () => Qt(E.current), []);
  const B = Math.max(120, Math.floor(t * z)), j = Math.max(B, Math.ceil(s || 0)), J = Rn(u, t, B), Y = G(
    () => Ci(f, t, B),
    [B, f, t]
  ), [Q, oe] = M(null), ne = typeof y == "function", se = ne ? h ?? null : Q, ae = (A) => {
    ne ? A !== (h ?? null) && (y == null || y(A)) : oe((V) => V === A ? V : A);
  }, he = G(
    () => Y.find((A) => A.itemId === se) || null,
    [se, Y]
  ), q = (A) => {
    var Z, ce;
    if (A.pointerType === "touch") return;
    if (A.buttons !== 0) {
      ae(null);
      return;
    }
    if ((ce = (Z = A.target) == null ? void 0 : Z.closest) != null && ce.call(Z, `.${co}`)) return;
    const V = A.currentTarget.getBoundingClientRect(), pe = A.clientX - V.left, Ee = A.clientY - V.top, be = he == null ? void 0 : he.rect;
    if (be && fo(be) && pe >= be.left - 4 && pe <= be.left + uo && Ee >= be.top - lo && Ee <= be.top) return;
    const Ie = cr(Y, pe, Ee);
    ae((Ie == null ? void 0 : Ie.itemId) || null);
  }, ee = (A) => {
    if (A.pointerType === "mouse") return;
    const V = A.currentTarget.getBoundingClientRect(), pe = cr(
      Y,
      A.clientX - V.left,
      A.clientY - V.top
    );
    ae((pe == null ? void 0 : pe.itemId) || null);
  }, we = (A) => {
    !Number.isFinite(A) || A <= 0 || Math.abs(O.current - A) < 1e-3 || (O.current = A, D(A), l == null || l(e, A));
  };
  return /* @__PURE__ */ C(
    "div",
    {
      ref: P,
      [He]: e,
      [ot]: r,
      [En]: B,
      className: In,
      onPointerMoveCapture: q,
      onPointerDown: ee,
      onPointerLeave: (A) => {
        A.pointerType === "mouse" && ae(null);
      },
      style: {
        width: t,
        height: j,
        minHeight: j
      },
      children: [
        o ? /* @__PURE__ */ b(
          ma,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: L,
            renderAnnotationLayer: !1,
            className: Gr,
            loading: /* @__PURE__ */ b(
              "div",
              {
                className: zt,
                style: { width: t, height: B }
              }
            ),
            onLoadSuccess: (A) => {
              try {
                const V = A.getViewport({ scale: 1 });
                if (V.width > 0) {
                  const pe = V.height / V.width;
                  we(pe);
                }
              } catch {
              }
              c == null || c();
            },
            onRenderSuccess: () => {
              Qt(E.current), c == null || c();
            }
          }
        ) : /* @__PURE__ */ b(
          "div",
          {
            className: zt,
            style: { width: t, height: B },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ b("div", { ref: E, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        J ? /* @__PURE__ */ b(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: J,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && g ? /* @__PURE__ */ b(
          Xi,
          {
            layoutPage: p,
            pageState: w,
            width: t,
            height: B
          }
        ) : null,
        o && r === "translated" && (m != null && m.size) ? /* @__PURE__ */ b(ec, { targets: Y, edits: m, width: t }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ b("div", { className: "reader-revised-markers", "aria-hidden": "true", children: Y.filter((A) => R.has(A.itemId)).map((A) => /* @__PURE__ */ b(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": A.itemId,
            style: { left: A.rect.left, top: A.rect.top, height: A.rect.height }
          },
          A.itemId
        )) }) : null,
        /* @__PURE__ */ b(
          ji,
          {
            target: o ? he : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: he && (R == null ? void 0 : R.get(he.itemId)) || 0,
            onEdit: v
          }
        )
      ]
    }
  );
}
const gc = Ut(pc);
function bc(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Qt(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const yc = 2 * 1024 * 1024;
function vc(e) {
  const t = new Vr.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const en = 5, wc = "120% 0px", Sc = 120, Rc = "25% 0px";
let ur = 1;
const fr = /* @__PURE__ */ new WeakMap();
function Pc(e) {
  if (!e) return 0;
  const t = fr.get(e);
  if (t) return t;
  const n = ur;
  return ur += 1, fr.set(e, n), n;
}
function Ec() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Ic = $o(
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: o = 1,
    visible: a = !0,
    emptyLabel: s = "暂无 PDF",
    scrollRoot: c = null,
    pageWidthOverride: i = null,
    rowHeights: l,
    onMetrics: d,
    onLoadSuccess: u,
    onLoadError: f,
    onNumPagesChange: h,
    activeRegion: y = null,
    regions: p = [],
    readerMetadata: w = null,
    hoveredRegionId: g = null,
    onHoverRegion: S,
    liveTranslation: R,
    showLiveTranslation: m = t === "source",
    liveTranslationPendingLabel: v = "",
    paneAction: k
  }, L) {
    Li();
    const { file: O, loading: z, error: D } = Xa(n, r), I = `${n}\0${Pc(O)}`, T = N(I);
    T.current = I;
    const P = G(() => {
      const _ = Ja(O);
      return _ ? "ranged" in _ ? { range: vc(_.ranged) } : _ : null;
    }, [O, n]), [E, F] = M(0), [B, j] = M(""), [J, Y] = M(null), [Q, oe] = M(480), ne = N(null), se = N(0), ae = G(() => Ec(), []), he = G(() => ({
      cMapUrl: gt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: gt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: yc,
      disableAutoFetch: !0
    }), []);
    Sn(L, () => J, [J]), x(() => {
      const _ = (U) => {
        se.current = U, oe(U);
      }, W = (U) => {
        const te = Is(U, se.current);
        if (te !== "ignore") {
          if (ne.current && clearTimeout(ne.current), te === "immediate") {
            _(U);
            return;
          }
          ne.current = setTimeout(() => _(U), Yr);
        }
      }, H = !!(i && i >= 80);
      W(H ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const re = !H && c && typeof ResizeObserver < "u" ? new ResizeObserver((U) => {
        var te, ue;
        W(((ue = (te = U[0]) == null ? void 0 : te.contentRect) == null ? void 0 : ue.width) ?? c.clientWidth);
      }) : null;
      return re && c && re.observe(c), () => {
        re == null || re.disconnect(), ne.current && clearTimeout(ne.current);
      };
    }, [i, c, a]);
    const q = G(
      () => Rs(Q, o),
      [Q, o]
    ), [ee, we] = M(() => /* @__PURE__ */ new Map()), [A, V] = M(() => /* @__PURE__ */ new Set()), [pe, Ee] = M(() => /* @__PURE__ */ new Set()), be = N(/* @__PURE__ */ new Map()), Ie = N(null), Z = N(null), [ce, Se] = M(() => /* @__PURE__ */ new Set()), le = N(/* @__PURE__ */ new Map()), fe = $((_, W) => {
      we((H) => {
        if (H.get(_) === W) return H;
        const K = new Map(H);
        return K.set(_, W), K;
      });
    }, []), de = $((_, W) => {
      const H = be.current, K = H.get(_), re = [Ie.current, Z.current];
      if (K)
        for (const U of re)
          try {
            U == null || U.unobserve(K);
          } catch {
          }
      if (W) {
        H.set(_, W);
        for (const U of re)
          try {
            U == null || U.observe(W);
          } catch {
          }
      } else
        H.delete(_);
    }, []), qe = N(/* @__PURE__ */ new Map()), Ze = $((_) => {
      const W = qe.current;
      let H = W.get(_);
      return H || (H = (K) => de(_, K), W.set(_, H)), H;
    }, [de]);
    x(() => {
      if (typeof IntersectionObserver > "u") return;
      const _ = le.current, W = new IntersectionObserver(
        (H) => {
          const K = [], re = [];
          for (const U of H) {
            const te = U.target, ue = Ft(te);
            Number.isFinite(ue) && (U.isIntersecting ? K : re).push(ue);
          }
          if ((K.length || re.length) && V((U) => {
            let te = null;
            for (const ue of K)
              U.has(ue) || (te = te || new Set(U), te.add(ue));
            for (const ue of re)
              U.has(ue) && (te = te || new Set(U), te.delete(ue));
            return te || U;
          }), K.length) {
            for (const U of K) {
              const te = _.get(U);
              te && (clearTimeout(te), _.delete(U));
            }
            Ee((U) => {
              let te = null;
              for (const ue of K)
                U.has(ue) || (te = te || new Set(U), te.add(ue));
              return te || U;
            });
          }
          for (const U of re)
            _.has(U) || _.set(U, setTimeout(() => {
              _.delete(U), Ee((te) => {
                if (!te.has(U)) return te;
                const ue = new Set(te);
                return ue.delete(U), ue;
              });
            }, Sc));
        },
        { root: c, rootMargin: wc, threshold: 0 }
      );
      Ie.current = W;
      for (const H of be.current.values())
        try {
          W.observe(H);
        } catch {
        }
      return () => {
        W.disconnect(), Ie.current === W && (Ie.current = null);
        for (const H of _.values()) clearTimeout(H);
        _.clear();
      };
    }, [c]), x(() => {
      if (typeof IntersectionObserver > "u") return;
      const _ = new IntersectionObserver(
        (W) => {
          Se((H) => {
            let K = null;
            for (const re of W) {
              const U = Ft(re.target);
              !Number.isFinite(U) || re.isIntersecting === H.has(U) || (K = K || new Set(H), re.isIntersecting ? K.add(U) : K.delete(U));
            }
            return K || H;
          });
        },
        { root: c, rootMargin: Rc, threshold: 0 }
      );
      Z.current = _;
      for (const W of be.current.values())
        try {
          _.observe(W);
        } catch {
        }
      return () => {
        _.disconnect(), Z.current === _ && (Z.current = null);
      };
    }, [c]);
    const ct = !!c && typeof IntersectionObserver < "u";
    De(() => {
      F(0), j(""), V(/* @__PURE__ */ new Set()), Ee(/* @__PURE__ */ new Set()), we(/* @__PURE__ */ new Map()), be.current.clear();
      const _ = le.current;
      for (const W of _.values()) clearTimeout(W);
      _.clear(), h == null || h(0, t);
    }, [I, h, t]);
    const Jt = $(
      ({ numPages: _ }) => {
        T.current === I && (F(_), j(""), h == null || h(_, t), u == null || u({ numPages: _, pane: t }));
      },
      [I, u, h, t]
    ), Kt = $(
      (_) => {
        if (T.current !== I) return;
        const W = (_ == null ? void 0 : _.message) || "PDF 解析失败";
        j(W), F(0), h == null || h(0, t), f == null || f(_, t);
      },
      [I, f, h, t]
    ), Ce = G(
      () => E > 0 ? Array.from({ length: E }, (_, W) => W + 1) : [],
      [E]
    );
    x(() => {
      typeof IntersectionObserver < "u" || Ee(new Set(Ce));
    }, [Ce]);
    const xe = G(
      () => Kn(y, w, t),
      [y, w, t]
    ), je = G(() => {
      const _ = /* @__PURE__ */ new Map();
      for (const W of p) {
        const H = Kn(W, w, t);
        if (!H) continue;
        const K = _.get(H.box.page) || [];
        K.push(H), _.set(H.box.page, K);
      }
      return _;
    }, [t, w, p]), Et = G(() => {
      const _ = /* @__PURE__ */ new Set();
      if (!g) return _;
      for (const [W, H] of je)
        H.some((K) => K.itemId === g) && _.add(W);
      return _;
    }, [g, je]), It = G(() => {
      if (E === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(Ce);
      if (A.size === 0) {
        const H = Math.min(E, en * 2 + 1);
        return new Set(Array.from({ length: H }, (K, re) => re + 1));
      }
      const W = /* @__PURE__ */ new Set();
      for (const H of A)
        for (let K = -en; K <= en; K++) {
          const re = H + K;
          re >= 1 && re <= E && W.add(re);
        }
      return W;
    }, [E, Ce, c, a, A]), Ye = !n || !!D || !!B, Tt = n && (D || B) || s;
    return /* @__PURE__ */ C(
      "section",
      {
        ref: Y,
        className: `reader-panel ${hs}${a ? "" : " is-hidden"}`,
        [ot]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (R == null ? void 0 : R.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          k ? /* @__PURE__ */ b("div", { className: "reader-react-pdf-pane-action", children: k }) : null,
          v ? /* @__PURE__ */ C("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ b("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ b("span", { children: v })
          ] }) : null,
          Ye && !z ? /* @__PURE__ */ b("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Tt }) : null,
          z ? /* @__PURE__ */ b("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          P && !D ? /* @__PURE__ */ b("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ b(
            ha,
            {
              file: P,
              loading: null,
              error: null,
              options: he,
              onLoadSuccess: Jt,
              onLoadError: Kt,
              className: "reader-react-pdf-document",
              children: Ce.map((_) => {
                if (It.has(_))
                  return /* @__PURE__ */ b(
                    gc,
                    {
                      pane: t,
                      pageNumber: _,
                      width: q,
                      devicePixelRatio: ae,
                      active: pe.has(_),
                      textLayer: !ct || ce.has(_),
                      syncedMinHeight: (l == null ? void 0 : l.get(_)) || 0,
                      onMetrics: d,
                      cachedAspect: ee.get(_),
                      onAspectChange: fe,
                      sentinelRef: Ze(_),
                      regionHighlight: (xe == null ? void 0 : xe.box.page) === _ ? xe : null,
                      regionTargets: je.get(_),
                      hoveredRegionId: g && Et.has(_) ? g : null,
                      onHoverRegion: S,
                      liveTranslationLayout: R == null ? void 0 : R.layoutByPage.get(_ - 1),
                      liveTranslationPage: R == null ? void 0 : R.pagesByPage.get(_ - 1),
                      showLiveTranslation: m
                    },
                    `${t}-${_}`
                  );
                const H = ee.get(_) ?? bo, K = Math.max(120, Math.floor(q * H)), re = Math.max(K, Math.ceil((l == null ? void 0 : l.get(_)) || 0));
                return /* @__PURE__ */ b(
                  "div",
                  {
                    ref: Ze(_),
                    [He]: _,
                    [ot]: t,
                    [En]: K,
                    className: `${In} is-placeholder`,
                    style: {
                      width: q,
                      height: re,
                      minHeight: re
                    },
                    children: /* @__PURE__ */ b(
                      "div",
                      {
                        className: zt,
                        style: { width: q, height: K },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${_}`
                );
              })
            },
            I
          ) }) : null
        ]
      }
    );
  }
), mr = Ut(Ic), Tc = 2e3, kc = 6, Ac = 500, hr = "reader-react-resizing";
function Nc(e, t) {
  const n = N(null), r = N(null);
  De(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const m = Mc(e), v = Lt(e, m);
      if (!v) return;
      s = { pane: m, progress: v, started: performance.now() };
    }
    const { pane: c, progress: i, started: l } = s;
    let d = 0, u = null, f = e.scrollHeight, h = f, y = 0, p = l;
    const w = /* @__PURE__ */ new WeakMap(), g = typeof ResizeObserver > "u" ? null : new ResizeObserver((m) => {
      let v = !1;
      for (const k of m) {
        const L = Math.round(k.contentRect.height);
        w.has(k.target) && w.get(k.target) !== L && (v = !0), w.set(k.target, L);
      }
      v && yt(e, i, "auto", c);
    }), S = () => {
      var m;
      u && clearTimeout(u), cancelAnimationFrame(d), g == null || g.disconnect(), e.classList.remove(hr);
      for (const v of pr) e.removeEventListener(v, S);
      ((m = r.current) == null ? void 0 : m.stop) === S && (r.current = null);
    }, R = () => {
      yt(e, i, "auto", c);
      const m = e.scrollHeight;
      y = m === h ? y + 1 : 0, h = m;
      const v = performance.now() - p;
      y >= kc && (m !== f || v > Ac) || v > Tc ? S() : d = requestAnimationFrame(R);
    };
    for (const m of pr) e.addEventListener(m, S, { passive: !0 });
    for (const m of Array.from(e.children)) g == null || g.observe(m);
    e.classList.add(hr), r.current = { ...s, stop: S }, u = setTimeout(() => {
      u = null, p = performance.now(), f = e.scrollHeight, h = f, y = 0, d = requestAnimationFrame(R);
    }, Yr);
  }, [e, t]), x(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Mc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${He}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ot) || null;
  }
  return null;
}
const pr = ["wheel", "touchstart", "keydown", "pointerdown"], _c = () => () => {
}, gr = () => null;
function Lc({
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
function Dc(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Cc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function xc(e) {
  const t = $e(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, u = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Pt, y = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, p = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), w = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, g = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, R = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", m = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", v = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, L = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), z = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), D = e.regions ?? (t == null ? void 0 : t.regions) ?? [], I = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [P, E] = M(null), F = Fr(
    T ? T.subscribe : _c,
    T ? () => T.get().itemId : gr,
    T ? () => T.get().itemId : gr
  ), B = T ? F : P, j = $((oe) => {
    T ? T.set(oe, "pdf") : E(oe);
  }, [T]), J = Lc({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: d
  }), Q = Number.isFinite(y) && y > 0 ? Dc(
    y,
    n || r,
    typeof document > "u" ? y * 2 : document.documentElement.clientWidth
  ) : null;
  return Nc(f, Q), /* @__PURE__ */ b(
    "div",
    {
      ref: u,
      className: ms,
      "data-reader-region-count": D.length,
      "data-reader-structured-region-count": D.filter(Qo).length,
      "data-reader-metadata-ready": I ? "true" : "false",
      children: /* @__PURE__ */ C(
        "main",
        {
          className: `${fs} reader-mode-${J.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            w ? /* @__PURE__ */ b(
              mr,
              {
                pane: "source",
                url: R,
                preloadedFile: v,
                userZoom: h,
                visible: J.showSource,
                scrollRoot: f,
                pageWidthOverride: Q,
                rowHeights: J.compareMode ? p : void 0,
                onMetrics: L,
                emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: O,
                activeRegion: z,
                regions: D,
                readerMetadata: I,
                hoveredRegionId: B,
                onHoverRegion: j,
                liveTranslation: d ? o : void 0,
                showLiveTranslation: d,
                liveTranslationPendingLabel: d ? Cc(o) : "",
                paneAction: d ? /* @__PURE__ */ C(st, { children: [
                  e.sourcePaneAction,
                  /* @__PURE__ */ b(
                    "span",
                    {
                      className: "reader-source-overlay-badge",
                      "data-source-overlay-badge": "true",
                      title: "源栏正在叠加实时译文，右栏为最终译文 PDF",
                      children: "原文+实时译文叠加"
                    }
                  )
                ] }) : e.sourcePaneAction
              }
            ) : null,
            g ? /* @__PURE__ */ b(
              mr,
              {
                pane: "translated",
                url: m,
                preloadedFile: k,
                userZoom: h,
                visible: J.showTranslated,
                scrollRoot: f,
                pageWidthOverride: Q,
                rowHeights: J.compareMode ? p : void 0,
                onMetrics: L,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: O,
                activeRegion: z,
                regions: D,
                readerMetadata: I,
                hoveredRegionId: B,
                onHoverRegion: j,
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
const zc = [
  { id: "source", label: "原文", Icon: jr },
  { id: "compare", label: "对照", Icon: Br },
  { id: "translated", label: "译文", Icon: Ur }
];
function Oc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Fc(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function $c(e) {
  const t = $e(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Oc(a.state) : "";
  return /* @__PURE__ */ C("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ C(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ b(oa, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ b("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ b("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: zc.map(({ id: i, label: l, Icon: d }) => {
      const u = n === i, f = Fc({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ C(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${u ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": u,
          "aria-label": l,
          title: f ? `${l} 需要文档任务` : l,
          disabled: f,
          onClick: () => o(i),
          children: [
            /* @__PURE__ */ b(d, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ b("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        i
      );
    }) })
  ] });
}
const jc = {
  markdown: { label: "Markdown", short: "MD", Icon: sa, needsJob: !0 },
  edit: { label: "改译文", short: "改", Icon: aa, needsJob: !0 }
}, Bc = Xr.map(
  (e) => ({ id: e, ...jc[e] })
);
function yo() {
  return Bc.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Uc(e) {
  const t = $e(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ b(st, { children: yo().map(({ id: s, label: c, Icon: i, needsJob: l }) => {
    const d = n === s, u = l && r, f = d ? `收起${c}` : `打开${c}`;
    return /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": f,
        "aria-pressed": d,
        title: u ? `${c} 需打开任务阅读` : c,
        disabled: u,
        onClick: () => d ? a() : o(s),
        children: /* @__PURE__ */ b(i, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function Hc(e) {
  const t = $e(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = yo().map(({ id: i, label: l, short: d, Icon: u, needsJob: f }) => ({
    key: i,
    label: l,
    short: d,
    Icon: u,
    disabled: f && o,
    selected: n === i,
    badge: r == null ? void 0 : r[i],
    onClick: () => a(i)
  }));
  return n ? /* @__PURE__ */ C("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ b("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: c.map(({ key: i, label: l, Icon: d, disabled: u, selected: f, badge: h, onClick: y }) => /* @__PURE__ */ C(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": f,
        className: `reader-assistant-dock-tab${f ? " is-active" : ""}`,
        title: u ? `${l} 需打开任务阅读` : l,
        disabled: u,
        onClick: y,
        children: [
          /* @__PURE__ */ b(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ b("span", { className: "reader-assistant-dock-tab-label", children: l }),
          h ? /* @__PURE__ */ b("span", { className: "reader-assistant-dock-badge", children: h }) : null
        ]
      },
      i
    )) }),
    /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ b(Pn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Wc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Vc(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Jc(e) {
  return e / 100 * window.innerHeight;
}
function Kc(e) {
  return e / 100 * window.innerWidth;
}
function Gc(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function mt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Gc(n);
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
      r = Vc(t, o);
      break;
    }
    case "em": {
      r = Wc(t, o);
      break;
    }
    case "vh": {
      r = Jc(o);
      break;
    }
    case "vw": {
      r = Kc(o);
      break;
    }
  }
  return r;
}
function ge(e) {
  return parseFloat(e.toFixed(3));
}
function at({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function hn(e) {
  const { panels: t } = e, n = at({ group: e });
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
      const d = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = ge(d / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const d = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = ge(d / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const d = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = ge(d / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const d = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = ge(d / n * 100);
    }
    return {
      groupResizeBehavior: a.groupResizeBehavior,
      collapsedSize: s,
      collapsible: a.collapsible === !0,
      defaultSize: c,
      disabled: a.disabled,
      minSize: i,
      maxSize: l,
      panelId: r.id
    };
  });
}
function X(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function pn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? qc : Zc
  );
}
function qc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Zc(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function vo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function wo(e, t) {
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
function Yc({
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
    const { x: c, y: i } = wo(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return X(o, "No rect found"), o;
}
let Mt;
function Xc() {
  return Mt === void 0 && (typeof matchMedia == "function" ? Mt = !!matchMedia("(pointer:coarse)").matches : Mt = !1), Mt;
}
function So(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = pn(
    n,
    Array.from(t.children).filter(vo).map((y) => ({ element: y }))
  ).map(({ element: y }) => y), s = [];
  let c = !1, i = !1, l = -1, d = -1, u = 0, f, h = [];
  {
    let y = -1;
    for (const p of a)
      p.hasAttribute("data-panel") && (y++, p.hasAttribute("data-disabled") || (u++, l === -1 && (l = y), d = y));
  }
  if (u > 1) {
    let y = -1;
    for (const p of a)
      if (p.hasAttribute("data-panel")) {
        y++;
        const w = r.find(
          (g) => g.element === p
        );
        if (w) {
          if (f) {
            const g = f.element.getBoundingClientRect(), S = p.getBoundingClientRect();
            let R;
            if (i) {
              const m = n === "horizontal" ? new DOMRect(
                g.right,
                g.top,
                0,
                g.height
              ) : new DOMRect(
                g.left,
                g.bottom,
                g.width,
                0
              ), v = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (h.length) {
                case 0: {
                  R = [
                    m,
                    v
                  ];
                  break;
                }
                case 1: {
                  const k = h[0], L = Yc({
                    orientation: n,
                    rects: [g, S],
                    targetRect: k.element.getBoundingClientRect()
                  });
                  R = [
                    k,
                    L === g ? v : m
                  ];
                  break;
                }
                default: {
                  R = h;
                  break;
                }
              }
            } else
              h.length ? R = h : R = [
                n === "horizontal" ? new DOMRect(
                  g.right,
                  S.top,
                  S.left - g.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  g.bottom,
                  S.width,
                  S.top - g.bottom
                )
              ];
            for (const m of R) {
              let v = "width" in m ? m : m.element.getBoundingClientRect();
              const k = Xc() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (v.width < k) {
                const O = k - v.width;
                v = new DOMRect(
                  v.x - O / 2,
                  v.y,
                  v.width + O,
                  v.height
                );
              }
              if (v.height < k) {
                const O = k - v.height;
                v = new DOMRect(
                  v.x,
                  v.y - O / 2,
                  v.width,
                  v.height + O
                );
              }
              const L = y <= l || y > d;
              !c && !L && s.push({
                group: e,
                groupSize: at({ group: e }),
                panels: [f, w],
                separator: "width" in m ? void 0 : m,
                rect: v
              }), c = !1;
            }
          }
          i = !1, f = w, h = [];
        }
      } else if (p.hasAttribute("data-separator")) {
        p.ariaDisabled !== null && (c = !0);
        const w = o.find(
          (g) => g.element === p
        );
        w ? h.push(w) : (f = void 0, h = []);
      } else
        i = !0;
  }
  return s;
}
var ze;
class Ro {
  constructor() {
    Wn(this, ze, {});
  }
  addListener(t, n) {
    const r = lt(this, ze)[t];
    return r === void 0 ? lt(this, ze)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = lt(this, ze)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let o = !1, a = null;
        const s = Array.from(r);
        for (let c = 0; c < s.length; c++) {
          const i = s[c];
          try {
            i.call(null, n);
          } catch (l) {
            a === null && (o = !0, a = l);
          }
        }
        if (o)
          throw a;
      }
  }
  removeAllListeners() {
    Vn(this, ze, {});
  }
  removeListener(t, n) {
    const r = lt(this, ze)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
ze = new WeakMap();
let nt = {
  cursorFlags: 0,
  state: "inactive"
};
const An = new Ro();
function We() {
  return nt;
}
function Qc(e) {
  return An.addListener("change", e);
}
function el(e) {
  const t = nt, n = { ...nt };
  n.cursorFlags = e, nt = n, An.emit("change", {
    prev: t,
    next: n
  });
}
function rt(e) {
  const t = nt;
  nt = e, An.emit("change", {
    prev: t,
    next: e
  });
}
const tl = (e) => e, tn = () => {
}, Po = 1, Eo = 2, Io = 4, To = 8, br = 3, yr = 12;
let _t;
function vr() {
  return _t === void 0 && (_t = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (_t = !0)), _t;
}
function nl({
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
        if (e && vr()) {
          const a = (e & Po) !== 0, s = (e & Eo) !== 0, c = (e & Io) !== 0, i = (e & To) !== 0;
          if (a)
            return c ? "se-resize" : i ? "ne-resize" : "e-resize";
          if (s)
            return c ? "sw-resize" : i ? "nw-resize" : "w-resize";
          if (c)
            return "s-resize";
          if (i)
            return "n-resize";
        }
        break;
      }
    }
    return vr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const wr = /* @__PURE__ */ new WeakMap();
function Nn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = wr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = We();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = nl({
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
  wr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let ke = /* @__PURE__ */ new Map();
const ko = new Ro();
function rl(e) {
  ke = new Map(ke), ke.delete(e);
}
function Sr(e, t) {
  for (const [n] of ke)
    if (n.id === e)
      return n;
}
function Fe(e, t) {
  for (const [n, r] of ke)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function Ke() {
  return ke;
}
function Mn(e, t) {
  return ko.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Le(e, t, n) {
  const r = ke.get(e);
  ke = new Map(ke), ke.set(e, t), ko.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Ao(e) {
  const t = We();
  let n = !1;
  switch (t.state) {
    case "active":
      rt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Nn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Fe(r.group.id, !0);
        Le(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Rr(e) {
  e.defaultPrevented || Ao(e.currentTarget);
}
function ol(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = wo(n, a.rect);
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
function al(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function sl(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Ir(e),
    b: Ir(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  X(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Er(Pr(n.a)),
    b: Er(Pr(n.b))
  };
  if (o.a === o.b) {
    const a = r.childNodes, s = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let c = a.length;
    for (; c--; ) {
      const i = a[c];
      if (i === s.a) return 1;
      if (i === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
const il = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function cl(e) {
  const t = getComputedStyle(No(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function ll(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || cl(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || il.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Pr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (X(n, "Missing node"), ll(n)) return n;
  }
  return null;
}
function Er(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Ir(e) {
  const t = [];
  for (; e; )
    t.push(e), e = No(e);
  return t;
}
function No(e) {
  const { parentNode: t } = e;
  return al(t) ? t.host : t;
}
function dl(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function ul({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!vo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (sl(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (dl(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function _n(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = So(o), s = ol(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && ul({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function fl(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function me(e, t, n = 0) {
  return Math.abs(ge(e) - ge(t)) <= n;
}
function Te(e, t) {
  return me(e, t) ? 0 : e > t ? 1 : -1;
}
function tt({
  overrideDisabledPanels: e,
  panelConstraints: t,
  prevSize: n,
  size: r
}) {
  const {
    collapsedSize: o = 0,
    collapsible: a,
    disabled: s,
    maxSize: c = 100,
    minSize: i = 0
  } = t;
  if (s && !e)
    return n;
  if (Te(r, i) < 0)
    if (a) {
      const l = (o + i) / 2;
      Te(r, l) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(c, r), r = ge(r), r;
}
function vt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (me(e, 0))
    return t;
  const s = a === "imperative-api", c = Object.values(t), i = Object.values(o), l = [...c], [d, u] = r;
  X(d != null, "Invalid first pivot index"), X(u != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const p = e < 0 ? u : d, w = n[p];
        X(
          w,
          `Panel constraints not found for index ${p}`
        );
        const {
          collapsedSize: g = 0,
          collapsible: S,
          minSize: R = 0
        } = w;
        if (S) {
          const m = c[p];
          if (X(
            m != null,
            `Previous layout not found for panel index ${p}`
          ), me(m, g)) {
            const v = R - m;
            Te(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      {
        const p = e < 0 ? d : u, w = n[p];
        X(
          w,
          `No panel constraints found for index ${p}`
        );
        const {
          collapsedSize: g = 0,
          collapsible: S,
          minSize: R = 0
        } = w;
        if (S) {
          const m = c[p];
          if (X(
            m != null,
            `Previous layout not found for panel index ${p}`
          ), me(m, R)) {
            const v = m - g;
            Te(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      break;
    }
    default: {
      const p = e < 0 ? u : d, w = n[p];
      X(
        w,
        `Panel constraints not found for index ${p}`
      );
      const g = c[p], { collapsible: S, collapsedSize: R, minSize: m } = w;
      if (S && Te(g, m) < 0)
        if (e > 0) {
          const v = m - R, k = v / 2, L = g + e;
          Te(L, m) < 0 && (e = Te(e, k) <= 0 ? 0 : v);
        } else {
          const v = m - R, k = 100 - v / 2, L = g - e;
          Te(L, m) < 0 && (e = Te(100 + e, k) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const p = e < 0 ? 1 : -1;
    let w = e < 0 ? u : d, g = 0;
    for (; ; ) {
      const R = c[w];
      X(
        R != null,
        `Previous layout not found for panel index ${w}`
      );
      const m = tt({
        overrideDisabledPanels: s,
        panelConstraints: n[w],
        prevSize: R,
        size: 100
      }) - R;
      if (g += m, w += p, w < 0 || w >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(g));
    e = e < 0 ? 0 - S : S;
  }
  {
    let p = e < 0 ? d : u;
    for (; p >= 0 && p < n.length; ) {
      const w = Math.abs(e) - Math.abs(f), g = c[p];
      X(
        g != null,
        `Previous layout not found for panel index ${p}`
      );
      const S = g - w, R = tt({
        overrideDisabledPanels: s,
        panelConstraints: n[p],
        prevSize: g,
        size: S
      });
      if (!me(g, R) && (f += g - R, l[p] = R, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? p-- : p++;
    }
  }
  if (fl(i, l))
    return o;
  {
    const p = e < 0 ? u : d, w = c[p];
    X(
      w != null,
      `Previous layout not found for panel index ${p}`
    );
    const g = w + f, S = tt({
      overrideDisabledPanels: s,
      panelConstraints: n[p],
      prevSize: w,
      size: g
    });
    if (l[p] = S, !me(S, g)) {
      let R = g - S, m = e < 0 ? u : d;
      for (; m >= 0 && m < n.length; ) {
        const v = l[m];
        X(
          v != null,
          `Previous layout not found for panel index ${m}`
        );
        const k = v + R, L = tt({
          overrideDisabledPanels: s,
          panelConstraints: n[m],
          prevSize: v,
          size: k
        });
        if (me(v, L) || (R -= L - v, l[m] = L), me(R, 0))
          break;
        e > 0 ? m-- : m++;
      }
    }
  }
  const h = Object.values(l).reduce(
    (p, w) => w + p,
    0
  );
  if (!me(h, 100, 0.1))
    return o;
  const y = Object.keys(o);
  return l.reduce((p, w, g) => (p[y[g]] = w, p), {});
}
function Ve(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Te(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Je({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], o = r.reduce(
    (c, i) => c + i,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((c) => `${c}%`).join(", ")}`
    );
  if (!me(o, 100) && r.length > 0)
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      X(i != null, `No layout data found for index ${c}`);
      const l = 100 / o * i;
      r[c] = l;
    }
  let a = 0;
  for (let c = 0; c < t.length; c++) {
    const i = n[c];
    X(i != null, `No layout data found for index ${c}`);
    const l = r[c];
    X(l != null, `No layout data found for index ${c}`);
    const d = tt({
      overrideDisabledPanels: !0,
      panelConstraints: t[c],
      prevSize: i,
      size: l
    });
    l != d && (a += l - d, r[c] = d);
  }
  if (!me(a, 0))
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      X(i != null, `No layout data found for index ${c}`);
      const l = i + a, d = tt({
        overrideDisabledPanels: !0,
        panelConstraints: t[c],
        prevSize: i,
        size: l
      });
      if (i !== d && (a -= d - i, r[c] = d, me(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((c, i, l) => (c[s[l]] = i, c), {});
}
function Mo({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = Ke();
    for (const [
      l,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: u,
        layout: f,
        groupSize: h,
        separatorToPanels: y
      }
    ] of i)
      if (l.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: u,
          group: l,
          groupSize: h,
          layout: f,
          separatorToPanels: y
        };
    throw Error(`Group ${e} not found`);
  }, r = () => {
    const i = n().derivedPanelConstraints.find(
      (l) => l.panelId === t
    );
    if (i !== void 0)
      return i;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, o = () => {
    const i = n().group.panels.find((l) => l.id === t);
    if (i !== void 0)
      return i;
    throw Error(`Layout not found for Panel ${t}`);
  }, a = () => {
    const i = n().layout[t];
    if (i !== void 0)
      return i;
    throw Error(`Layout not found for Panel ${t}`);
  }, s = ({
    nextSize: i,
    panels: l,
    prevLayout: d,
    derivedPanelConstraints: u
  }) => {
    const f = a(), h = l.findIndex((w) => w.id === t), y = h === 0, p = h === l.length - 1;
    if (p && i < f && (y || l.slice(0, h).every((w, g) => {
      const S = u[g];
      return (S == null ? void 0 : S.collapsible) && me(S.collapsedSize, d[S.panelId]);
    }))) {
      const w = l.slice(0, h).reduce((g, S) => g + d[S.id], 0);
      return {
        ...d,
        [t]: ge(100 - w)
      };
    }
    return vt({
      delta: p ? f - i : i - f,
      initialLayout: d,
      panelConstraints: u,
      pivotIndices: p ? [h - 1, h] : [h, h + 1],
      prevLayout: d,
      trigger: "imperative-api"
    });
  }, c = (i) => {
    const l = a();
    if (i === l)
      return;
    const {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: u,
      group: f,
      groupSize: h,
      layout: y,
      separatorToPanels: p
    } = n(), w = s({
      nextSize: i,
      panels: f.panels,
      prevLayout: y,
      derivedPanelConstraints: u
    }), g = Je({
      layout: w,
      panelConstraints: u
    });
    Ve(y, g) || Le(f, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: u,
      groupSize: h,
      layout: g,
      separatorToPanels: p
    });
  };
  return {
    collapse: () => {
      const { collapsible: i, collapsedSize: l } = r(), { mutableValues: d } = o(), u = a();
      i && u !== l && (d.expandToSize = u, c(l));
    },
    expand: () => {
      const { collapsible: i, collapsedSize: l, minSize: d } = r(), { mutableValues: u } = o(), f = a();
      if (i && f === l) {
        let h = u.expandToSize ?? d;
        h === 0 && (h = 1), c(h);
      }
    },
    getSize: () => {
      const { group: i } = n(), l = a(), { element: d } = o(), u = i.orientation === "horizontal" ? d.offsetWidth : d.offsetHeight;
      return {
        asPercentage: l,
        inPixels: u
      };
    },
    isCollapsed: () => {
      const { collapsible: i, collapsedSize: l } = r(), d = a();
      return i && me(l, d);
    },
    resize: (i) => {
      const { group: l } = n(), { element: d } = o(), u = at({ group: l }), f = mt({
        groupSize: u,
        panelElement: d,
        styleProp: i
      }), h = ge(f / u * 100);
      c(h);
    }
  };
}
function Tr(e) {
  if (e.defaultPrevented)
    return;
  const t = Ke();
  _n(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Mo({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Dt(e) {
  const t = Ke();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function _o({
  groupId: e
}) {
  const t = () => {
    const n = Ke();
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
        layout: c,
        separatorToPanels: i
      } = t(), l = Je({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (Ve(c, l) || Le(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function Be(e, t) {
  const n = Dt(e), r = Fe(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  X(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  X(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), c = _o({ groupId: n.id }).getLayout(), i = vt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = Je({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  Ve(c, l) || Le(
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
function kr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Dt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && Be(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Be(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Be(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Be(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Be(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Dt(t), o = Fe(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (f) => f.element === t
        );
        X(i, "Matching separator not found");
        const l = c.get(i);
        X(l, "Matching panels not found");
        const d = l[0], u = a.find(
          (f) => f.panelId === d.id
        );
        if (X(u, "Panel metadata not found"), u.collapsible) {
          const f = s[d.id], h = u.collapsedSize === f ? r.mutableState.expandedPanelSizes[d.id] ?? u.minSize : u.collapsedSize;
          Be(t, h - f);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Dt(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        X(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), Be(t, -100);
        break;
      }
    }
}
function Ar(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = Ke(), n = _n(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), rt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Lo({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: o,
  pointerDownAtPoint: a,
  prevCursorFlags: s
}) {
  let c = 0;
  n.forEach((l) => {
    const { group: d, groupSize: u } = l, { orientation: f, panels: h } = d, { disableCursor: y } = d.mutableState;
    let p = 0;
    a ? f === "horizontal" ? p = (t.clientX - a.x) / u * 100 : p = (t.clientY - a.y) / u * 100 : f === "horizontal" ? p = t.clientX < 0 ? -100 : 100 : p = t.clientY < 0 ? -100 : 100;
    const w = r.get(d), g = o.get(d);
    if (!w || !g)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: R,
      groupSize: m,
      layout: v,
      separatorToPanels: k
    } = g;
    if (R && v && k) {
      const L = vt({
        delta: p,
        initialLayout: w,
        panelConstraints: R,
        pivotIndices: l.panels.map((O) => h.indexOf(O)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (Ve(L, v)) {
        if (p !== 0 && !y)
          switch (f) {
            case "horizontal": {
              c |= p < 0 ? Po : Eo;
              break;
            }
            case "vertical": {
              c |= p < 0 ? Io : To;
              break;
            }
          }
      } else
        Le(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: R,
          groupSize: m,
          layout: L,
          separatorToPanels: k
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & br : i |= c & br, t.movementY === 0 ? i |= s & yr : i |= c & yr, el(i), Nn(e);
}
function Nr(e) {
  const t = Ke(), n = We();
  switch (n.state) {
    case "active":
      Lo({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Mr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = We(), n = Ke();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        rt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Fe(a.group.id, !0);
          Le(a.group, s, {
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
      Lo({
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
      const a = _n(e, n);
      a.length === 0 ? t.state !== "inactive" && rt({
        cursorFlags: 0,
        state: "inactive"
      }) : rt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Nn(e.currentTarget);
      break;
    }
  }
}
function _r(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (We().state) {
      case "hover":
        rt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Lr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Ao(e.currentTarget) && e.preventDefault();
}
function Dr(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = ge(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = ge((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function ml(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = at({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, c = {
    asPercentage: ge(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = c, r.onResize(c, r.id, s);
}
function hl(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function pl({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const c = /* @__PURE__ */ new Map(), i = [];
  for (const u of e.panels) {
    const f = r[u.id] ?? 0;
    switch (u.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const h = f / 100 * n, y = ge(
          h / t * 100
        );
        c.set(u.id, y), o += y;
        break;
      }
      case "preserve-relative-size":
      default: {
        i.push(u.id), a += f;
        break;
      }
    }
  }
  if (!s || i.length === 0)
    return r;
  const l = 100 - o, d = { ...r };
  if (c.forEach((u, f) => {
    d[f] = u;
  }), a > 0)
    for (const u of i) {
      const f = r[u] ?? 0;
      d[u] = ge(
        f / a * l
      );
    }
  else {
    const u = ge(
      l / i.length
    );
    for (const f of i)
      d[f] = u;
  }
  return d;
}
function gl(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Xe = /* @__PURE__ */ new Map();
function bl(e) {
  let t = !0;
  X(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((y) => {
    for (const p of y) {
      const { borderBoxSize: w, target: g } = p;
      if (g === e.element) {
        if (t) {
          const S = at({ group: e });
          if (S === 0)
            return;
          const R = Fe(e.id);
          if (!R)
            return;
          const m = hn(e), v = R.defaultLayoutDeferred ? Dr(m) : R.layout, k = pl({
            group: e,
            nextGroupSize: S,
            prevGroupSize: R.groupSize,
            prevLayout: v
          }), L = Je({
            layout: k,
            panelConstraints: m
          });
          if (!R.defaultLayoutDeferred && Ve(R.layout, L) && hl(
            R.derivedPanelConstraints,
            m
          ) && R.groupSize === S)
            return;
          Le(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: m,
            groupSize: S,
            layout: L,
            separatorToPanels: R.separatorToPanels
          });
        }
      } else
        ml(e, g, w);
    }
  });
  a.observe(e.element), e.panels.forEach((y) => {
    X(
      !r.has(y.id),
      `Panel ids must be unique; id "${y.id}" was used more than once`
    ), r.add(y.id), y.onResize && a.observe(y.element);
  });
  const s = at({ group: e }), c = hn(e), i = e.panels.map(({ id: y }) => y).join(",");
  let l = e.mutableState.defaultLayout;
  l && (gl(e.panels, l) || (l = void 0));
  const d = e.mutableState.layouts[i] ?? l ?? Dr(c), u = Je({
    layout: d,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Xe.set(
    f,
    (Xe.get(f) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return So(e).forEach((y) => {
    y.separator && h.set(y.separator, y.panels);
  }), Le(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: u,
    separatorToPanels: h
  }), e.separators.forEach((y) => {
    X(
      !o.has(y.id),
      `Separator ids must be unique; id "${y.id}" was used more than once`
    ), o.add(y.id), y.element.addEventListener("keydown", kr);
  }), Xe.get(f) === 1 && (f.addEventListener("contextmenu", Rr, !0), f.addEventListener("dblclick", Tr, !0), f.addEventListener("pointerdown", Ar, !0), f.addEventListener("pointerleave", Nr), f.addEventListener("pointermove", Mr), f.addEventListener("pointerout", _r), f.addEventListener("pointerup", Lr, !0)), function() {
    t = !1, Xe.set(
      f,
      Math.max(0, (Xe.get(f) ?? 0) - 1)
    ), rl(e), e.separators.forEach((y) => {
      y.element.removeEventListener("keydown", kr);
    }), Xe.get(f) || (f.removeEventListener(
      "contextmenu",
      Rr,
      !0
    ), f.removeEventListener(
      "dblclick",
      Tr,
      !0
    ), f.removeEventListener(
      "pointerdown",
      Ar,
      !0
    ), f.removeEventListener("pointerleave", Nr), f.removeEventListener("pointermove", Mr), f.removeEventListener("pointerout", _r), f.removeEventListener("pointerup", Lr, !0)), a.disconnect();
  };
}
function yl() {
  const [e, t] = M({}), n = $(() => t({}), []);
  return [e, n];
}
function Ln(e) {
  const t = $r();
  return `${e ?? t}`;
}
const Ge = typeof window < "u" ? De : x;
function ht(e) {
  const t = N(e);
  return Ge(() => {
    t.current = e;
  }, [e]), $(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Dn(...e) {
  return ht((t) => {
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
function Cn(e) {
  const t = N({ ...e });
  return Ge(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Do = vn(null);
function vl(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: tl
  });
  Sn(t, () => n.current, []), Ge(() => {
    Object.assign(
      n.current,
      _o({ groupId: e })
    );
  });
}
function Co({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: o,
  elementRef: a,
  groupRef: s,
  id: c,
  onLayoutChange: i,
  onLayoutChanged: l,
  orientation: d = "horizontal",
  resizeTargetMinimumSize: u = {
    coarse: 20,
    fine: 10
  },
  style: f,
  ...h
}) {
  const y = N({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), p = ht((I) => {
    Ve(y.current.onLayoutChange, I) || (y.current.onLayoutChange = I, i == null || i(I));
  }), w = ht(
    (I, T) => {
      Ve(y.current.onLayoutChanged, I) || (y.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), g = Ln(c), S = N(null), [R, m] = yl(), v = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: u,
    separators: []
  }), k = Dn(S, a);
  vl(g, s);
  const L = ht(
    (I, T) => {
      const P = We(), E = Sr(I), F = Fe(I);
      if (F) {
        let B = !1;
        switch (P.state) {
          case "active": {
            B = P.hitRegions.some(
              (j) => j.group === E
            );
            break;
          }
        }
        return {
          flexGrow: F.layout[T] ?? 1,
          pointerEvents: B ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), O = Cn({
    defaultLayout: n,
    disableCursor: r
  }), z = G(
    () => ({
      get disableCursor() {
        return !!O.disableCursor;
      },
      getPanelStyles: L,
      id: g,
      orientation: d,
      registerPanel: (I) => {
        const T = v.current;
        return T.panels = pn(d, [
          ...T.panels,
          I
        ]), m(), () => {
          T.panels = T.panels.filter(
            (P) => P !== I
          ), m();
        };
      },
      registerSeparator: (I) => {
        const T = v.current;
        return T.separators = pn(d, [
          ...T.separators,
          I
        ]), m(), () => {
          T.separators = T.separators.filter(
            (P) => P !== I
          ), m();
        };
      },
      updatePanelProps: (I, { disabled: T }) => {
        const P = v.current.panels.find(
          (B) => B.id === I
        );
        P && (P.panelConstraints.disabled = T);
        const E = Sr(g), F = Fe(g);
        E && F && Le(E, {
          ...F,
          derivedPanelConstraints: hn(E)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: P
      }) => {
        const E = v.current.separators.find(
          (F) => F.id === I
        );
        E && (E.disabled = T, E.disableDoubleClick = P);
      }
    }),
    [L, g, m, d, O]
  ), D = N(null);
  return Ge(() => {
    const I = S.current;
    if (I === null)
      return;
    const T = v.current;
    let P;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === T.panels.length) {
      P = {};
      for (const Q of T.panels) {
        const oe = O.defaultLayout[Q.id];
        oe !== void 0 && (P[Q.id] = oe);
      }
    }
    const E = {
      disabled: !!o,
      element: I,
      id: g,
      mutableState: {
        defaultLayout: P,
        disableCursor: !!O.disableCursor,
        expandedPanelSizes: v.current.lastExpandedPanelSizes,
        layouts: v.current.layouts
      },
      orientation: d,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    D.current = E;
    const F = bl(E), { defaultLayoutDeferred: B, derivedPanelConstraints: j, layout: J } = Fe(E.id, !0);
    !B && j.length > 0 && (p(J), w(J, !1));
    const Y = Mn(g, (Q) => {
      const { defaultLayoutDeferred: oe, derivedPanelConstraints: ne, layout: se } = Q.next;
      if (oe || ne.length === 0)
        return;
      const ae = E.panels.map(({ id: q }) => q).join(",");
      E.mutableState.layouts[ae] = se, ne.forEach((q) => {
        if (q.collapsible) {
          const { layout: ee } = Q.prev ?? {};
          if (ee) {
            const we = me(
              q.collapsedSize,
              se[q.panelId]
            ), A = me(
              q.collapsedSize,
              ee[q.panelId]
            );
            we && !A && (E.mutableState.expandedPanelSizes[q.panelId] = ee[q.panelId]);
          }
        }
      });
      const he = We().state !== "active";
      p(se), he && w(se, Q.isUserInteraction);
    });
    return () => {
      D.current = null, F(), Y();
    };
  }, [
    o,
    g,
    w,
    p,
    d,
    R,
    O
  ]), x(() => {
    const I = D.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ b(Do.Provider, { value: z, children: /* @__PURE__ */ b(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": g,
      id: g,
      ref: k,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...f,
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
Co.displayName = "Group";
function xn() {
  const e = wn(Do);
  return X(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function wl(e, t) {
  const { id: n } = xn(), r = N({
    collapse: tn,
    expand: tn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: tn
  });
  Sn(t, () => r.current, []), Ge(() => {
    Object.assign(
      r.current,
      Mo({ groupId: n, panelId: e })
    );
  });
}
function gn({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: r = !1,
  defaultSize: o,
  disabled: a,
  elementRef: s,
  groupResizeBehavior: c = "preserve-relative-size",
  id: i,
  maxSize: l = "100%",
  minSize: d = "0%",
  onResize: u,
  panelRef: f,
  style: h,
  ...y
}) {
  const p = !!i, w = Ln(i), g = Cn({
    disabled: a
  }), S = N(null), R = Dn(S, s), {
    getPanelStyles: m,
    id: v,
    orientation: k,
    registerPanel: L,
    updatePanelProps: O
  } = xn(), z = u !== null, D = ht(
    (E, F, B) => {
      u == null || u(E, i, B);
    }
  );
  Ge(() => {
    const E = S.current;
    if (E !== null) {
      const F = {
        element: E,
        id: w,
        idIsStable: p,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: z ? D : void 0,
        panelConstraints: {
          groupResizeBehavior: c,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: g.disabled,
          maxSize: l,
          minSize: d
        }
      };
      return L(F);
    }
  }, [
    c,
    n,
    r,
    o,
    z,
    w,
    p,
    l,
    d,
    D,
    L,
    g
  ]), x(() => {
    O(w, { disabled: a });
  }, [a, w, O]), wl(w, f);
  const I = () => {
    const E = m(v, w);
    if (E)
      return JSON.stringify(E);
  }, T = Fr(
    (E) => Mn(v, E),
    I,
    I
  );
  let P;
  return T ? P = JSON.parse(T) : o !== void 0 ? P = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : P = { flexGrow: 1 }, /* @__PURE__ */ b(
    "div",
    {
      ...y,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": w,
      id: w,
      ref: R,
      style: {
        ...Sl,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...P
      },
      children: /* @__PURE__ */ b(
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
            touchAction: k === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
gn.displayName = "Panel";
const Sl = {
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
function Rl({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let o, a;
  const s = e[n], c = t.find(
    (i) => i.panelId === n
  );
  if (c) {
    const i = c.maxSize, l = c.collapsible ? c.collapsedSize : c.minSize, d = [r, r + 1];
    a = Je({
      layout: vt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Je({
      layout: vt({
        delta: i - s,
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
function xo({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...c
}) {
  const i = Ln(a), l = Cn({
    disabled: n,
    disableDoubleClick: r
  }), [d, u] = M({}), [f, h] = M("inactive"), [y, p] = M(!1), w = N(null), g = Dn(w, o), {
    disableCursor: S,
    id: R,
    orientation: m,
    registerSeparator: v,
    updateSeparatorProps: k
  } = xn(), L = m === "horizontal" ? "vertical" : "horizontal";
  Ge(() => {
    const D = w.current;
    if (D !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: D,
        id: i
      }, T = v(I), P = Qc(
        (F) => {
          h(
            F.next.state !== "inactive" && F.next.hitRegions.some(
              (B) => B.separator === I
            ) ? F.next.state : "inactive"
          );
        }
      ), E = Mn(
        R,
        (F) => {
          const { derivedPanelConstraints: B, layout: j, separatorToPanels: J } = F.next, Y = J.get(I);
          if (Y) {
            const Q = Y[0], oe = Y.indexOf(Q);
            u(
              Rl({
                layout: j,
                panelConstraints: B,
                panelId: Q.id,
                panelIndex: oe
              })
            );
          }
        }
      );
      return () => {
        P(), E(), T();
      };
    }
  }, [R, i, v, l]), x(() => {
    k(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, k]);
  let O;
  n && !S && (O = "not-allowed");
  let z;
  if (n)
    z = "disabled";
  else
    switch (f) {
      case "active": {
        z = "active";
        break;
      }
      default:
        y ? z = "focus" : z = f;
    }
  return /* @__PURE__ */ b(
    "div",
    {
      ...c,
      "aria-controls": d.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": L,
      "aria-valuemax": d.valueMax,
      "aria-valuemin": d.valueMin,
      "aria-valuenow": d.valueNow,
      children: e,
      className: t,
      "data-separator": z,
      "data-testid": i,
      id: i,
      onBlur: () => p(!1),
      onFocus: () => p(!0),
      ref: g,
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
xo.displayName = "Separator";
const zn = 30, On = 65, wt = 50, Pl = 100 - On, El = 100 - zn;
function Il(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(On, Math.max(zn, t)) : wt;
}
function Fn(e) {
  return 100 - e;
}
function Qe(e) {
  return `${e}%`;
}
const $n = "reader-document", St = "reader-assistant", zo = "retainpdf.reader.ai-split-layout.v1", Tl = {
  [$n]: Fn(wt),
  [St]: wt
};
function jn(e) {
  const t = Il(e == null ? void 0 : e[St]);
  return {
    [$n]: Fn(t),
    [St]: t
  };
}
function kl() {
  try {
    const e = JSON.parse(localStorage.getItem(zo) || "null");
    return jn(e);
  } catch {
    return Tl;
  }
}
function Al(e) {
  try {
    localStorage.setItem(zo, JSON.stringify(jn(e)));
  } catch {
  }
}
function nn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = jn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[St]}vw`
  );
}
function Nl() {
  const e = N(null), [t] = M(kl);
  De(() => {
    const o = e.current;
    return nn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = $((o) => {
    nn(e.current, o);
  }, []), r = $((o, a) => {
    nn(e.current, o), a.isUserInteraction && Al(o);
  }, []);
  return /* @__PURE__ */ C(
    Co,
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
        /* @__PURE__ */ b(
          gn,
          {
            id: $n,
            defaultSize: Qe(Fn(wt)),
            minSize: Qe(Pl),
            maxSize: Qe(El)
          }
        ),
        /* @__PURE__ */ b(
          xo,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ b("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ b(
          gn,
          {
            id: St,
            defaultSize: Qe(wt),
            minSize: Qe(zn),
            maxSize: Qe(On)
          }
        )
      ]
    }
  );
}
function Ml({
  id: e,
  open: t,
  ariaLabel: n,
  className: r = "",
  onClose: o,
  toolbar: a,
  children: s
}) {
  return x(() => {
    if (!t) return;
    const c = (i) => {
      var d;
      if (i.key !== "Escape") return;
      const l = i.target;
      (d = l == null ? void 0 : l.closest) != null && d.call(l, "textarea, input, select, [contenteditable='true']") || (i.preventDefault(), o());
    };
    return window.addEventListener("keydown", c), () => window.removeEventListener("keydown", c);
  }, [t, o]), t ? /* @__PURE__ */ C(
    "aside",
    {
      id: e,
      className: `reader-notes-panel reader-notes-panel--workspace${a ? " has-panel-toolbar" : ""} ${r}`.trim(),
      "aria-label": n,
      role: "dialog",
      "aria-modal": "false",
      children: [
        a ? /* @__PURE__ */ b("div", { className: "reader-notes-panel-toolbar", children: a }) : null,
        /* @__PURE__ */ b("div", { className: "reader-notes-panel-body", children: s })
      ]
    }
  ) : null;
}
function _l({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = M(!1);
  if (x(() => {
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
    n ? /* @__PURE__ */ b(ye, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
    /* @__PURE__ */ b(
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
function Ll({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ b(_l, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ C(st, { children: [
    e ? /* @__PURE__ */ b("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ C("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ b("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ b("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ b(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ C("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ b("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ b(ye, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Dl(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Cl() {
  const [e, t] = M(!1), n = $r(), r = N(null);
  return x(() => {
    if (!e) return;
    const o = (s) => {
      const c = r.current;
      c && s.target instanceof Node && !c.contains(s.target) && t(!1);
    }, a = (s) => {
      s.key === "Escape" && (s.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", o), window.addEventListener("keydown", a), () => {
      document.removeEventListener("mousedown", o), window.removeEventListener("keydown", a);
    };
  }, [e]), x(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Dl(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ C("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ b(ia, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
            /* @__PURE__ */ b("strong", { children: "快捷键" }),
            /* @__PURE__ */ b(
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
          /* @__PURE__ */ b("div", { className: "reader-react-shortcuts-body", children: vi.map((o) => /* @__PURE__ */ C("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ b("h3", { children: o.title }),
            /* @__PURE__ */ b("ul", { children: o.items.map((a) => /* @__PURE__ */ C("li", { children: [
              /* @__PURE__ */ b("kbd", { children: a.keys }),
              /* @__PURE__ */ b("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ b("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const xl = ["source", "sideBySide", "translated"], zl = { source: "", translated: "", sideBySide: "" };
function Ol(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Ct(e.sourceUrl), n = Ct(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ka({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Fl(e) {
  const [t, n] = M(() => /* @__PURE__ */ new Set()), r = G(
    () => e ? Ol(e) : zl,
    [e]
  ), o = G(
    () => xl.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = $(async (s) => {
    if (!e) return;
    const c = Ct(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? Ta(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Aa(
          e.fetchProtected,
          c,
          i,
          i,
          null,
          (l) => n((d) => {
            const u = new Set(d);
            return l ? u.add(s) : u.delete(s), u;
          })
        );
      } catch (i) {
        const l = i instanceof Error ? i.message : "下载失败";
        Na(l), n((d) => {
          const u = new Set(d);
          return u.delete(s), u;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const $l = {
  source: jr,
  sideBySide: Br,
  translated: Ur
}, jl = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Bl(e) {
  const t = $e(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Fl(n), c = N(null);
  return x(() => {
    const i = () => {
      var u;
      (u = c.current) != null && u.open && (c.current.open = !1);
    }, l = (u) => {
      c.current && !c.current.contains(u.target) && i();
    }, d = (u) => {
      u.key === "Escape" && i();
    };
    return document.addEventListener("pointerdown", l), document.addEventListener("keydown", d), () => {
      document.removeEventListener("pointerdown", l), document.removeEventListener("keydown", d);
    };
  }, []), /* @__PURE__ */ C("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ C("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ b(ca, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ b(Hr, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ b("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = Wo[i], d = Ct(r[i]), u = a.has(i), f = !!d && !u, h = f ? "" : Vo(i, r), y = $l[i];
      return /* @__PURE__ */ C(
        "button",
        {
          type: "button",
          id: `reader-download-${i}`,
          className: `reader-download-action${u ? " is-busy" : ""}`,
          disabled: !f,
          "aria-label": f ? `下载${l.label}` : h,
          onClick: () => {
            c.current && (c.current.open = !1), s(i);
          },
          children: [
            /* @__PURE__ */ b(y, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ C("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ C("span", { className: "reader-download-action-label", children: [
                jl[i],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ b("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
const Ul = "retainpdf:reader:bookmarks:v1:", Hl = 200;
function Bn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Oo(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Ul}${t}` : "";
}
function Wl(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Bt(e, t = Bn()) {
  const n = Oo(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Wl(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function bn(e, t, n) {
  const r = Oo(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Hl);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Vl(e, t, n = "", { storage: r = Bn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Bt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? bn(e, a.filter((c) => c.page !== s), r) : bn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Jl(e, t, n = Bn()) {
  return bn(e, Bt(e, n).filter((r) => r.page !== t), n);
}
function Kl(e, t) {
  var r, o, a, s;
  let n = null;
  for (const c of e || []) {
    if (`${(c == null ? void 0 : c.regionType) || ""}` != "heading") continue;
    const i = Number(((r = c.source) == null ? void 0 : r.page) ?? ((o = c.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(i) || i > t) continue;
    const l = `${((a = c.translated) == null ? void 0 : a.text) || c.markdown || ((s = c.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!l) continue;
    const d = Number(c.readingOrder) || 0;
    (!n || i > n.page || i === n.page && d >= n.order) && (n = { page: i, order: d, text: l });
  }
  return n ? n.text.slice(0, 60) : "";
}
function Gl({ filled: e }) {
  return /* @__PURE__ */ b("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ b("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function ql({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = M(() => Bt(e)), [c, i] = M(!1), l = N(null);
  if (x(() => {
    s(Bt(e)), i(!1);
  }, [e]), x(() => {
    if (!c) return;
    const f = (y) => {
      l.current && !l.current.contains(y.target) && i(!1);
    }, h = (y) => {
      y.key === "Escape" && i(!1);
    };
    return document.addEventListener("pointerdown", f), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", f), document.removeEventListener("keydown", h);
    };
  }, [c]), !e || n <= 0) return null;
  const d = Math.min(Math.max(t, 1), n), u = a.some((f) => f.page === d);
  return /* @__PURE__ */ C("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${u ? " is-marked" : ""}`,
        "aria-pressed": u,
        "aria-label": u ? `取消第 ${d} 页的书签` : `给第 ${d} 页加书签`,
        title: u ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Vl(e, d, Kl(r, d))),
        children: /* @__PURE__ */ b(Gl, { filled: u })
      }
    ),
    /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": c,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        disabled: !a.length,
        onClick: () => i((f) => !f),
        children: a.length
      }
    ),
    c && a.length ? /* @__PURE__ */ b("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ b("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ C("li", { className: f.page === d ? "is-current" : "", children: [
      /* @__PURE__ */ C(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ C("span", { className: "reader-bookmark-page", children: [
              "第 ",
              f.page,
              " 页"
            ] }),
            f.label ? /* @__PURE__ */ b("span", { className: "reader-bookmark-label", children: f.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ b(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${f.page} 页的书签`,
          onClick: () => s(Jl(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function Zl(e) {
  const t = $e(), n = go(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Pt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = ws(a), u = a > qr + 1e-3, f = a < $t - 1e-3, h = et(r, Ue()), y = h >= $t ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [p, w] = M(!1), [g, S] = M(`${c}`);
  x(() => {
    p || S(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, p]);
  const R = () => {
    if (w(!1), !l || i <= 0)
      return;
    const m = Number(`${g}`.trim());
    l(jt(m, i));
  };
  return /* @__PURE__ */ C("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ b("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ b("div", { className: "reader-react-hud-group", "aria-label": "页码", children: p ? /* @__PURE__ */ C(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (m) => {
          m.preventDefault(), R();
        },
        children: [
          /* @__PURE__ */ b(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: g,
              autoFocus: !0,
              onChange: (m) => S(m.target.value.replace(/[^\d]/g, "")),
              onBlur: R,
              onKeyDown: (m) => {
                m.key === "Escape" && (m.preventDefault(), w(!1), S(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ C("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            i || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": i > 0 ? `跳转页码，当前第 ${c} 页，共 ${i} 页` : "页码",
        title: i > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || i <= 0,
        onClick: () => {
          !l || i <= 0 || (S(`${c}`), w(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ b(
      ql,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ C("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ b(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !u,
          onClick: () => s(bt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ C(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${y}`,
          title: y,
          onClick: () => s(h),
          children: [
            d,
            "%"
          ]
        }
      ),
      /* @__PURE__ */ b(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !f,
          onClick: () => s(bt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ b("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ b(Cl, {}) })
  ] });
}
function Cr(e) {
  var t, n;
  return Qr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Yl(e) {
  const [t, n] = M(() => ({
    scope: e,
    panel: Cr(Ae(e))
  }));
  x(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Cr(Ae(e))
    });
  }, [e]), x(() => {
    t.scope === e && Vt(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = $((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const yn = "download-toast";
function Xl({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ C("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ C("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ b("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ b("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ b("div", { className: "download-toast-track", children: /* @__PURE__ */ b("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ b("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Ql(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    on.dismiss(yn);
    return;
  }
  on.custom(
    () => /* @__PURE__ */ b(Xl, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: yn, duration: 1 / 0 }
  );
}
function ed() {
  const e = $((t) => {
    t && (t.setState = Ql, t.hide = () => on.dismiss(yn));
  }, []);
  return /* @__PURE__ */ C(st, { children: [
    /* @__PURE__ */ b(ra, { position: "bottom-right" }),
    /* @__PURE__ */ b("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function td(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Zr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function nd(e, t) {
  return t === null || e !== t;
}
function rd(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
function xr(e, t) {
  const n = e === t;
  return { open: n, mounted: rd(n) };
}
const zr = { itemId: null, origin: null };
function od() {
  let e = zr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? zr : { itemId: n, origin: r };
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
const ad = [];
function sd({ open: e, onToggle: t }) {
  return /* @__PURE__ */ C("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ C(ye, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ b(la, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ C(ye, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ b(da, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { children: "搜索" })
    ] })
  ] });
}
function id({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: c = 0
}) {
  var S, R;
  const i = ((S = $e()) == null ? void 0 : S.regions) ?? ad, l = ((R = go()) == null ? void 0 : R.currentPage) ?? 1, d = G(() => cc(i), [i]), u = lc(d, l), f = G(() => fc(i, s), [i, s]), [h, y] = M(-1);
  x(() => y(-1), [s]);
  const p = N(null), w = N(null);
  x(() => {
    var m, v, k;
    e === "search" ? (m = p.current) == null || m.focus() : (k = (v = w.current) == null ? void 0 : v.querySelector('[aria-current="location"]')) == null || k.scrollIntoView({ block: "center" });
  }, [e, c]), x(() => {
    var m, v;
    e === "search" && h >= 0 && ((v = (m = w.current) == null ? void 0 : m.querySelector('[aria-current="true"]')) == null || v.scrollIntoView({ block: "nearest" }));
  }, [e, h]);
  const g = (m) => {
    const v = f[m];
    v && (y(m), r(v.itemId));
  };
  return /* @__PURE__ */ C("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ C("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ b(ye, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ b(ye, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ b(ye, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ b(Pn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ b("ol", { ref: w, className: "reader-finder-list", children: d.map((m, v) => /* @__PURE__ */ b("li", { children: /* @__PURE__ */ C(
      ye,
      {
        className: "reader-finder-entry",
        "data-level": m.level,
        "aria-current": v === u ? "location" : void 0,
        onClick: () => r(m.itemId),
        children: [
          /* @__PURE__ */ b("span", { className: "reader-finder-entry-text", children: m.text }),
          /* @__PURE__ */ b("span", { className: "reader-finder-entry-page", children: m.page })
        ]
      }
    ) }, m.itemId)) }) : /* @__PURE__ */ b("p", { className: "reader-finder-empty", children: i.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ C(st, { children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ b(
          Wr,
          {
            ref: p,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (m) => a(m.target.value),
            onKeyDown: (m) => {
              m.key === "Enter" ? (m.preventDefault(), g(hc(h, f.length, m.shiftKey))) : m.key === "Escape" && (m.preventDefault(), n()), m.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ b("p", { className: "reader-finder-count", "aria-live": "polite", children: f.length === 0 ? "没有找到" : `${h >= 0 ? `第 ${h + 1} / ` : ""}${f.length >= 200 ? "200+ 处，只列前 200 处" : `${f.length} 处`}${h < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ b("ol", { className: "reader-finder-list", children: f.map((m, v) => /* @__PURE__ */ b("li", { children: /* @__PURE__ */ C(ye, { className: "reader-finder-entry is-hit", "aria-current": v === h ? "true" : void 0, onClick: () => g(v), children: [
        /* @__PURE__ */ C("span", { className: "reader-finder-entry-text", children: [
          m.snippet.slice(0, m.at),
          /* @__PURE__ */ b("mark", { children: m.snippet.slice(m.at, m.at + m.length) }),
          m.snippet.slice(m.at + m.length)
        ] }),
        /* @__PURE__ */ b("span", { className: "reader-finder-entry-page", children: m.page })
      ] }) }, m.itemId)) })
    ] })
  ] });
}
const cd = "reader-finder-input";
function ld(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function dd(e, t = typeof window > "u" ? null : window) {
  x(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!ld(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(cd) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function ie(e) {
  return typeof e == "string" ? e : "";
}
function ud(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function fd(e) {
  const t = `${e || ""}`.trim(), n = /^(.*-b)(\d+)$/.exec(t);
  if (!n) return t ? [t] : [];
  const r = Number(n[2]), o = [t, `${n[1]}${`${r}`.padStart(3, "0")}`, `${n[1]}${r}`];
  return [...new Set(o)];
}
function md(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function hd(e) {
  return {
    source: ie(e == null ? void 0 : e.source_text) || ie(e == null ? void 0 : e.unit_source_text),
    translated: ie(e == null ? void 0 : e.protected_translated_text) || ie(e == null ? void 0 : e.translated_text)
  };
}
const pd = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Fo(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function gd(e) {
  const t = Fo(e).sort((r, o) => ie(r.ts).localeCompare(ie(o.ts)));
  return t.length ? [
    { text: ie(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ie(r.new_text),
      label: pd[ie(r.source)] || ie(r.source) || "修订",
      ts: ie(r.ts),
      reason: ie(r.reason)
    }))
  ].reverse() : [];
}
function Or(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function bd(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ie(r.finished_at) || ie(n.finished_at) || "";
}
function yd(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Fo(e).sort((a, s) => ie(a.ts).localeCompare(ie(s.ts)));
  for (const a of o) {
    const s = new Date(ie(a.ts)).getTime(), c = ie(a.reader_item_id) || ie(a.item_id);
    !c || Number.isNaN(s) || s <= r || n.set(c, ie(a.new_text));
  }
  return n;
}
const vd = {
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
function wd(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = vd[ie(n.kind)] || ie(n.kind) || "问题", o = ie(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
function Sd() {
  try {
    return Rt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Rd = "这本书正在处理（翻译或排版），处理完才能改。", Pd = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Ed({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Sd(), s = `${e || ""}`.trim(), c = !!(a && s && r), i = ud(s), l = !t || pt(t), d = bd(n), [u, f] = M(""), [h, y] = M(null), [p, w] = M(() => /* @__PURE__ */ new Map()), [g, S] = M(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [R, m] = M(() => /* @__PURE__ */ new Map()), [v, k] = M({ phase: "idle" });
  x(() => {
    y(null), m(/* @__PURE__ */ new Map()), k({ phase: "idle" });
  }, [s]), x(() => {
    if (f(""), !c || i || !a) return;
    let P = !1;
    return a.resolveOwnerJobId(s).then((E) => {
      P || f(`${E || s}`.trim() || s);
    }).catch(() => {
      P || f(s);
    }), () => {
      P = !0;
    };
  }, [c, i, a, s]), x(() => {
    if (w(/* @__PURE__ */ new Map()), !a || !u || !d || !l) return;
    let P = !1;
    return a.fetchRevisions(u).then((E) => {
      P || w(yd(E, d));
    }).catch(() => {
    }), () => {
      P = !0;
    };
  }, [a, u, d, l]);
  const L = v.phase === "running" && v.seenActive;
  x(() => {
    if (v.phase === "running") {
      if (!l) {
        L || k({ phase: "running", seenActive: !0 });
        return;
      }
      L && k(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [v.phase, L, l, t]);
  const O = G(() => {
    const P = new Map(p);
    if (g.renderedAt === d)
      for (const [E, F] of g.edits) P.set(E, F);
    return P;
  }, [p, g, d]), z = $((P) => {
    const E = `${P || ""}`.trim();
    E && y({ itemId: E, page: md(E) });
  }, []), D = $((P, E) => {
    S((F) => {
      const B = new Map(F.renderedAt === d ? F.edits : []);
      return B.set(P, E), { renderedAt: d, edits: B };
    }), m((F) => new Map(F).set(P, (F.get(P) || 0) + 1));
  }, [d]), I = $(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      k({ phase: "submitting" });
      try {
        await a.rerender(s), k({ phase: "running", seenActive: !1 }), await o();
      } catch (P) {
        k({ phase: "failed", message: (P == null ? void 0 : P.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), T = i ? Pd : !l || v.phase === "running" || v.phase === "submitting" ? Rd : "";
  return {
    available: c,
    blockedReason: T,
    port: a,
    ownerJobId: u,
    target: h,
    select: z,
    pendingEdits: O,
    savedCounts: R,
    markSaved: D,
    rerender: v,
    startRerender: I
  };
}
function Id(e, t) {
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
async function Td(e, t, n) {
  let r = null;
  for (const o of fd(n))
    try {
      const a = await e.loadItem(t, o);
      if (a != null && a.item) return { itemId: o, item: a.item };
    } catch (a) {
      r = a;
      const s = a;
      if ((s == null ? void 0 : s.status) !== 404 || s != null && s.reason) throw a;
    }
  throw r || new Error("找不到这一段的译文。");
}
function kd({
  port: e,
  jobId: t,
  readerItemId: n,
  onSaved: r
}) {
  const [o, a] = M(null), [s, c] = M(!1), [i, l] = M([]), [d, u] = M(""), [f, h] = M(""), [y, p] = M(!1), [w, g] = M(null), [S, R] = M([]), m = N(/* @__PURE__ */ new Map()), v = N(null), k = $(async (D, I) => {
    if (e)
      try {
        l(gd(await e.fetchRevisions(D, I)));
      } catch {
        l([]);
      }
  }, [e]);
  x(() => {
    if (a(null), l([]), g(null), R([]), h(""), !e || !t || !n) return;
    let D = !1;
    return c(!0), Td(e, t, n).then(({ itemId: I, item: T }) => {
      if (D) return;
      const { source: P, translated: E } = hd(T);
      a({ readerItemId: n, itemId: I, source: P, current: E }), u(m.current.get(n) ?? E);
    }).catch((I) => {
      D || g({ tone: "error", message: (I == null ? void 0 : I.message) || "读取这段译文失败。" });
    }).finally(() => {
      D || c(!1);
    }), k(t, n), () => {
      D = !0;
    };
  }, [e, t, n, k]);
  const L = $((D) => {
    u(D), n && m.current.set(n, D);
  }, [n]), O = $(async (D, I) => {
    if (!e || !o || y) return !1;
    const T = D ?? d;
    if (!T.trim()) return !1;
    p(!0), g(null), R([]);
    try {
      const P = await e.revise(t, o.itemId, {
        translated_text: T,
        source: "user",
        reason: (I ?? f).trim() || "在阅读页手动修改",
        ...v.current != null ? { expected_generation: v.current } : {}
      }), E = Number(P == null ? void 0 : P.generation);
      return Number.isFinite(E) && (v.current = E), m.current.delete(o.readerItemId), a({ ...o, current: T }), u(T), h(""), (P == null ? void 0 : P.changed) === !1 ? g({ tone: "ok", message: "和原来一样，没有改动。" }) : (r(o.readerItemId, T), g({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), k(t, o.readerItemId), !0;
    } catch (P) {
      const E = P;
      return (E == null ? void 0 : E.reason) === "generation_mismatch" && (v.current = null), g({ tone: "error", message: (E == null ? void 0 : E.message) || "保存失败，请稍后再试。" }), R(wd(E == null ? void 0 : E.issues)), !1;
    } finally {
      p(!1);
    }
  }, [e, o, y, d, f, t, r, k]), z = $(() => {
    o && (m.current.delete(o.readerItemId), u(o.current));
  }, [o]);
  return {
    loading: s,
    loaded: (o == null ? void 0 : o.readerItemId) === n ? o : null,
    history: i,
    draft: d,
    setDraft: L,
    reason: f,
    setReason: h,
    saving: y,
    status: w,
    issues: S,
    save: O,
    resetDraft: z
  };
}
const Ad = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Nd(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Ad.has(Ht(r)) || (n.add(o), t.push(o));
  }
  return t;
}
function Md({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ b("p", { className: "reader-block-edit-pending is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ C("div", { className: "reader-block-edit-pending", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ b("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF。` }),
    t ? /* @__PURE__ */ b(ye, { className: "reader-block-edit-act", size: "sm", variant: "secondary", "data-block-edit-action": "rerender", onClick: () => {
      e.startRerender();
    }, children: "重新排版" }) : null
  ] });
}
function _d({
  open: e,
  onClose: t,
  edit: n,
  regions: r,
  jumpToBlock: o
}) {
  var p, w;
  const a = ((p = n.target) == null ? void 0 : p.itemId) || "", s = kd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: a,
    onSaved: n.markSaved
  }), c = G(() => Nd(r), [r]), i = c.indexOf(a), l = $((g) => {
    const S = c[i + g];
    S && (n.select(S), o == null || o(S));
  }, [c, i, n, o]);
  x(() => {
    if (!e || i < 0) return;
    const g = (S) => {
      !S.altKey || S.key !== "ArrowUp" && S.key !== "ArrowDown" || (S.preventDefault(), l(S.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", g), () => window.removeEventListener("keydown", g);
  }, [e, i, l]);
  const { loaded: d } = s, u = s.saving || s.loading, f = n.blockedReason, h = !d || s.draft === d.current;
  let y;
  return n.available ? a ? y = /* @__PURE__ */ C(st, { children: [
    /* @__PURE__ */ C("div", { className: "reader-block-edit-nav", children: [
      /* @__PURE__ */ C("span", { className: "reader-block-edit-where", children: [
        "第 ",
        ((w = n.target) == null ? void 0 : w.page) || "?",
        " 页"
      ] }),
      /* @__PURE__ */ b(Gn, { className: "reader-block-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: i <= 0, onClick: () => l(-1), children: /* @__PURE__ */ b(ua, { size: 14, "aria-hidden": !0 }) }),
      /* @__PURE__ */ b(Gn, { className: "reader-block-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: i < 0 || i >= c.length - 1, onClick: () => l(1), children: /* @__PURE__ */ b(Hr, { size: 14, "aria-hidden": !0 }) })
    ] }),
    f ? /* @__PURE__ */ b("p", { className: "reader-block-edit-note is-blocked", "data-block-edit-blocked": "true", children: f }) : null,
    s.loading ? /* @__PURE__ */ b("p", { className: "reader-block-edit-note", children: "正在读这一段…" }) : null,
    d ? /* @__PURE__ */ C(
      "form",
      {
        className: "reader-block-edit-form",
        onSubmit: (g) => {
          g.preventDefault(), s.save();
        },
        children: [
          /* @__PURE__ */ b("h4", { children: "原文" }),
          /* @__PURE__ */ b("p", { className: "reader-block-edit-source", "data-block-edit-source": "true", children: d.source || "（没有原文）" }),
          /* @__PURE__ */ b("h4", { children: "译文" }),
          /* @__PURE__ */ b(
            fa,
            {
              id: "reader-block-edit-text",
              className: "reader-block-edit-text",
              rows: 8,
              value: s.draft,
              disabled: u || !!f,
              "aria-label": "译文",
              onChange: (g) => s.setDraft(g.target.value),
              onKeyDown: (g) => {
                g.key === "Enter" && (g.metaKey || g.ctrlKey) && (g.preventDefault(), h || s.save());
              }
            }
          ),
          /* @__PURE__ */ b("p", { className: "reader-block-edit-hint", children: "公式照框里原来的写法（$…$）保留，改坏了保存时会检查不过。Ctrl+Enter 保存。" }),
          /* @__PURE__ */ b(
            Wr,
            {
              size: "sm",
              className: "reader-block-edit-reason",
              value: s.reason,
              placeholder: "为什么改（可不填）",
              "aria-label": "修改原因",
              disabled: u || !!f,
              onChange: (g) => s.setReason(g.target.value)
            }
          ),
          /* @__PURE__ */ C("div", { className: "reader-block-edit-actions", children: [
            /* @__PURE__ */ b(ye, { className: "reader-block-edit-act", type: "button", variant: "ghost", size: "sm", disabled: u || h, onClick: s.resetDraft, children: "还原" }),
            /* @__PURE__ */ b(ye, { className: "reader-block-edit-act", type: "submit", variant: "primary", size: "sm", "data-block-edit-action": "save", disabled: u || !!f || h || !s.draft.trim(), pending: s.saving, children: "保存" })
          ] })
        ]
      }
    ) : null,
    s.status ? /* @__PURE__ */ b("p", { className: `reader-block-edit-status is-${s.status.tone}`, role: s.status.tone === "error" ? "alert" : "status", children: s.status.message }) : null,
    s.issues.length ? /* @__PURE__ */ b("ul", { className: "reader-block-edit-issues", "data-block-edit-issues": "true", children: s.issues.map((g) => /* @__PURE__ */ b("li", { children: g }, g)) }) : null,
    d && s.history.length ? /* @__PURE__ */ C("section", { className: "reader-block-edit-history", "aria-label": "修订历史", children: [
      /* @__PURE__ */ C("h4", { children: [
        "修订历史（",
        s.history.length - 1,
        "）"
      ] }),
      /* @__PURE__ */ b("ol", { children: s.history.map((g, S) => {
        const R = g.text === d.current;
        return /* @__PURE__ */ C("li", { "data-block-edit-history": g.label, "data-current": R ? "true" : void 0, children: [
          /* @__PURE__ */ C("div", { className: "reader-block-edit-history-meta", children: [
            /* @__PURE__ */ C("span", { children: [
              [Or(g.ts), g.label].filter(Boolean).join(" · "),
              R ? "（现在用的）" : ""
            ] }),
            R ? null : /* @__PURE__ */ b(
              ye,
              {
                className: "reader-block-edit-act",
                variant: "ghost",
                size: "sm",
                "data-block-edit-action": "restore",
                disabled: u || !!f,
                onClick: () => {
                  s.save(g.text, `回到「${[Or(g.ts), g.label].filter(Boolean).join(" ")}」那一版`);
                },
                children: "用这版"
              }
            )
          ] }),
          g.reason ? /* @__PURE__ */ b("p", { className: "reader-block-edit-history-reason", children: g.reason }) : null,
          /* @__PURE__ */ b("p", { className: "reader-block-edit-history-text", children: g.text })
        ] }, `${g.ts}:${S}`);
      }) })
    ] }) : null
  ] }) : y = /* @__PURE__ */ b("p", { className: "reader-block-edit-note", children: "在译文上把鼠标停在一段上，点「改」，或者按 E。" }) : y = /* @__PURE__ */ b("p", { className: "reader-block-edit-note", children: "这里不能改译文。" }), /* @__PURE__ */ b(
    Ml,
    {
      id: "reader-block-edit-panel",
      open: e,
      ariaLabel: "改译文",
      className: "is-pane-right reader-block-edit-panel",
      onClose: t,
      toolbar: n.pendingEdits.size || n.rerender.phase !== "idle" ? /* @__PURE__ */ b(Md, { edit: n }) : void 0,
      children: /* @__PURE__ */ b("div", { className: "reader-block-edit", children: y })
    }
  );
}
const Ld = Bo(() => import("./ReaderMarkdownPanel-DTacxOUx.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Dd(e) {
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
function Cd(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function xd() {
  const e = bi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Yl(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = M(!1), d = N(null), u = N(null), f = s !== null, h = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, y = Dd({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: h,
    liveTranslationVisible: i,
    assistantOpen: f
  }), p = ci({
    hasOverlayContent: h,
    connection: e.liveTranslation.connection,
    showSource: y.showSource,
    liveTranslationVisible: i,
    assistantOpen: f
  }), w = y.sourceViewOnly, g = y.visibleMode;
  x(() => {
    l(!1);
  }, [e.viewStateKey]), x(() => {
    e.session.jobTerminal && l(!1);
  }, [e.session.jobTerminal]), x(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const A = Ae(e.viewStateKey), V = td({
          savedMode: A == null ? void 0 : A.mode,
          sourceViewOnly: w,
          viewportWidth: Ue()
        });
        u.current = V.auto ? V.mode : null, V.mode && V.mode !== e.mode && e.setModeKeepingPage(V.mode);
        return;
      }
      nd(e.mode, u.current) && (u.current = null, Vt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, w]);
  const S = s || (e.mode === "compare" ? "compare" : "reading"), R = xr(s, "markdown"), m = xr(s, "edit");
  Ei({
    mode: g,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const v = $(() => {
    c(null);
  }, []), k = $((A) => {
    const V = Cd(A, e.liveTranslationAvailable);
    V !== null && l(V), e.setModeKeepingPage(A);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), L = G(() => p.sourcePaneToggle ? /* @__PURE__ */ b(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${i ? " is-active" : ""}`,
      onClick: () => l((A) => !A),
      "aria-pressed": i,
      title: i ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [p.sourcePaneToggle, i]), O = $((A) => {
    c(A);
  }, []), [z] = M(od), [D, I] = M(null), T = $((A) => I((V) => V === A ? null : A), []), [P, E] = M(""), [F, B] = M("");
  x(() => {
    const A = P.replace(/\s+/gu, " ").trim(), V = window.setTimeout(() => B(A), A ? 150 : 0);
    return () => window.clearTimeout(V);
  }, [P]);
  const [j, J] = M(0), Y = $(() => {
    I("search"), J((A) => A + 1);
  }, []);
  dd(Y);
  const Q = $((A) => {
    e.jumpToAnchor({ block_id: A }), Ue() < 900 && I(null);
  }, [e.jumpToAnchor]), oe = $((A) => e.jumpToAnchor({ block_id: A }), [e.jumpToAnchor]), ne = Ed({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), se = ne.select, ae = $((A) => {
    se(A), c("edit");
  }, [se]);
  Id(ne.available ? ae : null, z);
  const he = G(() => {
    if (!ne.savedCounts.size) return e.revisedBlocks;
    const A = new Map(e.revisedBlocks);
    for (const [V, pe] of ne.savedCounts) A.set(V, (A.get(V) || 0) + pe);
    return A;
  }, [e.revisedBlocks, ne.savedCounts]), q = G(() => ({
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
    jumpToBlock: oe,
    revisedBlocks: he,
    editBlock: ne.available ? ae : void 0,
    pendingEdits: ne.pendingEdits,
    findTerm: D === "search" ? F : "",
    sourceOnly: e.sourceOnly,
    sourceViewOnly: w,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: O, close: v }
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
    oe,
    he,
    ne.available,
    ne.pendingEdits,
    ae,
    D,
    F,
    e.sourceOnly,
    w,
    e.download,
    e.goToPage,
    O,
    v
  ]), ee = G(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), we = [
    us,
    `is-workspace-${S}`,
    f ? "is-assistant-open" : "",
    D ? "is-finder-open" : "",
    y.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ b(tc, { value: q, hud: ee, children: /* @__PURE__ */ C("div", { className: we, "data-reader-engine": "react-pdf", "data-reader-workspace": S, children: [
    /* @__PURE__ */ b(Ll, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
    /* @__PURE__ */ b(sd, { open: D, onToggle: T }),
    D ? /* @__PURE__ */ b(
      id,
      {
        tab: D,
        onTab: I,
        onClose: () => I(null),
        onJump: Q,
        query: P,
        onQuery: E,
        term: F,
        focusSignal: j
      }
    ) : null,
    /* @__PURE__ */ C("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ b(Uc, { active: s }),
      /* @__PURE__ */ b(Bl, {}),
      /* @__PURE__ */ b(_i, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ b(
      $c,
      {
        mode: g,
        documentReady: !!o.jobId,
        sourceViewOnly: w,
        onModeChange: k,
        liveTranslation: p.topBarPill ? {
          visible: i,
          state: e.liveTranslation,
          onToggle: () => l((A) => !A)
        } : null
      }
    ),
    /* @__PURE__ */ b(Hc, { active: s }),
    f ? /* @__PURE__ */ b(Nl, {}) : null,
    /* @__PURE__ */ b(xc, { paneComposition: y, markdownSplit: R.open, assistantSplit: f, liveTranslation: e.liveTranslation, sourcePaneAction: L }),
    e.showHud ? /* @__PURE__ */ b(
      Zl,
      {
        mode: g,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ C(jo, { fallback: null, children: [
      R.mounted ? /* @__PURE__ */ b(Ld, { open: R.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: v }) : null,
      m.mounted ? /* @__PURE__ */ b(_d, { open: m.open, onClose: v, edit: ne, regions: o.regions, jumpToBlock: oe }) : null
    ] }),
    /* @__PURE__ */ b(ed, {})
  ] }) });
}
function eu() {
  return /* @__PURE__ */ b(xd, {});
}
export {
  eu as R,
  xd as a,
  Ml as b,
  Xd as d,
  Yd as f,
  Qd as r,
  $e as u
};
//# sourceMappingURL=ReaderApp-CiCYEYqe.js.map
