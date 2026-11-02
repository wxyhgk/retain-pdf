import { t } from '@blog/i18n/index.mjs';

/**
 * A reaction's energy profile, written in the article as a fence: a species a
 * line, its name then its energy; `# 名字` starts another path, and a line
 * `y: …` names the axis, `title: …` the figure.
 *
 *     ```energy
 *     y: ΔG / kcal·mol⁻¹
 *     # 分步
 *     反应物 0
 *     TS1 12.3
 *     中间体 -4.1
 *     TS2 8.0
 *     产物 -15.2
 *     # 协同
 *     反应物 0
 *     TS 18.5
 *     产物 -15.2
 *     ```
 *
 * Drawn as the diagram the papers have: a level a species, dashed lines from
 * one to the next. A species another path already has (by its name) stands in
 * that path's column, the others spread evenly between; the diagram is SVG
 * (the same in the Studio and on the blog), its colors the page's.
 */

export const ENERGY_LANGUAGE = 'energy';

/** What a new diagram starts as. */
export const ENERGY_STARTER = 'y: ΔG / kcal·mol⁻¹\n反应物 0\nTS1 12.3\n中间体 -4.1\nTS2 8.0\n产物 -15.2'; // i18n-ignore: written into the article

/**
 * @typedef {{ name: string, value: number, shown: string, line: number }} Level
 * @typedef {{ name: string, levels: Level[] }} EnergyPath
 * @typedef {{ axis: string, title: string, paths: EnergyPath[], problems: { line: number, reason: string }[] }} EnergyProfile
 */

const NUMBER = /^[+\-−–]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+\-−]?\d+)?$/u;
const OPTION = /^(y|title)\s*[:：]\s*(.*)$/iu;

/** A profile's text read: its options, its paths, and the lines that could not be read (numbered from 1). */
export function parseEnergy(text) {
	/** @type {EnergyProfile} */
	const profile = { axis: '', title: '', paths: [], problems: [] };
	/** @type {EnergyPath | null} */
	let path = null;
	String(text ?? '')
		.split('\n')
		.forEach((raw, index) => {
			const line = raw.trim();
			if (!line) return;
			const option = OPTION.exec(line);
			if (option) {
				profile[option[1].toLowerCase() === 'y' ? 'axis' : 'title'] = option[2].trim();
				return;
			}
			if (line.startsWith('#')) {
				path = { name: line.replace(/^#+/u, '').trim(), levels: [] };
				profile.paths.push(path);
				return;
			}
			const cut = line.search(/\S+$/u);
			const number = line.slice(cut);
			const name = line.slice(0, cut).trim();
			if (!NUMBER.test(number) || !name) {
				profile.problems.push({ line: index + 1, reason: t('读不出「{text}」：要写成「名字 能量」，比如「TS1 12.3」', { text: line }) });
				return;
			}
			if (!path) {
				path = { name: '', levels: [] };
				profile.paths.push(path);
			}
			const value = Number(number.replace(/[−–]/gu, '-'));
			path.levels.push({ name, value, shown: number.replace(/^[-–]/u, '−').replace(/^\+/u, ''), line: index + 1 });
		});
	profile.paths = profile.paths.filter((each) => each.levels.length);
	return profile;
}

/**
 * Each level's column: the first path's one after another; in a later path, a species
 * a path before has keeps its column, and those between are spread evenly.
 */
export function energyColumns(paths) {
	const columns = new Map();
	const placed = paths.map((path) => {
		const known = path.levels.map((level) => columns.get(level.name));
		const anchors = known.flatMap((column, index) => (column === undefined ? [] : [index]));
		const at = known.map((column, index) => {
			if (column !== undefined) return column;
			if (!anchors.length) return index;
			const before = anchors.findLast((anchor) => anchor < index);
			const after = anchors.find((anchor) => anchor > index);
			if (before === undefined) return known[after] - (after - index);
			if (after === undefined) return known[before] + (index - before);
			return known[before] + ((known[after] - known[before]) * (index - before)) / (after - before);
		});
		path.levels.forEach((level, index) => {
			if (!columns.has(level.name)) columns.set(level.name, at[index]);
		});
		return at;
	});
	const least = Math.min(0, ...placed.flat());
	return placed.map((at) => at.map((column) => column - least));
}

/** About how wide a text is drawn, in the diagram's units (a Chinese character twice a Latin one). */
function textWidth(text, size) {
	let width = 0;
	for (const char of text) width += /[\u2e80-\uffff]/u.test(char) ? size : size * 0.6;
	return width;
}

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const txt = (value) => ({ type: 'text', value });
const round = (number) => Math.round(number * 10) / 10;

/**
 * Where a column's numbers and names go, its levels from the top down: the number over its level,
 * the name under; a name the level below has too is said once, under that one; a number with no
 * room over its level (the one above too near) goes under it, the name under the number.
 * @template {{ column: number, y: number, level: { name: string } }} T
 * @param {T[]} levels
 * @returns {(T & { named: boolean, valueBelow: boolean })[][]}
 */
export function energyLabels(levels) {
	const columns = new Map();
	for (const level of levels) {
		if (!columns.has(level.column)) columns.set(level.column, []);
		columns.get(level.column).push(level);
	}
	return [...columns.values()].map((column) => {
		column.sort((a, b) => a.y - b.y);
		return column.reduce((laid, level, index) => {
			const above = laid[index - 1];
			const below = column[index + 1];
			const taken = above ? (above.named ? SIZE + 8 : 0) + (above.valueBelow ? SIZE + 4 : 0) : 0;
			const room = above ? level.y - above.y - taken : Infinity;
			laid.push({ ...level, named: !below || below.level.name !== level.level.name, valueBelow: room < SIZE + 6 });
			return laid;
		}, /** @type {(T & { named: boolean, valueBelow: boolean })[]} */ ([]));
	});
}

const SIZE = 12;
const BAR = 64;
const PLOT = 220;

/** The profile as its figure (HAST): the diagram, and its title under it. */
export function energyFigure(profile) {
	const levels = profile.paths.flatMap((path) => path.levels);
	if (!levels.length) {
		return el('figure', { className: ['note-energy', 'is-empty'] }, [el('p', { className: ['note-energy-empty'] }, [txt(t('能量图还没有数据：一行写一个物种，名字后面跟能量，比如「TS1 12.3」'))])]);
	}
	const columns = energyColumns(profile.paths);
	const step = Math.max(110, ...levels.map((level) => textWidth(level.name, SIZE) + 24));
	const legend = profile.paths.length > 1;
	const left = 44;
	const top = 30 + (legend ? 24 : 0);
	const width = Math.ceil(left + 12 + (Math.max(...columns.flat()) + 1) * step);
	const values = levels.map((level) => level.value);
	const high = Math.max(...values);
	const low = Math.min(...values);
	const y = (value) => round(top + (high === low ? PLOT / 2 : ((high - value) / (high - low)) * PLOT));
	const x = (column) => left + 12 + column * step + (step - BAR) / 2;

	const shapes = [];
	// The axis: energy upwards, its name along it.
	const axisBottom = top + PLOT + 12;
	shapes.push(el('line', { className: ['energy-axis'], x1: left, y1: axisBottom, x2: left, y2: top - 20 }));
	shapes.push(el('path', { className: ['energy-arrow'], d: `M${left - 4} ${top - 12}L${left} ${top - 22}L${left + 4} ${top - 12}Z` }));
	const middle = round((top - 20 + axisBottom) / 2);
	shapes.push(el('text', { className: ['energy-axis-name'], x: -middle, y: 16, transform: 'rotate(-90)' }, [txt(profile.axis || t('相对能量'))]));

	// The lines between first, then the levels, then their numbers and names over them all.
	const links = [];
	const bars = [];
	const drawn = new Map();
	profile.paths.forEach((path, which) => {
		const style = `energy-path-${which % 4}`;
		const at = columns[which];
		path.levels.forEach((level, index) => {
			const from = x(at[index]);
			const levelY = y(level.value);
			if (index > 0) {
				const before = path.levels[index - 1];
				links.push(el('line', { className: ['energy-link', style], x1: round(x(at[index - 1]) + BAR), y1: y(before.value), x2: round(from), y2: levelY }));
			}
			// A species the paths share is drawn once.
			const key = `${at[index]}|${level.value}`;
			if (!drawn.has(key)) drawn.set(key, { column: at[index], from, y: levelY, level, style });
		});
	});
	const labels = [];
	let lowest = top + PLOT;
	for (const column of energyLabels([...drawn.values()])) {
		for (const bar of column) {
			const center = round(bar.from + BAR / 2);
			bars.push(el('line', { className: ['energy-level', bar.style], x1: round(bar.from), y1: bar.y, x2: round(bar.from + BAR), y2: bar.y }));
			const valueY = bar.valueBelow ? bar.y + SIZE + 6 : bar.y - 6;
			labels.push(el('text', { className: ['energy-value'], x: center, y: round(valueY) }, [txt(bar.level.shown)]));
			if (!bar.named) continue;
			const nameY = bar.y + SIZE + 6 + (bar.valueBelow ? SIZE + 4 : 0);
			labels.push(el('text', { className: ['energy-name'], x: center, y: round(nameY) }, [txt(bar.level.name)]));
			lowest = Math.max(lowest, nameY);
		}
	}
	shapes.push(...links, ...bars, ...labels);

	if (legend) {
		let along = left + 16;
		profile.paths.forEach((path, which) => {
			const name = path.name || t('路径 {number}', { number: which + 1 });
			shapes.push(el('line', { className: ['energy-link', `energy-path-${which % 4}`], x1: along, y1: 14, x2: along + 24, y2: 14 }));
			shapes.push(el('text', { className: ['energy-legend'], x: along + 30, y: 18 }, [txt(name)]));
			along += 30 + textWidth(name, SIZE) + 20;
		});
	}

	const height = Math.ceil(Math.max(top + PLOT + 34, lowest + 8));
	const svg = el(
		'svg',
		{ className: ['note-energy-plot'], viewBox: `0 0 ${width} ${height}`, role: 'img', ariaLabel: profile.title || t('反应能量图'), style: `max-width:${width}px` },
		shapes,
	);
	const caption = profile.title ? [el('figcaption', {}, [txt(profile.title)])] : [];
	return el('figure', { className: ['note-energy'] }, [svg, ...caption]);
}
