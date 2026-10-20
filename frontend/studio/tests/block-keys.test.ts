import assert from 'node:assert/strict';
import test from 'node:test';

import { Schema, type Node as ProseNode } from 'prosemirror-model';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';

import { duplicateBlocks, linkInputRule, moveBlocks, selectBlockInHand, selectTextblock, todoInputRule, unlistAtStart, writeAtEnd } from '../src/studio/editor/block-keys.ts';
import { BlockRangeSelection, blockRangeKey } from '../src/studio/editor/block-range.ts';

const schema = new Schema({
	nodes: {
		doc: { content: 'block+' },
		text: { group: 'inline' },
		paragraph: { content: 'inline*', group: 'block' },
		blockquote: { content: 'block+', group: 'block' },
		list_item: {
			content: 'paragraph block*',
			group: 'listItem',
			attrs: { label: { default: '•' }, listType: { default: 'bullet' }, spread: { default: false }, checked: { default: null } },
		},
		bullet_list: { content: 'listItem+', group: 'block' },
	},
	marks: {
		link: { attrs: { href: {} } },
		strong: {},
	},
});

const p = (text: string) => schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
const li = (text: string) => schema.nodes.list_item.create(null, p(text));
const ul = (...items: string[]) => schema.nodes.bullet_list.create(null, items.map(li));
const doc = (...blocks: ProseNode[]) => schema.nodes.doc.create(null, blocks);

/** The state with the caret `offset` characters into the first block whose text is `text`. */
function caretIn(document: ProseNode, text: string, offset = 0): EditorState {
	let at = -1;
	document.descendants((node, pos) => {
		if (at < 0 && node.isTextblock && node.textContent === text) at = pos + 1 + offset;
	});
	assert.ok(at >= 0, text);
	return EditorState.create({ schema, doc: document, selection: TextSelection.create(document, at) });
}

function run(state: EditorState, command: (state: EditorState, dispatch: (tr: Transaction) => void) => boolean): EditorState {
	let next = state;
	assert.equal(command(state, (tr) => (next = state.apply(tr))), true);
	return next;
}

const texts = (state: EditorState) => {
	const out: string[] = [];
	state.doc.descendants((node) => {
		if (node.isTextblock) out.push(node.textContent);
	});
	return out;
};
const caretText = (state: EditorState) => state.selection.$from.parent.textContent;

test('⌘⇧↑ / ⌘⇧↓ move the block the caret is in, and the caret with it', () => {
	const start = caretIn(doc(p('one'), p('two'), p('three')), 'two', 2);
	const up = run(start, (state, dispatch) => moveBlocks(state, -1, dispatch));
	assert.deepEqual(texts(up), ['two', 'one', 'three']);
	assert.equal(caretText(up), 'two');
	assert.equal(up.selection.$from.parentOffset, 2);
	const down = run(start, (state, dispatch) => moveBlocks(state, 1, dispatch));
	assert.deepEqual(texts(down), ['one', 'three', 'two']);
	assert.equal(caretText(down), 'two');
});

test('at the top nothing moves, and the key is still taken', () => {
	const start = caretIn(doc(p('one'), p('two')), 'one');
	let dispatched = false;
	assert.equal(moveBlocks(start, -1, () => (dispatched = true)), true);
	assert.equal(dispatched, false);
});

test('a list item moves among its list’s items; a quote moves whole', () => {
	const listed = run(caretIn(doc(ul('a', 'b', 'c')), 'c'), (state, dispatch) => moveBlocks(state, -1, dispatch));
	assert.deepEqual(texts(listed), ['a', 'c', 'b']);
	assert.equal(listed.doc.childCount, 1);
	const quote = schema.nodes.blockquote.create(null, [p('q1'), p('q2')]);
	const quoted = run(caretIn(doc(p('before'), quote), 'q2'), (state, dispatch) => moveBlocks(state, -1, dispatch));
	assert.deepEqual(texts(quoted), ['q1', 'q2', 'before']);
	assert.equal(caretText(quoted), 'q2');
});

test('selected blocks move together and stay selected', () => {
	const document = doc(p('one'), p('two'), p('three'), p('four'));
	const second = document.child(0).nodeSize;
	const third = second + document.child(1).nodeSize;
	const selection = BlockRangeSelection.tryCreate(document, second, third);
	assert.ok(selection);
	const moved = run(EditorState.create({ schema, doc: document, selection }), (state, dispatch) => moveBlocks(state, 1, dispatch));
	assert.deepEqual(texts(moved), ['one', 'four', 'two', 'three']);
	assert.ok(moved.selection instanceof BlockRangeSelection);
	assert.equal(moved.doc.textBetween(moved.selection.from, moved.selection.to, '|'), 'two|three');
});

test('⌘D copies the block under it, the caret going into the copy', () => {
	const copied = run(caretIn(doc(p('one'), p('two')), 'one', 1), duplicateBlocks);
	assert.deepEqual(texts(copied), ['one', 'one', 'two']);
	assert.equal(copied.selection.from, copied.doc.child(0).nodeSize + 2);
	const items = run(caretIn(doc(ul('a', 'b')), 'a'), duplicateBlocks);
	assert.deepEqual(texts(items), ['a', 'a', 'b']);
	assert.equal(items.doc.child(0).childCount, 3);
});

test('Esc selects the block being written in; ↩ goes back to writing at its end', () => {
	const selected = run(caretIn(doc(p('one'), ul('a', 'b')), 'b', 0), selectBlockInHand);
	assert.ok(selected.selection instanceof BlockRangeSelection);
	assert.equal(selected.doc.textBetween(selected.selection.from, selected.selection.to), 'b');
	// Already selected: Esc is for going back, not for this.
	assert.equal(selectBlockInHand(selected), false);
	const back = run(selected, (state, dispatch) => blockRangeKey(state, { key: 'Enter' }, dispatch));
	assert.ok(back.selection instanceof TextSelection);
	assert.equal(caretText(back), 'b');
	assert.equal(back.selection.$from.parentOffset, 1);
	assert.deepEqual(texts(back), ['one', 'a', 'b']);
});

test('`[] ` makes a paragraph a to-do, and a list item one', () => {
	const typed = (document: ProseNode, text: string) => {
		const state = caretIn(document, text, text.length);
		const end = state.selection.from;
		const match = /^\[( |x|X)?\]\s$/u.exec(text);
		assert.ok(match);
		const tr = todoInputRule(state, match, end - text.length, end);
		assert.ok(tr);
		return state.apply(tr).doc;
	};
	const paragraph = typed(doc(p('[] ')), '[] ');
	assert.equal(paragraph.child(0).type.name, 'bullet_list');
	assert.equal(paragraph.child(0).child(0).attrs.checked, false);
	assert.equal(paragraph.textContent, '');
	const done = typed(doc(p('[x] ')), '[x] ');
	assert.equal(done.child(0).child(0).attrs.checked, true);
	const item = typed(doc(ul('[ ] ')), '[ ] ');
	assert.equal(item.child(0).childCount, 1);
	assert.equal(item.child(0).child(0).attrs.checked, false);
});

test('a click below the last block writes in an empty paragraph at the end, the one there if there is one', () => {
	const added = run(caretIn(doc(p('one'), ul('a')), 'one'), writeAtEnd);
	assert.deepEqual(texts(added), ['one', 'a', '']);
	assert.equal(added.doc.lastChild?.type.name, 'paragraph');
	assert.equal(added.selection.from, added.doc.content.size - 1);

	const again = run(added, writeAtEnd);
	assert.equal(again.doc.childCount, added.doc.childCount, 'no second empty paragraph');
	assert.equal(again.selection.from, again.doc.content.size - 1);
});

test('⌫ at the start of a list item makes it a line again, splitting the list; in a nested one, one level out', () => {
	const middle = run(caretIn(doc(ul('a', 'b', 'c')), 'b'), unlistAtStart);
	assert.deepEqual(middle.doc.toJSON().content.map((node: { type: string }) => node.type), ['bullet_list', 'paragraph', 'bullet_list']);
	assert.equal(caretText(middle), 'b');

	const inner = schema.nodes.list_item.create(null, [p('outer'), ul('inner')]);
	const nested = run(caretIn(doc(schema.nodes.bullet_list.create(null, inner)), 'inner'), unlistAtStart);
	assert.equal(nested.doc.childCount, 1);
	assert.deepEqual(texts(nested), ['outer', 'inner']);
	assert.equal(nested.doc.child(0).childCount, 2, 'inner is an item of the outer list now');

	// Not at the start, not in a list, or in a later paragraph of an item: not taken.
	assert.equal(unlistAtStart(caretIn(doc(ul('a')), 'a', 1)), false);
	assert.equal(unlistAtStart(caretIn(doc(p('a')), 'a')), false);
	const twoParagraphs = schema.nodes.list_item.create(null, [p('first'), p('second')]);
	assert.equal(unlistAtStart(caretIn(doc(schema.nodes.bullet_list.create(null, twoParagraphs)), 'second')), false);
});

test('⌘A selects the text of the block, then leaves the key to select everything', () => {
	const first = run(caretIn(doc(p('one'), p('two')), 'two', 1), selectTextblock);
	assert.equal(first.doc.textBetween(first.selection.from, first.selection.to), 'two');
	assert.equal(selectTextblock(first), false);
	assert.equal(selectTextblock(caretIn(doc(p('one'), p('')), '')), false, 'an empty line has nothing to select');
});

test('`[text](url)` typed becomes the text, linked, keeping its other marks', () => {
	const typed = '[see **this**](https://example.com)';
	const bold = schema.marks.strong.create();
	const paragraph = schema.nodes.paragraph.create(null, [schema.text('x '), schema.text(typed, [bold])]);
	const state = EditorState.create({ schema, doc: doc(paragraph) });
	const end = state.doc.content.size - 1;
	const match = /(?<!!)\[([^[\]]+)\]\(([^()\s]+)\)$/u.exec(state.doc.textBetween(1, end))!;
	const tr = linkInputRule(state, match, end - match[0].length, end)!;
	const linked = tr.doc.child(0).child(1);
	assert.equal(linked.text, 'see **this**');
	assert.equal(linked.marks.find((mark) => mark.type.name === 'link')?.attrs.href, 'https://example.com');
	assert.ok(linked.marks.some((mark) => mark.type.name === 'strong'));
	assert.equal(tr.storedMarks?.some((mark) => mark.type.name === 'link') ?? false, false, 'what is typed next is not linked');
});
