import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { pictureSizes, picturesIn, sizeOf } from './picture-sizes.mjs';

/** The start of a PNG of this size: its signature and its header chunk. */
function png(width, height) {
	const bytes = Buffer.alloc(33);
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
	bytes.writeUInt32BE(13, 8);
	bytes.write('IHDR', 12, 'latin1');
	bytes.writeUInt32BE(width, 16);
	bytes.writeUInt32BE(height, 20);
	return bytes;
}

/** A JPEG's start: an APP0 segment first (as a camera's metadata), then its frame's header (SOF0). */
function jpeg(width, height) {
	const app = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Buffer.from('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
	const frame = Buffer.from([0xff, 0xc0, 0x00, 0x11, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
	return Buffer.concat([Buffer.from([0xff, 0xd8]), app, frame]);
}

test('a picture’s size, from the start of its file: PNG, JPEG, GIF, WebP, SVG', () => {
	assert.deepEqual(sizeOf(png(480, 280)), { width: 480, height: 280 });
	assert.deepEqual(sizeOf(jpeg(1600, 1200)), { width: 1600, height: 1200 });
	const gif = Buffer.from('GIF89a\x40\x01\xf0\x00', 'latin1');
	assert.deepEqual(sizeOf(gif), { width: 320, height: 240 });
	const webp = Buffer.alloc(30);
	webp.write('RIFF', 0, 'latin1');
	webp.write('WEBPVP8X', 8, 'latin1');
	webp.writeUIntLE(799, 24, 3);
	webp.writeUIntLE(599, 27, 3);
	assert.deepEqual(sizeOf(webp), { width: 800, height: 600 });
	assert.deepEqual(sizeOf(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="300px" height="150">')), { width: 300, height: 150 });
	assert.deepEqual(sizeOf(Buffer.from('<svg viewBox="0 0 640 480.5">')), { width: 640, height: 481 });
	assert.equal(sizeOf(Buffer.from('not a picture')), null);
	assert.equal(sizeOf(Buffer.from([0xff, 0xd8, 0xff])), null);
});

test('the pictures an article shows, as written: Markdown’s and HTML’s', () => {
	const source = '![图](./img/a.png){width=60%}\n\n![](<img/b c.jpg> "标题")\n\n<img src="./img/d.svg" width="30%">\n\n![网上的](https://example.com/e.png)\n\n![a](./img/a.png)';
	assert.deepEqual(picturesIn(source), ['./img/a.png', 'img/b c.jpg', 'https://example.com/e.png', './img/d.svg']);
});

test('the sizes of an article’s own pictures; not of one from the web, outside it, missing, or not a picture', async (t) => {
	const folder = mkdtempSync(join(tmpdir(), 'studio-pictures-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	mkdirSync(join(folder, 'img'));
	writeFileSync(join(folder, 'img', 'a.png'), png(480, 280));
	writeFileSync(join(folder, 'img', '图 b.jpg'), jpeg(64, 32));
	writeFileSync(join(folder, 'img', 'c.png'), 'not a picture');
	const source = '![](./img/a.png)\n![](img/%E5%9B%BE%20b.jpg)\n![](./img/c.png)\n![](./img/none.png)\n![](../other/x.png)\n![](https://example.com/e.png)';
	assert.deepEqual(await pictureSizes(folder, source), { './img/a.png': [480, 280], 'img/%E5%9B%BE%20b.jpg': [64, 32] });
	// Changed (another picture in its place): read again.
	writeFileSync(join(folder, 'img', 'a.png'), png(100, 50));
	assert.deepEqual((await pictureSizes(folder, '![](./img/a.png)'))['./img/a.png'], [100, 50]);
});
