import { createHash, randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';

export function contentRevision(content) {
	return createHash('sha256').update(content).digest('hex');
}

/** Who is told of each text this process writes (disk-backups.mjs: the Studio's own writes are not changes from outside). */
const writeListeners = new Set();

/** Calls `listener(path, content)` as each text written with `atomicWriteText` takes its place (before the watcher tells of it); returns the function that stops it. */
export function watchWrites(listener) {
	writeListeners.add(listener);
	return () => writeListeners.delete(listener);
}

export async function atomicWriteText(targetPath, content) {
	const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporaryPath, content, 'utf8');
		await rename(temporaryPath, targetPath);
		for (const listener of writeListeners) listener(targetPath, content);
	} catch (error) {
		await rm(temporaryPath, { force: true }).catch(() => {});
		throw error;
	}
}
