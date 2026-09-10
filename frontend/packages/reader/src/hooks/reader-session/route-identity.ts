// 职责 1：URL/history 监听与 route 身份（job_id / document_id / sessionIdentity）。
// pushState/replaceState 不触发 popstate，这里沿用拆分前的 monkeypatch 语义。

import { useEffect, useMemo, useState } from "react";
import {
  resolveReaderDocumentId,
  resolveReaderJobId,
  defaultReaderPageConfigPort,
} from "../../external.js";

export function useLocationKey(): string {
  const [locationKey, setLocationKey] = useState(
    () => globalThis.location?.search || globalThis.location?.href || "",
  );
  useEffect(() => {
    const handler = () => setLocationKey(globalThis.location?.search || globalThis.location?.href || "");
    // pushState/replaceState do not fire popstate; monkeypatch to detect SPA navigation
    const origPush = globalThis.history?.pushState?.bind(globalThis.history);
    const origReplace = globalThis.history?.replaceState?.bind(globalThis.history);
    let patched = false;
    if (origPush && origReplace) {
      try {
        const wrap = (orig: typeof origPush) => function (this: History, ...args: Parameters<History["pushState"]>) {
          const ret = (orig as unknown as (...a: unknown[]) => unknown).apply(this, args);
          handler();
          globalThis.dispatchEvent(new Event("pushstate"));
          globalThis.dispatchEvent(new Event("replacestate"));
          globalThis.dispatchEvent(new Event("locationchange"));
          return ret;
        };
        (globalThis.history.pushState as unknown) = wrap(origPush);
        (globalThis.history.replaceState as unknown) = wrap(origReplace);
        patched = true;
      } catch {
        /* ignore patch failure */
      }
    }
    window.addEventListener("popstate", handler);
    window.addEventListener("hashchange", handler);
    window.addEventListener("pushstate", handler as EventListener);
    window.addEventListener("replacestate", handler as EventListener);
    window.addEventListener("locationchange", handler as EventListener);
    return () => {
      window.removeEventListener("popstate", handler);
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("pushstate", handler as EventListener);
      window.removeEventListener("replacestate", handler as EventListener);
      window.removeEventListener("locationchange", handler as EventListener);
      if (patched && origPush && origReplace) {
        try {
          globalThis.history.pushState = origPush as unknown as typeof history.pushState;
          globalThis.history.replaceState = origReplace as unknown as typeof history.replaceState;
        } catch {
          /* ignore */
        }
      }
    };
  }, []);
  return locationKey;
}

export type RouteIdentity = {
  locationKey: string;
  jobId: string;
  routeDocumentId: string;
  sessionIdentity: string;
};

/**
 * document_id 是稳定的文档身份，即使兼容的 legacy 链接同时携带 job_id
 * 也不互斥：job 选择不可变产物快照；document 拥有会话/标注与 Agent 操作。
 */
export function useRouteIdentity(): RouteIdentity {
  const locationKey = useLocationKey();
  const jobId = useMemo(() => resolveReaderJobId(defaultReaderPageConfigPort), [locationKey]);
  const routeDocumentId = useMemo(() => resolveReaderDocumentId(), [locationKey]);
  const sessionIdentity = jobId || routeDocumentId
    ? `job:${jobId}|document:${routeDocumentId}`
    : `location:${locationKey}`;
  return { locationKey, jobId, routeDocumentId, sessionIdentity };
}
