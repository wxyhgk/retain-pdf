import katex from 'katex';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import {
	defaultMarkdownParser,
	defaultMarkdownSerializer,
	MarkdownParser,
	MarkdownSerializer,
	type ParseSpec,
} from 'prosemirror-markdown';
import { Schema, type Node as ProseMirrorNode, type NodeSpec } from 'prosemirror-model';

import { blockquoteParseSpec, blockquoteSpec, serializeBlockquote } from './nodes/blockquote.ts';
import {
	codeBlockFenceParseSpec,
	codeBlockIndentedParseSpec,
	codeBlockSpec,
	serializeCodeBlock,
} from './nodes/code-block.ts';
import { hardBreakParseSpec, hardBreakSpec, serializeHardBreak } from './nodes/hard-break.ts';
import { headingParseSpec, headingSpec, serializeHeading } from './nodes/heading.ts';
import {
	horizontalRuleParseSpec,
	horizontalRuleSpec,
	serializeHorizontalRule,
} from './nodes/horizontal-rule.ts';
import { imageParseSpec, imageSpec, serializeImage } from './nodes/image.ts';
import {
	bulletListParseSpec,
	bulletListSpec,
	listItemParseSpec,
	listItemSpec,
	orderedListParseSpec,
	orderedListSpec,
	serializeBulletList,
	serializeListItem,
	serializeOrderedList,
} from './nodes/list.ts';
import { paragraphParseSpec, paragraphSpec, serializeParagraph } from './nodes/paragraph.ts';
import { codeInlineParseSpec, codeMarkSerializer, codeMarkSpec } from './marks/code.ts';
import { emMarkSerializer, emParseSpec, emSpec } from './marks/em.ts';
import { linkMarkSerializer, linkParseSpec, linkSpec } from './marks/link.ts';
import { strongMarkSerializer, strongParseSpec, strongSpec } from './marks/strong.ts';

const mathInlineSpec: NodeSpec = {
	attrs: { latex: { default: '' } },
	inline: true,
	group: 'inline',
	atom: true,
	selectable: true,
	toDOM: (node: ProseMirrorNode) => ['span', { 'data-math-inline': '', 'data-latex': node.attrs.latex }],
};

const mathBlockSpec: NodeSpec = {
	attrs: { latex: { default: '' } },
	group: 'block',
	atom: true,
	selectable: true,
	toDOM: (node: ProseMirrorNode) => ['div', { 'data-math-block': '', 'data-latex': node.attrs.latex }],
};

const baseSchema = defaultMarkdownParser.schema;
const nodes = baseSchema.spec.nodes
	.update('paragraph', paragraphSpec)
	.update('blockquote', blockquoteSpec)
	.update('horizontal_rule', horizontalRuleSpec)
	.update('heading', headingSpec)
	.update('code_block', codeBlockSpec)
	.update('ordered_list', orderedListSpec)
	.update('bullet_list', bulletListSpec)
	.update('list_item', listItemSpec)
	.update('image', imageSpec)
	.update('hard_break', hardBreakSpec)
	.addBefore('image', 'math_inline', mathInlineSpec)
	.addBefore('horizontal_rule', 'math_block', mathBlockSpec);

const marks = baseSchema.spec.marks
	.update('em', emSpec)
	.update('strong', strongSpec)
	.update('link', linkSpec)
	.update('code', codeMarkSpec);

export const visualMarkdownSchema = new Schema({ nodes, marks });

const markdownIt = new MarkdownIt('commonmark', { html: false }).use(texmath, {
	engine: katex,
	delimiters: 'dollars',
});

function trimBlockDelimiterNewlines(source: string): string {
	return source.replace(/^\r?\n/u, '').replace(/\r?\n$/u, '');
}

const parseTokens: Record<string, ParseSpec> = {
	...defaultMarkdownParser.tokens,
	blockquote: blockquoteParseSpec,
	paragraph: paragraphParseSpec,
	list_item: listItemParseSpec,
	bullet_list: bulletListParseSpec,
	ordered_list: orderedListParseSpec,
	heading: headingParseSpec,
	code_block: codeBlockIndentedParseSpec,
	fence: codeBlockFenceParseSpec,
	hr: horizontalRuleParseSpec,
	image: imageParseSpec,
	hardbreak: hardBreakParseSpec,
	em: emParseSpec,
	strong: strongParseSpec,
	link: linkParseSpec,
	code_inline: codeInlineParseSpec,
	math_inline: {
		node: 'math_inline',
		getAttrs: (token) => ({ latex: token.content }),
	},
	math_block: {
		node: 'math_block',
		getAttrs: (token) => ({ latex: trimBlockDelimiterNewlines(token.content) }),
	},
};

const parser = new MarkdownParser(visualMarkdownSchema, markdownIt, parseTokens);
const serializer = new MarkdownSerializer(
	{
		...defaultMarkdownSerializer.nodes,
		blockquote: serializeBlockquote,
		code_block: serializeCodeBlock,
		heading: serializeHeading,
		horizontal_rule: serializeHorizontalRule,
		bullet_list: serializeBulletList,
		ordered_list: serializeOrderedList,
		list_item: serializeListItem,
		paragraph: serializeParagraph,
		image: serializeImage,
		hard_break: serializeHardBreak,
		math_inline(state, node) {
			state.write(`$${node.attrs.latex}$`);
		},
		math_block(state, node) {
			state.write('$$\n');
			state.text(node.attrs.latex, false);
			state.write('\n$$');
			state.closeBlock(node);
		},
	},
	{
		...defaultMarkdownSerializer.marks,
		em: emMarkSerializer,
		strong: strongMarkSerializer,
		link: linkMarkSerializer,
		code: codeMarkSerializer,
	},
);

export function parseVisualMarkdownBody(source: string): ProseMirrorNode {
	return parser.parse(source);
}

export function serializeVisualMarkdownBody(document: ProseMirrorNode): string {
	return serializer.serialize(document);
}
