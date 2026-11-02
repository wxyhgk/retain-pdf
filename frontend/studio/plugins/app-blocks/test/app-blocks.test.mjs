import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { VFile } from 'vfile';

import { blockHeight, picturePath, stateHash } from '../app-blocks.mjs';
import { appBlocks, blockPicture } from '../build.mjs';

test('a block’s picture is named by what it holds: the same state the same, another another', () => {
	assert.equal(stateHash('{"n":1}\n'), stateHash('{"n":1}'));
	assert.notEqual(stateHash('{"n":1}'), stateHash('{"n":2}'));
	assert.match(picturePath('structura', '{"a":1}'), /^assets\/structura-[0-9a-z]+\.svg$/u);
	assert.match(picturePath('structura', '{"a":1}', 'image/png'), /\.png$/u);
	assert.equal(blockHeight('title="x" height=300', 420), 300);
	assert.equal(blockHeight('', 420), 420);
});

test('the blocks the apps give, read from their app.json; on the blog each is its picture, or left out and said', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'app-blocks-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, 'apps', 'mol'), { recursive: true });
	await writeFile(join(root, 'apps', 'mol', 'app.json'), JSON.stringify({ name: '分子', blocks: [{ fence: 'molblock', entry: 'block.html', title: '结构式' }, { fence: 'Bad Fence' }] }));
	await mkdir(join(root, 'apps', 'plain'));
	await writeFile(join(root, 'apps', 'plain', 'app.json'), JSON.stringify({ name: '无块' }));
	const blocks = appBlocks(join(root, 'apps'));
	assert.deepEqual(blocks, [{ fence: 'molblock', title: '结构式', app: 'mol' }]);

	const article = join(root, 'blog', 'note');
	await mkdir(join(article, 'assets'), { recursive: true });
	const state = '{"smiles":"CCO"}';
	await writeFile(join(article, picturePath('molblock', state)), '<svg/>');
	const file = new VFile({ path: join(article, 'index.md') });
	assert.deepEqual(blockPicture(blocks[0], { type: 'code', lang: 'molblock', value: state }, file), {
		type: 'paragraph',
		children: [{ type: 'image', url: `./${picturePath('molblock', state)}`, alt: '结构式' }],
	});
	assert.deepEqual(blockPicture(blocks[0], { type: 'code', lang: 'molblock', value: '{"smiles":"C"}' }, file), { type: 'html', value: '' });
	assert.equal(file.messages.length, 1);
	assert.equal(file.messages[0].ruleId, 'app-block-picture');
});
