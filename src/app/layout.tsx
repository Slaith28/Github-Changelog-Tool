import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "GitHub Changelog Tool",
  description: "AI-powered changelog generator from GitHub commits",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`dark ${montserrat.className}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
