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

import { isPlainUrl, linkMarkSerializer, linkParseSpec, linkSpec } from '../src/studio/editor/marks/link.ts';

const marks = defaultMarkdownParser.schema.spec.marks.remove('link').append({ link: linkSpec });
const schema = new Schema({ nodes: defaultMarkdownParser.schema.spec.nodes, marks });
const parser = new MarkdownParser(schema, new MarkdownIt('commonmark'), {
	...defaultMarkdownParser.tokens,
	link: linkParseSpec,
});
const serializer = new MarkdownSerializer(
	defaultMarkdownSerializer.nodes,
	{ ...defaultMarkdownSerializer.marks, link: linkMarkSerializer },
);

function roundTrip(source: string): string {
	return serializer.serialize(parser.parse(source));
}

const losslessCases = [
	{ name: 'inline link', source: '[text](https://x.y)' },
	{ name: 'link with title', source: '[text](https://x.y "cap")' },
	{ name: 'autolink', source: '<https://x.y>' },
	{ name: 'link in paragraph', source: 'see [text](https://x.y) now' },
];

for (const fixture of losslessCases) {
	test(`link round-trips ${fixture.name}`, () => {
		assert.equal(roundTrip(fixture.source), fixture.source);
	});
}

test('link attrs land on the mark', () => {
	const document = parser.parse('[text](https://x.y "cap")');
	let href = '';
	let title: string | null = null;
	document.firstChild?.descendants((node) => {
		const mark = node.marks.find((candidate) => candidate.type.name === 'link');
		if (mark) {
			href = mark.attrs.href;
			title = mark.attrs.title;
		}
		return href === '';
	});
	assert.equal(href, 'https://x.y');
	assert.equal(title, 'cap');
});

test('isPlainUrl matches default autolink detection', () => {
	const bare = parser.parse('<https://x.y>');
	const paragraph = bare.firstChild;
	const link = paragraph?.firstChild?.marks.find((mark) => mark.type.name === 'link');
	assert.equal(isPlainUrl(link!, paragraph!, 0), true);
	const titled = parser.parse('[x](https://x.y "t")');
	const titledParagraph = titled.firstChild;
	const titledLink = titledParagraph?.firstChild?.marks.find((mark) => mark.type.name === 'link');
	assert.equal(isPlainUrl(titledLink!, titledParagraph!, 0), false);
});
