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

import { blockquoteParseSpec, blockquoteSpec, serializeBlockquote } from '../src/studio/editor/nodes/blockquote.ts';
import { hardBreakParseSpec, hardBreakSpec, serializeHardBreak } from '../src/studio/editor/nodes/hard-break.ts';
import {
	horizontalRuleParseSpec,
	horizontalRuleSpec,
	serializeHorizontalRule,
} from '../src/studio/editor/nodes/horizontal-rule.ts';
import { imageParseSpec, imageSpec, serializeImage } from '../src/studio/editor/nodes/image.ts';

const nodes = defaultMarkdownParser.schema.spec.nodes
	.remove('blockquote')
	.remove('horizontal_rule')
	.remove('hard_break')
	.remove('image')
	.append({
		blockquote: blockquoteSpec,
		horizontal_rule: horizontalRuleSpec,
		hard_break: hardBreakSpec,
		image: imageSpec,
	});
const schema = new Schema({ nodes, marks: defaultMarkdownParser.schema.spec.marks });
const parser = new MarkdownParser(schema, new MarkdownIt('commonmark'), {
	...defaultMarkdownParser.tokens,
	blockquote: blockquoteParseSpec,
	hr: horizontalRuleParseSpec,
	hardbreak: hardBreakParseSpec,
	image: imageParseSpec,
});
const serializer = new MarkdownSerializer(
	{
		...defaultMarkdownSerializer.nodes,
		blockquote: serializeBlockquote,
		horizontal_rule: serializeHorizontalRule,
		hard_break: serializeHardBreak,
		image: serializeImage,
	},
	defaultMarkdownSerializer.marks,
);

function roundTrip(source: string): string {
	return serializer.serialize(parser.parse(source));
}

const losslessCases = [
	{ name: 'blockquote', source: '> quote' },
	{ name: 'nested blockquote', source: '> a\n>\n> > b' },
	{ name: 'blockquote with heading', source: '> # Title\n>\n> text' },
	{ name: 'thematic break', source: '---' },
	{ name: 'image', source: '![alt](https://x.y/img.png)' },
	{ name: 'image with title', source: '![alt](https://x.y/img.png "cap")' },
	{ name: 'hard break', source: 'one\\\ntwo' },
	{ name: 'mixed small nodes', source: '> quote\n\n---\n\n![a](./b.png)' },
];

for (const fixture of losslessCases) {
	test(`small nodes round-trip ${fixture.name}`, () => {
		assert.equal(roundTrip(fixture.source), fixture.source);
	});
}

test('hr variants normalize to dashes explicitly', () => {
	assert.equal(roundTrip('***'), '---');
	assert.equal(roundTrip('___'), '---');
});

test('image attrs land on the node', () => {
	const document = parser.parse('![alt](./b.png "cap")');
	const image = document.firstChild?.firstChild;
	assert.equal(image?.type.name, 'image');
	assert.equal(image?.attrs.src, './b.png');
	assert.equal(image?.attrs.title, 'cap');
	assert.equal(image?.attrs.alt, 'alt');
});

test('two-space hard break normalizes to backslash explicitly', () => {
	assert.equal(roundTrip('one  \ntwo'), 'one\\\ntwo');
});

test('trailing hard break renders as nothing explicitly', () => {
	const paragraph = schema.nodes.paragraph.create(null, [
		schema.text('one'),
		schema.nodes.hard_break.create(),
	]);
	assert.equal(serializer.serialize(paragraph), 'one');
});
