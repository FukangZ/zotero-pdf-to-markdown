import { assert } from "chai";
import { parsePicGoResponse } from "../src/modules/picgoServerClient";

describe("picgoServerClient", function () {
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
      /expected exactly one URL/,
    );
  });
});
