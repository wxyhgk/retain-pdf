import { visit } from 'unist-util-visit';

import { CALLOUT_KINDS, takeCalloutMarker } from '../callouts/callouts.mjs';

/**
 * `> [!TIP]` blockquotes become callouts (`src/callouts/`): a box of their
 * kind, its icon first, then what the quote holds.
 */
export default function remarkCallouts() {
	return (tree) => {
		visit(tree, 'blockquote', (node) => {
			const kind = takeCalloutMarker(node);
			if (!kind) return;
			const { icon, label } = CALLOUT_KINDS[kind];
			node.data = { hName: 'aside', hProperties: { className: ['callout', `callout-${kind}`], role: 'note', ariaLabel: label } };
			node.children = [
				{ type: 'calloutIcon', data: { hName: 'span', hProperties: { className: ['callout-icon'], ariaHidden: 'true' }, hChildren: [{ type: 'text', value: icon }] } },
				{ type: 'calloutBody', data: { hName: 'div', hProperties: { className: ['callout-body'] } }, children: node.children },
			];
		});
	};
}
