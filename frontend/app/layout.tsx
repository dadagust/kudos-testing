import type { ReactNode } from 'react';
import './globals.css';
import { MSWProvider } from './providers/msw-provider';
import { MainNav } from '../components/main-nav';

export const metadata = {
  title: 'Kudos Storefront',
  description: 'Витрина магазина Kudos.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="app-body">
        <MSWProvider>
          <div className="layout">
            <header className="header">
              <div className="header__inner">
                <div className="header__brand">
                  <span className="brand">Kudos Storefront</span>
                  <span className="brand__tagline">Аренда мебели и декора для событий</span>
                </div>
                <MainNav />
              </div>
            </header>
            <main className="main" role="main">
              <div className="container">{children}</div>
            </main>
            <footer className="footer">
              <div className="container footer__inner">
                <p>© {new Date().getFullYear()} Kudos. Все права защищены.</p>
                <p className="footer__hint">Это демо-версия витрины. Данные загружаются из моков.</p>
              </div>
            </footer>
          </div>
        </MSWProvider>
      </body>
    </html>
  );
}
