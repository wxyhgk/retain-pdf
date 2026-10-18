import type { ScienceResourceRef } from '../model.ts';
import { parseScienceResourceRef } from './resource-reference.ts';

const CUBE_LANGUAGES = new Set(['cube', 'cube-3d']);
export const MAX_INLINE_CUBE_LENGTH = 256 * 1024;

export type CubeBlock = {
	type: 'cube-volume';
	language: 'cube';
	resource: ScienceResourceRef;
};

function validateInlineCube(source: string): void {
	if (source.length > MAX_INLINE_CUBE_LENGTH) {
		throw new Error('Cube 内容过大，请保存到文章 assets 并使用 @file 引用');
	}
	const lines = source.split(/\r?\n/u);
	if (lines.length < 7) throw new Error('Cube 文件头不完整');
	const atomHeader = lines[2]?.trim().split(/\s+/u) ?? [];
	const atomCount = Math.abs(Number.parseInt(atomHeader[0] ?? '', 10));
	if (!Number.isInteger(atomCount) || atomCount < 1 || atomHeader.length < 4) {
		throw new Error('Cube 原子计数行无效');
	}
	for (const line of lines.slice(3, 6)) {
		const fields = line.trim().split(/\s+/u);
		const gridCount = Math.abs(Number.parseInt(fields[0] ?? '', 10));
		if (!Number.isInteger(gridCount) || gridCount < 1 || fields.length < 4) {
			throw new Error('Cube 网格定义无效');
		}
	}
}

/** Parse only Cube volume fences; filesystem access remains the host's responsibility. */
export function parseCubeBlock(language: string, source: string): CubeBlock | null {
	if (!CUBE_LANGUAGES.has(language.trim().toLowerCase())) return null;
	const resource = parseScienceResourceRef(source);
	if (resource.kind === 'inline') validateInlineCube(resource.text);
	return { type: 'cube-volume', language: 'cube', resource };
}
