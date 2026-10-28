import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "착공계 자동화",
  description: "착공계·공정표·인원장비투입계획 자동화 (관리자 전용)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
