export type FontInfo = {
    family: string;
    files: string[];
    available: boolean;
};
export declare function listFonts(apiPrefix?: string): Promise<FontInfo[]>;
export declare function uploadFont(apiPrefix: string, file: File | Blob, fileName?: string): Promise<FontInfo>;
export declare function uploadFontFile(file: File | Blob, fileName?: string): Promise<FontInfo>;
