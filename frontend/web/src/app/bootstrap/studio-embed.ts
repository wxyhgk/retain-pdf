// 放在笔记（Studio）里时的这一页：地址带 ?embed=studio、有父窗口。三页（主页、详情、阅读）启动时都走一遍（shell-boot）。
//
// - <html data-embed="studio">：样式据此藏起品牌这些和 Studio 重复的东西；
// - 握手：只认 window.parent 发来、origin 是本机回环地址的消息。收到 hello 记下 origin 和 Studio 认哪些消息（hello.features）、
//   按亮暗换颜色、回 ready；之后发的消息都以这个 origin 为 targetOrigin，不用 '*'；
// - theme：跟着 Studio 换亮暗（不写本机存的设置）；navigate：阅读页开着的就是这本书，原地翻过去（PDF 不重新加载），
//   否则（别的书、不在阅读页、还在加载）整页打开阅读页（带着 embed）；
// - quote：阅读页悬停框「摘到笔记」经这里发出去；
// - open-notes / close-notes / notes：阅读页「笔记」按钮让 Studio 在旁边开、收这本书的笔记，Studio 回 notes 说现在开着没有；
// - reading：眼下读到哪（哪本书、第几页），给 Studio 的 AI 回答「这一页」用。握手后发一次（不在阅读页就是全 null 的那条），
//   阅读页翻页停下来再发（防抖 READING_DEBOUNCE_MS）；
// - ask-ai：Studio 认它（它有自己的 AI）时，阅读页的「AI」不开自己的终端，先把读到哪立刻发出去，再发 ask-ai 让 Studio 打开它的 AI。
// - open-book：Studio 认它（书库那一页）时，书库里点书要读（卡片的阅读、详情里的对照阅读……都走 ReaderNavigation）不自己开
//   阅读页，交给 Studio 在正在写的笔记旁边打开（以笔记为根）；只读原文、还没有任务的书照旧自己开。
// - shortcut：Studio 认它时，这一页有焦点时按的 ⌘/Ctrl + K、S、J、\（Studio 的搜索、保存、问 AI、收侧栏）转给 Studio，
//   不让浏览器自己处理（⌘S 不弹「存网页」）；阅读页自己的键（翻页、缩放）都不带 ⌘/Ctrl，不冲突。
//   阅读器包的这几样由 studioReaderAdapters 交过去（app/reader/adapters/retainpdf.ts）。
//
// 方案和安全要求：docs/ops/planning/studio-workbench/ 的「书和笔记接在一起」「阅读页唤出笔记」；格式：platform/studio-bridge/protocol.ts。

import {
  STUDIO_EMBED,
  askAiMessage,
  closeNotesMessage,
  isLoopbackOrigin,
  openBookMessage,
  openNotesMessage,
  shortcutMessage,
  parseStudioMessage,
  quoteMessage,
  readingMessage,
  readyMessage,
  type StudioBook,
  type StudioFeature,
  type StudioQuote,
  type StudioReading,
  type StudioSideFeature,
  type StudioTheme,
} from "@/platform/studio-bridge/protocol.js";
import { buildReaderUrl, navigateTo } from "@/platform/navigation/pages.js";
import { embeddedIn } from "@/platform/navigation/soft-reader.js";
import {
  DEFAULT_THEME_ID,
  THEME_CHANGE_EVENT,
  getStoredTheme,
  showTheme,
  type ThemeId,
} from "@/ui/theme/theme.js";

/** 这一版处理的消息，回 ready 时报给 Studio。 */
export const STUDIO_FEATURES: readonly StudioFeature[] = ["theme", "navigate", "quote", "notes", "reading", "quoted"];

/** 转给 Studio 的快捷键（和 ⌘ 或 Ctrl 一起按）：它的搜索、保存、问 AI、收起侧栏。 */
export const STUDIO_SHORTCUT_KEYS: readonly string[] = ["k", "s", "j", "\\"];

/** 翻页停下来多久才告诉 Studio 读到哪：滚过去的那些页不发。 */
export const READING_DEBOUNCE_MS = 600;

const DARK_THEME_ID: ThemeId = "night";

/**
 * Studio 的亮暗落到我们的主题：放在 Studio 里就是 Studio 的一部分，只用黑白灰那两套（默认亮色 / 夜间，夜间的颜色再按 Studio 的
 * 中性灰覆盖，themes/studio-embed.css），本机存的彩色皮肤不带进来（读书走查 13）。`stored` 留着参数，不再看它。
 */
export function themeForStudio(theme: StudioTheme, _stored: ThemeId = getStoredTheme()): ThemeId {
  return theme === "dark" ? DARK_THEME_ID : DEFAULT_THEME_ID;
}

export type StudioNotesState = { open: boolean; title: string | null };
/** Studio 说的这本书摘过的段落（quoted 消息）；还没说是 null。 */
export type StudioQuoted = { jobId: string; documentId: string | null; itemIds: readonly string[] } | null;
export type StudioNavigateTarget = { jobId: string; pageIdx: number | null; blockId: string };

export type StudioEmbed = {
  /** 握过手（收到过 hello）没有。 */
  ready: () => boolean;
  /** Studio 认不认这条我们发的消息：hello 没带 features 的早先 Studio 只认 quote。没握手是 false。 */
  supports: (feature: StudioSideFeature) => boolean;
  /** 发一条 quote；没握手或 Studio 不认返回 false。 */
  sendQuote: (quote: StudioQuote) => boolean;
  /** 书库里点书要读：Studio 认 open-book 就交给它（返回 true，我们不开阅读页）；不认返回 false。 */
  openBook: (book: StudioBook, pageIdx?: number | null) => boolean;
  /** Studio 说的旁边笔记开着没有（notes 消息）。 */
  notes: () => StudioNotesState;
  /** Studio 说的这本书摘过的段落（quoted 消息，每条换一个新对象）。 */
  quoted: () => StudioQuoted;
  /** 笔记收着就发 open-notes，开着就发 close-notes；开没开等 Studio 回 notes 再变。 */
  toggleNotes: (book: StudioBook) => boolean;
  /** 眼下读到哪（null：不在阅读页）。握过手就（防抖后）发 reading，没握手先记着，握手时发。 */
  setReading: (reading: StudioReading) => void;
  /** 阅读页的「AI」：Studio 认 ask-ai 就先把眼下读到哪立刻发出去（不等防抖），再发 ask-ai；不认返回 false。 */
  askAi: () => boolean;
  /** 握手、notes 变了时通知。 */
  subscribe: (listener: () => void) => () => void;
  /** navigate 先问这里登记的（开着的阅读页）：有一个返回 true 就是原地翻过去了，都不接才整页打开。 */
  onNavigate: (handler: (target: StudioNavigateTarget) => boolean) => () => void;
  stop: () => void;
};

/** 不在 Studio 里（没有 ?embed=studio，或者没有父窗口）返回 null，什么都不做。 */
export function startStudioEmbed(
  win: Window,
  { navigate = navigateTo, debounceMs = READING_DEBOUNCE_MS }: { navigate?: (url: string) => void; debounceMs?: number } = {},
): StudioEmbed | null {
  if (embeddedIn(win.location.search) !== STUDIO_EMBED || win.parent === win) return null;
  win.document.documentElement.dataset.embed = STUDIO_EMBED;
  const state: {
    origin: string;
    features: StudioSideFeature[] | null;
    theme: ThemeId | null;
    notes: StudioNotesState;
    quoted: StudioQuoted;
    listeners: Array<() => void>;
    navigators: Array<(target: StudioNavigateTarget) => boolean>;
    reading: StudioReading;
    /** 上一次发出去的 reading（JSON），一样的不再发。 */
    toldReading: string;
    readingTimer: ReturnType<typeof setTimeout> | null;
  } = { origin: "", features: null, theme: null, notes: { open: false, title: null }, quoted: null, listeners: [], navigators: [], reading: null, toldReading: "", readingTimer: null };

  const emit = () => state.listeners.forEach((listener) => listener());
  const applyTheme = (theme: StudioTheme) => {
    state.theme = themeForStudio(theme);
    showTheme(state.theme);
  };
  const post = (message: object) => {
    if (!state.origin) return false;
    try {
      win.parent.postMessage(message, state.origin);
      return true;
    } catch {
      return false;
    }
  };
  const tellReading = () => {
    if (state.readingTimer) clearTimeout(state.readingTimer);
    state.readingTimer = null;
    const message = readingMessage(state.reading);
    const said = JSON.stringify(message);
    if (said !== state.toldReading && post(message)) state.toldReading = said;
  };
  const supports = (feature: StudioSideFeature) =>
    Boolean(state.origin) && (state.features ? state.features.includes(feature) : feature === "quote");

  function onMessage(event: MessageEvent) {
    if (event.source !== win.parent || !isLoopbackOrigin(event.origin)) return;
    const message = parseStudioMessage(event.data);
    if (!message) return;
    if (message.type === "hello") {
      state.origin = event.origin;
      state.features = message.features;
      applyTheme(message.theme);
      post(readyMessage(STUDIO_FEATURES));
      // 每次握手（Studio 重新加载过这一页也算）都说一遍读到哪。
      state.toldReading = "";
      tellReading();
      emit();
      return;
    }
    // 握手之后才认别的，且只认握手的那个 origin。
    if (!state.origin || event.origin !== state.origin) return;
    if (message.type === "theme") {
      applyTheme(message.theme);
      return;
    }
    if (message.type === "notes") {
      state.notes = { open: message.open, title: message.open ? message.title : null };
      emit();
      return;
    }
    if (message.type === "quoted") {
      state.quoted = { jobId: message.jobId, documentId: message.documentId, itemIds: message.itemIds };
      emit();
      return;
    }
    const target = { jobId: message.jobId, pageIdx: message.pageIdx, blockId: message.blockId };
    if (state.navigators.some((handler) => handler(target))) return;
    const url = buildReaderUrl(message.jobId, { pageIdx: message.pageIdx, blockId: message.blockId });
    if (url) navigate(url);
  }

  // 阅读页自己的 bootTheme 可能晚于握手才跑，会把本机存的主题盖回来：Studio 定了亮暗以后，别的地方换主题就再换回去。
  function onThemeChange(event: Event) {
    const theme = (event as CustomEvent<{ theme?: string }>).detail?.theme;
    if (state.theme && theme !== state.theme) showTheme(state.theme);
  }

  // 这一页有焦点时按的 Studio 快捷键：Studio 认 shortcut 就交给它。
  function onKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || !(event.metaKey || event.ctrlKey)) return;
    if (!STUDIO_SHORTCUT_KEYS.includes(`${event.key || ""}`.toLowerCase()) || !supports("shortcut")) return;
    event.preventDefault();
    post(shortcutMessage({ key: event.key, meta: event.metaKey, ctrl: event.ctrlKey, shift: event.shiftKey, alt: event.altKey }));
  }

  win.addEventListener("message", onMessage);
  win.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
  win.document.addEventListener("keydown", onKeyDown);
  return {
    ready: () => Boolean(state.origin),
    supports,
    sendQuote: (quote) => supports("quote") && post(quoteMessage(quote)),
    openBook: (book, pageIdx = null) => Boolean(book.jobId) && supports("open-book") && post(openBookMessage(book, pageIdx)),
    notes: () => state.notes,
    quoted: () => state.quoted,
    setReading(reading) {
      state.reading = reading;
      if (!state.origin) return;
      if (state.readingTimer) clearTimeout(state.readingTimer);
      state.readingTimer = setTimeout(tellReading, debounceMs);
    },
    askAi() {
      if (!supports("ask-ai")) return false;
      tellReading();
      return post(askAiMessage());
    },
    toggleNotes: (book) => supports("open-notes") && post(state.notes.open ? closeNotesMessage() : openNotesMessage(book)),
    subscribe(listener) {
      state.listeners.push(listener);
      return () => {
        state.listeners = state.listeners.filter((item) => item !== listener);
      };
    },
    onNavigate(handler) {
      state.navigators.push(handler);
      return () => {
        state.navigators = state.navigators.filter((item) => item !== handler);
      };
    },
    stop() {
      if (state.readingTimer) clearTimeout(state.readingTimer);
      win.removeEventListener("message", onMessage);
      win.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
      win.document.removeEventListener("keydown", onKeyDown);
      state.listeners = [];
      state.navigators = [];
    },
  };
}

type ReaderNotesQuoteInput = { itemId: string; pageIdx: number; sourceText: string; translatedText: string | null };
export type StudioNotesPanelState = { available: boolean; open: boolean; title: string | null };

/** 交给阅读器包的五样（ReaderAdapters 的 notesQuote、notesPanel、hostAi、readingPosition、hostNavigation）：前两样握过手、Studio 认、知道是哪个任务才有；
 *  hostAi 握过手、Studio 认 ask-ai 才能用（阅读页的「AI」打开 Studio 的 AI）；readingPosition 一直在（阅读器翻页就报，没握手先记着）；
 *  hostNavigation 让 Studio 的 navigate 先给阅读器，同一本书原地翻过去。
 *  任务从阅读页地址来；书的编号和书名按任务查一次（查不到就写 null，Studio 照样能用）。 */
export function studioReaderAdapters(
  embed: StudioEmbed,
  jobId: string,
  lookupDocument: (jobId: string) => Promise<{ document_id?: string | null; title?: string | null } | null>,
) {
  const book: StudioBook = { jobId, documentId: null, title: null };
  // 阅读器报来的页（0 起）和页数；书名、书的编号查回来以后用新的再报一次。
  const position: { pageIdx: number | null; pageCount: number | null } = { pageIdx: null, pageCount: null };
  const report = () => embed.setReading(jobId ? { book: { ...book }, ...position } : null);
  if (jobId) {
    lookupDocument(jobId)
      .then((record) => {
        book.documentId = `${record?.document_id || ""}`.trim() || null;
        book.title = `${record?.title || ""}`.trim() || null;
        report();
      })
      .catch(() => {});
  }
  report();
  // useSyncExternalStore 要同一个对象（没变就不换）。
  const panel: { snapshot: StudioNotesPanelState } = { snapshot: { available: false, open: false, title: null } };
  const noQuoted: ReadonlySet<string> = new Set();
  const quotedSeen: { from: StudioQuoted; blocks: ReadonlySet<string> } = { from: null, blocks: noQuoted };
  const refresh = () => {
    const notes = embed.notes();
    const available = Boolean(jobId) && embed.supports("open-notes");
    const { snapshot } = panel;
    if (snapshot.available !== available || snapshot.open !== notes.open || snapshot.title !== notes.title) {
      panel.snapshot = { available, open: notes.open, title: notes.title };
    }
    return panel.snapshot;
  };
  return {
    notesQuote: {
      available: () => Boolean(jobId) && embed.supports("quote"),
      send: (quote: ReaderNotesQuoteInput) => embed.sendQuote({ ...book, ...quote }),
    },
    notesPanel: {
      getState: refresh,
      subscribe: (listener: () => void) => embed.subscribe(listener),
      toggle: () => embed.toggleNotes({ ...book }),
    },
    hostAi: {
      available: () => embed.supports("ask-ai"),
      subscribe: (listener: () => void) => embed.subscribe(listener),
      ask: () => embed.askAi(),
    },
    hostNavigation: {
      subscribe: (listener: (target: StudioNavigateTarget) => boolean) => embed.onNavigate(listener),
    },
    // 摘过的段落：只认说的是这本书的那条（任务一样，或书的编号一样：重新翻译过任务号会变）；同一条消息给同一个集合。
    quotedBlocks: {
      get: () => {
        const said = embed.quoted();
        if (said !== quotedSeen.from) {
          quotedSeen.from = said;
          const mine = Boolean(said && (said.jobId === jobId || (said.documentId && said.documentId === book.documentId)));
          quotedSeen.blocks = mine && said ? new Set(said.itemIds) : noQuoted;
        }
        return quotedSeen.blocks;
      },
      subscribe: (listener: () => void) => embed.subscribe(listener),
    },
    readingPosition: {
      report: (pageIdx: number | null, pageCount: number | null) => {
        position.pageIdx = pageIdx;
        position.pageCount = pageCount;
        report();
      },
    },
  };
}

/** 这一页的嵌入状态（shell-boot 引入时启动一次）。 */
export const studioEmbed: StudioEmbed | null = typeof window === "undefined" ? null : startStudioEmbed(window);
