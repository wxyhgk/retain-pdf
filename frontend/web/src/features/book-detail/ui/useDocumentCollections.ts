// 详情 collections 子域：collections 列表、N+1 限流 + 缓存、toggle、memberCollections。
// 由 useBookDetailDocument 门面组合。

import { useEffect, useMemo, useRef, useState } from "react";

function createPLimit(concurrency: number) {
  let active = 0;
  const queue: Array<{
    fn: () => Promise<any>;
    resolve: (v: any) => void;
    reject: (e: any) => void;
  }> = [];
  const next = () => {
    if (queue.length === 0 || active >= concurrency) return;
    active += 1;
    const { fn, resolve, reject } = queue.shift()!;
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        next();
      });
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push({ fn, resolve: resolve as any, reject });
      next();
    });
}

/**
 * @param {object} options
 * @param {boolean} options.open
 * @param {string} options.documentId
 * @param {object} [options.collectionsCtl]
 * @param {object} [options.collectionsReload]
 * @param {(msg:string)=>void} [options.setError] 外部 error setter（门面传入 meta.setError 实现统一 error）
 */
export function useDocumentCollections({
  open,
  documentId,
  collectionsCtl,
  collectionsReload,
  setError: externalSetError,
}: any) {
  const [collections, setCollections] = useState<Array<{ collection_id: string; name: string; member: boolean }>>([]);
  const [collectionsBusy, setCollectionsBusy] = useState("");
  const [internalError, setInternalError] = useState("");
  const setError = externalSetError || setInternalError;
  // 缓存：documentId -> Map<collection_id, boolean>
  const membershipCacheRef = useRef<Map<string, Map<string, boolean>>>(new Map());

  const memberCollections = useMemo(
    () => collections.filter((c) => c.member).map((c) => c.name),
    [collections],
  );

  useEffect(() => {
    if (!open || !documentId) {
      setCollections([]);
      return undefined;
    }
    if (!collectionsCtl) {
      setCollections([]);
      return undefined;
    }
    let cancelled = false;
    // 依赖 collectionsCtl，reloadSignal 变化也应重新拉取（若调用方传入 version 则会触发）
    collectionsCtl
      .listCollections()
      .then(async (list: any) => {
        const rows: Array<{ collection_id: string; name: string }> = Array.isArray(list?.collections)
          ? list.collections
          : Array.isArray(list)
            ? list
            : [];
        if (rows.length === 0) {
          if (!cancelled) setCollections([]);
          return;
        }
        const pLimit = createPLimit(3);
        const tasks = rows.map((col) =>
          pLimit(async () => {
            const colId = col.collection_id;
            const cachedMap = membershipCacheRef.current.get(documentId);
            if (cachedMap && cachedMap.has(colId)) {
              return { collection_id: colId, name: col.name, member: cachedMap.get(colId) as boolean };
            }
            try {
              const ids: string[] = await collectionsCtl.listCollectionDocumentIds(colId);
              const member = Array.isArray(ids) ? ids.includes(documentId) : false;
              let m = membershipCacheRef.current.get(documentId);
              if (!m) {
                m = new Map();
                membershipCacheRef.current.set(documentId, m);
              }
              m.set(colId, member);
              return { collection_id: colId, name: col.name, member };
            } catch {
              // 失败视为非成员并缓存 false，避免重复打失败请求
              let m = membershipCacheRef.current.get(documentId);
              if (!m) {
                m = new Map();
                membershipCacheRef.current.set(documentId, m);
              }
              m.set(colId, false);
              return { collection_id: colId, name: col.name, member: false };
            }
          }),
        );
        // Promise.all + pLimit(3) 限流；用 allSettled 兜底单项失败不影响整体
        const settled = await Promise.allSettled(tasks);
        const withMembership = settled.map((r, idx) => {
          if (r.status === "fulfilled") return r.value as { collection_id: string; name: string; member: boolean };
          const col = rows[idx];
          return { collection_id: col.collection_id, name: col.name, member: false };
        });
        if (!cancelled) setCollections(withMembership);
      })
      .catch(() => {
        if (!cancelled) setCollections([]);
      });
    return () => {
      cancelled = true;
    };
    // collectionsCtl 入 deps；collectionsReload 变化驱动刷新（取 version 或对象本身）
  }, [open, documentId, collectionsCtl, collectionsReload]);

  async function toggleCollection(collectionId: string, nextMember: boolean) {
    if (!collectionsCtl || collectionsBusy) return;
    setCollectionsBusy(collectionId);
    // 复用门面统一 error 通道
    if (!externalSetError) setInternalError("");
    else setError("");
    try {
      if (nextMember) await collectionsCtl.addDocuments(collectionId, [documentId]);
      else await collectionsCtl.removeDocument(collectionId, documentId);
      setCollections((prev) =>
        prev.map((c) => (c.collection_id === collectionId ? { ...c, member: nextMember } : c)),
      );
      // 同步缓存
      let m = membershipCacheRef.current.get(documentId);
      if (!m) {
        m = new Map();
        membershipCacheRef.current.set(documentId, m);
      }
      m.set(collectionId, nextMember);
      collectionsReload?.actions.bump();
    } catch (err: any) {
      setError(err?.message || "更新合集失败");
    } finally {
      setCollectionsBusy("");
    }
  }

  return {
    collections,
    setCollections,
    collectionsBusy,
    setCollectionsBusy,
    memberCollections,
    toggleCollection,
    // 暴露 error 仅当门面未接管时使用
    error: internalError,
    setError: setError,
  };
}
