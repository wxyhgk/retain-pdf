import type { EquationLabel } from '@blog/science/rendering/equations.mjs';
import { renderMathHtml } from '@blog/science/rendering/math.ts';

import { markFormula } from './formula-marks.ts';

/**
 * A formula drawn while it is typed. What is not finished yet is not an
 * error: the command at the caret (`\`, `\si`), a `^` or `_` waiting for its
 * argument, and the braces, `\left`s and `\begin`s still open. The formula is
 * drawn without the first two and with the rest closed. A mistake elsewhere
 * keeps the last good drawing; the page shows it as an error only once the
 * typing stops (the CSS waits) or the formula is left.
 */

function backslashesBefore(text: string, index: number): number {
	let count = 0;
	for (let at = index - 1; at >= 0 && text[at] === '\\'; at -= 1) count += 1;
	return count;
}

/** The formula as far as it is written, `caret` being where the typing is; null when nothing is unfinished. */
export function writtenSoFar(source: string, caret: number): string | null {
	return writtenUpTo(source, caret)?.text ?? null;
}

/** The same, with where the caret is in what is written. */
function writtenUpTo(source: string, caret: number): { text: string; caret: number } | null {
	let text = source;
	let at = Math.max(0, Math.min(caret, text.length));
	// The command being typed: `\`, `\si|`, `\si|n`. After `\\` (a line break) a backslash is not one.
	const command = /\\[A-Za-z]*$/.exec(text.slice(0, at));
	if (command && backslashesBefore(text, command.index) % 2 === 0) {
		const rest = /^[A-Za-z]*/.exec(text.slice(at))?.[0] ?? '';
		text = text.slice(0, command.index) + text.slice(at + rest.length);
		at = command.index;
	}
	// `x^|`: its argument is still to come.
	const hanging = /[\^_]\s*$/.exec(text.slice(0, at));
	if (hanging && backslashesBefore(text, hanging.index) % 2 === 0) {
		text = text.slice(0, hanging.index) + text.slice(at);
		at = hanging.index;
	}
	// What is still open, closed.
	let depth = 0;
	let lefts = 0;
	const environments: string[] = [];
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (char === '{') depth += 1;
		else if (char === '}') depth = Math.max(0, depth - 1);
		if (char !== '\\') continue;
		const word = /^\\([A-Za-z]+)(?:\{([^{}]*)\})?/.exec(text.slice(index));
		if (!word) {
			index += 1;
			continue;
		}
		if (word[1] === 'left') lefts += 1;
		else if (word[1] === 'right') lefts = Math.max(0, lefts - 1);
		else if (word[1] === 'begin' && word[2] !== undefined) environments.push(word[2]);
		else if (word[1] === 'end' && word[2] !== undefined) environments.pop();
		index += word[1].length;
	}
	text += '}'.repeat(depth) + ' \\right.'.repeat(lefts) + environments.reverse().map((name) => `\\end{${name}}`).join('');
	return text === source ? null : { text, caret: at };
}

export type TypedFormula = {
	html: string;
	/** `typing`: drawn as far as it is written; `stale`: the last good drawing; `error`: nothing good to show. */
	state: 'ok' | 'typing' | 'stale' | 'error';
	/** For `stale` and `error`: what is wrong. */
	error?: string;
};

export type TypingOptions = {
	/** What is drawn: the typed text, ready for KaTeX (labels gone). */
	source: string;
	/** What is typed, and the caret in it. */
	typed: string;
	caret: number;
	display: boolean;
	labels?: Map<string, EquationLabel>;
	/** The last good drawing of this formula. */
	lastGood: string | null;
	/** The caret, the part it is in and the empty places marked in the drawing (formula-marks.ts); when `source` is what is typed. */
	marks?: boolean;
};

/** `text` drawn with its marks for `caret`; null when it cannot be (it is then drawn without them). */
function drawMarked(text: string, caret: number, display: boolean, labels?: Map<string, EquationLabel>): string | null {
	const marked = markFormula(text, caret);
	if (marked === null) return null;
	const drawn = renderMathHtml(marked, display, labels, { marks: true });
	return drawn.error ? null : drawn.html;
}

/** Draws a formula being typed, by the rules above. */
export function renderWhileTyping({ source, typed, caret, display, labels, lastGood, marks = false }: TypingOptions): TypedFormula {
	const marking = marks && source === typed && caret >= 0;
	const full = renderMathHtml(source, display, labels);
	if (!full.error) return { html: (marking && drawMarked(typed, caret, display, labels)) || full.html, state: 'ok' };
	const written = writtenUpTo(typed, caret);
	if (written !== null) {
		if (!written.text.trim()) return { html: '', state: 'typing' };
		const partial = renderMathHtml(written.text, display, labels);
		if (!partial.error) return { html: (marking && drawMarked(written.text, written.caret, display, labels)) || partial.html, state: 'typing' };
	}
	return lastGood !== null ? { html: lastGood, state: 'stale', error: full.error } : { html: full.html, state: 'error', error: full.error };
}
