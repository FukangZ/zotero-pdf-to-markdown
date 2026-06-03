# Zotero PDF to Markdown

[![zotero target version](https://img.shields.io/badge/Zotero-9-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)

从 Zotero PDF 附件生成 Markdown 附件，并可将 Markdown 中的临时图片链接转存到用户自己的图床。

## 功能概览

- 从 Zotero 当前选中的 regular item 读取 PDF 附件。
- 调用知意 PDF 解析 API 将 PDF 转换为 Markdown。
- 可提取 Markdown 图片链接，并通过本机 PicGo Server 上传到图床。
- 启用 PicGo 上传时，将临时图片 URL 替换为 PicGo 返回的永久 URL。
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
- 条目已有插件生成的 Markdown 附件时默认跳过。
- 判重只检查附件 tag `zotero-pdf-to-markdown`，不会因为用户手动添加普通 `.md` 附件而跳过。
- Markdown 无图片时直接导入 Zotero。
- Markdown 有图片且启用 PicGo 上传时，先上传图片并替换 URL，再导入 Zotero。
- 处理结束后显示成功、跳过、失败摘要。

暂不支持：

- 替换或更新已有 Markdown 附件。
- 多 PDF 附件选择 UI。
- 知意任务并发处理。
- PicGo 远端文件名控制。
- 完整 Markdown AST 级图片解析。

## 工作流

```text
Zotero selected regular items
  -> resolve PDF attachment
  -> read local PDF path
  -> Zhiyi PDF parse API
  -> Markdown with temporary image URLs
  -> optional PicGo upload and URL replacement
  -> write temporary .md file
  -> Zotero.Attachments.importFromFile()
  -> tag generated attachment with zotero-pdf-to-markdown
```

插件运行在 Zotero Desktop 内部，通过 Zotero JavaScript API 读取条目和导入附件。它不使用 `pyzotero` 或 Zotero Web API 写入本地库，也不直接修改 Zotero SQLite 或 `storage` 目录。

## 外部依赖

### 知意 PDF 解析 API

插件使用知意 API 完成 PDF 到 Markdown 的解析。API Key 从 Zotero 插件偏好读取，并通过 `X-API-Key` header 发送。

当前解析参数包括：

- `images_as_url=true`
- `enable_translation=false`
- `table_mode`
- `formula_format`
- `enable_cross_page_merge`

下载结果会校验 `Content-Type`，预期为 Markdown 内容。

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

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `zhiyiApiUrl` | `https://www.zhiyipdf.com` | 知意 API base URL |
| `zhiyiApiKey` | 空 | 知意 API Key |
| `zhiyiTableMode` | `markdown` | 表格输出模式 |
| `zhiyiFormulaFormat` | `dollar` | 公式输出格式 |
| `zhiyiEnableCrossPageMerge` | `true` | 是否启用跨页合并 |
| `enablePicgoUpload` | `true` | 是否通过 PicGo 上传并替换图片 URL |
| `picgoUploadUrl` | `http://127.0.0.1:36677/upload` | PicGo Server 上传接口 |
| `picgoSecret` | 空 | PicGo Server secret，可选 |
| `picgoUploadIntervalMs` | `250` | 单图上传后的等待时间 |
| `skipUrlPrefixes` | 空 | 每行一个跳过上传的 URL 前缀 |
| `markdownFilenameTemplate` | `{firstAuthor}-{year}-{title}.md` | Markdown 文件名模板 |
| `existingMarkdownStrategy` | `skip` | 已有插件生成附件时的处理策略 |

关闭 `enablePicgoUpload` 时，插件会直接导入知意返回的原始 Markdown，不访问 PicGo Server。`skipUrlPrefixes` 可用于跳过已经属于个人图床的图片 URL，避免重复上传。

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
npx mocha --require ts-node/register test/picgoServerClient.test.ts
npx mocha --require ts-node/register test/zhiyiPdfClient.test.ts
```

完整测试命令：

```powershell
npm run test
```

端到端验证需要真实 Zotero 9、知意 API Key 和本机 PicGo Server。真实知意解析会消耗积分，真实 Zotero 测试建议使用可丢弃条目。

## 安全边界

- 不在日志、文档或提交中输出 `.env`、知意 API Key、PicGo secret 等敏感信息。
- 不直接修改 Zotero SQLite。
- 不在导入后直接修改 Zotero `storage` 目录内文件。
- 启用 PicGo 上传时，Markdown 内容在导入 Zotero 前完成图片 URL 替换。

## 参考资料

- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)
- [Zotero Plugin Development](https://www.zotero.org/support/dev/client_coding/plugin_development)
- [Zotero JavaScript API](https://www.zotero.org/support/dev/client_coding/javascript_api)
- [知意 PDF 解析 API](https://www.zhiyipdf.com/api-docs?doc=pdf-parse)
- [PicGo Server 文档](https://docs.picgo.app/zh/gui/guide/advance#picgo-server%E7%9A%84%E4%BD%BF%E7%94%A8)

## License

AGPL-3.0-or-later
