// 书页上选字（2026-11-28 用户：
//  「对选区 copy 和提问取值做 PDF 断行 / 连字符清洗」
//  「对照模式按下拖选时锁定当前栏（防左右串栏）+ 把 ::selection 颜色从黄色 --warn 换成浅冷色」
//  「在划词右键 / 轻浮条里补齐『复制 + 收藏 + 提问』闭环」
//  「尤其是行内公式的选择显示得做好」「类似这样可以真正的选中公式」）。画在书页区（.reader-stage）里，管这几件事：
// - 复制（⌘C、浮条、右键）拿到的是收拾过的字（selection-text.ts 的 cleanPdfSelectionText）；
// - 按下时记住在哪一栏（根节点 data-select-pane），另一栏的文字层不让选（reader-selection.css），拖过栏缝也不串过去；
// - 选区的头或尾落在行内公式里，松手时撑到整个公式（formulaRunAt）；
// - 选区自己画：每行一条齐整的浅冷色色带（mergeSelectionRects），浏览器按字画的那层在文字层里是透明的，
//   公式里上下标、组合符号不再一截一截、高低不齐；
// - 松手后选区上面一条小浮条：复制 · 收藏 · 提问（提问是提问扩展的右键项里标了 inSelectionBar 的那一项）。
// 以前（11-20 起）书页上选字只留浏览器自己的复制，不弹东西；11-27 起提问窗开着时选字会悄悄带进提问，11-28 去掉了。
import { useCallback, useEffect, useRef, useState, type ReactElement, type Ref } from "react";
import { Check, Copy, MessageCircle, Star } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { ReaderMenuContext, ReaderMenuItem } from "../../extensions/types.js";
import { useReaderFavorites } from "../../hooks/use-reader-favorites.js";
import { READER_PAGE_ATTR, READER_PANE_ATTR, READER_PDF_PANE_CLASS, READER_ROOT_CLASS } from "../../pdf/reader-dom-contract.js";
import { cleanPdfSelectionText, formulaRunAt, mergeSelectionRects, type FormulaToken, type SelectionRect } from "../../shared/content/selection-text.js";
import { addReaderFavorite, findReaderFavorite, readReaderFavorites } from "../../shared/state/reader-favorites.js";

const TEXT_LAYER = ".textLayer";
/** 浮条离选区多远、多高（放不下上面就放下面）。 */
const BAR_GAP = 8;
const BAR_HEIGHT = 34;
/** 书页区顶上浮着的返回、页签占的那一条（chrome.css 的 --reader-float-bar-room）：浮条不往那里放。 */
const TOP_ROOM = 56;

export type ReaderPageSelection = {
  /** 收拾过的字。 */
  text: string;
  page: number;
  pane: "source" | "translated";
  /** 选区开头所在的文字层（给扩展的右键项认是哪一页）。 */
  layer: Element;
};

function elementOf(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === 1 ? (node as Element) : node.parentElement;
}

/** 现在书页文字层里选着的字；没选着、选的不是书页上的字是 null。 */
export function readPageSelection(selection: Selection | null = globalThis.getSelection?.() ?? null): ReaderPageSelection | null {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const layer = elementOf(range.startContainer)?.closest(TEXT_LAYER) ?? elementOf(range.endContainer)?.closest(TEXT_LAYER);
  if (!layer) return null;
  const text = cleanPdfSelectionText(`${selection}`);
  if (!text) return null;
  const slot = layer.closest(`[${READER_PAGE_ATTR}]`);
  return {
    text,
    page: Math.max(1, Number(slot?.getAttribute(READER_PAGE_ATTR)) || 1),
    pane: slot?.getAttribute(READER_PANE_ATTR) === "translated" ? "translated" : "source",
    layer,
  };
}

/** 写剪贴板：先用 clipboard API；不行（局域网 http 打开的页面没有）就让浏览器复制现在的选区，copy 事件里换成收拾过的字。 */
export async function copySelectionText(text: string): Promise<boolean> {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到下面
  }
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

/** 右键时选着书页上的字：菜单最上面的「复制」「收藏这段」（提问扩展的「问这段」跟在后面）。 */
export function selectionMenuItems(scope: string): ReaderMenuItem[] {
  const picked = readPageSelection();
  if (!picked) return [];
  const items: ReaderMenuItem[] = [{ key: "copy", label: "复制", hint: IS_MAC ? "⌘C" : "Ctrl+C", onSelect: () => { void copySelectionText(picked.text); } }];
  if (scope) {
    const saved = findReaderFavorite(readReaderFavorites(scope), picked.text, picked.page);
    items.push({
      key: "favorite",
      label: saved ? "已收藏（在左下角「收藏」里）" : "收藏这段",
      onSelect: () => { addReaderFavorite(scope, picked); },
    });
  }
  return items;
}

// —— 行内公式：选区的头尾撑到整个公式 ——

/** 文字层里一段一段的字（pdf.js 每段一个 span；markedContent 是外面包的一层，不算）。 */
function leafSpans(layer: Element): HTMLElement[] {
  return [...layer.querySelectorAll<HTMLElement>("span")].filter((span) => !span.classList.contains("markedContent") && !span.querySelector("span"));
}

/** 给一串 span 标上第几行：竖直中线离上一段超过半个字高就是新的一行。 */
function lineTokens(spans: readonly HTMLElement[]): FormulaToken[] {
  let line = 0;
  let previous: { center: number; height: number } | null = null;
  return spans.map((span) => {
    const rect = span.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    if (previous && Math.abs(center - previous.center) > Math.max(rect.height, previous.height) / 2) line += 1;
    previous = { center, height: rect.height || previous?.height || 0 };
    return { text: span.textContent || "", line };
  });
}

function textNodesOf(element: Element): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) out.push(node as Text);
  return out;
}

/** 选区一头所在的公式串，撑到的那一头（开头撑到公式第一段的开头，结尾撑到最后一段的末尾）；不在公式里是 null。 */
function formulaEdge(node: Node, side: "start" | "end"): { node: Text; offset: number } | null {
  const element = elementOf(node);
  const layer = element?.closest(TEXT_LAYER);
  const span = element?.closest("span");
  if (!layer || !span) return null;
  const spans = leafSpans(layer);
  const index = spans.indexOf(span as HTMLElement);
  if (index < 0) return null;
  const low = Math.max(0, index - 60);
  const window = spans.slice(low, Math.min(spans.length, index + 61));
  const run = formulaRunAt(lineTokens(window), index - low);
  if (!run) return null;
  const texts = textNodesOf(window[side === "start" ? run[0] : run[1]]);
  if (!texts.length) return null;
  return side === "start" ? { node: texts[0], offset: 0 } : { node: texts[texts.length - 1], offset: texts[texts.length - 1].length };
}

/** 松手时：选区的头或尾在行内公式里，就撑到整个公式。改了返回 true。 */
export function snapSelectionToFormulas(selection: Selection | null): boolean {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  const start = formulaEdge(range.startContainer, "start");
  const end = formulaEdge(range.endContainer, "end");
  if (!start && !end) return false;
  const next = range.cloneRange();
  if (start && range.comparePoint(start.node, start.offset) <= 0) next.setStart(start.node, start.offset);
  if (end && range.comparePoint(end.node, end.offset) >= 0) next.setEnd(end.node, end.offset);
  if (next.compareBoundaryPoints(Range.START_TO_START, range) === 0 && next.compareBoundaryPoints(Range.END_TO_END, range) === 0) return false;
  selection.removeAllRanges();
  selection.addRange(next);
  return true;
}

// —— 自己画选区 ——

/** 选区在书页文字层里的部分，按行收成色带（屏幕坐标）；每个字框先裁到它那一栏露出来的范围里（对照时栏可能左右滚着）。 */
function selectionBands(selection: Selection | null): SelectionRect[] {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return [];
  const range = selection.getRangeAt(0);
  const common = range.commonAncestorContainer;
  const nodes: Text[] = common.nodeType === 3 ? [common as Text] : (() => {
    const out: Text[] = [];
    const walker = document.createTreeWalker(common, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (range.intersectsNode(node)) out.push(node as Text);
    return out;
  })();
  const rects: SelectionRect[] = [];
  const clips = new Map<Element, DOMRect>();
  for (const node of nodes) {
    const layer = node.parentElement?.closest(TEXT_LAYER);
    if (!layer) continue;
    const pane = layer.closest(`.${READER_PDF_PANE_CLASS}`) ?? layer;
    let clip = clips.get(pane);
    if (!clip) {
      clip = pane.getBoundingClientRect();
      clips.set(pane, clip);
    }
    const part = document.createRange();
    part.selectNodeContents(node);
    if (node === range.startContainer) part.setStart(node, range.startOffset);
    if (node === range.endContainer) part.setEnd(node, range.endOffset);
    // 只有空格的那几段（pdf.js 把行尾的空格也放成一段，宽度常常拉到栏外）不画：色带只盖字。
    if (!part.toString().trim()) continue;
    for (const rect of part.getClientRects()) {
      const left = Math.max(rect.left, clip.left);
      const right = Math.min(rect.right, clip.right);
      if (right - left > 0.5) rects.push({ left, top: rect.top, right, bottom: rect.bottom });
    }
  }
  return mergeSelectionRects(rects);
}

type Bar = { left: number; top: number; text: string; page: number; pane: "source" | "translated"; actions: ReaderMenuItem[] };

export function ReaderSelectionLayer({ scope, menuItemsAt }: {
  /** 收藏存在哪本书下（和书签同一个 scope）；没有就不给收藏。 */
  scope: string;
  /** 扩展的右键项（取标了 inSelectionBar 的放进浮条）。 */
  menuItemsAt: (context: ReaderMenuContext) => readonly ReaderMenuItem[];
}): ReactElement {
  const paint = useRef<HTMLDivElement | null>(null);
  const settled = useRef(false);
  /** 这一下是在书页上按下的（只有这样松手才出浮条；点底下的缩放之类不算）。 */
  const pressedOnPage = useRef(false);
  const frame = useRef(0);
  const menuItemsRef = useRef(menuItemsAt);
  menuItemsRef.current = menuItemsAt;
  const [bar, setBar] = useState<Bar | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const draw = useCallback(() => {
    frame.current = 0;
    const host = paint.current;
    if (!host) return;
    const selection = globalThis.getSelection?.() ?? null;
    const bands = selectionBands(selection);
    const origin = host.getBoundingClientRect();
    while (host.children.length > bands.length) host.lastElementChild!.remove();
    bands.forEach((band, index) => {
      const div = (host.children[index] as HTMLDivElement | undefined) ?? host.appendChild(document.createElement("div"));
      div.className = "reader-selection-band";
      div.style.left = `${band.left - origin.left}px`;
      div.style.top = `${band.top - origin.top}px`;
      div.style.width = `${band.right - band.left}px`;
      div.style.height = `${band.bottom - band.top}px`;
    });
    if (!settled.current) return;
    const picked = readPageSelection(selection);
    if (!picked || !bands.length) {
      settled.current = false;
      setBar(null);
      return;
    }
    // 浮条在选区第一行上面、按选区横向居中；上面放不下（顶上浮着返回和页签）就放到最后一行下面。
    const first = bands[0];
    const last = bands[bands.length - 1];
    const left = (Math.min(...bands.map((band) => band.left)) + Math.max(...bands.map((band) => band.right))) / 2 - origin.left;
    const above = first.top - origin.top - BAR_GAP - BAR_HEIGHT;
    const top = above >= TOP_ROOM ? above : last.bottom - origin.top + BAR_GAP;
    setBar((current) => {
      const actions = current && current.text === picked.text ? current.actions : menuItemsRef.current({
        target: picked.layer,
        clientX: (first.left + first.right) / 2,
        clientY: (first.top + first.bottom) / 2,
        page: picked.page,
      }).filter((item) => item.inSelectionBar);
      const width = barRef.current?.offsetWidth || 220;
      const clamped = Math.min(Math.max(left, width / 2 + 8), origin.width - width / 2 - 8);
      if (current && current.text === picked.text && Math.abs(current.left - clamped) < 0.5 && Math.abs(current.top - top) < 0.5) return current;
      return { left: clamped, top, text: picked.text, page: picked.page, pane: picked.pane, actions };
    });
  }, []);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    const host = paint.current;
    const stage = host?.parentElement;
    const root = host?.closest(`.${READER_ROOT_CLASS}`) as HTMLElement | null;
    if (!host || !stage) return undefined;
    const unlock = () => {
      if (root) delete root.dataset.selectPane;
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target && barRef.current?.contains(target)) return;
      settled.current = false;
      setBar(null);
      // 按下在哪一栏的书页上：另一栏的文字层这一下不让选（对照时拖过栏缝不串到另一栏）。
      const pane = target?.closest?.(`[${READER_PAGE_ATTR}][${READER_PANE_ATTR}]`)?.getAttribute(READER_PANE_ATTR);
      pressedOnPage.current = Boolean(pane) && event.button === 0;
      if (root && pane && event.button === 0) root.dataset.selectPane = pane;
    };
    const onPointerUp = (event: PointerEvent) => {
      unlock();
      const onPage = pressedOnPage.current;
      pressedOnPage.current = false;
      if (event.button !== 0 || !onPage) return;
      const selection = globalThis.getSelection?.() ?? null;
      if (!readPageSelection(selection)) return;
      snapSelectionToFormulas(selection);
      settled.current = true;
      schedule();
    };
    const onCopy = (event: ClipboardEvent) => {
      const picked = readPageSelection();
      if (!picked || !event.clipboardData) return;
      event.clipboardData.setData("text/plain", picked.text);
      event.preventDefault();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && settled.current) {
        settled.current = false;
        setBar(null);
      }
    };
    stage.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", unlock);
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("copy", onCopy);
    document.addEventListener("keydown", onKey);
    stage.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      unlock();
      if (frame.current) cancelAnimationFrame(frame.current);
      stage.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", unlock);
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("keydown", onKey);
      stage.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [schedule]);

  return (
    <>
      <div className="reader-selection-paint" ref={paint} aria-hidden="true" />
      {bar ? (
        <ReaderSelectionBar
          ref={barRef}
          bar={bar}
          scope={scope}
          onDone={() => {
            settled.current = false;
            setBar(null);
          }}
        />
      ) : null}
    </>
  );
}

function ReaderSelectionBar({ bar, scope, onDone, ref }: {
  bar: Bar;
  scope: string;
  onDone: () => void;
  ref: Ref<HTMLDivElement>;
}): ReactElement {
  const { favorites, add } = useReaderFavorites(scope);
  const saved = Boolean(scope) && Boolean(findReaderFavorite(favorites, bar.text, bar.page));
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div
      ref={ref}
      className="reader-selection-bar"
      role="toolbar"
      aria-label="选中的字"
      style={{ left: bar.left, top: bar.top }}
      // 点浮条上的按钮不让书页上的选区没了。
      onPointerDown={(event) => event.preventDefault()}
    >
      <Button
        className="reader-selection-action"
        title={IS_MAC ? "复制（⌘C）" : "复制（Ctrl+C）"}
        onClick={() => {
          void copySelectionText(bar.text).then((ok) => setCopied(ok));
        }}
      >
        {copied ? <Check size={14} strokeWidth={1.75} aria-hidden /> : <Copy size={14} strokeWidth={1.75} aria-hidden />}
        <span>{copied ? "已复制" : "复制"}</span>
      </Button>
      {scope ? (
        <Button
          className="reader-selection-action"
          aria-pressed={saved}
          title={saved ? "已收藏，在左下角「收藏」（星）里" : "收藏这段，在左下角「收藏」（星）里翻回来"}
          onClick={() => {
            if (!saved) add({ text: bar.text, page: bar.page, pane: bar.pane });
          }}
        >
          <Star size={14} strokeWidth={1.75} fill={saved ? "currentColor" : "none"} aria-hidden />
          <span>{saved ? "已收藏" : "收藏"}</span>
        </Button>
      ) : null}
      {bar.actions.map((action) => (
        <Button
          key={action.key}

          className="reader-selection-action"
          title={action.hint ? `${action.label}（${action.hint}）` : action.label}
          onClick={() => {
            onDone();
            action.onSelect();
          }}
        >
          <MessageCircle size={14} strokeWidth={1.75} aria-hidden />
          <span>{action.inSelectionBar}</span>
        </Button>
      ))}
    </div>
  );
}
