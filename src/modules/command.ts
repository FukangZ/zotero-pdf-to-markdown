import { runBatch } from "./batchRunner";
import { getSelectedRegularItems } from "./selectedItems";
import type { ItemRunResult, PluginPrefs } from "./types";

const SUCCESS_LABEL = "成功";
const SKIPPED_LABEL = "跳过";
const FAILED_LABEL = "失败";

export function formatSummary(results: ItemRunResult[]): string {
  const successCount = countByStatus(results, "success");
  const skippedCount = countByStatus(results, "skipped");
  const failedResults = results.filter((result) => result.status === "failed");

  const lines = [
    "处理完成",
    "",
    `${SUCCESS_LABEL}：${successCount}`,
    `${SKIPPED_LABEL}：${skippedCount}`,
    `${FAILED_LABEL}：${failedResults.length}`,
  ];

  if (failedResults.length > 0) {
    lines.push(
      "",
      "失败详情：",
      ...failedResults.map(
        (result) => `- ${result.itemKey}: ${result.error}`,
      ),
    );
  }

  return lines.join("\n");
}

export async function runGenerateMarkdownCommand(
  prefs: PluginPrefs,
): Promise<void> {
  const window = getMainWindow();
  const items = getSelectedRegularItems();

  if (items.length === 0) {
    window.alert("请先选择至少一个常规条目。");
    return;
  }

  const shouldRun = window.confirm(
    `将为 ${items.length} 个选中条目生成 Markdown 附件。是否继续？`,
  );
  if (!shouldRun) {
    return;
  }

  const progressWindow = new ztoolkit.ProgressWindow(
    addon.data.config.addonName,
    {
      closeOnClick: true,
      closeTime: -1,
    },
  )
    .createLine({
      text: `正在处理 ${items.length} 个条目...`,
      type: "default",
      progress: 0,
    })
    .show();

  try {
    const results = await runBatch(items, prefs);
    const hasFailures = results.some((result) => result.status === "failed");
    const summary = formatSummary(results);

    progressWindow.changeLine({
      text: summary,
      type: hasFailures ? "fail" : "success",
      progress: 100,
    });
    progressWindow.startCloseTimer(hasFailures ? 10000 : 5000);

    if (hasFailures) {
      window.alert(summary);
    }
  } catch (error) {
    const message = stringifyError(error);

    progressWindow.changeLine({
      text: `处理失败\n\n${message}`,
      type: "fail",
      progress: 100,
    });
    progressWindow.startCloseTimer(10000);
    window.alert(`处理失败\n\n${message}`);
  }
}

function countByStatus(
  results: ItemRunResult[],
  status: ItemRunResult["status"],
): number {
  return results.filter((result) => result.status === status).length;
}

function getMainWindow(): Window {
  return ztoolkit.getGlobal("window") as Window;
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
