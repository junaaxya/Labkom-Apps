// ponytail: cache is process-local and capped; switch to Redis when backend runs multiple replicas.
export const INSPECTOR_TTL_MS = 900_000;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const MAX_PROCESSES_BYTES = 256 * 1024;
const MAX_ENTRIES = 200;

type Snapshot = {
  capturedAt: string; mimeType: string; width: number; height: number;
  sizeBytes: number; imageBase64: string; expiresAt: string;
};
type ProcessList = { capturedAt: string; processes: unknown[]; expiresAt: string };
type CacheValue = Snapshot | ProcessList;
const cache = new Map<string, { value: CacheValue; expires: number }>();

export function parseInspectorResult(command: string, result: string):
  { summary: string; cacheKey: string; value: CacheValue } | null {
  if (!result || result.length > MAX_SNAPSHOT_BYTES * 2) return null;
  let raw: unknown;
  try { raw = JSON.parse(result); } catch { return null; }
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const capturedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + INSPECTOR_TTL_MS).toISOString();
  if ((command === "CAPTURE_WEBCAM" && data.kind === "webcam") || (command === "CAPTURE_SCREEN" && data.kind === "screen")) {
    if (typeof data.imageBase64 !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.imageBase64)) return null;
    const image = Buffer.from(data.imageBase64, "base64");
    if (!image.length || image.length > MAX_SNAPSHOT_BYTES) return null;
    const mimeType = data.mimeType === "image/png" ? "image/png" : "image/jpeg";
    const width = Number.isSafeInteger(data.width) && Number(data.width) > 0 ? Number(data.width) : 0;
    const height = Number.isSafeInteger(data.height) && Number(data.height) > 0 ? Number(data.height) : 0;
    return {
      cacheKey: data.kind,
      value: { capturedAt, mimeType, width, height, sizeBytes: image.length, imageBase64: data.imageBase64, expiresAt },
      summary: `Snapshot ${data.kind} berhasil diambil (${Math.ceil(image.length / 1024)} KB) pada ${capturedAt}`,
    };
  }
  if (command === "LIST_PROCESSES" && data.kind === "processes" && Array.isArray(data.processes)) {
    if (Buffer.byteLength(JSON.stringify(data.processes)) > MAX_PROCESSES_BYTES) return null;
    return { cacheKey: "processes", value: { capturedAt, processes: data.processes, expiresAt }, summary: `${data.processes.length} proses aktif ditemukan` };
  }
  return null;
}

export function saveInspectorResult(pcId: string, key: string, value: CacheValue): void {
  const now = Date.now();
  for (const [k, entry] of cache) if (entry.expires <= now) cache.delete(k);
  if (cache.size >= MAX_ENTRIES && !cache.has(`${pcId}:${key}`)) cache.delete(cache.keys().next().value!);
  cache.set(`${pcId}:${key}`, { value, expires: now + INSPECTOR_TTL_MS });
}

export function readInspectorResult(pcId: string, key: string): CacheValue | null {
  const entry = cache.get(`${pcId}:${key}`);
  if (!entry) return null;
  if (entry.expires <= Date.now()) { cache.delete(`${pcId}:${key}`); return null; }
  return entry.value;
}
