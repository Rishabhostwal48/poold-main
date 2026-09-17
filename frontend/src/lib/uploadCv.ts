import { callEdge } from "./edge";

export async function uploadCvPdf(file: File) {
  if (!file) throw new Error("No file selected");
  const isPdf = (file.type || "").includes("pdf") || /\.pdf$/i.test(file.name);
  if (!isPdf) throw new Error("Please upload a PDF");

  const form = new FormData();
  form.append("file", file, file.name); // field name MUST be 'file'

  // Do not set Content-Type; the browser adds the boundary.
  return callEdge("parse-cv", form, "POST"); // expects JSON { ok, file_path, url? }
}