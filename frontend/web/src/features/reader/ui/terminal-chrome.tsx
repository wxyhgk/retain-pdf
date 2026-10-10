/** 终端面板的外壳：标签条、作用域条、提示 chip、agent 产物条。
 *
 * 和 terminal.tsx 分开只有一个理由：**这三样都不碰 xterm**。混在一起时那个文件
 * 到了 413 行，撞上体量棘轮（阈值 380）。拆开之后一边认 PTY 和 WebSocket 的
 * 生命周期，一边认按钮。
 *
 * 没有登记棘轮豁免 —— 那是把问题往后推，而这个文件本来就该拆。
 */
import { isPageHidden } from "@/platform/utils/page-visibility.js";
import { useCallback, useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";

import {
  openableBoardItems,
  parseBoardListing,
  type BoardListing,
} from "../domain/board.js";

import {
  dismissAllSuggestions,
  dismissSuggestion,
  readDismissedSuggestions,
  visibleSuggestions,
  writeDismissedSuggestions,
} from "@/features/fx-terminal/index.js";

import {
  ensureCollectionWorkspace,
  loadCollectionOptions,
  scopeLabel,
  type CollectionOption,
  type TerminalScope,
} from "../domain/terminal-scope.js";
import { MAX_TERMINALS, tabLabel, type TerminalTab } from "../domain/terminal-tabs.js";

/** 标签条。
 *
 * 标签上带作用域,不只带序号 —— 两条长得一样而跑在不同的书上,切错了没有任何
 * 提示,得到的答案却是另一批书的。
 */
export function TerminalTabBar({
  tabs,
  activeId,
  onActivate,
  onAdd,
  onClose,
}: {
  tabs: readonly TerminalTab[];
  activeId: string;
  onActivate: (id: string) => void;
  onAdd: () => void;
  onClose: (id: string) => void;
}) {
  return (
    <div className="reader-terminal-tabs" aria-label="终端">
      {tabs.map((tab, index) => (
        <span key={tab.id} className="reader-terminal-tab-slot">
          <button
            type="button"
            className="reader-terminal-tab"
            aria-pressed={tab.id === activeId}
            onClick={() => onActivate(tab.id)}
          >
            {tabLabel(tab, index)}
          </button>
          {tabs.length > 1 ? (
            <button
              type="button"
              className="reader-terminal-tab-close"
              aria-label={`关闭终端 ${index + 1}`}
              title="关掉这条（会结束它的 fx 进程）"
              onClick={() => onClose(tab.id)}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
      <button
        type="button"
        className="reader-terminal-tab-add"
        aria-label="新开一条终端"
        title={
          tabs.length >= MAX_TERMINALS
            ? `最多 ${MAX_TERMINALS} 条 —— 每条都是一个 fx 进程`
            : "新开一条（和当前这条各自独立）"
        }
        disabled={tabs.length >= MAX_TERMINALS}
        onClick={onAdd}
      >
        +
      </button>
    </div>
  );
}

/** 作用域切换条：这本书 / 某个文件夹。
 *
 * 只在**真的有可选文件夹**时出现。没有文件夹的人（多数）看到的终端和以前
 * 一模一样 —— 给一个点了只会说"没有文件夹"的控件，比没有更糟。
 */
export function TerminalScopeBar({
  scope,
  jobId,
  baseUrl,
  apiKey,
  onChange,
}: {
  scope: TerminalScope;
  jobId: string;
  baseUrl: string;
  apiKey: string;
  onChange: (scope: TerminalScope) => void;
}) {
  const [options, setOptions] = useState<CollectionOption[]>([]);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchJson = useCallback(
    async (path: string) => {
      const response = await fetch(new URL(path, baseUrl), {
        headers: { "X-API-Key": apiKey },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    },
    [baseUrl, apiKey],
  );

  useEffect(() => {
    let cancelled = false;
    void loadCollectionOptions(fetchJson).then((list) => {
      if (!cancelled) setOptions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchJson]);

  const select = useCallback(
    async (option: CollectionOption | null) => {
      setFailure("");
      if (!option) {
        onChange({ kind: "job", jobId });
        return;
      }
      // 必须先物化再切 —— 不然终端会落进一个过期或不存在的工作区,而那个失败
      // 是静默的（Python 侧退回私有目录,表现是 books/ 空着）。
      setBusy(true);
      const reason = await ensureCollectionWorkspace(fetchJson, option.collectionId);
      setBusy(false);
      if (reason) {
        setFailure(reason);
        return;
      }
      onChange({ kind: "collection", ...option });
    },
    [fetchJson, jobId, onChange],
  );

  if (options.length === 0) return null;
  return (
    <div className="reader-terminal-scope" aria-label="终端作用域">
      <span className="reader-terminal-scope-lead">范围</span>
      <button
        type="button"
        className="reader-terminal-scope-option"
        aria-pressed={scope.kind === "job"}
        disabled={busy}
        onClick={() => void select(null)}
      >
        这本书
      </button>
      {options.map((option) => {
        const active =
          scope.kind === "collection" && scope.collectionId === option.collectionId;
        return (
          <button
            key={option.collectionId}
            type="button"
            className="reader-terminal-scope-option"
            aria-pressed={active}
            disabled={busy}
            title={`让 fx 一次看见这 ${option.documentCount} 本书`}
            onClick={() => void select(option)}
          >
            {scopeLabel({ kind: "collection", ...option })}
          </button>
        );
      })}
      {failure ? <span className="reader-terminal-scope-note">{failure}</span> : null}
    </div>
  );
}

/** 终端上方的「你可以让它做什么」。
 *
 * agent 能产出的四类东西在阅读页里都有呈现，但**这件事唯一的说明书是 AGENTS.md，
 * 而那份是写给模型看的** —— 用户打开终端只看到 fx 的裸 TUI，不知道 cwd 在哪、
 * 旁边有什么、能要什么。阅读路径和画布的空状态都指向终端，而终端此前指向虚无：
 * 这一行把断掉的环接上。
 *
 * 点了**不执行**，只把提示打进输入行（`send` 不带 `\r`）。这些是自然语言，改一改
 * 往往更贴合当下想问的；直接执行会让它退化成四个功能按钮，而这个产品的方向恰恰
 * 是用自然语言代替按钮。
 *
 * 点一条只收一条，不是整排收掉 —— 理由见 terminal-suggestions.ts 里那段。
 */
export function TerminalSuggestions({
  session,
  focusTerminal,
}: {
  session: { send(data: string): void };
  focusTerminal: () => void;
}) {
  const [dismissed, setDismissed] = useState(readDismissedSuggestions);
  const hide = useCallback((next: ReadonlySet<string>) => {
    writeDismissedSuggestions(next);
    setDismissed(next);
  }, []);
  const visible = visibleSuggestions(dismissed);
  if (visible.length === 0) return null;
  return (
    <div className="reader-terminal-suggestions" aria-label="可以让 fx 做的事">
      <span className="reader-terminal-suggestions-lead">试试</span>
      {visible.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          className="reader-terminal-suggestion"
          title={suggestion.prompt}
          onClick={() => {
            session.send(suggestion.prompt);
            focusTerminal();
            // 只收这一条。以前这里收全部 —— 点了「画概念图」，另外四条能力
            // 用户就再也看不到了，而这排 chip 是它们唯一的说明书。
            hide(dismissSuggestion(dismissed, suggestion.id));
          }}
        >
          {suggestion.label}
        </button>
      ))}
      <button
        type="button"
        className="reader-terminal-suggestions-close"
        aria-label="不再显示这些提示"
        title="不再显示"
        onClick={() => hide(dismissAllSuggestions())}
      >
        ×
      </button>
    </div>
  );
}

/** agent 在 board/ 里写了什么能看的东西 —— 列在终端上方，点了在左边打开。
 *
 * # 为什么入口在这儿
 *
 * 这些文件是 agent 写的，而 agent 就在这个面板里。产物出现在产出它的地方，
 * 不用在 dock 上再开一扇门 —— 阅读页收成一扇 AI 的门就是为了不再有第二扇。
 *
 * # 为什么轮询
 *
 * agent 是在你看着的时候写文件的。一次性加载会让「它说画好了，我却要刷新页面
 * 才看得见」重演（画布那次就是这个 bug）。只在面板开着时轮询。
 *
 * # 只列 HTML
 *
 * 别的类型（图片 / PDF / markdown）后端认得、也下发得了，但前端没有渲染器。
 * 列一个点了打不开的东西比不列更糟。
 */
export function TerminalBoardStrip({
  jobId,
  baseUrl,
  apiKey,
  open,
  onOpen,
}: {
  jobId: string;
  baseUrl: string;
  apiKey: string;
  open: boolean;
  onOpen: (name: string) => void;
}) {
  const [items, setItems] = useState<BoardListing[]>([]);

  useEffect(() => {
    if (!open || !jobId) return undefined;
    let alive = true;
    const abort = new AbortController();
    const poll = async () => {
      try {
        const response = await fetch(
          `${baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/board`,
          { headers: { "X-API-Key": apiKey }, signal: abort.signal },
        );
        if (!response.ok) return;
        const parsed = parseBoardListing(await response.json());
        // 取不到就保持原样，不清空：网络抖一下不该让列表闪没。
        if (alive && parsed) setItems(openableBoardItems(parsed));
      } catch {
        // 叠加信息，挂了不该让终端报错。
      }
    };
    void poll();
    // 页面在后台时不问：画板列表只有看着的时候才有用。
    const timer = setInterval(() => {
      if (!isPageHidden()) void poll();
    }, 4000);
    return () => {
      alive = false;
      abort.abort();
      clearInterval(timer);
    };
  }, [apiKey, baseUrl, jobId, open]);

  if (items.length === 0) return null;
  return (
    <div className="reader-terminal-board" aria-label="agent 产物">
      {items.map((item) => (
        <button
          key={item.name}
          type="button"
          className="reader-terminal-board-item"
          title={`在左边打开 ${item.name}`}
          onClick={() => onOpen(item.name)}
        >
          <LayoutDashboard size={13} strokeWidth={2.2} aria-hidden />
          <span>{item.name}</span>
        </button>
      ))}
    </div>
  );
}
