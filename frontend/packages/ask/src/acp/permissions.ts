// 等用户点的许可请求（session/request_permission）：窗口在那张工具卡片上画「允许 / 拒绝」，用户点了才回给 agent。
import type { RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";

/** 等用户点的许可请求（按 toolCallId 认；窗口在那张工具卡片上画按钮）。 */
export type PendingPermission = {
  request: RequestPermissionRequest;
  resolve: (response: RequestPermissionResponse) => void;
};

export class PermissionStore {
  private pending = new Map<string, PendingPermission>();
  private listeners = new Set<() => void>();
  private version = 0;

  add(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    return new Promise((resolve) => {
      const key = request.toolCall.toolCallId;
      this.pending.set(key, {
        request,
        resolve: (response) => {
          this.pending.delete(key);
          this.bump();
          resolve(response);
        },
      });
      this.bump();
    });
  }

  get(toolCallId: string): PendingPermission | undefined {
    return this.pending.get(toolCallId);
  }

  all(): PendingPermission[] {
    return [...this.pending.values()];
  }

  /** 关窗 / 停下时，没回的都按取消回掉，agent 不会一直等。 */
  cancelAll(): void {
    for (const item of [...this.pending.values()]) item.resolve({ outcome: { outcome: "cancelled" } });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot = () => this.version;

  private bump() {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
