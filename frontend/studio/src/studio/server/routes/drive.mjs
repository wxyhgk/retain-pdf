import { lstat } from 'node:fs/promises';
import { chooseFolder } from '../system/choose-folder.mjs';
import { revealInFileManager } from '../system/reveal.mjs';
import { refuse, reply, sendFile } from '../api.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The drive (资料库): which folder it is, choosing it, what is in it, its
 * words searched, and changing what is in it.
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function driveRoutes(api, { drive, driveText, testing }) {
	const refresh = () => void driveText.refresh().catch(() => {});
	/** What changes in the drive is read for its words once the change is done. */
	const changing = (handler) => (context) => {
		context.response.once('finish', refresh);
		return handler(context);
	};

	api.get('/drive', () => drive.describe());
	api.post('/drive/root', async ({ json }) => {
		const chosen = await drive.choose((await json()).path);
		refresh();
		return chosen;
	});
	api.post('/drive/choose', async () => {
		const chosen = await chooseFolder(t('选择资料库文件夹'));
		if (!chosen) return { ...(await drive.describe()), cancelled: true };
		const described = await drive.choose(chosen);
		refresh();
		return described;
	});
	api.get('/drive/search', ({ query }) => driveText.search(query.get('q') ?? ''));
	api.get('/drive/list', async ({ query }) => ({ entries: await drive.list(query.get('path') ?? '') }));
	api.get('/drive/files/*path', async ({ params, response }) => sendFile(response, await drive.stream(params.path)), { streams: true });

	api.post('/drive/upload', changing(async ({ query, request }) => {
		const declared = Number(request.headers['content-length']);
		if (declared > drive.uploadSizeLimit) throw refuse(413, t('文件超过 {limit} MB 上传上限', { limit: drive.uploadSizeLimit / 1024 / 1024 }));
		return reply(201, await drive.upload(query.get('folder') ?? '', query.get('name') ?? '', request, { replace: query.get('replace') === '1' }));
	}), { body: 'application/octet-stream' });
	api.post('/drive/folders', changing(async ({ json }) => reply(201, await drive.createFolder((await json()).path))));
	api.post('/drive/move', changing(async ({ json }) => {
		const { from, to } = await json();
		return drive.move(from, to);
	}));
	api.post('/drive/trash', changing(async ({ json }) => drive.trash((await json()).path)));
	api.post('/drive/restore', changing(async ({ json }) => drive.restore((await json()).trashed)));
	api.post('/drive/reveal', async ({ json }) => {
		const { path } = await json();
		const absolute = await drive.locate(path ?? '');
		// Browser tests must not open windows on the machine running them.
		if (!testing.drive) await revealInFileManager(absolute, { isDirectory: (await lstat(absolute)).isDirectory() });
		return { path: path ?? '' };
	});
}
