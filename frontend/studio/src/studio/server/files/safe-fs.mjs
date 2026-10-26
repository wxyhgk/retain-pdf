import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { link, lstat, rename } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { resolveInside, StudioPathError } from '../../../articles/bundle-paths.mjs';

/**
 * Reaching files under a folder without being led out of it: no symbolic
 * link followed, nothing overwritten unasked. The article's file panel
 * (file-manager.mjs) and the drive (drive.mjs) both go through these.
 */

/** Resolves an existing folder, refusing symbolic links on the way. */
export async function existingDirectory(directory, segments) {
	const path = await existingEntry(directory, segments);
	if (!(await lstat(path)).isDirectory()) throw new FileConflictError(`${segments.join('/')} 不是文件夹`);
	return path;
}

/** Resolves an existing file or folder, refusing symbolic links at every level. */
export async function existingEntry(directory, segments) {
	let current = directory;
	for (const [index, segment] of segments.entries()) {
		current = resolveInside(current, segment);
		let info;
		try {
			info = await lstat(current);
		} catch (error) {
			if (error?.code === 'ENOENT') throw new FileNotFoundError(`${segments.slice(0, index + 1).join('/')} 不存在`);
			throw error;
		}
		if (info.isSymbolicLink()) throw new StudioPathError('路径不能包含符号链接');
		if (index < segments.length - 1 && !info.isDirectory()) throw new FileNotFoundError(`${segments.join('/')} 不存在`);
	}
	return current;
}

export async function exists(path) {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (error?.code === 'ENOENT') return false;
		throw error;
	}
}

/**
 * Gives the finished upload the first free name: `a.png`, `a-1.png`,
 * `a-2.png`, … unless one of them already holds the same bytes: then that
 * one is the upload's, so the same file sent twice (an upload tried again,
 * a picture dropped twice) is there once.
 */
export async function linkUnderFreeName(temporary, folder, name) {
	const extension = extname(name);
	const stem = name.slice(0, name.length - extension.length);
	for (let attempt = 0; attempt < 1000; attempt += 1) {
		const candidate = attempt === 0 ? name : `${stem}-${attempt}${extension}`;
		try {
			// A hard link fails when the name is taken, where a rename would overwrite.
			await link(temporary, join(folder, candidate));
			return candidate;
		} catch (error) {
			if (error?.code !== 'EEXIST') throw error;
		}
		if (await sameBytes(temporary, join(folder, candidate))) return candidate;
	}
	throw new FileConflictError('同名文件太多');
}

/** Whether `other` is a plain file holding exactly what `file` holds. */
async function sameBytes(file, other) {
	const [one, two] = await Promise.all([lstat(file), lstat(other).catch(() => null)]);
	if (!two?.isFile() || one.size !== two.size) return false;
	const digest = (path) => new Promise((resolve, reject) => {
		const hash = createHash('sha256');
		createReadStream(path).on('error', reject).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex')));
	});
	const [left, right] = await Promise.all([digest(file), digest(other)]);
	return left === right;
}

export async function replaceInto(temporary, folder, name) {
	const target = join(folder, name);
	const info = await lstat(target).catch(() => null);
	if (info && (!info.isFile() || info.isSymbolicLink())) throw new FileConflictError(`${name} 不是普通文件，不能替换`);
	await rename(temporary, target);
	return name;
}

export class FileNotFoundError extends Error {
	constructor(message = '文件不存在') {
		super(message);
		this.name = 'FileNotFoundError';
		this.statusCode = 404;
	}
}

export class FileConflictError extends Error {
	constructor(message) {
		super(message);
		this.name = 'FileConflictError';
		this.statusCode = 409;
	}
}
