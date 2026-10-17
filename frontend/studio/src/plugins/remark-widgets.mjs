import { visit } from 'unist-util-visit';

import { DEFAULT_WIDGET_HEIGHT, WIDGET_LANGUAGE, unpinnedScripts, widgetDocument, widgetOptions } from '../widgets/widgets.mjs';

/**
 * ```widget fences become their frame (widgets.mjs): a figure with a
 * sandboxed iframe, and the fence's title under it. The page the frame
 * shows waits in `data-widget` until rehype-widgets.mjs makes it the
 * frame's `srcdoc`: the article HTML policy, which runs between, takes
 * `srcdoc` from any frame, so a frame written by hand stays without one.
 *
 * A script loaded from elsewhere without a version is reported (ruleId
 * `widget-script`), for the check before publishing.
 */
export default function remarkWidgets() {
	return (tree, file) => {
		visit(tree, 'code', (node, index, parent) => {
			if (!parent || index === undefined || String(node.lang ?? '').toLowerCase() !== WIDGET_LANGUAGE) return;
			const { title, height } = widgetOptions(node.meta);
			for (const url of unpinnedScripts(node.value)) {
				file.message(`交互模块加载的 ${url} 没写版本号，以后它一变，模块可能就打不开了`, {
					place: node.position,
					ruleId: 'widget-script',
					source: 'remark-widgets',
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
					dataWidget: widgetDocument(node.value),
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
