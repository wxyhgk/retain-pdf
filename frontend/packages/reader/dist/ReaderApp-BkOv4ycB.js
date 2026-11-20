var Wn = (e) => {
  throw TypeError(e);
};
var Vn = (e, t, n) => t.has(e) || Wn("Cannot " + n);
var ut = (e, t, n) => (Vn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Jn = (e, t, n) => t.has(e) ? Wn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Kn = (e, t, n, r) => (Vn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as F, jsx as g, Fragment as lt } from "react/jsx-runtime";
import { useMemo as G, useState as _, useEffect as $, useCallback as B, useRef as N, useLayoutEffect as Re, memo as Jt, createContext as Sn, useContext as Rn, forwardRef as jo, useImperativeHandle as En, useSyncExternalStore as Fr, useId as $r, Suspense as Uo, lazy as Ho } from "react";
import { requireAdapter as dt, getReaderAdapters as Ee } from "./adapters.js";
import { resolveReaderDownloadName as Wo, resolveReaderDownloadUrls as Vo, READER_PROGRESS_COPY as _e, trimString as Ft, READER_DOWNLOAD_ACTIONS as Jo, disabledReason as Ko } from "./runtime/state.js";
import { r as qo, b as Go } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as an, isFinishedJobStatus as yt } from "@retainpdf/domain/job";
import { n as Zo, d as Yo, f as Zt, k as qn, b as Xo, c as Qo, j as Pt, p as In, g as ea, l as Gn, i as ta } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as na } from "@retainpdf/api/documents";
import { isReaderTransportError as ra, createReaderTransportError as oa } from "./contracts.js";
import { toast as sn, Toaster as aa } from "sonner";
import { X as Pn, ChevronUp as sa, ChevronDown as Br, History as ia, Radio as ca, FileText as jr, Columns2 as Ur, Languages as Hr, FileCode2 as la, Keyboard as da, Download as ua, ListOrdered as fa, ListTree as ma, Search as ha } from "lucide-react";
import { Button as ge, Textarea as pa, IconButton as Zn, Input as Wr } from "@retainpdf/ui";
import { pdfjs as Vr, Page as ga, Document as ba } from "react-pdf";
import { e as ya, m as va, a as wa } from "./markdown-math-XkF5urpn.js";
const Sa = (...e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ra = "", Ea = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Ia = (e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, hu = (...e) => {
  var n;
  return (((n = Ee()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Ne = () => dt("defaultReaderDataPort"), Yn = () => dt("defaultReaderPageConfigPort"), pu = {
  get apiPrefix() {
    return Ne().apiPrefix;
  },
  fetchProtected: (...e) => Ne().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ne().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ne().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ne().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ne().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ne().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ne().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ne().liveTranslation;
  }
}, Jr = {
  messageTargetOrigin: () => Yn().messageTargetOrigin(),
  readerJobId: () => Yn().readerJobId()
}, Pa = () => {
  var e;
  return ((e = Ee()) == null ? void 0 : e.liveTranslation) ?? null;
}, vt = () => {
  var t;
  const e = Ee();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Tt = () => {
  const e = Ee();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => dt("fetchDocumentByJobId")(...n),
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
}, Ta = (...e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ka = () => {
  var e, t;
  return ((t = (e = Ee()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Ma = (...e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Aa = (...e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Wo(...e);
}, _a = (...e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Vo(...e);
}, Na = (...e) => dt("downloadProtectedResource")(...e), La = (...e) => dt("failDownloadToast")(...e), gu = (e, t) => dt("resolveMarkdownAssetUrl")(e, t), Xn = "/api/v1";
function Da() {
  const e = () => {
    var r;
    return qo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = _(e);
  return $(() => {
    var i, c, l, d;
    const r = () => n(e()), o = (c = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : c.bind(globalThis.history), a = (d = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : d.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const u = (f) => function(...m) {
          const b = f.apply(this, m);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), b;
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
function Ca() {
  const e = Da(), t = G(() => Ma(Jr), [e]), n = G(() => ka(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function xa(e) {
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
  }), [d, u] = _({
    documentId: "",
    jobId: ""
  }), f = c.documentId === t ? c.jobId : "", m = d.documentId === t ? d.jobId : "", b = n || f, [h, S] = _({
    jobId: "",
    documentId: ""
  }), y = h.jobId === b ? h.documentId : "", w = t || y, E = !!t && !b, [p, v] = _(null), I = (p == null ? void 0 : p.sessionIdentity) === r && p.documentId === w ? p : null, k = E || !!I, x = B((O) => {
    const R = `${O.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      S({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const P = `${O.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: R,
      revision: P,
      sessionIdentity: o.current
    }), i();
  }, []);
  $(() => {
    v((O) => O && O.sessionIdentity !== r ? null : O);
  }, [r]);
  const L = B((O) => {
    switch (O.type) {
      case "resolved-document-job":
        l({ documentId: O.documentId, jobId: O.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        u({ documentId: O.documentId, jobId: O.jobId });
        break;
      case "resolved-job-document":
        S((R) => R.jobId === O.jobId && R.documentId === O.documentId ? R : { jobId: O.jobId, documentId: O.documentId });
        break;
      case "committed-source":
        v({
          documentId: O.documentId,
          revision: O.revision,
          sessionIdentity: O.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: c,
    setResolvedDocumentJob: l,
    missingDocumentJob: d,
    setMissingDocumentJob: u,
    documentJobId: f,
    rejectedDocumentJobId: m,
    sessionJobId: b,
    resolvedJobDocument: h,
    setResolvedJobDocument: S,
    jobDocumentId: y,
    documentId: w,
    sourceOnly: E,
    committedDocumentSource: p,
    setCommittedDocumentSource: v,
    activeCommittedDocumentSource: I,
    sourceViewOnly: k,
    refreshCommittedDocument: x,
    applyIdentityEvent: L
  };
}
function Qn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function za(e) {
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
function er(e, t) {
  return Ia(an(e, t));
}
function Oa(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Fa(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Oa(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function cn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Ea.progress,
        stage: n,
        percent: e,
        text: t
      },
      Jr.messageTargetOrigin()
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
  }), cn({ percent: t, text: n, stage: r });
}
function $a(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = _(null), [l, d] = _(null), [u, f] = _(""), [m, b] = _(0), h = u === n ? i : null, S = u === n ? l : null, y = Qn(h), w = yt(y), E = B(() => {
    b((L) => L + 1);
  }, []), p = B((L) => {
    c(L.jobPayload), d(L.manifestPayload), f(L.sessionIdentity);
  }, []), v = B((L) => {
    c(null), d(null), f(L);
  }, []), I = N(""), k = N(""), x = B(async () => {
    const L = o.current;
    if (!L || I.current === L) return;
    const O = Tt().loadJobPayload;
    if (typeof O != "function") return;
    const R = a.current.value;
    I.current = L;
    try {
      const P = await O(L);
      if (s.current || a.current.value !== R || o.current !== L || !P || typeof P != "object")
        return;
      const T = Qn(P);
      c(P), f(r.current), !yt(T) && k.current === L && (k.current = ""), T === "succeeded" && k.current !== L && (k.current = L, b((M) => M + 1));
    } catch {
    } finally {
      I.current === L && (I.current = "");
    }
  }, []);
  return $(() => {
    k.current = "";
  }, [n]), $(() => {
    if (!t || w || !h) return;
    const L = window.setInterval(() => {
      document.visibilityState !== "hidden" && x();
    }, 1e3);
    return () => window.clearInterval(L);
  }, [w, x, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: d,
    payloadSessionIdentity: u,
    setPayloadSessionIdentity: f,
    scopedJobPayload: h,
    scopedManifestPayload: S,
    jobStatus: y,
    jobTerminal: w,
    jobRefreshRevision: m,
    refreshJobArtifacts: E,
    refreshJobStatus: x,
    publishPayload: p,
    clearPayload: v
  };
}
function ln(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ba(e, t) {
  e(t), ln(t);
}
function ja(e) {
  const [t, n] = _(e ? "source" : "compare"), r = B((a) => {
    e && a !== "source" || (n(a), ln(a));
  }, [e]), o = B((a) => {
    Ba(n, a);
  }, []);
  return $(() => (e && document.documentElement.classList.add("reader-source-only"), ln(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function tr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ua(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: tr(n.active_job_id),
    activeVersionId: tr(n.active_version_id)
  };
}
function Ha(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Wa(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Va(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ja = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ka(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ja.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const qa = 48 * 1024 * 1024;
function Ga(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Za = 2, ve = /* @__PURE__ */ new Map();
function dn(e, t) {
  ve.delete(e), ve.set(e, t);
}
function nr(e) {
  if (ve.size < Za) return;
  const t = ve.keys().next().value;
  t && ve.delete(t);
}
async function Ya(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Kr(e, t = vt().fetchProtected, n = {}) {
  var d, u, f, m, b, h, S, y, w;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ve.has(r)) {
    const E = ve.get(r);
    return dn(r, E), E;
  }
  const o = new AbortController(), a = () => o.abort();
  (d = n.signal) != null && d.aborted && o.abort(), (f = (u = n.signal) == null ? void 0 : u.addEventListener) == null || f.call(u, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (b = (m = n.signal) == null ? void 0 : m.removeEventListener) == null || b.call(m, "abort", a);
  }
  if (!s.ok) {
    const E = new Error(`读取 PDF 失败 (${s.status})`);
    E.status = s.status;
    const p = await Ya(s);
    throw p && (E.reason = p), E;
  }
  const i = Xa(r, s, t);
  if (i) {
    o.abort();
    const E = { ranged: i };
    return nr(), ve.set(r, E), E;
  }
  (S = (h = n.signal) == null ? void 0 : h.addEventListener) == null || S.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (w = (y = n.signal) == null ? void 0 : y.removeEventListener) == null || w.call(y, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return ve.has(r) ? dn(r, l) : (nr(), ve.set(r, l)), l;
}
function Xa(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < qa ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Qa = { file: null, loading: !1, error: "" }, es = { file: null, loading: !0, error: "" };
function ts(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if ($(() => {
    if (t || !n) return;
    const s = ve.get(n);
    if (s) {
      dn(n, s);
      return;
    }
    const i = new AbortController();
    return Kr(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Qa;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = ve.get(n);
  return a ? { file: a, loading: !1, error: "" } : es;
}
function ns(e) {
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
async function un(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  $t(s, r, n, "download");
  const i = await Kr(t, vt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : ($t(s, o, n, "download"), i);
}
async function rs(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  $t(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    un({
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
    un({
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
function os(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function as({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = na,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(os(o.href, t, a)), !0);
}
const Nt = {
  regions: null,
  metadata: null
};
function ss(e) {
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
    publishPayload: u,
    clearPayload: f,
    switchSessionMode: m,
    jobRefreshRevision: b,
    sessionEpochRef: h,
    closingRef: S,
    activeLoadAbortRef: y
  } = e, [w, E] = _(""), [p, v] = _(""), [I, k] = _(null), [x, L] = _(null), [O, R] = _(!1), [P, T] = _(""), [M, A] = _([]), [j, z] = _(!1), [J, oe] = _(() => ({
    source: null,
    translated: null
  })), [q, Q] = _(
    Nt
  ), [me, ae] = _({
    loading: !0,
    percent: 4,
    text: _e.boot,
    stage: "progress",
    failed: !1
  });
  return $(() => {
    const se = new AbortController(), ye = h.current.value, V = ns({
      sessionEpochRef: h,
      closingRef: S,
      abort: se,
      sessionEpoch: ye
    });
    y.current = se;
    const ee = Tt();
    if (S.current)
      return se.abort(), () => {
        y.current === se && (y.current = null);
      };
    let fe = !1;
    function U(C, X) {
      V.markFailed(), z(!0), ae({
        loading: !1,
        percent: 100,
        text: C,
        stage: "failed",
        failed: !0
      }), cn({ percent: 100, text: X, stage: "failed" });
    }
    function Y() {
      R(!0), fe || z(!0), ae({
        loading: !1,
        percent: 100,
        text: _e.ready,
        stage: "ready",
        failed: !1
      }), cn({ percent: 100, text: _e.ready, stage: "ready" });
    }
    function He() {
      return l != null && l.documentId ? er(
        l.documentId,
        l.revision
      ) : Sa() ? Ra : ee.resolveResourceUrl(an(r));
    }
    async function Ce() {
      var le;
      let C = { activeJobId: "", activeVersionId: "" };
      try {
        const de = await ((le = ee.fetchDocument) == null ? void 0 : le.call(ee, r));
        de && (C = Ua(de));
      } catch {
      }
      const X = Ha({
        link: C,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (X.kind === "follow-active-job") {
        if (V.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: X.jobId
        }), X.activeVersionId ? (l || d({
          type: "committed-source",
          documentId: r,
          revision: X.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (X.kind === "open-committed-source") {
        if (V.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: X.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ue = He();
      if (V.isInactive()) return;
      E(ue), v(""), T(""), f(c);
      const ce = await un({
        url: ue,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: V,
        setBoot: ae
      });
      if (!V.isInactive()) {
        if (!ce) {
          U("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        k(ce), Y();
      }
    }
    async function xe() {
      var K;
      const C = !l, X = !!(C && ee.loadSessionSnapshot && ee.loadReaderOptionalArtifacts), ue = X ? ee.loadReaderOptionalArtifacts(t) : null, ce = await ((K = ee.loadSessionSnapshot) == null ? void 0 : K.call(ee, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: C && !X
      })), le = ce ? {
        jobPayload: ce.sourcePayload,
        manifestPayload: ce.manifestPayload,
        readerMetadata: ce.readerMetadata,
        regionsPayload: ce.regions,
        readerErrors: ce.readerErrors
      } : await ee.loadReaderPayload(t, {
        includeOptionalArtifacts: C
      });
      if (V.isInactive()) return;
      let de = null;
      if (n && !r)
        if (ce && ce.linkedDocument !== void 0)
          de = ce.linkedDocument;
        else {
          try {
            de = await ee.fetchDocumentByJobId(Xn, t);
          } catch {
          }
          if (V.isInactive()) return;
        }
      const we = za(le.jobPayload) || `${(de == null ? void 0 : de.document_id) || ""}`.trim();
      we && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: we
      });
      const Ae = Wa({
        payloadDocumentId: we,
        linkedActiveJobId: `${(de == null ? void 0 : de.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(de == null ? void 0 : de.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ae.kind === "restore-committed-source") {
        if (V.isInactive()) return;
        d({
          type: "committed-source",
          documentId: Ae.documentId,
          revision: Ae.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Ie = ee.resolveReaderSourcePdf(le.manifestPayload), Qe = ee.resolveReaderTranslatedPdfUrl(le.jobPayload, le.manifestPayload), Gt = typeof Ie == "string" ? Ie : ee.resolveReaderArtifactUrl(Ie), ze = r || we, Oe = l != null && l.documentId ? er(
        l.documentId,
        l.revision
      ) : Gt || (ze ? ee.resolveResourceUrl(an(ze)) : ""), We = l ? "" : Qe || "";
      E(Oe || ""), v(We), T(Fa(le.jobPayload, t)), u({
        jobPayload: le.jobPayload || null,
        manifestPayload: le.manifestPayload || null,
        sessionIdentity: c
      });
      const Mt = () => rs({
        sourceFinal: Oe || "",
        translatedFinal: We,
        fence: V,
        setBoot: ae
      }), At = !!(Oe || We), et = ue && At ? Mt() : null;
      et == null || et.catch(() => {
      });
      const _t = (W) => {
        V.isInactive() || (A(l ? [] : Zo(W.regionsPayload)), oe(l ? { source: null, translated: null } : Yo(W.readerMetadata)), Q(l ? Nt : W.readerErrors ?? Nt), z(!0));
      };
      if (ue ? (fe = !0, ue.then(_t)) : _t(le), !At) {
        U(_e.failed, _e.failed);
        return;
      }
      const D = await (et ?? Mt());
      if (D.status !== "inactive") {
        if (D.status === "incomplete") {
          U("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        k(D.sourceBytes), L(D.translatedBytes), Y();
      }
    }
    async function Me() {
      R(!1), k(null), L(null), A([]), z(!1), oe({ source: null, translated: null }), Q(Nt), $t(ae, 8, _e.metadata, "metadata");
      try {
        if (s) {
          await Ce();
          return;
        }
        if (!t) {
          U(_e.failed, _e.failed);
          return;
        }
        await xe();
      } catch (C) {
        if (V.isClosedOrStale() || (C == null ? void 0 : C.name) === "AbortError") return;
        V.markFailed();
        const X = Number(C == null ? void 0 : C.status), ue = `${(C == null ? void 0 : C.reason) || ""}`, ce = Ka({ status: X, reason: ue, sessionJobId: t });
        if (ce && (await as({
          apiPrefix: Xn,
          documentId: ce,
          expiredJobId: t
        }) || V.isClosedOrStale()))
          return;
        if (Va({
          status: X,
          reason: ue,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const le = C instanceof Error ? C.message : _e.failed;
        U(le, le);
      }
    }
    return Me(), () => {
      se.abort(), y.current === se && (y.current = null);
    };
  }, [t, r, o, a, s, i, l, b, n, c, d, u, f, m]), {
    sourceUrl: w,
    translatedUrl: p,
    sourceFile: I,
    translatedFile: x,
    assetsReady: O,
    title: P,
    regions: M,
    regionsSettled: j,
    readerMetadata: J,
    readerErrors: q,
    boot: me
  };
}
function is() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ca(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), c = N(""), l = N(""), d = N(() => {
  }), u = B(() => d.current(), []), f = xa({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: u
  }), {
    sessionJobId: m,
    documentId: b,
    sourceOnly: h,
    sourceViewOnly: S
  } = f, { mode: y, setMode: w, switchSessionMode: E } = ja(S);
  d.current = () => {
    E("source");
  }, i.current = a, c.current = b, l.current = m;
  const p = $a({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: v,
    scopedManifestPayload: I,
    jobStatus: k,
    jobTerminal: x,
    jobRefreshRevision: L,
    refreshJobArtifacts: O,
    refreshJobStatus: R
  } = p, P = ss({
    sessionJobId: m,
    jobId: r,
    routeDocumentId: o,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: a,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: p.publishPayload,
    clearPayload: p.clearPayload,
    switchSessionMode: E,
    jobRefreshRevision: L,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = B(() => {
    var A;
    e.current = !0, (A = t.current) == null || A.abort();
  }, []), M = G(
    () => ({
      fetchProtected: Tt().fetchProtected,
      jobId: m,
      jobPayload: v,
      manifestPayload: I,
      sourceUrl: P.sourceUrl,
      translatedUrl: P.translatedUrl,
      sourceOnly: S
    }),
    [m, v, I, P.sourceUrl, P.translatedUrl, S]
  );
  return {
    jobId: m,
    jobStatus: k,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: x,
    documentId: b,
    sessionIdentity: a,
    sourceOnly: h,
    mode: y,
    setMode: w,
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
    refreshJobArtifacts: O,
    refreshJobStatus: R,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: T
  };
}
const cs = 160, ls = 8, ds = 0;
function us() {
  const e = N(null), [t, n] = _(null), [r, o] = _(ds), a = B((s) => {
    e.current = s, n(s);
  }, []);
  return $(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < cs || o((d) => Math.abs(d - l) < ls ? d : l);
    }, c = new ResizeObserver((l) => {
      var d, u;
      i(((u = (d = l[0]) == null ? void 0 : d.contentRect) == null ? void 0 : u.width) ?? s.clientWidth);
    });
    return c.observe(s), i(s.clientWidth), () => c.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function fs(e) {
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
const Yt = { source: 0, translated: 0 };
function ms(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, d = N(l);
  d.current = l;
  const [u, f] = _(() => ({
    identity: l,
    pages: Yt
  })), [m, b] = _(() => ({ identity: l, tick: 0 })), h = u.identity === l ? u.pages : Yt, S = m.identity === l ? m.tick : 0, y = fs({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: w } = y, E = B((R, P) => {
    d.current === l && f((T) => {
      const M = T.identity === l ? T.pages : Yt;
      return M[P] === R && T.identity === l ? T : {
        identity: l,
        pages: { ...M, [P]: R }
      };
    });
  }, [l]), p = N(null), v = B(() => {
    p.current && clearTimeout(p.current);
    const R = l;
    p.current = setTimeout(() => {
      p.current = null, d.current === R && b((P) => ({
        identity: R,
        tick: P.identity === R ? P.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  $(() => (p.current && (clearTimeout(p.current), p.current = null), f((R) => R.identity === l && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: l, pages: { source: 0, translated: 0 } }), b((R) => R.identity === l && R.tick === 0 ? R : { identity: l, tick: 0 }), () => {
    p.current && (clearTimeout(p.current), p.current = null);
  }), [l]);
  const I = G(
    () => Math.max(h.source, h.translated),
    [h]
  ), k = w === "translated" ? h.translated : h.source || h.translated, x = t == null ? void 0 : t.userZoom, L = t == null ? void 0 : t.shellWidth, O = `${l}-${S}-${x}-${n}-${h.source}-${h.translated}-${L}`;
  return {
    ...y,
    numPagesByPane: h,
    hudNumPages: I,
    primaryNumPages: k,
    metricsTick: S,
    onNumPages: E,
    onMetrics: v,
    rowSyncRevision: O
  };
}
const je = "data-reader-page", it = "data-reader-pane", Tn = "data-natural-height", hs = "reader-react-root", ps = "reader-react-grid", gs = "reader-react-scroll-shell", bs = "reader-react-pdf-pane", qr = "reader-react-pdf-page", Bt = "reader-react-pdf-page-placeholder", kn = "reader-react-pdf-page-slot";
function jt(e, t) {
  const n = e != null ? `[${je}="${e}"]` : `[${je}]`;
  return t ? `${n}[${it}="${t}"]` : n;
}
function ys() {
  return `.${kn}[${je}]`;
}
function Ut(e) {
  return Number(e.getAttribute(je));
}
const Gr = 0.25, Ht = 1, vs = 0.05, kt = 0.5, ws = 16, Ss = 8, Rs = 720;
function Ke() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Zr(e) {
  return Number.isFinite(e) && e < Rs;
}
function rt(e, t = Number.POSITIVE_INFINITY) {
  return Zr(t) && (e === "source" || e === "translated") ? Ht : kt;
}
function Kt(e) {
  return Number.isFinite(e) ? Math.min(Ht, Math.max(Gr, e)) : kt;
}
function wt(e, t) {
  const n = Kt(Number(e) + t * vs);
  return Math.round(n * 100) / 100;
}
function Es(e) {
  return Math.round(Kt(e) * 100);
}
function Is(e) {
  const n = (Number(e) || 0) - ws - Ss;
  return Math.max(160, Math.floor(n));
}
function Ps(e, t = kt) {
  const n = Kt(t);
  return Is((Number(e) || 0) * n);
}
function Ts(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${it}]`)
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
const ks = 8;
function Ms(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < ks ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Yr = 200, Xr = [
  "markdown"
], As = Xr;
function Qr(e) {
  return As.includes(e);
}
const _s = "retainpdf:reader:view:v1:", rr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Ns = /* @__PURE__ */ new Set([
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
function fn(e) {
  return `${e || ""}`.trim();
}
function Ls({
  documentId: e,
  jobId: t
}) {
  const n = fn(e);
  if (n) return `document:${n}`;
  const r = fn(t);
  return r ? `job:${r}` : "";
}
function to(e) {
  const t = fn(e);
  return t ? `${_s}${t}` : "";
}
function Ds(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Cs(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!rr.has(t) || !rr.has(n) || t === n))
    return { left: t, right: n };
}
function xs(e) {
  return e === null ? null : Qr(e) ? e : void 0;
}
function zs(e) {
  return Ns.has(e) ? e : void 0;
}
function no(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Ds(t.anchor), r = Number(t.zoom), o = zs(t.mode), a = Cs(t.splitLayout), s = xs(t.assistantPanel);
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
function ke(e, t = eo()) {
  const n = to(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? no(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function qt(e, t, n = eo()) {
  const r = to(e);
  if (!r || !n) return null;
  const o = ke(e, n), a = no({
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
function Os(e, t, n = "") {
  var f;
  const [r, o] = _(() => {
    var m;
    return ((m = ke(n)) == null ? void 0 : m.zoom) ?? rt(e, Ke());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), c = N(((f = ke(n)) == null ? void 0 : f.zoom) !== void 0);
  $(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = ke(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const b = m ?? rt(e, Ke());
    i.current = 1, a.current = b, o(b);
  }, [e, n]), $(() => {
    if (c.current) return;
    const m = rt(e, Ke()), b = a.current;
    Math.abs(m - b) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = B((m) => {
    const b = Kt(m), h = a.current;
    Math.abs(b - h) < 5e-4 || (i.current = b / (h || 1), c.current = !0, qt(s.current, { zoom: b }), o(b));
  }, []), d = B((m) => {
    l(wt(a.current, m));
  }, [l]), u = B((m) => {
    l(rt(m));
  }, [l]);
  return Re(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Ts(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: d, resetZoom: u };
}
function Fs(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: B((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const Mn = 48;
function ro(e, t = Mn) {
  return e.getBoundingClientRect().top + t;
}
function oo(e, t) {
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
      const u = d.getBoundingClientRect();
      return u.height >= 8 && u.width >= 8;
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
  const s = ro(e, n), i = oo(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function St(e, t, n = "auto", r, o = Mn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(jt(a, r))), i || (i = e.querySelector(jt(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const d = l.height > 0 ? l.height : i.offsetHeight, u = e.scrollTop + (l.top - c.top), f = Math.max(0, u + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - f) >= 1 && (e.scrollTop = f) : e.scrollTo({ top: f, behavior: n }), !0;
}
function $s(e, t, n = "smooth", r) {
  return St(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function mn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var d;
    if (a) return;
    St(
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
function Bs(e, t, n) {
  return mn(
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
function Se(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function js(e, t, n = !0, r = "", o) {
  const [a, s] = _(1);
  return $(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, d = 0;
    const u = jt(void 0, o), f = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(u));
      if (!h.length)
        return;
      const S = ro(i), y = oo(h, S);
      y && s(y.page);
    }, m = () => {
      c || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, f();
      }));
    }, b = () => {
      if (c) return;
      if (!Array.from(i.querySelectorAll(u)).length) {
        l = setTimeout(b, 120);
        return;
      }
      f(), i.addEventListener("scroll", m, { passive: !0 });
    };
    return b(), () => {
      c = !0, l && clearTimeout(l), d && cancelAnimationFrame(d), i.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const Us = `canvas, .react-pdf__Page, .${qr}, .${Bt}`, or = /* @__PURE__ */ new WeakMap();
function Hs(e) {
  const t = Number(e.getAttribute(Tn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = or.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Us), or.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Ws(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Vs(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(ys()).forEach((r) => {
    const o = Ut(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Hs(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Js(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, Re(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, d = !1, u = !1;
    const f = () => {
      var v;
      if (c) return;
      const E = e.current;
      if (!E) return;
      const p = Vs(E);
      Ws(s.current, p) || (s.current = p, a(p)), d && !u && (u = !0, (v = i.current) == null || v.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    m();
    const b = window.setTimeout(m, 100), h = window.setTimeout(() => {
      d = !0, m();
    }, 300), S = window.setTimeout(m, 700), y = e.current;
    let w = null;
    return y && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => m()), w.observe(y)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(b), window.clearTimeout(h), window.clearTimeout(S), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const Ks = [0, 48, 140, 320, 560], qs = 700, Gs = [80, 200, 400], Zs = 500, Ys = 50, Xs = /* @__PURE__ */ new Set([
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
]), Qs = 180, ar = [0, 48, 140, 320, 700, 1200];
function ei(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((P = ke(a)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), c = N(null), l = N(!1), d = N(r), u = N(null), f = N(null), m = N(null), b = N(null), h = N(a), S = N(""), y = N(n);
  y.current = n;
  const w = B(() => {
    var T;
    (T = u.current) == null || T.call(u), u.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), E = B(() => {
    !l.current && c.current == null || (w(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [w]), p = B((T = !1) => {
    b.current != null && (clearTimeout(b.current), b.current = null);
    const M = () => {
      b.current = null, qt(h.current, {
        anchor: Se(i.current)
      });
    };
    T ? M() : b.current = setTimeout(M, Qs);
  }, []), v = B((T) => {
    i.current = Se(T), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Ys);
  }, []);
  $(() => {
    if (!o)
      return;
    let T = !1, M = null, A = null, j = null;
    const z = () => {
      if (T) return;
      const J = e.current;
      if (!J) {
        j = setTimeout(z, 50);
        return;
      }
      M = J, A = () => {
        if (l.current)
          return;
        const oe = zt(M, y.current);
        oe && (i.current = oe, p());
      }, M.addEventListener("scroll", A, { passive: !0 }), l.current || A();
    };
    return z(), () => {
      T = !0, j != null && clearTimeout(j), M && A && M.removeEventListener("scroll", A);
    };
  }, [o, r, n, e, p]), $(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const M = (A) => {
      A.metaKey || A.ctrlKey || A.altKey || Xs.has(A.key) && E();
    };
    return T.addEventListener("wheel", E, { passive: !0 }), T.addEventListener("touchmove", E, { passive: !0 }), window.addEventListener("keydown", M), () => {
      T.removeEventListener("wheel", E), T.removeEventListener("touchmove", E), window.removeEventListener("keydown", M);
    };
  }, [o, e, E]), Re(() => {
    var M;
    if (h.current === a) return;
    p(!0), w(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, S.current = "";
    const T = (M = ke(a)) == null ? void 0 : M.anchor;
    i.current = T ? Se(T) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, d.current = r;
  }, [a, r, p, w]), $(() => {
    var M;
    if (!o || !s || !a || S.current === a) return;
    S.current = a;
    const T = Se(
      ((M = ke(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = T, c.current = T, l.current = !0, w(), u.current = mn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: y.current,
        delaysMs: ar,
        onDone: () => v(T)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(T);
    }, Math.max(...ar) + 160), () => w();
  }, [o, s, a, e, v, w]), $(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      l.current = !1, c.current = null, w();
      return;
    }
    const T = c.current ? Se(c.current) : Se(i.current);
    return l.current = !0, c.current = T, i.current = T, w(), u.current = mn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ks,
        onDone: () => v(T)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(T);
    }, qs), () => {
      w();
    };
  }, [r, o, n, e, v, w]), $(() => () => {
    w(), m.current != null && (clearTimeout(m.current), m.current = null), p(!0);
  }, [w, p]);
  const I = B(() => {
    const T = zt(
      e.current,
      y.current
    );
    return Se(T || i.current);
  }, [e]), k = B(() => {
    l.current = !0;
    const T = zt(
      e.current,
      y.current
    ), M = Se(T ?? i.current);
    return i.current = M, c.current = M, p(), M;
  }, [e, p]), x = B((T, M, A) => {
    const j = A || y.current, z = Wt(T, M || 1), J = { page: z, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, p(), w(), $s(e.current, z, "smooth", j), u.current = Bs(
      () => e.current,
      z,
      {
        behavior: "auto",
        pane: j,
        delaysMs: Gs,
        onDone: () => v(J)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(J);
    }, Zs);
  }, [e, v, w, p]), L = B(() => Se(i.current), []), O = B(() => l.current, []), R = B(() => {
    if (!l.current || !c.current)
      return;
    const T = Se(c.current);
    St(
      e.current,
      T,
      "auto",
      y.current
    );
  }, [e]);
  return {
    lockFromShell: I,
    beginModeSwitch: k,
    goToPage: x,
    getAnchor: L,
    isRestoring: O,
    repinIfRestoring: R
  };
}
function ti(e, t) {
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
const ni = [0, 80, 200, 400, 800], ri = 120, oi = 400;
function ai(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: d = !0 } = e, u = N(a);
  u.current = a;
  const f = N(s);
  f.current = s;
  const m = N(i);
  m.current = i;
  const b = N(n);
  b.current = n, $(() => {
    var p, v;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Ta(), S = ti(h, f.current);
    if (S == null && (h != null && h.blockId) && !d) return;
    const y = ao(h, S, { jobId: c, documentId: l });
    if (t.current === y)
      return;
    if (S == null) {
      t.current = y, (p = b.current) == null || p.call(b);
      return;
    }
    t.current = y, h && ((v = m.current) == null || v.call(m, h, S));
    const w = [];
    let E = 0;
    for (const I of ni)
      E = Math.max(E, I), w.push(
        setTimeout(() => {
          u.current(S);
        }, I)
      );
    return w.push(
      setTimeout(() => {
        var I;
        (I = b.current) == null || I.call(b);
      }, E + ri)
    ), () => {
      for (const I of w) clearTimeout(I);
    };
  }, [r, o, c, l, t, d]);
}
function si(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function ii(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = oi,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, d = N(a);
  d.current = a;
  const u = N(l);
  u.current = l;
  const f = N(0);
  $(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const m = setTimeout(() => {
      var y;
      const b = ((y = globalThis.location) == null ? void 0 : y.search) || "", h = Go(b, o, d.current);
      if (f.current = o, h === null) return;
      const S = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = ao(
        { blockId: S },
        o,
        { jobId: i, documentId: c }
      ), (u.current || si)(h);
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
function ci(e) {
  const t = N(""), [n, r] = _(!1), o = B(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  ai(a, t, o), ii(e, t, n);
}
const ft = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function li(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function sr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function so(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = sr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = sr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function di(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = so(r, t, n);
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
function ui(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const ir = [250, 500, 1e3, 2e3, 4e3], Xt = [80, 160, 320, 640, 1e3, 1500], cr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function hn(e, t) {
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
  return ra(e) ? `${e.code || ""}`.trim() : "";
}
function Lt(e, t) {
  const n = An(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function fi(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (so(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = oa(
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
    const i = Xt[Math.min(s, Xt.length - 1)];
    if (await hn(i, r), s >= Xt.length + 2) throw a;
  }
}
function mi({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _(ft), s = N(o), i = N("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), d = yt(l) ? l : "";
  return $(() => {
    if (!n || !c) {
      i.current = "", s.current = ft, a(ft);
      return;
    }
    const u = r === void 0 ? Pa() : r, f = i.current === c;
    if (i.current = c, !u) {
      const E = {
        ...f ? s.current : ft,
        connection: d ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = E, a(E);
      return;
    }
    const m = new AbortController();
    let b = !1;
    const h = {
      ...f ? s.current : ft,
      connection: d ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const S = (E) => {
      m.signal.aborted || a((p) => {
        const v = E(p);
        return s.current = v, v;
      });
    }, y = async () => {
      let E = 0;
      for (; !m.signal.aborted; )
        try {
          const p = await u.fetchLayout(c, { signal: m.signal });
          b = !0, S((v) => ({
            ...v,
            layoutByPage: li(p),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError") return;
          const v = An(p);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            S((k) => ({
              ...k,
              connection: d ? "terminal" : "unavailable",
              jobStatus: l,
              error: Lt(p, "实时译文暂不可用")
            }));
            return;
          }
          if (d) {
            S((k) => ({
              ...k,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          S((k) => ({
            ...k,
            connection: "connecting",
            jobStatus: l,
            error: Lt(p, "正在等待 OCR 版面数据")
          })), await hn(ir[Math.min(E, ir.length - 1)], m.signal).catch(() => {
          }), E += 1;
        }
    };
    return (async () => {
      if (await y(), !b || m.signal.aborted) return;
      let E = 0;
      for (; !m.signal.aborted; ) {
        d || S((p) => ({
          ...p,
          connection: p.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: p.error
        }));
        try {
          await u.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (p) => {
              if (p.seq <= s.current.lastSeq) return;
              let v;
              try {
                v = await fi(
                  c,
                  p,
                  s.current,
                  m.signal,
                  u
                );
              } catch (I) {
                if ((I == null ? void 0 : I.name) === "AbortError" || m.signal.aborted) throw I;
                S((k) => ({
                  ...k,
                  lastSeq: Math.max(k.lastSeq, p.seq),
                  error: Lt(I, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              S((I) => {
                const k = di(I, p, v);
                return d ? {
                  ...k,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...k,
                  jobStatus: l
                };
              }), E = 0;
            }
          });
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError" || m.signal.aborted) return;
          S((v) => ({
            ...v,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: l,
            error: Lt(p, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (d) {
          S((p) => ({
            ...p,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await hn(cr[Math.min(E, cr.length - 1)], m.signal).catch(() => {
        }), E += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, d]), o;
}
function hi(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function pi(e, t = !0) {
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return $(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Tt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(hi(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const gi = 4500;
function bi(e) {
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
const yi = /* @__PURE__ */ new Set(["book", "translate"]);
function io(e) {
  return !!(e.jobId && e.sourceUrl && yi.has(e.workflow));
}
function vi(e) {
  return !!(io(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function wi() {
  const e = is(), t = io({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = vi({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !yt(o) && (r.current.running = !0);
  const a = mi({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = us(), d = pi(e.jobId, !e.sourceOnly), u = Ls({
    documentId: e.documentId,
    jobId: e.jobId
  }), f = `${u}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: b } = Os(e.mode, s, u), h = ms(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: m, shellWidth: c, identityKey: f }
  ), {
    beginModeSwitch: S,
    goToPage: y,
    repinIfRestoring: w
  } = ei(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: u,
    restoreReady: h.primaryNumPages > 0
  });
  $(() => {
    w();
  }, [c, w]);
  const E = Js(
    s,
    h.compareMode,
    h.rowSyncRevision,
    w
  ), p = js(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), v = B((z, J) => {
    var q, Q;
    const oe = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((q = h.numPagesByPane) == null ? void 0 : q.source) || 0,
      Number((Q = h.numPagesByPane) == null ? void 0 : Q.translated) || 0
    );
    y(z, oe, J);
  }, [y, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [I, k] = _(null), x = N(null), L = B((z) => {
    x.current && clearTimeout(x.current), k(z), z && (x.current = setTimeout(() => k(null), gi));
  }, []);
  $(() => () => {
    x.current && clearTimeout(x.current);
  }, []);
  const O = B((z) => {
    const J = Zt(e.regions, z);
    return J ? qn(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), R = B((z, J) => {
    const oe = J || h.primaryPane, q = typeof z == "object" && z ? `${z.block_id || ""}`.trim() : "", Q = typeof z == "object" && z ? `${z.image_url || ""}`.trim() : "", me = typeof z == "object" && z ? z.page_idx != null ? Number(z.page_idx) + 1 : z.page != null ? Number(z.page) : null : typeof z == "number" ? z + 1 : null, ae = Xo(e.regions, Q, me) || Zt(e.regions, q) || (typeof z == "object" ? Qo(e.regions, z) : null);
    let se = ae ? qn(ae, oe).page : null;
    se == null && (se = bi(z)), !(se == null || se < 1) && (L(ae), v(se, oe));
  }, [L, v, h.primaryPane, e.regions]);
  ci({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: p,
    goToPage: v,
    resolveBlockPage: O,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (z) => {
      L(Zt(e.regions, z.blockId));
    }
  });
  const { setModeKeepingPage: P } = Fs({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: S
  });
  $(() => {
    L(null);
  }, [f, L]);
  const T = !e.boot.loading && !e.boot.failed, M = G(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), A = G(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), j = G(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: b,
    shell: M,
    panes: h,
    sessionFiles: A,
    rowHeights: E,
    goToPage: v,
    activeRegion: I,
    jumpToAnchor: R,
    setModeKeepingPage: P,
    download: e.download,
    showHud: T,
    viewStateKey: u,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, M, h, A, E, v, I, R, P, T, m, b, u, a, n, d]);
  return G(() => ({
    ...j,
    currentPage: p
  }), [j, p]);
}
const Si = [
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
], Ri = [
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
function Ei(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Si)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Ii(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Pi = ".reader-notes-panel";
function Ti(e) {
  return e instanceof Element ? !!e.closest(Pi) : !1;
}
function ki(e) {
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
  $(() => {
    if (!l)
      return;
    const d = (u) => {
      if (u.defaultPrevented || u.metaKey || u.ctrlKey || u.altKey || Ii(u.target) || Ti(u.target))
        return;
      const f = u.key, m = Ei(f);
      if (m) {
        if (m.mode) {
          if (n && m.mode !== "source")
            return;
          u.preventDefault(), r(m.mode);
          return;
        }
        if (!(m.requiresPages && i <= 0))
          switch (u.preventDefault(), m.action) {
            case "zoom-in":
              a(wt(o, 1));
              return;
            case "zoom-out":
              a(wt(o, -1));
              return;
            case "zoom-reset":
              a(rt(t, Ke()));
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
const Mi = "retainpdf:soft-reader-close";
function Ai() {
  return new URL("./index.html", window.location.href).href;
}
function _i() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Mi },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ni(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Li() {
  if (!(typeof window > "u") && !_i()) {
    if (Ni(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Ai());
  }
}
function Di({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ g("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ci({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ F(Di, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Li();
  }, children: [
    /* @__PURE__ */ g(Pn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ g("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let lr = !1;
function xi() {
  if (lr)
    return;
  const e = vt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Vr.GlobalWorkerOptions.workerSrc = e, lr = !0);
}
const zi = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Oi(e, t, n) {
  return e.flatMap((r) => {
    if (!zi.has(Pt(r.region))) return [];
    const o = In(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function dr(e, t, n) {
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
async function Fi(e) {
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
const $i = "reader-text-hover-copy", Bi = "reader-text-hover-edit", ji = "reader-text-hover-id";
function Ui(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const co = "reader-text-hover-tools";
function Qt({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ g(
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
function Hi({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a
}) {
  const [s, i] = _("idle"), [c, l] = _("idle"), [d] = _(() => Ui()), u = N([]), f = (e == null ? void 0 : e.itemId) || "";
  if ($(() => {
    i("idle"), l("idle");
    const E = u.current;
    return () => {
      E.forEach((p) => window.clearTimeout(p)), u.current = [];
    };
  }, [f]), !e) return null;
  const m = ea(e.highlight.region, t), b = Pt(e.highlight.region), h = (E, p) => async (v) => {
    v.preventDefault(), v.stopPropagation();
    const I = await Fi(E);
    p(I ? "copied" : "failed"), u.current.push(window.setTimeout(() => p("idle"), 1200));
  }, S = b === "formula" ? "复制 LaTeX" : "复制", y = o || e.rect, w = a || (fo(y) ? "outside" : "inside");
  return /* @__PURE__ */ g("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ g(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": b,
      style: y,
      children: /* @__PURE__ */ F(
        "div",
        {
          className: co,
          "data-placement": w,
          children: [
            d ? /* @__PURE__ */ g(
              Qt,
              {
                className: ji,
                state: c,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: h(e.itemId, l),
                children: c === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && n > 0 ? /* @__PURE__ */ F("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            t === "translated" && r ? /* @__PURE__ */ g(
              Qt,
              {
                className: Bi,
                state: "idle",
                label: "改这段译文",
                title: "改这段译文（E）",
                onClick: (E) => {
                  E.preventDefault(), E.stopPropagation(), r(e.itemId);
                },
                children: "改"
              }
            ) : null,
            m ? /* @__PURE__ */ g(
              Qt,
              {
                className: $i,
                state: s,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: h(m, i),
                children: s === "copied" ? "已复制" : s === "failed" ? "复制失败" : S
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Wi(e, t) {
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
function Vi(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = In(
      Wi(e, a),
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
const Ji = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Ki = 256, mt = /* @__PURE__ */ new Map();
function qi(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function mo(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ya(t, { bareLatex: !0 }), o = qi(n), a = va(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = mt.get(t);
  if (!s && (s = wa(o, r), mt.set(t, s), mt.size > Ki)) {
    const i = mt.keys().next().value;
    i !== void 0 && mt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function en(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Le(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Gi(e, t) {
  const n = e.typography, r = Le(t) || 1, o = Le(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = en(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Le(n == null ? void 0 : n.fit_min_font_size_pt), d = Le(n == null ? void 0 : n.fit_max_font_size_pt), u = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    u,
    d ? d * r : o ? o * r : c
  ), m = o ? o * r : c, b = Le(n == null ? void 0 : n.leading_em), h = [
    Le(n == null ? void 0 : n.padding_top_pt) || 0,
    Le(n == null ? void 0 : n.padding_right_pt) || 0,
    Le(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Le(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((S) => S * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Ji,
    fontSizePx: Math.max(u, Math.min(f, m)),
    minFontSizePx: u,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: b ? 1 + b : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (en(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : en(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Zi(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (u) => {
    const f = s.get(u);
    if (f !== void 0) return f;
    const { width: m, height: b } = e(u), h = m <= t + 0.5 && b <= n + 0.5;
    return s.set(u, h), h;
  };
  let c = o, l = a, d = Math.min(r.requestedFontSizePx, l);
  if (i(d)) {
    if (!r.exact) {
      c = d;
      for (let u = 0; u < 6 && l > c; u += 1) {
        const f = (c + l) / 2;
        i(f) ? (d = f, c = f) : l = f;
      }
    }
  } else {
    l = d, d = c;
    for (let u = 0; u < 8 && l > c; u += 1) {
      const f = (c + l) / 2;
      i(f) ? (d = f, c = f) : l = f;
    }
  }
  return Math.max(o, d);
}
const Yi = 512, ht = /* @__PURE__ */ new Map();
let pn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  pn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  pn += 1;
}));
function Xi(e, t, n, r) {
  return [
    pn,
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
function ho({ item: e, pageScale: t }) {
  const n = N(null), r = G(
    () => mo(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = G(
    () => Gi(e, t),
    [e, t]
  );
  $(() => {
    let u = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      u && a(f);
    }), () => {
      u = !1;
    };
  }, [r]), Re(() => {
    const u = n.current;
    if (!u) return;
    const [f, m, b, h] = s.padding, S = Math.max(1, e.rect.width - h - m), y = Math.max(1, e.rect.height - f - b), w = Xi(o, S, y, s);
    let E = ht.get(w);
    if (E === void 0 && (E = Zi(
      (p) => (u.style.fontSize = `${p}px`, { width: u.scrollWidth, height: u.scrollHeight }),
      S,
      y,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), ht.set(w, E), ht.size > Yi)) {
      const p = ht.keys().next().value;
      p !== void 0 && ht.delete(p);
    }
    u.style.fontSize = `${E.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, c, l, d] = s.padding;
  return /* @__PURE__ */ g(
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
      children: /* @__PURE__ */ g(
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
function Qi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = G(
    () => Vi(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ g(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ g(
        ho,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const ec = Jt(Qi);
function tc({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ g("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ F("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ g(
        ho,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Pt(a.highlight.region),
            sourceText: a.highlight.box.text || "",
            rect: a.rect,
            changedAtSeq: 0,
            changedNow: !1
          },
          pageScale: s > 0 ? n / s : 1
        }
      ),
      /* @__PURE__ */ g("span", { className: "reader-edited-badge", style: { left: a.rect.left, top: a.rect.top }, children: "待排版" })
    ] }, a.itemId);
  }) }) : null;
}
const nc = Jt(tc);
function rc(e) {
  return e === "formula" ? 84 : 64;
}
const oc = 6, Je = (e) => e.left + e.width, gt = (e) => e.top + e.height, ac = (e, t) => e.top < gt(t) && t.top < gt(e);
function sc(e, t, n, r) {
  const o = r + oc;
  let a = n, s = 0;
  for (const i of t)
    i === e || !ac(e, i) || (i.left >= Je(e) - 1 && (a = Math.min(a, i.left)), Je(i) <= e.left + 1 && (s = Math.max(s, Je(i))));
  return a - Je(e) >= o ? "side-right" : e.left - s >= o ? "side-left" : fo(e, r) ? "outside" : "inside";
}
function ic(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const d = l.left + l.width / 2, u = l.top + l.height / 2;
    d < e.left || d > Je(e) || u < e.top || u > gt(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, Je(l)), i = Math.max(i, gt(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(Je(e) + r, s + n) - c.left, c.height = Math.min(gt(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function cc(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function lc(e, t, n, r, o) {
  const [a, s] = _(null);
  return Re(() => {
    if (!t) {
      s(null);
      return;
    }
    const i = e.current, c = i ? ic(t.rect, cc(i)) : t.rect, l = sc(t.rect, n.map((d) => d.rect), r, rc(o));
    s({ rect: c, placement: l });
  }, [e, o, r, t, n]), a && t ? a : null;
}
function ie(e) {
  return typeof e == "string" ? e : "";
}
function dc(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function uc(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function fc(e) {
  return {
    source: ie(e == null ? void 0 : e.source_text) || ie(e == null ? void 0 : e.unit_source_text),
    translated: ie(e == null ? void 0 : e.protected_translated_text) || ie(e == null ? void 0 : e.translated_text)
  };
}
const mc = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function po(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function hc(e) {
  const t = po(e).sort((r, o) => ie(r.ts).localeCompare(ie(o.ts)));
  return t.length ? [
    { text: ie(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ie(r.new_text),
      label: mc[ie(r.source)] || ie(r.source) || "修订",
      ts: ie(r.ts),
      reason: ie(r.reason)
    }))
  ].reverse() : [];
}
function pc(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function gc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ie(r.finished_at) || ie(n.finished_at) || "";
}
function bc(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = po(e).sort((a, s) => ie(a.ts).localeCompare(ie(s.ts)));
  for (const a of o) {
    const s = new Date(ie(a.ts)).getTime(), i = ie(a.reader_item_id) || ie(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ie(a.new_text));
  }
  return n;
}
const yc = {
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
function vc(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = yc[ie(n.kind)] || ie(n.kind) || "问题", o = ie(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const wc = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Sc(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !wc.has(Pt(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Rc = 300, Ec = 72;
function Ic(e, t) {
  if (e.width >= Rc && e.height >= Ec)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
function Pc({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = _(null), [i, c] = _(!1), [l, d] = _([]), [u, f] = _(""), [m, b] = _(""), [h, S] = _(!1), [y, w] = _(null), [E, p] = _([]), v = r.drafts, I = r.generation, k = B(async (R, P) => {
    if (e)
      try {
        d(hc(await e.fetchRevisions(R, P)));
      } catch {
        d([]);
      }
  }, [e]);
  $(() => {
    if (s(null), d([]), w(null), p([]), b(""), !e || !t || !n) return;
    let R = !1;
    return c(!0), e.loadItem(t, n).then((P) => {
      if (R) return;
      const T = P == null ? void 0 : P.item;
      if (!T) throw new Error("找不到这一段的译文。");
      const M = `${(P == null ? void 0 : P.item_id) || n}`, { source: A, translated: j } = fc(T);
      s({ readerItemId: n, itemId: M, source: A, current: j }), f(v.get(n) ?? j);
    }).catch((P) => {
      R || w({ tone: "error", message: (P == null ? void 0 : P.message) || "读取这段译文失败。" });
    }).finally(() => {
      R || c(!1);
    }), k(t, n), () => {
      R = !0;
    };
  }, [e, t, n, k]);
  const x = B((R) => {
    f(R), n && v.set(n, R);
  }, [n, v]), L = B(async (R, P) => {
    if (!e || !a || h) return !1;
    const T = R ?? u;
    if (!T.trim()) return !1;
    S(!0), w(null), p([]);
    try {
      const M = await e.revise(t, a.itemId, {
        translated_text: T,
        source: "user",
        reason: (P ?? m).trim() || "在阅读页手动修改",
        ...I.current != null ? { expected_generation: I.current } : {}
      }), A = Number(M == null ? void 0 : M.generation);
      return Number.isFinite(A) && (I.current = A), v.delete(a.readerItemId), s({ ...a, current: T }), f(T), b(""), (M == null ? void 0 : M.changed) === !1 ? w({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, T), w({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), k(t, a.readerItemId), !0;
    } catch (M) {
      const A = M;
      return (A == null ? void 0 : A.reason) === "generation_mismatch" && (I.current = null), w({ tone: "error", message: (A == null ? void 0 : A.message) || "保存失败，请稍后再试。" }), p(vc(A == null ? void 0 : A.issues)), !1;
    } finally {
      S(!1);
    }
  }, [e, a, h, u, m, t, o, k, v, I]), O = B(() => {
    n && v.delete(n);
  }, [n, v]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: u,
    setDraft: x,
    reason: m,
    setReason: b,
    saving: h,
    status: y,
    issues: E,
    save: L,
    discardDraft: O
  };
}
const go = "reader-inline-edit";
function Tc({ text: e }) {
  const [t, n] = _("");
  return $(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = mo(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ F("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ g("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ g("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function kc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var O;
  const s = e.itemId, i = Pc({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = _(!1), [d, u] = _(!1), f = N(null), m = Ic(e.rect, t), b = G(() => Sc(o), [o]), h = b.indexOf(s), { loaded: S } = i, y = i.saving || i.loading, w = n.blockedReason, E = !S || i.draft === S.current, { close: p, select: v } = n, I = B((R) => {
    const P = b[h + R];
    P && (v(P), a == null || a(P));
  }, [b, h, v, a]), k = B(() => {
    i.discardDraft(), p();
  }, [i, p]), x = B(async (R, P) => {
    await i.save(R, P) && p();
  }, [i, p]);
  $(() => {
    const R = (P) => {
      !P.altKey || P.key !== "ArrowUp" && P.key !== "ArrowDown" || (P.preventDefault(), I(P.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", R), () => window.removeEventListener("keydown", R);
  }, [I]), Re(() => {
    const R = f.current;
    if (!R) return;
    R.style.height = "auto";
    const P = m.mode === "inline" ? m.minHeight : 0;
    R.style.height = `${Math.max(P, R.scrollHeight + 2)}px`;
  }, [i.draft, S, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const L = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ F(lt, { children: [
    m.mode === "popout" ? /* @__PURE__ */ g("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ F(
      "div",
      {
        className: `${go} is-${m.mode}`,
        style: L,
        role: "group",
        "aria-label": `改第 ${((O = n.target) == null ? void 0 : O.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (R) => R.stopPropagation(),
        children: [
          r && (S != null && S.source) ? /* @__PURE__ */ g(
            ge,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((R) => !R),
              children: S.source
            }
          ) : null,
          w ? /* @__PURE__ */ g("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: w }) : null,
          i.loading ? /* @__PURE__ */ g("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          S ? /* @__PURE__ */ g(
            pa,
            {
              ref: f,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: y || !!w,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (R) => i.setDraft(R.target.value),
              onKeyDown: (R) => {
                R.key === "Enter" && (R.metaKey || R.ctrlKey) ? (R.preventDefault(), E || x()) : R.key === "Escape" && (R.preventDefault(), k());
              }
            }
          ) : null,
          S ? /* @__PURE__ */ g(Tc, { text: i.draft }) : null,
          /* @__PURE__ */ F("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ g(Zn, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => I(-1), children: /* @__PURE__ */ g(sa, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(Zn, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= b.length - 1, onClick: () => I(1), children: /* @__PURE__ */ g(Br, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(
              Wr,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: y || !!w || !S,
                onChange: (R) => i.setReason(R.target.value),
                onKeyDown: (R) => {
                  R.key === "Enter" ? (R.preventDefault(), E || x()) : R.key === "Escape" && (R.preventDefault(), k());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ F(
              ge,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": d,
                "data-block-edit-action": "history",
                onClick: () => u((R) => !R),
                children: [
                  /* @__PURE__ */ g(ia, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ g(ge, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: k, children: "取消" }),
            /* @__PURE__ */ g(
              ge,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: y || !!w || E || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  x();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ g("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ g("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((R) => /* @__PURE__ */ g("li", { children: R }, R)) }) : null,
          d && S && i.history.length ? /* @__PURE__ */ g("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((R, P) => {
            const T = R.text === S.current, M = [pc(R.ts), R.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ F("li", { "data-block-edit-history": R.label, "data-current": T ? "true" : void 0, children: [
              /* @__PURE__ */ F("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ F("span", { children: [
                  M,
                  T ? "（现在用的）" : "",
                  R.reason ? ` · ${R.reason}` : ""
                ] }),
                T ? null : /* @__PURE__ */ g(
                  ge,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: y || !!w,
                    onClick: () => {
                      x(R.text, `回到「${M.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ g("p", { className: "reader-inline-edit-history-text", children: R.text })
            ] }, `${R.ts}:${P}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const bo = Sn(null), yo = Sn(null);
function Mc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ g(bo.Provider, { value: e, children: /* @__PURE__ */ g(yo.Provider, { value: t, children: n }) });
}
function Ue() {
  return Rn(bo);
}
function vo() {
  return Rn(yo);
}
const $e = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Ac = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, _c = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Nc = {
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
}, ur = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Lc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => ur(o ?? a ?? "", Ac)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => ur(o ?? a ?? "", _c)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Nc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Dc(e) {
  return $e(e.translatedBlockText) || $e(e.translated.text) || $e(e.source.text);
}
const Cc = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function xc(e) {
  const t = [];
  for (const n of e) {
    if (!Cc(n)) continue;
    const r = Lc(Dc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function zc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Oc = 24, Fc = 60;
function fr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Oc), o = Math.min(e.length, n + t.length + Fc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function $c(e, t, n = 200) {
  const r = $e(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = $e(a.translatedBlockText) || $e(a.translated.text), c = i ? fr(i, r) : null, l = c ?? fr($e(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function Dt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Bc(e, t) {
  const n = $e(t).toLowerCase();
  if (!n || !e) return Dt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Dt(e.slice(a, s))}<mark class="reader-find-mark">${Dt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Dt(e.slice(a));
}
function jc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const wo = 1.414;
function Uc({
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
  regionHighlight: u = null,
  regionTargets: f = [],
  hoveredRegionId: m,
  onHoverRegion: b,
  liveTranslationLayout: h,
  liveTranslationPage: S,
  showLiveTranslation: y = r === "source"
}) {
  var Me;
  const w = Ue(), E = w == null ? void 0 : w.revisedBlocks, p = w == null ? void 0 : w.blockEdit, v = p == null ? void 0 : p.pendingEdits, I = w == null ? void 0 : w.editBlock, k = (w == null ? void 0 : w.findTerm) || "", x = G(
    () => k ? ({ str: C }) => Bc(C, k) : void 0,
    [k]
  ), L = N(c ?? wo), [O, R] = _(L.current);
  $(() => {
    c != null && Math.abs(c - L.current) >= 1e-3 && (L.current = c, R(c));
  }, [c]);
  const P = N(d);
  P.current = d;
  const T = N(null), M = N((C) => {
    var X;
    T.current = C, (X = P.current) == null || X.call(P, C);
  }).current, A = N(null), j = N(`${t}@${n}`);
  Re(() => {
    const C = `${t}@${n}`;
    j.current !== C && (j.current = C, o && Wc(T.current, A.current));
  }, [o, n, t]), $(() => {
    o || tn(A.current);
  }, [o]), $(() => () => tn(A.current), []);
  const z = Math.max(120, Math.floor(t * O)), J = Math.max(z, Math.ceil(s || 0)), oe = In(u, t, z), q = G(
    () => Oi(f, t, z),
    [z, f, t]
  ), [Q, me] = _(null), ae = typeof b == "function", se = ae ? m ?? null : Q, ye = (C) => {
    ae ? C !== (m ?? null) && (b == null || b(C)) : me((X) => X === C ? X : C);
  }, V = G(
    () => q.find((C) => C.itemId === se) || null,
    [se, q]
  ), ee = r === "translated" && ((Me = p == null ? void 0 : p.target) == null ? void 0 : Me.itemId) || "", fe = G(
    () => ee && q.find((C) => C.itemId === ee) || null,
    [ee, q]
  ), U = V ? Pt(V.highlight.region) : "", Y = lc(T, o ? V : null, q, t, U), He = (C) => {
    var we, Ae, Ie, Qe;
    if (C.pointerType === "touch") return;
    if (C.buttons !== 0) {
      ye(null);
      return;
    }
    if ((Ae = (we = C.target) == null ? void 0 : we.closest) != null && Ae.call(we, `.${co}`) || (Qe = (Ie = C.target) == null ? void 0 : Ie.closest) != null && Qe.call(Ie, `.${go}`)) return;
    const X = C.currentTarget.getBoundingClientRect(), ue = C.clientX - X.left, ce = C.clientY - X.top, le = Y == null ? void 0 : Y.rect;
    if (le && (Y == null ? void 0 : Y.placement) === "outside" && ue >= le.left - 4 && ue <= le.left + uo && ce >= le.top - lo && ce <= le.top) return;
    const de = dr(q, ue, ce);
    ye((de == null ? void 0 : de.itemId) || null);
  }, Ce = (C) => {
    if (C.pointerType === "mouse") return;
    const X = C.currentTarget.getBoundingClientRect(), ue = dr(
      q,
      C.clientX - X.left,
      C.clientY - X.top
    );
    ye((ue == null ? void 0 : ue.itemId) || null);
  }, xe = (C) => {
    !Number.isFinite(C) || C <= 0 || Math.abs(L.current - C) < 1e-3 || (L.current = C, R(C), l == null || l(e, C));
  };
  return /* @__PURE__ */ F(
    "div",
    {
      ref: M,
      [je]: e,
      [it]: r,
      [Tn]: z,
      className: kn,
      onPointerMoveCapture: He,
      onPointerDown: Ce,
      onPointerLeave: (C) => {
        C.pointerType === "mouse" && ye(null);
      },
      style: {
        width: t,
        height: J,
        minHeight: J
      },
      children: [
        o ? /* @__PURE__ */ g(
          ga,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: x,
            renderAnnotationLayer: !1,
            className: qr,
            loading: /* @__PURE__ */ g(
              "div",
              {
                className: Bt,
                style: { width: t, height: z }
              }
            ),
            onLoadSuccess: (C) => {
              try {
                const X = C.getViewport({ scale: 1 });
                if (X.width > 0) {
                  const ue = X.height / X.width;
                  xe(ue);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              tn(A.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ g(
          "div",
          {
            className: Bt,
            style: { width: t, height: z },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ g("div", { ref: A, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        oe ? /* @__PURE__ */ g(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: oe,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && y ? /* @__PURE__ */ g(
          ec,
          {
            layoutPage: h,
            pageState: S,
            width: t,
            height: z
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ g(nc, { targets: q, edits: v, width: t, excludeId: fe == null ? void 0 : fe.itemId }) : null,
        o && fe && p ? /* @__PURE__ */ g(
          kc,
          {
            target: fe,
            page: { width: t, height: z },
            edit: p,
            showSource: !!(w != null && w.editShowsSource),
            regions: w == null ? void 0 : w.regions,
            jumpToBlock: w == null ? void 0 : w.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (E != null && E.size) ? /* @__PURE__ */ g("div", { className: "reader-revised-markers", "aria-hidden": "true", children: q.filter((C) => E.has(C.itemId)).map((C) => /* @__PURE__ */ g(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": C.itemId,
            style: { left: C.rect.left, top: C.rect.top, height: C.rect.height }
          },
          C.itemId
        )) }) : null,
        /* @__PURE__ */ g(
          Hi,
          {
            target: o && (V == null ? void 0 : V.itemId) !== (fe == null ? void 0 : fe.itemId) ? V : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: V && (E == null ? void 0 : E.get(V.itemId)) || 0,
            onEdit: I,
            frameRect: Y == null ? void 0 : Y.rect,
            placement: Y == null ? void 0 : Y.placement
          }
        )
      ]
    }
  );
}
const Hc = Jt(Uc);
function Wc(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function tn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Vc = 2 * 1024 * 1024;
function Jc(e) {
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
const nn = 5, Kc = "120% 0px", qc = 120, Gc = "25% 0px";
let mr = 1;
const hr = /* @__PURE__ */ new WeakMap();
function Zc(e) {
  if (!e) return 0;
  const t = hr.get(e);
  if (t) return t;
  const n = mr;
  return mr += 1, hr.set(e, n), n;
}
function Yc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Xc = jo(
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
    onLoadSuccess: u,
    onLoadError: f,
    onNumPagesChange: m,
    activeRegion: b = null,
    regions: h = [],
    readerMetadata: S = null,
    hoveredRegionId: y = null,
    onHoverRegion: w,
    liveTranslation: E,
    showLiveTranslation: p = t === "source",
    liveTranslationPendingLabel: v = "",
    paneAction: I
  }, k) {
    xi();
    const { file: x, loading: L, error: O } = ts(n, r), R = `${n}\0${Zc(x)}`, P = N(R);
    P.current = R;
    const T = G(() => {
      const D = Ga(x);
      return D ? "ranged" in D ? { range: Jc(D.ranged) } : D : null;
    }, [x, n]), [M, A] = _(0), [j, z] = _(""), [J, oe] = _(null), [q, Q] = _(480), me = N(null), ae = N(0), se = G(() => Yc(), []), ye = G(() => ({
      cMapUrl: vt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: vt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Vc,
      disableAutoFetch: !0
    }), []);
    En(k, () => J, [J]), $(() => {
      const D = (H) => {
        ae.current = H, Q(H);
      }, K = (H) => {
        const ne = Ms(H, ae.current);
        if (ne !== "ignore") {
          if (me.current && clearTimeout(me.current), ne === "immediate") {
            D(H);
            return;
          }
          me.current = setTimeout(() => D(H), Yr);
        }
      }, W = !!(c && c >= 80);
      K(W ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const re = !W && i && typeof ResizeObserver < "u" ? new ResizeObserver((H) => {
        var ne, he;
        K(((he = (ne = H[0]) == null ? void 0 : ne.contentRect) == null ? void 0 : he.width) ?? i.clientWidth);
      }) : null;
      return re && i && re.observe(i), () => {
        re == null || re.disconnect(), me.current && clearTimeout(me.current);
      };
    }, [c, i, a]);
    const V = G(
      () => Ps(q, o),
      [q, o]
    ), [ee, fe] = _(() => /* @__PURE__ */ new Map()), [U, Y] = _(() => /* @__PURE__ */ new Set()), [He, Ce] = _(() => /* @__PURE__ */ new Set()), xe = N(/* @__PURE__ */ new Map()), Me = N(null), C = N(null), [X, ue] = _(() => /* @__PURE__ */ new Set()), ce = N(/* @__PURE__ */ new Map()), le = B((D, K) => {
      fe((W) => {
        if (W.get(D) === K) return W;
        const Z = new Map(W);
        return Z.set(D, K), Z;
      });
    }, []), de = B((D, K) => {
      const W = xe.current, Z = W.get(D), re = [Me.current, C.current];
      if (Z)
        for (const H of re)
          try {
            H == null || H.unobserve(Z);
          } catch {
          }
      if (K) {
        W.set(D, K);
        for (const H of re)
          try {
            H == null || H.observe(K);
          } catch {
          }
      } else
        W.delete(D);
    }, []), we = N(/* @__PURE__ */ new Map()), Ae = B((D) => {
      const K = we.current;
      let W = K.get(D);
      return W || (W = (Z) => de(D, Z), K.set(D, W)), W;
    }, [de]);
    $(() => {
      if (typeof IntersectionObserver > "u") return;
      const D = ce.current, K = new IntersectionObserver(
        (W) => {
          const Z = [], re = [];
          for (const H of W) {
            const ne = H.target, he = Ut(ne);
            Number.isFinite(he) && (H.isIntersecting ? Z : re).push(he);
          }
          if ((Z.length || re.length) && Y((H) => {
            let ne = null;
            for (const he of Z)
              H.has(he) || (ne = ne || new Set(H), ne.add(he));
            for (const he of re)
              H.has(he) && (ne = ne || new Set(H), ne.delete(he));
            return ne || H;
          }), Z.length) {
            for (const H of Z) {
              const ne = D.get(H);
              ne && (clearTimeout(ne), D.delete(H));
            }
            Ce((H) => {
              let ne = null;
              for (const he of Z)
                H.has(he) || (ne = ne || new Set(H), ne.add(he));
              return ne || H;
            });
          }
          for (const H of re)
            D.has(H) || D.set(H, setTimeout(() => {
              D.delete(H), Ce((ne) => {
                if (!ne.has(H)) return ne;
                const he = new Set(ne);
                return he.delete(H), he;
              });
            }, qc));
        },
        { root: i, rootMargin: Kc, threshold: 0 }
      );
      Me.current = K;
      for (const W of xe.current.values())
        try {
          K.observe(W);
        } catch {
        }
      return () => {
        K.disconnect(), Me.current === K && (Me.current = null);
        for (const W of D.values()) clearTimeout(W);
        D.clear();
      };
    }, [i]), $(() => {
      if (typeof IntersectionObserver > "u") return;
      const D = new IntersectionObserver(
        (K) => {
          ue((W) => {
            let Z = null;
            for (const re of K) {
              const H = Ut(re.target);
              !Number.isFinite(H) || re.isIntersecting === W.has(H) || (Z = Z || new Set(W), re.isIntersecting ? Z.add(H) : Z.delete(H));
            }
            return Z || W;
          });
        },
        { root: i, rootMargin: Gc, threshold: 0 }
      );
      C.current = D;
      for (const K of xe.current.values())
        try {
          D.observe(K);
        } catch {
        }
      return () => {
        D.disconnect(), C.current === D && (C.current = null);
      };
    }, [i]);
    const Ie = !!i && typeof IntersectionObserver < "u";
    Re(() => {
      A(0), z(""), Y(/* @__PURE__ */ new Set()), Ce(/* @__PURE__ */ new Set()), fe(/* @__PURE__ */ new Map()), xe.current.clear();
      const D = ce.current;
      for (const K of D.values()) clearTimeout(K);
      D.clear(), m == null || m(0, t);
    }, [R, m, t]);
    const Qe = B(
      ({ numPages: D }) => {
        P.current === R && (A(D), z(""), m == null || m(D, t), u == null || u({ numPages: D, pane: t }));
      },
      [R, u, m, t]
    ), Gt = B(
      (D) => {
        if (P.current !== R) return;
        const K = (D == null ? void 0 : D.message) || "PDF 解析失败";
        z(K), A(0), m == null || m(0, t), f == null || f(D, t);
      },
      [R, f, m, t]
    ), ze = G(
      () => M > 0 ? Array.from({ length: M }, (D, K) => K + 1) : [],
      [M]
    );
    $(() => {
      typeof IntersectionObserver < "u" || Ce(new Set(ze));
    }, [ze]);
    const Oe = G(
      () => Gn(b, S, t),
      [b, S, t]
    ), We = G(() => {
      const D = /* @__PURE__ */ new Map();
      for (const K of h) {
        const W = Gn(K, S, t);
        if (!W) continue;
        const Z = D.get(W.box.page) || [];
        Z.push(W), D.set(W.box.page, Z);
      }
      return D;
    }, [t, S, h]), Mt = G(() => {
      const D = /* @__PURE__ */ new Set();
      if (!y) return D;
      for (const [K, W] of We)
        W.some((Z) => Z.itemId === y) && D.add(K);
      return D;
    }, [y, We]), At = G(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(ze);
      if (U.size === 0) {
        const W = Math.min(M, nn * 2 + 1);
        return new Set(Array.from({ length: W }, (Z, re) => re + 1));
      }
      const K = /* @__PURE__ */ new Set();
      for (const W of U)
        for (let Z = -nn; Z <= nn; Z++) {
          const re = W + Z;
          re >= 1 && re <= M && K.add(re);
        }
      return K;
    }, [M, ze, i, a, U]), et = !n || !!O || !!j, _t = n && (O || j) || s;
    return /* @__PURE__ */ F(
      "section",
      {
        ref: oe,
        className: `reader-panel ${bs}${a ? "" : " is-hidden"}`,
        [it]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (E == null ? void 0 : E.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          I ? /* @__PURE__ */ g("div", { className: "reader-react-pdf-pane-action", children: I }) : null,
          v ? /* @__PURE__ */ F("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ g("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ g("span", { children: v })
          ] }) : null,
          et && !L ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: _t }) : null,
          L ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !O ? /* @__PURE__ */ g("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ g(
            ba,
            {
              file: T,
              loading: null,
              error: null,
              options: ye,
              onLoadSuccess: Qe,
              onLoadError: Gt,
              className: "reader-react-pdf-document",
              children: ze.map((D) => {
                if (At.has(D))
                  return /* @__PURE__ */ g(
                    Hc,
                    {
                      pane: t,
                      pageNumber: D,
                      width: V,
                      devicePixelRatio: se,
                      active: He.has(D),
                      textLayer: !Ie || X.has(D),
                      syncedMinHeight: (l == null ? void 0 : l.get(D)) || 0,
                      onMetrics: d,
                      cachedAspect: ee.get(D),
                      onAspectChange: le,
                      sentinelRef: Ae(D),
                      regionHighlight: (Oe == null ? void 0 : Oe.box.page) === D ? Oe : null,
                      regionTargets: We.get(D),
                      hoveredRegionId: y && Mt.has(D) ? y : null,
                      onHoverRegion: w,
                      liveTranslationLayout: E == null ? void 0 : E.layoutByPage.get(D - 1),
                      liveTranslationPage: E == null ? void 0 : E.pagesByPage.get(D - 1),
                      showLiveTranslation: p
                    },
                    `${t}-${D}`
                  );
                const W = ee.get(D) ?? wo, Z = Math.max(120, Math.floor(V * W)), re = Math.max(Z, Math.ceil((l == null ? void 0 : l.get(D)) || 0));
                return /* @__PURE__ */ g(
                  "div",
                  {
                    ref: Ae(D),
                    [je]: D,
                    [it]: t,
                    [Tn]: Z,
                    className: `${kn} is-placeholder`,
                    style: {
                      width: V,
                      height: re,
                      minHeight: re
                    },
                    children: /* @__PURE__ */ g(
                      "div",
                      {
                        className: Bt,
                        style: { width: V, height: Z },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${D}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), pr = Jt(Xc), Qc = 2e3, el = 6, tl = 500, gr = "reader-react-resizing";
function nl(e, t) {
  const n = N(null), r = N(null);
  Re(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const p = rl(e), v = zt(e, p);
      if (!v) return;
      s = { pane: p, progress: v, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let d = 0, u = null, f = e.scrollHeight, m = f, b = 0, h = l;
    const S = /* @__PURE__ */ new WeakMap(), y = typeof ResizeObserver > "u" ? null : new ResizeObserver((p) => {
      let v = !1;
      for (const I of p) {
        const k = Math.round(I.contentRect.height);
        S.has(I.target) && S.get(I.target) !== k && (v = !0), S.set(I.target, k);
      }
      v && St(e, c, "auto", i);
    }), w = () => {
      var p;
      u && clearTimeout(u), cancelAnimationFrame(d), y == null || y.disconnect(), e.classList.remove(gr);
      for (const v of br) e.removeEventListener(v, w);
      ((p = r.current) == null ? void 0 : p.stop) === w && (r.current = null);
    }, E = () => {
      St(e, c, "auto", i);
      const p = e.scrollHeight;
      b = p === m ? b + 1 : 0, m = p;
      const v = performance.now() - h;
      b >= el && (p !== f || v > tl) || v > Qc ? w() : d = requestAnimationFrame(E);
    };
    for (const p of br) e.addEventListener(p, w, { passive: !0 });
    for (const p of Array.from(e.children)) y == null || y.observe(p);
    e.classList.add(gr), r.current = { ...s, stop: w }, u = setTimeout(() => {
      u = null, h = performance.now(), f = e.scrollHeight, m = f, b = 0, d = requestAnimationFrame(E);
    }, Yr);
  }, [e, t]), $(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function rl(e) {
  for (const t of Array.from(e.querySelectorAll(`[${je}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(it) || null;
  }
  return null;
}
const br = ["wheel", "touchstart", "keydown", "pointerdown"], ol = () => () => {
}, yr = () => null;
function al({
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
function sl(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function il(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function cl(e) {
  const t = Ue(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, u = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? kt, b = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), S = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, y = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, E = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", p = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", v = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, I = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, k = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), x = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), L = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), O = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), P = (t == null ? void 0 : t.regionHover) ?? null, [T, M] = _(null), A = Fr(
    P ? P.subscribe : ol,
    P ? () => P.get().itemId : yr,
    P ? () => P.get().itemId : yr
  ), j = P ? A : T, z = B((Q) => {
    P ? P.set(Q, "pdf") : M(Q);
  }, [P]), J = al({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: d
  }), q = Number.isFinite(b) && b > 0 ? sl(
    b,
    n || r,
    typeof document > "u" ? b * 2 : document.documentElement.clientWidth
  ) : null;
  return nl(f, q), /* @__PURE__ */ g(
    "div",
    {
      ref: u,
      className: gs,
      "data-reader-region-count": O.length,
      "data-reader-structured-region-count": O.filter(ta).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ F(
        "main",
        {
          className: `${ps} reader-mode-${J.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            S ? /* @__PURE__ */ g(
              pr,
              {
                pane: "source",
                url: E,
                preloadedFile: v,
                userZoom: m,
                visible: J.showSource,
                scrollRoot: f,
                pageWidthOverride: q,
                rowHeights: J.compareMode ? h : void 0,
                onMetrics: k,
                emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: x,
                activeRegion: L,
                regions: O,
                readerMetadata: R,
                hoveredRegionId: j,
                onHoverRegion: z,
                liveTranslation: d ? o : void 0,
                showLiveTranslation: d,
                liveTranslationPendingLabel: d ? il(o) : "",
                paneAction: d ? /* @__PURE__ */ F(lt, { children: [
                  e.sourcePaneAction,
                  /* @__PURE__ */ g(
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
            y ? /* @__PURE__ */ g(
              pr,
              {
                pane: "translated",
                url: p,
                preloadedFile: I,
                userZoom: m,
                visible: J.showTranslated,
                scrollRoot: f,
                pageWidthOverride: q,
                rowHeights: J.compareMode ? h : void 0,
                onMetrics: k,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: x,
                activeRegion: L,
                regions: O,
                readerMetadata: R,
                hoveredRegionId: j,
                onHoverRegion: z,
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
const ll = [
  { id: "source", label: "原文", Icon: jr },
  { id: "compare", label: "对照", Icon: Ur },
  { id: "translated", label: "译文", Icon: Hr }
];
function dl(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function ul(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function fl(e) {
  const t = Ue(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, i = a ? dl(a.state) : "";
  return /* @__PURE__ */ F("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ F(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || i,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ g(ca, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: i })
        ]
      }
    ) : null,
    /* @__PURE__ */ g("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: ll.map(({ id: c, label: l, Icon: d }) => {
      const u = n === c, f = ul({
        id: c,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${u ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": u,
          "aria-label": l,
          title: f ? `${l} 需要文档任务` : l,
          disabled: f,
          onClick: () => o(c),
          children: [
            /* @__PURE__ */ g(d, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ g("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        c
      );
    }) })
  ] });
}
const ml = {
  markdown: { label: "Markdown", short: "MD", Icon: la, needsJob: !0 }
}, hl = Xr.map(
  (e) => ({ id: e, ...ml[e] })
);
function So() {
  return hl.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function pl(e) {
  const t = Ue(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ g(lt, { children: So().map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const d = n === s, u = l && r, f = d ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ F(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": f,
        "aria-pressed": d,
        title: u ? `${i} 需打开任务阅读` : i,
        disabled: u,
        onClick: () => d ? a() : o(s),
        children: [
          /* @__PURE__ */ g(c, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function gl(e) {
  const t = Ue(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = So().map(({ id: c, label: l, short: d, Icon: u, needsJob: f }) => ({
    key: c,
    label: l,
    short: d,
    Icon: u,
    disabled: f && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ F("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ g("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: d, disabled: u, selected: f, badge: m, onClick: b }) => /* @__PURE__ */ F(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": f,
        className: `reader-assistant-dock-tab${f ? " is-active" : ""}`,
        title: u ? `${l} 需打开任务阅读` : l,
        disabled: u,
        onClick: b,
        children: [
          /* @__PURE__ */ g(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { className: "reader-assistant-dock-tab-label", children: l }),
          m ? /* @__PURE__ */ g("span", { className: "reader-assistant-dock-badge", children: m }) : null
        ]
      },
      c
    )) }),
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ g(Pn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function bl(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function yl(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function vl(e) {
  return e / 100 * window.innerHeight;
}
function wl(e) {
  return e / 100 * window.innerWidth;
}
function Sl(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function pt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Sl(n);
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
      r = yl(t, o);
      break;
    }
    case "em": {
      r = bl(t, o);
      break;
    }
    case "vh": {
      r = vl(o);
      break;
    }
    case "vw": {
      r = wl(o);
      break;
    }
  }
  return r;
}
function be(e) {
  return parseFloat(e.toFixed(3));
}
function ct({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function gn(e) {
  const { panels: t } = e, n = ct({ group: e });
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
      const d = pt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = be(d / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const d = pt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = be(d / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const d = pt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = be(d / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const d = pt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = be(d / n * 100);
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
function bn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Rl : El
  );
}
function Rl(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function El(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Ro(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Eo(e, t) {
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
function Il({
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
    const { x: i, y: c } = Eo(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return te(o, "No rect found"), o;
}
let Ct;
function Pl() {
  return Ct === void 0 && (typeof matchMedia == "function" ? Ct = !!matchMedia("(pointer:coarse)").matches : Ct = !1), Ct;
}
function Io(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = bn(
    n,
    Array.from(t.children).filter(Ro).map((b) => ({ element: b }))
  ).map(({ element: b }) => b), s = [];
  let i = !1, c = !1, l = -1, d = -1, u = 0, f, m = [];
  {
    let b = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (b++, h.hasAttribute("data-disabled") || (u++, l === -1 && (l = b), d = b));
  }
  if (u > 1) {
    let b = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        b++;
        const S = r.find(
          (y) => y.element === h
        );
        if (S) {
          if (f) {
            const y = f.element.getBoundingClientRect(), w = h.getBoundingClientRect();
            let E;
            if (c) {
              const p = n === "horizontal" ? new DOMRect(
                y.right,
                y.top,
                0,
                y.height
              ) : new DOMRect(
                y.left,
                y.bottom,
                y.width,
                0
              ), v = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (m.length) {
                case 0: {
                  E = [
                    p,
                    v
                  ];
                  break;
                }
                case 1: {
                  const I = m[0], k = Il({
                    orientation: n,
                    rects: [y, w],
                    targetRect: I.element.getBoundingClientRect()
                  });
                  E = [
                    I,
                    k === y ? v : p
                  ];
                  break;
                }
                default: {
                  E = m;
                  break;
                }
              }
            } else
              m.length ? E = m : E = [
                n === "horizontal" ? new DOMRect(
                  y.right,
                  w.top,
                  w.left - y.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  y.bottom,
                  w.width,
                  w.top - y.bottom
                )
              ];
            for (const p of E) {
              let v = "width" in p ? p : p.element.getBoundingClientRect();
              const I = Pl() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (v.width < I) {
                const x = I - v.width;
                v = new DOMRect(
                  v.x - x / 2,
                  v.y,
                  v.width + x,
                  v.height
                );
              }
              if (v.height < I) {
                const x = I - v.height;
                v = new DOMRect(
                  v.x,
                  v.y - x / 2,
                  v.width,
                  v.height + x
                );
              }
              const k = b <= l || b > d;
              !i && !k && s.push({
                group: e,
                groupSize: ct({ group: e }),
                panels: [f, S],
                separator: "width" in p ? void 0 : p,
                rect: v
              }), i = !1;
            }
          }
          c = !1, f = S, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const S = o.find(
          (y) => y.element === h
        );
        S ? m.push(S) : (f = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var Fe;
class Po {
  constructor() {
    Jn(this, Fe, {});
  }
  addListener(t, n) {
    const r = ut(this, Fe)[t];
    return r === void 0 ? ut(this, Fe)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = ut(this, Fe)[t];
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
    Kn(this, Fe, {});
  }
  removeListener(t, n) {
    const r = ut(this, Fe)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Fe = new WeakMap();
let at = {
  cursorFlags: 0,
  state: "inactive"
};
const _n = new Po();
function qe() {
  return at;
}
function Tl(e) {
  return _n.addListener("change", e);
}
function kl(e) {
  const t = at, n = { ...at };
  n.cursorFlags = e, at = n, _n.emit("change", {
    prev: t,
    next: n
  });
}
function st(e) {
  const t = at;
  at = e, _n.emit("change", {
    prev: t,
    next: e
  });
}
const Ml = (e) => e, rn = () => {
}, To = 1, ko = 2, Mo = 4, Ao = 8, vr = 3, wr = 12;
let xt;
function Sr() {
  return xt === void 0 && (xt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (xt = !0)), xt;
}
function Al({
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
        if (e && Sr()) {
          const a = (e & To) !== 0, s = (e & ko) !== 0, i = (e & Mo) !== 0, c = (e & Ao) !== 0;
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
    return Sr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Rr = /* @__PURE__ */ new WeakMap();
function Nn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Rr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = qe();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Al({
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
  Rr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Te = /* @__PURE__ */ new Map();
const _o = new Po();
function _l(e) {
  Te = new Map(Te), Te.delete(e);
}
function Er(e, t) {
  for (const [n] of Te)
    if (n.id === e)
      return n;
}
function Be(e, t) {
  for (const [n, r] of Te)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function Ye() {
  return Te;
}
function Ln(e, t) {
  return _o.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function De(e, t, n) {
  const r = Te.get(e);
  Te = new Map(Te), Te.set(e, t), _o.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function No(e) {
  const t = qe();
  let n = !1;
  switch (t.state) {
    case "active":
      st({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Nn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Be(r.group.id, !0);
        De(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Ir(e) {
  e.defaultPrevented || No(e.currentTarget);
}
function Nl(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Eo(n, a.rect);
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
function Ll(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Dl(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: kr(e),
    b: kr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  te(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Tr(Pr(n.a)),
    b: Tr(Pr(n.b))
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
const Cl = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function xl(e) {
  const t = getComputedStyle(Lo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function zl(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || xl(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Cl.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Pr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (te(n, "Missing node"), zl(n)) return n;
  }
  return null;
}
function Tr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function kr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Lo(e);
  return t;
}
function Lo(e) {
  const { parentNode: t } = e;
  return Ll(t) ? t.host : t;
}
function Ol(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Fl({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Ro(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Dl(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Ol(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Dn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Io(o), s = Nl(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Fl({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function $l(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function pe(e, t, n = 0) {
  return Math.abs(be(e) - be(t)) <= n;
}
function Pe(e, t) {
  return pe(e, t) ? 0 : e > t ? 1 : -1;
}
function ot({
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
  if (Pe(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Pe(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = be(r), r;
}
function Rt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (pe(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [d, u] = r;
  te(d != null, "Invalid first pivot index"), te(u != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? u : d, S = n[h];
        te(
          S,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: w,
          minSize: E = 0
        } = S;
        if (w) {
          const p = i[h];
          if (te(
            p != null,
            `Previous layout not found for panel index ${h}`
          ), pe(p, y)) {
            const v = E - p;
            Pe(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      {
        const h = e < 0 ? d : u, S = n[h];
        te(
          S,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: w,
          minSize: E = 0
        } = S;
        if (w) {
          const p = i[h];
          if (te(
            p != null,
            `Previous layout not found for panel index ${h}`
          ), pe(p, E)) {
            const v = p - y;
            Pe(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? u : d, S = n[h];
      te(
        S,
        `Panel constraints not found for index ${h}`
      );
      const y = i[h], { collapsible: w, collapsedSize: E, minSize: p } = S;
      if (w && Pe(y, p) < 0)
        if (e > 0) {
          const v = p - E, I = v / 2, k = y + e;
          Pe(k, p) < 0 && (e = Pe(e, I) <= 0 ? 0 : v);
        } else {
          const v = p - E, I = 100 - v / 2, k = y - e;
          Pe(k, p) < 0 && (e = Pe(100 + e, I) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let S = e < 0 ? u : d, y = 0;
    for (; ; ) {
      const E = i[S];
      te(
        E != null,
        `Previous layout not found for panel index ${S}`
      );
      const p = ot({
        overrideDisabledPanels: s,
        panelConstraints: n[S],
        prevSize: E,
        size: 100
      }) - E;
      if (y += p, S += h, S < 0 || S >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(y));
    e = e < 0 ? 0 - w : w;
  }
  {
    let h = e < 0 ? d : u;
    for (; h >= 0 && h < n.length; ) {
      const S = Math.abs(e) - Math.abs(f), y = i[h];
      te(
        y != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = y - S, E = ot({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: y,
        size: w
      });
      if (!pe(y, E) && (f += y - E, l[h] = E, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if ($l(c, l))
    return o;
  {
    const h = e < 0 ? u : d, S = i[h];
    te(
      S != null,
      `Previous layout not found for panel index ${h}`
    );
    const y = S + f, w = ot({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: S,
      size: y
    });
    if (l[h] = w, !pe(w, y)) {
      let E = y - w, p = e < 0 ? u : d;
      for (; p >= 0 && p < n.length; ) {
        const v = l[p];
        te(
          v != null,
          `Previous layout not found for panel index ${p}`
        );
        const I = v + E, k = ot({
          overrideDisabledPanels: s,
          panelConstraints: n[p],
          prevSize: v,
          size: I
        });
        if (pe(v, k) || (E -= k - v, l[p] = k), pe(E, 0))
          break;
        e > 0 ? p-- : p++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, S) => S + h,
    0
  );
  if (!pe(m, 100, 0.1))
    return o;
  const b = Object.keys(o);
  return l.reduce((h, S, y) => (h[b[y]] = S, h), {});
}
function Ge(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Pe(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Ze({
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
  if (!pe(o, 100) && r.length > 0)
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
    const d = ot({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != d && (a += l - d, r[i] = d);
  }
  if (!pe(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      te(c != null, `No layout data found for index ${i}`);
      const l = c + a, d = ot({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== d && (a -= d - c, r[i] = d, pe(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function Do({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = Ye();
    for (const [
      l,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: u,
        layout: f,
        groupSize: m,
        separatorToPanels: b
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: u,
          group: l,
          groupSize: m,
          layout: f,
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
    derivedPanelConstraints: u
  }) => {
    const f = a(), m = l.findIndex((S) => S.id === t), b = m === 0, h = m === l.length - 1;
    if (h && c < f && (b || l.slice(0, m).every((S, y) => {
      const w = u[y];
      return (w == null ? void 0 : w.collapsible) && pe(w.collapsedSize, d[w.panelId]);
    }))) {
      const S = l.slice(0, m).reduce((y, w) => y + d[w.id], 0);
      return {
        ...d,
        [t]: be(100 - S)
      };
    }
    return Rt({
      delta: h ? f - c : c - f,
      initialLayout: d,
      panelConstraints: u,
      pivotIndices: h ? [m - 1, m] : [m, m + 1],
      prevLayout: d,
      trigger: "imperative-api"
    });
  }, i = (c) => {
    const l = a();
    if (c === l)
      return;
    const {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: u,
      group: f,
      groupSize: m,
      layout: b,
      separatorToPanels: h
    } = n(), S = s({
      nextSize: c,
      panels: f.panels,
      prevLayout: b,
      derivedPanelConstraints: u
    }), y = Ze({
      layout: S,
      panelConstraints: u
    });
    Ge(b, y) || De(f, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: u,
      groupSize: m,
      layout: y,
      separatorToPanels: h
    });
  };
  return {
    collapse: () => {
      const { collapsible: c, collapsedSize: l } = r(), { mutableValues: d } = o(), u = a();
      c && u !== l && (d.expandToSize = u, i(l));
    },
    expand: () => {
      const { collapsible: c, collapsedSize: l, minSize: d } = r(), { mutableValues: u } = o(), f = a();
      if (c && f === l) {
        let m = u.expandToSize ?? d;
        m === 0 && (m = 1), i(m);
      }
    },
    getSize: () => {
      const { group: c } = n(), l = a(), { element: d } = o(), u = c.orientation === "horizontal" ? d.offsetWidth : d.offsetHeight;
      return {
        asPercentage: l,
        inPixels: u
      };
    },
    isCollapsed: () => {
      const { collapsible: c, collapsedSize: l } = r(), d = a();
      return c && pe(l, d);
    },
    resize: (c) => {
      const { group: l } = n(), { element: d } = o(), u = ct({ group: l }), f = pt({
        groupSize: u,
        panelElement: d,
        styleProp: c
      }), m = be(f / u * 100);
      i(m);
    }
  };
}
function Mr(e) {
  if (e.defaultPrevented)
    return;
  const t = Ye();
  Dn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Do({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Ot(e) {
  const t = Ye();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Co({
  groupId: e
}) {
  const t = () => {
    const n = Ye();
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
      } = t(), l = Ze({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (Ge(i, l) || De(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function Ve(e, t) {
  const n = Ot(e), r = Be(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  te(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  te(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = Co({ groupId: n.id }).getLayout(), c = Rt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = Ze({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  Ge(i, l) || De(
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
        e.preventDefault(), n.orientation === "vertical" && Ve(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Ve(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Ve(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Ve(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Ve(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Ot(t), o = Be(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (f) => f.element === t
        );
        te(c, "Matching separator not found");
        const l = i.get(c);
        te(l, "Matching panels not found");
        const d = l[0], u = a.find(
          (f) => f.panelId === d.id
        );
        if (te(u, "Panel metadata not found"), u.collapsible) {
          const f = s[d.id], m = u.collapsedSize === f ? r.mutableState.expandedPanelSizes[d.id] ?? u.minSize : u.collapsedSize;
          Ve(t, m - f);
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
        e.preventDefault(), Ve(t, -100);
        break;
      }
    }
}
function _r(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = Ye(), n = Dn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), st({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function xo({
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
    const { group: d, groupSize: u } = l, { orientation: f, panels: m } = d, { disableCursor: b } = d.mutableState;
    let h = 0;
    a ? f === "horizontal" ? h = (t.clientX - a.x) / u * 100 : h = (t.clientY - a.y) / u * 100 : f === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const S = r.get(d), y = o.get(d);
    if (!S || !y)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: E,
      groupSize: p,
      layout: v,
      separatorToPanels: I
    } = y;
    if (E && v && I) {
      const k = Rt({
        delta: h,
        initialLayout: S,
        panelConstraints: E,
        pivotIndices: l.panels.map((x) => m.indexOf(x)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (Ge(k, v)) {
        if (h !== 0 && !b)
          switch (f) {
            case "horizontal": {
              i |= h < 0 ? To : ko;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Mo : Ao;
              break;
            }
          }
      } else
        De(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: E,
          groupSize: p,
          layout: k,
          separatorToPanels: I
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & vr : c |= i & vr, t.movementY === 0 ? c |= s & wr : c |= i & wr, kl(c), Nn(e);
}
function Nr(e) {
  const t = Ye(), n = qe();
  switch (n.state) {
    case "active":
      xo({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Lr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = qe(), n = Ye();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        st({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Be(a.group.id, !0);
          De(a.group, s, {
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
      xo({
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
      const a = Dn(e, n);
      a.length === 0 ? t.state !== "inactive" && st({
        cursorFlags: 0,
        state: "inactive"
      }) : st({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Nn(e.currentTarget);
      break;
    }
  }
}
function Dr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (qe().state) {
      case "hover":
        st({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Cr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || No(e.currentTarget) && e.preventDefault();
}
function xr(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = be(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = be((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Bl(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = ct({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: be(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function jl(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Ul({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const i = /* @__PURE__ */ new Map(), c = [];
  for (const u of e.panels) {
    const f = r[u.id] ?? 0;
    switch (u.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const m = f / 100 * n, b = be(
          m / t * 100
        );
        i.set(u.id, b), o += b;
        break;
      }
      case "preserve-relative-size":
      default: {
        c.push(u.id), a += f;
        break;
      }
    }
  }
  if (!s || c.length === 0)
    return r;
  const l = 100 - o, d = { ...r };
  if (i.forEach((u, f) => {
    d[f] = u;
  }), a > 0)
    for (const u of c) {
      const f = r[u] ?? 0;
      d[u] = be(
        f / a * l
      );
    }
  else {
    const u = be(
      l / c.length
    );
    for (const f of c)
      d[f] = u;
  }
  return d;
}
function Hl(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const tt = /* @__PURE__ */ new Map();
function Wl(e) {
  let t = !0;
  te(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((b) => {
    for (const h of b) {
      const { borderBoxSize: S, target: y } = h;
      if (y === e.element) {
        if (t) {
          const w = ct({ group: e });
          if (w === 0)
            return;
          const E = Be(e.id);
          if (!E)
            return;
          const p = gn(e), v = E.defaultLayoutDeferred ? xr(p) : E.layout, I = Ul({
            group: e,
            nextGroupSize: w,
            prevGroupSize: E.groupSize,
            prevLayout: v
          }), k = Ze({
            layout: I,
            panelConstraints: p
          });
          if (!E.defaultLayoutDeferred && Ge(E.layout, k) && jl(
            E.derivedPanelConstraints,
            p
          ) && E.groupSize === w)
            return;
          De(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: p,
            groupSize: w,
            layout: k,
            separatorToPanels: E.separatorToPanels
          });
        }
      } else
        Bl(e, y, S);
    }
  });
  a.observe(e.element), e.panels.forEach((b) => {
    te(
      !r.has(b.id),
      `Panel ids must be unique; id "${b.id}" was used more than once`
    ), r.add(b.id), b.onResize && a.observe(b.element);
  });
  const s = ct({ group: e }), i = gn(e), c = e.panels.map(({ id: b }) => b).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Hl(e.panels, l) || (l = void 0));
  const d = e.mutableState.layouts[c] ?? l ?? xr(i), u = Ze({
    layout: d,
    panelConstraints: i
  }), f = e.element.ownerDocument;
  tt.set(
    f,
    (tt.get(f) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Io(e).forEach((b) => {
    b.separator && m.set(b.separator, b.panels);
  }), De(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: u,
    separatorToPanels: m
  }), e.separators.forEach((b) => {
    te(
      !o.has(b.id),
      `Separator ids must be unique; id "${b.id}" was used more than once`
    ), o.add(b.id), b.element.addEventListener("keydown", Ar);
  }), tt.get(f) === 1 && (f.addEventListener("contextmenu", Ir, !0), f.addEventListener("dblclick", Mr, !0), f.addEventListener("pointerdown", _r, !0), f.addEventListener("pointerleave", Nr), f.addEventListener("pointermove", Lr), f.addEventListener("pointerout", Dr), f.addEventListener("pointerup", Cr, !0)), function() {
    t = !1, tt.set(
      f,
      Math.max(0, (tt.get(f) ?? 0) - 1)
    ), _l(e), e.separators.forEach((b) => {
      b.element.removeEventListener("keydown", Ar);
    }), tt.get(f) || (f.removeEventListener(
      "contextmenu",
      Ir,
      !0
    ), f.removeEventListener(
      "dblclick",
      Mr,
      !0
    ), f.removeEventListener(
      "pointerdown",
      _r,
      !0
    ), f.removeEventListener("pointerleave", Nr), f.removeEventListener("pointermove", Lr), f.removeEventListener("pointerout", Dr), f.removeEventListener("pointerup", Cr, !0)), a.disconnect();
  };
}
function Vl() {
  const [e, t] = _({}), n = B(() => t({}), []);
  return [e, n];
}
function Cn(e) {
  const t = $r();
  return `${e ?? t}`;
}
const Xe = typeof window < "u" ? Re : $;
function bt(e) {
  const t = N(e);
  return Xe(() => {
    t.current = e;
  }, [e]), B(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function xn(...e) {
  return bt((t) => {
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
function zn(e) {
  const t = N({ ...e });
  return Xe(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const zo = Sn(null);
function Jl(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: Ml
  });
  En(t, () => n.current, []), Xe(() => {
    Object.assign(
      n.current,
      Co({ groupId: e })
    );
  });
}
function Oo({
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
  resizeTargetMinimumSize: u = {
    coarse: 20,
    fine: 10
  },
  style: f,
  ...m
}) {
  const b = N({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = bt((R) => {
    Ge(b.current.onLayoutChange, R) || (b.current.onLayoutChange = R, c == null || c(R));
  }), S = bt(
    (R, P) => {
      Ge(b.current.onLayoutChanged, R) || (b.current.onLayoutChanged = R, l == null || l(R, { isUserInteraction: P }));
    }
  ), y = Cn(i), w = N(null), [E, p] = Vl(), v = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: u,
    separators: []
  }), I = xn(w, a);
  Jl(y, s);
  const k = bt(
    (R, P) => {
      const T = qe(), M = Er(R), A = Be(R);
      if (A) {
        let j = !1;
        switch (T.state) {
          case "active": {
            j = T.hitRegions.some(
              (z) => z.group === M
            );
            break;
          }
        }
        return {
          flexGrow: A.layout[P] ?? 1,
          pointerEvents: j ? "none" : void 0
        };
      }
      if (n != null && n[P])
        return {
          flexGrow: n == null ? void 0 : n[P]
        };
    }
  ), x = zn({
    defaultLayout: n,
    disableCursor: r
  }), L = G(
    () => ({
      get disableCursor() {
        return !!x.disableCursor;
      },
      getPanelStyles: k,
      id: y,
      orientation: d,
      registerPanel: (R) => {
        const P = v.current;
        return P.panels = bn(d, [
          ...P.panels,
          R
        ]), p(), () => {
          P.panels = P.panels.filter(
            (T) => T !== R
          ), p();
        };
      },
      registerSeparator: (R) => {
        const P = v.current;
        return P.separators = bn(d, [
          ...P.separators,
          R
        ]), p(), () => {
          P.separators = P.separators.filter(
            (T) => T !== R
          ), p();
        };
      },
      updatePanelProps: (R, { disabled: P }) => {
        const T = v.current.panels.find(
          (j) => j.id === R
        );
        T && (T.panelConstraints.disabled = P);
        const M = Er(y), A = Be(y);
        M && A && De(M, {
          ...A,
          derivedPanelConstraints: gn(M)
        });
      },
      updateSeparatorProps: (R, {
        disabled: P,
        disableDoubleClick: T
      }) => {
        const M = v.current.separators.find(
          (A) => A.id === R
        );
        M && (M.disabled = P, M.disableDoubleClick = T);
      }
    }),
    [k, y, p, d, x]
  ), O = N(null);
  return Xe(() => {
    const R = w.current;
    if (R === null)
      return;
    const P = v.current;
    let T;
    if (x.defaultLayout !== void 0 && Object.keys(x.defaultLayout).length === P.panels.length) {
      T = {};
      for (const q of P.panels) {
        const Q = x.defaultLayout[q.id];
        Q !== void 0 && (T[q.id] = Q);
      }
    }
    const M = {
      disabled: !!o,
      element: R,
      id: y,
      mutableState: {
        defaultLayout: T,
        disableCursor: !!x.disableCursor,
        expandedPanelSizes: v.current.lastExpandedPanelSizes,
        layouts: v.current.layouts
      },
      orientation: d,
      panels: P.panels,
      resizeTargetMinimumSize: P.resizeTargetMinimumSize,
      separators: P.separators
    };
    O.current = M;
    const A = Wl(M), { defaultLayoutDeferred: j, derivedPanelConstraints: z, layout: J } = Be(M.id, !0);
    !j && z.length > 0 && (h(J), S(J, !1));
    const oe = Ln(y, (q) => {
      const { defaultLayoutDeferred: Q, derivedPanelConstraints: me, layout: ae } = q.next;
      if (Q || me.length === 0)
        return;
      const se = M.panels.map(({ id: V }) => V).join(",");
      M.mutableState.layouts[se] = ae, me.forEach((V) => {
        if (V.collapsible) {
          const { layout: ee } = q.prev ?? {};
          if (ee) {
            const fe = pe(
              V.collapsedSize,
              ae[V.panelId]
            ), U = pe(
              V.collapsedSize,
              ee[V.panelId]
            );
            fe && !U && (M.mutableState.expandedPanelSizes[V.panelId] = ee[V.panelId]);
          }
        }
      });
      const ye = qe().state !== "active";
      h(ae), ye && S(ae, q.isUserInteraction);
    });
    return () => {
      O.current = null, A(), oe();
    };
  }, [
    o,
    y,
    S,
    h,
    d,
    E,
    x
  ]), $(() => {
    const R = O.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ g(zo.Provider, { value: L, children: /* @__PURE__ */ g(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": y,
      id: y,
      ref: I,
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
Oo.displayName = "Group";
function On() {
  const e = Rn(zo);
  return te(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Kl(e, t) {
  const { id: n } = On(), r = N({
    collapse: rn,
    expand: rn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: rn
  });
  En(t, () => r.current, []), Xe(() => {
    Object.assign(
      r.current,
      Do({ groupId: n, panelId: e })
    );
  });
}
function yn({
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
  onResize: u,
  panelRef: f,
  style: m,
  ...b
}) {
  const h = !!c, S = Cn(c), y = zn({
    disabled: a
  }), w = N(null), E = xn(w, s), {
    getPanelStyles: p,
    id: v,
    orientation: I,
    registerPanel: k,
    updatePanelProps: x
  } = On(), L = u !== null, O = bt(
    (M, A, j) => {
      u == null || u(M, c, j);
    }
  );
  Xe(() => {
    const M = w.current;
    if (M !== null) {
      const A = {
        element: M,
        id: S,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: L ? O : void 0,
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
      return k(A);
    }
  }, [
    i,
    n,
    r,
    o,
    L,
    S,
    h,
    l,
    d,
    O,
    k,
    y
  ]), $(() => {
    x(S, { disabled: a });
  }, [a, S, x]), Kl(S, f);
  const R = () => {
    const M = p(v, S);
    if (M)
      return JSON.stringify(M);
  }, P = Fr(
    (M) => Ln(v, M),
    R,
    R
  );
  let T;
  return P ? T = JSON.parse(P) : o !== void 0 ? T = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : T = { flexGrow: 1 }, /* @__PURE__ */ g(
    "div",
    {
      ...b,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": S,
      id: S,
      ref: E,
      style: {
        ...ql,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...T
      },
      children: /* @__PURE__ */ g(
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
            touchAction: I === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
yn.displayName = "Panel";
const ql = {
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
function Gl({
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
    a = Ze({
      layout: Rt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Ze({
      layout: Rt({
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
function Fo({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = Cn(a), l = zn({
    disabled: n,
    disableDoubleClick: r
  }), [d, u] = _({}), [f, m] = _("inactive"), [b, h] = _(!1), S = N(null), y = xn(S, o), {
    disableCursor: w,
    id: E,
    orientation: p,
    registerSeparator: v,
    updateSeparatorProps: I
  } = On(), k = p === "horizontal" ? "vertical" : "horizontal";
  Xe(() => {
    const O = S.current;
    if (O !== null) {
      const R = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: O,
        id: c
      }, P = v(R), T = Tl(
        (A) => {
          m(
            A.next.state !== "inactive" && A.next.hitRegions.some(
              (j) => j.separator === R
            ) ? A.next.state : "inactive"
          );
        }
      ), M = Ln(
        E,
        (A) => {
          const { derivedPanelConstraints: j, layout: z, separatorToPanels: J } = A.next, oe = J.get(R);
          if (oe) {
            const q = oe[0], Q = oe.indexOf(q);
            u(
              Gl({
                layout: z,
                panelConstraints: j,
                panelId: q.id,
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
  }, [E, c, v, l]), $(() => {
    I(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, I]);
  let x;
  n && !w && (x = "not-allowed");
  let L;
  if (n)
    L = "disabled";
  else
    switch (f) {
      case "active": {
        L = "active";
        break;
      }
      default:
        b ? L = "focus" : L = f;
    }
  return /* @__PURE__ */ g(
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
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: y,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: x,
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
Fo.displayName = "Separator";
const Fn = 30, $n = 65, Et = 50, Zl = 100 - $n, Yl = 100 - Fn;
function Xl(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min($n, Math.max(Fn, t)) : Et;
}
function Bn(e) {
  return 100 - e;
}
function nt(e) {
  return `${e}%`;
}
const jn = "reader-document", It = "reader-assistant", $o = "retainpdf.reader.ai-split-layout.v1", Ql = {
  [jn]: Bn(Et),
  [It]: Et
};
function Un(e) {
  const t = Xl(e == null ? void 0 : e[It]);
  return {
    [jn]: Bn(t),
    [It]: t
  };
}
function ed() {
  try {
    const e = JSON.parse(localStorage.getItem($o) || "null");
    return Un(e);
  } catch {
    return Ql;
  }
}
function td(e) {
  try {
    localStorage.setItem($o, JSON.stringify(Un(e)));
  } catch {
  }
}
function on(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Un(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[It]}vw`
  );
}
function nd() {
  const e = N(null), [t] = _(ed);
  Re(() => {
    const o = e.current;
    return on(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = B((o) => {
    on(e.current, o);
  }, []), r = B((o, a) => {
    on(e.current, o), a.isUserInteraction && td(o);
  }, []);
  return /* @__PURE__ */ F(
    Oo,
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
        /* @__PURE__ */ g(
          yn,
          {
            id: jn,
            defaultSize: nt(Bn(Et)),
            minSize: nt(Zl),
            maxSize: nt(Yl)
          }
        ),
        /* @__PURE__ */ g(
          Fo,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ g("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ g(
          yn,
          {
            id: It,
            defaultSize: nt(Et),
            minSize: nt(Fn),
            maxSize: nt($n)
          }
        )
      ]
    }
  );
}
function rd({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = _(!1);
  if ($(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ F("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ F("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ g(ge, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
    /* @__PURE__ */ g(
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
function od({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ g(rd, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ F(lt, { children: [
    e ? /* @__PURE__ */ g("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ F("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ g("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ g("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ g(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ F("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ g("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ g(ge, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function ad(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function sd() {
  const [e, t] = _(!1), n = $r(), r = N(null);
  return $(() => {
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
  }, [e]), $(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || ad(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ F("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ g(da, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ F(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ F("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ g("strong", { children: "快捷键" }),
            /* @__PURE__ */ g(
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
          /* @__PURE__ */ g("div", { className: "reader-react-shortcuts-body", children: Ri.map((o) => /* @__PURE__ */ F("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ g("h3", { children: o.title }),
            /* @__PURE__ */ g("ul", { children: o.items.map((a) => /* @__PURE__ */ F("li", { children: [
              /* @__PURE__ */ g("kbd", { children: a.keys }),
              /* @__PURE__ */ g("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ g("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const id = ["source", "sideBySide", "translated"], cd = { source: "", translated: "", sideBySide: "" };
function ld(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Ft(e.sourceUrl), n = Ft(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return _a({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function dd(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = G(
    () => e ? ld(e) : cd,
    [e]
  ), o = G(
    () => id.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = B(async (s) => {
    if (!e) return;
    const i = Ft(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Aa(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Na(
          e.fetchProtected,
          i,
          c,
          c,
          null,
          (l) => n((d) => {
            const u = new Set(d);
            return l ? u.add(s) : u.delete(s), u;
          })
        );
      } catch (c) {
        const l = c instanceof Error ? c.message : "下载失败";
        La(l), n((d) => {
          const u = new Set(d);
          return u.delete(s), u;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const ud = {
  source: jr,
  sideBySide: Ur,
  translated: Hr
}, fd = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function md(e) {
  const t = Ue(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = dd(n), i = N(null);
  return $(() => {
    const c = () => {
      var u;
      (u = i.current) != null && u.open && (i.current.open = !1);
    }, l = (u) => {
      i.current && !i.current.contains(u.target) && c();
    }, d = (u) => {
      u.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", l), document.addEventListener("keydown", d), () => {
      document.removeEventListener("pointerdown", l), document.removeEventListener("keydown", d);
    };
  }, []), /* @__PURE__ */ F("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ F("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ g(ua, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ g(Br, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = Jo[c], d = Ft(r[c]), u = a.has(c), f = !!d && !u, m = f ? "" : Ko(c, r), b = ud[c];
      return /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          id: `reader-download-${c}`,
          className: `reader-download-action${u ? " is-busy" : ""}`,
          disabled: !f,
          "aria-label": f ? `下载${l.label}` : m,
          onClick: () => {
            i.current && (i.current.open = !1), s(c);
          },
          children: [
            /* @__PURE__ */ g(b, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ F("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ F("span", { className: "reader-download-action-label", children: [
                fd[c],
                " PDF"
              ] }),
              m ? /* @__PURE__ */ g("span", { className: "reader-download-action-reason", children: m }) : null
            ] })
          ]
        },
        c
      );
    }) })
  ] });
}
const hd = "retainpdf:reader:bookmarks:v1:", pd = 200;
function Hn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Bo(e) {
  const t = `${e || ""}`.trim();
  return t ? `${hd}${t}` : "";
}
function gd(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Vt(e, t = Hn()) {
  const n = Bo(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = gd(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function vn(e, t, n) {
  const r = Bo(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, pd);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function bd(e, t, n = "", { storage: r = Hn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Vt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? vn(e, a.filter((i) => i.page !== s), r) : vn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function yd(e, t, n = Hn()) {
  return vn(e, Vt(e, n).filter((r) => r.page !== t), n);
}
function vd(e, t) {
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
function wd({ filled: e }) {
  return /* @__PURE__ */ g("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ g("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Sd({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = _(() => Vt(e)), [i, c] = _(!1), l = N(null);
  if ($(() => {
    s(Vt(e)), c(!1);
  }, [e]), $(() => {
    if (!i) return;
    const f = (b) => {
      l.current && !l.current.contains(b.target) && c(!1);
    }, m = (b) => {
      b.key === "Escape" && c(!1);
    };
    return document.addEventListener("pointerdown", f), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", f), document.removeEventListener("keydown", m);
    };
  }, [i]), !e || n <= 0) return null;
  const d = Math.min(Math.max(t, 1), n), u = a.some((f) => f.page === d);
  return /* @__PURE__ */ F("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${u ? " is-marked" : ""}`,
        "aria-pressed": u,
        "aria-label": u ? `取消第 ${d} 页的书签` : `给第 ${d} 页加书签`,
        title: u ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(bd(e, d, vd(r, d))),
        children: /* @__PURE__ */ g(wd, { filled: u })
      }
    ),
    a.length ? /* @__PURE__ */ F(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": i,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        onClick: () => c((f) => !f),
        children: [
          /* @__PURE__ */ g(fa, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ g("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ g("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ g("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ F("li", { className: f.page === d ? "is-current" : "", children: [
      /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), c(!1);
          },
          children: [
            /* @__PURE__ */ F("span", { className: "reader-bookmark-page", children: [
              "第 ",
              f.page,
              " 页"
            ] }),
            f.label ? /* @__PURE__ */ g("span", { className: "reader-bookmark-label", children: f.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ g(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${f.page} 页的书签`,
          onClick: () => s(yd(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
const Rd = 48, Ed = 96, Id = 700;
function Pd(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Rd, downSoFar: r };
}
function Td(e) {
  const [t, n] = _(!1), r = N(0);
  return $(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), c = () => {
      const f = e.current;
      return !!(f && (f.querySelector(":focus-visible") || f.querySelector("[aria-expanded='true']")));
    }, l = (f) => {
      const m = f.target;
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${je}]`)), !i.get(m))) return;
      const b = m.scrollTop, h = o.get(m);
      if (o.set(m, b), h === void 0 || Date.now() - a > Id) return;
      const S = Pd(!1, r.current, b - h);
      r.current = S.downSoFar, b - h < -4 ? n(!1) : S.hidden && !c() && n(!0);
    }, d = (f) => {
      f.clientY >= window.innerHeight - Ed && (r.current = 0, n(!1));
    }, u = () => {
      c() && n(!1);
    };
    document.addEventListener("scroll", l, { capture: !0, passive: !0 }), window.addEventListener("pointermove", d, { passive: !0 }), document.addEventListener("focusin", u);
    for (const f of ["wheel", "touchmove", "keydown"]) window.addEventListener(f, s, { passive: !0, capture: !0 });
    return () => {
      for (const f of ["wheel", "touchmove", "keydown"]) window.removeEventListener(f, s, { capture: !0 });
      document.removeEventListener("scroll", l, { capture: !0 }), window.removeEventListener("pointermove", d), document.removeEventListener("focusin", u);
    };
  }, [e]), t;
}
function kd(e) {
  const t = Ue(), n = vo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? kt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = Es(a), u = a > Gr + 1e-3, f = a < Ht - 1e-3, m = rt(r, Ke()), b = m >= Ht ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = N(null), S = Td(h), [y, w] = _(!1), [E, p] = _(`${i}`);
  $(() => {
    y || p(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, y]);
  const v = () => {
    if (w(!1), !l || c <= 0)
      return;
    const I = Number(`${E}`.trim());
    l(Wt(I, c));
  };
  return /* @__PURE__ */ F("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": S ? "true" : void 0, children: [
    o ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "页码", children: y ? /* @__PURE__ */ F(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (I) => {
          I.preventDefault(), v();
        },
        children: [
          /* @__PURE__ */ g(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: E,
              autoFocus: !0,
              onChange: (I) => p(I.target.value.replace(/[^\d]/g, "")),
              onBlur: v,
              onKeyDown: (I) => {
                I.key === "Escape" && (I.preventDefault(), w(!1), p(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ F("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            c || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": c > 0 ? `跳转页码，当前第 ${i} 页，共 ${c} 页` : "页码",
        title: c > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || c <= 0,
        onClick: () => {
          !l || c <= 0 || (p(`${i}`), w(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ g(
      Sd,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ F("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ g(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !u,
          onClick: () => s(wt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ F(
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
      /* @__PURE__ */ g(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !f,
          onClick: () => s(wt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ g(sd, {}) })
  ] });
}
function zr(e) {
  var t, n;
  return Qr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Md(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: zr(ke(e))
  }));
  $(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: zr(ke(e))
    });
  }, [e]), $(() => {
    t.scope === e && qt(t.scope, {
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
const wn = "download-toast";
function Ad({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ F("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ F("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ g("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ g("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ g("div", { className: "download-toast-track", children: /* @__PURE__ */ g("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ g("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function _d(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    sn.dismiss(wn);
    return;
  }
  sn.custom(
    () => /* @__PURE__ */ g(Ad, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: wn, duration: 1 / 0 }
  );
}
function Nd() {
  const e = B((t) => {
    t && (t.setState = _d, t.hide = () => sn.dismiss(wn));
  }, []);
  return /* @__PURE__ */ F(lt, { children: [
    /* @__PURE__ */ g(aa, { position: "bottom-right" }),
    /* @__PURE__ */ g("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Ld(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Zr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Dd(e, t) {
  return t === null || e !== t;
}
function Cd(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
function xd(e, t) {
  const n = e === t;
  return { open: n, mounted: Cd(n) };
}
const Or = { itemId: null, origin: null };
function zd() {
  let e = Or;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Or : { itemId: n, origin: r };
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
const Od = [];
function Fd({ open: e, onToggle: t }) {
  return /* @__PURE__ */ F("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ F(ge, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ g(ma, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ F(ge, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ g(ha, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { children: "搜索" })
    ] })
  ] });
}
function $d({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0
}) {
  var p, v;
  const c = ((p = Ue()) == null ? void 0 : p.regions) ?? Od, l = ((v = vo()) == null ? void 0 : v.currentPage) ?? 1, d = G(() => xc(c), [c]), u = zc(d, l), f = G(() => $c(c, s), [c, s]), [m, b] = _(-1);
  $(() => b(-1), [s]);
  const h = N(null), S = N(null), y = N(n);
  y.current = n, $(() => {
    const I = (x) => {
      var O, R;
      const L = x.target;
      !L || (O = S.current) != null && O.contains(L) || (R = L.closest) != null && R.call(L, ".reader-finder-toggles") || y.current();
    }, k = (x) => {
      x.key === "Escape" && y.current();
    };
    return document.addEventListener("pointerdown", I, !0), document.addEventListener("keydown", k), () => {
      document.removeEventListener("pointerdown", I, !0), document.removeEventListener("keydown", k);
    };
  }, []);
  const w = N(null);
  $(() => {
    var I, k, x;
    e === "search" ? (I = h.current) == null || I.focus() : (x = (k = w.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null || x.scrollIntoView({ block: "center" });
  }, [e, i]), $(() => {
    var I, k;
    e === "search" && m >= 0 && ((k = (I = w.current) == null ? void 0 : I.querySelector('[aria-current="true"]')) == null || k.scrollIntoView({ block: "nearest" }));
  }, [e, m]);
  const E = (I) => {
    const k = f[I];
    k && (b(I), r(k.itemId));
  };
  return /* @__PURE__ */ F("aside", { ref: S, className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ F("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ F("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ g(ge, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ g(ge, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ g(ge, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ g(Pn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ g("ol", { ref: w, className: "reader-finder-list", children: d.map((I, k) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ F(
      ge,
      {
        className: "reader-finder-entry",
        "data-level": I.level,
        "aria-current": k === u ? "location" : void 0,
        onClick: () => r(I.itemId),
        children: [
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-text", children: I.text }),
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: I.page })
        ]
      }
    ) }, I.itemId)) }) : /* @__PURE__ */ g("p", { className: "reader-finder-empty", children: c.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ F(lt, { children: [
      /* @__PURE__ */ F("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ g(
          Wr,
          {
            ref: h,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (I) => a(I.target.value),
            onKeyDown: (I) => {
              I.key === "Enter" ? (I.preventDefault(), E(jc(m, f.length, I.shiftKey))) : I.key === "Escape" && (I.preventDefault(), n()), I.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ g("p", { className: "reader-finder-count", "aria-live": "polite", children: f.length === 0 ? "没有找到" : `${m >= 0 ? `第 ${m + 1} / ` : ""}${f.length >= 200 ? "200+ 处，只列前 200 处" : `${f.length} 处`}${m < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ g("ol", { className: "reader-finder-list", children: f.map((I, k) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ F(ge, { className: "reader-finder-entry is-hit", "aria-current": k === m ? "true" : void 0, onClick: () => E(k), children: [
        /* @__PURE__ */ F("span", { className: "reader-finder-entry-text", children: [
          I.snippet.slice(0, I.at),
          /* @__PURE__ */ g("mark", { children: I.snippet.slice(I.at, I.at + I.length) }),
          I.snippet.slice(I.at + I.length)
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: I.page })
      ] }) }, I.itemId)) })
    ] })
  ] });
}
const Bd = "reader-finder-input";
function jd(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Ud(e, t = typeof window > "u" ? null : window) {
  $(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!jd(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Bd) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Hd() {
  try {
    return Tt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Wd = "这本书正在处理（翻译或排版），处理完才能改。", Vd = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Jd({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Hd(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = dc(s), l = !t || yt(t), d = gc(n), [u, f] = _(""), [m, b] = _(null), [h, S] = _(() => /* @__PURE__ */ new Map()), [y, w] = _(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [E, p] = _(() => /* @__PURE__ */ new Map()), [v, I] = _({ phase: "idle" }), k = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  $(() => {
    b(null), k.drafts.clear(), k.generation.current = null, p(/* @__PURE__ */ new Map()), I({ phase: "idle" });
  }, [s]), $(() => {
    if (f(""), !i || c || !a) return;
    let A = !1;
    return a.resolveOwnerJobId(s).then((j) => {
      A || f(`${j || s}`.trim() || s);
    }).catch(() => {
      A || f(s);
    }), () => {
      A = !0;
    };
  }, [i, c, a, s]), $(() => {
    if (S(/* @__PURE__ */ new Map()), !a || !u || !d || !l) return;
    let A = !1;
    return a.fetchRevisions(u).then((j) => {
      A || S(bc(j, d));
    }).catch(() => {
    }), () => {
      A = !0;
    };
  }, [a, u, d, l]);
  const x = v.phase === "running" && v.seenActive;
  $(() => {
    if (v.phase === "running") {
      if (!l) {
        x || I({ phase: "running", seenActive: !0 });
        return;
      }
      x && I(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [v.phase, x, l, t]);
  const L = G(() => {
    const A = new Map(h);
    if (y.renderedAt === d)
      for (const [j, z] of y.edits) A.set(j, z);
    return A;
  }, [h, y, d]), O = B((A) => {
    const j = `${A || ""}`.trim();
    j && b({ itemId: j, page: uc(j) });
  }, []), R = B(() => b(null), []), P = B((A, j) => {
    w((z) => {
      const J = new Map(z.renderedAt === d ? z.edits : []);
      return J.set(A, j), { renderedAt: d, edits: J };
    }), p((z) => new Map(z).set(A, (z.get(A) || 0) + 1));
  }, [d]), T = B(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      I({ phase: "submitting" });
      try {
        await a.rerender(s), I({ phase: "running", seenActive: !1 }), await o();
      } catch (A) {
        I({ phase: "failed", message: (A == null ? void 0 : A.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), M = c ? Vd : !l || v.phase === "running" || v.phase === "submitting" ? Wd : "";
  return G(() => ({
    available: i,
    blockedReason: M,
    port: a,
    ownerJobId: u,
    target: m,
    select: O,
    close: R,
    memory: k,
    pendingEdits: L,
    savedCounts: E,
    markSaved: P,
    rerender: v,
    startRerender: T
  }), [i, M, a, u, m, O, R, k, L, E, P, v, T]);
}
function Kd(e, t) {
  $(() => {
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
function qd({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ g("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ F("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ g("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ g(
      ge,
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
const Gd = Ho(() => import("./ReaderMarkdownPanel-CcGqnJmg.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Zd(e) {
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
function Yd(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Xd() {
  const e = wi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Md(e.viewStateKey), s = a.panel, i = a.setPanel, [c, l] = _(!1), d = N(null), u = N(null), f = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, b = Zd({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: c,
    assistantOpen: f
  }), h = ui({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: b.showSource,
    liveTranslationVisible: c,
    assistantOpen: f
  }), S = b.sourceViewOnly, y = b.visibleMode;
  $(() => {
    l(!1);
  }, [e.viewStateKey]), $(() => {
    e.session.jobTerminal && l(!1);
  }, [e.session.jobTerminal]), $(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const U = ke(e.viewStateKey), Y = Ld({
          savedMode: U == null ? void 0 : U.mode,
          sourceViewOnly: S,
          viewportWidth: Ke()
        });
        u.current = Y.auto ? Y.mode : null, Y.mode && Y.mode !== e.mode && e.setModeKeepingPage(Y.mode);
        return;
      }
      Dd(e.mode, u.current) && (u.current = null, qt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, S]);
  const w = s || (e.mode === "compare" ? "compare" : "reading"), E = xd(s, "markdown");
  ki({
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
  const p = B(() => {
    i(null);
  }, []), v = B((U) => {
    const Y = Yd(U, e.liveTranslationAvailable);
    Y !== null && l(Y), e.setModeKeepingPage(U);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), I = G(() => h.sourcePaneToggle ? /* @__PURE__ */ g(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${c ? " is-active" : ""}`,
      onClick: () => l((U) => !U),
      "aria-pressed": c,
      title: c ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [h.sourcePaneToggle, c]), k = B((U) => {
    i(U);
  }, []), [x] = _(zd), [L, O] = _(null), R = B((U) => O((Y) => Y === U ? null : U), []), [P, T] = _(""), [M, A] = _("");
  $(() => {
    const U = P.replace(/\s+/gu, " ").trim(), Y = window.setTimeout(() => A(U), U ? 150 : 0);
    return () => window.clearTimeout(Y);
  }, [P]);
  const [j, z] = _(0), J = B(() => {
    O("search"), z((U) => U + 1);
  }, []);
  Ud(J);
  const oe = B((U) => {
    e.jumpToAnchor({ block_id: U }), (L === "outline" || Ke() < 900) && O(null);
  }, [e.jumpToAnchor, L]), q = B((U) => e.jumpToAnchor({ block_id: U }), [e.jumpToAnchor]), Q = Jd({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), me = Q.select, ae = e.setModeKeepingPage, se = B((U) => {
    y === "source" && ae("compare"), me(U);
  }, [me, y, ae]);
  Kd(Q.available ? se : null, x);
  const ye = G(() => {
    if (!Q.savedCounts.size) return e.revisedBlocks;
    const U = new Map(e.revisedBlocks);
    for (const [Y, He] of Q.savedCounts) U.set(Y, (U.get(Y) || 0) + He);
    return U;
  }, [e.revisedBlocks, Q.savedCounts]), V = G(() => ({
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
    regionHover: x,
    jumpToBlock: q,
    revisedBlocks: ye,
    editBlock: Q.available ? se : void 0,
    blockEdit: Q,
    editShowsSource: y !== "compare",
    findTerm: L === "search" ? M : "",
    sourceOnly: e.sourceOnly,
    sourceViewOnly: S,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: k, close: p }
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
    x,
    q,
    ye,
    Q,
    se,
    y,
    L,
    M,
    e.sourceOnly,
    S,
    e.download,
    e.goToPage,
    k,
    p
  ]), ee = G(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), fe = [
    hs,
    `is-workspace-${w}`,
    f ? "is-assistant-open" : "",
    L ? "is-finder-open" : "",
    b.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ g(Mc, { value: V, hud: ee, children: /* @__PURE__ */ F("div", { className: fe, "data-reader-engine": "react-pdf", "data-reader-workspace": w, children: [
    /* @__PURE__ */ g(od, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
    /* @__PURE__ */ g(Fd, { open: L, onToggle: R }),
    L ? /* @__PURE__ */ g(
      $d,
      {
        tab: L,
        onTab: O,
        onClose: () => O(null),
        onJump: oe,
        query: P,
        onQuery: T,
        term: M,
        focusSignal: j
      }
    ) : null,
    /* @__PURE__ */ F("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ g(pl, { active: s }),
      /* @__PURE__ */ g(md, {}),
      /* @__PURE__ */ g(Ci, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ g(
      fl,
      {
        mode: y,
        documentReady: !!o.jobId,
        sourceViewOnly: S,
        onModeChange: v,
        liveTranslation: h.topBarPill ? {
          visible: c,
          state: e.liveTranslation,
          onToggle: () => l((U) => !U)
        } : null
      }
    ),
    /* @__PURE__ */ g(gl, { active: s }),
    f ? /* @__PURE__ */ g(nd, {}) : null,
    /* @__PURE__ */ g(cl, { paneComposition: b, markdownSplit: E.open, assistantSplit: f, liveTranslation: e.liveTranslation, sourcePaneAction: I }),
    e.showHud ? /* @__PURE__ */ g(
      kd,
      {
        mode: y,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ g(Uo, { fallback: null, children: E.mounted ? /* @__PURE__ */ g(Gd, { open: E.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: p }) : null }),
    /* @__PURE__ */ g(qd, { edit: Q }),
    /* @__PURE__ */ g(Nd, {})
  ] }) });
}
function bu() {
  return /* @__PURE__ */ g(Xd, {});
}
export {
  bu as R,
  Xd as a,
  pu as d,
  hu as f,
  gu as r,
  Ue as u
};
//# sourceMappingURL=ReaderApp-BkOv4ycB.js.map
