import { parseQcOutput } from '@blog/compute/parsers/qc/qc.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/page.ts';

import { openQcSheet, paintPicture } from './qc-sheet.ts';
import './qc.css';

/**
 * The blog's pages: each card build.mjs drew gets its structure's picture,
 * and opens its sheet on a click, the published output read for it.
 */
export const name = 'page-qc';
export const inject = ['page'];

export function apply(ctx: Context): void {
	ctx.on('page/ready', () => {
		for (const card of document.querySelectorAll<HTMLElement>('figure.note-qc')) {
			paintPicture(card);
			const path = card.dataset.file;
			if (!path) continue;
			const title = card.querySelector('.job-card-title')?.textContent ?? '计算结果'; // i18n-ignore: the blog's page
			const url = ctx.page.fileUrl(path);
			const open = async () => {
				let text: string | null = null;
				try {
					const response = await fetch(url);
					text = response.ok ? await response.text() : null;
				} catch {
					text = null;
				}
				const result = text === null ? null : parseQcOutput(text);
				openQcSheet({ title, result, text, url, name: path.replace(/^.*\//u, ''), problem: text === null ? `读不到 ${path}` : '认不出是 Gaussian 或 ORCA 的输出' }); // i18n-ignore: the blog's page
			};
			card.tabIndex = 0;
			card.setAttribute('role', 'button');
			card.setAttribute('aria-label', `${title}：打开结果`); // i18n-ignore: the blog's page
			card.classList.add('is-openable');
			card.addEventListener('click', () => void open());
			card.addEventListener('keydown', (event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					void open();
				}
			});
		}
	});
}
