import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workbook PDF Generator",
  description: "Upload workbook content, pick a template, and download a fillable PDF.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen antialiased">{children}</body>
    </html>
  );
}
