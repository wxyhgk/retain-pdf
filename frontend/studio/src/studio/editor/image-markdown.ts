import { $remark } from '@milkdown/utils';

type MdastNode = { type: string; url?: string; alt?: string | null; title?: string | null; children?: MdastNode[] };
type RemarkPlugin = ReturnType<Parameters<typeof $remark>[1]>;

/**
 * Images open as the Markdown wrote them.
 *
 * Crepe turns an image alone in a paragraph into its image block, which
 * keeps the alt text as an aspect ratio and writes `![1.00](…)` back, and
 * an image without a title fails ProseMirror's attribute check and vanishes
 * from the editor, so saving would delete it. Here such blocks go back to
 * plain images in a paragraph, and a missing title or alt becomes `''`.
 */
function keepImages(node: MdastNode): void {
	node.children?.forEach((child, index, siblings) => {
		if (child.type === 'image-block') {
			siblings[index] = { type: 'paragraph', children: [{ type: 'image', url: child.url ?? '', alt: child.alt ?? '', title: child.title ?? '' }] };
		} else if (child.type === 'image') {
			child.alt ??= '';
			child.title ??= '';
		} else keepImages(child);
	});
}

export const imageMarkdownRemark = $remark('image-markdown', () => (() => keepImages) as unknown as RemarkPlugin);
