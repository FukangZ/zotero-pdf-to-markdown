# PDF Parser Result Comparison

[English](README.md) | [简体中文](README.zh-CN.md)

This directory keeps Markdown outputs generated from the same paper by different PDF parsers. It helps users compare parser behavior before configuring the plugin.

These files are examples, not strict benchmarks. Parsing quality depends on the paper layout, scan quality, language, formula density, table complexity, and the provider's server-side model version.

## Example Paper

- Title: Efficient and Precise Points-to Analysis: Modeling the Heap by Merging Equivalent Automata
- Authors: Tian Tan, Yue Li, Jingling Xue
- Purpose: Compare Zhiyi PDF, MinerU, and GLM-OCR outputs on the same computer science paper.
- Source PDF: [Tan 等 - 2017 - Efficient and precise points-to analysis modeling the heap by merging equivalent automata.pdf](Tan 等 - 2017 - Efficient and precise points-to analysis modeling the heap by merging equivalent automata.pdf)

## How to Read

Open the source PDF first, pick several structurally complex paragraphs, formulas, tables, or figures, then compare the same locations across the three `result.md` files.

## Parser Outputs

### Zhiyi PDF

- Markdown: [zhiyi/result.md](zhiyi/result.md)
- Assets: [zhiyi/assets/](zhiyi/assets/)

### MinerU

- Markdown: [mineru/result.md](mineru/result.md)
- Assets: [mineru/assets/](mineru/assets/)

### GLM-OCR

- Markdown: [glm-ocr/result.md](glm-ocr/result.md)
- Assets: [glm-ocr/assets/](glm-ocr/assets/)

## Directory Layout

```text
parser-comparison/
├── README.md
├── README.zh-CN.md
├── Tan 等 - 2017 - Efficient and precise points-to analysis modeling the heap by merging equivalent automata.pdf
├── zhiyi/
│   ├── result.md
│   └── assets/
├── mineru/
│   ├── result.md
│   └── assets/
└── glm-ocr/
    ├── result.md
    └── assets/
```

## Notes

- `result.md` keeps the parser's original Markdown output. The document body is not manually corrected.
- File names and directories are organized only to make repository references and comparisons easier.
- Before real batch processing, test 3-5 papers from your own corpus.
- Pricing, quotas, and model capabilities may change. Treat the provider descriptions in the root README as references and check official docs before large-scale use.
