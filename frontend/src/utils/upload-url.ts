const API_BASE = process.env.NEXT_PUBLIC_API_URL || (() => {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
})();

export function toUploadDisplayUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) return url;

  const protectedMatch = url.match(/^\/uploads\/(tickets|evidence|conditions|tasks|templates|general)\/(.+)$/);
  if (protectedMatch) {
    return `${API_BASE}/files/${protectedMatch[1]}/${protectedMatch[2]}`;
  }

  const staticBase = API_BASE.replace("/api/v1", "");
  return `${staticBase}${url}`;
}
