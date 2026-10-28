/** 在文档区打开一份 agent 写的 HTML。
 *
 * 隔离措施和它们各自挡住什么，写在 domain/board-html.ts 顶上。这里只负责
 * 「把字节取回来，灌进那个沙箱」。
 *
 * # 为什么用 srcdoc 而不是 src 指到端点
 *
 * `src="{api}/jobs/x/board/chart.html"` 会让 iframe 的源是 **API 的源**。开发时
 * 前后端同源（都在 5173/8000 走代理），那就等于没隔离；而且那条路要带
 * X-API-Key，iframe 的导航请求加不了自定义头。
 *
 * 所以走 `fetchProtected()`（带得上 key / 登录 Cookie）+ `srcdoc`（拿到唯一的不透明源）。
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ReaderBoardSlotProps } from "@retainpdf/reader/adapters";

import { fetchProtected, jobBoardFileUrl } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { BOARD_HTML_SANDBOX, withBoardHtmlCsp } from "../domain/board-html.js";

export function renderReaderBoard(props: ReaderBoardSlotProps) {
  if (!props.jobId) return null;
  // key 带上文件名：换一个产物要重新取，不能沿用上一个的 srcdoc。
  return <BoardHtmlPane key={`${props.jobId}:${props.name}`} {...props} />;
}

/** 导出只为门禁能真渲染它 —— 不然「关闭按钮没被 CSS 藏掉」那条只能去读源码，
 * 而读源码的断言在 class 改名或按钮被挪走时照样绿。
 * renderToStaticMarkup 不跑 effect，所以渲染它不会发请求。 */
export function BoardHtmlPane({ jobId, name, onClose }: ReaderBoardSlotProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState("");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const response = await fetchProtected(jobBoardFileUrl(API_PREFIX, jobId, name), {
          signal: abort.signal,
        });
        if (!response.ok) {
          setError(`打不开：服务端返回 ${response.status}`);
          return;
        }
        setHtml(await response.text());
      } catch (cause) {
        if (abort.signal.aborted) return;
        setError(`打不开：${cause instanceof Error ? cause.message : "取文件失败"}`);
      }
    })();
    return () => abort.abort();
  }, [jobId, name]);

  return (
    <div className="reader-board-pane" aria-label={`agent 产物 ${name}`}>
      <div className="reader-board-bar">
        <span className="reader-board-name">{name}</span>
        {/* 这块盖住了 PDF，关掉的路必须一直在 —— 底下的模式页签此刻是够不到的。 */}
        <button type="button" className="reader-board-close" onClick={() => closeRef.current()}>
          <X size={14} strokeWidth={2.2} aria-hidden />
          <span>关闭</span>
        </button>
      </div>
      {error ? (
        <p className="reader-board-error">{error}</p>
      ) : html === null ? (
        <p className="reader-board-loading">载入中…</p>
      ) : (
        <iframe
          className="reader-board-frame"
          title={name}
          // 这两个属性是整个功能的安全边界，改任何一个之前先读
          // domain/board-html.ts。**绝不能加 allow-same-origin** —— 它和
          // allow-scripts 同时出现时，iframe 里的脚本能拿到 parent.document，
          // 把自己的 sandbox 摘掉再重载，沙箱等于没有。
          sandbox={BOARD_HTML_SANDBOX}
          srcDoc={withBoardHtmlCsp(html)}
        />
      )}
    </div>
  );
}
