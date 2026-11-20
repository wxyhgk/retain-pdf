var Kn = (e) => {
  throw TypeError(e);
};
var Jn = (e, t, n) => t.has(e) || Kn("Cannot " + n);
var mt = (e, t, n) => (Jn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), qn = (e, t, n) => t.has(e) ? Kn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Gn = (e, t, n, r) => (Jn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as et } from "react/jsx-runtime";
import { useMemo as q, useState as N, useEffect as x, useCallback as z, useRef as A, useLayoutEffect as Re, memo as qt, createContext as En, useContext as Pn, forwardRef as Vr, useImperativeHandle as Tn, useSyncExternalStore as Kr, useId as Jr, Suspense as ra, lazy as oa } from "react";
import { requireAdapter as ft, getReaderAdapters as ke } from "./adapters.js";
import { resolveReaderDownloadName as aa, resolveReaderDownloadUrls as sa, READER_PROGRESS_COPY as Ce, trimString as Bt, READER_DOWNLOAD_ACTIONS as ia, disabledReason as la } from "./runtime/state.js";
import { r as ca, b as da } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as ln, isFinishedJobStatus as wt } from "@retainpdf/domain/job";
import { n as qr, d as ua, f as Yt, k as Zn, b as fa, c as ma, j as kt, p as kn, g as ha, l as Yn, i as pa } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as ga } from "@retainpdf/api/documents";
import { isReaderTransportError as ba, createReaderTransportError as ya } from "./contracts.js";
import { toast as cn, Toaster as va } from "sonner";
import { X as Nt, ChevronUp as wa, ChevronDown as Gr, History as Sa, Check as Ra, LoaderCircle as Ia, Pin as Ea, LogOut as Pa, Radio as Ta, FileText as Zr, Columns2 as Yr, Languages as Xr, Keyboard as ka, Download as Na, ListOrdered as Ma, TriangleAlert as Aa, ListTree as _a, Search as La, PenLine as Qr, GitCompareArrows as Da, LayoutGrid as Ca, Highlighter as xa, Eraser as za, Undo2 as Oa, Trash2 as $a } from "lucide-react";
import { Button as oe, Textarea as Fa, IconButton as Xn, Input as eo } from "@retainpdf/ui";
import { pdfjs as to, Page as Ba, Document as ja } from "react-pdf";
import { e as Ua, m as Ha, a as Wa } from "./markdown-math-XkF5urpn.js";
const Va = (...e) => {
  var t, n;
  return ((n = (t = ke()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ka = "", Ja = Object.freeze({
  progress: "retainpdf-reader-progress"
}), qa = (e) => {
  var t, n;
  return ((n = (t = ke()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, mf = (...e) => {
  var n;
  return (((n = ke()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, xe = () => ft("defaultReaderDataPort"), Qn = () => ft("defaultReaderPageConfigPort"), hf = {
  get apiPrefix() {
    return xe().apiPrefix;
  },
  fetchProtected: (...e) => xe().fetchProtected(...e),
  loadMarkdownPayload: (e) => xe().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => xe().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => xe().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => xe().loadJobPayload(e),
  loadReaderPayload: (e, t) => xe().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => xe().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return xe().liveTranslation;
  }
}, no = {
  messageTargetOrigin: () => Qn().messageTargetOrigin(),
  readerJobId: () => Qn().readerJobId()
}, Ga = () => {
  var e;
  return ((e = ke()) == null ? void 0 : e.liveTranslation) ?? null;
}, St = () => {
  var t;
  const e = ke();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ke = () => {
  const e = ke();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => ft("fetchDocumentByJobId")(...n),
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
}, Za = (...e) => {
  var t, n;
  return ((n = (t = ke()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Ya = () => {
  var e, t;
  return ((t = (e = ke()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Xa = (...e) => {
  var t, n;
  return ((n = (t = ke()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Qa = (...e) => {
  var t, n;
  return ((n = (t = ke()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? aa(...e);
}, es = (...e) => {
  var t, n;
  return ((n = (t = ke()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? sa(...e);
}, ts = (...e) => ft("downloadProtectedResource")(...e), ns = (...e) => ft("failDownloadToast")(...e), pf = (e, t) => ft("resolveMarkdownAssetUrl")(e, t), er = "/api/v1";
function rs() {
  const e = () => {
    var r;
    return ca(
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
function os() {
  const e = rs(), t = q(() => Xa(no), [e]), n = q(() => Ya(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function as(e) {
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
  }), v = h.jobId === b ? h.documentId : "", w = t || v, R = !!t && !b, [g, S] = N(null), E = (g == null ? void 0 : g.sessionIdentity) === r && g.documentId === w ? g : null, k = R || !!E, O = z((F) => {
    const I = `${F.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const P = `${F.revision || ""}`.trim() || `${Date.now()}`;
    S({
      documentId: I,
      revision: P,
      sessionIdentity: o.current
    }), i();
  }, []);
  x(() => {
    S((F) => F && F.sessionIdentity !== r ? null : F);
  }, [r]);
  const D = z((F) => {
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
        y((I) => I.jobId === F.jobId && I.documentId === F.documentId ? I : { jobId: F.jobId, documentId: F.documentId });
        break;
      case "committed-source":
        S({
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
    documentId: w,
    sourceOnly: R,
    committedDocumentSource: g,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: E,
    sourceViewOnly: k,
    refreshCommittedDocument: O,
    applyIdentityEvent: D
  };
}
function tr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function ss(e) {
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
function nr(e, t) {
  return qa(ln(e, t));
}
function is(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function ls(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !is(a, t))
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
        type: Ja.progress,
        stage: n,
        percent: e,
        text: t
      },
      no.messageTargetOrigin()
    );
  } catch {
  }
}
function jt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), dn({ percent: t, text: n, stage: r });
}
function cs(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = N(null), [c, d] = N(null), [f, u] = N(""), [m, b] = N(0), h = f === n ? i : null, y = f === n ? c : null, v = tr(h), w = wt(v), R = z(() => {
    b((D) => D + 1);
  }, []), g = z((D) => {
    l(D.jobPayload), d(D.manifestPayload), u(D.sessionIdentity);
  }, []), S = z((D) => {
    l(null), d(null), u(D);
  }, []), E = A(""), k = A(""), O = z(async () => {
    const D = o.current;
    if (!D || E.current === D) return;
    const F = Ke().loadJobPayload;
    if (typeof F != "function") return;
    const I = a.current.value;
    E.current = D;
    try {
      const P = await F(D);
      if (s.current || a.current.value !== I || o.current !== D || !P || typeof P != "object")
        return;
      const T = tr(P);
      l(P), u(r.current), !wt(T) && k.current === D && (k.current = ""), T === "succeeded" && k.current !== D && (k.current = D, b((M) => M + 1));
    } catch {
    } finally {
      E.current === D && (E.current = "");
    }
  }, []);
  return x(() => {
    k.current = "";
  }, [n]), x(() => {
    if (!t || w || !h) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [w, O, h, t]), {
    jobPayload: i,
    setJobPayload: l,
    manifestPayload: c,
    setManifestPayload: d,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: u,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: v,
    jobTerminal: w,
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
function ds(e, t) {
  e(t), un(t);
}
function us(e) {
  const [t, n] = N(e ? "source" : "compare"), r = z((a) => {
    e && a !== "source" || (n(a), un(a));
  }, [e]), o = z((a) => {
    ds(n, a);
  }, []);
  return x(() => (e && document.documentElement.classList.add("reader-source-only"), un(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function rr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function fs(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: rr(n.active_job_id),
    activeVersionId: rr(n.active_version_id)
  };
}
function ms(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function hs(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function ps(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const gs = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function bs(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = gs.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const ys = 48 * 1024 * 1024;
function vs(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const ws = 2, Se = /* @__PURE__ */ new Map();
function fn(e, t) {
  Se.delete(e), Se.set(e, t);
}
function or(e) {
  if (Se.size < ws) return;
  const t = Se.keys().next().value;
  t && Se.delete(t);
}
async function Ss(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function ro(e, t = St().fetchProtected, n = {}) {
  var d, f, u, m, b, h, y, v, w;
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
    const g = await Ss(s);
    throw g && (R.reason = g), R;
  }
  const i = Rs(r, s, t);
  if (i) {
    o.abort();
    const R = { ranged: i };
    return or(), Se.set(r, R), R;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (w = (v = n.signal) == null ? void 0 : v.removeEventListener) == null || w.call(v, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return Se.has(r) ? fn(r, c) : (or(), Se.set(r, c)), c;
}
function Rs(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < ys ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const Is = { file: null, loading: !1, error: "" }, Es = { file: null, loading: !0, error: "" };
function Ps(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (x(() => {
    if (t || !n) return;
    const s = Se.get(n);
    if (s) {
      fn(n, s);
      return;
    }
    const i = new AbortController();
    return ro(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Is;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Se.get(n);
  return a ? { file: a, loading: !1, error: "" } : Es;
}
function Ts(e) {
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
  jt(s, r, n, "download");
  const i = await ro(t, St().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (jt(s, o, n, "download"), i);
}
async function ks(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  jt(o, 25, "正在下载 PDF…", "download");
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
function Ns(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ms({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = ga,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Ns(o.href, t, a)), !0);
}
const Dt = {
  regions: null,
  metadata: null
};
function As(e) {
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
  } = e, [w, R] = N(""), [g, S] = N(""), [E, k] = N(null), [O, D] = N(null), [F, I] = N(!1), [P, T] = N(""), [M, _] = N([]), [H, $] = N(!1), [G, te] = N(() => ({
    source: null,
    translated: null
  })), [Y, X] = N(
    Dt
  ), [me, le] = N({
    loading: !0,
    percent: 4,
    text: Ce.boot,
    stage: "progress",
    failed: !1
  });
  return x(() => {
    const ce = new AbortController(), he = h.current.value, K = Ts({
      sessionEpochRef: h,
      closingRef: y,
      abort: ce,
      sessionEpoch: he
    });
    v.current = ce;
    const Q = Ke();
    if (y.current)
      return ce.abort(), () => {
        v.current === ce && (v.current = null);
      };
    let pe = !1;
    function ue(ee, B) {
      K.markFailed(), $(!0), le({
        loading: !1,
        percent: 100,
        text: ee,
        stage: "failed",
        failed: !0
      }), dn({ percent: 100, text: B, stage: "failed" });
    }
    function fe() {
      I(!0), pe || $(!0), le({
        loading: !1,
        percent: 100,
        text: Ce.ready,
        stage: "ready",
        failed: !1
      }), dn({ percent: 100, text: Ce.ready, stage: "ready" });
    }
    function Fe() {
      return c != null && c.documentId ? nr(
        c.documentId,
        c.revision
      ) : Va() ? Ka : Q.resolveResourceUrl(ln(r));
    }
    async function Ie() {
      var ie;
      let ee = { activeJobId: "", activeVersionId: "" };
      try {
        const ne = await ((ie = Q.fetchDocument) == null ? void 0 : ie.call(Q, r));
        ne && (ee = fs(ne));
      } catch {
      }
      const B = ms({
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
      const j = Fe();
      if (K.isInactive()) return;
      R(j), S(""), T(""), u(l);
      const U = await mn({
        url: j,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: K,
        setBoot: le
      });
      if (!K.isInactive()) {
        if (!U) {
          ue("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        k(U), fe();
      }
    }
    async function Ne() {
      var J;
      const ee = !c, B = !!(ee && Q.loadSessionSnapshot && Q.loadReaderOptionalArtifacts), j = B ? Q.loadReaderOptionalArtifacts(t) : null, U = await ((J = Q.loadSessionSnapshot) == null ? void 0 : J.call(Q, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: ee && !B
      })), ie = U ? {
        jobPayload: U.sourcePayload,
        manifestPayload: U.manifestPayload,
        readerMetadata: U.readerMetadata,
        regionsPayload: U.regions,
        readerErrors: U.readerErrors
      } : await Q.loadReaderPayload(t, {
        includeOptionalArtifacts: ee
      });
      if (K.isInactive()) return;
      let ne = null;
      if (n && !r)
        if (U && U.linkedDocument !== void 0)
          ne = U.linkedDocument;
        else {
          try {
            ne = await Q.fetchDocumentByJobId(er, t);
          } catch {
          }
          if (K.isInactive()) return;
        }
      const ge = ss(ie.jobPayload) || `${(ne == null ? void 0 : ne.document_id) || ""}`.trim();
      ge && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: ge
      });
      const we = hs({
        payloadDocumentId: ge,
        linkedActiveJobId: `${(ne == null ? void 0 : ne.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ne == null ? void 0 : ne.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (we.kind === "restore-committed-source") {
        if (K.isInactive()) return;
        d({
          type: "committed-source",
          documentId: we.documentId,
          revision: we.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const Me = Q.resolveReaderSourcePdf(ie.manifestPayload), rt = Q.resolveReaderTranslatedPdfUrl(ie.jobPayload, ie.manifestPayload), Be = typeof Me == "string" ? Me : Q.resolveReaderArtifactUrl(Me), Pe = r || ge, je = c != null && c.documentId ? nr(
        c.documentId,
        c.revision
      ) : Be || (Pe ? Q.resolveResourceUrl(ln(Pe)) : ""), Je = c ? "" : rt || "";
      R(je || ""), S(Je), T(ls(ie.jobPayload, t)), f({
        jobPayload: ie.jobPayload || null,
        manifestPayload: ie.manifestPayload || null,
        sessionIdentity: l
      });
      const At = () => ks({
        sourceFinal: je || "",
        translatedFinal: Je,
        fence: K,
        setBoot: le
      }), _t = !!(je || Je), ot = j && _t ? At() : null;
      ot == null || ot.catch(() => {
      });
      const Lt = (V) => {
        K.isInactive() || (_(c ? [] : qr(V.regionsPayload)), te(c ? { source: null, translated: null } : ua(V.readerMetadata)), X(c ? Dt : V.readerErrors ?? Dt), $(!0));
      };
      if (j ? (pe = !0, j.then(Lt)) : Lt(ie), !_t) {
        ue(Ce.failed, Ce.failed);
        return;
      }
      const C = await (ot ?? At());
      if (C.status !== "inactive") {
        if (C.status === "incomplete") {
          ue("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        k(C.sourceBytes), D(C.translatedBytes), fe();
      }
    }
    async function Ee() {
      I(!1), k(null), D(null), _([]), $(!1), te({ source: null, translated: null }), X(Dt), jt(le, 8, Ce.metadata, "metadata");
      try {
        if (s) {
          await Ie();
          return;
        }
        if (!t) {
          ue(Ce.failed, Ce.failed);
          return;
        }
        await Ne();
      } catch (ee) {
        if (K.isClosedOrStale() || (ee == null ? void 0 : ee.name) === "AbortError") return;
        K.markFailed();
        const B = Number(ee == null ? void 0 : ee.status), j = `${(ee == null ? void 0 : ee.reason) || ""}`, U = bs({ status: B, reason: j, sessionJobId: t });
        if (U && (await Ms({
          apiPrefix: er,
          documentId: U,
          expiredJobId: t
        }) || K.isClosedOrStale()))
          return;
        if (ps({
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
        const ie = ee instanceof Error ? ee.message : Ce.failed;
        ue(ie, ie);
      }
    }
    return Ee(), () => {
      ce.abort(), v.current === ce && (v.current = null);
    };
  }, [t, r, o, a, s, i, c, b, n, l, d, f, u, m]), {
    sourceUrl: w,
    translatedUrl: g,
    sourceFile: E,
    translatedFile: O,
    assetsReady: F,
    title: P,
    regions: M,
    regionsSettled: H,
    readerMetadata: G,
    readerErrors: Y,
    boot: me
  };
}
function _s() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = os(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), l = A(""), c = A(""), d = A(() => {
  }), f = z(() => d.current(), []), u = as({
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
  } = u, { mode: v, setMode: w, switchSessionMode: R } = us(y);
  d.current = () => {
    R("source");
  }, i.current = a, l.current = b, c.current = m;
  const g = cs({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: E,
    jobStatus: k,
    jobTerminal: O,
    jobRefreshRevision: D,
    refreshJobArtifacts: F,
    refreshJobStatus: I
  } = g, P = As({
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
    switchSessionMode: R,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = z(() => {
    var _;
    e.current = !0, (_ = t.current) == null || _.abort();
  }, []), M = q(
    () => ({
      fetchProtected: Ke().fetchProtected,
      jobId: m,
      jobPayload: S,
      manifestPayload: E,
      sourceUrl: P.sourceUrl,
      translatedUrl: P.translatedUrl,
      sourceOnly: y
    }),
    [m, S, E, P.sourceUrl, P.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: k,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: b,
    sessionIdentity: a,
    sourceOnly: h,
    mode: v,
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
    refreshJobArtifacts: F,
    refreshJobStatus: I,
    refreshCommittedDocument: u.refreshCommittedDocument,
    prepareClose: T
  };
}
const Ls = 160, Ds = 8, Cs = 0;
function xs() {
  const e = A(null), [t, n] = N(null), [r, o] = N(Cs), a = z((s) => {
    e.current = s, n(s);
  }, []);
  return x(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < Ls || o((d) => Math.abs(d - c) < Ds ? d : c);
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
function zs(e) {
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
const Xt = { source: 0, translated: 0 };
function Os(e, t) {
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
    pages: Xt
  })), [m, b] = N(() => ({ identity: c, tick: 0 })), h = f.identity === c ? f.pages : Xt, y = m.identity === c ? m.tick : 0, v = zs({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: w } = v, R = z((I, P) => {
    d.current === c && u((T) => {
      const M = T.identity === c ? T.pages : Xt;
      return M[P] === I && T.identity === c ? T : {
        identity: c,
        pages: { ...M, [P]: I }
      };
    });
  }, [c]), g = A(null), S = z(() => {
    g.current && clearTimeout(g.current);
    const I = c;
    g.current = setTimeout(() => {
      g.current = null, d.current === I && b((P) => ({
        identity: I,
        tick: P.identity === I ? P.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  x(() => (g.current && (clearTimeout(g.current), g.current = null), u((I) => I.identity === c && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: c, pages: { source: 0, translated: 0 } }), b((I) => I.identity === c && I.tick === 0 ? I : { identity: c, tick: 0 }), () => {
    g.current && (clearTimeout(g.current), g.current = null);
  }), [c]);
  const E = q(
    () => Math.max(h.source, h.translated),
    [h]
  ), k = w === "translated" ? h.translated : h.source || h.translated, O = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, F = `${c}-${y}-${O}-${n}-${h.source}-${h.translated}-${D}`;
  return {
    ...v,
    numPagesByPane: h,
    hudNumPages: E,
    primaryNumPages: k,
    metricsTick: y,
    onNumPages: R,
    onMetrics: S,
    rowSyncRevision: F
  };
}
const De = "data-reader-page", Ve = "data-reader-pane", Nn = "data-natural-height", $s = "reader-react-root", Fs = "reader-react-grid", oo = "reader-react-scroll-shell", Bs = "reader-react-pdf-pane", ao = "reader-react-pdf-page", Ut = "reader-react-pdf-page-placeholder", Mn = "reader-react-pdf-page-slot";
function Ht(e, t) {
  const n = e != null ? `[${De}="${e}"]` : `[${De}]`;
  return t ? `${n}[${Ve}="${t}"]` : n;
}
function js() {
  return `.${Mn}[${De}]`;
}
function Wt(e) {
  return Number(e.getAttribute(De));
}
const so = 0.25, Vt = 1, Us = 0.05, Mt = 0.5, Hs = 16, Ws = 8, Vs = 720;
function Ze() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function io(e) {
  return Number.isFinite(e) && e < Vs;
}
function it(e, t = Number.POSITIVE_INFINITY) {
  return io(t) && (e === "source" || e === "translated") ? Vt : Mt;
}
function Gt(e) {
  return Number.isFinite(e) ? Math.min(Vt, Math.max(so, e)) : Mt;
}
function Rt(e, t) {
  const n = Gt(Number(e) + t * Us);
  return Math.round(n * 100) / 100;
}
function Ks(e) {
  return Math.round(Gt(e) * 100);
}
function Js(e) {
  const n = (Number(e) || 0) - Hs - Ws;
  return Math.max(160, Math.floor(n));
}
function qs(e, t = Mt) {
  const n = Gt(t);
  return Js((Number(e) || 0) * n);
}
function Gs(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Ve}]`)
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
const Zs = 8;
function Ys(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Zs ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const lo = 200, co = [
  "markdown"
], Xs = co;
function uo(e) {
  return Xs.includes(e);
}
const Qs = "retainpdf:reader:view:v1:", ar = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), ei = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function fo() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function hn(e) {
  return `${e || ""}`.trim();
}
function ti({
  documentId: e,
  jobId: t
}) {
  const n = hn(e);
  if (n) return `document:${n}`;
  const r = hn(t);
  return r ? `job:${r}` : "";
}
function mo(e) {
  const t = hn(e);
  return t ? `${Qs}${t}` : "";
}
function ni(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ri(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!ar.has(t) || !ar.has(n) || t === n))
    return { left: t, right: n };
}
function oi(e) {
  return e === null ? null : uo(e) ? e : void 0;
}
function ai(e) {
  return ei.has(e) ? e : void 0;
}
function ho(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = ni(t.anchor), r = Number(t.zoom), o = ai(t.mode), a = ri(t.splitLayout), s = oi(t.assistantPanel);
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
function Le(e, t = fo()) {
  const n = mo(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ho(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Zt(e, t, n = fo()) {
  const r = mo(e);
  if (!r || !n) return null;
  const o = Le(e, n), a = ho({
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
function si(e, t, n = "") {
  var u;
  const [r, o] = N(() => {
    var m;
    return ((m = Le(n)) == null ? void 0 : m.zoom) ?? it(e, Ze());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), l = A(((u = Le(n)) == null ? void 0 : u.zoom) !== void 0);
  x(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Le(n)) == null ? void 0 : h.zoom;
    l.current = m !== void 0;
    const b = m ?? it(e, Ze());
    i.current = 1, a.current = b, o(b);
  }, [e, n]), x(() => {
    if (l.current) return;
    const m = it(e, Ze()), b = a.current;
    Math.abs(m - b) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const c = z((m) => {
    const b = Gt(m), h = a.current;
    Math.abs(b - h) < 5e-4 || (i.current = b / (h || 1), l.current = !0, Zt(s.current, { zoom: b }), o(b));
  }, []), d = z((m) => {
    c(Rt(a.current, m));
  }, [c]), f = z((m) => {
    c(it(m));
  }, [c]);
  return Re(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Gs(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: d, resetZoom: f };
}
function ii(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: z((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const An = 48;
function po(e, t = An) {
  return e.getBoundingClientRect().top + t;
}
function go(e, t) {
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
  const o = Wt(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function $t(e, t, n = An) {
  if (!e)
    return null;
  const r = Ht(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = po(e, n), i = go(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function It(e, t, n = "auto", r, o = An) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(Ht(a, r))), i || (i = e.querySelector(Ht(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const d = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), u = Math.max(0, f + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - u) >= 1 && (e.scrollTop = u) : e.scrollTo({ top: u, behavior: n }), !0;
}
function li(e, t, n = "smooth", r) {
  return It(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function pn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var d;
    if (a) return;
    It(
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
function ci(e, t, n) {
  return pn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Kt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Te(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function di(e, t, n = !0, r = "", o) {
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
    const f = Ht(void 0, o), u = () => {
      if (l) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = po(i), v = go(h, y);
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
const ui = `canvas, .react-pdf__Page, .${ao}, .${Ut}`, sr = /* @__PURE__ */ new WeakMap();
function fi(e) {
  const t = Number(e.getAttribute(Nn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = sr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(ui), sr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function mi(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function hi(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(js()).forEach((r) => {
    const o = Wt(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = fi(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function pi(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Re(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, d = !1, f = !1;
    const u = () => {
      var S;
      if (l) return;
      const R = e.current;
      if (!R) return;
      const g = hi(R);
      mi(s.current, g) || (s.current = g, a(g)), d && !f && (f = !0, (S = i.current) == null || S.call(i));
    }, m = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(u);
      });
    };
    m();
    const b = window.setTimeout(m, 100), h = window.setTimeout(() => {
      d = !0, m();
    }, 300), y = window.setTimeout(m, 700), v = e.current;
    let w = null;
    return v && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => m()), w.observe(v)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(b), window.clearTimeout(h), window.clearTimeout(y), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const gi = [0, 48, 140, 320, 560], bi = 700, yi = [80, 200, 400], vi = 500, wi = 50, Si = /* @__PURE__ */ new Set([
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
]), Ri = 180, ir = [0, 48, 140, 320, 700, 1200];
function Ii(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((P = Le(a)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), l = A(null), c = A(!1), d = A(r), f = A(null), u = A(null), m = A(null), b = A(null), h = A(a), y = A(""), v = A(n);
  v.current = n;
  const w = z(() => {
    var T;
    (T = f.current) == null || T.call(f), f.current = null, u.current != null && (clearTimeout(u.current), u.current = null);
  }, []), R = z(() => {
    !c.current && l.current == null || (w(), m.current != null && (clearTimeout(m.current), m.current = null), l.current = null, c.current = !1);
  }, [w]), g = z((T = !1) => {
    b.current != null && (clearTimeout(b.current), b.current = null);
    const M = () => {
      b.current = null, Zt(h.current, {
        anchor: Te(i.current)
      });
    };
    T ? M() : b.current = setTimeout(M, Ri);
  }, []), S = z((T) => {
    i.current = Te(T), l.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, c.current = !1;
    }, wi);
  }, []);
  x(() => {
    if (!o)
      return;
    let T = !1, M = null, _ = null, H = null;
    const $ = () => {
      if (T) return;
      const G = e.current;
      if (!G) {
        H = setTimeout($, 50);
        return;
      }
      M = G, _ = () => {
        if (c.current)
          return;
        const te = $t(M, v.current);
        te && (i.current = te, g());
      }, M.addEventListener("scroll", _, { passive: !0 }), c.current || _();
    };
    return $(), () => {
      T = !0, H != null && clearTimeout(H), M && _ && M.removeEventListener("scroll", _);
    };
  }, [o, r, n, e, g]), x(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const M = (_) => {
      _.metaKey || _.ctrlKey || _.altKey || Si.has(_.key) && R();
    };
    return T.addEventListener("wheel", R, { passive: !0 }), T.addEventListener("touchmove", R, { passive: !0 }), window.addEventListener("keydown", M), () => {
      T.removeEventListener("wheel", R), T.removeEventListener("touchmove", R), window.removeEventListener("keydown", M);
    };
  }, [o, e, R]), Re(() => {
    var M;
    if (h.current === a) return;
    g(!0), w(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const T = (M = Le(a)) == null ? void 0 : M.anchor;
    i.current = T ? Te(T) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, d.current = r;
  }, [a, r, g, w]), x(() => {
    var M;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const T = Te(
      ((M = Le(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = T, l.current = T, c.current = !0, w(), f.current = pn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: v.current,
        delaysMs: ir,
        onDone: () => S(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, S(T);
    }, Math.max(...ir) + 160), () => w();
  }, [o, s, a, e, S, w]), x(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      c.current = !1, l.current = null, w();
      return;
    }
    const T = l.current ? Te(l.current) : Te(i.current);
    return c.current = !0, l.current = T, i.current = T, w(), f.current = pn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: gi,
        onDone: () => S(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, S(T);
    }, bi), () => {
      w();
    };
  }, [r, o, n, e, S, w]), x(() => () => {
    w(), m.current != null && (clearTimeout(m.current), m.current = null), g(!0);
  }, [w, g]);
  const E = z(() => {
    const T = $t(
      e.current,
      v.current
    );
    return Te(T || i.current);
  }, [e]), k = z(() => {
    c.current = !0;
    const T = $t(
      e.current,
      v.current
    ), M = Te(T ?? i.current);
    return i.current = M, l.current = M, g(), M;
  }, [e, g]), O = z((T, M, _) => {
    const H = _ || v.current, $ = Kt(T, M || 1), G = { page: $, fraction: 0 };
    i.current = G, c.current = !0, l.current = G, g(), w(), li(e.current, $, "smooth", H), f.current = ci(
      () => e.current,
      $,
      {
        behavior: "auto",
        pane: H,
        delaysMs: yi,
        onDone: () => S(G)
      }
    ), u.current = setTimeout(() => {
      u.current = null, S(G);
    }, vi);
  }, [e, S, w, g]), D = z(() => Te(i.current), []), F = z(() => c.current, []), I = z(() => {
    if (!c.current || !l.current)
      return;
    const T = Te(l.current);
    It(
      e.current,
      T,
      "auto",
      v.current
    );
  }, [e]);
  return {
    lockFromShell: E,
    beginModeSwitch: k,
    goToPage: O,
    getAnchor: D,
    isRestoring: F,
    repinIfRestoring: I
  };
}
function Ei(e, t) {
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
function bo(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Pi = [0, 80, 200, 400, 800], Ti = 120, ki = 400;
function Ni(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: d = !0 } = e, f = A(a);
  f.current = a;
  const u = A(s);
  u.current = s;
  const m = A(i);
  m.current = i;
  const b = A(n);
  b.current = n, x(() => {
    var g, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Za(), y = Ei(h, u.current);
    if (y == null && (h != null && h.blockId) && !d) return;
    const v = bo(h, y, { jobId: l, documentId: c });
    if (t.current === v)
      return;
    if (y == null) {
      t.current = v, (g = b.current) == null || g.call(b);
      return;
    }
    t.current = v, h && ((S = m.current) == null || S.call(m, h, y));
    const w = [];
    let R = 0;
    for (const E of Pi)
      R = Math.max(R, E), w.push(
        setTimeout(() => {
          f.current(y);
        }, E)
      );
    return w.push(
      setTimeout(() => {
        var E;
        (E = b.current) == null || E.call(b);
      }, R + Ti)
    ), () => {
      for (const E of w) clearTimeout(E);
    };
  }, [r, o, l, c, t, d]);
}
function Mi(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Ai(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = ki,
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
      const b = ((v = globalThis.location) == null ? void 0 : v.search) || "", h = da(b, o, d.current);
      if (u.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = bo(
        { blockId: y },
        o,
        { jobId: i, documentId: l }
      ), (f.current || Mi)(h);
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
function _i(e) {
  const t = A(""), [n, r] = N(!1), o = z(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Ni(a, t, o), Ai(e, t, n);
}
const ht = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Li(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function lr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function yo(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = lr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = lr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Di(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = yo(r, t, n);
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
function Ci(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const cr = [250, 500, 1e3, 2e3, 4e3], Qt = [80, 160, 320, 640, 1e3, 1500], dr = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
function _n(e) {
  return ba(e) ? `${e.code || ""}`.trim() : "";
}
function Ct(e, t) {
  const n = _n(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function xi(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (yo(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = ya(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = _n(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = Qt[Math.min(s, Qt.length - 1)];
    if (await gn(i, r), s >= Qt.length + 2) throw a;
  }
}
function zi({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(ht), s = A(o), i = A("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), d = wt(c) ? c : "";
  return x(() => {
    if (!n || !l) {
      i.current = "", s.current = ht, a(ht);
      return;
    }
    const f = r === void 0 ? Ga() : r, u = i.current === l;
    if (i.current = l, !f) {
      const R = {
        ...u ? s.current : ht,
        connection: d ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = R, a(R);
      return;
    }
    const m = new AbortController();
    let b = !1;
    const h = {
      ...u ? s.current : ht,
      connection: d ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = h, a(h);
    const y = (R) => {
      m.signal.aborted || a((g) => {
        const S = R(g);
        return s.current = S, S;
      });
    }, v = async () => {
      let R = 0;
      for (; !m.signal.aborted; )
        try {
          const g = await f.fetchLayout(l, { signal: m.signal });
          b = !0, y((S) => ({
            ...S,
            layoutByPage: Li(g),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError") return;
          const S = _n(g);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            y((k) => ({
              ...k,
              connection: d ? "terminal" : "unavailable",
              jobStatus: c,
              error: Ct(g, "实时译文暂不可用")
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
            error: Ct(g, "正在等待 OCR 版面数据")
          })), await gn(cr[Math.min(R, cr.length - 1)], m.signal).catch(() => {
          }), R += 1;
        }
    };
    return (async () => {
      if (await v(), !b || m.signal.aborted) return;
      let R = 0;
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
              let S;
              try {
                S = await xi(
                  l,
                  g,
                  s.current,
                  m.signal,
                  f
                );
              } catch (E) {
                if ((E == null ? void 0 : E.name) === "AbortError" || m.signal.aborted) throw E;
                y((k) => ({
                  ...k,
                  lastSeq: Math.max(k.lastSeq, g.seq),
                  error: Ct(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((E) => {
                const k = Di(E, g, S);
                return d ? {
                  ...k,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...k,
                  jobStatus: c
                };
              }), R = 0;
            }
          });
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError" || m.signal.aborted) return;
          y((S) => ({
            ...S,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: c,
            error: Ct(g, "实时译文连接已中断，正在重连")
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
        await gn(dr[Math.min(R, dr.length - 1)], m.signal).catch(() => {
        }), R += 1;
      }
    })(), () => m.abort();
  }, [n, r, l, d]), o;
}
function Oi(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function $i(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return x(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ke().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Oi(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Fi = 4500;
function Bi(e) {
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
const ji = /* @__PURE__ */ new Set(["book", "translate"]);
function vo(e) {
  return !!(e.jobId && e.sourceUrl && ji.has(e.workflow));
}
function Ui(e) {
  return !!(vo(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Hi() {
  const e = _s(), t = vo({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Ui({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !wt(o) && (r.current.running = !0);
  const a = zi({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = xs(), d = $i(e.jobId, !e.sourceOnly), f = ti({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: b } = si(e.mode, s, f), h = Os(
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
    repinIfRestoring: w
  } = Ii(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  x(() => {
    w();
  }, [l, w]);
  const R = pi(
    s,
    h.compareMode,
    h.rowSyncRevision,
    w
  ), g = di(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), S = z(($, G) => {
    var Y, X;
    const te = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Y = h.numPagesByPane) == null ? void 0 : Y.source) || 0,
      Number((X = h.numPagesByPane) == null ? void 0 : X.translated) || 0
    );
    v($, te, G);
  }, [v, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [E, k] = N(null), O = A(null), D = z(($) => {
    O.current && clearTimeout(O.current), k($), $ && (O.current = setTimeout(() => k(null), Fi));
  }, []);
  x(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const F = z(($) => {
    const G = Yt(e.regions, $);
    return G ? Zn(G, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = z(($, G) => {
    const te = G || h.primaryPane, Y = typeof $ == "object" && $ ? `${$.block_id || ""}`.trim() : "", X = typeof $ == "object" && $ ? `${$.image_url || ""}`.trim() : "", me = typeof $ == "object" && $ ? $.page_idx != null ? Number($.page_idx) + 1 : $.page != null ? Number($.page) : null : typeof $ == "number" ? $ + 1 : null, le = fa(e.regions, X, me) || Yt(e.regions, Y) || (typeof $ == "object" ? ma(e.regions, $) : null);
    let ce = le ? Zn(le, te).page : null;
    ce == null && (ce = Bi($)), !(ce == null || ce < 1) && (D(le), S(ce, te));
  }, [D, S, h.primaryPane, e.regions]);
  _i({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: g,
    goToPage: S,
    resolveBlockPage: F,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: ($) => {
      D(Yt(e.regions, $.blockId));
    }
  });
  const { setModeKeepingPage: P } = ii({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  x(() => {
    D(null);
  }, [u, D]);
  const T = !e.boot.loading && !e.boot.failed, M = q(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), _ = q(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), H = q(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: b,
    shell: M,
    panes: h,
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
  }), [e, M, h, _, R, S, E, I, P, T, m, b, f, a, n, d]);
  return q(() => ({
    ...H,
    currentPage: g
  }), [H, g]);
}
const Wi = [
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
], Vi = [
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
function Ki(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Wi)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Ji(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const qi = ".reader-notes-panel";
function Gi(e) {
  return e instanceof Element ? !!e.closest(qi) : !1;
}
function Zi(e) {
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
      if (f.defaultPrevented || f.metaKey || f.ctrlKey || f.altKey || Ji(f.target) || Gi(f.target))
        return;
      const u = f.key, m = Ki(u);
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
              a(Rt(o, 1));
              return;
            case "zoom-out":
              a(Rt(o, -1));
              return;
            case "zoom-reset":
              a(it(t, Ze()));
              return;
            case "next-page":
              l(Kt(s + 1, i));
              return;
            case "prev-page":
              l(Kt(s - 1, i));
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
const Yi = "retainpdf:soft-reader-close";
function Xi() {
  return new URL("./index.html", window.location.href).href;
}
function Qi() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Yi },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function el(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function tl() {
  if (!(typeof window > "u") && !Qi()) {
    if (el(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Xi());
  }
}
function nl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function rl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L(nl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), tl();
  }, children: [
    /* @__PURE__ */ p(Nt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let ur = !1;
function ol() {
  if (ur)
    return;
  const e = St().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (to.GlobalWorkerOptions.workerSrc = e, ur = !0);
}
const al = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function sl(e, t, n) {
  return e.flatMap((r) => {
    if (!al.has(kt(r.region))) return [];
    const o = kn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function fr(e, t, n) {
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
async function il(e) {
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
const ll = "reader-text-hover-copy", cl = "reader-text-hover-edit", dl = "reader-text-hover-id";
function ul(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const wo = "reader-text-hover-tools";
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
const So = 26, Ro = 220;
function Io(e, t = Ro) {
  return e.height < So * 2 || e.width < t;
}
function fl({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a
}) {
  const [s, i] = N("idle"), [l, c] = N("idle"), [d] = N(() => ul()), f = A([]), u = (e == null ? void 0 : e.itemId) || "";
  if (x(() => {
    i("idle"), c("idle");
    const R = f.current;
    return () => {
      R.forEach((g) => window.clearTimeout(g)), f.current = [];
    };
  }, [u]), !e) return null;
  const m = ha(e.highlight.region, t), b = kt(e.highlight.region), h = (R, g) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const E = await il(R);
    g(E ? "copied" : "failed"), f.current.push(window.setTimeout(() => g("idle"), 1200));
  }, y = b === "formula" ? "复制 LaTeX" : "复制", v = o || e.rect, w = a || (Io(v) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": b,
      style: v,
      children: /* @__PURE__ */ L(
        "div",
        {
          className: wo,
          "data-placement": w,
          children: [
            d ? /* @__PURE__ */ p(
              en,
              {
                className: dl,
                state: l,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: h(e.itemId, c),
                children: l === "copied" ? "已复制编号" : e.itemId
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
                className: cl,
                state: "idle",
                label: "改这段译文",
                title: "改这段译文（E）",
                onClick: (R) => {
                  R.preventDefault(), R.stopPropagation(), r(e.itemId);
                },
                children: "改"
              }
            ) : null,
            m ? /* @__PURE__ */ p(
              en,
              {
                className: ll,
                state: s,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: h(m, i),
                children: s === "copied" ? "已复制" : s === "failed" ? "复制失败" : y
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function ml(e, t) {
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
function hl(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = kn(
      ml(e, a),
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
const pl = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', gl = 256, pt = /* @__PURE__ */ new Map();
function bl(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Eo(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ua(t, { bareLatex: !0 }), o = bl(n), a = Ha(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = pt.get(t);
  if (!s && (s = Wa(o, r), pt.set(t, s), pt.size > gl)) {
    const i = pt.keys().next().value;
    i !== void 0 && pt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function tn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function ze(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function yl(e, t) {
  const n = e.typography, r = ze(t) || 1, o = ze(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = tn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = ze(n == null ? void 0 : n.fit_min_font_size_pt), d = ze(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), u = Math.max(
    f,
    d ? d * r : o ? o * r : l
  ), m = o ? o * r : l, b = ze(n == null ? void 0 : n.leading_em), h = [
    ze(n == null ? void 0 : n.padding_top_pt) || 0,
    ze(n == null ? void 0 : n.padding_right_pt) || 0,
    ze(n == null ? void 0 : n.padding_bottom_pt) || 0,
    ze(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || pl,
    fontSizePx: Math.max(f, Math.min(u, m)),
    minFontSizePx: f,
    maxFontSizePx: u,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: b ? 1 + b : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (tn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : tn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function vl(e, t, n, r) {
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
const wl = 512, gt = /* @__PURE__ */ new Map();
let bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  bn += 1;
}));
function Sl(e, t, n, r) {
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
function Po({ item: e, pageScale: t }) {
  const n = A(null), r = q(
    () => Eo(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = q(
    () => yl(e, t),
    [e, t]
  );
  x(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((u) => {
      f && a(u);
    }), () => {
      f = !1;
    };
  }, [r]), Re(() => {
    const f = n.current;
    if (!f) return;
    const [u, m, b, h] = s.padding, y = Math.max(1, e.rect.width - h - m), v = Math.max(1, e.rect.height - u - b), w = Sl(o, y, v, s);
    let R = gt.get(w);
    if (R === void 0 && (R = vl(
      (g) => (f.style.fontSize = `${g}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      v,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), gt.set(w, R), gt.size > wl)) {
      const g = gt.keys().next().value;
      g !== void 0 && gt.delete(g);
    }
    f.style.fontSize = `${R.toFixed(2)}px`;
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
function Rl({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = q(
    () => hl(e, t, n, r),
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
        Po,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Il = qt(Rl);
function El({
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
        Po,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: kt(a.highlight.region),
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
const Pl = qt(El);
function Tl(e) {
  return e === "formula" ? 84 : 64;
}
const kl = 6, Ge = (e) => e.left + e.width, yt = (e) => e.top + e.height, Nl = (e, t) => e.top < yt(t) && t.top < yt(e);
function Ml(e, t, n, r) {
  const o = r + kl;
  let a = n, s = 0;
  for (const i of t)
    i === e || !Nl(e, i) || (i.left >= Ge(e) - 1 && (a = Math.min(a, i.left)), Ge(i) <= e.left + 1 && (s = Math.max(s, Ge(i))));
  return a - Ge(e) >= o ? "side-right" : e.left - s >= o ? "side-left" : Io(e, r) ? "outside" : "inside";
}
function Al(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const d = c.left + c.width / 2, f = c.top + c.height / 2;
    d < e.left || d > Ge(e) || f < e.top || f > yt(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, Ge(c)), i = Math.max(i, yt(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(Ge(e) + r, s + n) - l.left, l.height = Math.min(yt(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function _l(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Ll(e, t, n, r, o) {
  const [a, s] = N(null);
  return Re(() => {
    if (!t) {
      s(null);
      return;
    }
    const i = e.current, l = i ? Al(t.rect, _l(i)) : t.rect, c = Ml(t.rect, n.map((d) => d.rect), r, Tl(o));
    s({ rect: l, placement: c });
  }, [e, o, r, t, n]), a && t ? a : null;
}
const To = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], mr = { pen: 35e-4, highlighter: 0.018 }, hr = 0.015, yn = "retainpdf.reader.ink.v1:";
function pr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(yn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Dl(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(yn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(yn + e);
    } catch {
    }
}
function Cl(e, t, n, r, o, a) {
  const s = hr * hr;
  return e.filter((i) => ko(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function ko(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function xl(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function zl(e) {
  const [t, n] = N(null), [r, o] = N(To[0].key), [a, s] = N(() => pr(e)), i = A(a), l = A([]);
  x(() => {
    const h = pr(e);
    i.current = h, s(h), l.current = [];
  }, [e]);
  const c = z((h) => {
    i.current = h, s(h), Dl(e, h);
  }, [e]), d = z((h) => {
    const y = i.current, v = h(y);
    v !== y && (l.current = [...l.current.slice(-49), y], c(v));
  }, [c]), f = z((h) => {
    h.points.length < 1 || d((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [d]), u = z((h) => {
    h.length && d((y) => y.filter((v) => !h.includes(v.id)));
  }, [d]), m = z((h) => {
    d((y) => y.some((v) => v.page === h) ? y.filter((v) => v.page !== h) : y);
  }, [d]), b = z(() => {
    const h = l.current.pop();
    h && c(h);
  }, [c]);
  return q(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: u, undo: b, clearPage: m }),
    [t, r, a, f, u, b, m]
  );
}
const Ol = "reader-ink-layer";
function $l(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function gr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: $l(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Fl({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = A(!1), l = o.strokes.filter((h) => ko(h, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const d = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(Cl(o.strokes, e, t, h, y, r / Math.max(1, n))), u = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, v] = d(h);
    o.tool === "eraser" ? f(y, v) : s([[y, v]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, v] = d(h);
    o.tool === "eraser" ? f(y, v) : s((w) => w ? xl(w, y, v) : [[y, v]]);
  }, b = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: mr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: Ol,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: u,
      onPointerMove: m,
      onPointerUp: b,
      onPointerCancel: b,
      children: [
        l.map((h) => /* @__PURE__ */ p(gr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(gr, { stroke: { tool: o.tool, color: o.color, width: mr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function de(e) {
  return typeof e == "string" ? e : "";
}
function Bl(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function jl(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Ul(e) {
  return {
    source: de(e == null ? void 0 : e.source_text) || de(e == null ? void 0 : e.unit_source_text),
    translated: de(e == null ? void 0 : e.protected_translated_text) || de(e == null ? void 0 : e.translated_text)
  };
}
const Hl = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function No(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Wl(e) {
  const t = No(e).sort((r, o) => de(r.ts).localeCompare(de(o.ts)));
  return t.length ? [
    { text: de(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: de(r.new_text),
      label: Hl[de(r.source)] || de(r.source) || "修订",
      ts: de(r.ts),
      reason: de(r.reason)
    }))
  ].reverse() : [];
}
function Vl(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Kl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return de(r.finished_at) || de(n.finished_at) || "";
}
function Jl(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = No(e).sort((a, s) => de(a.ts).localeCompare(de(s.ts)));
  for (const a of o) {
    const s = new Date(de(a.ts)).getTime(), i = de(a.reader_item_id) || de(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, de(a.new_text));
  }
  return n;
}
const ql = {
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
function Gl(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = ql[de(n.kind)] || de(n.kind) || "问题", o = de(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Zl = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Yl(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Zl.has(kt(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Xl = 300, Ql = 72;
function ec(e, t) {
  if (e.width >= Xl && e.height >= Ql)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
function tc({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, l] = N(!1), [c, d] = N([]), [f, u] = N(""), [m, b] = N(""), [h, y] = N(!1), [v, w] = N(null), [R, g] = N([]), S = r.drafts, E = r.generation, k = z(async (I, P) => {
    if (e)
      try {
        d(Wl(await e.fetchRevisions(I, P)));
      } catch {
        d([]);
      }
  }, [e]);
  x(() => {
    if (s(null), d([]), w(null), g([]), b(""), !e || !t || !n) return;
    let I = !1;
    return l(!0), e.loadItem(t, n).then((P) => {
      if (I) return;
      const T = P == null ? void 0 : P.item;
      if (!T) throw new Error("找不到这一段的译文。");
      const M = `${(P == null ? void 0 : P.item_id) || n}`, { source: _, translated: H } = Ul(T);
      s({ readerItemId: n, itemId: M, source: _, current: H }), u(S.get(n) ?? H);
    }).catch((P) => {
      I || w({ tone: "error", message: (P == null ? void 0 : P.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || l(!1);
    }), k(t, n), () => {
      I = !0;
    };
  }, [e, t, n, k]);
  const O = z((I) => {
    u(I), n && S.set(n, I);
  }, [n, S]), D = z(async (I, P) => {
    if (!e || !a || h) return !1;
    const T = I ?? f;
    if (!T.trim()) return !1;
    y(!0), w(null), g([]);
    try {
      const M = await e.revise(t, a.itemId, {
        translated_text: T,
        source: "user",
        reason: (P ?? m).trim() || "在阅读页手动修改",
        ...E.current != null ? { expected_generation: E.current } : {}
      }), _ = Number(M == null ? void 0 : M.generation);
      return Number.isFinite(_) && (E.current = _), S.delete(a.readerItemId), s({ ...a, current: T }), u(T), b(""), (M == null ? void 0 : M.changed) === !1 ? w({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, T), w({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), k(t, a.readerItemId), !0;
    } catch (M) {
      const _ = M;
      return (_ == null ? void 0 : _.reason) === "generation_mismatch" && (E.current = null), w({ tone: "error", message: (_ == null ? void 0 : _.message) || "保存失败，请稍后再试。" }), g(Gl(_ == null ? void 0 : _.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, k, S, E]), F = z(() => {
    n && S.delete(n);
  }, [n, S]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: f,
    setDraft: O,
    reason: m,
    setReason: b,
    saving: h,
    status: v,
    issues: R,
    save: D,
    discardDraft: F
  };
}
const Mo = "reader-inline-edit";
function nc({ text: e }) {
  const [t, n] = N("");
  return x(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Eo(e);
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
function rc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var F;
  const s = e.itemId, i = tc({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = N(!1), [d, f] = N(!1), u = A(null), m = ec(e.rect, t), b = q(() => Yl(o), [o]), h = b.indexOf(s), { loaded: y } = i, v = i.saving || i.loading, w = n.blockedReason, R = !y || i.draft === y.current, { close: g, select: S } = n, E = z((I) => {
    const P = b[h + I];
    P && (S(P), a == null || a(P));
  }, [b, h, S, a]), k = z(() => {
    i.discardDraft(), g();
  }, [i, g]), O = z(async (I, P) => {
    await i.save(I, P) && g();
  }, [i, g]);
  x(() => {
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
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const D = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ L(et, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${Mo} is-${m.mode}`,
        style: D,
        role: "group",
        "aria-label": `改第 ${((F = n.target) == null ? void 0 : F.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            oe,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((I) => !I),
              children: y.source
            }
          ) : null,
          w ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: w }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            Fa,
            {
              ref: u,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: v || !!w,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), R || O()) : I.key === "Escape" && (I.preventDefault(), k());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(nc, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(Xn, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => E(-1), children: /* @__PURE__ */ p(wa, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(Xn, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= b.length - 1, onClick: () => E(1), children: /* @__PURE__ */ p(Gr, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              eo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: v || !!w || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), R || O()) : I.key === "Escape" && (I.preventDefault(), k());
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
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p(Sa, { size: 13, "aria-hidden": !0 }),
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
                disabled: v || !!w || R || !i.draft.trim(),
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
          d && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, P) => {
            const T = I.text === y.current, M = [Vl(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": I.label, "data-current": T ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  M,
                  T ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                T ? null : /* @__PURE__ */ p(
                  oe,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: v || !!w,
                    onClick: () => {
                      O(I.text, `回到「${M.replace(" · ", " ")}」那一版`);
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
const Ao = En(null), _o = En(null);
function oc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Ao.Provider, { value: e, children: /* @__PURE__ */ p(_o.Provider, { value: t, children: n }) });
}
function $e() {
  return Pn(Ao);
}
function Lo() {
  return Pn(_o);
}
const He = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), ac = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, sc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, ic = {
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
}, br = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function lc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => br(o ?? a ?? "", ac)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => br(o ?? a ?? "", sc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => ic[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function cc(e) {
  return He(e.translatedBlockText) || He(e.translated.text) || He(e.source.text);
}
const dc = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function uc(e) {
  const t = [];
  for (const n of e) {
    if (!dc(n)) continue;
    const r = lc(cc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function fc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const mc = 24, hc = 60;
function yr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - mc), o = Math.min(e.length, n + t.length + hc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function pc(e, t, n = 200) {
  const r = He(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = He(a.translatedBlockText) || He(a.translated.text), l = i ? yr(i, r) : null, c = l ?? yr(He(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function xt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function gc(e, t) {
  const n = He(t).toLowerCase();
  if (!n || !e) return xt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${xt(e.slice(a, s))}<mark class="reader-find-mark">${xt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + xt(e.slice(a));
}
function bc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Do = 1.414;
function yc({
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
  var Ee, ee;
  const w = $e(), R = w == null ? void 0 : w.revisedBlocks, g = w == null ? void 0 : w.blockEdit, S = g == null ? void 0 : g.pendingEdits, E = w == null ? void 0 : w.editBlock, k = (w == null ? void 0 : w.findTerm) || "", O = q(
    () => k ? ({ str: B }) => gc(B, k) : void 0,
    [k]
  ), D = A(l ?? Do), [F, I] = N(D.current);
  x(() => {
    l != null && Math.abs(l - D.current) >= 1e-3 && (D.current = l, I(l));
  }, [l]);
  const P = A(d);
  P.current = d;
  const T = A(null), M = A((B) => {
    var j;
    T.current = B, (j = P.current) == null || j.call(P, B);
  }).current, _ = A(null), H = A(`${t}@${n}`);
  Re(() => {
    const B = `${t}@${n}`;
    H.current !== B && (H.current = B, o && wc(T.current, _.current));
  }, [o, n, t]), x(() => {
    o || nn(_.current);
  }, [o]), x(() => () => nn(_.current), []);
  const $ = Math.max(120, Math.floor(t * F)), G = Math.max($, Math.ceil(s || 0)), te = kn(f, t, $), Y = q(
    () => sl(u, t, $),
    [$, u, t]
  ), [X, me] = N(null), le = typeof b == "function", ce = le ? m ?? null : X, he = (B) => {
    le ? B !== (m ?? null) && (b == null || b(B)) : me((j) => j === B ? j : B);
  }, K = q(
    () => Y.find((B) => B.itemId === ce) || null,
    [ce, Y]
  ), Q = r === "translated" && ((Ee = g == null ? void 0 : g.target) == null ? void 0 : Ee.itemId) || "", pe = q(
    () => Q && Y.find((B) => B.itemId === Q) || null,
    [Q, Y]
  ), ue = K ? kt(K.highlight.region) : "", fe = Ll(T, o ? K : null, Y, t, ue), Fe = (B) => {
    var we, Me, rt, Be, Pe;
    if (B.pointerType === "touch") return;
    if ((we = w == null ? void 0 : w.ink) != null && we.tool) {
      he(null);
      return;
    }
    if (B.buttons !== 0) {
      he(null);
      return;
    }
    if ((rt = (Me = B.target) == null ? void 0 : Me.closest) != null && rt.call(Me, `.${wo}`) || (Pe = (Be = B.target) == null ? void 0 : Be.closest) != null && Pe.call(Be, `.${Mo}`)) return;
    const j = B.currentTarget.getBoundingClientRect(), U = B.clientX - j.left, ie = B.clientY - j.top, ne = fe == null ? void 0 : fe.rect;
    if (ne && (fe == null ? void 0 : fe.placement) === "outside" && U >= ne.left - 4 && U <= ne.left + Ro && ie >= ne.top - So && ie <= ne.top) return;
    const ge = fr(Y, U, ie);
    he((ge == null ? void 0 : ge.itemId) || null);
  }, Ie = (B) => {
    if (B.pointerType === "mouse") return;
    const j = B.currentTarget.getBoundingClientRect(), U = fr(
      Y,
      B.clientX - j.left,
      B.clientY - j.top
    );
    he((U == null ? void 0 : U.itemId) || null);
  }, Ne = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(D.current - B) < 1e-3 || (D.current = B, I(B), c == null || c(e, B));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: M,
      [De]: e,
      [Ve]: r,
      [Nn]: $,
      className: Mn,
      onPointerMoveCapture: Fe,
      onPointerDown: Ie,
      onPointerLeave: (B) => {
        B.pointerType === "mouse" && he(null);
      },
      style: {
        width: t,
        height: G,
        minHeight: G
      },
      children: [
        o ? /* @__PURE__ */ p(
          Ba,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: O,
            renderAnnotationLayer: !1,
            className: ao,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Ut,
                style: { width: t, height: $ }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const j = B.getViewport({ scale: 1 });
                if (j.width > 0) {
                  const U = j.height / j.width;
                  Ne(U);
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
            className: Ut,
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
          Il,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: $
          }
        ) : null,
        o && r === "translated" && (S != null && S.size) ? /* @__PURE__ */ p(Pl, { targets: Y, edits: S, width: t, excludeId: pe == null ? void 0 : pe.itemId }) : null,
        o && pe && g ? /* @__PURE__ */ p(
          rc,
          {
            target: pe,
            page: { width: t, height: $ },
            edit: g,
            showSource: !!(w != null && w.editShowsSource),
            regions: w == null ? void 0 : w.regions,
            jumpToBlock: w == null ? void 0 : w.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: Y.filter((B) => R.has(B.itemId)).map((B) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": B.itemId,
            style: { left: B.rect.left, top: B.rect.top, height: B.rect.height }
          },
          B.itemId
        )) }) : null,
        o && (w != null && w.ink) ? /* @__PURE__ */ p(
          Fl,
          {
            page: e,
            pane: r === "translated" ? "translated" : w.compareVersion ? "compare" : "source",
            width: t,
            height: $,
            ink: w.ink
          }
        ) : null,
        /* @__PURE__ */ p(
          fl,
          {
            target: o && !((ee = w == null ? void 0 : w.ink) != null && ee.tool) && (K == null ? void 0 : K.itemId) !== (pe == null ? void 0 : pe.itemId) ? K : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: K && (R == null ? void 0 : R.get(K.itemId)) || 0,
            onEdit: E,
            frameRect: fe == null ? void 0 : fe.rect,
            placement: fe == null ? void 0 : fe.placement
          }
        )
      ]
    }
  );
}
const vc = qt(yc);
function wc(e, t) {
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
const Sc = 2 * 1024 * 1024;
function Rc(e) {
  const t = new to.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const rn = 5, Ic = "120% 0px", Ec = 120, Pc = "25% 0px";
let vr = 1;
const wr = /* @__PURE__ */ new WeakMap();
function Tc(e) {
  if (!e) return 0;
  const t = wr.get(e);
  if (t) return t;
  const n = vr;
  return vr += 1, wr.set(e, n), n;
}
function kc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Nc = Vr(
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
    onHoverRegion: w,
    liveTranslation: R,
    showLiveTranslation: g = t === "source",
    liveTranslationPendingLabel: S = "",
    paneAction: E
  }, k) {
    ol();
    const { file: O, loading: D, error: F } = Ps(n, r), I = `${n}\0${Tc(O)}`, P = A(I);
    P.current = I;
    const T = q(() => {
      const C = vs(O);
      return C ? "ranged" in C ? { range: Rc(C.ranged) } : C : null;
    }, [O, n]), [M, _] = N(0), [H, $] = N(""), [G, te] = N(null), [Y, X] = N(480), me = A(null), le = A(0), ce = q(() => kc(), []), he = q(() => ({
      cMapUrl: St().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: St().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Sc,
      disableAutoFetch: !0
    }), []);
    Tn(k, () => G, [G]), x(() => {
      const C = (W) => {
        le.current = W, X(W);
      }, J = (W) => {
        const ae = Ys(W, le.current);
        if (ae !== "ignore") {
          if (me.current && clearTimeout(me.current), ae === "immediate") {
            C(W);
            return;
          }
          me.current = setTimeout(() => C(W), lo);
        }
      }, V = !!(l && l >= 80);
      J(V ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const se = !V && i && typeof ResizeObserver < "u" ? new ResizeObserver((W) => {
        var ae, be;
        J(((be = (ae = W[0]) == null ? void 0 : ae.contentRect) == null ? void 0 : be.width) ?? i.clientWidth);
      }) : null;
      return se && i && se.observe(i), () => {
        se == null || se.disconnect(), me.current && clearTimeout(me.current);
      };
    }, [l, i, a]);
    const K = q(
      () => qs(Y, o),
      [Y, o]
    ), [Q, pe] = N(() => /* @__PURE__ */ new Map()), [ue, fe] = N(() => /* @__PURE__ */ new Set()), [Fe, Ie] = N(() => /* @__PURE__ */ new Set()), Ne = A(/* @__PURE__ */ new Map()), Ee = A(null), ee = A(null), [B, j] = N(() => /* @__PURE__ */ new Set()), U = A(/* @__PURE__ */ new Map()), ie = z((C, J) => {
      pe((V) => {
        if (V.get(C) === J) return V;
        const Z = new Map(V);
        return Z.set(C, J), Z;
      });
    }, []), ne = z((C, J) => {
      const V = Ne.current, Z = V.get(C), se = [Ee.current, ee.current];
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
    }, []), ge = A(/* @__PURE__ */ new Map()), we = z((C) => {
      const J = ge.current;
      let V = J.get(C);
      return V || (V = (Z) => ne(C, Z), J.set(C, V)), V;
    }, [ne]);
    x(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = U.current, J = new IntersectionObserver(
        (V) => {
          const Z = [], se = [];
          for (const W of V) {
            const ae = W.target, be = Wt(ae);
            Number.isFinite(be) && (W.isIntersecting ? Z : se).push(be);
          }
          if ((Z.length || se.length) && fe((W) => {
            let ae = null;
            for (const be of Z)
              W.has(be) || (ae = ae || new Set(W), ae.add(be));
            for (const be of se)
              W.has(be) && (ae = ae || new Set(W), ae.delete(be));
            return ae || W;
          }), Z.length) {
            for (const W of Z) {
              const ae = C.get(W);
              ae && (clearTimeout(ae), C.delete(W));
            }
            Ie((W) => {
              let ae = null;
              for (const be of Z)
                W.has(be) || (ae = ae || new Set(W), ae.add(be));
              return ae || W;
            });
          }
          for (const W of se)
            C.has(W) || C.set(W, setTimeout(() => {
              C.delete(W), Ie((ae) => {
                if (!ae.has(W)) return ae;
                const be = new Set(ae);
                return be.delete(W), be;
              });
            }, Ec));
        },
        { root: i, rootMargin: Ic, threshold: 0 }
      );
      Ee.current = J;
      for (const V of Ne.current.values())
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
            let Z = null;
            for (const se of J) {
              const W = Wt(se.target);
              !Number.isFinite(W) || se.isIntersecting === V.has(W) || (Z = Z || new Set(V), se.isIntersecting ? Z.add(W) : Z.delete(W));
            }
            return Z || V;
          });
        },
        { root: i, rootMargin: Pc, threshold: 0 }
      );
      ee.current = C;
      for (const J of Ne.current.values())
        try {
          C.observe(J);
        } catch {
        }
      return () => {
        C.disconnect(), ee.current === C && (ee.current = null);
      };
    }, [i]);
    const Me = !!i && typeof IntersectionObserver < "u";
    Re(() => {
      _(0), $(""), fe(/* @__PURE__ */ new Set()), Ie(/* @__PURE__ */ new Set()), pe(/* @__PURE__ */ new Map()), Ne.current.clear();
      const C = U.current;
      for (const J of C.values()) clearTimeout(J);
      C.clear(), m == null || m(0, t);
    }, [I, m, t]);
    const rt = z(
      ({ numPages: C }) => {
        P.current === I && (_(C), $(""), m == null || m(C, t), f == null || f({ numPages: C, pane: t }));
      },
      [I, f, m, t]
    ), Be = z(
      (C) => {
        if (P.current !== I) return;
        const J = (C == null ? void 0 : C.message) || "PDF 解析失败";
        $(J), _(0), m == null || m(0, t), u == null || u(C, t);
      },
      [I, u, m, t]
    ), Pe = q(
      () => M > 0 ? Array.from({ length: M }, (C, J) => J + 1) : [],
      [M]
    );
    x(() => {
      typeof IntersectionObserver < "u" || Ie(new Set(Pe));
    }, [Pe]);
    const je = q(
      () => Yn(b, y, t),
      [b, y, t]
    ), Je = q(() => {
      const C = /* @__PURE__ */ new Map();
      for (const J of h) {
        const V = Yn(J, y, t);
        if (!V) continue;
        const Z = C.get(V.box.page) || [];
        Z.push(V), C.set(V.box.page, Z);
      }
      return C;
    }, [t, y, h]), At = q(() => {
      const C = /* @__PURE__ */ new Set();
      if (!v) return C;
      for (const [J, V] of Je)
        V.some((Z) => Z.itemId === v) && C.add(J);
      return C;
    }, [v, Je]), _t = q(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Pe);
      if (ue.size === 0) {
        const V = Math.min(M, rn * 2 + 1);
        return new Set(Array.from({ length: V }, (Z, se) => se + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const V of ue)
        for (let Z = -rn; Z <= rn; Z++) {
          const se = V + Z;
          se >= 1 && se <= M && J.add(se);
        }
      return J;
    }, [M, Pe, i, a, ue]), ot = !n || !!F || !!H, Lt = n && (F || H) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: te,
        className: `reader-panel ${Bs}${a ? "" : " is-hidden"}`,
        [Ve]: t,
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
          ot && !D ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Lt }) : null,
          D ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !F ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            ja,
            {
              file: T,
              loading: null,
              error: null,
              options: he,
              onLoadSuccess: rt,
              onLoadError: Be,
              className: "reader-react-pdf-document",
              children: Pe.map((C) => {
                if (_t.has(C))
                  return /* @__PURE__ */ p(
                    vc,
                    {
                      pane: t,
                      pageNumber: C,
                      width: K,
                      devicePixelRatio: ce,
                      active: Fe.has(C),
                      textLayer: !Me || B.has(C),
                      syncedMinHeight: (c == null ? void 0 : c.get(C)) || 0,
                      onMetrics: d,
                      cachedAspect: Q.get(C),
                      onAspectChange: ie,
                      sentinelRef: we(C),
                      regionHighlight: (je == null ? void 0 : je.box.page) === C ? je : null,
                      regionTargets: Je.get(C),
                      hoveredRegionId: v && At.has(C) ? v : null,
                      onHoverRegion: w,
                      liveTranslationLayout: R == null ? void 0 : R.layoutByPage.get(C - 1),
                      liveTranslationPage: R == null ? void 0 : R.pagesByPage.get(C - 1),
                      showLiveTranslation: g
                    },
                    `${t}-${C}`
                  );
                const V = Q.get(C) ?? Do, Z = Math.max(120, Math.floor(K * V)), se = Math.max(Z, Math.ceil((c == null ? void 0 : c.get(C)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: we(C),
                    [De]: C,
                    [Ve]: t,
                    [Nn]: Z,
                    className: `${Mn} is-placeholder`,
                    style: {
                      width: K,
                      height: se,
                      minHeight: se
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: Ut,
                        style: { width: K, height: Z },
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
), Sr = qt(Nc), Mc = 2e3, Ac = 6, _c = 500, Rr = "reader-react-resizing";
function Lc(e, t) {
  const n = A(null), r = A(null);
  Re(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const g = Dc(e), S = $t(e, g);
      if (!S) return;
      s = { pane: g, progress: S, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let d = 0, f = null, u = e.scrollHeight, m = u, b = 0, h = c;
    const y = /* @__PURE__ */ new WeakMap(), v = typeof ResizeObserver > "u" ? null : new ResizeObserver((g) => {
      let S = !1;
      for (const E of g) {
        const k = Math.round(E.contentRect.height);
        y.has(E.target) && y.get(E.target) !== k && (S = !0), y.set(E.target, k);
      }
      S && It(e, l, "auto", i);
    }), w = () => {
      var g;
      f && clearTimeout(f), cancelAnimationFrame(d), v == null || v.disconnect(), e.classList.remove(Rr);
      for (const S of Ir) e.removeEventListener(S, w);
      ((g = r.current) == null ? void 0 : g.stop) === w && (r.current = null);
    }, R = () => {
      It(e, l, "auto", i);
      const g = e.scrollHeight;
      b = g === m ? b + 1 : 0, m = g;
      const S = performance.now() - h;
      b >= Ac && (g !== u || S > _c) || S > Mc ? w() : d = requestAnimationFrame(R);
    };
    for (const g of Ir) e.addEventListener(g, w, { passive: !0 });
    for (const g of Array.from(e.children)) v == null || v.observe(g);
    e.classList.add(Rr), r.current = { ...s, stop: w }, f = setTimeout(() => {
      f = null, h = performance.now(), u = e.scrollHeight, m = u, b = 0, d = requestAnimationFrame(R);
    }, lo);
  }, [e, t]), x(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Dc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${De}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ve) || null;
  }
  return null;
}
const Ir = ["wheel", "touchstart", "keydown", "pointerdown"];
function Co(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Cc(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function xc({ compare: e, onDone: t }) {
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Co(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Ra, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Ia, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
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
            /* @__PURE__ */ p(Ea, { size: 13, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(Pa, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Er({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Cc(t), a = [e === "compare" ? "对比" : "正在读", r, Co(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function zc({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return Re(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const d = e.querySelector(`[${Ve}="${c}"]`), f = d == null ? void 0 : d.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Ve}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ L("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(Er, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(Er, { role: "reading", ...n }) }) : null
  ] });
}
const Oc = () => () => {
}, Pr = () => null;
function $c({
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
function Fc(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Bc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function jc(e) {
  const t = $e(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Mt, b = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, v = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, R = (t == null ? void 0 : t.compareVersion) ?? null, g = (R == null ? void 0 : R.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", S = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = R ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, O = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), D = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), F = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), I = e.regions ?? (t == null ? void 0 : t.regions) ?? [], P = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [M, _] = N(null), H = Kr(
    T ? T.subscribe : Oc,
    T ? () => T.get().itemId : Pr,
    T ? () => T.get().itemId : Pr
  ), $ = T ? H : M, G = z((me) => {
    T ? T.set(me, "pdf") : _(me);
  }, [T]), te = $c({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: d
  }), X = Number.isFinite(b) && b > 0 ? Fc(
    b,
    n || r,
    typeof document > "u" ? b * 2 : document.documentElement.clientWidth
  ) : null;
  return Lc(u, X), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: oo,
      "data-reader-region-count": I.length,
      "data-reader-structured-region-count": I.filter(pa).length,
      "data-reader-metadata-ready": P ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${Fs} reader-mode-${te.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Sr,
                {
                  pane: "source",
                  url: g,
                  preloadedFile: E,
                  userZoom: m,
                  visible: te.showSource,
                  scrollRoot: u,
                  pageWidthOverride: X,
                  rowHeights: te.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: D,
                  activeRegion: F,
                  regions: (R == null ? void 0 : R.regions) ?? I,
                  readerMetadata: P,
                  hoveredRegionId: $,
                  onHoverRegion: G,
                  liveTranslation: d ? o : void 0,
                  showLiveTranslation: d,
                  liveTranslationPendingLabel: d ? Bc(o) : "",
                  paneAction: d ? /* @__PURE__ */ L(et, { children: [
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
              v ? /* @__PURE__ */ p(
                Sr,
                {
                  pane: "translated",
                  url: S,
                  preloadedFile: k,
                  userZoom: m,
                  visible: te.showTranslated,
                  scrollRoot: u,
                  pageWidthOverride: X,
                  rowHeights: te.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: D,
                  activeRegion: F,
                  regions: I,
                  readerMetadata: P,
                  hoveredRegionId: $,
                  onHoverRegion: G,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        R ? /* @__PURE__ */ p(zc, { shellEl: u, left: R.left, right: R.right }) : null
      ]
    }
  );
}
const Uc = [
  { id: "source", label: "原文", Icon: Zr },
  { id: "compare", label: "对照", Icon: Yr },
  { id: "translated", label: "译文", Icon: Xr }
];
function Hc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Wc(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Vc(e) {
  const t = $e(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, i = a ? Hc(a.state) : "";
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
          /* @__PURE__ */ p(Ta, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: i })
        ]
      }
    ) : null,
    /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Uc.map(({ id: l, label: c, Icon: d }) => {
      const f = n === l, u = Wc({
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
const Kc = Vr(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), Jc = Kc, qc = {
  markdown: { label: "Markdown", short: "MD", Icon: Jc, needsJob: !0 }
}, Gc = co.map(
  (e) => ({ id: e, ...qc[e] })
);
function xo() {
  return Gc.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Zc(e) {
  const t = $e(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(et, { children: xo().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
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
function Yc(e) {
  const t = $e(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = xo().map(({ id: l, label: c, short: d, Icon: f, needsJob: u }) => ({
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
        children: /* @__PURE__ */ p(Nt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Xc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Qc(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function ed(e) {
  return e / 100 * window.innerHeight;
}
function td(e) {
  return e / 100 * window.innerWidth;
}
function nd(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function bt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = nd(n);
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
      r = Qc(t, o);
      break;
    }
    case "em": {
      r = Xc(t, o);
      break;
    }
    case "vh": {
      r = ed(o);
      break;
    }
    case "vw": {
      r = td(o);
      break;
    }
  }
  return r;
}
function ve(e) {
  return parseFloat(e.toFixed(3));
}
function ut({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function vn(e) {
  const { panels: t } = e, n = ut({ group: e });
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
      const d = bt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = ve(d / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const d = bt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = ve(d / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const d = bt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = ve(d / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const d = bt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = ve(d / n * 100);
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
function wn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? rd : od
  );
}
function rd(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function od(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function zo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Oo(e, t) {
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
function ad({
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
    const { x: i, y: l } = Oo(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return re(o, "No rect found"), o;
}
let zt;
function sd() {
  return zt === void 0 && (typeof matchMedia == "function" ? zt = !!matchMedia("(pointer:coarse)").matches : zt = !1), zt;
}
function $o(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = wn(
    n,
    Array.from(t.children).filter(zo).map((b) => ({ element: b }))
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
            const v = u.element.getBoundingClientRect(), w = h.getBoundingClientRect();
            let R;
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
              ), S = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (m.length) {
                case 0: {
                  R = [
                    g,
                    S
                  ];
                  break;
                }
                case 1: {
                  const E = m[0], k = ad({
                    orientation: n,
                    rects: [v, w],
                    targetRect: E.element.getBoundingClientRect()
                  });
                  R = [
                    E,
                    k === v ? S : g
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
                  v.right,
                  w.top,
                  w.left - v.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  v.bottom,
                  w.width,
                  w.top - v.bottom
                )
              ];
            for (const g of R) {
              let S = "width" in g ? g : g.element.getBoundingClientRect();
              const E = sd() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
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
              const k = b <= c || b > d;
              !i && !k && s.push({
                group: e,
                groupSize: ut({ group: e }),
                panels: [u, y],
                separator: "width" in g ? void 0 : g,
                rect: S
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
var Ue;
class Fo {
  constructor() {
    qn(this, Ue, {});
  }
  addListener(t, n) {
    const r = mt(this, Ue)[t];
    return r === void 0 ? mt(this, Ue)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = mt(this, Ue)[t];
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
    Gn(this, Ue, {});
  }
  removeListener(t, n) {
    const r = mt(this, Ue)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ue = new WeakMap();
let ct = {
  cursorFlags: 0,
  state: "inactive"
};
const Ln = new Fo();
function Ye() {
  return ct;
}
function id(e) {
  return Ln.addListener("change", e);
}
function ld(e) {
  const t = ct, n = { ...ct };
  n.cursorFlags = e, ct = n, Ln.emit("change", {
    prev: t,
    next: n
  });
}
function dt(e) {
  const t = ct;
  ct = e, Ln.emit("change", {
    prev: t,
    next: e
  });
}
const cd = (e) => e, on = () => {
}, Bo = 1, jo = 2, Uo = 4, Ho = 8, Tr = 3, kr = 12;
let Ot;
function Nr() {
  return Ot === void 0 && (Ot = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Ot = !0)), Ot;
}
function dd({
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
        if (e && Nr()) {
          const a = (e & Bo) !== 0, s = (e & jo) !== 0, i = (e & Uo) !== 0, l = (e & Ho) !== 0;
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
    return Nr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Mr = /* @__PURE__ */ new WeakMap();
function Dn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Mr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Ye();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = dd({
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
  Mr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let _e = /* @__PURE__ */ new Map();
const Wo = new Fo();
function ud(e) {
  _e = new Map(_e), _e.delete(e);
}
function Ar(e, t) {
  for (const [n] of _e)
    if (n.id === e)
      return n;
}
function We(e, t) {
  for (const [n, r] of _e)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function tt() {
  return _e;
}
function Cn(e, t) {
  return Wo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Oe(e, t, n) {
  const r = _e.get(e);
  _e = new Map(_e), _e.set(e, t), Wo.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Vo(e) {
  const t = Ye();
  let n = !1;
  switch (t.state) {
    case "active":
      dt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Dn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = We(r.group.id, !0);
        Oe(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function _r(e) {
  e.defaultPrevented || Vo(e.currentTarget);
}
function fd(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Oo(n, a.rect);
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
function md(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function hd(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Cr(e),
    b: Cr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  re(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Dr(Lr(n.a)),
    b: Dr(Lr(n.b))
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
const pd = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function gd(e) {
  const t = getComputedStyle(Ko(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function bd(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || gd(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || pd.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Lr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (re(n, "Missing node"), bd(n)) return n;
  }
  return null;
}
function Dr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Cr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Ko(e);
  return t;
}
function Ko(e) {
  const { parentNode: t } = e;
  return md(t) ? t.host : t;
}
function yd(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function vd({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!zo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (hd(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (yd(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function xn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = $o(o), s = fd(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && vd({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function wd(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function ye(e, t, n = 0) {
  return Math.abs(ve(e) - ve(t)) <= n;
}
function Ae(e, t) {
  return ye(e, t) ? 0 : e > t ? 1 : -1;
}
function lt({
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
  if (Ae(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      Ae(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = ve(r), r;
}
function Et({
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
  re(d != null, "Invalid first pivot index"), re(f != null, "Invalid second pivot index");
  let u = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : d, y = n[h];
        re(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: w,
          minSize: R = 0
        } = y;
        if (w) {
          const g = i[h];
          if (re(
            g != null,
            `Previous layout not found for panel index ${h}`
          ), ye(g, v)) {
            const S = R - g;
            Ae(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const h = e < 0 ? d : f, y = n[h];
        re(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: w,
          minSize: R = 0
        } = y;
        if (w) {
          const g = i[h];
          if (re(
            g != null,
            `Previous layout not found for panel index ${h}`
          ), ye(g, R)) {
            const S = g - v;
            Ae(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : d, y = n[h];
      re(
        y,
        `Panel constraints not found for index ${h}`
      );
      const v = i[h], { collapsible: w, collapsedSize: R, minSize: g } = y;
      if (w && Ae(v, g) < 0)
        if (e > 0) {
          const S = g - R, E = S / 2, k = v + e;
          Ae(k, g) < 0 && (e = Ae(e, E) <= 0 ? 0 : S);
        } else {
          const S = g - R, E = 100 - S / 2, k = v - e;
          Ae(k, g) < 0 && (e = Ae(100 + e, E) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : d, v = 0;
    for (; ; ) {
      const R = i[y];
      re(
        R != null,
        `Previous layout not found for panel index ${y}`
      );
      const g = lt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: R,
        size: 100
      }) - R;
      if (v += g, y += h, y < 0 || y >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(v));
    e = e < 0 ? 0 - w : w;
  }
  {
    let h = e < 0 ? d : f;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(u), v = i[h];
      re(
        v != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = v - y, R = lt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: v,
        size: w
      });
      if (!ye(v, R) && (u += v - R, c[h] = R, u.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (wd(l, c))
    return o;
  {
    const h = e < 0 ? f : d, y = i[h];
    re(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const v = y + u, w = lt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: v
    });
    if (c[h] = w, !ye(w, v)) {
      let R = v - w, g = e < 0 ? f : d;
      for (; g >= 0 && g < n.length; ) {
        const S = c[g];
        re(
          S != null,
          `Previous layout not found for panel index ${g}`
        );
        const E = S + R, k = lt({
          overrideDisabledPanels: s,
          panelConstraints: n[g],
          prevSize: S,
          size: E
        });
        if (ye(S, k) || (R -= k - S, c[g] = k), ye(R, 0))
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
function Xe(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ae(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Qe({
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
    const d = lt({
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
      re(l != null, `No layout data found for index ${i}`);
      const c = l + a, d = lt({
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
function Jo({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = tt();
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
      const w = f[v];
      return (w == null ? void 0 : w.collapsible) && ye(w.collapsedSize, d[w.panelId]);
    }))) {
      const y = c.slice(0, m).reduce((v, w) => v + d[w.id], 0);
      return {
        ...d,
        [t]: ve(100 - y)
      };
    }
    return Et({
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
    }), v = Qe({
      layout: y,
      panelConstraints: f
    });
    Xe(b, v) || Oe(u, {
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
      const { group: c } = n(), { element: d } = o(), f = ut({ group: c }), u = bt({
        groupSize: f,
        panelElement: d,
        styleProp: l
      }), m = ve(u / f * 100);
      i(m);
    }
  };
}
function xr(e) {
  if (e.defaultPrevented)
    return;
  const t = tt();
  xn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Jo({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Ft(e) {
  const t = tt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function qo({
  groupId: e
}) {
  const t = () => {
    const n = tt();
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
      } = t(), c = Qe({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (Xe(i, c) || Oe(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function qe(e, t) {
  const n = Ft(e), r = We(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  re(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  re(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = qo({ groupId: n.id }).getLayout(), l = Et({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = Qe({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  Xe(i, c) || Oe(
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
function zr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Ft(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && qe(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && qe(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && qe(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && qe(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), qe(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Ft(t), o = We(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
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
          qe(t, m - u);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Ft(t).separators.map(
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
        e.preventDefault(), qe(t, -100);
        break;
      }
    }
}
function Or(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = tt(), n = xn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), dt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Go({
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
      defaultLayoutDeferred: w,
      derivedPanelConstraints: R,
      groupSize: g,
      layout: S,
      separatorToPanels: E
    } = v;
    if (R && S && E) {
      const k = Et({
        delta: h,
        initialLayout: y,
        panelConstraints: R,
        pivotIndices: c.panels.map((O) => m.indexOf(O)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (Xe(k, S)) {
        if (h !== 0 && !b)
          switch (u) {
            case "horizontal": {
              i |= h < 0 ? Bo : jo;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Uo : Ho;
              break;
            }
          }
      } else
        Oe(c.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: R,
          groupSize: g,
          layout: k,
          separatorToPanels: E
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & Tr : l |= i & Tr, t.movementY === 0 ? l |= s & kr : l |= i & kr, ld(l), Dn(e);
}
function $r(e) {
  const t = tt(), n = Ye();
  switch (n.state) {
    case "active":
      Go({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Fr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = Ye(), n = tt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        dt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = We(a.group.id, !0);
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
      Go({
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
      const a = xn(e, n);
      a.length === 0 ? t.state !== "inactive" && dt({
        cursorFlags: 0,
        state: "inactive"
      }) : dt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Dn(e.currentTarget);
      break;
    }
  }
}
function Br(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Ye().state) {
      case "hover":
        dt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function jr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Vo(e.currentTarget) && e.preventDefault();
}
function Ur(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = ve(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = ve((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Sd(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = ut({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: ve(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Rd(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Id({
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
        const m = u / 100 * n, b = ve(
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
      d[f] = ve(
        u / a * c
      );
    }
  else {
    const f = ve(
      c / l.length
    );
    for (const u of l)
      d[u] = f;
  }
  return d;
}
function Ed(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const at = /* @__PURE__ */ new Map();
function Pd(e) {
  let t = !0;
  re(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((b) => {
    for (const h of b) {
      const { borderBoxSize: y, target: v } = h;
      if (v === e.element) {
        if (t) {
          const w = ut({ group: e });
          if (w === 0)
            return;
          const R = We(e.id);
          if (!R)
            return;
          const g = vn(e), S = R.defaultLayoutDeferred ? Ur(g) : R.layout, E = Id({
            group: e,
            nextGroupSize: w,
            prevGroupSize: R.groupSize,
            prevLayout: S
          }), k = Qe({
            layout: E,
            panelConstraints: g
          });
          if (!R.defaultLayoutDeferred && Xe(R.layout, k) && Rd(
            R.derivedPanelConstraints,
            g
          ) && R.groupSize === w)
            return;
          Oe(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: g,
            groupSize: w,
            layout: k,
            separatorToPanels: R.separatorToPanels
          });
        }
      } else
        Sd(e, v, y);
    }
  });
  a.observe(e.element), e.panels.forEach((b) => {
    re(
      !r.has(b.id),
      `Panel ids must be unique; id "${b.id}" was used more than once`
    ), r.add(b.id), b.onResize && a.observe(b.element);
  });
  const s = ut({ group: e }), i = vn(e), l = e.panels.map(({ id: b }) => b).join(",");
  let c = e.mutableState.defaultLayout;
  c && (Ed(e.panels, c) || (c = void 0));
  const d = e.mutableState.layouts[l] ?? c ?? Ur(i), f = Qe({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  at.set(
    u,
    (at.get(u) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return $o(e).forEach((b) => {
    b.separator && m.set(b.separator, b.panels);
  }), Oe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((b) => {
    re(
      !o.has(b.id),
      `Separator ids must be unique; id "${b.id}" was used more than once`
    ), o.add(b.id), b.element.addEventListener("keydown", zr);
  }), at.get(u) === 1 && (u.addEventListener("contextmenu", _r, !0), u.addEventListener("dblclick", xr, !0), u.addEventListener("pointerdown", Or, !0), u.addEventListener("pointerleave", $r), u.addEventListener("pointermove", Fr), u.addEventListener("pointerout", Br), u.addEventListener("pointerup", jr, !0)), function() {
    t = !1, at.set(
      u,
      Math.max(0, (at.get(u) ?? 0) - 1)
    ), ud(e), e.separators.forEach((b) => {
      b.element.removeEventListener("keydown", zr);
    }), at.get(u) || (u.removeEventListener(
      "contextmenu",
      _r,
      !0
    ), u.removeEventListener(
      "dblclick",
      xr,
      !0
    ), u.removeEventListener(
      "pointerdown",
      Or,
      !0
    ), u.removeEventListener("pointerleave", $r), u.removeEventListener("pointermove", Fr), u.removeEventListener("pointerout", Br), u.removeEventListener("pointerup", jr, !0)), a.disconnect();
  };
}
function Td() {
  const [e, t] = N({}), n = z(() => t({}), []);
  return [e, n];
}
function zn(e) {
  const t = Jr();
  return `${e ?? t}`;
}
const nt = typeof window < "u" ? Re : x;
function vt(e) {
  const t = A(e);
  return nt(() => {
    t.current = e;
  }, [e]), z(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function On(...e) {
  return vt((t) => {
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
function $n(e) {
  const t = A({ ...e });
  return nt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Zo = En(null);
function kd(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: cd
  });
  Tn(t, () => n.current, []), nt(() => {
    Object.assign(
      n.current,
      qo({ groupId: e })
    );
  });
}
function Yo({
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
  }), h = vt((I) => {
    Xe(b.current.onLayoutChange, I) || (b.current.onLayoutChange = I, l == null || l(I));
  }), y = vt(
    (I, P) => {
      Xe(b.current.onLayoutChanged, I) || (b.current.onLayoutChanged = I, c == null || c(I, { isUserInteraction: P }));
    }
  ), v = zn(i), w = A(null), [R, g] = Td(), S = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), E = On(w, a);
  kd(v, s);
  const k = vt(
    (I, P) => {
      const T = Ye(), M = Ar(I), _ = We(I);
      if (_) {
        let H = !1;
        switch (T.state) {
          case "active": {
            H = T.hitRegions.some(
              ($) => $.group === M
            );
            break;
          }
        }
        return {
          flexGrow: _.layout[P] ?? 1,
          pointerEvents: H ? "none" : void 0
        };
      }
      if (n != null && n[P])
        return {
          flexGrow: n == null ? void 0 : n[P]
        };
    }
  ), O = $n({
    defaultLayout: n,
    disableCursor: r
  }), D = q(
    () => ({
      get disableCursor() {
        return !!O.disableCursor;
      },
      getPanelStyles: k,
      id: v,
      orientation: d,
      registerPanel: (I) => {
        const P = S.current;
        return P.panels = wn(d, [
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
        return P.separators = wn(d, [
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
          (H) => H.id === I
        );
        T && (T.panelConstraints.disabled = P);
        const M = Ar(v), _ = We(v);
        M && _ && Oe(M, {
          ..._,
          derivedPanelConstraints: vn(M)
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
    [k, v, g, d, O]
  ), F = A(null);
  return nt(() => {
    const I = w.current;
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
      id: v,
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
    F.current = M;
    const _ = Pd(M), { defaultLayoutDeferred: H, derivedPanelConstraints: $, layout: G } = We(M.id, !0);
    !H && $.length > 0 && (h(G), y(G, !1));
    const te = Cn(v, (Y) => {
      const { defaultLayoutDeferred: X, derivedPanelConstraints: me, layout: le } = Y.next;
      if (X || me.length === 0)
        return;
      const ce = M.panels.map(({ id: K }) => K).join(",");
      M.mutableState.layouts[ce] = le, me.forEach((K) => {
        if (K.collapsible) {
          const { layout: Q } = Y.prev ?? {};
          if (Q) {
            const pe = ye(
              K.collapsedSize,
              le[K.panelId]
            ), ue = ye(
              K.collapsedSize,
              Q[K.panelId]
            );
            pe && !ue && (M.mutableState.expandedPanelSizes[K.panelId] = Q[K.panelId]);
          }
        }
      });
      const he = Ye().state !== "active";
      h(le), he && y(le, Y.isUserInteraction);
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
    R,
    O
  ]), x(() => {
    const I = F.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Zo.Provider, { value: D, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": v,
      id: v,
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
Yo.displayName = "Group";
function Fn() {
  const e = Pn(Zo);
  return re(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Nd(e, t) {
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
  Tn(t, () => r.current, []), nt(() => {
    Object.assign(
      r.current,
      Jo({ groupId: n, panelId: e })
    );
  });
}
function Sn({
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
  const h = !!l, y = zn(l), v = $n({
    disabled: a
  }), w = A(null), R = On(w, s), {
    getPanelStyles: g,
    id: S,
    orientation: E,
    registerPanel: k,
    updatePanelProps: O
  } = Fn(), D = f !== null, F = vt(
    (M, _, H) => {
      f == null || f(M, l, H);
    }
  );
  nt(() => {
    const M = w.current;
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
    O(y, { disabled: a });
  }, [a, y, O]), Nd(y, u);
  const I = () => {
    const M = g(S, y);
    if (M)
      return JSON.stringify(M);
  }, P = Kr(
    (M) => Cn(S, M),
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
      "data-testid": y,
      id: y,
      ref: R,
      style: {
        ...Md,
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
Sn.displayName = "Panel";
const Md = {
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
function Ad({
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
    a = Qe({
      layout: Et({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Qe({
      layout: Et({
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
function Xo({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = zn(a), c = $n({
    disabled: n,
    disableDoubleClick: r
  }), [d, f] = N({}), [u, m] = N("inactive"), [b, h] = N(!1), y = A(null), v = On(y, o), {
    disableCursor: w,
    id: R,
    orientation: g,
    registerSeparator: S,
    updateSeparatorProps: E
  } = Fn(), k = g === "horizontal" ? "vertical" : "horizontal";
  nt(() => {
    const F = y.current;
    if (F !== null) {
      const I = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: F,
        id: l
      }, P = S(I), T = id(
        (_) => {
          m(
            _.next.state !== "inactive" && _.next.hitRegions.some(
              (H) => H.separator === I
            ) ? _.next.state : "inactive"
          );
        }
      ), M = Cn(
        R,
        (_) => {
          const { derivedPanelConstraints: H, layout: $, separatorToPanels: G } = _.next, te = G.get(I);
          if (te) {
            const Y = te[0], X = te.indexOf(Y);
            f(
              Ad({
                layout: $,
                panelConstraints: H,
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
  }, [R, l, S, c]), x(() => {
    E(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, E]);
  let O;
  n && !w && (O = "not-allowed");
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
Xo.displayName = "Separator";
const Bn = 30, jn = 65, Pt = 50, _d = 100 - jn, Ld = 100 - Bn;
function Dd(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(jn, Math.max(Bn, t)) : Pt;
}
function Un(e) {
  return 100 - e;
}
function st(e) {
  return `${e}%`;
}
const Hn = "reader-document", Tt = "reader-assistant", Qo = "retainpdf.reader.ai-split-layout.v1", Cd = {
  [Hn]: Un(Pt),
  [Tt]: Pt
};
function Wn(e) {
  const t = Dd(e == null ? void 0 : e[Tt]);
  return {
    [Hn]: Un(t),
    [Tt]: t
  };
}
function xd() {
  try {
    const e = JSON.parse(localStorage.getItem(Qo) || "null");
    return Wn(e);
  } catch {
    return Cd;
  }
}
function zd(e) {
  try {
    localStorage.setItem(Qo, JSON.stringify(Wn(e)));
  } catch {
  }
}
function an(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Wn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Tt]}vw`
  );
}
function Od() {
  const e = A(null), [t] = N(xd);
  Re(() => {
    const o = e.current;
    return an(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = z((o) => {
    an(e.current, o);
  }, []), r = z((o, a) => {
    an(e.current, o), a.isUserInteraction && zd(o);
  }, []);
  return /* @__PURE__ */ L(
    Yo,
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
          Sn,
          {
            id: Hn,
            defaultSize: st(Un(Pt)),
            minSize: st(_d),
            maxSize: st(Ld)
          }
        ),
        /* @__PURE__ */ p(
          Xo,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Sn,
          {
            id: Tt,
            defaultSize: st(Pt),
            minSize: st(Bn),
            maxSize: st(jn)
          }
        )
      ]
    }
  );
}
function $d({
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
function Fd({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p($d, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(et, { children: [
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
function Bd(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function jd() {
  const [e, t] = N(!1), n = Jr(), r = A(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Bd(a.target)) return;
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
        children: /* @__PURE__ */ p(ka, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: Vi.map((o) => /* @__PURE__ */ L("section", { className: "reader-react-shortcuts-group", children: [
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
const Ud = ["source", "sideBySide", "translated"], Hd = { source: "", translated: "", sideBySide: "" };
function Wd(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Bt(e.sourceUrl), n = Bt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return es({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Vd(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = q(
    () => e ? Wd(e) : Hd,
    [e]
  ), o = q(
    () => Ud.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = z(async (s) => {
    if (!e) return;
    const i = Bt(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? Qa(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ts(
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
        ns(c), n((d) => {
          const f = new Set(d);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Kd = {
  source: Zr,
  sideBySide: Yr,
  translated: Xr
}, Jd = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function qd(e) {
  const t = $e(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Vd(n), i = A(null);
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
      /* @__PURE__ */ p(Na, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(Gr, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = ia[l], d = Bt(r[l]), f = a.has(l), u = !!d && !f, m = u ? "" : la(l, r), b = Kd[l];
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
                Jd[l],
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
const Gd = "retainpdf:reader:bookmarks:v1:", Zd = 200;
function Vn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ea(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Gd}${t}` : "";
}
function Yd(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Jt(e, t = Vn()) {
  const n = ea(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Yd(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Rn(e, t, n) {
  const r = ea(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Zd);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Xd(e, t, n = "", { storage: r = Vn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Jt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Rn(e, a.filter((i) => i.page !== s), r) : Rn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Qd(e, t, n = Vn()) {
  return Rn(e, Jt(e, n).filter((r) => r.page !== t), n);
}
function eu(e, t) {
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
function tu({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function nu({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => Jt(e)), [i, l] = N(!1), c = A(null);
  if (x(() => {
    s(Jt(e)), l(!1);
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
        onClick: () => s(Xd(e, d, eu(r, d))),
        children: /* @__PURE__ */ p(tu, { filled: f })
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
          /* @__PURE__ */ p(Ma, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
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
          onClick: () => s(Qd(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function ru(e) {
  const [t, n] = N([]);
  return x(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Ke().loadIssues;
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
function ou(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const au = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, su = ["failed", "content", "layout"];
function iu(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function lu({ jobId: e, currentPage: t }) {
  var f;
  const n = ru(e), r = (f = $e()) == null ? void 0 : f.jumpToBlock, [o, a] = N(!1), [s, i] = N(-1), l = A(null);
  x(() => i(-1), [n]);
  const c = (u) => {
    const m = n[u];
    !m || !r || (i(u), r(m.readerItemId));
  }, d = A({ issues: n, last: s, currentPage: t, goTo: c });
  return d.current = { issues: n, last: s, currentPage: t, goTo: c }, x(() => {
    const u = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || iu(m.target)) return;
      const { issues: b, last: h, currentPage: y, goTo: v } = d.current, w = ou(b, h, y, m.shiftKey);
      w < 0 || (m.preventDefault(), v(w));
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
      oe,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((u) => !u),
        children: [
          /* @__PURE__ */ p(Aa, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ L("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      su.map((u) => {
        const m = n.map((b, h) => ({ issue: b, index: h })).filter(({ issue: b }) => b.kind === u);
        return m.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ L("h4", { children: [
            au[u],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: b, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
            oe,
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
const cu = 48, du = 96, uu = 700;
function fu(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= cu, downSoFar: r };
}
function mu(e) {
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
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${De}]`)), !i.get(m))) return;
      const b = m.scrollTop, h = o.get(m);
      if (o.set(m, b), h === void 0 || Date.now() - a > uu) return;
      const y = fu(!1, r.current, b - h);
      r.current = y.downSoFar, b - h < -4 ? n(!1) : y.hidden && !l() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - du && (r.current = 0, n(!1));
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
function hu(e) {
  const t = $e(), n = Lo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Mt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = Ks(a), f = a > so + 1e-3, u = a < Vt - 1e-3, m = it(r, Ze()), b = m >= Vt ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = A(null), y = mu(h), [v, w] = N(!1), [R, g] = N(`${i}`);
  x(() => {
    v || g(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, v]);
  const S = () => {
    if (w(!1), !c || l <= 0)
      return;
    const E = Number(`${R}`.trim());
    c(Kt(E, l));
  };
  return /* @__PURE__ */ L("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: v ? /* @__PURE__ */ L(
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
                E.key === "Escape" && (E.preventDefault(), w(!1), g(`${i}`));
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
          !c || l <= 0 || (g(`${i}`), w(!0));
        },
        children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      nu,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(lu, { jobId: e.issuesJobId, currentPage: i }) : null,
    /* @__PURE__ */ L("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(Rt(a, -1)),
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
          onClick: () => s(Rt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(jd, {}) })
  ] });
}
function Hr(e) {
  var t, n;
  return uo(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function pu(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Hr(Le(e))
  }));
  x(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Hr(Le(e))
    });
  }, [e]), x(() => {
    t.scope === e && Zt(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = z((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const In = "download-toast";
function gu({
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
function bu(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    cn.dismiss(In);
    return;
  }
  cn.custom(
    () => /* @__PURE__ */ p(gu, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: In, duration: 1 / 0 }
  );
}
function yu() {
  const e = z((t) => {
    t && (t.setState = bu, t.hide = () => cn.dismiss(In));
  }, []);
  return /* @__PURE__ */ L(et, { children: [
    /* @__PURE__ */ p(va, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function vu(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : io(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function wu(e, t) {
  return t === null || e !== t;
}
function Su(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function Ru(e, t) {
  const n = e === t;
  return { open: n, mounted: Su(n) };
}
const Wr = { itemId: null, origin: null };
function Iu() {
  let e = Wr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Wr : { itemId: n, origin: r };
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
const Eu = [];
function Pu({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(oe, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(_a, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Tu({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    oe,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(La, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function ku({
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
  const l = ((g = $e()) == null ? void 0 : g.regions) ?? Eu, c = ((S = Lo()) == null ? void 0 : S.currentPage) ?? 1, d = q(() => uc(l), [l]), f = fc(d, c), u = q(() => pc(l, s), [l, s]), [m, b] = N(-1);
  x(() => b(-1), [s]);
  const h = A(null), y = A(null), v = A(n);
  v.current = n, x(() => {
    const E = (O) => {
      var F, I;
      const D = O.target;
      !D || (F = y.current) != null && F.contains(D) || (I = D.closest) != null && I.call(D, ".reader-finder-toggles, [data-finder-toggle]") || v.current();
    }, k = (O) => {
      O.key === "Escape" && v.current();
    };
    return document.addEventListener("pointerdown", E, !0), document.addEventListener("keydown", k), () => {
      document.removeEventListener("pointerdown", E, !0), document.removeEventListener("keydown", k);
    };
  }, []);
  const w = A(null);
  x(() => {
    var E, k, O;
    e === "search" ? (E = h.current) == null || E.focus() : (O = (k = w.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null || O.scrollIntoView({ block: "center" });
  }, [e, i]), x(() => {
    var E, k;
    e === "search" && m >= 0 && ((k = (E = w.current) == null ? void 0 : E.querySelector('[aria-current="true"]')) == null || k.scrollIntoView({ block: "nearest" }));
  }, [e, m]);
  const R = (E) => {
    const k = u[E];
    k && (b(E), r(k.itemId));
  };
  return /* @__PURE__ */ L("aside", { ref: y, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(oe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(oe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(oe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(Nt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: w, className: "reader-finder-list", children: d.map((E, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
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
    ) }, E.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: l.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ L(et, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          eo,
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
              E.key === "Enter" ? (E.preventDefault(), R(bc(m, u.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: u.length === 0 ? "没有找到" : `${m >= 0 ? `第 ${m + 1} / ` : ""}${u.length >= 200 ? "200+ 处，只列前 200 处" : `${u.length} 处`}${m < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: u.map((E, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(oe, { className: "reader-finder-entry is-hit", "aria-current": k === m ? "true" : void 0, onClick: () => R(k), children: [
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
function Nu({ active: e, compare: t, ink: n }) {
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
    a ? /* @__PURE__ */ p(xc, { compare: t, onDone: () => {
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
          children: /* @__PURE__ */ p(Qr, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(Zc, { active: e }),
      t.available ? /* @__PURE__ */ p(
        oe,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ p(Da, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
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
        children: r ? /* @__PURE__ */ p(Nt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Ca, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Mu = [
  { tool: "pen", label: "画笔", Icon: Qr },
  { tool: "highlighter", label: "荧光笔", Icon: xa },
  { tool: "eraser", label: "橡皮", Icon: za }
];
function ta(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function na({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L(et, { children: [
    Mu.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-btn",
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
    To.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(oe, { className: "reader-ink-btn", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Oa, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-btn",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p($a, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-btn",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(Nt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Au({ ink: e, menu: t, onClose: n }) {
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
  return /* @__PURE__ */ p("div", { ref: r, className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", style: { left: a, top: s }, "data-ink-menu": "true", children: /* @__PURE__ */ p(na, { ink: e, page: t.page, onPick: n }) });
}
function _u({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(na, { ink: e }) }) : null;
}
function Lu(e) {
  var r;
  if (e.shiftKey || ta(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${oo}`))) return null;
  const n = Number((r = t.closest(`[${De}]`)) == null ? void 0 : r.getAttribute(De)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Du(e) {
  const t = A(e);
  t.current = e, x(() => {
    const n = (r) => {
      if (ta(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function sn() {
  try {
    return Ke().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Cu(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function xu(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function zu(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Ou({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null), [s, i] = N(null), [l, c] = N(""), [d, f] = N(""), u = A(0);
  x(() => {
    r([]), i(null), f("");
    const y = sn();
    if (!y || !e) return;
    let v = !1;
    return y.list(e).then((w) => {
      v || (r(w.versions), a(w.currentVersionId));
    }).catch(() => {
    }), () => {
      v = !0;
    };
  }, [e, t]);
  const m = z((y) => {
    const v = sn(), w = n.find((g) => g.versionId === y);
    if (!v || !w || !e) return;
    const R = ++u.current;
    c(y), f(""), (async () => {
      const g = Ke(), S = await v.resolveJob(e, y);
      if (!S) throw new Error("这一份还没有能读的译文。");
      const E = await g.loadReaderPayload(S, { includeOptionalArtifacts: !0 }), k = g.resolveReaderTranslatedPdfUrl(E.jobPayload, E.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: w.name, jobId: S, url: k, regions: Cu(qr(E.regionsPayload)) };
    })().then((g) => {
      R === u.current && i(g);
    }).catch((g) => {
      R === u.current && f((g == null ? void 0 : g.message) || "这一份打不开。");
    }).finally(() => {
      R === u.current && c("");
    });
  }, [e, n]), b = z(() => {
    u.current += 1, i(null), c(""), f("");
  }, []), h = z(async () => {
    var w, R;
    const y = sn();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (g) {
      f((g == null ? void 0 : g.message) || "换不过去，请稍后再试。");
      return;
    }
    const v = (w = globalThis.location) == null ? void 0 : w.href;
    v && ((R = globalThis.history) == null || R.replaceState(globalThis.history.state, "", zu(v, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: xu(n, t, o),
    compared: s,
    loading: l,
    error: d,
    choose: m,
    clear: b,
    adopt: h
  };
}
const $u = "reader-finder-input";
function Fu(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Bu(e, t = typeof window > "u" ? null : window) {
  x(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Fu(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains($u) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function ju() {
  try {
    return Ke().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Uu = "这本书正在处理（翻译或排版），处理完才能改。", Hu = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Wu({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = ju(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = Bl(s), c = !t || wt(t), d = Kl(n), [f, u] = N(""), [m, b] = N(null), [h, y] = N(() => /* @__PURE__ */ new Map()), [v, w] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [R, g] = N(() => /* @__PURE__ */ new Map()), [S, E] = N({ phase: "idle" }), k = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  x(() => {
    b(null), k.drafts.clear(), k.generation.current = null, g(/* @__PURE__ */ new Map()), E({ phase: "idle" });
  }, [s]), x(() => {
    if (u(""), !i || l || !a) return;
    let _ = !1;
    return a.resolveOwnerJobId(s).then((H) => {
      _ || u(`${H || s}`.trim() || s);
    }).catch(() => {
      _ || u(s);
    }), () => {
      _ = !0;
    };
  }, [i, l, a, s]), x(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !d || !c) return;
    let _ = !1;
    return a.fetchRevisions(f).then((H) => {
      _ || y(Jl(H, d));
    }).catch(() => {
    }), () => {
      _ = !0;
    };
  }, [a, f, d, c]);
  const O = S.phase === "running" && S.seenActive;
  x(() => {
    if (S.phase === "running") {
      if (!c) {
        O || E({ phase: "running", seenActive: !0 });
        return;
      }
      O && E(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [S.phase, O, c, t]);
  const D = q(() => {
    const _ = new Map(h);
    if (v.renderedAt === d)
      for (const [H, $] of v.edits) _.set(H, $);
    return _;
  }, [h, v, d]), F = z((_) => {
    const H = `${_ || ""}`.trim();
    H && b({ itemId: H, page: jl(H) });
  }, []), I = z(() => b(null), []), P = z((_, H) => {
    w(($) => {
      const G = new Map($.renderedAt === d ? $.edits : []);
      return G.set(_, H), { renderedAt: d, edits: G };
    }), g(($) => new Map($).set(_, ($.get(_) || 0) + 1));
  }, [d]), T = z(async () => {
    if (!(!a || !s || S.phase === "submitting" || S.phase === "running")) {
      E({ phase: "submitting" });
      try {
        await a.rerender(s), E({ phase: "running", seenActive: !1 }), await o();
      } catch (_) {
        E({ phase: "failed", message: (_ == null ? void 0 : _.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, S.phase, o]), M = l ? Hu : !c || S.phase === "running" || S.phase === "submitting" ? Uu : "";
  return q(() => ({
    available: i,
    blockedReason: M,
    port: a,
    ownerJobId: f,
    target: m,
    select: F,
    close: I,
    memory: k,
    pendingEdits: D,
    savedCounts: R,
    markSaved: P,
    rerender: S,
    startRerender: T
  }), [i, M, a, f, m, F, I, k, D, R, P, S, T]);
}
function Vu(e, t) {
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
function Ku({ edit: e }) {
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
const Ju = oa(() => import("./ReaderMarkdownPanel-BpzHBXzZ.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function qu(e) {
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
function Gu(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Zu() {
  var B;
  const e = Hi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = pu(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = N(!1), d = A(null), f = A(null), u = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, b = qu({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: l,
    assistantOpen: u
  }), h = Ci({
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
        const j = Le(e.viewStateKey), U = vu({
          savedMode: j == null ? void 0 : j.mode,
          sourceViewOnly: y,
          viewportWidth: Ze()
        });
        f.current = U.auto ? U.mode : null, U.mode && U.mode !== e.mode && e.setModeKeepingPage(U.mode);
        return;
      }
      wu(e.mode, f.current) && (f.current = null, Zt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const w = s || (e.mode === "compare" ? "compare" : "reading"), R = Ru(s, "markdown");
  Zi({
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
  const g = z(() => {
    i(null);
  }, []), S = z((j) => {
    const U = Gu(j, e.liveTranslationAvailable);
    U !== null && c(U), e.setModeKeepingPage(j);
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
  ) : null, [h.sourcePaneToggle, l]), k = z((j) => {
    i(j);
  }, []), [O] = N(Iu), [D, F] = N(null), I = z((j) => F((U) => U === j ? null : j), []), [P, T] = N(""), [M, _] = N("");
  x(() => {
    const j = P.replace(/\s+/gu, " ").trim(), U = window.setTimeout(() => _(j), j ? 150 : 0);
    return () => window.clearTimeout(U);
  }, [P]);
  const [H, $] = N(0), G = z(() => {
    F("search"), $((j) => j + 1);
  }, []);
  Bu(G);
  const te = z((j) => {
    e.jumpToAnchor({ block_id: j }), (D === "outline" || Ze() < 900) && F(null);
  }, [e.jumpToAnchor, D]), Y = z((j) => e.jumpToAnchor({ block_id: j }), [e.jumpToAnchor]), X = Wu({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), me = X.select, le = e.setModeKeepingPage, ce = z((j) => {
    v === "source" && le("compare"), me(j);
  }, [me, v, le]);
  Vu(X.available ? ce : null, O);
  const he = zl(e.viewStateKey);
  Du(he);
  const [K, Q] = N(null), pe = z(() => Q(null), []), ue = Ou({ documentId: o.documentId, jobId: o.jobId }), fe = ((B = ue.compared) == null ? void 0 : B.url) || "";
  x(() => {
    fe && v !== "compare" && S("compare");
  }, [fe]), x(() => {
    v !== "compare" && ue.clear();
  }, [v]);
  const Fe = q(
    () => {
      const { compared: j, versions: U, readingVersionId: ie } = ue;
      if (!j) return null;
      const ne = U.find((we) => we.versionId === j.versionId), ge = U.find((we) => we.versionId === ie);
      return {
        url: j.url,
        regions: j.regions,
        left: { name: j.name, createdAt: (ne == null ? void 0 : ne.createdAt) || "" },
        right: { name: (ge == null ? void 0 : ge.name) || "当前译文", createdAt: (ge == null ? void 0 : ge.createdAt) || "" }
      };
    },
    [ue.compared, ue.versions, ue.readingVersionId]
  ), Ie = q(() => {
    if (!X.savedCounts.size) return e.revisedBlocks;
    const j = new Map(e.revisedBlocks);
    for (const [U, ie] of X.savedCounts) j.set(U, (j.get(U) || 0) + ie);
    return j;
  }, [e.revisedBlocks, X.savedCounts]), Ne = q(() => ({
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
    revisedBlocks: Ie,
    editBlock: X.available ? ce : void 0,
    blockEdit: X,
    editShowsSource: v !== "compare",
    findTerm: D === "search" ? M : "",
    compareVersion: Fe,
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
    O,
    Y,
    Ie,
    X,
    ce,
    v,
    D,
    M,
    Fe,
    he,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    k,
    g
  ]), Ee = q(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), ee = [
    $s,
    `is-workspace-${w}`,
    u ? "is-assistant-open" : "",
    D ? "is-finder-open" : "",
    b.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(oc, { value: Ne, hud: Ee, children: /* @__PURE__ */ L(
    "div",
    {
      className: ee,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": w,
      "data-ink-mode": he.tool || void 0,
      onContextMenu: (j) => {
        const U = Lu(j);
        U && (j.preventDefault(), Q(U));
      },
      children: [
        /* @__PURE__ */ p(Fd, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(Pu, { open: D, onToggle: I }),
        D ? /* @__PURE__ */ p(
          ku,
          {
            tab: D,
            onTab: F,
            onClose: () => F(null),
            onJump: te,
            query: P,
            onQuery: T,
            term: M,
            focusSignal: H
          }
        ) : null,
        /* @__PURE__ */ L("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(qd, {}),
          /* @__PURE__ */ p(rl, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Vc,
          {
            mode: v,
            documentReady: !!o.jobId,
            sourceViewOnly: y,
            onModeChange: S,
            liveTranslation: h.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((j) => !j)
            } : null
          }
        ),
        /* @__PURE__ */ p(Yc, { active: s }),
        u ? /* @__PURE__ */ p(Od, {}) : null,
        /* @__PURE__ */ p(jc, { paneComposition: b, markdownSplit: R.open, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
        e.showHud ? /* @__PURE__ */ p(
          hu,
          {
            mode: v,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(Tu, { open: D, onToggle: I })
          }
        ) : null,
        /* @__PURE__ */ p(ra, { fallback: null, children: R.mounted ? /* @__PURE__ */ p(Ju, { open: R.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: g }) : null }),
        /* @__PURE__ */ p(Nu, { active: s, compare: ue, ink: he }),
        /* @__PURE__ */ p(Au, { ink: he, menu: K, onClose: pe }),
        /* @__PURE__ */ p(_u, { ink: he }),
        /* @__PURE__ */ p(Ku, { edit: X }),
        /* @__PURE__ */ p(yu, {})
      ]
    }
  ) });
}
function gf() {
  return /* @__PURE__ */ p(Zu, {});
}
export {
  gf as R,
  Zu as a,
  hf as d,
  mf as f,
  pf as r,
  $e as u
};
//# sourceMappingURL=ReaderApp-CvurBuOB.js.map
