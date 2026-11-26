import type { AskHandlers, AskSession } from "../contract.js";
export type AcpSocketOptions = {
    /** session/new 的 cwd 和 mcpServers。RetainPDF 的桥空着就会自己填书文件夹、补上 retainpdf mcp。 */
    cwd?: string;
};
export declare function openAcpWebSocketSession(url: string, handlers: AskHandlers, options?: AcpSocketOptions): Promise<AskSession>;
