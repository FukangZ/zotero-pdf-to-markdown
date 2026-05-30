import { assert } from "chai";

const { importMarkdownAttachment } = require("../src/modules/markdownAttachmentImporter");

describe("markdownAttachmentImporter", function () {
  afterEach(function () {
    delete (globalThis as any).PathUtils;
    delete (globalThis as any).IOUtils;
    delete (globalThis as any).Zotero;
  });

  it("imports a temp file using the requested markdown filename", async function () {
    const addedTags: string[] = [];
    let saved = false;
    const importedAttachment = {
      id: 10,
      addTag: (tag: string) => {
        addedTags.push(tag);
        return true;
      },
      saveTx: async () => {
        saved = true;
      },
    };
    let importedFilePath = "";
    let writtenFilePath = "";
    let removedPath = "";

    (globalThis as any).PathUtils = {
      tempDir: "C:\\temp",
      join: (...parts: string[]) => parts.join("\\"),
    };
    (globalThis as any).IOUtils = {
      makeDirectory: async () => undefined,
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
    assert.equal(removedPath, "C:\\temp\\zotero-pdf-to-markdown-ITEM1");
    assert.deepEqual(addedTags, ["zotero-pdf-to-markdown"]);
    assert.isTrue(saved);
  });
});
