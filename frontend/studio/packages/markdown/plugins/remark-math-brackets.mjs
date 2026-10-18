import { markdownLineEnding } from 'micromark-util-character';
import { visitParents } from 'unist-util-visit-parents';

/**
 * LaTeX's own delimiters, `\(…\)` inline and `\[…\]` display, as AI answers
 * write them. Markdown would read `\(` as an escaped bracket and then turn
 * `_` and `*` inside into emphasis, so the formula is recognised while
 * parsing, as one span, and becomes the same `inlineMath` / `math` node that
 * remark-math makes for `$…$` and `$$…$$`. Everything after parsing (KaTeX,
 * the Studio's formula nodes) sees no difference.
 *
 * A `\[…\]` that sits on its own lines becomes a block formula, splitting
 * the paragraph around it, since answers rarely leave blank lines there.
 * One inside running text stays in the line, drawn in display style.
 *
 * Use with remark-math: `unified().use(remarkParse).use(remarkMath).use(remarkMathBrackets)`.
 */
export default function remarkMathBrackets() {
	const data = this.data();
	(data.micromarkExtensions ??= []).push(mathBracketSyntax());
	(data.fromMarkdownExtensions ??= []).push(mathBracketFromMarkdown());
	return splitDisplayMath;
}

const BACKSLASH = 92;
const INLINE = 'mathBracketInline';
const DISPLAY = 'mathBracketDisplay';
const MARKER = 'mathBracketMarker';
const DATA = 'mathBracketData';

/** micromark extension: `\(` and `\[`, tried before a backslash escape. */
export function mathBracketSyntax() {
	return {
		text: {
			[BACKSLASH]: [bracketConstruct(40, 41, INLINE), bracketConstruct(91, 93, DISPLAY)],
		},
	};
}

/** One delimiter pair: `open` and `close` are the character codes after the backslash. */
function bracketConstruct(open, close, type) {
	const closing = { tokenize: tokenizeClosing, partial: true };
	return { name: type, tokenize: tokenizeBracket };

	function tokenizeBracket(effects, ok, nok) {
		let size = 0;
		return start;

		function start(code) {
			effects.enter(type);
			effects.enter(MARKER);
			effects.consume(code);
			return opening;
		}

		function opening(code) {
			if (code !== open) return nok(code);
			effects.consume(code);
			effects.exit(MARKER);
			return between;
		}

		function between(code) {
			if (code === null) return nok(code);
			if (markdownLineEnding(code)) {
				effects.enter('lineEnding');
				effects.consume(code);
				effects.exit('lineEnding');
				return between;
			}
			if (code === BACKSLASH) return effects.attempt(closing, done, backslash)(code);
			effects.enter(DATA);
			return inData(code);
		}

		function inData(code) {
			if (code === null || code === BACKSLASH || markdownLineEnding(code)) {
				effects.exit(DATA);
				return between(code);
			}
			effects.consume(code);
			size += 1;
			return inData;
		}

		/** A backslash that does not close: it and the character after it are formula text (`\\`, `\alpha`). */
		function backslash(code) {
			effects.enter(DATA);
			effects.consume(code);
			size += 1;
			return escaped;
		}

		function escaped(code) {
			if (code === null || markdownLineEnding(code)) {
				effects.exit(DATA);
				return between(code);
			}
			effects.consume(code);
			return inData;
		}

		function done(code) {
			if (size === 0) return nok(code);
			effects.exit(type);
			return ok(code);
		}
	}

	function tokenizeClosing(effects, ok, nok) {
		return start;

		function start(code) {
			effects.enter(MARKER);
			effects.consume(code);
			return after;
		}

		function after(code) {
			if (code !== close) return nok(code);
			effects.consume(code);
			effects.exit(MARKER);
			return ok;
		}
	}
}

/** mdast-util-from-markdown extension: the same nodes remark-math builds. */
export function mathBracketFromMarkdown() {
	return {
		enter: {
			[INLINE]: function enterInline(token) {
				enterMath.call(this, token, 'math-inline');
			},
			[DISPLAY]: function enterDisplay(token) {
				enterMath.call(this, token, 'math-display');
			},
		},
		exit: {
			[INLINE]: exitMath,
			[DISPLAY]: exitMath,
			[DATA]: function exitData(token) {
				this.config.enter.data.call(this, token);
				this.config.exit.data.call(this, token);
			},
		},
	};

	function enterMath(token, style) {
		this.enter(
			{
				type: 'inlineMath',
				value: '',
				data: { hName: 'code', hProperties: { className: ['language-math', style] }, hChildren: [] },
			},
			token,
		);
		this.buffer();
	}

	function exitMath(token) {
		const value = this.resume().trim();
		const node = this.stack[this.stack.length - 1];
		this.exit(token);
		node.value = value;
		node.data.hChildren.push({ type: 'text', value });
	}
}

function isDisplay(node) {
	return node.type === 'inlineMath' && node.data?.hProperties?.className?.includes('math-display');
}

function blockMath(node) {
	return {
		type: 'math',
		meta: null,
		value: node.value,
		position: node.position,
		data: {
			hName: 'pre',
			hChildren: [
				{
					type: 'element',
					tagName: 'code',
					properties: { className: ['language-math', 'math-display'] },
					children: [{ type: 'text', value: node.value }],
				},
			],
		},
	};
}

/** The paragraph's text around a display formula, without the line breaks that only separated them. */
function paragraphOf(children) {
	const first = children[0];
	const last = children[children.length - 1];
	if (first?.type === 'text') first.value = first.value.replace(/^\s+/, '');
	if (last?.type === 'text') last.value = last.value.replace(/\s+$/, '');
	const kept = children.filter((child) => child.type !== 'text' || child.value !== '');
	if (kept.length === 0) return null;
	const start = kept[0].position?.start;
	const end = kept[kept.length - 1].position?.end;
	return { type: 'paragraph', children: kept, ...(start && end ? { position: { start, end } } : {}) };
}

/** Nothing but a line break (or the paragraph's edge) on either side. */
function onOwnLines(children, index) {
	const before = children[index - 1];
	const after = children[index + 1];
	const clearBefore = !before || before.type === 'break' || (before.type === 'text' && /\n[ \t]*$/.test(before.value));
	const clearAfter = !after || after.type === 'break' || (after.type === 'text' && /^[ \t]*\n/.test(after.value));
	return clearBefore && clearAfter;
}

/** Lift display formulas that sit on their own lines out of their paragraph. */
function splitDisplayMath(tree) {
	const splits = [];
	visitParents(tree, 'paragraph', (paragraph, ancestors) => {
		if (paragraph.children.some(isDisplay)) splits.push({ paragraph, parent: ancestors[ancestors.length - 1] });
	});
	for (const { paragraph, parent } of splits) {
		const blocks = [];
		let run = [];
		const children = paragraph.children;
		children.forEach((child, index) => {
			if (!isDisplay(child) || !onOwnLines(children, index)) {
				run.push(child);
				return;
			}
			const text = paragraphOf(run);
			if (text) blocks.push(text);
			blocks.push(blockMath(child));
			run = [];
		});
		const rest = paragraphOf(run);
		if (rest) blocks.push(rest);
		const index = parent.children.indexOf(paragraph);
		if (index >= 0) parent.children.splice(index, 1, ...blocks);
	}
}
