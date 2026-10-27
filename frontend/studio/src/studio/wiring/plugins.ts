// The project's plugins (plugins/*/studio.ts: the calculation block, RetainMol…), given the article open, its files and
// their API; told when its file changes; put in again when one is edited.
import { t } from '@blog/i18n/index.mjs';
import { studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { listPlugins, pluginApi, uploadArticleFile } from '../api/client';
import { showToast } from '../common/toast';
import { setFileBlocks } from '../files/article-files';
import { showPluginUi } from '../plugin-ui';
import { blockForFile, fileHeadWanted, startStudioPlugins, studioPlugins } from '../plugins';
import type { ArticlePayload } from '../types';
import type { Studio } from './studio';

/** `shown`: the article the editor shows, or is about to (the plugins' `ctx.studio.shown()`). */
export function startPlugins(studio: Studio, { shown }: { shown(): ArticlePayload | null }): void {
	const { shell, session, editor, sidePanel } = studio;

	// Those turned off (插件) are left out; if the list cannot be read, all are put in.
	void listPlugins()
		.then(
			(plugins) => ({ off: plugins.filter((plugin) => !plugin.enabled).map((plugin) => plugin.id), present: plugins.filter((plugin) => plugin.entries.includes('studio.ts')).map((plugin) => plugin.id) }),
			() => ({ off: [], present: [] }),
		)
		.then(({ off, present }) => startStudioPlugins({
			slug: () => session.slug,
			fileUrl: studioFileUrl,
			save: () => void session.flush(),
			article: () => (session.slug ? { slug: session.slug, title: studio.title() || session.slug } : null),
			source() {
				if (!session.slug) return null;
				editor.settle();
				return session.current.source;
			},
			editor: {
				view: () => editor.view(),
				insert: (markdown) => editor.insertMarkdown(markdown),
				insertText(text) {
					const view = editor.view();
					if (!view) return;
					view.dispatch(view.state.tr.insertText(text).scrollIntoView());
					view.focus();
				},
			},
			upload: (slug, folder, file, options) => uploadArticleFile(slug, folder, file, options),
			toast: (message, error = false) => showToast(message, error),
			showPanel: (key) => sidePanel.show(key),
			shown: () => shown()?.slug ?? null,
			views: {
				get: () => shown()?.chemistryViews ?? {},
				save: (key, entry) => {
					const { format, view, display } = entry as { format: string; view: number[]; display?: unknown };
					return session.saveView(key, format, view, display);
				},
			},
			api: pluginApi,
		}, off, present))
		.then((problems) => {
			// Their tabs in the right column, their commands in the left one and on their keys.
			showPluginUi({ setPanels: (panels) => sidePanel.setPanels(panels), sidebar: shell.querySelector<HTMLElement>('#plugin-commands')! });
			if (problems.length) showToast(problems.join('；'), true);
		});
	// A file of the article a plugin's block shows (a structure file) is put in as that block, and marked in the file list.
	setFileBlocks(blockForFile, fileHeadWanted);

	// They are told the article's file changed (`studio/source-changed`), a moment after the last change.
	let told = { slug: '', source: '' };
	let timer = 0;
	session.subscribe(({ article, source }) => {
		window.clearTimeout(timer);
		if (!article || (article.slug === told.slug && source === told.source)) return;
		timer = window.setTimeout(() => {
			told = { slug: article.slug, source };
			studioPlugins.emit('studio/source-changed', article.slug, source);
		}, 250);
	});

	// A plugin edited (by hand or by an AI in the terminal) is put in again at once: said here; the article drawn again if its blocks changed.
	studioPlugins.on('studio/plugins-reloaded', (changed, problems) => {
		showToast(problems.length ? problems.join('；') : t('已重新载入插件：{plugins}', { plugins: changed.join('、') }), problems.length > 0);
	});
	studioPlugins.on('studio/editor-changed', () => void session.remount());
}
