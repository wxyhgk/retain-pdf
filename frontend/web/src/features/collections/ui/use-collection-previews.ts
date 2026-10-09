// 文件夹卡片的封面堆叠预览:collection_id → 该文件夹前几本书(job 卡片形状)。
// 每个文件夹各自独立拉取,互不阻塞——某个文件夹加载慢不该拖住其余卡片先显示。
import { useEffect, useState } from "react";
import type { CollectionsController } from "./types.js";
import type { CollectionRecord } from "../domain/controller.js";
import type { LibraryCardItem } from "@/features/library/index.js";

type UseCollectionPreviewsArgs = {
  collections: CollectionRecord[];
  controller: CollectionsController;
  version: number;
};

export function useCollectionPreviews({ collections, controller, version }: UseCollectionPreviewsArgs) {
  const [previews, setPreviews] = useState<Record<string, LibraryCardItem[]>>({});

  const collectionIdsKey = collections.map((item) => item.collection_id).join(",");
  useEffect(() => {
    if (!collectionIdsKey) {
      return undefined;
    }
    let cancelled = false;
    collections.forEach((collection) => {
      controller
        .fetchFolderBooks(collection.collection_id)
        .then((items) => {
          if (cancelled) {
            return;
          }
          setPreviews((prev) => ({ ...prev, [collection.collection_id]: items }));
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setPreviews((prev) => ({ ...prev, [collection.collection_id]: [] }));
        });
    });
    return () => {
      cancelled = true;
    };
    // collectionIdsKey 只在"文件夹集合本身"变化时变——只加/删书(文件夹集合
    // 不变)不会触发这个 key 变化。version 补上这一半:管理弹窗保存成功就
    // bump 一次,不管这次改的是名称还是成员,预览缩略图都要跟着刷新,否则
    // 编辑完书目后卡片上的封面堆叠会停在旧数据,直到下次新建/删除文件夹。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, collectionIdsKey, version]);

  return previews;
}
