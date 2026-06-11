# Zotero PDF to Markdown

[![Zotero target version](https://img.shields.io/badge/Zotero-9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue?style=flat-square)](LICENSE)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

[English](README.md) | [简体中文](README.zh-CN.md)

从 Zotero PDF 附件生成更适合 AI 读取的 Markdown 附件。

Zotero PDF to Markdown 会将 Zotero 条目中的 PDF 附件转换为 Markdown
stored attachment。插件调用知意 PDF、MinerU、GLM-OCR 等 PDF 解析服务，生成比
原始 PDF 更适合 LLM、RAG、笔记系统和知识库读取的结构化 Markdown。

生成的 Markdown 会保存在原论文条目下，与原 PDF 附件并列。Markdown 中的图片链接
可以通过 PicGo Server 上传到图床，也可以保存为本地 `assets/` 资源。

## 快速概览

| 项目             | 说明                                                       |
| ---------------- | ---------------------------------------------------------- |
| 目标 Zotero 版本 | Zotero 9                                                   |
| 输入             | 选中的 Zotero regular item，且含有本地 PDF 附件            |
| 命令入口         | 条目右键菜单 ->**从 PDF 生成 Markdown 附件**         |
| 输出             | 原条目下的一个 Markdown stored attachment                  |
| 解析服务         | 知意 PDF、MinerU、GLM-OCR                                  |
| 图片模式         | 通过 PicGo Server 上传本地图片文件，或保留本地 `assets/` |
| 重复处理         | 已存在插件生成 Markdown 附件时跳过                         |

## 为什么需要这个插件

Zotero 很适合管理论文 PDF，但 PDF 本质上是面向排版和阅读的格式。对 AI 工作流
而言，PDF 往往不是理想输入：文本抽取不稳定，分栏结构难以切分，公式、表格、图片
和图注也不容易可靠保留。

Markdown 更适合作为科研 AI 工作流的中间格式：

- 更容易被切分、索引、检索、向量化并输入给 LLM 工具。
- 比普通 PDF 文本抽取更显式地保留文档结构。
- 可以接入 Obsidian、VS Code、静态站点、RAG 系统和自定义脚本。
- 可以作为普通 Zotero 附件继续编辑、归档、同步和复用。

本插件不替代 Zotero PDF 阅读器，而是为原 PDF 生成一份更适合 AI 和二次处理的
Markdown 副本，同时保持原 PDF 不变。

## 功能亮点

- 从一个或多个选中的 Zotero regular item 生成 Markdown 附件。
- 支持知意 PDF、MinerU 或 GLM-OCR 作为 PDF 解析服务。
- 在解析服务支持的前提下保留论文结构，包括标题、表格、公式和图片引用。
- 将最终 Markdown 导入为 Zotero stored attachment。
- 生成的 Markdown 保存在原论文条目下。
- 支持通过本机 PicGo Server 上传本地化后的图片文件。
- 也可关闭 PicGo，将远程图片保存为本地 `assets/` 资源。
- 为插件生成的 Markdown 附件添加 `zotero-pdf-to-markdown` tag。
- 条目已有插件生成的 Markdown 附件时自动跳过。
- 串行批处理多个条目，单个条目失败不影响后续条目。

目标条目结构：

```text
论文条目
├── 原 PDF 附件
└── 插件生成的 Markdown 附件
    └── tag: zotero-pdf-to-markdown
```

## 安装

本项目面向 Zotero 9。

发布包可用后，在 Zotero 中安装 `.xpi` 文件：

1. 从
   [项目 releases 页面](https://github.com/kang/zotero-pdf-to-markdown/releases/latest)
   下载最新 `.xpi` 文件。
2. 打开 Zotero。
3. 进入 **工具** -> **插件**。
4. 点击齿轮图标，选择 **Install Add-on From File...**。
5. 选择下载的 `.xpi` 文件。
6. 按需重启 Zotero。

如果浏览器把 `.xpi` 当作浏览器扩展安装，请右键下载链接并选择另存为。

开发构建见 [开发](#开发)。

## 快速开始

一次性设置：

1. 安装插件。
2. 打开 Zotero 中的插件偏好设置。
3. 选择 PDF 解析服务：`zhiyi`、`mineru` 或 `glmocr`。
4. 填写对应的 API Key 或 Token。
5. 可选：如果需要上传图片到图床，启动 PicGo Server。

生成 Markdown：

1. 在 Zotero 中选中一个或多个论文条目。
2. 右键选择 **从 PDF 生成 Markdown 附件**。
3. 等待处理摘要。
4. 在原论文条目下打开生成的 Markdown 附件。

## 必要配置

至少需要选择并配置一个 PDF 解析服务。

### 解析器选择

详细参数在 Zotero 插件偏好页中配置。下表只保留效果、价格和官方链接，因为这通常是用户选择解析器时最关心的信息。

默认 `pdfParserProvider` 为 `zhiyi`。

价格和额度可能变化。购买会员或批量解析前，请以官网信息为准。

| 解析器               | 简介与适用场景                                                                            | 效果与价格                                                                                                        | 官方文档                                                     | 示例                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| 知意 PDF (`zhiyi`) | PDF 解析与翻译平台，可将复杂 PDF 转为 Markdown；适合优先追求解析效果。                    | 付费。知意公开价格中 PDF 解析为 2 积分/页，高级版 ¥19.9/月含 4000 积分，约可解析 2000 页/月。                    | [知意 PDF](https://www.zhiyipdf.com/api-docs?doc=pdf-parse)     | [解析结果示例](docs/examples/parser-comparison/README.zh-CN.md#知意-pdf) |
| MinerU (`mineru`)  | 面向 LLM / Agent 的文档解析引擎，可输出 Markdown、JSON 等机器可读格式；适合通用论文解析。 | 当前 API 可免费使用。解析效果通常次于知意，但高峰期可能排队等待。                                                 | [MinerU API](https://mineru.net/apiManage/docs)                 | [解析结果示例](docs/examples/parser-comparison/README.zh-CN.md#mineru)   |
| GLM-OCR (`glmocr`) | 轻量级专业 OCR 模型，可用于文档解析；适合对成本敏感的场景。                               | 效果尚可，价格便宜。GLM-OCR 按 token 计费，官方文档给出的量级约为 1 元处理 200 份 10 页简单 PDF，约 0.001 元/页。 | [GLM-OCR](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-ocr) | [解析结果示例](docs/examples/parser-comparison/README.zh-CN.md#glm-ocr)  |

### 图片处理

| 配置项                       | 默认值                              | 说明                                     |
| ---------------------------- | ----------------------------------- | ---------------------------------------- |
| `enablePicgoUpload`        | `true`                            | 是否通过 PicGo Server 上传本地图片文件。 |
| `picgoUploadUrl`           | `http://127.0.0.1:36677/upload`   | PicGo Server 上传接口。                  |
| `picgoSecret`              | 空                                  | PicGo Server secret，可选。              |
| `skipUrlPrefixes`          | 空                                  | 每行一个 URL 前缀，匹配后不重复上传。    |
| `markdownFilenameTemplate` | `{firstAuthor}-{year}-{title}.md` | 生成 Markdown 的文件名模板。             |

### 解析器配置项

只有当前选中的解析器需要填写凭据。高级参数通常可以保留默认值。

| 解析器   | 必填配置项         | 常用高级配置项                                                                                                                                       |
| -------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 知意 PDF | `zhiyiApiKey`    | `zhiyiApiUrl`、`zhiyiTableMode`、`zhiyiFormulaFormat`、`zhiyiEnableCrossPageMerge`                                                           |
| MinerU   | `mineruApiToken` | `mineruApiUrl`、`mineruModelVersion`、`mineruLanguage`、`mineruEnableTable`、`mineruIsOcr`、`mineruEnableFormula`、`mineruPageRanges`  |
| GLM-OCR  | `glmOcrApiKey`   | `glmOcrApiUrl`、`glmOcrReturnCropImages`、`glmOcrNeedLayoutVisualization`、`glmOcrStartPageId`、`glmOcrEndPageId`、`glmOcrMaxFileSizeMb` |

文件名模板支持 `{firstAuthor}`、`{year}`、`{title}` 和 `{itemKey}`。Windows
非法文件名字符会替换为 `-`；模板没有 `.md` 后缀时会自动追加。

## 使用方式

选中一个或多个包含 PDF 附件的 Zotero regular item，然后在条目右键菜单中选择：

```text
从 PDF 生成 Markdown 附件
```

插件当前只处理每个条目的第一个 PDF 附件。如果某个条目已经存在带
`zotero-pdf-to-markdown` tag 的 Markdown 附件，该条目会被跳过。

命令结束后会显示处理摘要：

```text
成功：N
跳过：N
失败：N
```

失败按条目隔离。单个条目的解析或上传失败不会中断后续条目。

## 输出行为

- 插件不会修改原 PDF。
- 生成的 Markdown 会导入为 Zotero stored attachment。
- 插件生成的 Markdown 附件会添加 `zotero-pdf-to-markdown` tag。
- 重复检测只检查 Markdown 附件上的这个 tag。
- 用户手动添加的普通 `.md` 附件不会导致条目被跳过。

## 图片处理

插件会在导入 Markdown 到 Zotero 前替换图片引用。

支持的图片形式：

```markdown
![alt](https://example.com/image.png)
<img src="https://example.com/image.png">
```

仅处理 `http:` 和 `https:` URL。

启用 PicGo 上传时：

- 图片会先本地化为 `assets/{itemKey}-fig-001.ext` 文件。
- 本地图片文件路径会一次性批量提交给 PicGo Server。
- 匹配 `skipUrlPrefixes` 的 URL 保持不变。
- 临时图片 URL 会替换为 PicGo Server 返回的图床 URL。

关闭 PicGo 上传时：

- 远程图片会下载到 `assets/` 目录。
- Markdown 图片 URL 会替换为相对本地路径。

当前实现是 URL 级替换，不使用完整 Markdown AST 解析。

## 工作流

```text
选中的 Zotero regular items
  -> 解析第一个 PDF 附件
  -> 读取本地 PDF 路径
  -> 调用选中的 PDF 解析服务
  -> 得到包含图片引用的 Markdown
  -> 本地化图片文件
  -> 通过 PicGo 上传或保留本地 assets
  -> 写入最终 Markdown 包
  -> 导入为 Zotero stored attachment
  -> 添加 zotero-pdf-to-markdown tag
```

插件运行在 Zotero Desktop 内部，并使用 Zotero 内部 JavaScript API。它不会直接写
Zotero 数据库，不会修改 Zotero SQLite，也不会使用 Zotero Web API 写入本地库。

## 隐私与数据流

插件会把选中条目的 PDF 文件发送给你配置的解析服务。启用 PicGo 上传时，本地化后的
图片文件也会发送给本机 PicGo Server，再由 PicGo 按你的配置上传到图床。

API Key 和 PicGo secret 从 Zotero 插件偏好读取。不要分享包含这些值的日志或截图。

## 已知限制

- 只处理 Zotero regular item，忽略 feed item。
- 每个条目当前只使用第一个 PDF 附件。
- 已有插件生成 Markdown 附件时跳过，不替换。
- 暂无多 PDF 附件选择 UI。
- PDF 解析任务串行处理。
- PicGo 上传失败暂不重试。
- GLM-OCR 输入文件超过 `glmOcrMaxFileSizeMb` 时会在上传前失败。
- 不处理 reference-style Markdown 图片。
- 不完整支持带空格或嵌套括号的 Markdown URL。
- 真实 PDF 解析服务可能消耗账号额度或积分。

## 常见问题

### 条目为什么被跳过？

该条目可能已经有带 `zotero-pdf-to-markdown` tag 的 Markdown 附件。插件使用该 tag
避免重复生成 Markdown 附件。

### PicGo 上传失败怎么办？

确认 PicGo Server 已启动，并检查 `picgoUploadUrl` 是否指向正确的 `/upload` 接口。
如果配置了 PicGo secret，插件偏好中的 secret 也需要一致。

### 为什么部分图片没有被替换？

插件只处理 Markdown 图片语法和 HTML `img src` 中的直接 `http:` / `https:` 图片
URL。本地路径、data URL、reference-style 图片和复杂 Markdown URL 会保持不变。

### 解析结果质量不理想怎么办？

解析质量取决于所选服务和 PDF 本身。扫描件、双栏排版、密集公式和复杂表格可能需要
切换解析器，或调整解析器自己的 OCR / 页面范围等参数。

### 插件会修改原 PDF 吗？

不会。原 PDF 保持不变。插件会在同一 Zotero 条目下创建一个独立的 Markdown stored
attachment。

### 插件会直接写 Zotero SQLite 吗？

不会。Markdown 附件通过 Zotero 附件 API 导入。

## 开发

安装依赖：

```powershell
npm install
```

构建插件并执行 TypeScript 检查：

```powershell
npm run build
```

启动 Zotero 插件开发服务：

```powershell
npm run start
```

运行测试：

```powershell
npm run test
```

## 项目说明

架构、模块职责、API 细节和实现约束见
[docs/project-overview.md](docs/project-overview.md)。

## License

AGPL-3.0-or-later.
