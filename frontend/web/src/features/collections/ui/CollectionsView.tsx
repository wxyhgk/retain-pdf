// "合集"tab 的内容:文件夹卡片网格 + 点开一个文件夹后的书目列表。
// 命名：领域/接口/服务统一叫 collections（`features/collections`, `api/collections`, `services.collections`），
// UI 层历史叫 categories（DOM id `categories-view` / 类 `.categories-*` / tab key `categories`）为契约保留。
//
// 图书馆网格的数据链路完全不动(调研计划「设计决策 2」)——文件夹展开时走
// collection_id → documents(拿 active_job_id)→ job_ids 过滤 library/books
// 这条桥接路径(services.collections.controller.fetchFolderBooks),换回来的
// 数据形状和图书馆首页卡片完全一致,直接复用 BookCard,不用
// 另外做一套"文件夹详情卡片"渲染,也不会有第二套删除确认气泡状态。
//
// 本文件只负责编排:列表/预览/文件夹内容三条加载路径分别下沉到
// use-collections-list / use-collection-previews / use-folder-items，
// 网格与文件夹两种渲染分别下沉到 CollectionsGridView / CollectionsFolderView。

import { useState } from "react";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { CollectionsFolderView } from "./CollectionsFolderView.jsx";
import { CollectionsGridView } from "./CollectionsGridView.jsx";
import type { CollectionRecord } from "../domain/controller.js";
import { useCollectionPreviews } from "./use-collection-previews.js";
import { useCollectionsList } from "./use-collections-list.js";
import { useFolderItems } from "./use-folder-items.js";
import type { CollectionsViewProps } from "./types.js";

export type {
  CollectionsController,
  CollectionsDialogStore,
  CollectionsLibraryActions,
  CollectionsReloadSignal,
  CollectionsViewProps,
} from "./types.js";

export function CollectionsView(props: CollectionsViewProps) {
  const { controller, dialogStore, reloadSignal, libraryActions } = props;
  // CollectionDialog 挂在 HomeApp.jsx 顶层,和这个组件是兄弟节点
  // (不是父子),保存/删除后没法直接 prop 回调回来——靠一个共享的版本号信号
  // 桥接:对话框保存成功就 bump 一次,这里订阅到变化就重新拉取列表。
  const { version } = useStoreSnapshot(reloadSignal);

  const [openFolder, setOpenFolder] = useState<CollectionRecord | null>(null);

  const { collections, listLoading, listError, reload, resetAutoRetry } =
    useCollectionsList({ controller, version, setOpenFolder });
  const previews = useCollectionPreviews({ collections, controller, version });

  const openFolderId = openFolder?.collection_id || "";
  const { folderItems, folderLoading, folderError, retryFolder } = useFolderItems({
    controller,
    openFolderId,
  });

  if (openFolder) {
    return (
      <CollectionsFolderView
        folder={openFolder}
        loading={folderLoading}
        error={folderError}
        items={folderItems}
        onBack={() => setOpenFolder(null)}
        onRetry={retryFolder}
        libraryActions={libraryActions}
      />
    );
  }

  return (
    <CollectionsGridView
      collections={collections}
      previews={previews}
      loading={listLoading}
      error={listError}
      onRetry={() => {
        // 重置自动重试标志,允许新的一轮"自动一次 + 手动兑底"
        resetAutoRetry();
        void reload();
      }}
      onCreate={() => dialogStore.open(null)}
      onOpenFolder={setOpenFolder}
      onManage={(collection) => dialogStore.open(collection)}
    />
  );
}
