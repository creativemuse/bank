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
  title: "Creative Bank",
  description:
    "Banking designed for creatives. Manage your income, track expenses, and save for your dreams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${conthrax.variable} relative box-content overflow-hidden antialiased`}
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
