import assert from 'node:assert/strict';
import test from 'node:test';

import { Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';

import { BlockRangeSelection, blockRangeKey, blockSpan, selectableBlock } from '../src/studio/editor/block-range.ts';

function editorSchema() {
	return new Schema({
		nodes: {
			doc: { content: 'block+' },
			text: { group: 'inline' },
			paragraph: { content: 'inline*', group: 'block' },
			heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } } },
			blockquote: { content: 'block+', group: 'block' },
			code_block: { content: 'text*', group: 'block', marks: '' },
			list_item: {
				content: 'paragraph block*',
				group: 'listItem',
				attrs: {
					label: { default: '•' },
					listType: { default: 'bullet' },
					spread: { default: false },
					checked: { default: null },
				},
			},
			bullet_list: { content: 'listItem+', group: 'block' },
			ordered_list: { content: 'listItem+', group: 'block' },
		},
		marks: {},
	});
}

function paragraph(type: ReturnType<typeof editorSchema>, text: string) {
	return type.nodes.paragraph.create(null, text ? type.text(text) : null);
}

function item(type: ReturnType<typeof editorSchema>, text: string) {
	return type.nodes.list_item.create({ label: '•', listType: 'bullet', spread: false, checked: null }, paragraph(type, text));
}

test('dragging across paragraphs selects whole blocks, including a reversed drag', () => {
	const type = editorSchema();
	const document = type.nodes.doc.create(null, [paragraph(type, 'one'), paragraph(type, 'two'), paragraph(type, 'three')]);
	const insideTwo = document.child(0).nodeSize + 1;
	const span = blockSpan(document, 1, insideTwo);
	assert.ok(span);
	assert.equal(document.textBetween(span.from, span.to, '\n'), 'one\ntwo');
	const reversed = blockSpan(document, document.content.size - 1, 1);
	assert.equal(reversed && document.textBetween(reversed.from, reversed.to, '\n'), 'one\ntwo\nthree');
	assert.equal(selectableBlock(document, insideTwo)?.node.type.name, 'paragraph');
});

test('a list drag selects items, and leaving the list selects the whole list', () => {
	const type = editorSchema();
	const list = type.nodes.bullet_list.create(null, [item(type, 'a'), item(type, 'b'), item(type, 'c')]);
	const lead = paragraph(type, 'before');
	const document = type.nodes.doc.create(null, [lead, list]);
	const listPos = lead.nodeSize;
	const firstItem = listPos + 1;
	const secondItem = firstItem + list.child(0).nodeSize;
	const insideFirst = firstItem + 2;
	const insideSecond = secondItem + 2;
	assert.equal(selectableBlock(document, insideFirst)?.node.type.name, 'list_item');
	const items = blockSpan(document, insideFirst, insideSecond);
	assert.ok(items);
	assert.equal(document.textBetween(items.from, items.to, '\n'), 'a\nb');
	assert.equal(items.to - items.from < list.nodeSize, true);

	const crossed = blockSpan(document, 1, insideFirst);
	assert.ok(crossed);
	assert.equal(document.textBetween(crossed.from, crossed.to, '\n'), 'before\na\nb\nc');

	const itemSelection = BlockRangeSelection.tryCreate(document, insideFirst, insideSecond);
	assert.ok(itemSelection);
	let state = EditorState.create({ schema: type, doc: document, selection: itemSelection });
	blockRangeKey(state, { key: 'Backspace' }, (tr) => {
		state = state.apply(tr);
	});
	assert.equal(state.doc.child(1).type.name, 'bullet_list');
	assert.equal(state.doc.child(1).childCount, 1);
	assert.equal(state.doc.textContent, 'beforec');

	const only = type.nodes.doc.create(null, [list]);
	const allItems = BlockRangeSelection.tryCreate(only, 2, only.content.size - 2);
	assert.ok(allItems);
	let cleared = EditorState.create({ schema: type, doc: only, selection: allItems });
	blockRangeKey(cleared, { key: 'Backspace' }, (tr) => {
		cleared = cleared.apply(tr);
	});
	assert.equal(cleared.doc.child(0).type.name, 'paragraph');
	assert.equal(cleared.doc.textContent, '');
});

test('backspace, typing, and arrows act on the block range', () => {
	const type = editorSchema();
	const document = type.nodes.doc.create(null, [paragraph(type, 'one'), paragraph(type, 'two'), paragraph(type, 'three')]);
	const selection = BlockRangeSelection.tryCreate(document, document.child(0).nodeSize, document.child(0).nodeSize);
	assert.ok(selection);
	let state = EditorState.create({ schema: type, doc: document, selection });
	assert.equal(state.selection instanceof BlockRangeSelection, true);
	assert.equal(blockRangeKey(state, { key: 'c', metaKey: true }, () => {
		throw new Error('shortcuts stay available');
	}), false);

	let deleted = state;
	blockRangeKey(state, { key: 'Backspace' }, (tr) => {
		deleted = state.apply(tr);
	});
	assert.equal(deleted.doc.childCount, 2);
	assert.equal(deleted.doc.textContent, 'onethree');
	assert.equal(deleted.selection instanceof BlockRangeSelection, false);

	let typed = state;
	blockRangeKey(state, { key: 'z' }, (tr) => {
		typed = state.apply(tr);
	});
	assert.equal(typed.doc.child(1).textContent, 'z');
	assert.equal(typed.doc.child(0).textContent, 'one');
	assert.equal(typed.doc.child(2).textContent, 'three');

	let moved = state;
	blockRangeKey(state, { key: 'ArrowDown', shiftKey: true }, (tr) => {
		moved = state.apply(tr);
	});
	assert.ok(moved.selection instanceof BlockRangeSelection);
	assert.equal(moved.doc.textBetween(moved.selection.from, moved.selection.to, '\n'), 'two\nthree');

	const quote = type.nodes.blockquote.create(null, [paragraph(type, 'inner')]);
	const quoted = type.nodes.doc.create(null, [quote]);
	assert.equal(selectableBlock(quoted, 2)?.node.type.name, 'blockquote');
});
