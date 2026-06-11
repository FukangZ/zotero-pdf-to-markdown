export type PdfParserProvider = "zhiyi" | "mineru" | "glmocr";

export interface ConversionContext {
  itemID: number;
  itemKey: string;
  itemTitle: string;
  pdfAttachmentID: number;
  pdfAttachmentKey: string;
}

export interface LocalImageAsset {
  filePath: string;
  relativePath: string;
}

export type ConversionProgressStage =
  | "waiting"
  | "parsing"
  | "completed"
  | "failed";

export interface ConversionProgress {
  itemID: number;
  itemKey: string;
  title: string;
  provider: PdfParserProvider;
  stage: ConversionProgressStage;
  percent?: number;
}

export type ConversionProgressReporter = (progress: ConversionProgress) => void;

export interface PdfParseRequest {
  pdfPath: string;
  context: ConversionContext;
  onProgress?: ConversionProgressReporter;
}

export interface PdfParseResult {
  provider: PdfParserProvider;
  markdown: string;
  assets?: LocalImageAsset[];
  cleanupDirectories?: string[];
}

export interface PdfParserClient {
  convert(request: PdfParseRequest): Promise<PdfParseResult>;
}

export interface HttpParserConfig {
  apiUrl: string;
  pollIntervalMs: number;
  timeoutMs: number;
}

export type ZhiyiParserConfig = HttpParserConfig & {
  apiKey: string;
  tableMode: "markdown" | "image";
  formulaFormat: "dollar" | "bracket";
  enableCrossPageMerge: boolean;
};

export type MineruParserConfig = HttpParserConfig & {
  apiToken: string;
  modelVersion: "pipeline" | "vlm" | "MinerU-HTML";
  language: string;
  enableTable: boolean;
  isOcr: boolean;
  enableFormula: boolean;
  pageRanges: string;
};

export interface GlmOcrParserConfig {
  apiUrl: string;
  apiKey: string;
  returnCropImages: boolean;
  needLayoutVisualization: boolean;
  startPageId: number;
  endPageId: number;
  maxFileSizeMb: number;
}

export interface PdfParserConfigMap {
  zhiyi: ZhiyiParserConfig;
  mineru: MineruParserConfig;
  glmocr: GlmOcrParserConfig;
}

export interface PdfParserPrefs {
  provider: PdfParserProvider;
  configs: PdfParserConfigMap;
}

export interface ParserConfigField<Config> {
  key: keyof Config;
  prefKey: string;
  labelKey: string;
  group: "basic" | "advanced";
  input: "text" | "password" | "url" | "number" | "checkbox" | "select";
  required?: boolean;
  secret?: boolean;
  options?: Array<{ value: string; label: string }>;
  helpUrl?: string;
}

export interface ParserDefinition<
  Provider extends PdfParserProvider,
  Config extends PdfParserConfigMap[Provider],
> {
  id: Provider;
  label: string;
  docsUrl?: string;
  defaults: Config;
  fields: Array<ParserConfigField<Config>>;
  createClient(config: Config): PdfParserClient;
}
