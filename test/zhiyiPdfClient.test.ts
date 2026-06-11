import { assert } from "chai";
import {
  assertMarkdownDownload,
  parseZhiyiProgressPercent,
  parseTaskCreationResponse,
  parseTaskStatusResponse,
  ZhiyiPdfClient,
} from "../src/modules/zhiyiPdfClient";

const originalFormData = globalThis.FormData;
const originalFile = globalThis.File;
const originalFetch = globalThis.fetch;

describe("zhiyiPdfClient", function () {
  afterEach(function () {
    (globalThis as any).FormData = originalFormData;
    (globalThis as any).File = originalFile;
    (globalThis as any).fetch = originalFetch;
    delete (globalThis as any).PathUtils;
    delete (globalThis as any).addon;
  });

  it("rejects insufficient points", function () {
    assert.throws(
      () =>
        parseTaskCreationResponse({
          success: false,
          error_code: "insufficient_points",
          message: "points not enough",
        }),
      /insufficient_points/,
    );
  });

  it("treats pending status as processing", function () {
    assert.equal(
      parseTaskStatusResponse({
        success: true,
        status: "pending",
        message: "上传中",
      }).status,
      "processing",
    );
  });

  it("rejects undocumented task statuses with a response summary", function () {
    assert.throws(
      () =>
        parseTaskStatusResponse({
          success: true,
          status: "unknown",
        }),
      /Zhiyi returned invalid task status: unknown.*"status":"unknown"/,
    );
  });

  it("requires markdown content type", function () {
    assert.throws(
      () => assertMarkdownDownload("application/zip"),
      /Expected markdown/,
    );
  });

  it("extracts parsing progress from Zhiyi status messages", function () {
    assert.equal(parseZhiyiProgressPercent("解析中 62%"), 62);
    assert.equal(parseZhiyiProgressPercent("解析中 100%"), 99);
    assert.isUndefined(parseZhiyiProgressPercent("后处理中"));
  });

  it("reports preprocessing as waiting progress", async function () {
    const progressEvents: Array<{ stage: string; percent?: number }> = [];
    const statusResponses = [
      {
        success: true,
        status: "processing",
        message: "预处理中",
      },
      {
        success: true,
        status: "processing",
        message: "解析中 62%",
      },
      {
        success: true,
        status: "completed",
        message: "任务完成！",
        result: { download_url: "/download/TASK1" },
      },
    ];

    (globalThis as any).FormData = class {
      append() {
        return undefined;
      }
    };
    (globalThis as any).File = {
      createFromFileName: async () => new Blob(["pdf"]),
    };
    (globalThis as any).PathUtils = {
      filename: () => "paper.pdf",
    };
    (globalThis as any).fetch = async (url: string) => {
      if (url.endsWith("/parse")) {
        return jsonResponse({ success: true, task_id: "TASK1" });
      }

      if (url.endsWith("/status/TASK1")) {
        return jsonResponse(statusResponses.shift());
      }

      if (url.endsWith("/download/TASK1")) {
        return textResponse("# Markdown");
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const client = new ZhiyiPdfClient({
      apiUrl: "https://zhiyi.example.com",
      apiKey: "test-key",
      tableMode: "markdown",
      formulaFormat: "dollar",
      enableCrossPageMerge: true,
      pollIntervalMs: 0,
      timeoutMs: 1000,
    });

    await client.convert({
      pdfPath: "C:\\papers\\paper.pdf",
      context: {
        itemID: 1,
        itemKey: "ITEM1",
        itemTitle: "Paper",
        pdfAttachmentID: 2,
        pdfAttachmentKey: "PDF1",
      },
      onProgress: (progress) => {
        progressEvents.push({
          stage: progress.stage,
          percent: progress.percent,
        });
      },
    });

    assert.deepEqual(progressEvents, [
      { stage: "waiting", percent: undefined },
      { stage: "waiting", percent: undefined },
      { stage: "parsing", percent: 62 },
      { stage: "completed", percent: 100 },
    ]);
  });

  it("uses Zotero window constructors when sandbox globals are unavailable", async function () {
    const appendedFields: Array<[string, unknown, string | undefined]> = [];

    delete (globalThis as any).FormData;
    delete (globalThis as any).File;
    (globalThis as any).PathUtils = {
      filename: () => "paper.pdf",
    };
    (globalThis as any).addon = {
      data: {
        ztoolkit: {
          getGlobal: (name: string) => {
            if (name === "FormData") {
              return class {
                append(name: string, value: unknown, filename?: string) {
                  appendedFields.push([name, value, filename]);
                }
              };
            }

            if (name === "File") {
              return {
                createFromFileName: async () => new Blob(["pdf"]),
              };
            }

            return undefined;
          },
        },
      },
    };
    (globalThis as any).fetch = async (url: string) => {
      if (url.endsWith("/parse")) {
        return jsonResponse({ success: true, task_id: "TASK1" });
      }

      if (url.endsWith("/status/TASK1")) {
        return jsonResponse({
          success: true,
          status: "completed",
          result: { download_url: "/download/TASK1" },
        });
      }

      if (url.endsWith("/download/TASK1")) {
        return textResponse("# Markdown");
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const client = new ZhiyiPdfClient({
      apiUrl: "https://zhiyi.example.com",
      apiKey: "test-key",
      tableMode: "markdown",
      formulaFormat: "dollar",
      enableCrossPageMerge: true,
      pollIntervalMs: 0,
      timeoutMs: 1000,
    });

    const result = await client.convert({
      pdfPath: "C:\\papers\\paper.pdf",
      context: {
        itemID: 1,
        itemKey: "ITEM1",
        itemTitle: "Paper",
        pdfAttachmentID: 2,
        pdfAttachmentKey: "PDF1",
      },
    });

    assert.equal(result.provider, "zhiyi");
    assert.equal(result.markdown, "# Markdown");
    assert.deepEqual(
      appendedFields.map(([name, _value, filename]) => [name, filename]),
      [
        ["file", "paper.pdf"],
        ["table_mode", undefined],
        ["formula_format", undefined],
        ["enable_translation", undefined],
        ["images_as_url", undefined],
        ["skip_rotation_detection", undefined],
        ["enable_cross_page_merge", undefined],
      ],
    );
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function textResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    headers: {
      get: () => "text/markdown",
    },
    text: async () => body,
  } as unknown as Response;
}
