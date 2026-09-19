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

import { emMarkSerializer, emParseSpec, emSpec } from '../src/studio/editor/marks/em.ts';

const marks = defaultMarkdownParser.schema.spec.marks.remove('em').append({ em: emSpec });
const schema = new Schema({ nodes: defaultMarkdownParser.schema.spec.nodes, marks });
const parser = new MarkdownParser(schema, new MarkdownIt('commonmark'), {
	...defaultMarkdownParser.tokens,
	em: emParseSpec,
});
const serializer = new MarkdownSerializer(
	defaultMarkdownSerializer.nodes,
	{ ...defaultMarkdownSerializer.marks, em: emMarkSerializer },
);

function roundTrip(source: string): string {
	return serializer.serialize(parser.parse(source));
}

const losslessCases = [
	{ name: 'star emphasis', source: '*a*' },
	{ name: 'emphasis in paragraph', source: 'x *a* y' },
	{ name: 'emphasis around strong', source: '*a **b***' },
];

for (const fixture of losslessCases) {
	test(`em round-trips ${fixture.name}`, () => {
		assert.equal(roundTrip(fixture.source), fixture.source);
	});
}

test('em mark lands on text', () => {
	const document = parser.parse('x *a* y');
	const paragraph = document.firstChild;
	let found = '';
	paragraph?.descendants((node) => {
		if (node.isText && node.marks.some((mark) => mark.type.name === 'em')) found = node.text ?? '';
		return found === '';
	});
	assert.equal(found, 'a');
});

test('underscore emphasis normalizes to star explicitly', () => {
	assert.equal(roundTrip('_a_'), '*a*');
});
