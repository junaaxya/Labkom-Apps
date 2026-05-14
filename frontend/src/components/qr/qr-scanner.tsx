"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type QRScannerProps = {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
};

type Html5QrcodeInstance = {
  isScanning: boolean;
  start: (
    cameraConfig: { facingMode: "environment" } | { deviceId: { exact: string } },
    config: {
      fps?: number;
      qrbox?: { width: number; height: number };
      aspectRatio?: number;
      disableFlip?: boolean;
    },
    onSuccess: (decodedText: string) => void,
    onError?: (errorMessage: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
};

const PERMISSION_DENIED_REGEX = /(permission|denied|notallowed|securityerror|camera access)/i;

export function QRScanner({ onScanSuccess, onScanError }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const isStartingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleScanSuccess = (decodedText: string) => {
    onScanSuccess(decodedText);
  };

  const handleScanError = (message: string) => {
    onScanError?.(message);
  };

  const reactId = useId();
  const scannerElementId = useMemo(
    () => `qr-scanner-${reactId.replace(/[:]/g, "")}`,
    [reactId]
  );

  useEffect(() => {
    let scanner: Html5QrcodeInstance | null = null;
    let cancelled = false;

    const initScanner = async () => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (cancelled) {
          isStartingRef.current = false;
          return;
        }

        scanner = new Html5Qrcode(scannerElementId) as unknown as Html5QrcodeInstance;
        scannerRef.current = scanner;

        const containerWidth = containerRef.current?.clientWidth || 360;
        const qrSize = Math.min(Math.floor(containerWidth * 0.65), 250);

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: qrSize, height: qrSize },
            aspectRatio: 1.0,
            disableFlip: false,
          },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        );

        isStartingRef.current = false;
      } catch (error) {
        isStartingRef.current = false;
        const message = error instanceof Error ? error.message : "Gagal mengakses kamera";
        const friendly = PERMISSION_DENIED_REGEX.test(message)
          ? "Izin kamera ditolak. Aktifkan izin kamera lalu coba lagi."
          : "Kamera tidak dapat dijalankan. Pastikan browser mendukung akses kamera.";

        if (cancelled) return;

        setErrorMessage(friendly);
        handleScanError(friendly);
      }
    };

    void initScanner();

    return () => {
      cancelled = true;

      const currentScanner = scannerRef.current;
      scannerRef.current = null;

      if (!currentScanner) return;

      const cleanup = async () => {
        try {
          if (currentScanner.isScanning) {
            await currentScanner.stop();
          }
        } catch {}
        try {
          currentScanner.clear();
        } catch {}
      };

      cleanup();
    };
  }, [scannerElementId]);

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="w-full rounded-xl neo-border-sm neo-shadow-sm bg-white overflow-hidden">
        <div
          id={scannerElementId}
          className="w-full aspect-square max-h-[70vh] bg-[#f5ede6]"
        />
      </div>

      {errorMessage ? (
        <div className="neo-border-sm rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : (
        <p className="text-xs text-[#5a5a5a] text-center">
          Arahkan kamera ke QR Code
        </p>
      )}
    </div>
  );
}

export default QRScanner;
