import type { ScienceResourceRef } from '../model.ts';

const FILE_DIRECTIVE = /^@file[\t ]+(.+)$/;
const SAFE_ROOTS = ['./assets/', './img/'] as const;

export class InvalidScienceResourcePathError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidScienceResourcePathError';
	}
}

function validateBundleRelativePath(path: string): void {
	if (path.includes('\\')) throw new InvalidScienceResourcePathError('@file 路径必须使用正斜杠');
	if (/[\u0000-\u001f\u007f]/.test(path)) {
		throw new InvalidScienceResourcePathError('@file 路径不能包含控制字符');
	}
	if (!SAFE_ROOTS.some((root) => path.startsWith(root))) {
		throw new InvalidScienceResourcePathError('@file 只能引用当前文章的 ./assets/ 或 ./img/');
	}

	const segments = path.split('/');
	const contentSegments = segments.slice(2);
	if (segments[0] !== '.' || !segments[1] || contentSegments.some((segment) => !segment || segment === '.' || segment === '..')) {
		throw new InvalidScienceResourcePathError('@file 路径包含无效的目录片段');
	}
	if (path.endsWith('/')) throw new InvalidScienceResourcePathError('@file 必须指向文件');
}

/** Parse the exact one-line `@file ./assets/...` convention used by science fences. */
export function parseScienceResourceRef(source: string): ScienceResourceRef {
	const text = source.trim();
	if (!text.startsWith('@file')) return { kind: 'inline', text };

	const match = text.match(FILE_DIRECTIVE);
	if (!match || text.includes('\n') || text.includes('\r')) {
		throw new InvalidScienceResourcePathError('@file 必须是代码块中唯一的一行');
	}

	const path = match[1].trim();
	validateBundleRelativePath(path);
	return { kind: 'file', path };
}
