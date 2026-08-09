import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { extname, isAbsolute, resolve } from 'node:path';
import {
	ARTICLE_RESOURCE_DIRECTORIES,
	articleBundlePaths,
	resolveInside,
	StudioPathError,
} from './bundle-paths.mjs';

export const PUBLIC_RESOURCE_ROOTS = Object.freeze(['img', 'assets']);
export const DEFAULT_RESOURCE_SIZE_LIMIT = 8 * 1024 * 1024;

const CONTENT_TYPES = Object.freeze({
	'.cif': 'text/plain; charset=utf-8',
	'.com': 'text/plain; charset=utf-8',
	'.csv': 'text/csv; charset=utf-8',
	'.cube': 'text/plain; charset=utf-8',
	'.gif': 'image/gif',
	'.gjf': 'text/plain; charset=utf-8',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.json': 'application/json; charset=utf-8',
	'.md': 'text/markdown; charset=utf-8',
	'.mol': 'text/plain; charset=utf-8',
	'.mol2': 'text/plain; charset=utf-8',
	'.pdb': 'text/plain; charset=utf-8',
	'.pdf': 'application/pdf',
	'.png': 'image/png',
	'.sdf': 'text/plain; charset=utf-8',
	'.smi': 'text/plain; charset=utf-8',
	'.smiles': 'text/plain; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.webp': 'image/webp',
	'.xyz': 'text/plain; charset=utf-8',
});

export class FileRepository {
	constructor(blogRoot, { sizeLimit = DEFAULT_RESOURCE_SIZE_LIMIT } = {}) {
		this.blogRoot = resolve(blogRoot);
		this.sizeLimit = sizeLimit;
	}

	async list(slug) {
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertDirectoryWithoutSymlink(paths.directory, '文章目录不可用');
		const [img, assets, ai] = await Promise.all(
			ARTICLE_RESOURCE_DIRECTORIES.map((root) => listRegularFiles(paths[root])),
		);
		return { img, assets, ai };
	}

	async read(slug, root, resourcePath) {
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
			if (info.size > this.sizeLimit) throw new ResourceTooLargeError(this.sizeLimit);
			return {
				body: await handle.readFile(),
				contentType: resourceContentType(resourcePath),
				size: info.size,
			};
		} catch (error) {
			if (error?.code === 'ENOENT') throw new ResourceNotFoundError();
			if (error?.code === 'ELOOP') throw new StudioPathError('资源路径不能包含符号链接');
			throw error;
		} finally {
			await handle?.close();
		}
	}
}

export function assertPublicResourceRoot(root) {
	if (!PUBLIC_RESOURCE_ROOTS.includes(root)) {
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
	return CONTENT_TYPES[extname(resourcePath).toLowerCase()] ?? 'application/octet-stream';
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
