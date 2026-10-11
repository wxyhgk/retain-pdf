import assert from 'node:assert/strict';
import test from 'node:test';

import { Schema, type Node } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

import {
	inlineMathKeyAction,
	planDollarBlock,
	planDollarEscape,
	planDollarMath,
	planLiteralDollarChar,
	planPromoteInlineMath,
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

test('escape after one dollar opens a formula and a paragraph of $$ becomes a block on enter', () => {
	const schema = editorSchema();
	const one = paragraphDoc(schema, 'a$');
	assert.deepEqual(planDollarEscape(one, 3), { from: 2, to: 3 });
	const two = paragraphDoc(schema, '$$');
	assert.equal(planDollarEscape(two, 3), null);
	assert.equal(planDollarEscape(two, 2), null);
	const escaped = paragraphDoc(schema, '\\$');
	assert.equal(planDollarEscape(escaped, 3), null);

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

test('a paragraph that is only $$ keeps the next space as text', () => {
	const schema = editorSchema();
	const dollars = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, schema.text('$$')));
	assert.deepEqual(planLiteralDollarChar(dollars, 3, 3, ' '), { from: 3, to: 3, text: ' ' });
	assert.equal(planLiteralDollarChar(dollars, 2, 2, ' '), null);
	const hello = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, schema.text('hello')));
	assert.equal(planLiteralDollarChar(hello, 6, 6, ' '), null);
});
