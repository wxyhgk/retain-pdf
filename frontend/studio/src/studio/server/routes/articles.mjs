import { checkArticle } from '../articles/article-check.mjs';
import { pageVersion } from '../articles/page-version.mjs';
import { refuse, reply, sendEvents, sendFile } from '../api.mjs';
import { FindReplace } from '../articles/find-replace.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The articles: the list and search, one read, saved, deleted and put back,
 * its place in the tree of pages, its other names, its history, its library,
 * what links to it, what would be wrong with it once published, and git.
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function articleRoutes(api, { site, blogRoot, articles, history, manager, articleGit, library, codeFiles, watcher, notesIndex, templates }) {
	// What changes in blog/, as server-sent events: `data: [{"slug":"note","paths":["index.md"]}]`.
	api.get('/events', ({ request, response }) => sendEvents(request, response, (send) => watcher.subscribe(send)), { streams: true });

	api.get('/articles', async () => ({ articles: await articles.list() }));
	api.post('/articles', async ({ json }) => reply(201, await articles.create(await json())));
	// Page templates (templates/): the list, one filled in for a page made now, a page's body kept as one (存为模板).
	api.get('/templates', async () => ({ templates: await templates.list() }));
	api.post('/templates/:id/render', async ({ params, json }) => templates.render(params.id, { title: String((await json()).title ?? '') }));
	api.post('/templates', async ({ json }) => {
		const { name, slug } = await json();
		const { source } = await articles.read(String(slug ?? ''));
		return reply(201, await templates.save(name, source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/u, '')));
	});
	// 查找替换 in all the articles (find-replace.mjs): where the words are, then the places chosen changed.
	const finder = new FindReplace({ articles, history, blogRoot, site });
	const findOptions = ({ caseSensitive, skipCode }) => ({ caseSensitive: caseSensitive === true, skipCode: skipCode !== false });
	api.post('/find', async ({ json }) => {
		const asked = await json();
		return { results: await finder.preview(String(asked.find ?? ''), findOptions(asked)) };
	});
	api.post('/replace', async ({ json }) => {
		const asked = await json();
		return finder.apply(String(asked.find ?? ''), asked.replacement, asked.picks, findOptions(asked));
	});
	// Articles whose title or text holds `q`.
	api.get('/search', async ({ query }) => ({ results: await articles.search(query.get('q') ?? '') }));
	// What is scattered in all the notes, gathered: their code (fences, scripts in their folders), their pictures.
	api.get('/notes/code', async () => ({ items: await notesIndex.code() }));
	api.get('/notes/images', async () => ({ items: await notesIndex.images() }));
	api.get('/notes/pictures/:slug/*path', async ({ params, response }) => sendFile(response, await notesIndex.picture(params.slug, params.path)), { streams: true });

	api.get('/articles/:slug', ({ params }) => articles.read(params.slug));
	// What was written kept as a version every while (as Notion keeps a page's history).
	api.put('/articles/:slug', async ({ params, json }) => articles.save(params.slug, await json(), { site, before: (current) => history.keepWritten(params.slug, current) }));
	// To the trash, from where it can be put back.
	api.delete('/articles/:slug', ({ params }) => articles.exclusive(params.slug, () => manager.trashArticle(params.slug)));
	api.post('/restored-articles', async ({ json }) => manager.restoreArticle((await json()).trashed));

	// Under another page, or at the top (`parent` empty): the tree of pages.
	api.post('/articles/:slug/parent', async ({ params, json }) => {
		const { parent, before, after } = await json();
		const text = (value) => (typeof value === 'string' ? value : '');
		return articles.setParent(params.slug, text(parent), { before: text(before), after: text(after) });
	});
	// 并入上级页面: its text into the page it is under (whose text as it was goes into that page's history), then itself to the trash.
	api.post('/articles/:slug/merge', async ({ params: { slug } }) => {
		const merged = await articles.merge(slug, { site, before: (parent, source) => history.keep(parent, source, 'before-change') });
		const { trashed } = await articles.exclusive(slug, () => manager.trashArticle(slug));
		return { ...merged, trashed };
	});
	// Another folder name for an article, or a copy of it under one.
	api.post('/articles/:slug/rename', async ({ params, json }) => articles.rename(params.slug, (await json()).to, { site }));
	api.post('/articles/:slug/duplicate', async ({ params, json }) => reply(201, await articles.duplicate(params.slug, (await json()).to)));

	// Earlier versions of an article, kept in its ai/history: the list, one of them, one more.
	api.get('/articles/:slug/history', async ({ params }) => ({ versions: await history.list(params.slug) }));
	api.get('/articles/:slug/history/:name', async ({ params }) => ({ source: await history.read(params.slug, params.name) }));
	api.post('/articles/:slug/history', async ({ params, json }) => {
		const { source, reason } = await json();
		return reply(201, await history.keep(params.slug, source, reason));
	});

	// A work added to the article's library (assets/refs.bib) by its DOI.
	api.post('/articles/:slug/references', async ({ params, json }) => library.addDoi(params.slug, (await json()).doi));
	// What would be wrong with the article, as the editor holds it, once published.
	api.post('/articles/:slug/check', async ({ params: { slug }, json }) => {
		const { source } = await json();
		if (typeof source !== 'string') throw refuse(400, t('文章内容必须是文本'));
		await manager.locate(slug, '');
		return { issues: await checkArticle(blogRoot, slug, source) };
	});
	// The articles that link to this one.
	api.get('/articles/:slug/backlinks', async ({ params }) => ({ backlinks: await articles.backlinks(params.slug, { site }) }));
	// The mark the page keeps its picture of itself under (page-version.mjs).
	api.get('/articles/:slug/page-version', async ({ params }) => ({ version: await pageVersion(blogRoot, params.slug) }));
	// A code block's `@file`, drawn as the blog draws it.
	api.get('/articles/:slug/code-file', async ({ params, query }) => ({
		figure: await codeFiles.figure(params.slug, query.get('path') ?? '', query.get('language') ?? '', query.get('meta') ?? ''),
	}));
	api.put('/articles/:slug/chemistry-views/:key', async ({ params, json }) => articles.saveMoleculeView(params.slug, params.key, await json()));

	// Which articles have changes not committed; one committed, with the folders of articles gone from disk.
	api.get('/git', () => articleGit.status());
	api.post('/articles/:slug/commit', async ({ params: { slug }, json }) => {
		const { message } = await json();
		return articles.exclusive(slug, () => articleGit.commit(slug, message));
	});
}
