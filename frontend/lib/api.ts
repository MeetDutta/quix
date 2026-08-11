export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_V1 = `${API_BASE}/api/v1`;

/**
 * Authenticated fetch wrapper. Automatically injects Bearer token and handles JSON.
 */
export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<Response> {
  const { token, headers, ...rest } = options;
  const h: Record<string, string> = { ...(headers as Record<string, string>) };
  if (token) h["Authorization"] = `Bearer ${token}`;
  if (!h["Content-Type"] && !(rest.body instanceof FormData)) {
    h["Content-Type"] = "application/json";
  }
  // Don't set Content-Type for FormData — let the browser set the multipart boundary
  if (rest.body instanceof FormData) {
    delete h["Content-Type"];
  }
  
  // Normalize path so /api/v1 is never duplicated
  const normalizedPath = path.startsWith("/api/v1") ? path.replace(/^\/api\/v1/, "") : path;
  const formattedPath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  
  return fetch(`${API_V1}${formattedPath}`, { ...rest, headers: h });
}
