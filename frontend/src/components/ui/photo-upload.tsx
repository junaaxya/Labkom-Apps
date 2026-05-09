"use client";

import { useState, useRef } from "react";
import { TbPhoto, TbX, TbUpload } from "react-icons/tb";
import { toUploadDisplayUrl } from "@/utils/upload-url";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (() => {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
})();

interface PhotoUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  category?: string;
  maxFiles?: number;
  label?: string;
  disabled?: boolean;
}

export function PhotoUpload({
  value,
  onChange,
  category = "general",
  maxFiles = 5,
  label = "Upload Foto",
  disabled = false,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = maxFiles - value.length;
    if (remaining <= 0) {
      setError(`Maksimal ${maxFiles} foto`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      filesToUpload.forEach((f) => formData.append("photos", f));

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/upload/photos?category=${category}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Upload gagal");
      }

      const data = await res.json();
      const urls: string[] = data.data?.urls || [];
      onChange([...value, ...urls]);
    } catch (err: any) {
      setError(err.message || "Upload gagal");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-bold text-[#1a1a1a]">{label}</label>}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg border-2 border-[#1a1a1a] overflow-hidden group">
              <img src={toUploadDisplayUrl(url)} alt="" className="w-full h-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <TbX className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && value.length < maxFiles && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={maxFiles - value.length > 1}
            onChange={handleUpload}
            className="hidden"
            id={`photo-upload-${category}`}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold border-2 border-[#1a1a1a] rounded-lg bg-white hover:bg-[#f5ede6] shadow-[2px_2px_0px_#1a1a1a] hover:shadow-none transition-all disabled:opacity-50"
          >
            {uploading ? (
              <>
                <TbUpload className="w-4 h-4 animate-pulse" />
                Mengupload...
              </>
            ) : (
              <>
                <TbPhoto className="w-4 h-4" />
                {value.length === 0 ? label : "Tambah Foto"}
              </>
            )}
          </button>
          <p className="text-xs text-[#5a5a5a] mt-1">
            JPG, PNG, WebP. Maks {maxFiles} foto.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

interface SinglePhotoUploadProps {
  value: string;
  onChange: (url: string) => void;
  category?: string;
  label?: string;
  disabled?: boolean;
}

export function SinglePhotoUpload({
  value,
  onChange,
  category = "avatars",
  label = "Upload Foto",
  disabled = false,
}: SinglePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/upload/avatar?category=${category}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Upload gagal");
      }

      const data = await res.json();
      onChange(data.data?.url || "");
    } catch (err: any) {
      setError(err.message || "Upload gagal");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-bold text-[#1a1a1a]">{label}</label>}

      <div className="flex items-center gap-3">
        {value && (
          <div className="relative w-16 h-16 rounded-full border-2 border-[#1a1a1a] overflow-hidden">
            <img src={toUploadDisplayUrl(value)} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {!disabled && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              className="hidden"
              id={`single-photo-upload-${category}`}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold border-2 border-[#1a1a1a] rounded-lg bg-white hover:bg-[#f5ede6] shadow-[2px_2px_0px_#1a1a1a] hover:shadow-none transition-all disabled:opacity-50"
            >
              {uploading ? "Mengupload..." : value ? "Ganti Foto" : label}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}
