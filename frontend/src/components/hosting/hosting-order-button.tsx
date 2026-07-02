"use client";

import { useState } from "react";
import { TbLoader2, TbX } from "react-icons/tb";
import { z } from "zod";
import type { HostingPlan } from "@/lib/hosting-plans";
import { formatIdr } from "@/lib/hosting-plans";

const customerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter")
    .max(80, "Nama lengkap maksimal 80 karakter")
    .regex(/^[A-Za-zÀ-ž\s'.-]+$/, "Nama hanya boleh berisi huruf, spasi, apostrof, titik, atau tanda hubung"),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid")
    .max(120, "Email maksimal 120 karakter"),
  whatsapp: z
    .string()
    .trim()
    .min(8, "Nomor WhatsApp minimal 8 digit")
    .max(24, "Nomor WhatsApp maksimal 24 karakter")
    .regex(/^(\+62|62|0)[\d\s-]+$/, "Nomor WhatsApp harus diawali +62, 62, atau 0")
    .transform((value) => value.replace(/[\s-]/g, "")),
  notes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter"),
});

type CustomerData = z.input<typeof customerSchema>;
type CustomerField = keyof CustomerData;
type CustomerErrors = Partial<Record<CustomerField, string>>;

interface CreateTransactionResponse {
  success: boolean;
  message?: string;
  data?: {
    paymentUrl?: string;
    redirectUrl?: string;
    token?: string;
    orderId: string;
    reference?: string;
  };
}

const paymentMethods = [
  { code: "BC", name: "BCA Virtual Account" },
  { code: "M2", name: "Mandiri Virtual Account" },
  { code: "I1", name: "BNI Virtual Account" },
  { code: "BR", name: "BRIVA" },
  { code: "NQ", name: "QRIS" },
  { code: "OV", name: "OVO" },
  { code: "DA", name: "DANA" },
  { code: "SA", name: "ShopeePay" },
  { code: "VC", name: "Kartu Kredit" },
];

const emptyCustomer: CustomerData = {
  fullName: "",
  email: "",
  whatsapp: "",
  notes: "",
};

function getCustomerErrors(error: z.ZodError<CustomerData>): CustomerErrors {
  return error.issues.reduce<CustomerErrors>((fields, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && field in emptyCustomer && !fields[field as CustomerField]) {
      fields[field as CustomerField] = issue.message;
    }
    return fields;
  }, {});
}

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL belum dikonfigurasi.");
  return url;
}

export function HostingOrderButton({ plan }: { plan: HostingPlan }) {
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerData>(emptyCustomer);
  const [fieldErrors, setFieldErrors] = useState<CustomerErrors>({});
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0].code);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateCustomer(field: CustomerField, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (error) setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError("");
    setFieldErrors({});

    const parsedCustomer = customerSchema.safeParse(customer);
    if (!parsedCustomer.success) {
      setFieldErrors(getCustomerErrors(parsedCustomer.error));
      setError("Periksa kembali data pemesan sebelum melanjutkan pembayaran.");
      return;
    }

    if (!paymentMethod) {
      setError("Pilih metode pembayaran sebelum melanjutkan.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/hosting/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          paymentMethod,
          customer: parsedCustomer.data,
        }),
      });

      const result = (await response.json()) as CreateTransactionResponse;
      const paymentUrl = result.data?.paymentUrl || result.data?.redirectUrl;
      if (!response.ok || !paymentUrl) {
        throw new Error(result.message || "Gagal membuat transaksi pembayaran.");
      }

      window.location.href = paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat transaksi pembayaran.");
      setLoading(false);
    }
  }

  const closeModal = () => {
    if (loading) return;
    setOpen(false);
    setError("");
    setFieldErrors({});
    setPaymentMethod(paymentMethods[0].code);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`neo-btn flex min-h-[44px] w-full items-center justify-center px-4 py-3 text-sm font-bold ${
          plan.isPopular
            ? "bg-[#f3701e] text-white"
            : "bg-white text-[#1a1a1a]"
        }`}
      >
        Pesan Sekarang
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={closeModal}
        >
          <div
            className="neo-card max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto bg-white text-[#1a1a1a]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-[#1a1a1a] bg-[#4b607f] p-5 text-white">
              <div>
                <h2 className="text-xl font-heading font-bold">Detail Pemesanan</h2>
                <p className="mt-1 text-sm text-white/80">
                  {plan.name} - {plan.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                aria-label="Tutup"
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#1a1a1a] neo-border-sm disabled:opacity-50"
              >
                <TbX className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div className="rounded-lg border-2 border-[#1a1a1a] bg-[#f5ede6] p-4">
                <p className="text-sm font-bold text-[#5a5a5a]">Total pembayaran</p>
                <p className="mt-1 text-2xl font-heading font-bold text-[#1a1a1a]">
                  {formatIdr(plan.price)}
                </p>
                <p className="text-xs font-semibold text-[#5a5a5a]">
                  Paket aktif 12 bulan, sudah termasuk pajak.
                </p>
              </div>

              <FormField
                id="fullName"
                label="Nama Lengkap"
                value={customer.fullName}
                onChange={(value) => updateCustomer("fullName", value)}
                placeholder="Nama pemesan"
                error={fieldErrors.fullName}
                required
              />
              <FormField
                id="email"
                label="Email"
                type="email"
                value={customer.email}
                onChange={(value) => updateCustomer("email", value)}
                placeholder="email@domain.com"
                error={fieldErrors.email}
                required
                hint="Credential VPS dan invoice dikirim ke email ini."
              />
              <FormField
                id="whatsapp"
                label="WhatsApp"
                type="tel"
                value={customer.whatsapp}
                onChange={(value) => updateCustomer("whatsapp", value)}
                placeholder="+62 812 3456 7890"
                error={fieldErrors.whatsapp}
                required
              />

              <div>
                <p className="mb-2 block text-sm font-bold">
                  Metode Pembayaran <span className="ml-1 text-[#f3701e]">*</span>
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {paymentMethods.map((method) => (
                    <label
                      key={method.code}
                      className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2 font-semibold transition-colors ${
                        paymentMethod === method.code
                          ? "border-[#1a1a1a] bg-[#f3701e] text-white"
                          : "border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#f5ede6]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.code}
                        checked={paymentMethod === method.code}
                        onChange={() => {
                          setPaymentMethod(method.code);
                          if (error) setError("");
                        }}
                        disabled={loading}
                        className="h-4 w-4 accent-[#f3701e]"
                      />
                      <span className="text-sm">{method.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="mb-1.5 block text-sm font-bold">
                  Catatan <span className="font-medium text-[#5a5a5a]">(opsional)</span>
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={customer.notes}
                  onChange={(event) => updateCustomer("notes", event.target.value)}
                  placeholder="OS yang diinginkan, hostname, domain, atau kebutuhan setup lain."
                  aria-invalid={fieldErrors.notes ? "true" : "false"}
                  className={`neo-input min-h-[88px] w-full resize-none bg-white px-3 py-3 text-[#1a1a1a] placeholder:text-[#5a5a5a] ${
                    fieldErrors.notes ? "border-red-700 focus:shadow-[3px_3px_0px_#b91c1c]" : ""
                  }`}
                  disabled={loading}
                />
                <div className="mt-1 flex items-center justify-between gap-3 text-xs font-medium">
                  {fieldErrors.notes ? (
                    <p className="text-red-700">{fieldErrors.notes}</p>
                  ) : (
                    <p className="text-[#5a5a5a]">Maksimal 500 karakter.</p>
                  )}
                  <p className={customer.notes.length > 500 ? "text-red-700" : "text-[#5a5a5a]"}>
                    {customer.notes.length}/500
                  </p>
                </div>
              </div>

              {error && (
                <p className="rounded-lg border-2 border-red-700 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="neo-btn min-h-[44px] flex-1 bg-white px-4 py-3 font-bold disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="neo-btn flex min-h-[44px] flex-[2] items-center justify-center gap-2 bg-[#f3701e] px-4 py-3 font-bold text-white disabled:opacity-60"
                >
                  {loading && <TbLoader2 className="h-5 w-5 animate-spin" />}
                  Lanjut Bayar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  error?: string;
}

function FormField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  hint,
  error,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold">
        {label}
        {required && <span className="ml-1 text-[#f3701e]">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? "true" : "false"}
        className={`neo-input min-h-[44px] w-full bg-white px-3 py-3 text-[#1a1a1a] placeholder:text-[#5a5a5a] ${
          error ? "border-red-700 focus:shadow-[3px_3px_0px_#b91c1c]" : ""
        }`}
      />
      {error ? (
        <p className="mt-1 text-xs font-semibold text-red-700">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs font-medium text-[#5a5a5a]">{hint}</p>
      )}
    </div>
  );
}
