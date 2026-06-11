import { parserDefinitions } from "./definitions";
import type { PdfParserClient, PdfParserPrefs } from "./types";

export function createPdfParser(prefs: PdfParserPrefs): PdfParserClient {
  switch (prefs.provider) {
    case "glmocr":
      return parserDefinitions.glmocr.createClient(prefs.configs.glmocr);
    case "mineru":
      return parserDefinitions.mineru.createClient(prefs.configs.mineru);
    case "zhiyi":
      return parserDefinitions.zhiyi.createClient(prefs.configs.zhiyi);
  }
}
