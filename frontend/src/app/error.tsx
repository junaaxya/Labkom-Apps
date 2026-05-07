"use client";

import { TbAlertTriangle, TbRefresh, TbArrowLeft } from "react-icons/tb";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-white neo-border rounded-xl shadow-[6px_6px_0px_#1a1a1a] p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 neo-border rounded-xl flex items-center justify-center mx-auto mb-4">
          <TbAlertTriangle className="w-8 h-8 text-red-600" strokeWidth={2.2} />
        </div>
        <h2 className="text-2xl font-bold font-heading text-[#1a1a1a] mb-2">
          Halaman Error
        </h2>
        <p className="text-[#5a5a5a] mb-6 text-sm">
          {error.message || "Terjadi kesalahan saat memuat halaman ini."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="neo-btn bg-white text-[#1a1a1a] py-2.5 px-5 flex items-center gap-2"
          >
            <TbArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <button
            onClick={reset}
            className="neo-btn bg-[#f3701e] text-white py-2.5 px-5 flex items-center gap-2"
          >
            <TbRefresh className="w-4 h-4" /> Coba Lagi
          </button>
        </div>
      </div>
    </div>
  );
}
