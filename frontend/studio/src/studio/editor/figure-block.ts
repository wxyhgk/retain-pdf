import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx } from '@milkdown/kit/core';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView, type NodeView, type NodeViewConstructor } from '@milkdown/prose/view';
import { $nodeSchema, $prose, $remark } from '@milkdown/utils';

import { figureCaption, figureLabel, figureWidth, standaloneImage, withWidth } from '../../figures/figures.mjs';
import '../../figures/figures.css';

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
		const handle = document.createElement('span');
		handle.className = 'pm-figure-handle';
		handle.title = '拖动调整宽度';
		handle.addEventListener('pointerdown', this.resize);
		this.badge = document.createElement('span');
		this.badge.className = 'pm-figure-badge';
		frame.append(this.image, handle, this.badge);

		const caption = document.createElement('figcaption');
		this.label = document.createElement('span');
		this.label.className = 'figure-label';
		this.caption = document.createElement('input');
		this.caption.className = 'pm-figure-caption';
		this.caption.placeholder = '添加图注';
		this.caption.setAttribute('aria-label', '图注');
		this.caption.addEventListener('input', this.onCaption);
		this.caption.addEventListener('keydown', this.onCaptionKey);
		caption.append(this.label, this.caption);

		this.dom.append(frame, caption);
		this.draw(decorations);
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
		const url = this.fileUrl(src);
		if (this.image.getAttribute('src') !== url) this.image.src = url;
		this.image.alt = alt;
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

	/** Enter or Esc: back to the text after the figure. */
	private onCaptionKey = (event: KeyboardEvent): void => {
		if (event.isComposing || (event.key !== 'Enter' && event.key !== 'Escape')) return;
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

/** The figure block, its Markdown, its numbers and its view; `fileUrl` loads the article's pictures. */
export function figurePlugins(fileUrl: (src: string) => string): MilkdownPlugin[] {
	return [figureRemark, ...figureSchema, figureNumbers, figureView(fileUrl)].flat();
}
