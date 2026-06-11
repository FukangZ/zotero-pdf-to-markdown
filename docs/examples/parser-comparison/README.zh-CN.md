# PDF 解析器结果对比

[English](README.md) | [简体中文](README.zh-CN.md)

本目录保存同一篇论文在不同 PDF 解析器下的 Markdown 输出，帮助用户在配置插件前直观比较解析效果。

这些文件用于展示差异，不是严格 benchmark。解析效果会受论文版式、扫描质量、语言、公式密度、表格复杂度和服务端模型版本影响。

## 示例论文

- 标题：Efficient and Precise Points-to Analysis: Modeling the Heap by Merging Equivalent Automata
- 作者：Tian Tan, Yue Li, Jingling Xue
- 用途：比较知意 PDF、MinerU、GLM-OCR 对同一篇计算机论文 PDF 的 Markdown 输出。
- 原始 PDF：[Tan 等 - 2017 - Efficient and precise points-to analysis modeling the heap by merging equivalent automata.pdf](Tan 等 - 2017 - Efficient and precise points-to analysis modeling the heap by merging equivalent automata.pdf)

## 如何阅读

建议先打开原始 PDF，选择几处结构复杂的段落、公式、表格或图片，再在三个 `result.md` 文件中按相同位置横向比较。

## 解析结果

### 知意 PDF

- Markdown：[zhiyi/result.md](zhiyi/result.md)
- 图片资源：[zhiyi/assets/](zhiyi/assets/)

### MinerU

- Markdown：[mineru/result.md](mineru/result.md)
- 图片资源：[mineru/assets/](mineru/assets/)

### GLM-OCR

- Markdown：[glm-ocr/result.md](glm-ocr/result.md)
- 图片资源：[glm-ocr/assets/](glm-ocr/assets/)

## 目录结构

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

## 注意事项

- `result.md` 保留解析器原始 Markdown 输出；未人工修正文档正文。
- 文件名和目录结构经过整理，便于在仓库中引用和比较。
- 真实批量处理前，建议先用自己的论文抽样测试 3-5 篇。
- 价格、额度和模型能力可能变化，根 README 中的服务说明应以各服务官方文档为准。
