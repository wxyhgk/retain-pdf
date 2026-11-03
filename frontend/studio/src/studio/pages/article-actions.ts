import { t } from '@blog/i18n/index.mjs';
import { articleBacklinks, commitArticle, deleteArticle, duplicateArticle, gitStatus, mergeArticle, renameArticle, restoreArticle, setArticleParent } from '../api/client.ts';
import { trackWrite } from '../state/writes.ts';
import type { ArticleSummary } from '../types.ts';
import { freeSlug } from './page-names.ts';
import { showToast } from '../common/toast.ts';
import { openDialog } from '../shell/dialogs/Dialogs';
import type { DeletePageChoice } from '../shell/dialogs/AskDialogs';
import { renameFavorite } from './favorites';

/** An article deleted just before the page went empty, to offer back once it is shown again. */
const PENDING_UNDO = 'studio-deleted-article';

/** What the article actions need from the Studio around them. */
export type ArticleActionsHost = {
	/** The article in the editor. */
	openSlug(): string | null;
	/** Before the open article goes away: saved, or its edits let go. */
	leave(): Promise<boolean>;
	/** Shows this article, the one in the editor having gone. */
	open(slug: string): Promise<void>;
	/** Reads the article list again. */
	reload(): Promise<ArticleSummary[]>;
	/** Asks git again what has not been committed. */
	refreshGit(): void;
};

function errorText(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

/** The pages under `slug`, all the way down (a loop is cut). */
function descendants(articles: ArticleSummary[], slug: string): ArticleSummary[] {
	const found: ArticleSummary[] = [];
	const seen = new Set([slug]);
	for (let index = -1, at = slug; ; ) {
		for (const page of articles) {
			if (page.parent === at && !seen.has(page.slug)) {
				seen.add(page.slug);
				found.push(page);
			}
		}
		index += 1;
		if (index >= found.length) return found;
		at = found[index]!.slug;
	}
}

/** What to do with pages to delete (shell/dialogs/AskDialogs.tsx): `all` (with the pages under them), `lift` (they go up), or `cancel`. */
function askDelete(title: string, summary: string, notes: string[], deleteLabel: string, canLift: boolean): Promise<DeletePageChoice> {
	return new Promise((done) => openDialog('deletePage', { title, summary, notes, deleteLabel, canLift, done }));
}

/** What to ask before deleting one page: what goes with it, what links to it. */
function askDeletePage(article: ArticleSummary, under: ArticleSummary[], linking: string[]): Promise<DeletePageChoice> {
	const notes = [
		...(article.draft === false ? [t('这篇已经发布，下次部署后网页会消失。')] : []),
		...(linking.length ? [t('有 {count} 篇链接到它：{titles}，删除后这些链接会失效。', { count: linking.length, titles: `${linking.slice(0, 5).map((title) => `「${title}」`).join('')}${linking.length > 5 ? '…' : ''}` })] : []),
		t('删除后可以撤销；回收站（项目的 .studio-trash/）里保留 30 天。'),
	];
	return askDelete(
		t('删除「{title}」', { title: article.title }),
		under.length ? t('它下面有 {count} 个页面', { count: under.length }) : t('移到回收站'),
		notes,
		under.length ? t('连同下面 {count} 个页面一起删除', { count: under.length }) : t('删除'),
		under.length > 0,
	);
}


/** Renaming, copying and deleting whole articles, from the article list. */
export function createArticleActions(host: ArticleActionsHost) {
	async function restore(trashed: string, title: string): Promise<void> {
		try {
			const { slug } = await trackWrite(() => restoreArticle(trashed));
			await host.reload();
			await host.open(slug);
			showToast(t('已恢复「{title}」', { title }));
		} catch (error) {
			showToast(errorText(error, t('恢复失败')), true);
		}
	}

	/** Brings back what one deletion took, the page first, then those under it. */
	async function restoreAll(trashed: string[], title: string): Promise<void> {
		const [first, ...rest] = trashed;
		if (!first) return;
		try {
			for (const entry of rest) await trackWrite(() => restoreArticle(entry));
		} catch (error) {
			showToast(errorText(error, t('恢复失败')), true);
		}
		await restore(first, title);
	}

	return {
		/**
		 * Gives the article the folder name `to` (free, checked), reopening it if
		 * it is open; the links to it are made to follow. How many articles had
		 * links changed; null when it was not renamed.
		 */
		async renameTo(article: ArticleSummary, to: string): Promise<{ relinked: number } | null> {
			const open = host.openSlug() === article.slug;
			if (open && !(await host.leave())) return null;
			let relinked = 0;
			try {
				({ relinked = 0 } = await trackWrite(() => renameArticle(article.slug, to)));
			} catch (error) {
				showToast(errorText(error, t('改名失败')), true);
				return null;
			}
			// Still starred (常用), by its new name.
			renameFavorite(article.slug, to);
			await host.reload();
			if (open) await host.open(to);
			return { relinked };
		},

		/** 复制一份: a draft of it, its folder named for it (not asked: folder names are not the author's to manage). */
		async duplicate(article: ArticleSummary): Promise<void> {
			const to = freeSlug(`${article.slug}-copy`, (await host.reload()).map((page) => page.slug));
			if (host.openSlug() === article.slug && !(await host.leave())) return;
			try {
				await trackWrite(() => duplicateArticle(article.slug, to));
			} catch (error) {
				showToast(errorText(error, t('复制失败')), true);
				return;
			}
			await host.reload();
			await host.open(to);
			showToast(t('已复制为草稿 {to}', { to }));
		},

		/**
		 * To the trash, after asking. A page with pages under it (as SiYuan
		 * asks): with them all, or alone, those under it put under the page it
		 * was under. The pages that link to it are named first. One 撤销 brings
		 * back all that went.
		 */
		async remove(article: ArticleSummary): Promise<void> {
			const all = await host.reload();
			const under = descendants(all, article.slug);
			const going = new Set([article.slug, ...under.map((page) => page.slug)]);
			const linking = (await articleBacklinks(article.slug).catch(() => [])).filter((link) => !going.has(link.slug));
			const choice = await askDeletePage(article, under, linking.map((link) => link.title));
			if (choice === 'cancel') return;
			const removed = choice === 'all' ? [article, ...under] : [article];
			const open = removed.some((page) => page.slug === host.openSlug());
			if (open && !(await host.leave())) return;
			const trashed: string[] = [];
			try {
				if (choice === 'lift') {
					for (const child of all.filter((page) => page.parent === article.slug)) {
						await trackWrite(() => setArticleParent(child.slug, article.parent ?? ''));
					}
				}
				// The pages under it first: the last to go is the first back.
				for (const page of [...removed].reverse()) trashed.push((await trackWrite(() => deleteArticle(page.slug))).trashed);
			} catch (error) {
				showToast(errorText(error, t('删除失败')), true);
				await host.reload();
				return;
			}
			const articles = await host.reload();
			if (open && !articles.length) {
				// Nothing left to show: the Studio starts again, empty, and offers it back then.
				try {
					sessionStorage.setItem(PENDING_UNDO, JSON.stringify({ trashed: trashed.at(-1), title: article.title }));
				} catch {
					// Without storage it stays in the trash, to be fetched from there.
				}
				window.location.assign('/studio');
				return;
			}
			if (open) await host.open(articles[0].slug);
			const said = removed.length > 1 ? t('已删除「{title}」和下面 {count} 个页面', { title: article.title, count: removed.length - 1 }) : t('已删除「{title}」', { title: article.title });
			showToast(said, { action: { label: t('撤销'), run: () => void restoreAll([...trashed].reverse(), article.title) } });
		},

		/** Several pages to the trash, after asking, each with the pages under it; one 撤销 brings back all. */
		async removeMany(pages: ArticleSummary[]): Promise<void> {
			if (pages.length === 1) return this.remove(pages[0]!);
			const all = await host.reload();
			const removed = new Map<string, ArticleSummary>();
			for (const page of pages) for (const one of [page, ...descendants(all, page.slug)]) removed.set(one.slug, one);
			const under = removed.size - pages.length;
			const choice = await askDelete(
				t('删除 {count} 个页面', { count: pages.length }),
				under ? t('连同它们下面的 {count} 个页面', { count: under }) : pages.map((page) => `「${page.title}」`).join(''),
				[...(pages.some((page) => page.draft === false) ? [t('其中有已经发布的，下次部署后网页会消失。')] : []), t('删除后可以撤销；回收站（项目的 .studio-trash/）里保留 30 天。')],
				t('删除'),
				false,
			);
			if (choice !== 'all') return;
			const open = removed.has(host.openSlug() ?? '');
			if (open && !(await host.leave())) return;
			const trashed: string[] = [];
			try {
				for (const page of [...removed.values()].reverse()) trashed.push((await trackWrite(() => deleteArticle(page.slug))).trashed);
			} catch (error) {
				showToast(errorText(error, t('删除失败')), true);
			}
			const articles = await host.reload();
			if (open && articles.length) await host.open(articles[0]!.slug);
			else if (open) {
				window.location.assign('/studio');
				return;
			}
			showToast(t('已删除 {count} 个页面', { count: removed.size }), { action: { label: t('撤销'), run: () => void restoreAll([...trashed].reverse(), pages[0]!.title) } });
		},

		/**
		 * 并入上级页面 (the way back from 转成子页面): its text a section of the
		 * page it is under, which is then opened; itself to the trash.
		 */
		async merge(article: ArticleSummary): Promise<void> {
			const all = await host.reload();
			const parent = all.find((page) => page.slug === article.parent);
			if (!parent) return;
			if (!window.confirm(t('把「{title}」并入「{parent}」，作为其中一节？\n它下面的页面会挂到「{parent}」下面，它自己移到回收站；「{parent}」改动前的版本存进历史版本。', { title: article.title, parent: parent.title }))) return;
			const open = host.openSlug();
			if ((open === article.slug || open === parent.slug) && !(await host.leave())) return;
			try {
				// Opened again inside the write: the change on disk is the Studio's, not one to review.
				await trackWrite(async () => {
					await mergeArticle(article.slug);
					await host.reload();
					await host.open(parent.slug);
				});
			} catch (error) {
				showToast(errorText(error, t('并入失败')), true);
				return;
			}
			showToast(t('已把「{title}」并入「{parent}」', { title: article.title, parent: parent.title }));
		},

		/** Commits the article to git, saved first; pushing stays the author's. */
		async commit(article: ArticleSummary): Promise<void> {
			if (host.openSlug() === article.slug && !(await host.leave())) return;
			let vanished: string[];
			try {
				({ vanished } = await gitStatus());
			} catch (error) {
				showToast(errorText(error, t('读不到 git 状态')), true);
				return;
			}
			const asked = vanished.length
				? t('把「{title}」提交到 git，提交说明：\n会一起提交改名或删除后不在了的页面文件夹：{folders}', { title: article.title, folders: vanished.map((name) => `blog/${name}/`).join('、') })
				: t('把「{title}」提交到 git，提交说明：', { title: article.title });
			const message = window.prompt(asked, `content: ${article.title}`);
			if (message === null || !message.trim()) return;
			try {
				const { commit } = await commitArticle(article.slug, message);
				showToast(t('已提交 {commit}；推送到网站请在终端里运行 git push', { commit }));
			} catch (error) {
				showToast(errorText(error, t('提交失败')), true);
			}
			host.refreshGit();
		},

		/** After the Studio started again for want of articles: offers back the one deleted. */
		offerPendingUndo(): void {
			let pending: { trashed: string; title: string } | null = null;
			try {
				const stored = sessionStorage.getItem(PENDING_UNDO);
				sessionStorage.removeItem(PENDING_UNDO);
				pending = stored ? JSON.parse(stored) : null;
			} catch {
				pending = null;
			}
			if (!pending || typeof pending.trashed !== 'string') return;
			const { trashed, title } = pending;
			showToast(t('已删除「{title}」', { title }), { action: { label: t('撤销'), run: () => void restore(trashed, title) } });
		},
	};
}
