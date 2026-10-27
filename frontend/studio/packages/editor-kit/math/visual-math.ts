import type { MathfieldElement } from 'mathlive';

import { t } from '@blog/i18n/index.mjs';
import { currentMacros } from '@blog/science/rendering/math.ts';

/**
 * A formula edited as it looks (MathLive's mathfield, as cortexjs.io has it): the caret in the drawn formula, the
 * part it is in shaded, empty places as boxes. Its LaTeX is given back as it changes; read in and not changed, the
 * source is left as written (MathLive gives back what it was given).
 */

let loading: Promise<typeof import('mathlive')> | null = null;

/** MathLive, loaded the first time a formula is edited. Its fonts are KaTeX's, which the page has already; no sounds. */
function mathLive(): Promise<typeof import('mathlive')> {
	loading ??= import('mathlive').then((ml) => {
		ml.MathfieldElement.fontsDirectory = null;
		ml.MathfieldElement.soundsDirectory = null;
		return ml;
	});
	return loading;
}

/** A `\tag{…}` at the end: MathLive does not know it, so it is set aside while the formula is edited and put back after. */
const TRAILING_TAG = /\s*\\tag\*?\{[^{}]*\}\s*$/u;

/** The site's and the article's macros, as MathLive takes them: named without their backslash. */
function macrosForMathLive(): Record<string, string> {
	const macros: Record<string, string> = {};
	for (const [name, definition] of Object.entries(currentMacros())) {
		if (typeof definition === 'string') macros[name.replace(/^\\/u, '')] = definition;
	}
	return macros;
}

export type VisualMathHost = {
	/** The LaTeX, changed (its `\tag` put back). */
	input(source: string): void;
	/** Esc, ↩ or ⌘↩: done. */
	finish(): void;
	/** An arrow key at its edge: out, before (-1) or after (1) it. */
	exit(side: -1 | 1): void;
	/** ⌫ with nothing left. */
	remove(): void;
	/** 源码: edited as LaTeX instead. */
	source(): void;
};

export type VisualMath = {
	/** The element it is in, put where the formula is. */
	readonly root: HTMLElement;
	/** The source changed elsewhere (undo): shown. */
	set(source: string): void;
	/** Something typed to open it, put in. */
	type(text: string): void;
	/**
	 * Its LaTeX as it is now (its `\tag` put back), if it was changed here; null if not (what MathLive gives back is
	 * then not written, its way of writing not put over the author's). MathLive tells what was typed a moment after,
	 * which a quick Esc can beat.
	 */
	changed(): string | null;
	focus(): void;
	/** Whether this element is its own, or one of MathLive's menus and keyboard. */
	owns(target: EventTarget | null): boolean;
	destroy(): void;
};

/**
 * The formula `source` edited as it looks, in `parent`; null when MathLive does not know something in it (a command it
 * has no meaning for): it is then edited as LaTeX, so that nothing in it is lost.
 */
export async function createVisualMath(parent: HTMLElement, source: string, host: VisualMathHost): Promise<VisualMath | null> {
	const ml = await mathLive();
	const tag = TRAILING_TAG.exec(source)?.[0] ?? '';
	const body = tag ? source.slice(0, source.length - tag.length) : source;
	const root = document.createElement('div');
	root.className = 'pm-visual-math';
	const field = new ml.MathfieldElement() as MathfieldElement;
	field.mathVirtualKeyboardPolicy = 'manual';
	field.smartMode = false;
	field.setAttribute('aria-label', t('公式'));
	const toSource = document.createElement('button');
	toSource.type = 'button';
	toSource.className = 'pm-visual-math-source';
	toSource.textContent = t('源码');
	toSource.title = t('改 LaTeX 源码');
	toSource.addEventListener('mousedown', (event) => event.preventDefault());
	toSource.addEventListener('click', () => host.source());
	root.append(field, toSource);
	parent.append(root);
	field.macros = { ...field.macros, ...macrosForMathLive() };
	field.value = body;
	/** What it shows as given (or as set from outside since): what it gives back unchanged. */
	let shown = field.value;
	if (body.trim() && field.errors.length) {
		root.remove();
		return null;
	}

	// Empty places (the boxes) written as nothing in them: `\placeholder` is MathLive's, not the blog's.
	const latex = () => field.getValue('latex-without-placeholders');
	field.addEventListener('input', () => host.input(latex() + tag));
	field.addEventListener('move-out', (event) => {
		event.preventDefault();
		const { direction } = (event as CustomEvent<{ direction: string }>).detail;
		host.exit(direction === 'backward' || direction === 'upward' ? -1 : 1);
	});
	field.addEventListener(
		'keydown',
		(event) => {
			if (event.isComposing) return;
			const done = event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey && !event.altKey);
			if (done) {
				event.preventDefault();
				event.stopPropagation();
				host.finish();
			} else if (event.key === 'Backspace' && !field.value) {
				event.preventDefault();
				event.stopPropagation();
				host.remove();
			}
		},
		true,
	);

	return {
		root,
		set(next) {
			const nextTag = TRAILING_TAG.exec(next)?.[0] ?? '';
			const nextBody = nextTag ? next.slice(0, next.length - nextTag.length) : next;
			if (nextBody === latex()) return;
			field.value = nextBody;
			shown = field.value;
		},
		type(text) {
			field.executeCommand(['insert', text]);
			host.input(latex() + tag);
		},
		changed: () => (field.value === shown ? null : latex() + tag),
		focus: () => field.focus(),
		owns: (target) => target instanceof Node && (root.contains(target) || Boolean((target as Element).closest?.('.ML__keyboard, .ui-menu-container, .ML__popover'))),
		destroy() {
			root.remove();
		},
	};
}
