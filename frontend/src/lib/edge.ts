import { X } from "lucide-react";

export async function callEdge(path: string, body?: FormData | string, method = "POST") {
  const base = import.meta.env.VITE_BACKEND_URL;
  console.log("Edge base URL:", base);
  if (!base) throw new Error("Missing VITE_SUPABASE_EDGE_URL");

  const url = `${base}/${path.replace(/^\/+/, "")}`;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const headers: Record<string, string> = {};

  // ⬇️ Required for projects where functions need a JWT
  if (anon) {
    headers["Authorization"] = `Bearer ${anon}`;
    headers["apikey"] = anon;
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