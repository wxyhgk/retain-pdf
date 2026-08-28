// Biểu tượng đường nét dụng cụ khoa học (Kimi tạo, stroke dùng currentColor)
// Tài nguyên: src/assets/icons/instruments/

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
  /** Kích thước hiển thị, mặc định 40 */
  size?: number;
  className?: string;
  title?: string;
};

/**
 * Dùng mask để nhận currentColor, nhờ đó icon đi theo ink/muted khi đổi skin.
 * (Thẻ <img> thuần không thể kế thừa stroke currentColor.)
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
