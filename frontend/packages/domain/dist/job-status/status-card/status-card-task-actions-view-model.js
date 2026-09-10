import { resolveJobActions } from "../../job/actions.js";
export function buildStatusCardTaskActions({ job = null, } = {}) {
    const actions = resolveJobActions(job);
    return {
        // 取消接口有稳定的标准路由（由前端 cancelJob/cancelOcrJob 按 job_id
        // 构造），不应要求每一种任务投影都重复返回 actions.cancel.url。
        // 后端明确 enabled=false 时仍尊重禁用；否则 queued/running 可取消。
        cancelEnabled: actions.cancelEnabled,
    };
}
