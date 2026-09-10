// 科学仪器线标（Kimi 生成，currentColor 描边）
// 资源：src/assets/icons/instruments/

export type InstrumentName =
  | "microscope"
  | "flask"
  | "atom"
  | "spectrum"
  | "telescope"
  | "balance";

const SRC: Record<InstrumentName, string> = {
  microscope: "src/assets/icons/instruments/instrument-microscope.svg",
  flask: "src/assets/icons/instruments/instrument-flask.svg",
  atom: "src/assets/icons/instruments/instrument-atom.svg",
  spectrum: "src/assets/icons/instruments/instrument-spectrum.svg",
  telescope: "src/assets/icons/instruments/instrument-telescope.svg",
  balance: "src/assets/icons/instruments/instrument-balance.svg",
};

export type InstrumentIconProps = {
  name: InstrumentName;
  /** 显示尺寸，默认 40 */
  size?: number;
  className?: string;
  title?: string;
};

/**
 * 用 mask 吃 currentColor，这样主题换肤时图标跟 ink/muted 走。
 * （纯 <img> 无法继承 stroke currentColor）
 */
export function InstrumentIcon({
  name,
  size = 40,
  className = "",
  title,
}: InstrumentIconProps) {
  const src = SRC[name];
  if (!src) return null;
  const style = {
    width: size,
    height: size,
    backgroundColor: "currentColor",
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  } as const;

  return (
    <span
      className={`instrument-icon ${className}`.trim()}
      style={style}
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      title={title}
    />
  );
}
