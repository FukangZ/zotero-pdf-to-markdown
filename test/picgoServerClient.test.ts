import { assert } from "chai";

const {
  parsePicGoResponse,
  PicGoServerClient,
} = require("../src/modules/picgoServerClient");

describe("picgoServerClient", function () {
  afterEach(function () {
    delete (globalThis as any).fetch;
  });

  it("accepts a single successful URL", function () {
    assert.equal(
      parsePicGoResponse(
        { success: true, result: ["https://cdn.example.com/a.png"] },
        "https://tmp.example.com/a.png",
      ),
      "https://cdn.example.com/a.png",
    );
  });

  it("rejects failed PicGo responses", function () {
    assert.throws(
      () =>
        parsePicGoResponse(
          { success: false, result: [] },
          "https://tmp.example.com/a.png",
        ),
      /PicGo upload failed/,
    );
  });

  it("rejects unexpected result counts", function () {
    assert.throws(
      () =>
        parsePicGoResponse(
          { success: true, result: [] },
          "https://tmp.example.com/a.png",
        ),
      /expected 1 URL/,
    );
  });

  it("uploads multiple files in one PicGo request", async function () {
    let requestBody = "";
    (globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
      requestBody = String(init?.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: [
            "https://cdn.example.com/paper-fig-001.png",
            "https://cdn.example.com/paper-fig-002.jpg",
          ],
        }),
      } as unknown as Response;
    };

    const client = new PicGoServerClient({
      uploadUrl: "http://127.0.0.1:36677/upload",
    });

    const result = await client.uploadMany([
      "C:\\temp\\paper-fig-001.png",
      "C:\\temp\\paper-fig-002.jpg",
    ]);

    assert.deepEqual(JSON.parse(requestBody), {
      list: ["C:\\temp\\paper-fig-001.png", "C:\\temp\\paper-fig-002.jpg"],
    });
    assert.deepEqual(result, [
      "https://cdn.example.com/paper-fig-001.png",
      "https://cdn.example.com/paper-fig-002.jpg",
    ]);
  });
});
