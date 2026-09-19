import assert from 'node:assert/strict';
import test from 'node:test';

import MarkdownIt from 'markdown-it';
import { Schema } from 'prosemirror-model';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import {
	parseScienceFence,
	planScienceBlockConversion,
	runScienceBlockParse,
	runScienceBlockSerialize,
	scienceFenceMarkdown,
	scienceRetag,
	SCIENCE_FENCE_TYPE,
} from '../src/studio/editor/science-block.ts';

test('descriptor classifies scientific fences', () => {
	const smiles = parseScienceFence('smiles', 'CCO');
	assert.equal(smiles?.block?.language, 'smiles');
	assert.equal(smiles?.block?.view, '2d');
	const xyz = parseScienceFence('xyz', '1\nwater\nO 0 0 0');
	assert.equal(xyz?.block?.view, '3d');
	const auto = parseScienceFence('sdf', 'MOCK');
	assert.equal(auto?.block?.language, 'sdf');
	const file = parseScienceFence('cube', '@file ./assets/s0_homo.cube');
	assert.equal(file?.block?.resource.kind, 'file');
	assert.equal(parseScienceFence('python', 'print(1)'), null);
	assert.equal(parseScienceFence('', 'print(1)'), null);
});

test('descriptor keeps verbatim info and source', () => {
	const descriptor = parseScienceFence('SDF', 'MOCK')!;
	assert.equal(descriptor.info, 'SDF');
	assert.equal(scienceFenceMarkdown(descriptor), '```SDF\nMOCK\n```');
});

test('fence emission is byte-identical', () => {
	for (const source of ['```smiles\nCCO\n```', '```gjf\n#p HF\n\n0 1\nO\n```', '```cube-3d\nDATA\n```']) {
		const match = source.match(/^```([^\n]*)\n([\s\S]*)\n```$/);
		assert.ok(match);
		const descriptor = parseScienceFence(match[1], match[2])!;
		assert.equal(scienceFenceMarkdown(descriptor), source);
	}
});

test('retag claims scientific fences only', () => {
	const processor = unified().use(remarkParse).use(scienceRetag());
	const tree = processor.runSync(processor.parse('```sdf\nMOCK\n```\n\n```python\nprint(1)\n```\n'));
	const types = (tree.children as Array<{ type: string; lang?: string }>).map((child) => `${child.type}:${child.lang ?? ''}`);
	assert.deepEqual(types, [`${SCIENCE_FENCE_TYPE}:sdf`, 'code:python']);
});

test('parse runner opens a typed node with verbatim attrs', () => {
	const calls: Array<unknown> = [];
	runScienceBlockParse(
		{
			openNode: (type, attrs) => void calls.push(['open', type, attrs]),
			addText: (text) => void calls.push(['text', text]),
			closeNode: () => void calls.push(['close']),
		},
		{ lang: 'sdf-3d', value: 'MOCK' },
		'science-block-type',
	);
	assert.deepEqual(calls, [
		['open', 'science-block-type', { info: 'sdf-3d' }],
		['text', 'MOCK'],
		['close'],
	]);
});

test('serialize runner emits a plain fence', () => {
	const calls: Array<unknown> = [];
	runScienceBlockSerialize(
		{ addNode: (type, children, value, data) => void calls.push([type, value, data]) },
		{ attrs: { info: 'xyz' }, textContent: '1\nwater\nO 0 0 0' },
	);
	assert.deepEqual(calls, [['code', '1\nwater\nO 0 0 0', { lang: 'xyz' }]]);
});

test('conversion planner finds session-created science fences', () => {
	const nodes = {
		doc: { content: 'block+' },
		text: { group: 'inline' },
		paragraph: { content: 'inline*', group: 'block' },
		code_block: { content: 'text*', group: 'block', attrs: { params: { default: '' } } },
		'science-block': { content: 'text*', group: 'block', attrs: { info: { default: '' } } },
	};
	const schema = new Schema({ nodes: nodes as never, marks: {} });
	const document = schema.nodes.doc.create(null, [
		schema.nodes.paragraph.create(null, schema.text('hi')),
		schema.nodes.code_block.create({ params: 'sdf' }, schema.text('MOCK')),
		schema.nodes.code_block.create({ params: 'python' }, schema.text('print(1)')),
	]);
	const conversions = planScienceBlockConversion(document);
	assert.equal(conversions.length, 1);
	assert.equal(conversions[0].info, 'sdf');
	assert.equal(conversions[0].text, 'MOCK');
});
