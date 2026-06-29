import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Favplace — Кольцо с рельефом любимого места",
  description: "Создайте уникальное кольцо с топографическим рельефом места, которое вам дорого",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
