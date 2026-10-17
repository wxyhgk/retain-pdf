import { relative, resolve, sep } from 'node:path';

import { SLUG_PATTERN } from './rules.mjs';

export function assertArticleSlug(slug) {
	if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
		throw new StudioPathError('slug 只能包含小写字母、数字和连字符');
	}
	return slug;
}

export function resolveInside(root, ...segments) {
	const resolvedRoot = resolve(root);
	const target = resolve(resolvedRoot, ...segments);
	const pathFromRoot = relative(resolvedRoot, target);
	if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot.includes('\0')) {
		throw new StudioPathError('路径超出允许的文章目录');
	}
	return target;
}

export function articleBundlePaths(blogRoot, slug) {
	const safeSlug = assertArticleSlug(slug);
	const directory = resolveInside(blogRoot, safeSlug);
	return Object.freeze({
		directory,
		markdown: resolveInside(directory, 'index.md'),
		views: resolveInside(directory, 'article.views.json'),
		img: resolveInside(directory, 'img'),
		assets: resolveInside(directory, 'assets'),
		ai: resolveInside(directory, 'ai'),
	});
}

export class StudioPathError extends Error {
	constructor(message) {
		super(message);
		this.name = 'StudioPathError';
		this.statusCode = 400;
	}
}
