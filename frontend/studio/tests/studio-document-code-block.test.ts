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
	codeBlockFenceParseSpec,
	codeBlockIndentedParseSpec,
	codeBlockSpec,
	isScienceLanguage,
	normalizeInfoString,
	SCIENCE_LANGUAGES,
	serializeCodeBlock,
} from '../src/studio/editor/nodes/code-block.ts';

const nodes = defaultMarkdownParser.schema.spec.nodes.remove('code_block').append({ code_block: codeBlockSpec });
const schema = new Schema({ nodes, marks: defaultMarkdownParser.schema.spec.marks });
const parser = new MarkdownParser(schema, new MarkdownIt('commonmark'), {
	...defaultMarkdownParser.tokens,
	code_block: codeBlockIndentedParseSpec,
	fence: codeBlockFenceParseSpec,
});
const serializer = new MarkdownSerializer(
	{ ...defaultMarkdownSerializer.nodes, code_block: serializeCodeBlock },
	defaultMarkdownSerializer.marks,
);

function roundTrip(source: string): string {
	return serializer.serialize(parser.parse(source));
}

const losslessCases = [
	{ name: 'plain fence', source: '```\ncode\n```' },
	{ name: 'fence with language', source: '```python\nprint(1)\n```' },
	{ name: 'smiles block', source: '```smiles\nCCO\n```' },
	{ name: 'sdf block', source: '```sdf\nwater\n  -OEChem-\n\n  3  0  0  0  0  0\n```' },
	{ name: 'xyz block', source: '```xyz\n1\nwater\nO 0 0 0\n```' },
	{ name: 'gjf block', source: '```gjf\n#p HF/6-31G\n\nwater\n\n0 1\nO\n```' },
	{ name: 'cube block', source: '```cube\nCUBE FILE\nOUTER LOOP\n```' },
	{ name: 'fence holding backticks grows longer', source: '````\n```\n````' },
	{
		name: 'fences among paragraphs',
		source: 'Before\n\n```sdf-3d\nMOCK\n```\n\nAfter',
	},
];

for (const fixture of losslessCases) {
	test(`code_block round-trips ${fixture.name}`, () => {
		assert.equal(roundTrip(fixture.source), fixture.source);
	});
}

test('fence params land on the node', () => {
	const document = parser.parse('```mol-2d key=value\nX\n```\n');
	let found = '';
	document.descendants((node) => {
		if (node.type.name === 'code_block') found = node.attrs.params;
		return found === '';
	});
	assert.equal(found, 'mol-2d key=value');
});

test('indented code normalizes to fenced', () => {
	assert.equal(roundTrip('    indented\n'), '```\nindented\n```');
});

test('empty fence normalizes explicitly', () => {
	assert.equal(roundTrip('```\n```\n'), '```\n\n```');
});

test('science language registry', () => {
	assert.equal(SCIENCE_LANGUAGES.length, 19);
	for (const language of SCIENCE_LANGUAGES) {
		assert.equal(isScienceLanguage(language), true);
	}
	assert.equal(isScienceLanguage('python'), false);
	assert.equal(isScienceLanguage('SDF'), false);
	assert.equal(normalizeInfoString('  sdf  '), 'sdf');
});
