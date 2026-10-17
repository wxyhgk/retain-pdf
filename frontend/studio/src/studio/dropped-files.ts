/** A file to upload, with the folders it came in when a whole folder was dropped (`My Data/run 1`). */
export type UploadItem = { file: File; subfolder: string };

/** The folders part of a path relative to what was dropped: `My Data/run 1/out.log` gives `My Data/run 1`. */
export function subfolderOf(relativePath: string): string {
	const parts = relativePath.replace(/^\/+/u, '').split('/');
	return parts.slice(0, -1).join('/');
}

/** Files the system keeps for itself, which nobody means to upload. */
function isSystemFile(name: string): boolean {
	return name.startsWith('.') || name === 'Thumbs.db' || name === 'desktop.ini';
}

function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
	return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function walk(entry: FileSystemEntry, items: UploadItem[]): Promise<void> {
	if (isSystemFile(entry.name)) return;
	if (entry.isFile) {
		const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
		items.push({ file, subfolder: subfolderOf(entry.fullPath) });
		return;
	}
	if (!entry.isDirectory) return;
	const reader = (entry as FileSystemDirectoryEntry).createReader();
	// A folder is read in batches; an empty batch means the end.
	for (let batch = await readBatch(reader); batch.length; batch = await readBatch(reader)) {
		for (const child of batch) await walk(child, items);
	}
}

/**
 * What a drop holds: its files, and the files inside any folders, with the
 * folders they are in. The entries must be taken while the drop event is
 * being handled, so this reads them first and only then waits.
 */
export function droppedItems(transfer: DataTransfer): Promise<UploadItem[]> {
	const entries = [...transfer.items]
		.filter((item) => item.kind === 'file')
		.map((item) => item.webkitGetAsEntry?.() ?? null);
	if (!entries.length || entries.some((entry) => entry === null)) {
		return Promise.resolve([...transfer.files].map((file) => ({ file, subfolder: '' })));
	}
	return (async () => {
		const items: UploadItem[] = [];
		for (const entry of entries) await walk(entry!, items);
		return items;
	})();
}

/** Whether the drop holds a folder, without reading it. */
export function dropHasFolder(transfer: DataTransfer): boolean {
	return [...transfer.items].some((item) => item.kind === 'file' && item.webkitGetAsEntry?.()?.isDirectory);
}

/** The files a folder picker (`webkitdirectory`) returned, with their folders. */
export function pickedItems(files: readonly File[]): UploadItem[] {
	return files
		.filter((file) => !file.webkitRelativePath.split('/').some(isSystemFile))
		.map((file) => ({ file, subfolder: subfolderOf(file.webkitRelativePath) }));
}
