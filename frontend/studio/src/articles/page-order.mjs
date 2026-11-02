/**
 * The order of the pages under one page (or at the top): those given an
 * `order:` first, by it; then the rest by title, numbers in it read as
 * numbers (第2章 before 第10章). The Studio's tree and the blog's 下面的页面
 * list use it alike.
 *
 * @param {{ title: string, order?: number | null }} left
 * @param {{ title: string, order?: number | null }} right
 */
export function comparePages(left, right) {
	const a = typeof left.order === 'number' ? left.order : null;
	const b = typeof right.order === 'number' ? right.order : null;
	if (a !== null && b !== null && a !== b) return a - b;
	if (a !== null && b === null) return -1;
	if (a === null && b !== null) return 1;
	return left.title.localeCompare(right.title, 'zh-CN', { numeric: true });
}
