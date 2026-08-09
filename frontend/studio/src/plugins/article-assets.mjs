import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ARTICLE_SLUG_PATTERN, resolveInside } from '../studio/server/bundle-paths.mjs';
import { FileRepository, PUBLIC_RESOURCE_ROOTS } from '../studio/server/file-repository.mjs';

/** Publish only validated article img/assets files; ai and bundle metadata remain private. */
export default function articleAssets() {
	let root = process.cwd();
	return {
		name: 'article-public-assets',
		hooks: {
			'astro:config:done': ({ config }) => { root = fileURLToPath(config.root); },
			'astro:build:done': async ({ dir }) => {
				const blogRoot = resolve(root, 'blog');
				const repository = new FileRepository(blogRoot);
				const entries = await readdir(blogRoot, { withFileTypes: true });
				for (const entry of entries) {
					if (!entry.isDirectory() || !ARTICLE_SLUG_PATTERN.test(entry.name)) continue;
					const listed = await repository.list(entry.name);
					for (const resourceRoot of PUBLIC_RESOURCE_ROOTS) {
						for (const relativePath of listed[resourceRoot]) {
							const resource = await repository.read(entry.name, resourceRoot, relativePath);
							const target = resolveInside(
								fileURLToPath(dir),
								'article-assets',
								entry.name,
								resourceRoot,
								...relativePath.split('/'),
							);
							await mkdir(resolve(target, '..'), { recursive: true });
							await writeFile(target, resource.body);
						}
					}
				}
			},
		},
	};
}
