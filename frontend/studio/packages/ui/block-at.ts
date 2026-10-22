import type { Node as ProseMirrorNode } from 'prosemirror-model';

/**
 * The top-level block that owns `pos`: a position directly before a block
 * is that block; one inside text walks out to depth 1.
 */
export function blockAt(doc: ProseMirrorNode, pos: number): { pos: number; node: ProseMirrorNode } | null {
	const clamped = Math.max(0, Math.min(pos, doc.content.size));
	const direct = doc.nodeAt(clamped);
	if (direct?.isBlock && doc.resolve(clamped).nodeAfter === direct) return { pos: clamped, node: direct };
	const inside = clamped === doc.content.size && clamped > 0 ? clamped - 1 : clamped;
	const $pos = doc.resolve(inside);
	if ($pos.depth < 1) return null;
	return { pos: $pos.before(1), node: $pos.node(1) };
}
