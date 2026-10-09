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
import {
  useHomeBridge,
  useHomeFeatures,
  useHomeUploadViewStore,
} from "@/ui/context/home-services-context.js";
import { useIngestWorkflowView } from "./workflow-view-context.js";
import type { UploadViewStore } from "../domain/upload-store.js";
import { HeroUpload } from "./components/UploadTile.jsx";
import { InlineErrorBox } from "./InlineErrorBox.jsx";

export function WorkflowPanel({ hiddenInputsSlot = null }: { hiddenInputsSlot?: React.ReactNode | null }) {
  const workflowView = useIngestWorkflowView();
  const uploadViewStore = useHomeUploadViewStore();
  const bridge = useHomeBridge();
  const features = useHomeFeatures();
  const workflow = useStoreSnapshot(workflowView.store);
  const ocrOnly = Boolean(workflow.ocrOnly);

  // [1] 表单校验入口:成功→ bridge.submitForm 接管后续组参/提交/接进度/关框;
  // 失败→ 仅阻止默认提交,停留本框(错误由 InlineErrorBox 行内展示)。
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    bridge.submitForm(event);
  }

  // 模式切换是 ocrOnly 的唯一写入点，「仅 OCR」下该收起的东西也只能在这里收。
  //
  // 「翻译选项」面板(TranslationOptionsPanel)的显隐只看 upload.translationOptionsOpen，
  // 而它的开关按钮 #page-range-btn 在 ProcessingChoicePanel 里带了 `&& !ocrOnly`。
  // 于是曾经出现过:在「翻译」下展开选项面板，再切到「仅 OCR」——面板原地留在
  // 屏上(标题还写着「翻译选项」)，开关按钮却消失了，成了没有入口的孤儿。
  //
  // 为什么是「收起」而不是「保留面板 + 改文案」：页码范围本身对 OCR 任务是有效
  // 的(payload-assembly.collectRunPayload 在 ocrOnly 分支里照样把 pageRanges
  // 塞进 ocr.page_ranges，书籍详情页的「OCR 选定页码」也走同一条路)，但这个面板
  // 在上传弹窗里被定位成「翻译选项」:一半是页码范围、一半是术语表(纯翻译概念)，
  // 而且产品已经决定 OCR 模式下不给选项入口(#page-range-btn 的 !ocrOnly 是既有
  // 行为，不在本次修复范围)。既然没有入口，面板就不该独自留在屏上。
  //
  // 收起只翻 translationOptionsOpen 这个开关，closeTranslationOptions 刻意不清
  // pageRangeStart/End(见 upload/view-actions.ts)，所以已填的页码不会丢:切回
  // 「翻译」重新展开还在，切到 OCR 提交也仍然按这个范围跑。
  function handleModeChange(value: string) {
    const nextOcrOnly = value === "ocr";
    if (nextOcrOnly === ocrOnly) return;

    workflowView.setOcrOnly(nextOcrOnly);
    if (nextOcrOnly) {
      (uploadViewStore as unknown as UploadViewStore).actions.closeTranslationOptions();
    }
    features.workflowFeature?.refreshSubmitControls?.();
    features.workflowFeature?.applyWorkflowMode?.();
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
