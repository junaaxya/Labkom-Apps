"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="bg-[#e8d8c9] min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border-2 border-[#1a1a1a] rounded-xl shadow-[6px_6px_0px_#1a1a1a] p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 border-2 border-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1a1a1a] mb-2">Terjadi Kesalahan</h2>
          <p className="text-[#5a5a5a] mb-6 text-sm">
            {error.message || "Aplikasi mengalami error yang tidak terduga."}
          </p>
          <button
            onClick={reset}
            className="bg-[#f3701e] text-white font-bold py-3 px-6 border-2 border-[#1a1a1a] rounded-xl shadow-[4px_4px_0px_#1a1a1a] hover:shadow-[2px_2px_0px_#1a1a1a] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            Coba Lagi
          </button>
        </div>
      </body>
    </html>
  );
}
