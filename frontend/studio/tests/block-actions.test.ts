import assert from 'node:assert/strict';
import test from 'node:test';

import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';

import {
	applyBlockEdit,
	blockActionItems,
	blockKind,
	headingEnter,
	keyHint,
	planBlockEdit,
} from '../src/studio/editor/block-actions.ts';

function editorSchema() {
	return new Schema({
		nodes: {
			doc: { content: 'block+' },
			text: { group: 'inline' },
			paragraph: { content: 'inline*', group: 'block' },
			heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } } },
			blockquote: { content: 'block+', group: 'block' },
			code_block: { content: 'text*', group: 'block', code: true, marks: '', attrs: { language: { default: '' } } },
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
			bullet_list: { content: 'listItem+', group: 'block', attrs: { spread: { default: false } } },
			ordered_list: { content: 'listItem+', group: 'block', attrs: { order: { default: 1 }, spread: { default: false } } },
			callout: { content: 'block+', group: 'block', attrs: { kind: { default: 'note' } } },
			toggle: { content: 'block+', group: 'block', attrs: { summary: { default: '' }, open: { default: false } } },
		},
		marks: {},
	});
}

test('block menu offers writing transforms and marks the current kind', () => {
	const type = editorSchema();
	const nodes = type.nodes;
	const paragraph = blockActionItems(nodes.paragraph.create(null, type.text('a')));
	assert.equal(paragraph[0]?.label, '创建副本');
	assert.equal(paragraph.find((item) => item.id === 'turn-paragraph')?.current, true);
	assert.equal(paragraph.find((item) => item.id === 'turn-h2')?.current, false);
	assert.equal(paragraph.at(-1)?.action.type, 'delete');
	assert.equal(paragraph.some((item) => item.label === 'SMILES'), false);

	const heading = nodes.heading.create({ level: 2 }, type.text('标题'));
	assert.equal(blockKind(heading), 'h2');
	assert.equal(blockActionItems(heading).find((item) => item.id === 'turn-h2')?.current, true);

	const task = nodes.bullet_list.create(null, [
		nodes.list_item.create({ checked: false }, nodes.paragraph.create(null, type.text('做'))),
	]);
	assert.equal(blockKind(task), 'task');
	assert.equal(blockActionItems(task).find((item) => item.id === 'turn-task')?.current, true);
});

test('turning, duplicating and deleting one block leaves its sibling untouched', () => {
	const type = editorSchema();
	const nodes = type.nodes;
	const keep = nodes.paragraph.create(null, type.text('keep'));
	const document = nodes.doc.create(null, [keep, nodes.paragraph.create(null, type.text('body'))]);
	const turned = planBlockEdit(document, keep.nodeSize, { type: 'turn', kind: 'h2' });
	assert.ok(turned);
	const next = applyBlockEdit(document, turned);
	assert.equal(next.child(0), keep);
	assert.equal(next.child(1).type.name, 'heading');
	assert.equal(next.child(1).attrs.level, 2);
	assert.equal(next.child(1).textContent, 'body');
	assert.equal(planBlockEdit(next, keep.nodeSize, { type: 'turn', kind: 'h2' }), null);

	const copied = planBlockEdit(document, 0, { type: 'duplicate' });
	assert.ok(copied);
	const withCopy = applyBlockEdit(document, copied);
	assert.equal(withCopy.childCount, 3);
	assert.equal(withCopy.child(0).textContent, 'keep');
	assert.equal(withCopy.child(1).textContent, 'keep');
	assert.equal(withCopy.child(2).textContent, 'body');

	const removed = planBlockEdit(document, keep.nodeSize, { type: 'delete' });
	assert.ok(removed);
	assert.equal(applyBlockEdit(document, removed).textContent, 'keep');

	const only = nodes.doc.create(null, [nodes.paragraph.create(null, type.text('solo'))]);
	const cleared = planBlockEdit(only, 0, { type: 'delete' });
	assert.ok(cleared);
	const emptied = applyBlockEdit(only, cleared);
	assert.equal(emptied.childCount, 1);
	assert.equal(emptied.child(0).textContent, '');
});

test('a list turns into paragraphs and a paragraph turns into a list', () => {
	const type = editorSchema();
	const nodes = type.nodes;
	const item = (text: string) => nodes.list_item.create(null, nodes.paragraph.create(null, type.text(text)));
	const list = nodes.bullet_list.create(null, [item('one'), item('two')]);
	const document = nodes.doc.create(null, [list]);
	const lifted = planBlockEdit(document, 0, { type: 'turn', kind: 'paragraph' });
	assert.ok(lifted);
	const flat = applyBlockEdit(document, lifted);
	assert.equal(flat.childCount, 2);
	assert.equal(flat.child(0).textContent, 'one');
	assert.equal(flat.child(1).textContent, 'two');

	const paragraph = nodes.doc.create(null, [nodes.paragraph.create(null, type.text('note'))]);
	const bulleted = planBlockEdit(paragraph, 0, { type: 'turn', kind: 'bullet' });
	assert.ok(bulleted);
	const wrapped = applyBlockEdit(paragraph, bulleted);
	assert.equal(wrapped.child(0).type.name, 'bullet_list');
	assert.equal(wrapped.textContent, 'note');
	assert.equal(blockKind(wrapped.child(0)), 'bullet');
});

test('enter in a heading continues in a paragraph', () => {
	const type = editorSchema();
	const nodes = type.nodes;
	const document = nodes.doc.create(null, [
		nodes.heading.create({ level: 2 }, type.text('小节')),
		nodes.paragraph.create(null, type.text('after')),
	]);
	const atEnd = EditorState.create({
		schema: type,
		doc: document,
		selection: TextSelection.create(document, document.child(0).nodeSize - 1),
	});
	let ended = atEnd;
	assert.equal(headingEnter(atEnd, (tr) => {
		ended = atEnd.apply(tr);
	}), true);
	assert.equal(ended.doc.child(0).type.name, 'heading');
	assert.equal(ended.doc.child(0).textContent, '小节');
	assert.equal(ended.doc.child(1).type.name, 'paragraph');
	assert.equal(ended.doc.child(1).textContent, '');
	assert.equal(ended.doc.child(2).textContent, 'after');

	const atStart = EditorState.create({
		schema: type,
		doc: document,
		selection: TextSelection.create(document, 1),
	});
	let started = atStart;
	headingEnter(atStart, (tr) => {
		started = atStart.apply(tr);
	});
	assert.equal(started.doc.child(0).type.name, 'paragraph');
	assert.equal(started.doc.child(0).textContent, '');
	assert.equal(started.doc.child(1).type.name, 'heading');
	assert.equal(started.doc.child(1).textContent, '小节');
	assert.equal(started.selection.$from.parent.type.name, 'paragraph');

	const inMiddle = EditorState.create({
		schema: type,
		doc: document,
		selection: TextSelection.create(document, 2),
	});
	let split = inMiddle;
	headingEnter(inMiddle, (tr) => {
		split = inMiddle.apply(tr);
	});
	assert.equal(split.doc.child(0).type.name, 'heading');
	assert.equal(split.doc.child(0).textContent, '小');
	assert.equal(split.doc.child(1).type.name, 'paragraph');
	assert.equal(split.doc.child(1).textContent, '节');

	const paragraph = EditorState.create({
		schema: type,
		doc: nodes.doc.create(null, [nodes.paragraph.create(null, type.text('正文'))]),
	});
	assert.equal(headingEnter(paragraph, () => {
		throw new Error('paragraph should not handle enter');
	}), false);
});

test('the menu moves a block and tells each action’s key', () => {
	const type = editorSchema();
	const items = blockActionItems(type.nodes.paragraph.create(null, type.text('a')));
	assert.deepEqual(
		items.filter((item) => item.section === '操作').map((item) => [item.label, item.shortcut]),
		[['创建副本', 'Mod-d'], ['上移', 'Mod-Shift-ArrowUp'], ['下移', 'Mod-Shift-ArrowDown'], ['删除', 'Backspace']],
	);
	assert.equal(keyHint('Mod-Shift-ArrowUp', true), '⇧⌘↑');
	assert.equal(keyHint('Mod-d', true), '⌘D');
	assert.equal(keyHint('Backspace', true), '⌫');
	assert.equal(keyHint('Mod-Shift-ArrowDown', false), 'Ctrl+Shift+↓');
	assert.equal(keyHint('Mod-d', false), 'Ctrl+D');
});

test('a block turns into a callout or a toggle as it is, and back', () => {
	const type = editorSchema();
	const nodes = type.nodes;
	const list = nodes.bullet_list.create(null, [nodes.list_item.create(null, nodes.paragraph.create(null, type.text('项')))]);
	const document = nodes.doc.create(null, [list]);
	const callout = planBlockEdit(document, 0, { type: 'turn', kind: 'callout' });
	assert.ok(callout);
	const called = applyBlockEdit(document, callout);
	assert.equal(called.child(0).type.name, 'callout');
	assert.equal(called.child(0).attrs.kind, 'tip');
	// The list stays a list inside it.
	assert.equal(called.child(0).child(0), list);
	assert.equal(blockKind(called.child(0)), 'callout');
	assert.equal(blockActionItems(called.child(0)).find((item) => item.id === 'turn-callout')?.current, true);

	const toggle = planBlockEdit(called, 0, { type: 'turn', kind: 'toggle' });
	assert.ok(toggle);
	const toggled = applyBlockEdit(called, toggle);
	assert.equal(toggled.child(0).type.name, 'toggle');
	// From a callout, what the callout held.
	assert.equal(toggled.child(0).child(0), list);

	const back = planBlockEdit(toggled, 0, { type: 'turn', kind: 'paragraph' });
	assert.ok(back);
	const unwrapped = applyBlockEdit(toggled, back);
	assert.equal(unwrapped.child(0).type.name, 'paragraph');
	assert.equal(unwrapped.textContent, '项');
});
