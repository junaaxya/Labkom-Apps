import crypto from "crypto";
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

export interface HostingPaymentMethod {
  paymentMethod: string;
  paymentName: string;
  paymentImage?: string;
  totalFee?: string | number;
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

interface DuitkuItemDetail {
  price: number;
  quantity: number;
  name: string;
}

interface DuitkuTransactionResponse {
  merchantCode?: string;
  reference?: string;
  paymentUrl?: string;
  vaNumber?: string;
  amount?: string;
  statusCode?: string;
  statusMessage?: string;
  Message?: string;
}

interface DuitkuStatusResponse {
  merchantOrderId?: string;
  reference?: string;
  amount?: string;
  statusCode?: string;
  statusMessage?: string;
  Message?: string;
}

interface DuitkuPaymentMethodResponse {
  paymentFee?: HostingPaymentMethod[];
  paymentMethods?: HostingPaymentMethod[];
  statusCode?: string;
  statusMessage?: string;
  Message?: string;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function getDuitkuBaseUrl(): string {
  return config.duitkuIsProduction
    ? "https://passport.duitku.com/webapi/api/merchant"
    : "https://sandbox.duitku.com/webapi/api/merchant";
}

function createDuitkuSignature(value: string): string {
  return crypto.createHmac("sha256", config.duitkuApiKey).update(value).digest("hex");
}

function assertDuitkuConfig(): void {
  if (!config.duitkuMerchantCode) {
    throw new Error("DUITKU_MERCHANT_CODE belum dikonfigurasi.");
  }

  if (!config.duitkuApiKey) {
    throw new Error("DUITKU_API_KEY belum dikonfigurasi.");
  }

  if (!config.duitkuCallbackUrl) {
    throw new Error("DUITKU_CALLBACK_URL belum dikonfigurasi.");
  }
}

function findPlanFromOrderId(orderId: string): HostingPlan | null {
  return HOSTING_PLANS.find((plan) => orderId.startsWith(`labkom-vps-${plan.id}-`)) ?? null;
}

function mapDuitkuStatus(statusCode?: string): "SUCCESS" | "PROCESS" | "FAILED" | "UNKNOWN" {
  if (statusCode === "00") return "SUCCESS";
  if (statusCode === "01") return "PROCESS";
  if (statusCode === "02") return "FAILED";
  return "UNKNOWN";
}

function getDuitkuErrorMessage(data: DuitkuTransactionResponse | DuitkuStatusResponse | DuitkuPaymentMethodResponse): string {
  return data.statusMessage || data.Message || "Gagal memproses request ke Duitku.";
}

function formatDuitkuDatetime(date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export class HostingService {
  static getPlans(): HostingPlan[] {
    return HOSTING_PLANS;
  }

  static getPlanById(planId: string): HostingPlan | null {
    return HOSTING_PLANS.find((plan) => plan.id === planId) ?? null;
  }

  static async createDuitkuTransaction(planId: string, customer: HostingCustomer, paymentMethod: string) {
    const plan = this.getPlanById(planId);
    if (!plan) throw new Error("Paket hosting tidak tersedia.");

    assertDuitkuConfig();

    const orderId = `labkom-vps-${plan.id}-${Date.now()}`;
    const { firstName, lastName } = splitName(customer.fullName);
    const specsLine = plan.specs.map((spec) => `${spec.value} ${spec.label}`).join(" / ");
    const brandName = config.hostingBrandName;

    const itemDetails: DuitkuItemDetail[] = [
      {
        price: plan.price,
        quantity: 1,
        name: truncate(`${plan.name} ${plan.subtitle} (12 bulan)`, 255),
      },
    ];

    const subtotal = itemDetails.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (subtotal !== plan.price) {
      throw new Error("Konfigurasi harga paket tidak valid.");
    }

    const payload = {
      merchantCode: config.duitkuMerchantCode,
      paymentAmount: plan.price,
      paymentMethod,
      merchantOrderId: orderId,
      productDetails: truncate(`${plan.name} - ${plan.subtitle} (12 bulan) - ${brandName}`, 255),
      email: customer.email,
      phoneNumber: customer.whatsapp,
      customerVaName: truncate(customer.fullName, 50),
      itemDetails,
      customerDetail: {
        firstName,
        lastName,
        email: customer.email,
        phoneNumber: customer.whatsapp,
      },
      callbackUrl: config.duitkuCallbackUrl,
      returnUrl: `${config.appUrl}/layanan-hosting/payment/status`,
      expiryPeriod: 1440,
      additionalParam: truncate(JSON.stringify({ notes: customer.notes || "", specs: specsLine }), 255),
      signature: createDuitkuSignature(`${config.duitkuMerchantCode}${orderId}${plan.price}`),
    };

    const response = await fetch(`${getDuitkuBaseUrl()}/v2/inquiry`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as DuitkuTransactionResponse;

    if (!response.ok || !data.paymentUrl) {
      throw new Error(getDuitkuErrorMessage(data));
    }

    return {
      orderId,
      reference: data.reference,
      paymentUrl: data.paymentUrl,
      redirectUrl: data.paymentUrl,
      vaNumber: data.vaNumber,
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
      },
    };
  }

  static verifyDuitkuCallbackSignature(payload: Record<string, any>): boolean {
    if (!config.duitkuApiKey) return false;

    const merchantCode = String(payload.merchantCode || "");
    const amount = String(payload.amount || "");
    const merchantOrderId = String(payload.merchantOrderId || "");
    const signature = String(payload.signature || "");

    if (!merchantCode || !amount || !merchantOrderId || !signature) return false;

    const expected = createDuitkuSignature(`${merchantCode}${amount}${merchantOrderId}`);
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(signature.toLowerCase(), "utf8");

    if (expectedBuffer.length !== providedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  static async getTransactionStatusLive(orderId: string) {
    assertDuitkuConfig();

    const plan = findPlanFromOrderId(orderId);
    if (!plan) {
      throw new Error("Order ID hosting tidak valid.");
    }

    const payload = {
      merchantCode: config.duitkuMerchantCode,
      merchantOrderId: orderId,
      signature: createDuitkuSignature(`${config.duitkuMerchantCode}${orderId}`),
    };

    const response = await fetch(`${getDuitkuBaseUrl()}/transactionStatus`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as DuitkuStatusResponse;

    if (!response.ok) {
      throw new Error(getDuitkuErrorMessage(data));
    }

    return {
      orderId,
      status: mapDuitkuStatus(data.statusCode),
      statusCode: data.statusCode || "UNKNOWN",
      statusMessage: data.statusMessage || "",
      reference: data.reference,
      planName: `${plan.name} - ${plan.subtitle}`,
      amount: plan.price,
    };
  }

  static async getActivePaymentMethods(amount: number): Promise<HostingPaymentMethod[]> {
    assertDuitkuConfig();

    const datetime = formatDuitkuDatetime();
    const payload = {
      merchantcode: config.duitkuMerchantCode,
      amount,
      datetime,
      signature: createDuitkuSignature(`${config.duitkuMerchantCode}${amount}${datetime}`),
    };

    const response = await fetch(`${getDuitkuBaseUrl()}/paymentmethod/getpaymentmethod`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as DuitkuPaymentMethodResponse;

    if (!response.ok) {
      throw new Error(getDuitkuErrorMessage(data));
    }

    return data.paymentFee || data.paymentMethods || [];
  }
}
