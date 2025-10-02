import "../styles/globals.sass";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/globals.sass";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kudos",
  description: "Next.js + Django"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
