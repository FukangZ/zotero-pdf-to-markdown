import { assert } from "chai";
import { runBatch } from "../src/modules/batchRunner";
import type { PdfParserClient } from "../src/modules/pdfParsers/types";
import type { PluginPrefs } from "../src/modules/types";

type DeepPartial<T> = {
  [Key in keyof T]?: T[Key] extends object ? DeepPartial<T[Key]> : T[Key];
};

const originalZotero = (globalThis as any).Zotero;

describe("batchRunner", function () {
  afterEach(function () {
    restoreZotero();
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
    (globalThis as any).PathUtils = {
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
      if (url === "https://tmp.example.com/a.png") {
        return binaryResponse("image/png");
      }

      if (url === "https://tmp.example.com/b.jpg") {
        return binaryResponse("image/jpeg");
      }

      if (url === "http://127.0.0.1:36677/upload") {
        const body = JSON.parse(String(init?.body));
        uploadedLists.push(body.list);
        return jsonResponse({
          success: true,
          result: [
            "https://cdn.example.com/a.png",
            "https://cdn.example.com/b.jpg",
          ],
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const results = await runBatch(
      [item as Zotero.Item],
      createPrefs(),
      undefined,
      {
        createPdfParser: () =>
          createParser(
            "![fig](https://tmp.example.com/a.png)\n![fig2](https://tmp.example.com/b.jpg)",
          ),
      },
    );

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
      "C:\\temp\\zotero-pdf-to-markdown-local-images-ITEM1\\ITEM1-fig-001.png",
      "C:\\temp\\zotero-pdf-to-markdown-local-images-ITEM1\\ITEM1-fig-002.jpg",
    ]);
    assert.deepEqual(uploadedLists, [
      [
        "C:\\temp\\zotero-pdf-to-markdown-local-images-ITEM1\\ITEM1-fig-001.png",
        "C:\\temp\\zotero-pdf-to-markdown-local-images-ITEM1\\ITEM1-fig-002.jpg",
      ],
    ]);
    assert.equal(
      importedMarkdown,
      "![fig](https://cdn.example.com/a.png)\n![fig2](https://cdn.example.com/b.jpg)",
    );
  });

  it("imports parser-provided local image assets when PicGo upload is disabled", async function () {
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
      key: "MD1",
      addTag: () => true,
      saveTx: async () => undefined,
    };
    const writtenFiles: Array<{ path: string; bytes: number[] }> = [];
    const copiedAssets: Array<{ from: string; to: string }> = [];
    let importedMarkdown = "";

    (globalThis as any).Zotero = {
      Items: {
        get: () => pdfAttachment,
        getAsync: async () => [pdfAttachment],
      },
      Attachments: {
        importFromFile: async () => importedAttachment,
        getStorageDirectory: () => ({ path: "C:\\zotero\\storage\\MD1" }),
      },
      Sync: {
        Storage: {
          Local: {
            updateSyncStates: async () => undefined,
          },
        },
      },
    };
    (globalThis as any).PathUtils = {
      join: (...parts: string[]) => parts.join("\\"),
      tempDir: "C:\\temp",
    };
    (globalThis as any).IOUtils = {
      makeDirectory: async () => undefined,
      write: async (path: string, bytes: Uint8Array) => {
        writtenFiles.push({ path, bytes: [...bytes] });
      },
      writeUTF8: async (_path: string, markdown: string) => {
        importedMarkdown = markdown;
      },
      copy: async (from: string, to: string) => {
        copiedAssets.push({ from, to });
      },
      remove: async () => undefined,
    };

    const results = await runBatch(
      [item as Zotero.Item],
      createPrefs({ images: { enablePicgoUpload: false } }),
      undefined,
      {
        createPdfParser: () =>
          createParser("![fig](images/a.jpg)", {
            assets: [
              {
                filePath:
                  "C:\\temp\\zotero-pdf-to-markdown-parser-ITEM1-PDF1\\images\\a.jpg",
                relativePath: "images/a.jpg",
              },
            ],
            cleanupDirectories: [
              "C:\\temp\\zotero-pdf-to-markdown-parser-ITEM1-PDF1",
            ],
          }),
      },
    );

    assert.deepEqual(results, [
      {
        status: "success",
        itemID: 1,
        itemKey: "ITEM1",
        title: "Paper",
        attachmentID: 3,
      },
    ]);
    assert.equal(importedMarkdown, "![fig](assets/ITEM1-fig-001.jpg)");
    assert.deepEqual(writtenFiles, []);
    assert.deepEqual(copiedAssets, [
      {
        from: "C:\\temp\\zotero-pdf-to-markdown-parser-ITEM1-PDF1\\images\\a.jpg",
        to: "C:\\temp\\zotero-pdf-to-markdown-local-images-ITEM1\\ITEM1-fig-001.jpg",
      },
      {
        from: "C:\\temp\\zotero-pdf-to-markdown-local-images-ITEM1\\ITEM1-fig-001.jpg",
        to: "C:\\zotero\\storage\\MD1\\assets\\ITEM1-fig-001.jpg",
      },
    ]);
  });
});

function createPrefs(options: DeepPartial<PluginPrefs> = {}): PluginPrefs {
  const defaults: PluginPrefs = {
    pdfParser: {
      provider: "zhiyi",
      configs: {
        zhiyi: {
          apiUrl: "https://zhiyi.example.com",
          apiKey: "test-key",
          tableMode: "markdown",
          formulaFormat: "dollar",
          enableCrossPageMerge: true,
          pollIntervalMs: 3000,
          timeoutMs: 10 * 60 * 1000,
        },
        mineru: {
          apiUrl: "https://mineru.example.com",
          apiToken: "token",
          modelVersion: "vlm",
          language: "en",
          enableTable: true,
          isOcr: false,
          enableFormula: true,
          pageRanges: "",
          pollIntervalMs: 3000,
          timeoutMs: 10 * 60 * 1000,
        },
        glmocr: {
          apiUrl: "https://open.bigmodel.cn",
          apiKey: "test-key",
          returnCropImages: true,
          needLayoutVisualization: false,
          startPageId: 0,
          endPageId: 0,
          maxFileSizeMb: 50,
        },
      },
    },
    images: {
      enablePicgoUpload: true,
      picgoUploadUrl: "http://127.0.0.1:36677/upload",
      picgoSecret: "",
      skipUrlPrefixes: "https://cdn.example.com/",
    },
    output: {
      markdownFilenameTemplate: "{title}.md",
    },
  };

  return {
    pdfParser: {
      provider: options.pdfParser?.provider ?? defaults.pdfParser.provider,
      configs: {
        zhiyi: {
          ...defaults.pdfParser.configs.zhiyi,
          ...options.pdfParser?.configs?.zhiyi,
        },
        mineru: {
          ...defaults.pdfParser.configs.mineru,
          ...options.pdfParser?.configs?.mineru,
        },
        glmocr: {
          ...defaults.pdfParser.configs.glmocr,
          ...options.pdfParser?.configs?.glmocr,
        },
      },
    },
    images: {
      ...defaults.images,
      ...options.images,
    },
    output: {
      ...defaults.output,
      ...options.output,
    },
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

function binaryResponse(contentTypeOrBytes: string | Uint8Array): Response {
  const contentType =
    typeof contentTypeOrBytes === "string"
      ? contentTypeOrBytes
      : "application/zip";
  const bytes =
    typeof contentTypeOrBytes === "string"
      ? new Uint8Array([1, 2, 3])
      : contentTypeOrBytes;

  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? contentType : null,
    },
    arrayBuffer: async () => bytes.buffer.slice(0),
  } as unknown as Response;
}

function createParser(
  markdown: string,
  options: {
    assets?: Array<{ filePath: string; relativePath: string }>;
    cleanupDirectories?: string[];
  } = {},
): PdfParserClient {
  return {
    convert: async () => ({
      provider: "zhiyi",
      markdown,
      assets: options.assets,
      cleanupDirectories: options.cleanupDirectories,
    }),
  };
}

function restoreZotero(): void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Zotero");

  if (
    originalZotero === undefined &&
    (!descriptor || descriptor.configurable)
  ) {
    delete (globalThis as any).Zotero;
    return;
  }

  (globalThis as any).Zotero = originalZotero;
}
