"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { TbQrcode, TbKey, TbDeviceDesktop, TbLoader2 } from "react-icons/tb";
import QRScanner from "@/components/qr/qr-scanner";
import { useToast } from "@/providers/toast-provider";

function extractCode(decodedText: string, segment: "/scan/key/" | "/scan/pc/"): string {
  const index = decodedText.indexOf(segment);
  if (index === -1) return "";
  const suffix = decodedText.slice(index + segment.length).trim();
  if (!suffix) return "";
  return suffix.split(/[/?#]/)[0] || "";
}

export default function ScanPage() {
  const toast = useToast();
  const router = useRouter();
  const [isHandlingScan, setIsHandlingScan] = useState(false);
  const [scanResult, setScanResult] = useState<{ type: "key" | "pc"; code: string } | null>(null);

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      if (isHandlingScan) return;

      const keyCode = extractCode(decodedText, "/scan/key/");
      if (keyCode) {
        setIsHandlingScan(true);
        setScanResult({ type: "key", code: keyCode });
        router.push(`/scan/key/${encodeURIComponent(keyCode)}`);
        return;
      }

      const assetCode = extractCode(decodedText, "/scan/pc/");
      if (assetCode) {
        setIsHandlingScan(true);
        setScanResult({ type: "pc", code: assetCode });
        router.push(`/scan/pc/${encodeURIComponent(assetCode)}`);
        return;
      }

      toast.error("QR Code tidak dikenali. Pastikan QR dari sistem Labkom.");
    },
    [isHandlingScan, router, toast]
  );

  return (
    <div className="max-w-lg mx-auto space-y-6 px-2 sm:px-0">
      <div className="neo-card p-4 sm:p-6 bg-white shadow-[4px_4px_0px_#1a1a1a]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#f3701e] text-white neo-border flex items-center justify-center shrink-0 shadow-[4px_4px_0px_#1a1a1a]">
            <TbQrcode size={28} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a]">Scan QR Code</h1>
            <p className="text-sm text-[#4b607f] font-medium mt-1">Arahkan kamera ke QR kunci atau PC</p>
          </div>
        </div>
      </div>

      <div className="neo-card p-4 sm:p-6 bg-white space-y-4 shadow-[4px_4px_0px_#1a1a1a]">
        {isHandlingScan && scanResult ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            <TbLoader2 size={48} className="animate-spin text-[#f3701e]" strokeWidth={2.2} />
            <div className="text-center space-y-4">
              <p className="font-heading font-bold text-2xl text-[#1a1a1a]">QR Terbaca!</p>
              <div className="flex items-center justify-center gap-2 neo-badge bg-[#e8d8c9] text-[#1a1a1a] px-5 py-2.5 shadow-[2px_2px_0px_#1a1a1a] neo-border-sm">
                {scanResult.type === "key" ? (
                  <TbKey size={24} className="text-[#f3701e]" strokeWidth={2.2} />
                ) : (
                  <TbDeviceDesktop size={24} className="text-[#f3701e]" strokeWidth={2.2} />
                )}
                <span className="text-base font-bold">
                  {scanResult.type === "key" ? "Kunci" : "PC"}: <strong className="text-[#4b607f]">{scanResult.code}</strong>
                </span>
              </div>
              <p className="text-sm text-[#4b607f] font-bold animate-pulse">Mengarahkan ke halaman detail...</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden neo-border shadow-[2px_2px_0px_#1a1a1a]">
            <QRScanner onScanSuccess={handleScanSuccess} onScanError={(message) => toast.error(message)} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="neo-card p-5 bg-white text-center neo-card-hover hover:-translate-y-1 transition-all duration-200 group">
          <div className="w-14 h-14 mx-auto rounded-xl bg-[#4b607f]/10 flex items-center justify-center mb-4 group-hover:bg-[#4b607f] transition-colors duration-200 neo-border shadow-[2px_2px_0px_#1a1a1a]">
            <TbKey size={28} className="text-[#4b607f] group-hover:text-white transition-colors duration-200" strokeWidth={2.2} />
          </div>
          <p className="font-heading font-bold text-lg text-[#1a1a1a]">Kunci Lab</p>
          <p className="text-xs text-[#4b607f] font-bold mt-1 uppercase tracking-wider">Ambil / Kembalikan</p>
        </div>
        <div className="neo-card p-5 bg-white text-center neo-card-hover hover:-translate-y-1 transition-all duration-200 group">
          <div className="w-14 h-14 mx-auto rounded-xl bg-[#f3701e]/10 flex items-center justify-center mb-4 group-hover:bg-[#f3701e] transition-colors duration-200 neo-border shadow-[2px_2px_0px_#1a1a1a]">
            <TbDeviceDesktop size={28} className="text-[#f3701e] group-hover:text-white transition-colors duration-200" strokeWidth={2.2} />
          </div>
          <p className="font-heading font-bold text-lg text-[#1a1a1a]">PC Lab</p>
          <p className="text-xs text-[#4b607f] font-bold mt-1 uppercase tracking-wider">Lapor / Lihat Status</p>
        </div>
      </div>
    </div>
  );
}
