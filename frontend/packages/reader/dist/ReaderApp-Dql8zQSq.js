var Ea = Object.defineProperty;
var or = (e) => {
  throw TypeError(e);
};
var ka = (e, t, n) => t in e ? Ea(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var ar = (e, t, n) => ka(e, typeof t != "symbol" ? t + "" : t, n), sr = (e, t, n) => t.has(e) || or("Cannot " + n);
var St = (e, t, n) => (sr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), ir = (e, t, n) => t.has(e) ? or("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), lr = (e, t, n, r) => (sr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as _, jsx as p, Fragment as ct } from "react/jsx-runtime";
import { useMemo as q, useState as k, useEffect as D, useCallback as x, useRef as N, useLayoutEffect as Te, memo as en, createContext as Ln, useContext as Dn, forwardRef as co, useImperativeHandle as Cn, useSyncExternalStore as uo, useId as fo, Component as Ma, Suspense as Na, lazy as Aa } from "react";
import { requireAdapter as vt, getReaderAdapters as Ne } from "./adapters.js";
import { resolveReaderDownloadName as _a, resolveReaderDownloadUrls as La, READER_PROGRESS_COPY as je, trimString as Vt, READER_DOWNLOAD_ACTIONS as Da, disabledReason as Ca } from "./runtime/state.js";
import { r as xa, b as Oa } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as pn, isFinishedJobStatus as Nt } from "@retainpdf/domain/job";
import { n as mo, d as za, f as Ut, k as gn, b as $a, c as ho, j as Ot, p as xn, g as Fa, l as cr, i as Ba } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as ja } from "@retainpdf/api/documents";
import { isReaderTransportError as Ha, createReaderTransportError as Ua } from "./contracts.js";
import { toast as bn, Toaster as Wa } from "sonner";
import { X as wt, PenLine as On, Check as po, Copy as Ka, ChevronUp as Va, ChevronDown as go, History as Ja, LoaderCircle as qa, Pin as Ga, LogOut as Za, FileText as bo, Columns2 as yo, Languages as vo, PanelRight as Ya, Radio as Xa, ArrowDownToLine as Qa, CheckCircle2 as es, Keyboard as ts, Download as ns, ListOrdered as rs, TriangleAlert as os, ListTree as as, Search as ss, GitCompareArrows as is, LayoutGrid as ls, Highlighter as cs, Eraser as ds, Undo2 as us, Trash2 as fs } from "lucide-react";
import { Button as Q, Textarea as ms, IconButton as dr, Input as wo } from "@retainpdf/ui";
import { pdfjs as So, Page as hs, Document as ps } from "react-pdf";
import { e as gs, m as bs, a as ys } from "./markdown-math-XkF5urpn.js";
const vs = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ws = "", Ss = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Is = (e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, $m = (...e) => {
  var n;
  return (((n = Ne()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, He = () => vt("defaultReaderDataPort"), ur = () => vt("defaultReaderPageConfigPort"), Fm = {
  get apiPrefix() {
    return He().apiPrefix;
  },
  fetchProtected: (...e) => He().fetchProtected(...e),
  loadMarkdownPayload: (e) => He().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => He().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => He().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => He().loadJobPayload(e),
  loadReaderPayload: (e, t) => He().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => He().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return He().liveTranslation;
  }
}, Io = {
  messageTargetOrigin: () => ur().messageTargetOrigin(),
  readerJobId: () => ur().readerJobId()
}, Rs = () => {
  var e;
  return ((e = Ne()) == null ? void 0 : e.liveTranslation) ?? null;
}, At = () => {
  var t;
  const e = Ne();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Qe = () => {
  const e = Ne();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => vt("fetchDocumentByJobId")(...n),
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
}, Ps = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Ts = () => {
  var e, t;
  return ((t = (e = Ne()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Es = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ks = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? _a(...e);
}, Ms = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? La(...e);
}, Ns = (...e) => vt("downloadProtectedResource")(...e), As = (...e) => vt("failDownloadToast")(...e), Bm = (e, t) => vt("resolveMarkdownAssetUrl")(e, t), fr = "/api/v1";
function _s() {
  const e = () => {
    var r;
    return xa(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = k(e);
  return D(() => {
    var i, l, c, d;
    const r = () => n(e()), o = (l = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : l.bind(globalThis.history), a = (d = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : d.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const m = (u) => function(...f) {
          const g = u.apply(this, f);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), g;
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
function Ls() {
  const e = _s(), t = q(() => Es(Io), [e]), n = q(() => Ts(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Ds(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [l, c] = k({
    documentId: "",
    jobId: ""
  }), [d, m] = k({
    documentId: "",
    jobId: ""
  }), u = l.documentId === t ? l.jobId : "", f = d.documentId === t ? d.jobId : "", g = n || u, [h, v] = k({
    jobId: "",
    documentId: ""
  }), S = h.jobId === g ? h.documentId : "", w = t || S, y = !!t && !g, [b, I] = k(null), P = (b == null ? void 0 : b.sessionIdentity) === r && b.documentId === w ? b : null, M = y || !!P, z = x((F) => {
    const R = `${F.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      v({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const T = `${F.revision || ""}`.trim() || `${Date.now()}`;
    I({
      documentId: R,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  D(() => {
    I((F) => F && F.sessionIdentity !== r ? null : F);
  }, [r]);
  const $ = x((F) => {
    switch (F.type) {
      case "resolved-document-job":
        c({ documentId: F.documentId, jobId: F.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        m({ documentId: F.documentId, jobId: F.jobId });
        break;
      case "resolved-job-document":
        v((R) => R.jobId === F.jobId && R.documentId === F.documentId ? R : { jobId: F.jobId, documentId: F.documentId });
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
    setMissingDocumentJob: m,
    documentJobId: u,
    rejectedDocumentJobId: f,
    sessionJobId: g,
    resolvedJobDocument: h,
    setResolvedJobDocument: v,
    jobDocumentId: S,
    documentId: w,
    sourceOnly: y,
    committedDocumentSource: b,
    setCommittedDocumentSource: I,
    activeCommittedDocumentSource: P,
    sourceViewOnly: M,
    refreshCommittedDocument: z,
    applyIdentityEvent: $
  };
}
function mr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Cs(e) {
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
function hr(e, t) {
  return Is(pn(e, t));
}
function xs(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Os(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !xs(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function yn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Ss.progress,
        stage: n,
        percent: e,
        text: t
      },
      Io.messageTargetOrigin()
    );
  } catch {
  }
}
function Jt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), yn({ percent: t, text: n, stage: r });
}
function zs(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = k(null), [c, d] = k(null), [m, u] = k(""), [f, g] = k(0), h = m === n ? i : null, v = m === n ? c : null, S = mr(h), w = Nt(S), y = x(() => {
    g(($) => $ + 1);
  }, []), b = x(($) => {
    l($.jobPayload), d($.manifestPayload), u($.sessionIdentity);
  }, []), I = x(($) => {
    l(null), d(null), u($);
  }, []), P = N(""), M = N(""), z = x(async () => {
    const $ = o.current;
    if (!$ || P.current === $) return;
    const F = Qe().loadJobPayload;
    if (typeof F != "function") return;
    const R = a.current.value;
    P.current = $;
    try {
      const T = await F($);
      if (s.current || a.current.value !== R || o.current !== $ || !T || typeof T != "object")
        return;
      const E = mr(T);
      l(T), u(r.current), !Nt(E) && M.current === $ && (M.current = ""), E === "succeeded" && M.current !== $ && (M.current = $, g((A) => A + 1));
    } catch {
    } finally {
      P.current === $ && (P.current = "");
    }
  }, []);
  return D(() => {
    M.current = "";
  }, [n]), D(() => {
    if (!t || w || !h) return;
    const $ = window.setInterval(() => {
      document.visibilityState !== "hidden" && z();
    }, 1e3);
    return () => window.clearInterval($);
  }, [w, z, h, t]), {
    jobPayload: i,
    setJobPayload: l,
    manifestPayload: c,
    setManifestPayload: d,
    payloadSessionIdentity: m,
    setPayloadSessionIdentity: u,
    scopedJobPayload: h,
    scopedManifestPayload: v,
    jobStatus: S,
    jobTerminal: w,
    jobRefreshRevision: f,
    refreshJobArtifacts: y,
    refreshJobStatus: z,
    publishPayload: b,
    clearPayload: I
  };
}
function vn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function $s(e, t) {
  e(t), vn(t);
}
function Fs(e) {
  const [t, n] = k(e ? "source" : "compare"), r = x((a) => {
    e && a !== "source" || (n(a), vn(a));
  }, [e]), o = x((a) => {
    $s(n, a);
  }, []);
  return D(() => (e && document.documentElement.classList.add("reader-source-only"), vn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function pr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Bs(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: pr(n.active_job_id),
    activeVersionId: pr(n.active_version_id)
  };
}
function js(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Hs(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Us(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ws = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ks(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ws.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Vs = 48 * 1024 * 1024;
function Js(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const qs = 2, ke = /* @__PURE__ */ new Map();
function wn(e, t) {
  ke.delete(e), ke.set(e, t);
}
function gr(e) {
  if (ke.size < qs) return;
  const t = ke.keys().next().value;
  t && ke.delete(t);
}
async function Gs(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Ro(e, t = At().fetchProtected, n = {}) {
  var d, m, u, f, g, h, v, S, w;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ke.has(r)) {
    const y = ke.get(r);
    return wn(r, y), y;
  }
  const o = new AbortController(), a = () => o.abort();
  (d = n.signal) != null && d.aborted && o.abort(), (u = (m = n.signal) == null ? void 0 : m.addEventListener) == null || u.call(m, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (f = n.signal) == null ? void 0 : f.removeEventListener) == null || g.call(f, "abort", a);
  }
  if (!s.ok) {
    const y = new Error(`读取 PDF 失败 (${s.status})`);
    y.status = s.status;
    const b = await Gs(s);
    throw b && (y.reason = b), y;
  }
  const i = Zs(r, s, t);
  if (i) {
    o.abort();
    const y = { ranged: i };
    return gr(), ke.set(r, y), y;
  }
  (v = (h = n.signal) == null ? void 0 : h.addEventListener) == null || v.call(h, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (w = (S = n.signal) == null ? void 0 : S.removeEventListener) == null || w.call(S, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return ke.has(r) ? wn(r, c) : (gr(), ke.set(r, c)), c;
}
function Zs(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Vs ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const Ys = { file: null, loading: !1, error: "" }, Xs = { file: null, loading: !0, error: "" };
function Qs(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = k(null);
  if (D(() => {
    if (t || !n) return;
    const s = ke.get(n);
    if (s) {
      wn(n, s);
      return;
    }
    const i = new AbortController();
    return Ro(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ys;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = ke.get(n);
  return a ? { file: a, loading: !1, error: "" } : Xs;
}
function ei(e) {
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
async function Sn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Jt(s, r, n, "download");
  const i = await Ro(t, At().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Jt(s, o, n, "download"), i);
}
async function ti(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Jt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Sn({
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
    Sn({
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
function ni(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function ri({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = ja,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(ni(o.href, t, a)), !0);
}
const $t = {
  regions: null,
  metadata: null
};
function oi(e) {
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
    publishPayload: m,
    clearPayload: u,
    switchSessionMode: f,
    jobRefreshRevision: g,
    sessionEpochRef: h,
    closingRef: v,
    activeLoadAbortRef: S
  } = e, [w, y] = k(""), [b, I] = k(""), [P, M] = k(null), [z, $] = k(null), [F, R] = k(!1), [T, E] = k(""), [A, L] = k([]), [j, B] = k(!1), [W, ee] = k(() => ({
    source: null,
    translated: null
  })), [oe, J] = k(
    $t
  ), [le, ce] = k({
    loading: !0,
    percent: 4,
    text: je.boot,
    stage: "progress",
    failed: !1
  });
  return D(() => {
    const de = new AbortController(), xe = h.current.value, G = ei({
      sessionEpochRef: h,
      closingRef: v,
      abort: de,
      sessionEpoch: xe
    });
    S.current = de;
    const X = Qe();
    if (v.current)
      return de.abort(), () => {
        S.current === de && (S.current = null);
      };
    let Re = !1;
    function fe(te, me) {
      G.markFailed(), B(!0), ce({
        loading: !1,
        percent: 100,
        text: te,
        stage: "failed",
        failed: !0
      }), yn({ percent: 100, text: me, stage: "failed" });
    }
    function he() {
      R(!0), Re || B(!0), ce({
        loading: !1,
        percent: 100,
        text: je.ready,
        stage: "ready",
        failed: !1
      }), yn({ percent: 100, text: je.ready, stage: "ready" });
    }
    function et() {
      return c != null && c.documentId ? hr(
        c.documentId,
        c.revision
      ) : vs() ? ws : X.resolveResourceUrl(pn(r));
    }
    async function Ae() {
      var Y;
      let te = { activeJobId: "", activeVersionId: "" };
      try {
        const ne = await ((Y = X.fetchDocument) == null ? void 0 : Y.call(X, r));
        ne && (te = Bs(ne));
      } catch {
      }
      const me = js({
        link: te,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (me.kind === "follow-active-job") {
        if (G.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: me.jobId
        }), me.activeVersionId ? (c || d({
          type: "committed-source",
          documentId: r,
          revision: me.activeVersionId,
          sessionIdentity: l
        }), f("source")) : f("compare");
        return;
      }
      if (me.kind === "open-committed-source") {
        if (G.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: me.revision,
          sessionIdentity: l
        }), f("source");
        return;
      }
      const ge = et();
      if (G.isInactive()) return;
      y(ge), I(""), E(""), u(l);
      const O = await Sn({
        url: ge,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: G,
        setBoot: ce
      });
      if (!G.isInactive()) {
        if (!O) {
          fe("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        M(O), he();
      }
    }
    async function pe() {
      var V;
      const te = !c, me = !!(te && X.loadSessionSnapshot && X.loadReaderOptionalArtifacts), ge = me ? X.loadReaderOptionalArtifacts(t) : null, O = await ((V = X.loadSessionSnapshot) == null ? void 0 : V.call(X, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: te && !me
      })), Y = O ? {
        jobPayload: O.sourcePayload,
        manifestPayload: O.manifestPayload,
        readerMetadata: O.readerMetadata,
        regionsPayload: O.regions,
        readerErrors: O.readerErrors
      } : await X.loadReaderPayload(t, {
        includeOptionalArtifacts: te
      });
      if (G.isInactive()) return;
      let ne = null;
      if (n && !r)
        if (O && O.linkedDocument !== void 0)
          ne = O.linkedDocument;
        else {
          try {
            ne = await X.fetchDocumentByJobId(fr, t);
          } catch {
          }
          if (G.isInactive()) return;
        }
      const _e = Cs(Y.jobPayload) || `${(ne == null ? void 0 : ne.document_id) || ""}`.trim();
      _e && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: _e
      });
      const be = Hs({
        payloadDocumentId: _e,
        linkedActiveJobId: `${(ne == null ? void 0 : ne.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ne == null ? void 0 : ne.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (be.kind === "restore-committed-source") {
        if (G.isInactive()) return;
        d({
          type: "committed-source",
          documentId: be.documentId,
          revision: be.revision,
          sessionIdentity: l
        }), f("source");
        return;
      }
      const Le = X.resolveReaderSourcePdf(Y.manifestPayload), De = X.resolveReaderTranslatedPdfUrl(Y.jobPayload, Y.manifestPayload), Fe = typeof Le == "string" ? Le : X.resolveReaderArtifactUrl(Le), we = r || _e, Pe = c != null && c.documentId ? hr(
        c.documentId,
        c.revision
      ) : Fe || (we ? X.resolveResourceUrl(pn(we)) : ""), Be = c ? "" : De || "";
      y(Pe || ""), I(Be), E(Os(Y.jobPayload, t)), m({
        jobPayload: Y.jobPayload || null,
        manifestPayload: Y.manifestPayload || null,
        sessionIdentity: l
      });
      const tt = () => ti({
        sourceFinal: Pe || "",
        translatedFinal: Be,
        fence: G,
        setBoot: ce
      }), nt = !!(Pe || Be), H = ge && nt ? tt() : null;
      H == null || H.catch(() => {
      });
      const se = (U) => {
        G.isInactive() || (L(c ? [] : mo(U.regionsPayload)), ee(c ? { source: null, translated: null } : za(U.readerMetadata)), J(c ? $t : U.readerErrors ?? $t), B(!0));
      };
      if (ge ? (Re = !0, ge.then(se)) : se(Y), !nt) {
        fe(je.failed, je.failed);
        return;
      }
      const C = await (H ?? tt());
      if (C.status !== "inactive") {
        if (C.status === "incomplete") {
          fe("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        M(C.sourceBytes), $(C.translatedBytes), he();
      }
    }
    async function Ee() {
      R(!1), M(null), $(null), L([]), B(!1), ee({ source: null, translated: null }), J($t), Jt(ce, 8, je.metadata, "metadata");
      try {
        if (s) {
          await Ae();
          return;
        }
        if (!t) {
          fe(je.failed, je.failed);
          return;
        }
        await pe();
      } catch (te) {
        if (G.isClosedOrStale() || (te == null ? void 0 : te.name) === "AbortError") return;
        G.markFailed();
        const me = Number(te == null ? void 0 : te.status), ge = `${(te == null ? void 0 : te.reason) || ""}`, O = Ks({ status: me, reason: ge, sessionJobId: t });
        if (O && (await ri({
          apiPrefix: fr,
          documentId: O,
          expiredJobId: t
        }) || G.isClosedOrStale()))
          return;
        if (Us({
          status: me,
          reason: ge,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), f("source");
          return;
        }
        const Y = te instanceof Error ? te.message : je.failed;
        fe(Y, Y);
      }
    }
    return Ee(), () => {
      de.abort(), S.current === de && (S.current = null);
    };
  }, [t, r, o, a, s, i, c, g, n, l, d, m, u, f]), {
    sourceUrl: w,
    translatedUrl: b,
    sourceFile: P,
    translatedFile: z,
    assetsReady: F,
    title: T,
    regions: A,
    regionsSettled: j,
    readerMetadata: W,
    readerErrors: oe,
    boot: le
  };
}
function ai() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ls(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), l = N(""), c = N(""), d = N(() => {
  }), m = x(() => d.current(), []), u = Ds({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: l,
    sessionJobIdRef: c,
    switchToSourceMode: m
  }), {
    sessionJobId: f,
    documentId: g,
    sourceOnly: h,
    sourceViewOnly: v
  } = u, { mode: S, setMode: w, switchSessionMode: y } = Fs(v);
  d.current = () => {
    y("source");
  }, i.current = a, l.current = g, c.current = f;
  const b = zs({
    sessionJobId: f,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: I,
    scopedManifestPayload: P,
    jobStatus: M,
    jobTerminal: z,
    jobRefreshRevision: $,
    refreshJobArtifacts: F,
    refreshJobStatus: R
  } = b, T = oi({
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
    publishPayload: b.publishPayload,
    clearPayload: b.clearPayload,
    switchSessionMode: y,
    jobRefreshRevision: $,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = x(() => {
    var L;
    e.current = !0, (L = t.current) == null || L.abort();
  }, []), A = q(
    () => ({
      fetchProtected: Qe().fetchProtected,
      jobId: f,
      jobPayload: I,
      manifestPayload: P,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: v
    }),
    [f, I, P, T.sourceUrl, T.translatedUrl, v]
  );
  return {
    jobId: f,
    jobStatus: M,
    workflow: `${(I == null ? void 0 : I.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: z,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: S,
    setMode: w,
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
    download: A,
    refreshJobArtifacts: F,
    refreshJobStatus: R,
    refreshCommittedDocument: u.refreshCommittedDocument,
    prepareClose: E
  };
}
const si = 160, ii = 8, li = 0;
function ci() {
  const e = N(null), [t, n] = k(null), [r, o] = k(li), a = x((s) => {
    e.current = s, n(s);
  }, []);
  return D(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < si || o((d) => Math.abs(d - c) < ii ? d : c);
    }, l = new ResizeObserver((c) => {
      var d, m;
      i(((m = (d = c[0]) == null ? void 0 : d.contentRect) == null ? void 0 : m.width) ?? s.clientWidth);
    });
    return l.observe(s), i(s.clientWidth), () => l.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function di(e) {
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
const rn = { source: 0, translated: 0 };
function ui(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: l
  } = e, c = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, d = N(c);
  d.current = c;
  const [m, u] = k(() => ({
    identity: c,
    pages: rn
  })), [f, g] = k(() => ({ identity: c, tick: 0 })), h = m.identity === c ? m.pages : rn, v = f.identity === c ? f.tick : 0, S = di({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: w } = S, y = x((R, T) => {
    d.current === c && u((E) => {
      const A = E.identity === c ? E.pages : rn;
      return A[T] === R && E.identity === c ? E : {
        identity: c,
        pages: { ...A, [T]: R }
      };
    });
  }, [c]), b = N(null), I = x(() => {
    b.current && clearTimeout(b.current);
    const R = c;
    b.current = setTimeout(() => {
      b.current = null, d.current === R && g((T) => ({
        identity: R,
        tick: T.identity === R ? T.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  D(() => (b.current && (clearTimeout(b.current), b.current = null), u((R) => R.identity === c && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: c, pages: { source: 0, translated: 0 } }), g((R) => R.identity === c && R.tick === 0 ? R : { identity: c, tick: 0 }), () => {
    b.current && (clearTimeout(b.current), b.current = null);
  }), [c]);
  const P = q(
    () => Math.max(h.source, h.translated),
    [h]
  ), M = w === "translated" ? h.translated : h.source || h.translated, z = t == null ? void 0 : t.userZoom, $ = t == null ? void 0 : t.shellWidth, F = `${c}-${v}-${z}-${n}-${h.source}-${h.translated}-${$}`;
  return {
    ...S,
    numPagesByPane: h,
    hudNumPages: P,
    primaryNumPages: M,
    metricsTick: v,
    onNumPages: y,
    onMetrics: I,
    rowSyncRevision: F
  };
}
const Me = "data-reader-page", Ie = "data-reader-pane", zn = "data-natural-height", fi = "reader-react-root", Po = "reader-react-grid", To = "reader-react-scroll-shell", tn = "reader-react-pdf-pane", Eo = "reader-react-pdf-page", qt = "reader-react-pdf-page-placeholder", $n = "reader-react-pdf-page-slot";
function Gt(e, t) {
  const n = e != null ? `[${Me}="${e}"]` : `[${Me}]`;
  return t ? `${n}[${Ie}="${t}"]` : n;
}
function Fn() {
  return `.${$n}[${Me}]`;
}
function Zt(e) {
  return Number(e.getAttribute(Me));
}
const ko = 0.25, Yt = 1, mi = 0.05, zt = 0.5, hi = 16, pi = 8, Mo = hi + pi, gi = 720;
function ot() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function No(e) {
  return Number.isFinite(e) && e < gi;
}
function ht(e, t = Number.POSITIVE_INFINITY) {
  return No(t) && (e === "source" || e === "translated") ? Yt : zt;
}
function Ke(e) {
  return Number.isFinite(e) ? Math.min(Yt, Math.max(ko, e)) : zt;
}
function _t(e, t) {
  const n = Ke(Number(e) + t * mi);
  return Math.round(n * 100) / 100;
}
function bi(e) {
  return Math.round(Ke(e) * 100);
}
function Ao(e) {
  const n = (Number(e) || 0) - Mo;
  return Math.max(160, Math.floor(n));
}
function yi(e, t = zt) {
  const n = Ke(t);
  return Ao((Number(e) || 0) * n);
}
function vi(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Ie}]`)
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
const wi = 8;
function Si(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < wi ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const _o = 200, Lo = [
  "markdown"
], Ii = [
  "side"
], Ri = [...Lo, ...Ii];
function Do(e) {
  return Ri.includes(e);
}
const Pi = "retainpdf:reader:view:v1:", br = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Ti = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Co() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function In(e) {
  return `${e || ""}`.trim();
}
function Ei({
  documentId: e,
  jobId: t
}) {
  const n = In(e);
  if (n) return `document:${n}`;
  const r = In(t);
  return r ? `job:${r}` : "";
}
function xo(e) {
  const t = In(e);
  return t ? `${Pi}${t}` : "";
}
function ki(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Mi(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!br.has(t) || !br.has(n) || t === n))
    return { left: t, right: n };
}
function Ni(e) {
  return e === null ? null : Do(e) ? e : void 0;
}
function Ai(e) {
  return Ti.has(e) ? e : void 0;
}
function Oo(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = ki(t.anchor), r = Number(t.zoom), o = Ai(t.mode), a = Mi(t.splitLayout), s = Ni(t.assistantPanel);
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
function $e(e, t = Co()) {
  const n = xo(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Oo(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function nn(e, t, n = Co()) {
  const r = xo(e);
  if (!r || !n) return null;
  const o = $e(e, n), a = Oo({
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
function _i(e, t, n = "") {
  var u;
  const [r, o] = k(() => {
    var f;
    return ((f = $e(n)) == null ? void 0 : f.zoom) ?? ht(e, ot());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), l = N(((u = $e(n)) == null ? void 0 : u.zoom) !== void 0);
  D(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const f = (h = $e(n)) == null ? void 0 : h.zoom;
    l.current = f !== void 0;
    const g = f ?? ht(e, ot());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), D(() => {
    if (l.current) return;
    const f = ht(e, ot()), g = a.current;
    Math.abs(f - g) < 5e-4 || (i.current = 1, a.current = f, o(f));
  }, [e]);
  const c = x((f, g) => {
    const h = Ke(f), v = a.current;
    Math.abs(h - v) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (v || 1), a.current = h, l.current = !0, nn(s.current, { zoom: h }), o(h));
  }, []), d = x((f) => {
    c(_t(a.current, f));
  }, [c]), m = x((f) => {
    c(ht(f));
  }, [c]);
  return Te(() => {
    const f = i.current;
    Math.abs(f - 1) < 1e-3 || (i.current = 1, vi(t == null ? void 0 : t.current, f));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: d, resetZoom: m };
}
const Li = 160, Di = 3e-3, yr = 50, Ci = 16, xi = 800;
function Oi(e, t = 0) {
  const n = t === 1 ? Ci : t === 2 ? xi : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-yr, Math.min(yr, r));
  return Math.exp(-o * Di);
}
function zi(e, t, n = 0) {
  return Ke(e * Oi(t, n));
}
function $i(e) {
  return Math.round(Ke(e) * 100) / 100;
}
function Fi(e, t, n) {
  const r = Ke(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ke(t) / r;
  const a = (o + Mo) / r;
  return Ao(a * Ke(t)) / o;
}
function Bi(e) {
  return Array.from(e.querySelectorAll(Fn()));
}
function ji(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Hi(e, t, n) {
  let r = null;
  for (const s of Bi(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const l = ji(i, t, n);
    if ((!r || l < r.distance) && (r = { el: s, rect: i, distance: l }), l === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Me) || "",
    pane: o.getAttribute(Ie) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Ui(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function zo(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Fn()}[${Me}="${t.page}"][${Ie}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Ui(n, e).scrollLeft += a);
}
function Wi(e, t, n, r) {
  const o = e.querySelector(`.${Po}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function It(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Ki = 600, Vi = 1e3;
function Ji(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || zo(e, t);
  });
  a.observe(n);
  const s = (d) => {
    d.type === "wheel" && d.ctrlKey || c();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const d of i) r.addEventListener(d, s, { capture: !0, passive: !0 });
  const l = r.setTimeout(() => c(), Vi);
  function c() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(l);
      for (const d of i) r == null || r.removeEventListener(d, s, { capture: !0 });
    }
  }
  return c;
}
function qi(e, t, n) {
  const r = N(t);
  r.current = t;
  const o = N(n);
  o.current = n;
  const a = N(null), s = N(null), i = N(null);
  D(() => {
    if (!e) return;
    const l = () => {
      const d = a.current;
      if (a.current = null, !d) return;
      const m = $i(d.target);
      if (Math.abs(m - r.current) < 5e-3) {
        It(d.grid);
        return;
      }
      const u = { anchor: d.anchor, grid: d.grid, fallback: null };
      u.fallback = setTimeout(() => {
        s.current === u && (s.current = null, It(u.grid));
      }, Ki), s.current = u, o.current(m, { keepScroll: !1 });
    }, c = (d) => {
      var f, g;
      if (!d.ctrlKey) return;
      d.preventDefault();
      let m = a.current;
      if (!m) {
        (f = i.current) == null || f.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, It(h.grid)), m = {
          start: r.current,
          target: r.current,
          anchor: Hi(e, d.clientX, d.clientY),
          grid: null,
          timer: null
        }, a.current = m;
      }
      m.target = zi(m.target, d.deltaY, d.deltaMode);
      const u = Fi(m.start, m.target, ((g = m.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      m.grid = Wi(e, u, d.clientX, d.clientY) ?? m.grid, m.timer && clearTimeout(m.timer), m.timer = setTimeout(l, Li);
    };
    return e.addEventListener("wheel", c, { passive: !1 }), () => {
      var m;
      e.removeEventListener("wheel", c);
      const d = a.current;
      a.current = null, d != null && d.timer && clearTimeout(d.timer), It((d == null ? void 0 : d.grid) ?? null), (m = i.current) == null || m.call(i), i.current = null;
    };
  }, [e]), Te(() => {
    var c;
    const l = s.current;
    l && (s.current = null, l.fallback && clearTimeout(l.fallback), It(l.grid), !(!e || !l.anchor) && (zo(e, l.anchor), (c = i.current) == null || c.call(i), i.current = Ji(e, l.anchor)));
  }, [t, e]);
}
function Gi(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: x((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const Bn = 48;
function $o(e, t = Bn) {
  return e.getBoundingClientRect().top + t;
}
function Fo(e, t) {
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
      const m = d.getBoundingClientRect();
      return m.height >= 8 && m.width >= 8;
    });
    c && c.getBoundingClientRect().bottom < t && (n = c);
  }
  if (!n)
    return null;
  const o = Zt(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Wt(e, t, n = Bn) {
  if (!e)
    return null;
  const r = Gt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = $o(e, n), i = Fo(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Lt(e, t, n = "auto", r, o = Bn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(Gt(a, r))), i || (i = e.querySelector(Gt(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const d = c.height > 0 ? c.height : i.offsetHeight, m = e.scrollTop + (c.top - l.top), u = Math.max(0, m + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - u) >= 1 && (e.scrollTop = u) : e.scrollTo({ top: u, behavior: n }), !0;
}
function Zi(e, t, n = "smooth", r) {
  return Lt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Rn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var d;
    if (a) return;
    Lt(
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
function Yi(e, t, n) {
  return Rn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Xt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Ce(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Xi(e, t, n = !0, r = "", o) {
  const [a, s] = k(1);
  return D(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let l = !1, c = null, d = 0;
    const m = Gt(void 0, o), u = () => {
      if (l) return;
      const h = Array.from(i.querySelectorAll(m));
      if (!h.length)
        return;
      const v = $o(i), S = Fo(h, v);
      S && s(S.page);
    }, f = () => {
      l || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, u();
      }));
    }, g = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(m)).length) {
        c = setTimeout(g, 120);
        return;
      }
      u(), i.addEventListener("scroll", f, { passive: !0 });
    };
    return g(), () => {
      l = !0, c && clearTimeout(c), d && cancelAnimationFrame(d), i.removeEventListener("scroll", f);
    };
  }, [e, t, n, r, o]), a;
}
const Qi = `canvas, .react-pdf__Page, .${Eo}, .${qt}`, vr = /* @__PURE__ */ new WeakMap();
function el(e) {
  const t = Number(e.getAttribute(zn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = vr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Qi), vr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function tl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function nl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Fn()).forEach((r) => {
    const o = Zt(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = el(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function rl(e, t, n = "", r) {
  const [o, a] = k(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, Te(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, d = !1, m = !1;
    const u = () => {
      var I;
      if (l) return;
      const y = e.current;
      if (!y) return;
      const b = nl(y);
      tl(s.current, b) || (s.current = b, a(b)), d && !m && (m = !0, (I = i.current) == null || I.call(i));
    }, f = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(u);
      });
    };
    f();
    const g = window.setTimeout(f, 100), h = window.setTimeout(() => {
      d = !0, f();
    }, 300), v = window.setTimeout(f, 700), S = e.current;
    let w = null;
    return S && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => f()), w.observe(S)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(v), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const ol = [0, 48, 140, 320, 560], al = 700, sl = [80, 200, 400], il = 500, ll = 50, cl = /* @__PURE__ */ new Set([
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
]), dl = 180, wr = [0, 48, 140, 320, 700, 1200];
function ul(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((T = $e(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), l = N(null), c = N(!1), d = N(r), m = N(null), u = N(null), f = N(null), g = N(null), h = N(a), v = N(""), S = N(n);
  S.current = n;
  const w = x(() => {
    var E;
    (E = m.current) == null || E.call(m), m.current = null, u.current != null && (clearTimeout(u.current), u.current = null);
  }, []), y = x(() => {
    !c.current && l.current == null || (w(), f.current != null && (clearTimeout(f.current), f.current = null), l.current = null, c.current = !1);
  }, [w]), b = x((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const A = () => {
      g.current = null, nn(h.current, {
        anchor: Ce(i.current)
      });
    };
    E ? A() : g.current = setTimeout(A, dl);
  }, []), I = x((E) => {
    i.current = Ce(E), l.current = null, f.current != null && clearTimeout(f.current), f.current = setTimeout(() => {
      f.current = null, c.current = !1;
    }, ll);
  }, []);
  D(() => {
    if (!o)
      return;
    let E = !1, A = null, L = null, j = null;
    const B = () => {
      if (E) return;
      const W = e.current;
      if (!W) {
        j = setTimeout(B, 50);
        return;
      }
      A = W, L = () => {
        if (c.current)
          return;
        const ee = Wt(A, S.current);
        ee && (i.current = ee, b());
      }, A.addEventListener("scroll", L, { passive: !0 }), c.current || L();
    };
    return B(), () => {
      E = !0, j != null && clearTimeout(j), A && L && A.removeEventListener("scroll", L);
    };
  }, [o, r, n, e, b]), D(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const A = (L) => {
      L.metaKey || L.ctrlKey || L.altKey || cl.has(L.key) && y();
    };
    return E.addEventListener("wheel", y, { passive: !0 }), E.addEventListener("touchmove", y, { passive: !0 }), window.addEventListener("keydown", A), () => {
      E.removeEventListener("wheel", y), E.removeEventListener("touchmove", y), window.removeEventListener("keydown", A);
    };
  }, [o, e, y]), Te(() => {
    var A;
    if (h.current === a) return;
    b(!0), w(), f.current != null && (clearTimeout(f.current), f.current = null), h.current = a, v.current = "";
    const E = (A = $e(a)) == null ? void 0 : A.anchor;
    i.current = E ? Ce(E) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, d.current = r;
  }, [a, r, b, w]), D(() => {
    var A;
    if (!o || !s || !a || v.current === a) return;
    v.current = a;
    const E = Ce(
      ((A = $e(a)) == null ? void 0 : A.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, l.current = E, c.current = !0, w(), m.current = Rn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: S.current,
        delaysMs: wr,
        onDone: () => I(E)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(E);
    }, Math.max(...wr) + 160), () => w();
  }, [o, s, a, e, I, w]), D(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      c.current = !1, l.current = null, w();
      return;
    }
    const E = l.current ? Ce(l.current) : Ce(i.current);
    return c.current = !0, l.current = E, i.current = E, w(), m.current = Rn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: ol,
        onDone: () => I(E)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(E);
    }, al), () => {
      w();
    };
  }, [r, o, n, e, I, w]), D(() => () => {
    w(), f.current != null && (clearTimeout(f.current), f.current = null), b(!0);
  }, [w, b]);
  const P = x(() => {
    const E = Wt(
      e.current,
      S.current
    );
    return Ce(E || i.current);
  }, [e]), M = x(() => {
    c.current = !0;
    const E = Wt(
      e.current,
      S.current
    ), A = Ce(E ?? i.current);
    return i.current = A, l.current = A, b(), A;
  }, [e, b]), z = x((E, A, L) => {
    const j = L || S.current, B = Xt(E, A || 1), W = { page: B, fraction: 0 };
    i.current = W, c.current = !0, l.current = W, b(), w(), Zi(e.current, B, "smooth", j), m.current = Yi(
      () => e.current,
      B,
      {
        behavior: "auto",
        pane: j,
        delaysMs: sl,
        onDone: () => I(W)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(W);
    }, il);
  }, [e, I, w, b]), $ = x(() => Ce(i.current), []), F = x(() => c.current, []), R = x(() => {
    if (!c.current || !l.current)
      return;
    const E = Ce(l.current);
    Lt(
      e.current,
      E,
      "auto",
      S.current
    );
  }, [e]);
  return {
    lockFromShell: P,
    beginModeSwitch: M,
    goToPage: z,
    getAnchor: $,
    isRestoring: F,
    repinIfRestoring: R
  };
}
function fl(e, t) {
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
function Bo(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const ml = [0, 80, 200, 400, 800], hl = 120, pl = 400;
function gl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: d = !0 } = e, m = N(a);
  m.current = a;
  const u = N(s);
  u.current = s;
  const f = N(i);
  f.current = i;
  const g = N(n);
  g.current = n, D(() => {
    var b, I;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Ps(), v = fl(h, u.current);
    if (v == null && (h != null && h.blockId) && !d) return;
    const S = Bo(h, v, { jobId: l, documentId: c });
    if (t.current === S)
      return;
    if (v == null) {
      t.current = S, (b = g.current) == null || b.call(g);
      return;
    }
    t.current = S, h && ((I = f.current) == null || I.call(f, h, v));
    const w = [];
    let y = 0;
    for (const P of ml)
      y = Math.max(y, P), w.push(
        setTimeout(() => {
          m.current(v);
        }, P)
      );
    return w.push(
      setTimeout(() => {
        var P;
        (P = g.current) == null || P.call(g);
      }, y + hl)
    ), () => {
      for (const P of w) clearTimeout(P);
    };
  }, [r, o, l, c, t, d]);
}
function bl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function yl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = pl,
    jobId: i,
    documentId: l,
    applyReaderSearch: c
  } = e, d = N(a);
  d.current = a;
  const m = N(c);
  m.current = c;
  const u = N(0);
  D(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || u.current === o) return;
    const f = setTimeout(() => {
      var S;
      const g = ((S = globalThis.location) == null ? void 0 : S.search) || "", h = Oa(g, o, d.current);
      if (u.current = o, h === null) return;
      const v = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Bo(
        { blockId: v },
        o,
        { jobId: i, documentId: l }
      ), (m.current || bl)(h);
    }, s);
    return () => clearTimeout(f);
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
function vl(e) {
  const t = N(""), [n, r] = k(!1), o = x(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  gl(a, t, o), yl(e, t, n);
}
const Rt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function wl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Sr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function jo(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Sr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Sr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Sl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = jo(r, t, n);
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
function Il(e) {
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
function Rl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function Pl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function Tl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function El(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Ir = [250, 500, 1e3, 2e3, 4e3], on = [80, 160, 320, 640, 1e3, 1500], Rr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Pn(e, t) {
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
function jn(e) {
  return Ha(e) ? `${e.code || ""}`.trim() : "";
}
function Ft(e, t) {
  const n = jn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function kl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (jo(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = Ua(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = jn(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = on[Math.min(s, on.length - 1)];
    if (await Pn(i, r), s >= on.length + 2) throw a;
  }
}
function Ml({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = k(Rt), s = N(o), i = N("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), d = Nt(c) ? c : "";
  return D(() => {
    if (!n || !l) {
      i.current = "", s.current = Rt, a(Rt);
      return;
    }
    const m = r === void 0 ? Rs() : r, u = i.current === l;
    if (i.current = l, !m) {
      const y = {
        ...u ? s.current : Rt,
        connection: d ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = y, a(y);
      return;
    }
    const f = new AbortController();
    let g = !1;
    const h = {
      ...u ? s.current : Rt,
      connection: d ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = h, a(h);
    const v = (y) => {
      f.signal.aborted || a((b) => {
        const I = y(b);
        return s.current = I, I;
      });
    }, S = async () => {
      let y = 0;
      for (; !f.signal.aborted; )
        try {
          const b = await m.fetchLayout(l, { signal: f.signal });
          g = !0, v((I) => ({
            ...I,
            layoutByPage: wl(b),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError") return;
          const I = jn(b);
          if (!(I === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !I)) {
            v((M) => ({
              ...M,
              connection: d ? "terminal" : "unavailable",
              jobStatus: c,
              error: Ft(b, "实时译文暂不可用")
            }));
            return;
          }
          if (d) {
            v((M) => ({
              ...M,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          v((M) => ({
            ...M,
            connection: "connecting",
            jobStatus: c,
            error: Ft(b, "正在等待 OCR 版面数据")
          })), await Pn(Ir[Math.min(y, Ir.length - 1)], f.signal).catch(() => {
          }), y += 1;
        }
    };
    return (async () => {
      if (await S(), !g || f.signal.aborted) return;
      let y = 0;
      for (; !f.signal.aborted; ) {
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
          await m.streamEvents(l, {
            afterSeq: s.current.lastSeq,
            signal: f.signal,
            onEvent: async (b) => {
              if (b.seq <= s.current.lastSeq) return;
              let I;
              try {
                I = await kl(
                  l,
                  b,
                  s.current,
                  f.signal,
                  m
                );
              } catch (P) {
                if ((P == null ? void 0 : P.name) === "AbortError" || f.signal.aborted) throw P;
                v((M) => ({
                  ...M,
                  lastSeq: Math.max(M.lastSeq, b.seq),
                  error: Ft(P, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              v((P) => {
                const M = Sl(P, b, I);
                return d ? {
                  ...M,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...M,
                  jobStatus: c
                };
              }), y = 0;
            }
          });
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError" || f.signal.aborted) return;
          v((I) => ({
            ...I,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: c,
            error: Ft(b, "实时译文连接已中断，正在重连")
          }));
        }
        if (f.signal.aborted) return;
        if (d) {
          v((b) => ({
            ...b,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await Pn(Rr[Math.min(y, Rr.length - 1)], f.signal).catch(() => {
        }), y += 1;
      }
    })(), () => f.abort();
  }, [n, r, l, d]), o;
}
function Nl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function Al(e, t = !0) {
  const [n, r] = k(() => /* @__PURE__ */ new Map());
  return D(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Qe().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Nl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const _l = 4500;
function Ll(e) {
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
const Dl = /* @__PURE__ */ new Set(["book", "translate"]);
function Ho(e) {
  return !!(e.jobId && e.sourceUrl && Dl.has(e.workflow));
}
function Cl(e) {
  return !!(Ho(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function xl() {
  const e = ai(), t = Ho({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Cl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Nt(o) && (r.current.running = !0);
  const a = Ml({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = ci(), d = Al(e.jobId, !e.sourceOnly), m = Ei({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${m}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: f, onZoomChange: g } = _i(e.mode, s, m);
  qi(i, f, g);
  const h = ui(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: f, shellWidth: l, identityKey: u }
  ), {
    beginModeSwitch: v,
    goToPage: S,
    repinIfRestoring: w
  } = ul(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: m,
    restoreReady: h.primaryNumPages > 0
  });
  D(() => {
    w();
  }, [l, w]);
  const y = rl(
    s,
    h.compareMode,
    h.rowSyncRevision,
    w
  ), b = Xi(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${f}-${h.metricsTick}`,
    h.primaryPane
  ), I = x((B, W) => {
    var oe, J;
    const ee = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((oe = h.numPagesByPane) == null ? void 0 : oe.source) || 0,
      Number((J = h.numPagesByPane) == null ? void 0 : J.translated) || 0
    );
    S(B, ee, W);
  }, [S, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [P, M] = k(null), z = N(null), $ = x((B) => {
    z.current && clearTimeout(z.current), M(B), B && (z.current = setTimeout(() => M(null), _l));
  }, []);
  D(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const F = x((B) => {
    const W = Ut(e.regions, B);
    return W ? gn(W, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), R = x((B, W) => {
    const ee = W || h.primaryPane, oe = typeof B == "object" && B ? `${B.block_id || ""}`.trim() : "", J = typeof B == "object" && B ? `${B.image_url || ""}`.trim() : "", le = typeof B == "object" && B ? B.page_idx != null ? Number(B.page_idx) + 1 : B.page != null ? Number(B.page) : null : typeof B == "number" ? B + 1 : null, ce = $a(e.regions, J, le) || Ut(e.regions, oe) || (typeof B == "object" ? ho(e.regions, B) : null);
    let de = ce ? gn(ce, ee).page : null;
    return de == null && (de = Ll(B)), de == null || de < 1 ? "none" : ($(ce), I(de, ee), ce ? "block" : "page");
  }, [$, I, h.primaryPane, e.regions]);
  vl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: b,
    goToPage: I,
    resolveBlockPage: F,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (B) => {
      $(Ut(e.regions, B.blockId));
    }
  });
  const { setModeKeepingPage: T } = Gi({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  D(() => {
    $(null);
  }, [u, $]);
  const E = !e.boot.loading && !e.boot.failed, A = q(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), L = q(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), j = q(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: f,
    onZoomChange: g,
    shell: A,
    panes: h,
    sessionFiles: L,
    rowHeights: y,
    goToPage: I,
    activeRegion: P,
    jumpToAnchor: R,
    setModeKeepingPage: T,
    download: e.download,
    showHud: E,
    viewStateKey: m,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, A, h, L, y, I, P, R, T, E, f, g, m, a, n, d]);
  return q(() => ({
    ...j,
    currentPage: b
  }), [j, b]);
}
const Ol = [
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
], zl = [
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
  }
];
function $l(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Ol)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Fl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Bl = ".reader-notes-panel";
function jl(e) {
  return e instanceof Element ? !!e.closest(Bl) : !1;
}
function Hl(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: i,
    goToPage: l,
    toggleDocDark: c,
    enabled: d = !0
  } = e;
  D(() => {
    if (!d)
      return;
    const m = (u) => {
      if (u.defaultPrevented || u.metaKey || u.ctrlKey || u.altKey || Fl(u.target) || jl(u.target))
        return;
      const f = u.key, g = $l(f);
      if (g) {
        if (g.mode) {
          if (n && g.mode !== "source")
            return;
          u.preventDefault(), r(g.mode);
          return;
        }
        if (g.action === "doc-dark") {
          if (!c || u.repeat) return;
          u.preventDefault(), c();
          return;
        }
        if (!(g.requiresPages && i <= 0))
          switch (u.preventDefault(), g.action) {
            case "zoom-in":
              a(_t(o, 1));
              return;
            case "zoom-out":
              a(_t(o, -1));
              return;
            case "zoom-reset":
              a(ht(t, ot()));
              return;
            case "next-page":
              l(Xt(s + 1, i));
              return;
            case "prev-page":
              l(Xt(s - 1, i));
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
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [
    d,
    t,
    n,
    r,
    o,
    a,
    s,
    i,
    l,
    c
  ]);
}
const Ul = "retainpdf:soft-reader-close";
function Wl() {
  return new URL("./index.html", window.location.href).href;
}
function Kl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Ul },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Vl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Jl() {
  if (!(typeof window > "u") && !Kl()) {
    if (Vl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Wl());
  }
}
function ql({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Gl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ _(ql, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Jl();
  }, children: [
    /* @__PURE__ */ p(wt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let Pr = !1;
function Zl() {
  if (Pr)
    return;
  const e = At().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (So.GlobalWorkerOptions.workerSrc = e, Pr = !0);
}
function ue(e) {
  return typeof e == "string" ? e : "";
}
function Yl(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Xl(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Ql(e) {
  return {
    source: ue(e == null ? void 0 : e.source_text) || ue(e == null ? void 0 : e.unit_source_text),
    translated: ue(e == null ? void 0 : e.protected_translated_text) || ue(e == null ? void 0 : e.translated_text)
  };
}
const ec = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Uo(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function tc(e) {
  const t = Uo(e).sort((r, o) => ue(r.ts).localeCompare(ue(o.ts)));
  return t.length ? [
    { text: ue(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ue(r.new_text),
      label: ec[ue(r.source)] || ue(r.source) || "修订",
      ts: ue(r.ts),
      reason: ue(r.reason)
    }))
  ].reverse() : [];
}
function nc(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function rc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ue(r.finished_at) || ue(n.finished_at) || "";
}
function oc(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Uo(e).sort((a, s) => ue(a.ts).localeCompare(ue(s.ts)));
  for (const a of o) {
    const s = new Date(ue(a.ts)).getTime(), i = ue(a.reader_item_id) || ue(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ue(a.new_text));
  }
  return n;
}
const ac = {
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
function sc(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = ac[ue(n.kind)] || ue(n.kind) || "问题", o = ue(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const ic = /* @__PURE__ */ new Set(["text", "formula"]);
function Hn(e) {
  return ic.has(e);
}
function lc(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || Hn(Ot(n));
}
function cc(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Hn(Ot(r)) || (n.add(o), t.push(o));
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
const mc = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function hc(e, t, n) {
  return e.flatMap((r) => {
    if (!mc.has(Ot(r.region))) return [];
    const o = xn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Tr(e, t, n) {
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
async function pc(e) {
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
const gc = "reader-text-hover-copy", bc = "reader-text-hover-edit", yc = "reader-text-hover-id";
function vc(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Wo = "reader-text-hover-tools";
function an({
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
const wc = 26, Sc = 220;
function Ic(e, t = Sc) {
  return e.height < wc * 2 || e.width < t;
}
function Rc({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? po : e === "failed" ? wt : Ka, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Pc({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a,
  tailTop: s = 0
}) {
  const [i, l] = k("idle"), [c, d] = k("idle"), [m] = k(() => vc()), u = N([]), f = (e == null ? void 0 : e.itemId) || "";
  if (D(() => {
    l("idle"), d("idle");
    const b = u.current;
    return () => {
      b.forEach((I) => window.clearTimeout(I)), u.current = [];
    };
  }, [f]), !e) return null;
  const g = Fa(e.highlight.region, t), h = Ot(e.highlight.region), v = (b, I) => async (P) => {
    P.preventDefault(), P.stopPropagation();
    const M = await pc(b);
    I(M ? "copied" : "failed"), u.current.push(window.setTimeout(() => I("idle"), 1200));
  }, S = h === "formula" ? "复制 LaTeX" : "复制", w = o || e.rect, y = a || (Ic(w) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": h,
      style: w,
      children: /* @__PURE__ */ _(
        "div",
        {
          className: Wo,
          "data-placement": y,
          style: y === "tail" ? { top: s } : void 0,
          children: [
            m ? /* @__PURE__ */ p(
              an,
              {
                className: yc,
                state: c,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: v(e.itemId, d),
                children: c === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && Hn(h) ? /* @__PURE__ */ p(
              an,
              {
                className: bc,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (b) => {
                  b.preventDefault(), b.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(On, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            g ? /* @__PURE__ */ p(
              an,
              {
                className: gc,
                state: i,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: i === "copied" ? "已复制" : i === "failed" ? "复制失败" : S,
                onClick: v(g, l),
                children: /* @__PURE__ */ p(Rc, { state: i })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Tc(e, t) {
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
function Ec(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = xn(
      Tc(e, a),
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
const kc = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Mc = 256, Pt = /* @__PURE__ */ new Map();
function Nc(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Ko(e) {
  const t = `${e || ""}`, { text: n, slots: r } = gs(t, { bareLatex: !0 }), o = Nc(n), a = bs(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Pt.get(t);
  if (!s && (s = ys(o, r), Pt.set(t, s), Pt.size > Mc)) {
    const i = Pt.keys().next().value;
    i !== void 0 && Pt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function sn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ue(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Ac(e, t) {
  const n = e.typography, r = Ue(t) || 1, o = Ue(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = sn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = Ue(n == null ? void 0 : n.fit_min_font_size_pt), d = Ue(n == null ? void 0 : n.fit_max_font_size_pt), m = Math.max(3.5, (c || 5.5) * r), u = Math.max(
    m,
    d ? d * r : o ? o * r : l
  ), f = o ? o * r : l, g = Ue(n == null ? void 0 : n.leading_em), h = [
    Ue(n == null ? void 0 : n.padding_top_pt) || 0,
    Ue(n == null ? void 0 : n.padding_right_pt) || 0,
    Ue(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ue(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((v) => v * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || kc,
    fontSizePx: Math.max(m, Math.min(u, f)),
    minFontSizePx: m,
    maxFontSizePx: u,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (sn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : sn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function _c(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (m) => {
    const u = s.get(m);
    if (u !== void 0) return u;
    const { width: f, height: g } = e(m), h = f <= t + 0.5 && g <= n + 0.5;
    return s.set(m, h), h;
  };
  let l = o, c = a, d = Math.min(r.requestedFontSizePx, c);
  if (i(d)) {
    if (!r.exact) {
      l = d;
      for (let m = 0; m < 6 && c > l; m += 1) {
        const u = (l + c) / 2;
        i(u) ? (d = u, l = u) : c = u;
      }
    }
  } else {
    c = d, d = l;
    for (let m = 0; m < 8 && c > l; m += 1) {
      const u = (l + c) / 2;
      i(u) ? (d = u, l = u) : c = u;
    }
  }
  return Math.max(o, d);
}
const Lc = 512, Tt = /* @__PURE__ */ new Map();
let Tn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Tn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Tn += 1;
}));
function Dc(e, t, n, r) {
  return [
    Tn,
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
function Vo({ item: e, pageScale: t }) {
  const n = N(null), r = q(
    () => Ko(e.translatedText),
    [e.translatedText]
  ), [o, a] = k(r.fallbackHtml), s = q(
    () => Ac(e, t),
    [e, t]
  );
  D(() => {
    let m = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((u) => {
      m && a(u);
    }), () => {
      m = !1;
    };
  }, [r]), Te(() => {
    const m = n.current;
    if (!m) return;
    const [u, f, g, h] = s.padding, v = Math.max(1, e.rect.width - h - f), S = Math.max(1, e.rect.height - u - g), w = Dc(o, v, S, s);
    let y = Tt.get(w);
    if (y === void 0 && (y = _c(
      (b) => (m.style.fontSize = `${b}px`, { width: m.scrollWidth, height: m.scrollHeight }),
      v,
      S,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Tt.set(w, y), Tt.size > Lc)) {
      const b = Tt.keys().next().value;
      b !== void 0 && Tt.delete(b);
    }
    m.style.fontSize = `${y.toFixed(2)}px`;
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
function Cc({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = q(
    () => Ec(e, t, n, r),
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
        Vo,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const xc = en(Cc);
function Oc({
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
        Vo,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Ot(a.highlight.region),
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
const zc = en(Oc), Jo = 24, qe = Jo * 2 + 4, We = 24, $c = 4, Fc = 6, at = (e) => e.left + e.width, Xe = (e) => e.top + e.height;
function Et(e, t) {
  const n = Math.min(at(e), at(t)) - Math.max(e.left, t.left), r = Math.min(Xe(e), Xe(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Er = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= at(t) && r >= t.top && r <= Xe(t);
}, Bc = (e) => e.height > 40 && e.height > e.width * 2.5;
function jc(e, t, n) {
  if (!t.length || e.height < We || e.width < n + 8) return null;
  const r = Math.max(...t.map(Xe)), o = at(e) - 4 - n;
  for (const a of [r, Xe(e) - 2]) {
    const s = Math.max(e.top, a - We), i = { left: o, top: s, width: n, height: We };
    if (!t.some((l) => Et(i, l) > 0)) return s - e.top;
  }
  return null;
}
function Hc(e, t) {
  const n = [], r = (a) => {
    const s = Jo + $c, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: at(e), top: i, width: s, height: qe } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: qe } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - We - 3, width: qe, height: We + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: Xe(e), width: qe, height: We + 3 } }), r(!0);
  const o = jc(e, t, qe);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: at(e) - 4 - qe, top: e.top + o, width: qe, height: We } }), n;
}
function Uc(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((w) => w.width > 0 && w.height > 0 && !Bc(w)), i = s.filter((w) => Er(w, t)), l = s.filter((w) => !Er(w, t)), c = n.filter((w) => w !== t && Et(w, t) < t.width * t.height * 0.5), d = Hc(t, i).filter(({ box: w, overhang: y }) => {
    const b = y ? Fc : 0;
    return w.left >= -b && at(w) <= r + b && w.top >= 0 && Xe(w) <= o;
  }), m = ({ placement: w, tailTop: y }) => y === void 0 ? { placement: w } : { placement: w, tailTop: y }, u = ({ box: w }) => !l.some((y) => Et(w, y) > 0), f = d.filter((w) => w.placement !== "tail"), g = f.find((w) => u(w) && !c.some((y) => Et(w.box, y) > 0));
  if (g) return m(g);
  const h = f.find(u) || d.find((w) => w.placement === "tail" && u(w));
  if (h) return m(h);
  let v = null, S = Number.POSITIVE_INFINITY;
  for (const w of d) {
    const y = l.reduce((b, I) => b + Et(w.box, I), 0);
    y < S && (v = w, S = y);
  }
  return v ? m(v) : { placement: "outside" };
}
function Wc(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - We - 3 : Xe(r);
  return t >= r.left - 4 && t <= r.left + qe + 4 && n >= a && n <= a + We + 3;
}
const ln = (e) => e.left + e.width, cn = (e) => e.top + e.height;
function Kc(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const d = c.left + c.width / 2, m = c.top + c.height / 2;
    d < e.left || d > ln(e) || m < e.top || m > cn(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, ln(c)), i = Math.max(i, cn(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(ln(e) + r, s + n) - l.left, l.height = Math.min(cn(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function Vc(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Jc(e, t, n, r) {
  const [o, a] = k(null);
  return Te(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Vc(s) : [], l = i.length ? Kc(t.rect, i) : t.rect, c = n.filter((m) => m.itemId !== t.itemId).map((m) => m.rect), d = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Uc({ frame: l, others: c, pageWidth: r, pageHeight: d, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const qo = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], kr = { pen: 35e-4, highlighter: 0.018 }, Mr = 0.015, En = "retainpdf.reader.ink.v1:";
function Nr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(En + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function qc(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(En + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(En + e);
    } catch {
    }
}
function Gc(e, t, n, r, o, a) {
  const s = Mr * Mr;
  return e.filter((i) => Go(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Go(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Zc(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Yc(e) {
  const [t, n] = k(null), [r, o] = k(qo[0].key), [a, s] = k(() => Nr(e)), i = N(a), l = N([]);
  D(() => {
    const h = Nr(e);
    i.current = h, s(h), l.current = [];
  }, [e]);
  const c = x((h) => {
    i.current = h, s(h), qc(e, h);
  }, [e]), d = x((h) => {
    const v = i.current, S = h(v);
    S !== v && (l.current = [...l.current.slice(-49), v], c(S));
  }, [c]), m = x((h) => {
    h.points.length < 1 || d((v) => [...v, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [d]), u = x((h) => {
    h.length && d((v) => v.filter((S) => !h.includes(S.id)));
  }, [d]), f = x((h) => {
    d((v) => v.some((S) => S.page === h) ? v.filter((S) => S.page !== h) : v);
  }, [d]), g = x(() => {
    const h = l.current.pop();
    h && c(h);
  }, [c]);
  return q(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: m, erase: u, undo: g, clearPage: f }),
    [t, r, a, m, u, g, f]
  );
}
const Xc = "reader-ink-layer";
function Qc(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Ar({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Qc(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function ed({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = k(null), i = N(!1), l = o.strokes.filter((h) => Go(h, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const d = (h) => {
    const v = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - v.left) / Math.max(1, v.width))),
      Math.min(1, Math.max(0, (h.clientY - v.top) / Math.max(1, v.height)))
    ];
  }, m = (h, v) => o.erase(Gc(o.strokes, e, t, h, v, r / Math.max(1, n))), u = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [v, S] = d(h);
    o.tool === "eraser" ? m(v, S) : s([[v, S]]);
  }, f = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [v, S] = d(h);
    o.tool === "eraser" ? m(v, S) : s((w) => w ? Zc(w, v, S) : [[v, S]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: kr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ _(
    "svg",
    {
      className: Xc,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: u,
      onPointerMove: f,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        l.map((h) => /* @__PURE__ */ p(Ar, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Ar, { stroke: { tool: o.tool, color: o.color, width: kr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const _r = 12, td = 4, nd = 12;
function rd(e, t) {
  const n = /* @__PURE__ */ new Map();
  return e.map((r) => {
    const o = r.itemId ? t.find((l) => l.itemId === r.itemId) : void 0, a = o ? o.rect.top + Math.min(o.rect.height, 24) / 2 - _r / 2 : nd, s = `${o ? r.itemId : "page-top"}`, i = n.get(s) ?? 0;
    return n.set(s, i + 1), Math.round(a + i * (_r + td));
  });
}
function od({
  markers: e,
  targets: t,
  onSelect: n
}) {
  if (!e.length) return null;
  const r = rd(e, t);
  return /* @__PURE__ */ p("div", { className: "reader-margin-markers", children: e.map((o, a) => /* @__PURE__ */ p(
    Q,
    {
      className: `reader-margin-marker is-${o.tone}${o.hollow ? " is-hollow" : ""}`,
      style: { top: r[a] },
      title: o.label,
      "aria-label": o.label,
      "data-reader-margin-marker": o.key,
      onClick: (s) => {
        s.stopPropagation(), n == null || n(o.key);
      }
    },
    o.key
  )) });
}
function ad({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = k(null), [i, l] = k(!1), [c, d] = k([]), [m, u] = k(""), [f, g] = k(""), [h, v] = k(!1), [S, w] = k(null), [y, b] = k([]), I = r.drafts, P = r.generation, M = x(async (R, T) => {
    if (e)
      try {
        d(tc(await e.fetchRevisions(R, T)));
      } catch {
        d([]);
      }
  }, [e]);
  D(() => {
    if (s(null), d([]), w(null), b([]), g(""), !e || !t || !n) return;
    let R = !1;
    return l(!0), e.loadItem(t, n).then((T) => {
      if (R) return;
      const E = T == null ? void 0 : T.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const A = `${(T == null ? void 0 : T.item_id) || n}`, { source: L, translated: j } = Ql(E);
      s({ readerItemId: n, itemId: A, source: L, current: j }), u(I.get(n) ?? j);
    }).catch((T) => {
      R || w({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      R || l(!1);
    }), M(t, n), () => {
      R = !0;
    };
  }, [e, t, n, M]);
  const z = x((R) => {
    u(R), n && I.set(n, R);
  }, [n, I]), $ = x(async (R, T) => {
    if (!e || !a || h) return !1;
    const E = R ?? m;
    if (!E.trim()) return !1;
    v(!0), w(null), b([]);
    try {
      const A = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (T ?? f).trim() || "在阅读页手动修改",
        ...P.current != null ? { expected_generation: P.current } : {}
      }), L = Number(A == null ? void 0 : A.generation);
      return Number.isFinite(L) && (P.current = L), I.delete(a.readerItemId), s({ ...a, current: E }), u(E), g(""), (A == null ? void 0 : A.changed) === !1 ? w({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), w({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), M(t, a.readerItemId), !0;
    } catch (A) {
      const L = A;
      return (L == null ? void 0 : L.reason) === "generation_mismatch" && (P.current = null), w({ tone: "error", message: (L == null ? void 0 : L.message) || "保存失败，请稍后再试。" }), b(sc(L == null ? void 0 : L.issues)), !1;
    } finally {
      v(!1);
    }
  }, [e, a, h, m, f, t, o, M, I, P]), F = x(() => {
    n && I.delete(n);
  }, [n, I]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: m,
    setDraft: z,
    reason: f,
    setReason: g,
    saving: h,
    status: S,
    issues: y,
    save: $,
    discardDraft: F
  };
}
const Zo = "reader-inline-edit";
function sd({ text: e }) {
  const [t, n] = k("");
  return D(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Ko(e);
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
function id({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var F;
  const s = e.itemId, i = ad({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = k(!1), [d, m] = k(!1), u = N(null), f = fc(e.rect, t), g = q(() => cc(o), [o]), h = g.indexOf(s), { loaded: v } = i, S = i.saving || i.loading, w = n.blockedReason, y = !v || i.draft === v.current, { close: b, select: I } = n, P = x((R) => {
    const T = g[h + R];
    T && (I(T), a == null || a(T));
  }, [g, h, I, a]), M = x(() => {
    i.discardDraft(), b();
  }, [i, b]), z = x(async (R, T) => {
    await i.save(R, T) && b();
  }, [i, b]);
  D(() => {
    const R = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), P(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", R), () => window.removeEventListener("keydown", R);
  }, [P]), Te(() => {
    const R = u.current;
    if (!R) return;
    R.style.height = "auto";
    const T = f.mode === "inline" ? f.minHeight : 0;
    R.style.height = `${Math.max(T, R.scrollHeight + 2)}px`;
  }, [i.draft, v, f.mode, f.mode === "inline" ? f.minHeight : 0]);
  const $ = f.mode === "inline" ? { left: f.left, top: f.top, width: f.width } : { left: f.left, width: f.width, top: f.top, bottom: f.bottom };
  return /* @__PURE__ */ _(ct, { children: [
    f.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ _(
      "div",
      {
        className: `${Zo} is-${f.mode}`,
        style: $,
        role: "group",
        "aria-label": `改第 ${((F = n.target) == null ? void 0 : F.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": f.mode,
        onPointerDown: (R) => R.stopPropagation(),
        children: [
          r && (v != null && v.source) ? /* @__PURE__ */ p(
            Q,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((R) => !R),
              children: v.source
            }
          ) : null,
          w ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: w }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          v ? /* @__PURE__ */ p(
            ms,
            {
              ref: u,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: S || !!w,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (R) => i.setDraft(R.target.value),
              onKeyDown: (R) => {
                R.key === "Enter" && (R.metaKey || R.ctrlKey) ? (R.preventDefault(), y || z()) : R.key === "Escape" && (R.preventDefault(), M());
              }
            }
          ) : null,
          v ? /* @__PURE__ */ p(sd, { text: i.draft }) : null,
          /* @__PURE__ */ _("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(dr, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => P(-1), children: /* @__PURE__ */ p(Va, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(dr, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => P(1), children: /* @__PURE__ */ p(go, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              wo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: S || !!w || !v,
                onChange: (R) => i.setReason(R.target.value),
                onKeyDown: (R) => {
                  R.key === "Enter" ? (R.preventDefault(), y || z()) : R.key === "Escape" && (R.preventDefault(), M());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ _(
              Q,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": d,
                "data-block-edit-action": "history",
                onClick: () => m((R) => !R),
                children: [
                  /* @__PURE__ */ p(Ja, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(Q, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: M, children: "取消" }),
            /* @__PURE__ */ p(
              Q,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: S || !!w || y || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  z();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((R) => /* @__PURE__ */ p("li", { children: R }, R)) }) : null,
          d && v && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((R, T) => {
            const E = R.text === v.current, A = [nc(R.ts), R.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ _("li", { "data-block-edit-history": R.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ _("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ _("span", { children: [
                  A,
                  E ? "（现在用的）" : "",
                  R.reason ? ` · ${R.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  Q,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: S || !!w,
                    onClick: () => {
                      z(R.text, `回到「${A.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: R.text })
            ] }, `${R.ts}:${T}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Yo = Ln(null), Xo = Ln(null);
function ld({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Yo.Provider, { value: e, children: /* @__PURE__ */ p(Xo.Provider, { value: t, children: n }) });
}
function Je() {
  return Dn(Yo);
}
function Qo() {
  return Dn(Xo);
}
const Ze = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), cd = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, dd = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, ud = {
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
}, Lr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function fd(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Lr(o ?? a ?? "", cd)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Lr(o ?? a ?? "", dd)).replace(/\\([a-zA-Z]+)/gu, (r, o) => ud[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function md(e) {
  return Ze(e.translatedBlockText) || Ze(e.translated.text) || Ze(e.source.text);
}
const hd = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function pd(e) {
  const t = [];
  for (const n of e) {
    if (!hd(n)) continue;
    const r = fd(md(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function gd(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const bd = 24, yd = 60;
function Dr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - bd), o = Math.min(e.length, n + t.length + yd), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function vd(e, t, n = 200) {
  const r = Ze(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Ze(a.translatedBlockText) || Ze(a.translated.text), l = i ? Dr(i, r) : null, c = l ?? Dr(Ze(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function Bt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function wd(e, t) {
  const n = Ze(t).toLowerCase();
  if (!n || !e) return Bt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Bt(e.slice(a, s))}<mark class="reader-find-mark">${Bt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Bt(e.slice(a));
}
function Sd(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const ea = 1.414;
function Id({
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
  regionHighlight: m = null,
  regionTargets: u = [],
  hoveredRegionId: f,
  onHoverRegion: g,
  liveTranslationLayout: h,
  liveTranslationPage: v,
  showLiveTranslation: S = r === "source",
  liveTranslationMissing: w = !1
}) {
  var Ee, te, me, ge;
  const y = Je(), b = y == null ? void 0 : y.revisedBlocks, I = y == null ? void 0 : y.blockEdit, P = I == null ? void 0 : I.pendingEdits, M = y == null ? void 0 : y.editBlock, z = (y == null ? void 0 : y.findTerm) || "", $ = q(
    () => z ? ({ str: O }) => wd(O, z) : void 0,
    [z]
  ), F = N(l ?? ea), [R, T] = k(F.current);
  D(() => {
    l != null && Math.abs(l - F.current) >= 1e-3 && (F.current = l, T(l));
  }, [l]);
  const E = N(d);
  E.current = d;
  const A = N(null), L = N((O) => {
    var Y;
    A.current = O, (Y = E.current) == null || Y.call(E, O);
  }).current, j = N(null), B = N(`${t}@${n}`);
  Te(() => {
    const O = `${t}@${n}`;
    B.current !== O && (B.current = O, o && Pd(A.current, j.current));
  }, [o, n, t]), D(() => {
    o || dn(j.current);
  }, [o]), D(() => () => dn(j.current), []);
  const W = Math.max(120, Math.floor(t * R)), ee = Math.max(W, Math.ceil(s || 0)), oe = xn(m, t, W), J = q(
    () => hc(u, t, W),
    [W, u, t]
  ), [le, ce] = k(null), de = typeof g == "function", xe = de ? f ?? null : le, G = (O) => {
    de ? O !== (f ?? null) && (g == null || g(O)) : ce((Y) => Y === O ? Y : O);
  }, X = q(
    () => J.find((O) => O.itemId === xe) || null,
    [xe, J]
  ), Re = r === "translated" && ((Ee = I == null ? void 0 : I.target) == null ? void 0 : Ee.itemId) || "", fe = q(
    () => Re && J.find((O) => O.itemId === Re) || null,
    [Re, J]
  ), he = Jc(A, o ? X : null, J, t), et = (O) => {
    var Le, De, Fe, we, Pe;
    if (O.pointerType === "touch") return;
    if ((Le = y == null ? void 0 : y.ink) != null && Le.tool) {
      G(null);
      return;
    }
    if (O.buttons !== 0) {
      G(null);
      return;
    }
    if ((Fe = (De = O.target) == null ? void 0 : De.closest) != null && Fe.call(De, `.${Wo}`) || (Pe = (we = O.target) == null ? void 0 : we.closest) != null && Pe.call(we, `.${Zo}`)) return;
    const Y = O.currentTarget.getBoundingClientRect(), ne = O.clientX - Y.left, _e = O.clientY - Y.top;
    if (Wc(he, ne, _e)) return;
    const be = Tr(J, ne, _e);
    G((be == null ? void 0 : be.itemId) || null);
  }, Ae = (O) => {
    if (O.pointerType === "mouse") return;
    const Y = O.currentTarget.getBoundingClientRect(), ne = Tr(
      J,
      O.clientX - Y.left,
      O.clientY - Y.top
    );
    G((ne == null ? void 0 : ne.itemId) || null);
  }, pe = (O) => {
    !Number.isFinite(O) || O <= 0 || Math.abs(F.current - O) < 1e-3 || (F.current = O, T(O), c == null || c(e, O));
  };
  return /* @__PURE__ */ _(
    "div",
    {
      ref: L,
      [Me]: e,
      [Ie]: r,
      [zn]: W,
      className: $n,
      onPointerMoveCapture: et,
      onPointerDown: Ae,
      onPointerLeave: (O) => {
        O.pointerType === "mouse" && G(null);
      },
      style: {
        width: t,
        height: ee,
        minHeight: ee
      },
      children: [
        o ? /* @__PURE__ */ p(
          hs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: $,
            renderAnnotationLayer: !1,
            className: Eo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: qt,
                style: { width: t, height: W }
              }
            ),
            onLoadSuccess: (O) => {
              try {
                const Y = O.getViewport({ scale: 1 });
                if (Y.width > 0) {
                  const ne = Y.height / Y.width;
                  pe(ne);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              dn(j.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: qt,
            style: { width: t, height: W },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: j, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        oe ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": m == null ? void 0 : m.itemId,
            style: oe,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && S ? /* @__PURE__ */ p(
          xc,
          {
            layoutPage: h,
            pageState: v,
            width: t,
            height: W
          }
        ) : null,
        o && S && w ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ p(zc, { targets: J, edits: P, width: t, excludeId: fe == null ? void 0 : fe.itemId }) : null,
        o && fe && I ? /* @__PURE__ */ p(
          id,
          {
            target: fe,
            page: { width: t, height: W },
            edit: I,
            showSource: !!(y != null && y.editShowsSource),
            regions: y == null ? void 0 : y.regions,
            jumpToBlock: y == null ? void 0 : y.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (b != null && b.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: J.filter((O) => b.has(O.itemId)).map((O) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": O.itemId,
            style: { left: O.rect.left, top: O.rect.top, height: O.rect.height }
          },
          O.itemId
        )) }) : null,
        o && ((me = (te = y == null ? void 0 : y.marginMarkers) == null ? void 0 : te.get(e)) != null && me.length) ? /* @__PURE__ */ p(
          od,
          {
            markers: y.marginMarkers.get(e) ?? [],
            targets: J,
            onSelect: y.selectMarginMarker
          }
        ) : null,
        o && (y != null && y.ink) ? /* @__PURE__ */ p(
          ed,
          {
            page: e,
            pane: r === "translated" ? "translated" : y.compareVersion ? "compare" : "source",
            width: t,
            height: W,
            ink: y.ink
          }
        ) : null,
        /* @__PURE__ */ p(
          Pc,
          {
            target: o && !((ge = y == null ? void 0 : y.ink) != null && ge.tool) && (X == null ? void 0 : X.itemId) !== (fe == null ? void 0 : fe.itemId) ? X : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: X && (b == null ? void 0 : b.get(X.itemId)) || 0,
            onEdit: M,
            frameRect: he == null ? void 0 : he.rect,
            placement: he == null ? void 0 : he.placement,
            tailTop: he == null ? void 0 : he.tailTop
          }
        )
      ]
    }
  );
}
const Rd = en(Id);
function Pd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function dn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Td = 2 * 1024 * 1024;
function Ed(e) {
  const t = new So.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const un = 5, kd = "120% 0px", Md = 120, Nd = "25% 0px";
let Cr = 1;
const xr = /* @__PURE__ */ new WeakMap();
function Ad(e) {
  if (!e) return 0;
  const t = xr.get(e);
  if (t) return t;
  const n = Cr;
  return Cr += 1, xr.set(e, n), n;
}
function _d() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Ld = co(
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
    onLoadSuccess: m,
    onLoadError: u,
    onNumPagesChange: f,
    activeRegion: g = null,
    regions: h = [],
    readerMetadata: v = null,
    hoveredRegionId: S = null,
    onHoverRegion: w,
    liveTranslation: y,
    showLiveTranslation: b = t === "source",
    liveTranslationPendingLabel: I = "",
    paneAction: P
  }, M) {
    Zl();
    const { file: z, loading: $, error: F } = Qs(n, r), R = `${n}\0${Ad(z)}`, T = N(R);
    T.current = R;
    const E = q(() => {
      const C = Js(z);
      return C ? "ranged" in C ? { range: Ed(C.ranged) } : C : null;
    }, [z, n]), [A, L] = k(0), [j, B] = k(""), [W, ee] = k(null), [oe, J] = k(480), le = N(null), ce = N(0), de = q(() => _d(), []), xe = q(() => ({
      cMapUrl: At().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: At().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Td,
      disableAutoFetch: !0
    }), []);
    Cn(M, () => W, [W]), D(() => {
      const C = (K) => {
        ce.current = K, J(K);
      }, V = (K) => {
        const ae = Si(K, ce.current);
        if (ae !== "ignore") {
          if (le.current && clearTimeout(le.current), ae === "immediate") {
            C(K);
            return;
          }
          le.current = setTimeout(() => C(K), _o);
        }
      }, U = !!(l && l >= 80);
      V(U ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const ie = !U && i && typeof ResizeObserver < "u" ? new ResizeObserver((K) => {
        var ae, ye;
        V(((ye = (ae = K[0]) == null ? void 0 : ae.contentRect) == null ? void 0 : ye.width) ?? i.clientWidth);
      }) : null;
      return ie && i && ie.observe(i), () => {
        ie == null || ie.disconnect(), le.current && clearTimeout(le.current);
      };
    }, [l, i, a]);
    const G = q(
      () => yi(oe, o),
      [oe, o]
    ), [X, Re] = k(() => /* @__PURE__ */ new Map()), [fe, he] = k(() => /* @__PURE__ */ new Set()), [et, Ae] = k(() => /* @__PURE__ */ new Set()), pe = N(/* @__PURE__ */ new Map()), Ee = N(null), te = N(null), [me, ge] = k(() => /* @__PURE__ */ new Set()), O = N(/* @__PURE__ */ new Map()), Y = x((C, V) => {
      Re((U) => {
        if (U.get(C) === V) return U;
        const Z = new Map(U);
        return Z.set(C, V), Z;
      });
    }, []), ne = x((C, V) => {
      const U = pe.current, Z = U.get(C), ie = [Ee.current, te.current];
      if (Z)
        for (const K of ie)
          try {
            K == null || K.unobserve(Z);
          } catch {
          }
      if (V) {
        U.set(C, V);
        for (const K of ie)
          try {
            K == null || K.observe(V);
          } catch {
          }
      } else
        U.delete(C);
    }, []), _e = N(/* @__PURE__ */ new Map()), be = x((C) => {
      const V = _e.current;
      let U = V.get(C);
      return U || (U = (Z) => ne(C, Z), V.set(C, U)), U;
    }, [ne]);
    D(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = O.current, V = new IntersectionObserver(
        (U) => {
          const Z = [], ie = [];
          for (const K of U) {
            const ae = K.target, ye = Zt(ae);
            Number.isFinite(ye) && (K.isIntersecting ? Z : ie).push(ye);
          }
          if ((Z.length || ie.length) && he((K) => {
            let ae = null;
            for (const ye of Z)
              K.has(ye) || (ae = ae || new Set(K), ae.add(ye));
            for (const ye of ie)
              K.has(ye) && (ae = ae || new Set(K), ae.delete(ye));
            return ae || K;
          }), Z.length) {
            for (const K of Z) {
              const ae = C.get(K);
              ae && (clearTimeout(ae), C.delete(K));
            }
            Ae((K) => {
              let ae = null;
              for (const ye of Z)
                K.has(ye) || (ae = ae || new Set(K), ae.add(ye));
              return ae || K;
            });
          }
          for (const K of ie)
            C.has(K) || C.set(K, setTimeout(() => {
              C.delete(K), Ae((ae) => {
                if (!ae.has(K)) return ae;
                const ye = new Set(ae);
                return ye.delete(K), ye;
              });
            }, Md));
        },
        { root: i, rootMargin: kd, threshold: 0 }
      );
      Ee.current = V;
      for (const U of pe.current.values())
        try {
          V.observe(U);
        } catch {
        }
      return () => {
        V.disconnect(), Ee.current === V && (Ee.current = null);
        for (const U of C.values()) clearTimeout(U);
        C.clear();
      };
    }, [i]), D(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = new IntersectionObserver(
        (V) => {
          ge((U) => {
            let Z = null;
            for (const ie of V) {
              const K = Zt(ie.target);
              !Number.isFinite(K) || ie.isIntersecting === U.has(K) || (Z = Z || new Set(U), ie.isIntersecting ? Z.add(K) : Z.delete(K));
            }
            return Z || U;
          });
        },
        { root: i, rootMargin: Nd, threshold: 0 }
      );
      te.current = C;
      for (const V of pe.current.values())
        try {
          C.observe(V);
        } catch {
        }
      return () => {
        C.disconnect(), te.current === C && (te.current = null);
      };
    }, [i]);
    const Le = !!i && typeof IntersectionObserver < "u";
    Te(() => {
      L(0), B(""), he(/* @__PURE__ */ new Set()), Ae(/* @__PURE__ */ new Set()), Re(/* @__PURE__ */ new Map()), pe.current.clear();
      const C = O.current;
      for (const V of C.values()) clearTimeout(V);
      C.clear(), f == null || f(0, t);
    }, [R, f, t]);
    const De = x(
      ({ numPages: C }) => {
        T.current === R && (L(C), B(""), f == null || f(C, t), m == null || m({ numPages: C, pane: t }));
      },
      [R, m, f, t]
    ), Fe = x(
      (C) => {
        if (T.current !== R) return;
        const V = (C == null ? void 0 : C.message) || "PDF 解析失败";
        B(V), L(0), f == null || f(0, t), u == null || u(C, t);
      },
      [R, u, f, t]
    ), we = q(
      () => A > 0 ? Array.from({ length: A }, (C, V) => V + 1) : [],
      [A]
    );
    D(() => {
      typeof IntersectionObserver < "u" || Ae(new Set(we));
    }, [we]);
    const Pe = q(
      () => cr(g, v, t),
      [g, v, t]
    ), Be = q(() => {
      const C = /* @__PURE__ */ new Map();
      for (const V of h) {
        const U = cr(V, v, t);
        if (!U) continue;
        const Z = C.get(U.box.page) || [];
        Z.push(U), C.set(U.box.page, Z);
      }
      return C;
    }, [t, v, h]), tt = q(() => {
      const C = /* @__PURE__ */ new Set();
      if (!S) return C;
      for (const [V, U] of Be)
        U.some((Z) => Z.itemId === S) && C.add(V);
      return C;
    }, [S, Be]), nt = q(() => {
      if (A === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(we);
      if (fe.size === 0) {
        const U = Math.min(A, un * 2 + 1);
        return new Set(Array.from({ length: U }, (Z, ie) => ie + 1));
      }
      const V = /* @__PURE__ */ new Set();
      for (const U of fe)
        for (let Z = -un; Z <= un; Z++) {
          const ie = U + Z;
          ie >= 1 && ie <= A && V.add(ie);
        }
      return V;
    }, [A, we, i, a, fe]), H = !n || !!F || !!j, se = n && (F || j) || s;
    return /* @__PURE__ */ _(
      "section",
      {
        ref: ee,
        className: `reader-panel ${tn}${a ? "" : " is-hidden"}`,
        [Ie]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (y == null ? void 0 : y.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          P ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: P }) : null,
          I ? /* @__PURE__ */ _("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: I })
          ] }) : null,
          H && !$ ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: se }) : null,
          $ ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          E && !F ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            ps,
            {
              file: E,
              loading: null,
              error: null,
              options: xe,
              onLoadSuccess: De,
              onLoadError: Fe,
              className: "reader-react-pdf-document",
              children: we.map((C) => {
                if (nt.has(C))
                  return /* @__PURE__ */ p(
                    Rd,
                    {
                      pane: t,
                      pageNumber: C,
                      width: G,
                      devicePixelRatio: de,
                      active: et.has(C),
                      textLayer: !Le || me.has(C),
                      syncedMinHeight: (c == null ? void 0 : c.get(C)) || 0,
                      onMetrics: d,
                      cachedAspect: X.get(C),
                      onAspectChange: Y,
                      sentinelRef: be(C),
                      regionHighlight: (Pe == null ? void 0 : Pe.box.page) === C ? Pe : null,
                      regionTargets: Be.get(C),
                      hoveredRegionId: S && tt.has(C) ? S : null,
                      onHoverRegion: w,
                      liveTranslationLayout: y == null ? void 0 : y.layoutByPage.get(C - 1),
                      liveTranslationPage: y == null ? void 0 : y.pagesByPage.get(C - 1),
                      showLiveTranslation: b,
                      liveTranslationMissing: Pl(y, C - 1)
                    },
                    `${t}-${C}`
                  );
                const U = X.get(C) ?? ea, Z = Math.max(120, Math.floor(G * U)), ie = Math.max(Z, Math.ceil((c == null ? void 0 : c.get(C)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: be(C),
                    [Me]: C,
                    [Ie]: t,
                    [zn]: Z,
                    className: `${$n} is-placeholder`,
                    style: {
                      width: G,
                      height: ie,
                      minHeight: ie
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: qt,
                        style: { width: G, height: Z },
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
), Or = en(Ld), Dd = 2e3, Cd = 6, xd = 500, zr = "reader-react-resizing";
function Od(e, t) {
  const n = N(null), r = N(null);
  Te(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const b = zd(e), I = Wt(e, b);
      if (!I) return;
      s = { pane: b, progress: I, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let d = 0, m = null, u = e.scrollHeight, f = u, g = 0, h = c;
    const v = /* @__PURE__ */ new WeakMap(), S = typeof ResizeObserver > "u" ? null : new ResizeObserver((b) => {
      let I = !1;
      for (const P of b) {
        const M = Math.round(P.contentRect.height);
        v.has(P.target) && v.get(P.target) !== M && (I = !0), v.set(P.target, M);
      }
      I && Lt(e, l, "auto", i);
    }), w = () => {
      var b;
      m && clearTimeout(m), cancelAnimationFrame(d), S == null || S.disconnect(), e.classList.remove(zr);
      for (const I of $r) e.removeEventListener(I, w);
      ((b = r.current) == null ? void 0 : b.stop) === w && (r.current = null);
    }, y = () => {
      Lt(e, l, "auto", i);
      const b = e.scrollHeight;
      g = b === f ? g + 1 : 0, f = b;
      const I = performance.now() - h;
      g >= Cd && (b !== u || I > xd) || I > Dd ? w() : d = requestAnimationFrame(y);
    };
    for (const b of $r) e.addEventListener(b, w, { passive: !0 });
    for (const b of Array.from(e.children)) S == null || S.observe(b);
    e.classList.add(zr), r.current = { ...s, stop: w }, m = setTimeout(() => {
      m = null, h = performance.now(), u = e.scrollHeight, f = u, g = 0, d = requestAnimationFrame(y);
    }, _o);
  }, [e, t]), D(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function zd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Me}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ie) || null;
  }
  return null;
}
const $r = ["wheel", "touchstart", "keydown", "pointerdown"];
function $d(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Fd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(tn)) && ((n = e.hasAttribute) != null && n.call(e, Ie)));
}
function Bd(e, t) {
  D(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Fd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${tn}[${Ie}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const l = $d(a, i);
        if (l === null || Math.abs(i.scrollLeft - l) < 1) continue;
        const c = i.scrollLeft;
        i.scrollLeft = l, Math.abs(i.scrollLeft - c) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function jd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), l = t - i, c = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: l * c };
}
function Hd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Fr = 12;
function Un(e) {
  return Array.from(e.querySelectorAll(`.${tn}[${Ie}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Ud(e) {
  const t = e.getBoundingClientRect();
  return Un(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(Ie) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function Wd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Kd(e, t) {
  return e ? Un(e).find((n) => n.getAttribute(Ie) === t) ?? null : null;
}
function Vd({ shellEl: e }) {
  const [t, n] = k([]), r = N(0), o = x(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Ud(e);
      n((i) => Wd(i, s) ? i : s);
    }));
  }, [e]);
  D(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, l = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const m of Un(e))
          i.observe(m), m.firstElementChild && i.observe(m.firstElementChild);
      }
    };
    l();
    const c = s && typeof s.MutationObserver < "u" ? new s.MutationObserver(() => {
      l(), o();
    }) : null, d = e.firstElementChild;
    return c && d && c.observe(d, { childList: !0, attributes: !0, attributeFilter: ["class"], subtree: !1 }), () => {
      e.removeEventListener("scroll", o, { capture: !0 }), i == null || i.disconnect(), c == null || c.disconnect(), r.current && cancelAnimationFrame(r.current), r.current = 0;
    };
  }, [e, o]);
  const a = t.filter((s) => s.scrollWidth - s.width > 1);
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Jd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Jd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Fr * 2), r = jd(e, n), o = N(null);
  if (!r) return null;
  const a = (u) => {
    const f = Kd(t, e.pane);
    f && (f.scrollLeft = u);
  }, s = (u) => {
    var f, g;
    u.button === 0 && (u.preventDefault(), u.stopPropagation(), (g = (f = u.currentTarget).setPointerCapture) == null || g.call(f, u.pointerId), o.current = { startX: u.clientX, startScroll: e.scrollLeft, pointerId: u.pointerId });
  }, i = (u) => {
    const f = o.current;
    !f || f.pointerId !== u.pointerId || a(f.startScroll + Hd(e, n, r.size, u.clientX - f.startX));
  }, l = (u) => {
    var f, g, h;
    ((f = o.current) == null ? void 0 : f.pointerId) === u.pointerId && (o.current = null, (h = (g = u.currentTarget).releasePointerCapture) == null || h.call(g, u.pointerId));
  }, c = (u) => {
    if (u.button !== 0 || u.target !== u.currentTarget) return;
    u.preventDefault();
    const f = u.currentTarget.getBoundingClientRect(), g = u.clientX - f.left, h = e.width * 0.8;
    a(e.scrollLeft + (g < r.offset ? -h : h));
  }, d = e.pane === "translated" ? "译文栏左右滚动" : "原文栏左右滚动", m = Math.max(0, e.scrollWidth - e.width);
  return /* @__PURE__ */ p(
    "div",
    {
      className: "reader-pane-scrollbar",
      "data-reader-pane-scrollbar": e.pane,
      role: "scrollbar",
      "aria-label": d,
      "aria-orientation": "horizontal",
      "aria-valuemin": 0,
      "aria-valuemax": Math.round(m),
      "aria-valuenow": Math.round(e.scrollLeft),
      style: { left: e.left + Fr, width: n },
      onPointerDown: c,
      children: /* @__PURE__ */ p(
        "div",
        {
          className: "reader-pane-scrollbar-thumb",
          style: { width: r.size, transform: `translateX(${r.offset}px)` },
          onPointerDown: s,
          onPointerMove: i,
          onPointerUp: l,
          onPointerCancel: l
        }
      )
    }
  );
}
function ta(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function qd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Gd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ _("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
        Q,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: ta(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(po, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(qa, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ _("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ _(
        Q,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Ga, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ _(
        Q,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Za, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Br({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = qd(t), a = [e === "compare" ? "对比" : "正在读", r, ta(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ _("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Zd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = k({ source: null, translated: null });
  return Te(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const d = e.querySelector(`[${Ie}="${c}"]`), m = d == null ? void 0 : d.getBoundingClientRect();
        return m && m.width > 0 ? { x: Math.round(m.left + m.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Ie}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ _("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(Br, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(Br, { role: "reading", ...n }) }) : null
  ] });
}
const Yd = () => () => {
}, jr = () => null;
function Xd({
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
function Qd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function eu(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function tu(e) {
  const t = Je(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, m = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, f = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? zt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), v = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, S = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, y = (t == null ? void 0 : t.compareVersion) ?? null, b = (y == null ? void 0 : y.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", I = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = y ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, M = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, z = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), $ = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), F = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), R = e.regions ?? (t == null ? void 0 : t.regions) ?? [], T = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), E = (t == null ? void 0 : t.regionHover) ?? null, [A, L] = k(null), j = uo(
    E ? E.subscribe : Yd,
    E ? () => E.get().itemId : jr,
    E ? () => E.get().itemId : jr
  ), B = E ? j : A, W = x((le) => {
    E ? E.set(le, "pdf") : L(le);
  }, [E]), ee = Xd({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: d
  }), J = Number.isFinite(g) && g > 0 ? Qd(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Od(u, J), Bd(u, ee.compareMode), /* @__PURE__ */ _(
    "div",
    {
      ref: m,
      className: To,
      "data-reader-region-count": R.length,
      "data-reader-structured-region-count": R.filter(Ba).length,
      "data-reader-metadata-ready": T ? "true" : "false",
      children: [
        /* @__PURE__ */ _(
          "main",
          {
            className: `${Po} reader-mode-${ee.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              v ? /* @__PURE__ */ p(
                Or,
                {
                  pane: "source",
                  url: b,
                  preloadedFile: P,
                  userZoom: f,
                  visible: ee.showSource,
                  scrollRoot: u,
                  pageWidthOverride: J,
                  rowHeights: ee.compareMode ? h : void 0,
                  onMetrics: z,
                  emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: $,
                  activeRegion: F,
                  regions: (y == null ? void 0 : y.regions) ?? R,
                  readerMetadata: T,
                  hoveredRegionId: B,
                  onHoverRegion: W,
                  liveTranslation: d ? o : void 0,
                  showLiveTranslation: d,
                  liveTranslationPendingLabel: d ? eu(o) : "",
                  paneAction: d && ee.showTranslated ? /* @__PURE__ */ _(ct, { children: [
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
                y ? `compare:${y.url}` : "source"
              ) : null,
              S ? /* @__PURE__ */ p(
                Or,
                {
                  pane: "translated",
                  url: I,
                  preloadedFile: M,
                  userZoom: f,
                  visible: ee.showTranslated,
                  scrollRoot: u,
                  pageWidthOverride: J,
                  rowHeights: ee.compareMode ? h : void 0,
                  onMetrics: z,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: $,
                  activeRegion: F,
                  regions: R,
                  readerMetadata: T,
                  hoveredRegionId: B,
                  onHoverRegion: W,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Vd, { shellEl: u }),
        y ? /* @__PURE__ */ p(Zd, { shellEl: u, left: y.left, right: y.right }) : null
      ]
    }
  );
}
const nu = [
  { id: "source", label: "原文", Icon: bo },
  { id: "compare", label: "对照", Icon: yo },
  { id: "translated", label: "译文", Icon: vo }
];
function ru(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function ou(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function au(e) {
  const t = Je(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null,
    sidePane: i = null
  } = e, l = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? ru(a.state) : "";
  return /* @__PURE__ */ _("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ _("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ _("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: [
        nu.map(({ id: d, label: m, Icon: u }) => {
          const f = !(i != null && i.active) && n === d, g = ou({
            id: d,
            documentReady: r,
            sourceViewOnly: l,
            liveTranslationAvailable: !!a
          });
          return /* @__PURE__ */ _(
            "button",
            {
              type: "button",
              className: `reader-workspace-tab${f ? " is-active" : ""}`,
              role: "tab",
              "aria-selected": f,
              "aria-label": m,
              title: g ? `${m} 需要文档任务` : m,
              disabled: g,
              onClick: () => o(d),
              children: [
                /* @__PURE__ */ p(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: m })
              ]
            },
            d
          );
        }),
        i ? /* @__PURE__ */ _(
          Q,
          {
            className: `reader-workspace-tab reader-workspace-tab--side${i.active ? " is-active" : ""}`,
            role: "tab",
            "aria-selected": i.active,
            "aria-label": i.label,
            title: i.label,
            "data-reader-side-tab": "",
            onClick: i.onSelect,
            children: [
              /* @__PURE__ */ p(Ya, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: i.label })
            ]
          }
        ) : null
      ] }),
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
              /* @__PURE__ */ p(Xa, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ _(
          Q,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Qa, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ _(
        Q,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(es, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const su = co(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ _(
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
}), iu = su, lu = {
  markdown: { label: "Markdown", short: "MD", Icon: iu, needsJob: !0 }
}, cu = Lo.map(
  (e) => ({ id: e, ...lu[e] })
);
function na() {
  return cu.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function du(e) {
  const t = Je(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(ct, { children: na().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
    const d = n === s, m = c && r, u = d ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ _(
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
          /* @__PURE__ */ p(l, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function uu(e) {
  const t = Je(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = na().map(({ id: l, label: c, short: d, Icon: m, needsJob: u }) => ({
    key: l,
    label: c,
    short: d,
    Icon: m,
    disabled: u && o,
    selected: n === l,
    badge: r == null ? void 0 : r[l],
    onClick: () => a(l)
  }));
  return n ? /* @__PURE__ */ _("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: d, disabled: m, selected: u, badge: f, onClick: g }) => /* @__PURE__ */ _(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": u,
        className: `reader-assistant-dock-tab${u ? " is-active" : ""}`,
        title: m ? `${c} 需打开任务阅读` : c,
        disabled: m,
        onClick: g,
        children: [
          /* @__PURE__ */ p(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-assistant-dock-tab-label", children: c }),
          f ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: f }) : null
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
        children: /* @__PURE__ */ p(wt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function fu(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function mu(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function hu(e) {
  return e / 100 * window.innerHeight;
}
function pu(e) {
  return e / 100 * window.innerWidth;
}
function gu(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function kt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = gu(n);
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
      r = mu(t, o);
      break;
    }
    case "em": {
      r = fu(t, o);
      break;
    }
    case "vh": {
      r = hu(o);
      break;
    }
    case "vw": {
      r = pu(o);
      break;
    }
  }
  return r;
}
function Se(e) {
  return parseFloat(e.toFixed(3));
}
function yt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function kn(e) {
  const { panels: t } = e, n = yt({ group: e });
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
      const d = kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Se(d / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const d = kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Se(d / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const d = kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = Se(d / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const d = kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = Se(d / n * 100);
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
function Mn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? bu : yu
  );
}
function bu(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function yu(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function ra(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function oa(e, t) {
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
function vu({
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
    const { x: i, y: l } = oa(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return re(o, "No rect found"), o;
}
let jt;
function wu() {
  return jt === void 0 && (typeof matchMedia == "function" ? jt = !!matchMedia("(pointer:coarse)").matches : jt = !1), jt;
}
function aa(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Mn(
    n,
    Array.from(t.children).filter(ra).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, l = !1, c = -1, d = -1, m = 0, u, f = [];
  {
    let g = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (g++, h.hasAttribute("data-disabled") || (m++, c === -1 && (c = g), d = g));
  }
  if (m > 1) {
    let g = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        g++;
        const v = r.find(
          (S) => S.element === h
        );
        if (v) {
          if (u) {
            const S = u.element.getBoundingClientRect(), w = h.getBoundingClientRect();
            let y;
            if (l) {
              const b = n === "horizontal" ? new DOMRect(
                S.right,
                S.top,
                0,
                S.height
              ) : new DOMRect(
                S.left,
                S.bottom,
                S.width,
                0
              ), I = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (f.length) {
                case 0: {
                  y = [
                    b,
                    I
                  ];
                  break;
                }
                case 1: {
                  const P = f[0], M = vu({
                    orientation: n,
                    rects: [S, w],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  y = [
                    P,
                    M === S ? I : b
                  ];
                  break;
                }
                default: {
                  y = f;
                  break;
                }
              }
            } else
              f.length ? y = f : y = [
                n === "horizontal" ? new DOMRect(
                  S.right,
                  w.top,
                  w.left - S.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  S.bottom,
                  w.width,
                  w.top - S.bottom
                )
              ];
            for (const b of y) {
              let I = "width" in b ? b : b.element.getBoundingClientRect();
              const P = wu() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (I.width < P) {
                const z = P - I.width;
                I = new DOMRect(
                  I.x - z / 2,
                  I.y,
                  I.width + z,
                  I.height
                );
              }
              if (I.height < P) {
                const z = P - I.height;
                I = new DOMRect(
                  I.x,
                  I.y - z / 2,
                  I.width,
                  I.height + z
                );
              }
              const M = g <= c || g > d;
              !i && !M && s.push({
                group: e,
                groupSize: yt({ group: e }),
                panels: [u, v],
                separator: "width" in b ? void 0 : b,
                rect: I
              }), i = !1;
            }
          }
          l = !1, u = v, f = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const v = o.find(
          (S) => S.element === h
        );
        v ? f.push(v) : (u = void 0, f = []);
      } else
        l = !0;
  }
  return s;
}
var Ge;
class sa {
  constructor() {
    ir(this, Ge, {});
  }
  addListener(t, n) {
    const r = St(this, Ge)[t];
    return r === void 0 ? St(this, Ge)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = St(this, Ge)[t];
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
    lr(this, Ge, {});
  }
  removeListener(t, n) {
    const r = St(this, Ge)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ge = new WeakMap();
let gt = {
  cursorFlags: 0,
  state: "inactive"
};
const Wn = new sa();
function st() {
  return gt;
}
function Su(e) {
  return Wn.addListener("change", e);
}
function Iu(e) {
  const t = gt, n = { ...gt };
  n.cursorFlags = e, gt = n, Wn.emit("change", {
    prev: t,
    next: n
  });
}
function bt(e) {
  const t = gt;
  gt = e, Wn.emit("change", {
    prev: t,
    next: e
  });
}
const Ru = (e) => e, fn = () => {
}, ia = 1, la = 2, ca = 4, da = 8, Hr = 3, Ur = 12;
let Ht;
function Wr() {
  return Ht === void 0 && (Ht = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Ht = !0)), Ht;
}
function Pu({
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
        if (e && Wr()) {
          const a = (e & ia) !== 0, s = (e & la) !== 0, i = (e & ca) !== 0, l = (e & da) !== 0;
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
    return Wr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Kr = /* @__PURE__ */ new WeakMap();
function Kn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Kr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = st();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Pu({
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
  Kr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let ze = /* @__PURE__ */ new Map();
const ua = new sa();
function Tu(e) {
  ze = new Map(ze), ze.delete(e);
}
function Vr(e, t) {
  for (const [n] of ze)
    if (n.id === e)
      return n;
}
function Ye(e, t) {
  for (const [n, r] of ze)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function dt() {
  return ze;
}
function Vn(e, t) {
  return ua.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ve(e, t, n) {
  const r = ze.get(e);
  ze = new Map(ze), ze.set(e, t), ua.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function fa(e) {
  const t = st();
  let n = !1;
  switch (t.state) {
    case "active":
      bt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Kn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Ye(r.group.id, !0);
        Ve(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Jr(e) {
  e.defaultPrevented || fa(e.currentTarget);
}
function Eu(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = oa(n, a.rect);
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
function ku(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Mu(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Zr(e),
    b: Zr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  re(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Gr(qr(n.a)),
    b: Gr(qr(n.b))
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
const Nu = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Au(e) {
  const t = getComputedStyle(ma(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function _u(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Au(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Nu.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function qr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (re(n, "Missing node"), _u(n)) return n;
  }
  return null;
}
function Gr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Zr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ma(e);
  return t;
}
function ma(e) {
  const { parentNode: t } = e;
  return ku(t) ? t.host : t;
}
function Lu(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Du({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!ra(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Mu(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Lu(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Jn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = aa(o), s = Eu(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Du({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Cu(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function ve(e, t, n = 0) {
  return Math.abs(Se(e) - Se(t)) <= n;
}
function Oe(e, t) {
  return ve(e, t) ? 0 : e > t ? 1 : -1;
}
function pt({
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
  if (Oe(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      Oe(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = Se(r), r;
}
function Dt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (ve(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), l = Object.values(o), c = [...i], [d, m] = r;
  re(d != null, "Invalid first pivot index"), re(m != null, "Invalid second pivot index");
  let u = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? m : d, v = n[h];
        re(
          v,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: S = 0,
          collapsible: w,
          minSize: y = 0
        } = v;
        if (w) {
          const b = i[h];
          if (re(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), ve(b, S)) {
            const I = y - b;
            Oe(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      {
        const h = e < 0 ? d : m, v = n[h];
        re(
          v,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: S = 0,
          collapsible: w,
          minSize: y = 0
        } = v;
        if (w) {
          const b = i[h];
          if (re(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), ve(b, y)) {
            const I = b - S;
            Oe(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? m : d, v = n[h];
      re(
        v,
        `Panel constraints not found for index ${h}`
      );
      const S = i[h], { collapsible: w, collapsedSize: y, minSize: b } = v;
      if (w && Oe(S, b) < 0)
        if (e > 0) {
          const I = b - y, P = I / 2, M = S + e;
          Oe(M, b) < 0 && (e = Oe(e, P) <= 0 ? 0 : I);
        } else {
          const I = b - y, P = 100 - I / 2, M = S - e;
          Oe(M, b) < 0 && (e = Oe(100 + e, P) > 0 ? 0 : -I);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let v = e < 0 ? m : d, S = 0;
    for (; ; ) {
      const y = i[v];
      re(
        y != null,
        `Previous layout not found for panel index ${v}`
      );
      const b = pt({
        overrideDisabledPanels: s,
        panelConstraints: n[v],
        prevSize: y,
        size: 100
      }) - y;
      if (S += b, v += h, v < 0 || v >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(S));
    e = e < 0 ? 0 - w : w;
  }
  {
    let h = e < 0 ? d : m;
    for (; h >= 0 && h < n.length; ) {
      const v = Math.abs(e) - Math.abs(u), S = i[h];
      re(
        S != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = S - v, y = pt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: S,
        size: w
      });
      if (!ve(S, y) && (u += S - y, c[h] = y, u.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Cu(l, c))
    return o;
  {
    const h = e < 0 ? m : d, v = i[h];
    re(
      v != null,
      `Previous layout not found for panel index ${h}`
    );
    const S = v + u, w = pt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: v,
      size: S
    });
    if (c[h] = w, !ve(w, S)) {
      let y = S - w, b = e < 0 ? m : d;
      for (; b >= 0 && b < n.length; ) {
        const I = c[b];
        re(
          I != null,
          `Previous layout not found for panel index ${b}`
        );
        const P = I + y, M = pt({
          overrideDisabledPanels: s,
          panelConstraints: n[b],
          prevSize: I,
          size: P
        });
        if (ve(I, M) || (y -= M - I, c[b] = M), ve(y, 0))
          break;
        e > 0 ? b-- : b++;
      }
    }
  }
  const f = Object.values(c).reduce(
    (h, v) => v + h,
    0
  );
  if (!ve(f, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return c.reduce((h, v, S) => (h[g[S]] = v, h), {});
}
function it(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Oe(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function lt({
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
  if (!ve(o, 100) && r.length > 0)
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
    const d = pt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: l,
      size: c
    });
    c != d && (a += c - d, r[i] = d);
  }
  if (!ve(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      re(l != null, `No layout data found for index ${i}`);
      const c = l + a, d = pt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== d && (a -= d - l, r[i] = d, ve(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, l, c) => (i[s[c]] = l, i), {});
}
function ha({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = dt();
    for (const [
      c,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: m,
        layout: u,
        groupSize: f,
        separatorToPanels: g
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: m,
          group: c,
          groupSize: f,
          layout: u,
          separatorToPanels: g
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
    derivedPanelConstraints: m
  }) => {
    const u = a(), f = c.findIndex((v) => v.id === t), g = f === 0, h = f === c.length - 1;
    if (h && l < u && (g || c.slice(0, f).every((v, S) => {
      const w = m[S];
      return (w == null ? void 0 : w.collapsible) && ve(w.collapsedSize, d[w.panelId]);
    }))) {
      const v = c.slice(0, f).reduce((S, w) => S + d[w.id], 0);
      return {
        ...d,
        [t]: Se(100 - v)
      };
    }
    return Dt({
      delta: h ? u - l : l - u,
      initialLayout: d,
      panelConstraints: m,
      pivotIndices: h ? [f - 1, f] : [f, f + 1],
      prevLayout: d,
      trigger: "imperative-api"
    });
  }, i = (l) => {
    const c = a();
    if (l === c)
      return;
    const {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: m,
      group: u,
      groupSize: f,
      layout: g,
      separatorToPanels: h
    } = n(), v = s({
      nextSize: l,
      panels: u.panels,
      prevLayout: g,
      derivedPanelConstraints: m
    }), S = lt({
      layout: v,
      panelConstraints: m
    });
    it(g, S) || Ve(u, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: m,
      groupSize: f,
      layout: S,
      separatorToPanels: h
    });
  };
  return {
    collapse: () => {
      const { collapsible: l, collapsedSize: c } = r(), { mutableValues: d } = o(), m = a();
      l && m !== c && (d.expandToSize = m, i(c));
    },
    expand: () => {
      const { collapsible: l, collapsedSize: c, minSize: d } = r(), { mutableValues: m } = o(), u = a();
      if (l && u === c) {
        let f = m.expandToSize ?? d;
        f === 0 && (f = 1), i(f);
      }
    },
    getSize: () => {
      const { group: l } = n(), c = a(), { element: d } = o(), m = l.orientation === "horizontal" ? d.offsetWidth : d.offsetHeight;
      return {
        asPercentage: c,
        inPixels: m
      };
    },
    isCollapsed: () => {
      const { collapsible: l, collapsedSize: c } = r(), d = a();
      return l && ve(c, d);
    },
    resize: (l) => {
      const { group: c } = n(), { element: d } = o(), m = yt({ group: c }), u = kt({
        groupSize: m,
        panelElement: d,
        styleProp: l
      }), f = Se(u / m * 100);
      i(f);
    }
  };
}
function Yr(e) {
  if (e.defaultPrevented)
    return;
  const t = dt();
  Jn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = ha({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Kt(e) {
  const t = dt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function pa({
  groupId: e
}) {
  const t = () => {
    const n = dt();
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
      } = t(), c = lt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (it(i, c) || Ve(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function rt(e, t) {
  const n = Kt(e), r = Ye(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  re(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  re(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = pa({ groupId: n.id }).getLayout(), l = Dt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = lt({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  it(i, c) || Ve(
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
function Xr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Kt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && rt(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && rt(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && rt(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && rt(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), rt(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Kt(t), o = Ye(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (u) => u.element === t
        );
        re(l, "Matching separator not found");
        const c = i.get(l);
        re(c, "Matching panels not found");
        const d = c[0], m = a.find(
          (u) => u.panelId === d.id
        );
        if (re(m, "Panel metadata not found"), m.collapsible) {
          const u = s[d.id], f = m.collapsedSize === u ? r.mutableState.expandedPanelSizes[d.id] ?? m.minSize : m.collapsedSize;
          rt(t, f - u);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Kt(t).separators.map(
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
        e.preventDefault(), rt(t, -100);
        break;
      }
    }
}
function Qr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = dt(), n = Jn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), bt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function ga({
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
    const { group: d, groupSize: m } = c, { orientation: u, panels: f } = d, { disableCursor: g } = d.mutableState;
    let h = 0;
    a ? u === "horizontal" ? h = (t.clientX - a.x) / m * 100 : h = (t.clientY - a.y) / m * 100 : u === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const v = r.get(d), S = o.get(d);
    if (!v || !S)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: y,
      groupSize: b,
      layout: I,
      separatorToPanels: P
    } = S;
    if (y && I && P) {
      const M = Dt({
        delta: h,
        initialLayout: v,
        panelConstraints: y,
        pivotIndices: c.panels.map((z) => f.indexOf(z)),
        prevLayout: I,
        trigger: "mouse-or-touch"
      });
      if (it(M, I)) {
        if (h !== 0 && !g)
          switch (u) {
            case "horizontal": {
              i |= h < 0 ? ia : la;
              break;
            }
            case "vertical": {
              i |= h < 0 ? ca : da;
              break;
            }
          }
      } else
        Ve(c.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: y,
          groupSize: b,
          layout: M,
          separatorToPanels: P
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & Hr : l |= i & Hr, t.movementY === 0 ? l |= s & Ur : l |= i & Ur, Iu(l), Kn(e);
}
function eo(e) {
  const t = dt(), n = st();
  switch (n.state) {
    case "active":
      ga({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function to(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = st(), n = dt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        bt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Ye(a.group.id, !0);
          Ve(a.group, s, {
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
      ga({
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
      const a = Jn(e, n);
      a.length === 0 ? t.state !== "inactive" && bt({
        cursorFlags: 0,
        state: "inactive"
      }) : bt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Kn(e.currentTarget);
      break;
    }
  }
}
function no(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (st().state) {
      case "hover":
        bt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function ro(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || fa(e.currentTarget) && e.preventDefault();
}
function oo(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Se(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Se((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function xu(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = yt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Se(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Ou(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function zu({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const i = /* @__PURE__ */ new Map(), l = [];
  for (const m of e.panels) {
    const u = r[m.id] ?? 0;
    switch (m.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const f = u / 100 * n, g = Se(
          f / t * 100
        );
        i.set(m.id, g), o += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        l.push(m.id), a += u;
        break;
      }
    }
  }
  if (!s || l.length === 0)
    return r;
  const c = 100 - o, d = { ...r };
  if (i.forEach((m, u) => {
    d[u] = m;
  }), a > 0)
    for (const m of l) {
      const u = r[m] ?? 0;
      d[m] = Se(
        u / a * c
      );
    }
  else {
    const m = Se(
      c / l.length
    );
    for (const u of l)
      d[u] = m;
  }
  return d;
}
function $u(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const ft = /* @__PURE__ */ new Map();
function Fu(e) {
  let t = !0;
  re(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: v, target: S } = h;
      if (S === e.element) {
        if (t) {
          const w = yt({ group: e });
          if (w === 0)
            return;
          const y = Ye(e.id);
          if (!y)
            return;
          const b = kn(e), I = y.defaultLayoutDeferred ? oo(b) : y.layout, P = zu({
            group: e,
            nextGroupSize: w,
            prevGroupSize: y.groupSize,
            prevLayout: I
          }), M = lt({
            layout: P,
            panelConstraints: b
          });
          if (!y.defaultLayoutDeferred && it(y.layout, M) && Ou(
            y.derivedPanelConstraints,
            b
          ) && y.groupSize === w)
            return;
          Ve(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: b,
            groupSize: w,
            layout: M,
            separatorToPanels: y.separatorToPanels
          });
        }
      } else
        xu(e, S, v);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    re(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = yt({ group: e }), i = kn(e), l = e.panels.map(({ id: g }) => g).join(",");
  let c = e.mutableState.defaultLayout;
  c && ($u(e.panels, c) || (c = void 0));
  const d = e.mutableState.layouts[l] ?? c ?? oo(i), m = lt({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  ft.set(
    u,
    (ft.get(u) ?? 0) + 1
  );
  const f = /* @__PURE__ */ new Map();
  return aa(e).forEach((g) => {
    g.separator && f.set(g.separator, g.panels);
  }), Ve(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: m,
    separatorToPanels: f
  }), e.separators.forEach((g) => {
    re(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Xr);
  }), ft.get(u) === 1 && (u.addEventListener("contextmenu", Jr, !0), u.addEventListener("dblclick", Yr, !0), u.addEventListener("pointerdown", Qr, !0), u.addEventListener("pointerleave", eo), u.addEventListener("pointermove", to), u.addEventListener("pointerout", no), u.addEventListener("pointerup", ro, !0)), function() {
    t = !1, ft.set(
      u,
      Math.max(0, (ft.get(u) ?? 0) - 1)
    ), Tu(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Xr);
    }), ft.get(u) || (u.removeEventListener(
      "contextmenu",
      Jr,
      !0
    ), u.removeEventListener(
      "dblclick",
      Yr,
      !0
    ), u.removeEventListener(
      "pointerdown",
      Qr,
      !0
    ), u.removeEventListener("pointerleave", eo), u.removeEventListener("pointermove", to), u.removeEventListener("pointerout", no), u.removeEventListener("pointerup", ro, !0)), a.disconnect();
  };
}
function Bu() {
  const [e, t] = k({}), n = x(() => t({}), []);
  return [e, n];
}
function qn(e) {
  const t = fo();
  return `${e ?? t}`;
}
const ut = typeof window < "u" ? Te : D;
function Mt(e) {
  const t = N(e);
  return ut(() => {
    t.current = e;
  }, [e]), x(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Gn(...e) {
  return Mt((t) => {
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
function Zn(e) {
  const t = N({ ...e });
  return ut(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ba = Ln(null);
function ju(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: Ru
  });
  Cn(t, () => n.current, []), ut(() => {
    Object.assign(
      n.current,
      pa({ groupId: e })
    );
  });
}
function ya({
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
  resizeTargetMinimumSize: m = {
    coarse: 20,
    fine: 10
  },
  style: u,
  ...f
}) {
  const g = N({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Mt((R) => {
    it(g.current.onLayoutChange, R) || (g.current.onLayoutChange = R, l == null || l(R));
  }), v = Mt(
    (R, T) => {
      it(g.current.onLayoutChanged, R) || (g.current.onLayoutChanged = R, c == null || c(R, { isUserInteraction: T }));
    }
  ), S = qn(i), w = N(null), [y, b] = Bu(), I = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: m,
    separators: []
  }), P = Gn(w, a);
  ju(S, s);
  const M = Mt(
    (R, T) => {
      const E = st(), A = Vr(R), L = Ye(R);
      if (L) {
        let j = !1;
        switch (E.state) {
          case "active": {
            j = E.hitRegions.some(
              (B) => B.group === A
            );
            break;
          }
        }
        return {
          flexGrow: L.layout[T] ?? 1,
          pointerEvents: j ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), z = Zn({
    defaultLayout: n,
    disableCursor: r
  }), $ = q(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: M,
      id: S,
      orientation: d,
      registerPanel: (R) => {
        const T = I.current;
        return T.panels = Mn(d, [
          ...T.panels,
          R
        ]), b(), () => {
          T.panels = T.panels.filter(
            (E) => E !== R
          ), b();
        };
      },
      registerSeparator: (R) => {
        const T = I.current;
        return T.separators = Mn(d, [
          ...T.separators,
          R
        ]), b(), () => {
          T.separators = T.separators.filter(
            (E) => E !== R
          ), b();
        };
      },
      updatePanelProps: (R, { disabled: T }) => {
        const E = I.current.panels.find(
          (j) => j.id === R
        );
        E && (E.panelConstraints.disabled = T);
        const A = Vr(S), L = Ye(S);
        A && L && Ve(A, {
          ...L,
          derivedPanelConstraints: kn(A)
        });
      },
      updateSeparatorProps: (R, {
        disabled: T,
        disableDoubleClick: E
      }) => {
        const A = I.current.separators.find(
          (L) => L.id === R
        );
        A && (A.disabled = T, A.disableDoubleClick = E);
      }
    }),
    [M, S, b, d, z]
  ), F = N(null);
  return ut(() => {
    const R = w.current;
    if (R === null)
      return;
    const T = I.current;
    let E;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === T.panels.length) {
      E = {};
      for (const oe of T.panels) {
        const J = z.defaultLayout[oe.id];
        J !== void 0 && (E[oe.id] = J);
      }
    }
    const A = {
      disabled: !!o,
      element: R,
      id: S,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!z.disableCursor,
        expandedPanelSizes: I.current.lastExpandedPanelSizes,
        layouts: I.current.layouts
      },
      orientation: d,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    F.current = A;
    const L = Fu(A), { defaultLayoutDeferred: j, derivedPanelConstraints: B, layout: W } = Ye(A.id, !0);
    !j && B.length > 0 && (h(W), v(W, !1));
    const ee = Vn(S, (oe) => {
      const { defaultLayoutDeferred: J, derivedPanelConstraints: le, layout: ce } = oe.next;
      if (J || le.length === 0)
        return;
      const de = A.panels.map(({ id: G }) => G).join(",");
      A.mutableState.layouts[de] = ce, le.forEach((G) => {
        if (G.collapsible) {
          const { layout: X } = oe.prev ?? {};
          if (X) {
            const Re = ve(
              G.collapsedSize,
              ce[G.panelId]
            ), fe = ve(
              G.collapsedSize,
              X[G.panelId]
            );
            Re && !fe && (A.mutableState.expandedPanelSizes[G.panelId] = X[G.panelId]);
          }
        }
      });
      const xe = st().state !== "active";
      h(ce), xe && v(ce, oe.isUserInteraction);
    });
    return () => {
      F.current = null, L(), ee();
    };
  }, [
    o,
    S,
    v,
    h,
    d,
    y,
    z
  ]), D(() => {
    const R = F.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ba.Provider, { value: $, children: /* @__PURE__ */ p(
    "div",
    {
      ...f,
      className: t,
      "data-group": !0,
      "data-testid": S,
      id: S,
      ref: P,
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
ya.displayName = "Group";
function Yn() {
  const e = Dn(ba);
  return re(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Hu(e, t) {
  const { id: n } = Yn(), r = N({
    collapse: fn,
    expand: fn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: fn
  });
  Cn(t, () => r.current, []), ut(() => {
    Object.assign(
      r.current,
      ha({ groupId: n, panelId: e })
    );
  });
}
function Nn({
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
  onResize: m,
  panelRef: u,
  style: f,
  ...g
}) {
  const h = !!l, v = qn(l), S = Zn({
    disabled: a
  }), w = N(null), y = Gn(w, s), {
    getPanelStyles: b,
    id: I,
    orientation: P,
    registerPanel: M,
    updatePanelProps: z
  } = Yn(), $ = m !== null, F = Mt(
    (A, L, j) => {
      m == null || m(A, l, j);
    }
  );
  ut(() => {
    const A = w.current;
    if (A !== null) {
      const L = {
        element: A,
        id: v,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: $ ? F : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: S.disabled,
          maxSize: c,
          minSize: d
        }
      };
      return M(L);
    }
  }, [
    i,
    n,
    r,
    o,
    $,
    v,
    h,
    c,
    d,
    F,
    M,
    S
  ]), D(() => {
    z(v, { disabled: a });
  }, [a, v, z]), Hu(v, u);
  const R = () => {
    const A = b(I, v);
    if (A)
      return JSON.stringify(A);
  }, T = uo(
    (A) => Vn(I, A),
    R,
    R
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
      "data-testid": v,
      id: v,
      ref: y,
      style: {
        ...Uu,
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
            ...f,
            // Inform the browser that the library is handling touch events for this element
            // but still allow users to scroll content within panels in the non-resizing direction
            // NOTE This is not an inherited style
            // See github.com/bvaughn/react-resizable-panels/issues/662
            touchAction: P === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Nn.displayName = "Panel";
const Uu = {
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
function Wu({
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
    a = lt({
      layout: Dt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = lt({
      layout: Dt({
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
function va({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = qn(a), c = Zn({
    disabled: n,
    disableDoubleClick: r
  }), [d, m] = k({}), [u, f] = k("inactive"), [g, h] = k(!1), v = N(null), S = Gn(v, o), {
    disableCursor: w,
    id: y,
    orientation: b,
    registerSeparator: I,
    updateSeparatorProps: P
  } = Yn(), M = b === "horizontal" ? "vertical" : "horizontal";
  ut(() => {
    const F = v.current;
    if (F !== null) {
      const R = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: F,
        id: l
      }, T = I(R), E = Su(
        (L) => {
          f(
            L.next.state !== "inactive" && L.next.hitRegions.some(
              (j) => j.separator === R
            ) ? L.next.state : "inactive"
          );
        }
      ), A = Vn(
        y,
        (L) => {
          const { derivedPanelConstraints: j, layout: B, separatorToPanels: W } = L.next, ee = W.get(R);
          if (ee) {
            const oe = ee[0], J = ee.indexOf(oe);
            m(
              Wu({
                layout: B,
                panelConstraints: j,
                panelId: oe.id,
                panelIndex: J
              })
            );
          }
        }
      );
      return () => {
        E(), A(), T();
      };
    }
  }, [y, l, I, c]), D(() => {
    P(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, P]);
  let z;
  n && !w && (z = "not-allowed");
  let $;
  if (n)
    $ = "disabled";
  else
    switch (u) {
      case "active": {
        $ = "active";
        break;
      }
      default:
        g ? $ = "focus" : $ = u;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": d.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": M,
      "aria-valuemax": d.valueMax,
      "aria-valuemin": d.valueMin,
      "aria-valuenow": d.valueNow,
      children: e,
      className: t,
      "data-separator": $,
      "data-testid": l,
      id: l,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: S,
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
va.displayName = "Separator";
const Xn = 30, Qn = 65, Ct = 50, Ku = 100 - Qn, Vu = 100 - Xn;
function Ju(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Qn, Math.max(Xn, t)) : Ct;
}
function er(e) {
  return 100 - e;
}
function mt(e) {
  return `${e}%`;
}
const tr = "reader-document", xt = "reader-assistant", wa = "retainpdf.reader.ai-split-layout.v1", qu = {
  [tr]: er(Ct),
  [xt]: Ct
};
function nr(e) {
  const t = Ju(e == null ? void 0 : e[xt]);
  return {
    [tr]: er(t),
    [xt]: t
  };
}
function Gu() {
  try {
    const e = JSON.parse(localStorage.getItem(wa) || "null");
    return nr(e);
  } catch {
    return qu;
  }
}
function Zu(e) {
  try {
    localStorage.setItem(wa, JSON.stringify(nr(e)));
  } catch {
  }
}
function mn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = nr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[xt]}vw`
  );
}
function Yu() {
  const e = N(null), [t] = k(Gu);
  Te(() => {
    const o = e.current;
    return mn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = x((o) => {
    mn(e.current, o);
  }, []), r = x((o, a) => {
    mn(e.current, o), a.isUserInteraction && Zu(o);
  }, []);
  return /* @__PURE__ */ _(
    ya,
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
          Nn,
          {
            id: tr,
            defaultSize: mt(er(Ct)),
            minSize: mt(Ku),
            maxSize: mt(Vu)
          }
        ),
        /* @__PURE__ */ p(
          va,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Nn,
          {
            id: xt,
            defaultSize: mt(Ct),
            minSize: mt(Xn),
            maxSize: mt(Qn)
          }
        )
      ]
    }
  );
}
function Xu({
  id: e,
  open: t,
  ariaLabel: n,
  className: r = "",
  onClose: o,
  toolbar: a,
  children: s
}) {
  return D(() => {
    if (!t) return;
    const i = (l) => {
      var d;
      if (l.key !== "Escape") return;
      const c = l.target;
      (d = c == null ? void 0 : c.closest) != null && d.call(c, "textarea, input, select, [contenteditable='true']") || (l.preventDefault(), o());
    };
    return window.addEventListener("keydown", i), () => window.removeEventListener("keydown", i);
  }, [t, o]), t ? /* @__PURE__ */ _(
    "aside",
    {
      id: e,
      className: `reader-notes-panel reader-notes-panel--workspace${a ? " has-panel-toolbar" : ""} ${r}`.trim(),
      "aria-label": n,
      role: "dialog",
      "aria-modal": "false",
      children: [
        a ? /* @__PURE__ */ p("div", { className: "reader-notes-panel-toolbar", children: a }) : null,
        /* @__PURE__ */ p("div", { className: "reader-notes-panel-body", children: s })
      ]
    }
  ) : null;
}
function Qu({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = k(!1);
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
    n ? /* @__PURE__ */ p(Q, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function ef({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Qu, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ _(ct, { children: [
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
      s ? /* @__PURE__ */ p(Q, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function tf(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function nf() {
  const [e, t] = k(!1), n = fo(), r = N(null);
  return D(() => {
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
  }, [e]), D(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || tf(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
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
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ p(ts, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: zl.map((o) => /* @__PURE__ */ _("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: o.title }),
            /* @__PURE__ */ p("ul", { children: o.items.map((a) => /* @__PURE__ */ _("li", { children: [
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
const rf = ["source", "sideBySide", "translated"], of = { source: "", translated: "", sideBySide: "" };
function af(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Vt(e.sourceUrl), n = Vt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Ms({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function sf(e) {
  const [t, n] = k(() => /* @__PURE__ */ new Set()), r = q(
    () => e ? af(e) : of,
    [e]
  ), o = q(
    () => rf.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = x(async (s) => {
    if (!e) return;
    const i = Vt(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? ks(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Ns(
          e.fetchProtected,
          i,
          l,
          l,
          null,
          (c) => n((d) => {
            const m = new Set(d);
            return c ? m.add(s) : m.delete(s), m;
          })
        );
      } catch (l) {
        const c = l instanceof Error ? l.message : "下载失败";
        As(c), n((d) => {
          const m = new Set(d);
          return m.delete(s), m;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const lf = {
  source: bo,
  sideBySide: yo,
  translated: vo
}, cf = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function df(e) {
  const t = Je(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = sf(n), i = N(null);
  return D(() => {
    const l = () => {
      var m;
      (m = i.current) != null && m.open && (i.current.open = !1);
    }, c = (m) => {
      i.current && !i.current.contains(m.target) && l();
    }, d = (m) => {
      m.key === "Escape" && l();
    };
    return document.addEventListener("pointerdown", c), document.addEventListener("keydown", d), () => {
      document.removeEventListener("pointerdown", c), document.removeEventListener("keydown", d);
    };
  }, []), /* @__PURE__ */ _("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ _("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(ns, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(go, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = Da[l], d = Vt(r[l]), m = a.has(l), u = !!d && !m, f = u ? "" : Ca(l, r), g = lf[l];
      return /* @__PURE__ */ _(
        "button",
        {
          type: "button",
          id: `reader-download-${l}`,
          className: `reader-download-action${m ? " is-busy" : ""}`,
          disabled: !u,
          "aria-label": u ? `下载${c.label}` : f,
          onClick: () => {
            i.current && (i.current.open = !1), s(l);
          },
          children: [
            /* @__PURE__ */ p(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ _("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ _("span", { className: "reader-download-action-label", children: [
                cf[l],
                " PDF"
              ] }),
              f ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: f }) : null
            ] })
          ]
        },
        l
      );
    }) })
  ] });
}
const uf = "retainpdf:reader:bookmarks:v1:", ff = 200;
function rr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Sa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${uf}${t}` : "";
}
function mf(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Qt(e, t = rr()) {
  const n = Sa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = mf(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function An(e, t, n) {
  const r = Sa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, ff);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function hf(e, t, n = "", { storage: r = rr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Qt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? An(e, a.filter((i) => i.page !== s), r) : An(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function pf(e, t, n = rr()) {
  return An(e, Qt(e, n).filter((r) => r.page !== t), n);
}
function gf(e, t) {
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
function bf({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function yf({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = k(() => Qt(e)), [i, l] = k(!1), c = N(null);
  if (D(() => {
    s(Qt(e)), l(!1);
  }, [e]), D(() => {
    if (!i) return;
    const u = (g) => {
      c.current && !c.current.contains(g.target) && l(!1);
    }, f = (g) => {
      g.key === "Escape" && l(!1);
    };
    return document.addEventListener("pointerdown", u), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", u), document.removeEventListener("keydown", f);
    };
  }, [i]), !e || n <= 0) return null;
  const d = Math.min(Math.max(t, 1), n), m = a.some((u) => u.page === d);
  return /* @__PURE__ */ _("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: c, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${m ? " is-marked" : ""}`,
        "aria-pressed": m,
        "aria-label": m ? `取消第 ${d} 页的书签` : `给第 ${d} 页加书签`,
        title: m ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(hf(e, d, gf(r, d))),
        children: /* @__PURE__ */ p(bf, { filled: m })
      }
    ),
    a.length ? /* @__PURE__ */ _(
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
          /* @__PURE__ */ p(rs, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((u) => /* @__PURE__ */ _("li", { className: u.page === d ? "is-current" : "", children: [
      /* @__PURE__ */ _(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(u.page, n)), l(!1);
          },
          children: [
            /* @__PURE__ */ _("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(pf(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function vf(e) {
  const [t, n] = k([]);
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
function wf(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Sf = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, If = ["failed", "content", "layout"];
function Rf(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Pf({ jobId: e, currentPage: t }) {
  var m;
  const n = vf(e), r = (m = Je()) == null ? void 0 : m.jumpToBlock, [o, a] = k(!1), [s, i] = k(-1), l = N(null);
  D(() => i(-1), [n]);
  const c = (u) => {
    const f = n[u];
    !f || !r || (i(u), r(f.readerItemId));
  }, d = N({ issues: n, last: s, currentPage: t, goTo: c });
  return d.current = { issues: n, last: s, currentPage: t, goTo: c }, D(() => {
    const u = (f) => {
      if (f.key.toLowerCase() !== "n" || f.metaKey || f.ctrlKey || f.altKey || Rf(f.target)) return;
      const { issues: g, last: h, currentPage: v, goTo: S } = d.current, w = wf(g, h, v, f.shiftKey);
      w < 0 || (f.preventDefault(), S(w));
    };
    return document.addEventListener("keydown", u), () => document.removeEventListener("keydown", u);
  }, []), D(() => {
    if (!o) return;
    const u = (f) => {
      var g;
      (g = l.current) != null && g.contains(f.target) || a(!1);
    };
    return document.addEventListener("pointerdown", u, !0), () => document.removeEventListener("pointerdown", u, !0);
  }, [o]), n.length ? /* @__PURE__ */ _("div", { className: "reader-react-hud-group reader-issues", ref: l, "aria-label": "待处理", children: [
    /* @__PURE__ */ _(
      Q,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((u) => !u),
        children: [
          /* @__PURE__ */ p(os, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ _("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      If.map((u) => {
        const f = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === u);
        return f.length ? /* @__PURE__ */ _("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ _("h4", { children: [
            Sf[u],
            /* @__PURE__ */ p("span", { children: f.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: f.map(({ issue: g, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
            Q,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                c(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ _("span", { className: "reader-issues-page", children: [
                  "第 ",
                  g.page,
                  " 页"
                ] }),
                g.detail ? /* @__PURE__ */ p("span", { className: "reader-issues-detail", children: g.detail }) : null
              ]
            }
          ) }, `${g.kind}:${g.readerItemId}`)) })
        ] }, u) : null;
      })
    ] }) : null
  ] }) : null;
}
const Tf = 48, Ef = 96, kf = 700;
function Mf(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Tf, downSoFar: r };
}
function Nf(e) {
  const [t, n] = k(!1), r = N(0);
  return D(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), l = () => {
      const u = e.current;
      return !!(u && (u.querySelector(":focus-visible") || u.querySelector("[aria-expanded='true']")));
    }, c = (u) => {
      const f = u.target;
      if (!(f instanceof Element) || (i.has(f) || i.set(f, !!f.querySelector(`[${Me}]`)), !i.get(f))) return;
      const g = f.scrollTop, h = o.get(f);
      if (o.set(f, g), h === void 0 || Date.now() - a > kf) return;
      const v = Mf(!1, r.current, g - h);
      r.current = v.downSoFar, g - h < -4 ? n(!1) : v.hidden && !l() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - Ef && (r.current = 0, n(!1));
    }, m = () => {
      l() && n(!1);
    };
    document.addEventListener("scroll", c, { capture: !0, passive: !0 }), window.addEventListener("pointermove", d, { passive: !0 }), document.addEventListener("focusin", m);
    for (const u of ["wheel", "touchmove", "keydown"]) window.addEventListener(u, s, { passive: !0, capture: !0 });
    return () => {
      for (const u of ["wheel", "touchmove", "keydown"]) window.removeEventListener(u, s, { capture: !0 });
      document.removeEventListener("scroll", c, { capture: !0 }), window.removeEventListener("pointermove", d), document.removeEventListener("focusin", m);
    };
  }, [e]), t;
}
function Af(e) {
  const t = Je(), n = Qo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? zt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = bi(a), m = a > ko + 1e-3, u = a < Yt - 1e-3, f = ht(r, ot()), g = f >= Yt ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = N(null), v = Nf(h), [S, w] = k(!1), [y, b] = k(`${i}`);
  D(() => {
    S || b(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, S]);
  const I = () => {
    if (w(!1), !c || l <= 0)
      return;
    const P = Number(`${y}`.trim());
    c(Xt(P, l));
  };
  return /* @__PURE__ */ _("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": v ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: S ? /* @__PURE__ */ _(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (P) => {
          P.preventDefault(), I();
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
              value: y,
              autoFocus: !0,
              onChange: (P) => b(P.target.value.replace(/[^\d]/g, "")),
              onBlur: I,
              onKeyDown: (P) => {
                P.key === "Escape" && (P.preventDefault(), w(!1), b(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ _("span", { className: "reader-react-hud-page-suffix", children: [
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
          !c || l <= 0 || (b(`${i}`), w(!0));
        },
        children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      yf,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(Pf, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      Q,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(_f, {})
      }
    ) }) : null,
    /* @__PURE__ */ _("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !m,
          onClick: () => s(_t(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ _(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${d}%，点击${g}`,
          title: g,
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
          onClick: () => s(_t(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(nf, {}) })
  ] });
}
function _f() {
  return /* @__PURE__ */ _("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function ao(e) {
  var t, n;
  return Do(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Lf(e) {
  const [t, n] = k(() => ({
    scope: e,
    panel: ao($e(e))
  }));
  D(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: ao($e(e))
    });
  }, [e]), D(() => {
    t.scope === e && nn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = x((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const _n = "download-toast";
function Df({
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
function Cf(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    bn.dismiss(_n);
    return;
  }
  bn.custom(
    () => /* @__PURE__ */ p(Df, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: _n, duration: 1 / 0 }
  );
}
function xf() {
  const e = x((t) => {
    t && (t.setState = Cf, t.hide = () => bn.dismiss(_n));
  }, []);
  return /* @__PURE__ */ _(ct, { children: [
    /* @__PURE__ */ p(Wa, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Of(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : No(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function zf(e, t) {
  return t === null || e !== t;
}
function $f(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
function Ff(e, t) {
  const n = e === t;
  return { open: n, mounted: $f(n) };
}
const so = { itemId: null, origin: null };
function Bf() {
  let e = so;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? so : { itemId: n, origin: r };
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
const jf = [];
function Hf({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ _("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(Q, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(as, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Uf({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    Q,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(ss, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Wf({
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
  const l = ((b = Je()) == null ? void 0 : b.regions) ?? jf, c = ((I = Qo()) == null ? void 0 : I.currentPage) ?? 1, d = q(() => pd(l), [l]), m = gd(d, c), u = q(() => vd(l, s), [l, s]), [f, g] = k(-1);
  D(() => g(-1), [s]);
  const h = N(null), v = N(null), S = N(n);
  S.current = n, D(() => {
    const P = (z) => {
      var F, R;
      const $ = z.target;
      !$ || (F = v.current) != null && F.contains($) || (R = $.closest) != null && R.call($, ".reader-finder-toggles, [data-finder-toggle]") || S.current();
    }, M = (z) => {
      z.key === "Escape" && S.current();
    };
    return document.addEventListener("pointerdown", P, !0), document.addEventListener("keydown", M), () => {
      document.removeEventListener("pointerdown", P, !0), document.removeEventListener("keydown", M);
    };
  }, []);
  const w = N(null);
  D(() => {
    var P, M, z;
    e === "search" ? (P = h.current) == null || P.focus() : (z = (M = w.current) == null ? void 0 : M.querySelector('[aria-current="location"]')) == null || z.scrollIntoView({ block: "center" });
  }, [e, i]), D(() => {
    var P, M;
    e === "search" && f >= 0 && ((M = (P = w.current) == null ? void 0 : P.querySelector('[aria-current="true"]')) == null || M.scrollIntoView({ block: "nearest" }));
  }, [e, f]);
  const y = (P) => {
    const M = u[P];
    M && (g(P), r(M.itemId));
  };
  return /* @__PURE__ */ _("aside", { ref: v, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ _("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ _("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(Q, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(Q, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(Q, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(wt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: w, className: "reader-finder-list", children: d.map((P, M) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
      Q,
      {
        className: "reader-finder-entry",
        "data-level": P.level,
        "aria-current": M === m ? "location" : void 0,
        onClick: () => r(P.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: P.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: P.page })
        ]
      }
    ) }, P.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: l.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ _(ct, { children: [
      /* @__PURE__ */ _("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          wo,
          {
            ref: h,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (P) => a(P.target.value),
            onKeyDown: (P) => {
              P.key === "Enter" ? (P.preventDefault(), y(Sd(f, u.length, P.shiftKey))) : P.key === "Escape" && (P.preventDefault(), n()), P.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: u.length === 0 ? "没有找到" : `${f >= 0 ? `第 ${f + 1} / ` : ""}${u.length >= 200 ? "200+ 处，只列前 200 处" : `${u.length} 处`}${f < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: u.map((P, M) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(Q, { className: "reader-finder-entry is-hit", "aria-current": M === f ? "true" : void 0, onClick: () => y(M), children: [
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
function Kf({ active: e, compare: t, ink: n }) {
  const [r, o] = k(!1), [a, s] = k(!1), i = N(null);
  D(() => {
    if (!r && !a) return;
    const c = () => {
      o(!1), s(!1);
    }, d = (u) => {
      var f;
      (f = i.current) != null && f.contains(u.target) || c();
    }, m = (u) => {
      u.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", d, !0), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", d, !0), document.removeEventListener("keydown", m);
    };
  }, [r, a]);
  const l = !!(t.compared || t.loading);
  return /* @__PURE__ */ _("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(Gd, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ _("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        Q,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(On, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(du, { active: e }),
      t.available ? /* @__PURE__ */ p(
        Q,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ p(is, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ p(
      Q,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || l ? "true" : void 0,
        onClick: () => {
          o((c) => !c), s(!1);
        },
        children: r ? /* @__PURE__ */ p(wt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(ls, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Vf = [
  { tool: "pen", label: "画笔", Icon: On },
  { tool: "highlighter", label: "荧光笔", Icon: cs },
  { tool: "eraser", label: "橡皮", Icon: ds }
];
function Ia(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ra({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ _(ct, { children: [
    Vf.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      Q,
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
    qo.map((o) => /* @__PURE__ */ p(
      Q,
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
    /* @__PURE__ */ p(Q, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(us, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      Q,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(fs, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      Q,
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
function Jf({ ink: e, menu: t, onClose: n }) {
  const r = N(null);
  if (D(() => {
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
  return /* @__PURE__ */ p("div", { ref: r, className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", style: { left: a, top: s }, "data-ink-menu": "true", children: /* @__PURE__ */ p(Ra, { ink: e, page: t.page, onPick: n }) });
}
function qf({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Ra, { ink: e }) }) : null;
}
function Gf(e) {
  var r;
  if (e.shiftKey || Ia(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${To}`))) return null;
  const n = Number((r = t.closest(`[${Me}]`)) == null ? void 0 : r.getAttribute(Me)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Zf(e) {
  const t = N(e);
  t.current = e, D(() => {
    const n = (r) => {
      if (Ia(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function hn() {
  try {
    return Qe().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Yf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Xf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Qf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function em({ documentId: e, jobId: t }) {
  const [n, r] = k([]), [o, a] = k(null), [s, i] = k(null), [l, c] = k(""), [d, m] = k(""), u = N(0);
  D(() => {
    r([]), i(null), m("");
    const v = hn();
    if (!v || !e) return;
    let S = !1;
    return v.list(e).then((w) => {
      S || (r(w.versions), a(w.currentVersionId));
    }).catch(() => {
    }), () => {
      S = !0;
    };
  }, [e, t]);
  const f = x((v) => {
    const S = hn(), w = n.find((b) => b.versionId === v);
    if (!S || !w || !e) return;
    const y = ++u.current;
    c(v), m(""), (async () => {
      const b = Qe(), I = await S.resolveJob(e, v);
      if (!I) throw new Error("这一份还没有能读的译文。");
      const P = await b.loadReaderPayload(I, { includeOptionalArtifacts: !0 }), M = b.resolveReaderTranslatedPdfUrl(P.jobPayload, P.manifestPayload);
      if (!M) throw new Error("这一份没有译文 PDF。");
      return { versionId: v, name: w.name, jobId: I, url: M, regions: Yf(mo(P.regionsPayload)) };
    })().then((b) => {
      y === u.current && i(b);
    }).catch((b) => {
      y === u.current && m((b == null ? void 0 : b.message) || "这一份打不开。");
    }).finally(() => {
      y === u.current && c("");
    });
  }, [e, n]), g = x(() => {
    u.current += 1, i(null), c(""), m("");
  }, []), h = x(async () => {
    var w, y;
    const v = hn();
    if (!v || !s || !e) return;
    try {
      await v.select(e, s.versionId);
    } catch (b) {
      m((b == null ? void 0 : b.message) || "换不过去，请稍后再试。");
      return;
    }
    const S = (w = globalThis.location) == null ? void 0 : w.href;
    S && ((y = globalThis.history) == null || y.replaceState(globalThis.history.state, "", Qf(S, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Xf(n, t, o),
    compared: s,
    loading: l,
    error: d,
    choose: f,
    clear: g,
    adopt: h
  };
}
const tm = "reader-finder-input";
function nm(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function rm(e, t = typeof window > "u" ? null : window) {
  D(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!nm(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(tm) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function om() {
  try {
    return Qe().translationEdit ?? null;
  } catch {
    return null;
  }
}
const am = "这本书正在处理（翻译或排版），处理完才能改。", sm = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function im({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = om(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = Yl(s), c = !t || Nt(t), d = rc(n), [m, u] = k(""), [f, g] = k(null), [h, v] = k(() => /* @__PURE__ */ new Map()), [S, w] = k(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [y, b] = k(() => /* @__PURE__ */ new Map()), [I, P] = k({ phase: "idle" }), M = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  D(() => {
    g(null), M.drafts.clear(), M.generation.current = null, b(/* @__PURE__ */ new Map()), P({ phase: "idle" });
  }, [s]), D(() => {
    if (u(""), !i || l || !a) return;
    let L = !1;
    return a.resolveOwnerJobId(s).then((j) => {
      L || u(`${j || s}`.trim() || s);
    }).catch(() => {
      L || u(s);
    }), () => {
      L = !0;
    };
  }, [i, l, a, s]), D(() => {
    if (v(/* @__PURE__ */ new Map()), !a || !m || !d || !c) return;
    let L = !1;
    return a.fetchRevisions(m).then((j) => {
      L || v(oc(j, d));
    }).catch(() => {
    }), () => {
      L = !0;
    };
  }, [a, m, d, c]);
  const z = I.phase === "running" && I.seenActive;
  D(() => {
    if (I.phase === "running") {
      if (!c) {
        z || P({ phase: "running", seenActive: !0 });
        return;
      }
      z && P(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [I.phase, z, c, t]);
  const $ = q(() => {
    const L = new Map(h);
    if (S.renderedAt === d)
      for (const [j, B] of S.edits) L.set(j, B);
    return L;
  }, [h, S, d]), F = x((L) => {
    const j = `${L || ""}`.trim();
    j && g({ itemId: j, page: Xl(j) });
  }, []), R = x(() => g(null), []), T = x((L, j) => {
    w((B) => {
      const W = new Map(B.renderedAt === d ? B.edits : []);
      return W.set(L, j), { renderedAt: d, edits: W };
    }), b((B) => new Map(B).set(L, (B.get(L) || 0) + 1));
  }, [d]), E = x(async () => {
    if (!(!a || !s || I.phase === "submitting" || I.phase === "running")) {
      P({ phase: "submitting" });
      try {
        await a.rerender(s), P({ phase: "running", seenActive: !1 }), await o();
      } catch (L) {
        P({ phase: "failed", message: (L == null ? void 0 : L.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, I.phase, o]), A = l ? sm : !c || I.phase === "running" || I.phase === "submitting" ? am : "";
  return q(() => ({
    available: i,
    blockedReason: A,
    port: a,
    ownerJobId: m,
    target: f,
    select: F,
    close: R,
    memory: M,
    pendingEdits: $,
    savedCounts: y,
    markSaved: T,
    rerender: I,
    startRerender: E
  }), [i, A, a, m, f, F, R, M, $, y, T, I, E]);
}
function lm(e, t) {
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
function cm({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ _("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      Q,
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
const Pa = "retainpdf:reader:doc-theme:v1", io = "data-reader-doc";
function Ta() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function dm(e = Ta()) {
  try {
    return (e == null ? void 0 : e.getItem(Pa)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function um(e, t = Ta()) {
  try {
    t == null || t.setItem(Pa, e);
  } catch {
  }
}
function lo(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(io, "dark") : t.removeAttribute(io));
}
function fm() {
  const [e, t] = k(() => dm());
  D(() => {
    lo(e);
  }, [e]), D(() => () => lo("light"), []);
  const n = x(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return um(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function mm(e, t) {
  return Ut(e, t.itemId) || ho(e, { page: t.page, snippet: t.quote });
}
function hm(e, t, n) {
  const r = /* @__PURE__ */ new Map();
  for (const o of t) {
    const a = mm(e, o.anchor), s = a ? gn(a, n).page : Math.floor(Number(o.anchor.page));
    if (!Number.isFinite(s) || s < 1) continue;
    const i = r.get(s) ?? [];
    i.push({
      key: o.key,
      page: s,
      itemId: (a == null ? void 0 : a.itemId) ?? null,
      tone: o.tone,
      hollow: !!o.hollow,
      label: o.label
    }), r.set(s, i);
  }
  return r;
}
const pm = /* @__PURE__ */ new Map();
function gm(e) {
  const { port: t, open: n, documentId: r, jobId: o, currentPage: a, regions: s, pane: i, jumpToAnchor: l, close: c } = e, d = q(() => {
    if (!t) return !1;
    try {
      return !!t.isAvailableFor({ documentId: r, jobId: o });
    } catch {
      return !1;
    }
  }, [t, r, o]), [m, u] = k([]), f = N(void 0);
  D(() => {
    u([]), f.current = void 0;
  }, [r, o]);
  const g = x((y, b) => {
    f.current = b, u(y);
  }, []), h = x((y) => {
    var b;
    return (b = f.current) == null ? void 0 : b.call(f, y);
  }, []), v = x((y) => l({
    ...y.itemId ? { block_id: y.itemId } : {},
    page: y.page,
    ...y.quote ? { snippet: y.quote } : {}
  }), [l]), S = q(() => n && d ? {
    documentId: r,
    jobId: o,
    currentPage: a,
    navigateToAnchor: v,
    setMarginMarkers: g,
    close: c
  } : null, [n, d, r, o, a, v, g, c]), w = q(
    () => n && d && m.length ? hm(s, m, i) : pm,
    [n, d, m, s, i]
  );
  return {
    port: t ?? null,
    available: d,
    label: (t == null ? void 0 : t.label) || "",
    api: S,
    markersByPage: w,
    selectMarker: h
  };
}
class bm extends Ma {
  constructor() {
    super(...arguments);
    ar(this, "state", { error: null, resetKey: this.props.resetKey });
  }
  static getDerivedStateFromError(n) {
    return { error: n };
  }
  static getDerivedStateFromProps(n, r) {
    return n.resetKey !== r.resetKey ? { error: null, resetKey: n.resetKey } : null;
  }
  componentDidCatch(n, r) {
    console.error("[reader] 第二栏出错", n, r.componentStack);
  }
  render() {
    return this.state.error ? /* @__PURE__ */ _("p", { className: "reader-side-pane-error", role: "alert", children: [
      "这一栏出错了：",
      this.state.error.message || "未知错误"
    ] }) : this.props.children;
  }
}
function ym({ port: e, api: t }) {
  return /* @__PURE__ */ p(
    Xu,
    {
      id: "reader-side-pane",
      open: !0,
      ariaLabel: e.label,
      className: "reader-side-pane",
      onClose: t.close,
      children: /* @__PURE__ */ p(bm, { resetKey: `${t.documentId}\0${t.jobId}`, children: e.render(t) })
    }
  );
}
const vm = Aa(() => import("./ReaderMarkdownPanel-p321VdTZ.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function wm(e) {
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
function Sm(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Im() {
  var tt, nt;
  const e = xl(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Lf(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = k(!1), d = N(null), m = N(null), u = x(() => i(null), []), f = gm({
    port: (tt = Ne()) == null ? void 0 : tt.sidePane,
    open: s === "side",
    documentId: o.documentId,
    jobId: o.jobId,
    currentPage: e.currentPage,
    regions: o.regions,
    // 开着第二栏时书只剩一栏：「译文」看译文，「原文」「对照」看原文。
    pane: e.mode === "translated" ? "translated" : "source",
    jumpToAnchor: e.jumpToAnchor,
    close: u
  }), g = s === "side" && !f.available ? null : s, h = g === "side", v = g !== null, S = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, w = wm({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: S,
    liveTranslationVisible: l,
    assistantOpen: v
  }), y = Il({
    hasOverlayContent: S,
    connection: e.liveTranslation.connection,
    showSource: w.showSource,
    liveTranslationVisible: l,
    assistantOpen: v
  }), b = w.sourceViewOnly, I = w.visibleMode;
  D(() => {
    c(!1);
  }, [e.viewStateKey]), D(() => {
    e.session.jobTerminal && c(!1);
  }, [e.session.jobTerminal]);
  const P = N(null);
  D(() => {
    P.current !== e.viewStateKey && Tl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: b,
      jobTerminal: e.session.jobTerminal
    }) && (P.current = e.viewStateKey, c(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, b]), D(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const H = $e(e.viewStateKey), se = Of({
          savedMode: H == null ? void 0 : H.mode,
          sourceViewOnly: b,
          viewportWidth: ot()
        });
        m.current = se.auto ? se.mode : null, se.mode && se.mode !== e.mode && e.setModeKeepingPage(se.mode);
        return;
      }
      zf(e.mode, m.current) && (m.current = null, nn(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, b]);
  const M = g || (e.mode === "compare" ? "compare" : "reading"), z = Ff(s, "markdown"), { docDark: $, toggleDocDark: F } = fm();
  Hl({
    toggleDocDark: F,
    mode: I,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const R = x(() => {
    i(null);
  }, []), T = Rl(e.liveTranslation), E = x(() => {
    T && e.goToPage(T, "source");
  }, [e.goToPage, T]), [A, L] = k(null);
  D(() => {
    I === "compare" && e.session.jobTerminal && L(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, I]);
  const j = A !== e.viewStateKey && El({
    state: e.liveTranslation,
    sourceViewOnly: b,
    visibleMode: I
  }), B = x((H) => {
    const se = Sm(H, e.liveTranslationAvailable);
    se !== null && c(se), e.setModeKeepingPage(H);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), W = q(() => y.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${l ? " is-active" : ""}`,
      onClick: () => c((H) => !H),
      "aria-pressed": l,
      title: l ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [y.sourcePaneToggle, l]), ee = x((H) => {
    i(H);
  }, []), [oe] = k(Bf), [J, le] = k(null), ce = x((H) => le((se) => se === H ? null : H), []), [de, xe] = k(""), [G, X] = k("");
  D(() => {
    const H = de.replace(/\s+/gu, " ").trim(), se = window.setTimeout(() => X(H), H ? 150 : 0);
    return () => window.clearTimeout(se);
  }, [de]);
  const [Re, fe] = k(0), he = x(() => {
    le("search"), fe((H) => H + 1);
  }, []);
  rm(he);
  const et = x((H) => {
    e.jumpToAnchor({ block_id: H }), (J === "outline" || ot() < 900) && le(null);
  }, [e.jumpToAnchor, J]), Ae = x((H) => e.jumpToAnchor({ block_id: H }), [e.jumpToAnchor]), pe = im({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), Ee = pe.select, te = e.setModeKeepingPage, me = o.regions, ge = x((H) => {
    lc(me, H) && (I === "source" && te("compare"), Ee(H));
  }, [me, Ee, I, te]);
  lm(pe.available ? ge : null, oe);
  const O = Yc(e.viewStateKey);
  Zf(O);
  const [Y, ne] = k(null), _e = x(() => ne(null), []), be = em({ documentId: o.documentId, jobId: o.jobId }), Le = ((nt = be.compared) == null ? void 0 : nt.url) || "";
  D(() => {
    Le && I !== "compare" && B("compare");
  }, [Le]), D(() => {
    I !== "compare" && be.clear();
  }, [I]);
  const De = q(
    () => {
      const { compared: H, versions: se, readingVersionId: C } = be;
      if (!H) return null;
      const V = se.find((Z) => Z.versionId === H.versionId), U = se.find((Z) => Z.versionId === C);
      return {
        url: H.url,
        regions: H.regions,
        left: { name: H.name, createdAt: (V == null ? void 0 : V.createdAt) || "" },
        right: { name: (U == null ? void 0 : U.name) || "当前译文", createdAt: (U == null ? void 0 : U.createdAt) || "" }
      };
    },
    [be.compared, be.versions, be.readingVersionId]
  ), Fe = q(() => {
    if (!pe.savedCounts.size) return e.revisedBlocks;
    const H = new Map(e.revisedBlocks);
    for (const [se, C] of pe.savedCounts) H.set(se, (H.get(se) || 0) + C);
    return H;
  }, [e.revisedBlocks, pe.savedCounts]), we = q(() => ({
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
    regionHover: oe,
    jumpToBlock: Ae,
    revisedBlocks: Fe,
    marginMarkers: f.markersByPage,
    selectMarginMarker: f.selectMarker,
    editBlock: pe.available ? ge : void 0,
    blockEdit: pe,
    editShowsSource: I !== "compare",
    findTerm: J === "search" ? G : "",
    compareVersion: De,
    ink: O,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: b,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: ee, close: R },
    docDark: $,
    toggleDocDark: F
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
    oe,
    Ae,
    Fe,
    f.markersByPage,
    f.selectMarker,
    pe,
    ge,
    I,
    J,
    G,
    De,
    O,
    e.sourceOnly,
    b,
    e.download,
    e.goToPage,
    ee,
    R,
    $,
    F
  ]), Pe = q(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Be = [
    fi,
    `is-workspace-${M}`,
    v ? "is-assistant-open" : "",
    J ? "is-finder-open" : "",
    w.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(ld, { value: we, hud: Pe, children: /* @__PURE__ */ _(
    "div",
    {
      className: Be,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": M,
      "data-ink-mode": O.tool || void 0,
      onContextMenu: (H) => {
        const se = Gf(H);
        se && (H.preventDefault(), ne(se));
      },
      children: [
        /* @__PURE__ */ p(ef, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(Hf, { open: J, onToggle: ce }),
        J ? /* @__PURE__ */ p(
          Wf,
          {
            tab: J,
            onTab: le,
            onClose: () => le(null),
            onJump: et,
            query: de,
            onQuery: xe,
            term: G,
            focusSignal: Re
          }
        ) : null,
        /* @__PURE__ */ _("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(df, {}),
          /* @__PURE__ */ p(Gl, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          au,
          {
            mode: I,
            documentReady: !!o.jobId,
            sourceViewOnly: b,
            onModeChange: (H) => {
              h && u(), B(H);
            },
            sidePane: f.available ? {
              label: f.label,
              active: h,
              onSelect: () => i("side")
            } : null,
            liveTranslation: y.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((H) => !H),
              latestPage: l ? T : null,
              currentPage: e.currentPage,
              onJumpToLatest: E
            } : null,
            completion: j ? {
              onOpenCompare: () => {
                L(e.viewStateKey), B("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(uu, { active: h ? null : g }),
        v ? /* @__PURE__ */ p(Yu, {}) : null,
        /* @__PURE__ */ p(tu, { paneComposition: w, markdownSplit: z.open, assistantSplit: v, liveTranslation: e.liveTranslation, sourcePaneAction: W }),
        e.showHud ? /* @__PURE__ */ p(
          Af,
          {
            mode: I,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(Uf, { open: J, onToggle: ce })
          }
        ) : null,
        /* @__PURE__ */ p(Na, { fallback: null, children: z.mounted ? /* @__PURE__ */ p(vm, { open: z.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: R }) : null }),
        h && f.port && f.api ? /* @__PURE__ */ p(ym, { port: f.port, api: f.api }) : null,
        /* @__PURE__ */ p(Kf, { active: h ? null : g, compare: be, ink: O }),
        /* @__PURE__ */ p(Jf, { ink: O, menu: Y, onClose: _e }),
        /* @__PURE__ */ p(qf, { ink: O }),
        /* @__PURE__ */ p(cm, { edit: pe }),
        /* @__PURE__ */ p(xf, {})
      ]
    }
  ) });
}
function jm() {
  return /* @__PURE__ */ p(Im, {});
}
export {
  jm as R,
  Im as a,
  Xu as b,
  Fm as d,
  $m as f,
  Bm as r,
  Je as u
};
//# sourceMappingURL=ReaderApp-Dql8zQSq.js.map
