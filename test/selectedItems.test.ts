import { assert } from "chai";
import { getSelectedRegularItems } from "../src/modules/selectedItems";

describe("selectedItems", function () {
  afterEach(function () {
    delete (globalThis as any).addon;
  });

  it("returns selected regular non-feed items", function () {
    const regularItem = {
      isRegularItem: () => true,
      isFeedItem: false,
    };
    const feedItem = {
      isRegularItem: () => true,
      isFeedItem: true,
    };
    const attachment = {
      isRegularItem: () => false,
      isFeedItem: false,
    };

    (globalThis as any).addon = {
      data: {
        ztoolkit: {
          getGlobal: () => ({
            getSelectedItems: () => [regularItem, feedItem, attachment],
          }),
        },
      },
    };

    assert.deepEqual(getSelectedRegularItems(), [regularItem]);
  });
});
