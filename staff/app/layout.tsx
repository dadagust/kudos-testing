import "../styles/globals.sass";

import type { Metadata } from "next";

import { AppProviders } from "@/app/providers";

export const metadata: Metadata = {
  title: "Kudos Admin Gateway",
  description: "Админ-панель агрегатора kudos.ru",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
