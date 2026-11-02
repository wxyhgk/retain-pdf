import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ArticleRepository } from '../articles/article-repository.mjs';
import { articleBundlePaths } from '../../../articles/bundle-paths.mjs';
import {
	byteRange,
	FileRepository,
	ResourceAccessError,
	ResourceTooLargeError,
	resourceContentType,
	validateResourcePath,
} from './file-repository.mjs';

async function fixture(t) {
	const root = await mkdtemp(join(tmpdir(), 'studio-files-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await new ArticleRepository(root).create({ slug: 'molecule-note', title: 'Molecule' });
	return { root, paths: articleBundlePaths(root, 'molecule-note') };
}

test('resource paths reject traversal, absolute paths, backslashes and NUL', () => {
	for (const resourcePath of ['../secret', 'nested/../secret', '/etc/passwd', 'C:/secret', 'a\\b', 'a\0b', 'a//b']) {
		assert.throws(() => validateResourcePath(resourcePath));
	}
	assert.deepEqual(validateResourcePath('trajectory/frames/water.xyz'), ['trajectory', 'frames', 'water.xyz']);
});

test('file repository lists and reads small public article resources', async (t) => {
	const { root, paths } = await fixture(t);
	await mkdir(join(paths.assets, 'trajectory'), { recursive: true });
	await writeFile(join(paths.assets, 'trajectory', 'water.xyz'), '3\nwater\n');
	await writeFile(join(paths.img, 'cover.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

	const repository = new FileRepository(root);
	assert.deepEqual(await repository.list('molecule-note'), {
		img: ['cover.png'],
		assets: ['trajectory/water.xyz'],
		ai: [],
	});
	const resource = await repository.read('molecule-note', 'assets', 'trajectory/water.xyz');
	assert.equal(resource.body.toString('utf8'), '3\nwater\n');
	assert.equal(resource.contentType, 'text/plain; charset=utf-8');
	assert.equal(resource.size, 8);
});

test('pictures show and calculation files open as text', () => {
	assert.equal(resourceContentType('img/scheme.svg'), 'image/svg+xml');
	assert.equal(resourceContentType('img/photo.AVIF'), 'image/avif');
	for (const path of ['assets/opt.log', 'assets/freq.out', 'assets/opt.inp', 'assets/water.fchk', 'assets/vasp/INCAR', 'assets/vasp/OUTCAR']) {
		assert.equal(resourceContentType(path), 'text/plain; charset=utf-8', path);
	}
	assert.equal(resourceContentType('assets/run.MP4'), 'video/mp4');
	assert.equal(resourceContentType('assets/run.webm'), 'video/webm');
	assert.equal(resourceContentType('assets/water.chk'), 'application/octet-stream');
	assert.equal(resourceContentType('assets/README'), 'application/octet-stream');
});

test('a Range header asks for part of a file: a video player seeking', () => {
	assert.equal(byteRange(undefined, 100), null);
	assert.deepEqual(byteRange('bytes=0-', 100), { start: 0, end: 99 });
	assert.deepEqual(byteRange('bytes=0-1', 100), { start: 0, end: 1 });
	assert.deepEqual(byteRange('bytes=90-200', 100), { start: 90, end: 99 });
	assert.deepEqual(byteRange('bytes=-10', 100), { start: 90, end: 99 });
	assert.equal(byteRange('bytes=100-', 100), 'unsatisfiable');
	// Not understood, or several at once: the whole file.
	assert.equal(byteRange('bytes=0-1,5-9', 100), null);
	assert.equal(byteRange('items=0-1', 100), null);
	assert.equal(byteRange('bytes=5-2', 100), null);
});

test('a file is streamed whole, or the bytes a Range asks for', async (t) => {
	const { root, paths } = await fixture(t);
	await writeFile(join(paths.assets, 'run.mp4'), '0123456789');
	const repository = new FileRepository(root);
	const read = async (resource) => {
		let text = '';
		for await (const chunk of resource.body) text += chunk;
		return text;
	};
	const whole = await repository.stream('molecule-note', 'assets', 'run.mp4');
	assert.equal(whole.range, null);
	assert.equal(await read(whole), '0123456789');
	const part = await repository.stream('molecule-note', 'assets', 'run.mp4', { range: 'bytes=2-4' });
	assert.deepEqual(part.range, { start: 2, end: 4 });
	assert.equal(part.contentType, 'video/mp4');
	assert.equal(await read(part), '234');
	const past = await repository.stream('molecule-note', 'assets', 'run.mp4', { range: 'bytes=10-' });
	assert.equal(past.range, 'unsatisfiable');
	assert.equal(past.body, null);
});

test('AI resources cannot be read through the public resource endpoint', async (t) => {
	const { root, paths } = await fixture(t);
	await writeFile(join(paths.ai, 'private.md'), 'private');
	const repository = new FileRepository(root);
	await assert.rejects(repository.read('molecule-note', 'ai', 'private.md'), ResourceAccessError);
});

test('file repository rejects symbolic links at every resource level', async (t) => {
	const { root, paths } = await fixture(t);
	const outside = await mkdtemp(join(tmpdir(), 'studio-files-outside-'));
	t.after(() => rm(outside, { recursive: true, force: true }));
	await writeFile(join(outside, 'secret.xyz'), 'secret');
	await symlink(join(outside, 'secret.xyz'), join(paths.assets, 'linked.xyz'));
	await symlink(outside, join(paths.assets, 'linked-directory'));

	const repository = new FileRepository(root);
	await assert.rejects(repository.read('molecule-note', 'assets', 'linked.xyz'), /符号链接/u);
	await assert.rejects(repository.read('molecule-note', 'assets', 'linked-directory/secret.xyz'), /符号链接/u);
	assert.deepEqual((await repository.list('molecule-note')).assets, []);
});

test('file repository enforces its read size limit before loading content', async (t) => {
	const { root, paths } = await fixture(t);
	await writeFile(join(paths.assets, 'large.xyz'), '12345');
	const repository = new FileRepository(root, { sizeLimit: 4 });
	await assert.rejects(repository.read('molecule-note', 'assets', 'large.xyz'), ResourceTooLargeError);
});
