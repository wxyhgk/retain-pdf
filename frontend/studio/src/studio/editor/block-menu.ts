import { keymap } from '@milkdown/prose/keymap';
import { Plugin, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import { blockActionItems, headingEnter, planBlockEdit, type BlockAction, type BlockEdit } from './block-actions.ts';
import { blockRangePlugin } from './block-range-drag.ts';
import { blockAt } from './science-block.ts';

let focusTitle: (() => void) | null = null;

/** ArrowUp at the start of the document moves into the title field. */
export function bindTitleFocus(handler: () => void): void {
	focusTitle = handler;
}

function dragHandleItem(target: Element): Element | null {
	const item = target.closest('.milkdown-block-handle .operation-item');
	if (!item?.parentElement) return null;
	if (item.parentElement.lastElementChild !== item) return null;
	return item;
}

function dispatchBlockEdit(view: EditorView, edit: BlockEdit): void {
	let tr = view.state.tr;
	tr = edit.nodes.length ? tr.replaceWith(edit.from, edit.to, edit.nodes) : tr.delete(edit.from, edit.to);
	const cursor = Math.max(0, Math.min(edit.cursor, tr.doc.content.size));
	tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursor))).scrollIntoView();
	view.dispatch(tr);
	view.focus();
}

export function dispatchBlockAction(view: EditorView, action: BlockAction): void {
	const target = blockAt(view.state.doc, view.state.selection.from);
	if (!target) return;
	const edit = planBlockEdit(view.state.doc, target.pos, action);
	if (!edit) return;
	dispatchBlockEdit(view, edit);
}

class BlockMenu {
	readonly root: HTMLElement;
	readonly view: EditorView;
	private anchorPos: number | null = null;
	private press: { x: number; y: number } | null = null;

	constructor(view: EditorView) {
		this.view = view;
		this.root = document.createElement('div');
		this.root.className = 'block-menu';
		this.root.hidden = true;
		this.root.setAttribute('role', 'menu');
		document.body.append(this.root);
		document.addEventListener('mousedown', this.onMouseDown, true);
		document.addEventListener('mouseup', this.onMouseUp, true);
		document.addEventListener('scroll', this.onScroll, true);
		window.addEventListener('keydown', this.onKeyDown, true);
	}

	destroy(): void {
		document.removeEventListener('mousedown', this.onMouseDown, true);
		document.removeEventListener('mouseup', this.onMouseUp, true);
		document.removeEventListener('scroll', this.onScroll, true);
		window.removeEventListener('keydown', this.onKeyDown, true);
		this.root.remove();
	}

	private show(anchor: HTMLElement): void {
		const target = blockAt(this.view.state.doc, this.view.state.selection.from);
		if (!target) return;
		this.render(target.node);
		this.anchorPos = target.pos;
		this.root.hidden = false;
		const rect = anchor.getBoundingClientRect();
		const width = this.root.offsetWidth || 220;
		const height = this.root.offsetHeight || 320;
		let left = rect.right + 8;
		if (left + width > window.innerWidth - 8) left = Math.max(8, rect.left - width - 8);
		let top = rect.top;
		if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
		this.root.style.left = `${left}px`;
		this.root.style.top = `${top}px`;
	}

	private close(): void {
		this.anchorPos = null;
		this.root.hidden = true;
		this.root.replaceChildren();
	}

	/** Close once the selection leaves the block the menu was opened for. */
	sync(): void {
		if (this.anchorPos == null) return;
		const block = blockAt(this.view.state.doc, this.view.state.selection.from);
		if (!block || block.pos !== this.anchorPos) this.close();
	}

	private render(node: Parameters<typeof blockActionItems>[0]): void {
		this.root.replaceChildren();
		let section: string | null = null;
		for (const item of blockActionItems(node)) {
			if (item.section === '转换成' && section !== '转换成') {
				const heading = document.createElement('div');
				heading.className = 'block-menu-section';
				heading.textContent = '转换成';
				this.root.append(heading);
			}
			section = item.section;
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'block-menu-item';
			if (item.current) button.classList.add('is-current');
			if (item.danger) button.classList.add('is-danger');
			button.dataset.id = item.id;
			button.textContent = item.label;
			button.setAttribute('role', 'menuitem');
			button.addEventListener('mousedown', (event) => {
				event.preventDefault();
				event.stopPropagation();
				const action = item.action;
				this.close();
				dispatchBlockAction(this.view, action);
			});
			this.root.append(button);
		}
	}

	private onMouseDown = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (this.root.contains(target)) return;
		const handle = dragHandleItem(target);
		if (handle && this.view.dom.parentElement?.contains(handle)) {
			this.press = { x: event.clientX, y: event.clientY };
			return;
		}
		if (this.anchorPos != null) this.close();
	};

	private onMouseUp = (event: MouseEvent): void => {
		const press = this.press;
		this.press = null;
		if (!press) return;
		if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) return;
		const target = event.target;
		if (!(target instanceof Element)) return;
		const handle = dragHandleItem(target);
		if (!handle) return;
		const selection = this.view.state.selection;
		const block = blockAt(this.view.state.doc, selection.from);
		if (!block) return;
		if (this.anchorPos === block.pos) this.close();
		else this.show(handle);
	};

	private onScroll = (event: Event): void => {
		const target = event.target;
		if (target instanceof Node && this.root.contains(target)) return;
		if (this.anchorPos != null) this.close();
	};

	private onKeyDown = (event: KeyboardEvent): void => {
		if (this.anchorPos == null || event.isComposing) return;
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
			return;
		}
		if (event.key === 'Enter' && current >= 0) {
			event.preventDefault();
			event.stopPropagation();
			buttons[current]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
			return;
		}
		// The handle click selects the whole block. A letter would replace it.
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		event.preventDefault();
		event.stopPropagation();
	};
}

/** The drag handle opens this menu. Moving the pointer still drags the block. */
export const blockMenuPlugin = $prose(
	() =>
		new Plugin({
			view(editorView) {
				const menu = new BlockMenu(editorView);
				return {
					update: () => menu.sync(),
					destroy: () => menu.destroy(),
				};
			},
		}),
);

export const writingKeymap = $prose(() =>
	keymap({
		Enter: headingEnter,
		ArrowUp: (state) => {
			if (!focusTitle) return false;
			const selection = state.selection;
			if (!(selection instanceof TextSelection) || !selection.empty) return false;
			if (selection.from !== TextSelection.atStart(state.doc).from) return false;
			focusTitle();
			return true;
		},
	}),
);

export const blockFeelPlugins = [blockRangePlugin, blockMenuPlugin, writingKeymap];
