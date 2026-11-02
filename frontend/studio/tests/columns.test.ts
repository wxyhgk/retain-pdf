import assert from 'node:assert/strict';
import test from 'node:test';

import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

import { Schema, type Node as ProseNode } from 'prosemirror-model';
import { EditorState, NodeSelection } from 'prosemirror-state';

import { addColumn, blockBeside, columnWidths, dropBeside, emptiedColumn, groupColumns, keptWidths, removeColumn, writeColumns } from '../src/studio/editor/columns-block.ts';

type Node = { type: string; value?: string; children?: Node[] };

const read = (markdown: string) => {
	const tree = unified().use(remarkParse).parse(markdown) as Node;
	groupColumns(tree);
	return tree;
};
const write = (tree: Node) => unified().use(remarkStringify, { bullet: '-', handlers: { columns: writeColumns } as never }).stringify(tree as never);

/** The tree as a short outline: `columns[column[paragraph] column[…]]`. */
const shape = (node: Node): string => (node.children ? `${node.type}[${node.children.map(shape).join(' ')}]` : node.type);

const two = '<div class="columns">\n<div>\n\n左栏\n\n</div>\n<div>\n\n右栏\n\n- 一\n- 二\n\n</div>\n</div>\n';

test('columns as the Studio writes them are read as columns, and written back the same', () => {
	const tree = read(`前\n\n${two}\n后\n`);
	assert.equal(shape(tree), 'root[paragraph[text] columns[column[paragraph[text]] column[paragraph[text] list[listItem[paragraph[text]] listItem[paragraph[text]]]]] paragraph[text]]');
	assert.equal(write(tree), `前\n\n${two}\n后\n`);
});

test('an empty column is read with an empty line, and written as an empty <div>', () => {
	const tree = read('<div class="columns">\n<div>\n\n</div>\n<div>\n\n右\n\n</div>\n</div>\n');
	assert.equal(shape(tree), 'root[columns[column[paragraph[]] column[paragraph[text]]]]');
	assert.equal(write(read('<div class="columns">\n<div>\n</div>\n<div>\n\n右\n\n</div>\n</div>\n')), '<div class="columns">\n<div>\n\n</div>\n<div>\n\n右\n\n</div>\n</div>\n');
});

test('columns in a column, and tags each on their own line with blank lines between, are read too', () => {
	const nested = `<div class="columns">\n<div>\n\n${two}\n</div>\n<div>\n\n外右\n\n</div>\n</div>\n`;
	const tree = read(nested);
	assert.match(shape(tree), /^root\[columns\[column\[columns\[column\[paragraph\[text\]\] column\[/u);
	assert.equal(write(tree), nested);
	const spaced = read('<div class="columns">\n\n<div>\n\n甲\n\n</div>\n\n<div>\n\n乙\n\n</div>\n\n</div>\n');
	assert.equal(shape(spaced), 'root[columns[column[paragraph[text]] column[paragraph[text]]]]');
});

test('HTML that is not columns as written, or does not close, is left as it is', () => {
	for (const markdown of [
		'<div class="columns">\n<div>\n\n只有一栏\n\n</div>\n</div>\n',
		'<div class="columns">\n<div>\n\n没关上\n',
		'<div class="columns" style="gap:0">\n<div>\n\n甲\n\n</div>\n<div>\n\n乙\n\n</div>\n</div>\n',
		'<div>\n\n普通的 div\n\n</div>\n',
	]) {
		assert.doesNotMatch(shape(read(markdown)), /columns/u, markdown);
	}
});

test('a column made wider says its share, which is read back and written again; equal ones say nothing', () => {
	const shared = '<div class="columns">\n<div style="flex: 1.5">\n\n宽\n\n</div>\n<div style="flex: 0.5">\n\n窄\n\n</div>\n</div>\n';
	const tree = read(shared);
	assert.deepEqual((tree.children![0] as Node & { widths?: number[] }).widths, [1.5, 0.5]);
	assert.equal(write(tree), shared);
	assert.equal((read(two).children![0] as Node & { widths?: unknown }).widths, null);
	assert.deepEqual(keptWidths([3, 1]), [1.5, 0.5]);
	assert.equal(keptWidths([2, 2, 2]), null);
});

const schema = new Schema({
	nodes: {
		doc: { content: 'block+' },
		text: { group: 'inline' },
		paragraph: { content: 'inline*', group: 'block' },
		columns: { content: 'column{2,}', group: 'block', attrs: { widths: { default: null } } },
		column: { content: 'block+', isolating: true },
	},
});
const p = (text: string) => schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
const col = (...blocks: ProseNode[]) => schema.nodes.column.create(null, blocks);
const cols = (widths: number[] | null, ...columns: ProseNode[]) => schema.nodes.columns.create({ widths }, columns);
const doc = (...blocks: ProseNode[]) => schema.nodes.doc.create(null, blocks);
const outline = (node: ProseNode): string =>
	node.isTextblock ? node.textContent || '∅' : `${node.type.name === 'doc' ? '' : node.type.name}${node.attrs.widths ? JSON.stringify(node.attrs.widths) : ''}(${node.content.content.map(outline).join(' ')})`;
const posOf = (node: ProseNode, text: string) => {
	let at = -1;
	node.descendants((child, pos) => {
		if (at < 0 && child.isTextblock && child.textContent === text) at = pos;
	});
	return at;
};
/** Drags the block holding `text` (as the handle does: it selected) and drops it on a side of the block holding `onto`. */
function drag(document: ProseNode, text: string, onto: string, side: 'left' | 'right') {
	const from = posOf(document, text);
	const state = EditorState.create({ doc: document, selection: NodeSelection.create(document, from) });
	const slice = state.selection.content();
	return dropBeside(state, { pos: posOf(document, onto), side }, slice, state.selection);
}

test('a block dropped on a side of another: the two in columns, the dragged one on that side', () => {
	const right = drag(doc(p('甲'), p('乙'), p('丙')), '甲', '丙', 'right')!;
	assert.equal(outline(right.doc), '(乙 columns(column(丙) column(甲)))');
	// The caret goes with the block: at its end.
	assert.equal(right.selection.$from.parent.textContent, '甲');
	assert.equal(right.selection.$from.parentOffset, 1);
	const left = drag(doc(p('甲'), p('乙')), '乙', '甲', 'left')!;
	assert.equal(outline(left.doc), '(columns(column(乙) column(甲)))');
});

test('dropped beside a block in columns: a column more there, as wide as they are on average', () => {
	const state = doc(p('外'), cols([1.5, 0.5], col(p('左')), col(p('右'))));
	assert.equal(outline(drag(state, '外', '右', 'left')!.doc), '(columns[1.5,1,0.5](column(左) column(外) column(右)))');
	// Out of one column beside another: the column it left, empty, goes.
	const moved = drag(doc(cols(null, col(p('甲')), col(p('乙')), col(p('丙')))), '甲', '丙', 'right')!;
	assert.equal(outline(moved.doc), '(columns(column(乙) column(丙) column(甲)))');
	// And with one left, its blocks are back in the article.
	const two = drag(doc(cols(null, col(p('甲')), col(p('乙'))), p('后')), '甲', '后', 'left')!;
	assert.equal(outline(two.doc), '(乙 columns(column(甲) column(后)))');
});

test('not dropped beside: onto itself, columns into columns, or columns already full', () => {
	assert.equal(drag(doc(p('甲'), p('乙')), '甲', '甲', 'right'), null);
	const full = doc(p('外'), cols(null, col(p('1')), col(p('2')), col(p('3')), col(p('4')), col(p('5'))));
	assert.equal(drag(full, '外', '3', 'right'), null);
	const nested = doc(cols(null, col(p('a')), col(p('b'))), p('外'));
	const state = EditorState.create({ doc: nested, selection: NodeSelection.create(nested, 0) });
	assert.equal(dropBeside(state, { pos: posOf(nested, '外'), side: 'left' }, state.selection.content(), state.selection), null);
});

test('the block beside which a drop goes: at the top of the article or of a column', () => {
	const document = doc(p('外'), cols(null, col(p('左'), p('左二')), col(p('右'))));
	const inLeft = blockBeside(document.resolve(posOf(document, '左二') + 1))!;
	assert.equal(inLeft.node.textContent, '左二');
	assert.equal(inLeft.inColumn, true);
	assert.equal(blockBeside(document.resolve(posOf(document, '外') + 1))!.inColumn, false);
});

test('a column taken away or added keeps the others\' shares', () => {
	const document = doc(cols([1.5, 1, 0.5], col(p('a')), col(p('b')), col(p('c'))));
	const state = EditorState.create({ doc: document });
	assert.equal(outline(removeColumn(state.tr, 0, 1).doc), '(columns[1.5,0.5](column(a) column(c)))');
	assert.equal(outline(addColumn(state.tr, 0, 3, p('d')).doc), '(columns[1.5,1,0.5,1](column(a) column(b) column(c) column(d)))');
	assert.deepEqual(columnWidths(cols([2], col(p('x')), col(p('y')))), [1, 1], 'shares that do not fit are none');
});

test('dragged out of a column as usual, the column left empty goes', () => {
	const document = doc(cols(null, col(p('甲')), col(p('乙'))), p('后'));
	const before = EditorState.create({ doc: document, selection: NodeSelection.create(document, posOf(document, '甲')) });
	// What a drop after 后 does: the block put there, then the selection deleted.
	const drop = before.tr.insert(document.content.size, p('甲'));
	drop.deleteSelection().setMeta('uiEvent', 'drop');
	const after = before.apply(drop);
	assert.equal(outline(after.doc), '(columns(column(∅) column(乙)) 后 甲)');
	const fixed = emptiedColumn([drop], before, after)!;
	assert.equal(outline(fixed.doc), '(乙 后 甲)');
	// A drop that did not empty it: nothing.
	assert.equal(emptiedColumn([before.tr.insertText('x', 1)], before, before), null);
});
