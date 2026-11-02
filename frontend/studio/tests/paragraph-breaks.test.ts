import assert from 'node:assert/strict';
import test from 'node:test';

import { Schema, type Node } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';

import { softBreakTransaction } from '../src/studio/editor/paragraph-breaks.ts';

function editorSchema() {
	return new Schema({
		nodes: {
			doc: { content: 'block+' },
			text: { group: 'inline' },
			paragraph: { content: 'inline*', group: 'block' },
			hardbreak: {
				inline: true,
				group: 'inline',
				attrs: { isInline: { default: false } },
			},
			math_inline: {
				group: 'inline',
				inline: true,
				atom: true,
				attrs: { value: { default: '' } },
			},
			code_block: {
				content: 'text*',
				group: 'block',
				marks: '',
				code: true,
			},
			list_item: { content: 'paragraph block*', group: 'listItem' },
			bullet_list: { content: 'listItem+', group: 'block' },
		},
		marks: {},
	});
}

function apply(doc: Node): Node {
	const state = EditorState.create({ doc });
	return softBreakTransaction(state)?.doc ?? doc;
}

test('a soft break inside a paragraph becomes two paragraphs', () => {
	const schema = editorSchema();
	const doc = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, [
		schema.text('上一行'),
		schema.nodes.hardbreak.create({ isInline: true }),
		schema.text('下一行'),
	]));
	const next = apply(doc);
	assert.equal(next.childCount, 2);
	assert.equal(next.child(0).textContent, '上一行');
	assert.equal(next.child(1).textContent, '下一行');
	assert.equal(softBreakTransaction(EditorState.create({ doc: next })), null);
});

test('a newline character inside paragraph text becomes two paragraphs and keeps the caret on the second line', () => {
	const schema = editorSchema();
	const doc = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, schema.text('上一行\n下一行')));
	const cursor = 1 + '上一行\n'.length;
	const state = EditorState.create({ doc, selection: TextSelection.create(doc, cursor) });
	const tr = softBreakTransaction(state);
	assert.ok(tr);
	assert.equal(tr.doc.childCount, 2);
	assert.equal(tr.doc.child(0).textContent, '上一行');
	assert.equal(tr.doc.child(1).textContent, '下一行');
	assert.equal(tr.doc.resolve(tr.selection.from).parent.textContent, '下一行');
});

test('Shift-Enter hard breaks stay inside the paragraph', () => {
	const schema = editorSchema();
	const doc = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, [
		schema.text('上一行'),
		schema.nodes.hardbreak.create({ isInline: false }),
		schema.text('下一行'),
	]));
	assert.equal(softBreakTransaction(EditorState.create({ doc })), null);
	assert.equal(doc.child(0).child(1).attrs.isInline, false);
});

test('a formula stays in its paragraph when the following line splits off', () => {
	const schema = editorSchema();
	const doc = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, [
		schema.text('公式 '),
		schema.nodes.math_inline.create({ value: 'x' }),
		schema.text(' 之后'),
		schema.nodes.hardbreak.create({ isInline: true }),
		schema.text('下一行'),
	]));
	const next = apply(doc);
	assert.equal(next.childCount, 2);
	assert.equal(next.child(0).child(1).type.name, 'math_inline');
	assert.equal(next.child(0).textContent, '公式  之后');
	assert.equal(next.child(1).textContent, '下一行');
});

test('code blocks keep their newlines', () => {
	const schema = editorSchema();
	const doc = schema.nodes.doc.create(null, schema.nodes.code_block.create(null, schema.text('a\nb')));
	assert.equal(softBreakTransaction(EditorState.create({ doc })), null);
	assert.equal(doc.textContent, 'a\nb');
});

test('a soft break inside a list item splits that item into paragraphs', () => {
	const schema = editorSchema();
	const item = schema.nodes.list_item.create(null, schema.nodes.paragraph.create(null, [
		schema.text('甲'),
		schema.nodes.hardbreak.create({ isInline: true }),
		schema.text('乙'),
	]));
	const doc = schema.nodes.doc.create(null, schema.nodes.bullet_list.create(null, item));
	const next = apply(doc);
	const listItem = next.child(0).child(0);
	assert.equal(listItem.childCount, 2);
	assert.equal(listItem.child(0).textContent, '甲');
	assert.equal(listItem.child(1).textContent, '乙');
});
