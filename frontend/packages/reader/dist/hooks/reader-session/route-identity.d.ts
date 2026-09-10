export declare function useLocationKey(): string;
export type RouteIdentity = {
    locationKey: string;
    jobId: string;
    routeDocumentId: string;
    sessionIdentity: string;
};
/**
 * document_id 是稳定的文档身份，即使兼容的 legacy 链接同时携带 job_id
 * 也不互斥：job 选择不可变产物快照；document 拥有会话/标注与 Agent 操作。
 */
export declare function useRouteIdentity(): RouteIdentity;
//# sourceMappingURL=route-identity.d.ts.map