import { assert } from "chai";
import {
  renderFilenameTemplate,
  sanitizeFilename,
} from "../src/modules/filenameTemplate";

describe("filenameTemplate", function () {
  it("uses fallback for empty names", function () {
    assert.equal(sanitizeFilename("   ", "ABCD1234.md"), "ABCD1234.md");
  });

  it("renders item metadata and appends markdown extension", function () {
    const item = createItem({
      key: "ITEM1",
      firstCreator: "Smith",
      title: "Paper Title",
      date: "2024-05-01",
    });

    assert.equal(
      renderFilenameTemplate("{firstAuthor}-{year}-{title}", item),
      "Smith-2024-Paper Title.md",
    );
  });

  it("sanitizes invalid filename characters after rendering", function () {
    const item = createItem({
      key: "ITEM1",
      firstCreator: "Smith",
      title: 'A <Bad> "Title"',
      date: "",
    });

    assert.equal(
      renderFilenameTemplate("{year}-{title}.md", item),
      "no-year-A -Bad- -Title-.md",
    );
  });
});

function createItem(options: {
  key: string;
  firstCreator: string;
  title: string;
  date: string;
}): Zotero.Item {
  return {
    key: options.key,
    firstCreator: options.firstCreator,
    getField: (field: string) => {
      if (field === "title") {
        return options.title;
      }
      if (field === "date") {
        return options.date;
      }
      return "";
    },
  } as Zotero.Item;
}
