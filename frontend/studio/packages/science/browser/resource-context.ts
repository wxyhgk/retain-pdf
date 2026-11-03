import { t } from '@blog/i18n/index.mjs';
import { parseScienceResourceRef } from '../parsers/index.ts';

let resourceBaseUrl = '';

export function setScienceResourceBaseUrl(baseUrl: string): void {
	resourceBaseUrl = baseUrl.replace(/\/+$/u, '');
}

/** Resolve a validated article-bundle path without ever accepting an absolute or parent path. */
export function resolveScienceResourceUrl(path: string): string {
	const resource = parseScienceResourceRef(`@file ${path}`);
	if (resource.kind !== 'file') throw new Error(t('科学资源路径无效'));
	if (!resourceBaseUrl) throw new Error(t('当前页面没有页面资源上下文'));
	const encodedPath = resource.path.slice(2).split('/').map(encodeURIComponent).join('/');
	return `${resourceBaseUrl}/${encodedPath}`;
}
