import type { Node as ProseNode } from '@milkdown/prose/model';
import type { EditorView } from '@milkdown/prose/view';

/**
 * What a long article draws only once it comes near the screen: its
 * formulas. KaTeX for a book's thousands of them took most of the time it
 * took to open (and their hundreds of thousands of elements, most of the
 * time the page took to lay out); until drawn, one shows its LaTeX.
 *
 * As the page scrolls, the article's blocks on the screen or a screen
 * away are found by halving (they go down the page in order) and what
 * waits in them is drawn: not each formula watched by itself (the browser
 * would work out where each of thousands is at every frame).
 *
 * An article of any length, as it is opened, draws only what is near the
 * screen before it is first shown; the rest after, a few at every frame
 * (KaTeX and laying out an article of formulas took a quarter of a second
 * after each click on it in the list). Formulas made once it is shown (typed,
 * pasted) are drawn at once.
 *
 * What is fetched (an article's pictures, its 交互模块) is loaded only when it comes near the screen, in an article of
 * any length, and never the rest after (`loadWhenNear`): what is not scrolled to is not downloaded (another device's
 * Studio, over a phone's network).
 */

/** How many top-level blocks make an article long (a long article in this blog has about 200). */
export const LONG_ARTICLE = 400;

export const isLongArticle = (doc: ProseNode): boolean => doc.childCount > LONG_ARTICLE;

/** The class of a long article's element (studio-editor.ts): one being shown a part at a time has it from its first part. */
export const LONG = 'is-long';

/** The class of an article's element as it is opened, till it is first shown (studio-editor.ts). */
export const OPENING = 'is-opening';

/**
 * Whether a formula made in `view` waits to be drawn: in a long article, or in one being opened. What a formula's
 * view asks as it is made (the classes are there before them).
 */
export const drawsLater = (view: EditorView): boolean => view.dom.classList.contains(LONG) || view.dom.classList.contains(OPENING);

/** How long a frame spends drawing what waits far from the screen in an article that is not long, in ms. */
const SPELL = 8;

const WAITING = 'is-waiting';
/** What waits to be loaded when it comes near, and only then. */
const NEAR_ONLY = 'is-waiting-near';
const ANY_WAITING = `.${WAITING}, .${NEAR_ONLY}`;

/** By element: what draws it. */
const waiting = new WeakMap<Element, () => void>();
/** The articles (ProseMirror's elements) with something waiting. */
const roots = new Set<HTMLElement>();
let frame = 0;
let listening = false;
/** An article shown (laid out after it was hidden, as one being opened is) or resized: what is near it looked for again. */
let sized: ResizeObserver | null = null;

/** Draws `element` with `draw` once it is near the screen, in the article `root`. */
export function drawWhenNear(root: HTMLElement, element: HTMLElement, draw: () => void): void {
	if (!listening) {
		listening = true;
		// Scrolls of whatever holds the article (scroll events do not bubble; they are caught on the way down).
		document.addEventListener('scroll', soon, { capture: true, passive: true });
		window.addEventListener('resize', soon);
	}
	element.classList.add(WAITING);
	waiting.set(element, draw);
	if (!roots.has(root)) (sized ??= new ResizeObserver(soon)).observe(root);
	roots.add(root);
	soon();
}

/** Loads `element` with `load` once it is near the screen, in the article `root`; not before, however long it waits. */
export function loadWhenNear(root: HTMLElement, element: HTMLElement, load: () => void): void {
	drawWhenNear(root, element, load);
	element.classList.replace(WAITING, NEAR_ONLY);
}

/** Whether `element` is still to be drawn. */
export const isWaiting = (element: Element): boolean => waiting.has(element);

/** Whether anything in `root` (an article's element) is still to be drawn. */
export const anyWaiting = (root: Element): boolean => root.querySelector(`.${WAITING}`) !== null;

/** Draws `element` now, if it waits (it is being edited, say). */
export function drawNow(element: Element): void {
	const draw = waiting.get(element);
	if (!draw) return;
	waiting.delete(element);
	element.classList.remove(WAITING, NEAR_ONLY);
	draw();
}

function soon(): void {
	frame ||= requestAnimationFrame(drawNear);
}

/** The blocks of `root` from `above` to `below` the top of the screen (in px), found by halving. */
function blocksWithin(root: HTMLElement, above: number, below: number): Element[] {
	const blocks = root.children;
	let low = 0;
	let high = blocks.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (blocks[middle]!.getBoundingClientRect().bottom > above) high = middle;
		else low = middle + 1;
	}
	const found: Element[] = [];
	for (let index = low; index < blocks.length; index += 1) {
		if (blocks[index]!.getBoundingClientRect().top > below) break;
		found.push(blocks[index]!);
	}
	return found;
}

const waits = (block: Element) => isWaiting(block) || block.querySelector(ANY_WAITING) !== null;

/**
 * Draws what waits near the screen. Each drawing lays the article out again (in WebKit, all of a book), so not a
 * little at every frame of a scroll: once something waits within a screen of it, all that waits within three.
 */
function drawNear(): void {
	frame = 0;
	const screen = window.innerHeight;
	for (const root of roots) {
		if (!root.isConnected || root.querySelector(ANY_WAITING) === null) {
			roots.delete(root);
			sized?.unobserve(root);
			continue;
		}
		// Not laid out (hidden): where anything is cannot be told, and nothing is fetched for it.
		const shown = root.getClientRects().length > 0;
		if (blocksWithin(root, -screen, 2 * screen).some(waits)) {
			for (const block of blocksWithin(root, -3 * screen, 4 * screen)) {
				for (const element of [block, ...block.querySelectorAll(ANY_WAITING)]) if (shown || !element.classList.contains(NEAR_ONLY)) drawNow(element);
			}
		}
		// Not a long article: the rest too, down the article, a few at a frame.
		if (root.classList.contains(LONG)) continue;
		const until = performance.now() + SPELL;
		for (const element of root.querySelectorAll(`.${WAITING}`)) {
			if (performance.now() > until) break;
			drawNow(element);
		}
		if (anyWaiting(root)) soon();
	}
}

