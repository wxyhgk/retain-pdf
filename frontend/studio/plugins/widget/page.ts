import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/page.ts';

import { connectWidgets, setWidgetFiles } from './widget-host.ts';
import './widgets.css';

/**
 * The blog's pages: the frames build.mjs drew are told the theme and grow to
 * their height (widget-host.ts); what a widget asks of the article's files
 * (`note.file()`) is fetched from where the article publishes them.
 */
export const name = 'page-widget';
export const inject = ['page'];

export function apply(ctx: Context): void {
	setWidgetFiles((path) => ctx.page.fileUrl(path));
	ctx.on('page/ready', () => connectWidgets());
}
