/**
 * Floating source editor shared by display formulas and chemistry blocks.
 * The node view owns the document; this popup only owns the textarea,
 * an optional live preview, placement and the finish/remove keys.
 */

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
		this.place();
	}

	get value(): string {
		return this.input.value;
	}

	focus(): void {
		this.input.focus();
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
	};

	private onKeyDown = (event: KeyboardEvent): void => {
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
		if (this.root.contains(target) || this.options.owner.contains(target)) return;
		this.options.onDismiss();
	};
}
