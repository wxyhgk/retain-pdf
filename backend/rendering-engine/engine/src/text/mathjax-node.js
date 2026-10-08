"use strict";

// Node-only: LaTeX -> self-contained SVG plus box metrics via MathJax 3 (lite
// DOM, no browser), for Text.contentFromText({ renderMathBox }) and for
// emitters that draw formulas as SVG with a transparent LaTeX text layer.
// Browser/Zotero hosts render formulas with their own MathJax/KaTeX build and
// never load this file.
//
// mathjax-full is an optional peer dependency: it is loaded on first use, so
// requiring retain-pdf-rendering never pulls it in.
//
// Units: MathJax's SVG output sizes the <svg> in `ex`, where 1 ex is the
// x-height of MathJax's own TeX font (font.params.x_height, 0.442 em for the
// default font). Rendering with em = 16 and ex = 16 * x_height makes
// MathJax's scale factor exactly 1; a length in ex converts to em of the
// surrounding text as `ex * x_height`. The value is read from the output jax
// rather than hard-coded.

const EM = 16;

let engine = null;

function loadEngine() {
  if (engine) return engine;
  let modules;
  try {
    modules = {
      mathjax: require("mathjax-full/js/mathjax.js").mathjax,
      TeX: require("mathjax-full/js/input/tex.js").TeX,
      SVG: require("mathjax-full/js/output/svg.js").SVG,
      liteAdaptor: require("mathjax-full/js/adaptors/liteAdaptor.js").liteAdaptor,
      RegisterHTMLHandler: require("mathjax-full/js/handlers/html.js").RegisterHTMLHandler,
      AllPackages: require("mathjax-full/js/input/tex/AllPackages.js").AllPackages
    };
  }
  catch (error) {
    throw new Error(`retain-pdf-rendering/text/mathjax-node needs the optional peer dependency mathjax-full@3 (${error.message})`);
  }
  const adaptor = modules.liteAdaptor();
  modules.RegisterHTMLHandler(adaptor);
  const svgOutput = new modules.SVG({ fontCache: "none" });
  const texInput = new modules.TeX({ packages: modules.AllPackages.filter(name => name !== "bussproofs") });
  const html = modules.mathjax.document("", { InputJax: texInput, OutputJax: svgOutput });
  const xHeight = svgOutput.font.params.x_height;
  engine = { adaptor, html, xHeight, ex: EM * xHeight };
  return engine;
}

function exValue(value) {
  const match = /^(-?[\d.]+)ex$/.exec(String(value || "").trim());
  return match ? Number(match[1]) : NaN;
}

// { ok, tex, svg, widthEm, heightEm, depthEm } | { ok: false, tex, error }.
// heightEm is the full box height, depthEm how far it reaches below the
// baseline (MathJax's negative vertical-align). Never throws for bad input:
// unparsable TeX and unknown macros yield ok:false so the caller can fall
// back to the raw LaTeX.
function createMathRenderer() {
  const cache = new Map();

  function texToSVG(tex, display = false) {
    const key = `${display ? "D" : "I"}:${tex}`;
    if (cache.has(key)) return cache.get(key);
    const { adaptor, html, xHeight, ex } = loadEngine();
    let result;
    try {
      const node = html.convert(String(tex || ""), { display, em: EM, ex, containerWidth: 80 * EM });
      const svg = adaptor.firstChild(node);
      const markup = adaptor.outerHTML(svg);
      // Parse errors become <merror>; unknown macros are kept by the
      // `noundefined` package as red <mtext>. Both mean "not really rendered".
      const error = adaptor.getAttribute(svg, "data-mjx-error")
        || (markup.includes('data-mml-node="merror"') ? "merror" : "")
        || (/data-mml-node="mtext" fill="red"/.test(markup) ? "undefined macro" : "");
      const widthEx = exValue(adaptor.getAttribute(svg, "width"));
      const heightEx = exValue(adaptor.getAttribute(svg, "height"));
      const style = adaptor.getAttribute(svg, "style") || "";
      const valign = /vertical-align:\s*(-?[\d.]+)ex/.exec(style);
      const depthEx = valign ? -Number(valign[1]) : 0;
      if (error || !Number.isFinite(widthEx) || !Number.isFinite(heightEx)) {
        result = { ok: false, error: error || "no size", tex };
      }
      else {
        adaptor.setAttribute(svg, "xmlns", "http://www.w3.org/2000/svg");
        result = {
          ok: true,
          tex,
          svg: adaptor.outerHTML(svg),
          widthEm: widthEx * xHeight,
          heightEm: heightEx * xHeight,
          depthEm: depthEx * xHeight
        };
      }
    }
    catch (error) {
      result = { ok: false, error: String(error?.message || error), tex };
    }
    cache.set(key, result);
    return result;
  }

  // Shape expected by Text.contentFromText: box metrics, or null so the
  // measurer uses its raw-LaTeX fallback box.
  function renderMathBox(tex, display = false) {
    const result = texToSVG(tex, display);
    return result.ok ? { widthEm: result.widthEm, heightEm: result.heightEm, depthEm: result.depthEm } : null;
  }

  return { texToSVG, renderMathBox, get xHeight() { return loadEngine().xHeight; } };
}

const shared = createMathRenderer();

module.exports = {
  createMathRenderer,
  texToSVG: shared.texToSVG,
  renderMathBox: shared.renderMathBox
};
