// OCR hidden inputs remain only for legacy inline compatibility. New saves put
// both OCR and translation secrets in the backend vault; task payloads carry
// credential_ref and never render either secret into hidden DOM.
//
// 只在这一处渲染(WorkflowPanel.jsx 已把原先的静态占位 input 换成本
// 组件,注释里写明"隐藏凭据 input 由 3b credentials 域接管镜像")——全码库
// 只允许这一份,重复渲染会制造重复 DOM id。
//
// 受控(与蓝图原计划的"非受控 ref 挂 mirrorCredentialsToHiddenInputs"不同,
// 这里是刻意的实现调整,原因见下):直接订阅 credentialsStatePort.store 渲染
// value——实测(jsdom + React 18/19 host diff)证实,React 渲染的
// <input defaultValue> 一旦被外部代码用 mirrorCredentialsToHiddenInputs 的
// 裸 `node.value = x` 改写,只要这棵子树里*任何*兄弟组件重渲染提交
// (HeroUpload 在上传进度期间几乎每秒都在提交),React 的表单元素
// 受控态回收逻辑就会把 .value 悄悄拉回 defaultValue(""),等于把刚保存的
// token 静默清空——不是测试假象,生产环境同样会复现(上传中途 token 消失)。
// 让 credentialsStatePort 直接驱动 value= 从根上消除这个类别的问题:
// store 是唯一真值,DOM 只是投影,不存在"外部裸写 vs React 回收"的竞争。
// default-state-port.js 的 mirrorToDom(mirrorCredentialsToHiddenInputs)副作用
// 仍照常触发(browser.js 内部一路调用),现在只是多余但无害——真正生效的
// 写入路径是这里的 store 订阅。

import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useCredentialsServices } from "./credentials-context.jsx";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";

const { hidden: HIDDEN_IDS } = CREDENTIAL_DOM_IDS;

function selectCredentials(snapshot) {
  return snapshot.credentials;
}

export function HiddenCredentialInputs() {
  const { credentialsStatePort } = useCredentialsServices();
  const credentials = useStoreSnapshot(credentialsStatePort.store, selectCredentials);

  return (
    <>
      <input id={HIDDEN_IDS.ocrProvider} name="ocr_provider" type="hidden" value={credentials.ocrProvider || "paddle"} readOnly />
      <input id={HIDDEN_IDS.paddleToken} name="paddle_token" type="hidden" value={credentials.paddleToken || ""} readOnly />
    </>
  );
}
