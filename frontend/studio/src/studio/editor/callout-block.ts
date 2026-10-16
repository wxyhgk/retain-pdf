import type { MilkdownPlugin } from '@milkdown/ctx';
import { Plugin } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $nodeSchema, $prose, $remark } from '@milkdown/utils';

import { CALLOUT_KINDS, CALLOUT_ORDER, takeCalloutMarker, type CalloutKind } from '../../callouts/callouts.mjs';
import '../../callouts/callouts.css';

/**
 * Callouts as the blog shows them (`src/callouts/`): `> [!TIP]` opens as a
 * tinted box with its icon, which a click turns to the next kind, and is
 * written back the same way.
 */

export const CALLOUT_TYPE = 'callout';

type MdastNode = { type: string; kind?: CalloutKind; value?: string; children?: MdastNode[] };
type RemarkPlugin = ReturnType<Parameters<typeof $remark>[1]>;
/** What mdast-util-to-markdown hands a handler: as much of it as is used here. */
type MarkdownState = {
	enter(name: string): () => void;
	createTracker(info: unknown): { move(text: string): void; shift(count: number): void; current(): unknown };
	containerFlow(node: unknown, info: unknown): string;
	indentLines(value: string, map: (line: string, index: number, blank: boolean) => string): string;
};

function callouts(node: MdastNode): void {
	node.children?.forEach((child) => {
		if (child.type === 'blockquote') {
			const kind = takeCalloutMarker(child as Parameters<typeof takeCalloutMarker>[0]);
			if (kind) {
				child.type = 'callout';
				child.kind = kind;
			}
		}
		callouts(child);
	});
}

/** `> [!TIP]` on its own line, then the callout's blocks, each line quoted. */
function writeCallout(node: MdastNode, _parent: unknown, state: MarkdownState, info: unknown): string {
	const exit = state.enter('blockquote');
	const tracker = state.createTracker(info);
	tracker.move('> ');
	tracker.shift(2);
	const value = state.containerFlow(node, tracker.current());
	exit();
	const marker = `[!${(node.kind ?? 'note').toUpperCase()}]`;
	return state.indentLines(value ? `${marker}\n${value}` : marker, (line, _index, blank) => `>${blank ? '' : ' '}${line}`);
}

export const calloutRemark = $remark('article-callouts', () => function (this: { data(): Record<string, unknown> }) {
	const data = this.data();
	const extensions = (data.toMarkdownExtensions ??= []) as unknown[];
	extensions.push({ handlers: { callout: writeCallout } });
	return callouts;
} as unknown as RemarkPlugin);

export const calloutSchema = $nodeSchema(CALLOUT_TYPE, () => ({
	group: 'block',
	content: 'block+',
	defining: true,
	attrs: { kind: { default: 'note' } },
	parseDOM: [
		{
			tag: 'aside.callout',
			contentElement: '.callout-body',
			getAttrs: (dom) => ({ kind: (dom as HTMLElement).dataset.kind ?? 'note' }),
		},
	],
	toDOM: (node) => {
		const kind = (node.attrs.kind in CALLOUT_KINDS ? node.attrs.kind : 'note') as CalloutKind;
		const { icon, label } = CALLOUT_KINDS[kind];
		return [
			'aside',
			{ class: `callout callout-${kind}`, 'data-kind': kind },
			['span', { class: 'callout-icon', contenteditable: 'false', title: `${label}：点击换一种` }, icon],
			['div', { class: 'callout-body' }, 0],
		];
	},
	parseMarkdown: {
		match: (node) => node.type === 'callout',
		runner: (state, node, type) => {
			state.openNode(type, { kind: (node as MdastNode).kind ?? 'note' });
			state.next(node.children);
			state.closeNode();
		},
	},
	toMarkdown: {
		match: (node) => node.type.name === CALLOUT_TYPE,
		runner: (state, node) => {
			state.openNode('callout', undefined, { kind: node.attrs.kind });
			state.next(node.content);
			state.closeNode();
		},
	},
}));

/** A click on the icon: the next kind. */
function cycleKind(view: EditorView, icon: Element): boolean {
	const box = icon.closest('aside.callout');
	if (!box) return false;
	const inside = view.posAtDOM(box.querySelector('.callout-body') ?? box, 0);
	const $pos = view.state.doc.resolve(inside);
	for (let depth = $pos.depth; depth > 0; depth -= 1) {
		const node = $pos.node(depth);
		if (node.type.name !== CALLOUT_TYPE) continue;
		const next = CALLOUT_ORDER[(CALLOUT_ORDER.indexOf(node.attrs.kind) + 1) % CALLOUT_ORDER.length];
		view.dispatch(view.state.tr.setNodeMarkup($pos.before(depth), undefined, { ...node.attrs, kind: next }));
		return true;
	}
	return false;
}

const calloutClicks = $prose(
	() =>
		new Plugin({
			props: {
				handleDOMEvents: {
					mousedown: (view, event) => {
						const icon = (event.target as Element | null)?.closest?.('.callout-icon');
						if (!icon || !view.editable || !cycleKind(view, icon)) return false;
						event.preventDefault();
						return true;
					},
				},
			},
		}),
);

/** Wraps the block at the caret in a callout of `kind`. */
export function wrapInCallout(view: EditorView, kind: CalloutKind = 'tip'): boolean {
	const type = view.state.schema.nodes[CALLOUT_TYPE];
	const range = view.state.selection.$from.blockRange();
	if (!type || !range) return false;
	view.dispatch(view.state.tr.wrap(range, [{ type, attrs: { kind } }]).scrollIntoView());
	view.focus();
	return true;
}

export function calloutPlugins(): MilkdownPlugin[] {
	return [calloutRemark, ...calloutSchema, calloutClicks].flat();
}
