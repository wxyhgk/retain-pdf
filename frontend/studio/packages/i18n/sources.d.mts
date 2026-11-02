export declare function studioSources(projectRoot: string): Promise<string[]>;
export declare function readWords(projectRoot: string, path: string): Promise<{ translatable: string[]; untranslated: Array<{ line: number; text: string }> }>;
