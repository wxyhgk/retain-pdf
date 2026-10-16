import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ArticleRepository } from '../studio/server/article-repository.mjs';
import { resolveInside } from '../studio/server/bundle-paths.mjs';
import { FileRepository, PUBLIC_RESOURCE_ROOTS } from '../studio/server/file-repository.mjs';

/**
 * Copies the img/ and assets/ files of the published articles to
 * `article-assets/<slug>/` in the built site. Drafts publish nothing, as
 * they have no page; ai/ and the bundle's own files stay private.
 */
export async function publishArticleAssets(blogRoot, outDir) {
	const repository = new FileRepository(blogRoot);
	const published = (await new ArticleRepository(blogRoot).list()).filter((article) => !article.draft);
	for (const { slug } of published) {
		const listed = await repository.list(slug);
		for (const resourceRoot of PUBLIC_RESOURCE_ROOTS) {
			for (const relativePath of listed[resourceRoot]) {
				const resource = await repository.read(slug, resourceRoot, relativePath);
				const target = resolveInside(outDir, 'article-assets', slug, resourceRoot, ...relativePath.split('/'));
				await mkdir(resolve(target, '..'), { recursive: true });
				await writeFile(target, resource.body);
			}
		}
	}
	return published.map((article) => article.slug);
}

export default function articleAssets() {
	let root = process.cwd();
	return {
		name: 'article-public-assets',
		hooks: {
			'astro:config:done': ({ config }) => { root = fileURLToPath(config.root); },
			'astro:build:done': async ({ dir }) => {
				await publishArticleAssets(resolve(root, 'blog'), fileURLToPath(dir));
			},
		},
	};
}
