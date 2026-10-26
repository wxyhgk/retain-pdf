import { createHash, randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';

export function contentRevision(content) {
	return createHash('sha256').update(content).digest('hex');
}

export async function atomicWriteText(targetPath, content) {
	const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporaryPath, content, 'utf8');
		await rename(temporaryPath, targetPath);
	} catch (error) {
		await rm(temporaryPath, { force: true }).catch(() => {});
		throw error;
	}
}
