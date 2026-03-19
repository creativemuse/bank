import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const conthrax = localFont({
  src: "../public/fonts/ConthraxSb-Regular.otf",
  variable: "--font-conthrax",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://creativeplatform.xyz"
        : "http://localhost:3000")
  ),
  title: "Creative Bank",
  description:
    "Banking designed for creatives. Manage your income, track expenses, and save for your dreams.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Creative Bank",
  },
  icons: {
    icon: [
      { url: "/icons/v2/white_bg/white_creative_icon_192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/v2/white_bg/white_creative_products-152x152.png", sizes: "152x152", type: "image/png" },
    ],
    apple: [
      { url: "/icons/v2/white_bg/white_creative_icons-180x180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/v2/white_bg/white_creative_products-152x152.png", sizes: "152x152", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "Creative Bank",
    title: "Creative Bank",
    description:
      "Banking designed for creatives. Manage your income, track expenses, and save for your dreams.",
    images: [
      {
        url: "/Creative_Bank.png",
        width: 1200,
        height: 630,
        alt: "Creative Bank",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creative Bank",
    description:
      "Banking designed for creatives. Manage your income, track expenses, and save for your dreams.",
    images: ["/Creative_Bank.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${conthrax.variable} relative box-content overflow-x-hidden antialiased`}
      >
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed left-0 top-0 -z-20 h-full w-full object-cover"
          src="/video/background.mp4"
        />
        {/* Overlay for readability */}
        <div className="pointer-events-none fixed left-0 top-0 -z-10 h-full w-full bg-black/40" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
