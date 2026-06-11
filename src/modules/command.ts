import { runBatch } from "./batchRunner";
import { getSelectedRegularItems } from "./selectedItems";
import type {
  ConversionProgress,
  ConversionProgressReporter,
  ItemRunResult,
  PluginPrefs,
} from "./types";
import { getString } from "../utils/locale";

const MAX_VISIBLE_TITLE_LENGTH = 40;

interface ProgressWindowLine {
  changeLine(options: {
    text: string;
    type: "default" | "success" | "fail";
    progress: number;
  }): void;
}

interface CommandProgressState {
  completedItemIDs: Set<number>;
  displayedProgress: number;
  itemIndexes: Map<number, number>;
  itemPercents: Map<number, number>;
  totalItems: number;
}

export function formatSummary(results: ItemRunResult[]): string {
  const successCount = countByStatus(results, "success");
  const skippedCount = countByStatus(results, "skipped");
  const failedResults = results.filter((result) => result.status === "failed");

  const lines = [
    getString("command-summary-title"),
    "",
    getString("command-summary-success", { args: { count: successCount } }),
    getString("command-summary-skipped", { args: { count: skippedCount } }),
    getString("command-summary-failed", {
      args: { count: failedResults.length },
    }),
  ];

  if (failedResults.length > 0) {
    lines.push(
      "",
      getString("command-summary-failure-details"),
      ...failedResults.map((result) => `- ${result.itemKey}: ${result.error}`),
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
    window.alert(getString("command-no-regular-items"));
    return;
  }

  const shouldRun = window.confirm(
    getString("command-confirm-run", { args: { count: items.length } }),
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
      text: getString("command-progress-processing", {
        args: { count: items.length },
      }),
      type: "default",
      progress: 0,
    })
    .show();

  try {
    const results = await runBatch(
      items,
      prefs,
      createCommandProgressUpdater(items, progressWindow),
    );
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
    const failureMessage = getString("command-processing-failed", {
      args: { message },
    });

    progressWindow.changeLine({
      text: failureMessage,
      type: "fail",
      progress: 100,
    });
    progressWindow.startCloseTimer(10000);
    window.alert(failureMessage);
  }
}

export function createCommandProgressUpdater(
  items: Zotero.Item[],
  progressWindow: ProgressWindowLine,
): ConversionProgressReporter {
  const state = createCommandProgressState(items);

  return (progress) => {
    const view = createCommandProgressView(progress, state);

    progressWindow.changeLine({
      text: view.text,
      type: progress.stage === "failed" ? "fail" : "default",
      progress: view.progress,
    });
  };
}

function createCommandProgressState(
  items: Zotero.Item[],
): CommandProgressState {
  return {
    completedItemIDs: new Set(),
    displayedProgress: 0,
    itemIndexes: new Map(items.map((item, index) => [item.id, index])),
    itemPercents: new Map(),
    totalItems: items.length,
  };
}

function createCommandProgressView(
  progress: ConversionProgress,
  state: CommandProgressState,
): { text: string; progress: number } {
  const itemPercent = updateItemPercent(progress, state);

  if (progress.stage === "completed") {
    state.completedItemIDs.add(progress.itemID);
  }

  const currentIndex = (state.itemIndexes.get(progress.itemID) ?? 0) + 1;
  const completedCount = state.completedItemIDs.size;
  const displayedProgress = calculateDisplayedProgress(
    progress.stage,
    itemPercent,
    completedCount,
    state,
  );

  state.displayedProgress = displayedProgress;

  return {
    text: formatProgressText(
      progress,
      itemPercent,
      currentIndex,
      completedCount,
      state.totalItems,
    ),
    progress: displayedProgress,
  };
}

function updateItemPercent(
  progress: ConversionProgress,
  state: CommandProgressState,
): number {
  const previousPercent = state.itemPercents.get(progress.itemID) ?? 0;
  const nextPercent =
    progress.stage === "completed"
      ? 100
      : normalizeActiveItemPercent(progress.percent);
  const itemPercent = Math.max(previousPercent, nextPercent ?? previousPercent);

  state.itemPercents.set(progress.itemID, itemPercent);
  return itemPercent;
}

function normalizeActiveItemPercent(
  percent: number | undefined,
): number | undefined {
  if (percent === undefined) {
    return undefined;
  }

  return Math.min(Math.max(percent, 0), 99);
}

function calculateDisplayedProgress(
  stage: ConversionProgress["stage"],
  itemPercent: number,
  completedCount: number,
  state: CommandProgressState,
): number {
  const rawProgress =
    stage === "completed"
      ? (completedCount / state.totalItems) * 100
      : ((completedCount + itemPercent / 100) / state.totalItems) * 100;

  return Math.max(state.displayedProgress, Math.min(rawProgress, 100));
}

function formatProgressText(
  progress: ConversionProgress,
  itemPercent: number,
  currentIndex: number,
  completedCount: number,
  totalItems: number,
): string {
  const status = formatProgressStatus(progress, itemPercent);

  if (totalItems === 1) {
    return status;
  }

  return getString("command-progress-batch", {
    args: {
      current: currentIndex,
      status,
      title: truncateTitle(progress.title),
      total: totalItems,
    },
  });
}

function formatProgressStatus(
  progress: ConversionProgress,
  itemPercent: number,
): string {
  if (progress.stage === "waiting") {
    return getString("command-progress-status-waiting");
  }

  if (progress.stage === "completed") {
    return getString("command-progress-status-completed");
  }

  if (progress.stage === "failed") {
    return getString("command-progress-status-failed");
  }

  if (itemPercent > 0) {
    return getString("command-progress-status-parsing-percent", {
      args: { percent: itemPercent },
    });
  }

  return getString("command-progress-status-parsing");
}

function truncateTitle(title: string): string {
  return title.length > MAX_VISIBLE_TITLE_LENGTH
    ? `${title.slice(0, MAX_VISIBLE_TITLE_LENGTH - 3)}...`
    : title;
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
