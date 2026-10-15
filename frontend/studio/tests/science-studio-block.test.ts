import assert from 'node:assert/strict';
import test from 'node:test';

import { Schema, Slice } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';

import {
	blockAt,
	parseScienceFence,
	scienceBlockKindLabel,
	scienceBlockMenuItems,
	scienceFenceMarkdown,
	scienceSourceEditor,
	structureDrawing,
	isEmptyMolfile,
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

function scienceSchema() {
	return new Schema({
		nodes: {
			doc: { content: 'block+' },
			text: { group: 'inline' },
			paragraph: { content: 'inline*', group: 'block' },
			'science-block': { content: 'text*', group: 'block', code: true, attrs: { language: { default: '' }, meta: { default: '' }, fence: { default: '' } } },
		} as never,
		marks: {},
	});
}

test('source popup edits SMILES inline and coordinate files below the block', () => {
	const smiles = scienceSourceEditor('SMILES');
	assert.equal(smiles.inline, true);
	assert.equal(smiles.label, 'SMILES');
	assert.match(smiles.placeholder, /SMILES/);
	for (const info of ['sdf', 'xyz', 'gjf', 'cube', 'sdf-3d']) {
		const editor = scienceSourceEditor(info);
		assert.equal(editor.inline, false, info);
		assert.match(editor.placeholder, /@file/, info);
	}
	assert.equal(scienceBlockKindLabel('sdf-3d'), 'sdf-3d');
	assert.equal(scienceBlockKindLabel('SMILES'), 'SMILES');
	assert.equal(scienceBlockKindLabel(''), '化学');
});

test('structure editor draws SMILES and flat SDF held in the block only', () => {
	const flat = 'water\n  ChemBlog\n\n  3  2  0  0  0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 O   0  0\n    0.7586    0.5043    0.0000 H   0  0\n   -0.7586    0.5043    0.0000 H   0  0\n  1  2  1  0\n  1  3  1  0\nM  END';
	const raised = flat.replace('0.5043    0.0000 H', '0.5043    0.8000 H');
	assert.equal(structureDrawing('smiles', 'CCO'), 'smiles');
	assert.equal(structureDrawing('SMILES', ''), 'smiles');
	assert.equal(structureDrawing('sdf', flat), 'molfile');
	assert.equal(structureDrawing('mol', ''), 'molfile');
	assert.equal(structureDrawing('sdf-2d', flat), 'molfile');
	assert.equal(structureDrawing('sdf', raised), null);
	assert.equal(structureDrawing('sdf-3d', flat), null);
	assert.equal(structureDrawing('xyz', '3\nwater\nO 0 0 0'), null);
	assert.equal(structureDrawing('sdf', '@file ./assets/water.sdf'), null);
	assert.equal(structureDrawing('sdf', '@file ../outside.sdf'), null);
	assert.equal(structureDrawing('python', 'print(1)'), null);
});

test('an empty page saves as a molfile with no atoms', () => {
	assert.equal(isEmptyMolfile('\n  Structura\n\n  0  0  0  0  0  0  0  0  0  0999 V2000\nM  END'), true);
	assert.equal(isEmptyMolfile(''), true);
	assert.equal(isEmptyMolfile('\n  Structura\n\n  1  0  0  0  0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 C   0  0\nM  END'), false);
	assert.equal(isEmptyMolfile('\n  Structura\n\n  0  0  0     0  0            999 V3000\nM  V30 BEGIN CTAB\nM  V30 COUNTS 0 0 0 0 0\nM  END'), true);
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
		science.create({ language: 'smiles' }, schema.text('CCO')),
	]);
	const block = blockAt(document, 6);
	assert.ok(block);
	assert.equal(block.node.type.name, SCIENCE_FENCE_TYPE);

	const converted = transformScienceBlock(document, block.pos, { type: 'convert', info: 'xyz' });
	assert.equal(converted.doc.child(0).textContent, 'keep');
	assert.equal(converted.doc.child(1).attrs.language, 'xyz');
	assert.equal(converted.doc.child(1).textContent, 'CCO');
	assert.equal(converted.cursor, block.pos + 1);

	const same = transformScienceBlock(converted.doc, block.pos, { type: 'convert', info: 'xyz' });
	assert.equal(same.doc, converted.doc);

	const inserted = transformScienceBlock(document, 0, { type: 'insert', info: 'cube' });
	assert.equal(inserted.doc.childCount, 3);
	assert.equal(inserted.doc.child(0).textContent, 'keep');
	assert.equal(inserted.doc.child(1).attrs.language, 'cube');
	assert.equal(inserted.doc.child(1).textContent, '');
	assert.equal(inserted.doc.child(2).textContent, 'CCO');

	const removed = transformScienceBlock(document, block.pos, { type: 'delete' });
	assert.equal(removed.doc.childCount, 1);
	assert.equal(removed.doc.child(0).textContent, 'keep');

	const only = schema.nodes.doc.create(null, [science.create({ language: 'gjf' }, schema.text('#p'))]);
	const cleared = transformScienceBlock(only, 0, { type: 'delete' });
	assert.equal(cleared.doc.childCount, 1);
	assert.equal(cleared.doc.child(0).type.name, 'paragraph');
	assert.equal(cleared.doc.child(0).textContent, '');

	const state = EditorState.create({ schema, doc: document });
	const tr = state.tr.replace(0, state.doc.content.size, new Slice(converted.doc.content, 0, 0));
	assert.equal(tr.doc.child(0).textContent, 'keep');
	assert.equal(tr.doc.child(1).attrs.language, 'xyz');
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
	assert.equal(edit.doc.child(0).attrs.language, 'smiles');
	assert.equal(edit.doc.child(0).textContent, 'CCO');
	const fence = edit.doc.child(0);
	assert.equal(transformScienceBlock(edit.doc, 0, { type: 'edit' }).cursor, fence.nodeSize - 1);
});

test('a bad @file path keeps the block a science block and never throws', () => {
	const descriptor = parseScienceFence('cube', '@file ../outside.cube');
	assert.ok(descriptor);
	assert.equal(descriptor.block, null);
	assert.match(descriptor.problem ?? '', /assets/);
	assert.equal(parseScienceFence('python', '@file ../x'), null);

});


test('changing the language keeps the fence’s meta and fence characters', () => {
	const schema = scienceSchema();
	const science = schema.nodes[SCIENCE_FENCE_TYPE];
	const document = schema.nodes.doc.create(null, [science.create({ language: 'sdf', meta: 'title="水"', fence: '~' }, schema.text('MOCK'))]);
	const converted = transformScienceBlock(document, 0, { type: 'convert', info: 'xyz' });
	assert.deepEqual({ ...converted.doc.child(0).attrs }, { language: 'xyz', meta: 'title="水"', fence: '~' });
});
