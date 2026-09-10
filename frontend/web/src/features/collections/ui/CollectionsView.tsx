// "合集"tab 的内容:文件夹卡片网格 + 点开一个文件夹后的书目列表。
// 命名：领域/接口/服务统一叫 collections（`features/collections`, `api/collections`, `services.collections`），
// UI 层历史叫 categories（DOM id `categories-view` / 类 `.categories-*` / tab key `categories`）为契约保留。
//
// 图书馆网格的数据链路完全不动(调研计划「设计决策 2」)——文件夹展开时走
// collection_id → documents(拿 active_job_id)→ job_ids 过滤 library/books
// 这条桥接路径(services.collections.controller.fetchFolderBooks),换回来的
// 数据形状和图书馆首页卡片完全一致,直接复用 BookCard,不用
// 另外做一套"文件夹详情卡片"渲染,也不会有第二套删除确认气泡状态。

import { useCallback, useEffect, useRef, useState } from "react";
import type { DialogStore } from "@/platform/store/dialog-store.js";
import type { CollectionRecord } from "../domain/controller.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { EmptyState } from "@/ui/icons/EmptyState.jsx";
// TODO(feature-layout 批次 4): library 迁入 src/features 后改指 @/features/library。
import { BookCard, buildDefaultBookCardActions } from "@/features/library/index.js";
import { useRecentJobCover } from "@/features/library/index.js";

// 文件夹卡片的封面堆叠预览(参考 PDF_MD_lib 的 FolderCard.tsx:最多 4 本书的
// 封面像扑克牌一样扇形叠放,越靠前的书 z 越高、叠在最外面)。封面图沿用
// BookCard 同一个 useRecentJobCover hook(同一份 objectURL 缓存,不会
// 因为这里多渲染一份而重复请求)。
const MAX_STACK = 4;

function FolderCoverStackLayer({ item, index, total }) {
  const coverUrl = useRecentJobCover(item);
  const z = 10 + (total - 1 - index);
  const rot = (index - (total - 1) / 2) * -5;
  const offsetX = (index - (total - 1) / 2) * 5;
  return (
    <div
      className="category-card-stack-item"
      style={{
        top: `${6 + index * 7}px`,
        bottom: `${10 + (total - 1 - index) * 6}px`,
        zIndex: z,
        transform: `translateX(${offsetX}px) rotate(${rot}deg)`,
      }}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" />
      ) : (
        <span className="category-card-stack-fallback" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M9 12.5h6M9 15.5h6M9 9.5h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </div>
  );
}

function FolderCoverStack({ items }) {
  const stack = (Array.isArray(items) ? items : []).slice(0, MAX_STACK);
  return (
    <div className="category-card-stack">
      {stack.length === 0 ? (
        <div className="category-card-stack-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4.5l1.5 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span>空合集</span>
        </div>
      ) : (
        stack.map((item, index) => (
          <FolderCoverStackLayer key={item.job_id} item={item} index={index} total={stack.length} />
        ))
      )}
    </div>
  );
}


/** 由页面注入：合集域的三件依赖 + 图书馆的跳转动作。 */
export type CollectionsController = ReturnType<
  typeof import("../domain/controller.js").createCollectionsController
>;

// TODO(feature-layout 批次 5): dialog-store / use-dialog-state 是通用状态工具，
// 随批次 5 迁入 platform 后改指。
export type CollectionsDialogStore = DialogStore<CollectionRecord | null>;

export type CollectionsReloadSignal = {
  actions: Record<string, (...args: any[]) => unknown>;
  getSnapshot: () => any;
  subscribe: (listener: (snapshot: any) => void) => () => void;
};

export type CollectionsLibraryActions = {
  openBookDetail: (...args: any[]) => unknown;
  openJobReader: (...args: any[]) => unknown;
  openSourceReader: (...args: any[]) => unknown;
  selectJob: (...args: any[]) => unknown;
};

export type CollectionsViewProps = {
  controller: CollectionsController;
  dialogStore: CollectionsDialogStore;
  reloadSignal: CollectionsReloadSignal;
  libraryActions: CollectionsLibraryActions;
};

export function CollectionsView(props: CollectionsViewProps) {
  const { controller, dialogStore, reloadSignal, libraryActions } = props;
  // CollectionManageDialog 挂在 HomeApp.jsx 顶层,和这个组件是兄弟节点
  // (不是父子),保存/删除后没法直接 prop 回调回来——靠一个共享的版本号信号
  // 桥接:对话框保存成功就 bump 一次,这里订阅到变化就重新拉取列表。
  const { version } = useStoreSnapshot(reloadSignal);

  const [collections, setCollections] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const listRequestSeqRef = useRef(0);
  const listLoadedRef = useRef(false);
  // 文件夹卡片的封面堆叠预览:collection_id → 该文件夹前几本书(job 卡片形状)。
  const [previews, setPreviews] = useState({});

  const [openFolder, setOpenFolder] = useState(null);
  const [folderItems, setFolderItems] = useState([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState("");

  // 桌面端启动早期 rust_api 未就绪(日志里见过 90s 端口等待超时)、或后端
  // 被大任务短暂拖住时,一次失败不该直接把用户拍在错误态——列表与文件夹
  // 内容各自动重试一次(1.5s),仍失败才亮错误 + 手动重试入口。
  const listAutoRetriedRef = useRef(false);
  const reloadRef = useRef(null);

  const reload = useCallback((options: { soft?: boolean } = {}) => {
    // soft：version bump / 二次拉取时保留旧列表，不整表切成 loading（分类 tab 闪一下）
    // 首次挂载不能由全局 version 判断：该 store 会跨 tab 挂载保留版本号，
    // version > 0 并不表示当前 CollectionsView 已经完成过首屏请求。
    const soft = Boolean(options.soft) && listLoadedRef.current;
    const requestSeq = ++listRequestSeqRef.current;
    if (!soft) {
      setListLoading(true);
    }
    setListError("");
    return controller
      .listCollections()
      .then(({ collections: items = [] } = {}) => {
        if (requestSeq !== listRequestSeqRef.current) return;
        listAutoRetriedRef.current = false;
        listLoadedRef.current = true;
        setCollections(items);
        // 正在查看的文件夹如果被删了(管理弹窗里点了删除),退回文件夹网格。
        setOpenFolder((current) => {
          if (!current) {
            return current;
          }
          const stillExists = items.some((item) => item.collection_id === current.collection_id);
          return stillExists ? items.find((item) => item.collection_id === current.collection_id) : null;
        });
        setListLoading(false);
      })
      .catch((err) => {
        if (requestSeq !== listRequestSeqRef.current) return;
        if (!listAutoRetriedRef.current) {
          // 瞬时故障:静默自动重试一次,保持 loading 不闪错误
          listAutoRetriedRef.current = true;
          window.setTimeout(() => {
            void reloadRef.current?.();
          }, 1500);
          return;
        }
        listLoadedRef.current = true;
        setListError(err?.message || "读取合集失败，请稍后重试。");
        setListLoading(false);
      });
  }, [controller]);
  reloadRef.current = reload;

  useEffect(() => {
    // 首屏 hard loading；管理弹窗 bump version 后 soft 刷新
    reload({ soft: listLoadedRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, version]);

  const collectionIdsKey = collections.map((item) => item.collection_id).join(",");
  useEffect(() => {
    if (!collectionIdsKey) {
      return undefined;
    }
    let cancelled = false;
    // 每个文件夹卡片的封面堆叠预览各自独立拉取,互不阻塞——某个文件夹加载慢
    // 不该拖住其余卡片先显示出来。
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

  // 文件夹内容手动重试:folderRetryTick 进 effect 依赖,+1 即重新拉取。
  const [folderRetryTick, setFolderRetryTick] = useState(0);

  const openFolderId = openFolder?.collection_id || "";
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

  if (openFolder) {
    return (
      <section id="categories-folder-view" className="library-view categories-view collections-view" aria-label={`合集:${openFolder.name}`} data-collections-view="true">
        <div className="categories-folder-head collections-folder-head">
          <button
            id="categories-back-btn"
            type="button"
            className="categories-back-btn"
            onClick={() => setOpenFolder(null)}
          >
            ← 返回合集
          </button>
          <h2>{openFolder.name}</h2>
        </div>
        {folderLoading ? (
          <div className="events-empty">正在加载…</div>
        ) : folderError ? (
          <div className="events-empty">
            <p>{folderError}</p>
            <button
              type="button"
              className="app-button secondary"
              style={{ marginTop: 12 }}
              onClick={() => setFolderRetryTick((tick) => tick + 1)}
            >
              重试
            </button>
          </div>
        ) : folderItems.length === 0 ? (
          <EmptyState
            instrument="balance"
            title="这个合集还没有书"
            hint="点合集卡片上的「管理」，从书库勾选 PDF 放进来。"
          />
        ) : (
          <div className="recent-jobs-list library-grid">
            {folderItems.map((item) => (
              <BookCard
                key={item.job_id}
                item={item}
                actions={buildDefaultBookCardActions(item, {
                  onReader: libraryActions.openJobReader,
                  onReadSource: libraryActions.openSourceReader,
                })}
                onSelect={libraryActions.selectJob}
                onOpenDetail={libraryActions.openBookDetail}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section id="categories-view" className="library-view categories-view collections-view" aria-label="合集" data-collections-view="true">
      <div className="categories-head collections-head">
        <button
          id="categories-create-btn"
          type="button"
          className="app-button"
          onClick={() => dialogStore.open(null)}
        >
          新建合集
        </button>
      </div>
      {listLoading ? (
        <div className="events-empty">正在加载合集…</div>
      ) : listError ? (
        <div className="events-empty">
          <p>{listError}</p>
          <button
            type="button"
            className="app-button secondary"
            style={{ marginTop: 12 }}
            onClick={() => {
              // 重置自动重试标志,允许新的一轮“自动一次 + 手动兑底”
              listAutoRetriedRef.current = false;
              void reload();
            }}
          >
            重试
          </button>
        </div>
      ) : collections.length === 0 ? (
        <EmptyState
          id="categories-empty"
          instrument="telescope"
          title="还没有合集"
          hint="把 PDF 按主题分组成书架，之后更好找。"
        >
          <button
            type="button"
            className="app-button empty-state-action"
            onClick={() => dialogStore.open(null)}
          >
            新建合集
          </button>
        </EmptyState>
      ) : (
        <div id="categories-grid" className="categories-grid collections-grid" data-collections-grid="true">
          {collections.map((collection) => (
            <div key={collection.collection_id} className="category-card collection-card">
              <button
                type="button"
                className="category-card-open"
                onClick={() => setOpenFolder(collection)}
              >
                <FolderCoverStack items={previews[collection.collection_id]} />
                <span className="category-card-name" title={collection.name}>{collection.name}</span>
                <span className="category-card-count">{collection.document_count} 本</span>
              </button>
              <button
                type="button"
                className="category-card-manage"
                aria-label={`管理合集 ${collection.name}`}
                title="管理"
                onClick={(event) => {
                  event.stopPropagation();
                  dialogStore.open(collection);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" stroke="currentColor" strokeWidth="1.65" fill="none" />
                  <path d="M19.1 13.2c.06-.39.09-.79.09-1.2s-.03-.81-.09-1.2l2.02-1.55-1.9-3.29-2.38.96a8.01 8.01 0 0 0-2.08-1.2L14.4 3.2h-3.8l-.36 2.52c-.75.28-1.45.69-2.08 1.2l-2.38-.96-1.9 3.29L5.9 10.8c-.06.39-.09.79-.09 1.2s.03.81.09 1.2l-2.02 1.55 1.9 3.29 2.38-.96c.63.51 1.33.92 2.08 1.2l.36 2.52h3.8l.36-2.52c.75-.28 1.45-.69 2.08-1.2l2.38.96 1.9-3.29-2.02-1.55Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
