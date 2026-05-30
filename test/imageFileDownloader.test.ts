import { assert } from "chai";

const {
  downloadImagesForUpload,
  inferImageExtension,
} = require("../src/modules/imageFileDownloader");

describe("imageFileDownloader", function () {
  afterEach(function () {
    delete (globalThis as any).PathUtils;
    delete (globalThis as any).IOUtils;
    delete (globalThis as any).fetch;
  });

  it("downloads images using deterministic renamed local filenames", async function () {
    const written: Array<{ path: string; bytes: number[] }> = [];

    (globalThis as any).PathUtils = {
      join: (...parts: string[]) => parts.join("\\"),
    };
    (globalThis as any).IOUtils = {
      makeDirectory: async () => undefined,
      write: async (path: string, bytes: Uint8Array) => {
        written.push({ path, bytes: [...bytes] });
      },
    };
    (globalThis as any).fetch = async (url: string) => {
      const contentType = url.endsWith("one") ? "image/png" : "image/jpeg";
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? contentType : null,
        },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as Response;
    };

    const downloads = await downloadImagesForUpload({
      urls: ["https://tmp.example.com/one", "https://tmp.example.com/two"],
      directory: "C:\\temp\\images",
      markdownFilename: "Paper Title.md",
    });

    assert.deepEqual(
      downloads.map((download: { sourceUrl: string; filePath: string }) => ({
        sourceUrl: download.sourceUrl,
        filePath: download.filePath,
      })),
      [
        {
          sourceUrl: "https://tmp.example.com/one",
          filePath: "C:\\temp\\images\\Paper Title-fig-001.png",
        },
        {
          sourceUrl: "https://tmp.example.com/two",
          filePath: "C:\\temp\\images\\Paper Title-fig-002.jpg",
        },
      ],
    );
    assert.deepEqual(written, [
      { path: "C:\\temp\\images\\Paper Title-fig-001.png", bytes: [1, 2, 3] },
      { path: "C:\\temp\\images\\Paper Title-fig-002.jpg", bytes: [1, 2, 3] },
    ]);
  });

  it("infers image extensions from content type before URL path", function () {
    assert.equal(
      inferImageExtension("image/webp", "https://tmp.example.com/a.png"),
      ".webp",
    );
    assert.equal(
      inferImageExtension(null, "https://tmp.example.com/a.jpeg?x=1"),
      ".jpg",
    );
    assert.equal(inferImageExtension(null, "https://tmp.example.com/a"), ".png");
  });
});
