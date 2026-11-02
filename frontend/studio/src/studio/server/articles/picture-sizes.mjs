import { open, stat } from 'node:fs/promises';

import { resolveInside } from '../../../articles/bundle-paths.mjs';

/**
 * How large an article's pictures are, read from the start of their files (not the pictures themselves): the editor
 * keeps their room before it loads them, as they come near the screen (figure-block.ts), so nothing moves when one
 * comes in (a page left where it was read, a jump to a heading).
 */

/** How much of a file is read for its size: a JPEG's may come after its metadata (a camera's, a thumbnail). */
const HEAD = 64 * 1024;
const MORE = 512 * 1024;

/** By file: its size, as read when it was as it is (its length and time). */
const known = new Map();

/** Width and height in the bytes of a PNG, GIF, JPEG, WebP or SVG; null for what is not one, or not read far enough. */
export function sizeOf(bytes) {
	const at = (offset) => bytes[offset];
	const u16be = (offset) => (at(offset) << 8) | at(offset + 1);
	const u16le = (offset) => at(offset) | (at(offset + 1) << 8);
	const u24le = (offset) => at(offset) | (at(offset + 1) << 8) | (at(offset + 2) << 16);
	const u32be = (offset) => bytes.readUInt32BE(offset);
	if (bytes.length >= 24 && bytes.toString('latin1', 1, 4) === 'PNG') return { width: u32be(16), height: u32be(20) };
	if (bytes.length >= 10 && bytes.toString('latin1', 0, 3) === 'GIF') return { width: u16le(6), height: u16le(8) };
	if (bytes.length >= 30 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
		const kind = bytes.toString('latin1', 12, 16);
		if (kind === 'VP8X') return { width: u24le(24) + 1, height: u24le(27) + 1 };
		if (kind === 'VP8L') {
			const bits = bytes.readUInt32LE(21);
			return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
		}
		if (kind === 'VP8 ') return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
		return null;
	}
	if (bytes.length >= 4 && at(0) === 0xff && at(1) === 0xd8) {
		// Segment after segment to the frame's header (SOF0–SOF15, not DHT, JPG, DAC).
		let offset = 2;
		while (offset + 9 < bytes.length) {
			if (at(offset) !== 0xff) return null;
			const marker = at(offset + 1);
			if (marker === 0xff) {
				offset += 1;
				continue;
			}
			if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: u16be(offset + 7), height: u16be(offset + 5) };
			offset += 2 + u16be(offset + 2);
		}
		return null;
	}
	const text = bytes.toString('utf8', 0, Math.min(bytes.length, 4096));
	const svg = /<svg\b[^>]*>/iu.exec(text)?.[0];
	if (svg) {
		const length = (name) => {
			const value = new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)\\s*(?:px)?\\s*["']`, 'iu').exec(svg)?.[1];
			return value ? Number(value) : null;
		};
		const box = /\sviewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/iu.exec(svg);
		const [width, height] = [length('width') ?? (box ? Number(box[1]) : null), length('height') ?? (box ? Number(box[2]) : null)];
		return width && height ? { width: Math.round(width), height: Math.round(height) } : null;
	}
	return null;
}

/** A picture file's size, read once while it stays as it is; null for none, or one not known. */
async function fileSize(path) {
	let info;
	try {
		info = await stat(path);
	} catch {
		return null;
	}
	if (!info.isFile()) return null;
	const mark = `${info.size}-${info.mtimeMs}`;
	const kept = known.get(path);
	if (kept?.mark === mark) return kept.size;
	let size = null;
	const file = await open(path, 'r');
	try {
		for (const length of [HEAD, MORE]) {
			const bytes = Buffer.alloc(Math.min(length, info.size));
			const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
			size = sizeOf(bytes.subarray(0, bytesRead));
			if (size || bytesRead < length) break;
		}
	} finally {
		await file.close();
	}
	if (known.size > 4000) known.clear();
	known.set(path, { mark, size });
	return size;
}

/** The pictures an article's text shows, as written: Markdown's `![…](src …)` and HTML's `<img src="…">`. */
export function picturesIn(source) {
	const found = new Set();
	for (const match of source.matchAll(/!\[(?:[^\]\\]|\\.)*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+["'(][^)]*)?\s*\)/gu)) found.add(match[1] ?? match[2]);
	for (const match of source.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/giu)) found.add(match[1] ?? match[2]);
	return [...found];
}

/**
 * The sizes of the pictures an article shows from its own folder: `{ [src as written]: [width, height] }`. A picture
 * from elsewhere (a web address), or one whose size cannot be read, is not in it.
 */
export async function pictureSizes(folder, source) {
	const sizes = {};
	await Promise.all(
		picturesIn(source).map(async (src) => {
			if (/^[a-z][\w+.-]*:|^\/\//iu.test(src)) return;
			let path;
			try {
				path = resolveInside(folder, decodeURI(src.split(/[?#]/u, 1)[0]));
			} catch {
				return;
			}
			const size = await fileSize(path);
			if (size?.width > 0 && size.height > 0) sizes[src] = [size.width, size.height];
		}),
	);
	return sizes;
}
