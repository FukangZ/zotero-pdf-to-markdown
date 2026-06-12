# Zotero PDF to Markdown

[![Zotero target version](https://img.shields.io/badge/Zotero-9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue?style=flat-square)](LICENSE)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

[English](README.md) | [简体中文](README.zh-CN.md)

Generate AI-friendly Markdown attachments from PDF attachments in Zotero.

Zotero PDF to Markdown converts the PDF attachment of a Zotero item into a
Markdown stored attachment. It uses mature PDF parsing services, such as Zhiyi
PDF, MinerU, and GLM-OCR, to produce structured Markdown that is easier for
LLMs, RAG pipelines, note systems, and knowledge bases to read than raw PDF
files.

The generated Markdown stays under the original Zotero item, next to the source
PDF. Image links in the Markdown can be uploaded to a PicGo-powered image host
or materialized as local `assets/` files.

## At a Glance

| Item                  | Details                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| Target Zotero version | Zotero 9                                                               |
| Input                 | Selected Zotero regular items with local PDF attachments               |
| Command               | Item context menu ->**Generate Markdown Attachment from PDF**          |
| Output                | One Markdown stored attachment under the original item                 |
| Parser providers      | Zhiyi PDF, MinerU, GLM-OCR                                             |
| Image modes           | Upload local image files through PicGo Server, or keep local `assets/` |
| Duplicate handling    | Skip items that already have a generated Markdown attachment           |

## Why This Plugin

Zotero is excellent for managing papers, but PDF is a layout-oriented format.
For AI workflows, PDF often becomes a weak input format: text extraction is
unstable, column layouts are hard to segment, and formulas, tables, figures, and
captions can be difficult to preserve.

Markdown is a better intermediate format for many research workflows:

- It is easier to chunk, index, search, embed, and feed into LLM tools.
- It preserves document structure more explicitly than plain extracted text.
- It works well with Obsidian, VS Code, static sites, RAG systems, and scripts.
- It can be edited, archived, synchronized, and reused as a normal Zotero
  attachment.

This plugin does not replace the Zotero PDF reader. It creates an AI-friendly
Markdown copy of the paper while keeping the original PDF untouched.

## Features

- Convert one or more selected Zotero regular items from PDF to Markdown.
- Use Zhiyi PDF, MinerU, or GLM-OCR as the PDF parser provider.
- Preserve paper structure where the parser supports it, including headings,
  tables, formulas, and image references.
- Import the final Markdown as a Zotero stored attachment.
- Keep the generated Markdown under the original paper item.
- Upload materialized image files through a local PicGo Server.
- Or disable PicGo and save remote images as local `assets/` resources.
- Tag generated Markdown attachments with `zotero-pdf-to-markdown`.
- Skip items that already have a plugin-generated Markdown attachment.
- Process batches sequentially; one failed item does not stop the whole batch.

Target item structure:

```text
Paper item
├── Original PDF attachment
└── Generated Markdown attachment
    └── tag: zotero-pdf-to-markdown
```

## Installation

This project targets Zotero 9.

When a release package is available, install the `.xpi` file in Zotero:

1. Download the latest `.xpi` from the
   [project releases page](https://github.com/FukangZ/zotero-pdf-to-markdown/releases/latest).
2. Open Zotero.
3. Go to **Tools** -> **Add-ons**.
4. Click the gear icon and choose **Install Add-on From File...**.
5. Select the downloaded `.xpi` file.
6. Restart Zotero if required.

If your browser tries to install the `.xpi` as a browser extension, right-click
the file link and choose **Save Link As...** instead.

For development builds, see [Development](#development).

## Quick Start

One-time setup:

1. Install the plugin.
2. Open the plugin preferences in Zotero.
3. Select a PDF parser provider: `zhiyi`, `mineru`, or `glmocr`.
4. Fill in the corresponding API key or token.
5. Optional: start PicGo Server if you want images uploaded to your image host.

Generate Markdown:

1. Select one or more regular paper items in Zotero.
2. Right-click and choose **Generate Markdown Attachment from PDF**.
3. Wait for the summary dialog.
4. Open the generated Markdown attachment under the original item.

## Required Configuration

At minimum, select and configure one PDF parser provider.

### Parser Selection

Detailed parser parameters are configured in the Zotero preference page. The
table below focuses on quality, cost, and official links because those are the
main decision factors.

The default `pdfParserProvider` is `zhiyi`.

Prices and quotas can change. Check the official pages before purchasing or
running a large batch.

| Provider            | Introduction and best fit                                                                                                             | Quality and cost notes                                                                                                                                 | Official docs                                                   | Example                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Zhiyi PDF (`zhiyi`) | A PDF parsing and translation platform that converts complex PDFs into Markdown. Best when quality matters most.                      | Paid. Zhiyi's public pricing lists PDF parsing at 2 credits/page and the monthly plan at ¥19.9/month with 4000 credits, roughly 2000 pages/month.      | [Zhiyi PDF](https://www.zhiyipdf.com/api-docs?doc=pdf-parse)    | [Comparison example](docs/examples/parser-comparison/README.md#zhiyi-pdf) |
| MinerU (`mineru`)   | An LLM/Agent document parsing engine that outputs Markdown, JSON, and other machine-readable formats. Good for general paper parsing. | Free API in current use. Parsing quality is usually next after Zhiyi, but tasks may queue during peak hours.                                           | [MinerU API](https://mineru.net/apiManage/docs)                 | [Comparison example](docs/examples/parser-comparison/README.md#mineru)    |
| GLM-OCR (`glmocr`)  | A lightweight professional OCR model for document parsing. Good when cost is the main constraint.                                     | Usable parsing quality and low cost. GLM-OCR pricing is token-based; official docs describe about ¥1 for 200 simple 10-page PDFs, roughly ¥0.001/page. | [GLM-OCR](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-ocr) | [Comparison example](docs/examples/parser-comparison/README.md#glm-ocr)   |

### Image Handling

| Preference                 | Default                           | Description                                                    |
| -------------------------- | --------------------------------- | -------------------------------------------------------------- |
| `enablePicgoUpload`        | `true`                            | Upload materialized image files through PicGo Server.          |
| `picgoUploadUrl`           | `http://127.0.0.1:36677/upload`   | PicGo Server upload endpoint.                                  |
| `picgoSecret`              | Empty                             | Optional PicGo Server secret.                                  |
| `skipUrlPrefixes`          | Empty                             | One URL prefix per line. Matching URLs are not uploaded again. |
| `markdownFilenameTemplate` | `{firstAuthor}-{year}-{title}.md` | Generated Markdown filename template.                          |

### Provider Preferences

Only the selected provider's credential is required. Advanced values can usually
keep their defaults.

| Provider  | Required preference | Useful advanced preferences                                                                                                              |
| --------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Zhiyi PDF | `zhiyiApiKey`       | `zhiyiApiUrl`, `zhiyiTableMode`, `zhiyiFormulaFormat`, `zhiyiEnableCrossPageMerge`                                                       |
| MinerU    | `mineruApiToken`    | `mineruApiUrl`, `mineruModelVersion`, `mineruLanguage`, `mineruEnableTable`, `mineruIsOcr`, `mineruEnableFormula`, `mineruPageRanges`    |
| GLM-OCR   | `glmOcrApiKey`      | `glmOcrApiUrl`, `glmOcrReturnCropImages`, `glmOcrNeedLayoutVisualization`, `glmOcrStartPageId`, `glmOcrEndPageId`, `glmOcrMaxFileSizeMb` |

Filename templates support `{firstAuthor}`, `{year}`, `{title}`, and
`{itemKey}`. Invalid Windows filename characters are replaced with `-`; `.md`
is appended when the template does not include it.

## Usage

Select one or more regular Zotero items that contain PDF attachments. Then use
the item context menu:

```text
Generate Markdown Attachment from PDF
```

The plugin currently processes the first PDF attachment of each item. If an item
already has a Markdown attachment tagged with `zotero-pdf-to-markdown`, the item
is skipped.

The command shows a final summary:

```text
成功：N
跳过：N
失败：N
```

Failures are isolated per item, so a single parser or upload error does not stop
the remaining items.

## Output Behavior

- The source PDF is never modified.
- The generated Markdown is imported as a Zotero stored attachment.
- Generated Markdown attachments are tagged with `zotero-pdf-to-markdown`.
- Duplicate detection checks that tag on Markdown attachments only.
- User-created `.md` attachments without that tag do not cause the item to be skipped.

## Image Handling

The plugin rewrites image references before importing the Markdown into Zotero.

Supported image forms:

```markdown
![alt](https://example.com/image.png)
<img src="https://example.com/image.png">
```

Only `http:` and `https:` URLs are processed.

When PicGo upload is enabled:

- Images are first materialized as local `assets/{itemKey}-fig-001.ext` files.
- Local asset file paths are uploaded to PicGo Server in one batch request.
- URLs matching `skipUrlPrefixes` are kept unchanged.
- Temporary image URLs are replaced with URLs returned by PicGo Server.

When PicGo upload is disabled:

- Images are materialized into an `assets/` directory.
- Markdown image URLs are replaced with relative local paths.

The plugin performs URL-level replacement. It does not parse Markdown with a full
Markdown AST.

## Workflow

```text
Selected Zotero regular items
  -> resolve first PDF attachment
  -> read local PDF path
  -> call selected PDF parser provider
  -> receive Markdown with image references
  -> materialize image files
  -> upload through PicGo or keep local assets
  -> write final Markdown package
  -> import as Zotero stored attachment
  -> tag generated attachment with zotero-pdf-to-markdown
```

The plugin runs inside Zotero Desktop and uses Zotero's internal JavaScript APIs.
It does not write to the Zotero database directly, does not modify Zotero
SQLite, and does not use the Zotero Web API to write local library data.

## Privacy and Data Flow

This plugin sends the selected PDF file to the configured parser provider. If
PicGo upload is enabled, materialized image files are also sent to your local
PicGo Server, which then uploads them according to your PicGo configuration.

API keys and PicGo secrets are read from Zotero plugin preferences. Do not share
logs or screenshots that contain these values.

## Known Limitations

- Only Zotero regular items are processed. Feed items are ignored.
- Each item currently uses the first PDF attachment only.
- Existing plugin-generated Markdown attachments are skipped, not replaced.
- There is no multi-PDF selection UI yet.
- PDF parser tasks are processed sequentially.
- PicGo upload retries are not implemented.
- GLM-OCR input files above `glmOcrMaxFileSizeMb` are rejected before upload.
- Reference-style Markdown images are not processed.
- Markdown URLs with spaces or nested parentheses are not fully supported.
- Real PDF parsing services may consume account quota or credits.

## Troubleshooting

### The item is skipped

The item probably already has a Markdown attachment tagged with
`zotero-pdf-to-markdown`. The plugin uses this tag to avoid generating duplicate
Markdown attachments.

### PicGo upload fails

Check that PicGo Server is running and that `picgoUploadUrl` points to the
correct `/upload` endpoint. If you configured a PicGo secret, make sure the
plugin preference uses the same value.

### Some images are not replaced

Only direct `http:` and `https:` image URLs in Markdown image syntax or HTML
`img src` attributes are processed. Local paths, data URLs, reference-style
images, and complex Markdown URLs are left unchanged.

### The parser returns poor Markdown

Parser quality depends on the selected provider and the PDF itself. Scanned
documents, two-column layouts, dense formulas, and complex tables may require a
different provider or provider-specific OCR settings.

### Will the plugin modify my original PDF?

No. The source PDF remains unchanged. The plugin creates a separate Markdown
stored attachment under the same Zotero item.

### Will the plugin write to Zotero SQLite directly?

No. Markdown attachments are imported through Zotero's attachment APIs.

## Development

Install dependencies:

```powershell
npm install
```

Build the plugin and run TypeScript checks:

```powershell
npm run build
```

Start the Zotero plugin development server:

```powershell
npm run start
```

Run tests:

```powershell
npm run test
```

## Project Notes

For architecture, module responsibilities, API details, and implementation
constraints, see [docs/project-overview.md](docs/project-overview.md).

## License

AGPL-3.0-or-later.
