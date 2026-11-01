// 放在笔记（Studio）里时的这一页：地址带 ?embed=studio、有父窗口。三页（主页、详情、阅读）启动时都走一遍（shell-boot）。
//
// - <html data-embed="studio">：样式据此藏起品牌这些和 Studio 重复的东西；
// - 握手：只认 window.parent 发来、origin 是本机回环地址的消息。收到 hello 记下 origin、按亮暗换颜色、回 ready；
//   之后发的消息都以这个 origin 为 targetOrigin，不用 '*'；
// - theme：跟着 Studio 换亮暗（不写本机存的设置）；navigate：整页打开阅读页（带着 embed）；
// - quote：阅读页悬停框「摘到笔记」经这里发出去（app/reader/adapters 把 send 交给阅读器包）。
//
// 方案和安全要求：docs/ops/planning/studio-workbench/20261101-书和笔记接在一起.md；格式：platform/studio-bridge/protocol.ts。

import {
  STUDIO_EMBED,
  isLoopbackOrigin,
  parseStudioMessage,
  quoteMessage,
  readyMessage,
  type StudioFeature,
  type StudioQuote,
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
export const STUDIO_FEATURES: readonly StudioFeature[] = ["theme", "navigate", "quote"];

const DARK_THEME_ID: ThemeId = "night";

/** Studio 的亮暗落到我们的主题：本机存的主题亮暗对得上就用它，对不上用默认亮色 / 夜间。 */
export function themeForStudio(theme: StudioTheme, stored: ThemeId = getStoredTheme()): ThemeId {
  const dark = getThemeDefinition(stored)?.group === "dark";
  if (theme === "dark") return dark ? stored : DARK_THEME_ID;
  return dark ? DEFAULT_THEME_ID : stored;
}

export type StudioEmbed = {
  /** 握过手（收到过 hello）没有。 */
  ready: () => boolean;
  /** 发一条 quote；没握手返回 false。 */
  sendQuote: (quote: StudioQuote) => boolean;
  stop: () => void;
};

/** 不在 Studio 里（没有 ?embed=studio，或者没有父窗口）返回 null，什么都不做。 */
export function startStudioEmbed(
  win: Window,
  { navigate = navigateTo }: { navigate?: (url: string) => void } = {},
): StudioEmbed | null {
  if (embeddedIn(win.location.search) !== STUDIO_EMBED || win.parent === win) return null;
  win.document.documentElement.dataset.embed = STUDIO_EMBED;
  const state: { origin: string; theme: ThemeId | null } = { origin: "", theme: null };

  const applyTheme = (theme: StudioTheme) => {
    state.theme = themeForStudio(theme);
    showTheme(state.theme);
  };

  function onMessage(event: MessageEvent) {
    if (event.source !== win.parent || !isLoopbackOrigin(event.origin)) return;
    const message = parseStudioMessage(event.data);
    if (!message) return;
    if (message.type === "hello") {
      state.origin = event.origin;
      applyTheme(message.theme);
      win.parent.postMessage(readyMessage(STUDIO_FEATURES), state.origin);
      return;
    }
    // 握手之后才认别的，且只认握手的那个 origin。
    if (!state.origin || event.origin !== state.origin) return;
    if (message.type === "theme") {
      applyTheme(message.theme);
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
    sendQuote(quote) {
      if (!state.origin) return false;
      try {
        win.parent.postMessage(quoteMessage(quote), state.origin);
        return true;
      } catch {
        return false;
      }
    },
    stop() {
      win.removeEventListener("message", onMessage);
      win.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
    },
  };
}

/** 交给阅读器包的「摘到笔记」（ReaderAdapters.notesQuote）：握过手、知道是哪个任务才能摘。
 *  任务从阅读页地址来；书的编号和书名按任务查一次（查不到就写 null，Studio 照样能存）。 */
export function studioNotesQuote(
  embed: StudioEmbed,
  jobId: string,
  lookupDocument: (jobId: string) => Promise<{ document_id?: string | null; title?: string | null } | null>,
) {
  const book: { documentId: string | null; title: string | null } = { documentId: null, title: null };
  if (jobId) {
    lookupDocument(jobId)
      .then((record) => {
        book.documentId = `${record?.document_id || ""}`.trim() || null;
        book.title = `${record?.title || ""}`.trim() || null;
      })
      .catch(() => {});
  }
  return {
    available: () => embed.ready() && Boolean(jobId),
    send: (quote: { itemId: string; pageIdx: number; sourceText: string; translatedText: string | null }) =>
      embed.sendQuote({ jobId, ...book, ...quote }),
  };
}

/** 这一页的嵌入状态（shell-boot 引入时启动一次）。 */
export const studioEmbed: StudioEmbed | null = typeof window === "undefined" ? null : startStudioEmbed(window);
