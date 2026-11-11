import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tangata, portal de personas",
  description: "Portal de personas de Comercial Te Moana",
};

export const viewport: Viewport = {
  themeColor: "#0b5563",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
