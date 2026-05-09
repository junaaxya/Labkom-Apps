import crypto from "crypto";
import fs from "fs";
import path from "path";

const defaultUploadRoot = process.env.NODE_ENV === "production"
  ? "/app/uploads"
  : path.resolve(process.cwd(), "uploads");

export const uploadRoot = path.resolve(process.env.UPLOAD_DIR || defaultUploadRoot);

export const uploadCategories = ["avatars", "tickets", "evidence", "conditions", "tasks", "templates", "general"] as const;
export type UploadCategory = (typeof uploadCategories)[number];

export const publicUploadCategories = ["avatars"] as const satisfies readonly UploadCategory[];
export const protectedUploadCategories = ["tickets", "evidence", "conditions", "tasks", "templates", "general"] as const satisfies readonly UploadCategory[];

export const uploadLimits: Record<UploadCategory, number> = {
  avatars: 5 * 1024 * 1024,
  tickets: 10 * 1024 * 1024,
  evidence: 10 * 1024 * 1024,
  conditions: 5 * 1024 * 1024,
  tasks: 10 * 1024 * 1024,
  templates: 10 * 1024 * 1024,
  general: 10 * 1024 * 1024,
};

const allowedImageMimeToExt: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function ensureUploadDirectories(): void {
  for (const category of uploadCategories) {
    fs.mkdirSync(getUploadCategoryDir(category), { recursive: true });
  }
}

export function isUploadCategory(value: string): value is UploadCategory {
  return uploadCategories.includes(value as UploadCategory);
}

export function isProtectedUploadCategory(value: UploadCategory): boolean {
  return protectedUploadCategories.includes(value as (typeof protectedUploadCategories)[number]);
}

export function getUploadCategoryDir(category: UploadCategory): string {
  return path.join(uploadRoot, category);
}

export function getUploadPath(category: UploadCategory, filename: string): string {
  const safeFilename = path.basename(filename);
  const resolved = path.resolve(getUploadCategoryDir(category), safeFilename);
  const categoryRoot = path.resolve(getUploadCategoryDir(category));

  if (!resolved.startsWith(`${categoryRoot}${path.sep}`) && resolved !== categoryRoot) {
    throw new Error("Path file upload tidak valid");
  }

  return resolved;
}

export function toUploadUrl(category: UploadCategory, filename: string): string {
  return `/uploads/${category}/${path.basename(filename)}`;
}

export function parseUploadUrl(url?: string | null): { category: UploadCategory; filename: string } | null {
  if (!url) return null;

  const match = url.match(/^\/uploads\/([^/]+)\/([^/]+)$/);
  if (!match) return null;

  const category = match[1];
  const filename = path.basename(match[2]);

  if (!isUploadCategory(category) || !filename || filename !== match[2]) return null;

  return { category, filename };
}

export function safeDeleteUpload(url?: string | null, allowedCategories: UploadCategory[] = [...uploadCategories]): void {
  const parsed = parseUploadUrl(url);
  if (!parsed || !allowedCategories.includes(parsed.category)) return;

  const filePath = getUploadPath(parsed.category, parsed.filename);
  fs.unlink(filePath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.warn(`[Upload] Failed to delete ${parsed.category}/${parsed.filename}: ${error.message}`);
    }
  });
}

export function getImageExtension(mimetype: string): string | null {
  return allowedImageMimeToExt[mimetype] || null;
}

export function createUploadFilename(prefix: string, mimetype: string): string {
  const ext = getImageExtension(mimetype);
  if (!ext) throw new Error("Tipe file tidak didukung");

  return `${prefix}-${Date.now()}-${crypto.randomUUID()}${ext}`;
}
