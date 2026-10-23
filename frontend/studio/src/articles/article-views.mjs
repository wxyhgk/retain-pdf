import { isCubeDisplaySettings, normalizeCubeDisplaySettings } from '@blog/science/cube-display.mjs';
import { moleculeViewKey } from '@blog/science/view-key.mjs';
import { copyView } from '@blog/science/view-state.mjs';

export const DEFAULT_ARTICLE_VIEWS = '{\n  "version": 1,\n  "molecules": {}\n}\n';

const VIEW_KEY_PATTERN = /^[a-z0-9]+$/u;

export function assertMoleculeView(key, format, view, display) {
	if (!VIEW_KEY_PATTERN.test(key)) throw new ArticleViewsError('分子视角标识无效');
	if (typeof format !== 'string' || !/^[a-z0-9-]+$/u.test(format)) {
		throw new ArticleViewsError('分子格式无效');
	}
	// fast-mol's (the molecules), or 3Dmol's (saved before; the cubes): view-state.mjs.
	if (!copyView(view)) throw new ArticleViewsError('分子视角无效：要么是 fast-mol 的 { rotation, zoom, pan }，要么是 3Dmol 的数值数组');
	if (display !== undefined && (format !== 'cube' || !isCubeDisplaySettings(display))) {
		throw new ArticleViewsError('Cube 显示参数无效');
	}
}

function parseViewsFile(source) {
	let document;
	try {
		document = JSON.parse(source || DEFAULT_ARTICLE_VIEWS);
	} catch {
		throw new ArticleViewsError('article.views.json 不是有效的 JSON');
	}
	if (!document || document.version !== 1 || typeof document.molecules !== 'object' || Array.isArray(document.molecules)) {
		throw new ArticleViewsError('article.views.json 结构无效');
	}
	return document;
}

export function readMoleculeViews(source) {
	const document = parseViewsFile(source);
	const result = {};
	for (const [key, entry] of Object.entries(document.molecules ?? {})) {
		try {
			assertMoleculeView(key, entry?.format, entry?.view);
			result[key] = { format: entry.format, view: copyView(entry.view) };
			if (entry.format === 'cube' && isCubeDisplaySettings(entry.display)) {
				result[key].display = normalizeCubeDisplaySettings(entry.display);
			}
		} catch {
			// A malformed camera entry must not prevent other saved views from loading.
		}
	}
	return result;
}

export function writeMoleculeView(source, key, format, view, display) {
	assertMoleculeView(key, format, view, display);
	const document = parseViewsFile(source);
	const previousDisplay = document.molecules[key]?.display;
	document.molecules[key] = { format, view: copyView(view) };
	if (format === 'cube') {
		if (display !== undefined) document.molecules[key].display = normalizeCubeDisplaySettings(display);
		else if (isCubeDisplaySettings(previousDisplay)) {
			document.molecules[key].display = normalizeCubeDisplaySettings(previousDisplay);
		}
	}
	return `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * Saved views of `@file` blocks are keyed by the path as written, so when a
 * file moves, each `[from, to]` pair (`./assets/a.cube` → `./assets/b.cube`)
 * carries its views over to the new key. The source comes back unchanged
 * when nothing was saved for those paths.
 * @param {string} source
 * @param {Array<[string, string]>} moves
 */
export function moveMoleculeViews(source, moves) {
	const document = parseViewsFile(source);
	let moved = 0;
	for (const [key, entry] of Object.entries(document.molecules)) {
		if (typeof entry?.format !== 'string') continue;
		const move = moves.find(([from]) => moleculeViewKey(entry.format, from) === key);
		if (!move) continue;
		delete document.molecules[key];
		document.molecules[moleculeViewKey(entry.format, move[1])] = entry;
		moved += 1;
	}
	return { source: moved ? `${JSON.stringify(document, null, 2)}\n` : source, moved };
}

export class ArticleViewsError extends Error {
	constructor(message) {
		super(message);
		this.name = 'ArticleViewsError';
		this.statusCode = 400;
	}
}
