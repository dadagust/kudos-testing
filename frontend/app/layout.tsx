import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kudos Storefront",
  description: "Customer-facing storefront for the Kudos platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
