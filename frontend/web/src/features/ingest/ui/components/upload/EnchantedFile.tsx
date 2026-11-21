// 上传框里选好的 PDF：只写文件名；底部按钮选了什么，就在这张卡上叠一层效果，像游戏里给装备附魔（2026-11-20 用户）。
// 克制、可叠加，每一层对应一项：
// - 模型：卡片右上角一枚小印记（模型短名）；
// - Agent：卡片外一圈慢慢转的光环，几颗小星点；
// - 页数：卡片后面错开两张纸，左下挂一条书签写着页码；
// 叠得越多，卡片的光越亮一点（data-level）。每加一项闪一下（shimmer 扫过），之后静止；
// 系统开了「减少动态效果」就都不动。
import { Bot, FileStack, FileText } from "lucide-react";

export type FileEnchants = {
  /** 模型短名（只在换过模型时给，默认模型不算附魔）。 */
  model?: string;
  agent?: boolean;
  /** 页码短写（「1–10 页」），空 = 全部页。 */
  pages?: string;
};

export function enchantLevel(enchants: FileEnchants): number {
  return [enchants.model, enchants.agent, enchants.pages].filter(Boolean).length;
}

export function EnchantedFile({ name, enchants, uploading = false }: { name: string; enchants: FileEnchants; uploading?: boolean }) {
  const level = enchantLevel(enchants);
  const signature = `${enchants.model || ""}|${enchants.agent ? 1 : 0}|${enchants.pages || ""}`;
  return (
    <div
      className="upload-file"
      data-level={level}
      data-agent={enchants.agent || undefined}
      data-pages={enchants.pages ? "true" : undefined}
      data-model={enchants.model ? "true" : undefined}
      data-uploading={uploading || undefined}
    >
      {enchants.agent ? (
        <span className="upload-file-aura" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : null}
      {enchants.pages ? <span className="upload-file-sheets" aria-hidden="true" /> : null}
      <div className="upload-file-card" title={name}>
        <span className="upload-file-icon" aria-hidden="true">
          <FileText />
        </span>
        <strong className="upload-file-name">{name}</strong>
        {/* 换一次附魔闪一下：key 变了这一层重新挂上，动画再放一遍。 */}
        {level ? <span key={signature} className="upload-file-flash" aria-hidden="true" /> : null}
        {enchants.model ? (
          <span className="upload-file-sigil" title={`模型：${enchants.model}`}>
            {enchants.model}
          </span>
        ) : null}
        {enchants.pages ? (
          <span className="upload-file-ribbon">
            <FileStack aria-hidden="true" />
            {enchants.pages}
          </span>
        ) : null}
        {enchants.agent ? (
          <span className="upload-file-agent" title="Agent 翻译">
            <Bot aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
