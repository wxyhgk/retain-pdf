import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { t } from '@blog/i18n/index.mjs';

import { picturePaths } from './app-blocks.mjs';

/**
 * The blog's build: an app's block (app-blocks.mjs) is the picture the app kept for it, a figure like any other. One
 * without a picture yet is left out, and said for the check before publishing (ruleId `app-block-picture`).
 */
export const name = 'app-blocks';
export const inject = ['blocks'];

const FENCE = /^[a-z][a-z0-9-]{1,31}$/u;

/** The blocks the apps of `folder` (the project's apps/) give, each with the app's name. */
export function appBlocks(folder = fileURLToPath(new URL('../../apps', import.meta.url))) {
	let names = [];
	try {
		names = readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
	} catch {
		return [];
	}
	return names.flatMap((id) => {
		let manifest;
		try {
			manifest = JSON.parse(readFileSync(join(folder, id, 'app.json'), 'utf8'));
		} catch {
			return [];
		}
		if (!Array.isArray(manifest.blocks)) return [];
		return manifest.blocks
			.filter((block) => block && typeof block.fence === 'string' && FENCE.test(block.fence))
			.map((block) => ({ fence: block.fence, title: typeof block.title === 'string' && block.title.trim() ? block.title.trim() : id, app: id }));
	});
}

export function apply(ctx) {
	for (const block of appBlocks()) {
		try {
			ctx.blocks.register({ name: `app-block-${block.fence}`, fence: block.fence, remark: (node, file) => blockPicture(block, node, file) });
		} catch (error) {
			// A fence another plugin has: its block stays that plugin's.
			console.warn(`[app-blocks] ${error instanceof Error ? error.message : error}`); // i18n-ignore: developer log
		}
	}
}

/** The block as the picture its app kept, or nothing (said) when there is none yet. */
export function blockPicture(block, node, file) {
	const article = file.path ? dirname(file.path) : null;
	const found = article ? picturePaths(block.fence, node.value).find((path) => existsSync(join(article, ...path.split('/')))) : null;
	if (found) return { type: 'paragraph', children: [{ type: 'image', url: `./${found}`, alt: block.title }] };
	file.message(t('「{title}」块在博客上还没有图：在 Studio 里打开这篇，等它画好会自己存一张', { title: block.title }), { place: node.position, source: name, ruleId: 'app-block-picture' });
	return { type: 'html', value: '' };
}
