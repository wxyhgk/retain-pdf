export declare function summarizeStatus(status: any): "任务已取消。" | "任务已失败，请检查报错提示后重试。" | "任务已完成，可以下载结果。" | "任务已提交，等待后端开始处理。" | "任务正在处理中，请等待当前阶段完成。" | "等待提交任务。";
export declare function summarizePublicError(payload: any): any;
export declare function summarizeDiagnostic(payload: any): string;
