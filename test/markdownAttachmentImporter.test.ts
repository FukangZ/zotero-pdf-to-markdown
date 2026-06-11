import { assert } from "chai";
import { importMarkdownAttachment } from "../src/modules/markdownAttachmentImporter";

const originalZotero = (globalThis as any).Zotero;

describe("markdownAttachmentImporter", function () {
  afterEach(function () {
    delete (globalThis as any).PathUtils;
    delete (globalThis as any).IOUtils;
    restoreZotero();
  });

  it("imports a temp file using the requested markdown filename", async function () {
    const addedTags: string[] = [];
    let saved = false;
    const importedAttachment = {
      id: 10,
      key: "ATTACH1",
      addTag: (tag: string) => {
        addedTags.push(tag);
        return true;
      },
      saveTx: async () => {
        saved = true;
      },
    } as unknown as Zotero.Item;
    let importedFilePath = "";
    let madeDirectory:
      | { path: string; options?: Record<string, unknown> }
      | undefined;
    let writtenFilePath = "";
    let removedPath = "";

    (globalThis as any).PathUtils = {
      tempDir: "C:\\temp",
      join: (...parts: string[]) => parts.join("\\"),
    };
    (globalThis as any).IOUtils = {
      makeDirectory: async (
        path: string,
        options?: Record<string, unknown>,
      ) => {
        madeDirectory = { path, options };
      },
      writeUTF8: async (filePath: string) => {
        writtenFilePath = filePath;
      },
      remove: async (path: string) => {
        removedPath = path;
      },
    };
    (globalThis as any).Zotero = {
      Attachments: {
        importFromFile: async (params: { file: string; title: string }) => {
          importedFilePath = params.file;
          assert.equal(params.title, "MD");
          return importedAttachment;
        },
      },
    };

    const result = await importMarkdownAttachment({
      parentItem: { id: 1, key: "ITEM1" } as Zotero.Item,
      filename: "Paper.md",
      markdown: "# Paper",
    });

    assert.equal(result, importedAttachment);
    assert.equal(
      importedFilePath,
      "C:\\temp\\zotero-pdf-to-markdown-ITEM1\\Paper.md",
    );
    assert.equal(writtenFilePath, importedFilePath);
    assert.deepEqual(madeDirectory, {
      path: "C:\\temp\\zotero-pdf-to-markdown-ITEM1",
      options: {
        createAncestors: true,
        ignoreExisting: true,
      },
    });
    assert.equal(removedPath, "C:\\temp\\zotero-pdf-to-markdown-ITEM1");
    assert.deepEqual(addedTags, ["zotero-pdf-to-markdown"]);
    assert.isTrue(saved);
  });

  it("copies local image assets into the imported attachment storage directory", async function () {
    const copiedFiles: Array<{ from: string; to: string }> = [];
    const madeDirectories: string[] = [];
    const syncUpdates: Array<{ ids: number[]; state: string }> = [];
    const importedAttachment = {
      id: 10,
      key: "ATTACH1",
      addTag: () => true,
      saveTx: async () => undefined,
    } as unknown as Zotero.Item;

    (globalThis as any).PathUtils = {
      tempDir: "C:\\temp",
      join: (...parts: string[]) => parts.join("\\"),
    };
    (globalThis as any).IOUtils = {
      makeDirectory: async (path: string) => {
        madeDirectories.push(path);
      },
      writeUTF8: async () => undefined,
      copy: async (from: string, to: string) => {
        copiedFiles.push({ from, to });
      },
      remove: async () => undefined,
    };
    (globalThis as any).Zotero = {
      Attachments: {
        importFromFile: async () => importedAttachment,
        getStorageDirectory: () => ({ path: "C:\\zotero\\storage\\ATTACH1" }),
      },
      Sync: {
        Storage: {
          Local: {
            updateSyncStates: async (
              attachments: Array<{ id: number }>,
              state: string,
            ) => {
              syncUpdates.push({
                ids: attachments.map((attachment) => attachment.id),
                state,
              });
            },
          },
        },
      },
    };

    await importMarkdownAttachment({
      parentItem: { id: 1, key: "ITEM1" } as Zotero.Item,
      filename: "Paper.md",
      markdown: "![fig](assets/fig-001.png)",
      assets: [
        {
          filePath: "C:\\temp\\images\\fig-001.png",
          relativePath: "assets/fig-001.png",
        },
      ],
    });

    assert.include(madeDirectories, "C:\\zotero\\storage\\ATTACH1\\assets");
    assert.deepEqual(copiedFiles, [
      {
        from: "C:\\temp\\images\\fig-001.png",
        to: "C:\\zotero\\storage\\ATTACH1\\assets\\fig-001.png",
      },
    ]);
    assert.deepEqual(syncUpdates, [{ ids: [10], state: "to_upload" }]);
  });
});

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
