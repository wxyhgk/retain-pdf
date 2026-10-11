import { $node, $prose, $remark, $view } from '@milkdown/utils';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { addBlockTypeCommand, clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import { NodeSelection, Plugin, TextSelection } from '@milkdown/prose/state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

import { createSciencePreview } from '../../science/browser/science-renderer.ts';
import {
	dispatchScienceAction,
	openScienceBlockMenu,
	placeCursorInScienceBlock,
	scienceBlockKeys,
	scienceBlockMenuPlugin,
} from './science-block-menu.ts';
import {
	SCIENCE_BLOCK_KINDS,
	SCIENCE_FENCE_TYPE,
	parseScienceFence,
	planScienceBlockConversion,
	runScienceBlockParse,
	runScienceBlockSerialize,
	scienceBlockKindLabel,
	scienceBlockSurface,
	scienceRetag,
} from './science-block.ts';

/**
 * Science fenced-code blocks as a first-class Crepe node.
 * Thin Milkdown glue over `./science-block.ts`, which owns recognition,
 * byte fidelity and conversion planning (all Node-tested there).
 *
 * Two creation paths, both deterministic:
 * - loaded/pasted Markdown: `scienceBlockRemark` retags scientific fences
 *   before Milkdown's generic `code` rule can claim them;
 * - typed mid-session: `scienceBlockSync` converts preset `code_block`
 *   nodes carrying scientific languages right after the transaction.
 * Either way `getMarkdown()` emits a plain fence via `toMarkdown`.
 */
export const scienceBlockSchema = $node(SCIENCE_FENCE_TYPE, () => ({
	content: 'text*',
	group: 'block',
	code: true,
	defining: true,
	isolating: true,
	marks: '',
	attrs: { info: { default: '' } },
	parseDOM: [
		{
			tag: 'pre[data-science-block]',
			preserveWhitespace: 'full',
			getAttrs: (dom: HTMLElement) => ({ info: dom.getAttribute('data-language') ?? '' }),
		},
	],
	toDOM: (node: ProseMirrorNode) => [
		'pre',
		{ 'data-science-block': '', 'data-language': node.attrs.info as string },
		['code', 0],
	],
	parseMarkdown: {
		match: (node) => node.type === SCIENCE_FENCE_TYPE,
		runner: (state, node, type) => runScienceBlockParse(state, node, type),
	},
	toMarkdown: {
		match: (node) => node.type.name === SCIENCE_FENCE_TYPE,
		runner: (state, node) => runScienceBlockSerialize(state, node),
	},
}));

const PREVIEW_DEBOUNCE_MS = 350;
const scienceSurfaces = new Set<() => void>();

function trackScienceSurface(sync: () => void): () => void {
	scienceSurfaces.add(sync);
	return () => {
		scienceSurfaces.delete(sync);
	};
}

/** Selection changes do not call NodeView.update, so surfaces refresh from here. */
export const scienceBlockSurfacePlugin = $prose(
	() =>
		new Plugin({
			view() {
				return {
					update() {
						for (const sync of scienceSurfaces) sync();
					},
				};
			},
		}),
);

export const scienceBlockView = $view(scienceBlockSchema, () => {
	return (initial: ProseMirrorNode, view: EditorView, getPos: () => number | undefined): NodeView => {
		const dom = document.createElement('div');
		dom.className = 'science-block';
		dom.dataset.surface = scienceBlockSurface(initial.textContent, false);
		const caption = document.createElement('div');
		caption.className = 'science-block-caption';
		const kind = document.createElement('span');
		kind.className = 'science-block-kind';
		kind.textContent = scienceBlockKindLabel(String(initial.attrs.info ?? ''));
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
		const compose = document.createElement('div');
		compose.className = 'science-block-compose';
		const placeholder = document.createElement('div');
		placeholder.className = 'science-block-placeholder';
		placeholder.textContent = `输入 ${kind.textContent}，或 @file ./assets/…`;
		const source = document.createElement('div');
		source.className = 'science-block-source';
		source.spellcheck = false;
		compose.append(placeholder, source);
		dom.append(caption, preview, compose);
		dom.classList.toggle('is-empty', initial.textContent.length === 0);

		let timer: ReturnType<typeof setTimeout> | undefined;
		let renderedKey: string | null = null;
		const render = (current: ProseMirrorNode) => {
			const info = String(current.attrs.info ?? '');
			const key = `${info}\n${current.textContent}`;
			// Steady-state renders must not touch the DOM: any write here is
			// observed by ProseMirror and schedules another update, which would
			// destroy in-flight previews and spin forever.
			if (key === renderedKey) return;
			renderedKey = key;
			const label = scienceBlockKindLabel(info);
			if (kind.textContent !== label) kind.textContent = label;
			const hint = `输入 ${label}，或 @file ./assets/…`;
			if (placeholder.textContent !== hint) placeholder.textContent = hint;
			preview.replaceChildren();
			if (!current.textContent) return;
			const descriptor = parseScienceFence(info, current.textContent);
			if (!descriptor?.block) return;
			const element = createSciencePreview(descriptor.block.language, descriptor.source);
			if (element) preview.append(element);
			else {
				const fallback = document.createElement('p');
				fallback.className = 'science-block-fallback';
				fallback.textContent = '无法预览这段结构';
				preview.append(fallback);
			}
		};
		render(initial);

		const editingAt = (pos: number, node: ProseMirrorNode): boolean => {
			const selection = view.state.selection;
			return (
				selection instanceof TextSelection &&
				selection.from >= pos + 1 &&
				selection.to <= pos + node.nodeSize - 1
			);
		};

		const sync = () => {
			const pos = getPos();
			if (pos == null) return;
			const current = view.state.doc.nodeAt(pos);
			if (!current || current.type.name !== SCIENCE_FENCE_TYPE) return;
			const editing = editingAt(pos, current);
			const surface = scienceBlockSurface(current.textContent, editing);
			if (dom.dataset.surface !== surface) dom.dataset.surface = surface;
			dom.classList.toggle('is-empty', current.textContent.length === 0);
			dom.classList.toggle('is-editing', editing);
			editButton.hidden = surface === 'compose' && !editing;
			editButton.textContent = editing ? '完成' : '编辑';
		};
		const unregister = trackScienceSurface(sync);

		const enterEdit = () => {
			const pos = getPos();
			if (pos == null) return;
			dom.dataset.surface = 'compose';
			placeCursorInScienceBlock(view, pos);
		};

		const exitEdit = () => {
			const pos = getPos();
			if (pos == null) return;
			const node = view.state.doc.nodeAt(pos);
			if (!node) return;
			const after = pos + node.nodeSize;
			const tr = view.state.doc.resolve(after).nodeAfter
				? view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(after), 1))
				: view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos));
			view.dispatch(tr.setMeta('addToHistory', false).scrollIntoView());
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
				openScienceBlockMenu(view, pos, menuButton);
				return;
			}
			if (dom.classList.contains('is-editing')) exitEdit();
			else enterEdit();
		});

		const onViewerControl = (target: EventTarget | null): boolean =>
			target instanceof Element && Boolean(target.closest('button, a, input, .chem-view-controls, .cube-controls'));

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

		let press: { x: number; y: number; spatial: boolean } | null = null;
		const spatialTarget = (target: EventTarget | null): boolean =>
			target instanceof Element && Boolean(target.closest('canvas, .chem-3d'));
		preview.addEventListener('mousedown', (event) => {
			if (dom.dataset.surface !== 'preview' || onViewerControl(event.target)) return;
			const spatial = spatialTarget(event.target);
			press = { x: event.clientX, y: event.clientY, spatial };
			if (spatial) return;
			event.preventDefault();
			selectBlock();
		});
		preview.addEventListener('mouseup', (event) => {
			const start = press;
			press = null;
			if (!start?.spatial || dom.dataset.surface !== 'preview' || onViewerControl(event.target)) return;
			if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
			selectBlock();
		});
		preview.addEventListener('dblclick', (event) => {
			if (onViewerControl(event.target)) return;
			event.preventDefault();
			enterEdit();
		});

		return {
			dom,
			contentDOM: source,
			update: (updated: ProseMirrorNode) => {
				if (updated.type.name !== SCIENCE_FENCE_TYPE) return false;
				clearTimeout(timer);
				timer = setTimeout(() => render(updated), PREVIEW_DEBOUNCE_MS);
				sync();
				return true;
			},
			destroy: () => {
				clearTimeout(timer);
				unregister();
			},
			// The molecule view, caption and placeholder sit outside contentDOM.
			// Ignoring them keeps ProseMirror from recreating the view while a
			// renderer writes SVG or a canvas. Source edits still count.
			ignoreMutation: (mutation) =>
				mutation.type !== 'selection' && !source.contains(mutation.target as Node),
			stopEvent: (event) => {
				const target = event.target;
				if (!(target instanceof Node)) return false;
				return caption.contains(target) || preview.contains(target) || placeholder.contains(target);
			},
		};
	};
});

export const scienceBlockRemark = $remark('science-block-retag', () => scienceRetag());

export const scienceBlockSync = $prose(
	() =>
		new Plugin({
			appendTransaction(_transactions, _oldState, state) {
				const scienceType = state.schema.nodes[SCIENCE_FENCE_TYPE];
				if (!scienceType) return null;
				const conversions = planScienceBlockConversion(state.doc);
				if (!conversions.length) return null;
				const first = conversions[0];
				return state.tr.replaceWith(
					first.pos,
					first.end,
					scienceType.create({ info: first.info }, state.schema.text(first.text)),
				);
			},
		}),
);

/** Register in `mountEditor` via `crepe.editor.use(...)`. */
export const scienceBlockPlugins = [
	scienceBlockRemark,
	scienceBlockSchema,
	scienceBlockView,
	scienceBlockSync,
	scienceBlockSurfacePlugin,
	scienceBlockMenuPlugin,
	scienceBlockKeys,
];

/** Slash menu entries: one insert per scientific fence language, plus delete. */
export const SCIENCE_SLASH_LANGUAGES = SCIENCE_BLOCK_KINDS.map((kind) => ({
	key: kind.key,
	label: `化学 ${kind.label}`,
	info: kind.info,
}));

const scienceSlashIcon =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"' +
	' fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6M10 3v5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V3"/></svg>';

type SlashMenuBuilder = {
	addGroup: (
		key: string,
		label: string,
	) => {
		addItem: (
			key: string,
			item: { label: string; icon: string; onRun: (ctx: never) => void },
		) => unknown;
	};
};

/** Append the chemistry group to Crepe's slash menu (used via `BlockEdit.buildMenu`). */
export function buildScienceSlashMenu(builder: SlashMenuBuilder): void {
	const group = builder.addGroup('science', '化学');
	for (const entry of SCIENCE_SLASH_LANGUAGES) {
		group.addItem(entry.key, {
			label: entry.label,
			icon: scienceSlashIcon,
			onRun: (ctx) => {
				const context = ctx as { get: (slice: unknown) => never };
				const commands = context.get(commandsCtx) as {
					call: (key: unknown, payload?: unknown) => void;
				};
				const nodeType = scienceBlockSchema.type(
					ctx as Parameters<typeof scienceBlockSchema.type>[0],
				);
				commands.call(clearTextInCurrentBlockCommand.key);
				commands.call(addBlockTypeCommand.key, { nodeType, attrs: { info: entry.info } });
				const editorView = context.get(editorViewCtx) as EditorView;
				if (editorView.state.selection.$from.parent.type.name === SCIENCE_FENCE_TYPE) return;
				const origin = editorView.state.selection.from;
				let found: number | null = null;
				editorView.state.doc.descendants((node, pos) => {
					if (node.type.name !== SCIENCE_FENCE_TYPE || node.content.size !== 0) return;
					if (found == null || Math.abs(pos - origin) < Math.abs(found - origin)) found = pos;
				});
				if (found != null) placeCursorInScienceBlock(editorView, found);
			},
		});
	}
	group.addItem('delete', {
		label: '删除当前块',
		icon: scienceSlashIcon,
		onRun: (ctx) => {
			const editorView = (ctx as { get: (slice: unknown) => EditorView }).get(editorViewCtx);
			dispatchScienceAction(editorView, { type: 'delete' });
		},
	});
}
