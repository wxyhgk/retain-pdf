var wr = (e) => {
  throw TypeError(e);
};
var Sr = (e, t, n) => t.has(e) || wr("Cannot " + n);
var xt = (e, t, n) => (Sr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), kr = (e, t, n) => t.has(e) ? wr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Ir = (e, t, n, r) => (Sr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as _, jsx as p, Fragment as yt } from "react/jsx-runtime";
import { useMemo as V, useState as T, useEffect as D, useCallback as C, useRef as M, useLayoutEffect as Ee, memo as pn, createContext as qn, useContext as Gn, forwardRef as To, useImperativeHandle as Xn, useSyncExternalStore as Mo, useId as No, Suspense as Va, lazy as Ja } from "react";
import { requireAdapter as _t, getReaderAdapters as ze } from "./adapters.js";
import { resolveReaderDownloadName as qa, resolveReaderDownloadUrls as Ga, READER_PROGRESS_COPY as Je, trimString as an, READER_DOWNLOAD_ACTIONS as Xa, disabledReason as Za } from "./runtime/state.js";
import { r as Ya, b as Qa } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as An, isFinishedJobStatus as Wt } from "@retainpdf/domain/job";
import { n as Ao, d as es, f as vn, k as Rr, b as ts, c as ns, j as _e, p as Xt, g as rs, l as sn, i as os } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as as } from "@retainpdf/api/documents";
import { isReaderTransportError as ss, createReaderTransportError as is } from "./contracts.js";
import { X as vt, PenLine as Zn, ZoomIn as ls, Check as Lo, Copy as cs, ChevronUp as us, ChevronDown as _o, History as ds, LoaderCircle as fs, Pin as ms, LogOut as hs, FileText as xo, Columns2 as Do, Languages as Co, Radio as ps, ArrowDownToLine as gs, CheckCircle2 as bs, Keyboard as ys, Download as vs, ListOrdered as ws, TriangleAlert as Ss, ChevronRight as zo, ListTree as ks, Search as Is, GitCompareArrows as Rs, LayoutGrid as Es, Highlighter as Ps, Eraser as Ts, Undo2 as Ms, Trash2 as Ns, ChevronLeft as As, Minus as Ls, Plus as _s, ArrowLeft as xs } from "lucide-react";
import { Button as Z, Textarea as Ds, IconButton as mt, Input as Oo } from "@retainpdf/ui";
import { toast as Ln, Toaster as Cs } from "sonner";
import { pdfjs as $o, Page as zs, Document as Os } from "react-pdf";
import { e as $s, m as Fs, a as Bs } from "./markdown-math-XkF5urpn.js";
const js = (...e) => {
  var t, n;
  return ((n = (t = ze()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Hs = "", Us = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Ws = (e) => {
  var t, n;
  return ((n = (t = ze()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Lh = (...e) => {
  var n;
  return (((n = ze()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, qe = () => _t("defaultReaderDataPort"), Er = () => _t("defaultReaderPageConfigPort"), _h = {
  get apiPrefix() {
    return qe().apiPrefix;
  },
  fetchProtected: (...e) => qe().fetchProtected(...e),
  loadMarkdownPayload: (e) => qe().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => qe().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => qe().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => qe().loadJobPayload(e),
  loadReaderPayload: (e, t) => qe().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => qe().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return qe().liveTranslation;
  }
}, Fo = {
  messageTargetOrigin: () => Er().messageTargetOrigin(),
  readerJobId: () => Er().readerJobId()
}, Ks = () => {
  var e;
  return ((e = ze()) == null ? void 0 : e.liveTranslation) ?? null;
}, Kt = () => {
  var t;
  const e = ze();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, lt = () => {
  const e = ze();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => _t("fetchDocumentByJobId")(...n),
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
}, Vs = (...e) => {
  var t, n;
  return ((n = (t = ze()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Js = () => {
  var e, t;
  return ((t = (e = ze()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, qs = (...e) => {
  var t, n;
  return ((n = (t = ze()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Gs = (...e) => {
  var t, n;
  return ((n = (t = ze()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? qa(...e);
}, Xs = (...e) => {
  var t, n;
  return ((n = (t = ze()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Ga(...e);
}, Zs = (...e) => _t("downloadProtectedResource")(...e), Ys = (...e) => _t("failDownloadToast")(...e), xh = (e, t) => _t("resolveMarkdownAssetUrl")(e, t), Pr = "/api/v1";
function Qs() {
  const e = () => {
    var r;
    return Ya(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = T(e);
  return D(() => {
    var i, l, c, u;
    const r = () => n(e()), o = (l = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : l.bind(globalThis.history), a = (u = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (d) => function(...h) {
          const g = d.apply(this, h);
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
function ei() {
  const e = Qs(), t = V(() => qs(Fo), [e]), n = V(() => Js(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function ti(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [l, c] = T({
    documentId: "",
    jobId: ""
  }), [u, f] = T({
    documentId: "",
    jobId: ""
  }), d = l.documentId === t ? l.jobId : "", h = u.documentId === t ? u.jobId : "", g = n || d, [m, y] = T({
    jobId: "",
    documentId: ""
  }), w = m.jobId === g ? m.documentId : "", S = t || w, b = !!t && !g, [v, k] = T(null), P = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, A = b || !!P, z = C((N) => {
    const I = `${N.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const R = `${N.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: R,
      sessionIdentity: o.current
    }), i();
  }, []);
  D(() => {
    k((N) => N && N.sessionIdentity !== r ? null : N);
  }, [r]);
  const F = C((N) => {
    switch (N.type) {
      case "resolved-document-job":
        c({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "resolved-job-document":
        y((I) => I.jobId === N.jobId && I.documentId === N.documentId ? I : { jobId: N.jobId, documentId: N.documentId });
        break;
      case "committed-source":
        k({
          documentId: N.documentId,
          revision: N.revision,
          sessionIdentity: N.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: l,
    setResolvedDocumentJob: c,
    missingDocumentJob: u,
    setMissingDocumentJob: f,
    documentJobId: d,
    rejectedDocumentJobId: h,
    sessionJobId: g,
    resolvedJobDocument: m,
    setResolvedJobDocument: y,
    jobDocumentId: w,
    documentId: S,
    sourceOnly: b,
    committedDocumentSource: v,
    setCommittedDocumentSource: k,
    activeCommittedDocumentSource: P,
    sourceViewOnly: A,
    refreshCommittedDocument: z,
    applyIdentityEvent: F
  };
}
function Tr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function ni(e) {
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
function Mr(e, t) {
  return Ws(An(e, t));
}
function ri(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function oi(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !ri(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function _n({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Us.progress,
        stage: n,
        percent: e,
        text: t
      },
      Fo.messageTargetOrigin()
    );
  } catch {
  }
}
function ln(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), _n({ percent: t, text: n, stage: r });
}
function ai(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = T(null), [c, u] = T(null), [f, d] = T(""), [h, g] = T(0), m = f === n ? i : null, y = f === n ? c : null, w = Tr(m), S = Wt(w), b = C(() => {
    g((F) => F + 1);
  }, []), v = C((F) => {
    l(F.jobPayload), u(F.manifestPayload), d(F.sessionIdentity);
  }, []), k = C((F) => {
    l(null), u(null), d(F);
  }, []), P = M(""), A = M(""), z = C(async () => {
    const F = o.current;
    if (!F || P.current === F) return;
    const N = lt().loadJobPayload;
    if (typeof N != "function") return;
    const I = a.current.value;
    P.current = F;
    try {
      const R = await N(F);
      if (s.current || a.current.value !== I || o.current !== F || !R || typeof R != "object")
        return;
      const E = Tr(R);
      l(R), d(r.current), !Wt(E) && A.current === F && (A.current = ""), E === "succeeded" && A.current !== F && (A.current = F, g((L) => L + 1));
    } catch {
    } finally {
      P.current === F && (P.current = "");
    }
  }, []);
  return D(() => {
    A.current = "";
  }, [n]), D(() => {
    if (!t || S || !m) return;
    const F = window.setInterval(() => {
      document.visibilityState !== "hidden" && z();
    }, 1e3);
    return () => window.clearInterval(F);
  }, [S, z, m, t]), {
    jobPayload: i,
    setJobPayload: l,
    manifestPayload: c,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: m,
    scopedManifestPayload: y,
    jobStatus: w,
    jobTerminal: S,
    jobRefreshRevision: h,
    refreshJobArtifacts: b,
    refreshJobStatus: z,
    publishPayload: v,
    clearPayload: k
  };
}
function xn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function si(e, t) {
  e(t), xn(t);
}
function ii(e) {
  const [t, n] = T(e ? "source" : "compare"), r = C((a) => {
    e && a !== "source" || (n(a), xn(a));
  }, [e]), o = C((a) => {
    si(n, a);
  }, []);
  return D(() => (e && document.documentElement.classList.add("reader-source-only"), xn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Nr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function li(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Nr(n.active_job_id),
    activeVersionId: Nr(n.active_version_id)
  };
}
function ci(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function ui(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function di(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const fi = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function mi(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = fi.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const hi = 48 * 1024 * 1024;
function pi(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const gi = 2, Ae = /* @__PURE__ */ new Map();
function Dn(e, t) {
  Ae.delete(e), Ae.set(e, t);
}
function Ar(e) {
  if (Ae.size < gi) return;
  const t = Ae.keys().next().value;
  t && Ae.delete(t);
}
async function bi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Bo(e, t = Kt().fetchProtected, n = {}) {
  var u, f, d, h, g, m, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Ae.has(r)) {
    const b = Ae.get(r);
    return Dn(r, b), b;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (d = (f = n.signal) == null ? void 0 : f.addEventListener) == null || d.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (h = n.signal) == null ? void 0 : h.removeEventListener) == null || g.call(h, "abort", a);
  }
  if (!s.ok) {
    const b = new Error(`读取 PDF 失败 (${s.status})`);
    b.status = s.status;
    const v = await bi(s);
    throw v && (b.reason = v), b;
  }
  const i = yi(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Ar(), Ae.set(r, b), b;
  }
  (y = (m = n.signal) == null ? void 0 : m.addEventListener) == null || y.call(m, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return Ae.has(r) ? Dn(r, c) : (Ar(), Ae.set(r, c)), c;
}
function yi(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < hi ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const vi = { file: null, loading: !1, error: "" }, wi = { file: null, loading: !0, error: "" };
function Si(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = T(null);
  if (D(() => {
    if (t || !n) return;
    const s = Ae.get(n);
    if (s) {
      Dn(n, s);
      return;
    }
    const i = new AbortController();
    return Bo(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return vi;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Ae.get(n);
  return a ? { file: a, loading: !1, error: "" } : wi;
}
function ki(e) {
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
async function Cn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  ln(s, r, n, "download");
  const i = await Bo(t, Kt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (ln(s, o, n, "download"), i);
}
async function Ii(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  ln(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Cn({
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
    Cn({
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
function Ri(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ei({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = as,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Ri(o.href, t, a)), !0);
}
const Yt = {
  regions: null,
  metadata: null
};
function Pi(e) {
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
    applyIdentityEvent: u,
    publishPayload: f,
    clearPayload: d,
    switchSessionMode: h,
    jobRefreshRevision: g,
    sessionEpochRef: m,
    closingRef: y,
    activeLoadAbortRef: w
  } = e, [S, b] = T(""), [v, k] = T(""), [P, A] = T(null), [z, F] = T(null), [N, I] = T(!1), [R, E] = T(""), [L, x] = T([]), [j, $] = T(!1), [J, X] = T(() => ({
    source: null,
    translated: null
  })), [re, oe] = T(
    Yt
  ), [ce, ue] = T({
    loading: !0,
    percent: 4,
    text: Je.boot,
    stage: "progress",
    failed: !1
  });
  return D(() => {
    const le = new AbortController(), xe = m.current.value, ee = ki({
      sessionEpochRef: m,
      closingRef: y,
      abort: le,
      sessionEpoch: xe
    });
    w.current = le;
    const te = lt();
    if (y.current)
      return le.abort(), () => {
        w.current === le && (w.current = null);
      };
    let me = !1;
    function be(ne, de) {
      ee.markFailed(), $(!0), ue({
        loading: !1,
        percent: 100,
        text: ne,
        stage: "failed",
        failed: !0
      }), _n({ percent: 100, text: de, stage: "failed" });
    }
    function ye() {
      I(!0), me || $(!0), ue({
        loading: !1,
        percent: 100,
        text: Je.ready,
        stage: "ready",
        failed: !1
      }), _n({ percent: 100, text: Je.ready, stage: "ready" });
    }
    function pe() {
      return c != null && c.documentId ? Mr(
        c.documentId,
        c.revision
      ) : js() ? Hs : te.resolveResourceUrl(An(r));
    }
    async function He() {
      var Q;
      let ne = { activeJobId: "", activeVersionId: "" };
      try {
        const fe = await ((Q = te.fetchDocument) == null ? void 0 : Q.call(te, r));
        fe && (ne = li(fe));
      } catch {
      }
      const de = ci({
        link: ne,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (de.kind === "follow-active-job") {
        if (ee.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: de.jobId
        }), de.activeVersionId ? (c || u({
          type: "committed-source",
          documentId: r,
          revision: de.activeVersionId,
          sessionIdentity: l
        }), h("source")) : h("compare");
        return;
      }
      if (de.kind === "open-committed-source") {
        if (ee.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: de.revision,
          sessionIdentity: l
        }), h("source");
        return;
      }
      const B = pe();
      if (ee.isInactive()) return;
      b(B), k(""), E(""), d(l);
      const q = await Cn({
        url: B,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ee,
        setBoot: ue
      });
      if (!ee.isInactive()) {
        if (!q) {
          be("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        A(q), ye();
      }
    }
    async function ct() {
      var ut;
      const ne = !c, de = !!(ne && te.loadSessionSnapshot && te.loadReaderOptionalArtifacts), B = de ? te.loadReaderOptionalArtifacts(t) : null, q = await ((ut = te.loadSessionSnapshot) == null ? void 0 : ut.call(te, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: ne && !de
      })), Q = q ? {
        jobPayload: q.sourcePayload,
        manifestPayload: q.manifestPayload,
        readerMetadata: q.readerMetadata,
        regionsPayload: q.regions,
        readerErrors: q.readerErrors
      } : await te.loadReaderPayload(t, {
        includeOptionalArtifacts: ne
      });
      if (ee.isInactive()) return;
      let fe = null;
      if (n && !r)
        if (q && q.linkedDocument !== void 0)
          fe = q.linkedDocument;
        else {
          try {
            fe = await te.fetchDocumentByJobId(Pr, t);
          } catch {
          }
          if (ee.isInactive()) return;
        }
      const Pe = ni(Q.jobPayload) || `${(fe == null ? void 0 : fe.document_id) || ""}`.trim();
      Pe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Pe
      });
      const Te = ui({
        payloadDocumentId: Pe,
        linkedActiveJobId: `${(fe == null ? void 0 : fe.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(fe == null ? void 0 : fe.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (Te.kind === "restore-committed-source") {
        if (ee.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Te.documentId,
          revision: Te.revision,
          sessionIdentity: l
        }), h("source");
        return;
      }
      const Ie = te.resolveReaderSourcePdf(Q.manifestPayload), Ue = te.resolveReaderTranslatedPdfUrl(Q.jobPayload, Q.manifestPayload), Re = typeof Ie == "string" ? Ie : te.resolveReaderArtifactUrl(Ie), We = r || Pe, we = c != null && c.documentId ? Mr(
        c.documentId,
        c.revision
      ) : Re || (We ? te.resolveResourceUrl(An(We)) : ""), Me = c ? "" : Ue || "";
      b(we || ""), k(Me), E(oi(Q.jobPayload, t)), f({
        jobPayload: Q.jobPayload || null,
        manifestPayload: Q.manifestPayload || null,
        sessionIdentity: l
      });
      const Oe = () => Ii({
        sourceFinal: we || "",
        translatedFinal: Me,
        fence: ee,
        setBoot: ue
      }), Ke = !!(we || Me), $e = B && Ke ? Oe() : null;
      $e == null || $e.catch(() => {
      });
      const Ne = (O) => {
        ee.isInactive() || (x(c ? [] : Ao(O.regionsPayload)), X(c ? { source: null, translated: null } : es(O.readerMetadata)), oe(c ? Yt : O.readerErrors ?? Yt), $(!0));
      };
      if (B ? (me = !0, B.then(Ne)) : Ne(Q), !Ke) {
        be(Je.failed, Je.failed);
        return;
      }
      const et = await ($e ?? Oe());
      if (et.status !== "inactive") {
        if (et.status === "incomplete") {
          be("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        A(et.sourceBytes), F(et.translatedBytes), ye();
      }
    }
    async function De() {
      I(!1), A(null), F(null), x([]), $(!1), X({ source: null, translated: null }), oe(Yt), ln(ue, 8, Je.metadata, "metadata");
      try {
        if (s) {
          await He();
          return;
        }
        if (!t) {
          be(Je.failed, Je.failed);
          return;
        }
        await ct();
      } catch (ne) {
        if (ee.isClosedOrStale() || (ne == null ? void 0 : ne.name) === "AbortError") return;
        ee.markFailed();
        const de = Number(ne == null ? void 0 : ne.status), B = `${(ne == null ? void 0 : ne.reason) || ""}`, q = mi({ status: de, reason: B, sessionJobId: t });
        if (q && (await Ei({
          apiPrefix: Pr,
          documentId: q,
          expiredJobId: t
        }) || ee.isClosedOrStale()))
          return;
        if (di({
          status: de,
          reason: B,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const Q = ne instanceof Error ? ne.message : Je.failed;
        be(Q, Q);
      }
    }
    return De(), () => {
      le.abort(), w.current === le && (w.current = null);
    };
  }, [t, r, o, a, s, i, c, g, n, l, u, f, d, h]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: P,
    translatedFile: z,
    assetsReady: N,
    title: R,
    regions: L,
    regionsSettled: j,
    readerMetadata: J,
    readerErrors: re,
    boot: ce
  };
}
function Ti() {
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = ei(), s = M({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = M(a), l = M(""), c = M(""), u = M(() => {
  }), f = C(() => u.current(), []), d = ti({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: l,
    sessionJobIdRef: c,
    switchToSourceMode: f
  }), {
    sessionJobId: h,
    documentId: g,
    sourceOnly: m,
    sourceViewOnly: y
  } = d, { mode: w, setMode: S, switchSessionMode: b } = ii(y);
  u.current = () => {
    b("source");
  }, i.current = a, l.current = g, c.current = h;
  const v = ai({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: P,
    jobStatus: A,
    jobTerminal: z,
    jobRefreshRevision: F,
    refreshJobArtifacts: N,
    refreshJobStatus: I
  } = v, R = Pi({
    sessionJobId: h,
    jobId: r,
    routeDocumentId: o,
    documentJobId: d.documentJobId,
    rejectedDocumentJobId: d.rejectedDocumentJobId,
    sourceOnly: m,
    locationKey: n,
    sessionIdentity: a,
    committedSource: d.activeCommittedDocumentSource,
    applyIdentityEvent: d.applyIdentityEvent,
    publishPayload: v.publishPayload,
    clearPayload: v.clearPayload,
    switchSessionMode: b,
    jobRefreshRevision: F,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = C(() => {
    var x;
    e.current = !0, (x = t.current) == null || x.abort();
  }, []), L = V(
    () => ({
      fetchProtected: lt().fetchProtected,
      jobId: h,
      jobPayload: k,
      manifestPayload: P,
      sourceUrl: R.sourceUrl,
      translatedUrl: R.translatedUrl,
      sourceOnly: y
    }),
    [h, k, P, R.sourceUrl, R.translatedUrl, y]
  );
  return {
    jobId: h,
    jobStatus: A,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: z,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: m,
    mode: w,
    setMode: S,
    sourceUrl: R.sourceUrl,
    translatedUrl: R.translatedUrl,
    sourceFile: R.sourceFile,
    translatedFile: R.translatedFile,
    assetsReady: R.assetsReady,
    boot: R.boot,
    title: R.title,
    regions: R.regions,
    regionsSettled: R.regionsSettled,
    readerMetadata: R.readerMetadata,
    readerErrors: R.readerErrors,
    download: L,
    refreshJobArtifacts: N,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: E
  };
}
const Mi = 160, Ni = 8, Ai = 0;
function Li() {
  const e = M(null), [t, n] = T(null), [r, o] = T(Ai), a = C((s) => {
    e.current = s, n(s);
  }, []);
  return D(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < Mi || o((u) => Math.abs(u - c) < Ni ? u : c);
    }, l = new ResizeObserver((c) => {
      var u, f;
      i(((f = (u = c[0]) == null ? void 0 : u.contentRect) == null ? void 0 : f.width) ?? s.clientWidth);
    });
    return l.observe(s), i(s.clientWidth), () => l.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function _i(e) {
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
const wn = { source: 0, translated: 0 };
function xi(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: l
  } = e, c = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = M(c);
  u.current = c;
  const [f, d] = T(() => ({
    identity: c,
    pages: wn
  })), [h, g] = T(() => ({ identity: c, tick: 0 })), m = f.identity === c ? f.pages : wn, y = h.identity === c ? h.tick : 0, w = _i({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: S } = w, b = C((I, R) => {
    u.current === c && d((E) => {
      const L = E.identity === c ? E.pages : wn;
      return L[R] === I && E.identity === c ? E : {
        identity: c,
        pages: { ...L, [R]: I }
      };
    });
  }, [c]), v = M(null), k = C(() => {
    v.current && clearTimeout(v.current);
    const I = c;
    v.current = setTimeout(() => {
      v.current = null, u.current === I && g((R) => ({
        identity: I,
        tick: R.identity === I ? R.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  D(() => (v.current && (clearTimeout(v.current), v.current = null), d((I) => I.identity === c && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: c, pages: { source: 0, translated: 0 } }), g((I) => I.identity === c && I.tick === 0 ? I : { identity: c, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [c]);
  const P = V(
    () => Math.max(m.source, m.translated),
    [m]
  ), A = S === "translated" ? m.translated : m.source || m.translated, z = t == null ? void 0 : t.userZoom, F = t == null ? void 0 : t.shellWidth, N = `${c}-${y}-${z}-${n}-${m.source}-${m.translated}-${F}`;
  return {
    ...w,
    numPagesByPane: m,
    hudNumPages: P,
    primaryNumPages: A,
    metricsTick: y,
    onNumPages: b,
    onMetrics: k,
    rowSyncRevision: N
  };
}
const Le = "data-reader-page", ke = "data-reader-pane", Yn = "data-natural-height", Di = "reader-react-root", jo = "reader-react-grid", Ho = "reader-react-scroll-shell", gn = "reader-react-pdf-pane", Uo = "reader-react-pdf-page", cn = "reader-react-pdf-page-placeholder", Qn = "reader-react-pdf-page-slot";
function un(e, t) {
  const n = e != null ? `[${Le}="${e}"]` : `[${Le}]`;
  return t ? `${n}[${ke}="${t}"]` : n;
}
function er() {
  return `.${Qn}[${Le}]`;
}
function dn(e) {
  return Number(e.getAttribute(Le));
}
const Wo = 0.25, fn = 1, Ci = 0.05, Zt = 0.5, zi = 16, Oi = 8, Ko = zi + Oi, $i = 720;
function at() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Vo(e) {
  return Number.isFinite(e) && e < $i;
}
function Pt(e, t = Number.POSITIVE_INFINITY) {
  return Vo(t) && (e === "source" || e === "translated") ? fn : Zt;
}
function Ze(e) {
  return Number.isFinite(e) ? Math.min(fn, Math.max(Wo, e)) : Zt;
}
function Vt(e, t) {
  const n = Ze(Number(e) + t * Ci);
  return Math.round(n * 100) / 100;
}
function Fi(e) {
  return Math.round(Ze(e) * 100);
}
function Jo(e) {
  const n = (Number(e) || 0) - Ko;
  return Math.max(160, Math.floor(n));
}
function Bi(e, t = Zt) {
  const n = Ze(t);
  return Jo((Number(e) || 0) * n);
}
function ji(e, t) {
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
const Hi = 8;
function Ui(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Hi ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const qo = 200, Go = [
  "markdown"
], Wi = Go;
function Xo(e) {
  return Wi.includes(e);
}
const Ki = "retainpdf:reader:view:v1:", Lr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Vi = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Zo() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function zn(e) {
  return `${e || ""}`.trim();
}
function Ji({
  documentId: e,
  jobId: t
}) {
  const n = zn(e);
  if (n) return `document:${n}`;
  const r = zn(t);
  return r ? `job:${r}` : "";
}
function Yo(e) {
  const t = zn(e);
  return t ? `${Ki}${t}` : "";
}
function qi(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Gi(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Lr.has(t) || !Lr.has(n) || t === n))
    return { left: t, right: n };
}
function Xi(e) {
  return e === null ? null : Xo(e) ? e : void 0;
}
function Zi(e) {
  return Vi.has(e) ? e : void 0;
}
function Qo(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = qi(t.anchor), r = Number(t.zoom), o = Zi(t.mode), a = Gi(t.splitLayout), s = Xi(t.assistantPanel);
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
function je(e, t = Zo()) {
  const n = Yo(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Qo(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function bn(e, t, n = Zo()) {
  const r = Yo(e);
  if (!r || !n) return null;
  const o = je(e, n), a = Qo({
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
function Yi(e, t, n = "") {
  var d;
  const [r, o] = T(() => {
    var h;
    return ((h = je(n)) == null ? void 0 : h.zoom) ?? Pt(e, at());
  }), a = M(r), s = M(n);
  a.current = r;
  const i = M(1), l = M(((d = je(n)) == null ? void 0 : d.zoom) !== void 0);
  D(() => {
    var m;
    if (s.current === n) return;
    s.current = n;
    const h = (m = je(n)) == null ? void 0 : m.zoom;
    l.current = h !== void 0;
    const g = h ?? Pt(e, at());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), D(() => {
    if (l.current) return;
    const h = Pt(e, at()), g = a.current;
    Math.abs(h - g) < 5e-4 || (i.current = 1, a.current = h, o(h));
  }, [e]);
  const c = C((h, g) => {
    const m = Ze(h), y = a.current;
    Math.abs(m - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : m / (y || 1), a.current = m, l.current = !0, bn(s.current, { zoom: m }), o(m));
  }, []), u = C((h) => {
    c(Vt(a.current, h));
  }, [c]), f = C((h) => {
    c(Pt(h));
  }, [c]);
  return Ee(() => {
    const h = i.current;
    Math.abs(h - 1) < 1e-3 || (i.current = 1, ji(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: u, resetZoom: f };
}
const Qi = 160, el = 3e-3, _r = 50, tl = 16, nl = 800;
function rl(e, t = 0) {
  const n = t === 1 ? tl : t === 2 ? nl : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-_r, Math.min(_r, r));
  return Math.exp(-o * el);
}
function ol(e, t, n = 0) {
  return Ze(e * rl(t, n));
}
function al(e) {
  return Math.round(Ze(e) * 100) / 100;
}
function sl(e, t, n) {
  const r = Ze(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ze(t) / r;
  const a = (o + Ko) / r;
  return Jo(a * Ze(t)) / o;
}
function il(e) {
  return Array.from(e.querySelectorAll(er()));
}
function ll(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function cl(e, t, n) {
  let r = null;
  for (const s of il(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const l = ll(i, t, n);
    if ((!r || l < r.distance) && (r = { el: s, rect: i, distance: l }), l === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Le) || "",
    pane: o.getAttribute(ke) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function ul(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ea(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${er()}[${Le}="${t.page}"][${ke}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (ul(n, e).scrollLeft += a);
}
function dl(e, t, n, r) {
  const o = e.querySelector(`.${jo}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function Dt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const fl = 600, ml = 1e3;
function hl(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ea(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || c();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const l = r.setTimeout(() => c(), ml);
  function c() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(l);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return c;
}
function pl(e, t, n) {
  const r = M(t);
  r.current = t;
  const o = M(n);
  o.current = n;
  const a = M(null), s = M(null), i = M(null);
  D(() => {
    if (!e) return;
    const l = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = al(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Dt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Dt(d.grid));
      }, fl), s.current = d, o.current(f, { keepScroll: !1 });
    }, c = (u) => {
      var h, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (h = i.current) == null || h.call(i), i.current = null;
        const m = s.current;
        m && (m.fallback && clearTimeout(m.fallback), s.current = null, Dt(m.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: cl(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = ol(f.target, u.deltaY, u.deltaMode);
      const d = sl(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = dl(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(l, Qi);
    };
    return e.addEventListener("wheel", c, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", c);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Dt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Ee(() => {
    var c;
    const l = s.current;
    l && (s.current = null, l.fallback && clearTimeout(l.fallback), Dt(l.grid), !(!e || !l.anchor) && (ea(e, l.anchor), (c = i.current) == null || c.call(i), i.current = hl(e, l.anchor)));
  }, [t, e]);
}
function gl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: C((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const tr = 48;
function ta(e, t = tr) {
  return e.getBoundingClientRect().top + t;
}
function na(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const l of e) {
    const c = l.getBoundingClientRect();
    c.height < 8 || c.width < 8 || c.top <= t + 1 && c.top >= r && (n = l, r = c.top);
  }
  if (!n && (n = e.find((c) => {
    const u = c.getBoundingClientRect();
    return u.height >= 8 && u.width >= 8;
  }) ?? null, n)) {
    const c = [...e].reverse().find((u) => {
      const f = u.getBoundingClientRect();
      return f.height >= 8 && f.width >= 8;
    });
    c && c.getBoundingClientRect().bottom < t && (n = c);
  }
  if (!n)
    return null;
  const o = dn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Ht(e, t, n = tr) {
  if (!e)
    return null;
  const r = un(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = ta(e, n), i = na(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function At(e, t, n = "auto", r, o = tr) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(un(a, r))), i || (i = e.querySelector(un(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function bl(e, t, n = "smooth", r) {
  return At(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function On(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var u;
    if (a) return;
    At(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (u = n == null ? void 0 : n.onDone) == null || u.call(n));
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
function yl(e, t, n) {
  return On(
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
function Ce(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function vl(e, t, n = !0, r = "", o) {
  const [a, s] = T(1);
  return D(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let l = !1, c = null, u = 0;
    const f = un(void 0, o), d = () => {
      if (l) return;
      const m = Array.from(i.querySelectorAll(f));
      if (!m.length)
        return;
      const y = ta(i), w = na(m, y);
      w && s(w.page);
    }, h = () => {
      l || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, d();
      }));
    }, g = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        c = setTimeout(g, 120);
        return;
      }
      d(), i.addEventListener("scroll", h, { passive: !0 });
    };
    return g(), () => {
      l = !0, c && clearTimeout(c), u && cancelAnimationFrame(u), i.removeEventListener("scroll", h);
    };
  }, [e, t, n, r, o]), a;
}
const wl = `canvas, .react-pdf__Page, .${Uo}, .${cn}`, xr = /* @__PURE__ */ new WeakMap();
function Sl(e) {
  const t = Number(e.getAttribute(Yn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = xr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(wl), xr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function kl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Il(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(er()).forEach((r) => {
    const o = dn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Sl(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Rl(e, t, n = "", r) {
  const [o, a] = T(() => /* @__PURE__ */ new Map()), s = M(o), i = M(r);
  return i.current = r, Ee(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, u = !1, f = !1;
    const d = () => {
      var k;
      if (l) return;
      const b = e.current;
      if (!b) return;
      const v = Il(b);
      kl(s.current, v) || (s.current = v, a(v)), u && !f && (f = !0, (k = i.current) == null || k.call(i));
    }, h = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    h();
    const g = window.setTimeout(h, 100), m = window.setTimeout(() => {
      u = !0, h();
    }, 300), y = window.setTimeout(h, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => h()), S.observe(w)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(g), window.clearTimeout(m), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const El = [0, 48, 140, 320, 560], Pl = 700, Tl = [80, 200, 400], Ml = 500, Nl = 50, Al = /* @__PURE__ */ new Set([
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
]), Ll = 180, Dr = [0, 48, 140, 320, 700, 1200];
function _l(e, t) {
  var R;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = M(
    ((R = je(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
  ), l = M(null), c = M(!1), u = M(r), f = M(null), d = M(null), h = M(null), g = M(null), m = M(a), y = M(""), w = M(n);
  w.current = n;
  const S = C(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = C(() => {
    !c.current && l.current == null || (S(), h.current != null && (clearTimeout(h.current), h.current = null), l.current = null, c.current = !1);
  }, [S]), v = C((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const L = () => {
      g.current = null, bn(m.current, {
        anchor: Ce(i.current)
      });
    };
    E ? L() : g.current = setTimeout(L, Ll);
  }, []), k = C((E) => {
    i.current = Ce(E), l.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, c.current = !1;
    }, Nl);
  }, []);
  D(() => {
    if (!o)
      return;
    let E = !1, L = null, x = null, j = null;
    const $ = () => {
      if (E) return;
      const J = e.current;
      if (!J) {
        j = setTimeout($, 50);
        return;
      }
      L = J, x = () => {
        if (c.current)
          return;
        const X = Ht(L, w.current);
        X && (i.current = X, v());
      }, L.addEventListener("scroll", x, { passive: !0 }), c.current || x();
    };
    return $(), () => {
      E = !0, j != null && clearTimeout(j), L && x && L.removeEventListener("scroll", x);
    };
  }, [o, r, n, e, v]), D(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const L = (x) => {
      x.metaKey || x.ctrlKey || x.altKey || Al.has(x.key) && b();
    };
    return E.addEventListener("wheel", b, { passive: !0 }), E.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", L), () => {
      E.removeEventListener("wheel", b), E.removeEventListener("touchmove", b), window.removeEventListener("keydown", L);
    };
  }, [o, e, b]), Ee(() => {
    var L;
    if (m.current === a) return;
    v(!0), S(), h.current != null && (clearTimeout(h.current), h.current = null), m.current = a, y.current = "";
    const E = (L = je(a)) == null ? void 0 : L.anchor;
    i.current = E ? Ce(E) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, u.current = r;
  }, [a, r, v, S]), D(() => {
    var L;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const E = Ce(
      ((L = je(a)) == null ? void 0 : L.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, l.current = E, c.current = !0, S(), f.current = On(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: Dr,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Math.max(...Dr) + 160), () => S();
  }, [o, s, a, e, k, S]), D(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      c.current = !1, l.current = null, S();
      return;
    }
    const E = l.current ? Ce(l.current) : Ce(i.current);
    return c.current = !0, l.current = E, i.current = E, S(), f.current = On(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: El,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Pl), () => {
      S();
    };
  }, [r, o, n, e, k, S]), D(() => () => {
    S(), h.current != null && (clearTimeout(h.current), h.current = null), v(!0);
  }, [S, v]);
  const P = C(() => {
    const E = Ht(
      e.current,
      w.current
    );
    return Ce(E || i.current);
  }, [e]), A = C(() => {
    c.current = !0;
    const E = Ht(
      e.current,
      w.current
    ), L = Ce(E ?? i.current);
    return i.current = L, l.current = L, v(), L;
  }, [e, v]), z = C((E, L, x) => {
    const j = x || w.current, $ = mn(E, L || 1), J = { page: $, fraction: 0 };
    i.current = J, c.current = !0, l.current = J, v(), S(), bl(e.current, $, "smooth", j), f.current = yl(
      () => e.current,
      $,
      {
        behavior: "auto",
        pane: j,
        delaysMs: Tl,
        onDone: () => k(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(J);
    }, Ml);
  }, [e, k, S, v]), F = C(() => Ce(i.current), []), N = C(() => c.current, []), I = C(() => {
    if (!c.current || !l.current)
      return;
    const E = Ce(l.current);
    At(
      e.current,
      E,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: P,
    beginModeSwitch: A,
    goToPage: z,
    getAnchor: F,
    isRestoring: N,
    repinIfRestoring: I
  };
}
function xl(e, t) {
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
function ra(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Dl = [0, 80, 200, 400, 800], Cl = 120, zl = 400;
function Ol(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: u = !0 } = e, f = M(a);
  f.current = a;
  const d = M(s);
  d.current = s;
  const h = M(i);
  h.current = i;
  const g = M(n);
  g.current = n, D(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const m = Vs(), y = xl(m, d.current);
    if (y == null && (m != null && m.blockId) && !u) return;
    const w = ra(m, y, { jobId: l, documentId: c });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, m && ((k = h.current) == null || k.call(h, m, y));
    const S = [];
    let b = 0;
    for (const P of Dl)
      b = Math.max(b, P), S.push(
        setTimeout(() => {
          f.current(y);
        }, P)
      );
    return S.push(
      setTimeout(() => {
        var P;
        (P = g.current) == null || P.call(g);
      }, b + Cl)
    ), () => {
      for (const P of S) clearTimeout(P);
    };
  }, [r, o, l, c, t, u]);
}
function $l(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Fl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = zl,
    jobId: i,
    documentId: l,
    applyReaderSearch: c
  } = e, u = M(a);
  u.current = a;
  const f = M(c);
  f.current = c;
  const d = M(0);
  D(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const h = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", m = Qa(g, o, u.current);
      if (d.current = o, m === null) return;
      const y = `${new URLSearchParams(m).get("block_id") || ""}`.trim();
      t.current = ra(
        { blockId: y },
        o,
        { jobId: i, documentId: l }
      ), (f.current || $l)(m);
    }, s);
    return () => clearTimeout(h);
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
function Bl(e) {
  const t = M(""), [n, r] = T(!1), o = C(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Ol(a, t, o), Fl(e, t, n);
}
const Ct = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function jl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Cr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function oa(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Cr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Cr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Hl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = oa(r, t, n);
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
function Ul(e) {
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
function Wl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function Kl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function Vl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Jl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const zr = [250, 500, 1e3, 2e3, 4e3], Sn = [80, 160, 320, 640, 1e3, 1500], Or = [250, 500, 1e3, 2e3, 4e3, 5e3];
function $n(e, t) {
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
function nr(e) {
  return ss(e) ? `${e.code || ""}`.trim() : "";
}
function Qt(e, t) {
  const n = nr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ql(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (oa(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = is(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = nr(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = Sn[Math.min(s, Sn.length - 1)];
    if (await $n(i, r), s >= Sn.length + 2) throw a;
  }
}
function Gl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = T(Ct), s = M(o), i = M("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), u = Wt(c) ? c : "";
  return D(() => {
    if (!n || !l) {
      i.current = "", s.current = Ct, a(Ct);
      return;
    }
    const f = r === void 0 ? Ks() : r, d = i.current === l;
    if (i.current = l, !f) {
      const b = {
        ...d ? s.current : Ct,
        connection: u ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = b, a(b);
      return;
    }
    const h = new AbortController();
    let g = !1;
    const m = {
      ...d ? s.current : Ct,
      connection: u ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = m, a(m);
    const y = (b) => {
      h.signal.aborted || a((v) => {
        const k = b(v);
        return s.current = k, k;
      });
    }, w = async () => {
      let b = 0;
      for (; !h.signal.aborted; )
        try {
          const v = await f.fetchLayout(l, { signal: h.signal });
          g = !0, y((k) => ({
            ...k,
            layoutByPage: jl(v),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = nr(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            y((A) => ({
              ...A,
              connection: u ? "terminal" : "unavailable",
              jobStatus: c,
              error: Qt(v, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((A) => ({
              ...A,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          y((A) => ({
            ...A,
            connection: "connecting",
            jobStatus: c,
            error: Qt(v, "正在等待 OCR 版面数据")
          })), await $n(zr[Math.min(b, zr.length - 1)], h.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await w(), !g || h.signal.aborted) return;
      let b = 0;
      for (; !h.signal.aborted; ) {
        u || y((v) => ({
          ...v,
          connection: v.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: v.error
        }));
        try {
          await f.streamEvents(l, {
            afterSeq: s.current.lastSeq,
            signal: h.signal,
            onEvent: async (v) => {
              if (v.seq <= s.current.lastSeq) return;
              let k;
              try {
                k = await ql(
                  l,
                  v,
                  s.current,
                  h.signal,
                  f
                );
              } catch (P) {
                if ((P == null ? void 0 : P.name) === "AbortError" || h.signal.aborted) throw P;
                y((A) => ({
                  ...A,
                  lastSeq: Math.max(A.lastSeq, v.seq),
                  error: Qt(P, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((P) => {
                const A = Hl(P, v, k);
                return u ? {
                  ...A,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...A,
                  jobStatus: c
                };
              }), b = 0;
            }
          });
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError" || h.signal.aborted) return;
          y((k) => ({
            ...k,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: c,
            error: Qt(v, "实时译文连接已中断，正在重连")
          }));
        }
        if (h.signal.aborted) return;
        if (u) {
          y((v) => ({
            ...v,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await $n(Or[Math.min(b, Or.length - 1)], h.signal).catch(() => {
        }), b += 1;
      }
    })(), () => h.abort();
  }, [n, r, l, u]), o;
}
function Xl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function Zl(e, t = !0) {
  const [n, r] = T(() => /* @__PURE__ */ new Map());
  return D(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = lt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Xl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Yl = 4500;
function Ql(e) {
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
const ec = /* @__PURE__ */ new Set(["book", "translate"]);
function aa(e) {
  return !!(e.jobId && e.sourceUrl && ec.has(e.workflow));
}
function tc(e) {
  return !!(aa(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function nc() {
  const e = Ti(), t = aa({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = tc({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Wt(o) && (r.current.running = !0);
  const a = Gl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = Li(), u = Zl(e.jobId, !e.sourceOnly), f = Ji({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: g } = Yi(e.mode, s, f);
  pl(i, h, g);
  const m = xi(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: h, shellWidth: l, identityKey: d }
  ), {
    beginModeSwitch: y,
    goToPage: w,
    repinIfRestoring: S
  } = _l(s, {
    primaryPane: m.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: m.primaryNumPages > 0
  });
  D(() => {
    S();
  }, [l, S]);
  const b = Rl(
    s,
    m.compareMode,
    m.rowSyncRevision,
    S
  ), v = vl(
    s,
    m.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${m.metricsTick}`,
    m.primaryPane
  ), k = C(($, J) => {
    var re, oe;
    const X = Math.max(
      Number(m.hudNumPages) || 0,
      Number(m.primaryNumPages) || 0,
      Number((re = m.numPagesByPane) == null ? void 0 : re.source) || 0,
      Number((oe = m.numPagesByPane) == null ? void 0 : oe.translated) || 0
    );
    w($, X, J);
  }, [w, m.hudNumPages, m.primaryNumPages, m.numPagesByPane]), [P, A] = T(null), z = M(null), F = C(($) => {
    z.current && clearTimeout(z.current), A($), $ && (z.current = setTimeout(() => A(null), Yl));
  }, []);
  D(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const N = C(($) => {
    const J = vn(e.regions, $);
    return J ? Rr(J, m.primaryPane).page : null;
  }, [e.regions, m.primaryPane]), I = C(($, J) => {
    const X = J || m.primaryPane, re = typeof $ == "object" && $ ? `${$.block_id || ""}`.trim() : "", oe = typeof $ == "object" && $ ? `${$.image_url || ""}`.trim() : "", ce = typeof $ == "object" && $ ? $.page_idx != null ? Number($.page_idx) + 1 : $.page != null ? Number($.page) : null : typeof $ == "number" ? $ + 1 : null, ue = ts(e.regions, oe, ce) || vn(e.regions, re) || (typeof $ == "object" ? ns(e.regions, $) : null);
    let le = ue ? Rr(ue, X).page : null;
    le == null && (le = Ql($)), !(le == null || le < 1) && (F(ue), k(le, X));
  }, [F, k, m.primaryPane, e.regions]);
  Bl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: m.hudNumPages || 0,
    currentPage: v,
    goToPage: k,
    resolveBlockPage: N,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: ($) => {
      F(vn(e.regions, $.blockId));
    }
  });
  const { setModeKeepingPage: R } = gl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  D(() => {
    F(null);
  }, [d, F]);
  const E = !e.boot.loading && !e.boot.failed, L = V(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), x = V(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), j = V(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: g,
    shell: L,
    panes: m,
    sessionFiles: x,
    rowHeights: b,
    goToPage: k,
    activeRegion: P,
    jumpToAnchor: I,
    setModeKeepingPage: R,
    download: e.download,
    showHud: E,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, L, m, x, b, k, P, I, R, E, h, g, f, a, n, u]);
  return V(() => ({
    ...j,
    currentPage: v
  }), [j, v]);
}
const rc = [
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
], oc = [
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
function ac(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of rc)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function sc(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const ic = ".reader-notes-panel";
function lc(e) {
  return e instanceof Element ? !!e.closest(ic) : !1;
}
function cc(e) {
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
    enabled: u = !0
  } = e;
  D(() => {
    if (!u)
      return;
    const f = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || sc(d.target) || lc(d.target))
        return;
      const h = d.key, g = ac(h);
      if (g) {
        if (g.mode) {
          if (n && g.mode !== "source")
            return;
          d.preventDefault(), r(g.mode);
          return;
        }
        if (g.action === "doc-dark") {
          if (!c || d.repeat) return;
          d.preventDefault(), c();
          return;
        }
        if (!(g.requiresPages && i <= 0))
          switch (d.preventDefault(), g.action) {
            case "zoom-in":
              a(Vt(o, 1));
              return;
            case "zoom-out":
              a(Vt(o, -1));
              return;
            case "zoom-reset":
              a(Pt(t, at()));
              return;
            case "next-page":
              l(mn(s + 1, i));
              return;
            case "prev-page":
              l(mn(s - 1, i));
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
    l,
    c
  ]);
}
const uc = "retainpdf:soft-reader-close";
function dc() {
  return new URL("./index.html", window.location.href).href;
}
function fc() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: uc },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function mc(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function hc() {
  if (!(typeof window > "u") && !fc()) {
    if (mc(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(dc());
  }
}
function pc({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function gc({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ _(pc, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), hc();
  }, children: [
    /* @__PURE__ */ p(vt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const bc = 3e3, yc = 8;
async function vc(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function wc(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Sc(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = bc;
  const r = [], o = (s, i, l) => {
    const c = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = wc(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const h = l ? `${l}.${u}` : `${u}`, g = { id: h, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), c.push(g), i < yc && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, h));
    }
    return c;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await vc(e, i);
  })), a;
}
function kc(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Ic(e, t) {
  let n = null;
  for (const r of kc(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function $r(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Fr = !1;
function Rc() {
  if (Fr)
    return;
  const e = Kt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && ($o.GlobalWorkerOptions.workerSrc = e, Fr = !0);
}
const ot = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Ec = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Pc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Tc = {
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
}, Br = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Mc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Br(o ?? a ?? "", Ec)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Br(o ?? a ?? "", Pc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Tc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Nc(e) {
  return ot(e.translatedBlockText) || ot(e.translated.text) || ot(e.source.text);
}
const Ac = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Lc(e) {
  const t = [];
  for (const n of e) {
    if (!Ac(n)) continue;
    const r = Mc(Nc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function _c(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const xc = 24, Dc = 60;
function jr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - xc), o = Math.min(e.length, n + t.length + Dc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Cc(e, t, n = 200) {
  const r = ot(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = ot(a.translatedBlockText) || ot(a.translated.text), l = i ? jr(i, r) : null, c = l ?? jr(ot(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function en(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function $t(e, t) {
  const n = ot(t).toLowerCase();
  if (!n || !e) return en(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${en(e.slice(a, s))}<mark class="reader-find-mark">${en(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + en(e.slice(a));
}
function zc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const sa = "reader-xref", Fn = "data-xref", Ft = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Oc = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Ft})`), $c = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Bn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Fc(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Bc(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function jc(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const l = _e(i);
    return l === "figure" || l === "table" || l === "formula";
  }, a = (i) => {
    const l = [];
    for (let c = t + i; o(e[c]) && l.length < 40; c += i) l.push(e[c]);
    return i < 0 ? l.reverse() : l;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Hc(e, t, n) {
  return (e.find((o) => _e(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Uc(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = _e(r), s = Bc(r);
    if (a === "formula") {
      for (const g of s.matchAll($c)) {
        const m = Bn(g[1]);
        m && n({ key: `equation:${m}`, kind: "equation", label: m, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Oc.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const c = Fc(i[1]), u = Bn(i[2]), f = jc(e, o, c), d = [...f.map((g) => g.itemId), r.itemId], h = new Map(e.map((g, m) => [g.itemId, m]));
    d.sort((g, m) => (h.get(g) ?? 0) - (h.get(m) ?? 0)), n({ key: `${c}:${u}`, kind: c, label: u, itemId: Hc(f, r, c), itemIds: d, captionId: r.itemId });
  }), t;
}
const Wc = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Ft})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Ft})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Ft})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Ft})\s*[）)]`, "g"), kind: () => "equation" }
];
function Kc(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Wc) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", l = Bn(s[s.length - 1]), c = `${a(i)}:${l}`;
      if (!t.has(c)) continue;
      const u = s.index ?? 0;
      n.push({ start: u, end: u + s[0].length, key: c });
    }
  }
  n.sort((o, a) => o.start - a.start);
  const r = [];
  for (const o of n)
    (!r.length || o.start >= r[r.length - 1].end) && r.push(o);
  return r;
}
function Vc(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function Jc(e, t, n = "") {
  const r = Kc(e, t);
  if (!r.length) return $t(e, n);
  let o = "", a = 0;
  for (const s of r)
    o += $t(e.slice(a, s.start), n), o += `<mark class="${sa}" ${Fn}="${Vc(s.key)}">${$t(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  return o + $t(e.slice(a), n);
}
const qc = { figure: "图", table: "表", equation: "式" };
function Hr(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${qc[e.kind]} ${e.label}`;
}
function he(e) {
  return typeof e == "string" ? e : "";
}
function Gc(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Xc(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Zc(e) {
  return {
    source: he(e == null ? void 0 : e.source_text) || he(e == null ? void 0 : e.unit_source_text),
    translated: he(e == null ? void 0 : e.protected_translated_text) || he(e == null ? void 0 : e.translated_text)
  };
}
const Yc = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ia(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Qc(e) {
  const t = ia(e).sort((r, o) => he(r.ts).localeCompare(he(o.ts)));
  return t.length ? [
    { text: he(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: he(r.new_text),
      label: Yc[he(r.source)] || he(r.source) || "修订",
      ts: he(r.ts),
      reason: he(r.reason)
    }))
  ].reverse() : [];
}
function eu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function tu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return he(r.finished_at) || he(n.finished_at) || "";
}
function nu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ia(e).sort((a, s) => he(a.ts).localeCompare(he(s.ts)));
  for (const a of o) {
    const s = new Date(he(a.ts)).getTime(), i = he(a.reader_item_id) || he(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, he(a.new_text));
  }
  return n;
}
const ru = {
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
function ou(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = ru[he(n.kind)] || he(n.kind) || "问题", o = he(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const au = /* @__PURE__ */ new Set(["text", "formula"]);
function rr(e) {
  return au.has(e);
}
function su(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || rr(_e(n));
}
function iu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !rr(_e(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const lu = 300, cu = 72;
function uu(e, t) {
  if (e.width >= lu && e.height >= cu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const du = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function fu(e, t, n) {
  return e.flatMap((r) => {
    if (!du.has(_e(r.region))) return [];
    const o = Xt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Ur(e, t, n) {
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
async function mu(e) {
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
const hu = "reader-text-hover-copy", pu = "reader-text-hover-edit", gu = "reader-text-hover-zoom", bu = "reader-text-hover-id";
function yu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const la = "reader-text-hover-tools";
function tn({
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
const vu = 26, wu = 220;
function Su(e, t = wu) {
  return e.height < vu * 2 || e.width < t;
}
function ku({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Lo : e === "failed" ? vt : cs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Iu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [l, c] = T("idle"), [u, f] = T("idle"), [d] = T(() => yu()), h = M([]), g = (e == null ? void 0 : e.itemId) || "";
  if (D(() => {
    c("idle"), f("idle");
    const k = h.current;
    return () => {
      k.forEach((P) => window.clearTimeout(P)), h.current = [];
    };
  }, [g]), !e) return null;
  const m = rs(e.highlight.region, t), y = _e(e.highlight.region), w = (k, P) => async (A) => {
    A.preventDefault(), A.stopPropagation();
    const z = await mu(k);
    P(z ? "copied" : "failed"), h.current.push(window.setTimeout(() => P("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (Su(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ _(
        "div",
        {
          className: la,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              tn,
              {
                className: bu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && rr(y) ? /* @__PURE__ */ p(
              tn,
              {
                className: pu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Zn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            m ? /* @__PURE__ */ p(
              tn,
              {
                className: hu,
                state: l,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: l === "copied" ? "已复制" : l === "failed" ? "复制失败" : S,
                onClick: w(m, c),
                children: /* @__PURE__ */ p(ku, { state: l })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              tn,
              {
                className: gu,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(ls, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Ru(e, t) {
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
function Eu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = Xt(
      Ru(e, a),
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
const Pu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Tu = 256, zt = /* @__PURE__ */ new Map();
function Mu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function ca(e) {
  const t = `${e || ""}`, { text: n, slots: r } = $s(t, { bareLatex: !0 }), o = Mu(n), a = Fs(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = zt.get(t);
  if (!s && (s = Bs(o, r), zt.set(t, s), zt.size > Tu)) {
    const i = zt.keys().next().value;
    i !== void 0 && zt.delete(i);
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
function Nu(e, t) {
  const n = e.typography, r = Ge(t) || 1, o = Ge(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = kn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = Ge(n == null ? void 0 : n.fit_min_font_size_pt), u = Ge(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : l
  ), h = o ? o * r : l, g = Ge(n == null ? void 0 : n.leading_em), m = [
    Ge(n == null ? void 0 : n.padding_top_pt) || 0,
    Ge(n == null ? void 0 : n.padding_right_pt) || 0,
    Ge(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ge(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Pu,
    fontSizePx: Math.max(f, Math.min(d, h)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (kn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : kn(e.kind) ? "center" : "justify",
    padding: m,
    exact: !!o
  };
}
function Au(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const d = s.get(f);
    if (d !== void 0) return d;
    const { width: h, height: g } = e(f), m = h <= t + 0.5 && g <= n + 0.5;
    return s.set(f, m), m;
  };
  let l = o, c = a, u = Math.min(r.requestedFontSizePx, c);
  if (i(u)) {
    if (!r.exact) {
      l = u;
      for (let f = 0; f < 6 && c > l; f += 1) {
        const d = (l + c) / 2;
        i(d) ? (u = d, l = d) : c = d;
      }
    }
  } else {
    c = u, u = l;
    for (let f = 0; f < 8 && c > l; f += 1) {
      const d = (l + c) / 2;
      i(d) ? (u = d, l = d) : c = d;
    }
  }
  return Math.max(o, u);
}
const Lu = 512, Ot = /* @__PURE__ */ new Map();
let jn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  jn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  jn += 1;
}));
function _u(e, t, n, r) {
  return [
    jn,
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
function ua({ item: e, pageScale: t }) {
  const n = M(null), r = V(
    () => ca(e.translatedText),
    [e.translatedText]
  ), [o, a] = T(r.fallbackHtml), s = V(
    () => Nu(e, t),
    [e, t]
  );
  D(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Ee(() => {
    const f = n.current;
    if (!f) return;
    const [d, h, g, m] = s.padding, y = Math.max(1, e.rect.width - m - h), w = Math.max(1, e.rect.height - d - g), S = _u(o, y, w, s);
    let b = Ot.get(S);
    if (b === void 0 && (b = Au(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ot.set(S, b), Ot.size > Lu)) {
      const v = Ot.keys().next().value;
      v !== void 0 && Ot.delete(v);
    }
    f.style.fontSize = `${b.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, l, c, u] = s.padding;
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
        padding: `${i}px ${l}px ${c}px ${u}px`
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
function xu({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = V(
    () => Eu(e, t, n, r),
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
        ua,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Du = pn(xu);
function Cu({
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
        ua,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: _e(a.highlight.region),
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
const zu = pn(Cu), da = 24, nt = da * 2 + 4, Xe = 24, Ou = 4, $u = 6, ht = (e) => e.left + e.width, it = (e) => e.top + e.height;
function Bt(e, t) {
  const n = Math.min(ht(e), ht(t)) - Math.max(e.left, t.left), r = Math.min(it(e), it(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Wr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ht(t) && r >= t.top && r <= it(t);
}, Fu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Bu(e, t, n) {
  if (!t.length || e.height < Xe || e.width < n + 8) return null;
  const r = Math.max(...t.map(it)), o = ht(e) - 4 - n;
  for (const a of [r, it(e) - 2]) {
    const s = Math.max(e.top, a - Xe), i = { left: o, top: s, width: n, height: Xe };
    if (!t.some((l) => Bt(i, l) > 0)) return s - e.top;
  }
  return null;
}
function ju(e, t) {
  const n = [], r = (a) => {
    const s = da + Ou, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ht(e), top: i, width: s, height: nt } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: nt } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Xe - 3, width: nt, height: Xe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: it(e), width: nt, height: Xe + 3 } }), r(!0);
  const o = Bu(e, t, nt);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ht(e) - 4 - nt, top: e.top + o, width: nt, height: Xe } }), n;
}
function Hu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !Fu(S)), i = s.filter((S) => Wr(S, t)), l = s.filter((S) => !Wr(S, t)), c = n.filter((S) => S !== t && Bt(S, t) < t.width * t.height * 0.5), u = ju(t, i).filter(({ box: S, overhang: b }) => {
    const v = b ? $u : 0;
    return S.left >= -v && ht(S) <= r + v && S.top >= 0 && it(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !l.some((b) => Bt(S, b) > 0), h = u.filter((S) => S.placement !== "tail"), g = h.find((S) => d(S) && !c.some((b) => Bt(S.box, b) > 0));
  if (g) return f(g);
  const m = h.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (m) return f(m);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = l.reduce((v, k) => v + Bt(S.box, k), 0);
    b < w && (y = S, w = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function Uu(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Xe - 3 : it(r);
  return t >= r.left - 4 && t <= r.left + nt + 4 && n >= a && n <= a + Xe + 3;
}
const In = (e) => e.left + e.width, Rn = (e) => e.top + e.height;
function Wu(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const u = c.left + c.width / 2, f = c.top + c.height / 2;
    u < e.left || u > In(e) || f < e.top || f > Rn(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, In(c)), i = Math.max(i, Rn(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(In(e) + r, s + n) - l.left, l.height = Math.min(Rn(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function Ku(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Vu(e, t, n, r) {
  const [o, a] = T(null);
  return Ee(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Ku(s) : [], l = _e(t.highlight.region) === "figure", c = i.length && !l ? Wu(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: c, ...Hu({ frame: c, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const fa = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Kr = { pen: 35e-4, highlighter: 0.018 }, Vr = 0.015, Hn = "retainpdf.reader.ink.v1:";
function Jr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Hn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Ju(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Hn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Hn + e);
    } catch {
    }
}
function qu(e, t, n, r, o, a) {
  const s = Vr * Vr;
  return e.filter((i) => ma(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function ma(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Gu(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Xu(e) {
  const [t, n] = T(null), [r, o] = T(fa[0].key), [a, s] = T(() => Jr(e)), i = M(a), l = M([]);
  D(() => {
    const m = Jr(e);
    i.current = m, s(m), l.current = [];
  }, [e]);
  const c = C((m) => {
    i.current = m, s(m), Ju(e, m);
  }, [e]), u = C((m) => {
    const y = i.current, w = m(y);
    w !== y && (l.current = [...l.current.slice(-49), y], c(w));
  }, [c]), f = C((m) => {
    m.points.length < 1 || u((y) => [...y, { ...m, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = C((m) => {
    m.length && u((y) => y.filter((w) => !m.includes(w.id)));
  }, [u]), h = C((m) => {
    u((y) => y.some((w) => w.page === m) ? y.filter((w) => w.page !== m) : y);
  }, [u]), g = C(() => {
    const m = l.current.pop();
    m && c(m);
  }, [c]);
  return V(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: h }),
    [t, r, a, f, d, g, h]
  );
}
const Zu = "reader-ink-layer";
function Yu(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function qr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Yu(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Qu({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = T(null), i = M(!1), l = o.strokes.filter((m) => ma(m, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const u = (m) => {
    const y = m.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (m.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (m.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (m, y) => o.erase(qu(o.strokes, e, t, m, y, r / Math.max(1, n))), d = (m) => {
    if (!o.tool || m.button !== 0) return;
    m.preventDefault(), m.stopPropagation(), m.currentTarget.setPointerCapture(m.pointerId), i.current = !0;
    const [y, w] = u(m);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, h = (m) => {
    if (!i.current || !o.tool) return;
    m.stopPropagation();
    const [y, w] = u(m);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? Gu(S, y, w) : [[y, w]]);
  }, g = (m) => {
    i.current && (i.current = !1, m.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Kr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ _(
    "svg",
    {
      className: Zu,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: h,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        l.map((m) => /* @__PURE__ */ p(qr, { stroke: m, width: n, height: r }, m.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(qr, { stroke: { tool: o.tool, color: o.color, width: Kr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function ed({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = T(null), [i, l] = T(!1), [c, u] = T([]), [f, d] = T(""), [h, g] = T(""), [m, y] = T(!1), [w, S] = T(null), [b, v] = T([]), k = r.drafts, P = r.generation, A = C(async (I, R) => {
    if (e)
      try {
        u(Qc(await e.fetchRevisions(I, R)));
      } catch {
        u([]);
      }
  }, [e]);
  D(() => {
    if (s(null), u([]), S(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return l(!0), e.loadItem(t, n).then((R) => {
      if (I) return;
      const E = R == null ? void 0 : R.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const L = `${(R == null ? void 0 : R.item_id) || n}`, { source: x, translated: j } = Zc(E);
      s({ readerItemId: n, itemId: L, source: x, current: j }), d(k.get(n) ?? j);
    }).catch((R) => {
      I || S({ tone: "error", message: (R == null ? void 0 : R.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || l(!1);
    }), A(t, n), () => {
      I = !0;
    };
  }, [e, t, n, A]);
  const z = C((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), F = C(async (I, R) => {
    if (!e || !a || m) return !1;
    const E = I ?? f;
    if (!E.trim()) return !1;
    y(!0), S(null), v([]);
    try {
      const L = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (R ?? h).trim() || "在阅读页手动修改",
        ...P.current != null ? { expected_generation: P.current } : {}
      }), x = Number(L == null ? void 0 : L.generation);
      return Number.isFinite(x) && (P.current = x), k.delete(a.readerItemId), s({ ...a, current: E }), d(E), g(""), (L == null ? void 0 : L.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), A(t, a.readerItemId), !0;
    } catch (L) {
      const x = L;
      return (x == null ? void 0 : x.reason) === "generation_mismatch" && (P.current = null), S({ tone: "error", message: (x == null ? void 0 : x.message) || "保存失败，请稍后再试。" }), v(ou(x == null ? void 0 : x.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, m, f, h, t, o, A, k, P]), N = C(() => {
    n && k.delete(n);
  }, [n, k]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: f,
    setDraft: z,
    reason: h,
    setReason: g,
    saving: m,
    status: w,
    issues: b,
    save: F,
    discardDraft: N
  };
}
const ha = "reader-inline-edit";
function td({ text: e }) {
  const [t, n] = T("");
  return D(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = ca(e);
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
function nd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var N;
  const s = e.itemId, i = ed({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = T(!1), [u, f] = T(!1), d = M(null), h = uu(e.rect, t), g = V(() => iu(o), [o]), m = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: k } = n, P = C((I) => {
    const R = g[m + I];
    R && (k(R), a == null || a(R));
  }, [g, m, k, a]), A = C(() => {
    i.discardDraft(), v();
  }, [i, v]), z = C(async (I, R) => {
    await i.save(I, R) && v();
  }, [i, v]);
  D(() => {
    const I = (R) => {
      !R.altKey || R.key !== "ArrowUp" && R.key !== "ArrowDown" || (R.preventDefault(), P(R.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [P]), Ee(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const R = h.mode === "inline" ? h.minHeight : 0;
    I.style.height = `${Math.max(R, I.scrollHeight + 2)}px`;
  }, [i.draft, y, h.mode, h.mode === "inline" ? h.minHeight : 0]);
  const F = h.mode === "inline" ? { left: h.left, top: h.top, width: h.width } : { left: h.left, width: h.width, top: h.top, bottom: h.bottom };
  return /* @__PURE__ */ _(yt, { children: [
    h.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ _(
      "div",
      {
        className: `${ha} is-${h.mode}`,
        style: F,
        role: "group",
        "aria-label": `改第 ${((N = n.target) == null ? void 0 : N.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": h.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            Z,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((I) => !I),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            Ds,
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
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || z()) : I.key === "Escape" && (I.preventDefault(), A());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(td, { text: i.draft }) : null,
          /* @__PURE__ */ _("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(mt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: m <= 0, onClick: () => P(-1), children: /* @__PURE__ */ p(us, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(mt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: m < 0 || m >= g.length - 1, onClick: () => P(1), children: /* @__PURE__ */ p(_o, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              Oo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || z()) : I.key === "Escape" && (I.preventDefault(), A());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ _(
              Z,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p(ds, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(Z, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: A, children: "取消" }),
            /* @__PURE__ */ p(
              Z,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  z();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, R) => {
            const E = I.text === y.current, L = [eu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ _("li", { "data-block-edit-history": I.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ _("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ _("span", { children: [
                  L,
                  E ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  Z,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      z(I.text, `回到「${L.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${R}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const pa = qn(null), ga = qn(null);
function rd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(pa.Provider, { value: e, children: /* @__PURE__ */ p(ga.Provider, { value: t, children: n }) });
}
function Qe() {
  return Gn(pa);
}
function ba() {
  return Gn(ga);
}
const ya = 1.414;
function od({
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
  sentinelRef: u,
  regionHighlight: f = null,
  regionTargets: d = [],
  hoveredRegionId: h,
  onHoverRegion: g,
  liveTranslationLayout: m,
  liveTranslationPage: y,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var ne, de;
  const b = Qe(), v = b == null ? void 0 : b.revisedBlocks, k = b == null ? void 0 : b.blockEdit, P = k == null ? void 0 : k.pendingEdits, A = b == null ? void 0 : b.editBlock, z = (b == null ? void 0 : b.findTerm) || "", F = b == null ? void 0 : b.xrefIndex, N = V(
    () => F != null && F.size ? ({ str: B }) => Jc(B, F, z) : z ? ({ str: B }) => $t(B, z) : void 0,
    [z, F]
  ), I = M(l ?? ya), [R, E] = T(I.current);
  D(() => {
    l != null && Math.abs(l - I.current) >= 1e-3 && (I.current = l, E(l));
  }, [l]);
  const L = M(u);
  L.current = u;
  const x = M(null), j = M((B) => {
    var q;
    x.current = B, (q = L.current) == null || q.call(L, B);
  }).current, $ = M(null), J = M(`${t}@${n}`);
  Ee(() => {
    const B = `${t}@${n}`;
    J.current !== B && (J.current = B, o && sd(x.current, $.current));
  }, [o, n, t]), D(() => {
    o || En($.current);
  }, [o]), D(() => () => En($.current), []);
  const X = Math.max(120, Math.floor(t * R)), re = Math.max(X, Math.ceil(s || 0)), oe = Xt(f, t, X), ce = V(
    () => fu(d, t, X),
    [X, d, t]
  ), [ue, le] = T(null), xe = typeof g == "function", ee = xe ? h ?? null : ue, te = (B) => {
    xe ? B !== (h ?? null) && (g == null || g(B)) : le((q) => q === B ? q : B);
  }, me = V(
    () => ce.find((B) => B.itemId === ee) || null,
    [ee, ce]
  ), be = r === "translated" && ((ne = k == null ? void 0 : k.target) == null ? void 0 : ne.itemId) || "", ye = V(
    () => be && ce.find((B) => B.itemId === be) || null,
    [be, ce]
  ), pe = Vu(x, o ? me : null, ce, t), He = (B) => {
    var Te, Ie, Ue, Re, We;
    if (B.pointerType === "touch") return;
    if ((Te = b == null ? void 0 : b.ink) != null && Te.tool) {
      te(null);
      return;
    }
    if (B.buttons !== 0) {
      te(null);
      return;
    }
    if ((Ue = (Ie = B.target) == null ? void 0 : Ie.closest) != null && Ue.call(Ie, `.${la}`) || (We = (Re = B.target) == null ? void 0 : Re.closest) != null && We.call(Re, `.${ha}`)) return;
    const q = B.currentTarget.getBoundingClientRect(), Q = B.clientX - q.left, fe = B.clientY - q.top;
    if (Uu(pe, Q, fe)) return;
    const Pe = Ur(ce, Q, fe);
    te((Pe == null ? void 0 : Pe.itemId) || null);
  }, ct = (B) => {
    if (B.pointerType === "mouse") return;
    const q = B.currentTarget.getBoundingClientRect(), Q = Ur(
      ce,
      B.clientX - q.left,
      B.clientY - q.top
    );
    te((Q == null ? void 0 : Q.itemId) || null);
  }, De = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(I.current - B) < 1e-3 || (I.current = B, E(B), c == null || c(e, B));
  };
  return /* @__PURE__ */ _(
    "div",
    {
      ref: j,
      [Le]: e,
      [ke]: r,
      [Yn]: X,
      className: Qn,
      onPointerMoveCapture: He,
      onPointerDown: ct,
      onDoubleClick: (B) => {
        var Q;
        const q = b == null ? void 0 : b.zoomBlock;
        !q || (Q = b == null ? void 0 : b.ink) != null && Q.tool || !me || _e(me.highlight.region) === "figure" && (B.preventDefault(), q(me.itemId));
      },
      onPointerLeave: (B) => {
        B.pointerType === "mouse" && te(null);
      },
      style: {
        width: t,
        height: re,
        minHeight: re
      },
      children: [
        o ? /* @__PURE__ */ p(
          zs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: N,
            renderAnnotationLayer: !1,
            className: Uo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: cn,
                style: { width: t, height: X }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const q = B.getViewport({ scale: 1 });
                if (q.width > 0) {
                  const Q = q.height / q.width;
                  De(Q);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              En($.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: cn,
            style: { width: t, height: X },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: $, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        oe ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: oe,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Du,
          {
            layoutPage: m,
            pageState: y,
            width: t,
            height: X
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ p(zu, { targets: ce, edits: P, width: t, excludeId: ye == null ? void 0 : ye.itemId }) : null,
        o && ye && k ? /* @__PURE__ */ p(
          nd,
          {
            target: ye,
            page: { width: t, height: X },
            edit: k,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: ce.filter((B) => v.has(B.itemId)).map((B) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": B.itemId,
            style: { left: B.rect.left, top: B.rect.top, height: B.rect.height }
          },
          B.itemId
        )) }) : null,
        o && (b != null && b.ink) ? /* @__PURE__ */ p(
          Qu,
          {
            page: e,
            pane: r === "translated" ? "translated" : b.compareVersion ? "compare" : "source",
            width: t,
            height: X,
            ink: b.ink
          }
        ) : null,
        /* @__PURE__ */ p(
          Iu,
          {
            target: o && !((de = b == null ? void 0 : b.ink) != null && de.tool) && (me == null ? void 0 : me.itemId) !== (ye == null ? void 0 : ye.itemId) ? me : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: me && (v == null ? void 0 : v.get(me.itemId)) || 0,
            onEdit: A,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: pe == null ? void 0 : pe.rect,
            placement: pe == null ? void 0 : pe.placement,
            tailTop: pe == null ? void 0 : pe.tailTop
          }
        )
      ]
    }
  );
}
const ad = pn(od);
function sd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function En(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const id = 2 * 1024 * 1024;
function ld(e) {
  const t = new $o.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const Pn = 5, cd = "120% 0px", ud = 120, dd = "25% 0px";
let Gr = 1;
const Xr = /* @__PURE__ */ new WeakMap();
function fd(e) {
  if (!e) return 0;
  const t = Xr.get(e);
  if (t) return t;
  const n = Gr;
  return Gr += 1, Xr.set(e, n), n;
}
function md() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const hd = To(
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
    onMetrics: u,
    onLoadSuccess: f,
    onOutline: d,
    onDocument: h,
    onLoadError: g,
    onNumPagesChange: m,
    activeRegion: y = null,
    regions: w = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: v,
    liveTranslation: k,
    showLiveTranslation: P = t === "source",
    liveTranslationPendingLabel: A = "",
    paneAction: z
  }, F) {
    Rc();
    const { file: N, loading: I, error: R } = Si(n, r), E = `${n}\0${fd(N)}`, L = M(E);
    L.current = E;
    const x = V(() => {
      const O = pi(N);
      return O ? "ranged" in O ? { range: ld(O.ranged) } : O : null;
    }, [N, n]), [j, $] = T(0), [J, X] = T(""), [re, oe] = T(null), [ce, ue] = T(480), le = M(null), xe = M(0), ee = V(() => md(), []), te = V(() => ({
      cMapUrl: Kt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Kt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: id,
      disableAutoFetch: !0
    }), []);
    Xn(F, () => re, [re]), D(() => {
      const O = (W) => {
        xe.current = W, ue(W);
      }, U = (W) => {
        const se = Ui(W, xe.current);
        if (se !== "ignore") {
          if (le.current && clearTimeout(le.current), se === "immediate") {
            O(W);
            return;
          }
          le.current = setTimeout(() => O(W), qo);
        }
      }, K = !!(l && l >= 80);
      U(K ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const ae = !K && i && typeof ResizeObserver < "u" ? new ResizeObserver((W) => {
        var se, ge;
        U(((ge = (se = W[0]) == null ? void 0 : se.contentRect) == null ? void 0 : ge.width) ?? i.clientWidth);
      }) : null;
      return ae && i && ae.observe(i), () => {
        ae == null || ae.disconnect(), le.current && clearTimeout(le.current);
      };
    }, [l, i, a]);
    const me = V(
      () => Bi(ce, o),
      [ce, o]
    ), [be, ye] = T(() => /* @__PURE__ */ new Map()), [pe, He] = T(() => /* @__PURE__ */ new Set()), [ct, De] = T(() => /* @__PURE__ */ new Set()), ne = M(/* @__PURE__ */ new Map()), de = M(null), B = M(null), [q, Q] = T(() => /* @__PURE__ */ new Set()), fe = M(/* @__PURE__ */ new Map()), Pe = C((O, U) => {
      ye((K) => {
        if (K.get(O) === U) return K;
        const G = new Map(K);
        return G.set(O, U), G;
      });
    }, []), Te = C((O, U) => {
      const K = ne.current, G = K.get(O), ae = [de.current, B.current];
      if (G)
        for (const W of ae)
          try {
            W == null || W.unobserve(G);
          } catch {
          }
      if (U) {
        K.set(O, U);
        for (const W of ae)
          try {
            W == null || W.observe(U);
          } catch {
          }
      } else
        K.delete(O);
    }, []), Ie = M(/* @__PURE__ */ new Map()), Ue = C((O) => {
      const U = Ie.current;
      let K = U.get(O);
      return K || (K = (G) => Te(O, G), U.set(O, K)), K;
    }, [Te]);
    D(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = fe.current, U = new IntersectionObserver(
        (K) => {
          const G = [], ae = [];
          for (const W of K) {
            const se = W.target, ge = dn(se);
            Number.isFinite(ge) && (W.isIntersecting ? G : ae).push(ge);
          }
          if ((G.length || ae.length) && He((W) => {
            let se = null;
            for (const ge of G)
              W.has(ge) || (se = se || new Set(W), se.add(ge));
            for (const ge of ae)
              W.has(ge) && (se = se || new Set(W), se.delete(ge));
            return se || W;
          }), G.length) {
            for (const W of G) {
              const se = O.get(W);
              se && (clearTimeout(se), O.delete(W));
            }
            De((W) => {
              let se = null;
              for (const ge of G)
                W.has(ge) || (se = se || new Set(W), se.add(ge));
              return se || W;
            });
          }
          for (const W of ae)
            O.has(W) || O.set(W, setTimeout(() => {
              O.delete(W), De((se) => {
                if (!se.has(W)) return se;
                const ge = new Set(se);
                return ge.delete(W), ge;
              });
            }, ud));
        },
        { root: i, rootMargin: cd, threshold: 0 }
      );
      de.current = U;
      for (const K of ne.current.values())
        try {
          U.observe(K);
        } catch {
        }
      return () => {
        U.disconnect(), de.current === U && (de.current = null);
        for (const K of O.values()) clearTimeout(K);
        O.clear();
      };
    }, [i]), D(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = new IntersectionObserver(
        (U) => {
          Q((K) => {
            let G = null;
            for (const ae of U) {
              const W = dn(ae.target);
              !Number.isFinite(W) || ae.isIntersecting === K.has(W) || (G = G || new Set(K), ae.isIntersecting ? G.add(W) : G.delete(W));
            }
            return G || K;
          });
        },
        { root: i, rootMargin: dd, threshold: 0 }
      );
      B.current = O;
      for (const U of ne.current.values())
        try {
          O.observe(U);
        } catch {
        }
      return () => {
        O.disconnect(), B.current === O && (B.current = null);
      };
    }, [i]);
    const Re = !!i && typeof IntersectionObserver < "u";
    Ee(() => {
      $(0), X(""), He(/* @__PURE__ */ new Set()), De(/* @__PURE__ */ new Set()), ye(/* @__PURE__ */ new Map()), ne.current.clear();
      const O = fe.current;
      for (const U of O.values()) clearTimeout(U);
      O.clear(), m == null || m(0, t);
    }, [E, m, t]);
    const We = C(
      (O) => {
        if (L.current !== E) return;
        const U = O.numPages;
        $(U), X(""), m == null || m(U, t), f == null || f({ numPages: U, pane: t }), h && typeof O.getPage == "function" && h(O, t), d && typeof O.getOutline == "function" && Sc(O).then((K) => {
          L.current === E && d(K, t);
        }, () => {
        });
      },
      [E, f, d, h, m, t]
    ), we = C(
      (O) => {
        if (L.current !== E) return;
        const U = (O == null ? void 0 : O.message) || "PDF 解析失败";
        X(U), $(0), m == null || m(0, t), g == null || g(O, t);
      },
      [E, g, m, t]
    ), Me = V(
      () => j > 0 ? Array.from({ length: j }, (O, U) => U + 1) : [],
      [j]
    );
    D(() => {
      typeof IntersectionObserver < "u" || De(new Set(Me));
    }, [Me]);
    const Oe = V(
      () => sn(y, S, t),
      [y, S, t]
    ), Ke = V(() => {
      const O = /* @__PURE__ */ new Map();
      for (const U of w) {
        const K = sn(U, S, t);
        if (!K) continue;
        const G = O.get(K.box.page) || [];
        G.push(K), O.set(K.box.page, G);
      }
      return O;
    }, [t, S, w]), $e = V(() => {
      const O = /* @__PURE__ */ new Set();
      if (!b) return O;
      for (const [U, K] of Ke)
        K.some((G) => G.itemId === b) && O.add(U);
      return O;
    }, [b, Ke]), Ne = V(() => {
      if (j === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Me);
      if (pe.size === 0) {
        const K = Math.min(j, Pn * 2 + 1);
        return new Set(Array.from({ length: K }, (G, ae) => ae + 1));
      }
      const U = /* @__PURE__ */ new Set();
      for (const K of pe)
        for (let G = -Pn; G <= Pn; G++) {
          const ae = K + G;
          ae >= 1 && ae <= j && U.add(ae);
        }
      return U;
    }, [j, Me, i, a, pe]), et = !n || !!R || !!J, ut = n && (R || J) || s;
    return /* @__PURE__ */ _(
      "section",
      {
        ref: oe,
        className: `reader-panel ${gn}${a ? "" : " is-hidden"}`,
        [ke]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          z ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: z }) : null,
          A ? /* @__PURE__ */ _("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: A })
          ] }) : null,
          et && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ut }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          x && !R ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Os,
            {
              file: x,
              loading: null,
              error: null,
              options: te,
              onLoadSuccess: We,
              onLoadError: we,
              className: "reader-react-pdf-document",
              children: Me.map((O) => {
                if (Ne.has(O))
                  return /* @__PURE__ */ p(
                    ad,
                    {
                      pane: t,
                      pageNumber: O,
                      width: me,
                      devicePixelRatio: ee,
                      active: ct.has(O),
                      textLayer: !Re || q.has(O),
                      syncedMinHeight: (c == null ? void 0 : c.get(O)) || 0,
                      onMetrics: u,
                      cachedAspect: be.get(O),
                      onAspectChange: Pe,
                      sentinelRef: Ue(O),
                      regionHighlight: (Oe == null ? void 0 : Oe.box.page) === O ? Oe : null,
                      regionTargets: Ke.get(O),
                      hoveredRegionId: b && $e.has(O) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(O - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(O - 1),
                      showLiveTranslation: P,
                      liveTranslationMissing: Kl(k, O - 1)
                    },
                    `${t}-${O}`
                  );
                const K = be.get(O) ?? ya, G = Math.max(120, Math.floor(me * K)), ae = Math.max(G, Math.ceil((c == null ? void 0 : c.get(O)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Ue(O),
                    [Le]: O,
                    [ke]: t,
                    [Yn]: G,
                    className: `${Qn} is-placeholder`,
                    style: {
                      width: me,
                      height: ae,
                      minHeight: ae
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: cn,
                        style: { width: me, height: G },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${O}`
                );
              })
            },
            E
          ) }) : null
        ]
      }
    );
  }
), Zr = pn(hd), pd = 2e3, gd = 6, bd = 500, Yr = "reader-react-resizing";
function yd(e, t) {
  const n = M(null), r = M(null);
  Ee(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = vd(e), k = Ht(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let u = 0, f = null, d = e.scrollHeight, h = d, g = 0, m = c;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const P of v) {
        const A = Math.round(P.contentRect.height);
        y.has(P.target) && y.get(P.target) !== A && (k = !0), y.set(P.target, A);
      }
      k && At(e, l, "auto", i);
    }), S = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(Yr);
      for (const k of Qr) e.removeEventListener(k, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, b = () => {
      At(e, l, "auto", i);
      const v = e.scrollHeight;
      g = v === h ? g + 1 : 0, h = v;
      const k = performance.now() - m;
      g >= gd && (v !== d || k > bd) || k > pd ? S() : u = requestAnimationFrame(b);
    };
    for (const v of Qr) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(Yr), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, m = performance.now(), d = e.scrollHeight, h = d, g = 0, u = requestAnimationFrame(b);
    }, qo);
  }, [e, t]), D(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function vd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Le}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ke) || null;
  }
  return null;
}
const Qr = ["wheel", "touchstart", "keydown", "pointerdown"];
function wd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Sd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(gn)) && ((n = e.hasAttribute) != null && n.call(e, ke)));
}
function kd(e, t) {
  D(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Sd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${gn}[${ke}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const l = wd(a, i);
        if (l === null || Math.abs(i.scrollLeft - l) < 1) continue;
        const c = i.scrollLeft;
        i.scrollLeft = l, Math.abs(i.scrollLeft - c) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Id(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), l = t - i, c = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: l * c };
}
function Rd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const eo = 12;
function or(e) {
  return Array.from(e.querySelectorAll(`.${gn}[${ke}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Ed(e) {
  const t = e.getBoundingClientRect();
  return or(e).map((n) => {
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
function Pd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Td(e, t) {
  return e ? or(e).find((n) => n.getAttribute(ke) === t) ?? null : null;
}
function Md({ shellEl: e }) {
  const [t, n] = T([]), r = M(0), o = C(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Ed(e);
      n((i) => Pd(i, s) ? i : s);
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
        for (const f of or(e))
          i.observe(f), f.firstElementChild && i.observe(f.firstElementChild);
      }
    };
    l();
    const c = s && typeof s.MutationObserver < "u" ? new s.MutationObserver(() => {
      l(), o();
    }) : null, u = e.firstElementChild;
    return c && u && c.observe(u, { childList: !0, attributes: !0, attributeFilter: ["class"], subtree: !1 }), () => {
      e.removeEventListener("scroll", o, { capture: !0 }), i == null || i.disconnect(), c == null || c.disconnect(), r.current && cancelAnimationFrame(r.current), r.current = 0;
    };
  }, [e, o]);
  const a = t.filter((s) => s.scrollWidth - s.width > 1);
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Nd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Nd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - eo * 2), r = Id(e, n), o = M(null);
  if (!r) return null;
  const a = (d) => {
    const h = Td(t, e.pane);
    h && (h.scrollLeft = d);
  }, s = (d) => {
    var h, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (h = d.currentTarget).setPointerCapture) == null || g.call(h, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const h = o.current;
    !h || h.pointerId !== d.pointerId || a(h.startScroll + Rd(e, n, r.size, d.clientX - h.startX));
  }, l = (d) => {
    var h, g, m;
    ((h = o.current) == null ? void 0 : h.pointerId) === d.pointerId && (o.current = null, (m = (g = d.currentTarget).releasePointerCapture) == null || m.call(g, d.pointerId));
  }, c = (d) => {
    if (d.button !== 0 || d.target !== d.currentTarget) return;
    d.preventDefault();
    const h = d.currentTarget.getBoundingClientRect(), g = d.clientX - h.left, m = e.width * 0.8;
    a(e.scrollLeft + (g < r.offset ? -m : m));
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
      style: { left: e.left + eo, width: n },
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
function va(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Ad(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Ld({ compare: e, onDone: t }) {
  return /* @__PURE__ */ _("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
        Z,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: va(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Lo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(fs, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ _("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ _(
        Z,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(ms, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ _(
        Z,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(hs, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function to({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Ad(t), a = [e === "compare" ? "对比" : "正在读", r, va(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ _("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function _d({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = T({ source: null, translated: null });
  return Ee(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const u = e.querySelector(`[${ke}="${c}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${ke}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ _("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(to, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(to, { role: "reading", ...n }) }) : null
  ] });
}
const xd = () => () => {
}, no = () => null;
function Dd({
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
function Cd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function zd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Od(e) {
  const t = Qe(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Zt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, m = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, A = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, z = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), F = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), N = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, R = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], L = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), x = (t == null ? void 0 : t.regionHover) ?? null, [j, $] = T(null), J = Mo(
    x ? x.subscribe : xd,
    x ? () => x.get().itemId : no,
    x ? () => x.get().itemId : no
  ), X = x ? J : j, re = C((le) => {
    x ? x.set(le, "pdf") : $(le);
  }, [x]), oe = Dd({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: u
  }), ue = Number.isFinite(g) && g > 0 ? Cd(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return yd(d, ue), kd(d, oe.compareMode), /* @__PURE__ */ _(
    "div",
    {
      ref: f,
      className: Ho,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(os).length,
      "data-reader-metadata-ready": L ? "true" : "false",
      children: [
        /* @__PURE__ */ _(
          "main",
          {
            className: `${jo} reader-mode-${oe.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Zr,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: P,
                  userZoom: h,
                  visible: oe.showSource,
                  scrollRoot: d,
                  pageWidthOverride: ue,
                  rowHeights: oe.compareMode ? m : void 0,
                  onMetrics: z,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: F,
                  onOutline: b ? void 0 : N,
                  onDocument: b ? void 0 : I,
                  activeRegion: R,
                  regions: (b == null ? void 0 : b.regions) ?? E,
                  readerMetadata: L,
                  hoveredRegionId: X,
                  onHoverRegion: re,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? zd(o) : "",
                  paneAction: u && oe.showTranslated ? /* @__PURE__ */ _(yt, { children: [
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
                Zr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: A,
                  userZoom: h,
                  visible: oe.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: ue,
                  rowHeights: oe.compareMode ? m : void 0,
                  onMetrics: z,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: F,
                  onOutline: N,
                  onDocument: I,
                  activeRegion: R,
                  regions: E,
                  readerMetadata: L,
                  hoveredRegionId: X,
                  onHoverRegion: re,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Md, { shellEl: d }),
        b ? /* @__PURE__ */ p(_d, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const $d = [
  { id: "source", label: "原文", Icon: xo },
  { id: "compare", label: "对照", Icon: Do },
  { id: "translated", label: "译文", Icon: Co }
];
function Fd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Bd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function jd(e) {
  const t = Qe(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? Fd(a.state) : "";
  return /* @__PURE__ */ _("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ _("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: $d.map(({ id: c, label: u, Icon: f }) => {
        const d = n === c, h = Bd({
          id: c,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ _(
          "button",
          {
            type: "button",
            className: `reader-workspace-tab${d ? " is-active" : ""}`,
            role: "tab",
            "aria-selected": d,
            "aria-label": u,
            title: h ? `${u} 需要文档任务` : u,
            disabled: h,
            onClick: () => o(c),
            children: [
              /* @__PURE__ */ p(f, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: u })
            ]
          },
          c
        );
      }) }),
      a ? /* @__PURE__ */ _("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ _(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${l}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ p(ps, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: l })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ _(
          Z,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(gs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ _(
        Z,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(bs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const Hd = To(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), Ud = Hd, Wd = {
  markdown: { label: "Markdown", short: "MD", Icon: Ud, needsJob: !0 }
}, Kd = Go.map(
  (e) => ({ id: e, ...Wd[e] })
);
function wa() {
  return Kd.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Vd(e) {
  const t = Qe(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(yt, { children: wa().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
    const u = n === s, f = c && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ _(
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
          /* @__PURE__ */ p(l, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function Jd(e) {
  const t = Qe(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = wa().map(({ id: l, label: c, short: u, Icon: f, needsJob: d }) => ({
    key: l,
    label: c,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === l,
    badge: r == null ? void 0 : r[l],
    onClick: () => a(l)
  }));
  return n ? /* @__PURE__ */ _("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: u, disabled: f, selected: d, badge: h, onClick: g }) => /* @__PURE__ */ _(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": d,
        className: `reader-assistant-dock-tab${d ? " is-active" : ""}`,
        title: f ? `${c} 需打开任务阅读` : c,
        disabled: f,
        onClick: g,
        children: [
          /* @__PURE__ */ p(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-assistant-dock-tab-label", children: c }),
          h ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: h }) : null
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
        children: /* @__PURE__ */ p(vt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function qd(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Gd(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Xd(e) {
  return e / 100 * window.innerHeight;
}
function Zd(e) {
  return e / 100 * window.innerWidth;
}
function Yd(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function jt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Yd(n);
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
      r = Gd(t, o);
      break;
    }
    case "em": {
      r = qd(t, o);
      break;
    }
    case "vh": {
      r = Xd(o);
      break;
    }
    case "vw": {
      r = Zd(o);
      break;
    }
  }
  return r;
}
function Se(e) {
  return parseFloat(e.toFixed(3));
}
function Lt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Un(e) {
  const { panels: t } = e, n = Lt({ group: e });
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
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Se(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Se(u / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = Se(u / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = Se(u / n * 100);
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
function ie(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Wn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Qd : ef
  );
}
function Qd(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function ef(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Sa(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function ka(e, t) {
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
function tf({
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
    const { x: i, y: l } = ka(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return ie(o, "No rect found"), o;
}
let nn;
function nf() {
  return nn === void 0 && (typeof matchMedia == "function" ? nn = !!matchMedia("(pointer:coarse)").matches : nn = !1), nn;
}
function Ia(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Wn(
    n,
    Array.from(t.children).filter(Sa).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, l = !1, c = -1, u = -1, f = 0, d, h = [];
  {
    let g = -1;
    for (const m of a)
      m.hasAttribute("data-panel") && (g++, m.hasAttribute("data-disabled") || (f++, c === -1 && (c = g), u = g));
  }
  if (f > 1) {
    let g = -1;
    for (const m of a)
      if (m.hasAttribute("data-panel")) {
        g++;
        const y = r.find(
          (w) => w.element === m
        );
        if (y) {
          if (d) {
            const w = d.element.getBoundingClientRect(), S = m.getBoundingClientRect();
            let b;
            if (l) {
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
              switch (h.length) {
                case 0: {
                  b = [
                    v,
                    k
                  ];
                  break;
                }
                case 1: {
                  const P = h[0], A = tf({
                    orientation: n,
                    rects: [w, S],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  b = [
                    P,
                    A === w ? k : v
                  ];
                  break;
                }
                default: {
                  b = h;
                  break;
                }
              }
            } else
              h.length ? b = h : b = [
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
              const P = nf() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < P) {
                const z = P - k.width;
                k = new DOMRect(
                  k.x - z / 2,
                  k.y,
                  k.width + z,
                  k.height
                );
              }
              if (k.height < P) {
                const z = P - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - z / 2,
                  k.width,
                  k.height + z
                );
              }
              const A = g <= c || g > u;
              !i && !A && s.push({
                group: e,
                groupSize: Lt({ group: e }),
                panels: [d, y],
                separator: "width" in v ? void 0 : v,
                rect: k
              }), i = !1;
            }
          }
          l = !1, d = y, h = [];
        }
      } else if (m.hasAttribute("data-separator")) {
        m.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (w) => w.element === m
        );
        y ? h.push(y) : (d = void 0, h = []);
      } else
        l = !0;
  }
  return s;
}
var rt;
class Ra {
  constructor() {
    kr(this, rt, {});
  }
  addListener(t, n) {
    const r = xt(this, rt)[t];
    return r === void 0 ? xt(this, rt)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = xt(this, rt)[t];
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
    Ir(this, rt, {});
  }
  removeListener(t, n) {
    const r = xt(this, rt)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
rt = new WeakMap();
let Mt = {
  cursorFlags: 0,
  state: "inactive"
};
const ar = new Ra();
function pt() {
  return Mt;
}
function rf(e) {
  return ar.addListener("change", e);
}
function of(e) {
  const t = Mt, n = { ...Mt };
  n.cursorFlags = e, Mt = n, ar.emit("change", {
    prev: t,
    next: n
  });
}
function Nt(e) {
  const t = Mt;
  Mt = e, ar.emit("change", {
    prev: t,
    next: e
  });
}
const af = (e) => e, Tn = () => {
}, Ea = 1, Pa = 2, Ta = 4, Ma = 8, ro = 3, oo = 12;
let rn;
function ao() {
  return rn === void 0 && (rn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (rn = !0)), rn;
}
function sf({
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
        if (e && ao()) {
          const a = (e & Ea) !== 0, s = (e & Pa) !== 0, i = (e & Ta) !== 0, l = (e & Ma) !== 0;
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
    return ao() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const so = /* @__PURE__ */ new WeakMap();
function sr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = so.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = pt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = sf({
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
  so.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Be = /* @__PURE__ */ new Map();
const Na = new Ra();
function lf(e) {
  Be = new Map(Be), Be.delete(e);
}
function io(e, t) {
  for (const [n] of Be)
    if (n.id === e)
      return n;
}
function st(e, t) {
  for (const [n, r] of Be)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function wt() {
  return Be;
}
function ir(e, t) {
  return Na.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ye(e, t, n) {
  const r = Be.get(e);
  Be = new Map(Be), Be.set(e, t), Na.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Aa(e) {
  const t = pt();
  let n = !1;
  switch (t.state) {
    case "active":
      Nt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (sr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = st(r.group.id, !0);
        Ye(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function lo(e) {
  e.defaultPrevented || Aa(e.currentTarget);
}
function cf(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = ka(n, a.rect);
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
function uf(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function df(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: fo(e),
    b: fo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ie(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: uo(co(n.a)),
    b: uo(co(n.b))
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
const ff = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function mf(e) {
  const t = getComputedStyle(La(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function hf(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || mf(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || ff.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function co(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ie(n, "Missing node"), hf(n)) return n;
  }
  return null;
}
function uo(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function fo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = La(e);
  return t;
}
function La(e) {
  const { parentNode: t } = e;
  return uf(t) ? t.host : t;
}
function pf(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function gf({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Sa(n) || n.contains(e) || e.contains(n))
    return !0;
  if (df(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (pf(r.getBoundingClientRect(), t))
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
    const a = Ia(o), s = cf(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && gf({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function bf(e, t) {
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
function Fe(e, t) {
  return ve(e, t) ? 0 : e > t ? 1 : -1;
}
function Tt({
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
  if (Fe(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      Fe(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = Se(r), r;
}
function Jt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (ve(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), l = Object.values(o), c = [...i], [u, f] = r;
  ie(u != null, "Invalid first pivot index"), ie(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const m = e < 0 ? f : u, y = n[m];
        ie(
          y,
          `Panel constraints not found for index ${m}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const v = i[m];
          if (ie(
            v != null,
            `Previous layout not found for panel index ${m}`
          ), ve(v, w)) {
            const k = b - v;
            Fe(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const m = e < 0 ? u : f, y = n[m];
        ie(
          y,
          `No panel constraints found for index ${m}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const v = i[m];
          if (ie(
            v != null,
            `Previous layout not found for panel index ${m}`
          ), ve(v, b)) {
            const k = v - w;
            Fe(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const m = e < 0 ? f : u, y = n[m];
      ie(
        y,
        `Panel constraints not found for index ${m}`
      );
      const w = i[m], { collapsible: S, collapsedSize: b, minSize: v } = y;
      if (S && Fe(w, v) < 0)
        if (e > 0) {
          const k = v - b, P = k / 2, A = w + e;
          Fe(A, v) < 0 && (e = Fe(e, P) <= 0 ? 0 : k);
        } else {
          const k = v - b, P = 100 - k / 2, A = w - e;
          Fe(A, v) < 0 && (e = Fe(100 + e, P) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const m = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const b = i[y];
      ie(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const v = Tt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (w += v, y += m, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - S : S;
  }
  {
    let m = e < 0 ? u : f;
    for (; m >= 0 && m < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), w = i[m];
      ie(
        w != null,
        `Previous layout not found for panel index ${m}`
      );
      const S = w - y, b = Tt({
        overrideDisabledPanels: s,
        panelConstraints: n[m],
        prevSize: w,
        size: S
      });
      if (!ve(w, b) && (d += w - b, c[m] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? m-- : m++;
    }
  }
  if (bf(l, c))
    return o;
  {
    const m = e < 0 ? f : u, y = i[m];
    ie(
      y != null,
      `Previous layout not found for panel index ${m}`
    );
    const w = y + d, S = Tt({
      overrideDisabledPanels: s,
      panelConstraints: n[m],
      prevSize: y,
      size: w
    });
    if (c[m] = S, !ve(S, w)) {
      let b = w - S, v = e < 0 ? f : u;
      for (; v >= 0 && v < n.length; ) {
        const k = c[v];
        ie(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const P = k + b, A = Tt({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: P
        });
        if (ve(k, A) || (b -= A - k, c[v] = A), ve(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const h = Object.values(c).reduce(
    (m, y) => y + m,
    0
  );
  if (!ve(h, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return c.reduce((m, y, w) => (m[g[w]] = y, m), {});
}
function gt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Fe(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function bt({
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
      ie(l != null, `No layout data found for index ${i}`);
      const c = 100 / o * l;
      r[i] = c;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const l = n[i];
    ie(l != null, `No layout data found for index ${i}`);
    const c = r[i];
    ie(c != null, `No layout data found for index ${i}`);
    const u = Tt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: l,
      size: c
    });
    c != u && (a += c - u, r[i] = u);
  }
  if (!ve(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      ie(l != null, `No layout data found for index ${i}`);
      const c = l + a, u = Tt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== u && (a -= u - l, r[i] = u, ve(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, l, c) => (i[s[c]] = l, i), {});
}
function _a({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = wt();
    for (const [
      c,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: f,
        layout: d,
        groupSize: h,
        separatorToPanels: g
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: f,
          group: c,
          groupSize: h,
          layout: d,
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
    prevLayout: u,
    derivedPanelConstraints: f
  }) => {
    const d = a(), h = c.findIndex((y) => y.id === t), g = h === 0, m = h === c.length - 1;
    if (m && l < d && (g || c.slice(0, h).every((y, w) => {
      const S = f[w];
      return (S == null ? void 0 : S.collapsible) && ve(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = c.slice(0, h).reduce((w, S) => w + u[S.id], 0);
      return {
        ...u,
        [t]: Se(100 - y)
      };
    }
    return Jt({
      delta: m ? d - l : l - d,
      initialLayout: u,
      panelConstraints: f,
      pivotIndices: m ? [h - 1, h] : [h, h + 1],
      prevLayout: u,
      trigger: "imperative-api"
    });
  }, i = (l) => {
    const c = a();
    if (l === c)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      group: d,
      groupSize: h,
      layout: g,
      separatorToPanels: m
    } = n(), y = s({
      nextSize: l,
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
      groupSize: h,
      layout: w,
      separatorToPanels: m
    });
  };
  return {
    collapse: () => {
      const { collapsible: l, collapsedSize: c } = r(), { mutableValues: u } = o(), f = a();
      l && f !== c && (u.expandToSize = f, i(c));
    },
    expand: () => {
      const { collapsible: l, collapsedSize: c, minSize: u } = r(), { mutableValues: f } = o(), d = a();
      if (l && d === c) {
        let h = f.expandToSize ?? u;
        h === 0 && (h = 1), i(h);
      }
    },
    getSize: () => {
      const { group: l } = n(), c = a(), { element: u } = o(), f = l.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: c,
        inPixels: f
      };
    },
    isCollapsed: () => {
      const { collapsible: l, collapsedSize: c } = r(), u = a();
      return l && ve(c, u);
    },
    resize: (l) => {
      const { group: c } = n(), { element: u } = o(), f = Lt({ group: c }), d = jt({
        groupSize: f,
        panelElement: u,
        styleProp: l
      }), h = Se(d / f * 100);
      i(h);
    }
  };
}
function mo(e) {
  if (e.defaultPrevented)
    return;
  const t = wt();
  lr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = _a({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function on(e) {
  const t = wt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function xa({
  groupId: e
}) {
  const t = () => {
    const n = wt();
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
      } = t(), c = bt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (gt(i, c) || Ye(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function ft(e, t) {
  const n = on(e), r = st(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ie(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ie(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = xa({ groupId: n.id }).getLayout(), l = Jt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = bt({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  gt(i, c) || Ye(
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
function ho(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = on(t);
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
        const r = on(t), o = st(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (d) => d.element === t
        );
        ie(l, "Matching separator not found");
        const c = i.get(l);
        ie(c, "Matching panels not found");
        const u = c[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (ie(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], h = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ft(t, h - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = on(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        ie(o !== null, "Index not found");
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
function po(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = wt(), n = lr(e, t), r = /* @__PURE__ */ new Map();
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
function Da({
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
    const { group: u, groupSize: f } = c, { orientation: d, panels: h } = u, { disableCursor: g } = u.mutableState;
    let m = 0;
    a ? d === "horizontal" ? m = (t.clientX - a.x) / f * 100 : m = (t.clientY - a.y) / f * 100 : d === "horizontal" ? m = t.clientX < 0 ? -100 : 100 : m = t.clientY < 0 ? -100 : 100;
    const y = r.get(u), w = o.get(u);
    if (!y || !w)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: b,
      groupSize: v,
      layout: k,
      separatorToPanels: P
    } = w;
    if (b && k && P) {
      const A = Jt({
        delta: m,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: c.panels.map((z) => h.indexOf(z)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (gt(A, k)) {
        if (m !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= m < 0 ? Ea : Pa;
              break;
            }
            case "vertical": {
              i |= m < 0 ? Ta : Ma;
              break;
            }
          }
      } else
        Ye(c.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: A,
          separatorToPanels: P
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & ro : l |= i & ro, t.movementY === 0 ? l |= s & oo : l |= i & oo, of(l), sr(e);
}
function go(e) {
  const t = wt(), n = pt();
  switch (n.state) {
    case "active":
      Da({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function bo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = pt(), n = wt();
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
          const s = st(a.group.id, !0);
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
      Da({
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
      }), sr(e.currentTarget);
      break;
    }
  }
}
function yo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (pt().state) {
      case "hover":
        Nt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function vo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Aa(e.currentTarget) && e.preventDefault();
}
function wo(e) {
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
function yf(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = Lt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Se(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function vf(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function wf({
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
    const d = r[f.id] ?? 0;
    switch (f.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const h = d / 100 * n, g = Se(
          h / t * 100
        );
        i.set(f.id, g), o += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        l.push(f.id), a += d;
        break;
      }
    }
  }
  if (!s || l.length === 0)
    return r;
  const c = 100 - o, u = { ...r };
  if (i.forEach((f, d) => {
    u[d] = f;
  }), a > 0)
    for (const f of l) {
      const d = r[f] ?? 0;
      u[f] = Se(
        d / a * c
      );
    }
  else {
    const f = Se(
      c / l.length
    );
    for (const d of l)
      u[d] = f;
  }
  return u;
}
function Sf(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const It = /* @__PURE__ */ new Map();
function kf(e) {
  let t = !0;
  ie(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const m of g) {
      const { borderBoxSize: y, target: w } = m;
      if (w === e.element) {
        if (t) {
          const S = Lt({ group: e });
          if (S === 0)
            return;
          const b = st(e.id);
          if (!b)
            return;
          const v = Un(e), k = b.defaultLayoutDeferred ? wo(v) : b.layout, P = wf({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: k
          }), A = bt({
            layout: P,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && gt(b.layout, A) && vf(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === S)
            return;
          Ye(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: A,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        yf(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    ie(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Lt({ group: e }), i = Un(e), l = e.panels.map(({ id: g }) => g).join(",");
  let c = e.mutableState.defaultLayout;
  c && (Sf(e.panels, c) || (c = void 0));
  const u = e.mutableState.layouts[l] ?? c ?? wo(i), f = bt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  It.set(
    d,
    (It.get(d) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return Ia(e).forEach((g) => {
    g.separator && h.set(g.separator, g.panels);
  }), Ye(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: h
  }), e.separators.forEach((g) => {
    ie(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", ho);
  }), It.get(d) === 1 && (d.addEventListener("contextmenu", lo, !0), d.addEventListener("dblclick", mo, !0), d.addEventListener("pointerdown", po, !0), d.addEventListener("pointerleave", go), d.addEventListener("pointermove", bo), d.addEventListener("pointerout", yo), d.addEventListener("pointerup", vo, !0)), function() {
    t = !1, It.set(
      d,
      Math.max(0, (It.get(d) ?? 0) - 1)
    ), lf(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", ho);
    }), It.get(d) || (d.removeEventListener(
      "contextmenu",
      lo,
      !0
    ), d.removeEventListener(
      "dblclick",
      mo,
      !0
    ), d.removeEventListener(
      "pointerdown",
      po,
      !0
    ), d.removeEventListener("pointerleave", go), d.removeEventListener("pointermove", bo), d.removeEventListener("pointerout", yo), d.removeEventListener("pointerup", vo, !0)), a.disconnect();
  };
}
function If() {
  const [e, t] = T({}), n = C(() => t({}), []);
  return [e, n];
}
function cr(e) {
  const t = No();
  return `${e ?? t}`;
}
const St = typeof window < "u" ? Ee : D;
function Ut(e) {
  const t = M(e);
  return St(() => {
    t.current = e;
  }, [e]), C(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function ur(...e) {
  return Ut((t) => {
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
function dr(e) {
  const t = M({ ...e });
  return St(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Ca = qn(null);
function Rf(e, t) {
  const n = M({
    getLayout: () => ({}),
    setLayout: af
  });
  Xn(t, () => n.current, []), St(() => {
    Object.assign(
      n.current,
      xa({ groupId: e })
    );
  });
}
function za({
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
  orientation: u = "horizontal",
  resizeTargetMinimumSize: f = {
    coarse: 20,
    fine: 10
  },
  style: d,
  ...h
}) {
  const g = M({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), m = Ut((I) => {
    gt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, l == null || l(I));
  }), y = Ut(
    (I, R) => {
      gt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, c == null || c(I, { isUserInteraction: R }));
    }
  ), w = cr(i), S = M(null), [b, v] = If(), k = M({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), P = ur(S, a);
  Rf(w, s);
  const A = Ut(
    (I, R) => {
      const E = pt(), L = io(I), x = st(I);
      if (x) {
        let j = !1;
        switch (E.state) {
          case "active": {
            j = E.hitRegions.some(
              ($) => $.group === L
            );
            break;
          }
        }
        return {
          flexGrow: x.layout[R] ?? 1,
          pointerEvents: j ? "none" : void 0
        };
      }
      if (n != null && n[R])
        return {
          flexGrow: n == null ? void 0 : n[R]
        };
    }
  ), z = dr({
    defaultLayout: n,
    disableCursor: r
  }), F = V(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: A,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const R = k.current;
        return R.panels = Wn(u, [
          ...R.panels,
          I
        ]), v(), () => {
          R.panels = R.panels.filter(
            (E) => E !== I
          ), v();
        };
      },
      registerSeparator: (I) => {
        const R = k.current;
        return R.separators = Wn(u, [
          ...R.separators,
          I
        ]), v(), () => {
          R.separators = R.separators.filter(
            (E) => E !== I
          ), v();
        };
      },
      updatePanelProps: (I, { disabled: R }) => {
        const E = k.current.panels.find(
          (j) => j.id === I
        );
        E && (E.panelConstraints.disabled = R);
        const L = io(w), x = st(w);
        L && x && Ye(L, {
          ...x,
          derivedPanelConstraints: Un(L)
        });
      },
      updateSeparatorProps: (I, {
        disabled: R,
        disableDoubleClick: E
      }) => {
        const L = k.current.separators.find(
          (x) => x.id === I
        );
        L && (L.disabled = R, L.disableDoubleClick = E);
      }
    }),
    [A, w, v, u, z]
  ), N = M(null);
  return St(() => {
    const I = S.current;
    if (I === null)
      return;
    const R = k.current;
    let E;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === R.panels.length) {
      E = {};
      for (const re of R.panels) {
        const oe = z.defaultLayout[re.id];
        oe !== void 0 && (E[re.id] = oe);
      }
    }
    const L = {
      disabled: !!o,
      element: I,
      id: w,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!z.disableCursor,
        expandedPanelSizes: k.current.lastExpandedPanelSizes,
        layouts: k.current.layouts
      },
      orientation: u,
      panels: R.panels,
      resizeTargetMinimumSize: R.resizeTargetMinimumSize,
      separators: R.separators
    };
    N.current = L;
    const x = kf(L), { defaultLayoutDeferred: j, derivedPanelConstraints: $, layout: J } = st(L.id, !0);
    !j && $.length > 0 && (m(J), y(J, !1));
    const X = ir(w, (re) => {
      const { defaultLayoutDeferred: oe, derivedPanelConstraints: ce, layout: ue } = re.next;
      if (oe || ce.length === 0)
        return;
      const le = L.panels.map(({ id: ee }) => ee).join(",");
      L.mutableState.layouts[le] = ue, ce.forEach((ee) => {
        if (ee.collapsible) {
          const { layout: te } = re.prev ?? {};
          if (te) {
            const me = ve(
              ee.collapsedSize,
              ue[ee.panelId]
            ), be = ve(
              ee.collapsedSize,
              te[ee.panelId]
            );
            me && !be && (L.mutableState.expandedPanelSizes[ee.panelId] = te[ee.panelId]);
          }
        }
      });
      const xe = pt().state !== "active";
      m(ue), xe && y(ue, re.isUserInteraction);
    });
    return () => {
      N.current = null, x(), X();
    };
  }, [
    o,
    w,
    y,
    m,
    u,
    b,
    z
  ]), D(() => {
    const I = N.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Ca.Provider, { value: F, children: /* @__PURE__ */ p(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
      ref: P,
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
za.displayName = "Group";
function fr() {
  const e = Gn(Ca);
  return ie(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Ef(e, t) {
  const { id: n } = fr(), r = M({
    collapse: Tn,
    expand: Tn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Tn
  });
  Xn(t, () => r.current, []), St(() => {
    Object.assign(
      r.current,
      _a({ groupId: n, panelId: e })
    );
  });
}
function Kn({
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
  minSize: u = "0%",
  onResize: f,
  panelRef: d,
  style: h,
  ...g
}) {
  const m = !!l, y = cr(l), w = dr({
    disabled: a
  }), S = M(null), b = ur(S, s), {
    getPanelStyles: v,
    id: k,
    orientation: P,
    registerPanel: A,
    updatePanelProps: z
  } = fr(), F = f !== null, N = Ut(
    (L, x, j) => {
      f == null || f(L, l, j);
    }
  );
  St(() => {
    const L = S.current;
    if (L !== null) {
      const x = {
        element: L,
        id: y,
        idIsStable: m,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: F ? N : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: w.disabled,
          maxSize: c,
          minSize: u
        }
      };
      return A(x);
    }
  }, [
    i,
    n,
    r,
    o,
    F,
    y,
    m,
    c,
    u,
    N,
    A,
    w
  ]), D(() => {
    z(y, { disabled: a });
  }, [a, y, z]), Ef(y, d);
  const I = () => {
    const L = v(k, y);
    if (L)
      return JSON.stringify(L);
  }, R = Mo(
    (L) => ir(k, L),
    I,
    I
  );
  let E;
  return R ? E = JSON.parse(R) : o !== void 0 ? E = {
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
        ...Pf,
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
            ...h,
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
Kn.displayName = "Panel";
const Pf = {
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
function Tf({
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
    const l = i.maxSize, c = i.collapsible ? i.collapsedSize : i.minSize, u = [r, r + 1];
    a = bt({
      layout: Jt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = bt({
      layout: Jt({
        delta: l - s,
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
function Oa({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = cr(a), c = dr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = T({}), [d, h] = T("inactive"), [g, m] = T(!1), y = M(null), w = ur(y, o), {
    disableCursor: S,
    id: b,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: P
  } = fr(), A = v === "horizontal" ? "vertical" : "horizontal";
  St(() => {
    const N = y.current;
    if (N !== null) {
      const I = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: N,
        id: l
      }, R = k(I), E = rf(
        (x) => {
          h(
            x.next.state !== "inactive" && x.next.hitRegions.some(
              (j) => j.separator === I
            ) ? x.next.state : "inactive"
          );
        }
      ), L = ir(
        b,
        (x) => {
          const { derivedPanelConstraints: j, layout: $, separatorToPanels: J } = x.next, X = J.get(I);
          if (X) {
            const re = X[0], oe = X.indexOf(re);
            f(
              Tf({
                layout: $,
                panelConstraints: j,
                panelId: re.id,
                panelIndex: oe
              })
            );
          }
        }
      );
      return () => {
        E(), L(), R();
      };
    }
  }, [b, l, k, c]), D(() => {
    P(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, P]);
  let z;
  n && !S && (z = "not-allowed");
  let F;
  if (n)
    F = "disabled";
  else
    switch (d) {
      case "active": {
        F = "active";
        break;
      }
      default:
        g ? F = "focus" : F = d;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": A,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": F,
      "data-testid": l,
      id: l,
      onBlur: () => m(!1),
      onFocus: () => m(!0),
      ref: w,
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
Oa.displayName = "Separator";
const mr = 30, hr = 65, qt = 50, Mf = 100 - hr, Nf = 100 - mr;
function Af(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(hr, Math.max(mr, t)) : qt;
}
function pr(e) {
  return 100 - e;
}
function Rt(e) {
  return `${e}%`;
}
const gr = "reader-document", Gt = "reader-assistant", $a = "retainpdf.reader.ai-split-layout.v1", Lf = {
  [gr]: pr(qt),
  [Gt]: qt
};
function br(e) {
  const t = Af(e == null ? void 0 : e[Gt]);
  return {
    [gr]: pr(t),
    [Gt]: t
  };
}
function _f() {
  try {
    const e = JSON.parse(localStorage.getItem($a) || "null");
    return br(e);
  } catch {
    return Lf;
  }
}
function xf(e) {
  try {
    localStorage.setItem($a, JSON.stringify(br(e)));
  } catch {
  }
}
function Mn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = br(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Gt]}vw`
  );
}
function Df() {
  const e = M(null), [t] = T(_f);
  Ee(() => {
    const o = e.current;
    return Mn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = C((o) => {
    Mn(e.current, o);
  }, []), r = C((o, a) => {
    Mn(e.current, o), a.isUserInteraction && xf(o);
  }, []);
  return /* @__PURE__ */ _(
    za,
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
          Kn,
          {
            id: gr,
            defaultSize: Rt(pr(qt)),
            minSize: Rt(Mf),
            maxSize: Rt(Nf)
          }
        ),
        /* @__PURE__ */ p(
          Oa,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Kn,
          {
            id: Gt,
            defaultSize: Rt(qt),
            minSize: Rt(mr),
            maxSize: Rt(hr)
          }
        )
      ]
    }
  );
}
function Cf({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = T(!1);
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
    n ? /* @__PURE__ */ p(Z, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function zf({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Cf, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ _(yt, { children: [
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
      s ? /* @__PURE__ */ p(Z, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Of(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function $f() {
  const [e, t] = T(!1), n = No(), r = M(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Of(a.target)) return;
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
        children: /* @__PURE__ */ p(ys, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: oc.map((o) => /* @__PURE__ */ _("section", { className: "reader-react-shortcuts-group", children: [
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
const Ff = ["source", "sideBySide", "translated"], Bf = { source: "", translated: "", sideBySide: "" };
function jf(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = an(e.sourceUrl), n = an(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Xs({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Hf(e) {
  const [t, n] = T(() => /* @__PURE__ */ new Set()), r = V(
    () => e ? jf(e) : Bf,
    [e]
  ), o = V(
    () => Ff.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = C(async (s) => {
    if (!e) return;
    const i = an(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? Gs(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Zs(
          e.fetchProtected,
          i,
          l,
          l,
          null,
          (c) => n((u) => {
            const f = new Set(u);
            return c ? f.add(s) : f.delete(s), f;
          })
        );
      } catch (l) {
        const c = l instanceof Error ? l.message : "下载失败";
        Ys(c), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Uf = {
  source: xo,
  sideBySide: Do,
  translated: Co
}, Wf = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Kf(e) {
  const t = Qe(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Hf(n), i = M(null);
  return D(() => {
    const l = () => {
      var f;
      (f = i.current) != null && f.open && (i.current.open = !1);
    }, c = (f) => {
      i.current && !i.current.contains(f.target) && l();
    }, u = (f) => {
      f.key === "Escape" && l();
    };
    return document.addEventListener("pointerdown", c), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", c), document.removeEventListener("keydown", u);
    };
  }, []), /* @__PURE__ */ _("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ _("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(vs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(_o, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = Xa[l], u = an(r[l]), f = a.has(l), d = !!u && !f, h = d ? "" : Za(l, r), g = Uf[l];
      return /* @__PURE__ */ _(
        "button",
        {
          type: "button",
          id: `reader-download-${l}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !d,
          "aria-label": d ? `下载${c.label}` : h,
          onClick: () => {
            i.current && (i.current.open = !1), s(l);
          },
          children: [
            /* @__PURE__ */ p(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ _("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ _("span", { className: "reader-download-action-label", children: [
                Wf[l],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        l
      );
    }) })
  ] });
}
const Vf = "retainpdf:reader:bookmarks:v1:", Jf = 200;
function yr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Fa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Vf}${t}` : "";
}
function qf(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function hn(e, t = yr()) {
  const n = Fa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = qf(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Vn(e, t, n) {
  const r = Fa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Jf);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Gf(e, t, n = "", { storage: r = yr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = hn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Vn(e, a.filter((i) => i.page !== s), r) : Vn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Xf(e, t, n = yr()) {
  return Vn(e, hn(e, n).filter((r) => r.page !== t), n);
}
function Zf(e, t) {
  var r, o, a, s;
  let n = null;
  for (const i of e || []) {
    if (`${(i == null ? void 0 : i.regionType) || ""}` != "heading") continue;
    const l = Number(((r = i.source) == null ? void 0 : r.page) ?? ((o = i.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(l) || l > t) continue;
    const c = `${((a = i.translated) == null ? void 0 : a.text) || i.markdown || ((s = i.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!c) continue;
    const u = Number(i.readingOrder) || 0;
    (!n || l > n.page || l === n.page && u >= n.order) && (n = { page: l, order: u, text: c });
  }
  return n ? n.text.slice(0, 60) : "";
}
function Yf({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Qf({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = T(() => hn(e)), [i, l] = T(!1), c = M(null);
  if (D(() => {
    s(hn(e)), l(!1);
  }, [e]), D(() => {
    if (!i) return;
    const d = (g) => {
      c.current && !c.current.contains(g.target) && l(!1);
    }, h = (g) => {
      g.key === "Escape" && l(!1);
    };
    return document.addEventListener("pointerdown", d), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", d), document.removeEventListener("keydown", h);
    };
  }, [i]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), f = a.some((d) => d.page === u);
  return /* @__PURE__ */ _("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: c, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Gf(e, u, Zf(r, u))),
        children: /* @__PURE__ */ p(Yf, { filled: f })
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
        onClick: () => l((d) => !d),
        children: [
          /* @__PURE__ */ p(ws, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ _("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ _(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), l(!1);
          },
          children: [
            /* @__PURE__ */ _("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(Xf(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function em(e) {
  const [t, n] = T([]);
  return D(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = lt().loadIssues;
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
function tm(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const nm = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, rm = ["failed", "content", "layout"];
function om(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function am({ jobId: e, currentPage: t }) {
  var f;
  const n = em(e), r = (f = Qe()) == null ? void 0 : f.jumpToBlock, [o, a] = T(!1), [s, i] = T(-1), l = M(null);
  D(() => i(-1), [n]);
  const c = (d) => {
    const h = n[d];
    !h || !r || (i(d), r(h.readerItemId));
  }, u = M({ issues: n, last: s, currentPage: t, goTo: c });
  return u.current = { issues: n, last: s, currentPage: t, goTo: c }, D(() => {
    const d = (h) => {
      if (h.key.toLowerCase() !== "n" || h.metaKey || h.ctrlKey || h.altKey || om(h.target)) return;
      const { issues: g, last: m, currentPage: y, goTo: w } = u.current, S = tm(g, m, y, h.shiftKey);
      S < 0 || (h.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), D(() => {
    if (!o) return;
    const d = (h) => {
      var g;
      (g = l.current) != null && g.contains(h.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ _("div", { className: "reader-react-hud-group reader-issues", ref: l, "aria-label": "待处理", children: [
    /* @__PURE__ */ _(
      Z,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ p(Ss, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ _("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      rm.map((d) => {
        const h = n.map((g, m) => ({ issue: g, index: m })).filter(({ issue: g }) => g.kind === d);
        return h.length ? /* @__PURE__ */ _("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ _("h4", { children: [
            nm[d],
            /* @__PURE__ */ p("span", { children: h.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: h.map(({ issue: g, index: m }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
            Z,
            {
              className: "reader-issues-item",
              "aria-current": m === s ? "true" : void 0,
              onClick: () => {
                c(m), a(!1);
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
        ] }, d) : null;
      })
    ] }) : null
  ] }) : null;
}
const sm = 48, im = 96, lm = 700;
function cm(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= sm, downSoFar: r };
}
function um(e) {
  const [t, n] = T(!1), r = M(0);
  return D(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), l = () => {
      const d = e.current;
      return !!(d && (d.querySelector(":focus-visible") || d.querySelector("[aria-expanded='true']")));
    }, c = (d) => {
      const h = d.target;
      if (!(h instanceof Element) || (i.has(h) || i.set(h, !!h.querySelector(`[${Le}]`)), !i.get(h))) return;
      const g = h.scrollTop, m = o.get(h);
      if (o.set(h, g), m === void 0 || Date.now() - a > lm) return;
      const y = cm(!1, r.current, g - m);
      r.current = y.downSoFar, g - m < -4 ? n(!1) : y.hidden && !l() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - im && (r.current = 0, n(!1));
    }, f = () => {
      l() && n(!1);
    };
    document.addEventListener("scroll", c, { capture: !0, passive: !0 }), window.addEventListener("pointermove", u, { passive: !0 }), document.addEventListener("focusin", f);
    for (const d of ["wheel", "touchmove", "keydown"]) window.addEventListener(d, s, { passive: !0, capture: !0 });
    return () => {
      for (const d of ["wheel", "touchmove", "keydown"]) window.removeEventListener(d, s, { capture: !0 });
      document.removeEventListener("scroll", c, { capture: !0 }), window.removeEventListener("pointermove", u), document.removeEventListener("focusin", f);
    };
  }, [e]), t;
}
function dm(e) {
  const t = Qe(), n = ba(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Zt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Fi(a), f = a > Wo + 1e-3, d = a < fn - 1e-3, h = Pt(r, at()), g = h >= fn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", m = M(null), y = um(m), [w, S] = T(!1), [b, v] = T(`${i}`);
  D(() => {
    w || v(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, w]);
  const k = () => {
    if (S(!1), !c || l <= 0)
      return;
    const P = Number(`${b}`.trim());
    c(mn(P, l));
  };
  return /* @__PURE__ */ _("div", { ref: m, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ _(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (P) => {
          P.preventDefault(), k();
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
              onChange: (P) => v(P.target.value.replace(/[^\d]/g, "")),
              onBlur: k,
              onKeyDown: (P) => {
                P.key === "Escape" && (P.preventDefault(), S(!1), v(`${i}`));
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
          !c || l <= 0 || (v(`${i}`), S(!0));
        },
        children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      Qf,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(am, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      Z,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(fm, {})
      }
    ) }) : null,
    /* @__PURE__ */ _("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(Vt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ _(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${u}%，点击${g}`,
          title: g,
          onClick: () => s(h),
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
          onClick: () => s(Vt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p($f, {}) })
  ] });
}
function fm() {
  return /* @__PURE__ */ _("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function So(e) {
  var t, n;
  return Xo(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function mm(e) {
  const [t, n] = T(() => ({
    scope: e,
    panel: So(je(e))
  }));
  D(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: So(je(e))
    });
  }, [e]), D(() => {
    t.scope === e && bn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = C((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Jn = "download-toast";
function hm({
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
function pm(e = {}) {
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
    () => /* @__PURE__ */ p(hm, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Jn, duration: 1 / 0 }
  );
}
function gm() {
  const e = C((t) => {
    t && (t.setState = pm, t.hide = () => Ln.dismiss(Jn));
  }, []);
  return /* @__PURE__ */ _(yt, { children: [
    /* @__PURE__ */ p(Cs, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function bm(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Vo(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function ym(e, t) {
  return t === null || e !== t;
}
function vm(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
function wm(e, t) {
  const n = e === t;
  return { open: n, mounted: vm(n) };
}
const ko = { itemId: null, origin: null };
function Sm() {
  let e = ko;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? ko : { itemId: n, origin: r };
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
function km({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = V(() => Ic(e, t), [e, t]), [o, a] = T(() => /* @__PURE__ */ new Set([...$r(r), ...r ? [r] : []]));
  D(() => {
    a(/* @__PURE__ */ new Set([...$r(r), ...r ? [r] : []]));
  }, [e]);
  const s = M(null);
  D(() => {
    var c, u;
    (u = (c = s.current) == null ? void 0 : c.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (c) => a((u) => {
    const f = new Set(u);
    return f.has(c) ? f.delete(c) : f.add(c), f;
  }), l = (c) => c.map((u) => {
    const f = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ _("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ _("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          Z,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(zo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ _(
          Z,
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
      d && f ? /* @__PURE__ */ p("ol", { className: "reader-bookmark-children", children: l(u.children) }) : null
    ] }, u.id);
  });
  return /* @__PURE__ */ p("ol", { ref: s, className: "reader-finder-list reader-bookmark-tree", "aria-label": "书签", children: l(e) });
}
const Im = [], Rm = [];
function Em({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ _("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(Z, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(ks, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Pm({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    Z,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(Is, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Tm({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: l = Rm,
  onJumpPage: c
}) {
  var N, I;
  const u = ((N = Qe()) == null ? void 0 : N.regions) ?? Im, f = ((I = ba()) == null ? void 0 : I.currentPage) ?? 1, d = V(() => Lc(u), [u]), h = l.length > 0 && !!c, [g, m] = T("bookmarks"), y = h && (g === "bookmarks" || !d.length), w = _c(d, f), S = V(() => Cc(u, s), [u, s]), [b, v] = T(-1);
  D(() => v(-1), [s]);
  const k = M(null), P = M(null), A = M(n);
  A.current = n, D(() => {
    const R = (L) => {
      var j, $;
      const x = L.target;
      !x || (j = P.current) != null && j.contains(x) || ($ = x.closest) != null && $.call(x, ".reader-finder-toggles, [data-finder-toggle]") || A.current();
    }, E = (L) => {
      L.key === "Escape" && A.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", E), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", E);
    };
  }, []);
  const z = M(null);
  D(() => {
    var R, E, L;
    e === "search" ? (R = k.current) == null || R.focus() : (L = (E = z.current) == null ? void 0 : E.querySelector('[aria-current="location"]')) == null || L.scrollIntoView({ block: "center" });
  }, [e, i]), D(() => {
    var R, E;
    e === "search" && b >= 0 && ((E = (R = z.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null || E.scrollIntoView({ block: "nearest" }));
  }, [e, b]);
  const F = (R) => {
    const E = S[R];
    E && (v(R), r(E.itemId));
  };
  return /* @__PURE__ */ _("aside", { ref: P, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ _("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ _("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(Z, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(Z, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(Z, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(vt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && h && d.length ? /* @__PURE__ */ _("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(Z, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => m("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ p(Z, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => m("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && c ? /* @__PURE__ */ p(km, { nodes: l, currentPage: f, onJumpPage: c }) : e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: z, className: "reader-finder-list", children: d.map((R, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
      Z,
      {
        className: "reader-finder-entry",
        "data-level": R.level,
        "aria-current": E === w ? "location" : void 0,
        onClick: () => r(R.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: R.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
        ]
      }
    ) }, R.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ _(yt, { children: [
      /* @__PURE__ */ _("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          Oo,
          {
            ref: k,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (R) => a(R.target.value),
            onKeyDown: (R) => {
              R.key === "Enter" ? (R.preventDefault(), F(zc(b, S.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: S.length === 0 ? "没有找到" : `${b >= 0 ? `第 ${b + 1} / ` : ""}${S.length >= 200 ? "200+ 处，只列前 200 处" : `${S.length} 处`}${b < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: S.map((R, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(Z, { className: "reader-finder-entry is-hit", "aria-current": E === b ? "true" : void 0, onClick: () => F(E), children: [
        /* @__PURE__ */ _("span", { className: "reader-finder-entry-text", children: [
          R.snippet.slice(0, R.at),
          /* @__PURE__ */ p("mark", { children: R.snippet.slice(R.at, R.at + R.length) }),
          R.snippet.slice(R.at + R.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
      ] }) }, R.itemId)) })
    ] })
  ] });
}
function Mm({ active: e, compare: t, ink: n }) {
  const [r, o] = T(!1), [a, s] = T(!1), i = M(null);
  D(() => {
    if (!r && !a) return;
    const c = () => {
      o(!1), s(!1);
    }, u = (d) => {
      var h;
      (h = i.current) != null && h.contains(d.target) || c();
    }, f = (d) => {
      d.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", u, !0), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", u, !0), document.removeEventListener("keydown", f);
    };
  }, [r, a]);
  const l = !!(t.compared || t.loading);
  return /* @__PURE__ */ _("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(Ld, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ _("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        Z,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(Zn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(Vd, { active: e }),
      t.available ? /* @__PURE__ */ p(
        Z,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ p(Rs, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ p(
      Z,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || l ? "true" : void 0,
        onClick: () => {
          o((c) => !c), s(!1);
        },
        children: r ? /* @__PURE__ */ p(vt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Es, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Nm = [
  { tool: "pen", label: "画笔", Icon: Zn },
  { tool: "highlighter", label: "荧光笔", Icon: Ps },
  { tool: "eraser", label: "橡皮", Icon: Ts }
];
function Ba(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function ja({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ _(yt, { children: [
    Nm.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      Z,
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
    fa.map((o) => /* @__PURE__ */ p(
      Z,
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
    /* @__PURE__ */ p(Z, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Ms, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      Z,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Ns, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      Z,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(vt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Am({ ink: e, menu: t, onClose: n }) {
  const r = M(null);
  if (D(() => {
    if (!t) return;
    const i = (c) => {
      var u;
      (u = r.current) != null && u.contains(c.target) || n();
    }, l = (c) => {
      c.key === "Escape" && n();
    };
    return document.addEventListener("pointerdown", i, !0), document.addEventListener("keydown", l), () => {
      document.removeEventListener("pointerdown", i, !0), document.removeEventListener("keydown", l);
    };
  }, [t, n]), !t) return null;
  const o = 380, a = Math.max(8, Math.min(t.x, (globalThis.innerWidth || o) - o - 8)), s = Math.max(68, Math.min(t.y, (globalThis.innerHeight || 600) - 60));
  return /* @__PURE__ */ p("div", { ref: r, className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", style: { left: a, top: s }, "data-ink-menu": "true", children: /* @__PURE__ */ p(ja, { ink: e, page: t.page, onPick: n }) });
}
function Lm({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(ja, { ink: e }) }) : null;
}
function _m(e) {
  var r;
  if (e.shiftKey || Ba(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Ho}`))) return null;
  const n = Number((r = t.closest(`[${Le}]`)) == null ? void 0 : r.getAttribute(Le)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function xm(e) {
  const t = M(e);
  t.current = e, D(() => {
    const n = (r) => {
      if (Ba(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function Nn() {
  try {
    return lt().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Dm(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Cm(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function zm(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Om({ documentId: e, jobId: t }) {
  const [n, r] = T([]), [o, a] = T(null), [s, i] = T(null), [l, c] = T(""), [u, f] = T(""), d = M(0);
  D(() => {
    r([]), i(null), f("");
    const y = Nn();
    if (!y || !e) return;
    let w = !1;
    return y.list(e).then((S) => {
      w || (r(S.versions), a(S.currentVersionId));
    }).catch(() => {
    }), () => {
      w = !0;
    };
  }, [e, t]);
  const h = C((y) => {
    const w = Nn(), S = n.find((v) => v.versionId === y);
    if (!w || !S || !e) return;
    const b = ++d.current;
    c(y), f(""), (async () => {
      const v = lt(), k = await w.resolveJob(e, y);
      if (!k) throw new Error("这一份还没有能读的译文。");
      const P = await v.loadReaderPayload(k, { includeOptionalArtifacts: !0 }), A = v.resolveReaderTranslatedPdfUrl(P.jobPayload, P.manifestPayload);
      if (!A) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: k, url: A, regions: Dm(Ao(P.regionsPayload)) };
    })().then((v) => {
      b === d.current && i(v);
    }).catch((v) => {
      b === d.current && f((v == null ? void 0 : v.message) || "这一份打不开。");
    }).finally(() => {
      b === d.current && c("");
    });
  }, [e, n]), g = C(() => {
    d.current += 1, i(null), c(""), f("");
  }, []), m = C(async () => {
    var S, b;
    const y = Nn();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (v) {
      f((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (S = globalThis.location) == null ? void 0 : S.href;
    w && ((b = globalThis.history) == null || b.replaceState(globalThis.history.state, "", zm(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Cm(n, t, o),
    compared: s,
    loading: l,
    error: u,
    choose: h,
    clear: g,
    adopt: m
  };
}
const $m = "reader-finder-input";
function Fm(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Bm(e, t = typeof window > "u" ? null : window) {
  D(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Fm(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains($m) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function jm() {
  try {
    return lt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Hm = "这本书正在处理（翻译或排版），处理完才能改。", Um = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Wm({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = jm(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = Gc(s), c = !t || Wt(t), u = tu(n), [f, d] = T(""), [h, g] = T(null), [m, y] = T(() => /* @__PURE__ */ new Map()), [w, S] = T(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = T(() => /* @__PURE__ */ new Map()), [k, P] = T({ phase: "idle" }), A = M({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  D(() => {
    g(null), A.drafts.clear(), A.generation.current = null, v(/* @__PURE__ */ new Map()), P({ phase: "idle" });
  }, [s]), D(() => {
    if (d(""), !i || l || !a) return;
    let x = !1;
    return a.resolveOwnerJobId(s).then((j) => {
      x || d(`${j || s}`.trim() || s);
    }).catch(() => {
      x || d(s);
    }), () => {
      x = !0;
    };
  }, [i, l, a, s]), D(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !c) return;
    let x = !1;
    return a.fetchRevisions(f).then((j) => {
      x || y(nu(j, u));
    }).catch(() => {
    }), () => {
      x = !0;
    };
  }, [a, f, u, c]);
  const z = k.phase === "running" && k.seenActive;
  D(() => {
    if (k.phase === "running") {
      if (!c) {
        z || P({ phase: "running", seenActive: !0 });
        return;
      }
      z && P(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, z, c, t]);
  const F = V(() => {
    const x = new Map(m);
    if (w.renderedAt === u)
      for (const [j, $] of w.edits) x.set(j, $);
    return x;
  }, [m, w, u]), N = C((x) => {
    const j = `${x || ""}`.trim();
    j && g({ itemId: j, page: Xc(j) });
  }, []), I = C(() => g(null), []), R = C((x, j) => {
    S(($) => {
      const J = new Map($.renderedAt === u ? $.edits : []);
      return J.set(x, j), { renderedAt: u, edits: J };
    }), v(($) => new Map($).set(x, ($.get(x) || 0) + 1));
  }, [u]), E = C(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      P({ phase: "submitting" });
      try {
        await a.rerender(s), P({ phase: "running", seenActive: !1 }), await o();
      } catch (x) {
        P({ phase: "failed", message: (x == null ? void 0 : x.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), L = l ? Um : !c || k.phase === "running" || k.phase === "submitting" ? Hm : "";
  return V(() => ({
    available: i,
    blockedReason: L,
    port: a,
    ownerJobId: f,
    target: h,
    select: N,
    close: I,
    memory: A,
    pendingEdits: F,
    savedCounts: b,
    markSaved: R,
    rerender: k,
    startRerender: E
  }), [i, L, a, f, h, N, I, A, F, b, R, k, E]);
}
function Km(e, t) {
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
function Vm({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ _("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      Z,
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
const Ha = "retainpdf:reader:doc-theme:v1", Io = "data-reader-doc";
function Ua() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Jm(e = Ua()) {
  try {
    return (e == null ? void 0 : e.getItem(Ha)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function qm(e, t = Ua()) {
  try {
    t == null || t.setItem(Ha, e);
  } catch {
  }
}
function Ro(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Io, "dark") : t.removeAttribute(Io));
}
function Gm() {
  const [e, t] = T(() => Jm());
  D(() => {
    Ro(e);
  }, [e]), D(() => () => Ro("light"), []);
  const n = C(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return qm(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const Eo = 6e3;
function Wa(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Xm(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > Eo && (s *= Eo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function Ka({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = M(null), [i, l] = T({ status: "loading", cssHeight: 0 }), c = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return D(() => {
    let u = !1, f = null;
    return l((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const h = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), m = Xm(n, h, r, g), y = s.current, w = y == null ? void 0 : y.getContext("2d");
        if (!y || !w) return;
        y.width = m.canvasWidth, y.height = m.canvasHeight, l({ status: "loading", cssHeight: m.cssHeight });
        const S = d.getViewport({ scale: m.scale, offsetX: m.offsetX, offsetY: m.offsetY }), b = d.render({ canvasContext: w, viewport: S });
        f = b, await b.promise, u || l({ status: "ready", cssHeight: m.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && l((h) => ({ status: "error", cssHeight: h.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, c]), /* @__PURE__ */ _(
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
const Po = { figure: "图", table: "表", formula: "公式", text: "文字" }, tt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Zm(e, t, n) {
  const r = sn(e, t, n), o = r ? Xt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Wa({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Ym(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, l = null;
  for (const u of e) {
    const f = sn(u, t, n), d = f ? Xt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, l = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !l) return null;
  const c = Wa({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: c, aspect: c.height * l.height / Math.max(1e-6, c.width * l.width) };
}
function Qm(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function eh(e, t) {
  const n = (o) => {
    const a = _e(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function th({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var F;
  const i = t.find((N) => N.itemId === e) ?? null, l = V(() => i ? eh(t, i) : [], [t, i]), c = i ? l.indexOf(i) : -1, [u, f] = T(tt.indexOf(1)), d = tt[u], h = M(null), [g, m] = T(0);
  Ee(() => {
    const N = h.current;
    if (!N) return;
    const I = () => m(N.clientWidth);
    I();
    const R = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return R == null || R.observe(N), () => R == null ? void 0 : R.disconnect();
  }, []);
  const y = C((N) => {
    const I = l[c + N];
    I && a(I.itemId);
  }, [l, c, a]);
  D(() => {
    const N = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), y(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), y(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), f((R) => Math.min(tt.length - 1, R + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), f((R) => Math.max(0, R - 1));
      else if (I.key === "0")
        I.preventDefault(), f(tt.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", N, !0), () => window.removeEventListener("keydown", N, !0);
  }, [s, y]), D(() => {
    const N = h.current;
    if (!N) return;
    const I = (R) => {
      !R.ctrlKey && !R.metaKey || (R.preventDefault(), f((E) => Math.max(0, Math.min(tt.length - 1, E + (R.deltaY < 0 ? 1 : -1)))));
    };
    return N.addEventListener("wheel", I, { passive: !1 }), () => N.removeEventListener("wheel", I);
  }, []);
  const w = M(null);
  if (!i) return null;
  const S = _e(i), b = o.map((N) => ({ pane: N, pdf: r[N] ?? null, where: Zm(i, n, N) })).filter((N) => !!(N.pdf && N.where)), v = 16, k = typeof window > "u" ? 800 : window.innerHeight, P = Math.min(880, k * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), A = b.length ? Qm(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), P, b.map((N) => N.where.aspect)) : 0, z = ((F = b[0]) == null ? void 0 : F.where.page) ?? i.source.page;
  return /* @__PURE__ */ _("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${Po[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ _("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ _("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ _("span", { className: "reader-zoom-title", children: [
          Po[S] ?? "这一块",
          " · 第 ",
          z,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: c >= 0 ? `${c + 1} / ${l.length}` : "" }),
        /* @__PURE__ */ _("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: c <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(As, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: c < 0 || c >= l.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(zo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((N) => Math.max(0, N - 1)), children: /* @__PURE__ */ p(Ls, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ _(Z, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(tt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === tt.length - 1, onClick: () => f((N) => Math.min(tt.length - 1, N + 1)), children: /* @__PURE__ */ p(_s, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(vt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: h,
          className: "reader-zoom-body",
          onPointerDown: (N) => {
            const I = h.current;
            !I || N.button !== 0 || (w.current = { x: N.clientX, y: N.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(N.pointerId));
          },
          onPointerMove: (N) => {
            const I = h.current, R = w.current;
            !I || !R || (I.scrollLeft = R.left - (N.clientX - R.x), I.scrollTop = R.top - (N.clientY - R.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: N, pdf: I, where: R }) => /* @__PURE__ */ _("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: N === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Ka,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: R.page,
                region: R.fraction,
                cssWidth: A * d,
                label: `${N === "source" ? "原文" : "译文"}第 ${R.page} 页`
              }
            )
          ] }, N)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const nh = 380, rh = 320, Et = 8;
function oh(e, t, n) {
  const r = Math.max(Et, Math.min(e.left, n.width - t.width - Et)), o = e.bottom + Et, a = o + t.height <= n.height - Et ? o : Math.max(Et, e.top - Et - t.height);
  return { left: r, top: a };
}
function ah({
  preview: e,
  regions: t,
  metadata: n,
  documents: r
}) {
  const o = e.target.itemIds.map((d) => t.find((h) => h.itemId === d)).filter((d) => !!d);
  if (!o.length) return null;
  const a = e.pane === "source" ? ["source", "translated"] : ["translated", "source"];
  let s = null;
  for (const d of a) {
    const h = r[d], g = h ? Ym(o, n, d) : null;
    if (h && g) {
      s = { pdf: h, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(nh, rh / Math.max(0.05, s.where.aspect))), l = Math.round(i * s.where.aspect) + 30, c = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = oh(e.anchor, { width: Math.max(i, 160) + 16, height: l + 16 }, c);
  return /* @__PURE__ */ _("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ _("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Hr(e.target) }),
      /* @__PURE__ */ _("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Ka, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Hr(e.target) })
  ] });
}
const sh = 250;
function ih(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function lh(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function ch(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function uh({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = T(null), [s, i] = T({ back: [], forward: [] }), l = M(s);
  l.current = s;
  const c = M(null), u = M({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = C(() => {
    const { shellEl: h, primaryPane: g } = u.current;
    return Ht(h, g);
  }, []);
  D(() => {
    if (!e) return;
    const h = (b) => {
      var v, k;
      return (k = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${sa}`);
    }, g = () => {
      c.current != null && window.clearTimeout(c.current), c.current = null;
    }, m = (b) => {
      var A;
      const v = h(b);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(Fn) || "");
      if (!k) return;
      const P = ((A = v.closest("[data-reader-pane]")) == null ? void 0 : A.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), c.current = window.setTimeout(() => {
        const z = v.getBoundingClientRect();
        a({ target: k, pane: P, anchor: { left: z.left, top: z.top, right: z.right, bottom: z.bottom } });
      }, sh);
    }, y = (b) => {
      const v = h(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, w = (b) => {
      var z, F;
      const v = h(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((z = window.getSelection) == null ? void 0 : z.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(Fn) || "");
      if (!k) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const P = ((F = v.closest("[data-reader-pane]")) == null ? void 0 : F.getAttribute("data-reader-pane")) || u.current.primaryPane, A = f();
      A && i((N) => ih(N, A)), u.current.follow(k, P);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", m), e.addEventListener("pointerout", y), e.addEventListener("click", w, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", m), e.removeEventListener("pointerout", y), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = C((h) => {
    const g = f();
    if (!g) return !1;
    const m = lh(l.current, g, h);
    if (!m) return !1;
    const { shellEl: y, primaryPane: w } = u.current;
    return At(y, m.to, "auto", w) ? (i(m.history), !0) : !1;
  }, [f]);
  return D(() => {
    const h = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || ch(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", h), () => window.removeEventListener("keydown", h);
  }, [d]), {
    preview: o,
    closePreview: C(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: C(() => d("back"), [d])
  };
}
const dh = Ja(() => import("./ReaderMarkdownPanel-ZFW8BiTp.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), fh = [];
function mh(e) {
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
function hh(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function ph() {
  var vr;
  const e = nc(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = mm(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = T(!1), u = M(null), f = M(null), d = s !== null, h = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = mh({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: h,
    liveTranslationVisible: l,
    assistantOpen: d
  }), m = Ul({
    hasOverlayContent: h,
    connection: e.liveTranslation.connection,
    showSource: g.showSource,
    liveTranslationVisible: l,
    assistantOpen: d
  }), y = g.sourceViewOnly, w = g.visibleMode;
  D(() => {
    c(!1);
  }, [e.viewStateKey]), D(() => {
    e.session.jobTerminal && c(!1);
  }, [e.session.jobTerminal]);
  const S = M(null);
  D(() => {
    S.current !== e.viewStateKey && Vl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: y,
      jobTerminal: e.session.jobTerminal
    }) && (S.current = e.viewStateKey, c(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, y]), D(() => {
    if (!(t.loading || t.failed)) {
      if (u.current !== e.viewStateKey) {
        u.current = e.viewStateKey;
        const H = je(e.viewStateKey), Y = bm({
          savedMode: H == null ? void 0 : H.mode,
          sourceViewOnly: y,
          viewportWidth: at()
        });
        f.current = Y.auto ? Y.mode : null, Y.mode && Y.mode !== e.mode && e.setModeKeepingPage(Y.mode);
        return;
      }
      ym(e.mode, f.current) && (f.current = null, bn(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const b = s || (e.mode === "compare" ? "compare" : "reading"), v = wm(s, "markdown"), { docDark: k, toggleDocDark: P } = Gm();
  cc({
    toggleDocDark: P,
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
  const A = C(() => {
    i(null);
  }, []), z = Wl(e.liveTranslation), F = C(() => {
    z && e.goToPage(z, "source");
  }, [e.goToPage, z]), [N, I] = T(null);
  D(() => {
    w === "compare" && e.session.jobTerminal && I(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, w]);
  const R = N !== e.viewStateKey && Jl({
    state: e.liveTranslation,
    sourceViewOnly: y,
    visibleMode: w
  }), E = C((H) => {
    const Y = hh(H, e.liveTranslationAvailable);
    Y !== null && c(Y), e.setModeKeepingPage(H);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), L = V(() => m.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${l ? " is-active" : ""}`,
      onClick: () => c((H) => !H),
      "aria-pressed": l,
      title: l ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [m.sourcePaneToggle, l]), x = C((H) => {
    i(H);
  }, []), [j] = T(Sm), [$, J] = T(null), X = C((H) => J((Y) => Y === H ? null : H), []), [re, oe] = T(""), [ce, ue] = T("");
  D(() => {
    const H = re.replace(/\s+/gu, " ").trim(), Y = window.setTimeout(() => ue(H), H ? 150 : 0);
    return () => window.clearTimeout(Y);
  }, [re]);
  const [le, xe] = T(0), ee = C(() => {
    J("search"), xe((H) => H + 1);
  }, []);
  Bm(ee);
  const te = C((H) => {
    e.jumpToAnchor({ block_id: H }), ($ === "outline" || at() < 900) && J(null);
  }, [e.jumpToAnchor, $]), me = C((H) => e.jumpToAnchor({ block_id: H }), [e.jumpToAnchor]), [be, ye] = T({}), pe = M({ source: r.sourceUrl, translated: r.translatedUrl });
  pe.current = { source: r.sourceUrl, translated: r.translatedUrl };
  const He = C((H, Y) => {
    ye((Ve) => ({ ...Ve, [Y]: { url: pe.current[Y], nodes: H } }));
  }, []), ct = V(() => {
    const H = be.source;
    if (H && H.url === r.sourceUrl && H.nodes.length) return H.nodes;
    const Y = be.translated;
    return Y && Y.url === r.translatedUrl && Y.nodes.length ? Y.nodes : fh;
  }, [be, r.sourceUrl, r.translatedUrl]), De = M({}), [ne, de] = T(0), B = C((H, Y) => {
    De.current[Y] = { url: pe.current[Y], pdf: H }, de((Ve) => Ve + 1);
  }, []), [q, Q] = T(null), fe = C((H) => Q(H), []), Pe = C(() => Q(null), []);
  D(() => Q(null), [e.viewStateKey]);
  const Te = V(() => {
    const H = (Y, Ve) => {
      const dt = De.current[Y];
      return dt && dt.url === Ve ? dt.pdf : null;
    };
    return { source: H("source", r.sourceUrl), translated: H("translated", r.translatedUrl) };
  }, [ne, r.sourceUrl, r.translatedUrl]), Ie = V(() => Uc(o.regions), [o.regions]), Ue = C(
    (H, Y) => e.jumpToAnchor({ block_id: H.itemId }, Y),
    [e.jumpToAnchor]
  ), Re = uh({ shellEl: e.shell.shellEl, index: Ie, primaryPane: e.panes.primaryPane, follow: Ue }), We = C((H) => {
    e.goToPage(H), ($ === "outline" || at() < 900) && J(null);
  }, [e.goToPage, $]), we = Wm({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), Me = we.select, Oe = e.setModeKeepingPage, Ke = o.regions, $e = C((H) => {
    su(Ke, H) && (w === "source" && Oe("compare"), Me(H));
  }, [Ke, Me, w, Oe]);
  Km(we.available ? $e : null, j);
  const Ne = Xu(e.viewStateKey);
  xm(Ne);
  const [et, ut] = T(null), O = C(() => ut(null), []), U = Om({ documentId: o.documentId, jobId: o.jobId }), K = ((vr = U.compared) == null ? void 0 : vr.url) || "";
  D(() => {
    K && w !== "compare" && E("compare");
  }, [K]), D(() => {
    w !== "compare" && U.clear();
  }, [w]);
  const G = V(
    () => {
      const { compared: H, versions: Y, readingVersionId: Ve } = U;
      if (!H) return null;
      const dt = Y.find((yn) => yn.versionId === H.versionId), kt = Y.find((yn) => yn.versionId === Ve);
      return {
        url: H.url,
        regions: H.regions,
        left: { name: H.name, createdAt: (dt == null ? void 0 : dt.createdAt) || "" },
        right: { name: (kt == null ? void 0 : kt.name) || "当前译文", createdAt: (kt == null ? void 0 : kt.createdAt) || "" }
      };
    },
    [U.compared, U.versions, U.readingVersionId]
  ), ae = V(() => {
    if (!we.savedCounts.size) return e.revisedBlocks;
    const H = new Map(e.revisedBlocks);
    for (const [Y, Ve] of we.savedCounts) H.set(Y, (H.get(Y) || 0) + Ve);
    return H;
  }, [e.revisedBlocks, we.savedCounts]), W = V(() => ({
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
    regionHover: j,
    jumpToBlock: me,
    revisedBlocks: ae,
    onPdfOutline: He,
    onPdfDocument: B,
    zoomBlock: fe,
    xrefIndex: Ie,
    editBlock: we.available ? $e : void 0,
    blockEdit: we,
    editShowsSource: w !== "compare",
    findTerm: $ === "search" ? ce : "",
    compareVersion: G,
    ink: Ne,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: y,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: x, close: A },
    docDark: k,
    toggleDocDark: P
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
    j,
    me,
    ae,
    He,
    B,
    fe,
    Ie,
    we,
    $e,
    w,
    $,
    ce,
    G,
    Ne,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    x,
    A,
    k,
    P
  ]), se = V(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), ge = [
    Di,
    `is-workspace-${b}`,
    d ? "is-assistant-open" : "",
    $ ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(rd, { value: W, hud: se, children: /* @__PURE__ */ _(
    "div",
    {
      className: ge,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": b,
      "data-ink-mode": Ne.tool || void 0,
      onContextMenu: (H) => {
        const Y = _m(H);
        Y && (H.preventDefault(), ut(Y));
      },
      children: [
        /* @__PURE__ */ p(zf, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(Em, { open: $, onToggle: X }),
        $ ? /* @__PURE__ */ p(
          Tm,
          {
            tab: $,
            onTab: J,
            onClose: () => J(null),
            onJump: te,
            bookmarks: ct,
            onJumpPage: We,
            query: re,
            onQuery: oe,
            term: ce,
            focusSignal: le
          }
        ) : null,
        /* @__PURE__ */ _("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(Kf, {}),
          /* @__PURE__ */ p(gc, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          jd,
          {
            mode: w,
            documentReady: !!o.jobId,
            sourceViewOnly: y,
            onModeChange: E,
            liveTranslation: m.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((H) => !H),
              latestPage: l ? z : null,
              currentPage: e.currentPage,
              onJumpToLatest: F
            } : null,
            completion: R ? {
              onOpenCompare: () => {
                I(e.viewStateKey), E("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(Jd, { active: s }),
        d ? /* @__PURE__ */ p(Df, {}) : null,
        /* @__PURE__ */ p(Od, { paneComposition: g, markdownSplit: v.open, assistantSplit: d, liveTranslation: e.liveTranslation, sourcePaneAction: L }),
        e.showHud ? /* @__PURE__ */ p(
          dm,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(Pm, { open: $, onToggle: X })
          }
        ) : null,
        /* @__PURE__ */ p(Va, { fallback: null, children: v.mounted ? /* @__PURE__ */ p(dh, { open: v.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: A }) : null }),
        Re.preview ? /* @__PURE__ */ p(ah, { preview: Re.preview, regions: o.regions, metadata: o.readerMetadata, documents: Te }) : null,
        Re.canGoBack ? /* @__PURE__ */ _(Z, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => Re.goBack(), children: [
          /* @__PURE__ */ p(xs, { size: 14, "aria-hidden": !0 }),
          " 回到第 ",
          Re.backPage,
          " 页"
        ] }) : null,
        q ? /* @__PURE__ */ p(
          th,
          {
            itemId: q,
            regions: o.regions,
            metadata: o.readerMetadata,
            documents: Te,
            panes: w === "compare" ? ["source", "translated"] : w === "translated" ? ["translated"] : ["source"],
            onNavigate: Q,
            onClose: Pe
          }
        ) : null,
        /* @__PURE__ */ p(Mm, { active: s, compare: U, ink: Ne }),
        /* @__PURE__ */ p(Am, { ink: Ne, menu: et, onClose: O }),
        /* @__PURE__ */ p(Lm, { ink: Ne }),
        /* @__PURE__ */ p(Vm, { edit: we }),
        /* @__PURE__ */ p(gm, {})
      ]
    }
  ) });
}
function Dh() {
  return /* @__PURE__ */ p(ph, {});
}
export {
  Dh as R,
  ph as a,
  _h as d,
  Lh as f,
  xh as r,
  Qe as u
};
//# sourceMappingURL=ReaderApp-BMruS0Tl.js.map
