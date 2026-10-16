import { commitArticle, deleteArticle, duplicateArticle, gitStatus, renameArticle, restoreArticle } from '../api/client.ts';
import { trackWrite } from '../state/writes.ts';
import type { ArticleSummary } from '../types.ts';
import { cleanSlug } from './new-article-dialog.ts';
import { showToast } from './toast.ts';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
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

/** A free folder name near `wanted`: `note-copy`, `note-copy-2`, … */
function freeSlug(wanted: string, taken: ArticleSummary[]): string {
	const names = new Set(taken.map((article) => article.slug));
	if (!names.has(wanted)) return wanted;
	let number = 2;
	while (names.has(`${wanted}-${number}`)) number += 1;
	return `${wanted}-${number}`;
}

/** A folder name typed by the author, made acceptable; null when given up or unusable. */
function askSlug(message: string, suggested: string): string | null {
	const typed = window.prompt(message, suggested);
	if (typed === null) return null;
	const slug = cleanSlug(typed.trim()).replace(/^-+|-+$/gu, '').replace(/-{2,}/gu, '-');
	if (!SLUG.test(slug)) {
		showToast('文件夹名只能用小写字母、数字和连字符', true);
		return null;
	}
	return slug;
}

/** Renaming, copying and deleting whole articles, from the article list. */
export function createArticleActions(host: ArticleActionsHost) {
	async function restore(trashed: string, title: string): Promise<void> {
		try {
			const { slug } = await trackWrite(() => restoreArticle(trashed));
			await host.reload();
			await host.open(slug);
			showToast(`已恢复「${title}」`);
		} catch (error) {
			showToast(errorText(error, '恢复失败'), true);
		}
	}

	return {
		async rename(article: ArticleSummary): Promise<void> {
			const published = article.draft === false;
			const to = askSlug(
				`「${article.title}」的新文件夹名，也是它在博客上的网址 /blog/<文件夹名>/${published ? '\n这篇已经发布，改名后旧网址会失效。' : ''}`,
				article.slug,
			);
			if (!to || to === article.slug) return;
			const open = host.openSlug() === article.slug;
			if (open && !(await host.leave())) return;
			try {
				await trackWrite(() => renameArticle(article.slug, to));
			} catch (error) {
				showToast(errorText(error, '改名失败'), true);
				return;
			}
			await host.reload();
			if (open) await host.open(to);
			showToast(`文件夹已改为 ${to}`);
		},

		async duplicate(article: ArticleSummary): Promise<void> {
			const to = askSlug(`复制「${article.title}」，新文章的文件夹名：`, freeSlug(`${article.slug}-copy`, await host.reload()));
			if (!to) return;
			if (host.openSlug() === article.slug && !(await host.leave())) return;
			try {
				await trackWrite(() => duplicateArticle(article.slug, to));
			} catch (error) {
				showToast(errorText(error, '复制失败'), true);
				return;
			}
			await host.reload();
			await host.open(to);
			showToast(`已复制为草稿 ${to}`);
		},

		async remove(article: ArticleSummary): Promise<void> {
			const published = article.draft === false;
			const question = `把「${article.title}」整篇文章移到回收站？\n`
				+ (published ? '这篇已经发布，下次部署后网页会消失。\n' : '')
				+ '删除后可以撤销；回收站（项目的 .studio-trash/）里保留 30 天。';
			if (!window.confirm(question)) return;
			const open = host.openSlug() === article.slug;
			if (open && !(await host.leave())) return;
			let trashed: string;
			try {
				({ trashed } = await trackWrite(() => deleteArticle(article.slug)));
			} catch (error) {
				showToast(errorText(error, '删除失败'), true);
				return;
			}
			const articles = await host.reload();
			if (open && !articles.length) {
				// Nothing left to show: the Studio starts again, empty, and offers it back then.
				try {
					sessionStorage.setItem(PENDING_UNDO, JSON.stringify({ trashed, title: article.title }));
				} catch {
					// Without storage it stays in the trash, to be fetched from there.
				}
				window.location.assign('/studio');
				return;
			}
			if (open) await host.open(articles[0].slug);
			showToast(`已删除「${article.title}」`, { action: { label: '撤销', run: () => void restore(trashed, article.title) } });
		},

		/** Commits the article to git, saved first; pushing stays the author's. */
		async commit(article: ArticleSummary): Promise<void> {
			if (host.openSlug() === article.slug && !(await host.leave())) return;
			let vanished: string[];
			try {
				({ vanished } = await gitStatus());
			} catch (error) {
				showToast(errorText(error, '读不到 git 状态'), true);
				return;
			}
			const also = vanished.length
				? `\n会一起提交改名或删除后不在了的文章文件夹：${vanished.map((name) => `blog/${name}/`).join('、')}`
				: '';
			const message = window.prompt(`把「${article.title}」提交到 git，提交说明：${also}`, `content: ${article.title}`);
			if (message === null || !message.trim()) return;
			try {
				const { commit } = await commitArticle(article.slug, message);
				showToast(`已提交 ${commit}；推送到网站请在终端里运行 git push`);
			} catch (error) {
				showToast(errorText(error, '提交失败'), true);
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
			showToast(`已删除「${title}」`, { action: { label: '撤销', run: () => void restore(trashed, title) } });
		},
	};
}
