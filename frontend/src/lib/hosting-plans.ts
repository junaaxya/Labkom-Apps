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

export function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}
