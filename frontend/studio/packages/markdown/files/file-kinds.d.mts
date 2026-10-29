export type FileKind = 'pdf' | 'image' | 'video' | 'audio' | 'table' | 'archive' | 'code' | 'data' | 'text' | 'file';
export function fileKind(path: string): FileKind;
export function fileKindName(kind: string): string;
export function fileSize(bytes: number): string;
