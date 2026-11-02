// The drive (资料库): a page in the middle, and a list in the side panel to drag files into the article from; files
// of this machine taken into the open article (the drive's, the pictures an AI shows).
import { officeKind } from '@blog/office/kinds.mjs';
import { t } from '@blog/i18n/index.mjs';
import { articleFileHead, driveInfo, importDriveFile, importPicture } from '../api/client';
import { isImage, readMarkdownReference } from '../files/article-files';
import { createDriveBrowser } from '../files/drive-browser';
import type { Studio } from './studio';

export function createDrive(studio: Studio) {
	const { shell, session, editor, articleList, sidePanel, terminal, filePanel } = studio;

	/**
	 * Markdown from an AI's answer as the open article takes it: each picture it shows from this machine (`![](/…/ai/work/
	 * plot.png)`) copied into the article's img/, its link pointed there (`./img/plot.png`); the web's and the article's
	 * own left as they are.
	 */
	async function withArticlePictures(markdown: string): Promise<string> {
		const slug = session.slug;
		if (!slug) return markdown;
		const local = [...new Set([...markdown.matchAll(/!\[[^\]]*\]\(<?([^)>\s]+)>?\)/gu)].map((match) => match[1]!))].filter((src) => !/^[a-z][a-z0-9+.-]*:/iu.test(src) || src.startsWith('file://')).filter((src) => !/^(\.\/)?(img|assets)\//u.test(src));
		if (!local.length) return markdown;
		let taken = markdown;
		try {
			for (const src of local) {
				const { path } = await importPicture(slug, decodeURI(src));
				taken = taken.split(`(${src})`).join(`(./${path})`).split(`(<${src}>)`).join(`(./${path})`);
			}
		} finally {
			void filePanel.refresh();
		}
		return taken;
	}

	/** A file of the drive copied into the open article (`img/` for a picture, else `assets/`): its path there. */
	async function copyFromDrive(path: string): Promise<string> {
		const slug = session.slug;
		if (!slug) throw new Error(t('先打开一篇文章'));
		try {
			return (await importDriveFile(slug, path, isImage(path) ? 'img' : 'assets')).path;
		} finally {
			void filePanel.refresh();
		}
	}

	const driveHost = {
		article: () => {
			const slug = session.slug;
			return slug ? { slug, title: articleList.articles().find((article) => article.slug === slug)?.title || slug } : null;
		},
		askAI(path: string) {
			sidePanel.show('terminal');
			// The words of an Office file are in the drive's text (drive-text.mjs); an AI reads the rest itself.
			const kind = officeKind(path);
			terminal.askAboutDriveFile(path, kind !== null && kind !== 'old');
		},
		async insertIntoArticle(path: string) {
			const reference = await readMarkdownReference(await copyFromDrive(path), async (copied) => (session.slug ? articleFileHead(session.slug, copied) : null));
			if (reference) editor.insertMarkdown(reference);
		},
	};
	const view = shell.querySelector<HTMLElement>('#drive-view')!;
	const page = createDriveBrowser(view, {
		...driveHost,
		changed: () => {
			void pane.refresh();
			void showDriveRoot();
		},
		navigated(folder) {
			if (shell.dataset.view !== 'drive') return;
			const url = new URL(window.location.href);
			url.searchParams.set('drive', folder);
			history.replaceState(null, '', url);
		},
	}, { mode: 'page' });
	const pane = createDriveBrowser(shell.querySelector<HTMLElement>('#side-drive')!, {
		...driveHost,
		changed: () => {
			void page.refresh();
			void showDriveRoot();
		},
	}, { mode: 'pane' });
	/** Tells the terminal where the drive is, for its 资料库 folder. */
	async function showDriveRoot(): Promise<void> {
		terminal.showDrive((await driveInfo().catch(() => null))?.root ?? null);
	}
	void showDriveRoot();
	void pane.open('');

	return { view, page, withArticlePictures, copyFromDrive };
}
