/**
 * 和 Python 侧的契约。
 *
 * 排版规格由 `retainpdf_pipeline` 算（`build_render_page_specs` 那几千行逻辑搬不动，
 * 也不该搬），这边只负责把规格变成 Word 文档。所以这个文件定义的是那条缝。
 *
 * 校验写得啰嗦是有原因的:上一版 Python 导出在参数对不上时只会让子进程非零退出，
 * 调用方看到的是一句 "failed to build layout-docx"，看不出哪里错了。这里每一条都
 * 指名道姓说出是哪一页哪一块的哪个字段。
 */

const DEFAULT_MATH_FONT = "Cambria Math";

function fail(message) {
  const error = new Error(message);
  error.code = "RETAINPDF2DOC_INVALID_SPEC";
  throw error;
}

function finiteNumber(value, where) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) fail(`${where} 不是有限数值：${JSON.stringify(value)}`);
  return numeric;
}

function positive(value, where) {
  const numeric = finiteNumber(value, where);
  if (numeric <= 0) fail(`${where} 必须为正：${numeric}`);
  return numeric;
}

function parseRect(value, where) {
  if (!Array.isArray(value) || value.length !== 4) {
    fail(`${where} 必须是 [x0, y0, x1, y1] 四个数，收到 ${JSON.stringify(value)}`);
  }
  const [x0, y0, x1, y1] = value.map((item, index) => finiteNumber(item, `${where}[${index}]`));
  if (x1 <= x0 || y1 <= y0) fail(`${where} 的右下角不在左上角之后：${JSON.stringify(value)}`);
  return { x0, y0, x1, y1 };
}

function parseBlock(raw, where) {
  if (!raw || typeof raw !== "object") fail(`${where} 不是对象`);
  const text = `${raw.text ?? ""}`;
  const rect = parseRect(raw.rect, `${where}.rect`);
  const fontSizePt = positive(raw.fontSizePt, `${where}.fontSizePt`);
  // lineStepPt 是**基线间距**，不是行高倍数。Python 那边要么从译文 PDF 量到，要么由
  // html_fit 按实测比值算出来——这边不再自己折算，折算过一次，系统性高 21%。
  const lineStepPt = positive(raw.lineStepPt, `${where}.lineStepPt`);
  return {
    id: `${raw.id ?? ""}`,
    rect,
    text,
    fontSizePt,
    lineStepPt,
    bold: Boolean(raw.bold),
    justify: Boolean(raw.justify),
    firstLineIndentPt: Math.max(0, finiteNumber(raw.firstLineIndentPt ?? 0, `${where}.firstLineIndentPt`)),
  };
}

function parsePage(raw, index) {
  const where = `pages[${index}]`;
  if (!raw || typeof raw !== "object") fail(`${where} 不是对象`);
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const background = raw.background ?? null;
  if (background !== null && typeof background.path !== "string") {
    fail(`${where}.background.path 缺失——有背景图就必须给出它的路径`);
  }
  // 水印（2026-11-20）：这一页水印放在哪，[x0, y0, x1, y1]（pt，页面坐标）；图在规格顶层的 watermark.path
  const watermark = raw.watermark ? { rect: parseRect(raw.watermark.rect, `${where}.watermark.rect`) } : null;
  return {
    pageIndex: Number.isInteger(raw.pageIndex) ? raw.pageIndex : index,
    watermark,
    widthPt: positive(raw.widthPt, `${where}.widthPt`),
    heightPt: positive(raw.heightPt, `${where}.heightPt`),
    background: background ? { path: background.path } : null,
    blocks: blocks
      .map((block, blockIndex) => parseBlock(block, `${where}.blocks[${blockIndex}]`))
      // 没有文字的块不产出文本框:空框会在 Word 里留下一个可选中的透明矩形。
      .filter((block) => block.text.trim().length > 0),
  };
}

export function parseSpec(raw) {
  if (!raw || typeof raw !== "object") fail("规格不是一个 JSON 对象");
  if (raw.version !== 1) {
    fail(`规格版本 ${JSON.stringify(raw.version)} 不认识，这个版本只认 1`);
  }
  const pages = Array.isArray(raw.pages) ? raw.pages : [];
  if (pages.length === 0) fail("规格里一页都没有");
  const font = raw.font ?? {};
  if (!font.family) fail("font.family 缺失——文本框声明的字体必须和 Python 侧量宽度用的那个一致");
  const watermark = raw.watermark ?? null;
  if (watermark !== null && typeof watermark.path !== "string") {
    fail("watermark.path 缺失——要放水印就必须给出水印图的路径");
  }
  return {
    job: { id: `${raw.job?.id ?? ""}`, title: `${raw.job?.title ?? ""}` },
    watermark: watermark ? { path: watermark.path } : null,
    font: {
      family: `${font.family}`,
      mathFamily: `${font.mathFamily || DEFAULT_MATH_FONT}`,
    },
    pages: pages.map(parsePage),
  };
}
