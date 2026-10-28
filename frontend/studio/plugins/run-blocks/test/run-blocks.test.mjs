import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { isResult, runnerOf } from '../run-blocks.mjs';
import { runBlock } from '../server.mjs';

test('a block runs in its article’s folder: what it wrote, how it ended; one that runs too long is stopped', async (t) => {
	const article = await mkdtemp(join(tmpdir(), 'run-block-'));
	t.after(() => rm(article, { recursive: true, force: true }));
	const done = await runBlock({ language: 'sh', code: 'echo 能量 -76.01\necho 出错了 >&2\ntouch made.txt\nexit 3', cwd: article, shell: '/bin/sh' });
	assert.equal(done.exitCode, 3);
	assert.match(done.output, /能量 -76\.01/u);
	assert.match(done.output, /出错了/u);
	assert.ok(existsSync(join(article, 'made.txt')));
	const node = await runBlock({ language: 'js', code: 'console.log(1 + 1)', cwd: article, shell: '/bin/sh' });
	assert.equal(node.output.trim(), '2');
	const slow = await runBlock({ language: 'sh', code: 'sleep 5', cwd: article, shell: '/bin/sh', limit: 300 });
	assert.match(slow.output, /停下了/u);
	assert.equal(slow.signal, 'SIGTERM');
	await assert.rejects(runBlock({ language: 'markdown', code: '#', cwd: article }), /不能运行/u);
	assert.equal(runnerOf('Python')?.program, 'python3');
	assert.ok(isResult('output', 'title="运行结果"'));
	assert.ok(!isResult('output', 'title="opt.log"'));
});
