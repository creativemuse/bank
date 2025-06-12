import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        className={`${geistSans.variable} ${geistMono.variable} relative box-content overflow-hidden antialiased`}
      >
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed left-0 top-0 -z-10 h-full w-full object-cover"
          src="/video/background.mp4"
        />
        {/* Optional overlay for readability */}
        {/* <div className="fixed top-0 left-0 w-full h-full bg-black/40 -z-10" /> */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
