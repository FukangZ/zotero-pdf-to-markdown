import { assert } from "chai";
import { GlmOcrPdfClient } from "../src/modules/glmOcrPdfClient";

const originalFile = globalThis.File;
const originalFetch = globalThis.fetch;

describe("glmOcrPdfClient", function () {
  afterEach(function () {
    (globalThis as any).File = originalFile;
    (globalThis as any).fetch = originalFetch;
    delete (globalThis as any).PathUtils;
    delete (globalThis as any).addon;
  });

  it("sends PDF as data URL and returns md_results", async function () {
    const progressEvents: Array<{ stage: string; percent?: number }> = [];

    (globalThis as any).File = {
      createFromFileName: async () =>
        new Blob(["%PDF"], { type: "application/pdf" }),
    };
    (globalThis as any).PathUtils = {
      filename: () => "paper.pdf",
    };
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      assert.equal(url, "https://open.bigmodel.cn/api/paas/v4/layout_parsing");
      assert.equal(init?.method, "POST");
      assert.deepEqual(init?.headers, {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      });

      const body = JSON.parse(String(init?.body));

      assert.equal(body.model, "glm-ocr");
      assert.match(body.file, /^data:application\/pdf;base64,/);
      assert.equal(body.return_crop_images, true);
      assert.equal(body.need_layout_visualization, false);
      assert.notProperty(body, "start_page_id");
      assert.notProperty(body, "end_page_id");

      return jsonResponse({ md_results: "# GLM Markdown" });
    };

    const client = new GlmOcrPdfClient({
      apiUrl: "https://open.bigmodel.cn",
      apiKey: "test-key",
      returnCropImages: true,
      needLayoutVisualization: false,
      startPageId: 0,
      endPageId: 0,
      maxFileSizeMb: 50,
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
      onProgress: (progress) => {
        progressEvents.push({
          stage: progress.stage,
          percent: progress.percent,
        });
      },
    });

    assert.equal(result.provider, "glmocr");
    assert.equal(result.markdown, "# GLM Markdown");
    assert.deepEqual(progressEvents, [
      { stage: "parsing", percent: undefined },
      { stage: "completed", percent: 100 },
    ]);
  });

  it("rejects empty md_results with response summary", async function () {
    (globalThis as any).File = {
      createFromFileName: async () =>
        new Blob(["%PDF"], { type: "application/pdf" }),
    };
    (globalThis as any).PathUtils = {
      filename: () => "paper.pdf",
    };
    (globalThis as any).fetch = async () =>
      jsonResponse({ md_results: "", code: "empty" });

    const client = new GlmOcrPdfClient({
      apiUrl: "https://open.bigmodel.cn",
      apiKey: "test-key",
      returnCropImages: true,
      needLayoutVisualization: false,
      startPageId: 0,
      endPageId: 0,
      maxFileSizeMb: 50,
    });

    let error: unknown;

    try {
      await client.convert({
        pdfPath: "C:\\papers\\paper.pdf",
        context: {
          itemID: 1,
          itemKey: "ITEM1",
          itemTitle: "Paper",
          pdfAttachmentID: 2,
          pdfAttachmentKey: "PDF1",
        },
      });
    } catch (caughtError) {
      error = caughtError;
    }

    assert.instanceOf(error, Error);
    assert.match(
      (error as Error).message,
      /GLM-OCR response missing non-empty md_results.*"code":"empty"/,
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
