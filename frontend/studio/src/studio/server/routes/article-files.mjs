import { lstat } from 'node:fs/promises';
import { revealInFileManager } from '../reveal.mjs';
import { refuse, reply, sendFile } from '../api.mjs';

/**
 * An article's own files (img/, assets/…): read, listed, uploaded, brought
 * from the drive, moved, put in the trash and back, shown in Finder; and the
 * trash itself.
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function articleFileRoutes(api, { files, manager, articleFiles, drive, testing }) {
	api.get('/articles/:slug/files/:root/*path', async ({ params, request, response }) => {
		await sendFile(response, await files.stream(params.slug, params.root, params.path, { range: request.headers.range }));
	}, { streams: true });

	api.get('/articles/:slug/tree', async ({ params }) => ({ entries: await manager.list(params.slug) }));
	api.post('/articles/:slug/files', async ({ params, query, request }) => {
		const declared = Number(request.headers['content-length']);
		const name = query.get('name') ?? '';
		const limit = manager.uploadLimitFor(name);
		if (declared > limit) throw refuse(413, `文件超过 ${limit / 1024 / 1024} MB 上传上限`);
		return reply(201, await manager.upload(params.slug, query.get('folder') ?? '', name, request, {
			replace: query.get('replace') === '1',
			subfolders: (query.get('subfolder') ?? '').split('/').filter(Boolean),
		}));
	}, { body: 'application/octet-stream' });
	// A file of the drive, copied into the article (`img/` or `assets/`) under a name a link takes.
	api.post('/articles/:slug/import', async ({ params, json }) => {
		const { from, folder } = await json();
		const source = await drive.stream(String(from ?? ''));
		try {
			const limit = manager.uploadLimitFor(source.name);
			if (source.size > limit) throw refuse(413, `${source.name} 有 ${Math.round(source.size / 1024 / 1024)} MB，超过文章文件 ${limit / 1024 / 1024} MB 的上限`);
			return reply(201, await manager.upload(params.slug, folder ?? 'assets', source.name, source.body));
		} finally {
			source.body.destroy();
		}
	});
	api.post('/articles/:slug/folders', async ({ params, json }) => reply(201, await manager.createFolder(params.slug, (await json()).path)));
	api.post('/articles/:slug/move', async ({ params, json }) => {
		const { from, to, expectedRevision } = await json();
		return articleFiles.move(params.slug, from, to, { expectedRevision });
	});
	api.post('/articles/:slug/trash', async ({ params, json }) => manager.trash(params.slug, (await json()).path));
	api.post('/articles/:slug/restore', async ({ params, json }) => manager.restore(params.slug, (await json()).trashed));
	api.post('/articles/:slug/reveal', async ({ params, json }) => {
		const { path } = await json();
		const absolute = await manager.locate(params.slug, path ?? '');
		// Browser tests must not open windows on the machine running them.
		if (!testing.blog) await revealInFileManager(absolute, { isDirectory: (await lstat(absolute)).isDirectory() });
		return { path: path ?? '' };
	});

	// What is in the trash, and deleting something in it for good.
	api.get('/trash', async () => ({ entries: await manager.listTrash() }));
	api.post('/trash/purge', async ({ json }) => manager.purge((await json()).trashed));
}
