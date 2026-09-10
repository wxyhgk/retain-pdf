// 工作流面板(翻译工作流卡片,对照 旧世界 HTML 骨架(已删除) 的
// .translation-workflow-card 区块逐 id 镜像)。
//
// - #job-warning:workflow 视图 store(updateJobWarning 桥回调写入)
// - #job-form:提交流程属 app-actions 域(3b),onSubmit 走 bridge.submitForm
//   (3a 为 preventDefault 占位;隐藏凭据 input 由 credentials 域的
//   HiddenCredentialInputs 接管,渲染唯一一份,不重复制造 DOM id)
// - 上传瓦片/动作组/行内错误盒分别由 upload 域组件与 InlineErrorBox 落位
//
// Decoupled: HiddenCredentialInputs 不再由 workflow 直接 import(曾是
// workflow → credentials 跨域耦合),改为由 HomeApp/TranslationWorkflowDialog
// 经 props/slot 注入(hiddenInputsSlot)。workflow 域只管渲染 slot。
//
// 提交链路(显性化,不改行为,签名/事件名不变):
//   [1] 表单校验(form onSubmit → handleSubmit → bridge.submitForm,3a 仅
//       preventDefault 占位)——成功→ 进组参;失败→ 停留本框,由 InlineErrorBox
//       展示行内错误,不发请求。
//   [2] 组参(真机分支由 submit-flow.collectRunPayload 组装 runPayload)——
//       成功→ 进提交;失败(缺 upload/凭证/render 源/预算拦截)→ 返回 blocked,
//       落 error-box + 按需弹配置框,不发请求。
//   [3] 提交(submitJobRequest)——成功→ 进接进度;失败(missing_upload)→
//       回上传态,其余→ error-box 诊断,不关框。
//   [4] 接进度(publishSubmitSuccess: sync 快照→ renderJob → startJobPolling)——
//       成功→ 进关框;任一步缺回调则跳过(可选口),不抛错。
//   [5] 关框(dispatch APP_EVENTS.closeTranslationWorkflow)——成功→
//       runtime.close 落状态 + 解除书库刷新挂起;失败(无 document 监听)则仅
//       丢事件,不影响已启动的轮询。
// 本文件只负责 [1] 的入口转发:handleSubmit 成功→ bridge.submitForm 接管
// [2]-[5];失败→ 浏览器默认提交被阻止,停留本视图。

import { Languages, ScanSearch } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useHomeServices } from "@/app/home/home-services-context.js";
import { HeroUpload } from "./components/UploadTile.jsx";
import { InlineErrorBox } from "./InlineErrorBox.jsx";

export function WorkflowPanel({ hiddenInputsSlot = null }: { hiddenInputsSlot?: React.ReactNode | null }) {
  const services = useHomeServices();
  const workflow = useStoreSnapshot(services.stores.workflowView);
  const ocrOnly = Boolean(workflow.ocrOnly);

  // [1] 表单校验入口:成功→ bridge.submitForm 接管后续组参/提交/接进度/关框;
  // 失败→ 仅阻止默认提交,停留本框(错误由 InlineErrorBox 行内展示)。
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    services.bridge.submitForm(event);
  }

  function handleModeChange(value: string) {
    const nextOcrOnly = value === "ocr";
    if (nextOcrOnly === ocrOnly) return;

    services.workflowViewActions.setOcrOnly(nextOcrOnly);
    services.features.workflowFeature?.refreshSubmitControls?.();
    services.features.workflowFeature?.applyWorkflowMode?.();
  }

  return (
    <section className="translation-workflow-card">
      <div id="job-warning" className={`job-warning${workflow.jobWarningVisible ? "" : " hidden"}`}>
        检测到上一个任务仍在处理中。建议先等待当前任务结束，再提交新的 PDF。
      </div>

      <TabsPrimitive.Root
        value={ocrOnly ? "ocr" : "translate"}
        onValueChange={handleModeChange}
        className="upload-workflow-mode-tabs"
      >
        <TabsPrimitive.List id="ocr-only-toggle" className="upload-workflow-mode-tabs-list" aria-label="工作流模式">
          <TabsPrimitive.Trigger value="translate" className="upload-workflow-mode-tab" aria-label="翻译模式">
            <Languages aria-hidden="true" />
            翻译
          </TabsPrimitive.Trigger>
          <TabsPrimitive.Trigger value="ocr" className="upload-workflow-mode-tab" aria-label="仅 OCR 模式">
            <ScanSearch aria-hidden="true" />
            仅 OCR
          </TabsPrimitive.Trigger>
        </TabsPrimitive.List>
      </TabsPrimitive.Root>

      <form
        id="job-form"
        className="form"
        noValidate
        onSubmit={handleSubmit}
      >
        {hiddenInputsSlot}

        <HeroUpload />
        <InlineErrorBox />
      </form>
    </section>
  );
}
