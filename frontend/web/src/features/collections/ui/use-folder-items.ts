// 文件夹内容加载:openFolderId 变化或手动重试时拉取,瞬时失败自动重试一次。
import { useCallback, useEffect, useState } from "react";
import type { CollectionsController } from "./types.js";
import type { LibraryCardItem } from "@/features/library/index.js";

type UseFolderItemsArgs = {
  controller: CollectionsController;
  openFolderId: string;
};

export function useFolderItems({ controller, openFolderId }: UseFolderItemsArgs) {
  const [folderItems, setFolderItems] = useState<LibraryCardItem[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState("");
  // 文件夹内容手动重试:folderRetryTick 进 effect 依赖,+1 即重新拉取。
  const [folderRetryTick, setFolderRetryTick] = useState(0);

  useEffect(() => {
    if (!openFolderId) {
      setFolderItems([]);
      setFolderError("");
      return undefined;
    }
    let cancelled = false;
    // 与合集列表同一口径:瞬时失败自动重试一次,仍失败才亮错误。
    let autoRetried = false;
    setFolderLoading(true);
    setFolderError("");
    const loadFolder = () =>
      controller
        .fetchFolderBooks(openFolderId)
        .then((items) => {
          if (cancelled) {
            return;
          }
          setFolderItems(items);
          setFolderLoading(false);
        })
        .catch((err) => {
          if (cancelled) {
            return;
          }
          if (!autoRetried) {
            autoRetried = true;
            window.setTimeout(() => {
              if (!cancelled) {
                void loadFolder();
              }
            }, 1500);
            return;
          }
          setFolderError(err?.message || "读取合集内容失败，请稍后重试。");
          setFolderLoading(false);
        });
    void loadFolder();
    // 用 collection_id(原始类型)而不是 openFolder(对象引用)做依赖——
    // reload() 每次都会给同一个文件夹造一个新对象(见上面 setOpenFolder 里
    // 的 items.find(...)),按对象引用算依赖会导致"没真的切换文件夹"也
    // 重新请求一次;更关键的是原来那版完全没有 cancelled 守卫,快速切换
    // 两个文件夹时后发的请求可能先resolve、先发的请求后resolve,导致标题
    // 显示 B 文件夹、书目列表却是 A 文件夹的旧数据。
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, openFolderId, folderRetryTick]);

  const retryFolder = useCallback(() => {
    setFolderRetryTick((tick) => tick + 1);
  }, []);

  return { folderItems, folderLoading, folderError, retryFolder };
}
