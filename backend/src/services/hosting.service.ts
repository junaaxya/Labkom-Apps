import { config } from "../config";

export interface HostingPlanSpec {
  label: string;
  value: string;
}

export interface HostingPlan {
  id: string;
  name: string;
  subtitle: string;
  tagline: string;
  price: number;
  originalPrice: number;
  discount: number;
  renewalPrice: number;
  isPopular: boolean;
  isPremium: boolean;
  specs: HostingPlanSpec[];
}

export interface HostingCustomer {
  fullName: string;
  email: string;
  whatsapp: string;
  notes?: string;
}

export const HOSTING_PLANS: HostingPlan[] = [
  {
    id: "kvm-1",
    name: "KVM 1",
    subtitle: "Starter VPS",
    tagline: "Cocok untuk proyek pribadi dan landing page",
    price: 1_000_000,
    originalPrice: 3_000_000,
    discount: 67,
    renewalPrice: 2_400_000,
    isPopular: false,
    isPremium: false,
    specs: [
      { label: "vCPU", value: "1 Core" },
      { label: "RAM", value: "4 GB" },
      { label: "NVMe", value: "50 GB" },
    ],
  },
  {
    id: "kvm-2",
    name: "KVM 2",
    subtitle: "Business VPS",
    tagline: "Pilihan seimbang untuk website bisnis",
    price: 2_000_000,
    originalPrice: 5_400_000,
    discount: 63,
    renewalPrice: 3_000_000,
    isPopular: true,
    isPremium: false,
    specs: [
      { label: "vCPU", value: "2 Core" },
      { label: "RAM", value: "8 GB" },
      { label: "NVMe", value: "100 GB" },
    ],
  },
  {
    id: "kvm-4",
    name: "KVM 4",
    subtitle: "Professional VPS",
    tagline: "Untuk traffic tinggi dan aplikasi produksi",
    price: 3_200_000,
    originalPrice: 10_700_000,
    discount: 70,
    renewalPrice: 5_800_000,
    isPopular: false,
    isPremium: true,
    specs: [
      { label: "vCPU", value: "4 Core" },
      { label: "RAM", value: "16 GB" },
      { label: "NVMe", value: "200 GB" },
    ],
  },
  {
    id: "kvm-8",
    name: "KVM 8",
    subtitle: "Enterprise VPS",
    tagline: "Untuk workload besar dan layanan kritikal",
    price: 5_200_000,
    originalPrice: 14_900_000,
    discount: 65,
    renewalPrice: 10_000_000,
    isPopular: false,
    isPremium: true,
    specs: [
      { label: "vCPU", value: "8 Core" },
      { label: "RAM", value: "32 GB" },
      { label: "NVMe", value: "400 GB" },
    ],
  },
];

interface MidtransItemDetail {
  id: string;
  price: number;
  quantity: number;
  name: string;
  brand?: string;
  category?: string;
  merchant_name?: string;
}

interface MidtransTransactionResponse {
  token?: string;
  redirect_url?: string;
  error_messages?: string[];
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function getMidtransSnapUrl(): string {
  return config.midtransIsProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
}

export class HostingService {
  static getPlans(): HostingPlan[] {
    return HOSTING_PLANS;
  }

  static getPlanById(planId: string): HostingPlan | null {
    return HOSTING_PLANS.find((plan) => plan.id === planId) ?? null;
  }

  static async createMidtransTransaction(planId: string, customer: HostingCustomer) {
    const plan = this.getPlanById(planId);
    if (!plan) throw new Error("Paket hosting tidak tersedia.");

    if (!config.midtransServerKey) {
      throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi.");
    }

    const orderId = `labkom-vps-${plan.id}-${Date.now()}`;
    const { firstName, lastName } = splitName(customer.fullName);
    const specsLine = plan.specs.map((spec) => `${spec.value} ${spec.label}`).join(" / ");
    const brandName = config.hostingBrandName;

    const itemDetails: MidtransItemDetail[] = [
      {
        id: `${plan.id}-base`,
        price: plan.originalPrice,
        quantity: 1,
        name: truncate(`${plan.name} ${plan.subtitle} (12 bulan)`, 50),
        brand: brandName,
        category: "VPS Hosting",
        merchant_name: brandName,
      },
      {
        id: `${plan.id}-discount`,
        price: -(plan.originalPrice - plan.price),
        quantity: 1,
        name: truncate(`Diskon Promo (Hemat ${plan.discount}%)`, 50),
        category: "Discount",
        merchant_name: brandName,
      },
    ];

    const subtotal = itemDetails.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (subtotal !== plan.price) {
      throw new Error("Konfigurasi harga paket tidak valid.");
    }

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: plan.price,
      },
      item_details: itemDetails,
      customer_details: {
        first_name: firstName,
        last_name: lastName,
        email: customer.email,
        phone: customer.whatsapp,
        billing_address: {
          first_name: firstName,
          last_name: lastName,
          email: customer.email,
          phone: customer.whatsapp,
          country_code: "IDN",
        },
      },
      callbacks: {
        finish: `${config.appUrl}/layanan-hosting/payment/success?order_id=${encodeURIComponent(orderId)}`,
        error: `${config.appUrl}/layanan-hosting/payment/failed?order_id=${encodeURIComponent(orderId)}`,
        pending: `${config.appUrl}/layanan-hosting/payment/success?status=pending&order_id=${encodeURIComponent(orderId)}`,
      },
      credit_card: {
        secure: true,
      },
      custom_field1: truncate(
        JSON.stringify({ name: customer.fullName, email: customer.email, whatsapp: customer.whatsapp }),
        255
      ),
      custom_field2: truncate(
        JSON.stringify({ planId: plan.id, planName: plan.name, amount: plan.price, specs: specsLine }),
        255
      ),
      custom_field3: truncate(customer.notes || "", 255),
    };

    const response = await fetch(getMidtransSnapUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.midtransServerKey}:`).toString("base64")}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as MidtransTransactionResponse;

    if (!response.ok || !data.redirect_url) {
      const message = data.error_messages?.join(", ") || "Gagal membuat transaksi Midtrans.";
      throw new Error(message);
    }

    return {
      orderId,
      token: data.token,
      redirectUrl: data.redirect_url,
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
      },
    };
  }
}
