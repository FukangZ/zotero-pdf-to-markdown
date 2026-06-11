const assert = require("node:assert/strict");

require("ts-node/register/transpile-only");

const { readPluginPrefs } = require("../src/modules/prefs.ts");

const originalZotero = globalThis.Zotero;

describe("prefs", function () {
  afterEach(function () {
    delete globalThis.addon;
    restoreZotero();
  });

  it("normalizes string boolean preferences from select controls", function () {
    globalThis.addon = {
      data: {
        config: {
          prefsPrefix: "extensions.test",
        },
      },
    };
    globalThis.Zotero = {
      Prefs: {
        get: (key) => prefValues[key.replace("extensions.test.", "")],
      },
    };

    const prefs = readPluginPrefs();

    assert.equal(prefs.pdfParser.configs.zhiyi.enableCrossPageMerge, false);
    assert.equal(prefs.pdfParser.configs.mineru.enableTable, true);
    assert.equal(prefs.pdfParser.configs.mineru.isOcr, false);
    assert.equal(prefs.pdfParser.configs.mineru.enableFormula, true);
    assert.equal(prefs.pdfParser.configs.glmocr.returnCropImages, true);
    assert.equal(prefs.pdfParser.configs.glmocr.needLayoutVisualization, false);
    assert.equal(prefs.images.enablePicgoUpload, false);
  });
});

const prefValues = {
  pdfParserProvider: "zhiyi",
  zhiyiApiUrl: "https://www.zhiyipdf.com",
  zhiyiApiKey: "",
  zhiyiTableMode: "markdown",
  zhiyiFormulaFormat: "dollar",
  zhiyiEnableCrossPageMerge: "false",
  mineruApiUrl: "https://mineru.net",
  mineruApiToken: "",
  mineruModelVersion: "vlm",
  mineruLanguage: "en",
  mineruEnableTable: "true",
  mineruIsOcr: "false",
  mineruEnableFormula: "true",
  mineruPageRanges: "",
  glmOcrApiUrl: "https://open.bigmodel.cn",
  glmOcrApiKey: "",
  glmOcrReturnCropImages: "true",
  glmOcrNeedLayoutVisualization: "false",
  glmOcrStartPageId: 0,
  glmOcrEndPageId: 0,
  glmOcrMaxFileSizeMb: 50,
  enablePicgoUpload: "false",
  picgoUploadUrl: "http://127.0.0.1:36677/upload",
  picgoSecret: "",
  skipUrlPrefixes: "",
  markdownFilenameTemplate: "{firstAuthor}-{year}-{title}.md",
};

function restoreZotero() {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Zotero");

  if (
    originalZotero === undefined &&
    (!descriptor || descriptor.configurable)
  ) {
    delete globalThis.Zotero;
    return;
  }

  globalThis.Zotero = originalZotero;
}
