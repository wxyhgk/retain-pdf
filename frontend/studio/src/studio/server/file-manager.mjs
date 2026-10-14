import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { link, lstat, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { ARTICLE_RESOURCE_DIRECTORIES, articleBundlePaths, resolveInside, StudioPathError } from './bundle-paths.mjs';

export const DEFAULT_UPLOAD_SIZE_LIMIT = 64 * 1024 * 1024;
/** The article's own files: listed so the author sees them, changed only by the editor. */
const LOCKED_FILES = Object.freeze(['index.md', 'article.config.yaml', 'article.views.json']);
const MAX_NAME_BYTES = 255;

/**
 * Changes an article's files: what the Studio's file panel does. Every path
 * is relative to the article folder and must lie inside `img/`, `assets/` or
 * `ai/`; the folders themselves and the article's own files stay put. Nothing
 * follows a symbolic link, nothing overwrites a file unasked, and removing a
 * file moves it to the trash folder instead of deleting it.
 */
export class ArticleFileManager {
	constructor(blogRoot, { trashRoot = resolve(blogRoot, '..', '.studio-trash'), uploadSizeLimit = DEFAULT_UPLOAD_SIZE_LIMIT } = {}) {
		this.blogRoot = resolve(blogRoot);
		this.trashRoot = resolve(trashRoot);
		this.uploadSizeLimit = uploadSizeLimit;
	}

	/**
	 * Every file and folder in the article, folders before their contents,
	 * sorted by path. `img/`, `assets/` and `ai/` are always listed: git keeps
	 * no empty folders, so a fresh checkout may lack one until something goes in.
	 */
	async list(slug) {
		const { directory } = await this.#article(slug);
		const entries = [];
		const present = new Set();
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (isHidden(entry.name) || entry.isSymbolicLink()) continue;
			if (entry.isDirectory() && ARTICLE_RESOURCE_DIRECTORIES.includes(entry.name)) {
				present.add(entry.name);
				entries.push({ ...(await describe(join(directory, entry.name), entry.name)), locked: true });
				entries.push(...(await walk(join(directory, entry.name), entry.name)));
			} else if (entry.isFile()) {
				entries.push({ ...(await describe(join(directory, entry.name), entry.name)), locked: true });
			}
		}
		for (const folder of ARTICLE_RESOURCE_DIRECTORIES) {
			if (!present.has(folder) && !(await exists(join(directory, folder)))) entries.push({ path: folder, kind: 'directory', locked: true });
		}
		return entries.sort((left, right) => comparePaths(left.path, right.path));
	}

	/**
	 * Writes an uploaded file into `folder` (`img`, `assets/frames`, …). The
	 * name is made safe first; an existing file keeps its place and the upload
	 * gets a numbered name, unless `replace` is set. `subfolders` are the
	 * folders a dropped folder brought along (`['My Data', 'run 1']`); they are
	 * made safe the same way and made inside `folder` when missing.
	 */
	async upload(slug, folder, name, body, { replace = false, subfolders = [] } = {}) {
		const { directory } = await this.#article(slug);
		const target = managedSegments(folder, { allowFolderRoot: true });
		const segments = [...target, ...subfolders.map(safeFolderName)];
		await ensureResourceFolder(directory, segments[0]);
		const folderPath = await makeFolders(directory, segments, target.length);
		const fileName = safeUploadName(name);
		const temporary = join(folderPath, `.upload-${randomUUID()}`);
		let size = 0;
		const limit = this.uploadSizeLimit;
		try {
			await pipeline(
				body,
				new Transform({
					transform(chunk, _encoding, done) {
						size += chunk.length;
						done(size > limit ? new UploadTooLargeError(limit) : null, chunk);
					},
				}),
				createWriteStream(temporary, { flags: 'wx' }),
			);
			const target = replace
				? await replaceInto(temporary, folderPath, fileName)
				: await linkUnderFreeName(temporary, folderPath, fileName);
			return { path: [...segments, target].join('/'), size };
		} finally {
			await rm(temporary, { force: true });
		}
	}

	/** Makes a folder, with any missing parents, inside a managed folder. */
	async createFolder(slug, path) {
		const { directory } = await this.#article(slug);
		const segments = managedSegments(path);
		await ensureResourceFolder(directory, segments[0]);
		await makeFolders(directory, segments);
		return { path: segments.join('/') };
	}

	/** Renames or moves a file or folder; the target must not exist yet. */
	async move(slug, from, to) {
		const { directory } = await this.#article(slug);
		const source = managedSegments(from);
		const target = managedSegments(to);
		assertName(target[target.length - 1]);
		if (target.join('/').startsWith(`${source.join('/')}/`)) throw new StudioPathError('不能把文件夹移到它自己里面');
		const sourcePath = await existingEntry(directory, source);
		const targetFolder = await existingDirectory(directory, target.slice(0, -1));
		const targetPath = resolveInside(targetFolder, target[target.length - 1]);
		if (await exists(targetPath)) throw new FileConflictError(`${target.join('/')} 已经存在`);
		await rename(sourcePath, targetPath);
		return { path: target.join('/') };
	}

	/** Moves a file or folder into the trash, under the time and article it came from. */
	async trash(slug, path) {
		const { directory } = await this.#article(slug);
		const segments = managedSegments(path);
		const sourcePath = await existingEntry(directory, segments);
		const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
		const trashFolder = join(this.trashRoot, `${stamp}-${slug}`, ...segments.slice(0, -1));
		await mkdir(trashFolder, { recursive: true });
		const trashed = join(trashFolder, segments[segments.length - 1]);
		await rename(sourcePath, trashed);
		return { path: segments.join('/'), trashedTo: trashed };
	}

	/**
	 * Where a file or folder of the article is on disk, for showing it in the
	 * system's file manager. Any path inside the article will do, its own files
	 * too; `''` is the article folder.
	 */
	async locate(slug, path) {
		const { directory } = await this.#article(slug);
		if (path === '') return directory;
		if (typeof path !== 'string' || path.includes('\\') || path.includes('\0')) throw new StudioPathError('无效的文件路径');
		const segments = path.replace(/\/+$/u, '').split('/');
		if (segments.some((segment) => !segment || segment === '.' || segment === '..' || isHidden(segment))) throw new StudioPathError('无效的文件路径');
		return existingEntry(directory, segments);
	}

	async #article(slug) {
		const paths = articleBundlePaths(this.blogRoot, slug);
		const info = await lstat(paths.directory).catch((error) => {
			if (error?.code === 'ENOENT') throw new FileNotFoundError('文章不存在');
			throw error;
		});
		if (!info.isDirectory() || info.isSymbolicLink()) throw new FileNotFoundError('文章不存在');
		return paths;
	}
}

function isHidden(name) {
	return name.startsWith('.');
}

/** Folder by folder, so a folder's contents follow it directly. */
function comparePaths(left, right) {
	const leftSegments = left.split('/');
	const rightSegments = right.split('/');
	for (let index = 0; index < Math.min(leftSegments.length, rightSegments.length); index += 1) {
		const order = leftSegments[index].localeCompare(rightSegments[index], 'zh-CN', { numeric: true });
		if (order !== 0) return order;
	}
	return leftSegments.length - rightSegments.length;
}

async function describe(absolute, path) {
	const info = await lstat(absolute);
	return info.isDirectory()
		? { path, kind: 'directory', modified: info.mtimeMs }
		: { path, kind: 'file', size: info.size, modified: info.mtimeMs };
}

async function walk(directory, prefix) {
	const entries = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (isHidden(entry.name) || entry.isSymbolicLink()) continue;
		const path = `${prefix}/${entry.name}`;
		const absolute = join(directory, entry.name);
		if (entry.isDirectory()) entries.push(await describe(absolute, path), ...(await walk(absolute, path)));
		else if (entry.isFile()) entries.push(await describe(absolute, path));
	}
	return entries;
}

/**
 * A path the file panel may change, split into names: inside one of the
 * article's resource folders, and (unless `allowFolderRoot`) not the folder itself.
 */
export function managedSegments(path, { allowFolderRoot = false } = {}) {
	if (typeof path !== 'string' || !path || path.includes('\0') || path.includes('\\')) throw new StudioPathError('无效的文件路径');
	const segments = path.replace(/\/+$/u, '').split('/');
	if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
		throw new StudioPathError('文件路径不能包含空段、. 或 ..');
	}
	if (!ARTICLE_RESOURCE_DIRECTORIES.includes(segments[0])) {
		if (LOCKED_FILES.includes(segments[0])) throw new FileLockedError(`${segments[0]} 只能在编辑器里修改`);
		throw new StudioPathError('只能管理 img/、assets/ 和 ai/ 里的文件');
	}
	if (segments.length === 1 && !allowFolderRoot) throw new FileLockedError(`${segments[0]}/ 是文章的固定文件夹`);
	return segments;
}

/** A file or folder name the panel accepts: visible, no spaces or characters Markdown links trip over. */
export function assertName(name) {
	if (typeof name !== 'string' || !name || name === '.' || name === '..') throw new StudioPathError('名称不能为空');
	if (Buffer.byteLength(name) > MAX_NAME_BYTES) throw new StudioPathError('名称太长');
	if (isHidden(name)) throw new StudioPathError('名称不能以 . 开头');
	if (/[\s/\\<>:"|?*#%()[\]\u0000-\u001f\u007f]/u.test(name)) {
		throw new StudioPathError('名称不能包含空格或 / \\ < > : " | ? * # % ( ) [ ]');
	}
	return name;
}

/**
 * An uploaded file's name made acceptable: the browser's name without its
 * folders, spaces and awkward characters turned into `-`, so a screenshot
 * called `Screen Shot 1.png` arrives as `Screen-Shot-1.png`.
 */
export function safeUploadName(name) {
	const base = basename(String(name ?? '').replace(/\\/gu, '/'));
	const extension = extname(base).toLowerCase().replace(/[^.a-z0-9]/gu, '');
	const stem = base
		.slice(0, base.length - extname(base).length)
		.normalize('NFC')
		.replace(/[\s/\\<>:"|?*#%()[\]\u0000-\u001f\u007f]+/gu, '-')
		.replace(/^[.-]+|-+$/gu, '');
	let kept = [...(stem || 'file')];
	while (kept.length > 1 && Buffer.byteLength(`${kept.join('')}${extension}`) > MAX_NAME_BYTES) kept = kept.slice(0, -1);
	return assertName(`${kept.join('')}${extension}`);
}

/**
 * The folder at `segments`: the first `existing` must be there already, the
 * rest are made when missing. Never through a link or over a file.
 */
async function makeFolders(directory, segments, existing = 1) {
	let current = await existingDirectory(directory, segments.slice(0, existing));
	for (const segment of segments.slice(existing)) {
		current = resolveInside(current, segment);
		const info = await lstat(current).catch((error) => {
			if (error?.code === 'ENOENT') return null;
			throw error;
		});
		if (!info) {
			assertName(segment);
			await mkdir(current).catch((error) => {
				// Two uploads from one dropped folder may make it at the same time.
				if (error?.code !== 'EEXIST') throw error;
			});
		} else if (info.isSymbolicLink()) throw new StudioPathError('路径不能包含符号链接');
		else if (!info.isDirectory()) throw new FileConflictError(`${segments.join('/')} 已被同名文件占用`);
	}
	return current;
}

/** Makes `img/`, `assets/` or `ai/` when the article has none yet. */
async function ensureResourceFolder(directory, name) {
	try {
		await mkdir(resolveInside(directory, name));
	} catch (error) {
		if (error?.code !== 'EEXIST') throw error;
	}
}

/** A dropped folder's name made acceptable the way `safeUploadName` does a file's: `My Data` becomes `My-Data`. */
export function safeFolderName(name) {
	const cleaned = String(name ?? '')
		.normalize('NFC')
		.replace(/[\s/\\<>:"|?*#%()[\]\u0000-\u001f\u007f]+/gu, '-')
		.replace(/^[.-]+|-+$/gu, '');
	let kept = [...(cleaned || 'folder')];
	while (kept.length > 1 && Buffer.byteLength(kept.join('')) > MAX_NAME_BYTES) kept = kept.slice(0, -1);
	return assertName(kept.join(''));
}

/** Resolves an existing folder, refusing symbolic links on the way. */
async function existingDirectory(directory, segments) {
	const path = await existingEntry(directory, segments);
	if (!(await lstat(path)).isDirectory()) throw new FileConflictError(`${segments.join('/')} 不是文件夹`);
	return path;
}

/** Resolves an existing file or folder, refusing symbolic links at every level. */
async function existingEntry(directory, segments) {
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

async function exists(path) {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (error?.code === 'ENOENT') return false;
		throw error;
	}
}

/** Gives the finished upload the first free name: `a.png`, `a-1.png`, `a-2.png`, … */
async function linkUnderFreeName(temporary, folder, name) {
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
	}
	throw new FileConflictError('同名文件太多');
}

async function replaceInto(temporary, folder, name) {
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

export class FileLockedError extends Error {
	constructor(message) {
		super(message);
		this.name = 'FileLockedError';
		this.statusCode = 403;
	}
}

export class UploadTooLargeError extends Error {
	constructor(limit) {
		super(`文件超过 ${Math.floor(limit / 1024 / 1024)} MB 上传上限`);
		this.name = 'UploadTooLargeError';
		this.statusCode = 413;
	}
}
