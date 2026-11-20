/**
 * 排版规格 → 文档:位置、字号、行距、分节、背景图。
 *
 * 钉的是产出的 OOXML 里**真的有那些数**，不是某个纯函数的返回值——排版类的错误几乎
 * 都出在「算对了但没写进文档」这一段。
 */

import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, before } from "node:test";
import { unzipSync, strFromU8 } from "fflate";

import { buildLayoutDocx } from "../src/index.mjs";

// 1x1 白色 PNG。
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const EMU_PER_POINT = 12700;
const TWIPS_PER_POINT = 20;

function spec(overrides = {}) {
  return {
    version: 1,
    job: { id: "t", title: "测试" },
    font: { family: "Source Han Serif SC", mathFamily: "Cambria Math" },
    pages: [
      {
        pageIndex: 0,
        widthPt: 595.276,
        heightPt: 841.89,
        background: { path: "page-001.png" },
        blocks: [{
          id: "b1",
          rect: [72, 144, 400, 200],
          text: "正文 $\\mathbf{2a}$ 结束。",
          fontSizePt: 10.5,
          lineStepPt: 13.53,
          bold: false,
          justify: true,
          firstLineIndentPt: 0,
        }],
      },
      {
        pageIndex: 1,
        widthPt: 400,
        heightPt: 600,
        background: null,
        blocks: [{
          id: "b2",
          rect: [10, 20, 300, 60],
          text: "第二页",
          fontSizePt: 8,
          lineStepPt: 10.3,
          bold: true,
          justify: false,
          firstLineIndentPt: 21,
        }],
      },
    ],
    ...overrides,
  };
}

let documentXml;
let parts;

before(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "retainpdf2doc-"));
  await writeFile(path.join(dir, "page-001.png"), PNG);
  const result = await buildLayoutDocx(spec(), { baseDir: dir });
  parts = unzipSync(result.bytes);
  documentXml = strFromU8(parts["word/document.xml"]);
});

describe("文档结构", () => {
  it("文本框是 DrawingML，不是 VML", () => {
    // 换掉 VML 有两个实际原因:它是 2007 前的遗留格式，而且**不裁切**——字排多一点
    // 就糊到相邻块上。DrawingML 的 bodyPr 有 vertOverflow=clip。
    assert.ok(!documentXml.includes("<v:shape"), "还在用 VML 形状");
    assert.ok(!documentXml.includes("<v:textbox"), "还在用 VML 文本框");
    assert.ok(documentXml.includes("<wps:txbx>"), "没有 DrawingML 文本框");
    assert.ok(documentXml.includes('vertOverflow="clip"'), "文本框没设裁切，会糊到相邻块");
    });

    it("装不下时让 Word 自己缩，而不是直接裁掉", () => {
      // 字号行距是导出时按 resources/fonts/SourceHanSerifSC-Regular.otf 的字形宽度
      // 算的，而 docx 只声明这个字体名、**没嵌入**它（24.5MB，33 倍于已嵌入的公式
      // 字体）。打开的机器上没装就会被替换，字形宽度一变就换行成更多行 → 总高超框
      // → 被上面那个 vertOverflow="clip" 裁掉。这就是「有些块被截断」。
      //
      // noAutofit 是明确告诉 Word「别缩，裁」。normAutofit 让它宁可字小一点也别少字。
      assert.ok(
        documentXml.includes("<a:normAutofit"),
        "文本框是 noAutofit —— 字体被替换后装不下的块会被直接截断",
      );
      assert.ok(!documentXml.includes("<a:noAutofit"), "还留着 noAutofit");
    });

    it("字号半磅取整只会变小，不会变大", async () => {
      // Python 侧按**未取整**的字号判「装得下」，而 Math.round 会把 9.8pt 写成 10pt ——
      // 判定按 9.8 做、Word 按 10 排，多出来的 0.2pt 就可能多断一行。
      // 实测用户那个 job：54 个块里 35 个（65%）被取整取大。
      const one = spec();
      one.pages[0].blocks = [{ ...one.pages[0].blocks[0], id: "sz", fontSizePt: 9.8 }];
      const dir = await mkdtemp(path.join(tmpdir(), "retainpdf2doc-sz-"));
      await writeFile(path.join(dir, "page-001.png"), PNG);
      const built = await buildLayoutDocx(one, { baseDir: dir });
      const xml = strFromU8(unzipSync(built.bytes)["word/document.xml"]);
      // 9.8pt → 19 半磅（9.5pt），不是 20（10pt）。
      assert.ok(xml.includes('<w:sz w:val="19"/>'), "9.8pt 没有向下取整到 19 半磅");
      assert.ok(!xml.includes('<w:sz w:val="20"/>'), "9.8pt 被取整成了 10pt —— 比判定时用的还大");
    });

    it("允许西文词中间断行 —— 否则长化学名会把半行浪费掉", () => {
      // Word 默认不在西文词中间断行，Typst 会。化学正文里全是
      // `2-(4-methoxyphenyl)`、`1-s2.0-S2468823121003047` 这种长词，一个断不开的词
      // 就能浪费半行。按「西文不断词」估算真实 job 的前 6 页，20 个块里 12 个超框，
      // 而同样内容在 PDF 里一个都不超（最挤的 0.90×）。
      assert.ok(
        documentXml.includes('<w:wordWrap w:val="0"/>'),
        "没开「西文词中间可断」—— Word 会比 PDF 多断出好几行，然后超框被裁",
      );
    });

    it("没有底数的上标（引文标记）不走 OMML —— 空数学元素会画成虚线方框", async () => {
      // 译文里的引文标记是 `$^{[1]}$`：LaTeX 上标，**底数是空的**。MathJax 转出来是
      // `<m:sSup>` 且 `<m:e></m:e>` 为空，而 Word 对空的数学元素画一个虚线占位框 ——
      // 用户看到的是每个引文标记前面多一个空方框。
      //
      // 实测 19 个 job 的前 6 页共 1561 个公式，369 个（23.6%）是这种，分布在 13 本书。
      // 而且那个占位框**占横向宽度**，是 Word 比 PDF 多断行的原因之一。
      const one = spec();
      one.pages[0].blocks = [{
        ...one.pages[0].blocks[0],
        id: "cite",
        text: "重要方向之一 $^{[1]}$ 。生成五元环 $^{[2,3]}$ 或更大的杂环。",
      }];
      const dir = await mkdtemp(path.join(tmpdir(), "retainpdf2doc-cite-"));
      await writeFile(path.join(dir, "page-001.png"), PNG);
      const built = await buildLayoutDocx(one, { baseDir: dir });
      const xml = strFromU8(unzipSync(built.bytes)["word/document.xml"]);

      assert.ok(!xml.includes("<m:e></m:e>"), "还有空的数学元素 —— Word 会画虚线方框");
      assert.ok(!xml.includes("<m:oMath"), "引文上标仍然走了 OMML");
      assert.ok(
        xml.includes('<w:vertAlign w:val="superscript"/>'),
        "上标没有用 w:vertAlign 表达",
      );
      // 内容不能丢。
      assert.ok(xml.includes(">[1]<"), "[1] 不见了");
      assert.ok(xml.includes(">[2,3]<"), "[2,3] 不见了");
    });

    it("有底数的上标仍然走 OMML —— 正对照", async () => {
      // 否则上面那条可能在守「所有公式都别走 OMML」。
      const one = spec();
      const dir = await mkdtemp(path.join(tmpdir(), "retainpdf2doc-math-"));
      await writeFile(path.join(dir, "page-001.png"), PNG);
      const built = await buildLayoutDocx(one, { baseDir: dir });
      const xml = strFromU8(unzipSync(built.bytes)["word/document.xml"]);
      assert.ok(xml.includes("<m:oMath"), "真正的公式也不走 OMML 了");
    });

    it("markdown 的 **强调** 变成加粗，不是把星号印出来", async () => {
      // page_specs 给的是 `plain_text if render_kind == "plain" else markdown_text`
      // —— 非 plain 的块交的是**原始 markdown**。而 inlineRuns 原来只解析 `$...$`，
      // 于是 `**1k**` 被原样印成带星号的文本：既没加粗，又多了四个字符。
      // 实测 19 个 job 的前 8 页 820 个块里有 44 个（5.4%）带 `**`，分布在 6 本书上。
      const one = spec();
      one.pages[0].blocks = [{
        ...one.pages[0].blocks[0],
        id: "strong",
        text: "底物 **1k** 与 **2j** 反应",
        bold: false,
      }];
      const dir = await mkdtemp(path.join(tmpdir(), "retainpdf2doc-strong-"));
      await writeFile(path.join(dir, "page-001.png"), PNG);
      const built = await buildLayoutDocx(one, { baseDir: dir });
      const xml = strFromU8(unzipSync(built.bytes)["word/document.xml"]);

      assert.ok(!xml.includes("**"), "星号被原样印进了文档");
      assert.ok(xml.includes("<w:t xml:space=\"preserve\">1k</w:t>"), "强调里的文字没了");
      // 正对照：整块 bold:false，所以文档里出现的 <w:b/> 只能来自这两处强调。
      const bolds = (xml.match(/<w:b\/>/g) || []).length;
      assert.ok(bolds >= 2, `强调没变成加粗，文档里只有 ${bolds} 个 <w:b/>`);
      // 强调之外的正文不该被加粗带上。
      assert.ok(xml.includes("底物 "), "强调之外的正文丢了");
    });

    it("行距仍然是 exact —— 不要改成 auto", () => {
      // exact 让「N 行占 N×行距」这个账算得准，是框内布局的前提。auto 会让行高跟着
      // 替换字体的自然行距走，而 CJK 字体行间距很大，1.289 倍可能变成 1.8 倍字号。
      assert.ok(
        documentXml.includes('w:lineRule="exact"'),
        "行距改成了 auto —— 行高会跟着替换字体漂，比固定值更糟",
      );
      assert.ok(!documentXml.includes('w:lineRule="auto"'), "出现了 auto 行距");
  });

  it("块按规格里的坐标绝对定位（相对页面）", () => {
    const x = 72 * EMU_PER_POINT;
    const y = 144 * EMU_PER_POINT;
    assert.ok(documentXml.includes(`<wp:posOffset>${x}</wp:posOffset>`), `没有 x=${x} 的定位`);
    assert.ok(documentXml.includes(`<wp:posOffset>${y}</wp:posOffset>`), `没有 y=${y} 的定位`);
    assert.ok(documentXml.includes('relativeFrom="page"'), "定位不是相对页面的");
  });

  it("字号和行距照搬规格，不在这边二次折算", () => {
    // 行距曾经在导出侧按 (1+leading_em) 自己折算，系统性高 21%。现在上游给什么就是什么。
    assert.ok(documentXml.includes(`w:val="${Math.round(10.5 * 2)}"`), "10.5pt 的字号没写进去");
    assert.ok(
      documentXml.includes(`w:line="${Math.round(13.53 * TWIPS_PER_POINT)}"`),
      "13.53pt 的行距没写进去",
    );
    assert.ok(documentXml.includes('w:lineRule="exact"'), "行距不是 exact，Word 会自己加高");
  });

  it("每页一节，各自用自己的页面尺寸", () => {
    const first = `w:w="${Math.round(595.276 * TWIPS_PER_POINT)}"`;
    const second = `w:w="${Math.round(400 * TWIPS_PER_POINT)}"`;
    assert.ok(documentXml.includes(first), "第一页的页宽没写进去");
    assert.ok(documentXml.includes(second), "第二页的页宽没写进去——各页尺寸可以不同");
    assert.equal((documentXml.match(/<w:sectPr>/g) || []).length, 2, "分节数不对");
  });

  it("宿主段落不占高度，否则每页内容整体下移", () => {
    assert.ok(documentXml.includes('w:line="1" w:lineRule="exact"'), "宿主段落会占一行的高");
  });

  it("背景图进包并被引用；没有背景图的页不引用", () => {
    assert.ok(parts["word/media/page-0001.png"], "背景图没进包");
    assert.ok(!parts["word/media/page-0002.png"], "第二页没有背景图，却进了包");
    assert.ok(documentXml.includes('r:embed="rIdBg0"'), "背景图没被引用");
    assert.ok(documentXml.includes('behindDoc="1"'), "背景图没有压在文字下面");
  });

  it("加粗、两端对齐、首行缩进都落到文档里", () => {
    assert.ok(documentXml.includes("<w:b/>"), "加粗没写进去");
    assert.ok(documentXml.includes('w:val="both"'), "两端对齐没写进去");
    assert.ok(
      documentXml.includes(`w:firstLine="${Math.round(21 * TWIPS_PER_POINT)}"`),
      "首行缩进没写进去",
    );
  });

  it("文本框声明的字体就是规格给的那个", () => {
    // 必须和 Python 侧量宽度用的字体一致，否则 Word 按别的字体折行，算出来的字号
    // 就失去依据。
    assert.ok(documentXml.includes('w:eastAsia="Source Han Serif SC"'), "东亚字体不对");
    assert.ok(documentXml.includes('w:ascii="Source Han Serif SC"'), "拉丁字体不对");
  });

  it("公式是原生 OMML，不是文字", () => {
    // 匹配 `<m:oMath` 而不是 `<m:oMath>`:vendor 的转换器会在每个公式上再声明一遍
    // xmlns:m/xmlns:w。冗余但合法（文档根上已有同名声明），而且这些重复串在 zip 里
    // 压得很好，不值得为省几十 KB 去剥。
    assert.ok(documentXml.includes("<m:oMath"), "没有原生公式");
    assert.ok(documentXml.includes("<m:sty m:val=\"b\"/>"), "\\mathbf 没有变成粗体样式");
    assert.ok(!documentXml.includes("mathbf"), "命令名被当成文字印出来了");
  });

  it("数学字体随文档嵌入，不只是写个名字", () => {
    // 只写名字的话，目标机器没装这个字体时 Word 会拿普通字体替换，而普通字体没有
    // 数学字形——积分号、求和号、可伸缩括号会变成豆腐块。Cambria Math 只在 Windows
    // 版 Office 自带，macOS Word / LibreOffice / WPS 上都不一定有。
    const fontTable = parts["word/fontTable.xml"];
    assert.ok(fontTable, "没有 fontTable.xml，字体没嵌进来");
    const xml = strFromU8(fontTable);
    assert.ok(xml.includes('w:name="Latin Modern Math"'), "fontTable 里没声明数学字体");
    assert.ok(xml.includes("embedRegular"), "字体只是声明了名字，没有真的嵌入");
    const embedded = Object.keys(parts).filter((name) => name.endsWith(".odttf"));
    assert.equal(embedded.length, 1, `嵌入的字体文件有 ${embedded.length} 个`);
    assert.ok(parts[embedded[0]].length > 100_000, "嵌入的字体文件小得不像真字体");
    assert.ok(documentXml.includes('w:ascii="Latin Modern Math"'), "公式没有声明数学字体");
  });

  it("保留排版的导出不带页眉页脚——它们会把绝对定位的内容挤走", () => {
    assert.ok(!documentXml.includes("<w:headerReference"), "引用了页眉");
    assert.ok(!documentXml.includes("<w:footerReference"), "引用了页脚");
  });
});

describe("规格校验", () => {
  it("公式坏掉时保留原始 LaTeX，而不是让整篇失败", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "retainpdf2doc-bad-"));
    const broken = spec();
    broken.pages = [broken.pages[1]];
    broken.pages[0].blocks[0].text = "坏的 $\\thiscommanddoesnotexist{x}$ 结束";
    const result = await buildLayoutDocx(broken, { baseDir: dir });
    assert.ok(result.bytes.length > 0, "整篇导出被一个坏公式毁了");
  });

  it("背景图读不到时报出是哪一页", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "retainpdf2doc-missing-"));
    await assert.rejects(
      () => buildLayoutDocx(spec(), { baseDir: dir }),
      /第 1 页的背景图读不到/,
    );
  });
});


describe("公式边界", () => {
  it("公式体里的转义美元不会让整串掉回字面文本", async () => {
    // 真实语料里有一处：`总反应成本约为 $\$1.4$。`——公式体里是个转义的美元符（价格）。
    // 第一版正则的公式体写成 `[^$\n]`，把美元符整个排除了，于是匹配不上，整串
    // `$\$1.4$` 会被当字面文本印进文档。
    const dir = await mkdtemp(path.join(tmpdir(), "retainpdf2doc-escaped-"));
    const withEscape = spec();
    withEscape.pages = [withEscape.pages[1]];
    withEscape.pages[0].blocks[0].text = "总反应成本约为 $\\$1.4$。";
    const result = await buildLayoutDocx(withEscape, { baseDir: dir });
    const xml = strFromU8(unzipSync(result.bytes)["word/document.xml"]);
    assert.equal(result.formulaCount, 1, "转义美元的公式没被认出来");
    assert.ok(xml.includes("<m:oMath"), "没有产出原生公式");
    assert.ok(!xml.includes("$1.4$"), "整串被当字面文本印出来了");
  });

  it("`$$...$$` 当成一个公式，不是两个空的", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "retainpdf2doc-display-"));
    const display = spec();
    display.pages = [display.pages[1]];
    display.pages[0].blocks[0].text = "行间 $$x^2+y^2=z^2$$ 结束";
    const result = await buildLayoutDocx(display, { baseDir: dir });
    assert.equal(result.formulaCount, 1, `认成了 ${result.formulaCount} 个公式`);
  });
});

describe("水印（2026-11-20）", () => {
  it("每页右下角一张浮动图片，整份文档共用一张图；规格里没有水印就不放", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "retainpdf2doc-wm-"));
    await writeFile(path.join(dir, "page-001.png"), PNG);
    await writeFile(path.join(dir, "stamp.png"), PNG);
    const one = spec({ watermark: { path: "stamp.png" } });
    one.pages[0].watermark = { rect: [500, 815, 560, 826] };
    one.pages[1].watermark = { rect: [320, 580, 380, 590] };
    const built = await buildLayoutDocx(one, { baseDir: dir });
    const files = unzipSync(built.bytes);
    const xmlText = strFromU8(files["word/document.xml"]);
    const marks = xmlText.match(/name="watermark \d+"/g) || [];
    assert.equal(marks.length, 2, "两页各一个水印");
    assert.equal(Object.keys(files).filter((name) => name.startsWith("word/media/watermark")).length, 1, "水印图只存一份");
    assert.ok(xmlText.includes(`<wp:posOffset>${500 * EMU_PER_POINT}</wp:posOffset>`), "位置照规格给的页面坐标");
    const rels = strFromU8(files["word/_rels/document.xml.rels"]);
    assert.ok(rels.includes('Id="rIdWatermark"'), "水印图登记了关系");
    assert.ok(!documentXml.includes("watermark"), "没给水印的规格不放");
  });
});
