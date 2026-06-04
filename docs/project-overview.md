# Zotero PDF to Markdown 项目文档

## 1. 项目定位

`zotero-pdf-to-markdown` 是一个 Zotero 9 桌面端插件，用于从 Zotero 条目的 PDF 附件生成 Markdown 附件，并可将 Markdown 中的临时图片链接转存到用户自己的图床或保存为本地附件资源。

核心目标是把 Zotero 中已有的论文 PDF 转换为可长期保存、可同步、可二次编辑的 Markdown 附件。插件不通过外部 Zotero Web API 写库，也不直接修改 Zotero SQLite，而是在 Zotero Desktop 内部通过 Zotero JavaScript API 完成附件读取和导入。

目标条目结构：

```text
论文条目
├── 原 PDF 附件
└── 插件生成的 Markdown 附件
```

## 2. 端到端工作流

插件当前面向 MVP 场景：用户在 Zotero 中选择一个或多个 regular item，然后通过右键菜单生成 Markdown 附件。

```text
Zotero selected regular items
  -> resolve PDF attachment
  -> read local PDF path
  -> selected PDF parser provider
  -> Markdown with temporary image URLs
  -> PicGo upload or local assets replacement
  -> write temporary .md package
  -> Zotero.Attachments.importFromFile()
  -> tag generated attachment with zotero-pdf-to-markdown
```

处理策略：

- 支持批量选择多个 Zotero regular item。
- 每个条目当前只处理第一个 PDF 附件。
- 单个条目失败不会中止整个批次。
- 已存在插件生成 Markdown 附件的条目默认跳过。
- 判重只看附件 tag `zotero-pdf-to-markdown`，不会因为用户手动添加普通 `.md` 附件而跳过。
- Markdown 无图片时直接导入 Zotero。
- Markdown 有图片且启用 PicGo 上传时，先完成 PicGo 上传和 URL 替换，再导入 Zotero。
- Markdown 有图片且关闭 PicGo 上传时，先下载图片到本地 `assets/` 目录并替换为相对路径，再导入 Zotero。

## 3. 技术架构

项目基于 `windingwind/zotero-plugin-template` 和 `zotero-plugin-toolkit` 开发，运行在 Zotero Desktop 扩展环境内。

主要层次如下：

```text
Zotero UI integration
  hooks.ts
  modules/menu.ts
  modules/command.ts

Batch orchestration
  modules/batchRunner.ts

Zotero data access
  modules/selectedItems.ts
  modules/pdfAttachmentResolver.ts
  modules/markdownAttachmentImporter.ts
  modules/generatedMarkdownMarker.ts

External services
  modules/zhiyiPdfClient.ts
  modules/mineruPdfClient.ts
  modules/picgoServerClient.ts

Markdown processing
  modules/markdownImages.ts
  modules/filenameTemplate.ts

Configuration
  modules/prefs.ts
  modules/preferenceScript.ts
  addon/prefs.js
  addon/content/preferences.xhtml
```

### 3.1 UI 与命令入口

`src/hooks.ts` 在 Zotero 启动并完成 UI 初始化后注册偏好页和主窗口右键菜单。`src/modules/menu.ts` 在 item 菜单中注册命令：

```text
从 PDF 生成 Markdown 附件
```

`src/modules/command.ts` 负责命令级交互：

- 读取当前选中的 regular item。
- 在没有可处理条目时提示用户。
- 运行前用 `window.confirm()` 确认处理数量。
- 用 `ztoolkit.ProgressWindow` 展示进度和最终摘要。
- 在存在失败条目时弹窗展示失败详情。

摘要格式当前为中文：

```text
处理完成

成功：N
跳过：N
失败：N

失败详情：
- ITEMKEY: error message
```

### 3.2 批处理编排

`src/modules/batchRunner.ts` 是当前业务主流程。它串行处理条目，并为每个条目独立捕获异常。

单条目处理顺序：

1. 检查是否已有带 `zotero-pdf-to-markdown` tag 的附件。
2. 解析 PDF 附件和本地文件路径。
3. 按 `pdfParserProvider` 调用知意或 MinerU 将 PDF 转 Markdown。
4. 提取 Markdown 图片引用。
5. 如果启用 PicGo 上传，根据 `skipUrlPrefixes` 过滤已托管图片，并逐个调用 PicGo Server 上传图片。
6. 如果关闭 PicGo 上传，下载远程图片到本地临时目录，并生成 `assets/` 相对路径。
7. 从后向前替换 Markdown 中的图片引用。
8. 渲染 Markdown 文件名。
9. 写入临时 `.md` 文件并导入 Zotero。
10. 返回 success / skipped / failed 结果。

当前实现有两组固定运行参数：

- 知意轮询间隔：`3000ms`
- 知意任务超时：`10min`
- MinerU 轮询间隔：`3000ms`
- MinerU 任务超时：`10min`

### 3.3 Zotero 数据访问

`src/modules/selectedItems.ts` 通过 `ZoteroPane.getSelectedItems()` 读取当前选择，并过滤为 regular item，排除 feed item。

`src/modules/pdfAttachmentResolver.ts` 通过 `item.getAttachments(false)` 读取子附件，筛选 `attachmentContentType === "application/pdf"` 的附件。当前策略是选择第一个 PDF 附件。如果找不到 PDF 或无法取得本地文件路径，则该条目失败。

`src/modules/markdownAttachmentImporter.ts` 负责导入最终 Markdown：

- 在 `PathUtils.tempDir` 下创建临时目录。
- 写入 UTF-8 Markdown 文件。
- 调用 `Zotero.Attachments.importFromFile()` 导入为 stored attachment。
- 设置 `contentType: "text/markdown"` 和 `charset: "utf-8"`。
- 给生成的 Markdown 附件添加 tag `zotero-pdf-to-markdown`。
- 导入完成后删除临时目录。

附件标记定义在 `src/modules/generatedMarkdownMarker.ts`：

```ts
export const GENERATED_MARKDOWN_TAG = "zotero-pdf-to-markdown";
```

该 tag 只加在 Markdown attachment 上，不加在 parent regular item 上，避免污染论文条目元数据。

## 4. 外部服务集成

### 4.1 知意 PDF 解析 API

选择 `pdfParserProvider=zhiyi` 时，`src/modules/zhiyiPdfClient.ts` 封装知意 PDF 解析流程。当前实现使用异步任务模型：

1. `POST /api/pdf-to-markdown-proxy/parse`
2. `GET /api/pdf-to-markdown-proxy/status/{task_id}`
3. `GET /api/pdf-to-markdown-proxy/download/{task_id}`

上传参数当前包括：

```text
table_mode=<pref>
formula_format=<pref>
enable_translation=false
images_as_url=true
skip_rotation_detection=false
enable_cross_page_merge=<pref>
```

关键约束：

- 鉴权使用 `X-API-Key` header。
- API Key 从 Zotero 插件偏好读取，不应写入日志或文档。
- `images_as_url=true` 使下载结果中的图片以远程 URL 形式出现。
- 下载结果会校验 `Content-Type`，当前要求包含 `text/markdown`。
- `pending` 状态会归一化为 `processing`。
- 任务状态支持 `waiting`、`processing`、`completed`、`failed`。

### 4.2 MinerU 精准解析 API

选择 `pdfParserProvider=mineru` 时，`src/modules/mineruPdfClient.ts` 封装 MinerU 精准解析流程。该接口需要 MinerU API Token，并通过 `Authorization: Bearer <Token>` 请求。

当前实现使用本地文件批量上传解析模型：

1. `POST /api/v4/file-urls/batch`
2. `PUT <file_urls[0]>`
3. `GET /api/v4/extract-results/batch/{batch_id}`
4. `GET <full_zip_url>`
5. 从结果 ZIP 中读取 `full.md`

上传任务参数当前包括：

```text
files[0].name=<local PDF filename>
files[0].data_id=<itemKey-pdfAttachmentKey>
files[0].is_ocr=<pref>
files[0].page_ranges=<pref, optional>
model_version=<pref>
language=<pref>
enable_table=<pref>
enable_formula=<pref>
```

关键约束：

- 创建上传链接和查询结果必须发送 `Authorization: Bearer <Token>`。
- 上传文件到签名 URL 时不设置 `Content-Type` header。
- 上传完成后无需额外提交解析任务，MinerU 自动扫描并提交解析。
- `state=done` 时使用 `full_zip_url` 下载结果 ZIP。
- Markdown 内容来自结果 ZIP 中的 `full.md`。
- `state=failed` 时错误信息来自 `err_msg`。
- 任务状态支持 `waiting-file`、`pending`、`running`、`converting`、`done`、`failed`。
- MinerU `full.md` 中的远程图片 URL 后续仍可进入 PicGo URL 替换流程。

### 4.3 PicGo Server

启用 `enablePicgoUpload` 后，`src/modules/picgoServerClient.ts` 封装 PicGo Server 上传。默认目标接口：

```text
POST http://127.0.0.1:36677/upload
Content-Type: application/json

{ "list": ["https://temporary.example.com/image.png"] }
```

当前实现逐个上传图片 URL，而不是批量提交多个 URL。这样可以降低图床端同名覆盖风险，也便于将失败精确定位到单张图片。

响应校验规则：

- HTTP status 必须为成功。
- JSON 中 `success` 必须为 `true`。
- `result` 必须是长度为 1 的数组。
- 返回值必须是以 `http` 开头的 URL。

如果配置了 PicGo secret，插件会将其放入 `Authorization` header。

## 5. Markdown 图片处理

`src/modules/markdownImages.ts` 只做 URL 级替换，不重排或格式化 Markdown。

MVP 支持两类图片引用：

```markdown
![alt](https://example.com/image.png)
<img src="https://example.com/image.png">
```

处理规则：

- 只提取 `http:` 和 `https:` 图片 URL。
- 支持 Markdown 图片和 HTML `<img src="...">`。
- 启用 PicGo 上传时，通过 `skipUrlPrefixes` 跳过已经属于用户图床的 URL。
- 启用 PicGo 上传时，对重复 URL 去重，只上传一次。
- 关闭 PicGo 上传时，将远程图片下载到 Markdown 附件 storage 目录下的 `assets/` 子目录，并替换为相对路径。
- 本地图片文件名使用 `fig-001.ext` 形式，扩展名优先从 `Content-Type` 推断。
- 替换时按引用位置从后向前执行，避免索引偏移。
- 未出现在 replacements 中的 URL 保持不变。

当前实现不处理以下复杂 Markdown 形态：

- reference-style image：`![alt][id]`
- 带空格或嵌套括号的 Markdown URL。
- 本地图片路径。
- base64 data URL。

## 6. 配置项

默认偏好定义在 `addon/prefs.js`，运行时由 `src/modules/prefs.ts` 读取。

| 配置项                      | 默认值                            | 说明                                  |
| --------------------------- | --------------------------------- | ------------------------------------- |
| `pdfParserProvider`         | `zhiyi`                           | PDF 解析服务，支持 `zhiyi` / `mineru` |
| `zhiyiApiUrl`               | `https://www.zhiyipdf.com`        | 知意 API base URL                     |
| `zhiyiApiKey`               | 空                                | 知意 API Key                          |
| `zhiyiTableMode`            | `markdown`                        | 知意表格输出模式                      |
| `zhiyiFormulaFormat`        | `dollar`                          | 公式输出格式                          |
| `zhiyiEnableCrossPageMerge` | `true`                            | 是否启用跨页合并                      |
| `mineruApiUrl`              | `https://mineru.net`              | MinerU API base URL                   |
| `mineruApiToken`            | 空                                | MinerU API Token                      |
| `mineruModelVersion`        | `vlm`                             | MinerU `model_version`                |
| `mineruLanguage`            | `ch`                              | MinerU OCR 语言参数                   |
| `mineruEnableTable`         | `true`                            | MinerU 是否启用表格识别               |
| `mineruIsOcr`               | `false`                           | MinerU 是否启用 OCR                   |
| `mineruEnableFormula`       | `true`                            | MinerU 是否启用公式识别               |
| `mineruPageRanges`          | 空                                | MinerU `page_ranges`，例如 `2,4-6`    |
| `enablePicgoUpload`         | `true`                            | 是否通过 PicGo 上传并替换图片 URL     |
| `picgoUploadUrl`            | `http://127.0.0.1:36677/upload`   | PicGo Server 上传接口                 |
| `picgoSecret`               | 空                                | PicGo Server secret，可选             |
| `picgoUploadIntervalMs`     | `250`                             | 单图上传后的等待时间                  |
| `skipUrlPrefixes`           | 空                                | 每行一个跳过上传的 URL 前缀           |
| `markdownFilenameTemplate`  | `{firstAuthor}-{year}-{title}.md` | Markdown 文件名模板                   |
| `existingMarkdownStrategy`  | `skip`                            | 当前固定为跳过已有插件附件            |

偏好页由 `addon/content/preferences.xhtml` 和 locale 文件渲染，当前提供中文和英文标签。`preferenceScript.ts` 负责注册偏好页，并为配置控件绑定变更日志。

## 7. 文件命名策略

`src/modules/filenameTemplate.ts` 负责渲染 Markdown 文件名。

支持占位符：

- `{firstAuthor}`
- `{year}`
- `{title}`
- `{itemKey}`

清理规则：

- Windows 非法字符 `<>:"/\|?*` 替换为 `-`。
- 连续空白折叠为单个空格。
- 文件名最长截断到 180 个字符。
- 如果模板结果没有 `.md` 后缀，自动追加。
- 空文件名回退为 `${item.key}.md`。

## 8. 错误处理与安全边界

当前实现遵循“条目级隔离”策略：每个条目独立 try/catch，失败结果进入汇总，不影响后续条目。

已覆盖的主要错误面：

- 未选择 regular item。
- 条目没有 PDF 附件。
- PDF 附件没有可用本地路径。
- 知意 API Key 为空。
- 知意任务创建、状态查询或下载失败。
- 知意任务超时或返回 failed。
- MinerU 任务创建、签名上传、状态查询或 Markdown 下载失败。
- MinerU 任务超时或返回 failed。
- 下载结果不是 Markdown。
- PicGo Server HTTP 失败。
- PicGo 返回结构不符合预期。
- Zotero 导入附件失败。

安全边界：

- 不输出 `.env`、知意 API Key、PicGo secret 等敏感信息。
- 不直接修改 Zotero SQLite。
- 不在导入后直接改 Zotero `storage` 内的 Markdown 文件；本地图片模式仅在导入流程中向该 Markdown 附件目录写入 `assets/` 图片文件。
- 不通过 `pyzotero` 或 `zotero-mcp` 写入本地 Zotero。
- Markdown 内容在导入 Zotero 前完成最终 URL 替换。

## 9. 测试与验证

项目使用 TypeScript、Mocha 和 Zotero 插件模板工具链。常用验证命令：

```powershell
npm run build
```

当前测试文件覆盖以下模块：

```text
test/batchRunner.test.ts
test/filenameTemplate.test.ts
test/imageFileDownloader.test.ts
test/markdownAttachmentImporter.test.ts
test/markdownImages.test.ts
test/mineruPdfClient.test.ts
test/pdfAttachmentResolver.test.ts
test/picgoServerClient.test.ts
test/selectedItems.test.ts
test/zhiyiPdfClient.test.ts
```

可按模块运行聚焦测试，例如：

```powershell
npx mocha --require ts-node/register test/markdownImages.test.ts
npx mocha --require ts-node/register test/filenameTemplate.test.ts
npx mocha --require ts-node/register test/mineruPdfClient.test.ts
npx mocha --require ts-node/register test/picgoServerClient.test.ts
npx mocha --require ts-node/register test/zhiyiPdfClient.test.ts
```

端到端验证需要真实 Zotero 9、所选 PDF 解析服务和本机 PicGo Server。知意和 MinerU 精准解析均需要各自的 API Key/Token。

## 10. 当前非目标

MVP 暂不实现以下能力：

- 替换或更新已有 Markdown 附件。
- 多 PDF 附件选择 UI。
- PDF 解析任务并发处理。
- PicGo 远端文件名控制。
- 对 Zotero `storage` 文件做导入后原地修改。
- 使用 Zotero Web API、`pyzotero` 或 `zotero-mcp` 写入本地库。
- 直接修改 Zotero SQLite。
- 完整 Markdown AST 解析。

## 11. 后续演进方向

可在 MVP 稳定后考虑：

- 为多 PDF 附件提供选择 UI 或主附件判定策略。
- 将 `existingMarkdownStrategy` 扩展为 `skip`、`replace`、`create-copy`。
- 支持更完整的 Markdown 图片语法。
- 为知意轮询间隔、超时和批处理并发数提供可配置项。
- 对 PicGo 上传失败提供重试策略。
- 增加端到端测试脚本，覆盖真实 Zotero 附件导入。
- 在 UI 中展示条目级实时进度，而不是只显示批次级摘要。

## 12. 参考资料

- Zotero Plugin Template: https://github.com/windingwind/zotero-plugin-template
- Zotero Plugin Development: https://www.zotero.org/support/dev/client_coding/plugin_development
- Zotero JavaScript API: https://www.zotero.org/support/dev/client_coding/javascript_api
- 知意 PDF 解析 API: https://www.zhiyipdf.com/api-docs?doc=pdf-parse
- MinerU API 文档: https://mineru.net/apiManage/docs
- PicGo Server 文档: https://docs.picgo.app/zh/gui/guide/advance#picgo-server%E7%9A%84%E4%BD%BF%E7%94%A8
