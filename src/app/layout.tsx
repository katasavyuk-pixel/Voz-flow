import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Mi SaaS - Plataforma Todo-en-Uno",
    template: "%s | Mi SaaS",
  },
  description:
    "La plataforma todo-en-uno para gestionar tu negocio. Automatiza procesos, aumenta ventas y haz crecer tu empresa.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "Mi SaaS - Plataforma Todo-en-Uno",
    description: "La plataforma todo-en-uno para gestionar tu negocio.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
