// The pages: made, opened, moved, published, starred; where the open one is (the bar's path, ‹ ›); its ⋯ menu.
import { Copy, FolderSearch, History, LayoutTemplate, Link, MoveHorizontal, Star, Trash2 } from 'lucide-react';
import { t } from '@blog/i18n/index.mjs';
import { articleAddress } from '@blog/markdown/articles/rules.mjs';
import { createArticle, renderTemplate, revealArticleFile, saveAsTemplate, setArticleParent, type PagePlace } from '../api/client';
import { showContextMenu } from '../common/context-menu';
import { showToast } from '../common/toast';
import { favoriteSlugs, toggleFavorite } from '../pages/favorites';
import { autoSlug, freeSlug, isAutoSlug, readableSlug } from '../pages/page-names';
import { runCommand } from '../plugin-ui';
import { pluginCommands } from '../plugins';
import { openDialog } from '../shell/dialogs/Dialogs';
import { shell as shellState } from '../shell/shell-state';
import { trackWrite } from '../state/writes';
import type { ArticleSummary } from '../types';
import type { Studio } from './studio';

/** 今天的日志: the template its pages are made from (templates/journal.md), and the page they go under. */
const JOURNAL_TEMPLATE = 'journal';
const JOURNAL_PAGE = '日志'; // i18n-ignore: a page's title, written into the blog

/** Today, `2026-10-29` (a day's page's title, when there is no 日志 template to say). */
function today(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The page open last, kept on this machine: what the Studio opens again when it is started, not the first page. */
const LAST_OPENED = 'studio.lastArticle';

function lastOpened(): string | null {
	try {
		return localStorage.getItem(LAST_OPENED);
	} catch {
		return null;
	}
}

function rememberOpened(slug: string): void {
	try {
		localStorage.setItem(LAST_OPENED, slug);
	} catch {
		// Storage refused (a private window): the first page next time.
	}
}

export function createPages(studio: Studio) {
	const { session, articleList, articleActions, properties, editorScroll } = studio;
	const slugs = () => articleList.articles().map((article) => article.slug);

	/** The pages opened, in order, for ‹ and › in the bar (as Notion's). */
	const visited = (() => {
		const opened: string[] = [];
		let at = -1;
		/** Where ‹ or › is taking the page, till it is shown. */
		let going: number | null = null;
		const tell = () => shellState.set({ nav: { back: at > 0, forward: at < opened.length - 1 } });
		return {
			shown(slug: string): void {
				rememberOpened(slug);
				if (going !== null && opened[going] === slug) at = going;
				else if (opened[at] !== slug) {
					opened.splice(at + 1, Infinity, slug);
					at = opened.length - 1;
				}
				going = null;
				tell();
			},
			/** One page back (-1) or forward (1), past those deleted since. */
			step(by: number): void {
				const exists = new Set(slugs());
				let to = at + by;
				while (opened[to] !== undefined && !exists.has(opened[to])) to += by;
				if (opened[to] === undefined) return;
				going = to;
				studio.showView('editor');
				void session.open(opened[to]);
			},
		};
	})();

	/** Reads the article list and opens one: `slug`, the one in the address, the one open last, or the first. */
	async function openFromList(slug?: string, discard = false): Promise<void> {
		const articles = await articleList.load();
		const exists = (wanted: string | null | undefined) => (wanted && articles.some((article) => article.slug === wanted) ? wanted : undefined);
		const initial = exists(slug) ?? exists(new URL(window.location.href).searchParams.get('article')) ?? exists(lastOpened()) ?? articles[0]?.slug;
		if (initial) await session.open(initial, { discard });
		else studio.topBar.showEmpty();
	}

	/**
	 * A new page, at once (as in Notion): no dialog, no folder name to think of
	 * (one is made up; it gets one read from the title when it is published);
	 * opened with its title selected, to be typed over. Under `parent` when given.
	 */
	async function newPage(parent = ''): Promise<void> {
		if (!(await session.saveBeforeLeaving())) return;
		const slug = freeSlug(autoSlug(), slugs());
		try {
			// Not named: its title to type, or not (a note may have none, as in Notion).
			await createArticle(slug, '', parent);
		} catch (error) {
			showToast(error instanceof Error ? error.message : t('新建失败'), true);
			return;
		}
		await enterNewPage(slug);
	}

	/** A new page from a template (templates/), under `parent` when given; opened, its title selected. */
	async function newFromTemplate(id: string, parent = ''): Promise<void> {
		if (!(await session.saveBeforeLeaving())) return;
		const slug = freeSlug(autoSlug(), slugs());
		try {
			const { title, body } = await renderTemplate(id);
			await trackWrite(() => createArticle(slug, title, parent, { body }));
		} catch (error) {
			showToast(error instanceof Error ? error.message : t('新建失败'), true);
			return;
		}
		await enterNewPage(slug);
	}

	/**
	 * 今天的日志 (as SiYuan's daily note): today's page under 日志, opened; made from the 日志 template (templates/journal.md)
	 * the first time today, and 日志 with it the first time of all.
	 */
	async function todayJournal(): Promise<void> {
		if (!(await session.saveBeforeLeaving())) return;
		try {
			const { title, body } = await renderTemplate(JOURNAL_TEMPLATE).catch(() => ({ title: today(), body: '' }));
			await articleList.load();
			const all = articleList.articles();
			let journal = all.find((article) => !article.parent && article.title === JOURNAL_PAGE)?.slug;
			const page = journal ? all.find((article) => article.parent === journal && article.title === title)?.slug : undefined;
			if (page) {
				studio.showView('editor');
				await session.open(page);
				return;
			}
			if (!journal) {
				journal = freeSlug(autoSlug(), slugs());
				await trackWrite(() => createArticle(journal!, JOURNAL_PAGE, ''));
			}
			const slug = freeSlug(autoSlug(), [...slugs(), journal]);
			await trackWrite(() => createArticle(slug, title, journal!, { body }));
			await articleList.load();
			studio.showView('editor');
			await session.open(slug);
		} catch (error) {
			showToast(error instanceof Error ? error.message : t('没能打开今天的日志'), true);
		}
	}

	/** 存为模板: the open page's body kept as a template (its pictures and files left out: they stay the page's). */
	async function keepAsTemplate(article: ArticleSummary): Promise<void> {
		const name = window.prompt(t('模板的名字'), article.untitled ? '' : article.title)?.trim();
		if (!name) return;
		await session.flush();
		try {
			await saveAsTemplate(article.slug, name);
			showToast(t('已存为模板「{name}」：⌘K 输入 > 新建，或在正文里 /模板', { name }));
		} catch (error) {
			showToast(error instanceof Error ? error.message : t('没能存为模板'), true);
		}
	}

	/** Opens a page just made, its title selected to be typed over; what is open saved first. */
	async function enterNewPage(slug: string): Promise<void> {
		if (!(await session.saveBeforeLeaving())) return;
		await openFromList(slug, true);
		if (session.slug === slug) properties.selectTitle();
	}

	/**
	 * 新建子页面 from `[[`: a page of this title under the open one, linked
	 * where the `[[` was; the author writes on where they were (as SiYuan's
	 * reference picker makes a document), and opens it from the toast.
	 */
	async function makeLinkedPage(title: string): Promise<{ title: string; href: string } | null> {
		const parent = session.slug;
		if (!parent) return null;
		const slug = freeSlug(autoSlug(), slugs());
		try {
			await trackWrite(() => createArticle(slug, title, parent));
		} catch (error) {
			showToast(error instanceof Error ? error.message : t('新建失败'), true);
			return null;
		}
		await articleList.load();
		showToast(t('已新建子页面「{title}」', { title }), { action: { label: t('打开'), run: () => void session.open(slug) } });
		return { title, href: `/blog/${slug}/` };
	}

	/** 页面 (/page): a page under the open one, linked where the caret is (and gone into, by the editor). */
	async function makePage(): Promise<{ slug: string; title: string; href: string } | null> {
		const parent = session.slug;
		if (!parent) return null;
		const slug = freeSlug(autoSlug(), slugs());
		try {
			await trackWrite(() => createArticle(slug, '', parent));
		} catch (error) {
			showToast(error instanceof Error ? error.message : t('新建失败'), true);
			return null;
		}
		return { slug, title: '无标题', href: `/blog/${slug}/` }; // i18n-ignore: the link written into the article
	}

	/** 转成子页面: a page under the open article, made with a section of it. */
	const subPage = {
		plan: () => (session.slug ? freeSlug(autoSlug(), slugs()) : null),
		async make(slug: string, title: string, body: string, files: string[]): Promise<boolean> {
			const parent = session.slug;
			if (!parent) return false;
			try {
				await trackWrite(() => createArticle(slug, title, parent, { body, files }));
			} catch (error) {
				showToast(error instanceof Error ? error.message : t('没能转成子页面'), true);
				return false;
			}
			await articleList.load();
			showToast(t('已转成子页面「{title}」', { title }), { action: { label: t('打开'), run: () => void session.open(slug) } });
			return true;
		},
	};

	/** The moves asked for, one after the other: each reads where the pages are once the last is over (the list read again). */
	let moving: Promise<void> = Promise.resolve();

	/**
	 * Pages (in this order) under `parent`, or at the top with it empty; with
	 * `place`, just before or after that page, one after the other. On disk, the
	 * open one too (saved first): only its properties change, which it takes in
	 * quietly.
	 */
	function movePages(moved: string[], parent: string, place: PagePlace = {}): Promise<void> {
		const done = moving.then(() => movePagesNow(moved, parent, place));
		moving = done.catch(() => {});
		return done;
	}

	async function movePagesNow(moved: string[], parent: string, place: PagePlace): Promise<void> {
		// The pages they leave and the one they go under get a page block taken out or put in (as Notion has it): the open
		// one among them, saved first, is read again after, quietly, not reviewed as a change made by someone else.
		const left = moved.map((slug) => articleList.articles().find((article) => article.slug === slug)?.parent ?? '');
		const open = session.slug ?? '';
		const changesOpen = Boolean(open) && [parent, ...left].includes(open);
		if ((moved.includes(open) || changesOpen) && !(await session.flush())) return;
		let previous: string | null = null;
		try {
			await trackWrite(async () => {
				for (const slug of moved) {
					const here: PagePlace = previous ? { after: previous } : place;
					await setArticleParent(slug, parent, here);
					// The next one after this, where it is (with no place given, each goes after those there).
					if (previous || place.before || place.after) previous = slug;
				}
				if (changesOpen && session.slug === open) await session.reload();
			});
		} catch (error) {
			showToast(error instanceof Error ? error.message : t('没能移动这个页面'), true);
		}
		await articleList.load();
		if (moved.length > 1) showToast(t('已移动 {count} 个页面', { count: moved.length }));
	}

	/** The pages the open one is under, in the bar, with their icons and its own; 常用, at the top of the left column; how many there are. */
	function showPath(): void {
		const articles = articleList.articles();
		const bySlug = new Map(articles.map((article) => [article.slug, article]));
		const pages: Array<{ slug: string; title: string; icon?: string }> = [];
		const seen = new Set<string>();
		for (let at = session.slug ? bySlug.get(session.slug)?.parent : undefined; at && !seen.has(at) && bySlug.has(at); at = bySlug.get(at)?.parent) {
			seen.add(at);
			pages.unshift({ slug: at, title: bySlug.get(at)!.title, icon: bySlug.get(at)!.icon });
		}
		const starred = favoriteSlugs();
		shellState.set({
			path: pages,
			icon: (session.slug && bySlug.get(session.slug)?.icon) || '',
			count: articles.length,
			favorite: Boolean(session.slug && starred.includes(session.slug)),
			favorites: starred.flatMap((slug) => {
				const page = bySlug.get(slug);
				return page ? [{ slug, title: page.title || slug, icon: page.icon }] : [];
			}),
		});
	}

	/** ☆: a page starred in 常用, or no longer; said so. */
	function starPage(slug: string | null): void {
		if (!slug) return;
		const starred = toggleFavorite(slug).includes(slug);
		showToast(starred ? t('已加入常用') : t('已移出常用'));
		showPath();
	}

	/**
	 * Published: saved, and, if its folder name is still one made up for a new
	 * page, given one read from its title, which is its address on the blog from
	 * now on (a published page is never renamed so, its address kept).
	 */
	async function publishAndName(): Promise<void> {
		if (!(await session.flush())) return;
		const slug = session.slug;
		const article = articleList.articles().find((entry) => entry.slug === slug);
		if (!slug || !article || article.draft !== false || article.untitled || !isAutoSlug(slug)) return;
		const wanted = readableSlug(article.title);
		if (!wanted || isAutoSlug(wanted)) return;
		const to = freeSlug(wanted, slugs());
		const renamed = await articleActions.renameTo(article, to);
		if (!renamed) return;
		const address = articleAddress(article.kind, to);
		showToast(renamed.relinked ? t('已发布，网址是 {address}，{count} 篇里指向它的链接已跟着改', { address, count: renamed.relinked }) : t('已发布，网址是 {address}', { address }));
	}

	/**
	 * After a search: the first block of the open article that holds `text`, in
	 * view and marked for a moment. The mark is laid over the block, since the
	 * editor redraws its own elements and would drop a class added to them.
	 */
	function showFound(text: string): void {
		const needle = text.toLocaleLowerCase('zh-CN');
		const blocks = editorScroll.querySelectorAll<HTMLElement>('.ProseMirror > *, .ProseMirror li, .ProseMirror td');
		// A picture's or a file's path (the 小程序 that gather the notes' things go back by it): the block showing it.
		const shownFile = () => {
			const path = text.replace(/^\.\//u, '');
			const element = [...editorScroll.querySelectorAll<HTMLElement>('.ProseMirror img[src], .ProseMirror [data-path], .ProseMirror a[href]')].find((candidate) => {
				const named = candidate.getAttribute('src') ?? candidate.dataset.path ?? candidate.getAttribute('href') ?? '';
				let decoded = named;
				try {
					decoded = decodeURIComponent(named);
				} catch {
					// Written as it is.
				}
				return decoded.split(/[?#]/u)[0].endsWith(`/${path}`) || decoded.replace(/^\.\//u, '') === path;
			});
			return element ? ([...blocks].reverse().find((candidate) => candidate.contains(element)) ?? element) : undefined;
		};
		const block = [...blocks].find((element) => element.textContent?.toLocaleLowerCase('zh-CN').includes(needle)) ?? shownFile();
		if (!block) return;
		block.scrollIntoView({ block: 'center' });
		editorScroll.querySelector('.search-flash')?.remove();
		const box = block.getBoundingClientRect();
		const frame = editorScroll.getBoundingClientRect();
		const mark = document.createElement('div');
		mark.className = 'search-flash';
		mark.style.top = `${box.top - frame.top + editorScroll.scrollTop - 2}px`;
		mark.style.left = `${box.left - frame.left + editorScroll.scrollLeft - 6}px`;
		mark.style.width = `${box.width + 12}px`;
		mark.style.height = `${box.height + 4}px`;
		editorScroll.append(mark);
		window.setTimeout(() => mark.remove(), 1700);
	}

	/** Opens an article from somewhere else on the page, at the first paragraph holding `text`. */
	async function openAt(slug: string, text = ''): Promise<void> {
		studio.showView('editor');
		await session.open(slug);
		if (text && session.slug === slug) requestAnimationFrame(() => showFound(text));
	}

	/** The open article, as the list knows it, for the actions on a whole article. */
	function openSummary(): ArticleSummary | null {
		return articleList.articles().find((article) => article.slug === session.slug) ?? null;
	}

	/** ⋯: what can be done to the page, as in Notion's page menu. */
	function showPageMenu(pageMenu: HTMLElement): void {
		const article = openSummary();
		if (!article) return;
		const address = articleAddress(article.kind, article.slug);
		const editorPanel = studio.shell.querySelector<HTMLElement>('.editor-panel')!;
		showContextMenu([
			{ label: favoriteSlugs().includes(article.slug) ? t('移出常用') : t('加入常用'), icon: Star, action: () => starPage(article.slug) },
			{
				label: properties.isWide() ? t('全宽 ✓') : t('全宽'),
				icon: MoveHorizontal,
				action: () => {
					if (properties.setWide(!properties.isWide())) editorPanel.classList.toggle('is-wide', properties.isWide());
				},
			},
			{
				label: t('复制博客链接'),
				icon: Link,
				action: () => {
					const link = new URL(address, import.meta.env.SITE ?? window.location.origin).href;
					navigator.clipboard.writeText(link).then(() => showToast(t('已复制 {link}', { link })), () => showToast(t('浏览器不允许写入剪贴板'), true));
				},
			},
			{ label: /Mac/u.test(navigator.platform) ? t('在 Finder 中显示') : t('在文件管理器中显示'), icon: FolderSearch, action: () => void revealArticleFile(article.slug, '') },
			{ label: t('历史版本…'), icon: History, action: () => openDialog('history', { slug: article.slug, host: { restore: (source) => void session.restoreVersion(source) } }) },
			{ label: t('存为模板…'), icon: LayoutTemplate, action: () => void keepAsTemplate(article) },
			// The plugins' (`ctx.commands`, `places: ['page-menu']`).
			...(pluginCommands()?.list('page-menu') ?? []).map((command) => ({ label: command.label, icon: command.icon, action: () => runCommand(command, 'page-menu') })),
			'separator',
			{ label: t('复制一份'), icon: Copy, action: () => void articleActions.duplicate(article) },
			{ label: t('移到回收站'), danger: true, icon: Trash2, action: () => void articleActions.remove(article) },
		], pageMenu);
	}

	return { visited, openFromList, newPage, newFromTemplate, todayJournal, enterNewPage, makeLinkedPage, makePage, subPage, movePages, showPath, starPage, publishAndName, openAt, showPageMenu };
}
