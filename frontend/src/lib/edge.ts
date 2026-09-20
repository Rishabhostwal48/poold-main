import { getAccessToken } from "./backendAuth";

export async function callEdge(path: string, body?: FormData | string, method = "POST") {
  const base = import.meta.env.VITE_BACKEND_URL;
  console.log("Edge base URL:", base);
  if (!base) throw new Error("Missing VITE_BACKEND_URL");

  const url = `${base}/${path.replace(/^\/+/, "")}`;
  const token = getAccessToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // ⚠️ Never set Content-Type for FormData (browser adds boundary)
  if (typeof body === "string") headers["content-type"] = "application/json";

  const res = await fetch(url, { method, body: body as any, headers });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    let message = text || `Edge ${res.status}`;
    try {
      const j = JSON.parse(text);
      message = j.error || j.message || message;
    } catch {}
    throw new Error(`Edge ${res.status}: ${message}`);
  }
  try { return JSON.parse(text); } catch { return text as any; }
}