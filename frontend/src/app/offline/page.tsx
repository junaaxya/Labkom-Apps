"use client";

export default function OfflinePage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8"
      style={{ background: "#e8d8c9" }}
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{ background: "#1a1a1a", border: "3px solid #1a1a1a" }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f5ede6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>

      <div className="text-center">
        <h1
          className="font-heading text-2xl font-bold"
          style={{ color: "#1a1a1a" }}
        >
          Tidak Ada Koneksi
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#5a5a5a" }}>
          Periksa koneksi internet kamu dan coba lagi.
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="rounded-xl px-6 py-3 text-sm font-bold transition-opacity hover:opacity-80"
        style={{
          background: "#4b607f",
          border: "2px solid #1a1a1a",
          color: "#f5ede6",
        }}
      >
        Coba Lagi
      </button>
    </div>
  );
}
