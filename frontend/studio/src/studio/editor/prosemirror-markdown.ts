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
	.addBefore('image', 'math_inline', mathInlineSpec)
	.addBefore('horizontal_rule', 'math_block', mathBlockSpec);

export const visualMarkdownSchema = new Schema({ nodes, marks: baseSchema.spec.marks });

const markdownIt = new MarkdownIt('commonmark', { html: false }).use(texmath, {
	engine: katex,
	delimiters: 'dollars',
});

function trimBlockDelimiterNewlines(source: string): string {
	return source.replace(/^\r?\n/u, '').replace(/\r?\n$/u, '');
}

const parseTokens: Record<string, ParseSpec> = {
	...defaultMarkdownParser.tokens,
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
const serializer = new MarkdownSerializer({
	...defaultMarkdownSerializer.nodes,
	math_inline(state, node) {
		state.write(`$${node.attrs.latex}$`);
	},
	math_block(state, node) {
		state.write('$$\n');
		state.text(node.attrs.latex, false);
		state.write('\n$$');
		state.closeBlock(node);
	},
}, defaultMarkdownSerializer.marks);

export function parseVisualMarkdownBody(source: string): ProseMirrorNode {
	return parser.parse(source);
}

export function serializeVisualMarkdownBody(document: ProseMirrorNode): string {
	return serializer.serialize(document);
}
