import assert from 'node:assert/strict';
import test from 'node:test';

import { Fragment, Schema, Slice, type Node } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

import {
	expandInlineMathSlice,
	inlineMathKeyAction,
	literalDollarMarkName,
	planDollarBlock,
	planDollarEscape,
	planDollarMath,
	mathCommandSpans,
	openEmptyMathPair,
	planArmedFormula,
	openMathAround,
	planExpandInlineMath,
	planLiteralDollarChar,
	planMathSource,
	planPromoteInlineMath,
	readMathSource,
	splitInlineMath,
} from '../src/studio/editor/inline-math.ts';

function applyPlan(doc: Node, plan: { from: number; to: number; nodes: Node[] }) {
	return EditorState.create({ doc }).tr.replaceWith(plan.from, plan.to, plan.nodes).doc;
}

function editorSchema() {
	return new Schema({
		nodes: {
			doc: { content: 'block+' },
			text: { group: 'inline' },
			paragraph: { content: 'inline*', group: 'block' },
			heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } } },
			code_block: {
				content: 'text*',
				group: 'block',
				marks: '',
				code: true,
				attrs: { language: { default: '' } },
			},
			math_inline: {
				group: 'inline',
				inline: true,
				atom: true,
				attrs: { value: { default: '' } },
			},
			list_item: { content: 'paragraph block*', group: 'listItem' },
			bullet_list: { content: 'listItem+', group: 'block' },
		},
		marks: {
			code: {
				parseDOM: [{ tag: 'code' }],
				toDOM() {
					return ['code', 0];
				},
			},
			[literalDollarMarkName]: {
				toDOM() {
					return ['span', { 'data-literal-dollar': 'true' }, 0];
				},
			},
		},
	});
}

function paragraphDoc(schema: ReturnType<typeof editorSchema>, text: string) {
	return schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, text ? schema.text(text) : null));
}

test('a dollar stays as text until it closes a formula pair', () => {
	const schema = editorSchema();
	const hello = paragraphDoc(schema, 'hello');
	assert.deepEqual(planDollarMath(hello, 6, 6), { kind: 'literal', from: 6, to: 6 });
	assert.deepEqual(planDollarMath(hello, 2, 4), { kind: 'literal', from: 2, to: 4 });

	const formula = paragraphDoc(schema, '$x');
	assert.deepEqual(planDollarMath(formula, 3, 3), { kind: 'math', from: 1, to: 3, value: 'x' });
	const sum = paragraphDoc(schema, '$\\sum f(x)');
	assert.deepEqual(planDollarMath(sum, 11, 11), { kind: 'math', from: 1, to: 11, value: '\\sum f(x)' });
	const orbital = paragraphDoc(schema, '$2p');
	assert.deepEqual(planDollarMath(orbital, 4, 4), { kind: 'math', from: 1, to: 4, value: '2p' });
	const trailed = paragraphDoc(schema, '$\\sum f(x) ');
	const trailedAt = trailed.content.size - 1;
	assert.deepEqual(planDollarMath(trailed, trailedAt, trailedAt), {
		kind: 'math',
		from: 1,
		to: trailedAt,
		value: '\\sum f(x)',
	});
	const around = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, [
			schema.text('见 '),
			schema.nodes.math_inline.create({ value: 'a' }),
			schema.text('$y'),
		]),
	);
	assert.deepEqual(planDollarMath(around, 6, 6), { kind: 'math', from: 4, to: 6, value: 'y' });
	const spaced = paragraphDoc(schema, '$ ');
	assert.deepEqual(planDollarMath(spaced, 3, 3), { kind: 'literal', from: 3, to: 3 });
	const dollars = paragraphDoc(schema, '$$');
	assert.deepEqual(planDollarMath(dollars, 3, 3), { kind: 'literal', from: 3, to: 3 });
	const price = paragraphDoc(schema, '$20 和 ');
	assert.deepEqual(planDollarMath(price, 7, 7), { kind: 'literal', from: 7, to: 7 });
	const digit = paragraphDoc(schema, '$x2');
	assert.deepEqual(planDollarMath(digit, 3, 3), { kind: 'literal', from: 3, to: 3 });

	const escaped = paragraphDoc(schema, 'a\\');
	assert.deepEqual(planDollarMath(escaped, 3, 3), { kind: 'literal', from: 2, to: 3 });
	const doubled = paragraphDoc(schema, '\\\\');
	assert.deepEqual(planDollarMath(doubled, 3, 3), { kind: 'literal', from: 3, to: 3 });
	const triple = paragraphDoc(schema, '\\\\\\');
	assert.deepEqual(planDollarMath(triple, 4, 4), { kind: 'literal', from: 3, to: 4 });

	const code = schema.nodes.doc.create(null, schema.nodes.code_block.create({ language: '' }, schema.text('x')));
	assert.equal(planDollarMath(code, 2, 2), null);
	const marked = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, schema.text('ab', [schema.marks.code.create()])),
	);
	assert.equal(planDollarMath(marked, 2, 2), null);
	const heading = schema.nodes.doc.create(null, schema.nodes.heading.create({ level: 2 }, schema.text('标题')));
	assert.deepEqual(planDollarMath(heading, 3, 3), { kind: 'literal', from: 3, to: 3 });
});

test('a caret between $$ opens an empty inline formula', () => {
	const schema = editorSchema();
	const dollars = paragraphDoc(schema, '$$');
	assert.deepEqual(openEmptyMathPair(dollars, 2), { from: 1, to: 3 });
	assert.equal(openEmptyMathPair(dollars, 1), null);
	assert.equal(openEmptyMathPair(dollars, 3), null);
	const around = paragraphDoc(schema, 'a$$b');
	assert.deepEqual(openEmptyMathPair(around, 3), { from: 2, to: 4 });
	const formula = paragraphDoc(schema, '$x$');
	assert.equal(openEmptyMathPair(formula, 2), null);
	assert.equal(openEmptyMathPair(formula, 3), null);
	assert.equal(openEmptyMathPair(paragraphDoc(schema, '\\$$'), 3), null);
	const code = schema.nodes.doc.create(null, schema.nodes.code_block.create({ language: '' }, schema.text('$$')));
	assert.equal(openEmptyMathPair(code, 2), null);
	const literal = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, schema.text('$$', [schema.marks[literalDollarMarkName].create()])),
	);
	assert.equal(openEmptyMathPair(literal, 2), null);
	assert.equal(planMathSource(dollars, { from: 1, to: 3 }, { from: 2, to: 2 }).action, 'keep');
	assert.equal(planMathSource(dollars, { from: 1, to: 3 }, { from: 3, to: 3 }).action, 'clear');
});

test('a dollar that closed the previous formula can open the next one', () => {
	const schema = editorSchema();
	const doc = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, [
			schema.nodes.math_inline.create({ value: 'a' }),
			schema.text('bbb反'),
		]),
	);
	assert.deepEqual(planArmedFormula(doc, 2, 5), { from: 2, to: 5, value: 'bbb' });
	assert.equal(planArmedFormula(doc, 2, 2), null);
	assert.equal(planArmedFormula(doc, 2, 6), null);
	const spaced = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, [schema.nodes.math_inline.create({ value: 'a' }), schema.text(' b')]),
	);
	assert.equal(planArmedFormula(spaced, 2, 4), null);
	const trailed = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, [schema.nodes.math_inline.create({ value: 'a' }), schema.text('bbb ')]),
	);
	assert.deepEqual(planArmedFormula(trailed, 2, 6), { from: 2, to: 6, value: 'bbb' });
	const digit = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, [schema.nodes.math_inline.create({ value: 'a' }), schema.text('b2')]),
	);
	assert.equal(planArmedFormula(digit, 2, 3), null);
});

test('escape after one dollar inserts the closing dollar and a paragraph of $$ becomes a block on enter', () => {
	const schema = editorSchema();
	const one = paragraphDoc(schema, 'a$');
	assert.deepEqual(planDollarEscape(one, 3), { at: 3 });
	const two = paragraphDoc(schema, '$$');
	assert.equal(planDollarEscape(two, 3), null);
	assert.equal(planDollarEscape(two, 2), null);
	const escaped = paragraphDoc(schema, '\\$');
	assert.equal(planDollarEscape(escaped, 3), null);
	const literal = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, schema.text('$', [schema.marks[literalDollarMarkName].create()])),
	);
	assert.equal(planDollarEscape(literal, 2), null);

	const block = planDollarBlock(two, 3);
	assert.ok(block);
	assert.equal(block.nodes[0]?.type.name, 'code_block');
	assert.equal(block.nodes[0]?.attrs.language, 'LaTeX');
	assert.equal(planDollarBlock(two, 2), null);
	const replaced = applyPlan(two, block);
	assert.equal(replaced.nodeAt(block.cursor - 1)?.type.name, 'code_block');

	const item = schema.nodes.list_item.create(null, schema.nodes.paragraph.create(null, schema.text('$$')));
	const list = schema.nodes.doc.create(null, schema.nodes.bullet_list.create(null, item));
	const inList = planDollarBlock(list, 5);
	assert.ok(inList);
	assert.deepEqual(inList.nodes.map((node) => node.type.name), ['paragraph', 'code_block']);
	const listed = applyPlan(list, inList);
	assert.equal(listed.nodeAt(inList.cursor - 1)?.type.name, 'code_block');
});

test('an empty inline formula followed by another dollar becomes a LaTeX block', () => {
	const schema = editorSchema();
	const math = schema.nodes.math_inline.create({ value: '' });
	const alone = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, math));
	const promoted = planPromoteInlineMath(alone, 1);
	assert.ok(promoted);
	assert.equal(promoted.nodes.length, 1);
	assert.equal(promoted.nodes[0]?.type.name, 'code_block');
	assert.equal(promoted.nodes[0]?.attrs.language, 'LaTeX');
	assert.equal(promoted.cursor, 1);
	const replaced = applyPlan(alone, promoted);
	assert.equal(replaced.nodeAt(promoted.cursor - 1)?.type.name, 'code_block');

	const between = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, [schema.text('a'), math, schema.text('b')]),
	);
	const split = planPromoteInlineMath(between, 2);
	assert.ok(split);
	assert.deepEqual(split.nodes.map((node) => node.type.name), ['paragraph', 'code_block', 'paragraph']);
	assert.equal(split.nodes[0]?.textContent, 'a');
	assert.equal(split.nodes[2]?.textContent, 'b');
	applyPlan(between, split);

	const item = schema.nodes.list_item.create(null, schema.nodes.paragraph.create(null, math));
	const list = schema.nodes.doc.create(null, schema.nodes.bullet_list.create(null, item));
	const inList = planPromoteInlineMath(list, 3);
	assert.ok(inList);
	assert.deepEqual(inList.nodes.map((node) => node.type.name), ['paragraph', 'code_block']);
	const listed = applyPlan(list, inList);
	assert.equal(listed.nodeAt(inList.cursor - 1)?.type.name, 'code_block');
});

test('inline formula keys commit, leave, or delete the source', () => {
	assert.equal(inlineMathKeyAction('', 0, 0, '$'), 'commit');
	assert.equal(inlineMathKeyAction('a', 1, 1, '$'), 'commit');
	assert.equal(inlineMathKeyAction('\\', 1, 1, '$'), null);
	assert.equal(inlineMathKeyAction('a\\', 2, 2, '$'), null);
	assert.equal(inlineMathKeyAction('abc', 0, 3, 'Backspace'), 'delete');
	assert.equal(inlineMathKeyAction('abc', 1, 2, 'Backspace'), null);
	assert.equal(inlineMathKeyAction('', 0, 0, 'Delete'), 'delete');
	assert.equal(inlineMathKeyAction('abc', 0, 0, 'ArrowLeft'), 'exit-before');
	assert.equal(inlineMathKeyAction('abc', 1, 1, 'ArrowLeft'), null);
	assert.equal(inlineMathKeyAction('abc', 3, 3, 'ArrowRight'), 'exit-after');
	assert.equal(inlineMathKeyAction('abc', 2, 2, 'ArrowRight'), null);
	assert.equal(inlineMathKeyAction('abc', 1, 1, 'Enter'), 'commit');
	assert.equal(inlineMathKeyAction('', 0, 0, 'Escape'), 'commit');
});

test('pasted text closes $...$ even when the formula starts with a backslash', () => {
	assert.deepEqual(splitInlineMath('$\\sum f(x)$'), [{ kind: 'math', value: '\\sum f(x)' }]);
	assert.deepEqual(splitInlineMath('见 $\\sum f(x)$ 完'), [
		{ kind: 'text', text: '见 ' },
		{ kind: 'math', value: '\\sum f(x)' },
		{ kind: 'text', text: ' 完' },
	]);
	assert.equal(splitInlineMath('\\$\\sum f(x)\\$'), null);
	assert.equal(splitInlineMath('$$'), null);
	assert.equal(splitInlineMath('$20'), null);
	assert.deepEqual(splitInlineMath('$20 and $x$'), [
		{ kind: 'text', text: '$20 and ' },
		{ kind: 'math', value: 'x' },
	]);

	const schema = editorSchema();
	const paragraph = schema.nodes.paragraph.create(null, schema.text('见 $\\sum f(x)$'));
	const slice = new Slice(Fragment.from(paragraph), 0, 0);
	const expanded = expandInlineMathSlice(slice, schema.nodes.math_inline);
	assert.ok(expanded);
	const block = expanded.content.firstChild;
	assert.equal(block?.childCount, 2);
	assert.equal(block?.child(0).text, '见 ');
	assert.equal(block?.child(1).type.name, 'math_inline');
	assert.equal(block?.child(1).attrs.value, '\\sum f(x)');

	const code = schema.nodes.code_block.create({ language: '' }, schema.text('$\\sum f(x)$'));
	assert.equal(expandInlineMathSlice(new Slice(Fragment.from(code), 0, 0), schema.nodes.math_inline), null);
});

test('an escaped dollar does not open a formula', () => {
	const schema = editorSchema();
	const doc = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, [
			schema.text('$', [schema.marks[literalDollarMarkName].create()]),
			schema.text('x'),
		]),
	);
	assert.deepEqual(planDollarMath(doc, 3, 3), { kind: 'literal', from: 3, to: 3 });
});

test('a live pair stays as source until the caret leaves', () => {
	const schema = editorSchema();
	const doc = paragraphDoc(schema, '$x$');
	const live = { from: 1, to: 4 };
	assert.equal(readMathSource(doc, live.from, live.to)?.value, 'x');
	assert.equal(planMathSource(doc, null, { from: 4, to: 4 }).action, 'noop');
	assert.equal(planMathSource(doc, live, { from: 2, to: 2 }).action, 'keep');
	assert.equal(planMathSource(doc, live, { from: 3, to: 3 }).action, 'keep');
	const after = planMathSource(doc, live, { from: 4, to: 4 });
	assert.deepEqual(after, { action: 'collapse', from: 1, to: 4, value: 'x', cursor: 2 });
	const before = planMathSource(doc, live, { from: 1, to: 1 });
	assert.equal(before.action, 'collapse');
	if (before.action === 'collapse') assert.equal(before.cursor, 1);
	const empty = paragraphDoc(schema, '$$');
	assert.equal(planMathSource(empty, { from: 1, to: 3 }, { from: 2, to: 2 }).action, 'keep');
	assert.equal(planMathSource(empty, { from: 1, to: 3 }, { from: 3, to: 3 }).action, 'clear');
	const sum = paragraphDoc(schema, '$\\sum f(x)$');
	assert.equal(readMathSource(sum, 1, sum.content.size - 1)?.value, '\\sum f(x)');
	const trailed = paragraphDoc(schema, '$\\sum f(x) $');
	assert.equal(readMathSource(trailed, 1, trailed.content.size - 1)?.value, '\\sum f(x)');
});

test('formula source highlights latex commands', () => {
	assert.deepEqual(mathCommandSpans('$\\sin x$'), [{ from: 1, to: 5 }]);
	assert.deepEqual(mathCommandSpans('$a + \\frac{1}{2}$'), [{ from: 5, to: 10 }]);
	assert.deepEqual(mathCommandSpans('$$'), []);
});

test('a caret inside dollar text is a formula, and a literal dollar is not', () => {
	const schema = editorSchema();
	const text = '$\\sin x$';
	const doc = paragraphDoc(schema, text);
	const inside = openMathAround(doc, 1 + text.indexOf('sin'));
	assert.ok(inside);
	assert.equal(inside.value, '\\sin x');
	assert.equal(doc.textBetween(inside.from, inside.to), text);
	assert.equal(openMathAround(doc, 1 + text.length - 1)?.value, '\\sin x');
	assert.equal(openMathAround(doc, 1), null);
	assert.equal(openMathAround(doc, 1 + text.length), null);
	assert.equal(openMathAround(paragraphDoc(schema, '$$'), 2), null);
	assert.equal(openMathAround(paragraphDoc(schema, '$ x$'), 3), null);
	const code = schema.nodes.doc.create(null, schema.nodes.code_block.create({ language: '' }, schema.text(text)));
	assert.equal(openMathAround(code, 3), null);
	const literal = schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, [
			schema.text('$', [schema.marks[literalDollarMarkName].create()]),
			schema.text('\\sin x$'),
		]),
	);
	assert.equal(openMathAround(literal, 4), null);
	const escaped = paragraphDoc(schema, '\\$\\sin x$');
	assert.equal(openMathAround(escaped, 1 + escaped.textContent.indexOf('sin')), null);
});

test('entering a rendered formula expands the source around the caret', () => {
	const schema = editorSchema();
	const math = schema.nodes.math_inline.create({ value: 'x' });
	const doc = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, [schema.text('a'), math, schema.text('b')]));
	const start = planExpandInlineMath(doc, 2, 'start');
	assert.ok(start);
	assert.equal(start.text, '$x$');
	assert.equal(start.cursor, 3);
	const end = planExpandInlineMath(doc, 2, 'end');
	assert.ok(end);
	assert.equal(end.cursor, 4);
	const sum = planExpandInlineMath(
		schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, schema.nodes.math_inline.create({ value: '\\sum f(x)' }))),
		1,
		'end',
	);
	assert.equal(sum?.text, '$\\sum f(x)$');
	assert.equal(sum?.cursor, 1 + 1 + '\\sum f(x)'.length);
});

test('a paragraph that is only $$ keeps the next space as text', () => {
	const schema = editorSchema();
	const dollars = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, schema.text('$$')));
	assert.deepEqual(planLiteralDollarChar(dollars, 3, 3, ' '), { from: 3, to: 3, text: ' ' });
	assert.equal(planLiteralDollarChar(dollars, 2, 2, ' '), null);
	const hello = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, schema.text('hello')));
	assert.equal(planLiteralDollarChar(hello, 6, 6, ' '), null);
});

test('pasted text also closes \\(…\\), \\[…\\] and $$…$$, as AI answers write them', () => {
	assert.deepEqual(splitInlineMath('也就是 \\(x_1\\) 和 $y$'), [
		{ kind: 'text', text: '也就是 ' },
		{ kind: 'math', value: 'x_1', display: false },
		{ kind: 'text', text: ' 和 ' },
		{ kind: 'math', value: 'y' },
	]);
	assert.deepEqual(splitInlineMath('\\[ \\ce{F + CH3OH -> HF + CH2OH} \\]'), [
		{ kind: 'math', value: '\\ce{F + CH3OH -> HF + CH2OH}', display: true },
	]);
	assert.deepEqual(splitInlineMath('$$E = mc^2$$'), [{ kind: 'math', value: 'E = mc^2', display: true }]);
	assert.deepEqual(splitInlineMath('\\(\\alpha \\\\ \\beta\\)'), [{ kind: 'math', value: '\\alpha \\\\ \\beta', display: false }]);
	assert.equal(splitInlineMath('转义 \\\\(不是公式\\\\)'), null);
	assert.equal(splitInlineMath('未闭合 \\( a'), null);
	assert.equal(splitInlineMath('空的 \\(\\)'), null);
});

test('a pasted paragraph holding only a display formula becomes a LaTeX block', () => {
	const schema = editorSchema();
	const paragraph = (text: string) => schema.nodes.paragraph.create(null, schema.text(text));
	const answer = new Slice(
		Fragment.from([
			paragraph('这张文献能量图非常关键：'),
			paragraph('\\[ \\ce{F + CH3OH -> HF + CH2OH} \\]'),
			paragraph('也就是 \\(RC2 \\to TS2\\)。'),
		]),
		1,
		1,
	);
	const expanded = expandInlineMathSlice(answer, schema.nodes.math_inline);
	assert.ok(expanded);
	assert.equal(expanded.openStart, 1);
	assert.equal(expanded.openEnd, 1);
	const [first, block, last] = [expanded.content.child(0), expanded.content.child(1), expanded.content.child(2)];
	assert.equal(first.textContent, '这张文献能量图非常关键：');
	assert.equal(block.type.name, 'code_block');
	assert.equal(block.attrs.language, 'LaTeX');
	assert.equal(block.textContent, '\\ce{F + CH3OH -> HF + CH2OH}');
	assert.equal(last.child(1).type.name, 'math_inline');
	assert.equal(last.child(1).attrs.value, 'RC2 \\to TS2');

	const alone = expandInlineMathSlice(new Slice(Fragment.from(paragraph('$$\\sum_i x_i$$')), 1, 1), schema.nodes.math_inline);
	assert.ok(alone);
	assert.equal(alone.content.firstChild?.type.name, 'code_block');
	assert.equal(alone.openStart, 0);
	assert.equal(alone.openEnd, 0);

	const inSentence = expandInlineMathSlice(new Slice(Fragment.from(paragraph('句中 \\[x\\] 不拆')), 1, 1), schema.nodes.math_inline);
	assert.equal(inSentence?.content.firstChild?.type.name, 'paragraph');
	assert.equal(inSentence?.content.firstChild?.child(1).type.name, 'math_inline');
});
