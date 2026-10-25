import assert from 'node:assert/strict';
import test from 'node:test';

import { articleFileUrl } from '../src/studio/api/client.ts';
import { ArticleSession, changedProperties, type SaveState, type SessionApi, type SessionHost } from '../src/studio/state/article-session.ts';
import type { ArticlePayload, ArticleProperties } from '../src/studio/types.ts';
import { filterArticles } from '../src/studio/workspace/article-list.ts';
import { autoSlug, cleanSlug, freeSlug, isAutoSlug, readableSlug } from '../src/studio/workspace/page-names.ts';
import { parseTags } from '../src/studio/workspace/page-header.ts';
import { saveStateText } from '../src/studio/workspace/top-bar.ts';

const SOURCE = "---\ntitle: '笔记'\ndescription: ''\npubDate: '2026-10-14'\ntags: []\ndraft: true\n---\n\n第一段  \n用了 *星号*。\n\n第二段。\n";
const PROPERTIES: ArticleProperties = { title: '笔记', description: '', pubDate: '2026-10-14', tags: [], draft: true };

class Conflict extends Error {}

/** The server: articles on a disk the test can change, and saves it can hold back or fail. */
function fakeApi(source = SOURCE) {
	const disk = { source, revision: 'r1' };
	let revisions = 1;
	const saves: string[] = [];
	/** What was kept in the article's history, with why. */
	const kept: [string, string][] = [];
	let hold: Promise<void> | null = null;
	let failNext: Error | null = null;
	const article = (slug: string): ArticlePayload => ({ slug, source: disk.source, revision: disk.revision, properties: PROPERTIES, chemistryViews: {} });
	const api: SessionApi = {
		getArticle: async (slug) => article(slug),
		async saveArticle(_slug, next, expected) {
			saves.push(next);
			if (hold) await hold;
			if (failNext) {
				const error = failNext;
				failNext = null;
				throw error;
			}
			if (expected !== disk.revision) throw new Conflict('changed on disk');
			disk.source = next;
			disk.revision = `r${++revisions}`;
			return { revision: disk.revision };
		},
		saveMoleculeView: async () => ({ revision: disk.revision, chemistryViews: {} }),
		isConflict: (error) => error instanceof Conflict,
		keepVersion: async (_slug, kept_source, reason) => {
			kept.push([kept_source, reason]);
		},
	};
	return {
		api,
		disk,
		saves,
		kept,
		/** Someone else writes the article. */
		write(next: string) {
			disk.source = next;
			disk.revision = `r${++revisions}`;
		},
		holdSaves() {
			let release!: () => void;
			hold = new Promise((resolve) => { release = resolve; });
			return () => { hold = null; release(); };
		},
		failNextSave(error: Error) { failNext = error; },
	};
}

/** The page: an editor that echoes the body, and a record of what was shown. */
function fakeHost(answers: boolean[] = [], decide: (body: string, shown: string) => string = (body) => body) {
	const states: string[] = [];
	const asked: string[] = [];
	const toasts: string[] = [];
	const mounted: string[] = [];
	const reviews: string[] = [];
	const saved: ArticleProperties[] = [];
	let roundtrip: boolean | null = null;
	let title = '';
	/** What the editor holds and has not reported yet. */
	let unreported: (() => void) | null = null;
	const host: SessionHost = {
		mount: async (_article, body) => {
			mounted.push(body);
			return body;
		},
		review: async (_article, body) => {
			reviews.push(body);
			const shown = decide(body, mounted.at(-1)!);
			mounted.push(shown);
			return shown;
		},
		settle: () => {
			const report = unreported;
			unreported = null;
			report?.();
		},
		confirm: (message) => {
			asked.push(message);
			return answers.shift() ?? false;
		},
		toast: (message) => { toasts.push(message); },
		opened: ({ properties }) => { title = properties.title; },
		saveState: (state: SaveState) => { states.push(saveStateText(state).text); },
		roundtrip: (exact) => { roundtrip = exact; },
		retitled: (next) => { title = next; },
		saved: (_slug, properties) => { saved.push(properties); },
	};
	return {
		host, states, asked, toasts, mounted, reviews, saved,
		roundtrip: () => roundtrip,
		title: () => title,
		/** The editor holds an edit it reports later, or when asked to settle. */
		holdEdit: (report: () => void) => { unreported = report; },
	};
}

const QUICK = { delay: 5, maxWait: 5, retryDelay: 5 };
const settle = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const body = (source: string) => source.slice(source.indexOf('---\n', 4) + 4);

async function opened(api = fakeApi(), page = fakeHost()) {
	const session = new ArticleSession(api.api, page.host, QUICK);
	await session.open('note');
	return { session, api, page };
}

test('opening an article mounts its body and reports it loaded, kept byte for byte', async () => {
	const { session, page } = await opened();
	assert.equal(session.slug, 'note');
	assert.deepEqual(page.mounted, [body(SOURCE)]);
	assert.equal(page.title(), '笔记');
	assert.equal(page.roundtrip(), true);
	assert.deepEqual(page.states, ['正在载入…', '已载入']);
	assert.equal(session.current.dirty, false);
});

test('an edit is saved by itself, and blocks it did not touch keep their bytes', async () => {
	const { session, api, page } = await opened();
	// The editor writes the first paragraph its own way: that is not an edit.
	session.editBody('第一段\\\n用了 _星号_。\n\n第二段，改过。\n');
	assert.equal(session.current.dirty, true);
	assert.equal(page.states.at(-1), '未保存');
	await settle();
	assert.equal(api.disk.source, SOURCE.replace('第二段。', '第二段，改过。'));
	assert.deepEqual(page.states.slice(-2), ['正在保存…', '已保存']);
	assert.deepEqual(page.saved, [PROPERTIES]);
	assert.equal(session.current.dirty, false);
});

test('properties that cannot be saved hold the save back until they can', async () => {
	const { session, api, page } = await opened();
	assert.equal(session.editProperties({ ...PROPERTIES, title: '' }), '文章标题不能为空');
	session.editBody(`${body(SOURCE)}\n第三段。\n`);
	await settle();
	assert.equal(api.saves.length, 0);
	assert.equal(session.editProperties({ ...PROPERTIES, title: '新标题' }), null);
	assert.equal(page.title(), '新标题');
	await settle();
	assert.equal(api.saves.length, 1);
	assert.match(api.disk.source, /^---\ntitle: "新标题"\n/u);
	assert.match(api.disk.source, /第三段。/u);
});

test('what is typed while a save is under way is saved next', async () => {
	const { session, api } = await opened();
	const release = api.holdSaves();
	session.editBody(`${body(SOURCE)}\n先\n`);
	await settle();
	assert.equal(api.saves.length, 1);
	session.editBody(`${body(SOURCE)}\n先后\n`);
	release();
	await settle();
	assert.equal(api.saves.length, 2);
	assert.match(api.disk.source, /先后/u);
	assert.equal(session.current.dirty, false);
});

test('a failed save is tried again', async () => {
	const { session, api, page } = await opened();
	api.failNextSave(new Error('连接断了'));
	session.editBody(`${body(SOURCE)}\n第三段。\n`);
	await settle(10);
	assert.ok(page.states.includes('连接断了，稍后自动重试'));
	await settle();
	assert.match(api.disk.source, /第三段。/u);
	assert.equal(page.states.at(-1), '已保存');
});

test('a save that meets a change on disk asks nothing: both versions are kept, and rejecting the change keeps the edits', async () => {
	// The author rejects every change: the editor keeps what it held, their edits.
	const mine = `${body(SOURCE)}\n我的改动\n`;
	const { session, api, page } = await opened(fakeApi(), fakeHost([], () => mine));
	const release = api.holdSaves();
	session.editBody(mine);
	await settle(10);
	api.write(SOURCE.replace('第二段。', '终端改的。'));
	release();
	await settle(80);
	assert.equal(page.asked.length, 0);
	// What was saved before the change on disk, and the edits not yet saved.
	assert.deepEqual(api.kept.map(([, reason]) => reason), ['before-change', 'unsaved']);
	assert.equal(api.kept[0][0], SOURCE);
	assert.match(api.kept[1][0], /我的改动/u);
	assert.equal(page.reviews.length, 1);
	assert.ok(page.toasts.includes('你没保存的版本已存进「历史版本」'));
	assert.match(api.disk.source, /我的改动/u);
	assert.doesNotMatch(api.disk.source, /终端改的/u);
	assert.equal(page.states.at(-1), '已保存');
});

test('a change on disk is reviewed when nothing is unsaved; accepted, it stays as it is', async () => {
	const { session, api, page } = await opened();
	api.write(SOURCE.replace('第二段。', '终端改的。'));
	session.changedOnDisk(['img/plot.png']);
	await settle();
	assert.equal(page.reviews.length, 0, 'other files do not count');
	session.changedOnDisk(['index.md']);
	await settle();
	assert.equal(page.reviews.length, 1);
	assert.match(page.reviews[0], /终端改的/u);
	assert.equal(page.mounted.length, 2, 'reviewed where it is, not opened anew');
	assert.ok(page.states.includes('改动待审阅'));
	assert.equal(page.states.at(-1), '已保存');
	assert.equal(api.saves.length, 0);
	assert.equal(session.current.source, api.disk.source);
	assert.equal(session.current.dirty, false);
	// What was there before the change is kept, to go back to.
	assert.deepEqual(api.kept, [[SOURCE, 'before-change']]);
});

test('blocks written at the end on disk (a conversation’s page, its turns) are added unreviewed; edits not yet saved are kept', async () => {
	const page = fakeHost();
	let shown = body(SOURCE);
	const added: string[] = [];
	page.host.appended = (_slug, markdown) => {
		added.push(markdown);
		shown = `${shown.trimEnd()}\n\n${markdown}\n`;
		return shown;
	};
	const { session, api } = await opened(fakeApi(), page);
	api.write(`${SOURCE}\n\`\`\`ask\n问\n\`\`\`\n\n答。\n`);
	session.changedOnDisk(['index.md']);
	await settle();
	assert.deepEqual(added, ['```ask\n问\n```\n\n答。']);
	assert.equal(page.reviews.length, 0);
	assert.deepEqual(api.kept, []);
	assert.equal(session.current.dirty, false);

	// Typed, its save meeting the turn written meanwhile: both are there.
	const release = api.holdSaves();
	shown = shown.replace('第二段。', '我改的。');
	session.editBody(shown);
	await settle(10);
	api.write(`${api.disk.source.trimEnd()}\n\n下一轮的回答。\n`);
	release();
	await settle(80);
	assert.deepEqual(added.at(-1), '下一轮的回答。');
	assert.equal(page.reviews.length, 0);
	assert.match(api.disk.source, /我改的。[\s\S]*答。\n\n下一轮的回答。\n$/u);
	assert.equal(page.states.at(-1), '已保存');

	// Anything else changed on disk is reviewed, as on any page.
	api.write(api.disk.source.replace('我改的。', '别处改的。'));
	session.changedOnDisk(['index.md']);
	await settle();
	assert.equal(page.reviews.length, 1);
});

test('what is rejected in review is saved back over the change on disk', async () => {
	// The author rejects every change: the editor keeps what it showed.
	const { session, api } = await opened(fakeApi(), fakeHost([], (_body, shown) => shown));
	api.write(SOURCE.replace('第二段。', '终端改的。'));
	session.changedOnDisk(['index.md']);
	await settle();
	assert.equal(api.saves.length, 1);
	assert.equal(api.disk.source, SOURCE);
	assert.equal(session.current.dirty, false);
});

test('a change to the properties alone is taken without review, naming what changed', async () => {
	const api = fakeApi();
	const { session, page } = await opened(api);
	const changed = SOURCE.replace("title: '笔记'", "title: '新题目'");
	api.write(changed);
	// The page reads properties from the article it is given: as the server would, from the new source.
	const getArticle = api.api.getArticle;
	api.api.getArticle = async (slug) => ({ ...(await getArticle(slug)), properties: { ...PROPERTIES, title: '新题目' } });
	session.changedOnDisk(['index.md']);
	await settle();
	assert.equal(page.reviews.length, 0);
	assert.equal(page.mounted.length, 1);
	assert.equal(session.current.source, api.disk.source);
	assert.deepEqual(page.toasts, ['磁盘上改了标题']);
	assert.deepEqual(api.kept, [[SOURCE, 'before-change']]);
});

test('accepting every change on disk takes it, unsaved edits and all; they are in the history', async () => {
	const { session, api, page } = await opened();
	const release = api.holdSaves();
	session.editBody(`${body(SOURCE)}\n我的改动\n`);
	api.write(SOURCE.replace('第二段。', '终端改的。'));
	session.changedOnDisk(['index.md']);
	await settle(10);
	release();
	await settle(80);
	assert.equal(page.asked.length, 0);
	assert.match(session.current.source, /终端改的/u);
	assert.doesNotMatch(session.current.source, /我的改动/u);
	assert.equal(session.current.dirty, false);
	assert.ok(api.kept.some(([source, reason]) => reason === 'unsaved' && source.includes('我的改动')));
});

test('an earlier version is brought back through review; what was there is kept first', async () => {
	const { session, api, page } = await opened();
	const earlier = SOURCE.replace('第二段。', '早先的第二段。');
	await session.restoreVersion(earlier);
	assert.deepEqual(api.kept, [[SOURCE, 'before-restore']]);
	assert.equal(page.reviews.length, 1);
	assert.match(page.reviews[0], /早先的第二段/u);
	await settle();
	// Accepted: saved as an edit.
	assert.match(api.disk.source, /早先的第二段/u);

	await session.restoreVersion(api.disk.source);
	assert.equal(page.reviews.length, 1);
	assert.equal(page.toasts.at(-1), '正文和这个版本一样，没有要恢复的');
});

test('which properties changed, by their names on the page', () => {
	assert.deepEqual(changedProperties(PROPERTIES, { ...PROPERTIES, title: '新', tags: ['DFT'], draft: false }), ['标题', '标签', '状态']);
	assert.deepEqual(changedProperties(PROPERTIES, { ...PROPERTIES }), []);
	assert.deepEqual(changedProperties({ ...PROPERTIES, icon: '' }, PROPERTIES), []);
});

test('saving at once, or leaving, takes in what was just typed and not yet reported', async () => {
	const api = fakeApi();
	const page = fakeHost();
	const later = (run: () => void, ms: number) => setTimeout(run, ms).unref();
	const session = new ArticleSession(api.api, page.host, { delay: 60_000, maxWait: 60_000, retryDelay: 60_000, setTimer: later });
	await session.open('note');
	page.holdEdit(() => session.editBody(`${body(SOURCE)}\n刚打的字\n`));
	assert.equal(session.hasUnsavedEdits(), true);
	assert.equal(await session.flush(), true);
	assert.match(api.disk.source, /刚打的字/u);

	page.holdEdit(() => session.editBody(`${body(api.disk.source)}\n又打的字\n`));
	await session.open('other');
	assert.equal(api.saves.length, 2);
	assert.match(api.disk.source, /又打的字/u);
});

test('leaving an article saves it first; when that fails, the author decides', async () => {
	const api = fakeApi();
	const page = fakeHost([false]);
	// Saves only when asked; the timers left waiting do not keep the test running.
	const later = (run: () => void, ms: number) => setTimeout(run, ms).unref();
	const session = new ArticleSession(api.api, page.host, { delay: 60_000, maxWait: 60_000, retryDelay: 60_000, setTimer: later });
	await session.open('note');
	session.editBody(`${body(SOURCE)}\n第三段。\n`);
	await session.open('other');
	assert.equal(session.slug, 'other');
	assert.match(api.disk.source, /第三段。/u);
	assert.equal(page.asked.length, 0);

	session.editBody(`${body(api.disk.source)}\n第四段。\n`);
	api.failNextSave(new Error('连接断了'));
	await session.open('note');
	assert.equal(page.asked.length, 1);
	assert.equal(session.slug, 'other', 'the author chose to stay');
});

test('a moved file’s new name reaches unsaved edits as well as the disk', async () => {
	const source = SOURCE.replace('第二段。', '![图](./img/plot.png)');
	const api = fakeApi(source);
	const { session, page } = await opened(api, fakeHost());
	const release = api.holdSaves();
	session.editBody(`${body(source)}\n还没保存\n`);
	// The server renamed the file and rewrote the saved article.
	api.write(source.replace('./img/plot.png', './img/figure.png'));
	await session.fileMoved('img/plot.png', 'img/figure.png', true);
	assert.match(page.mounted.at(-1)!, /\.\/img\/figure\.png/u);
	assert.match(page.mounted.at(-1)!, /还没保存/u);
	release();
});

test('small helpers of the page', () => {
	assert.equal(articleFileUrl('note', './img/水 1.png'), '/api/studio/articles/note/files/img/%E6%B0%B4%201.png');
	assert.equal(articleFileUrl('note', 'https://x.y/a.png'), 'https://x.y/a.png');
	assert.equal(articleFileUrl('note', './ai/a.png'), './ai/a.png');
	assert.deepEqual(parseTags('量子化学， Python,,  '), ['量子化学', 'Python']);
	// Folder names the author never types: made up for a new page, read from the title when it is published.
	assert.equal(autoSlug(new Date(2026, 9, 4, 8, 5, 9)), 'note-20261004-080509');
	assert.equal(isAutoSlug('note-20261004-080509'), true);
	assert.equal(isAutoSlug('note-20261004-0805-2'), true);
	assert.equal(isAutoSlug('hartree-fock'), false);
	assert.equal(readableSlug('Hartree–Fock 学习笔记'), 'hartree-fock-xue-xi-bi-ji');
	assert.equal(readableSlug('基组的选择：6-31G*'), 'ji-zu-de-xuan-ze-6-31g');
	assert.equal(readableSlug('🧪'), '');
	assert.ok(readableSlug('很长的标题'.repeat(10)).length <= 60);
	assert.equal(freeSlug('note', ['note', 'note-2']), 'note-3');
	assert.equal(cleanSlug('My Note_1'), 'mynote1');
	const articles = [{ slug: 'hf', title: 'Hartree–Fock 方程' }, { slug: 'water', title: '水分子' }];
	assert.deepEqual(filterArticles(articles, '  HARTREE').map((article) => article.slug), ['hf']);
	assert.deepEqual(filterArticles(articles, 'wat').map((article) => article.slug), ['water']);
	assert.equal(filterArticles(articles, '').length, 2);
	assert.deepEqual(saveStateText({ kind: 'failed', message: '断了' }), { text: '断了，稍后自动重试', tone: 'error' });
});

test('an article that cannot be loaded leaves the one open as it was', async () => {
	const { session, api, page } = await opened();
	const getArticle = api.api.getArticle;
	api.api.getArticle = async (slug) => {
		if (slug === 'gone') throw new Error('文章不存在');
		return getArticle(slug);
	};
	await session.open('gone');
	assert.equal(session.slug, 'note');
	assert.equal(page.toasts.at(-1), '打不开「gone」：文章不存在');
	assert.equal(page.states.at(-1), '已载入');
});

test('when the body cannot be shown, the properties shown are still the new article’s', async () => {
	const api = fakeApi();
	const page = fakeHost();
	const session = new ArticleSession(api.api, page.host, QUICK);
	await session.open('note');
	const mount = page.host.mount;
	page.host.mount = async (article, body, again) => {
		if (article.slug === 'broken') throw new Error('插件出错');
		return mount(article, body, again);
	};
	await session.open('broken');
	assert.equal(session.slug, 'broken');
	assert.equal(page.states.at(-1), '编辑器没能显示正文：插件出错');
	// The page heard of the new article before its body failed.
	assert.equal(page.title(), '笔记');
	assert.equal(session.editProperties({ ...PROPERTIES, title: '改过' }), null);
	await settle();
	assert.match(api.disk.source, /title: "改过"/u);
});
