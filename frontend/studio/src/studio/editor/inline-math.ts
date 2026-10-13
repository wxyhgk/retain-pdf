import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { SchemaReady, nodeViewCtx, prosePluginsCtx } from '@milkdown/kit/core';
import { Fragment, Slice, type Node as ProseMirrorNode, type NodeType } from '@milkdown/prose/model';
import { NodeSelection, Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView, type NodeView } from '@milkdown/prose/view';
import { $markSchema } from '@milkdown/utils';

import { renderMathHtml } from '../../science/rendering/math.ts';

export type InlineMathKeyAction = 'commit' | 'exit-before' | 'exit-after' | 'delete' | 'promote';

/** A `$` typed with `\$`. It is not a formula delimiter. */
export const literalDollarMarkName = 'literal_dollar';

/** Source of a formula the caret is still inside. Serializes as inline math. */
export const mathPendingMarkName = 'math_pending';

type LiveRange = { from: number; to: number };

type InlineMathState = {
	live: LiveRange | null;
	/** Text after this position is the body of a formula whose opening `$` closed the previous one. */
	arm: number | null;
};

type ArmedMeta = { arm: number | null; live: null };

const idleMath: InlineMathState = { live: null, arm: null };

const liveMathKey = new PluginKey<InlineMathState>('live-math');

const ignoredMarkdownMark = {
	parseMarkdown: {
		match: () => false,
		runner: () => undefined,
	},
};

const literalDollarSchema = $markSchema(literalDollarMarkName, () => ({
	inclusive: false,
	parseDOM: [{ tag: 'span[data-literal-dollar]' }],
	toDOM: () => ['span', { 'data-literal-dollar': 'true' }],
	parseMarkdown: ignoredMarkdownMark.parseMarkdown,
	toMarkdown: {
		match: (mark) => mark.type.name === literalDollarMarkName,
		runner: () => false,
	},
}));

const mathPendingSchema = $markSchema(mathPendingMarkName, () => ({
	priority: 1,
	parseDOM: [{ tag: 'span[data-math-pending]' }],
	toDOM: () => ['span', { 'data-math-pending': 'true' }],
	parseMarkdown: ignoredMarkdownMark.parseMarkdown,
	toMarkdown: {
		match: (mark) => mark.type.name === mathPendingMarkName,
		runner: (state, _mark, node) => {
			const text = node.text ?? '';
			if (text.length < 3 || !text.startsWith('$') || !text.endsWith('$')) return false;
			const value = formulaValue(text.slice(1, -1));
			if (!value) return false;
			state.addNode('inlineMath', undefined, value);
			return true;
		},
	},
}));

export type DollarPlan = { kind: 'math'; from: number; to: number; value: string } | { kind: 'literal'; from: number; to: number };

function escapingBackslash(parent: ProseMirrorNode, offset: number): number | null {
	let count = 0;
	while (offset - count > 0 && parent.textBetween(offset - count - 1, offset - count) === '\\') count += 1;
	if (count % 2 === 0) return null;
	return offset - 1;
}

function markAtOffset(parent: ProseMirrorNode, offset: number, markName: string): boolean {
	let seen = 0;
	for (let index = 0; index < parent.childCount; index += 1) {
		const child = parent.child(index);
		const next = seen + child.nodeSize;
		if (offset < next) {
			return Boolean(child.isText && offset >= seen && child.marks.some((mark) => mark.type.name === markName));
		}
		seen = next;
	}
	return false;
}

/** Text in the run that ends at the caret. An inline atom starts a new run, so a pair cannot cross a formula. */
function textBeforeCaret(parent: ProseMirrorNode, offset: number): { text: string; fromOffset: number } {
	let text = '';
	let seen = 0;
	let fromOffset = 0;
	for (let index = 0; index < parent.childCount; index += 1) {
		const child = parent.child(index);
		if (seen >= offset) break;
		if (!child.isText) {
			text = '';
			seen += child.nodeSize;
			fromOffset = seen;
			continue;
		}
		if (seen + child.nodeSize > offset) {
			return { text: text + child.textBetween(0, offset - seen), fromOffset };
		}
		text += child.text ?? '';
		seen += child.nodeSize;
	}
	return { text, fromOffset };
}

/** Body of a formula. A space after the opening `$` stays text. Spaces before the closing `$` are removed. */
function formulaValue(raw: string): string | null {
	if (!raw || raw[0] === ' ' || raw[0] === '\t' || raw.includes('\n')) return null;
	const value = raw.replace(/[ \t]+$/, '');
	if (!value || /[^\x00-\x7F]/.test(value)) return null;
	return value;
}

/**
 * A typed `$` stays literal, or it closes a pair such as `$\sum$`.
 * Closing a pair renders the formula and leaves the caret after it.
 * A space right after the opening `$` stays text. Spaces before the closing `$` are removed.
 * A digit after the closer keeps the dollar. `\$` inserts a plain dollar and does not close a pair.
 */
export function planDollarMath(doc: ProseMirrorNode, from: number, to: number): DollarPlan | null {
	if (from < 0 || to < from || to > doc.content.size) return null;
	const $from = doc.resolve(from);
	const $to = doc.resolve(to);
	if (!$from.sameParent($to) || !$from.parent.isTextblock || $from.parent.type.spec.code) return null;
	if ($from.marks().some((mark) => mark.type.spec.code || mark.type.name === 'code')) return null;
	const slash = escapingBackslash($from.parent, $from.parentOffset);
	if (slash != null) return { kind: 'literal', from: $from.pos - ($from.parentOffset - slash), to };
	if (from !== to) return { kind: 'literal', from, to };
	const before = textBeforeCaret($from.parent, $from.parentOffset);
	if (!before.text) return { kind: 'literal', from, to };
	const prev = before.text[before.text.length - 1];
	if (prev === '\\' || prev === '$') return { kind: 'literal', from, to };
	const next =
		$from.parentOffset < $from.parent.content.size
			? $from.parent.textBetween($from.parentOffset, $from.parentOffset + 1)
			: '';
	if (next >= '0' && next <= '9') return { kind: 'literal', from, to };
	for (let index = before.text.length - 1; index >= 0; index -= 1) {
		if (before.text[index] !== '$') continue;
		const parentOffset = before.fromOffset + index;
		if (markAtOffset($from.parent, parentOffset, literalDollarMarkName)) continue;
		let slashes = 0;
		for (let slashIndex = index - 1; slashIndex >= 0 && before.text[slashIndex] === '\\'; slashIndex -= 1) slashes += 1;
		if (slashes % 2 === 1) continue;
		const value = formulaValue(before.text.slice(index + 1));
		if (!value) continue;
		return { kind: 'math', from: $from.pos - $from.parentOffset + before.fromOffset + index, to, value };
	}
	return { kind: 'literal', from, to };
}

/** `display` marks a formula written with display delimiters (`\[…\]`, `$$…$$`). */
export type InlineMathPiece = { kind: 'text'; text: string } | { kind: 'math'; value: string; display?: boolean };

const DELIMITERS = [
	{ open: '\\(', close: '\\)', display: false },
	{ open: '\\[', close: '\\]', display: true },
	{ open: '$$', close: '$$', display: true },
] as const;

function backslashesBefore(text: string, index: number): number {
	let count = 0;
	for (let at = index - 1; at >= 0 && text[at] === '\\'; at -= 1) count += 1;
	return count;
}

/** Where `close` ends a formula body that starts at `from`; a backslash and the character after it are formula text (`\\`, `\alpha`). */
function closingIndex(text: string, from: number, close: string): number {
	for (let at = from; at < text.length; at += 1) {
		if (text.startsWith(close, at)) return at;
		if (text[at] === '\\') at += 1;
	}
	return -1;
}

/**
 * Pair LaTeX's own `\(…\)` and `\[…\]`, and display `$$…$$`, inside one
 * pasted run, as AI answers write them. An odd run of backslashes before the
 * opener keeps it text. Returns null when nothing closes.
 */
function splitDelimitedMath(text: string): InlineMathPiece[] | null {
	const pieces: InlineMathPiece[] = [];
	let cursor = 0;
	let index = 0;
	while (index < text.length) {
		const delimiter = DELIMITERS.find((item) => text.startsWith(item.open, index));
		if (!delimiter || backslashesBefore(text, index) % 2 === 1) {
			index += 1;
			continue;
		}
		const end = closingIndex(text, index + delimiter.open.length, delimiter.close);
		const value = end < 0 ? '' : text.slice(index + delimiter.open.length, end).trim();
		if (!value) {
			index += delimiter.open.length;
			continue;
		}
		if (index > cursor) pieces.push({ kind: 'text', text: text.slice(cursor, index) });
		pieces.push({ kind: 'math', value, display: delimiter.display });
		index = cursor = end + delimiter.close.length;
	}
	if (!pieces.length) return null;
	if (cursor < text.length) pieces.push({ kind: 'text', text: text.slice(cursor) });
	return pieces;
}

/**
 * Pair formulas inside one pasted run: `\(…\)`, `\[…\]` and `$$…$$` first,
 * then `$…$` in the text between them. Returns null when nothing closes.
 */
export function splitInlineMath(text: string): InlineMathPiece[] | null {
	const delimited = splitDelimitedMath(text);
	const pieces: InlineMathPiece[] = [];
	let changed = Boolean(delimited);
	for (const piece of delimited ?? [{ kind: 'text', text }]) {
		const dollars = piece.kind === 'text' ? splitDollarMath(piece.text) : null;
		if (dollars) changed = true;
		pieces.push(...(dollars ?? [piece]));
	}
	return changed ? pieces : null;
}

/**
 * Pair `$...$` inside one pasted run.
 * A dollar before a digit stays text. An odd run of backslashes keeps the next dollar literal.
 * Returns null when nothing closes.
 */
function splitDollarMath(text: string): InlineMathPiece[] | null {
	const openers: number[] = [];
	const pairs: { from: number; to: number }[] = [];
	for (let index = 0; index < text.length; index += 1) {
		if (text[index] !== '$') continue;
		let slashes = 0;
		for (let slash = index - 1; slash >= 0 && text[slash] === '\\'; slash -= 1) slashes += 1;
		if (slashes % 2 === 1) continue;
		const next = text[index + 1] ?? '';
		if (next >= '0' && next <= '9') continue;
		const opener = openers.at(-1);
		if (opener != null) {
			const value = text.slice(opener + 1, index);
			if (value && value[0] !== ' ' && value[0] !== '\t' && !value.includes('\n')) {
				pairs.push({ from: opener, to: index });
				openers.pop();
				continue;
			}
		}
		if (next === ' ' || next === '\t' || next === '') continue;
		openers.push(index);
	}
	if (!pairs.length) return null;
	const pieces: InlineMathPiece[] = [];
	let cursor = 0;
	for (const pair of pairs) {
		if (pair.from > cursor) pieces.push({ kind: 'text', text: text.slice(cursor, pair.from) });
		pieces.push({ kind: 'math', value: text.slice(pair.from + 1, pair.to) });
		cursor = pair.to + 1;
	}
	if (cursor < text.length) pieces.push({ kind: 'text', text: text.slice(cursor) });
	return pieces;
}

function expandInlineMathFragment(fragment: Fragment, math: NodeType): { fragment: Fragment; changed: boolean } {
	let changed = false;
	const children: ProseMirrorNode[] = [];
	fragment.forEach((node) => {
		if (node.isText) {
			const marked = node.marks.some(
				(mark) => mark.type.spec.code || mark.type.name === 'code' || mark.type.name === literalDollarMarkName,
			);
			const pieces = node.text && !marked ? splitInlineMath(node.text) : null;
			if (!pieces) {
				children.push(node);
				return;
			}
			changed = true;
			for (const piece of pieces) {
				if (piece.kind === 'text') children.push(node.type.schema.text(piece.text, node.marks));
				else children.push(math.create({ value: piece.value }));
			}
			return;
		}
		if (node.type.spec.code || node.isAtom || !node.content.size) {
			children.push(node);
			return;
		}
		const inner = expandInlineMathFragment(node.content, math);
		if (!inner.changed) {
			children.push(node);
			return;
		}
		changed = true;
		children.push(node.copy(inner.fragment));
	});
	return { fragment: Fragment.from(children), changed };
}

/** A pasted paragraph that holds only a display formula, as the LaTeX block it stands for. */
function displayMathBlock(node: ProseMirrorNode, code: NodeType): ProseMirrorNode | null {
	if (node.type.name !== 'paragraph') return null;
	let text = '';
	let plain = true;
	node.forEach((child) => {
		if (child.isText && !child.marks.some((mark) => mark.type.spec.code || mark.type.name === 'code')) text += child.text;
		else if (child.type.name === 'hardbreak' || child.type.name === 'hard_break') text += '\n';
		else plain = false;
	});
	const pieces = plain ? splitDelimitedMath(text.trim()) : null;
	const piece = pieces?.length === 1 ? pieces[0] : null;
	if (piece?.kind !== 'math' || !piece.display) return null;
	return code.create(code.spec.attrs && 'language' in code.spec.attrs ? { language: 'LaTeX' } : null, code.schema.text(piece.value));
}

/**
 * HTML paste keeps formulas as text. Close `$...$` pairs the same way a typed
 * `$` does, and `\(…\)`, `\[…\]`, `$$…$$` as well. A top-level paragraph that
 * holds only a display formula becomes a LaTeX block.
 */
export function expandInlineMathSlice(slice: Slice, math: NodeType): Slice | null {
	const code = math.schema.nodes.code_block;
	let openStart = slice.openStart;
	let openEnd = slice.openEnd;
	let lifted = false;
	const blocks: ProseMirrorNode[] = [];
	slice.content.forEach((node, _offset, index) => {
		const block = code ? displayMathBlock(node, code) : null;
		if (!block) {
			blocks.push(node);
			return;
		}
		lifted = true;
		blocks.push(block);
		// A block cannot merge into the paragraph around the caret, so that edge of the slice closes.
		if (index === 0 && openStart === 1) openStart = 0;
		if (index === slice.content.childCount - 1 && openEnd === 1) openEnd = 0;
	});
	const expanded = expandInlineMathFragment(Fragment.from(blocks), math);
	if (!lifted && !expanded.changed) return null;
	return new Slice(expanded.fragment, openStart, openEnd);
}

/**
 * A caret placed between an empty `$$` pair. Typing there writes an inline formula.
 * A dollar typed with `\$`, or a `$` inside code, does not open one.
 */
export function openEmptyMathPair(doc: ProseMirrorNode, pos: number): { from: number; to: number } | null {
	if (pos < 1 || pos >= doc.content.size) return null;
	const $pos = doc.resolve(pos);
	if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return null;
	if ($pos.marks().some((mark) => mark.type.spec.code || mark.type.name === 'code')) return null;
	const offset = $pos.parentOffset;
	if (offset < 1 || offset >= $pos.parent.content.size) return null;
	if ($pos.parent.textBetween(offset - 1, offset) !== '$' || $pos.parent.textBetween(offset, offset + 1) !== '$') return null;
	if (escapingBackslash($pos.parent, offset - 1) != null || escapingBackslash($pos.parent, offset) != null) return null;
	if (markAtOffset($pos.parent, offset - 1, literalDollarMarkName) || markAtOffset($pos.parent, offset, literalDollarMarkName)) return null;
	const from = pos - 1;
	return { from, to: from + 2 };
}

/**
 * Esc right after one `$` inserts the closing `$` and leaves the caret between them.
 * `$$` and a dollar typed with `\$` stay as they are.
 */
export function planDollarEscape(doc: ProseMirrorNode, pos: number): { at: number } | null {
	if (pos < 0 || pos > doc.content.size) return null;
	const $pos = doc.resolve(pos);
	if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return null;
	if ($pos.marks().some((mark) => mark.type.spec.code || mark.type.name === 'code')) return null;
	const offset = $pos.parentOffset;
	if (offset < 1 || $pos.parent.textBetween(offset - 1, offset) !== '$') return null;
	if (offset >= 2 && $pos.parent.textBetween(offset - 2, offset - 1) === '$') return null;
	if (offset < $pos.parent.content.size && $pos.parent.textBetween(offset, offset + 1) === '$') return null;
	if (escapingBackslash($pos.parent, offset - 1) != null) return null;
	if (markAtOffset($pos.parent, offset - 1, literalDollarMarkName)) return null;
	return { at: pos };
}

/**
 * A `$` typed to leave a formula can also be the opener of the next one.
 * `pos` is the caret, and `arm` is where that next body starts.
 * An empty body, a body that starts with a space, or a digit after the caret stays text.
 * Spaces before the closing `$` are removed.
 */
export function planArmedFormula(
	doc: ProseMirrorNode,
	arm: number,
	pos: number,
): { from: number; to: number; value: string } | null {
	if (arm < 0 || pos <= arm || pos > doc.content.size) return null;
	const $arm = doc.resolve(arm);
	const $pos = doc.resolve(pos);
	if (!$arm.sameParent($pos) || !$arm.parent.isTextblock || $arm.parent.type.spec.code) return null;
	if ($pos.marks().some((mark) => mark.type.spec.code || mark.type.name === 'code')) return null;
	const parent = $arm.parent;
	const start = $arm.parentOffset;
	const end = $pos.parentOffset;
	let seen = 0;
	for (let index = 0; index < parent.childCount; index += 1) {
		const child = parent.child(index);
		const next = seen + child.nodeSize;
		if (next <= start) {
			seen = next;
			continue;
		}
		if (seen >= end) break;
		if (!child.isText) return null;
		seen = next;
	}
	const raw = parent.textBetween(start, end);
	if (raw.includes('$') || /[^\x00-\x7F]/.test(raw)) return null;
	const value = formulaValue(raw);
	if (!value) return null;
	const next = end < parent.content.size ? parent.textBetween(end, end + 1) : '';
	if (next >= '0' && next <= '9') return null;
	return { from: arm, to: pos, value };
}

/** The `$value$` covered by [from, to), when it is a real inline formula. */
export function readMathSource(doc: ProseMirrorNode, from: number, to: number): { value: string } | null {
	if (from < 0 || to - from < 3 || to > doc.content.size) return null;
	const $from = doc.resolve(from);
	const $to = doc.resolve(to);
	if (!$from.sameParent($to) || !$from.parent.isTextblock || $from.parent.type.spec.code) return null;
	if ($from.marks().some((mark) => mark.type.spec.code || mark.type.name === 'code')) return null;
	const opener = $from.parentOffset;
	const closer = $to.parentOffset - 1;
	if (closer < opener || $from.parent.textBetween(opener, opener + 1) !== '$' || $from.parent.textBetween(closer, closer + 1) !== '$') return null;
	if (markAtOffset($from.parent, opener, literalDollarMarkName) || markAtOffset($from.parent, closer, literalDollarMarkName)) return null;
	if (escapingBackslash($from.parent, opener) != null || escapingBackslash($from.parent, closer) != null) return null;
	const value = formulaValue($from.parent.textBetween(opener + 1, closer));
	if (!value) return null;
	const next = closer + 1 < $from.parent.content.size ? $from.parent.textBetween(closer + 1, closer + 2) : '';
	if (next >= '0' && next <= '9') return null;
	return { value };
}

/** Text of the inline run that contains `offset`. An atom ends the run. */
function textRunAround(parent: ProseMirrorNode, offset: number): { text: string; fromOffset: number } {
	let text = '';
	let seen = 0;
	let fromOffset = 0;
	let passed = false;
	for (let index = 0; index < parent.childCount; index += 1) {
		const child = parent.child(index);
		if (!child.isText) {
			if (passed || seen >= offset) break;
			text = '';
			seen += child.nodeSize;
			fromOffset = seen;
			continue;
		}
		text += child.text ?? '';
		seen += child.nodeSize;
		if (seen >= offset) passed = true;
	}
	return { text, fromOffset };
}

function dollarIndex(parent: ProseMirrorNode, runFrom: number, text: string, index: number): boolean {
	if (text[index] !== '$') return false;
	let slashes = 0;
	for (let slash = index - 1; slash >= 0 && text[slash] === '\\'; slash -= 1) slashes += 1;
	if (slashes % 2 === 1) return false;
	return !markAtOffset(parent, runFrom + index, literalDollarMarkName);
}

/**
 * The `$value$` already surrounding a caret, including a pair loaded as text.
 * This does not mark the pair live, so leaving it does not render or save it.
 */
export function openMathAround(doc: ProseMirrorNode, pos: number): { from: number; to: number; value: string } | null {
	if (pos < 0 || pos > doc.content.size) return null;
	const $pos = doc.resolve(pos);
	if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return null;
	if ($pos.marks().some((mark) => mark.type.spec.code || mark.type.name === 'code')) return null;
	const run = textRunAround($pos.parent, $pos.parentOffset);
	const local = $pos.parentOffset - run.fromOffset;
	if (local <= 0 || local > run.text.length) return null;
	let opener = -1;
	for (let index = local - 1; index >= 0; index -= 1) {
		if (!dollarIndex($pos.parent, run.fromOffset, run.text, index)) continue;
		opener = index;
		break;
	}
	if (opener < 0) return null;
	let closer = -1;
	for (let index = local; index < run.text.length; index += 1) {
		if (!dollarIndex($pos.parent, run.fromOffset, run.text, index)) continue;
		closer = index;
		break;
	}
	if (closer < 0) return null;
	const from = $pos.start() + run.fromOffset + opener;
	const to = $pos.start() + run.fromOffset + closer + 1;
	const source = readMathSource(doc, from, to);
	if (!source) return null;
	return { from, to, value: source.value };
}

export type MathSourcePlan =
	| { action: 'noop' }
	| { action: 'keep' }
	| { action: 'clear' }
	| { action: 'collapse'; from: number; to: number; value: string; cursor: number };

/**
 * A pair stays as `$source$` while the caret is strictly inside it.
 * Leaving a valid pair renders it. An empty or broken pair is left as text.
 */
export function planMathSource(
	doc: ProseMirrorNode,
	live: LiveRange | null,
	selection: { from: number; to: number },
): MathSourcePlan {
	if (!live) return { action: 'noop' };
	if (live.from < 0 || live.to > doc.content.size || live.from >= live.to) return { action: 'clear' };
	const $from = doc.resolve(live.from);
	const $to = doc.resolve(live.to);
	if (!$from.sameParent($to)) return { action: 'clear' };
	const inside = selection.from > live.from && selection.to < live.to;
	if (inside) return { action: 'keep' };
	if (selection.from !== selection.to) return { action: 'keep' };
	const source = readMathSource(doc, live.from, live.to);
	if (!source) return { action: 'clear' };
	const span = live.to - live.from;
	let cursor = live.from + 1;
	if (selection.from >= live.to) cursor = selection.from - span + 1;
	else if (selection.from <= live.from) cursor = selection.from;
	return { action: 'collapse', from: live.from, to: live.to, value: source.value, cursor };
}

/** `\sin` inside a visible formula source. Offsets are into `text`, which includes the dollars. */
export function mathCommandSpans(text: string): { from: number; to: number }[] {
	const spans: { from: number; to: number }[] = [];
	for (const match of text.matchAll(/\\[a-zA-Z]+/g)) {
		const index = match.index ?? 0;
		spans.push({ from: index, to: index + match[0].length });
	}
	return spans;
}

/** Arrow or click into a rendered formula expands `$value$` and puts the caret inside. */
export function planExpandInlineMath(
	doc: ProseMirrorNode,
	pos: number,
	caret: 'start' | 'end',
): { from: number; to: number; text: string; cursor: number } | null {
	if (pos < 0 || pos > doc.content.size) return null;
	const node = doc.nodeAt(pos);
	if (!node || node.type.name !== 'math_inline') return null;
	const value = String(node.attrs.value ?? '');
	const text = `$${value}$`;
	const cursor = caret === 'start' ? pos + 1 : pos + 1 + value.length;
	return { from: pos, to: pos + node.nodeSize, text, cursor };
}

/** Enter at the end of a paragraph whose text is `$$` turns it into a LaTeX block. */
export function planDollarBlock(
	doc: ProseMirrorNode,
	pos: number,
): { from: number; to: number; nodes: ProseMirrorNode[]; cursor: number } | null {
	if (pos < 0 || pos > doc.content.size) return null;
	const $pos = doc.resolve(pos);
	if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return null;
	if ($pos.parent.textContent !== '$$' || $pos.parentOffset !== $pos.parent.content.size) return null;
	const code = doc.type.schema.nodes.code_block;
	if (!code) return null;
	const block = code.create(code.spec.attrs && 'language' in code.spec.attrs ? { language: 'LaTeX' } : null);
	const container = $pos.node($pos.depth - 1);
	const index = $pos.index($pos.depth - 1);
	let nodes: ProseMirrorNode[] = [block];
	if (!container.canReplace(index, index + 1, Fragment.from(nodes))) {
		nodes = [$pos.parent.type.create($pos.parent.attrs), block];
		if (!container.canReplace(index, index + 1, Fragment.from(nodes))) return null;
	}
	const from = $pos.before($pos.depth);
	let cursor = from;
	for (const node of nodes) {
		if (node.type === code) {
			cursor += 1;
			break;
		}
		cursor += node.nodeSize;
	}
	return { from, to: from + $pos.parent.nodeSize, nodes, cursor };
}

/** A paragraph whose text is only `$$` keeps a following space instead of becoming a formula block. */
export function planLiteralDollarChar(
	doc: ProseMirrorNode,
	from: number,
	to: number,
	text: string,
): { from: number; to: number; text: string } | null {
	if ((text !== ' ' && text !== '\n') || from !== to) return null;
	const $from = doc.resolve(from);
	if (!$from.parent.isTextblock || $from.parent.type.spec.code) return null;
	if ($from.parent.textContent !== '$$' || $from.parentOffset !== $from.parent.content.size) return null;
	return { from, to, text };
}

/**
 * An empty inline formula followed by `$` becomes a LaTeX block.
 * Surrounding text stays in its own paragraphs. A list item keeps a paragraph in front.
 */
export function planPromoteInlineMath(
	doc: ProseMirrorNode,
	pos: number,
): { from: number; to: number; nodes: ProseMirrorNode[]; cursor: number } | null {
	if (pos < 0 || pos > doc.content.size) return null;
	const math = doc.nodeAt(pos);
	if (!math || math.type.name !== 'math_inline') return null;
	const $pos = doc.resolve(pos);
	if ($pos.depth < 1 || !$pos.parent.isTextblock) return null;
	const code = doc.type.schema.nodes.code_block;
	if (!code) return null;
	const block = code.create(code.spec.attrs && 'language' in code.spec.attrs ? { language: 'LaTeX' } : null);
	const start = $pos.parentOffset;
	const before = $pos.parent.content.cut(0, start);
	const after = $pos.parent.content.cut(start + math.nodeSize);
	const nodes: ProseMirrorNode[] = [];
	if (before.size) nodes.push($pos.parent.type.create($pos.parent.attrs, before));
	nodes.push(block);
	if (after.size) nodes.push($pos.parent.type.create($pos.parent.attrs, after));
	const container = $pos.node($pos.depth - 1);
	const index = $pos.index($pos.depth - 1);
	let replacement = nodes;
	if (!container.canReplace(index, index + 1, Fragment.from(replacement))) {
		if (before.size || after.size) return null;
		replacement = [$pos.parent.type.create($pos.parent.attrs), block];
		if (!container.canReplace(index, index + 1, Fragment.from(replacement))) return null;
	}
	const from = $pos.before($pos.depth);
	let cursor = from;
	for (const node of replacement) {
		if (node.type === code) {
			cursor += 1;
			break;
		}
		cursor += node.nodeSize;
	}
	return { from, to: from + $pos.parent.nodeSize, nodes: replacement, cursor };
}

/** Keys handled by the in-place source field. A backslash keeps the following `$` in the source. `$` finishes the formula. */
export function inlineMathKeyAction(value: string, start: number, end: number, key: string): InlineMathKeyAction | null {
	if (key === 'Enter' || key === 'Escape') return 'commit';
	if (key === '$') {
		if (start === end && start > 0 && value[start - 1] === '\\') return null;
		return 'commit';
	}
	if (key === 'Backspace' || key === 'Delete') {
		if (value.length === 0 || (start === 0 && end === value.length)) return 'delete';
		return null;
	}
	if (key === 'ArrowLeft' && start === 0 && end === 0) return 'exit-before';
	if (key === 'ArrowRight' && start === value.length && end === value.length) return 'exit-after';
	return null;
}

class InlineMathView implements NodeView {
	readonly dom: HTMLElement;
	private node: ProseMirrorNode;
	private readonly view: EditorView;
	private readonly getPos: () => number | undefined;

	constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.dom = document.createElement('span');
		this.dom.className = 'pm-inline-math';
		this.dom.contentEditable = 'false';
		this.dom.addEventListener('mousedown', this.onMouseDown);
		this.dom.addEventListener('dragstart', this.onDragStart);
		this.renderFormula();
	}

	update(node: ProseMirrorNode): boolean {
		if (node.type !== this.node.type) return false;
		this.node = node;
		this.renderFormula();
		return true;
	}

	ignoreMutation(): boolean {
		return true;
	}

	stopEvent(event: Event): boolean {
		return event.type === 'dragstart';
	}

	destroy(): void {
		this.dom.removeEventListener('mousedown', this.onMouseDown);
		this.dom.removeEventListener('dragstart', this.onDragStart);
	}

	private onDragStart = (event: DragEvent): void => {
		event.preventDefault();
	};

	private onMouseDown = (event: MouseEvent): void => {
		if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
		event.preventDefault();
		event.stopPropagation();
		const pos = this.getPos();
		if (pos === undefined) return;
		applyExpand(this.view, pos, 'end');
	};

	private renderFormula(): void {
		const value = String(this.node.attrs.value ?? '');
		if (!value) {
			const placeholder = document.createElement('span');
			placeholder.className = 'pm-inline-math-placeholder';
			placeholder.textContent = '公式';
			this.dom.replaceChildren(placeholder);
			this.dom.classList.remove('is-error');
			this.dom.removeAttribute('title');
			return;
		}
		const result = renderMathHtml(value, false);
		this.dom.innerHTML = result.html;
		// MathML sits under the visible glyph. In a contenteditable line the caret enters it and draws through the formula.
		this.dom.querySelectorAll('.katex-mathml').forEach((node) => node.remove());
		this.dom.classList.toggle('is-error', Boolean(result.error));
		if (result.error) this.dom.title = result.error;
		else this.dom.removeAttribute('title');
	}
}

function isLiveRange(meta: unknown): meta is LiveRange {
	if (!meta || typeof meta !== 'object' || !('from' in meta) || !('to' in meta)) return false;
	return typeof meta.from === 'number' && typeof meta.to === 'number';
}

function isArmedMeta(meta: unknown): meta is ArmedMeta {
	if (!meta || typeof meta !== 'object' || !('arm' in meta)) return false;
	const arm = (meta as { arm: unknown }).arm;
	return arm === null || typeof arm === 'number';
}

function mapLive(tr: Transaction, live: LiveRange): LiveRange | null {
	const from = tr.mapping.map(live.from, -1);
	const to = tr.mapping.map(live.to, -1);
	if (from >= to) return null;
	return { from, to };
}

function rangeFullyMarked(doc: ProseMirrorNode, from: number, to: number, markName: string): boolean {
	let marked = true;
	let seen = false;
	doc.nodesBetween(from, to, (node) => {
		if (!marked) return false;
		if (!node.isText) return undefined;
		seen = true;
		if (!node.marks.some((mark) => mark.type.name === markName)) marked = false;
		return false;
	});
	return seen && marked;
}

function collapseMath(
	state: EditorState,
	plan: { from: number; to: number; value: string; cursor: number },
): Transaction | null {
	const math = state.schema.nodes.math_inline;
	if (!math) return null;
	const node = math.create({ value: plan.value });
	let tr = state.tr.replaceWith(plan.from, plan.to, node);
	const cursor = Math.max(0, Math.min(plan.cursor, tr.doc.content.size));
	const bias = plan.cursor <= plan.from ? -1 : 1;
	return tr
		.setSelection(TextSelection.near(tr.doc.resolve(cursor), bias))
		.setMeta(liveMathKey, null)
		.scrollIntoView();
}

function applyExpand(view: EditorView, pos: number, caret: 'start' | 'end'): boolean {
	const plan = planExpandInlineMath(view.state.doc, pos, caret);
	if (!plan) return false;
	let tr = view.state.tr.replaceWith(plan.from, plan.to, view.state.schema.text(plan.text));
	const pending = view.state.schema.marks[mathPendingMarkName];
	if (pending && plan.text.length > 2) tr = tr.addMark(plan.from, plan.from + plan.text.length, pending.create());
	const cursor = Math.max(0, Math.min(plan.cursor, tr.doc.content.size));
	tr = tr
		.setSelection(TextSelection.create(tr.doc, cursor))
		.setMeta(liveMathKey, { from: plan.from, to: plan.from + plan.text.length })
		.scrollIntoView();
	view.dispatch(tr);
	view.focus();
	return true;
}

function mathPreviewWidget(from: number, to: number, value: string): Decoration {
	return Decoration.widget(
		to,
		(view) => {
			const root = document.createElement('span');
			root.className = 'pm-math-preview';
			root.setAttribute('contenteditable', 'false');
			root.setAttribute('aria-hidden', 'true');
			const body = document.createElement('span');
			body.className = 'pm-math-preview-body';
			const rendered = renderMathHtml(value, false);
			body.innerHTML = rendered.html;
			body.querySelectorAll('.katex-mathml').forEach((node) => node.remove());
			if (rendered.error) body.classList.add('is-error');
			root.append(body);
			const place = () => {
				if (!root.isConnected || view.isDestroyed) return;
				try {
					const start = view.coordsAtPos(from);
					const end = view.coordsAtPos(to);
					const host = root.getBoundingClientRect();
					body.style.left = `${start.left - host.left}px`;
					const width = body.getBoundingClientRect().width;
					const arrow = (start.left + end.left) / 2 - start.left;
					body.style.setProperty('--arrow', `${Math.min(Math.max(arrow, 14), Math.max(14, width - 14))}px`);
				} catch {
					// The source moved before this frame.
				}
			};
			requestAnimationFrame(place);
			return root;
		},
		{ ignoreSelection: true, side: 1, key: `math-preview:${from}:${value}` },
	);
}

function sourceDecorations(state: EditorState, from: number, to: number): DecorationSet {
	if (from < 0 || to > state.doc.content.size || from >= to) return DecorationSet.empty;
	let text = '';
	try {
		text = state.doc.textBetween(from, to);
	} catch {
		return DecorationSet.empty;
	}
	const marks: Decoration[] = [Decoration.inline(from, to, { class: 'pm-math-source' })];
	for (const span of mathCommandSpans(text)) {
		const start = from + span.from;
		const end = from + span.to;
		if (start < end && end <= to) marks.push(Decoration.inline(start, end, { class: 'pm-math-cmd' }));
	}
	const source = readMathSource(state.doc, from, to);
	if (source) marks.push(mathPreviewWidget(from, to, source.value));
	try {
		return DecorationSet.create(state.doc, marks);
	} catch {
		return DecorationSet.empty;
	}
}

function finishLiveMath(view: EditorView, live: LiveRange): boolean {
	const source = readMathSource(view.state.doc, live.from, live.to);
	if (!source) return false;
	const tr = collapseMath(view.state, { from: live.from, to: live.to, value: source.value, cursor: live.from + 1 });
	if (!tr) return false;
	view.dispatch(tr);
	return true;
}

const inlineMathEditPlugin: MilkdownPlugin = (ctx: Ctx) => async () => {
	await ctx.wait(SchemaReady);
	const plugin = new Plugin<InlineMathState>({
		key: liveMathKey,
		state: {
			init: () => idleMath,
			apply(tr, value) {
				const meta = tr.getMeta(liveMathKey);
				if (meta === null) return idleMath;
				if (isLiveRange(meta)) return { live: { from: meta.from, to: meta.to }, arm: null };
				if (isArmedMeta(meta)) return { live: null, arm: meta.arm };
				let live = value.live;
				let arm = value.arm;
				if (tr.docChanged) {
					if (live) live = mapLive(tr, live);
					if (arm != null) arm = tr.mapping.map(arm, -1);
				}
				return { live, arm };
			},
		},
		appendTransaction(transactions, _oldState, newState) {
			if (transactions.some((transaction) => transaction.getMeta('composition'))) return null;
			const edit = liveMathKey.getState(newState) ?? idleMath;
			const live = edit.live;
			const selection = newState.selection;
			if (!live) {
				if (edit.arm != null) {
					const arm = edit.arm;
					const left =
						!selection.empty ||
						selection.from < arm ||
						!newState.doc.resolve(arm).sameParent(newState.doc.resolve(selection.from));
					if (left) return newState.tr.setMeta(liveMathKey, { arm: null, live: null });
				}
				if (!selection.empty) return null;
				const empty = openEmptyMathPair(newState.doc, selection.from);
				return empty ? newState.tr.setMeta(liveMathKey, empty) : null;
			}
			const plan = planMathSource(newState.doc, live, { from: selection.from, to: selection.to });
			if (plan.action === 'noop') return null;
			if (plan.action === 'clear') {
				let tr = newState.tr.setMeta(liveMathKey, null);
				const pending = newState.schema.marks[mathPendingMarkName];
				if (pending && live.from >= 0 && live.to <= newState.doc.content.size && live.from < live.to) {
					tr = tr.removeMark(live.from, live.to, pending);
				}
				return tr;
			}
			if (plan.action === 'collapse') return collapseMath(newState, plan);
			const pending = newState.schema.marks[mathPendingMarkName];
			const source = readMathSource(newState.doc, live.from, live.to);
			if (!pending || !source || rangeFullyMarked(newState.doc, live.from, live.to, mathPendingMarkName)) return null;
			const marked = newState.tr.addMark(live.from, live.to, pending.create());
			return marked.docChanged ? marked : null;
		},
		props: {
			decorations(state) {
				const edit = liveMathKey.getState(state) ?? idleMath;
				const live = edit.live;
				if (live && live.from >= 0 && live.to <= state.doc.content.size && live.from < live.to) {
					return sourceDecorations(state, live.from, live.to);
				}
				if (!state.selection.empty) return DecorationSet.empty;
				const around = openMathAround(state.doc, state.selection.from);
				if (!around) return DecorationSet.empty;
				return sourceDecorations(state, around.from, around.to);
			},
			handleTextInput(view, from, to, text) {
				if (view.composing) return false;
				const edit = liveMathKey.getState(view.state) ?? idleMath;
				const live = edit.live;
				if (live && text !== '$' && text !== '\n' && from === to && from > live.from && from < live.to) {
					view.dispatch(view.state.tr.insertText(text, from).scrollIntoView());
					return true;
				}
				const literalChar = planLiteralDollarChar(view.state.doc, from, to, text);
				if (literalChar) {
					view.dispatch(view.state.tr.insertText(literalChar.text, literalChar.from, literalChar.to).scrollIntoView());
					return true;
				}
				if (text !== '$') return false;
				if (live && from === to && from > live.from && from === live.to - 1) {
					const source = readMathSource(view.state.doc, live.from, live.to);
					if (source) {
						const committed = collapseMath(view.state, {
							from: live.from,
							to: live.to,
							value: source.value,
							cursor: live.from + 1,
						});
						if (committed) {
							view.dispatch(committed.setMeta(liveMathKey, { arm: committed.selection.from, live: null }));
							return true;
						}
					}
				}
				const armed = !live && edit.arm != null && from === to ? planArmedFormula(view.state.doc, edit.arm, from) : null;
				if (armed) {
					const committed = collapseMath(view.state, {
						from: armed.from,
						to: armed.to,
						value: armed.value,
						cursor: armed.from + 1,
					});
					if (committed) {
						view.dispatch(committed.setMeta(liveMathKey, { arm: committed.selection.from, live: null }));
						return true;
					}
				}
				const dropArm = !live && edit.arm != null && from === to;
				const plan = planDollarMath(view.state.doc, from, to);
				if (!plan) return false;
				if (plan.kind === 'literal') {
					const literal = view.state.schema.marks[literalDollarMarkName];
					if (literal && plan.from < from) {
						const base = (view.state.storedMarks ?? view.state.selection.$from.marks()).filter(
							(mark) => mark.type.name !== literalDollarMarkName && mark.type.name !== mathPendingMarkName,
						);
						const dollar = view.state.schema.text('$', [...base, literal.create()]);
						let tr = view.state.tr.replaceWith(plan.from, plan.to, dollar).setStoredMarks(base);
						if (dropArm) tr = tr.setMeta(liveMathKey, { arm: null, live: null });
						view.dispatch(tr.scrollIntoView());
						return true;
					}
					let tr = view.state.tr.insertText('$', plan.from, plan.to);
					if (dropArm) tr = tr.setMeta(liveMathKey, { arm: null, live: null });
					view.dispatch(tr.scrollIntoView());
					return true;
				}
				const committed = collapseMath(view.state, {
					from: plan.from,
					to: plan.to,
					value: plan.value,
					cursor: plan.from + 1,
				});
				if (!committed) return false;
				view.dispatch(dropArm ? committed.setMeta(liveMathKey, { arm: null, live: null }) : committed);
				return true;
			},
			handlePaste(view, event, slice) {
				if (!slice || slice.content.size === 0) return false;
				const clipboard = event.clipboardData;
				if (!clipboard || clipboard.getData('vscode-editor-data') || !clipboard.getData('text/html')) return false;
				const html = clipboard.getData('text/html');
				if (html.includes('data-type="math_inline"') || html.includes("data-type='math_inline'")) return false;
				const { $from } = view.state.selection;
				if ($from.parent.type.spec.code) return false;
				if ($from.marks().some((mark) => mark.type.spec.code || mark.type.name === 'code')) return false;
				const math = view.state.schema.nodes.math_inline;
				if (!math) return false;
				const expanded = expandInlineMathSlice(slice, math);
				if (!expanded) return false;
				view.dispatch(view.state.tr.replaceSelection(expanded).scrollIntoView());
				return true;
			},
			handleKeyDown(view, event) {
				if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.isComposing) return false;
				const selection = view.state.selection;
				if (!(selection instanceof TextSelection) || !selection.empty) return false;
				const live = (liveMathKey.getState(view.state) ?? idleMath).live;
				const inside = Boolean(live && selection.from > live.from && selection.from < live.to);
				if (event.key === 'Escape') {
					if (inside && live && finishLiveMath(view, live)) return true;
					const escapePlan = planDollarEscape(view.state.doc, selection.from);
					if (!escapePlan) return false;
					const at = escapePlan.at;
					let tr = view.state.tr.insertText('$', at);
					tr = tr
						.setSelection(TextSelection.create(tr.doc, at))
						.setMeta(liveMathKey, { from: at - 1, to: at + 1 })
						.scrollIntoView();
					view.dispatch(tr);
					return true;
				}
				if (event.key === 'Enter') {
					if (inside && live) {
						if (finishLiveMath(view, live)) return true;
						const blockFromInside = planDollarBlock(view.state.doc, live.to);
						if (blockFromInside) {
							let tr = view.state.tr.replaceWith(blockFromInside.from, blockFromInside.to, blockFromInside.nodes);
							const cursor = Math.max(0, Math.min(blockFromInside.cursor, tr.doc.content.size));
							tr = tr
								.setSelection(TextSelection.near(tr.doc.resolve(cursor), 1))
								.setMeta(liveMathKey, null)
								.scrollIntoView();
							view.dispatch(tr);
							return true;
						}
					}
					const blockPlan = planDollarBlock(view.state.doc, selection.from);
					if (!blockPlan) return false;
					let tr = view.state.tr.replaceWith(blockPlan.from, blockPlan.to, blockPlan.nodes);
					const cursor = Math.max(0, Math.min(blockPlan.cursor, tr.doc.content.size));
					tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursor), 1)).setMeta(liveMathKey, null).scrollIntoView();
					view.dispatch(tr);
					return true;
				}
				if (event.key === 'ArrowRight' && selection.$from.nodeAfter?.type.name === 'math_inline') {
					return applyExpand(view, selection.from, 'start');
				}
				const before = selection.$from.nodeBefore;
				if (event.key === 'ArrowLeft' && before?.type.name === 'math_inline') {
					return applyExpand(view, selection.from - before.nodeSize, 'end');
				}
				return false;
			},
		},
		view() {
			return {
				update(view) {
					const selection = view.state.selection;
					if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'math_inline') return;
					const pos = selection.from;
					queueMicrotask(() => {
						if (view.isDestroyed) return;
						const current = view.state.selection;
						if (!(current instanceof NodeSelection) || current.from !== pos || current.node.type.name !== 'math_inline') return;
						applyExpand(view, pos, 'end');
					});
				},
			};
		},
	});
	ctx.update(prosePluginsCtx, (plugins) => [plugin, ...plugins]);
	return () => {
		ctx.update(prosePluginsCtx, (plugins) => plugins.filter((item) => item !== plugin));
	};
};

const inlineMathViewPlugin: MilkdownPlugin = (ctx: Ctx) => async () => {
	await ctx.wait(SchemaReady);
	ctx.update(nodeViewCtx, (views) => [
		...views.filter(([id]) => id !== 'math_inline'),
		['math_inline', (node, view, getPos) => new InlineMathView(node, view, getPos)],
	]);
	return () => {
		ctx.update(nodeViewCtx, (views) => views.filter(([id]) => id !== 'math_inline'));
	};
};

export const inlineMathPlugins = [...literalDollarSchema, ...mathPendingSchema, inlineMathEditPlugin, inlineMathViewPlugin];
