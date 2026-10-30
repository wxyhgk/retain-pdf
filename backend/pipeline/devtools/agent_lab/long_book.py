"""长样例的正文：一本人造的小书《Reading Machines》，前言 + 7 章 + 每章参考文献。

每章文风不同（前言和第 7 章口语、第一人称"I"；第 1 章介绍性的"we"；第 2、5 章严谨的模型和方法；第 3 章工程；第 4、6 章措辞很保留的讨论），
故意埋的坑：
- 跨章同一术语：bounding box、reading order、layout element、ground truth、feature map、pipeline、worker；
- 同词异义：kernel 在第 2 章是卷积核、在第 3 章是操作系统内核；token 在第 2 章是词元、在第 3 章是访问令牌；
- 缩写先用后定义：OCR 在前言就出现，第 1 章才给全称；IoU 在第 2 章定义，第 4 章只用缩写；
- 同一人、同一工具多种写法：Ana Ruiz / Ruiz (2021) / the Ruiz toolkit / [2]；DocBench；
- 保留原文：期刊名 Pattern Recognition Letters、International Journal on Document Analysis and Recognition，工具名 Tesseract；
- 跨章引用：第 4 章说"Figure 2.1""Table 2.1""Section 3.2"；
- 每章参考文献各自从 [1] 编号。

行内记号：`[3]` 是引用，`{fn:key}` 是脚注标记（key 是脚注块的 id），`$…$` 是 `FORMULAS` 里登记过的行内公式。
"""

from __future__ import annotations

BOOK_TITLE = "Reading Machines"
AUTHOR = "Hana Okafor"

# 行内公式：latex → 排版用的片段（文字、字体、上下标）
FORMULAS = {
    "k \\times k": [("k", "it", None), (" × ", "rm", None), ("k", "it", None)],
    "F_1": [("F", "it", None), ("1", "rm", "sub")],
    "\\tau": [("τ", "rm", None)],
}

# 每章：key、标题（第几章）、段落和其它块。块的种类：
#   ("h2", 标题)  ("p", 正文)  ("fig", key, 图注)  ("table", key, 表题, 行)  ("fn", key, 脚注正文)  ("refs", [条目…])
CHAPTERS: list[dict] = [
    {
        "key": "preface",
        "title": "Preface",
        "number": "",
        "items": [
            ("p", "I did not set out to write a book about reading machines. I set out, years ago, to fix one annoying bug: a converter that kept putting footnotes in the middle of sentences. The bug turned out to be a whole field, and this book is what I learned while falling into it."),
            ("p", "If you have ever pasted text out of a PDF and watched it come apart, you already know the problem. Columns get braided together, headings land in the wrong place, and a figure caption suddenly interrupts a paragraph about something else. OCR software can read every letter on the page and still get the page wrong."),
            ("p", "I have tried to keep the tone of the book close to how I would explain things over coffee. Where the research is solid, I say so plainly. Where it is not, I try to be honest about it, and you will see a lot of \"probably\" and \"it seems\" in the later chapters. That is not modesty; it is the state of the evidence."),
            ("p", "A word on names. I mention Ana Ruiz and her toolkit often, because her work shaped mine, and I cite journals such as Pattern Recognition Letters by their own names. Software stays in English too: Tesseract is Tesseract in every language I know."),
            ("p", "Thanks are due to everyone who sent me broken documents. Please keep sending them. Every strange page is a lesson, and some of them are funny."),
            ("p", "The chapters build on each other, but not strictly. If you only care about evaluation, you can probably jump to Chapter 4 and come back when a term confuses you. If you run systems for a living, Chapter 3 is the one I wish someone had handed me."),
        ],
    },
    {
        "key": "ch1",
        "title": "Why Documents Are Hard",
        "number": "1",
        "items": [
            ("p", "We begin with a simple question: what does it mean for a machine to read a page? Optical character recognition (OCR) answers only part of it. OCR turns pixels into characters, but a page is more than its characters. It has columns, headings, captions, footnotes and a reading order that a human follows without thinking."),
            ("p", "In this book we call each visible unit on a page a layout element. A paragraph is a layout element, and so are a figure, a table, a caption and a running header. Each layout element has a bounding box, the smallest rectangle that contains it, and a class that says what the element is for."),
            ("h2", "1.1 Three kinds of mistakes"),
            ("p", "Most failures we have seen fall into three groups. First, the bounding box is wrong: two paragraphs are merged into one box, or a single paragraph is cut in half. Second, the class is wrong: a caption is labelled as body text, or a page number is labelled as a heading. Third, the reading order is wrong even though every bounding box and class is right."),
            ("p", "The third kind is the hardest to notice. A page can look perfect when the boxes are drawn on top of it, and still produce nonsense when its text is read out in the predicted reading order. We therefore treat reading order as a first-class output, not as an afterthought.{fn:fn-order}"),
            ("fn", "fn-order", "Some systems recover reading order from the PDF file itself. This works for born-digital files and fails for scans."),
            ("fig", "fig-1-1", "Figure 1.1: A two-column page with its layout elements, bounding boxes and reading order."),
            ("h2", "1.2 Where the field stands"),
            ("p", "Early systems relied on hand-written rules about whitespace and font size. Ana Ruiz showed that such rules break as soon as a publisher changes its template [1]. Ruiz (2021) later released a toolkit that learns the rules from examples instead [2], and the Ruiz toolkit is still a common baseline."),
            ("p", "Benchmarks have followed the same path. DocBench collects pages from many publishers and gives each layout element a ground truth class and bounding box [3]. Most results in this book are reported on DocBench, and we discuss its limits in Chapter 4."),
            ("h2", "1.3 Reading order, briefly"),
            ("p", "For a single column of text, reading order is trivial: top to bottom. Two columns already raise questions. Does a figure that spans both columns interrupt the left column, or does the reader finish the left column first? Publishers disagree, and so do readers."),
            ("p", "Footnotes, sidebars and captions add further choices. We follow a simple convention throughout the book: the main text is read column by column, and every other layout element is read immediately after the paragraph that refers to it. Under this convention a caption follows the first paragraph that mentions its figure."),
            ("fig", "fig-1-2", "Figure 1.2: Two plausible reading orders for the same page. Both are defensible; only one matches the ground truth."),
            ("p", "This convention is not the only reasonable one, and the ground truth in DocBench uses a slightly different rule for sidebars. We point out the difference wherever it changes a result."),
            ("refs", [
                "[1] A. Ruiz. Why layout rules fail. Pattern Recognition Letters 41 (2018) 12–19.",
                "[2] A. Ruiz, T. Berg. Learning layout from examples. International Journal on Document Analysis and Recognition 24 (2021) 101–118.",
                "[3] M. Sato et al. DocBench: a benchmark for page understanding. Proc. ICDAR (2020) 55–62.",
            ]),
        ],
    },
    {
        "key": "ch2",
        "title": "Learning Layout",
        "number": "2",
        "items": [
            ("p", "This chapter describes how a neural network predicts layout elements. The input is a page image; the output is a set of bounding boxes, one class per box, and a reading order over the boxes. We first describe the visual encoder and then the sequence model that sits on top of it."),
            ("h2", "2.1 Convolutional features"),
            ("p", "The encoder is a stack of convolutional layers. Each layer slides a small kernel, typically of size $k \\times k$ with k = 3, over the image and produces a feature map. A kernel responds strongly to a particular local pattern, such as the left edge of a text line or the thin rule above a footnote."),
            ("p", "Deeper layers combine the responses of earlier ones, so that a kernel near the top of the stack responds to whole words or to the gap between two columns. The final feature map is about thirty-two times smaller than the page image in each direction."),
            ("fig", "fig-2-1", "Figure 2.1: Feature maps from three layers of the encoder. Brighter regions respond more strongly to text lines."),
            ("h2", "2.2 From features to tokens"),
            ("p", "The feature map is cut into a grid of patches, and each patch becomes a token. The sequence model reads the tokens and uses attention to relate each token to every other token on the page. In this way a token in the left column can learn that it is followed by a token at the top of the right column."),
            ("p", "Each token is finally assigned to a layout element. Tokens that belong to the same element are merged, and the merged region gives the predicted bounding box of that element."),
            ("h2", "2.3 Measuring overlap"),
            ("p", "To compare a predicted bounding box with the ground truth, we use Intersection over Union (IoU): the area of the overlap divided by the area of the union. A prediction counts as correct when its IoU with a ground truth box exceeds a threshold $\\tau$, usually 0.5."),
            ("table", "tab-2-1", "Table 2.1: Precision and recall of the model on DocBench by class.", [["Class", "Precision", "Recall", "F1"], ["Paragraph", "0.95", "0.93", "0.94"], ["Caption", "0.88", "0.79", "0.83"], ["Footnote", "0.81", "0.70", "0.75"]]),
            ("p", "Table 2.1 shows that paragraphs are easy and footnotes are hard. Footnotes are small, they sit near page numbers, and their font is often the same as the captions, so the kernel responses that separate them from other text are weak."),
            ("h2", "2.4 Training data"),
            ("p", "The model is trained on pages whose ground truth was drawn by annotators. Each annotator draws a bounding box around every layout element, chooses a class, and numbers the elements in reading order. Drawing one page takes between three and ten minutes, so a training set of fifty thousand pages represents several years of human work."),
            ("p", "Annotators disagree more often than one might expect. Two annotators given the same page agree on the class of a layout element about ninety-four percent of the time, and on the complete reading order of the page only about eighty percent of the time. A model cannot be expected to beat the agreement between the people who made its ground truth."),
            ("p", "We augment the training pages by rotating them slightly, blurring them and changing their contrast. Augmentation helps the kernel in early layers ignore noise, but it cannot create layouts that the training set does not contain."),
            ("h2", "2.5 Failure cases"),
            ("p", "Three failures are common enough to deserve names. In a column merge, the tokens of two adjacent columns are assigned to a single layout element. In a caption swap, the caption of one figure is attached to its neighbour. In a footnote leak, a footnote is read as the last line of the paragraph above it."),
            ("fig", "fig-2-2", "Figure 2.2: Examples of a column merge, a caption swap and a footnote leak. Predicted bounding boxes are drawn in red."),
            ("p", "All three failures happen when the attention between tokens is dominated by distance on the page rather than by the content of the tokens. Adding the font size of each token to its features reduces column merges by about a third."),
            ("refs", [
                "[1] K. He et al. Deep residual learning for image recognition. Proc. CVPR (2016) 770–778.",
                "[2] A. Vaswani et al. Attention is all you need. Proc. NeurIPS (2017) 5998–6008.",
                "[3] A. Ruiz, T. Berg. Learning layout from examples. International Journal on Document Analysis and Recognition 24 (2021) 101–118.",
            ]),
        ],
    },
    {
        "key": "ch3",
        "title": "Building the Pipeline",
        "number": "3",
        "items": [
            ("p", "A model alone does not make a product. In practice we run a pipeline: pages are rendered, sent to the layout model, sent to OCR, merged, and written out. This chapter describes the pipeline we run in production and the mistakes we made while building it."),
            ("h2", "3.1 Workers and queues"),
            ("p", "Each stage of the pipeline is a worker that takes jobs from a queue. When a worker crashes, its job goes back to the queue and another worker picks it up. We learned the hard way that a worker must never keep a page in memory longer than it needs to: a single book with a thousand pages filled the memory of a machine within minutes."),
            ("p", "The layout model runs on a GPU, and the GPU driver lives in the operating system kernel. When the kernel ran out of memory it killed the worker without a warning, and for a week we blamed the model for crashes that the kernel had caused."),
            ("h2", "3.2 Access tokens and caching"),
            ("p", "The OCR stage calls an external service. Every request carries an access token, and each token expires after one hour. Our first version requested a new token for every page, which made the service throttle us; the fix was to cache the token and refresh it shortly before it expired."),
            ("p", "We also cache the output of every stage. If a book has already been processed, the pipeline returns the stored bounding boxes and reading order instead of running the model again. The cache key includes the version of the model, so that a new model never serves old results."),
            ("fig", "fig-3-1", "Figure 3.1: The pipeline. Each box is a worker; arrows are queues."),
            ("p", "None of this is glamorous, but it decides whether users trust the system. A layout element that silently disappears between two stages is worse than a wrong class, because nobody notices it until a reader complains."),
            ("h2", "3.3 Monitoring"),
            ("p", "Every worker writes one log line per page: how long the page took, how many layout elements it produced, and which version of the model it used. A dashboard plots these numbers for every stage of the pipeline, and an alarm fires when the number of layout elements per page drops suddenly."),
            ("p", "The alarm has caught more bugs than any test. Once it fired because a new font made the OCR stage return empty pages; once because the kernel had been upgraded on half of the machines and the GPU driver no longer loaded. In both cases the model itself was fine."),
            ("p", "We also keep a small set of reference documents with a known ground truth and run them through the pipeline every hour. If their bounding boxes or reading order change, something in the pipeline has changed, whether or not anyone meant it to."),
            ("h2", "3.4 Keeping secrets"),
            ("p", "Access tokens are secrets, and they leak in boring ways: in log lines, in error messages, in screenshots of a dashboard. Our workers replace every token with a short fingerprint before they write anything to a log. A token that has appeared in a log is revoked within the hour, even if nobody has misused it."),
            ("p", "The documents themselves are secrets too. A worker deletes the page images it rendered as soon as the next stage has confirmed receipt, and the cache stores only bounding boxes, classes and text, never the original file."),
            ("refs", [
                "[1] J. Dean, S. Ghemawat. MapReduce: simplified data processing on large clusters. Proc. OSDI (2004) 137–150.",
                "[2] R. Smith. An overview of the Tesseract OCR engine. Proc. ICDAR (2007) 629–633.",
            ]),
        ],
    },
    {
        "key": "ch4",
        "title": "Measuring Quality",
        "number": "4",
        "items": [
            ("p", "How good are these systems? The honest answer is that we do not fully know. The numbers in Table 2.1 suggest that paragraphs are a solved problem, but they may say more about DocBench than about real documents."),
            ("p", "DocBench pages appear to be cleaner than the pages our users upload. Its scans are straight, its fonts are common, and most of its pages come from a handful of publishers. A model that scores well on it might still struggle with a photographed receipt or a nineteenth-century newspaper."),
            ("h2", "4.1 What IoU hides"),
            ("p", "An IoU of 0.5 is a generous threshold. A predicted bounding box can miss a whole line of a paragraph and still count as correct. It is likely that some of the errors we discussed in Section 1.1 are invisible to IoU, and we suspect that reading order errors are the most underreported of all."),
            ("p", "The feature maps in Figure 2.1 hint at why. The encoder sees text lines clearly, but the gap between two columns is faint, which suggests that the model may sometimes guess the column boundary rather than see it."),
            ("h2", "4.2 Measuring reading order"),
            ("p", "We therefore measure reading order separately. For each page we compare the predicted order of layout elements with the ground truth order and count how many pairs are swapped. On DocBench the model swaps about four percent of pairs, which seems small, but a single swap can be enough to make a page unreadable."),
            ("p", "Ruiz has argued that swaps near the top of a page matter more than swaps near the bottom [1]. We find the argument plausible but have not tested it, and the caching described in Section 3.2 makes such experiments cheap enough that perhaps someone should."),
            ("p", "Finally, a correction. In Chapter 2 we said that footnotes are hard because their kernel responses are weak. That is probably only part of the story: footnotes are also rare in the training data, and rarity alone might explain much of the gap in $F_1$."),
            ("h2", "4.3 Asking people"),
            ("p", "Scores are cheap; people are not. Still, a small study with human readers may reveal more than another benchmark. In a pilot with twelve readers, pages that the model scored well on were usually judged readable, but the exceptions seemed to share one feature: a single misplaced caption near the top of the page."),
            ("p", "Twelve readers are too few to draw firm conclusions, and the readers were colleagues who perhaps knew what to look for. We report the pilot because it points in the same direction as the argument by Ruiz, not because it settles anything."),
            ("refs", [
                "[1] A. Ruiz. Not all swaps are equal. Pattern Recognition Letters 58 (2022) 33–40.",
                "[2] M. Sato et al. DocBench: a benchmark for page understanding. Proc. ICDAR (2020) 55–62.",
            ]),
        ],
    },
    {
        "key": "ch5",
        "title": "Tables, Formulas and Footnotes",
        "number": "5",
        "items": [
            ("p", "Paragraphs are the easy case. This chapter covers three kinds of layout element that need more than a bounding box and a class: tables, which have an inner structure; formulas, which must not be changed at all; and footnotes, which belong to a place in the text far away from where they are printed."),
            ("h2", "5.1 Tables"),
            ("p", "A table is a layout element whose content is itself a grid. Recognising a table therefore means two things: finding its bounding box, and recovering its rows, columns and merged cells. The second task is much harder than the first, and most systems that report high scores on tables report them for the first task only."),
            ("p", "Ruled tables, with a line around every cell, are almost solved. Tables with only three horizontal rules, as in most scientific papers, are harder, because the column boundaries must be inferred from the alignment of the text. Tables that span two pages are hardest of all."),
            ("table", "tab-5-1", "Table 5.1: Cell-level accuracy on three kinds of table.", [["Table type", "Pages", "Accuracy", "Merged"], ["Fully ruled", "420", "0.97", "0.91"], ["Three rules", "1310", "0.88", "0.72"], ["Two pages", "95", "0.61", "0.40"]]),
            ("h2", "5.2 Formulas"),
            ("p", "A formula is the one layout element whose text must survive exactly. A translation tool may rephrase a sentence, but it must never touch $F_1$ or $k \\times k$. We therefore keep formulas as LaTeX and treat them as opaque inside the surrounding text."),
            ("p", "Recognising a formula from an image is its own research field, and we do not cover it here. What matters for layout is the boundary: an inline formula belongs to its paragraph, while a displayed formula is a layout element of its own with its own bounding box and, often, a number at the right margin."),
            ("h2", "5.3 Footnotes"),
            ("p", "A footnote has two parts: the mark in the text and the note at the bottom of the page. The mark is tiny, usually a raised digit, and OCR often drops it or reads it as part of the word before it. The note is easy to find but useless without its mark.{fn:fn-marks}"),
            ("fn", "fn-marks", "In our data about one footnote mark in eight is lost by OCR; most of the losses are marks placed after punctuation."),
            ("p", "We link marks to notes by their digits and by their position: the first mark on a page usually belongs to the first note. When the digits disagree with the positions, we trust the digits. The link is stored as a relation between the two layout elements, so that a reader can jump from one to the other."),
            ("refs", [
                "[1] S. Schreiber et al. Detecting tables in document images. Proc. ICDAR (2017) 1162–1167.",
                "[2] A. Ruiz. Footnotes in the wild. International Journal on Document Analysis and Recognition 26 (2023) 77–90.",
            ]),
        ],
    },
    {
        "key": "ch6",
        "title": "Beyond Latin Script",
        "number": "6",
        "items": [
            ("p", "Everything so far has assumed pages written from left to right in horizontal lines. Much of the world's printed text does not look like that, and a layout model trained on English papers may behave strangely when it meets a Japanese novel or an Arabic newspaper."),
            ("h2", "6.1 Vertical text"),
            ("p", "Chinese and Japanese books are often set in vertical columns read from right to left. A layout element is then a tall, narrow column, and the reading order runs across the page in the opposite direction. A model that has only seen horizontal text tends to cut each vertical column into dozens of tiny bounding boxes."),
            ("p", "Small annotations above or beside characters, which give their pronunciation, add another layer. They belong to the line they annotate and should not be read as a separate line, yet they look exactly like a separate line of small text."),
            ("h2", "6.2 Right-to-left scripts"),
            ("p", "Arabic and Hebrew are read from right to left, but numbers inside them are read from left to right. A paragraph can therefore change direction several times within a single line. The bounding box of the paragraph does not care, but the reading order of its words does."),
            ("p", "We have only limited data for these scripts, and the results we have seen are mixed. It seems likely that a model trained jointly on several scripts does better than separate models, but the evidence is thin and comes mostly from a single benchmark."),
            ("fig", "fig-6-1", "Figure 6.1: The same page layout in horizontal, vertical and right-to-left setting, with the reading order of each."),
            ("p", "If this book has a blind spot, this is it. Most of the systems we describe were built for Latin script first and adapted later, and the adaptations show."),
            ("refs", [
                "[1] Y. Tanaka, H. Mori. Layout analysis of vertical Japanese text. Proc. ICDAR (2019) 211–218.",
            ]),
        ],
    },
    {
        "key": "ch7",
        "title": "A Letter to the Reader",
        "number": "7",
        "items": [
            ("p", "So where does this leave you? Probably with more questions than you had at the start, and I think that is the right place to be. If someone tells you that layout analysis is solved, ask them to show you a page of footnotes."),
            ("p", "A friend once asked me why I care so much about the order of a few boxes. \"It's just text,\" she said. \"The words are all there.\" I showed her a recipe where the ingredients had been read after the instructions. She stopped arguing and started laughing."),
            ("p", "Here is what I hope you take away. Look at the output, not only at the score. Read the page in the predicted reading order, out loud if you have to. Check every bounding box that looks too tidy. And when a tool fails, keep the page: it is worth more than a thousand pages that worked."),
            ("p", "I will keep collecting broken documents, and I will keep being wrong about some of them. If you find a page that breaks everything in this book, send it to me. I promise to enjoy it."),
        ],
    },
]

# ---- 给指标用的探针 ----
# 跨章同一术语：原文 → 认得出的中文译法（同义的都列上，最长的先匹配）。一致率 = 认出来的出现里最常用那种译法的占比。
TERM_PROBES: dict[str, list[str]] = {
    "bounding box": ["边界框", "包围盒", "外接框", "边框", "包围框", "定位框", "框"],
    "reading order": ["阅读顺序", "阅读次序", "读取顺序", "读序"],
    "layout element": ["版面元素", "布局元素", "版式元素", "页面元素", "排版元素", "版面单元"],
    "ground truth": ["真实标注", "标准答案", "基准真值", "真值", "参考标注", "正确答案", "标注"],
    "feature map": ["特征图", "特征映射"],
    "pipeline": ["流水线", "处理流程", "管线", "管道", "流程"],
    "worker": ["工作进程", "工作节点", "工作单元", "工作器", "工作者", "worker"],
}
# 同词异义：每章该用的译法
POLYSEMY_PROBES: dict[str, dict[str, list[str]]] = {
    "kernel": {"ch2": ["卷积核", "核"], "ch3": ["内核"]},
    "token": {"ch2": ["词元", "标记", "token", "令牌"], "ch3": ["令牌", "访问令牌", "凭证"]},
}
# 第 2 章里 token 译成"令牌"也算对（有的书这么译）；第 3 章只认令牌、凭证——要看的是第 3 章有没有跟着第 2 章错成"词元"
POLYSEMY_WRONG: dict[str, dict[str, list[str]]] = {
    "kernel": {"ch2": ["内核"], "ch3": ["卷积核"]},
    "token": {"ch3": ["词元", "标记"]},
}
KEEP_PROBES = ["Pattern Recognition Letters", "Tesseract", "DocBench", "Ana Ruiz", "Ruiz"]
ABBR_PROBES = ["OCR", "IoU"]
# 跨章引用：原文 → 译文里该有的写法（正则）
CROSS_REF_PROBES: dict[str, str] = {
    "Figure 2.1": r"图\s*2\.1",
    "Table 2.1": r"表\s*2\.1",
    "Section 1.1": r"1\.1\s*节",
    "Section 3.2": r"3\.2\s*节",
    "Chapter 4": r"第\s*(4|四)\s*章",
    "Chapter 2": r"第\s*(2|二)\s*章",
}
