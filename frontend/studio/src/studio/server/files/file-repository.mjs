import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { basename, extname, isAbsolute, resolve } from 'node:path';
import { codeFileLanguages } from '@blog/markdown/code-files/languages.mjs';
import { articleBundlePaths, resolveInside, StudioPathError } from '../../../articles/bundle-paths.mjs';
import { ARTICLE_FOLDERS, PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';
export const DEFAULT_RESOURCE_SIZE_LIMIT = 8 * 1024 * 1024;

const TEXT = 'text/plain; charset=utf-8';

/**
 * What a file is served as. Calculation files are text, so that opened in a
 * tab they show instead of downloading; unknown files download.
 */
const CONTENT_TYPES = Object.freeze({
	'.avif': 'image/avif',
	'.bmp': 'image/bmp',
	'.cif': TEXT,
	'.com': TEXT,
	'.csv': 'text/csv; charset=utf-8',
	'.cube': TEXT,
	'.dat': TEXT,
	'.fch': TEXT,
	'.fchk': TEXT,
	'.gif': 'image/gif',
	'.gjf': TEXT,
	'.gro': TEXT,
	'.in': TEXT,
	'.inp': TEXT,
	'.itp': TEXT,
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.json': 'application/json; charset=utf-8',
	'.log': TEXT,
	'.m4v': 'video/mp4',
	'.md': 'text/markdown; charset=utf-8',
	'.mdp': TEXT,
	'.mol': TEXT,
	'.mkv': 'video/x-matroska',
	'.mol2': TEXT,
	'.molden': TEXT,
	'.mov': 'video/quicktime',
	'.mp4': 'video/mp4',
	'.out': TEXT,
	'.pdb': TEXT,
	'.pdf': 'application/pdf',
	'.png': 'image/png',
	'.py': TEXT,
	'.sdf': TEXT,
	'.sh': TEXT,
	'.smi': TEXT,
	'.smiles': TEXT,
	// Served with `Content-Security-Policy: sandbox`, so a script in it never runs.
	'.svg': 'image/svg+xml',
	'.top': TEXT,
	'.toml': TEXT,
	'.tsv': 'text/tab-separated-values; charset=utf-8',
	'.txt': TEXT,
	'.vasp': TEXT,
	'.webm': 'video/webm',
	'.webp': 'image/webp',
	'.wfn': TEXT,
	'.wfx': TEXT,
	'.xyz': TEXT,
	'.yaml': TEXT,
	'.yml': TEXT,
});

/** Files known by name alone: `INCAR`, `POSCAR`, `OUTCAR`… */
const TEXT_NAMES = new Set(codeFileLanguages.flatMap((language) => language.names));

export class FileRepository {
	constructor(blogRoot, { sizeLimit = DEFAULT_RESOURCE_SIZE_LIMIT } = {}) {
		this.blogRoot = resolve(blogRoot);
		this.sizeLimit = sizeLimit;
	}

	async list(slug) {
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertDirectoryWithoutSymlink(paths.directory, '文章目录不可用');
		const [img, assets, ai] = await Promise.all(
			ARTICLE_FOLDERS.map((root) => listRegularFiles(paths[root])),
		);
		return { img, assets, ai };
	}

	/**
	 * Opens a file of `img/` or `assets/` for reading, without following a
	 * link at any level. The caller closes `handle`.
	 */
	async open(slug, root, resourcePath) {
		assertPublicResourceRoot(root);
		const segments = validateResourcePath(resourcePath);
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertDirectoryWithoutSymlink(paths.directory, '文章目录不可用');
		await assertDirectoryWithoutSymlink(paths[root], '资源目录不存在');

		let current = paths[root];
		for (let index = 0; index < segments.length; index += 1) {
			current = resolveInside(paths[root], ...segments.slice(0, index + 1));
			let info;
			try {
				info = await lstat(current);
			} catch (error) {
				if (error?.code === 'ENOENT') throw new ResourceNotFoundError();
				throw error;
			}
			if (info.isSymbolicLink()) throw new StudioPathError('资源路径不能包含符号链接');
			const isLast = index === segments.length - 1;
			if (!isLast && !info.isDirectory()) throw new ResourceNotFoundError();
			if (isLast && !info.isFile()) throw new ResourceNotFoundError();
		}

		let handle;
		try {
			handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW);
			const info = await handle.stat();
			return { handle, size: info.size, modified: info.mtimeMs, contentType: resourceContentType(resourcePath) };
		} catch (error) {
			await handle?.close();
			if (error?.code === 'ENOENT') throw new ResourceNotFoundError();
			if (error?.code === 'ELOOP') throw new StudioPathError('资源路径不能包含符号链接');
			throw error;
		}
	}

	/** A file of `img/` or `assets/`, read whole: no larger than `sizeLimit`. */
	async read(slug, root, resourcePath, { sizeLimit = this.sizeLimit } = {}) {
		const { handle, size, modified, contentType } = await this.open(slug, root, resourcePath);
		try {
			if (size > sizeLimit) throw new ResourceTooLargeError(sizeLimit);
			return { body: await handle.readFile(), contentType, size, modified };
		} finally {
			await handle.close();
		}
	}

	/**
	 * A file of `img/` or `assets/` as a stream, for serving it whatever its size; with `range` (a
	 * request's Range header), only the bytes it asks for (`range` says which, or 'unsatisfiable').
	 */
	async stream(slug, root, resourcePath, { range: header } = {}) {
		const { handle, size, contentType } = await this.open(slug, root, resourcePath);
		const range = byteRange(header, size);
		if (range === 'unsatisfiable') {
			await handle.close();
			return { body: null, contentType, size, range };
		}
		return { body: handle.createReadStream(range ? { start: range.start, end: range.end } : {}), contentType, size, range };
	}
}

/**
 * The bytes a Range header asks of a file of `size` bytes (`bytes=0-`, `bytes=100-199`, `bytes=-500`):
 * `{ start, end }`, both included; null for the whole file (no header, or one not understood,
 * or several ranges); 'unsatisfiable' when it starts past the end.
 */
export function byteRange(header, size) {
	const match = /^bytes=(\d*)-(\d*)$/u.exec(String(header ?? '').trim());
	if (!match || (!match[1] && !match[2])) return null;
	if (!match[1]) {
		const length = Math.min(Number(match[2]), size);
		return length > 0 ? { start: size - length, end: size - 1 } : 'unsatisfiable';
	}
	const start = Number(match[1]);
	if (start >= size) return 'unsatisfiable';
	const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
	return end < start ? null : { start, end };
}

export function assertPublicResourceRoot(root) {
	if (!PUBLISHED_FOLDERS.includes(root)) {
		throw new ResourceAccessError(root === 'ai' ? 'AI 工作目录不可通过资源接口读取' : '无效的资源目录');
	}
	return root;
}

export function validateResourcePath(resourcePath) {
	if (typeof resourcePath !== 'string' || !resourcePath || resourcePath.includes('\0')) {
		throw new StudioPathError('无效的资源路径');
	}
	if (resourcePath.includes('\\') || isAbsolute(resourcePath) || /^[A-Za-z]:/u.test(resourcePath)) {
		throw new StudioPathError('资源路径必须是文章内的相对路径');
	}
	const segments = resourcePath.split('/');
	if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
		throw new StudioPathError('资源路径不能包含空段、. 或 ..');
	}
	return segments;
}

export function resourceContentType(resourcePath) {
	const extension = extname(resourcePath).toLowerCase();
	if (!extension && TEXT_NAMES.has(basename(resourcePath))) return TEXT;
	return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

async function listRegularFiles(directory, prefix = '', root = directory) {
	try {
		const rootInfo = await lstat(directory);
		if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) return [];
	} catch (error) {
		if (error?.code === 'ENOENT') return [];
		throw error;
	}

	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		if (entry.name === '.gitkeep' || entry.isSymbolicLink()) continue;
		const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
		const absolutePath = resolveInside(root, ...relativePath.split('/'));
		if (entry.isDirectory()) files.push(...await listRegularFiles(absolutePath, relativePath, root));
		else if (entry.isFile()) files.push(relativePath);
	}
	return files;
}

async function assertDirectoryWithoutSymlink(directory, message) {
	try {
		const info = await lstat(directory);
		if (!info.isDirectory() || info.isSymbolicLink()) throw new StudioPathError(message);
	} catch (error) {
		if (error?.code === 'ENOENT') throw new ResourceNotFoundError(message);
		throw error;
	}
}

export class ResourceAccessError extends Error {
	constructor(message) {
		super(message);
		this.name = 'ResourceAccessError';
		this.statusCode = 403;
	}
}

export class ResourceNotFoundError extends Error {
	constructor(message = '资源不存在') {
		super(message);
		this.name = 'ResourceNotFoundError';
		this.statusCode = 404;
	}
}

export class ResourceTooLargeError extends Error {
	constructor(sizeLimit) {
		super(`资源超过 ${Math.floor(sizeLimit / 1024 / 1024)} MB 读取上限`);
		this.name = 'ResourceTooLargeError';
		this.statusCode = 413;
	}
}
