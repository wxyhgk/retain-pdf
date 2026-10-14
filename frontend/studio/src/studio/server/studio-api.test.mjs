import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import studioDev from '../../plugins/studio-dev.mjs';
import { ArticleRepository } from './article-repository.mjs';
import { articleBundlePaths } from './bundle-paths.mjs';

async function apiFixture(t) {
	const projectRoot = await mkdtemp(join(tmpdir(), 'studio-api-'));
	t.after(() => rm(projectRoot, { recursive: true, force: true }));
	const blogRoot = join(projectRoot, 'blog');
	await mkdir(blogRoot);
	await new ArticleRepository(blogRoot).create({ slug: 'api-note', title: 'API note' });
	const paths = articleBundlePaths(blogRoot, 'api-note');
	await mkdir(join(paths.assets, 'nested'), { recursive: true });
	await writeFile(join(paths.assets, 'nested', 'water.xyz'), '3\nwater\n');
	await writeFile(join(paths.ai, 'private.md'), 'private');

	let middleware;
	studioDev().configureServer({
		config: { root: projectRoot },
		middlewares: { use(handler) { middleware = handler; } },
	});
	return middleware;
}

async function get(middleware, url) {
	const headers = new Map();
	const response = {
		statusCode: 0,
		setHeader(name, value) { headers.set(name.toLowerCase(), value); },
		end(body) { this.body = body; },
	};
	await middleware({
		url,
		method: 'GET',
		headers: {},
		socket: { remoteAddress: '127.0.0.1' },
	}, response, () => assert.fail('Studio route unexpectedly called next()'));
	return { response, headers };
}

test('GET resource API returns a small file with defensive headers', async (t) => {
	const middleware = await apiFixture(t);
	const { response, headers } = await get(middleware, '/api/studio/articles/api-note/files/assets/nested/water.xyz');
	assert.equal(response.statusCode, 200);
	assert.equal(response.body.toString('utf8'), '3\nwater\n');
	assert.equal(headers.get('content-type'), 'text/plain; charset=utf-8');
	assert.equal(headers.get('x-content-type-options'), 'nosniff');
	assert.equal(headers.get('content-security-policy'), 'sandbox');
});

test('GET resource API rejects AI files and traversal before URL normalization', async (t) => {
	const middleware = await apiFixture(t);
	const ai = await get(middleware, '/api/studio/articles/api-note/files/ai/private.md');
	assert.equal(ai.response.statusCode, 403);

	const traversal = await get(middleware, '/api/studio/articles/api-note/files/assets/%2e%2e/ai/private.md');
	assert.equal(traversal.response.statusCode, 400);
	assert.match(JSON.parse(traversal.response.body).error, /\.\.|相对路径/u);

	const absolute = await get(middleware, '/api/studio/articles/api-note/files/assets/%2Fetc%2Fpasswd');
	assert.equal(absolute.response.statusCode, 400);
});
