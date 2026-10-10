var _n = (e) => {
  throw TypeError(e);
};
var Ln = (e, t, n) => t.has(e) || _n("Cannot " + n);
var et = (e, t, n) => (Ln(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Nn = (e, t, n) => t.has(e) ? _n("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Cn = (e, t, n, r) => (Ln(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as j, jsx as S, Fragment as nn } from "react/jsx-runtime";
import { useMemo as G, useState as N, useEffect as $, useCallback as F, useRef as k, useLayoutEffect as ze, memo as rn, createContext as on, useContext as an, forwardRef as go, useImperativeHandle as sn, useSyncExternalStore as br, useId as yr, Suspense as bo, lazy as yo } from "react";
import { requireAdapter as Ze, getReaderAdapters as he, renderReaderBoardSlot as vo } from "./adapters.js";
import { resolveReaderDownloadName as So, resolveReaderDownloadUrls as wo, READER_PROGRESS_COPY as we, trimString as wt, READER_DOWNLOAD_ACTIONS as Po, disabledReason as Ro } from "./runtime/state.js";
import "@retainpdf/api/conversations";
import { r as Io, b as Eo } from "./page-config-Ct7qR5rm.js";
import { isFinishedJobStatus as cn } from "@retainpdf/domain/job";
import { c as To, n as Mo, f as Ct, j as Dn, a as ko, b as Ao, h as vr, p as ln, d as _o, k as zn, i as Lo } from "./reader-regions-CXmxla3K.js";
import { isReaderTransportError as No, createReaderTransportError as Co } from "./contracts.js";
import { toast as Ut, Toaster as Do } from "sonner";
import { X as Sr, Radio as zo, FileText as wr, Columns2 as Pr, Languages as Rr, FileCode2 as xo, Sparkles as Oo, Keyboard as Fo, Download as $o, ChevronDown as jo } from "lucide-react";
import { pdfjs as Bo, Page as Uo, Document as Ho } from "react-pdf";
import { e as Wo, m as Vo, a as Jo } from "./markdown-math-XkF5urpn.js";
const Ko = (...e) => {
  var t, n;
  return ((n = (t = he()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, qo = "", Go = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Zo = (e) => {
  var t, n;
  return ((n = (t = he()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Rl = (...e) => {
  var n;
  return (((n = he()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Pe = () => Ze("defaultReaderDataPort"), xn = () => Ze("defaultReaderPageConfigPort"), Il = {
  get apiPrefix() {
    return Pe().apiPrefix;
  },
  fetchProtected: (...e) => Pe().fetchProtected(...e),
  loadMarkdownPayload: (e) => Pe().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Pe().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Pe().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Pe().loadJobPayload(e),
  loadReaderPayload: (e, t) => Pe().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Pe().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Pe().liveTranslation;
  }
}, Ir = {
  messageTargetOrigin: () => xn().messageTargetOrigin(),
  readerJobId: () => xn().readerJobId()
}, Yo = () => {
  var e;
  return ((e = he()) == null ? void 0 : e.liveTranslation) ?? null;
}, st = () => {
  var t;
  const e = he();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, kt = () => {
  const e = he();
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
}, Xo = (...e) => {
  var t, n;
  return ((n = (t = he()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Qo = () => {
  var e, t;
  return ((t = (e = he()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ea = (...e) => {
  var t, n;
  return ((n = (t = he()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ta = (...e) => {
  var t, n;
  return ((n = (t = he()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? So(...e);
}, na = (...e) => {
  var t, n;
  return ((n = (t = he()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? wo(...e);
}, ra = (...e) => Ze("downloadProtectedResource")(...e), oa = (...e) => Ze("failDownloadToast")(...e), El = (e, t) => Ze("resolveMarkdownAssetUrl")(e, t), Er = "/api/v1";
function aa() {
  const e = () => {
    var r;
    return Io(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
  return $(() => {
    var c, i, l, u;
    const r = () => n(e()), o = (i = (c = globalThis.history) == null ? void 0 : c.pushState) == null ? void 0 : i.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const d = (f) => function(...m) {
          const p = f.apply(this, m);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), p;
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
  const e = aa(), t = G(() => ea(Ir), [e]), n = G(() => Qo(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
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
  } = e, [i, l] = N({
    documentId: "",
    jobId: ""
  }), [u, d] = N({
    documentId: "",
    jobId: ""
  }), f = i.documentId === t ? i.jobId : "", m = u.documentId === t ? u.jobId : "", p = n || f, [h, v] = N({
    jobId: "",
    documentId: ""
  }), b = h.jobId === p ? h.documentId : "", w = t || b, P = !!t && !p, [g, y] = N(null), _ = (g == null ? void 0 : g.sessionIdentity) === r && g.documentId === w ? g : null, M = P || !!_, z = F((C) => {
    const R = `${C.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      v({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const E = `${C.revision || ""}`.trim() || `${Date.now()}`;
    y({
      documentId: R,
      revision: E,
      sessionIdentity: o.current
    }), c();
  }, []);
  $(() => {
    y((C) => C && C.sessionIdentity !== r ? null : C);
  }, [r]);
  const D = F((C) => {
    switch (C.type) {
      case "resolved-document-job":
        l({ documentId: C.documentId, jobId: C.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        d({ documentId: C.documentId, jobId: C.jobId });
        break;
      case "resolved-job-document":
        v((R) => R.jobId === C.jobId && R.documentId === C.documentId ? R : { jobId: C.jobId, documentId: C.documentId });
        break;
      case "committed-source":
        y({
          documentId: C.documentId,
          revision: C.revision,
          sessionIdentity: C.sessionIdentity
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
    sessionJobId: p,
    resolvedJobDocument: h,
    setResolvedJobDocument: v,
    jobDocumentId: b,
    documentId: w,
    sourceOnly: P,
    committedDocumentSource: g,
    setCommittedDocumentSource: y,
    activeCommittedDocumentSource: _,
    sourceViewOnly: M,
    refreshCommittedDocument: z,
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
  return Zo(r ? `${n}?version=${encodeURIComponent(r)}` : n);
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
function Ht({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Go.progress,
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
  }), Ht({ percent: t, text: n, stage: r });
}
function da(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = N(null), [l, u] = N(null), [d, f] = N(""), [m, p] = N(0), h = d === n ? c : null, v = d === n ? l : null, b = On(h), w = cn(b), P = F(() => {
    p((D) => D + 1);
  }, []), g = F((D) => {
    i(D.jobPayload), u(D.manifestPayload), f(D.sessionIdentity);
  }, []), y = F((D) => {
    i(null), u(null), f(D);
  }, []), _ = k(""), M = k(""), z = F(async () => {
    const D = o.current;
    if (!D || _.current === D) return;
    const C = kt().loadJobPayload;
    if (typeof C != "function") return;
    const R = a.current.value;
    _.current = D;
    try {
      const E = await C(D);
      if (s.current || a.current.value !== R || o.current !== D || !E || typeof E != "object")
        return;
      const I = On(E);
      i(E), f(r.current), I === "succeeded" && M.current !== D && (M.current = D, p((T) => T + 1));
    } catch {
    } finally {
      _.current === D && (_.current = "");
    }
  }, []);
  return $(() => {
    M.current = "";
  }, [n]), $(() => {
    if (!t || w || !h) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && z();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [w, z, h, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: f,
    scopedJobPayload: h,
    scopedManifestPayload: v,
    jobStatus: b,
    jobTerminal: w,
    jobRefreshRevision: m,
    refreshJobArtifacts: P,
    refreshJobStatus: z,
    publishPayload: g,
    clearPayload: y
  };
}
function Wt(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function fa(e, t) {
  e(t), Wt(t);
}
function ma(e) {
  const [t, n] = N(e ? "source" : "compare"), r = F((a) => {
    e && a !== "source" || (n(a), Wt(a));
  }, [e]), o = F((a) => {
    fa(n, a);
  }, []);
  return $(() => (e && document.documentElement.classList.add("reader-source-only"), Wt(t), () => {
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
const va = 2, ge = /* @__PURE__ */ new Map();
function Vt(e, t) {
  ge.delete(e), ge.set(e, t);
}
function Sa(e) {
  if (ge.size < va) return;
  const t = ge.keys().next().value;
  t && ge.delete(t);
}
function Dt(e) {
  const t = `${e || ""}`.trim();
  if (!t || !ge.has(t)) return null;
  const n = ge.get(t);
  return Vt(t, n), n;
}
async function Tr(e, t = st().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ge.has(r)) {
    const c = ge.get(r);
    return Vt(r, c), c;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const c = new Error(`读取 PDF 失败 (${o.status})`);
    throw c.status = o.status, c;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return ge.has(r) ? Vt(r, s) : (Sa(), ge.set(r, s)), s;
}
function wa(e = "", t = null) {
  const [n, r] = N(
    () => t || Dt(e)
  ), [o, a] = N(
    () => !!`${e || ""}`.trim() && !t && !Dt(e)
  ), [s, c] = N("");
  return $(() => {
    if (t) {
      r(t), a(!1), c("");
      return;
    }
    const i = `${e || ""}`.trim();
    if (!i) {
      r(null), a(!1), c("");
      return;
    }
    const l = Dt(i);
    if (l) {
      r(l), a(!1), c("");
      return;
    }
    let u = !1;
    return a(!0), c(""), r(null), Tr(i).then((d) => {
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
async function Jt(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Pt(s, r, n, "download");
  const c = await Tr(t, st().fetchProtected, {
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
    Jt({
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
    Jt({
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
    jobRefreshRevision: p,
    sessionEpochRef: h,
    closingRef: v,
    activeLoadAbortRef: b
  } = e, [w, P] = N(""), [g, y] = N(""), [_, M] = N(null), [z, D] = N(null), [C, R] = N(!1), [E, I] = N(""), [T, x] = N([]), [U, O] = N(() => ({
    source: null,
    translated: null
  })), [V, te] = N(
    gt
  ), [B, A] = N({
    loading: !0,
    percent: 4,
    text: we.boot,
    stage: "progress",
    failed: !1
  });
  return $(() => {
    const J = new AbortController(), ne = h.current.value, Y = Pa({
      sessionEpochRef: h,
      closingRef: v,
      abort: J,
      sessionEpoch: ne
    });
    b.current = J;
    const Q = kt();
    if (v.current)
      return J.abort(), () => {
        b.current === J && (b.current = null);
      };
    function ee(re, ae) {
      Y.markFailed(), A({
        loading: !1,
        percent: 100,
        text: re,
        stage: "failed",
        failed: !0
      }), Ht({ percent: 100, text: ae, stage: "failed" });
    }
    function me() {
      R(!0), A({
        loading: !1,
        percent: 100,
        text: we.ready,
        stage: "ready",
        failed: !1
      }), Ht({ percent: 100, text: we.ready, stage: "ready" });
    }
    function Se() {
      return l != null && l.documentId ? Fn(
        l.documentId,
        l.revision
      ) : Ko() ? qo : Q.resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(r)}/source.pdf`);
    }
    async function Me() {
      let re = { activeJobId: "", activeVersionId: "" };
      try {
        const de = await Q.fetchProtected(
          Q.resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(r)}`)
        );
        if (de != null && de.ok) {
          const ce = await de.json().catch(() => null);
          re = ha(ce);
        }
      } catch {
      }
      const ae = pa({
        link: re,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (ae.kind === "follow-active-job") {
        if (Y.isInactive()) return;
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
        if (Y.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: ae.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const se = Se();
      if (Y.isInactive()) return;
      P(se), y(""), I(""), f(i);
      const ue = await Jt({
        url: se,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: Y,
        setBoot: A
      });
      if (!Y.isInactive()) {
        if (!ue) {
          ee("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        M(ue), me();
      }
    }
    async function mt() {
      var H;
      const re = !l, ae = !!(re && Q.loadSessionSnapshot && Q.loadReaderOptionalArtifacts), se = ae ? Q.loadReaderOptionalArtifacts(t) : null, ue = await ((H = Q.loadSessionSnapshot) == null ? void 0 : H.call(Q, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: re && !ae
      })), de = ue ? {
        jobPayload: ue.sourcePayload,
        manifestPayload: ue.manifestPayload,
        readerMetadata: ue.readerMetadata,
        regionsPayload: ue.regions,
        readerErrors: ue.readerErrors
      } : await Q.loadReaderPayload(t, {
        includeOptionalArtifacts: re
      });
      if (Y.isInactive()) return;
      let ce = null;
      if (n && !r)
        if (ue && ue.linkedDocument !== void 0)
          ce = ue.linkedDocument;
        else {
          try {
            ce = await Q.fetchDocumentByJobId(Er, t);
          } catch {
          }
          if (Y.isInactive()) return;
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
        if (Y.isInactive()) return;
        u({
          type: "committed-source",
          documentId: $e.documentId,
          revision: $e.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const Xe = Q.resolveReaderSourcePdf(de.manifestPayload), Nt = Q.resolveReaderTranslatedPdfUrl(de.jobPayload, de.manifestPayload), ke = typeof Xe == "string" ? Xe : Q.resolveReaderArtifactUrl(Xe), Ae = r || Fe, _e = l != null && l.documentId ? Fn(
        l.documentId,
        l.revision
      ) : ke || (Ae ? Q.resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(Ae)}/source.pdf`) : ""), Qe = l ? "" : Nt || "";
      P(_e || ""), y(Qe), I(ua(de.jobPayload, t)), d({
        jobPayload: de.jobPayload || null,
        manifestPayload: de.manifestPayload || null,
        sessionIdentity: i
      });
      const ht = () => Ra({
        sourceFinal: _e || "",
        translatedFinal: Qe,
        fence: Y,
        setBoot: A
      }), pt = !!(_e || Qe), je = se && pt ? ht() : null;
      je == null || je.catch(() => {
      });
      const L = se ? await se : de;
      if (Y.isInactive()) return;
      if (x(l ? [] : To(L.regionsPayload)), O(l ? { source: null, translated: null } : Mo(L.readerMetadata)), te(l ? gt : L.readerErrors ?? gt), !pt) {
        ee(we.failed, we.failed);
        return;
      }
      const W = await (je ?? ht());
      if (W.status !== "inactive") {
        if (W.status === "incomplete") {
          ee("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        M(W.sourceBytes), D(W.translatedBytes), me();
      }
    }
    async function Lt() {
      R(!1), M(null), D(null), x([]), O({ source: null, translated: null }), te(gt), Pt(A, 8, we.metadata, "metadata");
      try {
        if (s) {
          await Me();
          return;
        }
        if (!t) {
          ee(we.failed, we.failed);
          return;
        }
        await mt();
      } catch (re) {
        if (Y.isClosedOrStale() || (re == null ? void 0 : re.name) === "AbortError") return;
        Y.markFailed();
        const ae = Number(re == null ? void 0 : re.status);
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
        const se = re instanceof Error ? re.message : we.failed;
        ee(se, se);
      }
    }
    return Lt(), () => {
      J.abort(), b.current === J && (b.current = null);
    };
  }, [t, r, o, a, s, c, l, p, n, i, u, d, f, m]), {
    sourceUrl: w,
    translatedUrl: g,
    sourceFile: _,
    translatedFile: z,
    assetsReady: C,
    title: E,
    regions: T,
    readerMetadata: U,
    readerErrors: V,
    boot: B
  };
}
function Ea() {
  const e = k(!1), t = k(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = sa(), s = k({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = k(a), i = k(""), l = k(""), u = k(() => {
  }), d = F(() => u.current(), []), f = ia({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: c,
    documentIdRef: i,
    sessionJobIdRef: l,
    switchToSourceMode: d
  }), {
    sessionJobId: m,
    documentId: p,
    sourceOnly: h,
    sourceViewOnly: v
  } = f, { mode: b, setMode: w, switchSessionMode: P } = ma(v);
  u.current = () => {
    P("source");
  }, c.current = a, i.current = p, l.current = m;
  const g = da({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: y,
    scopedManifestPayload: _,
    jobStatus: M,
    jobTerminal: z,
    jobRefreshRevision: D,
    refreshJobArtifacts: C,
    refreshJobStatus: R
  } = g, E = Ia({
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
    publishPayload: g.publishPayload,
    clearPayload: g.clearPayload,
    switchSessionMode: P,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), I = F(() => {
    var x;
    e.current = !0, (x = t.current) == null || x.abort();
  }, []), T = G(
    () => ({
      fetchProtected: kt().fetchProtected,
      jobId: m,
      jobPayload: y,
      manifestPayload: _,
      sourceUrl: E.sourceUrl,
      translatedUrl: E.translatedUrl,
      sourceOnly: v
    }),
    [m, y, _, E.sourceUrl, E.translatedUrl, v]
  );
  return {
    jobId: m,
    jobStatus: M,
    workflow: `${(y == null ? void 0 : y.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: z,
    documentId: p,
    sessionIdentity: a,
    sourceOnly: h,
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
    refreshJobArtifacts: C,
    refreshJobStatus: R,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: I
  };
}
const Ta = 160, Ma = 8, ka = 0;
function Aa() {
  const e = k(null), [t, n] = N(null), [r, o] = N(ka), a = F((s) => {
    e.current = s, n(s);
  }, []);
  return $(() => {
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
function _a(e) {
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
const zt = { source: 0, translated: 0 };
function La(e, t) {
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
  const [d, f] = N(() => ({
    identity: l,
    pages: zt
  })), [m, p] = N(() => ({ identity: l, tick: 0 })), h = d.identity === l ? d.pages : zt, v = m.identity === l ? m.tick : 0, b = _a({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: w } = b, P = F((R, E) => {
    u.current === l && f((I) => {
      const T = I.identity === l ? I.pages : zt;
      return T[E] === R && I.identity === l ? I : {
        identity: l,
        pages: { ...T, [E]: R }
      };
    });
  }, [l]), g = k(null), y = F(() => {
    g.current && clearTimeout(g.current);
    const R = l;
    g.current = setTimeout(() => {
      g.current = null, u.current === R && p((E) => ({
        identity: R,
        tick: E.identity === R ? E.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  $(() => (g.current && (clearTimeout(g.current), g.current = null), f((R) => R.identity === l && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: l, pages: { source: 0, translated: 0 } }), p((R) => R.identity === l && R.tick === 0 ? R : { identity: l, tick: 0 }), () => {
    g.current && (clearTimeout(g.current), g.current = null);
  }), [l]);
  const _ = G(
    () => Math.max(h.source, h.translated),
    [h]
  ), M = w === "translated" ? h.translated : h.source || h.translated, z = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, C = `${l}-${v}-${z}-${n}-${h.source}-${h.translated}-${D}`;
  return {
    ...b,
    numPagesByPane: h,
    hudNumPages: _,
    primaryNumPages: M,
    metricsTick: v,
    onNumPages: P,
    onMetrics: y,
    rowSyncRevision: C
  };
}
const qe = "data-reader-page", it = "data-reader-pane", un = "data-natural-height", Na = "reader-react-root", Ca = "reader-react-grid", Da = "reader-react-scroll-shell", za = "reader-react-pdf-pane", Mr = "reader-react-pdf-page", Rt = "reader-react-pdf-page-placeholder", dn = "reader-react-pdf-page-slot";
function It(e, t) {
  const n = e != null ? `[${qe}="${e}"]` : `[${qe}]`;
  return t ? `${n}[${it}="${t}"]` : n;
}
function xa() {
  return `.${dn}[${qe}]`;
}
function fn(e) {
  return Number(e.getAttribute(qe));
}
const kr = 0.25, Et = 1, Oa = 0.05, ft = 0.5, Fa = 16, $a = 8, ja = 720;
function Ve() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Ar(e) {
  return Number.isFinite(e) && e < ja;
}
function He(e, t = Number.POSITIVE_INFINITY) {
  return Ar(t) && (e === "source" || e === "translated") ? Et : ft;
}
function At(e) {
  return Number.isFinite(e) ? Math.min(Et, Math.max(kr, e)) : ft;
}
function ct(e, t) {
  const n = At(Number(e) + t * Oa);
  return Math.round(n * 100) / 100;
}
function Ba(e) {
  return Math.round(At(e) * 100);
}
function Ua(e) {
  const n = (Number(e) || 0) - Fa - $a;
  return Math.max(160, Math.floor(n));
}
function Ha(e, t = ft) {
  const n = At(t);
  return Ua((Number(e) || 0) * n);
}
function Wa(e, t) {
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
const Ka = 200, _r = [
  "markdown"
], Lr = [
  "terminal"
], qa = [
  ..._r,
  ...Lr
];
function Nr(e) {
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
function Cr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Kt(e) {
  return `${e || ""}`.trim();
}
function Ya({
  documentId: e,
  jobId: t
}) {
  const n = Kt(e);
  if (n) return `document:${n}`;
  const r = Kt(t);
  return r ? `job:${r}` : "";
}
function Dr(e) {
  const t = Kt(e);
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
  return e === null ? null : Nr(e) ? e : void 0;
}
function ts(e) {
  return Za.has(e) ? e : void 0;
}
function zr(e) {
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
function ve(e, t = Cr()) {
  const n = Dr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? zr(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function _t(e, t, n = Cr()) {
  const r = Dr(e);
  if (!r || !n) return null;
  const o = ve(e, n), a = zr({
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
  const [r, o] = N(() => {
    var m;
    return ((m = ve(n)) == null ? void 0 : m.zoom) ?? He(e, Ve());
  }), a = k(r), s = k(n);
  a.current = r;
  const c = k(1), i = k(((f = ve(n)) == null ? void 0 : f.zoom) !== void 0);
  $(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = ve(n)) == null ? void 0 : h.zoom;
    i.current = m !== void 0;
    const p = m ?? He(e, Ve());
    c.current = 1, a.current = p, o(p);
  }, [e, n]), $(() => {
    if (i.current) return;
    const m = He(e, Ve()), p = a.current;
    Math.abs(m - p) < 5e-4 || (c.current = 1, a.current = m, o(m));
  }, [e]);
  const l = F((m) => {
    const p = At(m), h = a.current;
    Math.abs(p - h) < 5e-4 || (c.current = p / (h || 1), i.current = !0, _t(s.current, { zoom: p }), o(p));
  }, []), u = F((m) => {
    l(ct(a.current, m));
  }, [l]), d = F((m) => {
    l(He(m));
  }, [l]);
  return ze(() => {
    const m = c.current;
    Math.abs(m - 1) < 1e-3 || (c.current = 1, Wa(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function rs(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = k(t), a = k(n), s = k(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: F((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const mn = 48;
function xr(e, t = mn) {
  return e.getBoundingClientRect().top + t;
}
function Or(e, t) {
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
function xt(e, t, n = mn) {
  if (!e)
    return null;
  const r = It(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = xr(e, n), c = Or(o, s);
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
function qt(e, t, n) {
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
  return qt(
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
function pe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function ss(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
  return $(() => {
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
      const h = Array.from(c.querySelectorAll(d));
      if (!h.length)
        return;
      const v = xr(c), b = Or(h, v);
      b && s(b.page);
    }, m = () => {
      i || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, f();
      }));
    }, p = () => {
      if (i) return;
      if (!Array.from(c.querySelectorAll(d)).length) {
        l = setTimeout(p, 120);
        return;
      }
      f(), c.addEventListener("scroll", m, { passive: !0 });
    };
    return p(), () => {
      i = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), c.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const is = `canvas, .react-pdf__Page, .${Mr}, .${Rt}`, Bn = /* @__PURE__ */ new WeakMap();
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
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = k(o), c = k(r);
  return c.current = r, ze(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
    const f = () => {
      var y;
      if (i) return;
      const P = e.current;
      if (!P) return;
      const g = us(P);
      ls(s.current, g) || (s.current = g, a(g)), u && !d && (d = !0, (y = c.current) == null || y.call(c));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    m();
    const p = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), v = window.setTimeout(m, 700), b = e.current;
    let w = null;
    return b && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => m()), w.observe(b)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(p), window.clearTimeout(h), window.clearTimeout(v), w == null || w.disconnect();
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
    ((E = ve(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
  ), i = k(null), l = k(!1), u = k(r), d = k(null), f = k(null), m = k(null), p = k(null), h = k(a), v = k(""), b = k(n);
  b.current = n;
  const w = F(() => {
    var I;
    (I = d.current) == null || I.call(d), d.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), P = F(() => {
    !l.current && i.current == null || (w(), m.current != null && (clearTimeout(m.current), m.current = null), i.current = null, l.current = !1);
  }, [w]), g = F((I = !1) => {
    p.current != null && (clearTimeout(p.current), p.current = null);
    const T = () => {
      p.current = null, _t(h.current, {
        anchor: pe(c.current)
      });
    };
    I ? T() : p.current = setTimeout(T, ys);
  }, []), y = F((I) => {
    c.current = pe(I), i.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, gs);
  }, []);
  $(() => {
    if (!o)
      return;
    let I = !1, T = null, x = null, U = null;
    const O = () => {
      if (I) return;
      const V = e.current;
      if (!V) {
        U = setTimeout(O, 50);
        return;
      }
      T = V, x = () => {
        if (l.current)
          return;
        const te = xt(T, b.current);
        te && (c.current = te, g());
      }, T.addEventListener("scroll", x, { passive: !0 }), l.current || x();
    };
    return O(), () => {
      I = !0, U != null && clearTimeout(U), T && x && T.removeEventListener("scroll", x);
    };
  }, [o, r, n, e, g]), $(() => {
    if (!o) return;
    const I = e.current;
    if (!I) return;
    const T = (x) => {
      x.metaKey || x.ctrlKey || x.altKey || bs.has(x.key) && P();
    };
    return I.addEventListener("wheel", P, { passive: !0 }), I.addEventListener("touchmove", P, { passive: !0 }), window.addEventListener("keydown", T), () => {
      I.removeEventListener("wheel", P), I.removeEventListener("touchmove", P), window.removeEventListener("keydown", T);
    };
  }, [o, e, P]), ze(() => {
    var T;
    if (h.current === a) return;
    g(!0), w(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, v.current = "";
    const I = (T = ve(a)) == null ? void 0 : T.anchor;
    c.current = I ? pe(I) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, g, w]), $(() => {
    var T;
    if (!o || !s || !a || v.current === a) return;
    v.current = a;
    const I = pe(
      ((T = ve(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = I, i.current = I, l.current = !0, w(), d.current = qt(
      () => e.current,
      I,
      {
        behavior: "auto",
        pane: b.current,
        delaysMs: Un,
        onDone: () => y(I)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(I);
    }, Math.max(...Un) + 160), () => w();
  }, [o, s, a, e, y, w]), $(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, w();
      return;
    }
    const I = i.current ? pe(i.current) : pe(c.current);
    return l.current = !0, i.current = I, c.current = I, w(), d.current = qt(
      () => e.current,
      I,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: fs,
        onDone: () => y(I)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(I);
    }, ms), () => {
      w();
    };
  }, [r, o, n, e, y, w]), $(() => () => {
    w(), m.current != null && (clearTimeout(m.current), m.current = null), g(!0);
  }, [w, g]);
  const _ = F(() => {
    const I = xt(
      e.current,
      b.current
    );
    return pe(I || c.current);
  }, [e]), M = F(() => {
    l.current = !0;
    const I = xt(
      e.current,
      b.current
    ), T = pe(I ?? c.current);
    return c.current = T, i.current = T, g(), T;
  }, [e, g]), z = F((I, T, x) => {
    const U = x || b.current, O = Tt(I, T || 1), V = { page: O, fraction: 0 };
    c.current = V, l.current = !0, i.current = V, g(), w(), os(e.current, O, "smooth", U), d.current = as(
      () => e.current,
      O,
      {
        behavior: "auto",
        pane: U,
        delaysMs: hs,
        onDone: () => y(V)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(V);
    }, ps);
  }, [e, y, w, g]), D = F(() => pe(c.current), []), C = F(() => l.current, []), R = F(() => {
    if (!l.current || !i.current)
      return;
    const I = pe(i.current);
    hn(
      e.current,
      I,
      "auto",
      b.current
    );
  }, [e]);
  return {
    lockFromShell: _,
    beginModeSwitch: M,
    goToPage: z,
    getAnchor: D,
    isRestoring: C,
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
function Fr(e, t, n) {
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
  m.current = n, $(() => {
    var P, g;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const p = Xo(), h = Ss(p, d.current), v = Fr(p, h, { jobId: i, documentId: l });
    if (t.current === v)
      return;
    if (h == null) {
      t.current = v, (P = m.current) == null || P.call(m);
      return;
    }
    t.current = v, p && ((g = f.current) == null || g.call(f, p, h));
    const b = [];
    let w = 0;
    for (const y of ws)
      w = Math.max(w, y), b.push(
        setTimeout(() => {
          u.current(h);
        }, y)
      );
    return b.push(
      setTimeout(() => {
        var y;
        (y = m.current) == null || y.call(m);
      }, w + Ps)
    ), () => {
      for (const y of b) clearTimeout(y);
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
  $(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const m = setTimeout(() => {
      var b;
      const p = ((b = globalThis.location) == null ? void 0 : b.search) || "", h = Eo(p, o, u.current);
      if (f.current = o, h === null) return;
      const v = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Fr(
        { blockId: v },
        o,
        { jobId: c, documentId: i }
      ), (d.current || Es)(h);
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
  const t = k(""), [n, r] = N(!1), o = F(() => r(!0), []), a = {
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
const tt = {
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
function $r(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Hn(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Hn(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function As(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = $r(r, t, n);
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
function _s(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const Wn = [250, 500, 1e3, 2e3, 4e3], Ot = [80, 160, 320, 640, 1e3, 1500], Vn = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Gt(e, t) {
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
  return No(e) ? `${e.code || ""}`.trim() : "";
}
function bt(e, t) {
  const n = pn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Ls(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if ($r(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = Co(
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
    const c = Ot[Math.min(s, Ot.length - 1)];
    if (await Gt(c, r), s >= Ot.length + 2) throw a;
  }
}
function Ns({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(tt), s = k(o), c = k("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = cn(l) ? l : "";
  return $(() => {
    if (!n || !i) {
      c.current = "", s.current = tt, a(tt);
      return;
    }
    const d = r === void 0 ? Yo() : r, f = c.current === i;
    if (c.current = i, !d) {
      const P = {
        ...f ? s.current : tt,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = P, a(P);
      return;
    }
    const m = new AbortController();
    let p = !1;
    const h = {
      ...f ? s.current : tt,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const v = (P) => {
      m.signal.aborted || a((g) => {
        const y = P(g);
        return s.current = y, y;
      });
    }, b = async () => {
      let P = 0;
      for (; !m.signal.aborted; )
        try {
          const g = await d.fetchLayout(i, { signal: m.signal });
          p = !0, v((y) => ({
            ...y,
            layoutByPage: ks(g),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError") return;
          const y = pn(g);
          if (!(y === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !y)) {
            v((M) => ({
              ...M,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: bt(g, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            v((M) => ({
              ...M,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          v((M) => ({
            ...M,
            connection: "connecting",
            jobStatus: l,
            error: bt(g, "正在等待 OCR 版面数据")
          })), await Gt(Wn[Math.min(P, Wn.length - 1)], m.signal).catch(() => {
          }), P += 1;
        }
    };
    return (async () => {
      if (await b(), !p || m.signal.aborted) return;
      let P = 0;
      for (; !m.signal.aborted; ) {
        u || v((g) => ({
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
              let y;
              try {
                y = await Ls(
                  i,
                  g,
                  s.current,
                  m.signal,
                  d
                );
              } catch (_) {
                if ((_ == null ? void 0 : _.name) === "AbortError" || m.signal.aborted) throw _;
                v((M) => ({
                  ...M,
                  lastSeq: Math.max(M.lastSeq, g.seq),
                  error: bt(_, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              v((_) => {
                const M = As(_, g, y);
                return u ? {
                  ...M,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...M,
                  jobStatus: l
                };
              }), P = 0;
            }
          });
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError" || m.signal.aborted) return;
          v((y) => ({
            ...y,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: bt(g, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          v((g) => ({
            ...g,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Gt(Vn[Math.min(P, Vn.length - 1)], m.signal).catch(() => {
        }), P += 1;
      }
    })(), () => m.abort();
  }, [n, r, i, u]), o;
}
function Cs(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, c = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    c && i > 0 && o.set(c, i);
  }
  return o;
}
function Ds(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return $(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    let a = !1;
    const s = kt(), c = s.resolveResourceUrl(
      `${Er}/jobs/${encodeURIComponent(o)}/data/revisions?group_by=reader_item_id&limit=1000`
    );
    return s.fetchProtected(c).then((i) => i.ok ? i.json() : null).then((i) => {
      !a && i && r(Cs(i));
    }).catch(() => {
    }), () => {
      a = !0;
    };
  }, [e, t]), n;
}
const zs = 2e3;
function xs(e) {
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
const Os = /* @__PURE__ */ new Set(["book", "translate"]);
function jr(e) {
  return !!(e.jobId && e.sourceUrl && Os.has(e.workflow));
}
function Fs(e) {
  return !!(jr(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function $s() {
  const e = Ea(), t = jr({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Fs({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = k({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !cn(o) && (r.current.running = !0);
  const a = Ns({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = Aa(), u = Ds(e.jobId, !e.sourceOnly), d = Ya({
    documentId: e.documentId,
    jobId: e.jobId
  }), f = `${d}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: p } = ns(e.mode, s, d), h = La(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: m, shellWidth: i, identityKey: f }
  ), {
    beginModeSwitch: v,
    goToPage: b,
    repinIfRestoring: w
  } = vs(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: d,
    restoreReady: h.primaryNumPages > 0
  });
  $(() => {
    w();
  }, [i, w]);
  const P = ds(
    s,
    h.compareMode,
    h.rowSyncRevision,
    w
  ), g = ss(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), y = F((O, V) => {
    var B, A;
    const te = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((B = h.numPagesByPane) == null ? void 0 : B.source) || 0,
      Number((A = h.numPagesByPane) == null ? void 0 : A.translated) || 0
    );
    b(O, te, V);
  }, [b, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [_, M] = N(null), z = k(null), D = F((O) => {
    z.current && clearTimeout(z.current), M(O), O && (z.current = setTimeout(() => M(null), zs));
  }, []);
  $(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const C = F((O) => {
    const V = Ct(e.regions, O);
    return V ? Dn(V, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), R = F((O, V) => {
    const te = V || h.primaryPane, B = typeof O == "object" && O ? `${O.block_id || ""}`.trim() : "", A = typeof O == "object" && O ? `${O.image_url || ""}`.trim() : "", J = typeof O == "object" && O ? O.page_idx != null ? Number(O.page_idx) + 1 : O.page != null ? Number(O.page) : null : typeof O == "number" ? O + 1 : null, ne = ko(e.regions, A, J) || Ct(e.regions, B) || (typeof O == "object" ? Ao(e.regions, O) : null);
    let Y = ne ? Dn(ne, te).page : null;
    Y == null && (Y = xs(O)), !(Y == null || Y < 1) && (D(ne), y(Y, te));
  }, [D, y, h.primaryPane, e.regions]);
  Ms({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: g,
    goToPage: y,
    resolveBlockPage: C,
    jobId: e.jobId,
    documentId: e.documentId,
    onAnchorApplied: (O) => {
      D(Ct(e.regions, O.blockId));
    }
  });
  const { setModeKeepingPage: E } = rs({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  $(() => {
    D(null);
  }, [f, D]);
  const I = !e.boot.loading && !e.boot.failed, T = G(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), x = G(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), U = G(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: p,
    shell: T,
    panes: h,
    sessionFiles: x,
    rowHeights: P,
    goToPage: y,
    activeRegion: _,
    jumpToAnchor: R,
    setModeKeepingPage: E,
    download: e.download,
    showHud: I,
    viewStateKey: d,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, T, h, x, P, y, _, R, E, I, m, p, d, a, n, u]);
  return G(() => ({
    ...U,
    currentPage: g
  }), [U, g]);
}
const js = [
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
], Bs = [
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
function Us(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of js)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Hs(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Ws = ".reader-notes-panel";
function Vs(e) {
  return e instanceof Element ? !!e.closest(Ws) : !1;
}
function Js(e) {
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
  $(() => {
    if (!l)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Hs(d.target) || Vs(d.target))
        return;
      const f = d.key, m = Us(f);
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
              a(ct(o, 1));
              return;
            case "zoom-out":
              a(ct(o, -1));
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
const Ks = "retainpdf:soft-reader-close";
function qs() {
  return new URL("./index.html", window.location.href).href;
}
function Gs() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Ks },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Zs(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Ys() {
  if (!(typeof window > "u") && !Gs()) {
    if (Zs(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(qs());
  }
}
function Xs({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ j(
    "button",
    {
      id: "reader-close-home-btn",
      type: "button",
      className: "reader-close-home-btn",
      "aria-label": "返回主页",
      title: "返回主页",
      onClick: () => {
        e == null || e(), Ys();
      },
      children: [
        /* @__PURE__ */ S(Sr, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
        /* @__PURE__ */ S("span", { className: "reader-close-home-label", children: "关闭" })
      ]
    }
  );
}
let Jn = !1;
function Qs() {
  if (Jn)
    return;
  const e = st().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Bo.GlobalWorkerOptions.workerSrc = e, Jn = !0);
}
const ei = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function ti(e, t, n) {
  return e.flatMap((r) => {
    if (!ei.has(vr(r.region))) return [];
    const o = ln(r, t, n);
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
async function ni(e) {
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
const ri = "reader-text-hover-copy", oi = "reader-text-hover-id", Br = "reader-text-hover-tools", Ur = 26, Hr = 190;
function Wr(e) {
  return e.height < Ur * 2 || e.width < Hr;
}
function ai({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = N("idle"), [a, s] = N("idle"), c = k([]), i = (e == null ? void 0 : e.itemId) || "";
  if ($(() => {
    o("idle"), s("idle");
    const p = c.current;
    return () => {
      p.forEach((h) => window.clearTimeout(h)), c.current = [];
    };
  }, [i]), !e) return null;
  const l = _o(e.highlight.region, t), u = vr(e.highlight.region), d = (p, h) => async (v) => {
    v.preventDefault(), v.stopPropagation();
    const b = await ni(p);
    h(b ? "copied" : "failed"), c.current.push(window.setTimeout(() => h("idle"), 1200));
  }, f = u === "formula" ? "复制 LaTeX" : "复制", m = Wr(e.rect);
  return /* @__PURE__ */ S("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ S(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": u,
      style: e.rect,
      children: /* @__PURE__ */ j(
        "div",
        {
          className: Br,
          "data-placement": m ? "outside" : "inside",
          children: [
            /* @__PURE__ */ S(
              "button",
              {
                type: "button",
                className: oi,
                "data-copy-state": a,
                "aria-label": `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onPointerDown: (p) => p.stopPropagation(),
                onClick: d(e.itemId, s),
                children: a === "copied" ? "已复制编号" : e.itemId
              }
            ),
            t === "translated" && n > 0 ? /* @__PURE__ */ j("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            l ? /* @__PURE__ */ S(
              "button",
              {
                type: "button",
                className: ri,
                "data-copy-state": r,
                "aria-label": t === "translated" ? "复制这段译文" : "复制这段原文",
                onPointerDown: (p) => p.stopPropagation(),
                onClick: d(l, o),
                children: r === "copied" ? "已复制" : r === "failed" ? "复制失败" : f
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function si(e, t) {
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
function ii(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = ln(
      si(e, a),
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
const ci = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', li = 256, nt = /* @__PURE__ */ new Map();
function ui(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function di(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Wo(t, { bareLatex: !0 }), o = ui(n), a = Vo(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = nt.get(t);
  if (!s && (s = Jo(o, r), nt.set(t, s), nt.size > li)) {
    const c = nt.keys().next().value;
    c !== void 0 && nt.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Ft(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Re(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function fi(e, t) {
  const n = e.typography, r = Re(t) || 1, o = Re(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Ft(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Re(n == null ? void 0 : n.fit_min_font_size_pt), u = Re(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), m = o ? o * r : i, p = Re(n == null ? void 0 : n.leading_em), h = [
    Re(n == null ? void 0 : n.padding_top_pt) || 0,
    Re(n == null ? void 0 : n.padding_right_pt) || 0,
    Re(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Re(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((v) => v * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || ci,
    fontSizePx: Math.max(d, Math.min(f, m)),
    minFontSizePx: d,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: p ? 1 + p : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Ft(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Ft(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function mi(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), c = (d) => {
    const f = s.get(d);
    if (f !== void 0) return f;
    const { width: m, height: p } = e(d), h = m <= t + 0.5 && p <= n + 0.5;
    return s.set(d, h), h;
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
const hi = 512, rt = /* @__PURE__ */ new Map();
let Zt = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Zt += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Zt += 1;
}));
function pi(e, t, n, r) {
  return [
    Zt,
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
function gi({ item: e, pageScale: t }) {
  const n = k(null), r = G(
    () => di(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = G(
    () => fi(e, t),
    [e, t]
  );
  $(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      d && a(f);
    }), () => {
      d = !1;
    };
  }, [r]), ze(() => {
    const d = n.current;
    if (!d) return;
    const [f, m, p, h] = s.padding, v = Math.max(1, e.rect.width - h - m), b = Math.max(1, e.rect.height - f - p), w = pi(o, v, b, s);
    let P = rt.get(w);
    if (P === void 0 && (P = mi(
      (g) => (d.style.fontSize = `${g}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      v,
      b,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), rt.set(w, P), rt.size > hi)) {
      const g = rt.keys().next().value;
      g !== void 0 && rt.delete(g);
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
function bi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = G(
    () => ii(e, t, n, r),
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
        gi,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const yi = rn(bi), Vr = on(null), Jr = on(null);
function vi({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ S(Vr.Provider, { value: e, children: /* @__PURE__ */ S(Jr.Provider, { value: t, children: n }) });
}
function Ye() {
  return an(Vr);
}
function Si() {
  return an(Jr);
}
const Kr = 1.414;
function wi({
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
  liveTranslationLayout: p,
  liveTranslationPage: h,
  showLiveTranslation: v = r === "source"
}) {
  var B;
  const b = (B = Ye()) == null ? void 0 : B.revisedBlocks, w = k(c ?? Kr), [P, g] = N(w.current);
  $(() => {
    c != null && Math.abs(c - w.current) >= 1e-3 && (w.current = c, g(c));
  }, [c]);
  const y = k(l);
  y.current = l;
  const _ = k((A) => {
    var J;
    (J = y.current) == null || J.call(y, A);
  }).current, M = Math.max(120, Math.floor(t * P)), z = Math.max(M, Math.ceil(a || 0)), D = ln(u, t, M), C = G(
    () => ti(d, t, M),
    [M, d, t]
  ), [R, E] = N(null), I = typeof m == "function", T = I ? f ?? null : R, x = (A) => {
    I ? A !== (f ?? null) && (m == null || m(A)) : E((J) => J === A ? J : A);
  }, U = G(
    () => C.find((A) => A.itemId === T) || null,
    [T, C]
  ), O = (A) => {
    var me, Se;
    if (A.pointerType === "touch") return;
    if (A.buttons !== 0) {
      x(null);
      return;
    }
    if ((Se = (me = A.target) == null ? void 0 : me.closest) != null && Se.call(me, `.${Br}`)) return;
    const J = A.currentTarget.getBoundingClientRect(), ne = A.clientX - J.left, Y = A.clientY - J.top, Q = U == null ? void 0 : U.rect;
    if (Q && Wr(Q) && ne >= Q.left - 4 && ne <= Q.left + Hr && Y >= Q.top - Ur && Y <= Q.top) return;
    const ee = Kn(C, ne, Y);
    x((ee == null ? void 0 : ee.itemId) || null);
  }, V = (A) => {
    if (A.pointerType === "mouse") return;
    const J = A.currentTarget.getBoundingClientRect(), ne = Kn(
      C,
      A.clientX - J.left,
      A.clientY - J.top
    );
    x((ne == null ? void 0 : ne.itemId) || null);
  }, te = (A) => {
    !Number.isFinite(A) || A <= 0 || Math.abs(w.current - A) < 1e-3 || (w.current = A, g(A), i == null || i(e, A));
  };
  return /* @__PURE__ */ j(
    "div",
    {
      ref: _,
      [qe]: e,
      [it]: r,
      [un]: M,
      className: dn,
      onPointerMoveCapture: O,
      onPointerDown: V,
      onPointerLeave: (A) => {
        A.pointerType === "mouse" && x(null);
      },
      style: {
        width: t,
        height: z,
        minHeight: z
      },
      children: [
        o ? /* @__PURE__ */ S(
          Uo,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: !0,
            renderAnnotationLayer: !1,
            className: Mr,
            loading: /* @__PURE__ */ S(
              "div",
              {
                className: Rt,
                style: { width: t, height: M }
              }
            ),
            onLoadSuccess: (A) => {
              try {
                const J = A.getViewport({ scale: 1 });
                if (J.width > 0) {
                  const ne = J.height / J.width;
                  te(ne);
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
        D ? /* @__PURE__ */ S(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: D,
            "aria-hidden": "true"
          }
        ) : null,
        o && v ? /* @__PURE__ */ S(
          yi,
          {
            layoutPage: p,
            pageState: h,
            width: t,
            height: M
          }
        ) : null,
        o && r === "translated" && (b != null && b.size) ? /* @__PURE__ */ S("div", { className: "reader-revised-markers", "aria-hidden": "true", children: C.filter((A) => b.has(A.itemId)).map((A) => /* @__PURE__ */ S(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": A.itemId,
            style: { left: A.rect.left, top: A.rect.top, height: A.rect.height }
          },
          A.itemId
        )) }) : null,
        /* @__PURE__ */ S(
          ai,
          {
            target: o ? U : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: U && (b == null ? void 0 : b.get(U.itemId)) || 0
          }
        )
      ]
    }
  );
}
const Pi = rn(wi), $t = 5, Ri = "120% 0px", Ii = 120;
let qn = 1;
const Gn = /* @__PURE__ */ new WeakMap();
function Ei(e) {
  if (!e) return 0;
  const t = Gn.get(e);
  if (t) return t;
  const n = qn;
  return qn += 1, Gn.set(e, n), n;
}
function Ti() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Mi = go(
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
    activeRegion: p = null,
    regions: h = [],
    readerMetadata: v = null,
    hoveredRegionId: b = null,
    onHoverRegion: w,
    liveTranslation: P,
    showLiveTranslation: g = t === "source",
    liveTranslationPendingLabel: y = "",
    paneAction: _
  }, M) {
    Qs();
    const { file: z, loading: D, error: C } = wa(n, r), R = `${n}\0${Ei(z)}`, E = k(R);
    E.current = R;
    const I = G(
      () => ya(z),
      [z, n]
    ), [T, x] = N(0), [U, O] = N(""), [V, te] = N(null), [B, A] = N(480), J = k(null), ne = k(0), Y = G(() => Ti(), []), Q = G(() => ({
      cMapUrl: st().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: st().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    sn(M, () => V, [V]), $(() => {
      const L = (K) => {
        ne.current = K, A(K);
      }, W = (K) => {
        const X = Ja(K, ne.current);
        if (X !== "ignore") {
          if (J.current && clearTimeout(J.current), X === "immediate") {
            L(K);
            return;
          }
          J.current = setTimeout(() => L(K), Ka);
        }
      }, H = !!(i && i >= 80);
      W(H ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const oe = !H && c && typeof ResizeObserver < "u" ? new ResizeObserver((K) => {
        var X, ie;
        W(((ie = (X = K[0]) == null ? void 0 : X.contentRect) == null ? void 0 : ie.width) ?? c.clientWidth);
      }) : null;
      return oe && c && oe.observe(c), () => {
        oe == null || oe.disconnect(), J.current && clearTimeout(J.current);
      };
    }, [i, c, a]);
    const ee = G(
      () => Ha(B, o),
      [B, o]
    ), [me, Se] = N(() => /* @__PURE__ */ new Map()), [Me, mt] = N(() => /* @__PURE__ */ new Set()), [Lt, re] = N(() => /* @__PURE__ */ new Set()), ae = k(/* @__PURE__ */ new Map()), se = k(null), ue = k(/* @__PURE__ */ new Map()), de = F((L, W) => {
      Se((H) => {
        if (H.get(L) === W) return H;
        const q = new Map(H);
        return q.set(L, W), q;
      });
    }, []), ce = F((L, W) => {
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
    }, []), Fe = k(/* @__PURE__ */ new Map()), $e = F((L) => {
      const W = Fe.current;
      let H = W.get(L);
      return H || (H = (q) => ce(L, q), W.set(L, H)), H;
    }, [ce]);
    $(() => {
      if (typeof IntersectionObserver > "u") return;
      const L = ue.current, W = new IntersectionObserver(
        (H) => {
          const q = [], oe = [];
          for (const K of H) {
            const X = K.target, ie = fn(X);
            Number.isFinite(ie) && (K.isIntersecting ? q : oe).push(ie);
          }
          if ((q.length || oe.length) && mt((K) => {
            let X = null;
            for (const ie of q)
              K.has(ie) || (X = X || new Set(K), X.add(ie));
            for (const ie of oe)
              K.has(ie) && (X = X || new Set(K), X.delete(ie));
            return X || K;
          }), q.length) {
            for (const K of q) {
              const X = L.get(K);
              X && (clearTimeout(X), L.delete(K));
            }
            re((K) => {
              let X = null;
              for (const ie of q)
                K.has(ie) || (X = X || new Set(K), X.add(ie));
              return X || K;
            });
          }
          for (const K of oe)
            L.has(K) || L.set(K, setTimeout(() => {
              L.delete(K), re((X) => {
                if (!X.has(K)) return X;
                const ie = new Set(X);
                return ie.delete(K), ie;
              });
            }, Ii));
        },
        { root: c, rootMargin: Ri, threshold: 0 }
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
    }, [c]), ze(() => {
      x(0), O(""), mt(/* @__PURE__ */ new Set()), re(/* @__PURE__ */ new Set()), Se(/* @__PURE__ */ new Map()), ae.current.clear();
      const L = ue.current;
      for (const W of L.values()) clearTimeout(W);
      L.clear(), m == null || m(0, t);
    }, [R, m, t]);
    const Xe = F(
      ({ numPages: L }) => {
        E.current === R && (x(L), O(""), m == null || m(L, t), d == null || d({ numPages: L, pane: t }));
      },
      [R, d, m, t]
    ), Nt = F(
      (L) => {
        if (E.current !== R) return;
        const W = (L == null ? void 0 : L.message) || "PDF 解析失败";
        O(W), x(0), m == null || m(0, t), f == null || f(L, t);
      },
      [R, f, m, t]
    ), ke = G(
      () => T > 0 ? Array.from({ length: T }, (L, W) => W + 1) : [],
      [T]
    );
    $(() => {
      typeof IntersectionObserver < "u" || re(new Set(ke));
    }, [ke]);
    const Ae = G(
      () => zn(p, v, t),
      [p, v, t]
    ), _e = G(() => {
      const L = /* @__PURE__ */ new Map();
      for (const W of h) {
        const H = zn(W, v, t);
        if (!H) continue;
        const q = L.get(H.box.page) || [];
        q.push(H), L.set(H.box.page, q);
      }
      return L;
    }, [t, v, h]), Qe = G(() => {
      const L = /* @__PURE__ */ new Set();
      if (!b) return L;
      for (const [W, H] of _e)
        H.some((q) => q.itemId === b) && L.add(W);
      return L;
    }, [b, _e]), ht = G(() => {
      if (T === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(ke);
      if (Me.size === 0) {
        const H = Math.min(T, $t * 2 + 1);
        return new Set(Array.from({ length: H }, (q, oe) => oe + 1));
      }
      const W = /* @__PURE__ */ new Set();
      for (const H of Me)
        for (let q = -$t; q <= $t; q++) {
          const oe = H + q;
          oe >= 1 && oe <= T && W.add(oe);
        }
      return W;
    }, [T, ke, c, a, Me]), pt = !n || !!C || !!U, je = n && (C || U) || s;
    return /* @__PURE__ */ j(
      "section",
      {
        ref: te,
        className: `reader-panel ${za}${a ? "" : " is-hidden"}`,
        [it]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (P == null ? void 0 : P.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          _ ? /* @__PURE__ */ S("div", { className: "reader-react-pdf-pane-action", children: _ }) : null,
          y ? /* @__PURE__ */ j("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ S("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ S("span", { children: y })
          ] }) : null,
          pt && !D ? /* @__PURE__ */ S("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: je }) : null,
          D ? /* @__PURE__ */ S("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          I && !C ? /* @__PURE__ */ S("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ S(
            Ho,
            {
              file: I,
              loading: null,
              error: null,
              options: Q,
              onLoadSuccess: Xe,
              onLoadError: Nt,
              className: "reader-react-pdf-document",
              children: ke.map((L) => {
                if (ht.has(L))
                  return /* @__PURE__ */ S(
                    Pi,
                    {
                      pane: t,
                      pageNumber: L,
                      width: ee,
                      devicePixelRatio: Y,
                      active: Lt.has(L),
                      syncedMinHeight: (l == null ? void 0 : l.get(L)) || 0,
                      onMetrics: u,
                      cachedAspect: me.get(L),
                      onAspectChange: de,
                      sentinelRef: $e(L),
                      regionHighlight: (Ae == null ? void 0 : Ae.box.page) === L ? Ae : null,
                      regionTargets: _e.get(L),
                      hoveredRegionId: b && Qe.has(L) ? b : null,
                      onHoverRegion: w,
                      liveTranslationLayout: P == null ? void 0 : P.layoutByPage.get(L - 1),
                      liveTranslationPage: P == null ? void 0 : P.pagesByPage.get(L - 1),
                      showLiveTranslation: g
                    },
                    `${t}-${L}`
                  );
                const H = me.get(L) ?? Kr, q = Math.max(120, Math.floor(ee * H)), oe = Math.max(q, Math.ceil((l == null ? void 0 : l.get(L)) || 0));
                return /* @__PURE__ */ S(
                  "div",
                  {
                    ref: $e(L),
                    [qe]: L,
                    [it]: t,
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
), Zn = rn(Mi), ki = () => () => {
}, Yn = () => null;
function Ai({
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
function _i(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Li(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Ni(e) {
  const t = Ye(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? ft, p = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), v = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, b = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, P = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", g = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", y = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, _ = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, M = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), z = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), D = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), C = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), E = (t == null ? void 0 : t.regionHover) ?? null, [I, T] = N(null), x = br(
    E ? E.subscribe : ki,
    E ? () => E.get().itemId : Yn,
    E ? () => E.get().itemId : Yn
  ), U = E ? x : I, O = F((A) => {
    E ? E.set(A, "pdf") : T(A);
  }, [E]), V = Ai({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), B = Number.isFinite(p) && p > 0 ? _i(
    p,
    n || r,
    typeof document > "u" ? p * 2 : document.documentElement.clientWidth
  ) : null;
  return /* @__PURE__ */ S(
    "div",
    {
      ref: d,
      className: Da,
      "data-reader-region-count": C.length,
      "data-reader-structured-region-count": C.filter(Lo).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ j(
        "main",
        {
          className: `${Ca} reader-mode-${V.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            v ? /* @__PURE__ */ S(
              Zn,
              {
                pane: "source",
                url: P,
                preloadedFile: y,
                userZoom: m,
                visible: V.showSource,
                scrollRoot: f,
                pageWidthOverride: B,
                rowHeights: V.compareMode ? h : void 0,
                onMetrics: M,
                emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: z,
                activeRegion: D,
                regions: C,
                readerMetadata: R,
                hoveredRegionId: U,
                onHoverRegion: O,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? Li(o) : "",
                paneAction: u ? /* @__PURE__ */ j(nn, { children: [
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
                preloadedFile: _,
                userZoom: m,
                visible: V.showTranslated,
                scrollRoot: f,
                pageWidthOverride: B,
                rowHeights: V.compareMode ? h : void 0,
                onMetrics: M,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: z,
                activeRegion: D,
                regions: C,
                readerMetadata: R,
                hoveredRegionId: U,
                onHoverRegion: O,
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
const Ci = [
  { id: "source", label: "源文件", Icon: wr },
  { id: "compare", label: "对照", Icon: Pr },
  { id: "translated", label: "翻译文件", Icon: Rr }
];
function Di(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function zi(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function xi(e) {
  const t = Ye(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Di(a.state) : "";
  return /* @__PURE__ */ j("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ j(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ S(zo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ S("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ S("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Ci.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, f = zi({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ j(
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
const Oi = {
  markdown: { label: "Markdown", short: "MD", Icon: xo, needsJob: !0 }
}, Fi = _r.map(
  (e) => ({ id: e, ...Oi[e] })
), $i = {
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
    Icon: Oo,
    adapterKey: "renderReaderTerminal",
    slot: "terminal",
    ariaLabel: "AI（agent 终端）",
    keepMounted: !0
  }
}, qr = Lr.map(
  (e) => ({ id: e, ...$i[e] })
);
function ji(e) {
  return [
    ...Fi.map(({ id: t, label: n, short: r, Icon: o, needsJob: a }) => ({
      id: t,
      label: n,
      short: r,
      Icon: o,
      needsJob: a
    })),
    ...qr.filter((t) => e(t.adapterKey)).map(({ id: t, label: n, short: r, Icon: o }) => ({
      id: t,
      label: n,
      short: r,
      Icon: o,
      needsJob: !1
    }))
  ];
}
function Bi() {
  const e = he();
  return ji((t) => typeof (e == null ? void 0 : e[t]) == "function");
}
function Ui(e) {
  const t = Ye(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = Bi();
  return n ? /* @__PURE__ */ j("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ S("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: c.map(({ id: i, label: l, Icon: u, needsJob: d }) => {
      const f = n === i, m = d && o, p = r == null ? void 0 : r[i];
      return /* @__PURE__ */ j(
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
            p ? /* @__PURE__ */ S("span", { className: "reader-assistant-dock-badge", children: p }) : null
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
    const m = f && o, p = r == null ? void 0 : r[i];
    return /* @__PURE__ */ j(
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
          p ? /* @__PURE__ */ S("span", { className: "reader-assistant-dock-badge", children: p }) : null
        ]
      },
      i
    );
  }) });
}
function Hi(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Wi(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Vi(e) {
  return e / 100 * window.innerHeight;
}
function Ji(e) {
  return e / 100 * window.innerWidth;
}
function Ki(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function ot({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Ki(n);
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
      r = Wi(t, o);
      break;
    }
    case "em": {
      r = Hi(t, o);
      break;
    }
    case "vh": {
      r = Vi(o);
      break;
    }
    case "vw": {
      r = Ji(o);
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
function Yt(e) {
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
      const u = ot({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = fe(u / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const u = ot({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = fe(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = ot({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = fe(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = ot({
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
function Xt(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? qi : Gi
  );
}
function qi(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Gi(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Gr(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Zr(e, t) {
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
function Zi({
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
    const { x: c, y: i } = Zr(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return Z(o, "No rect found"), o;
}
let yt;
function Yi() {
  return yt === void 0 && (typeof matchMedia == "function" ? yt = !!matchMedia("(pointer:coarse)").matches : yt = !1), yt;
}
function Yr(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Xt(
    n,
    Array.from(t.children).filter(Gr).map((p) => ({ element: p }))
  ).map(({ element: p }) => p), s = [];
  let c = !1, i = !1, l = -1, u = -1, d = 0, f, m = [];
  {
    let p = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (p++, h.hasAttribute("data-disabled") || (d++, l === -1 && (l = p), u = p));
  }
  if (d > 1) {
    let p = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        p++;
        const v = r.find(
          (b) => b.element === h
        );
        if (v) {
          if (f) {
            const b = f.element.getBoundingClientRect(), w = h.getBoundingClientRect();
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
              ), y = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (m.length) {
                case 0: {
                  P = [
                    g,
                    y
                  ];
                  break;
                }
                case 1: {
                  const _ = m[0], M = Zi({
                    orientation: n,
                    rects: [b, w],
                    targetRect: _.element.getBoundingClientRect()
                  });
                  P = [
                    _,
                    M === b ? y : g
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
              let y = "width" in g ? g : g.element.getBoundingClientRect();
              const _ = Yi() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (y.width < _) {
                const z = _ - y.width;
                y = new DOMRect(
                  y.x - z / 2,
                  y.y,
                  y.width + z,
                  y.height
                );
              }
              if (y.height < _) {
                const z = _ - y.height;
                y = new DOMRect(
                  y.x,
                  y.y - z / 2,
                  y.width,
                  y.height + z
                );
              }
              const M = p <= l || p > u;
              !c && !M && s.push({
                group: e,
                groupSize: Ge({ group: e }),
                panels: [f, v],
                separator: "width" in g ? void 0 : g,
                rect: y
              }), c = !1;
            }
          }
          i = !1, f = v, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (c = !0);
        const v = o.find(
          (b) => b.element === h
        );
        v ? m.push(v) : (f = void 0, m = []);
      } else
        i = !0;
  }
  return s;
}
var Ee;
class Xr {
  constructor() {
    Nn(this, Ee, {});
  }
  addListener(t, n) {
    const r = et(this, Ee)[t];
    return r === void 0 ? et(this, Ee)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = et(this, Ee)[t];
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
    Cn(this, Ee, {});
  }
  removeListener(t, n) {
    const r = et(this, Ee)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ee = new WeakMap();
let Je = {
  cursorFlags: 0,
  state: "inactive"
};
const gn = new Xr();
function Ne() {
  return Je;
}
function Xi(e) {
  return gn.addListener("change", e);
}
function Qi(e) {
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
const ec = (e) => e, jt = () => {
}, Qr = 1, eo = 2, to = 4, no = 8, Xn = 3, Qn = 12;
let vt;
function er() {
  return vt === void 0 && (vt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (vt = !0)), vt;
}
function tc({
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
          const a = (e & Qr) !== 0, s = (e & eo) !== 0, c = (e & to) !== 0, i = (e & no) !== 0;
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
  const r = Ne();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = tc({
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
let ye = /* @__PURE__ */ new Map();
const ro = new Xr();
function nc(e) {
  ye = new Map(ye), ye.delete(e);
}
function nr(e, t) {
  for (const [n] of ye)
    if (n.id === e)
      return n;
}
function Te(e, t) {
  for (const [n, r] of ye)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function xe() {
  return ye;
}
function yn(e, t) {
  return ro.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ie(e, t, n) {
  const r = ye.get(e);
  ye = new Map(ye), ye.set(e, t), ro.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function oo(e) {
  const t = Ne();
  let n = !1;
  switch (t.state) {
    case "active":
      Ke({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (bn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Te(r.group.id, !0);
        Ie(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function rr(e) {
  e.defaultPrevented || oo(e.currentTarget);
}
function rc(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Zr(n, a.rect);
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
function oc(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function ac(e, t) {
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
const sc = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function ic(e) {
  const t = getComputedStyle(ao(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function cc(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || ic(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || sc.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function or(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (Z(n, "Missing node"), cc(n)) return n;
  }
  return null;
}
function ar(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function sr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ao(e);
  return t;
}
function ao(e) {
  const { parentNode: t } = e;
  return oc(t) ? t.host : t;
}
function lc(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function uc({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Gr(n) || n.contains(e) || e.contains(n))
    return !0;
  if (ac(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (lc(r.getBoundingClientRect(), t))
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
    const a = Yr(o), s = rc(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && uc({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function dc(e, t) {
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
function be(e, t) {
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
  if (be(r, i) < 0)
    if (a) {
      const l = (o + i) / 2;
      be(r, l) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(c, r), r = fe(r), r;
}
function lt({
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
        const h = e < 0 ? d : u, v = n[h];
        Z(
          v,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: b = 0,
          collapsible: w,
          minSize: P = 0
        } = v;
        if (w) {
          const g = c[h];
          if (Z(
            g != null,
            `Previous layout not found for panel index ${h}`
          ), le(g, b)) {
            const y = P - g;
            be(y, Math.abs(e)) > 0 && (e = e < 0 ? 0 - y : y);
          }
        }
      }
      {
        const h = e < 0 ? u : d, v = n[h];
        Z(
          v,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: b = 0,
          collapsible: w,
          minSize: P = 0
        } = v;
        if (w) {
          const g = c[h];
          if (Z(
            g != null,
            `Previous layout not found for panel index ${h}`
          ), le(g, P)) {
            const y = g - b;
            be(y, Math.abs(e)) > 0 && (e = e < 0 ? 0 - y : y);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? d : u, v = n[h];
      Z(
        v,
        `Panel constraints not found for index ${h}`
      );
      const b = c[h], { collapsible: w, collapsedSize: P, minSize: g } = v;
      if (w && be(b, g) < 0)
        if (e > 0) {
          const y = g - P, _ = y / 2, M = b + e;
          be(M, g) < 0 && (e = be(e, _) <= 0 ? 0 : y);
        } else {
          const y = g - P, _ = 100 - y / 2, M = b - e;
          be(M, g) < 0 && (e = be(100 + e, _) > 0 ? 0 : -y);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let v = e < 0 ? d : u, b = 0;
    for (; ; ) {
      const P = c[v];
      Z(
        P != null,
        `Previous layout not found for panel index ${v}`
      );
      const g = We({
        overrideDisabledPanels: s,
        panelConstraints: n[v],
        prevSize: P,
        size: 100
      }) - P;
      if (b += g, v += h, v < 0 || v >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(b));
    e = e < 0 ? 0 - w : w;
  }
  {
    let h = e < 0 ? u : d;
    for (; h >= 0 && h < n.length; ) {
      const v = Math.abs(e) - Math.abs(f), b = c[h];
      Z(
        b != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = b - v, P = We({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: b,
        size: w
      });
      if (!le(b, P) && (f += b - P, l[h] = P, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (dc(i, l))
    return o;
  {
    const h = e < 0 ? d : u, v = c[h];
    Z(
      v != null,
      `Previous layout not found for panel index ${h}`
    );
    const b = v + f, w = We({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: v,
      size: b
    });
    if (l[h] = w, !le(w, b)) {
      let P = b - w, g = e < 0 ? d : u;
      for (; g >= 0 && g < n.length; ) {
        const y = l[g];
        Z(
          y != null,
          `Previous layout not found for panel index ${g}`
        );
        const _ = y + P, M = We({
          overrideDisabledPanels: s,
          panelConstraints: n[g],
          prevSize: y,
          size: _
        });
        if (le(y, M) || (P -= M - y, l[g] = M), le(P, 0))
          break;
        e > 0 ? g-- : g++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, v) => v + h,
    0
  );
  if (!le(m, 100, 0.1))
    return o;
  const p = Object.keys(o);
  return l.reduce((h, v, b) => (h[p[b]] = v, h), {});
}
function Ce(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || be(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function De({
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
function so({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = xe();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: d,
        layout: f,
        groupSize: m,
        separatorToPanels: p
      }
    ] of i)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: d,
          group: l,
          groupSize: m,
          layout: f,
          separatorToPanels: p
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
    const f = a(), m = l.findIndex((v) => v.id === t), p = m === 0, h = m === l.length - 1;
    if (h && i < f && (p || l.slice(0, m).every((v, b) => {
      const w = d[b];
      return (w == null ? void 0 : w.collapsible) && le(w.collapsedSize, u[w.panelId]);
    }))) {
      const v = l.slice(0, m).reduce((b, w) => b + u[w.id], 0);
      return {
        ...u,
        [t]: fe(100 - v)
      };
    }
    return lt({
      delta: h ? f - i : i - f,
      initialLayout: u,
      panelConstraints: d,
      pivotIndices: h ? [m - 1, m] : [m, m + 1],
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
      layout: p,
      separatorToPanels: h
    } = n(), v = s({
      nextSize: i,
      panels: f.panels,
      prevLayout: p,
      derivedPanelConstraints: d
    }), b = De({
      layout: v,
      panelConstraints: d
    });
    Ce(p, b) || Ie(f, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: m,
      layout: b,
      separatorToPanels: h
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
      const { group: l } = n(), { element: u } = o(), d = Ge({ group: l }), f = ot({
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
  const t = xe();
  vn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = so({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function St(e) {
  const t = xe();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function io({
  groupId: e
}) {
  const t = () => {
    const n = xe();
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
      } = t(), l = De({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (Ce(c, l) || Ie(a, {
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
  const n = St(e), r = Te(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  Z(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  Z(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = io({ groupId: n.id }).getLayout(), i = lt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = De({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  Ce(c, l) || Ie(
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
        const r = St(t), o = Te(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
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
  const t = xe(), n = vn(e, t), r = /* @__PURE__ */ new Map();
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
function co({
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
    const { group: u, groupSize: d } = l, { orientation: f, panels: m } = u, { disableCursor: p } = u.mutableState;
    let h = 0;
    a ? f === "horizontal" ? h = (t.clientX - a.x) / d * 100 : h = (t.clientY - a.y) / d * 100 : f === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const v = r.get(u), b = o.get(u);
    if (!v || !b)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: P,
      groupSize: g,
      layout: y,
      separatorToPanels: _
    } = b;
    if (P && y && _) {
      const M = lt({
        delta: h,
        initialLayout: v,
        panelConstraints: P,
        pivotIndices: l.panels.map((z) => m.indexOf(z)),
        prevLayout: y,
        trigger: "mouse-or-touch"
      });
      if (Ce(M, y)) {
        if (h !== 0 && !p)
          switch (f) {
            case "horizontal": {
              c |= h < 0 ? Qr : eo;
              break;
            }
            case "vertical": {
              c |= h < 0 ? to : no;
              break;
            }
          }
      } else
        Ie(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: P,
          groupSize: g,
          layout: M,
          separatorToPanels: _
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & Xn : i |= c & Xn, t.movementY === 0 ? i |= s & Qn : i |= c & Qn, Qi(i), bn(e);
}
function ur(e) {
  const t = xe(), n = Ne();
  switch (n.state) {
    case "active":
      co({
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
  const t = Ne(), n = xe();
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
          const s = Te(a.group.id, !0);
          Ie(a.group, s, {
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
      co({
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
    switch (Ne().state) {
      case "hover":
        Ke({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function mr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || oo(e.currentTarget) && e.preventDefault();
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
function fc(e, t, n) {
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
function mc(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function hc({
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
        const m = f / 100 * n, p = fe(
          m / t * 100
        );
        c.set(d.id, p), o += p;
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
function pc(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Be = /* @__PURE__ */ new Map();
function gc(e) {
  let t = !0;
  Z(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((p) => {
    for (const h of p) {
      const { borderBoxSize: v, target: b } = h;
      if (b === e.element) {
        if (t) {
          const w = Ge({ group: e });
          if (w === 0)
            return;
          const P = Te(e.id);
          if (!P)
            return;
          const g = Yt(e), y = P.defaultLayoutDeferred ? hr(g) : P.layout, _ = hc({
            group: e,
            nextGroupSize: w,
            prevGroupSize: P.groupSize,
            prevLayout: y
          }), M = De({
            layout: _,
            panelConstraints: g
          });
          if (!P.defaultLayoutDeferred && Ce(P.layout, M) && mc(
            P.derivedPanelConstraints,
            g
          ) && P.groupSize === w)
            return;
          Ie(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: g,
            groupSize: w,
            layout: M,
            separatorToPanels: P.separatorToPanels
          });
        }
      } else
        fc(e, b, v);
    }
  });
  a.observe(e.element), e.panels.forEach((p) => {
    Z(
      !r.has(p.id),
      `Panel ids must be unique; id "${p.id}" was used more than once`
    ), r.add(p.id), p.onResize && a.observe(p.element);
  });
  const s = Ge({ group: e }), c = Yt(e), i = e.panels.map(({ id: p }) => p).join(",");
  let l = e.mutableState.defaultLayout;
  l && (pc(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? hr(c), d = De({
    layout: u,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Be.set(
    f,
    (Be.get(f) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Yr(e).forEach((p) => {
    p.separator && m.set(p.separator, p.panels);
  }), Ie(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: m
  }), e.separators.forEach((p) => {
    Z(
      !o.has(p.id),
      `Separator ids must be unique; id "${p.id}" was used more than once`
    ), o.add(p.id), p.element.addEventListener("keydown", cr);
  }), Be.get(f) === 1 && (f.addEventListener("contextmenu", rr, !0), f.addEventListener("dblclick", ir, !0), f.addEventListener("pointerdown", lr, !0), f.addEventListener("pointerleave", ur), f.addEventListener("pointermove", dr), f.addEventListener("pointerout", fr), f.addEventListener("pointerup", mr, !0)), function() {
    t = !1, Be.set(
      f,
      Math.max(0, (Be.get(f) ?? 0) - 1)
    ), nc(e), e.separators.forEach((p) => {
      p.element.removeEventListener("keydown", cr);
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
function bc() {
  const [e, t] = N({}), n = F(() => t({}), []);
  return [e, n];
}
function Sn(e) {
  const t = yr();
  return `${e ?? t}`;
}
const Oe = typeof window < "u" ? ze : $;
function at(e) {
  const t = k(e);
  return Oe(() => {
    t.current = e;
  }, [e]), F(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function wn(...e) {
  return at((t) => {
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
  return Oe(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const lo = on(null);
function yc(e, t) {
  const n = k({
    getLayout: () => ({}),
    setLayout: ec
  });
  sn(t, () => n.current, []), Oe(() => {
    Object.assign(
      n.current,
      io({ groupId: e })
    );
  });
}
function uo({
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
  const p = k({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = at((R) => {
    Ce(p.current.onLayoutChange, R) || (p.current.onLayoutChange = R, i == null || i(R));
  }), v = at(
    (R, E) => {
      Ce(p.current.onLayoutChanged, R) || (p.current.onLayoutChanged = R, l == null || l(R, { isUserInteraction: E }));
    }
  ), b = Sn(c), w = k(null), [P, g] = bc(), y = k({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), _ = wn(w, a);
  yc(b, s);
  const M = at(
    (R, E) => {
      const I = Ne(), T = nr(R), x = Te(R);
      if (x) {
        let U = !1;
        switch (I.state) {
          case "active": {
            U = I.hitRegions.some(
              (O) => O.group === T
            );
            break;
          }
        }
        return {
          flexGrow: x.layout[E] ?? 1,
          pointerEvents: U ? "none" : void 0
        };
      }
      if (n != null && n[E])
        return {
          flexGrow: n == null ? void 0 : n[E]
        };
    }
  ), z = Pn({
    defaultLayout: n,
    disableCursor: r
  }), D = G(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: M,
      id: b,
      orientation: u,
      registerPanel: (R) => {
        const E = y.current;
        return E.panels = Xt(u, [
          ...E.panels,
          R
        ]), g(), () => {
          E.panels = E.panels.filter(
            (I) => I !== R
          ), g();
        };
      },
      registerSeparator: (R) => {
        const E = y.current;
        return E.separators = Xt(u, [
          ...E.separators,
          R
        ]), g(), () => {
          E.separators = E.separators.filter(
            (I) => I !== R
          ), g();
        };
      },
      updatePanelProps: (R, { disabled: E }) => {
        const I = y.current.panels.find(
          (U) => U.id === R
        );
        I && (I.panelConstraints.disabled = E);
        const T = nr(b), x = Te(b);
        T && x && Ie(T, {
          ...x,
          derivedPanelConstraints: Yt(T)
        });
      },
      updateSeparatorProps: (R, {
        disabled: E,
        disableDoubleClick: I
      }) => {
        const T = y.current.separators.find(
          (x) => x.id === R
        );
        T && (T.disabled = E, T.disableDoubleClick = I);
      }
    }),
    [M, b, g, u, z]
  ), C = k(null);
  return Oe(() => {
    const R = w.current;
    if (R === null)
      return;
    const E = y.current;
    let I;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === E.panels.length) {
      I = {};
      for (const B of E.panels) {
        const A = z.defaultLayout[B.id];
        A !== void 0 && (I[B.id] = A);
      }
    }
    const T = {
      disabled: !!o,
      element: R,
      id: b,
      mutableState: {
        defaultLayout: I,
        disableCursor: !!z.disableCursor,
        expandedPanelSizes: y.current.lastExpandedPanelSizes,
        layouts: y.current.layouts
      },
      orientation: u,
      panels: E.panels,
      resizeTargetMinimumSize: E.resizeTargetMinimumSize,
      separators: E.separators
    };
    C.current = T;
    const x = gc(T), { defaultLayoutDeferred: U, derivedPanelConstraints: O, layout: V } = Te(T.id, !0);
    !U && O.length > 0 && (h(V), v(V, !1));
    const te = yn(b, (B) => {
      const { defaultLayoutDeferred: A, derivedPanelConstraints: J, layout: ne } = B.next;
      if (A || J.length === 0)
        return;
      const Y = T.panels.map(({ id: ee }) => ee).join(",");
      T.mutableState.layouts[Y] = ne, J.forEach((ee) => {
        if (ee.collapsible) {
          const { layout: me } = B.prev ?? {};
          if (me) {
            const Se = le(
              ee.collapsedSize,
              ne[ee.panelId]
            ), Me = le(
              ee.collapsedSize,
              me[ee.panelId]
            );
            Se && !Me && (T.mutableState.expandedPanelSizes[ee.panelId] = me[ee.panelId]);
          }
        }
      });
      const Q = Ne().state !== "active";
      h(ne), Q && v(ne, B.isUserInteraction);
    });
    return () => {
      C.current = null, x(), te();
    };
  }, [
    o,
    b,
    v,
    h,
    u,
    P,
    z
  ]), $(() => {
    const R = C.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ S(lo.Provider, { value: D, children: /* @__PURE__ */ S(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": b,
      id: b,
      ref: _,
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
uo.displayName = "Group";
function Rn() {
  const e = an(lo);
  return Z(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function vc(e, t) {
  const { id: n } = Rn(), r = k({
    collapse: jt,
    expand: jt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: jt
  });
  sn(t, () => r.current, []), Oe(() => {
    Object.assign(
      r.current,
      so({ groupId: n, panelId: e })
    );
  });
}
function Qt({
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
  ...p
}) {
  const h = !!i, v = Sn(i), b = Pn({
    disabled: a
  }), w = k(null), P = wn(w, s), {
    getPanelStyles: g,
    id: y,
    orientation: _,
    registerPanel: M,
    updatePanelProps: z
  } = Rn(), D = d !== null, C = at(
    (T, x, U) => {
      d == null || d(T, i, U);
    }
  );
  Oe(() => {
    const T = w.current;
    if (T !== null) {
      const x = {
        element: T,
        id: v,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? C : void 0,
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
      return M(x);
    }
  }, [
    c,
    n,
    r,
    o,
    D,
    v,
    h,
    l,
    u,
    C,
    M,
    b
  ]), $(() => {
    z(v, { disabled: a });
  }, [a, v, z]), vc(v, f);
  const R = () => {
    const T = g(y, v);
    if (T)
      return JSON.stringify(T);
  }, E = br(
    (T) => yn(y, T),
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
      ...p,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": v,
      id: v,
      ref: P,
      style: {
        ...Sc,
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
            touchAction: _ === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Qt.displayName = "Panel";
const Sc = {
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
function wc({
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
    a = De({
      layout: lt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = De({
      layout: lt({
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
function fo({
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
  }), [u, d] = N({}), [f, m] = N("inactive"), [p, h] = N(!1), v = k(null), b = wn(v, o), {
    disableCursor: w,
    id: P,
    orientation: g,
    registerSeparator: y,
    updateSeparatorProps: _
  } = Rn(), M = g === "horizontal" ? "vertical" : "horizontal";
  Oe(() => {
    const C = v.current;
    if (C !== null) {
      const R = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: C,
        id: i
      }, E = y(R), I = Xi(
        (x) => {
          m(
            x.next.state !== "inactive" && x.next.hitRegions.some(
              (U) => U.separator === R
            ) ? x.next.state : "inactive"
          );
        }
      ), T = yn(
        P,
        (x) => {
          const { derivedPanelConstraints: U, layout: O, separatorToPanels: V } = x.next, te = V.get(R);
          if (te) {
            const B = te[0], A = te.indexOf(B);
            d(
              wc({
                layout: O,
                panelConstraints: U,
                panelId: B.id,
                panelIndex: A
              })
            );
          }
        }
      );
      return () => {
        I(), T(), E();
      };
    }
  }, [P, i, y, l]), $(() => {
    _(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, _]);
  let z;
  n && !w && (z = "not-allowed");
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
        p ? D = "focus" : D = f;
    }
  return /* @__PURE__ */ S(
    "div",
    {
      ...c,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": M,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": D,
      "data-testid": i,
      id: i,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: b,
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
fo.displayName = "Separator";
const In = 30, En = 65, ut = 50, Pc = 100 - En, Rc = 100 - In;
function Ic(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(En, Math.max(In, t)) : ut;
}
function Tn(e) {
  return 100 - e;
}
function Ue(e) {
  return `${e}%`;
}
const Mn = "reader-document", dt = "reader-assistant", mo = "retainpdf.reader.ai-split-layout.v1", Ec = {
  [Mn]: Tn(ut),
  [dt]: ut
};
function kn(e) {
  const t = Ic(e == null ? void 0 : e[dt]);
  return {
    [Mn]: Tn(t),
    [dt]: t
  };
}
function Tc() {
  try {
    const e = JSON.parse(localStorage.getItem(mo) || "null");
    return kn(e);
  } catch {
    return Ec;
  }
}
function Mc(e) {
  try {
    localStorage.setItem(mo, JSON.stringify(kn(e)));
  } catch {
  }
}
function Bt(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = kn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[dt]}vw`
  );
}
function kc() {
  const e = k(null), [t] = N(Tc);
  ze(() => {
    const o = e.current;
    return Bt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = F((o) => {
    Bt(e.current, o);
  }, []), r = F((o, a) => {
    Bt(e.current, o), a.isUserInteraction && Mc(o);
  }, []);
  return /* @__PURE__ */ j(
    uo,
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
          Qt,
          {
            id: Mn,
            defaultSize: Ue(Tn(ut)),
            minSize: Ue(Pc),
            maxSize: Ue(Rc)
          }
        ),
        /* @__PURE__ */ S(
          fo,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ S("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ S(
          Qt,
          {
            id: dt,
            defaultSize: Ue(ut),
            minSize: Ue(In),
            maxSize: Ue(En)
          }
        )
      ]
    }
  );
}
function Ac({
  id: e,
  open: t,
  ariaLabel: n,
  className: r = "",
  keepMounted: o = !1,
  onClose: a,
  toolbar: s,
  children: c
}) {
  return $(() => {
    if (!t) return;
    const i = (l) => {
      var d;
      if (l.key !== "Escape") return;
      const u = l.target;
      (d = u == null ? void 0 : u.closest) != null && d.call(u, "textarea, input, select, [contenteditable='true']") || (l.preventDefault(), a());
    };
    return window.addEventListener("keydown", i), () => window.removeEventListener("keydown", i);
  }, [t, a]), !t && !o ? null : /* @__PURE__ */ j(
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
function _c({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = N(!1);
  if ($(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ j("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ j("span", { className: "reader-error-notice-text", children: [
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
function Lc({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ S(_c, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ j(nn, { children: [
    e ? /* @__PURE__ */ S("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ j("div", { className: "reader-boot-loading-card", children: [
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
function Nc(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Cc() {
  const [e, t] = N(!1), n = yr(), r = k(null);
  return $(() => {
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
  }, [e]), $(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Nc(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ j("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ S(Fo, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ j(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ j("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ S("div", { className: "reader-react-shortcuts-body", children: Bs.map((o) => /* @__PURE__ */ j("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ S("h3", { children: o.title }),
            /* @__PURE__ */ S("ul", { children: o.items.map((a) => /* @__PURE__ */ j("li", { children: [
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
const Dc = ["source", "sideBySide", "translated"], zc = { source: "", translated: "", sideBySide: "" };
function xc(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = wt(e.sourceUrl), n = wt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return na({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Oc(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = G(
    () => e ? xc(e) : zc,
    [e]
  ), o = G(
    () => Dc.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = F(async (s) => {
    if (!e) return;
    const c = wt(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? ta(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ra(
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
        oa(l), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Fc = {
  source: wr,
  sideBySide: Pr,
  translated: Rr
}, $c = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function jc(e) {
  const t = Ye(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Oc(n), c = k(null);
  return $(() => {
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
  }, []), /* @__PURE__ */ j("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ j("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ S($o, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ S("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ S(jo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ S("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = Po[i], u = wt(r[i]), d = a.has(i), f = !!u && !d, m = f ? "" : Ro(i, r), p = Fc[i];
      return /* @__PURE__ */ j(
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
            /* @__PURE__ */ S(p, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ j("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ j("span", { className: "reader-download-action-label", children: [
                $c[i],
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
const Bc = "retainpdf:reader:bookmarks:v1:", Uc = 200;
function An() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ho(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Bc}${t}` : "";
}
function Hc(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Mt(e, t = An()) {
  const n = ho(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Hc(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function en(e, t, n) {
  const r = ho(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Uc);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Wc(e, t, n = "", { storage: r = An(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Mt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? en(e, a.filter((c) => c.page !== s), r) : en(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Vc(e, t, n = An()) {
  return en(e, Mt(e, n).filter((r) => r.page !== t), n);
}
function Jc(e, t) {
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
function Kc({ filled: e }) {
  return /* @__PURE__ */ S("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ S("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function qc({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => Mt(e)), [c, i] = N(!1), l = k(null);
  if ($(() => {
    s(Mt(e)), i(!1);
  }, [e]), $(() => {
    if (!c) return;
    const f = (p) => {
      l.current && !l.current.contains(p.target) && i(!1);
    }, m = (p) => {
      p.key === "Escape" && i(!1);
    };
    return document.addEventListener("pointerdown", f), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", f), document.removeEventListener("keydown", m);
    };
  }, [c]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), d = a.some((f) => f.page === u);
  return /* @__PURE__ */ j("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ S(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Wc(e, u, Jc(r, u))),
        children: /* @__PURE__ */ S(Kc, { filled: d })
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
    c && a.length ? /* @__PURE__ */ S("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ S("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ j("li", { className: f.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ j(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ j("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(Vc(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function Gc(e) {
  const t = Ye(), n = Si(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? ft, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Ba(a), d = a > kr + 1e-3, f = a < Et - 1e-3, m = He(r, Ve()), p = m >= Et ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [h, v] = N(!1), [b, w] = N(`${c}`);
  $(() => {
    h || w(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, h]);
  const P = () => {
    if (v(!1), !l || i <= 0)
      return;
    const g = Number(`${b}`.trim());
    l(Tt(g, i));
  };
  return /* @__PURE__ */ j("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ S("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ S("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ j(
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
                g.key === "Escape" && (g.preventDefault(), v(!1), w(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ j("span", { className: "reader-react-hud-page-suffix", children: [
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
          !l || i <= 0 || (w(`${c}`), v(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ S(
      qc,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ j("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ S(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !d,
          onClick: () => s(ct(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ j(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${p}`,
          title: p,
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
          onClick: () => s(ct(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ S("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ S(Cc, {}) })
  ] });
}
function pr(e) {
  var t, n;
  return Nr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Zc(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: pr(ve(e))
  }));
  $(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: pr(ve(e))
    });
  }, [e]), $(() => {
    t.scope === e && _t(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = F((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const tn = "download-toast";
function Yc({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ j("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ j("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ S("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ S("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ S("div", { className: "download-toast-track", children: /* @__PURE__ */ S("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ S("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Xc(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Ut.dismiss(tn);
    return;
  }
  Ut.custom(
    () => /* @__PURE__ */ S(Yc, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: tn, duration: 1 / 0 }
  );
}
function Qc() {
  const e = F((t) => {
    t && (t.setState = Xc, t.hide = () => Ut.dismiss(tn));
  }, []);
  return /* @__PURE__ */ j(nn, { children: [
    /* @__PURE__ */ S(Do, { position: "bottom-right" }),
    /* @__PURE__ */ S("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function el(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Ar(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function tl(e, t) {
  return t === null || e !== t;
}
function po(e) {
  const t = k(!1);
  return e && (t.current = !0), t.current;
}
function nl(e, t) {
  const n = e === t;
  return { open: n, mounted: po(n) };
}
function rl({
  panel: e,
  active: t,
  context: n
}) {
  var i;
  const r = t === e.id, o = po(r);
  if (!(e.keepMounted ? o : r)) return null;
  const s = he(), c = (i = s == null ? void 0 : s[e.adapterKey]) == null ? void 0 : i.call(s, { ...n, open: r });
  return c == null ? null : /* @__PURE__ */ S(
    Ac,
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
function ol() {
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
const al = yo(() => import("./ReaderMarkdownPanel-DMslEBgz.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function sl(e) {
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
function il(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function cl() {
  const e = $s(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Zc(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = N(null), [u, d] = N(null), [f, m] = N(!1), p = k(null), h = k(null), v = s !== null, b = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, w = sl({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: b,
    liveTranslationVisible: f,
    assistantOpen: v,
    assistantPdfPane: i
  }), P = F(() => d(null), []), g = u ? vo({ jobId: o.jobId, name: u, onClose: P }) : null, y = _s({
    hasOverlayContent: b,
    connection: e.liveTranslation.connection,
    showSource: w.showSource,
    liveTranslationVisible: f,
    assistantOpen: v
  }), _ = w.sourceViewOnly, M = w.visibleMode;
  $(() => {
    d(null), m(!1);
  }, [e.viewStateKey]), $(() => {
    e.session.jobTerminal && m(!1);
  }, [e.session.jobTerminal]), $(() => {
    l(null);
  }, [a.scope]), $(() => {
    if (!(t.loading || t.failed)) {
      if (p.current !== e.viewStateKey) {
        p.current = e.viewStateKey;
        const B = ve(e.viewStateKey), A = el({
          savedMode: B == null ? void 0 : B.mode,
          sourceViewOnly: _,
          viewportWidth: Ve()
        });
        h.current = A.auto ? A.mode : null, A.mode && A.mode !== e.mode && e.setModeKeepingPage(A.mode);
        return;
      }
      tl(e.mode, h.current) && (h.current = null, _t(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, _]);
  const z = s || (e.mode === "compare" ? "compare" : "reading"), D = nl(s, "markdown");
  Js({
    mode: M,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const C = F(() => {
    c(null), l(null);
  }, []), R = F((B) => {
    l(null);
    const A = il(B, e.liveTranslationAvailable);
    A !== null && m(A), e.setModeKeepingPage(B);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), E = G(() => y.sourcePaneToggle ? /* @__PURE__ */ S(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${f ? " is-active" : ""}`,
      onClick: () => m((B) => !B),
      "aria-pressed": f,
      title: f ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [y.sourcePaneToggle, f]), I = F((B) => {
    c(B), l(null);
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
    onClose: C
  }), [C, o.documentId, o.jobId]), [x] = N(ol), U = F((B) => e.jumpToAnchor({ block_id: B }), [e.jumpToAnchor]), O = G(() => ({
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
    jumpToBlock: U,
    revisedBlocks: e.revisedBlocks,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: _,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: I, close: C }
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
    U,
    e.revisedBlocks,
    e.sourceOnly,
    _,
    e.download,
    e.goToPage,
    I,
    C
  ]), V = G(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), te = [
    Na,
    `is-workspace-${z}`,
    v ? "is-assistant-open" : "",
    w.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ S(vi, { value: O, hud: V, children: /* @__PURE__ */ j("div", { className: te, "data-reader-engine": "react-pdf", "data-reader-workspace": z, children: [
    /* @__PURE__ */ S(Lc, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ j("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ S(jc, {}),
      /* @__PURE__ */ S(Xs, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ S(
      xi,
      {
        mode: M,
        documentReady: !!o.jobId,
        sourceViewOnly: _,
        onModeChange: R,
        liveTranslation: y.topBarPill ? {
          visible: f,
          state: e.liveTranslation,
          onToggle: () => m((B) => !B)
        } : null
      }
    ),
    /* @__PURE__ */ S(Ui, { active: s }),
    v ? /* @__PURE__ */ S(kc, {}) : null,
    /* @__PURE__ */ S(Ni, { paneComposition: w, markdownSplit: D.open, assistantSplit: v, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
    g,
    e.showHud ? /* @__PURE__ */ S(
      Gc,
      {
        mode: M,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ j(bo, { fallback: null, children: [
      qr.map((B) => /* @__PURE__ */ S(
        rl,
        {
          panel: B,
          active: s,
          context: T
        },
        B.id
      )),
      D.mounted ? /* @__PURE__ */ S(al, { open: D.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: C }) : null
    ] }),
    /* @__PURE__ */ S(Qc, {})
  ] }) });
}
function Tl() {
  return /* @__PURE__ */ S(cl, {});
}
export {
  Tl as R,
  cl as a,
  Ac as b,
  Il as d,
  Rl as f,
  El as r,
  Ye as u
};
//# sourceMappingURL=ReaderApp-D4mhZpXW.js.map
