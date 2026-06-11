#!/usr/bin/env node

/* global console, fetch, process */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_API_URL = "https://open.bigmodel.cn";
const MODEL = "glm-ocr";
const MAX_PDF_BYTES = 50 * 1024 * 1024;

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (!options.inputPath) {
    throw new Error("Missing PDF path.");
  }

  const apiKey = process.env.GLM_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing GLM_API_KEY environment variable.");
  }

  const absoluteInputPath = path.resolve(options.inputPath);
  const fileStat = await stat(absoluteInputPath);

  if (!fileStat.isFile()) {
    throw new Error(`Input is not a file: ${absoluteInputPath}`);
  }

  if (fileStat.size > MAX_PDF_BYTES && !options.forceSize) {
    throw new Error(
      `PDF is ${formatBytes(fileStat.size)}, above GLM-OCR 50MB limit. ` +
        "Use --force-size only if you intentionally want to try anyway.",
    );
  }

  const mimeType = inferMimeType(absoluteInputPath);
  const bytes = await readFile(absoluteInputPath);
  const requestBody = createRequestBody(bytes, mimeType, options);
  const endpoint = buildEndpoint(options.apiUrl);

  console.log(`Calling GLM-OCR: ${endpoint}`);
  console.log(`Input: ${absoluteInputPath}`);
  console.log(`Size: ${formatBytes(fileStat.size)}`);

  const startedAt = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  const elapsedMs = Date.now() - startedAt;
  const bodyText = await response.text();
  const body = parseJsonResponse(bodyText);

  if (!response.ok) {
    throw new Error(
      `GLM-OCR HTTP ${response.status}: ${summarizeResponse(body ?? bodyText)}`,
    );
  }

  if (!body || typeof body !== "object") {
    throw new Error("GLM-OCR returned a non-JSON response.");
  }

  const markdown = typeof body.md_results === "string" ? body.md_results : "";

  if (!markdown.trim()) {
    throw new Error(
      `GLM-OCR response missing non-empty md_results: ${summarizeResponse(
        body,
      )}`,
    );
  }

  const outputDirectory = await createOutputDirectory(
    options.outDir,
    absoluteInputPath,
  );
  const summary = createSummary(body, markdown, {
    inputPath: absoluteInputPath,
    mimeType,
    sizeBytes: fileStat.size,
    elapsedMs,
  });

  await writeFile(path.join(outputDirectory, "result.md"), markdown, "utf8");
  await writeFile(
    path.join(outputDirectory, "raw-response.json"),
    `${JSON.stringify(body, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(outputDirectory, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  console.log("");
  console.log(`Done in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Output: ${outputDirectory}`);
  console.log(`Markdown chars: ${markdown.length}`);
  console.log(`Pages: ${summary.numPages ?? "unknown"}`);
  console.log(
    `Layout labels: ${
      Object.entries(summary.layoutLabelCounts)
        .map(([label, count]) => `${label}=${count}`)
        .join(", ") || "none"
    }`,
  );
  console.log(
    `Markdown images: ${summary.markdownImageReferences.markdownSyntax}, ` +
      `HTML images: ${summary.markdownImageReferences.htmlImgTags}`,
  );
}

function parseArgs(args) {
  const options = {
    apiUrl: process.env.GLM_OCR_API_URL || DEFAULT_API_URL,
    forceSize: false,
    help: false,
    inputPath: undefined,
    needLayoutVisualization: false,
    outDir: "out/glm-ocr",
    returnCropImages: true,
    startPageId: undefined,
    endPageId: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--api-url":
        options.apiUrl = readOptionValue(args, ++index, arg);
        break;
      case "--end-page":
        options.endPageId = parsePositiveInteger(
          readOptionValue(args, ++index, arg),
          arg,
        );
        break;
      case "--force-size":
        options.forceSize = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--layout-visualization":
        options.needLayoutVisualization = true;
        break;
      case "--no-crop-images":
        options.returnCropImages = false;
        break;
      case "--out-dir":
        options.outDir = readOptionValue(args, ++index, arg);
        break;
      case "--start-page":
        options.startPageId = parsePositiveInteger(
          readOptionValue(args, ++index, arg),
          arg,
        );
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        if (options.inputPath) {
          throw new Error(`Unexpected extra argument: ${arg}`);
        }
        options.inputPath = arg;
    }
  }

  if (
    options.startPageId !== undefined &&
    options.endPageId !== undefined &&
    options.startPageId > options.endPageId
  ) {
    throw new Error("--start-page must be <= --end-page.");
  }

  return options;
}

function readOptionValue(args, index, optionName) {
  const value = args[index];

  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}

function parsePositiveInteger(value, optionName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be a positive integer.`);
  }

  return parsed;
}

function createRequestBody(bytes, mimeType, options) {
  const body = {
    model: MODEL,
    file: `data:${mimeType};base64,${bytes.toString("base64")}`,
    return_crop_images: options.returnCropImages,
    need_layout_visualization: options.needLayoutVisualization,
    request_id: randomUUID(),
  };

  if (options.startPageId !== undefined) {
    body.start_page_id = options.startPageId;
  }

  if (options.endPageId !== undefined) {
    body.end_page_id = options.endPageId;
  }

  return body;
}

function inferMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    default:
      throw new Error("Only PDF, JPG, and PNG files are supported.");
  }
}

function buildEndpoint(apiUrl) {
  return `${apiUrl.replace(/\/+$/, "")}/api/paas/v4/layout_parsing`;
}

function parseJsonResponse(bodyText) {
  try {
    return JSON.parse(bodyText);
  } catch {
    return undefined;
  }
}

async function createOutputDirectory(baseOutputDirectory, inputPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const inputName = path.basename(inputPath, path.extname(inputPath));
  const safeInputName = sanitizeFileName(inputName);
  const outputDirectory = path.resolve(
    baseOutputDirectory,
    `${safeInputName}-${timestamp}`,
  );

  await mkdir(outputDirectory, { recursive: true });
  return outputDirectory;
}

function sanitizeFileName(inputName) {
  let output = "";

  for (const char of inputName) {
    const code = char.charCodeAt(0);
    const isControlChar = code < 32;
    const isInvalidChar = '<>:"/\\|?*'.includes(char);

    output += isControlChar || isInvalidChar ? "-" : char;
  }

  return output;
}

function createSummary(body, markdown, input) {
  const layoutDetails = Array.isArray(body.layout_details)
    ? body.layout_details
    : [];
  const flatLayout = layoutDetails.flat().filter(isLayoutElement);

  return {
    input,
    id: typeof body.id === "string" ? body.id : undefined,
    requestId:
      typeof body.request_id === "string" ? body.request_id : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    numPages:
      typeof body.data_info?.num_pages === "number"
        ? body.data_info.num_pages
        : undefined,
    usage: typeof body.usage === "object" ? body.usage : undefined,
    markdownChars: markdown.length,
    markdownImageReferences: countMarkdownImageReferences(markdown),
    layoutLabelCounts: countLayoutLabels(flatLayout),
    layoutVisualizationCount: Array.isArray(body.layout_visualization)
      ? body.layout_visualization.length
      : 0,
  };
}

function isLayoutElement(value) {
  return value && typeof value === "object" && typeof value.label === "string";
}

function countLayoutLabels(layoutElements) {
  const counts = {};

  for (const element of layoutElements) {
    counts[element.label] = (counts[element.label] ?? 0) + 1;
  }

  return counts;
}

function countMarkdownImageReferences(markdown) {
  return {
    markdownSyntax: countMatches(
      markdown,
      /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g,
    ),
    htmlImgTags: countMatches(
      markdown,
      /<img\b[^>]*\bsrc=["']https?:\/\/[^"']+["'][^>]*>/gi,
    ),
  };
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function summarizeResponse(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function printUsage() {
  console.log(`Usage:
  node scripts/glm-ocr-smoke-test.mjs <pdf-or-image-path> [options]

Required environment:
  GLM_API_KEY                 Zhipu/BigModel API key.

Options:
  --api-url <url>             API base URL. Defaults to GLM_OCR_API_URL or ${DEFAULT_API_URL}.
  --out-dir <dir>             Output base directory. Defaults to out/glm-ocr.
  --start-page <n>            First PDF page to parse, 1-based.
  --end-page <n>              Last PDF page to parse, 1-based.
  --no-crop-images            Set return_crop_images=false.
  --layout-visualization      Set need_layout_visualization=true.
  --force-size                Call API even if PDF is above 50MB.
  -h, --help                  Show this help.

Outputs:
  result.md                   GLM-OCR md_results.
  raw-response.json           Full JSON response.
  summary.json                Counts for pages, layout labels, image references, and usage.
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
