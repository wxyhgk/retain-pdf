import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ArticleRepository } from '../studio/server/articles/article-repository.mjs';
import { resolveInside } from '../articles/bundle-paths.mjs';
import { isLocalOnly, PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';
import { FileRepository } from '../studio/server/files/file-repository.mjs';
import { sendFile, sendJson } from '../studio/server/api.mjs';

/**
 * Copies the img/ and assets/ files of the published articles to
 * `article-assets/<slug>/` in the built site. Drafts publish nothing, as
 * they have no page; ai/, the bundle's own files and the files kept on this
 * machine only (videos: rules.mjs) stay private.
 */
export async function publishArticleAssets(blogRoot, outDir) {
	const repository = new FileRepository(blogRoot);
	const published = (await new ArticleRepository(blogRoot).list()).filter((article) => !article.draft);
	for (const { slug } of published) {
		const listed = await repository.list(slug);
		for (const resourceRoot of PUBLISHED_FOLDERS) {
			for (const relativePath of listed[resourceRoot]) {
				if (isLocalOnly(relativePath)) continue;
				const resource = await repository.read(slug, resourceRoot, relativePath);
				const target = resolveInside(outDir, 'article-assets', slug, resourceRoot, ...relativePath.split('/'));
				await mkdir(resolve(target, '..'), { recursive: true });
				await writeFile(target, resource.body);
			}
		}
	}
	return published.map((article) => article.slug);
}

/**
 * The articles' files (img/, assets/) where the built site has them, `/article-assets/<slug>/…`, served by the dev
 * server as they are: a code file's download link, an office file's card lead there.
 */
export default function articleAssets() {
	let root = process.cwd();
	return {
		name: 'article-public-assets',
		hooks: {
			'astro:config:done': ({ config }) => { root = fileURLToPath(config.root); },
			'astro:server:setup': ({ server }) => {
				const files = new FileRepository(resolve(root, 'blog'));
				server.middlewares.use(async (request, response, next) => {
					const match = (request.url ?? '').split('?', 1)[0].match(/^\/article-assets\/([^/]+)\/([^/]+)\/(.+)$/u);
					if (!match || request.method !== 'GET') return next();
					try {
						const [slug, folder, path] = match.slice(1).map(decodeURIComponent);
						await sendFile(response, await files.stream(slug, folder, path, { range: request.headers.range }));
					} catch (error) {
						sendJson(response, Number.isInteger(error?.statusCode) ? error.statusCode : 500, { error: error instanceof Error ? error.message : String(error) });
					}
				});
			},
			'astro:build:done': async ({ dir }) => {
				await publishArticleAssets(resolve(root, 'blog'), fileURLToPath(dir));
			},
		},
	};
}
