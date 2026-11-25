var Ar = (e) => {
  throw TypeError(e);
};
var Lr = (e, t, n) => t.has(e) || Ar("Cannot " + n);
var Ct = (e, t, n) => (Lr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), _r = (e, t, n) => t.has(e) ? Ar("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), xr = (e, t, n, r) => (Lr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as A, jsx as h, Fragment as wt } from "react/jsx-runtime";
import { useMemo as J, useState as T, useEffect as D, useCallback as C, useRef as M, useLayoutEffect as Pe, memo as bn, createContext as Yn, useContext as Qn, forwardRef as Fo, useImperativeHandle as er, useSyncExternalStore as Bo, useId as jo, Suspense as Dr, lazy as Ho } from "react";
import { requireAdapter as Dt, getReaderAdapters as xe } from "./adapters.js";
import { resolveReaderDownloadName as ds, resolveReaderDownloadUrls as fs, READER_PROGRESS_COPY as Xe, trimString as ln, READER_DOWNLOAD_ACTIONS as ms, disabledReason as hs } from "./runtime/state.js";
import { r as ps, b as gs } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Dn, isFinishedJobStatus as Vt } from "@retainpdf/domain/job";
import { n as Uo, d as bs, f as In, k as Cr, b as ys, c as vs, j as De, p as Yt, g as ws, l as cn, i as Ss } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as ks } from "@retainpdf/api/documents";
import { isReaderTransportError as Is, createReaderTransportError as Rs } from "./contracts.js";
import { X as St, PenLine as tr, ZoomIn as Es, Check as Wo, Copy as Ps, ChevronUp as Ts, ChevronDown as Ko, History as Ms, LoaderCircle as Ns, Pin as As, LogOut as Ls, FileText as Vo, Columns2 as Jo, Languages as qo, Radio as _s, ArrowDownToLine as xs, CheckCircle2 as Ds, Keyboard as Cs, Download as zs, ListOrdered as Os, TriangleAlert as $s, ChevronRight as Go, ListTree as Fs, Search as Bs, GitCompareArrows as js, LayoutGrid as Hs, Highlighter as Us, Eraser as Ws, Undo2 as Ks, Trash2 as Vs, ChevronLeft as Js, Minus as qs, Plus as Gs, ArrowLeft as Xs } from "lucide-react";
import { Button as X, Textarea as Zs, IconButton as pt, Input as Xo } from "@retainpdf/ui";
import { toast as Cn, Toaster as Ys } from "sonner";
import { pdfjs as Zo, Page as Qs, Document as ei } from "react-pdf";
import { e as ti, m as ni, a as ri } from "./markdown-math-XkF5urpn.js";
const oi = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ai = "", si = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ii = (e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Zh = (...e) => {
  var n;
  return (((n = xe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Yh = () => {
  var e, t;
  return ((t = (e = xe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ze = () => Dt("defaultReaderDataPort"), zr = () => Dt("defaultReaderPageConfigPort"), Qh = {
  get apiPrefix() {
    return Ze().apiPrefix;
  },
  fetchProtected: (...e) => Ze().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ze().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ze().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ze().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ze().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ze().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ze().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ze().liveTranslation;
  }
}, Yo = {
  messageTargetOrigin: () => zr().messageTargetOrigin(),
  readerJobId: () => zr().readerJobId()
}, li = () => {
  var e;
  return ((e = xe()) == null ? void 0 : e.liveTranslation) ?? null;
}, Jt = () => {
  var t;
  const e = xe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, nt = () => {
  const e = xe();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Dt("fetchDocumentByJobId")(...n),
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
}, ci = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ui = () => {
  var e, t;
  return ((t = (e = xe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, di = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, fi = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ds(...e);
}, mi = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? fs(...e);
}, hi = (...e) => Dt("downloadProtectedResource")(...e), pi = (...e) => Dt("failDownloadToast")(...e), ep = (e, t) => Dt("resolveMarkdownAssetUrl")(e, t), Or = "/api/v1";
function gi() {
  const e = () => {
    var r;
    return ps(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = T(e);
  return D(() => {
    var i, l, c, u;
    const r = () => n(e()), o = (l = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : l.bind(globalThis.history), a = (u = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (d) => function(...p) {
          const g = d.apply(this, p);
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
function bi() {
  const e = gi(), t = J(() => di(Yo), [e]), n = J(() => ui(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function yi(e) {
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
  }), d = l.documentId === t ? l.jobId : "", p = u.documentId === t ? u.jobId : "", g = n || d, [m, y] = T({
    jobId: "",
    documentId: ""
  }), w = m.jobId === g ? m.documentId : "", S = t || w, b = !!t && !g, [v, k] = T(null), P = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, L = b || !!P, z = C((N) => {
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
    rejectedDocumentJobId: p,
    sessionJobId: g,
    resolvedJobDocument: m,
    setResolvedJobDocument: y,
    jobDocumentId: w,
    documentId: S,
    sourceOnly: b,
    committedDocumentSource: v,
    setCommittedDocumentSource: k,
    activeCommittedDocumentSource: P,
    sourceViewOnly: L,
    refreshCommittedDocument: z,
    applyIdentityEvent: F
  };
}
function $r(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function vi(e) {
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
function Fr(e, t) {
  return ii(Dn(e, t));
}
function wi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Si(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !wi(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function zn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: si.progress,
        stage: n,
        percent: e,
        text: t
      },
      Yo.messageTargetOrigin()
    );
  } catch {
  }
}
function un(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), zn({ percent: t, text: n, stage: r });
}
function ki(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = T(null), [c, u] = T(null), [f, d] = T(""), [p, g] = T(0), m = f === n ? i : null, y = f === n ? c : null, w = $r(m), S = Vt(w), b = C(() => {
    g((F) => F + 1);
  }, []), v = C((F) => {
    l(F.jobPayload), u(F.manifestPayload), d(F.sessionIdentity);
  }, []), k = C((F) => {
    l(null), u(null), d(F);
  }, []), P = M(""), L = M(""), z = C(async () => {
    const F = o.current;
    if (!F || P.current === F) return;
    const N = nt().loadJobPayload;
    if (typeof N != "function") return;
    const I = a.current.value;
    P.current = F;
    try {
      const R = await N(F);
      if (s.current || a.current.value !== I || o.current !== F || !R || typeof R != "object")
        return;
      const E = $r(R);
      l(R), d(r.current), !Vt(E) && L.current === F && (L.current = ""), E === "succeeded" && L.current !== F && (L.current = F, g((_) => _ + 1));
    } catch {
    } finally {
      P.current === F && (P.current = "");
    }
  }, []);
  return D(() => {
    L.current = "";
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
    jobRefreshRevision: p,
    refreshJobArtifacts: b,
    refreshJobStatus: z,
    publishPayload: v,
    clearPayload: k
  };
}
function On(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ii(e, t) {
  e(t), On(t);
}
function Ri(e) {
  const [t, n] = T(e ? "source" : "compare"), r = C((a) => {
    e && a !== "source" || (n(a), On(a));
  }, [e]), o = C((a) => {
    Ii(n, a);
  }, []);
  return D(() => (e && document.documentElement.classList.add("reader-source-only"), On(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Br(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ei(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Br(n.active_job_id),
    activeVersionId: Br(n.active_version_id)
  };
}
function Pi(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ti(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Mi(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ni = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ai(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ni.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Li = 48 * 1024 * 1024;
function _i(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const xi = 2, _e = /* @__PURE__ */ new Map();
function $n(e, t) {
  _e.delete(e), _e.set(e, t);
}
function jr(e) {
  if (_e.size < xi) return;
  const t = _e.keys().next().value;
  t && _e.delete(t);
}
async function Di(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Qo(e, t = Jt().fetchProtected, n = {}) {
  var u, f, d, p, g, m, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (_e.has(r)) {
    const b = _e.get(r);
    return $n(r, b), b;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (d = (f = n.signal) == null ? void 0 : f.addEventListener) == null || d.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (p = n.signal) == null ? void 0 : p.removeEventListener) == null || g.call(p, "abort", a);
  }
  if (!s.ok) {
    const b = new Error(`读取 PDF 失败 (${s.status})`);
    b.status = s.status;
    const v = await Di(s);
    throw v && (b.reason = v), b;
  }
  const i = Ci(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return jr(), _e.set(r, b), b;
  }
  (y = (m = n.signal) == null ? void 0 : m.addEventListener) == null || y.call(m, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return _e.has(r) ? $n(r, c) : (jr(), _e.set(r, c)), c;
}
function Ci(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Li ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const zi = { file: null, loading: !1, error: "" }, Oi = { file: null, loading: !0, error: "" };
function $i(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = T(null);
  if (D(() => {
    if (t || !n) return;
    const s = _e.get(n);
    if (s) {
      $n(n, s);
      return;
    }
    const i = new AbortController();
    return Qo(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return zi;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = _e.get(n);
  return a ? { file: a, loading: !1, error: "" } : Oi;
}
function Fi(e) {
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
async function Fn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  un(s, r, n, "download");
  const i = await Qo(t, Jt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (un(s, o, n, "download"), i);
}
async function Bi(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  un(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Fn({
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
    Fn({
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
function ji(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Hi({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = ks,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(ji(o.href, t, a)), !0);
}
const en = {
  regions: null,
  metadata: null
};
function Ui(e) {
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
    switchSessionMode: p,
    jobRefreshRevision: g,
    sessionEpochRef: m,
    closingRef: y,
    activeLoadAbortRef: w
  } = e, [S, b] = T(""), [v, k] = T(""), [P, L] = T(null), [z, F] = T(null), [N, I] = T(!1), [R, E] = T(""), [_, x] = T([]), [H, $] = T(!1), [G, Z] = T(() => ({
    source: null,
    translated: null
  })), [ae, se] = T(
    en
  ), [ce, ue] = T({
    loading: !0,
    percent: 4,
    text: Xe.boot,
    stage: "progress",
    failed: !1
  });
  return D(() => {
    const le = new AbortController(), Ce = m.current.value, te = Fi({
      sessionEpochRef: m,
      closingRef: y,
      abort: le,
      sessionEpoch: Ce
    });
    w.current = le;
    const ne = nt();
    if (y.current)
      return le.abort(), () => {
        w.current === le && (w.current = null);
      };
    let fe = !1;
    function ve(re, de) {
      te.markFailed(), $(!0), ue({
        loading: !1,
        percent: 100,
        text: re,
        stage: "failed",
        failed: !0
      }), zn({ percent: 100, text: de, stage: "failed" });
    }
    function Se() {
      I(!0), fe || $(!0), ue({
        loading: !1,
        percent: 100,
        text: Xe.ready,
        stage: "ready",
        failed: !1
      }), zn({ percent: 100, text: Xe.ready, stage: "ready" });
    }
    function ge() {
      return c != null && c.documentId ? Fr(
        c.documentId,
        c.revision
      ) : oi() ? ai : ne.resolveResourceUrl(Dn(r));
    }
    async function Ve() {
      var q;
      let re = { activeJobId: "", activeVersionId: "" };
      try {
        const ee = await ((q = ne.fetchDocument) == null ? void 0 : q.call(ne, r));
        ee && (re = Ei(ee));
      } catch {
      }
      const de = Pi({
        link: re,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (de.kind === "follow-active-job") {
        if (te.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: de.jobId
        }), de.activeVersionId ? (c || u({
          type: "committed-source",
          documentId: r,
          revision: de.activeVersionId,
          sessionIdentity: l
        }), p("source")) : p("compare");
        return;
      }
      if (de.kind === "open-committed-source") {
        if (te.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: de.revision,
          sessionIdentity: l
        }), p("source");
        return;
      }
      const be = ge();
      if (te.isInactive()) return;
      b(be), k(""), E(""), d(l);
      const j = await Fn({
        url: be,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: te,
        setBoot: ue
      });
      if (!te.isInactive()) {
        if (!j) {
          ve("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        L(j), Se();
      }
    }
    async function Je() {
      var ft;
      const re = !c, de = !!(re && ne.loadSessionSnapshot && ne.loadReaderOptionalArtifacts), be = de ? ne.loadReaderOptionalArtifacts(t) : null, j = await ((ft = ne.loadSessionSnapshot) == null ? void 0 : ft.call(ne, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: re && !de
      })), q = j ? {
        jobPayload: j.sourcePayload,
        manifestPayload: j.manifestPayload,
        readerMetadata: j.readerMetadata,
        regionsPayload: j.regions,
        readerErrors: j.readerErrors
      } : await ne.loadReaderPayload(t, {
        includeOptionalArtifacts: re
      });
      if (te.isInactive()) return;
      let ee = null;
      if (n && !r)
        if (j && j.linkedDocument !== void 0)
          ee = j.linkedDocument;
        else {
          try {
            ee = await ne.fetchDocumentByJobId(Or, t);
          } catch {
          }
          if (te.isInactive()) return;
        }
      const Oe = vi(q.jobPayload) || `${(ee == null ? void 0 : ee.document_id) || ""}`.trim();
      Oe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Oe
      });
      const Te = Ti({
        payloadDocumentId: Oe,
        linkedActiveJobId: `${(ee == null ? void 0 : ee.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ee == null ? void 0 : ee.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (Te.kind === "restore-committed-source") {
        if (te.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Te.documentId,
          revision: Te.revision,
          sessionIdentity: l
        }), p("source");
        return;
      }
      const Me = ne.resolveReaderSourcePdf(q.manifestPayload), $e = ne.resolveReaderTranslatedPdfUrl(q.jobPayload, q.manifestPayload), Ne = typeof Me == "string" ? Me : ne.resolveReaderArtifactUrl(Me), Fe = r || Oe, we = c != null && c.documentId ? Fr(
        c.documentId,
        c.revision
      ) : Ne || (Fe ? ne.resolveResourceUrl(Dn(Fe)) : ""), Ae = c ? "" : $e || "";
      b(we || ""), k(Ae), E(Si(q.jobPayload, t)), f({
        jobPayload: q.jobPayload || null,
        manifestPayload: q.manifestPayload || null,
        sessionIdentity: l
      });
      const je = () => Bi({
        sourceFinal: we || "",
        translatedFinal: Ae,
        fence: te,
        setBoot: ue
      }), qe = !!(we || Ae), He = be && qe ? je() : null;
      He == null || He.catch(() => {
      });
      const Le = (O) => {
        te.isInactive() || (x(c ? [] : Uo(O.regionsPayload)), Z(c ? { source: null, translated: null } : bs(O.readerMetadata)), se(c ? en : O.readerErrors ?? en), $(!0));
      };
      if (be ? (fe = !0, be.then(Le)) : Le(q), !qe) {
        ve(Xe.failed, Xe.failed);
        return;
      }
      const ot = await (He ?? je());
      if (ot.status !== "inactive") {
        if (ot.status === "incomplete") {
          ve("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        L(ot.sourceBytes), F(ot.translatedBytes), Se();
      }
    }
    async function ze() {
      I(!1), L(null), F(null), x([]), $(!1), Z({ source: null, translated: null }), se(en), un(ue, 8, Xe.metadata, "metadata");
      try {
        if (s) {
          await Ve();
          return;
        }
        if (!t) {
          ve(Xe.failed, Xe.failed);
          return;
        }
        await Je();
      } catch (re) {
        if (te.isClosedOrStale() || (re == null ? void 0 : re.name) === "AbortError") return;
        te.markFailed();
        const de = Number(re == null ? void 0 : re.status), be = `${(re == null ? void 0 : re.reason) || ""}`, j = Ai({ status: de, reason: be, sessionJobId: t });
        if (j && (await Hi({
          apiPrefix: Or,
          documentId: j,
          expiredJobId: t
        }) || te.isClosedOrStale()))
          return;
        if (Mi({
          status: de,
          reason: be,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), p("source");
          return;
        }
        const q = re instanceof Error ? re.message : Xe.failed;
        ve(q, q);
      }
    }
    return ze(), () => {
      le.abort(), w.current === le && (w.current = null);
    };
  }, [t, r, o, a, s, i, c, g, n, l, u, f, d, p]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: P,
    translatedFile: z,
    assetsReady: N,
    title: R,
    regions: _,
    regionsSettled: H,
    readerMetadata: G,
    readerErrors: ae,
    boot: ce
  };
}
function Wi() {
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = bi(), s = M({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = M(a), l = M(""), c = M(""), u = M(() => {
  }), f = C(() => u.current(), []), d = yi({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: l,
    sessionJobIdRef: c,
    switchToSourceMode: f
  }), {
    sessionJobId: p,
    documentId: g,
    sourceOnly: m,
    sourceViewOnly: y
  } = d, { mode: w, setMode: S, switchSessionMode: b } = Ri(y);
  u.current = () => {
    b("source");
  }, i.current = a, l.current = g, c.current = p;
  const v = ki({
    sessionJobId: p,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: P,
    jobStatus: L,
    jobTerminal: z,
    jobRefreshRevision: F,
    refreshJobArtifacts: N,
    refreshJobStatus: I
  } = v, R = Ui({
    sessionJobId: p,
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
  }, []), _ = J(
    () => ({
      fetchProtected: nt().fetchProtected,
      jobId: p,
      jobPayload: k,
      manifestPayload: P,
      sourceUrl: R.sourceUrl,
      translatedUrl: R.translatedUrl,
      sourceOnly: y
    }),
    [p, k, P, R.sourceUrl, R.translatedUrl, y]
  );
  return {
    jobId: p,
    jobStatus: L,
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
    download: _,
    refreshJobArtifacts: N,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: E
  };
}
const Ki = 160, Vi = 8, Ji = 0;
function qi() {
  const e = M(null), [t, n] = T(null), [r, o] = T(Ji), a = C((s) => {
    e.current = s, n(s);
  }, []);
  return D(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < Ki || o((u) => Math.abs(u - c) < Vi ? u : c);
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
function Gi(e) {
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
const Rn = { source: 0, translated: 0 };
function Xi(e, t) {
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
    pages: Rn
  })), [p, g] = T(() => ({ identity: c, tick: 0 })), m = f.identity === c ? f.pages : Rn, y = p.identity === c ? p.tick : 0, w = Gi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: S } = w, b = C((I, R) => {
    u.current === c && d((E) => {
      const _ = E.identity === c ? E.pages : Rn;
      return _[R] === I && E.identity === c ? E : {
        identity: c,
        pages: { ..._, [R]: I }
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
  const P = J(
    () => Math.max(m.source, m.translated),
    [m]
  ), L = S === "translated" ? m.translated : m.source || m.translated, z = t == null ? void 0 : t.userZoom, F = t == null ? void 0 : t.shellWidth, N = `${c}-${y}-${z}-${n}-${m.source}-${m.translated}-${F}`;
  return {
    ...w,
    numPagesByPane: m,
    hudNumPages: P,
    primaryNumPages: L,
    metricsTick: y,
    onNumPages: b,
    onMetrics: k,
    rowSyncRevision: N
  };
}
const Ee = "data-reader-page", Ie = "data-reader-pane", nr = "data-natural-height", Zi = "reader-react-root", ea = "reader-react-grid", ta = "reader-react-scroll-shell", yn = "reader-react-pdf-pane", na = "reader-react-pdf-page", dn = "reader-react-pdf-page-placeholder", rr = "reader-react-pdf-page-slot";
function fn(e, t) {
  const n = e != null ? `[${Ee}="${e}"]` : `[${Ee}]`;
  return t ? `${n}[${Ie}="${t}"]` : n;
}
function or() {
  return `.${rr}[${Ee}]`;
}
function mn(e) {
  return Number(e.getAttribute(Ee));
}
const ra = 0.25, hn = 1, Yi = 0.05, Qt = 0.5, Qi = 16, el = 8, oa = Qi + el, tl = 720;
function ct() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function aa(e) {
  return Number.isFinite(e) && e < tl;
}
function Mt(e, t = Number.POSITIVE_INFINITY) {
  return aa(t) && (e === "source" || e === "translated") ? hn : Qt;
}
function et(e) {
  return Number.isFinite(e) ? Math.min(hn, Math.max(ra, e)) : Qt;
}
function qt(e, t) {
  const n = et(Number(e) + t * Yi);
  return Math.round(n * 100) / 100;
}
function nl(e) {
  return Math.round(et(e) * 100);
}
function sa(e) {
  const n = (Number(e) || 0) - oa;
  return Math.max(160, Math.floor(n));
}
function rl(e, t = Qt) {
  const n = et(t);
  return sa((Number(e) || 0) * n);
}
function ol(e, t) {
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
const al = 8;
function sl(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < al ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const ia = 200, la = [
  "markdown"
], il = la;
function ca(e) {
  return il.includes(e);
}
const ll = "retainpdf:reader:view:v1:", Hr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), cl = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function ua() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Bn(e) {
  return `${e || ""}`.trim();
}
function ul({
  documentId: e,
  jobId: t
}) {
  const n = Bn(e);
  if (n) return `document:${n}`;
  const r = Bn(t);
  return r ? `job:${r}` : "";
}
function da(e) {
  const t = Bn(e);
  return t ? `${ll}${t}` : "";
}
function dl(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function fl(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Hr.has(t) || !Hr.has(n) || t === n))
    return { left: t, right: n };
}
function ml(e) {
  return e === null ? null : ca(e) ? e : void 0;
}
function hl(e) {
  return cl.has(e) ? e : void 0;
}
function fa(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = dl(t.anchor), r = Number(t.zoom), o = hl(t.mode), a = fl(t.splitLayout), s = ml(t.assistantPanel);
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
function Ke(e, t = ua()) {
  const n = da(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? fa(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function vn(e, t, n = ua()) {
  const r = da(e);
  if (!r || !n) return null;
  const o = Ke(e, n), a = fa({
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
function pl(e, t, n = "") {
  var d;
  const [r, o] = T(() => {
    var p;
    return ((p = Ke(n)) == null ? void 0 : p.zoom) ?? Mt(e, ct());
  }), a = M(r), s = M(n);
  a.current = r;
  const i = M(1), l = M(((d = Ke(n)) == null ? void 0 : d.zoom) !== void 0);
  D(() => {
    var m;
    if (s.current === n) return;
    s.current = n;
    const p = (m = Ke(n)) == null ? void 0 : m.zoom;
    l.current = p !== void 0;
    const g = p ?? Mt(e, ct());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), D(() => {
    if (l.current) return;
    const p = Mt(e, ct()), g = a.current;
    Math.abs(p - g) < 5e-4 || (i.current = 1, a.current = p, o(p));
  }, [e]);
  const c = C((p, g) => {
    const m = et(p), y = a.current;
    Math.abs(m - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : m / (y || 1), a.current = m, l.current = !0, vn(s.current, { zoom: m }), o(m));
  }, []), u = C((p) => {
    c(qt(a.current, p));
  }, [c]), f = C((p) => {
    c(Mt(p));
  }, [c]);
  return Pe(() => {
    const p = i.current;
    Math.abs(p - 1) < 1e-3 || (i.current = 1, ol(t == null ? void 0 : t.current, p));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: u, resetZoom: f };
}
const gl = 160, bl = 3e-3, Ur = 50, yl = 16, vl = 800;
function wl(e, t = 0) {
  const n = t === 1 ? yl : t === 2 ? vl : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Ur, Math.min(Ur, r));
  return Math.exp(-o * bl);
}
function Sl(e, t, n = 0) {
  return et(e * wl(t, n));
}
function kl(e) {
  return Math.round(et(e) * 100) / 100;
}
function Il(e, t, n) {
  const r = et(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return et(t) / r;
  const a = (o + oa) / r;
  return sa(a * et(t)) / o;
}
function Rl(e) {
  return Array.from(e.querySelectorAll(or()));
}
function El(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Pl(e, t, n) {
  let r = null;
  for (const s of Rl(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const l = El(i, t, n);
    if ((!r || l < r.distance) && (r = { el: s, rect: i, distance: l }), l === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Ee) || "",
    pane: o.getAttribute(Ie) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Tl(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ma(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${or()}[${Ee}="${t.page}"][${Ie}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Tl(n, e).scrollLeft += a);
}
function Ml(e, t, n, r) {
  const o = e.querySelector(`.${ea}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function zt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Nl = 600, Al = 1e3;
function Ll(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ma(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || c();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const l = r.setTimeout(() => c(), Al);
  function c() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(l);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return c;
}
function _l(e, t, n) {
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
      const f = kl(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        zt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, zt(d.grid));
      }, Nl), s.current = d, o.current(f, { keepScroll: !1 });
    }, c = (u) => {
      var p, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (p = i.current) == null || p.call(i), i.current = null;
        const m = s.current;
        m && (m.fallback && clearTimeout(m.fallback), s.current = null, zt(m.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: Pl(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Sl(f.target, u.deltaY, u.deltaMode);
      const d = Il(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Ml(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(l, gl);
    };
    return e.addEventListener("wheel", c, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", c);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), zt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Pe(() => {
    var c;
    const l = s.current;
    l && (s.current = null, l.fallback && clearTimeout(l.fallback), zt(l.grid), !(!e || !l.anchor) && (ma(e, l.anchor), (c = i.current) == null || c.call(i), i.current = Ll(e, l.anchor)));
  }, [t, e]);
}
function xl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: C((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const ar = 48;
function ha(e, t = ar) {
  return e.getBoundingClientRect().top + t;
}
function pa(e, t) {
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
  const o = mn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Wt(e, t, n = ar) {
  if (!e)
    return null;
  const r = fn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = ha(e, n), i = pa(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function _t(e, t, n = "auto", r, o = ar) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(fn(a, r))), i || (i = e.querySelector(fn(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function Dl(e, t, n = "smooth", r) {
  return _t(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function jn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var u;
    if (a) return;
    _t(
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
function Cl(e, t, n) {
  return jn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function pn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Be(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function zl(e, t, n = !0, r = "", o) {
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
    const f = fn(void 0, o), d = () => {
      if (l) return;
      const m = Array.from(i.querySelectorAll(f));
      if (!m.length)
        return;
      const y = ha(i), w = pa(m, y);
      w && s(w.page);
    }, p = () => {
      l || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, d();
      }));
    }, g = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        c = setTimeout(g, 120);
        return;
      }
      d(), i.addEventListener("scroll", p, { passive: !0 });
    };
    return g(), () => {
      l = !0, c && clearTimeout(c), u && cancelAnimationFrame(u), i.removeEventListener("scroll", p);
    };
  }, [e, t, n, r, o]), a;
}
const Ol = `canvas, .react-pdf__Page, .${na}, .${dn}`, Wr = /* @__PURE__ */ new WeakMap();
function $l(e) {
  const t = Number(e.getAttribute(nr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Wr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Ol), Wr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Fl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Bl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(or()).forEach((r) => {
    const o = mn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = $l(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function jl(e, t, n = "", r) {
  const [o, a] = T(() => /* @__PURE__ */ new Map()), s = M(o), i = M(r);
  return i.current = r, Pe(() => {
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
      const v = Bl(b);
      Fl(s.current, v) || (s.current = v, a(v)), u && !f && (f = !0, (k = i.current) == null || k.call(i));
    }, p = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    p();
    const g = window.setTimeout(p, 100), m = window.setTimeout(() => {
      u = !0, p();
    }, 300), y = window.setTimeout(p, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => p()), S.observe(w)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(g), window.clearTimeout(m), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Hl = [0, 48, 140, 320, 560], Ul = 700, Wl = [80, 200, 400], Kl = 500, Vl = 50, Jl = /* @__PURE__ */ new Set([
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
]), ql = 180, Kr = [0, 48, 140, 320, 700, 1200];
function Gl(e, t) {
  var R;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = M(
    ((R = Ke(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
  ), l = M(null), c = M(!1), u = M(r), f = M(null), d = M(null), p = M(null), g = M(null), m = M(a), y = M(""), w = M(n);
  w.current = n;
  const S = C(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = C(() => {
    !c.current && l.current == null || (S(), p.current != null && (clearTimeout(p.current), p.current = null), l.current = null, c.current = !1);
  }, [S]), v = C((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const _ = () => {
      g.current = null, vn(m.current, {
        anchor: Be(i.current)
      });
    };
    E ? _() : g.current = setTimeout(_, ql);
  }, []), k = C((E) => {
    i.current = Be(E), l.current = null, p.current != null && clearTimeout(p.current), p.current = setTimeout(() => {
      p.current = null, c.current = !1;
    }, Vl);
  }, []);
  D(() => {
    if (!o)
      return;
    let E = !1, _ = null, x = null, H = null;
    const $ = () => {
      if (E) return;
      const G = e.current;
      if (!G) {
        H = setTimeout($, 50);
        return;
      }
      _ = G, x = () => {
        if (c.current)
          return;
        const Z = Wt(_, w.current);
        Z && (i.current = Z, v());
      }, _.addEventListener("scroll", x, { passive: !0 }), c.current || x();
    };
    return $(), () => {
      E = !0, H != null && clearTimeout(H), _ && x && _.removeEventListener("scroll", x);
    };
  }, [o, r, n, e, v]), D(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const _ = (x) => {
      x.metaKey || x.ctrlKey || x.altKey || Jl.has(x.key) && b();
    };
    return E.addEventListener("wheel", b, { passive: !0 }), E.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", _), () => {
      E.removeEventListener("wheel", b), E.removeEventListener("touchmove", b), window.removeEventListener("keydown", _);
    };
  }, [o, e, b]), Pe(() => {
    var _;
    if (m.current === a) return;
    v(!0), S(), p.current != null && (clearTimeout(p.current), p.current = null), m.current = a, y.current = "";
    const E = (_ = Ke(a)) == null ? void 0 : _.anchor;
    i.current = E ? Be(E) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, u.current = r;
  }, [a, r, v, S]), D(() => {
    var _;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const E = Be(
      ((_ = Ke(a)) == null ? void 0 : _.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, l.current = E, c.current = !0, S(), f.current = jn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: Kr,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Math.max(...Kr) + 160), () => S();
  }, [o, s, a, e, k, S]), D(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      c.current = !1, l.current = null, S();
      return;
    }
    const E = l.current ? Be(l.current) : Be(i.current);
    return c.current = !0, l.current = E, i.current = E, S(), f.current = jn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Hl,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Ul), () => {
      S();
    };
  }, [r, o, n, e, k, S]), D(() => () => {
    S(), p.current != null && (clearTimeout(p.current), p.current = null), v(!0);
  }, [S, v]);
  const P = C(() => {
    const E = Wt(
      e.current,
      w.current
    );
    return Be(E || i.current);
  }, [e]), L = C(() => {
    c.current = !0;
    const E = Wt(
      e.current,
      w.current
    ), _ = Be(E ?? i.current);
    return i.current = _, l.current = _, v(), _;
  }, [e, v]), z = C((E, _, x) => {
    const H = x || w.current, $ = pn(E, _ || 1), G = { page: $, fraction: 0 };
    i.current = G, c.current = !0, l.current = G, v(), S(), Dl(e.current, $, "smooth", H), f.current = Cl(
      () => e.current,
      $,
      {
        behavior: "auto",
        pane: H,
        delaysMs: Wl,
        onDone: () => k(G)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(G);
    }, Kl);
  }, [e, k, S, v]), F = C(() => Be(i.current), []), N = C(() => c.current, []), I = C(() => {
    if (!c.current || !l.current)
      return;
    const E = Be(l.current);
    _t(
      e.current,
      E,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: P,
    beginModeSwitch: L,
    goToPage: z,
    getAnchor: F,
    isRestoring: N,
    repinIfRestoring: I
  };
}
function Xl(e, t) {
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
function ga(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Zl = [0, 80, 200, 400, 800], Yl = 120, Ql = 400;
function ec(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: u = !0 } = e, f = M(a);
  f.current = a;
  const d = M(s);
  d.current = s;
  const p = M(i);
  p.current = i;
  const g = M(n);
  g.current = n, D(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const m = ci(), y = Xl(m, d.current);
    if (y == null && (m != null && m.blockId) && !u) return;
    const w = ga(m, y, { jobId: l, documentId: c });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, m && ((k = p.current) == null || k.call(p, m, y));
    const S = [];
    let b = 0;
    for (const P of Zl)
      b = Math.max(b, P), S.push(
        setTimeout(() => {
          f.current(y);
        }, P)
      );
    return S.push(
      setTimeout(() => {
        var P;
        (P = g.current) == null || P.call(g);
      }, b + Yl)
    ), () => {
      for (const P of S) clearTimeout(P);
    };
  }, [r, o, l, c, t, u]);
}
function tc(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function nc(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Ql,
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
    const p = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", m = gs(g, o, u.current);
      if (d.current = o, m === null) return;
      const y = `${new URLSearchParams(m).get("block_id") || ""}`.trim();
      t.current = ga(
        { blockId: y },
        o,
        { jobId: i, documentId: l }
      ), (f.current || tc)(m);
    }, s);
    return () => clearTimeout(p);
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
function rc(e) {
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
  ec(a, t, o), nc(e, t, n);
}
const Ot = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function oc(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Vr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function ba(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Vr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Vr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function ac(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = ba(r, t, n);
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
function sc(e) {
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
function ic(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function lc(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function cc(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function uc(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Jr = [250, 500, 1e3, 2e3, 4e3], En = [80, 160, 320, 640, 1e3, 1500], qr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Hn(e, t) {
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
function sr(e) {
  return Is(e) ? `${e.code || ""}`.trim() : "";
}
function tn(e, t) {
  const n = sr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function dc(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ba(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = Rs(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = sr(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = En[Math.min(s, En.length - 1)];
    if (await Hn(i, r), s >= En.length + 2) throw a;
  }
}
function fc({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = T(Ot), s = M(o), i = M("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), u = Vt(c) ? c : "";
  return D(() => {
    if (!n || !l) {
      i.current = "", s.current = Ot, a(Ot);
      return;
    }
    const f = r === void 0 ? li() : r, d = i.current === l;
    if (i.current = l, !f) {
      const b = {
        ...d ? s.current : Ot,
        connection: u ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = b, a(b);
      return;
    }
    const p = new AbortController();
    let g = !1;
    const m = {
      ...d ? s.current : Ot,
      connection: u ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = m, a(m);
    const y = (b) => {
      p.signal.aborted || a((v) => {
        const k = b(v);
        return s.current = k, k;
      });
    }, w = async () => {
      let b = 0;
      for (; !p.signal.aborted; )
        try {
          const v = await f.fetchLayout(l, { signal: p.signal });
          g = !0, y((k) => ({
            ...k,
            layoutByPage: oc(v),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = sr(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            y((L) => ({
              ...L,
              connection: u ? "terminal" : "unavailable",
              jobStatus: c,
              error: tn(v, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((L) => ({
              ...L,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          y((L) => ({
            ...L,
            connection: "connecting",
            jobStatus: c,
            error: tn(v, "正在等待 OCR 版面数据")
          })), await Hn(Jr[Math.min(b, Jr.length - 1)], p.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await w(), !g || p.signal.aborted) return;
      let b = 0;
      for (; !p.signal.aborted; ) {
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
            signal: p.signal,
            onEvent: async (v) => {
              if (v.seq <= s.current.lastSeq) return;
              let k;
              try {
                k = await dc(
                  l,
                  v,
                  s.current,
                  p.signal,
                  f
                );
              } catch (P) {
                if ((P == null ? void 0 : P.name) === "AbortError" || p.signal.aborted) throw P;
                y((L) => ({
                  ...L,
                  lastSeq: Math.max(L.lastSeq, v.seq),
                  error: tn(P, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((P) => {
                const L = ac(P, v, k);
                return u ? {
                  ...L,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...L,
                  jobStatus: c
                };
              }), b = 0;
            }
          });
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError" || p.signal.aborted) return;
          y((k) => ({
            ...k,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: c,
            error: tn(v, "实时译文连接已中断，正在重连")
          }));
        }
        if (p.signal.aborted) return;
        if (u) {
          y((v) => ({
            ...v,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await Hn(qr[Math.min(b, qr.length - 1)], p.signal).catch(() => {
        }), b += 1;
      }
    })(), () => p.abort();
  }, [n, r, l, u]), o;
}
function mc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function hc(e, t = !0) {
  const [n, r] = T(() => /* @__PURE__ */ new Map());
  return D(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = nt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(mc(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const pc = 4500;
function gc(e) {
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
const bc = /* @__PURE__ */ new Set(["book", "translate"]);
function ya(e) {
  return !!(e.jobId && e.sourceUrl && bc.has(e.workflow));
}
function yc(e) {
  return !!(ya(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function vc() {
  const e = Wi(), t = ya({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = yc({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Vt(o) && (r.current.running = !0);
  const a = fc({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = qi(), u = hc(e.jobId, !e.sourceOnly), f = ul({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: p, onZoomChange: g } = pl(e.mode, s, f);
  _l(i, p, g);
  const m = Xi(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: p, shellWidth: l, identityKey: d }
  ), {
    beginModeSwitch: y,
    goToPage: w,
    repinIfRestoring: S
  } = Gl(s, {
    primaryPane: m.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: m.primaryNumPages > 0
  });
  D(() => {
    S();
  }, [l, S]);
  const b = jl(
    s,
    m.compareMode,
    m.rowSyncRevision,
    S
  ), v = zl(
    s,
    m.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${p}-${m.metricsTick}`,
    m.primaryPane
  ), k = C(($, G) => {
    var ae, se;
    const Z = Math.max(
      Number(m.hudNumPages) || 0,
      Number(m.primaryNumPages) || 0,
      Number((ae = m.numPagesByPane) == null ? void 0 : ae.source) || 0,
      Number((se = m.numPagesByPane) == null ? void 0 : se.translated) || 0
    );
    w($, Z, G);
  }, [w, m.hudNumPages, m.primaryNumPages, m.numPagesByPane]), [P, L] = T(null), z = M(null), F = C(($) => {
    z.current && clearTimeout(z.current), L($), $ && (z.current = setTimeout(() => L(null), pc));
  }, []);
  D(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const N = C(($) => {
    const G = In(e.regions, $);
    return G ? Cr(G, m.primaryPane).page : null;
  }, [e.regions, m.primaryPane]), I = C(($, G) => {
    const Z = G || m.primaryPane, ae = typeof $ == "object" && $ ? `${$.block_id || ""}`.trim() : "", se = typeof $ == "object" && $ ? `${$.image_url || ""}`.trim() : "", ce = typeof $ == "object" && $ ? $.page_idx != null ? Number($.page_idx) + 1 : $.page != null ? Number($.page) : null : typeof $ == "number" ? $ + 1 : null, ue = ys(e.regions, se, ce) || In(e.regions, ae) || (typeof $ == "object" ? vs(e.regions, $) : null);
    let le = ue ? Cr(ue, Z).page : null;
    le == null && (le = gc($)), !(le == null || le < 1) && (F(ue), k(le, Z));
  }, [F, k, m.primaryPane, e.regions]);
  rc({
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
      F(In(e.regions, $.blockId));
    }
  });
  const { setModeKeepingPage: R } = xl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  D(() => {
    F(null);
  }, [d, F]);
  const E = !e.boot.loading && !e.boot.failed, _ = J(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), x = J(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), H = J(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: p,
    onZoomChange: g,
    shell: _,
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
  }), [e, _, m, x, b, k, P, I, R, E, p, g, f, a, n, u]);
  return J(() => ({
    ...H,
    currentPage: v
  }), [H, v]);
}
const wc = [
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
], Sc = [
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
function kc(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of wc)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Ic(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Rc = ".reader-notes-panel";
function Ec(e) {
  return e instanceof Element ? !!e.closest(Rc) : !1;
}
function Pc(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Ic(d.target) || Ec(d.target))
        return;
      const p = d.key, g = kc(p);
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
              a(qt(o, 1));
              return;
            case "zoom-out":
              a(qt(o, -1));
              return;
            case "zoom-reset":
              a(Mt(t, ct()));
              return;
            case "next-page":
              l(pn(s + 1, i));
              return;
            case "prev-page":
              l(pn(s - 1, i));
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
const Tc = "retainpdf:soft-reader-close";
function Mc() {
  return new URL("./index.html", window.location.href).href;
}
function Nc() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Tc },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ac(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Lc() {
  if (!(typeof window > "u") && !Nc()) {
    if (Ac(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Mc());
  }
}
function _c({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ h("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function xc({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ A(_c, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Lc();
  }, children: [
    /* @__PURE__ */ h(St, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ h("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Dc = 3e3, Cc = 8;
async function zc(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Oc(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function $c(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Dc;
  const r = [], o = (s, i, l) => {
    const c = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Oc(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const p = l ? `${l}.${u}` : `${u}`, g = { id: p, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), c.push(g), i < Cc && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, p));
    }
    return c;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await zc(e, i);
  })), a;
}
function va(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function wa(e, t) {
  let n = null;
  for (const r of va(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function Gr(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Xr = !1;
function Fc() {
  if (Xr)
    return;
  const e = Jt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Zo.GlobalWorkerOptions.workerSrc = e, Xr = !0);
}
function Bc({
  marks: e,
  page: t,
  height: n,
  onOpen: r
}) {
  const o = e.filter((a) => a.anchor.page === t);
  return o.length ? /* @__PURE__ */ h("div", { className: "reader-ask-marks", "aria-label": "这一页问过的地方", children: o.map((a) => {
    var i;
    const s = a.anchor.selection || a.anchor.sourceText || `第 ${t} 页`;
    return /* @__PURE__ */ h(
      X,
      {
        className: "reader-ask-mark",
        style: { top: Math.round((((i = a.anchor.point) == null ? void 0 : i.y) ?? 0) * n) },
        "aria-label": `打开在这里的提问：${s.slice(0, 40)}`,
        title: `在这里问过：${s.slice(0, 80)}`,
        onPointerDown: (l) => l.stopPropagation(),
        onClick: () => r(a),
        children: "?"
      },
      a.key
    );
  }) }) : null;
}
const lt = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), jc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Hc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Uc = {
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
}, Zr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Wc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Zr(o ?? a ?? "", jc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Zr(o ?? a ?? "", Hc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Uc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Kc(e) {
  return lt(e.translatedBlockText) || lt(e.translated.text) || lt(e.source.text);
}
const Vc = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Jc(e) {
  const t = [];
  for (const n of e) {
    if (!Vc(n)) continue;
    const r = Wc(Kc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function qc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Gc = 24, Xc = 60;
function Yr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Gc), o = Math.min(e.length, n + t.length + Xc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Zc(e, t, n = 200) {
  const r = lt(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = lt(a.translatedBlockText) || lt(a.translated.text), l = i ? Yr(i, r) : null, c = l ?? Yr(lt(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function nn(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Bt(e, t) {
  const n = lt(t).toLowerCase();
  if (!n || !e) return nn(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${nn(e.slice(a, s))}<mark class="reader-find-mark">${nn(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + nn(e.slice(a));
}
function Yc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Sa = "reader-xref", Un = "data-xref", jt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Qc = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${jt})`), eu = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Wn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function tu(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function nu(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function ru(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const l = De(i);
    return l === "figure" || l === "table" || l === "formula";
  }, a = (i) => {
    const l = [];
    for (let c = t + i; o(e[c]) && l.length < 40; c += i) l.push(e[c]);
    return i < 0 ? l.reverse() : l;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function ou(e, t, n) {
  return (e.find((o) => De(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function au(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = De(r), s = nu(r);
    if (a === "formula") {
      for (const g of s.matchAll(eu)) {
        const m = Wn(g[1]);
        m && n({ key: `equation:${m}`, kind: "equation", label: m, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Qc.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const c = tu(i[1]), u = Wn(i[2]), f = ru(e, o, c), d = [...f.map((g) => g.itemId), r.itemId], p = new Map(e.map((g, m) => [g.itemId, m]));
    d.sort((g, m) => (p.get(g) ?? 0) - (p.get(m) ?? 0)), n({ key: `${c}:${u}`, kind: c, label: u, itemId: ou(f, r, c), itemIds: d, captionId: r.itemId });
  }), t;
}
const su = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${jt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${jt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${jt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${jt})\s*[）)]`, "g"), kind: () => "equation" }
];
function iu(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of su) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", l = Wn(s[s.length - 1]), c = `${a(i)}:${l}`;
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
function lu(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function cu(e, t, n = "") {
  const r = iu(e, t);
  if (!r.length) return Bt(e, n);
  let o = "", a = 0;
  for (const s of r)
    o += Bt(e.slice(a, s.start), n), o += `<mark class="${Sa}" ${Un}="${lu(s.key)}">${Bt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  return o + Bt(e.slice(a), n);
}
const uu = { figure: "图", table: "表", equation: "式" };
function Qr(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${uu[e.kind]} ${e.label}`;
}
function me(e) {
  return typeof e == "string" ? e : "";
}
function du(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function fu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function mu(e) {
  return {
    source: me(e == null ? void 0 : e.source_text) || me(e == null ? void 0 : e.unit_source_text),
    translated: me(e == null ? void 0 : e.protected_translated_text) || me(e == null ? void 0 : e.translated_text)
  };
}
const hu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ka(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function pu(e) {
  const t = ka(e).sort((r, o) => me(r.ts).localeCompare(me(o.ts)));
  return t.length ? [
    { text: me(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: me(r.new_text),
      label: hu[me(r.source)] || me(r.source) || "修订",
      ts: me(r.ts),
      reason: me(r.reason)
    }))
  ].reverse() : [];
}
function gu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function bu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return me(r.finished_at) || me(n.finished_at) || "";
}
function yu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ka(e).sort((a, s) => me(a.ts).localeCompare(me(s.ts)));
  for (const a of o) {
    const s = new Date(me(a.ts)).getTime(), i = me(a.reader_item_id) || me(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, me(a.new_text));
  }
  return n;
}
const vu = {
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
function wu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = vu[me(n.kind)] || me(n.kind) || "问题", o = me(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Su = /* @__PURE__ */ new Set(["text", "formula"]);
function ir(e) {
  return Su.has(e);
}
function ku(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || ir(De(n));
}
function Iu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !ir(De(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Ru = 300, Eu = 72;
function Pu(e, t) {
  if (e.width >= Ru && e.height >= Eu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Tu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Mu(e, t, n) {
  return e.flatMap((r) => {
    if (!Tu.has(De(r.region))) return [];
    const o = Yt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function eo(e, t, n) {
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
async function Nu(e) {
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
const Au = "reader-text-hover-copy", Lu = "reader-text-hover-edit", _u = "reader-text-hover-zoom", xu = "reader-text-hover-id";
function Du(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Ia = "reader-text-hover-tools";
function rn({
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
const Cu = 26, zu = 220;
function Ou(e, t = zu) {
  return e.height < Cu * 2 || e.width < t;
}
function $u({ state: e }) {
  return /* @__PURE__ */ h(e === "copied" ? Wo : e === "failed" ? St : Ps, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Fu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [l, c] = T("idle"), [u, f] = T("idle"), [d] = T(() => Du()), p = M([]), g = (e == null ? void 0 : e.itemId) || "";
  if (D(() => {
    c("idle"), f("idle");
    const k = p.current;
    return () => {
      k.forEach((P) => window.clearTimeout(P)), p.current = [];
    };
  }, [g]), !e) return null;
  const m = ws(e.highlight.region, t), y = De(e.highlight.region), w = (k, P) => async (L) => {
    L.preventDefault(), L.stopPropagation();
    const z = await Nu(k);
    P(z ? "copied" : "failed"), p.current.push(window.setTimeout(() => P("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (Ou(b) ? "outside" : "inside");
  return /* @__PURE__ */ h("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ h(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ A(
        "div",
        {
          className: Ia,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ h(
              rn,
              {
                className: xu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && ir(y) ? /* @__PURE__ */ h(
              rn,
              {
                className: Lu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ h(tr, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            m ? /* @__PURE__ */ h(
              rn,
              {
                className: Au,
                state: l,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: l === "copied" ? "已复制" : l === "failed" ? "复制失败" : S,
                onClick: w(m, c),
                children: /* @__PURE__ */ h($u, { state: l })
              }
            ) : null,
            o ? /* @__PURE__ */ h(
              rn,
              {
                className: _u,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ h(Es, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Bu(e, t) {
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
function ju(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = Yt(
      Bu(e, a),
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
const Hu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Uu = 256, $t = /* @__PURE__ */ new Map();
function Wu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Ra(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ti(t, { bareLatex: !0 }), o = Wu(n), a = ni(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = $t.get(t);
  if (!s && (s = ri(o, r), $t.set(t, s), $t.size > Uu)) {
    const i = $t.keys().next().value;
    i !== void 0 && $t.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Pn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ye(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Ku(e, t) {
  const n = e.typography, r = Ye(t) || 1, o = Ye(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Pn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = Ye(n == null ? void 0 : n.fit_min_font_size_pt), u = Ye(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : l
  ), p = o ? o * r : l, g = Ye(n == null ? void 0 : n.leading_em), m = [
    Ye(n == null ? void 0 : n.padding_top_pt) || 0,
    Ye(n == null ? void 0 : n.padding_right_pt) || 0,
    Ye(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ye(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Hu,
    fontSizePx: Math.max(f, Math.min(d, p)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Pn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Pn(e.kind) ? "center" : "justify",
    padding: m,
    exact: !!o
  };
}
function Vu(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const d = s.get(f);
    if (d !== void 0) return d;
    const { width: p, height: g } = e(f), m = p <= t + 0.5 && g <= n + 0.5;
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
const Ju = 512, Ft = /* @__PURE__ */ new Map();
let Kn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Kn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Kn += 1;
}));
function qu(e, t, n, r) {
  return [
    Kn,
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
function Ea({ item: e, pageScale: t }) {
  const n = M(null), r = J(
    () => Ra(e.translatedText),
    [e.translatedText]
  ), [o, a] = T(r.fallbackHtml), s = J(
    () => Ku(e, t),
    [e, t]
  );
  D(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Pe(() => {
    const f = n.current;
    if (!f) return;
    const [d, p, g, m] = s.padding, y = Math.max(1, e.rect.width - m - p), w = Math.max(1, e.rect.height - d - g), S = qu(o, y, w, s);
    let b = Ft.get(S);
    if (b === void 0 && (b = Vu(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ft.set(S, b), Ft.size > Ju)) {
      const v = Ft.keys().next().value;
      v !== void 0 && Ft.delete(v);
    }
    f.style.fontSize = `${b.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, l, c, u] = s.padding;
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
        padding: `${i}px ${l}px ${c}px ${u}px`
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
function Gu({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = J(
    () => ju(e, t, n, r),
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
        Ea,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Xu = bn(Gu);
function Zu({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ h("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ A("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ h(
        Ea,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: De(a.highlight.region),
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
const Yu = bn(Zu), Pa = 24, st = Pa * 2 + 4, Qe = 24, Qu = 4, ed = 6, gt = (e) => e.left + e.width, dt = (e) => e.top + e.height;
function Ht(e, t) {
  const n = Math.min(gt(e), gt(t)) - Math.max(e.left, t.left), r = Math.min(dt(e), dt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const to = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= gt(t) && r >= t.top && r <= dt(t);
}, td = (e) => e.height > 40 && e.height > e.width * 2.5;
function nd(e, t, n) {
  if (!t.length || e.height < Qe || e.width < n + 8) return null;
  const r = Math.max(...t.map(dt)), o = gt(e) - 4 - n;
  for (const a of [r, dt(e) - 2]) {
    const s = Math.max(e.top, a - Qe), i = { left: o, top: s, width: n, height: Qe };
    if (!t.some((l) => Ht(i, l) > 0)) return s - e.top;
  }
  return null;
}
function rd(e, t) {
  const n = [], r = (a) => {
    const s = Pa + Qu, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: gt(e), top: i, width: s, height: st } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: st } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Qe - 3, width: st, height: Qe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: dt(e), width: st, height: Qe + 3 } }), r(!0);
  const o = nd(e, t, st);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: gt(e) - 4 - st, top: e.top + o, width: st, height: Qe } }), n;
}
function od(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !td(S)), i = s.filter((S) => to(S, t)), l = s.filter((S) => !to(S, t)), c = n.filter((S) => S !== t && Ht(S, t) < t.width * t.height * 0.5), u = rd(t, i).filter(({ box: S, overhang: b }) => {
    const v = b ? ed : 0;
    return S.left >= -v && gt(S) <= r + v && S.top >= 0 && dt(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !l.some((b) => Ht(S, b) > 0), p = u.filter((S) => S.placement !== "tail"), g = p.find((S) => d(S) && !c.some((b) => Ht(S.box, b) > 0));
  if (g) return f(g);
  const m = p.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (m) return f(m);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = l.reduce((v, k) => v + Ht(S.box, k), 0);
    b < w && (y = S, w = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function ad(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Qe - 3 : dt(r);
  return t >= r.left - 4 && t <= r.left + st + 4 && n >= a && n <= a + Qe + 3;
}
const Tn = (e) => e.left + e.width, Mn = (e) => e.top + e.height;
function sd(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const u = c.left + c.width / 2, f = c.top + c.height / 2;
    u < e.left || u > Tn(e) || f < e.top || f > Mn(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, Tn(c)), i = Math.max(i, Mn(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(Tn(e) + r, s + n) - l.left, l.height = Math.min(Mn(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function id(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function ld(e, t, n, r) {
  const [o, a] = T(null);
  return Pe(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? id(s) : [], l = De(t.highlight.region) === "figure", c = i.length && !l ? sd(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: c, ...od({ frame: c, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const Ta = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], no = { pen: 35e-4, highlighter: 0.018 }, ro = 0.015, Vn = "retainpdf.reader.ink.v1:";
function oo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Vn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function cd(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Vn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Vn + e);
    } catch {
    }
}
function ud(e, t, n, r, o, a) {
  const s = ro * ro;
  return e.filter((i) => Ma(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Ma(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function dd(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function fd(e) {
  const [t, n] = T(null), [r, o] = T(Ta[0].key), [a, s] = T(() => oo(e)), i = M(a), l = M([]);
  D(() => {
    const m = oo(e);
    i.current = m, s(m), l.current = [];
  }, [e]);
  const c = C((m) => {
    i.current = m, s(m), cd(e, m);
  }, [e]), u = C((m) => {
    const y = i.current, w = m(y);
    w !== y && (l.current = [...l.current.slice(-49), y], c(w));
  }, [c]), f = C((m) => {
    m.points.length < 1 || u((y) => [...y, { ...m, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = C((m) => {
    m.length && u((y) => y.filter((w) => !m.includes(w.id)));
  }, [u]), p = C((m) => {
    u((y) => y.some((w) => w.page === m) ? y.filter((w) => w.page !== m) : y);
  }, [u]), g = C(() => {
    const m = l.current.pop();
    m && c(m);
  }, [c]);
  return J(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: p }),
    [t, r, a, f, d, g, p]
  );
}
const md = "reader-ink-layer";
function hd(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function ao({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ h(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: hd(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function pd({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = T(null), i = M(!1), l = o.strokes.filter((m) => Ma(m, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const u = (m) => {
    const y = m.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (m.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (m.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (m, y) => o.erase(ud(o.strokes, e, t, m, y, r / Math.max(1, n))), d = (m) => {
    if (!o.tool || m.button !== 0) return;
    m.preventDefault(), m.stopPropagation(), m.currentTarget.setPointerCapture(m.pointerId), i.current = !0;
    const [y, w] = u(m);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, p = (m) => {
    if (!i.current || !o.tool) return;
    m.stopPropagation();
    const [y, w] = u(m);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? dd(S, y, w) : [[y, w]]);
  }, g = (m) => {
    i.current && (i.current = !1, m.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: no[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ A(
    "svg",
    {
      className: md,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: p,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        l.map((m) => /* @__PURE__ */ h(ao, { stroke: m, width: n, height: r }, m.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ h(ao, { stroke: { tool: o.tool, color: o.color, width: no[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function gd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = T(null), [i, l] = T(!1), [c, u] = T([]), [f, d] = T(""), [p, g] = T(""), [m, y] = T(!1), [w, S] = T(null), [b, v] = T([]), k = r.drafts, P = r.generation, L = C(async (I, R) => {
    if (e)
      try {
        u(pu(await e.fetchRevisions(I, R)));
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
      const _ = `${(R == null ? void 0 : R.item_id) || n}`, { source: x, translated: H } = mu(E);
      s({ readerItemId: n, itemId: _, source: x, current: H }), d(k.get(n) ?? H);
    }).catch((R) => {
      I || S({ tone: "error", message: (R == null ? void 0 : R.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || l(!1);
    }), L(t, n), () => {
      I = !0;
    };
  }, [e, t, n, L]);
  const z = C((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), F = C(async (I, R) => {
    if (!e || !a || m) return !1;
    const E = I ?? f;
    if (!E.trim()) return !1;
    y(!0), S(null), v([]);
    try {
      const _ = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (R ?? p).trim() || "在阅读页手动修改",
        ...P.current != null ? { expected_generation: P.current } : {}
      }), x = Number(_ == null ? void 0 : _.generation);
      return Number.isFinite(x) && (P.current = x), k.delete(a.readerItemId), s({ ...a, current: E }), d(E), g(""), (_ == null ? void 0 : _.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), L(t, a.readerItemId), !0;
    } catch (_) {
      const x = _;
      return (x == null ? void 0 : x.reason) === "generation_mismatch" && (P.current = null), S({ tone: "error", message: (x == null ? void 0 : x.message) || "保存失败，请稍后再试。" }), v(wu(x == null ? void 0 : x.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, m, f, p, t, o, L, k, P]), N = C(() => {
    n && k.delete(n);
  }, [n, k]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: f,
    setDraft: z,
    reason: p,
    setReason: g,
    saving: m,
    status: w,
    issues: b,
    save: F,
    discardDraft: N
  };
}
const Na = "reader-inline-edit";
function bd({ text: e }) {
  const [t, n] = T("");
  return D(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Ra(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ A("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ h("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ h("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function yd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var N;
  const s = e.itemId, i = gd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = T(!1), [u, f] = T(!1), d = M(null), p = Pu(e.rect, t), g = J(() => Iu(o), [o]), m = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: k } = n, P = C((I) => {
    const R = g[m + I];
    R && (k(R), a == null || a(R));
  }, [g, m, k, a]), L = C(() => {
    i.discardDraft(), v();
  }, [i, v]), z = C(async (I, R) => {
    await i.save(I, R) && v();
  }, [i, v]);
  D(() => {
    const I = (R) => {
      !R.altKey || R.key !== "ArrowUp" && R.key !== "ArrowDown" || (R.preventDefault(), P(R.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [P]), Pe(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const R = p.mode === "inline" ? p.minHeight : 0;
    I.style.height = `${Math.max(R, I.scrollHeight + 2)}px`;
  }, [i.draft, y, p.mode, p.mode === "inline" ? p.minHeight : 0]);
  const F = p.mode === "inline" ? { left: p.left, top: p.top, width: p.width } : { left: p.left, width: p.width, top: p.top, bottom: p.bottom };
  return /* @__PURE__ */ A(wt, { children: [
    p.mode === "popout" ? /* @__PURE__ */ h("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ A(
      "div",
      {
        className: `${Na} is-${p.mode}`,
        style: F,
        role: "group",
        "aria-label": `改第 ${((N = n.target) == null ? void 0 : N.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": p.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ h(
            X,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((I) => !I),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ h("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ h("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ h(
            Zs,
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
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || z()) : I.key === "Escape" && (I.preventDefault(), L());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ h(bd, { text: i.draft }) : null,
          /* @__PURE__ */ A("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ h(pt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: m <= 0, onClick: () => P(-1), children: /* @__PURE__ */ h(Ts, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ h(pt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: m < 0 || m >= g.length - 1, onClick: () => P(1), children: /* @__PURE__ */ h(Ko, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ h(
              Xo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || z()) : I.key === "Escape" && (I.preventDefault(), L());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ A(
              X,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ h(Ms, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ h(X, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: L, children: "取消" }),
            /* @__PURE__ */ h(
              X,
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
          i.status ? /* @__PURE__ */ h("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ h("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ h("li", { children: I }, I)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ h("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, R) => {
            const E = I.text === y.current, _ = [gu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ A("li", { "data-block-edit-history": I.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ A("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ A("span", { children: [
                  _,
                  E ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ h(
                  X,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      z(I.text, `回到「${_.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ h("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${R}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Aa = Yn(null), La = Yn(null);
function vd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ h(Aa.Provider, { value: e, children: /* @__PURE__ */ h(La.Provider, { value: t, children: n }) });
}
function rt() {
  return Qn(Aa);
}
function _a() {
  return Qn(La);
}
const xa = 1.414;
function wd({
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
  hoveredRegionId: p,
  onHoverRegion: g,
  liveTranslationLayout: m,
  liveTranslationPage: y,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var re, de, be;
  const b = rt(), v = b == null ? void 0 : b.revisedBlocks, k = b == null ? void 0 : b.blockEdit, P = k == null ? void 0 : k.pendingEdits, L = b == null ? void 0 : b.editBlock, z = (b == null ? void 0 : b.findTerm) || "", F = b == null ? void 0 : b.xrefIndex, N = J(
    () => F != null && F.size ? ({ str: j }) => cu(j, F, z) : z ? ({ str: j }) => Bt(j, z) : void 0,
    [z, F]
  ), I = M(l ?? xa), [R, E] = T(I.current);
  D(() => {
    l != null && Math.abs(l - I.current) >= 1e-3 && (I.current = l, E(l));
  }, [l]);
  const _ = M(u);
  _.current = u;
  const x = M(null), H = M((j) => {
    var q;
    x.current = j, (q = _.current) == null || q.call(_, j);
  }).current, $ = M(null), G = M(`${t}@${n}`);
  Pe(() => {
    const j = `${t}@${n}`;
    G.current !== j && (G.current = j, o && kd(x.current, $.current));
  }, [o, n, t]), D(() => {
    o || Nn($.current);
  }, [o]), D(() => () => Nn($.current), []);
  const Z = Math.max(120, Math.floor(t * R)), ae = Math.max(Z, Math.ceil(s || 0)), se = Yt(f, t, Z), ce = J(
    () => Mu(d, t, Z),
    [Z, d, t]
  ), [ue, le] = T(null), Ce = typeof g == "function", te = Ce ? p ?? null : ue, ne = (j) => {
    Ce ? j !== (p ?? null) && (g == null || g(j)) : le((q) => q === j ? q : j);
  }, fe = J(
    () => ce.find((j) => j.itemId === te) || null,
    [te, ce]
  ), ve = r === "translated" && ((re = k == null ? void 0 : k.target) == null ? void 0 : re.itemId) || "", Se = J(
    () => ve && ce.find((j) => j.itemId === ve) || null,
    [ve, ce]
  ), ge = ld(x, o ? fe : null, ce, t), Ve = (j) => {
    var Me, $e, Ne, Fe, we;
    if (j.pointerType === "touch") return;
    if ((Me = b == null ? void 0 : b.ink) != null && Me.tool) {
      ne(null);
      return;
    }
    if (j.buttons !== 0) {
      ne(null);
      return;
    }
    if ((Ne = ($e = j.target) == null ? void 0 : $e.closest) != null && Ne.call($e, `.${Ia}`) || (we = (Fe = j.target) == null ? void 0 : Fe.closest) != null && we.call(Fe, `.${Na}`)) return;
    const q = j.currentTarget.getBoundingClientRect(), ee = j.clientX - q.left, Oe = j.clientY - q.top;
    if (ad(ge, ee, Oe)) return;
    const Te = eo(ce, ee, Oe);
    ne((Te == null ? void 0 : Te.itemId) || null);
  }, Je = (j) => {
    if (j.pointerType === "mouse") return;
    const q = j.currentTarget.getBoundingClientRect(), ee = eo(
      ce,
      j.clientX - q.left,
      j.clientY - q.top
    );
    ne((ee == null ? void 0 : ee.itemId) || null);
  }, ze = (j) => {
    !Number.isFinite(j) || j <= 0 || Math.abs(I.current - j) < 1e-3 || (I.current = j, E(j), c == null || c(e, j));
  };
  return /* @__PURE__ */ A(
    "div",
    {
      ref: H,
      [Ee]: e,
      [Ie]: r,
      [nr]: Z,
      className: rr,
      onPointerMoveCapture: Ve,
      onPointerDown: Je,
      onDoubleClick: (j) => {
        var ee;
        const q = b == null ? void 0 : b.zoomBlock;
        !q || (ee = b == null ? void 0 : b.ink) != null && ee.tool || !fe || De(fe.highlight.region) === "figure" && (j.preventDefault(), q(fe.itemId));
      },
      onPointerLeave: (j) => {
        j.pointerType === "mouse" && ne(null);
      },
      style: {
        width: t,
        height: ae,
        minHeight: ae
      },
      children: [
        o ? /* @__PURE__ */ h(
          Qs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: N,
            renderAnnotationLayer: !1,
            className: na,
            loading: /* @__PURE__ */ h(
              "div",
              {
                className: dn,
                style: { width: t, height: Z }
              }
            ),
            onLoadSuccess: (j) => {
              try {
                const q = j.getViewport({ scale: 1 });
                if (q.width > 0) {
                  const ee = q.height / q.width;
                  ze(ee);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Nn($.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ h(
          "div",
          {
            className: dn,
            style: { width: t, height: Z },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ h("div", { ref: $, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        se ? /* @__PURE__ */ h(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: se,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ h(
          Xu,
          {
            layoutPage: m,
            pageState: y,
            width: t,
            height: Z
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ h("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ h(Yu, { targets: ce, edits: P, width: t, excludeId: Se == null ? void 0 : Se.itemId }) : null,
        o && Se && k ? /* @__PURE__ */ h(
          yd,
          {
            target: Se,
            page: { width: t, height: Z },
            edit: k,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ h("div", { className: "reader-revised-markers", "aria-hidden": "true", children: ce.filter((j) => v.has(j.itemId)).map((j) => /* @__PURE__ */ h(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": j.itemId,
            style: { left: j.rect.left, top: j.rect.top, height: j.rect.height }
          },
          j.itemId
        )) }) : null,
        o && (b != null && b.ink) ? /* @__PURE__ */ h(
          pd,
          {
            page: e,
            pane: r === "translated" ? "translated" : b.compareVersion ? "compare" : "source",
            width: t,
            height: Z,
            ink: b.ink
          }
        ) : null,
        (de = b == null ? void 0 : b.askMarks) != null && de.length && b.onAskMark ? /* @__PURE__ */ h(Bc, { marks: b.askMarks, page: e, height: Z, onOpen: b.onAskMark }) : null,
        /* @__PURE__ */ h(
          Fu,
          {
            target: o && !((be = b == null ? void 0 : b.ink) != null && be.tool) && (fe == null ? void 0 : fe.itemId) !== (Se == null ? void 0 : Se.itemId) ? fe : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: fe && (v == null ? void 0 : v.get(fe.itemId)) || 0,
            onEdit: L,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: ge == null ? void 0 : ge.rect,
            placement: ge == null ? void 0 : ge.placement,
            tailTop: ge == null ? void 0 : ge.tailTop
          }
        )
      ]
    }
  );
}
const Sd = bn(wd);
function kd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Nn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Id = 2 * 1024 * 1024;
function Rd(e) {
  const t = new Zo.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const An = 5, Ed = "120% 0px", Pd = 120, Td = "25% 0px";
let so = 1;
const io = /* @__PURE__ */ new WeakMap();
function Md(e) {
  if (!e) return 0;
  const t = io.get(e);
  if (t) return t;
  const n = so;
  return so += 1, io.set(e, n), n;
}
function Nd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Ad = Fo(
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
    onDocument: p,
    onLoadError: g,
    onNumPagesChange: m,
    activeRegion: y = null,
    regions: w = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: v,
    liveTranslation: k,
    showLiveTranslation: P = t === "source",
    liveTranslationPendingLabel: L = "",
    paneAction: z
  }, F) {
    Fc();
    const { file: N, loading: I, error: R } = $i(n, r), E = `${n}\0${Md(N)}`, _ = M(E);
    _.current = E;
    const x = J(() => {
      const O = _i(N);
      return O ? "ranged" in O ? { range: Rd(O.ranged) } : O : null;
    }, [N, n]), [H, $] = T(0), [G, Z] = T(""), [ae, se] = T(null), [ce, ue] = T(480), le = M(null), Ce = M(0), te = J(() => Nd(), []), ne = J(() => ({
      cMapUrl: Jt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Jt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Id,
      disableAutoFetch: !0
    }), []);
    er(F, () => ae, [ae]), D(() => {
      const O = (W) => {
        Ce.current = W, ue(W);
      }, K = (W) => {
        const oe = sl(W, Ce.current);
        if (oe !== "ignore") {
          if (le.current && clearTimeout(le.current), oe === "immediate") {
            O(W);
            return;
          }
          le.current = setTimeout(() => O(W), ia);
        }
      }, V = !!(l && l >= 80);
      K(V ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const Q = !V && i && typeof ResizeObserver < "u" ? new ResizeObserver((W) => {
        var oe, ye;
        K(((ye = (oe = W[0]) == null ? void 0 : oe.contentRect) == null ? void 0 : ye.width) ?? i.clientWidth);
      }) : null;
      return Q && i && Q.observe(i), () => {
        Q == null || Q.disconnect(), le.current && clearTimeout(le.current);
      };
    }, [l, i, a]);
    const fe = J(
      () => rl(ce, o),
      [ce, o]
    ), [ve, Se] = T(() => /* @__PURE__ */ new Map()), [ge, Ve] = T(() => /* @__PURE__ */ new Set()), [Je, ze] = T(() => /* @__PURE__ */ new Set()), re = M(/* @__PURE__ */ new Map()), de = M(null), be = M(null), [j, q] = T(() => /* @__PURE__ */ new Set()), ee = M(/* @__PURE__ */ new Map()), Oe = C((O, K) => {
      Se((V) => {
        if (V.get(O) === K) return V;
        const Y = new Map(V);
        return Y.set(O, K), Y;
      });
    }, []), Te = C((O, K) => {
      const V = re.current, Y = V.get(O), Q = [de.current, be.current];
      if (Y)
        for (const W of Q)
          try {
            W == null || W.unobserve(Y);
          } catch {
          }
      if (K) {
        V.set(O, K);
        for (const W of Q)
          try {
            W == null || W.observe(K);
          } catch {
          }
      } else
        V.delete(O);
    }, []), Me = M(/* @__PURE__ */ new Map()), $e = C((O) => {
      const K = Me.current;
      let V = K.get(O);
      return V || (V = (Y) => Te(O, Y), K.set(O, V)), V;
    }, [Te]);
    D(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = ee.current, K = new IntersectionObserver(
        (V) => {
          const Y = [], Q = [];
          for (const W of V) {
            const oe = W.target, ye = mn(oe);
            Number.isFinite(ye) && (W.isIntersecting ? Y : Q).push(ye);
          }
          if ((Y.length || Q.length) && Ve((W) => {
            let oe = null;
            for (const ye of Y)
              W.has(ye) || (oe = oe || new Set(W), oe.add(ye));
            for (const ye of Q)
              W.has(ye) && (oe = oe || new Set(W), oe.delete(ye));
            return oe || W;
          }), Y.length) {
            for (const W of Y) {
              const oe = O.get(W);
              oe && (clearTimeout(oe), O.delete(W));
            }
            ze((W) => {
              let oe = null;
              for (const ye of Y)
                W.has(ye) || (oe = oe || new Set(W), oe.add(ye));
              return oe || W;
            });
          }
          for (const W of Q)
            O.has(W) || O.set(W, setTimeout(() => {
              O.delete(W), ze((oe) => {
                if (!oe.has(W)) return oe;
                const ye = new Set(oe);
                return ye.delete(W), ye;
              });
            }, Pd));
        },
        { root: i, rootMargin: Ed, threshold: 0 }
      );
      de.current = K;
      for (const V of re.current.values())
        try {
          K.observe(V);
        } catch {
        }
      return () => {
        K.disconnect(), de.current === K && (de.current = null);
        for (const V of O.values()) clearTimeout(V);
        O.clear();
      };
    }, [i]), D(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = new IntersectionObserver(
        (K) => {
          q((V) => {
            let Y = null;
            for (const Q of K) {
              const W = mn(Q.target);
              !Number.isFinite(W) || Q.isIntersecting === V.has(W) || (Y = Y || new Set(V), Q.isIntersecting ? Y.add(W) : Y.delete(W));
            }
            return Y || V;
          });
        },
        { root: i, rootMargin: Td, threshold: 0 }
      );
      be.current = O;
      for (const K of re.current.values())
        try {
          O.observe(K);
        } catch {
        }
      return () => {
        O.disconnect(), be.current === O && (be.current = null);
      };
    }, [i]);
    const Ne = !!i && typeof IntersectionObserver < "u";
    Pe(() => {
      $(0), Z(""), Ve(/* @__PURE__ */ new Set()), ze(/* @__PURE__ */ new Set()), Se(/* @__PURE__ */ new Map()), re.current.clear();
      const O = ee.current;
      for (const K of O.values()) clearTimeout(K);
      O.clear(), m == null || m(0, t);
    }, [E, m, t]);
    const Fe = C(
      (O) => {
        if (_.current !== E) return;
        const K = O.numPages;
        $(K), Z(""), m == null || m(K, t), f == null || f({ numPages: K, pane: t }), p && typeof O.getPage == "function" && p(O, t), d && typeof O.getOutline == "function" && $c(O).then((V) => {
          _.current === E && d(V, t);
        }, () => {
        });
      },
      [E, f, d, p, m, t]
    ), we = C(
      (O) => {
        if (_.current !== E) return;
        const K = (O == null ? void 0 : O.message) || "PDF 解析失败";
        Z(K), $(0), m == null || m(0, t), g == null || g(O, t);
      },
      [E, g, m, t]
    ), Ae = J(
      () => H > 0 ? Array.from({ length: H }, (O, K) => K + 1) : [],
      [H]
    );
    D(() => {
      typeof IntersectionObserver < "u" || ze(new Set(Ae));
    }, [Ae]);
    const je = J(
      () => cn(y, S, t),
      [y, S, t]
    ), qe = J(() => {
      const O = /* @__PURE__ */ new Map();
      for (const K of w) {
        const V = cn(K, S, t);
        if (!V) continue;
        const Y = O.get(V.box.page) || [];
        Y.push(V), O.set(V.box.page, Y);
      }
      return O;
    }, [t, S, w]), He = J(() => {
      const O = /* @__PURE__ */ new Set();
      if (!b) return O;
      for (const [K, V] of qe)
        V.some((Y) => Y.itemId === b) && O.add(K);
      return O;
    }, [b, qe]), Le = J(() => {
      if (H === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Ae);
      if (ge.size === 0) {
        const V = Math.min(H, An * 2 + 1);
        return new Set(Array.from({ length: V }, (Y, Q) => Q + 1));
      }
      const K = /* @__PURE__ */ new Set();
      for (const V of ge)
        for (let Y = -An; Y <= An; Y++) {
          const Q = V + Y;
          Q >= 1 && Q <= H && K.add(Q);
        }
      return K;
    }, [H, Ae, i, a, ge]), ot = !n || !!R || !!G, ft = n && (R || G) || s;
    return /* @__PURE__ */ A(
      "section",
      {
        ref: se,
        className: `reader-panel ${yn}${a ? "" : " is-hidden"}`,
        [Ie]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          z ? /* @__PURE__ */ h("div", { className: "reader-react-pdf-pane-action", children: z }) : null,
          L ? /* @__PURE__ */ A("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ h("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ h("span", { children: L })
          ] }) : null,
          ot && !I ? /* @__PURE__ */ h("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ft }) : null,
          I ? /* @__PURE__ */ h("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          x && !R ? /* @__PURE__ */ h("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ h(
            ei,
            {
              file: x,
              loading: null,
              error: null,
              options: ne,
              onLoadSuccess: Fe,
              onLoadError: we,
              className: "reader-react-pdf-document",
              children: Ae.map((O) => {
                if (Le.has(O))
                  return /* @__PURE__ */ h(
                    Sd,
                    {
                      pane: t,
                      pageNumber: O,
                      width: fe,
                      devicePixelRatio: te,
                      active: Je.has(O),
                      textLayer: !Ne || j.has(O),
                      syncedMinHeight: (c == null ? void 0 : c.get(O)) || 0,
                      onMetrics: u,
                      cachedAspect: ve.get(O),
                      onAspectChange: Oe,
                      sentinelRef: $e(O),
                      regionHighlight: (je == null ? void 0 : je.box.page) === O ? je : null,
                      regionTargets: qe.get(O),
                      hoveredRegionId: b && He.has(O) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(O - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(O - 1),
                      showLiveTranslation: P,
                      liveTranslationMissing: lc(k, O - 1)
                    },
                    `${t}-${O}`
                  );
                const V = ve.get(O) ?? xa, Y = Math.max(120, Math.floor(fe * V)), Q = Math.max(Y, Math.ceil((c == null ? void 0 : c.get(O)) || 0));
                return /* @__PURE__ */ h(
                  "div",
                  {
                    ref: $e(O),
                    [Ee]: O,
                    [Ie]: t,
                    [nr]: Y,
                    className: `${rr} is-placeholder`,
                    style: {
                      width: fe,
                      height: Q,
                      minHeight: Q
                    },
                    children: /* @__PURE__ */ h(
                      "div",
                      {
                        className: dn,
                        style: { width: fe, height: Y },
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
), lo = bn(Ad), Ld = 2e3, _d = 6, xd = 500, co = "reader-react-resizing";
function Dd(e, t) {
  const n = M(null), r = M(null);
  Pe(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = Cd(e), k = Wt(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let u = 0, f = null, d = e.scrollHeight, p = d, g = 0, m = c;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const P of v) {
        const L = Math.round(P.contentRect.height);
        y.has(P.target) && y.get(P.target) !== L && (k = !0), y.set(P.target, L);
      }
      k && _t(e, l, "auto", i);
    }), S = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(co);
      for (const k of uo) e.removeEventListener(k, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, b = () => {
      _t(e, l, "auto", i);
      const v = e.scrollHeight;
      g = v === p ? g + 1 : 0, p = v;
      const k = performance.now() - m;
      g >= _d && (v !== d || k > xd) || k > Ld ? S() : u = requestAnimationFrame(b);
    };
    for (const v of uo) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(co), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, m = performance.now(), d = e.scrollHeight, p = d, g = 0, u = requestAnimationFrame(b);
    }, ia);
  }, [e, t]), D(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Cd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ee}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ie) || null;
  }
  return null;
}
const uo = ["wheel", "touchstart", "keydown", "pointerdown"];
function zd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Od(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(yn)) && ((n = e.hasAttribute) != null && n.call(e, Ie)));
}
function $d(e, t) {
  D(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Od(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${yn}[${Ie}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const l = zd(a, i);
        if (l === null || Math.abs(i.scrollLeft - l) < 1) continue;
        const c = i.scrollLeft;
        i.scrollLeft = l, Math.abs(i.scrollLeft - c) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Fd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), l = t - i, c = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: l * c };
}
function Bd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const fo = 12;
function lr(e) {
  return Array.from(e.querySelectorAll(`.${yn}[${Ie}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function jd(e) {
  const t = e.getBoundingClientRect();
  return lr(e).map((n) => {
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
function Hd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Ud(e, t) {
  return e ? lr(e).find((n) => n.getAttribute(Ie) === t) ?? null : null;
}
function Wd({ shellEl: e }) {
  const [t, n] = T([]), r = M(0), o = C(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = jd(e);
      n((i) => Hd(i, s) ? i : s);
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
        for (const f of lr(e))
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
  return a.length ? /* @__PURE__ */ h("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ h(Kd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Kd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - fo * 2), r = Fd(e, n), o = M(null);
  if (!r) return null;
  const a = (d) => {
    const p = Ud(t, e.pane);
    p && (p.scrollLeft = d);
  }, s = (d) => {
    var p, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (p = d.currentTarget).setPointerCapture) == null || g.call(p, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const p = o.current;
    !p || p.pointerId !== d.pointerId || a(p.startScroll + Bd(e, n, r.size, d.clientX - p.startX));
  }, l = (d) => {
    var p, g, m;
    ((p = o.current) == null ? void 0 : p.pointerId) === d.pointerId && (o.current = null, (m = (g = d.currentTarget).releasePointerCapture) == null || m.call(g, d.pointerId));
  }, c = (d) => {
    if (d.button !== 0 || d.target !== d.currentTarget) return;
    d.preventDefault();
    const p = d.currentTarget.getBoundingClientRect(), g = d.clientX - p.left, m = e.width * 0.8;
    a(e.scrollLeft + (g < r.offset ? -m : m));
  }, u = e.pane === "translated" ? "译文栏左右滚动" : "原文栏左右滚动", f = Math.max(0, e.scrollWidth - e.width);
  return /* @__PURE__ */ h(
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
      style: { left: e.left + fo, width: n },
      onPointerDown: c,
      children: /* @__PURE__ */ h(
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
function Da(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Vd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Jd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ A("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ h("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ h("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ h("li", { children: /* @__PURE__ */ A(
        X,
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
            /* @__PURE__ */ h("span", { className: "reader-version-compare-time", children: Da(n.createdAt) }),
            r ? /* @__PURE__ */ h("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ h(Wo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ h(Ns, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ h("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ A("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ A(
        X,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ h(As, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ A(
        X,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ h(Ls, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function mo({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Vd(t), a = [e === "compare" ? "对比" : "正在读", r, Da(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ A("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ h("em", { children: "RetainPDF" }),
    /* @__PURE__ */ h("strong", { children: o }),
    /* @__PURE__ */ h("span", { children: a })
  ] });
}
function qd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = T({ source: null, translated: null });
  return Pe(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const u = e.querySelector(`[${Ie}="${c}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Ie}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ A("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ h("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ h(mo, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ h("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ h(mo, { role: "reading", ...n }) }) : null
  ] });
}
const Gd = () => () => {
}, ho = () => null;
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
function Zd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Yd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Qd(e) {
  const t = rt(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, p = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Qt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, m = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, L = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, z = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), F = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), N = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, R = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], _ = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), x = (t == null ? void 0 : t.regionHover) ?? null, [H, $] = T(null), G = Bo(
    x ? x.subscribe : Gd,
    x ? () => x.get().itemId : ho,
    x ? () => x.get().itemId : ho
  ), Z = x ? G : H, ae = C((le) => {
    x ? x.set(le, "pdf") : $(le);
  }, [x]), se = Xd({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: u
  }), ue = Number.isFinite(g) && g > 0 ? Zd(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Dd(d, ue), $d(d, se.compareMode), /* @__PURE__ */ A(
    "div",
    {
      ref: f,
      className: ta,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(Ss).length,
      "data-reader-metadata-ready": _ ? "true" : "false",
      children: [
        /* @__PURE__ */ A(
          "main",
          {
            className: `${ea} reader-mode-${se.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ h(
                lo,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: P,
                  userZoom: p,
                  visible: se.showSource,
                  scrollRoot: d,
                  pageWidthOverride: ue,
                  rowHeights: se.compareMode ? m : void 0,
                  onMetrics: z,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: F,
                  onOutline: b ? void 0 : N,
                  onDocument: b ? void 0 : I,
                  activeRegion: R,
                  regions: (b == null ? void 0 : b.regions) ?? E,
                  readerMetadata: _,
                  hoveredRegionId: Z,
                  onHoverRegion: ae,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Yd(o) : "",
                  paneAction: u && se.showTranslated ? /* @__PURE__ */ A(wt, { children: [
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
                b ? `compare:${b.url}` : "source"
              ) : null,
              w ? /* @__PURE__ */ h(
                lo,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: L,
                  userZoom: p,
                  visible: se.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: ue,
                  rowHeights: se.compareMode ? m : void 0,
                  onMetrics: z,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: F,
                  onOutline: N,
                  onDocument: I,
                  activeRegion: R,
                  regions: E,
                  readerMetadata: _,
                  hoveredRegionId: Z,
                  onHoverRegion: ae,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ h(Wd, { shellEl: d }),
        b ? /* @__PURE__ */ h(qd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const ef = [
  { id: "source", label: "原文", Icon: Vo },
  { id: "compare", label: "对照", Icon: Jo },
  { id: "translated", label: "译文", Icon: qo }
];
function tf(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function nf(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function rf(e) {
  const t = rt(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? tf(a.state) : "";
  return /* @__PURE__ */ A("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ h("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ h("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ A("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ h("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: ef.map(({ id: c, label: u, Icon: f }) => {
        const d = n === c, p = nf({
          id: c,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ A(
          "button",
          {
            type: "button",
            className: `reader-workspace-tab${d ? " is-active" : ""}`,
            role: "tab",
            "aria-selected": d,
            "aria-label": u,
            title: p ? `${u} 需要文档任务` : u,
            disabled: p,
            onClick: () => o(c),
            children: [
              /* @__PURE__ */ h(f, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ h("span", { className: "reader-workspace-tab-label", children: u })
            ]
          },
          c
        );
      }) }),
      a ? /* @__PURE__ */ A("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ A(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${l}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ h(_s, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ h("span", { className: "reader-live-translation-toggle-label", children: l })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ A(
          X,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ h(xs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ h("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ h("div", { className: "reader-live-strip", children: /* @__PURE__ */ A(
        X,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ h(Ds, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ h("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const of = Fo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ A(
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
}), af = of, sf = {
  markdown: { label: "Markdown", short: "MD", Icon: af, needsJob: !0 }
}, lf = la.map(
  (e) => ({ id: e, ...sf[e] })
);
function Ca() {
  return lf.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function cf(e) {
  const t = rt(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ h(wt, { children: Ca().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
    const u = n === s, f = c && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ A(
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
          /* @__PURE__ */ h(l, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ h("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function uf(e) {
  const t = rt(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Ca().map(({ id: l, label: c, short: u, Icon: f, needsJob: d }) => ({
    key: l,
    label: c,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === l,
    badge: r == null ? void 0 : r[l],
    onClick: () => a(l)
  }));
  return n ? /* @__PURE__ */ A("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ h("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: u, disabled: f, selected: d, badge: p, onClick: g }) => /* @__PURE__ */ A(
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
          /* @__PURE__ */ h(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ h("span", { className: "reader-assistant-dock-tab-label", children: c }),
          p ? /* @__PURE__ */ h("span", { className: "reader-assistant-dock-badge", children: p }) : null
        ]
      },
      l
    )) }),
    /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ h(St, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function df(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function ff(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function mf(e) {
  return e / 100 * window.innerHeight;
}
function hf(e) {
  return e / 100 * window.innerWidth;
}
function pf(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Ut({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = pf(n);
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
      r = ff(t, o);
      break;
    }
    case "em": {
      r = df(t, o);
      break;
    }
    case "vh": {
      r = mf(o);
      break;
    }
    case "vw": {
      r = hf(o);
      break;
    }
  }
  return r;
}
function Re(e) {
  return parseFloat(e.toFixed(3));
}
function xt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Jn(e) {
  const { panels: t } = e, n = xt({ group: e });
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
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Re(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Re(u / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = Re(u / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = Re(u / n * 100);
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
function qn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? gf : bf
  );
}
function gf(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function bf(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function za(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Oa(e, t) {
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
function yf({
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
    const { x: i, y: l } = Oa(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return ie(o, "No rect found"), o;
}
let on;
function vf() {
  return on === void 0 && (typeof matchMedia == "function" ? on = !!matchMedia("(pointer:coarse)").matches : on = !1), on;
}
function $a(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = qn(
    n,
    Array.from(t.children).filter(za).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, l = !1, c = -1, u = -1, f = 0, d, p = [];
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
              switch (p.length) {
                case 0: {
                  b = [
                    v,
                    k
                  ];
                  break;
                }
                case 1: {
                  const P = p[0], L = yf({
                    orientation: n,
                    rects: [w, S],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  b = [
                    P,
                    L === w ? k : v
                  ];
                  break;
                }
                default: {
                  b = p;
                  break;
                }
              }
            } else
              p.length ? b = p : b = [
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
              const P = vf() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
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
              const L = g <= c || g > u;
              !i && !L && s.push({
                group: e,
                groupSize: xt({ group: e }),
                panels: [d, y],
                separator: "width" in v ? void 0 : v,
                rect: k
              }), i = !1;
            }
          }
          l = !1, d = y, p = [];
        }
      } else if (m.hasAttribute("data-separator")) {
        m.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (w) => w.element === m
        );
        y ? p.push(y) : (d = void 0, p = []);
      } else
        l = !0;
  }
  return s;
}
var it;
class Fa {
  constructor() {
    _r(this, it, {});
  }
  addListener(t, n) {
    const r = Ct(this, it)[t];
    return r === void 0 ? Ct(this, it)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Ct(this, it)[t];
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
    xr(this, it, {});
  }
  removeListener(t, n) {
    const r = Ct(this, it)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
it = new WeakMap();
let At = {
  cursorFlags: 0,
  state: "inactive"
};
const cr = new Fa();
function bt() {
  return At;
}
function wf(e) {
  return cr.addListener("change", e);
}
function Sf(e) {
  const t = At, n = { ...At };
  n.cursorFlags = e, At = n, cr.emit("change", {
    prev: t,
    next: n
  });
}
function Lt(e) {
  const t = At;
  At = e, cr.emit("change", {
    prev: t,
    next: e
  });
}
const kf = (e) => e, Ln = () => {
}, Ba = 1, ja = 2, Ha = 4, Ua = 8, po = 3, go = 12;
let an;
function bo() {
  return an === void 0 && (an = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (an = !0)), an;
}
function If({
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
        if (e && bo()) {
          const a = (e & Ba) !== 0, s = (e & ja) !== 0, i = (e & Ha) !== 0, l = (e & Ua) !== 0;
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
    return bo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const yo = /* @__PURE__ */ new WeakMap();
function ur(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = yo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = bt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = If({
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
  yo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let We = /* @__PURE__ */ new Map();
const Wa = new Fa();
function Rf(e) {
  We = new Map(We), We.delete(e);
}
function vo(e, t) {
  for (const [n] of We)
    if (n.id === e)
      return n;
}
function ut(e, t) {
  for (const [n, r] of We)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function kt() {
  return We;
}
function dr(e, t) {
  return Wa.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function tt(e, t, n) {
  const r = We.get(e);
  We = new Map(We), We.set(e, t), Wa.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Ka(e) {
  const t = bt();
  let n = !1;
  switch (t.state) {
    case "active":
      Lt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (ur(e), n = !0, t.hitRegions.forEach((r) => {
        const o = ut(r.group.id, !0);
        tt(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function wo(e) {
  e.defaultPrevented || Ka(e.currentTarget);
}
function Ef(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Oa(n, a.rect);
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
function Pf(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Tf(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Io(e),
    b: Io(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ie(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: ko(So(n.a)),
    b: ko(So(n.b))
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
const Mf = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Nf(e) {
  const t = getComputedStyle(Va(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Af(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Nf(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Mf.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function So(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ie(n, "Missing node"), Af(n)) return n;
  }
  return null;
}
function ko(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Io(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Va(e);
  return t;
}
function Va(e) {
  const { parentNode: t } = e;
  return Pf(t) ? t.host : t;
}
function Lf(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function _f({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!za(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Tf(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Lf(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function fr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = $a(o), s = Ef(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && _f({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function xf(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function ke(e, t, n = 0) {
  return Math.abs(Re(e) - Re(t)) <= n;
}
function Ue(e, t) {
  return ke(e, t) ? 0 : e > t ? 1 : -1;
}
function Nt({
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
  if (Ue(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      Ue(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = Re(r), r;
}
function Gt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (ke(e, 0))
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
          ), ke(v, w)) {
            const k = b - v;
            Ue(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
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
          ), ke(v, b)) {
            const k = v - w;
            Ue(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
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
      if (S && Ue(w, v) < 0)
        if (e > 0) {
          const k = v - b, P = k / 2, L = w + e;
          Ue(L, v) < 0 && (e = Ue(e, P) <= 0 ? 0 : k);
        } else {
          const k = v - b, P = 100 - k / 2, L = w - e;
          Ue(L, v) < 0 && (e = Ue(100 + e, P) > 0 ? 0 : -k);
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
      const v = Nt({
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
      const S = w - y, b = Nt({
        overrideDisabledPanels: s,
        panelConstraints: n[m],
        prevSize: w,
        size: S
      });
      if (!ke(w, b) && (d += w - b, c[m] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? m-- : m++;
    }
  }
  if (xf(l, c))
    return o;
  {
    const m = e < 0 ? f : u, y = i[m];
    ie(
      y != null,
      `Previous layout not found for panel index ${m}`
    );
    const w = y + d, S = Nt({
      overrideDisabledPanels: s,
      panelConstraints: n[m],
      prevSize: y,
      size: w
    });
    if (c[m] = S, !ke(S, w)) {
      let b = w - S, v = e < 0 ? f : u;
      for (; v >= 0 && v < n.length; ) {
        const k = c[v];
        ie(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const P = k + b, L = Nt({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: P
        });
        if (ke(k, L) || (b -= L - k, c[v] = L), ke(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const p = Object.values(c).reduce(
    (m, y) => y + m,
    0
  );
  if (!ke(p, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return c.reduce((m, y, w) => (m[g[w]] = y, m), {});
}
function yt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ue(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function vt({
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
  if (!ke(o, 100) && r.length > 0)
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
    const u = Nt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: l,
      size: c
    });
    c != u && (a += c - u, r[i] = u);
  }
  if (!ke(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      ie(l != null, `No layout data found for index ${i}`);
      const c = l + a, u = Nt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== u && (a -= u - l, r[i] = u, ke(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, l, c) => (i[s[c]] = l, i), {});
}
function Ja({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = kt();
    for (const [
      c,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: f,
        layout: d,
        groupSize: p,
        separatorToPanels: g
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: f,
          group: c,
          groupSize: p,
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
    const d = a(), p = c.findIndex((y) => y.id === t), g = p === 0, m = p === c.length - 1;
    if (m && l < d && (g || c.slice(0, p).every((y, w) => {
      const S = f[w];
      return (S == null ? void 0 : S.collapsible) && ke(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = c.slice(0, p).reduce((w, S) => w + u[S.id], 0);
      return {
        ...u,
        [t]: Re(100 - y)
      };
    }
    return Gt({
      delta: m ? d - l : l - d,
      initialLayout: u,
      panelConstraints: f,
      pivotIndices: m ? [p - 1, p] : [p, p + 1],
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
      groupSize: p,
      layout: g,
      separatorToPanels: m
    } = n(), y = s({
      nextSize: l,
      panels: d.panels,
      prevLayout: g,
      derivedPanelConstraints: f
    }), w = vt({
      layout: y,
      panelConstraints: f
    });
    yt(g, w) || tt(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: p,
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
        let p = f.expandToSize ?? u;
        p === 0 && (p = 1), i(p);
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
      return l && ke(c, u);
    },
    resize: (l) => {
      const { group: c } = n(), { element: u } = o(), f = xt({ group: c }), d = Ut({
        groupSize: f,
        panelElement: u,
        styleProp: l
      }), p = Re(d / f * 100);
      i(p);
    }
  };
}
function Ro(e) {
  if (e.defaultPrevented)
    return;
  const t = kt();
  fr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Ja({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function sn(e) {
  const t = kt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function qa({
  groupId: e
}) {
  const t = () => {
    const n = kt();
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
      } = t(), c = vt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (yt(i, c) || tt(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function ht(e, t) {
  const n = sn(e), r = ut(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ie(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ie(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = qa({ groupId: n.id }).getLayout(), l = Gt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = vt({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  yt(i, c) || tt(
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
function Eo(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = sn(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ht(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ht(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ht(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ht(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ht(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = sn(t), o = ut(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (d) => d.element === t
        );
        ie(l, "Matching separator not found");
        const c = i.get(l);
        ie(c, "Matching panels not found");
        const u = c[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (ie(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], p = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ht(t, p - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = sn(t).separators.map(
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
        e.preventDefault(), ht(t, -100);
        break;
      }
    }
}
function Po(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = kt(), n = fr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Lt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Ga({
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
    const { group: u, groupSize: f } = c, { orientation: d, panels: p } = u, { disableCursor: g } = u.mutableState;
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
      const L = Gt({
        delta: m,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: c.panels.map((z) => p.indexOf(z)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (yt(L, k)) {
        if (m !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= m < 0 ? Ba : ja;
              break;
            }
            case "vertical": {
              i |= m < 0 ? Ha : Ua;
              break;
            }
          }
      } else
        tt(c.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: L,
          separatorToPanels: P
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & po : l |= i & po, t.movementY === 0 ? l |= s & go : l |= i & go, Sf(l), ur(e);
}
function To(e) {
  const t = kt(), n = bt();
  switch (n.state) {
    case "active":
      Ga({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Mo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = bt(), n = kt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Lt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = ut(a.group.id, !0);
          tt(a.group, s, {
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
      Ga({
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
      const a = fr(e, n);
      a.length === 0 ? t.state !== "inactive" && Lt({
        cursorFlags: 0,
        state: "inactive"
      }) : Lt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), ur(e.currentTarget);
      break;
    }
  }
}
function No(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (bt().state) {
      case "hover":
        Lt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Ao(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Ka(e.currentTarget) && e.preventDefault();
}
function Lo(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Re(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Re((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Df(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = xt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Re(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Cf(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function zf({
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
        const p = d / 100 * n, g = Re(
          p / t * 100
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
      u[f] = Re(
        d / a * c
      );
    }
  else {
    const f = Re(
      c / l.length
    );
    for (const d of l)
      u[d] = f;
  }
  return u;
}
function Of(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Et = /* @__PURE__ */ new Map();
function $f(e) {
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
          const S = xt({ group: e });
          if (S === 0)
            return;
          const b = ut(e.id);
          if (!b)
            return;
          const v = Jn(e), k = b.defaultLayoutDeferred ? Lo(v) : b.layout, P = zf({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: k
          }), L = vt({
            layout: P,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && yt(b.layout, L) && Cf(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === S)
            return;
          tt(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: L,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        Df(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    ie(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = xt({ group: e }), i = Jn(e), l = e.panels.map(({ id: g }) => g).join(",");
  let c = e.mutableState.defaultLayout;
  c && (Of(e.panels, c) || (c = void 0));
  const u = e.mutableState.layouts[l] ?? c ?? Lo(i), f = vt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  Et.set(
    d,
    (Et.get(d) ?? 0) + 1
  );
  const p = /* @__PURE__ */ new Map();
  return $a(e).forEach((g) => {
    g.separator && p.set(g.separator, g.panels);
  }), tt(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: p
  }), e.separators.forEach((g) => {
    ie(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Eo);
  }), Et.get(d) === 1 && (d.addEventListener("contextmenu", wo, !0), d.addEventListener("dblclick", Ro, !0), d.addEventListener("pointerdown", Po, !0), d.addEventListener("pointerleave", To), d.addEventListener("pointermove", Mo), d.addEventListener("pointerout", No), d.addEventListener("pointerup", Ao, !0)), function() {
    t = !1, Et.set(
      d,
      Math.max(0, (Et.get(d) ?? 0) - 1)
    ), Rf(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Eo);
    }), Et.get(d) || (d.removeEventListener(
      "contextmenu",
      wo,
      !0
    ), d.removeEventListener(
      "dblclick",
      Ro,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Po,
      !0
    ), d.removeEventListener("pointerleave", To), d.removeEventListener("pointermove", Mo), d.removeEventListener("pointerout", No), d.removeEventListener("pointerup", Ao, !0)), a.disconnect();
  };
}
function Ff() {
  const [e, t] = T({}), n = C(() => t({}), []);
  return [e, n];
}
function mr(e) {
  const t = jo();
  return `${e ?? t}`;
}
const It = typeof window < "u" ? Pe : D;
function Kt(e) {
  const t = M(e);
  return It(() => {
    t.current = e;
  }, [e]), C(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function hr(...e) {
  return Kt((t) => {
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
function pr(e) {
  const t = M({ ...e });
  return It(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Xa = Yn(null);
function Bf(e, t) {
  const n = M({
    getLayout: () => ({}),
    setLayout: kf
  });
  er(t, () => n.current, []), It(() => {
    Object.assign(
      n.current,
      qa({ groupId: e })
    );
  });
}
function Za({
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
  ...p
}) {
  const g = M({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), m = Kt((I) => {
    yt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, l == null || l(I));
  }), y = Kt(
    (I, R) => {
      yt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, c == null || c(I, { isUserInteraction: R }));
    }
  ), w = mr(i), S = M(null), [b, v] = Ff(), k = M({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), P = hr(S, a);
  Bf(w, s);
  const L = Kt(
    (I, R) => {
      const E = bt(), _ = vo(I), x = ut(I);
      if (x) {
        let H = !1;
        switch (E.state) {
          case "active": {
            H = E.hitRegions.some(
              ($) => $.group === _
            );
            break;
          }
        }
        return {
          flexGrow: x.layout[R] ?? 1,
          pointerEvents: H ? "none" : void 0
        };
      }
      if (n != null && n[R])
        return {
          flexGrow: n == null ? void 0 : n[R]
        };
    }
  ), z = pr({
    defaultLayout: n,
    disableCursor: r
  }), F = J(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: L,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const R = k.current;
        return R.panels = qn(u, [
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
        return R.separators = qn(u, [
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
          (H) => H.id === I
        );
        E && (E.panelConstraints.disabled = R);
        const _ = vo(w), x = ut(w);
        _ && x && tt(_, {
          ...x,
          derivedPanelConstraints: Jn(_)
        });
      },
      updateSeparatorProps: (I, {
        disabled: R,
        disableDoubleClick: E
      }) => {
        const _ = k.current.separators.find(
          (x) => x.id === I
        );
        _ && (_.disabled = R, _.disableDoubleClick = E);
      }
    }),
    [L, w, v, u, z]
  ), N = M(null);
  return It(() => {
    const I = S.current;
    if (I === null)
      return;
    const R = k.current;
    let E;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === R.panels.length) {
      E = {};
      for (const ae of R.panels) {
        const se = z.defaultLayout[ae.id];
        se !== void 0 && (E[ae.id] = se);
      }
    }
    const _ = {
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
    N.current = _;
    const x = $f(_), { defaultLayoutDeferred: H, derivedPanelConstraints: $, layout: G } = ut(_.id, !0);
    !H && $.length > 0 && (m(G), y(G, !1));
    const Z = dr(w, (ae) => {
      const { defaultLayoutDeferred: se, derivedPanelConstraints: ce, layout: ue } = ae.next;
      if (se || ce.length === 0)
        return;
      const le = _.panels.map(({ id: te }) => te).join(",");
      _.mutableState.layouts[le] = ue, ce.forEach((te) => {
        if (te.collapsible) {
          const { layout: ne } = ae.prev ?? {};
          if (ne) {
            const fe = ke(
              te.collapsedSize,
              ue[te.panelId]
            ), ve = ke(
              te.collapsedSize,
              ne[te.panelId]
            );
            fe && !ve && (_.mutableState.expandedPanelSizes[te.panelId] = ne[te.panelId]);
          }
        }
      });
      const Ce = bt().state !== "active";
      m(ue), Ce && y(ue, ae.isUserInteraction);
    });
    return () => {
      N.current = null, x(), Z();
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
  }), /* @__PURE__ */ h(Xa.Provider, { value: F, children: /* @__PURE__ */ h(
    "div",
    {
      ...p,
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
Za.displayName = "Group";
function gr() {
  const e = Qn(Xa);
  return ie(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function jf(e, t) {
  const { id: n } = gr(), r = M({
    collapse: Ln,
    expand: Ln,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Ln
  });
  er(t, () => r.current, []), It(() => {
    Object.assign(
      r.current,
      Ja({ groupId: n, panelId: e })
    );
  });
}
function Gn({
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
  style: p,
  ...g
}) {
  const m = !!l, y = mr(l), w = pr({
    disabled: a
  }), S = M(null), b = hr(S, s), {
    getPanelStyles: v,
    id: k,
    orientation: P,
    registerPanel: L,
    updatePanelProps: z
  } = gr(), F = f !== null, N = Kt(
    (_, x, H) => {
      f == null || f(_, l, H);
    }
  );
  It(() => {
    const _ = S.current;
    if (_ !== null) {
      const x = {
        element: _,
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
      return L(x);
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
    L,
    w
  ]), D(() => {
    z(y, { disabled: a });
  }, [a, y, z]), jf(y, d);
  const I = () => {
    const _ = v(k, y);
    if (_)
      return JSON.stringify(_);
  }, R = Bo(
    (_) => dr(k, _),
    I,
    I
  );
  let E;
  return R ? E = JSON.parse(R) : o !== void 0 ? E = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : E = { flexGrow: 1 }, /* @__PURE__ */ h(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...Hf,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...E
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
            ...p,
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
Gn.displayName = "Panel";
const Hf = {
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
function Uf({
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
    a = vt({
      layout: Gt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = vt({
      layout: Gt({
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
function Ya({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = mr(a), c = pr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = T({}), [d, p] = T("inactive"), [g, m] = T(!1), y = M(null), w = hr(y, o), {
    disableCursor: S,
    id: b,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: P
  } = gr(), L = v === "horizontal" ? "vertical" : "horizontal";
  It(() => {
    const N = y.current;
    if (N !== null) {
      const I = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: N,
        id: l
      }, R = k(I), E = wf(
        (x) => {
          p(
            x.next.state !== "inactive" && x.next.hitRegions.some(
              (H) => H.separator === I
            ) ? x.next.state : "inactive"
          );
        }
      ), _ = dr(
        b,
        (x) => {
          const { derivedPanelConstraints: H, layout: $, separatorToPanels: G } = x.next, Z = G.get(I);
          if (Z) {
            const ae = Z[0], se = Z.indexOf(ae);
            f(
              Uf({
                layout: $,
                panelConstraints: H,
                panelId: ae.id,
                panelIndex: se
              })
            );
          }
        }
      );
      return () => {
        E(), _(), R();
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
  return /* @__PURE__ */ h(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": L,
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
Ya.displayName = "Separator";
const br = 30, yr = 65, Xt = 50, Wf = 100 - yr, Kf = 100 - br;
function Vf(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(yr, Math.max(br, t)) : Xt;
}
function vr(e) {
  return 100 - e;
}
function Pt(e) {
  return `${e}%`;
}
const wr = "reader-document", Zt = "reader-assistant", Qa = "retainpdf.reader.ai-split-layout.v1", Jf = {
  [wr]: vr(Xt),
  [Zt]: Xt
};
function Sr(e) {
  const t = Vf(e == null ? void 0 : e[Zt]);
  return {
    [wr]: vr(t),
    [Zt]: t
  };
}
function qf() {
  try {
    const e = JSON.parse(localStorage.getItem(Qa) || "null");
    return Sr(e);
  } catch {
    return Jf;
  }
}
function Gf(e) {
  try {
    localStorage.setItem(Qa, JSON.stringify(Sr(e)));
  } catch {
  }
}
function _n(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Sr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Zt]}vw`
  );
}
function Xf() {
  const e = M(null), [t] = T(qf);
  Pe(() => {
    const o = e.current;
    return _n(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = C((o) => {
    _n(e.current, o);
  }, []), r = C((o, a) => {
    _n(e.current, o), a.isUserInteraction && Gf(o);
  }, []);
  return /* @__PURE__ */ A(
    Za,
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
          Gn,
          {
            id: wr,
            defaultSize: Pt(vr(Xt)),
            minSize: Pt(Wf),
            maxSize: Pt(Kf)
          }
        ),
        /* @__PURE__ */ h(
          Ya,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ h("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ h(
          Gn,
          {
            id: Zt,
            defaultSize: Pt(Xt),
            minSize: Pt(br),
            maxSize: Pt(yr)
          }
        )
      ]
    }
  );
}
function Zf({
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
  return /* @__PURE__ */ A("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ A("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ h(X, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function Yf({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ h(Zf, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ A(wt, { children: [
    e ? /* @__PURE__ */ h("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ A("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ h("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ h("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ h(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ A("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ h("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ h(X, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Qf(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function em() {
  const [e, t] = T(!1), n = jo(), r = M(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Qf(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ A("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ h(Cs, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ A(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ A("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ h("div", { className: "reader-react-shortcuts-body", children: Sc.map((o) => /* @__PURE__ */ A("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ h("h3", { children: o.title }),
            /* @__PURE__ */ h("ul", { children: o.items.map((a) => /* @__PURE__ */ A("li", { children: [
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
const tm = ["source", "sideBySide", "translated"], nm = { source: "", translated: "", sideBySide: "" };
function rm(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = ln(e.sourceUrl), n = ln(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return mi({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function om(e) {
  const [t, n] = T(() => /* @__PURE__ */ new Set()), r = J(
    () => e ? rm(e) : nm,
    [e]
  ), o = J(
    () => tm.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = C(async (s) => {
    if (!e) return;
    const i = ln(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? fi(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await hi(
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
        pi(c), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const am = {
  source: Vo,
  sideBySide: Jo,
  translated: qo
}, sm = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function im(e) {
  const t = rt(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = om(n), i = M(null);
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
  }, []), /* @__PURE__ */ A("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ A("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ h(zs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ h("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ h(Ko, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ h("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = ms[l], u = ln(r[l]), f = a.has(l), d = !!u && !f, p = d ? "" : hs(l, r), g = am[l];
      return /* @__PURE__ */ A(
        "button",
        {
          type: "button",
          id: `reader-download-${l}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !d,
          "aria-label": d ? `下载${c.label}` : p,
          onClick: () => {
            i.current && (i.current.open = !1), s(l);
          },
          children: [
            /* @__PURE__ */ h(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ A("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ A("span", { className: "reader-download-action-label", children: [
                sm[l],
                " PDF"
              ] }),
              p ? /* @__PURE__ */ h("span", { className: "reader-download-action-reason", children: p }) : null
            ] })
          ]
        },
        l
      );
    }) })
  ] });
}
const lm = "retainpdf:reader:bookmarks:v1:", cm = 200;
function kr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function es(e) {
  const t = `${e || ""}`.trim();
  return t ? `${lm}${t}` : "";
}
function um(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function gn(e, t = kr()) {
  const n = es(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = um(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Xn(e, t, n) {
  const r = es(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, cm);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function dm(e, t, n = "", { storage: r = kr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = gn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Xn(e, a.filter((i) => i.page !== s), r) : Xn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function fm(e, t, n = kr()) {
  return Xn(e, gn(e, n).filter((r) => r.page !== t), n);
}
function mm(e, t) {
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
function hm({ filled: e }) {
  return /* @__PURE__ */ h("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ h("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function pm({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = T(() => gn(e)), [i, l] = T(!1), c = M(null);
  if (D(() => {
    s(gn(e)), l(!1);
  }, [e]), D(() => {
    if (!i) return;
    const d = (g) => {
      c.current && !c.current.contains(g.target) && l(!1);
    }, p = (g) => {
      g.key === "Escape" && l(!1);
    };
    return document.addEventListener("pointerdown", d), document.addEventListener("keydown", p), () => {
      document.removeEventListener("pointerdown", d), document.removeEventListener("keydown", p);
    };
  }, [i]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), f = a.some((d) => d.page === u);
  return /* @__PURE__ */ A("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: c, children: [
    /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(dm(e, u, mm(r, u))),
        children: /* @__PURE__ */ h(hm, { filled: f })
      }
    ),
    a.length ? /* @__PURE__ */ A(
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
          /* @__PURE__ */ h(Os, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ h("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ h("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ h("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ A("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ A(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), l(!1);
          },
          children: [
            /* @__PURE__ */ A("span", { className: "reader-bookmark-page", children: [
              "第 ",
              d.page,
              " 页"
            ] }),
            d.label ? /* @__PURE__ */ h("span", { className: "reader-bookmark-label", children: d.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ h(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${d.page} 页的书签`,
          onClick: () => s(fm(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function gm(e) {
  const [t, n] = T([]);
  return D(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = nt().loadIssues;
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
function bm(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const ym = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, vm = ["failed", "content", "layout"];
function wm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Sm({ jobId: e, currentPage: t }) {
  var f;
  const n = gm(e), r = (f = rt()) == null ? void 0 : f.jumpToBlock, [o, a] = T(!1), [s, i] = T(-1), l = M(null);
  D(() => i(-1), [n]);
  const c = (d) => {
    const p = n[d];
    !p || !r || (i(d), r(p.readerItemId));
  }, u = M({ issues: n, last: s, currentPage: t, goTo: c });
  return u.current = { issues: n, last: s, currentPage: t, goTo: c }, D(() => {
    const d = (p) => {
      if (p.key.toLowerCase() !== "n" || p.metaKey || p.ctrlKey || p.altKey || wm(p.target)) return;
      const { issues: g, last: m, currentPage: y, goTo: w } = u.current, S = bm(g, m, y, p.shiftKey);
      S < 0 || (p.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), D(() => {
    if (!o) return;
    const d = (p) => {
      var g;
      (g = l.current) != null && g.contains(p.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ A("div", { className: "reader-react-hud-group reader-issues", ref: l, "aria-label": "待处理", children: [
    /* @__PURE__ */ A(
      X,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ h($s, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ h("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ A("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ h("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      vm.map((d) => {
        const p = n.map((g, m) => ({ issue: g, index: m })).filter(({ issue: g }) => g.kind === d);
        return p.length ? /* @__PURE__ */ A("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ A("h4", { children: [
            ym[d],
            /* @__PURE__ */ h("span", { children: p.length })
          ] }),
          /* @__PURE__ */ h("ol", { children: p.map(({ issue: g, index: m }) => /* @__PURE__ */ h("li", { children: /* @__PURE__ */ A(
            X,
            {
              className: "reader-issues-item",
              "aria-current": m === s ? "true" : void 0,
              onClick: () => {
                c(m), a(!1);
              },
              children: [
                /* @__PURE__ */ h("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ A("span", { className: "reader-issues-page", children: [
                  "第 ",
                  g.page,
                  " 页"
                ] }),
                g.detail ? /* @__PURE__ */ h("span", { className: "reader-issues-detail", children: g.detail }) : null
              ]
            }
          ) }, `${g.kind}:${g.readerItemId}`)) })
        ] }, d) : null;
      })
    ] }) : null
  ] }) : null;
}
const km = 48, Im = 96, Rm = 700;
function Em(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= km, downSoFar: r };
}
function Pm(e) {
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
      const p = d.target;
      if (!(p instanceof Element) || (i.has(p) || i.set(p, !!p.querySelector(`[${Ee}]`)), !i.get(p))) return;
      const g = p.scrollTop, m = o.get(p);
      if (o.set(p, g), m === void 0 || Date.now() - a > Rm) return;
      const y = Em(!1, r.current, g - m);
      r.current = y.downSoFar, g - m < -4 ? n(!1) : y.hidden && !l() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - Im && (r.current = 0, n(!1));
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
function Tm(e) {
  const t = rt(), n = _a(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Qt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = nl(a), f = a > ra + 1e-3, d = a < hn - 1e-3, p = Mt(r, ct()), g = p >= hn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", m = M(null), y = Pm(m), [w, S] = T(!1), [b, v] = T(`${i}`);
  D(() => {
    w || v(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, w]);
  const k = () => {
    if (S(!1), !c || l <= 0)
      return;
    const P = Number(`${b}`.trim());
    c(pn(P, l));
  };
  return /* @__PURE__ */ A("div", { ref: m, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ h("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ h("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ A(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (P) => {
          P.preventDefault(), k();
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
              value: b,
              autoFocus: !0,
              onChange: (P) => v(P.target.value.replace(/[^\d]/g, "")),
              onBlur: k,
              onKeyDown: (P) => {
                P.key === "Escape" && (P.preventDefault(), S(!1), v(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ A("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            l || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ h(
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
    e.searchSlot ? /* @__PURE__ */ h("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ h(
      pm,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ h(Sm, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ h("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ h(
      X,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ h(Mm, {})
      }
    ) }) : null,
    /* @__PURE__ */ A("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ h(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(qt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ A(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${u}%，点击${g}`,
          title: g,
          onClick: () => s(p),
          children: [
            u,
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
          disabled: !d,
          onClick: () => s(qt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ h("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ h(em, {}) })
  ] });
}
function Mm() {
  return /* @__PURE__ */ A("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ h("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ h("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function _o(e) {
  var t, n;
  return ca(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Nm(e) {
  const [t, n] = T(() => ({
    scope: e,
    panel: _o(Ke(e))
  }));
  D(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: _o(Ke(e))
    });
  }, [e]), D(() => {
    t.scope === e && vn(t.scope, {
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
const Zn = "download-toast";
function Am({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ A("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ A("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ h("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ h("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ h("div", { className: "download-toast-track", children: /* @__PURE__ */ h("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ h("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Lm(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Cn.dismiss(Zn);
    return;
  }
  Cn.custom(
    () => /* @__PURE__ */ h(Am, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Zn, duration: 1 / 0 }
  );
}
function _m() {
  const e = C((t) => {
    t && (t.setState = Lm, t.hide = () => Cn.dismiss(Zn));
  }, []);
  return /* @__PURE__ */ A(wt, { children: [
    /* @__PURE__ */ h(Ys, { position: "bottom-right" }),
    /* @__PURE__ */ h("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function xm(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : aa(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Dm(e, t) {
  return t === null || e !== t;
}
function Cm(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
function zm(e, t) {
  const n = e === t;
  return { open: n, mounted: Cm(n) };
}
const xo = { itemId: null, origin: null };
function Om() {
  let e = xo;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? xo : { itemId: n, origin: r };
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
function $m({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = J(() => wa(e, t), [e, t]), [o, a] = T(() => /* @__PURE__ */ new Set([...Gr(r), ...r ? [r] : []]));
  D(() => {
    a(/* @__PURE__ */ new Set([...Gr(r), ...r ? [r] : []]));
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
    return /* @__PURE__ */ A("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ A("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ h(
          X,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ h(Go, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ h("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ A(
          X,
          {
            className: "reader-finder-entry reader-bookmark-entry",
            "data-level": u.level,
            "aria-current": u.id === r ? "location" : void 0,
            disabled: u.page === null,
            title: u.page === null ? "这条书签没有指到页" : `${u.title} · 第 ${u.page} 页`,
            onClick: () => u.page !== null && n(u.page),
            children: [
              /* @__PURE__ */ h("span", { className: "reader-finder-entry-text", children: u.title }),
              u.page !== null ? /* @__PURE__ */ h("span", { className: "reader-finder-entry-page", children: u.page }) : null
            ]
          }
        )
      ] }),
      d && f ? /* @__PURE__ */ h("ol", { className: "reader-bookmark-children", children: l(u.children) }) : null
    ] }, u.id);
  });
  return /* @__PURE__ */ h("ol", { ref: s, className: "reader-finder-list reader-bookmark-tree", "aria-label": "书签", children: l(e) });
}
const Fm = [], Bm = [];
function jm({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ A("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ h(X, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ h(Fs, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Hm({ open: e, onToggle: t }) {
  return /* @__PURE__ */ h(
    X,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ h(Bs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Um({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: l = Bm,
  onJumpPage: c
}) {
  var N, I;
  const u = ((N = rt()) == null ? void 0 : N.regions) ?? Fm, f = ((I = _a()) == null ? void 0 : I.currentPage) ?? 1, d = J(() => Jc(u), [u]), p = l.length > 0 && !!c, [g, m] = T("bookmarks"), y = p && (g === "bookmarks" || !d.length), w = qc(d, f), S = J(() => Zc(u, s), [u, s]), [b, v] = T(-1);
  D(() => v(-1), [s]);
  const k = M(null), P = M(null), L = M(n);
  L.current = n, D(() => {
    const R = (_) => {
      var H, $;
      const x = _.target;
      !x || (H = P.current) != null && H.contains(x) || ($ = x.closest) != null && $.call(x, ".reader-finder-toggles, [data-finder-toggle]") || L.current();
    }, E = (_) => {
      _.key === "Escape" && L.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", E), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", E);
    };
  }, []);
  const z = M(null);
  D(() => {
    var R, E, _;
    e === "search" ? (R = k.current) == null || R.focus() : (_ = (E = z.current) == null ? void 0 : E.querySelector('[aria-current="location"]')) == null || _.scrollIntoView({ block: "center" });
  }, [e, i]), D(() => {
    var R, E;
    e === "search" && b >= 0 && ((E = (R = z.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null || E.scrollIntoView({ block: "nearest" }));
  }, [e, b]);
  const F = (R) => {
    const E = S[R];
    E && (v(R), r(E.itemId));
  };
  return /* @__PURE__ */ A("aside", { ref: P, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ A("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ A("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ h(X, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ h(X, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ h(X, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ h(St, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && p && d.length ? /* @__PURE__ */ A("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ h(X, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => m("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ h(X, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => m("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && c ? /* @__PURE__ */ h($m, { nodes: l, currentPage: f, onJumpPage: c }) : e === "outline" ? d.length ? /* @__PURE__ */ h("ol", { ref: z, className: "reader-finder-list", children: d.map((R, E) => /* @__PURE__ */ h("li", { children: /* @__PURE__ */ A(
      X,
      {
        className: "reader-finder-entry",
        "data-level": R.level,
        "aria-current": E === w ? "location" : void 0,
        onClick: () => r(R.itemId),
        children: [
          /* @__PURE__ */ h("span", { className: "reader-finder-entry-text", children: R.text }),
          /* @__PURE__ */ h("span", { className: "reader-finder-entry-page", children: R.page })
        ]
      }
    ) }, R.itemId)) }) : /* @__PURE__ */ h("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ A(wt, { children: [
      /* @__PURE__ */ A("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ h(
          Xo,
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
              R.key === "Enter" ? (R.preventDefault(), F(Yc(b, S.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ h("p", { className: "reader-finder-count", "aria-live": "polite", children: S.length === 0 ? "没有找到" : `${b >= 0 ? `第 ${b + 1} / ` : ""}${S.length >= 200 ? "200+ 处，只列前 200 处" : `${S.length} 处`}${b < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ h("ol", { className: "reader-finder-list", children: S.map((R, E) => /* @__PURE__ */ h("li", { children: /* @__PURE__ */ A(X, { className: "reader-finder-entry is-hit", "aria-current": E === b ? "true" : void 0, onClick: () => F(E), children: [
        /* @__PURE__ */ A("span", { className: "reader-finder-entry-text", children: [
          R.snippet.slice(0, R.at),
          /* @__PURE__ */ h("mark", { children: R.snippet.slice(R.at, R.at + R.length) }),
          R.snippet.slice(R.at + R.length)
        ] }),
        /* @__PURE__ */ h("span", { className: "reader-finder-entry-page", children: R.page })
      ] }) }, R.itemId)) })
    ] })
  ] });
}
function Wm({ active: e, compare: t, ink: n }) {
  const [r, o] = T(!1), [a, s] = T(!1), i = M(null);
  D(() => {
    if (!r && !a) return;
    const c = () => {
      o(!1), s(!1);
    }, u = (d) => {
      var p;
      (p = i.current) != null && p.contains(d.target) || c();
    }, f = (d) => {
      d.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", u, !0), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", u, !0), document.removeEventListener("keydown", f);
    };
  }, [r, a]);
  const l = !!(t.compared || t.loading);
  return /* @__PURE__ */ A("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ h(Jd, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ A("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ h(
        X,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ h(tr, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ h(cf, { active: e }),
      t.available ? /* @__PURE__ */ h(
        X,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ h(js, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ h(
      X,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || l ? "true" : void 0,
        onClick: () => {
          o((c) => !c), s(!1);
        },
        children: r ? /* @__PURE__ */ h(St, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ h(Hs, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Km = [
  { tool: "pen", label: "画笔", Icon: tr },
  { tool: "highlighter", label: "荧光笔", Icon: Us },
  { tool: "eraser", label: "橡皮", Icon: Ws }
];
function ts(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function ns({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ A(wt, { children: [
    Km.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ h(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": a,
        title: a,
        "aria-pressed": e.tool === o,
        "data-ink-tool": o,
        onClick: () => {
          e.setTool(e.tool === o ? null : o), r();
        },
        children: /* @__PURE__ */ h(s, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      },
      o
    )),
    /* @__PURE__ */ h("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    Ta.map((o) => /* @__PURE__ */ h(
      X,
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
        children: /* @__PURE__ */ h("span", { "aria-hidden": !0 })
      },
      o.key
    )),
    /* @__PURE__ */ h("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ h(X, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ h(Ks, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ h(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ h(Vs, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ h(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ h(St, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Vm({
  ink: e,
  menu: t,
  onClose: n,
  actions: r = []
}) {
  const o = M(null);
  if (D(() => {
    if (!t) return;
    const l = (u) => {
      var f;
      (f = o.current) != null && f.contains(u.target) || n();
    }, c = (u) => {
      u.key === "Escape" && n();
    };
    return document.addEventListener("pointerdown", l, !0), document.addEventListener("keydown", c), () => {
      document.removeEventListener("pointerdown", l, !0), document.removeEventListener("keydown", c);
    };
  }, [t, n]), !t) return null;
  const a = 380, s = Math.max(8, Math.min(t.x, (globalThis.innerWidth || a) - a - 8)), i = Math.max(68, Math.min(t.y, (globalThis.innerHeight || 600) - 60 - (r.length ? 40 : 0)));
  return /* @__PURE__ */ A("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    r.length ? /* @__PURE__ */ h("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: r.map((l) => /* @__PURE__ */ A(
      X,
      {
        className: "reader-ink-menu-action",
        role: "menuitem",
        title: l.hint,
        onClick: () => {
          l.onSelect(), n();
        },
        children: [
          l.label,
          l.hint ? /* @__PURE__ */ h("kbd", { children: l.hint }) : null
        ]
      },
      l.key
    )) }) : null,
    /* @__PURE__ */ h("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ h(ns, { ink: e, page: t.page, onPick: n }) })
  ] });
}
function Jm({ ink: e }) {
  return e.tool ? /* @__PURE__ */ h("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ h(ns, { ink: e }) }) : null;
}
function qm(e) {
  var r;
  if (e.shiftKey || ts(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${ta}`))) return null;
  const n = Number((r = t.closest(`[${Ee}]`)) == null ? void 0 : r.getAttribute(Ee)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Gm(e) {
  const t = M(e);
  t.current = e, D(() => {
    const n = (r) => {
      if (ts(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function xn() {
  try {
    return nt().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Xm(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Zm(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Ym(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Qm({ documentId: e, jobId: t }) {
  const [n, r] = T([]), [o, a] = T(null), [s, i] = T(null), [l, c] = T(""), [u, f] = T(""), d = M(0);
  D(() => {
    r([]), i(null), f("");
    const y = xn();
    if (!y || !e) return;
    let w = !1;
    return y.list(e).then((S) => {
      w || (r(S.versions), a(S.currentVersionId));
    }).catch(() => {
    }), () => {
      w = !0;
    };
  }, [e, t]);
  const p = C((y) => {
    const w = xn(), S = n.find((v) => v.versionId === y);
    if (!w || !S || !e) return;
    const b = ++d.current;
    c(y), f(""), (async () => {
      const v = nt(), k = await w.resolveJob(e, y);
      if (!k) throw new Error("这一份还没有能读的译文。");
      const P = await v.loadReaderPayload(k, { includeOptionalArtifacts: !0 }), L = v.resolveReaderTranslatedPdfUrl(P.jobPayload, P.manifestPayload);
      if (!L) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: k, url: L, regions: Xm(Uo(P.regionsPayload)) };
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
    const y = xn();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (v) {
      f((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (S = globalThis.location) == null ? void 0 : S.href;
    w && ((b = globalThis.history) == null || b.replaceState(globalThis.history.state, "", Ym(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Zm(n, t, o),
    compared: s,
    loading: l,
    error: u,
    choose: p,
    clear: g,
    adopt: m
  };
}
const eh = "reader-finder-input";
function th(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function nh(e, t = typeof window > "u" ? null : window) {
  D(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!th(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(eh) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function rh() {
  try {
    return nt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const oh = "这本书正在处理（翻译或排版），处理完才能改。", ah = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function sh({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = rh(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = du(s), c = !t || Vt(t), u = bu(n), [f, d] = T(""), [p, g] = T(null), [m, y] = T(() => /* @__PURE__ */ new Map()), [w, S] = T(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = T(() => /* @__PURE__ */ new Map()), [k, P] = T({ phase: "idle" }), L = M({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  D(() => {
    g(null), L.drafts.clear(), L.generation.current = null, v(/* @__PURE__ */ new Map()), P({ phase: "idle" });
  }, [s]), D(() => {
    if (d(""), !i || l || !a) return;
    let x = !1;
    return a.resolveOwnerJobId(s).then((H) => {
      x || d(`${H || s}`.trim() || s);
    }).catch(() => {
      x || d(s);
    }), () => {
      x = !0;
    };
  }, [i, l, a, s]), D(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !c) return;
    let x = !1;
    return a.fetchRevisions(f).then((H) => {
      x || y(yu(H, u));
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
  const F = J(() => {
    const x = new Map(m);
    if (w.renderedAt === u)
      for (const [H, $] of w.edits) x.set(H, $);
    return x;
  }, [m, w, u]), N = C((x) => {
    const H = `${x || ""}`.trim();
    H && g({ itemId: H, page: fu(H) });
  }, []), I = C(() => g(null), []), R = C((x, H) => {
    S(($) => {
      const G = new Map($.renderedAt === u ? $.edits : []);
      return G.set(x, H), { renderedAt: u, edits: G };
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
  }, [a, s, k.phase, o]), _ = l ? ah : !c || k.phase === "running" || k.phase === "submitting" ? oh : "";
  return J(() => ({
    available: i,
    blockedReason: _,
    port: a,
    ownerJobId: f,
    target: p,
    select: N,
    close: I,
    memory: L,
    pendingEdits: F,
    savedCounts: b,
    markSaved: R,
    rerender: k,
    startRerender: E
  }), [i, _, a, f, p, N, I, L, F, b, R, k, E]);
}
function ih(e, t) {
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
function lh({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ h("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ A("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ h("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ h(
      X,
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
const rs = "retainpdf:reader:doc-theme:v1", Do = "data-reader-doc";
function os() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ch(e = os()) {
  try {
    return (e == null ? void 0 : e.getItem(rs)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function uh(e, t = os()) {
  try {
    t == null || t.setItem(rs, e);
  } catch {
  }
}
function Co(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Do, "dark") : t.removeAttribute(Do));
}
function dh() {
  const [e, t] = T(() => ch());
  D(() => {
    Co(e);
  }, [e]), D(() => () => Co("light"), []);
  const n = C(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return uh(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const zo = 6e3;
function as(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function fh(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > zo && (s *= zo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function ss({
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
        const p = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), m = fh(n, p, r, g), y = s.current, w = y == null ? void 0 : y.getContext("2d");
        if (!y || !w) return;
        y.width = m.canvasWidth, y.height = m.canvasHeight, l({ status: "loading", cssHeight: m.cssHeight });
        const S = d.getViewport({ scale: m.scale, offsetX: m.offsetX, offsetY: m.offsetY }), b = d.render({ canvasContext: w, viewport: S });
        f = b, await b.promise, u || l({ status: "ready", cssHeight: m.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && l((p) => ({ status: "error", cssHeight: p.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, c]), /* @__PURE__ */ A(
    "div",
    {
      className: `reader-region-canvas${o ? ` ${o}` : ""}`,
      "data-status": i.status,
      style: { width: r, height: i.cssHeight || void 0 },
      children: [
        /* @__PURE__ */ h("canvas", { ref: s, role: "img", "aria-label": a ?? `第 ${t} 页的一块`, style: { width: r, height: i.cssHeight || void 0 } }),
        i.status === "error" ? /* @__PURE__ */ h("p", { className: "reader-region-canvas-error", children: "这一块没画出来。" }) : null
      ]
    }
  );
}
const Oo = { figure: "图", table: "表", formula: "公式", text: "文字" }, at = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function mh(e, t, n) {
  const r = cn(e, t, n), o = r ? Yt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = as({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function hh(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, l = null;
  for (const u of e) {
    const f = cn(u, t, n), d = f ? Yt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, l = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !l) return null;
  const c = as({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: c, aspect: c.height * l.height / Math.max(1e-6, c.width * l.width) };
}
function ph(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function gh(e, t) {
  const n = (o) => {
    const a = De(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function bh({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var F;
  const i = t.find((N) => N.itemId === e) ?? null, l = J(() => i ? gh(t, i) : [], [t, i]), c = i ? l.indexOf(i) : -1, [u, f] = T(at.indexOf(1)), d = at[u], p = M(null), [g, m] = T(0);
  Pe(() => {
    const N = p.current;
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
        I.preventDefault(), f((R) => Math.min(at.length - 1, R + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), f((R) => Math.max(0, R - 1));
      else if (I.key === "0")
        I.preventDefault(), f(at.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", N, !0), () => window.removeEventListener("keydown", N, !0);
  }, [s, y]), D(() => {
    const N = p.current;
    if (!N) return;
    const I = (R) => {
      !R.ctrlKey && !R.metaKey || (R.preventDefault(), f((E) => Math.max(0, Math.min(at.length - 1, E + (R.deltaY < 0 ? 1 : -1)))));
    };
    return N.addEventListener("wheel", I, { passive: !1 }), () => N.removeEventListener("wheel", I);
  }, []);
  const w = M(null);
  if (!i) return null;
  const S = De(i), b = o.map((N) => ({ pane: N, pdf: r[N] ?? null, where: mh(i, n, N) })).filter((N) => !!(N.pdf && N.where)), v = 16, k = typeof window > "u" ? 800 : window.innerHeight, P = Math.min(880, k * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), L = b.length ? ph(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), P, b.map((N) => N.where.aspect)) : 0, z = ((F = b[0]) == null ? void 0 : F.where.page) ?? i.source.page;
  return /* @__PURE__ */ A("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${Oo[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ h("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ A("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ A("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ A("span", { className: "reader-zoom-title", children: [
          Oo[S] ?? "这一块",
          " · 第 ",
          z,
          " 页"
        ] }),
        /* @__PURE__ */ h("span", { className: "reader-zoom-count", children: c >= 0 ? `${c + 1} / ${l.length}` : "" }),
        /* @__PURE__ */ A("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ h(pt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: c <= 0, onClick: () => y(-1), children: /* @__PURE__ */ h(Js, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ h(pt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: c < 0 || c >= l.length - 1, onClick: () => y(1), children: /* @__PURE__ */ h(Go, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ h(pt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((N) => Math.max(0, N - 1)), children: /* @__PURE__ */ h(qs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ A(X, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(at.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ h(pt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === at.length - 1, onClick: () => f((N) => Math.min(at.length - 1, N + 1)), children: /* @__PURE__ */ h(Gs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ h(pt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ h(St, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ h(
        "div",
        {
          ref: p,
          className: "reader-zoom-body",
          onPointerDown: (N) => {
            const I = p.current;
            !I || N.button !== 0 || (w.current = { x: N.clientX, y: N.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(N.pointerId));
          },
          onPointerMove: (N) => {
            const I = p.current, R = w.current;
            !I || !R || (I.scrollLeft = R.left - (N.clientX - R.x), I.scrollTop = R.top - (N.clientY - R.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ h("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: N, pdf: I, where: R }) => /* @__PURE__ */ A("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ h("figcaption", { children: N === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ h(
              ss,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: R.page,
                region: R.fraction,
                cssWidth: L * d,
                label: `${N === "source" ? "原文" : "译文"}第 ${R.page} 页`
              }
            )
          ] }, N)) }) : /* @__PURE__ */ h("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const yh = 380, vh = 320, Tt = 8;
function wh(e, t, n) {
  const r = Math.max(Tt, Math.min(e.left, n.width - t.width - Tt)), o = e.bottom + Tt, a = o + t.height <= n.height - Tt ? o : Math.max(Tt, e.top - Tt - t.height);
  return { left: r, top: a };
}
function Sh({
  preview: e,
  regions: t,
  metadata: n,
  documents: r
}) {
  const o = e.target.itemIds.map((d) => t.find((p) => p.itemId === d)).filter((d) => !!d);
  if (!o.length) return null;
  const a = e.pane === "source" ? ["source", "translated"] : ["translated", "source"];
  let s = null;
  for (const d of a) {
    const p = r[d], g = p ? hh(o, n, d) : null;
    if (p && g) {
      s = { pdf: p, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(yh, vh / Math.max(0.05, s.where.aspect))), l = Math.round(i * s.where.aspect) + 30, c = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = wh(e.anchor, { width: Math.max(i, 160) + 16, height: l + 16 }, c);
  return /* @__PURE__ */ A("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ A("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ h("span", { children: Qr(e.target) }),
      /* @__PURE__ */ A("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ h(ss, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Qr(e.target) })
  ] });
}
const kh = 4e3;
function Ih(e, t, n) {
  if (e.length) {
    const o = wa(e, n), a = o ? va(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function $o(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ee}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, kh), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function Rh({
  pageElement: e,
  clientX: t,
  clientY: n,
  itemId: r,
  selection: o,
  regions: a,
  bookmarks: s
}) {
  if (!e) return null;
  const i = Number(e.getAttribute(Ee)) || 0;
  if (i < 1) return null;
  const l = e.getAttribute(Ie) === "source" ? "source" : "translated", c = e.getBoundingClientRect(), u = c.width > 0 && c.height > 0 ? { x: Math.min(1, Math.max(0, (t - c.left) / c.width)), y: Math.min(1, Math.max(0, (n - c.top) / c.height)) } : null, f = r ? a.find((d) => d.itemId === r) ?? null : null;
  return {
    pane: l,
    page: i,
    itemId: (f == null ? void 0 : f.itemId) ?? null,
    selection: o,
    sourceText: `${(f == null ? void 0 : f.source.text) || (f == null ? void 0 : f.markdown) || ""}`.trim(),
    translatedText: `${(f == null ? void 0 : f.translatedBlockText) || (f == null ? void 0 : f.translated.text) || ""}`.trim(),
    section: Ih(s, a, (f == null ? void 0 : f.source.page) ?? i),
    point: u
  };
}
const Eh = 250;
function Ph(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Th(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Mh(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Nh({
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
    const { shellEl: p, primaryPane: g } = u.current;
    return Wt(p, g);
  }, []);
  D(() => {
    if (!e) return;
    const p = (b) => {
      var v, k;
      return (k = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${Sa}`);
    }, g = () => {
      c.current != null && window.clearTimeout(c.current), c.current = null;
    }, m = (b) => {
      var L;
      const v = p(b);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(Un) || "");
      if (!k) return;
      const P = ((L = v.closest("[data-reader-pane]")) == null ? void 0 : L.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), c.current = window.setTimeout(() => {
        const z = v.getBoundingClientRect();
        a({ target: k, pane: P, anchor: { left: z.left, top: z.top, right: z.right, bottom: z.bottom } });
      }, Eh);
    }, y = (b) => {
      const v = p(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, w = (b) => {
      var z, F;
      const v = p(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((z = window.getSelection) == null ? void 0 : z.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(Un) || "");
      if (!k) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const P = ((F = v.closest("[data-reader-pane]")) == null ? void 0 : F.getAttribute("data-reader-pane")) || u.current.primaryPane, L = f();
      L && i((N) => Ph(N, L)), u.current.follow(k, P);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", m), e.addEventListener("pointerout", y), e.addEventListener("click", w, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", m), e.removeEventListener("pointerout", y), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = C((p) => {
    const g = f();
    if (!g) return !1;
    const m = Th(l.current, g, p);
    if (!m) return !1;
    const { shellEl: y, primaryPane: w } = u.current;
    return _t(y, m.to, "auto", w) ? (i(m.history), !0) : !1;
  }, [f]);
  return D(() => {
    const p = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Mh(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", p), () => window.removeEventListener("keydown", p);
  }, [d]), {
    preview: o,
    closePreview: C(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: C(() => d("back"), [d])
  };
}
const Ah = Ho(() => import("./ReaderMarkdownPanel-CwMj4dv3.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Lh = Ho(() => import("./ReaderAskWindow-gfvWmiVK.js")), _h = [];
function xh(e) {
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
function Dh(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Ch() {
  var Mr;
  const e = vc(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Nm(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = T(!1), u = M(null), f = M(null), d = s !== null, p = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = xh({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: p,
    liveTranslationVisible: l,
    assistantOpen: d
  }), m = sc({
    hasOverlayContent: p,
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
    S.current !== e.viewStateKey && cc({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: y,
      jobTerminal: e.session.jobTerminal
    }) && (S.current = e.viewStateKey, c(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, y]), D(() => {
    if (!(t.loading || t.failed)) {
      if (u.current !== e.viewStateKey) {
        u.current = e.viewStateKey;
        const B = Ke(e.viewStateKey), U = xm({
          savedMode: B == null ? void 0 : B.mode,
          sourceViewOnly: y,
          viewportWidth: ct()
        });
        f.current = U.auto ? U.mode : null, U.mode && U.mode !== e.mode && e.setModeKeepingPage(U.mode);
        return;
      }
      Dm(e.mode, f.current) && (f.current = null, vn(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const b = s || (e.mode === "compare" ? "compare" : "reading"), v = zm(s, "markdown"), { docDark: k, toggleDocDark: P } = dh();
  Pc({
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
  const L = C(() => {
    i(null);
  }, []), z = ic(e.liveTranslation), F = C(() => {
    z && e.goToPage(z, "source");
  }, [e.goToPage, z]), [N, I] = T(null);
  D(() => {
    w === "compare" && e.session.jobTerminal && I(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, w]);
  const R = N !== e.viewStateKey && uc({
    state: e.liveTranslation,
    sourceViewOnly: y,
    visibleMode: w
  }), E = C((B) => {
    const U = Dh(B, e.liveTranslationAvailable);
    U !== null && c(U), e.setModeKeepingPage(B);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), _ = J(() => m.sourcePaneToggle ? /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${l ? " is-active" : ""}`,
      onClick: () => c((B) => !B),
      "aria-pressed": l,
      title: l ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [m.sourcePaneToggle, l]), x = C((B) => {
    i(B);
  }, []), [H] = T(Om), [$, G] = T(null), Z = C((B) => G((U) => U === B ? null : B), []), [ae, se] = T(""), [ce, ue] = T("");
  D(() => {
    const B = ae.replace(/\s+/gu, " ").trim(), U = window.setTimeout(() => ue(B), B ? 150 : 0);
    return () => window.clearTimeout(U);
  }, [ae]);
  const [le, Ce] = T(0), te = C(() => {
    G("search"), Ce((B) => B + 1);
  }, []);
  nh(te);
  const ne = C((B) => {
    e.jumpToAnchor({ block_id: B }), ($ === "outline" || ct() < 900) && G(null);
  }, [e.jumpToAnchor, $]), fe = C((B) => e.jumpToAnchor({ block_id: B }), [e.jumpToAnchor]), [ve, Se] = T({}), ge = M({ source: r.sourceUrl, translated: r.translatedUrl });
  ge.current = { source: r.sourceUrl, translated: r.translatedUrl };
  const Ve = C((B, U) => {
    Se((he) => ({ ...he, [U]: { url: ge.current[U], nodes: B } }));
  }, []), Je = J(() => {
    const B = ve.source;
    if (B && B.url === r.sourceUrl && B.nodes.length) return B.nodes;
    const U = ve.translated;
    return U && U.url === r.translatedUrl && U.nodes.length ? U.nodes : _h;
  }, [ve, r.sourceUrl, r.translatedUrl]), ze = M({}), [re, de] = T(0), be = C((B, U) => {
    ze.current[U] = { url: ge.current[U], pdf: B }, de((he) => he + 1);
  }, []), [j, q] = T(null), ee = C((B) => q(B), []), Oe = C(() => q(null), []);
  D(() => q(null), [e.viewStateKey]);
  const Te = J(() => {
    const B = (U, he) => {
      const pe = ze.current[U];
      return pe && pe.url === he ? pe.pdf : null;
    };
    return { source: B("source", r.sourceUrl), translated: B("translated", r.translatedUrl) };
  }, [re, r.sourceUrl, r.translatedUrl]), Me = J(() => au(o.regions), [o.regions]), $e = C(
    (B, U) => e.jumpToAnchor({ block_id: B.itemId }, U),
    [e.jumpToAnchor]
  ), Ne = Nh({ shellEl: e.shell.shellEl, index: Me, primaryPane: e.panes.primaryPane, follow: $e }), Fe = C((B) => {
    e.goToPage(B), ($ === "outline" || ct() < 900) && G(null);
  }, [e.goToPage, $]), we = sh({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), Ae = we.select, je = e.setModeKeepingPage, qe = o.regions, He = C((B) => {
    ku(qe, B) && (w === "source" && je("compare"), Ae(B));
  }, [qe, Ae, w, je]);
  ih(we.available ? He : null, H);
  const Le = fd(e.viewStateKey);
  Gm(Le);
  const [ot, ft] = T(null), O = C(() => ft(null), []), K = J(() => {
    try {
      return nt().ask ?? null;
    } catch {
      return null;
    }
  }, []), [V, Y] = T(null), [Q, W] = T(null), [oe, ye] = T([]), Ir = M(0), wn = M(/* @__PURE__ */ new Map()), Sn = C((B) => {
    Ir.current += 1;
    const U = Ir.current;
    W({ anchor: B, key: U }), ye((he) => [...he, { key: U, anchor: B }]);
  }, []), Rr = C((B) => W({ anchor: B.anchor, key: B.key }), []), is = C(() => W(null), []);
  D(() => {
    W(null), ye([]), wn.current.clear();
  }, [e.viewStateKey]);
  const kn = C(
    (B, U, he, pe) => Rh({
      pageElement: (B == null ? void 0 : B.closest(`[${Ee}]`)) ?? null,
      clientX: U,
      clientY: he,
      itemId: H.get().itemId,
      selection: pe,
      regions: o.regions,
      bookmarks: Je
    }),
    [H, o.regions, Je]
  );
  D(() => {
    if (!K) return;
    const B = (U) => {
      var Rt, Nr;
      if (U.key !== "?" || U.metaKey || U.ctrlKey || U.altKey || U.defaultPrevented) return;
      const he = U.target;
      if ((Rt = he == null ? void 0 : he.closest) != null && Rt.call(he, "input, textarea, select, [contenteditable='true']")) return;
      const pe = $o(((Nr = globalThis.getSelection) == null ? void 0 : Nr.call(globalThis)) ?? null);
      if (!pe.text || !pe.element || !pe.rect) return;
      const Ge = kn(pe.element, pe.rect.left + pe.rect.width / 2, pe.rect.top + pe.rect.height / 2, pe.text);
      Ge && (U.preventDefault(), U.stopImmediatePropagation(), Sn(Ge));
    };
    return window.addEventListener("keydown", B, !0), () => window.removeEventListener("keydown", B, !0);
  }, [K, kn, Sn]);
  const mt = Qm({ documentId: o.documentId, jobId: o.jobId }), Er = ((Mr = mt.compared) == null ? void 0 : Mr.url) || "";
  D(() => {
    Er && w !== "compare" && E("compare");
  }, [Er]), D(() => {
    w !== "compare" && mt.clear();
  }, [w]);
  const Pr = J(
    () => {
      const { compared: B, versions: U, readingVersionId: he } = mt;
      if (!B) return null;
      const pe = U.find((Rt) => Rt.versionId === B.versionId), Ge = U.find((Rt) => Rt.versionId === he);
      return {
        url: B.url,
        regions: B.regions,
        left: { name: B.name, createdAt: (pe == null ? void 0 : pe.createdAt) || "" },
        right: { name: (Ge == null ? void 0 : Ge.name) || "当前译文", createdAt: (Ge == null ? void 0 : Ge.createdAt) || "" }
      };
    },
    [mt.compared, mt.versions, mt.readingVersionId]
  ), Tr = J(() => {
    if (!we.savedCounts.size) return e.revisedBlocks;
    const B = new Map(e.revisedBlocks);
    for (const [U, he] of we.savedCounts) B.set(U, (B.get(U) || 0) + he);
    return B;
  }, [e.revisedBlocks, we.savedCounts]), ls = J(() => ({
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
    regionHover: H,
    jumpToBlock: fe,
    revisedBlocks: Tr,
    onPdfOutline: Ve,
    onPdfDocument: be,
    zoomBlock: ee,
    xrefIndex: Me,
    askMarks: oe,
    onAskMark: Rr,
    editBlock: we.available ? He : void 0,
    blockEdit: we,
    editShowsSource: w !== "compare",
    findTerm: $ === "search" ? ce : "",
    compareVersion: Pr,
    ink: Le,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: y,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: x, close: L },
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
    H,
    fe,
    Tr,
    Ve,
    be,
    ee,
    Me,
    oe,
    Rr,
    we,
    He,
    w,
    $,
    ce,
    Pr,
    Le,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    x,
    L,
    k,
    P
  ]), cs = J(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), us = [
    Zi,
    `is-workspace-${b}`,
    d ? "is-assistant-open" : "",
    $ ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ h(vd, { value: ls, hud: cs, children: /* @__PURE__ */ A(
    "div",
    {
      className: us,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": b,
      "data-ink-mode": Le.tool || void 0,
      onContextMenu: (B) => {
        var he;
        const U = qm(B);
        if (U) {
          if (B.preventDefault(), K) {
            const pe = $o(((he = globalThis.getSelection) == null ? void 0 : he.call(globalThis)) ?? null);
            Y(kn(B.target, B.clientX, B.clientY, pe.element ? pe.text : ""));
          }
          ft(U);
        }
      },
      children: [
        /* @__PURE__ */ h(Yf, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ h(jm, { open: $, onToggle: Z }),
        $ ? /* @__PURE__ */ h(
          Um,
          {
            tab: $,
            onTab: G,
            onClose: () => G(null),
            onJump: ne,
            bookmarks: Je,
            onJumpPage: Fe,
            query: ae,
            onQuery: se,
            term: ce,
            focusSignal: le
          }
        ) : null,
        /* @__PURE__ */ A("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ h(im, {}),
          /* @__PURE__ */ h(xc, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ h(
          rf,
          {
            mode: w,
            documentReady: !!o.jobId,
            sourceViewOnly: y,
            onModeChange: E,
            liveTranslation: m.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((B) => !B),
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
        /* @__PURE__ */ h(uf, { active: s }),
        d ? /* @__PURE__ */ h(Xf, {}) : null,
        /* @__PURE__ */ h(Qd, { paneComposition: g, markdownSplit: v.open, assistantSplit: d, liveTranslation: e.liveTranslation, sourcePaneAction: _ }),
        e.showHud ? /* @__PURE__ */ h(
          Tm,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ h(Hm, { open: $, onToggle: Z })
          }
        ) : null,
        /* @__PURE__ */ h(Dr, { fallback: null, children: v.mounted ? /* @__PURE__ */ h(Ah, { open: v.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: L }) : null }),
        Ne.preview ? /* @__PURE__ */ h(Sh, { preview: Ne.preview, regions: o.regions, metadata: o.readerMetadata, documents: Te }) : null,
        Ne.canGoBack ? /* @__PURE__ */ A(X, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => Ne.goBack(), children: [
          /* @__PURE__ */ h(Xs, { size: 14, "aria-hidden": !0 }),
          " 回到第 ",
          Ne.backPage,
          " 页"
        ] }) : null,
        j ? /* @__PURE__ */ h(
          bh,
          {
            itemId: j,
            regions: o.regions,
            metadata: o.readerMetadata,
            documents: Te,
            panes: w === "compare" ? ["source", "translated"] : w === "translated" ? ["translated"] : ["source"],
            onNavigate: q,
            onClose: Oe
          }
        ) : null,
        /* @__PURE__ */ h(Wm, { active: s, compare: mt, ink: Le }),
        /* @__PURE__ */ h(
          Vm,
          {
            ink: Le,
            menu: ot,
            onClose: O,
            actions: K && V ? [{
              key: "ask",
              label: V.selection ? "问这段" : "在这里提问",
              hint: V.selection ? "?" : void 0,
              onSelect: () => Sn(V)
            }] : []
          }
        ),
        K && Q ? /* @__PURE__ */ h(Dr, { fallback: null, children: /* @__PURE__ */ h(
          Lh,
          {
            port: K,
            jobId: o.jobId,
            anchor: Q.anchor,
            onClose: is,
            onShowAnchor: () => e.goToPage(Q.anchor.page, Q.anchor.pane),
            saved: wn.current.get(Q.key),
            onSave: (B) => wn.current.set(Q.key, B)
          },
          Q.key
        ) }) : null,
        /* @__PURE__ */ h(Jm, { ink: Le }),
        /* @__PURE__ */ h(lh, { edit: we }),
        /* @__PURE__ */ h(_m, {})
      ]
    }
  ) });
}
function tp() {
  return /* @__PURE__ */ h(Ch, {});
}
export {
  tp as R,
  Ch as a,
  ep as b,
  Qh as d,
  Zh as f,
  Yh as r,
  rt as u
};
//# sourceMappingURL=ReaderApp-BFHkV63F.js.map
