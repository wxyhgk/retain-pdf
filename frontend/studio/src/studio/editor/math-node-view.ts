import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

import { renderMathHtml } from '../../science/rendering/index.ts';

type GetPosition = () => number | undefined;

export class MathNodeView implements NodeView {
	readonly dom: HTMLElement;
	private node: ProseMirrorNode;
	private readonly view: EditorView;
	private readonly getPos: GetPosition;
	private editing = false;
	private input: HTMLInputElement | HTMLTextAreaElement | null = null;

	constructor(node: ProseMirrorNode, view: EditorView, getPos: GetPosition) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.dom = document.createElement(node.type.name === 'math_block' ? 'div' : 'span');
		this.dom.className = `pm-math pm-${node.type.name.replace('_', '-')}`;
		this.dom.contentEditable = 'false';
		this.dom.title = '双击编辑 LaTeX';
		this.dom.addEventListener('dblclick', this.handleDoubleClick);
		this.dom.addEventListener('studio-edit-math', this.handleEditRequest);
		this.render();
	}

	private readonly handleDoubleClick = (event: MouseEvent): void => {
		event.preventDefault();
		this.startEditing();
	};

	private readonly handleEditRequest = (): void => {
		this.startEditing();
	};

	private startEditing(): void {
		if (this.editing) {
			this.input?.focus();
			return;
		}
		this.editing = true;
		this.dom.classList.add('editing');
		const input = this.node.type.name === 'math_block'
			? document.createElement('textarea')
			: document.createElement('input');
		input.className = 'pm-math-source';
		input.value = String(this.node.attrs.latex);
		input.setAttribute('aria-label', this.node.type.name === 'math_block' ? '块公式 LaTeX' : '行内公式 LaTeX');
		input.addEventListener('input', this.handleInput);
		input.addEventListener('keydown', this.handleKeyDown);
		input.addEventListener('blur', this.handleBlur);
		this.input = input;
		this.dom.replaceChildren(input);
		input.focus();
		input.select();
	}

	private readonly handleInput = (): void => {
		const position = this.getPos();
		if (position === undefined || !this.input) return;
		this.view.dispatch(this.view.state.tr.setNodeMarkup(position, undefined, {
			...this.node.attrs,
			latex: this.input.value,
		}));
	};

	private readonly handleKeyDown = (rawEvent: Event): void => {
		const event = rawEvent as KeyboardEvent;
		if (event.key === 'Escape' || (event.key === 'Enter' && this.node.type.name === 'math_inline')) {
			event.preventDefault();
			this.finishEditing();
			this.view.focus();
		}
	};

	private readonly handleBlur = (): void => {
		this.finishEditing();
	};

	private finishEditing(): void {
		if (!this.editing) return;
		this.editing = false;
		this.input = null;
		this.dom.classList.remove('editing');
		this.render();
	}

	private render(): void {
		const displayMode = this.node.type.name === 'math_block';
		const result = renderMathHtml(String(this.node.attrs.latex), displayMode);
		this.dom.innerHTML = result.html;
		this.dom.toggleAttribute('data-math-error', Boolean(result.error));
		this.dom.title = result.error ?? '双击编辑 LaTeX';
	}

	update(node: ProseMirrorNode): boolean {
		if (node.type !== this.node.type) return false;
		this.node = node;
		if (!this.editing) this.render();
		return true;
	}

	selectNode(): void {
		this.dom.classList.add('ProseMirror-selectednode');
		this.startEditing();
	}

	deselectNode(): void {
		this.dom.classList.remove('ProseMirror-selectednode');
	}

	stopEvent(event: Event): boolean {
		return event.target === this.input;
	}

	ignoreMutation(): boolean {
		return true;
	}

	destroy(): void {
		this.dom.removeEventListener('dblclick', this.handleDoubleClick);
		this.dom.removeEventListener('studio-edit-math', this.handleEditRequest);
	}
}
