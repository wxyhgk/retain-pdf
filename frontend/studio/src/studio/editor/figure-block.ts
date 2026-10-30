import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView, type NodeView, type NodeViewConstructor } from '@milkdown/prose/view';
import { $nodeSchema, $prose, $remark } from '@milkdown/utils';

import { figureCaption, figureLabel, figureWidth, standaloneImage, withWidth } from '@blog/markdown/figures/figures.mjs';
import '@blog/markdown/figures/figures.css';
import { t } from '@blog/i18n/index.mjs';
import { loadWhenNear } from '@blog/editor-kit/near-screen.ts';

/**
 * Pictures as the blog shows them (`src/figures/`): an image alone in its
 * paragraph is a figure, with its width (`{width=60%}`, dragged at its edge)
 * and its caption (the alt text, typed under it), numbered 图 1, 图 2….
 */

export const FIGURE_TYPE = 'figure_image';

type MdastNode = { type: string; url?: string; alt?: string | null; title?: string | null; value?: string; children?: MdastNode[] };
type MdastImage = { type: 'image'; url: string; alt?: string | null; title?: string | null };
type RemarkPlugin = ReturnType<Parameters<typeof $remark>[1]>;

function figureNode(image: { url?: string; alt?: string | null; title?: string | null }, attributes: string): MdastNode & { attributes: string } {
	return { type: 'articleFigure', url: image.url ?? '', alt: image.alt ?? '', title: image.title ?? '', attributes };
}

/**
 * Images open as the Markdown wrote them: one alone in its paragraph as a
 * figure, others inline. Crepe makes its own image block of a lone image,
 * which keeps a size ratio in the alt text; that becomes a figure too. A
 * missing title or alt becomes `''`, or ProseMirror would drop the image.
 */
function figures(node: MdastNode): void {
	node.children?.forEach((child, index, siblings) => {
		if (child.type === 'image-block') {
			siblings[index] = figureNode(child, '');
			return;
		}
		const alone = child.type === 'paragraph' ? standaloneImage<MdastImage>(child) : null;
		if (alone) {
			siblings[index] = figureNode(alone.image, alone.attributes);
			return;
		}
		if (child.type === 'image') {
			child.alt ??= '';
			child.title ??= '';
		} else figures(child);
	});
}

export const figureRemark = $remark('article-figures', () => (() => figures) as unknown as RemarkPlugin);

export const figureSchema = $nodeSchema(FIGURE_TYPE, () => ({
	group: 'block',
	atom: true,
	selectable: true,
	draggable: true,
	isolating: true,
	marks: '',
	attrs: {
		src: { default: '' },
		alt: { default: '' },
		title: { default: '' },
		/** What the braces after the image hold, as written: `width=60%`. */
		attributes: { default: '' },
	},
	parseDOM: [
		{
			tag: `figure[data-type="${FIGURE_TYPE}"]`,
			getAttrs: (dom) => {
				const image = (dom as HTMLElement).querySelector('img');
				return {
					src: image?.getAttribute('src') ?? '',
					alt: image?.getAttribute('alt') ?? '',
					title: image?.getAttribute('title') ?? '',
					attributes: (dom as HTMLElement).dataset.attributes ?? '',
				};
			},
		},
	],
	toDOM: (node) => [
		'figure',
		{ 'data-type': FIGURE_TYPE, 'data-attributes': node.attrs.attributes },
		['img', { src: node.attrs.src, alt: node.attrs.alt, title: node.attrs.title || null }],
	],
	parseMarkdown: {
		match: (node) => node.type === 'articleFigure',
		runner: (state, node, type) => {
			state.addNode(type, {
				src: node.url ?? '',
				alt: node.alt ?? '',
				title: node.title ?? '',
				attributes: (node as { attributes?: string }).attributes ?? '',
			});
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === FIGURE_TYPE,
		runner: (state, node) => {
			state.openNode('paragraph');
			state.addNode('image', undefined, undefined, { url: node.attrs.src, alt: node.attrs.alt, title: node.attrs.title || null });
			if (node.attrs.attributes) state.addNode('text', undefined, `{${node.attrs.attributes}}`);
			state.closeNode();
		},
	},
}));

const numbersKey = new PluginKey<DecorationSet>('figure-numbers');

/** The number of each figure with a caption, as the blog counts them. */
function numberFigures(doc: ProseNode): DecorationSet {
	const marks: Decoration[] = [];
	let number = 0;
	doc.descendants((node, pos) => {
		if (node.type.name !== FIGURE_TYPE) return true;
		if (figureCaption(node.attrs.alt, node.attrs.src)) {
			number += 1;
			marks.push(Decoration.node(pos, pos + node.nodeSize, {}, { figureNumber: number }));
		}
		return false;
	});
	return DecorationSet.create(doc, marks);
}

const figureNumbers = $prose(
	() =>
		new Plugin<DecorationSet>({
			key: numbersKey,
			state: {
				init: (_, state) => numberFigures(state.doc),
				apply: (tr, set) => (tr.docChanged ? numberFigures(tr.doc) : set),
			},
			props: { decorations: (state) => numbersKey.getState(state) },
		}),
);

/** Widths the edge snaps to, in percent of the column. */
const SNAP = 5;
const NARROWEST = 10;

const figureViews = new WeakMap<Node, FigureView>();

/** How large the shown article's pictures are, by their `src` as written (the article's `pictures`, picture-sizes.mjs). */
let pictureSizes: Record<string, [number, number]> = {};

/** The article about to be shown: its pictures' sizes, for their room to be kept till they are loaded. */
export function usePictureSizes(sizes: Record<string, [number, number]> | undefined): void {
	pictureSizes = sizes ?? {};
}

class FigureView implements NodeView {
	readonly dom: HTMLElement;
	private node: ProseNode;
	private readonly view: EditorView;
	private readonly getPos: () => number | undefined;
	private readonly fileUrl: (src: string) => string;
	private readonly image: HTMLImageElement;
	private readonly label: HTMLElement;
	private readonly caption: HTMLInputElement;
	private readonly badge: HTMLElement;
	/** Its picture asked for (it came near the screen): from then on, as it changes. */
	private loaded = false;
	/** Where its number comes from (`figureNumbers`). */
	private decorations: readonly Decoration[] = [];

	constructor(node: ProseNode, view: EditorView, getPos: () => number | undefined, decorations: readonly Decoration[], fileUrl: (src: string) => string) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.fileUrl = fileUrl;
		this.dom = document.createElement('figure');
		this.dom.className = 'article-figure pm-figure';
		this.dom.contentEditable = 'false';

		const frame = document.createElement('div');
		frame.className = 'pm-figure-frame';
		this.image = document.createElement('img');
		this.image.draggable = false;
		this.image.decoding = 'async';
		const handle = document.createElement('span');
		handle.className = 'pm-figure-handle';
		handle.title = t('拖动调整宽度');
		handle.addEventListener('pointerdown', this.resize);
		this.badge = document.createElement('span');
		this.badge.className = 'pm-figure-badge';
		frame.append(this.image, handle, this.badge);

		const caption = document.createElement('figcaption');
		this.label = document.createElement('span');
		this.label.className = 'figure-label';
		this.caption = document.createElement('input');
		this.caption.className = 'pm-figure-caption';
		this.caption.placeholder = t('添加图注');
		this.caption.setAttribute('aria-label', t('图注'));
		this.caption.addEventListener('input', this.onCaption);
		this.caption.addEventListener('keydown', this.onCaptionKey);
		caption.append(this.label, this.caption);

		this.dom.append(frame, caption);
		this.draw(decorations);
		// Its picture fetched as it comes near the screen, not before: a long article's, another device's over a phone.
		loadWhenNear(view.dom, this.image, () => {
			this.loaded = true;
			this.draw();
		});
		figureViews.set(this.dom, this);
	}

	/** Into the caption, from the keyboard: the caret at its end. */
	focusCaption(): void {
		this.caption.focus();
		const end = this.caption.value.length;
		this.caption.setSelectionRange(end, end);
	}

	update(node: ProseNode, decorations: readonly Decoration[]): boolean {
		if (node.type !== this.node.type) return false;
		this.node = node;
		this.draw(decorations);
		return true;
	}

	selectNode(): void {
		this.dom.classList.add('is-selected');
	}

	deselectNode(): void {
		this.dom.classList.remove('is-selected');
	}

	/** Typing in the caption and dragging the edge are the figure's own. */
	stopEvent(event: Event): boolean {
		const target = event.target as Element | null;
		return Boolean(target?.closest('.pm-figure-caption, .pm-figure-handle'));
	}

	ignoreMutation(): boolean {
		return true;
	}

	destroy(): void {
		window.removeEventListener('pointermove', this.onResizeMove);
		window.removeEventListener('pointerup', this.onResizeEnd);
	}

	private draw(decorations: readonly Decoration[] = this.decorations): void {
		this.decorations = decorations;
		const { src, alt, attributes } = this.node.attrs as { src: string; alt: string; attributes: string };
		// Its path as written, there before it is loaded (what goes back to a picture in its note finds it by).
		this.image.dataset.path = src;
		// Its room kept, as large as the picture (when its size is known), till it is loaded.
		const size = pictureSizes[src];
		if (size) [this.image.width, this.image.height] = size;
		else for (const name of ['width', 'height']) this.image.removeAttribute(name);
		// As wide as the picture is, when no width is written (its frame is as wide as what it holds, nothing yet).
		if (size) this.dom.style.setProperty('--figure-natural', `${size[0]}px`);
		else this.dom.style.removeProperty('--figure-natural');
		if (this.loaded) {
			const url = this.fileUrl(src);
			if (this.image.getAttribute('src') !== url) this.image.src = url;
			// Not before: a picture without one shows its words in its place.
			this.image.alt = alt;
		}
		const width = figureWidth(attributes);
		if (width) this.dom.style.setProperty('--figure-width', width);
		else this.dom.style.removeProperty('--figure-width');
		const caption = figureCaption(alt, src);
		// The caption field holds what the blog shows: a file name is not a caption.
		if (document.activeElement !== this.caption && this.caption.value !== caption) this.caption.value = caption;
		const number = decorations.map((decoration) => (decoration.spec as { figureNumber?: number }).figureNumber).find(Boolean);
		this.label.textContent = number ? figureLabel(number) : '';
		this.label.hidden = !number;
	}

	private setAttrs(attrs: Record<string, unknown>): void {
		const pos = this.getPos();
		if (pos === undefined) return;
		this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, ...attrs }));
	}

	private onCaption = (): void => {
		this.setAttrs({ alt: this.caption.value });
	};

	/**
	 * Enter, Esc or ↓: on to the text after the figure. ↑: the figure
	 * itself, selected (another ↑ goes above it), as the arrows go through a
	 * figure: the picture, then its caption.
	 */
	private onCaptionKey = (event: KeyboardEvent): void => {
		if (event.isComposing || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			const pos = this.getPos();
			if (pos === undefined) return;
			this.view.dispatch(this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos)).scrollIntoView());
			this.view.focus();
			return;
		}
		if (event.key !== 'Enter' && event.key !== 'Escape' && event.key !== 'ArrowDown') return;
		event.preventDefault();
		const pos = this.getPos();
		if (pos === undefined) return;
		const after = pos + this.node.nodeSize;
		const { state } = this.view;
		this.view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(Math.min(after, state.doc.content.size)), 1)).scrollIntoView());
		this.view.focus();
	};

	private dragged: number | null = null;

	private resize = (event: PointerEvent): void => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		this.dom.classList.add('is-resizing');
		window.addEventListener('pointermove', this.onResizeMove);
		window.addEventListener('pointerup', this.onResizeEnd);
		this.onResizeMove(event);
	};

	/** The picture is centred: its width is twice the distance from the centre to the pointer. */
	private onResizeMove = (event: PointerEvent): void => {
		const column = this.dom.getBoundingClientRect();
		if (!column.width) return;
		const half = event.clientX - (column.left + column.width / 2);
		const percent = Math.round(((2 * half) / column.width) * 100 / SNAP) * SNAP;
		this.dragged = Math.max(NARROWEST, Math.min(100, percent));
		this.dom.style.setProperty('--figure-width', `${this.dragged}%`);
		this.badge.textContent = `${this.dragged}%`;
	};

	private onResizeEnd = (): void => {
		window.removeEventListener('pointermove', this.onResizeMove);
		window.removeEventListener('pointerup', this.onResizeEnd);
		this.dom.classList.remove('is-resizing');
		const dragged = this.dragged;
		this.dragged = null;
		if (dragged === null) return;
		const attributes = withWidth(this.node.attrs.attributes, dragged >= 100 ? null : `${dragged}%`);
		if (attributes === this.node.attrs.attributes) this.draw();
		else this.setAttrs({ attributes });
	};
}

function figureView(fileUrl: (src: string) => string): MilkdownPlugin {
	return (ctx: Ctx) => async () => {
		await ctx.wait(SchemaReady);
		const entry: [string, NodeViewConstructor] = [
			FIGURE_TYPE,
			(node, view, getPos, decorations) => new FigureView(node, view, getPos, decorations, fileUrl),
		];
		ctx.update(nodeViewCtx, (views) => [...views.filter(([id]) => id !== FIGURE_TYPE), entry]);
		return () => {
			ctx.update(nodeViewCtx, (views) => views.filter(([id]) => id !== FIGURE_TYPE));
		};
	};
}

/**
 * The arrows through a figure (as SiYuan takes captions in): ↓ on it
 * selected goes into its caption; ↑ from the line under it, into its caption
 * too, then (from the caption) onto the picture.
 */
const figureArrows = $prose(
	() =>
		new Plugin({
			props: {
				handleKeyDown(view, event) {
					if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.isComposing) return false;
					const { selection } = view.state;
					let at: number | null = null;
					if (event.key === 'ArrowDown' && selection instanceof NodeSelection && selection.node.type.name === FIGURE_TYPE) at = selection.from;
					else if (event.key === 'ArrowUp' && selection instanceof TextSelection && selection.empty && selection.$from.depth > 0 && view.endOfTextblock('up')) {
						const before = view.state.doc.resolve(selection.$from.before());
						if (before.nodeBefore?.type.name === FIGURE_TYPE) at = before.pos - before.nodeBefore.nodeSize;
					}
					if (at == null) return false;
					const figure = figureViews.get(view.nodeDOM(at) as Node);
					if (!figure) return false;
					figure.focusCaption();
					return true;
				},
			},
		}),
);

/** The figure block, its Markdown, its numbers and its view; `fileUrl` loads the article's pictures. */
export function figurePlugins(fileUrl: (src: string) => string): MilkdownPlugin[] {
	return [figureRemark, ...figureSchema, figureNumbers, figureView(fileUrl), figureArrows].flat();
}
