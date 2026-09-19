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
	bulletListParseSpec,
	bulletListSpec,
	isListTight,
	listItemParseSpec,
	listItemSpec,
	orderedListParseSpec,
	orderedListSpec,
	serializeBulletList,
	serializeListItem,
	serializeOrderedList,
} from '../src/studio/editor/nodes/list.ts';

const nodes = defaultMarkdownParser.schema.spec.nodes
	.remove('bullet_list')
	.remove('ordered_list')
	.remove('list_item')
	.append({ bullet_list: bulletListSpec, ordered_list: orderedListSpec, list_item: listItemSpec });
const schema = new Schema({ nodes, marks: defaultMarkdownParser.schema.spec.marks });
const parser = new MarkdownParser(schema, new MarkdownIt('commonmark'), {
	...defaultMarkdownParser.tokens,
	bullet_list: bulletListParseSpec,
	ordered_list: orderedListParseSpec,
	list_item: listItemParseSpec,
});
const serializer = new MarkdownSerializer(
	{
		...defaultMarkdownSerializer.nodes,
		bullet_list: serializeBulletList,
		ordered_list: serializeOrderedList,
		list_item: serializeListItem,
	},
	defaultMarkdownSerializer.marks,
);

function roundTrip(source: string): string {
	return serializer.serialize(parser.parse(source));
}

const losslessCases = [
	{ name: 'tight bulleted list', source: '* a\n* b' },
	{ name: 'loose bulleted list', source: '* a\n\n* b' },
	{ name: 'ordered list', source: '1. a\n2. b' },
	{ name: 'ordered list with start', source: '3. a\n4. b' },
	{ name: 'nested list', source: '* a\n  * b\n  * c\n* d' },
	{ name: 'list with fence item', source: '* text\n* ```\n  code\n  ```' },
	{ name: 'list among paragraphs', source: 'Before\n\n* a\n* b\n\nAfter' },
];

for (const fixture of losslessCases) {
	test(`list round-trips ${fixture.name}`, () => {
		assert.equal(roundTrip(fixture.source), fixture.source);
	});
}

test('tight flag and order land on nodes', () => {
	const tight = parser.parse('* a\n* b');
	assert.equal(tight.firstChild?.attrs.tight, true);
	const loose = parser.parse('* a\n\n* b');
	assert.equal(loose.firstChild?.attrs.tight, false);
	const ordered = parser.parse('3. a\n4. b');
	assert.equal(ordered.firstChild?.attrs.order, 3);
});

test('dash and plus bullets normalize to star explicitly', () => {
	assert.equal(roundTrip('- a'), '* a');
	assert.equal(roundTrip('+ a'), '* a');
});

test('isListTight matches default tight detection', () => {
	const hidden = { type: 'paragraph_open', hidden: true } as never;
	const shown = { type: 'paragraph_open', hidden: false } as never;
	assert.equal(isListTight([hidden, shown], -1), true);
	assert.equal(isListTight([shown, hidden], -1), false);
	assert.equal(isListTight([{ type: 'list_item_open', hidden: true } as never], 0), false);
});
