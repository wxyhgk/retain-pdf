import { askAboutImage } from '../ai/ai-vision.mjs';
import { insertBelowImage } from '../articles/image-insert.mjs';
import { startInstruction } from '../ai/instructions.mjs';
import { noPushEnv } from '../ai/risky-commands.mjs';
import { OCR_COMMAND, startPdfOcr } from '../tasks/pdf-ocr.mjs';
import { commandWords } from '../tasks/tasks.mjs';
import { refuse, reply } from '../api.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * What an AI does in the Studio: the AIs it starts (the 终端 tab's buttons,
 * Alt+Enter) and the model it asks (AI 设置), a shell for the 终端 tab, a
 * line of an article done by an agent, a PDF read into a page, a picture
 * read by the model and what it read put under it.
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function aiRoutes(api, { notesRoot, blogRoot, articles, files, history, manager, drive, driveText, terminals, tasks, aiSettings, agentSettings, programEnv, articleFolder }) {
	api.get('/agents', () => agentSettings.shown());
	api.put('/agents', async ({ json }) => agentSettings.set(await json()));
	// AI 设置: the page sees no key, only whether there is one.
	api.get('/ai/settings', () => aiSettings.shown());
	api.put('/ai/settings', async ({ json }) => aiSettings.set(await json()));

	// A shell for the 终端 tab: in the notes' folder, the open article's folder, or the drive.
	api.post('/terminal', async ({ json }) => {
		const { cwd, slug } = await json();
		const driveRoot = await drive.root();
		if (cwd === 'drive' && !driveRoot) throw refuse(409, t('还没有选择资料库文件夹'));
		const folder = cwd === 'article' ? articleFolder(slug) : cwd === 'drive' ? driveRoot : notesRoot;
		if (cwd === 'article') await manager.locate(slug, '');
		const env = programEnv(cwd === 'article' ? slug : null, driveRoot);
		// The drive's text brought up to date for what the AI may read.
		if (driveRoot) void driveText.refresh().catch(() => {});
		return { ...(await terminals.open(folder, env)), cwd: folder };
	});

	// Alt+Enter: an AI does what a line of the article asks, in its folder, as a task.
	api.post('/articles/:slug/instruct', async ({ params: { slug }, json }) => {
		const { line, fresh, agent } = await json();
		await manager.locate(slug, '');
		const task = await startInstruction({ tasks, agents: agentSettings, slug, folder: articleFolder(slug), env: { ...programEnv(slug, await drive.root()), ...noPushEnv() }, line, fresh: Boolean(fresh), agentId: agent });
		return reply(202, { id: task.id });
	});

	// A PDF of the article read by PaddleOCR into a page under it, as a task (STUDIO_OCR_COMMAND: browser tests' stand-in).
	api.post('/articles/:slug/ocr', async ({ params: { slug }, json }) => {
		const { path } = await json();
		const command = process.env.STUDIO_OCR_COMMAND ? commandWords(process.env.STUDIO_OCR_COMMAND) : OCR_COMMAND;
		return reply(202, await startPdfOcr({ tasks, articles, blogRoot, slug, path, env: programEnv(slug, await drive.root()), command }));
	});

	// 识别: a picture of the article (`./img/…` or `./assets/…`) read by the model, as asked by `prompt`.
	api.post('/articles/:slug/recognize', async ({ params: { slug }, json }) => {
		const { image, prompt } = await json();
		if (typeof prompt !== 'string' || !prompt.trim()) throw refuse(400, t('要说明识别什么（prompt）'));
		const picture = String(image ?? '').replace(/^\.\//u, '').match(/^(img|assets)\/(.+)$/u);
		if (!picture) throw refuse(400, t('只能识别文章自己的图片（./img/ 或 ./assets/ 里的）'));
		const { body, contentType } = await files.read(slug, picture[1], picture[2], { sizeLimit: 20 * 1024 * 1024 });
		return { text: await askAboutImage(await aiSettings.config(), { image: body, mediaType: String(contentType).split(';')[0], prompt }) };
	});

	// What was read from a picture, put under it in the file (the text as it was goes into history first):
	// open in the Studio, it comes as a change from outside, to accept or not.
	api.post('/articles/:slug/below-image', async ({ params: { slug }, json }) => {
		const { image, markdown } = await json();
		if (typeof image !== 'string' || typeof markdown !== 'string' || !markdown.trim()) throw refuse(400, t('要给出图片和要放的内容'));
		const { source, revision } = await articles.read(slug);
		const next = insertBelowImage(source, image, markdown);
		if (next === null) throw refuse(404, t('没在文章里找到这张图'));
		await history.keep(slug, source, 'before-change');
		await articles.save(slug, { source: next, expectedRevision: revision });
		return { slug };
	});
}
