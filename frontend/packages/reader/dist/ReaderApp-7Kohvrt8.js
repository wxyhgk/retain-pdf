var Ln = (e) => {
  throw TypeError(e);
};
var _n = (e, t, n) => t.has(e) || Ln("Cannot " + n);
var Qe = (e, t, n) => (_n(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Nn = (e, t, n) => t.has(e) ? Ln("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Cn = (e, t, n, r) => (_n(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as B, jsx as S, Fragment as tn } from "react/jsx-runtime";
import { useMemo as G, useState as _, useEffect as j, useCallback as $, useRef as k, useLayoutEffect as De, memo as nn, forwardRef as po, useImperativeHandle as rn, createContext as on, useContext as an, useSyncExternalStore as br, useId as yr, Suspense as go, lazy as bo } from "react";
import { requireAdapter as Ze, getReaderAdapters as me, renderReaderBoardSlot as yo } from "./adapters.js";
import { resolveReaderDownloadName as vo, resolveReaderDownloadUrls as So, READER_PROGRESS_COPY as Se, trimString as wt, READER_DOWNLOAD_ACTIONS as wo, disabledReason as Po } from "./runtime/state.js";
import "@retainpdf/api/conversations";
import { r as Ro, b as Io } from "./page-config-Ct7qR5rm.js";
import { isFinishedJobStatus as sn } from "@retainpdf/domain/job";
import { c as Eo, n as To, f as Nt, j as Dn, a as Mo, b as ko, h as vr, p as cn, d as Ao, k as zn, i as Lo } from "./reader-regions-CXmxla3K.js";
import { isReaderTransportError as _o, createReaderTransportError as No } from "./contracts.js";
import { toast as Bt, Toaster as Co } from "sonner";
import { X as Sr, Radio as Do, FileText as wr, Columns2 as Pr, Languages as Rr, FileCode2 as zo, Sparkles as xo, Keyboard as Oo, Download as Fo, ChevronDown as $o } from "lucide-react";
import { pdfjs as jo, Page as Bo, Document as Uo } from "react-pdf";
import { e as Ho, m as Wo, a as Vo } from "./markdown-math-XkF5urpn.js";
const Jo = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ko = "", qo = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Go = (e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, wl = (...e) => {
  var n;
  return (((n = me()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, we = () => Ze("defaultReaderDataPort"), xn = () => Ze("defaultReaderPageConfigPort"), Pl = {
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
}, Ir = {
  messageTargetOrigin: () => xn().messageTargetOrigin(),
  readerJobId: () => xn().readerJobId()
}, Zo = () => {
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
}, ln = () => {
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
}, Yo = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Xo = () => {
  var e, t;
  return ((t = (e = me()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Qo = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ea = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? vo(...e);
}, ta = (...e) => {
  var t, n;
  return ((n = (t = me()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? So(...e);
}, na = (...e) => Ze("downloadProtectedResource")(...e), ra = (...e) => Ze("failDownloadToast")(...e), Rl = (e, t) => Ze("resolveMarkdownAssetUrl")(e, t), oa = "/api/v1";
function aa() {
  const e = () => {
    var r;
    return Ro(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = _(e);
  return j(() => {
    var c, i, l, u;
    const r = () => n(e()), o = (i = (c = globalThis.history) == null ? void 0 : c.pushState) == null ? void 0 : i.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const d = (f) => function(...m) {
          const h = f.apply(this, m);
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
function sa() {
  const e = aa(), t = G(() => Qo(Ir), [e]), n = G(() => Xo(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function ia(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: c
  } = e, [i, l] = _({
    documentId: "",
    jobId: ""
  }), [u, d] = _({
    documentId: "",
    jobId: ""
  }), f = i.documentId === t ? i.jobId : "", m = u.documentId === t ? u.jobId : "", h = n || f, [p, y] = _({
    jobId: "",
    documentId: ""
  }), b = p.jobId === h ? p.documentId : "", w = t || b, P = !!t && !h, [g, v] = _(null), M = (g == null ? void 0 : g.sessionIdentity) === r && g.documentId === w ? g : null, A = P || !!M, x = $((N) => {
    const R = `${N.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const E = `${N.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: R,
      revision: E,
      sessionIdentity: o.current
    }), c();
  }, []);
  j(() => {
    v((N) => N && N.sessionIdentity !== r ? null : N);
  }, [r]);
  const D = $((N) => {
    switch (N.type) {
      case "resolved-document-job":
        l({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
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
    setResolvedDocumentJob: l,
    missingDocumentJob: u,
    setMissingDocumentJob: d,
    documentJobId: f,
    rejectedDocumentJobId: m,
    sessionJobId: h,
    resolvedJobDocument: p,
    setResolvedJobDocument: y,
    jobDocumentId: b,
    documentId: w,
    sourceOnly: P,
    committedDocumentSource: g,
    setCommittedDocumentSource: v,
    activeCommittedDocumentSource: M,
    sourceViewOnly: A,
    refreshCommittedDocument: x,
    applyIdentityEvent: D
  };
}
function On(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function ca(e) {
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
function Fn(e, t) {
  const n = `/api/v1/documents/${encodeURIComponent(e)}/source.pdf`, r = `${t || ""}`.trim();
  return Go(r ? `${n}?version=${encodeURIComponent(r)}` : n);
}
function la(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function ua(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !la(a, t))
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
        type: qo.progress,
        stage: n,
        percent: e,
        text: t
      },
      Ir.messageTargetOrigin()
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
function da(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = _(null), [l, u] = _(null), [d, f] = _(""), [m, h] = _(0), p = d === n ? c : null, y = d === n ? l : null, b = On(p), w = sn(b), P = $(() => {
    h((D) => D + 1);
  }, []), g = $((D) => {
    i(D.jobPayload), u(D.manifestPayload), f(D.sessionIdentity);
  }, []), v = $((D) => {
    i(null), u(null), f(D);
  }, []), M = k(""), A = k(""), x = $(async () => {
    const D = o.current;
    if (!D || M.current === D) return;
    const N = ln().loadJobPayload;
    if (typeof N != "function") return;
    const R = a.current.value;
    M.current = D;
    try {
      const E = await N(D);
      if (s.current || a.current.value !== R || o.current !== D || !E || typeof E != "object")
        return;
      const I = On(E);
      i(E), f(r.current), I === "succeeded" && A.current !== D && (A.current = D, h((T) => T + 1));
    } catch {
    } finally {
      M.current === D && (M.current = "");
    }
  }, []);
  return j(() => {
    A.current = "";
  }, [n]), j(() => {
    if (!t || w || !p) return;
    const D = window.setInterval(() => {
      x();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [w, x, p, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: f,
    scopedJobPayload: p,
    scopedManifestPayload: y,
    jobStatus: b,
    jobTerminal: w,
    jobRefreshRevision: m,
    refreshJobArtifacts: P,
    refreshJobStatus: x,
    publishPayload: g,
    clearPayload: v
  };
}
function Ht(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function fa(e, t) {
  e(t), Ht(t);
}
function ma(e) {
  const [t, n] = _(e ? "source" : "compare"), r = $((a) => {
    e && a !== "source" || (n(a), Ht(a));
  }, [e]), o = $((a) => {
    fa(n, a);
  }, []);
  return j(() => (e && document.documentElement.classList.add("reader-source-only"), Ht(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function $n(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function ha(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: $n(n.active_job_id),
    activeVersionId: $n(n.active_version_id)
  };
}
function pa(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function ga(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function ba(e) {
  return e.status === 404 && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
function ya(e) {
  return e ? { data: e.data.slice() } : null;
}
const va = 2, pe = /* @__PURE__ */ new Map();
function Wt(e, t) {
  pe.delete(e), pe.set(e, t);
}
function Sa(e) {
  if (pe.size < va) return;
  const t = pe.keys().next().value;
  t && pe.delete(t);
}
function Ct(e) {
  const t = `${e || ""}`.trim();
  if (!t || !pe.has(t)) return null;
  const n = pe.get(t);
  return Wt(t, n), n;
}
async function Er(e, t = at().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (pe.has(r)) {
    const c = pe.get(r);
    return Wt(r, c), c;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const c = new Error(`读取 PDF 失败 (${o.status})`);
    throw c.status = o.status, c;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return pe.has(r) ? Wt(r, s) : (Sa(), pe.set(r, s)), s;
}
function wa(e = "", t = null) {
  const [n, r] = _(
    () => t || Ct(e)
  ), [o, a] = _(
    () => !!`${e || ""}`.trim() && !t && !Ct(e)
  ), [s, c] = _("");
  return j(() => {
    if (t) {
      r(t), a(!1), c("");
      return;
    }
    const i = `${e || ""}`.trim();
    if (!i) {
      r(null), a(!1), c("");
      return;
    }
    const l = Ct(i);
    if (l) {
      r(l), a(!1), c("");
      return;
    }
    let u = !1;
    return a(!0), c(""), r(null), Er(i).then((d) => {
      u || (r(d), a(!1));
    }).catch((d) => {
      u || (r(null), a(!1), c((d == null ? void 0 : d.message) || String(d)));
    }), () => {
      u = !0;
    };
  }, [e, t]), { file: n, loading: o, error: s };
}
function Pa(e) {
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
async function Vt(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Pt(s, r, n, "download");
  const c = await Er(t, at().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Pt(s, o, n, "download"), c);
}
async function Ra(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Pt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, c = null;
  return t && a.push(
    Vt({
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
    Vt({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: o
    }).then((u) => {
      c = u;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !c ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: c };
}
const gt = {
  regions: null,
  metadata: null
};
function Ia(e) {
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
    applyIdentityEvent: u,
    publishPayload: d,
    clearPayload: f,
    switchSessionMode: m,
    jobRefreshRevision: h,
    sessionEpochRef: p,
    closingRef: y,
    activeLoadAbortRef: b
  } = e, [w, P] = _(""), [g, v] = _(""), [M, A] = _(null), [x, D] = _(null), [N, R] = _(!1), [E, I] = _(""), [T, O] = _([]), [C, V] = _(() => ({
    source: null,
    translated: null
  })), [J, F] = _(
    gt
  ), [z, U] = _({
    loading: !0,
    percent: 4,
    text: Se.boot,
    stage: "progress",
    failed: !1
  });
  return j(() => {
    const Q = new AbortController(), te = p.current.value, re = Pa({
      sessionEpochRef: p,
      closingRef: y,
      abort: Q,
      sessionEpoch: te
    });
    b.current = Q;
    const X = ln();
    if (y.current)
      return Q.abort(), () => {
        b.current === Q && (b.current = null);
      };
    function ee(ne, ae) {
      re.markFailed(), U({
        loading: !1,
        percent: 100,
        text: ne,
        stage: "failed",
        failed: !0
      }), Ut({ percent: 100, text: ae, stage: "failed" });
    }
    function ve() {
      R(!0), U({
        loading: !1,
        percent: 100,
        text: Se.ready,
        stage: "ready",
        failed: !1
      }), Ut({ percent: 100, text: Se.ready, stage: "ready" });
    }
    function Oe() {
      return l != null && l.documentId ? Fn(
        l.documentId,
        l.revision
      ) : Jo() ? Ko : X.resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(r)}/source.pdf`);
    }
    async function Te() {
      let ne = { activeJobId: "", activeVersionId: "" };
      try {
        const de = await X.fetchProtected(
          X.resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(r)}`)
        );
        if (de != null && de.ok) {
          const ce = await de.json().catch(() => null);
          ne = ha(ce);
        }
      } catch {
      }
      const ae = pa({
        link: ne,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (ae.kind === "follow-active-job") {
        if (re.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: ae.jobId
        }), ae.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: ae.activeVersionId,
          sessionIdentity: i
        }), m("source")) : m("compare");
        return;
      }
      if (ae.kind === "open-committed-source") {
        if (re.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: ae.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const se = Oe();
      if (re.isInactive()) return;
      P(se), v(""), I(""), f(i);
      const ue = await Vt({
        url: se,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: re,
        setBoot: U
      });
      if (!re.isInactive()) {
        if (!ue) {
          ee("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        A(ue), ve();
      }
    }
    async function mt() {
      var H;
      const ne = !l, ae = !!(ne && X.loadSessionSnapshot && X.loadReaderOptionalArtifacts), se = ae ? X.loadReaderOptionalArtifacts(t) : null, ue = await ((H = X.loadSessionSnapshot) == null ? void 0 : H.call(X, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
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
            ce = await X.fetchDocumentByJobId(oa, t);
          } catch {
          }
          if (re.isInactive()) return;
        }
      const Fe = ca(de.jobPayload) || `${(ce == null ? void 0 : ce.document_id) || ""}`.trim();
      Fe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Fe
      });
      const $e = ga({
        payloadDocumentId: Fe,
        linkedActiveJobId: `${(ce == null ? void 0 : ce.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ce == null ? void 0 : ce.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if ($e.kind === "restore-committed-source") {
        if (re.isInactive()) return;
        u({
          type: "committed-source",
          documentId: $e.documentId,
          revision: $e.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const Ye = X.resolveReaderSourcePdf(de.manifestPayload), _t = X.resolveReaderTranslatedPdfUrl(de.jobPayload, de.manifestPayload), Me = typeof Ye == "string" ? Ye : X.resolveReaderArtifactUrl(Ye), ke = r || Fe, Ae = l != null && l.documentId ? Fn(
        l.documentId,
        l.revision
      ) : Me || (ke ? X.resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(ke)}/source.pdf`) : ""), Xe = l ? "" : _t || "";
      P(Ae || ""), v(Xe), I(ua(de.jobPayload, t)), d({
        jobPayload: de.jobPayload || null,
        manifestPayload: de.manifestPayload || null,
        sessionIdentity: i
      });
      const ht = () => Ra({
        sourceFinal: Ae || "",
        translatedFinal: Xe,
        fence: re,
        setBoot: U
      }), pt = !!(Ae || Xe), je = se && pt ? ht() : null;
      je == null || je.catch(() => {
      });
      const L = se ? await se : de;
      if (re.isInactive()) return;
      if (O(l ? [] : Eo(L.regionsPayload)), V(l ? { source: null, translated: null } : To(L.readerMetadata)), F(l ? gt : L.readerErrors ?? gt), !pt) {
        ee(Se.failed, Se.failed);
        return;
      }
      const W = await (je ?? ht());
      if (W.status !== "inactive") {
        if (W.status === "incomplete") {
          ee("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        A(W.sourceBytes), D(W.translatedBytes), ve();
      }
    }
    async function Lt() {
      R(!1), A(null), D(null), O([]), V({ source: null, translated: null }), F(gt), Pt(U, 8, Se.metadata, "metadata");
      try {
        if (s) {
          await Te();
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
        if (ba({
          status: ae,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const se = ne instanceof Error ? ne.message : Se.failed;
        ee(se, se);
      }
    }
    return Lt(), () => {
      Q.abort(), b.current === Q && (b.current = null);
    };
  }, [t, r, o, a, s, c, l, h, n, i, u, d, f, m]), {
    sourceUrl: w,
    translatedUrl: g,
    sourceFile: M,
    translatedFile: x,
    assetsReady: N,
    title: E,
    regions: T,
    readerMetadata: C,
    readerErrors: J,
    boot: z
  };
}
function Ea() {
  const e = k(!1), t = k(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = sa(), s = k({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = k(a), i = k(""), l = k(""), u = k(() => {
  }), d = $(() => u.current(), []), f = ia({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: c,
    documentIdRef: i,
    sessionJobIdRef: l,
    switchToSourceMode: d
  }), {
    sessionJobId: m,
    documentId: h,
    sourceOnly: p,
    sourceViewOnly: y
  } = f, { mode: b, setMode: w, switchSessionMode: P } = ma(y);
  u.current = () => {
    P("source");
  }, c.current = a, i.current = h, l.current = m;
  const g = da({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: v,
    scopedManifestPayload: M,
    jobStatus: A,
    jobTerminal: x,
    jobRefreshRevision: D,
    refreshJobArtifacts: N,
    refreshJobStatus: R
  } = g, E = Ia({
    sessionJobId: m,
    jobId: r,
    routeDocumentId: o,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: p,
    locationKey: n,
    sessionIdentity: a,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: g.publishPayload,
    clearPayload: g.clearPayload,
    switchSessionMode: P,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), I = $(() => {
    var O;
    e.current = !0, (O = t.current) == null || O.abort();
  }, []), T = G(
    () => ({
      fetchProtected: ln().fetchProtected,
      jobId: m,
      jobPayload: v,
      manifestPayload: M,
      sourceUrl: E.sourceUrl,
      translatedUrl: E.translatedUrl,
      sourceOnly: y
    }),
    [m, v, M, E.sourceUrl, E.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: A,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: x,
    documentId: h,
    sessionIdentity: a,
    sourceOnly: p,
    mode: b,
    setMode: w,
    sourceUrl: E.sourceUrl,
    translatedUrl: E.translatedUrl,
    sourceFile: E.sourceFile,
    translatedFile: E.translatedFile,
    assetsReady: E.assetsReady,
    boot: E.boot,
    title: E.title,
    regions: E.regions,
    readerMetadata: E.readerMetadata,
    readerErrors: E.readerErrors,
    download: T,
    refreshJobArtifacts: N,
    refreshJobStatus: R,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: I
  };
}
const Ta = 160, Ma = 8, ka = 0;
function Aa() {
  const e = k(null), [t, n] = _(null), [r, o] = _(ka), a = $((s) => {
    e.current = s, n(s);
  }, []);
  return j(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < Ta || o((u) => Math.abs(u - l) < Ma ? u : l);
    }, i = new ResizeObserver((l) => {
      var u, d;
      c(((d = (u = l[0]) == null ? void 0 : u.contentRect) == null ? void 0 : d.width) ?? s.clientWidth);
    });
    return i.observe(s), c(s.clientWidth), () => i.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function La(e) {
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
const Dt = { source: 0, translated: 0 };
function _a(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: c,
    translatedFile: i
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = k(l);
  u.current = l;
  const [d, f] = _(() => ({
    identity: l,
    pages: Dt
  })), [m, h] = _(() => ({ identity: l, tick: 0 })), p = d.identity === l ? d.pages : Dt, y = m.identity === l ? m.tick : 0, b = La({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: w } = b, P = $((R, E) => {
    u.current === l && f((I) => {
      const T = I.identity === l ? I.pages : Dt;
      return T[E] === R && I.identity === l ? I : {
        identity: l,
        pages: { ...T, [E]: R }
      };
    });
  }, [l]), g = k(null), v = $(() => {
    g.current && clearTimeout(g.current);
    const R = l;
    g.current = setTimeout(() => {
      g.current = null, u.current === R && h((E) => ({
        identity: R,
        tick: E.identity === R ? E.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  j(() => (g.current && (clearTimeout(g.current), g.current = null), f((R) => R.identity === l && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: l, pages: { source: 0, translated: 0 } }), h((R) => R.identity === l && R.tick === 0 ? R : { identity: l, tick: 0 }), () => {
    g.current && (clearTimeout(g.current), g.current = null);
  }), [l]);
  const M = G(
    () => Math.max(p.source, p.translated),
    [p]
  ), A = w === "translated" ? p.translated : p.source || p.translated, x = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, N = `${l}-${y}-${x}-${n}-${p.source}-${p.translated}-${D}`;
  return {
    ...b,
    numPagesByPane: p,
    hudNumPages: M,
    primaryNumPages: A,
    metricsTick: y,
    onNumPages: P,
    onMetrics: v,
    rowSyncRevision: N
  };
}
const qe = "data-reader-page", st = "data-reader-pane", un = "data-natural-height", Na = "reader-react-root", Ca = "reader-react-grid", Da = "reader-react-scroll-shell", za = "reader-react-pdf-pane", Tr = "reader-react-pdf-page", Rt = "reader-react-pdf-page-placeholder", dn = "reader-react-pdf-page-slot";
function It(e, t) {
  const n = e != null ? `[${qe}="${e}"]` : `[${qe}]`;
  return t ? `${n}[${st}="${t}"]` : n;
}
function xa() {
  return `.${dn}[${qe}]`;
}
function fn(e) {
  return Number(e.getAttribute(qe));
}
const Mr = 0.25, Et = 1, Oa = 0.05, dt = 0.5, Fa = 16, $a = 8, ja = 720;
function Ve() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function kr(e) {
  return Number.isFinite(e) && e < ja;
}
function He(e, t = Number.POSITIVE_INFINITY) {
  return kr(t) && (e === "source" || e === "translated") ? Et : dt;
}
function kt(e) {
  return Number.isFinite(e) ? Math.min(Et, Math.max(Mr, e)) : dt;
}
function it(e, t) {
  const n = kt(Number(e) + t * Oa);
  return Math.round(n * 100) / 100;
}
function Ba(e) {
  return Math.round(kt(e) * 100);
}
function Ua(e) {
  const n = (Number(e) || 0) - Fa - $a;
  return Math.max(160, Math.floor(n));
}
function Ha(e, t = dt) {
  const n = kt(t);
  return Ua((Number(e) || 0) * n);
}
function Wa(e, t) {
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
const Va = 8;
function Ja(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Va ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Ka = 200, Ar = [
  "markdown"
], Lr = [
  "terminal"
], qa = [
  ...Ar,
  ...Lr
];
function _r(e) {
  return qa.includes(e);
}
const Ga = "retainpdf:reader:view:v1:", jn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Za = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Nr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Jt(e) {
  return `${e || ""}`.trim();
}
function Ya({
  documentId: e,
  jobId: t
}) {
  const n = Jt(e);
  if (n) return `document:${n}`;
  const r = Jt(t);
  return r ? `job:${r}` : "";
}
function Cr(e) {
  const t = Jt(e);
  return t ? `${Ga}${t}` : "";
}
function Xa(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Qa(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!jn.has(t) || !jn.has(n) || t === n))
    return { left: t, right: n };
}
function es(e) {
  return e === null ? null : _r(e) ? e : void 0;
}
function ts(e) {
  return Za.has(e) ? e : void 0;
}
function Dr(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Xa(t.anchor), r = Number(t.zoom), o = ts(t.mode), a = Qa(t.splitLayout), s = es(t.assistantPanel);
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
function ye(e, t = Nr()) {
  const n = Cr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Dr(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function At(e, t, n = Nr()) {
  const r = Cr(e);
  if (!r || !n) return null;
  const o = ye(e, n), a = Dr({
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
function ns(e, t, n = "") {
  var f;
  const [r, o] = _(() => {
    var m;
    return ((m = ye(n)) == null ? void 0 : m.zoom) ?? He(e, Ve());
  }), a = k(r), s = k(n);
  a.current = r;
  const c = k(1), i = k(((f = ye(n)) == null ? void 0 : f.zoom) !== void 0);
  j(() => {
    var p;
    if (s.current === n) return;
    s.current = n;
    const m = (p = ye(n)) == null ? void 0 : p.zoom;
    i.current = m !== void 0;
    const h = m ?? He(e, Ve());
    c.current = 1, a.current = h, o(h);
  }, [e, n]), j(() => {
    if (i.current) return;
    const m = He(e, Ve()), h = a.current;
    Math.abs(m - h) < 5e-4 || (c.current = 1, a.current = m, o(m));
  }, [e]);
  const l = $((m) => {
    const h = kt(m), p = a.current;
    Math.abs(h - p) < 5e-4 || (c.current = h / (p || 1), i.current = !0, At(s.current, { zoom: h }), o(h));
  }, []), u = $((m) => {
    l(it(a.current, m));
  }, [l]), d = $((m) => {
    l(He(m));
  }, [l]);
  return De(() => {
    const m = c.current;
    Math.abs(m - 1) < 1e-3 || (c.current = 1, Wa(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function rs(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = k(t), a = k(n), s = k(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: $((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const mn = 48;
function zr(e, t = mn) {
  return e.getBoundingClientRect().top + t;
}
function xr(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const i of e) {
    const l = i.getBoundingClientRect();
    l.height < 8 || l.width < 8 || l.top <= t + 1 && l.top >= r && (n = i, r = l.top);
  }
  if (!n && (n = e.find((l) => {
    const u = l.getBoundingClientRect();
    return u.height >= 8 && u.width >= 8;
  }) ?? null, n)) {
    const l = [...e].reverse().find((u) => {
      const d = u.getBoundingClientRect();
      return d.height >= 8 && d.width >= 8;
    });
    l && l.getBoundingClientRect().bottom < t && (n = l);
  }
  if (!n)
    return null;
  const o = fn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function zt(e, t, n = mn) {
  if (!e)
    return null;
  const r = It(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = zr(e, n), c = xr(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function hn(e, t, n = "auto", r, o = mn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(It(a, r))), c || (c = e.querySelector(It(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), f = Math.max(0, d + s * u - o);
  return n === "auto" ? e.scrollTop = f : e.scrollTo({ top: f, behavior: n }), !0;
}
function os(e, t, n = "smooth", r) {
  return hn(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Kt(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const c = [], i = () => {
    var u;
    if (a) return;
    hn(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (u = n == null ? void 0 : n.onDone) == null || u.call(n));
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
function as(e, t, n) {
  return Kt(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Tt(e, t) {
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
function ss(e, t, n = !0, r = "", o) {
  const [a, s] = _(1);
  return j(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, u = 0;
    const d = It(void 0, o), f = () => {
      if (i) return;
      const p = Array.from(c.querySelectorAll(d));
      if (!p.length)
        return;
      const y = zr(c), b = xr(p, y);
      b && s(b.page);
    }, m = () => {
      i || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, f();
      }));
    }, h = () => {
      if (i) return;
      if (!Array.from(c.querySelectorAll(d)).length) {
        l = setTimeout(h, 120);
        return;
      }
      f(), c.addEventListener("scroll", m, { passive: !0 });
    };
    return h(), () => {
      i = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), c.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const is = `canvas, .react-pdf__Page, .${Tr}, .${Rt}`, Bn = /* @__PURE__ */ new WeakMap();
function cs(e) {
  const t = Number(e.getAttribute(un));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Bn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(is), Bn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function ls(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function us(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(xa()).forEach((r) => {
    const o = fn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = cs(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function ds(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = k(o), c = k(r);
  return c.current = r, De(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
    const f = () => {
      var v;
      if (i) return;
      const P = e.current;
      if (!P) return;
      const g = us(P);
      ls(s.current, g) || (s.current = g, a(g)), u && !d && (d = !0, (v = c.current) == null || v.call(c));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    m();
    const h = window.setTimeout(m, 100), p = window.setTimeout(() => {
      u = !0, m();
    }, 300), y = window.setTimeout(m, 700), b = e.current;
    let w = null;
    return b && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => m()), w.observe(b)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(h), window.clearTimeout(p), window.clearTimeout(y), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const fs = [0, 48, 140, 320, 560], ms = 700, hs = [80, 200, 400], ps = 500, gs = 50, bs = /* @__PURE__ */ new Set([
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
]), ys = 180, Un = [0, 48, 140, 320, 700, 1200];
function vs(e, t) {
  var E;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = k(
    ((E = ye(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
  ), i = k(null), l = k(!1), u = k(r), d = k(null), f = k(null), m = k(null), h = k(null), p = k(a), y = k(""), b = k(n);
  b.current = n;
  const w = $(() => {
    var I;
    (I = d.current) == null || I.call(d), d.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), P = $(() => {
    !l.current && i.current == null || (w(), m.current != null && (clearTimeout(m.current), m.current = null), i.current = null, l.current = !1);
  }, [w]), g = $((I = !1) => {
    h.current != null && (clearTimeout(h.current), h.current = null);
    const T = () => {
      h.current = null, At(p.current, {
        anchor: he(c.current)
      });
    };
    I ? T() : h.current = setTimeout(T, ys);
  }, []), v = $((I) => {
    c.current = he(I), i.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, gs);
  }, []);
  j(() => {
    if (!o)
      return;
    let I = !1, T = null, O = null, C = null;
    const V = () => {
      if (I) return;
      const J = e.current;
      if (!J) {
        C = setTimeout(V, 50);
        return;
      }
      T = J, O = () => {
        if (l.current)
          return;
        const F = zt(T, b.current);
        F && (c.current = F, g());
      }, T.addEventListener("scroll", O, { passive: !0 }), l.current || O();
    };
    return V(), () => {
      I = !0, C != null && clearTimeout(C), T && O && T.removeEventListener("scroll", O);
    };
  }, [o, r, n, e, g]), j(() => {
    if (!o) return;
    const I = e.current;
    if (!I) return;
    const T = (O) => {
      O.metaKey || O.ctrlKey || O.altKey || bs.has(O.key) && P();
    };
    return I.addEventListener("wheel", P, { passive: !0 }), I.addEventListener("touchmove", P, { passive: !0 }), window.addEventListener("keydown", T), () => {
      I.removeEventListener("wheel", P), I.removeEventListener("touchmove", P), window.removeEventListener("keydown", T);
    };
  }, [o, e, P]), De(() => {
    var T;
    if (p.current === a) return;
    g(!0), w(), m.current != null && (clearTimeout(m.current), m.current = null), p.current = a, y.current = "";
    const I = (T = ye(a)) == null ? void 0 : T.anchor;
    c.current = I ? he(I) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, g, w]), j(() => {
    var T;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const I = he(
      ((T = ye(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = I, i.current = I, l.current = !0, w(), d.current = Kt(
      () => e.current,
      I,
      {
        behavior: "auto",
        pane: b.current,
        delaysMs: Un,
        onDone: () => v(I)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(I);
    }, Math.max(...Un) + 160), () => w();
  }, [o, s, a, e, v, w]), j(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, w();
      return;
    }
    const I = i.current ? he(i.current) : he(c.current);
    return l.current = !0, i.current = I, c.current = I, w(), d.current = Kt(
      () => e.current,
      I,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: fs,
        onDone: () => v(I)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(I);
    }, ms), () => {
      w();
    };
  }, [r, o, n, e, v, w]), j(() => () => {
    w(), m.current != null && (clearTimeout(m.current), m.current = null), g(!0);
  }, [w, g]);
  const M = $(() => {
    const I = zt(
      e.current,
      b.current
    );
    return he(I || c.current);
  }, [e]), A = $(() => {
    l.current = !0;
    const I = zt(
      e.current,
      b.current
    ), T = he(I ?? c.current);
    return c.current = T, i.current = T, g(), T;
  }, [e, g]), x = $((I, T, O) => {
    const C = O || b.current, V = Tt(I, T || 1), J = { page: V, fraction: 0 };
    c.current = J, l.current = !0, i.current = J, g(), w(), os(e.current, V, "smooth", C), d.current = as(
      () => e.current,
      V,
      {
        behavior: "auto",
        pane: C,
        delaysMs: hs,
        onDone: () => v(J)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(J);
    }, ps);
  }, [e, v, w, g]), D = $(() => he(c.current), []), N = $(() => l.current, []), R = $(() => {
    if (!l.current || !i.current)
      return;
    const I = he(i.current);
    hn(
      e.current,
      I,
      "auto",
      b.current
    );
  }, [e]);
  return {
    lockFromShell: M,
    beginModeSwitch: A,
    goToPage: x,
    getAnchor: D,
    isRestoring: N,
    repinIfRestoring: R
  };
}
function Ss(e, t) {
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
function Or(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const ws = [0, 80, 200, 400, 800], Ps = 120, Rs = 400;
function Is(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l } = e, u = k(a);
  u.current = a;
  const d = k(s);
  d.current = s;
  const f = k(c);
  f.current = c;
  const m = k(n);
  m.current = n, j(() => {
    var P, g;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Yo(), p = Ss(h, d.current), y = Or(h, p, { jobId: i, documentId: l });
    if (t.current === y)
      return;
    if (p == null) {
      t.current = y, (P = m.current) == null || P.call(m);
      return;
    }
    t.current = y, h && ((g = f.current) == null || g.call(f, h, p));
    const b = [];
    let w = 0;
    for (const v of ws)
      w = Math.max(w, v), b.push(
        setTimeout(() => {
          u.current(p);
        }, v)
      );
    return b.push(
      setTimeout(() => {
        var v;
        (v = m.current) == null || v.call(m);
      }, w + Ps)
    ), () => {
      for (const v of b) clearTimeout(v);
    };
  }, [r, o, i, l, t]);
}
function Es(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Ts(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Rs,
    jobId: c,
    documentId: i,
    applyReaderSearch: l
  } = e, u = k(a);
  u.current = a;
  const d = k(l);
  d.current = l;
  const f = k(0);
  j(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const m = setTimeout(() => {
      var b;
      const h = ((b = globalThis.location) == null ? void 0 : b.search) || "", p = Io(h, o, u.current);
      if (f.current = o, p === null) return;
      const y = `${new URLSearchParams(p).get("block_id") || ""}`.trim();
      t.current = Or(
        { blockId: y },
        o,
        { jobId: c, documentId: i }
      ), (d.current || Es)(p);
    }, s);
    return () => clearTimeout(m);
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
function Ms(e) {
  const t = k(""), [n, r] = _(!1), o = $(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId
  };
  Is(a, t, o), Ts(e, t, n);
}
const et = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function ks(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Hn(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Fr(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Hn(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Hn(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function As(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Fr(r, t, n);
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
function Ls(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const Wn = [250, 500, 1e3, 2e3, 4e3], xt = [80, 160, 320, 640, 1e3, 1500], Vn = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
function pn(e) {
  return _o(e) ? `${e.code || ""}`.trim() : "";
}
function bt(e, t) {
  const n = pn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function _s(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Fr(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = No(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (i) {
      if ((i == null ? void 0 : i.name) === "AbortError") throw i;
      a = i;
      const l = pn(i);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw i;
    }
    const c = xt[Math.min(s, xt.length - 1)];
    if (await qt(c, r), s >= xt.length + 2) throw a;
  }
}
function Ns({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _(et), s = k(o), c = k("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = sn(l) ? l : "";
  return j(() => {
    if (!n || !i) {
      c.current = "", s.current = et, a(et);
      return;
    }
    const d = r === void 0 ? Zo() : r, f = c.current === i;
    if (c.current = i, !d) {
      const P = {
        ...f ? s.current : et,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = P, a(P);
      return;
    }
    const m = new AbortController();
    let h = !1;
    const p = {
      ...f ? s.current : et,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = p, a(p);
    const y = (P) => {
      m.signal.aborted || a((g) => {
        const v = P(g);
        return s.current = v, v;
      });
    }, b = async () => {
      let P = 0;
      for (; !m.signal.aborted; )
        try {
          const g = await d.fetchLayout(i, { signal: m.signal });
          h = !0, y((v) => ({
            ...v,
            layoutByPage: ks(g),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError") return;
          const v = pn(g);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            y((A) => ({
              ...A,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: bt(g, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((A) => ({
              ...A,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((A) => ({
            ...A,
            connection: "connecting",
            jobStatus: l,
            error: bt(g, "正在等待 OCR 版面数据")
          })), await qt(Wn[Math.min(P, Wn.length - 1)], m.signal).catch(() => {
          }), P += 1;
        }
    };
    return (async () => {
      if (await b(), !h || m.signal.aborted) return;
      let P = 0;
      for (; !m.signal.aborted; ) {
        u || y((g) => ({
          ...g,
          connection: g.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: g.error
        }));
        try {
          await d.streamEvents(i, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (g) => {
              if (g.seq <= s.current.lastSeq) return;
              let v;
              try {
                v = await _s(
                  i,
                  g,
                  s.current,
                  m.signal,
                  d
                );
              } catch (M) {
                if ((M == null ? void 0 : M.name) === "AbortError" || m.signal.aborted) throw M;
                y((A) => ({
                  ...A,
                  lastSeq: Math.max(A.lastSeq, g.seq),
                  error: bt(M, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((M) => {
                const A = As(M, g, v);
                return u ? {
                  ...A,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...A,
                  jobStatus: l
                };
              }), P = 0;
            }
          });
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError" || m.signal.aborted) return;
          y((v) => ({
            ...v,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: bt(g, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          y((g) => ({
            ...g,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await qt(Vn[Math.min(P, Vn.length - 1)], m.signal).catch(() => {
        }), P += 1;
      }
    })(), () => m.abort();
  }, [n, r, i, u]), o;
}
const Cs = 2e3;
function Ds(e) {
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
const zs = /* @__PURE__ */ new Set(["book", "translate"]);
function $r(e) {
  return !!(e.jobId && e.sourceUrl && zs.has(e.workflow));
}
function xs(e) {
  return !!($r(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Os() {
  const e = Ea(), t = $r({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = xs({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = k({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !sn(o) && (r.current.running = !0);
  const a = Ns({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = Aa(), u = Ya({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${u}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: f, onZoomChange: m } = ns(e.mode, s, u), h = _a(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: f, shellWidth: i, identityKey: d }
  ), {
    beginModeSwitch: p,
    goToPage: y,
    repinIfRestoring: b
  } = vs(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: u,
    restoreReady: h.primaryNumPages > 0
  });
  j(() => {
    b();
  }, [i, b]);
  const w = ds(
    s,
    h.compareMode,
    h.rowSyncRevision,
    b
  ), P = ss(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${f}-${h.metricsTick}`,
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
  }, [y, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [v, M] = _(null), A = k(null), x = $((C) => {
    A.current && clearTimeout(A.current), M(C), C && (A.current = setTimeout(() => M(null), Cs));
  }, []);
  j(() => () => {
    A.current && clearTimeout(A.current);
  }, []);
  const D = $((C) => {
    const V = Nt(e.regions, C);
    return V ? Dn(V, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), N = $((C, V) => {
    const J = V || h.primaryPane, F = typeof C == "object" && C ? `${C.block_id || ""}`.trim() : "", z = typeof C == "object" && C ? `${C.image_url || ""}`.trim() : "", U = typeof C == "object" && C ? C.page_idx != null ? Number(C.page_idx) + 1 : C.page != null ? Number(C.page) : null : typeof C == "number" ? C + 1 : null, Q = Mo(e.regions, z, U) || Nt(e.regions, F) || (typeof C == "object" ? ko(e.regions, C) : null);
    let te = Q ? Dn(Q, J).page : null;
    te == null && (te = Ds(C)), !(te == null || te < 1) && (x(Q), g(te, J));
  }, [x, g, h.primaryPane, e.regions]);
  Ms({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: P,
    goToPage: g,
    resolveBlockPage: D,
    jobId: e.jobId,
    documentId: e.documentId,
    onAnchorApplied: (C) => {
      x(Nt(e.regions, C.blockId));
    }
  });
  const { setModeKeepingPage: R } = rs({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: p
  });
  j(() => {
    x(null);
  }, [d, x]);
  const E = !e.boot.loading && !e.boot.failed, I = G(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), T = G(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), O = G(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: f,
    onZoomChange: m,
    shell: I,
    panes: h,
    sessionFiles: T,
    rowHeights: w,
    goToPage: g,
    activeRegion: v,
    jumpToAnchor: N,
    setModeKeepingPage: R,
    download: e.download,
    showHud: E,
    viewStateKey: u,
    liveTranslation: a,
    liveTranslationAvailable: n
  }), [e, I, h, T, w, g, v, N, R, E, f, m, u, a, n]);
  return G(() => ({
    ...O,
    currentPage: P
  }), [O, P]);
}
const Fs = [
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
], $s = [
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
function js(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Fs)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Bs(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Us = ".reader-notes-panel";
function Hs(e) {
  return e instanceof Element ? !!e.closest(Us) : !1;
}
function Ws(e) {
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
  j(() => {
    if (!l)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Bs(d.target) || Hs(d.target))
        return;
      const f = d.key, m = js(f);
      if (m) {
        if (m.mode) {
          if (n && m.mode !== "source")
            return;
          d.preventDefault(), r(m.mode);
          return;
        }
        if (!(m.requiresPages && c <= 0))
          switch (d.preventDefault(), m.action) {
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
              i(Tt(s + 1, c));
              return;
            case "prev-page":
              i(Tt(s - 1, c));
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
    return window.addEventListener("keydown", u), () => window.removeEventListener("keydown", u);
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
const Vs = "retainpdf:soft-reader-close";
function Js() {
  return new URL("./index.html", window.location.href).href;
}
function Ks() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Vs },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function qs(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Gs() {
  if (!(typeof window > "u") && !Ks()) {
    if (qs(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Js());
  }
}
function Zs({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ B(
    "button",
    {
      id: "reader-close-home-btn",
      type: "button",
      className: "reader-close-home-btn",
      "aria-label": "返回主页",
      title: "返回主页",
      onClick: () => {
        e == null || e(), Gs();
      },
      children: [
        /* @__PURE__ */ S(Sr, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
        /* @__PURE__ */ S("span", { className: "reader-close-home-label", children: "关闭" })
      ]
    }
  );
}
let Jn = !1;
function Ys() {
  if (Jn)
    return;
  const e = at().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (jo.GlobalWorkerOptions.workerSrc = e, Jn = !0);
}
const Xs = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Qs(e, t, n) {
  return e.flatMap((r) => {
    if (!Xs.has(vr(r.region))) return [];
    const o = cn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Kn(e, t, n) {
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
async function ei(e) {
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
const ti = "reader-text-hover-copy", ni = "reader-text-hover-id", jr = "reader-text-hover-tools", Br = 26, Ur = 190;
function Hr(e) {
  return e.height < Br * 2 || e.width < Ur;
}
function ri({
  target: e,
  pane: t = "source"
}) {
  const [n, r] = _("idle"), [o, a] = _("idle"), s = k([]), c = (e == null ? void 0 : e.itemId) || "";
  if (j(() => {
    r("idle"), a("idle");
    const m = s.current;
    return () => {
      m.forEach((h) => window.clearTimeout(h)), s.current = [];
    };
  }, [c]), !e) return null;
  const i = Ao(e.highlight.region, t), l = vr(e.highlight.region), u = (m, h) => async (p) => {
    p.preventDefault(), p.stopPropagation();
    const y = await ei(m);
    h(y ? "copied" : "failed"), s.current.push(window.setTimeout(() => h("idle"), 1200));
  }, d = l === "formula" ? "复制 LaTeX" : "复制", f = Hr(e.rect);
  return /* @__PURE__ */ S("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ S(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": l,
      style: e.rect,
      children: /* @__PURE__ */ B(
        "div",
        {
          className: jr,
          "data-placement": f ? "outside" : "inside",
          children: [
            /* @__PURE__ */ S(
              "button",
              {
                type: "button",
                className: ni,
                "data-copy-state": o,
                "aria-label": `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onPointerDown: (m) => m.stopPropagation(),
                onClick: u(e.itemId, a),
                children: o === "copied" ? "已复制编号" : e.itemId
              }
            ),
            i ? /* @__PURE__ */ S(
              "button",
              {
                type: "button",
                className: ti,
                "data-copy-state": n,
                "aria-label": t === "translated" ? "复制这段译文" : "复制这段原文",
                onPointerDown: (m) => m.stopPropagation(),
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
function oi(e, t) {
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
function ai(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = cn(
      oi(e, a),
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
const si = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', ii = 256, tt = /* @__PURE__ */ new Map();
function ci(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function li(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ho(t, { bareLatex: !0 }), o = ci(n), a = Wo(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = tt.get(t);
  if (!s && (s = Vo(o, r), tt.set(t, s), tt.size > ii)) {
    const c = tt.keys().next().value;
    c !== void 0 && tt.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Ot(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Pe(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function ui(e, t) {
  const n = e.typography, r = Pe(t) || 1, o = Pe(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Ot(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Pe(n == null ? void 0 : n.fit_min_font_size_pt), u = Pe(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), m = o ? o * r : i, h = Pe(n == null ? void 0 : n.leading_em), p = [
    Pe(n == null ? void 0 : n.padding_top_pt) || 0,
    Pe(n == null ? void 0 : n.padding_right_pt) || 0,
    Pe(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Pe(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || si,
    fontSizePx: Math.max(d, Math.min(f, m)),
    minFontSizePx: d,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: h ? 1 + h : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Ot(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Ot(e.kind) ? "center" : "justify",
    padding: p,
    exact: !!o
  };
}
function di(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), c = (d) => {
    const f = s.get(d);
    if (f !== void 0) return f;
    const { width: m, height: h } = e(d), p = m <= t + 0.5 && h <= n + 0.5;
    return s.set(d, p), p;
  };
  let i = o, l = a, u = Math.min(r.requestedFontSizePx, l);
  if (c(u)) {
    if (!r.exact) {
      i = u;
      for (let d = 0; d < 6 && l > i; d += 1) {
        const f = (i + l) / 2;
        c(f) ? (u = f, i = f) : l = f;
      }
    }
  } else {
    l = u, u = i;
    for (let d = 0; d < 8 && l > i; d += 1) {
      const f = (i + l) / 2;
      c(f) ? (u = f, i = f) : l = f;
    }
  }
  return Math.max(o, u);
}
const fi = 512, nt = /* @__PURE__ */ new Map();
let Gt = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Gt += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Gt += 1;
}));
function mi(e, t, n, r) {
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
function hi({ item: e, pageScale: t }) {
  const n = k(null), r = G(
    () => li(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = G(
    () => ui(e, t),
    [e, t]
  );
  j(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      d && a(f);
    }), () => {
      d = !1;
    };
  }, [r]), De(() => {
    const d = n.current;
    if (!d) return;
    const [f, m, h, p] = s.padding, y = Math.max(1, e.rect.width - p - m), b = Math.max(1, e.rect.height - f - h), w = mi(o, y, b, s);
    let P = nt.get(w);
    if (P === void 0 && (P = di(
      (g) => (d.style.fontSize = `${g}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      y,
      b,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), nt.set(w, P), nt.size > fi)) {
      const g = nt.keys().next().value;
      g !== void 0 && nt.delete(g);
    }
    d.style.fontSize = `${P.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [c, i, l, u] = s.padding;
  return /* @__PURE__ */ S(
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": s.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${c}px ${i}px ${l}px ${u}px`
      },
      children: /* @__PURE__ */ S(
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
function pi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = G(
    () => ai(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ S(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ S(
        hi,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const gi = nn(pi), Wr = 1.414;
function bi({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  syncedMinHeight: a = 0,
  onMetrics: s,
  cachedAspect: c,
  onAspectChange: i,
  sentinelRef: l,
  regionHighlight: u = null,
  regionTargets: d = [],
  hoveredRegionId: f,
  onHoverRegion: m,
  liveTranslationLayout: h,
  liveTranslationPage: p,
  showLiveTranslation: y = r === "source"
}) {
  const b = k(c ?? Wr), [w, P] = _(b.current);
  j(() => {
    c != null && Math.abs(c - b.current) >= 1e-3 && (b.current = c, P(c));
  }, [c]);
  const g = k(l);
  g.current = l;
  const v = k((F) => {
    var z;
    (z = g.current) == null || z.call(g, F);
  }).current, M = Math.max(120, Math.floor(t * w)), A = Math.max(M, Math.ceil(a || 0)), x = cn(u, t, M), D = G(
    () => Qs(d, t, M),
    [M, d, t]
  ), [N, R] = _(null), E = typeof m == "function", I = E ? f ?? null : N, T = (F) => {
    E ? F !== (f ?? null) && (m == null || m(F)) : R((z) => z === F ? z : F);
  }, O = G(
    () => D.find((F) => F.itemId === I) || null,
    [I, D]
  ), C = (F) => {
    var X, ee;
    if (F.pointerType === "touch") return;
    if (F.buttons !== 0) {
      T(null);
      return;
    }
    if ((ee = (X = F.target) == null ? void 0 : X.closest) != null && ee.call(X, `.${jr}`)) return;
    const z = F.currentTarget.getBoundingClientRect(), U = F.clientX - z.left, Q = F.clientY - z.top, te = O == null ? void 0 : O.rect;
    if (te && Hr(te) && U >= te.left - 4 && U <= te.left + Ur && Q >= te.top - Br && Q <= te.top) return;
    const re = Kn(D, U, Q);
    T((re == null ? void 0 : re.itemId) || null);
  }, V = (F) => {
    if (F.pointerType === "mouse") return;
    const z = F.currentTarget.getBoundingClientRect(), U = Kn(
      D,
      F.clientX - z.left,
      F.clientY - z.top
    );
    T((U == null ? void 0 : U.itemId) || null);
  }, J = (F) => {
    !Number.isFinite(F) || F <= 0 || Math.abs(b.current - F) < 1e-3 || (b.current = F, P(F), i == null || i(e, F));
  };
  return /* @__PURE__ */ B(
    "div",
    {
      ref: v,
      [qe]: e,
      [st]: r,
      [un]: M,
      className: dn,
      onPointerMoveCapture: C,
      onPointerDown: V,
      onPointerLeave: (F) => {
        F.pointerType === "mouse" && T(null);
      },
      style: {
        width: t,
        height: A,
        minHeight: A
      },
      children: [
        o ? /* @__PURE__ */ S(
          Bo,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: !0,
            renderAnnotationLayer: !1,
            className: Tr,
            loading: /* @__PURE__ */ S(
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
                  const U = z.height / z.width;
                  J(U);
                }
              } catch {
              }
              s == null || s();
            },
            onRenderSuccess: () => {
              s == null || s();
            }
          }
        ) : /* @__PURE__ */ S(
          "div",
          {
            className: Rt,
            style: { width: t, height: M },
            "aria-hidden": !0
          }
        ),
        x ? /* @__PURE__ */ S(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: x,
            "aria-hidden": "true"
          }
        ) : null,
        o && y ? /* @__PURE__ */ S(
          gi,
          {
            layoutPage: h,
            pageState: p,
            width: t,
            height: M
          }
        ) : null,
        /* @__PURE__ */ S(
          ri,
          {
            target: o ? O : null,
            pane: r === "translated" ? "translated" : "source"
          }
        )
      ]
    }
  );
}
const yi = nn(bi), Ft = 5, vi = "120% 0px", Si = 120;
let qn = 1;
const Gn = /* @__PURE__ */ new WeakMap();
function wi(e) {
  if (!e) return 0;
  const t = Gn.get(e);
  if (t) return t;
  const n = qn;
  return qn += 1, Gn.set(e, n), n;
}
function Pi() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Ri = po(
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
    onMetrics: u,
    onLoadSuccess: d,
    onLoadError: f,
    onNumPagesChange: m,
    activeRegion: h = null,
    regions: p = [],
    readerMetadata: y = null,
    hoveredRegionId: b = null,
    onHoverRegion: w,
    liveTranslation: P,
    showLiveTranslation: g = t === "source",
    liveTranslationPendingLabel: v = "",
    paneAction: M
  }, A) {
    Ys();
    const { file: x, loading: D, error: N } = wa(n, r), R = `${n}\0${wi(x)}`, E = k(R);
    E.current = R;
    const I = G(
      () => ya(x),
      [x, n]
    ), [T, O] = _(0), [C, V] = _(""), [J, F] = _(null), [z, U] = _(480), Q = k(null), te = k(0), re = G(() => Pi(), []), X = G(() => ({
      cMapUrl: at().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: at().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    rn(A, () => J, [J]), j(() => {
      const L = (K) => {
        te.current = K, U(K);
      }, W = (K) => {
        const Y = Ja(K, te.current);
        if (Y !== "ignore") {
          if (Q.current && clearTimeout(Q.current), Y === "immediate") {
            L(K);
            return;
          }
          Q.current = setTimeout(() => L(K), Ka);
        }
      }, H = !!(i && i >= 80);
      W(H ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const oe = !H && c && typeof ResizeObserver < "u" ? new ResizeObserver((K) => {
        var Y, ie;
        W(((ie = (Y = K[0]) == null ? void 0 : Y.contentRect) == null ? void 0 : ie.width) ?? c.clientWidth);
      }) : null;
      return oe && c && oe.observe(c), () => {
        oe == null || oe.disconnect(), Q.current && clearTimeout(Q.current);
      };
    }, [i, c, a]);
    const ee = G(
      () => Ha(z, o),
      [z, o]
    ), [ve, Oe] = _(() => /* @__PURE__ */ new Map()), [Te, mt] = _(() => /* @__PURE__ */ new Set()), [Lt, ne] = _(() => /* @__PURE__ */ new Set()), ae = k(/* @__PURE__ */ new Map()), se = k(null), ue = k(/* @__PURE__ */ new Map()), de = $((L, W) => {
      Oe((H) => {
        if (H.get(L) === W) return H;
        const q = new Map(H);
        return q.set(L, W), q;
      });
    }, []), ce = $((L, W) => {
      const H = ae.current, q = H.get(L);
      if (q && se.current)
        try {
          se.current.unobserve(q);
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
    }, []), Fe = k(/* @__PURE__ */ new Map()), $e = $((L) => {
      const W = Fe.current;
      let H = W.get(L);
      return H || (H = (q) => ce(L, q), W.set(L, H)), H;
    }, [ce]);
    j(() => {
      if (typeof IntersectionObserver > "u") return;
      const L = ue.current, W = new IntersectionObserver(
        (H) => {
          const q = [], oe = [];
          for (const K of H) {
            const Y = K.target, ie = fn(Y);
            Number.isFinite(ie) && (K.isIntersecting ? q : oe).push(ie);
          }
          if ((q.length || oe.length) && mt((K) => {
            let Y = null;
            for (const ie of q)
              K.has(ie) || (Y = Y || new Set(K), Y.add(ie));
            for (const ie of oe)
              K.has(ie) && (Y = Y || new Set(K), Y.delete(ie));
            return Y || K;
          }), q.length) {
            for (const K of q) {
              const Y = L.get(K);
              Y && (clearTimeout(Y), L.delete(K));
            }
            ne((K) => {
              let Y = null;
              for (const ie of q)
                K.has(ie) || (Y = Y || new Set(K), Y.add(ie));
              return Y || K;
            });
          }
          for (const K of oe)
            L.has(K) || L.set(K, setTimeout(() => {
              L.delete(K), ne((Y) => {
                if (!Y.has(K)) return Y;
                const ie = new Set(Y);
                return ie.delete(K), ie;
              });
            }, Si));
        },
        { root: c, rootMargin: vi, threshold: 0 }
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
    }, [c]), De(() => {
      O(0), V(""), mt(/* @__PURE__ */ new Set()), ne(/* @__PURE__ */ new Set()), Oe(/* @__PURE__ */ new Map()), ae.current.clear();
      const L = ue.current;
      for (const W of L.values()) clearTimeout(W);
      L.clear(), m == null || m(0, t);
    }, [R, m, t]);
    const Ye = $(
      ({ numPages: L }) => {
        E.current === R && (O(L), V(""), m == null || m(L, t), d == null || d({ numPages: L, pane: t }));
      },
      [R, d, m, t]
    ), _t = $(
      (L) => {
        if (E.current !== R) return;
        const W = (L == null ? void 0 : L.message) || "PDF 解析失败";
        V(W), O(0), m == null || m(0, t), f == null || f(L, t);
      },
      [R, f, m, t]
    ), Me = G(
      () => T > 0 ? Array.from({ length: T }, (L, W) => W + 1) : [],
      [T]
    );
    j(() => {
      typeof IntersectionObserver < "u" || ne(new Set(Me));
    }, [Me]);
    const ke = G(
      () => zn(h, y, t),
      [h, y, t]
    ), Ae = G(() => {
      const L = /* @__PURE__ */ new Map();
      for (const W of p) {
        const H = zn(W, y, t);
        if (!H) continue;
        const q = L.get(H.box.page) || [];
        q.push(H), L.set(H.box.page, q);
      }
      return L;
    }, [t, y, p]), Xe = G(() => {
      const L = /* @__PURE__ */ new Set();
      if (!b) return L;
      for (const [W, H] of Ae)
        H.some((q) => q.itemId === b) && L.add(W);
      return L;
    }, [b, Ae]), ht = G(() => {
      if (T === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(Me);
      if (Te.size === 0) {
        const H = Math.min(T, Ft * 2 + 1);
        return new Set(Array.from({ length: H }, (q, oe) => oe + 1));
      }
      const W = /* @__PURE__ */ new Set();
      for (const H of Te)
        for (let q = -Ft; q <= Ft; q++) {
          const oe = H + q;
          oe >= 1 && oe <= T && W.add(oe);
        }
      return W;
    }, [T, Me, c, a, Te]), pt = !n || !!N || !!C, je = n && (N || C) || s;
    return /* @__PURE__ */ B(
      "section",
      {
        ref: F,
        className: `reader-panel ${za}${a ? "" : " is-hidden"}`,
        [st]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (P == null ? void 0 : P.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          M ? /* @__PURE__ */ S("div", { className: "reader-react-pdf-pane-action", children: M }) : null,
          v ? /* @__PURE__ */ B("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ S("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ S("span", { children: v })
          ] }) : null,
          pt && !D ? /* @__PURE__ */ S("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: je }) : null,
          D ? /* @__PURE__ */ S("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          I && !N ? /* @__PURE__ */ S("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ S(
            Uo,
            {
              file: I,
              loading: null,
              error: null,
              options: X,
              onLoadSuccess: Ye,
              onLoadError: _t,
              className: "reader-react-pdf-document",
              children: Me.map((L) => {
                if (ht.has(L))
                  return /* @__PURE__ */ S(
                    yi,
                    {
                      pane: t,
                      pageNumber: L,
                      width: ee,
                      devicePixelRatio: re,
                      active: Lt.has(L),
                      syncedMinHeight: (l == null ? void 0 : l.get(L)) || 0,
                      onMetrics: u,
                      cachedAspect: ve.get(L),
                      onAspectChange: de,
                      sentinelRef: $e(L),
                      regionHighlight: (ke == null ? void 0 : ke.box.page) === L ? ke : null,
                      regionTargets: Ae.get(L),
                      hoveredRegionId: b && Xe.has(L) ? b : null,
                      onHoverRegion: w,
                      liveTranslationLayout: P == null ? void 0 : P.layoutByPage.get(L - 1),
                      liveTranslationPage: P == null ? void 0 : P.pagesByPage.get(L - 1),
                      showLiveTranslation: g
                    },
                    `${t}-${L}`
                  );
                const H = ve.get(L) ?? Wr, q = Math.max(120, Math.floor(ee * H)), oe = Math.max(q, Math.ceil((l == null ? void 0 : l.get(L)) || 0));
                return /* @__PURE__ */ S(
                  "div",
                  {
                    ref: $e(L),
                    [qe]: L,
                    [st]: t,
                    [un]: q,
                    className: dn,
                    style: {
                      width: ee,
                      height: oe,
                      minHeight: oe
                    },
                    children: /* @__PURE__ */ S(
                      "div",
                      {
                        className: Rt,
                        style: { width: ee, height: q },
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
), Zn = nn(Ri), Vr = on(null), Jr = on(null);
function Ii({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ S(Vr.Provider, { value: e, children: /* @__PURE__ */ S(Jr.Provider, { value: t, children: n }) });
}
function ft() {
  return an(Vr);
}
function Ei() {
  return an(Jr);
}
const Ti = () => () => {
}, Yn = () => null;
function Mi({
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
function ki(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Ai(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Li(e) {
  const t = ft(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? dt, h = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, p = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, b = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, P = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", g = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", v = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, M = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, A = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), x = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), D = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), N = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), E = (t == null ? void 0 : t.regionHover) ?? null, [I, T] = _(null), O = br(
    E ? E.subscribe : Ti,
    E ? () => E.get().itemId : Yn,
    E ? () => E.get().itemId : Yn
  ), C = E ? O : I, V = $((U) => {
    E ? E.set(U, "pdf") : T(U);
  }, [E]), J = Mi({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), z = Number.isFinite(h) && h > 0 ? ki(
    h,
    n || r,
    typeof document > "u" ? h * 2 : document.documentElement.clientWidth
  ) : null;
  return /* @__PURE__ */ S(
    "div",
    {
      ref: d,
      className: Da,
      "data-reader-region-count": N.length,
      "data-reader-structured-region-count": N.filter(Lo).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ B(
        "main",
        {
          className: `${Ca} reader-mode-${J.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            y ? /* @__PURE__ */ S(
              Zn,
              {
                pane: "source",
                url: P,
                preloadedFile: v,
                userZoom: m,
                visible: J.showSource,
                scrollRoot: f,
                pageWidthOverride: z,
                rowHeights: J.compareMode ? p : void 0,
                onMetrics: A,
                emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: x,
                activeRegion: D,
                regions: N,
                readerMetadata: R,
                hoveredRegionId: C,
                onHoverRegion: V,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? Ai(o) : "",
                paneAction: u ? /* @__PURE__ */ B(tn, { children: [
                  e.sourcePaneAction,
                  /* @__PURE__ */ S(
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
            b ? /* @__PURE__ */ S(
              Zn,
              {
                pane: "translated",
                url: g,
                preloadedFile: M,
                userZoom: m,
                visible: J.showTranslated,
                scrollRoot: f,
                pageWidthOverride: z,
                rowHeights: J.compareMode ? p : void 0,
                onMetrics: A,
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
const _i = [
  { id: "source", label: "源文件", Icon: wr },
  { id: "compare", label: "对照", Icon: Pr },
  { id: "translated", label: "翻译文件", Icon: Rr }
];
function Ni(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Ci(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Di(e) {
  const t = ft(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Ni(a.state) : "";
  return /* @__PURE__ */ B("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ B(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ S(Do, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ S("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ S("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: _i.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, f = Ci({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ B(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${d ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": d,
          "aria-label": l,
          title: f ? `${l} 需要文档任务` : l,
          disabled: f,
          onClick: () => o(i),
          children: [
            /* @__PURE__ */ S(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ S("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        i
      );
    }) })
  ] });
}
const zi = {
  markdown: { label: "Markdown", short: "MD", Icon: zo, needsJob: !0 }
}, xi = Ar.map(
  (e) => ({ id: e, ...zi[e] })
), Oi = {
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
    Icon: xo,
    adapterKey: "renderReaderTerminal",
    slot: "terminal",
    ariaLabel: "AI（agent 终端）",
    keepMounted: !0
  }
}, Kr = Lr.map(
  (e) => ({ id: e, ...Oi[e] })
);
function Fi(e) {
  return [
    ...xi.map(({ id: t, label: n, short: r, Icon: o, needsJob: a }) => ({
      id: t,
      label: n,
      short: r,
      Icon: o,
      needsJob: a
    })),
    ...Kr.filter((t) => e(t.adapterKey)).map(({ id: t, label: n, short: r, Icon: o }) => ({
      id: t,
      label: n,
      short: r,
      Icon: o,
      needsJob: !1
    }))
  ];
}
function $i() {
  const e = me();
  return Fi((t) => typeof (e == null ? void 0 : e[t]) == "function");
}
function ji(e) {
  const t = ft(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = $i();
  return n ? /* @__PURE__ */ B("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ S("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: c.map(({ id: i, label: l, Icon: u, needsJob: d }) => {
      const f = n === i, m = d && o, h = r == null ? void 0 : r[i];
      return /* @__PURE__ */ B(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": f,
          className: `reader-assistant-dock-tab${f ? " is-active" : ""}`,
          title: m ? `${l} 需打开任务阅读` : l,
          disabled: m,
          onClick: () => a(i),
          children: [
            /* @__PURE__ */ S(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
            /* @__PURE__ */ S("span", { className: "reader-assistant-dock-tab-label", children: l }),
            h ? /* @__PURE__ */ S("span", { className: "reader-assistant-dock-badge", children: h }) : null
          ]
        },
        i
      );
    }) }),
    /* @__PURE__ */ S(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ S(Sr, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ S("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: c.map(({ id: i, label: l, short: u, Icon: d, needsJob: f }) => {
    const m = f && o, h = r == null ? void 0 : r[i];
    return /* @__PURE__ */ B(
      "button",
      {
        type: "button",
        className: "reader-assistant-rail-button",
        "aria-label": `打开${l}`,
        title: m ? `${l} 需打开任务阅读` : l,
        disabled: m,
        onClick: () => a(i),
        children: [
          /* @__PURE__ */ S(d, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
          /* @__PURE__ */ S("span", { children: u }),
          h ? /* @__PURE__ */ S("span", { className: "reader-assistant-dock-badge", children: h }) : null
        ]
      },
      i
    );
  }) });
}
function Bi(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Ui(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Hi(e) {
  return e / 100 * window.innerHeight;
}
function Wi(e) {
  return e / 100 * window.innerWidth;
}
function Vi(e) {
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
  const [o, a] = Vi(n);
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
      r = Ui(t, o);
      break;
    }
    case "em": {
      r = Bi(t, o);
      break;
    }
    case "vh": {
      r = Hi(o);
      break;
    }
    case "vw": {
      r = Wi(o);
      break;
    }
  }
  return r;
}
function fe(e) {
  return parseFloat(e.toFixed(3));
}
function Ge({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Zt(e) {
  const { panels: t } = e, n = Ge({ group: e });
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
    let c;
    if (a.defaultSize !== void 0) {
      const u = rt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = fe(u / n * 100);
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
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = rt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = fe(u / n * 100);
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
function Z(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Yt(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Ji : Ki
  );
}
function Ji(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Ki(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function qr(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Gr(e, t) {
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
function qi({
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
    const { x: c, y: i } = Gr(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return Z(o, "No rect found"), o;
}
let yt;
function Gi() {
  return yt === void 0 && (typeof matchMedia == "function" ? yt = !!matchMedia("(pointer:coarse)").matches : yt = !1), yt;
}
function Zr(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Yt(
    n,
    Array.from(t.children).filter(qr).map((h) => ({ element: h }))
  ).map(({ element: h }) => h), s = [];
  let c = !1, i = !1, l = -1, u = -1, d = 0, f, m = [];
  {
    let h = -1;
    for (const p of a)
      p.hasAttribute("data-panel") && (h++, p.hasAttribute("data-disabled") || (d++, l === -1 && (l = h), u = h));
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
          if (f) {
            const b = f.element.getBoundingClientRect(), w = p.getBoundingClientRect();
            let P;
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
              ), v = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (m.length) {
                case 0: {
                  P = [
                    g,
                    v
                  ];
                  break;
                }
                case 1: {
                  const M = m[0], A = qi({
                    orientation: n,
                    rects: [b, w],
                    targetRect: M.element.getBoundingClientRect()
                  });
                  P = [
                    M,
                    A === b ? v : g
                  ];
                  break;
                }
                default: {
                  P = m;
                  break;
                }
              }
            } else
              m.length ? P = m : P = [
                n === "horizontal" ? new DOMRect(
                  b.right,
                  w.top,
                  w.left - b.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  b.bottom,
                  w.width,
                  w.top - b.bottom
                )
              ];
            for (const g of P) {
              let v = "width" in g ? g : g.element.getBoundingClientRect();
              const M = Gi() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
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
              const A = h <= l || h > u;
              !c && !A && s.push({
                group: e,
                groupSize: Ge({ group: e }),
                panels: [f, y],
                separator: "width" in g ? void 0 : g,
                rect: v
              }), c = !1;
            }
          }
          i = !1, f = y, m = [];
        }
      } else if (p.hasAttribute("data-separator")) {
        p.ariaDisabled !== null && (c = !0);
        const y = o.find(
          (b) => b.element === p
        );
        y ? m.push(y) : (f = void 0, m = []);
      } else
        i = !0;
  }
  return s;
}
var Ie;
class Yr {
  constructor() {
    Nn(this, Ie, {});
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
    Cn(this, Ie, {});
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
const gn = new Yr();
function _e() {
  return Je;
}
function Zi(e) {
  return gn.addListener("change", e);
}
function Yi(e) {
  const t = Je, n = { ...Je };
  n.cursorFlags = e, Je = n, gn.emit("change", {
    prev: t,
    next: n
  });
}
function Ke(e) {
  const t = Je;
  Je = e, gn.emit("change", {
    prev: t,
    next: e
  });
}
const Xi = (e) => e, $t = () => {
}, Xr = 1, Qr = 2, eo = 4, to = 8, Xn = 3, Qn = 12;
let vt;
function er() {
  return vt === void 0 && (vt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (vt = !0)), vt;
}
function Qi({
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
        if (e && er()) {
          const a = (e & Xr) !== 0, s = (e & Qr) !== 0, c = (e & eo) !== 0, i = (e & to) !== 0;
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
    return er() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const tr = /* @__PURE__ */ new WeakMap();
function bn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = tr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = _e();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Qi({
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
  tr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let be = /* @__PURE__ */ new Map();
const no = new Yr();
function ec(e) {
  be = new Map(be), be.delete(e);
}
function nr(e, t) {
  for (const [n] of be)
    if (n.id === e)
      return n;
}
function Ee(e, t) {
  for (const [n, r] of be)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function ze() {
  return be;
}
function yn(e, t) {
  return no.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Re(e, t, n) {
  const r = be.get(e);
  be = new Map(be), be.set(e, t), no.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function ro(e) {
  const t = _e();
  let n = !1;
  switch (t.state) {
    case "active":
      Ke({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (bn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Ee(r.group.id, !0);
        Re(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function rr(e) {
  e.defaultPrevented || ro(e.currentTarget);
}
function tc(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Gr(n, a.rect);
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
function nc(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function rc(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: sr(e),
    b: sr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  Z(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: ar(or(n.a)),
    b: ar(or(n.b))
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
const oc = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function ac(e) {
  const t = getComputedStyle(oo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function sc(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || ac(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || oc.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function or(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (Z(n, "Missing node"), sc(n)) return n;
  }
  return null;
}
function ar(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function sr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = oo(e);
  return t;
}
function oo(e) {
  const { parentNode: t } = e;
  return nc(t) ? t.host : t;
}
function ic(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function cc({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!qr(n) || n.contains(e) || e.contains(n))
    return !0;
  if (rc(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (ic(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function vn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Zr(o), s = tc(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && cc({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function lc(e, t) {
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
    maxSize: c = 100,
    minSize: i = 0
  } = t;
  if (s && !e)
    return n;
  if (ge(r, i) < 0)
    if (a) {
      const l = (o + i) / 2;
      ge(r, l) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(c, r), r = fe(r), r;
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
  const s = a === "imperative-api", c = Object.values(t), i = Object.values(o), l = [...c], [u, d] = r;
  Z(u != null, "Invalid first pivot index"), Z(d != null, "Invalid second pivot index");
  let f = 0;
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
          collapsible: w,
          minSize: P = 0
        } = y;
        if (w) {
          const g = c[p];
          if (Z(
            g != null,
            `Previous layout not found for panel index ${p}`
          ), le(g, b)) {
            const v = P - g;
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
          collapsible: w,
          minSize: P = 0
        } = y;
        if (w) {
          const g = c[p];
          if (Z(
            g != null,
            `Previous layout not found for panel index ${p}`
          ), le(g, P)) {
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
      const b = c[p], { collapsible: w, collapsedSize: P, minSize: g } = y;
      if (w && ge(b, g) < 0)
        if (e > 0) {
          const v = g - P, M = v / 2, A = b + e;
          ge(A, g) < 0 && (e = ge(e, M) <= 0 ? 0 : v);
        } else {
          const v = g - P, M = 100 - v / 2, A = b - e;
          ge(A, g) < 0 && (e = ge(100 + e, M) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const p = e < 0 ? 1 : -1;
    let y = e < 0 ? d : u, b = 0;
    for (; ; ) {
      const P = c[y];
      Z(
        P != null,
        `Previous layout not found for panel index ${y}`
      );
      const g = We({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: P,
        size: 100
      }) - P;
      if (b += g, y += p, y < 0 || y >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(b));
    e = e < 0 ? 0 - w : w;
  }
  {
    let p = e < 0 ? u : d;
    for (; p >= 0 && p < n.length; ) {
      const y = Math.abs(e) - Math.abs(f), b = c[p];
      Z(
        b != null,
        `Previous layout not found for panel index ${p}`
      );
      const w = b - y, P = We({
        overrideDisabledPanels: s,
        panelConstraints: n[p],
        prevSize: b,
        size: w
      });
      if (!le(b, P) && (f += b - P, l[p] = P, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? p-- : p++;
    }
  }
  if (lc(i, l))
    return o;
  {
    const p = e < 0 ? d : u, y = c[p];
    Z(
      y != null,
      `Previous layout not found for panel index ${p}`
    );
    const b = y + f, w = We({
      overrideDisabledPanels: s,
      panelConstraints: n[p],
      prevSize: y,
      size: b
    });
    if (l[p] = w, !le(w, b)) {
      let P = b - w, g = e < 0 ? d : u;
      for (; g >= 0 && g < n.length; ) {
        const v = l[g];
        Z(
          v != null,
          `Previous layout not found for panel index ${g}`
        );
        const M = v + P, A = We({
          overrideDisabledPanels: s,
          panelConstraints: n[g],
          prevSize: v,
          size: M
        });
        if (le(v, A) || (P -= A - v, l[g] = A), le(P, 0))
          break;
        e > 0 ? g-- : g++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (p, y) => y + p,
    0
  );
  if (!le(m, 100, 0.1))
    return o;
  const h = Object.keys(o);
  return l.reduce((p, y, b) => (p[h[b]] = y, p), {});
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
    (c, i) => c + i,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((c) => `${c}%`).join(", ")}`
    );
  if (!le(o, 100) && r.length > 0)
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      Z(i != null, `No layout data found for index ${c}`);
      const l = 100 / o * i;
      r[c] = l;
    }
  let a = 0;
  for (let c = 0; c < t.length; c++) {
    const i = n[c];
    Z(i != null, `No layout data found for index ${c}`);
    const l = r[c];
    Z(l != null, `No layout data found for index ${c}`);
    const u = We({
      overrideDisabledPanels: !0,
      panelConstraints: t[c],
      prevSize: i,
      size: l
    });
    l != u && (a += l - u, r[c] = u);
  }
  if (!le(a, 0))
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      Z(i != null, `No layout data found for index ${c}`);
      const l = i + a, u = We({
        overrideDisabledPanels: !0,
        panelConstraints: t[c],
        prevSize: i,
        size: l
      });
      if (i !== u && (a -= u - i, r[c] = u, le(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((c, i, l) => (c[s[l]] = i, c), {});
}
function ao({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = ze();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: d,
        layout: f,
        groupSize: m,
        separatorToPanels: h
      }
    ] of i)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: d,
          group: l,
          groupSize: m,
          layout: f,
          separatorToPanels: h
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
    prevLayout: u,
    derivedPanelConstraints: d
  }) => {
    const f = a(), m = l.findIndex((y) => y.id === t), h = m === 0, p = m === l.length - 1;
    if (p && i < f && (h || l.slice(0, m).every((y, b) => {
      const w = d[b];
      return (w == null ? void 0 : w.collapsible) && le(w.collapsedSize, u[w.panelId]);
    }))) {
      const y = l.slice(0, m).reduce((b, w) => b + u[w.id], 0);
      return {
        ...u,
        [t]: fe(100 - y)
      };
    }
    return ct({
      delta: p ? f - i : i - f,
      initialLayout: u,
      panelConstraints: d,
      pivotIndices: p ? [m - 1, m] : [m, m + 1],
      prevLayout: u,
      trigger: "imperative-api"
    });
  }, c = (i) => {
    const l = a();
    if (i === l)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      group: f,
      groupSize: m,
      layout: h,
      separatorToPanels: p
    } = n(), y = s({
      nextSize: i,
      panels: f.panels,
      prevLayout: h,
      derivedPanelConstraints: d
    }), b = Ce({
      layout: y,
      panelConstraints: d
    });
    Ne(h, b) || Re(f, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: m,
      layout: b,
      separatorToPanels: p
    });
  };
  return {
    collapse: () => {
      const { collapsible: i, collapsedSize: l } = r(), { mutableValues: u } = o(), d = a();
      i && d !== l && (u.expandToSize = d, c(l));
    },
    expand: () => {
      const { collapsible: i, collapsedSize: l, minSize: u } = r(), { mutableValues: d } = o(), f = a();
      if (i && f === l) {
        let m = d.expandToSize ?? u;
        m === 0 && (m = 1), c(m);
      }
    },
    getSize: () => {
      const { group: i } = n(), l = a(), { element: u } = o(), d = i.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: l,
        inPixels: d
      };
    },
    isCollapsed: () => {
      const { collapsible: i, collapsedSize: l } = r(), u = a();
      return i && le(l, u);
    },
    resize: (i) => {
      const { group: l } = n(), { element: u } = o(), d = Ge({ group: l }), f = rt({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), m = fe(f / d * 100);
      c(m);
    }
  };
}
function ir(e) {
  if (e.defaultPrevented)
    return;
  const t = ze();
  vn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = ao({
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
function so({
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
        layout: c,
        separatorToPanels: i
      } = t(), l = Ce({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (Ne(c, l) || Re(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function Le(e, t) {
  const n = St(e), r = Ee(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  Z(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  Z(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = so({ groupId: n.id }).getLayout(), i = ct({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = Ce({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  Ne(c, l) || Re(
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
function cr(e) {
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
        const r = St(t), o = Ee(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (f) => f.element === t
        );
        Z(i, "Matching separator not found");
        const l = c.get(i);
        Z(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (f) => f.panelId === u.id
        );
        if (Z(d, "Panel metadata not found"), d.collapsible) {
          const f = s[u.id], m = d.collapsedSize === f ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          Le(t, m - f);
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
function lr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = ze(), n = vn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Ke({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function io({
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
    const { group: u, groupSize: d } = l, { orientation: f, panels: m } = u, { disableCursor: h } = u.mutableState;
    let p = 0;
    a ? f === "horizontal" ? p = (t.clientX - a.x) / d * 100 : p = (t.clientY - a.y) / d * 100 : f === "horizontal" ? p = t.clientX < 0 ? -100 : 100 : p = t.clientY < 0 ? -100 : 100;
    const y = r.get(u), b = o.get(u);
    if (!y || !b)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: P,
      groupSize: g,
      layout: v,
      separatorToPanels: M
    } = b;
    if (P && v && M) {
      const A = ct({
        delta: p,
        initialLayout: y,
        panelConstraints: P,
        pivotIndices: l.panels.map((x) => m.indexOf(x)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (Ne(A, v)) {
        if (p !== 0 && !h)
          switch (f) {
            case "horizontal": {
              c |= p < 0 ? Xr : Qr;
              break;
            }
            case "vertical": {
              c |= p < 0 ? eo : to;
              break;
            }
          }
      } else
        Re(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: P,
          groupSize: g,
          layout: A,
          separatorToPanels: M
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & Xn : i |= c & Xn, t.movementY === 0 ? i |= s & Qn : i |= c & Qn, Yi(i), bn(e);
}
function ur(e) {
  const t = ze(), n = _e();
  switch (n.state) {
    case "active":
      io({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function dr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = _e(), n = ze();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Ke({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Ee(a.group.id, !0);
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
      io({
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
      const a = vn(e, n);
      a.length === 0 ? t.state !== "inactive" && Ke({
        cursorFlags: 0,
        state: "inactive"
      }) : Ke({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), bn(e.currentTarget);
      break;
    }
  }
}
function fr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (_e().state) {
      case "hover":
        Ke({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function mr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || ro(e.currentTarget) && e.preventDefault();
}
function hr(e) {
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
function uc(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = Ge({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, c = {
    asPercentage: fe(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = c, r.onResize(c, r.id, s);
}
function dc(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function fc({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const c = /* @__PURE__ */ new Map(), i = [];
  for (const d of e.panels) {
    const f = r[d.id] ?? 0;
    switch (d.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const m = f / 100 * n, h = fe(
          m / t * 100
        );
        c.set(d.id, h), o += h;
        break;
      }
      case "preserve-relative-size":
      default: {
        i.push(d.id), a += f;
        break;
      }
    }
  }
  if (!s || i.length === 0)
    return r;
  const l = 100 - o, u = { ...r };
  if (c.forEach((d, f) => {
    u[f] = d;
  }), a > 0)
    for (const d of i) {
      const f = r[d] ?? 0;
      u[d] = fe(
        f / a * l
      );
    }
  else {
    const d = fe(
      l / i.length
    );
    for (const f of i)
      u[f] = d;
  }
  return u;
}
function mc(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Be = /* @__PURE__ */ new Map();
function hc(e) {
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
          const w = Ge({ group: e });
          if (w === 0)
            return;
          const P = Ee(e.id);
          if (!P)
            return;
          const g = Zt(e), v = P.defaultLayoutDeferred ? hr(g) : P.layout, M = fc({
            group: e,
            nextGroupSize: w,
            prevGroupSize: P.groupSize,
            prevLayout: v
          }), A = Ce({
            layout: M,
            panelConstraints: g
          });
          if (!P.defaultLayoutDeferred && Ne(P.layout, A) && dc(
            P.derivedPanelConstraints,
            g
          ) && P.groupSize === w)
            return;
          Re(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: g,
            groupSize: w,
            layout: A,
            separatorToPanels: P.separatorToPanels
          });
        }
      } else
        uc(e, b, y);
    }
  });
  a.observe(e.element), e.panels.forEach((h) => {
    Z(
      !r.has(h.id),
      `Panel ids must be unique; id "${h.id}" was used more than once`
    ), r.add(h.id), h.onResize && a.observe(h.element);
  });
  const s = Ge({ group: e }), c = Zt(e), i = e.panels.map(({ id: h }) => h).join(",");
  let l = e.mutableState.defaultLayout;
  l && (mc(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? hr(c), d = Ce({
    layout: u,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Be.set(
    f,
    (Be.get(f) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Zr(e).forEach((h) => {
    h.separator && m.set(h.separator, h.panels);
  }), Re(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: m
  }), e.separators.forEach((h) => {
    Z(
      !o.has(h.id),
      `Separator ids must be unique; id "${h.id}" was used more than once`
    ), o.add(h.id), h.element.addEventListener("keydown", cr);
  }), Be.get(f) === 1 && (f.addEventListener("contextmenu", rr, !0), f.addEventListener("dblclick", ir, !0), f.addEventListener("pointerdown", lr, !0), f.addEventListener("pointerleave", ur), f.addEventListener("pointermove", dr), f.addEventListener("pointerout", fr), f.addEventListener("pointerup", mr, !0)), function() {
    t = !1, Be.set(
      f,
      Math.max(0, (Be.get(f) ?? 0) - 1)
    ), ec(e), e.separators.forEach((h) => {
      h.element.removeEventListener("keydown", cr);
    }), Be.get(f) || (f.removeEventListener(
      "contextmenu",
      rr,
      !0
    ), f.removeEventListener(
      "dblclick",
      ir,
      !0
    ), f.removeEventListener(
      "pointerdown",
      lr,
      !0
    ), f.removeEventListener("pointerleave", ur), f.removeEventListener("pointermove", dr), f.removeEventListener("pointerout", fr), f.removeEventListener("pointerup", mr, !0)), a.disconnect();
  };
}
function pc() {
  const [e, t] = _({}), n = $(() => t({}), []);
  return [e, n];
}
function Sn(e) {
  const t = yr();
  return `${e ?? t}`;
}
const xe = typeof window < "u" ? De : j;
function ot(e) {
  const t = k(e);
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
function wn(...e) {
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
function Pn(e) {
  const t = k({ ...e });
  return xe(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const co = on(null);
function gc(e, t) {
  const n = k({
    getLayout: () => ({}),
    setLayout: Xi
  });
  rn(t, () => n.current, []), xe(() => {
    Object.assign(
      n.current,
      so({ groupId: e })
    );
  });
}
function lo({
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
  orientation: u = "horizontal",
  resizeTargetMinimumSize: d = {
    coarse: 20,
    fine: 10
  },
  style: f,
  ...m
}) {
  const h = k({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), p = ot((R) => {
    Ne(h.current.onLayoutChange, R) || (h.current.onLayoutChange = R, i == null || i(R));
  }), y = ot(
    (R, E) => {
      Ne(h.current.onLayoutChanged, R) || (h.current.onLayoutChanged = R, l == null || l(R, { isUserInteraction: E }));
    }
  ), b = Sn(c), w = k(null), [P, g] = pc(), v = k({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), M = wn(w, a);
  gc(b, s);
  const A = ot(
    (R, E) => {
      const I = _e(), T = nr(R), O = Ee(R);
      if (O) {
        let C = !1;
        switch (I.state) {
          case "active": {
            C = I.hitRegions.some(
              (V) => V.group === T
            );
            break;
          }
        }
        return {
          flexGrow: O.layout[E] ?? 1,
          pointerEvents: C ? "none" : void 0
        };
      }
      if (n != null && n[E])
        return {
          flexGrow: n == null ? void 0 : n[E]
        };
    }
  ), x = Pn({
    defaultLayout: n,
    disableCursor: r
  }), D = G(
    () => ({
      get disableCursor() {
        return !!x.disableCursor;
      },
      getPanelStyles: A,
      id: b,
      orientation: u,
      registerPanel: (R) => {
        const E = v.current;
        return E.panels = Yt(u, [
          ...E.panels,
          R
        ]), g(), () => {
          E.panels = E.panels.filter(
            (I) => I !== R
          ), g();
        };
      },
      registerSeparator: (R) => {
        const E = v.current;
        return E.separators = Yt(u, [
          ...E.separators,
          R
        ]), g(), () => {
          E.separators = E.separators.filter(
            (I) => I !== R
          ), g();
        };
      },
      updatePanelProps: (R, { disabled: E }) => {
        const I = v.current.panels.find(
          (C) => C.id === R
        );
        I && (I.panelConstraints.disabled = E);
        const T = nr(b), O = Ee(b);
        T && O && Re(T, {
          ...O,
          derivedPanelConstraints: Zt(T)
        });
      },
      updateSeparatorProps: (R, {
        disabled: E,
        disableDoubleClick: I
      }) => {
        const T = v.current.separators.find(
          (O) => O.id === R
        );
        T && (T.disabled = E, T.disableDoubleClick = I);
      }
    }),
    [A, b, g, u, x]
  ), N = k(null);
  return xe(() => {
    const R = w.current;
    if (R === null)
      return;
    const E = v.current;
    let I;
    if (x.defaultLayout !== void 0 && Object.keys(x.defaultLayout).length === E.panels.length) {
      I = {};
      for (const z of E.panels) {
        const U = x.defaultLayout[z.id];
        U !== void 0 && (I[z.id] = U);
      }
    }
    const T = {
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
      panels: E.panels,
      resizeTargetMinimumSize: E.resizeTargetMinimumSize,
      separators: E.separators
    };
    N.current = T;
    const O = hc(T), { defaultLayoutDeferred: C, derivedPanelConstraints: V, layout: J } = Ee(T.id, !0);
    !C && V.length > 0 && (p(J), y(J, !1));
    const F = yn(b, (z) => {
      const { defaultLayoutDeferred: U, derivedPanelConstraints: Q, layout: te } = z.next;
      if (U || Q.length === 0)
        return;
      const re = T.panels.map(({ id: ee }) => ee).join(",");
      T.mutableState.layouts[re] = te, Q.forEach((ee) => {
        if (ee.collapsible) {
          const { layout: ve } = z.prev ?? {};
          if (ve) {
            const Oe = le(
              ee.collapsedSize,
              te[ee.panelId]
            ), Te = le(
              ee.collapsedSize,
              ve[ee.panelId]
            );
            Oe && !Te && (T.mutableState.expandedPanelSizes[ee.panelId] = ve[ee.panelId]);
          }
        }
      });
      const X = _e().state !== "active";
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
    P,
    x
  ]), j(() => {
    const R = N.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ S(co.Provider, { value: D, children: /* @__PURE__ */ S(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": b,
      id: b,
      ref: M,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...f,
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
lo.displayName = "Group";
function Rn() {
  const e = an(co);
  return Z(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function bc(e, t) {
  const { id: n } = Rn(), r = k({
    collapse: $t,
    expand: $t,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: $t
  });
  rn(t, () => r.current, []), xe(() => {
    Object.assign(
      r.current,
      ao({ groupId: n, panelId: e })
    );
  });
}
function Xt({
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
  minSize: u = "0%",
  onResize: d,
  panelRef: f,
  style: m,
  ...h
}) {
  const p = !!i, y = Sn(i), b = Pn({
    disabled: a
  }), w = k(null), P = wn(w, s), {
    getPanelStyles: g,
    id: v,
    orientation: M,
    registerPanel: A,
    updatePanelProps: x
  } = Rn(), D = d !== null, N = ot(
    (T, O, C) => {
      d == null || d(T, i, C);
    }
  );
  xe(() => {
    const T = w.current;
    if (T !== null) {
      const O = {
        element: T,
        id: y,
        idIsStable: p,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? N : void 0,
        panelConstraints: {
          groupResizeBehavior: c,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: b.disabled,
          maxSize: l,
          minSize: u
        }
      };
      return A(O);
    }
  }, [
    c,
    n,
    r,
    o,
    D,
    y,
    p,
    l,
    u,
    N,
    A,
    b
  ]), j(() => {
    x(y, { disabled: a });
  }, [a, y, x]), bc(y, f);
  const R = () => {
    const T = g(v, y);
    if (T)
      return JSON.stringify(T);
  }, E = br(
    (T) => yn(v, T),
    R,
    R
  );
  let I;
  return E ? I = JSON.parse(E) : o !== void 0 ? I = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : I = { flexGrow: 1 }, /* @__PURE__ */ S(
    "div",
    {
      ...h,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: P,
      style: {
        ...yc,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...I
      },
      children: /* @__PURE__ */ S(
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
            touchAction: M === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Xt.displayName = "Panel";
const yc = {
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
function vc({
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
    const i = c.maxSize, l = c.collapsible ? c.collapsedSize : c.minSize, u = [r, r + 1];
    a = Ce({
      layout: ct({
        delta: l - s,
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
function uo({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...c
}) {
  const i = Sn(a), l = Pn({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = _({}), [f, m] = _("inactive"), [h, p] = _(!1), y = k(null), b = wn(y, o), {
    disableCursor: w,
    id: P,
    orientation: g,
    registerSeparator: v,
    updateSeparatorProps: M
  } = Rn(), A = g === "horizontal" ? "vertical" : "horizontal";
  xe(() => {
    const N = y.current;
    if (N !== null) {
      const R = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: N,
        id: i
      }, E = v(R), I = Zi(
        (O) => {
          m(
            O.next.state !== "inactive" && O.next.hitRegions.some(
              (C) => C.separator === R
            ) ? O.next.state : "inactive"
          );
        }
      ), T = yn(
        P,
        (O) => {
          const { derivedPanelConstraints: C, layout: V, separatorToPanels: J } = O.next, F = J.get(R);
          if (F) {
            const z = F[0], U = F.indexOf(z);
            d(
              vc({
                layout: V,
                panelConstraints: C,
                panelId: z.id,
                panelIndex: U
              })
            );
          }
        }
      );
      return () => {
        I(), T(), E();
      };
    }
  }, [P, i, v, l]), j(() => {
    M(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, M]);
  let x;
  n && !w && (x = "not-allowed");
  let D;
  if (n)
    D = "disabled";
  else
    switch (f) {
      case "active": {
        D = "active";
        break;
      }
      default:
        h ? D = "focus" : D = f;
    }
  return /* @__PURE__ */ S(
    "div",
    {
      ...c,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": A,
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
uo.displayName = "Separator";
const In = 30, En = 65, lt = 50, Sc = 100 - En, wc = 100 - In;
function Pc(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(En, Math.max(In, t)) : lt;
}
function Tn(e) {
  return 100 - e;
}
function Ue(e) {
  return `${e}%`;
}
const Mn = "reader-document", ut = "reader-assistant", fo = "retainpdf.reader.ai-split-layout.v1", Rc = {
  [Mn]: Tn(lt),
  [ut]: lt
};
function kn(e) {
  const t = Pc(e == null ? void 0 : e[ut]);
  return {
    [Mn]: Tn(t),
    [ut]: t
  };
}
function Ic() {
  try {
    const e = JSON.parse(localStorage.getItem(fo) || "null");
    return kn(e);
  } catch {
    return Rc;
  }
}
function Ec(e) {
  try {
    localStorage.setItem(fo, JSON.stringify(kn(e)));
  } catch {
  }
}
function jt(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = kn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[ut]}vw`
  );
}
function Tc() {
  const e = k(null), [t] = _(Ic);
  De(() => {
    const o = e.current;
    return jt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = $((o) => {
    jt(e.current, o);
  }, []), r = $((o, a) => {
    jt(e.current, o), a.isUserInteraction && Ec(o);
  }, []);
  return /* @__PURE__ */ B(
    lo,
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
        /* @__PURE__ */ S(
          Xt,
          {
            id: Mn,
            defaultSize: Ue(Tn(lt)),
            minSize: Ue(Sc),
            maxSize: Ue(wc)
          }
        ),
        /* @__PURE__ */ S(
          uo,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ S("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ S(
          Xt,
          {
            id: ut,
            defaultSize: Ue(lt),
            minSize: Ue(In),
            maxSize: Ue(En)
          }
        )
      ]
    }
  );
}
function Mc({
  id: e,
  open: t,
  ariaLabel: n,
  className: r = "",
  keepMounted: o = !1,
  onClose: a,
  toolbar: s,
  children: c
}) {
  return j(() => {
    if (!t) return;
    const i = (l) => {
      var d;
      if (l.key !== "Escape") return;
      const u = l.target;
      (d = u == null ? void 0 : u.closest) != null && d.call(u, "textarea, input, select, [contenteditable='true']") || (l.preventDefault(), a());
    };
    return window.addEventListener("keydown", i), () => window.removeEventListener("keydown", i);
  }, [t, a]), !t && !o ? null : /* @__PURE__ */ B(
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
        s ? /* @__PURE__ */ S("div", { className: "reader-notes-panel-toolbar", children: s }) : null,
        /* @__PURE__ */ S("div", { className: "reader-notes-panel-body", children: c })
      ]
    }
  );
}
function kc({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = _(!1);
  if (j(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ B("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ B("span", { className: "reader-error-notice-text", children: [
      o.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    /* @__PURE__ */ S(
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
function Ac({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ S(kc, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ B(tn, { children: [
    e ? /* @__PURE__ */ S("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ B("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ S("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ S("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ S(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ S("div", { className: "reader-react-error", role: "alert", children: n }) : null
  ] });
}
function Lc(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function _c() {
  const [e, t] = _(!1), n = yr(), r = k(null);
  return j(() => {
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
  }, [e]), j(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Lc(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ B("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ S(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ S(Oo, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ B(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ B("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ S("strong", { children: "快捷键" }),
            /* @__PURE__ */ S(
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
          /* @__PURE__ */ S("div", { className: "reader-react-shortcuts-body", children: $s.map((o) => /* @__PURE__ */ B("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ S("h3", { children: o.title }),
            /* @__PURE__ */ S("ul", { children: o.items.map((a) => /* @__PURE__ */ B("li", { children: [
              /* @__PURE__ */ S("kbd", { children: a.keys }),
              /* @__PURE__ */ S("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ S("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const Nc = ["source", "sideBySide", "translated"], Cc = { source: "", translated: "", sideBySide: "" };
function Dc(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = wt(e.sourceUrl), n = wt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ta({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function zc(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = G(
    () => e ? Dc(e) : Cc,
    [e]
  ), o = G(
    () => Nc.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = $(async (s) => {
    if (!e) return;
    const c = wt(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? ea(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await na(
          e.fetchProtected,
          c,
          i,
          i,
          null,
          (l) => n((u) => {
            const d = new Set(u);
            return l ? d.add(s) : d.delete(s), d;
          })
        );
      } catch (i) {
        const l = i instanceof Error ? i.message : "下载失败";
        ra(l), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const xc = {
  source: wr,
  sideBySide: Pr,
  translated: Rr
}, Oc = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Fc(e) {
  const t = ft(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = zc(n), c = k(null);
  return j(() => {
    const i = () => {
      var d;
      (d = c.current) != null && d.open && (c.current.open = !1);
    }, l = (d) => {
      c.current && !c.current.contains(d.target) && i();
    }, u = (d) => {
      d.key === "Escape" && i();
    };
    return document.addEventListener("pointerdown", l), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", l), document.removeEventListener("keydown", u);
    };
  }, []), /* @__PURE__ */ B("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ B("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ S(Fo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ S("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ S($o, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ S("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = wo[i], u = wt(r[i]), d = a.has(i), f = !!u && !d, m = f ? "" : Po(i, r), h = xc[i];
      return /* @__PURE__ */ B(
        "button",
        {
          type: "button",
          id: `reader-download-${i}`,
          className: `reader-download-action${d ? " is-busy" : ""}`,
          disabled: !f,
          "aria-label": f ? `下载${l.label}` : m,
          onClick: () => {
            c.current && (c.current.open = !1), s(i);
          },
          children: [
            /* @__PURE__ */ S(h, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ B("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ B("span", { className: "reader-download-action-label", children: [
                Oc[i],
                " PDF"
              ] }),
              m ? /* @__PURE__ */ S("span", { className: "reader-download-action-reason", children: m }) : null
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
const $c = "retainpdf:reader:bookmarks:v1:", jc = 200;
function An() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function mo(e) {
  const t = `${e || ""}`.trim();
  return t ? `${$c}${t}` : "";
}
function Bc(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Mt(e, t = An()) {
  const n = mo(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Bc(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Qt(e, t, n) {
  const r = mo(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, jc);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Uc(e, t, n = "", { storage: r = An(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Mt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? Qt(e, a.filter((c) => c.page !== s), r) : Qt(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Hc(e, t, n = An()) {
  return Qt(e, Mt(e, n).filter((r) => r.page !== t), n);
}
function Wc(e, t) {
  var r, o, a, s;
  let n = null;
  for (const c of e || []) {
    if (`${(c == null ? void 0 : c.regionType) || ""}` != "heading") continue;
    const i = Number(((r = c.source) == null ? void 0 : r.page) ?? ((o = c.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(i) || i > t) continue;
    const l = `${((a = c.translated) == null ? void 0 : a.text) || c.markdown || ((s = c.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!l) continue;
    const u = Number(c.readingOrder) || 0;
    (!n || i > n.page || i === n.page && u >= n.order) && (n = { page: i, order: u, text: l });
  }
  return n ? n.text.slice(0, 60) : "";
}
function Vc({ filled: e }) {
  return /* @__PURE__ */ S("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ S("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Jc({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = _(() => Mt(e)), [c, i] = _(!1), l = k(null);
  if (j(() => {
    s(Mt(e)), i(!1);
  }, [e]), j(() => {
    if (!c) return;
    const f = (h) => {
      l.current && !l.current.contains(h.target) && i(!1);
    }, m = (h) => {
      h.key === "Escape" && i(!1);
    };
    return document.addEventListener("pointerdown", f), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", f), document.removeEventListener("keydown", m);
    };
  }, [c]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), d = a.some((f) => f.page === u);
  return /* @__PURE__ */ B("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ S(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Uc(e, u, Wc(r, u))),
        children: /* @__PURE__ */ S(Vc, { filled: d })
      }
    ),
    /* @__PURE__ */ S(
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
    c && a.length ? /* @__PURE__ */ S("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ S("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ B("li", { className: f.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ B(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ B("span", { className: "reader-bookmark-page", children: [
              "第 ",
              f.page,
              " 页"
            ] }),
            f.label ? /* @__PURE__ */ S("span", { className: "reader-bookmark-label", children: f.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ S(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${f.page} 页的书签`,
          onClick: () => s(Hc(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function Kc(e) {
  const t = ft(), n = Ei(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? dt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Ba(a), d = a > Mr + 1e-3, f = a < Et - 1e-3, m = He(r, Ve()), h = m >= Et ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [p, y] = _(!1), [b, w] = _(`${c}`);
  j(() => {
    p || w(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, p]);
  const P = () => {
    if (y(!1), !l || i <= 0)
      return;
    const g = Number(`${b}`.trim());
    l(Tt(g, i));
  };
  return /* @__PURE__ */ B("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ S("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ S("div", { className: "reader-react-hud-group", "aria-label": "页码", children: p ? /* @__PURE__ */ B(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (g) => {
          g.preventDefault(), P();
        },
        children: [
          /* @__PURE__ */ S(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: b,
              autoFocus: !0,
              onChange: (g) => w(g.target.value.replace(/[^\d]/g, "")),
              onBlur: P,
              onKeyDown: (g) => {
                g.key === "Escape" && (g.preventDefault(), y(!1), w(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ B("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            i || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ S(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": i > 0 ? `跳转页码，当前第 ${c} 页，共 ${i} 页` : "页码",
        title: i > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || i <= 0,
        onClick: () => {
          !l || i <= 0 || (w(`${c}`), y(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ S(
      Jc,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ B("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ S(
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
      /* @__PURE__ */ B(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${h}`,
          title: h,
          onClick: () => s(m),
          children: [
            u,
            "%"
          ]
        }
      ),
      /* @__PURE__ */ S(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !f,
          onClick: () => s(it(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ S("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ S(_c, {}) })
  ] });
}
function pr(e) {
  var t, n;
  return _r(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function qc(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: pr(ye(e))
  }));
  j(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: pr(ye(e))
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
const en = "download-toast";
function Gc({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ B("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ B("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ S("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ S("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ S("div", { className: "download-toast-track", children: /* @__PURE__ */ S("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ S("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Zc(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Bt.dismiss(en);
    return;
  }
  Bt.custom(
    () => /* @__PURE__ */ S(Gc, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: en, duration: 1 / 0 }
  );
}
function Yc() {
  const e = $((t) => {
    t && (t.setState = Zc, t.hide = () => Bt.dismiss(en));
  }, []);
  return /* @__PURE__ */ B(tn, { children: [
    /* @__PURE__ */ S(Co, { position: "bottom-right" }),
    /* @__PURE__ */ S("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Xc(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : kr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Qc(e, t) {
  return t === null || e !== t;
}
function ho(e) {
  const t = k(!1);
  return e && (t.current = !0), t.current;
}
function el(e, t) {
  const n = e === t;
  return { open: n, mounted: ho(n) };
}
function tl({
  panel: e,
  active: t,
  context: n
}) {
  var i;
  const r = t === e.id, o = ho(r);
  if (!(e.keepMounted ? o : r)) return null;
  const s = me(), c = (i = s == null ? void 0 : s[e.adapterKey]) == null ? void 0 : i.call(s, { ...n, open: r });
  return c == null ? null : /* @__PURE__ */ S(
    Mc,
    {
      id: `reader-${e.id}-panel`,
      open: r,
      ariaLabel: e.ariaLabel,
      keepMounted: e.keepMounted,
      className: "is-pane-right",
      onClose: n.onClose,
      children: c
    }
  );
}
const gr = { itemId: null, origin: null };
function nl() {
  let e = gr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? gr : { itemId: n, origin: r };
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
const rl = bo(() => import("./ReaderMarkdownPanel-DExDwGIe.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function ol(e) {
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
function al(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function sl() {
  const e = Os(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = qc(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = _(null), [u, d] = _(null), [f, m] = _(!1), h = k(null), p = k(null), y = s !== null, b = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, w = ol({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: b,
    liveTranslationVisible: f,
    assistantOpen: y,
    assistantPdfPane: i
  }), P = $(() => d(null), []), g = u ? yo({ jobId: o.jobId, name: u, onClose: P }) : null, v = Ls({
    hasOverlayContent: b,
    connection: e.liveTranslation.connection,
    showSource: w.showSource,
    liveTranslationVisible: f,
    assistantOpen: y
  }), M = w.sourceViewOnly, A = w.visibleMode;
  j(() => {
    d(null), m(!1);
  }, [e.viewStateKey]), j(() => {
    e.session.jobTerminal && m(!1);
  }, [e.session.jobTerminal]), j(() => {
    l(null);
  }, [a.scope]), j(() => {
    if (!(t.loading || t.failed)) {
      if (h.current !== e.viewStateKey) {
        h.current = e.viewStateKey;
        const z = ye(e.viewStateKey), U = Xc({
          savedMode: z == null ? void 0 : z.mode,
          sourceViewOnly: M,
          viewportWidth: Ve()
        });
        p.current = U.auto ? U.mode : null, U.mode && U.mode !== e.mode && e.setModeKeepingPage(U.mode);
        return;
      }
      Qc(e.mode, p.current) && (p.current = null, At(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, M]);
  const x = s || (e.mode === "compare" ? "compare" : "reading"), D = el(s, "markdown");
  Ws({
    mode: A,
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
    c(null), l(null);
  }, []), R = $((z) => {
    l(null);
    const U = al(z, e.liveTranslationAvailable);
    U !== null && m(U), e.setModeKeepingPage(z);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), E = G(() => v.sourcePaneToggle ? /* @__PURE__ */ S(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${f ? " is-active" : ""}`,
      onClick: () => m((z) => !z),
      "aria-pressed": f,
      title: f ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [v.sourcePaneToggle, f]), I = $((z) => {
    c(z), l(null);
  }, []), T = G(() => ({
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
  }), [N, o.documentId, o.jobId]), [O] = _(nl), C = $((z) => e.jumpToAnchor({ block_id: z }), [e.jumpToAnchor]), V = G(() => ({
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
  ]), J = G(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), F = [
    Na,
    `is-workspace-${x}`,
    y ? "is-assistant-open" : "",
    w.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ S(Ii, { value: V, hud: J, children: /* @__PURE__ */ B("div", { className: F, "data-reader-engine": "react-pdf", "data-reader-workspace": x, children: [
    /* @__PURE__ */ S(Ac, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ B("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ S(Fc, {}),
      /* @__PURE__ */ S(Zs, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ S(
      Di,
      {
        mode: A,
        documentReady: !!o.jobId,
        sourceViewOnly: M,
        onModeChange: R,
        liveTranslation: v.topBarPill ? {
          visible: f,
          state: e.liveTranslation,
          onToggle: () => m((z) => !z)
        } : null
      }
    ),
    /* @__PURE__ */ S(ji, { active: s }),
    y ? /* @__PURE__ */ S(Tc, {}) : null,
    /* @__PURE__ */ S(Li, { paneComposition: w, markdownSplit: D.open, assistantSplit: y, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
    g,
    e.showHud ? /* @__PURE__ */ S(
      Kc,
      {
        mode: A,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ B(go, { fallback: null, children: [
      Kr.map((z) => /* @__PURE__ */ S(
        tl,
        {
          panel: z,
          active: s,
          context: T
        },
        z.id
      )),
      D.mounted ? /* @__PURE__ */ S(rl, { open: D.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: N }) : null
    ] }),
    /* @__PURE__ */ S(Yc, {})
  ] }) });
}
function Il() {
  return /* @__PURE__ */ S(sl, {});
}
export {
  Il as R,
  sl as a,
  Mc as b,
  Pl as d,
  wl as f,
  Rl as r,
  ft as u
};
//# sourceMappingURL=ReaderApp-7Kohvrt8.js.map
