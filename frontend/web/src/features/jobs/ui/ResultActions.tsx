// 结果操作行(蓝图 §2 features/status/;镜像 job-status-card-rendering.js 的
// syncPrimaryActions/setActionLinkState——DOM 契约逐 id/class 保留)。
//
// 「对照阅读」链接(dialogs 蓝图 §4 施工范围第 6 条 ①):运行时复核确认
// 3b 只渲染了裸 <a href="reader.html?...">,没有拦截点击——整页跳转会
// 打断 SPA 的对话框体验,补上 onClick(preventDefault + onReaderClick)
// 走 ReaderDialog 统一的 openReaderRequested 入口,href 保留作为
// JS 失效时的可用兜底。
//
// markdownBundle/sourcePdf/pdf 三个下载链接(dialogs 蓝图 §7):这几个 id
// 命中 artifact-downloads 域的 document 级委托点击(controller.js 的
// handleProtectedArtifactClick,composition.js 已挂载 bindEvents()),点击
// 时该处理器会先于原生 <a> 默认跳转执行 event.preventDefault()——按钮本身不
// 需要额外接 onClick(委托点击与谁渲染了按钮无关)。这里只订阅
// artifacts 功能 busy-store 的对应 actionId 分片,驱动"下载中...".
// 文案与禁用态(方案二:避免父组件因轮询重渲染把命令式写入的下载进度文案
// 覆盖回原始 label)。

import { useHomeServices } from "@/app/home/home-services-context.js";
import { useArtifactDownloadBusy } from "@/features/artifacts/index.js";
import { STATUS_CARD_ACTION_IDS } from "./status-card-dom-ids.js";

type ActionLinkProps = {
  id: string;
  label: string;
  ready: boolean;
  url: string;
  onClick?: () => void;
};

function ActionLink({ id, label, ready, url, onClick }: ActionLinkProps) {
  const services = useHomeServices();
  const busyState = useArtifactDownloadBusy(services.artifactDownloads.busyStore, id);
  const enabled = Boolean(ready && url) && !busyState.busy;
  const isReaderLink = id === STATUS_CARD_ACTION_IDS.reader;
  const displayLabel = busyState.busy ? (busyState.label || "下载中...") : label;
  return (
    <a
      id={id}
      className={`status-action-btn task-toolbar-btn-result${ready ? "" : " hidden"}${enabled ? "" : " disabled"}`}
      href={ready && url ? url : "#"}
      target={isReaderLink ? undefined : "_blank"}
      rel={isReaderLink ? undefined : "noopener noreferrer"}
      aria-label={label}
      title={label}
      aria-disabled={enabled ? "false" : "true"}
      data-url={ready && url ? url : ""}
      onClick={isReaderLink && onClick
        ? (event) => {
          if (!enabled) {
            return;
          }
          event.preventDefault();
          onClick();
        }
        : undefined}
    >
      <span>{displayLabel}</span>
    </a>
  );
}

type ResultActionsProps = {
  markdownBundleReady?: boolean;
  markdownBundleUrl?: string;
  sourcePdfReady?: boolean;
  sourcePdfUrl?: string;
  readerReady?: boolean;
  readerUrl?: string;
  pdfReady?: boolean;
  pdfUrl?: string;
  onReaderClick?: () => void;
};

export function ResultActions({
  markdownBundleReady = false,
  markdownBundleUrl = "",
  sourcePdfReady = false,
  sourcePdfUrl = "",
  readerReady = false,
  readerUrl = "",
  pdfReady = false,
  pdfUrl = "",
  onReaderClick,
}: ResultActionsProps) {
  const hasActions = markdownBundleReady || pdfReady || readerReady || sourcePdfReady;

  return (
    <div className={`status-result-actions${hasActions ? "" : " hidden"}`}>
      <ActionLink id={STATUS_CARD_ACTION_IDS.markdownBundle} label="下载 Markdown" ready={markdownBundleReady} url={markdownBundleUrl} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.sourcePdf} label="下载原始 PDF" ready={sourcePdfReady} url={sourcePdfUrl} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.reader} label="对照阅读" ready={readerReady} url={readerUrl} onClick={onReaderClick} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.pdf} label="下载 PDF" ready={pdfReady} url={pdfUrl} />
    </div>
  );
}
