import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adidas Stock Management",
  description: "Multi-store inventory and receipt management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // scroll-smooth so in-page jumps — such as opening a report trend —
    // glide to the target rather than teleporting.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
