export type OfficeKind = 'document' | 'slides' | 'sheet' | 'old';
export declare function officeKind(path: string): OfficeKind | null;
export declare function tableSource(path: string): { sheet: boolean; delimiter: string } | null;
