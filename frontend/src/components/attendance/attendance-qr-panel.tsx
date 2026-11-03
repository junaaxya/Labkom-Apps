"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { TbQrcode, TbRefresh } from "react-icons/tb";
import api from "@/services/api";
import type { AttendanceLocation } from "@/types";

type QrChallenge = {
  qrDataUrl: string;
  expiresAt: string;
  ttlSeconds: number;
  location: { id: string; name: string };
};

function unwrap<T>(value: unknown): T {
  if (value && typeof value === "object" && "data" in value) return (value as { data: T }).data;
  return value as T;
}

function messageOf(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

export function AttendanceQrPanel() {
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const [challenge, setChallenge] = useState<QrChallenge | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const locationRequestRef = useRef(0);
  const challengeRequestRef = useRef(0);

  const loadLocations = useCallback(async () => {
    const generation = ++locationRequestRef.current;
    setLocationsLoading(true);
    setLocationsError(null);
    try {
      const response = await api.get<unknown>("/attendance/locations");
      if (generation !== locationRequestRef.current) return;
      const rows = unwrap<AttendanceLocation[]>(response);
      const enabled = Array.isArray(rows) ? rows.filter((row) => row.isActive) : [];
      setLocations(enabled);
      setLocationId((current) => enabled.some((row) => row.id === current) ? current : enabled[0]?.id || "");
    } catch (reason) {
      if (generation !== locationRequestRef.current) return;
      setLocations([]);
      setLocationId("");
      setLocationsError(messageOf(reason, "Gagal memuat lokasi QR absensi."));
    } finally {
      if (generation === locationRequestRef.current) setLocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadLocations());
    return () => {
      locationRequestRef.current += 1;
      challengeRequestRef.current += 1;
    };
  }, [loadLocations]);

  const refreshChallenge = useCallback(async () => {
    if (!locationId || document.visibilityState === "hidden") return;
    const generation = ++challengeRequestRef.current;
    setQrLoading(true);
    setQrError(null);
    try {
      const response = await api.post<unknown>("/attendance/qr/challenge", { locationId });
      if (generation !== challengeRequestRef.current) return;
      const next = unwrap<QrChallenge>(response);
      const remaining = Math.max(0, Math.ceil((new Date(next.expiresAt).getTime() - Date.now()) / 1000));
      if (!next?.qrDataUrl || !Number.isFinite(new Date(next.expiresAt).getTime()) || remaining <= 0) {
        throw new Error("QR yang diterima sudah kedaluwarsa. Silakan coba lagi.");
      }
      setChallenge(next);
      setSecondsLeft(remaining);
    } catch (reason) {
      if (generation !== challengeRequestRef.current) return;
      setChallenge(null);
      setSecondsLeft(0);
      setQrError(messageOf(reason, "Gagal membuat QR absensi."));
    } finally {
      if (generation === challengeRequestRef.current) setQrLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    challengeRequestRef.current += 1;
    if (locationId) queueMicrotask(() => void refreshChallenge());
  }, [locationId, refreshChallenge]);

  useEffect(() => {
    if (!challenge) return;
    const expiresAt = new Date(challenge.expiresAt).getTime();
    const refreshDelay = Math.max(0, expiresAt - Date.now() - 3_000);
    const timer = window.setTimeout(() => void refreshChallenge(), refreshDelay);
    return () => window.clearTimeout(timer);
  }, [challenge, refreshChallenge]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!challenge) return setSecondsLeft(0);
      const remaining = Math.max(0, Math.ceil((new Date(challenge.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) setChallenge(null);
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && locationId) void refreshChallenge();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [locationId, refreshChallenge]);

  const hasValidChallenge = Boolean(challenge && secondsLeft > 0);

  return (
    <section className="neo-card bg-white p-4 sm:p-6" aria-labelledby="dynamic-attendance-qr-title" aria-busy={locationsLoading || qrLoading}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <h2 id="dynamic-attendance-qr-title" className="flex items-center gap-2 font-heading text-xl font-bold text-[#1a1a1a]">
            <TbQrcode className="h-6 w-6 shrink-0" /> QR Absensi Dinamis
          </h2>
          <p className="mt-1 text-sm text-[#5a5a5a]">
            QR berlaku 30 detik dan diperbarui otomatis sebelum kedaluwarsa. Tampilkan hanya di lokasi piket.
          </p>

          {locationsLoading ? (
            <p className="mt-4 text-sm font-bold text-[#5a5a5a]" role="status">Memuat lokasi absensi...</p>
          ) : locationsError ? (
            <div className="mt-4 rounded-lg bg-red-50 p-3 neo-border-sm" role="alert">
              <p className="text-sm font-bold text-red-700">{locationsError}</p>
              <button type="button" onClick={() => void loadLocations()} className="neo-btn mt-3 min-h-[44px] bg-white px-4 py-2 text-sm font-bold">Coba muat lokasi lagi</button>
            </div>
          ) : locations.length === 0 ? (
            <p className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm font-bold text-yellow-800 neo-border-sm">Belum ada lokasi absensi aktif. Aktifkan lokasi pada pengaturan absensi.</p>
          ) : (
            <>
              <label className="mt-4 block text-sm font-bold" htmlFor="attendance-qr-location">Lokasi absensi</label>
              <select
                id="attendance-qr-location"
                value={locationId}
                onChange={(event) => {
                  challengeRequestRef.current += 1;
                  setChallenge(null);
                  setSecondsLeft(0);
                  setQrError(null);
                  setLocationId(event.target.value);
                }}
                disabled={qrLoading}
                className="neo-input mt-1 min-h-[44px] w-full max-w-sm bg-white px-3 disabled:opacity-60"
              >
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </>
          )}
        </div>

        <div className="flex w-full flex-col items-center lg:w-[280px]" aria-live="polite">
          {hasValidChallenge && challenge ? (
            <Image src={challenge.qrDataUrl} alt={`Kode QR absensi untuk ${challenge.location.name}`} width={260} height={260} unoptimized className="h-auto w-full max-w-[260px] bg-white neo-border" />
          ) : (
            <div className="flex aspect-square w-full max-w-[260px] items-center justify-center bg-[#f5ede6] p-6 text-center text-sm font-bold text-[#5a5a5a] neo-border">
              {qrLoading ? "Membuat QR absensi..." : qrError ? "QR tidak dapat dibuat" : locationsLoading ? "Memuat lokasi..." : !locationId ? "Lokasi aktif belum tersedia" : "QR belum tersedia"}
            </div>
          )}
          <div className="mt-3 flex w-full flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
            <span className={`text-sm font-bold ${hasValidChallenge && secondsLeft <= 5 ? "text-red-600" : "text-[#4b607f]"}`}>
              {hasValidChallenge ? `Berlaku ${secondsLeft} detik` : "QR tidak aktif"}
            </span>
            <button type="button" onClick={() => void refreshChallenge()} disabled={!locationId || qrLoading || locationsLoading} className="neo-btn min-h-[44px] bg-white px-3 py-2 text-sm font-bold disabled:opacity-50" aria-label="Perbarui kode QR absensi sekarang">
              <TbRefresh className={`mr-1 inline h-4 w-4 ${qrLoading ? "animate-spin" : ""}`} /> Perbarui
            </button>
          </div>
          {qrError && (
            <div className="mt-2 w-full" role="alert">
              <p className="text-sm font-bold text-red-700">{qrError}</p>
              <button type="button" onClick={() => void refreshChallenge()} disabled={qrLoading} className="mt-2 min-h-[44px] text-sm font-bold text-red-700 underline disabled:opacity-50">Coba buat QR lagi</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
