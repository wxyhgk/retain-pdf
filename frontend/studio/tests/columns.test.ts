import assert from 'node:assert/strict';
import test from 'node:test';

import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

import { groupColumns, writeColumns } from '../src/studio/editor/columns-block.ts';

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
