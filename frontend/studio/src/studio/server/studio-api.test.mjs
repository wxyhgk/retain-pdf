import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { Readable } from 'node:stream';
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
	process.env.STUDIO_BLOG_DIR = blogRoot;
	t.after(() => { delete process.env.STUDIO_BLOG_DIR; });
	studioDev().configureServer({
		config: { root: projectRoot },
		middlewares: { use(handler) { middleware = handler; } },
	});
	return Object.assign(middleware, { paths });
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

/** A request with a body, as the browser sends it from the Studio page. */
async function call(middleware, { url, method = 'POST', headers = {}, body }) {
	const request = Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(body)]), {
		url,
		method,
		headers: { origin: 'http://localhost:4321', ...headers },
		socket: { remoteAddress: '127.0.0.1' },
	});
	const response = {
		statusCode: 0,
		setHeader() {},
		end(text) { this.body = text; },
	};
	await middleware(request, response, () => assert.fail('Studio route unexpectedly called next()'));
	return { status: response.statusCode, data: JSON.parse(response.body) };
}

const asJson = (data) => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

test('file API lists, uploads, makes folders, moves and trashes', async (t) => {
	const middleware = await apiFixture(t);
	const base = '/api/studio/articles/api-note';

	const tree = await call(middleware, { url: `${base}/tree`, method: 'GET' });
	assert.equal(tree.status, 200);
	assert.ok(tree.data.entries.some((entry) => entry.path === 'assets/nested/water.xyz' && entry.size === 8));

	const upload = await call(middleware, {
		url: `${base}/files?folder=img&name=${encodeURIComponent('My Plot.png')}`,
		headers: { 'content-type': 'application/octet-stream' },
		body: 'png',
	});
	assert.deepEqual(upload, { status: 201, data: { path: 'img/My-Plot.png', size: 3 } });
	assert.equal(await readFile(join(middleware.paths.img, 'My-Plot.png'), 'utf8'), 'png');
	const nested = await call(middleware, {
		url: `${base}/files?folder=assets&subfolder=${encodeURIComponent('My Run/frames')}&name=1.xyz`,
		headers: { 'content-type': 'application/octet-stream' },
		body: 'xyz',
	});
	assert.deepEqual(nested, { status: 201, data: { path: 'assets/My-Run/frames/1.xyz', size: 3 } });

	assert.deepEqual(await call(middleware, { url: `${base}/folders`, ...asJson({ path: 'img/plots' }) }), { status: 201, data: { path: 'img/plots' } });
	const move = await call(middleware, { url: `${base}/move`, ...asJson({ from: 'img/My-Plot.png', to: 'img/plots/plot.png' }) });
	assert.equal(move.status, 200);
	assert.equal(move.data.path, 'img/plots/plot.png');
	assert.equal(move.data.references, 0);
	const trashed = await call(middleware, { url: `${base}/trash`, ...asJson({ path: 'img/plots/plot.png' }) });
	assert.equal(trashed.status, 200);
	assert.deepEqual(await readdir(join(middleware.paths.img, 'plots')), []);
	assert.equal(await readFile(trashed.data.trashedTo, 'utf8'), 'png');
});

test('file API reports refusals with their status', async (t) => {
	const middleware = await apiFixture(t);
	const base = '/api/studio/articles/api-note';
	const locked = await call(middleware, { url: `${base}/trash`, ...asJson({ path: 'index.md' }) });
	assert.equal(locked.status, 403);
	const taken = await call(middleware, { url: `${base}/move`, ...asJson({ from: 'assets/nested', to: 'assets/nested' }) });
	assert.equal(taken.status, 409);
	const missing = await call(middleware, { url: `${base}/move`, ...asJson({ from: 'img/none.png', to: 'img/b.png' }) });
	assert.equal(missing.status, 404);
	const outside = await call(middleware, { url: `${base}/folders`, ...asJson({ path: '../escape' }) });
	assert.equal(outside.status, 400);
	assert.deepEqual(await call(middleware, { url: `${base}/reveal`, ...asJson({ path: 'index.md' }) }), { status: 200, data: { path: 'index.md' } });
	assert.equal((await call(middleware, { url: `${base}/reveal`, ...asJson({ path: '../api-note' }) })).status, 400);
	assert.equal((await call(middleware, { url: `${base}/reveal`, ...asJson({ path: 'img/none.png' }) })).status, 404);
});

test('file API changes need the types a cross-site form cannot send', async (t) => {
	const middleware = await apiFixture(t);
	const base = '/api/studio/articles/api-note';
	const form = await call(middleware, {
		url: `${base}/trash`,
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: 'path=assets/nested/water.xyz',
	});
	assert.equal(form.status, 415);
	const plainUpload = await call(middleware, { url: `${base}/files?folder=img&name=a.png`, headers: { 'content-type': 'text/plain' }, body: 'x' });
	assert.equal(plainUpload.status, 415);
	const foreign = await call(middleware, { url: `${base}/trash`, headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{"path":"assets/nested/water.xyz"}' });
	assert.equal(foreign.status, 403);
	assert.equal(await readFile(join(middleware.paths.assets, 'nested', 'water.xyz'), 'utf8'), '3\nwater\n');
	const tooLarge = await call(middleware, {
		url: `${base}/files?folder=img&name=a.png`,
		headers: { 'content-type': 'application/octet-stream', 'content-length': String(65 * 1024 * 1024) },
	});
	assert.equal(tooLarge.status, 413);
});

test('file API moves a referenced file only for the article as saved', async (t) => {
	const middleware = await apiFixture(t);
	const base = '/api/studio/articles/api-note';
	const markdown = join(middleware.paths.directory, 'index.md');
	await writeFile(markdown, `${await readFile(markdown, 'utf8')}\n\`\`\`xyz\n@file ./assets/nested/water.xyz\n\`\`\`\n`);

	const stale = await call(middleware, { url: `${base}/move`, ...asJson({ from: 'assets/nested/water.xyz', to: 'assets/water.xyz', expectedRevision: 'old' }) });
	assert.equal(stale.status, 409);

	const article = await call(middleware, { url: '/api/studio/articles/api-note', method: 'GET' });
	const moved = await call(middleware, {
		url: `${base}/move`,
		...asJson({ from: 'assets/nested/water.xyz', to: 'assets/water.xyz', expectedRevision: article.data.revision }),
	});
	assert.equal(moved.status, 200);
	assert.equal(moved.data.references, 1);
	assert.match(await readFile(markdown, 'utf8'), /@file \.\/assets\/water\.xyz\n/u);
});

test('the events stream reports changes on disk until the page goes away', { timeout: 5000 }, async (t) => {
	const middleware = await apiFixture(t);
	const request = Object.assign(new EventEmitter(), {
		url: '/api/studio/events',
		method: 'GET',
		headers: {},
		socket: { remoteAddress: '127.0.0.1' },
	});
	const written = [];
	let notify = () => {};
	const response = {
		writeHead(status, headers) { this.status = status; this.headers = headers; },
		write(chunk) { written.push(chunk); notify(); },
	};
	await middleware(request, response, () => assert.fail('Studio route unexpectedly called next()'));
	assert.equal(response.status, 200);
	assert.match(response.headers['Content-Type'], /^text\/event-stream/u);

	const reported = new Promise((resolve) => {
		notify = () => {
			if (written.some((chunk) => chunk.includes('"assets/new.xyz"'))) resolve();
		};
	});
	await new Promise((resolve) => setTimeout(resolve, 100));
	await writeFile(join(middleware.paths.assets, 'new.xyz'), '1\n');
	await reported;
	const event = written.find((chunk) => chunk.includes('"assets/new.xyz"'));
	assert.ok(JSON.parse(event.replace(/^data: /u, '')).some((change) => change.slug === 'api-note'));

	request.emit('close');
	const count = written.length;
	await writeFile(join(middleware.paths.assets, 'later.xyz'), '1\n');
	await new Promise((resolve) => setTimeout(resolve, 300));
	assert.equal(written.length, count, 'nothing is sent after the page has gone');
});
