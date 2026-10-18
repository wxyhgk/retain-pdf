/**
 * KaTeX's options for every formula: in the published blog
 * (`rehype-katex-mhchem.mjs`) and in the Studio (`math.ts`), so a formula
 * looks the same in both. A formula is first drawn with `katexOptions`;
 * one KaTeX rejects is drawn again with `lenientOptions` added, which shows
 * what it can and marks the rest in red.
 */
export const katexOptions = {
	// Only the links `\eqref` and `\ref` make, to a formula on the same page.
	trust: (context) => context.command === '\\href' && context.url.startsWith('#'),
	strict: 'warn',
	throwOnError: true,
	output: 'htmlAndMathml',
};

export const lenientOptions = {
	strict: 'ignore',
	throwOnError: false,
};

/** `name` as KaTeX wants a macro's name: with its backslash. */
function macroName(name) {
	const trimmed = name.trim();
	return trimmed.startsWith('\\') ? trimmed : `\\${trimmed}`;
}

/**
 * The macros an article's formulas use: the site's, then the article's own
 * (its `macros:` property), which win. A fresh object each time, since
 * KaTeX writes `\gdef`s into the one it is given.
 */
export function mergeMacros(siteMacros, articleMacros) {
	const macros = { ...siteMacros };
	if (articleMacros && typeof articleMacros === 'object') {
		for (const [name, expansion] of Object.entries(articleMacros)) {
			if (typeof expansion === 'string' && name.trim()) macros[macroName(name)] = expansion;
		}
	}
	return macros;
}
