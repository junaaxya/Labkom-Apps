"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type QRScannerProps = {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
};

type Html5QrcodeInstance = {
  isScanning: boolean;
  start: (
    cameraConfig: { facingMode: "environment" },
    config: { fps?: number; qrbox?: { width: number; height: number }; aspectRatio?: number; disableFlip?: boolean },
    onSuccess: (decodedText: string) => void,
    onError?: (errorMessage: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
};

function friendlyCameraError(error: unknown): string {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/(permission|denied|notallowed|securityerror|camera access)/i.test(message)) {
    return "Izin kamera ditolak. Izinkan kamera pada pengaturan browser, lalu coba lagi.";
  }
  if (/(notfound|devicesnotfound|no camera|camera.*not.*found)/i.test(message)) {
    return "Kamera tidak ditemukan. Pastikan perangkat memiliki kamera yang dapat digunakan.";
  }
  if (/(notreadable|trackstarterror|could not start|in use|busy)/i.test(message)) {
    return "Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi.";
  }
  return "Kamera tidak dapat dijalankan. Pastikan browser mendukung kamera, lalu coba lagi.";
}

async function stopAndClear(scanner: Html5QrcodeInstance): Promise<void> {
  try {
    if (scanner.isScanning) await scanner.stop();
  } catch {
    // Kamera mungkin sudah berhenti saat browser membatalkan proses start.
  }
  try {
    scanner.clear();
  } catch {
    // Elemen scanner mungkin sudah dilepas ketika komponen dibongkar.
  }
}

export function QRScanner({ onScanSuccess, onScanError }: QRScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const successRef = useRef(onScanSuccess);
  const errorRef = useRef(onScanError);
  const decodedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryGeneration, setRetryGeneration] = useState(0);

  useEffect(() => { successRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => { errorRef.current = onScanError; }, [onScanError]);

  const reactId = useId();
  const scannerElementId = useMemo(() => `qr-scanner-${reactId.replace(/[:]/g, "")}`, [reactId]);

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5QrcodeInstance | null = null;
    decodedRef.current = false;

    const initScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        scanner = new Html5Qrcode(scannerElementId) as unknown as Html5QrcodeInstance;
        const currentScanner = scanner;
        const containerWidth = containerRef.current?.clientWidth || 360;
        const qrSize = Math.min(Math.floor(containerWidth * 0.65), 250);

        await currentScanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: qrSize, height: qrSize }, aspectRatio: 1, disableFlip: false },
          (decodedText) => {
            if (cancelled || decodedRef.current) return;
            decodedRef.current = true;
            // Kunci decode sebelum callback parent agar frame berikutnya tidak mengirim aksi ganda.
            void stopAndClear(currentScanner);
            successRef.current(decodedText);
          },
          () => {}
        );

        // start() bisa selesai setelah modal ditutup; hentikan stream yang baru berhasil dibuka.
        if (cancelled) await stopAndClear(currentScanner);
      } catch (error) {
        if (scanner && cancelled) await stopAndClear(scanner);
        if (cancelled) return;
        const friendly = friendlyCameraError(error);
        setErrorMessage(friendly);
        errorRef.current?.(friendly);
      }
    };

    void initScanner();

    return () => {
      cancelled = true;
      if (scanner) void stopAndClear(scanner);
    };
  }, [retryGeneration, scannerElementId]);

  return (
    <div className="space-y-3" ref={containerRef} aria-busy={!errorMessage}>
      <div className="w-full overflow-hidden rounded-xl bg-white neo-border-sm neo-shadow-sm">
        <div id={scannerElementId} className="aspect-square max-h-[70vh] w-full bg-[#f5ede6]" />
      </div>

      {errorMessage ? (
        <div className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700 neo-border-sm" role="alert">
          <p className="font-bold">{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setRetryGeneration((value) => value + 1);
            }}
            className="neo-btn mt-3 min-h-[44px] bg-white px-4 py-2 font-bold"
          >
            Coba akses kamera lagi
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-[#5a5a5a]">Arahkan kamera ke kode QR absensi</p>
      )}
    </div>
  );
}

export default QRScanner;
