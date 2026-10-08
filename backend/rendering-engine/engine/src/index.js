"use strict";

const path = require("node:path");

module.exports = {
  Model: require("./model"),
  Render: require("./render"),
  Fit: require("./fit"),
  FitModel: require("./fit-model"),
  Text: require("./text/measurer"),
  // Advance table of the default face (Source Han Serif SC), for
  // Text.createMeasurer({ metrics }): weight "regular" (default) or "bold"
  // (headings in the retain profile, FitModel measurers.bold). Browser/Zotero
  // hosts load the same JSON files themselves.
  defaultFontTable(weight = "regular") {
    const file = weight === "bold" ? "source-han-serif-sc-bold.json" : "source-han-serif-sc-regular.json";
    return require(path.join(__dirname, "..", "data", "fonts", file));
  }
};
