import { t } from '@blog/i18n/index.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type { StudioBlock } from '@blog/kernel/studio.ts';

import { WIDGET_LANGUAGE } from './widgets.mjs';
import { setWidgetFiles, showWidgetErrors, widgetFilesChanged } from './widget-host.ts';
import { insertWidget, observeWidgets, widgetLanguageDescription, widgetPreview } from './widget-block.ts';
import widgetCss from './widgets.css?raw';

const ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14l-2 2 2 2M16 14l2 2-2 2"/></svg>';

/**
 * The Studio: ```widget blocks are code blocks whose HTML is edited as HTML
 * and previewed as the frame the blog shows (widget-block.ts), redrawn as
 * they change and when a file of the article they read changes; in the slash
 * menu as 交互模块.
 */
export const name = 'block-widget';
export const description = t('交互模块（```widget）：一小段 HTML（滑块、画布、脚本）在沙盒框里运行，博客和 Studio 里一样；大的可以是文章里的一个文件（@file ./assets/….html）。');
export const inject = ['studio', 'blocks', 'styles'];

export function apply(ctx: Context): void {
	ctx.styles.add(widgetCss);
	ctx.effect(() => {
		setWidgetFiles((path) => {
			const slug = ctx.studio.shown();
			return slug ? ctx.studio.fileUrl(slug, path) : path;
		});
		return () => setWidgetFiles(null);
	}, 'widget files');
	// What goes wrong in a widget said under it, for the author to see (and tell the AI of).
	ctx.effect(() => {
		showWidgetErrors(true);
		return () => showWidgetErrors(false);
	}, 'widget errors');
	ctx.on('studio/files-changed', (_slug, paths) => widgetFilesChanged(paths));
	ctx.blocks.register({
		name,
		fence: WIDGET_LANGUAGE,
		codeBlock: { languages: [widgetLanguageDescription], preview: widgetPreview },
		observe: observeWidgets,
		menu: {
			key: 'widget',
			label: t('交互模块'),
			description: t('能动的小页面：滑块、画图'),
			hint: '```widget',
			icon: ICON,
			keywords: ['widget', 'html', 'interactive', 'embed', 'demo'],
			insert: insertWidget,
		},
	} satisfies StudioBlock);
}
