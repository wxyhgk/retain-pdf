import { t } from '@blog/i18n/index.mjs';
import { parseStudioDocument } from './parse.ts';
import type { ArticleProperties } from './types.ts';

type SourceLine = {
	start: number;
	contentEnd: number;
	end: number;
	content: string;
	eol: string;
};

const EDITABLE_KEYS = ['title', 'description', 'pubDate', 'tags', 'draft'] as const;
type EditableKey = typeof EDITABLE_KEYS[number];
/** Properties a page may go without: written when set, taken out when emptied, left alone when not given. */
const OPTIONAL_KEYS = { icon: 'icon', cover: 'heroImage', kind: 'kind', wide: 'wide', parent: 'parent' } as const;
type OptionalKey = keyof typeof OPTIONAL_KEYS;

function readLines(source: string): SourceLine[] {
	const lines: SourceLine[] = [];
	let cursor = 0;
	while (cursor < source.length) {
		const start = cursor;
		while (cursor < source.length && source[cursor] !== '\n' && source[cursor] !== '\r') cursor += 1;
		const contentEnd = cursor;
		if (source[cursor] === '\r' && source[cursor + 1] === '\n') cursor += 2;
		else if (source[cursor] === '\r' || source[cursor] === '\n') cursor += 1;
		lines.push({
			start,
			contentEnd,
			end: cursor,
			content: source.slice(start, contentEnd),
			eol: source.slice(contentEnd, cursor),
		});
	}
	return lines;
}

function topLevelKey(line: SourceLine): string | null {
	return /^([A-Za-z_][\w-]*):(?:\s|$)/u.exec(line.content)?.[1] ?? null;
}

function inlineComment(line: string): string {
	let quote: 'single' | 'double' | null = null;
	for (let index = 0; index < line.length; index += 1) {
		const character = line[index];
		if (character === "'" && quote !== 'double') {
			if (quote === 'single' && line[index + 1] === "'") index += 1;
			else quote = quote === 'single' ? null : 'single';
		} else if (character === '"' && quote !== 'single' && line[index - 1] !== '\\') {
			quote = quote === 'double' ? null : 'double';
		} else if (character === '#' && quote === null && (index === 0 || /\s/u.test(line[index - 1]!))) {
			return line.slice(index).trimEnd();
		}
	}
	return '';
}

function encodedValue(key: string, value: unknown): string {
	if (key === 'draft') return value ? 'true' : 'false';
	// A map (a database row's values): JSON on one line, spaced, which YAML reads as it is.
	if (key === 'props' || key === 'retainpdf') return JSON.stringify(value, null, 1).replace(/\n\s*/gu, ' ');
	if (key === 'order') return String(value);
	if (key === 'tags') return `[${(value as string[]).map((tag) => JSON.stringify(tag)).join(', ')}]`;
	return JSON.stringify(value);
}

/** Where a top-level field and the lines that continue it end: before the next field, leaving trailing blanks and comments. */
function fieldEnd(lines: SourceLine[], fieldIndex: number, length: number): number {
	const field = lines[fieldIndex]!;
	let end = lines.slice(fieldIndex + 1).find((line) => topLevelKey(line) !== null)?.start ?? length;
	const between = lines.filter((line) => line.start > field.start && line.start < end);
	for (let index = between.length - 1; index >= 0; index -= 1) {
		const line = between[index]!;
		if (line.content.trim() === '' || line.content.trimStart().startsWith('#')) end = line.start;
		else break;
	}
	return end;
}

/** Takes a top-level field out, with what continues it. */
function removeYamlField(yaml: string, key: string): string {
	const lines = readLines(yaml);
	const fieldIndex = lines.findIndex((line) => topLevelKey(line) === key);
	if (fieldIndex < 0) return yaml;
	return `${yaml.slice(0, lines[fieldIndex]!.start)}${yaml.slice(fieldEnd(lines, fieldIndex, yaml.length))}`;
}

function replaceYamlField(yaml: string, key: string, value: unknown, defaultEol: string): string {
	const lines = readLines(yaml);
	const fieldIndex = lines.findIndex((line) => topLevelKey(line) === key);
	const replacementValue = encodedValue(key, value);
	if (fieldIndex < 0) {
		const separator = yaml.length > 0 && !yaml.endsWith('\n') && !yaml.endsWith('\r') ? defaultEol : '';
		return `${yaml}${separator}${key}: ${replacementValue}${defaultEol}`;
	}

	const field = lines[fieldIndex]!;
	const end = fieldEnd(lines, fieldIndex, yaml.length);
	const comment = inlineComment(field.content);
	const eol = field.eol || defaultEol;
	const replacement = `${key}: ${replacementValue}${comment ? ` ${comment}` : ''}${eol}`;
	return `${yaml.slice(0, field.start)}${replacement}${yaml.slice(end)}`;
}

function validateProperties(properties: ArticleProperties): void {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(properties.pubDate)) throw new Error(t('发布日期格式无效'));
	if (properties.tags.some((tag) => !tag.trim())) throw new Error(t('标签不能为空'));
}

/**
 * A top-level field the tree of pages keeps (`parent:`, `order:`) set, or
 * taken out when empty; the rest of the text byte for byte as it was (the
 * tree's moves change nothing else).
 */
export function setFrontmatterField(source: string, key: 'parent' | 'order' | 'database' | 'type', value: string | number | null): string {
	const document = parseStudioDocument(source);
	if (!document.frontmatter) throw new Error(t('页面缺少 frontmatter，无法修改属性'));
	const defaultEol = document.frontmatter.openingRaw.endsWith('\r\n') ? '\r\n' : '\n';
	const yaml = value === null || value === ''
		? removeYamlField(document.frontmatter.yamlRaw, key)
		: replaceYamlField(document.frontmatter.yamlRaw, key, typeof value === 'number' ? String(value) : value, defaultEol);
	return `${document.preambleRaw}${document.frontmatter.openingRaw}${yaml}${document.frontmatter.closingRaw}${document.body.raw}`;
}

/**
 * A database row's values (`props:`, database.mjs) set, or taken out when there are none; the rest of the text byte
 * for byte as it was.
 */
export function setFrontmatterProps(source: string, props: Record<string, unknown> | null): string {
	const document = parseStudioDocument(source);
	if (!document.frontmatter) throw new Error(t('页面缺少 frontmatter，无法修改属性'));
	const defaultEol = document.frontmatter.openingRaw.endsWith('\r\n') ? '\r\n' : '\n';
	const yaml = !props || Object.keys(props).length === 0 ? removeYamlField(document.frontmatter.yamlRaw, 'props') : replaceYamlField(document.frontmatter.yamlRaw, 'props', props, defaultEol);
	return `${document.preambleRaw}${document.frontmatter.openingRaw}${yaml}${document.frontmatter.closingRaw}${document.body.raw}`;
}

/**
 * The block from before databases were pages whose row a page is (`database:`, its id) set, or taken out (null); the
 * rest of the text byte for byte as it was.
 */
export function setFrontmatterDatabase(source: string, id: string | null): string {
	return setFrontmatterField(source, 'database', id);
}

/**
 * What a page is in RetainPDF's 读书笔记 (`retainpdf:`: a book's notes, or the page they are under) set; the rest of
 * the text byte for byte as it was.
 */
export function setFrontmatterRetainpdf(source: string, value: { document?: string; job?: string; books?: boolean }): string {
	const document = parseStudioDocument(source);
	if (!document.frontmatter) throw new Error(t('页面缺少 frontmatter，无法修改属性'));
	const defaultEol = document.frontmatter.openingRaw.endsWith('\r\n') ? '\r\n' : '\n';
	const yaml = replaceYamlField(document.frontmatter.yamlRaw, 'retainpdf', value, defaultEol);
	return `${document.preambleRaw}${document.frontmatter.openingRaw}${yaml}${document.frontmatter.closingRaw}${document.body.raw}`;
}

/** Updates only supported top-level fields while retaining all other YAML bytes. */
export function updateStudioFrontmatter(source: string, properties: ArticleProperties): string {
	validateProperties(properties);
	const document = parseStudioDocument(source);
	if (!document.frontmatter) throw new Error(t('页面缺少 frontmatter，无法修改属性'));
	const defaultEol = document.frontmatter.openingRaw.endsWith('\r\n') ? '\r\n' : '\n';
	let yaml = document.frontmatter.yamlRaw;
	for (const key of EDITABLE_KEYS) yaml = replaceYamlField(yaml, key, properties[key], defaultEol);
	for (const [property, key] of Object.entries(OPTIONAL_KEYS) as Array<[OptionalKey, string]>) {
		const value = properties[property];
		if (value === undefined) continue;
		const present = readLines(yaml).some((line) => topLevelKey(line) === key);
		// A post is what an article is unless it says otherwise: no `kind: post` is written for it.
		const empty = !value || (property === 'kind' && value === 'post' && !present);
		yaml = empty ? removeYamlField(yaml, key) : replaceYamlField(yaml, key, value, defaultEol);
	}
	if (properties.props !== undefined) {
		const kept = Object.fromEntries(Object.entries(properties.props).filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== false && !(Array.isArray(value) && !value.length)));
		yaml = Object.keys(kept).length ? replaceYamlField(yaml, 'props', kept, defaultEol) : removeYamlField(yaml, 'props');
	}
	return `${document.preambleRaw}${document.frontmatter.openingRaw}${yaml}${document.frontmatter.closingRaw}${document.body.raw}`;
}
