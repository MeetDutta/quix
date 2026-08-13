const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
// Clean trailing slashes and redundant /api/v1 suffixes
const baseHost = rawApiUrl.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");

export const API_BASE = baseHost;
export const API_V1 = `${baseHost}/api/v1`;

/**
 * Authenticated fetch wrapper. Automatically injects Bearer token and handles JSON.
 * Automatically handles 401 Unauthorized / expired token by clearing session.
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
  const normalizedPath = path.replace(/^\/api\/v1/, "");
  const formattedPath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  
  const res = await fetch(`${API_V1}${formattedPath}`, { ...rest, headers: h });

  // Automatic stale session cleanup on 401
  if (res.status === 401 && typeof window !== "undefined" && !path.includes("/auth/login")) {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("fullName");
    localStorage.removeItem("institutionId");
    window.location.href = "/login?expired=1";
  }

  return res;
}
