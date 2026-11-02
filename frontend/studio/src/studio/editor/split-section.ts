import type { Node as ProseNode } from '@milkdown/prose/model';

// 转成子页面 (as SiYuan turns a heading into a document): a heading and what follows it, to the next heading
// as high or higher, becomes a page of its own under the article; a link to it stays in its place.

/** The section a heading at `pos` begins: from it to the next heading as high or higher beside it, or the end. */
export function headingSection(doc: ProseNode, pos: number): { from: number; to: number; title: string } | null {
	const heading = doc.nodeAt(pos);
	if (heading?.type.name !== 'heading') return null;
	const $pos = doc.resolve(pos);
	const parent = $pos.parent;
	const level = Number(heading.attrs.level) || 1;
	let to = $pos.end();
	let at = pos + heading.nodeSize;
	for (let index = $pos.index() + 1; index < parent.childCount; index += 1) {
		const node = parent.child(index);
		if (node.type.name === 'heading' && (Number(node.attrs.level) || 1) <= level) {
			to = at;
			break;
		}
		at += node.nodeSize;
	}
	return { from: pos, to, title: heading.textContent.trim() };
}

/** The article's files a piece of its Markdown names (`./img/a.png`, `@file ./assets/opt.log`), as `img/a.png`. */
export function filesNamed(markdown: string): string[] {
	const found = new Set<string>();
	for (const match of markdown.matchAll(/\.\/((?:img|assets)\/[^\s)"'<>\]]+)/gu)) {
		let path = match[1]!;
		try {
			path = decodeURI(path);
		} catch {
			// Kept as written.
		}
		found.add(path);
	}
	return [...found];
}
