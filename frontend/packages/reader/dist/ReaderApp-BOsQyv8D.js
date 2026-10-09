var Mn = (e) => {
  throw TypeError(e);
};
var An = (e, t, n) => t.has(e) || Mn("Cannot " + n);
var Qe = (e, t, n) => (An(e, t, "read from private field"), n ? n.call(e) : t.get(e)), _n = (e, t, n) => t.has(e) ? Mn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Ln = (e, t, n, r) => (An(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as U, jsx as P, Fragment as Qt } from "react/jsx-runtime";
import { useMemo as K, useState as k, useEffect as j, useCallback as $, useRef as A, useLayoutEffect as De, memo as en, forwardRef as uo, useImperativeHandle as tn, createContext as nn, useContext as rn, useSyncExternalStore as hr, useId as pr, Suspense as fo, lazy as mo } from "react";
import { requireAdapter as Ze, getReaderAdapters as me, renderReaderBoardSlot as ho } from "./adapters.js";
import { resolveReaderDownloadName as po, resolveReaderDownloadUrls as go, READER_PROGRESS_COPY as Se, trimString as wt, READER_DOWNLOAD_ACTIONS as bo, disabledReason as yo } from "./runtime/state.js";
import "@retainpdf/api/conversations";
import { r as vo, b as So } from "./page-config-Ct7qR5rm.js";
import { isFinishedJobStatus as on } from "@retainpdf/domain/job";
import { c as wo, n as Po, f as kt, j as kn, a as Ro, b as Io, h as gr, p as an, d as To, k as Nn, i as Eo } from "./reader-regions-CXmxla3K.js";
import { isReaderTransportError as Mo, createReaderTransportError as Ao } from "./contracts.js";
import { toast as jt, Toaster as _o } from "sonner";
import { X as br, Radio as Lo, FileText as yr, Columns2 as vr, Languages as Sr, FileCode2 as ko, Sparkles as No, Keyboard as Co, Download as Do, ChevronDown as zo } from "lucide-react";
import { pdfjs as xo, Page as Oo, Document as Fo } from "react-pdf";
import { e as $o, m as jo, a as Uo } from "./markdown-math-XkF5urpn.js";
const Bo = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ho = "", Wo = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Vo = (e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, ll = (...e) => {
  var n;
  return (((n = me()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, we = () => Ze("defaultReaderDataPort"), Cn = () => Ze("defaultReaderPageConfigPort"), ul = {
  get apiPrefix() {
    return we().apiPrefix;
  },
  fetchProtected: (...e) => we().fetchProtected(...e),
  loadMarkdownPayload: (e) => we().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => we().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => we().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => we().loadJobPayload(e),
  loadReaderPayload: (e, t) => we().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => we().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return we().liveTranslation;
  }
}, wr = {
  messageTargetOrigin: () => Cn().messageTargetOrigin(),
  readerJobId: () => Cn().readerJobId()
}, Jo = () => {
  var e;
  return ((e = me()) == null ? void 0 : e.liveTranslation) ?? null;
}, at = () => {
  var t;
  const e = me();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, sn = () => {
  const e = me();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Ze("fetchDocumentByJobId")(...n),
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
}, qo = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Go = () => {
  var e, t;
  return ((t = (e = me()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Ko = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Zo = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? po(...e);
}, Yo = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? go(...e);
}, Xo = (...e) => Ze("downloadProtectedResource")(...e), Qo = (...e) => Ze("failDownloadToast")(...e), dl = (e, t) => Ze("resolveMarkdownAssetUrl")(e, t), ea = "/api/v1";
function ta() {
  const e = () => {
    var r;
    return vo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = k(e);
  return j(() => {
    var l, i, c, u;
    const r = () => n(e()), o = (i = (l = globalThis.history) == null ? void 0 : l.pushState) == null ? void 0 : i.bind(globalThis.history), a = (u = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const d = (m) => function(...f) {
          const h = m.apply(this, f);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), h;
        };
        globalThis.history.pushState = d(o), globalThis.history.replaceState = d(a), s = !0;
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
function na() {
  const e = ta(), t = K(() => Ko(wr), [e]), n = K(() => Go(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function ra(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: l
  } = e, [i, c] = k({
    documentId: "",
    jobId: ""
  }), [u, d] = k({
    documentId: "",
    jobId: ""
  }), m = i.documentId === t ? i.jobId : "", f = u.documentId === t ? u.jobId : "", h = n || m, [p, y] = k({
    jobId: "",
    documentId: ""
  }), b = p.jobId === h ? p.documentId : "", S = t || b, w = !!t && !h, [g, v] = k(null), M = (g == null ? void 0 : g.sessionIdentity) === r && g.documentId === S ? g : null, _ = w || !!M, x = $((N) => {
    const R = `${N.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const T = `${N.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: R,
      revision: T,
      sessionIdentity: o.current
    }), l();
  }, []);
  j(() => {
    v((N) => N && N.sessionIdentity !== r ? null : N);
  }, [r]);
  const D = $((N) => {
    switch (N.type) {
      case "resolved-document-job":
        c({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        d({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "resolved-job-document":
        y((R) => R.jobId === N.jobId && R.documentId === N.documentId ? R : { jobId: N.jobId, documentId: N.documentId });
        break;
      case "committed-source":
        v({
          documentId: N.documentId,
          revision: N.revision,
          sessionIdentity: N.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: i,
    setResolvedDocumentJob: c,
    missingDocumentJob: u,
    setMissingDocumentJob: d,
    documentJobId: m,
    rejectedDocumentJobId: f,
    sessionJobId: h,
    resolvedJobDocument: p,
    setResolvedJobDocument: y,
    jobDocumentId: b,
    documentId: S,
    sourceOnly: w,
    committedDocumentSource: g,
    setCommittedDocumentSource: v,
    activeCommittedDocumentSource: M,
    sourceViewOnly: _,
    refreshCommittedDocument: x,
    applyIdentityEvent: D
  };
}
function Dn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function oa(e) {
  var r, o, a, s;
  if (!e || typeof e != "object") return "";
  const t = e, n = [
    t.document_id,
    t.documentId,
    (r = t.document) == null ? void 0 : r.document_id,
    (o = t.book_summary) == null ? void 0 : o.document_id,
    (s = (a = t.request_payload) == null ? void 0 : a.source) == null ? void 0 : s.document_id
  ];
  for (const l of n) {
    const i = `${l || ""}`.trim();
    if (i) return i;
  }
  return "";
}
function zn(e, t) {
  const n = `/api/v1/documents/${encodeURIComponent(e)}/source.pdf`, r = `${t || ""}`.trim();
  return Vo(r ? `${n}?version=${encodeURIComponent(r)}` : n);
}
function aa(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function sa(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !aa(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Ut({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Wo.progress,
        stage: n,
        percent: e,
        text: t
      },
      wr.messageTargetOrigin()
    );
  } catch {
  }
}
function Pt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Ut({ percent: t, text: n, stage: r });
}
function ia(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [l, i] = k(null), [c, u] = k(null), [d, m] = k(""), [f, h] = k(0), p = d === n ? l : null, y = d === n ? c : null, b = Dn(p), S = on(b), w = $(() => {
    h((D) => D + 1);
  }, []), g = $((D) => {
    i(D.jobPayload), u(D.manifestPayload), m(D.sessionIdentity);
  }, []), v = $((D) => {
    i(null), u(null), m(D);
  }, []), M = A(""), _ = A(""), x = $(async () => {
    const D = o.current;
    if (!D || M.current === D) return;
    const N = sn().loadJobPayload;
    if (typeof N != "function") return;
    const R = a.current.value;
    M.current = D;
    try {
      const T = await N(D);
      if (s.current || a.current.value !== R || o.current !== D || !T || typeof T != "object")
        return;
      const I = Dn(T);
      i(T), m(r.current), I === "succeeded" && _.current !== D && (_.current = D, h((E) => E + 1));
    } catch {
    } finally {
      M.current === D && (M.current = "");
    }
  }, []);
  return j(() => {
    _.current = "";
  }, [n]), j(() => {
    if (!t || S || !p) return;
    const D = window.setInterval(() => {
      x();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [S, x, p, t]), {
    jobPayload: l,
    setJobPayload: i,
    manifestPayload: c,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: m,
    scopedJobPayload: p,
    scopedManifestPayload: y,
    jobStatus: b,
    jobTerminal: S,
    jobRefreshRevision: f,
    refreshJobArtifacts: w,
    refreshJobStatus: x,
    publishPayload: g,
    clearPayload: v
  };
}
function Bt(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function ca(e, t) {
  e(t), Bt(t);
}
function la(e) {
  const [t, n] = k(e ? "source" : "compare"), r = $((a) => {
    e && a !== "source" || (n(a), Bt(a));
  }, [e]), o = $((a) => {
    ca(n, a);
  }, []);
  return j(() => (e && document.documentElement.classList.add("reader-source-only"), Bt(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function xn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function ua(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: xn(n.active_job_id),
    activeVersionId: xn(n.active_version_id)
  };
}
function da(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function fa(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function ma(e) {
  return e.status === 404 && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
function ha(e) {
  return e ? { data: e.data.slice() } : null;
}
const pa = 2, pe = /* @__PURE__ */ new Map();
function Ht(e, t) {
  pe.delete(e), pe.set(e, t);
}
function ga(e) {
  if (pe.size < pa) return;
  const t = pe.keys().next().value;
  t && pe.delete(t);
}
function Nt(e) {
  const t = `${e || ""}`.trim();
  if (!t || !pe.has(t)) return null;
  const n = pe.get(t);
  return Ht(t, n), n;
}
async function Pr(e, t = at().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (pe.has(r)) {
    const l = pe.get(r);
    return Ht(r, l), l;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const l = new Error(`读取 PDF 失败 (${o.status})`);
    throw l.status = o.status, l;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return pe.has(r) ? Ht(r, s) : (ga(), pe.set(r, s)), s;
}
function ba(e = "", t = null) {
  const [n, r] = k(
    () => t || Nt(e)
  ), [o, a] = k(
    () => !!`${e || ""}`.trim() && !t && !Nt(e)
  ), [s, l] = k("");
  return j(() => {
    if (t) {
      r(t), a(!1), l("");
      return;
    }
    const i = `${e || ""}`.trim();
    if (!i) {
      r(null), a(!1), l("");
      return;
    }
    const c = Nt(i);
    if (c) {
      r(c), a(!1), l("");
      return;
    }
    let u = !1;
    return a(!0), l(""), r(null), Pr(i).then((d) => {
      u || (r(d), a(!1));
    }).catch((d) => {
      u || (r(null), a(!1), l((d == null ? void 0 : d.message) || String(d)));
    }), () => {
      u = !0;
    };
  }, [e, t]), { file: n, loading: o, error: s };
}
function ya(e) {
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
async function Wt(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Pt(s, r, n, "download");
  const l = await Pr(t, at().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Pt(s, o, n, "download"), l);
}
async function va(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Pt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, l = null;
  return t && a.push(
    Wt({
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
    Wt({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: o
    }).then((u) => {
      l = u;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !l ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: l };
}
const gt = {
  regions: null,
  metadata: null
};
function Sa(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: o,
    rejectedDocumentJobId: a,
    sourceOnly: s,
    locationKey: l,
    sessionIdentity: i,
    committedSource: c,
    applyIdentityEvent: u,
    publishPayload: d,
    clearPayload: m,
    switchSessionMode: f,
    jobRefreshRevision: h,
    sessionEpochRef: p,
    closingRef: y,
    activeLoadAbortRef: b
  } = e, [S, w] = k(""), [g, v] = k(""), [M, _] = k(null), [x, D] = k(null), [N, R] = k(!1), [T, I] = k(""), [E, O] = k([]), [C, V] = k(() => ({
    source: null,
    translated: null
  })), [J, F] = k(
    gt
  ), [z, B] = k({
    loading: !0,
    percent: 4,
    text: Se.boot,
    stage: "progress",
    failed: !1
  });
  return j(() => {
    const Q = new AbortController(), te = p.current.value, re = ya({
      sessionEpochRef: p,
      closingRef: y,
      abort: Q,
      sessionEpoch: te
    });
    b.current = Q;
    const X = sn();
    if (y.current)
      return Q.abort(), () => {
        b.current === Q && (b.current = null);
      };
    function ee(ne, ae) {
      re.markFailed(), B({
        loading: !1,
        percent: 100,
        text: ne,
        stage: "failed",
        failed: !0
      }), Ut({ percent: 100, text: ae, stage: "failed" });
    }
    function ve() {
      R(!0), B({
        loading: !1,
        percent: 100,
        text: Se.ready,
        stage: "ready",
        failed: !1
      }), Ut({ percent: 100, text: Se.ready, stage: "ready" });
    }
    function Oe() {
      return c != null && c.documentId ? zn(
        c.documentId,
        c.revision
      ) : Bo() ? Ho : X.resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(r)}/source.pdf`);
    }
    async function Ee() {
      let ne = { activeJobId: "", activeVersionId: "" };
      try {
        const de = await X.fetchProtected(
          X.resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(r)}`)
        );
        if (de != null && de.ok) {
          const ce = await de.json().catch(() => null);
          ne = ua(ce);
        }
      } catch {
      }
      const ae = da({
        link: ne,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (ae.kind === "follow-active-job") {
        if (re.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: ae.jobId
        }), ae.activeVersionId ? (c || u({
          type: "committed-source",
          documentId: r,
          revision: ae.activeVersionId,
          sessionIdentity: i
        }), f("source")) : f("compare");
        return;
      }
      if (ae.kind === "open-committed-source") {
        if (re.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: ae.revision,
          sessionIdentity: i
        }), f("source");
        return;
      }
      const se = Oe();
      if (re.isInactive()) return;
      w(se), v(""), I(""), m(i);
      const ue = await Wt({
        url: se,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: re,
        setBoot: B
      });
      if (!re.isInactive()) {
        if (!ue) {
          ee("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        _(ue), ve();
      }
    }
    async function mt() {
      var H;
      const ne = !c, ae = !!(ne && X.loadSessionSnapshot && X.loadReaderOptionalArtifacts), se = ae ? X.loadReaderOptionalArtifacts(t) : null, ue = await ((H = X.loadSessionSnapshot) == null ? void 0 : H.call(X, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: ne && !ae
      })), de = ue ? {
        jobPayload: ue.sourcePayload,
        manifestPayload: ue.manifestPayload,
        readerMetadata: ue.readerMetadata,
        regionsPayload: ue.regions,
        readerErrors: ue.readerErrors
      } : await X.loadReaderPayload(t, {
        includeOptionalArtifacts: ne
      });
      if (re.isInactive()) return;
      let ce = null;
      if (n && !r)
        if (ue && ue.linkedDocument !== void 0)
          ce = ue.linkedDocument;
        else {
          try {
            ce = await X.fetchDocumentByJobId(ea, t);
          } catch {
          }
          if (re.isInactive()) return;
        }
      const Fe = oa(de.jobPayload) || `${(ce == null ? void 0 : ce.document_id) || ""}`.trim();
      Fe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Fe
      });
      const $e = fa({
        payloadDocumentId: Fe,
        linkedActiveJobId: `${(ce == null ? void 0 : ce.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ce == null ? void 0 : ce.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if ($e.kind === "restore-committed-source") {
        if (re.isInactive()) return;
        u({
          type: "committed-source",
          documentId: $e.documentId,
          revision: $e.revision,
          sessionIdentity: i
        }), f("source");
        return;
      }
      const Ye = X.resolveReaderSourcePdf(de.manifestPayload), Lt = X.resolveReaderTranslatedPdfUrl(de.jobPayload, de.manifestPayload), Me = typeof Ye == "string" ? Ye : X.resolveReaderArtifactUrl(Ye), Ae = r || Fe, _e = c != null && c.documentId ? zn(
        c.documentId,
        c.revision
      ) : Me || (Ae ? X.resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(Ae)}/source.pdf`) : ""), Xe = c ? "" : Lt || "";
      w(_e || ""), v(Xe), I(sa(de.jobPayload, t)), d({
        jobPayload: de.jobPayload || null,
        manifestPayload: de.manifestPayload || null,
        sessionIdentity: i
      });
      const ht = () => va({
        sourceFinal: _e || "",
        translatedFinal: Xe,
        fence: re,
        setBoot: B
      }), pt = !!(_e || Xe), je = se && pt ? ht() : null;
      je == null || je.catch(() => {
      });
      const L = se ? await se : de;
      if (re.isInactive()) return;
      if (O(c ? [] : wo(L.regionsPayload)), V(c ? { source: null, translated: null } : Po(L.readerMetadata)), F(c ? gt : L.readerErrors ?? gt), !pt) {
        ee(Se.failed, Se.failed);
        return;
      }
      const W = await (je ?? ht());
      if (W.status !== "inactive") {
        if (W.status === "incomplete") {
          ee("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        _(W.sourceBytes), D(W.translatedBytes), ve();
      }
    }
    async function _t() {
      R(!1), _(null), D(null), O([]), V({ source: null, translated: null }), F(gt), Pt(B, 8, Se.metadata, "metadata");
      try {
        if (s) {
          await Ee();
          return;
        }
        if (!t) {
          ee(Se.failed, Se.failed);
          return;
        }
        await mt();
      } catch (ne) {
        if (re.isClosedOrStale() || (ne == null ? void 0 : ne.name) === "AbortError") return;
        re.markFailed();
        const ae = Number(ne == null ? void 0 : ne.status);
        if (ma({
          status: ae,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), f("source");
          return;
        }
        const se = ne instanceof Error ? ne.message : Se.failed;
        ee(se, se);
      }
    }
    return _t(), () => {
      Q.abort(), b.current === Q && (b.current = null);
    };
  }, [t, r, o, a, s, l, c, h, n, i, u, d, m, f]), {
    sourceUrl: S,
    translatedUrl: g,
    sourceFile: M,
    translatedFile: x,
    assetsReady: N,
    title: T,
    regions: E,
    readerMetadata: C,
    readerErrors: J,
    boot: z
  };
}
function wa() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = na(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const l = A(a), i = A(""), c = A(""), u = A(() => {
  }), d = $(() => u.current(), []), m = ra({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: l,
    documentIdRef: i,
    sessionJobIdRef: c,
    switchToSourceMode: d
  }), {
    sessionJobId: f,
    documentId: h,
    sourceOnly: p,
    sourceViewOnly: y
  } = m, { mode: b, setMode: S, switchSessionMode: w } = la(y);
  u.current = () => {
    w("source");
  }, l.current = a, i.current = h, c.current = f;
  const g = ia({
    sessionJobId: f,
    sessionIdentity: a,
    sessionIdentityRef: l,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: v,
    scopedManifestPayload: M,
    jobStatus: _,
    jobTerminal: x,
    jobRefreshRevision: D,
    refreshJobArtifacts: N,
    refreshJobStatus: R
  } = g, T = Sa({
    sessionJobId: f,
    jobId: r,
    routeDocumentId: o,
    documentJobId: m.documentJobId,
    rejectedDocumentJobId: m.rejectedDocumentJobId,
    sourceOnly: p,
    locationKey: n,
    sessionIdentity: a,
    committedSource: m.activeCommittedDocumentSource,
    applyIdentityEvent: m.applyIdentityEvent,
    publishPayload: g.publishPayload,
    clearPayload: g.clearPayload,
    switchSessionMode: w,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), I = $(() => {
    var O;
    e.current = !0, (O = t.current) == null || O.abort();
  }, []), E = K(
    () => ({
      fetchProtected: sn().fetchProtected,
      jobId: f,
      jobPayload: v,
      manifestPayload: M,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: y
    }),
    [f, v, M, T.sourceUrl, T.translatedUrl, y]
  );
  return {
    jobId: f,
    jobStatus: _,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: x,
    documentId: h,
    sessionIdentity: a,
    sourceOnly: p,
    mode: b,
    setMode: S,
    sourceUrl: T.sourceUrl,
    translatedUrl: T.translatedUrl,
    sourceFile: T.sourceFile,
    translatedFile: T.translatedFile,
    assetsReady: T.assetsReady,
    boot: T.boot,
    title: T.title,
    regions: T.regions,
    readerMetadata: T.readerMetadata,
    readerErrors: T.readerErrors,
    download: E,
    refreshJobArtifacts: N,
    refreshJobStatus: R,
    refreshCommittedDocument: m.refreshCommittedDocument,
    prepareClose: I
  };
}
const Pa = 160, Ra = 8, Ia = 0;
function Ta() {
  const e = A(null), [t, n] = k(null), [r, o] = k(Ia), a = $((s) => {
    e.current = s, n(s);
  }, []);
  return j(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const l = (c) => {
      !Number.isFinite(c) || c < Pa || o((u) => Math.abs(u - c) < Ra ? u : c);
    }, i = new ResizeObserver((c) => {
      var u, d;
      l(((d = (u = c[0]) == null ? void 0 : u.contentRect) == null ? void 0 : d.width) ?? s.clientWidth);
    });
    return i.observe(s), l(s.clientWidth), () => i.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function Ea(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: o, hasTranslated: a } = e, s = r && o, l = r && a && !n, i = t === "source" || t === "compare", c = !n && (t === "translated" || t === "compare");
  return {
    mountSource: s,
    mountTranslated: l,
    showSource: i,
    showTranslated: c,
    compareMode: t === "compare" && i && c && s && l,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
const Ct = { source: 0, translated: 0 };
function Ma(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: l,
    translatedFile: i
  } = e, c = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = A(c);
  u.current = c;
  const [d, m] = k(() => ({
    identity: c,
    pages: Ct
  })), [f, h] = k(() => ({ identity: c, tick: 0 })), p = d.identity === c ? d.pages : Ct, y = f.identity === c ? f.tick : 0, b = Ea({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!l || !!a,
    hasTranslated: !!i
  }), { primaryPane: S } = b, w = $((R, T) => {
    u.current === c && m((I) => {
      const E = I.identity === c ? I.pages : Ct;
      return E[T] === R && I.identity === c ? I : {
        identity: c,
        pages: { ...E, [T]: R }
      };
    });
  }, [c]), g = A(null), v = $(() => {
    g.current && clearTimeout(g.current);
    const R = c;
    g.current = setTimeout(() => {
      g.current = null, u.current === R && h((T) => ({
        identity: R,
        tick: T.identity === R ? T.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  j(() => (g.current && (clearTimeout(g.current), g.current = null), m((R) => R.identity === c && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: c, pages: { source: 0, translated: 0 } }), h((R) => R.identity === c && R.tick === 0 ? R : { identity: c, tick: 0 }), () => {
    g.current && (clearTimeout(g.current), g.current = null);
  }), [c]);
  const M = K(
    () => Math.max(p.source, p.translated),
    [p]
  ), _ = S === "translated" ? p.translated : p.source || p.translated, x = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, N = `${c}-${y}-${x}-${n}-${p.source}-${p.translated}-${D}`;
  return {
    ...b,
    numPagesByPane: p,
    hudNumPages: M,
    primaryNumPages: _,
    metricsTick: y,
    onNumPages: w,
    onMetrics: v,
    rowSyncRevision: N
  };
}
const Ge = "data-reader-page", st = "data-reader-pane", cn = "data-natural-height", Aa = "reader-react-root", _a = "reader-react-grid", La = "reader-react-scroll-shell", ka = "reader-react-pdf-pane", Rr = "reader-react-pdf-page", Rt = "reader-react-pdf-page-placeholder", ln = "reader-react-pdf-page-slot";
function It(e, t) {
  const n = e != null ? `[${Ge}="${e}"]` : `[${Ge}]`;
  return t ? `${n}[${st}="${t}"]` : n;
}
function Na() {
  return `.${ln}[${Ge}]`;
}
function un(e) {
  return Number(e.getAttribute(Ge));
}
const Ir = 0.25, Tt = 1, Ca = 0.05, dt = 0.5, Da = 16, za = 8, xa = 720;
function Ve() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Tr(e) {
  return Number.isFinite(e) && e < xa;
}
function He(e, t = Number.POSITIVE_INFINITY) {
  return Tr(t) && (e === "source" || e === "translated") ? Tt : dt;
}
function Mt(e) {
  return Number.isFinite(e) ? Math.min(Tt, Math.max(Ir, e)) : dt;
}
function it(e, t) {
  const n = Mt(Number(e) + t * Ca);
  return Math.round(n * 100) / 100;
}
function Oa(e) {
  return Math.round(Mt(e) * 100);
}
function Fa(e) {
  const n = (Number(e) || 0) - Da - za;
  return Math.max(160, Math.floor(n));
}
function $a(e, t = dt) {
  const n = Mt(t);
  return Fa((Number(e) || 0) * n);
}
function ja(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${st}]`)
  ).map((s) => ({
    pane: s,
    cx: s.scrollLeft + s.clientWidth / 2,
    hadOverflow: s.scrollWidth > s.clientWidth + 1
  })), a = () => {
    e.scrollLeft = Math.max(0, n * t - e.clientWidth / 2), e.scrollTop = Math.max(0, r * t - e.clientHeight / 2);
    for (const { pane: s, cx: l, hadOverflow: i } of o) {
      const c = Math.max(0, s.scrollWidth - s.clientWidth);
      if (c <= 0) {
        s.scrollLeft = 0;
        continue;
      }
      i ? s.scrollLeft = Math.min(
        c,
        Math.max(0, l * t - s.clientWidth / 2)
      ) : s.scrollLeft = c / 2;
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(a);
  });
}
const Ua = 8;
function Ba(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Ua ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Ha = 200, Er = [
  "markdown"
], Mr = [
  "terminal"
], Wa = [
  ...Er,
  ...Mr
];
function Ar(e) {
  return Wa.includes(e);
}
const Va = "retainpdf:reader:view:v1:", On = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Ja = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function _r() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Vt(e) {
  return `${e || ""}`.trim();
}
function qa({
  documentId: e,
  jobId: t
}) {
  const n = Vt(e);
  if (n) return `document:${n}`;
  const r = Vt(t);
  return r ? `job:${r}` : "";
}
function Lr(e) {
  const t = Vt(e);
  return t ? `${Va}${t}` : "";
}
function Ga(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Ka(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!On.has(t) || !On.has(n) || t === n))
    return { left: t, right: n };
}
function Za(e) {
  return e === null ? null : Ar(e) ? e : void 0;
}
function Ya(e) {
  return Ja.has(e) ? e : void 0;
}
function kr(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Ga(t.anchor), r = Number(t.zoom), o = Ya(t.mode), a = Ka(t.splitLayout), s = Za(t.assistantPanel);
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
function ye(e, t = _r()) {
  const n = Lr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? kr(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function At(e, t, n = _r()) {
  const r = Lr(e);
  if (!r || !n) return null;
  const o = ye(e, n), a = kr({
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
function Xa(e, t, n = "") {
  var m;
  const [r, o] = k(() => {
    var f;
    return ((f = ye(n)) == null ? void 0 : f.zoom) ?? He(e, Ve());
  }), a = A(r), s = A(n);
  a.current = r;
  const l = A(1), i = A(((m = ye(n)) == null ? void 0 : m.zoom) !== void 0);
  j(() => {
    var p;
    if (s.current === n) return;
    s.current = n;
    const f = (p = ye(n)) == null ? void 0 : p.zoom;
    i.current = f !== void 0;
    const h = f ?? He(e, Ve());
    l.current = 1, a.current = h, o(h);
  }, [e, n]), j(() => {
    if (i.current) return;
    const f = He(e, Ve()), h = a.current;
    Math.abs(f - h) < 5e-4 || (l.current = 1, a.current = f, o(f));
  }, [e]);
  const c = $((f) => {
    const h = Mt(f), p = a.current;
    Math.abs(h - p) < 5e-4 || (l.current = h / (p || 1), i.current = !0, At(s.current, { zoom: h }), o(h));
  }, []), u = $((f) => {
    c(it(a.current, f));
  }, [c]), d = $((f) => {
    c(He(f));
  }, [c]);
  return De(() => {
    const f = l.current;
    Math.abs(f - 1) < 1e-3 || (l.current = 1, ja(t == null ? void 0 : t.current, f));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: u, resetZoom: d };
}
function Qa(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: $((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const dn = 48;
function Nr(e, t = dn) {
  return e.getBoundingClientRect().top + t;
}
function Cr(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const i of e) {
    const c = i.getBoundingClientRect();
    c.height < 8 || c.width < 8 || c.top <= t + 1 && c.top >= r && (n = i, r = c.top);
  }
  if (!n && (n = e.find((c) => {
    const u = c.getBoundingClientRect();
    return u.height >= 8 && u.width >= 8;
  }) ?? null, n)) {
    const c = [...e].reverse().find((u) => {
      const d = u.getBoundingClientRect();
      return d.height >= 8 && d.width >= 8;
    });
    c && c.getBoundingClientRect().bottom < t && (n = c);
  }
  if (!n)
    return null;
  const o = un(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, l = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: l };
}
function Dt(e, t, n = dn) {
  if (!e)
    return null;
  const r = It(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Nr(e, n), l = Cr(o, s);
  return l ? { page: l.page, fraction: l.fraction } : null;
}
function fn(e, t, n = "auto", r, o = dn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let l = null;
  if (r && (l = e.querySelector(It(a, r))), l || (l = e.querySelector(It(a))), !l)
    return !1;
  const i = e.getBoundingClientRect(), c = l.getBoundingClientRect();
  if (i.height <= 0 || c.height < 8 && l.offsetHeight < 8)
    return !1;
  const u = c.height > 0 ? c.height : l.offsetHeight, d = e.scrollTop + (c.top - i.top), m = Math.max(0, d + s * u - o);
  return n === "auto" ? e.scrollTop = m : e.scrollTo({ top: m, behavior: n }), !0;
}
function es(e, t, n = "smooth", r) {
  return fn(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Jt(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const l = [], i = () => {
    var u;
    if (a) return;
    fn(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (u = n == null ? void 0 : n.onDone) == null || u.call(n));
  };
  for (const c of o)
    c <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(i);
    }) : l.push(setTimeout(i, c));
  return () => {
    a = !0;
    for (const c of l)
      clearTimeout(c);
  };
}
function ts(e, t, n) {
  return Jt(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Et(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function he(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function ns(e, t, n = !0, r = "", o) {
  const [a, s] = k(1);
  return j(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const l = e.current;
    if (!l)
      return;
    let i = !1, c = null, u = 0;
    const d = It(void 0, o), m = () => {
      if (i) return;
      const p = Array.from(l.querySelectorAll(d));
      if (!p.length)
        return;
      const y = Nr(l), b = Cr(p, y);
      b && s(b.page);
    }, f = () => {
      i || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, m();
      }));
    }, h = () => {
      if (i) return;
      if (!Array.from(l.querySelectorAll(d)).length) {
        c = setTimeout(h, 120);
        return;
      }
      m(), l.addEventListener("scroll", f, { passive: !0 });
    };
    return h(), () => {
      i = !0, c && clearTimeout(c), u && cancelAnimationFrame(u), l.removeEventListener("scroll", f);
    };
  }, [e, t, n, r, o]), a;
}
const rs = `canvas, .react-pdf__Page, .${Rr}, .${Rt}`, Fn = /* @__PURE__ */ new WeakMap();
function os(e) {
  const t = Number(e.getAttribute(cn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Fn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(rs), Fn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function as(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function ss(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Na()).forEach((r) => {
    const o = un(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = os(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function is(e, t, n = "", r) {
  const [o, a] = k(() => /* @__PURE__ */ new Map()), s = A(o), l = A(r);
  return l.current = r, De(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, c = 0, u = !1, d = !1;
    const m = () => {
      var v;
      if (i) return;
      const w = e.current;
      if (!w) return;
      const g = ss(w);
      as(s.current, g) || (s.current = g, a(g)), u && !d && (d = !0, (v = l.current) == null || v.call(l));
    }, f = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(m);
      });
    };
    f();
    const h = window.setTimeout(f, 100), p = window.setTimeout(() => {
      u = !0, f();
    }, 300), y = window.setTimeout(f, 700), b = e.current;
    let S = null;
    return b && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => f()), S.observe(b)), () => {
      i = !0, cancelAnimationFrame(c), window.clearTimeout(h), window.clearTimeout(p), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const cs = [0, 48, 140, 320, 560], ls = 700, us = [80, 200, 400], ds = 500, fs = 50, ms = /* @__PURE__ */ new Set([
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
]), hs = 180, $n = [0, 48, 140, 320, 700, 1200];
function ps(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, l = A(
    ((T = ye(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), i = A(null), c = A(!1), u = A(r), d = A(null), m = A(null), f = A(null), h = A(null), p = A(a), y = A(""), b = A(n);
  b.current = n;
  const S = $(() => {
    var I;
    (I = d.current) == null || I.call(d), d.current = null, m.current != null && (clearTimeout(m.current), m.current = null);
  }, []), w = $(() => {
    !c.current && i.current == null || (S(), f.current != null && (clearTimeout(f.current), f.current = null), i.current = null, c.current = !1);
  }, [S]), g = $((I = !1) => {
    h.current != null && (clearTimeout(h.current), h.current = null);
    const E = () => {
      h.current = null, At(p.current, {
        anchor: he(l.current)
      });
    };
    I ? E() : h.current = setTimeout(E, hs);
  }, []), v = $((I) => {
    l.current = he(I), i.current = null, f.current != null && clearTimeout(f.current), f.current = setTimeout(() => {
      f.current = null, c.current = !1;
    }, fs);
  }, []);
  j(() => {
    if (!o)
      return;
    let I = !1, E = null, O = null, C = null;
    const V = () => {
      if (I) return;
      const J = e.current;
      if (!J) {
        C = setTimeout(V, 50);
        return;
      }
      E = J, O = () => {
        if (c.current)
          return;
        const F = Dt(E, b.current);
        F && (l.current = F, g());
      }, E.addEventListener("scroll", O, { passive: !0 }), c.current || O();
    };
    return V(), () => {
      I = !0, C != null && clearTimeout(C), E && O && E.removeEventListener("scroll", O);
    };
  }, [o, r, n, e, g]), j(() => {
    if (!o) return;
    const I = e.current;
    if (!I) return;
    const E = (O) => {
      O.metaKey || O.ctrlKey || O.altKey || ms.has(O.key) && w();
    };
    return I.addEventListener("wheel", w, { passive: !0 }), I.addEventListener("touchmove", w, { passive: !0 }), window.addEventListener("keydown", E), () => {
      I.removeEventListener("wheel", w), I.removeEventListener("touchmove", w), window.removeEventListener("keydown", E);
    };
  }, [o, e, w]), De(() => {
    var E;
    if (p.current === a) return;
    g(!0), S(), f.current != null && (clearTimeout(f.current), f.current = null), p.current = a, y.current = "";
    const I = (E = ye(a)) == null ? void 0 : E.anchor;
    l.current = I ? he(I) : { page: 1, fraction: 0 }, i.current = null, c.current = !!a, u.current = r;
  }, [a, r, g, S]), j(() => {
    var E;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const I = he(
      ((E = ye(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
    );
    return l.current = I, i.current = I, c.current = !0, S(), d.current = Jt(
      () => e.current,
      I,
      {
        behavior: "auto",
        pane: b.current,
        delaysMs: $n,
        onDone: () => v(I)
      }
    ), m.current = setTimeout(() => {
      m.current = null, v(I);
    }, Math.max(...$n) + 160), () => S();
  }, [o, s, a, e, v, S]), j(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      c.current = !1, i.current = null, S();
      return;
    }
    const I = i.current ? he(i.current) : he(l.current);
    return c.current = !0, i.current = I, l.current = I, S(), d.current = Jt(
      () => e.current,
      I,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: cs,
        onDone: () => v(I)
      }
    ), m.current = setTimeout(() => {
      m.current = null, v(I);
    }, ls), () => {
      S();
    };
  }, [r, o, n, e, v, S]), j(() => () => {
    S(), f.current != null && (clearTimeout(f.current), f.current = null), g(!0);
  }, [S, g]);
  const M = $(() => {
    const I = Dt(
      e.current,
      b.current
    );
    return he(I || l.current);
  }, [e]), _ = $(() => {
    c.current = !0;
    const I = Dt(
      e.current,
      b.current
    ), E = he(I ?? l.current);
    return l.current = E, i.current = E, g(), E;
  }, [e, g]), x = $((I, E, O) => {
    const C = O || b.current, V = Et(I, E || 1), J = { page: V, fraction: 0 };
    l.current = J, c.current = !0, i.current = J, g(), S(), es(e.current, V, "smooth", C), d.current = ts(
      () => e.current,
      V,
      {
        behavior: "auto",
        pane: C,
        delaysMs: us,
        onDone: () => v(J)
      }
    ), m.current = setTimeout(() => {
      m.current = null, v(J);
    }, ds);
  }, [e, v, S, g]), D = $(() => he(l.current), []), N = $(() => c.current, []), R = $(() => {
    if (!c.current || !i.current)
      return;
    const I = he(i.current);
    fn(
      e.current,
      I,
      "auto",
      b.current
    );
  }, [e]);
  return {
    lockFromShell: M,
    beginModeSwitch: _,
    goToPage: x,
    getAnchor: D,
    isRestoring: N,
    repinIfRestoring: R
  };
}
function gs(e, t) {
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
function Dr(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const bs = [0, 80, 200, 400, 800], ys = 120, vs = 400;
function Ss(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: l, jobId: i, documentId: c } = e, u = A(a);
  u.current = a;
  const d = A(s);
  d.current = s;
  const m = A(l);
  m.current = l;
  const f = A(n);
  f.current = n, j(() => {
    var w, g;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = qo(), p = gs(h, d.current), y = Dr(h, p, { jobId: i, documentId: c });
    if (t.current === y)
      return;
    if (p == null) {
      t.current = y, (w = f.current) == null || w.call(f);
      return;
    }
    t.current = y, h && ((g = m.current) == null || g.call(m, h, p));
    const b = [];
    let S = 0;
    for (const v of bs)
      S = Math.max(S, v), b.push(
        setTimeout(() => {
          u.current(p);
        }, v)
      );
    return b.push(
      setTimeout(() => {
        var v;
        (v = f.current) == null || v.call(f);
      }, S + ys)
    ), () => {
      for (const v of b) clearTimeout(v);
    };
  }, [r, o, i, c, t]);
}
function ws(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Ps(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = vs,
    jobId: l,
    documentId: i,
    applyReaderSearch: c
  } = e, u = A(a);
  u.current = a;
  const d = A(c);
  d.current = c;
  const m = A(0);
  j(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || m.current === o) return;
    const f = setTimeout(() => {
      var b;
      const h = ((b = globalThis.location) == null ? void 0 : b.search) || "", p = So(h, o, u.current);
      if (m.current = o, p === null) return;
      const y = `${new URLSearchParams(p).get("block_id") || ""}`.trim();
      t.current = Dr(
        { blockId: y },
        o,
        { jobId: l, documentId: i }
      ), (d.current || ws)(p);
    }, s);
    return () => clearTimeout(f);
  }, [
    n,
    r,
    o,
    s,
    l,
    i,
    t
  ]);
}
function Rs(e) {
  const t = A(""), [n, r] = k(!1), o = $(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId
  };
  Ss(a, t, o), Ps(e, t, n);
}
const et = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Is(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function jn(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function zr(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = jn(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = jn(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Ts(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = zr(r, t, n);
  if (o === "retry") return e;
  if (o === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const a = new Map(n.items.map((i) => [i.item_id, i])), s = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const i of t.changed_item_ids)
    a.has(i) && s.set(i, t.seq);
  const l = new Map(e.pagesByPage);
  return l.set(t.page_idx, {
    attempt: n.attempt,
    generation: n.generation,
    pageHash: n.page_hash,
    itemsById: a,
    changedAtSeqById: s,
    lastEventSeq: t.seq
  }), {
    ...e,
    pagesByPage: l,
    lastSeq: t.seq,
    connection: "live",
    error: ""
  };
}
function Es(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const Un = [250, 500, 1e3, 2e3, 4e3], zt = [80, 160, 320, 640, 1e3, 1500], Bn = [250, 500, 1e3, 2e3, 4e3, 5e3];
function qt(e, t) {
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
function mn(e) {
  return Mo(e) ? `${e.code || ""}`.trim() : "";
}
function bt(e, t) {
  const n = mn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Ms(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (zr(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = Ao(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (i) {
      if ((i == null ? void 0 : i.name) === "AbortError") throw i;
      a = i;
      const c = mn(i);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw i;
    }
    const l = zt[Math.min(s, zt.length - 1)];
    if (await qt(l, r), s >= zt.length + 2) throw a;
  }
}
function As({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = k(et), s = A(o), l = A("");
  s.current = o;
  const i = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), u = on(c) ? c : "";
  return j(() => {
    if (!n || !i) {
      l.current = "", s.current = et, a(et);
      return;
    }
    const d = r === void 0 ? Jo() : r, m = l.current === i;
    if (l.current = i, !d) {
      const w = {
        ...m ? s.current : et,
        connection: u ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = w, a(w);
      return;
    }
    const f = new AbortController();
    let h = !1;
    const p = {
      ...m ? s.current : et,
      connection: u ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = p, a(p);
    const y = (w) => {
      f.signal.aborted || a((g) => {
        const v = w(g);
        return s.current = v, v;
      });
    }, b = async () => {
      let w = 0;
      for (; !f.signal.aborted; )
        try {
          const g = await d.fetchLayout(i, { signal: f.signal });
          h = !0, y((v) => ({
            ...v,
            layoutByPage: Is(g),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError") return;
          const v = mn(g);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            y((_) => ({
              ..._,
              connection: u ? "terminal" : "unavailable",
              jobStatus: c,
              error: bt(g, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((_) => ({
              ..._,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          y((_) => ({
            ..._,
            connection: "connecting",
            jobStatus: c,
            error: bt(g, "正在等待 OCR 版面数据")
          })), await qt(Un[Math.min(w, Un.length - 1)], f.signal).catch(() => {
          }), w += 1;
        }
    };
    return (async () => {
      if (await b(), !h || f.signal.aborted) return;
      let w = 0;
      for (; !f.signal.aborted; ) {
        u || y((g) => ({
          ...g,
          connection: g.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: g.error
        }));
        try {
          await d.streamEvents(i, {
            afterSeq: s.current.lastSeq,
            signal: f.signal,
            onEvent: async (g) => {
              if (g.seq <= s.current.lastSeq) return;
              let v;
              try {
                v = await Ms(
                  i,
                  g,
                  s.current,
                  f.signal,
                  d
                );
              } catch (M) {
                if ((M == null ? void 0 : M.name) === "AbortError" || f.signal.aborted) throw M;
                y((_) => ({
                  ..._,
                  lastSeq: Math.max(_.lastSeq, g.seq),
                  error: bt(M, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((M) => {
                const _ = Ts(M, g, v);
                return u ? {
                  ..._,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ..._,
                  jobStatus: c
                };
              }), w = 0;
            }
          });
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError" || f.signal.aborted) return;
          y((v) => ({
            ...v,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: c,
            error: bt(g, "实时译文连接已中断，正在重连")
          }));
        }
        if (f.signal.aborted) return;
        if (u) {
          y((g) => ({
            ...g,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await qt(Bn[Math.min(w, Bn.length - 1)], f.signal).catch(() => {
        }), w += 1;
      }
    })(), () => f.abort();
  }, [n, r, i, u]), o;
}
const _s = 2e3;
function Ls(e) {
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
const ks = /* @__PURE__ */ new Set(["book", "translate"]);
function xr(e) {
  return !!(e.jobId && e.sourceUrl && ks.has(e.workflow));
}
function Ns(e) {
  return !!(xr(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Cs() {
  const e = wa(), t = xr({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Ns({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !on(o) && (r.current.running = !0);
  const a = As({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: l, shellWidth: i, bindShell: c } = Ta(), u = qa({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${u}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: f } = Xa(e.mode, s, u), h = Ma(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: m, shellWidth: i, identityKey: d }
  ), {
    beginModeSwitch: p,
    goToPage: y,
    repinIfRestoring: b
  } = ps(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: u,
    restoreReady: h.primaryNumPages > 0
  });
  j(() => {
    b();
  }, [i, b]);
  const S = is(
    s,
    h.compareMode,
    h.rowSyncRevision,
    b
  ), w = ns(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), g = $((C, V) => {
    var F, z;
    const J = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((F = h.numPagesByPane) == null ? void 0 : F.source) || 0,
      Number((z = h.numPagesByPane) == null ? void 0 : z.translated) || 0
    );
    y(C, J, V);
  }, [y, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [v, M] = k(null), _ = A(null), x = $((C) => {
    _.current && clearTimeout(_.current), M(C), C && (_.current = setTimeout(() => M(null), _s));
  }, []);
  j(() => () => {
    _.current && clearTimeout(_.current);
  }, []);
  const D = $((C) => {
    const V = kt(e.regions, C);
    return V ? kn(V, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), N = $((C, V) => {
    const J = V || h.primaryPane, F = typeof C == "object" && C ? `${C.block_id || ""}`.trim() : "", z = typeof C == "object" && C ? `${C.image_url || ""}`.trim() : "", B = typeof C == "object" && C ? C.page_idx != null ? Number(C.page_idx) + 1 : C.page != null ? Number(C.page) : null : typeof C == "number" ? C + 1 : null, Q = Ro(e.regions, z, B) || kt(e.regions, F) || (typeof C == "object" ? Io(e.regions, C) : null);
    let te = Q ? kn(Q, J).page : null;
    te == null && (te = Ls(C)), !(te == null || te < 1) && (x(Q), g(te, J));
  }, [x, g, h.primaryPane, e.regions]);
  Rs({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: w,
    goToPage: g,
    resolveBlockPage: D,
    jobId: e.jobId,
    documentId: e.documentId,
    onAnchorApplied: (C) => {
      x(kt(e.regions, C.blockId));
    }
  });
  const { setModeKeepingPage: R } = Qa({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: p
  });
  j(() => {
    x(null);
  }, [d, x]);
  const T = !e.boot.loading && !e.boot.failed, I = K(() => ({ bindShell: c, shellEl: l, shellWidth: i, shellRef: s }), [c, l, i, s]), E = K(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), O = K(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: f,
    shell: I,
    panes: h,
    sessionFiles: E,
    rowHeights: S,
    goToPage: g,
    activeRegion: v,
    jumpToAnchor: N,
    setModeKeepingPage: R,
    download: e.download,
    showHud: T,
    viewStateKey: u,
    liveTranslation: a,
    liveTranslationAvailable: n
  }), [e, I, h, E, S, g, v, N, R, T, m, f, u, a, n]);
  return K(() => ({
    ...O,
    currentPage: w
  }), [O, w]);
}
const Ds = [
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
], zs = [
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
    title: "模式",
    items: [
      { actions: ["mode-source"], keys: "1", desc: "源文件" },
      { actions: ["mode-compare"], keys: "2", desc: "对照" },
      { actions: ["mode-translated"], keys: "3", desc: "翻译文件" }
    ]
  }
];
function xs(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Ds)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Os(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Fs = ".reader-notes-panel";
function $s(e) {
  return e instanceof Element ? !!e.closest(Fs) : !1;
}
function js(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: l,
    goToPage: i,
    enabled: c = !0
  } = e;
  j(() => {
    if (!c)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Os(d.target) || $s(d.target))
        return;
      const m = d.key, f = xs(m);
      if (f) {
        if (f.mode) {
          if (n && f.mode !== "source")
            return;
          d.preventDefault(), r(f.mode);
          return;
        }
        if (!(f.requiresPages && l <= 0))
          switch (d.preventDefault(), f.action) {
            case "zoom-in":
              a(it(o, 1));
              return;
            case "zoom-out":
              a(it(o, -1));
              return;
            case "zoom-reset":
              a(He(t, Ve()));
              return;
            case "next-page":
              i(Et(s + 1, l));
              return;
            case "prev-page":
              i(Et(s - 1, l));
              return;
            case "first-page":
              i(1);
              return;
            case "last-page":
              i(l);
              return;
          }
      }
    };
    return window.addEventListener("keydown", u), () => window.removeEventListener("keydown", u);
  }, [
    c,
    t,
    n,
    r,
    o,
    a,
    s,
    l,
    i
  ]);
}
const Us = "retainpdf:soft-reader-close";
function Bs() {
  return new URL("./index.html", window.location.href).href;
}
function Hs() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Us },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ws(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Vs() {
  if (!(typeof window > "u") && !Hs()) {
    if (Ws(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Bs());
  }
}
function Js({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ U(
    "button",
    {
      id: "reader-close-home-btn",
      type: "button",
      className: "reader-close-home-btn",
      "aria-label": "返回主页",
      title: "返回主页",
      onClick: () => {
        e == null || e(), Vs();
      },
      children: [
        /* @__PURE__ */ P(br, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
        /* @__PURE__ */ P("span", { className: "reader-close-home-label", children: "关闭" })
      ]
    }
  );
}
let Hn = !1;
function qs() {
  if (Hn)
    return;
  const e = at().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (xo.GlobalWorkerOptions.workerSrc = e, Hn = !0);
}
const Gs = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Ks(e, t, n) {
  return e.flatMap((r) => {
    if (!Gs.has(gr(r.region))) return [];
    const o = an(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Wn(e, t, n) {
  let r = null, o = Number.POSITIVE_INFINITY;
  for (const a of e) {
    const { rect: s } = a;
    if (t < s.left || t > s.left + s.width || n < s.top || n > s.top + s.height)
      continue;
    const l = s.width * s.height;
    l < o && (r = a, o = l);
  }
  return r;
}
async function Zs(e) {
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
const Ys = "reader-text-hover-copy", Xs = "reader-text-hover-id", Or = "reader-text-hover-tools", Fr = 26, $r = 190;
function jr(e) {
  return e.height < Fr * 2 || e.width < $r;
}
function Qs({
  target: e,
  pane: t = "source"
}) {
  const [n, r] = k("idle"), [o, a] = k("idle"), s = A([]), l = (e == null ? void 0 : e.itemId) || "";
  if (j(() => {
    r("idle"), a("idle");
    const f = s.current;
    return () => {
      f.forEach((h) => window.clearTimeout(h)), s.current = [];
    };
  }, [l]), !e) return null;
  const i = To(e.highlight.region, t), c = gr(e.highlight.region), u = (f, h) => async (p) => {
    p.preventDefault(), p.stopPropagation();
    const y = await Zs(f);
    h(y ? "copied" : "failed"), s.current.push(window.setTimeout(() => h("idle"), 1200));
  }, d = c === "formula" ? "复制 LaTeX" : "复制", m = jr(e.rect);
  return /* @__PURE__ */ P("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ P(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": c,
      style: e.rect,
      children: /* @__PURE__ */ U(
        "div",
        {
          className: Or,
          "data-placement": m ? "outside" : "inside",
          children: [
            /* @__PURE__ */ P(
              "button",
              {
                type: "button",
                className: Xs,
                "data-copy-state": o,
                "aria-label": `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onPointerDown: (f) => f.stopPropagation(),
                onClick: u(e.itemId, a),
                children: o === "copied" ? "已复制编号" : e.itemId
              }
            ),
            i ? /* @__PURE__ */ P(
              "button",
              {
                type: "button",
                className: Ys,
                "data-copy-state": n,
                "aria-label": t === "translated" ? "复制这段译文" : "复制这段原文",
                onPointerDown: (f) => f.stopPropagation(),
                onClick: u(i, r),
                children: n === "copied" ? "已复制" : n === "failed" ? "复制失败" : d
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function ei(e, t) {
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
function ti(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const l = an(
      ei(e, a),
      n,
      r
    );
    l && o.push({
      itemId: a.item_id,
      translatedText: s.translated_text,
      status: s.status,
      kind: a.kind,
      sourceText: a.source_text,
      typography: a.typography,
      rect: l,
      changedAtSeq: t.changedAtSeqById.get(a.item_id) || 0,
      changedNow: t.changedAtSeqById.get(a.item_id) === t.lastEventSeq
    });
  }
  return o;
}
const ni = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', ri = 256, tt = /* @__PURE__ */ new Map();
function oi(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function ai(e) {
  const t = `${e || ""}`, { text: n, slots: r } = $o(t, { bareLatex: !0 }), o = oi(n), a = jo(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = tt.get(t);
  if (!s && (s = Uo(o, r), tt.set(t, s), tt.size > ri)) {
    const l = tt.keys().next().value;
    l !== void 0 && tt.delete(l);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function xt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Pe(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function si(e, t) {
  const n = e.typography, r = Pe(t) || 1, o = Pe(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), l = xt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, l * r)), c = Pe(n == null ? void 0 : n.fit_min_font_size_pt), u = Pe(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (c || 5.5) * r), m = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), f = o ? o * r : i, h = Pe(n == null ? void 0 : n.leading_em), p = [
    Pe(n == null ? void 0 : n.padding_top_pt) || 0,
    Pe(n == null ? void 0 : n.padding_right_pt) || 0,
    Pe(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Pe(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || ni,
    fontSizePx: Math.max(d, Math.min(m, f)),
    minFontSizePx: d,
    maxFontSizePx: m,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: h ? 1 + h : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (xt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : xt(e.kind) ? "center" : "justify",
    padding: p,
    exact: !!o
  };
}
function ii(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), l = (d) => {
    const m = s.get(d);
    if (m !== void 0) return m;
    const { width: f, height: h } = e(d), p = f <= t + 0.5 && h <= n + 0.5;
    return s.set(d, p), p;
  };
  let i = o, c = a, u = Math.min(r.requestedFontSizePx, c);
  if (l(u)) {
    if (!r.exact) {
      i = u;
      for (let d = 0; d < 6 && c > i; d += 1) {
        const m = (i + c) / 2;
        l(m) ? (u = m, i = m) : c = m;
      }
    }
  } else {
    c = u, u = i;
    for (let d = 0; d < 8 && c > i; d += 1) {
      const m = (i + c) / 2;
      l(m) ? (u = m, i = m) : c = m;
    }
  }
  return Math.max(o, u);
}
const ci = 512, nt = /* @__PURE__ */ new Map();
let Gt = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Gt += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Gt += 1;
}));
function li(e, t, n, r) {
  return [
    Gt,
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
function ui({ item: e, pageScale: t }) {
  const n = A(null), r = K(
    () => ai(e.translatedText),
    [e.translatedText]
  ), [o, a] = k(r.fallbackHtml), s = K(
    () => si(e, t),
    [e, t]
  );
  j(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((m) => {
      d && a(m);
    }), () => {
      d = !1;
    };
  }, [r]), De(() => {
    const d = n.current;
    if (!d) return;
    const [m, f, h, p] = s.padding, y = Math.max(1, e.rect.width - p - f), b = Math.max(1, e.rect.height - m - h), S = li(o, y, b, s);
    let w = nt.get(S);
    if (w === void 0 && (w = ii(
      (g) => (d.style.fontSize = `${g}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      y,
      b,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), nt.set(S, w), nt.size > ci)) {
      const g = nt.keys().next().value;
      g !== void 0 && nt.delete(g);
    }
    d.style.fontSize = `${w.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [l, i, c, u] = s.padding;
  return /* @__PURE__ */ P(
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": s.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${l}px ${i}px ${c}px ${u}px`
      },
      children: /* @__PURE__ */ P(
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
function di({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = K(
    () => ti(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ P(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ P(
        ui,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const fi = en(di), Ur = 1.414;
function mi({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  syncedMinHeight: a = 0,
  onMetrics: s,
  cachedAspect: l,
  onAspectChange: i,
  sentinelRef: c,
  regionHighlight: u = null,
  regionTargets: d = [],
  hoveredRegionId: m,
  onHoverRegion: f,
  liveTranslationLayout: h,
  liveTranslationPage: p,
  showLiveTranslation: y = r === "source"
}) {
  const b = A(l ?? Ur), [S, w] = k(b.current);
  j(() => {
    l != null && Math.abs(l - b.current) >= 1e-3 && (b.current = l, w(l));
  }, [l]);
  const g = A(c);
  g.current = c;
  const v = A((F) => {
    var z;
    (z = g.current) == null || z.call(g, F);
  }).current, M = Math.max(120, Math.floor(t * S)), _ = Math.max(M, Math.ceil(a || 0)), x = an(u, t, M), D = K(
    () => Ks(d, t, M),
    [M, d, t]
  ), [N, R] = k(null), T = typeof f == "function", I = T ? m ?? null : N, E = (F) => {
    T ? F !== (m ?? null) && (f == null || f(F)) : R((z) => z === F ? z : F);
  }, O = K(
    () => D.find((F) => F.itemId === I) || null,
    [I, D]
  ), C = (F) => {
    var X, ee;
    if (F.pointerType === "touch") return;
    if (F.buttons !== 0) {
      E(null);
      return;
    }
    if ((ee = (X = F.target) == null ? void 0 : X.closest) != null && ee.call(X, `.${Or}`)) return;
    const z = F.currentTarget.getBoundingClientRect(), B = F.clientX - z.left, Q = F.clientY - z.top, te = O == null ? void 0 : O.rect;
    if (te && jr(te) && B >= te.left - 4 && B <= te.left + $r && Q >= te.top - Fr && Q <= te.top) return;
    const re = Wn(D, B, Q);
    E((re == null ? void 0 : re.itemId) || null);
  }, V = (F) => {
    if (F.pointerType === "mouse") return;
    const z = F.currentTarget.getBoundingClientRect(), B = Wn(
      D,
      F.clientX - z.left,
      F.clientY - z.top
    );
    E((B == null ? void 0 : B.itemId) || null);
  }, J = (F) => {
    !Number.isFinite(F) || F <= 0 || Math.abs(b.current - F) < 1e-3 || (b.current = F, w(F), i == null || i(e, F));
  };
  return /* @__PURE__ */ U(
    "div",
    {
      ref: v,
      [Ge]: e,
      [st]: r,
      [cn]: M,
      className: ln,
      onPointerMoveCapture: C,
      onPointerDown: V,
      onPointerLeave: (F) => {
        F.pointerType === "mouse" && E(null);
      },
      style: {
        width: t,
        height: _,
        minHeight: _
      },
      children: [
        o ? /* @__PURE__ */ P(
          Oo,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: !0,
            renderAnnotationLayer: !1,
            className: Rr,
            loading: /* @__PURE__ */ P(
              "div",
              {
                className: Rt,
                style: { width: t, height: M }
              }
            ),
            onLoadSuccess: (F) => {
              try {
                const z = F.getViewport({ scale: 1 });
                if (z.width > 0) {
                  const B = z.height / z.width;
                  J(B);
                }
              } catch {
              }
              s == null || s();
            },
            onRenderSuccess: () => {
              s == null || s();
            }
          }
        ) : /* @__PURE__ */ P(
          "div",
          {
            className: Rt,
            style: { width: t, height: M },
            "aria-hidden": !0
          }
        ),
        x ? /* @__PURE__ */ P(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: x,
            "aria-hidden": "true"
          }
        ) : null,
        o && y ? /* @__PURE__ */ P(
          fi,
          {
            layoutPage: h,
            pageState: p,
            width: t,
            height: M
          }
        ) : null,
        /* @__PURE__ */ P(
          Qs,
          {
            target: o ? O : null,
            pane: r === "translated" ? "translated" : "source"
          }
        )
      ]
    }
  );
}
const hi = en(mi), Ot = 5, pi = "120% 0px", gi = 120;
let Vn = 1;
const Jn = /* @__PURE__ */ new WeakMap();
function bi(e) {
  if (!e) return 0;
  const t = Jn.get(e);
  if (t) return t;
  const n = Vn;
  return Vn += 1, Jn.set(e, n), n;
}
function yi() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const vi = uo(
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: o = 1,
    visible: a = !0,
    emptyLabel: s = "暂无 PDF",
    scrollRoot: l = null,
    pageWidthOverride: i = null,
    rowHeights: c,
    onMetrics: u,
    onLoadSuccess: d,
    onLoadError: m,
    onNumPagesChange: f,
    activeRegion: h = null,
    regions: p = [],
    readerMetadata: y = null,
    hoveredRegionId: b = null,
    onHoverRegion: S,
    liveTranslation: w,
    showLiveTranslation: g = t === "source",
    liveTranslationPendingLabel: v = "",
    paneAction: M
  }, _) {
    qs();
    const { file: x, loading: D, error: N } = ba(n, r), R = `${n}\0${bi(x)}`, T = A(R);
    T.current = R;
    const I = K(
      () => ha(x),
      [x, n]
    ), [E, O] = k(0), [C, V] = k(""), [J, F] = k(null), [z, B] = k(480), Q = A(null), te = A(0), re = K(() => yi(), []), X = K(() => ({
      cMapUrl: at().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: at().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    tn(_, () => J, [J]), j(() => {
      const L = (q) => {
        te.current = q, B(q);
      }, W = (q) => {
        const Y = Ba(q, te.current);
        if (Y !== "ignore") {
          if (Q.current && clearTimeout(Q.current), Y === "immediate") {
            L(q);
            return;
          }
          Q.current = setTimeout(() => L(q), Ha);
        }
      }, H = !!(i && i >= 80);
      W(H ? i : (l == null ? void 0 : l.clientWidth) || 0);
      const oe = !H && l && typeof ResizeObserver < "u" ? new ResizeObserver((q) => {
        var Y, ie;
        W(((ie = (Y = q[0]) == null ? void 0 : Y.contentRect) == null ? void 0 : ie.width) ?? l.clientWidth);
      }) : null;
      return oe && l && oe.observe(l), () => {
        oe == null || oe.disconnect(), Q.current && clearTimeout(Q.current);
      };
    }, [i, l, a]);
    const ee = K(
      () => $a(z, o),
      [z, o]
    ), [ve, Oe] = k(() => /* @__PURE__ */ new Map()), [Ee, mt] = k(() => /* @__PURE__ */ new Set()), [_t, ne] = k(() => /* @__PURE__ */ new Set()), ae = A(/* @__PURE__ */ new Map()), se = A(null), ue = A(/* @__PURE__ */ new Map()), de = $((L, W) => {
      Oe((H) => {
        if (H.get(L) === W) return H;
        const G = new Map(H);
        return G.set(L, W), G;
      });
    }, []), ce = $((L, W) => {
      const H = ae.current, G = H.get(L);
      if (G && se.current)
        try {
          se.current.unobserve(G);
        } catch {
        }
      if (W) {
        if (H.set(L, W), se.current)
          try {
            se.current.observe(W);
          } catch {
          }
      } else
        H.delete(L);
    }, []), Fe = A(/* @__PURE__ */ new Map()), $e = $((L) => {
      const W = Fe.current;
      let H = W.get(L);
      return H || (H = (G) => ce(L, G), W.set(L, H)), H;
    }, [ce]);
    j(() => {
      if (typeof IntersectionObserver > "u") return;
      const L = ue.current, W = new IntersectionObserver(
        (H) => {
          const G = [], oe = [];
          for (const q of H) {
            const Y = q.target, ie = un(Y);
            Number.isFinite(ie) && (q.isIntersecting ? G : oe).push(ie);
          }
          if ((G.length || oe.length) && mt((q) => {
            let Y = null;
            for (const ie of G)
              q.has(ie) || (Y = Y || new Set(q), Y.add(ie));
            for (const ie of oe)
              q.has(ie) && (Y = Y || new Set(q), Y.delete(ie));
            return Y || q;
          }), G.length) {
            for (const q of G) {
              const Y = L.get(q);
              Y && (clearTimeout(Y), L.delete(q));
            }
            ne((q) => {
              let Y = null;
              for (const ie of G)
                q.has(ie) || (Y = Y || new Set(q), Y.add(ie));
              return Y || q;
            });
          }
          for (const q of oe)
            L.has(q) || L.set(q, setTimeout(() => {
              L.delete(q), ne((Y) => {
                if (!Y.has(q)) return Y;
                const ie = new Set(Y);
                return ie.delete(q), ie;
              });
            }, gi));
        },
        { root: l, rootMargin: pi, threshold: 0 }
      );
      se.current = W;
      for (const H of ae.current.values())
        try {
          W.observe(H);
        } catch {
        }
      return () => {
        W.disconnect(), se.current === W && (se.current = null);
        for (const H of L.values()) clearTimeout(H);
        L.clear();
      };
    }, [l]), De(() => {
      O(0), V(""), mt(/* @__PURE__ */ new Set()), ne(/* @__PURE__ */ new Set()), Oe(/* @__PURE__ */ new Map()), ae.current.clear();
      const L = ue.current;
      for (const W of L.values()) clearTimeout(W);
      L.clear(), f == null || f(0, t);
    }, [R, f, t]);
    const Ye = $(
      ({ numPages: L }) => {
        T.current === R && (O(L), V(""), f == null || f(L, t), d == null || d({ numPages: L, pane: t }));
      },
      [R, d, f, t]
    ), Lt = $(
      (L) => {
        if (T.current !== R) return;
        const W = (L == null ? void 0 : L.message) || "PDF 解析失败";
        V(W), O(0), f == null || f(0, t), m == null || m(L, t);
      },
      [R, m, f, t]
    ), Me = K(
      () => E > 0 ? Array.from({ length: E }, (L, W) => W + 1) : [],
      [E]
    );
    j(() => {
      typeof IntersectionObserver < "u" || ne(new Set(Me));
    }, [Me]);
    const Ae = K(
      () => Nn(h, y, t),
      [h, y, t]
    ), _e = K(() => {
      const L = /* @__PURE__ */ new Map();
      for (const W of p) {
        const H = Nn(W, y, t);
        if (!H) continue;
        const G = L.get(H.box.page) || [];
        G.push(H), L.set(H.box.page, G);
      }
      return L;
    }, [t, y, p]), Xe = K(() => {
      const L = /* @__PURE__ */ new Set();
      if (!b) return L;
      for (const [W, H] of _e)
        H.some((G) => G.itemId === b) && L.add(W);
      return L;
    }, [b, _e]), ht = K(() => {
      if (E === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!l && typeof IntersectionObserver < "u")) return new Set(Me);
      if (Ee.size === 0) {
        const H = Math.min(E, Ot * 2 + 1);
        return new Set(Array.from({ length: H }, (G, oe) => oe + 1));
      }
      const W = /* @__PURE__ */ new Set();
      for (const H of Ee)
        for (let G = -Ot; G <= Ot; G++) {
          const oe = H + G;
          oe >= 1 && oe <= E && W.add(oe);
        }
      return W;
    }, [E, Me, l, a, Ee]), pt = !n || !!N || !!C, je = n && (N || C) || s;
    return /* @__PURE__ */ U(
      "section",
      {
        ref: F,
        className: `reader-panel ${ka}${a ? "" : " is-hidden"}`,
        [st]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (w == null ? void 0 : w.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          M ? /* @__PURE__ */ P("div", { className: "reader-react-pdf-pane-action", children: M }) : null,
          v ? /* @__PURE__ */ U("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ P("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ P("span", { children: v })
          ] }) : null,
          pt && !D ? /* @__PURE__ */ P("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: je }) : null,
          D ? /* @__PURE__ */ P("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          I && !N ? /* @__PURE__ */ P("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ P(
            Fo,
            {
              file: I,
              loading: null,
              error: null,
              options: X,
              onLoadSuccess: Ye,
              onLoadError: Lt,
              className: "reader-react-pdf-document",
              children: Me.map((L) => {
                if (ht.has(L))
                  return /* @__PURE__ */ P(
                    hi,
                    {
                      pane: t,
                      pageNumber: L,
                      width: ee,
                      devicePixelRatio: re,
                      active: _t.has(L),
                      syncedMinHeight: (c == null ? void 0 : c.get(L)) || 0,
                      onMetrics: u,
                      cachedAspect: ve.get(L),
                      onAspectChange: de,
                      sentinelRef: $e(L),
                      regionHighlight: (Ae == null ? void 0 : Ae.box.page) === L ? Ae : null,
                      regionTargets: _e.get(L),
                      hoveredRegionId: b && Xe.has(L) ? b : null,
                      onHoverRegion: S,
                      liveTranslationLayout: w == null ? void 0 : w.layoutByPage.get(L - 1),
                      liveTranslationPage: w == null ? void 0 : w.pagesByPage.get(L - 1),
                      showLiveTranslation: g
                    },
                    `${t}-${L}`
                  );
                const H = ve.get(L) ?? Ur, G = Math.max(120, Math.floor(ee * H)), oe = Math.max(G, Math.ceil((c == null ? void 0 : c.get(L)) || 0));
                return /* @__PURE__ */ P(
                  "div",
                  {
                    ref: $e(L),
                    [Ge]: L,
                    [st]: t,
                    [cn]: G,
                    className: ln,
                    style: {
                      width: ee,
                      height: oe,
                      minHeight: oe
                    },
                    children: /* @__PURE__ */ P(
                      "div",
                      {
                        className: Rt,
                        style: { width: ee, height: G },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${L}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), qn = en(vi), Br = nn(null), Hr = nn(null);
function Si({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ P(Br.Provider, { value: e, children: /* @__PURE__ */ P(Hr.Provider, { value: t, children: n }) });
}
function ft() {
  return rn(Br);
}
function wi() {
  return rn(Hr);
}
const Pi = () => () => {
}, Gn = () => null;
function Ri({
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
function Ii(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Ti(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Ei(e) {
  const t = ft(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", l = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), m = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, f = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? dt, h = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, p = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, b = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, w = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", g = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", v = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, M = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, _ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), x = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), D = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), N = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [I, E] = k(null), O = hr(
    T ? T.subscribe : Pi,
    T ? () => T.get().itemId : Gn,
    T ? () => T.get().itemId : Gn
  ), C = T ? O : I, V = $((B) => {
    T ? T.set(B, "pdf") : E(B);
  }, [T]), J = Ri({
    mode: s,
    compareMode: l,
    showSource: i,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: u
  }), z = Number.isFinite(h) && h > 0 ? Ii(
    h,
    n || r,
    typeof document > "u" ? h * 2 : document.documentElement.clientWidth
  ) : null;
  return /* @__PURE__ */ P(
    "div",
    {
      ref: d,
      className: La,
      "data-reader-region-count": N.length,
      "data-reader-structured-region-count": N.filter(Eo).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ U(
        "main",
        {
          className: `${_a} reader-mode-${J.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            y ? /* @__PURE__ */ P(
              qn,
              {
                pane: "source",
                url: w,
                preloadedFile: v,
                userZoom: f,
                visible: J.showSource,
                scrollRoot: m,
                pageWidthOverride: z,
                rowHeights: J.compareMode ? p : void 0,
                onMetrics: _,
                emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: x,
                activeRegion: D,
                regions: N,
                readerMetadata: R,
                hoveredRegionId: C,
                onHoverRegion: V,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? Ti(o) : "",
                paneAction: u ? /* @__PURE__ */ U(Qt, { children: [
                  e.sourcePaneAction,
                  /* @__PURE__ */ P(
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
            b ? /* @__PURE__ */ P(
              qn,
              {
                pane: "translated",
                url: g,
                preloadedFile: M,
                userZoom: f,
                visible: J.showTranslated,
                scrollRoot: m,
                pageWidthOverride: z,
                rowHeights: J.compareMode ? p : void 0,
                onMetrics: _,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: x,
                activeRegion: D,
                regions: N,
                readerMetadata: R,
                hoveredRegionId: C,
                onHoverRegion: V,
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
const Mi = [
  { id: "source", label: "源文件", Icon: yr },
  { id: "compare", label: "对照", Icon: vr },
  { id: "translated", label: "翻译文件", Icon: Sr }
];
function Ai(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function _i(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Li(e) {
  const t = ft(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? Ai(a.state) : "";
  return /* @__PURE__ */ U("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ U(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || l,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ P(Lo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ P("span", { className: "reader-live-translation-toggle-label", children: l })
        ]
      }
    ) : null,
    /* @__PURE__ */ P("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Mi.map(({ id: i, label: c, Icon: u }) => {
      const d = n === i, m = _i({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ U(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${d ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": d,
          "aria-label": c,
          title: m ? `${c} 需要文档任务` : c,
          disabled: m,
          onClick: () => o(i),
          children: [
            /* @__PURE__ */ P(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ P("span", { className: "reader-workspace-tab-label", children: c })
          ]
        },
        i
      );
    }) })
  ] });
}
const ki = {
  markdown: { label: "Markdown", short: "MD", Icon: ko, needsJob: !0 }
}, Ni = Er.map(
  (e) => ({ id: e, ...ki[e] })
), Ci = {
  // 这个面板叫「AI」而不是「终端」：它是阅读页里**唯一**的 AI 入口。
  //
  // 原来一篇文档有三扇 AI 的门 —— AI 问答面板（自带一套 chunking + retrieval +
  // LLM 的 Rust 栈）、这个终端（agent 进程）、阅读地图（渲染 agent 产物）——
  // 三者互不知道对方存在，两套 LLM 栈零共用代码。15 本书上的用量是
  // 4 / 17 / 1，留用得最多且能力是超集的那个。
  //
  // id 仍是 terminal：改 id 会让所有存着的面板恢复记录失效。
  terminal: {
    label: "AI",
    short: "AI",
    Icon: No,
    adapterKey: "renderReaderTerminal",
    slot: "terminal",
    ariaLabel: "AI（agent 终端）",
    keepMounted: !0
  }
}, Wr = Mr.map(
  (e) => ({ id: e, ...Ci[e] })
);
function Di(e) {
  return [
    ...Ni.map(({ id: t, label: n, short: r, Icon: o, needsJob: a }) => ({
      id: t,
      label: n,
      short: r,
      Icon: o,
      needsJob: a
    })),
    ...Wr.filter((t) => e(t.adapterKey)).map(({ id: t, label: n, short: r, Icon: o }) => ({
      id: t,
      label: n,
      short: r,
      Icon: o,
      needsJob: !1
    }))
  ];
}
function zi() {
  const e = me();
  return Di((t) => typeof (e == null ? void 0 : e[t]) == "function");
}
function xi(e) {
  const t = ft(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), l = zi();
  return n ? /* @__PURE__ */ U("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ P("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: l.map(({ id: i, label: c, Icon: u, needsJob: d }) => {
      const m = n === i, f = d && o, h = r == null ? void 0 : r[i];
      return /* @__PURE__ */ U(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": m,
          className: `reader-assistant-dock-tab${m ? " is-active" : ""}`,
          title: f ? `${c} 需打开任务阅读` : c,
          disabled: f,
          onClick: () => a(i),
          children: [
            /* @__PURE__ */ P(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
            /* @__PURE__ */ P("span", { className: "reader-assistant-dock-tab-label", children: c }),
            h ? /* @__PURE__ */ P("span", { className: "reader-assistant-dock-badge", children: h }) : null
          ]
        },
        i
      );
    }) }),
    /* @__PURE__ */ P(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ P(br, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ P("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: l.map(({ id: i, label: c, short: u, Icon: d, needsJob: m }) => {
    const f = m && o, h = r == null ? void 0 : r[i];
    return /* @__PURE__ */ U(
      "button",
      {
        type: "button",
        className: "reader-assistant-rail-button",
        "aria-label": `打开${c}`,
        title: f ? `${c} 需打开任务阅读` : c,
        disabled: f,
        onClick: () => a(i),
        children: [
          /* @__PURE__ */ P(d, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
          /* @__PURE__ */ P("span", { children: u }),
          h ? /* @__PURE__ */ P("span", { className: "reader-assistant-dock-badge", children: h }) : null
        ]
      },
      i
    );
  }) });
}
function Oi(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Fi(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function $i(e) {
  return e / 100 * window.innerHeight;
}
function ji(e) {
  return e / 100 * window.innerWidth;
}
function Ui(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function rt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Ui(n);
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
      r = Fi(t, o);
      break;
    }
    case "em": {
      r = Oi(t, o);
      break;
    }
    case "vh": {
      r = $i(o);
      break;
    }
    case "vw": {
      r = ji(o);
      break;
    }
  }
  return r;
}
function fe(e) {
  return parseFloat(e.toFixed(3));
}
function Ke({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Kt(e) {
  const { panels: t } = e, n = Ke({ group: e });
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
      const u = rt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = fe(u / n * 100);
    }
    let l;
    if (a.defaultSize !== void 0) {
      const u = rt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      l = fe(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = rt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = fe(u / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const u = rt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = fe(u / n * 100);
    }
    return {
      groupResizeBehavior: a.groupResizeBehavior,
      collapsedSize: s,
      collapsible: a.collapsible === !0,
      defaultSize: l,
      disabled: a.disabled,
      minSize: i,
      maxSize: c,
      panelId: r.id
    };
  });
}
function Z(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Zt(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Bi : Hi
  );
}
function Bi(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Hi(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Vr(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Jr(e, t) {
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
function Wi({
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
    const { x: l, y: i } = Jr(r, s), c = e === "horizontal" ? l : i;
    c < a && (a = c, o = s);
  }
  return Z(o, "No rect found"), o;
}
let yt;
function Vi() {
  return yt === void 0 && (typeof matchMedia == "function" ? yt = !!matchMedia("(pointer:coarse)").matches : yt = !1), yt;
}
function qr(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Zt(
    n,
    Array.from(t.children).filter(Vr).map((h) => ({ element: h }))
  ).map(({ element: h }) => h), s = [];
  let l = !1, i = !1, c = -1, u = -1, d = 0, m, f = [];
  {
    let h = -1;
    for (const p of a)
      p.hasAttribute("data-panel") && (h++, p.hasAttribute("data-disabled") || (d++, c === -1 && (c = h), u = h));
  }
  if (d > 1) {
    let h = -1;
    for (const p of a)
      if (p.hasAttribute("data-panel")) {
        h++;
        const y = r.find(
          (b) => b.element === p
        );
        if (y) {
          if (m) {
            const b = m.element.getBoundingClientRect(), S = p.getBoundingClientRect();
            let w;
            if (i) {
              const g = n === "horizontal" ? new DOMRect(
                b.right,
                b.top,
                0,
                b.height
              ) : new DOMRect(
                b.left,
                b.bottom,
                b.width,
                0
              ), v = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (f.length) {
                case 0: {
                  w = [
                    g,
                    v
                  ];
                  break;
                }
                case 1: {
                  const M = f[0], _ = Wi({
                    orientation: n,
                    rects: [b, S],
                    targetRect: M.element.getBoundingClientRect()
                  });
                  w = [
                    M,
                    _ === b ? v : g
                  ];
                  break;
                }
                default: {
                  w = f;
                  break;
                }
              }
            } else
              f.length ? w = f : w = [
                n === "horizontal" ? new DOMRect(
                  b.right,
                  S.top,
                  S.left - b.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  b.bottom,
                  S.width,
                  S.top - b.bottom
                )
              ];
            for (const g of w) {
              let v = "width" in g ? g : g.element.getBoundingClientRect();
              const M = Vi() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (v.width < M) {
                const x = M - v.width;
                v = new DOMRect(
                  v.x - x / 2,
                  v.y,
                  v.width + x,
                  v.height
                );
              }
              if (v.height < M) {
                const x = M - v.height;
                v = new DOMRect(
                  v.x,
                  v.y - x / 2,
                  v.width,
                  v.height + x
                );
              }
              const _ = h <= c || h > u;
              !l && !_ && s.push({
                group: e,
                groupSize: Ke({ group: e }),
                panels: [m, y],
                separator: "width" in g ? void 0 : g,
                rect: v
              }), l = !1;
            }
          }
          i = !1, m = y, f = [];
        }
      } else if (p.hasAttribute("data-separator")) {
        p.ariaDisabled !== null && (l = !0);
        const y = o.find(
          (b) => b.element === p
        );
        y ? f.push(y) : (m = void 0, f = []);
      } else
        i = !0;
  }
  return s;
}
var Ie;
class Gr {
  constructor() {
    _n(this, Ie, {});
  }
  addListener(t, n) {
    const r = Qe(this, Ie)[t];
    return r === void 0 ? Qe(this, Ie)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Qe(this, Ie)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let o = !1, a = null;
        const s = Array.from(r);
        for (let l = 0; l < s.length; l++) {
          const i = s[l];
          try {
            i.call(null, n);
          } catch (c) {
            a === null && (o = !0, a = c);
          }
        }
        if (o)
          throw a;
      }
  }
  removeAllListeners() {
    Ln(this, Ie, {});
  }
  removeListener(t, n) {
    const r = Qe(this, Ie)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ie = new WeakMap();
let Je = {
  cursorFlags: 0,
  state: "inactive"
};
const hn = new Gr();
function ke() {
  return Je;
}
function Ji(e) {
  return hn.addListener("change", e);
}
function qi(e) {
  const t = Je, n = { ...Je };
  n.cursorFlags = e, Je = n, hn.emit("change", {
    prev: t,
    next: n
  });
}
function qe(e) {
  const t = Je;
  Je = e, hn.emit("change", {
    prev: t,
    next: e
  });
}
const Gi = (e) => e, Ft = () => {
}, Kr = 1, Zr = 2, Yr = 4, Xr = 8, Kn = 3, Zn = 12;
let vt;
function Yn() {
  return vt === void 0 && (vt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (vt = !0)), vt;
}
function Ki({
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
        if (e && Yn()) {
          const a = (e & Kr) !== 0, s = (e & Zr) !== 0, l = (e & Yr) !== 0, i = (e & Xr) !== 0;
          if (a)
            return l ? "se-resize" : i ? "ne-resize" : "e-resize";
          if (s)
            return l ? "sw-resize" : i ? "nw-resize" : "w-resize";
          if (l)
            return "s-resize";
          if (i)
            return "n-resize";
        }
        break;
      }
    }
    return Yn() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Xn = /* @__PURE__ */ new WeakMap();
function pn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Xn.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = ke();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Ki({
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
  Xn.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let be = /* @__PURE__ */ new Map();
const Qr = new Gr();
function Zi(e) {
  be = new Map(be), be.delete(e);
}
function Qn(e, t) {
  for (const [n] of be)
    if (n.id === e)
      return n;
}
function Te(e, t) {
  for (const [n, r] of be)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function ze() {
  return be;
}
function gn(e, t) {
  return Qr.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Re(e, t, n) {
  const r = be.get(e);
  be = new Map(be), be.set(e, t), Qr.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function eo(e) {
  const t = ke();
  let n = !1;
  switch (t.state) {
    case "active":
      qe({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (pn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Te(r.group.id, !0);
        Re(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function er(e) {
  e.defaultPrevented || eo(e.currentTarget);
}
function Yi(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Jr(n, a.rect);
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
function Xi(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Qi(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: rr(e),
    b: rr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  Z(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: nr(tr(n.a)),
    b: nr(tr(n.b))
  };
  if (o.a === o.b) {
    const a = r.childNodes, s = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let l = a.length;
    for (; l--; ) {
      const i = a[l];
      if (i === s.a) return 1;
      if (i === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
const ec = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function tc(e) {
  const t = getComputedStyle(to(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function nc(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || tc(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || ec.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function tr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (Z(n, "Missing node"), nc(n)) return n;
  }
  return null;
}
function nr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function rr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = to(e);
  return t;
}
function to(e) {
  const { parentNode: t } = e;
  return Xi(t) ? t.host : t;
}
function rc(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function oc({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Vr(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Qi(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (rc(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function bn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = qr(o), s = Yi(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && oc({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function ac(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function le(e, t, n = 0) {
  return Math.abs(fe(e) - fe(t)) <= n;
}
function ge(e, t) {
  return le(e, t) ? 0 : e > t ? 1 : -1;
}
function We({
  overrideDisabledPanels: e,
  panelConstraints: t,
  prevSize: n,
  size: r
}) {
  const {
    collapsedSize: o = 0,
    collapsible: a,
    disabled: s,
    maxSize: l = 100,
    minSize: i = 0
  } = t;
  if (s && !e)
    return n;
  if (ge(r, i) < 0)
    if (a) {
      const c = (o + i) / 2;
      ge(r, c) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(l, r), r = fe(r), r;
}
function ct({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (le(e, 0))
    return t;
  const s = a === "imperative-api", l = Object.values(t), i = Object.values(o), c = [...l], [u, d] = r;
  Z(u != null, "Invalid first pivot index"), Z(d != null, "Invalid second pivot index");
  let m = 0;
  switch (a) {
    case "keyboard": {
      {
        const p = e < 0 ? d : u, y = n[p];
        Z(
          y,
          `Panel constraints not found for index ${p}`
        );
        const {
          collapsedSize: b = 0,
          collapsible: S,
          minSize: w = 0
        } = y;
        if (S) {
          const g = l[p];
          if (Z(
            g != null,
            `Previous layout not found for panel index ${p}`
          ), le(g, b)) {
            const v = w - g;
            ge(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      {
        const p = e < 0 ? u : d, y = n[p];
        Z(
          y,
          `No panel constraints found for index ${p}`
        );
        const {
          collapsedSize: b = 0,
          collapsible: S,
          minSize: w = 0
        } = y;
        if (S) {
          const g = l[p];
          if (Z(
            g != null,
            `Previous layout not found for panel index ${p}`
          ), le(g, w)) {
            const v = g - b;
            ge(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      break;
    }
    default: {
      const p = e < 0 ? d : u, y = n[p];
      Z(
        y,
        `Panel constraints not found for index ${p}`
      );
      const b = l[p], { collapsible: S, collapsedSize: w, minSize: g } = y;
      if (S && ge(b, g) < 0)
        if (e > 0) {
          const v = g - w, M = v / 2, _ = b + e;
          ge(_, g) < 0 && (e = ge(e, M) <= 0 ? 0 : v);
        } else {
          const v = g - w, M = 100 - v / 2, _ = b - e;
          ge(_, g) < 0 && (e = ge(100 + e, M) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const p = e < 0 ? 1 : -1;
    let y = e < 0 ? d : u, b = 0;
    for (; ; ) {
      const w = l[y];
      Z(
        w != null,
        `Previous layout not found for panel index ${y}`
      );
      const g = We({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: w,
        size: 100
      }) - w;
      if (b += g, y += p, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(b));
    e = e < 0 ? 0 - S : S;
  }
  {
    let p = e < 0 ? u : d;
    for (; p >= 0 && p < n.length; ) {
      const y = Math.abs(e) - Math.abs(m), b = l[p];
      Z(
        b != null,
        `Previous layout not found for panel index ${p}`
      );
      const S = b - y, w = We({
        overrideDisabledPanels: s,
        panelConstraints: n[p],
        prevSize: b,
        size: S
      });
      if (!le(b, w) && (m += b - w, c[p] = w, m.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? p-- : p++;
    }
  }
  if (ac(i, c))
    return o;
  {
    const p = e < 0 ? d : u, y = l[p];
    Z(
      y != null,
      `Previous layout not found for panel index ${p}`
    );
    const b = y + m, S = We({
      overrideDisabledPanels: s,
      panelConstraints: n[p],
      prevSize: y,
      size: b
    });
    if (c[p] = S, !le(S, b)) {
      let w = b - S, g = e < 0 ? d : u;
      for (; g >= 0 && g < n.length; ) {
        const v = c[g];
        Z(
          v != null,
          `Previous layout not found for panel index ${g}`
        );
        const M = v + w, _ = We({
          overrideDisabledPanels: s,
          panelConstraints: n[g],
          prevSize: v,
          size: M
        });
        if (le(v, _) || (w -= _ - v, c[g] = _), le(w, 0))
          break;
        e > 0 ? g-- : g++;
      }
    }
  }
  const f = Object.values(c).reduce(
    (p, y) => y + p,
    0
  );
  if (!le(f, 100, 0.1))
    return o;
  const h = Object.keys(o);
  return c.reduce((p, y, b) => (p[h[b]] = y, p), {});
}
function Ne(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || ge(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Ce({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], o = r.reduce(
    (l, i) => l + i,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((l) => `${l}%`).join(", ")}`
    );
  if (!le(o, 100) && r.length > 0)
    for (let l = 0; l < t.length; l++) {
      const i = r[l];
      Z(i != null, `No layout data found for index ${l}`);
      const c = 100 / o * i;
      r[l] = c;
    }
  let a = 0;
  for (let l = 0; l < t.length; l++) {
    const i = n[l];
    Z(i != null, `No layout data found for index ${l}`);
    const c = r[l];
    Z(c != null, `No layout data found for index ${l}`);
    const u = We({
      overrideDisabledPanels: !0,
      panelConstraints: t[l],
      prevSize: i,
      size: c
    });
    c != u && (a += c - u, r[l] = u);
  }
  if (!le(a, 0))
    for (let l = 0; l < t.length; l++) {
      const i = r[l];
      Z(i != null, `No layout data found for index ${l}`);
      const c = i + a, u = We({
        overrideDisabledPanels: !0,
        panelConstraints: t[l],
        prevSize: i,
        size: c
      });
      if (i !== u && (a -= u - i, r[l] = u, le(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((l, i, c) => (l[s[c]] = i, l), {});
}
function no({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = ze();
    for (const [
      c,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: d,
        layout: m,
        groupSize: f,
        separatorToPanels: h
      }
    ] of i)
      if (c.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: d,
          group: c,
          groupSize: f,
          layout: m,
          separatorToPanels: h
        };
    throw Error(`Group ${e} not found`);
  }, r = () => {
    const i = n().derivedPanelConstraints.find(
      (c) => c.panelId === t
    );
    if (i !== void 0)
      return i;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, o = () => {
    const i = n().group.panels.find((c) => c.id === t);
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
    panels: c,
    prevLayout: u,
    derivedPanelConstraints: d
  }) => {
    const m = a(), f = c.findIndex((y) => y.id === t), h = f === 0, p = f === c.length - 1;
    if (p && i < m && (h || c.slice(0, f).every((y, b) => {
      const S = d[b];
      return (S == null ? void 0 : S.collapsible) && le(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = c.slice(0, f).reduce((b, S) => b + u[S.id], 0);
      return {
        ...u,
        [t]: fe(100 - y)
      };
    }
    return ct({
      delta: p ? m - i : i - m,
      initialLayout: u,
      panelConstraints: d,
      pivotIndices: p ? [f - 1, f] : [f, f + 1],
      prevLayout: u,
      trigger: "imperative-api"
    });
  }, l = (i) => {
    const c = a();
    if (i === c)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      group: m,
      groupSize: f,
      layout: h,
      separatorToPanels: p
    } = n(), y = s({
      nextSize: i,
      panels: m.panels,
      prevLayout: h,
      derivedPanelConstraints: d
    }), b = Ce({
      layout: y,
      panelConstraints: d
    });
    Ne(h, b) || Re(m, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: f,
      layout: b,
      separatorToPanels: p
    });
  };
  return {
    collapse: () => {
      const { collapsible: i, collapsedSize: c } = r(), { mutableValues: u } = o(), d = a();
      i && d !== c && (u.expandToSize = d, l(c));
    },
    expand: () => {
      const { collapsible: i, collapsedSize: c, minSize: u } = r(), { mutableValues: d } = o(), m = a();
      if (i && m === c) {
        let f = d.expandToSize ?? u;
        f === 0 && (f = 1), l(f);
      }
    },
    getSize: () => {
      const { group: i } = n(), c = a(), { element: u } = o(), d = i.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: c,
        inPixels: d
      };
    },
    isCollapsed: () => {
      const { collapsible: i, collapsedSize: c } = r(), u = a();
      return i && le(c, u);
    },
    resize: (i) => {
      const { group: c } = n(), { element: u } = o(), d = Ke({ group: c }), m = rt({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), f = fe(m / d * 100);
      l(f);
    }
  };
}
function or(e) {
  if (e.defaultPrevented)
    return;
  const t = ze();
  bn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = no({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function St(e) {
  const t = ze();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function ro({
  groupId: e
}) {
  const t = () => {
    const n = ze();
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
        layout: l,
        separatorToPanels: i
      } = t(), c = Ce({
        layout: n,
        panelConstraints: o
      });
      return r ? l : (Ne(l, c) || Re(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: i
      }), c);
    }
  };
}
function Le(e, t) {
  const n = St(e), r = Te(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  Z(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  Z(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), l = ro({ groupId: n.id }).getLayout(), i = ct({
    delta: t,
    initialLayout: l,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: l,
    trigger: "keyboard"
  }), c = Ce({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  Ne(l, c) || Re(
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
function ar(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = St(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && Le(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Le(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Le(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Le(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Le(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = St(t), o = Te(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: l } = o, i = r.separators.find(
          (m) => m.element === t
        );
        Z(i, "Matching separator not found");
        const c = l.get(i);
        Z(c, "Matching panels not found");
        const u = c[0], d = a.find(
          (m) => m.panelId === u.id
        );
        if (Z(d, "Panel metadata not found"), d.collapsible) {
          const m = s[u.id], f = d.collapsedSize === m ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          Le(t, f - m);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = St(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        Z(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), Le(t, -100);
        break;
      }
    }
}
function sr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = ze(), n = bn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), qe({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function oo({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: o,
  pointerDownAtPoint: a,
  prevCursorFlags: s
}) {
  let l = 0;
  n.forEach((c) => {
    const { group: u, groupSize: d } = c, { orientation: m, panels: f } = u, { disableCursor: h } = u.mutableState;
    let p = 0;
    a ? m === "horizontal" ? p = (t.clientX - a.x) / d * 100 : p = (t.clientY - a.y) / d * 100 : m === "horizontal" ? p = t.clientX < 0 ? -100 : 100 : p = t.clientY < 0 ? -100 : 100;
    const y = r.get(u), b = o.get(u);
    if (!y || !b)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: w,
      groupSize: g,
      layout: v,
      separatorToPanels: M
    } = b;
    if (w && v && M) {
      const _ = ct({
        delta: p,
        initialLayout: y,
        panelConstraints: w,
        pivotIndices: c.panels.map((x) => f.indexOf(x)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (Ne(_, v)) {
        if (p !== 0 && !h)
          switch (m) {
            case "horizontal": {
              l |= p < 0 ? Kr : Zr;
              break;
            }
            case "vertical": {
              l |= p < 0 ? Yr : Xr;
              break;
            }
          }
      } else
        Re(c.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: w,
          groupSize: g,
          layout: _,
          separatorToPanels: M
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & Kn : i |= l & Kn, t.movementY === 0 ? i |= s & Zn : i |= l & Zn, qi(i), pn(e);
}
function ir(e) {
  const t = ze(), n = ke();
  switch (n.state) {
    case "active":
      oo({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function cr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = ke(), n = ze();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        qe({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Te(a.group.id, !0);
          Re(a.group, s, {
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
      oo({
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
      const a = bn(e, n);
      a.length === 0 ? t.state !== "inactive" && qe({
        cursorFlags: 0,
        state: "inactive"
      }) : qe({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), pn(e.currentTarget);
      break;
    }
  }
}
function lr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (ke().state) {
      case "hover":
        qe({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function ur(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || eo(e.currentTarget) && e.preventDefault();
}
function dr(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = fe(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = fe((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function sc(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = Ke({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, l = {
    asPercentage: fe(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = l, r.onResize(l, r.id, s);
}
function ic(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function cc({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const l = /* @__PURE__ */ new Map(), i = [];
  for (const d of e.panels) {
    const m = r[d.id] ?? 0;
    switch (d.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const f = m / 100 * n, h = fe(
          f / t * 100
        );
        l.set(d.id, h), o += h;
        break;
      }
      case "preserve-relative-size":
      default: {
        i.push(d.id), a += m;
        break;
      }
    }
  }
  if (!s || i.length === 0)
    return r;
  const c = 100 - o, u = { ...r };
  if (l.forEach((d, m) => {
    u[m] = d;
  }), a > 0)
    for (const d of i) {
      const m = r[d] ?? 0;
      u[d] = fe(
        m / a * c
      );
    }
  else {
    const d = fe(
      c / i.length
    );
    for (const m of i)
      u[m] = d;
  }
  return u;
}
function lc(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Ue = /* @__PURE__ */ new Map();
function uc(e) {
  let t = !0;
  Z(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((h) => {
    for (const p of h) {
      const { borderBoxSize: y, target: b } = p;
      if (b === e.element) {
        if (t) {
          const S = Ke({ group: e });
          if (S === 0)
            return;
          const w = Te(e.id);
          if (!w)
            return;
          const g = Kt(e), v = w.defaultLayoutDeferred ? dr(g) : w.layout, M = cc({
            group: e,
            nextGroupSize: S,
            prevGroupSize: w.groupSize,
            prevLayout: v
          }), _ = Ce({
            layout: M,
            panelConstraints: g
          });
          if (!w.defaultLayoutDeferred && Ne(w.layout, _) && ic(
            w.derivedPanelConstraints,
            g
          ) && w.groupSize === S)
            return;
          Re(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: g,
            groupSize: S,
            layout: _,
            separatorToPanels: w.separatorToPanels
          });
        }
      } else
        sc(e, b, y);
    }
  });
  a.observe(e.element), e.panels.forEach((h) => {
    Z(
      !r.has(h.id),
      `Panel ids must be unique; id "${h.id}" was used more than once`
    ), r.add(h.id), h.onResize && a.observe(h.element);
  });
  const s = Ke({ group: e }), l = Kt(e), i = e.panels.map(({ id: h }) => h).join(",");
  let c = e.mutableState.defaultLayout;
  c && (lc(e.panels, c) || (c = void 0));
  const u = e.mutableState.layouts[i] ?? c ?? dr(l), d = Ce({
    layout: u,
    panelConstraints: l
  }), m = e.element.ownerDocument;
  Ue.set(
    m,
    (Ue.get(m) ?? 0) + 1
  );
  const f = /* @__PURE__ */ new Map();
  return qr(e).forEach((h) => {
    h.separator && f.set(h.separator, h.panels);
  }), Re(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: l,
    groupSize: s,
    layout: d,
    separatorToPanels: f
  }), e.separators.forEach((h) => {
    Z(
      !o.has(h.id),
      `Separator ids must be unique; id "${h.id}" was used more than once`
    ), o.add(h.id), h.element.addEventListener("keydown", ar);
  }), Ue.get(m) === 1 && (m.addEventListener("contextmenu", er, !0), m.addEventListener("dblclick", or, !0), m.addEventListener("pointerdown", sr, !0), m.addEventListener("pointerleave", ir), m.addEventListener("pointermove", cr), m.addEventListener("pointerout", lr), m.addEventListener("pointerup", ur, !0)), function() {
    t = !1, Ue.set(
      m,
      Math.max(0, (Ue.get(m) ?? 0) - 1)
    ), Zi(e), e.separators.forEach((h) => {
      h.element.removeEventListener("keydown", ar);
    }), Ue.get(m) || (m.removeEventListener(
      "contextmenu",
      er,
      !0
    ), m.removeEventListener(
      "dblclick",
      or,
      !0
    ), m.removeEventListener(
      "pointerdown",
      sr,
      !0
    ), m.removeEventListener("pointerleave", ir), m.removeEventListener("pointermove", cr), m.removeEventListener("pointerout", lr), m.removeEventListener("pointerup", ur, !0)), a.disconnect();
  };
}
function dc() {
  const [e, t] = k({}), n = $(() => t({}), []);
  return [e, n];
}
function yn(e) {
  const t = pr();
  return `${e ?? t}`;
}
const xe = typeof window < "u" ? De : j;
function ot(e) {
  const t = A(e);
  return xe(() => {
    t.current = e;
  }, [e]), $(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function vn(...e) {
  return ot((t) => {
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
function Sn(e) {
  const t = A({ ...e });
  return xe(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ao = nn(null);
function fc(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: Gi
  });
  tn(t, () => n.current, []), xe(() => {
    Object.assign(
      n.current,
      ro({ groupId: e })
    );
  });
}
function so({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: o,
  elementRef: a,
  groupRef: s,
  id: l,
  onLayoutChange: i,
  onLayoutChanged: c,
  orientation: u = "horizontal",
  resizeTargetMinimumSize: d = {
    coarse: 20,
    fine: 10
  },
  style: m,
  ...f
}) {
  const h = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), p = ot((R) => {
    Ne(h.current.onLayoutChange, R) || (h.current.onLayoutChange = R, i == null || i(R));
  }), y = ot(
    (R, T) => {
      Ne(h.current.onLayoutChanged, R) || (h.current.onLayoutChanged = R, c == null || c(R, { isUserInteraction: T }));
    }
  ), b = yn(l), S = A(null), [w, g] = dc(), v = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), M = vn(S, a);
  fc(b, s);
  const _ = ot(
    (R, T) => {
      const I = ke(), E = Qn(R), O = Te(R);
      if (O) {
        let C = !1;
        switch (I.state) {
          case "active": {
            C = I.hitRegions.some(
              (V) => V.group === E
            );
            break;
          }
        }
        return {
          flexGrow: O.layout[T] ?? 1,
          pointerEvents: C ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), x = Sn({
    defaultLayout: n,
    disableCursor: r
  }), D = K(
    () => ({
      get disableCursor() {
        return !!x.disableCursor;
      },
      getPanelStyles: _,
      id: b,
      orientation: u,
      registerPanel: (R) => {
        const T = v.current;
        return T.panels = Zt(u, [
          ...T.panels,
          R
        ]), g(), () => {
          T.panels = T.panels.filter(
            (I) => I !== R
          ), g();
        };
      },
      registerSeparator: (R) => {
        const T = v.current;
        return T.separators = Zt(u, [
          ...T.separators,
          R
        ]), g(), () => {
          T.separators = T.separators.filter(
            (I) => I !== R
          ), g();
        };
      },
      updatePanelProps: (R, { disabled: T }) => {
        const I = v.current.panels.find(
          (C) => C.id === R
        );
        I && (I.panelConstraints.disabled = T);
        const E = Qn(b), O = Te(b);
        E && O && Re(E, {
          ...O,
          derivedPanelConstraints: Kt(E)
        });
      },
      updateSeparatorProps: (R, {
        disabled: T,
        disableDoubleClick: I
      }) => {
        const E = v.current.separators.find(
          (O) => O.id === R
        );
        E && (E.disabled = T, E.disableDoubleClick = I);
      }
    }),
    [_, b, g, u, x]
  ), N = A(null);
  return xe(() => {
    const R = S.current;
    if (R === null)
      return;
    const T = v.current;
    let I;
    if (x.defaultLayout !== void 0 && Object.keys(x.defaultLayout).length === T.panels.length) {
      I = {};
      for (const z of T.panels) {
        const B = x.defaultLayout[z.id];
        B !== void 0 && (I[z.id] = B);
      }
    }
    const E = {
      disabled: !!o,
      element: R,
      id: b,
      mutableState: {
        defaultLayout: I,
        disableCursor: !!x.disableCursor,
        expandedPanelSizes: v.current.lastExpandedPanelSizes,
        layouts: v.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    N.current = E;
    const O = uc(E), { defaultLayoutDeferred: C, derivedPanelConstraints: V, layout: J } = Te(E.id, !0);
    !C && V.length > 0 && (p(J), y(J, !1));
    const F = gn(b, (z) => {
      const { defaultLayoutDeferred: B, derivedPanelConstraints: Q, layout: te } = z.next;
      if (B || Q.length === 0)
        return;
      const re = E.panels.map(({ id: ee }) => ee).join(",");
      E.mutableState.layouts[re] = te, Q.forEach((ee) => {
        if (ee.collapsible) {
          const { layout: ve } = z.prev ?? {};
          if (ve) {
            const Oe = le(
              ee.collapsedSize,
              te[ee.panelId]
            ), Ee = le(
              ee.collapsedSize,
              ve[ee.panelId]
            );
            Oe && !Ee && (E.mutableState.expandedPanelSizes[ee.panelId] = ve[ee.panelId]);
          }
        }
      });
      const X = ke().state !== "active";
      p(te), X && y(te, z.isUserInteraction);
    });
    return () => {
      N.current = null, O(), F();
    };
  }, [
    o,
    b,
    y,
    p,
    u,
    w,
    x
  ]), j(() => {
    const R = N.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ P(ao.Provider, { value: D, children: /* @__PURE__ */ P(
    "div",
    {
      ...f,
      className: t,
      "data-group": !0,
      "data-testid": b,
      id: b,
      ref: M,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...m,
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
so.displayName = "Group";
function wn() {
  const e = rn(ao);
  return Z(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function mc(e, t) {
  const { id: n } = wn(), r = A({
    collapse: Ft,
    expand: Ft,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Ft
  });
  tn(t, () => r.current, []), xe(() => {
    Object.assign(
      r.current,
      no({ groupId: n, panelId: e })
    );
  });
}
function Yt({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: r = !1,
  defaultSize: o,
  disabled: a,
  elementRef: s,
  groupResizeBehavior: l = "preserve-relative-size",
  id: i,
  maxSize: c = "100%",
  minSize: u = "0%",
  onResize: d,
  panelRef: m,
  style: f,
  ...h
}) {
  const p = !!i, y = yn(i), b = Sn({
    disabled: a
  }), S = A(null), w = vn(S, s), {
    getPanelStyles: g,
    id: v,
    orientation: M,
    registerPanel: _,
    updatePanelProps: x
  } = wn(), D = d !== null, N = ot(
    (E, O, C) => {
      d == null || d(E, i, C);
    }
  );
  xe(() => {
    const E = S.current;
    if (E !== null) {
      const O = {
        element: E,
        id: y,
        idIsStable: p,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? N : void 0,
        panelConstraints: {
          groupResizeBehavior: l,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: b.disabled,
          maxSize: c,
          minSize: u
        }
      };
      return _(O);
    }
  }, [
    l,
    n,
    r,
    o,
    D,
    y,
    p,
    c,
    u,
    N,
    _,
    b
  ]), j(() => {
    x(y, { disabled: a });
  }, [a, y, x]), mc(y, m);
  const R = () => {
    const E = g(v, y);
    if (E)
      return JSON.stringify(E);
  }, T = hr(
    (E) => gn(v, E),
    R,
    R
  );
  let I;
  return T ? I = JSON.parse(T) : o !== void 0 ? I = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : I = { flexGrow: 1 }, /* @__PURE__ */ P(
    "div",
    {
      ...h,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: w,
      style: {
        ...hc,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...I
      },
      children: /* @__PURE__ */ P(
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
            touchAction: M === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Yt.displayName = "Panel";
const hc = {
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
function pc({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let o, a;
  const s = e[n], l = t.find(
    (i) => i.panelId === n
  );
  if (l) {
    const i = l.maxSize, c = l.collapsible ? l.collapsedSize : l.minSize, u = [r, r + 1];
    a = Ce({
      layout: ct({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Ce({
      layout: ct({
        delta: i - s,
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
function io({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...l
}) {
  const i = yn(a), c = Sn({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = k({}), [m, f] = k("inactive"), [h, p] = k(!1), y = A(null), b = vn(y, o), {
    disableCursor: S,
    id: w,
    orientation: g,
    registerSeparator: v,
    updateSeparatorProps: M
  } = wn(), _ = g === "horizontal" ? "vertical" : "horizontal";
  xe(() => {
    const N = y.current;
    if (N !== null) {
      const R = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: N,
        id: i
      }, T = v(R), I = Ji(
        (O) => {
          f(
            O.next.state !== "inactive" && O.next.hitRegions.some(
              (C) => C.separator === R
            ) ? O.next.state : "inactive"
          );
        }
      ), E = gn(
        w,
        (O) => {
          const { derivedPanelConstraints: C, layout: V, separatorToPanels: J } = O.next, F = J.get(R);
          if (F) {
            const z = F[0], B = F.indexOf(z);
            d(
              pc({
                layout: V,
                panelConstraints: C,
                panelId: z.id,
                panelIndex: B
              })
            );
          }
        }
      );
      return () => {
        I(), E(), T();
      };
    }
  }, [w, i, v, c]), j(() => {
    M(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, M]);
  let x;
  n && !S && (x = "not-allowed");
  let D;
  if (n)
    D = "disabled";
  else
    switch (m) {
      case "active": {
        D = "active";
        break;
      }
      default:
        h ? D = "focus" : D = m;
    }
  return /* @__PURE__ */ P(
    "div",
    {
      ...l,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": _,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": D,
      "data-testid": i,
      id: i,
      onBlur: () => p(!1),
      onFocus: () => p(!0),
      ref: b,
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
io.displayName = "Separator";
const Pn = 30, Rn = 65, lt = 50, gc = 100 - Rn, bc = 100 - Pn;
function yc(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Rn, Math.max(Pn, t)) : lt;
}
function In(e) {
  return 100 - e;
}
function Be(e) {
  return `${e}%`;
}
const Tn = "reader-document", ut = "reader-assistant", co = "retainpdf.reader.ai-split-layout.v1", vc = {
  [Tn]: In(lt),
  [ut]: lt
};
function En(e) {
  const t = yc(e == null ? void 0 : e[ut]);
  return {
    [Tn]: In(t),
    [ut]: t
  };
}
function Sc() {
  try {
    const e = JSON.parse(localStorage.getItem(co) || "null");
    return En(e);
  } catch {
    return vc;
  }
}
function wc(e) {
  try {
    localStorage.setItem(co, JSON.stringify(En(e)));
  } catch {
  }
}
function $t(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = En(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[ut]}vw`
  );
}
function Pc() {
  const e = A(null), [t] = k(Sc);
  De(() => {
    const o = e.current;
    return $t(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = $((o) => {
    $t(e.current, o);
  }, []), r = $((o, a) => {
    $t(e.current, o), a.isUserInteraction && wc(o);
  }, []);
  return /* @__PURE__ */ U(
    so,
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
        /* @__PURE__ */ P(
          Yt,
          {
            id: Tn,
            defaultSize: Be(In(lt)),
            minSize: Be(gc),
            maxSize: Be(bc)
          }
        ),
        /* @__PURE__ */ P(
          io,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ P("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ P(
          Yt,
          {
            id: ut,
            defaultSize: Be(lt),
            minSize: Be(Pn),
            maxSize: Be(Rn)
          }
        )
      ]
    }
  );
}
function Rc({
  id: e,
  open: t,
  ariaLabel: n,
  className: r = "",
  keepMounted: o = !1,
  onClose: a,
  toolbar: s,
  children: l
}) {
  return j(() => {
    if (!t) return;
    const i = (c) => {
      var d;
      if (c.key !== "Escape") return;
      const u = c.target;
      (d = u == null ? void 0 : u.closest) != null && d.call(u, "textarea, input, select, [contenteditable='true']") || (c.preventDefault(), a());
    };
    return window.addEventListener("keydown", i), () => window.removeEventListener("keydown", i);
  }, [t, a]), !t && !o ? null : /* @__PURE__ */ U(
    "aside",
    {
      id: e,
      className: `reader-notes-panel reader-notes-panel--workspace${s ? " has-panel-toolbar" : ""} ${r}`.trim(),
      "aria-label": n,
      role: "dialog",
      "aria-modal": "false",
      "data-hidden": t ? void 0 : "",
      inert: t ? void 0 : !0,
      "aria-hidden": t ? void 0 : !0,
      children: [
        s ? /* @__PURE__ */ P("div", { className: "reader-notes-panel-toolbar", children: s }) : null,
        /* @__PURE__ */ P("div", { className: "reader-notes-panel-body", children: l })
      ]
    }
  );
}
function Ic({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = k(!1);
  if (j(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ U("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ U("span", { className: "reader-error-notice-text", children: [
      o.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    /* @__PURE__ */ P(
      "button",
      {
        type: "button",
        className: "reader-error-notice-dismiss",
        "aria-label": "关闭提示",
        onClick: () => r(!0),
        children: "×"
      }
    )
  ] });
}
function Tc({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ P(Ic, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ U(Qt, { children: [
    e ? /* @__PURE__ */ P("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ U("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ P("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ P("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ P(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ P("div", { className: "reader-react-error", role: "alert", children: n }) : null
  ] });
}
function Ec(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Mc() {
  const [e, t] = k(!1), n = pr(), r = A(null);
  return j(() => {
    if (!e) return;
    const o = (s) => {
      const l = r.current;
      l && s.target instanceof Node && !l.contains(s.target) && t(!1);
    }, a = (s) => {
      s.key === "Escape" && (s.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", o), window.addEventListener("keydown", a), () => {
      document.removeEventListener("mousedown", o), window.removeEventListener("keydown", a);
    };
  }, [e]), j(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Ec(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ U("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ P(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ P(Co, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ U(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ U("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ P("strong", { children: "快捷键" }),
            /* @__PURE__ */ P(
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
          /* @__PURE__ */ P("div", { className: "reader-react-shortcuts-body", children: zs.map((o) => /* @__PURE__ */ U("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ P("h3", { children: o.title }),
            /* @__PURE__ */ P("ul", { children: o.items.map((a) => /* @__PURE__ */ U("li", { children: [
              /* @__PURE__ */ P("kbd", { children: a.keys }),
              /* @__PURE__ */ P("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ P("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const Ac = ["source", "sideBySide", "translated"], _c = { source: "", translated: "", sideBySide: "" };
function Lc(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = wt(e.sourceUrl), n = wt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Yo({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function kc(e) {
  const [t, n] = k(() => /* @__PURE__ */ new Set()), r = K(
    () => e ? Lc(e) : _c,
    [e]
  ), o = K(
    () => Ac.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = $(async (s) => {
    if (!e) return;
    const l = wt(r[s]);
    if (!(!l || t.has(s)))
      try {
        const i = e.jobId ? Zo(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Xo(
          e.fetchProtected,
          l,
          i,
          i,
          null,
          (c) => n((u) => {
            const d = new Set(u);
            return c ? d.add(s) : d.delete(s), d;
          })
        );
      } catch (i) {
        const c = i instanceof Error ? i.message : "下载失败";
        Qo(c), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Nc = {
  source: yr,
  sideBySide: vr,
  translated: Sr
}, Cc = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Dc(e) {
  const t = ft(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = kc(n), l = A(null);
  return j(() => {
    const i = () => {
      var d;
      (d = l.current) != null && d.open && (l.current.open = !1);
    }, c = (d) => {
      l.current && !l.current.contains(d.target) && i();
    }, u = (d) => {
      d.key === "Escape" && i();
    };
    return document.addEventListener("pointerdown", c), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", c), document.removeEventListener("keydown", u);
    };
  }, []), /* @__PURE__ */ U("details", { ref: l, className: "reader-download-actions", children: [
    /* @__PURE__ */ U("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ P(Do, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ P("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ P(zo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ P("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const c = bo[i], u = wt(r[i]), d = a.has(i), m = !!u && !d, f = m ? "" : yo(i, r), h = Nc[i];
      return /* @__PURE__ */ U(
        "button",
        {
          type: "button",
          id: `reader-download-${i}`,
          className: `reader-download-action${d ? " is-busy" : ""}`,
          disabled: !m,
          "aria-label": m ? `下载${c.label}` : f,
          onClick: () => {
            l.current && (l.current.open = !1), s(i);
          },
          children: [
            /* @__PURE__ */ P(h, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ U("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ U("span", { className: "reader-download-action-label", children: [
                Cc[i],
                " PDF"
              ] }),
              f ? /* @__PURE__ */ P("span", { className: "reader-download-action-reason", children: f }) : null
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
function zc(e) {
  const t = ft(), n = wi(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? dt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), l = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Oa(a), d = a > Ir + 1e-3, m = a < Tt - 1e-3, f = He(r, Ve()), h = f >= Tt ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [p, y] = k(!1), [b, S] = k(`${l}`);
  j(() => {
    p || S(`${Math.min(Math.max(l, 1), Math.max(i, 1))}`);
  }, [l, i, p]);
  const w = () => {
    if (y(!1), !c || i <= 0)
      return;
    const g = Number(`${b}`.trim());
    c(Et(g, i));
  };
  return /* @__PURE__ */ U("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ P("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ P("div", { className: "reader-react-hud-group", "aria-label": "页码", children: p ? /* @__PURE__ */ U(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (g) => {
          g.preventDefault(), w();
        },
        children: [
          /* @__PURE__ */ P(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: b,
              autoFocus: !0,
              onChange: (g) => S(g.target.value.replace(/[^\d]/g, "")),
              onBlur: w,
              onKeyDown: (g) => {
                g.key === "Escape" && (g.preventDefault(), y(!1), S(`${l}`));
              }
            }
          ),
          /* @__PURE__ */ U("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            i || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ P(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": i > 0 ? `跳转页码，当前第 ${l} 页，共 ${i} 页` : "页码",
        title: i > 0 ? "点击输入页码跳转" : void 0,
        disabled: !c || i <= 0,
        onClick: () => {
          !c || i <= 0 || (S(`${l}`), y(!0));
        },
        children: i > 0 ? `${Math.min(l, i)} / ${i}` : "—"
      }
    ) }),
    /* @__PURE__ */ U("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ P(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !d,
          onClick: () => s(it(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ U(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${h}`,
          title: h,
          onClick: () => s(f),
          children: [
            u,
            "%"
          ]
        }
      ),
      /* @__PURE__ */ P(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !m,
          onClick: () => s(it(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ P("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ P(Mc, {}) })
  ] });
}
function fr(e) {
  var t, n;
  return Ar(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function xc(e) {
  const [t, n] = k(() => ({
    scope: e,
    panel: fr(ye(e))
  }));
  j(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: fr(ye(e))
    });
  }, [e]), j(() => {
    t.scope === e && At(t.scope, {
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
const Xt = "download-toast";
function Oc({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ U("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ U("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ P("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ P("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ P("div", { className: "download-toast-track", children: /* @__PURE__ */ P("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ P("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Fc(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    jt.dismiss(Xt);
    return;
  }
  jt.custom(
    () => /* @__PURE__ */ P(Oc, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Xt, duration: 1 / 0 }
  );
}
function $c() {
  const e = $((t) => {
    t && (t.setState = Fc, t.hide = () => jt.dismiss(Xt));
  }, []);
  return /* @__PURE__ */ U(Qt, { children: [
    /* @__PURE__ */ P(_o, { position: "bottom-right" }),
    /* @__PURE__ */ P("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function jc(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Tr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Uc(e, t) {
  return t === null || e !== t;
}
function lo(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function Bc(e, t) {
  const n = e === t;
  return { open: n, mounted: lo(n) };
}
function Hc({
  panel: e,
  active: t,
  context: n
}) {
  var i;
  const r = t === e.id, o = lo(r);
  if (!(e.keepMounted ? o : r)) return null;
  const s = me(), l = (i = s == null ? void 0 : s[e.adapterKey]) == null ? void 0 : i.call(s, { ...n, open: r });
  return l == null ? null : /* @__PURE__ */ P(
    Rc,
    {
      id: `reader-${e.id}-panel`,
      open: r,
      ariaLabel: e.ariaLabel,
      keepMounted: e.keepMounted,
      className: "is-pane-right",
      onClose: n.onClose,
      children: l
    }
  );
}
const mr = { itemId: null, origin: null };
function Wc() {
  let e = mr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? mr : { itemId: n, origin: r };
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
const Vc = mo(() => import("./ReaderMarkdownPanel-C7Lih_ak.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Jc(e) {
  const t = e.sourceOnly || !e.translatedUrl, n = !!(e.overlayContentAvailable && e.liveTranslationVisible && !e.assistantOpen), o = e.assistantPdfPane || (e.assistantOpen && e.mode === "compare" ? "source" : e.mode), a = !t && (o === "translated" || o === "compare");
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
function qc(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Gc() {
  const e = Cs(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = xc(e.viewStateKey), s = a.panel, l = a.setPanel, [i, c] = k(null), [u, d] = k(null), [m, f] = k(!1), h = A(null), p = A(null), y = s !== null, b = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, S = Jc({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: b,
    liveTranslationVisible: m,
    assistantOpen: y,
    assistantPdfPane: i
  }), w = $(() => d(null), []), g = u ? ho({ jobId: o.jobId, name: u, onClose: w }) : null, v = Es({
    hasOverlayContent: b,
    connection: e.liveTranslation.connection,
    showSource: S.showSource,
    liveTranslationVisible: m,
    assistantOpen: y
  }), M = S.sourceViewOnly, _ = S.visibleMode;
  j(() => {
    d(null), f(!1);
  }, [e.viewStateKey]), j(() => {
    e.session.jobTerminal && f(!1);
  }, [e.session.jobTerminal]), j(() => {
    c(null);
  }, [a.scope]), j(() => {
    if (!(t.loading || t.failed)) {
      if (h.current !== e.viewStateKey) {
        h.current = e.viewStateKey;
        const z = ye(e.viewStateKey), B = jc({
          savedMode: z == null ? void 0 : z.mode,
          sourceViewOnly: M,
          viewportWidth: Ve()
        });
        p.current = B.auto ? B.mode : null, B.mode && B.mode !== e.mode && e.setModeKeepingPage(B.mode);
        return;
      }
      Uc(e.mode, p.current) && (p.current = null, At(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, M]);
  const x = s || (e.mode === "compare" ? "compare" : "reading"), D = Bc(s, "markdown");
  js({
    mode: _,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const N = $(() => {
    l(null), c(null);
  }, []), R = $((z) => {
    c(null);
    const B = qc(z, e.liveTranslationAvailable);
    B !== null && f(B), e.setModeKeepingPage(z);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), T = K(() => v.sourcePaneToggle ? /* @__PURE__ */ P(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${m ? " is-active" : ""}`,
      onClick: () => f((z) => !z),
      "aria-pressed": m,
      title: m ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [v.sourcePaneToggle, m]), I = $((z) => {
    l(z), c(null);
  }, []), E = K(() => ({
    // **只认 jobId**，不拿 documentId 兜底（契约见 adapters.ts：「用 jobId，换文档
    // 就换终端」）。原来是 `session.jobId || session.documentId || "reader"`，于是
    // 没有任务的阅读页（书架卡片在没有 job_id 时跳 `reader.html?document_id=…`）会
    // 拿一个 document id 当 job id 用，四处同时静默失败：
    //
    //   - fx 侧 resolve_job_workspace 找不到 data/jobs/<documentId> → 退回私有目录，
    //     终端开起来了但 books/ 是空的，无报错
    //   - 产物条每 4 秒打 /api/v1/jobs/<documentId>/board → 404 → 静默跳过
    //   - 左边那块 renderReaderBoard 看 !jobId → 静默返回 null
    //
    // 空字符串在这里是有意义的信号：renderReaderTerminal 会改画一段说明，
    // 而不是一个开得起来却什么都做不了的空壳。
    sessionKey: o.jobId,
    // 以前「点块 → 浮条 → 问 AI」会把选区预填进终端；浮条整个删了（只留悬停复制），
    // 阅读器这边没有要预填的了。宿主的注入能力保留，接口不动。
    pendingInput: null,
    onOpenBoard: d,
    onClose: N
  }), [N, o.documentId, o.jobId]), [O] = k(Wc), C = $((z) => e.jumpToAnchor({ block_id: z }), [e.jumpToAnchor]), V = K(() => ({
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
    jumpToBlock: C,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: M,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: I, close: N }
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
    C,
    e.sourceOnly,
    M,
    e.download,
    e.goToPage,
    I,
    N
  ]), J = K(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), F = [
    Aa,
    `is-workspace-${x}`,
    y ? "is-assistant-open" : "",
    S.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ P(Si, { value: V, hud: J, children: /* @__PURE__ */ U("div", { className: F, "data-reader-engine": "react-pdf", "data-reader-workspace": x, children: [
    /* @__PURE__ */ P(Tc, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ U("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ P(Dc, {}),
      /* @__PURE__ */ P(Js, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ P(
      Li,
      {
        mode: _,
        documentReady: !!o.jobId,
        sourceViewOnly: M,
        onModeChange: R,
        liveTranslation: v.topBarPill ? {
          visible: m,
          state: e.liveTranslation,
          onToggle: () => f((z) => !z)
        } : null
      }
    ),
    /* @__PURE__ */ P(xi, { active: s }),
    y ? /* @__PURE__ */ P(Pc, {}) : null,
    /* @__PURE__ */ P(Ei, { paneComposition: S, markdownSplit: D.open, assistantSplit: y, liveTranslation: e.liveTranslation, sourcePaneAction: T }),
    g,
    e.showHud ? /* @__PURE__ */ P(
      zc,
      {
        mode: _,
        modeControls: null
      }
    ) : null,
    /* @__PURE__ */ U(fo, { fallback: null, children: [
      Wr.map((z) => /* @__PURE__ */ P(
        Hc,
        {
          panel: z,
          active: s,
          context: E
        },
        z.id
      )),
      D.mounted ? /* @__PURE__ */ P(Vc, { open: D.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: N }) : null
    ] }),
    /* @__PURE__ */ P($c, {})
  ] }) });
}
function fl() {
  return /* @__PURE__ */ P(Gc, {});
}
export {
  fl as R,
  Gc as a,
  Rc as b,
  ul as d,
  ll as f,
  dl as r,
  ft as u
};
//# sourceMappingURL=ReaderApp-BOsQyv8D.js.map
