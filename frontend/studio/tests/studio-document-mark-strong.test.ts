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

import { strongMarkSerializer, strongParseSpec, strongSpec } from '../src/studio/editor/marks/strong.ts';

const marks = defaultMarkdownParser.schema.spec.marks.remove('strong').append({ strong: strongSpec });
const schema = new Schema({ nodes: defaultMarkdownParser.schema.spec.nodes, marks });
const parser = new MarkdownParser(schema, new MarkdownIt('commonmark'), {
	...defaultMarkdownParser.tokens,
	strong: strongParseSpec,
});
const serializer = new MarkdownSerializer(
	defaultMarkdownSerializer.nodes,
	{ ...defaultMarkdownSerializer.marks, strong: strongMarkSerializer },
);

function roundTrip(source: string): string {
	return serializer.serialize(parser.parse(source));
}

const losslessCases = [
	{ name: 'strong', source: '**a**' },
	{ name: 'strong in paragraph', source: 'x **a** y' },
	{ name: 'strong around em', source: '**a *b***' },
];

for (const fixture of losslessCases) {
	test(`strong round-trips ${fixture.name}`, () => {
		assert.equal(roundTrip(fixture.source), fixture.source);
	});
}

test('strong mark lands on text', () => {
	const document = parser.parse('x **a** y');
	let found = '';
	document.firstChild?.descendants((node) => {
		if (node.isText && node.marks.some((mark) => mark.type.name === 'strong')) found = node.text ?? '';
		return found === '';
	});
	assert.equal(found, 'a');
});

test('underscore strong normalizes explicitly', () => {
	assert.equal(roundTrip('__a__'), '**a**');
});
