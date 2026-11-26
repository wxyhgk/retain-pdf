import type { AskAgentCapabilities, AskHandlers, AskSession } from "../contract.js";
export type AcpSocketOptions = {
    /** session/new 的 cwd 和 mcpServers。RetainPDF 的桥空着就会自己填书文件夹、补上 retainpdf mcp。 */
    cwd?: string;
};
/** initialize 结果里的 agentCapabilities._meta.retainpdf（自带 agent 报，见 docs/api/16-AI/02-主对话和记忆.md）；只认布尔值。 */
export declare function retainpdfCapabilities(initialized: unknown): AskAgentCapabilities;
export declare function openAcpWebSocketSession(url: string, handlers: AskHandlers, options?: AcpSocketOptions): Promise<AskSession>;
