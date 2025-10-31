
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agro Paquetes por Semana",
  description: "Siembras vivas por semana ISO y recetas correspondientes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
