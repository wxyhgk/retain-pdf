/** AI 运行时的宿主绑定。
 *
 * 这个文件曾经还装着阅读器 AI 问答面板的三个端口（askChat / conversations /
 * aiOperations）。那个面板删掉了 —— 阅读页现在只有一扇 AI 的门，就是终端里的
 * agent。剩下的两件事是**首页的「问」也要用**的：
 *
 * - setReaderAiConfigAdapters / setAnswerEnhanceAdapters：把凭据、模型默认值、
 *   受保护图片的取法注册给 reader 包里的 AI 运行时
 * - `export *`：把那套运行时转出去给 features/ask 和 features/credentials
 *
 * 它还住在 features/reader/ 下面是历史位置 —— 首页伸手进阅读器的 domain 拿
 * 东西，本来就该挪，但那是另一件事。
 */
import { resolveResourceUrl } from "@retainpdf/domain/job";
import * as readerAi from "@retainpdf/reader/runtime/ai";
import {
  defaultModelBaseUrl,
  defaultModelName,
} from "@/platform/config/runtime.js";
import {
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
} from "@/platform/config/persisted-config.js";
import {
  getDefaultCredentialsStatePort,
} from "@/platform/contracts/credentials-contract.js";
import { fetchProtected } from "./data.js";

// 注册点参数类型直接取自 reader 包公开工厂签名，避免 any 掩盖契约漂移。
type ReaderAiConfigAdapters = NonNullable<
  Parameters<typeof readerAi.setReaderAiConfigAdapters>[0]
>;
type AnswerEnhanceAdapters = NonNullable<
  Parameters<typeof readerAi.setAnswerEnhanceAdapters>[0]
>;

readerAi.setReaderAiConfigAdapters({
  // 惰性读取 platform 注册表：不直接 import credentials feature，
  // reader 页由 app/reader/adapters 注入真值，home 经注册表拿到默认实现。
  credentialsPort: {
    getCredentials: () => getDefaultCredentialsStatePort()?.getCredentials() ?? null,
  },
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
  defaultModelBaseUrl,
  defaultModelName,
} satisfies ReaderAiConfigAdapters);
readerAi.setAnswerEnhanceAdapters({
  fetchProtected: fetchProtected as typeof fetch,
  resolveResourceUrl,
} satisfies AnswerEnhanceAdapters);

export * from "@retainpdf/reader/runtime/ai";
