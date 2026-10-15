import { $prose, $view } from '@milkdown/utils';
import { blockMenuAPI } from '@milkdown/crepe/feature/block-edit';
import { $fencedBlock } from '@milkdown/kit/preset/commonmark';
import { NodeSelection, Plugin, TextSelection } from '@milkdown/prose/state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

import { createSciencePreview, hydrateSciencePreviews } from '../../science/browser/science-renderer.ts';
import { isMoleculeLanguage } from '../../science/parsers/molecule-block.ts';
import { scienceBlockKeys } from './science-block-menu.ts';
import {
	SCIENCE_FENCE_TYPE,
	parseScienceFence,
	scienceBlockKindLabel,
	scienceSourceEditor,
	structureDrawing,
} from './science-block.ts';
import { SourcePopup } from './source-popup.ts';
import { drawStructure, type DrawnStructure } from './structure-editor.ts';

/**
 * Science fenced-code blocks as a first-class Crepe node.
 * Thin Milkdown glue over `./science-block.ts`, which owns recognition and
 * the block menu's edits (all Node-tested there).
 *
 * `$fencedBlock` (the Milkdown fork) gives every fence in a scientific
 * language this node, whether loaded, pasted, typed as ```smiles or given
 * the language later, and writes it back as the same fence, meta and fence
 * characters included.
 */
export const scienceBlockSchema = $fencedBlock(SCIENCE_FENCE_TYPE, isMoleculeLanguage, () => ({
	// The source is edited in a popup, never in place: the block is one unit. Without
	// this a selection read back from the DOM lands in a paragraph nearby instead of
	// on the block, which drops the block menu and the popup the moment it happens.
	atom: true,
	isolating: true,
}));

const PREVIEW_DEBOUNCE_MS = 350;
const POPUP_PREVIEW_DEBOUNCE_MS = 200;
/** Multi-line sources can be megabytes; batch keystrokes before rewriting the node. */
const SOURCE_WRITE_DEBOUNCE_MS = 250;
const scienceViews = new Set<() => void>();

function trackScienceView(sync: () => void): () => void {
	scienceViews.add(sync);
	return () => {
		scienceViews.delete(sync);
	};
}

/** Selection changes do not call NodeView.update, so popups open and close from here. */
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
 * The block always rests on its rendered molecule. Click selects it. Double
 * click opens a 2D structure (SMILES, flat SDF) in the structure editor, and
 * anything else in the source popup. Enter, 编辑 and any command that puts
 * the caret inside the node (slash insert, the menu's 编辑源码) open the
 * source popup, which offers 画结构 when the editor can draw the block.
 */
export const scienceBlockView = $view(scienceBlockSchema.schema.node, (ctx) => {
	return (initial: ProseMirrorNode, view: EditorView, getPos: () => number | undefined): NodeView => {
		let node = initial;
		const dom = document.createElement('div');
		dom.className = 'science-block';
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

		let popup: SourcePopup | null = null;
		let writing = false;
		let pendingWrite: ReturnType<typeof setTimeout> | undefined;
		let popupPreviewTimer: ReturnType<typeof setTimeout> | undefined;

		const caretInside = (pos: number, current: ProseMirrorNode): boolean => {
			const selection = view.state.selection;
			return selection instanceof TextSelection && selection.from > pos && selection.to < pos + current.nodeSize;
		};

		const writeSource = (value: string, select: boolean, info?: string) => {
			const pos = getPos();
			if (pos == null) return;
			const current = view.state.doc.nodeAt(pos);
			if (!current || current.type.name !== SCIENCE_FENCE_TYPE) return;
			const attrs = info === undefined ? current.attrs : { ...current.attrs, language: info };
			if (current.textContent === value && attrs.language === current.attrs.language) return;
			const next = current.type.create(attrs, value ? view.state.schema.text(value) : null);
			let tr = view.state.tr.replaceWith(pos, pos + current.nodeSize, next);
			if (select) tr = tr.setSelection(NodeSelection.create(tr.doc, pos));
			writing = true;
			try {
				view.dispatch(tr);
			} finally {
				writing = false;
			}
		};

		/** `deferWrite` when closing from inside a view update, where dispatching is not allowed. */
		const close = (deferWrite = false) => {
			if (!popup) return;
			const value = popup.value;
			const pending = pendingWrite !== undefined;
			clearTimeout(pendingWrite);
			pendingWrite = undefined;
			clearTimeout(popupPreviewTimer);
			popup.destroy();
			popup = null;
			dom.classList.remove('is-open', 'is-inline-source');
			editButton.textContent = '编辑';
			if (!pending) return;
			if (deferWrite) queueMicrotask(() => writeSource(value, false));
			else writeSource(value, false);
		};

		const finish = () => {
			close();
			const pos = getPos();
			if (pos == null) return;
			const current = view.state.doc.nodeAt(pos);
			if (!current) return;
			const after = pos + current.nodeSize;
			const next = view.state.doc.resolve(after).nodeAfter;
			// Never land in the next science block or formula: that would open its popup.
			const selection =
				next?.isTextblock && !next.type.spec.code
					? TextSelection.create(view.state.doc, after + 1)
					: NodeSelection.create(view.state.doc, pos);
			view.dispatch(view.state.tr.setSelection(selection).setMeta('addToHistory', false).scrollIntoView());
			view.focus();
		};

		const remove = () => {
			clearTimeout(pendingWrite);
			pendingWrite = undefined;
			close();
			const pos = getPos();
			if (pos == null) return;
			const current = view.state.doc.nodeAt(pos);
			const paragraph = view.state.schema.nodes.paragraph;
			if (!current || !paragraph) return;
			const tr = view.state.tr.replaceWith(pos, pos + current.nodeSize, paragraph.create());
			tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1), 1));
			view.dispatch(tr.scrollIntoView());
			view.focus();
		};

		const previewInPopup = (host: HTMLElement, value: string) => {
			clearTimeout(popupPreviewTimer);
			const paint = () => {
				const source = value.trim();
				host.classList.toggle('is-empty', !source);
				if (!source) {
					host.textContent = '预览';
					return;
				}
				paintMolecule(host, String(node.attrs.language ?? ''), source);
				hydrateSciencePreviews(host);
			};
			if (!host.hasChildNodes()) paint();
			else popupPreviewTimer = setTimeout(paint, POPUP_PREVIEW_DEBOUNCE_MS);
		};

		/** Draw in the structure editor, from the popup's text when it is open, and write what was saved back into the block. */
		const draw = async () => {
			const info = String(node.attrs.language ?? '');
			const source = popup ? popup.value : node.textContent;
			const form = structureDrawing(info, source);
			if (!form) {
				window.alert('这段内容带三维坐标或引用了文件，二维结构编辑器画不了。');
				return;
			}
			close();
			let drawn: DrawnStructure | null;
			try {
				drawn = await drawStructure(form, info, source, `画结构：${scienceBlockKindLabel(info)}`);
			} catch (error) {
				window.alert(error instanceof Error ? error.message : String(error));
				return;
			}
			if (drawn) writeSource(drawn.source, true, drawn.info);
			else selectBlock();
			view.focus();
		};

		const open = () => {
			if (popup) return;
			const info = String(node.attrs.language ?? '');
			const editor = scienceSourceEditor(info);
			const drawable = structureDrawing(info, node.textContent) !== null;
			popup = new SourcePopup({
				label: `${editor.label} 结构`,
				placeholder: editor.placeholder,
				value: node.textContent,
				rows: editor.inline ? 2 : 8,
				variant: editor.inline ? 'is-molecule-inline' : 'is-molecule',
				caption: `${editor.label} · Esc 完成`,
				actions: drawable ? [{ label: '画结构', title: '在结构编辑器里画', run: () => void draw() }] : undefined,
				placement: editor.inline ? 'over' : 'below',
				owner: dom,
				anchor: () => dom.getBoundingClientRect(),
				width: (anchor) => (editor.inline ? 440 : Math.min(720, Math.max(anchor.width, 520))),
				maxInputHeight: () => (editor.inline ? 160 : Math.max(160, Math.min(420, window.innerHeight * 0.45))),
				preview: editor.inline ? previewInPopup : undefined,
				onInput: (value) => {
					if (editor.inline) {
						writeSource(value, true);
						return;
					}
					clearTimeout(pendingWrite);
					pendingWrite = setTimeout(() => {
						pendingWrite = undefined;
						writeSource(value, true);
					}, SOURCE_WRITE_DEBOUNCE_MS);
				},
				onFinish: finish,
				onRemove: remove,
				onDismiss: () => close(),
			});
			// Focus leaves the editor before anything in it changes. While the editor held
			// focus, ProseMirror would re-read the browser's selection on the next DOM
			// change and could move it off this block, which closes the popup at once.
			popup.focus();
			dom.classList.add('is-open');
			dom.classList.toggle('is-inline-source', editor.inline);
			editButton.textContent = '完成';
			// Opening can happen inside a view update; select the block once it settles.
			queueMicrotask(() => {
				const pos = getPos();
				if (!popup || pos == null) return;
				const selection = view.state.selection;
				if (!(selection instanceof NodeSelection) || selection.from !== pos) {
					view.dispatch(
						view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta('addToHistory', false),
					);
				}
				popup?.focus();
			});
		};

		const sync = () => {
			const pos = getPos();
			if (pos == null) return;
			const current = view.state.doc.nodeAt(pos);
			if (!current || current.type.name !== SCIENCE_FENCE_TYPE) return;
			if (caretInside(pos, current)) {
				open();
				return;
			}
			const selection = view.state.selection;
			if (popup && !(selection instanceof NodeSelection && selection.from === pos)) close(true);
		};
		const unregister = trackScienceView(sync);

		const selectBlock = () => {
			const pos = getPos();
			if (pos == null) return;
			const selection = view.state.selection;
			if (selection instanceof NodeSelection && selection.from === pos) return;
			view.dispatch(
				view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta('addToHistory', false),
			);
			view.focus();
		};

		caption.addEventListener('mousedown', (event) => {
			const button = event.target instanceof Element ? event.target.closest('button') : null;
			if (!button || !caption.contains(button)) return;
			event.preventDefault();
			event.stopPropagation();
			const pos = getPos();
			if (pos == null) return;
			if (button === menuButton) {
				close();
				ctx.get(blockMenuAPI.key).toggle(pos, menuButton);
				return;
			}
			if (popup) finish();
			else open();
		});

		placeholder.addEventListener('mousedown', (event) => {
			if (event.button !== 0) return;
			event.preventDefault();
			open();
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
			// A 2D structure opens straight in the structure editor; anything else edits as text.
			if (structureDrawing(String(node.attrs.language ?? ''), node.textContent)) void draw();
			else open();
		});

		return {
			dom,
			update: (updated: ProseMirrorNode) => {
				if (updated.type.name !== SCIENCE_FENCE_TYPE) return false;
				node = updated;
				dom.classList.toggle('is-empty', updated.textContent.length === 0);
				clearTimeout(timer);
				timer = setTimeout(() => render(updated), PREVIEW_DEBOUNCE_MS);
				// Follow undo or other outside edits, never our own pending keystrokes.
				if (!writing && pendingWrite === undefined) popup?.setValue(updated.textContent);
				return true;
			},
			// Without this ProseMirror would try to draw a caret inside a node with no editable DOM.
			setSelection: () => open(),
			destroy: () => {
				clearTimeout(timer);
				clearTimeout(pendingWrite);
				clearTimeout(popupPreviewTimer);
				popup?.destroy();
				popup = null;
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
