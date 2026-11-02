export type OfficeKind = 'document' | 'slides' | 'sheet' | 'old';
export declare const OFFICE_KIND_NAMES: Readonly<Record<OfficeKind, string>>;
export declare function officeKind(path: string): OfficeKind | null;
export declare function tableSource(path: string): { sheet: boolean; delimiter: string } | null;
export declare function fileSize(bytes: number): string;
