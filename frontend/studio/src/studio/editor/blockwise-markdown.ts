import type { Node as ProseNode } from '@milkdown/prose/model';

/**
 * The editor's Markdown, written a top-level block at a time and remembered
 * by block: ProseMirror keeps the nodes an edit did not touch, so after an
 * edit only the block or two it touched are written again, not a whole
 * book. Blocks whose Markdown depends on the one before (a list after a
 * list takes another bullet, or the two would read as one) are written
 * together.
 */

/** Top-level blocks written with the one before them when both are of these. */
const RUNS_ON = new Set(['bullet_list', 'ordered_list']);

type Written = { readonly nodes: readonly ProseNode[]; readonly markdown: string };

/** What writes a whole document as Markdown (Milkdown's serializer). */
type Serialize = (doc: ProseNode) => string;

/** A writer for the documents of one editor: `serialize` as it would write them, faster. */
export function blockwiseMarkdown(serialize: Serialize): (doc: ProseNode) => string {
	/** By each run's first node: the run and its Markdown. */
	const written = new WeakMap<ProseNode, Written>();
	return (doc) => {
		if (doc.childCount < 2) return serialize(doc);
		const runs: ProseNode[][] = [];
		doc.forEach((node) => {
			const run = runs.at(-1);
			if (run && RUNS_ON.has(node.type.name) && RUNS_ON.has(run.at(-1)!.type.name)) run.push(node);
			else runs.push([node]);
		});
		const parts = runs.map((nodes) => {
			// An empty paragraph is written `<br />`, unless it is the last block the editor shows: written each time.
			if (nodes.length === 1 && nodes[0]!.type.name === 'paragraph' && !nodes[0]!.content.size) return serialize(doc.type.create(doc.attrs, nodes)).replace(/\n+$/u, '');
			const known = written.get(nodes[0]!);
			if (known && known.nodes.length === nodes.length && known.nodes.every((node, index) => node === nodes[index])) return known.markdown;
			const markdown = serialize(doc.type.create(doc.attrs, nodes)).replace(/\n+$/u, '');
			written.set(nodes[0]!, { nodes, markdown });
			return markdown;
		});
		return `${parts.join('\n\n')}\n`;
	};
}
