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

import { paragraphParseSpec, paragraphSpec, serializeParagraph } from '../src/studio/editor/nodes/paragraph.ts';

const nodes = defaultMarkdownParser.schema.spec.nodes.remove('paragraph').append({ paragraph: paragraphSpec });
const schema = new Schema({ nodes, marks: defaultMarkdownParser.schema.spec.marks });
const parser = new MarkdownParser(schema, new MarkdownIt('commonmark'), {
	...defaultMarkdownParser.tokens,
	paragraph: paragraphParseSpec,
});
const serializer = new MarkdownSerializer(
	{ ...defaultMarkdownSerializer.nodes, paragraph: serializeParagraph },
	defaultMarkdownSerializer.marks,
);

function roundTrip(source: string): string {
	return serializer.serialize(parser.parse(source));
}

const losslessCases = [
	{ name: 'single paragraph', source: 'Hello' },
	{ name: 'two paragraphs', source: 'One\n\nTwo' },
	{ name: 'paragraph with marks', source: 'A *b* **c** `d` [e](https://x.y)' },
	{ name: 'paragraph around fence', source: 'Before\n\n```\ncode\n```\n\nAfter' },
	{ name: 'paragraph around heading', source: 'Intro\n\n# Title\n\nOutro' },
	{ name: 'chinese paragraph', source: '中文段落，第二句。' },
];

for (const fixture of losslessCases) {
	test(`paragraph round-trips ${fixture.name}`, () => {
		assert.equal(roundTrip(fixture.source), fixture.source);
	});
}

test('paragraph node lands with inline content', () => {
	const document = parser.parse('Hello *world*');
	const first = document.firstChild;
	assert.equal(first?.type.name, 'paragraph');
	assert.equal(first?.textContent, 'Hello world');
});

test('soft breaks inside paragraph normalize explicitly', () => {
	assert.equal(roundTrip('One\nTwo'), 'One Two');
});
