import type { StudioDocument } from './types.ts';

/**
 * Serializes only retained raw slices. It deliberately does not use a Markdown
 * stringifier, so an untouched document is byte-for-byte identical.
 */
export function serializeStudioDocument(document: StudioDocument): string {
	return [
		document.preambleRaw,
		document.frontmatter?.raw ?? '',
		...document.body.blocks.map((block) => block.raw),
	].join('');
}

/** Replaces only the body while retaining the original BOM and frontmatter bytes. */
export function replaceStudioDocumentBody(document: StudioDocument, body: string): string {
	return `${document.preambleRaw}${document.frontmatter?.raw ?? ''}${body}`;
}
