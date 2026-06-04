import { assert } from "chai";
import { zipSync } from "fflate";
import { MineruPdfClient } from "../src/modules/mineruPdfClient";

const originalFile = globalThis.File;
const originalFetch = globalThis.fetch;

describe("mineruPdfClient", function () {
  afterEach(function () {
    (globalThis as any).File = originalFile;
    (globalThis as any).fetch = originalFetch;
    delete (globalThis as any).PathUtils;
    delete (globalThis as any).addon;
  });

  it("uploads through precise API and downloads markdown from result ZIP", async function () {
    const fetched: Array<{ url: string; method?: string }> = [];

    (globalThis as any).File = {
      createFromFileName: async () => new Blob(["pdf"]),
    };
    (globalThis as any).PathUtils = {
      filename: () => "paper.pdf",
    };
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method });

      if (url.endsWith("/api/v4/file-urls/batch")) {
        assert.equal(
          (init?.headers as Record<string, string>).Authorization,
          "Bearer token",
        );
        assert.deepEqual(JSON.parse(String(init?.body)), {
          files: [
            {
              name: "paper.pdf",
              data_id: "ITEM1-PDF1",
              is_ocr: false,
            },
          ],
          model_version: "vlm",
          language: "ch",
          enable_table: true,
          enable_formula: true,
        });
        return jsonResponse({
          code: 0,
          data: {
            batch_id: "BATCH1",
            file_urls: ["https://oss-mineru.example.com/upload"],
          },
          msg: "ok",
        });
      }

      if (url === "https://oss-mineru.example.com/upload") {
        assert.equal(init?.method, "PUT");
        assert.instanceOf(init?.body, ArrayBuffer);
        return jsonResponse({});
      }

      if (url.endsWith("/api/v4/extract-results/batch/BATCH1")) {
        return jsonResponse({
          code: 0,
          data: {
            batch_id: "BATCH1",
            extract_result: [
              {
                file_name: "paper.pdf",
                data_id: "ITEM1-PDF1",
                state: "done",
                full_zip_url: "https://cdn-mineru.example.com/result.zip",
              },
            ],
          },
          msg: "ok",
        });
      }

      if (url === "https://cdn-mineru.example.com/result.zip") {
        return binaryResponse(
          zipSync({ "paper/full.md": new TextEncoder().encode("# Markdown") }),
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const client = new MineruPdfClient({
      apiUrl: "https://mineru.example.com",
      apiToken: "token",
      modelVersion: "vlm",
      language: "ch",
      enableTable: true,
      isOcr: false,
      enableFormula: true,
      pageRanges: "",
      pollIntervalMs: 0,
      timeoutMs: 1000,
    });

    const markdown = await client.convert("C:\\papers\\paper.pdf", {
      itemID: 1,
      itemKey: "ITEM1",
      itemTitle: "Paper",
      pdfAttachmentID: 2,
      pdfAttachmentKey: "PDF1",
    });

    assert.equal(markdown, "# Markdown");
    assert.deepEqual(
      fetched.map((request) => request.method),
      ["POST", "PUT", undefined, undefined],
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

function binaryResponse(bytes: Uint8Array): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
}
