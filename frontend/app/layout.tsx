import type { ReactNode } from 'react';
import './globals.css';
import { MSWProvider } from './providers/msw-provider';

export const metadata = {
  title: 'Kudos Storefront',
  description: 'Витрина магазина Kudos.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <MSWProvider>{children}</MSWProvider>
      </body>
    </html>
  );
}
