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

import { headingParseSpec, headingSpec, serializeHeading } from '../src/studio/editor/nodes/heading.ts';

const nodes = defaultMarkdownParser.schema.spec.nodes.remove('heading').append({ heading: headingSpec });
const schema = new Schema({ nodes, marks: defaultMarkdownParser.schema.spec.marks });
const parser = new MarkdownParser(schema, new MarkdownIt('commonmark'), {
	...defaultMarkdownParser.tokens,
	heading: headingParseSpec,
});
const serializer = new MarkdownSerializer(
	{ ...defaultMarkdownSerializer.nodes, heading: serializeHeading },
	defaultMarkdownSerializer.marks,
);

function roundTrip(source: string): string {
	return serializer.serialize(parser.parse(source));
}

const losslessCases = [
	{ name: 'h1', source: '# Title' },
	{ name: 'h2', source: '## Title' },
	{ name: 'h3', source: '### Title' },
	{ name: 'h6', source: '###### Deep' },
	{ name: 'heading with marks', source: '## A *b* `c`' },
	{ name: 'heading among paragraphs', source: 'Intro\n\n# Title\n\nOutro' },
	{ name: 'chinese heading', source: '# 从 Hartree–Fock 方程开始' },
];

for (const fixture of losslessCases) {
	test(`heading round-trips ${fixture.name}`, () => {
		assert.equal(roundTrip(fixture.source), fixture.source);
	});
}

test('heading level lands on the node', () => {
	for (const level of [1, 2, 3, 4, 5, 6]) {
		const document = parser.parse(`${'#'.repeat(level)} T`);
		assert.equal(document.firstChild?.attrs.level, level);
	}
});

test('setext heading normalizes to atx explicitly', () => {
	assert.equal(roundTrip('Title\n==='), '# Title');
	assert.equal(roundTrip('Title\n---'), '## Title');
});

test('closed atx heading normalizes explicitly', () => {
	assert.equal(roundTrip('# Title #'), '# Title');
});
