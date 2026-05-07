import { TbError404, TbArrowLeft, TbHome } from "react-icons/tb";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#e8d8c9] flex items-center justify-center p-6">
      <div className="bg-white neo-border rounded-xl shadow-[6px_6px_0px_#1a1a1a] p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-[#f5ede6] neo-border rounded-xl flex items-center justify-center mx-auto mb-4 -rotate-3">
          <TbError404 className="w-10 h-10 text-[#4b607f]" strokeWidth={2.2} />
        </div>
        <h2 className="text-3xl font-bold font-heading text-[#1a1a1a] mb-2">
          404
        </h2>
        <p className="text-[#5a5a5a] mb-6">
          Halaman yang kamu cari tidak ditemukan.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="neo-btn bg-[#4b607f] text-white py-2.5 px-5 flex items-center gap-2"
          >
            <TbHome className="w-4 h-4" /> Beranda
          </Link>
          <Link
            href="/dashboard"
            className="neo-btn bg-[#f3701e] text-white py-2.5 px-5 flex items-center gap-2"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
