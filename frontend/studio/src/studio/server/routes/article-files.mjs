import { createReadStream } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';
import { openWithDefaultApp, revealInFileManager } from '../system/reveal.mjs';
import { refuse, reply, sendFile } from '../api.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * An article's own files (img/, assets/…): read, listed, uploaded, brought
 * from the drive, moved, put in the trash and back, shown in Finder; and the
 * trash itself.
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function articleFileRoutes(api, { files, manager, articleFiles, drive, testing, blogRoot }) {
	api.get('/articles/:slug/files/:root/*path', async ({ params, request, response }) => {
		await sendFile(response, await files.stream(params.slug, params.root, params.path, { range: request.headers.range }));
	}, { streams: true });

	api.get('/articles/:slug/tree', async ({ params }) => ({ entries: await manager.list(params.slug) }));
	api.post('/articles/:slug/files', async ({ params, query, request }) => {
		const declared = Number(request.headers['content-length']);
		const name = query.get('name') ?? '';
		const limit = manager.uploadLimitFor(name);
		if (declared > limit) throw refuse(413, t('文件超过 {limit} MB 上传上限', { limit: limit / 1024 / 1024 }));
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
			if (source.size > limit) throw refuse(413, t('{name} 有 {size} MB，超过文章文件 {limit} MB 的上限', { name: source.name, size: Math.round(source.size / 1024 / 1024), limit: limit / 1024 / 1024 }));
			return reply(201, await manager.upload(params.slug, folder ?? 'assets', source.name, source.body));
		} finally {
			source.body.destroy();
		}
	});
	// A picture on this machine (one an AI drew, put in an article from its answer), copied into the article's img/.
	api.post('/articles/:slug/import-picture', async ({ params, json }) => {
		const written = String((await json()).path ?? '').replace(/^file:\/\//u, '');
		const path = isAbsolute(written) ? written : resolve(blogRoot, written);
		const body = createReadStream(path);
		try {
			return reply(201, await manager.upload(params.slug, 'img', basename(path), body));
		} finally {
			body.destroy();
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

	api.post('/articles/:slug/open', async ({ params, json }) => {
		const { path } = await json();
		const absolute = await manager.locate(params.slug, path ?? '');
		if ((await lstat(absolute)).isDirectory()) throw refuse(400, t('{path} 是文件夹', { path }));
		// Browser tests must not open programs on the machine running them.
		if (!testing.blog) await openWithDefaultApp(absolute);
		return { path };
	});

	// A file's earlier versions (file-history.mjs): the list, one's text, one brought back (what is there kept first).
	api.get('/articles/:slug/file-history', async ({ params, query }) => ({ versions: await manager.history.list(params.slug, query.get('path') ?? '') }));
	api.get('/articles/:slug/file-history/:id', async ({ params, query }) => {
		const kept = await manager.history.version(params.slug, params.id, query.get('path') ?? '');
		const info = await lstat(kept);
		if (info.size > 2 * 1024 * 1024) return { text: null, size: info.size };
		const bytes = await readFile(kept);
		return { text: bytes.includes(0) ? null : bytes.toString('utf8'), size: info.size };
	});
	api.post('/articles/:slug/file-history/restore', async ({ params, json }) => {
		const { id, path } = await json();
		const kept = await manager.history.version(params.slug, id, path);
		const folder = String(path).split('/').slice(0, -1).join('/');
		return manager.upload(params.slug, folder, basename(String(path)), createReadStream(kept), { replace: true, keepAs: 'before-restore' });
	});

	// What is in the trash, and deleting something in it for good.
	api.get('/trash', async () => ({ entries: await manager.listTrash() }));
	api.post('/trash/purge', async ({ json }) => manager.purge((await json()).trashed));
}
