/** 阅读页里的 fx 终端面板 —— 宿主提供给 @retainpdf/reader 的槽位实现。
 *
 * 放在宿主而不是包里，是因为 xterm 和终端端点都是 RetainPDF 应用特有的东西；
 * 包只决定这块 UI 在 dock 里的位置和生命周期。
 *
 * 端点解析不到（apiBase 或 xApiKey 没配）时返回 null —— dock 里就不会出现
 * 终端那个 tab。点了没反应的 tab 比没有这个功能更糟。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReaderTerminalSlotProps } from "@retainpdf/reader/adapters";

import { FxTerminal, websocketTerminalSession } from "@/features/fx-terminal/index.js";
import type { TerminalSession } from "@/features/fx-terminal/index.js";
import { apiBase, frontendApiKey } from "@/platform/config/runtime.js";

import { sessionKeyForScope } from "../domain/terminal-scope.js";
import {
  activateTab,
  addTab,
  closeTab,
  loadTerminalTabs,
  nextTabSeed,
  saveTerminalTabs,
  setTabScope,
  type TerminalTab,
} from "../domain/terminal-tabs.js";

import {
  TerminalBoardStrip,
  TerminalScopeBar,
  TerminalSuggestions,
  TerminalTabBar,
} from "./terminal-chrome.js";

/** 这本书还没有任务时，这扇门里该说什么。
 *
 * **不是返回 null**：终端是阅读页**唯一**的 AI 入口，悄悄把它藏掉等于让人以为
 * AI 坏了。也不是照常打开 —— agent 的工作区是 `data/jobs/<job>/ai`，没有任务
 * 就没有工作区：fx 侧会退回私有目录，`books/` 是空的且不报错，写进 `board/`
 * 的东西也没有任何呈现路径。开着的空壳比一句说明糟得多。
 *
 * 链接只到书架：`detail.html` 硬要 job_id（它自己的提示就是「缺少 job_id」），
 * 主页也没有「按 document_id 直开某本书详情」的 URL 入口 —— 给一个会落空的
 * 链接比不给链接更糟。
 */
function ReaderTerminalNeedsJob() {
  return (
    <div className="reader-terminal-panel" data-terminal-state="needs-job">
      <div className="reader-terminal-needs-job">
        <h3>这本书还没处理过</h3>
        <p>
          AI 要在这本书的产物上干活 —— OCR 结果、译文、版面数据。
          现在还没有，所以它没有可读的东西。
        </p>
        <p>
          回书架打开这本书，先做 <strong>OCR</strong> 或 <strong>翻译</strong>，
          之后这里就能用了。
        </p>
        <a className="reader-terminal-needs-job-link" href="./index.html">
          回到书架
        </a>
      </div>
    </div>
  );
}

export function renderReaderTerminal(props: ReaderTerminalSlotProps) {
  // 浏览器只认 Rust API 这一个地址和一把凭据 —— AI 服务(41100)只监听回环，
  // 前端从不直连它，/ai/ask 也是经 Rust 转发的。终端走同样的路。
  const base = apiBase();
  const apiKey = frontendApiKey();
  if (!base || !apiKey) return null;
  // sessionKey 现在只认 jobId（见 ReaderAppReactPdf 里那段注释），空的就是
  // 「这本书还没有任务」。
  if (!props.sessionKey) return <ReaderTerminalNeedsJob />;
  return (
    <ReaderTerminalPanel
      key={props.sessionKey}
      {...props}
      baseUrl={base}
      apiKey={apiKey}
    />
  );
}

type PanelProps = ReaderTerminalSlotProps & {
  baseUrl: string;
  apiKey: string;
};

function ReaderTerminalPanel({ open, sessionKey, pendingInput, onOpenBoard, baseUrl, apiKey }: PanelProps) {
  // 可以同时开几条。后端一直支持并行（busy_session_ids 会让第二条挑一个没被
  // 占用的 fx 会话），卡点一直在这里 —— 只有一个 <FxTerminal>。
  // 摆好的工作台要活过刷新：开了几条、每条盯着哪个作用域，都从上次读回来。
  // 存的不是 fx 会话 id —— 哪条对话被续上由后端挑，见 loadTerminalTabs。
  const [tabs, setTabs] = useState(() => loadTerminalTabs(sessionKey));
  useEffect(() => {
    saveTerminalTabs(sessionKey, tabs);
  }, [sessionKey, tabs]);
  // 计数器从恢复出来的最大序号往后走，不是从 1 —— 从 1 开会和 `t2` 撞 id，
  // React key 撞车的表现是两条终端共用一个 DOM 节点。
  const nextIdRef = useRef(nextTabSeed(tabs));
  const nextId = useCallback(() => `t${(nextIdRef.current += 1)}`, []);
  const activeTab = tabs.tabs.find((tab) => tab.id === tabs.activeId) ?? tabs.tabs[0];
  // 提示 chip 和作用域条作用在**当前这条**上。
  const terminalRefs = useRef(new Map<string, { focus(): void }>());
  const focusActive = useCallback(
    () => terminalRefs.current.get(tabs.activeId)?.focus(),
    [tabs.activeId],
  );
  // 每条终端的 session 由**面板**持有，不由 TerminalInstance 自己 useMemo。
  //
  // 原来是「空函数占位 + onReady 时替换」，两个后果：
  //
  // 1. **第一次点「问 AI」必然静默丢失**。askSelectedRegion 同一次渲染里设了
  //    pendingInput 又把面板切过来，注入 effect 立刻跑；而 onReady 要等 xterm
  //    的动态 import（~500KB）落地才执行，那时 sendToActive 还是空函数。
  //    更糟的是 sentTokenRef 已经先记上了，同一个 token 不会重试。
  // 2. **切/关标签后字进了别条终端**。onReady 只在挂载时触发一次，而
  //    activateTab 只改 state 不重挂载，所以 sendToActive 永远指着「最后一次
  //    挂载时恰好是当前」的那条。focusActive 是按 activeId 查的，于是光标在你
  //    看的那条里闪、字去了另一条 —— 最难自查的形态。
  //
  // 现在按 activeId 现查现用。握手期不怕：websocket-session 自己会把输入攒进
  // pendingInput，socket 一开就冲出去（见 websocket-session.ts 的 pendingInput）。
  const sessionsRef = useRef(new Map<string, { key: string; session: TerminalSession }>());
  const sessionFor = useCallback((tab: TerminalTab): TerminalSession => {
    const key = sessionKeyForScope(tab.scope);
    const cached = sessionsRef.current.get(tab.id);
    // 作用域换了就得换 session（连的是另一个 fx 会话）。
    if (cached && cached.key === key) return cached.session;
    const session = websocketTerminalSession({ baseUrl, apiKey, session: key });
    sessionsRef.current.set(tab.id, { key, session });
    return session;
  }, [apiKey, baseUrl]);
  const sendToActive = useCallback((data: string) => {
    const tab = tabs.tabs.find((item) => item.id === tabs.activeId) ?? tabs.tabs[0];
    if (!tab) return;
    sessionFor(tab).send(data);
  }, [sessionFor, tabs.activeId, tabs.tabs]);

  // 「从选区问 AI」把选中的那段送进当前这条终端。
  //
  // 三件事是刻意的：
  // - **不回车**。由页面选区拼出来的一条命令直接开跑太意外，得让人先看见。
  // - **认 token 不认文本**。连着两次选同一段，两次都该送；拿文本判重第二次
  //   会被吞掉，而且看不出为什么。
  // - **面板没开时不送**。包那边在设 pendingInput 的同时会把面板切过来，这里
  //   等它开；没开时送等于丢进一条用户没在看的终端。
  const sentTokenRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open || !pendingInput || !pendingInput.text) return;
    if (sentTokenRef.current === pendingInput.token) return;
    sentTokenRef.current = pendingInput.token;
    sendToActive(pendingInput.text);
    focusActive();
  }, [focusActive, open, pendingInput, sendToActive]);

  const themeId = useThemeId();
  return (
    <div
      className="reader-terminal-panel"
      // 终端固定走 night 这个**已有**皮肤，不跟随文档主题。
      //
      // 不是偷懒：fx 的 TUI 用 256 色灰阶输出（38;5;245 这类），整套配色是
      // 按深色背景挑的。给它浅色底 = 浅灰字压浅灰底，几乎看不清 —— 实测就是
      // 这样。终端是一块独立表面，编辑器里的内置终端也都这么处理。
      data-theme="night"
      // 关掉时用 hidden 而不是卸载：卸载会关 WebSocket，进而杀掉 PTY 子进程，
      // 用户切个 tab 回来 fx 的会话就没了。
      hidden={!open}
      aria-label="fx 终端"
    >
      <TerminalTabBar
        tabs={tabs.tabs}
        activeId={tabs.activeId}
        onActivate={(id) => setTabs((state) => activateTab(state, id))}
        onAdd={() => setTabs((state) => addTab(state, nextId))}
        onClose={(id) => {
          terminalRefs.current.delete(id);
          // session 也要丢掉。实例卸载时 FxTerminal 的 effect 清理会断开
          // WebSocket，但这张表不清就会一直攒着已经断开的 session 对象。
          sessionsRef.current.delete(id);
          setTabs((state) => closeTab(state, id));
        }}
      />
      <TerminalScopeBar
        tabId={activeTab.id}
        scope={activeTab.scope}
        jobId={sessionKey}
        onChange={(tabId, scope) => setTabs((state) => setTabScope(state, tabId, scope))}
      />
      <TerminalBoardStrip
        jobId={sessionKey}
        open={open}
        onOpen={onOpenBoard}
      />
      <TerminalSuggestions
        session={{ send: sendToActive }}
        focusTerminal={focusActive}
      />
      {tabs.tabs.map((tab) => (
        <TerminalInstance
          key={tab.id}
          tab={tab}
          active={tab.id === tabs.activeId}
          themeId={themeId}
          session={sessionFor(tab)}
          onReady={(handle) => terminalRefs.current.set(tab.id, handle)}
        />
      ))}
    </div>
  );
}

/** 一条终端。
 *
 * **非当前的也留在树上,只是挪到屏幕外** —— 卸载会关 WebSocket、杀掉 PTY,
 * 切回来 fx 那段对话就没了。而且不能用 `display:none`:xterm 自己量容器尺寸,
 * 量到 0 会把终端算成 1 行,切回来是一团乱码（这个坑踩过）。
 */
function TerminalInstance({
  tab,
  active,
  session,
  themeId,
  onReady,
}: {
  tab: TerminalTab;
  active: boolean;
  /** session 由面板持有并按 tab 缓存 —— 这里不能自己造，否则「按 activeId
   * 现查现用」拿到的会是另一个对象。 */
  session: TerminalSession;
  themeId: string;
  onReady: (handle: { focus(): void }) => void;
}) {
  const handleReady = useCallback(
    (handle: { focus(): void }) => onReady(handle),
    [onReady],
  );
  return (
    <div
      className="reader-terminal-instance"
      data-hidden={!active ? "" : undefined}
      inert={!active ? true : undefined}
      aria-hidden={!active ? true : undefined}
    >
      <FxTerminal
        session={session}
        themeId={themeId}
        className="reader-terminal-surface"
        onReady={handleReady}
      />
    </div>
  );
}

/** 当前皮肤 id。xterm 的配色是构造时快照，换肤靠这个值变化来触发重设。 */
function useThemeId(): string {
  const [themeId, setThemeId] = useState(readThemeId);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setThemeId(readThemeId()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return themeId;
}

function readThemeId(): string {
  if (typeof document === "undefined") return "";
  return document.documentElement.getAttribute("data-theme") || "";
}
