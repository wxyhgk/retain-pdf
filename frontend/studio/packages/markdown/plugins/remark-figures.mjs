import { figureCaption, figureLabel, figureWidth, leadingAttributes, standaloneImage } from '../figures/figures.mjs';

function makeFigure(paragraph, { image, attributes }, number) {
	const width = figureWidth(attributes);
	const caption = figureCaption(image.alt, image.url);
	paragraph.data = {
		hName: 'figure',
		hProperties: { className: ['article-figure'], ...(width ? { style: `--figure-width: ${width}` } : {}) },
	};
	paragraph.children = [image];
	if (!caption) return false;
	paragraph.children.push({
		type: 'figureCaption',
		data: { hName: 'figcaption' },
		children: [
			{ type: 'figureLabel', data: { hName: 'span', hProperties: { className: ['figure-label'] } }, children: [{ type: 'text', value: figureLabel(number) }] },
			{ type: 'text', value: caption },
		],
	});
	return true;
}

/** An image in a sentence with `{width=…}` after it: the width on the image, the braces gone. */
function sizeInlineImages(paragraph) {
	paragraph.children.forEach((child, index, siblings) => {
		const next = siblings[index + 1];
		if (child.type !== 'image' || next?.type !== 'text') return;
		const found = leadingAttributes(next.value);
		if (!found) return;
		const width = figureWidth(found.attributes);
		if (width) child.data = { ...child.data, hProperties: { ...child.data?.hProperties, style: `width: ${width}` } };
		next.value = next.value.slice(found.length);
	});
}

/**
 * Pictures as figures (`src/figures/figures.mjs`): an image alone in its
 * paragraph becomes a figure, its alt text the caption numbered 图 1, 图 2…,
 * and `{width=60%}` after an image sets its width.
 */
export default function remarkFigures() {
	return (tree) => {
		let number = 0;
		const walk = (node) => {
			if (node.type === 'paragraph') {
				const parts = standaloneImage(node);
				if (parts) {
					if (makeFigure(node, parts, number + 1)) number += 1;
				} else sizeInlineImages(node);
				return;
			}
			node.children?.forEach(walk);
		};
		walk(tree);
	};
}
