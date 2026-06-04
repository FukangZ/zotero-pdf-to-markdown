# Zotero PDF to Markdown

[![zotero target version](https://img.shields.io/badge/Zotero-9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)

从 Zotero PDF 附件生成 Markdown 附件，并可将 Markdown 中的临时图片链接转存到图床或保存为本地附件资源。

## 功能概览

- 从 Zotero 当前选中的 regular item 读取 PDF 附件。
- 可选择知意 PDF 或 MinerU 将 PDF 转换为 Markdown。
- 可提取 Markdown 图片链接，并通过本机 PicGo Server 上传到图床，或下载到 Markdown 附件目录。
- 启用 PicGo 上传时，将临时图片 URL 替换为 PicGo 返回的永久 URL。
- 关闭 PicGo 上传时，将临时图片下载到 `assets/` 并替换为相对路径。
- 将最终 Markdown 文件导入为 Zotero stored attachment。
- 给插件生成的 Markdown 附件添加 `zotero-pdf-to-markdown` tag。
- 批量处理多个条目，单个条目失败不影响后续条目。

目标条目结构：

```text
论文条目
├── 原 PDF 附件
└── 插件生成的 Markdown 附件
```

## 当前范围

当前版本面向 MVP 场景：在 Zotero 中选中一个或多个论文条目，通过右键菜单生成 Markdown 附件。

已支持：

- 每个 Zotero regular item 处理一个 PDF 附件。
- 可在偏好页选择 `zhiyi` 或 `mineru` 作为 PDF 解析服务。
- 条目已有插件生成的 Markdown 附件时默认跳过。
- 判重只检查附件 tag `zotero-pdf-to-markdown`，不会因为用户手动添加普通 `.md` 附件而跳过。
- Markdown 无图片时直接导入 Zotero。
- Markdown 有图片且启用 PicGo 上传时，先上传图片并替换 URL，再导入 Zotero。
- Markdown 有图片且关闭 PicGo 上传时，先下载图片到本地 `assets/` 目录并替换为相对路径，再导入 Zotero。
- 处理结束后显示成功、跳过、失败摘要。

暂不支持：

- 替换或更新已有 Markdown 附件。
- 多 PDF 附件选择 UI。
- PDF 解析任务并发处理。
- PicGo 远端文件名控制。
- 完整 Markdown AST 级图片解析。

## 工作流

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

插件运行在 Zotero Desktop 内部，通过 Zotero JavaScript API 读取条目和导入附件。它不使用 `pyzotero` 或 Zotero Web API 写入本地库，也不直接修改 Zotero SQLite。

## 外部依赖

### 知意 PDF 解析 API

选择 `zhiyi` 时，插件使用知意 API 完成 PDF 到 Markdown 的解析。API Key 从 Zotero 插件偏好读取，并通过 `X-API-Key` header 发送。

当前解析参数包括：

- `images_as_url=true`
- `enable_translation=false`
- `table_mode`
- `formula_format`
- `enable_cross_page_merge`

下载结果会校验 `Content-Type`，预期为 Markdown 内容。

### MinerU 精准解析 API

选择 `mineru` 时，插件使用 MinerU 精准解析 API。该接口需要在偏好页配置 MinerU API Token，并通过 `Authorization: Bearer <Token>` 请求。

当前实现使用本地文件批量上传解析流程：

1. `POST /api/v4/file-urls/batch` 获取 `batch_id` 和 `file_urls`。
2. `PUT file_urls[0]` 上传本地 PDF，上传时不设置 `Content-Type`。
3. `GET /api/v4/extract-results/batch/{batch_id}` 轮询任务状态。
4. 任务 `state=done` 后下载 `full_zip_url`。
5. 从结果 ZIP 中读取 `full.md` 作为 Markdown 内容。

### PicGo Server

启用 `enablePicgoUpload` 后，插件通过本机 PicGo Server 上传 Markdown 中的远程图片 URL。默认接口为：

```text
POST http://127.0.0.1:36677/upload
Content-Type: application/json

{ "list": ["https://temporary.example.com/image.png"] }
```

当前实现逐个上传图片 URL，便于定位单图失败并降低图床端覆盖风险。如果配置了 PicGo secret，插件会将其放入 `Authorization` header。

## 配置项

默认偏好定义在 `addon/prefs.js`，运行时由 `src/modules/prefs.ts` 读取。

| 配置项                      | 默认值                            | 说明                                  |
| --------------------------- | --------------------------------- | ------------------------------------- |
| `pdfParserProvider`         | `zhiyi`                           | PDF 解析服务，支持 `zhiyi` / `mineru` |
| `zhiyiApiUrl`               | `https://www.zhiyipdf.com`        | 知意 API base URL                     |
| `zhiyiApiKey`               | 空                                | 知意 API Key                          |
| `zhiyiTableMode`            | `markdown`                        | 表格输出模式                          |
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
| `existingMarkdownStrategy`  | `skip`                            | 已有插件生成附件时的处理策略          |

关闭 `enablePicgoUpload` 时，插件不访问 PicGo Server，而是将 Markdown 中的远程图片下载到 Markdown 附件 storage 目录下的 `assets/` 子目录，并把图片引用改为相对路径。`skipUrlPrefixes` 仅用于 PicGo 上传模式，可跳过已经属于个人图床的图片 URL，避免重复上传。

## Markdown 图片处理

MVP 只处理 URL 级替换，不重排或格式化 Markdown。

支持的图片形式：

```markdown
![alt](https://example.com/image.png)
<img src="https://example.com/image.png">
```

处理规则：

- 只处理 `http:` 和 `https:` URL。
- 启用 PicGo 上传时，相同图片 URL 去重，只上传一次。
- 关闭 PicGo 上传时，远程图片会下载为 `assets/fig-001.ext` 形式的本地文件。
- 替换时从后向前执行，避免索引偏移。
- 未命中替换表的 URL 保持不变。

## 目录结构

```text
src/
  hooks.ts
  modules/
    batchRunner.ts
    command.ts
    filenameTemplate.ts
    generatedMarkdownMarker.ts
    markdownAttachmentImporter.ts
    markdownImages.ts
    menu.ts
    pdfAttachmentResolver.ts
    picgoServerClient.ts
    prefs.ts
    selectedItems.ts
    types.ts
    zhiyiPdfClient.ts
addon/
  content/preferences.xhtml
  locale/
  prefs.js
docs/
  project-overview.md
test/
```

更完整的背景、架构和实现细节见 [`docs/project-overview.md`](docs/project-overview.md)。

## 开发

安装依赖：

```powershell
npm install
```

构建并执行 TypeScript 类型检查：

```powershell
npm run build
```

启动 Zotero 插件开发服务：

```powershell
npm run start
```

## 测试

聚焦运行模块测试：

```powershell
npx mocha --require ts-node/register test/markdownImages.test.ts
npx mocha --require ts-node/register test/filenameTemplate.test.ts
npx mocha --require ts-node/register test/mineruPdfClient.test.ts
npx mocha --require ts-node/register test/picgoServerClient.test.ts
npx mocha --require ts-node/register test/zhiyiPdfClient.test.ts
```

完整测试命令：

```powershell
npm run test
```

端到端验证需要真实 Zotero 9、所选 PDF 解析服务和本机 PicGo Server。知意和 MinerU 精准解析均需要各自的 API Key/Token。

## 安全边界

- 不在日志、文档或提交中输出 `.env`、知意 API Key、PicGo secret 等敏感信息。
- 不直接修改 Zotero SQLite。
- 不在导入后直接修改 Zotero `storage` 目录内的 Markdown 文件。
- Markdown 内容在导入 Zotero 前完成图片 URL 替换。

## 参考资料

- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)
- [Zotero Plugin Development](https://www.zotero.org/support/dev/client_coding/plugin_development)
- [Zotero JavaScript API](https://www.zotero.org/support/dev/client_coding/javascript_api)
- [知意 PDF 解析 API](https://www.zhiyipdf.com/api-docs?doc=pdf-parse)
- [MinerU API 文档](https://mineru.net/apiManage/docs)
- [PicGo Server 文档](https://docs.picgo.app/zh/gui/guide/advance#picgo-server%E7%9A%84%E4%BD%BF%E7%94%A8)

## License

AGPL-3.0-or-later
