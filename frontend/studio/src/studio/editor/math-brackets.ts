import { $remark } from '@milkdown/utils';

import remarkMathBrackets from '../../plugins/remark-math-brackets.mjs';

type MdastNode = { type: string; value?: string; lang?: string; children?: MdastNode[] };

/**
 * Crepe turns `math` blocks into LaTeX code blocks in its own transform,
 * which has already run when this one lifts `\[…\]` out of a paragraph, so
 * the lifted blocks get the same treatment here.
 */
function asLatexCode(node: MdastNode): void {
	node.children?.forEach((child, index, siblings) => {
		if (child.type === 'math') siblings[index] = { type: 'code', lang: 'LaTeX', value: child.value ?? '' };
		else asLatexCode(child);
	});
}

type RemarkPlugin = ReturnType<Parameters<typeof $remark>[1]>;

function remarkMathBracketsForCrepe(this: unknown) {
	const split = remarkMathBrackets.call(this);
	return (tree: MdastNode) => {
		split(tree);
		asLatexCode(tree);
	};
}

/** `\(…\)` and `\[…\]` open as the same formula nodes as `$…$` and `$$…$$`. */
export const mathBracketsRemark = $remark('math-brackets', () => remarkMathBracketsForCrepe as unknown as RemarkPlugin);
