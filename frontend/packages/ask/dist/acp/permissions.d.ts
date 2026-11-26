import type { RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";
/** 等用户点的许可请求（按 toolCallId 认；窗口在那张工具卡片上画按钮）。 */
export type PendingPermission = {
    request: RequestPermissionRequest;
    resolve: (response: RequestPermissionResponse) => void;
};
export declare class PermissionStore {
    private pending;
    private listeners;
    private version;
    add(request: RequestPermissionRequest): Promise<RequestPermissionResponse>;
    get(toolCallId: string): PendingPermission | undefined;
    all(): PendingPermission[];
    /** 关窗 / 停下时，没回的都按取消回掉，agent 不会一直等。 */
    cancelAll(): void;
    subscribe: (listener: () => void) => () => boolean;
    snapshot: () => number;
    private bump;
}
