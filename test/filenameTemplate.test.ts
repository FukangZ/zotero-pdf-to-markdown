import { assert } from "chai";
import { sanitizeFilename } from "../src/modules/filenameTemplate";

describe("filenameTemplate", function () {
  it("uses fallback for empty names", function () {
    assert.equal(sanitizeFilename("   ", "ABCD1234.md"), "ABCD1234.md");
  });
});
