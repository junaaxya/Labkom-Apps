import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/query-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineIndicator } from "@/components/pwa/offline-indicator";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegistration } from "@/components/pwa/sw-registration";
import { AppSplash } from "@/components/pwa/app-splash";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import type { Viewport } from "next";

export const metadata: Metadata = {
  title: "LabKom — Sistem Manajemen Laboratorium",
  description:
    "Sistem Manajemen Laboratorium Terpusat dengan QR Tracking, Digital Logbook, dan Ticketing Kerusakan",
  manifest: "/manifest-labkom-20260708.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LabKom",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/labkom-app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/labkom-app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/labkom-apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#4b607f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <QueryProvider>
          <ToastProvider>
            <TooltipProvider>
              <OfflineIndicator />
              <InstallPrompt />
              <ServiceWorkerRegistration />
              <AppSplash />
              {children}
            </TooltipProvider>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
