# Zotero 插件模板机制备忘

本文档从原模板 README 中保留对本项目仍有价值的机制说明。原模板文档面向通用 Zotero 插件脚手架，包含大量模板宣传、示例清单和多语言内容；本项目只保留与 `zotero-pdf-to-markdown` 开发、调试、构建相关的部分。

本项目基于 `windingwind/zotero-plugin-template` 和 `zotero-plugin-scaffold` 开发，但目标运行环境是 Zotero 9。

## 1. 项目配置字段

核心插件配置位于 `package.json#config`：

```jsonc
{
  "addonName": "Zotero PDF to Markdown",
  "addonID": "zotero-pdf-to-markdown@kang.local",
  "addonRef": "zoteropdftomarkdown",
  "addonInstance": "ZoteroPdfToMarkdown",
  "prefsPrefix": "extensions.zotero.zoteropdftomarkdown"
}
```

字段含义：

- `addonName`：插件管理器、进度窗口等 UI 中显示的名称。
- `addonID`：Zotero 扩展 ID，必须避免与其他插件冲突。
- `addonRef`：模板使用的短命名空间，常用于资源、元素、locale key 前缀。
- `addonInstance`：挂载到 `Zotero` 根对象下的插件实例名。
- `prefsPrefix`：插件首选项 key 前缀。

这些字段会在构建时参与占位符替换、locale/prefs 前缀生成和运行时全局对象初始化。

## 2. 开发流程

开发命令：

```powershell
npm start
```

该命令由 `zotero-plugin-scaffold` 驱动，通常会执行以下动作：

1. 以 development 模式构建插件。
2. 启动指定 Zotero 可执行文件和 profile。
3. 让 Zotero 从构建目录加载插件。
4. 打开 Zotero devtool。
5. 监听 `src/**` 和 `addon/**`，文件变化后重新构建并重载插件。

开发环境依赖 `.env` 中的 Zotero 路径和 profile 配置。不要提交 `.env`，也不要在日志或文档中输出其中的敏感信息。

## 3. 构建流程

构建命令：

```powershell
npm run build
```

当前脚本同时运行插件构建和 TypeScript 检查：

```powershell
zotero-plugin build && tsc --noEmit
```

模板构建过程的关键步骤：

- 复制 `addon/**` 静态资源到构建目录。
- 替换 `package.json#config` 中定义的占位符。
- 处理 Fluent locale 文件，避免 Zotero 本地化 key 冲突。
- 处理 `addon/prefs.js`，为首选项 key 添加 `prefsPrefix`。
- 为 locale 和 prefs 生成类型声明。
- 使用 ESBuild 从 `src/index.ts` 打包插件脚本。
- 在 production 模式下生成可安装的 XPI 和更新 manifest。

因此，修改配置字段、locale key 或 prefs key 后，应运行 `npm run build` 验证生成类型与构建结果。

## 4. 生命周期

模板使用 Zotero bootstrap 插件模型。核心调用链如下：

```text
addon/bootstrap.js startup
  -> 等待 Zotero 初始化
  -> 加载构建后的入口脚本
  -> src/index.ts 初始化插件实例
  -> src/hooks.ts onStartup
  -> src/hooks.ts onMainWindowLoad

addon/bootstrap.js shutdown
  -> src/hooks.ts onShutdown
  -> 清理 UI、菜单、监听器和插件资源
```

本项目中需要重点关注：

- `src/index.ts`：定义全局对象访问方式，并把插件实例注入运行时。
- `src/hooks.ts`：注册偏好页、主窗口菜单和窗口级资源。
- `src/modules/menu.ts`：注册 Zotero item 右键菜单。
- `src/modules/command.ts`：菜单命令入口和用户交互。

插件关闭或重载时必须清理 UI 资源，避免菜单项、监听器或 DOM 节点重复注册。

## 5. 全局对象

bootstrap 插件运行在沙盒环境中，默认没有传统 overlay 插件环境中的全局变量。模板会显式提供常用全局对象。

常见对象包括：

```text
Zotero
ZoteroPane
Zotero_Tabs
window
document
rootURI
ztoolkit
addon
```

使用约束：

- 业务模块优先通过显式参数传递依赖。
- 需要访问 Zotero 主窗口时，可通过 `ztoolkit.getGlobal()` 或当前命令上下文获取。
- 测试中不要假设真实 Zotero 全局对象存在，应通过 mock 或依赖注入隔离。

## 6. UI 与资源清理

模板集成 `zotero-plugin-toolkit`，本项目通过 `ztoolkit` 注册菜单、进度窗口和偏好页脚本。

保留的关键规则：

- 使用 `ztoolkit.Menu.register()` 注册 Zotero 菜单项。
- 使用 `ztoolkit.ProgressWindow` 展示长任务进度和摘要。
- 使用 `ztoolkit.unregisterAll()` 在窗口卸载、插件禁用或热重载时清理已注册 UI。
- 若需要创建 UI 元素，优先使用 toolkit 提供的 UI helper，以减少 XUL/HTML namespace 和清理问题。

Zotero 仍包含 XUL 相关 UI。创建元素时要明确元素所属 namespace，避免在 Zotero 窗口中生成不可用节点。

## 7. 本地化与首选项

模板会在构建时处理本地化和首选项：

- `addon/locale/**` 中的 Fluent 文件会被重命名并加前缀，避免与其他插件冲突。
- `addon/prefs.js` 中的 key 会添加 `prefsPrefix`。
- 构建后会生成对应类型声明，供 TypeScript 使用。

当前项目涉及的文件：

- `addon/locale/en-US/preferences.ftl`
- `addon/locale/zh-CN/preferences.ftl`
- `addon/content/preferences.xhtml`
- `addon/prefs.js`
- `typings/i10n.d.ts`
- `typings/prefs.d.ts`

修改偏好页或 locale 时，应保持 key 与生成类型一致，并用 `npm run build` 验证。

## 8. Zotero API 查找策略

Zotero 插件开发文档并不覆盖所有内部 API。查找 API 时优先使用以下顺序：

1. 当前项目已有代码和测试。
2. `zotero-types` 类型定义。
3. Zotero 官方文档和官方示例。
4. Zotero 源码仓库 `zotero/zotero`。
5. 从 Zotero UI 文案反查：先在 `.xhtml` 或 `.ftl` 中搜索标签，再用 locale key 反查对应 JS 实现。

对本项目特别重要的 API 包括：

- `ZoteroPane.getSelectedItems()`
- `item.getAttachments(false)`
- `attachment.getFilePathAsync()`
- `Zotero.Attachments.importFromFile()`
- `Zotero.File` / `PathUtils` 相关文件 API

涉及真实 Zotero 库写入时，优先使用可丢弃测试条目验证。

## 9. 当前项目目录映射

当前仓库已经从通用模板逐步收敛到本插件结构：

```text
addon/
  bootstrap.js                  # Zotero bootstrap 入口
  content/preferences.xhtml      # 插件偏好页 UI
  locale/**                     # Fluent 本地化
  manifest.json                  # 扩展 manifest
  prefs.js                       # 默认首选项

src/
  index.ts                       # 插件运行时入口
  hooks.ts                       # 生命周期 hooks
  addon.ts                       # 插件实例与共享数据
  modules/                       # PDF 转 Markdown 业务模块
  utils/                         # 模板工具封装

typings/
  global.d.ts                    # 全局对象类型
  i10n.d.ts                      # 构建生成的本地化类型
  prefs.d.ts                     # 构建生成的首选项类型

docs/
  project-overview.md            # 当前项目架构和业务流程
  zotero-plugin-template-notes.md # 模板机制备忘
```

`src/modules/examples.ts` 属于模板示例代码，不应作为业务架构参考。后续实现应优先参考 `docs/project-overview.md` 和 `docs/superpowers/plans/2026-05-29-zotero-pdf-to-markdown-mvp.md`。

## 10. 原模板文档处理建议

原 `doc/README-zhCN.md` 和 `doc/README-frFR.md` 中可保留信息已被本文档吸收。剩余内容主要是模板介绍、示例清单、插件列表和旧版本发布说明。

建议后续在确认无引用后删除 `doc/` 目录，避免与当前项目文档混淆。删除前应先获得明确确认。
