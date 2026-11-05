import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { Share } from "@capacitor/share";

export type DownloadFileInput = {
  url: string;
  filename: string;
  headers?: Record<string, string>;
};

function safeFilename(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-");
}

export async function saveBase64File(input: { base64: string; filename: string }): Promise<void> {
  const filename = safeFilename(input.filename);
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({ directory: Directory.Cache, path: filename, data: input.base64 });
    await Share.share({ title: filename, files: [result.uri], dialogTitle: "Simpan atau bagikan file" });
    return;
  }
  const anchor = document.createElement("a");
  anchor.href = `data:application/octet-stream;base64,${input.base64}`;
  anchor.download = filename;
  anchor.click();
}

export async function downloadFile(input: DownloadFileInput): Promise<void> {
  const filename = safeFilename(input.filename);
  if (Capacitor.isNativePlatform()) {
    const target = await Filesystem.getUri({ directory: Directory.Cache, path: filename });
    await FileTransfer.downloadFile({ url: input.url, path: target.uri, headers: input.headers });
    await Share.share({ title: filename, files: [target.uri], dialogTitle: "Simpan atau bagikan file" });
    return;
  }

  const response = await fetch(input.url, { headers: input.headers });
  if (!response.ok) throw new Error("Download gagal");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
