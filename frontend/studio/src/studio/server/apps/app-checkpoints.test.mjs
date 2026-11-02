import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { AppCheckpoints } from './app-checkpoints.mjs';

test('an app’s code kept as it was and brought back: what was made since removed, its dependencies left alone, going back undone too', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'app-checkpoint-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const app = join(root, 'apps', 'units');
	const cache = join(root, 'cache');
	await mkdir(join(app, 'src'), { recursive: true });
	await mkdir(join(app, 'node_modules', 'lib'), { recursive: true });
	await writeFile(join(app, 'app.json'), '{"name":"换算"}');
	await writeFile(join(app, 'src', 'main.js'), 'export const x = 1;\n');
	await writeFile(join(app, 'node_modules', 'lib', 'index.js'), 'library');
	const checkpoints = new AppCheckpoints(cache);

	const kept = await checkpoints.save('units', app, '让 AI 改之前');
	assert.equal(kept.files, 2);
	assert.equal(existsSync(join(cache, 'units', kept.stamp, 'files', 'node_modules')), false);

	// The AI changes it: one file changed, one made, its dependencies changed too.
	await writeFile(join(app, 'src', 'main.js'), 'export const x = 2;\n');
	await writeFile(join(app, 'src', 'broken.js'), 'oops');
	await writeFile(join(app, 'node_modules', 'lib', 'index.js'), 'library 2');
	await checkpoints.restore('units', app, kept.stamp);
	assert.equal(await readFile(join(app, 'src', 'main.js'), 'utf8'), 'export const x = 1;\n');
	assert.equal(existsSync(join(app, 'src', 'broken.js')), false);
	assert.equal(await readFile(join(app, 'node_modules', 'lib', 'index.js'), 'utf8'), 'library 2');

	// How it was before going back is a checkpoint too, the latest.
	const listed = await checkpoints.list('units');
	assert.equal(listed.length, 2);
	assert.match(listed[0].why, /^回到 .* 的检查点之前$/u);
	await checkpoints.restore('units', app, listed[0].stamp);
	assert.equal(await readFile(join(app, 'src', 'broken.js'), 'utf8'), 'oops');

	await assert.rejects(checkpoints.restore('units', app, '../../etc'), /没有这个检查点/u);
});
