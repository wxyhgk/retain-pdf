import assert from 'node:assert/strict';
import test from 'node:test';

import MarkdownIt from 'markdown-it';
import { Schema } from 'prosemirror-model';
import {
	MarkdownParser,
	MarkdownSerializer,
	defaultMarkdownParser,
	defaultMarkdownSerializer,
} from 'prosemirror-markdown';

import {
	backticksFor,
	codeInlineParseSpec,
	codeMarkSerializer,
	codeMarkSpec,
} from '../src/studio/editor/marks/code.ts';

const marks = defaultMarkdownParser.schema.spec.marks.remove('code').append({ code: codeMarkSpec });
const schema = new Schema({ nodes: defaultMarkdownParser.schema.spec.nodes, marks });
const parser = new MarkdownParser(schema, new MarkdownIt('commonmark'), {
	...defaultMarkdownParser.tokens,
	code_inline: codeInlineParseSpec,
});
const serializer = new MarkdownSerializer(
	defaultMarkdownSerializer.nodes,
	{ ...defaultMarkdownSerializer.marks, code: codeMarkSerializer },
);

function roundTrip(source: string): string {
	return serializer.serialize(parser.parse(source));
}

const losslessCases = [
	{ name: 'code span', source: '`x`' },
	{ name: 'code span in paragraph', source: 'run `x` now' },
	{ name: 'code span holding backtick', source: '`` x ` y ``' },
];

for (const fixture of losslessCases) {
	test(`code round-trips ${fixture.name}`, () => {
		assert.equal(roundTrip(fixture.source), fixture.source);
	});
}

test('unpadded backtick span gains padding explicitly', () => {
	assert.equal(roundTrip('``x ` y``'), '`` x ` y ``');
});

test('code mark lands on text', () => {
	const document = parser.parse('run `x` now');
	let found = '';
	document.firstChild?.descendants((node) => {
		if (node.isText && node.marks.some((mark) => mark.type.name === 'code')) found = node.text ?? '';
		return found === '';
	});
	assert.equal(found, 'x');
});

test('backticksFor grows runs explicitly', () => {
	const parent = schema.nodes.paragraph.create(null, schema.text('a ` b'));
	assert.equal(backticksFor(parent.child(0), -1), '`` ');
	assert.equal(backticksFor(parent.child(0), 1), ' ``');
	const plain = schema.nodes.paragraph.create(null, schema.text('abc'));
	assert.equal(backticksFor(plain.child(0), -1), '`');
});
