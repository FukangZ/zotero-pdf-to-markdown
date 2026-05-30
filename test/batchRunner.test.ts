import { assert } from "chai";
import { runBatch } from "../src/modules/batchRunner";
import type { PluginPrefs } from "../src/modules/types";

const originalFile = globalThis.File;

describe("batchRunner", function () {
  afterEach(function () {
    delete (globalThis as any).Zotero;
    (globalThis as any).File = originalFile;
    delete (globalThis as any).PathUtils;
    delete (globalThis as any).IOUtils;
    delete (globalThis as any).fetch;
  });

  it("skips items that already have a markdown attachment", async function () {
    const item = createItem({ id: 1, key: "ITEM1", title: "Existing" });

    (globalThis as any).Zotero = {
      Items: {
        get: () =>
          createAttachment({
            id: 10,
            key: "MD1",
            contentType: "text/markdown",
            filename: "existing.md",
            tags: ["zotero-pdf-to-markdown"],
          }),
      },
    };

    const results = await runBatch([item as Zotero.Item], createPrefs());

    assert.deepEqual(results, [
      {
        status: "skipped",
        itemID: 1,
        itemKey: "ITEM1",
        title: "Existing",
        reason: "Markdown attachment already exists",
      },
    ]);
  });

  it("converts a PDF, uploads temporary image URLs, and imports markdown", async function () {
    const item = createItem({ id: 1, key: "ITEM1", title: "Paper" });
    const pdfAttachment = createAttachment({
      id: 2,
      key: "PDF1",
      contentType: "application/pdf",
      filename: "paper.pdf",
      filePath: "C:\\papers\\paper.pdf",
    });
    const importedAttachment = {
      id: 3,
      addTag: () => true,
      saveTx: async () => undefined,
    };
    const uploadedLists: string[][] = [];
    const downloadedImagePaths: string[] = [];
    let importedMarkdown = "";

    (globalThis as any).Zotero = {
      Items: {
        get: () => pdfAttachment,
        getAsync: async () => [pdfAttachment],
      },
      Attachments: {
        importFromFile: async (params: { title: string }) => {
          assert.equal(params.title, "MD");
          return importedAttachment;
        },
      },
    };
    (globalThis as any).File.createFromFileName = async () => new Blob(["pdf"]);
    (globalThis as any).PathUtils = {
      filename: () => "paper.pdf",
      join: (...parts: string[]) => parts.join("\\"),
      tempDir: "C:\\temp",
    };
    (globalThis as any).IOUtils = {
      makeDirectory: async () => undefined,
      write: async (path: string) => {
        downloadedImagePaths.push(path);
      },
      writeUTF8: async (_path: string, markdown: string) => {
        importedMarkdown = markdown;
      },
      remove: async () => undefined,
    };
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
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
        return textResponse("![fig](https://tmp.example.com/a.png)");
      }

      if (url === "https://tmp.example.com/a.png") {
        return binaryResponse("image/png");
      }

      if (url === "http://127.0.0.1:36677/upload") {
        const body = JSON.parse(String(init?.body));
        uploadedLists.push(body.list);
        return jsonResponse({
          success: true,
          result: ["https://cdn.example.com/a.png"],
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const results = await runBatch([item as Zotero.Item], createPrefs());

    assert.deepEqual(results, [
      {
        status: "success",
        itemID: 1,
        itemKey: "ITEM1",
        title: "Paper",
        attachmentID: 3,
      },
    ]);
    assert.deepEqual(downloadedImagePaths, [
      "C:\\temp\\zotero-pdf-to-markdown-images-ITEM1\\Paper-fig-001.png",
    ]);
    assert.deepEqual(uploadedLists, [
      [
        "C:\\temp\\zotero-pdf-to-markdown-images-ITEM1\\Paper-fig-001.png",
      ],
    ]);
    assert.equal(importedMarkdown, "![fig](https://cdn.example.com/a.png)");
  });
});

function createPrefs(): PluginPrefs {
  return {
    zhiyiApiUrl: "https://zhiyi.example.com",
    zhiyiApiKey: "test-key",
    zhiyiTableMode: "markdown",
    zhiyiFormulaFormat: "dollar",
    zhiyiEnableCrossPageMerge: true,
    picgoUploadUrl: "http://127.0.0.1:36677/upload",
    picgoSecret: "",
    picgoUploadIntervalMs: 0,
    skipUrlPrefixes: "https://cdn.example.com/",
    markdownFilenameTemplate: "{title}.md",
    existingMarkdownStrategy: "skip",
  };
}

function createItem(options: { id: number; key: string; title: string }) {
  return {
    id: options.id,
    key: options.key,
    firstCreator: "Author",
    getAttachments: () => [2],
    getField: (field: string) => (field === "title" ? options.title : ""),
  };
}

function createAttachment(options: {
  id: number;
  key: string;
  contentType: string;
  filename: string;
  filePath?: string;
  tags?: string[];
}) {
  return {
    id: options.id,
    key: options.key,
    isAttachment: () => true,
    attachmentContentType: options.contentType,
    attachmentFilename: options.filename,
    getFilePathAsync: async () => options.filePath ?? false,
    hasTag: (tag: string) => options.tags?.includes(tag) ?? false,
  };
}

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

function binaryResponse(contentType: string): Response {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? contentType : null,
    },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as unknown as Response;
}
