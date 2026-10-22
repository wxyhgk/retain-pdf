import { $prose, $view } from '@milkdown/utils';
import { blockMenuAPI } from '@milkdown/crepe/feature/block-edit';
import { $fencedBlock } from '@milkdown/kit/preset/commonmark';
import { NodeSelection, Plugin, TextSelection } from '@milkdown/prose/state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

import { createSciencePreview } from '@blog/science/browser/science-renderer.ts';
import type { OpenSheet } from '@blog/ui/block-sheet.ts';
import { isMoleculeLanguage } from '@blog/science/parsers/molecule-block.ts';
import { scienceBlockKeys } from './science-block-menu.ts';
import {
	SCIENCE_FENCE_TYPE,
	parseScienceFence,
	scienceBlockKindLabel,
	scienceSourceEditor,
	takeNextTab,
} from './science-block.ts';
import { openScienceSheet } from './science-sheet.ts';

/**
 * Science fenced-code blocks as a first-class Crepe node.
 * Thin Milkdown glue over `./science-block.ts`, which owns recognition and
 * the block menu's edits (all Node-tested there), and `./science-sheet.ts`,
 * the sheet a block is edited in.
 *
 * `$fencedBlock` (the Milkdown fork) gives every fence in a scientific
 * language this node, whether loaded, pasted, typed as ```smiles or given
 * the language later, and writes it back as the same fence, meta and fence
 * characters included.
 */
export const scienceBlockSchema = $fencedBlock(SCIENCE_FENCE_TYPE, isMoleculeLanguage, () => ({
	// The source is edited in its sheet, never in place: the block is one unit. Without
	// this a selection read back from the DOM lands in a paragraph nearby instead of
	// on the block, which drops the block menu the moment it happens.
	atom: true,
	isolating: true,
}));

const PREVIEW_DEBOUNCE_MS = 350;
const scienceViews = new Set<() => void>();

function trackScienceView(sync: () => void): () => void {
	scienceViews.add(sync);
	return () => {
		scienceViews.delete(sync);
	};
}

/** Selection changes do not call NodeView.update, so sheets open from here. */
export const scienceBlockSelectionPlugin = $prose(
	() =>
		new Plugin({
			view() {
				return {
					update() {
						for (const sync of scienceViews) sync();
					},
				};
			},
		}),
);

function paintMolecule(host: HTMLElement, info: string, source: string): void {
	host.replaceChildren();
	if (!source) return;
	const descriptor = parseScienceFence(info, source);
	const element = descriptor?.block ? createSciencePreview(descriptor.block.language, descriptor.source) : null;
	if (element) {
		host.append(element);
		return;
	}
	const fallback = document.createElement('p');
	fallback.className = 'science-block-fallback';
	fallback.textContent = descriptor?.problem ? `无法预览：${descriptor.problem}` : '无法预览这段结构';
	host.append(fallback);
}

/**
 * The block rests on its rendered molecule; a click selects it. Double
 * click, Enter, 编辑 and any command that puts the caret inside the node
 * (slash insert, the menu's 编辑源码) open its sheet (science-sheet.ts):
 * the structure edited where it is drawn, and its source.
 */
export const scienceBlockView = $view(scienceBlockSchema.schema.node, (ctx) => {
	return (initial: ProseMirrorNode, view: EditorView, getPos: () => number | undefined): NodeView => {
		let node = initial;
		const dom = document.createElement('div');
		dom.className = 'science-block';
		// It selects itself and opens its sheet: a press on it is not the start of a selecting drag.
		dom.dataset.ownsPointer = '';
		const caption = document.createElement('div');
		caption.className = 'science-block-caption';
		const kind = document.createElement('span');
		kind.className = 'science-block-kind';
		kind.textContent = scienceBlockKindLabel(String(initial.attrs.language ?? ''));
		const editButton = document.createElement('button');
		editButton.type = 'button';
		editButton.className = 'science-block-edit';
		editButton.textContent = '编辑';
		const menuButton = document.createElement('button');
		menuButton.type = 'button';
		menuButton.className = 'science-block-menu-button';
		menuButton.textContent = '⋯';
		menuButton.setAttribute('aria-label', '块操作');
		caption.append(kind, editButton, menuButton);
		const preview = document.createElement('div');
		preview.className = 'science-block-preview';
		const placeholder = document.createElement('div');
		placeholder.className = 'science-block-placeholder';
		placeholder.textContent = scienceSourceEditor(String(initial.attrs.language ?? '')).placeholder;
		dom.append(caption, preview, placeholder);
		dom.classList.toggle('is-empty', initial.textContent.length === 0);

		let timer: ReturnType<typeof setTimeout> | undefined;
		let renderedKey: string | null = null;
		const render = (current: ProseMirrorNode) => {
			const info = String(current.attrs.language ?? '');
			const key = `${info}\n${current.textContent}`;
			// Steady-state renders must not touch the DOM: a renderer writing
			// SVG or a canvas is expensive, and an unchanged key means nothing to do.
			if (key === renderedKey) return;
			renderedKey = key;
			const label = scienceBlockKindLabel(info);
			if (kind.textContent !== label) kind.textContent = label;
			const hint = scienceSourceEditor(info).placeholder;
			if (placeholder.textContent !== hint) placeholder.textContent = hint;
			paintMolecule(preview, info, current.textContent);
		};
		render(initial);

		let sheet: OpenSheet | null = null;
		let destroyed = false;

		const current = (): ProseMirrorNode | null => {
			const pos = getPos();
			if (pos == null) return null;
			const found = view.state.doc.nodeAt(pos);
			return found && found.type.name === SCIENCE_FENCE_TYPE ? found : null;
		};

		/** Writes the block: its source, and its language when the sheet changed it (SMILES drawn into SDF, made 3D). */
		const write = (next: { info: string; source: string }) => {
			const pos = getPos();
			const found = current();
			if (pos == null || !found) return;
			if (found.textContent === next.source && found.attrs.language === next.info) return;
			const replacement = found.type.create({ ...found.attrs, language: next.info }, next.source ? view.state.schema.text(next.source) : null);
			const tr = view.state.tr.replaceWith(pos, pos + found.nodeSize, replacement);
			view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
		};

		const selectBlock = () => {
			const pos = getPos();
			if (pos == null) return;
			const selection = view.state.selection;
			if (selection instanceof NodeSelection && selection.from === pos) return;
			view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta('addToHistory', false));
			view.focus();
		};

		/** A block left empty when its sheet closes goes, as an empty block does in Notion. */
		const closed = () => {
			sheet = null;
			dom.classList.remove('is-open');
			if (destroyed) return;
			const pos = getPos();
			const found = current();
			if (pos == null || !found) return;
			if (!found.textContent.trim()) {
				const paragraph = view.state.schema.nodes.paragraph;
				if (!paragraph) return;
				const tr = view.state.tr.replaceWith(pos, pos + found.nodeSize, paragraph.create());
				tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1), 1));
				view.dispatch(tr.scrollIntoView());
				view.focus();
				return;
			}
			selectBlock();
		};

		const open = (tab?: 'structure' | 'source') => {
			if (sheet?.isOpen()) return;
			const asked = takeNextTab();
			const wanted = tab ?? asked ?? (node.textContent.trim() ? 'structure' : 'source');
			sheet = openScienceSheet(
				{
					read: () => {
						const found = current();
						return found ? { info: String(found.attrs.language ?? ''), source: found.textContent } : null;
					},
					write,
					onClose: closed,
				},
				wanted,
			);
			if (sheet) dom.classList.add('is-open');
			// The block stays selected under its sheet; ProseMirror would draw a caret inside a node with no editable DOM.
			queueMicrotask(() => {
				const pos = getPos();
				if (pos == null || destroyed) return;
				const selection = view.state.selection;
				if (!(selection instanceof NodeSelection && selection.from === pos)) {
					view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta('addToHistory', false));
				}
			});
		};

		const caretInside = (pos: number, found: ProseMirrorNode): boolean => {
			const selection = view.state.selection;
			return selection instanceof TextSelection && selection.from > pos && selection.to < pos + found.nodeSize;
		};
		const sync = () => {
			const pos = getPos();
			const found = current();
			if (pos == null || !found) return;
			if (caretInside(pos, found)) open();
		};
		const unregister = trackScienceView(sync);

		caption.addEventListener('mousedown', (event) => {
			const button = event.target instanceof Element ? event.target.closest('button') : null;
			if (!button || !caption.contains(button)) return;
			event.preventDefault();
			event.stopPropagation();
			const pos = getPos();
			if (pos == null) return;
			if (button === menuButton) {
				ctx.get(blockMenuAPI.key).toggle(pos, menuButton);
				return;
			}
			open();
		});

		placeholder.addEventListener('mousedown', (event) => {
			if (event.button !== 0) return;
			event.preventDefault();
			open('source');
		});

		const onViewerControl = (target: EventTarget | null): boolean =>
			target instanceof Element && Boolean(target.closest('button, a, input, .chem-view-controls, .cube-controls'));

		let press: { x: number; y: number; spatial: boolean } | null = null;
		const spatialTarget = (target: EventTarget | null): boolean =>
			target instanceof Element && Boolean(target.closest('canvas, .chem-3d'));
		preview.addEventListener('mousedown', (event) => {
			if (event.button !== 0 || onViewerControl(event.target)) return;
			const spatial = spatialTarget(event.target);
			press = { x: event.clientX, y: event.clientY, spatial };
			if (spatial) return;
			event.preventDefault();
			selectBlock();
		});
		preview.addEventListener('mouseup', (event) => {
			const start = press;
			press = null;
			if (!start?.spatial || onViewerControl(event.target)) return;
			// A drag rotates the 3D view; only a still click selects the block.
			if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
			selectBlock();
		});
		preview.addEventListener('dblclick', (event) => {
			if (onViewerControl(event.target)) return;
			event.preventDefault();
			open();
		});

		return {
			dom,
			update: (updated: ProseMirrorNode) => {
				if (updated.type.name !== SCIENCE_FENCE_TYPE) return false;
				const changed = updated.textContent !== node.textContent || updated.attrs.language !== node.attrs.language;
				node = updated;
				dom.classList.toggle('is-empty', updated.textContent.length === 0);
				clearTimeout(timer);
				timer = setTimeout(() => render(updated), PREVIEW_DEBOUNCE_MS);
				// Undone, or changed on disk: the sheet shows it as it is now (its own writes it already shows).
				if (changed && sheet?.isOpen()) {
					sheet.redraw('structure');
					sheet.redraw('source');
				}
				return true;
			},
			// Without this ProseMirror would try to draw a caret inside a node with no editable DOM.
			setSelection: () => open(),
			destroy: () => {
				destroyed = true;
				clearTimeout(timer);
				sheet?.close();
				unregister();
			},
			// Renderers write SVG and canvases here; none of it is document content.
			ignoreMutation: () => true,
			stopEvent: (event) => {
				const target = event.target;
				if (!(target instanceof Node)) return false;
				return caption.contains(target) || preview.contains(target) || placeholder.contains(target);
			},
		};
	};
});

/** Register in `mountEditor` via `crepe.editor.use(...)`. */
export const scienceBlockPlugins = [
	...scienceBlockSchema,
	scienceBlockView,
	scienceBlockSelectionPlugin,
	scienceBlockKeys,
];
