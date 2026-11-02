// 放在笔记（Studio）里时的这一页：地址带 ?embed=studio、有父窗口。三页（主页、详情、阅读）启动时都走一遍（shell-boot）。
//
// - <html data-embed="studio">：样式据此藏起品牌这些和 Studio 重复的东西；
// - 握手：只认 window.parent 发来、origin 是本机回环地址的消息。收到 hello 记下 origin 和 Studio 认哪些消息（hello.features）、
//   按亮暗换颜色、回 ready；之后发的消息都以这个 origin 为 targetOrigin，不用 '*'；
// - theme：跟着 Studio 换亮暗（不写本机存的设置）；navigate：整页打开阅读页（带着 embed）；
// - quote：阅读页悬停框「摘到笔记」经这里发出去；
// - open-notes / close-notes / notes：阅读页「笔记」按钮让 Studio 在旁边开、收这本书的笔记，Studio 回 notes 说现在开着没有；
// - reading：眼下读到哪（哪本书、第几页），给 Studio 的 AI 回答「这一页」用。握手后发一次（不在阅读页就是全 null 的那条），
//   阅读页翻页停下来再发（防抖 READING_DEBOUNCE_MS）；
// - ask-ai：Studio 认它（它有自己的 AI）时，阅读页的「AI」不开自己的终端，先把读到哪立刻发出去，再发 ask-ai 让 Studio 打开它的 AI。
//   阅读器包的这几样由 studioReaderAdapters 交过去（app/reader/adapters/retainpdf.ts）。
//
// 方案和安全要求：docs/ops/planning/studio-workbench/ 的「书和笔记接在一起」「阅读页唤出笔记」；格式：platform/studio-bridge/protocol.ts。

import {
  STUDIO_EMBED,
  askAiMessage,
  closeNotesMessage,
  isLoopbackOrigin,
  openNotesMessage,
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
  getThemeDefinition,
  showTheme,
  type ThemeId,
} from "@/ui/theme/theme.js";

/** 这一版处理的消息，回 ready 时报给 Studio。 */
export const STUDIO_FEATURES: readonly StudioFeature[] = ["theme", "navigate", "quote", "notes", "reading"];

/** 翻页停下来多久才告诉 Studio 读到哪：滚过去的那些页不发。 */
export const READING_DEBOUNCE_MS = 600;

const DARK_THEME_ID: ThemeId = "night";

/** Studio 的亮暗落到我们的主题：本机存的主题亮暗对得上就用它，对不上用默认亮色 / 夜间。 */
export function themeForStudio(theme: StudioTheme, stored: ThemeId = getStoredTheme()): ThemeId {
  const dark = getThemeDefinition(stored)?.group === "dark";
  if (theme === "dark") return dark ? stored : DARK_THEME_ID;
  return dark ? DEFAULT_THEME_ID : stored;
}

export type StudioNotesState = { open: boolean; title: string | null };

export type StudioEmbed = {
  /** 握过手（收到过 hello）没有。 */
  ready: () => boolean;
  /** Studio 认不认这条我们发的消息：hello 没带 features 的早先 Studio 只认 quote。没握手是 false。 */
  supports: (feature: StudioSideFeature) => boolean;
  /** 发一条 quote；没握手或 Studio 不认返回 false。 */
  sendQuote: (quote: StudioQuote) => boolean;
  /** Studio 说的旁边笔记开着没有（notes 消息）。 */
  notes: () => StudioNotesState;
  /** 笔记收着就发 open-notes，开着就发 close-notes；开没开等 Studio 回 notes 再变。 */
  toggleNotes: (book: StudioBook) => boolean;
  /** 眼下读到哪（null：不在阅读页）。握过手就（防抖后）发 reading，没握手先记着，握手时发。 */
  setReading: (reading: StudioReading) => void;
  /** 阅读页的「AI」：Studio 认 ask-ai 就先把眼下读到哪立刻发出去（不等防抖），再发 ask-ai；不认返回 false。 */
  askAi: () => boolean;
  /** 握手、notes 变了时通知。 */
  subscribe: (listener: () => void) => () => void;
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
    listeners: Array<() => void>;
    reading: StudioReading;
    /** 上一次发出去的 reading（JSON），一样的不再发。 */
    toldReading: string;
    readingTimer: ReturnType<typeof setTimeout> | null;
  } = { origin: "", features: null, theme: null, notes: { open: false, title: null }, listeners: [], reading: null, toldReading: "", readingTimer: null };

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
    const url = buildReaderUrl(message.jobId, { pageIdx: message.pageIdx, blockId: message.blockId });
    if (url) navigate(url);
  }

  // 阅读页自己的 bootTheme 可能晚于握手才跑，会把本机存的主题盖回来：Studio 定了亮暗以后，别的地方换主题就再换回去。
  function onThemeChange(event: Event) {
    const theme = (event as CustomEvent<{ theme?: string }>).detail?.theme;
    if (state.theme && theme !== state.theme) showTheme(state.theme);
  }

  win.addEventListener("message", onMessage);
  win.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
  return {
    ready: () => Boolean(state.origin),
    supports,
    sendQuote: (quote) => supports("quote") && post(quoteMessage(quote)),
    notes: () => state.notes,
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
    stop() {
      if (state.readingTimer) clearTimeout(state.readingTimer);
      win.removeEventListener("message", onMessage);
      win.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
      state.listeners = [];
    },
  };
}

type ReaderNotesQuoteInput = { itemId: string; pageIdx: number; sourceText: string; translatedText: string | null };
export type StudioNotesPanelState = { available: boolean; open: boolean; title: string | null };

/** 交给阅读器包的四样（ReaderAdapters 的 notesQuote、notesPanel、hostAi、readingPosition）：前两样握过手、Studio 认、知道是哪个任务才有；
 *  hostAi 握过手、Studio 认 ask-ai 才能用（阅读页的「AI」打开 Studio 的 AI）；readingPosition 一直在（阅读器翻页就报，没握手先记着）。
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
