import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { resolveInside, StudioPathError } from '../../../articles/bundle-paths.mjs';
import { TRASH_FOLDER } from '../files/file-manager.mjs';
import { resourceContentType } from '../files/file-repository.mjs';
import { existingDirectory, existingEntry, exists, FileConflictError, FileNotFoundError, linkUnderFreeName, replaceInto } from '../files/safe-fs.mjs';
import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The drive (资料库): a folder of the author's, anywhere on the machine and
 * outside the repository, kept in sync by whatever syncs it (iCloud,
 * Dropbox…). The Studio browses it, shows its files, takes uploads, moves,
 * renames and trashes; nothing here syncs or publishes. Files are named as
 * the author likes, spaces and all: one used in an article is copied into
 * the article under a name a Markdown link takes (file-manager.mjs).
 *
 * Which folder it is lives in `settingsFile`, outside git; `fixedRoot`
 * (the browser tests' copy) overrides it. Removed things go to `.studio-trash`
 * in the drive, where `restore` finds them.
 */

export const DEFAULT_DRIVE_UPLOAD_LIMIT = 4 * 1024 * 1024 * 1024;
const MAX_NAME_BYTES = 255;

export class DriveNotSetError extends Error {
	constructor() {
		super(t('还没有选择资料库文件夹'));
		this.statusCode = 409;
	}
}

/** A name the drive accepts: any a file system takes, but visible and in one piece. */
export function assertDriveName(name) {
	if (typeof name !== 'string' || !name.trim() || name === '.' || name === '..') throw new StudioPathError(t('名称不能为空'));
	if (Buffer.byteLength(name) > MAX_NAME_BYTES) throw new StudioPathError(t('名称太长'));
	if (name.startsWith('.')) throw new StudioPathError(t('名称不能以 . 开头'));
	if (/[/\\:\u0000-\u001f\u007f]/u.test(name)) throw new StudioPathError(t('名称不能包含 / \\ : 或控制字符'));
	return name;
}

/** An uploaded file's name as the drive keeps it: the browser's, without folders, NFC. */
export function driveUploadName(name) {
	const base = basename(String(name ?? '').replace(/\\/gu, '/')).normalize('NFC').replace(/[:\u0000-\u001f\u007f]/gu, '-').replace(/^\.+/u, '').trim();
	return assertDriveName(base || 'file');
}

/** A path in the drive split into names; '' is the drive itself. Nothing hidden, no `..`. */
export function driveSegments(path, { allowRoot = false } = {}) {
	if (typeof path !== 'string' || path.includes('\0') || path.includes('\\')) throw new StudioPathError(t('无效的文件路径'));
	const trimmed = path.replace(/^\/+|\/+$/gu, '');
	if (!trimmed) {
		if (allowRoot) return [];
		throw new StudioPathError(t('不能对资料库本身这样做'));
	}
	const segments = trimmed.split('/');
	if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'))) throw new StudioPathError(t('文件路径不能包含空段、. 、.. 或隐藏的名字'));
	return segments;
}

function trashStamp(at = Date.now()) {
	return new Date(at).toISOString().replace(/[:.]/gu, '-');
}

/**
 * A folder of its own in `trash`, named by now (`name` of the time): one made in the same millisecond is a
 * millisecond on, so two things trashed at once never share one (putting one back would take the other).
 */
async function ownTrashFolder(trash, name = (stamp) => stamp) {
	await mkdir(trash, { recursive: true });
	for (let at = Date.now(); ; at += 1) {
		const folder = name(trashStamp(at));
		try {
			await mkdir(join(trash, folder));
			return folder;
		} catch (error) {
			if (error?.code !== 'EEXIST') throw error;
		}
	}
}

export class Drive {
	/**
	 * @param {{ settingsFile: string, fixedRoot?: string | null, forbidden?: string[], uploadSizeLimit?: number }} options
	 * `forbidden`: folders the drive may not be in or be (the repository: what is there is published).
	 */
	constructor({ settingsFile, fixedRoot = null, forbidden = [], uploadSizeLimit = DEFAULT_DRIVE_UPLOAD_LIMIT }) {
		this.settingsFile = settingsFile;
		this.fixedRoot = fixedRoot ? resolve(fixedRoot) : null;
		this.forbidden = forbidden.map((folder) => resolve(folder));
		this.uploadSizeLimit = uploadSizeLimit;
	}

	#settings() {
		return readSettings(this.settingsFile);
	}

	/** The drive's folder; null when none is chosen, or the chosen one is gone. */
	async root() {
		const root = this.fixedRoot ?? (await this.#settings()).driveRoot ?? null;
		if (!root) return null;
		const info = await lstat(root).catch(() => null);
		return info?.isDirectory() ? root : null;
	}

	/** What the Studio shows of the drive: where it is, by its folder's name. */
	async describe() {
		const root = await this.root();
		return { root, name: root ? basename(root) : null, fixed: Boolean(this.fixedRoot) };
	}

	/** Makes `folder` the drive: an existing folder, outside the repository. */
	async choose(folder) {
		if (this.fixedRoot) throw new StudioPathError(t('测试用的资料库不能更换'));
		if (typeof folder !== 'string' || !isAbsolute(folder)) throw new StudioPathError(t('资料库要用完整路径'));
		const root = resolve(folder);
		const info = await lstat(root).catch(() => null);
		if (!info?.isDirectory()) throw new FileNotFoundError(t('{root} 不是一个文件夹', { root }));
		for (const kept of this.forbidden) {
			if (isInside(kept, root)) throw new StudioPathError(t('资料库不能放在博客仓库里：仓库里的东西会公开'));
			if (isInside(root, kept)) throw new StudioPathError(t('资料库不能是包含博客仓库的文件夹'));
		}
		await updateSettings(this.settingsFile, (settings) => ({ ...settings, driveRoot: root }));
		return this.describe();
	}

	async #root() {
		const root = await this.root();
		if (!root) throw new DriveNotSetError();
		return root;
	}

	/** Where a path of the drive is on disk, which must be there. */
	async locate(path) {
		const root = await this.#root();
		return existingEntry(root, driveSegments(path, { allowRoot: true }));
	}

	/** What is in a folder of the drive: folders first, then files, by name as people read them. */
	async list(folder = '') {
		const root = await this.#root();
		const segments = driveSegments(folder, { allowRoot: true });
		const directory = await existingDirectory(root, segments);
		const entries = [];
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (entry.name.startsWith('.') || entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) continue;
			const info = await lstat(join(directory, entry.name)).catch(() => null);
			if (!info) continue;
			const path = [...segments, entry.name].join('/');
			entries.push(info.isDirectory() ? { path, kind: 'directory', modified: info.mtimeMs } : { path, kind: 'file', size: info.size, modified: info.mtimeMs });
		}
		return entries.sort((left, right) => (left.kind === right.kind ? basename(left.path).localeCompare(basename(right.path), 'zh-CN', { numeric: true }) : left.kind === 'directory' ? -1 : 1));
	}

	/** A file of the drive, to send. */
	async stream(path) {
		const absolute = await this.locate(path);
		const info = await lstat(absolute);
		if (!info.isFile()) throw new FileNotFoundError(t('{path} 不是文件', { path }));
		return { body: createReadStream(absolute), size: info.size, contentType: resourceContentType(absolute), name: basename(absolute) };
	}

	/** Writes an upload into `folder` under the first free name (`a.pdf`, `a-1.pdf`…), or over the old one with `replace`. */
	async upload(folder, name, body, { replace = false } = {}) {
		const root = await this.#root();
		const segments = driveSegments(folder, { allowRoot: true });
		const directory = await existingDirectory(root, segments);
		const fileName = driveUploadName(name);
		const temporary = join(directory, `.upload-${randomUUID()}`);
		const limit = this.uploadSizeLimit;
		let size = 0;
		try {
			await pipeline(
				body,
				new Transform({
					transform(chunk, _encoding, done) {
						size += chunk.length;
						done(size > limit ? Object.assign(new Error(t('文件超过 {limit} MB 上传上限', { limit: Math.floor(limit / 1024 / 1024) })), { statusCode: 413 }) : null, chunk);
					},
				}),
				createWriteStream(temporary, { flags: 'wx' }),
			);
			const written = replace ? await replaceInto(temporary, directory, fileName) : await linkUnderFreeName(temporary, directory, fileName);
			return { path: [...segments, written].join('/'), size };
		} finally {
			await rm(temporary, { force: true });
		}
	}

	/** Makes a folder in an existing one. */
	async createFolder(path) {
		const root = await this.#root();
		const segments = driveSegments(path);
		assertDriveName(segments[segments.length - 1]);
		const parent = await existingDirectory(root, segments.slice(0, -1));
		const target = resolveInside(parent, segments[segments.length - 1]);
		if (await exists(target)) throw new FileConflictError(t('{path} 已经存在', { path: segments.join('/') }));
		await mkdir(target);
		return { path: segments.join('/') };
	}

	/** Renames or moves a file or folder; the target must not exist yet. */
	async move(from, to) {
		const root = await this.#root();
		const source = driveSegments(from);
		const target = driveSegments(to);
		assertDriveName(target[target.length - 1]);
		if (`${target.join('/')}/`.startsWith(`${source.join('/')}/`)) throw new StudioPathError(t('不能把文件夹移到它自己里面'));
		const sourcePath = await existingEntry(root, source);
		const targetFolder = await existingDirectory(root, target.slice(0, -1));
		const targetPath = resolveInside(targetFolder, target[target.length - 1]);
		if (await exists(targetPath)) throw new FileConflictError(t('{path} 已经存在', { path: target.join('/') }));
		await rename(sourcePath, targetPath);
		return { path: target.join('/') };
	}

	/** Moves a file or folder into the drive's trash: `.studio-trash/<time>/<path>`; `trashed` names it there. */
	async trash(path) {
		const root = await this.#root();
		const segments = driveSegments(path);
		const sourcePath = await existingEntry(root, segments);
		const trashed = [await ownTrashFolder(join(root, TRASH_FOLDER)), ...segments].join('/');
		const trashedTo = join(root, TRASH_FOLDER, ...trashed.split('/'));
		await mkdir(dirname(trashedTo), { recursive: true });
		await rename(sourcePath, trashedTo);
		return { path: segments.join('/'), trashed };
	}

	/** Puts back what `trash` moved away, where it was, never over something put there since. */
	async restore(trashed) {
		const root = await this.#root();
		const [stamp, ...segments] = driveSegments(String(trashed ?? ''));
		if (!/^\d{4}-\d{2}-\d{2}T[\d-]+Z$/u.test(stamp ?? '') || !segments.length) throw new StudioPathError(t('无效的回收站路径'));
		const source = await existingEntry(join(root, TRASH_FOLDER), [stamp, ...segments]);
		const parent = await existingDirectory(root, segments.slice(0, -1)).catch(() => {
			throw new FileNotFoundError(t('{path} 已经不在了，放不回去', { path: segments.slice(0, -1).join('/') }));
		});
		const target = resolveInside(parent, segments[segments.length - 1]);
		if (await exists(target)) throw new FileConflictError(t('{path} 已经有同名的文件', { path: segments.join('/') }));
		await rename(source, target);
		await rm(join(root, TRASH_FOLDER, stamp), { recursive: true, force: true }).catch(() => {});
		return { path: segments.join('/') };
	}
}

/** Whether `path` lies in `folder` (or is it). */
export function isInside(folder, path) {
	const inside = relative(resolve(folder), resolve(path));
	return inside === '' || (!inside.startsWith(`..${sep}`) && inside !== '..' && !isAbsolute(inside));
}
