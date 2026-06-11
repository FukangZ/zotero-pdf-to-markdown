import { assert } from "chai";
import {
  extractImageReferences,
  getUniqueImageUrls,
  rewriteImageReferences,
} from "../src/modules/markdownImages";

describe("markdownImages", function () {
  it("extracts markdown and html image URLs", function () {
    const markdown =
      '![fig](https://tmp.example.com/a.png)\n<img src="https://tmp.example.com/b.jpg">';

    const refs = extractImageReferences(markdown);

    assert.deepEqual(
      refs.map((ref) => ({ url: ref.url, kind: ref.kind })),
      [
        { url: "https://tmp.example.com/a.png", kind: "markdown" },
        { url: "https://tmp.example.com/b.jpg", kind: "html" },
      ],
    );
  });

  it("deduplicates upload URLs and skips configured prefixes", function () {
    const refs = extractImageReferences(
      [
        "![a](https://tmp.example.com/a.png)",
        "![a2](https://tmp.example.com/a.png)",
        "![done](https://cdn.example.com/done.png)",
      ].join("\n"),
    );

    const urls = getUniqueImageUrls(refs, ["https://cdn.example.com/"]);

    assert.deepEqual(urls, ["https://tmp.example.com/a.png"]);
  });

  it("rewrites URLs without changing other markdown", function () {
    const markdown =
      "before ![fig](https://tmp.example.com/a.png) after <img src='https://tmp.example.com/b.jpg'>";
    const refs = extractImageReferences(markdown);
    const rewritten = rewriteImageReferences(
      markdown,
      refs,
      new Map([
        ["https://tmp.example.com/a.png", "https://cdn.example.com/a.png"],
        ["https://tmp.example.com/b.jpg", "https://cdn.example.com/b.jpg"],
      ]),
    );

    assert.equal(
      rewritten,
      "before ![fig](https://cdn.example.com/a.png) after <img src='https://cdn.example.com/b.jpg'>",
    );
  });
});
