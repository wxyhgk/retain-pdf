import { unified } from 'unified';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';

import { parseStudioDocument } from '../document/index.ts';
import { parseVisualMarkdownBody, serializeVisualMarkdownBody } from './prosemirror-markdown.ts';

export type VisualSafety = {
	safe: boolean;
	reason?: string;
};

const parser = unified().use(remarkParse).use(remarkMath);
const supportedNodeTypes = new Set([
	'root',
	'paragraph',
	'text',
	'heading',
	'blockquote',
	'list',
	'listItem',
	'code',
	'thematicBreak',
	'strong',
	'emphasis',
	'link',
	'image',
	'inlineCode',
	'break',
	'inlineMath',
	'math',
]);

function findUnsupportedNode(value: unknown): string | null {
	if (!value || typeof value !== 'object') return null;
	const node = value as { type?: unknown; children?: unknown[] };
	if (typeof node.type === 'string' && !supportedNodeTypes.has(node.type)) return node.type;
	for (const child of node.children ?? []) {
		const unsupported = findUnsupportedNode(child);
		if (unsupported) return unsupported;
	}
	return null;
}

function semanticTree(source: string): string {
	return JSON.stringify(parser.parse(source), (key, value) => {
		if (key === 'position') return undefined;
		// Whitespace layout may be normalized without changing the document data.
		if (key === 'spread') return undefined;
		return value;
	});
}

/**
 * Rejects visual mode unless the current schema can make a semantic round trip.
 * The caller must keep the original source and display the returned reason.
 */
export function analyzeVisualSafety(source: string): VisualSafety {
	const body = parseStudioDocument(source).body.raw;
	try {
		const sourceTree = parser.parse(body);
		const unsupported = findUnsupportedNode(sourceTree);
		if (unsupported) {
			return { safe: false, reason: `包含暂不支持的 Markdown 节点：${unsupported}` };
		}

		const normalized = serializeVisualMarkdownBody(parseVisualMarkdownBody(body));
		if (semanticTree(body) !== semanticTree(normalized)) {
			return { safe: false, reason: '可视化编辑器无法无损理解这篇文章的全部语法' };
		}
		return { safe: true };
	} catch {
		return { safe: false, reason: 'Markdown 结构无法安全转换为可视化文档' };
	}
}
