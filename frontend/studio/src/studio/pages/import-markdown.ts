import JSZip from 'jszip';

/**
 * What 导入 Markdown is given (server/articles/article-import.mjs): `.md` files, a `.zip` (Notion's export, an
 * Obsidian vault's), or a folder of them with their pictures; chosen in the system's dialog.
 */
export function chooseMarkdown(kind: 'files' | 'folder'): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;
		if (kind === 'folder') input.webkitdirectory = true;
		else input.accept = '.md,.markdown,.txt,.zip';
		input.hidden = true;
		input.addEventListener('change', () => {
			resolve([...(input.files ?? [])]);
			input.remove();
		});
		input.addEventListener('cancel', () => {
			resolve([]);
			input.remove();
		});
		document.body.append(input);
		input.click();
	});
}

/** The files as one zip, as the server takes them: a zip given alone as it is; a folder's, each at its place in it. */
export async function packForImport(files: File[]): Promise<Blob> {
	if (files.length === 1 && /\.zip$/iu.test(files[0]!.name)) return files[0]!;
	const zip = new JSZip();
	for (const file of files) {
		const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
		// A .txt picked as Markdown is read as Markdown.
		zip.file(/\.txt$/iu.test(path) && !file.webkitRelativePath ? path.replace(/\.txt$/iu, '.md') : path, file);
	}
	return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}
