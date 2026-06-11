import { GlmOcrPdfClient } from "../glmOcrPdfClient";
import { MineruPdfClient } from "../mineruPdfClient";
import { ZhiyiPdfClient } from "../zhiyiPdfClient";
import type {
  GlmOcrParserConfig,
  MineruParserConfig,
  ParserDefinition,
  PdfParserConfigMap,
  PdfParserProvider,
  ZhiyiParserConfig,
} from "./types";

export const ZHIYI_PARSER_DEFAULTS: ZhiyiParserConfig = {
  apiUrl: "https://www.zhiyipdf.com",
  apiKey: "",
  tableMode: "markdown",
  formulaFormat: "dollar",
  enableCrossPageMerge: true,
  pollIntervalMs: 3000,
  timeoutMs: 10 * 60 * 1000,
};

export const MINERU_PARSER_DEFAULTS: MineruParserConfig = {
  apiUrl: "https://mineru.net",
  apiToken: "",
  modelVersion: "vlm",
  language: "en",
  enableTable: true,
  isOcr: false,
  enableFormula: true,
  pageRanges: "",
  pollIntervalMs: 3000,
  timeoutMs: 10 * 60 * 1000,
};

export const GLM_OCR_PARSER_DEFAULTS: GlmOcrParserConfig = {
  apiUrl: "https://open.bigmodel.cn",
  apiKey: "",
  returnCropImages: true,
  needLayoutVisualization: false,
  startPageId: 0,
  endPageId: 0,
  maxFileSizeMb: 50,
};

const zhiyiDefinition: ParserDefinition<"zhiyi", ZhiyiParserConfig> = {
  id: "zhiyi",
  label: "Zhiyi PDF",
  docsUrl: "https://www.zhiyipdf.com/api-docs?doc=pdf-parse",
  defaults: ZHIYI_PARSER_DEFAULTS,
  fields: [
    {
      key: "apiKey",
      prefKey: "zhiyiApiKey",
      labelKey: "pref-zhiyi-api-key",
      group: "basic",
      input: "password",
      required: true,
      secret: true,
    },
    {
      key: "apiUrl",
      prefKey: "zhiyiApiUrl",
      labelKey: "pref-zhiyi-api-url",
      group: "advanced",
      input: "url",
    },
    {
      key: "tableMode",
      prefKey: "zhiyiTableMode",
      labelKey: "pref-zhiyi-table-mode",
      group: "advanced",
      input: "select",
      options: [
        { value: "markdown", label: "markdown" },
        { value: "image", label: "image" },
      ],
    },
    {
      key: "formulaFormat",
      prefKey: "zhiyiFormulaFormat",
      labelKey: "pref-zhiyi-formula-format",
      group: "advanced",
      input: "select",
      options: [
        { value: "dollar", label: "dollar" },
        { value: "bracket", label: "bracket" },
      ],
    },
    {
      key: "enableCrossPageMerge",
      prefKey: "zhiyiEnableCrossPageMerge",
      labelKey: "pref-zhiyi-enable-cross-page-merge",
      group: "advanced",
      input: "checkbox",
    },
  ],
  createClient: (config) => new ZhiyiPdfClient(config),
};

const mineruDefinition: ParserDefinition<"mineru", MineruParserConfig> = {
  id: "mineru",
  label: "MinerU",
  docsUrl: "https://mineru.net/apiManage/docs",
  defaults: MINERU_PARSER_DEFAULTS,
  fields: [
    {
      key: "apiToken",
      prefKey: "mineruApiToken",
      labelKey: "pref-mineru-api-token",
      group: "basic",
      input: "password",
      required: true,
      secret: true,
    },
    {
      key: "apiUrl",
      prefKey: "mineruApiUrl",
      labelKey: "pref-mineru-api-url",
      group: "advanced",
      input: "url",
    },
    {
      key: "modelVersion",
      prefKey: "mineruModelVersion",
      labelKey: "pref-mineru-model-version",
      group: "advanced",
      input: "select",
      options: [
        { value: "vlm", label: "vlm" },
        { value: "pipeline", label: "pipeline" },
        { value: "MinerU-HTML", label: "MinerU-HTML" },
      ],
    },
    {
      key: "language",
      prefKey: "mineruLanguage",
      labelKey: "pref-mineru-language",
      group: "advanced",
      input: "text",
    },
    {
      key: "enableTable",
      prefKey: "mineruEnableTable",
      labelKey: "pref-mineru-enable-table",
      group: "advanced",
      input: "checkbox",
    },
    {
      key: "isOcr",
      prefKey: "mineruIsOcr",
      labelKey: "pref-mineru-is-ocr",
      group: "advanced",
      input: "checkbox",
    },
    {
      key: "enableFormula",
      prefKey: "mineruEnableFormula",
      labelKey: "pref-mineru-enable-formula",
      group: "advanced",
      input: "checkbox",
    },
    {
      key: "pageRanges",
      prefKey: "mineruPageRanges",
      labelKey: "pref-mineru-page-ranges",
      group: "advanced",
      input: "text",
    },
  ],
  createClient: (config) => new MineruPdfClient(config),
};

const glmOcrDefinition: ParserDefinition<"glmocr", GlmOcrParserConfig> = {
  id: "glmocr",
  label: "GLM-OCR",
  docsUrl: "https://docs.bigmodel.cn/cn/guide/models/vlm/glm-ocr",
  defaults: GLM_OCR_PARSER_DEFAULTS,
  fields: [
    {
      key: "apiKey",
      prefKey: "glmOcrApiKey",
      labelKey: "pref-glmocr-api-key",
      group: "basic",
      input: "password",
      required: true,
      secret: true,
    },
    {
      key: "apiUrl",
      prefKey: "glmOcrApiUrl",
      labelKey: "pref-glmocr-api-url",
      group: "advanced",
      input: "url",
    },
    {
      key: "returnCropImages",
      prefKey: "glmOcrReturnCropImages",
      labelKey: "pref-glmocr-return-crop-images",
      group: "advanced",
      input: "checkbox",
    },
    {
      key: "needLayoutVisualization",
      prefKey: "glmOcrNeedLayoutVisualization",
      labelKey: "pref-glmocr-need-layout-visualization",
      group: "advanced",
      input: "checkbox",
    },
    {
      key: "startPageId",
      prefKey: "glmOcrStartPageId",
      labelKey: "pref-glmocr-start-page-id",
      group: "advanced",
      input: "number",
    },
    {
      key: "endPageId",
      prefKey: "glmOcrEndPageId",
      labelKey: "pref-glmocr-end-page-id",
      group: "advanced",
      input: "number",
    },
    {
      key: "maxFileSizeMb",
      prefKey: "glmOcrMaxFileSizeMb",
      labelKey: "pref-glmocr-max-file-size-mb",
      group: "advanced",
      input: "number",
    },
  ],
  createClient: (config) => new GlmOcrPdfClient(config),
};

export const parserDefinitions = {
  zhiyi: zhiyiDefinition,
  mineru: mineruDefinition,
  glmocr: glmOcrDefinition,
} satisfies {
  [Provider in PdfParserProvider]: ParserDefinition<
    Provider,
    PdfParserConfigMap[Provider]
  >;
};
