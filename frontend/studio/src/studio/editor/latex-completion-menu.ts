import { currentMacros, renderMathHtml } from '../../science/rendering/math.ts';
import { completeLatex, latexCommands, type LatexCommand } from './latex-assist.ts';

type Caret = { left: number; top: number; bottom: number };

/**
 * The list of commands that complete what is typed after a backslash, each
 * with what it draws. It floats under the caret; the field it serves keeps
 * the focus and sends it the keys (`move`, `chosen`).
 */
export class LatexCompletionMenu {
	readonly root: HTMLElement;
	private items: LatexCommand[] = [];
	private index = 0;
	private readonly pick: (command: LatexCommand) => void;
	/** Where the caret is now: it moves with scrolling and with the editor's own scroll to the caret. */
	private caret: (() => Caret) | null = null;
	private frame = 0;

	constructor(pick: (command: LatexCommand) => void) {
		this.pick = pick;
		this.root = document.createElement('div');
		this.root.className = 'latex-completion';
		this.root.setAttribute('role', 'listbox');
		this.root.setAttribute('aria-label', 'LaTeX 命令');
		this.root.hidden = true;
		// The field keeps the focus; a click picks.
		this.root.addEventListener('mousedown', (event) => {
			event.preventDefault();
			const row = (event.target as Element).closest<HTMLElement>('[data-index]');
			if (row) this.pick(this.items[Number(row.dataset.index)]);
		});
		document.body.append(this.root);
		window.addEventListener('scroll', this.follow, true);
		window.addEventListener('resize', this.follow);
	}

	get open(): boolean {
		return !this.root.hidden;
	}

	/**
	 * Offers the commands that complete `prefix`, under the caret (`caret`
	 * says where it is in the viewport); hides when there are none.
	 */
	show(prefix: string, caret: () => Caret): void {
		const items = completeLatex(prefix, latexCommands(currentMacros()));
		if (!items.length) {
			this.hide();
			return;
		}
		const same = items.length === this.items.length && items.every((item, at) => item.name === this.items[at].name);
		this.items = items;
		if (!same) {
			this.index = 0;
			this.draw();
		}
		// Unseen until placed, so it does not flash where it last was.
		if (!this.open) this.root.style.visibility = 'hidden';
		this.root.hidden = false;
		this.caret = caret;
		this.follow();
	}

	hide(): void {
		this.root.hidden = true;
		this.items = [];
		this.caret = null;
	}

	/** ↑ or ↓. */
	move(delta: number): void {
		if (!this.items.length) return;
		this.index = (this.index + delta + this.items.length) % this.items.length;
		this.mark();
	}

	/** What Enter or Tab takes. */
	chosen(): LatexCommand | null {
		return this.items[this.index] ?? null;
	}

	destroy(): void {
		window.removeEventListener('scroll', this.follow, true);
		window.removeEventListener('resize', this.follow);
		cancelAnimationFrame(this.frame);
		this.root.remove();
	}

	/** Placed once the page has settled, after the editor scrolls to the caret. */
	private follow = (): void => {
		cancelAnimationFrame(this.frame);
		this.frame = requestAnimationFrame(() => {
			if (this.open && this.caret) this.place(this.caret());
		});
	};

	private draw(): void {
		this.root.replaceChildren(...this.items.map((item, at) => {
			const row = document.createElement('div');
			row.className = 'latex-completion-item';
			row.setAttribute('role', 'option');
			row.dataset.index = String(at);
			const name = document.createElement('span');
			name.className = 'latex-completion-name';
			name.textContent = item.name;
			const drawn = document.createElement('span');
			drawn.className = 'latex-completion-preview';
			if (item.preview) {
				const { html, error } = renderMathHtml(item.preview, false);
				if (!error) drawn.innerHTML = html;
				drawn.querySelectorAll('.katex-mathml').forEach((node) => node.remove());
			}
			row.append(name, drawn);
			return row;
		}));
		this.mark();
	}

	private mark(): void {
		this.root.querySelectorAll<HTMLElement>('.latex-completion-item').forEach((row, at) => {
			const selected = at === this.index;
			row.classList.toggle('is-selected', selected);
			row.setAttribute('aria-selected', String(selected));
			if (selected) row.scrollIntoView({ block: 'nearest' });
		});
	}

	private place(caret: Caret): void {
		const margin = 8;
		const { offsetWidth: width, offsetHeight: height } = this.root;
		const left = Math.max(margin, Math.min(caret.left, window.innerWidth - width - margin));
		const below = caret.bottom + 4;
		const top = below + height > window.innerHeight - margin ? Math.max(margin, caret.top - height - 4) : below;
		this.root.style.left = `${left}px`;
		this.root.style.top = `${top}px`;
		this.root.style.visibility = '';
	}
}
