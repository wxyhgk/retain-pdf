import { keymap } from '@milkdown/prose/keymap';
import { NodeSelection, Plugin, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import {
	SCIENCE_FENCE_TYPE,
	blockAt,
	scienceAttrs,
	scienceBlockMenuItems,
	type ScienceBlockAction,
} from './science-block.ts';

function focusInside(view: EditorView, cursor: number, recordHistory: boolean): void {
	const clamped = Math.max(0, Math.min(cursor, view.state.doc.content.size));
	let tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(clamped))).scrollIntoView();
	if (!recordHistory) tr = tr.setMeta('addToHistory', false);
	view.dispatch(tr);
	view.focus();
}

/**
 * Change only the selected block. Replacing the whole document would
 * remount every molecule viewer on the page.
 */
export function dispatchScienceAction(view: EditorView, action: ScienceBlockAction): void {
	const target = blockAt(view.state.doc, view.state.selection.from);
	if (!target) return;
	const { pos, node } = target;
	const science = view.state.schema.nodes[SCIENCE_FENCE_TYPE];
	if (action.type === 'edit') {
		if (node.type.name !== SCIENCE_FENCE_TYPE) return;
		focusInside(view, pos + node.nodeSize - 1, false);
		return;
	}
	if (action.type === 'delete') {
		let tr = view.state.tr;
		if (view.state.doc.childCount === 1) {
			const paragraph = view.state.schema.nodes.paragraph?.createAndFill();
			if (!paragraph) return;
			tr = tr.replaceWith(pos, pos + node.nodeSize, paragraph);
		} else {
			tr = tr.delete(pos, pos + node.nodeSize);
		}
		const cursor = Math.min(pos, tr.doc.content.size);
		tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursor))).scrollIntoView();
		view.dispatch(tr);
		view.focus();
		return;
	}
	if (!science) return;
	if (action.type === 'insert') {
		const at = pos + node.nodeSize;
		const tr = view.state.tr.insert(at, science.create({ language: action.info }));
		view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1))).scrollIntoView());
		view.focus();
		return;
	}
	if (node.type === science && node.attrs.language === action.info) return;
	const text = node.textContent;
	const created = science.create(scienceAttrs(node, action.info), text ? view.state.schema.text(text) : null);
	const tr = view.state.tr.replaceWith(pos, pos + node.nodeSize, created);
	view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1))).scrollIntoView());
	view.focus();
}

/**
 * Put the caret at the end of a science block without recording a history step.
 * The block's node view answers a caret inside it by opening the source popup.
 */
export function placeCursorInScienceBlock(view: EditorView, pos: number): void {
	const node = view.state.doc.nodeAt(pos);
	if (!node || node.type.name !== SCIENCE_FENCE_TYPE) return;
	const cursor = pos + node.nodeSize - 1;
	view.dispatch(
		view.state.tr
			.setSelection(TextSelection.create(view.state.doc, cursor))
			.setMeta('addToHistory', false)
			.scrollIntoView(),
	);
	view.focus();
}

class ScienceBlockMenu {
	readonly root: HTMLElement;
	readonly view: EditorView;
	private anchorPos: number | null = null;

	constructor(view: EditorView) {
		this.view = view;
		this.root = document.createElement('div');
		this.root.className = 'science-block-menu';
		this.root.hidden = true;
		this.root.setAttribute('role', 'menu');
		document.body.append(this.root);
		document.addEventListener('mousedown', this.onMouseDown, true);
		document.addEventListener('scroll', this.onScroll, true);
		window.addEventListener('keydown', this.onKeyDown, true);
	}

	get isOpen(): boolean {
		return this.anchorPos != null;
	}

	isOpenAt(pos: number): boolean {
		return this.anchorPos === pos;
	}

	/** Open next to the science block's own menu button. */
	show(anchor: HTMLElement): void {
		const selection = this.view.state.selection;
		if (!(selection instanceof NodeSelection)) return;
		this.render(selection.node.type.name, String(selection.node.attrs.language ?? ''));
		this.anchorPos = selection.from;
		this.root.hidden = false;
		const rect = anchor.getBoundingClientRect();
		const width = this.root.offsetWidth || 220;
		const height = this.root.offsetHeight || 280;
		let left = rect.right + 8;
		if (left + width > window.innerWidth - 8) left = Math.max(8, rect.left - width - 8);
		let top = rect.top;
		if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
		this.root.style.left = `${left}px`;
		this.root.style.top = `${top}px`;
		// Focus moves into the menu, as in any menu. While the editor kept it, the
		// browser's late report of the old caret could move the selection off the
		// block and close the menu again.
		this.root.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
	}

	close(): void {
		this.anchorPos = null;
		this.root.hidden = true;
		this.root.replaceChildren();
	}

	/** Close when the handle selection moves somewhere else. */
	sync(): void {
		if (this.anchorPos == null) return;
		const selection = this.view.state.selection;
		if (!(selection instanceof NodeSelection) || selection.from !== this.anchorPos) this.close();
	}

	destroy(): void {
		document.removeEventListener('mousedown', this.onMouseDown, true);
		document.removeEventListener('scroll', this.onScroll, true);
		window.removeEventListener('keydown', this.onKeyDown, true);
		this.root.remove();
	}

	private render(nodeName: string, info: string): void {
		this.root.replaceChildren();
		let section: string | null = null;
		for (const item of scienceBlockMenuItems(nodeName, info)) {
			if (item.section !== section) {
				section = item.section;
				if (section === '转换') {
					const heading = document.createElement('div');
					heading.className = 'science-block-menu-section';
					heading.textContent = '转换成';
					this.root.append(heading);
				}
			}
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'science-block-menu-item';
			button.dataset.id = item.id;
			button.textContent = item.label;
			button.setAttribute('role', 'menuitem');
			if (item.current) button.classList.add('is-current');
			if (item.action.type === 'delete') button.classList.add('is-danger');
			button.addEventListener('mousedown', (event) => {
				event.preventDefault();
				event.stopPropagation();
				const action = item.action;
				this.close();
				dispatchScienceAction(this.view, action);
			});
			this.root.append(button);
		}
	}

	private onMouseDown = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (this.root.contains(target)) return;
		if (target.closest('.science-block-caption')) return;
		if (this.isOpen) this.close();
	};

	private onScroll = (event: Event): void => {
		const target = event.target;
		if (target instanceof Node && this.root.contains(target)) return;
		if (this.isOpen) this.close();
	};

	private onKeyDown = (event: KeyboardEvent): void => {
		if (!this.isOpen) return;
		const buttons = [...this.root.querySelectorAll('button')];
		const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			this.close();
			this.view.focus();
			return;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			event.stopPropagation();
			const next = event.key === 'ArrowDown' ? Math.min(buttons.length - 1, current + 1) : Math.max(0, current - 1);
			buttons[next]?.focus();
		}
	};
}

let activeMenu: ScienceBlockMenu | null = null;

/** Toggle the block menu from a science block's ⋯ button. */
export function openScienceBlockMenu(view: EditorView, pos: number, anchor: HTMLElement): void {
	if (activeMenu?.isOpenAt(pos)) {
		activeMenu.close();
		return;
	}
	const node = view.state.doc.nodeAt(pos);
	if (!node || !NodeSelection.isSelectable(node)) return;
	const selection = view.state.selection;
	if (!(selection instanceof NodeSelection) || selection.from !== pos) {
		view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)).setMeta('addToHistory', false));
	}
	activeMenu?.show(anchor);
}

/** Hosts the science-block menu opened from the block's own ⋯ button. */
export const scienceBlockMenuPlugin = $prose(
	() =>
		new Plugin({
			view(editorView) {
				const menu = new ScienceBlockMenu(editorView);
				activeMenu = menu;
				return {
					update() {
						menu.sync();
					},
					destroy() {
						menu.destroy();
						if (activeMenu === menu) activeMenu = null;
					},
				};
			},
		}),
);

/** Enter on a selected science block opens its source popup. */
export const scienceBlockKeys = $prose(() =>
	keymap({
		Enter: (state, dispatch, view) => {
			const selection = state.selection;
			if (!(selection instanceof NodeSelection) || selection.node.type.name !== SCIENCE_FENCE_TYPE) return false;
			if (dispatch && view) placeCursorInScienceBlock(view, selection.from);
			return true;
		},
	}),
);
