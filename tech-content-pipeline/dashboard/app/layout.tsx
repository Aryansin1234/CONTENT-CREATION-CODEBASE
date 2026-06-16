import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tech Content Pipeline",
  description: "Review and approve AI-generated social content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-dark text-white min-h-screen font-sans">{children}</body>
    </html>
  );
}
