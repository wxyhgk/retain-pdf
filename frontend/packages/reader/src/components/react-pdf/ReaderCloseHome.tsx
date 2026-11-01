// 阅读器顶栏托盘里的按钮：「返回主页」，以及放在笔记（Studio）里时的「笔记」（ReaderNotesToggle）。
//
// 「返回主页」：
// 1) 软打开（主页 SoftReaderHost iframe）→ postMessage 父页 history.back，主页不刷新
// 2) 独立 reader.html 且从主页 assign 进来 → history.back
// 3) 深链直达 → location.assign(index.html)
// 放在别的应用里（?embed=，例如笔记 Studio）时不是软阅读层：跳过 1)，回主页的地址带着 embed。

import { useSyncExternalStore, type ReactNode } from "react";
import { NotebookPen, X } from "lucide-react";
import { SOFT_READER_CLOSE_MESSAGE, embeddedIn } from "../../shared/navigation/soft-reader.js";
import { readerNotesPanel } from "../../external.js";
import type { ReaderNotesPanelState } from "../../adapters.js";

function homeIndexUrl() {
  const url = new URL("./index.html", window.location.href);
  const embed = embeddedIn();
  if (embed) url.searchParams.set("embed", embed);
  return url.href;
}

function requestSoftHostClose(): boolean {
  if (typeof window === "undefined") return false;
  if (window.self === window.top) return false;
  if (embeddedIn()) return false;
  try {
    window.parent.postMessage(
      { type: SOFT_READER_CLOSE_MESSAGE },
      window.location.origin,
    );
    return true;
  } catch {
    return false;
  }
}

export function canReturnToReaderReferrer(
  referrer: string,
  currentHref: string,
  historyLength: number,
): boolean {
  if (historyLength <= 1 || !referrer) return false;
  try {
    const current = new URL(currentHref);
    const previous = new URL(referrer, current);
    return previous.origin === current.origin
      && !/reader\.html$/i.test(previous.pathname)
      && !/detail\.html$/i.test(previous.pathname);
  } catch {
    return false;
  }
}

/** 从阅读页回主页 */
export function navigateReaderToHome() {
  if (typeof window === "undefined") return;

  // 软阅读层：让父页卸层，绝不在 iframe 里 assign 主页
  if (requestSoftHostClose()) {
    return;
  }

  // history.length alone is not proof that the previous entry is RetainPDF.
  // A stale home-return session record could previously send a deep-linked
  // Reader tab to an unrelated or blank page. Only use back when the browser's
  // actual referrer is a same-origin home route.
  if (canReturnToReaderReferrer(
    document.referrer,
    window.location.href,
    window.history.length,
  )) {
    window.history.back();
    return;
  }

  window.location.assign(homeIndexUrl());
}

/** 托盘里的圆角按钮（「关闭」「笔记」同一个样子）。 */
function ReaderTrayButton({
  id,
  className,
  label,
  pressed,
  onClick,
  children,
}: {
  id?: string;
  className: string;
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button id={id} type="button" className={className} aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

export function ReaderCloseHome({ onBeforeClose }: { onBeforeClose?: () => void } = {}) {
  const close = () => {
    onBeforeClose?.();
    navigateReaderToHome();
  };

  return (
    <ReaderTrayButton id="reader-close-home-btn" className="reader-close-home-btn" label="返回主页" onClick={close}>
      <X className="reader-close-home-icon" size={18} strokeWidth={2.25} aria-hidden />
      <span className="reader-close-home-label">关闭</span>
    </ReaderTrayButton>
  );
}

const NO_NOTES_PANEL: ReaderNotesPanelState = { available: false, open: false, title: null };
const noSubscribe = () => () => {};
const noNotesPanel = () => NO_NOTES_PANEL;

/**
 * 「笔记」：放在笔记（Studio）里、Studio 认 open-notes 时才有（宿主给 notesPanel）。点了让 Studio 在阅读页旁边开、收这本书的笔记；
 * 按下没有跟着 Studio 说的走（它那边收起、换了笔记也会告诉我们）。只有图标，「笔记：书名」在悬停里。
 */
export function ReaderNotesToggle() {
  const panel = readerNotesPanel();
  const getState = panel?.getState ?? noNotesPanel;
  const state = useSyncExternalStore(panel?.subscribe ?? noSubscribe, getState, getState);
  if (!panel || !state.available) return null;
  const label = state.open ? `收起笔记${state.title ? `：${state.title}` : ""}` : "打开这本书的笔记";
  return (
    <ReaderTrayButton className="reader-notes-toggle" label={label} pressed={state.open} onClick={panel.toggle}>
      <NotebookPen className="reader-close-home-icon" size={18} strokeWidth={2.25} aria-hidden />
    </ReaderTrayButton>
  );
}
