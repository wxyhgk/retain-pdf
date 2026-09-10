// 状态徽标前置小图标(库存/翻译/处理中/失败/排队)。徽标本身很小,图标走
// 11px 细线 lucide 路径,和徽标文字同色(currentColor)。name 来自
// library-card-badge.js 返回的 icon key。

const PATHS = {
  // 馆藏:archive(带盖的收纳盒)——"入库存放但未翻译"
  archive: (
    <>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </>
  ),
  // 已翻译:languages(文/A 翻译标)
  languages: (
    <>
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </>
  ),
  // OCR 完成: scan-text
  "scan-text": (
    <>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 8h8M7 12h10M7 16h6" />
    </>
  ),
  // 处理中:loader-circle(转圈,配 animate-spin)
  loader: <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
  // 失败:circle-alert
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </>
  ),
  // 排队中:clock
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
};

export function BadgeIcon({ name }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="11"
      height="11"
      className={name === "loader" ? "animate-spin [animation-duration:1.1s]" : undefined}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
