// 卡片封面图加载 hook(蓝图 §2 features/library/,风险缓解 §8.3)。
//
// 复用:image-loader.js facade 的 loadFirstRecentJobImage(模块级 objectURL
// 缓存,从不 revoke——React 卸载**不得** revoke,失效只走
// invalidateRecentJobImages,这里完全不触碰缓存生命周期);card-presenter.js
// facade 的 recentJobRawImageUrls 取候选 URL 列表。
//
// imageCacheVersionOf 从 recent-job-card.js:12-29 拷贝(facade 未导出这个纯
// 函数,按蓝图口径直接拷贝而非新增导出面)。token 防竞态:job 切换或候选 URL
// 变化时递增 token,异步 resolve 回来时核对 token 仍是最新才写 state,防止
// 卡片快速复用时旧请求的图片覆盖新请求。

import { useEffect, useRef, useState } from "react";
import type { LibraryCardItem } from "../../domain/types.js";
import {
  loadFirstRecentJobImage,
} from "../../domain/card/recent-job-card-image-loader.js";
import {
  recentJobRawImageUrls,
} from "../../domain/card/recent-job-card-presenter.js";

// 缓存版本只在"封面可能真的变了"时才变。封面由后端 /jobs/{id}/cover 渲染
// (运行中 = 原始 PDF 首页,任务完成后才可能换成成品封面),运行过程中封面
// 内容并不变。原实现把 updated_at + progress.current/percent 等"每一拍轮询都在
// 变"的字段计入缓存版本 → 每秒都命中一次缓存 miss → 重新 fetch 封面 blob、
// 生成新的 objectURL、<img> src 一换就闪一下(还每拍泄漏一个 objectURL)。这
// 正是用户看到的"图书馆卡片运行中闪烁"。
//
// 修:非终态只按 status 计版本(queued/running 期间恒定,封面拉一次就够,不再
// 每拍重拉);到终态(succeeded/failed/canceled)才把 updated_at 计入——这时
// 封面可能刚产出/更新,需要 bust 一次;updated_at 也能区分不同 run(重跑会有
// 新的完成时间戳,封面随之刷新),不丢原来"重跑后换新封面"的能力。
const TERMINAL_COVER_STATUSES = new Set(["succeeded", "failed", "canceled", "cancelled"]);

function imageCacheVersionOf(item: LibraryCardItem = {}) {
  const status = `${item.status || ""}`.trim();
  if (TERMINAL_COVER_STATUSES.has(status)) {
    return `${status}|${item.updated_at ?? ""}`;
  }
  return status;
}

export function useRecentJobCover(item?: LibraryCardItem | null) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const tokenRef = useRef(0);
  const safeItem = item || {};

  const rawUrls = recentJobRawImageUrls(safeItem);
  const cacheVersion = imageCacheVersionOf(safeItem);
  const rawUrlsKey = rawUrls.join("|");

  useEffect(() => {
    const token = (tokenRef.current += 1);
    if (rawUrls.length === 0) {
      setCoverUrl(null);
      return undefined;
    }
    let cancelled = false;
    loadFirstRecentJobImage(rawUrls, { cacheVersion })
      .then((url) => {
        if (cancelled || tokenRef.current !== token) {
          return;
        }
        setCoverUrl(url || null);
      })
      .catch(() => {
        if (cancelled || tokenRef.current !== token) {
          return;
        }
        setCoverUrl(null);
      });
    return () => {
      cancelled = true;
    };
    // rawUrlsKey/cacheVersion 是 rawUrls/cacheVersion 的 primitive 化,用作
    // effect 依赖(数组/对象每次渲染新引用,不能直接进依赖表)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUrlsKey, cacheVersion]);

  return coverUrl;
}
