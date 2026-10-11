import assert from 'node:assert/strict';
import test from 'node:test';

import MarkdownIt from 'markdown-it';
import { Schema, Slice } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import {
	blockAt,
	parseScienceFence,
	planScienceBlockConversion,
	runScienceBlockParse,
	runScienceBlockSerialize,
	scienceBlockKindLabel,
	scienceBlockMenuItems,
	scienceBlockSurface,
	scienceFenceMarkdown,
	scienceRetag,
	transformScienceBlock,
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

function scienceSchema() {
	return new Schema({
		nodes: {
			doc: { content: 'block+' },
			text: { group: 'inline' },
			paragraph: { content: 'inline*', group: 'block' },
			'science-block': { content: 'text*', group: 'block', code: true, attrs: { info: { default: '' } } },
		} as never,
		marks: {},
	});
}

test('resting surface hides source until the block is empty or being edited', () => {
	assert.equal(scienceBlockSurface('CCO', false), 'preview');
	assert.equal(scienceBlockSurface('', false), 'compose');
	assert.equal(scienceBlockSurface('CCO', true), 'compose');
	assert.equal(scienceBlockKindLabel('sdf-3d'), 'sdf-3d');
	assert.equal(scienceBlockKindLabel('SMILES'), 'SMILES');
	assert.equal(scienceBlockKindLabel(''), '化学');
});

test('block menu edits, converts and deletes the selected block', () => {
	const science = scienceBlockMenuItems(SCIENCE_FENCE_TYPE, 'xyz');
	assert.equal(science[0]?.action.type, 'edit');
	assert.deepEqual(
		science.filter((item) => item.section === '转换').map((item) => item.id),
		['convert-smiles', 'convert-sdf', 'convert-xyz', 'convert-gjf', 'convert-cube'],
	);
	assert.equal(science.find((item) => item.id === 'convert-xyz')?.current, true);
	assert.equal(science.find((item) => item.id === 'convert-sdf')?.current, false);
	assert.equal(science.some((item) => item.action.type === 'insert'), false);
	assert.equal(science.at(-1)?.action.type, 'delete');
	const paragraph = scienceBlockMenuItems('paragraph', '');
	assert.equal(paragraph.some((item) => item.action.type === 'edit'), false);
	assert.equal(paragraph[0]?.section, '转换');
	assert.equal(paragraph.at(-1)?.label, '删除');
});

test('transform inserts, converts and deletes without touching sibling text', () => {
	const schema = scienceSchema();
	const science = schema.nodes[SCIENCE_FENCE_TYPE];
	const document = schema.nodes.doc.create(null, [
		schema.nodes.paragraph.create(null, schema.text('keep')),
		science.create({ info: 'smiles' }, schema.text('CCO')),
	]);
	const block = blockAt(document, 6);
	assert.ok(block);
	assert.equal(block.node.type.name, SCIENCE_FENCE_TYPE);

	const converted = transformScienceBlock(document, block.pos, { type: 'convert', info: 'xyz' });
	assert.equal(converted.doc.child(0).textContent, 'keep');
	assert.equal(converted.doc.child(1).attrs.info, 'xyz');
	assert.equal(converted.doc.child(1).textContent, 'CCO');
	assert.equal(converted.cursor, block.pos + 1);

	const same = transformScienceBlock(converted.doc, block.pos, { type: 'convert', info: 'xyz' });
	assert.equal(same.doc, converted.doc);

	const inserted = transformScienceBlock(document, 0, { type: 'insert', info: 'cube' });
	assert.equal(inserted.doc.childCount, 3);
	assert.equal(inserted.doc.child(0).textContent, 'keep');
	assert.equal(inserted.doc.child(1).attrs.info, 'cube');
	assert.equal(inserted.doc.child(1).textContent, '');
	assert.equal(inserted.doc.child(2).textContent, 'CCO');

	const removed = transformScienceBlock(document, block.pos, { type: 'delete' });
	assert.equal(removed.doc.childCount, 1);
	assert.equal(removed.doc.child(0).textContent, 'keep');

	const only = schema.nodes.doc.create(null, [science.create({ info: 'gjf' }, schema.text('#p'))]);
	const cleared = transformScienceBlock(only, 0, { type: 'delete' });
	assert.equal(cleared.doc.childCount, 1);
	assert.equal(cleared.doc.child(0).type.name, 'paragraph');
	assert.equal(cleared.doc.child(0).textContent, '');

	const state = EditorState.create({ schema, doc: document });
	const tr = state.tr.replace(0, state.doc.content.size, new Slice(converted.doc.content, 0, 0));
	assert.equal(tr.doc.child(0).textContent, 'keep');
	assert.equal(tr.doc.child(1).attrs.info, 'xyz');
	assert.equal(tr.doc.child(1).textContent, 'CCO');
	const cursor = Math.min(converted.cursor ?? 0, tr.doc.content.size);
	tr.setSelection(TextSelection.near(tr.doc.resolve(cursor)));
	assert.equal(tr.selection.$from.parent.type.name, SCIENCE_FENCE_TYPE);
});

test('convert turns a plain paragraph into a science block and keeps its text', () => {
	const schema = scienceSchema();
	const document = schema.nodes.doc.create(null, [schema.nodes.paragraph.create(null, schema.text('CCO'))]);
	const edit = transformScienceBlock(document, 0, { type: 'convert', info: 'smiles' });
	assert.equal(edit.doc.child(0).type.name, SCIENCE_FENCE_TYPE);
	assert.equal(edit.doc.child(0).attrs.info, 'smiles');
	assert.equal(edit.doc.child(0).textContent, 'CCO');
	const fence = edit.doc.child(0);
	assert.equal(transformScienceBlock(edit.doc, 0, { type: 'edit' }).cursor, fence.nodeSize - 1);
});
