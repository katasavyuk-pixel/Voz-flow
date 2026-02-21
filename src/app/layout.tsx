import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voz Flow - Dictado con IA",
  description:
    "Transforma tu voz en texto perfecto. Dicta en español o inglés y deja que la IA haga el resto.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3333",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="font-sans antialiased bg-[#0A0A0B] text-white">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
