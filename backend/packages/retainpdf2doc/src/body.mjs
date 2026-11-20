/**
 * 排版规格 → Word 文档主体 XML。
 *
 * 每一页是:一张铺满页面的背景图（原始扫描件，压在最底下）+ 若干个绝对定位的文本框，
 * 每个文本框对应排版层的一个块，用的是排版层算好的字号和基线间距。
 *
 * 文本框用 **DrawingML**（`wp:anchor` → `wps:wsp` → `wps:txbx`），不是 VML。
 * Python 那版用的是 VML（`v:shape`/`v:textbox`），有两个实际问题:
 *   - VML 是 Office 2007 之前的遗留格式，新版 Word 对它的支持一直在退化；
 *   - 更要紧的是 VML 文本框**不裁切**。字稍微排多一点就糊到相邻块上，而 DrawingML
 *     的 `bodyPr` 有 `vertOverflow="clip"`，多出来的会被裁掉而不是盖住别人。
 *
 * # `normAutofit` 而不是 `noAutofit`
 *
 * 字号和行距是导出时按 `resources/fonts/SourceHanSerifSC-Regular.otf` 的字形宽度算的，
 * 而 docx 只**声明**这个字体名、**没有嵌入**它（24.5MB，33 倍于已嵌入的公式字体，
 * 不子集化没法带）。打开文档的机器上没装这个字体时 Word 会替换，字形宽度一变，
 * 同一段文字就换行成更多行 —— 总高超过框，被上面那个 `vertOverflow="clip"` 裁掉。
 * 这就是「有些块会溢出/被截断」。
 *
 * `noAutofit` 是明确告诉 Word「别缩，裁掉」。换成 `normAutofit` 让它在装不下时自己
 * 缩字号 —— 宁可小一点也别少字。
 *
 * **已知局限**：Word 重算 autofit 的时机是编辑时，不保证打开就生效。所以这不是
 * 替代嵌入字体的方案，是读不到正确字体时的兜底。
 *
 * **不要把 `w:lineRule` 从 `exact` 换成 `auto`**：`exact` 让「N 行占 N×行距」这个账
 * 算得准，是框内布局的前提。`auto` 会让行高跟着替换字体的自然行距走，而 CJK 字体
 * 行间距很大，1.289 倍可能变成 1.8 倍字号 —— 比现在更糟。
 */

import { rawXml, xml } from "../vendor/visualtex/office/docx/ooxml/xml.ts";
import { latexToOmml } from "./formula.mjs";

const EMU_PER_POINT = 12700;
const TWIPS_PER_POINT = 20;

/**
 * 公式边界。
 *
 * `$$...$$` 放在前面:否则 `$$a$$` 会被当成两个空的行内公式。
 *
 * 行内那支的公式体写成 `(?:\\.|[^$\n])`，即**转义序列整体吞掉**。写成 `[^$\n]` 是
 * 不行的——那样公式体里就不能出现美元符，而 `$\$1.4$`（正文里的价格）就匹配不上，
 * 整串会被当字面文本印进文档。真实语料里就有这么一处。
 *
 * 转义按对吞掉之后，结尾的 `$` 一定是真的定界符，不需要再加 `(?<!\\)` 后顾。
 */
const MATH_RE = /\$\$([\s\S]+?)\$\$|(?<!\\)\$((?:\\.|[^$\n])+?)\$/g;

/** 没有底数的上/下标，比如引文标记 `$^{[1]}$`。
 *
 * **为什么要单独认**：MathJax 会把它转成 `<m:sSup>` 且 `<m:e>` 是**空的**，而 Word
 * 对空的数学元素画一个虚线占位框 —— 用户看到的是每个引文标记前面多一个空方框。
 * 实测 19 个 job 的前 6 页共 1561 个公式，**369 个（23.6%）是这种**，分布在 13 本书上。
 *
 * 而且它本来也不是数学：引文上标就是「带上标格式的文本」，用 `w:vertAlign` 表达更
 * 准确，也不用把 Latin Modern Math 那套字体套上去。 */
const BARE_SCRIPT_RE = /^\s*([_^])\s*(?:\{([^{}]*)\}|([^{}\s]))\s*$/;

const emu = (pt) => Math.round(pt * EMU_PER_POINT);
const twips = (pt) => Math.round(pt * TWIPS_PER_POINT);
/** pt → 半磅（w:sz 的单位）。
 *
 * **向下取整，不是四舍五入。** Python 侧是按**未取整**的字号判「这个块装得下吗」的，
 * 而 `Math.round` 会把 9.8pt 写成 10pt —— 判定按 9.8 做，Word 按 10 排，凭空多出来的
 * 那 0.2pt 就可能多断一行。实测用户那个 job：54 个块里 **35 个（65%）**被取整取大。
 *
 * 向下取整只会让字更小，方向和「宁可小一点也别溢出」一致。 */
const halfPoints = (pt) => Math.max(1, Math.floor(pt * 2));

function runProperties(block, fontFamily, vertAlign = null) {
  return xml("w:rPr", {}, [
    rawXml(xml("w:rFonts", {
      "w:ascii": fontFamily,
      "w:hAnsi": fontFamily,
      "w:eastAsia": fontFamily,
      "w:cs": fontFamily,
    })),
    block.bold ? rawXml(xml("w:b")) : undefined,
    block.bold ? rawXml(xml("w:bCs")) : undefined,
    rawXml(xml("w:sz", { "w:val": halfPoints(block.fontSizePt) })),
    rawXml(xml("w:szCs", { "w:val": halfPoints(block.fontSizePt) })),
    vertAlign ? rawXml(xml("w:vertAlign", { "w:val": vertAlign })) : undefined,
  ]);
}

function textRun(text, block, fontFamily, strong = false, vertAlign = null) {
  return xml("w:r", {}, [
    rawXml(runProperties(strong ? { ...block, bold: true } : block, fontFamily, vertAlign)),
    // xml:space=preserve:行首行尾的空格是排版的一部分，丢了字就挤在一起。
    rawXml(xml("w:t", { "xml:space": "preserve" }, [text])),
  ]);
}

/**
 * 一行文字 → 若干个 run，公式部分换成原生 OMML。
 *
 * 公式转换失败时**保留原始 LaTeX 文本**而不是让整篇导出失败——一个写坏的公式不该
 * 毁掉整份文档，而且把源码显示出来，用户至少看得见那里本来是什么。失败会记进
 * `errors`，由调用方决定要不要报。
 */
/** markdown 的强调标记。
 *
 * **为什么非处理不可**：`page_specs.py` 给的是
 * `plain_text if render_kind == "plain" else markdown_text` —— 非 plain 的块交的是
 * **原始 markdown**。而这里原来只解析 `$...$`，于是 `**1k**` 被原样印成带星号的
 * 文本，既没加粗又多了四个字符。实测 19 个 job 的前 8 页共 820 个块，**44 个（5.4%）
 * 带 `**`**，分布在 6 本书上。
 *
 * 只收 `**`（强调），不碰 `*`：单星号在化学名和脚注里是正常字符，而译文里的强调
 * 一律是双星号。贪婪匹配会把两处强调之间的正文也吃掉，所以用 `+?`。 */
const STRONG_RE = /\*\*([^*\n]+?)\*\*/g;

/** 把一段纯文本切成若干 run，`**…**` 的部分加粗。 */
function pushText(runs, text, block, fontFamily) {
  if (!text) return;
  let cursor = 0;
  STRONG_RE.lastIndex = 0;
  for (let match = STRONG_RE.exec(text); match; match = STRONG_RE.exec(text)) {
    if (match.index > cursor) {
      runs.push(rawXml(textRun(text.slice(cursor, match.index), block, fontFamily)));
    }
    runs.push(rawXml(textRun(match[1], block, fontFamily, true)));
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    runs.push(rawXml(textRun(text.slice(cursor), block, fontFamily)));
  }
}

function inlineRuns(line, block, fontFamily, errors) {
  const runs = [];
  let cursor = 0;
  MATH_RE.lastIndex = 0;
  for (let match = MATH_RE.exec(line); match; match = MATH_RE.exec(line)) {
    if (match.index > cursor) {
      pushText(runs, line.slice(cursor, match.index), block, fontFamily);
    }
    // `$$...$$` 和 `$...$` 产出一样的 OMML（见 formula.mjs）。正则要分开两支只是
    // 为了让 `$$a$$` 被当成**一个**公式吃掉，否则会解析成两个空的行内公式。
    const latex = match[1] !== undefined ? match[1] : match[2];
    const bare = BARE_SCRIPT_RE.exec(latex);
    if (bare) {
      const content = bare[2] !== undefined ? bare[2] : bare[3];
      if (content) {
        runs.push(rawXml(textRun(
          content, block, fontFamily, false,
          bare[1] === "^" ? "superscript" : "subscript",
        )));
      }
      cursor = match.index + match[0].length;
      continue;
    }
    try {
      const omml = latexToOmml(latex);
      runs.push(rawXml(omml));
    } catch (error) {
      errors.push({ blockId: block.id, latex, message: error.message });
      runs.push(rawXml(textRun(match[0], block, fontFamily)));
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) {
    pushText(runs, line.slice(cursor), block, fontFamily);
  }
  return runs;
}

function paragraph(line, block, fontFamily, errors) {
  const properties = [
    rawXml(xml("w:spacing", {
      "w:before": 0,
      "w:after": 0,
      // lineStepPt 是基线间距，由 Python 侧给出（读回译文 PDF 量到的，或 html_fit 按
      // 实测比值算的）。这里绝不自己拿 leading_em 折算——折算过一次，高 21%。
      "w:line": twips(block.lineStepPt),
      "w:lineRule": "exact",
    })),
    block.firstLineIndentPt > 0
      ? rawXml(xml("w:ind", { "w:firstLine": twips(block.firstLineIndentPt) }))
      : undefined,
    rawXml(xml("w:jc", { "w:val": block.justify ? "both" : "left" })),
    // **允许西文词中间断行**（中日韩文档的兼容开关，val=0 = 不保持整词）。
    //
    // Word 默认不在西文词中间断行，而 Typst 会。化学论文正文里全是长拉丁词
    // （`2-(4-methoxyphenyl)`、`1-s2.0-S2468823121003047`），一个断不开的词就能把
    // 半行浪费掉。按「西文不断词」估算这个 job 的前 6 页，20 个块里 12 个会超框，
    // 而同样的内容在 PDF 里**一个都不超**（最挤的只占 0.90×）。
    //
    // 这是 Word 和 Typst 断行差异里能直接关掉的那一项。剩下的（两端对齐的伸缩、
    // 行内 OMML 的宽度）没有对应开关，只能靠余量。
    rawXml(xml("w:wordWrap", { "w:val": "0" })),
  ];
  return xml("w:p", {}, [
    rawXml(xml("w:pPr", {}, properties)),
    ...inlineRuns(line, block, fontFamily, errors),
  ]);
}

function blockTextbox(block, pageIndex, blockIndex, fontFamily, errors) {
  const widthEmu = Math.max(EMU_PER_POINT, emu(block.rect.x1 - block.rect.x0));
  const heightEmu = Math.max(EMU_PER_POINT, emu(block.rect.y1 - block.rect.y0));
  const shapeId = 3000 + pageIndex * 10000 + blockIndex;
  const lines = block.text.split("\n");
  const content = lines.map((line) => rawXml(paragraph(line, block, fontFamily, errors)));

  return xml("w:r", {}, [
    rawXml(xml("w:drawing", {}, [
      rawXml(xml("wp:anchor", {
        distT: 0, distB: 0, distL: 0, distR: 0,
        simplePos: 0,
        // 比背景图（0）高，这样文字压在扫描件上面。
        relativeHeight: 251658240,
        behindDoc: 0, locked: 0, layoutInCell: 1, allowOverlap: 1,
      }, [
        rawXml(xml("wp:simplePos", { x: 0, y: 0 })),
        rawXml(xml("wp:positionH", { relativeFrom: "page" }, [
          rawXml(xml("wp:posOffset", {}, [emu(block.rect.x0)])),
        ])),
        rawXml(xml("wp:positionV", { relativeFrom: "page" }, [
          rawXml(xml("wp:posOffset", {}, [emu(block.rect.y0)])),
        ])),
        rawXml(xml("wp:extent", { cx: widthEmu, cy: heightEmu })),
        rawXml(xml("wp:effectExtent", { l: 0, t: 0, r: 0, b: 0 })),
        rawXml(xml("wp:wrapNone")),
        rawXml(xml("wp:docPr", {
          id: shapeId,
          name: `block ${pageIndex + 1}-${blockIndex}${block.id ? ` ${block.id}` : ""}`,
        })),
        rawXml(xml("wp:cNvGraphicFramePr")),
        rawXml(xml("a:graphic", {}, [
          rawXml(xml("a:graphicData", {
            uri: "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
          }, [
            rawXml(xml("wps:wsp", {}, [
              rawXml(xml("wps:cNvSpPr", { txBox: 1 })),
              rawXml(xml("wps:spPr", {}, [
                rawXml(xml("a:xfrm", {}, [
                  rawXml(xml("a:off", { x: 0, y: 0 })),
                  rawXml(xml("a:ext", { cx: widthEmu, cy: heightEmu })),
                ])),
                rawXml(xml("a:prstGeom", { prst: "rect" }, [rawXml(xml("a:avLst"))])),
                // 不透明白底:把背景图里的原文盖掉，否则译文和原文叠在一起。
                rawXml(xml("a:solidFill", {}, [rawXml(xml("a:srgbClr", { val: "FFFFFF" }))])),
                rawXml(xml("a:ln", {}, [rawXml(xml("a:noFill"))])),
              ])),
              rawXml(xml("wps:txbx", {}, [rawXml(xml("w:txbxContent", {}, content))])),
              rawXml(xml("wps:bodyPr", {
                rot: 0,
                spcFirstLastPara: 0,
                // 排多了就裁掉，不要糊到相邻块上。VML 那版做不到这一点。
                vertOverflow: "clip",
                horzOverflow: "clip",
                vert: "horz",
                wrap: "square",
                lIns: 0, tIns: 0, rIns: 0, bIns: 0,
                anchor: "t",
              }, [rawXml(xml("a:normAutofit"))])),
            ])),
          ])),
        ])),
      ])),
    ])),
  ]);
}

function pageBackground(relationshipId, pageIndex, widthPt, heightPt) {
  const widthEmu = emu(widthPt);
  const heightEmu = emu(heightPt);
  return xml("w:r", {}, [
    rawXml(xml("w:drawing", {}, [
      rawXml(xml("wp:anchor", {
        distT: 0, distB: 0, distL: 0, distR: 0,
        simplePos: 0,
        relativeHeight: 0,
        // behindDoc + locked:背景图压在最底下，而且不让用户误拖动。
        behindDoc: 1, locked: 1, layoutInCell: 1, allowOverlap: 1,
      }, [
        rawXml(xml("wp:simplePos", { x: 0, y: 0 })),
        rawXml(xml("wp:positionH", { relativeFrom: "page" }, [rawXml(xml("wp:posOffset", {}, [0]))])),
        rawXml(xml("wp:positionV", { relativeFrom: "page" }, [rawXml(xml("wp:posOffset", {}, [0]))])),
        rawXml(xml("wp:extent", { cx: widthEmu, cy: heightEmu })),
        rawXml(xml("wp:effectExtent", { l: 0, t: 0, r: 0, b: 0 })),
        rawXml(xml("wp:wrapNone")),
        rawXml(xml("wp:docPr", { id: 1000 + pageIndex, name: `page ${pageIndex + 1}` })),
        rawXml(xml("wp:cNvGraphicFramePr", {}, [
          rawXml(xml("a:graphicFrameLocks", { noChangeAspect: 1 })),
        ])),
        rawXml(xml("a:graphic", {}, [
          rawXml(xml("a:graphicData", {
            uri: "http://schemas.openxmlformats.org/drawingml/2006/picture",
          }, [
            rawXml(xml("pic:pic", {}, [
              rawXml(xml("pic:nvPicPr", {}, [
                rawXml(xml("pic:cNvPr", { id: 2000 + pageIndex, name: `page-${pageIndex + 1}` })),
                rawXml(xml("pic:cNvPicPr")),
              ])),
              rawXml(xml("pic:blipFill", {}, [
                rawXml(xml("a:blip", { "r:embed": relationshipId })),
                rawXml(xml("a:stretch", {}, [rawXml(xml("a:fillRect"))])),
              ])),
              rawXml(xml("pic:spPr", {}, [
                rawXml(xml("a:xfrm", {}, [
                  rawXml(xml("a:off", { x: 0, y: 0 })),
                  rawXml(xml("a:ext", { cx: widthEmu, cy: heightEmu })),
                ])),
                rawXml(xml("a:prstGeom", { prst: "rect" }, [rawXml(xml("a:avLst"))])),
              ])),
            ])),
          ])),
        ])),
      ])),
    ])),
  ]);
}

/**
 * 水印（2026-11-20）：右下角一张浮动图片，压在文字上面（不是 behindDoc，背景图会盖住它），锁住不让误拖。
 * 位置由 Python 侧按和 PDF 水印同一套算法给出（页面坐标，pt）。
 */
function pageWatermark(relationshipId, pageIndex, rect) {
  const widthEmu = emu(rect.x1 - rect.x0);
  const heightEmu = emu(rect.y1 - rect.y0);
  return xml("w:r", {}, [
    rawXml(xml("w:drawing", {}, [
      rawXml(xml("wp:anchor", {
        distT: 0, distB: 0, distL: 0, distR: 0,
        simplePos: 0,
        relativeHeight: 251659264,
        behindDoc: 0, locked: 1, layoutInCell: 1, allowOverlap: 1,
      }, [
        rawXml(xml("wp:simplePos", { x: 0, y: 0 })),
        rawXml(xml("wp:positionH", { relativeFrom: "page" }, [rawXml(xml("wp:posOffset", {}, [emu(rect.x0)]))])),
        rawXml(xml("wp:positionV", { relativeFrom: "page" }, [rawXml(xml("wp:posOffset", {}, [emu(rect.y0)]))])),
        rawXml(xml("wp:extent", { cx: widthEmu, cy: heightEmu })),
        rawXml(xml("wp:effectExtent", { l: 0, t: 0, r: 0, b: 0 })),
        rawXml(xml("wp:wrapNone")),
        rawXml(xml("wp:docPr", { id: 3000 + pageIndex, name: `watermark ${pageIndex + 1}`, descr: "RetainPDF" })),
        rawXml(xml("wp:cNvGraphicFramePr", {}, [
          rawXml(xml("a:graphicFrameLocks", { noChangeAspect: 1 })),
        ])),
        rawXml(xml("a:graphic", {}, [
          rawXml(xml("a:graphicData", {
            uri: "http://schemas.openxmlformats.org/drawingml/2006/picture",
          }, [
            rawXml(xml("pic:pic", {}, [
              rawXml(xml("pic:nvPicPr", {}, [
                rawXml(xml("pic:cNvPr", { id: 4000 + pageIndex, name: `watermark-${pageIndex + 1}` })),
                rawXml(xml("pic:cNvPicPr")),
              ])),
              rawXml(xml("pic:blipFill", {}, [
                rawXml(xml("a:blip", { "r:embed": relationshipId })),
                rawXml(xml("a:stretch", {}, [rawXml(xml("a:fillRect"))])),
              ])),
              rawXml(xml("pic:spPr", {}, [
                rawXml(xml("a:xfrm", {}, [
                  rawXml(xml("a:off", { x: 0, y: 0 })),
                  rawXml(xml("a:ext", { cx: widthEmu, cy: heightEmu })),
                ])),
                rawXml(xml("a:prstGeom", { prst: "rect" }, [rawXml(xml("a:avLst"))])),
              ])),
            ])),
          ])),
        ])),
      ])),
    ])),
  ]);
}

function sectionProperties(page) {
  return xml("w:sectPr", {}, [
    rawXml(xml("w:pgSz", { "w:w": twips(page.widthPt), "w:h": twips(page.heightPt) })),
    // 页边距全 0:所有内容都是按页面坐标绝对定位的，留白只会让 Word 觉得页面放不下。
    rawXml(xml("w:pgMar", {
      "w:top": 0, "w:right": 0, "w:bottom": 0, "w:left": 0,
      "w:header": 0, "w:footer": 0, "w:gutter": 0,
    })),
  ]);
}

/**
 * 一页的宿主段落。
 *
 * 所有锚定对象都挂在这一个段落上，而这个段落本身必须**不占高度**——`w:line=1` +
 * `exact` 就是干这个的。不这么做的话每页会多出一个空行，页面内容整体下移。
 */
function hostParagraph(runs, page, isLast) {
  return xml("w:p", {}, [
    rawXml(xml("w:pPr", {}, [
      rawXml(xml("w:spacing", { "w:before": 0, "w:after": 0, "w:line": 1, "w:lineRule": "exact" })),
      // 最后一页的 sectPr 由 buildDocxPackage 放在 body 末尾，这里只给前面的页断。
      isLast ? undefined : rawXml(sectionProperties(page)),
    ])),
    ...runs,
  ]);
}

/**
 * @returns {{ body: string, errors: Array, textboxCount: number, formulaCount: number }}
 */
export function buildBody(spec, mediaByPageIndex, watermark = null) {
  const errors = [];
  const paragraphs = [];
  let textboxCount = 0;
  let formulaCount = 0;

  spec.pages.forEach((page, index) => {
    const runs = [];
    const media = mediaByPageIndex.get(page.pageIndex);
    if (media) {
      runs.push(rawXml(pageBackground(media.relationshipId, page.pageIndex, page.widthPt, page.heightPt)));
    }
    page.blocks.forEach((block, blockIndex) => {
      formulaCount += (block.text.match(MATH_RE) || []).length;
      MATH_RE.lastIndex = 0;
      runs.push(rawXml(blockTextbox(block, page.pageIndex, blockIndex, spec.font.family, errors)));
      textboxCount += 1;
    });
    if (watermark && page.watermark) {
      runs.push(rawXml(pageWatermark(watermark.relationshipId, page.pageIndex, page.watermark.rect)));
    }
    paragraphs.push(hostParagraph(runs, page, index === spec.pages.length - 1));
  });

  return { body: paragraphs.join(""), errors, textboxCount, formulaCount };
}

export { sectionProperties };
