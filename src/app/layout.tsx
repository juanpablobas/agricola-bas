import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Agrícola BAS", template: "%s · Agrícola BAS" },
  description: "Gestión agrícola, administrativa y financiera del Fundo La Morera",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Agrícola BAS", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icono-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icono-apple.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#24533f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
