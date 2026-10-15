import assert from 'node:assert/strict';
import test from 'node:test';

import { articleFileUrl } from '../src/studio/api/client.ts';
import { ArticleSession, type SaveState, type SessionApi, type SessionHost } from '../src/studio/state/article-session.ts';
import type { ArticlePayload, ArticleProperties } from '../src/studio/types.ts';
import { filterArticles } from '../src/studio/workspace/article-list.ts';
import { cleanSlug, suggestedSlug } from '../src/studio/workspace/new-article-dialog.ts';
import { parseTags } from '../src/studio/workspace/properties-panel.ts';
import { saveStateText } from '../src/studio/workspace/top-bar.ts';

const SOURCE = "---\ntitle: '笔记'\ndescription: ''\npubDate: '2026-10-14'\ntags: []\ndraft: true\n---\n\n第一段  \n用了 *星号*。\n\n第二段。\n";
const PROPERTIES: ArticleProperties = { title: '笔记', description: '', pubDate: '2026-10-14', tags: [], draft: true };

class Conflict extends Error {}

/** The server: articles on a disk the test can change, and saves it can hold back or fail. */
function fakeApi(source = SOURCE) {
	const disk = { source, revision: 'r1' };
	let revisions = 1;
	const saves: string[] = [];
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
	};
	return {
		api,
		disk,
		saves,
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
	return { host, states, asked, toasts, mounted, reviews, saved, roundtrip: () => roundtrip, title: () => title };
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

test('a save that meets a change on disk asks once; keeping the edits saves them over it', async () => {
	const { session, api, page } = await opened(fakeApi(), fakeHost([false]));
	const release = api.holdSaves();
	session.editBody(`${body(SOURCE)}\n我的改动\n`);
	await settle(10);
	api.write(SOURCE.replace('第二段。', '终端改的。'));
	release();
	await settle(80);
	assert.equal(page.asked.length, 1);
	assert.match(page.asked[0], /在磁盘上被修改了/u);
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
	assert.ok(page.states.includes('磁盘上的改动待审阅'));
	assert.equal(page.states.at(-1), '已保存');
	assert.equal(api.saves.length, 0);
	assert.equal(session.current.source, api.disk.source);
	assert.equal(session.current.dirty, false);
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

test('a change to the properties alone is taken without review', async () => {
	const { session, api, page } = await opened();
	api.write(SOURCE.replace("title: '笔记'", "title: '新题目'"));
	session.changedOnDisk(['index.md']);
	await settle();
	assert.equal(page.reviews.length, 0);
	assert.equal(page.mounted.length, 1);
	assert.equal(session.current.source, api.disk.source);
	assert.deepEqual(page.toasts, ['文章属性在磁盘上被修改，已更新']);
});

test('taking the disk version drops the unsaved edits', async () => {
	const { session, api, page } = await opened(fakeApi(), fakeHost([true]));
	const release = api.holdSaves();
	session.editBody(`${body(SOURCE)}\n我的改动\n`);
	api.write(SOURCE.replace('第二段。', '终端改的。'));
	session.changedOnDisk(['index.md']);
	await settle(10);
	release();
	await settle(80);
	assert.equal(page.asked.length, 1);
	assert.match(session.current.source, /终端改的/u);
	assert.doesNotMatch(session.current.source, /我的改动/u);
	assert.equal(session.current.dirty, false);
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
	assert.equal(suggestedSlug('Hartree–Fock 学习笔记'), 'hartree-fock');
	assert.equal(suggestedSlug('水分子', new Date(2026, 9, 4, 8, 5)), 'note-20261004-0805');
	assert.equal(cleanSlug('My Note_1'), 'mynote1');
	const articles = [{ slug: 'hf', title: 'Hartree–Fock 方程' }, { slug: 'water', title: '水分子' }];
	assert.deepEqual(filterArticles(articles, '  HARTREE').map((article) => article.slug), ['hf']);
	assert.deepEqual(filterArticles(articles, 'wat').map((article) => article.slug), ['water']);
	assert.equal(filterArticles(articles, '').length, 2);
	assert.deepEqual(saveStateText({ kind: 'failed', message: '断了' }), { text: '断了，稍后自动重试', tone: 'error' });
});
