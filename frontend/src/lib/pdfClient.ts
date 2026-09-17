// src/lib/pdfClient.ts
// Robust pdf.js client parser for Vite without ?url imports

import * as pdfjsLib from "pdfjs-dist";

// Create a real Web Worker pointing at the ESM worker shipped by pdfjs
const worker = new Worker(
  new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
  { type: "module" }
);

// Tell pdf.js to use our worker instance
// (types don't expose workerPort, so annotate)
(pdfjsLib as any).GlobalWorkerOptions.workerPort = worker;

export async function extractPdfTextClient(file: File) {
  const data = await file.arrayBuffer();
  // pdfjs namespace export exposes getDocument
  const loadingTask = (pdfjsLib as any).getDocument({ data });
  const pdf = await loadingTask.promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return text.trim();
}

export async function extractDocxText(file: File): Promise<string> {
  // Use the browser build of mammoth
  try {
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = await import("mammoth/mammoth.browser"); // << important
    const result = await (mammoth as any).extractRawText({ arrayBuffer });
    return result.value as string;
  } catch (error) {
    console.error("Error extracting DOCX text:", error);
    throw new Error("Failed to extract text from DOCX");
  }
}

export async function extractFileText(file: File): Promise<string> {
  const fileType = (file.type || "").toLowerCase();
  if (fileType.includes("pdf") || /\.pdf$/i.test(file.name)) {
    return extractPdfTextClient(file);
  } else if (
    fileType.includes("wordprocessingml") ||
    fileType.includes("docx") ||
    /\.docx$/i.test(file.name)
  ) {
    return extractDocxText(file);
  } else {
    throw new Error(`Unsupported file type: ${fileType || file.name}`);
  }
}
