import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import type { Plugin as UnifiedPlugin, Transformer } from 'unified';

/** mdast type assigned to a block of raw HTML before Milkdown parses the tree. */
export const HTML_BLOCK_TYPE = 'html_block';

const BLOCK_TAGS = new Set([
	'address',
	'article',
	'aside',
	'blockquote',
	'canvas',
	'details',
	'div',
	'dl',
	'fieldset',
	'figcaption',
	'figure',
	'footer',
	'form',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'header',
	'hr',
	'iframe',
	'main',
	'nav',
	'ol',
	'p',
	'pre',
	'section',
	'style',
	'svg',
	'table',
	'ul',
	'video',
]);

export const HTML_BLOCK_STARTER = '<div class="callout">\n在这里写内容\n</div>\n';

type MdastNode = {
	type?: string;
	value?: unknown;
	children?: MdastNode[];
};

export function isLineBreakHtml(value: string): boolean {
	return /^<br\s*\/?\s*>$/i.test(value.trim());
}

/** Block HTML is lifted out of the paragraph Milkdown would otherwise show as source text. */
export function isBlockHtml(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed || isLineBreakHtml(trimmed)) return false;
	if (trimmed.includes('\n')) return true;
	const match = /^<\s*\/?\s*([a-zA-Z][\w:-]*)/u.exec(trimmed);
	if (!match) return false;
	return BLOCK_TAGS.has(match[1].toLowerCase());
}

function asBlock(node: MdastNode): MdastNode {
	if (node.type === 'html' && typeof node.value === 'string' && isBlockHtml(node.value)) {
		return { type: HTML_BLOCK_TYPE, value: node.value };
	}
	return node;
}

function liftNode(node: MdastNode): MdastNode {
	if (!node.children) return asBlock(node);
	const children = node.children.map((child) => (child.type === 'html' ? child : liftNode(child)));
	const lifted = children.map((child) => {
		if (node.type === 'paragraph' && children.length !== 1) return child;
		return asBlock(child);
	});
	if (node.type === 'paragraph' && lifted.length === 1 && lifted[0]?.type === HTML_BLOCK_TYPE) return lifted[0];
	return { ...node, children: lifted };
}

/** unified remark plugin. Runs after Milkdown wraps raw HTML in paragraphs. */
export function liftHtmlBlocks(): UnifiedPlugin {
	const transform: Transformer = (tree) => liftNode(tree as MdastNode);
	return () => transform;
}

export type HtmlBlockLift = {
	from: number;
	to: number;
	value: string;
};

/** Paragraphs that contain only a block-level HTML atom, for paste and typed input. */
export function planHtmlBlockLift(document: ProseMirrorNode): HtmlBlockLift[] {
	const lifts: HtmlBlockLift[] = [];
	document.descendants((node, pos) => {
		if (node.type.name !== 'paragraph' || node.childCount !== 1) return;
		const child = node.firstChild;
		if (!child || child.type.name !== 'html') return;
		const value = String(child.attrs.value ?? '');
		if (!isBlockHtml(value)) return;
		lifts.push({ from: pos, to: pos + node.nodeSize, value });
	});
	return lifts;
}
