import { redirect } from "next/navigation";

// Pendaftaran mandiri tidak tersedia. Akun Mahasiswa dibuat oleh Koordinator.
export default function RegisterPage() {
  redirect("/login");
}
