import { visit } from 'unist-util-visit';

/**
 * The widgets remark-widgets.mjs drew get the page they show, after the
 * article HTML policy: `data-widget` becomes `srcdoc`, and the frame is
 * sandboxed to scripts only, whoever wrote it.
 */
export default function rehypeWidgets() {
	return (tree) => {
		visit(tree, 'element', (node) => {
			if (node.tagName !== 'iframe' || typeof node.properties?.dataWidget !== 'string') return;
			node.properties.srcDoc = node.properties.dataWidget;
			delete node.properties.dataWidget;
			node.properties.sandbox = 'allow-scripts';
		});
	};
}
