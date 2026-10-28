import { keepNote } from '../api/client';

/** How often the scroller is looked at, in ms; and how many notes one page keeps at most. */
const EVERY = 2000;
const NOTES = 20;

/** An element as a note names it: tag, id, classes, where it reaches past the scroller's right side, its width. */
function named(node: Element, right: number): string {
	const box = node.getBoundingClientRect();
	const style = getComputedStyle(node);
	const classes = typeof node.className === 'string' ? node.className.trim().replace(/\s+/gu, '.').slice(0, 80) : '';
	const text = (node.textContent ?? '').trim().replace(/\s+/gu, ' ').slice(0, 40);
	return `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${classes ? `.${classes}` : ''} 伸出 ${Math.round(box.right - right)}px 宽 ${Math.round(box.width)} ${style.position}${style.visibility === 'hidden' ? ' hidden' : ''} 「${text}」`; // i18n-ignore: developer log
}

/** Where the focus and the selection are, as a note says it. */
function where(): string {
	const active = document.activeElement;
	const selection = document.getSelection();
	const anchor = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement;
	const holder = (node: Element | null | undefined) => node?.closest('#side-ai, #crepe-editor, .ai-input, .document-header, dialog')?.id || node?.closest('[class]')?.className.toString().slice(0, 60) || '';
	return `焦点：${active ? named(active, active.getBoundingClientRect().right) : '无'}\n选区在：${holder(anchor)}（${selection?.type ?? ''}）\n窗口：${innerWidth}×${innerHeight}`; // i18n-ignore: developer log
}

/**
 * The article's scroller made wider than itself (a scrollbar along its foot, seen now and then while the author types
 * in the AI panel, not reproduced in tests): what reaches past its right side, where the focus and the selection were,
 * kept in .astro/studio-notes.log (once for each different cause). Only looks: changes nothing.
 */
export function watchOverflow(article: HTMLElement): void {
	const told = new Set<string>();
	/** The scroller and those holding it, up to the page's own: whichever of them it is that shows the scrollbar. */
	const scrollers: HTMLElement[] = [];
	for (let node: HTMLElement | null = article; node; node = node.parentElement) scrollers.push(node);
	const look = () => {
		if (document.visibilityState !== 'visible' || told.size >= NOTES) return;
		// Only one that scrolls sideways shows a scrollbar (one that clips does not).
		const scroller = scrollers.find((node) => node.scrollWidth - node.clientWidth > 1 && (node === document.documentElement || /auto|scroll/u.test(getComputedStyle(node).overflowX)));
		if (!scroller) return;
		const extra = scroller.scrollWidth - scroller.clientWidth;
		const right = scroller.getBoundingClientRect().right;
		const past = [...scroller.querySelectorAll('*')].filter((node) => node.getBoundingClientRect().right > right + 1 && getComputedStyle(node).display !== 'none');
		// The innermost first: those holding nothing else that reaches past (what makes it wider, not its ancestors).
		const innermost = past.filter((node) => !past.some((other) => other !== node && node.contains(other)));
		const lines = innermost.slice(0, 12).map((node) => named(node, right));
		const key = lines.map((line) => line.replace(/ 伸出 .*/u, '')).join('|') || `宽 ${extra}`; // i18n-ignore: developer log
		if (told.has(key)) return;
		told.add(key);
		void keepNote(`${named(scroller, right).replace(/ 伸出 .*/u, '')} 比自己宽 ${extra}px（滚动 ${scroller.scrollLeft}）\n${lines.join('\n') || '（没有元素伸出：可能是被滚动过）'}\n${where()}`).catch(() => {}); // i18n-ignore: developer log
	};
	setInterval(look, EVERY);
}
