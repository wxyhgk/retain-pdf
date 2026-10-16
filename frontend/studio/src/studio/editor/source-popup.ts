/**
 * Floating source editor shared by display formulas and chemistry blocks.
 * The node view owns the document; this popup only owns the textarea,
 * an optional live preview, placement and the finish/remove keys.
 */

import { applyCompletion, completionQuery, deleteBracePair, nextSlot, typeBrace, type LatexCommand, type LatexEdit } from './latex-assist.ts';
import { LatexCompletionMenu } from './latex-completion-menu.ts';

export type SourcePopupPlacement = 'over' | 'below';

type Box = { top: number; bottom: number; left: number; width: number };

const MARGIN = 12;
const GAP = 6;

/**
 * Where the popup goes. `over` covers the block (its own preview replaces
 * the hidden one); `below` keeps the block visible so it can render live.
 * Either way the popup flips above when it would leave the viewport.
 */
export function placeSourcePopup(
	anchor: Box,
	size: { width: number; height: number },
	viewport: { width: number; height: number },
	placement: SourcePopupPlacement,
): { left: number; top: number } {
	const left = Math.max(MARGIN, Math.min(anchor.left + anchor.width / 2 - size.width / 2, viewport.width - size.width - MARGIN));
	const below = placement === 'over' ? anchor.top : anchor.bottom + GAP;
	const above = placement === 'over' ? anchor.top - size.height : anchor.top - size.height - GAP;
	const overflows = below + size.height > viewport.height - MARGIN;
	if (overflows && above > MARGIN) return { left, top: above };
	if (placement === 'over' || !overflows) return { left, top: Math.max(MARGIN, below) };
	return { left, top: Math.max(MARGIN, viewport.height - size.height - MARGIN) };
}

export type SourcePopupAction = { label: string; title?: string; run: () => void };

export type SourcePopupOptions = {
	label: string;
	placeholder: string;
	value: string;
	rows: number;
	/** Extra class for per-block styling, e.g. `is-molecule`. */
	variant?: string;
	/** Short line above the input. */
	caption?: string;
	/** Buttons beside the caption, e.g. 画结构. */
	actions?: SourcePopupAction[];
	placement: SourcePopupPlacement;
	/** The block the popup belongs to. Clicks inside it do not dismiss. */
	owner: HTMLElement;
	anchor: () => DOMRect;
	width: (anchor: DOMRect) => number;
	maxInputHeight: () => number;
	preview?: (host: HTMLElement, value: string) => void;
	/** The source is LaTeX: complete commands, pair braces, Tab to the next `{}`. */
	latex?: boolean;
	onInput: (value: string) => void;
	/** Escape or Mod-Enter. */
	onFinish: () => void;
	/** Backspace in an empty input. */
	onRemove: () => void;
	/** Pointer down outside the popup and its block. */
	onDismiss: () => void;
};

export class SourcePopup {
	readonly root: HTMLElement;
	readonly input: HTMLTextAreaElement;
	private readonly preview: HTMLElement | null;
	private readonly options: SourcePopupOptions;
	private readonly scrollParent: HTMLElement | null;
	private readonly completion: LatexCompletionMenu | null;
	/** An edit of its own is being typed in: not something to complete. */
	private applying = false;

	constructor(options: SourcePopupOptions) {
		this.options = options;
		const root = document.createElement('div');
		root.className = 'pm-source-popup';
		if (options.variant) root.classList.add(options.variant);
		root.setAttribute('role', 'dialog');
		root.setAttribute('aria-label', options.label);
		if (options.caption || options.actions?.length) {
			const bar = document.createElement('div');
			bar.className = 'pm-source-popup-bar';
			const caption = document.createElement('span');
			caption.className = 'pm-source-popup-caption';
			caption.textContent = options.caption ?? '';
			bar.append(caption);
			for (const action of options.actions ?? []) {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'pm-source-popup-action';
				button.textContent = action.label;
				if (action.title) button.title = action.title;
				button.addEventListener('click', () => action.run());
				bar.append(button);
			}
			root.append(bar);
		}
		this.preview = options.preview ? document.createElement('div') : null;
		if (this.preview) {
			this.preview.className = 'pm-source-popup-preview';
			root.append(this.preview);
		}
		const input = document.createElement('textarea');
		input.className = 'pm-source-popup-input';
		input.rows = options.rows;
		input.spellcheck = false;
		input.placeholder = options.placeholder;
		input.setAttribute('aria-label', `${options.label}源码`);
		input.value = options.value;
		root.append(input);
		document.body.append(root);
		this.root = root;
		this.input = input;
		this.renderPreview();
		this.fitInput();
		this.scrollParent = options.owner.closest('.editor-scroll');
		this.scrollParent?.addEventListener('scroll', this.onPlace, { passive: true });
		window.addEventListener('resize', this.onPlace);
		document.addEventListener('pointerdown', this.onPointerDown, true);
		input.addEventListener('input', this.onInput);
		input.addEventListener('keydown', this.onKeyDown);
		this.completion = options.latex ? new LatexCompletionMenu((command) => this.complete(command)) : null;
		if (this.completion) {
			input.addEventListener('blur', this.onBlur);
			input.addEventListener('click', this.onCaretMoved);
			input.addEventListener('keyup', this.onCaretMoved);
		}
		this.place();
	}

	get value(): string {
		return this.input.value;
	}

	focus(): void {
		// The popup is placed where it shows; focusing it must not scroll the article.
		this.input.focus({ preventScroll: true });
		const end = this.input.value.length;
		this.input.setSelectionRange(end, end);
	}

	/** Follow a document change made elsewhere, such as undo. */
	setValue(value: string): void {
		if (this.input.value === value) return;
		this.input.value = value;
		this.renderPreview();
		this.fitInput();
		this.place();
	}

	contains(target: Node): boolean {
		return this.root.contains(target);
	}

	destroy(): void {
		document.removeEventListener('pointerdown', this.onPointerDown, true);
		this.scrollParent?.removeEventListener('scroll', this.onPlace);
		window.removeEventListener('resize', this.onPlace);
		this.completion?.destroy();
		this.root.remove();
	}

	place(): void {
		const anchor = this.options.anchor();
		const width = Math.min(this.options.width(anchor), window.innerWidth - MARGIN * 2);
		this.root.style.width = `${width}px`;
		const { left, top } = placeSourcePopup(
			anchor,
			{ width, height: this.root.offsetHeight },
			{ width: window.innerWidth, height: window.innerHeight },
			this.options.placement,
		);
		this.root.style.left = `${left}px`;
		this.root.style.top = `${top}px`;
	}

	private renderPreview(): void {
		if (this.preview) this.options.preview?.(this.preview, this.input.value);
	}

	private fitInput(): void {
		this.input.style.height = 'auto';
		this.input.style.height = `${Math.min(this.input.scrollHeight, this.options.maxInputHeight())}px`;
	}

	private onPlace = (): void => {
		this.place();
	};

	private onInput = (): void => {
		this.fitInput();
		this.renderPreview();
		this.options.onInput(this.input.value);
		this.place();
		if (!this.applying) this.offerCompletion();
	};

	/** Offers the commands that complete the one at the caret, under the field. */
	private offerCompletion(): void {
		const { input, completion } = this;
		if (!completion) return;
		const query = input.selectionStart === input.selectionEnd ? completionQuery(input.value, input.selectionStart) : null;
		if (!query) {
			completion.hide();
			return;
		}
		completion.show(query.prefix, () => {
			const box = input.getBoundingClientRect();
			return { left: box.left + 8, top: box.top, bottom: box.bottom };
		});
	}

	private onCaretMoved = (event: Event): void => {
		if (event instanceof KeyboardEvent && !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		this.offerCompletion();
	};

	private onBlur = (): void => {
		this.completion?.hide();
	};

	/** Types an edit in, as typing would: it can be undone. */
	private apply(edit: LatexEdit): void {
		const input = this.input;
		this.applying = true;
		try {
			input.setSelectionRange(edit.from, edit.to);
			if (edit.from !== edit.to || edit.insert) {
				const typed = edit.insert
					? document.execCommand('insertText', false, edit.insert)
					: document.execCommand('delete');
				if (!typed) {
					input.setRangeText(edit.insert, edit.from, edit.to, 'end');
					this.onInput();
				}
			}
			input.setSelectionRange(edit.caret, edit.caret);
		} finally {
			this.applying = false;
		}
	}

	private complete(command: LatexCommand): void {
		const input = this.input;
		const query = completionQuery(input.value, input.selectionStart);
		this.completion?.hide();
		if (query) this.apply(applyCompletion(input.value, query, command));
	}

	/** The keys of LaTeX typing help. Whether this one was taken. */
	private latexKey(event: KeyboardEvent): boolean {
		const { input, completion } = this;
		if (!completion || event.isComposing || event.altKey || event.metaKey || event.ctrlKey) return false;
		if (completion.open) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				completion.move(event.key === 'ArrowDown' ? 1 : -1);
				return true;
			}
			if (event.key === 'Escape') {
				completion.hide();
				return true;
			}
			const chosen = (event.key === 'Enter' && !event.shiftKey) || (event.key === 'Tab' && !event.shiftKey) ? completion.chosen() : null;
			if (chosen) {
				this.complete(chosen);
				return true;
			}
		}
		const { value, selectionStart: start, selectionEnd: end } = input;
		let edit: LatexEdit | null = null;
		if (event.key === '{' || event.key === '}') edit = typeBrace(value, start, end, event.key);
		else if (event.key === 'Backspace') edit = deleteBracePair(value, start, end);
		else if (event.key === 'Tab' && !event.shiftKey) {
			const slot = nextSlot(value, end) ?? value.length;
			input.setSelectionRange(slot, slot);
			return true;
		}
		if (!edit) return false;
		this.apply(edit);
		return true;
	}

	private onKeyDown = (event: KeyboardEvent): void => {
		if (this.latexKey(event)) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
			event.preventDefault();
			event.stopPropagation();
			this.options.onFinish();
			return;
		}
		const input = this.input;
		if (event.key === 'Backspace' && input.value === '' && input.selectionStart === 0 && input.selectionEnd === 0) {
			event.preventDefault();
			this.options.onRemove();
		}
	};

	private onPointerDown = (event: PointerEvent): void => {
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (this.root.contains(target) || this.options.owner.contains(target) || this.completion?.root.contains(target)) return;
		this.options.onDismiss();
	};
}
