// 厂商 / 模型的标志（登记在 platform/config/brand-logos.ts）。
//
// 彩色标志照原样用 <img>；单色标志（OpenAI、Anthropic、xAI……）用 CSS mask 画成当前文字颜色，暗色主题下也看得见
// （当普通图片放是固定的黑色）。尺寸由调用方的 className 定，默认 1em。装饰用，读屏跳过（名字在旁边的字里）。
import type { CSSProperties } from "react";
import type { BrandLogo as BrandLogoEntry } from "@/platform/config/brand-logos.js";

export function BrandLogo({ logo, className = "" }: { logo: BrandLogoEntry | null | undefined; className?: string }) {
  if (!logo) return null;
  const classes = `brand-logo${className ? ` ${className}` : ""}`;
  if (!logo.mono) {
    return <img className={classes} src={logo.src} alt="" aria-hidden="true" title={logo.name} data-brand-logo={logo.src} />;
  }
  // 地址直接写进内联样式：写在 CSS 变量里的相对地址，各浏览器按哪个文件解析不一致；内联样式按页面地址解析。
  const image = `url("${logo.src}")`;
  const style: CSSProperties = { WebkitMaskImage: image, maskImage: image };
  return <span className={classes} data-mono="true" style={style} aria-hidden="true" title={logo.name} data-brand-logo={logo.src} />;
}
