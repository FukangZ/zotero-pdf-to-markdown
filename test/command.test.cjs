const assert = require("node:assert/strict");

require("ts-node/register/transpile-only");

const {
  createCommandProgressUpdater,
  formatSummary,
} = require("../src/modules/command.ts");

describe("command", function () {
  afterEach(function () {
    delete globalThis.addon;
  });

  it("formats summaries with localized labels", function () {
    globalThis.addon = createAddonWithLocale({
      "zoteropdftomarkdown-command-summary-title": "Finished",
      "zoteropdftomarkdown-command-summary-success": "Success: { $count }",
      "zoteropdftomarkdown-command-summary-skipped": "Skipped: { $count }",
      "zoteropdftomarkdown-command-summary-failed": "Failed: { $count }",
      "zoteropdftomarkdown-command-summary-failure-details": "Failure details:",
    });

    const results = [
      {
        status: "success",
        itemID: 1,
        itemKey: "ITEM1",
        title: "Paper",
        attachmentID: 10,
      },
      {
        status: "skipped",
        itemID: 2,
        itemKey: "ITEM2",
        title: "Existing",
        reason: "Markdown attachment already exists",
      },
      {
        status: "failed",
        itemID: 3,
        itemKey: "ITEM3",
        title: "Broken",
        error: "Parser failed",
      },
    ];

    assert.equal(
      formatSummary(results),
      [
        "Finished",
        "",
        "Success: 1",
        "Skipped: 1",
        "Failed: 1",
        "",
        "Failure details:",
        "- ITEM3: Parser failed",
      ].join("\n"),
    );
  });

  it("keeps progress monotonic when a backend omits percent later", function () {
    globalThis.addon = createAddonWithLocale(progressMessages());
    const lines = [];
    const updateProgress = createCommandProgressUpdater(
      [createItem(1)],
      createProgressWindow(lines),
    );

    updateProgress({
      itemID: 1,
      itemKey: "ITEM1",
      title: "Paper",
      provider: "zhiyi",
      stage: "parsing",
      percent: 98,
    });
    updateProgress({
      itemID: 1,
      itemKey: "ITEM1",
      title: "Paper",
      provider: "zhiyi",
      stage: "parsing",
    });

    assert.deepEqual(
      lines.map((line) => line.progress),
      [98, 98],
    );
    assert.equal(lines[1].text, "Parsing: 98%");
  });
});

function progressMessages() {
  return {
    "zoteropdftomarkdown-command-progress-batch":
      "Item { $current }/{ $total }: { $title }\n{ $status }",
    "zoteropdftomarkdown-command-progress-status-completed":
      "Parsing completed",
    "zoteropdftomarkdown-command-progress-status-failed": "Parsing failed",
    "zoteropdftomarkdown-command-progress-status-parsing": "Parsing",
    "zoteropdftomarkdown-command-progress-status-parsing-percent":
      "Parsing: { $percent }%",
    "zoteropdftomarkdown-command-progress-status-waiting": "Waiting",
  };
}

function createItem(id) {
  return { id };
}

function createProgressWindow(lines) {
  return {
    changeLine: (line) => {
      lines.push(line);
    },
  };
}

function createAddonWithLocale(messages) {
  return {
    data: {
      config: {
        addonRef: "zoteropdftomarkdown",
      },
      locale: {
        current: {
          formatMessagesSync: (requests) =>
            requests.map((request) => ({
              value: interpolateMessage(messages[request.id], request.args),
              attributes: null,
            })),
        },
      },
    },
  };
}

function interpolateMessage(message, args = {}) {
  return Object.entries(args).reduce(
    (current, [key, value]) => current.replaceAll(`{ $${key} }`, String(value)),
    message,
  );
}
