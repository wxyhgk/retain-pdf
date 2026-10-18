import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { visit } from 'unist-util-visit';

import {
	DEFAULT_WIDGET_HEIGHT,
	WIDGET_LANGUAGE,
	publicArticlePath,
	unpinnedScripts,
	widgetDocument,
	widgetFile,
	widgetOptions,
	widgetReads,
} from '../widgets/widgets.mjs';

/**
 * ```widget fences become their frame (widgets.mjs): a figure with a
 * sandboxed iframe, and the fence's title under it. The page the frame
 * shows waits in `data-widget` until rehype-widgets.mjs makes it the
 * frame's `srcdoc`: the article HTML policy, which runs between, takes
 * `srcdoc` from any frame, so a frame written by hand stays without one.
 *
 * A widget that is a file of the article (`@file ./assets/….html`) is read
 * here, at build time. Reported for the check before publishing: a script
 * loaded from elsewhere without a version (ruleId `widget-script`), and a
 * file `note.file()` names that is not published with the article
 * (`widget-file`). A widget file that is not there is reported with the
 * article's other missing files (`missing-file`).
 */
export default function remarkWidgets() {
	return (tree, file) => {
		const article = file.path ? dirname(file.path) : null;
		/** Where a published file of the article is; null when it is not there. */
		const locate = (path) => {
			const published = publicArticlePath(path);
			if (!article || !published) return null;
			const target = join(article, ...published.split('/'));
			return existsSync(target) && statSync(target).isFile() ? target : null;
		};
		const read = (path) => {
			const target = locate(path);
			return target ? readFileSync(target, 'utf8') : null;
		};
		visit(tree, 'code', (node, index, parent) => {
			if (!parent || index === undefined || String(node.lang ?? '').toLowerCase() !== WIDGET_LANGUAGE) return;
			const { title, height } = widgetOptions(node.meta);
			const place = { place: node.position, source: 'remark-widgets' };
			const named = widgetFile(node.value);
			let source = node.value;
			if (named) {
				source = read(named);
				if (source === null) {
					file.message(`找不到交互模块文件 ./${named}`, { ...place, ruleId: 'missing-file' });
					source = `<p style="color: var(--muted)">找不到交互模块文件 ./${named.replace(/[<&]/gu, '')}</p>`;
				}
			}
			for (const wanted of widgetReads(source)) {
				const published = publicArticlePath(wanted);
				if (!published) {
					file.message(`交互模块读的 ${wanted} 不在文章的 img/ 或 assets/ 里，发布后读不到`, { ...place, ruleId: 'widget-file' });
				} else if (article && !locate(published)) {
					file.message(`交互模块读的 ./${published} 不存在`, { ...place, ruleId: 'widget-file' });
				}
			}
			for (const url of unpinnedScripts(source)) {
				file.message(`交互模块加载的 ${url} 没写版本号，以后它一变，模块可能就打不开了`, {
					...place,
					ruleId: 'widget-script',
				});
			}
			const frame = {
				type: 'element',
				tagName: 'iframe',
				properties: {
					className: ['note-widget-frame'],
					sandbox: 'allow-scripts',
					loading: 'lazy',
					title: title || '交互模块',
					style: `height:${height || DEFAULT_WIDGET_HEIGHT}px`,
					dataWidget: widgetDocument(source),
				},
				children: [],
			};
			const caption = title ? [{ type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: title }] }] : [];
			parent.children[index] = {
				type: 'widget',
				data: { hName: 'figure', hProperties: { className: ['note-widget'] }, hChildren: [frame, ...caption] },
			};
		});
	};
}
